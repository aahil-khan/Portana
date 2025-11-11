# Data Ingestion Strategy - Comprehensive Source Integration

## 🎯 Goal
Chunk ALL of Aahil's content sources into vectors so chat can reference them with links:
- Resume (parsed)
- GitHub READMEs (all repos)
- Medium articles (all posts)
- Miscellaneous (projects list, blog posts, etc)

---

## 📋 Data Sources to Ingest

### 1. **Resume** (Already doing)
```
Source: Step 2 upload
Type: "resume"
Content:
  - Skills (individual + grouped)
  - Experience (job descriptions)
  - Education
  - Summary
Chunking: 3-tier (skills, experiences, chunks)
Links: N/A (it's the source itself)
Example vector:
  { text: "3 years of React development", 
    source: "resume",
    type: "skill",
    link: null }
```

### 2. **GitHub READMEs** (To add)
```
Source: GitHub API
Type: "github_readme"
Content: README.md of each repo you want to showcase
Chunking: Split README into ~500 char chunks
Links: URL to repo, URL to specific commit/section
Example vector:
  { text: "This project implements a WebSocket server...",
    source: "github_readme",
    projectId: "portfolio-ai",
    link: "https://github.com/aahil-khan/portfolio-ai#readme",
    repoUrl: "https://github.com/aahil-khan/portfolio-ai" }
```

### 3. **Medium Articles** (To add)
```
Source: Medium RSS or API
Type: "medium_article"
Content: Article body (scraped or via API)
Chunking: Split articles into ~500 char chunks
Links: URL to article, URL to specific section
Example vector:
  { text: "We used a monolithic architecture initially...",
    source: "medium_article",
    articleId: "backend-architecture-guide",
    link: "https://medium.com/@aahil-khan/backend-architecture-guide",
    author: "Aahil Khan",
    publishedDate: "2024-11-01" }
```

### 4. **Projects List** (To add)
```
Source: Manual or auto-generated
Type: "projects_list"
Content: Curated list of projects with descriptions
Chunking: Each project as separate chunks
Links: URL to project (repo, deployed site, etc)
Example vector:
  { text: "Portfolio AI - An AI assistant that knows about my skills and projects",
    source: "projects_list",
    projectId: "portfolio-ai",
    link: "https://github.com/aahil-khan/portfolio-ai",
    deployedUrl: "https://portana.aahil-khan.tech",
    tags: ["AI", "TypeScript", "React"] }
```

### 5. **Miscellaneous** (Blog posts, case studies, etc)
```
Source: Various
Type: "blog_post", "case_study", "tutorial"
Content: Full text
Chunking: Split into logical sections
Links: URL to content
```

---

## 🔄 Data Flow (Updated)

```
┌──────────────────────────────────────┐
│      Data Ingestion Pipeline         │
└──────────────────────────────────────┘
           ↓
    ┌─────────────────────────────────┐
    │  Source 1: Resume (Step 2)      │ → Already implemented
    │  Source 2: GitHub READMEs       │ → Need to add
    │  Source 3: Medium Articles      │ → Need to add
    │  Source 4: Projects List        │ → Need to add
    │  Source 5: Misc Content         │ → Need to add
    └─────────────────────────────────┘
           ↓
    ┌─────────────────────────────────┐
    │  Extract Text Content           │
    │  (PDFs → text done)             │
    │  (GitHub → fetch README)        │
    │  (Medium → scrape or API)       │
    │  (Manual → copy/paste)          │
    └─────────────────────────────────┘
           ↓
    ┌─────────────────────────────────┐
    │  Chunk Content                  │
    │  Split into ~500 char pieces    │
    │  Keep source + link metadata    │
    └─────────────────────────────────┘
           ↓
    ┌─────────────────────────────────┐
    │  Embed Chunks                   │
    │  (text-embedding-3-small)       │
    │  Generate 1536-dim vectors      │
    └─────────────────────────────────┘
           ↓
    ┌─────────────────────────────────┐
    │  Upsert to Qdrant               │
    │  Store with source metadata     │
    └─────────────────────────────────┘
           ↓
    ┌─────────────────────────────────┐
    │  Save to SQLite (optional)      │
    │  For backup + relational queries│
    └─────────────────────────────────┘


When visitor asks a question:
    
    Question: "What projects have you built?"
                    ↓
    Embed question → search Qdrant
                    ↓
    Top-3 results:
    1. projects_list chunk (score 0.95)
       link: [projects spreadsheet/page]
    2. GitHub README chunk (score 0.92)
       link: [specific repo]
    3. Medium article chunk (score 0.88)
       link: [specific article section]
                    ↓
    Response with all 3 links embedded
```

---

## 🛠️ Implementation Plan

### **Phase 1: GitHub Integration**
```typescript
// New service: backend/src/services/github-ingestor.ts
class GitHubIngestor {
  async fetchREADME(username: string, repo: string): Promise<string>
  async fetchAllRepos(username: string): Promise<Repo[]>
  async chunkAndEmbed(readme: string, repoUrl: string): Promise<VectorPoint[]>
}

// Usage:
const ingestor = new GitHubIngestor();
const repos = await ingestor.fetchAllRepos('aahil-khan');
const vectors = await Promise.all(
  repos.map(r => ingestor.chunkAndEmbed(r.readme, r.url))
);
await qdrant.upsert(vectors.flat());
```

**What to fetch:**
- README.md content
- Project description
- Topics/tags
- Deploy URL (if available in repo description)

**How to chunk:**
```
README structure:
  # Project Name → separate chunk
  ## Description → separate chunk
  ## Features → one or more chunks (500 char each)
  ## Tech Stack → separate chunk
  ## How to use → separate chunks
  ## Results → separate chunks

Each chunk includes:
  {
    text: content,
    source: "github_readme",
    repo: "repo-name",
    repoUrl: "https://github.com/aahil-khan/repo-name",
    section: "Features" or "Description" etc,
    link: "https://github.com/aahil-khan/repo-name#features"
  }
```

### **Phase 2: Medium Integration**
```typescript
// New service: backend/src/services/medium-ingestor.ts
class MediumIngestor {
  async fetchRSSFeed(mediumUsername: string): Promise<Article[]>
  async scrapeArticle(url: string): Promise<string>
  async chunkAndEmbed(article: Article): Promise<VectorPoint[]>
}

// Usage (run periodically):
const ingestor = new MediumIngestor();
const articles = await ingestor.fetchRSSFeed('aahil-khan');
const vectors = await Promise.all(
  articles.map(a => ingestor.chunkAndEmbed(a))
);
await qdrant.upsert(vectors.flat());
```

**Options:**
- Option A: Use Medium RSS feed (https://medium.com/feed/@username)
  - Free, no API key needed
  - Gets article metadata + excerpt
  - Need to scrape full content separately
  
- Option B: Use Medium API (official)
  - Requires Medium Partner Program enrollment
  - Official but limited

- Option C: Use Puppeteer/Playwright
  - Scrape Medium directly
  - Works but Medium may block

**Recommendation**: Start with **RSS + simple HTML scraping**

### **Phase 3: Projects List**
```typescript
// Simple approach: JSON file + embedding service
// File: backend/data/projects.json
{
  projects: [
    {
      name: "Portfolio AI",
      description: "AI assistant for portfolio",
      url: "https://github.com/aahil-khan/portfolio-ai",
      deployedUrl: "https://portana.aahil-khan.tech",
      tags: ["AI", "TypeScript", "React"],
      highlights: ["vector search", "streaming chat", "self-hosted"]
    },
    // ... more projects
  ]
}

// Service: backend/src/services/projects-ingestor.ts
class ProjectsIngestor {
  async ingestProjectsList(jsonPath: string): Promise<VectorPoint[]>
  // Create vectors for each project
}
```

### **Phase 4: Miscellaneous Content**
```typescript
// Generic ingestor for blog posts, case studies, etc
// Can be:
// - Files (markdown, PDF)
// - URLs (paste content into admin panel)
// - Database (manual entry)

// Service: backend/src/services/content-ingestor.ts
class ContentIngestor {
  async ingestMarkdownFile(path: string, metadata: {}): Promise<VectorPoint[]>
  async ingestText(text: string, metadata: {}): Promise<VectorPoint[]>
  async ingestURL(url: string, metadata: {}): Promise<VectorPoint[]>
}
```

---

## 🗄️ Database Schema (SQLite)

```sql
-- Core tables
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  name TEXT,
  email TEXT UNIQUE,
  bio TEXT,
  website TEXT,
  githubUrl TEXT,
  linkedinUrl TEXT,
  createdAt DATETIME
);

-- Content sources
CREATE TABLE content_sources (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  type TEXT, -- 'resume', 'github_readme', 'medium_article', 'project', 'blog_post'
  title TEXT,
  url TEXT,
  source_metadata JSON, -- { repoUrl, articleId, projectId, etc }
  content TEXT,
  last_fetched DATETIME,
  last_updated DATETIME,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Chunks (for search index)
CREATE TABLE content_chunks (
  id TEXT PRIMARY KEY,
  source_id TEXT,
  chunk_index INTEGER,
  text TEXT,
  metadata JSON, -- { section, projectId, tags, etc }
  created_at DATETIME,
  FOREIGN KEY (source_id) REFERENCES content_sources(id)
);

-- Vectors in Qdrant (not in SQLite)
-- But reference mapping:
CREATE TABLE vector_mappings (
  vector_id TEXT PRIMARY KEY,
  chunk_id TEXT,
  embedding_model TEXT, -- 'text-embedding-3-small'
  dimensions INTEGER,
  created_at DATETIME,
  FOREIGN KEY (chunk_id) REFERENCES content_chunks(id)
);

-- Chat sessions
CREATE TABLE chat_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  created_at DATETIME,
  last_activity DATETIME,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Chat history
CREATE TABLE chat_messages (
  id TEXT PRIMARY KEY,
  session_id TEXT,
  role TEXT, -- 'user', 'assistant'
  content TEXT,
  created_at DATETIME,
  metadata JSON, -- { retrieved_sources, tokens_used, etc }
  FOREIGN KEY (session_id) REFERENCES chat_sessions(id)
);

-- Vector search logs (for analytics)
CREATE TABLE search_logs (
  id TEXT PRIMARY KEY,
  query TEXT,
  top_results JSON,
  timestamp DATETIME
);
```

---

## 📱 Admin Interface Needed

To manage all this content, you need an admin panel:

```
POST /api/admin/ingest/github
  Body: { username: string, repoFilter?: string[] }
  Action: Fetch all repos, chunk READMEs, embed, upsert to Qdrant
  Returns: { count: 45, vectors_created: 180, sources: [...] }

POST /api/admin/ingest/medium
  Body: { username: string }
  Action: Fetch RSS, scrape articles, chunk, embed
  Returns: { count: 12, vectors_created: 240, sources: [...] }

POST /api/admin/ingest/projects
  Body: { projectsJsonPath: string }
  Action: Load projects.json, chunk each, embed
  Returns: { count: 8, vectors_created: 24, sources: [...] }

POST /api/admin/ingest/content
  Body: { type: string, title: string, content: string, url?: string }
  Action: Chunk and embed custom content
  Returns: { vectorId, chunksCreated: 5 }

GET /api/admin/sources
  Returns: All ingested sources with metadata

DELETE /api/admin/sources/:sourceId
  Action: Delete source + all its vectors from Qdrant + SQLite
  Returns: { deleted: true, vectorsRemoved: 15 }

GET /api/admin/ingest/status
  Returns: Last ingest time for each source type, vector counts
```

---

## 🔄 Ingestion Workflow (How to Use)

### **Step 1: One-time setup**
```bash
# Run backend in dev mode
cd backend && npm run dev

# Trigger ingestions via admin endpoints
curl -X POST http://localhost:3001/api/admin/ingest/github \
  -H "Content-Type: application/json" \
  -d '{ "username": "aahil-khan" }'

curl -X POST http://localhost:3001/api/admin/ingest/medium \
  -H "Content-Type: application/json" \
  -d '{ "username": "aahil-khan" }'

curl -X POST http://localhost:3001/api/admin/ingest/projects \
  -H "Content-Type: application/json" \
  -d '{ "projectsJsonPath": "./data/projects.json" }'
```

### **Step 2: Verify ingestion**
```bash
# Check what got stored
curl http://localhost:3001/api/admin/sources

# Check Qdrant vector count
curl http://localhost:6333/collections/portfolio_content/points | jq '.result.points_count'
```

### **Step 3: Test chat**
```bash
# Ask a question that references ingested content
curl -X POST http://localhost:3001/api/chat/ask \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "test",
    "message": "What projects have you built?"
  }' \
  -N  # Get streaming response
```

### **Step 4: Deploy**
```bash
# Bundle database with vectors
# Deploy to server
```

---

## 📊 Ingestion Frequency

| Source | Frequency | Method |
|--------|-----------|--------|
| Resume | On-demand (Step 2) | Manual upload |
| GitHub READMEs | Daily/Weekly | Webhook (GitHub) + manual trigger |
| Medium Articles | Daily/Weekly | RSS feed polling |
| Projects List | On-demand | Manual edit + trigger |
| Misc Content | On-demand | Admin panel |

---

## 🔗 Result: Link-Rich Chat

Example conversation after full ingestion:

```
User: "What backend patterns do you use?"

System finds:
1. Resume skill vector (0.92) → no link
2. Medium article section (0.89) → link to article
3. GitHub README section (0.88) → link to repo

Response:
"I follow REST with GraphQL for flexible queries.
 I've written about this pattern here: [Medium article on backend architecture]
 You can see it in action in my Portfolio AI project: [GitHub repo]
 I also list some of these practices in my resume."

Total: 2 source links embedded naturally
```

---

## 🚀 Priority Order

### **MVP (Week 1)**
- [ ] GitHub README ingestion
- [ ] Projects list ingestion
- [ ] Test chat with all content

### **Phase 2 (Week 2)**
- [ ] Medium integration
- [ ] Admin panel for ingestion
- [ ] Auto-refresh schedule

### **Phase 3 (Week 3)**
- [ ] Blog post ingestion
- [ ] Content management UI
- [ ] Analytics on vector search

---

## 💡 Key Points

1. **Each chunk gets metadata** - Source URL, project ID, section, etc
2. **Search returns source links** - Not just text, but where to find it
3. **Periodic refresh** - GitHub/Medium change, so re-ingest weekly
4. **No hallucination** - Chat only references what's actually indexed
5. **Scalable** - Can add more sources without changing core chat logic

---

## 📝 Next Steps

1. Build GitHub ingestor service
2. Build Medium ingestor service  
3. Build admin ingestion endpoints
4. Create projects.json with your projects
5. Test end-to-end chat with all sources
6. Deploy with embedded vector data
