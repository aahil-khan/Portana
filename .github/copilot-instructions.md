# Portana Workspace Instructions

## Scope
This workspace is primarily a Fastify + TypeScript backend under `backend/` with Docker runtime via `docker-compose.yml`. Treat ingestion pipeline changes as high-impact because they alter retrieval quality for chat and onboarding flows.

## Primary Focus: Ingestion Pipeline
When asked to update or reingest content, prefer operational commands and endpoint verification over speculative code edits.

### Canonical Runtime
- Remote Docker is the source of truth for runtime behavior.
- Backend service runs on host port `3200` and Qdrant on `6333`.
- If `resume.json` or `blogs.json` changes, rebuild backend image before reingesting.

### Reingestion Workflow (Docker)
Run from repo root:

```bash
docker compose build backend
docker compose up -d backend qdrant
curl -sS http://localhost:3200/health
```

Trigger ingestors:

```bash
# Resume JSON + resume Q&A
curl -sS -X POST http://localhost:3200/api/admin/ingest/resume

# Cheatsheet Q&A
curl -sS -X POST http://localhost:3200/api/admin/ingest/cheatsheet

# GitHub READMEs (defaults)
curl -sS -X POST http://localhost:3200/api/admin/ingest/github

# Medium articles
curl -sS -X POST http://localhost:3200/api/admin/ingest/medium \
  -H 'Content-Type: application/json' \
  -d '{"username":"<medium_username>"}'
```

## Ingestion Service Map
- `backend/src/services/resume-ingestor.ts`
  - Ingests `resume.json` and Q&A files from `backend/data/resume ingestion/jsons`.
  - Deletes old vectors by source: `resume`, `resume_qa`, `resume_structured`.
- `backend/src/services/cheatsheet-ingestor.ts`
  - Ingests `backend/data/cheatsheet/cheatsheet.json`.
  - Deletes old vectors by source: `cheatsheet`.
- `backend/src/services/github-ingestor.ts`
  - Fetches GitHub repo READMEs, sections/chunks them, embeds and upserts to Qdrant.
  - Uses source: `github_readme`.
- `backend/src/services/medium-ingestor.ts`
  - Fetches Medium RSS articles, chunks + embeds them, upserts with source `medium`.

## HTTP Entrypoints
- Admin ingestion routes: `backend/src/routes/admin.ts`
  - `POST /api/admin/ingest/resume`
  - `POST /api/admin/ingest/cheatsheet`
  - `POST /api/admin/ingest/github`
  - `POST /api/admin/ingest/medium`
- Webhook ingestion routes: `backend/src/routes/webhooks.ts`
  - `POST /api/webhooks/github`
  - `POST /api/webhooks/medium`
  - `POST /api/webhooks/ingest`

## Architecture Boundaries
- Route layer in `backend/src/routes/` orchestrates request/response and validation.
- Ingestors in `backend/src/services/*ingestor.ts` own fetch/parse/chunk/embed/upsert flow.
- Vector database logic is centralized in `backend/src/vector/`.
- Embedding calls must go through `getEmbedder()` singleton.

## Conventions and Pitfalls
- Use service singleton getters (`getResumeIngestor()`, etc.) instead of direct constructor use.
- Qdrant must initialize before route registration (`backend/src/app.ts`).
- Docker networking uses `QDRANT_URL=http://qdrant:6333` in container, not localhost.
- Ingestors use multi-path fallback for data files; preserve this behavior when refactoring paths.
- Some onboarding tests intentionally skip when `OPENAI_API_KEY` is missing.

## Build/Test Commands
Run in `backend/` when working without Docker:

```bash
npm run dev
npm run build
npm run test
npm run type-check
```

## Link, Don’t Duplicate
Use existing docs as canonical references:
- `docs/QUICKSTART.md`
- `docs/DEPLOYMENT_GUIDE.md`
- `docs/PRD.md`
- `docs/SKIPPED_TESTS_ANALYSIS.md`

## Suggested Next Customizations
If this workspace grows, add scoped instruction files:
- `.github/instructions/ingestors.instructions.md` with `applyTo: backend/src/services/*ingestor.ts`
- `.github/instructions/routes.instructions.md` with `applyTo: backend/src/routes/*.ts`
- `.github/instructions/tests.instructions.md` with `applyTo: backend/tests/**/*.ts`
