# Phase 9: Webhooks - Design & Implementation Plan

**Status**: Planning  
**Target**: Production-ready webhook system  
**Dependencies**: Phase 8 (Admin API)  
**Timeline**: 1-2 sessions

---

## ��� Overview

Phase 9 implements webhook infrastructure for automated content ingestion from external sources:
- GitHub repository sync
- Medium article ingestion
- Event queue processing with retries
- HMAC signature verification
- Dead letter queue for failures

---

## ���️ Architecture

### Component Hierarchy

```
┌─────────────────────────────────────────┐
│   External Sources                      │
│ (GitHub, Medium, n8n, etc)             │
└────────────────┬────────────────────────┘
                 │ HTTP POST
                 ▼
┌─────────────────────────────────────────┐
│   Webhook Routes                        │
│ - /api/webhooks/github                  │
│ - /api/webhooks/medium                  │
│ - /api/webhooks/verify                  │
└────────────────┬────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────┐
│   Webhook Services (Handlers)           │
│ - GitHubWebhookService                  │
│ - MediumWebhookService                  │
│ - WebhookProcessorService               │
│ - WebhookVerifierService                │
└────────────────┬────────────────────────┘
                 │
       ┌─────────┼─────────┐
       │         │         │
       ▼         ▼         ▼
    Validate  Process   Queue
       │         │         │
       └────┬────┴─────┬───┘
            │          │
            ▼          ▼
      Success      Dead Letter
                    Queue
```

### Three Main Services

#### 1. WebhookVerifierService
**Purpose**: Validate webhook authenticity

**Methods**:
- `verifyHMACSignature(payload, signature, secret)`: Verify SHA-256 HMAC
- `verifyBearerToken(token, expected)`: Verify bearer token
- `createSignature(payload, secret)`: Generate HMAC for testing

**Implementation**:
```typescript
import { createHmac } from 'crypto';
import { timingSafeEqual } from 'crypto';

verifyHMACSignature(payload: string, signature: string, secret: string): boolean {
  const expectedSignature = createHmac('sha256', secret)
    .update(payload)
    .digest('hex');
  
  try {
    return timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
  } catch {
    return false;
  }
}
```

#### 2. WebhookProcessorService
**Purpose**: Parse and normalize webhook payloads

**Methods**:
- `processGitHubPush(payload)`: Extract repo info, get README, create project
- `processMediumArticle(payload)`: Parse article, extract metadata, create project
- `normalizeToProject(data)`: Convert external format to ProjectAdminInput

**Key Features**:
- Deduplication check (90% title similarity)
- Content extraction and chunking
- Metadata preservation
- Error tracking for dead letter queue

#### 3. WebhookQueueService
**Purpose**: Manage retry logic and failed items

**Methods**:
- `addToQueue(item)`: Queue item for processing
- `processQueue()`: Background job to retry failed items
- `getDeadLetterQueue()`: List permanently failed items
- `retryItem(id, maxRetries)`: Manually retry failed item

**Features**:
- 3 retry attempts max
- Exponential backoff (1s, 5s, 30s)
- Failed item storage
- Batch processing with Promise.allSettled

### Data Models

#### WebhookPayload (Generic)
```typescript
{
  webhook_id: string           // Identifies the sender
  source: 'github' | 'medium'  // Event source
  action: 'create' | 'update' | 'delete'
  items: WebhookItem[]
  timestamp: string (ISO)
  signature?: string           // For HMAC verification
}
```

#### WebhookItem
```typescript
{
  id: string                   // External ID
  type: 'project' | 'blog'
  title: string
  description: string
  content?: string
  tags?: string[]
  url?: string
  metadata: {
    source_id?: string
    source_url?: string
    author?: string
    stars?: number
    [key: string]: any
  }
}
```

#### QueuedItem (Internal)
```typescript
{
  id: string (UUID)            // Internal ID
  webhook_id: string
  item_data: WebhookItem
  error: string | null
  retries: number
  max_retries: number
  created_at: string (ISO)
  last_retry_at: string | null (ISO)
  status: 'pending' | 'processing' | 'failed'
}
```

---

## ��� Key Features

### 1. HMAC Signature Verification

**Algorithm**: SHA-256  
**Header**: X-Webhook-Signature  
**Format**: `sha256={hex_digest}`

**Process**:
1. Read X-Webhook-Signature header
2. Get raw request body as string
3. Calculate HMAC(SHA-256, body, secret)
4. Timing-safe comparison
5. Reject if mismatch (401 INVALID_SIGNATURE)

**Environment Variables**:
```
WEBHOOK_SECRET=very-long-random-string-32-chars-min
WEBHOOK_TOKEN=optional-bearer-token
```

### 2. GitHub Integration

**Webhook Events**: push, pull_request, release

**GitHub Push Handler**:
1. Extract repository info (owner, name, description)
2. Get main branch README via GitHub API
3. Fetch repository stats (stars, forks, language)
4. Create ProjectAdminItem:
   - title: repo name
   - description: repo description or first 500 chars of README
   - content: full README
   - source: 'github'
   - tags: [language, main topics]
   - metadata: { stars, forks, url, last_pushed_at }

**Deduplication**:
- Check for existing project by name (90% similarity threshold)
- If exists and GitHub has more stars: update
- Else: skip

### 3. Medium Integration

**Data Source**: RSS Feed (public)  
**Feed URL**: `https://medium.com/feed/@{username}` or custom domain

**Medium Handler**:
1. Fetch RSS feed
2. Parse each article:
   - title, description, link
   - publication_date, author
   - Extract tags from article categories
3. Create ProjectAdminItem:
   - title: article title
   - description: article excerpt (first 500 chars)
   - content: article body (scrape or use RSS content)
   - source: 'medium'
   - tags: [tech topics extracted]
   - url: canonical link
   - metadata: { publication_date, author, url }

**Polling**: Every 6-24 hours (configurable)

### 4. Retry Logic (Background Job)

**Pattern**: Exponential Backoff

```
Attempt 1: Immediate
Attempt 2: After 1 second (1s)
Attempt 3: After 5 seconds (1 + 4s)
Attempt 4: After 30 seconds (5 + 25s)
After 3 failures: Dead Letter Queue

Formula: delay = min(2^(retry-1) * 0.5, 30)
```

**Background Job** (runs every 5 minutes):
```
1. Query queue for pending items (retries < max_retries)
2. Group by webhook_id (batch processing)
3. Process with Promise.allSettled
4. Mark successful items as complete
5. Increment retry count for failed items
6. Move to DLQ after max_retries exceeded
```

### 5. Dead Letter Queue

**Purpose**: Store permanently failed items for manual review

**Storage**: SQLite table `webhook_dead_letter_queue`

**Fields**:
- id (primary key)
- webhook_id
- item_data (JSON)
- error (last error message)
- created_at
- processed_attempts
- resolution_notes (nullable)

**Operations**:
- POST /api/webhooks/dlq/retry/:id (manual retry)
- GET /api/webhooks/dlq (list failed items)
- DELETE /api/webhooks/dlq/:id (acknowledge)

---

## ��� HTTP Endpoints

### POST /api/webhooks/github

**Authentication**: X-Webhook-Signature or Bearer token  
**Content-Type**: application/json

**Request**:
```json
{
  "action": "synchronize" | "opened" | "synchronize",
  "number": 123,
  "pull_request": {
    "title": "Add AI feature",
    "body": "Description...",
    "user": { "login": "octocat" },
    "created_at": "2025-11-09T10:30:00Z",
    "updated_at": "2025-11-09T11:00:00Z"
  },
  "repository": {
    "name": "portfolio-os",
    "full_name": "aahil/portfolio-os",
    "description": "AI-powered portfolio",
    "owner": { "login": "aahil" },
    "url": "https://api.github.com/repos/aahil/portfolio-os",
    "html_url": "https://github.com/aahil/portfolio-os",
    "stargazers_count": 42,
    "forks_count": 5,
    "language": "TypeScript",
    "topics": ["ai", "portfolio", "rag"]
  },
  "sender": { "login": "aahil" }
}
```

**Response** (202 Accepted):
```json
{
  "success": true,
  "webhook_id": "github_push_12345",
  "processed": 1,
  "results": {
    "indexed": 1,
    "skipped": 0,
    "failed": 0
  },
  "queue_id": "uuid-for-tracking"
}
```

### POST /api/webhooks/medium

**Authentication**: X-Webhook-Signature or Bearer token

**Request**:
```json
{
  "webhook_id": "medium_sync_2025_11_09",
  "source": "medium",
  "action": "create",
  "items": [
    {
      "id": "medium_abc123",
      "type": "blog",
      "title": "Building AI Portfolios",
      "description": "How to leverage RAG...",
      "content": "Full article content here...",
      "tags": ["ai", "rag", "portfolio"],
      "url": "https://medium.com/@user/building-ai-portfolios",
      "metadata": {
        "publication_date": "2025-11-08",
        "author": "John Doe",
        "claps": 123
      }
    }
  ]
}
```

**Response** (202 Accepted):
```json
{
  "success": true,
  "webhook_id": "medium_sync_2025_11_09",
  "processed": 1,
  "results": {
    "indexed": 1,
    "skipped": 0,
    "failed": 0,
    "details": [
      {
        "id": "medium_abc123",
        "status": "indexed",
        "chunks": 8,
        "content_hash": "sha256_hash"
      }
    ]
  }
}
```

### POST /api/webhooks/ingest (Generic)

**Purpose**: Accept from n8n or custom sources

**Request**:
```json
{
  "webhook_id": "n8n_workflow_12345",
  "source": "custom",
  "action": "create",
  "items": [
    {
      "id": "custom_item_1",
      "type": "project",
      "title": "AI Project",
      "description": "Description...",
      "content": "Full details...",
      "tags": ["ai", "ml"],
      "metadata": { "custom": "field" }
    }
  ]
}
```

### GET /api/webhooks/status

**Purpose**: Webhook system health check

**Response**:
```json
{
  "status": "healthy",
  "services": {
    "github": { "enabled": true, "last_sync": "2025-11-09T12:00:00Z" },
    "medium": { "enabled": true, "last_sync": "2025-11-09T11:30:00Z" }
  },
  "queue": {
    "pending": 0,
    "processing": 0,
    "failed": 2,
    "processed_today": 15
  },
  "dlq": {
    "count": 2,
    "oldest": "2025-11-08T14:22:00Z"
  }
}
```

### GET /api/webhooks/dlq

**Purpose**: List dead letter queue items

**Response**:
```json
{
  "items": [
    {
      "id": "dlq_12345",
      "webhook_id": "github_push_12345",
      "error": "Connection timeout",
      "created_at": "2025-11-09T12:00:00Z",
      "attempts": 3,
      "item_summary": { "title": "Project name", "source": "github" }
    }
  ],
  "count": 1,
  "total_pages": 1
}
```

---

## ��� Implementation Phases

### Phase 9.1: Webhook Infrastructure (500 LOC)

**Files to create**:
1. `src/webhooks/services/webhook-verifier.ts` (120 LOC)
   - HMAC signature verification
   - Bearer token validation
   - Signature generation

2. `src/webhooks/services/webhook-processor.ts` (180 LOC)
   - Payload normalization
   - GitHub payload handling
   - Medium payload handling
   - Deduplication logic

3. `src/webhooks/services/webhook-queue.ts` (140 LOC)
   - Queue management
   - Retry logic with exponential backoff
   - Dead letter queue operations
   - Background job processing

4. `src/webhooks/services/index.ts` (30 LOC)
   - Service exports

5. `src/routes/webhooks.ts` (180 LOC)
   - All webhook endpoints
   - Error handling
   - Response formatting

**Tests** (300+ LOC):
- Signature verification (10 tests)
- Payload processing (15 tests)
- Queue operations (12 tests)
- Retry logic (8 tests)
- Dead letter queue (5 tests)

### Phase 9.2: GitHub Integration (200 LOC)

**Files**:
1. `src/webhooks/adapters/github-adapter.ts` (120 LOC)
   - GitHub API client
   - README extraction
   - Stats gathering
   - Push event parser

2. Tests (80 LOC)
   - Mock GitHub API responses
   - Payload transformation
   - Deduplication scenarios

### Phase 9.3: Medium Integration (180 LOC)

**Files**:
1. `src/webhooks/adapters/medium-adapter.ts` (120 LOC)
   - RSS feed parsing
   - Article extraction
   - Metadata collection
   - Schedule management

2. Tests (60 LOC)
   - Mock RSS feed
   - Article parsing
   - Polling logic

---

## ��� Test Strategy

### Unit Tests (40 tests)

**WebhookVerifierService**:
- ✅ Valid HMAC signature
- ✅ Invalid HMAC signature
- ✅ Valid bearer token
- ✅ Invalid bearer token
- ✅ Missing signature header
- ✅ Timing-safe comparison

**WebhookProcessorService**:
- ✅ Process GitHub push event
- ✅ Process Medium article
- ✅ Normalize to project
- ✅ Deduplication detection
- ✅ Content extraction
- ✅ Tag extraction

**WebhookQueueService**:
- ✅ Add item to queue
- ✅ Process queue successfully
- ✅ Retry logic (exponential backoff)
- ✅ Move to dead letter queue after 3 failures
- ✅ Manual retry from DLQ
- ✅ Batch processing with Promise.allSettled

### Integration Tests (15 tests)

**Webhook Endpoints**:
- ✅ POST /api/webhooks/github with valid signature
- ✅ POST /api/webhooks/github with invalid signature
- ✅ POST /api/webhooks/medium with valid payload
- ✅ POST /api/webhooks/ingest generic handler
- ✅ GET /api/webhooks/status
- ✅ GET /api/webhooks/dlq

### Test Data

**Mock GitHub Event**:
```json
{
  "ref": "refs/heads/main",
  "repository": {
    "name": "portfolio-os",
    "full_name": "aahil/portfolio-os",
    "description": "AI-powered portfolio"
  },
  "pusher": { "name": "aahil" }
}
```

**Mock Medium RSS**:
```xml
<rss>
  <channel>
    <item>
      <title>Article Title</title>
      <description>Article desc...</description>
      <link>https://medium.com/@user/article</link>
      <pubDate>Wed, 09 Nov 2025 12:00:00 +0000</pubDate>
    </item>
  </channel>
</rss>
```

---

## ��� Deployment Checklist

- [ ] All services implemented and tested
- [ ] 55+ tests passing (100%)
- [ ] 0 TypeScript errors
- [ ] Environment variables documented
- [ ] HMAC secret configured
- [ ] GitHub API token available (optional)
- [ ] Medium RSS feed accessible
- [ ] Dead letter queue monitoring
- [ ] Retry job scheduled
- [ ] Documentation complete
- [ ] Git commit successful

---

## ��� Integration Points

### With Phase 8 (Admin API)
- Use `ProjectAdminService.createProject()` for ingestion
- Use `AnalyticsAdminService.recordEvent()` for tracking
- Use project validation schemas

### With Phase 7 (Chat)
- Ingested projects available in chat context
- Chat can reference webhook-sourced content

### With Future Phases
- Phase 10 (Security): Add JWT auth to webhook endpoints
- Phase 11 (Logging): Detailed webhook event logging
- Phase 12 (Docker): Background job containerization

---

## ��� Success Metrics

| Metric | Target | Status |
|--------|--------|--------|
| Services Implemented | 3 | ⏳ |
| HTTP Endpoints | 6 | ⏳ |
| Tests Written | 55+ | ⏳ |
| Tests Passing | 100% | ⏳ |
| TypeScript Errors | 0 | ⏳ |
| Build Warnings | 0 | ⏳ |
| Code Coverage | Comprehensive | ⏳ |
| Documentation | Complete | ⏳ |

---

## ��� References

**Context7 Documentation Used**:
- Octokit Webhooks: HMAC verification, event types, payload schemas
- Spatie Webhook Server: Retry strategies, backoff patterns, queue management

**Implementation Patterns**:
- Exponential backoff for retries
- Dead letter queue for failures
- Promise.allSettled for batch processing
- Timing-safe comparison for security
- SHA-256 HMAC for signatures

---

**Next Steps**:
1. Create webhook services scaffold
2. Implement signature verification
3. Create webhook routes
4. Add GitHub adapter
5. Add Medium adapter
6. Write comprehensive tests
7. Integration testing
8. Documentation
9. Git commit

**Estimated LOC**: 1,200 - 1,500 lines (services + routes + tests)
**Estimated Time**: 2-3 hours implementation + 1 hour testing
