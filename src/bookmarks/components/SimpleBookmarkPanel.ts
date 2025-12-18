
import { SimpleBookmarkStorage } from '../storage/SimpleBookmarkStorage';
import { Bookmark, Folder, FolderTreeNode } from '../storage/types';
import { logger } from '../../utils/logger';
import { FolderStorage } from '../storage/FolderStorage';
import { FolderState } from '../state/FolderState';
import { FolderOperationsManager } from '../managers/FolderOperationsManager';
import { TreeBuilder } from '../utils/tree-builder';
import { PathUtils } from '../utils/path-utils';
import { Icons } from '../../assets/icons';
import { MarkdownRenderer } from '../../utils/markdown-renderer';



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
        this.overlay.style.zIndex = '2147483647'; // Maximum z-index
        this.overlay.style.display = 'flex';
        this.overlay.style.alignItems = 'center';
        this.overlay.style.justifyContent = 'center';
        this.overlay.style.background = 'rgba(0, 0, 0, 0.5)';

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

        // 4. Remove DOM
        if (this.overlay && this.overlay.parentNode) {
            this.overlay.remove();
        }

        // 5. Clear references
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
                    <span class="tab-label">Buy Me a Coffee</span>
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
                                ${Icons.grid}
                                <span class="platform-selector-label">All Platforms</span>
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
                        <h3>${Icons.coffee} Buy Me a Coffee</h3>
                        <p>If you find this extension helpful, consider supporting the development!</p>
                        <a href="https://www.buymeacoffee.com/yourusername" target="_blank" class="support-btn">
                            Support Development
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
     * Get platform icon
     */
    private getPlatformIcon(platform: string): string {
        switch (platform.toLowerCase()) {
            case 'chatgpt':
                return Icons.chatgpt;
            case 'gemini':
                return Icons.gemini;
            default:
                return Icons.chatgpt;
        }
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
     * Truncate text
     */
    private truncate(text: string, maxLength: number): string {
        if (text.length <= maxLength) return text;
        return text.substring(0, maxLength) + '...';
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
        // Reload both folders and bookmarks
        this.folders = await FolderStorage.getAll();
        this.bookmarks = await SimpleBookmarkStorage.getAllBookmarks();
        this.filterBookmarks();
        logger.debug(`[SimpleBookmarkPanel] Refreshed: ${this.folders.length} folders, ${this.bookmarks.length} bookmarks`);

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

                    // 更新选中状态
                    this.platformFilter = value;

                    // 更新按钮显示
                    const selectorLabel = platformSelector.querySelector('.platform-selector-label');
                    if (selectorLabel) {
                        selectorLabel.textContent = label;
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
                // Don't toggle if clicking checkbox or action buttons
                if (target.classList.contains('item-checkbox') ||
                    target.closest('.item-actions')) {
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

                const url = (item as HTMLElement).dataset.url!;
                const position = parseInt((item as HTMLElement).dataset.position!);
                if (url && position) {
                    this.showDetailModal(url, position);
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
        // For root level creation, we'll use a temporary placeholder in the tree
        // For now, use prompt as a quick implementation
        // TODO: Implement inline creation in tree view
        const name = prompt('Enter folder name:');
        if (!name) return;

        // Validate name
        if (name.length > 50) {
            await this.showNotification({
                type: 'error',
                title: 'Invalid Folder Name',
                message: 'Folder name must be 50 characters or less'
            });
            return;
        }

        if (name.includes('/')) {
            await this.showNotification({
                type: 'error',
                title: 'Invalid Folder Name',
                message: 'Folder name cannot contain "/"'
            });
            return;
        }

        this.handleCreateFolder(parentPath, name);
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

        // Create input element
        const input = document.createElement('input');
        input.type = 'text';
        input.value = originalName;
        input.className = 'inline-edit-input';
        input.style.cssText = `
            width: 100%;
            padding: 2px 6px;
            border: 1px solid var(--primary-600);
            border-radius: var(--radius-extra-small);
            font-size: var(--text-base);
            font-family: inherit;
            outline: none;
            box-shadow: var(--shadow-focus);
        `;

        // Replace name span with input
        const parent = nameSpan.parentElement;
        if (!parent) return;

        parent.replaceChild(input, nameSpan);
        input.focus();
        input.select();

        // Handle save
        const saveEdit = async () => {
            const newName = input.value.trim();

            // Restore original if unchanged or empty
            if (!newName || newName === originalName) {
                parent.replaceChild(nameSpan, input);
                return;
            }

            // Validate
            if (newName.length > 50) {
                await this.showNotification({
                    type: 'error',
                    title: 'Invalid Folder Name',
                    message: 'Folder name must be 50 characters or less'
                });
                input.focus();
                return;
            }

            if (newName.includes('/')) {
                await this.showNotification({
                    type: 'error',
                    title: 'Invalid Folder Name',
                    message: 'Folder name cannot contain "/"'
                });
                input.focus();
                return;
            }

            // Save
            await this.handleRenameFolder(path, newName);
        };

        // Handle cancel
        const cancelEdit = () => {
            parent.replaceChild(nameSpan, input);
        };

        // Event listeners
        input.addEventListener('blur', saveEdit);
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                saveEdit();
            } else if (e.key === 'Escape') {
                e.preventDefault();
                cancelEdit();
            }
        });
    }

    private async handleRenameFolder(path: string, newName: string): Promise<void> {
        const result = await this.folderOpsManager.renameFolder(path, newName);

        if (result.success) {
            this.folders = await FolderStorage.getAll();
            this.bookmarks = await SimpleBookmarkStorage.getAllBookmarks();

            await this.refreshTreeView();
            logger.info(`[Folder] Renamed: ${path} -> ${newName}`);
        } else {
            await this.showNotification({
                type: 'error',
                title: 'Failed to Rename',
                message: `Failed to rename folder: ${result.error}`
            });
            logger.error(`[Folder] Rename failed:`, result.error);
        }
    }

    private async handleDeleteFolder(path: string): Promise<void> {
        const hasBookmarks = this.bookmarks.some(b =>
            b.folderPath === path || b.folderPath?.startsWith(path + '/')
        );

        const hasSubfolders = this.folders.some(f =>
            f.path.startsWith(path + '/')
        );

        if (hasBookmarks || hasSubfolders) {
            await this.showNotification({
                type: 'error',
                title: 'Folder Not Empty',
                message: 'Please remove all items before deleting folder'
            });
            return;
        }

        if (!confirm(`Delete folder "${path}"?`)) {
            return;
        }

        const result = await this.folderOpsManager.deleteFolder(path);

        if (result.success) {
            this.folders = await FolderStorage.getAll();
            await this.refreshTreeView();
            logger.info(`[Folder] Deleted: ${path}`);
        } else {
            await this.showNotification({
                type: 'error',
                title: 'Failed to Delete',
                message: `Failed to delete folder: ${result.error}`
            });
            logger.error(`[Folder] Delete failed:`, result.error);
        }
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
     * Show detail modal
     */
    /**
     * Show detail modal (CRITICAL: Uses re-render logic for Markdown rendering)
     */
    private showDetailModal(url: string, position: number): void {
        const bookmark = this.filteredBookmarks.find(
            b => b.url === url && b.position === position
        );

        if (!bookmark) return;

        // CRITICAL: Inject markdown styles into Shadow DOM
        // Shadow DOM cannot access styles from document.head, so we must inject them directly
        if (this.shadowRoot) {
            MarkdownRenderer.injectShadowStyles(this.shadowRoot);
        }

        // Render markdown using MarkdownRenderer utility
        const userMessageHtml = MarkdownRenderer.render(bookmark.userMessage);
        const aiResponseHtml = bookmark.aiResponse
            ? MarkdownRenderer.render(bookmark.aiResponse)
            : '';

        const modalOverlay = document.createElement('div');
        modalOverlay.className = 'detail-modal-overlay';

        const modal = document.createElement('div');
        modal.className = 'detail-modal';

        // CRITICAL: Stop propagation on modal to prevent closing main panel
        modal.addEventListener('click', (e) => {
            e.stopPropagation();
        });

        // Format absolute date
        const date = new Date(bookmark.timestamp);
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sept', 'Oct', 'Nov', 'Dec'];
        const formattedDate = `${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()}`;

        modal.innerHTML = `
            <div class="detail-header">
                <h3>${this.escapeHtml(bookmark.title || bookmark.userMessage.substring(0, 50))}</h3>
                <div class="detail-header-actions">
                    <button class="fullscreen-btn" title="Toggle fullscreen">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"></path>
                        </svg>
                    </button>
                    <button class="close-btn" title="Close">×</button>
                </div>
            </div>

            <div class="detail-meta">
                <div class="detail-meta-left">
                    <span class="platform-badge ${bookmark.platform?.toLowerCase() || 'chatgpt'}">
                        ${this.getPlatformIcon(bookmark.platform)} ${bookmark.platform || 'ChatGPT'}
                    </span>
                </div>
                <div class="detail-meta-right">
                    Saved date: ${formattedDate}
                </div>
            </div>

            <div class="detail-content">
                <div class="detail-section user-section">
                    <div class="section-header">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                            <circle cx="12" cy="7" r="4"></circle>
                        </svg>
                        <h4>User Prompt</h4>
                    </div>
                    <div class="detail-text markdown-content">${userMessageHtml}</div>
                </div>

                ${bookmark.aiResponse ? `
                    <div class="detail-section ai-section">
                        <div class="section-header">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M12 2L2 7l10 5 10-5-10-5z"></path>
                                <path d="M2 17l10 5 10-5M2 12l10 5 10-5"></path>
                            </svg>
                            <h4>AI Response</h4>
                        </div>
                        <div class="detail-text markdown-content">${aiResponseHtml}</div>
                    </div>
                ` : ''}
            </div>

            <div class="detail-footer">
                <button class="open-conversation-btn" data-url="${this.escapeHtml(bookmark.url)}">
                    Open in Conversation
                </button>
            </div>
        `;


        modalOverlay.appendChild(modal);

        // Add to shadow root
        this.shadowRoot?.appendChild(modalOverlay);

        // Bind events
        modal.querySelector('.close-btn')?.addEventListener('click', () => {
            modalOverlay.remove();
        });

        modal.querySelector('.fullscreen-btn')?.addEventListener('click', () => {
            modal.classList.toggle('detail-modal-fullscreen');
        });

        modal.querySelector('.open-conversation-btn')?.addEventListener('click', async () => {
            modalOverlay.remove();
            await this.handleGoTo(bookmark.url, bookmark.position);
        });

        // Click on overlay background (not modal) closes only the detail modal
        // CRITICAL: Stop propagation to prevent closing main panel
        modalOverlay.addEventListener('click', (e) => {
            e.stopPropagation(); // Prevent bubbling to main panel overlay
            if (e.target === modalOverlay) {
                modalOverlay.remove();
            }
        });

        // Add ESC key handler for detail modal
        const detailEscHandler = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                // Check if modal still exists (not already removed)
                if (modalOverlay.parentNode) {
                    e.stopPropagation(); // Prevent main panel from closing
                    modalOverlay.remove();
                }
                // Always remove the handler
                document.removeEventListener('keydown', detailEscHandler);
            }
        };
        document.addEventListener('keydown', detailEscHandler);
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
        const confirmed = confirm(
            `Delete bookmark "${bookmark.title || bookmark.userMessage.substring(0, 50)}"?\n\n` +
            `Tip: You can export your bookmarks first to create a backup.`
        );

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
    }): Promise<void> {
        return new Promise((resolve) => {
            const configs = {
                success: {
                    icon: Icons.checkCircle,
                    iconColor: 'var(--success-600)',
                    titleColor: 'var(--success-700)',
                    defaultTitle: 'Success'
                },
                error: {
                    icon: Icons.xCircle,
                    iconColor: 'var(--danger-600)',
                    titleColor: 'var(--danger-700)',
                    defaultTitle: 'Error'
                },
                warning: {
                    icon: Icons.alertTriangle,
                    iconColor: 'var(--warning-600)',
                    titleColor: 'var(--warning-700)',
                    defaultTitle: 'Warning'
                },
                info: {
                    icon: Icons.info,
                    iconColor: 'var(--primary-600)',
                    titleColor: 'var(--primary-700)',
                    defaultTitle: 'Information'
                }
            };

            const config = configs[options.type];
            const title = options.title || config.defaultTitle;

            // Dark mode detection
            const isDark = document.documentElement.classList.contains('dark');
            const bgColor = isDark ? 'var(--gray-800)' : 'white';
            const textColor = isDark ? 'var(--gray-400)' : 'var(--gray-700)';
            const borderColor = isDark ? 'var(--gray-700)' : 'var(--gray-200)';

            const overlay = document.createElement('div');
            overlay.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: rgba(0, 0, 0, 0.5) !important;
                z-index: 2147483647;
                display: flex;
                align-items: center;
                justify-content: center;
                color-scheme: light dark;
            `;

            const modal = document.createElement('div');
            modal.style.cssText = `
                background: ${bgColor};
                border-radius: var(--radius-medium);
                box-shadow: var(--shadow-2xl);
                max-width: 400px;
                width: 90%;
            `;

            modal.innerHTML = `
<div style="padding: 24px 24px 20px;">
    <div style="display: flex; align-items: center; gap: var(--space-3); margin-bottom: 16px;">
        <span style="color: ${config.iconColor}; display: flex; align-items: center;">${config.icon}</span>
        <h3 style="margin: 0; font-size: 18px; font-weight: 500; color: ${config.titleColor};">
            ${title}
        </h3>
    </div>
    <div style="color: ${textColor}; font-size: 14px; line-height: 1.6; white-space: pre-wrap;">
${options.message}
    </div>
</div>
<div style="padding: 12px 24px; display: flex; justify-content: flex-end; border-top: 1px solid ${borderColor};">
    <button class="ok-btn" style="
        padding: 8px 24px;
        border: none;
        border-radius: var(--radius-small);
        background: var(--primary-600);
        color: white;
        font-size: 14px;
        font-weight: 500;
        cursor: pointer;
        transition: background 0.2s;
    ">OK</button>
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
                okBtn.style.background = 'var(--primary-700)';
            });
            okBtn.addEventListener('mouseleave', () => {
                okBtn.style.background = 'var(--primary-600)';
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
            overlay.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: rgba(0, 0, 0, 0.5) !important;
                z-index: 2147483647;
                display: flex;
                align-items: center;
                justify-content: center;
                color-scheme: light dark;
            `;

            const modal = document.createElement('div');
            modal.className = 'delete-confirmation-modal';
            modal.style.cssText = `
                background: white;
                border-radius: var(--radius-medium);
                box-shadow: var(--shadow-2xl);
                max-width: 400px;
                width: 90%;
            `;

            // Add dark mode styles
            const isDark = document.documentElement.classList.contains('dark');
            if (isDark) {
                modal.style.background = 'var(--gray-800)';
                modal.style.borderColor = 'var(--gray-700)';
            }

            const titleColor = isDark ? 'var(--gray-50)' : 'var(--gray-900)';
            const textColor = isDark ? 'var(--gray-400)' : 'var(--gray-500)';
            const borderColor = isDark ? 'var(--gray-700)' : 'var(--gray-200)';

            modal.innerHTML = `
            <div style="padding: 24px 24px 20px;">
                <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 16px;">
                    <span style="color: var(--warning-600); font-size: 24px; line-height: 1; flex-shrink: 0;">${Icons.alertTriangle}</span>
                    <h3 style="margin: 0; font-size: 20px; font-weight: 500; color: ${titleColor}; line-height: 1.2;">Delete Selected Items</h3>
                </div>
                <div style="color: ${textColor}; font-size: 14px; line-height: 1.5;">
                    <p style="margin: 0 0 16px 0;">This will permanently delete:</p>
                    <ul style="margin: 0; padding-left: 24px; list-style: none;">
                        ${analysis.folders.length > 0 ? `<li style="margin-bottom: 8px; display: flex; align-items: center; gap: 8px;"><span style="flex-shrink: 0;">${Icons.folder}</span><span>${analysis.folders.length} root folder${analysis.folders.length > 1 ? 's' : ''}</span></li>` : ''}
                        ${analysis.subfolders.length > 0 ? `<li style="margin-bottom: 8px; display: flex; align-items: center; gap: 8px;"><span style="flex-shrink: 0;">${Icons.folder}</span><span>${analysis.subfolders.length} subfolder${analysis.subfolders.length > 1 ? 's' : ''}</span></li>` : ''}
                        ${analysis.bookmarks.length > 0 ? `<li style="margin-bottom: 8px; display: flex; align-items: center; gap: 8px;"><span style="flex-shrink: 0;">${Icons.bookmark}</span><span>${analysis.bookmarks.length} bookmark${analysis.bookmarks.length > 1 ? 's' : ''}</span></li>` : ''}
                    </ul>
                    <p style="margin: 16px 0 0 0; font-weight: 500; color: var(--danger-600);">
                        This action cannot be undone.
                    </p>
                </div>
            </div>
            <div style="padding: 12px 16px; display: flex; justify-content: flex-end; gap: 8px; border-top: 1px solid ${borderColor};">
                <button class="cancel-btn" style="
                    padding: 8px 16px;
                    border: none;
                    border-radius: 4px;
                    background: transparent;
                    color: var(--primary-600);
                    font-size: 14px;
                    font-weight: 500;
                    cursor: pointer;
                    transition: background 0.2s;
                ">Cancel</button>
                <button class="delete-btn" style="
                    padding: 8px 16px;
                    border: none;
                    border-radius: 4px;
                    background: var(--danger-600);
                    color: white;
                    font-size: 14px;
                    font-weight: 500;
                    cursor: pointer;
                    transition: background 0.2s;
                ">Delete</button>
            </div>
        `;

            overlay.appendChild(modal);

            // CRITICAL: Append to Shadow DOM instead of document.body
            if (this.shadowRoot) {
                this.shadowRoot.appendChild(overlay);
            }

            const cancelBtn = modal.querySelector('.cancel-btn') as HTMLElement;
            const deleteBtn = modal.querySelector('.delete-btn') as HTMLElement;

            cancelBtn.addEventListener('mouseenter', () => {
                cancelBtn.style.background = 'var(--gray-100)';
            });
            cancelBtn.addEventListener('mouseleave', () => {
                cancelBtn.style.background = 'transparent';
            });

            deleteBtn.addEventListener('mouseenter', () => {
                deleteBtn.style.background = 'var(--danger-700)';
            });
            deleteBtn.addEventListener('mouseleave', () => {
                deleteBtn.style.background = 'var(--danger-600)';
            });

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
     * Task 3.4.4
     */
    private async executeBatchDelete(analysis: {
        folders: Folder[];
        subfolders: Folder[];
        bookmarks: Bookmark[];
    }): Promise<void> {
        const errors: string[] = [];

        // Step 1: Delete all bookmarks first
        logger.info(`[Batch Delete] Deleting ${analysis.bookmarks.length} bookmarks...`);
        for (const bookmark of analysis.bookmarks) {
            try {
                await SimpleBookmarkStorage.remove(
                    bookmark.urlWithoutProtocol,
                    bookmark.position
                );
            } catch (error) {
                errors.push(`Failed to delete bookmark: ${bookmark.title}`);
                logger.error('[Batch Delete] Bookmark error:', error);
            }
        }

        // Step 2: Delete folders (deepest first)
        const allFolders = [...analysis.folders, ...analysis.subfolders];
        const sortedFolders = allFolders.sort((a, b) => b.depth - a.depth);

        logger.info(`[Batch Delete] Deleting ${sortedFolders.length} folders (deepest first)...`);
        for (const folder of sortedFolders) {
            try {
                await FolderStorage.delete(folder.path);
            } catch (error) {
                errors.push(`Failed to delete folder: ${folder.name}`);
                logger.error('[Batch Delete] Folder error:', error);
            }
        }

        // Step 3: Show results
        if (errors.length > 0) {
            this.showErrorSummary(errors);
        } else {
            const totalDeleted = analysis.bookmarks.length + sortedFolders.length;
            logger.info(`[Batch Delete] Successfully deleted ${totalDeleted} items`);
        }

        // Step 4: Cleanup
        this.selectedItems.clear();
        await this.refresh();
    }

    /**
     * Show error summary modal
     * Task 3.4.5
     */
    private showErrorSummary(errors: string[]): void {
        // Dark mode detection
        const isDark = document.documentElement.classList.contains('dark');
        const bgColor = isDark ? 'var(--gray-800)' : 'white';
        const titleColor = isDark ? 'var(--gray-50)' : 'var(--gray-900)';
        const textColor = isDark ? 'var(--gray-400)' : 'var(--gray-500)';
        const borderColor = isDark ? 'var(--gray-700)' : 'var(--gray-200)';
        const listBg = isDark ? 'var(--gray-900)' : 'var(--gray-50)';

        const overlay = document.createElement('div');
        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.5);
            z-index: 2147483647;
            display: flex;
            align-items: center;
            justify-content: center;
        `;

        const modal = document.createElement('div');
        modal.style.cssText = `
            background: ${bgColor};
            border-radius: var(--radius-medium);
            box-shadow: var(--shadow-2xl);
            max-width: 500px;
            width: 90%;
            max-height: 80vh;
            display: flex;
            flex-direction: column;
        `;

        modal.innerHTML = `
            <div style="padding: 24px 24px 20px;">
                <div style="display: flex; align-items: center; gap: var(--space-4);  /* 16px */ margin-bottom: 16px;">
                    <span class="warning-icon">${Icons.alertTriangle}</span>
                    <h3 style="margin: 0; font-size: 20px; font-weight: 500; color: ${titleColor};">
                        Deletion Completed with Errors
                    </h3>
                </div>
                <div style="color: ${textColor}; font-size: 14px; line-height: 1.5;">
                    <p style="margin: 0 0 12px 0;">
                        Completed with <strong>${errors.length}</strong> error${errors.length > 1 ? 's' : ''}:
                    </p>
                    <div style="
                        max-height: 300px;
                        overflow-y: auto;
                        background: ${listBg};
                        border-radius: 4px;
                        padding: 12px;
                    ">
                        <ul style="margin: 0; padding-left: 20px;">
                            ${errors.map(err => `<li style="margin-bottom: 8px;">${err}</li>`).join('')}
                        </ul>
                    </div>
                </div>
            </div>
            <div style="padding: 8px; display: flex; justify-content: flex-end; border-top: 1px solid ${borderColor};">
                <button class="ok-btn" style="
                    padding: 8px 24px;
                    border: none;
                    border-radius: 4px;
                    background: var(--primary-600);
                    color: white;
                    font-size: 14px;
                    font-weight: 500;
                    cursor: pointer;
                    transition: background 0.2s;
                ">OK</button>
            </div>
        `;

        overlay.appendChild(modal);

        // CRITICAL: Append to Shadow DOM instead of document.body
        if (this.shadowRoot) {
            this.shadowRoot.appendChild(overlay);
        }

        const okBtn = modal.querySelector('.ok-btn') as HTMLElement;
        okBtn.addEventListener('mouseenter', () => {
            okBtn.style.background = 'var(--primary-700)';
        });
        okBtn.addEventListener('mouseleave', () => {
            okBtn.style.background = 'var(--primary-600)';
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
        // Dark mode detection
        const isDark = document.documentElement.classList.contains('dark');
        const bgColor = isDark ? 'var(--gray-800)' : 'white';
        const titleColor = isDark ? 'var(--gray-50)' : 'var(--gray-900)';
        const textColor = isDark ? 'var(--gray-400)' : 'var(--gray-500)';

        return new Promise((resolve) => {
            const overlay = document.createElement('div');
            overlay.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: rgba(0, 0, 0, 0.5) !important;
                z-index: 2147483647;
                display: flex;
                align-items: center;
                justify-content: center;
                color-scheme: light dark;
            `;

            const modal = document.createElement('div');
            modal.style.cssText = `
                background: ${bgColor};
                border-radius: var(--radius-medium);
                box-shadow: var(--shadow-2xl);
                max-width: 400px;
                width: 90%;
                padding: 24px;
            `;

            modal.innerHTML = `
                <h3 style="margin: 0 0 16px 0; font-size: 18px; font-weight: 500; color: ${titleColor};">
                    导出选项
                </h3>
                <div style="margin-bottom: 24px;">
                    <label style="display: flex; align-items: center; cursor: pointer; user-select: none;">
                        <input type="checkbox" id="preserve-structure" checked 
                               style="margin-right: 8px; width: 18px; height: 18px; cursor: pointer;">
                        <span style="font-size: 14px; color: ${textColor};">
                            同时保留文件夹结构
                        </span>
                    </label>
                </div>
                <div style="display: flex; justify-content: flex-end; gap: var(--space-2);">
                    <div class="batch-actions-bar">
                        <span class="selected-count">0 selected</span>
                        <div style="display: flex; gap: 8px;">
                            <button class="batch-delete-btn" title="Delete selected items">
                                ${Icons.trash}
                                <span>Delete</span>
                            </button>
                            <button class="batch-move-btn" title="Move to folder">
                                ${Icons.folder}
                                <span>Move To</span>
                            </button>
                            <button class="batch-export-btn" title="Export selected">
                                ${Icons.download}
                                <span>Export</span>
                            </button>
                            <button class="batch-clear-btn" title="Clear selection">
                                ${Icons.x}
                                <span>Clear</span>
                            </button>
                        </div>
                    </div>
                    <button class="cancel-btn" style="
                        padding: 8px 16px;
                        border: 1px solid var(--gray-300);
                        border-radius: 4px;
                        background: white;
                        color: var(--gray-500);
                        font-size: 14px;
                        font-weight: 500;
                        cursor: pointer;
                        transition: background 0.2s;
                    ">取消</button>
                    <button class="export-btn" style="
                        padding: 8px 16px;
                        border: none;
                        border-radius: 4px;
                        background: var(--primary-600);
                        color: white;
                        font-size: 14px;
                        font-weight: 500;
                        cursor: pointer;
                        transition: background 0.2s;
                    ">导出</button>
                </div>
            `;

            overlay.appendChild(modal);

            // CRITICAL: Append to Shadow DOM instead of document.body
            if (this.shadowRoot) {
                this.shadowRoot.appendChild(overlay);
            }

            const checkbox = modal.querySelector('#preserve-structure') as HTMLInputElement;
            const cancelBtn = modal.querySelector('.cancel-btn') as HTMLElement;
            const exportBtn = modal.querySelector('.export-btn') as HTMLElement;

            // Hover effects using CSS variables
            cancelBtn.addEventListener('mouseenter', () => {
                cancelBtn.style.background = 'var(--gray-100)';
            });
            cancelBtn.addEventListener('mouseleave', () => {
                cancelBtn.style.background = 'white';
            });

            exportBtn.addEventListener('mouseenter', () => {
                exportBtn.style.background = 'var(--primary-700)';
            });
            exportBtn.addEventListener('mouseleave', () => {
                exportBtn.style.background = 'var(--primary-600)';
            });

            cancelBtn.addEventListener('click', () => {
                overlay.remove();
                resolve(null); // Cancelled
            });

            exportBtn.addEventListener('click', () => {
                const preserveStructure = checkbox.checked;
                overlay.remove();
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
                // Read file
                const text = await file.text();
                const data = JSON.parse(text);

                // Validate data
                const bookmarks = this.validateImportData(data);
                logger.info(`[Import] Validated ${bookmarks.length} bookmarks`);

                // Analyze import data for folder path issues (Issue 2)
                const analysis = this.analyzeImportData(bookmarks);

                // Show summary if there are folder path issues
                if (analysis.noFolder.length > 0 || analysis.tooDeep.length > 0) {
                    const shouldProceed = await this.showImportSummary(analysis);
                    if (!shouldProceed) {
                        logger.info('[Import] User cancelled import');
                        return;
                    }

                    // Adjust folder paths for problematic bookmarks
                    analysis.noFolder.forEach(b => b.folderPath = 'Import');
                    analysis.tooDeep.forEach(b => b.folderPath = 'Import');
                }

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

                // Detect conflicts
                const conflicts = await this.detectConflicts(allBookmarks);

                // Handle conflicts if any
                if (conflicts.length > 0) {
                    const shouldMerge = await this.showConflictDialog(conflicts, allBookmarks);
                    if (!shouldMerge) {
                        logger.info('[Import] User cancelled import');
                        return;
                    }
                }

                // Import all bookmarks (merge will overwrite duplicates)
                await this.importBookmarks(allBookmarks, false);

                // Refresh panel
                await this.refresh();

                // Show success message with info about Import folder if used
                let message = `Successfully imported ${bookmarks.length} bookmark(s)!`;
                if (analysis.noFolder.length > 0 || analysis.tooDeep.length > 0) {
                    const importCount = analysis.noFolder.length + analysis.tooDeep.length;
                    message += `\n\n${importCount} bookmark(s) without valid folder paths were placed in "Import" folder.`;
                }

                await this.showNotification({
                    type: 'success',
                    title: 'Import Successful',
                    message
                });
                logger.info(`[Import] Successfully imported ${bookmarks.length} bookmarks`);
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
     * Show import summary dialog
     * Issue 2: Display summary and ask for confirmation
     */
    private async showImportSummary(analysis: {
        valid: Bookmark[];
        noFolder: Bookmark[];
        tooDeep: Bookmark[];
    }): Promise<boolean> {
        // Dark mode detection
        const isDark = document.documentElement.classList.contains('dark');
        const bgColor = isDark ? 'var(--gray-800)' : 'white';
        const titleColor = isDark ? 'var(--gray-50)' : 'var(--gray-900)';
        const textColor = isDark ? 'var(--gray-400)' : 'var(--gray-500)';

        return new Promise((resolve) => {
            const overlay = document.createElement('div');
            overlay.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: rgba(0, 0, 0, 0.5) !important;
                z-index: 2147483647;
                display: flex;
                align-items: center;
                justify-content: center;
                color-scheme: light dark;
            `;

            const modal = document.createElement('div');
            modal.style.cssText = `
                background: ${bgColor};
                border-radius: var(--radius-medium);
                box-shadow: var(--shadow-2xl);
                max-width: 450px;
                width: 90%;
                padding: 24px;
            `;

            const totalIssues = analysis.noFolder.length + analysis.tooDeep.length;

            modal.innerHTML = `
                <h3 style="margin: 0 0 16px 0; font-size: 18px; font-weight: 500; color: ${titleColor};">
                    📥 导入摘要
                </h3>
                <div style="font-size: 14px; color: ${textColor}; line-height: 1.6;">
                    <p style="margin: 0 0 12px 0;">
                        准备导入 <strong>${analysis.valid.length + analysis.noFolder.length + analysis.tooDeep.length}</strong> 个书签：
                    </p>
                    <ul style="margin: 0 0 16px 0; padding-left: 24px;">
                        <li>${Icons.check} ${analysis.valid.length} 个书签将正常导入</li>
                        ${analysis.noFolder.length > 0 ? `<li>${Icons.folder} ${analysis.noFolder.length} 个书签无文件夹 → 将导入到 <strong>Import</strong> 文件夹</li>` : ''}
                        ${analysis.tooDeep.length > 0 ? `<li>${Icons.folder} ${analysis.tooDeep.length} 个书签文件夹层级过深 → 将导入到 <strong>Import</strong> 文件夹</li>` : ''}
                    </ul>
                    ${totalIssues > 0 ? `
                        <div style="background: var(--warning-100); border-left: 3px solid var(--warning-500); padding: 12px; border-radius: 4px; margin-bottom: 16px;">
                            <div style="font-weight: 500; color: var(--warning-800); margin-bottom: 4px;">ℹ️ 注意</div>
                            <div style="color: var(--warning-800); font-size: 13px;">
                                ${analysis.noFolder.length + analysis.tooDeep.length} 个书签将自动归类到 Import 文件夹
                            </div>
                        </div>
                    ` : ''}
                </div>
                <div style="display: flex; justify-content: flex-end; gap: var(--space-2);  /* 8px */ margin-top: 20px;">
                    <button class="cancel-btn" style="
                        padding: 8px 16px;
                        border: 1px solid var(--gray-300);
                        border-radius: 4px;
                        background: white;
                        color: var(--gray-500);
                        font-size: 14px;
                        font-weight: 500;
                        cursor: pointer;
                        transition: background 0.2s;
                    ">取消</button>
                    <button class="proceed-btn" style="
                        padding: 8px 16px;
                        border: none;
                        border-radius: 4px;
                        background: var(--primary-600);
                        color: white;
                        font-size: 14px;
                        font-weight: 500;
                        cursor: pointer;
                        transition: background 0.2s;
                    ">继续导入</button>
                </div>
            `;

            overlay.appendChild(modal);

            // CRITICAL: Append to Shadow DOM instead of document.body
            if (this.shadowRoot) {
                this.shadowRoot.appendChild(overlay);
            }

            const cancelBtn = modal.querySelector('.cancel-btn') as HTMLElement;
            const proceedBtn = modal.querySelector('.proceed-btn') as HTMLElement;

            // Hover effects
            cancelBtn.addEventListener('mouseenter', () => {
                cancelBtn.style.background = 'var(--gray-100)';
            });
            cancelBtn.addEventListener('mouseleave', () => {
                cancelBtn.style.background = 'white';
            });

            proceedBtn.addEventListener('mouseenter', () => {
                proceedBtn.style.background = 'var(--primary-700)';
            });
            proceedBtn.addEventListener('mouseleave', () => {
                proceedBtn.style.background = 'var(--primary-600)';
            });

            cancelBtn.addEventListener('click', () => {
                overlay.remove();
                resolve(false);
            });

            proceedBtn.addEventListener('click', () => {
                overlay.remove();
                resolve(true);
            });

            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) {
                    overlay.remove();
                    resolve(false);
                }
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
            if (SimpleBookmarkStorage.validateBookmark(item)) {
                validBookmarks.push(item);
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
     * Detect conflicts (existing bookmarks with same url+position)
     */
    private async detectConflicts(bookmarks: Bookmark[]): Promise<Bookmark[]> {
        const conflicts: Bookmark[] = [];

        for (const bookmark of bookmarks) {
            const exists = await SimpleBookmarkStorage.isBookmarked(
                bookmark.url,
                bookmark.position
            );

            if (exists) {
                conflicts.push(bookmark);
            }
        }

        return conflicts;
    }

    /**
     * Show conflict resolution dialog
     * Returns: true (merge) or false (cancel)
     */
    private async showConflictDialog(
        conflicts: Bookmark[],
        allBookmarks: Bookmark[]
    ): Promise<boolean> {
        // Dark mode detection
        const isDark = document.documentElement.classList.contains('dark');
        const bgColor = isDark ? 'var(--gray-800)' : 'white';
        const titleColor = isDark ? 'var(--gray-50)' : '#111827';
        const textColor = isDark ? 'var(--gray-400)' : '#6b7280';
        const strongColor = isDark ? 'var(--gray-50)' : '#111827';
        const listBg = isDark ? 'var(--gray-900)' : '#f9fafb';
        const borderColor = isDark ? 'var(--gray-700)' : '#e5e7eb';

        return new Promise((resolve) => {
            const overlay = document.createElement('div');
            overlay.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: rgba(0, 0, 0, 0.5) !important;
                z-index: 2147483647;
                display: flex;
                align-items: center;
                justify-content: center;
                color-scheme: light dark;
            `;

            const modal = document.createElement('div');
            modal.style.cssText = `
                background: ${bgColor};
                color: ${textColor};
                border-radius: 12px;
                box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
                max-width: 500px;
                width: 90%;
            `;

            modal.innerHTML = `
            <div style="padding: 24px 24px 20px;">
                <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 16px;">
                    <span style="color: #d97706; font-size: 24px; line-height: 1; flex-shrink: 0;">${Icons.alertTriangle}</span>
                    <h3 style="margin: 0; font-size: 20px; font-weight: 500; color: ${titleColor}; line-height: 1.2;">Duplicate Bookmarks Detected</h3>
                </div>
                <div style="color: ${textColor}; font-size: 14px; line-height: 1.5;">
                    <p style="margin: 0 0 12px 0;">Found <strong style="color: ${strongColor};">${conflicts.length}</strong> bookmark(s) that already exist.</p>
                    <p style="margin: 0 0 16px 0;">Total bookmarks to import: <strong style="color: ${strongColor};">${allBookmarks.length}</strong></p>
                    
                    <div style="background: ${listBg}; border-radius: 8px; padding: 12px; margin-bottom: 16px; max-height: 300px; overflow-y: auto;">
                        ${conflicts.map(b => `
                            <div style="display: flex; align-items: center; gap: 8px; padding: 6px 0; border-bottom: 1px solid ${borderColor};">
                                <span style="flex-shrink: 0; padding: 2px 8px; background: ${b.platform?.toLowerCase() === 'gemini' ? '#dbeafe' : '#d1fae5'}; color: ${b.platform?.toLowerCase() === 'gemini' ? '#1d4ed8' : '#047857'}; border-radius: 4px; font-size: 12px; font-weight: 500;">
                                    ${b.platform || 'ChatGPT'}
                                </span>
                                <span style="flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: #374151;">
                                    ${this.escapeHtml(this.truncate(b.title || b.userMessage, 40))}
                                </span>
                            </div>
                        `).join('')}
                    </div>
                    
                    <p style="margin: 0 0 8px 0; color: #4b5563;">Click <strong style="color: #2563eb;">Merge</strong> to import all bookmarks (duplicates will be overwritten).</p>
                    <p style="margin: 0; color: #6b7280; font-size: 13px; font-style: italic;">💡 Items without folders will be imported to the <strong>Import</strong> folder.</p>
                </div>
            </div>
            <div style="padding: 12px 16px; display: flex; justify-content: flex-end; gap: 8px; border-top: 1px solid #e5e7eb;">
                <button class="cancel-btn" style="
                    padding: 8px 16px;
                    border: none;
                    border-radius: 4px;
                    background: transparent;
                    color: #2563eb;
                    font-size: 14px;
                    font-weight: 500;
                    cursor: pointer;
                    transition: background 0.2s;
                ">Cancel</button>
                <button class="merge-btn" style="
                    padding: 8px 16px;
                    border: none;
                    border-radius: 4px;
                    background: #2563eb;
                    color: white;
                    font-size: 14px;
                    font-weight: 500;
                    cursor: pointer;
                    transition: background 0.2s;
                ">Merge</button>
            </div>
        `;

            overlay.appendChild(modal);

            // CRITICAL: Append to document.body instead of shadowRoot for proper z-index
            document.body.appendChild(overlay);

            const cancelBtn = modal.querySelector('.cancel-btn') as HTMLElement;
            const mergeBtn = modal.querySelector('.merge-btn') as HTMLElement;

            cancelBtn.addEventListener('mouseenter', () => {
                cancelBtn.style.background = '#f3f4f6';
            });
            cancelBtn.addEventListener('mouseleave', () => {
                cancelBtn.style.background = 'transparent';
            });

            mergeBtn.addEventListener('mouseenter', () => {
                mergeBtn.style.background = '#1d4ed8';
            });
            mergeBtn.addEventListener('mouseleave', () => {
                mergeBtn.style.background = '#2563eb';
            });

            cancelBtn.addEventListener('click', () => {
                overlay.remove();
                resolve(false);
            });

            mergeBtn.addEventListener('click', () => {
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
     * Import bookmarks (batch save)
     */
    private async importBookmarks(
        bookmarks: Bookmark[],
        skipDuplicates: boolean
    ): Promise<void> {
        const promises: Promise<void>[] = [];

        for (const bookmark of bookmarks) {
            // Skip if duplicate and skipDuplicates is true
            if (skipDuplicates) {
                const exists = await SimpleBookmarkStorage.isBookmarked(
                    bookmark.url,
                    bookmark.position
                );
                if (exists) {
                    logger.debug(`[Import] Skipping duplicate: ${bookmark.url}:${bookmark.position}`);
                    continue;
                }
            }

            // Save bookmark with original timestamp and folder path
            promises.push(
                SimpleBookmarkStorage.save(
                    bookmark.url,
                    bookmark.position,
                    bookmark.userMessage,
                    bookmark.aiResponse,
                    bookmark.title,
                    bookmark.platform,
                    bookmark.timestamp,  // Preserve original timestamp from JSON
                    bookmark.folderPath  // CRITICAL: Preserve folder structure from import
                )
            );
        }

        await Promise.all(promises);
        logger.info(`[Import] Imported ${promises.length} bookmarks`);
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

        console.log('[smoothScrollTo] Scrolling to element:', targetElement);

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
        console.log('[highlightElement] Adding highlight to element:', element);
        element.classList.add('bookmark-highlight');

        setTimeout(() => {
            console.log('[highlightElement] Removing highlight from element');
            element.classList.remove('bookmark-highlight');
        }, 3000);  // 3 秒
    }

    /**
     * Handle bookmark navigation - Go To
     */
    private async handleGoTo(url: string, position: number): Promise<void> {
        console.log(`[handleGoTo] Starting navigation to ${url} position ${position}`);

        const currentUrl = window.location.href;
        const targetUrl = url;

        // 判断是否为当前页面
        const isCurrentPage = this.isSamePage(currentUrl, targetUrl);
        console.log(`[handleGoTo] isCurrentPage: ${isCurrentPage}`);

        if (isCurrentPage) {
            // 当前页面，直接滚动
            console.log('[handleGoTo] Same page - closing panel and scrolling');
            this.hide(); // 关闭书签面板
            await this.smoothScrollToPosition(position);
            console.log(`[handleGoTo] Scrolled to position ${position} on current page`);
        } else {
            // 跨页面跳转
            console.log('[handleGoTo] Cross-page - navigating with window.location.href');
            await this.setNavigateData('targetPosition', position);
            window.location.href = targetUrl;
            console.log(`[handleGoTo] Navigating to ${targetUrl} with target position ${position}`);
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
        console.log(`[smoothScrollToPosition] Starting scroll to position ${position}`);

        // Platform detection - check current URL
        const isGemini = window.location.href.includes('gemini.google.com');
        const isChatGPT = window.location.href.includes('chatgpt.com');

        // Platform-specific selectors (MUST match adapter selectors)
        let messageSelector: string;
        if (isGemini) {
            messageSelector = 'model-response';  // Gemini adapter selector
            console.log('[smoothScrollToPosition] Platform: Gemini');
        } else if (isChatGPT) {
            messageSelector = 'article[data-turn="assistant"], [data-message-author-role="assistant"]:not(article [data-message-author-role="assistant"])';
            console.log('[smoothScrollToPosition] Platform: ChatGPT');
        } else {
            console.error('[smoothScrollToPosition] Unknown platform');
            return;
        }

        console.log(`[smoothScrollToPosition] Using selector: ${messageSelector}`);

        const messages = document.querySelectorAll(messageSelector);
        console.log(`[smoothScrollToPosition] Found ${messages.length} messages`);

        const targetIndex = position - 1;
        if (targetIndex >= 0 && targetIndex < messages.length) {
            const targetElement = messages[targetIndex] as HTMLElement;
            console.log('[smoothScrollToPosition] Target element found, starting smooth scroll');
            this.smoothScrollTo(targetElement);
        } else {
            console.error(`[smoothScrollToPosition] Invalid position: ${position} (messages: ${messages.length})`);
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
            console.log(`[setNavigateData] Set ${storageKey} = ${value}`);
        } catch (error) {
            console.error('[setNavigateData] Error:', error);
        }
    }

    private async getNavigateData(key: string): Promise<any> {
        try {
            const storageKey = `bookmarkNavigate:${key}`;
            const result = await chrome.storage.local.get(storageKey);
            const value = result[storageKey];

            if (value !== undefined) {
                // Clear after reading
                await chrome.storage.local.remove(storageKey);
                console.log(`[getNavigateData] Got ${storageKey} = ${value}`);
                return value;
            }

            return null;
        } catch (error) {
            console.error('[getNavigateData] Error:', error);
            return null;
        }
    }

    /**
     * Check for navigation target on page load - AITimeline pattern
     */
    async checkNavigationTarget(): Promise<void> {
        console.log('=== [checkNavigationTarget] START ===');

        try {
            const targetPosition = await this.getNavigateData('targetPosition');
            console.log('[checkNavigationTarget] targetPosition from storage:', targetPosition);

            if (targetPosition !== null) {
                console.log(`[checkNavigationTarget] Found target position: ${targetPosition}`);

                // AITimeline pattern: Use requestAnimationFrame
                requestAnimationFrame(async () => {
                    console.log('[checkNavigationTarget] In requestAnimationFrame callback');

                    // Platform detection - check current URL
                    const isGemini = window.location.href.includes('gemini.google.com');
                    const isChatGPT = window.location.href.includes('chatgpt.com');

                    // Platform-specific selectors (MUST match adapter selectors)
                    let messageSelector: string;
                    if (isGemini) {
                        messageSelector = 'model-response';  // Gemini adapter selector
                        console.log('[checkNavigationTarget] Platform: Gemini');
                    } else if (isChatGPT) {
                        messageSelector = 'article[data-turn="assistant"], [data-message-author-role="assistant"]:not(article [data-message-author-role="assistant"])';
                        console.log('[checkNavigationTarget] Platform: ChatGPT');
                    } else {
                        console.error('[checkNavigationTarget] Unknown platform');
                        return;
                    }

                    console.log('[checkNavigationTarget] Using selector:', messageSelector);

                    const messages = document.querySelectorAll(messageSelector);
                    console.log('[checkNavigationTarget] Found messages:', messages.length);

                    const targetIndex = targetPosition - 1;
                    console.log('[checkNavigationTarget] Target index (0-based):', targetIndex);

                    if (targetIndex >= 0 && targetIndex < messages.length) {
                        const targetElement = messages[targetIndex] as HTMLElement;
                        console.log('[checkNavigationTarget] Target element:', targetElement);

                        if (targetElement) {
                            console.log(`[checkNavigationTarget] Calling smoothScrollTo for position ${targetPosition}`);
                            this.smoothScrollTo(targetElement);
                        } else {
                            console.error('[checkNavigationTarget] Target element is null');
                        }
                    } else {
                        console.error(`[checkNavigationTarget] Invalid position: ${targetPosition} (messages: ${messages.length})`);
                    }

                    console.log('=== [checkNavigationTarget] END ===');
                });
            } else {
                console.log('[checkNavigationTarget] No navigation target found in storage');
            }
        } catch (error) {
            console.error('[checkNavigationTarget] Error:', error);
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
     * Get panel styles
     */
    private getStyles(): string {
        return `
            /* Design Tokens - Inlined for Shadow DOM Compatibility */
            :host {
                /* NEUTRAL COLORS (Gray Scale) */
                --gray-50: #F9FAFB;
                --gray-100: #F3F4F6;
                --gray-200: #E5E7EB;
                --gray-300: #D1D5DB;
                --gray-400: #9CA3AF;
                --gray-500: #6B7280;
                --gray-600: #4B5563;
                --gray-700: #374151;
                --gray-800: #1F2937;
                --gray-900: #111827;

                /* PRIMARY COLORS (Material Blue) */
                --primary-50: #E3F2FD;
                --primary-100: #BBDEFB;
                --primary-200: #90CAF9;
                --primary-300: #64B5F6;
                --primary-400: #42A5F5;
                --primary-500: #2196F3;
                --primary-600: #1976D2;
                --primary-700: #1565C0;
                --primary-800: #0D47A1;

                /* Material Design 3 - Surface Colors */
                --md-surface: #FFFFFF;
                --md-surface-variant: #F5F5F5;
                --md-surface-container: #FAFAFA;
                --md-surface-container-high: #EEEEEE;
                --md-on-surface: #1C1B1F;
                --md-on-surface-variant: #49454F;

                /* Material Design 3 - Primary Container */
                --md-primary-container: #E3F2FD;
                --md-on-primary-container: #0D47A1;

                /* Material Design 3 - Outline */
                --md-outline: #E0E0E0;
                --md-outline-variant: #EEEEEE;

                /* SEMANTIC COLORS */
                --success-50: #F0FDF4;
                --success-100: #DCFCE7;
                --success-500: #22C55E;
                --success-600: #16A34A;
                --success-700: #15803D;

                --warning-50: #FFFBEB;
                --warning-100: #FEF3C7;
                --warning-500: #F59E0B;
                --warning-600: #D97706;
                --warning-700: #B45309;
                --warning-800: #92400E;

                --danger-50: #FEF2F2;
                --danger-100: #FEE2E2;
                --danger-500: #EF4444;
                --danger-600: #DC2626;
                --danger-700: #B91C1C;


                /* PLATFORM COLORS */
                --chatgpt-light: #D1FAE5;
                --chatgpt-dark: #065F46;
                --chatgpt-icon: #10A37F;
                --gemini-light: #DBEAFE;
                --gemini-dark: #1E40AF;
                --gemini-icon: #4285F4;

                /* SPACING */
                --space-0: 0px;
                --space-1: 4px;
                --space-2: 8px;
                --space-3: 12px;
                --space-4: 16px;
                --space-5: 20px;
                --space-6: 24px;
                --space-8: 32px;
                --space-10: 40px;
                --space-12: 48px;
                --space-16: 64px;
                --space-20: 80px;
                --space-24: 96px;

                /* TYPOGRAPHY */
                --font-sans: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", sans-serif;
                --font-mono: "SF Mono", Monaco, "Cascadia Code", "Roboto Mono", "Courier New", monospace;
                --text-xs: 12px;
                --text-sm: 13px;
                --text-base: 14px;
                --text-lg: 16px;
                --text-xl: 18px;
                --text-2xl: 20px;
                --text-3xl: 24px;
                --font-normal: 400;
                --font-medium: 500;
                --font-semibold: 600;
                --font-bold: 700;
                --leading-tight: 1.25;
                --leading-normal: 1.5;
                --leading-relaxed: 1.75;

                /* BORDER RADIUS (Material Design 3) */
                --radius-none: 0px;
                --radius-extra-small: 4px;
                --radius-small: 8px;
                --radius-medium: 12px;
                --radius-large: 16px;
                --radius-extra-large: 28px;
                --radius-full: 9999px;
                --radius-xs: 4px;
                --radius-sm: 8px;
                --radius-md: 12px;
                --radius-lg: 16px;
                --radius-xl: 28px;

                /* SHADOWS (Material Design 3 Elevation) */
                --shadow-none: none;
                --elevation-0: none;
                --elevation-1: 0 1px 2px rgba(0, 0, 0, 0.3), 0 1px 3px rgba(0, 0, 0, 0.15);
                --elevation-2: 0 1px 5px rgba(0, 0, 0, 0.2), 0 2px 2px rgba(0, 0, 0, 0.14);
                --elevation-3: 0 3px 5px rgba(0, 0, 0, 0.2), 0 1px 18px rgba(0, 0, 0, 0.12);
                --elevation-4: 0 2px 4px rgba(0, 0, 0, 0.2), 0 4px 5px rgba(0, 0, 0, 0.14);
                --elevation-5: 0 8px 10px rgba(0, 0, 0, 0.14), 0 3px 14px rgba(0, 0, 0, 0.12);
                --shadow-xs: 0 1px 2px rgba(0, 0, 0, 0.3), 0 1px 3px rgba(0, 0, 0, 0.15);
                --shadow-sm: 0 1px 5px rgba(0, 0, 0, 0.2), 0 2px 2px rgba(0, 0, 0, 0.14);
                --shadow-md: 0 3px 5px rgba(0, 0, 0, 0.2), 0 1px 18px rgba(0, 0, 0, 0.12);
                --shadow-lg: 0 2px 4px rgba(0, 0, 0, 0.2), 0 4px 5px rgba(0, 0, 0, 0.14);
                --shadow-xl: 0 8px 10px rgba(0, 0, 0, 0.14), 0 3px 14px rgba(0, 0, 0, 0.12);
                --shadow-2xl: 0 24px 38px rgba(0, 0, 0, 0.14), 0 9px 46px rgba(0, 0, 0, 0.12);
                --shadow-focus: 0 0 0 3px rgba(25, 118, 210, 0.1);

                /* SVG图标垂直对齐 */
                svg {
                    display: block;
                    vertical-align: text-top;  /* 与文字顶部对齐,避免偏下 */
                }
                --icon-md: 20px;
                --icon-lg: 24px;
                --icon-xl: 32px;

                /* ANIMATION & TRANSITIONS */
                --duration-fast: 150ms;
                --duration-base: 200ms;
                --duration-slow: 300ms;
                --duration-slower: 500ms;
                --ease-in: cubic-bezier(0.4, 0, 1, 1);
                --ease-out: cubic-bezier(0, 0, 0.2, 1);
                --ease-in-out: cubic-bezier(0.4, 0, 0.2, 1);
                --ease-bounce: cubic-bezier(0.68, -0.55, 0.265, 1.55);

                /* Z-INDEX SCALE */
                --z-dropdown: 1000;
                --z-sticky: 1020;
                --z-fixed: 1030;
                --z-modal-backdrop: 2147483646;
                --z-modal: 2147483647;
                --z-popover: 2147483647;
                --z-tooltip: 2147483647;

                /* COMMON VALUES */
                --white: #FFFFFF;
                --black: #000000;

                /* Overlay positioning */
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: rgba(0, 0, 0, 0.5);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: var(--z-modal-backdrop);
            }

            * {
                box-sizing: border-box;
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
                background: var(--md-surface);
                border-radius: var(--radius-large);  /* Material Design 16px */
                box-shadow: var(--elevation-3);      /* Material Design elevation */
                display: flex;
                z-index: var(--z-modal);
                font-family: var(--font-sans);
                overflow: hidden;
            }

            .toolbar {
                display: flex;
                gap: var(--space-2);  /* 8px */
                padding: var(--space-3);  /* 12px */
                background: var(--gray-50);
                border-bottom: 1px solid var(--gray-200);
                align-items: center;
                flex-wrap: wrap;
            }

            .toolbar-divider {
                width: 1px;
                height: 24px;
                background: var(--gray-300);
                margin: 0 4px;
            }

            .new-folder-btn,
            .export-btn,
            .import-btn {
                padding: var(--space-2) var(--space-3);  /* 8px 12px */
                border: 1px solid var(--gray-300);
                background: var(--white);
                border-radius: 6px;
                font-size: 13px;
                cursor: pointer;
                transition: all 0.15s ease;
                white-space: nowrap;
            }

            .new-folder-btn:hover,
            .export-btn:hover,
            .import-btn:hover {
                background: var(--gray-100);
                border-color: var(--gray-400);
            }

            .new-folder-btn {
                font-weight: 500;
                color: var(--primary-600);
                border-color: var(--primary-600);
            }

            .new-folder-btn:hover {
                background: var(--primary-50);
            }

            /* Sidebar */
            .sidebar {
                width: 140px;  /* 减小宽度 */
                background: var(--md-surface-variant);
                border-right: 1px solid var(--md-outline);
                display: flex;
                flex-direction: column;
                padding: var(--space-4) var(--space-2);
                gap: var(--space-2);
            }

            .tab-btn {
                display: flex;
                flex-direction: column;
                align-items: center;
                gap: var(--space-2);
                padding: var(--space-4) var(--space-3);
                border: none;
                border-left: 3px solid transparent;
                background: transparent;
                cursor: pointer;
                transition: all var(--duration-base);
                color: var(--md-on-surface-variant);
                font-size: var(--text-xs);
                border-radius: var(--radius-small);
            }

            .tab-btn:hover {
                background: var(--md-surface-container-high);  /* 更明显的灰色 #EEEEEE */
                color: var(--md-on-surface);
            }

            .tab-btn.active {
                background: var(--gray-200);  /* 深灰色,不是白色 */
                color: var(--gray-900);
                font-weight: var(--font-medium);
                border-left-color: var(--primary-600);
                box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05), 0 1px 3px rgba(0, 0, 0, 0.08);
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

            .header {
                padding: var(--space-5) var(--space-6);  /* 20px 24px */
                border-bottom: 1px solid var(--gray-200);
                display: flex;
                justify-content: space-between;
                align-items: center;
            }

            .header h2 {
                margin: 0;
                font-size: var(--text-xl);
                font-weight: 600;
                color: var(--md-on-surface);
                display: flex;
                align-items: center;  /* 图标和文字垂直居中对齐 */
                gap: var(--space-2);  /* 8px */
                line-height: 1;  /* 移除额外行高 */
            }

            .header h2 svg {
                flex-shrink: 0;  /* 防止图标被压缩 */
            }

            .close-btn {
                background: none;
                border: none;
                font-size: 28px;
                color: var(--gray-500);
                cursor: pointer;
                padding: 0;
                width: 32px;
                height: 32px;
                display: flex;
                align-items: center;
                justify-content: center;
                border-radius: 6px;
                transition: all 0.2s;
            }

            .close-btn:hover {
                background: var(--gray-100);
                color: var(--gray-900);
            }

            .tree-item {
                display: flex;
                align-items: center;
                gap: var(--space-2);
                padding: var(--space-2) var(--space-3);
                margin-bottom: var(--space-1);
                cursor: pointer;
                border-radius: var(--radius-small);
                transition: all var(--duration-base) var(--ease-out);
                background: var(--primary-50);  /* 文件夹浅蓝色背景 */
                border: none;  /* 移除边框 */
                box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);  /* 微妙阴影 */
                position: relative;  /* 为actions的absolute定位提供参考 */
            }

            .tree-item:hover {
                background: var(--primary-100);  /* 浅蓝色高亮 */
                box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
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
                padding: var(--space-3) var(--space-6);  /* 12px 24px - 8px grid */
                border-bottom: 1px solid var(--gray-200);
                display: flex;
                gap: var(--space-3);  /* 12px - 统一间距 */
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
                color: var(--gray-500);
            }

            .search-icon svg {
                display: block;  /* 移除inline默认的baseline对齐 */
            }

            .search-input {
                flex: 1;  /* 拉宽搜索框 */
                padding: var(--space-2) var(--space-4) var(--space-2) var(--space-10);  /* 8px 16px 8px 40px */
                border: 1px solid var(--md-outline);
                border-radius: var(--radius-small);  /* 8px */
                background: var(--md-surface);
                color: var(--md-on-surface);
                font-size: var(--text-sm);
                transition: all var(--duration-base) var(--ease-out);
            }

            .search-input:focus {
                outline: none;
                border-color: var(--primary-600);
                box-shadow: var(--shadow-focus);
                background: var(--white);
            }

            .search-input::placeholder {
                color: var(--gray-400);
            }

            .platform-filter {
                padding: var(--space-2) var(--space-3);  /* 8px 12px */
                border: 1px solid var(--md-outline);
                border-radius: var(--radius-small);  /* 8px */
                background: var(--md-surface);
                color: var(--md-on-surface);
                font-size: var(--text-sm);
                cursor: pointer;
                transition: all var(--duration-base) var(--ease-out);
            }

            .platform-filter:hover {
                background: var(--md-surface-container);
                border-color: var(--primary-600);
            }

            .platform-filter:focus {
                outline: none;
                border-color: var(--primary-600);
                box-shadow: var(--shadow-focus);
            }

            .toolbar-divider {
                width: 1px;
                height: 24px;
                background: var(--md-outline);
                margin: 0 var(--space-1);  /* 4px */
            }



            .toolbar-icon-btn {
                width: 32px;
                height: 32px;
                display: inline-flex;
                align-items: center;
                justify-content: center;
                border: none;
                border-radius: var(--radius-small);  /* 8px */
                background: transparent;
                color: var(--md-on-surface);
                cursor: pointer;
                transition: all var(--duration-base) var(--ease-out);
            }

            .toolbar-icon-btn:hover {
                background: var(--md-surface-container);
            }

            .toolbar-icon-btn:active {
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
                gap: var(--space-2);  /* 8px */
                padding: var(--space-2) var(--space-3);  /* 8px 12px */
                border: 1px solid var(--md-outline);
                border-radius: var(--radius-small);  /* 8px */
                background: var(--md-surface);
                color: var(--md-on-surface);
                font-size: var(--text-sm);
                font-weight: 500;
                cursor: pointer;
                transition: all var(--duration-base) var(--ease-out);
                min-width: 140px;
                justify-content: space-between;
            }

            /* Mac tag风格 - 根据选中平台改变背景色 */
            .platform-selector[data-selected="all"] {
                background: var(--gray-100);  /* 中性灰 */
                border-color: var(--gray-300);
            }

            .platform-selector[data-selected="chatgpt"] {
                background: var(--success-50);  /* 浅绿色 */
                border-color: var(--success-200);
                color: var(--success-900);
            }

            .platform-selector[data-selected="gemini"] {
                background: var(--primary-50);  /* 浅蓝色 */
                border-color: var(--primary-200);
                color: var(--primary-900);
            }

            .platform-selector:hover {
                border-color: var(--primary-600);
                box-shadow: 0 0 0 3px rgba(25, 118, 210, 0.1);
            }

            .platform-selector-label {
                flex: 1;
                text-align: left;
            }

            .platform-selector-icon {
                flex-shrink: 0;
                display: flex;
                align-items: center;
                transition: transform var(--duration-base) var(--ease-out);
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
                background: var(--md-surface);
                border: 1px solid var(--md-outline);
                border-radius: var(--radius-small);
                box-shadow: var(--elevation-2);
                z-index: 1000;
                overflow: hidden;
            }

            .platform-option {
                display: flex;
                align-items: center;
                gap: var(--space-2);  /* 8px */
                padding: var(--space-2) var(--space-3);  /* 8px 12px */
                cursor: pointer;
                transition: background var(--duration-base) var(--ease-out);
            }

            .platform-option:hover {
                background: var(--md-surface-container);
            }

            .platform-option[data-selected="true"] {
                background: var(--primary-100);
                color: var(--primary-900);
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
                font-size: var(--text-sm);
            }

            .export-btn {
                padding: var(--space-2) var(--space-4);  /* 8px 16px */
                background: var(--primary-600);
                color: var(--white);
                border: none;
                border-radius: 6px;
                font-size: 14px;
                cursor: pointer;
                transition: all 0.2s;
            }

            .export-btn:hover {
                background: var(--primary-700);
            }

            /* Content */
            .content {
                flex: 1;
                overflow-y: auto;
                padding: var(--space-4) var(--space-6);  /* 16px 24px */
            }

            .empty {
                text-align: center;
                padding: var(--space-15) var(--space-5);  /* 60px 20px */
                color: var(--gray-500);
                font-size: 15px;
            }

            /* Bookmark list */
            .bookmark-list {
                display: flex;
                flex-direction: column;
                gap: var(--space-2);  /* 8px */
            }

            .bookmark-item {
                padding: var(--space-3) var(--space-4);
                margin: var(--space-1) 3px;
                border: none;  /* 移除边框 */
                border-radius: var(--radius-small);
                background: var(--md-surface);  /* 书签白色背景 */
                cursor: pointer;
                transition: all var(--duration-base) var(--ease-out);
                box-shadow: 0 1px 2px rgba(0, 0, 0, 0.06);  /* 纯阴影 */
                display: flex;
                align-items: center;
                gap: var(--space-3);  /* 12px */
                position: relative;  /* 为actions的absolute定位提供参考 */
            }

            .bookmark-item:hover {
                background: var(--primary-50);  /* 浅蓝色高亮 */
                box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1), 0 2px 6px rgba(0, 0, 0, 0.08);
            }

            .platform-badge {
                flex-shrink: 0;
                padding: var(--space-1) var(--space-2);  /* 4px 8px */
                border-radius: 4px;
                font-size: 12px;
                font-weight: 500;
                min-width: 90px;
                text-align: center;
            }

            .platform-badge.chatgpt {
                background: var(--success-100);
                color: var(--success-800);
            }

            .platform-badge.gemini {
                background: var(--primary-100);
                color: var(--primary-800);
            }

            .title {
                flex: 2;
                font-size: 14px;
                font-weight: 500;
                color: var(--gray-900);
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
            }

            .response {
                flex: 3;
                font-size: 13px;
                color: var(--gray-500);
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
            }

            .notes {
                flex: 1;
                font-size: 13px;
                color: var(--gray-400);
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
            }

            .time {
                flex-shrink: 0;
                font-size: 12px;
                color: var(--gray-400);
                min-width: 40px;
            }

            .actions {
                flex-shrink: 0;
                display: flex;
                gap: var(--space-1);  /* 4px */
            }

            .action-btn {
                width: 24px;
                height: 24px;
                border: none;
                background: transparent;
                border-radius: 4px;
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 14px;
                transition: all 0.2s ease;
            }

            .action-btn:hover {
                background: var(--gray-100);
                transform: scale(1.1);
            }

            .delete-btn:hover {
                background: var(--danger-100);
            }

            /* Settings content */
            .settings-content,
            .support-content {
                padding: var(--space-10);  /* 40px */
                text-align: center;
            }

            .settings-content h3,
            .support-content h3 {
                margin: 0 0 16px 0;
                font-size: 18px;
                color: var(--gray-900);
            }

            .settings-content p,
            .support-content p {
                color: var(--gray-500);
                margin: 0 0 24px 0;
            }
            /* Support button */
            .support-btn {
                display: inline-block;
                padding: var(--space-3) var(--space-6);
                background: var(--primary-600);
                color: var(--white);
                text-decoration: none;
                border-radius: var(--radius-small);  /* Material Design 8px */
                font-weight: var(--font-medium);
                transition: all var(--duration-base);
                box-shadow: var(--elevation-1);  /* Material Design elevation */
            }

            .support-btn:hover {
                background: var(--primary-700);
                box-shadow: var(--elevation-2);  /* Material Design hover elevation */
                transform: translateY(-1px);
            }

            /* Conflict Dialog Styles */
            .conflict-dialog-overlay {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.5);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: var(--z-modal-backdrop);
            }

            .conflict-dialog {
                background: var(--white);
                border-radius: var(--radius-large);
                box-shadow: var(--shadow-2xl);
                max-width: 500px;
                width: 90%;
                max-height: 80vh;
                overflow: hidden;
                display: flex;
                flex-direction: column;
            }

            .conflict-header {
                padding: var(--space-5) var(--space-6);  /* 20px 24px */
                border-bottom: 1px solid var(--gray-200);
                background: var(--warning-100);
            }

            .conflict-header h3 {
                margin: 0;
                font-size: 18px;
                font-weight: 600;
                color: var(--warning-800);
            }

            .conflict-body {
                padding: var(--space-6);  /* 24px */
                overflow-y: auto;
                flex: 1;
            }

            .conflict-body p {
                margin: 0 0 16px 0;
                color: var(--gray-700);
                font-size: 14px;
            }

            .conflict-list {
                margin-top: 16px;
                border: 1px solid var(--gray-200);
                border-radius: 8px;
                overflow: hidden;
            }

            .conflict-item {
                padding: var(--space-3);  /* 12px */
                border-bottom: 1px solid var(--gray-200);
                display: flex;
                align-items: center;
                gap: var(--space-3);  /* 12px */
            }

            .conflict-item:last-child {
                border-bottom: none;
            }

            .conflict-title {
                flex: 1;
                font-size: 13px;
                color: var(--gray-700);
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
            }

            .conflict-more {
                padding: var(--space-3);  /* 12px */
                text-align: center;
                font-size: 13px;
                color: var(--gray-500);
                font-style: italic;
            }

            .conflict-footer {
                padding: var(--space-4) var(--space-6);  /* 16px 24px */
                border-top: 1px solid var(--gray-200);
                display: flex;
                gap: var(--space-3);  /* 12px */
                justify-content: flex-end;
                background: var(--gray-50);
            }

            .toolbar button {
                padding: var(--space-2) var(--space-3);  /* 8px 12px */
                border: 1px solid var(--gray-200);
                background: var(--gray-100);
                border-radius: 6px;
                font-size: 14px;
                cursor: pointer;
                transition: all 0.2s ease;
                display: inline-flex;
                align-items: center;
                justify-content: center;
                color: var(--gray-500);
            }

            .toolbar button:hover {
                background: var(--gray-200);
                border-color: var(--gray-400);
                color: var(--gray-700);
            }

            .toolbar button svg {
                display: block;
            }

            .merge-btn {
                background: var(--primary-600);
                color: var(--white);
            }

            .merge-btn:hover {
                background: var(--primary-700);
            }

            .cancel-btn {
                background: var(--gray-200);
                color: var(--gray-700);
            }

            .cancel-btn:hover {
                background: var(--gray-300);
            }

            /* Detail Modal - Modern & Clean */
            .detail-modal-overlay {
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: rgba(0, 0, 0, 0.6);
                backdrop-filter: blur(8px);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 2147483648;
                animation: overlayFadeIn 0.2s ease;
            }

            @keyframes overlayFadeIn {
                from { opacity: 0; }
                to { opacity: 1; }
            }

            .detail-modal {
                background: white;
                border-radius: 16px;
                width: 90%;
                max-width: 800px;
                max-height: 85vh;
                display: flex;
                flex-direction: column;
                box-shadow: 
                    0 0 0 1px rgba(0, 0, 0, 0.08),
                    0 4px 12px rgba(0, 0, 0, 0.12),
                    0 16px 48px rgba(0, 0, 0, 0.18),
                    0 24px 80px rgba(0, 0, 0, 0.12);
                position: relative;
                z-index: 2147483649;
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
                border-bottom: 1px solid #F0F0F0;
                display: flex;
                justify-content: space-between;
                align-items: center;
                flex-shrink: 0;
            }

            .detail-header h3 {
                margin: 0;
                font-size: 18px;
                font-weight: 600;
                color: #1A1A1A;
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
                border-radius: 8px;
                border: none;
                background: transparent;
                color: #6B7280;
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
                transition: all 0.15s ease;
                font-size: 20px;
            }

            .fullscreen-btn:hover,
            .detail-header .close-btn:hover {
                background: #F3F4F6;
                color: #1A1A1A;
            }

            .detail-meta {
                padding: 10px 24px;
                background: #F8F9FA;
                display: flex;
                justify-content: space-between;
                align-items: center;
                border-bottom: 1px solid #E8E8E8;
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
                border-radius: 6px;
                font-size: 13px;
                font-weight: 500;
                white-space: nowrap;
                flex-shrink: 0;
            }

            .detail-meta .platform-badge.chatgpt {
                background: #D1FAE5;
                color: #065F46;
            }

            .detail-meta .platform-badge.gemini {
                background: #DBEAFE;
                color: #1E40AF;
            }

            .detail-meta-right {
                font-size: 13px;
                color: #6B7280;
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
                border-bottom: 1px solid #F5F5F5;
            }

            .detail-section:last-child {
                border-bottom: none;
            }

            .user-section {
                background: #F0F7FF;
                border-left: 3px solid #3B82F6;
            }

            .ai-section {
                background: #F0FDF4;
                border-left: 3px solid #10B981;
            }

            .section-header {
                display: flex;
                align-items: center;
                gap: 10px;
                margin-bottom: 16px;
            }

            .section-header svg {
                color: #6B7280;
                flex-shrink: 0;
            }

            .section-header h4 {
                margin: 0;
                font-size: 14px;
                font-weight: 600;
                color: #6B7280;
                text-transform: uppercase;
                letter-spacing: 0.05em;
            }

            .detail-text {
                font-size: 15px;
                line-height: 1.7;
                color: #1A1A1A;
            }

            .detail-footer {
                padding: 10px 24px;
                border-top: 1px solid #F0F0F0;
                display: flex;
                justify-content: flex-end;
                background: white;
                flex-shrink: 0;
                border-radius: 0 0 16px 16px;
                min-height: 44px;
            }

            .open-conversation-btn {
                padding: 8px 20px;
                background: #2563EB;
                color: white;
                border: none;
                border-radius: 8px;
                font-size: 14px;
                font-weight: 500;
                cursor: pointer;
                transition: all 0.15s ease;
            }

            .open-conversation-btn:hover {
                background: #1D4ED8;
                box-shadow: 0 2px 8px rgba(37, 99, 235, 0.3);
            }

            /* ============================================================================
               Batch Actions Bar (Gmail-style)
               ============================================================================ */
            
            .batch-actions-bar {
                position: fixed;
                bottom: 0;
                left: 140px;  /* Sidebar宽度 */
                right: 0;
                background: var(--warning-100);  /* 淡黄色背景 */
                border-top: 1px solid var(--warning-500);
                border-radius: var(--radius-medium) var(--radius-medium) 0 0;  /* 上方圆角 */
                padding: var(--space-3) var(--space-6);
                display: flex;
                align-items: center;
                justify-content: space-between;
                padding: 16px 20px;
                background: rgba(255, 255, 255, 0.85);
                backdrop-filter: blur(20px) saturate(180%);
                -webkit-backdrop-filter: blur(20px) saturate(180%);
                border-top: 1px solid rgba(0, 0, 0, 0.08);
                box-shadow: 0 -4px 20px rgba(0, 0, 0, 0.08);
                display: flex;
                align-items: center;
                gap: 12px;
                z-index: 100;
                transform: translateY(100%);
                transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            }

            .batch-actions-bar.visible {
                transform: translateY(0);
            }

            .batch-actions-bar .selected-count {
                font-size: 14px;
                font-weight: 500;
                color: var(--gray-700);
                margin-right: auto;
                white-space: nowrap;
            }

            .batch-actions-bar button {
                display: flex;
                flex-direction: row;
                align-items: center;
                justify-content: center;
                gap: 8px;
                padding: 10px 16px;
                background: white;
                border: 1px solid var(--gray-200);
                border-radius: var(--radius-medium);
                cursor: pointer;
                transition: all 0.2s ease;
                font-size: 13px;
                font-weight: 500;
                color: var(--gray-700);
                white-space: nowrap;
            }

            .batch-actions-bar button:hover {
                background: var(--gray-50);
                border-color: var(--gray-300);
                transform: translateY(-1px);
                box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
            }

            .batch-actions-bar button:active {
                transform: translateY(0);
            }

            .batch-actions-bar button svg {
                width: 20px;
                height: 20px;
            }

            .batch-actions-bar button.danger {
                color: var(--danger-600);
            }

            .batch-actions-bar button.danger:hover {
                background: var(--danger-50);
                border-color: var(--danger-200);
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
                padding: var(--space-2);  /* 添加padding避免阴影被截断 */
            }

            .tree-view {
                flex: 1;
                overflow-y: auto;
                overflow-x: hidden;
                background: var(--white);
            }

            /* Custom Scrollbar (macOS-style) */
            .tree-view::-webkit-scrollbar {
                width: 8px;
            }

            .tree-view::-webkit-scrollbar-track {
                background: transparent;
            }

            .tree-view::-webkit-scrollbar-thumb {
                background: var(--gray-300);
                border-radius: 4px;
            }

            .tree-view::-webkit-scrollbar-thumb:hover {
                background: var(--gray-400);
            }

            /* Tree Item Base */
            .tree-item {
                display: flex;
                align-items: center;
                min-height: 36px;
                padding: var(--space-2) var(--space-3);  /* 8px 12px */
                border-bottom: 1px solid var(--gray-100);
                position: relative;
                cursor: pointer;
                transition: background-color 0.15s ease;
                user-select: none;
            }

            .batch-action-btn {
                display: inline-flex;
                align-items: center;
                justify-content: center;
                gap: var(--space-2);
                padding: var(--space-2) var(--space-4);
                background: var(--md-surface);
                border: 1px solid var(--md-outline);
                border-radius: var(--radius-small);
                cursor: pointer;
                transition: all var(--duration-base);
                font-size: var(--text-sm);
                color: var(--md-on-surface);
                line-height: 1;  /* 移除额外的行高 */
            }

            .batch-action-btn svg {
                flex-shrink: 0;  /* 防止图标被压缩 */
            }

            .tree-item:hover {
                background: var(--gray-50);
            }

            .tree-item:focus {
                outline: 2px solid var(--primary-600);
                outline-offset: -2px;
                z-index: 1;
            }

            .tree-item:focus:not(:focus-visible) {
                outline: none;
            }

            /* Folder Styles */
            .folder-item {
                font-weight: 500;
                background: var(--gray-50);
            }

            .folder-item.selected {
                background: var(--primary-50);
                box-shadow: inset 3px 0 0 var(--primary-600);
            }

            .folder-toggle {
                display: inline-flex;
                align-items: center;
                justify-content: center;
                width: 16px;
                height: 16px;
                font-size: 10px;
                color: var(--gray-500);
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
                color: var(--gray-900);
            }

            .folder-icon {

                font-size: 16px;
                margin-right: 8px;
            }

            .folder-name {
                flex: 1;
                font-weight: var(--font-medium);
                color: var(--md-on-surface);
                display: flex;
                align-items: center;  /* 图标和文字垂直居中对齐 */
                gap: var(--space-2);  /* 8px */
                line-height: 16px;  /* 匹配图标高度,确保完美对齐 */
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
                color: var(--gray-500);
                font-weight: 400;
                user-select: none;
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


            /* Bookmark Styles */
            .bookmark-item {
                background: var(--white);
            }

            .platform-icon {
                font-size: 16px;
                margin-right: 8px;
                flex-shrink: 0;
            }

            .bookmark-title {
                flex: 1;
                font-size: 13px;
                color: var(--gray-700);
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
                padding-right: 220px; /* Reserve space for timestamp + actions */
            }

            .bookmark-timestamp {
                position: absolute;
                right: 120px; /* Space for action buttons */
                font-size: 11px;
                color: var(--gray-400);
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
                accent-color: var(--primary-600);  /* 深蓝色 */
            }

            .item-checkbox:focus {
                outline: 2px solid var(--primary-600);
                outline-offset: 2px;
            }

            /* Action Buttons */
            .item-actions {
                display: none;  /* 默认隐藏 */
                position: absolute;  /* 绝对定位,不影响高度 */
                right: var(--space-3);
                top: 50%;
                transform: translateY(-50%);
                gap: var(--space-1);
                align-items: center;
            }

            .tree-item:hover .item-actions {
                display: flex;
            }

            .action-btn {
                width: 28px;
                height: 28px;
                border: none;
                background: transparent;
                cursor: pointer;
                border-radius: 4px;
                font-size: 14px;
                transition: background-color 0.15s ease;
                display: flex;
                align-items: center;
                justify-content: center;
                padding: 0;
            }

            .action-btn:hover {
                background: rgba(0, 0, 0, 0.05);
            }

            .action-btn:focus {
                outline: 2px solid var(--primary-600);
                outline-offset: -2px;
            }

            .action-btn.delete-folder:hover,
            .action-btn.delete-bookmark:hover {
                background: var(--danger-100);
                color: var(--danger-500);
            }

            /* Empty State */
            .tree-empty {
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                padding: var(--space-16) var(--space-8);  /* 64px 32px */
                text-align: center;
                color: var(--gray-500);
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
                color: var(--gray-700);
            }

            .tree-empty p {
                margin: 0 0 24px 0;
                font-size: 14px;
                color: #6b7280;
            }
            .btn-primary,
            .create-first-folder {
                padding: var(--space-2) var(--space-5);
                background: var(--primary-600);
                color: white;
                border: none;
                border-radius: var(--radius-small);  /* Material Design 8px */
                cursor: pointer;
                font-weight: var(--font-medium);
                font-size: 14px;
                transition: all var(--duration-base);
                box-shadow: var(--elevation-1);  /* Material Design elevation */
                display: inline-flex;
                align-items: center;
                gap: 6px;
            }

            .btn-primary:hover,
            .create-first-folder:hover {
                background: var(--primary-700);
                box-shadow: var(--elevation-2);  /* Material Design hover elevation */
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
                background: var(--md-primary-container);
                color: var(--md-on-primary-container);
                border-radius: var(--radius-small);
                font-weight: var(--font-medium);
                box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05), 0 1px 3px rgba(0, 0, 0, 0.08);  /* 与Tab选中一致的阴影 */
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
            }    padding: var(--space-10);  /* 40px */
                color: #6b7280;
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

            /* ============================================
               DARK MODE - Material Design Blue Theme
               ============================================ */

            :host-context(html.dark) .panel {
                background: var(--gray-800);
            }

            :host-context(html.dark) .sidebar {
                background: var(--gray-900);
                border-color: var(--gray-700);
            }

            :host-context(html.dark) .tab-btn {
                color: var(--gray-400);
            }

            :host-context(html.dark) .tab-btn:hover {
                background: var(--gray-700);  /* 深色模式 hover */
                color: var(--gray-50);
            }

            :host-context(html.dark) .tab-btn.active {
                background: var(--gray-700);  /* 深色模式下的深灰色 */
                color: var(--gray-50);
            }

            :host-context(html.dark) .header {
                background: var(--gray-800);
                border-color: var(--gray-700);
            }

            :host-context(html.dark) .header h2 {
                color: var(--gray-50);
            }

            :host-context(html.dark) .close-btn {
                color: var(--gray-400);
            }

            :host-context(html.dark) .close-btn:hover {
                background: var(--gray-700);
                color: var(--gray-50);
            }

            :host-context(html.dark) .toolbar {
                background: var(--gray-800);
                border-color: var(--gray-700);
            }

            :host-context(html.dark) .search-input,
            :host-context(html.dark) .platform-filter {
                background: var(--gray-900);
                border-color: var(--gray-700);
                color: var(--gray-50);
            }

            :host-context(html.dark) .search-input::placeholder {
                color: var(--gray-500);
            }

            /* Toolbar buttons dark mode */
            :host-context(html.dark) .toolbar-icon-btn {
                background: var(--gray-700);
                border-color: var(--gray-600);
                color: var(--gray-200);
            }

            :host-context(html.dark) .toolbar-icon-btn:hover {
                background: var(--gray-600);
                border-color: var(--gray-500);
                color: var(--gray-50);
            }

            /* Platform selector dark mode */
            :host-context(html.dark) .platform-selector {
                background: var(--gray-700);
                border-color: var(--gray-600);
                color: var(--gray-200);
            }

            :host-context(html.dark) .platform-selector:hover {
                background: var(--gray-600);
                border-color: var(--gray-500);
            }

            :host-context(html.dark) .platform-selector[data-selected="all"],
            :host-context(html.dark) .platform-selector[data-selected="chatgpt"],
            :host-context(html.dark) .platform-selector[data-selected="gemini"] {
                background: var(--gray-600);
                border-color: var(--gray-500);
            }

            /* Platform dropdown dark mode */
            :host-context(html.dark) .platform-dropdown {
                background: var(--gray-800);
                border-color: var(--gray-600);
            }

            :host-context(html.dark) .platform-option {
                color: var(--gray-200);
            }

            :host-context(html.dark) .platform-option:hover {
                background: var(--gray-700);
            }

            :host-context(html.dark) .platform-option[data-selected="true"] {
                background: var(--primary-900);
                color: var(--primary-100);
            }

            /* Tree view dark mode */
            :host-context(html.dark) .content {
                background: var(--gray-800);
            }

            :host-context(html.dark) .tree-view {
                background: var(--gray-800);
            }

            :host-context(html.dark) .tree-item {
                border-color: var(--gray-700);
            }

            :host-context(html.dark) .tree-item:hover {
                background: var(--gray-700);
            }

            :host-context(html.dark) .folder-item {
                background: var(--gray-750);
            }

            :host-context(html.dark) .folder-item.selected {
                background: rgba(59, 130, 246, 0.2);
                border-left-color: var(--primary-600);
            }

            :host-context(html.dark) .folder-name {
                color: var(--gray-50);
            }

            :host-context(html.dark) .folder-count {
                color: var(--gray-500);
            }

            :host-context(html.dark) .bookmark-item {
                background: var(--gray-800);
                border-color: var(--gray-700);
            }

            :host-context(html.dark) .bookmark-item:hover {
                background: var(--gray-700);
                border-color: var(--gray-600);
            }

            :host-context(html.dark) .bookmark-title {
                color: var(--gray-50);
            }

            :host-context(html.dark) .bookmark-timestamp {
                color: var(--gray-500);
            }

            :host-context(html.dark) .action-btn {
                color: var(--gray-400);
            }

            :host-context(html.dark) .action-btn:hover {
                background: var(--gray-600);
                color: var(--gray-50);
            }

            :host-context(html.dark) .title {
                color: var(--gray-50);
            }

            :host-context(html.dark) .response {
                color: var(--gray-400);
            }

            /* Detail modal dark mode */
            :host-context(html.dark) .detail-modal {
                background: var(--gray-800);
            }

            :host-context(html.dark) .detail-header {
                background: var(--gray-800);
                border-color: var(--gray-700);
            }

            :host-context(html.dark) .detail-header h3 {
                color: var(--gray-50);
            }

            :host-context(html.dark) .fullscreen-btn,
            :host-context(html.dark) .detail-header .close-btn {
                color: var(--gray-400);
            }

            :host-context(html.dark) .fullscreen-btn:hover,
            :host-context(html.dark) .detail-header .close-btn:hover {
                background: var(--gray-700);
                color: var(--gray-50);
            }

            :host-context(html.dark) .detail-meta {
                background: var(--gray-900);
                border-color: var(--gray-700);
            }

            :host-context(html.dark) .detail-meta-right {
                color: var(--gray-500);
            }

            :host-context(html.dark) .detail-section {
                border-color: var(--gray-700);
            }

            :host-context(html.dark) .user-section {
                background: rgba(59, 130, 246, 0.1);
                border-left-color: var(--primary-600);
            }

            :host-context(html.dark) .ai-section {
                background: rgba(16, 185, 129, 0.1);
                border-left-color: var(--success-600);
            }

            :host-context(html.dark) .section-header h4 {
                color: var(--gray-400);
            }

            :host-context(html.dark) .detail-text {
                color: var(--gray-50);
            }

            :host-context(html.dark) .detail-footer {
                background: var(--gray-800);
                border-color: var(--gray-700);
            }

            :host-context(html.dark) .open-conversation-btn {
                background: var(--primary-600);
                color: white;
            }

            :host-context(html.dark) .open-conversation-btn:hover {
                background: var(--primary-700);
            }

            /* Batch actions bar dark mode */
            :host-context(html.dark) .batch-actions-bar {
                background: rgba(31, 41, 55, 0.95);
                border-color: var(--gray-700);
            }

            :host-context(html.dark) .batch-actions-bar .selected-count {
                color: var(--gray-300);
            }

            :host-context(html.dark) .batch-actions-bar button {
                background: var(--gray-700);
                border-color: var(--gray-600);
                color: var(--gray-200);
            }

            :host-context(html.dark) .batch-actions-bar button:hover {
                background: var(--gray-600);
                border-color: var(--gray-500);
            }

            /* Empty state dark mode */
            :host-context(html.dark) .tree-empty {
                color: var(--gray-500);
            }

            :host-context(html.dark) .tree-empty h3 {
                color: var(--gray-300);
            }

            :host-context(html.dark) .tree-empty p {
                color: var(--gray-500);
            }

            /* Notification/Alert dark mode */
            :host-context(html.dark) .notification {
                background: var(--gray-800);
                border-color: var(--gray-700);
                color: var(--gray-50);
            }

            :host-context(html.dark) .notification.success {
                background: rgba(16, 185, 129, 0.15);
                border-color: var(--success-600);
                color: var(--gray-50);
            }

            :host-context(html.dark) .notification.error {
                background: rgba(239, 68, 68, 0.15);
                border-color: var(--danger-600);
                color: var(--gray-50);
            }

            :host-context(html.dark) .notification.warning {
                background: rgba(245, 158, 11, 0.15);
                border-color: var(--warning-600);
                color: var(--gray-50);
            }
        `;
    }
}

// Singleton instance
export const simpleBookmarkPanel = new SimpleBookmarkPanel();
