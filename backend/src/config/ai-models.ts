/**
 * Centralized AI Model Configuration
 * Defines optimized settings for different extraction tasks
 */

export interface ModelConfig {
  model: string;
  temperature: number;
  max_tokens: number;
  top_p?: number;
}

export const MODEL_CONFIGS: Record<string, ModelConfig> = {
  resumeAnalysis: {
    model: 'gpt-3.5-turbo',
    temperature: 0.1, // Very low for deterministic parsing
    max_tokens: 2000,
  },
  skillsExtraction: {
    model: 'gpt-3.5-turbo', // Simple, deterministic extraction with taxonomy constraints
    temperature: 0.1, // Very low for consistency
    max_tokens: 3000, // Allow more tokens for 30-50 skills with categories
  },
  experienceExtraction: {
    model: 'gpt-3.5-turbo',
    temperature: 0.1,
    max_tokens: 1500,
  },
  educationExtraction: {
    model: 'gpt-3.5-turbo',
    temperature: 0.1,
    max_tokens: 1000,
  },
};

/**
 * Get optimized model configuration for a task
 */
export function getModelConfig(task: string): ModelConfig {
  const config = MODEL_CONFIGS[task];
  if (!config) {
    // Default fallback
    return {
      model: 'gpt-3.5-turbo',
      temperature: 0.2,
      max_tokens: 2000,
    };
  }
  return config;
}

/**
 * Retry configuration for resilient API calls
 */
export interface RetryConfig {
  maxAttempts: number;
  initialDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
}

export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxAttempts: 3,
  initialDelayMs: 2000,
  maxDelayMs: 10000,
  backoffMultiplier: 2,
};

/**
 * Calculate exponential backoff delay
 */
export function calculateBackoffDelay(
  attempt: number,
  config: RetryConfig = DEFAULT_RETRY_CONFIG
): number {
  const delay = config.initialDelayMs * Math.pow(config.backoffMultiplier, attempt - 1);
  return Math.min(delay, config.maxDelayMs);
}

/**
 * Check if error is retryable
 */
export function isRetryableError(error: any): boolean {
  if (!error) return false;

  const errorName = error.name || error.code || '';
  const message = (error.message || '').toLowerCase();

  // Retryable error conditions
  const retryableErrors = [
    'APIConnectionTimeoutError',
    'APIConnectionError',
    'RateLimitError',
    'APITimeoutError',
    'ETIMEDOUT',
    'ECONNREFUSED',
    'timeout',
    'connect timeout',
    'read timeout',
  ];

  return retryableErrors.some(
    (err) =>
      errorName.includes(err) ||
      message.includes(err.toLowerCase()) ||
      error.status === 429 ||
      error.status === 503
  );
}
