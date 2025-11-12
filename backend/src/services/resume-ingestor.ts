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

const CHUNK_SIZE = 500; // Characters per chunk
const CHUNK_OVERLAP = 50; // Overlap between chunks

/**
 * Ingest resume from markdown file into Qdrant
 * Chunks resume by sections: Summary, Skills, Experience, Projects, Education
 */
export class ResumeIngestor {
  private resumeContent: string = '';

  constructor() {
    this.loadResume();
  }

  /**
   * Load resume from file
   */
  private loadResume(): void {
    try {
      const resumePath = resolve(process.cwd(), 'resume.md');
      this.resumeContent = readFileSync(resumePath, 'utf-8');
      logger.info(`Loaded resume from ${resumePath} (${this.resumeContent.length} chars)`);
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
   * Extract sections from resume
   */
  private extractSections(): Record<string, string> {
    const sections: Record<string, string> = {};

    // Extract SUMMARY
    const summaryMatch = this.resumeContent.match(/SUMMARY\n([\s\S]*?)(?=EDUCATION|$)/);
    if (summaryMatch) {
      sections['summary'] = summaryMatch[1].trim();
    }

    // Extract EDUCATION
    const educationMatch = this.resumeContent.match(/EDUCATION\n([\s\S]*?)(?=PROFESSIONAL EXPERIENCE|$)/);
    if (educationMatch) {
      sections['education'] = educationMatch[1].trim();
    }

    // Extract PROFESSIONAL EXPERIENCE
    const experienceMatch = this.resumeContent.match(/PROFESSIONAL EXPERIENCE\n([\s\S]*?)(?=PROJECTS|$)/);
    if (experienceMatch) {
      sections['experience'] = experienceMatch[1].trim();
    }

    // Extract PROJECTS
    const projectsMatch = this.resumeContent.match(/PROJECTS\n([\s\S]*?)(?=ACHIEVEMENTS|SKILLS|$)/);
    if (projectsMatch) {
      sections['projects'] = projectsMatch[1].trim();
    }

    // Extract SKILLS
    const skillsMatch = this.resumeContent.match(/SKILLS\n([\s\S]*?)(?=ACHIEVEMENTS|OTHER|$)/);
    if (skillsMatch) {
      sections['skills'] = skillsMatch[1].trim();
    }

    // Extract ACHIEVEMENTS
    const achievementsMatch = this.resumeContent.match(/ACHIEVEMENTS\n([\s\S]*?)(?=SKILLS|$)/);
    if (achievementsMatch) {
      sections['achievements'] = achievementsMatch[1].trim();
    }

    return sections;
  }

  /**
   * Extract individual jobs from experience section
   */
  private parseExperience(experienceText: string): Array<{ title: string; content: string }> {
    const jobs: Array<{ title: string; content: string }> = [];
    
    // Split by role titles (lines ending with dash followed by location/company info)
    const jobRegex = /^([A-Za-z\s/]+)\s*-\s*(.+)$/gm;
    let match;
    const matches: Array<{ title: string; start: number }> = [];

    while ((match = jobRegex.exec(experienceText)) !== null) {
      matches.push({ title: match[1] + ' - ' + match[2], start: match.index });
    }

    for (let i = 0; i < matches.length; i++) {
      const currentMatch = matches[i];
      const nextMatch = matches[i + 1];
      const end = nextMatch ? nextMatch.start : experienceText.length;
      const content = experienceText.substring(currentMatch.start, end).trim();

      jobs.push({
        title: currentMatch.title,
        content: content,
      });
    }

    return jobs;
  }

  /**
   * Extract individual projects from projects section
   */
  private parseProjects(projectsText: string): Array<{ title: string; content: string }> {
    const projects: Array<{ title: string; content: string }> = [];
    
    // Split by project titles (all caps words followed by dash and description)
    const projectRegex = /^([A-Za-z\s\-]+?)\s*-\s*\(Technologies:[^)]*\)/gm;
    let match;
    const matches: Array<{ title: string; start: number }> = [];

    while ((match = projectRegex.exec(projectsText)) !== null) {
      matches.push({ title: match[1].trim(), start: match.index });
    }

    for (let i = 0; i < matches.length; i++) {
      const currentMatch = matches[i];
      const nextMatch = matches[i + 1];
      const end = nextMatch ? nextMatch.start : projectsText.length;
      const content = projectsText.substring(currentMatch.start, end).trim();

      projects.push({
        title: currentMatch.title,
        content: content,
      });
    }

    return projects;
  }

  /**
   * Create chunked content objects from resume sections
   */
  private async createChunks(): Promise<ChunkedResume[]> {
    const sections = this.extractSections();
    const chunks: ChunkedResume[] = [];
    let globalChunkIndex = 0;

    // Process SUMMARY
    if (sections['summary']) {
      const summaryChunks = this.chunkText(sections['summary']);
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

    // Process EDUCATION (as single section or could break into entries)
    if (sections['education']) {
      const eduChunks = this.chunkText(sections['education']);
      eduChunks.forEach((text, idx) => {
        chunks.push({
          id: `resume-education-${idx}`,
          text,
          section: 'education',
          chunkIndex: idx,
          metadata: { section: 'education' },
        });
        globalChunkIndex++;
      });
    }

    // Process EXPERIENCE (by job)
    if (sections['experience']) {
      const jobs = this.parseExperience(sections['experience']);
      jobs.forEach((job, jobIdx) => {
        const jobChunks = this.chunkText(job.content);
        jobChunks.forEach((text, chunkIdx) => {
          chunks.push({
            id: `resume-experience-${jobIdx}-${chunkIdx}`,
            text,
            section: 'experience',
            subsection: job.title,
            chunkIndex: chunkIdx,
            metadata: {
              section: 'experience',
              job: job.title,
              jobIndex: jobIdx,
            },
          });
          globalChunkIndex++;
        });
      });
    }

    // Process PROJECTS (by project)
    if (sections['projects']) {
      const projects = this.parseProjects(sections['projects']);
      projects.forEach((project, projIdx) => {
        const projChunks = this.chunkText(project.content);
        projChunks.forEach((text, chunkIdx) => {
          chunks.push({
            id: `resume-projects-${projIdx}-${chunkIdx}`,
            text,
            section: 'projects',
            subsection: project.title,
            chunkIndex: chunkIdx,
            metadata: {
              section: 'projects',
              project: project.title,
              projectIndex: projIdx,
            },
          });
          globalChunkIndex++;
        });
      });
    }

    // Process SKILLS
    if (sections['skills']) {
      const skillChunks = this.chunkText(sections['skills']);
      skillChunks.forEach((text, idx) => {
        chunks.push({
          id: `resume-skills-${idx}`,
          text,
          section: 'skills',
          chunkIndex: idx,
          metadata: { section: 'skills' },
        });
        globalChunkIndex++;
      });
    }

    // Process ACHIEVEMENTS
    if (sections['achievements']) {
      const achievementChunks = this.chunkText(sections['achievements']);
      achievementChunks.forEach((text, idx) => {
        chunks.push({
          id: `resume-achievements-${idx}`,
          text,
          section: 'achievements',
          chunkIndex: idx,
          metadata: { section: 'achievements' },
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
