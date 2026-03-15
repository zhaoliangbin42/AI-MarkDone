import type { Bookmark, FolderTreeNode } from '../../../../../core/bookmarks/types';
import type { ReaderItem } from '../../../../../services/reader/types';
import type { BookmarksPanelController, BookmarksPanelSnapshot } from '../../BookmarksPanelController';
import { createIcon } from '../../../components/Icon';
import { t } from '../../../components/i18n';
import type { ModalHost } from '../../../components/ModalHost';
import type { ReaderPanel, ReaderPanelActionContext } from '../../../reader/ReaderPanel';
import { PlatformDropdown } from '../components/PlatformDropdown';
import {
    chevronDownIcon,
    chevronRightIcon,
    copyIcon,
    downloadIcon,
    externalLinkIcon,
    folderIcon,
    folderOpenIcon,
    folderPlusIcon,
    moveIcon,
    pencilIcon,
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
    tree: HTMLElement;
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

function bookmarkSelectionKey(b: Bookmark): string {
    return `bm:${b.urlWithoutProtocol}:${b.position}`;
}

function getBookmarkDisplayTitle(b: Bookmark): string {
    return b.title || '(untitled)';
}

export class BookmarksTabView {
    private controller: BookmarksPanelController;
    private readerPanel: ReaderPanel;
    private modal: ModalHost;
    private root: HTMLElement;
    private refs: Refs;
    private snapshot: BookmarksPanelSnapshot | null = null;
    private onRequestHidePanel: (() => void) | null = null;
    private indentBasePx: number | null = null;
    private indentStepPx: number | null = null;

    constructor(params: {
        controller: BookmarksPanelController;
        readerPanel: ReaderPanel;
        modal: ModalHost;
        onRequestHidePanel?: () => void;
    }) {
        this.controller = params.controller;
        this.readerPanel = params.readerPanel;
        this.modal = params.modal;
        this.onRequestHidePanel = params.onRequestHidePanel ?? null;

        this.root = document.createElement('div');
        this.root.className = 'bookmarks-tab-content';

        const toolbar = document.createElement('div');
        toolbar.className = 'toolbar-row toolbar-row--bookmarks';

        const search = document.createElement('div');
        search.className = 'search-field';
        search.appendChild(createIcon(searchIcon));
        const query = document.createElement('input');
        query.type = 'text';
        query.placeholder = t('search');
        query.addEventListener('input', () => this.controller.setQuery(query.value));
        search.appendChild(query);

        const platform = new PlatformDropdown({
            onChange: (value) => this.controller.setPlatform(value),
        });

        const sortTimeBtn = this.makeIconButton({
            icon: sortTimeIcon,
            label: t('sortByTimeLabel'),
            onClick: () => this.toggleTimeSort(),
        });
        const sortAlphaBtn = this.makeIconButton({
            icon: sortAZIcon,
            label: t('sortAlphaLabel'),
            onClick: () => this.toggleAlphaSort(),
        });

        const folderCreateBtn = this.makeIconButton({
            icon: folderPlusIcon,
            label: t('createFolder'),
            onClick: () => void this.createFolder(),
        });

        const importBtn = this.makeIconButton({
            icon: uploadIcon,
            label: t('importBookmarks'),
            onClick: () => this.refs.importFile.click(),
        });
        const importFile = document.createElement('input');
        importFile.type = 'file';
        importFile.accept = 'application/json';
        importFile.style.display = 'none';
        importFile.addEventListener('change', () => void this.importFromFile());

        const exportBtn = this.makeIconButton({
            icon: downloadIcon,
            label: t('exportBookmarks'),
            onClick: () => void this.exportAll(),
        });

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

        const tree = document.createElement('div');
        tree.className = 'tree-panel';
        tree.setAttribute('role', 'tree');

        this.root.append(toolbar, batch, tree);

        tree.addEventListener('click', (e) => {
            const target = e.target as HTMLElement | null;
            if (!target) return;
            if (target.closest('.tree-item')) return;
            this.controller.selectFolder(null);
        });

        this.refs = {
            query,
            platform,
            sortTimeBtn,
            sortAlphaBtn,
            importFile,
            batch,
            tree,
        };
    }

    getElement(): HTMLElement {
        return this.root;
    }

    focusPrimaryInput(): void {
        this.refs.query.focus();
        this.refs.query.select();
    }

    dismissTransientUi(): void {
        this.refs.platform.close();
    }

    update(snap: BookmarksPanelSnapshot): void {
        this.snapshot = snap;
        this.ensureIndentMetrics();

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
        this.renderTree(this.refs.tree, snap);
        this.updateSortButtons(snap.vm.sortMode);
    }

    private renderTree(container: HTMLElement, snap: BookmarksPanelSnapshot): void {
        const visibleKeys = new Set<string>(snap.vm.bookmarks.map(bookmarkSelectionKey));
        const selectedPath = snap.vm.selectedFolderPath;
        const hasActiveFilters = Boolean(snap.vm.query.trim())
            || snap.vm.platform !== 'All'
            || selectedPath !== null;
        const hasLibraryContent = snap.vm.bookmarks.length > 0
            || snap.vm.folderTree.some((node) => this.hasRealFolderContent(node));

        const frag = document.createDocumentFragment();
        let renderedNodeCount = 0;

        for (const node of snap.vm.folderTree) {
            const rendered = this.renderFolderNode(node, 0, visibleKeys, selectedPath);
            if (!rendered) continue;
            renderedNodeCount += 1;
            frag.appendChild(rendered);
        }

        if (renderedNodeCount === 0) {
            frag.appendChild(this.renderEmptyState({
                kind: hasActiveFilters || hasLibraryContent ? 'no_results' : 'empty',
            }));
        }

        container.replaceChildren(frag);
    }

    private renderFolderNode(
        node: FolderTreeNode,
        depth: number,
        visibleKeys: Set<string>,
        selectedPath: string | null
    ): HTMLElement | null {
        const wrapper = document.createElement('div');
        wrapper.className = 'tree-node';

        const totalVisible = this.countVisibleUnderFolder(node, visibleKeys);
        const nodePath = node.folder.path;

        const hasDirectBookmarks = node.bookmarks.length > 0;
        const hasChildren = hasDirectBookmarks || node.children.length > 0;
        const effectiveExpanded = this.getEffectiveExpanded(nodePath, node.isExpanded, selectedPath);

        const row = this.renderFolderRow({
            label: node.folder.name,
            path: node.folder.path,
            depth,
            isSelected: selectedPath === node.folder.path,
            isExpanded: effectiveExpanded,
            hasChildren,
            count: totalVisible,
        });

        wrapper.appendChild(row);

        const children = document.createElement('div');
        children.className = 'tree-children';
        children.dataset.expanded = effectiveExpanded ? '1' : '0';

        for (const child of node.children) {
            const rendered = this.renderFolderNode(child, depth + 1, visibleKeys, selectedPath);
            if (!rendered) continue;
            children.appendChild(rendered);
        }
        for (const b of node.bookmarks) {
            if (!visibleKeys.has(bookmarkSelectionKey(b))) continue;
            children.appendChild(this.renderBookmarkRow(b, depth + 1));
        }

        wrapper.appendChild(children);
        return wrapper;
    }

    private getEffectiveExpanded(nodePath: string, isExpanded: boolean, selectedPath: string | null): boolean {
        if (!selectedPath) return isExpanded;
        if (selectedPath === nodePath) return isExpanded;
        if (selectedPath.startsWith(`${nodePath}/`)) return true; // ensure ancestors expand to reveal selection
        if (nodePath.startsWith(`${selectedPath}/`)) return isExpanded; // descendants controlled by user
        return false; // collapse non-selected branches (rows still visible)
    }

    private countVisibleUnderFolder(node: FolderTreeNode, visibleKeys: Set<string>): number {
        let count = 0;
        for (const b of node.bookmarks) if (visibleKeys.has(bookmarkSelectionKey(b))) count += 1;
        for (const child of node.children) count += this.countVisibleUnderFolder(child, visibleKeys);
        return count;
    }

    private hasRealFolderContent(node: FolderTreeNode): boolean {
        if (node.bookmarks.length > 0) return true;
        return node.children.some((child) => this.hasRealFolderContent(child));
    }

    private renderFolderRow(params: {
        label: string;
        path: string | null;
        depth: number;
        isSelected: boolean;
        isExpanded: boolean;
        hasChildren: boolean;
        count: number;
    }): HTMLElement {
        const row = document.createElement('div');
        row.className = 'tree-item tree-item--folder';
        row.dataset.selected = '0';
        row.dataset.path = params.path ?? '';
        row.setAttribute('role', 'treeitem');
        row.setAttribute('aria-level', String(params.depth + 1));
        if (params.path) row.setAttribute('aria-expanded', params.isExpanded ? 'true' : 'false');
        row.tabIndex = 0;

        const base = this.indentBasePx ?? 10;
        const step = this.indentStepPx ?? 18;
        row.style.paddingLeft = `${base + params.depth * step}px`;

        const caret = document.createElement('button');
        caret.type = 'button';
        caret.className = 'tree-caret';
        caret.disabled = !params.hasChildren;
        caret.innerHTML = params.hasChildren ? (params.isExpanded ? chevronDownIcon : chevronRightIcon) : '';
        caret.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (!params.path) return;
            this.controller.toggleFolderExpanded(params.path);
        });

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.className = 'tree-check';
        checkbox.disabled = !params.path;
        if (params.path) {
            const state = this.controller.getFolderCheckboxState(params.path);
            checkbox.checked = state.checked;
            checkbox.indeterminate = state.indeterminate;
            checkbox.dataset.indeterminate = state.indeterminate ? '1' : '0';
        }
        checkbox.addEventListener('click', (e) => e.stopPropagation());
        checkbox.addEventListener('change', (e) => {
            e.stopPropagation();
            if (!params.path) return;
            this.controller.toggleFolderSelection(params.path);
        });

        const main = document.createElement('button');
        main.type = 'button';
        main.className = 'tree-main tree-main--folder';
        main.dataset.path = params.path ?? '';
        const label = document.createElement('div');
        label.className = 'tree-label';
        label.textContent = params.label;
        main.appendChild(label);
        main.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.controller.selectFolder(params.path);
        });
        main.addEventListener('keydown', (e) => {
            if (e.key !== 'Enter' && e.key !== ' ') return;
            e.preventDefault();
            e.stopPropagation();
            this.controller.selectFolder(params.path);
        });

        const icon = document.createElement('div');
        icon.className = 'tree-folder-icon';
        if (params.path) {
            icon.appendChild(createIcon(params.isExpanded ? folderOpenIcon : folderIcon));
        }

        const count = document.createElement('div');
        count.className = 'tree-count';
        count.textContent = params.path ? String(params.count) : '';

        const actions = document.createElement('div');
        actions.className = 'tree-actions';

        if (params.path) {
            actions.append(
                this.makeRowAction({
                    icon: folderPlusIcon,
                    label: t('newSubfolder'),
                    kind: 'default',
                    onClick: () => void this.createSubfolder(params.path!),
                }),
                this.makeRowAction({
                    icon: pencilIcon,
                    label: t('renameFolder'),
                    kind: 'default',
                    onClick: () => void this.renameFolder(params.path!),
                }),
                this.makeRowAction({
                    icon: moveIcon,
                    label: t('moveFolder'),
                    kind: 'default',
                    onClick: () => void this.moveFolder(params.path!),
                }),
                this.makeRowAction({
                    icon: trashIcon,
                    label: t('deleteFolder'),
                    kind: 'danger',
                    onClick: () => void this.deleteFolder(params.path!),
                })
            );
        }

        row.append(caret, checkbox, icon, main, count, actions);

        return row;
    }

    private renderBookmarkRow(b: Bookmark, depth: number): HTMLElement {
        const row = document.createElement('div');
        row.className = 'tree-item tree-item--bookmark';
        row.setAttribute('role', 'treeitem');
        row.setAttribute('aria-level', String(depth + 1));
        row.tabIndex = 0;

        const base = this.indentBasePx ?? 10;
        const step = this.indentStepPx ?? 18;
        row.style.paddingLeft = `${base + depth * step}px`;

        const caretSlot = document.createElement('span');
        caretSlot.className = 'tree-caret-slot';
        caretSlot.setAttribute('aria-hidden', 'true');

        const iconSlot = document.createElement('span');
        iconSlot.className = 'tree-icon-slot';
        iconSlot.setAttribute('aria-hidden', 'true');

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.className = 'tree-check';
        checkbox.checked = this.snapshot?.selectedKeys?.has(bookmarkSelectionKey(b)) ?? false;
        checkbox.addEventListener('click', (e) => e.stopPropagation());
        checkbox.addEventListener('change', (e) => {
            e.stopPropagation();
            this.controller.toggleBookmarkSelection(b);
        });

        const main = document.createElement('button');
        main.type = 'button';
        main.className = 'tree-main tree-main--bookmark';
        main.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            void this.openPreviewInReader(b);
        });
        main.addEventListener('keydown', (e) => {
            if (e.key !== 'Enter' && e.key !== ' ') return;
            e.preventDefault();
            e.stopPropagation();
            void this.openPreviewInReader(b);
        });
        const labelRow = document.createElement('span');
        labelRow.className = 'tree-label-row';
        const title = document.createElement('div');
        title.className = 'tree-label';
        title.textContent = getBookmarkDisplayTitle(b);
        const subtitle = document.createElement('div');
        subtitle.className = 'tree-subtitle';
        subtitle.textContent = this.controller.getBookmarkRowSubtitle(b);
        labelRow.append(title, subtitle);
        main.appendChild(labelRow);

        const actions = document.createElement('div');
        actions.className = 'tree-actions';
        actions.append(
            this.makeRowAction({
                icon: externalLinkIcon,
                label: t('openConversation'),
                kind: 'default',
                onClick: () => void this.goTo(b),
            }),
            this.makeRowAction({
                icon: copyIcon,
                label: t('btnCopy'),
                kind: 'default',
                onClick: () => void this.controller.copyBookmarkMarkdown(b),
            }),
            this.makeRowAction({
                icon: trashIcon,
                label: t('delete'),
                kind: 'danger',
                onClick: () => void this.deleteBookmark(b),
            })
        );

        row.append(caretSlot, checkbox, iconSlot, main, actions);
        return row;
    }

    private renderBatchBar(container: HTMLElement, selectedBookmarkCount: number): void {
        container.replaceChildren();
        container.dataset.active = selectedBookmarkCount > 0 ? '1' : '0';

        const label = document.createElement('div');
        label.className = 'batch-label';
        label.textContent = selectedBookmarkCount > 0 ? t('selectedCount', String(selectedBookmarkCount)) : t('noSelectionLabel');

        const actions = document.createElement('div');
        actions.className = 'batch-actions';

        const clearBtn = this.makeIconButton({
            icon: xIcon,
            label: t('clearSelection'),
            onClick: () => this.controller.clearSelection(),
        });
        clearBtn.disabled = selectedBookmarkCount === 0;

        const moveBtn = this.makeIconButton({
            icon: moveIcon,
            label: t('moveSelected'),
            onClick: async () => {
                const target = await this.modal.prompt({
                    kind: 'info',
                    title: t('moveSelected'),
                    message: t('promptTargetFolderPath'),
                    placeholder: t('folderPathPlaceholder'),
                    defaultValue: this.controller.getDefaultFolderPath(),
                    confirmText: t('btnSave'),
                    cancelText: t('btnCancel'),
                    validate: (v) => ({ ok: Boolean(v.trim()), message: t('folderNameEmpty') }),
                });
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
            onClick: async () => {
                const ok = await this.modal.confirm({
                    kind: 'warning',
                    title: t('deleteSelectedTitle'),
                    message: t('actionCannotBeUndone'),
                    confirmText: t('btnDelete'),
                    cancelText: t('btnCancel'),
                    danger: true,
                });
                if (!ok) return;
                const res = await this.controller.batchDelete();
                this.controller.setPanelStatus(res.ok ? t('deletedStatus') : res.message);
            },
        });
        delBtn.disabled = selectedBookmarkCount === 0;

        const exportBtn = this.makeIconButton({
            icon: downloadIcon,
            label: t('exportSelected'),
            onClick: async () => void this.exportSelected(),
        });
        exportBtn.disabled = selectedBookmarkCount === 0;

        actions.append(clearBtn, moveBtn, delBtn, exportBtn);
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
            await this.modal.alert({ kind: 'error', title: t('exportBookmarks'), message: res.message, confirmText: t('btnOk') });
            return;
        }
        downloadJson('ai-markdone-bookmarks.json', res.data.payload);
        this.controller.setPanelStatus(t('exportedStatus'));
    }

    private async exportSelected(): Promise<void> {
        const res = await this.controller.exportSelected(true);
        if (!res.ok) {
            await this.modal.alert({ kind: 'error', title: t('exportSelected'), message: res.message, confirmText: t('btnOk') });
            return;
        }
        downloadJson('ai-markdone-bookmarks-selected.json', res.data.payload);
        this.controller.setPanelStatus(t('exportedStatus'));
    }

    private async importFromFile(): Promise<void> {
        const input = this.refs.importFile;
        const file = input.files?.[0] || null;
        input.value = '';
        if (!file) return;
        const text = await file.text();

        const saveContextOnly = await this.modal.confirm({
            kind: 'info',
            title: t('importBookmarks'),
            message: t('saveContextOnlyConfirm'),
            confirmText: t('btnOk'),
            cancelText: t('btnCancel'),
        });
        const res = await this.controller.importJsonText(text, saveContextOnly);
        if (!res.ok) {
            await this.modal.alert({ kind: 'error', title: t('importBookmarks'), message: res.message, confirmText: t('btnOk') });
            return;
        }
        this.controller.setPanelStatus(t('importedStatus'));
    }

    private async createFolder(): Promise<void> {
        const path = await this.modal.prompt({
            kind: 'info',
            title: t('createFolder'),
            message: t('promptNewFolderPath'),
            placeholder: t('folderPathPlaceholder'),
            defaultValue: '',
            confirmText: t('btnSave'),
            cancelText: t('btnCancel'),
            validate: (v) => ({ ok: Boolean(v.trim()), message: t('folderNameEmpty') }),
        });
        if (path === null) return;
        const res = await this.controller.createFolder(path);
        this.controller.setPanelStatus(res.ok ? t('folderCreatedStatus') : res.message);
        if (!res.ok) {
            await this.modal.alert({ kind: 'error', title: t('createFolder'), message: res.message, confirmText: t('btnOk') });
        }
    }

    private async createSubfolder(parentPath: string): Promise<void> {
        const name = await this.modal.prompt({
            kind: 'info',
            title: t('newSubfolder'),
            message: t('promptNewFolderName'),
            placeholder: t('folderNamePlaceholder'),
            defaultValue: '',
            confirmText: t('btnSave'),
            cancelText: t('btnCancel'),
            validate: (v) => ({ ok: Boolean(v.trim()), message: t('folderNameEmpty') }),
        });
        if (name === null) return;
        const path = `${parentPath}/${name}`;
        const res = await this.controller.createFolder(path);
        this.controller.setPanelStatus(res.ok ? t('folderCreatedStatus') : res.message);
        if (!res.ok) {
            await this.modal.alert({ kind: 'error', title: t('createFolder'), message: res.message, confirmText: t('btnOk') });
        } else {
            this.controller.toggleFolderExpanded(parentPath);
        }
    }

    private async renameFolder(path: string): Promise<void> {
        const name = await this.modal.prompt({
            kind: 'info',
            title: t('renameFolder'),
            message: t('promptNewFolderName'),
            placeholder: t('folderNamePlaceholder'),
            defaultValue: '',
            confirmText: t('btnSave'),
            cancelText: t('btnCancel'),
            validate: (v) => ({ ok: Boolean(v.trim()), message: t('folderNameEmpty') }),
        });
        if (name === null) return;
        const res = await this.controller.renameFolder(path, name);
        if (!res.ok) await this.modal.alert({ kind: 'error', title: t('renameFolder'), message: res.message, confirmText: t('btnOk') });
        this.controller.setPanelStatus(res.ok ? t('renamedStatus') : res.message);
    }

    private async moveFolder(path: string): Promise<void> {
        const parent = await this.modal.prompt({
            kind: 'info',
            title: t('moveFolder'),
            message: t('promptTargetParentFolder'),
            placeholder: '',
            defaultValue: '',
            confirmText: t('btnSave'),
            cancelText: t('btnCancel'),
        });
        if (parent === null) return;
        const res = await this.controller.moveFolder(path, parent);
        if (!res.ok) await this.modal.alert({ kind: 'error', title: t('moveFolder'), message: res.message, confirmText: t('btnOk') });
        this.controller.setPanelStatus(res.ok ? t('movedStatus') : res.message);
    }

    private async deleteFolder(path: string): Promise<void> {
        const ok = await this.modal.confirm({
            kind: 'warning',
            title: t('deleteFolder'),
            message: t('deleteFolderConfirm', path),
            confirmText: t('btnDelete'),
            cancelText: t('btnCancel'),
            danger: true,
        });
        if (!ok) return;
        const res = await this.controller.deleteFolder(path);
        if (!res.ok) await this.modal.alert({ kind: 'error', title: t('deleteFolder'), message: res.message, confirmText: t('btnOk') });
        this.controller.setPanelStatus(res.ok ? t('deletedStatus') : res.message);
    }

    private async deleteBookmark(b: Bookmark): Promise<void> {
        const ok = await this.modal.confirm({
            kind: 'warning',
            title: t('delete'),
            message: t('actionCannotBeUndone'),
            confirmText: t('btnDelete'),
            cancelText: t('btnCancel'),
            danger: true,
        });
        if (!ok) return;
        await this.controller.deleteBookmark(b);
    }

    private async goTo(b: Bookmark): Promise<void> {
        this.onRequestHidePanel?.();
        await this.controller.goToBookmark(b);
    }

    private async openPreviewInReader(b: Bookmark): Promise<void> {
        const snap = this.snapshot;
        if (!snap) return;

        const visibleKeys = new Set<string>(snap.vm.bookmarks.map(bookmarkSelectionKey));
        const queryActive = Boolean(snap.vm.query.trim());

        const { list, startIndex } = this.buildReaderScopeList({
            bookmark: b,
            folderTree: snap.vm.folderTree,
            visibleKeys,
            queryActive,
        });
        if (list.length === 0) return;

        const items: ReaderItem[] = list.map((bm) => ({
            id: bookmarkSelectionKey(bm),
            userPrompt: bm.userMessage || bm.title || '',
            content: bm.aiResponse ?? '',
        }));

        await this.readerPanel.show(items, startIndex, this.controller.getTheme(), {
            actions: [
                {
                    id: 'goto',
                    label: t('openConversation'),
                    icon: externalLinkIcon,
                    kind: 'default',
                    onClick: async (ctx: ReaderPanelActionContext) => {
                        const current = list[ctx.index] ?? null;
                        if (!current) return;
                        this.readerPanel.hide();
                        await this.goTo(current);
                    },
                },
            ],
        });
    }

    private buildReaderScopeList(params: {
        bookmark: Bookmark;
        folderTree: FolderTreeNode[];
        visibleKeys: Set<string>;
        queryActive: boolean;
    }): { list: Bookmark[]; startIndex: number } {
        const key = bookmarkSelectionKey(params.bookmark);

        const list = params.queryActive
            ? this.flattenVisibleBookmarksInTreeOrder(params.folderTree, params.visibleKeys)
            : this.getVisibleBookmarksInSameFolder(params.folderTree, params.visibleKeys, params.bookmark);

        const idx = list.findIndex((b) => bookmarkSelectionKey(b) === key);
        if (idx >= 0) return { list, startIndex: idx };
        return { list: [params.bookmark], startIndex: 0 };
    }

    private flattenVisibleBookmarksInTreeOrder(nodes: FolderTreeNode[], visibleKeys: Set<string>): Bookmark[] {
        const result: Bookmark[] = [];
        for (const node of nodes) {
            if (node.children.length > 0) {
                result.push(...this.flattenVisibleBookmarksInTreeOrder(node.children, visibleKeys));
            }
            for (const b of node.bookmarks) {
                if (visibleKeys.has(bookmarkSelectionKey(b))) result.push(b);
            }
        }
        return result;
    }

    private getVisibleBookmarksInSameFolder(
        nodes: FolderTreeNode[],
        visibleKeys: Set<string>,
        bookmark: Bookmark
    ): Bookmark[] {
        const node = this.findFolderNode(nodes, bookmark.folderPath);
        if (node) return node.bookmarks.filter((b) => visibleKeys.has(bookmarkSelectionKey(b)));

        const snap = this.snapshot;
        if (!snap) return [bookmark];
        const list = snap.vm.bookmarks.filter((b) => b.folderPath === bookmark.folderPath);
        return list.length ? list : [bookmark];
    }

    private findFolderNode(nodes: FolderTreeNode[], path: string): FolderTreeNode | null {
        for (const node of nodes) {
            if (node.folder.path === path) return node;
            if (node.children.length === 0) continue;
            const found = this.findFolderNode(node.children, path);
            if (found) return found;
        }
        return null;
    }

    private makeIconButton(params: {
        icon: string;
        label: string;
        kind?: 'default' | 'primary' | 'danger';
        onClick: () => void | Promise<void>;
    }): HTMLButtonElement {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = `icon-btn${params.kind === 'danger' ? ' icon-btn--danger' : ''}`;
        btn.title = params.label;
        btn.setAttribute('aria-label', params.label);
        btn.appendChild(createIcon(params.icon));
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            void params.onClick();
        });
        return btn;
    }

    private makeRowAction(params: {
        icon: string;
        label: string;
        kind?: 'default' | 'danger';
        onClick: () => void | Promise<void>;
    }): HTMLButtonElement {
        const btn = this.makeIconButton({
            icon: params.icon,
            label: params.label,
            kind: params.kind ?? 'default',
            onClick: params.onClick,
        });
        btn.addEventListener('click', (e) => e.stopPropagation());
        return btn;
    }

    private ensureIndentMetrics(): void {
        if (this.indentBasePx !== null && this.indentStepPx !== null) return;
        const style = window.getComputedStyle(this.root);
        const base = this.parsePx(style.getPropertyValue('--aimd-tree-indent-base')) ?? this.parsePx(style.getPropertyValue('--aimd-space-2'));
        const step = this.parsePx(style.getPropertyValue('--aimd-tree-indent-step')) ?? this.parsePx(style.getPropertyValue('--aimd-space-3'));
        if (base !== null) this.indentBasePx = base;
        if (step !== null) this.indentStepPx = step;
    }

    private parsePx(value: string): number | null {
        const v = value.trim();
        if (!v.endsWith('px')) return null;
        const n = Number(v.slice(0, -2));
        return Number.isFinite(n) ? n : null;
    }

    private countSelectedBookmarks(keys: Set<string>): number {
        let count = 0;
        for (const key of keys) if (key.startsWith('bm:')) count += 1;
        return count;
    }

    private renderEmptyState(params?: { kind?: 'empty' | 'no_results' }): HTMLElement {
        const kind = params?.kind ?? 'empty';
        const root = document.createElement('div');
        root.className = 'empty-state';

        const icon = document.createElement('div');
        icon.className = 'empty-icon';
        icon.appendChild(createIcon(folderIcon));

        const title = document.createElement('strong');
        title.textContent = kind === 'no_results' ? t('noResultsTitle') : t('noFoldersYet');

        const desc = document.createElement('p');
        desc.textContent = kind === 'no_results' ? t('noResultsHint') : t('createFirstFolder');

        const actions = document.createElement('div');
        actions.className = 'empty-actions';

        const createBtn = document.createElement('button');
        createBtn.type = 'button';
        createBtn.className = 'studio-btn studio-btn--primary';
        createBtn.textContent = kind === 'no_results' ? t('clearFiltersBtn') : t('createFirstFolderBtn');
        createBtn.addEventListener('click', () => {
            if (kind === 'no_results') {
                this.controller.setQuery('');
                this.controller.setPlatform('All');
                this.controller.selectFolder(null);
                return;
            }
            void this.createFolder();
        });

        const importBtn = document.createElement('button');
        importBtn.type = 'button';
        importBtn.className = 'studio-btn studio-btn--secondary';
        importBtn.textContent = t('importBookmarks');
        importBtn.addEventListener('click', () => this.refs.importFile.click());

        actions.append(createBtn, importBtn);

        root.append(icon, title, desc, actions);
        return root;
    }
}
