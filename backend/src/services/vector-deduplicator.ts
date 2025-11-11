import { createHash } from 'crypto';
import { getQdrant } from '../vector/index.js';

/**
 * Vector Deduplicator Service
 * Prevents duplicate vectors from being stored when content is re-uploaded or unchanged
 */
export interface DedupeEntry {
  contentHash: string;
  projectId: string;
  vectorIds: string[];
  createdAt: Date;
}

export class VectorDeduplicator {
  private dedupeMap = new Map<string, DedupeEntry>();

  /**
   * Generate hash of content for deduplication tracking
   */
  private generateHash(content: string): string {
    return createHash('sha256').update(content).digest('hex');
  }

  /**
   * Check if content has already been embedded
   */
  async isDuplicate(projectId: string, content: string): Promise<boolean> {
    const hash = this.generateHash(content);
    const key = `${projectId}:${hash}`;

    if (this.dedupeMap.has(key)) {
      console.log(`[Dedup] Content already embedded for ${projectId}`);
      return true;
    }

    return false;
  }

  /**
   * Register embedded content
   */
  registerEmbedded(projectId: string, content: string, vectorIds: string[]): void {
    const hash = this.generateHash(content);
    const key = `${projectId}:${hash}`;

    this.dedupeMap.set(key, {
      contentHash: hash,
      projectId,
      vectorIds,
      createdAt: new Date(),
    });

    console.log(
      `[Dedup] Registered ${vectorIds.length} vectors for ${projectId} (hash: ${hash.substring(0, 8)}...)`
    );
  }

  /**
   * Clear old dedup entries (for memory management)
   * Entries older than maxAge are removed
   */
  cleanupOldEntries(maxAgeMs: number = 24 * 60 * 60 * 1000): number {
    const now = Date.now();
    let removed = 0;

    for (const [key, entry] of this.dedupeMap.entries()) {
      if (now - entry.createdAt.getTime() > maxAgeMs) {
        this.dedupeMap.delete(key);
        removed++;
      }
    }

    if (removed > 0) {
      console.log(`[Dedup] Cleaned up ${removed} old entries`);
    }

    return removed;
  }

  /**
   * Get dedup statistics
   */
  getStats(): { totalEntries: number; totalVectors: number; projectsTracked: Set<string> } {
    let totalVectors = 0;
    const projectsTracked = new Set<string>();

    for (const entry of this.dedupeMap.values()) {
      totalVectors += entry.vectorIds.length;
      projectsTracked.add(entry.projectId);
    }

    return {
      totalEntries: this.dedupeMap.size,
      totalVectors,
      projectsTracked,
    };
  }

  /**
   * Clear all dedup entries for a project
   */
  async clearProject(projectId: string): Promise<number> {
    let removed = 0;

    for (const [key] of this.dedupeMap.entries()) {
      if (key.startsWith(`${projectId}:`)) {
        this.dedupeMap.delete(key);
        removed++;
      }
    }

    // Also delete vectors from Qdrant
    const qdrant = getQdrant();
    try {
      await qdrant.deleteByProjectId(projectId);
    } catch (error) {
      console.warn(`Failed to delete vectors for project ${projectId}:`, error);
    }

    console.log(`[Dedup] Cleared ${removed} entries for project ${projectId}`);
    return removed;
  }

  /**
   * Clear all dedup tracking
   */
  clearAll(): void {
    this.dedupeMap.clear();
    console.log('[Dedup] Cleared all dedup entries');
  }
}

let deduplicatorInstance: VectorDeduplicator | null = null;

export function getVectorDeduplicator(): VectorDeduplicator {
  if (!deduplicatorInstance) {
    deduplicatorInstance = new VectorDeduplicator();
  }
  return deduplicatorInstance;
}
