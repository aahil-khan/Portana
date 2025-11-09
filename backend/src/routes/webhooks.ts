import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import {
  WebhookVerifierService,
  WebhookQueueService,
} from '../webhooks/services/index.js';

export async function registerWebhookRoutes(fastify: FastifyInstance): Promise<void> {
  const verifier = WebhookVerifierService.getInstance();
  const queue = WebhookQueueService.getInstance();

  fastify.post<{ Body: Record<string, unknown> }>('/api/webhooks/github', async (
    request: FastifyRequest,
    reply: FastifyReply
  ) => {
    try {
      const signature = request.headers['x-hub-signature-256'] as string | undefined;
      const payload = JSON.stringify(request.body);

      const secret = process.env.GITHUB_WEBHOOK_SECRET;
      if (!secret) {
        return reply.status(401).send({ error: 'Webhook secret not configured' });
      }

      if (!signature) {
        return reply.status(401).send({ error: 'Missing signature' });
      }

      if (!verifier.verifyHMACSignature(payload, signature, secret)) {
        return reply.status(401).send({ error: 'Invalid signature' });
      }

      const webhookId = queue.addToQueue(request.body as Record<string, unknown>);
      return reply.status(202).send({
        accepted: true,
        id: webhookId,
        message: 'Webhook received and queued for processing',
      });
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  fastify.post<{ Body: Record<string, unknown> }>('/api/webhooks/medium', async (
    request: FastifyRequest,
    reply: FastifyReply
  ) => {
    try {
      const signature = request.headers['x-webhook-signature'] as string | undefined;
      const payload = JSON.stringify(request.body);

      const secret = process.env.MEDIUM_WEBHOOK_SECRET;
      if (!secret) {
        return reply.status(401).send({ error: 'Webhook secret not configured' });
      }

      if (!signature) {
        return reply.status(401).send({ error: 'Missing signature' });
      }

      if (!verifier.verifyHMACSignature(payload, signature, secret)) {
        return reply.status(401).send({ error: 'Invalid signature' });
      }

      const webhookId = queue.addToQueue(request.body as Record<string, unknown>);
      return reply.status(202).send({
        accepted: true,
        id: webhookId,
        message: 'Webhook received and queued for processing',
      });
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  fastify.post<{ Body: Record<string, unknown> }>('/api/webhooks/ingest', async (
    request: FastifyRequest,
    reply: FastifyReply
  ) => {
    try {
      const authHeader = request.headers.authorization as string | undefined;
      const signature = request.headers['x-webhook-signature'] as string | undefined;

      const secret = process.env.WEBHOOK_SECRET;
      const token = process.env.WEBHOOK_TOKEN;

      if (signature && secret) {
        const payload = JSON.stringify(request.body);
        if (!verifier.verifyHMACSignature(payload, signature, secret)) {
          return reply.status(401).send({ error: 'Invalid signature' });
        }
      }
      else if (authHeader && token) {
        if (!verifier.verifyBearerToken(authHeader, token)) {
          return reply.status(401).send({ error: 'Invalid token' });
        }
      }
      else {
        return reply.status(401).send({ error: 'No authentication method available' });
      }

      const webhookId = queue.addToQueue(request.body as Record<string, unknown>);
      return reply.status(202).send({
        accepted: true,
        id: webhookId,
        message: 'Webhook received and queued for processing',
      });
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  fastify.get<{ Reply: Record<string, unknown> }>('/api/webhooks/status', async (
    _request: FastifyRequest,
    reply: FastifyReply
  ) => {
    try {
      const stats = queue.getStats();
      return reply.status(200).send(stats);
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  fastify.get<{ Reply: Record<string, unknown>[] }>('/api/webhooks/dlq', async (
    _request: FastifyRequest,
    reply: FastifyReply
  ) => {
    try {
      const dlqItems = queue.getDeadLetterQueue();
      return reply.status(200).send(dlqItems);
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  fastify.post<{ Params: { id: string }; Reply: Record<string, unknown> }>(
    '/api/webhooks/dlq/retry/:id',
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { id } = request.params as { id: string };
        const success = queue.retryFromDLQ(id);

        if (!success) {
          return reply.status(404).send({ error: 'Webhook not found in DLQ' });
        }

        return reply.status(200).send({
          success: true,
          message: 'Webhook moved back to queue for retry',
          id,
        });
      } catch (error) {
        fastify.log.error(error);
        return reply.status(500).send({ error: 'Internal server error' });
      }
    }
  );
}

export default registerWebhookRoutes;
