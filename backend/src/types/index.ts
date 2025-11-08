/**
 * Core Type Definitions for Portfolio OS
 */

// User & Profile
export interface User {
  id: string;
  full_name: string;
  bio: string;
  location?: string;
  timezone: string;
  email: string;
  profile_image?: string;
}

// Portfolio Items (Universal Format)
export type PortfolioItemType =
  | 'project'
  | 'blog'
  | 'experience'
  | 'education'
  | 'certification';

export type PortfolioItemSource =
  | 'github'
  | 'medium'
  | 'resume'
  | 'manual'
  | 'linkedin';

export interface PortfolioItem {
  id: string;
  type: PortfolioItemType;
  source: PortfolioItemSource;
  title: string;
  content: string;
  summary: string;
  tags: string[];
  date: Date;
  url?: string;
  metadata: Record<string, unknown>;
}

// Vector/Embedding
export interface VectorChunk {
  id: string;
  vector: number[];
  payload: {
    id: string;
    type: PortfolioItemType;
    source: PortfolioItemSource;
    title: string;
    summary: string;
    url?: string;
    tags: string[];
    date: string;
    chunk_text: string;
    chunk_index: number;
    chunk_total: number;
    metadata: Record<string, unknown>;
  };
}

export interface SearchResult extends VectorChunk {
  score: number;
}

// Chat & Memory
export type ChatRole = 'user' | 'assistant';

export interface ChatMessage {
  role: ChatRole;
  content: string;
  timestamp: Date;
}

export interface ChatSession {
  id: string;
  messages: ChatMessage[];
  created_at: Date;
  last_active: Date;
}

// Config
export interface PersonaConfig {
  tone: 'professional' | 'casual' | 'technical' | 'friendly';
  verbosity: 'concise' | 'balanced' | 'detailed';
  formality: 'formal' | 'neutral' | 'informal';
  preferences: {
    cite_sources: boolean;
    show_confidence: boolean;
    ask_clarifying_questions: boolean;
    suggest_related_content: boolean;
  };
  custom_instructions?: string;
}

export interface AIConfig {
  persona: PersonaConfig;
  system_prompt?: string;
  models: {
    embedding: string;
    chat: string;
    temperature: number;
    max_tokens: number;
  };
}

export interface DeploymentConfig {
  public_url: string;
  admin_email: string;
  notifications: {
    email: boolean;
    telegram?: {
      enabled: boolean;
      bot_token: string;
      chat_id: string;
    };
    discord?: {
      enabled: boolean;
      webhook_url: string;
    };
  };
  analytics: {
    enable_telemetry: boolean;
    track_queries: boolean;
    log_level: string;
  };
}

export interface DataSourceConfig {
  github?: {
    enabled: boolean;
    username: string;
    access_token?: string;
    include_repos: 'all' | 'public' | 'selected';
    selected_repos?: string[];
    auto_sync: boolean;
    sync_trigger: 'push' | 'daily' | 'weekly';
    last_sync?: Date;
    repos_count: number;
  };
  medium?: {
    enabled: boolean;
    username: string;
    custom_domain?: string;
    rss_url?: string;
    auto_sync: boolean;
    check_interval: '6h' | '12h' | '24h';
    last_sync?: Date;
    articles_count: number;
  };
  linkedin?: {
    enabled: boolean;
    profile_url: string;
    sync_mode: 'manual';
  };
  resume?: {
    enabled: boolean;
    last_parsed?: Date;
    items_indexed: number;
  };
}

export interface Config {
  version: string;
  user: User & { id: string | null };
  data_sources: DataSourceConfig;
  ai: AIConfig;
  deployment: DeploymentConfig;
  setup_completed: boolean;
  setup_completed_at?: Date;
}

// Utility Types
export interface PaginationParams {
  page: number;
  limit: number;
}

export interface PaginatedResponse<T> {
  items: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    total_pages: number;
  };
}

export interface ErrorResponse {
  error: string;
  code: string;
  details?: Record<string, unknown>;
}
