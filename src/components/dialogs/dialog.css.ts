/**
 * Dialog Component Styles
 * 
 * Shared styles for Alert, Confirm, and Prompt dialogs.
 * All styles use --aimd-* semantic tokens per style-guide.md.
 * 
 * @see /docs/antigravity/style/TOKEN_REFERENCE.md
 * @see /.agent/rules/style-guide.md
 */

export const dialogStyles = `
    /* ============================================
       DIALOG OVERLAY
       ============================================ */
    .dialog-overlay {
        position: fixed;
        inset: 0;
        z-index: var(--aimd-z-dialog);
        background: var(--aimd-bg-overlay-heavy);
        backdrop-filter: var(--aimd-overlay-backdrop);
        -webkit-backdrop-filter: var(--aimd-overlay-backdrop);
        display: flex;
        align-items: center;
        justify-content: center;
        animation: dialogFadeIn var(--aimd-duration-fast) var(--aimd-ease-out);
        pointer-events: auto; /* Restore click handling (container has pointer-events: none) */
    }

    /* ============================================
       DIALOG CONTAINER
       ============================================ */
    .dialog-container {
        position: relative;
        background: var(--aimd-bg-primary);
        color: var(--aimd-text-primary);
        border: 1px solid var(--aimd-border-default);
        border-radius: var(--aimd-radius-xl);
        box-shadow: var(--aimd-shadow-xl);
        min-width: 320px;
        max-width: 480px;
        width: 90%;
        padding: 0;
        margin: 0;
        animation: dialogSlideIn var(--aimd-duration-base) var(--aimd-ease-out);
        font-family: var(--aimd-font-sans);
    }

    /* Native dialog reset */
    .dialog-container::backdrop {
        display: none;
    }

    /* ============================================
       DIALOG HEADER
       ============================================ */
    .dialog-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: var(--aimd-space-4) var(--aimd-space-6);
        border-bottom: 1px solid var(--aimd-border-subtle);
    }

    .dialog-title {
        margin: 0;
        font-size: var(--aimd-text-lg);
        font-weight: var(--aimd-font-semibold);
        color: var(--aimd-text-primary);
    }

    .dialog-close-btn {
        background: none;
        border: none;
        font-size: var(--aimd-text-2xl);
        color: var(--aimd-text-secondary);
        cursor: pointer;
        padding: 0;
        width: 32px;
        height: 32px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: var(--aimd-radius-md);
        transition: all var(--aimd-duration-fast) var(--aimd-ease-in-out);
    }

    .dialog-close-btn:hover {
        background: var(--aimd-interactive-hover);
        color: var(--aimd-text-primary);
    }

    /* ============================================
       DIALOG BODY
       ============================================ */
    .dialog-body {
        padding: var(--aimd-space-4) var(--aimd-space-6);
    }

    .dialog-message {
        margin: 0;
        font-size: var(--aimd-text-base);
        color: var(--aimd-text-secondary);
        line-height: var(--aimd-leading-normal);
    }

    /* ============================================
       DIALOG INPUT (for Prompt)
       ============================================ */
    .dialog-input-wrapper {
        margin-top: var(--aimd-space-3);
    }

    .dialog-input {
        width: 100%;
        padding: var(--aimd-space-2) var(--aimd-space-3);
        border: 1.5px solid var(--aimd-border-default);
        border-radius: var(--aimd-radius-md);
        font-size: var(--aimd-text-base);
        font-family: var(--aimd-font-sans);
        background: var(--aimd-bg-primary);
        color: var(--aimd-text-primary);
        box-sizing: border-box;
        transition: border-color var(--aimd-duration-fast) var(--aimd-ease-in-out),
                    box-shadow var(--aimd-duration-fast) var(--aimd-ease-in-out);
    }

    .dialog-input::placeholder {
        color: var(--aimd-text-tertiary);
    }

    .dialog-input:focus {
        outline: none;
        border-color: var(--aimd-border-focus);
        box-shadow: var(--aimd-shadow-focus);
    }

    .dialog-input.error {
        border-color: var(--aimd-interactive-danger);
    }

    .dialog-input-error {
        margin-top: var(--aimd-space-1);
        font-size: var(--aimd-text-sm);
        color: var(--aimd-interactive-danger);
        display: none;
    }

    .dialog-input-error.visible {
        display: block;
    }

    /* ============================================
       DIALOG FOOTER
       ============================================ */
    .dialog-footer {
        display: flex;
        justify-content: flex-end;
        gap: var(--aimd-space-2);
        padding: var(--aimd-space-4) var(--aimd-space-6);
        border-top: 1px solid var(--aimd-border-subtle);
    }

    /* ============================================
       DIALOG BUTTONS
       ============================================ */
    .dialog-btn {
        padding: var(--aimd-space-2) var(--aimd-space-4);
        border-radius: var(--aimd-radius-md);
        font-size: var(--aimd-text-sm);
        font-weight: var(--aimd-font-medium);
        font-family: var(--aimd-font-sans);
        cursor: pointer;
        border: none;
        transition: all var(--aimd-duration-fast) var(--aimd-ease-in-out);
    }

    .dialog-btn:disabled {
        cursor: not-allowed;
        opacity: 0.6;
    }

    /* Secondary Button (Cancel) */
    .dialog-btn-secondary {
        background: var(--aimd-button-secondary-bg);
        color: var(--aimd-button-secondary-text);
        border: 1px solid var(--aimd-border-default);
    }

    .dialog-btn-secondary:hover:not(:disabled) {
        background: var(--aimd-button-secondary-hover);
    }

    /* Primary Button (OK/Confirm) */
    .dialog-btn-primary {
        background: var(--aimd-button-primary-bg);
        color: var(--aimd-button-primary-text);
    }

    .dialog-btn-primary:hover:not(:disabled) {
        background: var(--aimd-button-primary-hover);
    }

    /* Danger Button (Delete/Destructive) */
    .dialog-btn-danger {
        background: var(--aimd-button-danger-bg);
        color: var(--aimd-button-danger-text);
    }

    .dialog-btn-danger:hover:not(:disabled) {
        background: var(--aimd-button-danger-hover);
    }

    /* ============================================
       ANIMATIONS
       ============================================ */
    @keyframes dialogFadeIn {
        from { opacity: 0; }
        to { opacity: 1; }
    }

    @keyframes dialogSlideIn {
        from { 
            opacity: 0; 
            transform: translateY(-20px) scale(0.95); 
        }
        to { 
            opacity: 1; 
            transform: translateY(0) scale(1); 
        }
    }

    @keyframes dialogFadeOut {
        from { opacity: 1; }
        to { opacity: 0; }
    }

    @keyframes dialogSlideOut {
        from { 
            opacity: 1; 
            transform: translateY(0) scale(1); 
        }
        to { 
            opacity: 0; 
            transform: translateY(-20px) scale(0.95); 
        }
    }
`;
