import { readFileSync } from 'fs';
import { resolve, join } from 'path';
import { readdirSync } from 'fs';
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
    technologies?: string[] | Record<string, string[]>;
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

interface QAEntry {
  question: string;
  answer: string;
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
   * Load Q&A files from data/resume ingestion/jsons directory
   */
  private loadQAFiles(): Map<string, QAEntry[]> {
    const qaMap = new Map<string, QAEntry[]>();
    
    // Data directory is now in backend/data/
    const qaDir = resolve(__dirname, '../..', 'data', 'resume ingestion', 'jsons');

    try {
      const files = readdirSync(qaDir).filter((f) => f.endsWith('.json'));
      logger.info(`Found ${files.length} Q&A files in ${qaDir}`);

      for (const file of files) {
        try {
          const filePath = join(qaDir, file);
          const content = readFileSync(filePath, 'utf-8');
          const qaEntries = JSON.parse(content) as QAEntry[];

          if (!Array.isArray(qaEntries)) {
            logger.warn(`Skipping ${file}: not an array`);
            continue;
          }

          // Validate Q&A structure
          const validEntries = qaEntries.filter((entry) => {
            if (!entry.question || !entry.answer) {
              logger.warn(`Skipping malformed entry in ${file}`);
              return false;
            }
            return true;
          });

          if (validEntries.length > 0) {
            qaMap.set(file, validEntries);
            logger.info(`Loaded ${validEntries.length} Q&A entries from ${file}`);
          }
        } catch (error) {
          logger.warn(`Failed to load ${file}: ${error}`);
        }
      }
    } catch (error) {
      logger.warn(`Failed to read Q&A directory ${qaDir}: ${error}`);
    }

    return qaMap;
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
   * Map Q&A filename to project ID
   */
  private getProjectIdFromFilename(filename: string): string {
    const nameMap: Record<string, string> = {
      'skillmap.json': 'SkillMap',
      'edutube.json': 'Thapar EduTube',
      'intellidine.json': 'Intellidine',
      'vehicle-parking-app.json': 'Vehicle Parking Management System',
      'experience.json': 'experience',
      'achivements.json': 'achievements',
    };
    return nameMap[filename] || filename.replace('.json', '');
  }

  /**
   * Create Q&A chunks from loaded Q&A files
   */
  private createQAChunks(qaMap: Map<string, QAEntry[]>): ChunkedResume[] {
    const chunks: ChunkedResume[] = [];

    for (const [filename, qaEntries] of qaMap.entries()) {
      const projectId = this.getProjectIdFromFilename(filename);

      qaEntries.forEach((entry, index) => {
        const text = `Q: ${entry.question}\nA: ${entry.answer}`;
        chunks.push({
          id: `qa-${filename.replace('.json', '')}-${index}`,
          text,
          section: 'qa',
          subsection: projectId,
          chunkIndex: index,
          metadata: {
            section: 'qa',
            projectId,
            question: entry.question,
            answer: entry.answer,
          },
        });
      });
    }

    logger.info(`Created ${chunks.length} Q&A chunks`);
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
        // Create a header with job title and context for better searchability
        const jobHeader = `Work Experience: ${job.title} at ${job.company} (${job.duration})`;
        const techsLine = job.technologies ? `Technologies: ${job.technologies.join(', ')}` : '';
        
        // Combine everything with clear structure
        const fullJobText =
          jobHeader +
          '\n' +
          techsLine +
          '\n' +
          job.description +
          '\n' +
          (job.responsibilities ? 'Responsibilities:\n' + job.responsibilities.join('\n') : '');

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
        // Create a header with project name and context for better searchability
        const projectHeader = `Project: ${project.name}`;
        
        // Handle both array and nested object formats for technologies
        let techsLine = '';
        if (project.technologies) {
          if (Array.isArray(project.technologies)) {
            techsLine = `Technologies: ${project.technologies.join(', ')}`;
          } else {
            // Nested object format: flatten all categories
            const allTechs = Object.entries(project.technologies)
              .map(([category, techs]) => `${category}: ${techs.join(', ')}`)
              .join('; ');
            techsLine = `Technologies: ${allTechs}`;
          }
        }
        
        // Combine everything with clear structure
        const fullProjectText =
          projectHeader +
          '\n' +
          techsLine +
          '\n' +
          project.description +
          '\n' +
          (project.highlights ? 'Highlights:\n' + project.highlights.join('\n') : '');

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
   * Main ingest method - delete old data, chunk, embed, and upsert to Qdrant
   */
  async ingest(): Promise<{ totalChunks: number; totalVectors: number; resumeChunks: number; qaChunks: number }> {
    const startTime = Date.now();
    try {
      logger.info('Starting resume ingestion...');

      // Step 1: Delete old resume embeddings
      logger.info('Deleting old resume embeddings...');
      const qdrant = getQdrant();
      const deletedCount = await qdrant.deleteBySource(['resume', 'resume_qa', 'resume_structured']);
      logger.info(`Deleted ${deletedCount} old vectors`);

      // Step 2: Load Q&A files
      const qaMap = this.loadQAFiles();
      const qaChunks = this.createQAChunks(qaMap);

      // Step 3: Create resume chunks
      const resumeChunks = await this.createChunks();
      if (resumeChunks.length === 0) {
        throw new Error('No chunks created from resume');
      }
      logger.info(`Created ${resumeChunks.length} resume chunks and ${qaChunks.length} Q&A chunks`);

      // Step 4: Merge all chunks
      const allChunks = [...resumeChunks, ...qaChunks];
      logger.info(`Total chunks to embed: ${allChunks.length}`);

      // Step 5: Batch embed all chunks
      logger.info('Starting batch embedding...');
      const embedder = getEmbedder();
      const embeddedChunks: Array<ChunkedResume & { vector: number[] }> = [];
      const BATCH_SIZE = 100;

      for (let i = 0; i < allChunks.length; i += BATCH_SIZE) {
        const batch = allChunks.slice(i, i + BATCH_SIZE);
        const texts = batch.map((c) => c.text);

        try {
          const vectors = await embedder.embedBatch(texts);
          
          batch.forEach((chunk, idx) => {
            embeddedChunks.push({ ...chunk, vector: vectors[idx] });
          });

          logger.info(`Embedded ${Math.min(i + BATCH_SIZE, allChunks.length)}/${allChunks.length} chunks`);
        } catch (error) {
          logger.error(`Failed to embed batch starting at index ${i}: ${error}`);
          throw error;
        }
      }

      logger.info(`Successfully embedded ${embeddedChunks.length} chunks`);

      // Step 6: Upsert to Qdrant
      logger.info('Upserting to Qdrant...');
      const points: VectorPoint[] = embeddedChunks.map((chunk) => ({
        id: chunk.id,
        vector: chunk.vector,
        payload: {
          text: chunk.text,
          section: chunk.section,
          subsection: chunk.subsection || null,
          chunkIndex: chunk.chunkIndex,
          source: chunk.section === 'qa' ? 'resume_qa' : 'resume_structured',
          projectId: chunk.section === 'qa' ? chunk.metadata?.projectId || 'resume' : 'resume',
          projectName: 'Resume - Aahil Khan',
          metadata: chunk.metadata,
        },
      }));

      await qdrant.upsert(points);
      
      const duration = ((Date.now() - startTime) / 1000).toFixed(2);
      logger.info(`Successfully upserted ${points.length} vectors to Qdrant in ${duration}s`);

      return {
        totalChunks: allChunks.length,
        totalVectors: points.length,
        resumeChunks: resumeChunks.length,
        qaChunks: qaChunks.length,
      };
    } catch (error) {
      const duration = ((Date.now() - startTime) / 1000).toFixed(2);
      logger.error(`Resume ingestion failed after ${duration}s: ${error}`);
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
