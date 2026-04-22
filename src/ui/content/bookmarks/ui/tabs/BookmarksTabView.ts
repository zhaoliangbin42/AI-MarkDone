import type { Bookmark } from '../../../../../core/bookmarks/types';
import type { BookmarksPanelController, BookmarksPanelSnapshot } from '../../BookmarksPanelController';
import { createIcon } from '../../../components/Icon';
import { t } from '../../../components/i18n';
import { PlatformDropdown } from '../components/PlatformDropdown';
import { BookmarksTreeViewport } from '../BookmarksTreeViewport';
import { createNoopBookmarksTabActions, type BookmarksTabActions, getMoveTargetParent } from './bookmarksTabActions';
import {
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
    xIcon,
} from '../../../../../assets/icons';

type Refs = {
    query: HTMLInputElement;
    platform: PlatformDropdown;
    sortTimeBtn: HTMLButtonElement;
    sortAlphaBtn: HTMLButtonElement;
    importFile: HTMLInputElement;
    batch: HTMLElement;
};

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
    private treeViewport: BookmarksTreeViewport;

    constructor(params: {
        controller: BookmarksPanelController;
        actions?: BookmarksTabActions;
        [key: string]: unknown;
    }) {
        this.controller = params.controller;
        this.actions = params.actions ?? createNoopBookmarksTabActions();

        this.root = document.createElement('div');
        this.root.className = 'bookmarks-tab-content';
        this.treeViewport = new BookmarksTreeViewport({
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
                importBookmarks: async () => this.refs.importFile.click(),
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
            this.controller.setQuery(query.value);
        });
        search.appendChild(query);

        const platform = new PlatformDropdown({
            onChange: (value) => this.controller.setPlatform(value),
        });

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
        sortGroup.className = 'toolbar-actions';
        sortGroup.append(sortTimeBtn, sortAlphaBtn);

        const actionsGroup = document.createElement('div');
        actionsGroup.className = 'toolbar-actions';
        actionsGroup.append(
            folderCreateBtn,
            importBtn,
            exportBtn
        );

        const toolbarRight = document.createElement('div');
        toolbarRight.className = 'toolbar-actions';
        toolbarRight.append(sortGroup, actionsGroup, importFile);

        toolbar.append(search, platform.getElement(), toolbarRight);

        const batch = document.createElement('div');
        batch.className = 'batch-bar';

        this.root.append(toolbar, batch, this.treeViewport.getElement());

        this.refs = {
            query,
            platform,
            sortTimeBtn,
            sortAlphaBtn,
            importFile,
            batch,
        };
    }

    getElement(): HTMLElement {
        return this.root;
    }

    focusPrimaryInput(): void {
        this.refs.query.focus();
        this.refs.query.select();
    }

    getTreeScrollTop(): number {
        return this.treeViewport.getScrollTop();
    }

    restoreTreeScroll(top: number): void {
        this.treeViewport.restoreScroll(top);
    }

    dismissTransientUi(): void {
        this.refs.platform.close();
        this.treeViewport.dismissTransientUi();
    }

    destroy(): void {
        this.refs.platform.close();
        this.treeViewport.destroy();
    }

    update(snap: BookmarksPanelSnapshot): void {
        this.snapshot = snap;
        this.refs.query.placeholder = t('searchBookmarksPlaceholder');

        if (document.activeElement !== this.refs.query) {
            this.refs.query.value = snap.vm.query;
        }

        const platforms = this.controller.getPlatforms();
        this.refs.platform.setItems(platforms.map((value) => ({
            value,
            label: value === 'All' ? t('allPlatforms') : value,
        })));
        this.refs.platform.setValue(snap.vm.platform);

        const selectedBookmarkCount = this.countSelectedBookmarks(snap.selectedKeys);
        this.renderBatchBar(this.refs.batch, selectedBookmarkCount);
        this.treeViewport.update(snap);
        this.updateSortButtons(snap.vm.sortMode);
    }

    private renderBatchBar(container: HTMLElement, selectedBookmarkCount: number): void {
        container.replaceChildren();
        container.dataset.active = selectedBookmarkCount > 0 ? '1' : '0';

        const label = document.createElement('div');
        label.className = 'batch-label';
        label.textContent = selectedBookmarkCount > 0 ? t('selectedCount', String(selectedBookmarkCount)) : '';

        const actions = document.createElement('div');
        actions.className = 'batch-actions';

        const clearBtn = this.makeIconButton({
            icon: xIcon,
            label: t('clearSelection'),
            action: 'batch-clear',
            onClick: () => this.controller.clearSelection(),
        });
        clearBtn.disabled = selectedBookmarkCount === 0;

        const moveBtn = this.makeIconButton({
            icon: moveIcon,
            label: t('moveSelected'),
            action: 'batch-move',
            onClick: async () => {
                const target = await this.actions.pickFolder(this.controller.getDefaultFolderPath(), this.controller.getTheme());
                if (target === null) return;
                const res = await this.controller.batchMove(target);
                this.controller.setPanelStatus(res.ok ? t('movedStatus') : res.message);
            },
        });
        moveBtn.disabled = selectedBookmarkCount === 0;

        const delBtn = this.makeIconButton({
            icon: trashIcon,
            label: t('deleteSelected'),
            kind: 'danger',
            action: 'batch-delete',
            onClick: async () => {
                const ok = await this.actions.confirmDeleteSelected();
                if (!ok) return;
                const res = await this.controller.batchDelete();
                this.controller.setPanelStatus(res.ok ? t('deletedStatus') : res.message);
            },
        });
        delBtn.disabled = selectedBookmarkCount === 0;

        const exportBtn = this.makeIconButton({
            icon: downloadIcon,
            label: t('exportSelected'),
            action: 'batch-export',
            onClick: async () => void this.exportSelected(),
        });
        exportBtn.disabled = selectedBookmarkCount === 0;

        actions.append(moveBtn, delBtn, exportBtn, clearBtn);
        container.append(label, actions);
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
        downloadJson('ai-markdone-bookmarks.json', res.data.payload);
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

    private async createFolder(): Promise<void> {
        const path = await this.actions.promptCreateFolderPath();
        if (path === null) return;
        const res = await this.controller.createFolder(path);
        this.controller.setPanelStatus(res.ok ? t('folderCreatedStatus') : res.message);
        if (!res.ok) {
            await this.actions.alertError(t('createFolder'), res.message);
        }
    }

    private async createSubfolder(parentPath: string): Promise<void> {
        const name = await this.actions.promptFolderName(t('newSubfolder'));
        if (name === null) return;
        const path = `${parentPath}/${name}`;
        const res = await this.controller.createFolder(path);
        this.controller.setPanelStatus(res.ok ? t('folderCreatedStatus') : res.message);
        if (!res.ok) {
            await this.actions.alertError(t('createFolder'), res.message);
        } else {
            this.controller.toggleFolderExpanded(parentPath);
        }
    }

    private async renameFolder(path: string): Promise<void> {
        const name = await this.actions.promptFolderName(t('renameFolder'));
        if (name === null) return;
        const res = await this.controller.renameFolder(path, name);
        if (!res.ok) await this.actions.alertError(t('renameFolder'), res.message);
        this.controller.setPanelStatus(res.ok ? t('renamedStatus') : res.message);
    }

    private async moveFolder(path: string): Promise<void> {
        const parent = await this.actions.pickFolder(getMoveTargetParent(path), this.controller.getTheme());
        if (parent === null) return;
        const res = await this.controller.moveFolder(path, parent);
        if (!res.ok) await this.actions.alertError(t('moveFolder'), res.message);
        this.controller.setPanelStatus(res.ok ? t('movedStatus') : res.message);
    }

    private async moveBookmark(bookmark: Bookmark): Promise<void> {
        const target = await this.actions.pickFolder(bookmark.folderPath || this.controller.getDefaultFolderPath(), this.controller.getTheme());
        if (target === null) return;
        const res = await this.controller.moveBookmark(bookmark, target);
        if (!res.ok) await this.actions.alertError(t('moveBookmarkLabel'), res.message);
        this.controller.setPanelStatus(res.ok ? t('movedStatus') : res.message);
    }

    private async renameBookmark(bookmark: Bookmark): Promise<void> {
        const title = await this.actions.promptBookmarkTitle(bookmark.title);
        if (title === null) return;
        const res = await this.controller.renameBookmark(bookmark, title);
        if (!res.ok) await this.actions.alertError(t('renameBookmarkLabel'), res.message);
        this.controller.setPanelStatus(res.ok ? t('renamedStatus') : res.message);
    }

    private async deleteFolder(path: string): Promise<void> {
        const ok = await this.actions.confirmDeleteFolder(path);
        if (!ok) return;
        const res = await this.controller.deleteFolder(path);
        if (!res.ok) await this.actions.alertError(t('deleteFolder'), res.message);
        this.controller.setPanelStatus(res.ok ? t('deletedStatus') : res.message);
    }

    private async deleteBookmark(b: Bookmark): Promise<void> {
        const ok = await this.actions.confirmDeleteBookmark();
        if (!ok) return;
        await this.controller.deleteBookmark(b);
    }

    private async goTo(b: Bookmark): Promise<void> {
        this.actions.requestHidePanel();
        await this.controller.goToBookmark(b);
    }

    private async openPreviewInReader(b: Bookmark): Promise<void> {
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
    }): Promise<void> {
        const body = document.createElement('div');
        const summarySection = document.createElement('section');
        summarySection.className = 'merge-section merge-section--summary';
        const summaryHeading = document.createElement('div');
        summaryHeading.className = 'merge-section__heading';
        summaryHeading.textContent = t('importMergeSummaryHeading');
        const summary = document.createElement('div');
        summary.className = 'merge-summary';

        const items = [
            { label: t('importMergeSummaryImported'), value: String(result.imported ?? 0) },
            { label: t('importMergeSummarySkippedDuplicates'), value: String(result.skippedDuplicates ?? 0) },
            { label: t('importMergeSummaryRenamedTitles'), value: String(result.renamed ?? 0) },
            { label: t('importMergeSummaryFolderFallbacks'), value: String(result.folderCreateFailures ?? 0) },
        ];

        for (const item of items) {
            const article = document.createElement('article');
            article.className = 'merge-summary-item';
            const label = document.createElement('span');
            label.className = 'merge-summary-item__label';
            label.textContent = item.label;
            const value = document.createElement('strong');
            value.textContent = item.value;
            article.append(label, value);
            summary.appendChild(article);
        }

        summarySection.append(summaryHeading, summary);
        body.appendChild(summarySection);

        const detailSection = document.createElement('section');
        detailSection.className = 'merge-section merge-section--detail';
        const detailHeading = document.createElement('div');
        detailHeading.className = 'merge-section__heading';
        detailHeading.textContent = t('importMergeDetailsHeading');
        const entries = document.createElement('div');
        entries.className = 'merge-entry-list';
        const warningMessages = Array.isArray(result.warnings) ? result.warnings : [];
        const rows = [
            {
                title: t('importMergeImportedBookmarksTitle'),
                detail: t('importMergeImportedBookmarksDetail', String(result.imported ?? 0)),
                status: 'import',
            },
            {
                title: t('importMergeDuplicateBookmarksTitle'),
                detail: t('importMergeDuplicateBookmarksDetail', String(result.skippedDuplicates ?? 0)),
                status: 'duplicate',
            },
            {
                title: t('importMergeRenamedTitlesTitle'),
                detail: t('importMergeRenamedTitlesDetail', String(result.renamed ?? 0)),
                status: 'rename',
            },
            ...warningMessages.map((warning) => ({ title: t('importMergeWarningTitle'), detail: warning, status: 'normal' as const })),
        ];

        for (const row of rows) {
            const article = document.createElement('article');
            article.className = 'merge-entry';
            const top = document.createElement('div');
            top.className = 'merge-entry__top';
            const title = document.createElement('strong');
            title.textContent = row.title;
            const status = document.createElement('span');
            status.className = 'merge-entry-status';
            status.dataset.status = row.status;
            status.textContent = row.status === 'import' ? t('importedStatus')
                : row.status === 'duplicate' ? t('importMergeStatusDuplicate')
                    : row.status === 'rename' ? t('renamedStatus')
                        : t('importMergeStatusInfo');
            top.append(title, status);
            const detail = document.createElement('p');
            detail.textContent = row.detail;
            article.append(top, detail);
            entries.appendChild(article);
        }

        detailSection.append(detailHeading, entries);
        body.appendChild(detailSection);

        await this.actions.showImportMergeSummary({
            kind: warningMessages.length > 0 || (result.folderCreateFailures ?? 0) > 0 ? 'warning' : 'info',
            title: t('importMergeReviewTitle'),
            body,
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
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            void params.onClick();
        });
        return btn;
    }

    private countSelectedBookmarks(keys: Set<string>): number {
        let count = 0;
        for (const key of keys) if (key.startsWith('bm:')) count += 1;
        return count;
    }
}
