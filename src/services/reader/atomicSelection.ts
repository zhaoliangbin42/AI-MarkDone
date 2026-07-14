import type { ReaderAtomicUnit, ReaderAtomicUnitKind, ReaderAtomicUnitMode } from '../renderer/renderMarkdown';

export type SelectedAtomicUnit = ReaderAtomicUnit & {
    element: HTMLElement;
};

export type RenderedAtomicUnit = {
    kind: ReaderAtomicUnitKind;
    mode: ReaderAtomicUnitMode;
    element: HTMLElement;
};

const READER_ATOMIC_UNIT_KINDS = [
    'inline-math',
    'display-math',
    'inline-code',
    'code-block',
    'table',
    'image',
    'heading',
    'list-item',
    'blockquote',
    'thematic-break',
] as const satisfies readonly ReaderAtomicUnitKind[];

const READER_ATOMIC_UNIT_KIND_SET = new Set<ReaderAtomicUnitKind>(READER_ATOMIC_UNIT_KINDS);
const RENDERED_ATOMIC_UNIT_SELECTOR = '.katex-display, .katex, pre, table, code, img, h1, h2, h3, h4, h5, h6, li, blockquote, hr';
const NON_CONTENT_TEXT_SELECTOR = [
    'button',
    '[role="button"]',
    '[data-testid="webpage-citation-pill"]',
    '[data-aimd-role]',
    '.sr-only',
    '.katex-mathml',
    'script',
    'style',
    'noscript',
    'svg',
].join(',');

export function isTextSelectableAtomicUnitKind(kind: ReaderAtomicUnitKind): boolean {
    return kind === 'inline-code' || kind === 'code-block' || kind === 'table';
}

function isReaderAtomicUnitKind(value: string | null): value is ReaderAtomicUnitKind {
    return Boolean(value && READER_ATOMIC_UNIT_KIND_SET.has(value as ReaderAtomicUnitKind));
}

function isStructuralUnitKind(kind: ReaderAtomicUnitKind | null): boolean {
    return kind === 'heading'
        || kind === 'list-item'
        || kind === 'blockquote'
        || kind === 'thematic-break';
}

export function resolveRenderedAtomicUnitKind(element: HTMLElement): ReaderAtomicUnitKind | null {
    if (element.matches('code') && element.closest('pre')) return null;
    const annotatedKind = element.getAttribute('data-aimd-unit-kind');
    if (isReaderAtomicUnitKind(annotatedKind)) return annotatedKind;
    if (element.matches('.katex-display')) return 'display-math';
    if (element.matches('.katex')) return 'inline-math';
    if (element.matches('pre')) return 'code-block';
    if (element.matches('table')) return 'table';
    if (element.matches('code')) return 'inline-code';
    if (element.matches('img')) return 'image';
    if (element.matches('li')) return 'list-item';
    if (element.matches('blockquote')) return 'blockquote';
    if (element.matches('hr')) return 'thematic-break';
    if (element.matches('h1, h2, h3, h4, h5, h6')) return 'heading';
    return null;
}

function resolveRenderedAtomicUnitMode(element: HTMLElement, kind: ReaderAtomicUnitKind | null): ReaderAtomicUnitMode {
    const mode = element.getAttribute('data-aimd-unit-mode');
    if (mode === 'atomic' || mode === 'structural') return mode;
    return isStructuralUnitKind(kind) ? 'structural' : 'atomic';
}

function compareDocumentOrder(a: Element, b: Element): number {
    if (a === b) return 0;
    const relation = a.compareDocumentPosition(b);
    if (relation & Node.DOCUMENT_POSITION_FOLLOWING) return -1;
    if (relation & Node.DOCUMENT_POSITION_PRECEDING) return 1;
    return 0;
}

function collectRenderedUnitElements(root: HTMLElement): Array<{ kind: ReaderAtomicUnitKind; mode: ReaderAtomicUnitMode; element: HTMLElement }> {
    const elements = Array.from(root.querySelectorAll<HTMLElement>(RENDERED_ATOMIC_UNIT_SELECTOR))
        .filter((element) => {
            if (element.matches('.katex') && element.closest('.katex-display')) return false;
            if (element.matches('code') && element.closest('pre')) return false;
            return true;
        })
        .sort(compareDocumentOrder);

    return elements
        .map((element) => {
            const kind = resolveRenderedAtomicUnitKind(element);
            if (!kind) return null;
            return {
                kind,
                mode: resolveRenderedAtomicUnitMode(element, kind),
                element,
            };
        })
        .filter((unit): unit is { kind: ReaderAtomicUnitKind; mode: ReaderAtomicUnitMode; element: HTMLElement } => Boolean(unit));
}

export function annotateRenderedAtomicUnits(root: HTMLElement, units: ReaderAtomicUnit[]): SelectedAtomicUnit[] {
    const domUnits = collectRenderedUnitElements(root);
    clearRenderedAtomicUnitAttributes(root);
    const annotated: SelectedAtomicUnit[] = [];
    let searchStart = 0;

    for (const unit of units) {
        const domIndex = domUnits.findIndex((domUnit, index) => index >= searchStart && domUnit.kind === unit.kind);
        if (domIndex < 0) continue;

        const domUnit = domUnits[domIndex]!;
        domUnit.element.setAttribute('data-aimd-unit-id', unit.id);
        domUnit.element.setAttribute('data-aimd-unit-kind', unit.kind);
        domUnit.element.setAttribute('data-aimd-unit-mode', unit.mode);
        domUnit.element.setAttribute('data-aimd-md-start', String(unit.start));
        domUnit.element.setAttribute('data-aimd-md-end', String(unit.end));

        annotated.push({
            ...unit,
            element: domUnit.element,
        });
        searchStart = domIndex + 1;
    }

    return annotated;
}

function clearRenderedAtomicUnitAttributes(root: HTMLElement): void {
    root.querySelectorAll<HTMLElement>('[data-aimd-unit-id]').forEach((element) => {
        element.removeAttribute('data-aimd-unit-id');
        element.removeAttribute('data-aimd-unit-kind');
        element.removeAttribute('data-aimd-unit-mode');
        element.removeAttribute('data-aimd-md-start');
        element.removeAttribute('data-aimd-md-end');
    });
}

export function clearRenderedAtomicSelection(root: HTMLElement): void {
    root.querySelectorAll<HTMLElement>('[data-aimd-unit-state="selected"]').forEach((element) => {
        element.removeAttribute('data-aimd-unit-state');
    });
}

export function applyRenderedAtomicSelection(root: HTMLElement, ids: string[]): void {
    clearRenderedAtomicSelection(root);
    ids.forEach((id) => {
        root.querySelector<HTMLElement>(`[data-aimd-unit-id="${id}"]`)?.setAttribute('data-aimd-unit-state', 'selected');
    });
}

export function resolveReaderSelectionRange(selection: Selection | null, shadow: ShadowRoot, root: HTMLElement): Range | null {
    if (!selection || selection.rangeCount < 1) return null;

    const endpointsInsideRoot = (startContainer: Node, endContainer: Node): boolean =>
        root.contains(startContainer) && root.contains(endContainer);

    if (typeof selection.getComposedRanges === 'function') {
        const composed = selection.getComposedRanges({ shadowRoots: [shadow] })[0];
        if (composed && endpointsInsideRoot(composed.startContainer, composed.endContainer)) {
            const range = document.createRange();
            range.setStart(composed.startContainer, composed.startOffset);
            range.setEnd(composed.endContainer, composed.endOffset);
            return range;
        }
    }

    const fallback = selection.getRangeAt(0);
    if (!root.contains(fallback.commonAncestorContainer)) return null;
    if (!endpointsInsideRoot(fallback.startContainer, fallback.endContainer)) return null;
    return fallback;
}

export function resolveSelectedAtomicUnits(range: Range, root: HTMLElement): SelectedAtomicUnit[] {
    const selected = Array.from(root.querySelectorAll<HTMLElement>('[data-aimd-unit-id]'))
        .map((element) => {
            const kind = resolveRenderedAtomicUnitKind(element);
            if (!kind) return null;
            return {
                element,
                kind,
                mode: resolveRenderedAtomicUnitMode(element, kind),
            };
        })
        .filter((candidate): candidate is { element: HTMLElement; kind: ReaderAtomicUnitKind; mode: ReaderAtomicUnitMode } => {
            if (!candidate) return false;
            const { element, kind, mode } = candidate;
            if (!range.intersectsNode(element)) return false;
            if (mode === 'structural') return rangeCoversElementText(range, element);
            if (isTextSelectableAtomicUnitKind(kind)) return rangeCoversElementText(range, element);
            return true;
        })
        .map(({ element, kind, mode }) => ({
            id: element.getAttribute('data-aimd-unit-id') || '',
            kind,
            mode,
            start: Number(element.getAttribute('data-aimd-md-start') || 0),
            end: Number(element.getAttribute('data-aimd-md-end') || 0),
            source: '',
            element,
        }));

    return selected
        .filter((unit) => !selected.some((candidate) => (
            candidate !== unit
            && candidate.mode === 'structural'
            && candidate.element.contains(unit.element)
        )))
        .sort((left, right) => left.start - right.start);
}

export function resolveStrictRenderedAtomicUnits(range: Range, root: HTMLElement): RenderedAtomicUnit[] {
    if (!root.contains(range.startContainer) || !root.contains(range.endContainer)) return [];

    const selected = collectStrictCandidateElements(range, root)
        .map((element) => {
            const kind = resolveRenderedAtomicUnitKind(element);
            if (!kind) return null;
            return {
                element,
                kind,
                mode: resolveRenderedAtomicUnitMode(element, kind),
            };
        })
        .filter((unit): unit is RenderedAtomicUnit => Boolean(unit))
        .filter((unit) => rangeIntersectsElement(range, unit.element) && rangeCoversStrictUnit(range, unit));

    return selected
        .filter((unit) => !selected.some((candidate) => (
            candidate !== unit && candidate.element.contains(unit.element)
        )))
        .sort((left, right) => compareDocumentOrder(left.element, right.element));
}

function collectStrictCandidateElements(range: Range, root: HTMLElement): HTMLElement[] {
    const candidates = new Set<HTMLElement>();
    const addCandidate = (element: HTMLElement): void => {
        if (!root.contains(element)) return;
        if (!element.matches(RENDERED_ATOMIC_UNIT_SELECTOR)) return;
        if (element.matches('.katex') && element.closest('.katex-display')) return;
        if (element.matches('code') && element.closest('pre')) return;
        candidates.add(element);
    };
    const commonElement = getElementForNode(range.commonAncestorContainer);
    if (commonElement && root.contains(commonElement)) {
        addCandidate(commonElement);
        commonElement.querySelectorAll<HTMLElement>(RENDERED_ATOMIC_UNIT_SELECTOR).forEach(addCandidate);
    }
    for (const endpoint of [range.startContainer, range.endContainer]) {
        let current = getElementForNode(endpoint);
        while (current && root.contains(current)) {
            addCandidate(current);
            if (current === root) break;
            current = current.parentElement;
        }
    }
    return Array.from(candidates).sort(compareDocumentOrder);
}

function getElementForNode(node: Node): HTMLElement | null {
    if (node instanceof HTMLElement) return node;
    return node.parentElement;
}

function rangeIntersectsElement(range: Range, element: HTMLElement): boolean {
    try {
        return range.intersectsNode(element);
    } catch {
        return false;
    }
}

function rangeCoversStrictUnit(range: Range, unit: RenderedAtomicUnit): boolean {
    if (unit.kind === 'image' || unit.kind === 'thematic-break') {
        return rangeCoversNode(range, unit.element);
    }
    if (unit.kind === 'inline-math' || unit.kind === 'display-math') {
        const visualRoot = unit.element.querySelector<HTMLElement>('.katex-html') ?? unit.element;
        return rangeCoversSemanticText(range, visualRoot) || rangeCoversNode(range, unit.element);
    }
    if (unit.kind === 'code-block') {
        const codeRoot = unit.element.querySelector<HTMLElement>('code, .cm-content, [data-lexical-editor="true"]') ?? unit.element;
        return rangeCoversSemanticText(range, codeRoot);
    }
    return rangeCoversSemanticText(range, unit.element);
}

function rangeCoversNode(range: Range, element: HTMLElement): boolean {
    if (!element.parentNode) return false;
    const elementRange = element.ownerDocument.createRange();
    elementRange.selectNode(element);
    return range.compareBoundaryPoints(Range.START_TO_START, elementRange) <= 0
        && range.compareBoundaryPoints(Range.END_TO_END, elementRange) >= 0;
}

function rangeCoversSemanticText(range: Range, element: HTMLElement): boolean {
    const textNodes = collectTextNodes(element).filter((node) => {
        if (!node.data.trim()) return false;
        return !node.parentElement?.closest(NON_CONTENT_TEXT_SELECTOR);
    });
    const first = textNodes[0];
    const last = textNodes[textNodes.length - 1];
    if (!first || !last) return false;

    const elementRange = element.ownerDocument.createRange();
    elementRange.setStart(first, 0);
    elementRange.setEnd(last, last.data.length);
    return range.compareBoundaryPoints(Range.START_TO_START, elementRange) <= 0
        && range.compareBoundaryPoints(Range.END_TO_END, elementRange) >= 0;
}

function rangeCoversElementText(range: Range, element: HTMLElement): boolean {
    if (element.matches('hr')) return true;
    const textNodes = collectTextNodes(element).filter((node) => Boolean(node.data.trim()));
    const first = textNodes[0];
    const last = textNodes[textNodes.length - 1];
    if (!first || !last) return false;

    const elementRange = element.ownerDocument.createRange();
    elementRange.setStart(first, 0);
    elementRange.setEnd(last, last.data.length);

    return range.compareBoundaryPoints(Range.START_TO_START, elementRange) <= 0
        && range.compareBoundaryPoints(Range.END_TO_END, elementRange) >= 0;
}

function collectTextNodes(root: HTMLElement): Text[] {
    const doc = root.ownerDocument;
    const walker = doc.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const nodes: Text[] = [];
    let current = walker.nextNode();
    while (current) {
        nodes.push(current as Text);
        current = walker.nextNode();
    }
    return nodes;
}
