import OpenAI from 'openai';
import { getQdrant } from '../vector/index.js';
import type { VectorPoint } from '../vector/index.js';

export interface EmbedderConfig {
  model?: string;
  dimensions?: number;
}

export interface ContentToEmbed {
  id: string;
  text: string;
  projectId: string;
  source: string;
  chunkIndex: number;
  metadata?: Record<string, unknown>;
}

export interface EmbeddedContent {
  id: string;
  vector: number[];
  projectId: string;
  source: string;
  chunkIndex: number;
  metadata?: Record<string, unknown>;
}

export class EmbedderService {
  private client: OpenAI;
  private model: string;
  private dimensions: number;

  constructor(config: EmbedderConfig = {}) {
    this.client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
    this.model = config.model || 'text-embedding-3-small';
    this.dimensions = config.dimensions || 1536;
  }

  async embedText(text: string): Promise<number[]> {
    if (!text || text.trim().length === 0) {
      throw new Error('Cannot embed empty text');
    }

    try {
      const response = await this.client.embeddings.create({
        input: text,
        model: this.model,
        encoding_format: 'float',
      });

      if (!response.data || response.data.length === 0) {
        throw new Error('No embedding returned from OpenAI');
      }

      return response.data[0].embedding;
    } catch (error) {
      throw new Error(
        `Failed to embed text: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) {
      throw new Error('Cannot embed empty batch');
    }

    try {
      const response = await this.client.embeddings.create({
        input: texts,
        model: this.model,
        encoding_format: 'float',
      });

      if (!response.data || response.data.length !== texts.length) {
        throw new Error('Embedding count mismatch');
      }

      return response.data
        .sort((a, b) => a.index - b.index)
        .map((item) => item.embedding);
    } catch (error) {
      throw new Error(
        `Failed to embed batch: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  async embedAndUpsert(
    content: ContentToEmbed[],
    _collectionName: string = 'portfolio_content'
  ): Promise<number> {
    if (content.length === 0) {
      return 0;
    }

    try {
      const texts = content.map((c) => c.text);
      const embeddings = await this.embedBatch(texts);

      const qdrant = getQdrant();
      const points: VectorPoint[] = content.map((c, idx) => ({
        id: c.id,
        vector: embeddings[idx],
        payload: {
          projectId: c.projectId,
          source: c.source,
          chunkIndex: c.chunkIndex,
          text: c.text,
          metadata: c.metadata,
          createdAt: new Date().toISOString(),
        },
      }));

      await qdrant.upsert(points);
      return points.length;
    } catch (error) {
      throw new Error(
        `Failed to embed and upsert: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  async getUsage(): Promise<{ model: string; dimensions: number }> {
    return {
      model: this.model,
      dimensions: this.dimensions,
    };
  }
}

let embedderInstance: EmbedderService | null = null;

export function getEmbedder(config?: EmbedderConfig): EmbedderService {
  if (!embedderInstance) {
    embedderInstance = new EmbedderService(config);
  }
  return embedderInstance;
}
