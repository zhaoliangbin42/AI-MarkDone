import { logger } from '../../../core/logger';

type QueueItem<T> = {
    operation: () => Promise<T>;
    resolve: (value: T) => void;
    reject: (error: Error) => void;
};

export class AsyncQueue {
    private queue: QueueItem<unknown>[] = [];
    private processing = false;

    async enqueue<T>(operation: () => Promise<T>): Promise<T> {
        return new Promise<T>((resolve, reject) => {
            this.queue.push({
                operation,
                resolve: resolve as (value: unknown) => void,
                reject,
            });
            this.processQueue();
        });
    }

    private async processQueue(): Promise<void> {
        if (this.processing) return;
        this.processing = true;

        while (this.queue.length > 0) {
            const item = this.queue.shift();
            if (!item) continue;
            try {
                const result = await item.operation();
                item.resolve(result);
            } catch (err) {
                logger.error('[AI-MarkDone][AsyncQueue] Operation failed:', err);
                item.reject(err instanceof Error ? err : new Error(String(err)));
            }
        }

        this.processing = false;
    }
}

export const backgroundStorageQueue = new AsyncQueue();

