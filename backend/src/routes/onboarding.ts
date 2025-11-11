import { FastifyInstance } from 'fastify';
import { v4 as uuidv4 } from 'uuid';
import { getOnboarding } from '../onboarding/index.js';
import { getResumeParser } from '../services/index.js';
import { createLogger } from '../utils/logger.js';
import { extractTextFromFile } from '../utils/file-parser.js';
import fs from 'fs';

const logger = createLogger('OnboardingRoutes');

export async function onboardingRoutes(app: FastifyInstance) {
  const onboarding = getOnboarding();

  // ============================================================================
  // DIAGNOSTIC ENDPOINTS (For debugging/testing)
  // ============================================================================

  // GET /api/onboarding/:sessionId/debug - Inspect session state
  app.get<{ Params: { sessionId: string } }>(
    '/api/onboarding/:sessionId/debug',
    async (request, reply) => {
      try {
        const { sessionId } = request.params;
        const session = onboarding.getSession(sessionId);

        if (!session) {
          return reply.code(404).send({
            error: 'Session not found',
          });
        }

        reply.send({
          success: true,
          sessionId,
          createdAt: new Date(session.createdAt).toISOString(),
          completedAt: session.completedAt ? new Date(session.completedAt).toISOString() : null,
          data: {
            step1: session.step1 || null,
            step2: session.step2
              ? {
                  resumeText: session.step2.resumeText?.substring(0, 100) + '...' || '(empty)',
                  skillsCount: session.step2.skills?.length || 0,
                  experienceCount: session.step2.experience?.length || 0,
                  educationCount: session.step2.education?.length || 0,
                  skills: session.step2.skills || [],
                  experience: session.step2.experience || [],
                  education: session.step2.education || [],
                }
              : null,
            step3: session.step3 || null,
            step4: session.step4 || null,
            step5: session.step5 || null,
          },
          progress: {
            percentComplete: onboarding.getProgress(sessionId),
            isComplete: onboarding.isComplete(sessionId),
            completedSteps: {
              step1: !!session.step1,
              step2: !!session.step2,
              step3: !!session.step3,
              step4: !!session.step4,
              step5: !!session.step5,
            },
          },
        });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Debug endpoint failed';
        logger.error('Debug error', { error: errorMessage });
        reply.code(500).send({
          error: errorMessage,
        });
      }
    }
  );

  // GET /api/onboarding/:sessionId/debug/vectors - Inspect vectors for session
  app.get<{ Params: { sessionId: string } }>(
    '/api/onboarding/:sessionId/debug/vectors',
    async (request, reply) => {
      try {
        const { sessionId } = request.params;

        // Try to fetch from Qdrant (this would require access to qdrant manager)
        // For now, just return empty - you can call the manual endpoint instead
        reply.send({
          success: true,
          sessionId,
          message: 'Use GET /api/admin/vectors to see all vectors across all sessions',
          instructions: 'Call curl http://localhost:3200/api/admin/vectors to inspect Qdrant',
        });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Vector debug failed';
        reply.code(500).send({
          error: errorMessage,
        });
      }
    }
  );

  // ============================================================================
  // ORIGINAL ENDPOINTS (Production flow)
  // ============================================================================

  // POST /api/onboarding/start - Initialize onboarding with Step 1 data
  app.post<{ Body: any }>('/api/onboarding/start', async (request, reply) => {
    try {
      const userId = uuidv4();
      const sessionToken = uuidv4(); // In production, this should be a JWT token
      
      logger.info('Creating session', { userId });
      onboarding.createSession(userId);

      // Process Step 1 data if provided
      const step1Data = request.body as any;
      logger.info('Received Step 1 data', { 
        dataKeys: Object.keys(step1Data || {}),
        dataLength: Object.keys(step1Data || {}).length,
        step1Data: JSON.stringify(step1Data)
      });

      if (step1Data && Object.keys(step1Data).length > 0) {
        logger.info('Processing Step 1 data for session', { userId });
        const result = await onboarding.step1(userId, step1Data);
        logger.info('Step 1 result', { success: result.success, error: result.error });
        
        if (!result.success) {
          logger.warn('Step 1 validation warning', { error: result.error });
          // Continue anyway - not a critical failure
        }
      } else {
        logger.warn('No Step 1 data provided', { step1Data });
      }

      logger.info('Session after Step 1 processing', { 
        sessionId: userId,
        session: JSON.stringify(onboarding.getSession(userId))
      });

      reply.code(201).send({
        success: true,
        user_id: userId,
        session_token: sessionToken,
        message: 'Onboarding started',
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to start onboarding';
      logger.error('Start onboarding error', { error: errorMessage });
      reply.code(500).send({
        success: false,
        error: errorMessage,
      });
    }
  });

  // GET /api/onboarding/:sessionId - Get session status
  app.get<{ Params: { sessionId: string } }>('/api/onboarding/:sessionId', async (request, reply) => {
    try {
      const session = onboarding.getSession(request.params.sessionId);
      if (!session) {
        return reply.code(404).send({ error: 'Session not found' });
      }

      const progress = onboarding.getProgress(request.params.sessionId);

      reply.send({
        sessionId: session.id,
        progress,
        completed: onboarding.isComplete(request.params.sessionId),
        steps: {
          step1: !!session.step1,
          step2: !!session.step2,
          step3: !!session.step3,
          step4: !!session.step4,
          step5: !!session.step5,
        },
      });
    } catch (error) {
      reply.code(500).send({ error: 'Failed to get session' });
    }
  });

  // POST /api/onboarding/:sessionId/step/1 - Submit step 1
  app.post('/api/onboarding/:sessionId/step/1', async (request, reply) => {
    try {
      const sessionId = (request.params as any).sessionId;
      const result = await onboarding.step1(sessionId, request.body as any);

      if (!result.success) {
        return reply.code(400).send({ success: false, error: result.error });
      }

      reply.send({ success: true, message: 'Step 1 completed' });
    } catch (error) {
      reply.code(500).send({ success: false, error: 'Step 1 failed' });
    }
  });

  // POST /api/onboarding/:sessionId/step/2 - Submit step 2 (resume)
  app.post('/api/onboarding/:sessionId/step/2', async (request, reply) => {
    try {
      const sessionId = (request.params as any).sessionId;
      const result = await onboarding.step2(sessionId, request.body as any);

      if (!result.success) {
        return reply.code(400).send({ success: false, error: result.error });
      }

      reply.send({ success: true, message: 'Step 2 completed - resume processed' });
    } catch (error) {
      reply.code(500).send({ success: false, error: 'Step 2 failed' });
    }
  });

  // POST /api/onboarding/:sessionId/step/3 - Submit step 3 (sources)
  app.post('/api/onboarding/:sessionId/step/3', async (request, reply) => {
    try {
      const sessionId = (request.params as any).sessionId;
      const result = await onboarding.step3(sessionId, request.body as any);

      if (!result.success) {
        return reply.code(400).send({ success: false, error: result.error });
      }

      reply.send({ success: true, message: 'Step 3 completed - sources linked' });
    } catch (error) {
      reply.code(500).send({ success: false, error: 'Step 3 failed' });
    }
  });

  // POST /api/onboarding/:sessionId/step/4 - Submit step 4 (persona)
  app.post('/api/onboarding/:sessionId/step/4', async (request, reply) => {
    try {
      const sessionId = (request.params as any).sessionId;
      const result = await onboarding.step4(sessionId, request.body as any);

      if (!result.success) {
        return reply.code(400).send({ success: false, error: result.error });
      }

      reply.send({ success: true, message: 'Step 4 completed - persona configured' });
    } catch (error) {
      reply.code(500).send({ success: false, error: 'Step 4 failed' });
    }
  });

  // POST /api/onboarding/:sessionId/step/5 - Submit step 5 (deployment)
  app.post('/api/onboarding/:sessionId/step/5', async (request, reply) => {
    try {
      const sessionId = (request.params as any).sessionId;
      const result = await onboarding.step5(sessionId, request.body as any);

      if (!result.success) {
        return reply.code(400).send({ success: false, error: result.error });
      }

      reply.send({
        success: true,
        message: 'Onboarding completed! Your portfolio AI is ready.',
        completed: true,
      });
    } catch (error) {
      reply.code(500).send({ success: false, error: 'Step 5 failed' });
    }
  });

  // POST /api/onboarding/:sessionId/complete - Finalize onboarding
  app.post('/api/onboarding/:sessionId/complete', async (request, reply) => {
    try {
      const sessionId = (request.params as any).sessionId;
      const session = onboarding.getSession(sessionId);

      if (!session) {
        return reply.code(404).send({ error: 'Session not found' });
      }

      if (!onboarding.isComplete(sessionId)) {
        return reply.code(400).send({ error: 'Onboarding not complete' });
      }

      // Log completion event (in production, would persist to database)
      try {
        console.log('[Onboarding] Completed for session:', sessionId);
      } catch (error) {
        console.warn('Failed to log analytics:', error);
      }

      reply.send({
        success: true,
        message: 'Onboarding finalized',
        session,
      });
    } catch (error) {
      reply.code(500).send({ success: false, error: 'Finalization failed' });
    }
  });

  // POST /api/onboarding/parse-resume - Parse resume without onboarding session
  // Useful for preview/testing resume parsing
  app.post<{
    Body: { resumeText: string };
  }>('/api/onboarding/parse-resume', async (request, reply) => {
    try {
      const { resumeText } = request.body;

      if (!resumeText || resumeText.trim().length === 0) {
        return reply.code(400).send({
          error: 'Resume text is required',
        });
      }

      const parser = getResumeParser();
      const parsed = await parser.parseResume(resumeText);

      reply.send({
        success: true,
        data: parsed,
        message: 'Resume parsed successfully',
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to parse resume';
      reply.code(400).send({
        success: false,
        error: errorMessage,
      });
    }
  });

  // POST /api/onboarding/upload-resume - Upload and parse resume file
  app.post<{ Body: unknown }>(
    '/api/onboarding/upload-resume',
    async (request, reply) => {
      const uploadDir = './uploads';

      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }

      try {
        // Get multipart data iterator
        const parts = request.parts();
        let fileData = null;
        let filename = '';
        let mimetype = '';
        const chunks: Buffer[] = [];

        // Iterate through all parts
        for await (const part of parts) {
          if (part.type === 'file') {
            fileData = part;
            filename = part.filename;
            mimetype = part.mimetype;
            
            // Read the file stream
            for await (const chunk of part.file) {
              chunks.push(chunk);
            }
            break;
          }
        }

        if (!fileData || chunks.length === 0) {
          return reply.code(400).send({
            success: false,
            error: 'No file uploaded',
          });
        }

        logger.info('Processing uploaded resume', {
          filename,
          mimetype,
          size: chunks.reduce((a, b) => a + b.length, 0),
        });

        // Validate file type
        const allowedMimes = [
          'application/pdf',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'application/msword',
        ];

        if (!allowedMimes.includes(mimetype)) {
          return reply.code(400).send({
            success: false,
            error: `Invalid file type: ${mimetype}. Only PDF and DOCX files are allowed.`,
          });
        }

        // Create temporary file path
        const buffer = Buffer.concat(chunks);
        const tempFilePath = `${uploadDir}/${Date.now()}-${Math.round(Math.random() * 1e9)}-${filename}`;
        fs.writeFileSync(tempFilePath, buffer);

        try {
          // Extract text from the file
          const resumeText = await extractTextFromFile(tempFilePath);

          if (!resumeText || resumeText.trim().length === 0) {
            return reply.code(400).send({
              success: false,
              error: 'Resume file is empty or could not be parsed',
            });
          }

          // Parse the resume
          const parser = getResumeParser();
          const parsed = await parser.parseResume(resumeText);

          logger.info('Resume parsed successfully', {
            skillsCount: parsed.skills?.length || 0,
            experienceCount: parsed.experience?.length || 0,
            educationCount: parsed.education?.length || 0,
          });

          reply.send({
            success: true,
            data: parsed,
            message: 'Resume parsed successfully',
          });
        } catch (parseError) {
          const errorMessage = parseError instanceof Error ? parseError.message : 'Failed to parse resume';
          logger.error('Resume parsing failed', { error: errorMessage });

          reply.code(400).send({
            success: false,
            error: errorMessage,
          });
        } finally {
          // Clean up temporary file
          try {
            if (fs.existsSync(tempFilePath)) {
              fs.unlinkSync(tempFilePath);
            }
          } catch (err) {
            logger.warn('Failed to delete temporary file', { path: tempFilePath });
          }
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Failed to upload resume';
        logger.error('Resume upload error', { error: errorMessage });

        reply.code(500).send({
          success: false,
          error: errorMessage,
        });
      }
    }
  );

  // ============================================================================
  // CHECKPOINT & FINALIZE ENDPOINTS (Hybrid Approach)
  // ============================================================================

  // POST /api/onboarding/:sessionId/checkpoint - Save partial progress
  app.post<{ Params: { sessionId: string }; Body: any }>(
    '/api/onboarding/:sessionId/checkpoint',
    async (request, reply) => {
      try {
        const { sessionId } = request.params;
        const { step, data } = request.body as { step: number; data: any };

        if (!step || !data) {
          return reply.code(400).send({
            success: false,
            error: 'Missing step or data in checkpoint',
          });
        }

        const session = onboarding.getSession(sessionId);
        if (!session) {
          return reply.code(404).send({
            success: false,
            error: 'Session not found',
          });
        }

        // Save the specific step data
        const stepKey = `step${step}` as keyof typeof session;
        (session as any)[stepKey] = data;
        onboarding.updateSession(sessionId, session);

        logger.info(`Checkpoint saved for ${sessionId}`, { step });

        reply.send({
          success: true,
          message: `Step ${step} checkpoint saved`,
          progress: onboarding.getProgress(sessionId),
        });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Checkpoint failed';
        logger.error('Checkpoint error', { error: errorMessage });

        reply.code(500).send({
          success: false,
          error: errorMessage,
        });
      }
    }
  );

  // GET /api/onboarding/:sessionId/checkpoint-resume - Get last checkpoint
  app.get<{ Params: { sessionId: string } }>(
    '/api/onboarding/:sessionId/checkpoint-resume',
    async (request, reply) => {
      try {
        const { sessionId } = request.params;

        const session = onboarding.getSession(sessionId);
        if (!session) {
          return reply.code(404).send({
            success: false,
            error: 'Session not found',
          });
        }

        const progress = onboarding.getProgress(sessionId);
        const lastCompletedStep = typeof progress === 'number' ? 0 : (progress as any).completed || 0;

        reply.send({
          success: true,
          sessionId,
          lastCompletedStep,
          data: {
            step1: session.step1 || null,
            step2: session.step2 || null,
            step3: session.step3 || null,
            step4: session.step4 || null,
            step5: session.step5 || null,
          },
          message: `Can resume from step ${lastCompletedStep + 1}`,
        });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Failed to retrieve checkpoint';
        logger.error('Checkpoint resume error', { error: errorMessage });

        reply.code(500).send({
          success: false,
          error: errorMessage,
        });
      }
    }
  );

  // POST /api/onboarding/:sessionId/finalize - Process all steps + embed + deploy
  app.post<{ Params: { sessionId: string }; Body: any }>(
    '/api/onboarding/:sessionId/finalize',
    async (request, reply) => {
      try {
        const { sessionId } = request.params;
        const { step1, step2, step3, step4, step5 } = request.body as {
          step1?: any;
          step2?: any;
          step3?: any;
          step4?: any;
          step5?: any;
        };

        const session = onboarding.getSession(sessionId);
        if (!session) {
          return reply.code(404).send({
            success: false,
            error: 'Session not found',
          });
        }

        // Validate all steps are provided
        if (!step1 || !step2 || !step3 || !step4 || !step5) {
          return reply.code(400).send({
            success: false,
            error: 'All 5 steps required for finalization',
            missing: {
              step1: !step1,
              step2: !step2,
              step3: !step3,
              step4: !step4,
              step5: !step5,
            },
          });
        }

        // Process each step in sequence
        logger.info('Starting finalization for session', { sessionId });

        // Step 1
        let result1 = await onboarding.step1(sessionId, step1);
        if (!result1.success) {
          return reply.code(400).send({
            success: false,
            error: 'Step 1 validation failed',
            details: result1.error,
          });
        }

        // Step 2
        let result2 = await onboarding.step2(sessionId, step2);
        if (!result2.success) {
          return reply.code(400).send({
            success: false,
            error: 'Step 2 validation failed',
            details: result2.error,
          });
        }

        // Step 3
        let result3 = await onboarding.step3(sessionId, step3);
        if (!result3.success) {
          return reply.code(400).send({
            success: false,
            error: 'Step 3 validation failed',
            details: result3.error,
          });
        }

        // Step 4
        let result4 = await onboarding.step4(sessionId, step4);
        if (!result4.success) {
          return reply.code(400).send({
            success: false,
            error: 'Step 4 validation failed',
            details: result4.error,
          });
        }

        // Step 5
        let result5 = await onboarding.step5(sessionId, step5);
        if (!result5.success) {
          return reply.code(400).send({
            success: false,
            error: 'Step 5 validation failed',
            details: result5.error,
          });
        }

        // Mark as complete
        const finalSession = onboarding.getSession(sessionId);
        if (finalSession) {
          finalSession.completedAt = Date.now();
          onboarding.updateSession(sessionId, finalSession);
        }

        logger.info('Finalization completed successfully', { sessionId });

        reply.send({
          success: true,
          message: 'Onboarding finalized successfully! Your portfolio AI is ready.',
          sessionId,
          completed: true,
        });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Finalization failed';
        logger.error('Finalization error', { error: errorMessage });

        reply.code(500).send({
          success: false,
          error: errorMessage,
        });
      }
    }
  );

  // DELETE /api/onboarding/:sessionId - Delete session and cleanup
  app.delete<{ Params: { sessionId: string } }>(
    '/api/onboarding/:sessionId',
    async (request, reply) => {
      try {
        const { sessionId } = request.params;

        const session = onboarding.getSession(sessionId);
        if (!session) {
          return reply.code(404).send({
            success: false,
            error: 'Session not found',
          });
        }

        // Clean up vectors from this session
        try {
          const { getVectorDeduplicator } = await import('../services/vector-deduplicator.js');
          const vectorDedup = getVectorDeduplicator();
          vectorDedup.clearProject(sessionId);
          logger.info('Vectors cleaned up for session', { sessionId });
        } catch (err) {
          logger.warn('Failed to cleanup vectors', { error: err });
        }

        // Delete session
        onboarding.deleteSession(sessionId);

        logger.info('Session deleted', { sessionId });

        reply.send({
          success: true,
          message: 'Session deleted successfully',
          sessionId,
        });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Deletion failed';
        logger.error('Session deletion error', { error: errorMessage });

        reply.code(500).send({
          success: false,
          error: errorMessage,
        });
      }
    }
  );

  // ============================================================================
  // TEST ENDPOINTS (Development - allow testing individual steps in isolation)
  // ============================================================================

  // POST /api/onboarding/:sessionId/test/step/1 - Test step 1 independently
  app.post<{ Params: { sessionId: string }; Body: any }>(
    '/api/onboarding/:sessionId/test/step/1',
    async (request, reply) => {
      try {
        const { sessionId } = request.params;

        const session = onboarding.getSession(sessionId);
        if (!session) {
          onboarding.createSession(sessionId);
        }

        const result = await onboarding.step1(sessionId, request.body as any);

        if (!result.success) {
          return reply.code(400).send({
            success: false,
            error: result.error,
          });
        }

        reply.send({
          success: true,
          message: 'Step 1 test completed',
          data: request.body,
        });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Test step 1 failed';
        reply.code(400).send({
          success: false,
          error: errorMessage,
        });
      }
    }
  );

  // POST /api/onboarding/:sessionId/test/step/2 - Test step 2 independently
  app.post<{ Params: { sessionId: string }; Body: any }>(
    '/api/onboarding/:sessionId/test/step/2',
    async (request, reply) => {
      try {
        const { sessionId } = request.params;

        const session = onboarding.getSession(sessionId);
        if (!session) {
          onboarding.createSession(sessionId);
        }

        const result = await onboarding.step2(sessionId, request.body as any);

        if (!result.success) {
          return reply.code(400).send({
            success: false,
            error: result.error,
          });
        }

        reply.send({
          success: true,
          message: 'Step 2 test completed',
          parsed: result.parsed,
        });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Test step 2 failed';
        reply.code(400).send({
          success: false,
          error: errorMessage,
        });
      }
    }
  );

  // POST /api/onboarding/:sessionId/test/step/3 - Test step 3 independently
  app.post<{ Params: { sessionId: string }; Body: any }>(
    '/api/onboarding/:sessionId/test/step/3',
    async (request, reply) => {
      try {
        const { sessionId } = request.params;

        const session = onboarding.getSession(sessionId);
        if (!session) {
          onboarding.createSession(sessionId);
        }

        const result = await onboarding.step3(sessionId, request.body as any);

        if (!result.success) {
          return reply.code(400).send({
            success: false,
            error: result.error,
          });
        }

        reply.send({
          success: true,
          message: 'Step 3 test completed',
          data: request.body,
        });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Test step 3 failed';
        reply.code(400).send({
          success: false,
          error: errorMessage,
        });
      }
    }
  );

  // POST /api/onboarding/:sessionId/test/step/4 - Test step 4 independently
  app.post<{ Params: { sessionId: string }; Body: any }>(
    '/api/onboarding/:sessionId/test/step/4',
    async (request, reply) => {
      try {
        const { sessionId } = request.params;

        const session = onboarding.getSession(sessionId);
        if (!session) {
          onboarding.createSession(sessionId);
        }

        const result = await onboarding.step4(sessionId, request.body as any);

        if (!result.success) {
          return reply.code(400).send({
            success: false,
            error: result.error,
          });
        }

        reply.send({
          success: true,
          message: 'Step 4 test completed',
          data: request.body,
        });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Test step 4 failed';
        reply.code(400).send({
          success: false,
          error: errorMessage,
        });
      }
    }
  );

  // POST /api/onboarding/:sessionId/test/step/5 - Test step 5 independently
  app.post<{ Params: { sessionId: string }; Body: any }>(
    '/api/onboarding/:sessionId/test/step/5',
    async (request, reply) => {
      try {
        const { sessionId } = request.params;

        const session = onboarding.getSession(sessionId);
        if (!session) {
          onboarding.createSession(sessionId);
        }

        const result = await onboarding.step5(sessionId, request.body as any);

        if (!result.success) {
          return reply.code(400).send({
            success: false,
            error: result.error,
          });
        }

        reply.send({
          success: true,
          message: 'Step 5 test completed',
          data: request.body,
        });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Test step 5 failed';
        reply.code(400).send({
          success: false,
          error: errorMessage,
        });
      }
    }
  );
}
