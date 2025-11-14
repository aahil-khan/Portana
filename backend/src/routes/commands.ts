import { FastifyInstance } from 'fastify';
import { readFileSync } from 'fs';
import { resolve } from 'path';

/**
 * Resume data interface
 */
interface ResumeData {
  personal: any;
  summary: string;
  education: any[];
  experience: any[];
  projects: any[];
  skills: Record<string, string[]>;
  achievements: any[];
}

/**
 * Blogs data interface
 */
interface BlogsData {
  blogs: Array<{
    id: string;
    title: string;
    description: string;
    link: string;
    publishedAt: string;
    tags: string[];
    readTime?: number;
    claps?: number;
  }>;
}

/**
 * Load resume data from resume.json
 */
function loadResume(): ResumeData {
  try {
    const resumePath = resolve(process.cwd(), 'resume.json');
    const data = readFileSync(resumePath, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error loading resume.json:', error);
    throw new Error('Failed to load resume data');
  }
}

/**
 * Load blogs data from blogs.json
 */
function loadBlogs(): BlogsData {
  try {
    // Try multiple locations
    const possiblePaths = [
      resolve(process.cwd(), 'blogs.json'),
      resolve(process.cwd(), '..', 'blogs.json'),
      resolve(import.meta.url.replace('file://', ''), '..', '..', '..', '..', 'blogs.json'),
    ];

    for (const path of possiblePaths) {
      try {
        const data = readFileSync(path, 'utf-8');
        console.log('Loaded blogs from:', path);
        return JSON.parse(data);
      } catch {
        // Try next path
      }
    }

    console.warn('blogs.json not found in any location, returning empty blogs');
    return { blogs: [] };
  } catch (error) {
    console.error('Error loading blogs.json:', error);
    return { blogs: [] };
  }
}

/**
 * Command response interface
 */
interface CommandResponse {
  type: 'command';
  command: string;
  content: string;
  data: any;
}

/**
 * Register command routes
 */
export async function registerCommandRoutes(fastify: FastifyInstance): Promise<void> {
  /**
   * GET /api/commands/projects
   * Returns all projects in command format
   */
  fastify.get<{}>('/api/commands/projects', async (_request, reply) => {
    try {
      const resume = loadResume();

      const response: CommandResponse = {
        type: 'command',
        command: 'projects',
        content: 'Here are my projects:',
        data: resume.projects.map((project, idx) => ({
          id: `project-${idx}`,
          title: project.name,
          subtitle: project.subtitle,
          description: project.description,
          tags: project.technologies,
          highlights: project.highlights,
          link: project.link || '#',
          github: project.github || '#',
        })),
      };

      return reply.send(response);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return reply.code(500).send({ error: message });
    }
  });

  /**
   * GET /api/commands/stack
   * Returns tech stack categorized
   */
  fastify.get<{}>('/api/commands/stack', async (_request, reply) => {
    try {
      const resume = loadResume();

      const stackData = Object.entries(resume.skills).map(([category, tools]) => ({
        name: category
          .replace(/_/g, ' ')
          .split(' ')
          .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
          .join(' '),
        tools,
      }));

      const response: CommandResponse = {
        type: 'command',
        command: 'stack',
        content: 'My tech stack and specialties:',
        data: stackData,
      };

      return reply.send(response);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return reply.code(500).send({ error: message });
    }
  });

  /**
   * GET /api/commands/experience
   * Returns work experience
   */
  fastify.get<{}>('/api/commands/experience', async (_request, reply) => {
    try {
      const resume = loadResume();

      const response: CommandResponse = {
        type: 'command',
        command: 'experience',
        content: 'My professional experience:',
        data: resume.experience.map((exp, idx) => ({
          id: `exp-${idx}`,
          title: exp.title,
          company: exp.company,
          location: exp.location,
          duration: exp.duration,
          period: exp.duration, // alias for compatibility
          description: exp.description,
          technologies: exp.technologies,
          responsibilities: exp.responsibilities,
        })),
      };

      return reply.send(response);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return reply.code(500).send({ error: message });
    }
  });

  /**
   * GET /api/commands/education
   * Returns education details
   */
  fastify.get<{}>('/api/commands/education', async (_request, reply) => {
    try {
      const resume = loadResume();

      const response: CommandResponse = {
        type: 'command',
        command: 'education',
        content: 'My educational background:',
        data: resume.education.map((edu, idx) => ({
          id: `edu-${idx}`,
          institution: edu.institution,
          degree: edu.degree,
          cgpa: edu.cgpa || edu.grade,
        })),
      };

      return reply.send(response);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return reply.code(500).send({ error: message });
    }
  });

  /**
   * GET /api/commands/summary
   * Returns personal summary
   */
  fastify.get<{}>('/api/commands/summary', async (_request, reply) => {
    try {
      const resume = loadResume();

      const response: CommandResponse = {
        type: 'command',
        command: 'summary',
        content: 'About me:',
        data: {
          text: resume.summary,
          personal: resume.personal,
        },
      };

      return reply.send(response);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return reply.code(500).send({ error: message });
    }
  });

  /**
   * GET /api/commands/achievements
   * Returns achievements and awards
   */
  fastify.get<{}>('/api/commands/achievements', async (_request, reply) => {
    try {
      const resume = loadResume();

      const response: CommandResponse = {
        type: 'command',
        command: 'achievements',
        content: 'My achievements:',
        data: resume.achievements.map((achievement, idx) => ({
          id: `achievement-${idx}`,
          title: achievement.title,
          event: achievement.event,
          organization: achievement.organization,
        })),
      };

      return reply.send(response);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return reply.code(500).send({ error: message });
    }
  });

  /**
   * GET /api/commands/timeline
   * Returns professional timeline
   */
  fastify.get<{}>('/api/commands/timeline', async (_request, reply) => {
    try {
      const resume = loadResume();

      // Build timeline from education and experience
      const timelineItems = [
        ...resume.education.map((edu, idx) => ({
          id: `edu-${idx}`,
          type: 'education',
          title: edu.degree,
          subtitle: edu.institution,
          date: 'N/A',
          description: '',
        })),
        ...resume.experience.map((exp, idx) => ({
          id: `exp-${idx}`,
          type: 'experience',
          title: exp.title,
          subtitle: exp.company,
          date: exp.duration,
          description: exp.description,
          technologies: exp.technologies,
        })),
      ];

      const response: CommandResponse = {
        type: 'command',
        command: 'timeline',
        content: 'My professional timeline:',
        data: timelineItems,
      };

      return reply.send(response);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return reply.code(500).send({ error: message });
    }
  });

  /**
   * GET /api/commands/all
   * Returns all portfolio data combined
   */
  fastify.get<{}>('/api/commands/all', async (_request, reply) => {
    try {
      const resume = loadResume();

      const response = {
        type: 'command',
        command: 'all',
        content: 'Complete portfolio data:',
        data: {
          personal: resume.personal,
          summary: resume.summary,
          education: resume.education,
          experience: resume.experience,
          projects: resume.projects,
          skills: resume.skills,
          achievements: resume.achievements,
        },
      };

      return reply.send(response);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return reply.code(500).send({ error: message });
    }
  });

  /**
   * GET /api/commands/blog
   * Returns Medium articles in command format
   */
  fastify.get<{}>('/api/commands/blog', async (_request, reply) => {
    try {
      const blogsData = loadBlogs();

      const response: CommandResponse = {
        type: 'command',
        command: 'blog',
        content: 'My latest blog posts:',
        data: blogsData.blogs.map((article) => ({
          id: article.id,
          title: article.title,
          description: article.description,
          link: article.link,
          tags: article.tags,
          publishedAt: article.publishedAt,
          readTime: article.readTime || 0,
          claps: article.claps || 0,
        })),
      };

      return reply.send(response);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return reply.code(500).send({ error: message });
    }
  });

  /**
   * GET /api/commands/start
   * Returns welcome introduction and usage guide
   */
  fastify.get<{}>('/api/commands/start', async (_request, reply) => {
    try {
      const resume = loadResume();
      
      const response = {
        type: 'command',
        command: 'start',
        content: `👋 Welcome! I'm ${resume.personal.name}.

This is my AI-powered portfolio assistant. Think of me as your guide through Aahil's professional world.

📚 **Here's what you can do:**

**Commands** - Type any of these to explore:
• /projects - See my recent projects and work
• /blog - Read my latest articles on Medium
• /stack - Check out my tech skills and specializations  
• /experience - Learn about my professional journey
• /timeline - View my complete career timeline
• /help - See all available commands

**Ask anything** - Or just have a natural conversation! I have access to:
✓ My resume and professional background
✓ Project details and GitHub repositories  
✓ Blog articles and Medium stories
✓ Technical expertise and skills

I can answer questions about my experience, suggest relevant projects, provide blog recommendations, or just chat.

**💡 Quick Tips:**
- Ask "what projects have you built?" or just use /projects
- Looking for my tech stack? Try /stack or ask "what technologies do you use?"
- Want to read something? Ask "recommend a blog post" or use /blog
- Need to know my background? Try /experience or /timeline

Go ahead and explore! Ask me anything about my work, projects, or experiences. 🚀`,
        data: null,
      };

      return reply.send(response);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return reply.code(500).send({ error: message });
    }
  });
}
