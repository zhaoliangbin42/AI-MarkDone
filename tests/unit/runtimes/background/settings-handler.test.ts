import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PROTOCOL_VERSION } from '../../../../src/contracts/protocol';
import { LEGACY_STORAGE_KEYS } from '../../../../src/contracts/storage';

function mockSyncStorage(initial: any = {}) {
    const state: Record<string, any> = { ...initial };
    const get = vi.fn(async (keys: any) => {
        if (keys === null || keys === undefined) return { ...state };
        if (typeof keys === 'string') return { [keys]: state[keys] };
        if (Array.isArray(keys)) {
            const out: Record<string, any> = {};
            for (const k of keys) out[k] = state[k];
            return out;
        }
        return { ...state };
    });
    const set = vi.fn(async (patch: any) => {
        Object.assign(state, patch || {});
    });
    const remove = vi.fn(async (keys: any) => {
        const list = Array.isArray(keys) ? keys : [keys];
        for (const k of list) delete state[k];
    });
    return { state, get, set, remove };
}

describe('background settings handler', () => {
    beforeEach(() => {
        vi.resetModules();
        vi.clearAllMocks();
        delete (globalThis as any).browser;
        delete (globalThis as any).chrome;
    });

    it('returns default settings when storage is empty', async () => {
        const sync = mockSyncStorage();
        (globalThis as any).browser = { runtime: { getManifest: () => ({ manifest_version: 3 }) }, storage: { sync } };
        (globalThis as any).chrome = undefined;

        const { handleSettingsRequest } = await import('../../../../src/runtimes/background/handlers/settings');
        const res = await handleSettingsRequest({ v: PROTOCOL_VERSION, id: 'req_1', type: 'settings:getAll' } as any);
        expect(res?.response.ok).toBe(true);
        const settings = (res?.response as any).data.settings;
        expect(settings.version).toBe(3);
    });

    it('sets and gets a category', async () => {
        const sync = mockSyncStorage();
        (globalThis as any).browser = { runtime: { getManifest: () => ({ manifest_version: 3 }) }, storage: { sync } };
        (globalThis as any).chrome = undefined;

        const { handleSettingsRequest } = await import('../../../../src/runtimes/background/handlers/settings');
        const setRes = await handleSettingsRequest({
            v: PROTOCOL_VERSION,
            id: 'req_2',
            type: 'settings:setCategory',
            payload: { category: 'behavior', value: { showWordCount: false } },
        } as any);
        expect(setRes?.response.ok).toBe(true);

        const raw = sync.state[LEGACY_STORAGE_KEYS.appSettingsKey];
        expect(raw.behavior.showWordCount).toBe(false);

        const getRes = await handleSettingsRequest({
            v: PROTOCOL_VERSION,
            id: 'req_3',
            type: 'settings:getCategory',
            payload: { category: 'behavior' },
        } as any);

        expect(getRes?.response.ok).toBe(true);
        expect((getRes?.response as any).data.value.showWordCount).toBe(false);
    });

    it('drops removed chatgpt folding fields before persisting category updates', async () => {
        const sync = mockSyncStorage({
            [LEGACY_STORAGE_KEYS.appSettingsKey]: {
                version: 3,
                platforms: { chatgpt: true, gemini: true, claude: true, deepseek: true },
                chatgpt: {
                    showFoldDock: true,
                    foldingMode: 'all',
                    defaultExpandedCount: 8,
                    enableVirtualization: false,
                },
                behavior: {
                    showSaveMessages: true,
                    showWordCount: true,
                    enableClickToCopy: true,
                    saveContextOnly: false,
                    _contextOnlyConfirmed: false,
                },
                reader: { renderCodeInReader: true },
                bookmarks: { sortMode: 'time-desc' },
                language: 'auto',
            },
        });
        (globalThis as any).browser = { runtime: { getManifest: () => ({ manifest_version: 3 }) }, storage: { sync } };
        (globalThis as any).chrome = undefined;

        const { handleSettingsRequest } = await import('../../../../src/runtimes/background/handlers/settings');
        const setRes = await handleSettingsRequest({
            v: PROTOCOL_VERSION,
            id: 'req_chatgpt_cleanup',
            type: 'settings:setCategory',
            payload: { category: 'chatgpt', value: { showConversationDirectory: false } },
        } as any);
        expect(setRes?.response.ok).toBe(true);

        const raw = sync.state[LEGACY_STORAGE_KEYS.appSettingsKey];
        expect(raw.chatgpt.showConversationDirectory).toBe(false);
        expect(raw.chatgpt).not.toHaveProperty('showFoldDock');
        expect(raw.chatgpt).not.toHaveProperty('foldingMode');
        expect(raw.chatgpt).not.toHaveProperty('defaultExpandedCount');
        expect(raw.chatgpt).not.toHaveProperty('enableVirtualization');
    });

    it('rejects legacy performance category through the protocol', async () => {
        const sync = mockSyncStorage();
        (globalThis as any).browser = { runtime: { getManifest: () => ({ manifest_version: 3 }) }, storage: { sync } };
        (globalThis as any).chrome = undefined;

        const { handleSettingsRequest } = await import('../../../../src/runtimes/background/handlers/settings');
        const setRes = await handleSettingsRequest({
            v: PROTOCOL_VERSION,
            id: 'req_legacy_set',
            type: 'settings:setCategory',
            payload: { category: 'performance', value: { chatgptFoldingMode: 'all' } },
        } as any);

        expect(setRes?.response.ok).toBe(false);
        expect((setRes?.response as any).error.code).toBe('INVALID_REQUEST');
    });
});
