import Fastify, { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import fastifyJwt from '@fastify/jwt';
import fastifyCors from '@fastify/cors';
import fastifyRateLimit from '@fastify/rate-limit';
import fastifyMultipart from '@fastify/multipart';
import { loadEnv } from './env.js';
import { registerAdminRoutes } from './routes/admin.js';
import { registerChatRoutes } from './routes/chat.js';
import { onboardingRoutes as registerOnboardingRoutes } from './routes/onboarding.js';
import { registerWebhookRoutes } from './routes/webhooks.js';
import { registerCommandRoutes } from './routes/commands.js';

/**
 * Initialize Fastify application with all plugins and middleware
 */
export async function createApp(): Promise<FastifyInstance> {
  const env = loadEnv();

  // Create Fastify instance with Pino logger
  const fastify = Fastify({
    logger: {
      level: env.LOG_LEVEL,
      transport:
        env.NODE_ENV === 'development'
          ? {
              target: 'pino-pretty',
              options: {
                colorize: true,
                translateTime: 'SYS:standard',
                ignore: 'pid,hostname',
              },
            }
          : undefined,
    },
    requestIdHeader: 'x-request-id',
    requestIdLogLabel: 'reqId',
    disableRequestLogging: false,
    trustProxy: true,
  });

  // Register JWT plugin
  fastify.register(fastifyJwt, {
    secret: env.JWT_SECRET,
    cookie: {
      cookieName: 'token',
      signed: false,
    },
    sign: {
      expiresIn: '30d',
    },
  });

  // Register CORS plugin (will be configured dynamically with config.json)
  fastify.register(fastifyCors, {
    origin: '*', // Will be overridden by middleware
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  // Register rate limiting
  fastify.register(fastifyRateLimit, {
    max: 100,
    timeWindow: '1 minute',
    cache: 10000,
  });

  // Register multipart plugin for file uploads
  fastify.register(fastifyMultipart, {
    limits: {
      fileSize: 10 * 1024 * 1024, // 10MB
    },
  });

  // Global error handler
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  fastify.setErrorHandler((error: any, _request: FastifyRequest, reply: FastifyReply) => {
    fastify.log.error(error);

    // Validation errors
    if ((error as any).validation) {
      return reply.status(400).send({
        error: 'Validation failed',
        code: 'VALIDATION_ERROR',
        details: (error as any).validation,
      });
    }

    // JWT errors
    if (error.name === 'UnauthorizedError') {
      return reply.status(401).send({
        error: 'Authentication required',
        code: 'AUTHENTICATION_REQUIRED',
      });
    }

    // Default error
    const statusCode = (error as any).statusCode || 500;
    return reply.status(statusCode).send({
      error: error.message || 'Internal server error',
      code: (error as any).code || 'INTERNAL_ERROR',
    });
  });

  // Health check endpoint
  fastify.get('/health', async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.send({
      status: 'ok',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      uptime: process.uptime(),
    });
  });

  // Request timing middleware
  fastify.addHook('onRequest', async (request: FastifyRequest, _reply: FastifyReply) => {
    (request as any).startTime = Date.now();
  });

  fastify.addHook('onResponse', async (request: FastifyRequest, reply: FastifyReply) => {
    const duration = Date.now() - ((request as any).startTime || Date.now());
    fastify.log.info(
      {
        method: request.method,
        url: request.url,
        statusCode: reply.statusCode,
        duration,
      },
      'Request completed'
    );
  });

  return fastify;
}

/**
 * Start the Fastify server and register all routes
 */
export async function startServer(app: FastifyInstance): Promise<void> {
  const env = loadEnv();

  try {
    // Initialize Qdrant vector database
    const { initializeQdrant } = await import('./vector/index.js');
    await initializeQdrant(env.QDRANT_URL, env.QDRANT_API_KEY);
    app.log.info('✓ Qdrant vector database initialized');

    // Register all routes
    await registerAdminRoutes(app);
    await registerChatRoutes(app);
    await registerOnboardingRoutes(app);
    await registerWebhookRoutes(app);
    await registerCommandRoutes(app);

    app.log.info('All routes registered');

    await app.listen({ port: env.PORT, host: '0.0.0.0' });
    app.log.info(`Server listening at http://localhost:${env.PORT}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}
