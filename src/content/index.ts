import { adapterRegistry } from './adapters/registry';
import { MessageObserver } from './observers/mutation-observer';
import { SelectorMessageObserver } from './observers/selector-message-observer';
import { ToolbarInjector, ToolbarState } from './injectors/toolbar-injector';
import { Toolbar, ToolbarCallbacks } from './components/toolbar';
import { Modal } from './components/modal';
import { MarkdownParser } from './parsers/markdown-parser';
import { MathClickHandler } from './features/math-click';
import { ReaderPanel } from './features/re-render';
import { DeepResearchHandler } from './features/deep-research-handler';
import { logger, LogLevel } from '../utils/logger';
import { browser } from '../utils/browser';
import { SimpleBookmarkStorage } from '../bookmarks/storage/SimpleBookmarkStorage';
import { BookmarkSaveModal } from '../bookmarks/components/BookmarkSaveModal';
import { simpleBookmarkPanel } from '../bookmarks/components/SimpleBookmarkPanel';
import { chatGPTPanelButton } from './components/ChatGPTPanelButton';
import { geminiPanelButton } from './components/GeminiPanelButton';
import { claudePanelButton } from './components/ClaudePanelButton';
import { deepseekPanelButton } from './components/DeepseekPanelButton';
import { ThemeManager, Theme } from '../utils/ThemeManager';
import { eventBus } from './utils/EventBus';
import { collectAllMessages, getConversationMetadata, saveMessagesAsMarkdown, saveMessagesAsPdf } from './features/save-messages';
import { saveMessagesDialog } from './features/SaveMessagesDialog';
import { SettingsManager } from '../settings/SettingsManager';
import { i18n } from '../utils/i18n';
import { isBackgroundToContentMessage, isTrustedBackgroundSender } from './message-guards';
import { DialogManager } from '../components/DialogManager';
import { ChatGPTFoldingController } from './features/chatgpt-folding';
type RuntimeStatus = 'ok' | 'unknown action' | 'untrusted sender';


/**
 * Listen for messages from background script
 */
browser.runtime.onMessage.addListener((request: unknown, sender, sendResponse) => {
    const respond = (status: RuntimeStatus) => sendResponse({ status });
    const runtimeId = browser.runtime?.id;
    if (!isTrustedBackgroundSender(sender, runtimeId)) {
        respond('untrusted sender');
        return true;
    }

    if (isBackgroundToContentMessage(request)) {
        simpleBookmarkPanel.toggle();
        respond('ok');
    } else {
        respond('unknown action');
    }
    return true;
});

/**
 * Main content script controller
 */
class ContentScript {
    private observer: MessageObserver | SelectorMessageObserver | null = null;
    private injector: ToolbarInjector | null = null;
    private markdownParser: MarkdownParser;
    private mathClickHandler: MathClickHandler;
    private reRenderPanel: ReaderPanel;
    private deepResearchHandler?: DeepResearchHandler;
    private chatgptFolding: ChatGPTFoldingController | null = null;

    // Bookmark state tracking (1-indexed positions).
    private bookmarkedPositions: Set<number> = new Set();

    // Toolbar references for direct state updates
    private toolbars = new Map<number, Toolbar>();

    // Storage listener for real-time bookmark sync
    private storageListener: ((changes: any, areaName: string) => void) | null = null;

    private navigationChecked: boolean = false;

    // Track messages being processed to prevent duplicate toolbar injection
    private processingMessages: Set<string> = new Set();
    private processingElements: WeakSet<HTMLElement> = new WeakSet();

    // Track current theme to keep shadow-root tokens in sync
    private currentThemeIsDark: boolean = false;
    private unsubscribeTheme: (() => void) | null = null;

    constructor() {
        logger.setLevel(import.meta.env.DEV ? LogLevel.DEBUG : LogLevel.INFO);

        // Initialize components
        this.markdownParser = new MarkdownParser();
        this.mathClickHandler = new MathClickHandler();
        this.reRenderPanel = new ReaderPanel();

        // Initialize theme manager to follow host website theme
        const themeManager = ThemeManager.getInstance();
        themeManager.init();
        this.currentThemeIsDark = themeManager.isDarkMode();
        this.unsubscribeTheme = themeManager.subscribe((theme: Theme) => {
            logger.info(`[ThemeManager] Theme changed: ${theme}`);
            this.currentThemeIsDark = theme === 'dark';
            this.applyTheme(this.currentThemeIsDark);
        });

        logger.info('AI-MarkDone initialized');
    }

    /**
     * Apply current theme tokens to extension UI elements.
     */
    private applyTheme(isDark: boolean): void {
        this.toolbars.forEach((toolbar) => toolbar.setTheme(isDark));
        this.reRenderPanel.setTheme(isDark);
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

        // Check platform settings: is this platform enabled?
        const platformSettings = await SettingsManager.getInstance().get('platforms');
        const platformName = adapter.getPlatformName().toLowerCase();
        const platformKey = platformName as keyof typeof platformSettings;

        if (platformSettings[platformKey] === false) {
            logger.info(`[ContentScript] Platform "${platformName}" is disabled in settings, skipping initialization`);
            return;
        }

        logger.info('Starting extension on supported page');

        // Initialize i18n before creating any components
        await i18n.init();

        // ChatGPT long-chat folding / performance helpers (low intrusion)
        const platformNameRaw = adapter.getPlatformName();
        if (platformNameRaw === 'ChatGPT') {
            this.chatgptFolding = new ChatGPTFoldingController();
            await this.chatgptFolding.init(adapter);
        }

        // Create injector first (needed by observer)
        this.injector = new ToolbarInjector(adapter);

        // Create observer with injector dependency

        if (platformNameRaw === 'ChatGPT') {
            this.observer = new SelectorMessageObserver(
                adapter,
                this.injector,
                (messageElement) => {
                    this.handleNewMessage(messageElement);
                }
            );
        } else {
            this.observer = new MessageObserver(
                adapter,
                this.injector,
                (messageElement) => {
                    this.handleNewMessage(messageElement);
                }
            );
        }

        // Initialize platform-specific panel buttons
        if ('isGemini' in adapter && typeof adapter.isGemini === 'function' && adapter.isGemini()) {
            // Initialize Gemini panel button
            geminiPanelButton.init();

            // Initialize Deep Research handler for panel button injection
            this.deepResearchHandler = new DeepResearchHandler(
                (messageElement) => this.showReRenderPanel(messageElement)
            );
            this.deepResearchHandler.enable();
        } else if (platformNameRaw === 'Claude') {
            // Initialize Claude panel button
            claudePanelButton.init();
        } else if (platformNameRaw === 'Deepseek') {
            // Initialize Deepseek panel button
            deepseekPanelButton.init();
        } else {
            // Initialize ChatGPT page header icon
            chatGPTPanelButton.init();
        }

        // Why: load bookmarks before observing to avoid processing messages with stale bookmark state.
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

            const changedKeys = Object.keys(changes);
            logger.debug('[ContentScript] Storage changed', { changedKeyCount: changedKeys.length });

            // Check if any bookmark-related keys changed
            // Storage uses keys like: "bookmark:gemini.google.com/app/abc:3"
            const bookmarkKeysChanged = changedKeys.some(key =>
                key.startsWith('bookmark:')
            );

            if (bookmarkKeysChanged) {
                // Reload bookmarked positions for current page
                const oldSize = this.bookmarkedPositions.size;
                await this.loadBookmarks();
                const newSize = this.bookmarkedPositions.size;

                logger.debug('[ContentScript] Bookmarks reloaded', { oldSize, newSize });

                // Update toolbars directly using saved references
                let updatedCount = 0;
                this.toolbars.forEach((toolbar, position) => {
                    const isBookmarked = this.bookmarkedPositions.has(position);
                    toolbar.setBookmarkState(isBookmarked);
                    updatedCount++;
                });

                // Dispatch custom event for any future toolbars
                window.dispatchEvent(new CustomEvent('aicopy:bookmark-changed', {
                    detail: { positions: Array.from(this.bookmarkedPositions) }
                }));

                logger.debug('[ContentScript] Updated toolbars from storage change', { updatedCount });
            }
        };

        browser.storage.onChanged.addListener(this.storageListener);
        logger.info('[ContentScript] Storage listener setup for bookmark sync');
    }

    /**
     * Update all toolbar bookmark buttons on the page
     * Called when bookmarks change in storage
     */


    /**
     * Check for cross-page bookmark navigation.
     */
    private async checkBookmarkNavigation(): Promise<void> {
        await simpleBookmarkPanel.checkNavigationTarget();
    }

    /**
     * Handle new message detected
     */
    private handleNewMessage(messageElement: HTMLElement): void {
        logger.debug('Handling new message');

        // Get adapter
        const adapter = adapterRegistry.getAdapter();
        if (!adapter) return;

        this.chatgptFolding?.registerMessage(messageElement);

        const isArticle = messageElement.tagName.toLowerCase() === 'article';
        const isModelResponse = messageElement.tagName.toLowerCase() === 'model-response';

        // Helper to check action bar with multi-selector support
        const hasActionBar = (isArticle || isModelResponse)
            ? messageElement.querySelector(adapter.getActionBarSelector()) !== null
            : true;



        // Get message ID for tracking
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

        // Why: check navigation target once after the first message is detected.
        if (!this.navigationChecked) {
            this.navigationChecked = true;
            logger.info('[ContentScript] First message detected, checking bookmark navigation');
            this.checkBookmarkNavigation();
        }

        // CRITICAL: Check if toolbar already exists BEFORE creating new one
        // This prevents creating orphaned toolbar objects with wrong messageElement bindings
        const existingToolbarContainer = messageElement.querySelector('.aicopy-toolbar-container');
        if (existingToolbarContainer) {
            logger.debug('Toolbar already exists, checking state');

            // 🔑 FIX: Activate toolbar if it was injected but not yet visible
            // This happens when streaming completes (Copy button triggers re-detection)
            if (this.injector) {
                const currentState = this.injector.getState(messageElement);
                if (currentState === ToolbarState.INJECTED) {
                    // During streaming ChatGPT can lay out the message container differently, causing
                    // the toolbar to appear at the far-right of the page. Keep the wrapper hidden
                    // until the official action bar (Copy button area) exists for this message.
                    const isStreaming = adapter.isStreamingMessage && adapter.isStreamingMessage(messageElement);
                    if (!isStreaming && hasActionBar) {
                        logger.debug('[toolbar] Existing toolbar in INJECTED state, reconciling + activating now');
                        this.injector.reconcileToolbarPosition(messageElement);
                        const activated = this.injector.activate(messageElement);
                        if (activated) {
                            const existingToolbar = (existingToolbarContainer as any).__toolbar;
                            if (existingToolbar && typeof existingToolbar.setPending === 'function') {
                                existingToolbar.setPending(false);
                            }
                        }
                    } else {
                        logger.debug(`[toolbar] Existing toolbar still pending. Streaming=${isStreaming}, HasActionBar=${hasActionBar}`);
                    }
                }
            }

            const existingToolbar = (existingToolbarContainer as any).__toolbar;
            if (hasActionBar && existingToolbar && typeof existingToolbar.setPending === 'function') {
                logger.debug(`[WordCountDebug] Existing toolbar found. Updating pending state to false (ActionBar exists)`);
                existingToolbar.setPending(false);
            }
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
            },
            onSaveMessages: () => {
                this.handleSaveMessages();
            },
        };

        const toolbar = new Toolbar(callbacks);
        toolbar.setTheme(this.currentThemeIsDark);
        if (!hasActionBar || adapter.isStreamingMessage(messageElement)) {
            logger.debug(`[WordCountDebug] Setting new toolbar to pending. NoActionBar=${!hasActionBar}, IsStreaming=${adapter.isStreamingMessage(messageElement)}`);
            toolbar.setPending(true);
        }

        // Inject toolbar
        if (this.injector) {
            const injected = this.injector.inject(messageElement, toolbar.getElement());

            // 🔑 FIX: Activate immediately for non-streaming messages
            // Streaming messages will be activated when Copy button appears
            if (injected) {
                const isStreaming = adapter.isStreamingMessage && adapter.isStreamingMessage(messageElement);
                if (!isStreaming && hasActionBar) {
                    const activated = this.injector.activate(messageElement);
                    if (activated) {
                        logger.debug('[toolbar] Non-streaming message: activated immediately');
                        toolbar.setPending(false);
                    }
                }
            }
        }

        // Store toolbar reference on container for later access
        const toolbarContainer = messageElement.querySelector('.aicopy-toolbar-container');
        if (toolbarContainer) {
            (toolbarContainer as any).__toolbar = toolbar;
        }

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
            }, 1000); // 1 second should be enough for toolbar injection
        }

        // Emit event for pagination update
        const adapter2 = adapterRegistry.getAdapter();
        if (adapter2) {
            const messageSelector = adapter2.getMessageSelector();
            const allMessages = document.querySelectorAll(messageSelector);
            eventBus.emit('message:new', { count: allMessages.length });
            // Notify ReaderPanel trigger button state.
            eventBus.emit('message:complete', { count: allMessages.length });
        }
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

        // Check if this is a Deep Research message (Gemini-specific)
        // If the Deep Research panel is open, extract content from there
        if ('isDeepResearchMessage' in adapter &&
            typeof adapter.isDeepResearchMessage === 'function' &&
            adapter.isDeepResearchMessage(messageElement)) {

            logger.debug('[getMarkdown] Deep Research message detected');

            // Try to get content from the open panel
            if ('getDeepResearchContent' in adapter &&
                typeof adapter.getDeepResearchContent === 'function') {
                const panelContent = adapter.getDeepResearchContent();
                if (panelContent) {
                    logger.info('[getMarkdown] Extracting from Deep Research panel');
                    return this.markdownParser.parse(panelContent);
                }
            }

            // Panel not open - fall through to regular extraction
            logger.debug('[getMarkdown] Deep Research panel not open, using regular extraction');
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
        // Why: reuse the existing copy pipeline by passing `getMarkdown`.
        this.reRenderPanel.show(
            messageElement,
            (el: HTMLElement) => this.getMarkdown(el)
        );
    }

    /**
     * Handle save messages button click
     * Opens save messages dialog for message selection
     */
    private handleSaveMessages(): void {
        const adapter = adapterRegistry.getAdapter();
        if (!adapter) {
            logger.error('[AI-MarkDone][ContentScript] No adapter found for save messages');
            return;
        }

        // Collect all messages using MarkdownParser for content extraction
        const turns = collectAllMessages(adapter, this.markdownParser);

        if (turns.length === 0) {
            logger.warn('[AI-MarkDone][ContentScript] No messages found to save');
            return;
        }

        // Get conversation metadata
        const metadata = getConversationMetadata(adapter, turns.length);

        // Open save messages dialog with callback
        saveMessagesDialog.open(turns, metadata, async (selectedIndices, format) => {
            if (format === 'markdown') {
                await saveMessagesAsMarkdown(turns, selectedIndices, metadata);
            } else {
                await saveMessagesAsPdf(turns, selectedIndices, metadata);
            }
        });
    }

    /**
     * Handle bookmark toggle.
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
                    logger.info('[handleBookmark] User message extracted');

                    if (!userMessage) {
                        logger.error('[handleBookmark] Failed to extract user message');
                        await DialogManager.alert({
                            title: i18n.t('bookmark'),
                            message: i18n.t('failedToExtractUserMessage')
                        });
                        return;
                    }

                    // Detect platform using adapter's getPlatformName()
                    const adapter = adapterRegistry.getAdapter();
                    const platform = adapter?.getPlatformName() || 'ChatGPT';

                    // Get AI response markdown (use parsed markdown, not plain text)
                    const aiResponse = this.getMarkdown(messageElement);
                    logger.info('[handleBookmark] AI response extracted');

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
                    await DialogManager.alert({
                        title: i18n.t('bookmark'),
                        message: i18n.t('failedToPrepareBookmark')
                    });
                }
            }
        } catch (error) {
            logger.error('[handleBookmark] Failed to toggle bookmark:', error);
            await DialogManager.alert({
                title: i18n.t('bookmark'),
                message: i18n.t('failedToToggleBookmark') + ': ' + (error instanceof Error ? error.message : String(error))
            });
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
     * 
     * Strategy: Use adapter.extractUserPrompt() as the primary method.
     * Each adapter implements its own DOM traversal logic.
     * Falls back to legacy platform-specific logic if adapter returns null.
     */
    private getUserMessage(messageElement: HTMLElement): string {
        try {
            const adapter = adapterRegistry.getAdapter();
            if (!adapter) {
                logger.error('[getUserMessage] No adapter found');
                return '';
            }

            // Primary: Use adapter's extractUserPrompt method (works for all platforms)
            const userPrompt = adapter.extractUserPrompt(messageElement);
            if (userPrompt) {
                logger.debug('[getUserMessage] Extracted via adapter');
                return userPrompt;
            }

            // Fallback: Legacy platform-specific logic for Gemini and ChatGPT
            if ('isGemini' in adapter && typeof adapter.isGemini === 'function' && adapter.isGemini()) {
                logger.debug('[getUserMessage] Gemini fallback mode');

                let userPrompts = Array.from(document.querySelectorAll('[data-test-id="user-query"]'));
                if (userPrompts.length === 0) {
                    userPrompts = Array.from(document.querySelectorAll('user-query, .user-query'));
                }

                const aiResponses = Array.from(document.querySelectorAll('model-response'));

                if (userPrompts.length === 0) {
                    logger.error('[getUserMessage] No user prompts found in Gemini');
                    return '';
                }

                const currentAiIndex = aiResponses.indexOf(messageElement);
                if (currentAiIndex < 0 || currentAiIndex >= userPrompts.length) {
                    logger.error('[getUserMessage] Cannot match AI response to user prompt');
                    return '';
                }

                const prompt = userPrompts[currentAiIndex] as HTMLElement;
                return prompt.textContent?.trim() || '';
            }

            // ChatGPT fallback
            logger.debug('[getUserMessage] ChatGPT fallback mode');
            const userMessages = Array.from(document.querySelectorAll('[data-message-author-role="user"]'));
            const assistantMessages = Array.from(document.querySelectorAll('[data-message-author-role="assistant"]'));

            let currentIndex = assistantMessages.indexOf(messageElement);
            if (currentIndex < 0) {
                const assistantInside = messageElement.querySelector('[data-message-author-role="assistant"]');
                if (assistantInside) {
                    currentIndex = assistantMessages.indexOf(assistantInside as Element);
                }
            }

            if (currentIndex < 0 || currentIndex >= userMessages.length) {
                logger.error('[getUserMessage] Cannot match assistant to user message');
                return '';
            }

            const userMessage = userMessages[currentIndex] as HTMLElement;
            const whitespacePre = userMessage.querySelector('.whitespace-pre-wrap');
            return (whitespacePre?.textContent || userMessage.textContent)?.trim() || '';
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

        // 0. Unsubscribe listeners first to prevent callbacks during teardown.
        if (this.unsubscribeTheme) {
            this.unsubscribeTheme();
            this.unsubscribeTheme = null;
        }
        if (this.storageListener) {
            try {
                browser.storage.onChanged.removeListener(this.storageListener);
            } catch {
                // ignore
            }
            this.storageListener = null;
        }

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

        // 4.1 Cleanup ChatGPT folding controller
        if (this.chatgptFolding) {
            this.chatgptFolding.dispose();
            this.chatgptFolding = null;
        }

        // 5. Reset state
        this.bookmarkedPositions.clear();
        this.navigationChecked = false;
        this.processingMessages.clear();
        this.processingElements = new WeakSet<HTMLElement>();

        // 6. Destroy toolbars and remove injected DOM
        this.toolbars.forEach((toolbar) => {
            try {
                toolbar.destroy();
            } catch {
                // ignore
            }
        });
        this.toolbars.clear();
        document.querySelectorAll('.aicopy-toolbar-wrapper').forEach((el) => el.remove());

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
let lastUrl: string = window.location.href;
let navVersion = 0;
let routeListenersAttached = false;

// Single source of truth for the active content script instance.
// This prevents "multiple start, missing stop" issues across SPA navigations.
let activeContentScript: ContentScript | null = null;

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
function handleNavigation(): void {
    const currentVersion = ++navVersion;
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

        if (currentVersion !== navVersion) {
            logger.info('[Navigation] Navigation superseded, aborting reinit');
            return;
        }

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

        if (currentVersion !== navVersion) {
            logger.info('[Navigation] Navigation superseded after UI check, aborting reinit');
            return;
        }

        // Safe to reinitialize
        logger.info('[Navigation] Reinitializing extension');

        // Always stop the *actual* active instance (single source of truth)
        activeContentScript?.stop();
        activeContentScript = new ContentScript();
        await activeContentScript.start();
    })();
}

/**
 * Initialize extension and setup URL change detection
 */
function initExtension() {
    logger.info('Initializing AI-MarkDone extension');
    logger.debug('Document readyState:', document.readyState);
    logger.debug('Current URL:', window.location.href);

    activeContentScript = new ContentScript();

    const safeStart = async (): Promise<void> => {
        if (!activeContentScript) {
            activeContentScript = new ContentScript();
        }
        try {
            await activeContentScript.start();
        } catch (err) {
            // If start() throws (unhandled async error), the whole extension can silently die.
            // Retry once with a fresh instance to recover from transient SPA / extension-context issues.
            logger.error('[Init] ContentScript.start() failed, retrying with fresh instance:', err);
            try {
                activeContentScript.stop();
            } catch {
                // ignore
            }
            activeContentScript = new ContentScript();
            try {
                await activeContentScript.start();
            } catch (err2) {
                logger.error('[Init] Retry ContentScript.start() failed:', err2);
            }
        }
    };

    // Initial load
    void safeStart();

    const handleUrlChange = () => {
        const currentUrl = window.location.href;
        if (currentUrl !== lastUrl) {
            lastUrl = currentUrl;
            logger.info('[Observer] URL changed:', currentUrl);
            handleNavigation();
        }
    };

    const attachRouteListeners = () => {
        if (routeListenersAttached) return;
        routeListenersAttached = true;

        const originalPushState = history.pushState;
        const originalReplaceState = history.replaceState;

        history.pushState = function (...args) {
            originalPushState.apply(this, args as any);
            setTimeout(handleUrlChange, 0);
        };

        history.replaceState = function (...args) {
            originalReplaceState.apply(this, args as any);
            setTimeout(handleUrlChange, 0);
        };

        window.addEventListener('popstate', handleUrlChange);
        window.addEventListener('hashchange', handleUrlChange);
    };

    // Disconnect previous observer to prevent memory leak
    if (urlObserver) {
        urlObserver.disconnect();
        logger.debug('[Observer] Disconnected previous URL observer');
    }

    // Setup URL change detection for SPA navigation
    attachRouteListeners();

    urlObserver = new MutationObserver(() => {
        // Debounce: prevent excessive checks during rapid DOM changes
        if (debounceTimeout !== null) {
            clearTimeout(debounceTimeout);
        }

        debounceTimeout = window.setTimeout(() => {
            handleUrlChange();
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

    if (activeContentScript) {
        try {
            activeContentScript.stop();
        } catch {
            // ignore
        }
        activeContentScript = null;
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
