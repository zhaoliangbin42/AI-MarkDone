import { logger } from '../../../core/logger';
import { extractLatexSource } from '../../../core/latex/extractLatexSource';
import { copyTextToClipboard } from '../clipboard/clipboard';
import { getDocumentTooltipDelegate, showEphemeralTooltip } from '../../../utils/tooltip';
import type { MarkdownParserAdapter } from '../adapters/parser/MarkdownParserAdapter';

const STYLE_ID = 'aimd-math-click-style';
function ensureMathClickStyle(): void {
    if (typeof document === 'undefined') return;
    if (document.getElementById(STYLE_ID)) return;

    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
`;

    (document.head || document.documentElement).appendChild(style);
}

type ListenerRecord = {
    target: HTMLElement;
    mouseenter: EventListener;
    mouseleave: EventListener;
    focusin: EventListener;
    focusout: EventListener;
    click: EventListener;
};

export type MathFormulaHoverContext = {
    element: Element;
    anchor: HTMLElement;
    source: string;
    displayMode: boolean;
};

export type MathClickHandlerOptions = {
    onFormulaHoverEnter?: (context: MathFormulaHoverContext) => void;
    onFormulaHoverLeave?: () => void;
    onFormulaDisable?: () => void;
    clickCopyMarkdown?: boolean;
    copyMarkdownDelimiters?: boolean;
    parserAdapter?: Pick<MarkdownParserAdapter, 'isMathNode' | 'extractLatex' | 'isBlockMath'>;
};

/**
 * Click-to-copy math handler (legacy-parity oriented).
 *
 * Behavior:
 * - Enable per message container
 * - Observe streaming DOM updates via MutationObserver
 * - Attach hover + click handlers to math-like nodes
 * - Copy LaTeX source using multi-strategy extractor
 * - Cleanup listeners + observers on disable
 */
export class MathClickHandler {
    private activeElements = new Set<Element>();
    private observers = new Map<HTMLElement, MutationObserver>();
    private elementListeners = new Map<Element, ListenerRecord>();
    private pendingNodes = new Set<Element>();
    private idleTimer: number | ReturnType<typeof setTimeout> | null = null;

    constructor(private readonly options: MathClickHandlerOptions = {}) {}

    setClickCopyMarkdown(enabled: boolean): void {
        this.options.clickCopyMarkdown = enabled;
    }

    setCopyMarkdownDelimiters(enabled: boolean): void {
        this.options.copyMarkdownDelimiters = enabled;
    }

    enable(container: HTMLElement): void {
        ensureMathClickStyle();
        getDocumentTooltipDelegate();
        this.processContainer(container);

        if (this.observers.has(container)) {
            return;
        }

        const observer = new MutationObserver((mutations) => {
            let queued = false;

            for (const mutation of mutations) {
                for (const node of Array.from(mutation.addedNodes)) {
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
                logger.debug('[AI-MarkDone][MathClick] Queued new nodes for math extraction');
            }
        });

        observer.observe(container, { childList: true, subtree: true });
        this.observers.set(container, observer);
    }

    disable(): void {
        this.observers.forEach((observer) => observer.disconnect());
        this.observers.clear();

        this.elementListeners.forEach((listeners) => {
            const { target, mouseenter, mouseleave, focusin, focusout, click } = listeners;
            target.style.backgroundColor = '';
            target.style.cursor = '';
            target.style.transition = '';
            target.removeEventListener('mouseenter', mouseenter);
            target.removeEventListener('mouseleave', mouseleave);
            target.removeEventListener('focusin', focusin);
            target.removeEventListener('focusout', focusout);
            target.removeEventListener('click', click);
        });
        this.elementListeners.clear();
        this.activeElements.clear();
        this.pendingNodes.clear();
        this.clearIdleTimer();
        this.options.onFormulaDisable?.();
    }

    private processContainer(container: HTMLElement): void {
        const mathElements = this.collectMathElements(container);
        mathElements.forEach((element) => {
            if (this.activeElements.has(element)) return;
            this.attachHandlers(element);
            this.activeElements.add(element);
        });
    }

    private collectMathElements(container: HTMLElement): Element[] {
        const elements: Element[] = [];
        const addUnique = (el: Element) => {
            if (!elements.includes(el)) elements.push(el);
        };

        const addCandidate = (el: Element) => {
            if (!this.isFormulaElement(el)) return;
            addUnique(el);
        };

        // Include container itself when it matches (MutationObserver can deliver leaf nodes).
        if (container.matches('.katex-display, .math-block, mjx-container[display="true"], mjx-container[display="block"]')) {
            addCandidate(container);
        }
        if (container.matches('.math-inline, mjx-container, .MathJax')) {
            addCandidate(container);
        }
        if (container.matches('.katex')) {
            if (!container.closest('.katex-display') && !container.closest('.math-block') && !container.closest('.math-inline')) {
                addCandidate(container);
            }
        }
        if (container.matches('.katex-error')) {
            const text = container.textContent?.trim() || '';
            if (text.length > 0 && text.length < 200) {
                addCandidate(container);
            }
        }
        if (container.matches('[data-latex-source], [data-latex], [data-tex], [data-math], [data-original-tex]')) {
            if (!container.closest('.katex, .katex-display, .math-block, .math-inline, mjx-container, .MathJax')) {
                addCandidate(container);
            }
        }

        container.querySelectorAll('.katex-display, .math-block, mjx-container[display="true"], mjx-container[display="block"]').forEach(addCandidate);
        container.querySelectorAll('.math-inline, mjx-container, .MathJax').forEach(addCandidate);

        container.querySelectorAll('.katex').forEach((el) => {
            if (el.closest('.katex-display') || el.closest('.math-block') || el.closest('.math-inline')) {
                return;
            }
            addCandidate(el);
        });

        container.querySelectorAll('.katex-error').forEach((el) => {
            const text = el.textContent?.trim() || '';
            if (text.length > 0 && text.length < 200) {
                addCandidate(el);
            }
        });

        container.querySelectorAll('[data-latex-source], [data-latex], [data-tex], [data-math], [data-original-tex]').forEach((el) => {
            if (el.closest('.katex, .katex-display, .math-block, .math-inline, mjx-container, .MathJax')) {
                return;
            }
            addCandidate(el);
        });

        return elements;
    }

    private isFormulaElement(element: Element): boolean {
        if (!this.options.parserAdapter) return true;
        try {
            return this.options.parserAdapter.isMathNode(element);
        } catch (error) {
            logger.warn('[AI-MarkDone][MathClick] Formula parser adapter rejected a candidate', error);
            return false;
        }
    }

    private queueNodeForProcessing(node: Element): void {
        this.pendingNodes.add(node);

        if (this.idleTimer !== null) {
            return;
        }

        const flush = () => {
            this.idleTimer = null;
            const nodes = Array.from(this.pendingNodes);
            this.pendingNodes.clear();
            this.processPendingNodes(nodes);
        };

        const globalScope = (typeof window !== 'undefined' ? window : globalThis) as typeof globalThis & Window;

        if (typeof (globalScope as any).requestIdleCallback === 'function') {
            this.idleTimer = (globalScope as any).requestIdleCallback.call(globalScope, flush, { timeout: 200 });
        } else {
            this.idleTimer = globalScope.setTimeout(flush, 16);
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
        if (this.idleTimer === null) return;

        const globalScope = (typeof window !== 'undefined' ? window : globalThis) as typeof globalThis & Window;
        if (typeof (globalScope as any).cancelIdleCallback === 'function') {
            (globalScope as any).cancelIdleCallback.call(globalScope, this.idleTimer as number);
        } else {
            globalScope.clearTimeout(this.idleTimer);
        }
        this.idleTimer = null;
    }

    private attachHandlers(element: Element): void {
        const mathEl = element as HTMLElement;

        const targetEl = element.classList.contains('katex-display')
            ? mathEl
            : (mathEl.querySelector('.katex') as HTMLElement) || mathEl;
        const hoverBackground = this.getHoverBackground(element, targetEl);

        targetEl.style.cursor = 'pointer';
        targetEl.style.transition = 'background-color 0.2s';

        const mouseenterHandler = () => {
            targetEl.style.backgroundColor = hoverBackground;
            this.notifyFormulaHoverEnter(element, targetEl);
        };

        const mouseleaveHandler = () => {
            targetEl.style.backgroundColor = '';
            this.options.onFormulaHoverLeave?.();
        };

        const clickHandler = async (e: Event) => {
            if (!(e instanceof MouseEvent)) return;
            if (e.button !== 0) return;
            if (this.options.clickCopyMarkdown === false) return;

            // Why: when click-to-copy is enabled by default, we must avoid breaking user text selection/copy flows.
            // If the user has an active selection, do not intercept the click and let the page handle it normally.
            const sel = typeof window !== 'undefined' ? window.getSelection?.() : null;
            if (sel && !sel.isCollapsed && sel.toString().trim().length > 0) return;

            e.preventDefault();
            e.stopPropagation();
            await this.handleClick(element);
        };

        targetEl.addEventListener('mouseenter', mouseenterHandler);
        targetEl.addEventListener('mouseleave', mouseleaveHandler);
        targetEl.addEventListener('focusin', mouseenterHandler);
        targetEl.addEventListener('focusout', mouseleaveHandler);
        targetEl.addEventListener('click', clickHandler);

        this.elementListeners.set(element, {
            target: targetEl,
            mouseenter: mouseenterHandler,
            mouseleave: mouseleaveHandler,
            focusin: mouseenterHandler,
            focusout: mouseleaveHandler,
            click: clickHandler,
        });
    }

    private getHoverBackground(element: Element, targetEl?: HTMLElement): string {
        const root = document.documentElement;
        const computed = getComputedStyle(root);
        const fallback = 'rgba(37, 99, 235, 0.12)';
        const highlight = computed.getPropertyValue('--aimd-interactive-highlight').trim() || fallback;

        if (element.classList.contains('math-inline')) {
            return highlight;
        }

        if (targetEl?.closest('.math-inline')) {
            return highlight;
        }

        return highlight;
    }

    private notifyFormulaHoverEnter(element: Element, anchor: HTMLElement): void {
        if (!this.options.onFormulaHoverEnter) return;
        const formula = this.resolveFormula(element);
        if (!formula) return;
        this.options.onFormulaHoverEnter({
            element,
            anchor,
            source: formula.source,
            displayMode: formula.displayMode,
        });
    }

    private async handleClick(element: Element): Promise<void> {
        const formula = this.resolveFormula(element);
        if (!formula) {
            logger.warn('[AI-MarkDone][MathClick] No LaTeX source found for clicked element');
            return;
        }

        const success = await copyTextToClipboard(formatFormulaClickCopySource(
            formula.source,
            formula.displayMode,
            this.options.copyMarkdownDelimiters !== false,
        ));

        if (success) {
            this.showCopyFeedback(element as HTMLElement);
        } else {
            logger.error('[AI-MarkDone][MathClick] Failed to copy LaTeX');
        }
    }

    private resolveFormula(element: Element): { source: string; displayMode: boolean } | null {
        const adapter = this.options.parserAdapter;
        if (adapter && element instanceof HTMLElement) {
            try {
                const result = adapter.extractLatex(element);
                const source = result?.latex?.trim();
                if (source) {
                    return {
                        source,
                        displayMode: result?.isBlock ?? adapter.isBlockMath(element),
                    };
                }
                return null;
            } catch (error) {
                logger.warn('[AI-MarkDone][MathClick] Formula parser adapter extraction failed', error);
                return null;
            }
        }

        const source = extractLatexSource(element);
        if (!source) return null;
        return {
            source,
            displayMode: isDisplayMathElement(element),
        };
    }

    private showCopyFeedback(element: HTMLElement): void {
        const targetEl = this.elementListeners.get(element)?.target ?? element;
        const computed = getComputedStyle(document.documentElement);
        const flash = computed.getPropertyValue('--aimd-interactive-flash').trim() || 'rgba(37, 99, 235, 0.24)';

        targetEl.style.backgroundColor = flash;
        showEphemeralTooltip({
            anchor: targetEl,
            text: 'Copied',
        });

        setTimeout(() => {
            targetEl.style.backgroundColor = '';
            if (targetEl.matches(':hover')) {
                targetEl.style.backgroundColor = this.getHoverBackground(element, targetEl);
            }
        }, 1500);
    }
}

export function formatFormulaClickCopySource(source: string, displayMode: boolean, includeDelimiters: boolean): string {
    const trimmed = source.trim();
    if (!includeDelimiters) return trimmed;
    return displayMode ? `$$\n${trimmed}\n$$` : `$${trimmed}$`;
}

function isDisplayMathElement(element: Element): boolean {
    return element.classList.contains('katex-display')
        || element.classList.contains('math-block')
        || element.matches('mjx-container[display="true"], mjx-container[display="block"]')
        || Boolean(element.closest('.katex-display, .math-block, mjx-container[display="true"], mjx-container[display="block"]'));
}
