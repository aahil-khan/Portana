import { QdrantClient } from '@qdrant/js-client-rest';

export interface VectorPoint {
  id: string;
  vector: number[];
  payload: Record<string, unknown>;
}

export interface SearchResult {
  id: string;
  score: number;
  payload: Record<string, unknown>;
}

export interface QdrantHealthCheck {
  status: 'ok' | 'error';
  latency_ms: number;
  error?: string;
}

export class QdrantManager {
  private client: QdrantClient | null = null;
  private collectionName = 'portfolio_content';
  private vectorDimension = 1536;
  private initialized = false;

  async initialize(url: string = 'http://localhost:6333', apiKey?: string): Promise<void> {
    if (this.initialized) return;
    try {
      this.client = new QdrantClient({ url, apiKey });
      await this.client.getCollections();
      await this.ensureCollection();
      this.initialized = true;
      console.log('✓ Qdrant initialized');
    } catch (error) {
      console.error('Failed to initialize Qdrant:', error);
      throw error;
    }
  }

  private async ensureCollection(): Promise<void> {
    if (!this.client) throw new Error('Qdrant not initialized');
    try {
      await this.client.getCollection(this.collectionName);
    } catch {
      await this.client.recreateCollection(this.collectionName, {
        vectors: {
          size: this.vectorDimension,
          distance: 'Cosine',
        },
        payload_schema: {
          project_id: { type: 'keyword' },
          source: { type: 'keyword' },
          chunk_index: { type: 'integer' },
        },
      });
      console.log(`✓ Created collection: ${this.collectionName}`);
    }
  }

  async upsert(points: VectorPoint[]): Promise<void> {
    if (!this.client) throw new Error('Qdrant not initialized');
    const qdrantPoints = points.map((p) => ({
      id: this.hashStringToId(p.id),
      vector: p.vector,
      payload: p.payload,
    }));
    await this.client.upsert(this.collectionName, { points: qdrantPoints });
    console.log(`✓ Upserted ${points.length} vectors`);
  }

  async search(queryVector: number[], limit: number = 10, scoreThreshold?: number): Promise<SearchResult[]> {
    if (!this.client) throw new Error('Qdrant not initialized');
    const response = await this.client.search(this.collectionName, {
      vector: queryVector,
      limit,
      score_threshold: scoreThreshold,
      with_payload: true,
    });
    return response.map((r: any) => ({
      id: String(r.id),
      score: r.score,
      payload: r.payload as Record<string, unknown>,
    }));
  }

  async searchWithFilter(queryVector: number[], filter: Record<string, unknown>, limit: number = 10): Promise<SearchResult[]> {
    if (!this.client) throw new Error('Qdrant not initialized');
    const response = await this.client.search(this.collectionName, {
      vector: queryVector,
      limit,
      filter: filter as any,
      with_payload: true,
    });
    return response.map((r: any) => ({
      id: String(r.id),
      score: r.score,
      payload: r.payload as Record<string, unknown>,
    }));
  }

  async deleteByProjectId(projectId: string): Promise<void> {
    if (!this.client) throw new Error('Qdrant not initialized');
    await this.client.delete(this.collectionName, {
      filter: {
        must: [{ key: 'project_id', match: { value: projectId } }],
      },
    });
    console.log(`✓ Deleted vectors for project: ${projectId}`);
  }

  async getStats(): Promise<{ points_count: number; vectors_count: number }> {
    if (!this.client) throw new Error('Qdrant not initialized');
    const collection = await this.client.getCollection(this.collectionName);
    return {
      points_count: collection.points_count || 0,
      vectors_count: collection.vectors_count || 0,
    };
  }

  async healthCheck(): Promise<QdrantHealthCheck> {
    if (!this.client) {
      return { status: 'error', latency_ms: 0, error: 'Qdrant not initialized' };
    }
    const startTime = Date.now();
    try {
      await this.client.getCollections();
      return { status: 'ok', latency_ms: Date.now() - startTime };
    } catch (error) {
      return {
        status: 'error',
        latency_ms: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async clear(): Promise<void> {
    if (!this.client) throw new Error('Qdrant not initialized');
    await this.client.deleteCollection(this.collectionName);
    await this.ensureCollection();
    console.log('✓ Cleared collection');
  }

  async close(): Promise<void> {
    this.client = null;
    this.initialized = false;
    console.log('✓ Qdrant connection closed');
  }

  private hashStringToId(str: string): string {
    return str;
  }
}

let qdrantManager: QdrantManager | null = null;

export function getQdrant(): QdrantManager {
  if (!qdrantManager) qdrantManager = new QdrantManager();
  return qdrantManager;
}

export async function initializeQdrant(url?: string, apiKey?: string): Promise<QdrantManager> {
  const qdrant = getQdrant();
  await qdrant.initialize(url, apiKey);
  return qdrant;
}
