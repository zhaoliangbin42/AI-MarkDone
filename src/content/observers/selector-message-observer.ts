import { SiteAdapter } from '../adapters/base';
import { logger } from '../../utils/logger';
import { ToolbarInjector, ToolbarState } from '../injectors/toolbar-injector';

/**
 * Selector-driven MutationObserver.
 *
 * Why: avoid relying on a single container (SPAs change frequently), and keep processing idempotent.
 */
export class SelectorMessageObserver {
    private observer: MutationObserver | null = null;
    private adapter: SiteAdapter;
    private injector: ToolbarInjector;
    private onMessageDetected: (element: HTMLElement) => void;

    private processedMessageIds = new Set<string>();
    private processedElements = new WeakSet<HTMLElement>();

    private conversationKey: string = 'unknown';

    private pendingMutations: MutationRecord[] = [];
    private flushScheduled: boolean = false;

    constructor(
        adapter: SiteAdapter,
        injector: ToolbarInjector,
        onMessageDetected: (element: HTMLElement) => void
    ) {
        this.adapter = adapter;
        this.injector = injector;
        this.onMessageDetected = onMessageDetected;
    }

    private getConversationKey(): string {
        return this.conversationKey;
    }

    private computeConversationKey(): string {
        // Why: namespace by URL to avoid platforms reusing message ids across different chats.
        try {
            const url = new URL(window.location.href);
            const match = url.pathname.match(/\/c\/(\w[\w-]*)/);
            if (match?.[1]) return `c:${match[1]}`;
            return `p:${url.pathname}`;
        } catch {
            return 'unknown';
        }
    }

    private enqueueMutations(mutations: MutationRecord[]): void {
        this.pendingMutations.push(...mutations);
        if (this.flushScheduled) return;

        this.flushScheduled = true;
        queueMicrotask(() => {
            this.flushScheduled = false;
            const batch = this.pendingMutations;
            this.pendingMutations = [];
            this.handleMutations(batch);
        });
    }

    start(): void {
        if (this.observer) {
            return;
        }

        this.conversationKey = this.computeConversationKey();

        // Process existing messages once
        this.processExistingMessages();

        const root = document.body || document.documentElement;
        if (!root) {
            logger.warn('[SelectorObserver] No root element yet; waiting for DOMContentLoaded');
            const retry = () => {
                document.removeEventListener('DOMContentLoaded', retry);
                this.start();
            };
            document.addEventListener('DOMContentLoaded', retry);
            return;
        }

        this.observer = new MutationObserver((mutations) => {
            this.enqueueMutations(mutations);
        });

        this.observer.observe(root, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ['data-turn', 'data-message-author-role', 'data-message-author', 'data-testid']
        });
        logger.info('[SelectorObserver] Started');
    }

    stop(): void {
        if (this.observer) {
            this.observer.disconnect();
            this.observer = null;
        }

        this.pendingMutations = [];
        this.flushScheduled = false;
        logger.info('[SelectorObserver] Stopped');
    }

    reset(): void {
        this.processedMessageIds.clear();
        this.processedElements = new WeakSet<HTMLElement>();
        logger.info('[SelectorObserver] Reset');
    }

    private handleMutations(mutations: MutationRecord[]): void {
        const messageSelector = this.adapter.getMessageSelector();
        const candidates: HTMLElement[] = [];

        let addedNodeCount = 0;

        for (const mutation of mutations) {
            if (mutation.target instanceof HTMLElement) {
                try {
                    const closest = mutation.target.closest(messageSelector);
                    if (closest instanceof HTMLElement) {
                        candidates.push(closest);
                    }
                } catch {
                    // ignore invalid selector edge cases
                }
            }

            for (const node of mutation.addedNodes) {
                if (!(node instanceof HTMLElement)) continue;
                addedNodeCount++;

                try {
                    const closest = node.closest(messageSelector);
                    if (closest instanceof HTMLElement) {
                        candidates.push(closest);
                    }
                } catch {
                    // ignore invalid selector edge cases
                }

                if (node.matches(messageSelector)) {
                    candidates.push(node);
                    continue;
                }

                try {
                    const found = node.querySelectorAll(messageSelector);
                    found.forEach((el) => {
                        if (el instanceof HTMLElement) candidates.push(el);
                    });
                } catch {
                    // Ignore selector edge cases (platform selectors can be brittle).
                }
            }
        }

        if (candidates.length === 0) return;

        const unique = new Set<HTMLElement>(candidates);
        unique.forEach((message) => this.processMessage(message));
    }

    private processExistingMessages(): void {
        const selector = this.adapter.getMessageSelector();
        let messages: NodeListOf<Element>;

        try {
            messages = document.querySelectorAll(selector);
        } catch (err) {
            logger.error('[SelectorObserver] Invalid message selector; cannot query:', err);
            return;
        }

        messages.forEach((el) => {
            if (el instanceof HTMLElement) this.processMessage(el);
        });
    }

    private processMessage(message: HTMLElement): void {
        const state = this.injector.getState(message);

        // If already active, no need to re-run heavy processing.
        if (state === ToolbarState.ACTIVE) {
            const wrapper = message.querySelector('.aicopy-toolbar-wrapper');
            if (wrapper) this.injector.reconcileToolbarPosition(message);
            return;
        }

        // For initial injection (NULL), keep it idempotent.
        // For INJECTED state, allow reprocessing so streaming completion can activate.
        if (state === ToolbarState.NULL) {
            const messageId = this.adapter.getMessageId(message);
            if (messageId) {
                const key = `${this.getConversationKey()}:${messageId}`;
                if (this.processedMessageIds.has(key)) {
                    return;
                }
            } else {
                if (this.processedElements.has(message)) {
                    return;
                }
            }
        }

        try {
            this.onMessageDetected(message);
        } catch (err) {
            logger.error('[SelectorObserver] onMessageDetected failed:', err);
            return;
        }

        // Mark as processed only if we have evidence that injection happened.
        const wrapperAfter = message.querySelector('.aicopy-toolbar-wrapper');
        const containerAfter = message.querySelector('.aicopy-toolbar-container');
        if (wrapperAfter || containerAfter || this.injector.getState(message) !== ToolbarState.NULL) {
            const messageId = this.adapter.getMessageId(message);
            if (messageId) {
                const key = `${this.getConversationKey()}:${messageId}`;
                this.processedMessageIds.add(key);
            } else {
                this.processedElements.add(message);
            }
        }
    }
}
