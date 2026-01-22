import { simpleBookmarkPanel } from '../../bookmarks/components/SimpleBookmarkPanel';
import { logger } from '../../utils/logger';
import { Icons } from '../../assets/icons';

/**
 * Gemini Header Panel Button
 * Adds bookmark panel toggle button next to Gemini logo
 */
export class GeminiPanelButton {
    private button: HTMLElement | null = null;
    private observer: MutationObserver | null = null;

    /**
     * Initialize and inject the header button
     */
    init(): void {
        logger.info('[GeminiPanelButton] Initializing...');

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
            logger.error('[GeminiPanelButton] Failed to inject after maximum attempts');
            return;
        }

        const delay = Math.min(1000 * attempt, 5000); // Max 5 seconds
        logger.debug(`[GeminiPanelButton] Retrying injection in ${delay}ms (attempt ${attempt}/${maxAttempts})`);

        setTimeout(() => {
            if (!this.injectButton()) {
                this.retryInjection(attempt + 1, maxAttempts);
            }
        }, delay);
    }

    /**
     * Inject bookmark panel button into Gemini header
     * @returns true if injection succeeded, false otherwise
     */
    private injectButton(): boolean {
        // Plan A: Use robust data-test-id selector
        // Look for the logo element using stable ID, then get its container (parent)
        const logoElement = document.querySelector('[data-test-id="bard-logo-only"]');
        let logoContainer = logoElement?.parentElement as HTMLElement | null | undefined;

        // Fallback or direct container match if structure differs (support a/span/div)
        if (!logoContainer) {
            logoContainer = document.querySelector<HTMLElement>('.bard-logo-container.logo-only') ||
                document.querySelector<HTMLElement>('.bard-logo-container');
        }

        if (!logoContainer) {
            logger.debug('[GeminiPanelButton] Logo container not found');
            return false;
        }

        // Check if button already exists
        if (document.querySelector('#gemini-bookmark-panel-btn')) {
            logger.debug('[GeminiPanelButton] Button already exists');
            return true;
        }

        // Create button matching Gemini Material Design style
        this.button = this.createButton();

        // Insert after the logo
        logoContainer.appendChild(this.button);

        logger.info('[GeminiPanelButton] Button injected successfully');
        return true;
    }

    /**
     * Create the bookmark panel button matching Gemini Material Design style
     */
    private createButton(): HTMLElement {
        const button = document.createElement('button');
        button.id = 'gemini-bookmark-panel-btn';
        button.className = 'mdc-icon-button mat-mdc-icon-button mat-mdc-button-base';
        button.setAttribute('aria-label', 'View Bookmarks');
        button.setAttribute('type', 'button');
        button.style.cssText = 'margin-left: 12px; color: var(--gem-sys-color--on-surface);';

        // Create Material Design ripple overlay for hover effect
        const overlay = document.createElement('span');
        overlay.className = 'mat-mdc-button-persistent-ripple mdc-icon-button__ripple';
        button.appendChild(overlay);

        // Use brand icon
        button.appendChild(Icons.createBrandIcon());

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
            logger.error('[GeminiPanelButton] Failed to open panel:', error);
        }
    }

    /**
     * Start observing for header changes
     */
    private startObserver(): void {
        this.observer = new MutationObserver(() => {
            // Re-inject if button is missing
            if (!document.querySelector('#gemini-bookmark-panel-btn')) {
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
export const geminiPanelButton = new GeminiPanelButton();
