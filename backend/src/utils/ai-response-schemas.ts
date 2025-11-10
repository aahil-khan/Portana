/**
 * AI Response Validation & Parsing Utilities
 * Handles schema validation, JSON extraction, and defensive parsing
 */

/**
 * Resume analysis schema for validation
 */
export const RESUME_ANALYSIS_SCHEMA = {
  type: 'object',
  properties: {
    skills: { type: 'array', items: { type: 'string' } },
    experience: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          company: { type: 'string' },
          duration: { type: 'string' },
          description: { type: 'string' },
          startYear: { type: 'number' },
          endYear: { type: 'number' },
        },
        required: ['title', 'company'],
      },
    },
    education: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          degree: { type: 'string' },
          institution: { type: 'string' },
          field: { type: 'string' },
          graduationYear: { type: 'number' },
        },
        required: ['degree', 'institution'],
      },
    },
    summary: { type: 'string' },
    name: { type: 'string' },
    email: { type: 'string' },
    phoneNumber: { type: 'string' },
    location: { type: 'string' },
  },
};

/**
 * Safely extract content from OpenAI response
 */
export function extractOpenAIContent(response: any): string {
  if (typeof response === 'string') {
    return response;
  }

  if (response?.choices?.[0]?.message?.content) {
    return response.choices[0].message.content;
  }

  throw new Error('Invalid OpenAI response structure');
}

/**
 * Extract JSON from text, handling markdown code blocks and other formatting
 */
export function extractJSON(text: string): Record<string, any> {
  try {
    // Try direct JSON parsing first
    return JSON.parse(text);
  } catch {
    // Handle markdown code blocks
    let jsonStr = text.trim();

    // Remove markdown code blocks
    if (jsonStr.startsWith('```json')) {
      jsonStr = jsonStr.slice(7);
    } else if (jsonStr.startsWith('```')) {
      jsonStr = jsonStr.slice(3);
    }

    if (jsonStr.endsWith('```')) {
      jsonStr = jsonStr.slice(0, -3);
    }

    jsonStr = jsonStr.trim();

    // Try parsing again
    try {
      return JSON.parse(jsonStr);
    } catch {
      // Try to find JSON object in the text
      const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          return JSON.parse(jsonMatch[0]);
        } catch {
          // Last resort: try to fix common JSON issues
          let fixed = jsonMatch[0];
          fixed = fixed.replace(/,\s*}/g, '}'); // Remove trailing commas
          fixed = fixed.replace(/,\s*]/g, ']');
          try {
            return JSON.parse(fixed);
          } catch {
            throw new Error('Could not parse JSON from response');
          }
        }
      }

      throw new Error('No JSON object found in response');
    }
  }
}

/**
 * Validate AI response against schema
 */
export function validateAIResponse(
  data: any,
  _schema: Record<string, any>,
  context: string
): Record<string, any> {
  if (!data || typeof data !== 'object') {
    throw new Error(`Invalid ${context}: response is not an object`);
  }

  const validated: Record<string, any> = {};

  // Validate and normalize skills
  if (Array.isArray(data.skills)) {
    validated.skills = data.skills
      .filter((skill: any) => typeof skill === 'string' && skill.trim().length > 0)
      .map((skill: string) => skill.trim());
  } else {
    validated.skills = [];
  }

  // Validate and normalize experience
  if (Array.isArray(data.experience)) {
    validated.experience = data.experience
      .filter((exp: any) => exp && typeof exp === 'object')
      .map((exp: any) => ({
        title: String(exp.title || exp.role || 'Position').trim(),
        company: String(exp.company || 'Company').trim(),
        duration: String(exp.duration || '').trim(),
        description: exp.description ? String(exp.description).trim() : undefined,
        startYear: exp.startYear ? Number(exp.startYear) : undefined,
        endYear: exp.endYear ? Number(exp.endYear) : undefined,
      }));
  } else {
    validated.experience = [];
  }

  // Validate and normalize education
  if (Array.isArray(data.education)) {
    validated.education = data.education
      .filter((edu: any) => edu && typeof edu === 'object')
      .map((edu: any) => ({
        degree: String(edu.degree || 'Degree').trim(),
        institution: String(edu.institution || edu.school || 'Institution').trim(),
        field: edu.field ? String(edu.field).trim() : undefined,
        graduationYear: edu.graduationYear ? Number(edu.graduationYear) : undefined,
      }));
  } else {
    validated.education = [];
  }

  // Optional fields
  if (data.summary && typeof data.summary === 'string') {
    validated.summary = data.summary.trim();
  }
  if (data.name && typeof data.name === 'string') {
    validated.name = data.name.trim();
  }
  if (data.email && typeof data.email === 'string') {
    validated.email = data.email.trim();
  }
  if (data.phoneNumber && typeof data.phoneNumber === 'string') {
    validated.phoneNumber = data.phoneNumber.trim();
  }
  if (data.location && typeof data.location === 'string') {
    validated.location = data.location.trim();
  }

  return validated;
}

/**
 * Log detailed response for debugging
 */
export function logAIResponse(
  response: string,
  context: string,
  logger?: { debug: (msg: string, data?: any) => void }
): void {
  if (!logger) return;

  logger.debug(`${context} - Response received`, {
    length: response.length,
    preview: response.substring(0, 500),
  });
}

/**
 * Safe JSON stringify for logging (handles circular refs)
 */
export function safeStringify(obj: any): string {
  try {
    return JSON.stringify(obj, null, 2).substring(0, 1000);
  } catch {
    return String(obj).substring(0, 1000);
  }
}
