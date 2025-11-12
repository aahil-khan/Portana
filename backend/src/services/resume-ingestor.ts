import { readFileSync } from 'fs';
import { resolve } from 'path';
import { getEmbedder } from './embedder.js';
import { getQdrant } from '../vector/index.js';
import type { VectorPoint } from '../vector/index.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('ResumeIngestor');

export interface ChunkedResume {
  id: string;
  text: string;
  section: string;
  subsection?: string;
  chunkIndex: number;
  metadata?: Record<string, unknown>;
}

interface ResumeJSON {
  personal: {
    name: string;
    email: string;
    phone?: string;
    location?: string;
  };
  summary: string;
  education?: Array<{
    institution: string;
    degree: string;
    cgpa?: string;
    grade?: string;
  }>;
  experience?: Array<{
    title: string;
    company: string;
    location?: string;
    duration: string;
    technologies?: string[];
    description: string;
    responsibilities?: string[];
  }>;
  projects?: Array<{
    name: string;
    technologies?: string[];
    description: string;
    highlights?: string[];
    link?: string;
  }>;
  skills?: Record<string, string[]>;
  achievements?: Array<{
    title: string;
    event?: string;
    organization?: string;
  }>;
}

const CHUNK_SIZE = 500; // Characters per chunk
const CHUNK_OVERLAP = 50; // Overlap between chunks

/**
 * Ingest resume from JSON file into Qdrant
 * Chunks resume by sections: Summary, Skills, Experience, Projects, Education
 */
export class ResumeIngestor {
  private resume: ResumeJSON | null = null;

  constructor() {
    this.loadResume();
  }

  /**
   * Load resume from JSON file
   */
  private loadResume(): void {
    try {
      const resumePath = resolve(process.cwd(), 'resume.json');
      const content = readFileSync(resumePath, 'utf-8');
      this.resume = JSON.parse(content);
      logger.info(`Loaded resume from ${resumePath}`);
    } catch (error) {
      logger.error(`Failed to load resume: ${error}`);
      throw error;
    }
  }

  /**
   * Split text into overlapping chunks
   */
  private chunkText(text: string): string[] {
    if (!text || text.length === 0) return [];

    const chunks: string[] = [];
    const lines = text.split('\n');
    let currentChunk = '';

    for (const line of lines) {
      if ((currentChunk + line).length > CHUNK_SIZE && currentChunk.length > 0) {
        chunks.push(currentChunk.trim());
        // Add overlap for context
        currentChunk = currentChunk.slice(-CHUNK_OVERLAP) + '\n' + line;
      } else {
        currentChunk += (currentChunk ? '\n' : '') + line;
      }
    }

    if (currentChunk.trim()) {
      chunks.push(currentChunk.trim());
    }

    return chunks;
  }

  /**
   * Create chunked content objects from resume JSON
   */
  private async createChunks(): Promise<ChunkedResume[]> {
    if (!this.resume) throw new Error('Resume not loaded');

    const chunks: ChunkedResume[] = [];
    let globalChunkIndex = 0;

    // SUMMARY
    if (this.resume.summary) {
      const summaryChunks = this.chunkText(this.resume.summary);
      summaryChunks.forEach((text, idx) => {
        chunks.push({
          id: `resume-summary-${idx}`,
          text,
          section: 'summary',
          chunkIndex: idx,
          metadata: { section: 'summary' },
        });
        globalChunkIndex++;
      });
    }

    // EDUCATION
    if (this.resume.education && this.resume.education.length > 0) {
      this.resume.education.forEach((edu, eduIdx) => {
        const eduText = `${edu.institution} - ${edu.degree}${edu.cgpa ? ` (CGPA: ${edu.cgpa})` : ''}${edu.grade ? ` (Grade: ${edu.grade})` : ''}`;
        chunks.push({
          id: `resume-education-${eduIdx}`,
          text: eduText,
          section: 'education',
          subsection: edu.institution,
          chunkIndex: 0,
          metadata: {
            section: 'education',
            institution: edu.institution,
            degree: edu.degree,
          },
        });
        globalChunkIndex++;
      });
    }

    // EXPERIENCE
    if (this.resume.experience && this.resume.experience.length > 0) {
      this.resume.experience.forEach((job, jobIdx) => {
        // Combine description + responsibilities
        const fullJobText =
          job.description +
          '\n' +
          (job.responsibilities ? job.responsibilities.join('\n') : '');

        const jobChunks = this.chunkText(fullJobText);
        jobChunks.forEach((text, chunkIdx) => {
          chunks.push({
            id: `resume-experience-${jobIdx}-${chunkIdx}`,
            text,
            section: 'experience',
            subsection: `${job.title} at ${job.company}`,
            chunkIndex: chunkIdx,
            metadata: {
              section: 'experience',
              title: job.title,
              company: job.company,
              location: job.location,
              duration: job.duration,
              technologies: job.technologies,
            },
          });
          globalChunkIndex++;
        });
      });
    }

    // PROJECTS
    if (this.resume.projects && this.resume.projects.length > 0) {
      this.resume.projects.forEach((project, projIdx) => {
        // Combine description + highlights
        const fullProjectText =
          project.description +
          '\n' +
          (project.highlights ? project.highlights.join('\n') : '');

        const projChunks = this.chunkText(fullProjectText);
        projChunks.forEach((text, chunkIdx) => {
          chunks.push({
            id: `resume-projects-${projIdx}-${chunkIdx}`,
            text,
            section: 'projects',
            subsection: project.name,
            chunkIndex: chunkIdx,
            metadata: {
              section: 'projects',
              name: project.name,
              technologies: project.technologies,
              link: project.link,
            },
          });
          globalChunkIndex++;
        });
      });
    }

    // SKILLS
    if (this.resume.skills) {
      let skillIdx = 0;
      for (const [category, skills] of Object.entries(this.resume.skills)) {
        const skillsText = `${category}: ${Array.isArray(skills) ? skills.join(', ') : skills}`;
        chunks.push({
          id: `resume-skills-${skillIdx}`,
          text: skillsText,
          section: 'skills',
          subsection: category,
          chunkIndex: 0,
          metadata: {
            section: 'skills',
            category,
            skills,
          },
        });
        globalChunkIndex++;
        skillIdx++;
      }
    }

    // ACHIEVEMENTS
    if (this.resume.achievements && this.resume.achievements.length > 0) {
      this.resume.achievements.forEach((achievement, achIdx) => {
        const achText = `${achievement.title} - ${achievement.event}${achievement.organization ? ` by ${achievement.organization}` : ''}`;
        chunks.push({
          id: `resume-achievements-${achIdx}`,
          text: achText,
          section: 'achievements',
          subsection: achievement.title,
          chunkIndex: 0,
          metadata: {
            section: 'achievements',
            title: achievement.title,
            event: achievement.event,
            organization: achievement.organization,
          },
        });
        globalChunkIndex++;
      });
    }

    logger.info(`Created ${chunks.length} chunks from resume`);
    return chunks;
  }

  /**
   * Main ingest method - chunk, embed, and upsert to Qdrant
   */
  async ingest(): Promise<{ totalChunks: number; totalVectors: number }> {
    try {
      logger.info('Starting resume ingestion...');

      // Create chunks
      const chunks = await this.createChunks();
      if (chunks.length === 0) {
        throw new Error('No chunks created from resume');
      }

      // Embed chunks
      logger.info(`Embedding ${chunks.length} chunks...`);
      const embedder = getEmbedder();
      const embeddedChunks: Array<ChunkedResume & { vector: number[] }> = [];

      for (const chunk of chunks) {
        try {
          const vector = await embedder.embedText(chunk.text);
          embeddedChunks.push({ ...chunk, vector });
        } catch (error) {
          logger.error(`Failed to embed chunk ${chunk.id}: ${error}`);
          throw error;
        }
      }

      logger.info(`Successfully embedded ${embeddedChunks.length} chunks`);

      // Upsert to Qdrant
      logger.info('Upserting to Qdrant...');
      const qdrant = getQdrant();
      const points: VectorPoint[] = embeddedChunks.map((chunk) => ({
        id: chunk.id,
        vector: chunk.vector,
        payload: {
          text: chunk.text,
          section: chunk.section,
          subsection: chunk.subsection || null,
          chunkIndex: chunk.chunkIndex,
          source: 'resume',
          projectId: 'resume',
          projectName: 'Resume - Aahil Khan',
          metadata: chunk.metadata,
        },
      }));

      await qdrant.upsert(points);
      logger.info(`Successfully upserted ${points.length} vectors to Qdrant`);

      return {
        totalChunks: chunks.length,
        totalVectors: points.length,
      };
    } catch (error) {
      logger.error(`Resume ingestion failed: ${error}`);
      throw error;
    }
  }
}

let resumeIngestorInstance: ResumeIngestor | null = null;

export function getResumeIngestor(): ResumeIngestor {
  if (!resumeIngestorInstance) {
    resumeIngestorInstance = new ResumeIngestor();
  }
  return resumeIngestorInstance;
}
