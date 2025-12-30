import { Folder, FolderTreeNode } from '../storage/types';
import { FolderStorage } from '../storage/FolderStorage';
import { TreeBuilder } from '../utils/tree-builder';
import { PathUtils, type FolderNameValidationError } from '../utils/path-utils';
import { logger } from '../../utils/logger';
import { Icons } from '../../assets/icons';
import { DesignTokens } from '../../utils/design-tokens';

/**
 * Unified Bookmark Save Modal - Shadow DOM Version
 * Combines title editing and folder selection in one modal
 * Pattern: Notion-style inline editing + VS Code tree view
 */

export class BookmarkSaveModal {
    // ✅ Shadow DOM infrastructure
    private container: HTMLElement | null = null;
    private shadowRoot: ShadowRoot | null = null;

    // DOM references (now inside Shadow DOM)
    private overlay: HTMLElement | null = null;
    private modal: HTMLElement | null = null;

    // ✅ PERF: Cache frequently accessed DOM elements
    private titleInputElement: HTMLInputElement | null = null;
    private saveButtonElement: HTMLButtonElement | null = null;
    private errorDivElement: HTMLElement | null = null;

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

    // Event listener management (AbortController pattern - Web standard)
    private abortController: AbortController | null = null;

    /**
     * Constructor - Initialize Shadow DOM container
     */
    constructor() {
        // Create Shadow DOM host element
        this.container = document.createElement('div');
        this.container.className = 'bookmark-save-modal-host';
        this.shadowRoot = this.container.attachShadow({ mode: 'open' });
    }

    /**
     * Inject complete styles into Shadow DOM
     */
    private injectStyles(): void {
        if (!this.shadowRoot) return;

        const existingStyle = this.shadowRoot.querySelector('style');
        if (existingStyle) existingStyle.remove();

        const isDark = DesignTokens.isDarkMode();
        const tokens = isDark ? DesignTokens.getDarkTokens() : DesignTokens.getLightTokens();

        const styleElement = document.createElement('style');
        styleElement.textContent = `
            :host { ${tokens} }
            
            * { box-sizing: border-box; }
            @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
            @keyframes slideIn { from { opacity: 0; transform: translateY(-20px) scale(0.95); } to { opacity: 1; transform: translateY(0) scale(1); } }
            .modal-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: var(--bg-overlay); backdrop-filter: blur(6px); z-index: 2147483647; display: flex; align-items: center; justify-content: center; animation: fadeIn 0.2s ease-out; }
            .bookmark-save-modal { position: relative; width: 90%; max-width: 550px; max-height: 85vh; background: var(--md-surface); color: var(--md-on-surface); border-radius: 16px; box-shadow: var(--shadow-xl); font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; display: flex; flex-direction: column; animation: slideIn 0.2s ease-out; }
            .save-modal-header { display: flex; align-items: center; justify-content: space-between; padding: 16px 20px; border-bottom: 1px solid var(--gray-200); }
            .save-modal-header h2 { margin: 0; font-size: 14px; font-weight: 600; color: var(--gray-900); }
            .save-modal-close-btn { background: none; border: none; font-size: 24px; color: var(--gray-500); cursor: pointer; padding: 0; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; border-radius: 8px; transition: all 0.15s ease; }
            .save-modal-close-btn:hover { background: var(--gray-100); color: var(--gray-900); }
            .save-modal-body { flex: 1; overflow-y: auto; padding: 24px; }
            .title-section { margin-bottom: 24px; }
            .title-label { display: block; font-size: 13px; font-weight: 600; letter-spacing: 0.3px; text-transform: uppercase; color: var(--gray-700); margin-bottom: 8px; }
            .title-input { width: 100%; padding: 10px 12px; border: 1.5px solid var(--gray-200); border-radius: 8px; font-size: 13px; background: var(--md-surface); color: var(--md-on-surface); box-shadow: inset 0 1px 2px rgba(0,0,0,0.04); transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1); outline: none; }
            .title-input:focus { border-color: var(--primary-300); box-shadow: var(--shadow-focus); }
            .title-input.error { border-color: var(--danger-500); }
            .title-input::placeholder { color: var(--gray-400); font-weight: 400; }
            .bookmark-count-info { margin-bottom: 16px; padding: 10px 14px; background: var(--info-bg); border-left: 3px solid var(--primary-500); border-radius: 8px; font-size: 13px; color: var(--gray-800); }
            .title-error { margin-top: 8px; font-size: 12px; color: var(--danger-500); display: none; }
            .title-error.visible { display: block; }
            .folder-section { margin-bottom: 24px; }
            .folder-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; }
            .folder-label { font-size: 13px; font-weight: 600; letter-spacing: 0.3px; text-transform: uppercase; color: var(--gray-700); }
            .new-folder-btn { background: var(--button-icon-bg); color: var(--button-icon-text); border: none; padding: 8px; border-radius: 8px; font-size: 14px; cursor: pointer; transition: all 0.15s ease; display: flex; align-items: center; justify-content: center; }
            .new-folder-btn:hover { background: var(--button-icon-hover); color: var(--button-icon-text-hover); transform: scale(1.05); }
            .folder-tree-container { border-radius: 12px; height: 300px; overflow-y: auto; background: var(--modal-tree-bg); }
            .folder-tree-body { padding: 0; }
            .folder-item { display: flex; align-items: center; min-height: 40px; padding: 10px 16px; cursor: pointer; transition: background 0.15s ease; position: relative; background: transparent; border-left: 3px solid transparent; }
            .folder-item:not(.selected):hover { background: var(--modal-tree-item-hover); }
            .folder-item.selected { background: linear-gradient(90deg, rgba(59, 130, 246, 0.15) 0%, rgba(59, 130, 246, 0.08) 100%); border-left: 3px solid var(--primary-400); }
            .folder-item:hover .item-actions { opacity: 1; visibility: visible; }
            .folder-toggle { display: inline-flex; align-items: center; justify-content: center; width: 16px; height: 16px; margin-right: 4px; font-size: 10px; color: var(--gray-500); cursor: pointer; user-select: none; flex-shrink: 0; transition: transform 0.2s cubic-bezier(0.4, 0, 0.2, 1); }
            .folder-toggle.expanded { transform: rotate(90deg); }
            .folder-icon { margin-right: 8px; font-size: 16px; flex-shrink: 0; color: var(--modal-tree-item-icon); }
            .folder-name { flex: 1; font-size: 13px; font-weight: 500; color: var(--modal-tree-item-text); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
            .folder-check { color: var(--primary-600); font-size: 16px; font-weight: 600; margin-left: 8px; flex-shrink: 0; }
            .item-actions { display: flex; gap: 4px; margin-left: 8px; opacity: 0; visibility: hidden; transition: all 150ms ease; }
            .action-btn { background: var(--button-icon-bg); border: none; color: var(--button-icon-text); cursor: pointer; padding: 4px; border-radius: 4px; display: flex; align-items: center; justify-content: center; font-size: 14px; transition: all 150ms ease; }
            .action-btn:hover { background: var(--button-icon-hover); color: var(--button-icon-text-hover); }
            .folder-empty { padding: 40px 20px; text-align: center; color: var(--gray-400); }
            .folder-empty-icon { font-size: 48px; margin-bottom: 12px; }
            .folder-empty-text { font-size: 13px; }
            .save-modal-footer { display: flex; gap: 8px; justify-content: flex-end; padding: 16px 20px; border-top: 1px solid var(--gray-200); }
            .save-modal-btn { padding: 10px 20px; border-radius: 8px; font-size: var(--text-sm); font-weight: var(--font-medium); cursor: pointer; transition: all 0.2s ease; border: none; transform: translateY(0); }
            .save-modal-btn-cancel { background: var(--button-secondary-bg); color: var(--button-secondary-text); }
            .save-modal-btn-cancel:hover { background: var(--button-secondary-hover); color: var(--button-secondary-text-hover); transform: translateY(-1px); }
            .save-modal-btn-save { background: var(--button-primary-bg); color: var(--button-primary-text); }
            .save-modal-btn-save:hover:not(:disabled) { background: var(--button-primary-hover); color: var(--button-primary-text-hover); transform: translateY(-1px); }
            .save-modal-btn-save:disabled { background: var(--button-primary-disabled); color: var(--button-primary-disabled-text); cursor: not-allowed; opacity: 0.6; }
        `;

        this.shadowRoot.appendChild(styleElement);
    }

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

        // Create AbortController for this modal instance (Web standard pattern)
        this.abortController = new AbortController();

        this.onSave = options.onSave || null;
        this.title = options.defaultTitle || '';

        // Use currentFolder for edit mode, lastUsedFolder for create mode
        // Load folders
        this.folders = await FolderStorage.getAll();
        logger.debug(`[BookmarkSaveModal] Loaded ${this.folders.length} folders`);

        // Validate and set selected path
        let candidatePath = options.currentFolder || options.lastUsedFolder || null;

        // Check if candidate path still exists in folder tree
        if (candidatePath) {
            const pathExists = this.folders.some(f => f.path === candidatePath);
            if (!pathExists) {
                logger.warn(`[BookmarkSaveModal] Last used folder "${candidatePath}" no longer exists`);
                candidatePath = null;
            }
        }

        // If no valid candidate, use first folder (if any)
        if (!candidatePath && this.folders.length > 0) {
            candidatePath = this.folders[0].path;
            logger.info(`[BookmarkSaveModal] Using first folder: ${candidatePath}`);
        }

        this.selectedPath = candidatePath;

        // Auto-expand folder path
        if (this.selectedPath) {
            this.expandPathToFolder(this.selectedPath);
        }

        // Create AbortController for this modal instance (Web standard pattern)
        this.abortController = new AbortController();

        // Inject styles into Shadow DOM
        this.injectStyles();

        // Create overlay in Shadow DOM
        this.overlay = document.createElement('div');
        this.overlay.className = 'modal-overlay';

        // Create modal
        this.modal = this.createModal();
        this.overlay.appendChild(this.modal);

        // Add to Shadow DOM
        this.shadowRoot!.appendChild(this.overlay);

        // Mount container to body
        document.body.appendChild(this.container!);

        // Click outside to close (use signal for automatic cleanup)
        this.overlay.addEventListener('click', (e) => {
            if (e.target === this.overlay) {
                this.hide();
            }
        }, { signal: this.abortController.signal });

        // ESC key to close
        this.escKeyHandler = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                this.hide();
            }
        };
        document.addEventListener('keydown', this.escKeyHandler);

        // Render folder tree
        this.renderFolderTree();

        // CRITICAL: Update Save button state after rendering tree
        // This enables the button if selectedPath is already set (lastUsedFolder)
        this.updateSaveButtonState();

        // Update header text based on mode
        const headerText = mode === 'edit' ? 'Edit Bookmark' : 'Save Bookmark';
        const header = this.modal.querySelector('.save-modal-header h2');
        if (header) {
            header.textContent = headerText;
        }

        // ✅ PERF: Cache DOM references after modal creation
        this.titleInputElement = this.modal.querySelector('.title-input') as HTMLInputElement;
        this.saveButtonElement = this.modal.querySelector('.save-modal-btn-save') as HTMLButtonElement;
        this.errorDivElement = this.modal.querySelector('.title-error');

        // Focus title input
        setTimeout(() => {
            if (this.titleInputElement) {
                this.titleInputElement.select(); // Select all text for easy editing
            }
        }, 100);

        logger.info('[BookmarkSaveModal] Modal shown');
    }

    private updateSaveButtonState(): void {
        const fnStart = performance.now();
        console.log('[BUTTON-UPDATE-DEBUG] updateSaveButtonState START');

        // ✅ PERF: Use cached references instead of querySelector
        if (!this.saveButtonElement || !this.titleInputElement) {
            console.log('[BUTTON-UPDATE-DEBUG] Cached elements missing!');
            return;
        }

        const title = this.titleInputElement.value?.trim() || '';
        console.log('[BUTTON-UPDATE-DEBUG] Current title length:', title.length);

        // Disable save button if:
        // 1. No folders exist in the tree (must create folder first)
        // 2. No folder is selected
        // 3. Title is empty
        const hasNoFolders = this.folders.length === 0;
        const noFolderSelected = !this.selectedPath;
        const noTitle = !title;

        const shouldDisable = hasNoFolders || noFolderSelected || noTitle;
        console.log('[BUTTON-UPDATE-DEBUG] shouldDisable:', shouldDisable, '(folders:', this.folders.length, 'selected:', this.selectedPath, 'title:', !!title, ')');

        const beforeStyleUpdate = performance.now();
        this.saveButtonElement.disabled = shouldDisable;

        // Update button appearance
        if (shouldDisable) {
            this.saveButtonElement.style.opacity = '0.5';
            this.saveButtonElement.style.cursor = 'not-allowed';
        } else {
            this.saveButtonElement.style.opacity = '1';
            this.saveButtonElement.style.cursor = 'pointer';
        }
        const afterStyleUpdate = performance.now();
        console.log('[BUTTON-UPDATE-DEBUG] Style update time:', (afterStyleUpdate - beforeStyleUpdate).toFixed(2), 'ms');

        const fnEnd = performance.now();
        console.log('[BUTTON-UPDATE-DEBUG] TOTAL time:', (fnEnd - fnStart).toFixed(2), 'ms');
        console.log('[BUTTON-UPDATE-DEBUG] updateSaveButtonState END');
    }

    /**
 * Hide and cleanup modal
 */
    hide(): void {
        // 1. Abort all event listeners (one line - Web standard!)
        this.abortController?.abort();
        this.abortController = null;

        // 2. Remove container (which contains Shadow DOM)
        if (this.container && this.container.parentNode) {
            this.container.remove();
        }

        // 3. Remove ESC key listener (not managed by AbortController)
        if (this.escKeyHandler) {
            document.removeEventListener('keydown', this.escKeyHandler);
            this.escKeyHandler = null;
        }

        // 4. Clear Shadow DOM
        if (this.shadowRoot) {
            this.shadowRoot.innerHTML = '';
        }

        // 5. Clear all state to prevent memory leaks
        this.container = null;
        this.shadowRoot = null;
        this.overlay = null;
        this.modal = null;
        this.folders = [];
        this.selectedPath = null;
        this.expandedPaths.clear();
        this.title = '';
        this.titleValid = true;
        this.onSave = null;

        logger.info('[BookmarkSaveModal] Modal cleaned up');
    }

    /**
     * Create modal structure with dynamic theme
     */
    private createModal(): HTMLElement {
        const modal = document.createElement('div');
        modal.className = 'bookmark-save-modal';

        // Stop propagation on modal content
        modal.addEventListener('click', (e) => {
            e.stopPropagation();
        });

        modal.innerHTML = `
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
                    <div class="title-error" style="display: none;"></div>
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
        console.log('[BIND-DEBUG] bindEvents START');
        const bindStart = performance.now();

        // Get signal from AbortController for automatic cleanup
        const signal = this.abortController?.signal;

        // Close button
        const closeBtn = modal.querySelector('.save-modal-close-btn');
        closeBtn?.addEventListener('click', () => this.hide(), { signal });

        // Cancel button
        const cancelBtn = modal.querySelector('.save-modal-btn-cancel');
        cancelBtn?.addEventListener('click', () => this.hide(), { signal });

        // Save button
        const saveBtn = modal.querySelector('.save-modal-btn-save');
        saveBtn?.addEventListener('click', () => this.handleSave(), { signal });

        // Title input - CRITICAL for performance
        const titleInput = modal.querySelector('.title-input') as HTMLInputElement;

        // Wrap the input handler to measure event dispatch time
        const wrappedInputHandler = (e: Event) => {
            const eventReceived = performance.now();
            console.log('[INPUT-EVENT] ========== EVENT RECEIVED ==========');
            console.log('[INPUT-EVENT] Event timestamp:', e.timeStamp);
            console.log('[INPUT-EVENT] Performance.now():', eventReceived);
            console.log('[INPUT-EVENT] Input value:', (e.target as HTMLInputElement).value);

            this.handleTitleInput(e);

            const eventProcessed = performance.now();
            console.log('[INPUT-EVENT] Processing time:', (eventProcessed - eventReceived).toFixed(2), 'ms');
            console.log('[INPUT-EVENT] ========== EVENT PROCESSED ==========');
        };

        titleInput?.addEventListener('input', wrappedInputHandler, { signal });
        console.log('[BIND-DEBUG] Title input listener bound');

        // New Folder button
        const newFolderBtn = modal.querySelector('.new-folder-btn');
        newFolderBtn?.addEventListener('click', () => this.showCreateRootFolderInput(), { signal });

        const bindEnd = performance.now();
        console.log('[BIND-DEBUG] bindEvents END, total time:', (bindEnd - bindStart).toFixed(2), 'ms');
    }

    /**
     * Handle title input with validation
     * ✅ PERF: Optimized with cached DOM references
     */
    private handleTitleInput(e: Event): void {
        const fnStart = performance.now();
        console.log('[HANDLER-DEBUG] ========== handleTitleInput START ==========');
        console.log('[HANDLER-DEBUG] Event type:', e.type);
        console.log('[HANDLER-DEBUG] Event isTrusted:', e.isTrusted);

        const input = e.target as HTMLInputElement;
        const beforeValue = this.title;
        const afterValue = input.value;

        console.log('[HANDLER-DEBUG] Value change:', beforeValue, '->', afterValue);
        console.log('[HANDLER-DEBUG] Value length:', afterValue.length);

        this.title = input.value;
        const afterAssign = performance.now();
        console.log('[HANDLER-DEBUG] Assignment time:', (afterAssign - fnStart).toFixed(2), 'ms');

        const validation = this.validateTitle(this.title);
        const afterValidation = performance.now();
        console.log('[HANDLER-DEBUG] Validation time:', (afterValidation - afterAssign).toFixed(2), 'ms');
        this.titleValid = validation.valid;

        // ✅ PERF: Use cached errorDiv reference
        if (!this.errorDivElement) {
            console.log('[HANDLER-DEBUG] ERROR: errorDiv not cached!');
            return;
        }

        const beforeDOMUpdate = performance.now();
        if (!validation.valid) {
            input.classList.add('error');
            this.errorDivElement.textContent = validation.error!;
            this.errorDivElement.classList.add('visible');
        } else {
            input.classList.remove('error');
            this.errorDivElement.classList.remove('visible');
        }
        const afterDOMUpdate = performance.now();
        console.log('[HANDLER-DEBUG] DOM update time:', (afterDOMUpdate - beforeDOMUpdate).toFixed(2), 'ms');

        // ✅ PERF: Direct call with cached references (no querySelector)
        const beforeButtonUpdate = performance.now();
        this.updateSaveButtonState();
        const afterButtonUpdate = performance.now();
        console.log('[HANDLER-DEBUG] Button update time:', (afterButtonUpdate - beforeButtonUpdate).toFixed(2), 'ms');

        const fnEnd = performance.now();
        console.log('[HANDLER-DEBUG] TOTAL handleTitleInput time:', (fnEnd - fnStart).toFixed(2), 'ms');
        console.log('[HANDLER-DEBUG] ========== handleTitleInput END ==========');
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
            const showAddButton = depth < PathUtils.MAX_DEPTH - 1;

            // Removed folder count display per user request

            let html = `
                <div class="folder-item ${isSelected ? 'selected' : ''}"
                     data-path="${this.escapeAttr(node.folder.path)}"
                     data-depth="${depth}"
                     style="padding-left: ${indent + 12}px;">
                    <span class="folder-toggle ${isExpanded ? 'expanded' : ''}"
                          data-path="${this.escapeAttr(node.folder.path)}"
                          aria-label="Toggle folder">▶</span>
                    <span class="folder-icon">${icon}</span>
                    <span class="folder-name">${this.escapeHtml(node.folder.name)}</span>
                    ${isSelected ? '<span class="folder-check">✓</span>' : ''}
                    ${showAddButton ? `
                        <div class="item-actions">
                            <button class="action-btn folder-add-btn"
                                    data-parent="${this.escapeAttr(node.folder.path)}"
                                    title="Add subfolder">${Icons.plus}</button>
                        </div>
                    ` : ''}
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
     * Bind folder click handlers using event delegation
     * CRITICAL FIX: Use delegation to avoid memory leaks from repeated binding
     */
    private bindFolderClickHandlers(): void {
        if (!this.modal) return;

        const treeContainer = this.modal.querySelector('.folder-tree-container');
        if (!treeContainer) return;

        // ✅ FIX: Use event delegation - bind ONCE on container instead of on every item
        // This prevents listener accumulation when renderFolderTree() is called repeatedly

        // Remove existing delegated listener if any (defensive)
        const existingHandler = (treeContainer as any).__delegatedClickHandler;
        if (existingHandler) {
            treeContainer.removeEventListener('click', existingHandler);
        }

        // Create delegated click handler
        const delegatedHandler = (e: Event) => {
            const target = e.target as HTMLElement;

            // Handle folder toggle clicks
            if (target.classList.contains('folder-toggle')) {
                e.stopPropagation();
                const path = target.dataset.path!;

                // Toggle expansion state
                if (this.expandedPaths.has(path)) {
                    this.expandedPaths.delete(path);
                } else {
                    this.expandedPaths.add(path);
                }

                // Re-render tree
                this.renderFolderTree();
                return;
            }

            // Handle add subfolder button clicks
            if (target.classList.contains('folder-add-btn') || target.closest('.folder-add-btn')) {
                e.stopPropagation();
                const btn = target.classList.contains('folder-add-btn') ? target : target.closest('.folder-add-btn') as HTMLElement;
                const parentPath = btn.dataset.parent!;
                this.showCreateSubfolderInput(parentPath);
                return;
            }

            // Handle folder item clicks
            const folderItem = target.closest('.folder-item') as HTMLElement;
            if (folderItem) {
                e.stopPropagation();
                const path = folderItem.dataset.path!;
                this.handleFolderClick(path);
            }
        };

        // Store reference for future cleanup
        (treeContainer as any).__delegatedClickHandler = delegatedHandler;

        // Bind delegated handler ONCE
        treeContainer.addEventListener('click', delegatedHandler);

        console.log('[PERF-FIX] Event delegation setup complete - single listener for all folders');
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
     * Show simple notification (for BookmarkSaveModal errors)
     * Uses browser alert as fallback since this modal is not in Shadow DOM
     */
    private showSimpleNotification(_type: 'error' | 'warning' | 'info', message: string): void {
        // For now, use alert as it's simple and works everywhere
        // TODO: Consider creating a lightweight toast notification
        alert(message);
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

    /**
     * Create folder
     */
    private async createFolder(name: string, parentPath: string | null): Promise<void> {
        const validation = PathUtils.getFolderNameValidation(name);
        if (!validation.isValid) {
            this.showSimpleNotification('error', this.getFolderNameErrorMessage(validation.errors));
            return;
        }

        const newPath = parentPath ? `${parentPath}/${validation.normalized}` : validation.normalized;

        // Check depth limit (max 4 levels: a/b/c/d, not a/b/c/d/e)
        const depth = newPath.split('/').length;
        if (depth > PathUtils.MAX_DEPTH) {
            this.showSimpleNotification('error', `Maximum folder depth is ${PathUtils.MAX_DEPTH} levels (e.g., Work/Projects/AI/ChatGPT)`);
            return;
        }

        const exists = this.folders.find(f => f.path === newPath);
        if (exists) {
            this.showSimpleNotification('error', `Folder "${validation.normalized}" already exists`);
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

            // Update button state based on mode
            if (this.currentMode === 'folder-select') {
                // In Move mode, always enable button when folder is selected
                const moveBtn = this.modal?.querySelector('.save-modal-btn-save') as HTMLButtonElement;
                if (moveBtn) {
                    moveBtn.disabled = false;
                }
            } else {
                // In Save mode, check title validity
                this.updateSaveButtonState();
            }
        } catch (error) {
            logger.error('[BookmarkSaveModal] Failed to create folder:', error);
            this.showSimpleNotification('error', `Failed to create folder: ${error instanceof Error ? error.message : 'Unknown error'}`);
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

            // Create AbortController
            this.abortController = new AbortController();

            // Inject styles into Shadow DOM (reuse injectStyles())
            this.injectStyles();

            // Create overlay in Shadow DOM
            this.overlay = document.createElement('div');
            this.overlay.className = 'modal-overlay';

            // Create modal (same structure as createModal but with "Move" title and button)
            const modal = document.createElement('div');
            modal.className = 'bookmark-save-modal';

            // Stop propagation on modal content
            modal.addEventListener('click', (e) => {
                e.stopPropagation();
            });

            modal.innerHTML = `
                <div class="save-modal-header">
                    <h2>Move Bookmarks to Folder</h2>
                    <button class="save-modal-close-btn" aria-label="Close">×</button>
                </div>

                <div class="save-modal-body">
                    <div class="bookmark-count-info">
                        Moving <strong>${bookmarkCount}</strong> bookmark${bookmarkCount !== 1 ? 's' : ''}
                    </div>

                    <div class="folder-section">
                        <div class="folder-header">
                            <span class="folder-label">Select Folder</span>
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

            // Mount to Shadow DOM (same pattern as show())
            this.shadowRoot!.appendChild(this.overlay);
            document.body.appendChild(this.container!);

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
