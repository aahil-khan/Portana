import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { getEmbedder } from './embedder.js';
import { getQdrant } from '../vector/index.js';
import type { VectorPoint } from '../vector/index.js';
import { createLogger } from '../utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const logger = createLogger('CheatsheetIngestor');

export interface ChunkedCheatsheet {
  id: string;
  text: string;
  section: string;
  chunkIndex: number;
  metadata?: Record<string, unknown>;
}

interface QAEntry {
  question: string;
  answer: string;
}

/**
 * Ingest cheatsheet Q&A into Qdrant
 * Single source file: backend/data/cheatsheet/cheatsheet.json
 * Each Q&A becomes a searchable vector with source tag 'cheatsheet'
 */
export class CheatsheetIngestor {
  private cheatsheet: QAEntry[] | null = null;

  constructor() {
    this.loadCheatsheet();
  }

  /**
   * Load cheatsheet from JSON file with multi-path fallback
   */
  private loadCheatsheet(): void {
    // Try multiple candidate paths to handle different CWDs in deploy
    const possiblePaths = [
      // when process.cwd() is repo root
      resolve(process.cwd(), 'backend', 'data', 'cheatsheet', 'cheatsheet.json'),
      resolve(process.cwd(), 'data', 'cheatsheet', 'cheatsheet.json'),
      // when process.cwd() is backend/
      resolve(process.cwd(), 'data', 'cheatsheet', 'cheatsheet.json'),
      // relative to compiled dist location
      resolve(__dirname, '../../data', 'cheatsheet', 'cheatsheet.json'),
      resolve(__dirname, '../data', 'cheatsheet', 'cheatsheet.json'),
    ];

    let cheatsheetPath: string | null = null;
    for (const p of possiblePaths) {
      if (existsSync(p)) {
        cheatsheetPath = p;
        break;
      }
    }

    if (!cheatsheetPath) {
      logger.warn('Cheatsheet file not found. Searched: ' + possiblePaths.join(' | '));
      return;
    }

    try {
      const content = readFileSync(cheatsheetPath, 'utf-8');
      const qaEntries = JSON.parse(content) as QAEntry[];

      if (!Array.isArray(qaEntries)) {
        throw new Error('Cheatsheet is not an array');
      }

      // Validate Q&A structure
      const validEntries = qaEntries.filter((entry) => {
        if (!entry.question || !entry.answer) {
          logger.warn(`Skipping malformed Q&A entry`);
          return false;
        }
        return true;
      });

      if (validEntries.length === 0) {
        throw new Error('No valid Q&A entries found in cheatsheet');
      }

      this.cheatsheet = validEntries;
      logger.info(`Loaded ${validEntries.length} Q&A entries from ${cheatsheetPath}`);
    } catch (error) {
      logger.error(`Failed to load cheatsheet: ${error}`);
      throw error;
    }
  }

  /**
   * Create chunks from Q&A entries
   */
  private createChunks(): ChunkedCheatsheet[] {
    if (!this.cheatsheet) throw new Error('Cheatsheet not loaded');

    const chunks: ChunkedCheatsheet[] = [];

    this.cheatsheet.forEach((entry, index) => {
      const text = `Q: ${entry.question}\nA: ${entry.answer}`;
      chunks.push({
        id: `cheatsheet-${index}`,
        text,
        section: 'cheatsheet',
        chunkIndex: index,
        metadata: {
          section: 'cheatsheet',
          question: entry.question,
          answer: entry.answer,
          index,
        },
      });
    });

    logger.info(`Created ${chunks.length} chunks from cheatsheet`);
    return chunks;
  }

  /**
   * Main ingest method - delete old data, chunk, embed, and upsert to Qdrant
   */
  async ingest(): Promise<{ totalChunks: number; totalVectors: number }> {
    const startTime = Date.now();
    try {
      logger.info('Starting cheatsheet ingestion...');

      if (!this.cheatsheet || this.cheatsheet.length === 0) {
        throw new Error('Cheatsheet not loaded or empty');
      }

      // Step 1: Delete old cheatsheet embeddings
      logger.info('Deleting old cheatsheet embeddings...');
      const qdrant = getQdrant();
      const deletedCount = await qdrant.deleteBySource(['cheatsheet']);
      logger.info(`Deleted ${deletedCount} old vectors`);

      // Step 2: Create chunks from Q&A
      const chunks = this.createChunks();
      if (chunks.length === 0) {
        throw new Error('No chunks created from cheatsheet');
      }
      logger.info(`Created ${chunks.length} cheatsheet chunks`);

      // Step 3: Batch embed all chunks
      logger.info('Starting batch embedding...');
      const embedder = getEmbedder();
      const embeddedChunks: Array<ChunkedCheatsheet & { vector: number[] }> = [];
      const BATCH_SIZE = 100;

      for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
        const batch = chunks.slice(i, i + BATCH_SIZE);
        const texts = batch.map((c) => c.text);

        try {
          const vectors = await embedder.embedBatch(texts);

          batch.forEach((chunk, idx) => {
            embeddedChunks.push({ ...chunk, vector: vectors[idx] });
          });

          logger.info(`Embedded ${Math.min(i + BATCH_SIZE, chunks.length)}/${chunks.length} chunks`);
        } catch (error) {
          logger.error(`Failed to embed batch starting at index ${i}: ${error}`);
          throw error;
        }
      }

      logger.info(`Successfully embedded ${embeddedChunks.length} chunks`);

      // Step 4: Upsert to Qdrant
      logger.info('Upserting to Qdrant...');
      const points: VectorPoint[] = embeddedChunks.map((chunk) => ({
        id: chunk.id,
        vector: chunk.vector,
        payload: {
          text: chunk.text,
          section: chunk.section,
          chunkIndex: chunk.chunkIndex,
          source: 'cheatsheet',
          projectName: 'Portana Cheatsheet',
          metadata: chunk.metadata,
        },
      }));

      await qdrant.upsert(points);

      const duration = ((Date.now() - startTime) / 1000).toFixed(2);
      logger.info(`Successfully upserted ${points.length} vectors to Qdrant in ${duration}s`);

      return {
        totalChunks: chunks.length,
        totalVectors: points.length,
      };
    } catch (error) {
      const duration = ((Date.now() - startTime) / 1000).toFixed(2);
      logger.error(`Cheatsheet ingestion failed after ${duration}s: ${error}`);
      throw error;
    }
  }
}

let cheatsheetIngestorInstance: CheatsheetIngestor | null = null;

export function getCheatsheetIngestor(): CheatsheetIngestor {
  if (!cheatsheetIngestorInstance) {
    cheatsheetIngestorInstance = new CheatsheetIngestor();
  }
  return cheatsheetIngestorInstance;
}
