import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
    BRIDGE_BOOTSTRAP_SCRIPT,
    CONTENT_ENTRY_SCRIPT,
    injectIntoOpenSupportedTabs,
    type MidSessionInjectionApis,
} from '@/runtimes/background/midSessionInjection';

vi.mock('@/drivers/shared/browser', () => ({
    browser: {
        tabs: {
            query: vi.fn(async () => []),
        },
    },
}));

function createApis(overrides: Partial<MidSessionInjectionApis> = {}): MidSessionInjectionApis & {
    querySupportedTabs: ReturnType<typeof vi.fn>;
    hasLiveContentRuntime: ReturnType<typeof vi.fn>;
    injectFiles: ReturnType<typeof vi.fn>;
} {
    return {
        querySupportedTabs: vi.fn(async () => []),
        hasLiveContentRuntime: vi.fn(async () => false),
        injectFiles: vi.fn(async () => undefined),
        ...overrides,
    } as never;
}

describe('mid-session injection', () => {
    beforeEach(() => {
        vi.resetModules();
        vi.clearAllMocks();
    });

    it('injects bootstrap then content entry only into tabs without a live runtime', async () => {
        const apis = createApis({
            querySupportedTabs: vi.fn(async () => [
                { id: 1 },
                { id: 2 },
                { id: 3 },
            ]),
            hasLiveContentRuntime: vi.fn(async (tabId: number) => tabId === 2),
        });

        const injected = await injectIntoOpenSupportedTabs(apis);

        expect(injected).toBe(2);
        expect(apis.injectFiles).toHaveBeenCalledTimes(2);
        expect(apis.injectFiles).toHaveBeenCalledWith(1, [BRIDGE_BOOTSTRAP_SCRIPT, CONTENT_ENTRY_SCRIPT]);
        expect(apis.injectFiles).toHaveBeenCalledWith(3, [BRIDGE_BOOTSTRAP_SCRIPT, CONTENT_ENTRY_SCRIPT]);
        expect(apis.hasLiveContentRuntime).toHaveBeenCalledTimes(3);
    });

    it('skips tabs whose injection fails and keeps the rest going', async () => {
        const apis = createApis({
            querySupportedTabs: vi.fn(async () => [{ id: 1 }, { id: 2 }]),
            injectFiles: vi.fn(async (tabId: number) => {
                if (tabId === 1) throw new Error('No tab with id: 1.');
            }),
        });

        const injected = await injectIntoOpenSupportedTabs(apis);

        expect(injected).toBe(1);
        expect(apis.injectFiles).toHaveBeenCalledTimes(2);
    });

    it('serializes concurrent calls so install and startup cannot double-inject', async () => {
        let running = 0;
        let peak = 0;
        const apis = createApis({
            querySupportedTabs: vi.fn(async () => [{ id: 1 }]),
            injectFiles: vi.fn(async () => {
                running += 1;
                peak = Math.max(peak, running);
                await new Promise((resolve) => setTimeout(resolve, 5));
                running -= 1;
            }),
        });

        const [first, second] = await Promise.all([
            injectIntoOpenSupportedTabs(apis),
            injectIntoOpenSupportedTabs(apis),
        ]);

        expect(first).toBe(1);
        expect(second).toBe(1);
        expect(apis.querySupportedTabs).toHaveBeenCalledTimes(1);
        expect(apis.injectFiles).toHaveBeenCalledTimes(1);
        expect(peak).toBe(1);
    });

    it('resolves zero when no platform injection APIs are available', async () => {
        await expect(injectIntoOpenSupportedTabs(null)).resolves.toBe(0);

        // Without a tabs.query surface (for example a background runtime that
        // never exposed tabs), the production adapter declines to inject.
        const { browser } = await import('@/drivers/shared/browser');
        (browser as any).tabs.query = undefined;
        const { createProductionMidSessionInjectionApis } = await import('@/runtimes/background/midSessionInjection');
        expect(createProductionMidSessionInjectionApis()).toBeNull();
    });
});
