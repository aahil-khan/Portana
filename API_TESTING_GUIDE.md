# Resume Upload API - Testing Guide

## Quick Start

### 1. Start the Backend Server
```bash
cd backend
npm run dev
# Server runs on http://localhost:3001
```

### 2. Test with cURL

#### Upload a PDF resume:
```bash
curl -X POST http://localhost:3001/api/onboarding/upload-resume \
  -F "file=@/path/to/resume.pdf"
```

#### Upload a DOCX resume:
```bash
curl -X POST http://localhost:3001/api/onboarding/upload-resume \
  -F "file=@/path/to/resume.docx"
```

### 3. Test with Postman

1. Create new POST request to `http://localhost:3001/api/onboarding/upload-resume`
2. Go to "Body" tab → select "form-data"
3. Add key "file" (type: File)
4. Select your PDF/DOCX resume
5. Click Send

### 4. Test with JavaScript/Fetch

```javascript
const formData = new FormData();
formData.append('file', fileInput.files[0]); // from <input type="file" id="fileInput">

const response = await fetch('http://localhost:3001/api/onboarding/upload-resume', {
  method: 'POST',
  body: formData
});

const result = await response.json();
console.log(result);
```

## Expected Response Format

### Success (200)
```json
{
  "success": true,
  "data": {
    "skills": [
      {
        "name": "React",
        "category": "Frontend Framework",
        "proficiency": "Advanced"
      },
      {
        "name": "TypeScript",
        "category": "Programming Language",
        "proficiency": "Advanced"
      },
      {
        "name": "Node.js",
        "category": "Backend Framework",
        "proficiency": "Intermediate"
      }
    ],
    "experience": [
      {
        "title": "Senior Software Engineer",
        "company": "Tech Company",
        "startDate": "2020-01",
        "endDate": "2023-12",
        "duration": "3 years 11 months",
        "description": "Led development of React frontend..."
      },
      {
        "title": "Junior Developer",
        "company": "StartUp Inc",
        "startDate": "2018-06",
        "endDate": "2019-12",
        "duration": "1 year 6 months",
        "description": "Developed web applications..."
      }
    ],
    "education": [
      {
        "degree": "Bachelor of Science",
        "field": "Computer Science",
        "institution": "State University",
        "graduationYear": 2018
      }
    ],
    "summary": "Experienced software engineer with expertise in React, Node.js, and cloud technologies..."
  },
  "message": "Resume parsed successfully"
}
```

### Error - No File (400)
```json
{
  "success": false,
  "error": "No file uploaded"
}
```

### Error - Invalid File Type (400)
```json
{
  "success": false,
  "error": "Invalid file type: text/plain. Only PDF and DOCX files are allowed."
}
```

### Error - Empty Resume (400)
```json
{
  "success": false,
  "error": "Resume file is empty or could not be parsed"
}
```

### Error - Parsing Failed (400)
```json
{
  "success": false,
  "error": "Failed to parse PDF: PDFs are encrypted"
}
```

## What to Verify ✅

### Functionality
- [ ] PDF files parse successfully
- [ ] DOCX files parse successfully
- [ ] DOC files parse successfully (deprecated format)
- [ ] All skills come from known taxonomy (no hallucination)
- [ ] Skills are correctly categorized
- [ ] Experience entries include all details
- [ ] Education includes degree, field, institution, graduation year
- [ ] Summary is present and relevant

### Data Quality
- [ ] No duplicate skills in output
- [ ] Skill count is reasonable (25-50 for typical resume)
- [ ] No empty proficiency fields
- [ ] Job titles are accurate
- [ ] Company names are extracted correctly
- [ ] Dates are in correct format (YYYY-MM)
- [ ] No hallucinated/made-up skills

### Error Handling
- [ ] Error for unsupported file types (e.g., .txt, .jpg)
- [ ] Error for files larger than 10MB
- [ ] Error for empty files
- [ ] Error for corrupted files
- [ ] Meaningful error messages

### Performance
- [ ] Response time < 10 seconds for typical resume
- [ ] File is cleaned up after processing
- [ ] No memory leaks with multiple uploads

## Debugging

### View Backend Logs
When running `npm run dev`, logs show:
- File upload details (filename, mimetype)
- Text extraction progress
- Parsed skills count
- Any errors during parsing

Example:
```
[2024-01-15 14:23:45] INFO: Processing uploaded resume { filename: "resume.pdf", mimetype: "application/pdf" }
[2024-01-15 14:23:48] INFO: Resume parsed successfully { skillsCount: 38, experienceCount: 3, educationCount: 2 }
```

### Test with Sample Resume
```
John Doe
Software Engineer

EXPERIENCE:
- Senior Developer at Tech Corp (2020-2023)
  Led React frontend development, managed TypeScript codebases
  Built Docker containers, deployed to AWS
  
- Junior Developer at StartUp (2018-2020)
  Full-stack development with Node.js and MongoDB

SKILLS:
React, TypeScript, Node.js, MongoDB, Docker, AWS, Python, PostgreSQL

EDUCATION:
Bachelor of Science in Computer Science - State University (2018)
```

Expected output: 8+ skills, properly categorized

## Common Issues

### Issue: "Module 'pdf-parse' not found"
**Solution**: Run `npm install pdf-parse @types/pdf-parse` in backend folder

### Issue: "Module 'mammoth' not found"
**Solution**: Run `npm install mammoth` in backend folder

### Issue: "Module '@fastify/multipart' not found"
**Solution**: Run `npm install @fastify/multipart` in backend folder

### Issue: Request hangs or times out
**Solution**: 
1. Check file size (max 10MB)
2. Check server logs for errors
3. Restart backend with `npm run dev`

### Issue: Empty skills array
**Cause**: Resume text extraction failed or contains no recognizable skills
**Check**: 
1. PDF/DOCX is readable
2. Resume has a skills section
3. Skills match taxonomy (check skill-taxonomy.ts)

## File Size Limits

- Maximum: 10MB per file
- Recommended: < 5MB for faster processing
- Typical resume: 50KB - 500KB

## Supported File Types

- ✅ PDF (.pdf)
- ✅ Microsoft Word 2007+ (.docx)
- ✅ Microsoft Word 97-2003 (.doc)
- ❌ Google Docs
- ❌ ODT (OpenDocument)
- ❌ RTF (Rich Text Format)

## Integration Notes

### For Frontend (portana-frontend)

The endpoint is called from the onboarding Step 2:

```javascript
// Use FormData for file upload
const formData = new FormData();
formData.append('file', resumeFile);

const response = await fetch(`${API_URL}/api/onboarding/upload-resume`, {
  method: 'POST',
  body: formData
  // Note: Don't set Content-Type header, browser will set it automatically
});

const result = await response.json();

if (result.success) {
  // result.data contains { skills, experience, education, summary }
  // Update Step 2 state with this data
} else {
  // Show error: result.error
}
```

### Database Persistence (TODO)

After receiving parsed data, save to database:

```typescript
// In backend - next step
await db.onboardingStep2.create({
  userId,
  sessionId,
  skills: result.data.skills,
  experience: result.data.experience,
  education: result.data.education,
  summary: result.data.summary
});
```

## Next Steps

1. **Test with portana-frontend** - Upload through UI
2. **Verify skill extraction** - Check for hallucinations
3. **Database persistence** - Save parsed data
4. **Continue onboarding flow** - Implement Steps 3-5
