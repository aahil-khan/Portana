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
    html_url?: string;
    url?: string;
    topics?: string[];
    stargazers_count?: number;
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

    const branch = event.ref?.split('refs/heads/').pop() || 'main';
    const tags: string[] = ['github'];
    if (repo.language) {
      tags.push(repo.language.toLowerCase());
    }
    if (branch && branch !== 'main') {
      tags.push(branch);
    }
    if (repo.topics && Array.isArray(repo.topics)) {
      tags.push(...repo.topics.map((t: string) => t.toLowerCase()));
    }

    return {
      name: repo.name,
      description: repo.description || `Repository: ${repo.name}`,
      url: repo.html_url || repo.url,
      tags: [...new Set(tags)],
      sourceType: 'github',
      metadata: {
        branch,
        pusher: event.pusher?.name,
        stars: repo.stargazers_count,
      },
    };
  }

  processMediumArticle(article: MediumArticle): ProcessedWebhook | null {
    if (!this.validateMediumArticle(article)) {
      return null;
    }

    const title = article.title || 'Untitled';
    const truncatedTitle = title.length > 50 ? title.substring(0, 47) + '...' : title;

    const tags: string[] = ['medium', 'article'];
    if (article.categories && Array.isArray(article.categories)) {
      tags.push(...article.categories.map((c: string) => c.toLowerCase()));
    }

    return {
      name: truncatedTitle,
      url: article.link,
      tags: [...new Set(tags)],
      sourceType: 'medium',
      metadata: {
        fullTitle: title,
        author: article.author,
        publishedAt: article.pubDate,
      },
    };
  }

  /**
   * Check if a project with similar name already exists
   * Uses string similarity check with Levenshtein distance (90% threshold)
   * Returns the similarity percentage (0-100)
   */
  checkSimilarity(title1: string, title2: string): number {
    const str1 = title1.toLowerCase();
    const str2 = title2.toLowerCase();

    // Quick checks
    if (str1 === str2) return 100;
    if (str1.includes(str2) || str2.includes(str1)) return 90;

    // Calculate character-level similarity using Levenshtein distance
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;

    if (longer.length === 0) return 100;

    const editDistance = this.levenshteinDistance(longer, shorter);
    const similarity = ((longer.length - editDistance) / longer.length) * 100;

    return Math.round(similarity);
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
