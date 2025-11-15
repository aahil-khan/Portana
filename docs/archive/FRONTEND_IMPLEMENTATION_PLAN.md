# Portana Frontend Implementation Plan - v0 Complete

**Status**: Ready for Phase 1 Implementation
**Start Date**: November 9, 2025
**Target Completion**: November 16-18, 2025 (7-8 days)
**Team**: Frontend Developer + Backend (API ready)

---

## OVERVIEW

This plan breaks down frontend implementation into **15 sequential steps** with clear verification checkpoints after each step. Each step is scoped to 1-4 hours of work.

**Verification Method**: After each step, user will manually test functionality with the live backend at `https://portana-api.aahil-khan.tech`

---

## PHASE 1: FOUNDATION (Days 1-2) - Setup & API Layer

### Step 1: Create API Service Layer
**Duration**: 2 hours
**Files to Create**: `lib/api.ts`, `lib/config.ts`, `lib/types.ts`
**Objective**: Centralized API client with all backend endpoints

**Create `lib/config.ts`**:
```typescript
export const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";
export const API_TIMEOUT = 30000; // 30 seconds
```

**Create `lib/types.ts`**:
```typescript
// Onboarding types
export interface Step1Data {
  full_name: string;
  bio: string;
  email: string;
  location?: string;
  timezone?: string;
  profile_image?: string;
}

export interface Step1Response {
  success: boolean;
  user_id: string;
  session_token: string;
  next_step: string;
}

// Chat types
export interface ChatMessage {
  role: "user" | "ai";
  content: string;
  sources?: any[];
}

export interface ChatQuery {
  query: string;
  session_id?: string;
  filters?: ChatFilters;
  options?: ChatOptions;
}

export interface ChatFilters {
  types?: string[];
  tags?: string[];
  date_range?: { from: string; to: string };
}

export interface ChatOptions {
  top_k?: number;
  stream?: boolean;
}
```

**Create `lib/api.ts`** with all endpoints:
```typescript
import { API_URL } from "./config";

// Helper for API calls
async function fetchAPI(endpoint: string, options?: RequestInit) {
  const url = `${API_URL}${endpoint}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`API Error: ${response.status} - ${error}`);
  }

  return response.json();
}

// Onboarding API
export const onboardingApi = {
  async start(data: Step1Data): Promise<Step1Response> {
    return fetchAPI("/api/onboarding/start", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  async uploadResume(file: File, sessionToken: string): Promise<any> {
    const formData = new FormData();
    formData.append("file", file);

    const response = await fetch(`${API_URL}/api/onboarding/resume`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${sessionToken}`,
      },
      body: formData,
    });

    if (!response.ok) {
      throw new Error(await response.text());
    }
    return response.json();
  },

  async getResumeParsed(sessionToken: string): Promise<any> {
    return fetchAPI("/api/onboarding/resume/parsed", {
      headers: {
        "Authorization": `Bearer ${sessionToken}`,
      },
    });
  },

  async confirmResume(data: any, sessionToken: string): Promise<any> {
    return fetchAPI("/api/onboarding/resume/confirm", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${sessionToken}`,
      },
      body: JSON.stringify(data),
    });
  },

  async connectSources(data: any, sessionToken: string): Promise<any> {
    return fetchAPI("/api/onboarding/sources", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${sessionToken}`,
      },
      body: JSON.stringify(data),
    });
  },

  async configurePersona(data: any, sessionToken: string): Promise<any> {
    return fetchAPI("/api/onboarding/persona", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${sessionToken}`,
      },
      body: JSON.stringify(data),
    });
  },

  async deploy(data: any, sessionToken: string): Promise<any> {
    return fetchAPI("/api/onboarding/deploy", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${sessionToken}`,
      },
      body: JSON.stringify(data),
    });
  },
};

// Chat API with SSE streaming
export const chatApi = {
  async *ask(query: ChatQuery, sessionToken?: string): AsyncGenerator<any> {
    const url = new URL(`${API_URL}/api/chat/ask`);
    const response = await fetch(url.toString(), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(sessionToken && { "Authorization": `Bearer ${sessionToken}` }),
      },
      body: JSON.stringify(query),
    });

    if (!response.ok) {
      throw new Error(await response.text());
    }

    if (!response.body) {
      throw new Error("No response body");
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value);
      const lines = buffer.split("\n");
      buffer = lines[lines.length - 1]; // Keep incomplete line in buffer

      for (let i = 0; i < lines.length - 1; i++) {
        const line = lines[i].trim();
        if (line.startsWith("data: ")) {
          try {
            const data = JSON.parse(line.slice(6));
            yield data;
          } catch (e) {
            console.error("Failed to parse SSE data:", e);
          }
        }
      }
    }
  },
};

// Admin API
export const adminApi = {
  async getStatus(sessionToken: string): Promise<any> {
    return fetchAPI("/api/admin/status", {
      headers: {
        "Authorization": `Bearer ${sessionToken}`,
      },
    });
  },

  async updateSettings(path: string, value: any, sessionToken: string): Promise<any> {
    return fetchAPI("/api/admin/settings", {
      method: "PATCH",
      headers: {
        "Authorization": `Bearer ${sessionToken}`,
      },
      body: JSON.stringify({ path, value }),
    });
  },
};
```

**Create `.env.local`**:
```
NEXT_PUBLIC_API_URL=https://portana-api.aahil-khan.tech
```

**What to Verify After Step 1**:
- ✅ Files created without errors
- ✅ TypeScript compilation successful
- ✅ No import errors when importing from lib/api

**Command to test**:
```bash
npm run build  # Should pass with no TypeScript errors
```

---

### Step 2: Update Step 1 Component - Basic Profile
**Duration**: 1.5 hours
**File**: `components/portana/onboarding/step-1-basic-profile.tsx`
**Objective**: Connect Step 1 form to backend, store session token

**Changes**:
- Import `onboardingApi` from `lib/api`
- Call `/api/onboarding/start` on form submit
- Store `session_token` and `user_id` in localStorage
- Display backend validation errors
- Add loading state during submission

**What to Verify After Step 2**:
- ✅ Form submits when all fields valid
- ✅ Logs show API call to `https://portana-api.aahil-khan.tech/api/onboarding/start`
- ✅ Response contains `user_id` and `session_token`
- ✅ localStorage contains `session_token` key
- ✅ Continue button disabled during API call
- ✅ Invalid email shows error
- ✅ Short name shows error
- ✅ Short bio shows error

**Test URL**: `http://localhost:3000/onboarding`
**Test Data**:
- Name: "John Doe"
- Email: "john@example.com"
- Bio: "I am a full-stack engineer with 5 years of experience building web applications with React and Node.js."
- Location: "San Francisco, USA"
- Timezone: "America/Los_Angeles"

---

### Step 3: Fix Step 2 Component - Resume Upload (CRITICAL)
**Duration**: 3 hours
**File**: `components/portana/onboarding/step-2-resume-upload.tsx`
**Objective**: Replace mock data with real resume upload, implement multipart form handling

**Changes**:
- Remove setTimeout mock code
- Call `onboardingApi.uploadResume()` with multipart form-data
- Retrieve session token from localStorage
- Add Authorization header
- Call `getResumeParsed()` to get AI-extracted data
- Implement error handling
- Show loading state during parsing
- Display parsed data for review
- Implement confirm flow

**Key Implementation**:
```typescript
const handleUpload = async () => {
  if (!file) return;
  setLoading(true);
  setError(null);

  try {
    const sessionToken = localStorage.getItem("session_token");
    if (!sessionToken) throw new Error("Session expired, please restart onboarding");

    // Upload file
    const uploadResponse = await onboardingApi.uploadResume(file, sessionToken);
    
    // Get parsed data
    const parsedResponse = await onboardingApi.getResumeParsed(sessionToken);
    
    setParsedData(parsedResponse);
  } catch (error) {
    setError(error instanceof Error ? error.message : "Upload failed");
  } finally {
    setLoading(false);
  }
};
```

**What to Verify After Step 3**:
- ✅ Can upload PDF file from step 2 upload area
- ✅ Shows "Parsing..." loading state during upload
- ✅ After parse: displays extracted data (experience, skills, education)
- ✅ Shows "✓ Resume parsed successfully" message
- ✅ Can click "Confirm & Continue" to proceed
- ✅ Error message shows if upload fails
- ✅ Can re-upload if needed

**Test File**: Create a simple PDF or use any PDF
**Expected Response**: Should show extracted experience, projects, skills, education

---

## PHASE 2: COMPLETE ONBOARDING (Days 2-3) - Steps 3-5

### Step 4: Implement Step 3 - Connect Data Sources
**Duration**: 2 hours
**File**: `components/portana/onboarding/step-3-data-sources.tsx`
**Objective**: Connect GitHub and Medium accounts, call backend API

**Implementation Requirements**:
- Form fields for GitHub username and access token (optional)
- Form fields for Medium username
- Checkboxes for enabling/disabling each source
- Submit form to `onboardingApi.connectSources()`
- Handle authorization header
- Show success/error messages
- Display summary of connected sources

**What to Verify After Step 4**:
- ✅ Form has GitHub and Medium fields
- ✅ Can fill in usernames
- ✅ Form submits to backend
- ✅ Shows success message after submission
- ✅ Continue button progresses to step 4
- ✅ Can skip this step (no sources required)
- ✅ Error message if API fails

**Test Data**:
- GitHub: Leave empty (optional)
- Medium: Leave empty (optional)
- Or use real GitHub/Medium account

---

### Step 5: Implement Step 4 - Configure AI Persona
**Duration**: 2 hours
**File**: `components/portana/onboarding/step-4-ai-persona.tsx`
**Objective**: Configure chatbot tone, verbosity, formality

**Implementation Requirements**:
- Select dropdown for tone: "professional", "casual", "technical", "friendly"
- Select dropdown for verbosity: "concise", "balanced", "detailed"
- Select dropdown for formality: "formal", "neutral", "informal"
- Checkboxes for preferences: cite_sources, show_confidence, ask_clarifying_questions, suggest_related_content
- Textarea for custom_instructions
- Submit to `onboardingApi.configurePersona()`
- Display system_prompt_preview in response

**What to Verify After Step 5**:
- ✅ All tone options selectable
- ✅ All verbosity options selectable
- ✅ All formality options selectable
- ✅ Can toggle preference checkboxes
- ✅ Can enter custom instructions
- ✅ Form submits to backend
- ✅ Shows response with persona configuration confirmed
- ✅ Continue button progresses to step 5

**Test Data**:
- Tone: "professional"
- Verbosity: "balanced"
- Formality: "neutral"
- Preferences: all checked
- Custom instructions: "Emphasize my leadership experience"

---

### Step 6: Implement Step 5 - Deployment Configuration
**Duration**: 2 hours
**File**: `components/portana/onboarding/step-5-deployment.tsx`
**Objective**: Final configuration, store JWT token, redirect to chat

**Implementation Requirements**:
- Form fields: public_url, admin_email
- Checkboxes for: email notifications, telegram, discord
- Submit to `onboardingApi.deploy()`
- Store JWT token from response in localStorage
- Store setup_completed flag
- Show completion screen with next steps
- Button to proceed to chat interface
- Handle redirect or navigation to chat

**What to Verify After Step 6**:
- ✅ Can enter public_url and admin_email
- ✅ Can toggle notification options
- ✅ Form submits to backend
- ✅ Shows "Setup complete!" message
- ✅ JWT token stored in localStorage
- ✅ Can click "Go to Chat" button
- ✅ Redirects to chat interface (or shows success)
- ✅ localStorage contains all required data

**Test Data**:
- public_url: "https://portfolio.example.com"
- admin_email: "john@example.com"
- Email notifications: checked
- Telegram/Discord: unchecked

---

## PHASE 3: POLISH & INTEGRATION (Days 3-4) - Chat & Sessions

### Step 7: Implement Session Token Management
**Duration**: 1.5 hours
**Files**: `hooks/useSession.ts`, `lib/storage.ts`
**Objective**: Centralized session management, localStorage persistence

**Create `hooks/useSession.ts`**:
```typescript
import { useEffect, useState } from "react";

export function useSession() {
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Load from localStorage on mount
    const token = localStorage.getItem("session_token");
    const id = localStorage.getItem("user_id");
    setSessionToken(token);
    setUserId(id);
    setIsLoading(false);
  }, []);

  const saveSession = (token: string, id: string) => {
    localStorage.setItem("session_token", token);
    localStorage.setItem("user_id", id);
    setSessionToken(token);
    setUserId(id);
  };

  const clearSession = () => {
    localStorage.removeItem("session_token");
    localStorage.removeItem("user_id");
    setSessionToken(null);
    setUserId(null);
  };

  return { sessionToken, userId, isLoading, saveSession, clearSession };
}
```

**What to Verify After Step 7**:
- ✅ Hook created without errors
- ✅ Can import and use in components
- ✅ Session persists in localStorage
- ✅ Session loads on page reload

---

### Step 8: Update Chat Interface - Fix Session Management
**Duration**: 2 hours
**File**: `app/(public)/page.tsx`
**Objective**: Replace hardcoded "temp-session" with real session persistence

**Changes**:
- Use `useSession()` hook or direct localStorage
- Generate unique session_id on first visit
- Store session_id in localStorage
- Persist chat messages to localStorage
- Load messages on page reload
- Pass real session_id to API

**What to Verify After Step 8**:
- ✅ Open chat, send a message
- ✅ Refresh page - message history still there
- ✅ Close and reopen browser - messages persist
- ✅ Multiple sessions have different session_ids
- ✅ session_id matches in API calls

---

### Step 9: Implement Error Handling & Display
**Duration**: 2 hours
**Files**: `components/error-banner.tsx`, update all API calls
**Objective**: User-facing error messages for all failure scenarios

**Create `components/error-banner.tsx`**:
```typescript
export function ErrorBanner({ message, onDismiss }: { message: string; onDismiss: () => void }) {
  return (
    <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-4 flex justify-between items-center">
      <p className="text-red-300">{message}</p>
      <button onClick={onDismiss} className="text-red-300 hover:text-red-200">✕</button>
    </div>
  );
}
```

**Update all step components**:
- Wrap all onboardingApi calls in try-catch
- Store error in state
- Display ErrorBanner when error exists
- Show loading states during API calls

**What to Verify After Step 9**:
- ✅ Invalid form data shows validation error
- ✅ Network error shows error message
- ✅ Missing session shows "Session expired"
- ✅ File upload error displays to user
- ✅ Can dismiss error banner
- ✅ Chat API errors display to user

---

### Step 10: Implement Loading States
**Duration**: 1 hour
**Files**: All onboarding step components
**Objective**: Visual feedback during API calls

**Changes**:
- Show spinner while loading
- Disable submit button during API call
- Show "Processing..." text
- Skeleton loaders for parsed data
- Loading state for chat responses

**What to Verify After Step 10**:
- ✅ Step 1 shows loading spinner when submitting
- ✅ Step 2 shows "Parsing..." during resume upload
- ✅ All buttons disabled during API calls
- ✅ Chat input disabled while streaming

---

## PHASE 4: CHAT ENHANCEMENTS (Days 4-5)

### Step 11: Implement Source Panel Details
**Duration**: 2 hours
**File**: `components/portana/chat/source-panel.tsx`
**Objective**: Display retrieved sources with links, metadata, relevance scores

**Implementation Requirements**:
- Show list of sources retrieved by AI
- Display source title, type (project, blog, experience)
- Show relevance score as percentage
- Show URL as clickable link
- Display tags associated with source
- Collapsible source details

**What to Verify After Step 11**:
- ✅ Chat response shows sources on right panel
- ✅ Each source shows title, type, score
- ✅ Source URL is clickable
- ✅ Can see tags for each source
- ✅ Panel scrolls if many sources
- ✅ Mobile: sources display below chat or in modal

---

### Step 12: Add Suggested Questions Feature
**Duration**: 1.5 hours
**File**: `components/portana/chat/chat-box.tsx`
**Objective**: Pre-populated question suggestions for new users

**Implementation**:
- Show 3-4 suggested questions below input
- Questions: "Tell me about your projects", "What's your technical stack?", "Summarize your experience", "What are your key achievements?"
- On click, populate textarea and send
- Hide suggestions after first message

**What to Verify After Step 12**:
- ✅ New chat shows suggested questions
- ✅ Clicking question populates input
- ✅ Message sends automatically
- ✅ Suggestions hide after first message
- ✅ Mobile layout works for suggestions

---

### Step 13: Implement Chat Persistence
**Duration**: 1 hour
**File**: `app/(public)/page.tsx`
**Objective**: Save and restore chat history from localStorage

**Changes**:
- Save messages array to localStorage on each new message
- Load messages from localStorage on page load
- Max 50 messages per session (to avoid huge localStorage)
- Clear messages on new session

**What to Verify After Step 13**:
- ✅ Send message, refresh page
- ✅ Message history persists
- ✅ Can continue conversation after page reload
- ✅ Old sessions cleared after inactivity (optional)

---

### Step 14: Improve Chat Response Display
**Duration**: 1.5 hours
**File**: `components/portana/chat/message-list.tsx`
**Objective**: Better streaming, formatting, and error display

**Changes**:
- Show "AI is thinking..." during source retrieval
- Display sources as sources arrive (don't wait for full response)
- Format code blocks in responses (if present)
- Show timestamps on messages
- Better error message display
- Typing indicator animation

**What to Verify After Step 14**:
- ✅ Chat shows "Thinking..." while AI processes
- ✅ Sources appear before response
- ✅ Response text streams in real-time
- ✅ Timestamps shown on messages
- ✅ Error responses display clearly
- ✅ Mobile scrolling smooth

---

## PHASE 5: ADMIN DASHBOARD (Days 5-6)

### Step 15: Create Admin Dashboard Route & Layout
**Duration**: 3 hours
**Files**: `app/(admin)/dashboard/page.tsx`, `components/admin-layout.tsx`
**Objective**: Protected admin route with settings page

**Create `app/(admin)/dashboard/page.tsx`**:
- JWT verification (check if token in localStorage)
- Redirect to onboarding if not authenticated
- Admin navigation menu
- Tabs for: Settings, Status, Logout

**Settings Tab**:
- Display current AI persona settings
- Form to update: tone, verbosity, formality
- Save button calls `adminApi.updateSettings()`
- Show success message after save

**Status Tab**:
- Call `adminApi.getStatus()` on mount
- Display system status
- Show Qdrant status, OpenAI status
- Show collection size

**Logout**:
- Clear localStorage
- Redirect to onboarding

**What to Verify After Step 15**:
- ✅ After onboarding completion, can access /admin/dashboard
- ✅ Dashboard shows current settings
- ✅ Can change AI tone from dropdown
- ✅ Can save settings to backend
- ✅ Shows success message after save
- ✅ System status displays correctly
- ✅ Logout clears session and redirects
- ✅ Accessing /admin without token shows onboarding
- ✅ JWT token verified (security check)

---

## PHASE 6: TESTING & OPTIMIZATION (Days 6-8)

### Step 16: End-to-End Testing
**Duration**: 4 hours
**Objective**: Full onboarding → chat → admin flow

**Test Scenario 1: Complete Onboarding**
- [ ] Start fresh at /onboarding
- [ ] Step 1: Fill form, submit to backend
- [ ] Step 2: Upload resume, see parsed data
- [ ] Step 3: Connect sources (optional)
- [ ] Step 4: Configure persona
- [ ] Step 5: Set deployment, get JWT
- [ ] Redirects to /chat

**Test Scenario 2: Chat Interface**
- [ ] Ask question in chat
- [ ] See sources retrieve
- [ ] See response stream in real-time
- [ ] Continue conversation (5+ turns)
- [ ] Refresh page, history persists
- [ ] New session has clean history

**Test Scenario 3: Admin Dashboard**
- [ ] Access /admin/dashboard
- [ ] View settings
- [ ] Change persona tone, save
- [ ] View system status
- [ ] Logout, redirects to onboarding

**Test Scenario 4: Error Handling**
- [ ] Network error during upload
- [ ] Invalid file format
- [ ] Session timeout (wait, retry)
- [ ] Missing required fields
- [ ] API server down (graceful error)

**What to Verify After Step 16**:
- ✅ All 4 scenarios complete without errors
- ✅ No console errors (check browser DevTools)
- ✅ No 404 or 500 responses
- ✅ All error messages user-friendly
- ✅ Mobile responsive throughout

---

### Step 17: Performance Optimization
**Duration**: 2 hours
**Objective**: Optimize bundle size, API calls, rendering

**Changes**:
- Remove unused dependencies
- Lazy load components
- Optimize images if any
- Minimize API calls (cache data where appropriate)
- Check bundle size: `npm run build`

**What to Verify After Step 17**:
- ✅ Bundle size < 500KB (gzipped)
- ✅ No performance warnings in build
- ✅ Chat response time < 700ms first token
- ✅ Page loads in < 2 seconds

---

### Step 18: Deployment & Final Testing
**Duration**: 2 hours
**Objective**: Deploy to Vercel, test in production

**Steps**:
- Push code to GitHub (main branch)
- Deploy to Vercel via GitHub integration
- Set environment variable: `NEXT_PUBLIC_API_URL=https://portana-api.aahil-khan.tech`
- Run all test scenarios on production
- Test mobile on real device
- Monitor for errors (Vercel analytics)

**What to Verify After Step 18**:
- ✅ Frontend deploys successfully
- ✅ Production URL loads without errors
- ✅ Can complete full onboarding flow
- ✅ Chat works with live backend
- ✅ No errors in browser console
- ✅ Mobile responsive on real device
- ✅ All API calls successful

---

## VERIFICATION CHECKLIST BY STEP

After each step completion, I will ask you to verify:

| Step | Verification | Status |
|------|-------------|--------|
| 1 | Files created, TypeScript compiles | ⏳ Pending |
| 2 | Step 1 submits to backend, token stored | ⏳ Pending |
| 3 | Resume uploads, AI parses, data displays | ⏳ Pending |
| 4 | Sources connect, form submits | ⏳ Pending |
| 5 | Persona configures, form submits | ⏳ Pending |
| 6 | Deployment completes, JWT stored | ⏳ Pending |
| 7 | Session hook works, storage persists | ⏳ Pending |
| 8 | Chat messages persist on reload | ⏳ Pending |
| 9 | Errors display to user | ⏳ Pending |
| 10 | Loading states show during API calls | ⏳ Pending |
| 11 | Sources display with links and metadata | ⏳ Pending |
| 12 | Suggested questions appear and work | ⏳ Pending |
| 13 | Chat history persists | ⏳ Pending |
| 14 | Response formatting and streaming better | ⏳ Pending |
| 15 | Admin dashboard works, settings save | ⏳ Pending |
| 16 | Complete E2E flow works (onboarding → chat → admin) | ⏳ Pending |
| 17 | Performance optimized, bundle < 500KB | ⏳ Pending |
| 18 | Deployed to production, all tests pass | ⏳ Pending |

---

## WORKFLOW FOR EACH STEP

1. **I provide code changes** - Specific files to create/modify with code snippets
2. **You implement changes** - Make edits in your editor
3. **I ask for verification** - "Can you verify Step X is working?"
4. **You test manually** - Try the feature, check console, verify localStorage
5. **You report back** - "Verified ✅" or "Error: ..."
6. **Move to next step** - If verified, proceed; if error, I help debug

---

## TOOLS & RESOURCES

**Testing Tools**:
- Browser DevTools (F12): Console, Network, Storage tabs
- Vercel Analytics: After deployment
- Testing API: `curl https://portana-api.aahil-khan.tech/health`

**Commands**:
```bash
npm run dev       # Run local dev server
npm run build    # Build for production
npm run lint     # Check for errors
npm test         # Run tests (if configured)
```

**API Base URL**:
`https://portana-api.aahil-khan.tech`

**Documentation**:
- PRD: `/portfolioOS/PRD.md`
- V0 Prompt: `/portfolioOS/V0_FRONTEND_PROMPT.md`
- Analysis: `/portfolioOS/FRONTEND_ANALYSIS_SUMMARY.md`

---

## TIMELINE

**Week 1 (Nov 9-13)**:
- Steps 1-3: Foundation + Resume Upload ← CRITICAL
- Steps 4-6: Complete Onboarding
- Steps 7-10: Session & Error Handling

**Week 2 (Nov 16-18)**:
- Steps 11-14: Chat Enhancements
- Step 15: Admin Dashboard
- Steps 16-18: Testing & Deployment

---

## SUCCESS CRITERIA FOR v0 COMPLETE

✅ Onboarding flow works end-to-end (Steps 1-6)
✅ Chat interface responds to queries (Steps 7-14)
✅ Admin dashboard accessible and functional (Step 15)
✅ All errors handled gracefully (Step 9)
✅ Session persistence working (Step 8)
✅ Mobile responsive (throughout)
✅ Deployed to production (Step 18)
✅ No console errors or warnings (throughout)
✅ All backend API calls successful (throughout)
✅ User can complete full journey: onboard → chat → manage (E2E)

---

## READY TO START?

**Next Action**: Implement Step 1 (API Service Layer)

Once you're ready, I'll provide exact code for `lib/api.ts`, `lib/config.ts`, `lib/types.ts`, and `.env.local`.

After you create those files, you'll test Step 1 by running:
```bash
npm run build
```

Then I'll ask: "Can you verify Step 1 - build successful and no errors?"

---

**Questions before we start?**
- Want to adjust timeline?
- Need clarification on any step?
- Want to reorder priority?
- Any blockers I should know about?

**Status**: Awaiting confirmation to proceed with Step 1 ✅
