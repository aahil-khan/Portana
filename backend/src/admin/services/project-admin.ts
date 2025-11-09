import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';

/**
 * Project Admin Service
 * Manages portfolio projects with CRUD operations
 */

export const ProjectSchema = z.object({
  id: z.string().optional(),
  title: z.string().min(3).max(200),
  description: z.string().min(10).max(1000),
  content: z.string().optional(),
  source: z.enum(['manual', 'github', 'medium', 'resume']).default('manual'),
  source_id: z.string().optional().nullable(),
  source_url: z.string().url().optional().nullable(),
  featured: z.boolean().default(false),
  status: z.enum(['draft', 'published', 'archived']).default('published'),
  metadata: z.record(z.any()).optional(),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
  created_by: z.string().optional(),
  updated_by: z.string().optional(),
});

export type Project = z.infer<typeof ProjectSchema>;
export type CreateProjectInput = Omit<
  Project,
  'id' | 'created_at' | 'updated_at'
>;
export type UpdateProjectInput = Partial<CreateProjectInput>;

interface ProjectStore {
  [id: string]: Project;
}

class ProjectAdminService {
  private store: ProjectStore = {};

  /**
   * Create a new project
   */
  createProject(data: Partial<CreateProjectInput>): Project {
    const withDefaults: CreateProjectInput = {
      title: data.title || '',
      description: data.description || '',
      content: data.content,
      source: (data.source as any) || 'manual',
      source_id: data.source_id || null,
      source_url: data.source_url || null,
      featured: data.featured ?? false,
      status: (data.status as any) || 'published',
      metadata: data.metadata,
      created_by: data.created_by,
      updated_by: data.updated_by,
    };

    const validated = ProjectSchema.parse(withDefaults);
    const project: Project = {
      ...validated,
      id: uuidv4(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    this.store[project.id!] = project;
    return project;
  }

  /**
   * Get project by ID
   */
  getProject(id: string): Project | null {
    return this.store[id] || null;
  }

  /**
   * List all projects with optional filtering
   */
  listProjects(filter?: {
    status?: string;
    source?: string;
    featured?: boolean;
  }): Project[] {
    let projects = Object.values(this.store);

    if (filter?.status) {
      projects = projects.filter((p) => p.status === filter.status);
    }

    if (filter?.source) {
      projects = projects.filter((p) => p.source === filter.source);
    }

    if (filter?.featured !== undefined) {
      projects = projects.filter((p) => p.featured === filter.featured);
    }

    return projects.sort(
      (a, b) =>
        new Date(b.created_at!).getTime() - new Date(a.created_at!).getTime()
    );
  }

  /**
   * Update project by ID
   */
  updateProject(id: string, data: UpdateProjectInput): Project | null {
    const existing = this.store[id];
    if (!existing) return null;

    const updated: Project = {
      ...existing,
      ...data,
      id: existing.id,
      created_at: existing.created_at,
      updated_at: new Date().toISOString(),
    };

    // Validate the updated project
    ProjectSchema.parse(updated);
    this.store[id] = updated;
    return updated;
  }

  /**
   * Delete project by ID
   */
  deleteProject(id: string): boolean {
    if (!this.store[id]) return false;
    delete this.store[id];
    return true;
  }

  /**
   * Search projects by title or description
   */
  searchProjects(query: string): Project[] {
    const lowercase = query.toLowerCase();
    return Object.values(this.store).filter(
      (p) =>
        p.title.toLowerCase().includes(lowercase) ||
        p.description.toLowerCase().includes(lowercase)
    );
  }

  /**
   * Get featured projects
   */
  getFeaturedProjects(): Project[] {
    return Object.values(this.store)
      .filter((p) => p.featured && p.status === 'published')
      .sort(
        (a, b) =>
          new Date(b.created_at!).getTime() - new Date(a.created_at!).getTime()
      );
  }

  /**
   * Get projects by status
   */
  getProjectsByStatus(status: string): Project[] {
    return Object.values(this.store).filter((p) => p.status === status);
  }

  /**
   * Get project count
   */
  getProjectCount(): number {
    return Object.keys(this.store).length;
  }

  /**
   * Bulk update project status
   */
  bulkUpdateStatus(ids: string[], status: 'draft' | 'published' | 'archived'): number {
    let updated = 0;
    ids.forEach((id) => {
      if (this.store[id]) {
        this.store[id].status = status;
        this.store[id].updated_at = new Date().toISOString();
        updated++;
      }
    });
    return updated;
  }
}

// Singleton instance
let instance: ProjectAdminService | null = null;

export function getProjectAdmin(): ProjectAdminService {
  if (!instance) {
    instance = new ProjectAdminService();
  }
  return instance;
}

export { ProjectAdminService };
