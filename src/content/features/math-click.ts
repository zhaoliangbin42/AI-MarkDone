import { copyToClipboard } from '../../utils/dom-utils';
import { logger } from '../../utils/logger';
import { extractLatexSource } from '../parsers/latex-extractor';
import { SettingsManager } from '../../settings/SettingsManager';

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
    private pendingNodes = new Set<Element>();
    private idleCallbackId: number | ReturnType<typeof setTimeout> | null = null;

    /**
     * Enable click-to-copy for all math elements in a container
     * Uses MutationObserver to handle streaming updates
     */
    async enable(container: HTMLElement): Promise<void> {
        // Check settings: is click-to-copy enabled?
        const settings = await SettingsManager.getInstance().get('behavior');
        if (!settings.enableClickToCopy) {
            logger.info('[MathClick] Click-to-copy disabled by settings');
            return;
        }

        // Process existing math elements
        this.processContainer(container);

        // If observer already exists for this container, skip
        if (this.observers.has(container)) {
            return;
        }

        // Setup MutationObserver to watch for new math elements during streaming
        const observer = new MutationObserver((mutations) => {
            let queued = false;

            for (const mutation of mutations) {
                for (const node of mutation.addedNodes) {
                    if (node instanceof HTMLElement) {
                        queued = true;
                        this.queueNodeForProcessing(node);
                    } else if (node instanceof DocumentFragment) {
                        node.querySelectorAll('*').forEach((child) => {
                            if (child instanceof Element) {
                                queued = true;
                                this.queueNodeForProcessing(child);
                            }
                        });
                    }
                }
            }

            if (queued) {
                logger.debug('[MathClick] Queued new nodes for math extraction');
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
        const mathElements = this.collectMathElements(container);

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
     * Collect math-like elements that merit click-to-copy
     */
    private collectMathElements(container: HTMLElement): Element[] {
        const elements: Element[] = [];
        const addUnique = (el: Element) => {
            if (!elements.includes(el)) {
                elements.push(el);
            }
        };

        container.querySelectorAll('.katex-display, .math-block').forEach(addUnique);
        container.querySelectorAll('.math-inline').forEach(addUnique);

        container.querySelectorAll('.katex').forEach((el) => {
            if (el.closest('.katex-display') || el.closest('.math-block') || el.closest('.math-inline')) {
                return;
            }
            addUnique(el);
        });

        container.querySelectorAll('.katex-error').forEach((el) => {
            const text = el.textContent?.trim() || '';
            if (text.length > 0 && text.length < 200) {
                addUnique(el);
            }
        });

        return elements;
    }

    private queueNodeForProcessing(node: Element): void {
        this.pendingNodes.add(node);

        if (this.idleCallbackId !== null) {
            return;
        }

        const flush = () => {
            this.idleCallbackId = null;
            const nodes = Array.from(this.pendingNodes);
            this.pendingNodes.clear();
            this.processPendingNodes(nodes);
        };

        const globalScope = (typeof window !== 'undefined' ? window : globalThis) as typeof globalThis & Window;

        if (typeof globalScope.requestIdleCallback === 'function') {
            this.idleCallbackId = globalScope.requestIdleCallback(flush, { timeout: 200 });
        } else {
            this.idleCallbackId = globalScope.setTimeout(flush, 16);
        }
    }

    private processPendingNodes(nodes: Element[]): void {
        nodes.forEach((node) => {
            if (!(node instanceof HTMLElement)) return;
            this.collectMathElements(node).forEach((element) => {
                if (this.activeElements.has(element)) return;
                this.attachHandlers(element);
                this.activeElements.add(element);
            });
        });
    }

    private clearIdleTimer(): void {
        if (this.idleCallbackId === null) {
            return;
        }

        const globalScope = (typeof window !== 'undefined' ? window : globalThis) as typeof globalThis & Window;
        if (typeof globalScope.cancelIdleCallback === 'function') {
            globalScope.cancelIdleCallback(this.idleCallbackId as number);
        } else {
            globalScope.clearTimeout(this.idleCallbackId);
        }

        this.idleCallbackId = null;
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
        // Get theme-aware highlight color from CSS custom properties
        const root = document.documentElement;
        const getVar = (name: string, fallback: string) =>
            getComputedStyle(root).getPropertyValue(name).trim() || fallback;
        const hoverColor = getVar('--aimd-interactive-highlight', 'rgba(37, 99, 235, 0.12)');

        // Create named event listeners (so we can remove them later)
        const mouseenterHandler = () => {
            targetEl.style.backgroundColor = hoverColor;
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
        return extractLatexSource(element);
    }

    /**
     * Show visual feedback after successful copy
     */
    private showCopyFeedback(element: HTMLElement): void {
        // Don't save originalBg - it might be the hover color
        // We'll clear it completely and re-apply if needed
        // Get theme-aware flash color
        const root = document.documentElement;
        const getVar = (name: string, fallback: string) =>
            getComputedStyle(root).getPropertyValue(name).trim() || fallback;
        const flashColor = getVar('--aimd-interactive-flash', 'rgba(37, 99, 235, 0.28)');
        element.style.backgroundColor = flashColor;

        // Create tooltip
        const tooltip = document.createElement('div');
        tooltip.textContent = 'Copied!';

        // Resolve CSS variables to actual values since tooltip is outside Shadow DOM
        const primaryColor = getVar('--aimd-interactive-primary', '#2563EB');
        // Text on primary is always white for proper contrast
        const textOnPrimary = '#FFFFFF';
        const zIndex = getVar('--aimd-z-tooltip', '10000');

        tooltip.style.cssText = `
      position: fixed;
      background: ${primaryColor};
      color: ${textOnPrimary};
      padding: 4px 8px;
      border-radius: 4px;
      font-size: 12px;
      font-weight: 500;
      pointer-events: none;
      z-index: ${zIndex};
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
                const highlightColor = getComputedStyle(document.documentElement)
                    .getPropertyValue('--aimd-interactive-highlight').trim() || 'rgba(37, 99, 235, 0.12)';
                element.style.backgroundColor = highlightColor;
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
        this.pendingNodes.clear();
        this.clearIdleTimer();

        logger.info('[MathClick] Disabled and cleaned up all resources');
    }
}
