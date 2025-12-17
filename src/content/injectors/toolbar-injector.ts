import { SiteAdapter } from '../adapters/base';
import { logger } from '../../utils/logger';
import { safeQuerySelector } from '../../utils/dom-utils';

/**
 * Toolbar injector with smart action bar waiting
 * Inspired by successful ChatGPT extensions
 */
export class ToolbarInjector {
    private adapter: SiteAdapter;
    private injectedElements = new WeakSet<HTMLElement>();
    private pendingObservers = new Map<HTMLElement, number>();  // Changed from WeakMap to Map for cleanup

    constructor(adapter: SiteAdapter) {
        this.adapter = adapter;
    }

    /**
     * Inject toolbar into a message element
     */
    inject(messageElement: HTMLElement, toolbar: HTMLElement): boolean {
        // Check if already injected
        if (this.injectedElements.has(messageElement)) {
            logger.debug('Toolbar already injected for this message');
            return false;
        }

        // Check if already has toolbar (injected by previous call)
        if (messageElement.querySelector('.aicopy-toolbar-container')) {
            logger.debug('Toolbar container already exists');
            return false;
        }

        const isArticle = messageElement.tagName.toLowerCase() === 'article';
        const isModelResponse = messageElement.tagName.toLowerCase() === 'model-response';
        const selector = this.adapter.getActionBarSelector();

        if (isArticle) {
            return this.injectArticle(messageElement, toolbar, selector);
        } else if (isModelResponse) {
            // Gemini: action bar is INSIDE model-response
            return this.injectGemini(messageElement, toolbar, selector);
        } else {
            return this.injectNonArticle(messageElement, toolbar, selector);
        }
    }

    /**
     * Inject for article messages with smart waiting
     */
    private injectArticle(article: HTMLElement, toolbar: HTMLElement, selector: string): boolean {
        const actionBar = safeQuerySelector(article, selector);

        if (actionBar) {
            // Action bar already exists, inject immediately
            logger.debug('Action bar found, injecting toolbar');
            return this.doInject(article, actionBar, toolbar);
        } else {
            // Action bar not yet rendered, wait for it
            logger.debug('Action bar not found, waiting for it to appear...');
            this.waitForActionBar(article, toolbar, selector);
            return false;
        }
    }

    /**
     * Inject for Gemini model-response elements
     * Gemini's structure: action bar is INSIDE model-response
     */
    private injectGemini(modelResponse: HTMLElement, toolbar: HTMLElement, selector: string): boolean {
        const actionBar = safeQuerySelector(modelResponse, selector);

        if (actionBar) {
            // Action bar already exists, inject immediately with Gemini-specific padding
            logger.debug('Gemini action bar found, injecting toolbar');
            return this.doInject(modelResponse, actionBar, toolbar, true);
        } else {
            // Action bar not yet rendered, wait for it
            logger.debug('Gemini action bar not found, waiting for it to appear...');
            this.waitForActionBar(modelResponse, toolbar, selector, true);
            return false;
        }
    }

    /**
     * Wait for action bar to appear using interval checking
     */
    private waitForActionBar(article: HTMLElement, toolbar: HTMLElement, selector: string, isGemini: boolean = false): void {
        // Clear any existing observer for this article
        const existingTimer = this.pendingObservers.get(article);
        if (existingTimer) {
            window.clearInterval(existingTimer);
        }

        let attempts = 0;
        const maxAttempts = 15; // 15 seconds max

        const checkInterval = window.setInterval(() => {
            attempts++;

            const actionBar = safeQuerySelector(article, selector);
            if (actionBar) {
                window.clearInterval(checkInterval);
                this.pendingObservers.delete(article);
                logger.debug(`Action bar appeared after ${attempts} seconds`);
                this.doInject(article, actionBar, toolbar, isGemini);
            } else if (attempts >= maxAttempts) {
                window.clearInterval(checkInterval);
                this.pendingObservers.delete(article);
                logger.warn('Action bar did not appear after 15 seconds');
            }
        }, 1000); // Check every 1 second

        this.pendingObservers.set(article, checkInterval);
    }

    /**
     * Inject for non-article messages
     */
    private injectNonArticle(messageElement: HTMLElement, toolbar: HTMLElement, selector: string): boolean {
        const parent = messageElement.parentElement;
        if (!parent) {
            logger.warn('Message element has no parent');
            return false;
        }

        const actionBarContainer = parent.nextElementSibling;
        if (!actionBarContainer) {
            logger.warn('No next sibling found after message parent');
            return false;
        }

        const actionBar = actionBarContainer.matches(selector)
            ? actionBarContainer
            : safeQuerySelector(actionBarContainer as HTMLElement, selector);

        if (!actionBar) {
            logger.warn('Action bar not found in expected location');
            return false;
        }

        return this.doInject(messageElement, actionBar, toolbar);
    }

    /**
     * Perform actual toolbar injection
     */
    private doInject(messageElement: HTMLElement, actionBar: Element, toolbar: HTMLElement, isGemini: boolean = false): boolean {
        // Create wrapper div for toolbar
        const wrapper = document.createElement('div');
        wrapper.className = 'aicopy-toolbar-container';

        // Apply platform-specific styling
        if (isGemini) {
            // Gemini: match official toolbar padding (60px left), no fixed width
            wrapper.style.cssText = 'margin-bottom: 8px; padding-left: 60px;';
        } else {
            // ChatGPT: no extra padding
            wrapper.style.cssText = 'margin-bottom: 0px; margin-top: 10px;';
        }

        wrapper.appendChild(toolbar);

        // Insert wrapper BEFORE the action bar
        actionBar.parentElement?.insertBefore(wrapper, actionBar);

        // Mark as injected
        this.injectedElements.add(messageElement);

        logger.debug('Toolbar injected successfully');
        return true;
    }

    /**
     * Remove toolbar from a message element
     */
    remove(messageElement: HTMLElement): boolean {
        const toolbar = messageElement.querySelector('.aicopy-toolbar-container');
        if (toolbar) {
            toolbar.remove();
            this.injectedElements.delete(messageElement);
            logger.debug('Toolbar removed');
            return true;
        }
        return false;
    }

    /**
     * Check if toolbar is already injected
     */
    isInjected(messageElement: HTMLElement): boolean {
        return this.injectedElements.has(messageElement);
    }

    /**
     * Cleanup all pending observers and reset state
     * Called when ContentScript is stopped (e.g., on page navigation)
     */
    cleanup(): void {
        // Clear all pending interval timers
        this.pendingObservers.forEach((timerId) => {
            window.clearInterval(timerId);
            logger.debug('[Injector] Cleared pending interval timer');
        });

        this.pendingObservers.clear();
        this.injectedElements = new WeakSet<HTMLElement>();

        logger.info('[Injector] Cleaned up all pending observers');
    }
}
