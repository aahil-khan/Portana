import axios, { AxiosError } from 'axios';
import { getEmbedder } from './embedder.js';
import { getQdrant } from '../vector/index.js';
import type { VectorPoint } from '../vector/index.js';
import { createLogger } from '../utils/logger.js';
import crypto from 'crypto';

const logger = createLogger('MediumIngestor');

export interface MediumArticle {
  id: string;
  title: string;
  url: string;
  author: string;
  description: string;
  content: string;
  publishedAt: Date;
  tags: string[];
  claps: number;
}

export interface ChunkedArticle {
  id: string;
  text: string;
  articleId: string;
  articleTitle: string;
  articleUrl: string;
  source: string;
  section: string;
  chunkIndex: number;
  publishedAt: Date;
  tags: string[];
  metadata?: Record<string, unknown>;
}

const CHUNK_SIZE = 500; // Characters per chunk
const CHUNK_OVERLAP = 50; // Overlap between chunks

export class MediumIngestor {
  private mediumUsername: string;

  constructor(mediumUsername: string = process.env.MEDIUM_USERNAME || '') {
    this.mediumUsername = mediumUsername;
    if (!this.mediumUsername) {
      logger.warn('MEDIUM_USERNAME not set - Medium ingestion may not work properly');
    }
  }

  /**
   * Fetch articles from Medium RSS feed
   * Medium RSS endpoint: https://medium.com/feed/@{username}
   */
  async fetchArticles(username?: string): Promise<MediumArticle[]> {
    try {
      const user = username || this.mediumUsername;
      if (!user) {
        throw new Error('No Medium username provided');
      }

      const feedUrl = `https://medium.com/feed/@${user}`;
      logger.info(`Fetching Medium articles from ${feedUrl}`);

      const response = await axios.get(feedUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; MediumIngestor/1.0)',
        },
        timeout: 15000,
      });

      // Parse RSS feed (basic XML parsing)
      const articles = this.parseRSSFeed(response.data);
      logger.info(`Fetched ${articles.length} articles from Medium`);

      return articles;
    } catch (err) {
      const error = err as AxiosError;
      const message = error?.message || String(err);
      throw new Error(`Failed to fetch Medium articles: ${message}`);
    }
  }

  /**
   * Parse RSS feed XML to extract articles
   */
  private parseRSSFeed(xmlData: string): MediumArticle[] {
    const articles: MediumArticle[] = [];

    try {
      // Extract items from RSS feed
      const itemRegex = /<item>([\s\S]*?)<\/item>/g;
      const matches = xmlData.matchAll(itemRegex);

      for (const match of matches) {
        const itemXml = match[1];
        const article = this.parseRSSItem(itemXml);
        if (article) {
          articles.push(article);
        }
      }
    } catch (err) {
      logger.error(`Failed to parse RSS feed: ${err}`);
    }

    return articles;
  }

  /**
   * Parse individual RSS item
   */
  private parseRSSItem(itemXml: string): MediumArticle | null {
    try {
      const title = this.extractText(itemXml, /<title><!\[CDATA\[([\s\S]*?)\]\]><\/title>/) ||
                   this.extractText(itemXml, /<title>(.*?)<\/title>/);
      const link = this.extractText(itemXml, /<link>(.*?)<\/link>/);
      const description = this.extractText(itemXml, /<description><!\[CDATA\[([\s\S]*?)\]\]><\/description>/) ||
                         this.extractText(itemXml, /<description>(.*?)<\/description>/);
      const pubDate = this.extractText(itemXml, /<pubDate>(.*?)<\/pubDate>/);
      const category = this.extractText(itemXml, /<category>(.*?)<\/category>/);

      if (!title || !link) {
        return null;
      }

      // Clean HTML from content
      const cleanContent = this.cleanHtml(description || '');

      return {
        id: crypto.createHash('md5').update(link).digest('hex'),
        title: this.decodeHtml(title),
        url: link,
        author: this.mediumUsername,
        description: cleanContent.substring(0, 200),
        content: cleanContent,
        publishedAt: new Date(pubDate || Date.now()),
        tags: category ? [this.decodeHtml(category)] : [],
        claps: 0, // Medium RSS doesn't provide claps
      };
    } catch (err) {
      logger.error(`Failed to parse RSS item: ${err}`);
      return null;
    }
  }

  /**
   * Extract text using regex
   */
  private extractText(xml: string, regex: RegExp): string | null {
    const match = xml.match(regex);
    return match ? match[1].trim() : null;
  }

  /**
   * Clean HTML tags from content
   */
  private cleanHtml(html: string): string {
    return html
      .replace(/<[^>]*>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\n\n+/g, '\n\n')
      .trim();
  }

  /**
   * Decode HTML entities
   */
  private decodeHtml(html: string): string {
    return html
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&nbsp;/g, ' ');
  }

  /**
   * Split article content into chunks
   */
  private chunkArticle(article: MediumArticle): ChunkedArticle[] {
    const chunks: ChunkedArticle[] = [];
    const text = `${article.title}\n\n${article.content}`;
    const textChunks = this.chunkText(text);

    textChunks.forEach((chunk, idx) => {
      chunks.push({
        id: `${article.id}-chunk-${idx}`,
        text: chunk,
        articleId: article.id,
        articleTitle: article.title,
        articleUrl: article.url,
        source: 'medium',
        section: 'content',
        chunkIndex: idx,
        publishedAt: article.publishedAt,
        tags: article.tags,
        metadata: {
          author: article.author,
          claps: article.claps,
        },
      });
    });

    return chunks;
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
   * Ingest Medium articles into vector store
   */
  async ingest(username?: string): Promise<{ totalChunks: number; articlesCount: number }> {
    try {
      logger.info('Starting Medium article ingestion...');

      // Fetch articles from Medium
      const articles = await this.fetchArticles(username);

      if (articles.length === 0) {
        logger.warn('No articles found from Medium');
        return { totalChunks: 0, articlesCount: 0 };
      }

      // Get embedder and vector store
      const embedder = getEmbedder();
      const qdrant = getQdrant();

      let totalChunks = 0;

      // Process each article
      for (const article of articles) {
        const chunkedArticles = this.chunkArticle(article);

        // Embed and store each chunk
        for (const chunk of chunkedArticles) {
          try {
            const embedding = await embedder.embedText(chunk.text);

            const vectorPoints: VectorPoint[] = [{
              id: crypto.createHash('md5').update(chunk.id).digest('hex').substring(0, 16),
              vector: embedding,
              payload: {
                text: chunk.text,
                articleId: chunk.articleId,
                articleTitle: chunk.articleTitle,
                articleUrl: chunk.articleUrl,
                source: 'medium',
                section: chunk.section,
                chunkIndex: chunk.chunkIndex,
                publishedAt: chunk.publishedAt.toISOString(),
                tags: chunk.tags,
                author: chunk.metadata?.author,
                claps: chunk.metadata?.claps,
              },
            }];

            await qdrant.upsert(vectorPoints);
            totalChunks++;
          } catch (err) {
            logger.error(`Failed to embed chunk ${chunk.id}: ${err}`);
          }
        }
      }

      logger.info('Medium article ingestion complete', {
        articlesCount: articles.length,
        totalChunks,
      });

      return {
        totalChunks,
        articlesCount: articles.length,
      };
    } catch (err) {
      logger.error(`Medium ingestion failed: ${err}`);
      throw err;
    }
  }

  /**
   * Get all ingested articles metadata (for blog command)
   */
  async getArticles(username?: string): Promise<Array<{
    title: string;
    url: string;
    publishedAt: Date;
    description: string;
    tags: string[];
  }>> {
    try {
      const articles = await this.fetchArticles(username);
      return articles.map((article) => ({
        title: article.title,
        url: article.url,
        publishedAt: article.publishedAt,
        description: article.description,
        tags: article.tags,
      }));
    } catch (err) {
      logger.error(`Failed to get articles: ${err}`);
      return [];
    }
  }
}

let mediumIngestorInstance: MediumIngestor | null = null;

export function getMediumIngestor(): MediumIngestor {
  if (!mediumIngestorInstance) {
    const username = process.env.MEDIUM_USERNAME || '';
    mediumIngestorInstance = new MediumIngestor(username);
  }
  return mediumIngestorInstance;
}
