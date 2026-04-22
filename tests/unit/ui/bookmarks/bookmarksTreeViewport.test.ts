import { describe, expect, it, vi } from 'vitest';

import { BookmarksTreeViewport } from '@/ui/content/bookmarks/ui/BookmarksTreeViewport';

function makeSnapshot(totalBookmarks: number) {
    const bookmarks = Array.from({ length: totalBookmarks }, (_, index) => ({
        title: `Bookmark ${index + 1}`,
        userMessage: `Prompt ${index + 1}`,
        aiResponse: `Answer ${index + 1}`,
        url: `https://chat.openai.com/c/${index + 1}`,
        urlWithoutProtocol: `chat.openai.com/c/${index + 1}`,
        folderPath: 'Import',
        platform: 'ChatGPT',
        position: index + 1,
        timestamp: Date.UTC(2026, 2, 1) + index,
    }));

    return {
        vm: {
            query: '',
            platform: 'All',
            bookmarks,
            folderTree: [{
                folder: { path: 'Import', name: 'Import', depth: 1, createdAt: 0, updatedAt: 0 },
                children: [],
                bookmarks,
                isExpanded: true,
                isSelected: false,
            }],
            selectedFolderPath: null,
            sortMode: 'time-desc',
        },
        folders: [{ path: 'Import', name: 'Import', depth: 1, createdAt: 0, updatedAt: 0 }],
        folderPaths: ['Import'],
        selectedKeys: new Set<string>(),
        previewId: null,
        status: 'Ready',
    } as any;
}

describe('BookmarksTreeViewport', () => {
    it('clears the folder scope when clicking empty tree space', () => {
        const actions = {
            selectFolder: vi.fn(),
            toggleFolderExpanded: vi.fn(),
            toggleFolderSelection: vi.fn(),
            toggleBookmarkSelection: vi.fn(),
            openBookmark: vi.fn(),
            goToBookmark: vi.fn(),
            copyBookmark: vi.fn(),
            renameBookmark: vi.fn(),
            moveBookmark: vi.fn(),
            deleteBookmark: vi.fn(),
            createFolder: vi.fn(),
            importBookmarks: vi.fn(),
            createSubfolder: vi.fn(),
            renameFolder: vi.fn(),
            moveFolder: vi.fn(),
            deleteFolder: vi.fn(),
        };
        const viewport = new BookmarksTreeViewport({
            controller: {
                getFolderCheckboxState: vi.fn(() => ({ checked: false, indeterminate: false })),
                getBookmarkRowSubtitle: vi.fn(() => 'ChatGPT - today'),
            } as any,
            actions,
        });

        viewport.update(makeSnapshot(1));
        viewport.getElement().dispatchEvent(new MouseEvent('click', { bubbles: true }));

        expect(actions.selectFolder).toHaveBeenCalledWith(null);
        viewport.destroy();
    });

    it('virtualizes large bookmark trees and coalesces scroll renders through one frame', () => {
        const viewport = new BookmarksTreeViewport({
            controller: {
                getFolderCheckboxState: vi.fn(() => ({ checked: false, indeterminate: false })),
                getBookmarkRowSubtitle: vi.fn(() => 'ChatGPT - today'),
            } as any,
            actions: {
                selectFolder: vi.fn(),
                toggleFolderExpanded: vi.fn(),
                toggleFolderSelection: vi.fn(),
                toggleBookmarkSelection: vi.fn(),
                openBookmark: vi.fn(),
                goToBookmark: vi.fn(),
                copyBookmark: vi.fn(),
                renameBookmark: vi.fn(),
                moveBookmark: vi.fn(),
                deleteBookmark: vi.fn(),
                createFolder: vi.fn(),
                importBookmarks: vi.fn(),
                createSubfolder: vi.fn(),
                renameFolder: vi.fn(),
                moveFolder: vi.fn(),
                deleteFolder: vi.fn(),
            },
        });
        const rafQueue: FrameRequestCallback[] = [];
        const originalRaf = window.requestAnimationFrame;
        const originalCancelRaf = window.cancelAnimationFrame;
        window.requestAnimationFrame = vi.fn((callback: FrameRequestCallback) => {
            rafQueue.push(callback);
            return rafQueue.length;
        });
        window.cancelAnimationFrame = vi.fn();

        try {
            viewport.update(makeSnapshot(600));
            const treePanel = viewport.getElement();
            Object.defineProperty(treePanel, 'clientHeight', {
                configurable: true,
                value: 640,
            });

            const renderSpy = vi.spyOn(viewport as any, 'renderVirtualTreeWindow');
            renderSpy.mockClear();

            for (let index = 0; index < 10; index += 1) {
                treePanel.scrollTop = index * 400;
                treePanel.dispatchEvent(new Event('scroll'));
            }

            expect(renderSpy).not.toHaveBeenCalled();
            expect(window.requestAnimationFrame).toHaveBeenCalledTimes(1);

            const callback = rafQueue.shift();
            expect(callback).toBeTruthy();
            callback!(performance.now());

            expect(renderSpy).toHaveBeenCalledTimes(1);
        } finally {
            viewport.destroy();
            window.requestAnimationFrame = originalRaf;
            window.cancelAnimationFrame = originalCancelRaf;
        }
    });

    it('invokes the shared rename action from the bookmark row control', async () => {
        const actions = {
            selectFolder: vi.fn(),
            toggleFolderExpanded: vi.fn(),
            toggleFolderSelection: vi.fn(),
            toggleBookmarkSelection: vi.fn(),
            openBookmark: vi.fn(),
            goToBookmark: vi.fn(),
            copyBookmark: vi.fn(),
            renameBookmark: vi.fn(),
            moveBookmark: vi.fn(),
            deleteBookmark: vi.fn(),
            createFolder: vi.fn(),
            importBookmarks: vi.fn(),
            createSubfolder: vi.fn(),
            renameFolder: vi.fn(),
            moveFolder: vi.fn(),
            deleteFolder: vi.fn(),
        };
        const viewport = new BookmarksTreeViewport({
            controller: {
                getFolderCheckboxState: vi.fn(() => ({ checked: false, indeterminate: false })),
                getBookmarkRowSubtitle: vi.fn(() => 'ChatGPT - today'),
            } as any,
            actions,
        });

        const snapshot = makeSnapshot(1);
        viewport.update(snapshot);

        const renameBtn = viewport.getElement().querySelector('[data-action="rename-bookmark"]') as HTMLButtonElement | null;
        expect(renameBtn).toBeTruthy();

        renameBtn!.click();
        await Promise.resolve();

        expect(actions.renameBookmark).toHaveBeenCalledWith(snapshot.vm.bookmarks[0]);
        viewport.destroy();
    });
});
