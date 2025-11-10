import OpenAI from 'openai';
import { getModelConfig, DEFAULT_RETRY_CONFIG, calculateBackoffDelay, isRetryableError } from '../config/ai-models.js';
import {
  extractJSON,
  validateAIResponse,
  RESUME_ANALYSIS_SCHEMA,
  extractOpenAIContent,
} from '../utils/ai-response-schemas.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('ResumeParserService');

export interface SkillEntry {
  name: string;
  category: 'Programming Language' | 'Frontend Framework' | 'Backend Framework' | 'Database' | 'Cloud' | 'DevOps' | 'Tool' | 'Platform' | 'Other';
  proficiency?: 'Beginner' | 'Intermediate' | 'Advanced'; // User fills this during review
}

export interface ExtractedResumeData {
  skills: SkillEntry[];
  experience: Experience[];
  education: Education[];
  summary: string;
  name?: string;
  email?: string;
  phoneNumber?: string;
  location?: string;
}

export interface Experience {
  title: string;
  company: string;
  duration: string;
  description?: string;
  startYear?: number;
  endYear?: number;
}

export interface Education {
  degree: string;
  institution: string;
  field?: string;
  graduationYear?: number;
}

/**
 * ResumeParserService - Intelligently extracts structured data from resume text
 * - Extracts skills, experience, education with high quality
 * - Retry logic with exponential backoff for reliability
 * - Comprehensive logging for debugging
 * - Schema validation to prevent hallucination
 */
export class ResumeParserService {
  private openai: OpenAI | null = null;
  private apiKeyAvailable: boolean;

  constructor() {
    this.apiKeyAvailable = !!process.env.OPENAI_API_KEY;
    
    if (this.apiKeyAvailable) {
      try {
        this.openai = new OpenAI({
          apiKey: process.env.OPENAI_API_KEY,
        });
      } catch (error) {
        logger.error('Failed to initialize OpenAI client', {
          error: error instanceof Error ? error.message : String(error),
        });
        this.apiKeyAvailable = false;
      }
    }
  }

  private getClient(): OpenAI {
    if (!this.openai) {
      throw new Error('OpenAI API key not available. Set OPENAI_API_KEY environment variable.');
    }
    return this.openai;
  }

  /**
   * Parse resume text with retry logic and comprehensive validation
   */
  async parseResume(resumeText: string): Promise<ExtractedResumeData> {
    const startTime = Date.now();

    if (!resumeText || resumeText.trim().length === 0) {
      throw new Error('Resume text is empty');
    }

    logger.info('Starting resume parsing', {
      textLength: resumeText.length,
    });

    let response;
    let attempts = 0;
    let lastError: Error | null = null;

    // Retry loop with exponential backoff
    while (attempts < DEFAULT_RETRY_CONFIG.maxAttempts) {
      try {
        attempts++;
        logger.info('Calling OpenAI for resume analysis', {
          attempt: attempts,
          maxAttempts: DEFAULT_RETRY_CONFIG.maxAttempts,
        });

        const modelConfig = getModelConfig('resumeAnalysis');

        const systemPrompt = `You are an expert resume parser. Extract ONLY information explicitly stated in the provided resume text.

Return a JSON object with this exact structure:
{
  "skills": [
    {
      "name": "Skill Name",
      "category": "Programming Language|Frontend Framework|Backend Framework|Database|Cloud|DevOps|Tool|Platform|Other"
    }
  ],
  "experience": [
    {
      "title": "Job Title",
      "company": "Company Name",
      "duration": "MM/YYYY - MM/YYYY",
      "description": "Brief description of responsibilities",
      "startYear": 2020,
      "endYear": 2022
    }
  ],
  "education": [
    {
      "degree": "Degree Type",
      "institution": "University/School Name",
      "field": "Field of Study",
      "graduationYear": 2020
    }
  ],
  "summary": "Professional summary or objective from the resume",
  "name": "Full Name",
  "email": "Email address",
  "phoneNumber": "Phone number",
  "location": "City, State or Country"
}

CRITICAL RULES:
1. Extract ONLY information that is explicitly present in the resume text
2. Do NOT infer, assume, or hallucinate any information
3. If a field is not found in the resume, OMIT it entirely (don't use empty strings or null)
4. For skills: Extract ALL technical skills mentioned (expect 20-50 total)
   - Include: Programming languages, frameworks, libraries, tools, platforms, databases, cloud services
   - Do NOT add generic soft skills like "Communication" or "Problem Solving"
   - For each skill, assign the most appropriate category
5. For experience: Include all employment entries with dates and descriptions as provided
6. For education: Include all degrees/certifications with full details as stated
7. For duration: Extract dates exactly as found, format as MM/YYYY - MM/YYYY if available
8. Return valid JSON ONLY, no markdown, no extra text`;

        const userPrompt = `Parse this resume and extract ONLY explicitly stated information:\n\n${resumeText}`;

        response = await this.getClient().chat.completions.create({
          ...modelConfig,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
        });

        break; // Success, exit retry loop
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        const isRetryable = isRetryableError(error);

        logger.warn('OpenAI request failed', {
          attempt: attempts,
          maxAttempts: DEFAULT_RETRY_CONFIG.maxAttempts,
          error: lastError.message,
          retryable: isRetryable,
        });

        if (!isRetryable || attempts >= DEFAULT_RETRY_CONFIG.maxAttempts) {
          throw lastError;
        }

        // Calculate backoff delay
        const delayMs = calculateBackoffDelay(attempts);
        logger.info(`Retrying in ${delayMs}ms...`, { delay: delayMs });
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }

    if (!response) {
      throw lastError || new Error('Failed to get response from OpenAI');
    }

    // Safely extract content from response
    const jsonText = extractOpenAIContent(response);
    logger.debug('OpenAI response received', {
      length: jsonText.length,
      preview: jsonText.substring(0, 500),
    });

    // Extract and parse JSON with defensive handling
    const extracted = extractJSON(jsonText);

    // Validate against schema
    const validated = validateAIResponse(extracted, RESUME_ANALYSIS_SCHEMA, 'resume analysis');

    const duration = Date.now() - startTime;
    logger.info('Resume analysis completed successfully', {
      durationMs: duration,
      skillsCount: validated.skills?.length || 0,
      experienceCount: validated.experience?.length || 0,
      educationCount: validated.education?.length || 0,
      rawTextLength: resumeText.length,
    });

    return validated as ExtractedResumeData;
  }

  /**
   * Extract skills from resume with categories (fast, accurate)
   * Uses GPT-4o for better categorization accuracy (one-time onboarding cost)
   * Proficiency levels are filled by user during Step 2 review
   */
  async extractSkills(resumeText: string): Promise<SkillEntry[]> {
    const startTime = Date.now();

    if (!resumeText || resumeText.trim().length === 0) {
      throw new Error('Resume text is empty');
    }

    logger.info('Starting skill extraction', { textLength: resumeText.length });

    let response;
    let attempts = 0;
    let lastError: Error | null = null;

    while (attempts < DEFAULT_RETRY_CONFIG.maxAttempts) {
      try {
        attempts++;
        logger.info('Extracting skills from resume', {
          attempt: attempts,
          maxAttempts: DEFAULT_RETRY_CONFIG.maxAttempts,
        });

        const modelConfig = getModelConfig('skillsExtraction');

        const systemPrompt = `You are an expert at identifying and categorizing technical skills from resumes.
Extract ALL technical skills EXPLICITLY MENTIONED in the resume and categorize each one.

Return ONLY a valid JSON array of skill objects, no other text:
[
  {
    "name": "Skill Name",
    "category": "Category"
  }
]

CATEGORIES (pick the most appropriate one):
- Programming Language (Python, JavaScript, Java, Go, Rust, C++, etc.)
- Frontend Framework (React, Vue, Angular, Svelte, Next.js, etc.)
- Backend Framework (Express, Django, FastAPI, Spring, Rails, etc.)
- Database (PostgreSQL, MongoDB, Redis, MySQL, DynamoDB, etc.)
- Cloud (AWS, GCP, Azure, Heroku, etc.)
- DevOps (Docker, Kubernetes, CI/CD, GitHub Actions, Jenkins, etc.)
- Tool (Git, Linux, Vim, npm, yarn, Webpack, etc.)
- Platform (iOS, Android, Web, Desktop, etc.)
- Other (anything that doesn't fit above)

EXTRACTION RULES:
1. Extract ALL technical skills mentioned in the resume (expect 20-50)
2. Do NOT infer skills not explicitly stated
3. Do NOT add generic soft skills (Communication, Problem Solving, etc.)
4. For each skill, choose the ONE most appropriate category
5. Keep skill names exactly as they appear in resume
6. Return ONLY valid JSON array, no markdown`;

        const userPrompt = `Extract ALL technical skills with their categories from this resume:\n\n${resumeText}`;

        response = await this.getClient().chat.completions.create({
          ...modelConfig,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
        });

        break;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        const isRetryable = isRetryableError(error);

        logger.warn('Skills extraction failed', {
          attempt: attempts,
          error: lastError.message,
          retryable: isRetryable,
        });

        if (!isRetryable || attempts >= DEFAULT_RETRY_CONFIG.maxAttempts) {
          throw lastError;
        }

        const delayMs = calculateBackoffDelay(attempts);
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }

    if (!response) {
      throw lastError || new Error('Failed to get response from OpenAI');
    }

    const jsonText = extractOpenAIContent(response);
    const skills = extractJSON(jsonText);

    if (!Array.isArray(skills)) {
      throw new Error('Invalid response format: expected array');
    }

    // Validate and normalize skills
    const validSkills = skills
      .filter((s: any) => s && typeof s === 'object' && s.name && s.category)
      .map((s: any) => ({
        name: String(s.name).trim(),
        category: String(s.category).trim() as SkillEntry['category'],
      }));

    const duration = Date.now() - startTime;
    logger.info('Skill extraction completed', {
      durationMs: duration,
      skillsCount: validSkills.length,
    });

    return validSkills;
  }

  /**
   * Extract just experience from resume with retry logic
   */
  async extractExperience(resumeText: string): Promise<Experience[]> {
    const startTime = Date.now();

    if (!resumeText || resumeText.trim().length === 0) {
      throw new Error('Resume text is empty');
    }

    logger.info('Starting experience extraction', { textLength: resumeText.length });

    let response;
    let attempts = 0;
    let lastError: Error | null = null;

    while (attempts < DEFAULT_RETRY_CONFIG.maxAttempts) {
      try {
        attempts++;
        logger.info('Extracting experience', {
          attempt: attempts,
          maxAttempts: DEFAULT_RETRY_CONFIG.maxAttempts,
        });

        const modelConfig = getModelConfig('experienceExtraction');

        const systemPrompt = `You are an expert at extracting work experience from resumes.
Extract a JSON array of work experience EXPLICITLY STATED in the resume.
Return ONLY a valid JSON array with objects like this:
[
  {
    "title": "Job Title exactly as stated",
    "company": "Company Name",
    "duration": "MM/YYYY - MM/YYYY",
    "description": "Brief description of responsibilities and achievements",
    "startYear": 2020,
    "endYear": 2022
  }
]

RULES:
1. Extract ONLY employment entries explicitly listed in the resume
2. Use dates exactly as provided in the resume
3. For missing end dates, use current year or "Present"
4. Do NOT infer positions that are not clearly stated
5. Order by most recent first if possible
6. Each description should be 1-2 sentences max`;

        const userPrompt = `Extract ONLY the work experience explicitly mentioned in this resume:\n\n${resumeText}`;

        response = await this.getClient().chat.completions.create({
          ...modelConfig,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
        });

        break;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        const isRetryable = isRetryableError(error);

        logger.warn('Experience extraction failed', {
          attempt: attempts,
          error: lastError.message,
          retryable: isRetryable,
        });

        if (!isRetryable || attempts >= DEFAULT_RETRY_CONFIG.maxAttempts) {
          throw lastError;
        }

        const delayMs = calculateBackoffDelay(attempts);
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }

    if (!response) {
      throw lastError || new Error('Failed to get response from OpenAI');
    }

    const jsonText = extractOpenAIContent(response);
    const experience = extractJSON(jsonText);

    if (!Array.isArray(experience)) {
      throw new Error('Invalid response format: expected array');
    }

    // Validate and normalize experience entries
    const validExperience = experience
      .filter((exp: any) => exp && typeof exp === 'object' && (exp.title || exp.role))
      .map((exp: any) => ({
        title: String(exp.title || exp.role || 'Position').trim(),
        company: String(exp.company || 'Company').trim(),
        duration: String(exp.duration || '').trim(),
        description: exp.description ? String(exp.description).trim() : undefined,
        startYear: exp.startYear ? Number(exp.startYear) : undefined,
        endYear: exp.endYear ? Number(exp.endYear) : undefined,
      }));

    const duration = Date.now() - startTime;
    logger.info('Experience extraction completed', {
      durationMs: duration,
      experienceCount: validExperience.length,
    });

    return validExperience;
  }

}

// Singleton instance
let parserInstance: ResumeParserService | null = null;

export function getResumeParser(): ResumeParserService {
  if (!parserInstance) {
    parserInstance = new ResumeParserService();
  }
  return parserInstance;
}
