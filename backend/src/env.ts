import dotenv from 'dotenv';
dotenv.config();

import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production']).default('development'),
  PORT: z.coerce.number().default(3000),

  // OpenAI
  OPENAI_API_KEY: z.string().min(1, 'OPENAI_API_KEY is required'),

  // Security
  JWT_SECRET: z
    .string()
    .min(32, 'JWT_SECRET must be at least 32 characters'),
  WEBHOOK_SECRET: z.string().min(1, 'WEBHOOK_SECRET is required'),
  MASTER_SECRET: z
    .string()
    .min(32, 'MASTER_SECRET must be at least 32 characters'),

  // Qdrant
  QDRANT_URL: z.string().url().default('http://qdrant:6333'),
  QDRANT_API_KEY: z.string().optional(),

  // Optional: Notifications
  TELEGRAM_BOT_TOKEN: z.string().optional(),
  TELEGRAM_CHAT_ID: z.string().optional(),
  DISCORD_WEBHOOK_URL: z.string().url().optional().or(z.literal('')),

  // Logging
  LOG_LEVEL: z
    .enum(['error', 'warn', 'info', 'debug'])
    .default('info'),

  // Feature flags
  ENABLE_TELEMETRY: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .default('true'),
  TRACK_QUERIES: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .default('true'),
});

export type Env = z.infer<typeof envSchema>;

export function loadEnv(): Env {
  try {
    return envSchema.parse(process.env);
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error('Environment validation failed:');
      error.errors.forEach((err) => {
        console.error(`  ${err.path.join('.')}: ${err.message}`);
      });
    }
    process.exit(1);
  }
}
