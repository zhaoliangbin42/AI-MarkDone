import { readMarkDocumentTitle } from '../../../drivers/content/chatgpt/readMarkDocumentTitle';
import type { HighlightColor, HighlightRecord, HighlightTextFragment } from '../../../contracts/highlights';
import { readerAnnotationDocumentKey, type ReaderAnnotationDocument, type ReaderAnnotationTarget } from '../../../contracts/readerAnnotations';
import { highlightsClient } from '../../../drivers/shared/clients/highlightsClient';
import { fromReaderAnnotationRecord, type ReaderCommentRecord } from '../../../services/reader/commentSession';

export function highlightAnchor(record: HighlightRecord): ReaderCommentRecord {
    return { ...fromReaderAnnotationRecord({...record, id: `highlight:${record.id}`, comment: '', lastKnownAnchorState: 'anchored'}), highlightFragments: record.fragments };
}
export function createHighlightRecord(record: ReaderCommentRecord, target: ReaderAnnotationTarget, color: HighlightColor, fragments?: HighlightTextFragment[]): HighlightRecord {
    return {id: record.id, itemId: record.itemId, target, quoteText: record.quoteText, sourceMarkdown: record.sourceMarkdown, selectors: record.selectors, color, createdAt: record.createdAt, updatedAt: record.updatedAt, revision: 1, ...(fragments ? { fragments } : {})};
}

/** A view projection only. Background storage remains the single durable owner. */
export class HighlightSession {
    private document: ReaderAnnotationDocument | null = null;
    private records: HighlightRecord[] = [];
    private generation = 0;
    private unsubscribe: (() => void) | null = null;
    constructor(private readonly changed: () => void, private readonly failed: (error: unknown) => void) {}
    list(): readonly HighlightRecord[] { return this.records; }
    bind(document: ReaderAnnotationDocument | null): void {
        if (this.document && document && readerAnnotationDocumentKey(this.document) === readerAnnotationDocumentKey(document)) { this.document = document; return; }
        this.unsubscribe?.(); this.unsubscribe = null; this.generation++;
        this.document = document; this.records = []; this.changed();
        if (!document) return;
        this.unsubscribe = highlightsClient.subscribe(() => void this.reload(), document);
        void this.reload();
    }
    async reload(): Promise<void> {
        const document = this.document; const generation = ++this.generation;
        if (!document) return;
        try {
            const entries = await highlightsClient.list(document);
            if (generation !== this.generation) return;
            this.records = entries.map(entry => entry.highlight).sort((a, b) => a.updatedAt - b.updatedAt || a.id.localeCompare(b.id));
            this.changed();
        } catch (error) { if (generation === this.generation) this.failed(error); }
    }
    async create(record: HighlightRecord): Promise<void> {
        const document = this.document;
        if (!document) throw new Error('Highlight source unavailable');
        const entry = await highlightsClient.create(readMarkDocumentTitle(document), record);
        if (!this.document || readerAnnotationDocumentKey(document) !== readerAnnotationDocumentKey(this.document)) return;
        this.generation++;
        this.records = [...this.records.filter(h => h.id !== entry.highlight.id), entry.highlight].sort((a, b) => a.updatedAt - b.updatedAt || a.id.localeCompare(b.id));
        this.changed();
    }
    async updateColor(record: HighlightRecord, color: HighlightColor): Promise<void> {
        const document = this.document;
        if (!document) throw new Error('Highlight source unavailable');
        const entry = await highlightsClient.update(document, { ...record, color }, record.revision);
        if (!this.document || readerAnnotationDocumentKey(document) !== readerAnnotationDocumentKey(this.document)) return;
        this.generation++;
        this.records = this.records.map(current => current.id === entry.highlight.id ? entry.highlight : current);
        this.changed();
    }
    async remove(record: HighlightRecord): Promise<void> {
        const document = this.document;
        if (!document) throw new Error('Highlight source unavailable');
        await highlightsClient.remove(document, record.id, record.revision);
        if (!this.document || readerAnnotationDocumentKey(document) !== readerAnnotationDocumentKey(this.document)) return;
        this.generation++;
        this.records = this.records.filter(current => current.id !== record.id);
        this.changed();
    }
    dispose(): void { this.unsubscribe?.(); this.unsubscribe = null; this.generation++; this.document = null; this.records = []; }
}
