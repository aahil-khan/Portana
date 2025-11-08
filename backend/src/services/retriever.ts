import { getQdrant } from '../vector';

export interface RetrievalResult {
  id: string;
  score: number;
  text: string;
  projectId: string;
  source: string;
  chunkIndex: number;
  metadata?: Record<string, unknown>;
}

export interface RetrievalFilter {
  projectId?: string;
  source?: string;
}

export interface RerankingConfig {
  threshold?: number;
  topK?: number;
  diversity?: boolean;
}

export class RetrieverService {
  private defaultTopK = 10;
  private scoreThreshold = 0.5;

  async retrieveByVector(
    queryVector: number[],
    topK: number = this.defaultTopK,
    filter?: RetrievalFilter
  ): Promise<RetrievalResult[]> {
    try {
      const qdrant = getQdrant();

      let qdrantFilter: any = undefined;

      if (filter) {
        const must: any[] = [];
        if (filter.projectId) {
          must.push({
            key: 'projectId',
            match: { value: filter.projectId },
          });
        }
        if (filter.source) {
          must.push({
            key: 'source',
            match: { value: filter.source },
          });
        }
        if (must.length > 0) {
          qdrantFilter = { must };
        }
      }

      const searchResults = qdrantFilter
        ? await qdrant.searchWithFilter(queryVector, qdrantFilter, topK)
        : await qdrant.search(queryVector, topK);

      return searchResults
        .filter((r) => r.score >= this.scoreThreshold)
        .map((r) => ({
          id: r.id,
          score: r.score,
          text: (r.payload.text as string) || '',
          projectId: (r.payload.projectId as string) || '',
          source: (r.payload.source as string) || '',
          chunkIndex: (r.payload.chunkIndex as number) || 0,
          metadata: r.payload.metadata as Record<string, unknown>,
        }));
    } catch (error) {
      throw new Error(
        `Failed to retrieve: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  async rerankResults(
    results: RetrievalResult[],
    config: RerankingConfig = {}
  ): Promise<RetrievalResult[]> {
    const { threshold = this.scoreThreshold, topK = this.defaultTopK, diversity = false } = config;

    let reranked = results.filter((r) => r.score >= threshold);

    if (diversity) {
      reranked = this.diversifyResults(reranked);
    }

    return reranked.slice(0, topK);
  }

  private diversifyResults(results: RetrievalResult[]): RetrievalResult[] {
    const diversified: RetrievalResult[] = [];
    const seenProjectIds = new Set<string>();

    for (const result of results) {
      if (!seenProjectIds.has(result.projectId) || diversified.length < 3) {
        diversified.push(result);
        seenProjectIds.add(result.projectId);
      }
    }

    return diversified;
  }

  async buildContext(
    results: RetrievalResult[],
    maxLength: number = 4000
  ): Promise<string> {
    let context = '';

    for (const result of results) {
      const entry = `[${result.source}] (project: ${result.projectId}) ${result.text}`;

      if ((context + entry).length > maxLength) {
        break;
      }

      context += `${entry}

`;
    }

    return context.trim();
  }

  async getStats(): Promise<{
    defaultTopK: number;
    scoreThreshold: number;
  }> {
    return {
      defaultTopK: this.defaultTopK,
      scoreThreshold: this.scoreThreshold,
    };
  }
}

let retrieverInstance: RetrieverService | null = null;

export function getRetriever(): RetrieverService {
  if (!retrieverInstance) {
    retrieverInstance = new RetrieverService();
  }
  return retrieverInstance;
}
