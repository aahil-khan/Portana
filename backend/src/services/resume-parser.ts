import OpenAI from 'openai';

export interface ExtractedResumeData {
  skills: string[];
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
 * ResumeParserService - Intelligently extracts structured data from resume text using GPT-4
 * - Extracts skills, experience, education
 * - Handles various resume formats
 * - Provides structured data for knowledge base
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
        console.warn('Failed to initialize OpenAI client:', error);
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
   * Parse resume text and extract structured data
   */
  async parseResume(resumeText: string): Promise<ExtractedResumeData> {
    if (!resumeText || resumeText.trim().length === 0) {
      throw new Error('Resume text is empty');
    }

    try {
      const systemPrompt = `You are an expert resume parser. Extract ONLY information explicitly stated in the provided resume text.

Return a JSON object with this exact structure:
{
  "skills": ["skill1", "skill2", ...],
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
4. For skills: Extract only technical skills, programming languages, frameworks, tools mentioned
5. Do NOT add generic skills like "Communication" or "Problem Solving" unless explicitly stated
6. For experience: Include all employment entries with dates and descriptions as provided
7. For education: Include all degrees/certifications with full details as stated
8. For duration: Extract dates exactly as found, format as MM/YYYY - MM/YYYY if available
9. Return valid JSON ONLY, no markdown, no extra text`;

      const userPrompt = `Parse this resume and extract ONLY explicitly stated information:\n\n${resumeText}`;

      const completion = await this.getClient().chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.2, // Very low temperature for consistent parsing
        max_tokens: 2000,
      });

      const content = completion.choices[0]?.message?.content;
      if (!content) {
        throw new Error('No response from OpenAI');
      }

      // Parse the JSON response
      const extractedData = this.parseJSONResponse(content);
      return extractedData;
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to parse resume: ${error.message}`);
      }
      throw new Error('Failed to parse resume: Unknown error');
    }
  }

  /**
   * Extract just skills from resume (faster, more focused)
   */
  async extractSkills(resumeText: string): Promise<string[]> {
    if (!resumeText || resumeText.trim().length === 0) {
      throw new Error('Resume text is empty');
    }

    try {
      const systemPrompt = `You are an expert at identifying technical skills from resumes.
Extract a JSON array of technical skills EXPLICITLY MENTIONED in the resume.
Return ONLY a valid JSON array of strings, no other text.
Example: ["Python", "React", "AWS", "PostgreSQL", "Docker"]

RULES:
1. Extract ONLY skills explicitly stated in the resume
2. Do NOT infer or add generic skills
3. Include: Programming languages, frameworks, libraries, tools, platforms, databases, cloud services
4. Do NOT include soft skills unless explicitly technical (e.g., "Agile" is OK, "Communication" is not)
5. Each skill should be specific and technical
6. Return ONLY valid JSON array, no markdown`;

      const userPrompt = `Extract ONLY the technical skills explicitly mentioned in this resume:\n\n${resumeText}`;

      const completion = await this.getClient().chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.1,
        max_tokens: 500,
      });

      const content = completion.choices[0]?.message?.content;
      if (!content) {
        throw new Error('No response from OpenAI');
      }

      const skills = JSON.parse(content);
      if (!Array.isArray(skills)) {
        throw new Error('Invalid response format');
      }

      return skills;
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to extract skills: ${error.message}`);
      }
      throw new Error('Failed to extract skills: Unknown error');
    }
  }

  /**
   * Extract just experience from resume
   */
  async extractExperience(resumeText: string): Promise<Experience[]> {
    if (!resumeText || resumeText.trim().length === 0) {
      throw new Error('Resume text is empty');
    }

    try {
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

      const completion = await this.getClient().chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.1,
        max_tokens: 1500,
      });

      const content = completion.choices[0]?.message?.content;
      if (!content) {
        throw new Error('No response from OpenAI');
      }

      const experience = JSON.parse(content);
      if (!Array.isArray(experience)) {
        throw new Error('Invalid response format');
      }

      return experience;
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to extract experience: ${error.message}`);
      }
      throw new Error('Failed to extract experience: Unknown error');
    }
  }

  /**
   * Parse JSON response from OpenAI, handling potential markdown formatting
   */
  private parseJSONResponse(content: string): ExtractedResumeData {
    try {
      // Remove markdown code blocks if present
      let jsonStr = content.trim();
      if (jsonStr.startsWith('```json')) {
        jsonStr = jsonStr.slice(7); // Remove ```json
      } else if (jsonStr.startsWith('```')) {
        jsonStr = jsonStr.slice(3); // Remove ```
      }
      if (jsonStr.endsWith('```')) {
        jsonStr = jsonStr.slice(0, -3); // Remove closing ```
      }
      jsonStr = jsonStr.trim();

      const parsed = JSON.parse(jsonStr);

      // Validate and normalize the response
      const result: ExtractedResumeData = {
        skills: Array.isArray(parsed.skills) ? parsed.skills : [],
        experience: Array.isArray(parsed.experience) ? parsed.experience : [],
        education: Array.isArray(parsed.education) ? parsed.education : [],
        summary: typeof parsed.summary === 'string' ? parsed.summary : '',
      };

      if (typeof parsed.name === 'string') result.name = parsed.name;
      if (typeof parsed.email === 'string') result.email = parsed.email;
      if (typeof parsed.phoneNumber === 'string') result.phoneNumber = parsed.phoneNumber;
      if (typeof parsed.location === 'string') result.location = parsed.location;

      return result;
    } catch (error) {
      throw new Error(
        `Failed to parse OpenAI response: ${error instanceof Error ? error.message : String(error)}`
      );
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
