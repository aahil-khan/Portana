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

  // POST /api/onboarding/start - Initialize onboarding
  app.post('/api/onboarding/start', async (_request, reply) => {
    try {
      const userId = uuidv4();
      const sessionToken = uuidv4(); // In production, this should be a JWT token
      onboarding.createSession(userId);

      reply.code(201).send({
        success: true,
        user_id: userId,
        session_token: sessionToken,
        message: 'Onboarding started',
      });
    } catch (error) {
      reply.code(500).send({
        success: false,
        error: 'Failed to start onboarding',
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
  // Accepts PDF or DOCX files
  app.post('/api/onboarding/upload-resume', async (request, reply) => {
    const uploadDir = './uploads';

    // Ensure upload directory exists
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    try {
      const data = await request.file();

      if (!data) {
        return reply.code(400).send({
          success: false,
          error: 'No file uploaded',
        });
      }

      const filename = data.filename;
      const mimetype = data.mimetype;
      const file = data.file;

      logger.info('Processing uploaded resume', {
        filename,
        mimetype,
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

      // Read file buffer
      const chunks: Buffer[] = [];
      for await (const chunk of file) {
        chunks.push(chunk);
      }
      const buffer = Buffer.concat(chunks);

      // Create temporary file path
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
  });
}
