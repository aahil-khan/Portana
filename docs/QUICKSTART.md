# Quick Start: Local Development with Docker + Cloudflared

## 1-Minute Setup

### Prerequisites
```bash
# Install Docker Desktop (includes Docker Compose)
# https://www.docker.com/products/docker-desktop

# Install Cloudflared
brew install cloudflare/cloudflare/cloudflared  # macOS
# or download from https://developers.cloudflare.com/cloudflare-one/downloads/
```

### Step 1: Start Backend

```bash
# Copy environment template
cp .env.production.template .env

# Edit .env and add:
# - OPENAI_API_KEY=sk-...
# - JWT_SECRET=<generate: openssl rand -base64 32>
# - WEBHOOK_SECRET=<generate: openssl rand -base64 32>
# - MASTER_SECRET=<generate: openssl rand -base64 32>

# Start Docker containers
docker-compose up -d

# Verify backend is running
curl http://localhost:3000/health
```

### Step 2: Set Up Cloudflared Tunnel

```bash
# Create tunnel
cloudflared tunnel create portfolio-os

# Route your domain
cloudflared tunnel route dns portfolio-os yourdomain.com

# Start tunnel (in new terminal)
cloudflared tunnel run portfolio-os

# Test it
curl https://yourdomain.com/health
```

### Step 3: Test the API

```bash
# Test onboarding
curl -X POST https://yourdomain.com/api/onboarding/session \
  -H "Content-Type: application/json" \
  -d '{"user_id": "test"}'

# Test chat
curl -X POST https://yourdomain.com/api/chat/stream \
  -H "Content-Type: application/json" \
  -d '{"session_id": "test", "query": "Tell me about yourself"}'
```

## Common Commands

```bash
# View logs
docker-compose logs -f backend

# Stop containers
docker-compose down

# Rebuild and restart
docker-compose build --no-cache
docker-compose up -d

# Restart tunnel
# Press Ctrl+C in tunnel terminal, then:
cloudflared tunnel run portfolio-os

# Connect to Qdrant API directly
curl http://localhost:6333/health
```

## Troubleshooting

**Backend won't start?**
```bash
docker-compose logs backend
# Check if OPENAI_API_KEY is set in .env
```

**Tunnel not working?**
```bash
# Verify DNS
dig yourdomain.com

# Restart tunnel
cloudflared tunnel run portfolio-os --verbose
```

**Qdrant connection error?**
```bash
# Qdrant needs time to start, wait 10-15 seconds
# Check Qdrant status
curl http://localhost:6333/health
```

## Next Steps

1. ✅ Backend running locally with Docker
2. ✅ Cloudflared tunnel set up
3. 📝 Now build frontend with v0 (pointing to your domain)
4. 🚀 When ready, deploy to Heroku (see DEPLOYMENT_GUIDE.md)

See full DEPLOYMENT_GUIDE.md for production setup.
