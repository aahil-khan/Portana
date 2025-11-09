# PHASE 10: Deployment Guide

This guide covers deploying Portfolio OS using:
1. **Local Development**: Docker + Cloudflared tunnel
2. **Production**: Heroku with CI/CD pipelines (demo/prod)

---

## Local Development: Home Server + Cloudflared

### Prerequisites
- Docker and Docker Compose installed
- Cloudflared CLI installed
- Home server with decent specs (2GB RAM minimum)
- `.env` file with required secrets

### Step 1: Prepare Environment

```bash
# Copy environment template
cp .env.production.template .env

# Edit .env with your values
# Required:
# - OPENAI_API_KEY
# - JWT_SECRET (generate: openssl rand -base64 32)
# - WEBHOOK_SECRET (generate: openssl rand -base64 32)
# - MASTER_SECRET (generate: openssl rand -base64 32)
nano .env
```

### Step 2: Build and Start Containers

```bash
# Build Docker image
docker-compose build

# Start services (backend + Qdrant)
docker-compose up -d

# Check logs
docker-compose logs -f backend

# Verify backend is running
curl http://localhost:3000/health
```

### Step 3: Set Up Cloudflared Tunnel

```bash
# Install cloudflared if not already installed
# macOS:
brew install cloudflare/cloudflare/cloudflared

# Linux:
curl -L --output cloudflared.deb https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb
sudo dpkg -i cloudflared.deb

# Create tunnel
cloudflared tunnel create portfolio-os

# Configure tunnel to route to localhost:3000
cloudflared tunnel route dns portfolio-os your-custom-domain.com

# Start tunnel
cloudflared tunnel run portfolio-os

# In another terminal, verify it's working
curl https://your-custom-domain.com/health
```

### Step 4: Test the Setup

```bash
# Test onboarding endpoint
curl -X POST https://your-custom-domain.com/api/onboarding/session \
  -H "Content-Type: application/json" \
  -d '{"user_id": "test-user"}'

# Test chat endpoint
curl -X POST https://your-custom-domain.com/api/chat/session \
  -H "Content-Type: application/json" \
  -d '{"user_id": "test-user"}'

# Check health
curl https://your-custom-domain.com/api/health
```

### Troubleshooting Local Deployment

**Backend container won't start:**
```bash
# Check logs
docker-compose logs backend

# Verify environment variables
docker-compose config | grep OPENAI

# Rebuild from scratch
docker-compose down -v
docker-compose build --no-cache
docker-compose up
```

**Qdrant connection issues:**
```bash
# Check Qdrant status
curl http://localhost:6333/health

# View Qdrant logs
docker-compose logs qdrant

# Restart Qdrant
docker-compose restart qdrant
```

**Cloudflared tunnel not working:**
```bash
# Check tunnel status
cloudflared tunnel list

# Restart tunnel
cloudflared tunnel run portfolio-os

# Verify DNS is correct
dig your-custom-domain.com
```

---

## Production Deployment: Heroku

### Prerequisites
- Heroku CLI installed (`brew install heroku/brew/heroku`)
- Heroku account
- GitHub repository with this code

### Step 1: Create Heroku Apps

```bash
# Login to Heroku
heroku login

# Create production app
heroku create portfolio-os-prod --region us

# Create demo app
heroku create portfolio-os-demo --region us

# Verify apps created
heroku apps
```

### Step 2: Configure Procfile

Create a `Procfile` in the root directory:

```procfile
web: npm run start
release: npm run migrate
```

### Step 3: Set Environment Variables

```bash
# Production app
heroku config:set \
  NODE_ENV=production \
  OPENAI_API_KEY=sk-... \
  JWT_SECRET=... \
  WEBHOOK_SECRET=... \
  MASTER_SECRET=... \
  QDRANT_URL=http://qdrant:6333 \
  LOG_LEVEL=info \
  --app portfolio-os-prod

# Demo app  
heroku config:set \
  NODE_ENV=production \
  OPENAI_API_KEY=sk-... \
  JWT_SECRET=... \
  WEBHOOK_SECRET=... \
  MASTER_SECRET=... \
  QDRANT_URL=http://qdrant:6333 \
  LOG_LEVEL=debug \
  --app portfolio-os-demo
```

### Step 4: Add Qdrant Database

Heroku doesn't have native Qdrant support. Use these options:

**Option A: External Qdrant Service**
```bash
# Use Qdrant Cloud (managed service)
# 1. Sign up at cloud.qdrant.io
# 2. Create cluster
# 3. Set environment variable
heroku config:set \
  QDRANT_URL=https://your-cluster-url \
  QDRANT_API_KEY=... \
  --app portfolio-os-prod
```

**Option B: Docker Container**
```bash
# Use Heroku container registry
# This requires Pro dyno and additional setup
heroku stack:set container --app portfolio-os-prod
```

### Step 5: Set Up GitHub Integration

```bash
# In Heroku Dashboard:
# 1. Go to Deploy tab
# 2. Connect GitHub
# 3. Search for your repository
# 4. Click "Connect"
# 5. Enable "Automatic deploys" from main branch
```

### Step 6: Manual Deployment

```bash
# Push to production
git push heroku main --app portfolio-os-prod

# Or deploy from Docker
heroku container:push web --app portfolio-os-prod
heroku container:release web --app portfolio-os-prod

# Check logs
heroku logs --tail --app portfolio-os-prod
```

### Step 7: Set Up Demo/Prod Pipeline

```bash
# Create pipeline
heroku pipelines:create portfolio-os \
  --app portfolio-os-prod \
  --stage production

# Add demo app to pipeline
heroku pipelines:add portfolio-os \
  --app portfolio-os-demo \
  --stage staging

# Promote demo to production after testing
heroku pipelines:promote --app portfolio-os-demo
```

---

## CI/CD Pipeline Setup

### GitHub Actions Workflow

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy to Heroku

on:
  push:
    branches:
      - main
      - develop

jobs:
  deploy:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Deploy to Heroku Demo
        if: github.ref == 'refs/heads/develop'
        run: |
          git remote add heroku-demo https://heroku:${{ secrets.HEROKU_API_KEY }}@git.heroku.com/portfolio-os-demo.git
          git push heroku-demo develop:main
      
      - name: Deploy to Heroku Production
        if: github.ref == 'refs/heads/main'
        run: |
          git remote add heroku-prod https://heroku:${{ secrets.HEROKU_API_KEY }}@git.heroku.com/portfolio-os-prod.git
          git push heroku-prod main:main
```

### Manual Testing Checklist

Before promoting demo to production:

```bash
# 1. Test onboarding
curl -X POST https://portfolio-os-demo.herokuapp.com/api/onboarding/session

# 2. Test chat
curl -X POST https://portfolio-os-demo.herokuapp.com/api/chat/session

# 3. Check health
curl https://portfolio-os-demo.herokuapp.com/api/health

# 4. Monitor logs
heroku logs --tail --app portfolio-os-demo

# 5. If all good, promote to production
heroku pipelines:promote --app portfolio-os-demo
```

---

## Monitoring & Logs

### View Logs

```bash
# Real-time logs (local)
docker-compose logs -f backend

# Real-time logs (Heroku)
heroku logs --tail --app portfolio-os-prod

# Filter by component
heroku logs --dyno=web --app portfolio-os-prod
```

### Health Checks

```bash
# Local
curl http://localhost:3000/health

# Production
curl https://portfolio-os-prod.herokuapp.com/api/health

# Expected response
{
  "status": "ok",
  "timestamp": "2025-11-09T12:00:00Z",
  "uptime": 3600,
  "services": {
    "database": "connected",
    "qdrant": "connected"
  }
}
```

---

## Backup & Recovery

### Local Backups

```bash
# Backup Qdrant data
docker-compose exec qdrant tar czf /tmp/qdrant-backup.tar.gz /qdrant/storage
docker cp portfolio-os-qdrant:/tmp/qdrant-backup.tar.gz ./backups/

# Backup SQLite database
cp ./data/portfolio.db ./backups/portfolio.db.$(date +%Y%m%d-%H%M%S)
```

### Heroku Backups

```bash
# Qdrant Cloud backups are automatic
# Manual backup of Qdrant:
# 1. Log into Qdrant Cloud console
# 2. Select cluster
# 3. Download backup

# PostgreSQL (if using)
heroku pg:backups:capture --app portfolio-os-prod
heroku pg:backups:download --app portfolio-os-prod
```

---

## Scaling

### Local Scaling
```bash
# Increase container resources in docker-compose.yml
# Add to backend service:
deploy:
  resources:
    limits:
      cpus: '2'
      memory: 2G
```

### Heroku Scaling
```bash
# Scale dynos
heroku ps:scale web=2 --app portfolio-os-prod

# Change dyno type
heroku ps:type web=standard-1x --app portfolio-os-prod

# View current dyno info
heroku ps --app portfolio-os-prod
```

---

## Next Steps

1. ✅ Set up local development with Cloudflared
2. ✅ Create Heroku apps for demo/prod
3. ✅ Configure CI/CD pipeline
4. ✅ Set up monitoring and alerts
5. ✅ Document runbooks for common issues

See `README.md` for developer setup and contribution guidelines.
