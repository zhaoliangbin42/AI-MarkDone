import { simpleBookmarkPanel } from '../../bookmarks/components/SimpleBookmarkPanel';
import { logger } from '../../utils/logger';
import { Icons } from '../../assets/icons';

/**
 * Claude Header Panel Button
 * Adds bookmark panel toggle button to Claude.ai header
 * 
 * Injection point: Header action container with chat-actions testid
 * Structure: header > div.right-3 > div[data-testid="chat-actions"]
 * 
 * Button will be inserted BEFORE the Share button inside the chat-actions container
 */
export class ClaudePanelButton {
    private button: HTMLElement | null = null;
    private observer: MutationObserver | null = null;

    /**
     * Initialize and inject the header button
     */
    init(): void {
        logger.info('[ClaudePanelButton] Initializing...');

        // Try to inject immediately
        if (!this.injectButton()) {
            // If failed, retry with increasing delays
            this.retryInjection();
        }

        // Watch for header changes (SPA navigation)
        this.startObserver();
    }

    /**
     * Retry injection with exponential backoff
     */
    private retryInjection(attempt: number = 1, maxAttempts: number = 10): void {
        if (attempt > maxAttempts) {
            logger.error('[ClaudePanelButton] Failed to inject after maximum attempts');
            return;
        }

        const delay = Math.min(1000 * attempt, 5000); // Max 5 seconds
        logger.debug(`[ClaudePanelButton] Retrying injection in ${delay}ms (attempt ${attempt}/${maxAttempts})`);

        setTimeout(() => {
            if (!this.injectButton()) {
                this.retryInjection(attempt + 1, maxAttempts);
            }
        }, delay);
    }

    /**
     * Inject bookmark panel button into Claude header
     * @returns true if injection succeeded, false otherwise
     */
    private injectButton(): boolean {
        // Check if button already exists
        if (document.querySelector('#claude-bookmark-panel-btn')) {
            logger.debug('[ClaudePanelButton] Button already exists');
            return true;
        }

        // Primary selector: Container with chat-actions testid
        // This contains the Share button and other action buttons
        const actionContainer = document.querySelector<HTMLElement>('[data-testid="chat-actions"]');

        if (!actionContainer) {
            logger.debug('[ClaudePanelButton] Chat actions container not found');
            return false;
        }

        // Create button matching Claude's style
        this.button = this.createButton();

        // Insert at the beginning of the container (left of Share button)
        actionContainer.insertBefore(this.button, actionContainer.firstChild);

        logger.info('[ClaudePanelButton] Button injected successfully');
        return true;
    }

    /**
     * Create the bookmark panel button matching Claude's ghost button style
     */
    private createButton(): HTMLElement {
        const button = document.createElement('button');
        button.id = 'claude-bookmark-panel-btn';
        button.setAttribute('aria-label', 'View Bookmarks');
        button.setAttribute('type', 'button');

        // Match Claude's ghost button style
        button.className = 'inline-flex items-center justify-center relative shrink-0 can-focus select-none disabled:pointer-events-none disabled:opacity-50 disabled:shadow-none disabled:drop-shadow-none border-transparent transition font-base duration-300 ease-[cubic-bezier(0.165,0.85,0.45,1)] h-8 w-8 rounded-md active:scale-95 group/btn Button_ghost__BUAoh';

        // Create icon wrapper
        const iconWrapper = document.createElement('div');
        iconWrapper.className = 'flex items-center justify-center text-text-500 group-hover/btn:text-text-100';
        iconWrapper.appendChild(Icons.createBrandIcon());

        // Add padding right for visual balance
        button.style.paddingRight = '8px';

        button.appendChild(iconWrapper);

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
            logger.error('[ClaudePanelButton] Failed to open panel:', error);
        }
    }

    /**
     * Start observing for header changes
     */
    private startObserver(): void {
        this.observer = new MutationObserver(() => {
            // Re-inject if button is missing
            if (!document.querySelector('#claude-bookmark-panel-btn')) {
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
export const claudePanelButton = new ClaudePanelButton();
