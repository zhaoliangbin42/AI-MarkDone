/**
 * DialogHost - Shadow DOM container for dialogs
 * 
 * Provides isolated rendering environment for Alert, Confirm, and Prompt dialogs.
 * Uses Shadow DOM for style encapsulation and Design Tokens for theming.
 * 
 * @example
 * const host = new DialogHost();
 * host.mount();
 * const result = await host.showConfirm({ title: 'Delete?', message: 'Are you sure?' });
 * host.unmount();
 * 
 * @see /docs/antigravity/style/TOKEN_REFERENCE.md
 */

import { dialogStyles } from './dialogs/dialog.css';
import { DesignTokens } from '../utils/design-tokens';
import { ThemeManager } from '../utils/ThemeManager';
import { setupKeyboardIsolation } from '../utils/dom-utils';

/**
 * Alert dialog options
 */
export interface AlertOptions {
    title?: string;
    message: string;
    buttonText?: string;
}

/**
 * Confirm dialog options
 */
export interface ConfirmOptions {
    title?: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    danger?: boolean;
}

/**
 * Prompt dialog options
 */
export interface PromptOptions {
    title?: string;
    message?: string;
    placeholder?: string;
    defaultValue?: string;
    confirmText?: string;
    cancelText?: string;
    validation?: (value: string) => { valid: boolean; error?: string };
}

/**
 * DialogHost - Shadow DOM container for dialogs
 */
export class DialogHost {
    private container: HTMLDivElement | null = null;
    private shadowRoot: ShadowRoot | null = null;
    private abortController: AbortController | null = null;
    private resolvePromise: ((value: any) => void) | null = null;

    /**
     * Mount the dialog host to the document body
     */
    mount(): void {
        if (this.container) return;

        this.container = document.createElement('div');
        this.container.className = 'aimd-dialog-host';

        // CRITICAL: Set z-index on the container element itself (not in Shadow DOM)
        // This ensures it appears above all page content, including SimpleBookmarkPanel
        // Pattern matches SimpleBookmarkPanel.ts L103-108
        this.container.style.position = 'fixed';
        this.container.style.inset = '0';
        this.container.style.zIndex = 'var(--aimd-z-dialog)';
        this.container.style.pointerEvents = 'none'; // Allow clicks to pass through container

        this.shadowRoot = this.container.attachShadow({ mode: 'open' });

        // Inject styles with design tokens
        this.injectStyles();

        document.body.appendChild(this.container);
    }

    /**
     * Unmount and cleanup the dialog host
     */
    unmount(): void {
        this.abortController?.abort();
        this.abortController = null;

        if (this.container && this.container.parentNode) {
            this.container.remove();
        }

        this.container = null;
        this.shadowRoot = null;
        this.resolvePromise = null;
    }

    /**
     * Show an alert dialog
     */
    async showAlert(options: AlertOptions): Promise<void> {
        return new Promise((resolve) => {
            this.resolvePromise = resolve;
            this.renderAlertDialog(options);
        });
    }

    /**
     * Show a confirm dialog
     */
    async showConfirm(options: ConfirmOptions): Promise<boolean> {
        return new Promise((resolve) => {
            this.resolvePromise = resolve;
            this.renderConfirmDialog(options);
        });
    }

    /**
     * Show a prompt dialog
     */
    async showPrompt(options: PromptOptions): Promise<string | null> {
        return new Promise((resolve) => {
            this.resolvePromise = resolve;
            this.renderPromptDialog(options);
        });
    }

    /**
     * Inject styles into Shadow DOM
     */
    private injectStyles(): void {
        if (!this.shadowRoot) return;

        const isDark = ThemeManager.getInstance().isDarkMode();
        const tokens = isDark ? DesignTokens.getDarkTokens() : DesignTokens.getLightTokens();

        const styleElement = document.createElement('style');
        styleElement.textContent = `
            :host { ${tokens} }
            * { box-sizing: border-box; }
            ${dialogStyles}
        `;
        this.shadowRoot.appendChild(styleElement);
    }

    /**
     * Render alert dialog
     */
    private renderAlertDialog(options: AlertOptions): void {
        if (!this.shadowRoot) return;

        this.abortController = new AbortController();
        const signal = this.abortController.signal;

        const overlay = this.createOverlay();
        const dialog = document.createElement('div');
        dialog.className = 'dialog-container';
        dialog.setAttribute('role', 'alertdialog');
        dialog.setAttribute('aria-modal', 'true');
        dialog.setAttribute('aria-labelledby', 'dialog-title');

        const title = options.title || 'Notice';
        const buttonText = options.buttonText || 'OK';

        dialog.innerHTML = `
            <div class="dialog-header">
                <h2 class="dialog-title" id="dialog-title">${this.escapeHtml(title)}</h2>
            </div>
            <div class="dialog-body">
                <p class="dialog-message">${this.escapeHtml(options.message)}</p>
            </div>
            <div class="dialog-footer">
                <button class="dialog-btn dialog-btn-primary" id="dialog-ok">${this.escapeHtml(buttonText)}</button>
            </div>
        `;

        overlay.appendChild(dialog);
        this.shadowRoot.appendChild(overlay);

        // Focus the OK button
        const okBtn = dialog.querySelector('#dialog-ok') as HTMLButtonElement;
        okBtn?.focus();

        // Event handlers
        okBtn?.addEventListener('click', () => {
            this.closeDialog();
            this.resolvePromise?.(undefined);
        }, { signal });

        // ESC key handler
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.closeDialog();
                this.resolvePromise?.(undefined);
            }
        }, { signal });

        // Prevent clicks inside dialog from closing
        dialog.addEventListener('click', (e) => e.stopPropagation(), { signal });

        // Click outside to close (for alert, just close)
        overlay.addEventListener('click', () => {
            this.closeDialog();
            this.resolvePromise?.(undefined);
        }, { signal });
    }

    /**
     * Render confirm dialog
     */
    private renderConfirmDialog(options: ConfirmOptions): void {
        if (!this.shadowRoot) return;

        this.abortController = new AbortController();
        const signal = this.abortController.signal;

        const overlay = this.createOverlay();
        const dialog = document.createElement('div');
        dialog.className = 'dialog-container';
        dialog.setAttribute('role', 'alertdialog');
        dialog.setAttribute('aria-modal', 'true');
        dialog.setAttribute('aria-labelledby', 'dialog-title');

        const title = options.title || 'Confirm';
        const confirmText = options.confirmText || 'Confirm';
        const cancelText = options.cancelText || 'Cancel';
        const confirmBtnClass = options.danger ? 'dialog-btn-danger' : 'dialog-btn-primary';

        dialog.innerHTML = `
            <div class="dialog-header">
                <h2 class="dialog-title" id="dialog-title">${this.escapeHtml(title)}</h2>
            </div>
            <div class="dialog-body">
                <p class="dialog-message">${this.escapeHtml(options.message)}</p>
            </div>
            <div class="dialog-footer">
                <button class="dialog-btn dialog-btn-secondary" id="dialog-cancel">${this.escapeHtml(cancelText)}</button>
                <button class="dialog-btn ${confirmBtnClass}" id="dialog-confirm">${this.escapeHtml(confirmText)}</button>
            </div>
        `;

        overlay.appendChild(dialog);
        this.shadowRoot.appendChild(overlay);

        // Focus the confirm button
        const confirmBtn = dialog.querySelector('#dialog-confirm') as HTMLButtonElement;
        confirmBtn?.focus();

        // Event handlers
        const cancelBtn = dialog.querySelector('#dialog-cancel') as HTMLButtonElement;

        confirmBtn?.addEventListener('click', () => {
            this.closeDialog();
            this.resolvePromise?.(true);
        }, { signal });

        cancelBtn?.addEventListener('click', () => {
            this.closeDialog();
            this.resolvePromise?.(false);
        }, { signal });

        // ESC key handler
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.closeDialog();
                this.resolvePromise?.(false);
            }
        }, { signal });

        // Prevent clicks inside dialog from closing
        dialog.addEventListener('click', (e) => e.stopPropagation(), { signal });

        // Click outside to cancel
        overlay.addEventListener('click', () => {
            this.closeDialog();
            this.resolvePromise?.(false);
        }, { signal });
    }

    /**
     * Render prompt dialog
     */
    private renderPromptDialog(options: PromptOptions): void {
        if (!this.shadowRoot) return;

        this.abortController = new AbortController();
        const signal = this.abortController.signal;

        const overlay = this.createOverlay();
        const dialog = document.createElement('div');
        dialog.className = 'dialog-container';
        dialog.setAttribute('role', 'dialog');
        dialog.setAttribute('aria-modal', 'true');
        dialog.setAttribute('aria-labelledby', 'dialog-title');

        const title = options.title || 'Input';
        const confirmText = options.confirmText || 'OK';
        const cancelText = options.cancelText || 'Cancel';
        const placeholder = options.placeholder || '';
        const defaultValue = options.defaultValue || '';

        dialog.innerHTML = `
            <div class="dialog-header">
                <h2 class="dialog-title" id="dialog-title">${this.escapeHtml(title)}</h2>
            </div>
            <div class="dialog-body">
                ${options.message ? `<p class="dialog-message">${this.escapeHtml(options.message)}</p>` : ''}
                <div class="dialog-input-wrapper">
                    <input type="text" 
                           class="dialog-input" 
                           id="dialog-input"
                           placeholder="${this.escapeAttr(placeholder)}"
                           value="${this.escapeAttr(defaultValue)}"
                           autocomplete="off">
                    <div class="dialog-input-error" id="dialog-error"></div>
                </div>
            </div>
            <div class="dialog-footer">
                <button class="dialog-btn dialog-btn-secondary" id="dialog-cancel">${this.escapeHtml(cancelText)}</button>
                <button class="dialog-btn dialog-btn-primary" id="dialog-confirm">${this.escapeHtml(confirmText)}</button>
            </div>
        `;

        overlay.appendChild(dialog);
        this.shadowRoot.appendChild(overlay);

        // Get elements
        const inputEl = dialog.querySelector('#dialog-input') as HTMLInputElement;
        const confirmBtn = dialog.querySelector('#dialog-confirm') as HTMLButtonElement;
        const cancelBtn = dialog.querySelector('#dialog-cancel') as HTMLButtonElement;
        const errorEl = dialog.querySelector('#dialog-error') as HTMLElement;

        // Focus and select input
        inputEl?.focus();
        inputEl?.select();

        // Validation helper
        const validateInput = (): boolean => {
            if (!options.validation) return true;

            const result = options.validation(inputEl.value);
            if (!result.valid) {
                inputEl.classList.add('error');
                errorEl.textContent = result.error || 'Invalid input';
                errorEl.classList.add('visible');
                return false;
            } else {
                inputEl.classList.remove('error');
                errorEl.classList.remove('visible');
                return true;
            }
        };

        // Submit handler
        const handleSubmit = () => {
            if (validateInput()) {
                this.closeDialog();
                this.resolvePromise?.(inputEl.value);
            }
        };

        // Event handlers
        confirmBtn?.addEventListener('click', handleSubmit, { signal });

        cancelBtn?.addEventListener('click', () => {
            this.closeDialog();
            this.resolvePromise?.(null);
        }, { signal });

        // Input validation on change
        inputEl?.addEventListener('input', () => {
            if (options.validation) {
                validateInput();
            }
        }, { signal });

        // Enter key to submit
        inputEl?.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                handleSubmit();
            }
        }, { signal });

        // Why: prevent host pages (ChatGPT/Gemini/Claude) from stealing focus / breaking IME composition.
        this.blockPageKeyboardEvents(signal);

        // ESC key handler
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.closeDialog();
                this.resolvePromise?.(null);
            }
        }, { signal });

        // Prevent clicks inside dialog from closing
        dialog.addEventListener('click', (e) => e.stopPropagation(), { signal });

        // Click outside to cancel
        overlay.addEventListener('click', () => {
            this.closeDialog();
            this.resolvePromise?.(null);
        }, { signal });
    }

    /**
     * Setup keyboard isolation on dialog input
     * Uses shared utility to prevent host page from stealing focus
     */
    private blockPageKeyboardEvents(_signal: AbortSignal | undefined): void {
        const inputEl = this.shadowRoot?.querySelector('#dialog-input') as HTMLInputElement;
        if (!inputEl) return;
        setupKeyboardIsolation(inputEl, { componentName: 'DialogHost' });
    }

    /**
     * Create overlay element
     */
    private createOverlay(): HTMLDivElement {
        const overlay = document.createElement('div');
        overlay.className = 'dialog-overlay';
        return overlay;
    }

    /**
     * Close the current dialog
     */
    private closeDialog(): void {
        this.abortController?.abort();
        this.abortController = null;

        if (this.shadowRoot) {
            const overlay = this.shadowRoot.querySelector('.dialog-overlay');
            overlay?.remove();
        }
    }

    /**
     * Escape HTML for safe rendering
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
}
