export interface ProcessedWebhook {
  name: string;
  description?: string;
  url?: string;
  tags: string[];
  sourceType: 'github' | 'medium' | 'custom';
  metadata?: Record<string, unknown>;
}

export interface GitHubPushEvent {
  repository?: {
    name: string;
    description?: string;
    language?: string;
    url?: string;
    topics?: string[];
  };
  pusher?: { name: string };
  ref?: string;
}

export interface MediumArticle {
  title?: string;
  link?: string;
  author?: string;
  categories?: string[];
  pubDate?: string;
}

export class WebhookProcessorService {
  private static instance: WebhookProcessorService;
  private similarityThreshold = 0.9;

  private constructor() {}

  static getInstance(): WebhookProcessorService {
    if (!WebhookProcessorService.instance) {
      WebhookProcessorService.instance = new WebhookProcessorService();
    }
    return WebhookProcessorService.instance;
  }

  processGitHubPush(event: GitHubPushEvent): ProcessedWebhook | null {
    if (!this.validateGitHubPush(event)) {
      return null;
    }

    const repo = event.repository;
    if (!repo) return null;

    const tags: string[] = [];
    if (repo.language) {
      tags.push(repo.language.toLowerCase());
    }
    if (repo.topics && Array.isArray(repo.topics)) {
      tags.push(...repo.topics.map((t: string) => t.toLowerCase()));
    }

    return {
      name: repo.name,
      description: repo.description,
      url: repo.url,
      tags,
      sourceType: 'github',
      metadata: {
        branch: event.ref?.split('/').pop(),
        pusher: event.pusher?.name,
      },
    };
  }

  processMediumArticle(article: MediumArticle): ProcessedWebhook | null {
    if (!this.validateMediumArticle(article)) {
      return null;
    }

    const title = article.title || 'Untitled';
    const truncatedTitle = title.length > 50 ? title.substring(0, 47) + '...' : title;

    const tags: string[] = [];
    if (article.categories && Array.isArray(article.categories)) {
      tags.push(...article.categories.map((c: string) => c.toLowerCase()));
    }

    return {
      name: truncatedTitle,
      url: article.link,
      tags,
      sourceType: 'medium',
      metadata: {
        fullTitle: title,
        author: article.author,
        publishedAt: article.pubDate,
      },
    };
  }

  checkSimilarity(title1: string, title2: string): boolean {
    const distance = this.levenshteinDistance(title1.toLowerCase(), title2.toLowerCase());
    const maxLength = Math.max(title1.length, title2.length);
    const similarity = (maxLength - distance) / maxLength;
    return similarity >= this.similarityThreshold;
  }

  private levenshteinDistance(a: string, b: string): number {
    const matrix: number[][] = [];

    for (let i = 0; i <= b.length; i++) {
      matrix[i] = [i];
    }

    for (let j = 0; j <= a.length; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= b.length; i++) {
      for (let j = 1; j <= a.length; j++) {
        if (b.charAt(i - 1) === a.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }

    return matrix[b.length][a.length];
  }

  validateGitHubPush(event: GitHubPushEvent): event is GitHubPushEvent {
    return !!(event && event.repository && event.repository.name);
  }

  validateMediumArticle(article: MediumArticle): article is MediumArticle {
    return !!(article && article.title && article.link);
  }

  normalizeToProjectInput(webhook: ProcessedWebhook) {
    return {
      name: webhook.name,
      description: webhook.description || '',
      url: webhook.url || '',
      tags: webhook.tags,
      metadata: webhook.metadata,
      source: webhook.sourceType,
    };
  }
}

export default WebhookProcessorService.getInstance();
