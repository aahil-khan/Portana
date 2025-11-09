import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import {
  WebhookVerifierService,
  WebhookQueueService,
  WebhookProcessorService,
} from '../src/webhooks/services/index.js';

describe('Webhook Services', () => {
  describe('WebhookVerifierService', () => {
    let verifier: WebhookVerifierService;

    beforeEach(() => {
      verifier = WebhookVerifierService.getInstance();
    });

    describe('HMAC Signature Verification', () => {
      it('should verify valid HMAC-SHA256 signature', () => {
        const payload = JSON.stringify({ test: 'data' });
        const secret = 'test-secret';
        const signature = verifier.createSignature(payload, secret);

        const result = verifier.verifyHMACSignature(payload, signature, secret);
        expect(result).toBe(true);
      });

      it('should reject invalid HMAC signature', () => {
        const payload = JSON.stringify({ test: 'data' });
        const secret = 'test-secret';
        const wrongSignature = 'sha256=invalid';

        const result = verifier.verifyHMACSignature(payload, wrongSignature, secret);
        expect(result).toBe(false);
      });

      it('should reject signature with wrong algorithm', () => {
        const payload = JSON.stringify({ test: 'data' });
        const secret = 'test-secret';
        const signature = verifier.createSignature(payload, secret);

        const result = verifier.verifyHMACSignature(payload, `sha512=${signature}`, secret);
        expect(result).toBe(false);
      });

      it('should reject malformed signature header', () => {
        const payload = JSON.stringify({ test: 'data' });
        const secret = 'test-secret';

        const result = verifier.verifyHMACSignature(payload, 'invalid-format', secret);
        expect(result).toBe(false);
      });
    });

    describe('Bearer Token Verification', () => {
      it('should verify valid bearer token', () => {
        const token = 'test-token-12345';
        const authHeader = `Bearer ${token}`;

        const result = verifier.verifyBearerToken(authHeader, token);
        expect(result).toBe(true);
      });

      it('should reject invalid bearer token', () => {
        const token = 'test-token-12345';
        const wrongToken = 'wrong-token';
        const authHeader = `Bearer ${wrongToken}`;

        const result = verifier.verifyBearerToken(authHeader, token);
        expect(result).toBe(false);
      });

      it('should reject missing authorization header', () => {
        const token = 'test-token';

        const result = verifier.verifyBearerToken(undefined, token);
        expect(result).toBe(false);
      });
    });

    describe('Signature Generation', () => {
      it('should generate consistent signatures', () => {
        const payload = JSON.stringify({ test: 'data' });
        const secret = 'test-secret';

        const sig1 = verifier.createSignature(payload, secret);
        const sig2 = verifier.createSignature(payload, secret);

        expect(sig1).toBe(sig2);
      });

      it('should generate different signatures for different payloads', () => {
        const secret = 'test-secret';
        const sig1 = verifier.createSignature(JSON.stringify({ test: 'data1' }), secret);
        const sig2 = verifier.createSignature(JSON.stringify({ test: 'data2' }), secret);

        expect(sig1).not.toBe(sig2);
      });
    });

    describe('Secret Generation', () => {
      it('should generate random secrets', () => {
        const secret1 = verifier.generateSecret();
        const secret2 = verifier.generateSecret();

        expect(secret1).not.toBe(secret2);
        expect(secret1.length).toBe(64);
        expect(secret2.length).toBe(64);
      });
    });
  });

  describe('WebhookProcessorService', () => {
    let processor: WebhookProcessorService;

    beforeEach(() => {
      processor = WebhookProcessorService.getInstance();
    });

    describe('GitHub Push Event Processing', () => {
      it('should process valid GitHub push event', () => {
        const event = {
          repository: {
            name: 'test-repo',
            full_name: 'user/test-repo',
            html_url: 'https://github.com/user/test-repo',
            description: 'Test repository',
            stargazers_count: 42,
            language: 'TypeScript',
          },
          ref: 'refs/heads/main',
        };

        const result = processor.processGitHubPush(event);

        expect(result!.name).toBe('test-repo');
        expect(result!.sourceType).toBe('github');
        expect(result!.url).toBe('https://github.com/user/test-repo');
        expect(result!.tags).toContain('github');
      });

      it('should extract branch name from ref', () => {
        const event = {
          repository: {
            name: 'repo',
            full_name: 'user/repo',
            html_url: 'https://github.com/user/repo',
            stargazers_count: 0,
          },
          ref: 'refs/heads/feature/new-feature',
        };

        const result = processor.processGitHubPush(event);

        expect(result!.tags).toContain('feature/new-feature');
      });

      it('should validate GitHub push event format', () => {
        const validEvent = {
          repository: {
            name: 'repo',
            html_url: 'https://github.com/user/repo',
          },
          ref: 'refs/heads/main',
        };

        expect(processor.validateGitHubPush(validEvent)).toBe(true);
        expect(processor.validateGitHubPush(null as any)).toBe(false);
      });
    });

    describe('Medium Article Processing', () => {
      it('should process valid Medium article', () => {
        const article = {
          title: 'Understanding Webhooks',
          description: 'A comprehensive guide to webhooks',
          link: 'https://medium.com/article-id',
          author: 'John Doe',
          categories: ['Technology', 'Web Development'],
        };

        const result = processor.processMediumArticle(article);

        expect(result!.name).toBe('Understanding Webhooks');
        expect(result!.sourceType).toBe('medium');
        expect(result!.tags).toContain('medium');
        expect(result!.tags).toContain('article');
        // Categories are lowercased: ['technology', 'web development']
        expect(result!.tags.some(tag => tag.includes('technology') || tag.includes('web'))).toBe(true);
      });

      it('should truncate long article titles', () => {
        const longTitle = 'A'.repeat(100);
        const article = {
          title: longTitle,
          link: 'https://medium.com/article',
        };

        const result = processor.processMediumArticle(article);

        expect(result!.name.length).toBeLessThanOrEqual(50);
      });

      it('should validate Medium article format', () => {
        const validArticle = {
          title: 'Article Title',
          link: 'https://medium.com/article',
        };

        expect(processor.validateMediumArticle(validArticle)).toBe(true);
        expect(processor.validateMediumArticle({ title: '', link: 'url' })).toBe(false);
      });
    });

    describe('String Similarity (Deduplication)', () => {
      it('should detect identical strings as 100% similar', () => {
        const similarity = processor.checkSimilarity('test project', 'test project');
        expect(typeof similarity).toBe('number');
        expect(similarity).toBe(100);
      });

      it('should detect substring as high similarity', () => {
        const similarity = processor.checkSimilarity('test project repo', 'test project');
        expect(similarity).toBeGreaterThanOrEqual(90);
      });

      it('should detect dissimilar strings', () => {
        const similarity = processor.checkSimilarity('completely different', 'totally unrelated');
        expect(similarity).toBeLessThan(50);
      });
    });
  });

  describe('WebhookQueueService', () => {
    let queue: WebhookQueueService;
    let processedItems: unknown[] = [];

    beforeEach(() => {
      queue = WebhookQueueService.getInstance();
      queue.clear();
      processedItems = [];

      queue.setMaxRetries(3);
      queue.setProcessor(async (payload: Record<string, unknown>) => {
        processedItems.push(payload);
      });
    });

    afterEach(() => {
      queue.stopProcessing();
      queue.clear();
    });

    describe('Queue Management', () => {
      it('should add item to queue', () => {
        const payload = { test: 'data' };
        const itemId = queue.addToQueue(payload);

        expect(itemId).toBeDefined();
        expect(queue.getStats().queueSize).toBe(1);
      });

      it('should generate unique IDs', () => {
        const id1 = queue.addToQueue({ data: 1 });
        const id2 = queue.addToQueue({ data: 2 });

        expect(id1).not.toBe(id2);
      });

      it('should process item immediately on first attempt', async () => {
        queue.addToQueue({ test: 'data' });
        await queue.processQueue();

        expect(processedItems.length).toBe(1);
        expect(queue.getStats().queueSize).toBe(0);
      });

      it('should remove successfully processed items', async () => {
        queue.addToQueue({ test: 'data' });
        expect(queue.getStats().queueSize).toBe(1);

        await queue.processQueue();
        expect(queue.getStats().queueSize).toBe(0);
      });
    });

    describe('Exponential Backoff Retry', () => {
      it('should move items to DLQ after max retries', async () => {
        queue.setMaxRetries(1);
        queue.setProcessor(async () => {
          throw new Error('Always fails');
        });

        queue.addToQueue({ test: 'data' });

        // Trigger retries until DLQ
        for (let i = 0; i < 3; i++) {
          await queue.processQueue();
          await new Promise((resolve) => setTimeout(resolve, 100));
        }

        expect(queue.getStats().queueSize).toBe(0);
        expect(queue.getStats().dlqSize).toBe(1);
      });
    });

    describe('Dead Letter Queue', () => {
      it('should list dead letter queue items', async () => {
        queue.setMaxRetries(1);
        queue.setProcessor(async () => {
          throw new Error('Fail');
        });

        queue.addToQueue({ test: 'data' });

        // Trigger retries until DLQ
        for (let i = 0; i < 3; i++) {
          await queue.processQueue();
          await new Promise((resolve) => setTimeout(resolve, 100));
        }

        const dlqItems = queue.getDeadLetterQueue();
        expect(dlqItems.length).toBe(1);
        expect(dlqItems[0].finalError).toContain('Fail');
      });

      it('should manually retry DLQ items', async () => {
        let attemptCount = 0;

        queue.setMaxRetries(1);
        queue.setProcessor(async () => {
          attemptCount++;
          if (attemptCount < 2) {
            throw new Error('Fail');
          }
        });

        const itemId = queue.addToQueue({ test: 'data' });

        // Move to DLQ
        await queue.processQueue();
        await new Promise((resolve) => setTimeout(resolve, 100));
        await queue.processQueue();

        expect(queue.getStats().dlqSize).toBe(1);

        // Manually retry
        const success = await queue.retryFromDLQ(itemId);
        expect(success).toBe(true);
        expect(queue.getStats().dlqSize).toBe(0);
      });
    });

    describe('Background Processing', () => {
      it('should have background processing disabled by default', () => {
        expect(queue.getStats().isProcessing).toBe(false);
      });

      it('should start and stop background processing', () => {
        queue.startProcessing(1000);
        expect(queue.getStats().isProcessing).toBe(true);

        queue.stopProcessing();
        expect(queue.getStats().isProcessing).toBe(false);
      });
    });

    describe('Queue Statistics', () => {
      it('should provide queue statistics', () => {
        queue.addToQueue({ test: 'data1' });
        queue.addToQueue({ test: 'data2' });

        const stats = queue.getStats();

        expect(stats.queueSize).toBe(2);
        expect(stats.dlqSize).toBe(0);
      });
    });
  });
});
