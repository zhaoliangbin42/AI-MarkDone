import { beforeEach, describe, expect, it, vi } from 'vitest';

const listMock = vi.fn(async () => ({ ok: true, data: { bookmarks: [] } }));
const foldersListMock = vi.fn(async () => ({ ok: true, data: { folders: [], folderPaths: [] } }));
const positionsMock = vi.fn(async () => ({ ok: true, data: { positions: [] } }));
const uiStateGetMock = vi.fn(async () => ({ ok: true, data: { value: 'Research/March' } }));
const uiStateSetMock = vi.fn(async (_value: string | null) => ({ ok: true, data: { value: _value } }));
const bulkMoveMock = vi.fn(async () => ({ ok: true, data: {} }));
const bulkRemoveMock = vi.fn(async () => ({ ok: true, data: {} }));
const saveMock = vi.fn(async () => ({ ok: true, data: { saved: true } }));
const storageUsageMock = vi.fn(async () => ({ ok: true, data: { usedBytes: 0, quotaBytes: 1024, usedPercentage: 0, warningLevel: 'none' } }));
const navigateChatGPTDirectoryTargetMock = vi.fn(async () => ({ ok: true }));

vi.mock('@/drivers/shared/clients/bookmarksClient', () => ({
    bookmarksClient: {
        list: listMock,
        foldersList: foldersListMock,
        positions: positionsMock,
        storageUsage: storageUsageMock,
        uiStateGetLastSelectedFolderPath: uiStateGetMock,
        uiStateSetLastSelectedFolderPath: uiStateSetMock,
        bulkMove: bulkMoveMock,
        bulkRemove: bulkRemoveMock,
        save: saveMock,
    },
}));

vi.mock('@/ui/content/chatgptDirectory/navigation', () => ({
    navigateChatGPTDirectoryTarget: navigateChatGPTDirectoryTargetMock,
}));

describe('BookmarksPanelController', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        window.history.replaceState({}, '', '/c/123');
    });

    it('restores the persisted last selected folder path through the existing uiState client', async () => {
        const { BookmarksPanelController } = await import('@/ui/content/bookmarks/BookmarksPanelController');
        const controller = new BookmarksPanelController({} as any);

        await controller.refreshUiState();

        expect(uiStateGetMock).toHaveBeenCalledTimes(1);
        expect(controller.getSnapshot().vm.selectedFolderPath).toBe('Research/March');
    });

    it('expands the restored selected folder path once in controller state instead of relying on render-time rules', async () => {
        const { BookmarksPanelController } = await import('@/ui/content/bookmarks/BookmarksPanelController');
        const controller = new BookmarksPanelController({} as any);

        foldersListMock.mockResolvedValueOnce({
            ok: true,
            data: {
                folders: [
                    { path: 'Research', name: 'Research', depth: 1, createdAt: 0, updatedAt: 0 },
                    { path: 'Research/March', name: 'March', depth: 2, createdAt: 0, updatedAt: 0 },
                ],
                folderPaths: ['Research', 'Research/March'],
            },
        });

        await controller.refreshAll();
        await controller.refreshUiState();

        const root = controller.getSnapshot().vm.folderTree[0];
        expect(root?.folder.path).toBe('Research');
        expect(root?.isExpanded).toBe(true);
        expect(root?.children[0]?.folder.path).toBe('Research/March');
        expect(root?.children[0]?.isExpanded).toBe(true);
        expect(controller.getSnapshot().vm.selectedFolderPath).toBe('Research/March');
    });

    it('persists folder selection changes through the existing uiState client', async () => {
        const { BookmarksPanelController } = await import('@/ui/content/bookmarks/BookmarksPanelController');
        const controller = new BookmarksPanelController({} as any);

        controller.selectFolder('Product/UX');
        controller.selectFolder(null);

        expect(uiStateSetMock).toHaveBeenNthCalledWith(1, 'Product/UX');
        expect(uiStateSetMock).toHaveBeenNthCalledWith(2, null);
    });

    it('allows an ancestor folder to stay collapsed after the user closes it, even when a descendant remains selected', async () => {
        const { BookmarksPanelController } = await import('@/ui/content/bookmarks/BookmarksPanelController');
        const controller = new BookmarksPanelController({} as any);

        foldersListMock.mockResolvedValueOnce({
            ok: true,
            data: {
                folders: [
                    { path: 'test', name: 'test', depth: 1, createdAt: 0, updatedAt: 0 },
                    { path: 'test/child', name: 'child', depth: 2, createdAt: 0, updatedAt: 0 },
                ],
                folderPaths: ['test', 'test/child'],
            },
        });

        await controller.refreshAll();
        controller.selectFolder('test/child');

        let root = controller.getSnapshot().vm.folderTree[0];
        expect(root?.isExpanded).toBe(true);

        controller.toggleFolderExpanded('test');

        root = controller.getSnapshot().vm.folderTree[0];
        expect(controller.getSnapshot().vm.selectedFolderPath).toBe('test/child');
        expect(root?.isExpanded).toBe(false);
    });

    it('reports empty-folder checkbox state from the folder selection key itself', async () => {
        const { BookmarksPanelController } = await import('@/ui/content/bookmarks/BookmarksPanelController');
        const controller = new BookmarksPanelController({} as any);

        controller.toggleFolderSelection('Empty');

        expect(controller.getFolderCheckboxState('Empty')).toEqual({
            checked: true,
            indeterminate: false,
        });
    });

    it('moves a single bookmark through the existing bulkMove protocol', async () => {
        const { BookmarksPanelController } = await import('@/ui/content/bookmarks/BookmarksPanelController');
        const controller = new BookmarksPanelController({} as any);

        await controller.moveBookmark({
            url: 'https://chat.openai.com/c/123',
            urlWithoutProtocol: 'chat.openai.com/c/123',
            position: 8,
            userMessage: 'Prompt',
            aiResponse: 'Answer',
            timestamp: Date.now(),
            title: 'Saved thread',
            platform: 'ChatGPT',
            folderPath: 'Import',
        }, 'Archive');

        expect(bulkMoveMock).toHaveBeenCalledWith({
            items: [{ url: 'https://chat.openai.com/c/123', position: 8 }],
            targetFolderPath: 'Archive',
        });
    });

    it('renames a bookmark by reusing the existing save overwrite path without title uniqueness checks', async () => {
        const { BookmarksPanelController } = await import('@/ui/content/bookmarks/BookmarksPanelController');
        const controller = new BookmarksPanelController({} as any);

        await controller.renameBookmark({
            url: 'https://chat.openai.com/c/123',
            urlWithoutProtocol: 'chat.openai.com/c/123',
            position: 8,
            messageId: 'msg-8',
            userMessage: 'Prompt',
            aiResponse: 'Answer',
            timestamp: 123456,
            title: 'Old title',
            platform: 'ChatGPT',
            folderPath: 'Import',
        }, 'Duplicate title is allowed');

        expect(saveMock).toHaveBeenCalledWith({
            url: 'https://chat.openai.com/c/123',
            position: 8,
            messageId: 'msg-8',
            userMessage: 'Prompt',
            aiResponse: 'Answer',
            title: 'Duplicate title is allowed',
            platform: 'ChatGPT',
            folderPath: 'Import',
            timestamp: 123456,
            options: { saveContextOnly: false },
        });
    });

    it('uses the ChatGPT directory helper for same-page bookmark navigation', async () => {
        const { BookmarksPanelController } = await import('@/ui/content/bookmarks/BookmarksPanelController');
        const adapter = { getPlatformId: () => 'chatgpt' };
        const controller = new BookmarksPanelController(adapter as any);
        const url = `${window.location.origin}/c/123`;
        const bookmark = {
            url,
            urlWithoutProtocol: url.replace(/^https?:\/\//, ''),
            position: 50,
            messageId: 'payload-a50',
            userMessage: 'Prompt',
            aiResponse: 'Answer',
            timestamp: Date.now(),
            title: 'Saved thread',
            platform: 'ChatGPT',
            folderPath: 'Import',
        };

        await controller.goToBookmark(bookmark);

        expect(navigateChatGPTDirectoryTargetMock).toHaveBeenCalledWith(
            adapter,
            bookmark,
            { timeoutMs: 2000, intervalMs: 200 },
        );
    });

    it('includes checked folder paths when batch deleting a selected folder', async () => {
        const { BookmarksPanelController } = await import('@/ui/content/bookmarks/BookmarksPanelController');
        const controller = new BookmarksPanelController({} as any);

        foldersListMock.mockResolvedValueOnce({
            ok: true,
            data: {
                folders: [
                    { path: 'Work', name: 'Work', depth: 1, createdAt: 0, updatedAt: 0 },
                    { path: 'Work/Research', name: 'Research', depth: 2, createdAt: 0, updatedAt: 0 },
                ],
                folderPaths: ['Work', 'Work/Research'],
            },
        });
        listMock.mockResolvedValueOnce({
            ok: true,
            data: {
                bookmarks: [
                    {
                        url: 'https://chat.openai.com/c/123',
                        urlWithoutProtocol: 'chat.openai.com/c/123',
                        position: 8,
                        userMessage: 'Prompt',
                        aiResponse: 'Answer',
                        timestamp: Date.now(),
                        title: 'Saved thread',
                        platform: 'ChatGPT',
                        folderPath: 'Work/Research',
                    },
                ],
            },
        });

        await controller.refreshAll();
        controller.toggleFolderSelection('Work');
        await controller.batchDelete();

        expect(bulkRemoveMock).toHaveBeenCalledWith({
            items: [{ url: 'https://chat.openai.com/c/123', position: 8 }],
            folderPaths: ['Work', 'Work/Research'],
        });
    });
});
