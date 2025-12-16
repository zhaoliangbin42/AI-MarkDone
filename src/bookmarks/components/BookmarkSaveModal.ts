import { Folder, FolderTreeNode } from '../storage/types';
import { FolderStorage } from '../storage/FolderStorage';
import { TreeBuilder } from '../utils/tree-builder';
import { PathUtils } from '../utils/path-utils';
import { logger } from '../../utils/logger';
import { Icons } from '../../assets/icons';

/**
 * Unified Bookmark Save Modal
 * Combines title editing and folder selection in one modal
 * Pattern: Notion-style inline editing + VS Code tree view
 */
export class BookmarkSaveModal {
    private overlay: HTMLElement | null = null;
    private modal: HTMLElement | null = null;

    // State
    private folders: Folder[] = [];
    private selectedPath: string | null = null;
    private expandedPaths: Set<string> = new Set();
    private title: string = '';
    private titleValid: boolean = true;
    private currentMode: 'create' | 'edit' | 'folder-select' = 'create';

    // Callbacks
    private onSave: ((title: string, folderPath: string) => void) | null = null;
    private escKeyHandler: ((e: KeyboardEvent) => void) | null = null;

    /**
     * Show save modal
     */
    async show(options: {
        mode?: 'create' | 'edit' | 'folder-select';
        defaultTitle?: string;
        lastUsedFolder?: string;
        currentFolder?: string; // For edit mode
        bookmarkCount?: number; // For folder-select mode
        onSave?: (title: string, folderPath: string) => void;
        onFolderSelect?: (folderPath: string | null) => void;
    }): Promise<string | null | undefined | void> {
        const mode = options.mode || 'create';
        this.currentMode = mode;

        if (mode === 'folder-select') {
            // Folder selection mode for batch move - returns selected path
            return this.showFolderSelectMode(options);
        }

        this.onSave = options.onSave || null;
        this.title = options.defaultTitle || '';

        // Use currentFolder for edit mode, lastUsedFolder for create mode
        this.selectedPath = mode === 'edit'
            ? (options.currentFolder || null)
            : (options.lastUsedFolder || null);

        // Load folders
        this.folders = await FolderStorage.getAll();
        logger.debug(`[BookmarkSaveModal] Loaded ${this.folders.length} folders`);

        // Auto-expand folder path
        if (this.selectedPath) {
            this.expandPathToFolder(this.selectedPath);
        }

        // Create overlay (NO Shadow DOM for better compatibility)
        this.overlay = document.createElement('div');
        this.overlay.className = 'bookmark-save-modal-overlay';
        this.overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.5);  /* Keep for overlay */
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

        // Update header text based on mode
        const headerText = mode === 'edit' ? 'Edit Bookmark' : 'Save Bookmark';
        const header = this.modal.querySelector('.save-modal-header h2');
        if (header) {
            header.textContent = headerText;
        }

        // Focus title input
        setTimeout(() => {
            const titleInput = this.modal?.querySelector('.title-input') as HTMLInputElement;
            if (titleInput) {
                titleInput.select(); // Select all text for easy editing
            }
        }, 100);

        logger.info('[BookmarkSaveModal] Modal shown');
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
        this.onSave = null;

        logger.debug('[BookmarkSaveModal] Modal hidden');
    }

    /**
     * Create modal structure
     */
    private createModal(): HTMLElement {
        const modal = document.createElement('div');
        modal.className = 'bookmark-save-modal';

        // Inline styles for modal container
        modal.style.cssText = `
            position: relative;
            width: 90%;
            max-width: 550px;
            max-height: 85vh;
            background: var(--md-surface);
            border-radius: var(--radius-large);
            box-shadow: var(--elevation-3);
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
                /* Design Tokens - Embedded for Modal */
                :root, .bookmark-save-modal {
                    /* Colors */
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
                    
                    --primary-50: #E3F2FD;
                    --primary-100: #BBDEFB;
                    --primary-200: #90CAF9;
                    --primary-300: #64B5F6;
                    --primary-400: #42A5F5;
                    --primary-500: #2196F3;
                    --primary-600: #1976D2;
                    --primary-700: #1565C0;
                    --primary-800: #0D47A1;
                    
                    --danger-500: #EF4444;
                    
                    --md-surface: #FFFFFF;
                    --md-on-surface: #1C1B1F;
                    
                    /* Spacing */
                    --space-1: 4px;
                    --space-2: 8px;
                    --space-3: 12px;
                    --space-4: 16px;
                    --space-5: 20px;
                    
                    /* Typography */
                    --text-xs: 12px;
                    --text-sm: 13px;
                    --text-base: 14px;
                    --text-lg: 16px;
                    
                    /* Border Radius */
                    --radius-xs: 4px;
                    --radius-sm: 8px;  /* Alias for --radius-small */
                    --radius-small: 8px;
                    --radius-large: 12px;
                    
                    /* Shadows */
                    --elevation-3: 0 3px 5px rgba(0, 0, 0, 0.2), 0 1px 18px rgba(0, 0, 0, 0.12);
                }
                
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

                .bookmark-save-modal * {
                    box-sizing: border-box;
                }

                /* Header */
                .save-modal-header {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    padding: 16px 20px;
                    border-bottom: 1px solid var(--gray-200);
                }

                .save-modal-header h2 {
                    margin: 0;
                    font-size: var(--text-base);
                    font-weight: 600;
                    color: var(--gray-900);
                }

                .save-modal-close-btn {
                    background: none;
                    border: none;
                    font-size: 24px;
                    color: var(--gray-500);
                    cursor: pointer;
                    padding: 0;
                    width: 32px;
                    height: 32px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    border-radius: var(--radius-small);
                    transition: all 0.15s ease;
                }

                .save-modal-close-btn:hover {
                    background: var(--gray-100);
                    color: var(--gray-900);
                }

                /* Body */
                .save-modal-body {
                    flex: 1;
                    overflow-y: auto;
                    padding: 20px;
                }

                /* Title Section */
                .title-section {
                    margin-bottom: 20px;
                }

                .title-label {
                    display: block;
                    font-size: var(--text-sm);
                    font-weight: 500;
                    color: var(--gray-700);
                    margin-bottom: 8px;
                }

                .title-input {
                    width: 100%;
                    padding: 10px 12px;
                    border: 2px solid var(--gray-200);
                    border-radius: var(--radius-small);
                    font-size: var(--text-sm);
                    transition: all 0.15s ease;
                    outline: none;
                }

                .title-input:focus {
                    border-color: var(--primary-600);
                }

                .title-input.error {
                    border-color: var(--danger-500);
                }

                .title-error {
                    color: var(--danger-500);
                    font-size: var(--text-xs);
                    margin-top: 4px;
                    display: none;
                }

                .title-error.visible {
                    display: block;
                }

                /* Folder Section */
                .folder-section {
                    margin-bottom: 20px;
                }

                .folder-header {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    margin-bottom: 8px;
                }

                .folder-label {
                    font-size: var(--text-sm);
                    font-weight: 500;
                    color: var(--gray-700);
                }

                .new-folder-btn {
                    background: transparent;
                    color: var(--primary-600);
                    border: none;
                    padding: var(--space-2);
                    border-radius: var(--radius-small);
                    font-size: var(--text-base);
                    cursor: pointer;
                    transition: background 0.15s ease;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }

                .new-folder-btn:hover {
                    background: var(--gray-100);
                }

                .folder-tree-container {
                    border: 1px solid var(--gray-200);
                    border-radius: var(--radius-sm);
                    height: 300px;
                    overflow-y: auto;
                    font-size: var(--text-base);
                    background: var(--gray-50);
                }

                .folder-tree-body {
                    padding: 8px 0;
                }

                .folder-item {
                    display: flex;
                    align-items: center;
                    padding: 8px 12px;
                    cursor: pointer;
                    transition: background 0.15s ease;
                    user-select: none;
                    position: relative;
                }

                .folder-item:hover {
                    background: var(--gray-100);
                }

                .folder-item.selected {
                    background: var(--primary-100);
                }

                .folder-item.selected:hover {
                    background: var(--primary-200);
                }

                .folder-icon {
                    margin-right: 8px;
                    font-size: var(--text-base);
                }

                .folder-toggle {
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    width: 16px;
                    height: 16px;
                    margin-right: 4px;
                    font-size: 10px;  /* Small for toggle arrow */
                    color: var(--gray-500);
                    cursor: pointer;
                    user-select: none;
                    flex-shrink: 0;
                    transition: transform 0.15s ease;
                }

                .folder-toggle:hover {
                    color: var(--gray-900);
                }

                .folder-name {
                    flex: 1;
                    font-size: var(--text-sm);
                    color: var(--gray-900);
                }

                .folder-count {
                    margin-left: 6px;
                    font-size: var(--text-xs);
                    color: var(--gray-500);
                    font-weight: 400;
                }

                .folder-check {
                    color: var(--primary-600);
                    font-weight: 600;
                    margin-left: 8px;
                }

                .folder-add-btn {
                    position: absolute;
                    right: 8px;
                    background: var(--primary-600);
                    color: white;
                    border: none;
                    width: 24px;
                    height: 24px;
                    border-radius: var(--radius-xs);
                    cursor: pointer;
                    opacity: 0;
                    transition: opacity 0.15s;
                    font-size: var(--text-base);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }

                .folder-item:hover .folder-add-btn {
                    opacity: 1;
                }

                .folder-empty {
                    padding: 40px 20px;
                    text-align: center;
                    color: var(--gray-500);
                }

                .folder-empty-icon {
                    font-size: 48px;
                    margin-bottom: 12px;
                }

                .folder-empty-text {
                    font-size: var(--text-sm);
                }

                /* Footer */
                .save-modal-footer {
                    display: flex;
                    gap: 8px;
                    justify-content: flex-end;
                    padding: 16px 20px;
                    border-top: 1px solid var(--gray-200);
                }

                .save-modal-btn {
                    padding: 8px 16px;
                    border-radius: var(--radius-small);
                    font-size: var(--text-sm);
                    font-weight: 500;
                    cursor: pointer;
                    transition: all 0.15s ease;
                    border: none;
                }

                .save-modal-btn-cancel {
                    background: var(--gray-100);
                    color: var(--gray-700);
                }

                .save-modal-btn-cancel:hover {
                    background: var(--gray-200);
                }

                .save-modal-btn-save {
                    background: var(--primary-600);
                    color: white;
                }

                .save-modal-btn-save:hover:not(:disabled) {
                    background: var(--primary-700);
                }

                .save-modal-btn-save:disabled {
                    background: var(--gray-400);
                    cursor: not-allowed;
                    opacity: 0.6;
                }
            </style>

            <div class="save-modal-header">
                <h2>Save Bookmark</h2>
                <button class="save-modal-close-btn" aria-label="Close">×</button>
            </div>

            <div class="save-modal-body">
                <!-- Title Section -->
                <div class="title-section">
                    <label class="title-label">Title</label>
                    <input type="text" 
                           class="title-input" 
                           value="${this.escapeAttr(this.title)}"
                           maxlength="100"
                           placeholder="Enter bookmark title...">
                    <div class="title-error"></div>
                </div>

                <!-- Folder Section -->
                <div class="folder-section">
                    <div class="folder-header">
                        <span class="folder-label">Folder</span>
                        <button class="new-folder-btn" title="New Folder">${Icons.folderPlus}</button>
                    </div>
                    <div class="folder-tree-container">
                        <div class="folder-tree-body">
                            <div class="folder-empty">
                                <div class="folder-empty-icon">${Icons.folder}</div>
                                <div class="folder-empty-text">Loading folders...</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div class="save-modal-footer">
                <button class="save-modal-btn save-modal-btn-cancel">Cancel</button>
                <button class="save-modal-btn save-modal-btn-save" disabled>Save</button>
            </div>
        `;

        this.bindEvents(modal);

        return modal;
    }

    /**
     * Bind event listeners
     */
    private bindEvents(modal: HTMLElement): void {
        // Close button
        const closeBtn = modal.querySelector('.save-modal-close-btn');
        closeBtn?.addEventListener('click', () => this.hide());

        // Cancel button
        const cancelBtn = modal.querySelector('.save-modal-btn-cancel');
        cancelBtn?.addEventListener('click', () => this.hide());

        // Save button
        const saveBtn = modal.querySelector('.save-modal-btn-save');
        saveBtn?.addEventListener('click', () => this.handleSave());

        // Title input
        const titleInput = modal.querySelector('.title-input') as HTMLInputElement;
        titleInput?.addEventListener('input', (e) => this.handleTitleInput(e));

        // New Folder button
        const newFolderBtn = modal.querySelector('.new-folder-btn');
        newFolderBtn?.addEventListener('click', () => this.showCreateRootFolderInput());
    }

    /**
     * Handle title input with validation
     */
    private handleTitleInput(e: Event): void {
        const input = e.target as HTMLInputElement;
        this.title = input.value;

        const validation = this.validateTitle(this.title);
        this.titleValid = validation.valid;

        const errorDiv = this.modal?.querySelector('.title-error');
        if (!errorDiv) return;

        if (!validation.valid) {
            input.classList.add('error');
            errorDiv.textContent = validation.error!;
            errorDiv.classList.add('visible');
        } else {
            input.classList.remove('error');
            errorDiv.classList.remove('visible');
        }

        this.updateSaveButtonState();
    }

    /**
     * Validate title
     */
    private validateTitle(title: string): { valid: boolean; error?: string } {
        if (!title || title.trim().length === 0) {
            return { valid: false, error: 'Title is required' };
        }
        if (title.length > 100) {
            return { valid: false, error: `Title too long (${title.length}/100)` };
        }
        return { valid: true };
    }

    /**
     * Expand path to folder (auto-expand parent folders)
     */
    private expandPathToFolder(path: string): void {
        const segments = path.split('/');
        let currentPath = '';

        for (const segment of segments) {
            currentPath = currentPath ? `${currentPath}/${segment}` : segment;
            this.expandedPaths.add(currentPath);
        }
    }

    /**
     * Render folder tree
     */
    private renderFolderTree(): void {
        if (!this.modal) return;

        const treeBody = this.modal.querySelector('.folder-tree-body');
        if (!treeBody) return;

        // Build tree structure
        const tree = TreeBuilder.buildTree(this.folders, [], new Set<string>(), null);

        if (tree.length === 0) {
            treeBody.innerHTML = `
                <div class="folder-empty">
                    <div class="folder-empty-icon">${Icons.folder}</div>
                    <div class="folder-empty-text">No folders yet. Create one to get started!</div>
                </div>
            `;
            return;
        }

        // Render tree nodes
        treeBody.innerHTML = this.renderTreeNodes(tree, 0);

        // Bind folder click handlers
        this.bindFolderClickHandlers();

        // Scroll to selected folder
        this.scrollToSelected();
    }

    /**
     * Render tree nodes recursively
     */
    private renderTreeNodes(nodes: FolderTreeNode[], depth: number): string {
        return nodes.map(node => {
            const isExpanded = this.expandedPaths.has(node.folder.path);
            const isSelected = node.folder.path === this.selectedPath;
            const icon = isExpanded ? Icons.folderOpen : Icons.folder;
            const indent = depth * 20;
            // Show + button if folder can have subfolders (depth < MAX_DEPTH - 1)
            // Example with MAX_DEPTH=4:
            // - depth=0 (Level 1): can add subfolder ✓
            // - depth=1 (Level 2): can add subfolder ✓
            // - depth=2 (Level 3): can add subfolder ✓
            // - depth=3 (Level 4): CANNOT add subfolder ✗
            const showAddButton = depth < PathUtils.MAX_DEPTH - 1;

            let html = `
                <div class="folder-item ${isSelected ? 'selected' : ''}"
                     data-path="${this.escapeAttr(node.folder.path)}"
                     data-depth="${depth}"
                     style="padding-left: ${indent + 12}px">
                    <span class="folder-toggle" data-path="${this.escapeAttr(node.folder.path)}" aria-label="Toggle folder">${isExpanded ? '▼' : '▶'}</span>
                    <span class="folder-icon">${icon}</span>
                    <span class="folder-name">${this.escapeHtml(node.folder.name)}</span>
                    ${isSelected ? '<span class="folder-check">✓</span>' : ''}
                    ${showAddButton ? `<button class="folder-add-btn" data-parent="${this.escapeAttr(node.folder.path)}" title="Create subfolder">+</button>` : ''}
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
     * Bind folder click handlers
     */
    private bindFolderClickHandlers(): void {
        if (!this.modal) return;

        // Bind toggle buttons
        const toggleBtns = this.modal.querySelectorAll('.folder-toggle');
        toggleBtns.forEach(toggle => {
            toggle.addEventListener('click', (e) => {
                e.stopPropagation();
                const path = (toggle as HTMLElement).dataset.path!;

                // Toggle expansion state
                if (this.expandedPaths.has(path)) {
                    this.expandedPaths.delete(path);
                } else {
                    this.expandedPaths.add(path);
                }

                // Re-render tree to update toggle icon
                this.renderFolderTree();
            });
        });

        const folderItems = this.modal.querySelectorAll('.folder-item');
        folderItems.forEach(item => {
            item.addEventListener('click', (e) => {
                e.stopPropagation();
                const path = (item as HTMLElement).dataset.path!;
                this.handleFolderClick(path);
            });
        });

        // Bind add subfolder buttons
        const addBtns = this.modal.querySelectorAll('.folder-add-btn');
        addBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const parentPath = (btn as HTMLElement).dataset.parent!;
                this.showCreateSubfolderInput(parentPath);
            });
        });
    }

    /**
     * Handle folder click
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

        // Update button state based on mode
        if (this.currentMode === 'folder-select') {
            // Enable Move button in folder-select mode
            const moveBtn = this.modal?.querySelector('.save-modal-btn-save') as HTMLButtonElement;
            if (moveBtn) {
                moveBtn.disabled = false;
            }
        } else {
            // Update Save button in create/edit mode
            this.updateSaveButtonState();
        }

        logger.debug(`[BookmarkSaveModal] Folder clicked: ${path}`);
    }

    /**
     * Scroll to selected folder
     */
    private scrollToSelected(): void {
        if (!this.modal) return;

        const selectedItem = this.modal.querySelector('.folder-item.selected');
        if (selectedItem) {
            selectedItem.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }

    /**
     * Show create root folder input (placeholder for T3.1)
     */
    private showCreateRootFolderInput(): void {
        // TODO: Implement in T3.1
        const name = prompt('Enter folder name:');
        if (!name) return;

        this.createFolder(name, null);
    }

    /**
     * Show create subfolder input (placeholder for T3.3)
     */
    private showCreateSubfolderInput(parentPath: string): void {
        // TODO: Implement in T3.3
        const name = prompt('Enter folder name:');
        if (!name) return;

        this.createFolder(name, parentPath);
    }

    /**
     * Create folder
     */
    private async createFolder(name: string, parentPath: string | null): Promise<void> {
        // Validate name
        if (name.length > 50) {
            alert('❌ Folder name too long (max 50 characters)');
            return;
        }

        if (name.includes('/')) {
            alert('❌ Folder name cannot contain "/"');
            return;
        }

        const newPath = parentPath ? `${parentPath}/${name}` : name;

        // Check depth limit (max 4 levels: a/b/c/d, not a/b/c/d/e)
        const depth = newPath.split('/').length;
        if (depth > PathUtils.MAX_DEPTH) {
            alert(`❌ Maximum folder depth is ${PathUtils.MAX_DEPTH} levels (e.g., Work/Projects/AI/ChatGPT)`);
            return;
        }

        const exists = this.folders.find(f => f.path === newPath);
        if (exists) {
            alert(`❌ Folder "${name}" already exists`);
            return;
        }

        try {
            await FolderStorage.create(newPath);
            logger.info(`[BookmarkSaveModal] Created folder: ${newPath}`);

            // Reload folders
            this.folders = await FolderStorage.getAll();

            // Auto-select new folder and keep parent expanded
            this.selectedPath = newPath;
            // Keep parent folder expanded (don't collapse it)
            if (parentPath) {
                this.expandedPaths.add(parentPath);
            }
            this.expandPathToFolder(newPath);

            // Re-render
            this.renderFolderTree();
            this.updateSaveButtonState();
        } catch (error) {
            logger.error('[BookmarkSaveModal] Failed to create folder:', error);
            alert(`❌ Failed to create folder: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    /**
     * Update save button state
     */
    private updateSaveButtonState(): void {
        if (!this.modal) return;

        const saveBtn = this.modal.querySelector('.save-modal-btn-save') as HTMLButtonElement;
        if (saveBtn) {
            saveBtn.disabled = !this.titleValid || !this.selectedPath;
        }
    }

    /**
     * Handle save action
     */
    private handleSave(): void {
        if (!this.titleValid || !this.selectedPath || !this.onSave) return;

        logger.info(`[BookmarkSaveModal] Saving: "${this.title}" to "${this.selectedPath}"`);
        this.onSave(this.title, this.selectedPath);
        this.hide();
    }

    /**
     * Escape HTML
     */
    private escapeHtml(text: string): string {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    /**
     * Escape attribute
     */
    private escapeAttr(text: string): string {
        return text.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }

    /**
     * Show folder selection mode (for batch move)
     * Returns: selected folder path, or undefined if cancelled
     */
    private showFolderSelectMode(options: {
        bookmarkCount?: number;
    }): Promise<string | null | undefined> {
        return new Promise(async (resolve) => {
            const bookmarkCount = options.bookmarkCount || 0;

            // Load folders
            this.folders = await FolderStorage.getAll();
            this.selectedPath = null;

            // Create overlay
            this.overlay = document.createElement('div');
            this.overlay.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: rgba(0, 0, 0, 0.5);  /* Keep for overlay */
                backdrop-filter: blur(4px);
                z-index: 2147483647;
                display: flex;
                align-items: center;
                justify-content: center;
                animation: fadeIn 0.2s ease-out;
            `;

            // Create modal with EXACT SAME structure as bookmark save modal
            const modal = document.createElement('div');
            modal.className = 'bookmark-save-modal';
            modal.style.cssText = `
                position: relative;
                width: 90%;
                max-width: 550px;
                max-height: 85vh;
                background: var(--md-surface);
                border-radius: var(--radius-large);
                box-shadow: var(--elevation-3);
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
                    /* Design Tokens - Embedded for Modal */
                    :root, .bookmark-save-modal {
                        /* Colors */
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
                        
                        --primary-50: #E3F2FD;
                        --primary-100: #BBDEFB;
                        --primary-200: #90CAF9;
                        --primary-300: #64B5F6;
                        --primary-400: #42A5F5;
                        --primary-500: #2196F3;
                        --primary-600: #1976D2;
                        --primary-700: #1565C0;
                        --primary-800: #0D47A1;
                        
                        --danger-500: #EF4444;
                        
                        --md-surface: #FFFFFF;
                        --md-on-surface: #1C1B1F;
                        
                        /* Spacing */
                        --space-1: 4px;
                        --space-2: 8px;
                        --space-3: 12px;
                        --space-4: 16px;
                        --space-5: 20px;
                        
                        /* Typography */
                        --text-xs: 12px;
                        --text-sm: 13px;
                        --text-base: 14px;
                        --text-lg: 16px;
                        
                        /* Border Radius */
                        --radius-xs: 4px;
                        --radius-sm: 8px;  /* Alias for --radius-small */
                        --radius-small: 8px;
                        --radius-large: 12px;
                        
                        /* Shadows */
                        --elevation-3: 0 3px 5px rgba(0, 0, 0, 0.2), 0 1px 18px rgba(0, 0, 0, 0.12);
                    }
                    
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

                    .bookmark-save-modal * {
                        box-sizing: border-box;
                    }

                    /* Header */
                    .save-modal-header {
                        display: flex;
                        align-items: center;
                        justify-content: space-between;
                        padding: 16px 20px;
                        border-bottom: 1px solid var(--gray-200);
                    }

                    .save-modal-header h2 {
                        margin: 0;
                        font-size: var(--text-base);
                        font-weight: 600;
                        color: var(--gray-900);
                    }

                    .save-modal-close-btn {
                        background: none;
                        border: none;
                        font-size: 24px;
                        color: var(--gray-500);
                        cursor: pointer;
                        padding: 0;
                        width: 32px;
                        height: 32px;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        border-radius: var(--radius-small);
                        transition: all 0.15s ease;
                    }

                    .save-modal-close-btn:hover {
                        background: var(--gray-100);
                        color: var(--gray-900);
                    }

                    /* Body */
                    .save-modal-body {
                        flex: 1;
                        overflow-y: auto;
                        padding: 20px;
                    }

                    /* Folder Section */
                    .folder-section {
                        margin-bottom: 20px;
                    }

                    .folder-header {
                        display: flex;
                        align-items: center;
                        justify-content: space-between;
                        margin-bottom: 8px;
                    }

                    .folder-label {
                        font-size: var(--text-sm);
                        font-weight: 500;
                        color: var(--gray-700);
                    }

                    .folder-tree-container {
                        border: 1px solid var(--gray-200);
                        border-radius: var(--radius-small);
                        height: 300px;
                        overflow-y: auto;
                        background: var(--gray-50);
                    }

                    .folder-tree-body {
                        padding: 8px 0;
                    }

                    .folder-item {
                        display: flex;
                        align-items: center;
                        padding: 8px 12px;
                        cursor: pointer;
                        transition: background 0.15s ease;
                        user-select: none;
                        position: relative;
                    }

                    .folder-item:hover {
                        background: var(--gray-100);
                    }

                    .folder-item.selected {
                        background: var(--primary-100);
                    }

                    .folder-item.selected:hover {
                        background: var(--primary-200);
                    }

                    .folder-icon {
                        margin-right: 8px;
                        font-size: var(--text-base);
                    }

                    .folder-toggle {
                        display: inline-flex;
                        align-items: center;
                        justify-content: center;
                        width: 16px;
                        height: 16px;
                        margin-right: 4px;
                        font-size: 10px;  /* Small for toggle arrow */
                        color: var(--gray-500);
                        cursor: pointer;
                        user-select: none;
                        flex-shrink: 0;
                        transition: transform 0.15s ease;
                    }

                    .folder-toggle:hover {
                        color: var(--gray-900);
                    }

                    .folder-name {
                        flex: 1;
                        font-size: var(--text-sm);
                        color: var(--gray-900);
                    }

                    .folder-check {
                        color: var(--primary-600);
                        font-weight: 600;
                        margin-left: 8px;
                    }

                    .folder-empty {
                        padding: 40px 20px;
                        text-align: center;
                        color: var(--gray-500);
                    }

                    .folder-empty-icon {
                        font-size: 48px;
                        margin-bottom: 12px;
                    }

                    .folder-empty-text {
                        font-size: var(--text-sm);
                    }

                    /* Info Section */
                    .move-info {
                        display: flex;
                        align-items: center;
                        padding: 12px 16px;
                        background: var(--primary-50);
                        border: 1px solid var(--primary-200);
                        border-radius: var(--radius-small);
                        margin-bottom: 16px;
                    }

                    .move-info-icon {
                        font-size: var(--text-lg);
                        margin-right: 8px;
                    }

                    .move-info-text {
                        font-size: var(--text-xs);
                        color: var(--primary-800);
                        font-weight: 500;
                    }

                    /* Footer */
                    .save-modal-footer {
                        display: flex;
                        gap: 8px;
                        justify-content: flex-end;
                        padding: 16px 20px;
                        border-top: 1px solid var(--gray-200);
                    }

                    .save-modal-btn {
                        padding: 8px 16px;
                        border-radius: var(--radius-small);
                        font-size: var(--text-sm);
                        font-weight: 500;
                        cursor: pointer;
                        transition: all 0.15s ease;
                        border: none;
                    }

                    .save-modal-btn-cancel {
                        background: var(--gray-100);
                        color: var(--gray-700);
                    }

                    .save-modal-btn-cancel:hover {
                        background: var(--gray-200);
                    }

                    .save-modal-btn-save {
                        background: var(--primary-600);
                        color: white;
                    }

                    .save-modal-btn-save:hover:not(:disabled) {
                        background: var(--primary-700);
                    }

                    .save-modal-btn-save:disabled {
                        background: var(--gray-400);
                        cursor: not-allowed;
                        opacity: 0.6;
                    }
                </style>

                <div class="save-modal-header">
                    <h2>Move Bookmarks to Folder</h2>
                    <button class="save-modal-close-btn" aria-label="Close">×</button>
                </div>

                <div class="save-modal-body">
                    <!-- Info Section -->
                    <div class="move-info">
                        <span class="move-info-icon">ℹ️</span>
                        <span class="move-info-text">Moving ${bookmarkCount} bookmark${bookmarkCount > 1 ? 's' : ''}</span>
                    </div>

                    <!-- Folder Section -->
                    <div class="folder-section">
                        <div class="folder-header">
                            <span class="folder-label">Select Destination Folder</span>
                        </div>
                        <div class="folder-tree-container">
                            <div class="folder-tree-body">
                                <div class="folder-empty">
                                    <div class="folder-empty-icon">${Icons.folder}</div>
                                    <div class="folder-empty-text">Loading folders...</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="save-modal-footer">
                    <button class="save-modal-btn save-modal-btn-cancel">Cancel</button>
                    <button class="save-modal-btn save-modal-btn-save" disabled>Move</button>
                </div>
            `;

            this.modal = modal;
            this.overlay.appendChild(modal);
            document.body.appendChild(this.overlay);

            // Render folder tree using EXISTING method
            this.renderFolderTree();

            // Event handlers
            const closeBtn = modal.querySelector('.save-modal-close-btn') as HTMLButtonElement;
            const cancelBtn = modal.querySelector('.save-modal-btn-cancel') as HTMLButtonElement;
            const moveBtn = modal.querySelector('.save-modal-btn-save') as HTMLButtonElement;

            closeBtn.addEventListener('click', () => {
                this.hide();
                resolve(undefined);
            });

            cancelBtn.addEventListener('click', () => {
                this.hide();
                resolve(undefined);
            });

            moveBtn.addEventListener('click', () => {
                const selected = this.selectedPath;
                this.hide();
                resolve(selected);
            });

            // Click outside to close
            this.overlay.addEventListener('click', (e) => {
                if (e.target === this.overlay) {
                    this.hide();
                    resolve(undefined);
                }
            });

            // ESC key to close
            this.escKeyHandler = (e: KeyboardEvent) => {
                if (e.key === 'Escape') {
                    this.hide();
                    document.removeEventListener('keydown', this.escKeyHandler!);
                    resolve(undefined);
                }
            };
            document.addEventListener('keydown', this.escKeyHandler);
        });
    }
}

