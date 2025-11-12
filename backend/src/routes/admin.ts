import { FastifyInstance } from 'fastify';
import {
  getProfileAdmin,
  getProjectAdmin,
  getAnalyticsAdmin,
} from '../admin/services/index.js';
import { getLogBuffer, clearLogBuffer } from '../utils/logger.js';
import { getGitHubIngestor } from '../services/github-ingestor.js';
import { getResumeIngestor } from '../services/resume-ingestor.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('AdminRoutes');

export async function registerAdminRoutes(fastify: FastifyInstance): Promise<void> {
  /**
   * PROFILE ENDPOINTS
   */

  /**
   * POST /api/admin/profiles
   * Create a new profile
   */
  fastify.post<{
    Body: {
      name: string;
      email: string;
      bio: string;
      avatar_url?: string;
      status?: 'active' | 'inactive' | 'archived';
      metadata?: Record<string, any>;
    };
  }>('/api/admin/profiles', async (request, reply) => {
    try {
      const { name, email, bio, avatar_url, status, metadata } = request.body;

      if (!name || !email || !bio) {
        return reply.code(400).send({
          error: 'Missing required fields: name, email, bio',
        });
      }

      const profileAdmin = getProfileAdmin();
      const profile = profileAdmin.createProfile({
        name,
        email,
        bio,
        avatar_url: avatar_url || null,
        status: (status as any) || 'active',
        metadata,
      });

      return reply.code(201).send({
        success: true,
        data: profile,
        message: 'Profile created successfully',
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Failed to create profile';
      return reply.code(400).send({
        error: errorMessage,
      });
    }
  });

  /**
   * GET /api/admin/profiles
   * List all profiles with optional filtering
   */
  fastify.get<{
    Querystring: { status?: string; search?: string };
  }>('/api/admin/profiles', async (request, reply) => {
    try {
      const { status, search } = request.query as any;
      const profileAdmin = getProfileAdmin();

      let profiles;
      if (search) {
        profiles = profileAdmin.searchProfiles(search);
      } else {
        profiles = profileAdmin.listProfiles({ status });
      }

      return reply.code(200).send({
        success: true,
        data: profiles,
        count: profiles.length,
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Failed to list profiles';
      return reply.code(500).send({ error: errorMessage });
    }
  });

  /**
   * GET /api/admin/profiles/:id
   * Get a specific profile by ID
   */
  fastify.get<{
    Params: { id: string };
  }>('/api/admin/profiles/:id', async (request, reply) => {
    try {
      const { id } = request.params as any;

      const profileAdmin = getProfileAdmin();
      const profile = profileAdmin.getProfile(id);

      if (!profile) {
        return reply.code(404).send({
          error: 'Profile not found',
        });
      }

      return reply.code(200).send({
        success: true,
        data: profile,
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Failed to get profile';
      return reply.code(500).send({ error: errorMessage });
    }
  });

  /**
   * PATCH /api/admin/profiles/:id
   * Update a profile
   */
  fastify.patch<{
    Params: { id: string };
    Body: Partial<{
      name: string;
      email: string;
      bio: string;
      avatar_url: string;
      status: 'active' | 'inactive' | 'archived';
      metadata: Record<string, any>;
    }>;
  }>('/api/admin/profiles/:id', async (request, reply) => {
    try {
      const { id } = request.params as any;
      const updates = request.body;

      const profileAdmin = getProfileAdmin();
      const profile = profileAdmin.updateProfile(id, updates as any);

      if (!profile) {
        return reply.code(404).send({
          error: 'Profile not found',
        });
      }

      return reply.code(200).send({
        success: true,
        data: profile,
        message: 'Profile updated successfully',
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Failed to update profile';
      return reply.code(400).send({
        error: errorMessage,
      });
    }
  });

  /**
   * DELETE /api/admin/profiles/:id
   * Delete a profile
   */
  fastify.delete<{
    Params: { id: string };
  }>('/api/admin/profiles/:id', async (request, reply) => {
    try {
      const { id } = request.params as any;

      const profileAdmin = getProfileAdmin();
      const success = profileAdmin.deleteProfile(id);

      if (!success) {
        return reply.code(404).send({
          error: 'Profile not found',
        });
      }

      return reply.code(200).send({
        success: true,
        message: 'Profile deleted successfully',
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Failed to delete profile';
      return reply.code(500).send({ error: errorMessage });
    }
  });

  /**
   * PROJECT ENDPOINTS
   */

  /**
   * POST /api/admin/projects
   * Create a new project
   */
  fastify.post<{
    Body: {
      title: string;
      description: string;
      content?: string;
      source?: 'manual' | 'github' | 'medium' | 'resume';
      source_id?: string;
      source_url?: string;
      featured?: boolean;
      status?: 'draft' | 'published' | 'archived';
      metadata?: Record<string, any>;
      created_by?: string;
    };
  }>('/api/admin/projects', async (request, reply) => {
    try {
      const {
        title,
        description,
        content,
        source,
        source_id,
        source_url,
        featured,
        status,
        metadata,
        created_by,
      } = request.body;

      if (!title || !description) {
        return reply.code(400).send({
          error: 'Missing required fields: title, description',
        });
      }

      const projectAdmin = getProjectAdmin();
      const project = projectAdmin.createProject({
        title,
        description,
        content,
        source: (source as any) || 'manual',
        source_id: source_id || null,
        source_url: source_url || null,
        featured: featured || false,
        status: (status as any) || 'published',
        metadata,
        created_by,
      });

      return reply.code(201).send({
        success: true,
        data: project,
        message: 'Project created successfully',
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Failed to create project';
      return reply.code(400).send({
        error: errorMessage,
      });
    }
  });

  /**
   * GET /api/admin/projects
   * List all projects with optional filtering
   */
  fastify.get<{
    Querystring: {
      status?: string;
      source?: string;
      featured?: boolean;
      search?: string;
    };
  }>('/api/admin/projects', async (request, reply) => {
    try {
      const { status, source, featured, search } = request.query as any;
      const projectAdmin = getProjectAdmin();

      let projects;
      if (search) {
        projects = projectAdmin.searchProjects(search);
      } else {
        projects = projectAdmin.listProjects({
          status,
          source,
          featured: featured === 'true' ? true : featured === 'false' ? false : undefined,
        });
      }

      return reply.code(200).send({
        success: true,
        data: projects,
        count: projects.length,
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Failed to list projects';
      return reply.code(500).send({ error: errorMessage });
    }
  });

  /**
   * GET /api/admin/projects/:id
   * Get a specific project by ID
   */
  fastify.get<{
    Params: { id: string };
  }>('/api/admin/projects/:id', async (request, reply) => {
    try {
      const { id } = request.params as any;

      const projectAdmin = getProjectAdmin();
      const project = projectAdmin.getProject(id);

      if (!project) {
        return reply.code(404).send({
          error: 'Project not found',
        });
      }

      return reply.code(200).send({
        success: true,
        data: project,
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Failed to get project';
      return reply.code(500).send({ error: errorMessage });
    }
  });

  /**
   * PATCH /api/admin/projects/:id
   * Update a project
   */
  fastify.patch<{
    Params: { id: string };
    Body: Partial<{
      title: string;
      description: string;
      content: string;
      source: 'manual' | 'github' | 'medium' | 'resume';
      source_id: string;
      source_url: string;
      featured: boolean;
      status: 'draft' | 'published' | 'archived';
      metadata: Record<string, any>;
      updated_by: string;
    }>;
  }>('/api/admin/projects/:id', async (request, reply) => {
    try {
      const { id } = request.params as any;
      const updates = request.body;

      const projectAdmin = getProjectAdmin();
      const project = projectAdmin.updateProject(id, updates as any);

      if (!project) {
        return reply.code(404).send({
          error: 'Project not found',
        });
      }

      return reply.code(200).send({
        success: true,
        data: project,
        message: 'Project updated successfully',
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Failed to update project';
      return reply.code(400).send({
        error: errorMessage,
      });
    }
  });

  /**
   * DELETE /api/admin/projects/:id
   * Delete a project
   */
  fastify.delete<{
    Params: { id: string };
  }>('/api/admin/projects/:id', async (request, reply) => {
    try {
      const { id } = request.params as any;

      const projectAdmin = getProjectAdmin();
      const success = projectAdmin.deleteProject(id);

      if (!success) {
        return reply.code(404).send({
          error: 'Project not found',
        });
      }

      return reply.code(200).send({
        success: true,
        message: 'Project deleted successfully',
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Failed to delete project';
      return reply.code(500).send({ error: errorMessage });
    }
  });

  /**
   * ANALYTICS ENDPOINTS
   */

  /**
   * GET /api/admin/analytics/metrics
   * Get analytics metrics summary
   */
  fastify.get('/api/admin/analytics/metrics', async (_request, reply) => {
    try {
      const analyticsAdmin = getAnalyticsAdmin();
      const metrics = analyticsAdmin.getMetrics();

      return reply.code(200).send({
        success: true,
        data: metrics,
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Failed to get metrics';
      return reply.code(500).send({ error: errorMessage });
    }
  });

  /**
   * GET /api/admin/analytics/events
   * Get analytics events with optional filtering
   */
  fastify.get<{
    Querystring: { type?: string; resourceId?: string };
  }>('/api/admin/analytics/events', async (_request, reply) => {
    try {
      const { type, resourceId } = _request.query as any;
      const analyticsAdmin = getAnalyticsAdmin();

      let events: Array<any> = [];
      if (type) {
        events = analyticsAdmin.getEventsByType(type as any);
      } else if (resourceId) {
        events = analyticsAdmin.getResourceEvents(resourceId);
      }

      return reply.code(200).send({
        success: true,
        data: events,
        count: events.length,
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Failed to get events';
      return reply.code(500).send({ error: errorMessage });
    }
  });

  /**
   * POST /api/admin/analytics/events
   * Record an analytics event
   */
  fastify.post<{
    Body: {
      type: 'view' | 'click' | 'interaction' | 'chat';
      resource_id: string;
      resource_type: 'project' | 'profile' | 'chat_session';
      user_id?: string;
      metadata?: Record<string, any>;
    };
  }>('/api/admin/analytics/events', async (request, reply) => {
    try {
      const { type, resource_id, resource_type, user_id, metadata } = request.body;

      if (!type || !resource_id || !resource_type) {
        return reply.code(400).send({
          error: 'Missing required fields: type, resource_id, resource_type',
        });
      }

      const analyticsAdmin = getAnalyticsAdmin();
      const event = analyticsAdmin.recordEvent({
        type,
        resource_id,
        resource_type,
        user_id,
        metadata,
        timestamp: new Date().toISOString(),
      });

      return reply.code(201).send({
        success: true,
        data: event,
        message: 'Event recorded successfully',
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Failed to record event';
      return reply.code(400).send({
        error: errorMessage,
      });
    }
  });

  /**
   * GET /api/admin/health
   * Admin health check
   */
  fastify.get('/api/admin/health', async (_request, reply) => {
    const profileAdmin = getProfileAdmin();
    const projectAdmin = getProjectAdmin();
    const analyticsAdmin = getAnalyticsAdmin();

    return reply.code(200).send({
      status: 'ok',
      timestamp: new Date().toISOString(),
      services: {
        profiles: {
          count: profileAdmin.getProfileCount(),
        },
        projects: {
          count: projectAdmin.getProjectCount(),
        },
        analytics: {
          eventCount: analyticsAdmin.getTotalEventCount(),
        },
      },
    });
  });

  /**
   * GET /api/admin/vectors
   * Inspect vectors stored in Qdrant (diagnostic endpoint)
   */
  fastify.get<{ Querystring: { projectId?: string; type?: string } }>(
    '/api/admin/vectors',
    async (_request, reply) => {
      try {
        const { getQdrant } = await import('../vector/index.js');
        const { getVectorDeduplicator } = await import(
          '../services/vector-deduplicator.js'
        );

        const qdrant = getQdrant();
        const dedup = getVectorDeduplicator();

        // Get Qdrant stats
        const stats = await qdrant.getStats();
        const dedupStats = dedup.getStats();

        return reply.send({
          success: true,
          timestamp: new Date().toISOString(),
          qdrant: {
            points_count: stats.points_count,
            vectors_count: stats.vectors_count,
            collection_name: 'portfolio_content',
          },
          deduplication: {
            total_entries: dedupStats.totalEntries,
            total_vectors_tracked: dedupStats.totalVectors,
            projects_tracked: Array.from(dedupStats.projectsTracked),
          },
          message: 'Vector diagnostic data retrieved successfully',
        });
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'Failed to get vector stats';
        return reply.code(500).send({
          success: false,
          error: errorMessage,
        });
      }
    }
  );

  /**
   * DELETE /api/admin/vectors/:projectId
   * Clear all vectors for a project
   */
  fastify.delete<{ Params: { projectId: string } }>(
    '/api/admin/vectors/:projectId',
    async (request, reply) => {
      try {
        const { projectId } = request.params;
        const { getVectorDeduplicator } = await import(
          '../services/vector-deduplicator.js'
        );

        const dedup = getVectorDeduplicator();
        const cleared = await dedup.clearProject(projectId);

        return reply.send({
          success: true,
          message: `Cleared ${cleared} vector entries for project ${projectId}`,
          cleared,
        });
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'Failed to clear vectors';
        return reply.code(500).send({
          success: false,
          error: errorMessage,
        });
      }
    }
  );

  /**
   * GET /api/admin/logs
   * Retrieve recent application logs
   */
  fastify.get<{ Querystring: { limit?: string; level?: string } }>(
    '/api/admin/logs',
    async (request, reply) => {
      try {
        const limit = Math.min(parseInt(request.query.limit || '100'), 500);
        const level = request.query.level as string | undefined;

        let logs = getLogBuffer();

        // Filter by level if specified
        if (level) {
          logs = logs.filter((log) => log.level === level);
        }

        // Get last N entries
        logs = logs.slice(-limit);

        return reply.send({
          success: true,
          timestamp: new Date().toISOString(),
          count: logs.length,
          logs,
        });
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'Failed to retrieve logs';
        return reply.code(500).send({
          success: false,
          error: errorMessage,
        });
      }
    }
  );

  /**
   * DELETE /api/admin/logs
   * Clear log buffer
   */
  fastify.delete('/api/admin/logs', async (_request, reply) => {
    try {
      clearLogBuffer();

      return reply.send({
        success: true,
        message: 'Log buffer cleared successfully',
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Failed to clear logs';
      return reply.code(500).send({
        success: false,
        error: errorMessage,
      });
    }
  });

  /**
   * POST /api/admin/ingest/github
   * Ingest GitHub READMEs for specified repos
   */
  fastify.post<{
    Body: { repos?: string[] };
  }>('/api/admin/ingest/github', async (request, reply) => {
    try {
      const ingestor = getGitHubIngestor();
      const requestedRepos = (request.body as any)?.repos;

      let repos;
      if (requestedRepos && Array.isArray(requestedRepos) && requestedRepos.length > 0) {
        // Parse repo strings like "owner/repo"
        repos = requestedRepos
          .map((repoStr: string) => {
            const [owner, repo] = repoStr.split('/');
            if (!owner || !repo) return null;
            return {
              owner,
              repo,
              url: `https://github.com/${owner}/${repo}`,
            };
          })
          .filter((r: any) => r !== null) as Array<{ owner: string; repo: string; url: string }>;

        if (repos.length === 0) {
          return reply.code(400).send({
            error: 'Invalid repo format. Use "owner/repo"',
          });
        }
      } else {
        // Use default repos
        repos = ingestor.getDefaultRepos();
      }

      logger.info('Starting GitHub ingestion', { repoCount: repos.length });

      const result = await ingestor.ingestMultipleRepos(repos);

      logger.info('GitHub ingestion complete', {
        totalChunks: result.totalChunks,
        totalVectors: result.totalVectors,
      });

      return reply.code(200).send({
        success: result.success,
        message: `Ingested ${result.totalVectors} vectors from ${repos.length} repos`,
        data: result,
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'GitHub ingestion failed';
      logger.error('GitHub ingestion error', { error: errorMessage });
      return reply.code(500).send({
        success: false,
        error: errorMessage,
      });
    }
  });

  /**
   * GET /api/admin/ingest/status
   * Check GitHub ingestion status
   */
  fastify.get('/api/admin/ingest/status', async (_request, reply) => {
    try {
      return reply.code(200).send({
        success: true,
        status: 'GitHub ingestor ready',
        lastRun: null, // TODO: Track last run time
        nextRun: null, // TODO: Schedule periodic ingestion
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Failed to get status';
      return reply.code(500).send({
        success: false,
        error: errorMessage,
      });
    }
  });

  /**
   * POST /api/admin/ingest/resume
   * Ingest resume from resume.md file
   */
  fastify.post('/api/admin/ingest/resume', async (_request, reply) => {
    try {
      const ingestor = getResumeIngestor();

      logger.info('Starting resume ingestion...');
      const result = await ingestor.ingest();

      logger.info('Resume ingestion complete', {
        totalChunks: result.totalChunks,
        totalVectors: result.totalVectors,
      });

      return reply.code(200).send({
        success: true,
        message: `Successfully ingested resume - ${result.totalVectors} vectors created`,
        data: result,
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Resume ingestion failed';
      logger.error('Resume ingestion error', { error: errorMessage });
      return reply.code(500).send({
        success: false,
        error: errorMessage,
      });
    }
  });

  /**
   * POST /api/admin/debug/retrieve
   * Debug endpoint - test vector retrieval
   */
  fastify.post<{ Body: { query: string } }>(
    '/api/admin/debug/retrieve',
    async (request, reply) => {
      try {
        const { query } = request.body;
        
        if (!query) {
          return reply.code(400).send({ error: 'Missing query parameter' });
        }

        const { getEmbedder } = await import('../services/embedder.js');
        const { getRetriever } = await import('../services/retriever.js');

        const embedder = getEmbedder();
        const retriever = getRetriever();

        // Embed the query
        const queryVector = await embedder.embedText(query);
        logger.info('Query embedded', { query, vectorDim: queryVector.length });

        // Retrieve results
        const results = await retriever.retrieveByVector(queryVector, 10);
        logger.info('Retrieval results', { count: results.length });

        return reply.code(200).send({
          success: true,
          query,
          results: results.map((r) => ({
            id: r.id,
            score: r.score,
            text: r.text.substring(0, 150) + (r.text.length > 150 ? '...' : ''),
            source: r.source,
            projectId: r.projectId,
            metadata: r.metadata,
          })),
          count: results.length,
        });
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'Retrieval debug failed';
        logger.error('Retrieval debug error', { error: errorMessage });
        return reply.code(500).send({
          success: false,
          error: errorMessage,
        });
      }
    }
  );
}
