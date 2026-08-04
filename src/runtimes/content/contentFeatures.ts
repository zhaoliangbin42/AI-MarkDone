import type { BookmarksPanelController } from '../../ui/content/bookmarks/BookmarksPanelController';
import type { BookmarksPanelOptions, BookmarksPanelPort } from '../../ui/content/bookmarks/BookmarksPanelPort';
import type { ReaderPanelPort } from '../../ui/content/reader/ReaderPanelPort';
import type { copyMessagePng as copyMessagePngImplementation } from '../../services/copy/copy-turn-png';
import type { runFormulaAssetAction as runFormulaAssetActionImplementation } from '../../services/math/formulaAssetActions';
import type { renderFormulaSvgAsset as renderFormulaSvgAssetImplementation } from '../../services/math/formulaAssetRenderer';
import type { UiLocale } from '../../ui/content/components/i18n';

export async function setContentFeatureLocale(locale: UiLocale): Promise<void> {
    const { setLocale } = await import('../../ui/content/components/i18n');
    await setLocale(locale);
}

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

export const copyMessagePng: typeof copyMessagePngImplementation = async (...args) => {
    const { copyMessagePng: implementation } = await import('../../services/copy/copy-turn-png');
    return implementation(...args);
};

export const runFormulaAssetAction: typeof runFormulaAssetActionImplementation = async (...args) => {
    const { runFormulaAssetAction: implementation } = await import('../../services/math/formulaAssetActions');
    return implementation(...args);
};

export const renderFormulaSvgAsset: typeof renderFormulaSvgAssetImplementation = async (...args) => {
    const { renderFormulaSvgAsset: implementation } = await import('../../services/math/formulaAssetRenderer');
    return implementation(...args);
};
