import { MarkdownRenderer } from '@/renderer/core/MarkdownRenderer';
import { StyleManager } from '@/renderer/styles/StyleManager';
import { LRUCache } from '@/renderer/utils/LRUCache';
import { MessageCollector, MessageRef } from '../utils/MessageCollector';
import { TooltipManager, tooltipStyles } from '../utils/TooltipManager';
import { DotPaginationController } from '../utils/DotPaginationController';
import { NavigationButtonsController } from '../utils/NavigationButtonsController';
import { readerPanelStyles } from '../utils/ReaderPanelStyles';
import { adapterRegistry } from '../adapters/registry';
import { logger } from '../../utils/logger';

type GetMarkdownFn = (element: HTMLElement) => string;

/**
 * Reader Panel - Modular Markdown Reader
 * 
 * Coordinates independent modules:
 * - DotPaginationController: Pagination UI
 * - TooltipManager: Tooltip display
 * - MarkdownRenderer: Content rendering
 * 
 * Zero tight coupling - all modules are replaceable.
 */
export class ReaderPanel {
    private container: HTMLElement | null = null;
    private shadowRoot: ShadowRoot | null = null;
    private currentThemeIsDark: boolean = false;
    private messages: MessageRef[] = [];
    private currentIndex: number = 0;
    private cache: LRUCache<number, string> = new LRUCache(10);
    private getMarkdownFn?: GetMarkdownFn;

    // Modular components
    private tooltipManager: TooltipManager | null = null;
    private paginationController: DotPaginationController | null = null;
    private navButtonsController: NavigationButtonsController | null = null;
    private keyHandler: ((e: KeyboardEvent) => void) | null = null;

    /**
     * Show reader panel
     */
    async show(messageElement: HTMLElement, getMarkdown: GetMarkdownFn): Promise<void> {
        const startTime = performance.now();
        logger.debug('[ReaderPanel] START show');

        this.getMarkdownFn = getMarkdown;
        this.hide();

        // Collect messages (lazy - no parsing)
        const t0 = performance.now();
        this.messages = MessageCollector.collectMessages();
        logger.debug(`[ReaderPanel] collectMessages: ${(performance.now() - t0).toFixed(2)} ms, count: ${this.messages.length} `);

        if (this.messages.length === 0) {
            logger.warn('[ReaderPanel] No messages found');
            return;
        }

        // Find current message index
        this.currentIndex = MessageCollector.findMessageIndex(messageElement, this.messages);
        if (this.currentIndex === -1) {
            this.currentIndex = this.messages.length - 1;
        }
        logger.debug(`[ReaderPanel] currentIndex: ${this.currentIndex}/${this.messages.length}`);

        // Extract user prompts for tooltips
        await this.extractUserPrompts();

        // Create panel UI
        await this.createPanel();

        logger.debug(`[ReaderPanel] END show: ${(performance.now() - startTime).toFixed(2)}ms`);
    }

    /**
     * Extract user prompts using adapter
     */
    private async extractUserPrompts(): Promise<void> {
        try {
            const adapter = adapterRegistry.getAdapter();
            if (!adapter) {
                logger.warn('[ReaderPanel] No adapter found, using fallback prompts');
                this.messages.forEach((msg, i) => {
                    msg.userPrompt = `Message ${i + 1}`;
                });
                return;
            }

            const prompts = adapter.getUserPrompts();
            this.messages.forEach((msg, i) => {
                msg.userPrompt = prompts[i] || `Message ${i + 1}`;
            });
        } catch (err) {
            logger.error('[ReaderPanel] extractUserPrompts failed:', err);
            this.messages.forEach((msg, i) => {
                msg.userPrompt = `Message ${i + 1}`;
            });
        }
    }

    /**
     * Hide panel and cleanup all modules
     */
    hide(): void {
        this.container?.remove();
        this.container = null;
        this.shadowRoot = null;
        this.cache.clear();

        // Cleanup modular components
        this.tooltipManager?.destroy();
        this.tooltipManager = null;

        this.paginationController?.destroy();
        this.paginationController = null;

        this.navButtonsController?.destroy();
        this.navButtonsController = null;

        if (this.keyHandler) {
            document.removeEventListener('keydown', this.keyHandler);
            this.keyHandler = null;
        }
    }

    /**
     * Set theme
     */
    setTheme(isDark: boolean): void {
        this.currentThemeIsDark = isDark;
        if (this.container) {
            this.container.dataset.theme = isDark ? 'dark' : 'light';
        }
    }

    /**
     * Create panel with shadow DOM
     */
    private async createPanel(): Promise<void> {
        // Create container
        this.container = document.createElement('div');
        this.container.dataset.theme = this.currentThemeIsDark ? 'dark' : 'light';

        // Attach Shadow DOM
        this.shadowRoot = this.container.attachShadow({ mode: 'open' });

        // Inject styles
        await StyleManager.injectStyles(this.shadowRoot, this.currentThemeIsDark);

        const styleEl = document.createElement('style');
        styleEl.textContent = readerPanelStyles + tooltipStyles;
        this.shadowRoot.appendChild(styleEl);

        // Create UI structure
        const overlay = this.createOverlay();
        const panel = this.createPanelElement();

        this.shadowRoot.appendChild(overlay);
        this.shadowRoot.appendChild(panel);
        document.body.appendChild(this.container);

        // Render current message
        await this.renderMessage(this.currentIndex);

        // Setup keyboard navigation
        this.setupKeyboardNavigation(panel);

        // Focus panel
        panel.focus();
    }

    /**
     * Create overlay element
     */
    private createOverlay(): HTMLElement {
        const overlay = document.createElement('div');
        overlay.className = 'aicopy-panel-overlay';
        overlay.addEventListener('click', () => this.hide());
        return overlay;
    }

    /**
     * Create main panel element
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
     * Create header
     */
    private createHeader(): HTMLElement {
        const header = document.createElement('div');
        header.className = 'aicopy-panel-header';
        header.innerHTML = `
            <div class="aicopy-panel-header-left">
                <h2 class="aicopy-panel-title">Rendered Markdown</h2>
                <button class="aicopy-panel-btn" id="fullscreen-btn" title="Toggle fullscreen">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"></path>
                    </svg>
                </button>
            </div>
            <button class="aicopy-panel-btn" id="close-btn" title="Close">×</button>
        `;

        header.querySelector('#close-btn')?.addEventListener('click', () => this.hide());
        header.querySelector('#fullscreen-btn')?.addEventListener('click', () => this.toggleFullscreen());

        return header;
    }

    /**
     * Create pagination using DotPaginationController
     */
    private createPagination(): HTMLElement {
        const paginationContainer = document.createElement('div');
        paginationContainer.className = 'aicopy-pagination';

        logger.debug(`[ReaderPanel] Creating pagination for ${this.messages.length} messages`);

        // Initialize pagination controller
        this.paginationController = new DotPaginationController(paginationContainer, {
            totalItems: this.messages.length,
            currentIndex: this.currentIndex,
            onNavigate: (index) => this.navigateTo(index)
        });

        this.paginationController.render();

        logger.debug(`[ReaderPanel] Pagination rendered, container has ${this.paginationController.getDots().length} dots`);

        // Create navigation buttons controller
        this.navButtonsController = new NavigationButtonsController(
            paginationContainer,
            {
                onPrevious: () => {
                    if (this.currentIndex > 0) {
                        this.navigateTo(this.currentIndex - 1);
                    }
                },
                onNext: () => {
                    if (this.currentIndex < this.messages.length - 1) {
                        this.navigateTo(this.currentIndex + 1);
                    }
                },
                canGoPrevious: this.currentIndex > 0,
                canGoNext: this.currentIndex < this.messages.length - 1
            }
        );
        this.navButtonsController.render();

        // Initialize tooltip manager and attach to dots
        if (this.shadowRoot) {
            this.tooltipManager = new TooltipManager(this.shadowRoot);
            const dots = this.paginationController.getDots();

            dots.forEach((dot, index) => {
                this.tooltipManager!.attach(dot, {
                    index,
                    text: this.messages[index].userPrompt || `Message ${index + 1}`,
                    maxLength: 50
                });
            });
        }

        return paginationContainer;
    }

    /**
     * Setup keyboard navigation
     */
    private setupKeyboardNavigation(panel: HTMLElement): void {
        // ESC to close
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                this.hide();
                document.removeEventListener('keydown', handleEscape);
            }
        };
        document.addEventListener('keydown', handleEscape);

        // Arrow key navigation (scoped to panel)
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
     * Navigate to specific message index
     */
    private async navigateTo(index: number): Promise<void> {
        if (index < 0 || index >= this.messages.length) return;

        this.currentIndex = index;
        this.paginationController?.setActiveIndex(index);

        // Update navigation buttons states
        this.navButtonsController?.updateConfig({
            canGoPrevious: index > 0,
            canGoNext: index < this.messages.length - 1
        });

        await this.renderMessage(index);
    }

    /**
     * Lazy-load and render message content
     */
    private async renderMessage(index: number): Promise<void> {
        const messageRef = this.messages[index];

        // Check cache
        let html = this.cache.get(index);

        if (!html) {
            // Parse content only when needed
            if (!messageRef.parsed && this.getMarkdownFn) {
                try {
                    const t0 = performance.now();
                    messageRef.parsed = this.getMarkdownFn(messageRef.element);
                    logger.debug(`[ReaderPanel] getMarkdown: ${(performance.now() - t0).toFixed(2)}ms`);
                } catch (error) {
                    logger.error('[ReaderPanel] Parse failed:', error);
                    messageRef.parsed = 'Failed to parse message';
                }
            }

            // Render
            const t1 = performance.now();
            const result = await MarkdownRenderer.render(messageRef.parsed!);
            logger.debug(`[ReaderPanel] MarkdownRenderer.render: ${(performance.now() - t1).toFixed(2)}ms`);
            html = result.success ? result.html! : result.fallback!;

            // Cache
            this.cache.set(index, html);
        } else {
            logger.debug(`[ReaderPanel] Using cache for message ${index}`);
        }

        // Update DOM
        if (this.shadowRoot) {
            const body = this.shadowRoot.querySelector('#panel-body');
            if (body) {
                body.innerHTML = `<div class="markdown-body">${html!}</div>`;
            }
        }
    }

    /**
     * Toggle fullscreen mode
     */
    private toggleFullscreen(): void {
        if (!this.shadowRoot) return;
        const panel = this.shadowRoot.querySelector('.aicopy-panel');
        panel?.classList.toggle('aicopy-panel-fullscreen');
    }
}
