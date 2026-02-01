import { SiteAdapter } from '../adapters/base';
import { logger } from '../../utils/logger';
import { ToolbarInjector, ToolbarState } from '../injectors/toolbar-injector';

const DEBUG_FLAG_KEY = 'aicopy:debug:selector-observer';

/**
 * SelectorMessageObserver
 *
 * A lightweight, dependency-free, selector-driven observer.
 *
 * Design goals:
 * - Avoid relying on a single "observer container" that may change in SPAs
 * - Detect new messages by scanning added nodes for matches
 * - Keep processing idempotent via messageId Set + WeakSet fallback
 */
export class SelectorMessageObserver {
    private observer: MutationObserver | null = null;
    private adapter: SiteAdapter;
    private injector: ToolbarInjector;
    private onMessageDetected: (element: HTMLElement) => void;

    private processedMessageIds = new Set<string>();
    private processedElements = new WeakSet<HTMLElement>();

    private verboseDebug: boolean = false;

    // Coalesce MutationObserver callbacks without timers.
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

        // Toggle with: localStorage.setItem('aicopy:debug:selector-observer','1')
        // Keep disabled by default to avoid noisy logs on large mutation batches.
        this.verboseDebug = this.readDebugFlag();
    }

    private readDebugFlag(): boolean {
        try {
            return window.localStorage.getItem(DEBUG_FLAG_KEY) === '1';
        } catch {
            return false;
        }
    }

    private dbg(...args: any[]): void {
        if (this.verboseDebug) {
            logger.debug(...args);
        }
    }

    private getConversationKey(): string {
        // Best-effort: namespace by conversation id in URL to avoid ChatGPT reusing
        // message ids like "conversation-turn-4" across different chats.
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

        // Refresh flag in case user toggled it before reload.
        this.verboseDebug = this.readDebugFlag();
        this.dbg('[SelectorObserver][dbg] start()', {
            platform: this.adapter.getPlatformName(),
            readyState: document.readyState,
            url: window.location.href
        });

        // Process existing messages once
        this.processExistingMessages();

        const root = document.body || document.documentElement;
        if (!root) {
            // Avoid timers: wait for DOMContentLoaded and retry once.
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
            // Attributes are often used to tag "turn" elements in SPAs after initial DOM exists.
            // Filter to a few likely keys to reduce noise.
            attributes: true,
            attributeFilter: ['data-turn', 'data-message-author-role', 'data-message-author', 'data-testid']
        });
        logger.info('[SelectorObserver] Started');
    }

    stop(): void {
        this.dbg('[SelectorObserver][dbg] stop()');
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
            // Any DOM change inside an existing message (e.g. action bar/copy button appears)
            // should re-trigger processing so injected toolbars can activate.
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

                // Any node added inside a message should re-trigger that message.
                try {
                    const closest = node.closest(messageSelector);
                    if (closest instanceof HTMLElement) {
                        candidates.push(closest);
                    }
                } catch {
                    // ignore invalid selector edge cases
                }

                // Direct match
                if (node.matches(messageSelector)) {
                    candidates.push(node);
                    continue;
                }

                // Descendant matches
                try {
                    const found = node.querySelectorAll(messageSelector);
                    found.forEach((el) => {
                        if (el instanceof HTMLElement) candidates.push(el);
                    });
                } catch {
                    // Ignore invalid selector edge cases
                }
            }
        }

        if (candidates.length === 0) return;

        this.dbg('[SelectorObserver][dbg] mutations batch', {
            mutationCount: mutations.length,
            addedNodeCount,
            candidateCount: candidates.length
        });

        // De-duplicate within the same mutation batch
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

        this.dbg('[SelectorObserver][dbg] processExistingMessages()', {
            selector,
            count: messages.length
        });

        messages.forEach((el) => {
            if (el instanceof HTMLElement) this.processMessage(el);
        });
    }

    private processMessage(message: HTMLElement): void {
        const state = this.injector.getState(message);

        const messageIdForLog = this.adapter.getMessageId(message);
        this.dbg('[SelectorObserver][dbg] processMessage()', {
            tag: message.tagName,
            messageId: messageIdForLog,
            state,
            hasWrapper: message.querySelector('.aicopy-toolbar-wrapper') !== null,
            hasContainer: message.querySelector('.aicopy-toolbar-container') !== null
        });

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
                    this.dbg('[SelectorObserver][dbg] skip: already processed (by messageId)', messageId);
                    return;
                }
            } else {
                if (this.processedElements.has(message)) {
                    this.dbg('[SelectorObserver][dbg] skip: already processed (by element)');
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

            this.dbg('[SelectorObserver][dbg] marked processed', {
                messageId,
                stateAfter: this.injector.getState(message),
                hasWrapper: !!wrapperAfter,
                hasContainer: !!containerAfter
            });
        } else {
            this.dbg('[SelectorObserver][dbg] NOT marked processed (no injection evidence)', {
                messageId: this.adapter.getMessageId(message),
                stateAfter: this.injector.getState(message)
            });
        }
    }
}
