import crypto from 'crypto';

export interface DeduplicationResult {
  isDuplicate: boolean;
  similarity: number;
  duplicateId?: string;
}

export interface ContentFingerprint {
  id: string;
  hash: string;
  text: string;
  projectId: string;
  source: string;
  timestamp: number;
}

export class DeduplicatorService {
  private fingerprints = new Map<string, ContentFingerprint>();
  private similarityThreshold = 0.70;

  addContent(id: string, text: string, projectId: string, source: string): ContentFingerprint {
    const hash = this.generateHash(text);

    const fingerprint: ContentFingerprint = {
      id,
      hash,
      text,
      projectId,
      source,
      timestamp: Date.now(),
    };

    this.fingerprints.set(id, fingerprint);
    return fingerprint;
  }

  checkDuplicate(text: string, projectId: string): DeduplicationResult {
    const hash = this.generateHash(text);

    for (const [id, fp] of this.fingerprints.entries()) {
      if (fp.hash === hash && fp.projectId === projectId) {
        return {
          isDuplicate: true,
          similarity: 1.0,
          duplicateId: id,
        };
      }

      const similarity = this.calculateSimilarity(text, fp.text);
      if (similarity >= this.similarityThreshold && fp.projectId === projectId) {
        return {
          isDuplicate: true,
          similarity,
          duplicateId: id,
        };
      }
    }

    return {
      isDuplicate: false,
      similarity: 0,
    };
  }

  private generateHash(text: string): string {
    const normalized = text.toLowerCase().trim().replace(/\s+/g, ' ');
    return crypto.createHash('sha256').update(normalized).digest('hex');
  }

  private calculateSimilarity(text1: string, text2: string): number {
    const len1 = text1.length;
    const len2 = text2.length;

    if (len1 === 0 && len2 === 0) return 1.0;
    if (len1 === 0 || len2 === 0) return 0;

    const matrix: number[][] = Array(len2 + 1)
      .fill(null)
      .map(() => Array(len1 + 1).fill(0));

    for (let i = 0; i <= len1; i++) matrix[0][i] = i;
    for (let j = 0; j <= len2; j++) matrix[j][0] = j;

    for (let j = 1; j <= len2; j++) {
      for (let i = 1; i <= len1; i++) {
        const cost = text1[i - 1] === text2[j - 1] ? 0 : 1;
        matrix[j][i] = Math.min(
          matrix[j][i - 1] + 1,
          matrix[j - 1][i] + 1,
          matrix[j - 1][i - 1] + cost
        );
      }
    }

    const distance = matrix[len2][len1];
    const maxLen = Math.max(len1, len2);

    return 1 - distance / maxLen;
  }

  removeDuplicate(id: string): boolean {
    return this.fingerprints.delete(id);
  }

  getContentCount(): number {
    return this.fingerprints.size;
  }

  getContentForProject(projectId: string): ContentFingerprint[] {
    return Array.from(this.fingerprints.values()).filter((fp) => fp.projectId === projectId);
  }

  setSimilarityThreshold(threshold: number): void {
    if (threshold < 0 || threshold > 1) {
      throw new Error('Threshold must be between 0 and 1');
    }
    this.similarityThreshold = threshold;
  }

  getSimilarityThreshold(): number {
    return this.similarityThreshold;
  }

  getStats(): {
    totalContent: number;
    threshold: number;
  } {
    return {
      totalContent: this.fingerprints.size,
      threshold: this.similarityThreshold,
    };
  }
}

let deduplicatorInstance: DeduplicatorService | null = null;

export function getDeduplicator(): DeduplicatorService {
  if (!deduplicatorInstance) {
    deduplicatorInstance = new DeduplicatorService();
  }
  return deduplicatorInstance;
}
