# Portana

**AI-powered resume processing and portfolio generator**

Portana helps you create and maintain your professional portfolio automatically. Upload your resume, and it generates a portfolio website, manages your professional data, and keeps everything in sync across platforms.

## 🚀 Quick Start

### Prerequisites
- Docker & Docker Compose
- Node.js 20+ (for local development)
- OpenAI API key
- Cloudflared tunnel (for local hosting)

### Local Development

```bash
# 1. Setup environment
cp .env.production.template .env
# Edit .env and add:
# - OPENAI_API_KEY=sk-...
# - JWT_SECRET=$(openssl rand -base64 32)
# - WEBHOOK_SECRET=$(openssl rand -base64 32)
# - MASTER_SECRET=$(openssl rand -base64 32)

# 2. Start containers
docker-compose up -d

# 3. Verify backend is running
curl http://localhost:3000/health

# 4. Setup Cloudflared tunnel (optional, for external access)
cloudflared tunnel create portana
cloudflared tunnel route dns portana yourdomain.com
cloudflared tunnel run portana

# Backend now accessible at https://yourdomain.com
```

See [QUICKSTART.md](./QUICKSTART.md) for more options.

## 📋 Architecture

### Core Stack
- **Backend**: Fastify (TypeScript) with streaming support
- **Database**: SQLite + Qdrant vector DB
- **AI**: OpenAI GPT-4 for resume analysis & content generation
- **Deployment**: Docker + Cloudflared (local), Heroku (production)

### Key Features
- **Resume Upload & Analysis**: Extract professional data from resumes
- **AI-Powered Content**: Generate portfolio content from resume data
- **Real-time Updates**: Webhook support for external integrations
- **Chat Interface**: Ask questions about your professional data
- **Admin Dashboard**: Manage portfolio and user data

## 🏗️ Project Structure

```
portana/
├── backend/                    # TypeScript/Fastify API
│   ├── src/
│   │   ├── config/            # Configuration management
│   │   ├── db/                # SQLite database
│   │   ├── services/          # Business logic
│   │   ├── routes/            # API endpoints
│   │   └── types/             # TypeScript types
│   ├── Dockerfile             # Container definition
│   └── package.json
├── docker-compose.yml         # Local dev environment
├── .github/workflows/         # CI/CD pipelines
│   └── deploy.yml            # Automated testing & deployment
├── docs/                      # Documentation
│   ├── archive/              # Development phase docs
│   ├── DEPLOYMENT_GUIDE.md   # Setup instructions
│   └── QUICKSTART.md         # Quick reference
└── README.md                 # This file
```

## 🚢 Deployment

### Development (Home Server)
Push to `dev` branch → home server rebuilds via self-hosted GitHub Actions runner:
```bash
git push origin dev
# → Tests run in cloud → Docker rebuilds on home server
```

### Production (Heroku)
Push to `main` branch → deploys to Heroku:
```bash
git push origin main
# → Tests run in cloud → Deploys to Heroku production
```

See [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md) for detailed setup.

## 🧪 Testing

```bash
cd backend

# Run all tests
npm test

# Run specific test suite
npm test -- vector.test.ts

# With coverage
npm test -- --coverage
```

**Test Status**: 147/152 passing (96.7%) - 5 tests intentionally skipped (require OpenAI API)

## 📚 Documentation

- **[QUICKSTART.md](./QUICKSTART.md)** - 1-minute setup guide
- **[DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md)** - Production & local setup
- **[Development Docs](./docs/archive/)** - Phase-by-phase implementation notes
- **[SKIPPED_TESTS_ANALYSIS.md](./docs/SKIPPED_TESTS_ANALYSIS.md)** - Why certain tests are skipped

## 🔐 Environment Variables

See `.env.production.template` for all available options:

```bash
# Required
OPENAI_API_KEY=sk-...
JWT_SECRET=<random-32-byte-string>
WEBHOOK_SECRET=<random-32-byte-string>
MASTER_SECRET=<random-32-byte-string>

# Optional
NODE_ENV=production
PORT=3000
LOG_LEVEL=info
```

## 🤝 API Overview

### Core Endpoints
- `POST /api/upload` - Upload and process resume
- `POST /api/chat` - Chat with portfolio data
- `GET /api/portfolio` - Retrieve portfolio data
- `GET /health` - Health check

### Admin Endpoints
- `GET /api/admin/stats` - System statistics
- `DELETE /api/admin/data` - Clear all data

See [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md) for full API documentation.

## 🎯 Development Roadmap

- ✅ Phase 1-9: Backend complete
- ✅ Phase 10: Deployment setup (Cloudflared + Heroku)
- ⏳ Phase 11: Frontend (React with streaming)
- ⏳ Phase 12: Performance optimization
- ⏳ Phase 13: Security hardening
- ⏳ Phase 14: Documentation
- ⏳ Phase 15: Launch

## 📞 Support

For issues or questions:
1. Check the [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md) troubleshooting section
2. Review test output: `npm test -- --verbose`
3. Check logs: `docker-compose logs backend`

## 📄 License

MIT

---

**Ready to get started?** → See [QUICKSTART.md](./QUICKSTART.md)
