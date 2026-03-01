import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ExtRequest } from '../../../../src/contracts/protocol';

type StorageMap = Record<string, any>;

function createInMemoryBrowser(store: StorageMap) {
    const local = {
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
        getBytesInUse: vi.fn(async (_keys: any) => JSON.stringify(store).length),
    };

    return {
        runtime: { getManifest: () => ({ manifest_version: 3 }) },
        storage: { local },
    };
}

function req<T extends ExtRequest['type']>(type: T, payload?: any): Extract<ExtRequest, { type: T }> {
    return { v: 1, id: `t_${type}`, type, payload } as any;
}

describe('background bookmarks handler', () => {
    beforeEach(() => {
        vi.resetModules();
        vi.clearAllMocks();
        delete (globalThis as any).browser;
        delete (globalThis as any).chrome;
    });

    it('saves and lists bookmarks using legacy key schema + index', async () => {
        const store: StorageMap = {};
        (globalThis as any).browser = createInMemoryBrowser(store);

        const { handleBookmarksRequest } = await import('../../../../src/runtimes/background/handlers/bookmarks');

        const saveRes = await handleBookmarksRequest(req('bookmarks:save', {
            url: 'https://chatgpt.com/c/1',
            position: 1,
            userMessage: 'u',
            aiResponse: 'a',
            title: 'T',
            platform: 'ChatGPT',
            folderPath: 'Import',
            options: { saveContextOnly: false },
        }));
        expect(saveRes?.response.ok).toBe(true);

        const listRes = await handleBookmarksRequest(req('bookmarks:list', { sortMode: 'time-desc' }));
        expect(listRes?.response.ok).toBe(true);
        const data: any = (listRes as any).response.data;
        expect(data.bookmarks).toHaveLength(1);
        expect(Object.keys(store).some((k) => k.startsWith('bookmark:chatgpt.com/c/1:1'))).toBe(true);
        expect(Array.isArray(store['aimd:bookmarks:index:v1'])).toBe(true);
    });

    it('repairs corrupted records and quarantines before removal', async () => {
        const store: StorageMap = {
            'bookmark:chatgpt.com/c/bad:1': 'corrupted',
        };
        (globalThis as any).browser = createInMemoryBrowser(store);

        const { handleBookmarksRequest } = await import('../../../../src/runtimes/background/handlers/bookmarks');

        const res = await handleBookmarksRequest(req('bookmarks:repair'));
        expect(res?.response.ok).toBe(true);
        expect(Object.keys(store).some((k) => k.startsWith('aimd:bookmarks:quarantine:v1:'))).toBe(true);
        expect(store['bookmark:chatgpt.com/c/bad:1']).toBeUndefined();
    });

    it('rejects folder rename with invalid name segment', async () => {
        const store: StorageMap = {
            folderPaths: ['A'],
            'folder:A': { path: 'A', name: 'A', depth: 1, createdAt: 1, updatedAt: 1 },
        };
        (globalThis as any).browser = createInMemoryBrowser(store);

        const { handleBookmarksRequest } = await import('../../../../src/runtimes/background/handlers/bookmarks');

        const res = await handleBookmarksRequest(req('bookmarks:folders:rename', { oldPath: 'A', newName: 'X/Y' }));
        expect(res?.response.ok).toBe(false);
        expect((res as any).response.error.code).toBe('INVALID_PATH');
    });

    it('prevents moving a folder into its own descendant', async () => {
        const store: StorageMap = {
            folderPaths: ['A', 'A/B'],
            'folder:A': { path: 'A', name: 'A', depth: 1, createdAt: 1, updatedAt: 1 },
            'folder:A/B': { path: 'A/B', name: 'B', depth: 2, createdAt: 1, updatedAt: 1 },
        };
        (globalThis as any).browser = createInMemoryBrowser(store);

        const { handleBookmarksRequest } = await import('../../../../src/runtimes/background/handlers/bookmarks');

        const res = await handleBookmarksRequest(req('bookmarks:folders:move', { sourcePath: 'A', targetParentPath: 'A/B' }));
        expect(res?.response.ok).toBe(false);
        expect((res as any).response.error.code).toBe('INVALID_PATH');
    });

    it('blocks folder deletion when descendant bookmarks exist (even if folder records are missing)', async () => {
        const store: StorageMap = {
            folderPaths: ['Work'],
            'folder:Work': { path: 'Work', name: 'Work', depth: 1, createdAt: 1, updatedAt: 1 },
            'bookmark:chatgpt.com/c/1:1': {
                url: 'https://chatgpt.com/c/1',
                urlWithoutProtocol: 'chatgpt.com/c/1',
                position: 1,
                userMessage: 'u',
                aiResponse: 'a',
                timestamp: 1,
                title: 'T',
                platform: 'ChatGPT',
                folderPath: 'Work/Sub',
            },
        };
        (globalThis as any).browser = createInMemoryBrowser(store);

        const { handleBookmarksRequest } = await import('../../../../src/runtimes/background/handlers/bookmarks');

        const res = await handleBookmarksRequest(req('bookmarks:folders:delete', { path: 'Work' }));
        expect(res?.response.ok).toBe(false);
        expect((res as any).response.error.code).toBe('CONFLICT');
    });

    it('moves folder subtree and updates affected bookmark folderPath', async () => {
        const store: StorageMap = {
            folderPaths: ['A', 'A/B'],
            'folder:A': { path: 'A', name: 'A', depth: 1, createdAt: 1, updatedAt: 1 },
            'folder:A/B': { path: 'A/B', name: 'B', depth: 2, createdAt: 1, updatedAt: 1 },
            'bookmark:chatgpt.com/c/1:1': {
                url: 'https://chatgpt.com/c/1',
                urlWithoutProtocol: 'chatgpt.com/c/1',
                position: 1,
                userMessage: 'u',
                aiResponse: 'a',
                timestamp: 1,
                title: 'T',
                platform: 'ChatGPT',
                folderPath: 'A/B',
            },
            'aimd:bookmarks:index:v1': ['bookmark:chatgpt.com/c/1:1'],
        };
        (globalThis as any).browser = createInMemoryBrowser(store);

        const { handleBookmarksRequest } = await import('../../../../src/runtimes/background/handlers/bookmarks');

        const res = await handleBookmarksRequest(req('bookmarks:folders:move', { sourcePath: 'A/B', targetParentPath: '' }));
        expect(res?.response.ok).toBe(true);
        expect(store.folderPaths).toEqual(['A', 'B']);
        expect(store['folder:B']).toBeTruthy();
        expect(store['folder:A/B']).toBeUndefined();
        expect(store['bookmark:chatgpt.com/c/1:1'].folderPath).toBe('B');
        expect(store['aimd:bookmarks:journal:v1']).toBeUndefined();
    });

    it('returns positions snapshot for a conversation url', async () => {
        const store: StorageMap = {};
        (globalThis as any).browser = createInMemoryBrowser(store);

        const { handleBookmarksRequest } = await import('../../../../src/runtimes/background/handlers/bookmarks');

        await handleBookmarksRequest(req('bookmarks:save', {
            url: 'https://chatgpt.com/c/1',
            position: 2,
            userMessage: 'u2',
            aiResponse: 'a2',
            platform: 'ChatGPT',
            folderPath: 'Import',
            options: { saveContextOnly: false },
        }));
        await handleBookmarksRequest(req('bookmarks:save', {
            url: 'https://chatgpt.com/c/1',
            position: 1,
            userMessage: 'u1',
            aiResponse: 'a1',
            platform: 'ChatGPT',
            folderPath: 'Import',
            options: { saveContextOnly: false },
        }));
        await handleBookmarksRequest(req('bookmarks:save', {
            url: 'https://chatgpt.com/c/2',
            position: 1,
            userMessage: 'u',
            aiResponse: 'a',
            platform: 'ChatGPT',
            folderPath: 'Import',
            options: { saveContextOnly: false },
        }));

        const res = await handleBookmarksRequest(req('bookmarks:positions', { url: 'https://chatgpt.com/c/1' }));
        expect(res?.response.ok).toBe(true);
        expect((res as any).response.data.positions).toEqual([1, 2]);
    });

    it('supports bulk remove and keeps index consistent', async () => {
        const store: StorageMap = {};
        (globalThis as any).browser = createInMemoryBrowser(store);

        const { handleBookmarksRequest } = await import('../../../../src/runtimes/background/handlers/bookmarks');

        await handleBookmarksRequest(req('bookmarks:save', {
            url: 'https://chatgpt.com/c/1',
            position: 1,
            userMessage: 'u',
            aiResponse: 'a',
            platform: 'ChatGPT',
            folderPath: 'Import',
            options: { saveContextOnly: false },
        }));
        await handleBookmarksRequest(req('bookmarks:save', {
            url: 'https://chatgpt.com/c/1',
            position: 2,
            userMessage: 'u',
            aiResponse: 'a',
            platform: 'ChatGPT',
            folderPath: 'Import',
            options: { saveContextOnly: false },
        }));

        const bulk = await handleBookmarksRequest(req('bookmarks:bulkRemove', {
            items: [{ url: 'https://chatgpt.com/c/1', position: 2 }],
        }));
        expect(bulk?.response.ok).toBe(true);
        expect(store['bookmark:chatgpt.com/c/1:2']).toBeUndefined();
        expect(store['aimd:bookmarks:index:v1']).toEqual(['bookmark:chatgpt.com/c/1:1']);
    });

    it('supports bulk move and exportSelected', async () => {
        const store: StorageMap = {
            folderPaths: ['Import', 'Work'],
            'folder:Import': { path: 'Import', name: 'Import', depth: 1, createdAt: 1, updatedAt: 1 },
            'folder:Work': { path: 'Work', name: 'Work', depth: 1, createdAt: 1, updatedAt: 1 },
        };
        (globalThis as any).browser = createInMemoryBrowser(store);

        const { handleBookmarksRequest } = await import('../../../../src/runtimes/background/handlers/bookmarks');

        await handleBookmarksRequest(req('bookmarks:save', {
            url: 'https://chatgpt.com/c/1',
            position: 1,
            userMessage: 'u1',
            aiResponse: 'a1',
            platform: 'ChatGPT',
            folderPath: 'Import',
            options: { saveContextOnly: false },
        }));
        await handleBookmarksRequest(req('bookmarks:save', {
            url: 'https://chatgpt.com/c/1',
            position: 2,
            userMessage: 'u2',
            aiResponse: 'a2',
            platform: 'ChatGPT',
            folderPath: 'Import',
            options: { saveContextOnly: false },
        }));

        const move = await handleBookmarksRequest(req('bookmarks:bulkMove', {
            items: [{ url: 'https://chatgpt.com/c/1', position: 2 }],
            targetFolderPath: 'Work',
        }));
        expect(move?.response.ok).toBe(true);
        expect(store['bookmark:chatgpt.com/c/1:2'].folderPath).toBe('Work');

        const exported = await handleBookmarksRequest(req('bookmarks:exportSelected', {
            items: [{ url: 'https://chatgpt.com/c/1', position: 2 }],
            preserveStructure: true,
        }));
        expect(exported?.response.ok).toBe(true);
        const payload = (exported as any).response.data.payload;
        expect(payload.version).toBe('2.0');
        expect(payload.bookmarks).toHaveLength(1);
        expect(payload.bookmarks[0].position).toBe(2);
    });
});
