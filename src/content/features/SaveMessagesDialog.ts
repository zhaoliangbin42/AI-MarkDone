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
import { i18n } from '../../utils/i18n';
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
        const title = document.createElement('h2');
        title.className = 'save-messages-title';
        title.textContent = i18n.t('saveMessagesTitle');
        header.appendChild(title);

        const closeBtn = document.createElement('button');
        closeBtn.className = 'save-messages-close-btn';
        closeBtn.appendChild(this.createCloseIcon());
        closeBtn.addEventListener('click', () => this.close());
        header.appendChild(closeBtn);

        // Body
        const body = document.createElement('div');
        body.className = 'save-messages-body';

        // Message selector section
        const selectorSection = document.createElement('div');
        selectorSection.className = 'save-messages-section';
        const selectorLabel = document.createElement('label');
        selectorLabel.className = 'save-messages-label';
        selectorLabel.textContent = i18n.t('selectMessagesLabel');
        selectorSection.appendChild(selectorLabel);

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
        const formatLabel = document.createElement('label');
        formatLabel.className = 'save-messages-label';
        formatLabel.textContent = i18n.t('formatLabel');

        const formatButtons = document.createElement('div');
        formatButtons.className = 'format-buttons';
        const markdownBtn = this.createFormatButton('markdown', true);
        const pdfBtn = this.createFormatButton('pdf', false);
        formatButtons.append(markdownBtn, pdfBtn);
        formatSection.append(formatLabel, formatButtons);

        // Listen for format button clicks
        [markdownBtn, pdfBtn].forEach((btn) => {
            btn.addEventListener('click', () => {
                // Update active state
                [markdownBtn, pdfBtn].forEach(b => b.classList.remove('active'));
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

    private createFormatButton(format: SaveFormat, active: boolean): HTMLButtonElement {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = `format-btn${active ? ' active' : ''}`;
        btn.dataset.format = format;
        btn.appendChild(format === 'markdown' ? this.createMarkdownFormatIcon() : this.createPdfFormatIcon());
        btn.appendChild(document.createTextNode(format === 'markdown' ? 'Markdown' : 'PDF'));
        return btn;
    }

    private createMarkdownFormatIcon(): SVGSVGElement {
        const ns = 'http://www.w3.org/2000/svg';
        const svg = document.createElementNS(ns, 'svg');
        svg.setAttribute('width', '16');
        svg.setAttribute('height', '16');
        svg.setAttribute('viewBox', '0 0 24 24');
        svg.setAttribute('fill', 'none');
        svg.setAttribute('stroke', 'currentColor');
        svg.setAttribute('stroke-width', '2');

        const path = document.createElementNS(ns, 'path');
        path.setAttribute('d', 'M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z');
        const polyline = document.createElementNS(ns, 'polyline');
        polyline.setAttribute('points', '14,2 14,8 20,8');
        const line1 = document.createElementNS(ns, 'line');
        line1.setAttribute('x1', '16');
        line1.setAttribute('y1', '13');
        line1.setAttribute('x2', '8');
        line1.setAttribute('y2', '13');
        const line2 = document.createElementNS(ns, 'line');
        line2.setAttribute('x1', '16');
        line2.setAttribute('y1', '17');
        line2.setAttribute('x2', '8');
        line2.setAttribute('y2', '17');
        svg.append(path, polyline, line1, line2);
        return svg;
    }

    private createPdfFormatIcon(): SVGSVGElement {
        const ns = 'http://www.w3.org/2000/svg';
        const svg = document.createElementNS(ns, 'svg');
        svg.setAttribute('width', '16');
        svg.setAttribute('height', '16');
        svg.setAttribute('viewBox', '0 0 24 24');
        svg.setAttribute('fill', 'none');
        svg.setAttribute('stroke', 'currentColor');
        svg.setAttribute('stroke-width', '2');

        const path1 = document.createElementNS(ns, 'path');
        path1.setAttribute('d', 'M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z');
        const polyline = document.createElementNS(ns, 'polyline');
        polyline.setAttribute('points', '14,2 14,8 20,8');
        const path2 = document.createElementNS(ns, 'path');
        path2.setAttribute('d', 'M9 15h2v2H9zM13 13h2v4h-2z');
        svg.append(path1, polyline, path2);
        return svg;
    }

    private createCloseIcon(): SVGSVGElement {
        const ns = 'http://www.w3.org/2000/svg';
        const svg = document.createElementNS(ns, 'svg');
        svg.setAttribute('width', '16');
        svg.setAttribute('height', '16');
        svg.setAttribute('viewBox', '0 0 24 24');
        svg.setAttribute('fill', 'none');
        svg.setAttribute('stroke', 'currentColor');
        svg.setAttribute('stroke-width', '2');
        svg.setAttribute('stroke-linecap', 'round');
        svg.setAttribute('stroke-linejoin', 'round');

        const line1 = document.createElementNS(ns, 'line');
        line1.setAttribute('x1', '18');
        line1.setAttribute('y1', '6');
        line1.setAttribute('x2', '6');
        line1.setAttribute('y2', '18');

        const line2 = document.createElementNS(ns, 'line');
        line2.setAttribute('x1', '6');
        line2.setAttribute('y1', '6');
        line2.setAttribute('x2', '18');
        line2.setAttribute('y2', '18');

        svg.append(line1, line2);
        return svg;
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
        selectAllBtn.textContent = i18n.t('selectAll');
        selectAllBtn.addEventListener('click', () => this.selectAll());

        const deselectAllBtn = document.createElement('button');
        deselectAllBtn.className = 'save-messages-btn save-messages-btn-secondary';
        deselectAllBtn.textContent = i18n.t('deselectAll');
        deselectAllBtn.addEventListener('click', () => this.deselectAll());

        actionsLeft.appendChild(selectAllBtn);
        actionsLeft.appendChild(deselectAllBtn);

        // Right: Count + Save button
        const count = document.createElement('span');
        count.className = 'selection-count';
        count.id = 'selection-count';
        count.textContent = i18n.t('selectedCountMessages', [`${this.selectedIndices.size}`, `${this.turns.length}`]);

        const saveBtn = document.createElement('button');
        saveBtn.className = 'save-messages-btn save-messages-btn-primary';
        saveBtn.id = 'save-messages-btn';
        saveBtn.textContent = i18n.t('btnSave');
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
            saveBtn.textContent = i18n.t('saving');
            saveBtn.disabled = true;
        }

        try {
            const indices = Array.from(this.selectedIndices).sort((a, b) => a - b);
            await this.onSaveMessages(indices, this.format);
            this.close();
        } catch (error) {
            logger.error('[AI-MarkDone][SaveMessagesDialog] Save failed:', error);
            if (saveBtn) {
                saveBtn.textContent = i18n.t('btnSave');
                saveBtn.disabled = false;
            }
        }
    }
}

// Singleton instance
export const saveMessagesDialog = new SaveMessagesDialog();
