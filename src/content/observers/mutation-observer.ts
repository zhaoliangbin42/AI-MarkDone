import { SiteAdapter } from '../adapters/base';
import { debounce } from '../../utils/dom-utils';
import { logger } from '../../utils/logger';

/**
 * Debounce delays for different operations
 */
const DEBOUNCE_DELAYS = {
    MUTATION: 200,
    SCROLL: 150,
    RESIZE: 300
};
const RESCAN_COOLDOWN_MS = 5000;

/**
 * Message observer that monitors DOM for new messages
 * Uses dual strategy: MutationObserver + Copy Button monitoring
 */
export class MessageObserver {
    private observer: MutationObserver | null = null;
    private copyButtonObserver: MutationObserver | null = null;
    private intersectionObserver: IntersectionObserver | null = null;
    private adapter: SiteAdapter;
    private observerContainer: HTMLElement | null = null;
    private processedMessages = new Set<string>();
    private pendingMessages = new Set<string>();
    private rescanCooldowns = new Map<string, number>();
    private onMessageDetected: (element: HTMLElement) => void;
    private lastCopyButtonCount: number = 0;

    constructor(
        adapter: SiteAdapter,
        onMessageDetected: (element: HTMLElement) => void
    ) {
        this.adapter = adapter;
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
                logger.warn('Observer container not found after 10 attempts');
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
        // Count initial copy buttons
        this.lastCopyButtonCount = document.querySelectorAll('button[aria-label="Copy"]').length;
        logger.debug(`Initial copy button count: ${this.lastCopyButtonCount}`);

        // Debounced handler to prevent multiple rapid triggers
        const handleCopyButtonChange = debounce(() => {
            const currentCount = document.querySelectorAll('button[aria-label="Copy"]').length;
            if (currentCount > this.lastCopyButtonCount) {
                logger.debug(`Copy button added: ${this.lastCopyButtonCount} → ${currentCount}`);
                this.lastCopyButtonCount = currentCount;

                // New copy button = streaming message completed
                // Process only the last article (most recent message)
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
                        if (node.matches('button[aria-label="Copy"]')) {
                            foundNewButton = true;
                            break;
                        }
                        // Or if it contains a copy button
                        if (node.querySelector('button[aria-label="Copy"]')) {
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
        const articles = document.querySelectorAll('article');
        if (articles.length === 0) return;

        const lastArticle = articles[articles.length - 1] as HTMLElement;
        const messageId = this.adapter.getMessageId(lastArticle);

        if (!messageId) {
            logger.debug('Latest article has no ID, processing anyway');
            this.onMessageDetected(lastArticle);
            return;
        }

        // Check if already processed
        if (this.processedMessages.has(messageId)) {
            // Check if toolbar is missing
            const hasToolbar = lastArticle.querySelector('.aicopy-toolbar-container');
            if (!hasToolbar) {
                logger.debug('Latest message processed but toolbar missing, retrying:', messageId);
                this.onMessageDetected(lastArticle);
            }
            return;
        }

        // Mark as processed and inject toolbar
        this.processedMessages.add(messageId);
        logger.debug('New streaming message completed:', messageId);
        this.onMessageDetected(lastArticle);
    }

    /**
     * Setup IntersectionObserver to detect messages entering viewport
     */
    private setupIntersectionObserver(): void {
        this.intersectionObserver = new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                if (entry.isIntersecting && entry.target instanceof HTMLElement) {
                    const messageId = this.adapter.getMessageId(entry.target);
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
        this.rescanCooldowns.clear();

        logger.info('Message observer stopped');
    }

    /**
     * Handle DOM mutations
     */
    private handleMutations(mutations: MutationRecord[]): void {
        logger.debug('Processing mutations:', mutations.length);

        this.ensureObserverContainer();

        // Check if streaming is in progress
        const isStreaming = this.adapter.isStreamingMessage(document.body);
        if (isStreaming) {
            logger.debug('Streaming in progress, delaying processing');
            return;
        }

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
                    const hasToolbar = message.querySelector('.aicopy-toolbar-container');
                    if (!hasToolbar && this.shouldRescan(fallbackId)) {
                        this.markRescan(fallbackId);
                        this.onMessageDetected(message);
                    }
                    return;
                }

                const isArticleFallback = message.tagName.toLowerCase() === 'article';
                if (isArticleFallback) {
                    const hasActionBar = message.querySelector('div.z-0') !== null;
                    if (!hasActionBar) {
                        if (this.pendingMessages.has(fallbackId)) {
                            return;
                        }
                        this.pendingMessages.add(fallbackId);
                        newMessages++;
                        this.onMessageDetected(message);
                        return;
                    }
                }
                this.processedMessages.add(fallbackId);
                newMessages++;
                this.onMessageDetected(message);
                return;
            }

            // Check if message is still streaming (missing action bar DOM)
            const isArticle = message.tagName.toLowerCase() === 'article';
            if (isArticle) {
                // For article messages, check if action bar exists
                const hasActionBar = message.querySelector('div.z-0') !== null;
                if (!hasActionBar) {
                    logger.debug('Message still streaming (no action bar), skipping:', messageId);
                    if (this.pendingMessages.has(messageId)) {
                        return;
                    }
                    this.pendingMessages.add(messageId);
                    newMessages++;
                    this.onMessageDetected(message);
                    return;
                }
            }

            // Skip if already processed
            if (this.processedMessages.has(messageId)) {
                // Still try to inject toolbar if it's missing (handles late-loading action bars)
                const hasToolbar = message.querySelector('.aicopy-toolbar-container');
                if (!hasToolbar) {
                    logger.debug('Message processed but toolbar missing, retrying injection:', messageId);
                    if (this.shouldRescan(messageId)) {
                        this.markRescan(messageId);
                        this.onMessageDetected(message);
                    }
                }
                return;
            }

            // Mark as processed
            this.processedMessages.add(messageId);
            this.pendingMessages.delete(messageId);
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
        this.pendingMessages.clear();
        this.rescanCooldowns.clear();
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
        this.pendingMessages.clear();
        this.rescanCooldowns.clear();

        this.observer = new MutationObserver((mutations) => {
            this.handleMutations(mutations);
        });
        this.observer.observe(container, { childList: true, subtree: true, attributes: false });
        logger.info('[Observer] Rebound to new container');
        this.processExistingMessages();
    }

    private shouldRescan(messageId: string): boolean {
        const lastAttempt = this.rescanCooldowns.get(messageId) ?? 0;
        return Date.now() - lastAttempt >= RESCAN_COOLDOWN_MS;
    }

    private markRescan(messageId: string): void {
        this.rescanCooldowns.set(messageId, Date.now());
    }
}
