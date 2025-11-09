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
      const systemPrompt = `You are an expert resume parser. Extract structured information from the provided resume text.
Return a JSON object with the following structure:
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
      "degree": "Bachelor's",
      "institution": "University Name",
      "field": "Computer Science",
      "graduationYear": 2020
    }
  ],
  "summary": "Brief professional summary extracted from resume",
  "name": "Full Name if found",
  "email": "Email if found",
  "phoneNumber": "Phone number if found",
  "location": "Location if found"
}

IMPORTANT RULES:
- Extract ONLY information explicitly stated in the resume
- For skills, extract technical skills, programming languages, frameworks, and tools
- For experience, include all jobs/roles mentioned
- For education, include all degrees/certifications
- If any field is not found, omit it or use empty arrays
- Make sure skills are specific and actionable (e.g., "React", "Node.js", "TypeScript" not just "Programming")
- Keep descriptions concise (1-2 sentences max)
- Return valid JSON only, no markdown formatting`;

      const userPrompt = `Parse this resume and extract the structured data:\n\n${resumeText}`;

      const completion = await this.getClient().chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.3, // Low temperature for consistent parsing
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
Extract a JSON array of technical skills mentioned in the resume.
Return ONLY a valid JSON array of strings, no other text.
Example: ["Python", "React", "AWS", "PostgreSQL", "Docker"]

Focus on:
- Programming languages
- Frameworks and libraries
- Tools and platforms
- Databases
- Cloud services
- Methodologies`;

      const userPrompt = `Extract all technical skills from this resume:\n\n${resumeText}`;

      const completion = await this.getClient().chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.2,
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
Extract a JSON array of work experience from the resume.
Return ONLY a valid JSON array with objects like this:
[
  {
    "title": "Job Title",
    "company": "Company Name",
    "duration": "01/2020 - 12/2022",
    "description": "Brief description of responsibilities and achievements",
    "startYear": 2020,
    "endYear": 2022
  }
]

If end year is "Present" or "Current", estimate based on context or use current year.
Order by most recent first.`;

      const userPrompt = `Extract all work experience from this resume:\n\n${resumeText}`;

      const completion = await this.getClient().chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.2,
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
