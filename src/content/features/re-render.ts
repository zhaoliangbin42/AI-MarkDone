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

type GetMarkdownFn = (element: HTMLElement) => string;

/**
 * Reader Panel - 通用 Markdown 阅读器
 * 
 * 设计原则（重构后）：
 * - 数据驱动：通过 ReaderItem[] 接收数据
 * - 与数据源解耦：不关心数据来自 DOM 还是存储
 * - 支持懒加载：ContentProvider 可以是函数
 * 
 * 协调模块：
 * - DotPaginationController: 分页 UI
 * - TooltipManager: 提示框
 * - MarkdownRenderer: 内容渲染
 */
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

    /**
     * 【新方法】通用入口：接受标准化的 ReaderItem[]
     * 
     * @param items - 阅读器数据项数组
     * @param startIndex - 初始显示的索引
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

        // 验证并设置起始索引
        this.currentIndex = Math.max(0, Math.min(startIndex, this.items.length - 1));
        logger.debug(`[ReaderPanel] currentIndex: ${this.currentIndex}/${this.items.length}`);

        // 创建面板 UI
        await this.createPanel();

        logger.debug(`[ReaderPanel] END showWithData: ${(performance.now() - startTime).toFixed(2)}ms`);
    }

    /**
     * 【兼容层】保留旧签名，供现有调用方使用
     * 
     * @deprecated 建议使用 showWithData()
     */
    async show(messageElement: HTMLElement, getMarkdown: GetMarkdownFn): Promise<void> {
        const startTime = performance.now();
        logger.debug('[ReaderPanel] START show (compat layer)');

        // Save strategy for dynamic updates
        this.getMarkdownFn = getMarkdown;

        // 使用新的数据源适配器收集数据
        const items = collectFromLivePage(getMarkdown);

        if (items.length === 0) {
            logger.warn('[ReaderPanel] No messages found');
            return;
        }

        // 查找当前消息索引
        const messageRefs = getMessageRefs();
        let startIndex = MessageCollector.findMessageIndex(messageElement, messageRefs);
        if (startIndex === -1) {
            startIndex = items.length - 1;
        }

        logger.debug(`[ReaderPanel] Compat layer prepared ${items.length} items in ${(performance.now() - startTime).toFixed(2)}ms`);

        // 委托给新方法
        return this.showWithData(items, startIndex);
    }

    /**
     * 隐藏面板并清理
     */
    hide(): void {
        this.container?.remove();
        this.container = null;
        this.shadowRoot = null;
        this.cache.clear();

        // 清理子组件
        this.tooltipManager?.destroy();
        this.tooltipManager = null;

        this.paginationController?.destroy();
        this.paginationController = null;

        this.navButtonsController?.destroy();
        this.navButtonsController = null;

        // 清理消息发送组件
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

        // 清理 EventBus 订阅
        this.unsubscribeNewMessage?.();
        this.unsubscribeNewMessage = null;
    }

    /**
     * 统一 UI 同步方法 (The Unified Update Path)
     * 核心逻辑：Data -> State -> UI Side Effects
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
        // ✅ FIX: Update nav buttons when items change
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
     * 刷新数据项（用于实时更新分页）
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
     * 设置主题
     */
    setTheme(isDark: boolean): void {
        this.currentThemeIsDark = isDark;
        if (this.container) {
            this.container.dataset.theme = isDark ? 'dark' : 'light';
        }
    }

    /**
     * 创建面板 (Shadow DOM)
     */
    private async createPanel(): Promise<void> {
        // 创建容器
        this.container = document.createElement('div');
        this.container.dataset.theme = this.currentThemeIsDark ? 'dark' : 'light';

        // 挂载 Shadow DOM
        this.shadowRoot = this.container.attachShadow({ mode: 'open' });

        // 注入样式
        await StyleManager.injectStyles(this.shadowRoot);

        // 注入 Design Tokens
        const tokenStyle = document.createElement('style');
        tokenStyle.id = 'design-tokens';
        tokenStyle.textContent = `:host { ${DesignTokens.getCompleteTokens(this.currentThemeIsDark)} }`;
        this.shadowRoot.insertBefore(tokenStyle, this.shadowRoot.firstChild);

        const styleEl = document.createElement('style');
        styleEl.textContent = readerPanelStyles + tooltipStyles + floatingInputStyles;
        this.shadowRoot.appendChild(styleEl);

        // 创建 UI 结构
        const overlay = this.createOverlay();
        const panel = this.createPanelElement();

        this.shadowRoot.appendChild(overlay);
        this.shadowRoot.appendChild(panel);
        document.body.appendChild(this.container);

        // 渲染当前消息
        await this.renderMessage(this.currentIndex);

        // 设置键盘导航
        this.setupKeyboardNavigation(panel);

        // 聚焦面板
        panel.focus();

        // 订阅新消息事件，用于实时更新分页
        this.unsubscribeNewMessage = eventBus.on<{ count: number }>('message:new', ({ count }) => {
            logger.debug(`[ReaderPanel] EventBus received 'message:new', count: ${count}, current items: ${this.items.length}`);
            if (count !== this.items.length) {
                logger.info(`[ReaderPanel] New message event detected change: ${this.items.length} -> ${count}`);
                this.refreshItems();
            } else {
                // Double check in case event count is stale but DOM is new
                // Sometimes mutation observer fires before querySelectorAll catches up?
                // Or maybe we should trust the event?
                // Let's force a check if we suspect desync, but for now just log.
                logger.debug('[ReaderPanel] Event count matches current items, checking anyway');
                this.refreshItems();
            }
        });
    }

    /**
     * 创建遮罩层
     */
    private createOverlay(): HTMLElement {
        const overlay = document.createElement('div');
        overlay.className = 'aicopy-panel-overlay';
        overlay.addEventListener('click', () => this.hide());
        return overlay;
    }

    /**
     * 创建主面板
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
     * 创建头部
     */
    private createHeader(): HTMLElement {
        const header = document.createElement('div');
        header.className = 'aicopy-panel-header';
        header.innerHTML = `
            <div class="aicopy-panel-header-left">
                <h2 class="aicopy-panel-title">AI-Markdone Reader</h2>
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
     * 创建分页控件 (Refactored for Structural Isolation)
     */
    private createPagination(): HTMLElement {
        // STRICT AUDIT: Structural Isolation Pattern
        // ReaderPanel explicitly constructs the layout skeleton.
        const paginationContainer = document.createElement('div');
        paginationContainer.className = 'aicopy-pagination';

        logger.debug(`[ReaderPanel] Creating pagination for ${this.items.length} items`);

        // 1. Trigger Area (Created via existing method)
        // Note: The Trigger is complex (floating input etc), so we keep creating it via helper
        const triggerWrapper = this.createMessageTriggerButton();

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
        paginationContainer.appendChild(triggerWrapper);
        paginationContainer.appendChild(leftBtn);
        paginationContainer.appendChild(dotsContainer);
        paginationContainer.appendChild(rightBtn);
        paginationContainer.appendChild(hint);

        // --- Controller Initialization ---

        // 1. DotPaginationController (Inject Dedicated Container)
        this.paginationController = new DotPaginationController(dotsContainer, {
            totalItems: this.items.length,
            currentIndex: this.currentIndex,
            onNavigate: (index) => this.navigateTo(index)
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
     * 创建消息发送触发按钮
     */
    private createMessageTriggerButton(): HTMLElement {
        const wrapper = document.createElement('div');
        wrapper.className = 'aimd-trigger-btn-wrapper';

        // 创建触发按钮
        this.triggerBtn = document.createElement('button');
        this.triggerBtn.className = 'aimd-trigger-btn';
        this.triggerBtn.title = 'Send message';
        this.triggerBtn.innerHTML = Icons.messageSquareText;

        // 初始化 MessageSender
        const adapter = adapterRegistry.getAdapter();
        if (adapter) {
            this.messageSender = new MessageSender({ adapter });
        } else {
            logger.warn('[ReaderPanel] No adapter found for MessageSender');
        }

        // 创建浮动输入组件
        this.floatingInput = new FloatingInput({
            onSend: async (text) => {
                logger.debug('[ReaderPanel] Send clicked:', text.substring(0, 50));
                this.floatingInput?.hide();
                this.setTriggerButtonState('waiting');

                // 发送消息
                if (this.messageSender) {
                    const success = await this.messageSender.send(text);
                    logger.debug('[ReaderPanel] Send result:', success);
                }

                // 使用与工具栏完全相同的检测逻辑：Copy Button 出现
                const adapter = adapterRegistry.getAdapter();
                if (adapter) {
                    const watcher = new StreamingDetector(adapter);
                    const stopWatching = watcher.startWatching(() => {
                        logger.info('[ReaderPanel] Streaming complete detected via StreamingDetector');
                        this.setTriggerButtonState('default');
                    });

                    // 超时保护（30秒，仅作为最后防线）
                    setTimeout(() => {
                        stopWatching();
                        this.setTriggerButtonState('default');
                    }, 30000);
                } else {
                    // 无 adapter 时直接超时恢复
                    setTimeout(() => {
                        this.setTriggerButtonState('default');
                    }, 5000);
                }
            },
            onCollapse: (text) => {
                logger.debug('[ReaderPanel] FloatingInput collapsed, text length:', text.length);
                // 强制同步到官方输入框
                if (text.trim() && this.messageSender) {
                    this.messageSender.forceSyncToNative(text);
                }
            },
            onInput: (text) => {
                // debounce 同步到官方输入框
                this.messageSender?.syncToNativeDebounced(text);
            },
            initialText: this.messageSender?.readFromNative() || ''
        });

        // 点击触发按钮显示/隐藏浮动输入框
        this.triggerBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            logger.info('[ReaderPanel] Trigger button clicked', {
                isSending: this.isSending,
                floatingVisible: this.floatingInput?.visible
            });
            if (this.isSending) return; // 发送中禁止操作

            const wasHidden = !this.floatingInput?.visible;

            // 先 toggle 显示
            this.floatingInput?.toggle(wrapper);

            // 如果是从隐藏变为显示，同步官方输入框内容
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
        return wrapper;
    }

    /**
     * 设置触发按钮状态
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
     * 设置键盘导航
     */
    private setupKeyboardNavigation(panel: HTMLElement): void {
        // ESC 关闭
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                this.hide();
                document.removeEventListener('keydown', handleEscape);
            }
        };
        document.addEventListener('keydown', handleEscape);

        // 方向键导航
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
     * 导航到指定索引
     */
    private async navigateTo(index: number): Promise<void> {
        if (index < 0 || index >= this.items.length) return;

        this.currentIndex = index;
        this.paginationController?.setActiveIndex(index);

        // 更新导航按钮状态
        this.navButtonsController?.updateConfig({
            canGoPrevious: index > 0,
            canGoNext: index < this.items.length - 1
        });

        // 重置滚动位置
        if (this.shadowRoot) {
            const body = this.shadowRoot.querySelector('#panel-body');
            body?.scrollTo(0, 0);
        }

        await this.renderMessage(index);
    }

    /**
     * 懒加载并渲染消息内容
     */
    private async renderMessage(index: number): Promise<void> {
        const item = this.items[index];
        const isLastItem = index === this.items.length - 1;

        logger.debug(`[ReaderPanel] renderMessage(${index}/${this.items.length}), isLastItem=${isLastItem}`);

        // 检查缓存 - 注意：最后一条消息永远不会被缓存，所以这里应该返回 undefined
        let html = this.cache.get(index);
        if (html && isLastItem) {
            // 这不应该发生！如果发生了，说明有 bug
            logger.warn(`[ReaderPanel] BUG: Last item has cached content! Invalidating...`);
            this.cache.delete(index);
            html = undefined;
        }

        if (!html) {
            try {
                // 解析内容（支持懒加载）
                const t0 = performance.now();
                const markdown = await resolveContent(item.content);
                logger.debug(`[ReaderPanel] resolveContent: ${(performance.now() - t0).toFixed(2)}ms`);

                // 渲染 Markdown
                const t1 = performance.now();
                const result = await MarkdownRenderer.render(markdown);
                logger.debug(`[ReaderPanel] MarkdownRenderer.render: ${(performance.now() - t1).toFixed(2)}ms`);
                html = result.success ? result.html! : result.fallback!;

                // 清理空白
                html = html.replace(/^\s+/, '').trim();

                // 缓存策略：只有非最后一条消息才缓存 (Volatile Tail: Last item is always fresh)
                // 这样每次进入最后一条消息都会重新获取内容，保证流式更新可见
                // 而历史消息则永久缓存，保证效率
                if (index < this.items.length - 1) {
                    this.cache.set(index, html);
                } else {
                    logger.debug(`[ReaderPanel] Volatile Tail: skipping cache for item ${index}`);
                }
            } catch (error) {
                logger.error('[ReaderPanel] Render failed:', error);
                html = '<div class="markdown-fallback">Failed to render content</div>';
            }
        } else {
            logger.debug(`[ReaderPanel] Using cache for item ${index}`);
        }

        // 更新 DOM
        if (this.shadowRoot) {
            const body = this.shadowRoot.querySelector('#panel-body');
            if (body) {
                // 截断用户提示
                const rawPrompt = item.userPrompt || '';
                const normalizedPrompt = rawPrompt.replace(/\n{2,}/g, '\n').trim();
                const displayPrompt = normalizedPrompt.length > 200
                    ? normalizedPrompt.slice(0, 200) + '...'
                    : normalizedPrompt;

                // 图标
                const userIcon = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>`;

                // 从 meta 获取平台图标，或使用默认值
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
     * 切换全屏模式
     */
    private toggleFullscreen(): void {
        if (!this.shadowRoot) return;
        const panel = this.shadowRoot.querySelector('.aicopy-panel');
        panel?.classList.toggle('aicopy-panel-fullscreen');
    }
}
