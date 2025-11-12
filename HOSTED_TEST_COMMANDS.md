# Quick Test Commands

After deployment completes (~30 seconds), run:

```bash
# Trigger GitHub ingestion on hosted backend
curl -X POST https://portana-api.aahil-khan.tech/api/admin/ingest/github \
  -H "Content-Type: application/json"

# Check logs to see ingestion progress
curl https://portana-api.aahil-khan.tech/api/admin/logs?limit=50&level=info | jq '.logs[] | select(.component=="GitHubIngestor")' | head -50

# Verify vectors were created in Qdrant  
# (This requires accessing Qdrant directly - may not be exposed)

# Test chat references GitHub
SESSION_ID="test-$(date +%s)"
curl -X POST https://portana-api.aahil-khan.tech/api/chat/message \
  -H "Content-Type: application/json" \
  -d "{
    \"sessionId\": \"$SESSION_ID\",
    \"message\": \"What projects have you built?\"
  }" | jq '.'
```

**Expected Results:**
- Ingest endpoint returns `success: true` with vector count
- Logs show all 4 repos being processed
- Chat response mentions GitHub repos with links
