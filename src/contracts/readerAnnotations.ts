export type ReaderAnnotationDocument = {
    platform: 'chatgpt';
    conversationId: string;
    title?: string | null;
    lastKnownUrl?: string | null;
};

export type ReaderAnnotationTarget = {
    assistantMessageId: string;
    roundId?: string | null;
    userMessageId?: string | null;
    position?: number | null;
};

export type ReaderAnnotationAnchorState = 'anchored' | 'unanchored';

export type ReaderAnnotationSelectors = {
    textQuote: {
        exact: string;
        prefix: string;
        suffix: string;
    };
    textPosition: {
        start: number | null;
        end: number | null;
    };
    domRange: {
        start: { path: number[]; offset: number };
        end: { path: number[]; offset: number };
    } | null;
    atomicRefs: Array<{
        kind: string;
        start: number;
        end: number;
    }>;
};

export type ReaderAnnotationRecord = {
    id: string;
    itemId: string;
    target: ReaderAnnotationTarget;
    quoteText: string;
    sourceMarkdown: string;
    comment: string;
    selectors: ReaderAnnotationSelectors;
    createdAt: number;
    updatedAt: number;
    revision: number;
    lastKnownAnchorState: ReaderAnnotationAnchorState;
};

export type ReaderAnnotationBundleV1 = {
    schemaVersion: 1;
    document: ReaderAnnotationDocument;
    annotations: ReaderAnnotationRecord[];
};

export type ReaderAnnotationListEntry = {
    document: ReaderAnnotationDocument;
    annotation: ReaderAnnotationRecord;
};

const ANNOTATION_STORAGE_PREFIX = 'aimd:reader_annotations:document:';

export function normalizeReaderAnnotationDocument(document: ReaderAnnotationDocument): ReaderAnnotationDocument {
    return {
        platform: 'chatgpt',
        conversationId: document.conversationId.trim(),
        title: typeof document.title === 'string' ? document.title : null,
        lastKnownUrl: typeof document.lastKnownUrl === 'string' ? document.lastKnownUrl : null,
    };
}

export function readerAnnotationDocumentKey(document: ReaderAnnotationDocument): string {
    const normalized = normalizeReaderAnnotationDocument(document);
    return `${normalized.platform}:conversation:${encodeURIComponent(normalized.conversationId)}`;
}

export function readerAnnotationStorageKey(document: ReaderAnnotationDocument): string {
    return `${ANNOTATION_STORAGE_PREFIX}${readerAnnotationDocumentKey(document)}`;
}

export function isReaderAnnotationDocument(value: unknown): value is ReaderAnnotationDocument {
    if (typeof value !== 'object' || value === null) return false;
    const candidate = value as Record<string, unknown>;
    return candidate.platform === 'chatgpt'
        && typeof candidate.conversationId === 'string'
        && candidate.conversationId.trim().length > 0
        && (candidate.title === undefined || candidate.title === null || typeof candidate.title === 'string')
        && (candidate.lastKnownUrl === undefined || candidate.lastKnownUrl === null || typeof candidate.lastKnownUrl === 'string');
}

function isFiniteNumberOrNull(value: unknown): value is number | null {
    return value === null || (typeof value === 'number' && Number.isFinite(value));
}

function isSelector(value: unknown): value is ReaderAnnotationSelectors {
    if (typeof value !== 'object' || value === null) return false;
    const candidate = value as Record<string, unknown>;
    const quote = candidate.textQuote as Record<string, unknown> | null;
    const position = candidate.textPosition as Record<string, unknown> | null;
    const atomicRefs = candidate.atomicRefs;
    if (!quote || typeof quote.exact !== 'string' || typeof quote.prefix !== 'string' || typeof quote.suffix !== 'string') return false;
    if (!position || !isFiniteNumberOrNull(position.start) || !isFiniteNumberOrNull(position.end)) return false;
    if (candidate.domRange !== null && candidate.domRange !== undefined) {
        const range = candidate.domRange as Record<string, unknown>;
        const point = (value: unknown): boolean => {
            if (typeof value !== 'object' || value === null) return false;
            const item = value as Record<string, unknown>;
            return Array.isArray(item.path)
                && item.path.every((entry) => typeof entry === 'number' && Number.isInteger(entry) && entry >= 0)
                && typeof item.offset === 'number' && Number.isInteger(item.offset) && item.offset >= 0;
        };
        if (!point(range.start) || !point(range.end)) return false;
    }
    return Array.isArray(atomicRefs) && atomicRefs.every((ref) => {
        if (typeof ref !== 'object' || ref === null) return false;
        const item = ref as Record<string, unknown>;
        return typeof item.kind === 'string'
            && typeof item.start === 'number' && Number.isFinite(item.start)
            && typeof item.end === 'number' && Number.isFinite(item.end);
    });
}

export function isReaderAnnotationRecord(value: unknown): value is ReaderAnnotationRecord {
    if (typeof value !== 'object' || value === null) return false;
    const candidate = value as Record<string, unknown>;
    const target = candidate.target as Record<string, unknown> | null;
    return typeof candidate.id === 'string' && candidate.id.trim().length > 0
        && typeof candidate.itemId === 'string' && candidate.itemId.trim().length > 0
        && !!target && typeof target.assistantMessageId === 'string' && target.assistantMessageId.trim().length > 0
        && (target.roundId === undefined || target.roundId === null || typeof target.roundId === 'string')
        && (target.userMessageId === undefined || target.userMessageId === null || typeof target.userMessageId === 'string')
        && isFiniteNumberOrNull(target.position ?? null)
        && typeof candidate.quoteText === 'string'
        && typeof candidate.sourceMarkdown === 'string'
        && typeof candidate.comment === 'string'
        && isSelector(candidate.selectors)
        && typeof candidate.createdAt === 'number' && Number.isFinite(candidate.createdAt)
        && typeof candidate.updatedAt === 'number' && Number.isFinite(candidate.updatedAt)
        && typeof candidate.revision === 'number' && Number.isInteger(candidate.revision) && candidate.revision > 0
        && (candidate.lastKnownAnchorState === 'anchored' || candidate.lastKnownAnchorState === 'unanchored');
}

export function decodeReaderAnnotationBundle(value: unknown, expectedDocument?: ReaderAnnotationDocument): ReaderAnnotationBundleV1 | null {
    if (typeof value !== 'object' || value === null) return null;
    const candidate = value as Record<string, unknown>;
    if (candidate.schemaVersion !== 1 || !isReaderAnnotationDocument(candidate.document) || !Array.isArray(candidate.annotations)) return null;
    const document = normalizeReaderAnnotationDocument(candidate.document);
    if (expectedDocument && readerAnnotationDocumentKey(document) !== readerAnnotationDocumentKey(expectedDocument)) return null;
    if (!candidate.annotations.every(isReaderAnnotationRecord)) return null;
    return { schemaVersion: 1, document, annotations: candidate.annotations };
}

export function createReaderAnnotationBundle(document: ReaderAnnotationDocument, annotations: ReaderAnnotationRecord[] = []): ReaderAnnotationBundleV1 {
    return {
        schemaVersion: 1,
        document: normalizeReaderAnnotationDocument(document),
        annotations: [...annotations],
    };
}
