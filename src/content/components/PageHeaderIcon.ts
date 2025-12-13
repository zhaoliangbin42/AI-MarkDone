import { logger } from '../../utils/logger';
import { simpleBookmarkPanel } from '../../bookmarks/components/SimpleBookmarkPanel';

/**
 * Page Header Archive Icon
 * Integrates archive button into ChatGPT's native header toolbar
 */
export class PageHeaderIcon {
    private button: HTMLElement | null = null;
    private observer: MutationObserver | null = null;

    /**
     * Initialize and inject the header icon
     */
    init(): void {
        // Try to inject immediately
        this.injectButton();

        // Watch for header changes (SPA navigation)
        this.startObserver();

        logger.info('[PageHeaderIcon] Initialized');
    }

    /**
     * Inject bookmark button into header
     */
    private injectButton(): void {
        // Find the header actions container
        const header = document.querySelector('#page-header');
        if (!header) {
            logger.debug('[PageHeaderIcon] Header not found, will retry');
            return;
        }

        // Find the inner container with conversation actions
        const actionsContainer = header.querySelector('#conversation-header-actions');
        if (!actionsContainer) {
            logger.debug('[PageHeaderIcon] Actions container not found');
            return;
        }

        // Check if button already exists
        if (document.querySelector('#ai-copy-enhance-bookmark-btn')) {
            return;
        }

        // Create button matching ChatGPT style
        this.button = this.createButton();

        // Insert at the beginning of the actions container
        actionsContainer.insertBefore(this.button, actionsContainer.firstChild);

        logger.info('[PageHeaderIcon] Button injected into header');
    }

    /**
     * Create the archive button element matching ChatGPT style
     */
    private createButton(): HTMLElement {
        const button = document.createElement('button');
        button.id = 'ai-copy-enhance-bookmark-btn';
        button.className = 'text-token-text-primary no-draggable hover:bg-token-surface-hover keyboard-focused:bg-token-surface-hover touch:h-10 touch:w-10 flex h-9 w-9 items-center justify-center rounded-lg focus:outline-none disabled:opacity-50';
        button.setAttribute('aria-label', 'View Archive');
        button.setAttribute('type', 'button');

        // Create SVG icon (archive icon)
        button.innerHTML = `
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" class="icon">
                <path d="M3 5C3 3.89543 3.89543 3 5 3H15C16.1046 3 17 3.89543 17 5V6H3V5Z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                <path d="M3 6H17V16C17 17.1046 16.1046 18 15 18H5C3.89543 18 3 17.1046 3 16V6Z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                <path d="M8 10H12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
        `;

        button.addEventListener('click', () => this.handleClick());

        return button;
    }

    /**
     * Handle button click
     */
    private async handleClick(): Promise<void> {
        try {
            await simpleBookmarkPanel.toggle();
        } catch (error) {
            logger.error('[PageHeaderIcon] Failed to open panel:', error);
        }
    }

    /**
     * Start observing for header changes
     */
    private startObserver(): void {
        this.observer = new MutationObserver(() => {
            // Re-inject if button is missing
            if (!document.querySelector('#ai-copy-enhance-bookmark-btn')) {
                this.injectButton();
            }
        });

        this.observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    }

    /**
     * Remove the button and stop observing
     */
    destroy(): void {
        if (this.button) {
            this.button.remove();
            this.button = null;
        }

        if (this.observer) {
            this.observer.disconnect();
            this.observer = null;
        }
    }
}

// Singleton instance
export const pageHeaderIcon = new PageHeaderIcon();
