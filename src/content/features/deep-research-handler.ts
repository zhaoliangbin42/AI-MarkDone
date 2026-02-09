import { MarkdownParser } from '../parsers/markdown-parser';
import { TooltipHelper } from '../utils/tooltip-helper';
import { copyToClipboard } from '../../utils/dom-utils';
import { logger } from '../../utils/logger';
import { ReaderPanel } from './re-render';
import { i18n } from '../../utils/i18n';

/**
 * Deep Research Panel Handler
 * Detects and adds copy/reader buttons to Gemini Deep Research panels
 */
export class DeepResearchHandler {
    private observer: MutationObserver | null = null;
    private activePanel: HTMLElement | null = null;
    private parser: MarkdownParser;
    private readerPanel: ReaderPanel;

    constructor() {
        this.parser = new MarkdownParser();
        this.readerPanel = new ReaderPanel();
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
     * Inject copy/reader buttons into panel toolbar
     * Buttons are inserted before the close button
     */
    private injectToolbar(panel: HTMLElement): void {
        // Find the close button to insert before it
        const closeButton = panel.querySelector('[data-test-id="close-button"]');
        if (!closeButton || !closeButton.parentElement) {
            logger.warn('[DeepResearch] Close button not found');
            return;
        }

        // Check if already injected
        if (closeButton.parentElement.querySelector('.aicopy-dr-button')) {
            logger.debug('[DeepResearch] Buttons already injected');
            return;
        }

        // Create copy button
        const copyBtn = this.createButton(i18n.t('btnCopy'), 'content_copy', () => {
            this.handleCopy(panel);
        });

        // Create reader button
        const readerBtn = this.createButton(i18n.t('readerMode'), 'menu_book', () => {
            this.handleReader(panel);
        });

        // Insert before close button: [Reader][Copy][Close]
        closeButton.parentElement.insertBefore(readerBtn, closeButton);
        closeButton.parentElement.insertBefore(copyBtn, closeButton);

        logger.info('[DeepResearch] Toolbar buttons injected');
    }

    /**
     * Create a button matching Gemini's icon-button style
     */
    private createButton(tooltip: string, icon: string, onClick: () => void): HTMLElement {
        const button = document.createElement('button');
        button.className = 'mdc-icon-button mat-mdc-icon-button mat-mdc-button-base mat-mdc-tooltip-trigger aicopy-dr-button';
        button.setAttribute('type', 'button');
        button.setAttribute('aria-label', tooltip);

        // Attach custom tooltip
        TooltipHelper.attach(button, tooltip);

        button.style.cssText = `
            width: 40px;
            height: 40px;
            padding: 8px;
            flex-shrink: 0;
        `;

        // Create mat-icon element
        const matIcon = document.createElement('mat-icon');
        matIcon.className = 'notranslate gds-icon-m google-symbols mat-ligature-font mat-icon-no-color';
        matIcon.setAttribute('role', 'img');
        matIcon.setAttribute('aria-hidden', 'true');
        matIcon.setAttribute('data-mat-icon-type', 'font');
        matIcon.setAttribute('data-mat-icon-name', icon);
        matIcon.setAttribute('fonticon', icon);
        matIcon.textContent = icon;

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
            this.showFeedback(i18n.t('contentNotFound'), true);
            return;
        }

        try {
            const markdown = this.parser.parse(content as HTMLElement);
            const success = await copyToClipboard(markdown);

            if (success) {
                logger.info('[DeepResearch] Content copied to clipboard');
                this.showFeedback(i18n.t('btnCopied'));
            } else {
                logger.error('[DeepResearch] Failed to copy to clipboard');
                this.showFeedback(i18n.t('copyFailed'), true);
            }
        } catch (error) {
            logger.error('[DeepResearch] Error during copy:', error);
            this.showFeedback(i18n.t('copyFailed'), true);
        }
    }

    /**
     * Handle reader button click - open in ReaderPanel
     */
    private handleReader(panel: HTMLElement): void {
        const content = panel.querySelector('#extended-response-markdown-content');
        if (!content) {
            logger.warn('[DeepResearch] Content element not found');
            this.showFeedback(i18n.t('contentNotFound'), true);
            return;
        }

        try {
            this.readerPanel.show(
                content as HTMLElement,
                (el: HTMLElement) => this.parser.parse(el)
            );
            logger.info('[DeepResearch] Reader panel opened');
        } catch (error) {
            logger.error('[DeepResearch] Error opening reader:', error);
            this.showFeedback(i18n.t('openFailed'), true);
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
            background: ${isError ? 'var(--aimd-error)' : 'var(--aimd-interactive-primary)'};
            color: var(--aimd-text-on-primary);
            padding: 12px 24px;
            border-radius: 8px;
            font-size: 14px;
            font-weight: 500;
            z-index: 10000;
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
