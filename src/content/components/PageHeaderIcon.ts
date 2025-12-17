import { logger } from '../../utils/logger';
import { simpleBookmarkPanel } from '../../bookmarks/components/SimpleBookmarkPanel';
import { Icons } from '../../assets/icons';

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
        if (document.querySelector('#ai-markdone-bookmark-btn')) {
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
        button.id = 'ai-markdone-bookmark-btn';
        button.className = 'text-token-text-primary no-draggable hover:bg-token-surface-hover keyboard-focused:bg-token-surface-hover touch:h-10 touch:w-10 flex h-9 w-9 items-center justify-center rounded-lg focus:outline-none disabled:opacity-50';
        button.setAttribute('aria-label', 'View Archive');
        button.setAttribute('type', 'button');

        // Use bookMarked icon from Icons
        button.innerHTML = Icons.bookMarked;

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
            if (!document.querySelector('#ai-markdone-bookmark-btn')) {
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
