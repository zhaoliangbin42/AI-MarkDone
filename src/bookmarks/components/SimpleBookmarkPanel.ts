
import { SimpleBookmarkStorage } from '../storage/SimpleBookmarkStorage';
import { Bookmark } from '../storage/types';
import { logger } from '../../utils/logger';

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

    /**
     * Show the bookmark panel
     */
    async show(): Promise<void> {
        if (this.overlay) {
            this.overlay.style.display = 'flex';
            await this.refresh();
            return;
        }

        // Load all bookmarks
        this.bookmarks = await SimpleBookmarkStorage.getAllBookmarks();
        this.filteredBookmarks = [...this.bookmarks];
        logger.info(`[SimpleBookmarkPanel] Loaded ${this.bookmarks.length} bookmarks`);

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
                        <input 
                            type="search" 
                            class="search-input" 
                            placeholder="🔍 Search bookmarks..."
                        />
                        <select class="platform-filter">
                            <option value="">All Platforms</option>
                            <option value="ChatGPT">ChatGPT</option>
                            <option value="Gemini">Gemini</option>
                        </select>
                        <button class="export-btn">📤 Export</button>
                    </div>

                    <div class="content">
                        ${this.renderBookmarkList()}
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
     * Render bookmark list (flex rows)
     */
    private renderBookmarkList(): string {
        if (this.filteredBookmarks.length === 0) {
            return '<div class="empty">No bookmarks found.</div>';
        }

        return `
            <div class="bookmark-list">
                ${this.filteredBookmarks.map(b => `
                    <div class="bookmark-item" data-url="${this.escapeHtml(b.url)}" data-position="${b.position}">
                        <span class="platform-badge ${b.platform?.toLowerCase() || 'chatgpt'}">
                            ${this.getPlatformIcon(b.platform)} ${b.platform || 'ChatGPT'}
                        </span>
                        <span class="title" title="${this.escapeHtml(b.title || b.userMessage)}">
                            ${this.escapeHtml(this.truncate(b.title || b.userMessage, 40))}
                        </span>
                        <span class="response" title="${this.escapeHtml(b.aiResponse || '')}">
                            ${this.escapeHtml(this.truncate(b.aiResponse || '', 50))}
                        </span>
                        <span class="notes" title="${this.escapeHtml(b.notes || '')}">
                            ${this.escapeHtml(this.truncate(b.notes || '', 20))}
                        </span>
                        <span class="time">${this.formatTimestamp(b.timestamp)}</span>
                        <div class="actions">
                            <button class="action-btn preview-btn" data-url="${this.escapeHtml(b.url)}" data-position="${b.position}" title="Preview">👁</button>
                            <button class="action-btn edit-btn" data-url="${this.escapeHtml(b.url)}" data-position="${b.position}" title="Edit">✏️</button>
                            <button class="action-btn delete-btn" data-url="${this.escapeHtml(b.url)}" data-position="${b.position}" title="Delete">🗑</button>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
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
                content.innerHTML = this.renderBookmarkList();
                this.bindBookmarkListeners();
            }

            const header = this.shadowRoot.querySelector('h2');
            if (header) {
                header.textContent = `📌 Bookmarks (${this.bookmarks.length})`;
            }
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

        // Bookmark list listeners
        this.bindBookmarkListeners();
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

        // Row click for detail modal
        this.shadowRoot?.querySelectorAll('.bookmark-item').forEach(item => {
            item.addEventListener('click', () => {
                const url = item.getAttribute('data-url');
                const position = parseInt(item.getAttribute('data-position') || '0');
                if (url && position) {
                    this.showDetailModal(url, position);
                }
            });
        });
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

                ${bookmark.notes ? `
                    <div class="detail-section">
                        <h4>📌 Notes</h4>
                        <div class="detail-text">${this.escapeHtml(bookmark.notes)}</div>
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
        // TODO: Implement edit modal
        logger.info(`[SimpleBookmarkPanel] Edit bookmark: ${url}:${position}`);
    }

    /**
     * Handle delete
     */
    private async handleDelete(url: string, position: number): Promise<void> {
        try {
            await SimpleBookmarkStorage.remove(url, position);
            logger.info(`[SimpleBookmarkPanel] Deleted bookmark at position ${position}`);
            await this.refresh();
        } catch (error) {
            logger.error('[SimpleBookmarkPanel] Failed to delete bookmark:', error);
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

            .support-btn {
                display: inline-block;
                padding: 12px 24px;
                background: #3b82f6;
                color: white;
                text-decoration: none;
                border-radius: 6px;
                font-weight: 500;
                transition: all 0.2s;
            }

            .support-btn:hover {
                background: #2563eb;
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
