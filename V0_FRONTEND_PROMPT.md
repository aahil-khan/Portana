# Portana Frontend - v0 Build Prompt

## CRITICAL: Two-Party System Architecture

**Portana has TWO DISTINCT USER ROLES with completely different interfaces:**

### 1. OWNER (Admin)
- **Who**: Person setting up their portfolio (uploads resume, configures AI persona)
- **Where**: Private setup wizard accessible after authentication
- **What they do**: One-time onboarding (5 steps), then admin dashboard for management
- **How many**: ONE per portfolio instance
- **Frequency**: Occasional admin tasks (manage content, update settings)

### 2. VISITOR (Public User)
- **Who**: Anyone accessing the public portfolio link
- **Where**: Public chatbot interface (NO authentication needed)
- **What they do**: Chat with an AI about the portfolio owner's experience
- **How many**: Unlimited visitors
- **Frequency**: Real-time conversations

---

## BACKEND API

**Base URL**: `https://portana-api.aahil-khan.tech`

All endpoints documented in the PRD Section 5. Key endpoints for frontend:

---

## ARCHITECTURE: TWO SEPARATE INTERFACES

### INTERFACE 1: OWNER SETUP WIZARD (Private)
**Path**: `/onboarding`  
**Authentication**: No auth for initial setup (JWT cookie set after completion)

#### Purpose
Complete one-time intelligent setup without requiring any technical knowledge.

#### 5-Step Flow

**Step 1: Basic Profile Setup**
```
Endpoint: POST /api/onboarding/start
Fields to collect:
- full_name (required, 2-50 chars)
- bio (required, 50-500 chars)
- email (required, valid email)
- location (optional, city, country)
- timezone (optional, IANA timezone)
- profile_image (optional, URL or base64)

Response: { success, user_id, session_token, next_step }
```

**Step 2: Resume Upload & AI Parsing**
```
Endpoint: POST /api/onboarding/resume (multipart/form-data)
File: PDF or DOCX (max 10MB)
Headers: Authorization Bearer {session_token}

Backend auto-parses with GPT-4:
- Personal info, experience, projects, skills, education, certifications

GET /api/onboarding/resume/parsed (retrieve parsed data for review)
POST /api/onboarding/resume/confirm (submit reviewed data for indexing)

Response: { success, indexed_count, breakdown, next_step }
```

**Step 3: Connect Data Sources**
```
Endpoint: POST /api/onboarding/sources
Connect GitHub, Medium, LinkedIn:
- GitHub: username, access_token (optional), include_repos, auto_sync
- Medium: username, custom_domain, auto_sync, check_interval
- LinkedIn: profile_url (optional, for future phases)

Backend fetches and indexes content automatically

Response: { success, sources_connected, total_items, next_step }
```

**Step 4: Configure AI Persona**
```
Endpoint: POST /api/onboarding/persona
Customize chatbot behavior:
- tone: "professional" | "casual" | "technical" | "friendly"
- verbosity: "concise" | "balanced" | "detailed"
- formality: "formal" | "neutral" | "informal"
- preferences: cite_sources, show_confidence, ask_clarifying_questions, etc.
- custom_instructions: optional additional context

Response: { success, persona_configured, system_prompt_preview, next_step }
```

**Step 5: Deployment Configuration**
```
Endpoint: POST /api/onboarding/deploy
Final configuration:
- public_url: where the portfolio will be hosted
- admin_email: for notifications
- notifications: email, telegram, discord settings
- analytics: telemetry preferences

Response: { success, setup_complete, access_info, downloads }
- Downloads include n8n workflow templates (JSON)
```

#### UI Requirements for Onboarding

- **Progress Indicator**: Show current step (1-5) with completed status
- **Form Validation**: Real-time validation, highlight errors
- **File Upload**: Drag-and-drop area for resume
- **Parsed Data Review**: Display GPT-4 extracted data in editable form before confirming
- **Success States**: Clear confirmation after each step
- **Error Handling**: User-friendly error messages
- **Mobile Responsive**: Works on all devices

---

### INTERFACE 2: PUBLIC PORTFOLIO + CHAT (No Auth)
**Path**: `/` (root) or `/chat`  
**Authentication**: None required (public facing)

#### Purpose
Visitors land here and can chat with an AI about the portfolio owner's experience (GPT-style interface).

#### Key Components

**1. Chat Interface (Main USP!)**
```
Endpoint: POST /api/chat/ask (Server-Sent Events streaming)

Request:
{
  "query": "Tell me about your experience with React",
  "session_id": "optional UUID for conversation continuity",
  "filters": { 
    "types": ["project", "blog", "experience"],
    "tags": ["React", "Node.js"],
    "date_range": { "from": "2020-01-01", "to": "2024-12-31" }
  },
  "options": { "top_k": 5, "stream": true }
}

Response: Server-Sent Events (text/event-stream)
- Sources event: array of retrieved documents with relevance scores
- Token events: streaming response chunks (real-time)
- Done event: completion with metadata

Example flow:
User: "What are my React projects?"
AI: [sources appear] → [response streams word-by-word]
Response: "You have 3 React projects including... [continued streaming]"
```

**2. Display Elements**
- Conversation history (scrollable)
- Current streaming response
- Source indicators (shows which portfolio items informed the response)
- Input field with "Ask about this portfolio" placeholder
- Suggested questions (optional: "Tell me about projects", "What technologies do you use?", etc.)

**3. Portfolio Display (Optional in v0)**
- Could show portfolio data alongside chat
- Or keep minimal ChatGPT-style interface
- Focus on the conversational experience

#### UI Requirements for Chat

- **Real-time Streaming**: Show tokens arriving in real-time (not waiting for full response)
- **Source Attribution**: Display where the AI found information
- **Conversation Memory**: Maintain 5+ message turns in-session (backend handles session management)
- **Loading States**: Show "AI is thinking..." while sources load
- **Mobile Responsive**: Chat interface works perfectly on mobile
- **Dark Mode**: Optional but recommended for long reading sessions
- **Copy/Share**: Ability to copy responses or share conversation snippets

---

## OPTIONAL OWNER INTERFACE: Admin Dashboard
**Path**: `/admin`  
**Authentication**: JWT cookie required

#### Features (Lower Priority for v0)
- View system status (GET /api/admin/status)
- Manage content (GET/DELETE /api/admin/content)
- Upload manual projects (POST /api/admin/projects)
- Update settings (PATCH /api/admin/settings)
- View analytics (GET /api/admin/analytics/metrics)

#### v0 Priority
- **INCLUDE**: Settings page (change persona, notification preferences)
- **NICE-TO-HAVE**: Content management, analytics dashboard

---

## DATA FLOW SUMMARY

### Owner Journey
```
1. Visit /onboarding (no auth)
2. Step 1: Enter name, bio, email
3. Step 2: Upload resume → AI parses → review data
4. Step 3: Connect GitHub/Medium (optional)
5. Step 4: Configure chatbot tone and behavior
6. Step 5: Set public URL and notifications
7. Receive JWT token → can access /admin dashboard
8. Can share public portfolio link with others
```

### Visitor Journey
```
1. Visit public portfolio link (shared by owner)
2. See ChatGPT-style interface
3. Type question: "Tell me about your projects"
4. AI responds with streaming text, sources shown
5. Continue conversation naturally
6. No sign-up or authentication needed
7. Session maintained during conversation (5+ turns)
```

---

## EXACT API ENDPOINTS NEEDED FOR v0

### Onboarding (Owner)
- `POST /api/onboarding/start` - Initialize setup
- `POST /api/onboarding/step/1` or just call endpoints directly per PRD
- `POST /api/onboarding/resume` - Upload PDF
- `GET /api/onboarding/resume/parsed` - Get AI-parsed data
- `POST /api/onboarding/resume/confirm` - Confirm and index
- `POST /api/onboarding/sources` - Connect GitHub/Medium
- `POST /api/onboarding/persona` - Configure AI tone
- `POST /api/onboarding/deploy` - Final setup

### Chat (Visitor)
- `POST /api/chat/ask` - Ask question (SSE streaming)

### Optional Admin (Owner)
- `GET /api/admin/status` - System health
- `PATCH /api/admin/settings` - Update persona/settings
- `GET /api/admin/analytics/metrics` - View analytics

### Health
- `GET /health` - Health check

---

## TECHNICAL REQUIREMENTS

### Frontend Stack
- **Framework**: Next.js 14+ (React + TypeScript)
- **Styling**: Tailwind CSS
- **Components**: Shadcn/ui (for consistency, professional look)
- **State Management**: React hooks + context or Zustand (lightweight)
- **HTTP Client**: Fetch API with custom hooks for SSE streaming
- **Form Handling**: React Hook Form + Zod validation (match backend)
- **Streaming**: Native ReadableStream API for real-time chat responses

### Key Implementation Details

**1. Onboarding Wizard**
- Multi-step form with progress tracking
- File upload with drag-and-drop
- Form validation matching Zod schemas from backend
- Display GPT-4 parsed data for user review
- Error handling with user-friendly messages
- Success confirmations before moving to next step

**2. Chat Streaming**
```javascript
// Example SSE streaming implementation
const response = await fetch('https://api-url/chat/ask', {
  method: 'POST',
  body: JSON.stringify({ query, session_id })
});

const reader = response.body.getReader();
const decoder = new TextDecoder();

while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  
  const chunk = decoder.decode(value);
  // Parse "data: " lines and update UI
  // "sources" event → show source panel
  // "token" event → append to response text
  // "done" event → show completion
}
```

**3. Session Management**
- Store `session_id` in state (React hooks)
- Send same `session_id` in subsequent requests
- Maintain local conversation history in state
- Backend keeps sessions alive for 1 hour

**4. Authentication**
- After onboarding Step 5: backend returns JWT in httpOnly cookie
- Frontend automatically includes cookie in requests to /admin endpoints
- JWT expires in 30 days
- No need for manual token management (httpOnly handles it)

---

## V0 SCOPE (MVP - Focus ONLY on these)

### MUST HAVE ✅
1. **Onboarding Wizard** (all 5 steps)
   - Forms with validation
   - Resume upload
   - Data review interface
   - Progress indicator

2. **Public Chat Interface**
   - SSE streaming responses
   - Conversation history
   - Source attribution
   - Session persistence

3. **Basic Admin Access**
   - Settings page (change persona/tone)
   - View system status
   - Logout button

### NICE-TO-HAVE 🎯
- Portfolio data display alongside chat
- Suggested questions
- Dark mode
- Share/copy responses
- Analytics dashboard
- Content management

### OUT OF SCOPE (v1+) ❌
- Multiple portfolio accounts
- Public portfolio showcase gallery
- Advanced analytics
- PDF export
- Social sharing integrations

---

## DESIGN GUIDANCE

### Aesthetic
- **Style**: Modern, clean, minimalist (like ChatGPT UI)
- **Colors**: Professional (dark backgrounds for chat, light backgrounds for forms)
- **Typography**: Inter or Geist font (Next.js default)
- **Spacing**: Generous whitespace
- **Animations**: Subtle loading states, smooth transitions

### Onboarding
- **Look**: Step-by-step wizard with clear progress
- **Feel**: Encouraging, helpful, professional
- **Accessibility**: Clear labels, error messages, keyboard navigation

### Chat
- **Look**: ChatGPT-like (user messages right-aligned, AI left-aligned)
- **Feel**: Fast, responsive, conversational
- **Accessibility**: High contrast, readable fonts, good line height

---

## DEPLOYMENT

- **Host on**: Vercel (recommended for Next.js)
- **Environment Variables**:
  - `NEXT_PUBLIC_API_URL=https://portana-api.aahil-khan.tech`
  - `NODE_ENV=production`

---

## SUCCESS CRITERIA FOR V0

✅ Users can complete 5-step onboarding without errors  
✅ Onboarding takes under 15 minutes  
✅ Chat responses stream in real-time (first token < 700ms)  
✅ Conversation history maintained across messages  
✅ Mobile-responsive on all screen sizes  
✅ Professional, polished UI (no rough edges)  
✅ Error handling for all failure cases  
✅ No console errors or warnings  
✅ Meets accessibility standards (WCAG 2.1 AA minimum)
