
import { SimpleBookmarkStorage } from '../storage/SimpleBookmarkStorage';
import { Bookmark, Folder, FolderTreeNode } from '../storage/types';
import { logger } from '../../utils/logger';
import { FolderStorage } from '../storage/FolderStorage';
import { FolderState } from '../state/FolderState';
import { FolderOperationsManager } from '../managers/FolderOperationsManager';
import { TreeBuilder } from '../utils/tree-builder';
import { PathUtils } from '../utils/path-utils';

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
    private selectedBookmarks: Set<string> = new Set(); // For batch delete (stores "url:position")

    // Folder tree properties
    private folders: Folder[] = [];
    private folderState: FolderState = new FolderState();
    private folderOpsManager: FolderOperationsManager = new FolderOperationsManager();

    /**
     * Show the bookmark panel
     */
    async show(): Promise<void> {
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
        this.overlay.addEventListener('click', (e) => {
            // Only close if clicking directly on overlay (not on panel or its children)
            if (e.target === this.overlay) {
                this.hide();
            }
        });

        document.body.appendChild(this.overlay);

        // Setup storage listener for real-time updates
        this.setupStorageListener();

        // Bind event listeners
        this.bindEventListeners();

        // Show migration notification if bookmarks were migrated
        if (migratedCount > 0) {
            setTimeout(() => {
                alert(`✅ Migrated ${migratedCount} bookmark${migratedCount > 1 ? 's' : ''} to "Import" folder`);
            }, 100);
        }
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
        if (this.overlay) {
            this.overlay.style.display = 'none';
        }
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
                    <span class="tab-icon">📌</span>
                    <span class="tab-label">Bookmarks</span>
                </button>
                <button class="tab-btn" data-tab="settings">
                    <span class="tab-icon">⚙️</span>
                    <span class="tab-label">Settings</span>
                </button>
                <button class="tab-btn" data-tab="support">
                    <span class="tab-icon">☕</span>
                    <span class="tab-label">Buy Me a Coffee</span>
                </button>
            </div>

            <div class="main">
                <div class="header">
                    <h2>📌 Bookmarks (${this.bookmarks.length})</h2>
                    <button class="close-btn" aria-label="Close">×</button>
                </div>

                <div class="tab-content bookmarks-tab active">
                    <div class="toolbar">
                        <input type="text" class="search-input" placeholder="🔍 Search...">
                        <select class="platform-filter">
                            <option value="">All Platforms</option>
                            <option value="ChatGPT">ChatGPT</option>
                            <option value="Gemini">Gemini</option>
                        </select>
                        <button class="new-folder-btn" title="Create new folder">➕ New Folder</button>
                        <div class="toolbar-divider"></div>
                        <button class="export-btn" title="Export bookmarks">📥 Export</button>
                        <button class="import-btn" title="Import bookmarks">📤 Import</button>
                        <button class="batch-delete-btn" style="display: none;">🗑 Delete Selected (<span class="selected-count">0</span>)</button>
                    </div>
                    <div class="content">
                        ${this.renderTreeView()}
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
                        <h3>☕ Buy Me a Coffee</h3>
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
     * Render folder item with expand/collapse
     * Reference: VS Code folder rendering
     */
    private renderFolderItem(node: FolderTreeNode, depth: number): string {
        const folder = node.folder;
        const icon = node.isExpanded ? '📂' : '📁';
        const indent = depth * 20; // 20px per level (Linear spacing)
        const showAddSubfolder = depth < 2; // Max 3 levels
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
                <input type="checkbox" 
                       class="item-checkbox folder-checkbox" 
                       data-path="${this.escapeAttr(folder.path)}"
                       aria-label="Select ${folder.name} and all children">
                <span class="folder-icon">${icon}</span>
                <span class="folder-name">${this.escapeHtml(folder.name)}</span>
                <div class="item-actions">
                    ${showAddSubfolder ? `<button class="action-btn add-subfolder" data-path="${this.escapeAttr(folder.path)}" data-depth="${depth}" title="New Subfolder" aria-label="Create subfolder">➕</button>` : ''}
                    <button class="action-btn rename-folder" title="Rename" aria-label="Rename folder">✏️</button>
                    <button class="action-btn delete-folder" title="Delete" aria-label="Delete folder">🗑</button>
                </div>
            </div>
        `;

        // Render children if expanded
        if (node.isExpanded && node.children.length > 0) {
            html += '<div class="folder-children">';
            for (const child of node.children) {
                html += this.renderTreeNode(child, depth + 1);
            }
            html += '</div>';
        }

        // Render bookmarks in this folder
        if (node.isExpanded && node.bookmarks.length > 0) {
            for (const bookmark of node.bookmarks) {
                html += this.renderBookmarkItemInTree(bookmark, depth + 1);
            }
        }

        return html;
    }

    /**
     * Render bookmark item in tree
     * Reference: Notion list items, Linear task items
     */
    private renderBookmarkItemInTree(bookmark: Bookmark, depth: number): string {
        const icon = bookmark.platform === 'ChatGPT' ? '🤖' : '✨';
        const indent = depth * 20;
        const timestamp = this.formatTimestamp(bookmark.timestamp);
        const key = `${bookmark.urlWithoutProtocol}:${bookmark.position}`;
        const checked = this.selectedBookmarks.has(key) ? 'checked' : '';

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
                    <button class="action-btn preview-bookmark" title="Preview" aria-label="Preview bookmark">👁</button>
                    <button class="action-btn edit-bookmark" title="Edit" aria-label="Edit bookmark">✏️</button>
                    <button class="action-btn delete-bookmark" title="Delete" aria-label="Delete bookmark">🗑</button>
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
                <div class="empty-icon">📁</div>
                <h3>No folders yet</h3>
                <p>Create your first folder to organize bookmarks</p>
                <button class="btn-primary create-first-folder">
                    ➕ Create First Folder
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
    private getPlatformIcon(platform?: string): string {
        switch (platform) {
            case 'ChatGPT':
                return '🤖';
            case 'Gemini':
                return '✨';
            default:
                return '🤖';
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
        this.bookmarks = await SimpleBookmarkStorage.getAllBookmarks();
        this.filterBookmarks();
        logger.debug(`[SimpleBookmarkPanel] Refreshed: ${this.bookmarks.length} bookmarks`);

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
                header.textContent = `📌 Bookmarks (${this.bookmarks.length})`;
            }

            // Update batch delete button state
            this.updateBatchDeleteButton();
        }
    }

    /**
     * Bind event listeners to buttons
     */
    private bindEventListeners(): void {
        // Close button
        this.shadowRoot?.querySelector('.close-btn')?.addEventListener('click', () => this.hide());

        // Tab buttons
        this.shadowRoot?.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const tab = btn.getAttribute('data-tab');
                if (tab) this.switchTab(tab as any);
            });
        });

        // Search input
        const searchInput = this.shadowRoot?.querySelector('.search-input') as HTMLInputElement;
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this.searchQuery = (e.target as HTMLInputElement).value;
                this.filterBookmarks();
                this.refreshContent();
            });
        }

        // Platform filter
        const platformFilter = this.shadowRoot?.querySelector('.platform-filter') as HTMLSelectElement;
        if (platformFilter) {
            platformFilter.addEventListener('change', (e) => {
                this.platformFilter = (e.target as HTMLSelectElement).value;
                this.filterBookmarks();
                this.refreshContent();
            });
        }

        // Export button
        this.shadowRoot?.querySelector('.export-btn')?.addEventListener('click', () => {
            this.handleExport();
        });

        // Import button
        this.shadowRoot?.querySelector('.import-btn')?.addEventListener('click', () => {
            this.handleImport();
        });

        // Batch delete button
        this.shadowRoot?.querySelector('.batch-delete-btn')?.addEventListener('click', () => {
            this.handleBatchDelete();
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
     */
    private bindBookmarkListeners(): void {
        // Preview buttons
        this.shadowRoot?.querySelectorAll('.preview-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const url = btn.getAttribute('data-url');
                const position = parseInt(btn.getAttribute('data-position') || '0');
                if (url && position) {
                    this.showDetailModal(url, position);
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

        // Row click for navigation (Go To)
        this.shadowRoot?.querySelectorAll('.bookmark-item').forEach(item => {
            item.addEventListener('click', async (e) => {
                // Don't navigate if clicking checkbox or action buttons
                const target = e.target as HTMLElement;
                if (target.classList.contains('bookmark-checkbox') ||
                    target.closest('.actions') ||
                    target.classList.contains('action-btn')) {
                    return;
                }

                const url = item.getAttribute('data-url');
                const position = parseInt(item.getAttribute('data-position') || '0');
                if (url && position) {
                    await this.handleGoTo(url, position);
                }
            });
        });

        // Checkbox change
        this.shadowRoot?.querySelectorAll('.bookmark-checkbox').forEach(checkbox => {
            checkbox.addEventListener('change', (e) => {
                const target = e.target as HTMLInputElement;
                const key = target.getAttribute('data-key');
                if (!key) return;

                if (target.checked) {
                    this.selectedBookmarks.add(key);
                } else {
                    this.selectedBookmarks.delete(key);
                }

                this.updateBatchDeleteButton();
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

        // Folder checkboxes - select all children recursively
        this.shadowRoot?.querySelectorAll('.folder-checkbox').forEach(checkbox => {
            checkbox.addEventListener('change', (e) => {
                const path = (e.target as HTMLInputElement).dataset.path!;
                const checked = (e.target as HTMLInputElement).checked;
                this.selectFolderRecursive(path, checked);
            });
        });

        // Bookmark checkboxes - individual selection
        this.shadowRoot?.querySelectorAll('.bookmark-checkbox').forEach(checkbox => {
            checkbox.addEventListener('change', (e) => {
                const key = (e.target as HTMLInputElement).dataset.key!;
                const checked = (e.target as HTMLInputElement).checked;

                if (checked) {
                    this.selectedBookmarks.add(key);
                } else {
                    this.selectedBookmarks.delete(key);
                }
                this.updateBatchDeleteButton();
            });
        });

        // Add subfolder buttons
        this.shadowRoot?.querySelectorAll('.add-subfolder').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const path = (btn as HTMLElement).dataset.path!;
                const depth = parseInt((btn as HTMLElement).dataset.depth || '0');

                // Check depth limit (max 3 levels, so depth 2 is the max for adding subfolders)
                if (depth >= 2) {
                    alert('❌ Cannot create subfolder: Maximum folder depth is 3 levels.\n\nPlease create a new root folder or organize within existing folders.');
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
        this.shadowRoot?.querySelectorAll('.preview-bookmark').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const bookmarkItem = (e.target as HTMLElement).closest('.bookmark-item')!;
                const url = (bookmarkItem as HTMLElement).dataset.url!;
                const position = parseInt((bookmarkItem as HTMLElement).dataset.position!);
                this.showDetailModal(url, position);
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

        // Empty state - create first folder
        this.shadowRoot?.querySelector('.create-first-folder')?.addEventListener('click', () => {
            this.showCreateFolderInput(null);
        });
    }

    /**
     * Toggle folder expand/collapse
     */
    private async toggleFolder(path: string): Promise<void> {
        this.folderState.toggleExpand(path);
        this.folderState.setSelectedPath(path);
        await this.folderState.saveLastSelected(path);

        await this.refreshTreeView();
    }

    /**
     * Select folder and all children recursively
     * Reference: VS Code folder selection
     */
    private selectFolderRecursive(path: string, checked: boolean): void {
        // Find all bookmarks in this folder and subfolders
        const bookmarksInFolder = this.bookmarks.filter(b =>
            b.folderPath === path || b.folderPath?.startsWith(path + '/')
        );

        bookmarksInFolder.forEach(bookmark => {
            const key = `${bookmark.urlWithoutProtocol}:${bookmark.position}`;
            if (checked) {
                this.selectedBookmarks.add(key);
            } else {
                this.selectedBookmarks.delete(key);
            }
        });

        this.updateBatchDeleteButton();
        this.refreshTreeView();
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

    private async expandFolder(path: string): Promise<void> {
        if (!this.folderState.isExpanded(path)) {
            this.folderState.toggleExpand(path);
            await this.refreshTreeView();
        }
    }

    private async collapseFolder(path: string): Promise<void> {
        if (this.folderState.isExpanded(path)) {
            this.folderState.toggleExpand(path);
            await this.refreshTreeView();
        }
    }

    /**
     * Refresh tree view (re-render)
     */
    private async refreshTreeView(): Promise<void> {
        const content = this.shadowRoot?.querySelector('.bookmarks-tab .content');
        if (content) {
            content.innerHTML = this.renderTreeView();
            this.bindTreeEventListeners();
        }
    }

    /**
     * Show inline editing for new folder creation
     * Reference: VS Code new folder inline creation
     */
    private showCreateFolderInput(parentPath: string | null): void {
        // For root level creation, we'll use a temporary placeholder in the tree
        // For now, use prompt as a quick implementation
        // TODO: Implement inline creation in tree view
        const name = prompt('Enter folder name:');
        if (!name) return;

        // Validate name
        if (name.length > 50) {
            alert('Folder name must be 50 characters or less');
            return;
        }

        if (name.includes('/')) {
            alert('Folder name cannot contain "/"');
            return;
        }

        this.handleCreateFolder(parentPath, name);
    }

    private async handleCreateFolder(parentPath: string | null, name: string): Promise<void> {
        // Calculate the new folder's path and depth
        const newPath = parentPath ? `${parentPath}/${name}` : name;
        const newDepth = PathUtils.getDepth(newPath);

        // Check depth limit BEFORE calling folderOpsManager
        if (newDepth > 3) {
            alert(`❌ Cannot create folder: Maximum folder depth is 3 levels.\n\nCurrent path would be: ${newPath}\nDepth: ${newDepth}\n\nPlease create a new root folder or organize within existing folders.`);
            logger.warn(`[Folder] Create blocked: depth ${newDepth} exceeds limit for path: ${newPath}`);
            return;
        }

        const result = await this.folderOpsManager.createFolder(parentPath || '', name);

        if (result.success) {
            this.folders = await FolderStorage.getAll();

            if (parentPath) {
                this.folderState.toggleExpand(parentPath);
            }

            await this.refreshTreeView();
            logger.info(`[Folder] Created successfully`);
        } else {
            alert(`Failed to create folder: ${result.error}`);
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
            border: 1px solid #3b82f6;
            border-radius: 4px;
            font-size: 14px;
            font-family: inherit;
            outline: none;
            box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
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
                alert('Folder name must be 50 characters or less');
                input.focus();
                return;
            }

            if (newName.includes('/')) {
                alert('Folder name cannot contain "/"');
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
            alert(`Failed to rename folder: ${result.error}`);
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
            alert('Please remove all items before deleting folder');
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
            alert(`Failed to delete folder: ${result.error}`);
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
    private showDetailModal(url: string, position: number): void {
        const bookmark = this.filteredBookmarks.find(
            b => b.url === url && b.position === position
        );

        if (!bookmark) return;

        const modalOverlay = document.createElement('div');
        modalOverlay.className = 'detail-modal-overlay';

        const modal = document.createElement('div');
        modal.className = 'detail-modal';

        // CRITICAL: Stop propagation on modal to prevent closing main panel
        modal.addEventListener('click', (e) => {
            e.stopPropagation();
        });

        modal.innerHTML = `
            <div class="detail-header">
                <h3>${this.escapeHtml(bookmark.title || bookmark.userMessage.substring(0, 50))}</h3>
                <button class="close-btn">×</button>
            </div>

            <div class="detail-meta">
                <span class="platform-badge ${bookmark.platform?.toLowerCase() || 'chatgpt'}">
                    ${this.getPlatformIcon(bookmark.platform)} ${bookmark.platform || 'ChatGPT'}
                </span>
                <span class="timestamp">${this.formatTimestamp(bookmark.timestamp)}</span>
            </div>

            <div class="detail-url">
                URL: <a href="${this.escapeHtml(bookmark.url)}" target="_blank">${this.escapeHtml(bookmark.urlWithoutProtocol)}</a>
            </div>

            <div class="detail-content">
                <div class="detail-section">
                    <h4>📝 User Message</h4>
                    <div class="detail-text">${this.escapeHtml(bookmark.userMessage)}</div>
                </div>

                ${bookmark.aiResponse ? `
                    <div class="detail-section">
                        <h4>🤖 AI Response</h4>
                        <div class="detail-text">${this.escapeHtml(bookmark.aiResponse)}</div>
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

        modal.querySelector('.open-conversation-btn')?.addEventListener('click', () => {
            window.open(bookmark.url, '_blank');
            modalOverlay.remove();
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
     * Update batch delete button visibility and count
     */
    private updateBatchDeleteButton(): void {
        const batchDeleteBtn = this.shadowRoot?.querySelector('.batch-delete-btn') as HTMLElement;
        const selectedCountSpan = this.shadowRoot?.querySelector('.selected-count');

        if (!batchDeleteBtn) return;

        const count = this.selectedBookmarks.size;

        if (count > 0) {
            batchDeleteBtn.style.display = 'block';
            if (selectedCountSpan) {
                selectedCountSpan.textContent = count.toString();
            }
        } else {
            batchDeleteBtn.style.display = 'none';
        }
    }

    /**
     * Handle batch delete
     */
    private async handleBatchDelete(): Promise<void> {
        if (this.selectedBookmarks.size === 0) return;

        // Show confirmation dialog
        const confirmed = confirm(
            `Delete ${this.selectedBookmarks.size} selected bookmark(s)?\\n\\n` +
            `Tip: You can export your bookmarks first to create a backup.`
        );

        if (!confirmed) return;

        try {
            // Parse keys and delete each bookmark
            const deletePromises: Promise<void>[] = [];

            for (const key of this.selectedBookmarks) {
                // Key format is "url:position", but url may contain "://"
                // So we need to find the last ":" to split correctly
                const lastColonIndex = key.lastIndexOf(':');
                if (lastColonIndex === -1) continue;

                const url = key.substring(0, lastColonIndex);
                const posStr = key.substring(lastColonIndex + 1);
                const position = parseInt(posStr);

                if (url && !isNaN(position)) {
                    deletePromises.push(SimpleBookmarkStorage.remove(url, position));
                }
            }

            await Promise.all(deletePromises);

            logger.info(`[SimpleBookmarkPanel] Batch deleted ${this.selectedBookmarks.size} bookmarks`);

            // Clear selection
            this.selectedBookmarks.clear();

            // Refresh panel
            await this.refresh();
        } catch (error) {
            logger.error('[SimpleBookmarkPanel] Failed to batch delete bookmarks:', error);
        }
    }

    /**
     * Handle export
     */
    private handleExport(): void {
        const data = JSON.stringify(this.bookmarks, null, 2);
        const blob = new Blob([data], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `bookmarks-${Date.now()}.json`;
        a.click();
        URL.revokeObjectURL(url);
        logger.info('[SimpleBookmarkPanel] Exported bookmarks');
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

                // Detect conflicts
                const conflicts = await this.detectConflicts(bookmarks);

                // Handle conflicts if any
                if (conflicts.length > 0) {
                    const shouldMerge = await this.showConflictDialog(conflicts, bookmarks);
                    if (!shouldMerge) {
                        logger.info('[Import] User cancelled import');
                        return;
                    }
                }

                // Import all bookmarks (merge will overwrite duplicates)
                await this.importBookmarks(bookmarks, false);

                // Refresh panel
                await this.refresh();

                // Show success message
                alert(`✅ Successfully imported ${bookmarks.length} bookmark(s)!`);
                logger.info(`[Import] Successfully imported ${bookmarks.length} bookmarks`);
            } catch (error) {
                logger.error('[Import] Failed:', error);
                const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                alert(`❌ Import failed: ${errorMessage}`);
            }
        };

        // Trigger file picker
        input.click();
    }

    /**
     * Validate import data
     */
    private validateImportData(data: any): Bookmark[] {
        if (!Array.isArray(data)) {
            throw new Error('Invalid format: expected an array of bookmarks');
        }

        const validBookmarks: Bookmark[] = [];
        const errors: string[] = [];

        data.forEach((item, index) => {
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
        return new Promise((resolve) => {
            const modalOverlay = document.createElement('div');
            modalOverlay.className = 'conflict-dialog-overlay';

            const modal = document.createElement('div');
            modal.className = 'conflict-dialog';

            modal.innerHTML = `
                <div class="conflict-header">
                    <h3>⚠️ Duplicate Bookmarks Detected</h3>
                </div>

                <div class="conflict-body">
                    <p>Found <strong>${conflicts.length}</strong> bookmark(s) that already exist.</p>
                    <p>Total bookmarks to import: <strong>${allBookmarks.length}</strong></p>
                    <p style="margin-top: 16px; color: #6b7280;">Click <strong>Merge</strong> to import all bookmarks (duplicates will be overwritten).</p>

                    <div class="conflict-list">
                        ${conflicts.slice(0, 5).map(b => `
                            <div class="conflict-item">
                                <span class="platform-badge ${b.platform?.toLowerCase() || 'chatgpt'}">
                                    ${this.getPlatformIcon(b.platform)} ${b.platform || 'ChatGPT'}
                                </span>
                                <span class="conflict-title">${this.escapeHtml(this.truncate(b.title || b.userMessage, 50))}</span>
                            </div>
                        `).join('')}
                        ${conflicts.length > 5 ? `<div class="conflict-more">... and ${conflicts.length - 5} more</div>` : ''}
                    </div>
                </div>

                <div class="conflict-footer">
                    <button class="conflict-btn cancel-btn">Cancel</button>
                    <button class="conflict-btn merge-btn">Merge</button>
                </div>
            `;

            modalOverlay.appendChild(modal);
            this.shadowRoot?.appendChild(modalOverlay);

            // CRITICAL: Stop propagation on modal to prevent closing main panel
            modal.addEventListener('click', (e) => {
                e.stopPropagation();
            });

            // Bind buttons
            modal.querySelector('.merge-btn')?.addEventListener('click', () => {
                modalOverlay.remove();
                resolve(true);
            });

            modal.querySelector('.cancel-btn')?.addEventListener('click', () => {
                modalOverlay.remove();
                resolve(false);
            });

            // Click outside to cancel
            modalOverlay.addEventListener('click', (e) => {
                if (e.target === modalOverlay) {
                    modalOverlay.remove();
                    resolve(false);
                }
            });
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

            // Save bookmark with original timestamp
            promises.push(
                SimpleBookmarkStorage.save(
                    bookmark.url,
                    bookmark.position,
                    bookmark.userMessage,
                    bookmark.aiResponse,
                    bookmark.title,
                    bookmark.platform,
                    bookmark.timestamp  // Preserve original timestamp from JSON
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
            :host {
                all: initial;
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
                max-width: 900px;
                max-height: 80vh;
                background: white;
                border-radius: 12px;
                box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
                display: flex;
                z-index: 2147483647;
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
                overflow: hidden;
            }

            .toolbar {
                display: flex;
                gap: 8px;
                padding: 12px;
                background: #f9fafb;
                border-bottom: 1px solid #e5e7eb;
                align-items: center;
                flex-wrap: wrap;
            }

            .toolbar-divider {
                width: 1px;
                height: 24px;
                background: #d1d5db;
                margin: 0 4px;
            }

            .new-folder-btn,
            .export-btn,
            .import-btn {
                padding: 6px 12px;
                border: 1px solid #d1d5db;
                background: white;
                border-radius: 6px;
                font-size: 13px;
                cursor: pointer;
                transition: all 0.15s ease;
                white-space: nowrap;
            }

            .new-folder-btn:hover,
            .export-btn:hover,
            .import-btn:hover {
                background: #f3f4f6;
                border-color: #9ca3af;
            }

            .new-folder-btn {
                font-weight: 500;
                color: #3b82f6;
                border-color: #3b82f6;
            }

            .new-folder-btn:hover {
                background: #eff6ff;
            }

            /* Sidebar */
            .sidebar {
                width: 120px;
                background: #f9fafb;
                border-right: 1px solid #e5e7eb;
                display: flex;
                flex-direction: column;
                padding: 16px 0;
            }

            .tab-btn {
                display: flex;
                flex-direction: column;
                align-items: center;
                gap: 8px;
                padding: 16px 12px;
                border: none;
                background: transparent;
                cursor: pointer;
                transition: all 0.2s;
                color: #6b7280;
                font-size: 12px;
            }

            .tab-btn:hover {
                background: #f3f4f6;
                color: #111827;
            }

            .tab-btn.active {
                background: white;
                color: #3b82f6;
                font-weight: 500;
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
                padding: 20px 24px;
                border-bottom: 1px solid #e5e7eb;
                display: flex;
                justify-content: space-between;
                align-items: center;
            }

            .header h2 {
                margin: 0;
                font-size: 20px;
                font-weight: 600;
                color: #111827;
            }

            .close-btn {
                background: none;
                border: none;
                font-size: 28px;
                color: #6b7280;
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
                background: #f3f4f6;
                color: #111827;
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
                padding: 12px 24px;
                border-bottom: 1px solid #e5e7eb;
                display: flex;
                gap: 12px;
                align-items: center;
            }

            .search-input {
                flex: 1;
                padding: 8px 12px;
                border: 1px solid #d1d5db;
                border-radius: 6px;
                font-size: 14px;
                font-family: inherit;
            }

            .search-input:focus {
                outline: none;
                border-color: #3b82f6;
                box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
            }

            .platform-filter {
                padding: 8px 12px;
                border: 1px solid #d1d5db;
                border-radius: 6px;
                font-size: 14px;
                background: white;
                cursor: pointer;
            }

            .export-btn {
                padding: 8px 16px;
                background: #3b82f6;
                color: white;
                border: none;
                border-radius: 6px;
                font-size: 14px;
                cursor: pointer;
                transition: all 0.2s;
            }

            .export-btn:hover {
                background: #2563eb;
            }

            /* Content */
            .content {
                flex: 1;
                overflow-y: auto;
                padding: 16px 24px;
            }

            .empty {
                text-align: center;
                padding: 60px 20px;
                color: #6b7280;
                font-size: 15px;
            }

            /* Bookmark list */
            .bookmark-list {
                display: flex;
                flex-direction: column;
                gap: 8px;
            }

            .bookmark-item {
                display: flex;
                align-items: center;
                gap: 12px;
                padding: 10px 16px;
                background: #f9fafb;
                border: 1px solid #e5e7eb;
                border-radius: 8px;
                transition: all 0.2s ease;
                cursor: pointer;
            }

            .bookmark-item:hover {
                background: #f3f4f6;
                box-shadow: 0 2px 8px rgba(59, 130, 246, 0.1);
            }

            .platform-badge {
                flex-shrink: 0;
                padding: 4px 10px;
                border-radius: 4px;
                font-size: 12px;
                font-weight: 500;
                min-width: 90px;
                text-align: center;
            }

            .platform-badge.chatgpt {
                background: #d1fae5;
                color: #065f46;
            }

            .platform-badge.gemini {
                background: #dbeafe;
                color: #1e40af;
            }

            .title {
                flex: 2;
                font-size: 14px;
                font-weight: 500;
                color: #111827;
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
            }

            .response {
                flex: 3;
                font-size: 13px;
                color: #6b7280;
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
            }

            .notes {
                flex: 1;
                font-size: 13px;
                color: #9ca3af;
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
            }

            .time {
                flex-shrink: 0;
                font-size: 12px;
                color: #9ca3af;
                min-width: 40px;
            }

            .actions {
                flex-shrink: 0;
                display: flex;
                gap: 4px;
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
                background: rgba(0, 0, 0, 0.05);
                transform: scale(1.1);
            }

            .delete-btn:hover {
                background: rgba(220, 38, 38, 0.1);
            }

            /* Settings content */
            .settings-content,
            .support-content {
                padding: 40px;
                text-align: center;
            }

            .settings-content h3,
            .support-content h3 {
                margin: 0 0 16px 0;
                font-size: 18px;
                color: #111827;
            }

            .settings-content p,
            .support-content p {
                color: #6b7280;
                margin: 0 0 24px 0;
            }
            /* Support button */
            .support-btn {
                display: inline-block;
                padding: 12px 24px;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
                text-decoration: none;
                border-radius: 8px;
                font-weight: 500;
                transition: transform 0.2s ease;
            }

            .support-btn:hover {
                transform: translateY(-2px);
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
                z-index: 2147483648;
            }

            .conflict-dialog {
                background: white;
                border-radius: 12px;
                box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
                max-width: 500px;
                width: 90%;
                max-height: 80vh;
                overflow: hidden;
                display: flex;
                flex-direction: column;
            }

            .conflict-header {
                padding: 20px 24px;
                border-bottom: 1px solid #e5e7eb;
                background: #fef3c7;
            }

            .conflict-header h3 {
                margin: 0;
                font-size: 18px;
                font-weight: 600;
                color: #92400e;
            }

            .conflict-body {
                padding: 24px;
                overflow-y: auto;
                flex: 1;
            }

            .conflict-body p {
                margin: 0 0 16px 0;
                color: #374151;
                font-size: 14px;
            }

            .conflict-list {
                margin-top: 16px;
                border: 1px solid #e5e7eb;
                border-radius: 8px;
                overflow: hidden;
            }

            .conflict-item {
                padding: 12px;
                border-bottom: 1px solid #e5e7eb;
                display: flex;
                align-items: center;
                gap: 12px;
            }

            .conflict-item:last-child {
                border-bottom: none;
            }

            .conflict-title {
                flex: 1;
                font-size: 13px;
                color: #374151;
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
            }

            .conflict-more {
                padding: 12px;
                text-align: center;
                font-size: 13px;
                color: #6b7280;
                font-style: italic;
            }

            .conflict-footer {
                padding: 16px 24px;
                border-top: 1px solid #e5e7eb;
                display: flex;
                gap: 12px;
                justify-content: flex-end;
                background: #f9fafb;
            }

            .toolbar button {
                padding: 8px 12px;
                border: 1px solid #e5e7eb;
                background: #f3f4f6;
                border-radius: 6px;
                font-size: 14px;
                cursor: pointer;
                transition: all 0.2s ease;
                display: inline-flex;
                align-items: center;
                justify-content: center;
                color: #6b7280;
            }

            .toolbar button:hover {
                background: #e5e7eb;
                border-color: #9ca3af;
                color: #374151;
            }

            .toolbar button svg {
                display: block;
            }

            .merge-btn {
                background: #3b82f6;
                color: white;
            }

            .merge-btn:hover {
                background: #2563eb;
            }

            .cancel-btn {
                background: #e5e7eb;
                color: #374151;
            }

            .cancel-btn:hover {
                background: #d1d5db;
            }

            /* Detail Modal */
            .detail-modal-overlay {
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: rgba(0, 0, 0, 0.5);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 2147483648;
            }

            .detail-modal {
                background: white;
                border-radius: 12px;
                width: 90%;
                max-width: 700px;
                max-height: 80vh;
                display: flex;
                flex-direction: column;
                box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
            }

            .detail-header {
                padding: 20px 24px;
                border-bottom: 1px solid #e5e7eb;
                display: flex;
                justify-content: space-between;
                align-items: center;
            }

            .detail-header h3 {
                margin: 0;
                font-size: 18px;
                font-weight: 600;
                color: #111827;
            }

            .detail-meta {
                padding: 12px 24px;
                background: #f9fafb;
                display: flex;
                gap: 16px;
                align-items: center;
            }

            .detail-url {
                padding: 12px 24px;
                font-size: 13px;
                color: #6b7280;
            }

            .detail-url a {
                color: #3b82f6;
                text-decoration: none;
            }

            .detail-content {
                flex: 1;
                overflow-y: auto;
                padding: 24px;
            }

            .detail-section {
                margin-bottom: 24px;
            }

            .detail-section h4 {
                margin: 0 0 12px 0;
                font-size: 14px;
                font-weight: 600;
                color: #374151;
            }

            .detail-text {
                line-height: 1.6;
                color: #111827;
                white-space: pre-wrap;
                word-break: break-word;
            }

            .detail-footer {
                padding: 16px 24px;
                border-top: 1px solid #e5e7eb;
                display: flex;
                justify-content: flex-end;
            }

            .open-conversation-btn {
                padding: 10px 20px;
                background: #3b82f6;
                color: white;
                border: none;
                border-radius: 6px;
                font-size: 14px;
                font-weight: 500;
                cursor: pointer;
                transition: background 0.2s;
            }

            .open-conversation-btn:hover {
                background: #2563eb;
            }

            /* ============================================================================
               Tree View Styles
               ============================================================================ */

            /* Tree Container */
            .tree-view {
                flex: 1;
                overflow-y: auto;
                overflow-x: hidden;
                background: white;
            }

            /* Custom Scrollbar (macOS-style) */
            .tree-view::-webkit-scrollbar {
                width: 8px;
            }

            .tree-view::-webkit-scrollbar-track {
                background: transparent;
            }

            .tree-view::-webkit-scrollbar-thumb {
                background: #d1d5db;
                border-radius: 4px;
            }

            .tree-view::-webkit-scrollbar-thumb:hover {
                background: #9ca3af;
            }

            /* Tree Item Base */
            .tree-item {
                display: flex;
                align-items: center;
                min-height: 36px;
                padding: 6px 12px;
                border-bottom: 1px solid #f3f4f6;
                position: relative;
                cursor: pointer;
                transition: background-color 0.15s ease;
                user-select: none;
            }

            .tree-item:hover {
                background: #f9fafb;
            }

            .tree-item:focus {
                outline: 2px solid #3b82f6;
                outline-offset: -2px;
                z-index: 1;
            }

            .tree-item:focus:not(:focus-visible) {
                outline: none;
            }

            /* Folder Styles */
            .folder-item {
                font-weight: 500;
                background: #fafafa;
            }

            .folder-item.selected {
                background: #eff6ff;
                border-left: 3px solid #3b82f6;
            }

            .folder-icon {
                font-size: 16px;
                margin-right: 8px;
                flex-shrink: 0;
            }

            .folder-name {
                flex: 1;
                font-size: 14px;
                color: #111827;
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
            }

            /* Bookmark Styles */
            .bookmark-item {
                background: white;
            }

            .platform-icon {
                font-size: 16px;
                margin-right: 8px;
                flex-shrink: 0;
            }

            .bookmark-title {
                flex: 1;
                font-size: 13px;
                color: #374151;
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
                padding-right: 220px; /* Reserve space for timestamp + actions */
            }

            .bookmark-timestamp {
                position: absolute;
                right: 120px; /* Space for action buttons */
                font-size: 11px;
                color: #9ca3af;
                pointer-events: none;
                white-space: nowrap;
            }

            /* Checkboxes */
            .item-checkbox {
                margin-right: 8px;
                cursor: pointer;
                width: 16px;
                height: 16px;
                flex-shrink: 0;
            }

            .item-checkbox:focus {
                outline: 2px solid #3b82f6;
                outline-offset: 2px;
            }

            /* Action Buttons */
            .item-actions {
                display: none;
                gap: 4px;
                margin-left: auto;
                flex-shrink: 0;
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
                outline: 2px solid #3b82f6;
                outline-offset: -2px;
            }

            .action-btn.delete-folder:hover,
            .action-btn.delete-bookmark:hover {
                background: rgba(239, 68, 68, 0.1);
                color: #ef4444;
            }

            /* Empty State */
            .tree-empty {
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                padding: 64px 32px;
                text-align: center;
                color: #6b7280;
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
                color: #374151;
            }

            .tree-empty p {
                margin: 0 0 24px 0;
                font-size: 14px;
                color: #6b7280;
            }

            .btn-primary,
            .create-first-folder {
                padding: 10px 20px;
                background: #3b82f6;
                color: white;
                border: none;
                border-radius: 6px;
                font-size: 14px;
                font-weight: 500;
                cursor: pointer;
                transition: background 0.15s ease;
            }

            .btn-primary:hover,
            .create-first-folder:hover {
                background: #2563eb;
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
                    border: 2px solid #3b82f6;
                }
            }

            /* Loading State */
            .tree-loading {
                display: flex;
                align-items: center;
                justify-content: center;
                padding: 40px;
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

            @media (prefers-color-scheme: dark) {
                .panel {
                    background: #1f2937;
                }

                .sidebar {
                    background: #111827;
                    border-color: #374151;
                }

                .tab-btn.active {
                    background: #1f2937;
                }

                .header {
                    border-color: #374151;
                }

                .header h2 {
                    color: #f9fafb;
                }

                .close-btn {
                    color: #9ca3af;
                }

                .close-btn:hover {
                    background: #374151;
                    color: #f9fafb;
                }

                .toolbar {
                    border-color: #374151;
                }

                .search-input,
                .platform-filter {
                    background: #111827;
                    border-color: #374151;
                    color: #f9fafb;
                }

                .bookmark-item {
                    background: #111827;
                    border-color: #374151;
                }

                .bookmark-item:hover {
                    background: #1f2937;
                    border-color: #4b5563;
                }

                .title {
                    color: #f9fafb;
                }

                .response {
                    color: #9ca3af;
                }

                .detail-modal {
                    background: #1f2937;
                }

                .detail-header {
                    border-color: #374151;
                }

                .detail-header h3 {
                    color: #f9fafb;
                }

                .detail-meta {
                    background: #111827;
                }

                .detail-text {
                    color: #f9fafb;
                }

                .detail-footer {
                    border-color: #374151;
                }
            }
        `;
    }
}

// Singleton instance
export const simpleBookmarkPanel = new SimpleBookmarkPanel();
