/**
 * Export Dialog Styles
 * 
 * Uses design tokens only (no hardcoded values).
 * Supports light/dark mode via semantic tokens.
 */

export const exportDialogStyles = `
    /* Dialog Overlay */
    .export-overlay {
        position: fixed;
        inset: 0;
        background: var(--bg-overlay, rgba(0, 0, 0, 0.5));
        z-index: var(--z-dialog, 9999);
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
    .export-dialog {
        position: relative;  /* Required for tooltip absolute positioning */
        background: var(--bg-surface, #fff);
        border-radius: var(--radius-lg, 12px);
        box-shadow: var(--shadow-xl, 0 20px 40px rgba(0, 0, 0, 0.15));
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
    .export-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: var(--space-md, 16px);
        border-bottom: 1px solid var(--border-default, #e5e7eb);
    }

    .export-title {
        font-size: var(--font-size-lg, 18px);
        font-weight: 600;
        color: var(--text-primary, #111827);
        margin: 0;
    }

    .export-close-btn {
        background: transparent;
        border: none;
        padding: var(--space-xs, 4px);
        cursor: pointer;
        color: var(--text-secondary, #6b7280);
        border-radius: var(--radius-sm, 4px);
        display: flex;
        align-items: center;
        justify-content: center;
    }

    .export-close-btn:hover {
        background: var(--interactive-hover, #f3f4f6);
        color: var(--text-primary, #111827);
    }

    /* Body */
    .export-body {
        padding: var(--space-md, 16px);
        overflow-y: auto;
        flex: 1;
    }

    .export-section {
        margin-bottom: var(--space-md, 16px);
    }

    .export-section:last-child {
        margin-bottom: 0;
    }

    .export-label {
        display: block;
        font-size: var(--font-size-sm, 14px);
        font-weight: 500;
        color: var(--text-secondary, #6b7280);
        margin-bottom: var(--space-sm, 8px);
    }

    /* Message Selector Section */
    .message-selector {
        /* No overflow restriction - tooltip needs to be visible */
    }

    /* Message Selector Grid */
    .message-grid {
        display: flex;
        flex-wrap: wrap;
        gap: var(--space-xs, 4px);
    }

    .message-btn {
        min-width: 36px;
        height: 36px;
        padding: var(--space-xs, 4px) var(--space-sm, 8px);
        border: 1px solid var(--border-default, #e5e7eb);
        border-radius: var(--radius-sm, 4px);
        background: var(--bg-surface, #fff);
        color: var(--text-primary, #111827);
        font-size: var(--font-size-sm, 14px);
        cursor: pointer;
        transition: all 0.15s ease;
        position: relative;
    }

    .message-btn:hover {
        border-color: var(--interactive-primary, #2563eb);
        background: var(--interactive-selected, rgba(37, 99, 235, 0.08));
    }

    .message-btn.selected {
        background: var(--interactive-primary, #2563eb);
        border-color: var(--interactive-primary, #2563eb);
        color: var(--text-on-primary, #fff);
    }

    .message-btn.selected:hover {
        background: var(--interactive-primary-hover, #1d4ed8);
        border-color: var(--interactive-primary-hover, #1d4ed8);
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
        border: 1px solid var(--border-default, #e5e7eb);
        border-radius: var(--aimd-radius-md);
        overflow: hidden;
    }

    .format-btn {
        flex: 1;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: var(--aimd-space-2);
        padding: var(--aimd-space-2) var(--aimd-space-4);
        background: var(--bg-surface, #fff);
        border: none;
        border-right: 1px solid var(--border-default, #e5e7eb);
        color: var(--text-secondary, #6b7280);
        font-size: var(--aimd-text-sm);
        font-weight: 500;
        cursor: pointer;
        transition: all 0.15s ease;
    }

    .format-btn:last-child {
        border-right: none;
    }

    .format-btn:hover {
        background: var(--interactive-hover, #f3f4f6);
        color: var(--text-primary, #111827);
    }

    .format-btn.active {
        background: var(--interactive-primary, #2563eb);
        color: var(--text-on-primary, #fff);
    }

    .format-btn.active:hover {
        background: var(--interactive-primary-hover, #1d4ed8);
    }

    .format-btn svg {
        flex-shrink: 0;
    }

    /* Footer */
    .export-footer {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: var(--space-md, 16px);
        border-top: 1px solid var(--border-default, #e5e7eb);
        gap: var(--space-sm, 8px);
    }

    .export-actions-left {
        display: flex;
        gap: var(--space-sm, 8px);
    }

    .export-btn {
        padding: var(--space-sm, 8px) var(--space-md, 16px);
        border-radius: var(--radius-sm, 4px);
        font-size: var(--font-size-sm, 14px);
        cursor: pointer;
        transition: all 0.15s ease;
    }

    .export-btn-secondary {
        background: transparent;
        border: 1px solid var(--border-default, #e5e7eb);
        color: var(--text-primary, #111827);
    }

    .export-btn-secondary:hover {
        background: var(--interactive-hover, #f3f4f6);
        border-color: var(--border-strong, #d1d5db);
    }

    .export-btn-primary {
        background: var(--interactive-primary, #2563eb);
        border: 1px solid var(--interactive-primary, #2563eb);
        color: var(--text-on-primary, #fff);
    }

    .export-btn-primary:hover {
        background: var(--interactive-primary-hover, #1d4ed8);
        border-color: var(--interactive-primary-hover, #1d4ed8);
    }

    .export-btn-primary:disabled {
        background: var(--interactive-disabled, #d1d5db);
        border-color: var(--interactive-disabled, #d1d5db);
        cursor: not-allowed;
    }

    /* Selection Count */
    .selection-count {
        font-size: var(--font-size-sm, 14px);
        color: var(--text-secondary, #6b7280);
    }
`;
