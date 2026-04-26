import type { ReaderAtomicUnit, ReaderAtomicUnitKind, ReaderAtomicUnitMode } from '../renderer/renderMarkdown';

export type SelectedAtomicUnit = ReaderAtomicUnit & {
    element: HTMLElement;
};

function compareDocumentOrder(a: Element, b: Element): number {
    if (a === b) return 0;
    const relation = a.compareDocumentPosition(b);
    if (relation & Node.DOCUMENT_POSITION_FOLLOWING) return -1;
    if (relation & Node.DOCUMENT_POSITION_PRECEDING) return 1;
    return 0;
}

function collectRenderedUnitElements(root: HTMLElement): Array<{ kind: ReaderAtomicUnitKind; mode: ReaderAtomicUnitMode; element: HTMLElement }> {
    const elements = Array.from(root.querySelectorAll<HTMLElement>('.katex-display, .katex, pre, table, code, img, h1, h2, h3, h4, h5, h6, li, blockquote, hr'))
        .filter((element) => {
            if (element.matches('.katex') && element.closest('.katex-display')) return false;
            if (element.matches('code') && element.closest('pre')) return false;
            return true;
        })
        .sort(compareDocumentOrder);

    return elements.map((element) => {
        if (element.matches('.katex-display')) return { kind: 'display-math' as const, mode: 'atomic' as const, element };
        if (element.matches('.katex')) return { kind: 'inline-math' as const, mode: 'atomic' as const, element };
        if (element.matches('code')) return { kind: 'inline-code' as const, mode: 'atomic' as const, element };
        if (element.matches('pre')) return { kind: 'code-block' as const, mode: 'atomic' as const, element };
        if (element.matches('img')) return { kind: 'image' as const, mode: 'atomic' as const, element };
        if (element.matches('table')) return { kind: 'table' as const, mode: 'atomic' as const, element };
        if (element.matches('li')) return { kind: 'list-item' as const, mode: 'structural' as const, element };
        if (element.matches('blockquote')) return { kind: 'blockquote' as const, mode: 'structural' as const, element };
        if (element.matches('hr')) return { kind: 'thematic-break' as const, mode: 'structural' as const, element };
        return { kind: 'heading' as const, mode: 'structural' as const, element };
    });
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
        .filter((element) => {
            if (!range.intersectsNode(element)) return false;
            const mode = element.getAttribute('data-aimd-unit-mode') || 'atomic';
            return mode === 'structural' ? rangeCoversElementText(range, element) : true;
        })
        .map((element) => ({
            id: element.getAttribute('data-aimd-unit-id') || '',
            kind: (element.getAttribute('data-aimd-unit-kind') || '') as ReaderAtomicUnitKind,
            mode: (element.getAttribute('data-aimd-unit-mode') || 'atomic') as ReaderAtomicUnitMode,
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
