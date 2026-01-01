import { MarkdownParser } from '../parsers/markdown-parser';
import { ReaderPanel } from './re-render';
import { TooltipHelper } from '../utils/tooltip-helper';
import { copyToClipboard } from '../../utils/dom-utils';
import { logger } from '../../utils/logger';

/**
 * Deep Research Panel Handler
 * Detects and adds copy/preview buttons to Gemini Deep Research panels
 */
export class DeepResearchHandler {
    private observer: MutationObserver | null = null;
    private activePanel: HTMLElement | null = null;
    private parser: MarkdownParser;
    private reRenderPanel: ReaderPanel;

    constructor() {
        this.parser = new MarkdownParser();
        this.reRenderPanel = new ReaderPanel();
    }

    /**
     * Enable Deep Research panel detection
     */
    enable(): void {
        logger.info('[DeepResearch] Enabling Deep Research handler');

        // Watch for deep research panel
        this.observer = new MutationObserver(() => {
            this.checkForPanel();
        });

        this.observer.observe(document.body, {
            childList: true,
            subtree: true
        });

        // Check immediately
        this.checkForPanel();
    }

    /**
     * Disable and cleanup
     */
    disable(): void {
        if (this.observer) {
            this.observer.disconnect();
            this.observer = null;
        }
        this.activePanel = null;
    }

    /**
     * Check if Deep Research panel exists
     */
    private checkForPanel(): void {
        const panel = document.querySelector('deep-research-immersive-panel');

        if (panel && !this.activePanel) {
            logger.info('[DeepResearch] Panel detected, injecting toolbar');
            this.injectToolbar(panel as HTMLElement);
            this.activePanel = panel as HTMLElement;
        } else if (!panel && this.activePanel) {
            logger.info('[DeepResearch] Panel closed');
            this.activePanel = null;
        }
    }

    /**
     * Inject copy/preview buttons into panel toolbar
     */
    private injectToolbar(panel: HTMLElement): void {
        const actionButtons = panel.querySelector('toolbar .action-buttons');
        if (!actionButtons) {
            logger.warn('[DeepResearch] Action buttons container not found');
            return;
        }

        // Check if already injected
        if (actionButtons.querySelector('.aicopy-dr-button')) {
            logger.debug('[DeepResearch] Buttons already injected');
            return;
        }

        // Create copy button - using content_copy icon
        const copyBtn = this.createButton('Copy Markdown', 'content_copy', () => {
            this.handleCopy(panel);
        });

        // Create preview button - using travel_explore icon
        const previewBtn = this.createButton('Preview Enhance', 'travel_explore', () => {
            this.handlePreview(panel);
        });

        // Insert at the beginning of action buttons (right-aligned, before first button)
        const firstButton = actionButtons.firstElementChild;
        if (firstButton) {
            // Insert in order: [Copy][Preview] before existing buttons
            actionButtons.insertBefore(previewBtn, firstButton);
            actionButtons.insertBefore(copyBtn, firstButton);
        } else {
            actionButtons.appendChild(copyBtn);
            actionButtons.appendChild(previewBtn);
        }

        logger.info('[DeepResearch] Toolbar buttons injected');
    }

    /**
     * Create a button matching Gemini's icon-button style
     */
    private createButton(tooltip: string, icon: string, onClick: () => void): HTMLElement {
        const button = document.createElement('button');
        // Use icon-button class like Gemini's native buttons
        button.className = 'mdc-icon-button mat-mdc-icon-button mat-mdc-button-base mat-mdc-tooltip-trigger aicopy-dr-button';
        button.setAttribute('type', 'button');
        button.setAttribute('aria-label', tooltip);

        // Attach custom tooltip
        TooltipHelper.attach(button, tooltip);

        // Add hover effect with purple color
        button.style.cssText = `
            width: 40px;
            height: 40px;
            padding: 8px;
            flex-shrink: 0;
        `;

        // Create mat-icon element with correct Gemini sizing
        const matIcon = document.createElement('mat-icon');
        // Don't include 'mat-icon' in className - it's added automatically by the element tag
        // Use gds-icon-m (medium) to match Gemini's Deep Research buttons
        matIcon.className = 'notranslate gds-icon-m google-symbols mat-ligature-font mat-icon-no-color';
        matIcon.setAttribute('role', 'img');
        matIcon.setAttribute('aria-hidden', 'true');
        matIcon.setAttribute('data-mat-icon-type', 'font');
        matIcon.setAttribute('data-mat-icon-name', icon);
        matIcon.setAttribute('fonticon', icon);
        matIcon.textContent = icon; // Set icon name as text content

        // Create ripple span
        const ripple = document.createElement('span');
        ripple.className = 'mat-mdc-button-persistent-ripple mdc-icon-button__ripple';

        // Create touch target
        const touchTarget = document.createElement('span');
        touchTarget.className = 'mat-mdc-button-touch-target';

        // Assemble button
        button.appendChild(ripple);
        button.appendChild(matIcon);
        button.appendChild(touchTarget);

        button.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            onClick();
        });

        return button;
    }

    /**
     * Handle copy button click
     */
    private async handleCopy(panel: HTMLElement): Promise<void> {
        const content = panel.querySelector('#extended-response-markdown-content');
        if (!content) {
            logger.warn('[DeepResearch] Content element not found');
            return;
        }

        try {
            const markdown = this.parser.parse(content as HTMLElement);
            const success = await copyToClipboard(markdown);

            if (success) {
                logger.info('[DeepResearch] Content copied to clipboard');
                this.showFeedback('已复制!');
            } else {
                logger.error('[DeepResearch] Failed to copy to clipboard');
                this.showFeedback('复制失败', true);
            }
        } catch (error) {
            logger.error('[DeepResearch] Error during copy:', error);
            this.showFeedback('复制失败', true);
        }
    }

    /**
     * Handle preview button click
     */
    private handlePreview(panel: HTMLElement): void {
        const content = panel.querySelector('#extended-response-markdown-content');
        if (!content) {
            logger.warn('[DeepResearch] Content element not found');
            return;
        }

        try {
            // ✅ 传入getMarkdown方法 (复用parser逻辑)
            this.reRenderPanel.show(
                content as HTMLElement,
                (el: HTMLElement) => this.parser.parse(el)
            );
            logger.info('[DeepResearch] Preview panel opened');
        } catch (error) {
            logger.error('[DeepResearch] Error during preview:', error);
        }
    }

    /**
     * Show feedback message
     */
    private showFeedback(message: string, isError: boolean = false): void {
        const feedback = document.createElement('div');
        feedback.textContent = message;
        feedback.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: ${isError ? '#ef4444' : '#8b5cf6'};
            color: white;
            padding: 12px 24px;
            border-radius: 8px;
            font-size: 14px;
            font-weight: 500;
            z-index: 999999;
            animation: fadeInOut 2s forwards;
        `;

        // Add animation
        const style = document.createElement('style');
        style.textContent = `
            @keyframes fadeInOut {
                0% { opacity: 0; transform: translateY(-10px); }
                10% { opacity: 1; transform: translateY(0); }
                90% { opacity: 1; transform: translateY(0); }
                100% { opacity: 0; transform: translateY(-10px); }
            }
        `;
        document.head.appendChild(style);

        document.body.appendChild(feedback);

        setTimeout(() => {
            feedback.remove();
            style.remove();
        }, 2000);
    }
}
