import { SettingsManager } from '../../settings/SettingsManager';
import { logger } from '../../utils/logger';
import { SiteAdapter } from '../adapters/base';

type FoldingMode = 'off' | 'all' | 'keep_last_n';

const FOLDED_ATTR = 'data-aimd-chatgpt-folded';
const STYLE_ID = 'aimd-chatgpt-folding-style';

export class ChatGPTFoldingController {
    private adapter: SiteAdapter | null = null;
    private mode: FoldingMode = 'off';
    private keepLastN: number = 8;
    private styleEl: HTMLStyleElement | null = null;
    private unsubscribeSettings: (() => void) | null = null;

    private seenElements = new WeakSet<HTMLElement>();
    private recentExpanded: HTMLElement[] = [];
    private initialized: boolean = false;

    async init(adapter: SiteAdapter): Promise<void> {
        this.adapter = adapter;
        this.ensureStyles();

        await this.loadSettings();
        this.applyToExisting();
        this.initialized = true;

        this.unsubscribeSettings = SettingsManager.getInstance().subscribe((settings) => {
            const nextMode = settings.performance.chatgptFoldingMode;
            const nextKeepLastN = settings.performance.chatgptDefaultExpandedCount;

            const normalizedMode = this.normalizeMode(nextMode);
            const normalizedKeepLastN = this.normalizeKeepLastN(nextKeepLastN);

            if (normalizedMode === this.mode && normalizedKeepLastN === this.keepLastN) return;

            this.mode = normalizedMode;
            this.keepLastN = normalizedKeepLastN;
            this.applyToExisting();
        });
    }

    dispose(): void {
        this.unsubscribeSettings?.();
        this.unsubscribeSettings = null;

        this.recentExpanded = [];
        this.seenElements = new WeakSet<HTMLElement>();
        this.initialized = false;

        if (this.styleEl) {
            this.styleEl.remove();
            this.styleEl = null;
        }
    }

    registerMessage(messageElement: HTMLElement): void {
        if (!this.initialized) return;
        if (this.mode === 'off') return;
        if (this.seenElements.has(messageElement)) return;

        this.seenElements.add(messageElement);

        // New messages (during an active chat) should remain readable by default.
        // Apply "keep last N" behavior incrementally to avoid scanning the entire DOM.
        this.setCollapsed(messageElement, false);

        if (this.mode === 'keep_last_n') {
            this.pushRecent(messageElement);
            this.enforceRecentLimit();
        }
    }

    isCollapsed(messageElement: HTMLElement): boolean {
        return messageElement.getAttribute(FOLDED_ATTR) === '1';
    }

    toggle(messageElement: HTMLElement): boolean {
        const nextCollapsed = !this.isCollapsed(messageElement);
        this.setCollapsed(messageElement, nextCollapsed);
        return nextCollapsed;
    }

    private async loadSettings(): Promise<void> {
        const performance = await SettingsManager.getInstance().get('performance');
        this.mode = this.normalizeMode(performance.chatgptFoldingMode);
        this.keepLastN = this.normalizeKeepLastN(performance.chatgptDefaultExpandedCount);
    }

    private normalizeMode(mode: string): FoldingMode {
        if (mode === 'all' || mode === 'keep_last_n' || mode === 'off') return mode;
        return 'off';
    }

    private normalizeKeepLastN(n: number): number {
        if (!Number.isFinite(n)) return 8;
        return Math.max(0, Math.min(200, Math.floor(n)));
    }

    private ensureStyles(): void {
        const existing = document.getElementById(STYLE_ID);
        if (existing instanceof HTMLStyleElement) {
            this.styleEl = existing;
            return;
        }

        const style = document.createElement('style');
        style.id = STYLE_ID;
        style.textContent = `
            /* Folded assistant message: hide heavy markdown content area. */
            [${FOLDED_ATTR}="1"] .markdown.prose,
            [${FOLDED_ATTR}="1"] .markdown.prose.dark\\:prose-invert {
                display: none;
            }

            /*
             * Low-intrusion render optimization:
             * If supported by the browser, let the engine skip layout/paint for offscreen message content.
             */
            @supports (content-visibility: auto) {
                [data-message-author-role="assistant"] .markdown.prose,
                [data-message-author-role="assistant"] .markdown.prose.dark\\:prose-invert {
                    content-visibility: auto;
                }
            }
        `;
        document.head.appendChild(style);
        this.styleEl = style;
    }

    private applyToExisting(): void {
        if (!this.adapter) return;

        const selector = this.adapter.getMessageSelector();
        let messages: HTMLElement[] = [];

        try {
            messages = Array.from(document.querySelectorAll(selector))
                .filter((el): el is HTMLElement => el instanceof HTMLElement);
        } catch (err) {
            logger.warn('[ChatGPTFolding] Invalid message selector; cannot apply folding:', err);
            return;
        }

        // Mark as seen so handleNewMessage won't treat them as "new" later.
        messages.forEach((el) => this.seenElements.add(el));

        this.recentExpanded = [];

        if (this.mode === 'off') {
            messages.forEach((el) => this.setCollapsed(el, false));
            return;
        }

        if (this.mode === 'all') {
            messages.forEach((el) => this.setCollapsed(el, true));
            return;
        }

        // keep_last_n
        const start = Math.max(0, messages.length - this.keepLastN);
        messages.forEach((el, idx) => {
            const collapsed = idx < start;
            this.setCollapsed(el, collapsed);
            if (!collapsed) this.recentExpanded.push(el);
        });
    }

    private pushRecent(messageElement: HTMLElement): void {
        // De-dup to keep ordering stable if ChatGPT re-renders the same node.
        this.recentExpanded = this.recentExpanded.filter((el) => el !== messageElement);
        this.recentExpanded.push(messageElement);
    }

    private enforceRecentLimit(): void {
        if (this.keepLastN <= 0) {
            // Setting of 0 means "collapse all" in keep_last_n mode.
            this.recentExpanded.forEach((el) => this.setCollapsed(el, true));
            this.recentExpanded = [];
            return;
        }

        while (this.recentExpanded.length > this.keepLastN) {
            const oldest = this.recentExpanded.shift();
            if (!oldest) break;
            this.setCollapsed(oldest, true);
        }
    }

    private setCollapsed(messageElement: HTMLElement, collapsed: boolean): void {
        const already = this.isCollapsed(messageElement);
        if (collapsed === already) return;

        if (collapsed) {
            messageElement.setAttribute(FOLDED_ATTR, '1');
        } else {
            messageElement.removeAttribute(FOLDED_ATTR);
        }
    }
}

