import { z } from 'zod';
import OpenAI from 'openai';
import { getMemory } from '../services/memory.js';
import { getRetriever } from '../services/retriever.js';
import { getEmbedder } from '../services/embedder.js';
import { getOnboarding } from '../onboarding/index.js';
import type { SkillEntry } from '../services/resume-parser.js';

// Zod schemas for chat
export const ChatMessageSchema = z.object({
  role: z.enum(['user', 'assistant', 'system']),
  content: z.string().min(1, 'Message cannot be empty'),
});

export const ChatSessionSchema = z.object({
  sessionId: z.string().min(1, 'Session ID required'),
  userId: z.string().optional(),
  onboardingSessionId: z.string().optional(),
});

export const ChatRequestSchema = z.object({
  sessionId: z.string().min(1, 'Session ID required'),
  message: z.string().min(1, 'Message cannot be empty').max(4000, 'Message too long'),
  onboardingSessionId: z.string().optional(),
});

export type ChatMessage = z.infer<typeof ChatMessageSchema>;
export type ChatSession = z.infer<typeof ChatSessionSchema>;
export type ChatRequest = z.infer<typeof ChatRequestSchema>;

export interface ChatContext {
  personaName?: string;
  personaDescription?: string;
  tonality?: string;
  responseLength?: string;
  userSkills?: SkillEntry[];
  userBio?: string;
}

/**
 * ChatService - Manages conversational AI with context awareness
 * - Session memory management
 * - Vector-based context retrieval
 * - Persona-aware response generation
 * - Streaming support
 */
export class ChatService {
  private sessions = new Map<string, ChatSession>();
  private openai: OpenAI | null = null;

  private getOpenAI(): OpenAI {
    if (!this.openai) {
      this.openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
      });
    }
    return this.openai;
  }

  /**
   * Create or get a chat session
   */
  createSession(sessionId: string, userId?: string, onboardingSessionId?: string): ChatSession {
    const session: ChatSession = {
      sessionId,
      userId,
      onboardingSessionId,
    };
    this.sessions.set(sessionId, session);
    return session;
  }

  /**
   * Get existing session
   */
  getSession(sessionId: string): ChatSession | null {
    return this.sessions.get(sessionId) || null;
  }

  /**
   * Extract context from onboarding data
   */
  private buildContext(onboardingSessionId?: string): ChatContext {
    const context: ChatContext = {};

    if (onboardingSessionId) {
      try {
        const onboarding = getOnboarding();
        const onboardSession = onboarding.getSession(onboardingSessionId);

        if (onboardSession) {
          // Extract persona information from step 4
          if (onboardSession.step4) {
            context.personaName = onboardSession.step4.personaName;
            context.personaDescription = onboardSession.step4.personaDescription;
            context.tonality = onboardSession.step4.tonality;
            context.responseLength = onboardSession.step4.responseLength;
          }

          // Extract user profile from step 1
          if (onboardSession.step1) {
            context.userBio = onboardSession.step1.bio;
          }

          // Extract skills from step 2 (auto-parsed from resume)
          if (onboardSession.step2) {
            context.userSkills = onboardSession.step2.skills || [];
          }
        }
      } catch (error) {
        // Gracefully handle missing onboarding data
      }
    }

    return context;
  }

  /**
   * Retrieve relevant context from vector store
   */
  private async retrieveContext(message: string): Promise<string> {
    try {
      const embedder = getEmbedder();
      const retriever = getRetriever();

      // Embed the message
      const messageVector = await embedder.embedText(message);

      // Search for relevant content
      const results = await retriever.retrieveByVector(messageVector, 3);

      if (results.length === 0) {
        return '';
      }

      return results
        .map((r: any) => `- ${r.text} (from ${r.source})`)
        .join('\n');
    } catch (error) {
      // Gracefully handle retrieval errors
      return '';
    }
  }

  /**
   * Build system prompt with persona and context
   */
  private buildSystemPrompt(context: ChatContext, retrievedContext: string): string {
    let prompt = 'You are a helpful AI assistant.';

    // Add persona if available
    if (context.personaName && context.personaDescription) {
      prompt = `You are "${context.personaName}", ${context.personaDescription}.`;

      if (context.tonality) {
        prompt += ` Use a ${context.tonality} tone.`;
      }

      if (context.responseLength) {
        const lengthGuide = {
          brief: 'Keep responses concise and to the point (1-2 sentences).',
          medium: 'Provide balanced responses with moderate detail (2-3 sentences).',
          detailed: 'Provide comprehensive responses with thorough explanations.',
        };
        prompt += ` ${lengthGuide[context.responseLength as keyof typeof lengthGuide] || ''}`;
      }
    }

    // Add user context if available
    if (context.userBio) {
      prompt += `\n\nYou are assisting a user with this background: ${context.userBio}`;
    }

    if (context.userSkills && context.userSkills.length > 0) {
      const skillNames = context.userSkills.map(s => s.name).join(', ');
      prompt += `\nThe user's key skills are: ${skillNames}.`;
    }

    // Add retrieved context if available
    if (retrievedContext) {
      prompt += `\n\nHere is relevant information from your knowledge base:\n${retrievedContext}`;
    }

    return prompt;
  }

  /**
   * Get message history from memory service
   */
  private async getMessageHistory(sessionId: string): Promise<ChatMessage[]> {
    try {
      const memory = getMemory();
      const messages = memory.getMessages(sessionId);

      return messages
        .map((msg: any) => ({
          role: msg.role || 'user',
          content: msg.content || '',
        }))
        .filter((msg: ChatMessage) => ChatMessageSchema.safeParse(msg).success);
    } catch (error) {
      // Return empty history if memory service fails
      return [];
    }
  }

  /**
   * Save message to memory
   */
  private async saveMessage(sessionId: string, role: string, content: string): Promise<void> {
    try {
      const memory = getMemory();
      // Ensure session exists in memory service
      const session = memory.getSession(sessionId);
      if (!session) {
        throw new Error(`Session not found: ${sessionId}`);
      }
      memory.addMessage(sessionId, role as 'user' | 'assistant', content);
    } catch (error) {
      // Gracefully handle memory save failures
    }
  }

  /**
   * Generate streaming chat response
   * Returns async iterable for streaming content chunks
   */
  async *streamChat(req: ChatRequest): AsyncGenerator<string, void, unknown> {
    try {
      // Validate request
      const parsed = ChatRequestSchema.safeParse(req);
      if (!parsed.success) {
        throw new Error(`Invalid chat request: ${parsed.error.message}`);
      }

      const { sessionId, message, onboardingSessionId } = parsed.data;

      // Ensure session exists
      if (!this.getSession(sessionId)) {
        this.createSession(sessionId, undefined, onboardingSessionId);
      }

      // Save user message
      await this.saveMessage(sessionId, 'user', message);

      // Build context
      const context = this.buildContext(onboardingSessionId);

      // Retrieve relevant context from vector store
      const retrievedContext = await this.retrieveContext(message);

      // Get message history
      const history = await this.getMessageHistory(sessionId);

      // Build system prompt
      const systemPrompt = this.buildSystemPrompt(context, retrievedContext);

      // Prepare messages for OpenAI
      const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
        { role: 'system', content: systemPrompt },
        ...history.map((msg) => ({
          role: msg.role as 'system' | 'user' | 'assistant',
          content: msg.content,
        })),
        { role: 'user', content: message },
      ];

      // Create streaming chat completion
      const stream = await this.getOpenAI().chat.completions.create({
        model: 'gpt-4o',
        messages,
        stream: true,
        max_tokens: 2000,
        temperature: context.tonality === 'creative' ? 0.9 : 0.7,
      });

      let fullResponse = '';

      // Stream chunks and yield them
      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content || '';
        if (content) {
          fullResponse += content;
          yield content;
        }
      }

      // Save assistant response to memory
      await this.saveMessage(sessionId, 'assistant', fullResponse);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Chat streaming failed: ${message}`);
    }
  }

  /**
   * Get non-streaming chat response
   * For API clients that don't support streaming
   */
  async chat(req: ChatRequest): Promise<{ response: string; tokensUsed?: number }> {
    try {
      // Validate request
      const parsed = ChatRequestSchema.safeParse(req);
      if (!parsed.success) {
        throw new Error(`Invalid chat request: ${parsed.error.message}`);
      }

      const { sessionId, message, onboardingSessionId } = parsed.data;

      // Ensure session exists
      if (!this.getSession(sessionId)) {
        this.createSession(sessionId, undefined, onboardingSessionId);
      }

      // Save user message
      await this.saveMessage(sessionId, 'user', message);

      // Build context
      const context = this.buildContext(onboardingSessionId);

      // Retrieve relevant context from vector store
      const retrievedContext = await this.retrieveContext(message);

      // Get message history
      const history = await this.getMessageHistory(sessionId);

      // Build system prompt
      const systemPrompt = this.buildSystemPrompt(context, retrievedContext);

      // Prepare messages for OpenAI
      const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
        { role: 'system', content: systemPrompt },
        ...history.map((msg) => ({
          role: msg.role as 'system' | 'user' | 'assistant',
          content: msg.content,
        })),
        { role: 'user', content: message },
      ];

      // Create non-streaming chat completion
      const completion = await this.getOpenAI().chat.completions.create({
        model: 'gpt-4o',
        messages,
        stream: false,
        max_tokens: 2000,
        temperature: context.tonality === 'creative' ? 0.9 : 0.7,
      });

      const response = completion.choices[0]?.message?.content || '';

      // Save assistant response to memory
      await this.saveMessage(sessionId, 'assistant', response);

      return {
        response,
        tokensUsed: completion.usage?.total_tokens,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Chat failed: ${message}`);
    }
  }

  /**
   * Get session conversation history
   */
  async getHistory(sessionId: string): Promise<ChatMessage[]> {
    return this.getMessageHistory(sessionId);
  }

  /**
   * Clear session conversation history
   */
  clearSession(sessionId: string): void {
    this.sessions.delete(sessionId);
    try {
      const memory = getMemory();
      memory.clearSession(sessionId);
    } catch (error) {
      // Gracefully handle memory clear failures
    }
  }
}

// Singleton instance
let chatServiceInstance: ChatService | null = null;

export function getChat(): ChatService {
  if (!chatServiceInstance) {
    chatServiceInstance = new ChatService();
  }
  return chatServiceInstance;
}
