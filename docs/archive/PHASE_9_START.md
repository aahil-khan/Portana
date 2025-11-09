# Phase 9: Quick Start - Ready to Implement

**Status**: Design complete, ready to code  
**Timeline**: This session  
**Architecture**: 3 services, 6 endpoints, 55+ tests

---

## Ì≥¶ What to Build

### Service 1: WebhookVerifierService (120 LOC)
```typescript
// src/webhooks/services/webhook-verifier.ts

class WebhookVerifierService {
  static verifyHMACSignature(payload: string, signature: string, secret: string): boolean
  static verifyBearerToken(token: string, expected: string): boolean
  static createSignature(payload: string, secret: string): string
  static getInstance(): WebhookVerifierService
}
```

**Key**: Use crypto.timingSafeEqual for secure comparison

### Service 2: WebhookProcessorService (180 LOC)
```typescript
// src/webhooks/services/webhook-processor.ts

class WebhookProcessorService {
  static processGitHubPush(payload: any): ProjectCreateInput[]
  static processMediumArticle(payload: any): ProjectCreateInput[]
  static normalizeToProject(data: WebhookItem): ProjectCreateInput
  static checkDuplicates(title: string): boolean
  static getInstance(): WebhookProcessorService
}
```

**Key**: Leverage ProjectAdminService for validation

### Service 3: WebhookQueueService (140 LOC)
```typescript
// src/webhooks/services/webhook-queue.ts

class WebhookQueueService {
  static addToQueue(item: QueuedItem): void
  static processQueue(): Promise<ProcessResult>
  static getDeadLetterQueue(): DeadLetterItem[]
  static retryItem(id: string): Promise<boolean>
  static getInstance(): WebhookQueueService
}
```

**Key**: Exponential backoff: 1s ‚Üí 5s ‚Üí 30s ‚Üí DLQ

### Routes (180 LOC)
```typescript
// src/routes/webhooks.ts

POST   /api/webhooks/github          ‚Üí GitHub push events
POST   /api/webhooks/medium          ‚Üí Medium articles
POST   /api/webhooks/ingest          ‚Üí Generic n8n payloads
GET    /api/webhooks/status          ‚Üí Health check
GET    /api/webhooks/dlq             ‚Üí Dead letter queue
POST   /api/webhooks/dlq/retry/:id   ‚Üí Manual retry
```

---

## Ì∫Ä Implementation Order

### Step 1: Scaffold & Verifier (30 min)
```bash
cd backend
mkdir -p src/webhooks/services
mkdir -p src/webhooks/adapters
```

Create:
1. `src/webhooks/services/webhook-verifier.ts`
   - Import crypto module
   - Implement HMAC verification (timing-safe)
   - Implement bearer token check
   - Export singleton

### Step 2: Processor Service (45 min)
Create:
2. `src/webhooks/services/webhook-processor.ts`
   - Use ProjectAdminService.getInstance()
   - Implement GitHub payload handler
   - Implement Medium payload handler
   - Deduplication logic (90% similarity)

### Step 3: Queue Service (45 min)
Create:
3. `src/webhooks/services/webhook-queue.ts`
   - In-memory queue (Map)
   - Retry logic with exponential backoff
   - Dead letter queue storage
   - Background processor

### Step 4: Routes (30 min)
Create:
4. `src/routes/webhooks.ts`
   - All 6 endpoints
   - Signature verification
   - Error handling
   - Response formatting

### Step 5: Tests (60 min)
Create:
5. `tests/webhooks.test.ts`
   - 55+ comprehensive tests
   - Mock payloads
   - Retry scenarios

### Step 6: Finalize (15 min)
1. Build & compile
2. Run tests (expect 100%)
3. Git commit

---

## Ì¥ë Key Implementation Details

### HMAC Verification
```typescript
import { createHmac, timingSafeEqual } from 'crypto';

const payload = JSON.stringify(body);
const signature = createHmac('sha256', secret)
  .update(payload)
  .digest('hex');

timingSafeEqual(
  Buffer.from(signature),
  Buffer.from(incomingSignature)
);
```

### Exponential Backoff
```typescript
const delays = [0, 1000, 5000, 30000]; // ms
const delay = delays[Math.min(attempt, delays.length - 1)];
```

### Deduplication
```typescript
const similarity = (s1: string, s2: string) => {
  // Calculate Levenshtein distance ratio
  // If > 0.9 (90%), consider duplicate
};
```

---

## Ì≥ã Checklist

### Phase 9.1: Infrastructure
- [ ] WebhookVerifierService (singleton, HMAC, bearer)
- [ ] WebhookProcessorService (normalize, deduplicate)
- [ ] WebhookQueueService (retry logic, DLQ)
- [ ] Webhook routes (6 endpoints)
- [ ] Tests pass (100%)
- [ ] Build succeeds (0 errors)

### Phase 9.2: GitHub Adapter
- [ ] Parse push events
- [ ] Extract repo metadata
- [ ] Get README content
- [ ] Fetch stats

### Phase 9.3: Medium Adapter
- [ ] Parse RSS feed
- [ ] Extract articles
- [ ] Handle pagination
- [ ] Schedule polling

---

## Ì≥ä Test Targets

| Component | Tests | Target |
|-----------|-------|--------|
| WebhookVerifierService | 6 | HMAC, tokens, comparison |
| WebhookProcessorService | 10 | Parsing, normalization, dedup |
| WebhookQueueService | 12 | Queue, retry, backoff, DLQ |
| Routes | 15 | Endpoints, auth, errors |
| Integration | 12 | Full flow scenarios |
| **TOTAL** | **55+** | **100% PASS** |

---

## Ì≤° Tips

1. **Reuse Phase 8**: ProjectAdminService already has validation
2. **Use Zod**: Create schemas for WebhookItem, QueuedItem
3. **Error Handling**: Catch and queue errors, don't fail
4. **Testing**: Mock GitHub/Medium payloads with fixtures
5. **TypeScript**: Use Partial<> for flexibility
6. **Logging**: Log each queue attempt for debugging

---

## ÌæØ Definition of Done

- ‚úÖ 3 webhook services fully functional
- ‚úÖ 6 HTTP endpoints operational
- ‚úÖ 55+ tests passing (100%)
- ‚úÖ 0 TypeScript errors
- ‚úÖ HMAC signature verification working
- ‚úÖ Exponential backoff implemented
- ‚úÖ Dead letter queue functional
- ‚úÖ Documentation complete
- ‚úÖ Git commit successful

---

## Ì≥ö References

**GitHub Webhook**:
- Event: `push`, `pull_request`, `release`
- Signature header: `X-Webhook-Signature`
- Payload: Repository, commits, author info

**Medium RSS**:
- Feed: `https://medium.com/feed/@{username}`
- Format: RSS 2.0
- Fields: title, description, link, pubDate, author

**Patterns to Use**:
- Singleton: One instance per service
- Exponential backoff: Retry with increasing delays
- Dead letter queue: Store permanent failures
- Batch processing: Promise.allSettled for multiple items

---

## ‚è±Ô∏è Time Estimate

| Task | Time |
|------|------|
| Setup & Verifier | 30 min |
| Processor Service | 45 min |
| Queue Service | 45 min |
| Routes | 30 min |
| Tests | 60 min |
| Finalization | 15 min |
| **TOTAL** | **3.5 hours** |

---

## Ì∫¢ Ship It!

Ready to start? Begin with:
```bash
cd c:/Users/aahil/OneDrive/Documents/vs/portfolioOS/backend
mkdir -p src/webhooks/{services,adapters}
```

Then create the services in order following PHASE_9_DESIGN.md for full specs.

**Next Command**: Start implementing webhook-verifier.ts
