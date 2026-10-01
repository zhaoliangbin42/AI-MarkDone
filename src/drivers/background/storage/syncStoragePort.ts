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
    async assertValueFits(key: string, value: unknown): Promise<void> {
        const area = browser.storage.sync as typeof browser.storage.sync & { QUOTA_BYTES_PER_ITEM?: number; QUOTA_BYTES?: number };
        const bytes = new TextEncoder().encode(key).length + new TextEncoder().encode(JSON.stringify(value)).length;
        if (typeof area.QUOTA_BYTES_PER_ITEM === 'number' && bytes > area.QUOTA_BYTES_PER_ITEM) throw new Error('QUOTA_EXCEEDED');
        if (typeof area.QUOTA_BYTES === 'number' && typeof area.getBytesInUse === 'function') {
            const [used, replaced] = await Promise.all([area.getBytesInUse(null), area.getBytesInUse(key)]);
            if (used - replaced + bytes > area.QUOTA_BYTES) throw new Error('QUOTA_EXCEEDED');
        }
    },
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
