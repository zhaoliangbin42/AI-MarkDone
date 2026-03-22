import type { Bookmark, FolderTreeNode } from '../../../../core/bookmarks/types';
import { filterBookmarks, getAllBookmarks } from '../../../../core/bookmarks/tree';
import type { BookmarksPanelController, BookmarksPanelSnapshot } from '../BookmarksPanelController';
import {
    Icons,
    chatgptIcon,
    chevronDownIcon,
    chevronRightIcon,
    copyIcon,
    externalLinkIcon,
    folderIcon,
    folderOpenIcon,
    folderPlusIcon,
    moveIcon,
    pencilIcon,
    trashIcon,
} from '../../../../assets/icons';
import { t } from '../../components/i18n';

type TreeRenderPlan =
    | { mode: 'inline'; html: string }
    | { mode: 'virtualized'; model: VirtualTreeModel };
type VirtualTreeModel = {
    rows: VirtualTreeRow[];
    totalHeight: number;
};
type VirtualTreeRow =
    | {
        kind: 'folder';
        top: number;
        height: number;
        node: FolderTreeNode;
        depth: number;
        selectedPath: string | null;
        count: number;
        expanded: boolean;
        folderCheckState: { checked: boolean; indeterminate: boolean };
    }
    | {
        kind: 'bookmark';
        top: number;
        height: number;
        bookmark: Bookmark;
        depth: number;
        selectedKeys: Set<string>;
        subtitle: string;
    };

type BookmarksTreeViewportActions = {
    selectFolder: (path: string | null) => void;
    toggleFolderExpanded: (path: string) => void;
    toggleFolderSelection: (path: string) => void;
    toggleBookmarkSelection: (bookmark: Bookmark) => void;
    openBookmark: (bookmark: Bookmark) => Promise<void> | void;
    goToBookmark: (bookmark: Bookmark) => Promise<void> | void;
    copyBookmark: (bookmark: Bookmark) => Promise<void> | void;
    moveBookmark: (bookmark: Bookmark) => Promise<void> | void;
    deleteBookmark: (bookmark: Bookmark) => Promise<void> | void;
    createFolder: () => Promise<void> | void;
    importBookmarks: () => Promise<void> | void;
    createSubfolder: (path: string) => Promise<void> | void;
    renameFolder: (path: string) => Promise<void> | void;
    moveFolder: (path: string) => Promise<void> | void;
    deleteFolder: (path: string) => Promise<void> | void;
};

const TREE_VIRTUALIZE_THRESHOLD = 240;
const TREE_FOLDER_ROW_HEIGHT = 52;
const TREE_BOOKMARK_ROW_HEIGHT = 62;
const TREE_OVERSCAN_PX = 320;

function icon(svg: string): string {
    return `<span class="aimd-icon" aria-hidden="true">${svg}</span>`;
}

function escapeHtml(value: string): string {
    return value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function buttonClass(kind: 'primary' | 'secondary'): string {
    return kind === 'primary' ? 'primary-btn' : 'secondary-btn';
}

function tooltipAttr(label: string): string {
    return `data-tooltip="${escapeHtml(label)}"`;
}

function tr(key: string, fallback: string, substitutions?: string[]): string {
    const translated = substitutions ? t(key, substitutions) : t(key);
    if (!translated || translated === key) return fallback;
    return translated;
}

function bookmarkSelectionKey(bookmark: Bookmark): string {
    return `bm:${bookmark.urlWithoutProtocol}:${bookmark.position}`;
}

function buildVisibleFolderCountMap(nodes: FolderTreeNode[], visibleKeys: Set<string>): Map<string, number> {
    const countMap = new Map<string, number>();

    const visit = (node: FolderTreeNode): number => {
        let count = 0;
        for (const bookmark of node.bookmarks) {
            if (visibleKeys.has(bookmarkSelectionKey(bookmark))) count += 1;
        }
        for (const child of node.children) {
            count += visit(child);
        }
        countMap.set(node.folder.path, count);
        return count;
    };

    for (const node of nodes) {
        visit(node);
    }

    return countMap;
}

function getEffectiveExpanded(nodePath: string, isExpanded: boolean, selectedPath: string | null): boolean {
    void nodePath;
    void selectedPath;
    return isExpanded;
}

function getBookmarkSubtitleForMock(bookmark: Bookmark, fallback: string): string {
    if (typeof bookmark.timestamp !== 'number') return fallback;
    return new Date(bookmark.timestamp).toLocaleDateString();
}

function getBookmarkPlatformIcon(platform: string): string {
    const value = platform.trim().toLowerCase();
    if (value.includes('chatgpt')) return chatgptIcon;
    if (value.includes('gemini')) return Icons.gemini;
    if (value.includes('claude')) return Icons.claude;
    if (value.includes('deepseek')) return Icons.deepseek;
    return Icons.globe;
}

function getTreeVisibleBookmarks(snapshot: BookmarksPanelSnapshot): Bookmark[] {
    const allBookmarks = getAllBookmarks(snapshot.vm.folderTree);
    return filterBookmarks({
        bookmarks: allBookmarks,
        query: snapshot.vm.query,
        platform: snapshot.vm.platform,
    });
}

function renderBookmarkRow(bookmark: Bookmark, depth: number, selectedKeys: Set<string>, subtitle: string): string {
    const selected = selectedKeys.has(bookmarkSelectionKey(bookmark));
    const indent = 10 + depth * 18;
    const untitled = tr('untitledLabel', '(untitled)');
    return `
      <div class="tree-item tree-item--bookmark" style="padding-left:${indent}px" data-bookmark-id="${bookmarkSelectionKey(bookmark)}" role="treeitem" aria-level="${depth + 1}">
        <span class="tree-caret-slot" aria-hidden="true"></span>
        <input class="tree-check" type="checkbox" data-action="toggle-bookmark-selection" data-bookmark-id="${bookmarkSelectionKey(bookmark)}" ${selected ? 'checked' : ''} />
        <span class="tree-icon-slot" aria-hidden="true">${icon(getBookmarkPlatformIcon(bookmark.platform))}</span>
        <button class="tree-main tree-main--bookmark" type="button" data-action="open-bookmark" data-bookmark-id="${bookmarkSelectionKey(bookmark)}">
          <span class="tree-label-row">
            <span class="tree-title-meta">
              <div class="tree-label tree-label--bookmark">${escapeHtml(bookmark.title || untitled)}</div>
              <div class="tree-subtitle">${escapeHtml(subtitle)}</div>
            </span>
          </span>
        </button>
        <div class="tree-actions">
          <button class="icon-btn" type="button" data-action="go-to-bookmark" data-bookmark-id="${bookmarkSelectionKey(bookmark)}" aria-label="${escapeHtml(t('openConversationLabel'))}" title="${escapeHtml(t('openConversationLabel'))}" ${tooltipAttr(t('openConversationLabel'))}>${icon(externalLinkIcon)}</button>
          <button class="icon-btn" type="button" data-action="copy-bookmark" data-bookmark-id="${bookmarkSelectionKey(bookmark)}" aria-label="${escapeHtml(t('btnCopyText'))}" title="${escapeHtml(t('btnCopyText'))}" ${tooltipAttr(t('btnCopyText'))}>${icon(copyIcon)}</button>
          <button class="icon-btn" type="button" data-action="move-bookmark" data-bookmark-id="${bookmarkSelectionKey(bookmark)}" aria-label="${escapeHtml(t('moveBookmarkLabel'))}" title="${escapeHtml(t('moveBookmarkLabel'))}" ${tooltipAttr(t('moveBookmarkLabel'))}>${icon(moveIcon)}</button>
          <button class="icon-btn icon-btn--danger" type="button" data-action="delete-bookmark" data-bookmark-id="${bookmarkSelectionKey(bookmark)}" aria-label="${escapeHtml(t('btnDelete'))}" title="${escapeHtml(t('btnDelete'))}" ${tooltipAttr(t('btnDelete'))}>${icon(trashIcon)}</button>
        </div>
      </div>
    `;
}

function renderFolderRow(
    node: FolderTreeNode,
    depth: number,
    selectedPath: string | null,
    count: number,
    expanded: boolean,
    folderCheckState: { checked: boolean; indeterminate: boolean },
): string {
    const hasDirectBookmarks = node.bookmarks.length > 0;
    const hasChildren = hasDirectBookmarks || node.children.length > 0;
    const indent = 10 + depth * 18;
    const expandLabel = expanded ? tr('collapseFolderLabel', 'Collapse folder') : tr('expandFolderLabel', 'Expand folder');
    return `
      <div class="tree-item tree-item--folder" style="padding-left:${indent}px" data-path="${escapeHtml(node.folder.path)}" data-selected="${selectedPath === node.folder.path ? '1' : '0'}" role="treeitem" aria-level="${depth + 1}" aria-expanded="${expanded ? 'true' : 'false'}">
        <button class="tree-caret" type="button" data-action="toggle-folder-expand" data-path="${escapeHtml(node.folder.path)}" aria-label="${escapeHtml(expandLabel)}" ${tooltipAttr(expandLabel)} ${hasChildren ? '' : 'disabled'}>${icon(expanded ? chevronDownIcon : chevronRightIcon)}</button>
        <input class="tree-check" type="checkbox" data-action="toggle-folder-selection" data-path="${escapeHtml(node.folder.path)}" ${folderCheckState.checked ? 'checked' : ''} data-indeterminate="${folderCheckState.indeterminate ? '1' : '0'}" />
        <div class="tree-folder-icon">${icon(expanded ? folderOpenIcon : folderIcon)}</div>
        <button class="tree-main tree-main--folder" type="button" data-action="select-folder" data-path="${escapeHtml(node.folder.path)}">
          <div class="tree-label tree-label--folder">${escapeHtml(node.folder.name)}</div>
        </button>
        <div class="tree-count">${count}</div>
        <div class="tree-actions">
          <button class="icon-btn" type="button" data-action="create-subfolder" data-path="${escapeHtml(node.folder.path)}" aria-label="${escapeHtml(t('createSubfolder'))}" title="${escapeHtml(t('createSubfolder'))}" ${tooltipAttr(t('createSubfolder'))}>${icon(folderPlusIcon)}</button>
          <button class="icon-btn" type="button" data-action="rename-folder" data-path="${escapeHtml(node.folder.path)}" aria-label="${escapeHtml(t('renameFolder'))}" title="${escapeHtml(t('renameFolder'))}" ${tooltipAttr(t('renameFolder'))}>${icon(pencilIcon)}</button>
          <button class="icon-btn" type="button" data-action="move-folder" data-path="${escapeHtml(node.folder.path)}" aria-label="${escapeHtml(t('moveFolder'))}" title="${escapeHtml(t('moveFolder'))}" ${tooltipAttr(t('moveFolder'))}>${icon(moveIcon)}</button>
          <button class="icon-btn icon-btn--danger" type="button" data-action="delete-folder" data-path="${escapeHtml(node.folder.path)}" aria-label="${escapeHtml(t('deleteFolder'))}" title="${escapeHtml(t('deleteFolder'))}" ${tooltipAttr(t('deleteFolder'))}>${icon(trashIcon)}</button>
        </div>
      </div>
    `;
}

function renderFolderNode(
    node: FolderTreeNode,
    depth: number,
    selectedPath: string | null,
    visibleKeys: Set<string>,
    visibleCountMap: Map<string, number>,
    selectedKeys: Set<string>,
    getFolderCheckboxState: (path: string) => { checked: boolean; indeterminate: boolean },
    getSubtitle: (bookmark: Bookmark) => string,
): string {
    const expanded = getEffectiveExpanded(node.folder.path, node.isExpanded, selectedPath);
    const count = visibleCountMap.get(node.folder.path) ?? 0;
    const folderCheckState = getFolderCheckboxState(node.folder.path);
    const childContentHtml = expanded
        ? [
            ...node.children.map((child) => renderFolderNode(
                child,
                depth + 1,
                selectedPath,
                visibleKeys,
                visibleCountMap,
                selectedKeys,
                getFolderCheckboxState,
                getSubtitle,
            )),
            ...node.bookmarks
                .filter((bookmark) => visibleKeys.has(bookmarkSelectionKey(bookmark)))
                .map((bookmark) => renderBookmarkRow(
                    bookmark,
                    depth + 1,
                    selectedKeys,
                    getBookmarkSubtitleForMock(bookmark, getSubtitle(bookmark)),
                )),
        ].join('')
        : '';

    return `
      <div class="tree-node">
        ${renderFolderRow(node, depth, selectedPath, count, expanded, folderCheckState)}
        <div class="tree-children" data-expanded="${expanded ? '1' : '0'}">
          ${childContentHtml}
        </div>
      </div>
    `;
}

function buildVirtualTreeModel(snapshot: BookmarksPanelSnapshot, controller: BookmarksPanelController): VirtualTreeModel | null {
    const visibleKeys = new Set(getTreeVisibleBookmarks(snapshot).map(bookmarkSelectionKey));
    const visibleCountMap = buildVisibleFolderCountMap(snapshot.vm.folderTree, visibleKeys);
    const selectedPath = snapshot.vm.selectedFolderPath;
    const rows: VirtualTreeRow[] = [];
    let top = 0;

    const visit = (node: FolderTreeNode, depth: number, selectedPath: string | null): void => {
        const expanded = getEffectiveExpanded(node.folder.path, node.isExpanded, selectedPath);
        rows.push({
            kind: 'folder',
            top,
            height: TREE_FOLDER_ROW_HEIGHT,
            node,
            depth,
            selectedPath,
            count: visibleCountMap.get(node.folder.path) ?? 0,
            expanded,
            folderCheckState: controller.getFolderCheckboxState(node.folder.path),
        });
        top += TREE_FOLDER_ROW_HEIGHT;

        if (!expanded) return;

        for (const child of node.children) {
            visit(child, depth + 1, selectedPath);
        }

        for (const bookmark of node.bookmarks) {
            if (!visibleKeys.has(bookmarkSelectionKey(bookmark))) continue;
            rows.push({
                kind: 'bookmark',
                top,
                height: TREE_BOOKMARK_ROW_HEIGHT,
                bookmark,
                depth: depth + 1,
                selectedKeys: snapshot.selectedKeys,
                subtitle: getBookmarkSubtitleForMock(bookmark, controller.getBookmarkRowSubtitle(bookmark)),
            });
            top += TREE_BOOKMARK_ROW_HEIGHT;
        }
    };

    for (const node of snapshot.vm.folderTree) {
        visit(node, 0, selectedPath);
    }

    if (rows.length <= TREE_VIRTUALIZE_THRESHOLD) return null;
    return { rows, totalHeight: top };
}

function renderVirtualTreeRow(row: VirtualTreeRow): string {
    if (row.kind === 'folder') {
        return renderFolderRow(row.node, row.depth, row.selectedPath, row.count, row.expanded, row.folderCheckState);
    }
    return renderBookmarkRow(row.bookmark, row.depth, row.selectedKeys, row.subtitle);
}

export class BookmarksTreeViewport {
    private readonly root: HTMLElement;
    private readonly controller: BookmarksPanelController;
    private readonly actions: BookmarksTreeViewportActions;
    private snapshot: BookmarksPanelSnapshot | null = null;
    private treeVirtualModel: VirtualTreeModel | null = null;
    private treeFrameHandle: number | null = null;
    private treeRenderedRange: { startIndex: number; endIndex: number } | null = null;
    private scrollTop = 0;

    constructor(params: { controller: BookmarksPanelController; actions: BookmarksTreeViewportActions }) {
        this.controller = params.controller;
        this.actions = params.actions;
        this.root = document.createElement('div');
        this.root.className = 'tree-panel';
        this.root.dataset.virtualized = '0';
        this.root.setAttribute('role', 'tree');

        this.root.addEventListener('click', (event) => void this.handleClick(event));
        this.root.addEventListener('change', (event) => this.handleChange(event));
        this.root.addEventListener('scroll', this.onScroll, { passive: true });
    }

    getElement(): HTMLElement {
        return this.root;
    }

    getScrollTop(): number {
        return this.root.scrollTop;
    }

    restoreScroll(top: number): void {
        this.scrollTop = top;
        this.root.scrollTop = top;
        if (this.treeVirtualModel) {
            this.renderVirtualTreeWindow(this.treeVirtualModel);
        }
    }

    update(snapshot: BookmarksPanelSnapshot): void {
        this.snapshot = snapshot;
        const treePlan = this.getTreeRenderPlan(snapshot);
        this.treeVirtualModel = treePlan.mode === 'virtualized' ? treePlan.model : null;
        this.root.dataset.virtualized = treePlan.mode === 'virtualized' ? '1' : '0';

        if (treePlan.mode === 'inline') {
            this.clearVirtualState();
            this.root.innerHTML = treePlan.html;
            this.root.scrollTop = this.scrollTop;
            this.applyIndeterminateCheckboxes();
            return;
        }

        this.renderVirtualTreeWindow(treePlan.model);
        this.root.scrollTop = this.scrollTop;
    }

    dismissTransientUi(): void {
        // tree viewport has no local transient ui today
    }

    destroy(): void {
        this.clearVirtualState();
        this.root.removeEventListener('scroll', this.onScroll);
    }

    private readonly onScroll = (): void => {
        this.scrollTop = this.root.scrollTop;
        if (!this.treeVirtualModel) return;
        if (this.treeFrameHandle !== null) return;
        this.treeFrameHandle = window.requestAnimationFrame(() => {
            this.treeFrameHandle = null;
            if (!this.treeVirtualModel) return;
            this.renderVirtualTreeWindow(this.treeVirtualModel);
        });
    };

    private clearVirtualState(): void {
        if (this.treeFrameHandle !== null) {
            window.cancelAnimationFrame(this.treeFrameHandle);
            this.treeFrameHandle = null;
        }
        this.treeRenderedRange = null;
    }

    private applyIndeterminateCheckboxes(): void {
        for (const checkbox of this.root.querySelectorAll<HTMLInputElement>('.tree-check[data-indeterminate="1"]')) {
            checkbox.indeterminate = true;
        }
    }

    private getTreeRenderPlan(snapshot: BookmarksPanelSnapshot): TreeRenderPlan {
        const virtualModel = buildVirtualTreeModel(snapshot, this.controller);
        if (virtualModel) {
            return { mode: 'virtualized', model: virtualModel };
        }

        const visibleKeys = new Set(getTreeVisibleBookmarks(snapshot).map(bookmarkSelectionKey));
        const visibleCountMap = buildVisibleFolderCountMap(snapshot.vm.folderTree, visibleKeys);
        const selectedPath = snapshot.vm.selectedFolderPath;
        const folderTreeHtml = snapshot.vm.folderTree
            .map((node) => renderFolderNode(
                node,
                0,
                selectedPath,
                visibleKeys,
                visibleCountMap,
                snapshot.selectedKeys,
                (path) => this.controller.getFolderCheckboxState(path),
                (bookmark) => this.controller.getBookmarkRowSubtitle(bookmark),
            ))
            .join('');

        if (folderTreeHtml) {
            return { mode: 'inline', html: folderTreeHtml };
        }

        const emptyHint = snapshot.vm.query || snapshot.vm.platform !== 'All'
            ? tr('noResultsHint', 'Clear the active filters or select a broader folder scope.')
            : tr('emptyBookmarksHint', 'Create a folder or import bookmarks to start browsing saved messages.');

        return {
            mode: 'inline',
            html: `
              <div class="empty-state">
                <div class="empty-icon">${icon(folderIcon)}</div>
        <strong>${escapeHtml(snapshot.vm.query || snapshot.vm.platform !== 'All' ? t('noResultsTitle') : t('noFoldersYet'))}</strong>
                <p>${escapeHtml(emptyHint)}</p>
                <div class="empty-actions">
                  <button class="${buttonClass('primary')}" type="button" data-action="create-folder-empty">${escapeHtml(t('createFirstFolderBtn'))}</button>
                  <button class="${buttonClass('secondary')}" type="button" data-action="import-bookmarks-empty">${escapeHtml(tr('importBookmarks', 'Import bookmarks'))}</button>
                </div>
              </div>
            `,
        };
    }

    private renderVirtualTreeWindow(model: VirtualTreeModel): void {
        const viewportHeight = this.root.clientHeight || 640;
        const startPx = Math.max(0, this.root.scrollTop - TREE_OVERSCAN_PX);
        const endPx = this.root.scrollTop + viewportHeight + TREE_OVERSCAN_PX;

        let startIndex = 0;
        while (startIndex < model.rows.length && model.rows[startIndex]!.top + model.rows[startIndex]!.height <= startPx) {
            startIndex += 1;
        }

        let endIndex = startIndex;
        while (endIndex < model.rows.length && model.rows[endIndex]!.top < endPx) {
            endIndex += 1;
        }

        const nextRange = {
            startIndex,
            endIndex: Math.max(startIndex + 1, endIndex),
        };
        if (
            this.treeRenderedRange
            && this.treeRenderedRange.startIndex === nextRange.startIndex
            && this.treeRenderedRange.endIndex === nextRange.endIndex
        ) {
            return;
        }

        this.treeRenderedRange = nextRange;
        const visibleRows = model.rows.slice(startIndex, Math.max(startIndex + 1, endIndex));
        const topSpacer = visibleRows[0]?.top ?? 0;
        const lastRow = visibleRows[visibleRows.length - 1];
        const bottomSpacer = lastRow ? Math.max(0, model.totalHeight - (lastRow.top + lastRow.height)) : model.totalHeight;

        this.root.innerHTML = `
          <div class="tree-virtual-spacer" style="height:${topSpacer}px"></div>
          ${visibleRows.map((row) => renderVirtualTreeRow(row)).join('')}
          <div class="tree-virtual-spacer" style="height:${bottomSpacer}px"></div>
        `;
        this.applyIndeterminateCheckboxes();
    }

    private async handleClick(event: Event): Promise<void> {
        const target = event.target as HTMLElement | null;
        if (!target) return;

        if (target.closest('.tree-item')) {
            const actionEl = target.closest<HTMLElement>('[data-action]');
            if (!actionEl) return;
            const bookmark = this.resolveBookmark(actionEl.dataset.bookmarkId);
            switch (actionEl.dataset.action) {
                case 'toggle-folder-expand':
                    if (actionEl.dataset.path) this.actions.toggleFolderExpanded(actionEl.dataset.path);
                    return;
                case 'select-folder':
                    this.actions.selectFolder(actionEl.dataset.path ?? null);
                    return;
                case 'create-subfolder':
                    if (actionEl.dataset.path) await this.actions.createSubfolder(actionEl.dataset.path);
                    return;
                case 'rename-folder':
                    if (actionEl.dataset.path) await this.actions.renameFolder(actionEl.dataset.path);
                    return;
                case 'move-folder':
                    if (actionEl.dataset.path) await this.actions.moveFolder(actionEl.dataset.path);
                    return;
                case 'delete-folder':
                    if (actionEl.dataset.path) await this.actions.deleteFolder(actionEl.dataset.path);
                    return;
                case 'open-bookmark':
                    if (bookmark) await this.actions.openBookmark(bookmark);
                    return;
                case 'go-to-bookmark':
                    if (bookmark) await this.actions.goToBookmark(bookmark);
                    return;
                case 'copy-bookmark':
                    if (bookmark) await this.actions.copyBookmark(bookmark);
                    return;
                case 'move-bookmark':
                    if (bookmark) await this.actions.moveBookmark(bookmark);
                    return;
                case 'delete-bookmark':
                    if (bookmark) await this.actions.deleteBookmark(bookmark);
                    return;
                default:
                    return;
            }
        }

        const actionEl = target.closest<HTMLElement>('[data-action]');
        if (!actionEl) {
            this.actions.selectFolder(null);
            return;
        }

        if (actionEl.dataset.action === 'create-folder-empty') {
            await this.actions.createFolder();
            return;
        }
        if (actionEl.dataset.action === 'import-bookmarks-empty') {
            await this.actions.importBookmarks();
        }
    }

    private handleChange(event: Event): void {
        const target = event.target as HTMLInputElement | null;
        if (!target) return;

        if (target.dataset.action === 'toggle-folder-selection' && target.dataset.path) {
            this.actions.toggleFolderSelection(target.dataset.path);
            return;
        }

        if (target.dataset.action === 'toggle-bookmark-selection' && target.dataset.bookmarkId) {
            const bookmark = this.resolveBookmark(target.dataset.bookmarkId);
            if (bookmark) this.actions.toggleBookmarkSelection(bookmark);
        }
    }

    private resolveBookmark(key?: string): Bookmark | null {
        if (!key || !this.snapshot) return null;
        const merged = new Map<string, Bookmark>();
        for (const bookmark of getAllBookmarks(this.snapshot.vm.folderTree)) {
            merged.set(bookmarkSelectionKey(bookmark), bookmark);
        }
        for (const bookmark of this.snapshot.vm.bookmarks) {
            if (!merged.has(bookmarkSelectionKey(bookmark))) {
                merged.set(bookmarkSelectionKey(bookmark), bookmark);
            }
        }
        return merged.get(key) ?? null;
    }
}
