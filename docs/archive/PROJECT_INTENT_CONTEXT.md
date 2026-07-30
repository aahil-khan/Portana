# PROJECT INTENT & CONTEXT

**Last Updated**: November 11, 2025  
**Project**: Portana - Living AI Personal Assistant

---

## 🎯 PROJECT INTENT

Build a **living AI personal assistant** of Aahil Khan that:
- Has comprehensive context about everything professionally: GitHub, LinkedIn, Medium, resume, projects, posts
- Answers ANY question about Aahil with accurate, sourced information
- Provides clickable links to sources when answering
- Serves as a long-lived, evolving digital twin

**Not an MVP.** A fully realized, production-quality product that gets deployed and lives on the internet.

---

## 📊 CURRENT STATE

### ✅ What Exists
- **Frontend**: Template built, needs refinement
- **Backend**: Template built, needs refinement + data integration
- **Resume Parser**: Implemented (GPT-3.5T, no hallucination)
- **Vector Embeddings**: Qdrant integration ready
- **Chat Service**: Architecture in place (streaming, context-aware)
- **Onboarding Flow**: Steps 1-2 partially working

### ❌ What's Missing
- **Data Ingestion**: GitHub READMEs, Medium articles, projects list not being chunked/embedded
- **Database Persistence**: SQLite schema not implemented
- **Data Flow**: Step 2 → vectors not fully wired
- **Source Linking**: Chat responses don't reference source URLs
- **Frontend Chat**: UI for visitors to ask questions

### 🔧 What Needs Refinement
- UI polish (template → production)
- Backend robustness (error handling, logging)
- Data quality (chunk size, metadata)
- Response accuracy (system prompts, context building)

---

## 📥 DATA INGESTION STRATEGY

Manually pump all your data into the system:

### Sources (Priority Order)
1. **Resume** → Parsed into skills, experience, education vectors
2. **GitHub READMEs** → Chunked from all your repos → vectors with repo links
3. **Medium Articles** → Scraped → chunked → vectors with article links
4. **Projects List** → Curated list → vectors with project URLs
5. **LinkedIn** → Profile content → vectors (optional, lower priority)

### Process
```
Source → Extract → Chunk (500 char) → Embed → Qdrant + SQLite
                                           ↓
                          Add metadata: { link, source, projectId, section }
```

### Output
Each vector carries metadata so chat can say:
"You built X using React [github-link]. You also wrote about it here [medium-link]"

---

## 🗣️ CHAT CAPABILITIES (Acceptance Criteria)

The AI **must** be able to:

### ✅ User Profile Questions
- "Who is Aahil Khan?"
- "What's your tech stack?"
- "What's your experience?"
- → Returns: Bio, skills list with categories, experience descriptions
- → Links: LinkedIn, GitHub profile

### ✅ Resume Questions
- "What skills do you have?"
- "Tell me about your experience"
- "What's your education?"
- → Returns: Resume data accurately
- → Links: Resume download (if applicable)

### ✅ Project Questions
- "What projects have you built?"
- "Show me your latest work"
- "What did you build with React?"
- → Returns: Project name, description, tech stack, key features
- → Links: GitHub repo, deployed URL, Medium article about it

### ✅ Technical Questions
- "What's your approach to system design?"
- "How do you handle authentication?"
- "What practices do you follow in backend?"
- → Returns: Answer grounded in your projects + resume
- → Links: Specific GitHub repos, Medium articles explaining approach

### ✅ Content Questions
- "Summarize your latest Medium posts"
- "What have you written about recently?"
- → Returns: Article summaries, key takeaways
- → Links: Medium article URLs

### Acceptance Point
System is "done" when all above categories work with accurate responses and proper source attribution.

---

## 🏗️ TECHNICAL ARCHITECTURE

### Data Layer
- **Vector DB**: Qdrant (semantic search)
- **Relational DB**: SQLite (persistence, metadata)
- **Content**: Chunks with { text, source, link, projectId, section }

### Processing Layer
- **Resume Parser**: GPT-3.5T (skills, experience, education)
- **Embedder**: OpenAI text-embedding-3-small (1536 dims)
- **Chunker**: Split content ~500 chars, preserve metadata
- **Deduplicator**: SHA256 hashing to avoid duplicate vectors

### Retrieval Layer
- **Retriever**: Vector search in Qdrant, top-3 results with scores
- **Reranker**: Diversify by source (skill, experience, article, etc)
- **Context Builder**: Assemble system prompt + retrieved chunks

### Chat Layer
- **ChatService**: Streaming + non-streaming responses
- **System Prompt**: Instructs AI to reference sources + include links
- **Memory**: Session-based conversation history
- **Output**: Text with embedded source links

### Admin Layer
- **Ingestors**: GitHub (fetch READMEs), Medium (fetch articles), Projects (manual)
- **Endpoints**: /api/admin/ingest/*, /api/admin/sources, /api/admin/status
- **Debugging**: /api/onboarding/*/debug, /api/admin/logs

---

## 🔄 DATA FLOW (Simplified)

```
Manual Ingestion:
  Resume (Step 2) → Parse → Embed → Qdrant
  GitHub READMEs → Chunk → Embed → Qdrant
  Medium Articles → Chunk → Embed → Qdrant
  Projects List → Chunk → Embed → Qdrant
                         ↓
                   SQLite Backup

Visitor asks question:
  Question → Embed → Search Qdrant (top-3)
                        ↓
                   Build Context
                   (retrieved chunks + metadata)
                        ↓
                   Build System Prompt
                   "Answer based on: [context]
                    Reference sources when mentioning"
                        ↓
                   Call GPT-4 / GPT-3.5T
                   (streaming)
                        ↓
                   Response with links
```

---

## 🎯 MVP SUCCESS CRITERIA (Not an MVP, but checkpoint)

When complete, you should be able to:

1. ✅ Visit portana.aahil-khan.xyz
2. ✅ Ask "Who are you?"
3. ✅ Get: "I'm Aahil Khan, 3rd year CS student..." with links to LinkedIn
4. ✅ Ask "What projects have you built?"
5. ✅ Get: Accurate list with GitHub + Medium links
6. ✅ Ask "Explain your backend architecture"
7. ✅ Get: Answer grounded in your experience + projects with source links
8. ✅ Ask "Summarize your latest content"
9. ✅ Get: Recent posts/projects with content summaries

---

## 📅 PHASES (For Reference)

### Phase 1: Data Ingestion (This Week)
- [ ] Create projects.json with all your projects
- [ ] Build GitHub README ingestor
- [ ] Build Medium article ingestor
- [ ] Manually run ingestors to populate Qdrant + SQLite
- [ ] Verify all data is searchable

### Phase 2: Chat Refinement (Next)
- [ ] Build system prompts that reference sources
- [ ] Ensure responses include clickable links
- [ ] Test accuracy of answers
- [ ] Handle edge cases (unknown topics)

### Phase 3: Frontend (After)
- [ ] Build chat UI for visitors
- [ ] Test UX + streaming display
- [ ] Polish design (template → production)

### Phase 4: Deployment (Final)
- [ ] Deploy backend with embedded data
- [ ] Deploy frontend
- [ ] Monitor + iterate

---

## 🔗 KEY DOCUMENTS

Reference these as we move forward:
- `BACKEND_ARCHITECTURE.md` - System design + data flow
- `DATA_INGESTION_STRATEGY.md` - How to ingest GitHub/Medium/Projects
- `ONBOARDING_FLOW_ANALYSIS.md` - Step 1-2 current state

---

## 💬 DISCUSSION FRAMEWORK

Before discussing architecture changes:
1. **Verify alignment**: Does this align with making AI answer ANY question about Aahil?
2. **Check acceptance**: Does this move toward the success criteria?
3. **Consider scope**: Is this a refinement or scope creep?
4. **Evaluate tradeoff**: Time investment vs. quality improvement?

---

## ⚠️ NON-GOALS

- Don't build multi-user onboarding (one host = one user)
- Don't optimize for self-service (this is custom for Aahil)
- Don't build public AI marketplace (personal assistant only)
- Don't delay for "perfect" UI (function first, polish second)
- Don't settle for hallucination (accuracy > speed)

---

## 🚀 STARTING POINT

**Today's focus**: Get data ingestion working so chat can reference everything.

1. Create `projects.json` with your projects
2. Build GitHub ingestor (fetch + chunk READMEs)
3. Build Medium ingestor (fetch + chunk articles)
4. Run ingestion → verify Qdrant populated
5. Test chat responds with links

Once data ingestion works → chat refinement becomes straightforward.
