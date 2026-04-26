import { afterEach, describe, expect, it, vi } from 'vitest';

describe('brand icon source', () => {
    afterEach(() => {
        vi.resetModules();
        delete (globalThis as any).browser;
        delete (globalThis as any).chrome;
    });

    it('uses an inline data URL when Safari exposes only the browser namespace', async () => {
        (globalThis as any).browser = {
            runtime: {
                getURL: (path: string) => `safari-extension://local/${path}`,
            },
        };

        const { Icons } = await import('../../../src/assets/icons');
        const icon = Icons.createBrandIcon();

        expect(icon.src).toMatch(/^data:image\/svg\+xml,/);
        expect(icon.src).not.toContain('safari-extension://');
    });

    it('uses an inline data URL when only the chrome namespace is available', async () => {
        (globalThis as any).chrome = {
            runtime: {
                getURL: (path: string) => `chrome-extension://local/${path}`,
            },
        };

        const { Icons } = await import('../../../src/assets/icons');
        const icon = Icons.createBrandIcon();

        expect(icon.src).toMatch(/^data:image\/svg\+xml,/);
        expect(icon.src).not.toContain('chrome-extension://');
    });
});
