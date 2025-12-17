import { copyToClipboard } from '../../utils/dom-utils';
import { logger } from '../../utils/logger';

/**
 * Click-to-copy math handler
 * Allows users to click on math formulas to copy their LaTeX source
 */
export class MathClickHandler {
    private activeElements = new Set<Element>();  // Changed from WeakSet to Set for cleanup
    private observers = new Map<HTMLElement, MutationObserver>();  // Changed from WeakMap to Map for cleanup
    private elementListeners = new Map<Element, {
        target: HTMLElement;
        mouseenter: EventListener;
        mouseleave: EventListener;
        click: EventListener;
    }>();

    /**
     * Enable click-to-copy for all math elements in a container
     * Uses MutationObserver to handle streaming updates
     */
    enable(container: HTMLElement): void {
        // Process existing math elements
        this.processContainer(container);

        // If observer already exists for this container, skip
        if (this.observers.has(container)) {
            return;
        }

        // Setup MutationObserver to watch for new math elements during streaming
        const observer = new MutationObserver((mutations) => {
            let hasNewMath = false;

            for (const mutation of mutations) {
                // Check if any added nodes contain math elements
                for (const node of mutation.addedNodes) {
                    if (node instanceof HTMLElement) {
                        const hasMath = node.classList.contains('katex') ||
                            node.classList.contains('katex-display') ||
                            node.querySelector('.katex, .katex-display');
                        if (hasMath) {
                            hasNewMath = true;
                            break;
                        }
                    }
                }
                if (hasNewMath) break;
            }

            if (hasNewMath) {
                logger.debug('[MathClick] New math elements detected during streaming');
                this.processContainer(container);
            }
        });

        observer.observe(container, {
            childList: true,
            subtree: true
        });

        this.observers.set(container, observer);
        logger.debug('[MathClick] Observer started for container');
    }

    /**
     * Process all math elements in a container
     */
    private processContainer(container: HTMLElement): void {
        const mathElements = this.findAllMathElements(container);

        mathElements.forEach((element: Element) => {
            if (this.activeElements.has(element)) return;

            this.attachHandlers(element);
            this.activeElements.add(element);
        });

        if (mathElements.length > 0) {
            logger.debug(`[MathClick] Enabled click-to-copy for ${mathElements.length} math elements`);
        }
    }

    /**
     * Find all math elements in a container
     */
    private findAllMathElements(container: HTMLElement): Element[] {
        const elements: Element[] = [];

        // Find .katex-display (block math)
        container.querySelectorAll('.katex-display').forEach(el => elements.push(el));

        // Find .katex not inside .katex-display (inline math)
        container.querySelectorAll('.katex').forEach(el => {
            if (!el.closest('.katex-display')) {
                elements.push(el);
            }
        });

        // Find .katex-error (failed rendering) - but ONLY short ones (single formulas)
        // Long katex-error elements (like in Deep Research) should NOT be clickable
        container.querySelectorAll('.katex-error').forEach(el => {
            const text = el.textContent?.trim() || '';
            // Only enable click-to-copy for short formulas (< 200 chars)
            // This filters out large blocks of LaTeX that failed to render
            if (text.length > 0 && text.length < 200) {
                elements.push(el);
            }
        });

        return elements;
    }

    /**
     * Attach event handlers to a math element
     */
    private attachHandlers(element: Element): void {
        const mathEl = element as HTMLElement;

        // For inline math (.katex without .katex-display), we need to find the actual .katex element
        // For block math (.katex-display), we can use the container
        const targetEl = element.classList.contains('katex-display')
            ? mathEl
            : (mathEl.querySelector('.katex') as HTMLElement) || mathEl;

        // Add hover effect
        targetEl.style.cursor = 'pointer';
        targetEl.style.transition = 'background-color 0.2s';

        // Create named event listeners (so we can remove them later)
        const mouseenterHandler = () => {
            targetEl.style.backgroundColor = 'rgba(59, 130, 246, 0.1)';
        };

        const mouseleaveHandler = () => {
            targetEl.style.backgroundColor = '';
        };

        const clickHandler = async (e: Event) => {
            e.preventDefault();
            e.stopPropagation();
            await this.handleClick(element);
        };

        // Add event listeners
        targetEl.addEventListener('mouseenter', mouseenterHandler);
        targetEl.addEventListener('mouseleave', mouseleaveHandler);
        targetEl.addEventListener('click', clickHandler);

        // Save listener references for cleanup
        this.elementListeners.set(element, {
            target: targetEl,
            mouseenter: mouseenterHandler,
            mouseleave: mouseleaveHandler,
            click: clickHandler
        });
    }

    /**
     * Handle click on math element
     */
    private async handleClick(element: Element): Promise<void> {
        const latex = this.getLatexSource(element);

        if (!latex) {
            logger.warn('No LaTeX source found for clicked element');
            return;
        }

        // Copy to clipboard
        const success = await copyToClipboard(latex);

        if (success) {
            logger.info('LaTeX copied:', latex);
            this.showCopyFeedback(element as HTMLElement);
        } else {
            logger.error('Failed to copy LaTeX');
        }
    }

    /**
     * Extract LaTeX source from a math element
     */
    private getLatexSource(element: Element): string | null {
        // Try to find annotation tag (for successfully rendered KaTeX)
        const annotation = element.querySelector('annotation[encoding="application/x-tex"]');
        if (annotation?.textContent) {
            return annotation.textContent.trim();
        }

        // For .katex-error, use textContent
        if (element.classList.contains('katex-error')) {
            return element.textContent?.trim() || null;
        }

        // Fallback: try textContent
        return element.textContent?.trim() || null;
    }

    /**
     * Show visual feedback after successful copy
     */
    private showCopyFeedback(element: HTMLElement): void {
        // Don't save originalBg - it might be the hover color
        // We'll clear it completely and re-apply if needed
        element.style.backgroundColor = 'rgba(139, 92, 246, 0.2)';

        // Create tooltip
        const tooltip = document.createElement('div');
        tooltip.textContent = 'Copied!';
        tooltip.style.cssText = `
      position: absolute;
      background: #8b5cf6;
      color: white;
      padding: 4px 8px;
      border-radius: 4px;
      font-size: 12px;
      font-weight: 500;
      pointer-events: none;
      z-index: 999999;
      animation: fadeOut 1.5s forwards;
    `;

        // Position tooltip
        const rect = element.getBoundingClientRect();
        tooltip.style.top = `${rect.top - 30}px`;
        tooltip.style.left = `${rect.left + rect.width / 2 - 30}px`;

        // Add fadeOut animation
        const style = document.createElement('style');
        style.textContent = `
      @keyframes fadeOut {
        0% { opacity: 1; transform: translateY(0); }
        100% { opacity: 0; transform: translateY(-10px); }
      }
    `;
        document.head.appendChild(style);

        document.body.appendChild(tooltip);

        // Remove after animation
        setTimeout(() => {
            tooltip.remove();
            style.remove();

            // Clear background completely
            element.style.backgroundColor = '';

            // Re-apply hover effect if mouse is still over element
            if (element.matches(':hover')) {
                element.style.backgroundColor = 'rgba(59, 130, 246, 0.1)';
            }
        }, 1500);
    }

    /**
     * Disable and cleanup all resources
     * Called when ContentScript is stopped (e.g., on page navigation)
     */
    disable(): void {
        // 1. Disconnect all MutationObservers
        this.observers.forEach((observer, _container) => {
            observer.disconnect();
            logger.debug('[MathClick] Disconnected observer for container');
        });
        this.observers.clear();

        // 2. Remove all event listeners and reset styles
        this.elementListeners.forEach((listeners, _element) => {
            const { target, mouseenter, mouseleave, click } = listeners;

            // Reset styles before removing listeners
            target.style.backgroundColor = '';
            target.style.cursor = '';
            target.style.transition = '';

            // Remove event listeners
            target.removeEventListener('mouseenter', mouseenter);
            target.removeEventListener('mouseleave', mouseleave);
            target.removeEventListener('click', click);
        });
        this.elementListeners.clear();

        // 3. Clear active elements
        this.activeElements.clear();

        logger.info('[MathClick] Disabled and cleaned up all resources');
    }
}
