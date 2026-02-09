import { logger } from '../../utils/logger';
import { simpleBookmarkPanel } from '../../bookmarks/components/SimpleBookmarkPanel';
import { Icons } from '../../assets/icons';
import { i18n } from '../../utils/i18n';

/**
 * ChatGPT Header Panel Button
 * Adds bookmark panel toggle button to ChatGPT header
 */
export class ChatGPTPanelButton {
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

        logger.info('[ChatGPTPanelButton] Initialized');
    }

    /**
     * Inject bookmark button into header
     */
    private injectButton(): void {
        // Find the header actions container
        const header = document.querySelector('#page-header');
        if (!header) {
            logger.debug('[ChatGPTPanelButton] Header not found, will retry');
            return;
        }

        // Find the inner container with conversation actions
        const actionsContainer = header.querySelector('#conversation-header-actions');
        if (!actionsContainer) {
            logger.debug('[ChatGPTPanelButton] Actions container not found');
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

        logger.info('[ChatGPTPanelButton] Button injected successfully');
    }

    /**
     * Create the archive button element matching ChatGPT style
     */
    private createButton(): HTMLElement {
        const button = document.createElement('button');
        button.id = 'ai-markdone-bookmark-btn';
        button.className = 'text-token-text-primary no-draggable hover:bg-token-surface-hover keyboard-focused:bg-token-surface-hover touch:h-10 touch:w-10 flex h-9 w-9 items-center justify-center rounded-lg focus:outline-none disabled:opacity-50';
        button.setAttribute('aria-label', i18n.t('bookmarks'));
        button.setAttribute('type', 'button');

        // Use brand icon with explicit 18px size for ChatGPT
        const icon = Icons.createBrandIcon();
        icon.style.width = '22px';
        icon.style.height = '22px';
        button.appendChild(icon);

        button.addEventListener('click', () => this.handleClick());

        return button;
    }

    /**
     * Handle button click - open bookmark panel
     */
    private async handleClick(): Promise<void> {
        try {
            await simpleBookmarkPanel.toggle();
        } catch (error) {
            logger.error('[ChatGPTPanelButton] Failed to open panel:', error);
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
export const chatGPTPanelButton = new ChatGPTPanelButton();
