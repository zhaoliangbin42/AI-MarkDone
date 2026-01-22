/**
 * Save Messages Dialog Component
 * 
 * Message selection dialog with format choice (Markdown/PDF).
 * Uses Shadow DOM for style isolation.
 * Generic logic - works with any adapter.
 */

import { logger } from '../../utils/logger';
import { DesignTokens } from '../../utils/design-tokens';
import { ThemeManager } from '../../utils/ThemeManager';
import { saveMessagesDialogStyles } from './save-messages-dialog.css';
import type { ChatTurn, ConversationMetadata, SaveFormat } from './save-messages';

/**
 * Callback type for save messages action
 */
export type OnSaveMessagesCallback = (
    selectedIndices: number[],
    format: SaveFormat
) => Promise<void>;

/**
 * Save Messages Dialog Component
 */
export class SaveMessagesDialog {
    private host: HTMLElement | null = null;
    private shadowRoot: ShadowRoot | null = null;
    private selectedIndices: Set<number> = new Set();
    private format: SaveFormat = 'markdown';
    private turns: ChatTurn[] = [];
    private metadata: ConversationMetadata | null = null;
    private onSaveMessages: OnSaveMessagesCallback | null = null;
    private tooltipTimeout: number | null = null;

    /**
     * Open the save messages dialog
     */
    open(
        turns: ChatTurn[],
        metadata: ConversationMetadata,
        onSaveMessages: OnSaveMessagesCallback
    ): void {
        if (this.host) {
            this.close();
        }

        this.turns = turns;
        this.metadata = metadata;
        this.onSaveMessages = onSaveMessages;

        // Select all messages by default
        this.selectedIndices = new Set(turns.map((_, i) => i));
        this.format = 'markdown';

        // Create host element
        this.host = document.createElement('div');
        this.host.id = 'aimd-save-messages-dialog';
        this.shadowRoot = this.host.attachShadow({ mode: 'open' });

        // Inject styles
        this.injectStyles();

        // Render UI
        this.render();

        // Append to body
        document.body.appendChild(this.host);

        logger.info('[AI-MarkDone][SaveMessagesDialog] Opened with', turns.length, 'messages');
    }

    /**
     * Close the dialog
     */
    close(): void {
        if (this.tooltipTimeout) {
            clearTimeout(this.tooltipTimeout);
            this.tooltipTimeout = null;
        }

        if (this.host) {
            this.host.remove();
            this.host = null;
            this.shadowRoot = null;
        }

        this.turns = [];
        this.metadata = null;
        this.onSaveMessages = null;
        this.selectedIndices.clear();

        logger.debug('[AI-MarkDone][SaveMessagesDialog] Closed');
    }

    /**
     * Inject styles into Shadow DOM
     */
    private injectStyles(): void {
        if (!this.shadowRoot) return;

        // Design tokens
        const tokenStyle = document.createElement('style');
        const isDark = ThemeManager.getInstance().isDarkMode();
        tokenStyle.textContent = `:host { ${DesignTokens.getCompleteTokens(isDark)} }`;
        this.shadowRoot.appendChild(tokenStyle);

        // Component styles
        const componentStyle = document.createElement('style');
        componentStyle.textContent = saveMessagesDialogStyles;
        this.shadowRoot.appendChild(componentStyle);
    }

    /**
     * Render dialog UI
     */
    private render(): void {
        if (!this.shadowRoot || !this.metadata) return;

        const container = document.createElement('div');
        container.className = 'save-messages-overlay';
        container.addEventListener('click', (e) => {
            if (e.target === container) {
                this.close();
            }
        });

        const dialog = document.createElement('div');
        dialog.className = 'save-messages-dialog';

        // Header
        const header = document.createElement('div');
        header.className = 'save-messages-header';
        header.innerHTML = `
            <h2 class="save-messages-title">Save Messages As</h2>
        `;

        const closeBtn = document.createElement('button');
        closeBtn.className = 'save-messages-close-btn';
        closeBtn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`;
        closeBtn.addEventListener('click', () => this.close());
        header.appendChild(closeBtn);

        // Body
        const body = document.createElement('div');
        body.className = 'save-messages-body';

        // Message selector section
        const selectorSection = document.createElement('div');
        selectorSection.className = 'save-messages-section';
        selectorSection.innerHTML = `
            <label class="save-messages-label">Select messages to save:</label>
        `;

        // Scroll container with padding for tooltips
        const scrollContainer = document.createElement('div');
        scrollContainer.className = 'message-selector';

        const grid = this.renderMessageGrid();
        scrollContainer.appendChild(grid);
        selectorSection.appendChild(scrollContainer);
        body.appendChild(selectorSection);

        // Format section
        const formatSection = document.createElement('div');
        formatSection.className = 'save-messages-section';
        formatSection.innerHTML = `
            <label class="save-messages-label">Format:</label>
            <div class="format-buttons">
                <button type="button" class="format-btn active" data-format="markdown">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/>
                        <polyline points="14,2 14,8 20,8"/>
                        <line x1="16" y1="13" x2="8" y2="13"/>
                        <line x1="16" y1="17" x2="8" y2="17"/>
                    </svg>
                    Markdown
                </button>
                <button type="button" class="format-btn" data-format="pdf">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/>
                        <polyline points="14,2 14,8 20,8"/>
                        <path d="M9 15h2v2H9zM13 13h2v4h-2z"/>
                    </svg>
                    PDF
                </button>
            </div>
        `;

        // Listen for format button clicks
        formatSection.querySelectorAll('.format-btn').forEach((btn) => {
            btn.addEventListener('click', () => {
                // Update active state
                formatSection.querySelectorAll('.format-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                // Update format
                this.format = (btn as HTMLElement).dataset.format as SaveFormat;
            });
        });

        body.appendChild(formatSection);

        // Footer
        const footer = this.renderFooter();

        dialog.appendChild(header);
        dialog.appendChild(body);
        dialog.appendChild(footer);
        container.appendChild(dialog);

        this.shadowRoot.appendChild(container);
    }

    /**
     * Render message selector grid
     */
    private renderMessageGrid(): HTMLElement {
        const grid = document.createElement('div');
        grid.className = 'message-grid';

        this.turns.forEach((turn, index) => {
            const btn = document.createElement('button');
            btn.className = 'message-btn';
            if (this.selectedIndices.has(index)) {
                btn.classList.add('selected');
            }
            btn.textContent = String(index + 1);
            btn.dataset.index = String(index);

            // Click to toggle
            btn.addEventListener('click', () => {
                this.toggleSelection(index);
                btn.classList.toggle('selected', this.selectedIndices.has(index));
                this.updateFooter();
            });

            // Hover to show tooltip
            btn.addEventListener('mouseenter', () => {
                this.showTooltip(btn, turn.user);
            });

            btn.addEventListener('mouseleave', () => {
                this.hideTooltip();
            });

            grid.appendChild(btn);
        });

        return grid;
    }

    /**
     * Toggle message selection
     */
    private toggleSelection(index: number): void {
        if (this.selectedIndices.has(index)) {
            this.selectedIndices.delete(index);
        } else {
            this.selectedIndices.add(index);
        }
    }

    /**
     * Show tooltip with user prompt preview
     * Portal pattern with correct positioning:
     * - Render to dialog root (escapes body overflow)
     * - Use bottom positioning to place above button
     */
    private showTooltip(btn: HTMLElement, userPrompt: string): void {
        if (this.tooltipTimeout) {
            clearTimeout(this.tooltipTimeout);
        }

        this.tooltipTimeout = window.setTimeout(() => {
            // Remove any existing tooltip
            this.hideTooltipElement();

            // Use overlay as container (no overflow restriction, unlike dialog)
            const overlay = this.shadowRoot?.querySelector('.save-messages-overlay') as HTMLElement;
            if (!overlay) return;

            // Create tooltip element
            const tooltip = document.createElement('div');
            tooltip.className = 'message-tooltip';
            tooltip.id = 'save-messages-tooltip';

            // Show truncated text only (no index, since user is hovering on the button)
            const maxLen = 100;
            const text = userPrompt.length > maxLen
                ? userPrompt.slice(0, maxLen - 3) + '...'
                : userPrompt;

            tooltip.textContent = text;

            // Append to OVERLAY (escapes dialog's overflow:hidden)
            overlay.appendChild(tooltip);

            // Calculate position relative to overlay (which is full screen)
            const btnRect = btn.getBoundingClientRect();
            const overlayRect = overlay.getBoundingClientRect();

            // Center horizontally above button
            const left = btnRect.left - overlayRect.left + btnRect.width / 2;
            // Position above button
            const top = btnRect.top - overlayRect.top;

            tooltip.style.position = 'absolute';
            tooltip.style.left = `${left}px`;
            tooltip.style.top = `${top}px`;
            tooltip.style.transform = 'translateX(-50%) translateY(-100%)';

            // Show with animation
            requestAnimationFrame(() => {
                tooltip.classList.add('visible');
            });
        }, 150);
    }


    /**
     * Hide tooltip
     */
    private hideTooltip(): void {
        if (this.tooltipTimeout) {
            clearTimeout(this.tooltipTimeout);
            this.tooltipTimeout = null;
        }
        this.hideTooltipElement();
    }

    /**
     * Remove tooltip element from DOM
     */
    private hideTooltipElement(): void {
        const tooltip = this.shadowRoot?.querySelector('#save-messages-tooltip');
        if (tooltip) {
            tooltip.remove();
        }
    }

    /**
     * Render footer with action buttons
     */
    private renderFooter(): HTMLElement {
        const footer = document.createElement('div');
        footer.className = 'save-messages-footer';
        footer.id = 'save-messages-footer';

        // Left: Select All / Deselect All
        const actionsLeft = document.createElement('div');
        actionsLeft.className = 'save-messages-actions-left';

        const selectAllBtn = document.createElement('button');
        selectAllBtn.className = 'save-messages-btn save-messages-btn-secondary';
        selectAllBtn.textContent = 'Select All';
        selectAllBtn.addEventListener('click', () => this.selectAll());

        const deselectAllBtn = document.createElement('button');
        deselectAllBtn.className = 'save-messages-btn save-messages-btn-secondary';
        deselectAllBtn.textContent = 'Deselect All';
        deselectAllBtn.addEventListener('click', () => this.deselectAll());

        actionsLeft.appendChild(selectAllBtn);
        actionsLeft.appendChild(deselectAllBtn);

        // Right: Count + Save button
        const count = document.createElement('span');
        count.className = 'selection-count';
        count.id = 'selection-count';
        count.textContent = `${this.selectedIndices.size} / ${this.turns.length} selected`;

        const saveBtn = document.createElement('button');
        saveBtn.className = 'save-messages-btn save-messages-btn-primary';
        saveBtn.id = 'save-messages-btn';
        saveBtn.textContent = 'Save';
        saveBtn.disabled = this.selectedIndices.size === 0;
        saveBtn.addEventListener('click', () => this.handleSaveMessages());

        footer.appendChild(actionsLeft);
        footer.appendChild(count);
        footer.appendChild(saveBtn);

        return footer;
    }

    /**
     * Select all messages
     */
    private selectAll(): void {
        this.selectedIndices = new Set(this.turns.map((_, i) => i));
        this.updateGridButtons();
        this.updateFooter();
    }

    /**
     * Deselect all messages
     */
    private deselectAll(): void {
        this.selectedIndices.clear();
        this.updateGridButtons();
        this.updateFooter();
    }

    /**
     * Update grid button states
     */
    private updateGridButtons(): void {
        if (!this.shadowRoot) return;

        const buttons = this.shadowRoot.querySelectorAll('.message-btn');
        buttons.forEach((btn) => {
            const index = parseInt((btn as HTMLElement).dataset.index || '0', 10);
            btn.classList.toggle('selected', this.selectedIndices.has(index));
        });
    }

    /**
     * Update footer (count and export button state)
     */
    private updateFooter(): void {
        if (!this.shadowRoot) return;

        const count = this.shadowRoot.querySelector('#selection-count');
        if (count) {
            count.textContent = `${this.selectedIndices.size} / ${this.turns.length} selected`;
        }

        const saveBtn = this.shadowRoot.querySelector('#save-messages-btn') as HTMLButtonElement;
        if (saveBtn) {
            saveBtn.disabled = this.selectedIndices.size === 0;
        }
    }

    /**
     * Handle save messages button click
     */
    private async handleSaveMessages(): Promise<void> {
        if (!this.onSaveMessages || this.selectedIndices.size === 0) return;

        const saveBtn = this.shadowRoot?.querySelector('#save-messages-btn') as HTMLButtonElement;
        if (saveBtn) {
            saveBtn.textContent = 'Saving...';
            saveBtn.disabled = true;
        }

        try {
            const indices = Array.from(this.selectedIndices).sort((a, b) => a - b);
            await this.onSaveMessages(indices, this.format);
            this.close();
        } catch (error) {
            logger.error('[AI-MarkDone][SaveMessagesDialog] Save failed:', error);
            if (saveBtn) {
                saveBtn.textContent = 'Save';
                saveBtn.disabled = false;
            }
        }
    }
}

// Singleton instance
export const saveMessagesDialog = new SaveMessagesDialog();
