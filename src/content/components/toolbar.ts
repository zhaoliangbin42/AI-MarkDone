import { toolbarStyles } from '../../styles/toolbar.css';
import { copyToClipboard } from '../../utils/dom-utils';
import { logger } from '../../utils/logger';
import { WordCounter } from '../parsers/word-counter';

export interface ToolbarCallbacks {
    onCopyMarkdown: () => Promise<string>;
    onViewSource: () => void;
    onReRender: () => void;
    onBookmark?: () => void;
}

/**
 * Shadow DOM toolbar component
 * Provides Copy MD, Source, and Word Count buttons
 */
export class Toolbar {
    private shadowRoot: ShadowRoot;
    private container: HTMLElement;
    private callbacks: ToolbarCallbacks;
    private wordCounter: WordCounter;

    constructor(callbacks: ToolbarCallbacks) {
        this.callbacks = callbacks;
        this.wordCounter = new WordCounter();

        // Create container
        this.container = document.createElement('div');
        this.container.className = 'aicopy-toolbar-container';

        // Attach shadow DOM for style isolation
        this.shadowRoot = this.container.attachShadow({ mode: 'open' });

        // Inject styles
        const styleElement = document.createElement('style');
        styleElement.textContent = toolbarStyles;
        this.shadowRoot.appendChild(styleElement);

        // Create UI
        this.createUI();
    }

    /**
     * Create toolbar UI
     */
    private createUI(): void {
        const wrapper = document.createElement('div');
        wrapper.className = 'aicopy-toolbar';

        // Bookmark button (bookmark icon)
        const bookmarkBtn = this.createIconButton(
            'bookmark-btn',
            this.getBookmarkIcon(),
            'Bookmark',
            () => this.handleBookmark()
        );

        // Copy Markdown button (clipboard icon)
        const copyBtn = this.createIconButton(
            'copy-md-btn',
            this.getClipboardIcon(),
            'Copy Markdown',
            () => this.handleCopyMarkdown()
        );

        // View Source button (code icon)
        const sourceBtn = this.createIconButton(
            'source-btn',
            this.getCodeIcon(),
            'View Source',
            () => this.handleViewSource()
        );

        // Re-render button (eye icon)
        const reRenderBtn = this.createIconButton(
            're-render-btn',
            this.getEyeIcon(),
            'Preview Enhance',
            () => this.handleReRender()
        );

        // Word count stats (right side)
        const stats = document.createElement('span');
        stats.className = 'aicopy-stats';
        stats.id = 'word-stats';
        stats.textContent = 'Loading...';

        // Button group for left-aligned buttons
        const buttonGroup = document.createElement('div');
        buttonGroup.className = 'aicopy-button-group';
        buttonGroup.appendChild(bookmarkBtn);
        buttonGroup.appendChild(copyBtn);
        buttonGroup.appendChild(sourceBtn);
        buttonGroup.appendChild(reRenderBtn);

        wrapper.appendChild(buttonGroup);
        wrapper.appendChild(stats);

        this.shadowRoot.appendChild(wrapper);

        // Initialize word count with retry (wait for content to load)
        this.initWordCountWithRetry();
    }

    /**
     * Initialize word count with retry mechanism
     */
    private async initWordCountWithRetry(): Promise<void> {
        const maxRetries = 10;
        let attempt = 0;

        // Wait 500ms before first attempt
        await new Promise(resolve => setTimeout(resolve, 500));

        while (attempt < maxRetries) {
            try {
                const markdown = await this.callbacks.onCopyMarkdown();

                // Check if we got actual content
                if (markdown && markdown.trim().length > 0) {
                    const stats = this.shadowRoot.querySelector('#word-stats');
                    if (stats) {
                        const result = this.wordCounter.count(markdown);
                        const formatted = this.wordCounter.format(result);

                        // Only update if not "No content"
                        if (formatted !== 'No content') {
                            stats.textContent = formatted;
                            logger.debug(`[WordCount] Initialized on attempt ${attempt + 1}`);
                            return; // Success!
                        }
                    }
                }
            } catch (error) {
                logger.debug('[WordCount] Retry failed:', error);
            }

            // Retry with exponential backoff
            attempt++;
            if (attempt < maxRetries) {
                const delay = Math.min(500 * Math.pow(2, attempt), 10000);
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }

        // Failed after all retries
        logger.warn('[WordCount] Failed after all retries');
        const stats = this.shadowRoot.querySelector('#word-stats');
        if (stats) stats.textContent = 'Click copy';
    }

    /**
     * Create an icon button with tooltip
     */
    private createIconButton(
        id: string,
        iconSvg: string,
        tooltipText: string,
        onClick: () => void
    ): HTMLButtonElement {
        const button = document.createElement('button');
        button.className = 'aicopy-button';
        button.id = id;
        button.setAttribute('aria-label', tooltipText);
        button.innerHTML = iconSvg;
        button.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            onClick();
        });

        return button;
    }

    /**
     * Get clipboard icon SVG
     */
    private getClipboardIcon(): string {
        return `
      <svg class="aicopy-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
      </svg>
    `;
    }

    /**
     * Get code icon SVG
     */
    private getCodeIcon(): string {
        return `
      <svg class="aicopy-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="16 18 22 12 16 6"></polyline>
        <polyline points="8 6 2 12 8 18"></polyline>
      </svg>
    `;
    }

    /**
     * Get eye icon SVG (for preview)
     */
    private getEyeIcon(): string {
        return `
      <svg class="aicopy-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
        <circle cx="12" cy="12" r="3"></circle>
      </svg>
    `;
    }

    /**
     * Get checkmark icon SVG
     */
    private getCheckIcon(): string {
        return `
      <svg class="aicopy-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="20 6 9 17 4 12"></polyline>
      </svg>
    `;
    }

    /**
     * Get bookmark icon SVG
     */
    private getBookmarkIcon(): string {
        return `
      <svg class="aicopy-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path>
      </svg>
    `;
    }


    /**
     * Handle Copy Markdown button click
     */
    private async handleCopyMarkdown(): Promise<void> {
        const btn = this.shadowRoot.querySelector('#copy-md-btn') as HTMLButtonElement;
        if (!btn) return;

        try {
            // Disable button
            btn.disabled = true;

            // Get Markdown from callback
            const markdown = await this.callbacks.onCopyMarkdown();

            // Copy to clipboard
            const success = await copyToClipboard(markdown);

            if (success) {
                // Change icon to checkmark
                const originalIcon = btn.innerHTML;
                btn.innerHTML = this.getCheckIcon();
                btn.style.color = 'var(--theme-color)';

                logger.info('Markdown copied to clipboard');

                // Reset after 2 seconds
                setTimeout(() => {
                    btn.innerHTML = originalIcon;
                    btn.style.color = '';
                    btn.disabled = false;
                }, 2000);
            } else {
                throw new Error('Failed to copy');
            }
        } catch (error) {
            logger.error('Copy failed:', error);
            btn.disabled = false;
        }
    }

    /**
     * Handle Re-render button click
     */
    private handleReRender(): void {
        logger.debug('Re-render clicked');
        this.callbacks.onReRender();

        const btn = this.shadowRoot.querySelector('#re-render-btn') as HTMLButtonElement;
        if (btn) this.showFeedback(btn, 'Opening Preview...');
    }

    /**
     * Handle View Source button click
     */
    private handleViewSource(): void {
        logger.debug('View Source clicked');
        this.callbacks.onViewSource();

        const btn = this.shadowRoot.querySelector('#source-btn') as HTMLButtonElement;
        if (btn) this.showFeedback(btn, 'Source Opened');
    }

    /**
     * Handle Bookmark button click
     */
    private handleBookmark(): void {
        logger.debug('Bookmark clicked');
        if (this.callbacks.onBookmark) {
            this.callbacks.onBookmark();
            // Note: Feedback is now handled by the parent component
            // to show context-aware messages (Saving/Removing)
        }
    }


    /**
     * Show floating feedback tooltip on button click
     */
    private showFeedback(button: HTMLButtonElement, message: string): void {
        // Create feedback element
        const feedback = document.createElement('div');
        feedback.className = 'aicopy-button-feedback';
        feedback.textContent = message;

        // Position relative to button
        button.style.position = 'relative';
        button.appendChild(feedback);

        // Remove after animation completes
        setTimeout(() => {
            feedback.remove();
        }, 1500);
    }

    /**
     * Set bookmark button state (highlighted when bookmarked)
     */
    setBookmarkState(isBookmarked: boolean): void {
        const bookmarkBtn = this.shadowRoot.querySelector('#bookmark-btn') as HTMLButtonElement;
        if (!bookmarkBtn) return;

        if (isBookmarked) {
            // Add bookmarked class for visual feedback
            bookmarkBtn.classList.add('bookmarked');
            bookmarkBtn.title = 'Remove Bookmark';
            bookmarkBtn.setAttribute('aria-label', 'Remove Bookmark');
        } else {
            bookmarkBtn.classList.remove('bookmarked');
            bookmarkBtn.title = 'Bookmark';
            bookmarkBtn.setAttribute('aria-label', 'Bookmark');
        }
    }

    /**
     * Get the toolbar container element
     */
    getElement(): HTMLElement {
        return this.container;
    }

    /**
     * Destroy the toolbar
     */
    destroy(): void {
        this.container.remove();
    }
}
