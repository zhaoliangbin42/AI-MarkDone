import { logger } from '../../../core/logger';
import {
    extractAuthoritativeLatexSource,
    extractLatexSource,
} from '../../../core/latex/extractLatexSource';
import type { FormulaSource } from '../../../core/math/formulaAssetTypes';
import { copyTextToClipboard } from '../clipboard/clipboard';
import { getDocumentTooltipDelegate, showEphemeralTooltip } from '../../../utils/tooltip';
import type { MarkdownParserAdapter } from '../adapters/parser/MarkdownParserAdapter';
import {
    DEFAULT_FORMULA_SOURCE_FORMAT,
    formatFormulaSource,
    normalizeFormulaSourceFormat,
    type FormulaSourceFormat,
} from '../../../core/math/formulaSourceFormat';

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
    source: FormulaSource;
    displayMode: boolean;
};

type ResolvedFormula = {
    texSource: string;
    assetSource: FormulaSource;
    displayMode: boolean;
};

type CanonicalFormulaResolver = (element: Element) => {
    latex: string;
    isBlock: boolean;
} | null;

export type MathClickHandlerOptions = {
    onFormulaHoverEnter?: (context: MathFormulaHoverContext) => void;
    onFormulaHoverLeave?: () => void;
    onFormulaDisable?: () => void;
    clickCopyMarkdown?: boolean;
    clickCopyFormulaFormat?: FormulaSourceFormat;
    parserAdapter?: Pick<MarkdownParserAdapter, 'isMathNode' | 'extractLatex' | 'isBlockMath'>;
    /** When provided, ChatGPT formulas fail closed unless canonical content resolves them. */
    canonicalFormulaResolver?: CanonicalFormulaResolver;
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
    private containers = new Set<HTMLElement>();
    private containerDiscovery = new Map<HTMLElement, string>();
    private observer: MutationObserver | null = null;
    private elementListeners = new Map<Element, ListenerRecord>();
    private pendingNodes = new Set<Element>();
    private idleTimer: number | ReturnType<typeof setTimeout> | null = null;

    constructor(private readonly options: MathClickHandlerOptions = {}) {}

    setClickCopyMarkdown(enabled: boolean): void {
        this.options.clickCopyMarkdown = enabled;
    }

    setClickCopyFormulaFormat(format: FormulaSourceFormat): void {
        this.options.clickCopyFormulaFormat = normalizeFormulaSourceFormat(format);
    }

    setCanonicalFormulaResolver(resolver: CanonicalFormulaResolver | undefined): void {
        this.options.canonicalFormulaResolver = resolver;
    }

    enable(container: HTMLElement): void {
        if (this.containers.has(container)) return;
        getDocumentTooltipDelegate();
        this.containers.add(container);
        this.processContainer(container);
        this.ensureObserver();
    }

    observeContainers(root: HTMLElement, selector: string): void {
        this.containerDiscovery.set(root, selector);
        this.discoverContainers(root, selector);
        this.ensureObserver();
    }

    /**
     * Observe one semantic host root. Formula ownership is delegated to the
     * injected parser capability; the handler does not need a platform's
     * formula-node selector list to discover future descendants.
     */
    observeSemanticRoot(root: HTMLElement): void {
        this.enable(root);
    }

    private ensureObserver(): void {
        if (this.observer || typeof MutationObserver !== 'function') return;
        const root = document.body ?? document.documentElement;
        this.observer = new MutationObserver((mutations) => this.handleMutations(mutations));
        this.observer.observe(root, { childList: true, subtree: true });
    }

    disable(): void {
        this.observer?.disconnect();
        this.observer = null;
        this.containers.clear();
        this.containerDiscovery.clear();
        for (const element of Array.from(this.elementListeners.keys())) this.detachHandlers(element);
        this.activeElements.clear();
        this.pendingNodes.clear();
        this.clearIdleTimer();
        this.options.onFormulaDisable?.();
    }

    private handleMutations(mutations: MutationRecord[]): void {
        let queued = false;
        for (const mutation of mutations) {
            for (const node of Array.from(mutation.removedNodes)) {
                if (this.handleRemovedNode(node)) queued = true;
            }
            for (const node of Array.from(mutation.addedNodes)) {
                if (node.nodeType !== 1) continue;
                const element = node as Element;
                this.discoverContainersFromAddedNode(element);
                if (!this.getEnabledContainer(element)) continue;
                queued = true;
                this.queueNodeForProcessing(element);
            }
        }

        if (this.containers.size === 0 && this.containerDiscovery.size === 0) {
            this.observer?.disconnect();
            this.observer = null;
        }
        if (queued) logger.debug('[AI-MarkDone][MathClick] Queued new nodes for math extraction');
    }

    private handleRemovedNode(node: Node): boolean {
        const removedElement = node.nodeType === 1 ? node as Element : null;
        if (!removedElement) return false;

        for (const root of Array.from(this.containerDiscovery.keys())) {
            if (!root.isConnected && (root === removedElement || removedElement.contains(root))) {
                this.containerDiscovery.delete(root);
            }
        }

        for (const container of Array.from(this.containers)) {
            if (!container.isConnected && (container === removedElement || removedElement.contains(container))) {
                this.containers.delete(container);
            }
        }

        let queued = false;
        for (const [element, listeners] of Array.from(this.elementListeners.entries())) {
            const formulaRemoved = removedElement.contains(element);
            const targetRemoved = removedElement.contains(listeners.target);
            if (!formulaRemoved && !targetRemoved) continue;

            this.detachHandlers(element);
            if (element.isConnected && this.getEnabledContainer(element)) {
                this.queueNodeForProcessing(element);
                queued = true;
            }
        }
        return queued;
    }

    private discoverContainers(scope: ParentNode, selector: string): void {
        if (scope instanceof HTMLElement && scope.matches(selector)) this.enable(scope);
        scope.querySelectorAll(selector).forEach((element) => {
            if (element instanceof HTMLElement) this.enable(element);
        });
    }

    private discoverContainersFromAddedNode(node: Element): void {
        for (const [root, selector] of this.containerDiscovery) {
            if (node !== root && !root.contains(node)) continue;
            this.discoverContainers(node, selector);
        }
    }

    private getEnabledContainer(node: Node): HTMLElement | null {
        let cursor = node instanceof HTMLElement ? node : node.parentElement;
        while (cursor) {
            if (this.containers.has(cursor)) return cursor;
            cursor = cursor.parentElement;
        }
        return null;
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
        const seen = new Set<Element>();
        const addUnique = (el: Element) => {
            if (seen.has(el)) return;
            seen.add(el);
            elements.push(el);
        };

        const addCandidate = (el: Element) => {
            if (!this.isFormulaElement(el)) return;
            addUnique(el);
        };

        const nodes = [container, ...Array.from(container.querySelectorAll('*'))];
        nodes.forEach((element) => {
            if (!this.isFormulaElement(element)) return;
            if (elements.some((parent) => parent.contains(element))) return;
            // Parser capability adapters identify the semantic math owner;
            // nested generated descendants are ignored by the adapter rather
            // than by a platform-specific selector list here.
            addCandidate(element);
        });

        return elements;
    }

    private isFormulaElement(element: Element): boolean {
        if (!this.options.parserAdapter) return isGenericFormulaElement(element);
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
            if (!node.isConnected || !this.getEnabledContainer(node)) return;
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

    private detachHandlers(element: Element): void {
        const listeners = this.elementListeners.get(element);
        if (!listeners) return;
        const { target, mouseenter, mouseleave, focusin, focusout, click } = listeners;
        target.style.backgroundColor = '';
        target.style.cursor = '';
        target.style.transition = '';
        target.removeEventListener('mouseenter', mouseenter);
        target.removeEventListener('mouseleave', mouseleave);
        target.removeEventListener('focusin', focusin);
        target.removeEventListener('focusout', focusout);
        target.removeEventListener('click', click);
        this.elementListeners.delete(element);
        this.activeElements.delete(element);
    }

    private attachHandlers(element: Element): void {
        const targetEl = this.resolveInteractionTarget(element);
        const hoverBackground = this.getHoverBackground(element, targetEl);

        targetEl.style.cursor = 'pointer';
        targetEl.style.transition = 'background-color var(--aimd-duration-fast) var(--aimd-ease-in-out)';

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

    private resolveInteractionTarget(element: Element): HTMLElement {
        if (
            (this.options.parserAdapter ? this.isFormulaElement(element) : false)
            || element.matches('.katex-display, .math-block, mjx-container[display="true"], mjx-container[display="block"]')
        ) {
            return element as HTMLElement;
        }
        const nested = Array.from(element.querySelectorAll('*'))
            .find((candidate) => this.isFormulaElement(candidate));
        return nested?.nodeType === 1 ? nested as HTMLElement : element as HTMLElement;
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
            source: formula.assetSource,
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
            formula.texSource,
            formula.displayMode,
            normalizeFormulaSourceFormat(this.options.clickCopyFormulaFormat ?? DEFAULT_FORMULA_SOURCE_FORMAT),
        ));

        if (success) {
            this.showCopyFeedback(element as HTMLElement);
        } else {
            logger.error('[AI-MarkDone][MathClick] Failed to copy LaTeX');
        }
    }

    private resolveFormula(element: Element): ResolvedFormula | null {
        if (this.options.canonicalFormulaResolver) {
            const canonical = this.options.canonicalFormulaResolver(element);
            if (!canonical?.latex.trim()) return null;
            return {
                texSource: canonical.latex.trim(),
                assetSource: { kind: 'tex', value: canonical.latex.trim(), confidence: 'authoritative' },
                displayMode: canonical.isBlock,
            };
        }
        const adapter = this.options.parserAdapter;
        if (adapter && element instanceof HTMLElement) {
            try {
                const result = adapter.extractLatex(element);
                const source = result?.latex?.trim();
                if (source) {
                    return {
                        texSource: source,
                        assetSource: this.resolveAssetSource(element, source),
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
            texSource: source,
            assetSource: this.resolveAssetSource(element, source),
            displayMode: isDisplayMathElement(element),
        };
    }

    private resolveAssetSource(element: Element, extractedSource: string): FormulaSource {
        const authoritative = extractAuthoritativeLatexSource(element)?.trim();
        return authoritative && authoritative === extractedSource.trim()
            ? { kind: 'tex', value: authoritative, confidence: 'authoritative' }
            : { kind: 'dom-only', sourceElement: element };
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

function isGenericFormulaElement(element: Element): boolean {
    return element.matches(
        '.katex-display, .math-block, .math-inline, mjx-container, .MathJax, .katex, .katex-error, [data-latex-source], [data-latex], [data-tex], [data-math], [data-original-tex]',
    );
}

export function formatFormulaClickCopySource(source: string, displayMode: boolean, format: FormulaSourceFormat): string {
    return formatFormulaSource(source, displayMode, format);
}

function isDisplayMathElement(element: Element): boolean {
    return element.classList.contains('katex-display')
        || element.classList.contains('math-block')
        || element.matches('mjx-container[display="true"], mjx-container[display="block"]')
        || Boolean(element.closest('.katex-display, .math-block, mjx-container[display="true"], mjx-container[display="block"]'));
}
