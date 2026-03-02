import { browser } from '../../shared/browser';
import { logger } from '../../../core/logger';

export type StorageKeys = null | string | string[] | Record<string, unknown>;

function estimateBytes(value: unknown): number {
    try {
        return JSON.stringify(value).length;
    } catch {
        return 0;
    }
}

export const syncStoragePort = {
    async get(keys: StorageKeys = null): Promise<Record<string, unknown>> {
        const result = await browser.storage.sync.get(keys as any);
        return (result || {}) as Record<string, unknown>;
    },

    async set(patch: Record<string, unknown>): Promise<void> {
        await browser.storage.sync.set(patch as any);
    },

    async remove(keys: string | string[]): Promise<void> {
        await browser.storage.sync.remove(keys as any);
    },

    async getBytesInUse(keys: null | string | string[] = null): Promise<number> {
        const area: any = browser.storage.sync as any;
        const fn = area?.getBytesInUse;
        if (typeof fn === 'function') {
            try {
                return await fn.call(area, keys);
            } catch (err) {
                logger.warn('[AI-MarkDone][SyncStoragePort] getBytesInUse failed, falling back to estimate:', err);
            }
        }

        const values = await this.get(keys as any);
        return estimateBytes(values);
    },
};

