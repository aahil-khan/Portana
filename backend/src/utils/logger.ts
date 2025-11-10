/**
 * Structured Logging Utility for Resume Processing
 * Provides consistent logging for debugging and monitoring
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogContext {
  userId?: string;
  sessionId?: string;
  component?: string;
  requestId?: string;
  [key: string]: any;
}

export class Logger {
  constructor(private name: string) {}

  private log(level: LogLevel, message: string, context?: LogContext): void {
    const timestamp = new Date().toISOString();
    const contextStr = context ? ` [${JSON.stringify(context)}]` : '';
    const logMessage = `[${timestamp}] [${level.toUpperCase()}] [${this.name}]${contextStr} ${message}`;

    switch (level) {
      case 'debug':
        console.debug(logMessage);
        break;
      case 'info':
        console.info(logMessage);
        break;
      case 'warn':
        console.warn(logMessage);
        break;
      case 'error':
        console.error(logMessage);
        break;
    }
  }

  debug(message: string, context?: LogContext): void {
    this.log('debug', message, context);
  }

  info(message: string, context?: LogContext): void {
    this.log('info', message, context);
  }

  warn(message: string, context?: LogContext): void {
    this.log('warn', message, context);
  }

  error(message: string, context?: LogContext): void {
    this.log('error', message, context);
  }

  /**
   * Log API call metrics
   */
  logAPICall(
    endpoint: string,
    method: string,
    durationMs: number,
    status: number,
    context?: LogContext
  ): void {
    this.info(`API ${method} ${endpoint}`, {
      ...context,
      duration_ms: durationMs,
      status,
    });
  }

  /**
   * Log extraction metrics
   */
  logExtraction(
    type: string,
    itemsCount: number,
    durationMs: number,
    context?: LogContext
  ): void {
    this.info(`Extracted ${itemsCount} ${type}`, {
      ...context,
      type,
      count: itemsCount,
      duration_ms: durationMs,
    });
  }

  /**
   * Log retry attempt
   */
  logRetry(
    attempt: number,
    maxAttempts: number,
    nextDelayMs: number,
    reason: string,
    context?: LogContext
  ): void {
    this.warn(`Retrying (${attempt}/${maxAttempts})`, {
      ...context,
      attempt,
      max_attempts: maxAttempts,
      next_delay_ms: nextDelayMs,
      reason,
    });
  }
}

export function createLogger(name: string): Logger {
  return new Logger(name);
}
