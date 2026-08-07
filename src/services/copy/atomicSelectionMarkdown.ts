import type { SiteAdapter } from '../../drivers/content/adapters/base';
import { extractLatexSource } from '../../core/latex/extractLatexSource';
import {
    resolveRenderedAtomicUnitKind,
    resolveStrictRenderedAtomicSelection,
    type RenderedAtomicUnit,
} from '../reader/atomicSelection';
import { formatCanonicalMarkdownForCopy } from './canonicalMarkdownCopy';
import { copyMarkdownFromElement } from './copy-markdown';

const DEFAULT_MAX_PROCESSING_TIME_MS = 64;
const DEFAULT_MAX_NODE_COUNT = 5_000;

export type PageAtomicSelectionSnapshot = {
    range: Range;
    root: HTMLElement;
    units: RenderedAtomicUnit[];
    canonicalMarkdown: string;
};

type PageAtomicSelectionSnapshotParams = {
    adapter: SiteAdapter;
    range: Range;
    root: HTMLElement;
    maxProcessingTimeMs?: number;
    maxNodeCount?: number;
};

export function buildPageAtomicSelectionSnapshot(
    params: PageAtomicSelectionSnapshotParams,
): PageAtomicSelectionSnapshot | null {
    const {
        adapter,
        range,
        root,
        maxProcessingTimeMs = DEFAULT_MAX_PROCESSING_TIME_MS,
        maxNodeCount = DEFAULT_MAX_NODE_COUNT,
    } = params;
    const startedAt = performance.now();
    const selection = resolveStrictRenderedAtomicSelection(range, root);
    if (!selection.isValid) return null;
    const fragmentRoot = cloneClosedSelectionFragment(adapter, range, root);
    if (!fragmentRoot) return null;
    const remainingTime = maxProcessingTimeMs - (performance.now() - startedAt);
    if (remainingTime <= 0) return null;
    const result = copyMarkdownFromElement(adapter, fragmentRoot, {
        maxProcessingTimeMs: remainingTime,
        maxNodeCount,
    });
    if (!result.ok || performance.now() - startedAt > maxProcessingTimeMs) return null;
    const canonicalMarkdown = result.markdown;
    if (!canonicalMarkdown) return null;
    return {
        range: range.cloneRange(),
        root,
        units: selection.units,
        canonicalMarkdown,
    };
}

export function buildPageAtomicSelectionMarkdown(params: PageAtomicSelectionSnapshotParams): string | null {
    const snapshot = buildPageAtomicSelectionSnapshot(params);
    return snapshot ? formatCanonicalMarkdownForCopy(snapshot.canonicalMarkdown) || null : null;
}

function cloneClosedSelectionFragment(
    adapter: SiteAdapter,
    range: Range,
    root: HTMLElement,
): HTMLElement | null {
    if (!root.contains(range.startContainer) || !root.contains(range.endContainer)) return null;
    const cloneRoot = resolveSelectionCloneRoot(range, root);
    if (!cloneRoot) return null;
    const context = { range, formulaSourceValid: true, adapter };
    const content = cloneSelectedNode(cloneRoot, context);
    if (!(content instanceof HTMLElement) || !context.formulaSourceValid) return null;
    const fragmentRoot = root.ownerDocument.createElement('div');
    fragmentRoot.appendChild(content);
    return fragmentRoot.textContent?.trim() || fragmentRoot.querySelector('.katex, .katex-display, img, hr')
        ? fragmentRoot
        : null;
}

function resolveSelectionCloneRoot(range: Range, root: HTMLElement): HTMLElement | null {
    let cloneRoot = range.commonAncestorContainer instanceof HTMLElement
        ? range.commonAncestorContainer
        : range.commonAncestorContainer.parentElement;
    if (!cloneRoot || !root.contains(cloneRoot)) return null;

    let current: HTMLElement | null = cloneRoot;
    while (current && root.contains(current)) {
        if (resolveRenderedAtomicUnitKind(current)) cloneRoot = current;
        if (current === root) break;
        current = current.parentElement;
    }
    if (cloneRoot.matches('li') && cloneRoot.parentElement?.matches('ol, ul')) {
        cloneRoot = cloneRoot.parentElement;
    }
    return cloneRoot;
}

function cloneSelectedNode(
    node: Node,
    context: { range: Range; formulaSourceValid: boolean; adapter: SiteAdapter },
): Node | null {
    if (node instanceof Text) {
        if (!rangeIntersectsNode(context.range, node)) return null;
        const start = node === context.range.startContainer ? context.range.startOffset : 0;
        const end = node === context.range.endContainer ? context.range.endOffset : node.data.length;
        if (end <= start) return null;
        return node.ownerDocument.createTextNode(node.data.slice(start, end));
    }
    if (!(node instanceof HTMLElement)) return null;
    if (!rangeIntersectsNode(context.range, node)) return null;

    if (isFormulaContainer(node)) {
        const source = extractFormulaSource(context.adapter, node);
        if (!source) {
            context.formulaSourceValid = false;
            return null;
        }
        const compact = node.ownerDocument.createElement('span');
        compact.className = node.classList.contains('katex-display')
            ? 'katex-display'
            : 'katex';
        compact.setAttribute('data-latex-source', source);
        return compact;
    }

    const clone = node.cloneNode(false) as HTMLElement;
    adjustOrderedListStart(node, clone, context.range);
    node.childNodes.forEach((child) => {
        const selected = cloneSelectedNode(child, context);
        if (selected) clone.appendChild(selected);
    });
    if (clone.childNodes.length > 0 || clone.matches('img, hr, br')) return clone;
    return null;
}

function extractFormulaSource(adapter: SiteAdapter, element: HTMLElement): string | null {
    const parserAdapter = adapter.getMarkdownParserAdapter();
    if (parserAdapter) {
        try {
            return parserAdapter.extractLatex(element)?.latex?.trim() || null;
        } catch {
            return null;
        }
    }
    return extractLatexSource(element);
}

function isFormulaContainer(element: HTMLElement): boolean {
    return element.classList.contains('katex-display')
        || (
            element.classList.contains('katex')
            && element.closest('.katex-display') === null
        );
}

function rangeIntersectsNode(range: Range, node: Node): boolean {
    try {
        return range.intersectsNode(node);
    } catch {
        return false;
    }
}

function adjustOrderedListStart(source: HTMLElement, clone: HTMLElement, range: Range): void {
    if (!(source instanceof HTMLOListElement) || !(clone instanceof HTMLOListElement)) return;
    const items = Array.from(source.children).filter((child): child is HTMLLIElement => child instanceof HTMLLIElement);
    const firstSelectedIndex = items.findIndex((item) => {
        try {
            return range.intersectsNode(item);
        } catch {
            return false;
        }
    });
    if (firstSelectedIndex < 0) return;
    clone.start = resolveOrderedListItemNumber(source, items, firstSelectedIndex);
}

function resolveOrderedListItemNumber(
    list: HTMLOListElement,
    items: HTMLLIElement[],
    targetIndex: number,
): number {
    let ordinal = list.start;
    for (let index = 0; index <= targetIndex; index += 1) {
        const explicit = items[index]?.getAttribute('value');
        if (explicit && Number.isFinite(Number(explicit))) ordinal = Math.round(Number(explicit));
        if (index === targetIndex) return ordinal;
        ordinal += 1;
    }
    return ordinal;
}
