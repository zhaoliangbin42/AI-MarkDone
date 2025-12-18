// CSS is loaded via manifest.json - see content_scripts.css declaration
// This follows Chrome extension best practices for optimal performance

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
import { DarkModeDetector } from '../utils/dark-mode-detector';

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

    // Toolbar references for direct state updates
    private toolbars = new Map<number, Toolbar>();

    // Storage listener for real-time bookmark sync
    private storageListener: ((changes: any, areaName: string) => void) | null = null;

    // Navigation check flag - AITimeline pattern
    private navigationChecked: boolean = false;

    // Track messages being processed to prevent duplicate toolbar injection
    private processingMessages: Set<string> = new Set();
    private processingElements: WeakSet<HTMLElement> = new WeakSet();

    constructor() {
        // Use INFO in production; switch to DEBUG locally when needed
        logger.setLevel(LogLevel.INFO);

        // Initialize components
        this.markdownParser = new MarkdownParser();
        this.mathClickHandler = new MathClickHandler();
        this.reRenderPanel = new ReRenderPanel();

        // Initialize dark mode detector to follow host website theme
        const darkModeDetector = DarkModeDetector.getInstance();
        darkModeDetector.subscribe((isDark) => {
            logger.info(`[DarkMode] Theme changed: ${isDark ? 'dark' : 'light'}`);

            // CRITICAL: Actually apply/remove the 'dark' class to enable our dark mode styles
            if (isDark) {
                document.documentElement.classList.add('dark');
                logger.info('[DarkMode] Applied dark class to <html>');
            } else {
                document.documentElement.classList.remove('dark');
                logger.info('[DarkMode] Removed dark class from <html>');
            }
        });

        logger.info('AI-Markdone initialized');
    }

    /**
     * Start the extension
     */
    async start(): Promise<void> {
        const adapter = adapterRegistry.getAdapter();
        if (!adapter) {
            logger.warn('No adapter found for current site');
            return;
        }

        logger.info('Starting extension on supported page');

        // Create observer and injector
        this.observer = new MessageObserver(
            adapter,
            (messageElement) => {
                this.handleNewMessage(messageElement);
            }
        );
        this.injector = new ToolbarInjector(adapter);

        // Initialize Deep Research handler for Gemini
        if ('isGemini' in adapter && typeof adapter.isGemini === 'function' && adapter.isGemini()) {
            this.deepResearchHandler = new DeepResearchHandler();
            this.deepResearchHandler.enable();

            // Initialize Gemini panel button
            geminiPanelButton.init();
        } else {
            // Initialize ChatGPT page header icon
            pageHeaderIcon.init();
        }

        // Load bookmarks for current page BEFORE starting observer - AITimeline pattern
        // This prevents race condition where messages are processed before bookmarks are loaded
        await this.loadBookmarks();

        // Setup storage listener for real-time bookmark sync
        this.setupStorageListener();

        // Start observing (now that bookmarks are loaded)
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
     * Setup storage listener for real-time bookmark synchronization
     * When bookmarks are added/deleted in Panel, toolbar buttons update automatically
     */
    private setupStorageListener(): void {
        this.storageListener = async (changes, areaName) => {
            if (areaName !== 'local') return;

            // Debug: Log all storage changes with detailed key inspection
            const changedKeys = Object.keys(changes);
            logger.info('[ContentScript] 📦 Storage changed, keys:', changedKeys);

            // Check each key individually for debugging
            logger.info('[ContentScript] 🔍 Checking each key:');
            changedKeys.forEach(key => {
                const startsWithBookmark = key.startsWith('bookmark:');
                logger.info(`[ContentScript]   "${key}" → startsWith('bookmark:'): ${startsWithBookmark}`);
            });

            // Check if any bookmark-related keys changed
            // Storage uses keys like: "bookmark:gemini.google.com/app/abc:3"
            const bookmarkKeysChanged = changedKeys.some(key =>
                key.startsWith('bookmark:')
            );

            logger.info(`[ContentScript] 📊 Result: bookmarkKeysChanged = ${bookmarkKeysChanged}`);

            if (bookmarkKeysChanged) {
                logger.info('[ContentScript] ✅ Bookmark-related keys changed, reloading...');
                logger.info('[ContentScript] 📝 Bookmark keys:', changedKeys.filter(k => k.startsWith('bookmark:')));

                // Reload bookmarked positions for current page
                const oldSize = this.bookmarkedPositions.size;
                await this.loadBookmarks();
                const newSize = this.bookmarkedPositions.size;

                logger.info(`[ContentScript] 🔄 Bookmarks reloaded: ${oldSize} -> ${newSize}`);

                // Update toolbars directly using saved references
                let updatedCount = 0;
                this.toolbars.forEach((toolbar, position) => {
                    const isBookmarked = this.bookmarkedPositions.has(position);
                    toolbar.setBookmarkState(isBookmarked);
                    updatedCount++;
                    logger.info(`[ContentScript] 🔄 Updated toolbar at position ${position}: ${isBookmarked}`);
                });

                // Dispatch custom event for any future toolbars
                window.dispatchEvent(new CustomEvent('aicopy:bookmark-changed', {
                    detail: { positions: Array.from(this.bookmarkedPositions) }
                }));

                logger.info(`[ContentScript] ✅ Updated ${updatedCount} toolbars via direct reference`);
            } else {
                logger.info('[ContentScript] ⏭️  Skipping: no bookmark keys changed');
            }
        };

        chrome.storage.onChanged.addListener(this.storageListener);
        logger.info('[ContentScript] Storage listener setup for bookmark sync');
    }

    /**
     * Update all toolbar bookmark buttons on the page
     * Called when bookmarks change in storage
     */


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

        // Get message ID for tracking
        const adapter = adapterRegistry.getAdapter();
        if (!adapter) return;

        const messageId = adapter.getMessageId(messageElement);
        if (!messageId) {
            logger.warn('Message has no ID, cannot track processing state');

            // Check if this element is already being processed
            if (this.processingElements.has(messageElement)) {
                logger.debug('Element is already being processed (no ID), skipping');
                return;
            }

            // Fallback to DOM check
            const hasToolbar = messageElement.querySelector('.aicopy-toolbar-container');
            if (hasToolbar) {
                logger.debug('Toolbar already exists (no ID), skipping');
                return;
            }

            // Mark element as being processed
            this.processingElements.add(messageElement);
        } else {
            // Check if this message is currently being processed
            if (this.processingMessages.has(messageId)) {
                logger.debug('Message is already being processed, skipping:', messageId);
                return;
            }

            // Mark as being processed
            this.processingMessages.add(messageId);
        }

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
            // Remove from processing set since we're done
            if (messageId) {
                this.processingMessages.delete(messageId);
            }
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

        // Save toolbar reference for direct state updates
        this.toolbars.set(position, toolbar);

        const isBookmarked = this.bookmarkedPositions.has(position);
        toolbar.setBookmarkState(isBookmarked);

        // Enable click-to-copy for math elements
        this.mathClickHandler.enable(messageElement);

        // Remove from processing set after a short delay
        // This ensures the toolbar has time to be injected into DOM
        if (messageId) {
            setTimeout(() => {
                this.processingMessages.delete(messageId);
                logger.info(`[DEBUG] ⏰ Timeout: Removed ${messageId}. Size: ${this.processingMessages.size}`);
            }, 1000); // 1 second should be enough for toolbar injection
        }

        logger.info('=== handleNewMessage END ===');
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
     * Stop the extension and cleanup all resources
     */
    stop(): void {
        logger.info('Stopping extension...');

        // 1. Stop MessageObserver
        if (this.observer) {
            this.observer.stop();
            this.observer = null;
        }

        // 2. Cleanup MathClickHandler (disconnect observers, remove event listeners)
        if (this.mathClickHandler) {
            this.mathClickHandler.disable();
        }

        // 3. Cleanup ToolbarInjector (clear pending timers)
        if (this.injector) {
            this.injector.cleanup();
            this.injector = null;
        }

        // 4. Cleanup DeepResearchHandler
        if (this.deepResearchHandler) {
            this.deepResearchHandler.disable();
            this.deepResearchHandler = undefined;
        }

        // 5. Reset state
        this.bookmarkedPositions.clear();
        this.navigationChecked = false;
        this.processingMessages.clear();

        logger.info('Extension stopped and all resources cleaned up');
    }
}

// ============================================================================
// URL Change Observer - Fix Memory Leak & Performance Issues
// ============================================================================

// Global references for cleanup (prevent memory leaks)
let urlObserver: MutationObserver | null = null;
let reinitTimeout: number | null = null;
let debounceTimeout: number | null = null;

/**
 * Wait for page to be ready by checking for key DOM elements
 * Uses polling with exponential backoff instead of fixed delay
 */
function waitForPageReady(adapter: any): Promise<boolean> {
    return new Promise((resolve) => {
        const maxAttempts = 25; // Max 5 seconds (25 * 200ms)
        let attempts = 0;

        const checkReady = () => {
            attempts++;

            // Check if key elements exist (message container)
            const messageContainer = adapter.getObserverContainer();
            const hasMessages = document.querySelector(adapter.getMessageSelector()) !== null;

            if (messageContainer && hasMessages) {
                logger.debug(`[Navigation] Page ready after ${attempts * 200}ms`);
                resolve(true);
                return;
            }

            // Timeout after max attempts
            if (attempts >= maxAttempts) {
                logger.warn('[Navigation] Page ready timeout, proceeding anyway');
                resolve(false);
                return;
            }

            // Retry with 200ms interval
            setTimeout(checkReady, 200);
        };

        checkReady();
    });
}

/**
 * Handle navigation/URL change
 * Waits for page to be actually ready instead of using fixed delay
 */
function handleNavigation(contentScript: ContentScript | null): ContentScript | null {
    // Clear any pending reinitialization
    if (reinitTimeout !== null) {
        clearTimeout(reinitTimeout);
        logger.debug('[Navigation] Cancelled previous reinit timeout');
    }

    // Use async initialization with page ready detection
    (async () => {
        // Check if user has active UI (modal or panel)
        const hasActiveModal = document.querySelector('.bookmark-save-modal-overlay') !== null;
        const hasActivePanel = document.querySelector('.simple-bookmark-panel-overlay') !== null;

        if (hasActiveModal || hasActivePanel) {
            logger.info('[Navigation] Skipping reinit: user has active UI');
            return;
        }

        // Get adapter to check page readiness
        const adapter = adapterRegistry.getAdapter();
        if (!adapter) {
            logger.error('[Navigation] No adapter found, cannot check page readiness');
            return;
        }

        // Wait for page to be ready (smart wait, not fixed delay)
        logger.debug('[Navigation] Waiting for page to be ready...');
        const isReady = await waitForPageReady(adapter);

        if (!isReady) {
            logger.warn('[Navigation] Page may not be fully ready, but proceeding');
        }

        // Double-check user hasn't opened UI during wait
        const hasActiveModalNow = document.querySelector('.bookmark-save-modal-overlay') !== null;
        const hasActivePanelNow = document.querySelector('.simple-bookmark-panel-overlay') !== null;

        if (hasActiveModalNow || hasActivePanelNow) {
            logger.info('[Navigation] User opened UI during wait, skipping reinit');
            return;
        }

        // Safe to reinitialize
        logger.info('[Navigation] Reinitializing extension');
        contentScript?.stop();
        const newContentScript = new ContentScript();
        await newContentScript.start();

        // Update closure reference
        contentScript = newContentScript;
    })();

    return contentScript;
}

/**
 * Initialize extension and setup URL change detection
 */
function initExtension() {
    logger.info('Initializing AI-Markdone extension');
    logger.debug('Document readyState:', document.readyState);
    logger.debug('Current URL:', window.location.href);

    let contentScript: ContentScript | null = new ContentScript();
    contentScript.start(); // Fire and forget - initial load

    // Disconnect previous observer to prevent memory leak
    if (urlObserver) {
        urlObserver.disconnect();
        logger.debug('[Observer] Disconnected previous URL observer');
    }

    // Setup URL change detection for SPA navigation
    let lastUrl = window.location.href;

    urlObserver = new MutationObserver(() => {
        // Debounce: prevent excessive checks during rapid DOM changes
        if (debounceTimeout !== null) {
            clearTimeout(debounceTimeout);
        }

        debounceTimeout = window.setTimeout(() => {
            const currentUrl = window.location.href;
            if (currentUrl !== lastUrl) {
                lastUrl = currentUrl;
                logger.info('[Observer] URL changed:', currentUrl);
                contentScript = handleNavigation(contentScript);
            }
            debounceTimeout = null;
        }, 100); // 100ms debounce
    });

    // Start observing DOM changes
    urlObserver.observe(document.body, { subtree: true, childList: true });
    logger.debug('[Observer] Started URL change observer');
}

/**
 * Cleanup function - disconnect observer and clear timeouts
 */
function cleanupExtension() {
    if (urlObserver) {
        urlObserver.disconnect();
        urlObserver = null;
        logger.debug('[Cleanup] Disconnected URL observer');
    }

    if (reinitTimeout !== null) {
        clearTimeout(reinitTimeout);
        reinitTimeout = null;
    }

    if (debounceTimeout !== null) {
        clearTimeout(debounceTimeout);
        debounceTimeout = null;
    }

    logger.info('[Cleanup] Extension cleanup complete');
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initExtension);
} else {
    // DOM already loaded, start immediately
    initExtension();
}

// Cleanup on page unload
window.addEventListener('beforeunload', cleanupExtension);
window.addEventListener('pagehide', cleanupExtension);
