/**
 * Navigation Buttons Controller - Fully Modular
 * 
 * Manages left/right navigation buttons for pagination.
 * Always inline with pagination dots.
 * 
 * Zero coupling with other modules.
 */

export interface NavigationButtonsConfig {
    onPrevious: () => void;
    onNext: () => void;
    canGoPrevious: boolean;
    canGoNext: boolean;
}

export class NavigationButtonsController {
    private container: HTMLElement;
    private config: NavigationButtonsConfig;
    private leftButton: HTMLElement | null = null;
    private rightButton: HTMLElement | null = null;
    private destroyed: boolean = false;

    constructor(container: HTMLElement, config: NavigationButtonsConfig) {
        this.container = container;
        this.config = config;
    }

    /**
     * Render navigation buttons
     */
    render(): void {
        if (this.destroyed) {
            console.warn('[NavigationButtons] Cannot render: controller is destroyed');
            return;
        }

        // Create buttons
        this.leftButton = this.createButton('left', '◀', this.config.onPrevious);
        this.rightButton = this.createButton('right', '▶', this.config.onNext);

        // Insert left button at beginning, right button at end
        this.container.insertBefore(this.leftButton, this.container.firstChild);
        this.container.appendChild(this.rightButton);

        // Update enabled state
        this.updateButtonStates();
    }

    /**
     * Create a single navigation button
     */
    private createButton(direction: 'left' | 'right', icon: string, onClick: () => void): HTMLElement {
        const button = document.createElement('button');
        button.className = `aicopy-nav-button aicopy-nav-button-${direction}`;
        button.innerHTML = icon;
        button.setAttribute('aria-label', direction === 'left' ? 'Previous message' : 'Next message');

        button.addEventListener('click', (e) => {
            e.stopPropagation();
            onClick();
        });

        return button;
    }

    /**
     * Update button enabled/disabled states
     */
    updateButtonStates(): void {
        if (!this.leftButton || !this.rightButton) return;

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
    getButtons(): { left: HTMLElement | null; right: HTMLElement | null } {
        return {
            left: this.leftButton,
            right: this.rightButton
        };
    }

    /**
     * Cleanup
     */
    destroy(): void {
        if (this.destroyed) return;

        this.leftButton?.remove();
        this.rightButton?.remove();
        this.leftButton = null;
        this.rightButton = null;
        this.destroyed = true;
    }
}
