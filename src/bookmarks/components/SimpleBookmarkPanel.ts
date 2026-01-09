import { SimpleBookmarkStorage } from '../storage/SimpleBookmarkStorage';
import { Bookmark, Folder, FolderTreeNode } from '../storage/types';
import { logger } from '../../utils/logger';
import { FolderStorage } from '../storage/FolderStorage';
import { FolderState } from '../state/FolderState';
import { FolderOperationsManager } from '../managers/FolderOperationsManager';
import { TreeBuilder } from '../utils/tree-builder';
import { PathUtils, type FolderNameValidationError } from '../utils/path-utils';
import { Icons } from '../../assets/icons';
// ✅ Phase 7: 迁移到核心renderer

import { ThemeManager } from '../../utils/ThemeManager';
import { DesignTokens } from '../../utils/design-tokens';  // T2.1.1: Import DesignTokens class
import { ReaderPanel } from '../../content/features/re-render';
import { fromBookmarks, findBookmarkIndex } from '../datasource/BookmarkDataSource';
import { DialogManager } from '../../components/DialogManager';

type ImportMergeStatus = 'normal' | 'rename' | 'import' | 'duplicate';

type ImportMergeEntry = {
    bookmark: Bookmark;
    status: ImportMergeStatus;
    renameTo?: string;
    existingTitle?: string;  // Used for duplicate status to show title comparison
    existingFolderPath?: string;  // Used for duplicate status to show folder path
};



/**
 * Simple Bookmark Panel - AITimeline Pattern with Tabs
 * Displays bookmarks in a flex-based list with sidebar tabs
 */
export class SimpleBookmarkPanel {
    private overlay: HTMLElement | null = null;
    private shadowRoot: ShadowRoot | null = null;
    private bookmarks: Bookmark[] = [];
    private filteredBookmarks: Bookmark[] = [];
    private searchQuery: string = '';
    private platformFilter: string = '';
    private storageListener: ((changes: any, areaName: string) => void) | null = null;

    // Event listener management (AbortController pattern - Web standard)
    private abortController: AbortController | null = null;

    // State preservation (industry standard pattern)
    private savedState = {
        scrollTop: 0,
        expandedPaths: new Set<string>(),
        searchQuery: '',
        platformFilter: '',
        currentTab: 'bookmarks' as const
    };

    // Selection state for batch operations (Gmail-style)
    private selectedItems: Set<string> = new Set(); // Keys: "folder:path" or "url:position"

    // Folder tree properties
    private folders: Folder[] = [];
    private folderState: FolderState = new FolderState();
    private folderOpsManager: FolderOperationsManager = new FolderOperationsManager();

    // Theme manager subscription for dynamic theme switching
    private themeUnsubscribe: (() => void) | null = null;

    // ReaderPanel 实例（用于书签预览）
    private readerPanel: ReaderPanel = new ReaderPanel();

    /**
     * Show the bookmark panel
     */
    async show(): Promise<void> {
        // Create AbortController for this panel instance (Web standard pattern)
        this.abortController = new AbortController();

        // The provided snippet for `show` seems to be from a different context or an incomplete replacement.
        // To maintain syntactical correctness and fulfill the request of adding a migration method,
        // I will assume the user wants to integrate the migration logic into the *existing* show method
        // and then add the `migrateLegacyBookmarks` method after it.

        // Original show method logic:
        if (this.overlay) {
            this.overlay.style.display = 'flex';
            await this.refresh(); // Assuming refresh() exists and updates content
            return;
        }

        // Run migration before loading bookmarks
        const migratedCount = await this.migrateLegacyBookmarks();

        // Load all bookmarks and folders
        this.bookmarks = await SimpleBookmarkStorage.getAllBookmarks();
        this.folders = await FolderStorage.getAll();
        this.filteredBookmarks = [...this.bookmarks]; // Re-filter after migration and load
        logger.info(`[SimpleBookmarkPanel] Loaded ${this.bookmarks.length} bookmarks, ${this.folders.length} folders`);

        // Create overlay
        this.overlay = document.createElement('div');
        this.overlay.className = 'simple-bookmark-panel-overlay';

        // CRITICAL: Set z-index on the overlay element itself (not in Shadow DOM)
        // This ensures it appears above all page content
        this.overlay.style.position = 'fixed';
        this.overlay.style.top = '0';
        this.overlay.style.left = '0';
        this.overlay.style.right = '0';
        this.overlay.style.bottom = '0';
        this.overlay.style.zIndex = 'var(--aimd-z-panel)'; // Panel layer
        this.overlay.style.display = 'flex';
        this.overlay.style.alignItems = 'center';
        this.overlay.style.justifyContent = 'center';
        // ✅ 根据用户反馈,恢复轻微背景模糊
        this.overlay.style.background = 'var(--aimd-bg-overlay-heavy)';
        this.overlay.style.backdropFilter = 'var(--aimd-overlay-backdrop)';
        this.overlay.dataset.theme = ThemeManager.getInstance().isDarkMode() ? 'dark' : 'light';

        this.shadowRoot = this.overlay.attachShadow({ mode: 'open' });

        // Add styles
        const styles = document.createElement('style');
        styles.textContent = this.getStyles();
        this.shadowRoot.appendChild(styles);

        // Create panel
        const panel = this.createPanel();
        this.shadowRoot.appendChild(panel);



        // CRITICAL: Add overlay click handler BEFORE appending to body
        // This ensures it's set up correctly and only once
        // Use signal for automatic cleanup (Web standard pattern)
        this.overlay.addEventListener('click', (e) => {
            // Only close if clicking directly on overlay (not on panel or its children)
            if (e.target === this.overlay) {
                this.hide();
            }
        }, { signal: this.abortController.signal });

        document.body.appendChild(this.overlay);

        // Setup storage listener for real-time updates
        this.setupStorageListener();

        // Bind event listeners
        this.bindEventListeners();

        // Show migration notification if bookmarks were migrated
        if (migratedCount > 0) {
            setTimeout(() => {
                this.showNotification({
                    type: 'success',
                    title: 'Migration Complete',
                    message: `Migrated ${migratedCount} bookmark${migratedCount > 1 ? 's' : ''} to "Import" folder`
                });
            }, 100);
        }

        // Restore saved state (industry standard pattern)
        this.restoreState();

        // Setup theme observer for dynamic theme switching
        this.setupThemeObserver();
    }

    /**
     * Migrate legacy bookmarks without folderPath to "Import" folder
     * Per PRD Section 9.2
     */
    private async migrateLegacyBookmarks(): Promise<number> {
        try {
            const bookmarks = await SimpleBookmarkStorage.getAllBookmarks();
            const needsMigration = bookmarks.filter(b => !b.folderPath);

            if (needsMigration.length === 0) {
                return 0;
            }

            logger.info(`[Migration] Found ${needsMigration.length} bookmarks without folderPath`);

            // Create Import folder if not exists
            const folders = await FolderStorage.getAll();
            if (!folders.find(f => f.path === 'Import')) {
                await FolderStorage.create('Import');
                logger.info('[Migration] Created "Import" folder');
            }

            // Update bookmarks
            for (const bookmark of needsMigration) {
                bookmark.folderPath = 'Import';
                await SimpleBookmarkStorage.updateBookmark(
                    bookmark.urlWithoutProtocol,
                    bookmark.position,
                    bookmark
                );
            }

            logger.info(`[Migration] Migrated ${needsMigration.length} bookmarks to "Import"`);
            return needsMigration.length;
        } catch (error) {
            logger.error('[Migration] Failed:', error);
            return 0;
        }
    }

    /**
     * Hide the bookmark panel
     */
    hide(): void {
        // 1. Save state before cleanup (industry standard pattern)
        this.saveState();

        // 2. Abort all event listeners (one line - Web standard!)
        this.abortController?.abort();
        this.abortController = null;

        // 3. Remove storage listener
        if (this.storageListener) {
            chrome.storage.onChanged.removeListener(this.storageListener);
            this.storageListener = null;
        }

        // 4. Unsubscribe from theme manager
        if (this.themeUnsubscribe) {
            this.themeUnsubscribe();
            this.themeUnsubscribe = null;
            logger.debug('[SimpleBookmarkPanel] Theme subscription cancelled');
        }

        // 5. Remove DOM
        if (this.overlay && this.overlay.parentNode) {
            this.overlay.remove();
        }

        // 6. Clear references
        this.overlay = null;
        this.shadowRoot = null;

        logger.info('[SimpleBookmarkPanel] Panel cleaned up');
    }

    /**
     * Save current state for restoration (industry standard pattern)
     */
    private saveState(): void {
        if (!this.shadowRoot) return;

        const content = this.shadowRoot.querySelector('.bookmarks-tab .content');
        this.savedState = {
            scrollTop: content?.scrollTop || 0,
            expandedPaths: new Set(this.folderState.getExpandedPaths()),
            searchQuery: this.searchQuery,
            platformFilter: this.platformFilter,
            currentTab: 'bookmarks' // Currently only one tab
        };

        logger.debug('[SimpleBookmarkPanel] State saved:', {
            scrollTop: this.savedState.scrollTop,
            expandedCount: this.savedState.expandedPaths.size,
            searchQuery: this.savedState.searchQuery
        });
    }

    /**
     * Restore saved state (industry standard pattern)
     */
    private restoreState(): void {
        if (!this.shadowRoot) return;

        // Restore search query
        this.searchQuery = this.savedState.searchQuery;
        const searchInput = this.shadowRoot.querySelector('.search-input') as HTMLInputElement;
        if (searchInput) {
            searchInput.value = this.searchQuery;
        }

        // Restore platform filter
        this.platformFilter = this.savedState.platformFilter;

        // Restore expanded folders
        this.savedState.expandedPaths.forEach(path => {
            this.folderState.expand(path);
        });

        // Re-render with restored state
        this.refreshContent();

        // Restore scroll position (after render)
        requestAnimationFrame(() => {
            const content = this.shadowRoot?.querySelector('.bookmarks-tab .content');
            if (content) {
                content.scrollTop = this.savedState.scrollTop;
            }
        });

        logger.debug('[SimpleBookmarkPanel] State restored');
    }

    /**
     * Toggle panel visibility
     */
    async toggle(): Promise<void> {
        if (this.overlay && this.overlay.style.display !== 'none') {
            this.hide();
        } else {
            await this.show();
        }
    }

    /**
     * Create panel structure with sidebar tabs
     */
    private createPanel(): HTMLElement {
        const panel = document.createElement('div');
        panel.className = 'panel';

        // Stop propagation on panel to prevent clicks inside from closing overlay
        panel.addEventListener('click', (e) => {
            e.stopPropagation();
        });

        panel.innerHTML = `
            <div class="sidebar">
                <button class="tab-btn active" data-tab="bookmarks">
                    <span class="tab-icon">${Icons.bookmark}</span>
                    <span class="tab-label">Bookmarks</span>
                </button>
                <button class="tab-btn" data-tab="settings">
                    <span class="tab-icon">${Icons.settings}</span>
                    <span class="tab-label">Settings</span>
                </button>
                <button class="tab-btn" data-tab="support">
                    <span class="tab-icon">${Icons.coffee}</span>
                    <span class="tab-label">Support on GitHub</span>
                </button>
            </div>

            <div class="main">
                <div class="header">
                    <h2>${Icons.bookmark} Bookmarks (${this.bookmarks.length})</h2>
                    <button class="close-btn" aria-label="Close">×</button>
                </div>

                <div class="tab-content bookmarks-tab active">
                    <div class="toolbar">
                        <div class="search-wrapper">
                            <span class="search-icon">${Icons.search}</span>
                            <input type="text" class="search-input" placeholder="Search...">
                        </div>
                        <div class="platform-selector-wrapper">
                            <button class="platform-selector" data-selected="all">
                                <span class="platform-selector-icon">${Icons.chevronDown}</span>
                            </button>
                            <div class="platform-dropdown" style="display: none;">
                                <div class="platform-option" data-value="" data-platform="all">
                                    ${Icons.grid}
                                    <span class="platform-option-label">All Platforms</span>
                                </div>
                                <div class="platform-option" data-value="ChatGPT" data-platform="chatgpt">
                                    <span class="platform-option-icon">${Icons.chatgpt}</span>
                                    <span class="platform-option-label">ChatGPT</span>
                                </div>
                                <div class="platform-option" data-value="Gemini" data-platform="gemini">
                                    <span class="platform-option-icon">${Icons.gemini}</span>
                                    <span class="platform-option-label">Gemini</span>
                                </div>
                            </div>
                        </div>
                        <button class="toolbar-icon-btn new-folder-btn" title="Create new folder" aria-label="Create new folder">${Icons.folderPlus}</button>
                        <div class="toolbar-divider"></div>
                        <button class="toolbar-icon-btn import-btn" title="Import bookmarks" aria-label="Import bookmarks">${Icons.upload}</button>
                        <button class="toolbar-icon-btn export-btn" title="Export bookmarks" aria-label="Export bookmarks">${Icons.download}</button>
                    </div>
                    <div class="content">
                        ${this.renderTreeView()}
                    </div>
                    
                    <!-- Batch Actions Bar (Gmail-style floating) -->
                    <div class="batch-actions-bar">
                        <span class="selected-count">0 selected</span>
                        <button class="batch-delete-btn" title="Delete selected items">${Icons.trash} <span>Delete</span></button>
                        <button class="batch-move-btn" title="Move selected items">${Icons.folder} <span>Move To</span></button>
                        <button class="batch-export-btn" title="Export selected items">${Icons.download} <span>Export</span></button>
                        <button class="batch-clear-btn" title="Clear selection">${Icons.x} <span>Clear</span></button>
                    </div>
                </div>

                <div class="tab-content settings-tab">
                    <div class="settings-content">
                        <h3>Settings</h3>
                        <p>Settings panel coming soon...</p>
                    </div>
                </div>

                <div class="tab-content support-tab">
                    <div class="support-content">
                        <h3>${Icons.coffee} Support on GitHub</h3>
                        <p>If this extension helps you, please support it on GitHub.</p>
                        <a href="https://github.com/zhaoliangbin42/AI-MarkDone" target="_blank" rel="noopener noreferrer" class="support-btn">
                            Open GitHub
                        </a>
                    </div>
                </div>
            </div>
        `;

        return panel;
    }

    /**
     * Render tree view with folders and bookmarks
     * Reference: VS Code Explorer rendering
     */
    private renderTreeView(): string {
        // Get hierarchical structure from TreeBuilder
        const tree = TreeBuilder.buildTree(
            this.folders,
            this.filteredBookmarks,
            this.folderState.getExpandedPaths(),
            this.folderState.getSelectedPath()
        );

        if (tree.length === 0) {
            return this.renderEmptyState();
        }

        return `
            <div class="tree-view" role="tree">
                ${tree.map(node => this.renderTreeNode(node, 0)).join('')}
            </div>
        `;
    }

    /**
     * Render single tree node (folder or bookmark)
     */
    private renderTreeNode(node: FolderTreeNode, depth: number): string {
        // Folders render with children
        if (node.folder) {
            return this.renderFolderItem(node, depth);
        }
        return '';
    }

    /**
     * Render folder item with expand/collapse (VSCode-style)
     * Children are always rendered, CSS controls visibility
     */
    private renderFolderItem(node: FolderTreeNode, depth: number): string {
        const folder = node.folder;
        const icon = node.isExpanded ? Icons.folderOpen : Icons.folder;
        const indent = 10 + depth * 28; // 20px per level (Linear spacing)
        // Show + button if folder can have subfolders (depth < MAX_DEPTH - 1)
        const showAddSubfolder = depth < PathUtils.MAX_DEPTH - 1;
        const selectedClass = node.isSelected ? 'selected' : '';
        const expandedClass = node.isExpanded ? 'expanded' : '';

        let html = `
            <div class="tree-item folder-item ${selectedClass} ${expandedClass}"
                 data-path="${this.escapeAttr(folder.path)}"
                 data-depth="${depth}"
                 style="padding-left: ${indent}px"
                 role="treeitem"
                 aria-expanded="${node.isExpanded}"
                 aria-level="${depth + 1}"
                 tabindex="0">
                <span class="folder-toggle ${node.isExpanded ? 'expanded' : ''}" aria-label="Toggle folder">▶</span>
                <input type="checkbox" 
                       class="item-checkbox folder-checkbox" 
                       data-path="${this.escapeAttr(folder.path)}"
                       aria-label="Select ${folder.name} and all children">
                <span class="folder-icon">${icon}</span>
                <span class="folder-name">${this.escapeHtml(folder.name)} <span class="folder-count">(${TreeBuilder.getTotalBookmarkCount(node)})</span></span>
                <div class="item-actions">
                    ${showAddSubfolder ? `<button class="action-btn add-subfolder" data-path="${this.escapeAttr(folder.path)}" data-depth="${depth}" title="New Subfolder" aria-label="Create subfolder">${Icons.plus}</button>` : ''}
                    <button class="action-btn rename-folder" title="Rename" aria-label="Rename folder">${Icons.edit}</button>
                    <button class="action-btn delete-folder" title="Delete" aria-label="Delete folder">${Icons.trash}</button>
                </div>
            </div>
        `;

        // Always render children container (CSS will hide if collapsed)
        if (node.children.length > 0 || node.bookmarks.length > 0) {
            html += `<div class="folder-children" data-parent="${this.escapeAttr(folder.path)}">`;

            // Render child folders
            for (const child of node.children) {
                html += this.renderTreeNode(child, depth + 1);
            }

            // Render bookmarks in this folder
            for (const bookmark of node.bookmarks) {
                html += this.renderBookmarkItemInTree(bookmark, depth + 1);
            }

            html += '</div>';
        }

        return html;
    }

    /**
     * Render bookmark item in tree
     * Reference: Notion list items, Linear task items
     */
    private renderBookmarkItemInTree(bookmark: Bookmark, depth: number): string {
        const icon = bookmark.platform === 'ChatGPT' ? Icons.chatgpt : Icons.gemini;
        const indent = 3 + depth * 28;
        const timestamp = this.formatTimestamp(bookmark.timestamp);
        const key = `${bookmark.urlWithoutProtocol}:${bookmark.position}`;
        const checked = this.selectedItems.has(key) ? 'checked' : '';

        return `
            <div class="tree-item bookmark-item"
                 data-url="${this.escapeAttr(bookmark.url)}"
                 data-position="${bookmark.position}"
                 data-depth="${depth}"
                 style="padding-left: ${indent}px"
                 role="treeitem"
                 aria-level="${depth + 1}"
                 tabindex="0">
                <input type="checkbox" 
                       class="item-checkbox bookmark-checkbox" 
                       data-key="${this.escapeAttr(key)}"
                       ${checked}
                       aria-label="Select ${bookmark.title}">
                <span class="platform-icon">${icon}</span>
                <span class="bookmark-title">${this.escapeHtml(bookmark.title)}</span>
                <span class="bookmark-timestamp">${timestamp}</span>
                <div class="item-actions">
                    <button class="action-btn open-conversation" title="Open in Conversation" aria-label="Open conversation">${Icons.link}</button>
                    <button class="action-btn edit-bookmark" title="Edit" aria-label="Edit bookmark">${Icons.edit}</button>
                    <button class="action-btn delete-bookmark" title="Delete" aria-label="Delete bookmark">${Icons.trash}</button>
                </div>
            </div>
        `;
    }

    /**
     * Render empty state when no folders exist
     * Reference: GitHub empty repository state
     */
    private renderEmptyState(): string {
        return `
            <div class="tree-empty">
                <div class="empty-icon">${Icons.folder}</div>
                <h3>No folders yet</h3>
                <p>Create your first folder to organize bookmarks</p>
                <button class="btn-primary create-first-folder">
                    ${Icons.plus} Create First Folder
                </button>
            </div>
        `;
    }

    /**
     * Escape HTML attribute value
     */
    private escapeAttr(text: string): string {
        return text.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }



    /**
     * Format timestamp to relative time
     */
    private formatTimestamp(timestamp: number): string {
        const now = Date.now();
        const diff = now - timestamp;

        const seconds = Math.floor(diff / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);

        if (days > 7) {
            return new Date(timestamp).toLocaleDateString();
        } else if (days > 0) {
            return `${days}d`;
        } else if (hours > 0) {
            return `${hours}h`;
        } else if (minutes > 0) {
            return `${minutes}m`;
        } else {
            return 'now';
        }
    }

    /**
     * Filter bookmarks based on search and platform
     */
    private filterBookmarks(): void {
        this.filteredBookmarks = this.bookmarks.filter(b => {
            // Platform filter
            if (this.platformFilter && b.platform !== this.platformFilter) {
                return false;
            }

            // Search filter
            if (this.searchQuery) {
                const query = this.searchQuery.toLowerCase();
                const matchesTitle = b.title?.toLowerCase().includes(query);
                const matchesMessage = b.userMessage.toLowerCase().includes(query);
                const matchesResponse = b.aiResponse?.toLowerCase().includes(query);

                return matchesTitle || matchesMessage || matchesResponse;
            }

            return true;
        });
    }

    /**
     * Refresh panel content
     */
    async refresh(): Promise<void> {
        const refreshStart = performance.now();

        // Reload both folders and bookmarks
        this.folders = await FolderStorage.getAll();
        const foldersTime = performance.now();

        this.bookmarks = await SimpleBookmarkStorage.getAllBookmarks();
        const bookmarksTime = performance.now();

        this.filterBookmarks();
        logger.info(`[SimpleBookmarkPanel][Perf] Refresh: ${this.folders.length} folders (${(foldersTime - refreshStart).toFixed(0)}ms), ${this.bookmarks.length} bookmarks (${(bookmarksTime - foldersTime).toFixed(0)}ms), total ${(bookmarksTime - refreshStart).toFixed(0)}ms`);

        this.refreshContent();
    }

    /**
     * Refresh only the content area
     */
    private refreshContent(): void {
        if (this.shadowRoot) {
            const content = this.shadowRoot.querySelector('.bookmarks-tab .content');
            if (content) {
                content.innerHTML = this.renderTreeView();
                this.bindTreeEventListeners();
            }

            const header = this.shadowRoot.querySelector('h2');
            if (header) {
                header.innerHTML = `${Icons.bookmark} Bookmarks (${this.bookmarks.length})`;
            }

            // Update batch actions bar state
            this.updateBatchActionsBar();
        }
    }

    /**
     * Bind event listeners to buttons
     */
    private bindEventListeners(): void {
        // Get signal from AbortController for automatic cleanup (Web standard pattern)
        const signal = this.abortController?.signal;

        // Close button
        this.shadowRoot?.querySelector('.close-btn')?.addEventListener('click', () => this.hide(), { signal });

        // Tab buttons
        this.shadowRoot?.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const tab = btn.getAttribute('data-tab');
                if (tab) this.switchTab(tab as any);
            }, { signal });
        });

        // Search input
        const searchInput = this.shadowRoot?.querySelector('.search-input') as HTMLInputElement;
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this.searchQuery = (e.target as HTMLInputElement).value;
                this.filterBookmarks();
                this.refreshContent();
            }, { signal });
        }

        // 自定义平台选择器
        const platformSelectorWrapper = this.shadowRoot?.querySelector('.platform-selector-wrapper');
        const platformSelector = this.shadowRoot?.querySelector('.platform-selector') as HTMLButtonElement;
        const platformDropdown = this.shadowRoot?.querySelector('.platform-dropdown') as HTMLElement;

        if (platformSelector && platformDropdown && platformSelectorWrapper) {
            // 点击按钮切换下拉菜单
            platformSelector.addEventListener('click', (e) => {
                e.stopPropagation();
                const isOpen = platformSelectorWrapper.classList.contains('open');

                if (isOpen) {
                    platformSelectorWrapper.classList.remove('open');
                    platformDropdown.style.display = 'none';
                } else {
                    platformSelectorWrapper.classList.add('open');
                    platformDropdown.style.display = 'block';
                }
            });

            // 选择选项
            const options = platformDropdown.querySelectorAll('.platform-option');
            options.forEach((option) => {
                option.addEventListener('click', () => {
                    const value = option.getAttribute('data-value') || '';
                    const platform = option.getAttribute('data-platform') || 'all';
                    const label = option.querySelector('.platform-option-label')?.textContent || 'All Platforms';
                    const iconEl = option.querySelector('.platform-option-icon');

                    // 更新选中状态
                    this.platformFilter = value;

                    // 更新按钮显示
                    const selectorLabel = platformSelector.querySelector('.platform-selector-label');
                    if (selectorLabel) {
                        selectorLabel.textContent = label;
                    }

                    // 更新按钮图标
                    // 先移除旧的平台图标（不包括chevron图标）
                    const oldIcons = platformSelector.querySelectorAll('span:not(.platform-selector-label):not(.platform-selector-icon)');
                    oldIcons.forEach(icon => icon.remove());

                    // 如果不是"All Platforms"，添加新图标
                    if (platform !== 'all' && iconEl && selectorLabel) {
                        const iconClone = iconEl.cloneNode(true) as HTMLElement;
                        platformSelector.insertBefore(iconClone, selectorLabel);
                    } else if (platform === 'all' && selectorLabel) {
                        // 如果是All Platforms，添加grid图标
                        const gridSpan = document.createElement('span');
                        gridSpan.innerHTML = option.querySelector('span:first-child')?.innerHTML || '';
                        platformSelector.insertBefore(gridSpan, selectorLabel);
                    }

                    // 更新按钮背景色
                    platformSelector.setAttribute('data-selected', platform);

                    // 更新选项选中状态
                    options.forEach(opt => opt.setAttribute('data-selected', 'false'));
                    option.setAttribute('data-selected', 'true');

                    // 关闭下拉菜单
                    platformSelectorWrapper.classList.remove('open');
                    platformDropdown.style.display = 'none';

                    // 触发筛选
                    this.filterBookmarks();
                    this.refreshContent();
                });
            });

            // 初始化：根据当前platformFilter设置正确的选中状态和按钮显示
            const currentPlatform = this.platformFilter || '';

            options.forEach(opt => {
                const optValue = opt.getAttribute('data-value') || '';
                opt.setAttribute('data-selected', optValue === currentPlatform ? 'true' : 'false');
            });

            // 查找选中的选项
            const selectedOption = Array.from(options).find(opt =>
                (opt.getAttribute('data-value') || '') === currentPlatform
            );

            // 初始化按钮显示：设置正确的图标和文字
            if (selectedOption) {
                const platform = selectedOption.getAttribute('data-platform') || 'all';
                const label = selectedOption.querySelector('.platform-option-label')?.textContent || 'All Platforms';
                const iconEl = selectedOption.querySelector('.platform-option-icon');

                const selectorLabel = platformSelector.querySelector('.platform-selector-label');
                if (!selectorLabel) {
                    // 创建label元素
                    const newLabel = document.createElement('span');
                    newLabel.className = 'platform-selector-label';
                    newLabel.textContent = label;
                    const chevron = platformSelector.querySelector('.platform-selector-icon');
                    platformSelector.insertBefore(newLabel, chevron);
                } else {
                    selectorLabel.textContent = label;
                }

                // 添加对应的图标
                if (platform !== 'all' && iconEl) {
                    const iconClone = iconEl.cloneNode(true) as HTMLElement;
                    const selectorLabel2 = platformSelector.querySelector('.platform-selector-label');
                    platformSelector.insertBefore(iconClone, selectorLabel2);
                } else if (platform === 'all') {
                    const gridSpan = document.createElement('span');
                    gridSpan.innerHTML = Icons.grid;
                    const selectorLabel2 = platformSelector.querySelector('.platform-selector-label');
                    platformSelector.insertBefore(gridSpan, selectorLabel2);
                }

                platformSelector.setAttribute('data-selected', platform);
            }

            // 点击 panel 内任意位置关闭下拉菜单
            const panelContainer = this.shadowRoot?.querySelector('.bookmarks-tab');
            if (panelContainer) {
                panelContainer.addEventListener('click', (e) => {
                    // 如果点击的不是选择器本身，则关闭下拉菜单
                    if (!platformSelectorWrapper.contains(e.target as Node)) {
                        platformSelectorWrapper.classList.remove('open');
                        platformDropdown.style.display = 'none';
                    }
                });
            }
        }

        // Export button
        this.shadowRoot?.querySelector('.export-btn')?.addEventListener('click', () => {
            this.handleExport();
        });

        // Import button
        this.shadowRoot?.querySelector('.import-btn')?.addEventListener('click', () => {
            this.handleImport();
        });

        // Batch action listeners
        this.shadowRoot?.querySelector('.select-all-checkbox')?.addEventListener('change', (e) => {
            const checked = (e.target as HTMLInputElement).checked;
            this.handleSelectAllClick(checked);
        });

        this.shadowRoot?.querySelector('.batch-delete-btn')?.addEventListener('click', () => {
            this.handleBatchDelete();
        });

        this.shadowRoot?.querySelector('.batch-move-btn')?.addEventListener('click', () => {
            this.handleBatchMove();
        });

        this.shadowRoot?.querySelector('.batch-export-btn')?.addEventListener('click', () => {
            this.handleBatchExport();
        });

        this.shadowRoot?.querySelector('.batch-clear-btn')?.addEventListener('click', () => {
            this.clearSelection();
        });


        // New Folder button
        this.shadowRoot?.querySelector('.new-folder-btn')?.addEventListener('click', () => {
            this.showCreateFolderInput(null);
        });

        // Bookmark list listeners
        this.bindBookmarkListeners();

        // Bind tree view listeners
        this.bindTreeEventListeners();

        // Setup keyboard navigation for tree
        this.setupTreeKeyboardNavigation();
    }

    /**
     * Bind listeners for bookmark list items
     * NOTE: This function is NOT currently used - events are bound in bindTreeEventListeners()
     */
    private bindBookmarkListeners(): void {
        // Preview buttons (NOT USED - kept for reference)
        this.shadowRoot?.querySelectorAll('.preview-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const url = btn.getAttribute('data-url');
                const position = parseInt(btn.getAttribute('data-position') || '0');
                if (url && position) {
                    // DO NOT CALL - causes duplicate modals
                    // this.showDetailModal(url, position);
                }
            });
        });

        // Edit buttons
        this.shadowRoot?.querySelectorAll('.edit-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const url = btn.getAttribute('data-url');
                const position = parseInt(btn.getAttribute('data-position') || '0');
                if (url && position) {
                    this.handleEdit(url, position);
                }
            });
        });

        // Delete buttons
        this.shadowRoot?.querySelectorAll('.delete-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const url = btn.getAttribute('data-url');
                const position = parseInt(btn.getAttribute('data-position') || '0');
                if (url && position) {
                    await this.handleDelete(url, position);
                }
            });
        });

        // Row click opens preview (NOT USED - duplicate, see bindTreeEventListeners)
        // DO NOT UNCOMMENT - causes duplicate event handlers
        // this.shadowRoot?.querySelectorAll('.bookmark-item').forEach(item => {
        //     item.addEventListener('click', (e) => {
        //         const target = e.target as HTMLElement;
        //         if (target.classList.contains('bookmark-checkbox') ||
        //             target.closest('.item-actions') ||
        //             target.classList.contains('action-btn')) {
        //             return;
        //         }
        //         const url = item.getAttribute('data-url');
        //         const position = parseInt(item.getAttribute('data-position') || '0');
        //         if (url && position) {
        //             this.showDetailModal(url, position);
        //         }
        //     });
        // });

        // Checkbox change
        this.shadowRoot?.querySelectorAll('.bookmark-checkbox').forEach(checkbox => {
            checkbox.addEventListener('change', (e) => {
                const target = e.target as HTMLInputElement;
                const key = target.getAttribute('data-key');
                if (!key) return;

                if (target.checked) {
                    this.selectedItems.add(key);
                } else {
                    this.selectedItems.delete(key);
                }

                this.updateBatchActionsBar();
            });
        });
    }

    /**
     * Bind event listeners for tree interactions
     * Reference: VS Code Explorer event handling
     */
    private bindTreeEventListeners(): void {
        // Folder expand/collapse
        this.shadowRoot?.querySelectorAll('.folder-item').forEach(item => {
            item.addEventListener('click', (e) => {
                const target = e.target as HTMLElement;
                // Don't toggle if clicking checkbox, action buttons, or inline edit controls
                if (target.classList.contains('item-checkbox') ||
                    target.closest('.item-actions') ||
                    target.closest('.inline-edit-wrapper')) {
                    return;
                }

                const path = (item as HTMLElement).dataset.path!;
                this.toggleFolder(path);
            });
        });

        // Folder checkboxes - Gmail-style selection (VSCode-style incremental update)
        this.shadowRoot?.querySelectorAll('.folder-checkbox').forEach(checkbox => {
            checkbox.addEventListener('change', (e) => {
                e.stopPropagation();
                const path = (e.target as HTMLInputElement).dataset.path!;
                const checked = (e.target as HTMLInputElement).checked;
                const key = `folder:${path}`;

                if (checked) {
                    this.selectItem(key);
                } else {
                    this.deselectItem(key);
                }

                // Incremental update - no full re-render
                this.updateAffectedCheckboxes(key);
                this.updateBatchActionsBar();
            });
        });

        // Bookmark checkboxes - Gmail-style selection (VSCode-style incremental update)
        this.shadowRoot?.querySelectorAll('.bookmark-checkbox').forEach(checkbox => {
            checkbox.addEventListener('change', (e) => {
                e.stopPropagation();
                const key = (e.target as HTMLInputElement).dataset.key!;
                const checked = (e.target as HTMLInputElement).checked;

                if (checked) {
                    this.selectItem(key);
                } else {
                    this.deselectItem(key);
                }

                // Incremental update - no full re-render
                this.updateAffectedCheckboxes(key);
                this.updateBatchActionsBar();
            });
        });

        // Folder toggle (expand/collapse)
        this.shadowRoot?.querySelectorAll('.folder-toggle').forEach(toggle => {
            toggle.addEventListener('click', (e) => {
                e.stopPropagation();
                const folderItem = (e.target as HTMLElement).closest('.folder-item')!;
                const path = (folderItem as HTMLElement).dataset.path!;
                this.folderState.toggleExpand(path);
                this.refreshTreeView();
            });
        });

        // Add subfolder buttons
        this.shadowRoot?.querySelectorAll('.add-subfolder').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const path = (btn as HTMLElement).dataset.path!;
                const depth = parseInt((btn as HTMLElement).dataset.depth || '0');

                // Check depth limit (max 4 levels, so depth 4 is the max for adding subfolders)
                if (depth >= PathUtils.MAX_DEPTH) {
                    this.showNotification({
                        type: 'error',
                        title: 'Maximum Depth Exceeded',
                        message: `Cannot create subfolder: Maximum folder depth is ${PathUtils.MAX_DEPTH} levels.\n\nPlease create a new root folder or organize within existing folders.`
                    });
                    return;
                }

                this.showCreateFolderInput(path);
            });
        });

        // Rename folder
        this.shadowRoot?.querySelectorAll('.rename-folder').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const folderItem = (e.target as HTMLElement).closest('.folder-item')!;
                const path = (folderItem as HTMLElement).dataset.path!;
                this.showRenameFolderInput(path);
            });
        });

        // Delete folder
        this.shadowRoot?.querySelectorAll('.delete-folder').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const folderItem = (e.target as HTMLElement).closest('.folder-item')!;
                const path = (folderItem as HTMLElement).dataset.path!;
                await this.handleDeleteFolder(path);
            });
        });

        // Preview bookmark
        this.shadowRoot?.querySelectorAll('.open-conversation').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const bookmarkItem = (e.target as HTMLElement).closest('.bookmark-item')!;
                const url = (bookmarkItem as HTMLElement).dataset.url!;
                const position = parseInt((bookmarkItem as HTMLElement).dataset.position!);
                await this.handleGoTo(url, position);
            });
        });

        // Edit bookmark
        this.shadowRoot?.querySelectorAll('.edit-bookmark').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const bookmarkItem = (e.target as HTMLElement).closest('.bookmark-item')!;
                const url = (bookmarkItem as HTMLElement).dataset.url!;
                const position = parseInt((bookmarkItem as HTMLElement).dataset.position!);
                this.handleEdit(url, position);
            });
        });

        // Delete bookmark
        this.shadowRoot?.querySelectorAll('.delete-bookmark').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const bookmarkItem = (e.target as HTMLElement).closest('.bookmark-item')!;
                const url = (bookmarkItem as HTMLElement).dataset.url!;
                const position = parseInt((bookmarkItem as HTMLElement).dataset.position!);
                await this.handleDelete(url, position);
            });
        });

        // Bookmark row click opens preview
        this.shadowRoot?.querySelectorAll('.bookmark-item').forEach(item => {
            item.addEventListener('click', (e) => {
                // Don't open preview if clicking checkbox or action buttons
                const target = e.target as HTMLElement;
                if (target.classList.contains('item-checkbox') ||
                    target.classList.contains('bookmark-checkbox') ||
                    target.closest('.item-actions') ||
                    target.classList.contains('action-btn')) {
                    return;
                }

                if (target.classList.contains('open-conversation')) {
                    const url = (item as HTMLElement).querySelector('.bookmark-title')?.getAttribute('href') || '';
                    window.open(url, '_blank');
                } else if (target.classList.contains('edit-bookmark')) {
                    const url = (item as HTMLElement).dataset.url!;
                    const position = parseInt((item as HTMLElement).dataset.position!);
                    // ✅ Phase 8: 使用 ReaderPanel 打开预览
                    const bookmark = this.filteredBookmarks.find(
                        b => b.url === url && b.position === position
                    );
                    if (bookmark) {
                        this.openPreview(bookmark);
                    }
                } else {
                    const url = (item as HTMLElement).dataset.url!;
                    const position = parseInt((item as HTMLElement).dataset.position!);
                    if (url && position) {
                        // ✅ Phase 8: 使用 ReaderPanel 打开预览
                        const bookmark = this.filteredBookmarks.find(
                            b => b.url === url && b.position === position
                        );
                        if (bookmark) {
                            this.openPreview(bookmark);
                        }
                    }
                }
            });
        });

        // Empty state - create first folder
        this.shadowRoot?.querySelector('.create-first-folder')?.addEventListener('click', () => {
            this.showCreateFolderInput(null);
        });
    }

    /**
     * Toggle folder expand/collapse (VSCode-style - no re-render)
     */
    private async toggleFolder(path: string): Promise<void> {
        // 1. Update state
        this.folderState.toggleExpand(path);
        this.folderState.setSelectedPath(path);
        await this.folderState.saveLastSelected(path);

        // 2. Get new state
        const isExpanded = this.folderState.isExpanded(path);

        // 3. Update DOM (no re-render!)
        // First, remove 'selected' class from all folder items
        this.shadowRoot?.querySelectorAll('.folder-item.selected').forEach(item => {
            item.classList.remove('selected');
        });

        const folderElement = this.shadowRoot?.querySelector(
            `.folder-item[data-path="${path}"]`
        );

        if (folderElement) {
            // Add selected class to current folder
            folderElement.classList.add('selected');

            // Update aria-expanded attribute
            folderElement.setAttribute('aria-expanded', String(isExpanded));

            // Update folder icon
            const icon = folderElement.querySelector('.folder-icon');
            if (icon) {
                icon.innerHTML = isExpanded ? Icons.folderOpen : Icons.folder;
            }

            // Update toggle button
            const toggle = folderElement.querySelector('.folder-toggle');
            if (toggle) {
                if (isExpanded) {
                    toggle.classList.add('expanded');
                } else {
                    toggle.classList.remove('expanded');
                }
            }

            // Toggle expanded class on folder item
            if (isExpanded) {
                folderElement.classList.add('expanded');
            } else {
                folderElement.classList.remove('expanded');
            }
        }
    }

    /**
     * Select item and all descendants (Gmail-style)
     * When selecting a folder, all children are automatically selected
     */
    private selectItem(key: string): void {
        // 1. Add item itself
        this.selectedItems.add(key);

        // 2. If it's a folder, add all descendants
        if (key.startsWith('folder:')) {
            const path = key.replace('folder:', '');
            const descendants = this.getAllDescendants(path);
            descendants.forEach(d => this.selectedItems.add(d));
        }

        // 3. Update parent selection (upward sync)
        this.updateParentSelection(key);
    }

    /**
     * Deselect item and all descendants (Gmail-style)
     * When deselecting a folder, all children are automatically deselected
     */
    private deselectItem(key: string): void {
        // 1. Remove item itself
        this.selectedItems.delete(key);

        // 2. If it's a folder, remove all descendants
        if (key.startsWith('folder:')) {
            const path = key.replace('folder:', '');
            const descendants = this.getAllDescendants(path);
            descendants.forEach(d => this.selectedItems.delete(d));
        }

        // 3. Update parent selection (upward sync)
        this.updateParentSelection(key);
    }

    /**
     * Get all descendant keys (folders and bookmarks) for a folder path
     * Used for Gmail-style selection
     */
    private getAllDescendants(path: string): string[] {
        const keys: string[] = [];

        // Add all subfolders
        this.folders
            .filter(f => f.path.startsWith(path + '/'))
            .forEach(f => keys.push(`folder:${f.path}`));

        // Add all bookmarks in this folder and subfolders
        this.bookmarks
            .filter(b => b.folderPath === path || b.folderPath?.startsWith(path + '/'))
            .forEach(b => keys.push(`${b.urlWithoutProtocol}:${b.position}`));

        return keys;
    }

    /**
     * Get parent folder path
     * T2.4: Helper method
     */
    private getParentPath(path: string): string | null {
        const lastSlash = path.lastIndexOf('/');
        if (lastSlash === -1) return null; // Root level folder
        return path.substring(0, lastSlash);
    }

    /**
     * Update parent folder selection based on children (Gmail-style upward sync)
     * Automatically selects parent when all children are selected
     */
    private updateParentSelection(childKey: string): void {
        // Get parent path from child key
        let parentPath: string | null = null;

        if (childKey.startsWith('folder:')) {
            parentPath = this.getParentPath(childKey.replace('folder:', ''));
        } else {
            // It's a bookmark, find its folder
            const bookmark = this.bookmarks.find(b =>
                `${b.urlWithoutProtocol}:${b.position}` === childKey
            );
            if (bookmark && bookmark.folderPath) {
                parentPath = bookmark.folderPath;
            }
        }

        if (!parentPath) return;

        const parentKey = `folder:${parentPath}`;
        const siblings = this.getAllDescendants(parentPath);

        // Check if all siblings are selected
        const allSelected = siblings.length > 0 && siblings.every(s => this.selectedItems.has(s));
        const noneSelected = siblings.every(s => !this.selectedItems.has(s));

        if (allSelected) {
            // All children selected → auto-select parent
            this.selectedItems.add(parentKey);
        } else if (noneSelected) {
            // No children selected → deselect parent
            this.selectedItems.delete(parentKey);
        } else {
            // Some children selected → parent indeterminate (not in selectedItems)
            this.selectedItems.delete(parentKey);
        }

        // Recursively update grandparent
        this.updateParentSelection(parentKey);
    }

    /**
     * Update affected checkboxes incrementally (VSCode-style)
     * Only updates checkboxes that changed, no full re-render
     */
    private updateAffectedCheckboxes(changedKey: string): void {
        // Update the changed item's checkbox
        this.updateSingleCheckbox(changedKey);

        // If it's a folder, update all descendant checkboxes
        if (changedKey.startsWith('folder:')) {
            const path = changedKey.replace('folder:', '');
            const descendants = this.getAllDescendants(path);
            descendants.forEach(descendantKey => {
                this.updateSingleCheckbox(descendantKey);
            });
        }

        // Update parent folder checkboxes (for indeterminate state)
        this.updateParentCheckboxes(changedKey);
    }

    /**
     * Update a single checkbox element
     */
    private updateSingleCheckbox(key: string): void {
        let checkbox: HTMLInputElement | null = null;

        if (key.startsWith('folder:')) {
            const path = key.replace('folder:', '');
            checkbox = this.shadowRoot?.querySelector(
                `.folder-checkbox[data-path="${path}"]`
            ) as HTMLInputElement;
        } else {
            checkbox = this.shadowRoot?.querySelector(
                `.bookmark-checkbox[data-key="${key}"]`
            ) as HTMLInputElement;
        }

        if (!checkbox) return;

        // Update checkbox state
        if (key.startsWith('folder:')) {
            const path = key.replace('folder:', '');
            // Check if folder itself is selected
            if (this.selectedItems.has(key)) {
                checkbox.checked = true;
                checkbox.indeterminate = false;
            } else {
                // Check if any descendants are selected (indeterminate)
                const descendants = this.getAllDescendants(path);
                const anySelected = descendants.some(d => this.selectedItems.has(d));

                if (anySelected) {
                    checkbox.checked = false;
                    checkbox.indeterminate = true;
                } else {
                    checkbox.checked = false;
                    checkbox.indeterminate = false;
                }
            }
        } else {
            // Bookmark checkbox
            checkbox.checked = this.selectedItems.has(key);
        }
    }

    /**
     * Update parent folder checkboxes recursively
     */
    private updateParentCheckboxes(childKey: string): void {
        let parentPath: string | null = null;

        if (childKey.startsWith('folder:')) {
            parentPath = this.getParentPath(childKey.replace('folder:', ''));
        } else {
            // It's a bookmark, find its folder
            const bookmark = this.bookmarks.find(b =>
                `${b.urlWithoutProtocol}:${b.position}` === childKey
            );
            if (bookmark && bookmark.folderPath) {
                parentPath = bookmark.folderPath;
            }
        }

        if (!parentPath) return;

        const parentKey = `folder:${parentPath}`;
        this.updateSingleCheckbox(parentKey);

        // Recursively update grandparent
        this.updateParentCheckboxes(parentKey);
    }

    /**
     * Setup keyboard navigation
     * Reference: ARIA tree view pattern
     */
    private setupTreeKeyboardNavigation(): void {
        this.shadowRoot?.addEventListener('keydown', (e) => {
            const evt = e as KeyboardEvent;
            const target = e.target as HTMLElement;
            if (!target.classList.contains('tree-item')) return;

            switch (evt.key) {
                case 'ArrowDown':
                    evt.preventDefault();
                    this.focusNextTreeItem(target);
                    break;
                case 'ArrowUp':
                    evt.preventDefault();
                    this.focusPreviousTreeItem(target);
                    break;
                case 'ArrowRight':
                    evt.preventDefault();
                    if (target.classList.contains('folder-item')) {
                        const path = target.dataset.path!;
                        this.expandFolder(path);
                    }
                    break;
                case 'ArrowLeft':
                    evt.preventDefault();
                    if (target.classList.contains('folder-item')) {
                        const path = target.dataset.path!;
                        this.collapseFolder(path);
                    }
                    break;
                case 'Enter':
                case ' ':
                    evt.preventDefault();
                    target.click();
                    break;
            }
        });
    }

    private focusNextTreeItem(current: HTMLElement): void {
        const items = Array.from(this.shadowRoot?.querySelectorAll('.tree-item') || []);
        const currentIndex = items.indexOf(current);
        if (currentIndex < items.length - 1) {
            (items[currentIndex + 1] as HTMLElement).focus();
        }
    }

    private focusPreviousTreeItem(current: HTMLElement): void {
        const items = Array.from(this.shadowRoot?.querySelectorAll('.tree-item') || []);
        const currentIndex = items.indexOf(current);
        if (currentIndex > 0) {
            (items[currentIndex - 1] as HTMLElement).focus();
        }
    }

    /**
     * Expand folder (VSCode-style - no re-render)
     */
    private async expandFolder(path: string): Promise<void> {
        if (!this.folderState.isExpanded(path)) {
            // 1. Update state
            this.folderState.toggleExpand(path);

            // 2. Update DOM (no re-render!)
            const folderElement = this.shadowRoot?.querySelector(
                `.folder-item[data-path="${path}"]`
            );

            if (folderElement) {
                // Update aria-expanded attribute
                folderElement.setAttribute('aria-expanded', 'true');

                // Update folder icon (📁 → 📂)
                const icon = folderElement.querySelector('.folder-icon');
                if (icon) {
                    icon.textContent = '📂';
                }

                // Add expanded class
                folderElement.classList.add('expanded');
            }
        }
    }

    /**
     * Collapse folder (VSCode-style - no re-render)
     */
    private async collapseFolder(path: string): Promise<void> {
        if (this.folderState.isExpanded(path)) {
            // 1. Update state
            this.folderState.toggleExpand(path);

            // 2. Update DOM (no re-render!)
            const folderElement = this.shadowRoot?.querySelector(
                `.folder-item[data-path="${path}"]`
            );

            if (folderElement) {
                // Update aria-expanded attribute
                folderElement.setAttribute('aria-expanded', 'false');

                // Update folder icon (📂 → 📁)
                const icon = folderElement.querySelector('.folder-icon');
                if (icon) {
                    icon.innerHTML = Icons.folder;
                }

                // Remove expanded class
                folderElement.classList.remove('expanded');
            }
        }
    }

    /**
     * Refresh tree view (re-render)
     */
    private refreshTreeView(): void {
        const content = this.shadowRoot?.querySelector('.bookmarks-tab .content');
        if (content) {
            content.innerHTML = this.renderTreeView();
            this.bindTreeEventListeners();
            this.applyCheckboxStates(); // T2.5: Apply checkbox states after rendering
        }
    }

    /**
     * Apply checkbox states to DOM elements (Gmail-style)
     * Directly checks selectedItems for accurate state
     */
    private applyCheckboxStates(): void {
        // Apply folder checkbox states
        this.shadowRoot?.querySelectorAll('.folder-checkbox').forEach(checkbox => {
            const path = (checkbox as HTMLInputElement).dataset.path!;
            const folderKey = `folder:${path}`;
            const input = checkbox as HTMLInputElement;

            // Check if folder itself is selected
            if (this.selectedItems.has(folderKey)) {
                input.checked = true;
                input.indeterminate = false;
            } else {
                // Check if any descendants are selected (indeterminate)
                const descendants = this.getAllDescendants(path);
                const anySelected = descendants.some(d => this.selectedItems.has(d));

                if (anySelected) {
                    input.checked = false;
                    input.indeterminate = true;
                } else {
                    input.checked = false;
                    input.indeterminate = false;
                }
            }
        });

        // Apply bookmark checkbox states
        this.shadowRoot?.querySelectorAll('.bookmark-checkbox').forEach(checkbox => {
            const key = (checkbox as HTMLInputElement).dataset.key!;
            (checkbox as HTMLInputElement).checked = this.selectedItems.has(key);
        });
    }

    /**
     * Show inline input for creating new folder
     * Task 2.1.1
     */
    private async showCreateFolderInput(parentPath: string | null): Promise<void> {
        const name = await DialogManager.prompt({
            title: parentPath ? 'New Subfolder' : 'New Folder',
            message: parentPath ? `Creating subfolder in: ${parentPath}` : undefined,
            placeholder: 'Enter folder name',
            validation: (value) => {
                const validation = PathUtils.getFolderNameValidation(value);
                if (!validation.isValid) {
                    return {
                        valid: false,
                        error: this.getFolderNameErrorMessage(validation.errors)
                    };
                }
                return { valid: true };
            }
        });

        if (!name) return;

        // Re-validate to get normalized name
        const validation = PathUtils.getFolderNameValidation(name);
        if (!validation.isValid) return; // Should not happen due to dialog validation

        this.handleCreateFolder(parentPath, validation.normalized);
    }

    private getFolderNameErrorMessage(errors: FolderNameValidationError[]): string {
        if (errors.includes('empty')) {
            return 'Folder name cannot be empty.';
        }
        if (errors.includes('tooLong')) {
            return `Folder name must be ${PathUtils.MAX_NAME_LENGTH} characters or less.`;
        }
        if (errors.includes('traversal')) {
            return 'Folder name cannot contain "..".';
        }
        if (errors.includes('forbiddenChars')) {
            return 'Folder name contains invalid characters.';
        }
        return 'Invalid folder name.';
    }

    private async handleCreateFolder(parentPath: string | null, name: string): Promise<void> {
        // Calculate the new folder's path and depth
        const newPath = parentPath ? `${parentPath}/${name}` : name;
        const newDepth = PathUtils.getDepth(newPath);

        // Check depth limit BEFORE calling folderOpsManager
        if (newDepth > PathUtils.MAX_DEPTH) {
            await this.showNotification({
                type: 'error',
                title: 'Maximum Depth Exceeded',
                message: `Cannot create folder: Maximum folder depth is ${PathUtils.MAX_DEPTH} levels.\n\nCurrent path would be: ${newPath}\nDepth: ${newDepth}\n\nPlease create a new root folder or organize within existing folders.`
            });
            logger.warn(`[Folder] Create blocked: depth ${newDepth} exceeds limit (${PathUtils.MAX_DEPTH}) for path: ${newPath}`);
            return;
        }

        const result = await this.folderOpsManager.createFolder(parentPath || '', name);

        if (result.success) {
            this.folders = await FolderStorage.getAll();

            // Keep parent folder expanded (don't toggle if already expanded)
            if (parentPath && !this.folderState.isExpanded(parentPath)) {
                this.folderState.toggleExpand(parentPath);
            }

            await this.refreshTreeView();
            logger.info(`[Folder] Created successfully`);
        } else {
            await this.showNotification({
                type: 'error',
                title: 'Failed to Create Folder',
                message: `Failed to create folder: ${result.error}`
            });
            logger.error(`[Folder] Create failed:`, result.error);
        }
    }

    /**
     * Show inline editing for folder rename
     * Reference: VS Code inline rename
     */
    private showRenameFolderInput(path: string): void {
        const folder = this.folders.find(f => f.path === path);
        if (!folder) return;

        if (this.shadowRoot?.querySelector('.inline-edit-input')) {
            return;
        }

        // Find the folder item in DOM
        const folderItems = this.shadowRoot?.querySelectorAll('.folder-item');
        if (!folderItems) return;

        const items = Array.from(folderItems);
        const targetItem = items.find(item =>
            (item as HTMLElement).dataset.path === path
        );

        if (!targetItem) return;

        // Get the folder name span
        const nameSpan = targetItem.querySelector('.folder-name') as HTMLElement;
        if (!nameSpan) return;

        const originalName = folder.name;
        const parentPath = PathUtils.getParentPath(path);
        const siblingNames = this.folders
            .filter(f => f.path !== path && PathUtils.getParentPath(f.path) === parentPath)
            .map(f => f.name);

        type InputNormalization = {
            collapsedSpaces: boolean;
            removedSlash: boolean;
        };

        const normalizeInputValue = (value: string): { value: string; normalization: InputNormalization } => {
            let nextValue = typeof value === 'string' ? value : '';
            const removedSlash = nextValue.includes(PathUtils.SEPARATOR);
            if (removedSlash) {
                nextValue = nextValue.replace(/\//g, '');
            }

            const collapsed = nextValue.replace(/ {2,}/g, ' ');
            const collapsedSpaces = collapsed !== nextValue;
            nextValue = collapsed;

            return {
                value: nextValue,
                normalization: { collapsedSpaces, removedSlash }
            };
        };

        const normalizeCommitValue = (value: string): string => {
            const collapsed = value.replace(/ {2,}/g, ' ');
            return collapsed.replace(/^ +| +$/g, '');
        };

        const normalizedOriginal = normalizeCommitValue(originalName);

        const describeTarget = (target: EventTarget | null): string => {
            if (!target) return 'null';
            if (target instanceof HTMLElement) {
                const className = typeof target.className === 'string' ? target.className.trim() : '';
                const classSuffix = className ? `.${className.replace(/\s+/g, '.')}` : '';
                return `${target.tagName.toLowerCase()}${classSuffix}`;
            }
            return Object.prototype.toString.call(target);
        };

        const logRename = (label: string, data?: Record<string, unknown>) => {
            logger.info(`[Rename] ${label}`, {
                path,
                parentPath: parentPath || '',
                ...data
            });
        };

        logRename('start', {
            originalName,
            normalizedOriginal,
            siblingCount: siblingNames.length
        });

        const wrapper = document.createElement('div');
        wrapper.className = 'inline-edit-wrapper';

        const row = document.createElement('div');
        row.className = 'inline-edit-row';

        // Create input element
        const input = document.createElement('input');
        input.type = 'text';
        input.value = originalName;
        input.className = 'inline-edit-input';
        input.setAttribute('aria-label', 'Rename folder');

        const actions = document.createElement('div');
        actions.className = 'inline-edit-actions';

        const confirmBtn = document.createElement('button');
        confirmBtn.type = 'button';
        confirmBtn.className = 'inline-edit-btn inline-edit-confirm';
        confirmBtn.title = 'Confirm rename';
        confirmBtn.setAttribute('aria-label', 'Confirm rename');
        confirmBtn.innerHTML = Icons.check;

        const cancelBtn = document.createElement('button');
        cancelBtn.type = 'button';
        cancelBtn.className = 'inline-edit-btn inline-edit-cancel';
        cancelBtn.title = 'Cancel rename';
        cancelBtn.setAttribute('aria-label', 'Cancel rename');
        cancelBtn.innerHTML = Icons.x;

        const error = document.createElement('div');
        error.className = 'inline-edit-error';
        error.setAttribute('aria-live', 'polite');

        const suggestion = document.createElement('div');
        suggestion.className = 'inline-edit-suggestion';
        suggestion.setAttribute('aria-live', 'polite');

        const suggestionText = document.createElement('span');
        suggestionText.className = 'inline-edit-suggestion-text';
        suggestionText.textContent = '重命名为：';

        const suggestionValue = document.createElement('span');
        suggestionValue.className = 'inline-edit-suggestion-value';

        const autoRenameBtn = document.createElement('button');
        autoRenameBtn.type = 'button';
        autoRenameBtn.className = 'inline-edit-auto-rename';
        autoRenameBtn.textContent = '自动重命名';

        suggestion.appendChild(suggestionText);
        suggestion.appendChild(suggestionValue);
        suggestion.appendChild(autoRenameBtn);

        actions.appendChild(confirmBtn);
        actions.appendChild(cancelBtn);
        row.appendChild(input);
        row.appendChild(actions);
        wrapper.appendChild(row);
        wrapper.appendChild(error);
        wrapper.appendChild(suggestion);

        // Replace name span with input
        const parent = nameSpan.parentElement;
        if (!parent) return;

        parent.replaceChild(wrapper, nameSpan);
        const originalTabIndex = targetItem.getAttribute('tabindex');
        targetItem.classList.add('is-editing');
        targetItem.setAttribute('tabindex', '-1');
        targetItem.scrollIntoView({ block: 'nearest' });
        input.focus();
        input.select();

        let ignoreBlur = false;
        let lastPointerDownTarget: EventTarget | null = null;
        let lastPointerDownInside = true;
        let lastStableValue = originalName;
        let currentBlocking = false;
        let isSubmitting = false;
        lastPointerDownTarget = wrapper;

        const stopPropagation = (event: Event) => event.stopPropagation();
        wrapper.addEventListener('mousedown', stopPropagation);
        wrapper.addEventListener('click', stopPropagation);
        input.addEventListener('mousedown', stopPropagation);
        input.addEventListener('click', stopPropagation);
        actions.addEventListener('mousedown', stopPropagation);
        actions.addEventListener('click', stopPropagation);
        suggestion.addEventListener('mousedown', stopPropagation);
        suggestion.addEventListener('click', stopPropagation);

        const cleanup = () => {
            if (!parent.contains(wrapper)) return;
            parent.replaceChild(nameSpan, wrapper);
            targetItem.classList.remove('is-editing');
            if (originalTabIndex === null) {
                targetItem.removeAttribute('tabindex');
            } else {
                targetItem.setAttribute('tabindex', originalTabIndex);
            }
            document.removeEventListener('pointerdown', handlePointerDown, true);
            document.removeEventListener('focusin', handleFocusIn, true);
            document.removeEventListener('focusout', handleFocusOut, true);
            document.removeEventListener('keydown', handleGlobalKeydown, true);
            logRename('cleanup');
        };

        let autoRenameValue = '';

        const updateStatus = (
            normalization: InputNormalization,
            overrideMessage?: string,
            overrideBlocking = false
        ): void => {
            const commitValue = normalizeCommitValue(input.value);
            const validation = PathUtils.getFolderNameValidation(commitValue);
            const conflict = validation.isValid
                ? PathUtils.hasNameConflict(commitValue, siblingNames)
                : false;

            let message = '';
            let blocking = false;
            autoRenameValue = '';

            if (overrideMessage) {
                message = overrideMessage;
                blocking = overrideBlocking;
            } else if (!validation.isValid) {
                message = this.getFolderNameErrorMessage(validation.errors);
                blocking = true;
            } else if (conflict) {
                message = 'Folder name already exists.';
                blocking = true;
            } else if (normalization.removedSlash) {
                message = 'Folder name cannot contain "/".';
            } else if (normalization.collapsedSpaces) {
                message = 'Consecutive spaces were collapsed.';
            }

            currentBlocking = blocking;
            confirmBtn.disabled = blocking;
            input.classList.toggle('error', blocking);
            error.textContent = message;
            error.style.display = message ? 'block' : 'none';
            logRename('status', {
                value: input.value,
                blocking,
                message,
                collapsedSpaces: normalization.collapsedSpaces,
                removedSlash: normalization.removedSlash
            });

            if (!overrideMessage && validation.isValid && conflict) {
                try {
                    autoRenameValue = PathUtils.generateAutoRenameName(commitValue, siblingNames);
                } catch (err) {
                    logger.warn('[Folder] Auto-rename preview unavailable', err);
                }
            }

            if (autoRenameValue) {
                suggestionValue.textContent = autoRenameValue;
                suggestion.style.display = 'flex';
                autoRenameBtn.disabled = false;
            } else {
                suggestion.style.display = 'none';
                autoRenameBtn.disabled = true;
                suggestionValue.textContent = '';
            }
        };

        const applyNormalization = (): InputNormalization => {
            const { value: nextValue, normalization } = normalizeInputValue(input.value);
            const commitValue = normalizeCommitValue(nextValue);

            if (normalization.removedSlash) {
                input.value = lastStableValue;
                updateStatus(
                    normalization,
                    'Folder name cannot contain "/".',
                    true
                );
                logRename('normalize-revert-slash', {
                    attempted: nextValue,
                    revertedTo: lastStableValue
                });
                return normalization;
            }

            if (commitValue.length > PathUtils.MAX_NAME_LENGTH) {
                input.value = lastStableValue;
                updateStatus(
                    normalization,
                    `Folder name must be ${PathUtils.MAX_NAME_LENGTH} characters or less.`,
                    true
                );
                logRename('normalize-revert-too-long', {
                    attempted: nextValue,
                    revertedTo: lastStableValue
                });
                return normalization;
            }

            if (input.value !== nextValue) {
                input.value = nextValue;
                const cursor = nextValue.length;
                input.setSelectionRange(cursor, cursor);
                logRename('normalize-adjust', {
                    from: input.value,
                    to: nextValue
                });
            }

            lastStableValue = input.value;
            updateStatus(normalization);
            return normalization;
        };

        const commitEdit = async (): Promise<void> => {
            if (isSubmitting) {
                logRename('commit-skip-submitting');
                return;
            }
            const commitValue = normalizeCommitValue(input.value);
            const validation = PathUtils.getFolderNameValidation(commitValue);
            const conflict = validation.isValid
                ? PathUtils.hasNameConflict(commitValue, siblingNames)
                : false;

            if (!validation.isValid || conflict) {
                updateStatus({ collapsedSpaces: false, removedSlash: false });
                input.focus();
                input.select();
                logRename('commit-blocked', {
                    value: input.value,
                    normalized: commitValue,
                    errors: validation.errors,
                    conflict
                });
                return;
            }

            if (commitValue !== input.value) {
                input.value = commitValue;
            }

            if (commitValue === normalizedOriginal) {
                logRename('commit-no-change', { normalized: commitValue });
                cleanup();
                return;
            }

            isSubmitting = true;
            confirmBtn.disabled = true;
            logRename('commit-submit', {
                value: input.value,
                normalized: commitValue
            });
            const success = await this.handleRenameFolder(path, commitValue);
            if (!success) {
                isSubmitting = false;
                confirmBtn.disabled = false;
                input.focus();
                input.select();
                logRename('commit-failed');
            } else {
                logRename('commit-success');
            }
        };

        const cancelEdit = () => {
            logRename('cancel');
            cleanup();
        };

        const handlePointerDown = (event: PointerEvent) => {
            lastPointerDownTarget = event.target;
            const insideWrapper = event.composedPath().includes(wrapper);
            lastPointerDownInside = insideWrapper;
            logRename('pointerdown', {
                target: describeTarget(event.target),
                insideWrapper
            });
        };

        const handleFocusIn = (event: FocusEvent) => {
            logRename('focusin', {
                target: describeTarget(event.target),
                active: describeTarget(document.activeElement)
            });
        };

        const handleFocusOut = (event: FocusEvent) => {
            logRename('focusout', {
                target: describeTarget(event.target),
                active: describeTarget(document.activeElement)
            });
        };

        const handleGlobalKeydown = (event: KeyboardEvent) => {
            logRename('keydown-capture', {
                key: event.key,
                target: describeTarget(event.target),
                active: describeTarget(document.activeElement)
            });
        };

        document.addEventListener('pointerdown', handlePointerDown, true);
        document.addEventListener('focusin', handleFocusIn, true);
        document.addEventListener('focusout', handleFocusOut, true);
        document.addEventListener('keydown', handleGlobalKeydown, true);

        // Event listeners
        input.addEventListener('focus', () => {
            logRename('input-focus');
        });
        input.addEventListener('beforeinput', (event) => {
            const evt = event as InputEvent;
            logRename('beforeinput', {
                inputType: evt.inputType,
                data: evt.data
            });
        });
        input.addEventListener('input', (e) => {
            e.stopPropagation();
            applyNormalization();
            logRename('input', { value: input.value });
        });
        input.addEventListener('blur', () => {
            if (ignoreBlur) return;
            if (isSubmitting) return;
            if (!lastPointerDownTarget) {
                input.focus();
                logRename('blur-no-pointerdown');
                return;
            }
            const clickedOutside = !lastPointerDownInside;
            if (!clickedOutside) {
                input.focus();
                logRename('blur-inside-wrapper', {
                    target: describeTarget(lastPointerDownTarget)
                });
                return;
            }
            if (currentBlocking) {
                input.focus();
                logRename('blur-blocked', {
                    target: describeTarget(lastPointerDownTarget)
                });
                return;
            }
            logRename('blur-commit', {
                target: describeTarget(lastPointerDownTarget)
            });
            void commitEdit();
        });
        input.addEventListener('keydown', (e) => {
            e.stopPropagation();
            logRename('keydown', { key: e.key });
            if (e.key === 'Enter') {
                e.preventDefault();
                void commitEdit();
            } else if (e.key === 'Escape') {
                e.preventDefault();
                cancelEdit();
            }
        });

        confirmBtn.addEventListener('mousedown', (e) => {
            e.preventDefault();
            ignoreBlur = true;
        });
        confirmBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            logRename('confirm-click');
            await commitEdit();
            ignoreBlur = false;
        });

        cancelBtn.addEventListener('mousedown', (e) => {
            e.preventDefault();
            ignoreBlur = true;
        });
        cancelBtn.addEventListener('click', (e) => {
            e.preventDefault();
            cancelEdit();
            ignoreBlur = false;
        });

        autoRenameBtn.addEventListener('mousedown', (e) => {
            e.preventDefault();
            ignoreBlur = true;
        });
        autoRenameBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            if (!autoRenameValue) {
                ignoreBlur = false;
                return;
            }
            confirmBtn.disabled = true;
            autoRenameBtn.disabled = true;
            logRename('auto-rename', { value: autoRenameValue });
            const success = await this.handleRenameFolder(path, autoRenameValue);
            if (!success) {
                confirmBtn.disabled = false;
                autoRenameBtn.disabled = false;
                input.focus();
                input.select();
                logRename('auto-rename-failed');
            } else {
                logRename('auto-rename-success');
            }
            ignoreBlur = false;
        });

        const initialNormalization = normalizeInputValue(input.value);
        updateStatus(initialNormalization.normalization);
    }

    private async handleRenameFolder(path: string, newName: string): Promise<boolean> {
        const result = await this.folderOpsManager.renameFolder(path, newName);

        if (result.success) {
            this.folders = await FolderStorage.getAll();
            this.bookmarks = await SimpleBookmarkStorage.getAllBookmarks();

            await this.refreshTreeView();
            logger.info(`[Folder] Renamed: ${path} -> ${newName}`);
            return true;
        } else {
            await this.showNotification({
                type: 'error',
                title: 'Failed to Rename',
                message: `Failed to rename folder: ${result.error}`
            });
            logger.error(`[Folder] Rename failed:`, result.error);
        }
        return false;
    }

    private async handleDeleteFolder(path: string): Promise<void> {
        const analysis = this.buildFolderDeleteAnalysis(path);
        if (!analysis) return;

        const confirmed = await this.showBatchDeleteConfirmation(analysis);
        if (!confirmed) return;

        await this.executeBatchDelete(analysis);
        await this.refresh();
    }

    private buildFolderDeleteAnalysis(path: string): {
        folders: Folder[];
        subfolders: Folder[];
        bookmarks: Bookmark[];
    } | null {
        const target = this.folders.find(f => f.path === path);
        if (!target) return null;

        const descendantFolders = this.folders.filter(f => f.path.startsWith(path + '/'));
        const bookmarks = this.bookmarks.filter(b =>
            b.folderPath === path || b.folderPath?.startsWith(path + '/')
        );

        const folders: Folder[] = [];
        const subfolders: Folder[] = [];

        if (target.depth === 1) {
            folders.push(target);
        } else {
            subfolders.push(target);
        }

        descendantFolders.forEach(folder => subfolders.push(folder));

        return { folders, subfolders, bookmarks };
    }

    /**
     * Switch tab
     */
    private switchTab(tab: 'bookmarks' | 'settings' | 'support'): void {
        // Update tab buttons
        this.shadowRoot?.querySelectorAll('.tab-btn').forEach(btn => {
            if (btn.getAttribute('data-tab') === tab) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });

        // Update tab content
        this.shadowRoot?.querySelectorAll('.tab-content').forEach(content => {
            content.classList.remove('active');
        });

        const activeContent = this.shadowRoot?.querySelector(`.${tab}-tab`);
        if (activeContent) {
            activeContent.classList.add('active');
        }
    }

    /**
     * 使用 ReaderPanel 打开书签预览
     * Phase 8: 复用通用阅读器组件
     */
    private openPreview(bookmark: Bookmark): void {
        // 设置主题
        this.readerPanel.setTheme(ThemeManager.getInstance().isDarkMode());

        let targetList: Bookmark[] = [];

        // 构建 UI 树以获取正确的视觉顺序（排序由 TreeBuilder 统一控制）
        // 这样可以确保 Reader 的翻页顺序与用户在列表中看到的顺序完全一致
        const tree = TreeBuilder.buildTree(
            this.folders,
            this.filteredBookmarks // 包含搜索过滤
        );

        if (this.searchQuery) {
            // 搜索模式：使用当前视图中展示的所有书签（按视觉顺序）
            // TreeBuilder.getAllBookmarks 会按深度优先遍历返回排序后的书签
            targetList = TreeBuilder.getAllBookmarks(tree);
        } else {
            // 文件夹模式：只获取当前文件夹下的书签（按视觉顺序）
            const folderNode = TreeBuilder.findNode(tree, bookmark.folderPath);
            // 如果找到文件夹节点，直接使用其已排序的 bookmarks 列表
            if (folderNode) {
                targetList = folderNode.bookmarks;
            } else {
                // 回退逻辑（理论上不应触发）
                targetList = this.bookmarks.filter(b => b.folderPath === bookmark.folderPath);
            }
        }

        // 将目标列表转换为 ReaderItem[]
        const items = fromBookmarks(targetList);

        // 查找当前书签在目标列表中的索引
        const startIndex = findBookmarkIndex(bookmark, targetList);

        // 显示 ReaderPanel
        this.readerPanel.showWithData(items, startIndex);

        logger.info(`[SimpleBookmarkPanel] Opened preview for bookmark at index ${startIndex} (Scope: ${this.searchQuery ? 'Search' : 'Folder'})`);
    }



    /**
     * Handle edit
     */
    private handleEdit(url: string, position: number): void {
        const bookmark = this.filteredBookmarks.find(
            b => b.url === url && b.position === position
        );

        if (!bookmark) return;

        // Import BookmarkSaveModal dynamically
        import('./BookmarkSaveModal').then(({ BookmarkSaveModal }) => {
            const saveModal = new BookmarkSaveModal();
            saveModal.show({
                mode: 'edit',
                defaultTitle: bookmark.title,
                currentFolder: bookmark.folderPath,
                onSave: async (newTitle, newFolderPath) => {
                    // Update bookmark
                    await SimpleBookmarkStorage.updateBookmark(url, position, {
                        title: newTitle,
                        folderPath: newFolderPath
                    });

                    logger.info(`[SimpleBookmarkPanel] Updated bookmark: title="${newTitle}", folder="${newFolderPath}"`);

                    // Refresh panel
                    await this.refresh();
                }
            });
        });
    }

    /**
     * Handle delete
     */
    private async handleDelete(url: string, position: number): Promise<void> {
        const bookmark = this.filteredBookmarks.find(
            b => b.url === url && b.position === position
        );

        if (!bookmark) return;

        // Show confirmation dialog
        const confirmed = await DialogManager.confirm({
            title: 'Delete Bookmark',
            message: `Delete bookmark "${bookmark.title || bookmark.userMessage.substring(0, 50)}"?\n\nTip: You can export your bookmarks first to create a backup.`,
            confirmText: 'Delete',
            cancelText: 'Cancel',
            danger: true
        });

        if (!confirmed) return;

        try {
            await SimpleBookmarkStorage.remove(url, position);
            logger.info(`[SimpleBookmarkPanel] Deleted bookmark at position ${position}`);
            await this.refresh();
        } catch (error) {
            logger.error('[SimpleBookmarkPanel] Failed to delete bookmark:', error);
        }
    }


    /**
     * Handle batch delete
     */
    /**
     * Get all items (folders + bookmarks) for select-all
     * Task 3.2.1
     */
    private getAllItems(): string[] {
        const items: string[] = [];

        for (const folder of this.folders) {
            items.push(`folder:${folder.path}`);
        }

        for (const bookmark of this.bookmarks) {
            items.push(`${bookmark.urlWithoutProtocol}:${bookmark.position}`);
        }

        return items;
    }

    /**
     * Handle select-all checkbox click (smart mode)
     * Task 3.2.2
     */
    private handleSelectAllClick(checked: boolean): void {
        if (checked) {
            const isSearching = this.searchQuery.trim() !== '';
            if (isSearching) {
                this.selectAllVisible();
            } else {
                this.selectAllItems();
            }
        } else {
            this.clearSelection();
        }
    }

    /**
     * Select all items (folders + bookmarks)
     * Task 3.2.3
     */
    private selectAllItems(): void {
        for (const folder of this.folders) {
            this.selectedItems.add(`folder:${folder.path}`);
        }

        for (const bookmark of this.bookmarks) {
            this.selectedItems.add(`${bookmark.urlWithoutProtocol}:${bookmark.position}`);
        }

        this.updateBatchActionsBar();
        this.updateAllCheckboxes();
    }

    /**
     * Select all visible items (for search mode)
     * Task 3.2.4
     */
    private selectAllVisible(): void {
        for (const bookmark of this.filteredBookmarks) {
            this.selectedItems.add(`${bookmark.urlWithoutProtocol}:${bookmark.position}`);
        }

        this.updateBatchActionsBar();
        this.updateAllCheckboxes();
    }

    /**
     * Clear all selections
     * Task 3.2.5
     */
    private clearSelection(): void {
        this.selectedItems.clear();
        this.updateBatchActionsBar();
        this.updateAllCheckboxes();
    }

    /**
     * Update all checkboxes in the UI
     * Task 3.2.6
     */
    private updateAllCheckboxes(): void {
        this.shadowRoot?.querySelectorAll('.folder-checkbox').forEach(checkbox => {
            const path = (checkbox as HTMLElement).dataset.path;
            if (path) {
                const key = `folder:${path}`;
                (checkbox as HTMLInputElement).checked = this.selectedItems.has(key);
            }
        });

        this.shadowRoot?.querySelectorAll('.bookmark-checkbox').forEach(checkbox => {
            const key = (checkbox as HTMLElement).dataset.key;
            if (key) {
                (checkbox as HTMLInputElement).checked = this.selectedItems.has(key);
            }
        });
    }

    /**
     * Update batch actions bar visibility and state
     * Task 3.2.7 - Enhanced with CSS classes and checkbox states
     */
    private updateBatchActionsBar(): void {
        const bar = this.shadowRoot?.querySelector('.batch-actions-bar') as HTMLElement;
        const countSpan = this.shadowRoot?.querySelector('.batch-actions-bar .selected-count');
        const selectAllCheckbox = this.shadowRoot?.querySelector('.select-all-checkbox') as HTMLInputElement;

        if (!bar) return;

        const count = this.selectedItems.size;

        if (count > 0) {
            bar.classList.add('visible');

            if (countSpan) {
                // Count only bookmarks, not folders
                const bookmarkCount = this.getSelectedBookmarks().length;
                countSpan.textContent = `${bookmarkCount} bookmarks selected`;
            }

            if (selectAllCheckbox) {
                const allItems = this.getAllItems();
                if (count === allItems.length) {
                    selectAllCheckbox.checked = true;
                    selectAllCheckbox.indeterminate = false;
                } else {
                    selectAllCheckbox.checked = false;
                    selectAllCheckbox.indeterminate = true;
                }
            }
        } else {
            bar.classList.remove('visible');

            if (selectAllCheckbox) {
                selectAllCheckbox.checked = false;
                selectAllCheckbox.indeterminate = false;
            }
        }
    }

    /**
     * Find bookmark by key
     * Task 3.3.1
     */
    private findBookmarkByKey(key: string): Bookmark | null {
        const lastColonIndex = key.lastIndexOf(':');
        if (lastColonIndex === -1) return null;

        const urlWithoutProtocol = key.substring(0, lastColonIndex);
        const position = parseInt(key.substring(lastColonIndex + 1));

        return this.bookmarks.find(b =>
            b.urlWithoutProtocol === urlWithoutProtocol &&
            b.position === position
        ) || null;
    }

    /**
     * Get selected bookmarks (with recursive folder traversal)
     * Task 3.3.2
     */
    private getSelectedBookmarks(): Bookmark[] {
        const bookmarks: Bookmark[] = [];
        const seen = new Set<string>();

        for (const key of this.selectedItems) {
            if (key.startsWith('folder:')) {
                const path = key.substring(7);
                const folderBookmarks = this.bookmarks.filter(b =>
                    b.folderPath === path || b.folderPath?.startsWith(path + '/')
                );

                for (const bookmark of folderBookmarks) {
                    const bookmarkKey = `${bookmark.urlWithoutProtocol}:${bookmark.position}`;
                    if (!seen.has(bookmarkKey)) {
                        bookmarks.push(bookmark);
                        seen.add(bookmarkKey);
                    }
                }
            } else {
                const bookmark = this.findBookmarkByKey(key);
                if (bookmark && !seen.has(key)) {
                    bookmarks.push(bookmark);
                    seen.add(key);
                }
            }
        }

        return bookmarks;
    }

    /**
     * Handle batch export
     * Task 3.3.3
     */
    private async handleBatchExport(): Promise<void> {
        if (this.selectedItems.size === 0) {
            await this.showNotification({
                type: 'warning',
                title: 'No Items Selected',
                message: 'Please select items to export'
            });
            return;
        }

        const selectedBookmarks = this.getSelectedBookmarks();

        if (selectedBookmarks.length === 0) {
            await this.showNotification({
                type: 'warning',
                title: 'No Bookmarks Selected',
                message: 'No bookmarks selected'
            });
            return;
        }

        // Show export options dialog
        const preserveStructure = await this.showExportOptionsDialog();
        if (preserveStructure === null) return; // Cancelled

        // Prepare bookmarks for export
        const bookmarksToExport = preserveStructure
            ? selectedBookmarks
            : selectedBookmarks.map(b => ({ ...b, folderPath: null }));

        const exportData = {
            version: '2.0',
            exportDate: new Date().toISOString(),
            bookmarks: bookmarksToExport
        };

        const data = JSON.stringify(exportData, null, 2);
        const blob = new Blob([data], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `bookmarks-selected-${Date.now()}.json`;
        a.click();
        URL.revokeObjectURL(url);

        logger.info(`[Batch Export] Exported ${bookmarksToExport.length} bookmarks (structure: ${preserveStructure})`);
    }

    /**
     * Analyze selected items into categories
     * Task 3.4.1
     */
    private analyzeSelection(): {
        folders: Folder[];
        subfolders: Folder[];
        bookmarks: Bookmark[];
    } {
        const folders: Folder[] = [];
        const subfolders: Folder[] = [];
        const bookmarks: Bookmark[] = [];

        for (const key of this.selectedItems) {
            if (key.startsWith('folder:')) {
                const path = key.substring(7);
                const folder = this.folders.find(f => f.path === path);
                if (folder) {
                    if (folder.depth === 1) {
                        folders.push(folder);
                    } else {
                        subfolders.push(folder);
                    }
                }
            } else {
                const bookmark = this.findBookmarkByKey(key);
                if (bookmark) {
                    bookmarks.push(bookmark);
                }
            }
        }

        return { folders, subfolders, bookmarks };
    }

    /**
     * Show notification dialog in Shadow DOM
     * Replaces browser alert() with styled modal
     * 
     * @param options - Notification configuration
     */
    private async showNotification(options: {
        type: 'success' | 'error' | 'warning' | 'info';
        title?: string;
        message: string;
        duration?: number;  // Auto-dismiss after ms (optional)
    }): Promise<void> {
        return new Promise((resolve) => {
            const configs = {
                success: {
                    icon: Icons.checkCircle,
                    iconColor: 'var(--aimd-feedback-success-text)',
                    titleColor: 'var(--aimd-feedback-success-text)',
                    defaultTitle: 'Success'
                },
                error: {
                    icon: Icons.xCircle,
                    iconColor: 'var(--aimd-feedback-danger-text)',
                    titleColor: 'var(--aimd-feedback-danger-text)',
                    defaultTitle: 'Error'
                },
                warning: {
                    icon: Icons.alertTriangle,
                    iconColor: 'var(--aimd-feedback-warning-text)',
                    titleColor: 'var(--aimd-feedback-warning-text)',
                    defaultTitle: 'Warning'
                },
                info: {
                    icon: Icons.info,
                    iconColor: 'var(--aimd-feedback-info-text)',
                    titleColor: 'var(--aimd-feedback-info-text)',
                    defaultTitle: 'Information'
                }
            };

            const config = configs[options.type];
            const title = options.title || config.defaultTitle;

            const overlay = document.createElement('div');
            overlay.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: var(--aimd-bg-overlay-heavy) !important;
                z-index: var(--aimd-z-max);
                display: flex;
                align-items: center;
                justify-content: center;
                color-scheme: light dark;
            `;

            const modal = document.createElement('div');
            modal.style.cssText = `
                background: var(--aimd-bg-primary);
                color: var(--aimd-text-primary);
                border-radius: var(--aimd-radius-xl);
                box-shadow: var(--aimd-shadow-xl);
                max-width: 400px;
                width: 90%;
            `;

            modal.innerHTML = `
<div class="info-dialog-content">
    <div class="info-dialog-header">
        <span class="info-dialog-icon" style="color: ${config.iconColor};">${config.icon}</span>
        <h3 class="info-dialog-title" style="color: ${config.titleColor};">
            ${title}
        </h3>
    </div>
    <div class="info-dialog-message">
${options.message}
    </div>
</div>
<div class="info-dialog-footer">
    <button class="ok-btn">OK</button>
</div>
            `;

            overlay.appendChild(modal);

            if (this.shadowRoot) {
                this.shadowRoot.appendChild(overlay);
            }

            // CRITICAL: Stop propagation to prevent closing parent panel
            overlay.addEventListener('click', (e) => {
                e.stopPropagation();
                if (e.target === overlay) {
                    closeDialog();
                }
            });

            modal.addEventListener('click', (e) => {
                e.stopPropagation();
            });

            const okBtn = modal.querySelector('.ok-btn') as HTMLElement;

            okBtn.addEventListener('mouseenter', () => {
                okBtn.style.background = 'var(--aimd-button-primary-hover)';
            });
            okBtn.addEventListener('mouseleave', () => {
                okBtn.style.background = 'var(--aimd-button-primary-bg)';
            });

            const closeDialog = () => {
                overlay.remove();
                resolve();
            };

            okBtn.addEventListener('click', closeDialog);

            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) {
                    closeDialog();
                }
            });

            const handleEscape = (e: KeyboardEvent) => {
                if (e.key === 'Escape') {
                    document.removeEventListener('keydown', handleEscape);
                    closeDialog();
                }
            };
            document.addEventListener('keydown', handleEscape);

            // Auto-dismiss if duration is set
            if (options.duration && options.duration > 0) {
                setTimeout(() => {
                    document.removeEventListener('keydown', handleEscape);
                    closeDialog();
                }, options.duration);
            }
        });
    }

    /**
     * Show custom delete confirmation modal
     * Task 3.4.2
     */
    private async showBatchDeleteConfirmation(analysis: {
        folders: Folder[];
        subfolders: Folder[];
        bookmarks: Bookmark[];
    }): Promise<boolean> {
        return new Promise((resolve) => {
            const overlay = document.createElement('div');
            overlay.className = 'modal-overlay';

            const modal = document.createElement('div');
            modal.className = 'delete-confirmation-modal';

            modal.innerHTML = `
            <div class="delete-dialog-content">
                <div class="delete-dialog-header">
                    <span class="delete-dialog-icon">${Icons.alertTriangle}</span>
                    <h3 class="delete-dialog-title">Delete Selected Items</h3>
                </div>
                <div class="delete-dialog-body">
                    <p class="delete-dialog-text">This will permanently delete:</p>
                    <ul class="delete-dialog-list">
                        ${analysis.folders.length > 0 ? `<li class="delete-dialog-list-item"><span class="delete-dialog-list-icon">${Icons.folder}</span><span>${analysis.folders.length} root folder${analysis.folders.length > 1 ? 's' : ''}</span></li>` : ''}
                        ${analysis.subfolders.length > 0 ? `<li class="delete-dialog-list-item"><span class="delete-dialog-list-icon">${Icons.folder}</span><span>${analysis.subfolders.length} subfolder${analysis.subfolders.length > 1 ? 's' : ''}</span></li>` : ''}
                        ${analysis.bookmarks.length > 0 ? `<li class="delete-dialog-list-item"><span class="delete-dialog-list-icon">${Icons.bookmark}</span><span>${analysis.bookmarks.length} bookmark${analysis.bookmarks.length > 1 ? 's' : ''}</span></li>` : ''}
                    </ul>
                    <p class="delete-dialog-warning">
                        This action cannot be undone.
                    </p>
                </div>
            </div>
            <div class="delete-dialog-footer">
                <button class="cancel-btn">Cancel</button>
                <button class="delete-btn">Delete</button>
            </div>
        `;

            overlay.appendChild(modal);

            // CRITICAL: Append to Shadow DOM instead of document.body
            if (this.shadowRoot) {
                this.shadowRoot.appendChild(overlay);
            }

            const cancelBtn = modal.querySelector('.cancel-btn') as HTMLElement;
            const deleteBtn = modal.querySelector('.delete-btn') as HTMLElement;

            cancelBtn.addEventListener('click', () => {
                overlay.remove();
                resolve(false);
            });

            deleteBtn.addEventListener('click', () => {
                overlay.remove();
                resolve(true);
            });

            overlay.addEventListener('click', (e) => {
                e.stopPropagation();
                if (e.target === overlay) {
                    overlay.remove();
                    resolve(false);
                }
            });

            modal.addEventListener('click', (e) => {
                e.stopPropagation();
            });

            const handleEscape = (e: KeyboardEvent) => {
                if (e.key === 'Escape') {
                    overlay.remove();
                    document.removeEventListener('keydown', handleEscape);
                    resolve(false);
                }
            };
            document.addEventListener('keydown', handleEscape);
        });
    }

    /**
     * Execute batch delete with proper order and error handling
     * Task 3.4.4 - Optimized with bulk operations
     */
    private async executeBatchDelete(analysis: {
        folders: Folder[];
        subfolders: Folder[];
        bookmarks: Bookmark[];
    }): Promise<void> {
        const perfStart = performance.now();

        try {
            // Step 1: Bulk delete all bookmarks first
            if (analysis.bookmarks.length > 0) {
                logger.info(`[Batch Delete] Bulk removing ${analysis.bookmarks.length} bookmarks...`);
                await SimpleBookmarkStorage.bulkRemove(
                    analysis.bookmarks.map(b => ({ url: b.url, position: b.position }))
                );
            }

            // Step 2: Bulk delete folders (deepest first sorted, already filtered by caller)
            const allFolders = [...analysis.folders, ...analysis.subfolders];
            if (allFolders.length > 0) {
                const sortedPaths = allFolders
                    .sort((a, b) => b.depth - a.depth)
                    .map(f => f.path);

                logger.info(`[Batch Delete] Bulk removing ${sortedPaths.length} folders...`);
                await FolderStorage.bulkDelete(sortedPaths);
            }

            const perfEnd = performance.now();
            const totalDeleted = analysis.bookmarks.length + allFolders.length;
            logger.info(`[Batch Delete] Successfully deleted ${totalDeleted} items in ${(perfEnd - perfStart).toFixed(0)}ms`);

        } catch (error) {
            logger.error('[Batch Delete] Error:', error);
            this.showErrorSummary([`Batch delete failed: ${error instanceof Error ? error.message : 'Unknown error'}`]);
        }

        // Cleanup
        this.selectedItems.clear();
        await this.refresh();
    }

    /**
     * Show error summary modal
     * Task 3.4.5
     */
    private showErrorSummary(errors: string[]): void {
        // Dark mode detection handled by CSS variables
        const bgColor = 'var(--aimd-bg-primary)';


        const overlay = document.createElement('div');
        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: var(--aimd-bg-overlay-heavy);
            z-index: var(--aimd-z-max);
            display: flex;
            align-items: center;
            justify-content: center;
        `;

        const modal = document.createElement('div');
        modal.style.cssText = `
            background: ${bgColor};
            border-radius: var(--aimd-radius-xl);
            box-shadow: var(--aimd-shadow-xl);
            max-width: 500px;
            width: 90%;
            max-height: 80vh;
            display: flex;
            flex-direction: column;
        `;

        modal.innerHTML = `
            <div class="error-dialog-content">
                <div class="error-dialog-header">
                    <span class="warning-icon">${Icons.alertTriangle}</span>
                    <h3 class="error-dialog-title">
                        Deletion Completed with Errors
                    </h3>
                </div>
                <div class="error-dialog-body">
                    <p class="error-dialog-text">
                        Completed with <strong>${errors.length}</strong> error${errors.length > 1 ? 's' : ''}:
                    </p>
                    <div class="error-list-container">
                        <ul class="error-list">
                            ${errors.map(err => `<li class="error-list-item">${err}</li>`).join('')}
                        </ul>
                    </div>
                </div>
            </div>
            <div class="error-dialog-footer">
                <button class="ok-btn">OK</button>
            </div>
        `;

        overlay.appendChild(modal);

        // CRITICAL: Append to Shadow DOM instead of document.body
        if (this.shadowRoot) {
            this.shadowRoot.appendChild(overlay);
        }

        const okBtn = modal.querySelector('.ok-btn') as HTMLElement;
        okBtn.addEventListener('mouseenter', () => {
            okBtn.style.background = 'var(--aimd-feedback-info-bg)';
        });
        okBtn.addEventListener('mouseleave', () => {
            okBtn.style.background = 'var(--aimd-interactive-selected)';
        });

        okBtn.addEventListener('click', () => {
            overlay.remove();
        });

        overlay.addEventListener('click', (e) => {
            e.stopPropagation();
            if (e.target === overlay) {
                overlay.remove();
            }
        });

        modal.addEventListener('click', (e) => {
            e.stopPropagation();
        });
    }

    /**
     * Handle batch delete (main orchestration)
     * Task 3.4.6
     */
    private async handleBatchDelete(): Promise<void> {
        if (this.selectedItems.size === 0) return;

        const analysis = this.analyzeSelection();
        const confirmed = await this.showBatchDeleteConfirmation(analysis);
        if (!confirmed) return;

        await this.executeBatchDelete(analysis);
    }

    /**
     * Execute batch move operation
     */
    private async executeBatchMove(bookmarks: Bookmark[], targetPath: string | null): Promise<void> {
        // Check storage quota before batch move
        const quotaCheck = await SimpleBookmarkStorage.canSave();
        if (!quotaCheck.canSave) {
            await this.showNotification({
                type: 'error',
                title: 'Storage Full',
                message: quotaCheck.message || 'Storage quota exceeded'
            });
            return;
        }

        // Show auto-dismiss warning if storage is getting full (95-98%)
        if (quotaCheck.warningLevel === 'warning') {
            this.showNotification({
                type: 'warning',
                title: 'Storage Warning',
                message: quotaCheck.message || 'Storage is getting full',
                duration: 3000
            });
        }

        const errors: string[] = [];
        let successCount = 0;

        logger.info(`[Batch Move] Moving ${bookmarks.length} bookmarks to ${targetPath || 'root'}...`);

        for (const bookmark of bookmarks) {
            try {
                // Update bookmark's folder path and save
                await SimpleBookmarkStorage.save(
                    bookmark.url,
                    bookmark.position,
                    bookmark.userMessage,
                    bookmark.aiResponse,
                    bookmark.title,
                    bookmark.platform,
                    bookmark.timestamp,
                    targetPath || undefined
                );
                successCount++;
            } catch (error) {
                errors.push(`Failed to move bookmark: ${bookmark.title}`);
                logger.error('[Batch Move] Error:', error);
            }
        }

        // Show results
        if (errors.length > 0) {
            this.showErrorSummary(errors);
            logger.warn(`[Batch Move] Completed with ${errors.length} errors, ${successCount} successful`);
        } else {
            logger.info(`[Batch Move] Successfully moved ${successCount} bookmarks`);
        }

        // Cleanup
        this.selectedItems.clear();
        await this.refresh();
    }

    /**
     * Handle batch move
     */
    private async handleBatchMove(): Promise<void> {
        if (this.selectedItems.size === 0) {
            await this.showNotification({
                type: 'warning',
                title: 'No Items Selected',
                message: 'Please select items to move'
            });
            return;
        }

        // Get only bookmarks (folders can't be moved)
        const bookmarks = this.getSelectedBookmarks();
        if (bookmarks.length === 0) {
            await this.showNotification({
                type: 'warning',
                title: 'No Bookmarks to Move',
                message: 'No bookmarks selected to move.\n\nNote: Folders cannot be moved, only bookmarks.'
            });
            return;
        }

        // Show folder picker using BookmarkSaveModal
        const { BookmarkSaveModal } = await import('./BookmarkSaveModal');
        const modal = new BookmarkSaveModal();

        const selectedPath = await modal.show({
            mode: 'folder-select',
            bookmarkCount: bookmarks.length
        }) as string | null | undefined;

        // Check if user cancelled
        if (selectedPath === undefined) {
            logger.info('[Batch Move] Cancelled by user');
            return;
        }

        // Execute move
        await this.executeBatchMove(bookmarks, selectedPath);
    }

    /**
     * Show export options dialog
     * 
     * IMPORTANT: This dialog is created in Shadow DOM (not document.body)
     * so it can access CSS variables defined in the panel's styles.
     * 
     * @see /src/styles/design-tokens.css
     */
    private async showExportOptionsDialog(): Promise<boolean | null> {
        return new Promise((resolve) => {
            const overlay = document.createElement('div');
            overlay.className = 'export-dialog-overlay';

            const modal = document.createElement('div');
            modal.className = 'export-dialog-modal';

            modal.innerHTML = `
                <div class="export-dialog-content">
                    <h3 class="export-dialog-title">
                        导出选项
                    </h3>
                    <div class="export-dialog-body">
                        <p class="export-dialog-text">选择导出方式:</p>
                        <div class="export-options-container">
                            <label class="export-option">
                                <input type="radio" name="exportType" value="preserve" checked class="export-option-radio">
                                <div>
                                    <div class="export-option-label">保留文件夹结构</div>
                                    <div class="export-option-desc">导出为分层的文件夹和书签</div>
                                </div>
                            </label>
                            <label class="export-option">
                                <input type="radio" name="exportType" value="flat" class="export-option-radio">
                                <div>
                                    <div class="export-option-label">扁平列表</div>
                                    <div class="export-option-desc">仅导出所有书签，不含文件夹</div>
                                </div>
                            </label>
                        </div>
                    </div>
                    <div class="export-dialog-footer">
                        <button class="cancel-btn">取消</button>
                        <button class="confirm-btn">导出</button>
                    </div>
                </div>
            `; overlay.appendChild(modal);

            // CRITICAL: Append to Shadow DOM instead of document.body
            if (this.shadowRoot) {
                this.shadowRoot.appendChild(overlay);
            }

            // ✅ Prevent modal content clicks from closing
            modal.addEventListener('click', (e) => {
                e.stopPropagation();
            });

            const cancelBtn = modal.querySelector('.cancel-btn') as HTMLElement;
            const confirmBtn = modal.querySelector('.confirm-btn') as HTMLElement;
            const preserveInput = modal.querySelector('input[value="preserve"]') as HTMLInputElement;

            // Close on overlay click only
            overlay.addEventListener('click', () => {
                if (this.shadowRoot) {
                    this.shadowRoot.removeChild(overlay);
                }
                resolve(null);
            });

            cancelBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (this.shadowRoot) {
                    this.shadowRoot.removeChild(overlay);
                }
                resolve(null);
            });

            confirmBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                const preserveStructure = preserveInput.checked;
                if (this.shadowRoot) {
                    this.shadowRoot.removeChild(overlay);
                }
                resolve(preserveStructure);
            });

            // Close on overlay click
            overlay.addEventListener('click', (e) => {
                e.stopPropagation();
                if (e.target === overlay) {
                    overlay.remove();
                    resolve(null);
                }
            });

            modal.addEventListener('click', (e) => {
                e.stopPropagation();
            });

            // Close on Escape key
            const handleEscape = (e: KeyboardEvent) => {
                if (e.key === 'Escape') {
                    overlay.remove();
                    document.removeEventListener('keydown', handleEscape);
                    resolve(null);
                }
            };
            document.addEventListener('keydown', handleEscape);
        });
    }


    /**
     * Handle export
     */
    private async handleExport(): Promise<void> {
        // Show export options dialog
        const preserveStructure = await this.showExportOptionsDialog();
        if (preserveStructure === null) return; // Cancelled

        // Prepare bookmarks for export
        const bookmarksToExport = preserveStructure
            ? this.bookmarks
            : this.bookmarks.map(b => ({ ...b, folderPath: null }));

        const exportData = {
            version: '2.0',
            exportDate: new Date().toISOString(),
            bookmarks: bookmarksToExport
        };

        const data = JSON.stringify(exportData, null, 2);
        const blob = new Blob([data], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `bookmarks-${Date.now()}.json`;
        a.click();
        URL.revokeObjectURL(url);
        logger.info(`[Export] Exported ${bookmarksToExport.length} bookmarks (structure: ${preserveStructure})`);
    }

    /**
     * Handle import
     */
    private async handleImport(): Promise<void> {
        // Create hidden file input
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'application/json';

        // Handle file selection
        input.onchange = async (e) => {
            const file = (e.target as HTMLInputElement).files?.[0];
            if (!file) return;

            try {
                const handleImportStart = performance.now();

                // Read file
                const text = await file.text();
                const data = JSON.parse(text);

                // Validate data
                const bookmarks = this.validateImportData(data);
                logger.info(`[Import][Perf] Validated ${bookmarks.length} bookmarks in ${(performance.now() - handleImportStart).toFixed(0)}ms`);

                // Analyze import data for folder path issues (Issue 2)
                const analysis = this.analyzeImportData(bookmarks);
                const importFolderSet = new Set<Bookmark>([
                    ...analysis.noFolder,
                    ...analysis.tooDeep
                ]);

                // Adjust folder paths for problematic bookmarks
                analysis.noFolder.forEach(b => b.folderPath = 'Import');
                analysis.tooDeep.forEach(b => b.folderPath = 'Import');

                // Combine all bookmarks
                const allBookmarks = [...analysis.valid, ...analysis.noFolder, ...analysis.tooDeep];

                // Create all missing folders before importing
                const folderPathsNeeded = new Set<string>();

                // Always ensure "Import" folder exists if we have bookmarks without folders
                if (analysis.noFolder.length > 0 || analysis.tooDeep.length > 0) {
                    folderPathsNeeded.add('Import');
                }

                for (const bookmark of allBookmarks) {
                    if (bookmark.folderPath && bookmark.folderPath.trim()) {
                        folderPathsNeeded.add(bookmark.folderPath);
                    }
                }

                logger.info(`[Import] Checking ${folderPathsNeeded.size} unique folder paths`);
                for (const folderPath of folderPathsNeeded) {
                    const exists = this.folders.some(f => f.path === folderPath);
                    if (!exists) {
                        logger.info(`[Import] Creating missing folder: ${folderPath}`);
                        try {
                            await FolderStorage.create(folderPath);
                        } catch (error) {
                            logger.error(`[Import] Failed to create folder ${folderPath}:`, error);
                        }
                    } else {
                        logger.info(`[Import] Folder already exists: ${folderPath}`);
                    }
                }

                // Refresh folders to load newly created folders
                this.folders = await FolderStorage.getAll();
                logger.info(`[Import] Loaded ${this.folders.length} folders after creation`);

                // Build merge entries (handles duplicate detection, title conflicts, and import folder redirects)
                const mergeEntries = await this.buildImportMergeEntries(allBookmarks, importFolderSet);
                const hasRenameConflicts = mergeEntries.some(entry => entry.status === 'rename');
                const hasImportFolder = mergeEntries.some(entry => entry.status === 'import');
                const hasDuplicates = mergeEntries.some(entry => entry.status === 'duplicate');
                const shouldPrompt = hasDuplicates || hasRenameConflicts || hasImportFolder;

                if (shouldPrompt) {
                    const action = await this.showMergeDialog(mergeEntries, {
                        hasRenameConflicts,
                        duplicateCount: mergeEntries.filter(e => e.status === 'duplicate').length
                    });
                    if (action === 'cancel') {
                        logger.info('[Import] User cancelled import');
                        return;
                    }

                    if (action === 'rename-merge') {
                        mergeEntries.forEach(entry => {
                            if (entry.renameTo) {
                                entry.bookmark.title = entry.renameTo;
                            }
                        });
                    }
                }

                // Filter out duplicates before import
                const bookmarksToImport = mergeEntries
                    .filter(entry => entry.status !== 'duplicate')
                    .map(entry => entry.bookmark);

                // Check if import would exceed storage quota
                const importCheck = await SimpleBookmarkStorage.canImport(bookmarksToImport);
                if (!importCheck.canImport) {
                    await this.showNotification({
                        type: 'error',
                        title: 'Storage Full',
                        message: importCheck.message || 'Not enough storage space for import'
                    });
                    return;
                }

                // Import filtered bookmarks (duplicates already excluded)
                await this.importBookmarks(bookmarksToImport);

                // Refresh panel
                await this.refresh();

                // Calculate counts for success message
                const importedCount = bookmarksToImport.length;
                const skippedCount = mergeEntries.filter(e => e.status === 'duplicate').length;

                // Show success message with detailed counts
                let message = `Imported ${importedCount} bookmark(s)`;
                if (skippedCount > 0) {
                    message += `, skipped ${skippedCount} duplicate(s)`;
                }
                message += '.';

                await this.showNotification({
                    type: 'success',
                    title: 'Import Successful',
                    message
                });
                logger.info(`[Import] Imported ${importedCount} bookmarks, skipped ${skippedCount} duplicates`);
            } catch (error) {
                logger.error('[Import] Failed:', error);
                const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                await this.showNotification({
                    type: 'error',
                    title: 'Import Failed',
                    message: `Import failed: ${errorMessage}`
                });
            }
        };

        // Trigger file picker
        input.click();
    }

    /**
     * Analyze import data for folder path issues
     * Issue 2: Categorize bookmarks by folder path validity
     */
    private analyzeImportData(bookmarks: Bookmark[]): {
        valid: Bookmark[];
        noFolder: Bookmark[];
        tooDeep: Bookmark[];
    } {
        const valid: Bookmark[] = [];
        const noFolder: Bookmark[] = [];
        const tooDeep: Bookmark[] = [];

        logger.info(`[Import Analysis] Analyzing ${bookmarks.length} bookmarks`);
        logger.info(`[Import Analysis] MAX_DEPTH = ${PathUtils.MAX_DEPTH}`);

        for (const bookmark of bookmarks) {
            const folderPath = bookmark.folderPath;

            if (!folderPath || folderPath.trim() === '') {
                logger.info(`[Import Analysis] No folder: ${bookmark.title?.substring(0, 50)}`);
                noFolder.push(bookmark);
            } else {
                const depth = PathUtils.getDepth(folderPath);
                logger.info(`[Import Analysis] Folder "${folderPath}" depth=${depth}, title="${bookmark.title?.substring(0, 50)}"`);

                if (depth > PathUtils.MAX_DEPTH) {
                    logger.info(`[Import Analysis] Too deep (${depth} > ${PathUtils.MAX_DEPTH}): ${folderPath}`);
                    tooDeep.push(bookmark);
                } else {
                    valid.push(bookmark);
                }
            }
        }

        logger.info(`[Import Analysis] Results: valid=${valid.length}, noFolder=${noFolder.length}, tooDeep=${tooDeep.length}`);
        return { valid, noFolder, tooDeep };
    }

    /**
     * Validate import data
     */
    private validateImportData(data: any): Bookmark[] {
        // Support both formats:
        // 1. Old format: direct array of bookmarks
        // 2. New format: { version: "2.0", exportDate: "...", bookmarks: [...] }
        let bookmarksArray: any[];

        if (Array.isArray(data)) {
            // Old format: direct array
            bookmarksArray = data;
            logger.info('[Import] Detected old format (direct array)');
        } else if (data && typeof data === 'object' && Array.isArray(data.bookmarks)) {
            // New format: object with bookmarks field
            bookmarksArray = data.bookmarks;
            logger.info(`[Import] Detected new format (version: ${data.version || 'unknown'})`);
        } else {
            throw new Error('Invalid format: expected an array of bookmarks or an object with bookmarks field');
        }

        const validBookmarks: Bookmark[] = [];
        const errors: string[] = [];

        bookmarksArray.forEach((item: any, index: number) => {
            // ✅ Auto-fill missing optional fields for imported bookmarks
            const enrichedItem = {
                ...item,
                urlWithoutProtocol: item.urlWithoutProtocol || item.url?.replace(/^https?:\/\//, ''),
                title: item.title || item.userMessage?.substring(0, 50) || 'Untitled',
                platform: item.platform || 'ChatGPT',
                folderPath: item.folderPath || 'Import'
            };

            if (SimpleBookmarkStorage.validateBookmark(enrichedItem)) {
                validBookmarks.push(enrichedItem);
            } else {
                errors.push(`Invalid bookmark at index ${index}`);
                logger.warn(`[Import] Invalid bookmark at index ${index}:`, item);
            }
        });

        if (errors.length > 0) {
            logger.warn(`[Import] ${errors.length} invalid bookmarks skipped`);
        }

        if (validBookmarks.length === 0) {
            throw new Error('No valid bookmarks found in file');
        }

        return validBookmarks;
    }

    /**
     * Build merge entries with status + rename preview
     */
    private async buildImportMergeEntries(
        bookmarks: Bookmark[],
        importFolderSet: Set<Bookmark>
    ): Promise<ImportMergeEntry[]> {
        const existingBookmarks = this.bookmarks.length > 0
            ? this.bookmarks
            : await SimpleBookmarkStorage.getAllBookmarks();

        // Build a map for fast URL+position lookup (for duplicate detection)
        const existingByKey = new Map<string, Bookmark>();
        existingBookmarks.forEach((b) => {
            const key = `${b.url}:${b.position}`;
            existingByKey.set(key, b);
        });

        const usedTitlesByFolder = new Map<string, Set<string>>();
        const entries: ImportMergeEntry[] = [];

        const getUsedTitles = (folderPath: string): Set<string> => {
            const key = folderPath || 'Import';
            let existing = usedTitlesByFolder.get(key);
            if (!existing) {
                existing = new Set<string>();
                usedTitlesByFolder.set(key, existing);
            }
            return existing;
        };

        existingBookmarks.forEach((bookmark) => {
            const usedTitles = getUsedTitles(bookmark.folderPath);
            usedTitles.add(this.normalizeBookmarkTitle(bookmark.title));
        });

        for (const bookmark of bookmarks) {
            const folderPath = bookmark.folderPath || 'Import';
            const usedTitles = getUsedTitles(folderPath);
            const normalizedTitle = this.normalizeBookmarkTitle(bookmark.title);

            let status: ImportMergeStatus = 'normal';
            let renameTo: string | undefined;
            let existingTitle: string | undefined;

            // Step 1: Check for URL+position duplicate (global, highest priority)
            const duplicateKey = `${bookmark.url}:${bookmark.position}`;
            const existingDuplicate = existingByKey.get(duplicateKey);
            let existingFolderPath: string | undefined;
            if (existingDuplicate) {
                status = 'duplicate';
                existingTitle = existingDuplicate.title;
                existingFolderPath = existingDuplicate.folderPath;
            } else {
                // Step 2: Check for title conflict in same folder
                if (normalizedTitle && usedTitles.has(normalizedTitle)) {
                    status = 'rename';
                    renameTo = this.generateUniqueTitle(bookmark.title, usedTitles);
                    usedTitles.add(this.normalizeBookmarkTitle(renameTo));
                } else if (normalizedTitle) {
                    usedTitles.add(normalizedTitle);
                }

                // Step 3: Check for import folder redirect
                if (status !== 'rename' && importFolderSet.has(bookmark)) {
                    status = 'import';
                }
            }

            entries.push({ bookmark, status, renameTo, existingTitle, existingFolderPath });
        }

        return entries;
    }

    private normalizeBookmarkTitle(title: string): string {
        return title.trim().toLocaleLowerCase();
    }

    private generateUniqueTitle(baseTitle: string, usedTitles: Set<string>): string {
        const trimmedBase = baseTitle.trim() || 'Untitled';
        let candidate = trimmedBase;
        let counter = 1;

        while (usedTitles.has(this.normalizeBookmarkTitle(candidate))) {
            candidate = `${trimmedBase}-${counter}`;
            counter += 1;
        }

        return candidate;
    }

    /**
     * Show merge confirmation dialog
     * Returns: merge, rename-merge, or cancel
     */
    private async showMergeDialog(
        entries: ImportMergeEntry[],
        options: {
            hasRenameConflicts: boolean;
            duplicateCount: number;
        }
    ): Promise<'merge' | 'rename-merge' | 'cancel'> {
        return new Promise((resolve) => {
            // ✅ Shadow DOM Pattern: Consistent with BookmarkSaveModal
            const container = document.createElement('div');
            container.className = 'merge-dialog-host';
            const shadowRoot = container.attachShadow({ mode: 'open' });

            // Inject styles into Shadow DOM
            const isDark = ThemeManager.getInstance().isDarkMode();
            const tokens = isDark ? DesignTokens.getDarkTokens() : DesignTokens.getLightTokens();

            const styleElement = document.createElement('style');
            styleElement.textContent = `
                :host { ${tokens} }
                
                * { box-sizing: border-box; }

                .duplicate-dialog-overlay {
                    position: fixed;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    background: var(--aimd-bg-overlay-heavy);
                    z-index: var(--aimd-z-max);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }

                .duplicate-dialog-modal {
                    background: var(--aimd-bg-primary);
                    color: var(--aimd-text-primary);
                    border-radius: var(--aimd-radius-xl);
                    box-shadow: var(--aimd-shadow-xl);
                    max-width: 500px;
                    width: 90%;
                    max-height: 80vh;
                    overflow-y: auto;
                    font-family: var(--aimd-font-sans);
                }

                .duplicate-dialog-content { padding: 20px; }
                .duplicate-dialog-header { display: flex; align-items: center; gap: 12px; margin-bottom: 14px; }
                .duplicate-dialog-icon { color: var(--aimd-feedback-warning-text); font-size: 24px; line-height: 1; flex-shrink: 0; }
                .duplicate-dialog-title { margin: 0; font-size: 20px; font-weight: var(--aimd-font-medium); color: var(--aimd-text-primary); line-height: 1.2; }
                .duplicate-dialog-body { color: var(--aimd-text-primary); font-size: 14px; line-height: 1.5; }
                .duplicate-dialog-text { margin: 0 0 10px 0; }
                
                .merge-summary { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; margin-bottom: 12px; }
                .merge-summary-item { background: var(--aimd-bg-secondary); border-radius: var(--aimd-radius-lg); padding: 8px 10px; }
                .merge-summary-label { font-size: 12px; color: var(--aimd-text-secondary); display: block; }
                .merge-summary-value { font-size: 16px; font-weight: var(--aimd-font-semibold); color: var(--aimd-text-primary); }
                
                .merge-list-container { border: 1px solid var(--aimd-border-subtle); border-radius: var(--aimd-radius-lg); max-height: 320px; overflow-y: auto; }
                .merge-list-item { padding: 10px 12px; border-bottom: 1px solid var(--aimd-border-subtle); display: flex; flex-direction: column; gap: 4px; }
                .merge-list-item:last-child { border-bottom: none; }
                .merge-item-header { display: flex; justify-content: space-between; align-items: center; gap: 12px; }
                .merge-item-title { font-weight: var(--aimd-font-medium); color: var(--aimd-text-primary); word-break: break-word; }
                .merge-item-path { font-size: 12px; color: var(--aimd-text-secondary); word-break: break-word; }
                .merge-item-path-label { margin-right: 6px; color: var(--aimd-text-secondary); font-weight: var(--aimd-font-medium); }
                .merge-item-rename { font-size: 12px; color: var(--aimd-interactive-danger); }
                
                .merge-badge { font-size: 12px; padding: 2px 6px; border-radius: 999px; font-weight: var(--aimd-font-medium); white-space: nowrap; }
                .merge-badge-normal { background: var(--aimd-feedback-success-bg); color: var(--aimd-feedback-success-text); }
                .merge-badge-rename { background: var(--aimd-feedback-warning-bg); color: var(--aimd-feedback-warning-text); }
                .merge-badge-import { background: var(--aimd-feedback-info-bg); color: var(--aimd-interactive-primary-hover); }
                .merge-badge-duplicate { background: var(--aimd-feedback-danger-bg); color: var(--aimd-feedback-danger-text); }
                
                .merge-item-compare { font-size: 12px; color: var(--aimd-text-secondary); margin-top: 4px; padding: 6px 8px; background: var(--aimd-bg-secondary); border-radius: var(--aimd-radius-sm); }
                .merge-item-compare-row { display: flex; gap: 4px; margin-bottom: 2px; }
                .merge-item-compare-row:last-child { margin-bottom: 0; }
                .merge-item-compare-label { color: var(--aimd-text-secondary); min-width: 50px; }
                .merge-item-compare-value { color: var(--aimd-text-primary); word-break: break-word; }
                
                .duplicate-dialog-hint { margin: 6px 0 0 0; color: var(--aimd-text-secondary); font-size: 13px; font-style: italic; opacity: 0.9; }
                
                .import-summary-footer { padding: 12px 16px; display: flex; justify-content: flex-end; gap: 8px; border-top: 1px solid var(--aimd-border-default); }
                .cancel-btn { padding: 8px 16px; border: none; border-radius: var(--aimd-radius-md); background: var(--aimd-bg-secondary); color: var(--aimd-text-primary); font-size: var(--aimd-text-sm); font-weight: var(--aimd-font-medium); cursor: pointer; transition: all 0.2s; }
                .cancel-btn:hover { background: var(--aimd-interactive-hover); transform: translateY(-1px); }
                .merge-btn { padding: 8px 16px; border: none; border-radius: var(--aimd-radius-md); background: var(--aimd-button-primary-bg); color: var(--aimd-button-primary-text); font-size: var(--aimd-text-sm); font-weight: var(--aimd-font-medium); cursor: pointer; transition: all 0.2s; }
                .merge-btn:hover { background: var(--aimd-button-primary-hover); transform: translateY(-1px); }
            `;
            shadowRoot.appendChild(styleElement);

            // Create overlay inside Shadow DOM
            const overlay = document.createElement('div');
            overlay.className = 'duplicate-dialog-overlay';

            const modal = document.createElement('div');
            modal.className = 'duplicate-dialog-modal';

            const statusLabels: Record<ImportMergeStatus, string> = {
                normal: 'Normal Import',
                rename: 'Rename & Merge',
                import: 'Move to Import',
                duplicate: 'Skip (Duplicate)'
            };

            const counts = entries.reduce(
                (acc, entry) => {
                    acc[entry.status] += 1;
                    return acc;
                },
                { normal: 0, rename: 0, import: 0, duplicate: 0 } as Record<ImportMergeStatus, number>
            );

            const primaryLabel = options.hasRenameConflicts ? 'Rename & Merge' : 'Merge';

            modal.innerHTML = `
            <div class="duplicate-dialog-content">
                <div class="duplicate-dialog-header">
                    <span class="duplicate-dialog-icon">${Icons.alertTriangle}</span>
                    <h3 class="duplicate-dialog-title">Import Confirmation</h3>
                </div>
                <div class="duplicate-dialog-body">
                    <p class="duplicate-dialog-text">Importing <strong>${entries.length}</strong> bookmark(s).</p>
                    <div class="merge-summary" style="grid-template-columns: repeat(4, minmax(0, 1fr));">
                        <div class="merge-summary-item">
                            <span class="merge-summary-label">Normal</span>
                            <span class="merge-summary-value">${counts.normal}</span>
                        </div>
                        <div class="merge-summary-item">
                            <span class="merge-summary-label">Renamed</span>
                            <span class="merge-summary-value">${counts.rename}</span>
                        </div>
                        <div class="merge-summary-item">
                            <span class="merge-summary-label">To Import</span>
                            <span class="merge-summary-value">${counts.import}</span>
                        </div>
                        <div class="merge-summary-item">
                            <span class="merge-summary-label">Skipped</span>
                            <span class="merge-summary-value">${counts.duplicate}</span>
                        </div>
                    </div>
                    <div class="merge-list-container">
                        ${entries.map((entry) => `
                            <div class="merge-list-item">
                                <div class="merge-item-header">
                                    <div class="merge-item-title">${this.escapeHtml(entry.bookmark.title)}</div>
                                    <span class="merge-badge merge-badge-${entry.status}">
                                        ${statusLabels[entry.status]}
                                    </span>
                                </div>
                                <div class="merge-item-path">
                                    <span class="merge-item-path-label">Folder:</span>
                                    ${this.escapeHtml(entry.bookmark.folderPath || 'Import')}
                                </div>
                                ${entry.renameTo ? `
                                    <div class="merge-item-rename">Renamed to: ${this.escapeHtml(entry.renameTo)}</div>
                                ` : ''}
                                ${entry.status === 'duplicate' && entry.existingTitle ? `
                                    <div class="merge-item-compare">
                                        <div class="merge-item-compare-row">
                                            <span class="merge-item-compare-label">Existing entry:</span>
                                            <span class="merge-item-compare-value">${this.escapeHtml((entry.existingFolderPath || 'Import') + '/' + entry.existingTitle)}</span>
                                        </div>
                                        <div class="merge-item-compare-row">
                                            <span class="merge-item-compare-label">Pending import:</span>
                                            <span class="merge-item-compare-value">${this.escapeHtml((entry.bookmark.folderPath || 'Import') + '/' + entry.bookmark.title)}</span>
                                        </div>
                                    </div>
                                ` : ''}
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>
            <div class="import-summary-footer">
                <button class="cancel-btn">Cancel</button>
                <button class="merge-btn">${primaryLabel}</button>
            </div>
        `;

            overlay.appendChild(modal);
            shadowRoot.appendChild(overlay);

            // Mount container to body
            document.body.appendChild(container);

            // Cleanup function
            const cleanup = () => {
                container.remove();
                document.removeEventListener('keydown', handleEscape);
            };

            const cancelBtn = shadowRoot.querySelector('.cancel-btn') as HTMLElement;
            const mergeBtn = shadowRoot.querySelector('.merge-btn') as HTMLElement;

            cancelBtn.addEventListener('click', () => {
                cleanup();
                resolve('cancel');
            });

            mergeBtn.addEventListener('click', () => {
                cleanup();
                resolve(options.hasRenameConflicts ? 'rename-merge' : 'merge');
            });

            overlay.addEventListener('click', (e) => {
                e.stopPropagation();
                if (e.target === overlay) {
                    cleanup();
                    resolve('cancel');
                }
            });

            modal.addEventListener('click', (e) => {
                e.stopPropagation();
            });

            const handleEscape = (e: KeyboardEvent) => {
                if (e.key === 'Escape') {
                    cleanup();
                    resolve('cancel');
                }
            };
            document.addEventListener('keydown', handleEscape);
        });
    }

    /**
     * Import bookmarks (batch save)
     * Uses bulkSave() for optimal performance - single atomic write
     */
    private async importBookmarks(bookmarks: Bookmark[]): Promise<void> {
        const perfStart = performance.now();
        logger.info(`[Import][Perf] Starting bulk import of ${bookmarks.length} bookmarks`);

        // Check storage quota before import
        const quotaCheck = await SimpleBookmarkStorage.canSave();
        if (!quotaCheck.canSave) {
            throw new Error(quotaCheck.message || 'Storage quota exceeded');
        }

        // Show auto-dismiss warning if storage is getting full (95-98%)
        if (quotaCheck.warningLevel === 'warning') {
            this.showNotification({
                type: 'warning',
                title: 'Storage Warning',
                message: quotaCheck.message || 'Storage is getting full',
                duration: 3000
            });
        }

        // Single atomic bulk write
        await SimpleBookmarkStorage.bulkSave(bookmarks);

        const perfEnd = performance.now();
        logger.info(`[Import][Perf] Bulk import complete: ${bookmarks.length} bookmarks in ${(perfEnd - perfStart).toFixed(0)}ms`);
    }

    /**
     * Setup storage change listener - AITimeline pattern
     */
    private setupStorageListener(): void {
        if (this.storageListener) return; // Already setup

        this.storageListener = (changes, areaName) => {
            if (areaName === 'local') {
                // Check if any bookmark keys changed
                const bookmarkChanged = Object.keys(changes).some(key =>
                    key.startsWith('bookmark:')
                );
                if (bookmarkChanged && this.overlay?.style.display !== 'none') {
                    this.refresh();
                    logger.debug('[SimpleBookmarkPanel] Auto-refreshed due to storage change');
                }
            }
        };

        chrome.storage.onChanged.addListener(this.storageListener);
        logger.info('[SimpleBookmarkPanel] Storage listener setup');
    }

    /**
     * Smooth scroll to target element - EXACT AITimeline implementation
     */
    private smoothScrollTo(targetElement: HTMLElement): void {
        if (!targetElement) return;

        // AITimeline uses scrollIntoView with smooth behavior
        targetElement.scrollIntoView({
            behavior: 'smooth',
            block: 'start'
        });

        // Add highlight after a short delay to ensure scroll has started
        setTimeout(() => {
            this.highlightElement(targetElement);
        }, 100);
    }



    /**
     * Highlight element briefly
     */
    private highlightElement(element: HTMLElement): void {
        element.classList.add('bookmark-highlight');

        setTimeout(() => {
            element.classList.remove('bookmark-highlight');
        }, 3000);  // 3 秒
    }

    /**
     * Handle bookmark navigation - Go To
     */
    private async handleGoTo(url: string, position: number): Promise<void> {
        logger.debug(`[SimpleBookmarkPanel] Starting navigation to ${url} position ${position}`);

        const currentUrl = window.location.href;
        const targetUrl = url;

        // 判断是否为当前页面
        const isCurrentPage = this.isSamePage(currentUrl, targetUrl);

        if (isCurrentPage) {
            // 当前页面，直接滚动
            this.hide(); // 关闭书签面板
            await this.smoothScrollToPosition(position);
            logger.debug(`[SimpleBookmarkPanel] Scrolled to position ${position} on current page`);
        } else {
            // 跨页面跳转
            await this.setNavigateData('targetPosition', position);
            window.location.href = targetUrl;
            logger.debug(`[SimpleBookmarkPanel] Navigating to ${targetUrl} with target position ${position}`);
        }
    }

    /**
     * Check if two URLs are the same page
     */
    private isSamePage(url1: string, url2: string): boolean {
        const normalize = (url: string) => {
            return url
                .replace(/^https?:\/\//, '')  // 移除协议
                .replace(/\/$/, '')            // 移除尾部斜杠
                .replace(/#.*$/, '')           // 移除 hash
                .replace(/\?.*$/, '');         // 移除 query
        };
        return normalize(url1) === normalize(url2);
    }

    /**
     * Smooth scroll to bookmark position
     */
    private async smoothScrollToPosition(position: number): Promise<void> {
        // Platform detection - check current URL
        const isGemini = window.location.href.includes('gemini.google.com');
        const isChatGPT = window.location.href.includes('chatgpt.com');

        // Platform-specific selectors (MUST match adapter selectors)
        let messageSelector: string;
        if (isGemini) {
            messageSelector = 'model-response';  // Gemini adapter selector
        } else if (isChatGPT) {
            messageSelector = 'article[data-turn="assistant"], [data-message-author-role="assistant"]:not(article [data-message-author-role="assistant"])';
        } else {
            logger.warn('[SimpleBookmarkPanel] Unknown platform for scrolling');
            return;
        }

        const messages = document.querySelectorAll(messageSelector);

        const targetIndex = position - 1;
        if (targetIndex >= 0 && targetIndex < messages.length) {
            const targetElement = messages[targetIndex] as HTMLElement;
            this.smoothScrollTo(targetElement);
        } else {
            logger.warn(`[SimpleBookmarkPanel] Invalid position for scrolling: ${position} (messages: ${messages.length})`);
        }
    }

    /**
     * Storage helpers - AITimeline pattern
     */
    // @ts-ignore - Used in handleGoTo
    private async setNavigateData(key: string, value: any): Promise<void> {
        try {
            const storageKey = `bookmarkNavigate:${key}`;
            await chrome.storage.local.set({ [storageKey]: value });
        } catch (error) {
            logger.error('[SimpleBookmarkPanel] setNavigateData Error:', error);
        }
    }

    private async getNavigateData(key: string): Promise<any> {
        try {
            const storageKey = `bookmarkNavigate:${key}`;
            const result = await chrome.storage.local.get(storageKey);
            const val = result[storageKey];

            if (val !== undefined) {
                // Clear after reading
                await chrome.storage.local.remove(storageKey);
                logger.debug(`[SimpleBookmarkPanel] Got ${storageKey} = ${val}`);
                return val;
            }

            return null;
        } catch (error) {
            logger.error('[SimpleBookmarkPanel] getNavigateData Error:', error);
            return null;
        }
    }

    /**
     * Check for navigation target on page load - AITimeline pattern
     */
    async checkNavigationTarget(): Promise<void> {
        try {
            const targetPosition = await this.getNavigateData('targetPosition');

            if (targetPosition !== null) {
                logger.debug(`[SimpleBookmarkPanel] Found target position for navigation: ${targetPosition}`);

                // AITimeline pattern: Use requestAnimationFrame
                requestAnimationFrame(async () => {
                    // Platform detection - check current URL
                    const isGemini = window.location.href.includes('gemini.google.com');
                    const isChatGPT = window.location.href.includes('chatgpt.com');

                    // Platform-specific selectors (MUST match adapter selectors)
                    let messageSelector: string;
                    if (isGemini) {
                        messageSelector = 'model-response';  // Gemini adapter selector
                    } else if (isChatGPT) {
                        messageSelector = 'article[data-turn="assistant"], [data-message-author-role="assistant"]:not(article [data-message-author-role="assistant"])';
                    } else {
                        return;
                    }

                    const messages = document.querySelectorAll(messageSelector);

                    const targetIndex = targetPosition - 1;

                    if (targetIndex >= 0 && targetIndex < messages.length) {
                        const targetElement = messages[targetIndex] as HTMLElement;

                        if (targetElement) {
                            logger.debug(`[SimpleBookmarkPanel] Auto-scrolling to position ${targetPosition}`);
                            this.smoothScrollTo(targetElement);
                        }
                    } else {
                        logger.warn(`[SimpleBookmarkPanel] Invalid auto-scroll position: ${targetPosition}`);
                    }
                });
            }
        } catch (error) {
            logger.error('[SimpleBookmarkPanel] checkNavigationTarget Error:', error);
        }
    }

    /**
     * Cleanup
     */
    destroy(): void {
        if (this.storageListener) {
            chrome.storage.onChanged.removeListener(this.storageListener);
            this.storageListener = null;
        }

        if (this.overlay) {
            this.overlay.remove();
            this.overlay = null;
            this.shadowRoot = null;
        }
    }

    /**
     * Escape HTML to prevent XSS
     */
    private escapeHtml(text: string): string {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    /**
     * Setup theme observer for dynamic theme switching
     * 
     * Monitors the host website's theme changes (html.dark class) and automatically
     * updates the panel's styles without requiring a page refresh.
     * 
     * @see ThemeManager - Unified theme detection and synchronization
     * @see /src/styles/tokens - New 3-tier design tokens
     */
    private setupThemeObserver(): void {
        // Get ThemeManager singleton and subscribe to theme changes
        const themeManager = ThemeManager.getInstance();

        // Subscribe to theme changes and store unsubscribe function
        this.themeUnsubscribe = themeManager.subscribe((theme) => {
            logger.info(`[SimpleBookmarkPanel] Theme changed to: ${theme}`);
            this.updateTheme();
        });

        logger.debug('[SimpleBookmarkPanel] Theme manager subscription initialized');
    }

    /**
     * Update theme by re-injecting styles
     * 
     * When the theme changes, this method regenerates the CSS with updated
     * design token values from design-tokens.css. CSS Variables automatically
     * inherit the new values, so we just need to refresh the style element.
     */
    private updateTheme(): void {
        if (!this.shadowRoot) {
            logger.warn('[SimpleBookmarkPanel] Cannot update theme: shadowRoot is null');
            return;
        }

        // Find the style element in Shadow DOM
        const styleElement = this.shadowRoot.querySelector('style');
        if (styleElement) {
            // Regenerate styles with updated token values
            styleElement.textContent = this.getStyles();
            if (this.overlay) {
                this.overlay.dataset.theme = ThemeManager.getInstance().isDarkMode() ? 'dark' : 'light';
            }
            logger.debug('[SimpleBookmarkPanel] Theme styles updated');
        } else {
            logger.warn('[SimpleBookmarkPanel] Cannot update theme: style element not found');
        }
    }

    /**
     * Get panel styles with isolated design tokens
     * 
     * T2.1: Shadow DOM CSS Isolation
     * All CSS Variables are defined within :host selector to prevent
     * polluting the host page's global CSS scope.
     * 
     * Pattern: Following Shoelace/Lit best practices
     * @see src/utils/design-tokens.ts
     * @see https://shoelace.style/getting-started/themes
     */
    private getStyles(): string {
        // T2.1.2: Detect current theme
        const isDark = ThemeManager.getInstance().isDarkMode();

        return `
            /* ============================================================================
               SHADOW DOM ISOLATED DESIGN TOKENS
               ============================================================================
               
               All CSS Variables are scoped to :host to prevent global pollution.
               These tokens are completely isolated from the host page (ChatGPT/Gemini).
               
               Benefits:
               - Zero impact on host page styles
               - Theme-aware (auto-detects light/dark mode)
               - Complete control over component appearance
               
               Migration from: global :root injection (manifest.json)
               Migration to: Shadow DOM :host isolation
               ============================================================================ */

            :host {
                /* T2.1.3: Inject all design tokens based on theme */
                ${(() => {
                const tokens = DesignTokens.getCompleteTokens(isDark);
                // Check if AIMD tokens are included
                return tokens;
            })()}
            }


            * {
                box-sizing: border-box;
            }

            /* ============================================================================
               CSS RESET - Form Elements
               ============================================================================
               Purpose: Remove browser default styles to ensure our tokens work correctly
               Scope: Only affects elements within this Shadow DOM
               Reference: Modern CSS Reset + Form-specific resets
               ============================================================================ */
            
            input:not([type="checkbox"]):not([type="radio"]):not(.search-input),
            button,
            select,
            textarea {
                /* Remove browser appearance */
                -webkit-appearance: none;
                -moz-appearance: none;
                appearance: none;
                
                /* Reset box model */
                margin: 0;
                padding: 0;
                border: none;
                background: none;
                
                /* Reset typography - inherit from parent */
                font-family: inherit;
                font-size: inherit;
                line-height: inherit;
                color: inherit;
                
                /* Reset other properties */
                outline: none;
                box-sizing: border-box;
            }

            /* Restore useful defaults */
            button {
                cursor: pointer;
                font-family: var(--aimd-font-sans);
                font-size: var(--aimd-text-sm);
                font-weight: var(--aimd-font-medium);
            }

            input::placeholder {
                opacity: 1; /* Firefox default is 0.54 */
            }

            .panel {
                position: fixed;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                width: 90%;
                max-width: 1000px;  /* 最大宽度800px */
                height: 85vh;
                max-height: 800px;  /* 最大高度600px */
                background: var(--aimd-panel-bg);
                border-radius: var(--aimd-radius-2xl);  /* Material Design 16px */
                box-shadow: var(--aimd-shadow-lg);      /* Material Design elevation */
                display: flex;
                z-index: var(--aimd-z-fixed);
                font-family: var(--aimd-font-sans);
                overflow: hidden;
            }

            /* ===================================================================
               TOOLBAR - Modernized per design_system.md
               - Removed border-bottom (use shadow)
               - Improved button styles
               =================================================================== */
            .toolbar {
                display: flex;
                gap: var(--aimd-space-2);  /* 8px */
                padding: var(--aimd-space-3) var(--aimd-space-4);  /* 12px 16px, more horizontal space */
                background: var(--aimd-bg-secondary);  /* Theme-aware background */
                /* border-bottom: removed */
                box-shadow: var(--aimd-shadow-xs);  /* Subtle separation */
                align-items: center;
                flex-wrap: wrap;
            }

            .toolbar-divider {
                width: 1px;
                height: 20px;  /* Slightly shorter */
                background: var(--aimd-border-default);  /* Theme-aware divider */
                margin: 0 var(--aimd-space-1);  /* 4px */
            }

            .new-folder-btn,
            .export-btn,
            .import-btn {
                padding: var(--aimd-space-2) var(--aimd-space-3);  /* 8px 12px */
                border: 1px solid var(--aimd-border-default);  /* Theme-aware */
                background: var(--aimd-bg-primary);  /* Theme-aware */
                border-radius: var(--aimd-radius-sm);  /* 6px per design system */
                font-size: var(--aimd-text-sm);  /* 13px */
                font-weight: var(--aimd-font-medium);  /* 500 */
                cursor: pointer;
                transition: all var(--aimd-duration-fast);  /* 150ms */
                white-space: nowrap;
            }

            .new-folder-btn:hover,
            .export-btn:hover,
            .import-btn:hover {
                background: var(--aimd-interactive-hover);  /* Theme-aware */
                border-color: var(--aimd-border-strong);  /* Theme-aware */
                transform: translateY(-1px);  /* Subtle lift */
                box-shadow: var(--aimd-shadow-sm);  /* Hover elevation */
            }

            .new-folder-btn {
                font-weight: 500;
                color: var(--aimd-text-link);
                border-color: var(--aimd-text-link);
            }

            .new-folder-btn:hover {
                background: var(--aimd-interactive-hover);  /* Theme-aware */
            }

            /* ===================================================================
               SIDEBAR - Modernized per design_system.md
               - Removed border-right (use background color difference instead)
               - Increased padding for breathing room
               - Consistent spacing with 8px grid
               =================================================================== */
            .sidebar {
                width: 140px;
                background: var(--aimd-glass-tint);  /* Transparent tint for glass effect */
                /* border-right: removed - no borders per design system */
                display: flex;
                flex-direction: column;
                padding: var(--aimd-space-4);  /* 16px, 8px grid */
                gap: var(--aimd-space-2);  /* 8px between tabs */
            }

            .tab-btn {
                display: flex;
                flex-direction: column;
                align-items: center;
                gap: var(--aimd-space-2);  /* 8px */
                padding: var(--aimd-space-3);  /* 12px, more breathing room */
                border: none;  /* No borders */
                background: transparent;
                cursor: pointer;
                transition: all var(--aimd-duration-fast);  /* 150ms per design system */
                color: var(--aimd-text-secondary);
                font-size: var(--aimd-text-xs);  /* 12px */
                border-radius: var(--aimd-radius-md);  /* 8px for card-like items */
            }

            .tab-btn:hover {
                background: var(--aimd-interactive-hover);  /* Subtle hover state */
                color: var(--aimd-text-primary);
                transform: translateY(-1px);  /* Micro-animation */
            }

            .tab-btn.active {
                background: var(--aimd-interactive-selected);
                color: var(--aimd-text-primary);
                font-weight: var(--aimd-font-semibold);  /* 600 */
                /* Use box-shadow for accent instead of border */
                box-shadow: inset 3px 0 0 var(--aimd-interactive-primary),
                            var(--aimd-shadow-sm);  /* Subtle elevation */
            }

            .tab-icon {
                font-size: 24px;
            }

            .tab-label {
                text-align: center;
                line-height: 1.2;
            }

            /* Main content */
            .main {
                flex: 1;
                display: flex;
                flex-direction: column;
                overflow: hidden;
            }

            /* ===================================================================
               HEADER - Modernized per design_system.md
               - Removed border-bottom (use box-shadow for separation)
               - Consistent padding with 8px grid
               =================================================================== */
            .header {
                padding: var(--aimd-space-5) var(--aimd-space-6);  /* 20px 24px */
                /* border-bottom: removed - use shadow instead */
                box-shadow: var(--aimd-shadow-xs);  /* Subtle separation */
                display: flex;
                justify-content: space-between;
                align-items: center;
                background: var(--aimd-bg-primary);
                z-index: 1;  /* Ensure shadow appears above content */
            }

            .header h2 {
                margin: 0;
                font-size: var(--aimd-text-xl);  /* 18px */
                font-weight: var(--aimd-font-semibold);  /* 600 */
                color: var(--aimd-text-primary);
                display: flex;
                align-items: center;
                gap: var(--aimd-space-2);  /* 8px */
                line-height: 1;
                letter-spacing: -0.02em;  /* Tighter for modern feel */
            }

            .header h2 svg {
                flex-shrink: 0;
            }

            .close-btn {
                background: var(--aimd-button-icon-bg);
                border: none;
                font-size: 24px;  /* Slightly smaller */
                color: var(--aimd-button-icon-text);
                cursor: pointer;
                padding: var(--aimd-space-1);  /* 4px */
                width: 32px;
                height: 32px;
                display: flex;
                align-items: center;
                justify-content: center;
                border-radius: var(--aimd-radius-sm);  /* 6px */
                transition: all var(--aimd-duration-fast);  /* 150ms */
            }

            .close-btn:hover {
                background: var(--aimd-button-icon-hover);
                color: var(--aimd-button-icon-text-hover);
                transform: scale(1.05);  /* Micro-animation */
            }

            .close-btn:active {
                background: var(--aimd-button-icon-active);
                transform: scale(0.95);  /* Press feedback */
            }

            .tree-item {
                /* Layout properties (from Line 5003) */
                display: flex;
                align-items: center;
                min-height: 30px;
                padding: var(--aimd-space-2) var(--aimd-space-3);  /* 8px 12px */
                position: relative;
                cursor: pointer;
                user-select: none;
                
                /* Styling properties (from Line 4059) */
                gap: var(--aimd-space-2);
                margin-bottom: var(--aimd-space-1);
                border-radius: var(--aimd-radius-lg);
                transition: all var(--aimd-duration-base) var(--ease-out);
                
                /* Critical: Explicit background */
                background: transparent;
                border: none;
                border-bottom: 1px solid var(--aimd-border-subtle);  /* From Line 5003 */
            }

            .tree-item:hover {
                background: var(--aimd-interactive-hover);
            }

            /* Tab content */
            .tab-content {
                display: none;
                flex: 1;
                flex-direction: column;
                overflow: hidden;
            }

            .tab-content.active {
                display: flex;
            }

            /* Toolbar */
            .toolbar {
                padding: var(--aimd-space-3) var(--aimd-space-6);  /* 12px 24px */
                border-bottom: 1px solid var(--aimd-border-subtle);  /* ✅ Subtle unified separator */
                display: flex;
                gap: var(--aimd-space-3);  /* 12px */
                align-items: center;
            }

            .search-wrapper {
                position: relative;
                display: flex;
                align-items: center;  /* 确保内容垂直居中 */
                flex: 1;
            }

            .search-icon {
                position: absolute;
                left: 12px;
                display: flex;
                align-items: center;  /* 图标垂直居中 */
                pointer-events: none;
                color: var(--aimd-text-tertiary);
            }

            .search-icon svg {
                display: block;  /* 移除inline默认的baseline对齐 */
            }

            /* ===================================================================
               SEARCH  INPUT - Modernized per design_system.md
               - Blue focus ring per design system (3px rgba blue)
               - Cleaner border states
               =================================================================== */
            input.search-input {
                flex: 1;
                padding: var(--aimd-space-2) var(--aimd-space-4) var(--aimd-space-2) var(--aimd-space-10);  /* Left padding for icon */
                border: 1.5px solid var(--aimd-border-default);  /* Theme-aware border */
                border-radius: var(--aimd-radius-lg);  /* 8px for better visual */
                background: var(--aimd-bg-primary);  /* Theme-aware */
                color: var(--aimd-text-primary);  /* Theme-aware text */
                font-size: var(--aimd-text-base);  /* 14px */
               transition: all var(--aimd-duration-fast);  /* 150ms */
            }

            input.search-input:hover {
                border-color: var(--aimd-border-strong);
            }

            input.search-input:focus {
                outline: none;
                border-color: var(--aimd-interactive-primary);
                /* Blue focus ring per design system */
                box-shadow: var(--aimd-shadow-focus);
                background: var(--aimd-bg-primary);  /* Theme-aware */
            }

            input.search-input::placeholder {
                color: var(--aimd-text-tertiary);
            }

            button.platform-filter {
                padding: var(--aimd-space-2) var(--aimd-space-3);  /* 8px 12px */
                border: 1.5px solid var(--aimd-border-default);  /* Theme-aware */
                border-radius: var(--aimd-radius-lg);  /* 8px */
                background: var(--aimd-bg-primary);  /* Theme-aware */
                color: var(--aimd-text-primary);  /* Theme-aware text */
                font-size: var(--aimd-text-sm);
                font-weight: var(--aimd-font-medium);
                cursor: pointer;
                transition: all var(--aimd-duration-fast);
            }

            button.platform-filter:hover {
                background: var(--aimd-interactive-hover);  /* Theme-aware hover */
                border-color: var(--aimd-border-strong);
            }

            button.platform-filter:focus {
                outline: none;
                border-color: var(--aimd-text-link);
                box-shadow: var(--aimd-shadow-focus);
            }

            .toolbar-divider {
                width: 1px;
                height: 24px;
                background: var(--aimd-border-default);
                margin: 0 var(--aimd-space-1);  /* 4px */
            }



            .toolbar-icon-btn {
                width: 32px;
                height: 32px;
                display: inline-flex;
                align-items: center;
                justify-content: center;
                border: 1px solid var(--aimd-border-subtle);  /* Subtle border for visibility */
                border-radius: var(--aimd-radius-lg);  /* 8px */
                background: var(--aimd-button-icon-bg);
                color: var(--aimd-button-icon-text);
                cursor: pointer;
                transition: all var(--aimd-duration-base) var(--ease-out);
            }

            .toolbar-icon-btn:hover {
                background: var(--aimd-button-icon-hover);
                color: var(--aimd-button-icon-text-hover);
                border-color: var(--aimd-border-default);  /* Slightly more visible border on hover */
            }

            .toolbar-icon-btn:active {
                background: var(--aimd-button-icon-active);
                transform: scale(0.95);
            }

            .toolbar-icon-btn svg {
                flex-shrink: 0;  /* 防止图标被压缩 */
            }

            /* 自定义平台选择器 */
            .platform-selector-wrapper {
                position: relative;
            }

            .platform-selector {
                display: inline-flex;
                align-items: center;
                gap: var(--aimd-space-2);  /* 8px */
                padding: var(--aimd-space-2) var(--aimd-space-3);  /* 8px 12px */
                border: 1px solid var(--aimd-border-default);
                border-radius: var(--aimd-radius-lg);  /* 8px */
                background: var(--aimd-bg-primary);
                color: var(--aimd-text-primary);
                font-size: var(--aimd-text-sm);
                font-weight: 500;
                cursor: pointer;
                transition: all var(--aimd-duration-base) var(--ease-out);
                min-width: 140px;
                justify-content: space-between;
            }

            /* Mac tag风格 - 根据选中平台改变背景色 */
            .platform-selector[data-selected="all"] {
                background: var(--aimd-bg-secondary);
                color: var(--aimd-text-primary);
                border-color: var(--aimd-border-default);
            }

            .platform-selector[data-selected="chatgpt"] {
                background: var(--aimd-platform-chatgpt-bg);
                color: var(--aimd-platform-chatgpt-text);
                border-color: var(--aimd-platform-chatgpt-bg);
            }

            .platform-selector[data-selected="gemini"] {
                background: var(--aimd-platform-gemini-bg);
                color: var(--aimd-platform-gemini-text);
                border-color: var(--aimd-platform-gemini-bg);
            }

            .platform-selector:hover {
                background: var(--aimd-interactive-hover);
                border-color: var(--aimd-interactive-primary);
                box-shadow: var(--aimd-shadow-focus);
            }

            .platform-selector-label {
                flex: 1;
                text-align: left;
            }

            .platform-selector-icon {
                flex-shrink: 0;
                display: flex;
                align-items: center;
                transition: transform var(--aimd-duration-base) var(--ease-out);
            }

            .platform-selector-wrapper.open .platform-selector-icon {
                transform: rotate(180deg);
            }

            /* 下拉菜单 */
            .platform-dropdown {
                position: absolute;
                top: calc(100% + 4px);
                left: 0;
                right: 0;
                background: var(--aimd-bg-primary);
                border: 1px solid var(--aimd-border-default);
                border-radius: var(--aimd-radius-lg);
                box-shadow: var(--aimd-shadow-md);
                z-index: var(--aimd-z-dropdown);
                overflow: hidden;
            }

            .platform-option {
                display: flex;
                align-items: center;
                gap: var(--aimd-space-2);  /* 8px */
                padding: var(--aimd-space-2) var(--aimd-space-3);  /* 8px 12px */
                cursor: pointer;
                transition: background var(--aimd-duration-base) var(--ease-out);
            }

            .platform-option:hover {
                background: var(--aimd-interactive-hover);
            }

            .platform-option[data-selected="true"] {
                background: var(--aimd-interactive-selected);
                color: var(--aimd-text-primary);
                font-weight: 600;
                box-shadow: inset 3px 0 0 var(--aimd-interactive-primary);
            }

            .platform-option-icon {
                flex-shrink: 0;
                display: flex;
                align-items: center;
                width: 16px;
                height: 16px;
            }

            .platform-option-icon svg {
                width: 16px;
                height: 16px;
            }

            .platform-option-label {
                flex: 1;
                font-size: var(--aimd-text-sm);
            }

            /* Content */
            .content {
                flex: 1;
                overflow-y: auto;
                padding: var(--aimd-space-4) var(--aimd-space-6);  /* 16px 24px */
            }

            .empty {
                text-align: center;
                padding: var(--aimd-space-15) var(--aimd-space-5);  /* 60px 20px */
                color: var(--aimd-text-tertiary);
                font-size: 15px;
            }

            /* Bookmark list */
            .bookmark-list {
                display: flex;
                flex-direction: column;
                gap: var(--aimd-space-2);  /* 8px */
            }

            .bookmark-item {
                padding: var(--aimd-space-2) var(--aimd-space-4);
                margin: var(--aimd-space-1) 3px;
                border: none;
                border-radius: var(--aimd-radius-lg);
                background: transparent; /* ✅ Match folder style (transparent) */
                cursor: pointer;
                transition: all var(--aimd-duration-base) var(--ease-out);
                
                min-height: 28px;
                
                /* ✅ Use standard tree item border (inherited from .tree-item) */
                /* border-bottom: 1px solid var(--aimd-border-default); REMOVED */
                /* box-shadow: var(--aimd-shadow-xs); REMOVED */
                
                display: flex;
                align-items: center;
                gap: var(--aimd-space-3);
                position: relative;
            }

            .bookmark-item:hover {
                background: var(--aimd-interactive-hover);
                /* border-bottom-color: var(--aimd-color-blue-200); REMOVED */
                /* box-shadow: var(--aimd-shadow-primary-sm); REMOVED */
                /* transform: translateY(-1px); REMOVED - Keep tree items stable */
            }

            .platform-badge {
                flex-shrink: 0;
                padding: var(--aimd-space-1) var(--aimd-space-2);  /* 4px 8px */
                border-radius: var(--aimd-radius-sm);
                font-size: 12px;
                font-weight: 500;
                min-width: 90px;
                text-align: center;
            }

            .platform-badge.chatgpt {
                background: var(--aimd-feedback-success-bg);
                color: var(--aimd-feedback-success-text);
            }

            .platform-badge.gemini {
                background: var(--aimd-feedback-info-bg);
                color: var(--aimd-feedback-info-text);
            }

            /* Delete Confirmation Modal Styles */
            .delete-confirmation-modal {
                background: var(--aimd-bg-primary);
                color: var(--aimd-text-primary);
                border-radius: var(--aimd-radius-xl);
                box-shadow: var(--aimd-shadow-2xl);
                min-width: 400px;
                max-width: 500px;
                width: 90%;
            }
            .modal-overlay {
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: var(--aimd-bg-overlay-heavy);
                z-index: var(--aimd-z-max);
                display: flex;
                align-items: center;
                justify-content: center;
            }
            .modal-content h3 {
                margin: 0 0 12px 0;
                font-size: 18px;
                font-weight: 600;
                color: var(--aimd-text-primary);  /* ✅ Dark mode */
            }
            .modal-content p {
                margin: 0 0 20px 0;
                color: var(--aimd-text-secondary);  /* ✅ Dark mode */
                line-height: 1.5;
            }
            .modal-actions {
                display: flex;
                gap: 12px;
                justify-content: flex-end;
            }
            .modal-btn {
                padding: 8px 16px;
                border-radius: var(--aimd-radius-md);
                border: none;
                cursor: pointer;
                font-size: var(--aimd-text-sm);
                font-weight: var(--aimd-font-medium);
                transition: all 0.2s;
            }
            .btn-cancel {
                background: var(--aimd-button-secondary-bg);
                color: var(--aimd-button-secondary-text);
            }
            .btn-cancel:hover {
                background: var(--aimd-button-secondary-hover);
                color: var(--aimd-button-secondary-text-hover);
                transform: translateY(-1px);
            }
            .btn-confirm {
                background: var(--aimd-interactive-danger);
                color: var(--aimd-text-on-danger);
            }
            .btn-confirm:hover {
                background: var(--aimd-interactive-danger-hover);
                transform: translateY(-1px);
            }

            .title {
                flex: 2;
                font-size: 14px;
                font-weight: 500;
                color: var(--aimd-text-primary);
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
            }

            .response {
                flex: 3;
                font-size: 13px;
                color: var(--aimd-text-tertiary);
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
            }

            .notes {
                flex: 1;
                font-size: 13px;
                color: var(--aimd-text-tertiary);
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
            }

            .time {
                flex-shrink: 0;
                font-size: 12px;
                color: var(--aimd-text-tertiary);
                min-width: 40px;
            }

            .actions {
                flex-shrink: 0;
                display: flex;
                gap: var(--aimd-space-1);  /* 4px */
            }

            .action-btn {
                width: 24px;
                height: 24px;
                border: none;
                background: transparent;
                border-radius: var(--aimd-radius-sm);
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 14px;
                transition: all 0.2s ease;
            }

            .action-btn:hover {
                background: var(--aimd-interactive-hover);
                transform: scale(1.1);
            }

            .delete-btn:hover {
                background: var(--aimd-feedback-danger-bg);
            }

            /* Settings content */
            .settings-content,
            .support-content {
                padding: var(--aimd-space-10);  /* 40px */
                text-align: center;
            }

            .settings-content h3,
            .support-content h3 {
                margin: 0 0 16px 0;
                font-size: 18px;
                color: var(--aimd-text-primary);
            }

            .settings-content p,
            .support-content p {
                color: var(--aimd-text-tertiary);
                margin: 0 0 24px 0;
            }
            /* Support button */
            .support-btn {
                display: inline-block;
                padding: var(--aimd-space-3) var(--aimd-space-6);
                background: var(--aimd-button-primary-bg);
                color: var(--aimd-button-primary-text);
                text-decoration: none;
                border-radius: var(--aimd-radius-lg);  /* Material Design 8px */
                font-weight: var(--aimd-font-medium);
                transition: all var(--aimd-duration-base);
                box-shadow: var(--aimd-shadow-sm);  /* Material Design elevation */
            }

            .support-btn:hover {
                background: var(--aimd-button-primary-hover);
                box-shadow: var(--aimd-shadow-md);  /* Material Design hover elevation */
                transform: translateY(-1px);
            }

            /* Conflict Dialog Styles */
            .conflict-dialog-overlay {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: var(--aimd-bg-overlay-heavy);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: var(--aimd-z-max);
            }

            .conflict-dialog {
                background: var(--aimd-bg-primary);  /* ✅ Theme-aware */
                border-radius: var(--aimd-radius-2xl);
                box-shadow: var(--aimd-shadow-xl);
                max-width: 500px;
                width: 90%;
                max-height: 80vh;
                overflow: hidden;
                display: flex;
                flex-direction: column;
            }

            .conflict-header {
                padding: var(--aimd-space-5) var(--aimd-space-6);  /* 20px 24px */
                border-bottom: 1px solid var(--aimd-border-default);
                background: var(--aimd-feedback-warning-bg);
            }

            .conflict-header h3 {
                margin: 0;
                font-size: 18px;
                font-weight: 600;
                color: var(--aimd-feedback-warning-text);
            }

            .conflict-body {
                padding: var(--aimd-space-6);  /* 24px */
                overflow-y: auto;
                flex: 1;
            }

            .conflict-body p {
                margin: 0 0 16px 0;
                color: var(--aimd-text-secondary);
                font-size: 14px;
            }

            .conflict-list {
                margin-top: 16px;
                border: 1px solid var(--aimd-border-default);
                border-radius: var(--aimd-radius-lg);
                overflow: hidden;
            }

            .conflict-item {
                padding: var(--aimd-space-3);  /* 12px */
                border-bottom: 1px solid var(--aimd-border-default);
                display: flex;
                align-items: center;
                gap: var(--aimd-space-3);  /* 12px */
            }

            .conflict-item:last-child {
                border-bottom: none;
            }

            .conflict-title {
                flex: 1;
                font-size: 13px;
                color: var(--aimd-text-secondary);
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
            }

            .conflict-more {
                padding: var(--aimd-space-3);  /* 12px */
                text-align: center;
                font-size: 13px;
                color: var(--aimd-text-tertiary);
                font-style: italic;
            }

            .conflict-footer {
                padding: var(--aimd-space-4) var(--aimd-space-6);  /* 16px 24px */
                border-top: 1px solid var(--aimd-border-default);
                display: flex;
                gap: var(--aimd-space-3);  /* 12px */
                justify-content: flex-end;
                background: var(--aimd-bg-secondary);
            }

            /* Generic toolbar buttons (excluding icon buttons) */
            .toolbar button:not(.toolbar-icon-btn):not(.platform-selector):not(.platform-filter) {
                padding: var(--aimd-space-2) var(--aimd-space-3);  /* 8px 12px */
                border: 1px solid var(--aimd-border-default);  /* Theme-aware */
                background: var(--aimd-bg-secondary);  /* Theme-aware */
                border-radius: var(--aimd-radius-md);
                font-size: var(--aimd-text-sm);
                cursor: pointer;
                transition: all 0.2s ease;
                display: inline-flex;
                align-items: center;
                justify-content: center;
                color: var(--aimd-text-primary);  /* Theme-aware */
            }

            .toolbar button:not(.toolbar-icon-btn):not(.platform-selector):not(.platform-filter):hover {
                background: var(--aimd-interactive-hover);  /* Theme-aware */
                border-color: var(--aimd-border-strong);  /* Theme-aware */
            }

            .toolbar button svg {
                display: block;
            }

            .merge-btn {
                background: var(--aimd-button-primary-bg);
                color: var(--aimd-button-primary-text);
            }

            .merge-btn:hover {
                background: var(--aimd-button-primary-hover);
                transform: translateY(-1px);
            }

            .cancel-btn {
                padding: 8px 16px;
                border: none;
                border-radius: var(--aimd-radius-sm);
                font-size: var(--aimd-text-sm);
                font-weight: var(--aimd-font-medium);
                cursor: pointer;
                transition: background 0.2s;
                background: var(--aimd-button-secondary-bg); 
                color: var(--aimd-button-secondary-text);
            }

            .cancel-btn:hover {
                background: var(--aimd-button-secondary-hover); 
                color: var(--aimd-button-secondary-text-hover);
                transform: translateY(-1px);
            }

            .delete-dialog-footer .delete-btn {
                padding: 8px 16px;
                border: none;
                border-radius: var(--aimd-radius-sm);
                background: var(--aimd-interactive-danger);
                color: var(--aimd-text-on-danger);
                font-size: var(--aimd-text-sm);
                font-weight: var(--aimd-font-medium);
                cursor: pointer;
                transition: background 0.2s;
            }

            .delete-dialog-footer .delete-btn:hover {
                background: var(--aimd-interactive-danger-hover);
                transform: translateY(-1px);
            }
            
            .confirm-btn {
                padding: 8px 16px;
                border: none;
                border-radius: var(--aimd-radius-lg);
                background: var(--aimd-button-primary-bg);
                color: var(--aimd-button-primary-text);
                font-size: var(--aimd-text-sm);
                font-weight: var(--aimd-font-medium);
                cursor: pointer;
                transition: all 0.2s;
            }
            
            .confirm-btn:hover {
                background: var(--aimd-button-primary-hover);
                transform: translateY(-1px);
            }

            .ok-btn {
                padding: 8px 16px;
                border: none;
                border-radius: var(--aimd-radius-lg);
                background: var(--aimd-button-primary-bg);
                color: var(--aimd-button-primary-text);
                font-size: var(--aimd-text-sm);
                font-weight: var(--aimd-font-medium);
                cursor: pointer;
                transition: all 0.2s;
            }

            .ok-btn:hover {
                background: var(--aimd-button-primary-hover);
                transform: translateY(-1px);
            }

            /* Import Summary Dialog */
            .import-summary-overlay {
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: var(--aimd-bg-overlay-heavy);
                z-index: var(--aimd-z-max);
                display: flex;
                align-items: center;
                justify-content: center;
                color-scheme: light dark;
            }

            .import-summary-modal {
                background: var(--aimd-bg-primary);
                color: var(--aimd-text-primary);
                border-radius: var(--aimd-radius-xl);
                box-shadow: var(--aimd-shadow-xl);
                max-width: 450px;
                width: 90%;
                padding: 24px;
            }

            .import-summary-title {
                margin: 0 0 16px 0;
                font-size: 18px;
                font-weight: var(--aimd-font-medium);
                color: var(--aimd-text-primary);
            }

            .import-summary-content {
                font-size: 14px;
                color: var(--aimd-text-primary);
                line-height: 1.6;
            }

            .import-summary-text {
                margin: 0 0 12px 0;
            }

            .import-summary-list {
                margin: 0 0 16px 0;
                padding-left: 24px;
            }

            .import-summary-warning {
                background: var(--aimd-feedback-warning-bg);
                border-left: 3px solid var(--aimd-feedback-warning-text);
                padding: 12px;
                border-radius: var(--aimd-radius-lg);
                margin-bottom: 16px;
            }

            .import-summary-warning-title {
                font-weight: var(--aimd-font-medium);
                color: var(--aimd-feedback-warning-text);
                margin-bottom: 4px;
            }

            .import-summary-warning-text {
                color: var(--aimd-feedback-warning-text);
                font-size: 13px;
            }

            .import-summary-footer {
                display: flex;
                justify-content: flex-end;
                gap: var(--aimd-space-2);
                margin-top: 20px;
            }

            .proceed-btn {
                padding: 8px 16px;
                border: none;
                border-radius: var(--aimd-radius-lg);
                background: var(--aimd-button-primary-bg);
                color: var(--aimd-button-primary-text);
                font-size: 14px;
                font-weight: var(--aimd-font-medium);
                cursor: pointer;
                transition: all 0.2s;
            }

            .proceed-btn:hover {
                background: var(--aimd-button-primary-hover);
                transform: translateY(-1px);
            }

            /* Duplicate Bookmarks Dialog */
            .duplicate-dialog-content {
                padding: 20px;
            }

            .duplicate-dialog-header {
                display: flex;
                align-items: center;
                gap: 12px;
                margin-bottom: 14px;
            }

            .duplicate-dialog-icon {
                color: var(--aimd-feedback-warning-text);
                font-size: 24px;
                line-height: 1;
                flex-shrink: 0;
            }

            .duplicate-dialog-title {
                margin: 0;
                font-size: 20px;
                font-weight: var(--aimd-font-medium);
                color: var(--aimd-text-primary);
                line-height: 1.2;
            }

            .duplicate-dialog-body {
                color: var(--aimd-text-primary);
                font-size: 14px;
                line-height: 1.5;
            }

            .duplicate-dialog-text {
                margin: 0 0 10px 0;
            }

            .duplicate-list-container {
                background: var(--aimd-bg-tertiary);
                border-radius: var(--aimd-radius-lg);
                padding: 12px;
                margin-bottom: 14px;
                max-height: 300px;
                overflow-y: auto;
            }

            .duplicate-list-item {
                display: flex;
                align-items: center;
                gap: 8px;
                padding: 6px 0;
                border-bottom: 1px solid var(--aimd-border-subtle);
            }

            .duplicate-list-item:last-child {
                border-bottom: none;
            }

            .duplicate-platform-badge {
                flex-shrink: 0;
                padding: 3px 8px;
                border-radius: var(--aimd-radius-sm);
                font-size: 12px;
                font-weight: var(--aimd-font-semibold);
            }

            .duplicate-platform-badge.platform-chatgpt {
                background: var(--aimd-platform-chatgpt-bg);
                color: var(--aimd-platform-chatgpt-text);
            }

            .duplicate-platform-badge.platform-gemini {
                background: var(--aimd-platform-gemini-bg);
                color: var(--aimd-platform-gemini-text);
            }

            .duplicate-bookmark-title {
                flex: 1;
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
                color: var(--aimd-text-primary);
            }

            .duplicate-highlight {
                color: var(--aimd-interactive-primary);
            }

            .duplicate-dialog-hint {
                margin: 6px 0 0 0;
                color: var(--aimd-text-secondary);
                font-size: 13px;
                font-style: italic;
                opacity: 0.9;
            }

            /* Merge Dialog (Import Preview) Styles */
            .duplicate-dialog-overlay {
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: var(--aimd-bg-overlay-heavy);
                z-index: var(--aimd-z-max);
                display: flex;
                align-items: center;
                justify-content: center;
                color-scheme: light dark;
            }

            .duplicate-dialog-modal {
                background: var(--aimd-bg-primary);
                color: var(--aimd-text-primary);
                border-radius: var(--aimd-radius-xl);
                box-shadow: var(--aimd-modal-shadow);
                max-width: 500px;
                width: 90%;
                max-height: 80vh;
                overflow-y: auto;
                z-index: var(--aimd-z-modal);
                font-family: var(--aimd-font-sans);
            }

            .merge-summary {
                display: grid;
                grid-template-columns: repeat(3, minmax(0, 1fr));
                gap: 8px;
                margin-bottom: 12px;
            }

            .merge-summary-item {
                background: var(--aimd-bg-secondary);
                border-radius: var(--aimd-radius-lg);
                padding: 8px 10px;
            }

            .merge-summary-label {
                font-size: 12px;
                color: var(--aimd-text-secondary);
                display: block;
            }

            .merge-summary-value {
                font-size: 16px;
                font-weight: var(--aimd-font-semibold);
                color: var(--aimd-text-primary);
            }

            .merge-list-container {
                border: 1px solid var(--aimd-border-subtle);
                border-radius: var(--aimd-radius-lg);
                max-height: 320px;
                overflow-y: auto;
            }

            .merge-list-item {
                padding: 10px 12px;
                border-bottom: 1px solid var(--aimd-border-subtle);
                display: flex;
                flex-direction: column;
                gap: 4px;
            }

            .merge-list-item:last-child {
                border-bottom: none;
            }

            .merge-item-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                gap: 12px;
            }

            .merge-item-title {
                font-weight: var(--aimd-font-medium);
                color: var(--aimd-text-primary);
                word-break: break-word;
            }

            .merge-item-path {
                font-size: 12px;
                color: var(--aimd-text-secondary);
                word-break: break-word;
            }

            .merge-item-path-label {
                margin-right: 6px;
                color: var(--aimd-text-secondary);
                font-weight: var(--aimd-font-medium);
            }

            .merge-item-rename {
                font-size: 12px;
                color: var(--aimd-interactive-danger);
            }

            .merge-badge {
                font-size: 12px;
                padding: 2px 6px;
                border-radius: 999px;
                font-weight: var(--aimd-font-medium);
                white-space: nowrap;
            }

            .merge-badge-normal {
                background: var(--aimd-feedback-success-bg);
                color: var(--aimd-feedback-success-text);
            }

            .merge-badge-rename {
                background: var(--aimd-feedback-warning-bg);
                color: var(--aimd-feedback-warning-text);
            }

            .merge-badge-import {
                background: var(--aimd-feedback-info-bg);
                color: var(--aimd-interactive-primary-hover);
            }

            .import-summary-footer {
                padding: 12px 16px;
                display: flex;
                justify-content: flex-end;
                gap: 8px;
                border-top: 1px solid var(--aimd-border-default);
            }

            .cancel-btn {
                padding: 8px 16px;
                border: none;
                border-radius: var(--aimd-radius-md);
                background: var(--aimd-bg-secondary);
                color: var(--aimd-text-primary);
                font-size: var(--aimd-text-sm);
                font-weight: var(--aimd-font-medium);
                cursor: pointer;
                transition: all 0.2s;
            }

            .cancel-btn:hover {
                background: var(--aimd-interactive-hover);
                transform: translateY(-1px);
            }

            .merge-btn {
                padding: 8px 16px;
                border: none;
                border-radius: var(--aimd-radius-md);
                background: var(--aimd-button-primary-bg);
                color: var(--aimd-button-primary-text);
                font-size: var(--aimd-text-sm);
                font-weight: var(--aimd-font-medium);
                cursor: pointer;
                transition: all 0.2s;
            }

            .merge-btn:hover {
                background: var(--aimd-button-primary-hover);
                transform: translateY(-1px);
            }

            /* Info Dialog */
            .info-dialog-content {
                padding: 24px 24px 20px;
            }

            .info-dialog-header {
                display: flex;
                align-items: center;
                gap: var(--aimd-space-3);
                margin-bottom: 16px;
            }

            .info-dialog-icon {
                display: flex;
                align-items: center;
            }

            .info-dialog-title {
                margin: 0;
                font-size: 18px;
                font-weight: var(--aimd-font-medium);
                color: var(--aimd-text-primary);
            }

            .info-dialog-message {
                color: var(--aimd-text-primary);
                font-size: 14px;
                line-height: 1.6;
                white-space: pre-wrap;
            }

            .info-dialog-footer {
                padding: 12px 24px;
                display: flex;
                justify-content: flex-end;
                border-top: 1px solid var(--aimd-border-default);
            }

            /* Delete Confirmation Dialog */
            .delete-dialog-content {
                padding: 20px;
            }

            .delete-dialog-header {
                display: flex;
                align-items: center;
                gap: 12px;
                margin-bottom: 14px;
            }

            .delete-dialog-icon {
                color: var(--aimd-feedback-warning-text);
                font-size: 24px;
                line-height: 1;
                flex-shrink: 0;
            }

            .delete-dialog-title {
                margin: 0;
                font-size: 20px;
                font-weight: var(--aimd-font-medium);
                color: var(--aimd-text-primary);
                line-height: 1.2;
            }

            .delete-dialog-body {
                color: var(--aimd-text-secondary);
                font-size: 14px;
                line-height: 1.5;
            }

            .delete-dialog-text {
                margin: 0 0 12px 0;
            }

            .delete-dialog-list {
                margin: 0;
                padding-left: 24px;
                list-style: none;
            }

            .delete-dialog-list-item {
                margin-bottom: 6px;
                display: flex;
                align-items: center;
                gap: 8px;
            }

            .delete-dialog-list-icon {
                flex-shrink: 0;
            }

            .delete-dialog-warning {
                margin: 12px 0 0 0;
                font-weight: var(--aimd-font-medium);
                color: var(--aimd-feedback-danger-text);
            }

            .delete-dialog-footer {
                padding: 12px 16px;
                display: flex;
                justify-content: flex-end;
                gap: 8px;
                border-top: 1px solid var(--aimd-border-default);
            }

            /* Error Dialog */
            .error-dialog-content {
                padding: 24px 24px 20px;
            }

            .error-dialog-header {
                display: flex;
                align-items: center;
                gap: var(--aimd-space-4);
                margin-bottom: 16px;
            }

            .error-dialog-title {
                margin: 0;
                font-size: 20px;
                font-weight: var(--aimd-font-medium);
                color: var(--aimd-text-primary);
            }

            .error-dialog-body {
                color: var(--aimd-text-primary);
                font-size: 14px;
                line-height: 1.5;
            }

            .error-dialog-text {
                margin: 0 0 12px 0;
            }

            .error-list-container {
                max-height: 300px;
                overflow-y: auto;
                background: var(--aimd-bg-tertiary);
                border-radius: var(--aimd-radius-sm);
                padding: 12px;
            }

            .error-list {
                margin: 0;
                padding-left: 20px;
            }

            .error-list-item {
                margin-bottom: 8px;
            }

            .error-dialog-footer {
                padding: 8px;
                display: flex;
                justify-content: flex-end;
                border-top: 1px solid var(--aimd-border-default);
            }

            /* Export Options Dialog */
            .export-dialog-overlay {
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: var(--aimd-bg-overlay-heavy);
                z-index: var(--aimd-z-max);
                display: flex;
                align-items: center;
                justify-content: center;
                color-scheme: light dark;
            }

            .export-dialog-modal {
                background: var(--aimd-bg-primary);
                color: var(--aimd-text-primary);
                border-radius: var(--aimd-radius-xl);
                box-shadow: var(--aimd-shadow-xl);
                max-width: 500px;
                width: 90%;
            }

            .export-dialog-content {
                padding: 24px;
            }

            .export-dialog-title {
                margin: 0 0 16px 0;
                font-size: 18px;
                font-weight: var(--aimd-font-medium);
                color: var(--aimd-text-primary);
            }

            .export-dialog-body {
                margin-bottom: 20px;
                color: var(--aimd-text-primary);
                font-size: 14px;
                line-height: 1.5;
            }

            .export-dialog-text {
                margin: 0 0 12px 0;
            }

            .export-options-container {
                display: flex;
                flex-direction: column;
                gap: 12px;
            }

            .export-option {
                display: flex;
                align-items: center;
                gap: 12px;
                padding: 12px;
                border: 1px solid var(--aimd-border-default);
                border-radius: var(--aimd-radius-xl);
                cursor: pointer;
                transition: all 0.2s;
            }

            .export-option:hover {
                border-color: var(--aimd-interactive-primary);
                background: var(--aimd-interactive-hover);
            }

            .export-option-radio {
                width: 16px;
                height: 16px;
                cursor: pointer;
            }

            .export-option-label {
                font-weight: var(--aimd-font-medium);
                color: var(--aimd-text-primary);
            }

            .export-option-desc {
                font-size: 12px;
                color: var(--aimd-text-secondary);
                opacity: 0.9;
            }

            .export-dialog-footer {
                display: flex;
                gap: 12px;
                justify-content: flex-end;
            }

            /* Detail Modal - Modern & Clean */
            .detail-modal-overlay {
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: var(--aimd-bg-overlay-heavy);
                backdrop-filter: blur(8px);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: var(--aimd-z-max);
                animation: overlayFadeIn 0.2s ease;
            }

            @keyframes overlayFadeIn {
                from { opacity: 0; }
                to { opacity: 1; }
            }

            .detail-modal {
                background: var(--aimd-bg-primary);
                border-radius: var(--aimd-radius-2xl);
                width: 90%;
                max-width: 800px;
                max-height: 85vh;
                display: flex;
                flex-direction: column;
                box-shadow: var(--aimd-modal-shadow);
                position: relative;
                z-index: var(--aimd-z-max);
                animation: modalSlideIn 0.3s cubic-bezier(0.16, 1, 0.3, 1);
            }

            @keyframes modalSlideIn {
                from {
                    opacity: 0;
                    transform: scale(0.95) translateY(20px);
                }
                to {
                    opacity: 1;
                    transform: scale(1) translateY(0);
                }
            }

            .detail-modal-fullscreen {
                width: 100vw !important;
                max-width: none !important;
                height: 100vh !important;
                max-height: none !important;
                border-radius: 0 !important;
            }

            .detail-modal-fullscreen .detail-content {
                max-width: 1000px;
                margin: 0 auto;
            }

            .detail-header {
                padding: 16px 24px;
                border-bottom: 1px solid var(--aimd-border-default);
                display: flex;
                justify-content: space-between;
                align-items: center;
                flex-shrink: 0;
            }

            .detail-header h3 {
                margin: 0;
                font-size: 18px;
                font-weight: 600;
                color: var(--aimd-text-primary);
                letter-spacing: -0.02em;
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
                flex: 1;
                padding-right: 16px;
            }

            .detail-header-actions {
                display: flex;
                gap: 8px;
            }

            .fullscreen-btn,
            .detail-header .close-btn {
                width: 32px;
                height: 32px;
                border-radius: var(--aimd-radius-lg);
                border: none;
                background: transparent;
                color: var(--aimd-text-secondary);
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
                transition: all 0.15s ease;
                font-size: 20px;
            }

            .fullscreen-btn:hover,
            .detail-header .close-btn:hover {
                background: var(--aimd-bg-secondary);
                color: var(--aimd-text-primary);
            }

            .detail-meta {
                padding: 10px 24px;
                background: var(--aimd-bg-tertiary);
                display: flex;
                justify-content: space-between;
                align-items: center;
                border-bottom: 1px solid var(--aimd-border-default);
                flex-shrink: 0;
                gap: 16px;
                height: 44px;
                overflow: hidden;
            }

            .detail-meta-left {
                display: inline-flex;
                align-items: center;
                gap: 8px;
                flex-shrink: 0;
            }

            .detail-meta .platform-badge {
                display: inline-flex;
                align-items: center;
                gap: 6px;
                padding: 4px 10px;
                border-radius: var(--aimd-radius-md);
                font-size: 13px;
                font-weight: 500;
                white-space: nowrap;
                flex-shrink: 0;
            }

            .detail-meta .platform-badge.chatgpt {
                background: var(--aimd-feedback-success-bg);
                color: var(--aimd-feedback-success-text);
            }

            .detail-meta .platform-badge.gemini {
                background: var(--aimd-feedback-info-bg);
                color: var(--aimd-feedback-info-text);
            }

            .detail-meta-right {
                font-size: 13px;
                color: var(--aimd-text-secondary);
                white-space: nowrap;
                flex-shrink: 0;
            }

            .detail-content {
                flex: 1;
                overflow-y: auto;
                padding: 0;
            }

            .detail-section {
                padding: 28px;
                border-bottom: 1px solid var(--aimd-border-subtle);
            }

            .detail-section:last-child {
                border-bottom: none;
            }

            .user-section {
                background: var(--aimd-feedback-info-bg);
                border-left: 3px solid var(--aimd-interactive-primary);
            }

            .ai-section {
                background: var(--aimd-feedback-success-bg);
                border-left: 3px solid var(--aimd-feedback-success-text);
            }

            .section-header {
                display: flex;
                align-items: center;
                gap: 10px;
                margin-bottom: 16px;
            }

            .section-header svg {
                color: var(--aimd-text-secondary);
                flex-shrink: 0;
            }

            .section-header h4 {
                margin: 0;
                font-size: 14px;
                font-weight: 600;
                color: var(--aimd-text-secondary);
                text-transform: uppercase;
                letter-spacing: 0.05em;
            }

            .detail-text {
                font-size: 15px;
                line-height: 1.7;
                color: var(--aimd-text-primary);
            }

            .detail-footer {
                padding: 10px 24px;
                border-top: 1px solid var(--aimd-border-default);
                display: flex;
                justify-content: flex-end;
                background: var(--aimd-bg-primary);
                flex-shrink: 0;
                border-radius: 0 0 var(--aimd-radius-2xl) var(--aimd-radius-2xl);
                min-height: 44px;
            }

            .open-conversation-btn {
                padding: 8px 20px;
                background: var(--aimd-button-primary-bg);
                color: var(--aimd-button-primary-text);
                border: none;
                border-radius: var(--aimd-radius-lg);
                font-size: var(--aimd-text-sm);
                font-weight: var(--aimd-font-medium);
                cursor: pointer;
                transition: all 0.15s ease;
            }

            .open-conversation-btn:hover {
                background: var(--aimd-button-primary-hover);
                box-shadow: var(--aimd-shadow-sm);
                transform: translateY(-1px);
            }

            /* ============================================================================
               Batch Actions Bar (Gmail-style)
               ============================================================================ */
            
            .batch-actions-bar {
                position: fixed;
                bottom: -1px;  /* ✅ Hide completely, no white line */
                left: 140px;
                right: 0;
                margin: 0 var(--aimd-space-3) var(--aimd-space-3) var(--aimd-space-3);
                padding: var(--aimd-space-4) var(--aimd-space-5);
                
                /* ✅ Elevated card style with rounded corners */
                background: var(--aimd-bg-glass);
                backdrop-filter: blur(20px) saturate(180%);
                -webkit-backdrop-filter: blur(20px) saturate(180%);
                border-radius: var(--aimd-radius-lg);
                
                /* ✅ Prominent elevation shadow (no border) */
                box-shadow: var(--aimd-shadow-lg);
                
                display: flex;
                align-items: center;
                gap: var(--aimd-space-3);
                z-index: 100;
                transform: translateY(calc(100% + var(--aimd-space-3) + 1px));  /* ✅ Extra 1px */
                transition: transform 0.4s cubic-bezier(0.4, 0, 0.2, 1);
            }

            .batch-actions-bar.visible {
                transform: translateY(0);
            }

            .batch-actions-bar .selected-count {
                font-size: 14px;
                font-weight: 500;
                color: var(--aimd-text-primary);  /* ✅ Theme-aware */
                margin-right: auto;
                white-space: nowrap;
            }

            .batch-actions-bar button {
                display: inline-flex;
                align-items: center;
                justify-content: center;
                gap: var(--aimd-space-2);
                
                /* ✅ Match toolbar button style */
                padding: var(--aimd-space-2) var(--aimd-space-3);
                background: transparent;
                border: none;
                border-radius: var(--aimd-radius-sm);
                
                cursor: pointer;
                transition: all var(--aimd-duration-fast);
                
                font-size: var(--aimd-text-sm);
                font-weight: var(--aimd-font-medium);
                color: var(--aimd-text-primary);
                white-space: nowrap;
            }

            .batch-actions-bar button:hover {
                background: var(--aimd-interactive-hover);  /* ✅ More visible hover */
                color: var(--aimd-interactive-primary);  /* ✅ Blue accent on hover */
                transform: scale(1.02);
            }

            .batch-actions-bar button:active {
                transform: translateY(0);
            }

            .batch-actions-bar button svg {
                width: 20px;
                height: 20px;
            }

            .batch-actions-bar button.danger {
                color: var(--aimd-interactive-danger);
            }

            .batch-actions-bar button.danger:hover {
                background: var(--aimd-feedback-danger-bg);
                border-color: var(--aimd-feedback-danger-bg);
            }
            
            .bookmarks-tab .content {
                padding-bottom: 70px;
            }

            /* ============================================================================
               Tree View Styles
               ============================================================================ */

            /* Tree Container */
            .content {
                flex: 1;
                overflow-y: auto;
                overflow-x: hidden;
                padding: var(--aimd-space-2);  /* 添加padding避免阴影被截断 */
            }

            .tree-view {
                flex: 1;
                overflow-y: auto;
                overflow-x: hidden;
                padding: var(--aimd-space-2) var(--aimd-space-3);  /* Add padding to prevent background overflow */
                /* No background - inherit from parent */
            }

            /* Custom Scrollbar (macOS-style) */
            .tree-view::-webkit-scrollbar {
                width: 8px;
            }

            .tree-view::-webkit-scrollbar-track {
                background: transparent;
            }

            .tree-view::-webkit-scrollbar-thumb {
                background: var(--aimd-scrollbar-thumb);
                border-radius: var(--aimd-radius-sm);
            }

            .tree-view::-webkit-scrollbar-thumb:hover {
                background: var(--aimd-scrollbar-thumb-hover);
            }

            /* Tree Item Base styles - MERGED into Line 4059 to avoid cascade conflicts */

            .batch-action-btn {
                display: inline-flex;
                align-items: center;
                justify-content: center;
                gap: var(--aimd-space-2);
                padding: var(--aimd-space-2) var(--aimd-space-4);
                background: var(--aimd-bg-primary);
                border: 1px solid var(--aimd-border-default);
                border-radius: var(--aimd-radius-lg);
                cursor: pointer;
                transition: all var(--aimd-duration-base);
                font-size: var(--aimd-text-sm);
                color: var(--aimd-text-primary);
                line-height: 1;  /* 移除额外的行高 */
            }

            .batch-action-btn svg {
                flex-shrink: 0;  /* 防止图标被压缩 */
            }

            .tree-item:hover {
                background: var(--aimd-interactive-hover);
            }

            .tree-item:focus {
                outline: 2px solid var(--aimd-border-focus);
                outline-offset: -2px;
                z-index: 1;
            }

            .tree-item:focus:not(:focus-visible) {
                outline: none;
            }

            /* ===================================================================
               FOLDER STYLES - Modernized per design_system.md
               - Clean backgrounds with subtle hover states
               - Use box-shadow for selection instead of border
               - Dark mode compatible (uses CSS variables, not hardcoded colors)
               =================================================================== */
            .folder-item {
                font-weight: var(--aimd-font-medium);  /* 500 */
                background: transparent;  /* Clean by default */
                transition: all var(--aimd-duration-fast);  /* 150ms */
            }

            .folder-item:hover {
                background: var(--aimd-interactive-hover);  /* Subtle hover - theme-aware */
            }

            .folder-item.selected {
                background: var(--aimd-interactive-selected);
                color: var(--aimd-text-primary);
                /* Left accent bar instead of full border */
                box-shadow: inset 3px 0 0 var(--aimd-interactive-primary);
            }

            .folder-item.is-editing:hover {
                background: transparent;
            }

            .folder-toggle {
                display: inline-flex;
                align-items: center;
                justify-content: center;
                width: 16px;
                height: 16px;
                font-size: 10px;
                color: var(--aimd-text-tertiary);
                cursor: pointer;
                user-select: none;
                flex-shrink: 0;
                transition: transform 0.15s ease;
                transform: rotate(0deg);
            }

            .folder-toggle.expanded {
                transform: rotate(90deg);
            }

            .folder-toggle:hover {
                color: var(--aimd-text-primary);
            }

            .folder-icon {
                font-size: 16px;
                margin-right: 8px;
            }

            .folder-name {
                flex: 1;
                font-weight: var(--aimd-font-medium);
                color: var(--aimd-text-primary);
                display: flex;
                align-items: center;  /* 图标和文字垂直居中对齐 */
                gap: var(--aimd-space-2);  /* 8px */
                line-height: 20px;  /* 匹配图标高度,确保完美对齐 */
                user-select: none;
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
            }

            .folder-name svg {
                flex-shrink: 0;  /* 防止图标被压缩 */
                display: block;  /* 移除inline默认的baseline对齐 */
                vertical-align: middle;  /* 确保垂直居中 */
            }
            
            .folder-count {
                margin-left: 6px;
                font-size: 12px;
                color: var(--aimd-text-tertiary);
                font-weight: 400;
                user-select: none;
            }

            .folder-item.is-editing .item-actions {
                display: none;
            }

            .inline-edit-wrapper {
                flex: 1;
                display: flex;
                flex-direction: column;
                gap: var(--aimd-space-1);
                min-width: 0;
            }

            .inline-edit-row {
                display: flex;
                align-items: center;
                gap: var(--aimd-space-2);
                min-width: 0;
            }

            .inline-edit-input {
                flex: 1;
                min-width: 0;
                padding: 2px 6px;
                border: 1px solid var(--aimd-border-default);
                border-radius: var(--aimd-radius-xs);
                font-size: var(--aimd-text-base);
                font-family: inherit;
                background: var(--aimd-bg-primary);
                color: var(--aimd-text-primary);
                outline: none;
                line-height: 1.4;
            }

            .inline-edit-input:focus {
                border-color: var(--aimd-text-link);
                box-shadow: var(--aimd-shadow-focus);
            }

            .inline-edit-input.error {
                border-color: var(--aimd-interactive-danger);
                box-shadow: var(--aimd-shadow-error);
            }

            .inline-edit-actions {
                display: inline-flex;
                gap: var(--aimd-space-1);
                flex-shrink: 0;
            }

            .inline-edit-btn {
                width: 24px;
                height: 24px;
                border: 1px solid var(--aimd-border-default);
                border-radius: var(--aimd-radius-sm);
                background: var(--aimd-bg-primary);
                color: var(--aimd-text-primary);
                cursor: pointer;
                display: inline-flex;
                align-items: center;
                justify-content: center;
                padding: 0;
                transition: all var(--aimd-duration-fast);
            }

            .inline-edit-btn:hover {
                background: var(--aimd-interactive-hover);
                transform: translateY(-1px);
            }

            .inline-edit-confirm {
                border-color: var(--aimd-feedback-success-text);
                color: var(--aimd-feedback-success-text);
            }

            .inline-edit-confirm:hover {
                background: var(--aimd-feedback-success-bg);
            }

            .inline-edit-cancel {
                border-color: var(--aimd-feedback-danger-bg);
                color: var(--aimd-interactive-danger);
            }

            .inline-edit-cancel:hover {
                background: var(--aimd-feedback-danger-bg);
            }

            .inline-edit-btn:disabled {
                opacity: 0.45;
                cursor: not-allowed;
                transform: none;
            }

            .inline-edit-error {
                font-size: 12px;
                color: var(--aimd-interactive-danger);
                line-height: 1.2;
            }

            .inline-edit-suggestion {
                display: none;
                align-items: center;
                gap: var(--aimd-space-2);
                font-size: 12px;
                color: var(--aimd-interactive-danger);
            }

            .inline-edit-suggestion-text {
                color: var(--aimd-interactive-danger);
            }

            .inline-edit-suggestion-value {
                color: var(--aimd-text-primary);
                font-weight: var(--aimd-font-medium);
            }

            .inline-edit-auto-rename {
                padding: 2px 8px;
                border-radius: var(--aimd-radius-md);
                border: 1px solid var(--aimd-interactive-selected);
                background: var(--aimd-interactive-selected);
                color: var(--aimd-interactive-primary-hover);
                font-size: 12px;
                cursor: pointer;
                transition: all var(--aimd-duration-fast);
            }

            .inline-edit-auto-rename:hover {
                background: var(--aimd-feedback-info-bg);
                transform: translateY(-1px);
            }

            .inline-edit-auto-rename:disabled {
                opacity: 0.5;
                cursor: not-allowed;
                transform: none;
            }

            /* VSCode-style folder children visibility */
            .folder-children {
                overflow: hidden;
            }

            /* Hide children when folder is collapsed */
            .folder-item[aria-expanded="false"] + .folder-children {
                display: none;
            }

            /* Show children when folder is expanded */
            .folder-item[aria-expanded="true"] + .folder-children {
                display: block;
            }


            /* Bookmark Styles - REMOVED DUPLICATE that was overriding --md-surface with --white */

            .platform-icon {
                font-size: 16px;
                margin-right: 8px;
                flex-shrink: 0;
            }

            .bookmark-title {
                flex: 1;
                font-size: 14px;
                color: var(--aimd-text-primary);
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
                padding-right: 220px; /* Reserve space for timestamp + actions */
            }

            .bookmark-timestamp {
                position: absolute;
                right: 120px; /* Space for action buttons */
                font-size: 11px;
                color: var(--aimd-text-tertiary);
                pointer-events: none;
                white-space: nowrap;
            }

            /* Checkboxes - Deep Blue */
            .item-checkbox {
                margin-right: 8px;
                cursor: pointer;
                width: 16px;
                height: 16px;
                flex-shrink: 0;
                accent-color: var(--aimd-text-link);  /* 深蓝色 */
            }

            .item-checkbox:focus {
                outline: 2px solid var(--aimd-border-focus);
                outline-offset: 2px;
            }

            /* Action Buttons */
            .item-actions {
                display: none;  /* 默认隐藏 */
                position: absolute;  /* 绝对定位,不影响高度 */
                right: var(--aimd-space-3);
                top: 50%;
                transform: translateY(-50%);
                gap: var(--aimd-space-1);
                align-items: center;
            }

            .tree-item:hover .item-actions {
                display: flex;
            }

            .tree-item.is-editing:hover .item-actions {
                display: none;
            }

            .action-btn {
                width: 28px;
                height: 28px;
                border: none;
                background: transparent;
                cursor: pointer;
                border-radius: var(--aimd-radius-sm);
                font-size: 14px;
                transition: background-color 0.15s ease;
                display: flex;
                align-items: center;
                justify-content: center;
                padding: 0;
            }

            .action-btn:hover {
                background: var(--aimd-bg-hint);
            }

            .action-btn:focus {
                outline: 2px solid var(--aimd-border-focus);
                outline-offset: -2px;
            }

            .action-btn.delete-folder:hover,
            .action-btn.delete-bookmark:hover {
                background: var(--aimd-feedback-danger-bg);
                color: var(--aimd-interactive-danger);
            }

            /* Empty State */
            .tree-empty {
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                padding: var(--aimd-space-16) var(--aimd-space-8);  /* 64px 32px */
                text-align: center;
                color: var(--aimd-text-tertiary);
            }

            .empty-icon {
                font-size: 48px;
                margin-bottom: 16px;
                opacity: 0.5;
            }

            .tree-empty h3 {
                margin: 0 0 8px 0;
                font-size: 16px;
                font-weight: 600;
                color: var(--aimd-text-primary);
            }

            .tree-empty p {
                margin: 0 0 24px 0;
                font-size: 14px;
                color: var(--aimd-text-secondary);
            }
            .btn-primary,
            .create-first-folder {
                padding: var(--aimd-space-2) var(--aimd-space-5);
                background: var(--aimd-interactive-primary);
                color: var(--aimd-text-on-primary);
                border: none;
                border-radius: var(--aimd-radius-lg);  /* Material Design 8px */
                cursor: pointer;
                font-weight: var(--aimd-font-medium);
                font-size: 14px;
                transition: all var(--aimd-duration-base);
                box-shadow: var(--aimd-shadow-sm);  /* Material Design elevation */
                display: inline-flex;
                align-items: center;
                gap: 6px;
            }

            .btn-primary:hover,
            .create-first-folder:hover {
                background: var(--aimd-interactive-primary-hover);
                box-shadow: var(--aimd-shadow-md);  /* Material Design hover elevation */
                transform: translateY(-1px);
            }

            /* Responsive & Accessibility */
            @media (prefers-reduced-motion: reduce) {
                .tree-item,
                .action-btn,
                .create-first-folder {
                    transition: none;
                }
            }

            @media (prefers-contrast: high) {
                .tree-item {
                    border: 1px solid transparent;
                }
                
                .tree-item:hover {
                    border-color: currentColor;
                }
                
                .tree-item.selected {
                background: var(--aimd-interactive-selected);
                color: var(--aimd-text-primary);
                border-radius: var(--aimd-radius-lg);
                font-weight: var(--aimd-font-medium);
                box-shadow: var(--aimd-shadow-sm);  /* 与Tab选中一致的阴影 */
            }    }
            }

            /* Loading State */
            .tab-icon {
                display: flex;
                align-items: center;
                justify-content: center;
            }

            .tab-icon svg {
                width: 20px;  /* 放大图标 */
                height: 20px;
                flex-shrink: 0;
            }    padding: var(--aimd-space-10);  /* 40px */
                color: var(--aimd-text-secondary);
            }

            .tree-loading::before {
                content: '⏳';
                font-size: 24px;
                margin-right: 8px;
                animation: spin 1s linear infinite;
            }

            @keyframes spin {
                from { transform: rotate(0deg); }
                to { transform: rotate(360deg); }
            }

            /* Fade in animation for tree items */
            @keyframes fadeIn {
                from {
                    opacity: 0;
                    transform: translateY(-4px);
                }
                to {
                    opacity: 1;
                    transform: translateY(0);
                }
            }

            .tree-item {
                animation: fadeIn 0.2s ease-out;
            }

        `;
    }
}

// Singleton instance
export const simpleBookmarkPanel = new SimpleBookmarkPanel();
