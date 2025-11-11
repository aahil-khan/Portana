import axios, { AxiosError } from 'axios';
import { getEmbedder } from './embedder.js';
import { getQdrant } from '../vector/index.js';
import type { VectorPoint } from '../vector/index.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('GitHubIngestor');

export interface GitHubRepo {
  owner: string;
  repo: string;
  url: string;
  description?: string;
}

export interface ChunkedContent {
  id: string;
  text: string;
  projectId: string;
  projectName: string;
  source: string;
  repoUrl: string;
  section: string;
  chunkIndex: number;
  metadata?: Record<string, unknown>;
}

const CHUNK_SIZE = 500; // Characters per chunk
const CHUNK_OVERLAP = 50; // Overlap between chunks for context

export class GitHubIngestor {
  private githubToken: string | null = null;

  constructor() {
    this.githubToken = process.env.GITHUB_TOKEN || null;
    if (!this.githubToken) {
      logger.warn('GITHUB_TOKEN not set - requests will be rate limited (60/hour)');
    }
  }

  /**
   * Fetch README from a GitHub repo
   */
  async fetchREADME(owner: string, repo: string): Promise<string> {
    try {
      const url = `https://api.github.com/repos/${owner}/${repo}/readme`;
      const headers: Record<string, string> = {
        Accept: 'application/vnd.github.v3.raw',
      };

      if (this.githubToken) {
        headers.Authorization = `token ${this.githubToken}`;
      }

      const response = await axios.get(url, { headers });
      return response.data;
    } catch (err) {
      const error = err as AxiosError;
      const message = error?.response?.status 
        ? `${error.response.status}: ${error.response.statusText}` 
        : String(err);
      throw new Error(`Failed to fetch README for ${owner}/${repo}: ${message}`);
    }
  }

  /**
   * Split text into overlapping chunks
   */
  private chunkText(text: string): string[] {
    if (!text || text.length === 0) return [];

    const chunks: string[] = [];
    const lines = text.split('\n');
    let currentChunk = '';

    for (const line of lines) {
      if ((currentChunk + line).length > CHUNK_SIZE && currentChunk.length > 0) {
        chunks.push(currentChunk.trim());
        // Add overlap
        currentChunk = currentChunk.slice(-CHUNK_OVERLAP) + '\n' + line;
      } else {
        currentChunk += (currentChunk ? '\n' : '') + line;
      }
    }

    if (currentChunk.trim()) {
      chunks.push(currentChunk.trim());
    }

    return chunks;
  }

  /**
   * Extract sections from README (e.g., ## Features, ## Installation)
   */
  private extractSections(readme: string): Map<string, string> {
    const sections = new Map<string, string>();
    let lastSection = 'Overview';
    let currentContent = '';

    const lines = readme.split('\n');
    for (const line of lines) {
      const match = line.match(/^#+\s+(.+)$/);
      if (match) {
        if (currentContent) {
          sections.set(lastSection, currentContent.trim());
        }
        lastSection = match[1].trim();
        currentContent = '';
      } else {
        currentContent += (currentContent ? '\n' : '') + line;
      }
    }

    if (currentContent) {
      sections.set(lastSection, currentContent.trim());
    }

    return sections;
  }

  /**
   * Process README into chunks with metadata
   */
  private processREADME(
    readme: string,
    owner: string,
    repo: string,
    repoUrl: string
  ): ChunkedContent[] {
    const projectId = repo.toLowerCase().replace(/[^a-z0-9-]/g, '-');
    const projectName = repo.replace(/[-_]/g, ' ');
    const sections = this.extractSections(readme);

    const chunkedContent: ChunkedContent[] = [];
    let globalChunkIndex = 0;

    // Process each section
    for (const [section, content] of sections.entries()) {
      if (!content || content.length < 20) continue; // Skip tiny sections

      const chunks = this.chunkText(content);

      for (const chunk of chunks) {
        chunkedContent.push({
          id: `${projectId}-${section.toLowerCase().replace(/\s+/g, '-')}-${globalChunkIndex}`,
          text: chunk,
          projectId,
          projectName,
          source: 'github_readme',
          repoUrl,
          section,
          chunkIndex: globalChunkIndex,
          metadata: {
            owner,
            repo,
            section,
            contentLength: chunk.length,
          },
        });

        globalChunkIndex++;
      }
    }

    return chunkedContent;
  }

  /**
   * Ingest a single repo
   */
  async ingestRepo(repo: GitHubRepo): Promise<{ count: number; vectors: number }> {
    try {
      logger.info(`Ingesting repo: ${repo.owner}/${repo.repo}`, { repo });

      // Fetch README
      const readme = await this.fetchREADME(repo.owner, repo.repo);
      logger.info(`Fetched README for ${repo.repo}`, { size: readme.length });

      // Process into chunks
      const chunkedContent = this.processREADME(
        readme,
        repo.owner,
        repo.repo,
        repo.url
      );
      logger.info(`Processed ${chunkedContent.length} chunks`, { repo: repo.repo });

      if (chunkedContent.length === 0) {
        logger.warn(`No chunks created for ${repo.repo}`);
        return { count: 0, vectors: 0 };
      }

      // Embed chunks
      const embedder = getEmbedder();
      const texts = chunkedContent.map(c => c.text);
      const embeddings = await embedder.embedBatch(texts);
      logger.info(`Embedded ${embeddings.length} chunks`, { repo: repo.repo });

      // Create vectors for Qdrant
      const vectors: VectorPoint[] = chunkedContent.map((content, idx) => ({
        id: content.id,
        vector: embeddings[idx],
        payload: {
          text: content.text,
          projectId: content.projectId,
          projectName: content.projectName,
          source: content.source,
          repoUrl: content.repoUrl,
          section: content.section,
          chunkIndex: content.chunkIndex,
          owner: repo.owner,
          repo: repo.repo,
          metadata: content.metadata,
          ingestedAt: new Date().toISOString(),
        },
      }));

      // Upsert to Qdrant
      const qdrant = getQdrant();
      await qdrant.upsert(vectors);
      logger.info(`Upserted ${vectors.length} vectors to Qdrant`, { repo: repo.repo });

      return {
        count: chunkedContent.length,
        vectors: vectors.length,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error(`Failed to ingest repo ${repo.repo}`, { error: message });
      throw error;
    }
  }

  /**
   * Ingest multiple repos
   */
  async ingestMultipleRepos(repos: GitHubRepo[]): Promise<{
    success: boolean;
    totalChunks: number;
    totalVectors: number;
    results: Record<string, { chunks: number; vectors: number; error?: string }>;
  }> {
    const results: Record<string, { chunks: number; vectors: number; error?: string }> = {};
    let totalChunks = 0;
    let totalVectors = 0;

    logger.info(`Starting ingestion for ${repos.length} repos`);

    for (const repo of repos) {
      try {
        const { count, vectors } = await this.ingestRepo(repo);
        results[repo.repo] = { chunks: count, vectors };
        totalChunks += count;
        totalVectors += vectors;
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        results[repo.repo] = { chunks: 0, vectors: 0, error: message };
        logger.error(`Failed to ingest ${repo.repo}`, { error: message });
      }
    }

    logger.info(`Ingestion complete`, {
      totalChunks,
      totalVectors,
      reposProcessed: repos.length,
    });

    return {
      success: totalVectors > 0,
      totalChunks,
      totalVectors,
      results,
    };
  }

  /**
   * Predefined repos for Aahil
   */
  getDefaultRepos(): GitHubRepo[] {
    return [
      {
        owner: 'aahil-khan',
        repo: 'skillmap',
        url: 'https://github.com/aahil-khan/skillmap',
        description: 'SkillMap Frontend - Skill mapping and tracking application',
      },
      {
        owner: 'aahil-khan',
        repo: 'skillmap_engine',
        url: 'https://github.com/aahil-khan/skillmap_engine',
        description: 'SkillMap Backend - Resume parsing and skill extraction engine',
      },
      {
        owner: 'Dean-DCT-Thapar',
        repo: 'edutube',
        url: 'https://github.com/Dean-DCT-Thapar/edutube',
        description: 'EduTube - Educational video platform',
      },
      {
        owner: 'aahil-khan',
        repo: 'intellidine',
        url: 'https://github.com/aahil-khan/intellidine',
        description: 'IntelliDine - AI-powered restaurant recommendation system',
      },
    ];
  }
}

let githubIngestor: GitHubIngestor | null = null;

export function getGitHubIngestor(): GitHubIngestor {
  if (!githubIngestor) {
    githubIngestor = new GitHubIngestor();
  }
  return githubIngestor;
}
