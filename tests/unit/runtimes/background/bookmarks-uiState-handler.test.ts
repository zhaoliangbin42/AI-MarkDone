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

describe('background bookmarks uiState handler', () => {
    beforeEach(() => {
        vi.resetModules();
        vi.clearAllMocks();
        delete (globalThis as any).browser;
        delete (globalThis as any).chrome;
    });

    it('gets/sets/removes lastSelectedFolderPath', async () => {
        const store: StorageMap = {};
        (globalThis as any).browser = createInMemoryBrowser(store);

        const { handleBookmarksRequest } = await import('../../../../src/runtimes/background/handlers/bookmarks');

        const setRes = await handleBookmarksRequest(req('bookmarks:uiState:set', {
            key: 'lastSelectedFolderPath',
            value: 'Work/Sub',
        }));
        expect(setRes?.response.ok).toBe(true);
        expect(store.lastSelectedFolderPath).toBe('Work/Sub');

        const getRes = await handleBookmarksRequest(req('bookmarks:uiState:get', { key: 'lastSelectedFolderPath' }));
        expect(getRes?.response.ok).toBe(true);
        expect((getRes as any).response.data.value).toBe('Work/Sub');

        const clearRes = await handleBookmarksRequest(req('bookmarks:uiState:set', { key: 'lastSelectedFolderPath', value: null }));
        expect(clearRes?.response.ok).toBe(true);
        expect(store.lastSelectedFolderPath).toBeUndefined();
    });

    it('rejects invalid folder path values', async () => {
        const store: StorageMap = {};
        (globalThis as any).browser = createInMemoryBrowser(store);

        const { handleBookmarksRequest } = await import('../../../../src/runtimes/background/handlers/bookmarks');

        const res = await handleBookmarksRequest(req('bookmarks:uiState:set', { key: 'lastSelectedFolderPath', value: 'A/../B' }));
        expect(res?.response.ok).toBe(false);
        expect((res as any).response.error.code).toBe('INVALID_PATH');
    });

    it('updates lastSelectedFolderPath on folder relocate (rename/move)', async () => {
        const store: StorageMap = {
            folderPaths: ['A', 'A/B'],
            'folder:A': { path: 'A', name: 'A', depth: 1, createdAt: 1, updatedAt: 1 },
            'folder:A/B': { path: 'A/B', name: 'B', depth: 2, createdAt: 1, updatedAt: 1 },
            lastSelectedFolderPath: 'A/B',
            'aimd:bookmarks:index:v1': [],
        };
        (globalThis as any).browser = createInMemoryBrowser(store);

        const { handleBookmarksRequest } = await import('../../../../src/runtimes/background/handlers/bookmarks');

        const res = await handleBookmarksRequest(req('bookmarks:folders:move', { sourcePath: 'A/B', targetParentPath: '' }));
        expect(res?.response.ok).toBe(true);
        expect(store.lastSelectedFolderPath).toBe('B');
    });

    it('parents or clears lastSelectedFolderPath on folder delete', async () => {
        const store: StorageMap = {
            folderPaths: ['A', 'A/B'],
            'folder:A': { path: 'A', name: 'A', depth: 1, createdAt: 1, updatedAt: 1 },
            'folder:A/B': { path: 'A/B', name: 'B', depth: 2, createdAt: 1, updatedAt: 1 },
            lastSelectedFolderPath: 'A/B',
            'aimd:bookmarks:index:v1': [],
        };
        (globalThis as any).browser = createInMemoryBrowser(store);

        const { handleBookmarksRequest } = await import('../../../../src/runtimes/background/handlers/bookmarks');

        const res = await handleBookmarksRequest(req('bookmarks:folders:delete', { path: 'A/B' }));
        expect(res?.response.ok).toBe(true);
        expect(store.lastSelectedFolderPath).toBe('A');
    });
});

