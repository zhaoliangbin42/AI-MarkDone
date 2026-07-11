import type { BookmarksPanelController } from '../../ui/content/bookmarks/BookmarksPanelController';
import type { BookmarksPanelOptions, BookmarksPanelPort } from '../../ui/content/bookmarks/BookmarksPanelPort';
import type { ReaderPanelPort } from '../../ui/content/reader/ReaderPanelPort';
import type { copyTurnsPng as copyTurnsPngImplementation } from '../../services/copy/copy-turn-png';

export async function createReaderPanel(): Promise<ReaderPanelPort> {
    const { ReaderPanel } = await import('../../ui/content/reader/ReaderPanel');
    return new ReaderPanel();
}

export async function createBookmarksPanel(
    controller: BookmarksPanelController,
    readerPanel: ReaderPanelPort,
    options: BookmarksPanelOptions = {},
): Promise<BookmarksPanelPort> {
    const { BookmarksPanel } = await import('../../ui/content/bookmarks/BookmarksPanel');
    return new BookmarksPanel(controller, readerPanel, options);
}

export async function getSaveMessagesDialog() {
    const { saveMessagesDialog } = await import('../../ui/content/export/SaveMessagesDialog');
    return saveMessagesDialog;
}

export async function getBookmarkSaveDialog() {
    const { bookmarkSaveDialog } = await import('../../ui/content/bookmarks/save/bookmarkSaveDialogSingleton');
    return bookmarkSaveDialog;
}

export const copyTurnsPng: typeof copyTurnsPngImplementation = async (...args) => {
    const { copyTurnsPng: implementation } = await import('../../services/copy/copy-turn-png');
    return implementation(...args);
};
