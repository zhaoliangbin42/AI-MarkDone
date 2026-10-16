import { createWorkspaceNavigationButton } from '../components/WorkspaceNavigationButton';
import { flattenTree } from '../../../../../core/bookmarks/tree';
import { buildBookmarkDedupeKey } from '../../../../../core/bookmarks/keys';
import type { Bookmark, BookmarksKindFilter } from '../../../../../core/bookmarks/types';
import type { BookmarksPanelController, BookmarksPanelSnapshot } from '../../BookmarksPanelController';
import { createIcon } from '../../../components/Icon';
import { t } from '../../../components/i18n';
import { getRuntimeFailurePresentation } from '../../../components/runtimeFailurePresentation';
import { LibraryBookmarkPresentation } from '../LibraryBookmarkPresentation';
import { LibraryMarksView, type LibraryMarkType } from '../LibraryMarksView';
import type { LibraryAnnotationPort } from '../../BookmarksPanelPort';
import type { ModalHost } from '../../../components/ModalHost';
import { renderLibrarySelectionBar } from '../components/LibrarySelectionBar';
import { appendLibraryImportSummary, buildImportMergeReviewModalBody } from '../importMergeReview';
import type { LibraryRestoreCounts } from '../../../../../core/cloudBackup/library';
import { createNoopBookmarksTabActions, type BookmarksTabActions, getMoveTargetParent } from './bookmarksTabActions';
import {
    bookmarkIcon,
    messageSquareTextIcon,
    highlighterIcon,
    checkIcon,
    downloadIcon,
    folderPlusIcon,
    moveIcon,
    searchIcon,
    sortAlphaAscIcon,
    sortAZIcon,
    sortTimeAscIcon,
    sortTimeIcon,
    trashIcon,
    uploadIcon,
} from '../../../../../assets/workspaceIcons';

type Refs = {
    query: HTMLInputElement;
    kindButtons: Record<BookmarksKindFilter, HTMLButtonElement>;
    sortTimeBtn: HTMLButtonElement;
    sortAlphaBtn: HTMLButtonElement;
    importFile: HTMLInputElement;
    batch: HTMLElement;
    runtimeNotice: HTMLElement;
};

function tr(key: string, fallback: string): string {
    const translated = t(key);
    return !translated || translated === key ? fallback : translated;
}

function downloadJson(filename: string, data: unknown): void {
    try {
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        window.setTimeout(() => URL.revokeObjectURL(url), 500);
    } catch {
        // ignore
    }
}

export class BookmarksTabView {
    private controller: BookmarksPanelController;
    private actions: BookmarksTabActions;
    private root: HTMLElement;
    private refs: Refs;
    private snapshot: BookmarksPanelSnapshot | null = null;
    private treeViewport: LibraryBookmarkPresentation;
    private managing = false;
    private readonly heading = document.createElement('h2');
    private readonly navigation = document.createElement('div');
    private marks: LibraryMarksView | null = null;
    private activeMarkType: LibraryMarkType | null = null;
    private bookmarkBody: HTMLElement | null = null;

    constructor(params: {
        controller: BookmarksPanelController;
        actions?: BookmarksTabActions;
        modal?: ModalHost;
        annotations?: LibraryAnnotationPort;
        onOpenAnnotationTemplates?: () => void;
        [key: string]: unknown;
    }) {
        this.controller = params.controller;
        this.actions = params.actions ?? createNoopBookmarksTabActions();

        this.root = document.createElement('div');
        this.root.className = 'bookmarks-tab-content';
        this.treeViewport = new LibraryBookmarkPresentation({
            controller: this.controller,
            actions: {
                selectFolder: (path) => this.controller.selectFolder(path),
                toggleFolderExpanded: (path) => this.controller.toggleFolderExpanded(path),
                toggleFolderSelection: (path) => this.controller.toggleFolderSelection(path),
                toggleBookmarkSelection: (bookmark) => this.controller.toggleBookmarkSelection(bookmark),
                openBookmark: async (bookmark) => await this.openPreviewInReader(bookmark),
                goToBookmark: async (bookmark) => await this.goTo(bookmark),
                copyBookmark: async (bookmark) => await this.controller.copyBookmarkMarkdown(bookmark),
                renameBookmark: async (bookmark) => await this.renameBookmark(bookmark),
                moveBookmark: async (bookmark) => await this.moveBookmark(bookmark),
                deleteBookmark: async (bookmark) => await this.deleteBookmark(bookmark),
                createFolder: async () => await this.createFolder(),
                createSubfolder: async (path) => await this.createSubfolder(path),
                renameFolder: async (path) => await this.renameFolder(path),
                moveFolder: async (path) => await this.moveFolder(path),
                deleteFolder: async (path) => await this.deleteFolder(path),
            },
        });

        const toolbar = document.createElement('div');
        toolbar.className = 'toolbar-row toolbar-row--bookmarks';

        const search = document.createElement('div');
        search.className = 'search-field aimd-field-shell';
        search.appendChild(createIcon(searchIcon));
        const query = document.createElement('input');
        query.type = 'text';
        query.className = 'aimd-field-control';
        query.dataset.role = 'bookmark-query';
        query.placeholder = t('searchBookmarksPlaceholder');
        query.addEventListener('input', (event) => {
            event.stopPropagation();
            const value = query.value;
            this.controller.clearSelection();
            this.controller.setQuery(value);
        });
        search.appendChild(query);

        const kind = document.createElement('div');
        kind.className = 'bookmark-kind-filter';
        kind.dataset.role = 'bookmark-kind-filter';
        kind.setAttribute('role', 'group');
        kind.setAttribute('aria-label', t('bookmarkTypeFilterLabel'));
        const kindButtons = {} as Record<BookmarksKindFilter, HTMLButtonElement>;
        for (const option of [
            { value: 'all', label: t('bookmarkTypeAll') },
            { value: 'page', label: t('bookmarkTypePages') },
            { value: 'message', label: t('bookmarkTypeMessages') },
        ] as Array<{ value: BookmarksKindFilter; label: string }>) {
            const el = document.createElement('button');
            el.type = 'button';
            el.className = 'bookmark-kind-filter__button';
            el.dataset.value = option.value;
            el.textContent = option.label;
            el.setAttribute('aria-pressed', 'false');
            el.addEventListener('click', () => {
                this.controller.clearSelection();
                this.controller.setKindFilter(option.value);
            });
            kindButtons[option.value] = el;
            kind.appendChild(el);
        }

        const sortTimeBtn = this.makeIconButton({
            icon: sortTimeIcon,
            label: t('sortByTimeLabel'),
            action: 'toggle-sort-time',
            onClick: () => this.toggleTimeSort(),
        });
        const sortAlphaBtn = this.makeIconButton({
            icon: sortAZIcon,
            label: t('sortAlphaLabel'),
            action: 'toggle-sort-alpha',
            onClick: () => this.toggleAlphaSort(),
        });
        sortTimeBtn.classList.add('bookmark-toolbar-sort-button');
        sortAlphaBtn.classList.add('bookmark-toolbar-sort-button');

        const folderCreateBtn = this.makeIconButton({
            icon: folderPlusIcon,
            label: t('createFolder'),
            action: 'create-folder',
            onClick: () => void this.createFolder(),
        });

        const importBtn = this.makeIconButton({
            icon: uploadIcon,
            label: t('importBookmarks'),
            action: 'import-bookmarks',
            onClick: () => this.refs.importFile.click(),
        });
        const importFile = document.createElement('input');
        importFile.type = 'file';
        importFile.accept = 'application/json';
        importFile.style.display = 'none';
        importFile.dataset.role = 'import-file';

        const exportBtn = this.makeIconButton({
            icon: downloadIcon,
            label: t('exportAllBookmarksLabel'),
            action: 'export-all-bookmarks',
            onClick: () => void this.exportAll(),
        });
        importFile.addEventListener('change', (event) => void this.importFromFile(event));

        const sortGroup = document.createElement('div');
        sortGroup.className = 'toolbar-actions library-bookmark-sort';
        sortGroup.append(sortTimeBtn, sortAlphaBtn);

        const actionsGroup = document.createElement('div');
        actionsGroup.className = 'toolbar-actions library-bookmark-actions';
        actionsGroup.append(
            folderCreateBtn,
            importBtn,
            exportBtn
        );

        const toolbarRight = document.createElement('div');
        toolbarRight.className = 'toolbar-actions library-bookmark-toolbar-actions';
        toolbarRight.append(kind, sortGroup, actionsGroup, importFile);

        const manage = this.makeIconButton({ icon: checkIcon, label: t('libraryManage'), action: 'manage-library', onClick: () => {
            this.managing = !this.managing;
            this.controller.clearSelection();
            this.treeViewport.setManagementMode(this.managing);
            if (this.snapshot) this.update(this.snapshot);
        } });
        toolbarRight.append(manage);
        const heading = document.createElement('div');
        heading.className = 'library-heading';
        heading.append(this.heading, toolbarRight);
        toolbar.append(search);
        this.root.append(heading);
        const all = createWorkspaceNavigationButton(t('tabBookmarks'), bookmarkIcon, () => {
            this.showMarks(null);
            this.controller.clearSelection(); this.controller.setQuery(''); this.controller.selectFolder(null);
        });
        all.dataset.action = 'library-bookmarks';
        this.navigation.className = 'library-navigation';
        this.navigation.append(all, this.treeViewport.getNavigationElement());

        const batch = document.createElement('div');
        batch.className = 'batch-bar library-selection-bar';

        const runtimeNotice = document.createElement('div');
        runtimeNotice.className = 'bookmarks-runtime-notice';
        runtimeNotice.setAttribute('role', 'alert');
        runtimeNotice.hidden = true;

        this.root.append(toolbar, runtimeNotice, batch, this.treeViewport.getElement());

        this.refs = {
            query,
            kindButtons,
            sortTimeBtn,
            sortAlphaBtn,
            importFile,
            batch,
            runtimeNotice,
        };
        if (params.modal) {
            this.bookmarkBody = document.createElement('div'); this.bookmarkBody.className = 'library-bookmark-body';
            this.bookmarkBody.append(...Array.from(this.root.childNodes)); this.root.append(this.bookmarkBody);
            this.marks = new LibraryMarksView({modal: params.modal, annotations: params.annotations, openTemplates: params.onOpenAnnotationTemplates ?? (() => undefined)});
            this.root.append(this.marks.root);
            this.navigation.append(this.marks.folders.root);
            for (const [type, key, icon] of [['annotations','libraryAnnotations', messageSquareTextIcon], ['highlights','libraryHighlights',highlighterIcon]] as const) {
                const button = createWorkspaceNavigationButton(t(key), icon, () => this.showMarks(type));
                button.dataset.action = `library-${type}`;
                this.navigation.insertBefore(button, this.treeViewport.getNavigationElement());
            }
        }
    }

    private showMarks(type: LibraryMarkType | null): void {
        if (this.marks?.isBusy()) return;
        this.activeMarkType = type; this.controller.clearSelection(); this.managing = false; this.treeViewport.setManagementMode(false); this.treeViewport.closeDetail();
        if (this.bookmarkBody) this.bookmarkBody.hidden = !!type;
        this.treeViewport.getNavigationElement().hidden = !!type;
        this.marks?.activate(type);
        if (this.snapshot) this.update(this.snapshot);
    }

    getElement(): HTMLElement {
        return this.root;
    }

    getNavigationElement(): HTMLElement { return this.navigation; }

    focusPrimaryInput(): void {
        if (this.activeMarkType) { this.marks?.focusSearch(); return; }
        this.refs.query.focus();
        this.refs.query.select();
    }

    getTreeScrollTop(): number {
        return this.treeViewport.getScrollTop();
    }

    restoreTreeScroll(top: number): void {
        this.treeViewport.restoreScroll(top);
    }

    consumeEscape(): boolean {
        const menu = (this.activeMarkType ? this.marks?.root : this.root)?.querySelector('details[open]') || this.navigation.querySelector('details[open]');
        if (menu) { menu.removeAttribute('open'); menu.querySelector('summary')?.focus(); return true; }
        if (this.activeMarkType) return this.marks?.closeDetail() ?? false;
        return this.treeViewport.closeDetail();
    }

    dismissTransientUi(): void {
        this.treeViewport.dismissTransientUi();
    }

    destroy(): void {
        this.marks?.destroy();
        this.treeViewport.destroy();
    }

    update(snap: BookmarksPanelSnapshot): void {
        this.snapshot = snap;
        this.heading.textContent = snap.vm.selectedFolderPath?.split('/').pop() || t('tabBookmarks');
        this.navigation.querySelector<HTMLElement>('[data-action="library-bookmarks"]')?.setAttribute('data-active', String(!this.activeMarkType));
        for (const type of ['annotations','highlights']) this.navigation.querySelector(`[data-action="library-${type}"]`)?.setAttribute('data-active', String(this.activeMarkType === type));
        this.refs.query.placeholder = t('searchBookmarksPlaceholder');

        // In Shadow DOM the document's active element is the host, not this input.
        if ((this.refs.query.getRootNode() as Document | ShadowRoot).activeElement !== this.refs.query) {
            this.refs.query.value = snap.vm.query;
        }

        for (const [kind, button] of Object.entries(this.refs.kindButtons) as Array<[BookmarksKindFilter, HTMLButtonElement]>) {
            const selected = kind === snap.vm.kind;
            button.dataset.active = selected ? '1' : '0';
            button.setAttribute('aria-pressed', selected ? 'true' : 'false');
        }

        const selectedBookmarkCount = this.countSelectedBookmarks(snap.selectedKeys);
        this.renderBatchBar(this.refs.batch, selectedBookmarkCount);
        this.renderRuntimeNotice(snap);
        this.treeViewport.update(snap);
        this.updateSortButtons(snap.vm.sortMode);
    }

    private renderRuntimeNotice(snapshot: BookmarksPanelSnapshot): void {
        const notice = this.refs.runtimeNotice;
        notice.replaceChildren();
        delete notice.dataset.role;
        notice.hidden = true;
        if (snapshot.dataState?.kind !== 'error') return;

        const presentation = getRuntimeFailurePresentation(snapshot.dataState.failure, tr);
        const text = document.createElement('span');
        text.textContent = presentation.message;
        const action = document.createElement('button');
        action.type = 'button';
        action.className = 'secondary-btn';
        action.dataset.action = presentation.action === 'reload' ? 'reload-bookmarks-page' : 'retry-bookmarks-load';
        action.textContent = presentation.actionLabel;
        action.addEventListener('click', () => {
            if (presentation.action === 'reload') {
                window.location.reload();
                return;
            }
            void this.controller.refreshAll();
        });
        notice.append(text, action);
        notice.dataset.role = 'bookmarks-runtime-error';
        notice.hidden = false;
    }

    private renderBatchBar(container: HTMLElement, selectedBookmarkCount: number): void {
        container.dataset.active = this.managing ? '1' : '0';
        container.hidden = !this.managing;
        container.inert = !this.managing;

        const selectedFolderCount = [...(this.snapshot?.selectedKeys ?? [])].filter((key) => key.startsWith('folder:')).length;
        const moveBtn = this.makeIconButton({
            icon: moveIcon,
            label: t('moveSelected'),
            action: 'batch-move',
            onClick: async () => {
                await this.actions.pickFolder(this.controller.getDefaultFolderPath(), this.controller.getTheme(), {
                    onSubmit: this.mutationSubmit(
                        (target) => this.controller.batchMove(target),
                        (target, data) => { this.treeViewport.closeDetail(); this.controller.setPanelStatus(data?.missing ? t('libraryPartialMove', [String(data.moved), String(data.missing)]) : t('libraryMovedTo', target)); },
                    ),
                });
            },
        });
        moveBtn.disabled = selectedBookmarkCount === 0;

        const delBtn = this.makeIconButton({
            icon: trashIcon,
            label: t('deleteSelected'),
            kind: 'danger',
            action: 'batch-delete',
            onClick: async () => {
                const before = this.controller.getSnapshot();
                const selectedFolders = [...before.selectedKeys].filter(key => key.startsWith('folder:')).map(key => key.slice(7));
                const inSelectedFolder = (path: string) => selectedFolders.some(parent => path === parent || path.startsWith(parent + '/'));
                const records = flattenTree(before.vm.folderTree).flatMap(node => node.bookmarks);
                const keys = new Set(records.filter(record => inSelectedFolder(record.folderPath) || before.selectedKeys.has(`bm:${buildBookmarkDedupeKey(record)}`)).map(buildBookmarkDedupeKey));
                const folders = before.folders.filter(folder => inSelectedFolder(folder.path));
                if (!await this.actions.confirmDeleteSelected({ bookmarks: keys.size, folders: folders.length })) return;
                const result = await this.controller.batchDelete();
                if (!result.ok) { this.controller.setPanelStatus(result.message); return; }
                const after = this.controller.getSnapshot();
                if (after.dataState.kind !== 'ready') { this.controller.setPanelStatus(t('librarySavedRefreshFailed')); return; }
                const remaining = new Set(flattenTree(after.vm.folderTree).flatMap(node => node.bookmarks).map(buildBookmarkDedupeKey));
                const removed = [...keys].filter(key => !remaining.has(key)).length;
                const removedFolders = folders.filter(folder => !after.folderPaths.includes(folder.path)).length;
                this.controller.setPanelStatus(t('libraryDeletedSummary', [String(removed), String(removedFolders)]));
            },
        });
        delBtn.disabled = selectedBookmarkCount === 0 && selectedFolderCount === 0;

        const exportBtn = this.makeIconButton({
            icon: downloadIcon,
            label: t('exportSelected'),
            action: 'batch-export',
            onClick: async () => void this.exportSelected(),
        });
        exportBtn.disabled = selectedBookmarkCount === 0;

        const matchingBookmarks = this.snapshot?.vm.bookmarks ?? [];
        renderLibrarySelectionBar(container, {
            summary: t('librarySelectionSummary', [String(selectedBookmarkCount), String(selectedFolderCount)]),
            selectPage: {
                action: 'select-page', label: t('librarySelectPage'),
                onClick: () => this.treeViewport.selectPage(),
                disabled: matchingBookmarks.length === 0,
            },
            selectAll: {
                action: 'select-all-results', label: t('librarySelectAllBookmarks'),
                onClick: () => this.controller.selectBookmarks(matchingBookmarks),
                disabled: matchingBookmarks.length === 0,
            },
            invert: {
                action: 'invert-selection', label: t('libraryInvertBookmarks'),
                onClick: () => this.controller.invertBookmarkSelection(matchingBookmarks),
                disabled: matchingBookmarks.length === 0,
            },
            clear: {
                action: 'clear-selection', label: t('clearSelection'),
                onClick: () => this.controller.clearSelection(),
                disabled: selectedBookmarkCount === 0 && selectedFolderCount === 0,
            },
            actions: [moveBtn, delBtn, exportBtn],
            done: {
                action: 'manage-done', label: t('libraryManageDone'),
                onClick: () => { this.managing = false; this.controller.clearSelection(); this.treeViewport.setManagementMode(false); if (this.snapshot) this.update(this.snapshot); },
            },
        });
    }

    private updateSortButtons(mode: string): void {
        const timeIsActive = mode.startsWith('time');
        const alphaIsActive = mode.startsWith('alpha');
        this.refs.sortTimeBtn.dataset.active = timeIsActive ? '1' : '0';
        this.refs.sortAlphaBtn.dataset.active = alphaIsActive ? '1' : '0';

        const timeIcon = mode === 'time-asc' ? sortTimeAscIcon : sortTimeIcon;
        const alphaIcon = mode === 'alpha-asc' ? sortAlphaAscIcon : sortAZIcon;

        this.refs.sortTimeBtn.innerHTML = timeIcon;
        this.refs.sortAlphaBtn.innerHTML = alphaIcon;
    }

    private toggleTimeSort(): void {
        const mode = this.snapshot?.vm.sortMode ?? 'time-desc';
        if (mode === 'time-desc') this.controller.setSortMode('time-asc');
        else this.controller.setSortMode('time-desc');
    }

    private toggleAlphaSort(): void {
        const mode = this.snapshot?.vm.sortMode ?? 'alpha-asc';
        if (mode === 'alpha-asc') this.controller.setSortMode('alpha-desc');
        else this.controller.setSortMode('alpha-asc');
    }

    private async exportAll(): Promise<void> {
        const res = await this.controller.exportAll(true);
        if (!res.ok) {
            await this.actions.alertError(t('exportBookmarks'), res.message);
            return;
        }
        downloadJson('ai-markdone-library.json', res.data.payload);
        this.controller.setPanelStatus(t('exportedStatus'));
    }

    private async exportSelected(): Promise<void> {
        const res = await this.controller.exportSelected(true);
        if (!res.ok) {
            await this.actions.alertError(t('exportSelected'), res.message);
            return;
        }
        downloadJson('ai-markdone-bookmarks-selected.json', res.data.payload);
        this.controller.setPanelStatus(t('exportedStatus'));
    }

    /** Keeps the editor open on failure; once written, retry only refreshes the projection. */
    private mutationSubmit(
        mutate: (value: string) => Promise<{ ok: true; data: any } | { ok: false; message: string }>,
        complete: (value: string, data: any) => void,
    ): (value: string) => Promise<string | null> {
        let committed: { value: string; data: any } | null = null;
        return async (value) => {
            if (committed) {
                if (value !== committed.value) return t('librarySavedValueChanged');
                await this.controller.refreshAll();
            }
            else {
                const result = await mutate(value);
                if (!result.ok) return result.message;
                committed = { value, data: result.data };
            }
            const state = this.controller.getSnapshot().dataState;
            if (state?.kind !== 'ready') return t('librarySavedRefreshFailed');
            complete(committed.value, committed.data);
            return null;
        };
    }

    private async createFolder(): Promise<void> {
        await this.actions.promptCreateFolderPath(this.mutationSubmit(
            (path) => this.controller.createFolder(path),
            (path) => { this.controller.selectFolder(path); this.controller.setPanelStatus(t('folderCreatedStatus')); },
        ));
    }

    private async createSubfolder(parentPath: string): Promise<void> {
        await this.actions.promptFolderName(t('newSubfolder'), '', this.mutationSubmit(
            (name) => this.controller.createFolder(`${parentPath}/${name}`),
            (name) => { this.controller.selectFolder(`${parentPath}/${name}`); this.controller.setPanelStatus(t('folderCreatedStatus')); },
        ));
    }

    private async renameFolder(path: string): Promise<void> {
        await this.actions.promptFolderName(t('renameFolder'), path.split('/').pop(), this.mutationSubmit(
            (name) => this.controller.renameFolder(path, name),
            (name) => { this.controller.selectFolder([getMoveTargetParent(path), name].filter(Boolean).join('/')); this.controller.setPanelStatus(t('renamedStatus')); },
        ));
    }

    private async moveFolder(path: string): Promise<void> {
        await this.actions.pickFolder(getMoveTargetParent(path), this.controller.getTheme(), {
            excludeCurrent: true, moveSourcePath: path, allowRoot: true,
            onSubmit: this.mutationSubmit(
                (parent) => this.controller.moveFolder(path, parent === '/' ? '' : parent),
                (parent) => { this.controller.selectFolder([parent === '/' ? '' : parent, path.split('/').pop()].filter(Boolean).join('/')); this.controller.setPanelStatus(t('movedStatus')); },
            ),
        });
    }

    private async moveBookmark(bookmark: Bookmark): Promise<void> {
        await this.actions.pickFolder(bookmark.folderPath || this.controller.getDefaultFolderPath(), this.controller.getTheme(), {
            excludeCurrent: true,
            onSubmit: this.mutationSubmit(
                (target) => this.controller.moveBookmark(bookmark, target),
                (target, data) => {
                    this.treeViewport.closeDetail();
                    this.controller.setPanelStatus(data?.missing ? t('libraryPartialMove', [String(data.moved), String(data.missing)]) : t('libraryMovedTo', target));
                },
            ),
        });
    }

    private async renameBookmark(bookmark: Bookmark): Promise<void> {
        await this.actions.promptBookmarkTitle(bookmark.title, this.mutationSubmit(
            (title) => this.controller.renameBookmark(bookmark, title),
            () => this.controller.setPanelStatus(t('renamedStatus')),
        ));
    }

    private async deleteFolder(path: string): Promise<void> {
        const snapshot = this.controller.getSnapshot();
        const node = snapshot.folders.find((folder) => folder.path.startsWith(path + '/'));
        const hasBookmarks = snapshot.vm.folderTree.some(function contains(folder): boolean {
            return folder.bookmarks.some((bookmark) => bookmark.folderPath === path || bookmark.folderPath.startsWith(path + '/')) || folder.children.some(contains);
        });
        if (node || hasBookmarks) { await this.actions.alertError(t('deleteFolder'), t('libraryFolderNotEmpty')); return; }
        const ok = await this.actions.confirmDeleteFolder(path);
        if (!ok) return;
        const res = await this.controller.deleteFolder(path);
        if (!res.ok) await this.actions.alertError(t('deleteFolder'), res.message);
        this.controller.setPanelStatus(res.ok ? (this.controller.getSnapshot().dataState.kind === 'ready' ? t('deletedStatus') : t('librarySavedRefreshFailed')) : res.message);
    }

    private async deleteBookmark(b: Bookmark): Promise<void> {
        const ok = await this.actions.confirmDeleteBookmark();
        if (!ok) return;
        await this.controller.deleteBookmark(b);
        if (this.controller.getSnapshot().dataState.kind !== 'ready') this.controller.setPanelStatus(t('librarySavedRefreshFailed'));
    }

    private async goTo(b: Bookmark): Promise<void> {
        this.actions.requestHidePanel();
        await this.controller.goToBookmark(b);
    }

    private async openPreviewInReader(b: Bookmark): Promise<void> {
        if (b.kind === 'page') {
            await this.goTo(b);
            return;
        }
        const snap = this.snapshot;
        if (!snap) return;
        await this.actions.showPreview({
            snapshot: snap,
            bookmark: b,
            controller: this.controller,
            onOpenConversation: async (bookmark) => {
                await this.goTo(bookmark);
            },
        });
    }

    private async importFromFile(event: Event): Promise<void> {
        const input = event.target as HTMLInputElement | null;
        const file = input?.files?.[0] ?? null;
        if (input) input.value = '';
        if (!file) return;

        const jsonText = await file.text();
        const saveContextOnly = this.actions.getSaveContextOnly();
        const res = await this.controller.importJsonText(jsonText, saveContextOnly);
        if (!res.ok) {
            await this.actions.alertError(t('importBookmarks'), res.message);
            return;
        }

        this.controller.setPanelStatus(t('importedStatus'));
        await this.showImportMergeSummary(res.data);
    }

    private async showImportMergeSummary(result: {
        imported?: number;
        skippedDuplicates?: number;
        renamed?: number;
        warnings?: string[];
        folderCreateFailures?: number;
        conflicts?: number;
        library?: LibraryRestoreCounts | null;
    }): Promise<void> {
        const review = buildImportMergeReviewModalBody(result);
        const libraryConflicts = result.library ? appendLibraryImportSummary(review.body, result.library) : 0;
        if (result.conflicts) {
            const note = document.createElement('p');
            note.textContent = t('libraryImportBookmarkConflicts', String(result.conflicts));
            review.body.append(note);
        }

        await this.actions.showImportMergeSummary({
            kind: libraryConflicts || result.conflicts ? 'warning' : review.kind,
            title: t('importMergeReviewTitle'),
            body: review.body,
        });
    }

    private makeIconButton(params: {
        icon: string;
        label: string;
        action?: string;
        kind?: 'default' | 'primary' | 'danger';
        onClick: () => void | Promise<void>;
    }): HTMLButtonElement {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = `icon-btn${params.kind === 'danger' ? ' icon-btn--danger' : ''}`;
        btn.title = params.label;
        btn.dataset.tooltip = params.label;
        btn.setAttribute('aria-label', params.label);
        if (params.action) {
            btn.dataset.action = params.action;
        }
        btn.appendChild(createIcon(params.icon));
        btn.addEventListener('click', async (e) => {
            e.preventDefault();
            e.stopPropagation();
            btn.disabled = true;
            try { await params.onClick(); } finally { btn.disabled = false; }
        });
        return btn;
    }

    private countSelectedBookmarks(keys: Set<string>): number {
        let count = 0;
        for (const key of keys) if (key.startsWith('bm:')) count += 1;
        return count;
    }
}
