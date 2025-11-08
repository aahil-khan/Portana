import { promises as fs } from 'fs';
import { ConfigSchema, Config } from './config-schema.js';
import { encrypt, decrypt, ENCRYPTED_PATHS } from './encryption.js';
import { loadEnv } from '../env.js';

/**
 * Recursive path-based getter/setter for nested objects
 */
function getNestedValue(obj: any, pathStr: string): any {
  const parts = pathStr.split('.');
  let current = obj;
  for (const part of parts) {
    if (current === null || current === undefined) return undefined;
    current = current[part];
  }
  return current;
}

function setNestedValue(obj: any, pathStr: string, value: any): void {
  const parts = pathStr.split('.');
  const last = parts.pop();

  if (!last) throw new Error('Invalid path');

  let current = obj;
  for (const part of parts) {
    if (!(part in current)) {
      current[part] = {};
    }
    current = current[part];
  }

  current[last] = value;
}

/**
 * Recursively encrypt all sensitive fields in config
 */
function encryptConfig(config: any, masterSecret: string): any {
  const encrypted = JSON.parse(JSON.stringify(config));

  for (const encPath of ENCRYPTED_PATHS) {
    const value = getNestedValue(encrypted, encPath);
    if (value && typeof value === 'string') {
      const encryptedValue = encrypt(value, masterSecret);
      setNestedValue(encrypted, encPath, encryptedValue);
    }
  }

  return encrypted;
}

/**
 * Recursively decrypt all sensitive fields in config
 */
function decryptConfig(config: any, masterSecret: string): any {
  const decrypted = JSON.parse(JSON.stringify(config));

  for (const encPath of ENCRYPTED_PATHS) {
    const value = getNestedValue(decrypted, encPath);
    if (value && typeof value === 'string') {
      try {
        const decryptedValue = decrypt(value, masterSecret);
        setNestedValue(decrypted, encPath, decryptedValue);
      } catch (error) {
        // If decryption fails, leave as-is (might not be encrypted)
        console.warn(`Failed to decrypt ${encPath}, leaving as-is`);
      }
    }
  }

  return decrypted;
}

/**
 * Configuration Manager
 * Handles loading, saving, updating, and encrypting config.json
 */
export class ConfigManager {
  private config: Config | null = null;
  private masterSecret: string;
  private configPath: string;
  private watchers: ((config: Config) => void)[] = [];

  constructor(masterSecret: string, configPath: string = '/data/config.json') {
    this.masterSecret = masterSecret;
    this.configPath = configPath;
  }

  /**
   * Load config from disk and validate
   */
  async load(): Promise<Config> {
    try {
      const data = await fs.readFile(this.configPath, 'utf-8');
      const parsed = JSON.parse(data);

      // Decrypt sensitive fields
      const decrypted = decryptConfig(parsed, this.masterSecret);

      // Validate with schema
      const validated = ConfigSchema.parse(decrypted);
      this.config = validated;

      return validated;
    } catch (error) {
      if ((error as any).code === 'ENOENT') {
        // File doesn't exist, create default
        const defaultConfig = this.createDefaultConfig();
        await this.save(defaultConfig);
        return defaultConfig;
      }

      throw new Error(`Failed to load config: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Save config to disk with encryption and atomic writes
   */
  async save(config: Config): Promise<void> {
    try {
      // Validate schema
      const validated = ConfigSchema.parse(config);

      // Encrypt sensitive fields
      const encrypted = encryptConfig(validated, this.masterSecret);

      // Write to temp file first
      const tempPath = this.configPath + '.tmp';
      await fs.writeFile(tempPath, JSON.stringify(encrypted, null, 2), 'utf-8');

      // Atomic rename (should be atomic on most filesystems)
      await fs.rename(tempPath, this.configPath);

      // Update in-memory copy
      this.config = validated;

      // Notify watchers
      this.notifyWatchers(validated);
    } catch (error) {
      throw new Error(`Failed to save config: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Update config with partial values (deep merge)
   */
  async update(partial: Partial<Config>): Promise<void> {
    if (!this.config) {
      throw new Error('Config not loaded');
    }

    const updated = this.deepMerge(this.config, partial);
    await this.save(updated);
  }

  /**
   * Update specific config path
   */
  async updatePath(path: string, value: any): Promise<void> {
    if (!this.config) {
      throw new Error('Config not loaded');
    }

    const updated = JSON.parse(JSON.stringify(this.config));
    setNestedValue(updated, path, value);
    await this.save(updated);
  }

  /**
   * Get current config
   */
  get(): Config {
    if (!this.config) {
      throw new Error('Config not loaded');
    }
    return this.config;
  }

  /**
   * Get value at path
   */
  getPath(path: string): any {
    if (!this.config) {
      throw new Error('Config not loaded');
    }
    return getNestedValue(this.config, path);
  }

  /**
   * Check if path exists in schema
   */
  pathExists(path: string): boolean {
    try {
      return getNestedValue(ConfigSchema, path) !== undefined;
    } catch {
      return false;
    }
  }

  /**
   * Subscribe to config changes
   */
  watch(callback: (config: Config) => void): void {
    this.watchers.push(callback);
  }

  /**
   * Notify all watchers
   */
  private notifyWatchers(config: Config): void {
    for (const watcher of this.watchers) {
      try {
        watcher(config);
      } catch (error) {
        console.error('Watcher error:', error);
      }
    }
  }

  /**
   * Deep merge objects (for partial updates)
   */
  private deepMerge(target: any, source: any): any {
    const result = JSON.parse(JSON.stringify(target));

    for (const key in source) {
      if (Object.prototype.hasOwnProperty.call(source, key)) {
        if (
          typeof source[key] === 'object' &&
          source[key] !== null &&
          !Array.isArray(source[key])
        ) {
          result[key] = this.deepMerge(result[key] || {}, source[key]);
        } else {
          result[key] = source[key];
        }
      }
    }

    return result;
  }

  /**
   * Create default config for new setup
   */
  private createDefaultConfig(): Config {
    // Create default config structure
    const config: Config = {
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
      deployment: {
        public_url: 'http://localhost:3000',
        admin_email: 'admin@example.com',
        notifications: {
          email: false,
        },
        analytics: {
          enable_telemetry: true,
          track_queries: true,
          log_level: 'info',
        },
      },
      setup_completed: false,
    };

    return config;
  }
}

/**
 * Global config manager instance
 */
let configManager: ConfigManager | null = null;

/**
 * Initialize and get config manager
 */
export async function getConfigManager(): Promise<ConfigManager> {
  if (configManager) {
    return configManager;
  }

  const env = loadEnv();
  const configPath = process.env.CONFIG_PATH || '/data/config.json';

  configManager = new ConfigManager(env.MASTER_SECRET, configPath);
  await configManager.load();

  return configManager;
}
