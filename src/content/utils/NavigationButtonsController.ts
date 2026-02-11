/**
 * Navigation Buttons Controller - Fully Modular
 * 
 * Manages left/right navigation buttons for pagination.
 * Always inline with pagination dots.
 * 
 * Zero coupling with other modules.
 */

import { logger } from '../../utils/logger';

export interface NavigationButtonsConfig {
    onPrevious: () => void;
    onNext: () => void;
    canGoPrevious: boolean;
    canGoNext: boolean;
}

export class NavigationButtonsController {
    private config: NavigationButtonsConfig;
    private leftButton: HTMLElement;
    private rightButton: HTMLElement;
    private destroyed: boolean = false;
    private abortController: AbortController | null = null;

    /**
     * @param leftButton - Existing DOM element for left navigation
     * @param rightButton - Existing DOM element for right navigation
     * @param config - Configuration options
     */
    constructor(leftButton: HTMLElement, rightButton: HTMLElement, config: NavigationButtonsConfig) {
        if (!leftButton || !rightButton) {
            throw new Error('[NavigationButtonsController] Constructor requires valid left and right button elements.');
        }
        this.leftButton = leftButton;
        this.rightButton = rightButton;
        this.config = config;
    }

    /**
     * Render navigation buttons (Bind events)
     * Note: Does NOT create elements, only binds logic.
     */
    render(): void {
        if (this.destroyed) {
            logger.warn('[NavigationButtons] Cannot render: controller is destroyed');
            return;
        }

        // Cleanup previous listeners if any
        if (this.abortController) {
            this.abortController.abort();
        }
        this.abortController = new AbortController();
        const { signal } = this.abortController;

        // Bind events
        this.leftButton.addEventListener('click', (e) => {
            e.stopPropagation();
            this.config.onPrevious();
        }, { signal });

        this.rightButton.addEventListener('click', (e) => {
            e.stopPropagation();
            this.config.onNext();
        }, { signal });

        // Update enabled state
        this.updateButtonStates();
    }

    /**
     * Update button enabled/disabled states
     */
    updateButtonStates(): void {
        if (this.destroyed) return;

        if (this.config.canGoPrevious) {
            this.leftButton.removeAttribute('disabled');
            this.leftButton.classList.remove('disabled');
        } else {
            this.leftButton.setAttribute('disabled', 'true');
            this.leftButton.classList.add('disabled');
        }

        if (this.config.canGoNext) {
            this.rightButton.removeAttribute('disabled');
            this.rightButton.classList.remove('disabled');
        } else {
            this.rightButton.setAttribute('disabled', 'true');
            this.rightButton.classList.add('disabled');
        }
    }

    /**
     * Update configuration (e.g., when navigating)
     */
    updateConfig(config: Partial<NavigationButtonsConfig>): void {
        this.config = { ...this.config, ...config };
        this.updateButtonStates();
    }

    /**
     * Get button elements
     */
    getButtons(): { left: HTMLElement; right: HTMLElement } {
        return {
            left: this.leftButton,
            right: this.rightButton
        };
    }

    /**
     * Cleanup
     * STRICT AUDIT: Only aborts events, NEVER removes DOM elements.
     */
    destroy(): void {
        if (this.destroyed) return;

        // Abort all event listeners
        this.abortController?.abort();
        this.abortController = null;

        // Mark as destroyed but keep references (or nullify if preferred, but DOM stays)
        this.destroyed = true;
    }
}
