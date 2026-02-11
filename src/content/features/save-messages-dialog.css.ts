/**
 * Save Messages Dialog Styles
 * 
 * Uses design tokens only (no hardcoded values).
 * Supports light/dark mode via semantic tokens.
 */

export const saveMessagesDialogStyles = `
    :host {
        --aimd-dialog-bg: var(--bg-surface);
        --aimd-dialog-border: var(--border-default);
        --aimd-dialog-border-strong: var(--border-strong);
        --aimd-dialog-focus: var(--border-focus);
        --aimd-dialog-button-height: 36px;
        --aimd-dialog-title: var(--text-primary);
        --aimd-dialog-text: var(--text-primary);
        --aimd-dialog-muted-text: var(--text-secondary);
        --aimd-dialog-hover-bg: var(--interactive-hover);
        --aimd-dialog-selected-bg: var(--interactive-selected);
        --aimd-dialog-primary-bg: var(--interactive-primary);
        --aimd-dialog-primary-hover-bg: var(--interactive-primary-hover);
        --aimd-dialog-primary-text: var(--text-on-primary);
        --aimd-dialog-disabled-bg: var(--interactive-disabled);
    }

    /* Dialog Overlay */
    .save-messages-overlay {
        position: fixed;
        inset: 0;
        background: var(--bg-overlay, var(--aimd-modal-overlay));
        z-index: var(--z-dialog, var(--aimd-z-dialog));
        display: flex;
        align-items: center;
        justify-content: center;
        animation: fadeIn 0.15s ease-out;
    }

    @keyframes fadeIn {
        from { opacity: 0; }
        to { opacity: 1; }
    }

    /* Dialog Container */
    .save-messages-dialog {
        position: relative;  /* Required for tooltip absolute positioning */
        background: var(--aimd-dialog-bg);
        border-radius: var(--radius-lg, var(--aimd-radius-lg));
        box-shadow: var(--shadow-xl, var(--aimd-modal-shadow));
        max-width: 500px;
        width: 90%;
        max-height: 80vh;
        overflow: hidden;
        display: flex;
        flex-direction: column;
        animation: slideUp 0.2s ease-out;
    }

    @keyframes slideUp {
        from { 
            opacity: 0;
            transform: translateY(20px);
        }
        to { 
            opacity: 1;
            transform: translateY(0);
        }
    }

    /* Header */
    .save-messages-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: var(--space-md, var(--aimd-space-4));
        border-bottom: 1px solid var(--aimd-dialog-border);
    }

    .save-messages-title {
        font-size: var(--font-size-lg, var(--aimd-text-lg));
        font-weight: 600;
        color: var(--aimd-dialog-title);
        margin: 0;
    }

    .save-messages-close-btn {
        background: transparent;
        border: none;
        padding: var(--space-xs, var(--aimd-space-1));
        cursor: pointer;
        color: var(--aimd-dialog-muted-text);
        border-radius: var(--radius-sm, var(--aimd-radius-sm));
        display: flex;
        align-items: center;
        justify-content: center;
    }

    .save-messages-close-btn:hover {
        background: var(--aimd-dialog-hover-bg);
        color: var(--aimd-dialog-title);
    }

    /* Body */
    .save-messages-body {
        padding: var(--space-md, var(--aimd-space-4));
        overflow-y: auto;
        flex: 1;
    }

    .save-messages-section {
        margin-bottom: var(--space-md, var(--aimd-space-4));
    }

    .save-messages-section:last-child {
        margin-bottom: 0;
    }

    .save-messages-label {
        display: block;
        font-size: var(--font-size-sm, var(--aimd-text-sm));
        font-weight: 500;
        color: var(--aimd-dialog-muted-text);
        margin-bottom: var(--space-sm, var(--aimd-space-2));
    }

    /* Message Selector Section */
    .message-selector {
        /* No overflow restriction - tooltip needs to be visible */
    }

    /* Message Selector Grid */
    .message-grid {
        display: flex;
        flex-wrap: wrap;
        gap: var(--space-xs, var(--aimd-space-1));
    }

    .message-btn {
        min-width: 36px;
        min-height: var(--aimd-dialog-button-height);
        padding: var(--space-xs, var(--aimd-space-1)) var(--space-sm, var(--aimd-space-2));
        border: 1px solid var(--aimd-dialog-border);
        border-radius: var(--radius-sm, var(--aimd-radius-sm));
        background: var(--aimd-dialog-bg);
        color: var(--aimd-dialog-text);
        font-size: var(--font-size-sm, var(--aimd-text-sm));
        cursor: pointer;
        transition: all 0.15s ease;
        position: relative;
    }

    .message-btn:hover {
        border-color: var(--aimd-dialog-primary-bg);
        background: var(--aimd-dialog-selected-bg);
    }

    .message-btn.selected {
        background: var(--aimd-dialog-primary-bg);
        border-color: var(--aimd-dialog-primary-bg);
        color: var(--aimd-dialog-primary-text);
    }

    .message-btn.selected:hover {
        background: var(--aimd-dialog-primary-hover-bg);
        border-color: var(--aimd-dialog-primary-hover-bg);
    }

    /* Hover Tooltip - Portal pattern (rendered at dialog root) */
    .message-tooltip {
        /* Position set via JS (portal pattern) */
        position: absolute;
        
        background: var(--aimd-tooltip-bg);
        backdrop-filter: blur(8px);
        -webkit-backdrop-filter: blur(8px);
        color: var(--aimd-tooltip-text);
        border-radius: var(--aimd-radius-lg);
        padding: var(--aimd-space-2) var(--aimd-space-3);
        box-shadow: var(--aimd-tooltip-shadow);
        border: 1px solid var(--aimd-tooltip-border);
        
        display: flex;
        flex-direction: column;
        gap: var(--aimd-space-1);
        width: max-content;
        max-width: 260px;
        text-align: center;
        pointer-events: none;
        z-index: var(--aimd-z-tooltip);
        
        /* Hidden by default - same animation as reader tooltip */
        opacity: 0;
        visibility: hidden;
        transform: translateX(-50%) translateY(4px);
        will-change: opacity, transform;
        transition: opacity 0.1s ease, transform 0.1s ease, visibility 0.1s ease;
    }

    .message-tooltip.visible {
        opacity: 1;
        visibility: visible;
        transform: translateX(-50%) translateY(0);
    }

    /* Arrow indicator */
    .message-tooltip::after {
        content: '';
        position: absolute;
        bottom: -6px;
        left: 50%;
        transform: translateX(-50%);
        width: 0;
        height: 0;
        border-left: 6px solid transparent;
        border-right: 6px solid transparent;
        border-top: 6px solid var(--aimd-tooltip-bg);
    }

    .tooltip-index {
        font-weight: 800;
        font-size: 18px;
        color: var(--aimd-interactive-primary);
        letter-spacing: 0.5px;
        text-transform: uppercase;
    }

    .tooltip-prompt {
        font-size: var(--aimd-text-sm);
        color: var(--aimd-tooltip-prompt-color);
        white-space: normal;
        line-height: 1.4;
        word-break: break-word;
    }

    /* Format Selection - Segmented Button Control */
    .format-buttons {
        display: flex;
        gap: 0;
        border: 1px solid var(--aimd-dialog-border);
        border-radius: var(--aimd-radius-md);
        overflow: hidden;
    }

    .format-btn {
        flex: 1;
        min-height: var(--aimd-dialog-button-height);
        display: flex;
        align-items: center;
        justify-content: center;
        gap: var(--aimd-space-2);
        padding: var(--aimd-space-2) var(--aimd-space-4);
        background: var(--aimd-dialog-bg);
        border: none;
        border-right: 1px solid var(--aimd-dialog-border);
        color: var(--aimd-dialog-muted-text);
        font-size: var(--aimd-text-sm);
        font-weight: 500;
        cursor: pointer;
        transition: all 0.15s ease;
    }

    .format-btn:last-child {
        border-right: none;
    }

    .format-btn:hover {
        background: var(--aimd-dialog-hover-bg);
        color: var(--aimd-dialog-title);
    }

    .format-btn.active {
        background: var(--aimd-dialog-primary-bg);
        color: var(--aimd-dialog-primary-text);
    }

    .format-btn.active:hover {
        background: var(--aimd-dialog-primary-hover-bg);
    }

    .format-btn svg {
        flex-shrink: 0;
    }

    /* Footer */
    .save-messages-footer {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: var(--space-md, var(--aimd-space-4));
        border-top: 1px solid var(--aimd-dialog-border);
        gap: var(--space-sm, var(--aimd-space-2));
    }

    .save-messages-actions-left {
        display: flex;
        gap: var(--space-sm, var(--aimd-space-2));
    }

    .save-messages-btn {
        min-height: var(--aimd-dialog-button-height);
        padding: var(--space-sm, var(--aimd-space-2)) var(--space-md, var(--aimd-space-4));
        border-radius: var(--radius-sm, var(--aimd-radius-sm));
        font-size: var(--font-size-sm, var(--aimd-text-sm));
        cursor: pointer;
        transition: all 0.15s ease;
    }

    .save-messages-close-btn:focus-visible,
    .message-btn:focus-visible,
    .format-btn:focus-visible,
    .save-messages-btn:focus-visible {
        outline: 2px solid var(--aimd-dialog-focus);
        outline-offset: 2px;
    }

    .save-messages-btn-secondary {
        background: transparent;
        border: 1px solid var(--aimd-dialog-border);
        color: var(--aimd-dialog-text);
    }

    .save-messages-btn-secondary:hover {
        background: var(--aimd-dialog-hover-bg);
        border-color: var(--aimd-dialog-border-strong);
    }

    .save-messages-btn-primary {
        background: var(--aimd-dialog-primary-bg);
        border: 1px solid var(--aimd-dialog-primary-bg);
        color: var(--aimd-dialog-primary-text);
    }

    .save-messages-btn-primary:hover {
        background: var(--aimd-dialog-primary-hover-bg);
        border-color: var(--aimd-dialog-primary-hover-bg);
    }

    .save-messages-btn-primary:disabled {
        background: var(--aimd-dialog-disabled-bg);
        border-color: var(--aimd-dialog-disabled-bg);
        cursor: not-allowed;
    }

    /* Selection Count */
    .selection-count {
        font-size: var(--font-size-sm, var(--aimd-text-sm));
        color: var(--aimd-dialog-muted-text);
    }
`;
