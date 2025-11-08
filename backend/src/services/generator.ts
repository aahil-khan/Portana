import OpenAI from 'openai';
import { Readable } from 'stream';

export interface GeneratorConfig {
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export class GeneratorService {
  private client: OpenAI;
  private model: string;
  private temperature: number;
  private maxTokens: number;

  constructor(config: GeneratorConfig = {}) {
    this.client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
    this.model = config.model || 'gpt-4o-mini';
    this.temperature = config.temperature ?? 0.7;
    this.maxTokens = config.maxTokens || 2048;
  }

  async generate(messages: ChatMessage[]): Promise<string> {
    try {
      const completion = await this.client.chat.completions.create({
        model: this.model,
        messages: messages as any,
        temperature: this.temperature,
        max_tokens: this.maxTokens,
      });

      return completion.choices[0]?.message?.content || '';
    } catch (error) {
      throw new Error(
        `Failed to generate: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  async *generateStream(messages: ChatMessage[]): AsyncGenerator<string, void, unknown> {
    try {
      const stream = await this.client.chat.completions.create({
        model: this.model,
        messages: messages as any,
        temperature: this.temperature,
        max_tokens: this.maxTokens,
        stream: true,
      });

      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content || '';
        if (content) {
          yield content;
        }
      }
    } catch (error) {
      throw new Error(
        `Failed to stream: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  generateStreamAsReadable(messages: ChatMessage[]): Readable {
    return Readable.from(this.generateStream(messages));
  }

  buildSystemPrompt(context: string): ChatMessage {
    return {
      role: 'system',
      content: `You are an AI assistant helping to answer questions about portfolio content. 
Use the provided context to answer questions accurately and concisely.

Context:
${context}

If the context does not contain relevant information, say so clearly.
Keep responses focused and relevant to the query.`,
    };
  }

  buildUserMessage(query: string): ChatMessage {
    return {
      role: 'user',
      content: query,
    };
  }

  async getConfig(): Promise<{
    model: string;
    temperature: number;
    maxTokens: number;
  }> {
    return {
      model: this.model,
      temperature: this.temperature,
      maxTokens: this.maxTokens,
    };
  }
}

let generatorInstance: GeneratorService | null = null;

export function getGenerator(config?: GeneratorConfig): GeneratorService {
  if (!generatorInstance) {
    generatorInstance = new GeneratorService(config);
  }
  return generatorInstance;
}
