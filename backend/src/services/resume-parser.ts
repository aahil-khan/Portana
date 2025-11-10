import OpenAI from 'openai';
import { getModelConfig, DEFAULT_RETRY_CONFIG, calculateBackoffDelay, isRetryableError } from '../config/ai-models.js';
import { getTaxonomyForPrompt } from '../config/skill-taxonomy.js';
import { extractJSON, extractOpenAIContent } from '../utils/ai-response-schemas.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('ResumeParserService');

export interface SkillEntry {
  name: string;
  category: string;
  // Proficiency is NOT extracted by AI - user fills this during Step 2 review
}

export interface ExtractedResumeData {
  skills: SkillEntry[];
  experience: Experience[];
  education: Education[];
  summary?: string;
}

export interface Experience {
  title: string;
  company: string;
  duration?: string;
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
 * 
 * KEY DIFFERENCES FROM PREVIOUS APPROACH:
 * 1. Uses skill taxonomy to prevent hallucination
 * 2. Makes separate API calls for skills, experience, education (not one big call)
 * 3. Uses GPT-3.5-Turbo for simpler, more deterministic extraction
 * 4. Explicitly forbids hallucination in prompts
 * 5. DOES NOT extract personal info (already collected in Step 1)
 * 6. DOES NOT extract proficiency levels (user sets during Step 2)
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
   * Parse resume text - extract skills, experience, education
   * Calls separate AI endpoints for each to prevent hallucination
   */
  async parseResume(resumeText: string): Promise<ExtractedResumeData> {
    const startTime = Date.now();

    if (!resumeText || resumeText.trim().length === 0) {
      throw new Error('Resume text is empty');
    }

    logger.info('Starting resume parsing', {
      textLength: resumeText.length,
    });

    try {
      // Make separate calls for each data type to avoid hallucination
      const [skills, experience, education, summary] = await Promise.all([
        this.extractSkills(resumeText),
        this.extractExperience(resumeText),
        this.extractEducation(resumeText),
        this.extractSummary(resumeText),
      ]);

      const result: ExtractedResumeData = {
        skills,
        experience,
        education,
        summary,
      };

      const duration = Date.now() - startTime;
      logger.info('Resume parsing completed successfully', {
        durationMs: duration,
        skillsCount: skills.length,
        experienceCount: experience.length,
        educationCount: education.length,
      });

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error('Resume parsing failed', {
        error: error instanceof Error ? error.message : String(error),
        durationMs: duration,
      });
      throw error;
    }
  }

  /**
   * Extract ALL skills with categories using skill taxonomy
   * Uses GPT-3.5-Turbo for simpler, more accurate extraction
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

    const taxonomyForPrompt = getTaxonomyForPrompt();

    while (attempts < DEFAULT_RETRY_CONFIG.maxAttempts) {
      try {
        attempts++;
        logger.info('Extracting skills from resume', {
          attempt: attempts,
          maxAttempts: DEFAULT_RETRY_CONFIG.maxAttempts,
        });

        const modelConfig = getModelConfig('skillsExtraction');

        const systemPrompt = `You are an expert at identifying technical skills from resumes.

Your job: Extract ALL technical skills mentioned in the resume and assign each to one category.

IMPORTANT RULES:
1. Extract EVERY technical skill mentioned (expect 20-50 skills)
2. Do NOT infer skills not explicitly stated in the resume
3. Do NOT add skills the person doesn't actually have
4. Return ONLY valid JSON array format, no markdown or explanations
5. If you're unsure about a skill, include it - don't omit it
6. Keep skill names exactly as they appear in the resume

VALID CATEGORIES (choose ONE for each skill):
${taxonomyForPrompt}

RESPONSE FORMAT - Return ONLY this JSON array structure:
[
  {"name": "Skill Name", "category": "Category Name"},
  {"name": "Another Skill", "category": "Another Category"}
]`;

        const userPrompt = `Extract ALL technical skills from this resume:\n\n${resumeText}`;

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

        logger.warn('Skills extraction attempt failed', {
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

    try {
      const jsonText = extractOpenAIContent(response);
      logger.debug('Skills extraction response received', { length: jsonText.length });

      const skills = extractJSON(jsonText);

      if (!Array.isArray(skills)) {
        logger.warn('Skills response is not an array', { type: typeof skills });
        return [];
      }

      // Validate and normalize skills
      const validSkills = skills
        .filter((s: any) => {
          const isValid = s && typeof s === 'object' && s.name && s.category;
          if (!isValid) {
            logger.debug('Filtered out invalid skill', { skill: s });
          }
          return isValid;
        })
        .map((s: any) => ({
          name: String(s.name).trim(),
          category: String(s.category).trim(),
        }));

      const duration = Date.now() - startTime;
      logger.info('Skill extraction completed', {
        durationMs: duration,
        skillsExtracted: validSkills.length,
        totalInResponse: skills.length,
      });

      return validSkills;
    } catch (error) {
      logger.error('Failed to parse skills response', {
        error: error instanceof Error ? error.message : String(error),
      });
      return [];
    }
  }

  /**
   * Extract work experience entries
   * Only extracts EXPLICITLY STATED positions
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

Your job: Extract ONLY the job positions explicitly listed in the resume.

IMPORTANT RULES:
1. Extract ONLY work experiences clearly stated in the resume
2. Do NOT infer positions the person didn't explicitly mention
3. Include job title, company name, dates, and responsibilities as stated
4. Do NOT make up companies, dates, or job responsibilities
5. If dates are missing, use what you can find
6. Return ONLY valid JSON array, no markdown or explanations

RESPONSE FORMAT:
[
  {
    "title": "Job Title as stated",
    "company": "Company Name",
    "duration": "Start Date - End Date (as found in resume)",
    "description": "Brief description of what they did (1-2 sentences from resume)"
  }
]`;

        const userPrompt = `Extract work experience from this resume:\n\n${resumeText}`;

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

        logger.warn('Experience extraction attempt failed', {
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

    try {
      const jsonText = extractOpenAIContent(response);
      logger.debug('Experience extraction response received', { length: jsonText.length });

      const experience = extractJSON(jsonText);

      if (!Array.isArray(experience)) {
        logger.warn('Experience response is not an array', { type: typeof experience });
        return [];
      }

      // Validate and normalize
      const validExperience = experience
        .filter((exp: any) => exp && typeof exp === 'object' && exp.title && exp.company)
        .map((exp: any) => ({
          title: String(exp.title).trim(),
          company: String(exp.company).trim(),
          duration: exp.duration ? String(exp.duration).trim() : undefined,
          description: exp.description ? String(exp.description).trim() : undefined,
        }));

      const duration = Date.now() - startTime;
      logger.info('Experience extraction completed', {
        durationMs: duration,
        experienceExtracted: validExperience.length,
        totalInResponse: experience.length,
      });

      return validExperience;
    } catch (error) {
      logger.error('Failed to parse experience response', {
        error: error instanceof Error ? error.message : String(error),
      });
      return [];
    }
  }

  /**
   * Extract education entries
   * Only extracts EXPLICITLY STATED degrees/certifications
   */
  async extractEducation(resumeText: string): Promise<Education[]> {
    const startTime = Date.now();

    if (!resumeText || resumeText.trim().length === 0) {
      throw new Error('Resume text is empty');
    }

    logger.info('Starting education extraction', { textLength: resumeText.length });

    let response;
    let attempts = 0;
    let lastError: Error | null = null;

    while (attempts < DEFAULT_RETRY_CONFIG.maxAttempts) {
      try {
        attempts++;
        logger.info('Extracting education', {
          attempt: attempts,
          maxAttempts: DEFAULT_RETRY_CONFIG.maxAttempts,
        });

        const modelConfig = getModelConfig('educationExtraction');

        const systemPrompt = `You are an expert at extracting education from resumes.

Your job: Extract ONLY the education entries explicitly listed in the resume.

IMPORTANT RULES:
1. Extract ONLY degrees/certifications clearly stated in the resume
2. Do NOT infer education the person didn't explicitly mention
3. Include degree, institution, field of study, and graduation year as stated
4. Do NOT make up schools, degrees, or graduation years
5. Return ONLY valid JSON array, no markdown or explanations

RESPONSE FORMAT:
[
  {
    "degree": "Bachelor of Science",
    "institution": "University Name",
    "field": "Computer Science",
    "graduationYear": 2020
  }
]`;

        const userPrompt = `Extract education from this resume:\n\n${resumeText}`;

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

        logger.warn('Education extraction attempt failed', {
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

    try {
      const jsonText = extractOpenAIContent(response);
      logger.debug('Education extraction response received', { length: jsonText.length });

      const education = extractJSON(jsonText);

      if (!Array.isArray(education)) {
        logger.warn('Education response is not an array', { type: typeof education });
        return [];
      }

      // Validate and normalize
      const validEducation = education
        .filter((edu: any) => edu && typeof edu === 'object' && edu.degree && edu.institution)
        .map((edu: any) => ({
          degree: String(edu.degree).trim(),
          institution: String(edu.institution).trim(),
          field: edu.field ? String(edu.field).trim() : undefined,
          graduationYear: edu.graduationYear ? Number(edu.graduationYear) : undefined,
        }));

      const duration = Date.now() - startTime;
      logger.info('Education extraction completed', {
        durationMs: duration,
        educationExtracted: validEducation.length,
        totalInResponse: education.length,
      });

      return validEducation;
    } catch (error) {
      logger.error('Failed to parse education response', {
        error: error instanceof Error ? error.message : String(error),
      });
      return [];
    }
  }

  /**
   * Extract professional summary from resume
   */
  async extractSummary(resumeText: string): Promise<string | undefined> {
    const startTime = Date.now();

    if (!resumeText || resumeText.trim().length === 0) {
      return undefined;
    }

    logger.info('Starting summary extraction', { textLength: resumeText.length });

    let response;
    let attempts = 0;
    let lastError: Error | null = null;

    while (attempts < DEFAULT_RETRY_CONFIG.maxAttempts) {
      try {
        attempts++;

        const modelConfig = getModelConfig('experienceExtraction');

        const systemPrompt = `Extract the professional summary or objective statement from the resume.
Return ONLY the summary text, no JSON or markdown.
If no summary is found, return empty string.`;

        const userPrompt = `Extract the professional summary from this resume:\n\n${resumeText}`;

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

        if (!isRetryable || attempts >= DEFAULT_RETRY_CONFIG.maxAttempts) {
          logger.warn('Summary extraction failed', { error: lastError.message });
          return undefined;
        }

        const delayMs = calculateBackoffDelay(attempts);
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }

    if (!response) {
      return undefined;
    }

    try {
      const summary = extractOpenAIContent(response).trim();
      if (summary && summary.length > 0 && summary.toLowerCase() !== 'empty string') {
        const duration = Date.now() - startTime;
        logger.info('Summary extraction completed', { durationMs: duration, length: summary.length });
        return summary;
      }
      return undefined;
    } catch (error) {
      logger.warn('Failed to extract summary', {
        error: error instanceof Error ? error.message : String(error),
      });
      return undefined;
    }
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
