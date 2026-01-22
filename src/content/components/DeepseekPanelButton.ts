import { simpleBookmarkPanel } from '../../bookmarks/components/SimpleBookmarkPanel';
import { logger } from '../../utils/logger';
import { Icons } from '../../assets/icons';

/**
 * Deepseek Header Panel Button
 * Adds bookmark panel toggle button to Deepseek header
 * 
 * DOM Structure of Deepseek header:
 * ```
 * _2be88ba (header navigation bar)
 * ├── f8d1e4c0 (title container)
 * │   └── div[style*="flex: 1"] (centered flex container)
 * │       └── div.afa34042 (title text)
 * ├── _0efe408 (left button group)
 * └── ds-icon-button--l (share button)
 * ```
 * 
 * Positioning Strategy:
 * Insert button in the centered flex container, right after the title text.
 * This places the button immediately to the right of the title, centered with it.
 * 
 * Uses unified Icons.bookMarked for cross-platform consistency.
 */
export class DeepseekPanelButton {
    private button: HTMLElement | null = null;
    private observer: MutationObserver | null = null;

    /**
     * Initialize and inject the header button
     */
    init(): void {
        logger.info('[DeepseekPanelButton] Initializing...');

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
            logger.error('[DeepseekPanelButton] Failed to inject after maximum attempts');
            return;
        }

        const delay = Math.min(1000 * attempt, 5000); // Max 5 seconds
        logger.debug(`[DeepseekPanelButton] Retrying injection in ${delay}ms (attempt ${attempt}/${maxAttempts})`);

        setTimeout(() => {
            if (!this.injectButton()) {
                this.retryInjection(attempt + 1, maxAttempts);
            }
        }, delay);
    }

    /**
     * Inject bookmark panel button into Deepseek header
     * @returns true if injection succeeded, false otherwise
     */
    private injectButton(): boolean {
        // Check if button already exists
        if (document.querySelector('#deepseek-bookmark-panel-btn')) {
            logger.debug('[DeepseekPanelButton] Button already exists');
            return true;
        }

        // Find the title container
        // Look for the div with class f8d1e4c0 (title container)
        const titleContainer = document.querySelector<HTMLElement>('.f8d1e4c0');
        if (!titleContainer) {
            logger.debug('[DeepseekPanelButton] Title container not found');
            return false;
        }

        // Find the centered flex container inside (has flex: 1 style)
        const centeredContainer = titleContainer.querySelector<HTMLElement>('div[style*="flex"]');
        if (!centeredContainer) {
            logger.debug('[DeepseekPanelButton] Centered container not found');
            return false;
        }

        // Create button
        this.button = this.createButton();

        // Append to the centered container (after title text)
        // This places button immediately to the right of the title
        centeredContainer.appendChild(this.button);

        logger.info('[DeepseekPanelButton] Button injected successfully');
        return true;
    }

    /**
     * Create the bookmark panel button
     */
    private createButton(): HTMLElement {
        const button = document.createElement('div');
        button.id = 'deepseek-bookmark-panel-btn';
        // Use same class structure as other icon buttons
        button.className = 'ds-icon-button ds-icon-button--l';
        button.setAttribute('tabindex', '0');
        button.setAttribute('role', 'button');
        button.setAttribute('aria-disabled', 'false');
        button.setAttribute('aria-label', 'View Bookmarks');

        // Spacing and height to match Deepseek's design
        button.style.marginLeft = '12px';
        button.style.height = '40px';

        // Create hover background layer
        const hoverBg = document.createElement('div');
        hoverBg.className = 'ds-icon-button__hover-bg';
        button.appendChild(hoverBg);

        // Create icon container with brand icon
        const iconContainer = document.createElement('div');
        iconContainer.className = 'ds-icon';
        iconContainer.appendChild(Icons.createBrandIcon());
        iconContainer.style.width = '22px';
        iconContainer.style.height = '22px';

        button.appendChild(iconContainer);

        // Create focus ring
        const focusRing = document.createElement('div');
        focusRing.className = 'ds-focus-ring';
        button.appendChild(focusRing);

        // Add click handler
        button.addEventListener('click', () => this.handleClick());

        // Add keyboard accessibility
        button.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                this.handleClick();
            }
        });

        return button;
    }

    /**
     * Handle button click - open bookmark panel
     */
    private async handleClick(): Promise<void> {
        try {
            await simpleBookmarkPanel.toggle();
        } catch (error) {
            logger.error('[DeepseekPanelButton] Failed to open panel:', error);
        }
    }

    /**
     * Start observing for header changes
     */
    private startObserver(): void {
        this.observer = new MutationObserver(() => {
            // Re-inject if button is missing
            if (!document.querySelector('#deepseek-bookmark-panel-btn')) {
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
export const deepseekPanelButton = new DeepseekPanelButton();
