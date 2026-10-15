import { isReaderAnnotationDocument, isReaderAnnotationRecord, normalizeReaderAnnotationDocument, readerAnnotationDocumentKey, type ReaderAnnotationDocument, type ReaderAnnotationRecord, type ReaderAnnotationSelectors } from './readerAnnotations';

export type HighlightColor = 'blue' | 'yellow' | 'red';
export const HIGHLIGHT_COLORS: readonly HighlightColor[] = ['blue', 'yellow', 'red'];
export const MAX_HIGHLIGHT_FRAGMENTS = 128;
export type HighlightTextFragment = { quoteText: string; selectors: ReaderAnnotationSelectors };
export type HighlightRecord = Omit<ReaderAnnotationRecord, 'comment' | 'lastKnownAnchorState'> & { color: HighlightColor; fragments?: HighlightTextFragment[] };
export type HighlightEntry = { document: ReaderAnnotationDocument; highlight: HighlightRecord };
export type HighlightBundle = { schemaVersion: 1; document: ReaderAnnotationDocument; highlights: HighlightRecord[] };
export const HIGHLIGHT_STORAGE_PREFIX = 'aimd:highlights:document:v1:';
export function highlightStorageKey(document: ReaderAnnotationDocument): string { return HIGHLIGHT_STORAGE_PREFIX + readerAnnotationDocumentKey(document); }
export function isHighlightRecord(value: unknown): value is HighlightRecord {
    if (!value || typeof value !== 'object') return false;
    const record = value as HighlightRecord;
    return HIGHLIGHT_COLORS.includes(record.color) && isReaderAnnotationRecord({ ...record, comment: '', lastKnownAnchorState: 'anchored' })
        && (record.fragments === undefined || (Array.isArray(record.fragments) && record.fragments.length > 0
            && record.fragments.length <= MAX_HIGHLIGHT_FRAGMENTS && record.fragments.every(fragment => fragment
                && typeof fragment.quoteText === 'string' && fragment.quoteText.trim().length > 0
                && isReaderAnnotationRecord({ ...record, quoteText: fragment.quoteText, selectors: fragment.selectors, comment: '', lastKnownAnchorState: 'anchored' }))));
}
export function isHighlightEntry(value: unknown): value is HighlightEntry {
    const entry = value as HighlightEntry | null;
    return !!entry && isReaderAnnotationDocument(entry.document) && isHighlightRecord(entry.highlight);
}
export function decodeHighlightBundle(value: unknown, document?: ReaderAnnotationDocument): HighlightBundle | null {
    const bundle = value as HighlightBundle | null;
    if (!bundle || bundle.schemaVersion !== 1 || !isReaderAnnotationDocument(bundle.document) || !Array.isArray(bundle.highlights) || !bundle.highlights.every(isHighlightRecord)) return null;
    if (document && readerAnnotationDocumentKey(document) !== readerAnnotationDocumentKey(bundle.document)) return null;
    return { ...bundle, document: normalizeReaderAnnotationDocument(bundle.document) };
}
/** DOM paths differ between the page and Reader, so equality uses text and message identity. */
export function sameHighlightSelection(a: HighlightRecord, b: HighlightRecord): boolean {
    return a.target.assistantMessageId === b.target.assistantMessageId
        && sameTextSelector(a.selectors, b.selectors)
        && (a.fragments?.length ?? 0) === (b.fragments?.length ?? 0)
        && (a.fragments ?? []).every((fragment, index) => fragment.quoteText === b.fragments![index]!.quoteText
            && sameTextSelector(fragment.selectors, b.fragments![index]!.selectors));
}
function sameTextSelector(a: ReaderAnnotationSelectors, b: ReaderAnnotationSelectors): boolean {
    return a.textQuote.exact === b.textQuote.exact && a.textQuote.prefix === b.textQuote.prefix
        && a.textQuote.suffix === b.textQuote.suffix && a.textPosition.start === b.textPosition.start
        && a.textPosition.end === b.textPosition.end;
}
