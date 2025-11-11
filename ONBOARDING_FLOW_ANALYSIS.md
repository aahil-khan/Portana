# Onboarding Flow Analysis - Current State

## Problem Summary
1. **Checkpoint endpoint doesn't work** - Never actually tested/implemented properly
2. **Vectors not being created** - Step 2 completes but nothing appears in Qdrant
3. **We're using templates** - Frontend sends data that doesn't match backend expectations
4. **No visibility** - Can't see what's happening between steps

---

## Current Data Flow Issues

### Step 1: Basic Profile
**Frontend sends:**
```typescript
{
  full_name: "John Doe",
  bio: "...",
  email: "john@example.com",
  location: "...",
  timezone: "..."
}
```

**Backend expects (Step1Schema):**
```typescript
{
  name: string,           // ❌ Frontend sends "full_name"
  email: string,
  bio?: string,
  website?: string,
  githubUrl?: string,
  linkedinUrl?: string
}
```

**Issue:** Field name mismatch (`full_name` vs `name`)

---

### Step 2: Resume Upload
**Frontend sends (after parsing):**
```typescript
{
  resumeText: "raw resume text",
  // User edits skills, experience, education in UI
  // But these edits are NOT sent back to backend!
}
```

**Backend expects:**
```typescript
{
  resumeText: string
}
```

**What happens:**
1. User uploads resume ✓
2. Resume gets parsed ✓
3. User edits skills/proficiency in UI 🎨
4. User clicks "Confirm & Continue"
5. Only `resumeText` is sent, **NOT the edited data** ❌
6. Backend embeds the original parsed version (not user-edited) ❌

**Result:** Vectors created but with original parsing, not user edits

---

### Step 3-5: Not Designed Yet
- Frontend is just templates
- Backend schemas exist but no actual integration
- No idea what data flows where

---

## What We Need

### For Testing/Debugging:
1. **Session inspection endpoint** - See EXACTLY what's stored in memory for a session
2. **Vector inspection endpoint** - See what vectors exist for a session (more detailed than current /admin/vectors)
3. **Clear logging** - Console output showing every step of data flow

### For Actual Functionality:
1. **Field name fixes** - Match frontend sends to backend expects
2. **User edits persistence** - When user edits skills/experience, send those edits to backend
3. **Real backend logic** - Each step actually does something meaningful
4. **Clear "what gets persisted" for each step**

---

## Proposed Fix Strategy

Instead of checkpoint/finalize mess:

### Simple Per-Step Approach:
```
Frontend Step 1 → Save to localStorage
  ↓
Frontend Step 2 → Upload resume → Backend parses
  ↓
User edits skills/experience in UI
  ↓
Frontend Step 2 → Click "Save" → Send edited data to backend → Create vectors
  ↓
Frontend Step 2 → Click "Next" → Move to Step 3
```

Each step has:
- A "Save" button (persists data to backend, creates vectors/embeddings)
- A "Next" button (just moves UI forward)
- Optionally a "Back" button

This way:
- User can edit as much as they want
- When they click Save, we process it
- We can debug what's happening at each step
- Testing is clear: "Did vectors get created when I clicked Save?"

---

## Questions We Need to Answer

1. **What should Step 2 actually do?**
   - Just store resume text?
   - Or store resume text + edited skills/experience/education?

2. **What should Step 3 actually do?**
   - Connect to GitHub API and fetch repos?
   - Or just store username preferences?
   - Should we create vectors from GitHub data?

3. **What should Step 4 do?**
   - Store persona preferences for later use?
   - Create system prompt from persona?

4. **What should Step 5 do?**
   - Actually deploy something?
   - Or just finalize onboarding?

5. **When do vectors get created?**
   - After Step 2? (resume vectors)
   - After Step 3? (GitHub data vectors)
   - All at once at the end?

---

## Recommendation

Before implementing anything more:
1. **Add inspection endpoints** (see session state + vectors at any time)
2. **Fix field name mismatches** (full_name → name)
3. **Fix Step 2 to persist user edits** (not just raw resume)
4. **Test Step 2 end-to-end** (verify vectors appear in Qdrant)
5. **Only then design Steps 3-5**

This way we can see exactly what's happening and iterate based on real data flow, not assumptions.
