import { beforeEach, describe, expect, it, vi } from 'vitest';

const listMock = vi.fn(async () => ({ ok: true, data: { bookmarks: [] } }));
const foldersListMock = vi.fn(async () => ({ ok: true, data: { folders: [], folderPaths: [] } }));
const positionsMock = vi.fn(async () => ({ ok: true, data: { positions: [] } }));
const pageStatusMock = vi.fn(async () => ({ ok: true, data: { saved: false } }));
const uiStateGetMock = vi.fn(async () => ({ ok: true, data: { value: 'Research/March' } }));
const uiStateSetMock = vi.fn(async (_value: string | null) => ({ ok: true, data: { value: _value } }));
const bulkMoveMock = vi.fn(async () => ({ ok: true, data: {} }));
const bulkRemoveMock = vi.fn(async () => ({ ok: true, data: {} }));
const saveMock = vi.fn(async () => ({ ok: true, data: { saved: true } }));
const removeMock = vi.fn(async () => ({ ok: true, data: { removed: 1 } }));
const pageSaveMock = vi.fn(async () => ({ ok: true, data: { saved: true } }));
const pageRemoveMock = vi.fn(async () => ({ ok: true, data: { removed: 1 } }));
const storageUsageMock = vi.fn(async () => ({ ok: true, data: { usedBytes: 0, quotaBytes: 1024, usedPercentage: 0, warningLevel: 'none' } }));
const navigateChatGPTDirectoryTargetMock = vi.fn(async () => ({ ok: true }));
const conversationNavigationMock = {
    navigate: vi.fn(async () => ({ ok: true as const })),
    cancelActive: vi.fn(),
};

vi.mock('@/drivers/shared/clients/bookmarksClient', () => ({
    bookmarksClient: {
        list: listMock,
        foldersList: foldersListMock,
        positions: positionsMock,
        pageStatus: pageStatusMock,
        storageUsage: storageUsageMock,
        uiStateGetLastSelectedFolderPath: uiStateGetMock,
        uiStateSetLastSelectedFolderPath: uiStateSetMock,
        bulkMove: bulkMoveMock,
        bulkRemove: bulkRemoveMock,
        save: saveMock,
        remove: removeMock,
        pageSave: pageSaveMock,
        pageRemove: pageRemoveMock,
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
            items: [{ kind: 'message', url: 'https://chat.openai.com/c/123', position: 8 }],
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

    it('routes same-page ChatGPT message bookmarks through the shared navigation port', async () => {
        const { BookmarksPanelController } = await import('@/ui/content/bookmarks/BookmarksPanelController');
        const adapter = { getPlatformId: () => 'chatgpt' };
        const url = 'https://chatgpt.com/c/12345678-1234-1234-1234-123456789abc';
        const assign = vi.fn();
        const originalLocation = window.location;
        Object.defineProperty(window, 'location', {
            configurable: true,
            value: { href: url, origin: 'https://chatgpt.com', assign },
        });
        try {
            const controller = new BookmarksPanelController(adapter as any, { navigation: conversationNavigationMock });
            await controller.goToBookmark({
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
            });

            expect(assign).not.toHaveBeenCalled();
            expect(conversationNavigationMock.navigate).toHaveBeenCalledWith(
                {
                    position: 50,
                    messageId: 'payload-a50',
                    assistantMessageId: 'payload-a50',
                    source: 'bookmark',
                },
                { timeoutMs: 15_000, align: 'start' },
            );
        } finally {
            Object.defineProperty(window, 'location', { configurable: true, value: originalLocation });
        }
    });

    it('normalizes ChatGPT transport query flags before reading bookmark positions', async () => {
        const { BookmarksPanelController } = await import('@/ui/content/bookmarks/BookmarksPanelController');
        const adapter = { getPlatformId: () => 'chatgpt' };
        const controller = new BookmarksPanelController(adapter as any);

        await controller.refreshPositionsForUrl('https://chatgpt.com/c/123?mweb_fallback=1');

        expect(positionsMock).toHaveBeenNthCalledWith(1, { url: 'https://chatgpt.com/c/123' });
        expect(positionsMock).toHaveBeenNthCalledWith(2, { url: 'https://chat.openai.com/c/123' });
    });

    it('keeps legacy chat.openai.com message bookmarks visible on chatgpt.com', async () => {
        const { BookmarksPanelController } = await import('@/ui/content/bookmarks/BookmarksPanelController');
        const adapter = { getPlatformId: () => 'chatgpt' };
        const controller = new BookmarksPanelController(adapter as any);
        positionsMock.mockImplementation(async ({ url }: { url: string }) => ({
            ok: true,
            data: { positions: url.startsWith('https://chat.openai.com/') ? [8] : [] },
        }));

        await controller.refreshPositionsForUrl('https://chatgpt.com/c/123?mweb_fallback=1');

        expect(controller.isPositionBookmarked('https://chatgpt.com/c/123?mweb_fallback=1', 8)).toBe(true);
    });

    it('resolves legacy bookmark identity before deciding the directory highlight position', async () => {
        const { BookmarksPanelController } = await import('@/ui/content/bookmarks/BookmarksPanelController');
        const adapter = { getPlatformId: () => 'chatgpt' };
        const controller = new BookmarksPanelController(adapter as any);
        listMock.mockResolvedValueOnce({
            ok: true,
            data: {
                bookmarks: [{
                    url: 'https://chat.openai.com/c/123',
                    urlWithoutProtocol: 'chat.openai.com/c/123',
                    position: 2,
                    messageId: 'assistant-2',
                    userMessage: 'Prompt',
                    aiResponse: 'Answer',
                    timestamp: 1,
                    title: 'Prompt',
                    platform: 'ChatGPT',
                    folderPath: 'Import',
                }],
            },
        });
        await controller.refreshAll();

        expect(controller.resolveConversationBookmarkPositions(
            'https://chatgpt.com/c/123?mweb_fallback=1',
            [
                { position: 1, assistantMessageId: 'assistant-1' },
                { position: 2, assistantMessageId: 'assistant-2' },
            ],
        )).toEqual(new Set([2]));
    });

    it('loads the existing message records for directory resolution without changing the storage contract', async () => {
        const { BookmarksPanelController } = await import('@/ui/content/bookmarks/BookmarksPanelController');
        const adapter = { getPlatformId: () => 'chatgpt' };
        const controller = new BookmarksPanelController(adapter as any, {
            conversationContentSource: {
                read: () => ({ kind: 'ready', document: null, snapshot: {} }),
            } as any,
        });
        listMock.mockResolvedValueOnce({
            ok: true,
            data: {
                bookmarks: [{
                    url: 'https://chat.openai.com/c/123',
                    urlWithoutProtocol: 'chat.openai.com/c/123',
                    position: 2,
                    messageId: 'assistant-2',
                    userMessage: 'Prompt',
                    aiResponse: 'Answer',
                    timestamp: 1,
                    title: 'Prompt',
                    platform: 'ChatGPT',
                    folderPath: 'Import',
                }],
            },
        });

        await controller.refreshPositionsForUrl('https://chatgpt.com/c/123?mweb_fallback=1');

        expect(listMock).toHaveBeenCalledWith({ kind: 'message', platform: 'ChatGPT' });
        expect(controller.resolveConversationBookmarkPositions(
            'https://chatgpt.com/c/123?mweb_fallback=1',
            [{ position: 2, assistantMessageId: 'assistant-2' }],
        )).toEqual(new Set([2]));
        expect(saveMock).not.toHaveBeenCalled();
        expect(removeMock).not.toHaveBeenCalled();
    });

    it('fails closed instead of using position-only state while the canonical source is unavailable', async () => {
        const { BookmarksPanelController } = await import('@/ui/content/bookmarks/BookmarksPanelController');
        const adapter = { getPlatformId: () => 'chatgpt' };
        const controller = new BookmarksPanelController(adapter as any, {
            conversationContentSource: {
                read: () => ({ kind: 'syncing', document: null, snapshot: null }),
            } as any,
        });

        positionsMock.mockResolvedValueOnce({ ok: true, data: { positions: [2] } });
        await controller.refreshPositionsForUrl('https://chatgpt.com/c/123');

        expect(controller.resolveConversationBookmarkPositions(
            'https://chatgpt.com/c/123',
            [{ position: 2, assistantMessageId: 'assistant-2' }],
        )).toEqual(new Set());
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
            items: [{ kind: 'message', url: 'https://chat.openai.com/c/123', position: 8 }],
            folderPaths: ['Work', 'Work/Research'],
        });
    });

    it('keeps the last successful data and exposes a runtime failure separately from an empty result', async () => {
        const { BookmarksPanelController } = await import('@/ui/content/bookmarks/BookmarksPanelController');
        const controller = new BookmarksPanelController({} as any);

        foldersListMock.mockResolvedValueOnce({
            ok: true,
            data: {
                folders: [{ path: 'Work', name: 'Work', depth: 1, createdAt: 0, updatedAt: 0 }],
                folderPaths: ['Work'],
            },
        });
        listMock.mockResolvedValueOnce({
            ok: true,
            data: {
                bookmarks: [{
                    url: 'https://chat.openai.com/c/123',
                    urlWithoutProtocol: 'chat.openai.com/c/123',
                    position: 8,
                    userMessage: 'Prompt',
                    aiResponse: 'Answer',
                    timestamp: 1,
                    title: 'Saved thread',
                    platform: 'ChatGPT',
                    folderPath: 'Work',
                }],
            },
        });
        await controller.refreshAll();

        const failure = {
            kind: 'transport' as const,
            code: 'CONTEXT_INVALIDATED' as const,
            message: 'Extension context invalidated.',
            delivery: 'not-sent' as const,
        };
        foldersListMock.mockResolvedValueOnce({
            ok: false,
            errorCode: failure.code,
            message: failure.message,
            failure,
        });
        listMock.mockResolvedValueOnce({
            ok: false,
            errorCode: failure.code,
            message: failure.message,
            failure,
        });

        await controller.refreshAll();

        const snapshot = controller.getSnapshot() as any;
        expect(snapshot.vm.folderTree[0]?.folder.path).toBe('Work');
        expect(snapshot.vm.bookmarks).toHaveLength(1);
        expect(snapshot.dataState).toEqual({ kind: 'error', failure });
    });

    it('keeps last-known storage usage when only the auxiliary usage read fails', async () => {
        const { BookmarksPanelController } = await import('@/ui/content/bookmarks/BookmarksPanelController');
        const controller = new BookmarksPanelController({} as any);
        const usage = { usedBytes: 128, quotaBytes: 1024, usedPercentage: 12.5, warningLevel: 'none' };
        storageUsageMock.mockResolvedValueOnce({ ok: true, data: usage });
        await controller.refreshAll();

        storageUsageMock.mockResolvedValueOnce({
            ok: false,
            errorCode: 'RECEIVER_UNAVAILABLE',
            message: 'Receiver unavailable',
            failure: {
                kind: 'transport',
                code: 'RECEIVER_UNAVAILABLE',
                message: 'Receiver unavailable',
                delivery: 'not-sent',
            },
        });
        await controller.refreshAll();

        expect(controller.getSnapshot().storageUsage).toEqual(usage);
        expect(controller.getSnapshot().dataState).toEqual({ kind: 'ready' });
    });

    it('fails closed without saving or removing when canonical message bookmark status is unavailable', async () => {
        const { BookmarksPanelController } = await import('@/ui/content/bookmarks/BookmarksPanelController');
        const controller = new BookmarksPanelController({} as any);
        const url = 'https://chat.openai.com/c/123';
        const failure = {
            kind: 'transport' as const,
            code: 'CONTEXT_INVALIDATED' as const,
            message: 'Extension context invalidated.',
            delivery: 'not-sent' as const,
        };
        const unavailableResult = {
            ok: false as const,
            errorCode: failure.code,
            message: failure.message,
            failure,
        };

        positionsMock.mockResolvedValueOnce({ ok: true, data: { positions: [8] } });
        await controller.refreshPositionsForUrl(url);
        positionsMock.mockResolvedValueOnce(unavailableResult);
        await controller.refreshPositionsForUrl(url);
        expect(controller.isPositionBookmarked(url, 8)).toBe(true);
        positionsMock.mockResolvedValueOnce(unavailableResult);

        const result = await controller.toggleBookmarkFromToolbar({
            url,
            position: 8,
            messageId: 'msg-8',
            folderPath: 'Work',
            userMessage: 'Prompt',
            aiResponse: 'Answer',
            platform: 'ChatGPT',
            title: 'Saved thread',
        });

        expect(result).toEqual({
            ok: false,
            errorCode: failure.code,
            message: failure.message,
            failure,
        });
        expect(controller.isPositionBookmarked(url, 8)).toBe(true);
        expect(saveMock).not.toHaveBeenCalled();
        expect(removeMock).not.toHaveBeenCalled();
    });

    it('fails closed without saving or removing when canonical page bookmark status is unavailable', async () => {
        const { BookmarksPanelController } = await import('@/ui/content/bookmarks/BookmarksPanelController');
        const controller = new BookmarksPanelController({} as any);
        const url = 'https://chat.openai.com/c/123';
        const failure = {
            kind: 'transport' as const,
            code: 'RECEIVER_UNAVAILABLE' as const,
            message: 'Extension background is unavailable.',
            delivery: 'not-sent' as const,
        };
        const unavailableResult = {
            ok: false as const,
            errorCode: failure.code,
            message: failure.message,
            failure,
        };

        pageStatusMock.mockResolvedValueOnce({ ok: true, data: { saved: true } });
        await controller.refreshPageBookmarkStatus(url);
        pageStatusMock.mockResolvedValueOnce(unavailableResult);
        await controller.refreshPageBookmarkStatus(url);
        expect(controller.isCurrentPageBookmarked(url)).toBe(true);
        pageStatusMock.mockResolvedValueOnce(unavailableResult);

        const result = await controller.togglePageBookmarkForCurrentPage({
            url,
            title: 'Saved thread',
            platform: 'ChatGPT',
            folderPath: 'Work',
        });

        expect(result).toEqual({
            ok: false,
            errorCode: failure.code,
            message: failure.message,
            failure,
        });
        expect(controller.isCurrentPageBookmarked(url)).toBe(true);
        expect(pageSaveMock).not.toHaveBeenCalled();
        expect(pageRemoveMock).not.toHaveBeenCalled();
    });

    it('executes an explicit desired bookmark state without performing a second toggle lookup', async () => {
        const { BookmarksPanelController } = await import('@/ui/content/bookmarks/BookmarksPanelController');
        const controller = new BookmarksPanelController({} as any);
        const url = 'https://chat.openai.com/c/123';

        await controller.setPageBookmarkSaved({
            url,
            title: 'Saved thread',
            platform: 'ChatGPT',
            folderPath: 'Work',
        }, true);
        await controller.setPositionBookmarkSaved({
            url,
            position: 8,
            messageId: 'msg-8',
            folderPath: 'Work',
            userMessage: 'Prompt',
            aiResponse: 'Answer',
            platform: 'ChatGPT',
            title: 'Saved thread',
        }, true);

        expect(pageStatusMock).not.toHaveBeenCalled();
        expect(positionsMock).not.toHaveBeenCalled();
        expect(pageSaveMock).toHaveBeenCalledTimes(1);
        expect(saveMock).toHaveBeenCalledTimes(1);
        expect(pageRemoveMock).not.toHaveBeenCalled();
        expect(removeMock).not.toHaveBeenCalled();
    });

    it('does not let a late lookup from an old URL replace the current bookmark status cache', async () => {
        const { BookmarksPanelController } = await import('@/ui/content/bookmarks/BookmarksPanelController');
        const controller = new BookmarksPanelController({} as any);
        let resolveOldPositions!: (value: any) => void;
        let resolveOldPage!: (value: any) => void;
        positionsMock
            .mockImplementationOnce(() => new Promise((resolve) => { resolveOldPositions = resolve; }))
            .mockResolvedValueOnce({ ok: true, data: { positions: [9] } });
        pageStatusMock
            .mockImplementationOnce(() => new Promise((resolve) => { resolveOldPage = resolve; }))
            .mockResolvedValueOnce({ ok: true, data: { saved: true } });

        const oldPositions = controller.refreshPositionsForUrl('https://chatgpt.com/c/old');
        await controller.refreshPositionsForUrl('https://chatgpt.com/c/current');
        resolveOldPositions({ ok: true, data: { positions: [1] } });
        await oldPositions;

        const oldPage = controller.refreshPageBookmarkStatus('https://chatgpt.com/c/old');
        await controller.refreshPageBookmarkStatus('https://chatgpt.com/c/current');
        resolveOldPage({ ok: true, data: { saved: false } });
        await oldPage;

        expect(controller.isPositionBookmarked('https://chatgpt.com/c/current', 9)).toBe(true);
        expect(controller.isCurrentPageBookmarked('https://chatgpt.com/c/current')).toBe(true);
        expect(controller.isPositionBookmarked('https://chatgpt.com/c/old', 1)).toBe(false);
        expect(controller.isCurrentPageBookmarked('https://chatgpt.com/c/old')).toBe(false);
    });
});
