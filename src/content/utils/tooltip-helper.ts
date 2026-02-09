/**
 * Custom tooltip helper for Gemini-style tooltips
 * Creates and manages tooltip elements with show/hide logic
 */
export class TooltipHelper {
    private static tooltipContainer: HTMLElement | null = null;
    private static activeTooltip: HTMLElement | null = null;
    private static hideTimeout: number | null = null;

    /**
     * Initialize tooltip container (call once)
     */
    static init(): void {
        if (this.tooltipContainer) return;

        this.tooltipContainer = document.createElement('div');
        this.tooltipContainer.className = 'aicopy-tooltip-container';
        this.tooltipContainer.style.cssText = `
      position: fixed;
      z-index: var(--aimd-z-tooltip);
      pointer-events: none;
    `;
        document.body.appendChild(this.tooltipContainer);
    }

    /**
     * Attach tooltip to a button
     */
    static attach(button: HTMLElement, text: string): void {
        this.init();

        button.addEventListener('mouseenter', () => {
            this.show(button, text);
        });

        button.addEventListener('mouseleave', () => {
            this.hide();
        });
    }

    /**
     * Show tooltip
     */
    private static show(anchor: HTMLElement, text: string): void {
        // Cancel any pending hide timeout
        if (this.hideTimeout !== null) {
            clearTimeout(this.hideTimeout);
            this.hideTimeout = null;
        }

        // Remove existing tooltip immediately (no fade out)
        if (this.activeTooltip) {
            this.activeTooltip.remove();
            this.activeTooltip = null;
        }

        // Create tooltip element
        const tooltip = document.createElement('div');
        tooltip.className = 'aicopy-tooltip';
        tooltip.textContent = text;

        // Get current theme
        const isDark = document.documentElement.classList.contains('dark') ||
            window.matchMedia?.('(prefers-color-scheme: dark)').matches;

        // Theme-aware colors - use CSS custom properties when available
        const root = document.documentElement;
        const getVar = (name: string, fallback: string) =>
            getComputedStyle(root).getPropertyValue(name).trim() || fallback;

        const bgColor = isDark
            ? getVar('--aimd-tooltip-bg', 'rgba(50, 50, 55, 0.95)')
            : getVar('--aimd-tooltip-bg', 'rgba(250, 250, 252, 0.98)');
        const textColor = isDark
            ? getVar('--aimd-tooltip-text', 'var(--aimd-text-on-primary)')
            : getVar('--aimd-tooltip-text', 'var(--aimd-text-primary)');
        const shadowColor = isDark
            ? getVar('--aimd-tooltip-shadow-color', 'rgba(0, 0, 0, 0.5)')
            : getVar('--aimd-tooltip-shadow-color', 'rgba(0, 0, 0, 0.12)');
        const borderColor = isDark
            ? getVar('--aimd-tooltip-border', 'rgba(255, 255, 255, 0.15)')
            : getVar('--aimd-tooltip-border', 'rgba(0, 0, 0, 0.12)');

        tooltip.style.cssText = `
      position: absolute;
      background: ${bgColor};
      color: ${textColor};
      padding: 6px 12px;
      border-radius: 8px;
      font-size: 12px;
      font-weight: 500;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      white-space: nowrap;
      opacity: 0;
      transition: opacity 0.15s ease-in-out;
      box-shadow: 0 2px 8px ${shadowColor}, 0 4px 16px ${shadowColor};
      border: 1px solid ${borderColor};
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
    `;

        // Add to container
        this.tooltipContainer!.appendChild(tooltip);

        // Position tooltip below button
        const rect = anchor.getBoundingClientRect();
        tooltip.style.left = `${rect.left + rect.width / 2}px`;
        tooltip.style.top = `${rect.bottom + 8}px`;
        tooltip.style.transform = 'translateX(-50%)';

        // Fade in
        requestAnimationFrame(() => {
            tooltip.style.opacity = '1';
        });

        this.activeTooltip = tooltip;
    }

    /**
     * Hide tooltip
     */
    private static hide(): void {
        if (this.activeTooltip) {
            const tooltip = this.activeTooltip;
            tooltip.style.opacity = '0';

            // Clear any existing timeout
            if (this.hideTimeout !== null) {
                clearTimeout(this.hideTimeout);
            }

            // Set new timeout to remove after fade out
            this.hideTimeout = window.setTimeout(() => {
                tooltip.remove();
                if (this.activeTooltip === tooltip) {
                    this.activeTooltip = null;
                }
                this.hideTimeout = null;
            }, 150);
        }
    }
}
