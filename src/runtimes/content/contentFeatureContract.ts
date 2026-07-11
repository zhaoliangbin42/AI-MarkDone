import type { BookmarksPanelController } from '../../ui/content/bookmarks/BookmarksPanelController';
import type { BookmarksPanelOptions, BookmarksPanelPort } from '../../ui/content/bookmarks/BookmarksPanelPort';
import type { ReaderPanelPort } from '../../ui/content/reader/ReaderPanelPort';
import type { BookmarkSaveDialogPort, SaveMessagesDialogPort } from '../../ui/content/ContentDialogPorts';
import type { copyTurnsPng } from '../../services/copy/copy-turn-png';

export type ContentFeatureModule = {
    createReaderPanel(): Promise<ReaderPanelPort>;
    createBookmarksPanel(
        controller: BookmarksPanelController,
        readerPanel: ReaderPanelPort,
        options?: BookmarksPanelOptions,
    ): Promise<BookmarksPanelPort>;
    getSaveMessagesDialog(): Promise<SaveMessagesDialogPort>;
    getBookmarkSaveDialog(): Promise<BookmarkSaveDialogPort>;
    copyTurnsPng: typeof copyTurnsPng;
};
