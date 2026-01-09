/**
 * DialogManager - Promise-based dialog manager (Singleton)
 * 
 * Provides a unified API for showing Alert, Confirm, and Prompt dialogs.
 * Replaces native browser dialogs with styled Shadow DOM components.
 * 
 * @example
 * // Alert
 * await DialogManager.alert({ title: 'Error', message: 'Something went wrong' });
 * 
 * // Confirm
 * const confirmed = await DialogManager.confirm({ 
 *     title: 'Delete?', 
 *     message: 'This action is irreversible.',
 *     danger: true 
 * });
 * if (confirmed) { deleteItem(); }
 * 
 * // Prompt
 * const name = await DialogManager.prompt({ 
 *     title: 'New Folder', 
 *     placeholder: 'Enter folder name',
 *     validation: (v) => v.trim() ? { valid: true } : { valid: false, error: 'Name is required' }
 * });
 * if (name) { createFolder(name); }
 * 
 * @see /docs/antigravity/style/TOKEN_REFERENCE.md
 */

import { DialogHost, AlertOptions, ConfirmOptions, PromptOptions } from './DialogHost';

/**
 * DialogManager - Singleton for managing dialogs
 */
export class DialogManager {
    private static instance: DialogManager | null = null;
    private host: DialogHost | null = null;

    /**
     * Private constructor for singleton pattern
     */
    private constructor() { }

    /**
     * Get the singleton instance
     */
    static getInstance(): DialogManager {
        if (!DialogManager.instance) {
            DialogManager.instance = new DialogManager();
        }
        return DialogManager.instance;
    }

    /**
     * Ensure the dialog host is mounted
     */
    private ensureHost(): DialogHost {
        if (!this.host) {
            this.host = new DialogHost();
        }
        this.host.mount();
        return this.host;
    }

    /**
     * Show an alert dialog
     * 
     * @param options Alert options
     * @returns Promise that resolves when dialog is closed
     */
    static async alert(options: AlertOptions): Promise<void> {
        const manager = DialogManager.getInstance();
        const host = manager.ensureHost();
        return host.showAlert(options);
    }

    /**
     * Show a confirm dialog
     * 
     * @param options Confirm options
     * @returns Promise that resolves to true if confirmed, false if cancelled
     */
    static async confirm(options: ConfirmOptions): Promise<boolean> {
        const manager = DialogManager.getInstance();
        const host = manager.ensureHost();
        return host.showConfirm(options);
    }

    /**
     * Show a prompt dialog
     * 
     * @param options Prompt options
     * @returns Promise that resolves to the input value, or null if cancelled
     */
    static async prompt(options: PromptOptions): Promise<string | null> {
        const manager = DialogManager.getInstance();
        const host = manager.ensureHost();
        return host.showPrompt(options);
    }

    /**
     * Cleanup and destroy the dialog manager
     */
    static destroy(): void {
        const manager = DialogManager.getInstance();
        manager.host?.unmount();
        manager.host = null;
        DialogManager.instance = null;
    }
}

// Re-export types for convenience
export type { AlertOptions, ConfirmOptions, PromptOptions };
