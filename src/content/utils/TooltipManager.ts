/**
 * Modular Tooltip Manager for Shadow DOM Environments
 * 
 * Design Principles:
 * - Reusable across any Shadow DOM component
 * - No dependencies on specific DOM structures
 * - Integrates with DesignTokens for consistent theming
 * - GPU-accelerated animations
 * - Defensive error handling
 * 
 * @example
 * const tooltip = new TooltipManager(shadowRoot);
 * tooltip.attach(dotElement, { index: 0, text: "User prompt..." });
 * tooltip.destroy(); // Cleanup
 */

import { logger } from '../../utils/logger';

export interface TooltipConfig {
    index: number;
    text: string;
    maxLength?: number;
}

export class TooltipManager {
    private shadowRoot: ShadowRoot;
    private tooltip: HTMLElement | null = null;
    private showTimeout: number | null = null;
    private currentTarget: HTMLElement | null = null;
    private destroyed: boolean = false;
    private cleanupCallbacks: (() => void)[] = [];

    constructor(shadowRoot: ShadowRoot) {
        this.shadowRoot = shadowRoot;
    }

    /**
     * Attach tooltip to an element
     * @param element Target element
     * @param config Tooltip configuration
     */
    attach(element: HTMLElement, config: TooltipConfig): void {
        if (this.destroyed) {
            console.warn('[TooltipManager] Cannot attach: manager is destroyed');
            return;
        }

        const handleMouseEnter = () => this.scheduleShow(element, config);
        const handleMouseLeave = () => this.cancelScheduled();

        element.addEventListener('mouseenter', handleMouseEnter);
        element.addEventListener('mouseleave', handleMouseLeave);

        // Track for cleanup
        this.cleanupCallbacks.push(() => {
            element.removeEventListener('mouseenter', handleMouseEnter);
            element.removeEventListener('mouseleave', handleMouseLeave);
        });
    }

    /**
     * Debounced show - prevents rapid flickering
     */
    private scheduleShow(target: HTMLElement, config: TooltipConfig): void {
        this.cancelScheduled();
        this.currentTarget = target;

        this.showTimeout = window.setTimeout(() => {
            if (this.currentTarget === target && this.isConnected()) {
                this.show(target, config);
            }
        }, 150); // 150ms debounce
    }

    /**
     * Cancel scheduled tooltip and hide if visible
     */
    private cancelScheduled(): void {
        if (this.showTimeout !== null) {
            clearTimeout(this.showTimeout);
            this.showTimeout = null;
        }
        this.currentTarget = null;
        this.hide();
    }

    /**
     * Show tooltip above target element
     */
    private show(target: HTMLElement, config: TooltipConfig): void {
        // Create tooltip element if not exists
        if (!this.tooltip) {
            this.tooltip = this.createTooltip();
        }

        // Truncate text
        const maxLen = config.maxLength || 50;
        const text = config.text.length > maxLen
            ? config.text.slice(0, maxLen - 3) + '...'
            : config.text;

        // Update content
        this.tooltip.innerHTML = `
            <span class="tooltip-index">${config.index + 1}</span>
            <span class="tooltip-prompt">${this.escapeHtml(text)}</span>
        `;

        // 1. Append to TARGET (Dot) - This automatically handles positioning context
        target.appendChild(this.tooltip);

        // 2. Clear any inline styles from previous approach
        this.tooltip.style.left = '';
        this.tooltip.style.top = '';
        this.tooltip.style.bottom = '';

        this.tooltip.classList.remove('visible');

        // 3. Show with transition
        requestAnimationFrame(() => {
            if (this.tooltip) {
                this.tooltip.classList.add('visible');
                logger.debug('[TooltipManager] Appended to dot & visible');
            }
        });
    }

    /**
     * Hide tooltip with fade out
     */
    private hide(): void {
        this.tooltip?.classList.remove('visible');
    }

    /**
     * Create tooltip element
     */
    private createTooltip(): HTMLElement {
        const el = document.createElement('div');
        el.className = 'aicopy-tooltip';
        return el;
    }

    /**
     * Escape HTML to prevent XSS
     */
    private escapeHtml(text: string): string {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    /**
     * Check if shadow root is still connected to DOM
     */
    private isConnected(): boolean {
        return this.shadowRoot.host.isConnected;
    }

    /**
     * Cleanup and remove all event listeners
     */
    destroy(): void {
        if (this.destroyed) return;

        this.cancelScheduled();
        this.cleanupCallbacks.forEach(cb => cb());
        this.cleanupCallbacks = [];
        this.tooltip?.remove();
        this.tooltip = null;
        this.destroyed = true;
    }
}

/**
 * Tooltip CSS styles (inject into Shadow DOM)
 * Uses design tokens for consistent theming
 */
export const tooltipStyles = `
.aicopy-tooltip {
  position: absolute;
  /* Position relative to the DOT */
  bottom: var(--aimd-space-6);
  left: 50%;
  transform: translateX(-50%) translateY(4px);
  
  background: var(--aimd-tooltip-bg);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  color: var(--aimd-tooltip-text);
  border-radius: var(--aimd-radius-lg);
  padding: var(--aimd-space-2) var(--aimd-space-3);
  box-shadow: var(--aimd-tooltip-shadow);
  border: 1px solid var(--aimd-tooltip-border);
  
  display: flex;
  flex-direction: column;
  gap: var(--aimd-space-1);
  width: max-content;
  max-width: 260px;
  text-align: center;
  pointer-events: none;
  z-index: var(--aimd-z-tooltip);
  
  /* Hidden by default */
  opacity: 0;
  visibility: hidden;
  will-change: opacity, transform;
  transition: opacity var(--aimd-duration-base) ease, transform var(--aimd-duration-base) ease;
}

.aicopy-tooltip.visible {
  opacity: 1;
  visibility: visible;
  transform: translateX(-50%) translateY(0);
}

/* Arrow indicator */
.aicopy-tooltip::after {
  content: '';
  position: absolute;
  bottom: -6px;
  left: 50%;
  transform: translateX(-50%);
  width: 0;
  height: 0;
  border-left: 6px solid transparent;
  border-right: 6px solid transparent;
  border-top: 6px solid var(--aimd-tooltip-bg);
}

.tooltip-index {
  font-weight: 800;
  font-size: 18px;
  color: var(--aimd-interactive-primary);
  letter-spacing: 0.5px;
  text-transform: uppercase;
}

.tooltip-prompt {
  font-size: var(--aimd-text-sm);
  color: var(--aimd-tooltip-prompt-color);
  white-space: normal;
  line-height: 1.4;
  word-break: break-word;
}

@media (prefers-reduced-motion: reduce) {
  .aicopy-tooltip { transition: none; }
}
`;
