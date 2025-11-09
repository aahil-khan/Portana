# PORTFOLIO OS - PRODUCT REQUIREMENTS DOCUMENT

**Version:** 1.0.0  
**Last Updated:** November 8, 2025  
**Status:** Ready for Implementation

---

## SECTION 1: EXECUTIVE SUMMARY

### 1.1 Overview

Portfolio OS is an open-source, AI-powered portfolio platform that transforms static portfolios into intelligent, conversational systems using RAG (Retrieval-Augmented Generation). Users complete a one-time intelligent onboarding wizard and the system maintains itself automatically through optional n8n automation workflows.

### 1.2 Core Value Proposition

- Zero-touch maintenance: Setup once, system updates automatically forever
- Clone-and-deploy: Any developer can deploy in under 10 minutes
- Configuration-driven: All behavior controlled via config.json, no code changes needed
- Modular architecture: Pluggable data source adapters, extensible design
- Privacy-first: Fully self-hosted, user owns all data
- Frontend-agnostic: Pure backend API, users build any UI they want

### 1.3 Target Users

- Developers, designers, freelancers seeking intelligent portfolio systems
- Open-source contributors wanting a showcase platform
- Technical users comfortable with Docker and API configuration

### 1.4 Key Differentiators

- Intelligent resume parsing with GPT-4 extraction
- Mandatory conversational memory for multi-turn interactions
- Automatic content deduplication across sources
- Production-ready rate limiting and error handling
- Comprehensive webhook system for automation

### 1.5 What's Out of Scope

- No frontend included - pure backend/API project
- No SSL/domain handling - user manages reverse proxy separately
- No n8n deployment - user installs n8n separately and connects via webhooks
- Users responsible for: Nginx/Caddy setup, SSL certificates, domain DNS

---

## SECTION 2: PRODUCT VISION

### 2.1 Problem Statement

Traditional portfolios are static, difficult to maintain, and provide no interactive experience. Updating them requires manual code changes every time you publish new work. Visitors can't easily explore or ask questions about your experience.

### 2.2 Solution

A self-maintaining portfolio system that:

- Parses your resume intelligently to extract structured data
- Connects to GitHub, Medium, LinkedIn to auto-index your work
- Powers a conversational AI that answers questions about your experience
- Updates automatically via webhooks when you publish new content
- Requires zero code changes after initial setup

### 2.3 Success Criteria

- Onboarding completion in under 15 minutes
- Sub-3 second response times for 95% of queries
- First token latency under 700ms
- Zero manual updates needed for 6+ months
- 50+ GitHub stars within first month of launch

---

## SECTION 3: SYSTEM ARCHITECTURE

### 3.1 Component Responsibilities

API Layer:

Request validation and authentication

Route handling and business logic orchestration

Response formatting (JSON, SSE streams)

Core Engine:

Retrieval Service: Vector search, filtering, reranking

Generator Service: LLM prompt construction and streaming

Embedder Service: Text chunking and embedding generation

Memory Service: Conversation session management (mandatory)

Adapter Layer:

Standardized interface for all data sources

Source-specific fetch and normalization logic

Change detection and deduplication

Storage Layer:

Qdrant: Vector embeddings with metadata payloads (single collection)

SQLite: Structured metadata and admin dashboard data

Config Manager: Persistent configuration with encryption

## SECTION 4: TECHNOLOGY STACK

### 4.1 Core Technologies

API Framework: Fastify 4.x (high performance, TypeScript support)

Language: TypeScript 5.x (type safety, developer experience)

Vector Database: Qdrant latest (native filtering, payload support)

Metadata Store: SQLite 3.x (embedded, zero-config)

LLM Provider: OpenAI 4.x (GPT-4 for chat, text-embedding-3-small)

PDF Parsing: pdf-parse 1.x (resume text extraction)

Validation: Zod 3.x (runtime type validation)

Logging: Pino 9.x (high performance logging)

Containerization: Docker Compose 3.8 (multi-service orchestration)

### 4.2 Required External Services

OpenAI API (embeddings + chat completions)

Qdrant vector database (included in Docker Compose)

### 4.3 Optional External Services

n8n (user's separate instance for automation)

GitHub API (for repo syncing)

Medium RSS (for article syncing)

Telegram Bot API (notifications)

Discord Webhooks (notifications)

## SECTION 5: CORE FEATURES

### 5.1 INTELLIGENT ONBOARDING WIZARD

The onboarding wizard is a 5-step process that extracts, indexes, and configures the entire portfolio system without requiring code.

STEP 1: BASIC PROFILE SETUP

Purpose: Collect essential user information and initialize system

Endpoint: POST /api/onboarding/start

Request Body:

full_name: string (required, 2-50 characters)

bio: string (required, 50-500 characters, 2-3 sentences)

location: string (City, Country)

timezone: string (IANA timezone like "Asia/Kolkata")

email: string (valid email for notifications)

profile_image: string (optional, URL or base64)

Backend Actions:

Validate request with Zod schema

Generate unique user_id (UUID v4)

Create initial config.json at /data/config.json

Initialize empty Qdrant collection 'portfolio_content'

Create SQLite database with schema

Generate admin JWT token (30-day expiry)

Response:

success: true

user_id: generated UUID

next_step: "resume"

session_token: JWT token

Error Handling:

400: Validation errors with field-specific messages

409: User already exists

500: Database initialization failure

STEP 2: RESUME UPLOAD & INTELLIGENT PARSING

Purpose: Extract structured portfolio data from resume using GPT-4

Endpoint: POST /api/onboarding/resume

Request: Multipart form-data with PDF or DOCX file (max 10MB), requires Authorization Bearer token

Processing Pipeline:

Phase 1 - Text Extraction:
Use pdf-parse library to extract text from uploaded PDF

Phase 2 - GPT-4 Structured Extraction:
Send extracted text to GPT-4 with this extraction schema:

personal: name, email, phone, location, linkedin, github

experience: array of (company, role, start_date, end_date, location, description, achievements, tech_stack)

projects: array of (title, description, tech_stack, url, date, highlights, category)

skills: languages, frameworks, tools, databases, cloud

education: array of (degree, institution, field, graduation_date, location, gpa, honors)

certifications: array of (name, issuer, issue_date, credential_id, url)

Model: gpt-4-turbo-preview
Response format: json_object
Temperature: 0.1
Max tokens: 4000

Phase 3 - User Review:
GET /api/onboarding/resume/parsed returns parsed data for frontend to display in editable form

Phase 4 - Confirmation & Indexing:
POST /api/onboarding/resume/confirm with confirmed_data

For each confirmed item:

Transform to PortfolioItem format

Generate unique ID: resume_{type}_{slugified_title}

Chunk content (512 tokens, 50 token overlap)

Generate embeddings via OpenAI

Upsert to Qdrant with metadata

Store structured data in SQLite

Response:

success: true

indexed_count: 16

breakdown: projects, experiences, education, certifications counts

collection_size: total chunks

next_step: "sources"

STEP 3: CONNECT DATA SOURCES

Purpose: Link external accounts and fetch existing content

Endpoint: POST /api/onboarding/sources

Request includes sources object with:

GitHub configuration:

username: string

access_token: string (optional, for private repos)

include_repos: "all" | "public" | "selected"

selected_repos: array of strings (if selected mode)

auto_sync: boolean

sync_trigger: "push" | "daily" | "weekly"

Medium configuration:

username: string

custom_domain: string (optional)

auto_sync: boolean

check_interval: "6h" | "12h" | "24h"

LinkedIn configuration:

profile_url: string

sync_mode: "manual" (scraping is complex)

GitHub Adapter Process:

Test connection via Octokit

Fetch repositories based on filter

For each repo, fetch README from GitHub API

Transform to PortfolioItem format with metadata (stars, forks, language)

Run deduplication check (P1 feature)

Bulk index to Qdrant

Save configuration to config.json

Medium Adapter Process:

Construct RSS URL (custom domain or medium.com/feed/@username)

Parse feed with rss-parser library

Transform articles to PortfolioItems

Run deduplication check

Bulk index to Qdrant

Save configuration

Deduplication Logic (P1 Feature):
For each new item, check for similar items by title (85% similarity threshold using Levenshtein distance)
If found:

Source priority: github (4) > manual (3) > resume (2) > medium (1)

If new item has higher priority: delete old, use new

If existing has higher priority: merge metadata from new into existing, skip new

Response:

success: true

sources_connected: status for each source (github, medium, linkedin)

total_items: count

collection_size: total chunks

next_step: "persona"

STEP 4: CONFIGURE AI PERSONA

Purpose: Customize chatbot tone and behavior

Endpoint: POST /api/onboarding/persona

Request includes persona object:

tone: "professional" | "casual" | "technical" | "friendly"

verbosity: "concise" | "balanced" | "detailed"

formality: "formal" | "neutral" | "informal"

preferences object:

cite_sources: boolean

show_confidence: boolean

ask_clarifying_questions: boolean

suggest_related_content: boolean

custom_instructions: string (optional, additional context)

System Prompt Generation:
The system generates a comprehensive system prompt including:

Your name and bio

Professional background summary

Notable projects list

Technical expertise (languages, frameworks, tools)

Communication style settings

Response guidelines based on preferences

Example verbosity mapping:

concise: keep responses under 150 words

balanced: balanced responses around 100-200 words

detailed: provide comprehensive explanations

Response:

success: true

persona_configured: true

system_prompt_preview: first 200 characters

estimated_tokens: token count

next_step: "deploy"

STEP 5: DEPLOYMENT CONFIGURATION

Purpose: Finalize settings and prepare for launch

Endpoint: POST /api/onboarding/deploy

Request includes deployment object:

public_url: string (for CORS only, NOT SSL setup)

admin_email: string (notification destination)

notifications object:

email: boolean

telegram: (optional) enabled, bot_token, chat_id

discord: (optional) enabled, webhook_url

analytics object:

enable_telemetry: boolean

track_queries: boolean

log_level: "error" | "warn" | "info" | "debug"

Backend Actions:

Validate public URL format

Test notification channels (send test message if configured)

Finalize config.json

Mark setup_completed as true

Generate downloadable n8n workflow templates

Return access information

Response:

success: true

setup_complete: true

access_info: API base URL, chat endpoint, webhook endpoint

downloads: n8n workflow JSON files, nginx config template

next_steps: array of instructions including:

Backend running at localhost:3000

Set up reverse proxy and SSL separately

Optional: Install n8n and import workflows

Test chat endpoint

### 5.2 CHAT SYSTEM WITH MANDATORY MEMORY

Purpose: Accept user queries, retrieve context, generate streaming AI responses with conversation continuity

Endpoint: POST /api/chat/ask

Request Body:

query: string (required, 3-500 characters)

session_id: string (optional, UUID for conversation continuity)

filters: object (optional)

types: array of "project" | "blog" | "experience" | "education"

tags: array of strings

date_range: object with from and to (ISO dates)

options: object (optional)

top_k: number (default 5, max retrieved chunks)

stream: boolean (default true, enable SSE streaming)

include_debug: boolean (admin only, returns debug info)

Processing Pipeline:

Step 1: Session Management (Mandatory)

Every request automatically manages a session:

If session_id provided: retrieve existing session

If no session_id: create new session with UUID

Session structure: id, messages array, created_at, last_active

Update last_active timestamp

Store in global sessions Map (in-memory)

Step 2: Query Preprocessing

Expand common abbreviations:

"exp" becomes "experience"

"NEXT" becomes "Next.js"

"TS" becomes "TypeScript"

Optional: Detect query intent (project_inquiry, tech_stack_question, experience_query, general)

Step 3: Generate Query Embedding

Call OpenAI embeddings API:

Model: text-embedding-3-small

Input: preprocessed query

Returns: 1536-dimensional vector

Step 4: Vector Search with Filtering

Build Qdrant filter based on request:

If types specified: filter by type field

If tags specified: filter by tags array

If date_range specified: filter by date range

Search Qdrant collection 'portfolio_content':

Vector: query embedding

Limit: top_k (default 5)

Filter: constructed filter object

With payload: true (include metadata)

Score threshold: 0.7 (minimum relevance)

Step 5: Reranking

Apply recency boost to search results:

Last 6 months: +20% (multiply score by 1.2)

Last 12 months: +10% (multiply by 1.1)

Last 24 months: no change (multiply by 1.0)

Older: -10% (multiply by 0.9)

Sort by adjusted score, take top 3 chunks for context

Step 6: Build Context

For each top chunk, format as:

Source: title (type)

URL: clickable link

Tags: comma-separated list

Content: actual chunk text

Separate chunks with horizontal line separator

Create sources array with:

id, type, title, url, relevance score

Step 7: Inject Conversation History

If session has previous messages:

Retrieve last 5 messages from session

Format as "Visitor: [question]" and "You: [answer]"

Prepend to context as "Recent Conversation" section

Step 8: Generate Streaming Response

Construct messages array:

System message: config.ai.system_prompt

User message: conversation context + knowledge base context + current query

Call OpenAI chat completions:

Model: config.ai.models.chat (gpt-4-turbo-preview)

Messages: constructed array

Temperature: config.ai.models.temperature (default 0.7)

Max tokens: config.ai.models.max_tokens (default 500)

Stream: true

Step 9: Stream via SSE

Set headers:

Content-Type: text/event-stream

Cache-Control: no-cache

Connection: keep-alive

Send events:

First: sources event with JSON array of source objects

Then: token events with delta object for each chunk

Finally: done event with total_tokens, response_time_ms, session_id

Event format:
event: [type]
data: [JSON string]
[blank line]

Step 10: Update Session

Add two messages to session:

User message: query, timestamp

Assistant message: full response, timestamp

Keep only last 10 messages (5 conversation turns)

Update session in global Map

Step 11: Analytics Logging

Log to analytics table:

type: 'chat_query'

session_id

query text and length

sources_retrieved count

sources_used count

response_tokens estimate

response_time_ms

timestamp

Session Cleanup (Background Job)

Run every 15 minutes:

Calculate cutoff: current time minus 1 hour

Iterate through all sessions

Delete sessions with last_active before cutoff

P0: Rate Limiting

Applied via @fastify/rate-limit plugin:

10 requests per minute per IP

100 requests per day per IP

Ban after 5 violations (24 hour ban)

Custom error response with retry_after

Additional protection:

Daily OpenAI token budget tracking

Alert when 80% of budget consumed

P0: Error Handling

Wrap pipeline in try-catch:

OpenAI rate limit: retry 3 times with exponential backoff

Qdrant unavailable: return 503 SERVICE_UNAVAILABLE

Timeout: return 504 TIMEOUT after 30 seconds

Unexpected errors: log with Pino, return 500 INTERNAL_ERROR

Dead Letter Queue:

Failed embedding requests queued for retry

Max 3 retry attempts

After 3 failures: notify admin, remove from queue

### 5.3 ADMIN DASHBOARD

Purpose: Manage content, settings, and monitor system after onboarding

Authentication: All admin endpoints require JWT in httpOnly cookie

MANUAL CONTENT UPLOAD

Endpoint: POST /api/admin/projects

Request Body:

title: string (required, 3-100 characters)

description: string (required, 50-500 characters)

content: string (optional, full writeup/README)

tech_stack: array of strings (required, at least 1)

links: object (at least one required)

github: string URL (optional)

demo: string URL (optional)

live: string URL (optional)

blog: string URL (optional)

video: string URL (optional)

other: string URL (optional)

date: string (required, YYYY-MM-DD format)

category: "hackathon" | "client" | "personal" | "open-source"

featured: boolean (optional, default false)

images: array of string URLs (optional)

achievements: array of strings (optional)

team_size: number (optional, positive integer)

Validation:
All fields validated with Zod schema
Links object must have at least one URL specified

Processing:

Validate request body

Generate ID: manual_project_{slugified_title}

Check for duplicates (90% title similarity threshold)

If duplicate found: return 409 DUPLICATE_CONTENT with similar items

Transform to PortfolioItem format

Chunk content (512 tokens, 50 overlap)

Generate embeddings

Upsert to Qdrant

Store in SQLite projects table

Response:

success: true

project_id: generated ID

indexed: true

chunk_count: number of chunks created

collection_size: total chunks in collection

viewable_at: endpoint to view this project

Similar Endpoint: POST /api/admin/blogs (same structure for blog posts)

CONTENT MANAGEMENT

List All Content

Endpoint: GET /api/admin/content

Query Parameters:

type: filter by project, blog, experience, education

source: filter by github, medium, manual, resume

page: page number (default 1)

limit: items per page (default 20, max 100)

sort: date, title, or chunks

order: asc or desc

search: keyword search in title/description

Response:

items: array of content objects with:

id, type, source, title, summary, date, url, tags

chunk_count, indexed_at, last_updated, featured

pagination: page, limit, total items, total_pages

stats: object with:

total_items count

by_type breakdown (projects, blogs, experiences, etc)

by_source breakdown (github, medium, resume, manual)

total_chunks count

collection_size_mb

Delete Content

Endpoint: DELETE /api/admin/content/:id

Processing:

Find all chunks in Qdrant with matching ID

Delete from Qdrant using filter (match ID)

Delete from SQLite by ID

If not found: return 404 NOT_FOUND

Log audit action: content_deleted, item_id, deleted_by, deleted_chunks, timestamp

Response:

success: true

deleted_item: ID

chunks_removed: count

collection_size: new total

Update Content

Endpoint: PUT /api/admin/projects/:id

Request: Same as POST, all fields optional

Processing:

Fetch existing item from SQLite

If not found: return 404

Merge updates with existing data

Check if content changed (content or description fields)

If content changed:

Delete old chunks from Qdrant

Re-chunk and re-embed

Upsert new chunks

If only metadata changed: update SQLite only

Update last_updated timestamp

Response:

success: true

updated: true

re_indexed: boolean (true if content changed)

new_chunk_count: number (if re-indexed)

SETTINGS MANAGEMENT

Endpoint: PATCH /api/admin/settings

Request:

path: string (JSON path like "ai.persona.tone")

value: any (new value)

Examples:

Change AI tone: {"path": "ai.persona.tone", "value": "casual"}

Update sync interval: {"path": "data_sources.medium.check_interval", "value": "12h"}

Toggle auto-sync: {"path": "data_sources.github.auto_sync", "value": false}

Update email: {"path": "deployment.admin_email", "value": "new@example.com"}

Processing:

Validate path exists in config schema

Validate value type matches expected type

Update config.json using configManager.update()

Trigger side effects based on path:

Path starts with "ai.persona": regenerate system prompt

Path contains "sync": note to update n8n workflows manually

Path is "deployment.public_url": update CORS configuration

Log configuration change to audit log

Response:

success: true

updated_path: the path that was changed

old_value: previous value

new_value: updated value

side_effects: array of actions taken (e.g., "Regenerated AI system prompt")

SYSTEM STATUS DASHBOARD

Endpoint: GET /api/admin/status

Response Structure:

system object:

version: "1.0.0"

uptime_seconds: total uptime

uptime_human: formatted string like "3d 0h 30m"

setup_completed_at: ISO timestamp

environment: "production" or "development"

services object:

Qdrant:

status: "healthy" or "down"

url: connection URL

latency_ms: last ping time

collection_size: number of points

collection_size_mb: disk space used

last_check: ISO timestamp

OpenAI:

status: "healthy" or "down"

latency_ms: average response time

models_available: array of model names

daily_requests: breakdown by embeddings and chat

daily_tokens_used: total tokens today

estimated_cost_usd: approximate daily cost

last_check: ISO timestamp

SQLite:

status: "healthy"

database_size_mb: disk space

total_records: count of all items

data_sources object:

For each source (github, medium, linkedin, resume):

enabled: boolean

username or profile info

last_sync: ISO timestamp

next_sync: "on_push" or ISO timestamp for scheduled

items_indexed: count

sync_status: "success" or "failed"

last_error: error message if failed

analytics object:

last_24h:

total_queries: count

unique_sessions: count

avg_response_time_ms: average

p95_response_time_ms: 95th percentile

top_topics: array of {topic, count} objects

last_7d:

total_queries: count

unique_sessions: count

avg_queries_per_session: average

recent_errors array:
Each error object:

timestamp: ISO timestamp

source: where error occurred

error: error message

severity: "warning" or "error"

resolved: boolean

resolution: explanation if resolved

storage object:

config_size_kb: config.json file size

logs_size_mb: logs directory size

total_disk_used_mb: sum of all storage

rate_limits object:

chat_endpoint:

per_minute_remaining: count

per_day_remaining: count

banned_ips: count

### 5.4 WEBHOOK SYSTEM

Purpose: Accept content from n8n workflows or manual API calls for auto-indexing

Endpoint: POST /api/webhooks/ingest

Authentication: HMAC signature OR Bearer token

Request Body:

webhook_id: string (identifies the workflow)

source: "github" | "medium" | "linkedin" | "custom"

action: "create" | "update" | "delete" (P1: operation type)

items: array of objects with:

id: string (unique identifier)

type: "project" | "blog" | "post"

title: string

content: string (full text)

summary: string (optional, pre-generated by n8n)

tags: array of strings

date: string (ISO date)

url: string

metadata: object (any additional data)

previous_hash: string (optional, P1: for change detection)

HMAC Signature Validation (Recommended):

Header: X-Webhook-Signature

Process:

Read signature from header

Convert request body to JSON string

Create HMAC using SHA-256 with WEBHOOK_SECRET

Compare signatures using timing-safe comparison

If mismatch: return 401 INVALID_SIGNATURE

Bearer Token Validation (Alternative):

Header: Authorization: Bearer {token}

Process:

Extract token from header

Compare with WEBHOOK_TOKEN environment variable

If mismatch: return 401 INVALID_TOKEN

Processing Logic:

For each item in items array:

Normalize to PortfolioItem format

Handle based on action type:

Action: create

Check for duplicates (90% title similarity)

If duplicate found: return status "skipped" with reason

If unique: chunk + embed + upsert to Qdrant

Store in SQLite

Return status "indexed" with chunk count

Action: update (P1)

Fetch existing item from SQLite

If previous_hash provided: compare with current hash

If no changes: return status "skipped" with reason "no_changes"

If changed: delete old chunks from Qdrant

Re-chunk + re-embed + upsert new chunks

Update SQLite

Return status "updated" with new chunk count

Action: delete

Delete all chunks from Qdrant (filter by ID)

Delete from SQLite

Return status "deleted"

If processing fails:

Log error with Pino

Add to dead letter queue for retry

Return status "failed" with error message

Error Handling (P0):

All items processed with Promise.allSettled (don't fail entire batch)

Dead Letter Queue:

Failed items queued with webhook_id, item data, error, timestamp

Background job retries every 5 minutes

Max 3 retry attempts per item

After 3 failures: notify admin, remove from queue

Response:

success: true

webhook_id: echo back

processed: total count

results: object with counts:

indexed: count

updated: count

deleted: count

skipped: count

failed: count

details: array of result objects for each item:

id, status, chunks (if indexed), reason (if skipped), error (if failed)

collection_size: new total chunks

timestamp: ISO timestamp

Notification (if configured):

If Telegram or Discord notifications enabled:

Send message with summary:

Webhook processed: {webhook_id}

X indexed, Y updated, Z skipped

Warning if any failed

Collection now has N chunks
## SECTION 6: DATA MODELS

### 6.1 Core Entities

PortfolioItem (Universal Format)

Standard interface for all content regardless of source:

id: string (format: source_type_slugifiedtitle)

type: "project" | "blog" | "experience" | "education" | "certification"

source: "github" | "medium" | "resume" | "manual" | "linkedin"

title: string

content: string (full text for embedding)

summary: string (short description, max 200 characters)

tags: array of strings (tech stack, topics)

date: Date (creation or publication date)

url: string (optional, canonical URL)

metadata: object (source-specific fields)

VectorChunk (Qdrant Payload)

Each embedded chunk stored in Qdrant:

id: string (format: chunk_parentid_index)

vector: array of 1536 numbers (embedding)

payload object:

id: parent PortfolioItem ID

type: content type

source: origin source

title: item title

summary: item summary

url: canonical URL

tags: array of tags

date: ISO date string

chunk_text: actual chunked text content

chunk_index: position in document (0-based)

chunk_total: total chunks for this item

metadata: additional fields

ChatSession (In-Memory)

Session structure stored in Map:

id: string (UUID)

messages: array of ChatMessage objects

created_at: Date

last_active: Date

ChatMessage structure:

role: "user" | "assistant"

content: string

timestamp: Date

Config (Persistent JSON)

Complete configuration object structure:

version: string (config schema version)

user object:

id: UUID

full_name, bio, location, timezone, email

profile_image: optional string

data_sources object:

github: enabled, username, access_token (encrypted), include_repos, selected_repos, auto_sync, sync_trigger, last_sync, repos_count

medium: enabled, username, custom_domain, rss_url, auto_sync, check_interval, last_sync, articles_count

linkedin: enabled, profile_url, sync_mode

resume: enabled, last_parsed, items_indexed

ai object:

persona: tone, verbosity, formality, preferences (cite_sources, show_confidence, ask_clarifying_questions, suggest_related_content), custom_instructions

system_prompt: string (generated)

models: embedding, chat, temperature, max_tokens

integrations object:

n8n: webhook_base_url, api_key (encrypted), workflows status map

deployment object:

public_url: string (CORS only)

admin_email: string (notification destination)

notifications: email boolean, telegram, discord

analytics: enable_telemetry, track_queries, log_level

rate_limits object:

chat: per_minute, per_day, daily_token_budget, ban_threshold

error_handling object:

retries: max_attempts, backoff, initial_delay_ms, max_delay_ms

fallbacks: embedding_failure, qdrant_unavailable, openai_rate_limit

dead_letter_queue: enabled, max_age_hours

setup_completed: boolean

setup_completed_at: ISO timestamp (optional)

### 6.2 SQLite Schema

projects table:

id: TEXT PRIMARY KEY

type: TEXT NOT NULL (check: project, blog, experience, education, certification)

source: TEXT NOT NULL

title: TEXT NOT NULL

summary: TEXT NOT NULL

content: TEXT

url: TEXT

date: TEXT NOT NULL (ISO format)

featured: BOOLEAN DEFAULT 0

indexed_at: TEXT NOT NULL

chunk_count: INTEGER NOT NULL

metadata: JSON

Indexes:

idx_projects_type on type

idx_projects_source on source

idx_projects_date on date DESC

idx_projects_featured on featured

tags table:

id: INTEGER PRIMARY KEY AUTOINCREMENT

name: TEXT UNIQUE NOT NULL

Index: idx_tags_name on name

project_tags junction table:

project_id: TEXT NOT NULL

tag_id: INTEGER NOT NULL

PRIMARY KEY (project_id, tag_id)

FOREIGN KEY project_id REFERENCES projects(id) ON DELETE CASCADE

FOREIGN KEY tag_id REFERENCES tags(id) ON DELETE CASCADE

analytics_events table:

id: INTEGER PRIMARY KEY AUTOINCREMENT

event_type: TEXT NOT NULL

session_id: TEXT

query: TEXT

sources_retrieved: INTEGER

sources_used: INTEGER

response_tokens: INTEGER

response_time_ms: INTEGER

timestamp: TEXT NOT NULL

Indexes:

idx_analytics_timestamp on timestamp DESC

idx_analytics_session on session_id

audit_log table:

id: INTEGER PRIMARY KEY AUTOINCREMENT

action: TEXT NOT NULL

item_id: TEXT

user_id: TEXT

details: JSON

timestamp: TEXT NOT NULL

Index: idx_audit_timestamp on timestamp DESC

dead_letter_queue table:

id: INTEGER PRIMARY KEY AUTOINCREMENT

webhook_id: TEXT NOT NULL

item_data: JSON NOT NULL

error: TEXT NOT NULL

retries: INTEGER DEFAULT 0

created_at: TEXT NOT NULL

last_retry_at: TEXT

Index: idx_dlq_retries on retries

### 6.3 Qdrant Collection Configuration

Collection name: portfolio_content

Vector configuration:

Size: 1536 (OpenAI text-embedding-3-small)

Distance: Cosine

Optimizers configuration:

default_segment_number: 2

indexing_threshold: 10000

Payload schema (for filtering):

type: keyword type, indexed

source: keyword type, indexed

tags: keyword type, array, indexed

date: datetime type, indexed

## SECTION 7: SECURITY & AUTHENTICATION

### 7.1 JWT Authentication

Token Generation:

Use @fastify/jwt plugin

Secret: process.env.JWT_SECRET (minimum 32 characters)

Payload: user_id, role (admin)

Expiry: 30 days

Cookie Storage:

Cookie name: "token"

httpOnly: true (not accessible via JavaScript)

secure: true in production

sameSite: "strict"

path: "/"

maxAge: 30 days in seconds

Route Protection:

Decorator: fastify.authenticate

Applied to all /api/admin/* routes

Verifies JWT from cookie

Populates request.user object

Returns 401 AUTHENTICATION_REQUIRED if invalid

### 7.2 CORS Configuration

Applied via @fastify/cors plugin:

origin: config.deployment.public_url

credentials: true

methods: GET, POST, PUT, DELETE, PATCH

allowedHeaders: Content-Type, Authorization

### 7.3 Input Validation

All requests validated with Zod schemas before processing
Example validations:

String length constraints

Email format

URL format

Date format (ISO 8601)

Enum values

Required vs optional fields

Nested object validation

On validation failure:

Return 400 VALIDATION_ERROR

Include field-specific error messages

Do not process request

### 7.4 Webhook Security

HMAC Signature Method (Recommended):

Generation (n8n side):

Create HMAC using SHA-256

Secret: shared WEBHOOK_SECRET

Message: JSON stringified request body

Output: hex digest

Validation (backend):

Read X-Webhook-Signature header

Recreate HMAC with same secret and body

Use crypto.timingSafeEqual for comparison

Reject if signatures don't match

Bearer Token Method (Alternative):

Generation (n8n side):

Include Authorization: Bearer {token} header

Token: shared WEBHOOK_TOKEN

Validation (backend):

Extract token from Authorization header

Compare with WEBHOOK_TOKEN env variable

Reject if tokens don't match

### 7.5 Secrets Management

All sensitive values stored as environment variables:

OPENAI_API_KEY: OpenAI API key

JWT_SECRET: JWT signing secret (32+ chars)

WEBHOOK_SECRET: HMAC signing secret

WEBHOOK_TOKEN: Alternative webhook auth

QDRANT_API_KEY: Qdrant authentication (optional)

Notification tokens: Telegram bot token, Discord webhook URL

In config.json:

Sensitive fields encrypted at rest using AES-256

Encryption key derived from master secret in env

Fields encrypted: access tokens, API keys, bot tokens

## SECTION 8: CONFIGURATION MANAGEMENT

### 8.1 Configuration File Location

Path: /data/config.json (mounted volume in Docker)

Structure: Single JSON file with all settings

Validation: Zod schema validates on load and save

### 8.2 Config Manager Service

Responsibilities:

Load config from disk on startup

Validate with Zod schema

Decrypt sensitive fields

Provide get() method for reading

Provide update() method for partial updates with deep merge

Encrypt sensitive fields before saving

Notify watchers on changes

Handle missing config (create default)

Methods:

load(): reads and validates config.json

save(config): validates, encrypts, writes atomically

update(partial): merges partial into existing, saves

get(): returns current config

watch(callback): subscribe to config changes

pathExists(path): check if JSON path is valid

getTypeForPath(path): return expected type for path

Encryption:

Algorithm: AES-256-GCM

Key: derived from MASTER_SECRET env variable

Fields encrypted: all token and API key fields

Stored: ciphertext with IV and auth tag

Atomic Writes:

Write to temp file first

Rename temp to config.json (atomic operation)

Prevents corruption if process crashes during write

### 8.3 Configuration Updates

Via PATCH /api/admin/settings:

Accept JSON path and new value

Validate path exists

Validate value type

Update config

Trigger side effects

Side Effects:

ai.persona changes: regenerate system_prompt

deployment.public_url change: update CORS

notification settings: test connection

sync settings: note to update n8n workflows

## SECTION 9: DEPLOYMENT

### 9.1 Docker Compose Configuration

Services included:

backend (Fastify API)

qdrant (vector database)

NOT INCLUDED (user manages separately):

n8n (user installs independently)

Nginx/Caddy (user sets up reverse proxy)

SSL certificates (user configures with Let's Encrypt)

docker-compose.yml structure:

version: "3.8"

services:

backend:

build: ./backend

container_name: portfolio-os-backend

ports: "3000:3000"

environment: NODE_ENV, PORT, QDRANT_URL, OPENAI_API_KEY, JWT_SECRET, WEBHOOK_SECRET, CONFIG_PATH

volumes: ./data:/data, ./logs:/app/logs

depends_on: qdrant

restart: unless-stopped

networks: portfolio-net

healthcheck: curl -f http://localhost:3000/health every 30s

qdrant:

image: qdrant/qdrant:latest

container_name: portfolio-os-qdrant

ports: "6333:6333", "6334:6334"

environment: QDRANT__SERVICE__GRPC_PORT=6334

volumes: qdrant-data:/qdrant/storage

restart: unless-stopped

networks: portfolio-net

healthcheck: curl -f http://localhost:6333/health every 30s

volumes:

qdrant-data

networks:

portfolio-net (bridge driver)

### 9.2 Environment Variables

.env file required:

Required variables:

NODE_ENV: production or development

PORT: 3000

OPENAI_API_KEY: sk-...

JWT_SECRET: random 32+ character string

WEBHOOK_SECRET: random string for HMAC

Optional variables:

QDRANT_URL: http://qdrant:6333 (default)

QDRANT_API_KEY: if using authentication

WEBHOOK_TOKEN: alternative to HMAC

TELEGRAM_BOT_TOKEN: for notifications

TELEGRAM_CHAT_ID: for notifications

DISCORD_WEBHOOK_URL: for notifications

LOG_LEVEL: error, warn, info, debug

### 9.3 Quick Start Commands

Step 1: Clone repository
git clone https://github.com/yourname/portfolio-os.git
cd portfolio-os

Step 2: Copy environment template
cp .env.example .env

Step 3: Edit environment variables
nano .env (add your OpenAI API key and secrets)

Step 4: Start all services
docker-compose up -d

Step 5: Check service health
docker-compose ps
docker-compose logs -f backend

Step 6: Access onboarding wizard
Open http://localhost:3000/onboarding in browser

Step 7: Complete setup
Follow 5-step wizard

Step 8: Test endpoints

Chat: curl -X POST http://localhost:3000/api/chat/ask -d '{"query":"test"}'

Status: curl http://localhost:3000/api/admin/status (requires auth cookie)

### 9.4 What Users Must Do Separately

Reverse Proxy Setup:

Install Nginx, Caddy, or Traefik

Configure proxy to forward requests to localhost:3000

Set up SSL with Let's Encrypt or Cloudflare

Point domain DNS to server IP

Example Nginx configuration provided in docs/nginx-example.conf

SSL Certificates:

Use Certbot for Let's Encrypt

Or use Cloudflare proxy

Or upload custom certificates

Domain Configuration:

Update DNS A record to point to server

Set public_url in config to your domain (for CORS)

### 9.5 Health Checks

Endpoint: GET /health

Response:

status: "ok" | "degraded" | "down"

timestamp: ISO timestamp

services: Qdrant status and latency, OpenAI status

version: API version

uptime_seconds: total uptime

Use for:

Docker healthcheck

Load balancer checks

Monitoring systems

## IMPLEMENTATION STATUS

### Phase Completion Summary

**Phase 1: Foundation** ✅ COMPLETE
- TypeScript project setup, Fastify server, basic routing

**Phase 2: Configuration Management** ✅ COMPLETE
- Config manager service, environment variables, config validation

**Phase 3: Database Layer** ✅ COMPLETE
- SQLite schema, repository pattern, migrations

**Phase 4: Qdrant Integration** ✅ COMPLETE
- Vector database setup, embeddings, chunking, search

**Phase 5: Core Services** ✅ COMPLETE
- Retrieval service, generator service, embedder service

**Phase 6: Onboarding Wizard** ✅ COMPLETE
- 5-step profile creation, resume parsing with GPT-4, data source connection

**Phase 7: Chat Endpoint** ✅ COMPLETE
- Streaming API, session management, conversation memory

**Phase 8: Admin API** ✅ COMPLETE (NEW)
- CRUD operations for profiles, projects, analytics
- 14 HTTP endpoints
- Advanced filtering and bulk operations
- Event tracking and metrics

**Status**: 8 of 15 phases complete (53%)

### Phase 8: Admin API Details

**Components Implemented**:
- ProfileAdminService: 8 methods for profile management
- ProjectAdminService: 10 methods with bulk operations
- AnalyticsAdminService: 8 methods for event tracking
- Admin Routes: 14 HTTP endpoints
- Test Suite: 40 comprehensive tests (100% passing)

**File Structure**:
```
src/admin/services/
  ├── profile-admin.ts (128 LOC)
  ├── project-admin.ts (187 LOC)
  ├── analytics-admin.ts (147 LOC)
  └── index.ts (22 LOC)

src/routes/
  └── admin.ts (478 LOC)

tests/
  └── admin.test.ts (450+ LOC)
```

**Test Results**: 40/40 passing ✅
**Build Status**: 0 TypeScript errors ✅
**Total LOC**: 1,825 lines

**Endpoints**:
- POST /api/admin/profiles (create)
- GET /api/admin/profiles (list with filtering)
- GET /api/admin/profiles/:id (read)
- PATCH /api/admin/profiles/:id (update)
- DELETE /api/admin/profiles/:id (delete)
- POST /api/admin/projects (create)
- GET /api/admin/projects (list with advanced filtering)
- GET /api/admin/projects/:id (read)
- PATCH /api/admin/projects/:id (update)
- DELETE /api/admin/projects/:id (delete)
- GET /api/admin/analytics/metrics (summary)
- GET /api/admin/analytics/events (event list)
- POST /api/admin/analytics/events (record)
- GET /api/admin/health (service status)

**Next Phase**: Phase 9 - Webhooks (GitHub sync, Medium ingestion, event processing)

---

## SECTION 10: n8n INTEGRATION

### 10.1 Overview

n8n is a separate service that USERS install and manage independently.

Portfolio OS provides:

Webhook endpoint (/api/webhooks/ingest) for receiving data

Downloadable workflow templates (JSON files)

Documentation on setup

Users provide:

Their own n8n instance (cloud or self-hosted)

Configuration of workflows

Webhook URLs pointing to their backend

Scheduling and triggers

### 10.2 Workflow Templates Provided

After completing onboarding, users can download:

GitHub Sync Workflow (github-sync.json)

Medium RSS Sync Workflow (medium-sync.json)

Notification Workflow (notifications.json)

Download location: GET /downloads/workflows/{name}

### 10.3 GitHub Sync Workflow

Trigger: Webhook (GitHub repo push or release event)

Nodes:

Webhook Trigger: receives GitHub webhook

GitHub Get Repo: fetches repository details via GitHub API

GitHub Get README: fetches README.md content

OpenAI Summarize: generates 2-3 sentence summary

Format Payload: transforms to Portfolio OS format

HTTP Request: POST to /api/webhooks/ingest with HMAC signature

Telegram Notify: sends success/failure message

User Configuration:

Set webhook URL in GitHub repo settings

Point to their n8n instance webhook URL

Configure OpenAI credentials in n8n

Set backend URL and WEBHOOK_SECRET

Set Telegram credentials

### 10.4 Medium RSS Sync Workflow

Trigger: Schedule (every 6 hours by default)

Nodes:

Schedule Trigger: cron or interval

RSS Feed Read: fetches Medium RSS feed

Filter New Articles: checks pubDate > last run

OpenAI Summarize: generates summaries for new articles

Format Batch Payload: transforms all articles to Portfolio OS format

HTTP Request: POST to /api/webhooks/ingest

Telegram Notify: sends batch results

User Configuration:

Set schedule interval (6h, 12h, 24h)

Configure Medium RSS URL

Set backend URL and authentication

Set notification preferences

### 10.5 User Setup Process

After completing Portfolio OS onboarding:

Install n8n separately:

Option A: n8n Cloud (cloud.n8n.io)

Option B: Self-hosted Docker

Option C: npm install -g n8n

Download workflow templates from Portfolio OS

Import workflows into n8n:

Open n8n UI

Click Import from File

Upload each JSON template

Workflows appear in n8n

Configure workflows:

Set OpenAI credentials

Set backend URL (https://yourportfolio.com)

Set WEBHOOK_SECRET from your .env

Set Telegram bot token (if using notifications)

Configure GitHub webhook URL (if using GitHub sync)

Test workflows:

Manually execute each workflow

Check Portfolio OS admin dashboard for new content

Verify notifications arrive

Activate workflows:

Enable in n8n UI

Workflows now run automatically

## SECTION 11: SUCCESS METRICS

### 11.1 Performance Metrics

Target Performance:

Onboarding completion: under 15 minutes

Chat response time (p95): under 3 seconds

First token latency: under 700ms

Vector search latency: under 50ms

Embedding generation: under 200ms per chunk

### 11.2 System Health Metrics

Uptime Targets:

API availability: 99.5%

Qdrant availability: 99.9%

Background job success rate: 95%

Resource Usage:

Memory: under 512MB baseline

CPU: under 10% idle, under 80% under load

Disk: under 1GB for typical portfolio (50 items)

### 11.3 User Success Metrics

Adoption:

GitHub stars: 50+ in first month

Docker pulls: 100+ in first month

Successful deployments: track via opt-in telemetry

Quality:

Chat answer accuracy: 90%+ based on user feedback

Zero manual updates: 6+ months without code changes

Sync success rate: 95%+ for automated workflows

### 11.4 Monitoring

Key metrics to track:

Total queries per day

Unique sessions per day

Average queries per session

Top queried topics

Response time percentiles

OpenAI token usage and cost

Qdrant collection size growth

Sync job success/failure rates

Error rates by endpoint

## SECTION 12: IMPLEMENTATION TIMELINE

### 12.1 Two-Week MVP Plan

Week 1: Foundation & Onboarding

Days 1-2: Project Setup

Initialize Fastify TypeScript project

Set up Docker Compose with backend + Qdrant

Create config schema with Zod

Implement config manager with encryption

Set up SQLite database and schema

Basic health check endpoint

Days 3-4: Onboarding Steps 1-2

Step 1: Basic profile endpoint

Step 2: Resume upload + PDF parsing

GPT-4 extraction with structured schema

User review and confirmation endpoint

Basic indexing to Qdrant

Test end-to-end resume flow

Days 5-6: Onboarding Steps 3-5

Step 3: GitHub adapter implementation

Step 3: Medium adapter implementation

Deduplication logic (P1)

Step 4: AI persona configuration

System prompt generation

Step 5: Deployment configuration

Complete onboarding flow test

Day 7: Testing & Refinement

End-to-end onboarding test

Fix bugs

Add error handling

Prepare for Week 2

Week 2: Chat, Admin & Production

Days 8-9: Chat System

Implement retrieval service

Implement generator with streaming

Mandatory memory management

Session cleanup background job

Rate limiting (P0)

Error handling with retries (P0)

Test SSE streaming

Days 10-11: Admin Dashboard & Webhooks

Manual content upload endpoints

Content management (list, update, delete)

Settings management endpoint

System status dashboard

Webhook ingestion endpoint

HMAC signature validation

Dead letter queue (P0)

Days 12-13: n8n & Polish

Create GitHub sync workflow template

Create Medium RSS workflow template

Test workflows end-to-end

Documentation: README, API docs, setup guide

Example Nginx configuration

Deployment testing

Day 14: Final Testing & Release

Full integration testing

Performance testing

Security audit

Final bug fixes

Tag v1.0.0 release

Publish to GitHub

### 12.2 Post-MVP Roadmap

Month 2: Enhancements

Cost tracking dashboard

Chat feedback endpoint

Backup and restore functionality

LinkedIn adapter improvements

Additional workflow templates

Month 3: Polish & Scale

Advanced observability (metrics, traces)

Mock mode for development

Config schema migration system

Performance optimizations

Documentation improvements

Month 4+: Community Features

Plugin system for custom adapters

Multi-language support

Advanced RAG techniques (hybrid search, reranking)

Web UI admin dashboard (optional)

Managed hosting option

END OF PRD