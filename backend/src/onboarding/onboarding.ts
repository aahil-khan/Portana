import { z } from 'zod';
import { getEmbedder, type ProfileStructure } from '../services/embedder.js';
import { getDeduplicator } from '../services/deduplicator.js';
import { getVectorDeduplicator } from '../services/vector-deduplicator.js';
import { getResumeParser, type SkillEntry } from '../services/resume-parser.js';

// Zod schemas for each step
export const Step1Schema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  email: z.string().email('Invalid email'),
  bio: z.string().max(500, 'Bio too long').optional(),
  website: z.string().url('Invalid URL').optional().or(z.literal('')),
  githubUrl: z.string().url('Invalid GitHub URL').optional().or(z.literal('')),
  linkedinUrl: z.string().url('Invalid LinkedIn URL').optional().or(z.literal('')),
});

export const Step2Schema = z.object({
  resumeText: z.string().min(100, 'Resume too short'),
});

export const Step2ResumeParseSchema = z.object({
  resumeText: z.string().min(100, 'Resume too short'),
});

export type Step2ParseResult = {
  skills: SkillEntry[];
  experience: Array<{
    title: string;
    company: string;
    duration?: string;
    description?: string;
  }>;
  education: Array<{
    degree: string;
    institution: string;
    field?: string;
  }>;
};

export const Step3Schema = z.object({
  githubUsername: z.string().optional(),
  mediumUsername: z.string().optional(),
  githubRepos: z.array(z.string()).default([]),
  mediumArticles: z.array(z.string()).default([]),
});

export const Step4Schema = z.object({
  personaName: z.string().min(1, 'Persona name required'),
  personaDescription: z.string().min(50, 'Describe the persona'),
  tonality: z.enum(['professional', 'casual', 'technical', 'creative']),
  responseLength: z.enum(['brief', 'medium', 'detailed']),
});

export const Step5Schema = z.object({
  deploymentPlatform: z.enum(['vercel', 'netlify', 'aws', 'self-hosted']),
  apiKey: z.string().min(10, 'API key too short').optional(),
  webhookUrl: z.string().url('Invalid webhook URL').optional(),
  allowWebhooks: z.boolean().default(true),
});

export type Step1Data = z.infer<typeof Step1Schema>;
export type Step2Data = z.infer<typeof Step2Schema>;
export type Step3Data = z.infer<typeof Step3Schema>;
export type Step4Data = z.infer<typeof Step4Schema>;
export type Step5Data = z.infer<typeof Step5Schema>;

export interface Step2DataParsed extends Step2Data {
  skills?: SkillEntry[];
  experience?: Array<{
    title: string;
    company: string;
    duration?: string;
    description?: string;
  }>;
  education?: Array<{
    degree: string;
    institution: string;
    field?: string;
  }>;
}

export interface OnboardingSession {
  id: string;
  step1?: Step1Data;
  step2?: Step2DataParsed;
  step3?: Step3Data;
  step4?: Step4Data;
  step5?: Step5Data;
  createdAt: number;
  completedAt?: number;
}

export class OnboardingService {
  private sessions = new Map<string, OnboardingSession>();

  createSession(sessionId: string): OnboardingSession {
    const session: OnboardingSession = {
      id: sessionId,
      createdAt: Date.now(),
    };
    this.sessions.set(sessionId, session);
    return session;
  }

  getSession(sessionId: string): OnboardingSession | null {
    return this.sessions.get(sessionId) || null;
  }

  async step1(sessionId: string, data: Step1Data): Promise<{ success: boolean; error?: string }> {
    try {
      const session = this.getSession(sessionId);
      if (!session) {
        return { success: false, error: 'Session not found' };
      }

      const parsed = Step1Schema.safeParse(data);
      if (!parsed.success) {
        return { success: false, error: 'Invalid profile data' };
      }

      session.step1 = parsed.data;
      this.sessions.set(sessionId, session);

      // Check for duplicate profiles
      const dedup = getDeduplicator();
      const result = dedup.checkDuplicate(data.email, 'profile');
      if (result.isDuplicate) {
        return { success: false, error: 'Profile already exists' };
      }

      dedup.addContent(sessionId, data.email, 'profile', 'email');

      return { success: true };
    } catch (error) {
      return { success: false, error: 'Step 1 failed' };
    }
  }

  async step2(sessionId: string, data: Step2Data): Promise<{ success: boolean; error?: string; parsed?: Step2DataParsed }> {
    try {
      const session = this.getSession(sessionId);
      if (!session || !session.step1) {
        return { success: false, error: 'Complete step 1 first' };
      }

      const validated = Step2Schema.safeParse(data);
      if (!validated.success) {
        return { success: false, error: 'Invalid resume data' };
      }

      let parsedData: Step2DataParsed = validated.data;

      // Auto-parse resume using GPT-4 to extract skills and experience
      try {
        const parser = getResumeParser();
        const extractedData = await parser.parseResume(data.resumeText);

        parsedData = {
          ...validated.data,
          skills: extractedData.skills,
          experience: extractedData.experience,
          education: extractedData.education,
        };

        console.log(`[Resume Parser] Extracted ${extractedData.skills.length} skills for session ${sessionId}`);
      } catch (error) {
        // Gracefully handle parsing errors - continue without extraction
        console.warn(`[Resume Parser] Failed to parse resume for session ${sessionId}:`, error);
        // Still proceed with the raw resume text
      }

      // Embed resume with 3-tier approach + deduplication
      try {
        const embedder = getEmbedder();
        const vectorDedup = getVectorDeduplicator();

        // Check if this resume content was already embedded
        const isDuplicate = await vectorDedup.isDuplicate(sessionId, data.resumeText);

        if (!isDuplicate) {
          // Build profile structure for 3-tier embeddings
          const profile: ProfileStructure = {
            skills: parsedData.skills || [],
            experience: parsedData.experience?.map((e) => ({
              title: e.title,
              company: e.company,
              duration: e.duration,
            })) || [],
            education: parsedData.education?.map((e) => ({
              degree: e.degree,
              institution: e.institution,
            })) || [],
          };

          // Embed using 3-tier approach
          const vectorCount = await embedder.embedProfile3Tier(
            sessionId,
            profile,
            data.resumeText
          );

          // Register in dedup tracker
          const vectorIds = [
            ...profile.skills.map((s) => `${sessionId}-skill-${s.name.toLowerCase().replace(/\s+/g, '-')}`),
            ...profile.experience.map((_, i) => `${sessionId}-experience-${i}`),
            ...this.chunkText(data.resumeText, 500).map((_, i) => `${sessionId}-resume-chunk-${i}`),
          ];

          vectorDedup.registerEmbedded(sessionId, data.resumeText, vectorIds);

          console.log(
            `[Onboarding Step 2] Successfully embedded resume (${vectorCount} vectors, dedup registered)`
          );
        } else {
          console.log(
            `[Onboarding Step 2] Resume already embedded for ${sessionId}, skipping duplicate embedding`
          );
        }
      } catch (error) {
        // Gracefully handle embedding errors
        console.warn(`[Onboarding Step 2] Embedding service unavailable:`, error);
      }

      session.step2 = parsedData;
      this.sessions.set(sessionId, session);

      return { success: true, parsed: parsedData };
    } catch (error) {
      return { success: false, error: 'Step 2 failed' };
    }
  }

  async step3(sessionId: string, data: Step3Data): Promise<{ success: boolean; error?: string }> {
    try {
      const session = this.getSession(sessionId);
      if (!session || !session.step1) {
        return { success: false, error: 'Complete earlier steps first' };
      }

      const parsed = Step3Schema.safeParse(data);
      if (!parsed.success) {
        return { success: false, error: 'Invalid source data' };
      }

      // Store GitHub/Medium sources (validation only for MVP)
      // In production, this would sync with GitHub/Medium APIs
      session.step3 = parsed.data;
      this.sessions.set(sessionId, session);

      return { success: true };
    } catch (error) {
      return { success: false, error: 'Step 3 failed' };
    }
  }

  async step4(sessionId: string, data: Step4Data): Promise<{ success: boolean; error?: string }> {
    try {
      const session = this.getSession(sessionId);
      if (!session || !session.step1) {
        return { success: false, error: 'Complete earlier steps first' };
      }

      const parsed = Step4Schema.safeParse(data);
      if (!parsed.success) {
        return { success: false, error: 'Invalid persona data' };
      }

      session.step4 = parsed.data;
      this.sessions.set(sessionId, session);

      return { success: true };
    } catch (error) {
      return { success: false, error: 'Step 4 failed' };
    }
  }

  async step5(sessionId: string, data: Step5Data): Promise<{ success: boolean; error?: string }> {
    try {
      const session = this.getSession(sessionId);
      if (!session || !session.step1) {
        return { success: false, error: 'Complete earlier steps first' };
      }

      const parsed = Step5Schema.safeParse(data);
      if (!parsed.success) {
        return { success: false, error: 'Invalid deployment data' };
      }

      session.step5 = parsed.data;
      session.completedAt = Date.now();
      this.sessions.set(sessionId, session);

      return { success: true };
    } catch (error) {
      return { success: false, error: 'Step 5 failed' };
    }
  }

  isComplete(sessionId: string): boolean {
    const session = this.getSession(sessionId);
    if (!session) return false;

    return !!(
      session.step1 &&
      session.step2 &&
      session.step3 &&
      session.step4 &&
      session.step5 &&
      session.completedAt
    );
  }

  getProgress(sessionId: string): number {
    const session = this.getSession(sessionId);
    if (!session) return 0;

    let steps = 0;
    if (session.step1) steps++;
    if (session.step2) steps++;
    if (session.step3) steps++;
    if (session.step4) steps++;
    if (session.step5) steps++;

    return Math.round((steps / 5) * 100);
  }

  updateSession(sessionId: string, session: OnboardingSession): void {
    this.sessions.set(sessionId, session);
  }

  deleteSession(sessionId: string): void {
    this.sessions.delete(sessionId);
  }

  private chunkText(text: string, chunkSize: number): string[] {
    const chunks: string[] = [];
    for (let i = 0; i < text.length; i += chunkSize) {
      chunks.push(text.substring(i, i + chunkSize));
    }
    return chunks;
  }
}

let onboardingInstance: OnboardingService | null = null;

export function getOnboarding(): OnboardingService {
  if (!onboardingInstance) {
    onboardingInstance = new OnboardingService();
  }
  return onboardingInstance;
}
