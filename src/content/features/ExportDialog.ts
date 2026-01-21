/**
 * Export Dialog Component
 * 
 * Message selection dialog with format choice (Markdown/PDF).
 * Uses Shadow DOM for style isolation.
 * Generic logic - works with any adapter.
 */

import { logger } from '../../utils/logger';
import { DesignTokens } from '../../utils/design-tokens';
import { ThemeManager } from '../../utils/ThemeManager';
import { exportDialogStyles } from './export-dialog.css';
import type { ChatTurn, ConversationMetadata, ExportFormat } from './export';

/**
 * Callback type for export action
 */
export type OnExportCallback = (
    selectedIndices: number[],
    format: ExportFormat
) => Promise<void>;

/**
 * Export Dialog Component
 */
export class ExportDialog {
    private host: HTMLElement | null = null;
    private shadowRoot: ShadowRoot | null = null;
    private selectedIndices: Set<number> = new Set();
    private format: ExportFormat = 'markdown';
    private turns: ChatTurn[] = [];
    private metadata: ConversationMetadata | null = null;
    private onExport: OnExportCallback | null = null;
    private tooltipTimeout: number | null = null;

    /**
     * Open the export dialog
     */
    open(
        turns: ChatTurn[],
        metadata: ConversationMetadata,
        onExport: OnExportCallback
    ): void {
        if (this.host) {
            this.close();
        }

        this.turns = turns;
        this.metadata = metadata;
        this.onExport = onExport;

        // Select all messages by default
        this.selectedIndices = new Set(turns.map((_, i) => i));
        this.format = 'markdown';

        // Create host element
        this.host = document.createElement('div');
        this.host.id = 'aimd-export-dialog';
        this.shadowRoot = this.host.attachShadow({ mode: 'open' });

        // Inject styles
        this.injectStyles();

        // Render UI
        this.render();

        // Append to body
        document.body.appendChild(this.host);

        logger.info('[ExportDialog] Opened with', turns.length, 'messages');
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
        this.onExport = null;
        this.selectedIndices.clear();

        logger.debug('[ExportDialog] Closed');
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
        componentStyle.textContent = exportDialogStyles;
        this.shadowRoot.appendChild(componentStyle);
    }

    /**
     * Render dialog UI
     */
    private render(): void {
        if (!this.shadowRoot || !this.metadata) return;

        const container = document.createElement('div');
        container.className = 'export-overlay';
        container.addEventListener('click', (e) => {
            if (e.target === container) {
                this.close();
            }
        });

        const dialog = document.createElement('div');
        dialog.className = 'export-dialog';

        // Header
        const header = document.createElement('div');
        header.className = 'export-header';
        header.innerHTML = `
            <h2 class="export-title">Export Conversation</h2>
        `;

        const closeBtn = document.createElement('button');
        closeBtn.className = 'export-close-btn';
        closeBtn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`;
        closeBtn.addEventListener('click', () => this.close());
        header.appendChild(closeBtn);

        // Body
        const body = document.createElement('div');
        body.className = 'export-body';

        // Message selector section
        const selectorSection = document.createElement('div');
        selectorSection.className = 'export-section';
        selectorSection.innerHTML = `
            <label class="export-label">Select messages to export:</label>
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
        formatSection.className = 'export-section';
        formatSection.innerHTML = `
            <label class="export-label">Format:</label>
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
                this.format = (btn as HTMLElement).dataset.format as ExportFormat;
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
            const overlay = this.shadowRoot?.querySelector('.export-overlay') as HTMLElement;
            if (!overlay) return;

            // Create tooltip element
            const tooltip = document.createElement('div');
            tooltip.className = 'message-tooltip';
            tooltip.id = 'export-tooltip';

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
        const tooltip = this.shadowRoot?.querySelector('#export-tooltip');
        if (tooltip) {
            tooltip.remove();
        }
    }

    /**
     * Render footer with action buttons
     */
    private renderFooter(): HTMLElement {
        const footer = document.createElement('div');
        footer.className = 'export-footer';
        footer.id = 'export-footer';

        // Left: Select All / Deselect All
        const actionsLeft = document.createElement('div');
        actionsLeft.className = 'export-actions-left';

        const selectAllBtn = document.createElement('button');
        selectAllBtn.className = 'export-btn export-btn-secondary';
        selectAllBtn.textContent = 'Select All';
        selectAllBtn.addEventListener('click', () => this.selectAll());

        const deselectAllBtn = document.createElement('button');
        deselectAllBtn.className = 'export-btn export-btn-secondary';
        deselectAllBtn.textContent = 'Deselect All';
        deselectAllBtn.addEventListener('click', () => this.deselectAll());

        actionsLeft.appendChild(selectAllBtn);
        actionsLeft.appendChild(deselectAllBtn);

        // Right: Count + Export button
        const count = document.createElement('span');
        count.className = 'selection-count';
        count.id = 'selection-count';
        count.textContent = `${this.selectedIndices.size} / ${this.turns.length} selected`;

        const exportBtn = document.createElement('button');
        exportBtn.className = 'export-btn export-btn-primary';
        exportBtn.id = 'export-btn';
        exportBtn.textContent = 'Export';
        exportBtn.disabled = this.selectedIndices.size === 0;
        exportBtn.addEventListener('click', () => this.handleExport());

        footer.appendChild(actionsLeft);
        footer.appendChild(count);
        footer.appendChild(exportBtn);

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

        const exportBtn = this.shadowRoot.querySelector('#export-btn') as HTMLButtonElement;
        if (exportBtn) {
            exportBtn.disabled = this.selectedIndices.size === 0;
        }
    }

    /**
     * Handle export button click
     */
    private async handleExport(): Promise<void> {
        if (!this.onExport || this.selectedIndices.size === 0) return;

        const exportBtn = this.shadowRoot?.querySelector('#export-btn') as HTMLButtonElement;
        if (exportBtn) {
            exportBtn.textContent = 'Exporting...';
            exportBtn.disabled = true;
        }

        try {
            const indices = Array.from(this.selectedIndices).sort((a, b) => a - b);
            await this.onExport(indices, this.format);
            this.close();
        } catch (error) {
            logger.error('[ExportDialog] Export failed:', error);
            if (exportBtn) {
                exportBtn.textContent = 'Export';
                exportBtn.disabled = false;
            }
        }
    }
}

// Singleton instance
export const exportDialog = new ExportDialog();
