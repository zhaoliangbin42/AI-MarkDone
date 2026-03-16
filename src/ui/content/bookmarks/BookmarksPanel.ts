import { browser } from '../../../drivers/shared/browser';
import type { Bookmark, FolderTreeNode } from '../../../core/bookmarks/types';
import { filterBookmarks, getAllBookmarks } from '../../../core/bookmarks/tree';
import { PathUtils } from '../../../core/bookmarks/path';
import { DEFAULT_SETTINGS, type AppSettings, type FoldingMode } from '../../../core/settings/types';
import { settingsClientRpc } from '../../../drivers/shared/clients/settingsClientRpc';
import { getTokenCss } from '../../../style/tokens';
import {
    Icons,
    bookmarkIcon,
    chatgptIcon,
    chevronDownIcon,
    chevronRightIcon,
    coffeeIcon,
    copyIcon,
    downloadIcon,
    externalLinkIcon,
    folderIcon,
    folderOpenIcon,
    folderPlusIcon,
    moveIcon,
    pencilIcon,
    searchIcon,
    settingsIcon,
    sortAZIcon,
    sortAlphaAscIcon,
    sortTimeAscIcon,
    sortTimeIcon,
    trashIcon,
    uploadIcon,
    xIcon,
} from '../../../assets/icons';
import { getBookmarksPanelCss } from './ui/styles/bookmarksPanelCss';
import type { BookmarksPanelController, BookmarksPanelSnapshot } from './BookmarksPanelController';
import type { ReaderPanel } from '../reader/ReaderPanel';
import { attachDialogKeyboardScope, type DialogKeyboardScopeHandle } from '../components/dialogKeyboardScope';
import { ModalHost } from '../components/ModalHost';
import { bookmarkSaveDialog } from './save/bookmarkSaveDialogSingleton';
import overlayCssText from '../../../style/tailwind-overlay.css?inline';
import { mountOverlaySurfaceHost, type OverlaySurfaceHostHandle } from '../overlay/OverlaySurfaceHost';
import type { ReaderItem } from '../../../services/reader/types';

type PanelTabId = 'bookmarks' | 'settings' | 'sponsor';
type SettingsMenuId = 'folding-mode' | 'language' | null;
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

type UiState = {
    bookmarksTab: PanelTabId;
    platformMenuOpen: boolean;
    settingsMenuOpen: SettingsMenuId;
    settings: AppSettings;
};

const TREE_VIRTUALIZE_THRESHOLD = 240;
const TREE_FOLDER_ROW_HEIGHT = 52;
const TREE_BOOKMARK_ROW_HEIGHT = 62;
const TREE_OVERSCAN_PX = 320;

function shouldLogBookmarksPerf(): boolean {
    try {
        if (typeof window !== 'undefined' && window.__AIMD_BOOKMARKS_PERF__) return true;
        if (typeof localStorage !== 'undefined') {
            return localStorage.getItem('aimd:bookmarks-perf') === '1';
        }
    } catch {
        // ignore
    }
    return false;
}

function logBookmarksPerf(stage: string, payload: Record<string, unknown>): void {
    if (!shouldLogBookmarksPerf()) return;
    console.log(`[aimd][bookmarks][perf] ${stage}`, payload);
}

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

function bookmarkSelectionKey(bookmark: Bookmark): string {
    return `bm:${bookmark.urlWithoutProtocol}:${bookmark.position}`;
}

function countSelectedBookmarks(keys: Set<string>): number {
    let count = 0;
    for (const key of keys) {
        if (key.startsWith('bm:')) count += 1;
    }
    return count;
}

function downloadJson(filename: string, data: unknown): void {
    try {
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = filename;
        anchor.click();
        window.setTimeout(() => URL.revokeObjectURL(url), 500);
    } catch {
        // ignore
    }
}

function mergeSettings(input: unknown): AppSettings {
    const next = input && typeof input === 'object' ? input as Partial<AppSettings> : {};
    return {
        ...DEFAULT_SETTINGS,
        ...next,
        platforms: { ...DEFAULT_SETTINGS.platforms, ...(next.platforms ?? {}) },
        chatgpt: { ...DEFAULT_SETTINGS.chatgpt, ...(next.chatgpt ?? {}) },
        behavior: { ...DEFAULT_SETTINGS.behavior, ...(next.behavior ?? {}) },
        reader: { ...DEFAULT_SETTINGS.reader, ...(next.reader ?? {}) },
        bookmarks: { ...DEFAULT_SETTINGS.bookmarks, ...(next.bookmarks ?? {}) },
    };
}

function renderToggle(role: string, label: string, checked: boolean, desc = ''): string {
    return `
      <label class="toggle-row">
        <div class="settings-label">
          <strong>${escapeHtml(label)}</strong>
          ${desc ? `<p>${escapeHtml(desc)}</p>` : ''}
        </div>
        <span class="toggle-switch" data-checked="${checked ? '1' : '0'}">
          <input type="checkbox" data-role="${role}" ${checked ? 'checked' : ''} />
          <span class="toggle-knob"></span>
        </span>
      </label>
    `;
}

function renderSettingsSelect(type: 'folding-mode' | 'language', uiState: UiState): string {
    const options = type === 'folding-mode'
        ? [
            { value: 'off', label: 'Off' },
            { value: 'all', label: 'All' },
            { value: 'keep_last_n', label: 'Keep last N' },
        ]
        : [
            { value: 'auto', label: 'Auto' },
            { value: 'en', label: 'English' },
            { value: 'zh_CN', label: '简体中文' },
        ];
    const menuId: SettingsMenuId = type;
    const currentValue = type === 'folding-mode'
        ? uiState.settings.chatgpt.foldingMode
        : uiState.settings.language;
    const currentLabel = options.find((option) => option.value === currentValue)?.label ?? options[0]!.label;
    const isOpen = uiState.settingsMenuOpen === menuId;

    return `
      <div class="settings-select-shell" data-open="${isOpen ? '1' : '0'}">
        <button class="settings-select-trigger" type="button" data-action="toggle-settings-menu" data-menu="${menuId}" aria-haspopup="listbox" aria-expanded="${isOpen ? 'true' : 'false'}">
          <span class="settings-select-trigger__label">${currentLabel}</span>
          <span class="settings-select-trigger__caret">${icon(chevronDownIcon)}</span>
        </button>
        <div class="settings-select-menu" data-open="${isOpen ? '1' : '0'}" role="listbox" tabindex="-1">
          ${options.map((option) => `
            <button class="settings-select-option" type="button" data-action="settings-select-option" data-menu="${menuId}" data-value="${option.value}" role="option" aria-selected="${option.value === currentValue ? 'true' : 'false'}" data-selected="${option.value === currentValue ? '1' : '0'}">
              <span>${option.label}</span>
              <span class="settings-option-check">${icon(Icons.check)}</span>
            </button>
          `).join('')}
        </div>
      </div>
    `;
}

function getPlatformDropdownHtml(platform: string, platforms: string[], menuOpen: boolean): string {
    const iconForPlatform = (value: string): string => {
        const normalized = value.trim().toLowerCase();
        if (normalized === 'all') return Icons.globe;
        if (normalized.includes('chatgpt')) return Icons.chatgpt;
        if (normalized.includes('gemini')) return Icons.gemini;
        if (normalized.includes('claude')) return Icons.claude;
        if (normalized.includes('deepseek')) return Icons.deepseek;
        return Icons.globe;
    };

    const options = [
        { value: 'All', label: 'All platforms', iconSvg: Icons.globe },
        ...platforms
            .filter((value) => value !== 'All')
            .map((value) => ({
                value,
                label: value,
                iconSvg: iconForPlatform(value),
            })),
    ];
    const selected = options.find((option) => option.value === platform) ?? options[0]!;

    return `
      <div class="platform-dropdown" data-open="${menuOpen ? '1' : '0'}">
        <button class="platform-dropdown__trigger" type="button" data-action="toggle-platform-menu" aria-haspopup="listbox" aria-expanded="${menuOpen ? 'true' : 'false'}">
          <span class="platform-dropdown__value">
            <span class="platform-option-icon">${icon(selected.iconSvg)}</span>
            <span class="platform-dropdown__label">${selected.label}</span>
          </span>
          <span class="platform-dropdown__caret">${icon(chevronDownIcon)}</span>
        </button>
        <div class="platform-dropdown__menu" data-open="${menuOpen ? '1' : '0'}" role="listbox">
          ${options.map((option) => `
            <button class="platform-dropdown__option" type="button" data-action="select-platform" data-value="${option.value}" role="option" data-selected="${option.value === platform ? '1' : '0'}">
              <span class="platform-option-icon">${icon(option.iconSvg)}</span>
              <span class="platform-dropdown__label">${option.label}</span>
            </button>
          `).join('')}
        </div>
      </div>
    `;
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
    if (!selectedPath) return isExpanded;
    if (selectedPath === nodePath) return isExpanded;
    if (selectedPath.startsWith(`${nodePath}/`)) return true;
    if (nodePath.startsWith(`${selectedPath}/`)) return isExpanded;
    return false;
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
    return `
      <div class="tree-item tree-item--bookmark" style="padding-left:${indent}px" data-bookmark-id="${bookmarkSelectionKey(bookmark)}" role="treeitem" aria-level="${depth + 1}">
        <span class="tree-caret-slot" aria-hidden="true"></span>
        <input class="tree-check" type="checkbox" data-action="toggle-bookmark-selection" data-bookmark-id="${bookmarkSelectionKey(bookmark)}" ${selected ? 'checked' : ''} />
        <span class="tree-icon-slot" aria-hidden="true">${icon(getBookmarkPlatformIcon(bookmark.platform))}</span>
        <button class="tree-main tree-main--bookmark" type="button" data-action="open-bookmark" data-bookmark-id="${bookmarkSelectionKey(bookmark)}">
          <span class="tree-label-row">
            <span class="tree-title-meta">
              <div class="tree-label">${escapeHtml(bookmark.title || '(untitled)')}</div>
              <div class="tree-subtitle">${escapeHtml(subtitle)}</div>
            </span>
          </span>
        </button>
        <div class="tree-actions">
          <button class="icon-btn" type="button" data-action="go-to-bookmark" data-bookmark-id="${bookmarkSelectionKey(bookmark)}" aria-label="Open conversation">${icon(externalLinkIcon)}</button>
          <button class="icon-btn" type="button" data-action="copy-bookmark" data-bookmark-id="${bookmarkSelectionKey(bookmark)}" aria-label="Copy">${icon(copyIcon)}</button>
          <button class="icon-btn" type="button" data-action="move-bookmark" data-bookmark-id="${bookmarkSelectionKey(bookmark)}" aria-label="Move bookmark">${icon(moveIcon)}</button>
          <button class="icon-btn icon-btn--danger" type="button" data-action="delete-bookmark" data-bookmark-id="${bookmarkSelectionKey(bookmark)}" aria-label="Delete">${icon(trashIcon)}</button>
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
    return `
      <div class="tree-item tree-item--folder" style="padding-left:${indent}px" data-action="toggle-folder-expand" data-path="${escapeHtml(node.folder.path)}" data-selected="${selectedPath === node.folder.path ? '1' : '0'}" role="treeitem" aria-level="${depth + 1}" aria-expanded="${expanded ? 'true' : 'false'}">
        <button class="tree-caret" type="button" data-action="toggle-folder-expand" data-path="${escapeHtml(node.folder.path)}" aria-label="${expanded ? 'Collapse folder' : 'Expand folder'}" ${hasChildren ? '' : 'disabled'}>${icon(expanded ? chevronDownIcon : chevronRightIcon)}</button>
        <input class="tree-check" type="checkbox" data-action="toggle-folder-selection" data-path="${escapeHtml(node.folder.path)}" ${folderCheckState.checked ? 'checked' : ''} data-indeterminate="${folderCheckState.indeterminate ? '1' : '0'}" />
        <div class="tree-folder-icon">${icon(expanded ? folderOpenIcon : folderIcon)}</div>
        <button class="tree-main tree-main--folder" type="button" data-action="toggle-folder-expand" data-path="${escapeHtml(node.folder.path)}">
          <div class="tree-label">${escapeHtml(node.folder.name)}</div>
        </button>
        <div class="tree-count">${count}</div>
        <div class="tree-actions">
          <button class="icon-btn" type="button" data-action="create-subfolder" data-path="${escapeHtml(node.folder.path)}" aria-label="New subfolder">${icon(folderPlusIcon)}</button>
          <button class="icon-btn" type="button" data-action="rename-folder" data-path="${escapeHtml(node.folder.path)}" aria-label="Rename folder">${icon(pencilIcon)}</button>
          <button class="icon-btn" type="button" data-action="move-folder" data-path="${escapeHtml(node.folder.path)}" aria-label="Move folder">${icon(moveIcon)}</button>
          <button class="icon-btn icon-btn--danger" type="button" data-action="delete-folder" data-path="${escapeHtml(node.folder.path)}" aria-label="Delete folder">${icon(trashIcon)}</button>
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
        visit(node, 0, null);
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

function getTreeHtml(snapshot: BookmarksPanelSnapshot, controller: BookmarksPanelController): string {
    const visibleKeys = new Set(getTreeVisibleBookmarks(snapshot).map(bookmarkSelectionKey));
    const visibleCountMap = buildVisibleFolderCountMap(snapshot.vm.folderTree, visibleKeys);
    const folderTreeHtml = snapshot.vm.folderTree
        .map((node) => renderFolderNode(
            node,
            0,
            null,
            visibleKeys,
            visibleCountMap,
            snapshot.selectedKeys,
            (path) => controller.getFolderCheckboxState(path),
            (bookmark) => controller.getBookmarkRowSubtitle(bookmark),
        ))
        .join('');

    if (folderTreeHtml) return folderTreeHtml;

    return `
      <div class="empty-state">
        <div class="empty-icon">${icon(folderIcon)}</div>
        <strong>${snapshot.vm.query || snapshot.vm.platform !== 'All' ? 'No bookmarks match the current filters' : 'No folders yet'}</strong>
        <p>${snapshot.vm.query || snapshot.vm.platform !== 'All' ? 'Clear the active filters or select a broader folder scope.' : 'Create a folder or import bookmarks to start browsing saved messages.'}</p>
        <div class="empty-actions">
          <button class="${buttonClass('primary')}" type="button" data-action="create-folder-empty">Create first folder</button>
          <button class="${buttonClass('secondary')}" type="button" data-action="import-bookmarks-empty">Import bookmarks</button>
        </div>
      </div>
    `;
}

function formatPercent(value: number | null | undefined): string {
    if (typeof value !== 'number' || !Number.isFinite(value)) return '0%';
    const normalized = Math.max(0, Math.min(100, value));
    const rounded = Math.round(normalized * 10) / 10;
    return Number.isInteger(rounded) ? `${rounded}%` : `${rounded.toFixed(1)}%`;
}

function getSettingsTabHtml(uiState: UiState, snapshot: BookmarksPanelSnapshot | null): string {
    const s = uiState.settings;
    const usage = snapshot?.storageUsage ?? null;
    const usagePercent = formatPercent(usage?.usedPercentage);
    const usageBarClass = usage?.warningLevel && usage.warningLevel !== 'none'
        ? `storage-fill storage-progress-bar ${usage.warningLevel}`
        : 'storage-fill storage-progress-bar';
    return `
      <div class="settings-grid">
        <section class="settings-card">
          <div class="card-title">${icon(Icons.globe)} Platforms</div>
          ${renderToggle('settings-platform-chatgpt', 'ChatGPT', s.platforms.chatgpt, 'Enable AI-MarkDone on ChatGPT.')}
          ${renderToggle('settings-platform-gemini', 'Gemini', s.platforms.gemini, 'Enable AI-MarkDone on Gemini.')}
          ${renderToggle('settings-platform-claude', 'Claude', s.platforms.claude, 'Enable AI-MarkDone on Claude.')}
          ${renderToggle('settings-platform-deepseek', 'DeepSeek', s.platforms.deepseek, 'Enable AI-MarkDone on DeepSeek.')}
        </section>
        <section class="settings-card">
          <div class="card-title">${icon(chatgptIcon)} ChatGPT</div>
          <div class="settings-row">
            <div class="settings-label">
              <strong>Folding mode</strong>
              <p>Controls how many messages stay expanded by default.</p>
            </div>
            ${renderSettingsSelect('folding-mode', uiState)}
          </div>
          <div class="settings-row" data-visible="${s.chatgpt.foldingMode === 'keep_last_n' ? '1' : '0'}">
            <div class="settings-label">
              <strong>Expanded count</strong>
              <p>Used only when the folding mode keeps the latest N messages visible.</p>
            </div>
            <div class="settings-number-field">
              <input class="settings-number" data-role="settings-folding-count" type="number" min="0" value="${s.chatgpt.defaultExpandedCount}" />
              <div class="settings-number-stepper">
                <button class="settings-number-step" type="button" data-action="settings-step-count" data-direction="up" aria-label="Increase expanded count">${icon(chevronDownIcon)}</button>
                <button class="settings-number-step settings-number-step--down" type="button" data-action="settings-step-count" data-direction="down" aria-label="Decrease expanded count">${icon(chevronDownIcon)}</button>
              </div>
            </div>
          </div>
          ${renderToggle('settings-fold-dock', 'Show fold dock', s.chatgpt.showFoldDock, 'Keep the compact fold dock visible in supported threads.')}
        </section>
        <section class="settings-card">
          <div class="card-title">${icon(settingsIcon)} Behavior</div>
          ${renderToggle('settings-show-view-source', 'Show View Source', s.behavior.showViewSource, 'Show the View Source action in supported toolbars and panels.')}
          ${renderToggle('settings-show-save-messages', 'Show Save Messages', s.behavior.showSaveMessages, 'Show the Save Messages action where export is supported.')}
          ${renderToggle('settings-show-word-count', 'Show Word Count', s.behavior.showWordCount, 'Display word count information for saved and rendered content.')}
          ${renderToggle('settings-click-to-copy', 'Enable click-to-copy', s.behavior.enableClickToCopy, 'Copy message content directly when supported surfaces are clicked.')}
          ${renderToggle('settings-save-context-only', 'Save context only', s.behavior.saveContextOnly, 'Only save the conversation context instead of the full thread when exporting or bookmarking.')}
          ${renderToggle('settings-render-code-reader', 'Render code in Reader', s.reader.renderCodeInReader, 'Render fenced code blocks with reader formatting instead of raw plain text.')}
        </section>
        <section class="settings-card">
          <div class="card-title">${icon(Icons.languages)} Language</div>
          <div class="settings-row">
            <div class="settings-label">
              <strong>Interface language</strong>
              <p>Auto follows the browser, or pin the UI to a specific locale.</p>
            </div>
            ${renderSettingsSelect('language', uiState)}
          </div>
        </section>
        <section class="settings-card">
          <div class="card-title">${icon(Icons.database)} Data & storage</div>
          <div class="storage-header">
            <strong>Storage used</strong>
            <span class="storage-value">${usagePercent}</span>
          </div>
          <div class="storage-track storage-progress-track"><div class="${usageBarClass}" style="width:${usagePercent}"></div></div>
          <div class="backup-callout">
            <div>
              <strong>Backup your bookmarks</strong>
              <p>Export everything before major refactors or browser reinstalls.</p>
            </div>
            <button class="${buttonClass('secondary')}" type="button" data-action="settings-export-backup">${icon(downloadIcon)} Export all</button>
          </div>
        </section>
      </div>
    `;
}

function getSponsorTabHtml(bmcUrl: string, wechatUrl: string, logoUrl: string): string {
    return `
      <div class="sponsor-celebration" aria-hidden="true"></div>
      <div class="sponsor-shell">
        <div class="sponsor-title-row">
          <img class="sponsor-brand-mark" src="${logoUrl}" alt="AI-MarkDone" />
        </div>
        <section class="sponsor-card sponsor-card--primary">
          <div class="sponsor-section-head">
            <div class="sponsor-section-icon">${icon(Icons.github)}</div>
            <div class="sponsor-section-copy">
              <div class="sponsor-section-label">Open source support</div>
              <div class="sponsor-section-note">Star the repository to help the project stay visible.</div>
            </div>
          </div>
          <p>If the project is useful, starring the repository is the fastest way to help. It improves discoverability and makes continued maintenance easier to justify.</p>
          <div class="sponsor-action-row">
            <button class="${buttonClass('primary')} sponsor-cta-button" type="button" data-action="sponsor-github">${icon(Icons.github)} Star on GitHub</button>
          </div>
        </section>
        <section class="sponsor-card sponsor-card--secondary">
          <div class="sponsor-section-head sponsor-section-head--centered">
            <div class="sponsor-section-icon sponsor-section-icon--warm">${icon(coffeeIcon)}</div>
            <div class="sponsor-section-copy">
              <div class="sponsor-section-label">Donate</div>
              <div class="sponsor-section-note">Support development directly with the existing sponsor channels.</div>
            </div>
          </div>
          <p>If AI-MarkDone saves you time, you can also support development directly through the same two channels used in the shipped sponsor tab.</p>
          <div class="sponsor-qr-grid">
            <article class="sponsor-qr-card">
              <div class="sponsor-qr-meta">
                <strong>Buy Me a Coffee</strong>
                <span>Quick international support</span>
              </div>
              <div class="sponsor-qr-frame">
                <img class="sponsor-qr-image" src="${bmcUrl}" alt="Buy Me a Coffee QR code" />
              </div>
            </article>
            <article class="sponsor-qr-card">
              <div class="sponsor-qr-meta">
                <strong>WeChat reward</strong>
                <span>Direct appreciation in WeChat</span>
              </div>
              <div class="sponsor-qr-frame">
                <img class="sponsor-qr-image" src="${wechatUrl}" alt="WeChat appreciation code" />
              </div>
            </article>
          </div>
        </section>
      </div>
    `;
}

function getPanelHtml(
    uiState: UiState,
    snapshot: BookmarksPanelSnapshot | null,
    controller: BookmarksPanelController,
    bmcUrl: string,
    wechatUrl: string,
    logoUrl: string,
    treeHtml: string,
    treeMode: 'inline' | 'virtualized',
): string {
    const title = uiState.bookmarksTab === 'bookmarks' ? 'Bookmarks' : uiState.bookmarksTab === 'settings' ? 'Settings' : 'Sponsor';
    const platform = snapshot?.vm.platform ?? 'All';
    const sortMode = snapshot?.vm.sortMode ?? uiState.settings.bookmarks.sortMode;
    const query = snapshot?.vm.query ?? '';
    const selectedCount = snapshot ? countSelectedBookmarks(snapshot.selectedKeys) : 0;

    return `
      <div class="panel-stage__overlay aimd-panel-overlay">
        <div class="panel-window panel-window--bookmarks aimd-panel" role="dialog" aria-modal="true" aria-label="${title}">
          <div class="panel-header">
            <div class="panel-header__meta">
              <h2 class="aimd-panel-title">${title}</h2>
            </div>
            <div class="panel-header__actions">
              <button class="icon-btn" type="button" data-action="close-panel" aria-label="Close panel">${icon(xIcon)}</button>
            </div>
          </div>
          <div class="bookmarks-shell">
            <nav class="bookmarks-sidebar">
              <button class="tab-btn" type="button" data-action="set-bookmarks-tab" data-tab="bookmarks" data-active="${uiState.bookmarksTab === 'bookmarks' ? '1' : '0'}">${icon(bookmarkIcon)}<span>Bookmarks</span></button>
              <button class="tab-btn" type="button" data-action="set-bookmarks-tab" data-tab="settings" data-active="${uiState.bookmarksTab === 'settings' ? '1' : '0'}">${icon(settingsIcon)}<span>Settings</span></button>
              <button class="tab-btn" type="button" data-action="set-bookmarks-tab" data-tab="sponsor" data-active="${uiState.bookmarksTab === 'sponsor' ? '1' : '0'}">${icon(coffeeIcon)}<span>Sponsor</span></button>
            </nav>
            <div class="bookmarks-body">
              <section class="tab-panel tab-panel--bookmarks" data-active="${uiState.bookmarksTab === 'bookmarks' ? '1' : '0'}">
                <div class="toolbar-row toolbar-row--bookmarks">
                  <div class="search-field">
                    ${icon(searchIcon)}
                    <input data-role="bookmark-query" value="${escapeHtml(query)}" placeholder="Search bookmarks" />
                  </div>
                  ${getPlatformDropdownHtml(platform, controller.getPlatforms(), uiState.platformMenuOpen)}
                  <div class="toolbar-actions">
                    <button class="icon-btn" type="button" data-action="toggle-sort-time" data-active="${sortMode.startsWith('time') ? '1' : '0'}" aria-label="Sort by time">${icon(sortMode === 'time-asc' ? sortTimeAscIcon : sortTimeIcon)}</button>
                    <button class="icon-btn" type="button" data-action="toggle-sort-alpha" data-active="${sortMode.startsWith('alpha') ? '1' : '0'}" aria-label="Sort alphabetically">${icon(sortMode === 'alpha-asc' ? sortAlphaAscIcon : sortAZIcon)}</button>
                    <button class="icon-btn" type="button" data-action="create-folder" aria-label="Create folder">${icon(folderPlusIcon)}</button>
                    <button class="icon-btn" type="button" data-action="import-bookmarks" aria-label="Import bookmarks">${icon(uploadIcon)}</button>
                    <button class="icon-btn" type="button" data-action="export-all-bookmarks" aria-label="Export all bookmarks">${icon(downloadIcon)}</button>
                    <input data-role="import-file" type="file" accept="application/json" style="display:none" />
                  </div>
                </div>
                <div class="tree-panel" data-virtualized="${treeMode === 'virtualized' ? '1' : '0'}">${treeHtml}</div>
                <div class="batch-bar" data-active="${selectedCount > 0 ? '1' : '0'}" aria-hidden="${selectedCount > 0 ? 'false' : 'true'}">
                  <div class="batch-label">${selectedCount > 0 ? `${selectedCount} selected` : ''}</div>
                  <div class="batch-actions">
                    <button class="icon-btn" type="button" data-action="batch-move" aria-label="Move selected" ${selectedCount === 0 ? 'disabled' : ''}>${icon(moveIcon)}</button>
                    <button class="icon-btn icon-btn--danger" type="button" data-action="batch-delete" aria-label="Delete selected" ${selectedCount === 0 ? 'disabled' : ''}>${icon(trashIcon)}</button>
                    <button class="icon-btn" type="button" data-action="batch-export" aria-label="Export selected" ${selectedCount === 0 ? 'disabled' : ''}>${icon(downloadIcon)}</button>
                    <button class="icon-btn" type="button" data-action="batch-clear" aria-label="Clear selection" ${selectedCount === 0 ? 'disabled' : ''}>${icon(xIcon)}</button>
                  </div>
                </div>
              </section>
              <section class="tab-panel settings-panel" data-active="${uiState.bookmarksTab === 'settings' ? '1' : '0'}">
                ${getSettingsTabHtml(uiState, snapshot)}
              </section>
              <section class="tab-panel sponsor-panel" data-active="${uiState.bookmarksTab === 'sponsor' ? '1' : '0'}">
                ${getSponsorTabHtml(bmcUrl, wechatUrl, logoUrl)}
              </section>
            </div>
          </div>
        </div>
      </div>
    `;
}

export class BookmarksPanel {
    private readonly controller: BookmarksPanelController;
    private readonly readerPanel: ReaderPanel;
    private readonly uiState: UiState = {
        bookmarksTab: 'bookmarks',
        platformMenuOpen: false,
        settingsMenuOpen: null,
        settings: structuredClone(DEFAULT_SETTINGS),
    };
    private readonly panelScrollTops: Record<PanelTabId, number> = {
        bookmarks: 0,
        settings: 0,
        sponsor: 0,
    };

    private visible = false;
    private hostHandle: OverlaySurfaceHostHandle | null = null;
    private keyboardHandle: DialogKeyboardScopeHandle | null = null;
    private modalHost: ModalHost | null = null;
    private snapshot: BookmarksPanelSnapshot | null = null;
    private treeVirtualModel: VirtualTreeModel | null = null;
    private treePanelEl: HTMLElement | null = null;
    private treeFrameHandle: number | null = null;
    private treeRenderedRange: { startIndex: number; endIndex: number } | null = null;
    private unsubscribeSnapshot: (() => void) | null = null;
    private readonly onShadowPointerDown = (event: Event) => {
        if (!this.hostHandle) return;

        const target = event.target as HTMLElement | null;
        if (!target) return;

        if (target.closest('.mock-modal-host, .mock-modal-overlay, .mock-modal')) {
            return;
        }

        const panel = this.hostHandle.surfaceRoot.querySelector<HTMLElement>('.panel-window');
        if (!panel) return;

        if (!panel.contains(target)) {
            this.hide();
            return;
        }

        let shouldRerender = false;

        if (this.uiState.platformMenuOpen && !target.closest('.platform-dropdown')) {
            this.uiState.platformMenuOpen = false;
            shouldRerender = true;
        }

        if (this.uiState.settingsMenuOpen && !target.closest('.settings-select-shell')) {
            this.uiState.settingsMenuOpen = null;
            shouldRerender = true;
        }

        if (shouldRerender) {
            this.render();
        }
    };

    constructor(controller: BookmarksPanelController, readerPanel: ReaderPanel) {
        this.controller = controller;
        this.readerPanel = readerPanel;
    }

    isVisible(): boolean {
        return this.visible;
    }

    async toggle(): Promise<void> {
        if (this.visible) {
            this.hide();
            return;
        }
        await this.show();
    }

    async show(): Promise<void> {
        if (this.visible) return;

        this.visible = true;
        this.hostHandle = mountOverlaySurfaceHost({
            id: 'aimd-bookmarks-panel-host',
            themeCss: getTokenCss(this.controller.getTheme()),
            surfaceCss: getBookmarksPanelCss(),
            overlayCss: overlayCssText,
            lockScroll: true,
            surfaceStyleId: 'aimd-bookmarks-panel-structure',
            overlayStyleId: 'aimd-bookmarks-panel-tailwind',
        });
        this.modalHost = new ModalHost(this.hostHandle.shadow);
        logBookmarksPerf('panel:perf-logging-enabled', {
            visible: true,
            tab: this.uiState.bookmarksTab,
        });

        this.unsubscribeSnapshot = this.controller.subscribe((snapshot) => {
            const previousSnapshot = this.snapshot;
            this.snapshot = snapshot;
            if (!this.applySnapshotUpdate(previousSnapshot, snapshot)) {
                this.render();
            }
        });

        await Promise.all([
            this.controller.refreshAll(),
            this.controller.refreshPositionsForUrl(window.location.href.split('#')[0] || window.location.href),
            this.controller.refreshUiState(),
            this.loadSettings(),
        ]);

        this.render();

        this.keyboardHandle = attachDialogKeyboardScope({
            root: this.hostHandle.host,
            onEscape: () => this.hide(),
            stopPropagationAll: true,
            ignoreEscapeWhileComposing: true,
            trapTabWithin: this.hostHandle.surfaceRoot.querySelector<HTMLElement>('.panel-window') ?? this.hostHandle.host,
        });
    }

    hide(): void {
        if (!this.visible) return;

        this.visible = false;
        this.unsubscribeSnapshot?.();
        this.unsubscribeSnapshot = null;
        this.keyboardHandle?.detach();
        this.keyboardHandle = null;
        if (this.treeFrameHandle !== null) {
            window.cancelAnimationFrame(this.treeFrameHandle);
            this.treeFrameHandle = null;
        }
        this.treePanelEl?.removeEventListener('scroll', this.onTreePanelScroll);
        this.treePanelEl = null;
        this.hostHandle?.shadow.removeEventListener('pointerdown', this.onShadowPointerDown, true);
        this.hostHandle?.unmount();
        this.hostHandle = null;
        this.modalHost = null;
        this.treeVirtualModel = null;
        this.treeRenderedRange = null;
    }

    private async loadSettings(): Promise<void> {
        const result = await settingsClientRpc.getAll();
        if (!result.ok) return;
        this.uiState.settings = mergeSettings(result.data.settings);
    }

    private render(): void {
        if (!this.hostHandle) return;
        const startedAt = performance.now();
        this.captureScrollTops();

        const bmcUrl = browser.runtime.getURL('icons/bmc_qr.png');
        const wechatUrl = browser.runtime.getURL('icons/wechat_qr.png');
        const logoUrl = browser.runtime.getURL('icons/icon128.png');
        const treePlan = this.getTreeRenderPlan();
        this.treeVirtualModel = treePlan.mode === 'virtualized' ? treePlan.model : null;

        this.hostHandle.backdropRoot.innerHTML = getPanelHtml(
            this.uiState,
            this.snapshot,
            this.controller,
            bmcUrl,
            wechatUrl,
            logoUrl,
            treePlan.mode === 'inline' ? treePlan.html : '',
            treePlan.mode,
        );
        this.hostHandle.surfaceRoot.replaceChildren();

        const overlay = this.hostHandle.backdropRoot.querySelector<HTMLElement>('.panel-stage__overlay');
        const panel = overlay?.querySelector<HTMLElement>('.panel-window');
        if (!overlay || !panel) return;

        this.hostHandle.backdropRoot.replaceChildren(overlay);
        this.hostHandle.surfaceRoot.appendChild(panel);
        this.restoreScrollTop();
        this.bindTreePanel(panel.querySelector<HTMLElement>('.tree-panel'));

        for (const checkbox of panel.querySelectorAll<HTMLInputElement>('.tree-check[data-indeterminate="1"]')) {
            checkbox.indeterminate = true;
        }

        panel.addEventListener('click', (event) => void this.handleClick(event));
        panel.addEventListener('input', (event) => void this.handleInput(event));
        panel.addEventListener('change', (event) => void this.handleChange(event));
        this.hostHandle.shadow.removeEventListener('pointerdown', this.onShadowPointerDown, true);
        this.hostHandle.shadow.addEventListener('pointerdown', this.onShadowPointerDown, true);
        logBookmarksPerf('panel:full-render', {
            durationMs: Number((performance.now() - startedAt).toFixed(2)),
            tab: this.uiState.bookmarksTab,
            virtualized: Boolean(this.treeVirtualModel),
            visibleBookmarks: this.snapshot?.vm.bookmarks.length ?? 0,
        });
    }

    private readonly onTreePanelScroll = (): void => {
        if (!this.treePanelEl) return;
        this.panelScrollTops.bookmarks = this.treePanelEl.scrollTop;
        if (!this.treeVirtualModel) return;
        if (this.treeFrameHandle !== null) return;

        this.treeFrameHandle = window.requestAnimationFrame(() => {
            this.treeFrameHandle = null;
            if (!this.treePanelEl || !this.treeVirtualModel) return;
            this.renderVirtualTreeWindow(this.treePanelEl, this.treeVirtualModel);
        });
    };

    private clearTreeRenderState(): void {
        if (this.treeFrameHandle !== null) {
            window.cancelAnimationFrame(this.treeFrameHandle);
            this.treeFrameHandle = null;
        }
        this.treeRenderedRange = null;
    }

    private applySnapshotUpdate(previousSnapshot: BookmarksPanelSnapshot | null, nextSnapshot: BookmarksPanelSnapshot): boolean {
        if (!this.hostHandle || !previousSnapshot) return false;
        const startedAt = performance.now();

        const panel = this.hostHandle.surfaceRoot.querySelector<HTMLElement>('.panel-window.panel-window--bookmarks');
        if (!panel) return false;

        const bookmarksTab = panel.querySelector<HTMLElement>('.tab-panel--bookmarks');
        if (!bookmarksTab) return false;

        this.patchBookmarksToolbar(bookmarksTab, nextSnapshot);
        this.patchTreePanel(bookmarksTab);
        this.patchBatchBar(bookmarksTab, nextSnapshot);
        logBookmarksPerf('panel:patch-snapshot', {
            durationMs: Number((performance.now() - startedAt).toFixed(2)),
            virtualized: Boolean(this.treeVirtualModel),
            visibleBookmarks: nextSnapshot.vm.bookmarks.length,
            selectedKeys: nextSnapshot.selectedKeys.size,
            query: nextSnapshot.vm.query,
            platform: nextSnapshot.vm.platform,
        });
        return true;
    }

    private patchBookmarksToolbar(bookmarksTab: HTMLElement, snapshot: BookmarksPanelSnapshot): void {
        const queryInput = bookmarksTab.querySelector<HTMLInputElement>('[data-role="bookmark-query"]');
        if (queryInput && document.activeElement !== queryInput && queryInput.value !== snapshot.vm.query) {
            queryInput.value = snapshot.vm.query;
        }

        const platformDropdown = bookmarksTab.querySelector<HTMLElement>('.platform-dropdown');
        const nextPlatformMarkup = getPlatformDropdownHtml(snapshot.vm.platform, this.controller.getPlatforms(), this.uiState.platformMenuOpen);
        if (platformDropdown) {
            const wrapper = document.createElement('div');
            wrapper.innerHTML = nextPlatformMarkup.trim();
            const nextDropdown = wrapper.firstElementChild;
            if (nextDropdown) platformDropdown.replaceWith(nextDropdown);
        }

        const timeButton = bookmarksTab.querySelector<HTMLElement>('[data-action="toggle-sort-time"]');
        if (timeButton) {
            timeButton.dataset.active = snapshot.vm.sortMode.startsWith('time') ? '1' : '0';
            timeButton.innerHTML = icon(snapshot.vm.sortMode === 'time-asc' ? sortTimeAscIcon : sortTimeIcon);
        }

        const alphaButton = bookmarksTab.querySelector<HTMLElement>('[data-action="toggle-sort-alpha"]');
        if (alphaButton) {
            alphaButton.dataset.active = snapshot.vm.sortMode.startsWith('alpha') ? '1' : '0';
            alphaButton.innerHTML = icon(snapshot.vm.sortMode === 'alpha-asc' ? sortAlphaAscIcon : sortAZIcon);
        }
    }

    private patchTreePanel(bookmarksTab: HTMLElement): void {
        const treePanel = bookmarksTab.querySelector<HTMLElement>('.tree-panel');
        if (!treePanel) return;
        const startedAt = performance.now();

        const treePlan = this.getTreeRenderPlan();
        this.treeVirtualModel = treePlan.mode === 'virtualized' ? treePlan.model : null;
        treePanel.dataset.virtualized = treePlan.mode === 'virtualized' ? '1' : '0';

        if (treePlan.mode === 'inline') {
            if (this.treePanelEl) {
                this.treePanelEl.removeEventListener('scroll', this.onTreePanelScroll);
            }
            this.clearTreeRenderState();
            this.treePanelEl = treePanel;
            treePanel.innerHTML = treePlan.html;
            for (const checkbox of treePanel.querySelectorAll<HTMLInputElement>('.tree-check[data-indeterminate="1"]')) {
                checkbox.indeterminate = true;
            }
            logBookmarksPerf('panel:patch-tree-inline', {
                durationMs: Number((performance.now() - startedAt).toFixed(2)),
                visibleBookmarks: this.snapshot?.vm.bookmarks.length ?? 0,
            });
            return;
        }

        this.bindTreePanel(treePanel);
        logBookmarksPerf('panel:patch-tree-virtualized', {
            durationMs: Number((performance.now() - startedAt).toFixed(2)),
            rows: treePlan.model.rows.length,
            totalHeight: treePlan.model.totalHeight,
        });
    }

    private patchBatchBar(bookmarksTab: HTMLElement, snapshot: BookmarksPanelSnapshot): void {
        const selectedCount = countSelectedBookmarks(snapshot.selectedKeys);
        const batchBar = bookmarksTab.querySelector<HTMLElement>('.batch-bar');
        if (!batchBar) return;

        batchBar.dataset.active = selectedCount > 0 ? '1' : '0';
        batchBar.setAttribute('aria-hidden', selectedCount > 0 ? 'false' : 'true');
        const label = batchBar.querySelector<HTMLElement>('.batch-label');
        if (label) {
            label.textContent = selectedCount > 0 ? `${selectedCount} selected` : '';
        }

        for (const button of batchBar.querySelectorAll<HTMLButtonElement>('.icon-btn')) {
            button.disabled = selectedCount === 0;
        }
    }

    private getTreeRenderPlan(): TreeRenderPlan {
        if (!this.snapshot) {
            return {
                mode: 'inline',
                html: `
      <div class="empty-state">
        <div class="empty-icon">${icon(folderIcon)}</div>
        <strong>No folders yet</strong>
        <p>Create a folder or import bookmarks to start browsing saved messages.</p>
        <div class="empty-actions">
          <button class="${buttonClass('primary')}" type="button" data-action="create-folder-empty">Create first folder</button>
          <button class="${buttonClass('secondary')}" type="button" data-action="import-bookmarks-empty">Import bookmarks</button>
        </div>
      </div>
    `,
            };
        }

        const virtualModel = buildVirtualTreeModel(this.snapshot, this.controller);
        if (virtualModel) {
            return { mode: 'virtualized', model: virtualModel };
        }

        return {
            mode: 'inline',
            html: getTreeHtml(this.snapshot, this.controller),
        };
    }

    private bindTreePanel(treePanel: HTMLElement | null): void {
        this.treePanelEl?.removeEventListener('scroll', this.onTreePanelScroll);
        this.clearTreeRenderState();
        this.treePanelEl = treePanel;
        if (!treePanel) return;

        if (this.treeVirtualModel) {
            treePanel.addEventListener('scroll', this.onTreePanelScroll, { passive: true });
            this.renderVirtualTreeWindow(treePanel, this.treeVirtualModel);
        }
    }

    private renderVirtualTreeWindow(treePanel: HTMLElement, model: VirtualTreeModel): void {
        const startedAt = performance.now();
        const viewportHeight = treePanel.clientHeight || 640;
        const startPx = Math.max(0, treePanel.scrollTop - TREE_OVERSCAN_PX);
        const endPx = treePanel.scrollTop + viewportHeight + TREE_OVERSCAN_PX;

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

        treePanel.innerHTML = `
          <div class="tree-virtual-spacer" style="height:${topSpacer}px"></div>
          ${visibleRows.map((row) => renderVirtualTreeRow(row)).join('')}
          <div class="tree-virtual-spacer" style="height:${bottomSpacer}px"></div>
        `;

        for (const checkbox of treePanel.querySelectorAll<HTMLInputElement>('.tree-check[data-indeterminate="1"]')) {
            checkbox.indeterminate = true;
        }
        logBookmarksPerf('panel:render-virtual-window', {
            durationMs: Number((performance.now() - startedAt).toFixed(2)),
            startIndex: nextRange.startIndex,
            endIndex: nextRange.endIndex,
            renderedRows: visibleRows.length,
            scrollTop: treePanel.scrollTop,
        });
    }

    private async handleClick(event: Event): Promise<void> {
        const target = event.target as HTMLElement | null;
        if (this.uiState.bookmarksTab === 'sponsor' && target?.closest('.sponsor-panel')) {
            this.emitSponsorBurst(event as MouseEvent);
        }
        const actionEl = target?.closest<HTMLElement>('[data-action]');
        if (!actionEl) return;

        const action = actionEl.dataset.action;
        logBookmarksPerf('panel:action', {
            action,
            tab: this.uiState.bookmarksTab,
            bookmarkId: actionEl.dataset.bookmarkId ?? null,
            path: actionEl.dataset.path ?? null,
        });
        switch (action) {
            case 'close-panel':
                this.hide();
                return;
            case 'set-bookmarks-tab': {
                const tab = actionEl.dataset.tab;
                if (tab === 'bookmarks' || tab === 'settings' || tab === 'sponsor') {
                    this.uiState.bookmarksTab = tab;
                    this.uiState.platformMenuOpen = false;
                    this.uiState.settingsMenuOpen = null;
                    this.render();
                }
                return;
            }
            case 'toggle-platform-menu':
                this.uiState.platformMenuOpen = !this.uiState.platformMenuOpen;
                this.render();
                return;
            case 'select-platform':
                if (actionEl.dataset.value) {
                    this.uiState.platformMenuOpen = false;
                    this.controller.setPlatform(actionEl.dataset.value);
                }
                return;
            case 'toggle-sort-time':
                this.controller.setSortMode(this.snapshot?.vm.sortMode === 'time-desc' ? 'time-asc' : 'time-desc');
                return;
            case 'toggle-sort-alpha':
                this.controller.setSortMode(this.snapshot?.vm.sortMode === 'alpha-asc' ? 'alpha-desc' : 'alpha-asc');
                return;
            case 'create-folder':
            case 'create-folder-empty':
                await this.createFolder();
                return;
            case 'import-bookmarks':
            case 'import-bookmarks-empty':
                this.findImportInput()?.click();
                return;
            case 'export-all-bookmarks':
            case 'settings-export-backup':
                await this.exportAll();
                return;
            case 'batch-clear':
                this.controller.clearSelection();
                return;
            case 'batch-move':
                await this.batchMove();
                return;
            case 'batch-delete':
                await this.batchDelete();
                return;
            case 'batch-export':
                await this.exportSelected();
                return;
            case 'toggle-folder-expand':
                if (actionEl.dataset.path) this.controller.toggleFolderExpanded(actionEl.dataset.path);
                return;
            case 'select-folder':
                this.controller.selectFolder(actionEl.dataset.path ?? null);
                return;
            case 'toggle-folder-selection':
                return;
            case 'create-subfolder':
                if (actionEl.dataset.path) await this.createSubfolder(actionEl.dataset.path);
                return;
            case 'rename-folder':
                if (actionEl.dataset.path) await this.renameFolder(actionEl.dataset.path);
                return;
            case 'move-folder':
                if (actionEl.dataset.path) await this.moveFolder(actionEl.dataset.path);
                return;
            case 'delete-folder':
                if (actionEl.dataset.path) await this.deleteFolder(actionEl.dataset.path);
                return;
            case 'open-bookmark':
            case 'go-to-bookmark': {
                const bookmark = this.findBookmarkBySelectionKey(actionEl.dataset.bookmarkId);
                if (!bookmark) return;
                if (action === 'open-bookmark') {
                    await this.openPreviewInReader(bookmark);
                    return;
                }
                await this.controller.goToBookmark(bookmark);
                return;
            }
            case 'copy-bookmark': {
                const bookmark = this.findBookmarkBySelectionKey(actionEl.dataset.bookmarkId);
                if (bookmark) await this.controller.copyBookmarkMarkdown(bookmark);
                return;
            }
            case 'move-bookmark': {
                const bookmark = this.findBookmarkBySelectionKey(actionEl.dataset.bookmarkId);
                if (bookmark) await this.moveBookmark(bookmark);
                return;
            }
            case 'delete-bookmark': {
                const bookmark = this.findBookmarkBySelectionKey(actionEl.dataset.bookmarkId);
                if (bookmark && await this.confirmDialog('warning', 'Delete bookmark', 'Delete this bookmark?', true)) {
                    await this.controller.deleteBookmark(bookmark);
                }
                return;
            }
            case 'toggle-settings-menu': {
                const menu = actionEl.dataset.menu;
                this.uiState.settingsMenuOpen = this.uiState.settingsMenuOpen === menu ? null : (menu as SettingsMenuId);
                this.render();
                return;
            }
            case 'settings-select-option':
                await this.handleSettingsSelectOption(actionEl);
                return;
            case 'settings-step-count':
                await this.handleSettingsStep(actionEl.dataset.direction === 'up' ? 1 : -1);
                return;
            case 'sponsor-github':
                window.open('https://github.com/zhaoliangbin42/AI-MarkDone', '_blank', 'noopener,noreferrer');
                return;
            default:
                return;
        }
    }

    private async handleInput(event: Event): Promise<void> {
        const target = event.target as HTMLInputElement | null;
        if (!target) return;

        if (target.dataset.role === 'bookmark-query') {
            this.controller.setQuery(target.value);
            return;
        }

        if (target.dataset.role === 'settings-folding-count') {
            const next = Math.max(0, Math.floor(Number(target.value) || 0));
            this.uiState.settings.chatgpt.defaultExpandedCount = next;
            await settingsClientRpc.setCategory('chatgpt', { defaultExpandedCount: next });
        }
    }

    private async handleChange(event: Event): Promise<void> {
        const target = event.target as HTMLInputElement | null;
        if (!target) return;

        if (target.dataset.action === 'toggle-folder-selection' && target.dataset.path) {
            this.controller.toggleFolderSelection(target.dataset.path);
            return;
        }

        if (target.dataset.action === 'toggle-bookmark-selection' && target.dataset.bookmarkId) {
            const bookmark = this.findBookmarkBySelectionKey(target.dataset.bookmarkId);
            if (bookmark) this.controller.toggleBookmarkSelection(bookmark);
            return;
        }

        if (target.dataset.role === 'import-file') {
            await this.importFromFile(target);
            return;
        }

        if (target.dataset.role?.startsWith('settings-')) {
            await this.handleSettingsToggle(target);
        }
    }

    private async handleSettingsSelectOption(element: HTMLElement): Promise<void> {
        const menu = element.dataset.menu;
        const value = element.dataset.value;
        if (!menu || !value) return;

        if (menu === 'folding-mode') {
            this.uiState.settings.chatgpt.foldingMode = value as FoldingMode;
            await settingsClientRpc.setCategory('chatgpt', { foldingMode: value });
        } else if (menu === 'language') {
            this.uiState.settings.language = value as AppSettings['language'];
            await settingsClientRpc.setCategory('language', value);
        }
        this.uiState.settingsMenuOpen = null;
        this.render();
    }

    private async handleSettingsStep(delta: number): Promise<void> {
        const next = Math.max(0, this.uiState.settings.chatgpt.defaultExpandedCount + delta);
        this.uiState.settings.chatgpt.defaultExpandedCount = next;
        await settingsClientRpc.setCategory('chatgpt', { defaultExpandedCount: next });
        this.render();
    }

    private async handleSettingsToggle(input: HTMLInputElement): Promise<void> {
        switch (input.dataset.role) {
            case 'settings-platform-chatgpt':
                this.uiState.settings.platforms.chatgpt = input.checked;
                await settingsClientRpc.setCategory('platforms', { chatgpt: input.checked });
                break;
            case 'settings-platform-gemini':
                this.uiState.settings.platforms.gemini = input.checked;
                await settingsClientRpc.setCategory('platforms', { gemini: input.checked });
                break;
            case 'settings-platform-claude':
                this.uiState.settings.platforms.claude = input.checked;
                await settingsClientRpc.setCategory('platforms', { claude: input.checked });
                break;
            case 'settings-platform-deepseek':
                this.uiState.settings.platforms.deepseek = input.checked;
                await settingsClientRpc.setCategory('platforms', { deepseek: input.checked });
                break;
            case 'settings-fold-dock':
                this.uiState.settings.chatgpt.showFoldDock = input.checked;
                await settingsClientRpc.setCategory('chatgpt', { showFoldDock: input.checked });
                break;
            case 'settings-show-view-source':
                this.uiState.settings.behavior.showViewSource = input.checked;
                await settingsClientRpc.setCategory('behavior', { showViewSource: input.checked });
                break;
            case 'settings-show-save-messages':
                this.uiState.settings.behavior.showSaveMessages = input.checked;
                await settingsClientRpc.setCategory('behavior', { showSaveMessages: input.checked });
                break;
            case 'settings-show-word-count':
                this.uiState.settings.behavior.showWordCount = input.checked;
                await settingsClientRpc.setCategory('behavior', { showWordCount: input.checked });
                break;
            case 'settings-click-to-copy':
                this.uiState.settings.behavior.enableClickToCopy = input.checked;
                await settingsClientRpc.setCategory('behavior', { enableClickToCopy: input.checked });
                break;
            case 'settings-save-context-only':
                this.uiState.settings.behavior.saveContextOnly = input.checked;
                await settingsClientRpc.setCategory('behavior', { saveContextOnly: input.checked });
                break;
            case 'settings-render-code-reader':
                this.uiState.settings.reader.renderCodeInReader = input.checked;
                await settingsClientRpc.setCategory('reader', { renderCodeInReader: input.checked });
                break;
            default:
                return;
        }
        this.render();
    }

    private captureScrollTops(): void {
        if (!this.hostHandle) return;
        const bookmarksPanel = this.hostHandle.surfaceRoot.querySelector<HTMLElement>('.tree-panel');
        const settingsPanel = this.hostHandle.surfaceRoot.querySelector<HTMLElement>('.settings-panel');
        const sponsorPanel = this.hostHandle.surfaceRoot.querySelector<HTMLElement>('.sponsor-panel');

        if (bookmarksPanel) this.panelScrollTops.bookmarks = bookmarksPanel.scrollTop;
        if (settingsPanel) this.panelScrollTops.settings = settingsPanel.scrollTop;
        if (sponsorPanel) this.panelScrollTops.sponsor = sponsorPanel.scrollTop;
    }

    private restoreScrollTop(): void {
        if (!this.hostHandle) return;

        if (this.uiState.bookmarksTab === 'bookmarks') {
            const bookmarksPanel = this.hostHandle.surfaceRoot.querySelector<HTMLElement>('.tree-panel');
            if (bookmarksPanel) bookmarksPanel.scrollTop = this.panelScrollTops.bookmarks;
            return;
        }

        if (this.uiState.bookmarksTab === 'settings') {
            const settingsPanel = this.hostHandle.surfaceRoot.querySelector<HTMLElement>('.settings-panel');
            if (settingsPanel) settingsPanel.scrollTop = this.panelScrollTops.settings;
            return;
        }

        const sponsorPanel = this.hostHandle.surfaceRoot.querySelector<HTMLElement>('.sponsor-panel');
        if (sponsorPanel) sponsorPanel.scrollTop = this.panelScrollTops.sponsor;
    }

    private emitSponsorBurst(event: MouseEvent): void {
        if (!this.hostHandle) return;

        const panel = this.hostHandle.surfaceRoot.querySelector<HTMLElement>('.sponsor-panel');
        const layer = this.hostHandle.surfaceRoot.querySelector<HTMLElement>('.sponsor-celebration');
        if (!panel || !layer) return;

        const rect = layer.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;
        const colors = [
            'var(--aimd-interactive-primary)',
            'var(--aimd-color-warning)',
            'color-mix(in srgb, var(--aimd-state-success-border) 72%, #10b981)',
            'color-mix(in srgb, var(--aimd-text-primary) 24%, white)',
        ];

        for (let index = 0; index < 18; index += 1) {
            const piece = document.createElement('span');
            piece.className = 'sponsor-burst-piece';
            const angle = (Math.PI * 2 * index) / 18;
            const distance = 44 + (index % 4) * 18;
            piece.style.left = `${x}px`;
            piece.style.top = `${y}px`;
            piece.style.setProperty('--piece-color', colors[index % colors.length]);
            piece.style.setProperty('--piece-x', `${Math.cos(angle) * distance}px`);
            piece.style.setProperty('--piece-y', `${Math.sin(angle) * distance}px`);
            piece.style.setProperty('--piece-rotate', `${index * 22}deg`);
            layer.appendChild(piece);
            window.setTimeout(() => piece.remove(), 920);
        }
    }

    private async openPreviewInReader(bookmark: Bookmark): Promise<void> {
        const snapshot = this.snapshot;
        if (!snapshot) return;

        const visibleKeys = new Set<string>(getTreeVisibleBookmarks(snapshot).map(bookmarkSelectionKey));
        const queryActive = Boolean(snapshot.vm.query.trim());
        const { list, startIndex } = this.buildReaderScopeList({
            bookmark,
            folderTree: snapshot.vm.folderTree,
            visibleKeys,
            queryActive,
        });
        if (list.length === 0) return;

        const items: ReaderItem[] = list.map((item) => ({
            id: bookmarkSelectionKey(item),
            userPrompt: item.userMessage || item.title || '',
            content: item.aiResponse ?? '',
        }));

        await this.readerPanel.show(items, startIndex, this.controller.getTheme(), {
            showOpenConversation: true,
            dotStyle: 'plain',
            onOpenConversation: async (ctx) => {
                const current = list[ctx.index] ?? null;
                if (!current) return;
                this.readerPanel.hide();
                await this.controller.goToBookmark(current);
            },
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
        const startIndex = list.findIndex((item) => bookmarkSelectionKey(item) === key);
        if (startIndex >= 0) return { list, startIndex };
        return { list: [params.bookmark], startIndex: 0 };
    }

    private flattenVisibleBookmarksInTreeOrder(nodes: FolderTreeNode[], visibleKeys: Set<string>): Bookmark[] {
        const result: Bookmark[] = [];
        for (const node of nodes) {
            if (node.children.length > 0) {
                result.push(...this.flattenVisibleBookmarksInTreeOrder(node.children, visibleKeys));
            }
            for (const bookmark of node.bookmarks) {
                if (visibleKeys.has(bookmarkSelectionKey(bookmark))) result.push(bookmark);
            }
        }
        return result;
    }

    private getVisibleBookmarksInSameFolder(nodes: FolderTreeNode[], visibleKeys: Set<string>, bookmark: Bookmark): Bookmark[] {
        const node = this.findFolderNode(nodes, bookmark.folderPath);
        if (node) {
            return node.bookmarks.filter((item) => visibleKeys.has(bookmarkSelectionKey(item)));
        }

        const snapshot = this.snapshot;
        if (!snapshot) return [bookmark];
        const list = snapshot.vm.bookmarks.filter((item) => item.folderPath === bookmark.folderPath);
        return list.length > 0 ? list : [bookmark];
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

    private findImportInput(): HTMLInputElement | null {
        return this.hostHandle?.surfaceRoot.querySelector<HTMLInputElement>('[data-role="import-file"]') ?? null;
    }

    private getResolvableBookmarks(): Bookmark[] {
        if (!this.snapshot) return [];

        const merged = new Map<string, Bookmark>();
        for (const bookmark of getAllBookmarks(this.snapshot.vm.folderTree)) {
            merged.set(bookmarkSelectionKey(bookmark), bookmark);
        }
        for (const bookmark of this.snapshot.vm.bookmarks) {
            if (!merged.has(bookmarkSelectionKey(bookmark))) {
                merged.set(bookmarkSelectionKey(bookmark), bookmark);
            }
        }
        return [...merged.values()];
    }

    private findBookmarkBySelectionKey(key?: string): Bookmark | null {
        if (!key || !this.snapshot) return null;
        return this.getResolvableBookmarks().find((bookmark) => bookmarkSelectionKey(bookmark) === key) ?? null;
    }

    private async createFolder(): Promise<void> {
        const path = await this.promptDialog('info', 'Create folder', 'New folder path', '');
        if (!path?.trim()) return;
        const res = await this.controller.createFolder(path);
        this.controller.setPanelStatus(res.ok ? 'Folder created.' : res.message);
        if (!res.ok) {
            await this.alertDialog('error', 'Create folder', res.message);
        }
    }

    private async createSubfolder(parentPath: string): Promise<void> {
        const name = await this.promptDialog('info', 'Create subfolder', 'Subfolder name', '');
        if (!name?.trim()) return;
        const res = await this.controller.createFolder(`${parentPath}/${name}`);
        this.controller.setPanelStatus(res.ok ? 'Folder created.' : res.message);
        if (!res.ok) {
            await this.alertDialog('error', 'Create subfolder', res.message);
            return;
        }
        this.controller.toggleFolderExpanded(parentPath);
    }

    private async renameFolder(path: string): Promise<void> {
        const name = await this.promptDialog('info', 'Rename folder', 'New folder name', '');
        if (!name?.trim()) return;
        const res = await this.controller.renameFolder(path, name);
        this.controller.setPanelStatus(res.ok ? 'Folder renamed.' : res.message);
        if (!res.ok) {
            await this.alertDialog('error', 'Rename folder', res.message);
        }
    }

    private async moveFolder(path: string): Promise<void> {
        const parent = await this.pickFolder({
            title: 'Move folder',
            currentFolderPath: PathUtils.getParentPath(path),
        });
        if (parent === null) return;
        const res = await this.controller.moveFolder(path, parent);
        this.controller.setPanelStatus(res.ok ? 'Folder moved.' : res.message);
        if (!res.ok) {
            await this.alertDialog('error', 'Move folder', res.message);
        }
    }

    private async deleteFolder(path: string): Promise<void> {
        if (!await this.confirmDialog('warning', 'Delete folder', `Delete folder "${path}"?`, true)) return;
        const res = await this.controller.deleteFolder(path);
        this.controller.setPanelStatus(res.ok ? 'Folder deleted.' : res.message);
        if (!res.ok) {
            await this.alertDialog('error', 'Delete folder', res.message);
        }
    }

    private async exportAll(): Promise<void> {
        const result = await this.controller.exportAll(true);
        if (result.ok) {
            downloadJson('ai-markdone-bookmarks.json', result.data.payload);
        }
    }

    private async exportSelected(): Promise<void> {
        const result = await this.controller.exportSelected(true);
        if (result.ok) {
            downloadJson('ai-markdone-bookmarks-selected.json', result.data.payload);
        }
    }

    private async batchMove(): Promise<void> {
        const target = await this.pickFolder({
            title: 'Move selected bookmarks',
            currentFolderPath: this.controller.getDefaultFolderPath(),
        });
        if (target === null) return;
        const res = await this.controller.batchMove(target);
        this.controller.setPanelStatus(res.ok ? 'Bookmarks moved.' : res.message);
        if (!res.ok) {
            await this.alertDialog('error', 'Move selected bookmarks', res.message);
        }
    }

    private async batchDelete(): Promise<void> {
        if (!await this.confirmDialog('warning', 'Delete selected bookmarks', 'Delete selected bookmarks?', true)) return;
        const res = await this.controller.batchDelete();
        this.controller.setPanelStatus(res.ok ? 'Bookmarks deleted.' : res.message);
        if (!res.ok) {
            await this.alertDialog('error', 'Delete selected bookmarks', res.message);
        }
    }

    private async moveBookmark(bookmark: Bookmark): Promise<void> {
        const target = await this.pickFolder({
            title: 'Move bookmark',
            currentFolderPath: bookmark.folderPath || this.controller.getDefaultFolderPath(),
        });
        if (target === null) return;
        const res = await this.controller.moveBookmark(bookmark, target);
        this.controller.setPanelStatus(res.ok ? 'Bookmark moved.' : res.message);
        if (!res.ok) {
            await this.alertDialog('error', 'Move bookmark', res.message);
        }
    }

    private async importFromFile(input: HTMLInputElement): Promise<void> {
        const file = input.files?.[0] ?? null;
        input.value = '';
        if (!file) return;
        const jsonText = await file.text();
        const res = await this.controller.importJsonText(jsonText, this.uiState.settings.behavior.saveContextOnly);
        if (!res.ok) {
            await this.alertDialog('error', 'Import bookmarks', res.message);
            return;
        }
        this.controller.setPanelStatus('Bookmarks imported.');
        await this.showImportMergeSummary(res.data);
    }

    private async promptDialog(kind: 'info' | 'warning' | 'error', title: string, message: string, defaultValue = ''): Promise<string | null> {
        if (!this.modalHost) {
            return window.prompt(message, defaultValue);
        }
        return this.modalHost.prompt({
            kind,
            title,
            message,
            defaultValue,
            confirmText: 'Confirm',
            cancelText: 'Cancel',
        });
    }

    private async confirmDialog(
        kind: 'info' | 'warning' | 'error',
        title: string,
        message: string,
        danger = false,
        confirmText?: string,
    ): Promise<boolean> {
        if (!this.modalHost) {
            return window.confirm(message);
        }
        return this.modalHost.confirm({
            kind,
            title,
            message,
            danger,
            confirmText: confirmText ?? (danger ? 'Delete' : 'Confirm'),
            cancelText: 'Cancel',
        });
    }

    private async alertDialog(kind: 'info' | 'warning' | 'error', title: string, message: string): Promise<void> {
        if (!this.modalHost) {
            window.alert(message);
            return;
        }
        await this.modalHost.alert({
            kind,
            title,
            message,
            confirmText: 'OK',
        });
    }

    private async pickFolder(params: { title: string; currentFolderPath: string | null }): Promise<string | null> {
        const result = await bookmarkSaveDialog.open({
            theme: this.controller.getTheme(),
            userPrompt: '',
            existingTitle: '',
            currentFolderPath: params.currentFolderPath,
            mode: 'folder-select',
        });
        if (!result.ok) return null;
        return result.folderPath;
    }

    private async showImportMergeSummary(result: {
        imported?: number;
        skippedDuplicates?: number;
        renamed?: number;
        warnings?: string[];
        folderCreateFailures?: number;
    }): Promise<void> {
        if (!this.modalHost) return;

        const body = document.createElement('div');
        const summarySection = document.createElement('section');
        summarySection.className = 'merge-section merge-section--summary';
        const summaryHeading = document.createElement('div');
        summaryHeading.className = 'merge-section__heading';
        summaryHeading.textContent = 'Summary';
        const summary = document.createElement('div');
        summary.className = 'merge-summary';

        const items = [
            { label: 'Imported', value: String(result.imported ?? 0) },
            { label: 'Skipped duplicates', value: String(result.skippedDuplicates ?? 0) },
            { label: 'Renamed titles', value: String(result.renamed ?? 0) },
            { label: 'Folder fallbacks', value: String(result.folderCreateFailures ?? 0) },
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
        detailHeading.textContent = 'Details';
        const entries = document.createElement('div');
        entries.className = 'merge-entry-list';
        const warningMessages = Array.isArray(result.warnings) ? result.warnings : [];
        const rows = [
            { title: 'Imported bookmarks', detail: `${result.imported ?? 0} bookmarks were added or updated.`, status: 'import' },
            { title: 'Duplicate bookmarks', detail: `${result.skippedDuplicates ?? 0} duplicates were skipped.`, status: 'duplicate' },
            { title: 'Renamed titles', detail: `${result.renamed ?? 0} titles were renamed to avoid conflicts.`, status: 'rename' },
            ...warningMessages.map((warning) => ({ title: 'Warning', detail: warning, status: 'normal' as const })),
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
            status.textContent = row.status === 'import' ? 'Imported'
                : row.status === 'duplicate' ? 'Duplicate'
                    : row.status === 'rename' ? 'Renamed'
                        : 'Info';
            top.append(title, status);
            const detail = document.createElement('p');
            detail.textContent = row.detail;
            article.append(top, detail);
            entries.appendChild(article);
        }

        detailSection.append(detailHeading, entries);
        body.appendChild(detailSection);

        await this.modalHost.showCustom({
            kind: warningMessages.length > 0 || (result.folderCreateFailures ?? 0) > 0 ? 'warning' : 'info',
            title: 'Import merge review',
            body,
        });
    }
}
