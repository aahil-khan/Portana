# GitHub Ingestor Testing Guide

## 🚀 Quick Start

### 1. Start Backend
```bash
cd backend
npm run dev
```

### 2. Trigger GitHub Ingestion
```bash
# Default (all 4 repos: skillmap, skillmap_engine, edutube, intellidine)
curl -X POST http://localhost:3001/api/admin/ingest/github \
  -H "Content-Type: application/json"

# Or specify custom repos
curl -X POST http://localhost:3001/api/admin/ingest/github \
  -H "Content-Type: application/json" \
  -d '{
    "repos": [
      "aahil-khan/skillmap",
      "aahil-khan/skillmap_engine",
      "Dean-DCT-Thapar/edutube",
      "aahil-khan/intellidine"
    ]
  }'
```

### 3. Check Logs
```bash
# View ingestion logs
curl http://localhost:3001/api/admin/logs?limit=50&level=info | jq '.logs[] | select(.component=="GitHubIngestor")'

# Example output should show:
# - "Starting GitHub ingestion"
# - "Fetched README for [repo]"
# - "Processed [N] chunks"
# - "Embedded [N] chunks"
# - "Upserted [N] vectors to Qdrant"
```

### 4. Verify Vectors in Qdrant
```bash
# Check Qdrant is running on port 6333
curl http://localhost:6333/collections/portfolio_content | jq '.result.points_count'

# Should show something like:
# {
#   "points_count": 234,
#   "vectors_count": 234
# }
```

### 5. Test Chat References GitHub
```bash
# Create session
SESSION_ID="test-session-$(date +%s)"

# Ask about projects
curl -X POST http://localhost:3001/api/chat/ask \
  -H "Content-Type: application/json" \
  -d "{
    \"sessionId\": \"$SESSION_ID\",
    \"message\": \"What projects have you built?\"
  }" \
  -N
```

---

## 📊 Expected Results

### Ingestion Response
```json
{
  "success": true,
  "message": "Ingested 234 vectors from 4 repos",
  "data": {
    "totalChunks": 58,
    "totalVectors": 234,
    "results": {
      "skillmap": {
        "chunks": 12,
        "vectors": 48
      },
      "skillmap_engine": {
        "chunks": 16,
        "vectors": 64
      },
      "edutube": {
        "chunks": 18,
        "vectors": 72
      },
      "intellidine": {
        "chunks": 12,
        "vectors": 50
      }
    }
  }
}
```

### Chat Response (Streaming)
```
data: {"status": "connected"}
data: {"content": "I've built several full-stack applications:"}
data: {"content": "\n\n1. **SkillMap** - A skill mapping and tracking application"}
data: {"content": " (https://github.com/aahil-khan/skillmap)"}
data: {"content": "\n\n2. **IntelliDine** - AI-powered restaurant recommendation system"}
data: {"content": " (https://github.com/aahil-khan/intellidine)"}
data: {"status": "complete"}
```

---

## 🔧 Troubleshooting

### GitHub API Rate Limit
If you see `403 Forbidden`:
- GitHub has a 60 req/hour limit without authentication
- Solution: Set `GITHUB_TOKEN` environment variable
```bash
export GITHUB_TOKEN=ghp_xxxxxxxxxxxxxxxxxxxx
npm run dev
```

To create a token:
1. Go to GitHub → Settings → Developer settings → Personal access tokens
2. Click "Generate new token (classic)"
3. Select `public_repo` scope (read-only access to public repos)
4. Copy token and set `GITHUB_TOKEN=...`

### Qdrant Not Connected
If you see `Qdrant not initialized`:
```bash
# Make sure Qdrant is running
docker ps | grep qdrant

# If not running, start it:
docker-compose up -d qdrant
```

### No Chunks Created
If ingestion shows `0 chunks`:
- README might be empty or not found
- Check logs for which repos failed
- Verify repos exist: `curl https://api.github.com/repos/aahil-khan/skillmap`

---

## 📝 What Gets Ingested

For each repo README:

### SkillMap
- Repository: Frontend application
- Chunks from: Overview, Features, Installation, Usage, Tech Stack, Contributing
- Vector count: ~12 chunks × 4 embeddings = ~48 vectors

### SkillMap Engine
- Repository: Backend/API
- Chunks from: Overview, Architecture, API Endpoints, Usage, Features
- Vector count: ~16 chunks × 4 embeddings = ~64 vectors

### EduTube
- Repository: Educational platform
- Chunks from: Overview, Features, Getting Started, Architecture
- Vector count: ~18 chunks × 4 embeddings = ~72 vectors

### IntelliDine
- Repository: AI recommendation system
- Chunks from: Overview, Features, Usage, Tech Stack, Results
- Vector count: ~12 chunks × 4 embeddings = ~50 vectors

---

## ✅ Validation Checklist

- [ ] Backend starts without errors
- [ ] GitHub ingestor endpoint returns `success: true`
- [ ] Logs show ingestion progress for all 4 repos
- [ ] Qdrant shows increased vector count
- [ ] Chat responses reference GitHub repos with links
- [ ] No hallucination (only mentions projects from README)

---

## 🔄 Next Steps

1. Once ingestion works locally → Test on hosted backend
2. Build Medium ingestor (similar pattern)
3. Build chat frontend to display responses nicely
4. Deploy with embedded vector data

---

## 💡 Pro Tips

### View All Vectors
```bash
# Check what's in Qdrant (first 10 vectors)
curl -X POST http://localhost:6333/collections/portfolio_content/points/scroll \
  -H "Content-Type: application/json" \
  -d '{"limit": 10}'
```

### Delete Ingested Data
```bash
# Clear all vectors (useful for re-ingesting)
curl -X DELETE http://localhost:3001/api/admin/vectors

# Or clear specific project
curl -X DELETE http://localhost:3001/api/admin/vectors/skillmap
```

### Monitor in Real-Time
```bash
# Watch logs as ingestion happens
watch -n 1 'curl -s http://localhost:3001/api/admin/logs?limit=5 | jq ".logs[-1]"'
```
