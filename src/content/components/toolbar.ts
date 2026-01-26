import { toolbarStyles } from '../../styles/toolbar.css';
import { DesignTokens } from '../../utils/design-tokens';
import { ThemeManager } from '../../utils/ThemeManager';
import { copyToClipboard } from '../../utils/dom-utils';
import { logger } from '../../utils/logger';
import { WordCounter } from '../parsers/word-counter';
import { Icons } from '../../assets/icons';
import { eventBus } from '../utils/EventBus';
import { SettingsManager } from '../../settings/SettingsManager';

export interface ToolbarCallbacks {
    onCopyMarkdown: () => Promise<string>;
    onViewSource: () => void;
    onReRender: () => void;
    onBookmark?: () => void;
    onSaveMessages?: () => void;
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
    private tokenStyleElement: HTMLStyleElement | null = null;
    private pending: boolean = false;
    private wordCountInitialized: boolean = false;
    private wordCountInitInFlight: boolean = false;

    constructor(callbacks: ToolbarCallbacks) {
        this.callbacks = callbacks;
        this.wordCounter = new WordCounter();

        // Create container
        this.container = document.createElement('div');
        this.container.className = 'aicopy-toolbar-container';

        // Attach shadow DOM for style isolation
        this.shadowRoot = this.container.attachShadow({ mode: 'open' });

        // Inject styles
        this.injectStyles();
        this.setTheme(ThemeManager.getInstance().isDarkMode());

        // Subscribe to theme changes for hot-switching
        ThemeManager.getInstance().subscribe((theme) => {
            this.setTheme(theme === 'dark');
        });

        // Create UI (async, non-blocking)
        this.createUI();
    }

    /**
     * Inject styles into Shadow DOM
     */
    private injectStyles(): void {
        this.tokenStyleElement = document.createElement('style');
        this.shadowRoot.appendChild(this.tokenStyleElement);

        const styleElement = document.createElement('style');
        styleElement.textContent = toolbarStyles;
        this.shadowRoot.appendChild(styleElement);
    }

    /**
     * Update toolbar theme tokens
     */
    setTheme(isDark: boolean): void {
        if (this.tokenStyleElement) {
            this.tokenStyleElement.textContent = `:host { ${DesignTokens.getCompleteTokens(isDark)} }`;
        }
        this.container.dataset.theme = isDark ? 'dark' : 'light';
    }

    /**
     * Create toolbar UI
     */
    private async createUI(): Promise<void> {
        // Load behavior settings (includes toolbar button visibility)
        const behaviorSettings = await SettingsManager.getInstance().get('behavior');

        const wrapper = document.createElement('div');
        wrapper.className = 'aicopy-toolbar';

        // Bookmark button (bookmark icon) - always shown
        const bookmarkBtn = this.createIconButton(
            'bookmark-btn',
            Icons.bookmark,
            'Bookmark',
            () => this.handleBookmark()
        );

        // Copy Markdown button (clipboard icon) - always shown
        const copyBtn = this.createIconButton(
            'copy-md-btn',
            Icons.copy,
            'Copy Markdown',
            () => this.handleCopyMarkdown()
        );

        // View Source button (code icon) - conditional
        let sourceBtn: HTMLElement | null = null;
        if (behaviorSettings.showViewSource) {
            sourceBtn = this.createIconButton(
                'source-btn',
                Icons.code,
                'View Source',
                () => this.handleViewSource()
            );
        }

        // Re-render button (book open icon - Reader) - always shown
        const reRenderBtn = this.createIconButton(
            're-render-btn',
            Icons.bookOpen,
            'Reader',
            () => this.handleReRender()
        );

        // Save as button (file-box icon) - conditional
        let saveMessagesBtn: HTMLElement | null = null;
        if (behaviorSettings.showSaveMessages) {
            saveMessagesBtn = this.createIconButton(
                'save-messages-btn',
                Icons.fileBox,
                'Save as',
                () => this.handleSaveMessages()
            );
        }

        // Word count stats (right side) - conditional
        let stats: HTMLElement | null = null;
        let divider: HTMLElement | null = null;
        if (behaviorSettings.showWordCount) {
            stats = document.createElement('span');
            stats.className = 'aicopy-stats';
            stats.id = 'word-stats';
            stats.textContent = 'Loading...';

            // Visual divider between buttons and stats
            divider = document.createElement('div');
            divider.className = 'aicopy-divider';
        }

        // Button group for left-aligned buttons
        const buttonGroup = document.createElement('div');
        buttonGroup.className = 'aicopy-button-group';
        buttonGroup.appendChild(bookmarkBtn);
        buttonGroup.appendChild(copyBtn);
        if (sourceBtn) buttonGroup.appendChild(sourceBtn);
        buttonGroup.appendChild(reRenderBtn);
        if (saveMessagesBtn) buttonGroup.appendChild(saveMessagesBtn);

        wrapper.appendChild(buttonGroup);
        if (divider) wrapper.appendChild(divider);
        if (stats) wrapper.appendChild(stats);

        this.shadowRoot.appendChild(wrapper);

        // Initialize word count with retry (wait for content to load)
        if (behaviorSettings.showWordCount) {
            this.initWordCountWithRetry();
        }
    }


    /**
     * Initialize word count with retry mechanism
     */
    private async initWordCountWithRetry(): Promise<void> {
        if (this.pending || this.wordCountInitInFlight || this.wordCountInitialized) return;
        this.wordCountInitInFlight = true;
        const maxRetries = 10;
        let attempt = 0;

        // Wait 500ms before first attempt
        await new Promise(resolve => setTimeout(resolve, 500));

        // RACE CONDITION FIX:
        // If pending was set to true during the delay (e.g. by handleNewMessage identifying streaming),
        // we MUST abort this premature initialization.
        if (this.pending) {
            this.wordCountInitInFlight = false;
            return;
        }

        while (attempt < maxRetries) {
            try {
                const markdown = await this.callbacks.onCopyMarkdown();

                // Check if we got actual content and update display
                if (markdown && markdown.trim().length > 0 && this.updateStatsDisplay(markdown)) {
                    this.wordCountInitialized = true;
                    this.wordCountInitInFlight = false;
                    this.setPending(false);
                    logger.debug(`[WordCount] Initialized on attempt ${attempt + 1}`);
                    return;
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
        this.wordCountInitInFlight = false;
    }

    /**
     * Update stats display with formatted word count
     * Returns true if successful
     */
    private updateStatsDisplay(markdown: string): boolean {
        if (!markdown || markdown.trim().length === 0) return false;

        const stats = this.shadowRoot.querySelector('#word-stats');
        if (!stats) return false;

        const result = this.wordCounter.count(markdown);
        const formatted = this.wordCounter.format(result);

        if (formatted !== 'No content') {
            const parts = formatted.split(' / ');
            if (parts.length >= 2) {
                stats.innerHTML = `<div>${parts[0]}</div><div>${parts.slice(1).join(' ')}</div>`;
            } else {
                stats.textContent = formatted;
            }
            return true;
        }
        return false;
    }

    /**
     * Refresh word count display
     * Public method for external triggers (e.g. Deep Think content updates, copy action)
     */
    async refreshWordCount(): Promise<void> {
        try {
            const markdown = await this.callbacks.onCopyMarkdown();
            if (this.updateStatsDisplay(markdown)) {
                logger.debug('[WordCount] Refreshed');
            }
        } catch (error) {
            logger.warn('[WordCount] Refresh failed:', error);
        }
    }

    /**
     * Create icon button with hover tooltip (using feedback mechanism)
     */
    private createIconButton(
        id: string,
        icon: string,
        label: string,
        onClick: () => void
    ): HTMLElement {
        const button = document.createElement('button');
        button.id = id;
        button.className = 'aicopy-button';
        button.setAttribute('aria-label', label);
        button.innerHTML = icon;
        button.addEventListener('click', onClick);

        // Hover tooltip using feedback mechanism
        let hoverTimeout: number | null = null;
        let feedbackElement: HTMLElement | null = null;

        button.addEventListener('mouseenter', () => {
            // Show tooltip after 500ms delay
            hoverTimeout = window.setTimeout(() => {
                feedbackElement = document.createElement('div');
                feedbackElement.className = 'aicopy-button-feedback';
                feedbackElement.textContent = label;
                button.style.position = 'relative';
                button.appendChild(feedbackElement);
            }, 100);
        });

        button.addEventListener('mouseleave', () => {
            // Clear timeout if mouse leaves before tooltip shows
            if (hoverTimeout) {
                window.clearTimeout(hoverTimeout);
                hoverTimeout = null;
            }
            // Remove tooltip if it's showing
            if (feedbackElement) {
                feedbackElement.remove();
                feedbackElement = null;
            }
        });

        return button;
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
                // 🔑 Refresh word count after successful copy
                await this.refreshWordCount();

                // Change icon to checkmark
                const originalIcon = btn.innerHTML;
                btn.innerHTML = Icons.check;
                btn.style.color = 'var(--theme-color)';

                // Show "Copied!" feedback
                this.showFeedback(btn, 'Copied!');

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
     * Handle Save as button click
     */
    private handleSaveMessages(): void {
        logger.debug('[AI-MarkDone][Toolbar] Save messages clicked');
        if (this.callbacks.onSaveMessages) {
            this.callbacks.onSaveMessages();
            const btn = this.shadowRoot.querySelector('#save-messages-btn') as HTMLButtonElement;
            if (btn) this.showFeedback(btn, 'Saving...');
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
        const toolbar = this.shadowRoot.querySelector('.aicopy-toolbar');
        const bookmarkBtn = this.shadowRoot.querySelector('#bookmark-btn') as HTMLButtonElement;
        if (!bookmarkBtn || !toolbar) return;

        if (isBookmarked) {
            // Add bookmarked class to both toolbar and button
            toolbar.classList.add('bookmarked');
            bookmarkBtn.classList.add('bookmarked');
            bookmarkBtn.title = 'Remove Bookmark';
            bookmarkBtn.setAttribute('aria-label', 'Remove Bookmark');
        } else {
            toolbar.classList.remove('bookmarked');
            bookmarkBtn.classList.remove('bookmarked');
            bookmarkBtn.title = 'Bookmark';
            bookmarkBtn.setAttribute('aria-label', 'Bookmark');
        }
    }

    /**
     * Set pending/disabled state for streaming/thinking messages
     */
    setPending(isPending: boolean): void {
        const wasPending = this.pending;
        if (wasPending === isPending) return;
        this.pending = isPending;

        const toolbar = this.shadowRoot.querySelector('.aicopy-toolbar');
        if (toolbar) {
            toolbar.classList.toggle('pending', isPending);
        }

        const buttons = this.shadowRoot.querySelectorAll('.aicopy-button');
        buttons.forEach((btn) => {
            if (btn instanceof HTMLButtonElement) {
                btn.disabled = isPending;
            }
        });

        const stats = this.shadowRoot.querySelector('#word-stats');
        if (stats) {
            stats.textContent = isPending ? 'loading ...' : stats.textContent;
        }

        // ✅ Emit event when transitioning from pending to active
        if (wasPending && !isPending) {
            logger.debug('[Toolbar] Emitting toolbar:activated event');
            eventBus.emit('toolbar:activated', {});
        }

        if (!isPending && !this.wordCountInitialized) {
            this.initWordCountWithRetry();
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
