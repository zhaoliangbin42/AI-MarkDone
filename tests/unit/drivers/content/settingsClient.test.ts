import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_SETTINGS } from '@/core/settings/types';

let storageListener: ((changes: any, areaName: string) => void) | null = null;
const sendExtRequest = vi.fn(async (request: any) => ({
    kind: 'response',
    response: {
        v: 1,
        id: request.id,
        type: request.type,
        ok: true,
        data: { settings: structuredClone(DEFAULT_SETTINGS) },
    },
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

    it('accepts current settings updates from storage change events', async () => {
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
                clickCopyFormulaFormat: 'markdown-dollar',
                markdownCopyFormulaFormat: 'markdown-dollar',
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
        expect(latest.version).toBe(5);
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
            kind: 'response',
            response: {
                v: 1,
                id: 'settings-request',
                type: 'settings:getAll',
                ok: true,
                data: {
                    settings: {
                        version: 3,
                        behavior: { enableClickToCopy: false },
                    },
                },
            },
        } as any);
        const { SettingsClient } = await import('@/drivers/content/settings/settingsClient');
        const client = new SettingsClient();

        const settings = await client.refresh();

        expect(settings?.version).toBe(5);
        expect(settings?.formula.clickCopyMarkdown).toBe(false);
        expect(settings?.formula.assetActions.copyPng).toBe(false);
        expect(settings?.formula.assetFontSizePx).toBe(36);
    });

    it('retries initial hydration once so persisted settings are applied after a transient startup failure', async () => {
        vi.useFakeTimers();
        try {
            const persisted = structuredClone(DEFAULT_SETTINGS);
            persisted.chatgptBehavior.pageWidthScale = 145;
            sendExtRequest
                .mockResolvedValueOnce({
                    kind: 'transport-failure',
                    failure: {
                        code: 'RECEIVER_UNAVAILABLE',
                        message: 'Background is not ready yet.',
                        delivery: 'unknown',
                    },
                } as any)
                .mockResolvedValueOnce({
                    kind: 'response',
                    response: {
                        v: 1,
                        id: 'settings-request-retry',
                        type: 'settings:getAll',
                        ok: true,
                        data: { settings: persisted },
                    },
                } as any);

            const { SettingsClient } = await import('@/drivers/content/settings/settingsClient');
            const client = new SettingsClient();
            const listener = vi.fn();
            client.subscribe(listener);

            const ready = client.init();
            await vi.advanceTimersByTimeAsync(500);

            await expect(ready).resolves.toEqual(persisted);
            expect(sendExtRequest).toHaveBeenCalledTimes(2);
            expect(listener).toHaveBeenLastCalledWith({ settings: persisted });
            expect(client.getCached()?.chatgptBehavior.pageWidthScale).toBe(145);
        } finally {
            vi.useRealTimers();
        }
    });

    it('preserves transport failure details when a category write is not confirmed', async () => {
        sendExtRequest.mockResolvedValueOnce({
            kind: 'transport-failure',
            failure: {
                code: 'CONTEXT_INVALIDATED',
                message: 'Extension context invalidated.',
                delivery: 'not-sent',
            },
        } as any);
        const { SettingsClient } = await import('@/drivers/content/settings/settingsClient');
        const client = new SettingsClient();

        const result = await client.setCategoryResult('reader', { showOutlineInReader: false });

        expect(result).toEqual(expect.objectContaining({
            ok: false,
            errorCode: 'CONTEXT_INVALIDATED',
            failure: expect.objectContaining({
                kind: 'transport',
                code: 'CONTEXT_INVALIDATED',
                delivery: 'not-sent',
            }),
        }));
    });

    it('rejects a successful category response whose payload is missing the canonical value', async () => {
        sendExtRequest.mockImplementationOnce(async (request: any) => ({
            kind: 'response',
            response: {
                v: 1,
                id: request.id,
                type: request.type,
                ok: true,
                data: {},
            },
        }));
        const { SettingsClient } = await import('@/drivers/content/settings/settingsClient');

        const result = await new SettingsClient().getCategoryResult('reader');

        expect(result).toEqual(expect.objectContaining({
            ok: false,
            errorCode: 'INVALID_RESPONSE',
            failure: expect.objectContaining({ kind: 'transport', code: 'INVALID_RESPONSE' }),
        }));
    });

    it('rejects category reads and writes acknowledged for a different category', async () => {
        sendExtRequest.mockImplementation(async (request: any) => ({
            kind: 'response',
            response: {
                v: 1,
                id: request.id,
                type: request.type,
                ok: true,
                data: request.type === 'settings:getCategory'
                    ? { category: 'formula', value: structuredClone(DEFAULT_SETTINGS.reader) }
                    : { category: 'formula' },
            },
        }));
        const { SettingsClient } = await import('@/drivers/content/settings/settingsClient');
        const client = new SettingsClient();

        await expect(client.getCategoryResult('reader')).resolves.toMatchObject({ ok: false, errorCode: 'INVALID_RESPONSE' });
        await expect(client.setCategoryResult('reader', DEFAULT_SETTINGS.reader)).resolves.toMatchObject({ ok: false, errorCode: 'INVALID_RESPONSE' });
    });
});
