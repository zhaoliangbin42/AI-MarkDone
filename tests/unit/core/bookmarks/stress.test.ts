import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';

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

function req(type: string, payload?: any): any {
    return { v: 1, id: `stress_${type}_${Date.now().toString(16)}`, type, payload };
}

describe('bookmarks stress', () => {
    it(
        'imports a 3000-bookmark fixture and keeps index/export/repair consistent',
        async () => {
            vi.resetModules();
            const store: StorageMap = {};
            (globalThis as any).browser = createInMemoryBrowser(store);
            delete (globalThis as any).chrome;

            const { handleBookmarksRequest } = await import('../../../../src/runtimes/background/handlers/bookmarks');

            const jsonText = readFileSync('tests/fixtures/bookmarks/bookmarks-3000.json', 'utf-8');
            const importRes = await handleBookmarksRequest(
                req('bookmarks:import', { jsonText, options: { saveContextOnly: true } })
            );

            expect(importRes?.response.ok).toBe(true);
            const imported = (importRes as any).response.data.imported as number;
            expect(imported).toBeGreaterThan(0);
            expect(Array.isArray(store['aimd:bookmarks:index:v1'])).toBe(true);

            const listRes = await handleBookmarksRequest(req('bookmarks:list', { sortMode: 'time-desc' }));
            expect(listRes?.response.ok).toBe(true);
            expect((listRes as any).response.data.bookmarks).toHaveLength(imported);

            const exportRes = await handleBookmarksRequest(req('bookmarks:export', { preserveStructure: true }));
            expect(exportRes?.response.ok).toBe(true);
            expect((exportRes as any).response.data.payload.version).toBe('2.0');

            store['bookmark:stress.invalid:1'] = 'corrupted';
            const repairRes = await handleBookmarksRequest(req('bookmarks:repair'));
            expect(repairRes?.response.ok).toBe(true);
            expect(Object.keys(store).some((k) => k.startsWith('aimd:bookmarks:quarantine:v1:'))).toBe(true);
        },
        30_000
    );

    it(
        'relocates a folder subtree with 3000 bookmarks without leaving journal residue',
        async () => {
            vi.resetModules();
            const store: StorageMap = {};
            (globalThis as any).browser = createInMemoryBrowser(store);
            delete (globalThis as any).chrome;

            const { handleBookmarksRequest } = await import('../../../../src/runtimes/background/handlers/bookmarks');

            store.folderPaths = ['Import', 'A', 'A/B'];
            store['folder:Import'] = { path: 'Import', name: 'Import', depth: 1, createdAt: 1, updatedAt: 1 };
            store['folder:A'] = { path: 'A', name: 'A', depth: 1, createdAt: 1, updatedAt: 1 };
            store['folder:A/B'] = { path: 'A/B', name: 'B', depth: 2, createdAt: 1, updatedAt: 1 };

            const index: string[] = [];
            for (let i = 0; i < 3000; i++) {
                const url = `https://example.com/c/${i}`;
                const urlWithoutProtocol = `example.com/c/${i}`;
                const position = i;
                const key = `bookmark:${urlWithoutProtocol}:${position}`;
                store[key] = {
                    url,
                    urlWithoutProtocol,
                    position,
                    userMessage: `u${i}`,
                    aiResponse: `a${i}`,
                    timestamp: 1700000000000 + i,
                    title: `T${i}`,
                    platform: 'ChatGPT',
                    folderPath: i < 2000 ? 'A/B' : 'Import',
                };
                index.push(key);
            }
            store['aimd:bookmarks:index:v1'] = index;

            const moveRes = await handleBookmarksRequest(
                req('bookmarks:folders:move', { sourcePath: 'A/B', targetParentPath: '' })
            );
            expect(moveRes?.response.ok).toBe(true);
            expect(store.folderPaths).toContain('B');
            expect(store.folderPaths).not.toContain('A/B');
            expect(store['folder:B']).toBeTruthy();
            expect(store['folder:A/B']).toBeUndefined();

            let updated = 0;
            for (let i = 0; i < 2000; i++) {
                const urlWithoutProtocol = `example.com/c/${i}`;
                const key = `bookmark:${urlWithoutProtocol}:${i}`;
                if (store[key]?.folderPath === 'B') updated += 1;
            }
            expect(updated).toBe(2000);
            expect(store['aimd:bookmarks:journal:v1']).toBeUndefined();
        },
        30_000
    );
});
