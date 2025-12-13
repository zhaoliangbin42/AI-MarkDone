

/**
 * Bookmark Edit Modal
 * Allows users to add title and notes when saving a bookmark
 */
export class BookmarkEditModal {
    private overlay: HTMLElement | null = null;
    private modal: HTMLElement | null = null;
    private onSave: ((title: string, notes: string) => void) | null = null;
    private onCancel: (() => void) | null = null;
    private escKeyHandler: ((e: KeyboardEvent) => void) | null = null;

    /**
     * Show edit modal
     */
    show(userMessage: string, onSave: (title: string, notes: string) => void, onCancel: () => void): void {
        this.onSave = onSave;
        this.onCancel = onCancel;

        // Create overlay (like AITimeline - NO Shadow DOM)
        this.overlay = document.createElement('div');
        this.overlay.className = 'bookmark-edit-modal-overlay';
        this.overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.5);
            z-index: 2147483646;
            display: flex;
            align-items: center;
            justify-content: center;
        `;

        // Create modal
        this.modal = this.createModal(userMessage);
        this.overlay.appendChild(this.modal);

        // Add to body
        document.body.appendChild(this.overlay);

        // Click outside to close - AITimeline pattern
        this.overlay.addEventListener('click', (e) => {
            // Check if click is on overlay (not modal or its children)
            if (e.target === this.overlay) {
                this.handleCancel();
            }
        });

        // Add ESC key handler
        this.escKeyHandler = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                this.handleCancel();
            }
        };
        document.addEventListener('keydown', this.escKeyHandler);

        // Focus title input
        setTimeout(() => {
            const titleInput = this.modal?.querySelector('#bookmark-title') as HTMLInputElement;
            if (titleInput) {
                titleInput.focus();
                titleInput.select();
            }
        }, 100);
    }

    /**
     * Create modal structure
     */
    private createModal(userMessage: string): HTMLElement {
        const modal = document.createElement('div');
        modal.className = 'bookmark-edit-modal';

        // Add inline styles
        modal.style.cssText = `
            position: relative;
            width: 90%;
            max-width: 500px;
            background: white;
            border-radius: 12px;
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        `;

        // CRITICAL FIX: Stop propagation on modal content
        modal.addEventListener('click', (e) => {
            e.stopPropagation();
        });

        // Default title is first 50 chars of user message
        const defaultTitle = userMessage.substring(0, 50) + (userMessage.length > 50 ? '...' : '');

        modal.innerHTML = `
            <style>
                .bookmark-edit-modal * {
                    box-sizing: border-box;
                }
                .bookmark-edit-modal-header {
                    padding: 20px 24px;
                    border-bottom: 1px solid #e5e7eb;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                }
                .bookmark-edit-modal-header h2 {
                    margin: 0;
                    font-size: 18px;
                    font-weight: 600;
                    color: #111827;
                }
                .bookmark-edit-modal-close-btn {
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
                .bookmark-edit-modal-close-btn:hover {
                    background: #f3f4f6;
                    color: #111827;
                }
                .bookmark-edit-modal-body {
                    padding: 24px;
                }
                .bookmark-edit-modal-form-group {
                    margin-bottom: 20px;
                }
                .bookmark-edit-modal-form-group label {
                    display: block;
                    margin-bottom: 8px;
                    font-size: 14px;
                    font-weight: 500;
                    color: #374151;
                }
                .bookmark-edit-modal-form-group input,
                .bookmark-edit-modal-form-group textarea {
                    width: 100%;
                    padding: 10px 12px;
                    border: 1px solid #d1d5db;
                    border-radius: 6px;
                    font-size: 14px;
                    font-family: inherit;
                    transition: all 0.2s;
                }
                .bookmark-edit-modal-form-group input:focus,
                .bookmark-edit-modal-form-group textarea:focus {
                    outline: none;
                    border-color: #3b82f6;
                    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
                }
                .bookmark-edit-modal-preview-group {
                    margin-top: 20px;
                    padding: 16px;
                    background: #f9fafb;
                    border-radius: 8px;
                }
                .bookmark-edit-modal-preview-group label {
                    display: block;
                    margin-bottom: 8px;
                    font-size: 12px;
                    font-weight: 500;
                    color: #6b7280;
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                }
                .bookmark-edit-modal-preview-text {
                    font-size: 14px;
                    color: #374151;
                    line-height: 1.5;
                    max-height: 100px;
                    overflow-y: auto;
                }
                .bookmark-edit-modal-footer {
                    padding: 16px 24px;
                    border-top: 1px solid #e5e7eb;
                    display: flex;
                    justify-content: flex-end;
                    gap: 12px;
                }
                .bookmark-edit-modal-btn {
                    padding: 10px 20px;
                    border-radius: 6px;
                    font-size: 14px;
                    font-weight: 500;
                    cursor: pointer;
                    transition: all 0.2s;
                    border: none;
                }
                .bookmark-edit-modal-btn-cancel {
                    background: #f3f4f6;
                    color: #374151;
                }
                .bookmark-edit-modal-btn-cancel:hover {
                    background: #e5e7eb;
                }
                .bookmark-edit-modal-btn-save {
                    background: #3b82f6;
                    color: white;
                }
                .bookmark-edit-modal-btn-save:hover {
                    background: #2563eb;
                }
            </style>
            <div class="bookmark-edit-modal-header">
                <h2>📌 Save Bookmark</h2>
                <button class="bookmark-edit-modal-close-btn" aria-label="Close">×</button>
            </div>
            <div class="bookmark-edit-modal-body">
                <div class="bookmark-edit-modal-form-group">
                    <label for="bookmark-title">Title</label>
                    <input 
                        type="text" 
                        id="bookmark-title" 
                        value="${this.escapeHtml(defaultTitle)}"
                        placeholder="Enter bookmark title..."
                    />
                </div>
                <div class="bookmark-edit-modal-form-group">
                    <label for="bookmark-notes">Notes (Optional)</label>
                    <textarea 
                        id="bookmark-notes" 
                        rows="3"
                        placeholder="Add any notes about this bookmark..."
                    ></textarea>
                </div>
                <div class="bookmark-edit-modal-preview-group">
                    <label>User Message Preview</label>
                    <div class="bookmark-edit-modal-preview-text">${this.escapeHtml(userMessage)}</div>
                </div>
            </div>
            <div class="bookmark-edit-modal-footer">
                <button class="bookmark-edit-modal-btn bookmark-edit-modal-btn-cancel">Cancel</button>
                <button class="bookmark-edit-modal-btn bookmark-edit-modal-btn-save">Save Bookmark</button>
            </div>
        `;

        // Bind events
        this.bindEvents(modal);

        return modal;
    }

    /**
     * Bind event listeners
     */
    private bindEvents(modal: HTMLElement): void {
        // Close button
        modal.querySelector('.bookmark-edit-modal-close-btn')?.addEventListener('click', () => this.handleCancel());

        // Cancel button
        modal.querySelector('.bookmark-edit-modal-btn-cancel')?.addEventListener('click', () => this.handleCancel());

        // Save button
        modal.querySelector('.bookmark-edit-modal-btn-save')?.addEventListener('click', () => this.handleSave());

        // Enter to save
        modal.querySelector('#bookmark-title')?.addEventListener('keypress', (e) => {
            if ((e as KeyboardEvent).key === 'Enter') this.handleSave();
        });
    }

    /**
     * Handle save
     */
    private handleSave(): void {
        const titleInput = this.modal?.querySelector('#bookmark-title') as HTMLInputElement;
        const notesTextarea = this.modal?.querySelector('#bookmark-notes') as HTMLTextAreaElement;

        const title = titleInput?.value.trim() || '';
        const notes = notesTextarea?.value.trim() || '';

        if (this.onSave) {
            this.onSave(title, notes);
        }

        this.close();
    }

    /**
     * Handle cancel
     */
    private handleCancel(): void {
        if (this.onCancel) {
            this.onCancel();
        }
        this.close();
    }

    /**
     * Close modal
     */
    private close(): void {
        // Remove ESC key handler
        if (this.escKeyHandler) {
            document.removeEventListener('keydown', this.escKeyHandler);
            this.escKeyHandler = null;
        }

        if (this.overlay) {
            this.overlay.remove();
            this.overlay = null;
            this.modal = null;
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
}

export const bookmarkEditModal = new BookmarkEditModal();
