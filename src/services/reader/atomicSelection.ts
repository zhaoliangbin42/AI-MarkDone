import type { ReaderAtomicUnit, ReaderAtomicUnitKind } from '../renderer/renderMarkdown';

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

function collectRenderedUnitElements(root: HTMLElement): Array<{ kind: ReaderAtomicUnitKind; element: HTMLElement }> {
    const elements = Array.from(root.querySelectorAll<HTMLElement>('.katex-display, .katex, pre, table, code, img'))
        .filter((element) => {
            if (element.matches('.katex') && element.closest('.katex-display')) return false;
            if (element.matches('code') && element.closest('pre')) return false;
            return true;
        })
        .sort(compareDocumentOrder);

    return elements.map((element) => {
        if (element.matches('.katex-display')) return { kind: 'display-math' as const, element };
        if (element.matches('.katex')) return { kind: 'inline-math' as const, element };
        if (element.matches('code')) return { kind: 'inline-code' as const, element };
        if (element.matches('pre')) return { kind: 'code-block' as const, element };
        if (element.matches('img')) return { kind: 'image' as const, element };
        return { kind: 'table' as const, element };
    });
}

export function annotateRenderedAtomicUnits(root: HTMLElement, units: ReaderAtomicUnit[]): SelectedAtomicUnit[] {
    const domUnits = collectRenderedUnitElements(root);

    return domUnits.map((domUnit, index) => {
        const unit = units[index];
        if (!unit || unit.kind !== domUnit.kind) {
            throw new Error(`Reader atomic unit mismatch at index ${index}: expected ${unit?.kind ?? 'none'}, got ${domUnit.kind}`);
        }

        domUnit.element.setAttribute('data-aimd-unit-id', unit.id);
        domUnit.element.setAttribute('data-aimd-unit-kind', unit.kind);
        domUnit.element.setAttribute('data-aimd-md-start', String(unit.start));
        domUnit.element.setAttribute('data-aimd-md-end', String(unit.end));

        return {
            ...unit,
            element: domUnit.element,
        };
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

    if (typeof selection.getComposedRanges === 'function') {
        const composed = selection.getComposedRanges({ shadowRoots: [shadow] })[0];
        if (composed) {
            const range = document.createRange();
            range.setStart(composed.startContainer, composed.startOffset);
            range.setEnd(composed.endContainer, composed.endOffset);
            return range;
        }
    }

    const fallback = selection.getRangeAt(0);
    if (!root.contains(fallback.commonAncestorContainer)) return null;
    return fallback;
}

export function resolveSelectedAtomicUnits(range: Range, root: HTMLElement): SelectedAtomicUnit[] {
    return Array.from(root.querySelectorAll<HTMLElement>('[data-aimd-unit-id]'))
        .filter((element) => range.intersectsNode(element))
        .map((element) => ({
            id: element.getAttribute('data-aimd-unit-id') || '',
            kind: (element.getAttribute('data-aimd-unit-kind') || '') as ReaderAtomicUnitKind,
            start: Number(element.getAttribute('data-aimd-md-start') || 0),
            end: Number(element.getAttribute('data-aimd-md-end') || 0),
            source: '',
            element,
        }))
        .sort((left, right) => left.start - right.start);
}
