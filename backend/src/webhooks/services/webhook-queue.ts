import { v4 as uuidv4 } from 'uuid';

export interface QueuedItem {
  id: string;
  payload: Record<string, unknown>;
  retries: number;
  nextRetryAt: number;
  error?: string;
  lastError?: string;
  createdAt: number;
}

export interface DLQItem extends QueuedItem {
  failedAt: number;
  finalError: string;
}

export type WebhookProcessor = (payload: Record<string, unknown>) => Promise<void>;

export class WebhookQueueService {
  private static instance: WebhookQueueService;
  private queue: Map<string, QueuedItem> = new Map();
  private dlq: Map<string, DLQItem> = new Map();
  private maxRetries: number = 3;
  private backoffDelays = [0, 1000, 5000, 30000];
  private processor: WebhookProcessor | null = null;
  private processingInterval: ReturnType<typeof setInterval> | null = null;

  private constructor() {}

  static getInstance(): WebhookQueueService {
    if (!WebhookQueueService.instance) {
      WebhookQueueService.instance = new WebhookQueueService();
    }
    return WebhookQueueService.instance;
  }

  setProcessor(processor: WebhookProcessor): void {
    this.processor = processor;
  }

  setMaxRetries(maxRetries: number): void {
    this.maxRetries = maxRetries;
  }

  addToQueue(payload: Record<string, unknown>): string {
    const id = uuidv4();
    const item: QueuedItem = {
      id,
      payload,
      retries: 0,
      nextRetryAt: Date.now(),
      createdAt: Date.now(),
    };
    this.queue.set(id, item);
    return id;
  }

  getQueueItem(id: string): QueuedItem | undefined {
    return this.queue.get(id);
  }

  async processQueue(): Promise<{ successful: number; failed: number }> {
    if (!this.processor) {
      return { successful: 0, failed: 0 };
    }

    const now = Date.now();
    const itemsToProcess: [string, QueuedItem][] = [];

    for (const [id, item] of this.queue.entries()) {
      if (item.nextRetryAt <= now) {
        itemsToProcess.push([id, item]);
      }
    }

    if (itemsToProcess.length === 0) {
      return { successful: 0, failed: 0 };
    }

    const results = await Promise.allSettled(
      itemsToProcess.map(([_, item]) => this.processor!(item.payload))
    );

    let successful = 0;
    let failed = 0;

    for (let i = 0; i < itemsToProcess.length; i++) {
      const [id, item] = itemsToProcess[i];
      const result = results[i];

      if (result.status === 'fulfilled') {
        this.queue.delete(id);
        successful++;
      } else {
        item.retries++;
        item.lastError = result.reason?.message || String(result.reason);

        if (item.retries >= this.maxRetries) {
          this.moveToDeadLetterQueue(id, item);
          failed++;
        } else {
          const delayIndex = Math.min(item.retries, this.backoffDelays.length - 1);
          item.nextRetryAt = now + this.backoffDelays[delayIndex];
        }
      }
    }

    return { successful, failed };
  }

  private moveToDeadLetterQueue(id: string, item: QueuedItem): void {
    this.queue.delete(id);
    const dlqItem: DLQItem = {
      ...item,
      failedAt: Date.now(),
      finalError: item.lastError || 'Unknown error',
    };
    this.dlq.set(id, dlqItem);
  }

  getDeadLetterQueue(): DLQItem[] {
    return Array.from(this.dlq.values());
  }

  getDLQItem(id: string): DLQItem | undefined {
    return this.dlq.get(id);
  }

  retryFromDLQ(id: string): boolean {
    const dlqItem = this.dlq.get(id);
    if (!dlqItem) {
      return false;
    }

    this.dlq.delete(id);
    const queueItem: QueuedItem = {
      id: dlqItem.id,
      payload: dlqItem.payload,
      retries: 0,
      nextRetryAt: Date.now(),
      createdAt: dlqItem.createdAt,
    };
    this.queue.set(id, queueItem);
    return true;
  }

  startProcessing(intervalMs: number = 5 * 60 * 1000): void {
    if (this.processingInterval) {
      return;
    }

    this.processingInterval = setInterval(async () => {
      await this.processQueue();
    }, intervalMs);
  }

  stopProcessing(): void {
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = null;
    }
  }

  getStats() {
    return {
      queueSize: this.queue.size,
      dlqSize: this.dlq.size,
      totalAttempts: Array.from(this.queue.values()).reduce(
        (sum, item) => sum + item.retries,
        0
      ),
      isProcessing: this.processingInterval !== null,
    };
  }

  clear(): void {
    this.queue.clear();
    this.dlq.clear();
  }

  getQueuedItems(): QueuedItem[] {
    return Array.from(this.queue.values());
  }
}

export default WebhookQueueService.getInstance();
