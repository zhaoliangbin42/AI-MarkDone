import { logger } from '../../../core/logger';
import {
    extractAuthoritativeLatexSource,
    extractLatexSource,
} from '../../../core/latex/extractLatexSource';
import type { FormulaSource } from '../../../core/math/formulaAssetTypes';
import { copyTextToClipboard } from '../clipboard/clipboard';
import { retainDocumentTooltipDelegate, showEphemeralTooltip } from '../../../utils/tooltip';
import type { MarkdownParserAdapter } from '../adapters/parser/MarkdownParserAdapter';
import {
    DEFAULT_FORMULA_SOURCE_FORMAT,
    formatFormulaSource,
    normalizeFormulaSourceFormat,
    type FormulaSourceFormat,
} from '../../../core/math/formulaSourceFormat';

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

export type MathClickHandlerOptions = {
    onFormulaHoverEnter?: (context: MathFormulaHoverContext) => void;
    onFormulaHoverLeave?: () => void;
    onFormulaDisable?: () => void;
    clickCopyMarkdown?: boolean;
    clickCopyFormulaFormat?: FormulaSourceFormat;
    parserAdapter?: Pick<MarkdownParserAdapter, 'isMathNode' | 'extractLatex' | 'isBlockMath'>;
};

/**
 * Click-to-copy math handler (legacy-parity oriented).
 *
 * Behavior:
 * - Enable per message container
 * - Delegate hover + click handling from the document
 * - Copy LaTeX source using multi-strategy extractor
 * - Cleanup listeners + observers on disable
 */
export class MathClickHandler {
    private containers = new Set<HTMLElement>();
    private containerDiscovery = new Map<HTMLElement, string>();
    private delegated = false;
    private hoveredFormula: { element: Element; anchor: HTMLElement } | null = null;
    private releaseTooltipDelegate: (() => void) | null = null;

    constructor(private readonly options: MathClickHandlerOptions = {}) {}

    setClickCopyMarkdown(enabled: boolean): void {
        this.options.clickCopyMarkdown = enabled;
    }

    setClickCopyFormulaFormat(format: FormulaSourceFormat): void {
        this.options.clickCopyFormulaFormat = normalizeFormulaSourceFormat(format);
    }

    enable(container: HTMLElement): void {
        if (this.containers.has(container)) return;
        this.ensureTooltipDelegate();
        this.containers.add(container);
        this.ensureDelegatedListeners();
    }

    observeContainers(root: HTMLElement, selector: string): void {
        this.ensureTooltipDelegate();
        this.containerDiscovery.set(root, selector);
        this.ensureDelegatedListeners();
    }

    /**
     * Observe one semantic host root. Formula ownership is delegated to the
     * injected parser capability; the handler does not need a platform's
     * formula-node selector list to discover future descendants.
     */
    observeSemanticRoot(root: HTMLElement): void {
        this.enable(root);
    }

    private ensureDelegatedListeners(): void {
        if (this.delegated) return;
        this.delegated = true;
        document.addEventListener('click', this.handleDelegatedClick, true);
        document.addEventListener('mouseover', this.handleDelegatedMouseOver, true);
        document.addEventListener('mouseout', this.handleDelegatedMouseOut, true);
        document.addEventListener('mouseenter', this.handleDelegatedMouseEnter, true);
        document.addEventListener('mouseleave', this.handleDelegatedMouseLeave, true);
        document.addEventListener('focusin', this.handleDelegatedFocusIn, true);
        document.addEventListener('focusout', this.handleDelegatedFocusOut, true);
    }

    private ensureTooltipDelegate(): void {
        this.releaseTooltipDelegate ??= retainDocumentTooltipDelegate();
    }

    disable(): void {
        if (this.delegated) {
            document.removeEventListener('click', this.handleDelegatedClick, true);
            document.removeEventListener('mouseover', this.handleDelegatedMouseOver, true);
            document.removeEventListener('mouseout', this.handleDelegatedMouseOut, true);
            document.removeEventListener('mouseenter', this.handleDelegatedMouseEnter, true);
            document.removeEventListener('mouseleave', this.handleDelegatedMouseLeave, true);
            document.removeEventListener('focusin', this.handleDelegatedFocusIn, true);
            document.removeEventListener('focusout', this.handleDelegatedFocusOut, true);
            this.delegated = false;
        }
        this.containers.clear();
        this.containerDiscovery.clear();
        this.hoveredFormula = null;
        this.releaseTooltipDelegate?.();
        this.releaseTooltipDelegate = null;
        this.options.onFormulaDisable?.();
    }

    private getEnabledContainer(node: Node): HTMLElement | null {
        let cursor = node instanceof HTMLElement ? node : node.parentElement;
        while (cursor) {
            if (this.containers.has(cursor)) return cursor;
            for (const [root, selector] of this.containerDiscovery) {
                if (!root.isConnected || (cursor !== root && !root.contains(cursor))) continue;
                if (cursor.matches(selector)) return cursor;
            }
            cursor = cursor.parentElement;
        }
        return null;
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

    private readonly handleDelegatedClick = (event: Event): void => {
        if (!(event instanceof MouseEvent) || event.button !== 0) return;
        if (this.options.clickCopyMarkdown === false) return;
        if (!this.getEnabledContainerForEvent(event)) return;
        const formula = this.resolveFormulaElement(event);
        if (!formula || !this.getEnabledContainer(formula)) return;
        const selection = typeof window !== 'undefined' ? window.getSelection?.() : null;
        if (selection && !selection.isCollapsed && selection.toString().trim().length > 0) return;
        event.preventDefault();
        event.stopPropagation();
        void this.handleClick(formula);
    };

    private readonly handleDelegatedMouseOver = (event: MouseEvent): void => this.handleDelegatedHover(event, true);
    private readonly handleDelegatedMouseEnter = (event: MouseEvent): void => this.handleDelegatedHover(event, true);
    private readonly handleDelegatedMouseOut = (event: MouseEvent): void => this.handleDelegatedHover(event, false);
    private readonly handleDelegatedMouseLeave = (event: MouseEvent): void => this.handleDelegatedHover(event, false);
    private readonly handleDelegatedFocusIn = (event: FocusEvent): void => this.handleDelegatedHover(event, true);
    private readonly handleDelegatedFocusOut = (event: FocusEvent): void => this.handleDelegatedHover(event, false);

    private handleDelegatedHover(event: Event, entering: boolean): void {
        if (!this.getEnabledContainerForEvent(event)) {
            if (!entering) this.clearHoveredFormula();
            return;
        }
        const formula = this.resolveFormulaElement(event);
        if (!formula || !this.getEnabledContainer(formula)) {
            if (!entering) this.clearHoveredFormula();
            return;
        }
        if (entering) {
            if (this.hoveredFormula?.element === formula) return;
            this.clearHoveredFormula();
            const anchor = this.resolveInteractionTarget(formula);
            anchor.style.cursor = 'pointer';
            anchor.style.transition = 'background-color var(--aimd-duration-fast) var(--aimd-ease-in-out)';
            anchor.style.backgroundColor = this.getHoverBackground(formula, anchor);
            this.hoveredFormula = { element: formula, anchor };
            this.notifyFormulaHoverEnter(formula, anchor);
        } else if (this.hoveredFormula?.element === formula) {
            this.clearHoveredFormula();
        }
    }

    private clearHoveredFormula(): void {
        const current = this.hoveredFormula;
        if (!current) return;
        current.anchor.style.backgroundColor = '';
        current.anchor.style.cursor = '';
        current.anchor.style.transition = '';
        this.hoveredFormula = null;
        this.options.onFormulaHoverLeave?.();
    }

    private resolveFormulaElement(event: Event): Element | null {
        const path = typeof event.composedPath === 'function' ? event.composedPath() : [];
        let formula: Element | null = null;
        for (const node of path) {
            if (node instanceof Element && this.isFormulaElement(node)) formula = node;
        }
        let cursor = event.target instanceof Element ? event.target : null;
        while (cursor) {
            if (this.isFormulaElement(cursor)) formula = cursor;
            cursor = cursor.parentElement;
        }
        return formula;
    }

    /**
     * Check ownership before asking the platform parser to classify every
     * node in a global mouse/focus event path.  This keeps delegated formula
     * handling page-wide without making ordinary page movement a parser hot
     * path.
     */
    private getEnabledContainerForEvent(event: Event): HTMLElement | null {
        const path = typeof event.composedPath === 'function' ? event.composedPath() : [];
        for (const node of path) {
            if (!(node instanceof Node)) continue;
            const container = this.getEnabledContainer(node);
            if (container) return container;
        }
        return event.target instanceof Node ? this.getEnabledContainer(event.target) : null;
    }

    private resolveInteractionTarget(element: Element): HTMLElement {
        if (
            element.matches('.katex, .katex-display, .math-block, mjx-container[display="true"], mjx-container[display="block"]')
        ) {
            return element as HTMLElement;
        }
        const nested = element.querySelector<HTMLElement>('.katex, .katex-display, .math-block, .math-inline, mjx-container');
        return nested ?? element as HTMLElement;
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
        const targetEl = this.resolveInteractionTarget(element);
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
