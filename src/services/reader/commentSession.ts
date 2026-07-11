import type { ReaderAtomicUnitKind } from '../renderer/renderMarkdown';
import type { ReaderCommentSortMode } from '../../core/settings/readerCommentExport';

export type ReaderCommentTextQuoteSelector = {
    exact: string;
    prefix: string;
    suffix: string;
};

export type ReaderCommentTextPositionSelector = {
    start: number | null;
    end: number | null;
};

export type ReaderCommentDomPoint = {
    path: number[];
    offset: number;
};

export type ReaderCommentDomRange = {
    start: ReaderCommentDomPoint;
    end: ReaderCommentDomPoint;
};

export type ReaderCommentAtomicRef = {
    kind: ReaderAtomicUnitKind;
    start: number;
    end: number;
};

export type ReaderCommentSelectors = {
    textQuote: ReaderCommentTextQuoteSelector;
    textPosition: ReaderCommentTextPositionSelector;
    domRange: ReaderCommentDomRange | null;
    atomicRefs: ReaderCommentAtomicRef[];
};

export type ReaderCommentRecord = {
    id: string;
    itemId: string;
    quoteText: string;
    sourceMarkdown: string;
    comment: string;
    selectors: ReaderCommentSelectors;
    createdAt: number;
    updatedAt: number;
};

const scopes = new Map<string, Map<string, ReaderCommentRecord[]>>();

function numericPosition(value: number | null | undefined): number {
    return typeof value === 'number' && Number.isFinite(value) ? value : Number.POSITIVE_INFINITY;
}

export function compareReaderComments(left: ReaderCommentRecord, right: ReaderCommentRecord, sortMode: ReaderCommentSortMode = 'created'): number {
    if (sortMode === 'position') {
        const positionDelta = numericPosition(left.selectors.textPosition.start) - numericPosition(right.selectors.textPosition.start);
        if (positionDelta !== 0) return positionDelta;
        const endDelta = numericPosition(left.selectors.textPosition.end) - numericPosition(right.selectors.textPosition.end);
        if (endDelta !== 0) return endDelta;
    }
    return (left.createdAt - right.createdAt) || left.id.localeCompare(right.id);
}

export function sortReaderComments(comments: ReaderCommentRecord[], sortMode: ReaderCommentSortMode = 'created'): ReaderCommentRecord[] {
    return [...comments].sort((left, right) => compareReaderComments(left, right, sortMode));
}

function getItemBucket(scopeId: string, itemId: string, create: boolean): ReaderCommentRecord[] | null {
    let scope = scopes.get(scopeId);
    if (!scope) {
        if (!create) return null;
        scope = new Map();
        scopes.set(scopeId, scope);
    }

    let bucket = scope.get(itemId);
    if (!bucket) {
        if (!create) return null;
        bucket = [];
        scope.set(itemId, bucket);
    }

    return bucket;
}

export function listReaderComments(scopeId: string, itemId: string, sortMode: ReaderCommentSortMode = 'created'): ReaderCommentRecord[] {
    return sortReaderComments(getItemBucket(scopeId, itemId, false) ?? [], sortMode);
}

export function saveReaderComment(scopeId: string, record: ReaderCommentRecord): ReaderCommentRecord {
    const bucket = getItemBucket(scopeId, record.itemId, true)!;
    const index = bucket.findIndex((entry) => entry.id === record.id);
    const next = { ...record };
    if (index >= 0) bucket[index] = next;
    else bucket.push(next);
    return next;
}

export function removeReaderComment(scopeId: string, itemId: string, commentId: string): void {
    const bucket = getItemBucket(scopeId, itemId, false);
    if (!bucket) return;
    const next = bucket.filter((entry) => entry.id !== commentId);
    if (next.length > 0) {
        const scope = scopes.get(scopeId)!;
        scope.set(itemId, next);
        return;
    }

    const scope = scopes.get(scopeId);
    scope?.delete(itemId);
    if (scope && scope.size < 1) scopes.delete(scopeId);
}

export function clearReaderCommentScope(scopeId: string): void {
    scopes.delete(scopeId);
}
