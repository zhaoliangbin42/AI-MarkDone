import { beforeEach, describe, expect, it, vi } from 'vitest';

const listMock = vi.fn(async () => ({ ok: true, data: { bookmarks: [] } }));
const foldersListMock = vi.fn(async () => ({ ok: true, data: { folders: [], folderPaths: [] } }));
const positionsMock = vi.fn(async () => ({ ok: true, data: { positions: [] } }));
const uiStateGetMock = vi.fn(async () => ({ ok: true, data: { value: 'Research/March' } }));
const uiStateSetMock = vi.fn(async (_value: string | null) => ({ ok: true, data: { value: _value } }));
const bulkMoveMock = vi.fn(async () => ({ ok: true, data: {} }));

vi.mock('@/drivers/shared/clients/bookmarksClient', () => ({
    bookmarksClient: {
        list: listMock,
        foldersList: foldersListMock,
        positions: positionsMock,
        uiStateGetLastSelectedFolderPath: uiStateGetMock,
        uiStateSetLastSelectedFolderPath: uiStateSetMock,
        bulkMove: bulkMoveMock,
    },
}));

describe('BookmarksPanelController', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('restores the persisted last selected folder path through the existing uiState client', async () => {
        const { BookmarksPanelController } = await import('@/ui/content/bookmarks/BookmarksPanelController');
        const controller = new BookmarksPanelController({} as any);

        await controller.refreshUiState();

        expect(uiStateGetMock).toHaveBeenCalledTimes(1);
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
});
