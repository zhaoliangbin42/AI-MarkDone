import { simpleBookmarkPanel } from '../../bookmarks/components/SimpleBookmarkPanel';
import { logger } from '../../utils/logger';
import { Icons } from '../../assets/icons';

/**
 * Claude Header Panel Button
 * Adds bookmark panel toggle button to Claude.ai header
 * 
 * Injection point: Top-right action container (div.fixed.right-3.z-header)
 * This container holds the user profile button in a flex layout with gap-3.5
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
        // Primary selector: Top-right action container with z-header class
        // This is a flex container that holds the user profile button
        const actionContainer = document.querySelector<HTMLElement>('div.fixed.right-3.z-header');

        if (!actionContainer) {
            logger.debug('[ClaudePanelButton] Action container not found');
            return false;
        }

        // Check if button already exists
        if (document.querySelector('#claude-bookmark-panel-btn')) {
            logger.debug('[ClaudePanelButton] Button already exists');
            return true;
        }

        // Create button matching Claude's style
        this.button = this.createButton();

        // Insert at the beginning of the container (left of profile button)
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

        // Match Claude's ghost button styling
        // Claude uses inline-flex, rounded-md, and specific padding for icon buttons
        button.style.cssText = `
            display: inline-flex;
            align-items: center;
            justify-content: center;
            width: 32px;
            height: 32px;
            border-radius: 8px;
            border: none;
            background: transparent;
            cursor: pointer;
            transition: background-color 0.15s ease;
            color: var(--text-secondary, #6B7280);
        `;

        // Add hover effect via event listeners (since we can't inject CSS)
        button.addEventListener('mouseenter', () => {
            button.style.backgroundColor = 'rgba(0, 0, 0, 0.05)';
            button.style.color = 'var(--text-primary, #1F2937)';
        });
        button.addEventListener('mouseleave', () => {
            button.style.backgroundColor = 'transparent';
            button.style.color = 'var(--text-secondary, #6B7280)';
        });

        // Use bookMarked icon from Icons
        button.innerHTML = Icons.bookMarked;

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
