import type { Theme } from '../../../../../core/types/theme';
import type { Bookmark } from '../../../../../core/bookmarks/types';
import type { ReaderItem } from '../../../../../services/reader/types';
import { PathUtils } from '../../../../../core/bookmarks/path';
import { validateBookmarkTitle } from '../../../../../core/bookmarks/title';
import { t } from '../../../components/i18n';
import type { ModalHost } from '../../../components/ModalHost';
import type { ReaderPanel } from '../../../reader/ReaderPanel';
import type { BookmarksPanelController, BookmarksPanelSnapshot } from '../../BookmarksPanelController';
import { titleValidationMessage, validateFolderPathInput, validateFolderSegmentName } from '../../helpers/nameValidation';
import { bookmarkSaveDialog } from '../../save/bookmarkSaveDialogSingleton';

function bookmarkSelectionKey(b: Bookmark): string {
    return `bm:${b.urlWithoutProtocol}:${b.position}`;
}

function buildReaderScopeList(
    snapshot: BookmarksPanelSnapshot,
    bookmark: Bookmark
): { list: Bookmark[]; startIndex: number } {
    const key = bookmarkSelectionKey(bookmark);
    const visibleKeys = new Set<string>(snapshot.vm.bookmarks.map(bookmarkSelectionKey));
    const queryActive = Boolean(snapshot.vm.query.trim());

    const list = queryActive
        ? flattenVisibleBookmarksInTreeOrder(snapshot.vm.folderTree, visibleKeys)
        : getVisibleBookmarksInSameFolder(snapshot, visibleKeys, bookmark);

    const idx = list.findIndex((candidate) => bookmarkSelectionKey(candidate) === key);
    if (idx >= 0) return { list, startIndex: idx };
    return { list: [bookmark], startIndex: 0 };
}

function flattenVisibleBookmarksInTreeOrder(
    nodes: BookmarksPanelSnapshot['vm']['folderTree'],
    visibleKeys: Set<string>
): Bookmark[] {
    const result: Bookmark[] = [];
    for (const node of nodes) {
        if (node.children.length > 0) {
            result.push(...flattenVisibleBookmarksInTreeOrder(node.children, visibleKeys));
        }
        for (const bookmark of node.bookmarks) {
            if (visibleKeys.has(bookmarkSelectionKey(bookmark))) result.push(bookmark);
        }
    }
    return result;
}

function getVisibleBookmarksInSameFolder(
    snapshot: BookmarksPanelSnapshot,
    visibleKeys: Set<string>,
    bookmark: Bookmark
): Bookmark[] {
    const node = findFolderNode(snapshot.vm.folderTree, bookmark.folderPath);
    if (node) return node.bookmarks.filter((candidate) => visibleKeys.has(bookmarkSelectionKey(candidate)));

    const list = snapshot.vm.bookmarks.filter((candidate) => candidate.folderPath === bookmark.folderPath);
    return list.length ? list : [bookmark];
}

function findFolderNode(
    nodes: BookmarksPanelSnapshot['vm']['folderTree'],
    path: string
): BookmarksPanelSnapshot['vm']['folderTree'][number] | null {
    for (const node of nodes) {
        if (node.folder.path === path) return node;
        if (node.children.length === 0) continue;
        const found = findFolderNode(node.children, path);
        if (found) return found;
    }
    return null;
}

export type BookmarksTabActions = {
    requestHidePanel(): void;
    getSaveContextOnly(): boolean;
    showPreview(params: {
        snapshot: BookmarksPanelSnapshot;
        bookmark: Bookmark;
        controller: BookmarksPanelController;
        onOpenConversation: (bookmark: Bookmark) => Promise<void>;
    }): Promise<void>;
    alertError(title: string, message: string): Promise<void>;
    confirmDeleteSelected(): Promise<boolean>;
    confirmDeleteFolder(path: string): Promise<boolean>;
    confirmDeleteBookmark(): Promise<boolean>;
    promptCreateFolderPath(): Promise<string | null>;
    promptFolderName(title: string): Promise<string | null>;
    promptBookmarkTitle(currentTitle: string): Promise<string | null>;
    pickFolder(currentFolderPath: string | null, theme: Theme): Promise<string | null>;
    showImportMergeSummary(params: {
        kind: 'info' | 'warning';
        title: string;
        body: HTMLElement;
    }): Promise<void>;
};

export function createNoopBookmarksTabActions(): BookmarksTabActions {
    return {
        requestHidePanel: () => {},
        getSaveContextOnly: () => false,
        async showPreview() {},
        async alertError() {},
        async confirmDeleteSelected() { return false; },
        async confirmDeleteFolder() { return false; },
        async confirmDeleteBookmark() { return false; },
        async promptCreateFolderPath() { return null; },
        async promptFolderName() { return null; },
        async promptBookmarkTitle() { return null; },
        async pickFolder() { return null; },
        async showImportMergeSummary() {},
    };
}

export function createBookmarksTabActions(params: {
    modal: ModalHost;
    readerPanel: ReaderPanel;
    onRequestHidePanel?: () => void;
    getSaveContextOnly?: () => boolean;
}): BookmarksTabActions {
    const requestHidePanel = params.onRequestHidePanel ?? (() => {});
    const getSaveContextOnly = params.getSaveContextOnly ?? (() => false);

    return {
        requestHidePanel,
        getSaveContextOnly,
        async showPreview({ snapshot, bookmark, controller, onOpenConversation }) {
            const { list, startIndex } = buildReaderScopeList(snapshot, bookmark);
            if (list.length === 0) return;

            const items: ReaderItem[] = list.map((candidate) => ({
                id: bookmarkSelectionKey(candidate),
                userPrompt: candidate.userMessage || candidate.title || '',
                content: candidate.aiResponse ?? '',
            }));

            await params.readerPanel.show(items, startIndex, controller.getTheme(), {
                profile: 'bookmark-preview',
                onOpenConversation: async (ctx) => {
                    const current = list[ctx.index] ?? null;
                    if (!current) return;
                    params.readerPanel.hide();
                    await onOpenConversation(current);
                },
            });
        },
        async alertError(title, message) {
            await params.modal.alert({
                kind: 'error',
                title,
                message,
                confirmText: t('btnOk'),
            });
        },
        async confirmDeleteSelected() {
            return params.modal.confirm({
                kind: 'warning',
                title: t('deleteSelectedTitle'),
                message: t('actionCannotBeUndone'),
                confirmText: t('btnDelete'),
                cancelText: t('btnCancel'),
                danger: true,
            });
        },
        async confirmDeleteFolder(path) {
            return params.modal.confirm({
                kind: 'warning',
                title: t('deleteFolder'),
                message: t('deleteFolderConfirm', path),
                confirmText: t('btnDelete'),
                cancelText: t('btnCancel'),
                danger: true,
            });
        },
        async confirmDeleteBookmark() {
            return params.modal.confirm({
                kind: 'warning',
                title: t('delete'),
                message: t('actionCannotBeUndone'),
                confirmText: t('btnDelete'),
                cancelText: t('btnCancel'),
                danger: true,
            });
        },
        async promptCreateFolderPath() {
            return params.modal.prompt({
                kind: 'info',
                title: t('createFolder'),
                message: t('promptNewFolderPath'),
                placeholder: t('folderPathPlaceholder'),
                defaultValue: '',
                confirmText: t('btnSave'),
                cancelText: t('btnCancel'),
                validate: (value) => {
                    const result = validateFolderPathInput(value);
                    return result.ok ? { ok: true } : { ok: false, message: result.message };
                },
            });
        },
        async promptFolderName(title) {
            return params.modal.prompt({
                kind: 'info',
                title,
                message: t('promptNewFolderName'),
                placeholder: t('folderNamePlaceholder'),
                defaultValue: '',
                confirmText: t('btnSave'),
                cancelText: t('btnCancel'),
                validate: (value) => {
                    const result = validateFolderSegmentName(value);
                    return result.ok ? { ok: true } : { ok: false, message: result.message };
                },
            });
        },
        async promptBookmarkTitle(currentTitle) {
            return params.modal.prompt({
                kind: 'info',
                title: t('renameBookmarkLabel'),
                message: t('enterBookmarkTitle'),
                placeholder: t('enterBookmarkTitle'),
                defaultValue: currentTitle,
                confirmText: t('btnSave'),
                cancelText: t('btnCancel'),
                validate: (value) => {
                    const result = validateBookmarkTitle(value);
                    return result.ok
                        ? { ok: true }
                        : { ok: false, message: titleValidationMessage(result.reason ?? 'empty', value) };
                },
            });
        },
        async pickFolder(currentFolderPath, theme) {
            const result = await bookmarkSaveDialog.open({
                theme,
                userPrompt: '',
                existingTitle: '',
                currentFolderPath,
                mode: 'folder-select',
            });
            if (!result.ok) return null;
            return result.folderPath;
        },
        async showImportMergeSummary({ kind, title, body }) {
            await params.modal.showCustom({ kind, title, body });
        },
    };
}

export function getMoveTargetParent(path: string): string | null {
    return PathUtils.getParentPath(path);
}
