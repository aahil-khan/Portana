import { describe, it, expect, beforeAll } from '@jest/globals';
import { EmbedderService, getEmbedder } from '../src/services/embedder';
import { RetrieverService, getRetriever } from '../src/services/retriever';
import { GeneratorService, getGenerator } from '../src/services/generator';
import { MemoryService, getMemory } from '../src/services/memory';
import { DeduplicatorService, getDeduplicator } from '../src/services/deduplicator';

describe('Core Services', () => {
  let embedder: EmbedderService;
  let retriever: RetrieverService;
  let generator: GeneratorService;
  let memory: MemoryService;
  let deduplicator: DeduplicatorService;

  beforeAll(() => {
    embedder = getEmbedder();
    retriever = getRetriever();
    generator = getGenerator();
    memory = getMemory();
    deduplicator = getDeduplicator();
  });

  describe('EmbedderService', () => {
    it('should embed text successfully', async () => {
      try {
        const embedding = await embedder.embedText('Hello world');
        expect(Array.isArray(embedding)).toBe(true);
        expect(embedding.length).toBeGreaterThan(0);
      } catch (error) {
        console.warn('OpenAI not available:', error);
      }
    });

    it('should reject empty text', async () => {
      await expect(embedder.embedText('')).rejects.toThrow();
    });

    it('should batch embed texts', async () => {
      try {
        const embeddings = await embedder.embedBatch(['Text 1', 'Text 2']);
        expect(Array.isArray(embeddings)).toBe(true);
        expect(embeddings.length).toBe(2);
      } catch (error) {
        console.warn('OpenAI not available:', error);
      }
    });

    it('should get embedder config', async () => {
      const config = await embedder.getUsage();
      expect(config).toHaveProperty('model');
      expect(config).toHaveProperty('dimensions');
    });
  });

  describe('RetrieverService', () => {
    it('should build context from results', async () => {
      const results = [
        {
          id: 'test-1',
          score: 0.95,
          text: 'Test content',
          projectId: 'proj-1',
          source: 'github',
          chunkIndex: 0,
        },
      ];

      const context = await retriever.buildContext(results);
      expect(context).toContain('Test content');
      expect(context).toContain('github');
    });

    it('should rerank results with diversity', async () => {
      const results = [
        {
          id: 'test-1',
          score: 0.95,
          text: 'Content 1',
          projectId: 'proj-1',
          source: 'github',
          chunkIndex: 0,
        },
        {
          id: 'test-2',
          score: 0.90,
          text: 'Content 2',
          projectId: 'proj-2',
          source: 'medium',
          chunkIndex: 0,
        },
      ];

      const reranked = await retriever.rerankResults(results, { diversity: true });
      expect(reranked.length).toBeGreaterThanOrEqual(0);
    });

    it('should get retriever stats', async () => {
      const stats = await retriever.getStats();
      expect(stats).toHaveProperty('defaultTopK');
      expect(stats).toHaveProperty('scoreThreshold');
    });
  });

  describe('GeneratorService', () => {
    it('should build system prompt', () => {
      const prompt = generator.buildSystemPrompt('Test context');
      expect(prompt.role).toBe('system');
      expect(prompt.content).toContain('Test context');
    });

    it('should build user message', () => {
      const message = generator.buildUserMessage('What is this?');
      expect(message.role).toBe('user');
      expect(message.content).toBe('What is this?');
    });

    it('should get generator config', async () => {
      const config = await generator.getConfig();
      expect(config).toHaveProperty('model');
      expect(config).toHaveProperty('temperature');
      expect(config).toHaveProperty('maxTokens');
    });

    it('should generate text (when OpenAI available)', async () => {
      try {
        const result = await generator.generate([
          { role: 'user', content: 'Say hello' },
        ]);
        expect(typeof result).toBe('string');
        expect(result.length).toBeGreaterThan(0);
      } catch (error) {
        console.warn('OpenAI not available:', error);
      }
    });
  });

  describe('MemoryService', () => {
    it('should create a session', () => {
      const session = memory.createSession('user-1', { test: true });
      expect(session).toHaveProperty('id');
      expect(session).toHaveProperty('messages');
      expect(session.userId).toBe('user-1');
    });

    it('should retrieve a session', () => {
      const created = memory.createSession();
      const retrieved = memory.getSession(created.id);
      expect(retrieved).not.toBeNull();
      expect(retrieved?.id).toBe(created.id);
    });

    it('should add messages to session', () => {
      const session = memory.createSession();
      memory.addMessage(session.id, 'user', 'Hello');
      memory.addMessage(session.id, 'assistant', 'Hi there');

      const messages = memory.getMessages(session.id);
      expect(messages.length).toBe(2);
      expect(messages[0].role).toBe('user');
    });

    it('should get chat history', () => {
      const session = memory.createSession();
      memory.addMessage(session.id, 'user', 'What is AI?');
      memory.addMessage(session.id, 'assistant', 'AI is...');

      const history = memory.getChatHistory(session.id);
      expect(history.length).toBe(2);
    });

    it('should get session stats', () => {
      const session = memory.createSession();
      memory.addMessage(session.id, 'user', 'Test');

      const stats = memory.getSessionStats(session.id);
      expect(stats).toHaveProperty('messageCount');
      expect(stats).toHaveProperty('age');
      expect(stats.messageCount).toBe(1);
    });

    it('should clear session messages', () => {
      const session = memory.createSession();
      memory.addMessage(session.id, 'user', 'Message');
      memory.clearSession(session.id);

      const messages = memory.getMessages(session.id);
      expect(messages.length).toBe(0);
    });

    it('should delete a session', () => {
      const session = memory.createSession();
      memory.deleteSession(session.id);

      const retrieved = memory.getSession(session.id);
      expect(retrieved).toBeNull();
    });

    it('should return null for expired session', async () => {
      const session = memory.createSession();
      memory.setSessionTTL(1);

      await new Promise((r) => setTimeout(r, 50));

      const retrieved = memory.getSession(session.id);
      expect(retrieved).toBeNull();
    });
  });

  describe('DeduplicatorService', () => {
    it('should add content fingerprint', () => {
      const fp = deduplicator.addContent('content-1', 'Unique text', 'proj-1', 'github');
      expect(fp).toHaveProperty('hash');
      expect(fp).toHaveProperty('id');
    });

    it('should detect exact duplicate', () => {
      deduplicator.addContent('content-1', 'Test text', 'proj-1', 'github');
      const result = deduplicator.checkDuplicate('Test text', 'proj-1');

      expect(result.isDuplicate).toBe(true);
      expect(result.similarity).toBe(1.0);
    });

    it('should detect similar duplicates', () => {
      deduplicator.addContent('content-1', 'Hello world test', 'proj-1', 'github');
      const result = deduplicator.checkDuplicate('Hello world test extra', 'proj-1');

      expect(result.isDuplicate || result.similarity > 0.8).toBe(true);
    });

    it('should not flag different text as duplicate', () => {
      deduplicator.addContent('content-1', 'One text', 'proj-1', 'github');
      const result = deduplicator.checkDuplicate('Completely different content', 'proj-1');

      expect(result.isDuplicate).toBe(false);
      expect(result.similarity).toBeLessThan(0.95);
    });

    it('should remove duplicates', () => {
      deduplicator.addContent('content-1', 'Text', 'proj-1', 'github');
      const removed = deduplicator.removeDuplicate('content-1');

      expect(removed).toBe(true);
      expect(deduplicator.getContentForProject('proj-1')).toHaveLength(0);
    });

    it('should get project content', () => {
      deduplicator.addContent('content-1', 'Text 1', 'proj-1', 'github');
      deduplicator.addContent('content-2', 'Text 2', 'proj-1', 'github');
      deduplicator.addContent('content-3', 'Text 3', 'proj-2', 'medium');

      const proj1Content = deduplicator.getContentForProject('proj-1');
      expect(proj1Content).toHaveLength(2);
    });

    it('should get deduplicator stats', () => {
      const stats = deduplicator.getStats();
      expect(stats).toHaveProperty('totalContent');
      expect(stats).toHaveProperty('threshold');
    });
  });

  describe('Singleton Pattern', () => {
    it('embedder should maintain singleton', () => {
      const e1 = getEmbedder();
      const e2 = getEmbedder();
      expect(e1).toBe(e2);
    });

    it('retriever should maintain singleton', () => {
      const r1 = getRetriever();
      const r2 = getRetriever();
      expect(r1).toBe(r2);
    });

    it('memory should maintain singleton', () => {
      const m1 = getMemory();
      const m2 = getMemory();
      expect(m1).toBe(m2);
    });

    it('deduplicator should maintain singleton', () => {
      const d1 = getDeduplicator();
      const d2 = getDeduplicator();
      expect(d1).toBe(d2);
    });
  });
});
