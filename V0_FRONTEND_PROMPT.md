# Portana Frontend - v0 Build Prompt

## Project Overview

**Portana** is an AI-powered portfolio generator. Users upload their resume, and the backend processes it through GPT-4 to generate structured portfolio data. The frontend needs to:
1. Allow users to upload resumes
2. Guide them through a 5-step onboarding
3. Provide a chat interface to interact with their portfolio data
4. Display their portfolio in a beautiful, professional format

## Backend API

**Base URL**: `https://portana-api.aahil-khan.tech`

### Core Endpoints

#### 1. Onboarding Flow

**POST /api/onboarding/start**
- Initialize onboarding session
- Returns: `{ sessionId, step: 1 }`

**POST /api/onboarding/step/:step**
- Submit step data (steps 1-5)
- Returns: `{ success, nextStep }`

**GET /api/onboarding/status**
- Check current onboarding progress

#### 2. Resume Upload & Processing

**POST /api/upload** (multipart/form-data)
- Upload PDF/DOC resume
- Returns parsed data with structured fields
- Auto-generates embeddings for vector search

**GET /api/portfolio**
- Get complete portfolio data
- Returns all extracted information (projects, experience, education, etc.)

#### 3. Chat Interface (Main USP!)

**POST /api/chat** (Server-Sent Events)
- Send: `{ sessionId, message }`
- Response: Streaming text from GPT-4 about portfolio data
- **This is the conversational AI core** - users ask questions about their professional data

Example:
```
User: "Tell me about my projects"
Response: Streams back a natural conversation about their portfolio
```

#### 4. Authentication
- Header: `Authorization: Bearer {JWT_TOKEN}`
- JWT provided after onboarding complete

## Design Requirements

### 1. Upload & Onboarding Page
- Clean, minimal upload area (drag-and-drop)
- 5-step guided onboarding flow:
  1. Basic info (name, email, bio)
  2. Resume parsing (display AI-extracted data for review)
  3. Data sources (GitHub, Medium connections)
  4. Preferences & customization
  5. Confirmation & setup complete
- Progress indicator

### 2. Portfolio View
- Display extracted professional data beautifully
- Sections: Experience, Projects, Education, Skills, Certifications
- Professional, minimal design
- Mobile-responsive

### 3. Chat Interface (KEY FEATURE)
- Sidebar/panel with chat history
- Input field at bottom: "Ask about your portfolio"
- Streaming responses from AI
- Show thinking state while response streams
- Example questions shown as suggestions:
  - "What are my top projects?"
  - "Summarize my experience"
  - "What skills do I have?"
  - "Generate a cover letter"
  - "Create a bio for LinkedIn"

### 4. Profile/Settings
- Edit uploaded data
- Manage integrations
- Download portfolio as PDF
- Export data

## Technical Stack Suggestions

- **Framework**: Next.js 14+ (React with SSR)
- **Streaming**: Use native `fetch` with ReadableStream for chat SSE
- **Styling**: Tailwind CSS (clean, professional)
- **Components**: Shadcn/ui (professional UI components)
- **State Management**: React hooks or Zustand (lightweight)
- **Auth**: Client-side JWT storage (localStorage or cookies)

## Key Features to Implement

### MVP (Essential)
1. Resume upload
2. Onboarding flow (5 steps)
3. Portfolio display
4. Chat interface with streaming responses
5. Authentication flow

### Nice to Have
1. Portfolio templates/themes
2. Export to PDF
3. Share portfolio link
4. Analytics (view count, etc.)
5. Social media integration

## API Response Examples

### POST /api/upload
```json
{
  "success": true,
  "sessionId": "sess_123",
  "data": {
    "name": "John Doe",
    "email": "john@example.com",
    "experience": [
      {
        "title": "Senior Developer",
        "company": "Tech Corp",
        "duration": "2020-present",
        "description": "Led team of 5..."
      }
    ],
    "projects": [
      {
        "title": "AI Portfolio Builder",
        "description": "...",
        "technologies": ["React", "Node.js", "GPT-4"]
      }
    ]
  }
}
```

### POST /api/chat (Streaming)
```
Response is Server-Sent Events (text/event-stream):

data: Here's

data:  a

data:  summary

data:  of

data:  your

data:  experience...
```

## Design Inspiration

- **Color scheme**: Professional - blues, grays, whites (like portfolio websites)
- **Typography**: Clean sans-serif (Inter, Helvetica Neue)
- **Spacing**: Generous whitespace for premium feel
- **Animations**: Subtle (loading states, transitions)
- **Accessibility**: WCAG 2.1 AA minimum

## Deployment

- **Host on**: Vercel (serverless, integrates with Next.js)
- **Domain**: Point subdomain to Vercel (frontend.aahil-khan.tech)
- **Environment**: 
  - API_URL=https://portana-api.aahil-khan.tech
  - NODE_ENV=production

## User Flow

```
1. User lands on site → Upload resume
2. Backend processes with GPT-4
3. Onboarding wizard (5 steps)
4. Portfolio generated & displayed
5. User can chat with AI about their data
6. Portfolio is live/shareable
```

## Conversational Portfolio (USP)

The key differentiation is the **chat interface**. Instead of static portfolio display, users can:
- Ask "What should I highlight on my resume?"
- Get "Generate a cover letter based on my experience"
- Request "Tell me about my project impact"
- Chat naturally about their professional data

This is powered by GPT-4 with context from their parsed resume/portfolio.

## Notes for v0

- Focus on clean, functional UI first
- Use Shadcn/ui for consistent component library
- Implement streaming chat properly (crucial for UX)
- Mobile-first responsive design
- Keep authentication simple (JWT in localStorage for now)
- Error handling for failed uploads/API calls

## Questions for v0

- Should portfolio be editable after generation?
- How many steps for onboarding (5 is current backend)?
- Dark mode support needed?
- Should users be able to create accounts/save multiple portfolios?
