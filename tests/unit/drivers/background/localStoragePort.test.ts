import { beforeEach, describe, expect, it, vi } from 'vitest';

type StorageMap = Record<string, any>;

function createInMemoryBrowser(store: StorageMap, options?: { withGetBytesInUse?: boolean }) {
    const local: any = {
        get: vi.fn(async (keys?: null | string | string[]) => {
            if (keys === null || keys === undefined) return { ...store };
            if (typeof keys === 'string') return { [keys]: store[keys] };
            const result: Record<string, any> = {};
            for (const k of keys) if (Object.prototype.hasOwnProperty.call(store, k)) result[k] = store[k];
            return result;
        }),
        set: vi.fn(async (patch: Record<string, any>) => {
            Object.assign(store, patch);
        }),
        remove: vi.fn(async (keys: string | string[]) => {
            const list = Array.isArray(keys) ? keys : [keys];
            for (const k of list) delete store[k];
        }),
    };

    if (options?.withGetBytesInUse) {
        local.getBytesInUse = vi.fn(async (_keys: any) => JSON.stringify(store).length);
    }

    return {
        runtime: { getManifest: () => ({ manifest_version: 3 }) },
        storage: { local },
    };
}

describe('localStoragePort', () => {
    beforeEach(() => {
        vi.resetModules();
        vi.clearAllMocks();
        delete (globalThis as any).browser;
    });

    it('falls back to JSON length estimate when getBytesInUse is unavailable', async () => {
        const store: StorageMap = { a: { x: 1 }, b: 'c' };
        (globalThis as any).browser = createInMemoryBrowser(store, { withGetBytesInUse: false });

        const { localStoragePort } = await import('../../../../src/drivers/background/storage/localStoragePort');
        const bytes = await localStoragePort.getBytesInUse(null);
        expect(bytes).toBeGreaterThan(0);
    });

    it('uses native getBytesInUse when available', async () => {
        const store: StorageMap = { a: { x: 1 }, b: 'c' };
        (globalThis as any).browser = createInMemoryBrowser(store, { withGetBytesInUse: true });

        const { localStoragePort } = await import('../../../../src/drivers/background/storage/localStoragePort');
        const bytes = await localStoragePort.getBytesInUse(null);
        expect(bytes).toBeGreaterThan(0);
        expect((globalThis as any).browser.storage.local.getBytesInUse).toHaveBeenCalled();
    });
});

