import { Folder, FolderTreeNode } from '../storage/types';
import { FolderStorage } from '../storage/FolderStorage';
import { TreeBuilder } from '../utils/tree-builder';
import { logger } from '../../utils/logger';

/**
 * Folder Picker Modal
 * Reusable modal component for folder selection
 * Pattern: VS Code QuickPick, follows BookmarkEditModal structure
 */
export class FolderPickerModal {
    private overlay: HTMLElement | null = null;
    private modal: HTMLElement | null = null;
    private folders: Folder[] = [];
    private selectedPath: string | null = null;
    private expandedPaths: Set<string> = new Set();
    private onConfirm: ((path: string) => void) | null = null;
    private escKeyHandler: ((e: KeyboardEvent) => void) | null = null;

    /**
     * Show folder picker modal
     * @param options Configuration options
     */
    async show(options: {
        currentPath?: string;
        onConfirm: (path: string) => void;
    }): Promise<void> {
        this.onConfirm = options.onConfirm;
        this.selectedPath = options.currentPath || null;

        // Load folders
        this.folders = await FolderStorage.getAll();
        logger.debug(`[FolderPickerModal] Loaded ${this.folders.length} folders`);

        // Create overlay (following BookmarkEditModal pattern - NO Shadow DOM)
        this.overlay = document.createElement('div');
        this.overlay.className = 'folder-picker-modal-overlay';
        this.overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.5);
            backdrop-filter: blur(4px);
            z-index: 2147483647;
            display: flex;
            align-items: center;
            justify-content: center;
            animation: fadeIn 0.2s ease-out;
        `;

        // Create modal
        this.modal = this.createModal();
        this.overlay.appendChild(this.modal);

        // Add to body
        document.body.appendChild(this.overlay);

        // Click outside to close
        this.overlay.addEventListener('click', (e) => {
            if (e.target === this.overlay) {
                this.hide();
            }
        });

        // ESC key to close
        this.escKeyHandler = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                this.hide();
            }
        };
        document.addEventListener('keydown', this.escKeyHandler);

        // Render folder tree
        this.renderFolderTree();

        logger.info('[FolderPickerModal] Modal shown');
    }

    /**
     * Hide and cleanup modal
     */
    hide(): void {
        if (this.overlay && this.overlay.parentNode) {
            this.overlay.remove();
        }

        if (this.escKeyHandler) {
            document.removeEventListener('keydown', this.escKeyHandler);
            this.escKeyHandler = null;
        }

        this.overlay = null;
        this.modal = null;
        this.onConfirm = null;

        logger.debug('[FolderPickerModal] Modal hidden');
    }

    /**
     * Create modal structure
     */
    private createModal(): HTMLElement {
        const modal = document.createElement('div');
        modal.className = 'folder-picker-modal';

        // Inline styles for modal container
        modal.style.cssText = `
            position: relative;
            width: 90%;
            max-width: 400px;
            max-height: 80vh;
            background: white;
            border-radius: 12px;
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            display: flex;
            flex-direction: column;
            animation: slideIn 0.2s ease-out;
        `;

        // Stop propagation on modal content
        modal.addEventListener('click', (e) => {
            e.stopPropagation();
        });

        modal.innerHTML = `
            <style>
                @keyframes fadeIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
                
                @keyframes slideIn {
                    from {
                        opacity: 0;
                        transform: translateY(-20px) scale(0.95);
                    }
                    to {
                        opacity: 1;
                        transform: translateY(0) scale(1);
                    }
                }

                .folder-picker-modal * {
                    box-sizing: border-box;
                }

                .folder-picker-modal-header {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    padding: 16px 20px;
                    border-bottom: 1px solid #e5e7eb;
                }

                .folder-picker-modal-header h2 {
                    margin: 0;
                    font-size: 16px;
                    font-weight: 600;
                    color: #111827;
                }

                .folder-picker-header-actions {
                    display: flex;
                    gap: 8px;
                    align-items: center;
                }

                .folder-picker-create-btn {
                    background: #3b82f6;
                    color: white;
                    border: none;
                    padding: 6px 12px;
                    border-radius: 6px;
                    font-size: 13px;
                    font-weight: 500;
                    cursor: pointer;
                    transition: background 0.15s ease;
                }

                .folder-picker-create-btn:hover {
                    background: #2563eb;
                }

                .folder-picker-modal-close-btn {
                    background: none;
                    border: none;
                    font-size: 24px;
                    color: #6b7280;
                    cursor: pointer;
                    padding: 0;
                    width: 32px;
                    height: 32px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    border-radius: 6px;
                    transition: all 0.15s ease;
                }

                .folder-picker-modal-close-btn:hover {
                    background: #f3f4f6;
                    color: #111827;
                }

                .folder-picker-modal-body {
                    flex: 1;
                    overflow-y: auto;
                    padding: 12px 0;
                    min-height: 200px;
                    max-height: 400px;
                }

                .folder-picker-modal-footer {
                    display: flex;
                    gap: 8px;
                    justify-content: flex-end;
                    padding: 16px 20px;
                    border-top: 1px solid #e5e7eb;
                }

                .folder-picker-modal-btn {
                    padding: 8px 16px;
                    border-radius: 6px;
                    font-size: 14px;
                    font-weight: 500;
                    cursor: pointer;
                    transition: all 0.15s ease;
                    border: none;
                }

                .folder-picker-modal-btn-cancel {
                    background: #f3f4f6;
                    color: #374151;
                }

                .folder-picker-modal-btn-cancel:hover {
                    background: #e5e7eb;
                }

                .folder-picker-modal-btn-select {
                    background: #3b82f6;
                    color: white;
                }

                .folder-picker-modal-btn-select:hover:not(:disabled) {
                    background: #2563eb;
                }

                .folder-picker-modal-btn-select:disabled {
                    background: #9ca3af;
                    cursor: not-allowed;
                    opacity: 0.6;
                }

                .folder-picker-empty {
                    padding: 40px 20px;
                    text-align: center;
                    color: #6b7280;
                }

                .folder-picker-empty-icon {
                    font-size: 48px;
                    margin-bottom: 12px;
                }

                .folder-picker-empty-text {
                    font-size: 14px;
                }

                .folder-picker-item {
                    display: flex;
                    align-items: center;
                    padding: 8px 20px;
                    cursor: pointer;
                    transition: background 0.15s ease;
                    user-select: none;
                }

                .folder-picker-item:hover {
                    background: #f3f4f6;
                }

                .folder-picker-item.selected {
                    background: #dbeafe;
                }

                .folder-picker-item.selected:hover {
                    background: #bfdbfe;
                }

                .folder-picker-icon {
                    margin-right: 8px;
                    font-size: 16px;
                }

                .folder-picker-name {
                    font-size: 14px;
                    color: #111827;
                }
            </style>

            <div class="folder-picker-modal-header">
                <h2>Select Folder</h2>
                <div class="folder-picker-header-actions">
                    <button class="folder-picker-create-btn" title="Create New Folder">➕ Create Folder</button>
                    <button class="folder-picker-modal-close-btn" aria-label="Close">×</button>
                </div>
            </div>

            <div class="folder-picker-modal-body">
                <div class="folder-picker-empty">
                    <div class="folder-picker-empty-icon">📁</div>
                    <div class="folder-picker-empty-text">Loading folders...</div>
                </div>
            </div>

            <div class="folder-picker-modal-footer">
                <button class="folder-picker-modal-btn folder-picker-modal-btn-cancel">Cancel</button>
                <button class="folder-picker-modal-btn folder-picker-modal-btn-select" disabled>Select</button>
            </div>
        `;

        this.bindEvents(modal);

        return modal;
    }

    /**
     * Bind event listeners
     */
    private bindEvents(modal: HTMLElement): void {
        // Create folder button
        const createBtn = modal.querySelector('.folder-picker-create-btn');
        createBtn?.addEventListener('click', () => this.showCreateFolderInput());

        // Close button
        const closeBtn = modal.querySelector('.folder-picker-modal-close-btn');
        closeBtn?.addEventListener('click', () => this.hide());

        // Cancel button
        const cancelBtn = modal.querySelector('.folder-picker-modal-btn-cancel');
        cancelBtn?.addEventListener('click', () => this.hide());

        // Select button
        const selectBtn = modal.querySelector('.folder-picker-modal-btn-select');
        selectBtn?.addEventListener('click', () => this.handleConfirm());

        // Enter key to confirm
        modal.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && this.selectedPath) {
                this.handleConfirm();
            }
        });
    }

    /**
     * Render folder tree in modal body
     */
    private renderFolderTree(): void {
        if (!this.modal) return;

        const body = this.modal.querySelector('.folder-picker-modal-body');
        if (!body) return;

        // Build tree structure (folders only, no bookmarks)
        const tree = TreeBuilder.buildTree(this.folders, [], new Set<string>(), null);

        if (tree.length === 0) {
            body.innerHTML = `
                <div class="folder-picker-empty">
                    <div class="folder-picker-empty-icon">📁</div>
                    <div class="folder-picker-empty-text">No folders yet. Create one to get started!</div>
                </div>
            `;
            return;
        }

        // Render tree nodes
        body.innerHTML = this.renderTreeNodes(tree, 0);

        // Bind folder click handlers
        this.bindFolderClickHandlers();
    }

    /**
     * Render tree nodes recursively
     */
    private renderTreeNodes(nodes: FolderTreeNode[], depth: number): string {
        return nodes.map(node => {
            const isExpanded = this.expandedPaths.has(node.folder.path);
            const isSelected = node.folder.path === this.selectedPath;
            const icon = isExpanded ? '📂' : '📁';
            const indent = depth * 20;

            let html = `
                <div class="folder-picker-item ${isSelected ? 'selected' : ''}"
                     data-path="${this.escapeAttr(node.folder.path)}"
                     data-depth="${depth}"
                     style="padding-left: ${indent}px">
                    <span class="folder-picker-icon">${icon}</span>
                    <span class="folder-picker-name">${this.escapeHtml(node.folder.name)}</span>
                </div>
            `;

            // Render children if expanded
            if (isExpanded && node.children.length > 0) {
                html += this.renderTreeNodes(node.children, depth + 1);
            }

            return html;
        }).join('');
    }

    /**
     * Bind click handlers to folder items
     */
    private bindFolderClickHandlers(): void {
        if (!this.modal) return;

        const folderItems = this.modal.querySelectorAll('.folder-picker-item');
        folderItems.forEach(item => {
            item.addEventListener('click', (e) => {
                e.stopPropagation();
                const path = (item as HTMLElement).dataset.path!;
                this.handleFolderClick(path);
            });
        });
    }

    /**
     * Handle folder click (select + expand/collapse)
     */
    private handleFolderClick(path: string): void {
        // Toggle expansion
        if (this.expandedPaths.has(path)) {
            this.expandedPaths.delete(path);
        } else {
            this.expandedPaths.add(path);
        }

        // Select folder
        this.selectedPath = path;

        // Re-render tree
        this.renderFolderTree();

        // Update select button state
        this.updateSelectButtonState();

        logger.debug(`[FolderPickerModal] Folder clicked: ${path}`);
    }

    /**
     * Show inline input for creating new folder
     */
    private showCreateFolderInput(): void {
        const name = prompt('Enter folder name:');
        if (!name) return;

        // Validate name
        if (name.length > 50) {
            alert('❌ Folder name too long (max 50 characters)');
            return;
        }

        if (name.includes('/')) {
            alert('❌ Folder name cannot contain "/"');
            return;
        }

        // Check for duplicate
        const exists = this.folders.find(f => f.path === name);
        if (exists) {
            alert(`❌ Folder "${name}" already exists`);
            return;
        }

        // Create folder
        this.createFolder(name);
    }

    /**
     * Create new folder
     */
    private async createFolder(name: string): Promise<void> {
        try {
            await FolderStorage.create(name);
            logger.info(`[FolderPickerModal] Created folder: ${name}`);

            // Reload folders
            this.folders = await FolderStorage.getAll();

            // Auto-select newly created folder
            this.selectedPath = name;
            this.expandedPaths.add(name);

            // Re-render tree
            this.renderFolderTree();

            // Update select button
            this.updateSelectButtonState();
        } catch (error) {
            logger.error('[FolderPickerModal] Failed to create folder:', error);
            alert(`❌ Failed to create folder: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    /**
     * Update select button enabled/disabled state
     */
    private updateSelectButtonState(): void {
        if (!this.modal) return;

        const selectBtn = this.modal.querySelector('.folder-picker-modal-btn-select') as HTMLButtonElement;
        if (selectBtn) {
            selectBtn.disabled = !this.selectedPath;
        }
    }

    /**
     * Escape HTML special characters
     */
    private escapeHtml(text: string): string {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    /**
     * Escape attribute value
     */
    private escapeAttr(text: string): string {
        return text.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }

    /**
     * Handle confirm action
     */
    private handleConfirm(): void {
        if (!this.selectedPath || !this.onConfirm) return;

        logger.info(`[FolderPickerModal] Folder selected: ${this.selectedPath}`);
        this.onConfirm(this.selectedPath);
        this.hide();
    }
}
