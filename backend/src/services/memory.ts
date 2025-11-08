import { v4 as uuidv4 } from 'uuid';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

export interface Session {
  id: string;
  userId?: string;
  messages: ChatMessage[];
  createdAt: number;
  updatedAt: number;
  expiresAt?: number;
  metadata?: Record<string, unknown>;
}

export class MemoryService {
  private sessions = new Map<string, Session>();
  private sessionTTL = 24 * 60 * 60 * 1000;

  createSession(userId?: string, metadata?: Record<string, unknown>): Session {
    const session: Session = {
      id: uuidv4(),
      userId,
      messages: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
      expiresAt: Date.now() + this.sessionTTL,
      metadata,
    };

    this.sessions.set(session.id, session);
    return session;
  }

  getSession(sessionId: string): Session | null {
    const session = this.sessions.get(sessionId);

    if (!session) return null;

    if (session.expiresAt && Date.now() > session.expiresAt) {
      this.sessions.delete(sessionId);
      return null;
    }

    return session;
  }

  addMessage(sessionId: string, role: 'user' | 'assistant', content: string): ChatMessage {
    const session = this.getSession(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    const message: ChatMessage = {
      role,
      content,
      timestamp: Date.now(),
    };

    session.messages.push(message);
    session.updatedAt = Date.now();

    return message;
  }

  getMessages(sessionId: string, limit?: number): ChatMessage[] {
    const session = this.getSession(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    const messages = session.messages;
    return limit ? messages.slice(-limit) : messages;
  }

  getChatHistory(sessionId: string): Array<{ role: 'user' | 'assistant'; content: string }> {
    const messages = this.getMessages(sessionId);
    return messages.map((m) => ({
      role: m.role,
      content: m.content,
    }));
  }

  clearSession(sessionId: string): void {
    const session = this.getSession(sessionId);
    if (session) {
      session.messages = [];
      session.updatedAt = Date.now();
    }
  }

  deleteSession(sessionId: string): void {
    this.sessions.delete(sessionId);
  }

  getSessionStats(sessionId: string): {
    messageCount: number;
    age: number;
    remaining: number;
  } {
    const session = this.getSession(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    const now = Date.now();
    const age = now - session.createdAt;
    const remaining = (session.expiresAt || 0) - now;

    return {
      messageCount: session.messages.length,
      age,
      remaining: Math.max(0, remaining),
    };
  }

  pruneExpiredSessions(): number {
    let count = 0;
    const now = Date.now();

    for (const [sessionId, session] of this.sessions.entries()) {
      if (session.expiresAt && now > session.expiresAt) {
        this.sessions.delete(sessionId);
        count++;
      }
    }

    return count;
  }

  getSessionCount(): number {
    return this.sessions.size;
  }

  setSessionTTL(ttl: number): void {
    this.sessionTTL = ttl;
  }
}

let memoryInstance: MemoryService | null = null;

export function getMemory(): MemoryService {
  if (!memoryInstance) {
    memoryInstance = new MemoryService();
  }
  return memoryInstance;
}
