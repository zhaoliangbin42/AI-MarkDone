import { SiteAdapter } from '../adapters/base';
import { debounce } from '../../utils/dom-utils';
import { logger } from '../../utils/logger';
import { ToolbarInjector } from '../injectors/toolbar-injector';


/**
 * Debounce delays for different operations
 */
const DEBOUNCE_DELAYS = {
    MUTATION: 200,
    SCROLL: 150,
    RESIZE: 300
};


/**
 * Message observer that monitors DOM for new messages
 * Uses dual strategy: MutationObserver + Copy Button monitoring
 */
export class MessageObserver {
    private observer: MutationObserver | null = null;
    private copyButtonObserver: MutationObserver | null = null;
    private intersectionObserver: IntersectionObserver | null = null;
    private adapter: SiteAdapter;
    private injector: ToolbarInjector; // Dependency for reconciliation
    private observerContainer: HTMLElement | null = null;
    private processedMessages = new Set<string>();

    private onMessageDetected: (element: HTMLElement) => void;
    private lastCopyButtonCount: number = 0;

    constructor(
        adapter: SiteAdapter,
        injector: ToolbarInjector,
        onMessageDetected: (element: HTMLElement) => void
    ) {
        this.adapter = adapter;
        this.injector = injector;
        this.onMessageDetected = onMessageDetected;
        this.handleMutations = debounce(this.handleMutations.bind(this), DEBOUNCE_DELAYS.MUTATION);
    }

    /**
     * Start observing the DOM
     */
    start(): void {
        this.startWithRetry(0);
    }

    /**
     * Start with retry mechanism for delayed container loading
     */
    private startWithRetry(attempt: number): void {
        const container = this.adapter.getObserverContainer();

        if (!container) {
            if (attempt < 10) {
                logger.debug(`Observer container not found, retrying (${attempt + 1}/10)...`);
                setTimeout(() => this.startWithRetry(attempt + 1), 500);
                return;
            } else {
                // Do NOT give up permanently: some SPA states may delay container creation
                // for longer than 5s, and a permanent stop causes a global "no toolbar" failure.
                logger.warn('Observer container not found after 10 attempts; will keep retrying (2s interval)');
                setTimeout(() => this.startWithRetry(attempt + 1), 2000);
                return;
            }
        }

        logger.info('Starting message observer (dual strategy: MutationObserver + Copy Button monitoring)');

        // Strategy 1: MutationObserver for general DOM changes
        this.observer = new MutationObserver((mutations) => {
            this.handleMutations(mutations);
        });

        this.observerContainer = container;
        this.observer.observe(container, {
            childList: true,
            subtree: true,
            attributes: false // Performance optimization
        });

        // Strategy 2: Monitor copy buttons specifically for streaming completion
        this.setupCopyButtonMonitoring();

        // Process existing messages immediately
        this.processExistingMessages();

        // Also process after a short delay to catch late-loading messages
        setTimeout(() => {
            logger.debug('Re-processing messages after delay');
            this.processExistingMessages();
        }, 1000);

        // And one more time after longer delay for slow connections
        setTimeout(() => {
            logger.debug('Re-processing messages after extended delay');
            this.processExistingMessages();
        }, 3000);

        // Setup IntersectionObserver to catch messages entering viewport
        this.setupIntersectionObserver();

        logger.debug('Setup complete: MutationObserver + Copy Button Monitor + IntersectionObserver');
    }


    /**
     * Setup copy button monitoring for streaming completion detection
     * This is more reliable than waiting for action bars
     */
    private setupCopyButtonMonitoring(): void {
        // P0: Use adapter to get copy button selector
        const selector = this.adapter.getCopyButtonSelector();

        // Count initial copy buttons
        this.lastCopyButtonCount = document.querySelectorAll(selector).length;
        logger.debug(`Initial copy button count: ${this.lastCopyButtonCount}`);

        // Debounced handler to prevent multiple rapid triggers
        const handleCopyButtonChange = debounce(() => {
            const currentCount = document.querySelectorAll(selector).length;
            if (currentCount > this.lastCopyButtonCount) {
                logger.debug(`Copy button added: ${this.lastCopyButtonCount} → ${currentCount}`);
                this.lastCopyButtonCount = currentCount;

                // New copy button = streaming message completed
                // Handle streaming completion (inject or activate)
                this.processLatestMessage();
            }
        }, 300); // 300ms debounce to prevent multiple triggers

        // Monitor for new copy buttons being added
        this.copyButtonObserver = new MutationObserver((mutations) => {
            // Check if any mutation added a copy button
            let foundNewButton = false;

            for (const mutation of mutations) {
                for (const node of mutation.addedNodes) {
                    if (node instanceof HTMLElement) {
                        // Check if the node itself is a copy button
                        if (node.matches(selector)) {
                            foundNewButton = true;
                            break;
                        }
                        // Or if it contains a copy button
                        if (node.querySelector(selector)) {
                            foundNewButton = true;
                            break;
                        }
                    }
                }
                if (foundNewButton) break;
            }

            if (foundNewButton) {
                handleCopyButtonChange();
            }
        });

        // Observe the entire document for copy button additions
        this.copyButtonObserver.observe(document.body, {
            childList: true,
            subtree: true,
            attributes: false
        });

        logger.debug('Copy button monitoring active');
    }

    /**
     * Process only the latest message (for streaming completion)
     */
    private processLatestMessage(): void {
        const selector = this.adapter.getMessageSelector();
        const messages = document.querySelectorAll(selector);
        if (messages.length === 0) return;

        const lastMessage = messages[messages.length - 1] as HTMLElement;
        // Re-inject toolbar after stream complete
        this.injector.reconcileToolbarPosition(lastMessage);

        const messageId = this.adapter.getMessageId(lastMessage);

        if (!messageId) {
            logger.debug('Latest message has no ID, processing anyway');
            this.onMessageDetected(lastMessage);
            return;
        }

        // FORCE update when copy buttons change (Streaming -> Done)
        // index.ts will handle idempotency and setPending(false)
        if (this.processedMessages.has(messageId)) {
            logger.debug('[WordCountDebug] Streaming completion detected for known message (Copy button), forcing update:', messageId);
        } else {
            logger.debug('[WordCountDebug] New streaming message completed:', messageId);
            this.processedMessages.add(messageId);
        }

        this.onMessageDetected(lastMessage);
    }

    /**
     * Setup IntersectionObserver to detect messages entering viewport
     */
    private setupIntersectionObserver(): void {
        this.intersectionObserver = new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                if (entry.isIntersecting && entry.target instanceof HTMLElement) {
                    const messageId = this.adapter.getMessageId(entry.target);
                    // Reconcile on visibility
                    this.injector.reconcileToolbarPosition(entry.target);

                    if (messageId && !this.processedMessages.has(messageId)) {
                        logger.debug('Message entered viewport:', messageId);
                        this.processedMessages.add(messageId);
                        this.onMessageDetected(entry.target);
                    }
                }
            });
        }, {
            root: null,
            rootMargin: '50px',
            threshold: 0.1
        });

        // Observe all current messages
        const messages = document.querySelectorAll(this.adapter.getMessageSelector());
        messages.forEach((msg) => {
            if (msg instanceof HTMLElement) {
                this.intersectionObserver?.observe(msg);
            }
        });
    }

    /**
     * Stop observing
     */
    stop(): void {
        if (this.observer) {
            this.observer.disconnect();
            this.observer = null;
        }

        if (this.copyButtonObserver) {
            this.copyButtonObserver.disconnect();
            this.copyButtonObserver = null;
        }

        if (this.intersectionObserver) {
            this.intersectionObserver.disconnect();
            this.intersectionObserver = null;
        }
        this.observerContainer = null;

        logger.info('Message observer stopped');
    }

    /**
     * Handle DOM mutations
     */
    private handleMutations(_mutations: MutationRecord[]): void {
        // Trigger Reconciliation Loop - processed inside processExistingMessages
        // this.reconcileAllMessages();

        this.ensureObserverContainer();
        this.processExistingMessages();
    }



    /**
     * Process all existing messages in the DOM
     */
    private processExistingMessages(): void {
        const messages = document.querySelectorAll(this.adapter.getMessageSelector());
        logger.debug(`Found ${messages.length} messages (${this.processedMessages.size} already processed)`);


        let newMessages = 0;
        messages.forEach((message) => {
            if (!(message instanceof HTMLElement)) return;

            const messageId = this.adapter.getMessageId(message);
            if (!messageId) {
                // Generate a fallback ID based on position if no ID attribute
                const fallbackId = `msg-${Array.from(messages).indexOf(message)}`;
                logger.debug('Message has no ID, using fallback:', fallbackId);

                if (this.processedMessages.has(fallbackId)) {
                    // Only reconcile if wrapper already exists (position correction)
                    const wrapper = message.querySelector('.aicopy-toolbar-wrapper');
                    if (wrapper) {
                        this.injector.reconcileToolbarPosition(message);
                    }
                    return;
                }

                // New message: let handleNewMessage inject it
                this.processedMessages.add(fallbackId);
                newMessages++;
                this.onMessageDetected(message);
                return;
            }

            // Only reconcile if wrapper already exists (position correction)
            const wrapper = message.querySelector('.aicopy-toolbar-wrapper');
            if (wrapper) {
                this.injector.reconcileToolbarPosition(message);
            }

            // Skip if already processed
            if (this.processedMessages.has(messageId)) {
                return;
            }

            // Mark as processed
            this.processedMessages.add(messageId);
            newMessages++;

            // Trigger callback
            logger.debug('New message detected:', messageId);
            this.onMessageDetected(message);

            // Also observe with IntersectionObserver for future viewport checks
            if (this.intersectionObserver) {
                this.intersectionObserver.observe(message);
            }
        });

        if (newMessages > 0) {
            logger.info(`Processed ${newMessages} new message(s)`);
        }
    }

    /**
     * Reset processed messages (useful for testing)
     */
    reset(): void {
        this.processedMessages.clear();
        this.lastCopyButtonCount = 0;
        logger.info('Observer reset');
    }

    private ensureObserverContainer(): void {
        const currentContainer = this.adapter.getObserverContainer();
        if (!currentContainer) return;

        if (this.observerContainer && this.observerContainer.isConnected && currentContainer === this.observerContainer) {
            return;
        }

        this.rebindObserverContainer(currentContainer);
    }

    private rebindObserverContainer(container: HTMLElement): void {
        if (this.observer) {
            this.observer.disconnect();
        }
        this.observerContainer = container;
        this.processedMessages.clear();

        this.observer = new MutationObserver((mutations) => {
            this.handleMutations(mutations);
        });
        this.observer.observe(container, { childList: true, subtree: true, attributes: false });
        logger.info('[Observer] Rebound to new container');
        this.processExistingMessages();
    }
}
