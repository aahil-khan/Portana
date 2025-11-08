import { z } from 'zod';

/**
 * Comprehensive Zod schema for config.json
 * Based on PRD Section 6.2
 */

// User Schema
const UserSchema = z.object({
  id: z.string().uuid().nullable().default(null),
  full_name: z.string().min(2).max(50),
  bio: z.string().min(50).max(500),
  location: z.string().optional(),
  timezone: z.string().default('UTC'),
  email: z.string().email(),
  profile_image: z.string().url().optional(),
});

// GitHub Data Source
const GitHubSourceSchema = z.object({
  enabled: z.boolean().default(false),
  username: z.string().optional(),
  access_token: z.string().optional(), // Will be encrypted
  include_repos: z.enum(['all', 'public', 'selected']).default('public'),
  selected_repos: z.array(z.string()).optional(),
  auto_sync: z.boolean().default(false),
  sync_trigger: z.enum(['push', 'daily', 'weekly']).default('daily'),
  last_sync: z.string().datetime().optional(),
  repos_count: z.number().default(0),
});

// Medium Data Source
const MediumSourceSchema = z.object({
  enabled: z.boolean().default(false),
  username: z.string().optional(),
  custom_domain: z.string().optional(),
  rss_url: z.string().url().optional(),
  auto_sync: z.boolean().default(false),
  check_interval: z.enum(['6h', '12h', '24h']).default('24h'),
  last_sync: z.string().datetime().optional(),
  articles_count: z.number().default(0),
});

// LinkedIn Data Source
const LinkedInSourceSchema = z.object({
  enabled: z.boolean().default(false),
  profile_url: z.string().url().optional(),
  sync_mode: z.literal('manual').default('manual'),
});

// Resume Data Source
const ResumeSourceSchema = z.object({
  enabled: z.boolean().default(false),
  last_parsed: z.string().datetime().optional(),
  items_indexed: z.number().default(0),
});

// Data Sources Container
const DataSourcesSchema = z.object({
  github: GitHubSourceSchema.optional(),
  medium: MediumSourceSchema.optional(),
  linkedin: LinkedInSourceSchema.optional(),
  resume: ResumeSourceSchema.optional(),
});

// AI Persona
const PersonaSchema = z.object({
  tone: z.enum(['professional', 'casual', 'technical', 'friendly']).default('professional'),
  verbosity: z.enum(['concise', 'balanced', 'detailed']).default('balanced'),
  formality: z.enum(['formal', 'neutral', 'informal']).default('neutral'),
  preferences: z.object({
    cite_sources: z.boolean().default(true),
    show_confidence: z.boolean().default(true),
    ask_clarifying_questions: z.boolean().default(true),
    suggest_related_content: z.boolean().default(true),
  }),
  custom_instructions: z.string().optional(),
});

// AI Configuration
const AISchema = z.object({
  persona: PersonaSchema,
  system_prompt: z.string().optional(),
  models: z.object({
    embedding: z.string().default('text-embedding-3-small'),
    chat: z.string().default('gpt-4-turbo-preview'),
    temperature: z.number().min(0).max(2).default(0.7),
    max_tokens: z.number().min(100).max(4000).default(500),
  }),
});

// Notification Configuration
const NotificationSchema = z.object({
  email: z.boolean().default(false),
  telegram: z.object({
    enabled: z.boolean().default(false),
    bot_token: z.string().optional(),
    chat_id: z.string().optional(),
  }).optional(),
  discord: z.object({
    enabled: z.boolean().default(false),
    webhook_url: z.string().url().optional(),
  }).optional(),
});

// Analytics Configuration
const AnalyticsSchema = z.object({
  enable_telemetry: z.boolean().default(true),
  track_queries: z.boolean().default(true),
  log_level: z.enum(['error', 'warn', 'info', 'debug']).default('info'),
});

// Deployment Configuration
const DeploymentSchema = z.object({
  public_url: z.string().url(),
  admin_email: z.string().email(),
  notifications: NotificationSchema,
  analytics: AnalyticsSchema,
});

// Rate Limits Configuration
const RateLimitsSchema = z.object({
  chat_endpoint: z.object({
    per_minute: z.number().default(10),
    per_day: z.number().default(100),
    daily_token_budget: z.number().default(100000),
    ban_threshold: z.number().default(5),
  }),
  banned_ips: z.number().default(0),
});

// Root Config Schema
export const ConfigSchema = z.object({
  version: z.string().default('1.0.0'),
  user: UserSchema,
  data_sources: DataSourcesSchema,
  ai: AISchema,
  deployment: DeploymentSchema,
  rate_limits: RateLimitsSchema.optional(),
  setup_completed: z.boolean().default(false),
  setup_completed_at: z.string().datetime().optional(),
});

export type Config = z.infer<typeof ConfigSchema>;

/**
 * Default config values
 */
export function getDefaultConfig(): Partial<Config> {
  return {
    version: '1.0.0',
    user: {
      id: null,
      full_name: '',
      bio: '',
      timezone: 'UTC',
      email: '',
    },
    data_sources: {
      github: {
        enabled: false,
        include_repos: 'public',
        auto_sync: false,
        sync_trigger: 'daily',
        repos_count: 0,
      },
      medium: {
        enabled: false,
        auto_sync: false,
        check_interval: '24h',
        articles_count: 0,
      },
      linkedin: {
        enabled: false,
        sync_mode: 'manual',
      },
      resume: {
        enabled: false,
        items_indexed: 0,
      },
    },
    ai: {
      persona: {
        tone: 'professional',
        verbosity: 'balanced',
        formality: 'neutral',
        preferences: {
          cite_sources: true,
          show_confidence: true,
          ask_clarifying_questions: true,
          suggest_related_content: true,
        },
      },
      models: {
        embedding: 'text-embedding-3-small',
        chat: 'gpt-4-turbo-preview',
        temperature: 0.7,
        max_tokens: 500,
      },
    },
    setup_completed: false,
  };
}
