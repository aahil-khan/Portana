import { FastifyInstance } from 'fastify';
import { getChat } from '../chat/index.js';

export async function registerChatRoutes(fastify: FastifyInstance): Promise<void> {
  /**
   * POST /api/chat/ask
   * Streaming chat endpoint - returns Server-Sent Events
   * Request body: { sessionId: string, message: string, onboardingSessionId?: string }
   * Response: stream of text chunks (SSE format)
   */
  fastify.post<{
    Body: {
      sessionId: string;
      message: string;
      onboardingSessionId?: string;
    };
  }>('/api/chat/ask', async (request, reply) => {
    try {
      const { sessionId, message, onboardingSessionId } = request.body;

      if (!sessionId || !message) {
        return reply.code(400).send({
          error: 'Missing required fields: sessionId, message',
        });
      }

      const chat = getChat();

      // Set up streaming response with Server-Sent Events
      reply.header('Content-Type', 'text/event-stream');
      reply.header('Cache-Control', 'no-cache');
      reply.header('Connection', 'keep-alive');

      // Send initial connection message
      reply.raw.write('data: {"status": "connected"}\n\n');

      try {
        // Stream the chat response
        for await (const chunk of chat.streamChat({
          sessionId,
          message,
          onboardingSessionId,
        })) {
          // Send each chunk as an SSE message
          reply.raw.write(`data: ${JSON.stringify({ content: chunk })}\n\n`);
        }

        // Send completion message
        reply.raw.write('data: {"status": "complete"}\n\n');
        reply.raw.end();
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'Unknown streaming error';
        reply.raw.write(
          `data: ${JSON.stringify({ error: errorMessage, status: 'error' })}\n\n`
        );
        reply.raw.end();
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      return reply.code(500).send({
        error: errorMessage,
      });
    }
  });

  /**
   * POST /api/chat/message
   * Non-streaming chat endpoint - returns complete response
   * Request body: { sessionId: string, message: string, onboardingSessionId?: string }
   * Response: { response: string, tokensUsed?: number }
   */
  fastify.post<{
    Body: {
      sessionId: string;
      message: string;
      onboardingSessionId?: string;
    };
  }>('/api/chat/message', async (request, reply) => {
    try {
      const { sessionId, message, onboardingSessionId } = request.body;

      if (!sessionId || !message) {
        return reply.code(400).send({
          error: 'Missing required fields: sessionId, message',
        });
      }

      const chat = getChat();

      try {
        const result = await chat.chat({
          sessionId,
          message,
          onboardingSessionId,
        });

        return reply.code(200).send(result);
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'Unknown chat error';
        return reply.code(500).send({
          error: errorMessage,
        });
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      return reply.code(500).send({
        error: errorMessage,
      });
    }
  });

  /**
   * GET /api/chat/:sessionId/history
   * Get conversation history for a session
   * Response: ChatMessage[]
   */
  fastify.get<{
    Params: { sessionId: string };
  }>('/api/chat/:sessionId/history', async (request, reply) => {
    try {
      const { sessionId } = request.params as any;

      if (!sessionId) {
        return reply.code(400).send({
          error: 'Missing sessionId',
        });
      }

      const chat = getChat();

      try {
        const history = await chat.getHistory(sessionId);
        return reply.code(200).send({
          sessionId,
          messages: history,
          count: history.length,
        });
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'Unknown error';
        return reply.code(500).send({
          error: errorMessage,
        });
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      return reply.code(500).send({
        error: errorMessage,
      });
    }
  });

  /**
   * POST /api/chat/:sessionId/clear
   * Clear conversation history for a session
   * Response: { status: 'cleared', sessionId: string }
   */
  fastify.post<{
    Params: { sessionId: string };
  }>('/api/chat/:sessionId/clear', async (request, reply) => {
    try {
      const { sessionId } = request.params as any;

      if (!sessionId) {
        return reply.code(400).send({
          error: 'Missing sessionId',
        });
      }

      const chat = getChat();
      chat.clearSession(sessionId);

      return reply.code(200).send({
        status: 'cleared',
        sessionId,
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      return reply.code(500).send({
        error: errorMessage,
      });
    }
  });
}
