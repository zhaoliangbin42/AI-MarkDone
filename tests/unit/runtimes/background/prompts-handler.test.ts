import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ExtRequest } from '../../../../src/contracts/protocol';
import { DEFAULT_SETTINGS } from '../../../../src/core/settings/types';
import { LEGACY_STORAGE_KEYS, STORAGE_KEYS } from '../../../../src/contracts/storage';

type StorageMap = Record<string, any>;

function createArea(store: StorageMap) {
    return {
        get: vi.fn(async (keys?: null | string | string[] | Record<string, any>) => {
            if (keys === null || keys === undefined) return { ...store };
            if (typeof keys === 'string') return { [keys]: store[keys] };
            if (Array.isArray(keys)) {
                const result: Record<string, any> = {};
                for (const k of keys) if (Object.prototype.hasOwnProperty.call(store, k)) result[k] = store[k];
                return result;
            }
            const result: Record<string, any> = {};
            for (const [k, fallback] of Object.entries(keys)) {
                result[k] = Object.prototype.hasOwnProperty.call(store, k) ? store[k] : fallback;
            }
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
}

function req<T extends ExtRequest['type']>(type: T, payload?: any): Extract<ExtRequest, { type: T }> {
    return { v: 1, id: `t_${type}`, type, payload } as any;
}

describe('background prompts handler', () => {
    beforeEach(() => {
        vi.resetModules();
        vi.clearAllMocks();
        delete (globalThis as any).browser;
        delete (globalThis as any).chrome;
    });

    it('seeds composer prompts and migrates Reader comment prompts on first list', async () => {
        const localStore: StorageMap = {};
        const syncStore: StorageMap = {
            [LEGACY_STORAGE_KEYS.appSettingsKey]: {
                ...DEFAULT_SETTINGS,
                reader: {
                    ...DEFAULT_SETTINGS.reader,
                    commentExport: {
                        ...DEFAULT_SETTINGS.reader.commentExport,
                        prompts: [
                            { id: 'reader-a', title: 'Reader A', content: 'Reader prompt body.' },
                        ],
                    },
                },
            },
        };
        (globalThis as any).browser = {
            runtime: { getManifest: () => ({ manifest_version: 3 }) },
            storage: { local: createArea(localStore), sync: createArea(syncStore) },
        };

        const { handlePromptsRequest } = await import('../../../../src/runtimes/background/handlers/prompts');

        const composerRes = await handlePromptsRequest(req('prompts:list', { context: 'composer' }));
        expect(composerRes?.response.ok).toBe(true);
        expect((composerRes?.response as any).data.prompts.map((prompt: any) => prompt.triggerText).filter(Boolean)).toEqual([
            'humanize',
            'prompt',
            'skill',
            'translate',
        ]);

        const readerRes = await handlePromptsRequest(req('prompts:list'));
        expect(readerRes?.response.ok).toBe(true);
        const readerPrompts = (readerRes?.response as any).data.prompts;
        expect(readerPrompts).toEqual(expect.arrayContaining([
            expect.objectContaining({ id: 'reader-a', contexts: ['composer', 'readerComment'] }),
            expect.objectContaining({ id: 'composer-default-humanizer' }),
            expect.objectContaining({ id: 'composer-default-prompt-optimizer' }),
            expect.objectContaining({ id: 'composer-default-skill-creator' }),
            expect.objectContaining({ id: 'composer-default-translate' }),
        ]));
        expect(localStore[STORAGE_KEYS.promptLibraryV1].migratedReaderCommentPrompts).toBe(true);
        expect(localStore[STORAGE_KEYS.promptLibraryV1].defaultPromptSetVersion).toBe(4);
    });

    it('preserves one Reader annotation default when settings are absent', async () => {
        const localStore: StorageMap = {};
        const syncStore: StorageMap = {};
        (globalThis as any).browser = {
            runtime: { getManifest: () => ({ manifest_version: 3 }) },
            storage: { local: createArea(localStore), sync: createArea(syncStore) },
        };

        const { handlePromptsRequest } = await import('../../../../src/runtimes/background/handlers/prompts');

        await handlePromptsRequest(req('prompts:list'));

        expect(localStore[STORAGE_KEYS.promptLibraryV1].prompts.map((prompt: any) => prompt.id)).toEqual([
            'composer-default-humanizer',
            'composer-default-prompt-optimizer',
            'composer-default-skill-creator',
            'composer-default-translate',
            'prompt-2',
        ]);
    });

    it('saves, lists, records usage, and deletes prompt records', async () => {
        const localStore: StorageMap = {};
        const syncStore: StorageMap = {};
        (globalThis as any).browser = {
            runtime: { getManifest: () => ({ manifest_version: 3 }) },
            storage: { local: createArea(localStore), sync: createArea(syncStore) },
        };

        const { handlePromptsRequest } = await import('../../../../src/runtimes/background/handlers/prompts');

        const saveRes = await handlePromptsRequest(req('prompts:save', {
            prompt: {
                id: 'custom',
                title: 'Draft',
                content: 'Draft this clearly.',
                triggerText: 'draft',
                contexts: ['composer'],
                enabled: true,
            },
        }));
        expect(saveRes?.response.ok).toBe(true);
        expect((saveRes?.response as any).data.prompt.triggerText).toBe('draft');

        const listRes = await handlePromptsRequest(req('prompts:list', { context: 'composer', query: 'draft' }));
        expect((listRes?.response as any).data.prompts.map((prompt: any) => prompt.id)).toContain('custom');

        await handlePromptsRequest(req('prompts:save', {
            prompt: {
                id: 'disabled-custom',
                title: 'Disabled',
                content: 'Disabled prompt.',
                triggerText: '\\disabled',
                contexts: ['composer'],
                enabled: false,
            },
        }));
        const runtimeList = await handlePromptsRequest(req('prompts:list', { context: 'composer', query: 'disabled' }));
        expect((runtimeList?.response as any).data.prompts.map((prompt: any) => prompt.id)).not.toContain('disabled-custom');
        const managerList = await handlePromptsRequest(req('prompts:list', { context: 'composer', query: 'disabled', includeDisabled: true }));
        expect((managerList?.response as any).data.prompts.map((prompt: any) => prompt.id)).toContain('disabled-custom');

        const useRes = await handlePromptsRequest(req('prompts:recordUse', { id: 'custom', usedAt: 5000 }));
        expect(useRes?.response.ok).toBe(true);
        expect(localStore[STORAGE_KEYS.promptLibraryV1].prompts.find((prompt: any) => prompt.id === 'custom').lastUsedAt).toBe(5000);

        const deleteRes = await handlePromptsRequest(req('prompts:delete', { id: 'custom' }));
        expect(deleteRes?.response.ok).toBe(true);
        expect(localStore[STORAGE_KEYS.promptLibraryV1].prompts.some((prompt: any) => prompt.id === 'custom')).toBe(false);
    });

    it('preserves prompt order when saving existing prompts and supports explicit reorder', async () => {
        const localStore: StorageMap = {
            [STORAGE_KEYS.promptLibraryV1]: {
                version: 1,
                migratedReaderCommentPrompts: true,
                seededComposerDefaults: true,
                defaultPromptSetVersion: 4,
                prompts: [
                    {
                        id: 'first',
                        title: 'First',
                        content: 'First prompt',
                        triggerText: 'first',
                        contexts: ['composer', 'readerComment'],
                        favorite: false,
                        enabled: true,
                        createdAt: 1,
                        updatedAt: 1,
                        lastUsedAt: null,
                    },
                    {
                        id: 'second',
                        title: 'Second',
                        content: 'Second prompt',
                        triggerText: 'second',
                        contexts: ['composer', 'readerComment'],
                        favorite: false,
                        enabled: true,
                        createdAt: 2,
                        updatedAt: 2,
                        lastUsedAt: null,
                    },
                    {
                        id: 'third',
                        title: 'Third',
                        content: 'Third prompt',
                        triggerText: 'third',
                        contexts: ['composer', 'readerComment'],
                        favorite: false,
                        enabled: true,
                        createdAt: 3,
                        updatedAt: 3,
                        lastUsedAt: null,
                    },
                ],
            },
        };
        const syncStore: StorageMap = {};
        (globalThis as any).browser = {
            runtime: { getManifest: () => ({ manifest_version: 3 }) },
            storage: { local: createArea(localStore), sync: createArea(syncStore) },
        };

        const { handlePromptsRequest } = await import('../../../../src/runtimes/background/handlers/prompts');

        const saveExisting = await handlePromptsRequest(req('prompts:save', {
            prompt: {
                id: 'second',
                title: 'Second edited',
                content: 'Second prompt edited',
                triggerText: 'second',
                contexts: ['composer', 'readerComment'],
                enabled: true,
            },
        }));
        expect(saveExisting?.response.ok).toBe(true);
        expect(localStore[STORAGE_KEYS.promptLibraryV1].prompts.map((prompt: any) => prompt.id)).toEqual([
            'first',
            'second',
            'third',
        ]);

        const reorder = await handlePromptsRequest(req('prompts:reorder' as any, {
            ids: ['third', 'first', 'second'],
        }));

        expect(reorder?.response.ok).toBe(true);
        expect((reorder?.response as any).data.prompts.map((prompt: any) => prompt.id)).toEqual([
            'third',
            'first',
            'second',
        ]);
        expect(localStore[STORAGE_KEYS.promptLibraryV1].prompts.map((prompt: any) => prompt.id)).toEqual([
            'third',
            'first',
            'second',
        ]);
    });

    it('does not rewrite normalized libraries on list and records use without changing updatedAt', async () => {
        const localStore: StorageMap = {
            [STORAGE_KEYS.promptLibraryV1]: {
                version: 1,
                migratedReaderCommentPrompts: true,
                seededComposerDefaults: true,
                defaultPromptSetVersion: 4,
                prompts: [
                    {
                        id: 'stable',
                        title: 'Stable',
                        content: 'Stable prompt',
                        triggerText: 'stable',
                        contexts: ['composer', 'readerComment'],
                        favorite: false,
                        enabled: true,
                        createdAt: 10,
                        updatedAt: 20,
                        lastUsedAt: null,
                        managedDefaultId: null,
                        managedDefaultVersion: null,
                    },
                ],
            },
        };
        const syncStore: StorageMap = {};
        const localArea = createArea(localStore);
        (globalThis as any).browser = {
            runtime: { getManifest: () => ({ manifest_version: 3 }) },
            storage: { local: localArea, sync: createArea(syncStore) },
        };

        const { handlePromptsRequest } = await import('../../../../src/runtimes/background/handlers/prompts');

        const list = await handlePromptsRequest(req('prompts:list', { context: 'readerComment' }));
        expect(list?.response.ok).toBe(true);
        expect(localArea.set).not.toHaveBeenCalled();

        const useRes = await handlePromptsRequest(req('prompts:recordUse', { id: 'stable', usedAt: 5000 }));

        expect(useRes?.response.ok).toBe(true);
        expect(localArea.set).toHaveBeenCalledTimes(1);
        expect(localStore[STORAGE_KEYS.promptLibraryV1].prompts[0]).toMatchObject({
            id: 'stable',
            updatedAt: 20,
            lastUsedAt: 5000,
        });
    });

    it('rejects empty prompt content and composer trigger conflicts', async () => {
        const localStore: StorageMap = {};
        const syncStore: StorageMap = {};
        (globalThis as any).browser = {
            runtime: { getManifest: () => ({ manifest_version: 3 }) },
            storage: { local: createArea(localStore), sync: createArea(syncStore) },
        };

        const { handlePromptsRequest } = await import('../../../../src/runtimes/background/handlers/prompts');

        const empty = await handlePromptsRequest(req('prompts:save', {
            prompt: {
                id: 'empty',
                title: 'Empty',
                content: '',
                contexts: ['composer'],
            },
        }));
        expect(empty?.response.ok).toBe(false);
        expect((empty?.response as any).error.code).toBe('INVALID_REQUEST');

        await handlePromptsRequest(req('prompts:save', {
            prompt: {
                id: 'first',
                title: 'First',
                content: 'First prompt',
                triggerText: '/draft',
                contexts: ['composer'],
                enabled: true,
            },
        }));

        const conflict = await handlePromptsRequest(req('prompts:save', {
            prompt: {
                id: 'second',
                title: 'Second',
                content: 'Second prompt',
                triggerText: 'draft',
                contexts: ['composer'],
                enabled: true,
            },
        }));
        expect(conflict?.response.ok).toBe(false);
        expect((conflict?.response as any).error.code).toBe('CONFLICT');

        const readerOnly = await handlePromptsRequest(req('prompts:save', {
            prompt: {
                id: 'reader-only',
                title: 'Reader Only',
                content: 'Reader prompt',
                triggerText: '/draft',
                contexts: ['readerComment'],
                enabled: true,
            },
        }));
        expect(readerOnly?.response.ok).toBe(false);
        expect((readerOnly?.response as any).error.code).toBe('CONFLICT');
    });

    it('restoreDefaults preserves user prompts and only fills missing defaults', async () => {
        const localStore: StorageMap = {
            [STORAGE_KEYS.promptLibraryV1]: {
                version: 1,
                migratedReaderCommentPrompts: true,
                seededComposerDefaults: true,
                prompts: [
                    {
                        id: 'custom',
                        title: 'Custom',
                        content: 'Do not delete me.',
                        triggerText: 'custom',
                        contexts: ['composer', 'readerComment'],
                        favorite: false,
                        enabled: true,
                        createdAt: 1,
                        updatedAt: 1,
                        lastUsedAt: null,
                    },
                    {
                        id: 'composer-default-summarize',
                        title: 'My edited summarize',
                        content: 'Do not overwrite my edit.',
                        triggerText: '\\sum',
                        contexts: ['composer', 'readerComment'],
                        favorite: false,
                        enabled: true,
                        createdAt: 1,
                        updatedAt: 1,
                        lastUsedAt: null,
                    },
                ],
            },
        };
        const syncStore: StorageMap = {};
        (globalThis as any).browser = {
            runtime: { getManifest: () => ({ manifest_version: 3 }) },
            storage: { local: createArea(localStore), sync: createArea(syncStore) },
        };

        const { handlePromptsRequest } = await import('../../../../src/runtimes/background/handlers/prompts');

        const restore = await handlePromptsRequest(req('prompts:restoreDefaults'));

        expect(restore?.response.ok).toBe(true);
        const prompts = localStore[STORAGE_KEYS.promptLibraryV1].prompts;
        expect(prompts.find((prompt: any) => prompt.id === 'custom')?.content).toBe('Do not delete me.');
        expect(prompts.find((prompt: any) => prompt.id === 'composer-default-summarize')?.content).toBe('Do not overwrite my edit.');
        expect(prompts.map((prompt: any) => prompt.id)).toEqual(expect.arrayContaining([
            'composer-default-humanizer',
            'composer-default-prompt-optimizer',
            'composer-default-skill-creator',
            'composer-default-translate',
        ]));
    });
});
