import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_SETTINGS } from '@/core/settings/types';

let storageListener: ((changes: any, areaName: string) => void) | null = null;
const sendExtRequest = vi.fn(async () => ({
    ok: true,
    data: { settings: structuredClone(DEFAULT_SETTINGS) },
}));

vi.mock('@/drivers/shared/browser', () => ({
    browser: {
        storage: {
            onChanged: {
                addListener: (listener: (changes: any, areaName: string) => void) => {
                    storageListener = listener;
                },
            },
        },
    },
}));

vi.mock('@/drivers/shared/rpc', () => ({
    sendExtRequest,
}));

describe('SettingsClient', () => {
    beforeEach(() => {
        storageListener = null;
        sendExtRequest.mockClear();
    });

    it('accepts v4 settings updates from storage change events', async () => {
        const { SettingsClient } = await import('@/drivers/content/settings/settingsClient');
        const client = new SettingsClient();
        const listener = vi.fn();

        client.subscribe(listener);
        client.init();
        await Promise.resolve();

        const next = {
            ...structuredClone(DEFAULT_SETTINGS),
            formula: {
                clickCopyMarkdown: true,
                copyMarkdownDelimiters: true,
                assetFontSizePx: 36,
                assetActions: {
                    copyPng: true,
                    copySvg: false,
                    copyMathml: true,
                    savePng: false,
                    saveSvg: false,
                },
            },
        };
        storageListener?.({ app_settings: { newValue: next } }, 'sync');

        expect(listener).toHaveBeenLastCalledWith({ settings: next });
        expect(client.getCached()?.formula.assetActions.copyPng).toBe(true);
    });

    it('normalizes legacy v3 settings updates from storage change events', async () => {
        const { SettingsClient } = await import('@/drivers/content/settings/settingsClient');
        const client = new SettingsClient();
        const listener = vi.fn();

        client.subscribe(listener);
        client.init();
        await Promise.resolve();

        storageListener?.({
            app_settings: {
                newValue: {
                    version: 3,
                    behavior: { enableClickToCopy: false },
                    formula: { clickCopyMarkdown: true },
                },
            },
        }, 'sync');

        const latest = listener.mock.calls.at(-1)?.[0]?.settings;
        expect(latest.version).toBe(4);
        expect(latest.formula.clickCopyMarkdown).toBe(true);
        expect(latest.formula.assetActions).toEqual({
            copyPng: false,
            copySvg: false,
            copyMathml: false,
            savePng: false,
            saveSvg: false,
        });
        expect(latest.formula.assetFontSizePx).toBe(36);
    });

    it('returns normalized settings from refresh', async () => {
        sendExtRequest.mockResolvedValueOnce({
            ok: true,
            data: {
                settings: {
                    version: 3,
                    behavior: { enableClickToCopy: false },
                },
            },
        });
        const { SettingsClient } = await import('@/drivers/content/settings/settingsClient');
        const client = new SettingsClient();

        const settings = await client.refresh();

        expect(settings?.version).toBe(4);
        expect(settings?.formula.clickCopyMarkdown).toBe(false);
        expect(settings?.formula.assetActions.copyPng).toBe(false);
        expect(settings?.formula.assetFontSizePx).toBe(36);
    });
});
