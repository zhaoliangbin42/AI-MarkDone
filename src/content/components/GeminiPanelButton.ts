import { simpleBookmarkPanel } from '../../bookmarks/components/SimpleBookmarkPanel';
import { logger } from '../../utils/logger';

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
        // Find the Gemini logo container - use more specific selector
        const logoContainer = document.querySelector('span.bard-logo-container.logo-only');
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

        // Create Material icon (bookmark icon)
        button.innerHTML = `
            <span class="mat-mdc-button-persistent-ripple mdc-icon-button__ripple"></span>
            <mat-icon role="img" class="mat-icon notranslate gds-icon-l google-symbols mat-ligature-font mat-icon-no-color" 
                      aria-hidden="true" data-mat-icon-type="font" data-mat-icon-name="bookmark" 
                      fonticon="bookmark"></mat-icon>
            <span class="mat-focus-indicator"></span>
            <span class="mat-mdc-button-touch-target"></span>
        `;

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
