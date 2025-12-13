import { adapterRegistry } from './adapters/registry';
import { MessageObserver } from './observers/mutation-observer';
import { ToolbarInjector } from './injectors/toolbar-injector';
import { Toolbar, ToolbarCallbacks } from './components/toolbar';
import { Modal } from './components/modal';
import { MarkdownParser } from './parsers/markdown-parser';
import { MathClickHandler } from './features/math-click';
import { ReRenderPanel } from './features/re-render';
import { DeepResearchHandler } from './features/deep-research-handler';
import { logger, LogLevel } from '../utils/logger';
import { SimpleBookmarkStorage } from '../bookmarks/storage/SimpleBookmarkStorage';
import { pageHeaderIcon } from './components/PageHeaderIcon';
import { geminiPanelButton } from './components/GeminiPanelButton';
import { bookmarkEditModal } from '../bookmarks/components/BookmarkEditModal';

/**
 * Main content script controller
 */
class ContentScript {
    private observer: MessageObserver | null = null;
    private injector: ToolbarInjector | null = null;
    private markdownParser: MarkdownParser;
    private mathClickHandler: MathClickHandler;
    private reRenderPanel: ReRenderPanel;
    private deepResearchHandler?: DeepResearchHandler;

    // Simple Set-based bookmark state tracking - AITimeline pattern
    private bookmarkedPositions: Set<number> = new Set();

    constructor() {
        // Set log level (change to DEBUG for development)
        logger.setLevel(LogLevel.ERROR);

        // Initialize components
        this.markdownParser = new MarkdownParser();
        this.mathClickHandler = new MathClickHandler();
        this.reRenderPanel = new ReRenderPanel();

        logger.info('AI Copy Enhance initialized');
    }

    /**
     * Start the extension
     */
    start(): void {
        // Check if current page is supported
        if (!adapterRegistry.isSupported()) {
            logger.warn('Current page is not supported');
            return;
        }

        const adapter = adapterRegistry.getAdapter();
        if (!adapter) {
            logger.error('Failed to get adapter');
            return;
        }

        logger.info('Starting extension on supported page');

        // Initialize injector
        this.injector = new ToolbarInjector(adapter);

        // Initialize observer
        this.observer = new MessageObserver(adapter, (messageElement) => {
            this.handleNewMessage(messageElement);
        });

        // Enable Deep Research support for Gemini
        if ('isGemini' in adapter && typeof adapter.isGemini === 'function' && adapter.isGemini()) {
            logger.info('Enabling Deep Research handler for Gemini');
            this.deepResearchHandler = new DeepResearchHandler();
            this.deepResearchHandler.enable();

            // Initialize Gemini panel button
            geminiPanelButton.init();
        } else {
            // Initialize ChatGPT page header icon
            pageHeaderIcon.init();
        }

        // Load bookmarks for current page - AITimeline pattern
        this.loadBookmarks();

        // Start observing
        this.observer.start();
    }

    /**
     * Load bookmarked positions for current page
     */
    private async loadBookmarks(): Promise<void> {
        try {
            const url = window.location.href;
            this.bookmarkedPositions = await SimpleBookmarkStorage.loadAllPositions(url);
            logger.info(`[ContentScript] Loaded ${this.bookmarkedPositions.size} bookmarks for current page`);
        } catch (error) {
            logger.error('[ContentScript] Failed to load bookmarks:', error);
        }
    }

    /**
     * Handle new message detected
     */
    private handleNewMessage(messageElement: HTMLElement): void {
        logger.debug('Handling new message');

        // CRITICAL: Check if toolbar already exists BEFORE creating new one
        // This prevents creating orphaned toolbar objects with wrong messageElement bindings
        if (messageElement.querySelector('.aicopy-toolbar-container')) {
            logger.debug('Toolbar already exists, skipping');
            return;
        }

        // Create toolbar with callbacks
        const callbacks: ToolbarCallbacks = {
            onCopyMarkdown: async () => {
                return this.getMarkdown(messageElement);
            },
            onViewSource: () => {
                this.showSourceModal(messageElement);
            },
            onReRender: () => {
                this.showReRenderPanel(messageElement);
            },
            onBookmark: async () => {
                await this.handleBookmark(messageElement);
            }
        };

        const toolbar = new Toolbar(callbacks);

        // Inject toolbar
        if (this.injector) {
            this.injector.inject(messageElement, toolbar.getElement());
        }

        // Store toolbar reference on container for later access
        const toolbarContainer = messageElement.querySelector('.aicopy-toolbar-container');
        if (toolbarContainer) {
            (toolbarContainer as any).__toolbar = toolbar;
        }

        // Set initial bookmark state - AITimeline pattern
        const position = this.getMessagePosition(messageElement);
        const isBookmarked = this.bookmarkedPositions.has(position);
        toolbar.setBookmarkState(isBookmarked);

        // Enable click-to-copy for math elements
        this.mathClickHandler.enable(messageElement);
    }

    /**
     * Get Markdown from message element
     */
    private getMarkdown(messageElement: HTMLElement): string {
        const adapter = adapterRegistry.getAdapter();
        if (!adapter) return '';

        // For Deep Research (article elements), parse the entire article
        // because it contains multiple .deep-research-result divs
        if (messageElement.tagName.toLowerCase() === 'article') {
            logger.debug('[getMarkdown] Article element detected, parsing entire article');
            return this.markdownParser.parse(messageElement);
        }

        // For regular messages, find the content element
        const contentSelector = adapter.getMessageContentSelector();
        if (!contentSelector) return '';

        const contentElement = messageElement.querySelector(contentSelector);
        if (!contentElement || !(contentElement instanceof HTMLElement)) {
            logger.debug('[getMarkdown] Content element not found');
            return '';
        }
        return this.markdownParser.parse(contentElement);
    }

    /**
     * Show source code modal
     */
    private showSourceModal(messageElement: HTMLElement): void {
        const markdown = this.getMarkdown(messageElement);
        const modal = new Modal();
        modal.show(markdown, 'Markdown Source Code');
    }

    /**
     * Show re-render preview panel
     */
    private showReRenderPanel(messageElement: HTMLElement): void {
        const markdown = this.getMarkdown(messageElement);
        this.reRenderPanel.show(markdown);
    }

    /**
     * Handle bookmark toggle - AITimeline pattern with edit modal
     */
    private async handleBookmark(messageElement: HTMLElement): Promise<void> {
        const url = window.location.href;
        const position = this.getMessagePosition(messageElement);

        if (position === -1) {
            logger.error('[handleBookmark] Failed to get message position');
            return;
        }

        try {
            if (this.bookmarkedPositions.has(position)) {
                // Remove bookmark
                await SimpleBookmarkStorage.remove(url, position);
                this.bookmarkedPositions.delete(position);
                this.updateToolbarState(messageElement, false);
                logger.info(`[handleBookmark] Removed bookmark at position ${position}`);
            } else {
                // Add bookmark - show edit modal first
                const userMessage = this.getUserMessage(messageElement);
                if (!userMessage) {
                    logger.error('[handleBookmark] Failed to extract user message');
                    return;
                }

                // Detect platform
                const adapter = adapterRegistry.getAdapter();
                const platform: 'ChatGPT' | 'Gemini' =
                    (adapter && 'isGemini' in adapter && typeof adapter.isGemini === 'function' && adapter.isGemini())
                        ? 'Gemini' : 'ChatGPT';

                // Get AI response (if this is an AI message)
                const aiResponse = this.getAiResponse(messageElement);

                // Show edit modal
                bookmarkEditModal.show(
                    userMessage,
                    async (title: string, notes: string) => {
                        // Save with custom title, notes, and AI response
                        await SimpleBookmarkStorage.save(url, position, userMessage, aiResponse, title, notes, platform);
                        this.bookmarkedPositions.add(position);
                        this.updateToolbarState(messageElement, true);
                        logger.info(`[handleBookmark] Saved bookmark at position ${position}`);
                    },
                    () => {
                        // Cancelled
                        logger.info('[handleBookmark] Bookmark save cancelled');
                    }
                );
            }
        } catch (error) {
            logger.error('[handleBookmark] Failed to toggle bookmark:', error);
        }
    }

    /**
     * Get message position in conversation (1-indexed)
     */
    private getMessagePosition(messageElement: HTMLElement): number {
        const adapter = adapterRegistry.getAdapter();
        if (!adapter) return -1;

        const messageSelector = adapter.getMessageSelector();
        const allMessages = Array.from(document.querySelectorAll(messageSelector));
        const index = allMessages.indexOf(messageElement);

        return index === -1 ? -1 : index + 1; // Convert to 1-indexed
    }

    /**
     * Get user message text from message element
     */
    private getUserMessage(messageElement: HTMLElement): string {
        const adapter = adapterRegistry.getAdapter();
        if (!adapter) return '';

        const messageSelector = adapter.getMessageSelector();
        const contentSelector = adapter.getMessageContentSelector();
        if (!contentSelector) return '';

        // First, try to get content from current message (in case it's a user message)
        const currentContent = messageElement.querySelector(contentSelector);
        if (currentContent) {
            const text = currentContent.textContent?.trim() || '';
            // If current message has content and seems like a user message (not too long), use it
            if (text && text.length < 5000) {
                return text;
            }
        }

        // Otherwise, find previous user message (for AI response messages)
        const allMessages = Array.from(document.querySelectorAll(messageSelector));
        const currentIndex = allMessages.indexOf(messageElement);

        if (currentIndex <= 0) return '';

        // Get previous message (should be user message)
        const prevMessage = allMessages[currentIndex - 1] as HTMLElement;
        const prevContent = prevMessage.querySelector(contentSelector);
        if (!prevContent) return '';

        return prevContent.textContent?.trim() || '';
    }

    /**
     * Get AI response text from message element
     */
    private getAiResponse(messageElement: HTMLElement): string {
        const adapter = adapterRegistry.getAdapter();
        if (!adapter) return '';

        const contentSelector = adapter.getMessageContentSelector();
        if (!contentSelector) return '';

        // Get content from current message (should be AI response)
        const content = messageElement.querySelector(contentSelector);
        if (!content) return '';

        return content.textContent?.trim() || '';
    }

    /**
     * Update toolbar bookmark state
     */
    private updateToolbarState(messageElement: HTMLElement, isBookmarked: boolean): void {
        const toolbarContainer = messageElement.querySelector('.aicopy-toolbar-container');
        if (toolbarContainer) {
            const toolbar = (toolbarContainer as any).__toolbar;
            if (toolbar && typeof toolbar.setBookmarkState === 'function') {
                toolbar.setBookmarkState(isBookmarked);
            }
        }
    }

    /**
     * Stop the extension
     */
    stop(): void {
        if (this.observer) {
            this.observer.stop();
            this.observer = null;
        }
        logger.info('Extension stopped');
    }
}

// Initialize and start when DOM is ready
function initExtension() {
    logger.info('Initializing AI Copy Enhance extension');
    logger.debug('Document readyState:', document.readyState);
    logger.debug('Current URL:', window.location.href);

    const contentScript = new ContentScript();
    contentScript.start();

    // Also listen for URL changes (for SPA navigation)
    let lastUrl = window.location.href;
    new MutationObserver(() => {
        const currentUrl = window.location.href;
        if (currentUrl !== lastUrl) {
            lastUrl = currentUrl;
            logger.info('URL changed, reinitializing:', currentUrl);
            // Small delay to let the new page render
            setTimeout(() => {
                const newScript = new ContentScript();
                newScript.start();
            }, 500);
        }
    }).observe(document.body, { subtree: true, childList: true });
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initExtension);
} else {
    // DOM already loaded, start immediately
    initExtension();
}
