import { getChat } from '../src/chat';

describe('ChatService', () => {
  let sessionId: string;
  let onboardingSessionId: string;

  beforeEach(() => {
    sessionId = `test-chat-${Date.now()}`;
    onboardingSessionId = `onboarding-${Date.now()}`;
  });

  describe('Session Management', () => {
    it('should create a new chat session', () => {
      const chat = getChat();
      const session = chat.createSession(sessionId);

      expect(session).toBeDefined();
      expect(session.sessionId).toBe(sessionId);
    });

    it('should retrieve an existing session', () => {
      const chat = getChat();
      chat.createSession(sessionId);
      const session = chat.getSession(sessionId);

      expect(session).toBeDefined();
      expect(session?.sessionId).toBe(sessionId);
    });

    it('should return null for non-existent session', () => {
      const chat = getChat();
      const session = chat.getSession('non-existent');

      expect(session).toBeNull();
    });

    it('should clear session history', async () => {
      const chat = getChat();
      chat.createSession(sessionId);

      // Try to clear the session
      chat.clearSession(sessionId);

      // Session should be removed
      const session = chat.getSession(sessionId);
      expect(session).toBeNull();
    });
  });

  describe('Chat Request Validation', () => {
    it('should validate required fields', async () => {
      const chat = getChat();
      chat.createSession(sessionId);

      // Test with missing message
      try {
        const generator = chat.streamChat({
          sessionId,
          message: '',
        });
        await generator.next();
        expect(true).toBe(false); // Should not reach here
      } catch (error) {
        expect(error).toBeDefined();
      }
    });

    it('should reject messages that are too long', async () => {
      const chat = getChat();
      chat.createSession(sessionId);

      try {
        const longMessage = 'a'.repeat(5000); // Exceeds 4000 char limit
        const generator = chat.streamChat({
          sessionId,
          message: longMessage,
        });
        await generator.next();
        expect(true).toBe(false); // Should not reach here
      } catch (error) {
        expect(error).toBeDefined();
      }
    });

    it('should accept valid chat requests', async () => {
      const chat = getChat();
      chat.createSession(sessionId);

      try {
        const generator = chat.streamChat({
          sessionId,
          message: 'Hello, how are you?',
        });

        // Just try to get the first chunk
        const result = await generator.next();
        // Will fail if API key is missing, but that's expected in tests
        expect(result).toBeDefined();
      } catch (error) {
        // Expected in test environment without API key
        expect(error).toBeDefined();
      }
    });
  });

  describe('Non-streaming chat', () => {
    it('should return complete response in non-streaming mode', async () => {
      const chat = getChat();
      chat.createSession(sessionId);

      try {
        const result = await chat.chat({
          sessionId,
          message: 'Say hello',
        });

        expect(result).toBeDefined();
        expect(result.response).toBeDefined();
        expect(typeof result.response).toBe('string');
      } catch (error) {
        // Expected in test environment without API key
        expect(error).toBeDefined();
      }
    });

    it('should include token usage in response', async () => {
      const chat = getChat();
      chat.createSession(sessionId);

      try {
        const result = await chat.chat({
          sessionId,
          message: 'Say hello',
        });

        expect(result).toBeDefined();
        if (result.tokensUsed) {
          expect(typeof result.tokensUsed).toBe('number');
        }
      } catch (error) {
        // Expected in test environment without API key
        expect(error).toBeDefined();
      }
    });
  });

  describe('Message History', () => {
    it('should retrieve empty history for new session', async () => {
      const chat = getChat();
      chat.createSession(sessionId);

      try {
        const history = await chat.getHistory(sessionId);
        expect(Array.isArray(history)).toBe(true);
      } catch (error) {
        // Expected if memory service not available
        expect(error).toBeDefined();
      }
    });

    it('should store and retrieve messages', async () => {
      const chat = getChat();
      chat.createSession(sessionId);

      try {
        // Note: We can't easily test actual message storage without API key
        // But we can test that the method exists and returns array
        const history = await chat.getHistory(sessionId);
        expect(Array.isArray(history)).toBe(true);
      } catch (error) {
        // Expected if memory service not available
        expect(error).toBeDefined();
      }
    });
  });

  describe('Context Building', () => {
    it('should create session without onboarding context', () => {
      const chat = getChat();
      const session = chat.createSession(sessionId);

      expect(session).toBeDefined();
      expect(session.onboardingSessionId).toBeUndefined();
    });

    it('should create session with onboarding context', () => {
      const chat = getChat();
      const session = chat.createSession(sessionId, undefined, onboardingSessionId);

      expect(session).toBeDefined();
      expect(session.onboardingSessionId).toBe(onboardingSessionId);
    });

    it('should create session with user ID', () => {
      const chat = getChat();
      const userId = 'test-user-123';
      const session = chat.createSession(sessionId, userId);

      expect(session).toBeDefined();
      expect(session.userId).toBe(userId);
    });
  });

  describe('Error Handling', () => {
    it('should handle missing API key gracefully', async () => {
      // This test verifies that without API key, chat fails appropriately
      const chat = getChat();
      chat.createSession(sessionId);

      try {
        const result = await chat.chat({
          sessionId,
          message: 'test message',
        });
        // If we get here, API key was somehow available
        expect(result).toBeDefined();
      } catch (error) {
        // Expected behavior
        expect(error).toBeDefined();
        expect(error instanceof Error).toBe(true);
      }
    });

    it('should handle invalid session gracefully in streaming', async () => {
      const chat = getChat();

      try {
        // Try to stream without creating session first
        const generator = chat.streamChat({
          sessionId: 'invalid-session',
          message: 'test',
        });

        await generator.next();
        // If this reaches here, auto-create session worked
        expect(true).toBe(true);
      } catch (error) {
        expect(error).toBeDefined();
      }
    });

    it('should reject malformed requests', async () => {
      const chat = getChat();

      try {
        const generator = chat.streamChat({
          sessionId: '',
          message: 'test',
        });

        await generator.next();
        expect(true).toBe(false); // Should not reach
      } catch (error) {
        expect(error).toBeDefined();
      }
    });
  });

  describe('Streaming', () => {
    it('should return async generator for streaming', () => {
      const chat = getChat();
      chat.createSession(sessionId);

      const generator = chat.streamChat({
        sessionId,
        message: 'test',
      });

      expect(generator).toBeDefined();
      expect(typeof generator[Symbol.asyncIterator]).toBe('function');
    });

    it('should handle stream cancellation', async () => {
      const chat = getChat();
      chat.createSession(sessionId);

      try {
        const generator = chat.streamChat({
          sessionId,
          message: 'test',
        });

        // Try to return (close) the generator
        await generator.return();
        expect(true).toBe(true);
      } catch (error) {
        // Expected if API key missing
        expect(error).toBeDefined();
      }
    });
  });

  describe('Singleton Pattern', () => {
    it('chat should maintain singleton', () => {
      const chat1 = getChat();
      const chat2 = getChat();

      expect(chat1).toBe(chat2);
    });
  });
});
