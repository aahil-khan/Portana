import { getOnboarding } from '../src/onboarding';
import { describe, it, expect, beforeEach } from '@jest/globals';

describe('OnboardingService', () => {
  let sessionId: string;

  beforeEach(() => {
    sessionId = `test-session-${Date.now()}`;
  });

  describe('Session Management', () => {
    it('should create a new session', () => {
      const onboarding = getOnboarding();
      const session = onboarding.createSession(sessionId);

      expect(session).toBeDefined();
      expect(session.id).toBe(sessionId);
      expect(session.step1).toBeUndefined();
    });

    it('should retrieve an existing session', () => {
      const onboarding = getOnboarding();
      onboarding.createSession(sessionId);
      const session = onboarding.getSession(sessionId);

      expect(session).toBeDefined();
      expect(session?.id).toBe(sessionId);
    });

    it('should return null for non-existent session', () => {
      const onboarding = getOnboarding();
      const session = onboarding.getSession('non-existent');

      expect(session).toBeNull();
    });

    it('should calculate progress percentage', () => {
      const onboarding = getOnboarding();
      const session = onboarding.createSession(sessionId);

      expect(onboarding.getProgress(sessionId)).toBe(0);

      session.step1 = {
        name: 'John Doe',
        email: 'john@example.com',
        bio: 'AI enthusiast',
      };
      expect(onboarding.getProgress(sessionId)).toBe(20);

      session.step2 = { resumeText: 'Senior Dev with 10 years experience' };
      expect(onboarding.getProgress(sessionId)).toBe(40);

      session.step3 = { githubUsername: 'johndoe', mediumUsername: '', githubRepos: [], mediumArticles: [] };
      expect(onboarding.getProgress(sessionId)).toBe(60);

      session.step4 = { personaName: 'Alex', personaDescription: 'Tech expert with deep knowledge', tonality: 'technical', responseLength: 'detailed' };
      expect(onboarding.getProgress(sessionId)).toBe(80);

      session.step5 = { deploymentPlatform: 'vercel', apiKey: 'key', webhookUrl: '', allowWebhooks: false };
      expect(onboarding.getProgress(sessionId)).toBe(100);
    });

    it('should detect completion', () => {
      const onboarding = getOnboarding();
      const session = onboarding.createSession(sessionId);

      expect(onboarding.isComplete(sessionId)).toBe(false);

      session.step1 = { name: 'John', email: 'john@example.com', bio: 'AI' };
      session.step2 = { resumeText: 'Senior Dev with years of experience' };
      session.step3 = { githubUsername: 'johndoe', mediumUsername: '', githubRepos: [], mediumArticles: [] };
      session.step4 = { personaName: 'Alex', personaDescription: 'Expert in technology', tonality: 'technical', responseLength: 'detailed' };
      session.step5 = { deploymentPlatform: 'vercel', apiKey: 'key', webhookUrl: '', allowWebhooks: false };
      session.completedAt = Date.now();

      expect(onboarding.isComplete(sessionId)).toBe(true);
    });
  });

  describe('Step 1: Profile Creation', () => {
    it('should validate and store profile data', async () => {
      const onboarding = getOnboarding();
      onboarding.createSession(sessionId);

      const result = await onboarding.step1(sessionId, {
        name: 'Jane Smith',
        email: 'jane@example.com',
        bio: 'Full-stack engineer',
        website: 'https://jane.dev',
        githubUrl: 'https://github.com/janesmith',
        linkedinUrl: 'https://linkedin.com/in/janesmith',
      });

      expect(result.success).toBe(true);
      const session = onboarding.getSession(sessionId);
      expect(session?.step1?.name).toBe('Jane Smith');
      expect(session?.step1?.email).toBe('jane@example.com');
    });

    it('should fail on invalid email', async () => {
      const onboarding = getOnboarding();
      onboarding.createSession(sessionId);

      const result = await onboarding.step1(sessionId, {
        name: 'Jane Smith',
        email: 'invalid-email',
        bio: 'Engineer',
      } as any);

      expect(result.success).toBe(false);
    });

    it('should fail on missing required name', async () => {
      const onboarding = getOnboarding();
      onboarding.createSession(sessionId);

      const result = await onboarding.step1(sessionId, {
        email: 'jane@example.com',
        bio: 'Engineer',
      } as any);

      expect(result.success).toBe(false);
    });
  });

  describe('Step 2: Resume Processing', () => {
    beforeEach(async () => {
      const onboarding = getOnboarding();
      onboarding.createSession(sessionId);
      await onboarding.step1(sessionId, {
        name: 'Jane Smith',
        email: 'jane@example.com',
        bio: 'Engineer',
      });
    });

    it('should process resume text', async () => {
      const onboarding = getOnboarding();
      const result = await onboarding.step2(sessionId, {
        resumeText: 'Senior Full-Stack Engineer with 5 years experience in TypeScript, React, Node.js, PostgreSQL, cloud infrastructure',
      });

      expect(result.success).toBe(true);
      const session = onboarding.getSession(sessionId);
      expect(session?.step2?.resumeText).toBeDefined();
    });

    it('should fail on short resume', async () => {
      const onboarding = getOnboarding();
      const result = await onboarding.step2(sessionId, {
        resumeText: 'Short text',
      });

      expect(result.success).toBe(false);
    });

    it('should process resume with valid text', async () => {
      const onboarding = getOnboarding();
      const result = await onboarding.step2(sessionId, {
        resumeText: 'Senior Full-Stack Engineer with 5 years experience in TypeScript, React, Node.js, PostgreSQL',
      });

      expect(result.success).toBe(true);
    });
  });

  describe('Step 3: Source Integration', () => {
    beforeEach(async () => {
      const onboarding = getOnboarding();
      onboarding.createSession(sessionId);
      await onboarding.step1(sessionId, {
        name: 'Jane Smith',
        email: 'jane@example.com',
        bio: 'Engineer',
      });
      // Note: step2 skipped because it requires embedder API key
    });

    it('should handle GitHub username with repos', async () => {
      const onboarding = getOnboarding();
      const result = await onboarding.step3(sessionId, {
        githubUsername: 'octocat',
        mediumUsername: '',
        githubRepos: ['repo1', 'repo2'],
        mediumArticles: [],
      });

      expect(result.success).toBe(true);
      const session = onboarding.getSession(sessionId);
      expect(session?.step3?.githubUsername).toBe('octocat');
    });

    it('should handle empty sources', async () => {
      const onboarding = getOnboarding();
      const result = await onboarding.step3(sessionId, {
        githubUsername: '',
        mediumUsername: '',
        githubRepos: [],
        mediumArticles: [],
      });

      expect(result.success).toBe(true);
    });

    it('should handle Medium username with articles', async () => {
      const onboarding = getOnboarding();
      const result = await onboarding.step3(sessionId, {
        githubUsername: '',
        mediumUsername: 'janesmith',
        githubRepos: [],
        mediumArticles: ['article1', 'article2'],
      });

      expect(result.success).toBe(true);
    });
  });

  describe('Step 4: AI Persona Configuration', () => {
    beforeEach(async () => {
      const onboarding = getOnboarding();
      onboarding.createSession(sessionId);
      await onboarding.step1(sessionId, { name: 'Jane', email: 'jane@example.com', bio: 'Engineer' });
      // Note: step2 skipped because it requires embedder API key
      await onboarding.step3(sessionId, { githubUsername: '', mediumUsername: '', githubRepos: [], mediumArticles: [] });
    });

    it('should configure AI persona', async () => {
      const onboarding = getOnboarding();
      const result = await onboarding.step4(sessionId, {
        personaName: 'TechAdviser',
        personaDescription: 'Expert in cloud architecture and distributed systems with deep knowledge',
        tonality: 'technical',
        responseLength: 'detailed',
      });

      expect(result.success).toBe(true);
      const session = onboarding.getSession(sessionId);
      expect(session?.step4?.personaName).toBe('TechAdviser');
    });

    it('should fail on invalid tonality', async () => {
      const onboarding = getOnboarding();
      const result = await onboarding.step4(sessionId, {
        personaName: 'Advisor',
        personaDescription: 'Expert in technology and systems',
        tonality: 'invalid-tonality' as any,
        responseLength: 'detailed',
      });

      expect(result.success).toBe(false);
    });

    it('should support all tonality options', async () => {
      const onboarding = getOnboarding();
      const tonalities = ['professional', 'casual', 'technical', 'creative'] as const;

      for (const tonality of tonalities) {
        // Use unique sessionId for each iteration
        const uniqueSessionId = `${sessionId}-${tonality}`;
        onboarding.createSession(uniqueSessionId);
        await onboarding.step1(uniqueSessionId, { name: 'Jane', email: 'jane@example.com', bio: 'Engineer' });
        // Note: step2 skipped because it requires embedder API key
        await onboarding.step3(uniqueSessionId, { githubUsername: '', mediumUsername: '', githubRepos: [], mediumArticles: [] });

        const result = await onboarding.step4(uniqueSessionId, {
          personaName: 'Advisor',
          personaDescription: 'Expert in technology and systems with deep knowledge and understanding of the domain',
          tonality,
          responseLength: 'medium',
        });

        expect(result.success).toBe(true);
      }
    });
  });

  describe('Step 5: Deployment Configuration', () => {
    beforeEach(async () => {
      const onboarding = getOnboarding();
      onboarding.createSession(sessionId);
      await onboarding.step1(sessionId, { name: 'Jane', email: 'jane@example.com', bio: 'Engineer' });
      // Note: step2 skipped because it requires embedder API key
      await onboarding.step3(sessionId, { githubUsername: '', mediumUsername: '', githubRepos: [], mediumArticles: [] });
      await onboarding.step4(sessionId, {
        personaName: 'Advisor',
        personaDescription: 'Expert in technology and systems with deep knowledge and understanding of the domain',
        tonality: 'technical',
        responseLength: 'detailed',
      });
    });

    it('should configure deployment settings', async () => {
      const onboarding = getOnboarding();
      const result = await onboarding.step5(sessionId, {
        deploymentPlatform: 'vercel',
        apiKey: 'test-key-12345',
        webhookUrl: undefined,
        allowWebhooks: false,
      });

      expect(result.success).toBe(true);
      const session = onboarding.getSession(sessionId);
      expect(session?.step5?.deploymentPlatform).toBe('vercel');
    });

    it('should support all deployment platforms', async () => {
      const onboarding = getOnboarding();
      const platforms = ['vercel', 'netlify', 'aws', 'self-hosted'] as const;

      for (const platform of platforms) {
        // Use unique sessionId for each iteration
        const uniqueSessionId = `${sessionId}-${platform}`;
        onboarding.createSession(uniqueSessionId);
        await onboarding.step1(uniqueSessionId, { name: 'Jane', email: 'jane@example.com', bio: 'Engineer' });
        // Note: step2 skipped because it requires embedder API key
        await onboarding.step3(uniqueSessionId, { githubUsername: '', mediumUsername: '', githubRepos: [], mediumArticles: [] });
        await onboarding.step4(uniqueSessionId, {
          personaName: 'Advisor',
          personaDescription: 'Expert in technology and systems',
          tonality: 'technical',
          responseLength: 'detailed',
        });

        const result = await onboarding.step5(uniqueSessionId, {
          deploymentPlatform: platform,
          apiKey: 'test-key-12345',
          webhookUrl: undefined,
          allowWebhooks: false,
        });

        expect(result.success).toBe(true);
      }
    });

    it('should fail on short API key', async () => {
      const onboarding = getOnboarding();
      const result = await onboarding.step5(sessionId, {
        deploymentPlatform: 'vercel',
        apiKey: 'short',
        webhookUrl: '',
        allowWebhooks: false,
      });

      expect(result.success).toBe(false);
    });
  });

  describe('Complete Onboarding Flow', () => {
    it('should complete full 5-step onboarding', async () => {
      const onboarding = getOnboarding();
      onboarding.createSession(sessionId);

      const result1 = await onboarding.step1(sessionId, {
        name: 'Complete User',
        email: 'complete@example.com',
        bio: 'Full-stack engineer',
        website: 'https://complete.dev',
        githubUrl: 'https://github.com/completeuser',
        linkedinUrl: 'https://linkedin.com/in/completeuser',
      });
      expect(result1.success).toBe(true);
      expect(onboarding.getProgress(sessionId)).toBe(20);

      const result2 = await onboarding.step2(sessionId, {
        resumeText: 'Senior engineer with expertise in TypeScript, React, Node.js, databases, cloud infrastructure and modern web technologies',
      });
      if (!result2.success) {
        console.log('Step2 error:', result2.error);
      }
      expect(result2.success).toBe(true);
      expect(onboarding.getProgress(sessionId)).toBe(40);

      const result3 = await onboarding.step3(sessionId, {
        githubUsername: 'completeuser',
        mediumUsername: 'completeuser',
        githubRepos: ['awesome-project', 'another-project'],
        mediumArticles: ['article1'],
      });
      expect(result3.success).toBe(true);
      expect(onboarding.getProgress(sessionId)).toBe(60);

      const result4 = await onboarding.step4(sessionId, {
        personaName: 'TechExpert',
        personaDescription: 'Knowledgeable about modern web technologies and systems',
        tonality: 'technical',
        responseLength: 'detailed',
      });
      expect(result4.success).toBe(true);
      expect(onboarding.getProgress(sessionId)).toBe(80);

      const result5 = await onboarding.step5(sessionId, {
        deploymentPlatform: 'vercel',
        apiKey: 'secret-key-12345',
        webhookUrl: 'https://complete.dev/webhooks',
        allowWebhooks: true,
      });
      expect(result5.success).toBe(true);
      expect(onboarding.getProgress(sessionId)).toBe(100);

      // completedAt is set only by step5, so isComplete is true
      expect(onboarding.isComplete(sessionId)).toBe(true);
      const session = onboarding.getSession(sessionId);
      expect(session?.step1).toBeDefined();
      expect(session?.step2).toBeDefined();
      expect(session?.step3).toBeDefined();
      expect(session?.step4).toBeDefined();
      expect(session?.step5).toBeDefined();
    });

    it('should handle step completion in order', async () => {
      const onboarding = getOnboarding();
      onboarding.createSession(sessionId);

      const result = await onboarding.step2(sessionId, {
        resumeText: 'Senior engineer',
      });

      // Should fail because step1 is required first
      expect(result.success).toBe(false);
    });
  });
});
