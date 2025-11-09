# ��� Phase 9: Webhooks - Ready to Implement

**Date**: November 9, 2025  
**Project Status**: 8/15 phases complete (53%)  
**Next Phase**: Phase 9 - Webhooks (GitHub + Medium sync)  
**Documentation**: Ready  
**Context7 Research**: Complete  

---

## ��� What's Ready

### ✅ Complete Design Documents
1. **PHASE_9_DESIGN.md** - Full 80KB specification
   - Architecture diagrams
   - 3 services with full signatures
   - 6 HTTP endpoints
   - Data models
   - HMAC verification process
   - Retry logic (exponential backoff)
   - Dead letter queue pattern

2. **PHASE_9_START.md** - Quick start guide
   - Step-by-step implementation order
   - Code snippets for key features
   - Time estimates (3.5 hours total)
   - Test targets (55+ tests)
   - Definition of done

### ✅ Research Complete (Context7)
- **Octokit Webhooks**: HMAC verification, GitHub event types, payload schemas
- **Spatie Webhook Server**: Retry mechanisms, exponential backoff, queue patterns
- **Best Practices**: Timing-safe comparison, batch processing, error handling

### ✅ Architecture Documented
```
WebhookVerifierService → Validates signatures
    ↓
WebhookProcessorService → Normalizes payloads
    ↓
WebhookQueueService → Manages retries & failures
    ↓
Routes → /api/webhooks/{github,medium,ingest,status,dlq}
```

---

## ��� Implementation Roadmap

### Phase 9.1: Core Infrastructure (2 hours)
**3 Services + Routes + Tests**

**File Structure**:
```
backend/src/webhooks/
├── services/
│   ├── webhook-verifier.ts (120 LOC) ← HMAC verification
│   ├── webhook-processor.ts (180 LOC) ← Payload parsing
│   ├── webhook-queue.ts (140 LOC) ← Retry logic
│   └── index.ts (30 LOC) ← Exports
└── adapters/
    ├── github-adapter.ts (120 LOC)
    ├── medium-adapter.ts (120 LOC)
    └── index.ts (20 LOC)

backend/src/routes/
└── webhooks.ts (180 LOC)

backend/tests/
└── webhooks.test.ts (300+ LOC, 55+ tests)
```

### Phase 9.2: GitHub Integration (1 hour)
- GitHub push event parser
- README extraction via GitHub API
- Stats gathering (stars, forks, language)
- Deduplication logic

### Phase 9.3: Medium Integration (1 hour)
- RSS feed parser
- Article extraction
- Metadata collection
- Polling schedule

---

## ��� Key Insights from Research

### HMAC Security (from Octokit)
✅ Use `crypto.timingSafeEqual()` for comparison (prevents timing attacks)
✅ Algorithm: SHA-256
✅ Header: `X-Webhook-Signature`
✅ Format: `sha256={hex_digest}`

### Retry Strategy (from Spatie)
✅ Pattern: Exponential backoff
✅ Delays: 1s → 5s → 30s → Dead Letter Queue
✅ Max retries: 3 attempts
✅ Batch processing: `Promise.allSettled()` (don't fail batch for single item)

### Dead Letter Queue (Enterprise Pattern)
✅ Store failed items for manual review
✅ Trackable: webhook_id, error, attempt count
✅ Manual retry: Can retry individual items
✅ Monitoring: Status endpoint shows DLQ health

---

## ��� Implementation Checklist

### Services
- [ ] WebhookVerifierService
  - [ ] HMAC verification with timing-safe comparison
  - [ ] Bearer token validation
  - [ ] Signature generation for testing
  - [ ] Singleton pattern

- [ ] WebhookProcessorService
  - [ ] Parse GitHub push events
  - [ ] Parse Medium articles
  - [ ] Normalize to ProjectAdminInput format
  - [ ] Deduplication check (90% similarity)
  - [ ] Reuse ProjectAdminService

- [ ] WebhookQueueService
  - [ ] In-memory queue (Map<id, item>)
  - [ ] Exponential backoff (1s, 5s, 30s)
  - [ ] Dead letter queue storage
  - [ ] Background job processor
  - [ ] Manual retry endpoint

### Routes
- [ ] POST /api/webhooks/github (202 Accepted)
- [ ] POST /api/webhooks/medium (202 Accepted)
- [ ] POST /api/webhooks/ingest (202 Accepted)
- [ ] GET /api/webhooks/status (200)
- [ ] GET /api/webhooks/dlq (200)
- [ ] POST /api/webhooks/dlq/retry/:id (200/404)

### Testing
- [ ] 6 WebhookVerifierService tests
- [ ] 10 WebhookProcessorService tests
- [ ] 12 WebhookQueueService tests
- [ ] 15 endpoint integration tests
- [ ] 12 full flow scenarios
- [ ] **Target: 55+ tests, 100% passing**

### Quality
- [ ] 0 TypeScript errors
- [ ] 0 build warnings
- [ ] All tests passing
- [ ] Documentation complete
- [ ] Git commit with detailed message

---

## ��� Pro Tips for Implementation

### 1. Reuse Phase 8
```typescript
// Don't rebuild validation, use existing
import { ProjectAdminService } from '../admin/services';

const projects = ProjectAdminService.getInstance()
  .createProject(normalizedData);
```

### 2. Mock Data for Testing
```typescript
// GitHub event fixture
const mockGitHubPush = {
  repository: { name: 'portfolio-os', stargazers_count: 42 },
  // ... full payload in PHASE_9_DESIGN.md
};

// Medium RSS fixture
const mockMediumRSS = `
  <rss><channel>
    <item><title>Article</title>...</item>
  </channel></rss>
`;
```

### 3. Error Handling Pattern
```typescript
// Don't throw, queue for retry
try {
  process(item);
} catch (error) {
  queueService.addToQueue({
    ...item,
    error: error.message,
    retries: 0
  });
}
```

### 4. Test Signature Verification
```typescript
// Generate test signature
const verifier = WebhookVerifierService.getInstance();
const secret = 'test-secret';
const payload = JSON.stringify({ test: 'data' });
const signature = verifier.createSignature(payload, secret);

// Verify it works
expect(verifier.verifyHMACSignature(payload, signature, secret)).toBe(true);
```

---

## �� Success Metrics

| Metric | Target | How to Verify |
|--------|--------|---------------|
| Services | 3 | `npm test -- webhooks.test.ts \| grep "✓"` |
| Endpoints | 6 | `grep "fastify\.post\|fastify\.get" src/routes/webhooks.ts` |
| Tests | 55+ | `npm test -- webhooks.test.ts` |
| Coverage | 100% | `npm test -- --coverage` |
| Build | 0 errors | `npm run build` |
| Git | Committed | `git log --oneline -1` |

---

## ��� Ready to Begin

### Prerequisites Met ✅
- [x] Phase 8 (Admin API) complete and committed
- [x] Context7 research complete (webhook patterns)
- [x] Design document finished (80KB specification)
- [x] Quick start guide ready (PHASE_9_START.md)
- [x] Architecture diagrams created
- [x] Test strategy defined (55+ tests)

### Next Command
```bash
# Step into backend
cd backend

# Create webhook directory structure
mkdir -p src/webhooks/{services,adapters}

# Start with verifier service (see PHASE_9_START.md Step 1)
# Then processor service (Step 2)
# Then queue service (Step 3)
# Then routes (Step 4)
# Then tests (Step 5)
```

### Expected Timeline
- Setup & Verifier: 30 min
- Processor: 45 min
- Queue: 45 min
- Routes: 30 min
- Tests: 60 min
- Finalize: 15 min
- **Total: 3.5 hours**

---

## ��� Documentation Index

| Document | Purpose | Size |
|----------|---------|------|
| **PHASE_9_DESIGN.md** | Full specification | 80KB |
| **PHASE_9_START.md** | Quick start guide | 12KB |
| **PHASE_9_HANDOFF.md** | This file | 8KB |
| **PRD.md** | Project requirements | 45KB |
| **PHASE_8_COMPLETE.md** | Previous phase | 15KB |

---

## ��� Key Learnings Applied

**From Phase 8**:
- Singleton pattern (services)
- Zod schemas (validation)
- Fastify route generics (type safety)
- Error handling patterns
- Test organization (unit + integration)

**New Patterns for Phase 9**:
- HMAC cryptography (security)
- Exponential backoff (reliability)
- Dead letter queue (resilience)
- Batch processing (efficiency)
- Queue management (scalability)

---

## ✨ Final Checklist Before Starting

- [x] Phase 8 complete and committed
- [x] Design document reviewed
- [x] Architecture understood
- [x] Services designed
- [x] Routes defined
- [x] Test cases planned
- [x] Implementation order clear
- [x] Time estimates provided
- [x] Success metrics defined
- [x] Documentation complete

---

## ��� Ready to Ship

**Status**: ✅ All systems go for Phase 9 implementation

**Current Progress**: 8 phases complete, 7 to go  
**Project**: 53% complete  
**Quality**: 100% test pass rate maintained  

**Next Phase**: GitHub + Medium webhooks with retry logic and dead letter queue

---

**Handoff Date**: November 9, 2025  
**Prepared By**: GitHub Copilot  
**Status**: Ready for implementation  

**Start whenever ready! All documentation is in place. ���**
