import { MarkdownRenderer } from '@/renderer/core/MarkdownRenderer';
import { StyleManager } from '@/renderer/styles/StyleManager';
import { LRUCache } from '@/renderer/utils/LRUCache';
import { MessageCollector } from '../utils/MessageCollector';
import { TooltipManager, tooltipStyles } from '../utils/TooltipManager';
import { DotPaginationController } from '../utils/DotPaginationController';
import { NavigationButtonsController } from '../utils/NavigationButtonsController';
import { readerPanelStyles } from '../utils/ReaderPanelStyles';
import { floatingInputStyles } from '../utils/FloatingInputStyles';
import { FloatingInput } from '../components/FloatingInput';
import { MessageSender } from './MessageSender';
import { adapterRegistry } from '../adapters/registry';
import { Icons } from '../../assets/icons';
import { DesignTokens } from '../../utils/design-tokens';
import { logger } from '../../utils/logger';
import { ReaderItem, resolveContent } from '../types/ReaderTypes';
import { collectFromLivePage, getMessageRefs } from '../datasource/LivePageDataSource';
import { eventBus } from '../utils/EventBus';
import { MarkdownParser } from '../parsers/markdown-parser';
import { StreamingDetector } from '../adapters/streaming-detector';
import { SettingsManager } from '../../settings/SettingsManager';
import { SimpleBookmarkStorage } from '../../bookmarks/storage/SimpleBookmarkStorage';
import { BookmarkSaveModal } from '../../bookmarks/components/BookmarkSaveModal';

type GetMarkdownFn = (element: HTMLElement) => string;

/**
 * Reader Panel - a generic Markdown reader.
 *
 * Principles:
 * - Data-driven: accepts `ReaderItem[]`.
 * - Decoupled: does not care whether data comes from DOM or storage.
 * - Lazy-friendly: content may be provided as a function.
 */
export interface ReaderPanelOptions {
    hideTriggerButton?: boolean;
}

export class ReaderPanel {
    private container: HTMLElement | null = null;
    private shadowRoot: ShadowRoot | null = null;
    private currentThemeIsDark: boolean = false;
    private items: ReaderItem[] = [];
    private currentIndex: number = 0;
    private cache: LRUCache<number, string> = new LRUCache(10);

    // Modular components
    private tooltipManager: TooltipManager | null = null;
    private paginationController: DotPaginationController | null = null;
    private navButtonsController: NavigationButtonsController | null = null;
    private keyHandler: ((e: KeyboardEvent) => void) | null = null;
    private getMarkdownFn: GetMarkdownFn | null = null;
    private fallbackParser: MarkdownParser | null = null;

    // Message sending UI components
    private floatingInput: FloatingInput | null = null;
    private triggerBtn: HTMLButtonElement | null = null;
    private isSending: boolean = false;
    private messageSender: MessageSender | null = null;

    // EventBus subscription cleanup
    private unsubscribeNewMessage: (() => void) | null = null;

    // Bookmark state for pagination indicators
    private bookmarkedPositions: Set<number> = new Set();

    // Configuration options
    private options: ReaderPanelOptions;

    constructor(options: ReaderPanelOptions = {}) {
        this.options = options;
    }

    /**
     * Public entry: accepts normalized `ReaderItem[]`.
     *
     * @param items - Reader items to display
     * @param startIndex - Initial index to show
     */
    async showWithData(items: ReaderItem[], startIndex: number = 0): Promise<void> {
        const startTime = performance.now();
        logger.debug('[ReaderPanel] START showWithData');

        this.hide();
        this.items = items;

        if (this.items.length === 0) {
            logger.warn('[ReaderPanel] No items to display');
            return;
        }

        this.currentIndex = Math.max(0, Math.min(startIndex, this.items.length - 1));
        logger.debug(`[ReaderPanel] currentIndex: ${this.currentIndex}/${this.items.length}`);

        // Load bookmarked positions before creating panel
        await this.loadBookmarkedPositions();

        await this.createPanel();

        // Update bookmark button state for current message (position is 1-indexed)
        this.updateBookmarkButtonState(this.bookmarkedPositions.has(this.currentIndex + 1));

        logger.debug(`[ReaderPanel] END showWithData: ${(performance.now() - startTime).toFixed(2)}ms`);
    }

    /**
     * Compat layer for legacy call sites.
     *
     * @deprecated Prefer `showWithData()`.
     */
    async show(messageElement: HTMLElement, getMarkdown: GetMarkdownFn): Promise<void> {
        const startTime = performance.now();
        logger.debug('[ReaderPanel] START show (compat layer)');

        // Save strategy for dynamic updates
        this.getMarkdownFn = getMarkdown;

        const items = collectFromLivePage(getMarkdown);

        if (items.length === 0) {
            logger.warn('[ReaderPanel] No messages found');
            return;
        }

        const messageRefs = getMessageRefs();
        let startIndex = MessageCollector.findMessageIndex(messageElement, messageRefs);
        if (startIndex === -1) {
            startIndex = items.length - 1;
        }

        logger.debug(`[ReaderPanel] Compat layer prepared ${items.length} items in ${(performance.now() - startTime).toFixed(2)}ms`);

        return this.showWithData(items, startIndex);
    }

    /**
     * Hide panel and cleanup.
     */
    hide(): void {
        this.container?.remove();
        this.container = null;
        this.shadowRoot = null;
        this.cache.clear();

        this.tooltipManager?.destroy();
        this.tooltipManager = null;

        this.paginationController?.destroy();
        this.paginationController = null;

        this.navButtonsController?.destroy();
        this.navButtonsController = null;

        this.floatingInput?.destroy();
        this.floatingInput = null;
        this.triggerBtn = null;
        this.isSending = false;
        this.messageSender?.destroy();
        this.messageSender = null;
        // Do NOT clear getMarkdownFn here, as hide() is called just before show()
        // If we clear it, showWithData might lose access if it relies on persistent fn
        // this.getMarkdownFn = null;

        if (this.keyHandler) {
            document.removeEventListener('keydown', this.keyHandler);
            this.keyHandler = null;
        }

        this.unsubscribeNewMessage?.();
        this.unsubscribeNewMessage = null;
    }

    /**
     * Unified sync path: data -> state -> UI side effects.
     */
    private syncUIWithData(newItems: ReaderItem[]): void {
        const oldLength = this.items.length;
        const newLength = newItems.length;

        // 1. Data Desync Fix: Update Source of Truth
        logger.debug(`[ReaderPanel] syncUIWithData: updating items ${this.items.length} -> ${newItems.length}`);
        this.items = newItems;

        // 2. Pagination Update (Visual)
        // DotPaginationController handles re-rendering internally
        this.paginationController?.updateTotalItems(newLength);

        // 3. Navigation Buttons Update (Enable/Disable based on current position)
        this.navButtonsController?.updateConfig({
            canGoPrevious: this.currentIndex > 0,
            canGoNext: this.currentIndex < newLength - 1
        });

        // 4. Side Effects Restoration (Tooltips)
        // Re-bind tooltips to new elements
        this.setupTooltips();

        // 5. Notify User
        if (newLength > oldLength) {
            logger.info(`[ReaderPanel] Synced UI: ${oldLength} -> ${newLength} items`);
        }
    }

    /**
     * Refresh items (used for real-time pagination updates).
     */
    /**
     * Get Markdown from message element via ContentScript linkage
     * Note: This is a fallback if getMarkdownFn is missing.
     * ideally we should depend on the one passed in show()
     */
    private getMarkdown(messageElement: HTMLElement): string {
        // Lazy instantiate parser if needed
        if (!this.fallbackParser) {
            this.fallbackParser = new MarkdownParser();
        }
        return this.fallbackParser.parse(messageElement);
    }

    private async refreshItems(force: boolean = false): Promise<void> {
        if (!this.getMarkdownFn) {
            logger.warn('[ReaderPanel] Cannot refresh: missing getMarkdownFn');
            return;
        }

        // 1. Re-collect Data (To ensure correct length and IDs)
        const adapter = adapterRegistry.getAdapter();
        if (!adapter) return;

        // Optimization: Quick check count first ?
        // But collecting is fast (DOM scan), so we just collect to be safe
        // Or wait, MessageCollector.collectMessages() scans all.
        // Let's just run collection.
        // If no external parser fn provided, fallback to internal method if possible
        const fn = this.getMarkdownFn || ((el: HTMLElement) => this.getMarkdown(el));
        const newItems = collectFromLivePage(fn);
        logger.debug(`[ReaderPanel] refreshItems: collected ${newItems.length} items (current: ${this.items.length})`);

        if (newItems.length === this.items.length && !force) {
            logger.debug('[ReaderPanel] refreshItems: no count change, skipping update');
            return;
        }

        logger.info(`[ReaderPanel] New messages detected: ${this.items.length} -> ${newItems.length}`);

        // 2. Execute Unified Update
        this.syncUIWithData(newItems);
    }

    /**
     * Set theme (used to select token set for Shadow DOM).
     */
    setTheme(isDark: boolean): void {
        this.currentThemeIsDark = isDark;
        if (this.container) {
            this.container.dataset.theme = isDark ? 'dark' : 'light';
        }
    }

    /**
     * Create panel (Shadow DOM).
     */
    private async createPanel(): Promise<void> {
        this.container = document.createElement('div');
        this.container.dataset.theme = this.currentThemeIsDark ? 'dark' : 'light';

        this.shadowRoot = this.container.attachShadow({ mode: 'open' });

        await StyleManager.injectStyles(this.shadowRoot);

        const tokenStyle = document.createElement('style');
        tokenStyle.id = 'design-tokens';
        tokenStyle.textContent = `:host { ${DesignTokens.getCompleteTokens(this.currentThemeIsDark)} }`;
        this.shadowRoot.insertBefore(tokenStyle, this.shadowRoot.firstChild);

        const styleEl = document.createElement('style');
        styleEl.textContent = readerPanelStyles + tooltipStyles + floatingInputStyles;
        this.shadowRoot.appendChild(styleEl);

        const overlay = this.createOverlay();
        const panel = this.createPanelElement();

        this.shadowRoot.appendChild(overlay);
        this.shadowRoot.appendChild(panel);
        document.body.appendChild(this.container);

        await this.renderMessage(this.currentIndex);

        this.setupKeyboardNavigation(panel);

        panel.focus();

        this.unsubscribeNewMessage = eventBus.on<{ count: number }>('message:new', ({ count }) => {
            logger.debug(`[ReaderPanel] EventBus received 'message:new', count: ${count}, current items: ${this.items.length}`);
            if (count !== this.items.length) {
                logger.info(`[ReaderPanel] New message event detected change: ${this.items.length} -> ${count}`);
                this.refreshItems();
            } else {
                logger.debug('[ReaderPanel] Event count matches current items, checking anyway');
                this.refreshItems();
            }
        });
    }

    /**
     * Create overlay.
     */
    private createOverlay(): HTMLElement {
        const overlay = document.createElement('div');
        overlay.className = 'aicopy-panel-overlay';
        overlay.addEventListener('click', () => this.hide());
        return overlay;
    }

    /**
     * Create main panel element.
     */
    private createPanelElement(): HTMLElement {
        const panel = document.createElement('div');
        panel.className = 'aicopy-panel';
        panel.setAttribute('tabindex', '0');
        panel.addEventListener('click', (e) => e.stopPropagation());

        // Header
        panel.appendChild(this.createHeader());

        // Body
        const body = document.createElement('div');
        body.className = 'aicopy-panel-body';
        body.id = 'panel-body';
        panel.appendChild(body);

        // Pagination
        panel.appendChild(this.createPagination());

        return panel;
    }

    /**
     * Create header.
     */
    private createHeader(): HTMLElement {
        const header = document.createElement('div');
        header.className = 'aicopy-panel-header';
        header.innerHTML = `
            <div class="aicopy-panel-header-left">
                <h2 class="aicopy-panel-title">AI-Markdone Reader</h2>
                <div class="aicopy-header-actions">
                    <button class="aicopy-panel-btn" id="fullscreen-btn" title="Toggle fullscreen">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"></path>
                        </svg>
                    </button>
                    <button class="aicopy-panel-btn" id="bookmark-btn" title="Bookmark">
                        ${Icons.bookmark}
                    </button>
                    <button class="aicopy-panel-btn" id="copy-btn" title="Copy Markdown">
                        ${Icons.copy}
                    </button>
                    <button class="aicopy-panel-btn" id="source-btn" title="View Source">
                        ${Icons.code}
                    </button>
                </div>
            </div>
            <button class="aicopy-panel-btn" id="close-btn" title="Close">×</button>
        `;

        header.querySelector('#close-btn')?.addEventListener('click', () => this.hide());
        header.querySelector('#fullscreen-btn')?.addEventListener('click', () => this.toggleFullscreen());
        header.querySelector('#bookmark-btn')?.addEventListener('click', () => this.handleReaderBookmark());
        header.querySelector('#copy-btn')?.addEventListener('click', () => this.handleReaderCopyMarkdown());
        header.querySelector('#source-btn')?.addEventListener('click', () => this.handleReaderViewSource());

        return header;
    }

    /**
     * Create pagination controls (structurally isolated).
     */
    private createPagination(): HTMLElement {
        // STRICT AUDIT: Structural Isolation Pattern
        // ReaderPanel explicitly constructs the layout skeleton.
        const paginationContainer = document.createElement('div');
        paginationContainer.className = 'aicopy-pagination';

        logger.debug(`[ReaderPanel] Creating pagination for ${this.items.length} items`);

        // 1. Trigger Area (Created via existing method)
        // Note: The Trigger is complex (floating input etc), so we keep creating it via helper
        // ✨ FEATURE: Conditionally render based on options
        if (!this.options.hideTriggerButton) {
            const triggerWrapper = this.createMessageTriggerButton();
            paginationContainer.appendChild(triggerWrapper);
        }

        // 2. Navigation Left
        const leftBtn = document.createElement('button');
        leftBtn.className = 'aicopy-nav-button aicopy-nav-button-left';
        leftBtn.innerHTML = '◀';
        leftBtn.setAttribute('aria-label', 'Previous message'); // Accessibility
        leftBtn.disabled = true; // Initial state

        // 3. Dots Container (Dedicated Isolation Zone)
        const dotsContainer = document.createElement('div');
        dotsContainer.className = 'aicopy-pagination-dots-container';

        // 4. Navigation Right
        const rightBtn = document.createElement('button');
        rightBtn.className = 'aicopy-nav-button aicopy-nav-button-right';
        rightBtn.innerHTML = '▶';
        rightBtn.setAttribute('aria-label', 'Next message');
        rightBtn.disabled = true;

        // 5. Hint
        const hint = document.createElement('span');
        hint.className = 'aicopy-keyboard-hint';
        hint.textContent = '"← →" to navigate';

        // Assemble Skeleton (Explicit Order)
        paginationContainer.appendChild(leftBtn);
        paginationContainer.appendChild(dotsContainer);
        paginationContainer.appendChild(rightBtn);
        paginationContainer.appendChild(hint);

        // --- Controller Initialization ---

        // 1. DotPaginationController (Inject Dedicated Container)
        this.paginationController = new DotPaginationController(dotsContainer, {
            totalItems: this.items.length,
            currentIndex: this.currentIndex,
            onNavigate: (index) => this.navigateTo(index),
            bookmarkedPositions: this.bookmarkedPositions
        });
        this.paginationController.render();

        // 2. NavigationButtonsController (Inject Buttons + Defensive Check)
        if (!leftBtn || !rightBtn) {
            throw new Error('[ReaderPanel] Critical: Navigation buttons not created');
        }

        this.navButtonsController = new NavigationButtonsController(
            leftBtn,
            rightBtn,
            {
                onPrevious: () => {
                    if (this.currentIndex > 0) {
                        this.navigateTo(this.currentIndex - 1);
                    }
                },
                onNext: () => {
                    if (this.currentIndex < this.items.length - 1) {
                        this.navigateTo(this.currentIndex + 1);
                    }
                },
                canGoPrevious: this.currentIndex > 0,
                canGoNext: this.currentIndex < this.items.length - 1
            }
        );
        this.navButtonsController.render();

        // 3. Tooltips Setup (Unified Logic)
        this.setupTooltips();

        return paginationContainer;
    }

    /**
     * Create the message-sending trigger button (FloatingInput + send flow).
     */
    private createMessageTriggerButton(): HTMLElement {
        const wrapper = document.createElement('div');
        wrapper.className = 'aimd-trigger-btn-wrapper';

        this.triggerBtn = document.createElement('button');
        this.triggerBtn.className = 'aimd-trigger-btn';
        this.triggerBtn.title = 'Send message';
        this.triggerBtn.innerHTML = Icons.messageSquareText;

        const adapter = adapterRegistry.getAdapter();
        if (adapter) {
            this.messageSender = new MessageSender({ adapter });
        } else {
            logger.warn('[ReaderPanel] No adapter found for MessageSender');
        }

        this.floatingInput = new FloatingInput({
            onSend: async (text) => {
                logger.debug('[ReaderPanel] Send clicked:', text.substring(0, 50));
                this.floatingInput?.hide();
                this.setTriggerButtonState('waiting');

                if (this.messageSender) {
                    const success = await this.messageSender.send(text);
                    logger.debug('[ReaderPanel] Send result:', success);
                }

                // Why: use the same streaming completion signal as the toolbar (copy button appears).
                const adapter = adapterRegistry.getAdapter();
                if (adapter) {
                    const watcher = new StreamingDetector(adapter);
                    const stopWatching = watcher.startWatching(() => {
                        logger.info('[ReaderPanel] Streaming complete detected via StreamingDetector');
                        this.setTriggerButtonState('default');
                    });

                    // Safety net: stop watching after 30s.
                    setTimeout(() => {
                        stopWatching();
                        this.setTriggerButtonState('default');
                    }, 30000);
                } else {
                    // No adapter: fallback to a short timeout.
                    setTimeout(() => {
                        this.setTriggerButtonState('default');
                    }, 5000);
                }
            },
            onCollapse: (text) => {
                logger.debug('[ReaderPanel] FloatingInput collapsed, text length:', text.length);
                // Sync to the native input to keep host UI consistent.
                if (text.trim() && this.messageSender) {
                    this.messageSender.forceSyncToNative(text);
                }
            },
            onInput: () => {
                // Real-time sync disabled: dispatching InputEvent with newlines triggers 
                // ChatGPT's Enter detection and causes unwanted message sends.
                // Content is synced on collapse (onCollapse) and send (onSend) instead.
            },
            initialText: this.messageSender?.readFromNative() || ''
        });

        this.triggerBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            logger.info('[ReaderPanel] Trigger button clicked', {
                isSending: this.isSending,
                floatingVisible: this.floatingInput?.visible
            });
            if (this.isSending) return;

            const wasHidden = !this.floatingInput?.visible;

            this.floatingInput?.toggle(wrapper);

            if (wasHidden && this.floatingInput?.visible && this.messageSender) {
                const nativeText = this.messageSender.readFromNative();
                logger.info('[ReaderPanel] Reading native input for sync', {
                    nativeTextLength: nativeText.length,
                    nativeTextPreview: nativeText.substring(0, 50)
                });
                this.floatingInput.setText(nativeText);
            }
        });

        wrapper.appendChild(this.triggerBtn);

        // Jump Button
        const jumpBtn = document.createElement('button');
        jumpBtn.className = 'aimd-trigger-btn';
        jumpBtn.title = 'Jump to current message';
        jumpBtn.innerHTML = Icons.locate;
        jumpBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.handleJumpToCurrent();
        });
        wrapper.appendChild(jumpBtn);

        return wrapper;
    }

    /**
     * Jump to current message in the document
     */
    private handleJumpToCurrent(): void {
        const refs = getMessageRefs();
        // Since this.items is 0-indexed and maps 1:1 to refs
        const element = refs[this.currentIndex]?.element;

        if (element) {
            logger.info(`[ReaderPanel] Jumping to message at index ${this.currentIndex}`);
            this.hide();

            // Scroll to element
            element.scrollIntoView({ behavior: 'auto', block: 'start' });

            // Visual highlight
            const originalTransition = element.style.transition;
            const originalBoxShadow = element.style.boxShadow;

            element.style.transition = 'box-shadow 0.5s ease';
            // Use interactive primary token or fallback
            element.style.boxShadow = '0 0 0 4px var(--aimd-interactive-primary, #3b82f6)';

            // Remove highlight after 2 seconds
            setTimeout(() => {
                element.style.boxShadow = originalBoxShadow;
                setTimeout(() => {
                    element.style.transition = originalTransition;
                }, 500);
            }, 2000);
        } else {
            logger.warn(`[ReaderPanel] Could not find element for index ${this.currentIndex}`);
        }
    }

    /**
     * Set trigger button state.
     */
    private setTriggerButtonState(state: 'default' | 'waiting'): void {
        logger.info('[ReaderPanel] setTriggerButtonState called', { state, hasTriggerBtn: !!this.triggerBtn });
        if (!this.triggerBtn) return;

        if (state === 'waiting') {
            this.triggerBtn.innerHTML = Icons.hourglass;
            this.triggerBtn.classList.add('waiting');
            this.triggerBtn.disabled = true;
            this.isSending = true;
            logger.info('[ReaderPanel] Button set to WAITING state');
        } else {
            this.triggerBtn.innerHTML = Icons.messageSquareText;
            this.triggerBtn.classList.remove('waiting');
            this.triggerBtn.disabled = false;
            this.isSending = false;
            logger.info('[ReaderPanel] Button set to DEFAULT state');
        }
    }

    /**
     * Setup keyboard navigation.
     */
    private setupKeyboardNavigation(panel: HTMLElement): void {
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                this.hide();
                document.removeEventListener('keydown', handleEscape);
            }
        };
        document.addEventListener('keydown', handleEscape);

        this.keyHandler = (e: KeyboardEvent) => {
            if (e.key === 'ArrowLeft') {
                e.preventDefault();
                this.paginationController?.previous();
            } else if (e.key === 'ArrowRight') {
                e.preventDefault();
                this.paginationController?.next();
            }
        };

        panel.addEventListener('keydown', this.keyHandler);
    }

    /**
     * Navigate to a given index.
     */
    private async navigateTo(index: number): Promise<void> {
        if (index < 0 || index >= this.items.length) return;

        this.currentIndex = index;
        this.paginationController?.setActiveIndex(index);

        // Update bookmark button state for current message (position is 1-indexed)
        this.updateBookmarkButtonState(this.bookmarkedPositions.has(index + 1));

        this.navButtonsController?.updateConfig({
            canGoPrevious: index > 0,
            canGoNext: index < this.items.length - 1
        });

        if (this.shadowRoot) {
            const body = this.shadowRoot.querySelector('#panel-body');
            body?.scrollTo(0, 0);
        }

        await this.renderMessage(index);
    }

    /**
     * Render message content (supports lazy providers).
     */
    private async renderMessage(index: number): Promise<void> {
        const item = this.items[index];
        const isLastItem = index === this.items.length - 1;

        // Note: last item is treated as volatile and should not be cached.
        let html = this.cache.get(index);

        if (html && isLastItem) {
            logger.warn(`[ReaderPanel] BUG: Last item has cached content! Invalidating...`);
            this.cache.delete(index);
            html = undefined;
        }

        if (!html) {
            try {
                const t0 = performance.now();
                let markdown: string;

                // For the last item, bypass LazyProvider closure and re-fetch from live DOM
                if (isLastItem && this.getMarkdownFn) {
                    const freshRefs = getMessageRefs();
                    const freshElement = freshRefs[index]?.element;
                    if (freshElement) {
                        markdown = this.getMarkdownFn(freshElement);
                    } else {
                        markdown = await resolveContent(item.content);
                    }
                } else {
                    markdown = await resolveContent(item.content);
                }

                logger.debug(`[ReaderPanel] resolveContent: ${(performance.now() - t0).toFixed(2)}ms`);

                const settings = await SettingsManager.getInstance().get('reader');
                if (!settings.renderCodeInReader) {
                    markdown = markdown.replace(/```[\s\S]*?```/g, '*[Code block hidden by settings]*');
                    logger.debug('[ReaderPanel] Code blocks filtered out');
                }

                const t1 = performance.now();
                const result = await MarkdownRenderer.render(markdown);
                logger.debug(`[ReaderPanel] MarkdownRenderer.render: ${(performance.now() - t1).toFixed(2)}ms`);
                html = result.success ? result.html! : result.fallback!;

                html = html.replace(/^\s+/, '').trim();

                if (index < this.items.length - 1) {
                    this.cache.set(index, html);
                }
            } catch (error) {
                logger.error('[ReaderPanel] Render failed:', error);
                html = '<div class="markdown-fallback">Failed to render content</div>';
            }
        }

        if (this.shadowRoot) {
            const body = this.shadowRoot.querySelector('#panel-body');
            if (body) {
                const rawPrompt = item.userPrompt || '';
                const normalizedPrompt = rawPrompt.replace(/\n{2,}/g, '\n').trim();
                const displayPrompt = normalizedPrompt.length > 200
                    ? normalizedPrompt.slice(0, 200) + '...'
                    : normalizedPrompt;

                const userIcon = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>`;

                const modelIcon = item.meta?.platformIcon || `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><path d="M12 16v-4M12 8h.01"></path></svg>`;

                body.innerHTML = `
                    <div class="message-user-header">
                        <div class="user-icon">${userIcon}</div>
                        <div class="user-content">${this.escapeHtml(displayPrompt)}</div>
                    </div>
                    
                    <div class="message-model-container">
                        <div class="model-icon">${modelIcon}</div>
                        <div class="markdown-body">${html}</div>
                    </div>
                `;
            }
        }
    }

    private escapeHtml(text: string): string {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    private setupTooltips(): void {
        if (!this.shadowRoot || !this.paginationController) return;

        // Destroy old manager if exists to clear bindings
        if (this.tooltipManager) {
            this.tooltipManager.destroy();
        }

        this.tooltipManager = new TooltipManager(this.shadowRoot);
        const dots = this.paginationController.getDots();

        dots.forEach((dot, index) => {
            // Safety check for index mismatch
            if (index >= this.items.length) return;

            this.tooltipManager!.attach(dot, {
                index,
                text: this.items[index].userPrompt || `Message ${index + 1}`,
                maxLength: 100
            });
        });
    }

    /**
     * Toggle fullscreen mode.
     */
    private toggleFullscreen(): void {
        if (!this.shadowRoot) return;
        const panel = this.shadowRoot.querySelector('.aicopy-panel');
        panel?.classList.toggle('aicopy-panel-fullscreen');
    }

    /**
     * Load bookmarked positions for current page on panel open
     */
    private async loadBookmarkedPositions(): Promise<void> {
        try {
            const url = window.location.href;
            this.bookmarkedPositions = await SimpleBookmarkStorage.loadAllPositions(url);
            logger.debug(`[ReaderPanel] Loaded ${this.bookmarkedPositions.size} bookmarked positions`);
        } catch (error) {
            logger.error('[ReaderPanel] Failed to load bookmarked positions:', error);
        }
    }

    /**
     * Copy current message markdown to clipboard
     */
    private async handleReaderCopyMarkdown(): Promise<void> {
        const currentItem = this.items[this.currentIndex];
        if (!currentItem) return;

        try {
            const content = await resolveContent(currentItem.content);
            await navigator.clipboard.writeText(content);
            logger.debug('[ReaderPanel] Copied markdown to clipboard');

            // Visual feedback on copy button
            const copyBtn = this.shadowRoot?.querySelector('#copy-btn');
            if (copyBtn) {
                copyBtn.classList.add('success');
                setTimeout(() => copyBtn.classList.remove('success'), 1000);
            }
        } catch (error) {
            logger.error('[ReaderPanel] Failed to copy markdown:', error);
        }
    }

    /**
     * View source for current message
     */
    private handleReaderViewSource(): void {
        const currentItem = this.items[this.currentIndex];
        if (!currentItem) return;

        // Resolve content and show in modal
        resolveContent(currentItem.content).then(content => {
            // Create simple modal for source view
            const modal = document.createElement('div');
            modal.className = 'aicopy-source-modal';
            modal.innerHTML = `
                <div class="aicopy-source-modal-content">
                    <div class="aicopy-source-modal-header">
                        <h3>Markdown Source</h3>
                        <button class="aicopy-source-modal-close">&times;</button>
                    </div>
                    <pre class="aicopy-source-modal-body">${this.escapeHtml(content)}</pre>
                </div>
            `;

            modal.querySelector('.aicopy-source-modal-close')?.addEventListener('click', () => modal.remove());
            modal.addEventListener('click', (e) => {
                if (e.target === modal) modal.remove();
            });

            document.body.appendChild(modal);
        });
    }

    /**
     * Toggle bookmark for current message - reuses toolbar bookmark logic
     * Position is 1-indexed to match toolbar behavior
     */
    private async handleReaderBookmark(): Promise<void> {
        const url = window.location.href;
        const position = this.currentIndex + 1; // 1-indexed to match toolbar
        const wasBookmarked = this.bookmarkedPositions.has(position);

        try {
            if (wasBookmarked) {
                // Remove bookmark directly
                await SimpleBookmarkStorage.remove(url, position);
                this.bookmarkedPositions.delete(position);
                this.paginationController?.setBookmarked(this.currentIndex, false);
                this.updateBookmarkButtonState(false);
                logger.info(`[ReaderPanel] Removed bookmark at position ${position}`);
            } else {
                // Add bookmark - show save modal (same as toolbar)
                const currentItem = this.items[this.currentIndex];
                const userMessage = currentItem?.userPrompt || '';

                if (!userMessage) {
                    logger.error('[ReaderPanel] Failed to extract user message');
                    alert('Failed to extract user message. Please try again.');
                    return;
                }

                const adapter = adapterRegistry.getAdapter();
                const platform = adapter?.getPlatformName() || 'AI Platform';
                const aiResponse = await resolveContent(currentItem?.content || '');
                const defaultTitle = userMessage.substring(0, 50) + (userMessage.length > 50 ? '...' : '');
                const lastUsedFolder = localStorage.getItem('lastUsedFolder') || 'Import';

                // Show save modal
                const saveModal = new BookmarkSaveModal();
                saveModal.show({
                    defaultTitle,
                    lastUsedFolder,
                    onSave: async (title, folderPath) => {
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

                        this.bookmarkedPositions.add(position);
                        this.paginationController?.setBookmarked(this.currentIndex, true);
                        this.updateBookmarkButtonState(true);
                        localStorage.setItem('lastUsedFolder', folderPath);
                        logger.info(`[ReaderPanel] Saved "${title}" to "${folderPath}"`);
                    }
                });
            }
        } catch (error) {
            logger.error('[ReaderPanel] Bookmark operation failed:', error);
            alert('Failed to toggle bookmark: ' + (error instanceof Error ? error.message : String(error)));
        }
    }

    /**
     * Update bookmark button state (highlight/dim) based on bookmark status
     */
    private updateBookmarkButtonState(isBookmarked: boolean): void {
        const bookmarkBtn = this.shadowRoot?.querySelector('#bookmark-btn');
        if (!bookmarkBtn) return;

        if (isBookmarked) {
            bookmarkBtn.classList.add('bookmarked');
            bookmarkBtn.setAttribute('title', 'Remove Bookmark');
        } else {
            bookmarkBtn.classList.remove('bookmarked');
            bookmarkBtn.setAttribute('title', 'Bookmark');
        }
    }
}
