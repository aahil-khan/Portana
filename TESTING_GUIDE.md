# Step-by-Step Testing Guide

## Goal
Test the onboarding flow to understand exactly what data is being stored where, and verify vectors are being created in Qdrant.

---

## Prerequisites

### Terminal 1: Backend (Port 3000)
```bash
cd backend
npm run dev
# Watch for port 3000 startup
```

### Terminal 2: Frontend (Port 3200)
```bash
cd portana-frontend
npm run dev
# Watch for port 3200 startup
```

### Terminal 3: CLI Testing
Used for curl commands to inspect data

---

## Test Sequence

### Step 1: Navigate to Onboarding
```
Browser: http://localhost:3200/onboarding
```

You should see Step 1: "Let's get started!"

---

### Step 2: Fill Step 1 Form

Enter:
- **Full Name**: "John Doe"
- **Email**: "john@example.com"
- **Bio**: "I am a software engineer with 5 years of experience in full-stack development and cloud architecture."
- **Website**: "https://johndoe.dev"
- **GitHub Profile**: "https://github.com/johndoe"
- **LinkedIn Profile**: "https://linkedin.com/in/johndoe"

Click **"Continue"**

---

### Step 3: Inspect Step 1 Data

**In Terminal 3, run:**
```bash
# Get the session ID from localStorage (shown in browser console)
# Look for "[Step1] Extracted userId: <USER_ID>"

# Then inspect the session:
curl -s http://localhost:3000/api/onboarding/<USER_ID>/debug | jq '.'
```

**Expected Output:**
```json
{
  "success": true,
  "sessionId": "...",
  "createdAt": "...",
  "data": {
    "step1": {
      "name": "John Doe",
      "email": "john@example.com",
      "bio": "I am a software engineer...",
      "website": "https://johndoe.dev",
      "githubUrl": "https://github.com/johndoe",
      "linkedinUrl": "https://linkedin.com/in/johndoe"
    },
    "step2": null,
    ...
  }
}
```

✅ If step1 is populated, Step 1 is working correctly

---

### Step 4: Fill Step 2 (Resume Upload)

Copy this resume text:
```
JOHN DOE
john@example.com | github.com/johndoe | johndoe.dev

PROFESSIONAL SUMMARY
Full-stack engineer with 5+ years of experience building scalable web applications. Expert in JavaScript, React, Node.js, and cloud infrastructure. Proven track record of leading teams and delivering high-impact projects.

TECHNICAL SKILLS
Languages: JavaScript (Advanced), Python (Intermediate), TypeScript (Advanced), SQL (Advanced)
Frontend: React, Next.js, Vue.js, Tailwind CSS, Material-UI
Backend: Node.js, Express, FastAPI, Django, GraphQL
Databases: PostgreSQL, MongoDB, Redis
Cloud & DevOps: AWS (EC2, S3, Lambda), Docker, Kubernetes, CI/CD

EXPERIENCE

Senior Software Engineer | TechCorp (Jan 2022 - Present)
- Led team of 5 engineers on microservices architecture
- Reduced API response time by 40% through optimization
- Mentored junior developers and conducted code reviews
- Architected real-time notification system serving 100k+ users

Full Stack Engineer | StartupXYZ (Jun 2020 - Dec 2021)
- Built React-based SPA frontend with 50+ components
- Developed RESTful APIs using Node.js/Express
- Implemented database migrations and optimization
- Deployed applications on AWS using Docker and Kubernetes

Junior Developer | WebAgency (Feb 2019 - May 2020)
- Developed WordPress plugins and custom themes
- Built responsive websites using vanilla JavaScript
- Assisted in database design and optimization

EDUCATION

Bachelor of Science in Computer Science
State University (2019)
GPA: 3.8/4.0

CERTIFICATIONS
- AWS Certified Solutions Architect - Associate (2021)
- MongoDB Certified Associate (2020)

PROJECTS
Portfolio Website: johndoe.dev - Built with Next.js, showcases 10+ projects
GitHub Stats Dashboard: Real-time GitHub analytics tool (React, Python, PostgreSQL)
```

**Upload:**
1. Click "Drop your resume here" or select file
2. Paste the resume text (or create a PDF/DOCX file)
3. Click "Upload & Parse"
4. Wait for parsing to complete

---

### Step 5: Inspect Step 2 Data BEFORE Editing

**In Terminal 3, run:**
```bash
curl -s http://localhost:3000/api/onboarding/<USER_ID>/debug | jq '.data.step2'
```

**Expected Output:**
```json
{
  "resumeText": "JOHN DOE...",
  "skillsCount": 14,
  "experienceCount": 3,
  "educationCount": 1,
  "skills": [
    { "name": "JavaScript", "category": "Languages", "proficiency": "Advanced" },
    ...
  ],
  "experience": [...],
  "education": [...]
}
```

✅ If skills/experience/education are populated, parsing is working

---

### Step 6: Edit Step 2 Data

**In the browser:**
1. You should see the parsed data displayed
2. Edit one skill (e.g., change JavaScript proficiency from "Advanced" to "Beginner")
3. Scroll down and click **"Confirm & Continue"**

---

### Step 7: Inspect Step 2 Data AFTER Editing

**Problem to Check:**
Did your edits get saved to the backend?

**In Terminal 3, run:**
```bash
curl -s http://localhost:3000/api/onboarding/<USER_ID>/debug | jq '.data.step2.skills'
```

**Check:**
- Is JavaScript proficiency "Beginner" (your edit)?
- Or still "Advanced" (original parsing)?

🔴 **If still "Advanced"**: This is the bug! Edits aren't being sent to backend.

---

### Step 8: Check Vectors in Qdrant

**In Terminal 3, run:**
```bash
curl -s http://localhost:3000/api/admin/vectors | jq '.'
```

**Expected Output:**
```json
{
  "qdrant": {
    "points_count": X,
    "vectors_count": Y,
    "collection_name": "resumes"
  },
  "deduplication": {...}
}
```

**Check:**
- Did `points_count` increase after Step 2?
- Should have ~30-50 vectors for one resume (3-tier approach)

🔴 **If points_count didn't increase**: Vectors aren't being created even though Step 2 was "completed"

---

## What We're Testing

| Test | Command | Success Criteria |
|------|---------|------------------|
| Step 1 data stored | `/debug` endpoint | `step1` object populated |
| Step 2 resume parsed | `/debug` endpoint | `step2.skillsCount > 0` |
| Step 2 edits persisted | `/debug` endpoint | Edits match what user entered |
| Vectors created | `/admin/vectors` | `points_count` increased |
| Vector details | Manual endpoint | Can see skills/experience as vectors |

---

## Issues to Document

When you test, note:

1. **Does Step 1 save correctly?** (Y/N)
   - Check with: `/debug` endpoint

2. **Does Step 2 parse correctly?** (Y/N)
   - Check with: `/debug` endpoint -> skills count

3. **Do Step 2 edits persist?** (Y/N)
   - Edit data, then check `/debug` endpoint

4. **Are vectors created?** (Y/N)
   - Check with: `/admin/vectors` endpoint

5. **Can you see what vectors were created?** (Y/N)
   - Need to add detailed vector inspection endpoint

---

## If Something Fails

**If vectors aren't created:**
```
Check backend console for errors
Expected logs:
- "[Resume Parser] Extracted X skills for session..."
- "[Onboarding Step 2] Successfully embedded resume..."
```

**If edits don't persist:**
```
The frontend is calling /upload-resume but NOT calling the Step 2 endpoint
Frontend needs: handleComplete() -> send edited data to /step/2 endpoint
```

**If Step 1 doesn't save:**
```
Check browser console for network errors
Check backend console for validation errors
```

---

## Next: Once Testing Complete

Once we verify what's actually happening:
1. Fix the bugs (edits not persisting, vectors not created, etc.)
2. Do same testing for Step 3, 4, 5
3. Only then implement the finalize flow

This way we know exactly what each step does and can iterate confidently.
