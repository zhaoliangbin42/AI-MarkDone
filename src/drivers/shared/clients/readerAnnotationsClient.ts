import { createRequestId, PROTOCOL_VERSION, type ProtocolErrorCode } from '../../../contracts/protocol';
import type {
    ReaderAnnotationDocument,
    ReaderAnnotationListEntry,
    ReaderAnnotationRecord,
} from '../../../contracts/readerAnnotations';
import type { ExtRequest } from '../../../contracts/protocol';
import { sendExtRequest } from '../rpc';
import { browser } from '../browser';
import { readerAnnotationStorageKey } from '../../../contracts/readerAnnotations';

export type ReaderAnnotationResult<T> =
    | { ok: true; data: T }
    | { ok: false; errorCode: ProtocolErrorCode; message: string };

function responseToResult<T>(response: any): ReaderAnnotationResult<T> {
    if (response?.ok) return { ok: true, data: response.data as T };
    return {
        ok: false,
        errorCode: (response?.error?.code as ProtocolErrorCode | undefined) ?? 'INTERNAL_ERROR',
        message: response?.error?.message || 'Annotation request failed',
    };
}

async function call<T extends ExtRequest['type']>(type: T, payload?: unknown): Promise<ReaderAnnotationResult<any>> {
    const request = {
        v: PROTOCOL_VERSION,
        id: createRequestId(),
        type,
        ...(payload === undefined ? {} : { payload }),
    } as ExtRequest;
    return responseToResult(await sendExtRequest(request));
}

export type ReaderAnnotationListResponse = { entries: ReaderAnnotationListEntry[] };
export type ReaderAnnotationMutationResponse = {
    annotation?: ReaderAnnotationRecord;
    document?: ReaderAnnotationDocument;
    deleted?: boolean;
    annotationId?: string;
};

export function subscribeReaderAnnotationChanges(
    document: ReaderAnnotationDocument,
    onChanged: () => void,
): () => void {
    const storage = (browser as any)?.storage;
    const events = storage?.onChanged;
    if (!events?.addListener) return () => undefined;
    const key = readerAnnotationStorageKey(document);
    const listener = (changes: Record<string, unknown>, areaName: string) => {
        if (areaName !== 'local' || !Object.prototype.hasOwnProperty.call(changes ?? {}, key)) return;
        onChanged();
    };
    events.addListener(listener);
    return () => events.removeListener?.(listener);
}

export const readerAnnotationsClient = {
    async list(document?: ReaderAnnotationDocument): Promise<ReaderAnnotationResult<ReaderAnnotationListResponse>> {
        return call('annotations:list', document ? { document } : undefined);
    },
    async create(document: ReaderAnnotationDocument, annotation: ReaderAnnotationRecord): Promise<ReaderAnnotationResult<ReaderAnnotationMutationResponse>> {
        return call('annotations:create', { document, annotation });
    },
    async update(document: ReaderAnnotationDocument, annotation: ReaderAnnotationRecord, expectedRevision: number): Promise<ReaderAnnotationResult<ReaderAnnotationMutationResponse>> {
        return call('annotations:update', { document, annotation, expectedRevision });
    },
    async remove(document: ReaderAnnotationDocument, annotationId: string, expectedRevision?: number): Promise<ReaderAnnotationResult<ReaderAnnotationMutationResponse>> {
        return call('annotations:remove', { document, annotationId, ...(expectedRevision === undefined ? {} : { expectedRevision }) });
    },
    async navigate(document: ReaderAnnotationDocument, annotationId: string): Promise<ReaderAnnotationResult<{ tabId: number }>> {
        return call('annotations:navigate', { document, annotationId });
    },
};
