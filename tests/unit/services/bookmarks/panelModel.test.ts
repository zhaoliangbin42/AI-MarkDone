import { describe, expect, it } from 'vitest';
import type { Bookmark, Folder } from '../../../../src/core/bookmarks/types';
import { computeBookmarksPanelViewModel } from '../../../../src/services/bookmarks/panelModel';

function folder(path: string): Folder {
    const seg = path.split('/').pop() || path;
    return { path, name: seg, depth: path.split('/').length, createdAt: 1, updatedAt: 1 };
}

function bookmark(params: Partial<Bookmark> & { position: number; title: string; url?: string; folderPath?: string; platform?: string }): Bookmark {
    const url = params.url ?? 'https://chatgpt.com/c/1';
    return {
        url,
        urlWithoutProtocol: 'chatgpt.com/c/1',
        position: params.position,
        userMessage: 'u',
        aiResponse: 'a',
        timestamp: 1,
        title: params.title,
        platform: params.platform ?? 'ChatGPT',
        folderPath: params.folderPath ?? 'Import',
    };
}

describe('bookmarks panel model', () => {
    it('filters by query/platform and respects selectedFolderPath', () => {
        const folders = [folder('Import'), folder('Work')];
        const bookmarks = [
            bookmark({ position: 1, title: 'Alpha', folderPath: 'Import', platform: 'ChatGPT' }),
            bookmark({ position: 2, title: 'Beta', folderPath: 'Work', platform: 'ChatGPT' }),
            bookmark({ position: 3, title: 'Gamma', folderPath: 'Work', platform: 'Claude' }),
        ];

        const vm = computeBookmarksPanelViewModel({
            folders,
            bookmarks,
            state: {
                query: 'be',
                platform: 'ChatGPT',
                kind: 'all',
                sortMode: 'alpha-asc',
                selectedFolderPath: 'Work',
                recursive: true,
                expandedPaths: new Set(),
                selectedKeys: new Set(['bm:chatgpt.com/c/1:2']),
            },
        });

        expect(vm.bookmarks).toHaveLength(1);
        expect(vm.bookmarks[0].title).toBe('Beta');
        expect(vm.selectedCount).toBe(1);
    });

    it('filters page and message bookmarks by type', () => {
        const folders = [folder('Import')];
        const bookmarks: Bookmark[] = [
            bookmark({ position: 1, title: 'Message one' }),
            {
                kind: 'page',
                url: 'https://chatgpt.com/c/1',
                urlWithoutProtocol: 'chatgpt.com/c/1',
                pageKey: 'chatgpt.com/c/1',
                timestamp: 2,
                title: 'Conversation page',
                platform: 'ChatGPT',
                folderPath: 'Import',
            },
        ];

        const vm = computeBookmarksPanelViewModel({
            folders,
            bookmarks,
            state: {
                query: '',
                platform: 'All',
                kind: 'page',
                sortMode: 'alpha-asc',
                selectedFolderPath: null,
                recursive: true,
                expandedPaths: new Set(),
                selectedKeys: new Set(),
            },
        });

        expect(vm.bookmarks).toHaveLength(1);
        expect(vm.bookmarks[0]?.kind).toBe('page');
    });
});
