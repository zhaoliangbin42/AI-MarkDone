import { describe, expect, it, vi } from 'vitest';
import { beforeEach } from 'vitest';

describe('syncStoragePort.getBytesInUse fallback', () => {
    beforeEach(() => {
        vi.resetModules();
        vi.clearAllMocks();
        delete (globalThis as any).browser;
        delete (globalThis as any).chrome;
    });

    it('estimates bytes when getBytesInUse is unavailable', async () => {
        const sync: any = {
            get: vi.fn(async () => ({ a: { x: 1, y: 2 } })),
            set: vi.fn(async () => { }),
            remove: vi.fn(async () => { }),
        };

        (globalThis as any).browser = { runtime: { getManifest: () => ({ manifest_version: 3 }) }, storage: { sync } };
        (globalThis as any).chrome = undefined;

        const { syncStoragePort } = await import('../../../../src/drivers/background/storage/syncStoragePort');
        const bytes = await syncStoragePort.getBytesInUse(null);
        expect(bytes).toBeGreaterThan(0);
    });
});
