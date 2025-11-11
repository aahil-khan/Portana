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

// Structured data for 3-tier vector approach
export interface SkillVector {
  name: string;
  category: string;
}

export interface ExperienceVector {
  title: string;
  company: string;
  duration?: string;
}

export interface ProfileStructure {
  skills: SkillVector[];
  experience: ExperienceVector[];
  education: Array<{ degree: string; institution: string }>;
}

export class EmbedderService {
  private client: OpenAI | null = null;
  private model: string;
  private dimensions: number;
  private apiKeyAvailable: boolean;

  constructor(config: EmbedderConfig = {}) {
    this.model = config.model || 'text-embedding-3-small';
    this.dimensions = config.dimensions || 1536;
    this.apiKeyAvailable = !!process.env.OPENAI_API_KEY;
    
    if (this.apiKeyAvailable) {
      try {
        this.client = new OpenAI({
          apiKey: process.env.OPENAI_API_KEY,
        });
      } catch (error) {
        console.warn('Failed to initialize OpenAI client:', error);
        this.apiKeyAvailable = false;
      }
    }
  }

  private getClient(): OpenAI {
    if (!this.client) {
      throw new Error('OpenAI API key not available. Set OPENAI_API_KEY environment variable.');
    }
    return this.client;
  }

  async embedText(text: string): Promise<number[]> {
    if (!text || text.trim().length === 0) {
      throw new Error('Cannot embed empty text');
    }

    try {
      const response = await this.getClient().embeddings.create({
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
      const response = await this.getClient().embeddings.create({
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

  /**
   * 3-Tier Vector Approach:
   * Tier 1: Structured Skills (each skill as vector)
   * Tier 2: Structured Experience (each role as vector)
   * Tier 3: Resume Chunks (for semantic search)
   */
  async embedProfile3Tier(
    projectId: string,
    profile: ProfileStructure,
    resumeText: string
  ): Promise<number> {
    try {
      const qdrant = getQdrant();
      const points: VectorPoint[] = [];

      // Tier 1: Embed each skill individually
      const skillTexts = profile.skills.map(
        (s) => `${s.name} (${s.category})`
      );
      if (skillTexts.length > 0) {
        const skillEmbeddings = await this.embedBatch(skillTexts);
        profile.skills.forEach((skill, idx) => {
          points.push({
            id: `${projectId}-skill-${skill.name.toLowerCase().replace(/\s+/g, '-')}`,
            vector: skillEmbeddings[idx],
            payload: {
              type: 'skill',
              projectId,
              skill: skill.name,
              category: skill.category,
              source: 'resume',
              createdAt: new Date().toISOString(),
              // Reference-based: no full data
              _dbRef: `skill:${skill.name}`,
            },
          });
        });
      }

      // Tier 2: Embed each experience entry
      const experienceTexts = profile.experience.map(
        (e) => `${e.title} at ${e.company}${e.duration ? ` (${e.duration})` : ''}`
      );
      if (experienceTexts.length > 0) {
        const expEmbeddings = await this.embedBatch(experienceTexts);
        profile.experience.forEach((exp, idx) => {
          points.push({
            id: `${projectId}-experience-${idx}`,
            vector: expEmbeddings[idx],
            payload: {
              type: 'experience',
              projectId,
              title: exp.title,
              company: exp.company,
              duration: exp.duration,
              source: 'resume',
              createdAt: new Date().toISOString(),
              // Reference-based
              _dbRef: `experience:${projectId}:${idx}`,
            },
          });
        });
      }

      // Tier 3: Embed resume chunks for semantic search
      const chunks = this.chunkText(resumeText, 500);
      const chunkTexts = chunks.filter((c) => c.trim().length > 0);
      if (chunkTexts.length > 0) {
        const chunkEmbeddings = await this.embedBatch(chunkTexts);
        chunkTexts.forEach((chunk, idx) => {
          points.push({
            id: `${projectId}-resume-chunk-${idx}`,
            vector: chunkEmbeddings[idx],
            payload: {
              type: 'resume_chunk',
              projectId,
              chunkIndex: idx,
              source: 'resume',
              createdAt: new Date().toISOString(),
              // Store only reference, not full text
              _dbRef: `resume_chunk:${projectId}:${idx}`,
              _textPreview: chunk.substring(0, 100), // Preview only
            },
          });
        });
      }

      // Upsert all points at once
      if (points.length > 0) {
        await qdrant.upsert(points);
        console.log(
          `[Embedder] Upserted ${points.length} vectors (${profile.skills.length} skills, ${profile.experience.length} exp, ${chunkTexts.length} chunks)`
        );
      }

      return points.length;
    } catch (error) {
      throw new Error(
        `Failed to embed profile 3-tier: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  /**
   * Chunk text into overlapping segments
   */
  private chunkText(text: string, chunkSize: number, overlap: number = 100): string[] {
    const chunks: string[] = [];
    let start = 0;

    while (start < text.length) {
      const end = Math.min(start + chunkSize, text.length);
      chunks.push(text.substring(start, end));
      start += chunkSize - overlap;
    }

    return chunks;
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
