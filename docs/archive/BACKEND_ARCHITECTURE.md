# Portana Backend Architecture

## 🎯 Core Concept
**Single-user AI portfolio**: One person (you, Aahil) hosts their own instance. Visitors ask questions about YOUR projects, skills, and experience. The system answers accurately by referencing your resume, GitHub, Medium, and other sources.

---

## 📊 Data Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                    ONBOARDING (One-time Setup)                  │
└─────────────────────────────────────────────────────────────────┘
                                 ↓
                    ┌─────────────────────────┐
                    │   Step 1: Basic Profile │
                    │ (name, bio, links, bio) │
                    └─────────────────────────┘
                                 ↓
                    ┌─────────────────────────┐
                    │   Step 2: Resume Upload │
                    │  & Parsing              │
                    └─────────────────────────┘
                                 ↓
            ┌──────────────────────────────────────────┐
            │  Parse with GPT-3.5T (4 parallel calls) │
            ├──────────────────────────────────────────┤
            │ ✓ Extract Skills (with taxonomy)        │
            │ ✓ Extract Experience (job history)      │
            │ ✓ Extract Education (degrees)           │
            │ ✓ Extract Summary (professional bio)    │
            └──────────────────────────────────────────┘
                                 ↓
            ┌──────────────────────────────────────────┐
            │  3-Tier Vector Embeddings (TEE Model)   │
            ├──────────────────────────────────────────┤
            │ Tier 1: Skill vectors                   │
            │         (e.g., "React", "Python", etc)  │
            │ Tier 2: Experience vectors              │
            │         (job descriptions as chunks)    │
            │ Tier 3: Resume chunk vectors            │
            │         (full resume text split)        │
            └──────────────────────────────────────────┘
                                 ↓
            ┌──────────────────────────────────────────┐
            │  Store in Qdrant Vector Database        │
            │  (Semantic search capability)           │
            └──────────────────────────────────────────┘
                                 ↓
            ┌──────────────────────────────────────────┐
            │  Save to SQLite Database                │
            │  (Backup + relational queries)          │
            └──────────────────────────────────────────┘


┌─────────────────────────────────────────────────────────────────┐
│                    CHAT INTERFACE (Production)                  │
│              (Visitors ask questions about Aahil)               │
└─────────────────────────────────────────────────────────────────┘

Visitor: "Who is Aahil?"
                    ↓
        POST /api/chat/ask
        { sessionId, message, ... }
                    ↓
    ┌────────────────────────────────┐
    │  1. Embed visitor's question   │
    │     (text-embedding-3-small)   │
    └────────────────────────────────┘
                    ↓
    ┌────────────────────────────────┐
    │  2. Vector search in Qdrant    │
    │     Find top-3 relevant chunks │
    │     (skills, experience, bio)  │
    └────────────────────────────────┘
                    ↓
    ┌────────────────────────────────┐
    │  3. Build context from results │
    │  - Extracted skills            │
    │  - Job descriptions            │
    │  - Resume snippets             │
    │  - Links to sources            │
    │  - Persona (if set)            │
    └────────────────────────────────┘
                    ↓
    ┌────────────────────────────────┐
    │  4. Build system prompt        │
    │  "You are Aahil's AI assistant │
    │   Answer based on this context │
    │   and link to sources..."      │
    └────────────────────────────────┘
                    ↓
    ┌────────────────────────────────┐
    │  5. Call GPT-4 / GPT-3.5T      │
    │  Streaming response             │
    └────────────────────────────────┘
                    ↓
    Response (with links):
    "Aahil is a 3rd-year CS student...
     He's built React apps [link to repo]
     And published on Medium [link to article]"
```

---

## 🗂️ Data Storage

### Option 1: In-Memory (Development Only)
```typescript
// Current state (portana-backend/src/onboarding/onboarding.ts)
const sessions = new Map<string, OnboardingSession>();
const logBuffer: LogEntry[] = []; // Max 500 entries

// Good for: Testing, demos
// Bad for: Production (data lost on restart)
```

### Option 2: SQLite (Recommended for MVP)
```typescript
// Should be implemented in: backend/src/db/
// Tables needed:
// - users (id, name, email, bio, ...)
// - skills (id, user_id, name, category, proficiency)
// - experience (id, user_id, title, company, duration, description)
// - education (id, user_id, degree, institution, field)
// - sources (id, user_id, source_type, url, link) // GitHub, Medium, etc
// - vectors (id, user_id, embedding, text, type, metadata)

// Good for: Simple, self-hosted, portable
// Cost: Zero
// Querying: SQL + vector search via Qdrant
```

### Option 3: PostgreSQL (Scale later)
```typescript
// For when you want cloud hosting + vector extensions (pgvector)
// Don't do this now - focus on MVP first
```

---

## 🔄 Key Services

### 1. **ResumeParserService** (`backend/src/services/resume-parser.ts`)
```
Responsibility: Extract structured data from resume text
Input: Raw resume text (PDF → text extraction already done)
Output: 
  {
    skills: [{ name, category, proficiency }],
    experience: [{ title, company, duration, description }],
    education: [{ degree, institution, field }],
    summary: string
  }
Process:
  1. Split resume into 4 parallel GPT-3.5T calls
  2. Each call extracts one section (skills/exp/edu/summary)
  3. Constrain skills to known taxonomy (no hallucination)
  4. Return structured JSON
Cost: ~$0.01 per resume
Time: 2-5 seconds
```

### 2. **EmbedderService** (`backend/src/services/embedder.ts`)
```
Responsibility: Convert text to vectors + store in Qdrant
Input: Parsed resume data
Output: 1536-dimensional vectors in Qdrant
Process (3-tier):
  Tier 1: Skill vectors
    For each skill: embed "Python - 5 years backend development"
    Store with tag: type: "skill"
    
  Tier 2: Experience vectors  
    For each job: embed full job description
    Store with tag: type: "experience", company: "X"
    
  Tier 3: Resume chunk vectors
    Split resume into ~500 char chunks
    Embed each chunk
    Store with tag: type: "resume_chunk"

Model: text-embedding-3-small (1536 dims, cheap)
Cost: ~$0.02 per 1M tokens → negligible for one resume
```

### 3. **RetrieverService** (`backend/src/services/retriever.ts`)
```
Responsibility: Find relevant content when visitor asks question
Input: Visitor's question (embedded)
Output: Top-3 most relevant chunks with scores

Example:
  Q: "What practices did you follow in your backend?"
  → Retrieves:
     1. Experience chunk about backend role (score 0.89)
     2. Skill vector for "backend design patterns" (score 0.85)
     3. Resume chunk mentioning specific practices (score 0.82)
```

### 4. **ChatService** (`backend/src/chat/chat-service.ts`)
```
Responsibility: Generate conversational responses
Input: User message + context from retriever
Output: Streaming or complete response

Process:
  1. Embed user message
  2. Retrieve relevant context (top-3)
  3. Build system prompt:
     "You are Aahil's AI. Answer based on:
      - Skills: [list from vectors]
      - Experience: [description from vectors]
      - Bio: [from step 1]
      Reference links when mentioning projects/articles"
  4. Call GPT (streaming or not)
  5. Return response + source links

Example System Prompt:
  "You are an AI assistant representing Aahil Khan.
   
   Context about Aahil:
   - Skills: React, Python, Node.js, TypeScript
   - Experience: Built 3 full-stack applications
   - Bio: 3rd year CS student interested in AI
   
   Retrieved Content:
   - 'Implemented auth system using JWT in backend'
   - 'Deployed on Vercel'
   - 'Published backend architecture on Medium: [link]'
   
   When answering:
   1. Reference the context
   2. Include links when applicable
   3. Be accurate - don't hallucinate
   4. Mention if asked about something not in your knowledge"
```

---

## 📡 API Endpoints

### Onboarding (Setup)
```
POST   /api/onboarding/start
       Body: { name, email, bio, website, githubUrl, linkedinUrl }
       Returns: { user_id, session_token }

POST   /api/onboarding/:sessionId/step/2
       Body: { resumeText: string }
       Returns: { success, skills, experience, education }

GET    /api/onboarding/:sessionId/debug
       Returns: Full session state (for debugging)

GET    /api/admin/logs?limit=50&level=info
       Returns: Recent logs (for production debugging)
```

### Chat (Production)
```
POST   /api/chat/ask
       Body: { sessionId, message, onboardingSessionId? }
       Returns: Server-Sent Events (streaming)
       
POST   /api/chat/message
       Body: { sessionId, message, onboardingSessionId? }
       Returns: { response, tokensUsed? }

GET    /api/chat/:sessionId/history
       Returns: { messages: ChatMessage[] }

POST   /api/chat/:sessionId/clear
       Clears conversation history
```

### Admin
```
GET    /api/admin/vectors
       Returns: Vector count + stats

DELETE /api/admin/vectors/:projectId
       Clears all vectors for a project

GET    /api/admin/logs
       Returns: Recent log entries
```

---

## 🔗 How Links Get Referenced

**Goal**: When answering about a project, automatically include links

**Current Implementation** (in ChatService):
```typescript
// Build context with sources
const retrievedContext = await retriever.search(...);

// Results include payload with source info
// Example payload:
// {
//   text: "Implemented auth with JWT",
//   source: "https://github.com/aahil-khan/ProjectX",
//   type: "experience",
//   projectId: "project-x"
// }

// Build system prompt that says:
// "Reference: [link] when discussing this project"

// Chat responds with link embedded in text
```

**What's Missing** (needs to be designed):
1. How do we track which skill/experience maps to which GitHub repo?
2. How do we add Medium article links for specific topics?
3. How do we structure "sources" in the database?

**Proposed Solution**:
```typescript
// In Step 2 (or new Step 3):
// Let user map each skill/experience to source URLs

// Example:
// Skill: "React" → 
//   GitHub repos: [ProjectX, ProjectY]
//   Medium articles: [article1, article2]

// Experience: "Backend at X" →
//   GitHub: [repo-link]
//   Medium: [architecture-article]

// Then vectors include: { ...payload, linkedSources: [...] }

// Chat can then say:
// "I built X with React. See projects [link1], [link2]
//  I also wrote about this here [medium-link]"
```

---

## 🚀 Current Status

### ✅ Done
- [x] Resume parsing (GPT-3.5T extraction)
- [x] Vector embeddings (3-tier setup)
- [x] Qdrant integration
- [x] Chat service architecture
- [x] Chat streaming + history
- [x] Step 1 (basic profile)
- [x] Step 2 (resume parsing)

### ⏳ In Progress
- [ ] Data persistence (SQLite)
- [ ] Step 2 proficiency levels (user edits after parsing)
- [ ] Source linking (map skills/experience to URLs)

### ❌ Not Started
- [ ] Steps 3-5 (skipping for now to focus on chat)
- [ ] Production deployment (data layer)
- [ ] Frontend chat interface

---

## 💡 MVP Plan

To get the "cool part" (chat) working fast:

### Phase 1: Manual Seed Data (1 hour)
```bash
# Run onboarding locally
npm run dev (backend)
# Fill Step 1 + Step 2
# Get session ID

# Export to SQLite
curl http://localhost:3001/api/onboarding/SESSION_ID/debug > session.json
# Insert into database manually
```

### Phase 2: Chat Interface (2-3 hours)
```
Build frontend:
- Chat box
- Session management  
- Message history
- Streaming display
```

### Phase 3: Test End-to-End (1 hour)
```
1. Ask: "Who is Aahil?" 
   → Should respond with bio + links
2. Ask: "What backend practices did you use?"
   → Should reference resume content + GitHub links
3. Ask: "Show me your projects"
   → Should list projects with Medium links
```

### Phase 4: Deploy (1 hour)
```
Deploy to server with embedded data
(no public onboarding yet)
```

### Phase 5: Add Public Onboarding (Later)
```
Once MVP works, add Steps 3-5
Allow self-hosted users to onboard
```

---

## 🔑 Key Insights

1. **Data is immutable** - Once onboarded, your resume doesn't change per-user
2. **Vectors enable semantic search** - Visitors can ask in natural language
3. **Links are the differentiator** - Not just answering, but proving it with sources
4. **GPT context is everything** - Good system prompts = good answers
5. **Single-user simplifies things** - No multi-tenancy complexity

---

## 📝 Next Steps

1. **Decide on proficiency levels** - Should users rate skills after parsing?
2. **Design source mapping** - How to link skills/experience to GitHub/Medium?
3. **Build SQLite schema** - Where to store all this data persistently?
4. **Focus on chat** - That's where the magic happens
