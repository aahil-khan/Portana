# Portfolio OS - Implementation Plan

**Project:** Portfolio OS - AI-Powered Self-Maintaining Portfolio Platform  
**Status:** Starting Development  
**Target:** Production-ready v1.0.0  
**Estimated Timeline:** 2 weeks (MVP)

---

## Table of Contents

1. [Phase 1: Foundation & Architecture](#phase-1-foundation--architecture)
2. [Phase 2: Core Services](#phase-2-core-services)
3. [Phase 3: Onboarding System](#phase-3-onboarding-system)
4. [Phase 4: Chat & Retrieval](#phase-4-chat--retrieval)
5. [Phase 5: Admin & Management](#phase-5-admin--management)
6. [Phase 6: Webhooks & Automation](#phase-6-webhooks--automation)
7. [Phase 7: Security & Observability](#phase-7-security--observability)
8. [Phase 8: Deployment & Documentation](#phase-8-deployment--documentation)
9. [Phase 9: Testing & Polish](#phase-9-testing--polish)

---

## Phase 1: Foundation & Architecture

### 1.1 Project Structure Setup

**Objective:** Create the base project structure with all tooling configured

**Files to Create:**
```
portfolio-os/
├── backend/
│   ├── src/
│   │   ├── app.ts                    # Main Fastify app
│   │   ├── env.ts                    # Environment variables & validation
│   │   ├── config/
│   │   │   ├── config-schema.ts      # Zod schema for config.json
│   │   │   ├── config-manager.ts     # Load/save/update config with encryption
│   │   │   └── defaults.ts           # Default config values
│   │   ├── services/
│   │   ├── routes/
│   │   ├── middleware/
│   │   ├── utils/
│   │   └── types/
│   ├── tests/
│   ├── Dockerfile
│   ├── docker-compose.yml
│   ├── tsconfig.json
│   ├── .eslintrc.json
│   ├── .prettierrc
│   ├── package.json
│   └── .env.example
├── data/
│   ├── .gitkeep                      # Volume mount for config.json
├── logs/
│   └── .gitkeep                      # Volume mount for logs
├── docs/
│   ├── nginx-example.conf
│   ├── API.md
│   ├── SETUP.md
│   └── TROUBLESHOOTING.md
├── .gitignore
├── .env.example (root)
├── PRD.md
├── IMPLEMENTATION_PLAN.md (this file)
└── README.md
```

**Tasks:**
- [ ] Initialize Node.js + TypeScript project
- [ ] Install core dependencies (fastify, typescript, zod, pino, sqlite3, qdrant-client, openai)
- [ ] Configure tsconfig.json with strict mode
- [ ] Set up ESLint + Prettier
- [ ] Create .gitignore (node_modules, .env, data/config.json, logs, dist)
- [ ] Initialize git repository structure
- [ ] Create basic folder structure

**Dependencies to Install:**
```json
{
  "devDependencies": {
    "typescript": "^5.3.0",
    "ts-node": "^10.9.0",
    "@types/node": "^20.0.0",
    "eslint": "^8.0.0",
    "@typescript-eslint/eslint-plugin": "^6.0.0",
    "@typescript-eslint/parser": "^6.0.0",
    "prettier": "^3.0.0"
  },
  "dependencies": {
    "fastify": "^4.24.0",
    "@fastify/jwt": "^7.0.0",
    "@fastify/cors": "^8.0.0",
    "@fastify/rate-limit": "^9.0.0",
    "typescript": "^5.3.0",
    "zod": "^3.22.0",
    "pino": "^9.0.0",
    "pino-pretty": "^10.0.0",
    "sqlite3": "^5.1.6",
    "better-sqlite3": "^9.0.0",
    "qdrant-client": "^1.7.0",
    "openai": "^4.24.0",
    "pdf-parse": "^1.1.1",
    "crypto": "built-in",
    "uuid": "^9.0.1",
    "@types/uuid": "^9.0.7"
  }
}
```

---

### 1.2 Environment & Configuration

**Objective:** Set up environment variable validation and defaults

**File: `backend/src/env.ts`**

Create validation for:
- `NODE_ENV` (production | development)
- `PORT` (default: 3000)
- `OPENAI_API_KEY` (required)
- `JWT_SECRET` (required, 32+ chars)
- `WEBHOOK_SECRET` (required)
- `QDRANT_URL` (default: http://qdrant:6333)
- `QDRANT_API_KEY` (optional)
- `MASTER_SECRET` (required, for config encryption)
- All optional integration tokens

**File: `backend/src/.env.example`**

Template with all required and optional variables

**Tasks:**
- [ ] Create env.ts with Zod validation
- [ ] Validate on app startup
- [ ] Throw clear errors if required vars missing
- [ ] Create .env.example
- [ ] Document all environment variables

---

### 1.3 Fastify App Initialization

**Objective:** Create the base Fastify application with plugins

**File: `backend/src/app.ts`**

Initialize:
- Logger (Pino with pretty-print in dev)
- JWT plugin (@fastify/jwt)
- CORS plugin (@fastify/cors)
- Rate limiting (@fastify/rate-limit)
- Custom health check endpoint
- Global error handler
- Request ID tracking

**Tasks:**
- [ ] Create app.ts with Fastify initialization
- [ ] Register all plugins
- [ ] Implement global error handling
- [ ] Add request logging middleware
- [ ] Create health check endpoint (GET /health)
- [ ] Test startup and shutdown

---

## Phase 2: Core Services

### 2.1 Config System

**Objective:** Implement persistent configuration with encryption and validation

**Files:**
- `backend/src/config/config-schema.ts` - Zod schema (entire config structure)
- `backend/src/config/config-manager.ts` - Manager class
- `backend/src/config/defaults.ts` - Default values

**ConfigManager Methods:**
```typescript
class ConfigManager {
  load(): Promise<Config>           // Load from /data/config.json
  save(config: Config): Promise<void>  // Save with encryption & validation
  update(partial: Partial<Config>): Promise<void>  // Deep merge + save
  get(): Config                     // Get current in-memory config
  watch(cb: (config: Config) => void): void  // Subscribe to changes
  pathExists(path: string): boolean // Check if JSON path valid
  getTypeForPath(path: string): ZodType  // Get expected type
  encrypt(value: string): string    // AES-256-GCM encrypt
  decrypt(value: string): string    // AES-256-GCM decrypt
}
```

**Encryption Details:**
- Algorithm: AES-256-GCM
- Key: Derived from MASTER_SECRET via PBKDF2
- IV: Random 12 bytes, prepended to ciphertext
- Auth Tag: Included in encrypted data
- Fields encrypted: all tokens, API keys, bot tokens

**Atomic Writes:**
- Write to temp file
- Verify no errors
- Rename temp → config.json (atomic)

**Default Config Structure:**
```typescript
{
  version: "1.0.0",
  user: {
    id: null,
    full_name: null,
    bio: null,
    location: null,
    timezone: "UTC",
    email: null,
    profile_image: null
  },
  data_sources: {
    github: { enabled: false, ... },
    medium: { enabled: false, ... },
    linkedin: { enabled: false, ... },
    resume: { enabled: false, ... }
  },
  ai: {
    persona: { tone: "professional", ... },
    system_prompt: null,
    models: {
      embedding: "text-embedding-3-small",
      chat: "gpt-4-turbo-preview",
      temperature: 0.7,
      max_tokens: 500
    }
  },
  deployment: { ... },
  setup_completed: false
}
```

**Tasks:**
- [ ] Create comprehensive Zod schema
- [ ] Implement encryption/decryption with AES-256-GCM
- [ ] Implement atomic file writes
- [ ] Implement ConfigManager class with all methods
- [ ] Add config validation on load/save
- [ ] Test config creation, updates, encryption/decryption
- [ ] Document config structure

---

### 2.2 Database Layer (SQLite)

**Objective:** Set up SQLite with complete schema and migration system

**Files:**
- `backend/src/db/database.ts` - Database initialization
- `backend/src/db/schema.ts` - Create tables
- `backend/src/db/queries.ts` - Common queries

**Schema Creation:**

1. **projects table:**
   ```sql
   CREATE TABLE projects (
     id TEXT PRIMARY KEY,
     type TEXT NOT NULL CHECK(type IN ('project','blog','experience','education','certification')),
     source TEXT NOT NULL,
     title TEXT NOT NULL,
     summary TEXT NOT NULL,
     content TEXT,
     url TEXT,
     date TEXT NOT NULL,
     featured BOOLEAN DEFAULT 0,
     indexed_at TEXT NOT NULL,
     chunk_count INTEGER NOT NULL,
     metadata JSON,
     created_at TEXT DEFAULT CURRENT_TIMESTAMP
   );
   ```

2. **tags table:**
   ```sql
   CREATE TABLE tags (
     id INTEGER PRIMARY KEY AUTOINCREMENT,
     name TEXT UNIQUE NOT NULL
   );
   ```

3. **project_tags junction:**
   ```sql
   CREATE TABLE project_tags (
     project_id TEXT NOT NULL,
     tag_id INTEGER NOT NULL,
     PRIMARY KEY (project_id, tag_id),
     FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
     FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
   );
   ```

4. **analytics_events table:**
   ```sql
   CREATE TABLE analytics_events (
     id INTEGER PRIMARY KEY AUTOINCREMENT,
     event_type TEXT NOT NULL,
     session_id TEXT,
     query TEXT,
     sources_retrieved INTEGER,
     sources_used INTEGER,
     response_tokens INTEGER,
     response_time_ms INTEGER,
     timestamp TEXT NOT NULL
   );
   ```

5. **audit_log table:**
   ```sql
   CREATE TABLE audit_log (
     id INTEGER PRIMARY KEY AUTOINCREMENT,
     action TEXT NOT NULL,
     item_id TEXT,
     user_id TEXT,
     details JSON,
     timestamp TEXT NOT NULL
   );
   ```

6. **dead_letter_queue table:**
   ```sql
   CREATE TABLE dead_letter_queue (
     id INTEGER PRIMARY KEY AUTOINCREMENT,
     webhook_id TEXT NOT NULL,
     item_data JSON NOT NULL,
     error TEXT NOT NULL,
     retries INTEGER DEFAULT 0,
     created_at TEXT NOT NULL,
     last_retry_at TEXT
   );
   ```

**Indexes:**
- All indexes as specified in PRD Section 6.2

**Tasks:**
- [ ] Initialize SQLite database
- [ ] Create all 6 tables with proper constraints
- [ ] Add all indexes
- [ ] Create Database class with query helpers
- [ ] Implement migrations system
- [ ] Test schema creation

---

### 2.3 Qdrant Integration

**Objective:** Set up Qdrant client and collection configuration

**Files:**
- `backend/src/vector-db/qdrant-client.ts` - Qdrant wrapper

**Collection Configuration:**
```typescript
{
  collection_name: "portfolio_content",
  vectors: {
    size: 1536,
    distance: "Cosine"
  },
  payload_schema: {
    type: {
      type: "keyword",
      indexed: true
    },
    source: {
      type: "keyword",
      indexed: true
    },
    tags: {
      type: "keyword",
      indexed: true,
      is_array: true
    },
    date: {
      type: "datetime",
      indexed: true
    }
  }
}
```

**QdrantClient Methods:**
```typescript
class QdrantClient {
  connect(): Promise<void>
  ensureCollection(): Promise<void>
  upsert(vectors: UpsertPayload[]): Promise<void>
  search(vector: number[], filter: Filter, limit: number, score_threshold: number): Promise<SearchResult[]>
  delete(filter: Filter): Promise<void>
  getCollectionSize(): Promise<number>
  healthCheck(): Promise<HealthStatus>
}
```

**Tasks:**
- [ ] Create Qdrant client wrapper
- [ ] Implement collection creation with proper config
- [ ] Implement upsert, search, delete methods
- [ ] Add filtering support (type, source, tags, date)
- [ ] Implement health check
- [ ] Test connection and operations

---

## Phase 3: Core Services (Advanced)

### 3.1 Service Layer

**Objective:** Create all core services for business logic

**Files:**
- `backend/src/services/embedder.ts` - Text chunking + OpenAI embeddings
- `backend/src/services/retriever.ts` - Vector search + reranking
- `backend/src/services/generator.ts` - LLM streaming responses
- `backend/src/services/memory.ts` - Session management
- `backend/src/services/deduplicator.ts` - Content deduplication
- `backend/src/services/resume-parser.ts` - PDF parsing + GPT-4 extraction
- `backend/src/services/adapters/` - GitHub, Medium adapters

**3.1.1 Embedder Service**

Methods:
```typescript
class EmbedderService {
  // Chunk text into overlapping segments
  chunk(text: string, chunkSize: number = 512, overlap: number = 50): string[]
  
  // Generate embeddings for text chunks
  embed(texts: string[]): Promise<number[][]>
  
  // Single text embedding
  embedText(text: string): Promise<number[]>
}
```

**3.1.2 Retriever Service**

Methods:
```typescript
class RetrieverService {
  // Vector search with optional filtering
  search(
    vector: number[],
    topK: number = 5,
    filters?: SearchFilters
  ): Promise<SearchResult[]>
  
  // Rerank results with recency boost
  rerank(results: SearchResult[], boostDecay: number = 0.1): SearchResult[]
  
  // Apply recency scoring
  applyRecencyBoost(result: SearchResult, boostMultiplier: number): SearchResult
}
```

**3.1.3 Generator Service**

Methods:
```typescript
class GeneratorService {
  // Build system prompt from config
  buildSystemPrompt(config: Config): string
  
  // Build context from retrieved sources
  buildContext(sources: SearchResult[], conversationHistory: Message[]): string
  
  // Stream chat response via OpenAI
  generateStreamingResponse(
    query: string,
    context: string,
    onToken: (token: string) => void
  ): Promise<{ response: string; tokens: number }>
}
```

**3.1.4 Memory Service**

Methods:
```typescript
class MemoryService {
  // Create or retrieve session
  getOrCreateSession(sessionId?: string): Session
  
  // Add message to session
  addMessage(sessionId: string, role: "user" | "assistant", content: string): void
  
  // Get recent messages (last 5 turns)
  getRecentMessages(sessionId: string, limit: number = 10): Message[]
  
  // Cleanup old sessions (background job)
  cleanupOldSessions(maxAgeMinutes: number = 60): void
}
```

**3.1.5 Deduplicator Service**

Methods:
```typescript
class DeduplicatorService {
  // Check for duplicate content
  findDuplicate(newItem: PortfolioItem, threshold: number = 0.85): PortfolioItem | null
  
  // Levenshtein distance for title similarity
  calculateSimilarity(title1: string, title2: string): number
  
  // Merge items based on priority
  mergeItems(existing: PortfolioItem, newItem: PortfolioItem): PortfolioItem
}
```

Source priority: `github (4) > manual (3) > resume (2) > medium (1)`

**3.1.6 Resume Parser Service**

Methods:
```typescript
class ResumeParserService {
  // Extract text from PDF
  extractText(buffer: Buffer): Promise<string>
  
  // Use GPT-4 to parse resume structure
  parseResume(text: string): Promise<ParsedResume>
  
  // Transform to PortfolioItems
  transformToItems(parsed: ParsedResume): PortfolioItem[]
}
```

**3.1.7 Adapter System**

Base Adapter Interface:
```typescript
interface IAdapter {
  connect(config: any): Promise<void>
  fetch(): Promise<PortfolioItem[]>
  testConnection(): Promise<boolean>
}
```

GitHub Adapter:
- Connect via GitHub API
- Fetch repos, READMEs, metadata
- Handle public/private/selected repos
- Extract tech stack from package.json

Medium Adapter:
- Parse RSS feed
- Extract articles
- Generate summaries via GPT-4
- Track last sync date

**Tasks:**
- [ ] Create EmbedderService with chunking + embeddings
- [ ] Create RetrieverService with search + reranking
- [ ] Create GeneratorService with prompt building + streaming
- [ ] Create MemoryService with session management
- [ ] Create DeduplicatorService with similarity checking
- [ ] Create ResumeParserService with PDF + GPT-4 parsing
- [ ] Create GitHub adapter
- [ ] Create Medium adapter
- [ ] Test all services with mock data

---

## Phase 4: Onboarding System

### 4.1 Onboarding Routes

**Objective:** Implement all 5 onboarding steps

**Files:**
- `backend/src/routes/onboarding.ts`
- `backend/src/handlers/onboarding/`
  - `step1-profile.ts`
  - `step2-resume.ts`
  - `step3-sources.ts`
  - `step4-persona.ts`
  - `step5-deploy.ts`

**4.1.1 Step 1: Basic Profile**

Endpoint: `POST /api/onboarding/start`

Request:
```typescript
{
  full_name: string,
  bio: string,
  location?: string,
  timezone?: string,
  email: string,
  profile_image?: string
}
```

Response:
```typescript
{
  success: true,
  user_id: string,
  next_step: "resume",
  session_token: string
}
```

Processing:
- Validate with Zod
- Generate UUID v4 user_id
- Initialize config.json
- Create empty Qdrant collection
- Initialize SQLite database
- Generate JWT token (30-day)
- Return session_token

**4.1.2 Step 2: Resume Upload & Parsing**

Endpoint: `POST /api/onboarding/resume` (multipart)

Request:
```typescript
- file: PDF or DOCX (max 10MB)
- Authorization: Bearer {session_token}
```

Sub-endpoints:
- `GET /api/onboarding/resume/parsed` - Get parsed data for review
- `POST /api/onboarding/resume/confirm` - Confirm and index

Processing:
- Extract text via pdf-parse
- Send to GPT-4 with extraction schema
- Return parsed structure for user review
- On confirm: transform to PortfolioItems, chunk, embed, upsert

Response:
```typescript
{
  success: true,
  indexed_count: number,
  breakdown: { projects, experiences, education, certifications },
  collection_size: number,
  next_step: "sources"
}
```

**4.1.3 Step 3: Connect Data Sources**

Endpoint: `POST /api/onboarding/sources`

Request:
```typescript
{
  sources: {
    github?: {
      username: string,
      access_token?: string,
      include_repos: "all" | "public" | "selected",
      selected_repos?: string[],
      auto_sync: boolean,
      sync_trigger: "push" | "daily" | "weekly"
    },
    medium?: {
      username: string,
      custom_domain?: string,
      auto_sync: boolean,
      check_interval: "6h" | "12h" | "24h"
    },
    linkedin?: {
      profile_url: string,
      sync_mode: "manual"
    }
  }
}
```

Processing:
- Test each source connection
- Fetch content via adapters
- Run deduplication
- Bulk index to Qdrant
- Save config

Response:
```typescript
{
  success: true,
  sources_connected: { github: status, medium: status, ... },
  total_items: number,
  collection_size: number,
  next_step: "persona"
}
```

**4.1.4 Step 4: AI Persona**

Endpoint: `POST /api/onboarding/persona`

Request:
```typescript
{
  persona: {
    tone: "professional" | "casual" | "technical" | "friendly",
    verbosity: "concise" | "balanced" | "detailed",
    formality: "formal" | "neutral" | "informal",
    preferences: {
      cite_sources: boolean,
      show_confidence: boolean,
      ask_clarifying_questions: boolean,
      suggest_related_content: boolean
    },
    custom_instructions?: string
  }
}
```

Processing:
- Generate comprehensive system prompt
- Include user bio + projects + tech stack
- Apply communication style settings
- Save to config
- Calculate estimated tokens

Response:
```typescript
{
  success: true,
  persona_configured: true,
  system_prompt_preview: string,
  estimated_tokens: number,
  next_step: "deploy"
}
```

**4.1.5 Step 5: Deployment Configuration**

Endpoint: `POST /api/onboarding/deploy`

Request:
```typescript
{
  deployment: {
    public_url: string,
    admin_email: string,
    notifications: {
      email: boolean,
      telegram?: { enabled, bot_token, chat_id },
      discord?: { enabled, webhook_url }
    },
    analytics: {
      enable_telemetry: boolean,
      track_queries: boolean,
      log_level: "error" | "warn" | "info" | "debug"
    }
  }
}
```

Processing:
- Test notification channels
- Finalize config
- Mark setup_completed = true
- Generate n8n workflow templates
- Return access info

Response:
```typescript
{
  success: true,
  setup_complete: true,
  access_info: { api_url, chat_endpoint, webhook_endpoint },
  downloads: { github_sync, medium_sync, notification }
}
```

**Tasks:**
- [ ] Create POST /api/onboarding/start endpoint
- [ ] Create POST /api/onboarding/resume endpoint with parsing
- [ ] Create GET /api/onboarding/resume/parsed endpoint
- [ ] Create POST /api/onboarding/resume/confirm endpoint
- [ ] Create POST /api/onboarding/sources endpoint
- [ ] Create POST /api/onboarding/persona endpoint
- [ ] Create POST /api/onboarding/deploy endpoint
- [ ] Test complete onboarding flow

---

## Phase 5: Chat & Retrieval System

### 5.1 Chat Endpoint

**Objective:** Implement full RAG chat with mandatory memory

**File:** `backend/src/routes/chat.ts`

Endpoint: `POST /api/chat/ask`

**10-Step Processing Pipeline:**

1. **Session Management** - Create or retrieve session
2. **Query Preprocessing** - Expand abbreviations, detect intent
3. **Generate Embedding** - Call OpenAI embeddings
4. **Vector Search** - Qdrant search with filters
5. **Reranking** - Apply recency boost
6. **Build Context** - Format sources + history
7. **Inject History** - Add recent conversation
8. **Stream Response** - Call OpenAI with streaming
9. **Stream via SSE** - Send events to client
10. **Update Session** - Store conversation

**Request:**
```typescript
{
  query: string,
  session_id?: string,
  filters?: {
    types?: string[],
    tags?: string[],
    date_range?: { from, to }
  },
  options?: {
    top_k?: number,
    stream?: boolean,
    include_debug?: boolean
  }
}
```

**Response (SSE Stream):**
```
event: sources
data: [{ id, type, title, url, score }, ...]

event: token
data: { delta: { content: "token text" } }

event: done
data: { total_tokens: 45, response_time_ms: 1234, session_id: "uuid" }
```

**Session Storage:**
```typescript
interface Session {
  id: string (UUID),
  messages: Message[],
  created_at: Date,
  last_active: Date
}

interface Message {
  role: "user" | "assistant",
  content: string,
  timestamp: Date
}
```

**Rate Limiting (P0):**
- 10 req/min per IP
- 100 req/day per IP
- 5 violations = 24h ban
- Daily OpenAI token budget tracking

**Error Handling (P0):**
- OpenAI rate limit: retry 3x with exponential backoff
- Qdrant unavailable: return 503
- Timeout: return 504 after 30s
- Other errors: log with Pino, return 500

**Tasks:**
- [ ] Implement session management (create/retrieve)
- [ ] Implement query preprocessing
- [ ] Implement embedding generation
- [ ] Implement vector search with filtering
- [ ] Implement reranking with recency boost
- [ ] Implement context building
- [ ] Implement streaming response
- [ ] Implement SSE event streaming
- [ ] Implement session analytics logging
- [ ] Add rate limiting
- [ ] Add error handling + retries
- [ ] Test chat flow end-to-end

---

## Phase 6: Admin Dashboard API

### 6.1 Admin Routes

**Objective:** Build all management endpoints

**File:** `backend/src/routes/admin.ts`

**6.1.1 Manual Content Upload**

Endpoint: `POST /api/admin/projects` (authenticated)

Request:
```typescript
{
  title: string,
  description: string,
  content?: string,
  tech_stack: string[],
  links: { github?, demo?, live?, blog?, video?, other? },
  date: string (YYYY-MM-DD),
  category: "hackathon" | "client" | "personal" | "open-source",
  featured?: boolean,
  images?: string[],
  achievements?: string[],
  team_size?: number
}
```

Processing:
- Validate with Zod
- Check for duplicates (90% similarity)
- If duplicate: return 409 with similar items
- Transform to PortfolioItem
- Chunk + embed + upsert
- Store in SQLite

Response:
```typescript
{
  success: true,
  project_id: string,
  indexed: true,
  chunk_count: number,
  collection_size: number,
  viewable_at: string
}
```

Similar endpoint: `POST /api/admin/blogs`

**6.1.2 Content Management**

Endpoint: `GET /api/admin/content` (authenticated)

Query parameters:
```
type: filter by type
source: filter by source
page: page number
limit: items per page (max 100)
sort: date | title | chunks
order: asc | desc
search: keyword search
```

Response:
```typescript
{
  items: PortfolioItem[],
  pagination: { page, limit, total, total_pages },
  stats: {
    total_items: number,
    by_type: {},
    by_source: {},
    total_chunks: number,
    collection_size_mb: number
  }
}
```

Endpoint: `DELETE /api/admin/content/:id` (authenticated)

- Delete from Qdrant
- Delete from SQLite
- Audit log

Endpoint: `PUT /api/admin/projects/:id` (authenticated)

- Merge updates
- Check if content changed
- If changed: re-chunk + re-embed
- Update timestamps

**6.1.3 Settings Management**

Endpoint: `PATCH /api/admin/settings` (authenticated)

Request:
```typescript
{
  path: string,  // "ai.persona.tone"
  value: any
}
```

Processing:
- Validate path
- Validate value type
- Update config via ConfigManager
- Trigger side effects (regenerate prompts, etc.)
- Audit log

Response:
```typescript
{
  success: true,
  updated_path: string,
  old_value: any,
  new_value: any,
  side_effects: string[]
}
```

**6.1.4 System Status Dashboard**

Endpoint: `GET /api/admin/status` (authenticated)

Response:
```typescript
{
  system: {
    version: string,
    uptime_seconds: number,
    uptime_human: string,
    setup_completed_at: string,
    environment: string
  },
  services: {
    qdrant: { status, url, latency_ms, collection_size, ... },
    openai: { status, latency_ms, models_available, daily_requests, ... },
    sqlite: { status, database_size_mb, total_records }
  },
  data_sources: {
    github: { enabled, last_sync, items_indexed, sync_status },
    medium: { enabled, last_sync, items_indexed, sync_status },
    ...
  },
  analytics: {
    last_24h: { total_queries, unique_sessions, avg_response_time_ms, ... },
    last_7d: { total_queries, unique_sessions, avg_queries_per_session },
    recent_errors: [...]
  },
  storage: { config_size_kb, logs_size_mb, total_disk_used_mb },
  rate_limits: { chat_endpoint: {...}, banned_ips: number }
}
```

**Tasks:**
- [ ] Create POST /api/admin/projects endpoint
- [ ] Create POST /api/admin/blogs endpoint
- [ ] Create GET /api/admin/content endpoint
- [ ] Create DELETE /api/admin/content/:id endpoint
- [ ] Create PUT /api/admin/projects/:id endpoint
- [ ] Create PATCH /api/admin/settings endpoint
- [ ] Create GET /api/admin/status endpoint
- [ ] Add JWT authentication to all admin routes
- [ ] Test all admin endpoints

---

## Phase 7: Webhook System

### 7.1 Webhook Ingestion

**Objective:** Implement n8n automation webhooks

**File:** `backend/src/routes/webhooks.ts`

Endpoint: `POST /api/webhooks/ingest`

**Authentication Methods:**

Option 1: HMAC Signature
```
Header: X-Webhook-Signature
Process: HMAC-SHA256 with WEBHOOK_SECRET
Verify: crypto.timingSafeEqual comparison
```

Option 2: Bearer Token
```
Header: Authorization: Bearer {WEBHOOK_TOKEN}
Process: String comparison
```

**Request:**
```typescript
{
  webhook_id: string,
  source: "github" | "medium" | "linkedin" | "custom",
  action: "create" | "update" | "delete",
  items: [
    {
      id: string,
      type: "project" | "blog" | "post",
      title: string,
      content: string,
      summary?: string,
      tags: string[],
      date: string,
      url: string,
      metadata?: object,
      previous_hash?: string
    }
  ]
}
```

**Processing (for each item):**

1. **Create action:**
   - Check duplicates (90% similarity)
   - If duplicate: return "skipped"
   - If unique: chunk + embed + upsert
   - Store in SQLite

2. **Update action (P1):**
   - Fetch existing item
   - If previous_hash provided: compare
   - If no changes: skip
   - If changed: delete old chunks, re-chunk/re-embed

3. **Delete action:**
   - Delete from Qdrant (filter by ID)
   - Delete from SQLite

**Error Handling (P0):**
- Use Promise.allSettled (don't fail batch)
- Add failed items to dead letter queue
- Retry every 5 minutes, max 3 attempts
- Notify admin after 3 failures

**Response:**
```typescript
{
  success: true,
  webhook_id: string,
  processed: number,
  results: {
    indexed: number,
    updated: number,
    deleted: number,
    skipped: number,
    failed: number
  },
  details: [
    { id, status, chunks?, reason?, error? }
  ],
  collection_size: number,
  timestamp: string
}
```

**Dead Letter Queue:**
- SQLite table with retry tracking
- Background job every 5 minutes
- Notify admin if webhook_id + max retries exceeded

**Tasks:**
- [ ] Create webhook authentication (HMAC + Bearer)
- [ ] Implement create/update/delete processing
- [ ] Implement batch processing with Promise.allSettled
- [ ] Implement dead letter queue with retries
- [ ] Create background retry job
- [ ] Add webhook notifications (Telegram/Discord)
- [ ] Test webhook end-to-end

---

## Phase 8: Security & Observability

### 8.1 Security Layer

**File:** `backend/src/middleware/`

**JWT Authentication:**
- @fastify/jwt plugin
- httpOnly cookies
- 30-day expiry
- Route decorator for protected endpoints

**CORS Configuration:**
- origin: config.deployment.public_url
- credentials: true
- methods: GET, POST, PUT, DELETE, PATCH

**Input Validation:**
- Zod schemas for all requests
- Field-specific error messages
- Return 400 on validation failure

**Webhook Security:**
- HMAC signature verification
- Bearer token verification
- Timing-safe comparison

**Tasks:**
- [ ] Implement JWT authentication middleware
- [ ] Configure CORS with config-driven origin
- [ ] Add Zod validation to all routes
- [ ] Implement webhook signature verification
- [ ] Add rate limiting middleware
- [ ] Test security measures

### 8.2 Observability & Logging

**File:** `backend/src/middleware/`

**Logging (Pino):**
- Structured JSON logs in production
- Pretty-print in development
- Request ID tracking
- Performance tracking

**Analytics Events:**
- Log every chat query
- Track sources retrieved and used
- Response time metrics
- Session tracking

**Audit Logging:**
- Content management actions (upload, delete, update)
- Admin settings changes
- User actions with timestamps

**Error Tracking:**
- Dead letter queue for webhook failures
- Failed embedding requests
- OpenAI rate limit hits
- Timeout events

**Health Monitoring:**
- Service health checks (Qdrant, OpenAI, SQLite)
- Collection size tracking
- Token usage tracking
- Error rate monitoring

**Tasks:**
- [ ] Configure Pino logger
- [ ] Add request logging middleware
- [ ] Implement analytics event tracking
- [ ] Implement audit logging
- [ ] Add error tracking
- [ ] Create monitoring queries
- [ ] Test logging + analytics

---

## Phase 9: Deployment & Documentation

### 9.1 Docker & Deployment

**File:** `docker-compose.yml`

Services:
```yaml
services:
  backend:
    build: ./backend
    ports: 3000:3000
    environment: NODE_ENV, PORT, OPENAI_API_KEY, JWT_SECRET, ...
    volumes: ./data:/data, ./logs:/app/logs
    depends_on: qdrant
    healthcheck: curl -f http://localhost:3000/health

  qdrant:
    image: qdrant/qdrant:latest
    ports: 6333:6333, 6334:6334
    volumes: qdrant-data:/qdrant/storage
    healthcheck: curl -f http://localhost:6333/health

volumes:
  qdrant-data

networks:
  portfolio-net (bridge)
```

**.env.example:**
```
NODE_ENV=development
PORT=3000
OPENAI_API_KEY=sk-...
JWT_SECRET=your-secret-key-here
WEBHOOK_SECRET=your-webhook-secret
MASTER_SECRET=your-master-secret-for-encryption
QDRANT_URL=http://qdrant:6333
QDRANT_API_KEY=optional
TELEGRAM_BOT_TOKEN=optional
DISCORD_WEBHOOK_URL=optional
LOG_LEVEL=info
```

**Quick Start:**
```bash
git clone ...
cd portfolio-os
cp .env.example .env
nano .env  # edit variables
docker-compose up -d
curl http://localhost:3000/health
```

**nginx-example.conf:**
- Reverse proxy to localhost:3000
- SSL configuration template
- Rate limiting

**Tasks:**
- [ ] Create docker-compose.yml
- [ ] Create Dockerfile
- [ ] Create .env.example
- [ ] Create nginx-example.conf
- [ ] Test Docker deployment

### 9.2 Documentation

**File:** `docs/API.md`

Complete API reference with:
- All endpoints
- Request/response examples
- Error codes
- Authentication
- Rate limits

**File:** `docs/SETUP.md`

Setup guide with:
- Quick start (5 steps)
- System requirements
- Environment variables
- Troubleshooting
- Optional: n8n setup

**File:** `docs/CONFIGURATION.md`

Configuration reference:
- config.json structure
- All settings explained
- Examples for each section
- How to update settings

**File:** `docs/WEBHOOKS.md`

Webhook documentation:
- HMAC signature generation
- n8n workflow setup
- Payload examples
- Error handling
- Dead letter queue

**File:** `README.md`

Project overview:
- What is Portfolio OS
- Key features
- Quick start (3 commands)
- Architecture diagram (ASCII)
- Links to other docs
- Contributing guide

**Tasks:**
- [ ] Write API.md
- [ ] Write SETUP.md
- [ ] Write CONFIGURATION.md
- [ ] Write WEBHOOKS.md
- [ ] Write comprehensive README.md
- [ ] Create examples directory with sample requests

---

## Phase 10: Testing & Polish

### 10.1 Testing Strategy

**Unit Tests:**
- Test each service independently
- Mock external dependencies (OpenAI, Qdrant)
- Coverage: >80%

**Integration Tests:**
- Test onboarding flow end-to-end
- Test chat query flow
- Test webhook ingestion
- Test admin endpoints

**Performance Tests:**
- Measure chat response time (target: <3s p95)
- Measure embedding generation (target: <200ms)
- Measure vector search (target: <50ms)
- Load test: 100 concurrent requests

**Security Tests:**
- JWT token validation
- CORS headers verification
- Input validation fuzzing
- HMAC signature verification
- SQL injection attempts

**Tasks:**
- [ ] Set up Jest testing framework
- [ ] Write unit tests for services
- [ ] Write integration tests
- [ ] Write performance tests
- [ ] Write security tests
- [ ] Achieve >80% coverage
- [ ] Run full test suite

### 10.2 Bug Fixes & Polish

**Tasks:**
- [ ] Fix any identified bugs
- [ ] Optimize database queries
- [ ] Optimize OpenAI API usage
- [ ] Clean up error messages
- [ ] Improve logging
- [ ] Final security review
- [ ] Final performance review

### 10.3 Release

**Tasks:**
- [ ] Tag v1.0.0 release
- [ ] Create CHANGELOG.md
- [ ] Publish to GitHub
- [ ] Create release notes
- [ ] Document known limitations
- [ ] Create roadmap for v1.1

---

## Implementation Checklist

### Phase 1: Foundation ✓
- [ ] Project structure
- [ ] Dependencies installed
- [ ] Fastify app initialized
- [ ] Config system implemented
- [ ] SQLite database initialized
- [ ] Qdrant integration

### Phase 2: Core Services ✓
- [ ] Embedder service
- [ ] Retriever service
- [ ] Generator service
- [ ] Memory service
- [ ] Deduplicator service
- [ ] Resume parser service
- [ ] GitHub adapter
- [ ] Medium adapter

### Phase 3: Onboarding ✓
- [ ] Step 1: Profile setup
- [ ] Step 2: Resume parsing
- [ ] Step 3: Data sources
- [ ] Step 4: AI persona
- [ ] Step 5: Deployment config

### Phase 4: Chat & Retrieval ✓
- [ ] Chat endpoint
- [ ] Session management
- [ ] Rate limiting
- [ ] Error handling

### Phase 5: Admin Dashboard ✓
- [ ] Manual content upload
- [ ] Content management
- [ ] Settings management
- [ ] System status dashboard

### Phase 6: Webhooks ✓
- [ ] Webhook authentication
- [ ] Batch processing
- [ ] Dead letter queue
- [ ] Retry logic

### Phase 7: Security ✓
- [ ] JWT authentication
- [ ] CORS configuration
- [ ] Input validation
- [ ] Webhook security

### Phase 8: Observability ✓
- [ ] Logging setup
- [ ] Analytics tracking
- [ ] Audit logging
- [ ] Error tracking

### Phase 9: Deployment ✓
- [ ] Docker compose
- [ ] Environment configuration
- [ ] Documentation

### Phase 10: Testing & Release ✓
- [ ] Unit tests
- [ ] Integration tests
- [ ] Performance tests
- [ ] Security tests
- [ ] Bug fixes
- [ ] v1.0.0 release

---

## Key Success Metrics

- **Onboarding:** < 15 minutes
- **Chat response:** < 3 seconds (p95)
- **First token latency:** < 700ms
- **Vector search:** < 50ms
- **Embedding gen:** < 200ms
- **Uptime:** 99.5%
- **API availability:** 99.9%
- **Test coverage:** > 80%

---

## Risk Mitigation

| Risk | Mitigation |
|------|-----------|
| OpenAI rate limits | Token budget tracking, retry logic, fallback |
| Qdrant downtime | Health checks, graceful degradation, detailed errors |
| Data corruption | Atomic config writes, SQLite backups, audit trail |
| Memory leaks | Session cleanup (1h expiry), proper stream handling |
| Large imports | Batch processing, chunking, progress tracking |
| Security issues | Input validation, HMAC verification, JWT expiry |

---

## Next Steps

1. ✅ Review this implementation plan
2. ⏳ Start Phase 1: Foundation (Project setup)
3. ⏳ Complete all 10 phases systematically
4. ⏳ Testing on real data
5. ⏳ v1.0.0 release

---

**Last Updated:** November 8, 2025  
**Status:** Ready to Start Implementation
