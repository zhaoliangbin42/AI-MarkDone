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
import { BookmarkSaveModal } from '../bookmarks/components/BookmarkSaveModal';
import { pageHeaderIcon } from './components/PageHeaderIcon';
import { geminiPanelButton } from './components/GeminiPanelButton';

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

    // Navigation check flag - AITimeline pattern
    private navigationChecked: boolean = false;

    constructor() {
        // Use INFO in production; switch to DEBUG locally when needed
        logger.setLevel(LogLevel.INFO);

        // Initialize components
        this.markdownParser = new MarkdownParser();
        this.mathClickHandler = new MathClickHandler();
        this.reRenderPanel = new ReRenderPanel();

        logger.info('AI-Markdone initialized');
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
     * Check for cross-page bookmark navigation - AITimeline pattern
     */
    private async checkBookmarkNavigation(): Promise<void> {
        const { simpleBookmarkPanel } = await import('../bookmarks/components/SimpleBookmarkPanel');
        await simpleBookmarkPanel.checkNavigationTarget();
    }

    /**
     * Handle new message detected
     */
    private handleNewMessage(messageElement: HTMLElement): void {
        logger.debug('Handling new message');

        // ✅ AITimeline pattern: Check navigation target on first message detection
        if (!this.navigationChecked) {
            this.navigationChecked = true;
            logger.info('[ContentScript] First message detected, checking bookmark navigation');
            this.checkBookmarkNavigation();
        }

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
                // Add bookmark - show unified save modal
                try {
                    const userMessage = this.getUserMessage(messageElement);
                    logger.info('[handleBookmark] User message extracted:', userMessage ? userMessage.substring(0, 50) : 'EMPTY');

                    if (!userMessage) {
                        logger.error('[handleBookmark] Failed to extract user message');
                        alert('Failed to extract user message. Please try again.');
                        return;
                    }

                    // Detect platform
                    const adapter = adapterRegistry.getAdapter();
                    const platform: 'ChatGPT' | 'Gemini' =
                        (adapter && 'isGemini' in adapter && typeof adapter.isGemini === 'function' && adapter.isGemini())
                            ? 'Gemini' : 'ChatGPT';

                    // Get AI response markdown (use parsed markdown, not plain text)
                    const aiResponse = this.getMarkdown(messageElement);
                    logger.info('[handleBookmark] AI response extracted (first 200 chars):', aiResponse.substring(0, 200));

                    // Prepare default title (first 50 chars)
                    const defaultTitle = userMessage.substring(0, 50) + (userMessage.length > 50 ? '...' : '');

                    // Get last used folder
                    const lastUsedFolder = localStorage.getItem('lastUsedFolder') || 'Import';

                    // Show unified save modal
                    const saveModal = new BookmarkSaveModal();
                    saveModal.show({
                        defaultTitle,
                        lastUsedFolder,
                        onSave: async (title, folderPath) => {
                            // Save bookmark with selected folder
                            await SimpleBookmarkStorage.save(
                                url,
                                position,
                                userMessage,
                                aiResponse,
                                title,
                                platform,
                                Date.now(),
                                folderPath
                            );

                            // Update state
                            this.bookmarkedPositions.add(position);
                            this.updateToolbarState(messageElement, true);

                            // Remember folder
                            localStorage.setItem('lastUsedFolder', folderPath);

                            logger.info(`[handleBookmark] Saved "${title}" to "${folderPath}"`);
                        }
                    });
                } catch (error) {
                    logger.error('[handleBookmark] Failed to prepare bookmark:', error);
                    alert('Failed to prepare bookmark. Please try again.');
                }
            }
        } catch (error) {
            logger.error('[handleBookmark] Failed to toggle bookmark:', error);
            alert('Failed to toggle bookmark: ' + (error instanceof Error ? error.message : String(error)));
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
     * Based on real-world testing with ChatGPT and Gemini HTML
     */
    private getUserMessage(messageElement: HTMLElement): string {
        try {
            const adapter = adapterRegistry.getAdapter();
            if (!adapter) {
                logger.error('[getUserMessage] No adapter found');
                return '';
            }

            if ('isGemini' in adapter && typeof adapter.isGemini === 'function' && adapter.isGemini()) {
                // Gemini: Find user prompts
                logger.debug('[getUserMessage] Gemini mode');

                // Try different selectors for Gemini
                let userPrompts = Array.from(document.querySelectorAll('[data-test-id="user-query"]'));
                if (userPrompts.length === 0) {
                    // Fallback: try other possible selectors
                    userPrompts = Array.from(document.querySelectorAll('user-query, .user-query'));
                    logger.debug(`[getUserMessage] Fallback selector found ${userPrompts.length} prompts`);
                }

                const aiResponses = Array.from(document.querySelectorAll('model-response'));

                logger.debug(`[getUserMessage] Found ${userPrompts.length} user prompts, ${aiResponses.length} AI responses`);

                if (userPrompts.length === 0) {
                    logger.error('[getUserMessage] No user prompts found in Gemini');
                    return '';
                }

                const currentAiIndex = aiResponses.indexOf(messageElement);
                if (currentAiIndex < 0) {
                    logger.error('[getUserMessage] Current AI response not found in list');
                    return '';
                }
                if (currentAiIndex >= userPrompts.length) {
                    logger.error(`[getUserMessage] No matching user prompt for AI response ${currentAiIndex}`);
                    return '';
                }

                const userPrompt = userPrompts[currentAiIndex] as HTMLElement;
                const text = userPrompt.textContent?.trim() || '';
                logger.debug(`[getUserMessage] Extracted Gemini user message: ${text.substring(0, 50)}`);
                return text;
            } else {
                // ChatGPT: messageElement is <article>, need to find assistant element inside
                logger.debug('[getUserMessage] ChatGPT mode');

                // Get all user messages and assistant messages
                const userMessages = Array.from(document.querySelectorAll('[data-message-author-role="user"]'));
                const assistantMessages = Array.from(document.querySelectorAll('[data-message-author-role="assistant"]'));

                logger.debug(`[getUserMessage] Found ${userMessages.length} user messages, ${assistantMessages.length} assistant messages`);

                // Find current assistant message index
                // messageElement might be <article>, so look inside first
                let currentIndex = assistantMessages.indexOf(messageElement);

                if (currentIndex < 0) {
                    // messageElement is probably <article>, find assistant inside
                    const assistantInside = messageElement.querySelector('[data-message-author-role="assistant"]');
                    if (assistantInside) {
                        currentIndex = assistantMessages.indexOf(assistantInside as Element);
                        logger.debug(`[getUserMessage] Found assistant inside article, index: ${currentIndex}`);
                    }
                }

                if (currentIndex < 0) {
                    logger.error('[getUserMessage] Current assistant message not found in list');
                    return '';
                }

                logger.debug(`[getUserMessage] Current assistant index: ${currentIndex}`);

                // Match with corresponding user message (same index)
                if (currentIndex >= userMessages.length) {
                    logger.error(`[getUserMessage] No matching user message for assistant ${currentIndex}`);
                    return '';
                }

                const userMessage = userMessages[currentIndex] as HTMLElement;

                // Try to extract content using .whitespace-pre-wrap (verified by testing)
                const whitespacePre = userMessage.querySelector('.whitespace-pre-wrap');
                if (whitespacePre) {
                    const text = whitespacePre.textContent?.trim() || '';
                    logger.debug(`[getUserMessage] Extracted ChatGPT user message: ${text.substring(0, 50)}`);
                    return text;
                }

                // Fallback: use direct textContent
                const text = userMessage.textContent?.trim() || '';
                logger.debug(`[getUserMessage] Extracted ChatGPT user message (fallback): ${text.substring(0, 50)}`);
                return text;
            }
        } catch (error) {
            logger.error('[getUserMessage] Exception:', error);
            return '';
        }
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

        if (this.deepResearchHandler) {
            this.deepResearchHandler.disable();
            this.deepResearchHandler = undefined;
        }

        logger.info('Extension stopped');
    }
}

// Initialize and start when DOM is ready
function initExtension() {
    logger.info('Initializing AI-Markdone extension');
    logger.debug('Document readyState:', document.readyState);
    logger.debug('Current URL:', window.location.href);

    let contentScript: ContentScript | null = new ContentScript();
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
                contentScript?.stop();
                contentScript = new ContentScript();
                contentScript.start();
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
