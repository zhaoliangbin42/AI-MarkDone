import type {
    ReaderAnnotationDocument,
    ReaderAnnotationRecord,
    ReaderAnnotationTarget,
} from '../../contracts/readerAnnotations';
import { readerAnnotationDocumentKey } from '../../contracts/readerAnnotations';
import {
    readerAnnotationsClient,
    subscribeReaderAnnotationChanges,
    type ReaderAnnotationListResponse,
    type ReaderAnnotationMutationResponse,
    type ReaderAnnotationResult,
} from '../../drivers/shared/clients/readerAnnotationsClient';
import {
    fromReaderAnnotationRecord,
    sortReaderComments,
    toReaderAnnotationRecord,
    type ReaderCommentRecord,
} from './commentSession';
import type { ReaderCommentSortMode } from '../../core/settings/readerCommentExport';

export type PageAnnotationClient = {
    list: (document?: ReaderAnnotationDocument) => Promise<ReaderAnnotationResult<ReaderAnnotationListResponse>>;
    create: (document: ReaderAnnotationDocument, annotation: ReaderAnnotationRecord) => Promise<ReaderAnnotationResult<ReaderAnnotationMutationResponse>>;
    update: (document: ReaderAnnotationDocument, annotation: ReaderAnnotationRecord, expectedRevision: number) => Promise<ReaderAnnotationResult<ReaderAnnotationMutationResponse>>;
    remove: (document: ReaderAnnotationDocument, annotationId: string, expectedRevision?: number) => Promise<ReaderAnnotationResult<ReaderAnnotationMutationResponse>>;
};

export type PageAnnotationChangeSubscription = (document: ReaderAnnotationDocument, onChanged: () => void) => () => void;

/**
 * Page-scoped annotation collection mirroring the Reader's persistence model
 * (ADR-0006). Durable annotations are written by the background authority;
 * runtime-only annotations are kept in this controller's memory when
 * `persistAnnotations` is off. `create` honors the persistence toggle while
 * `update`/`remove` keep durable records durable even when the toggle is off.
 */
export class PageAnnotationStore {
    private document: ReaderAnnotationDocument | null = null;
    private persistEnabled = false;
    private durable = new Map<string, ReaderCommentRecord[]>();
    private runtime = new Map<string, ReaderCommentRecord[]>();
    private loadedDocumentKey: string | null = null;
    private unsubscribeChanges: (() => void) | null = null;
    private readonly listeners = new Set<() => void>();
    private readonly client: PageAnnotationClient;
    private readonly subscribeChanges: PageAnnotationChangeSubscription;

    constructor(
        client: PageAnnotationClient = readerAnnotationsClient,
        subscribeChanges: PageAnnotationChangeSubscription = subscribeReaderAnnotationChanges,
    ) {
        this.client = client;
        this.subscribeChanges = subscribeChanges;
    }

    setPersistEnabled(enabled: boolean): void {
        this.persistEnabled = enabled;
    }

    getDocument(): ReaderAnnotationDocument | null {
        return this.document;
    }

    async bindDocument(document: ReaderAnnotationDocument | null): Promise<void> {
        const nextKey = document ? readerAnnotationDocumentKey(document) : null;
        if (document && nextKey === this.loadedDocumentKey) return;
        this.document = document;
        this.loadedDocumentKey = nextKey;
        this.runtime.clear();
        this.durable.clear();
        this.unsubscribeChanges?.();
        this.unsubscribeChanges = null;
        if (document) {
            await this.loadDurable(document);
            this.unsubscribeChanges = this.subscribeChanges(document, () => {
                void this.loadDurable(document).then(() => this.emit());
            });
        }
        this.emit();
    }

    listForConversation(sortMode: ReaderCommentSortMode = 'position'): ReaderCommentRecord[] {
        const merged = new Map<string, ReaderCommentRecord>();
        for (const bucket of this.durable.values()) {
            for (const record of bucket) merged.set(record.id, record);
        }
        for (const bucket of this.runtime.values()) {
            for (const record of bucket) merged.set(record.id, record);
        }
        return sortReaderComments([...merged.values()], sortMode);
    }

    async listAllRecords(): Promise<ReaderCommentRecord[]> {
        const result = await this.client.list();
        if (!result.ok) throw new Error(result.message);
        return (result.data?.entries ?? []).map((entry) => fromReaderAnnotationRecord(entry.annotation, entry.document));
    }

    async create(record: ReaderCommentRecord, target: ReaderAnnotationTarget | null): Promise<ReaderCommentRecord> {
        if (!this.persistEnabled || !this.document || !target) {
            return this.saveRuntime(record);
        }
        const annotation = toReaderAnnotationRecord(record, target);
        const result = await this.client.create(this.document, annotation);
        if (!result.ok || !result.data?.annotation) {
            throw new Error(result.ok ? 'Annotation save returned no annotation' : result.message);
        }
        const saved = fromReaderAnnotationRecord(result.data.annotation, this.document);
        this.setDurable(saved);
        this.emit();
        return saved;
    }

    async update(record: ReaderCommentRecord, target: ReaderAnnotationTarget | null): Promise<ReaderCommentRecord> {
        if (!this.document || !target || record.revision === undefined) {
            return this.saveRuntime(record);
        }
        const annotation = toReaderAnnotationRecord(record, record.target ?? target);
        const result = await this.client.update(this.document, annotation, record.revision);
        if (!result.ok || !result.data?.annotation) {
            throw new Error(result.ok ? 'Annotation update returned no annotation' : result.message);
        }
        const saved = fromReaderAnnotationRecord(result.data.annotation, this.document);
        this.setDurable(saved);
        this.emit();
        return saved;
    }

    async remove(record: ReaderCommentRecord): Promise<void> {
        if (!this.document || record.revision === undefined) {
            this.removeRuntime(record);
            this.emit();
            return;
        }
        const result = await this.client.remove(this.document, record.id, record.revision);
        if (!result.ok) throw new Error(result.message);
        this.removeDurable(record);
        this.emit();
    }

    async removeMany(records: ReaderCommentRecord[]): Promise<ReaderCommentRecord[]> {
        const failed: ReaderCommentRecord[] = [];
        for (const record of records) {
            try {
                await this.remove(record);
            } catch {
                failed.push(record);
            }
        }
        return failed;
    }

    onChange(listener: () => void): () => void {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }

    dispose(): void {
        this.unsubscribeChanges?.();
        this.unsubscribeChanges = null;
        this.listeners.clear();
        this.durable.clear();
        this.runtime.clear();
        this.document = null;
        this.loadedDocumentKey = null;
    }

    private async loadDurable(document: ReaderAnnotationDocument): Promise<void> {
        const result = await this.client.list(document);
        this.durable.clear();
        if (!result.ok) return;
        for (const entry of result.data?.entries ?? []) {
            if (readerAnnotationDocumentKey(entry.document) !== readerAnnotationDocumentKey(document)) continue;
            const record = fromReaderAnnotationRecord(entry.annotation, entry.document);
            const bucket = this.durable.get(record.itemId) ?? [];
            bucket.push(record);
            this.durable.set(record.itemId, bucket);
        }
    }

    private setDurable(record: ReaderCommentRecord): void {
        const bucket = this.durable.get(record.itemId) ?? [];
        const index = bucket.findIndex((entry) => entry.id === record.id);
        if (index >= 0) bucket[index] = { ...record };
        else bucket.push({ ...record });
        this.durable.set(record.itemId, bucket);
    }

    private removeDurable(record: ReaderCommentRecord): void {
        const bucket = this.durable.get(record.itemId) ?? [];
        const next = bucket.filter((entry) => entry.id !== record.id);
        if (next.length > 0) this.durable.set(record.itemId, next);
        else this.durable.delete(record.itemId);
    }

    private saveRuntime(record: ReaderCommentRecord): ReaderCommentRecord {
        const next = { ...record };
        const bucket = this.runtime.get(next.itemId) ?? [];
        const index = bucket.findIndex((entry) => entry.id === next.id);
        if (index >= 0) bucket[index] = next;
        else bucket.push(next);
        this.runtime.set(next.itemId, bucket);
        this.emit();
        return next;
    }

    private removeRuntime(record: ReaderCommentRecord): void {
        const bucket = this.runtime.get(record.itemId) ?? [];
        const next = bucket.filter((entry) => entry.id !== record.id);
        if (next.length > 0) this.runtime.set(record.itemId, next);
        else this.runtime.delete(record.itemId);
    }

    private emit(): void {
        for (const listener of this.listeners) listener();
    }
}
