import { describe, expect, it, vi } from 'vitest';
import { PathUtils } from '@/core/bookmarks/path';
import type { Bookmark, Folder } from '@/core/bookmarks/types';
import { BookmarksPanelController } from '@/ui/content/bookmarks/BookmarksPanelController';
import { bookmarkKey, getBookmarkIdentityKey } from '@/ui/content/bookmarks/bookmarksPanelControllerHelpers';
import { getSelectedBookmarkItems } from '@/ui/content/bookmarks/bookmarksPanelControllerSelection';

function makeBookmark(index: number, folderPath = `Folder-${index}`): Bookmark {
    return {
        kind: 'message',
        url: `https://chatgpt.com/c/perf-${index}`,
        urlWithoutProtocol: `chatgpt.com/c/perf-${index}`,
        position: index + 1,
        userMessage: `Prompt ${index}`,
        aiResponse: `Answer ${index}`,
        timestamp: index,
        title: `Bookmark ${index}`,
        platform: 'ChatGPT',
        folderPath,
    };
}

function makeFolder(index: number): Folder {
    return {
        path: `Folder-${index}`,
        name: `Folder-${index}`,
        depth: 1,
        createdAt: index,
        updatedAt: index,
    };
}

describe('BookmarksPanelController selection complexity', () => {
    it('resolves a large selected bookmark set with one bookmark index pass', () => {
        const count = 1_500;
        let urlReads = 0;
        const bookmarks = Array.from({ length: count }, (_, index) => {
            const bookmark = makeBookmark(index);
            const url = bookmark.url;
            Object.defineProperty(bookmark, 'url', {
                configurable: true,
                enumerable: true,
                get: () => {
                    urlReads += 1;
                    return url;
                },
            });
            return bookmark;
        });
        const selectedKeys = new Set(
            [...bookmarks].reverse().map((bookmark) => bookmarkKey(getBookmarkIdentityKey(bookmark))),
        );
        urlReads = 0;

        const items = getSelectedBookmarkItems({ bookmarks, selectedKeys });

        expect(items).toHaveLength(count);
        expect(items[0]).toMatchObject({ kind: 'message', position: count });
        expect(urlReads).toBeLessThanOrEqual(count * 2 + 10);
    });

    it('builds all folder checkbox states without rescanning every bookmark for every folder', () => {
        const count = 1_000;
        const controller = new BookmarksPanelController({} as any);
        const folders = Array.from({ length: count }, (_, index) => makeFolder(index));
        const bookmarks = Array.from({ length: count }, (_, index) => makeBookmark(index));
        (controller as any).folders = folders;
        (controller as any).bookmarks = bookmarks;
        (controller as any).state.selectedKeys = new Set(
            bookmarks.filter((_bookmark, index) => index % 2 === 0).map((bookmark) => bookmarkKey(getBookmarkIdentityKey(bookmark))),
        );
        const descendantSpy = vi.spyOn(PathUtils, 'isDescendantOf');

        const states = folders.map((folder) => controller.getFolderCheckboxState(folder.path));

        expect(states.filter((state) => state.checked)).toHaveLength(count / 2);
        expect(descendantSpy.mock.calls.length).toBeLessThan(count * 10);
    });
});
