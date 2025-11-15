import { FastifyInstance } from 'fastify';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import { loadEnv } from '../env.js';

/**
 * Contact form submission interface
 */
interface ContactFormData {
  name: string;
  email: string;
  message: string;
  honeypot?: string;
}

/**
 * Register miscellaneous routes (file serving, contact form, etc.)
 */
export async function registerMiscRoutes(fastify: FastifyInstance): Promise<void> {
  /**
   * GET /api/misc/resume
   * Serves the resume PDF file for download
   */
  fastify.get<{}>('/api/misc/resume', async (_request, reply) => {
    try {
      const resumePath = resolve(process.cwd(), 'public', 'Aahil Khan.pdf');
      
      if (!existsSync(resumePath)) {
        return reply.code(404).send({ error: 'Resume file not found' });
      }

      const fileBuffer = readFileSync(resumePath);
      
      reply.type('application/pdf');
      reply.header('Content-Disposition', 'attachment; filename="Aahil Khan.pdf"');
      reply.header('Content-Length', fileBuffer.length);
      
      return reply.send(fileBuffer);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      fastify.log.error(error);
      return reply.code(500).send({ error: message });
    }
  });

  /**
   * GET /api/misc/extensions
   * Serves the VS Code extensions list for download
   */
  fastify.get<{}>('/api/misc/extensions', async (_request, reply) => {
    try {
      const extensionsPath = resolve(process.cwd(), 'extensions.txt');
      
      if (!existsSync(extensionsPath)) {
        return reply.code(404).send({ error: 'Extensions file not found' });
      }

      const fileBuffer = readFileSync(extensionsPath);
      
      reply.type('text/plain');
      reply.header('Content-Disposition', 'attachment; filename="aahil-vscode-extensions.txt"');
      reply.header('Content-Length', fileBuffer.length);
      
      return reply.send(fileBuffer);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      fastify.log.error(error);
      return reply.code(500).send({ error: message });
    }
  });

  /**
   * POST /api/misc/contact
   * Handles contact form submission and forwards to n8n webhook
   */
  fastify.post<{ Body: ContactFormData }>('/api/misc/contact', async (request, reply) => {
    try {
      const env = loadEnv();
      
      // Validate required fields
      const { name, email, message, honeypot } = request.body;
      
      if (!name || !email || !message) {
        return reply.code(400).send({
          success: false,
          error: 'Missing required fields: name, email, message',
        });
      }

      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return reply.code(400).send({
          success: false,
          error: 'Invalid email address',
        });
      }

      // Simple honeypot check - if honeypot field is filled, reject
      if (honeypot && honeypot.trim() !== '') {
        fastify.log.warn({ ip: request.ip }, 'Honeypot triggered');
        // Still return success to not reveal honeypot presence
        return reply.send({
          success: true,
          message: 'Thank you for your message! I will get back to you soon.',
        });
      }

      // Prepare form data for n8n webhook
      const webhookUrl = env.N8N_WEBHOOK_URL;
      fastify.log.info({ webhookUrl, envN8N: process.env.N8N_WEBHOOK_URL }, 'Debug: N8N webhook URL');
      if (!webhookUrl) {
        fastify.log.error('N8N_WEBHOOK_URL not configured');
        return reply.code(500).send({
          success: false,
          error: 'Contact service is not properly configured',
        });
      }

      const payload = {
        name,
        email,
        message,
        timestamp: new Date().toISOString(),
        userAgent: request.headers['user-agent'] || 'unknown',
      };

      // Forward to n8n webhook
      const webhookResponse = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!webhookResponse.ok) {
        fastify.log.error(
          `n8n webhook returned ${webhookResponse.status}: ${await webhookResponse.text()}`
        );
        return reply.code(500).send({
          success: false,
          error: 'Failed to process contact form. Please try again later.',
        });
      }

      return reply.send({
        success: true,
        message: 'Thank you for your message! I will get back to you soon.',
      });
    } catch (error) {
      const message = "Something went wrong processing the contact form. Catch me on LinkedIn?";
      fastify.log.error(error);
      return reply.code(500).send({
        success: false,
        error: message,
      });
    }
  });
}
