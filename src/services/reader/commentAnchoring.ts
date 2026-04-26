import type { SelectedAtomicUnit } from './atomicSelection';
import { buildAtomicSelectionExport } from './atomicExport';
import type {
    ReaderCommentAtomicRef,
    ReaderCommentDomPoint,
    ReaderCommentDomRange,
    ReaderCommentRecord,
    ReaderCommentSelectors,
    ReaderCommentTextPositionSelector,
    ReaderCommentTextQuoteSelector,
} from './commentSession';

export type ReaderCommentRect = {
    left: number;
    top: number;
    width: number;
    height: number;
};

export type ReaderCommentResolvedAnchor = {
    range: Range | null;
    units: SelectedAtomicUnit[];
    rects: ReaderCommentRect[];
    unionRect: ReaderCommentRect | null;
};

function serializeNodePath(root: HTMLElement, node: Node): number[] | null {
    const path: number[] = [];
    let current: Node | null = node;

    while (current && current !== root) {
        const parent: ParentNode | null = current.parentNode;
        if (!parent) return null;
        path.push(Array.prototype.indexOf.call(parent.childNodes, current));
        current = parent;
    }

    if (current !== root) return null;
    path.reverse();
    return path;
}

function resolveNodePath(root: HTMLElement, path: number[]): Node | null {
    let current: Node = root;
    for (const index of path) {
        const next = current.childNodes.item(index);
        if (!next) return null;
        current = next;
    }
    return current;
}

function createDomPoint(root: HTMLElement, container: Node, offset: number): ReaderCommentDomPoint | null {
    const path = serializeNodePath(root, container);
    if (!path) return null;
    return { path, offset };
}

function createDomRange(root: HTMLElement, range: Range): ReaderCommentDomRange | null {
    const start = createDomPoint(root, range.startContainer, range.startOffset);
    const end = createDomPoint(root, range.endContainer, range.endOffset);
    if (!start || !end) return null;
    return { start, end };
}

function restoreDomRange(root: HTMLElement, domRange: ReaderCommentDomRange | null): Range | null {
    if (!domRange) return null;
    const startNode = resolveNodePath(root, domRange.start.path);
    const endNode = resolveNodePath(root, domRange.end.path);
    if (!startNode || !endNode) return null;

    const range = document.createRange();
    try {
        range.setStart(startNode, domRange.start.offset);
        range.setEnd(endNode, domRange.end.offset);
        return range;
    } catch {
        return null;
    }
}

function collectVisibleText(root: HTMLElement): string {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
        acceptNode(node) {
            if (!node.textContent) return NodeFilter.FILTER_REJECT;
            if (node.parentElement?.closest('[data-aimd-unit-id]')) return NodeFilter.FILTER_REJECT;
            return NodeFilter.FILTER_ACCEPT;
        },
    });

    let text = '';
    while (walker.nextNode()) text += walker.currentNode.textContent ?? '';
    return text;
}

function getTextOffset(root: HTMLElement, container: Node, localOffset: number): number | null {
    if (!(container instanceof Text)) return null;

    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
        acceptNode(node) {
            if (!node.textContent) return NodeFilter.FILTER_REJECT;
            if (node.parentElement?.closest('[data-aimd-unit-id]')) return NodeFilter.FILTER_REJECT;
            return NodeFilter.FILTER_ACCEPT;
        },
    });

    let count = 0;
    while (walker.nextNode()) {
        const node = walker.currentNode as Text;
        if (node === container) return count + localOffset;
        count += node.data.length;
    }
    return null;
}

function buildTextPosition(root: HTMLElement, range: Range): ReaderCommentTextPositionSelector {
    return {
        start: getTextOffset(root, range.startContainer, range.startOffset),
        end: getTextOffset(root, range.endContainer, range.endOffset),
    };
}

function buildTextQuote(root: HTMLElement, exact: string): ReaderCommentTextQuoteSelector {
    const fullText = collectVisibleText(root);
    const trimmed = exact.trim();
    if (!trimmed) return { exact: '', prefix: '', suffix: '' };

    const index = fullText.indexOf(trimmed);
    if (index < 0) return { exact: trimmed, prefix: '', suffix: '' };

    const radius = 32;
    return {
        exact: trimmed,
        prefix: fullText.slice(Math.max(0, index - radius), index),
        suffix: fullText.slice(index + trimmed.length, index + trimmed.length + radius),
    };
}

function toRelativeRect(containerRect: DOMRect, rect: DOMRect): ReaderCommentRect | null {
    if (rect.width <= 0 || rect.height <= 0) return null;
    return {
        left: rect.left - containerRect.left,
        top: rect.top - containerRect.top,
        width: rect.width,
        height: rect.height,
    };
}

function dedupeRects(rects: ReaderCommentRect[]): ReaderCommentRect[] {
    const seen = new Set<string>();
    return rects.filter((rect) => {
        const key = [rect.left, rect.top, rect.width, rect.height].map((value) => Math.round(value)).join(':');
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });
}

function buildUnionRect(rects: ReaderCommentRect[]): ReaderCommentRect | null {
    if (rects.length < 1) return null;
    const left = Math.min(...rects.map((rect) => rect.left));
    const top = Math.min(...rects.map((rect) => rect.top));
    const right = Math.max(...rects.map((rect) => rect.left + rect.width));
    const bottom = Math.max(...rects.map((rect) => rect.top + rect.height));
    return {
        left,
        top,
        width: right - left,
        height: bottom - top,
    };
}

function rectsOverlap(a: ReaderCommentRect, b: ReaderCommentRect): boolean {
    return (
        a.left < b.left + b.width &&
        a.left + a.width > b.left &&
        a.top < b.top + b.height &&
        a.top + a.height > b.top
    );
}

function shouldMergeRects(a: ReaderCommentRect, b: ReaderCommentRect): boolean {
    const aBottom = a.top + a.height;
    const bBottom = b.top + b.height;
    const verticalOverlap = Math.min(aBottom, bBottom) - Math.max(a.top, b.top);
    const minHeight = Math.min(a.height, b.height);
    const sameRow = verticalOverlap >= Math.max(4, minHeight * 0.45);
    if (!sameRow) return false;

    const horizontalGap = Math.max(a.left, b.left) - Math.min(a.left + a.width, b.left + b.width);
    return horizontalGap <= 8;
}

function mergeRects(rects: ReaderCommentRect[]): ReaderCommentRect[] {
    const sorted = [...rects].sort((left, right) => (left.top - right.top) || (left.left - right.left));
    const merged: ReaderCommentRect[] = [];

    for (const rect of sorted) {
        const last = merged[merged.length - 1];
        if (!last) {
            merged.push({ ...rect });
            continue;
        }

        if (rectsOverlap(last, rect) || shouldMergeRects(last, rect)) {
            const nextLeft = Math.min(last.left, rect.left);
            const nextTop = Math.min(last.top, rect.top);
            const nextRight = Math.max(last.left + last.width, rect.left + rect.width);
            const nextBottom = Math.max(last.top + last.height, rect.top + rect.height);
            last.left = nextLeft;
            last.top = nextTop;
            last.width = nextRight - nextLeft;
            last.height = nextBottom - nextTop;
            continue;
        }

        merged.push({ ...rect });
    }

    return merged;
}

function filterTextRectsAgainstUnits(textRects: ReaderCommentRect[], unitRects: ReaderCommentRect[]): ReaderCommentRect[] {
    if (unitRects.length < 1) return textRects;

    return textRects.filter((textRect) => !unitRects.some((unitRect) => {
        if (!rectsOverlap(textRect, unitRect)) return false;
        const overlapLeft = Math.max(textRect.left, unitRect.left);
        const overlapTop = Math.max(textRect.top, unitRect.top);
        const overlapRight = Math.min(textRect.left + textRect.width, unitRect.left + unitRect.width);
        const overlapBottom = Math.min(textRect.top + textRect.height, unitRect.top + unitRect.height);
        const overlapArea = Math.max(0, overlapRight - overlapLeft) * Math.max(0, overlapBottom - overlapTop);
        const textArea = textRect.width * textRect.height;
        return textArea > 0 && overlapArea / textArea >= 0.35;
    }));
}

function collectRangeClientRects(range: Range): DOMRect[] {
    const getClientRects = (range as Range & { getClientRects?: () => DOMRectList | DOMRect[] }).getClientRects;
    if (typeof getClientRects === 'function') {
        return Array.from(getClientRects.call(range) as DOMRectList | DOMRect[]);
    }

    const getBoundingClientRect = (range as Range & { getBoundingClientRect?: () => DOMRect }).getBoundingClientRect;
    if (typeof getBoundingClientRect === 'function') {
        const rect = getBoundingClientRect.call(range);
        return rect ? [rect] : [];
    }

    return [];
}

function resolveAtomicRef(root: HTMLElement, ref: ReaderCommentAtomicRef): SelectedAtomicUnit | null {
    const selector = `[data-aimd-unit-kind="${ref.kind}"][data-aimd-md-start="${ref.start}"][data-aimd-md-end="${ref.end}"]`;
    const element = root.querySelector<HTMLElement>(selector);
    if (!element) return null;
    return {
        id: element.getAttribute('data-aimd-unit-id') || '',
        kind: ref.kind,
        mode: (element.getAttribute('data-aimd-unit-mode') || 'atomic') as SelectedAtomicUnit['mode'],
        start: ref.start,
        end: ref.end,
        source: '',
        element,
    };
}

export function resolveSelectionLayout(params: {
    root: HTMLElement;
    range: Range | null;
    selectedUnits: SelectedAtomicUnit[];
}): ReaderCommentResolvedAnchor {
    const { root, range, selectedUnits } = params;
    const containerRect = root.getBoundingClientRect();
    const textRects: ReaderCommentRect[] = [];
    const unitRects: ReaderCommentRect[] = [];

    if (range) {
        collectRangeClientRects(range).forEach((clientRect) => {
            const relative = toRelativeRect(containerRect, clientRect);
            if (relative) textRects.push(relative);
        });
    }

    selectedUnits.forEach((unit) => {
        const relative = toRelativeRect(containerRect, unit.element.getBoundingClientRect());
        if (relative) unitRects.push(relative);
    });

    const normalized = mergeRects(dedupeRects([
        ...filterTextRectsAgainstUnits(textRects, unitRects),
        ...unitRects,
    ]));
    return {
        range,
        units: selectedUnits,
        rects: normalized,
        unionRect: buildUnionRect(normalized),
    };
}

export function captureCommentSelectors(params: {
    range: Range;
    root: HTMLElement;
    selectedUnits: SelectedAtomicUnit[];
}): ReaderCommentSelectors {
    const quoteText = params.range.toString();
    return {
        textQuote: buildTextQuote(params.root, quoteText),
        textPosition: buildTextPosition(params.root, params.range),
        domRange: createDomRange(params.root, params.range),
        atomicRefs: params.selectedUnits.map((unit) => ({
            kind: unit.kind,
            start: unit.start,
            end: unit.end,
        })),
    };
}

export function createReaderCommentRecord(params: {
    id: string;
    itemId: string;
    comment: string;
    range: Range;
    root: HTMLElement;
    selectedUnits: SelectedAtomicUnit[];
}): ReaderCommentRecord {
    const now = Date.now();
    const selectors = captureCommentSelectors(params);
    const quoteText = params.range.toString().trim();
    const sourceMarkdown = buildAtomicSelectionExport({
        range: params.range,
        root: params.root,
        selectedUnits: params.selectedUnits,
    });

    return {
        id: params.id,
        itemId: params.itemId,
        quoteText: quoteText || sourceMarkdown,
        sourceMarkdown,
        comment: params.comment,
        selectors,
        createdAt: now,
        updatedAt: now,
    };
}

export function resolveReaderCommentAnchor(root: HTMLElement, record: ReaderCommentRecord): ReaderCommentResolvedAnchor {
    const range = restoreDomRange(root, record.selectors.domRange);
    const units = record.selectors.atomicRefs
        .map((ref) => resolveAtomicRef(root, ref))
        .filter((value): value is SelectedAtomicUnit => Boolean(value));
    return resolveSelectionLayout({ root, range, selectedUnits: units });
}
