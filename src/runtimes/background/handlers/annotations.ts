import { PROTOCOL_VERSION, type ExtRequest, type ExtResponse, type ProtocolErrorCode, type ReaderAnnotationNavigatePayload } from '../../../contracts/protocol';
import {
    createReaderAnnotationBundle,
    decodeReaderAnnotationBundle,
    isReaderAnnotationDocument,
    readerAnnotationStorageKey,
    type ReaderAnnotationBundleV1,
    type ReaderAnnotationListEntry,
} from '../../../contracts/readerAnnotations';
import { STORAGE_KEYS } from '../../../contracts/storage';
import { backgroundStorageQueue } from '../../../drivers/background/storage/asyncQueue';
import { localStoragePort } from '../../../drivers/background/storage/localStoragePort';
import { browser, browserCompat } from '../../../drivers/shared/browser';
import { isChatGPTPageUrl } from '../../../contracts/chatgptHosts';

type HandlerResult = { response: ExtResponse };
const pendingNavigationByTab = new Map<number, ReaderAnnotationNavigatePayload>();
const pendingNavigationKeyPrefix = 'aimd:reader_annotation_navigation:v1:';

function ok(id: string, type: ExtRequest['type'], data?: unknown): ExtResponse {
    return { v: PROTOCOL_VERSION, id, ok: true, type, data };
}

function err(id: string, type: ExtRequest['type'], code: ProtocolErrorCode, message: string): ExtResponse {
    return { v: PROTOCOL_VERSION, id, ok: false, type, error: { code, message } };
}

function isAnnotationRequest(request: ExtRequest): request is Extract<ExtRequest, { type: `annotations:${string}` }> {
    return request.type.startsWith('annotations:');
}

function storageErrorCode(error: unknown): ProtocolErrorCode {
    const message = error instanceof Error ? error.message : String(error ?? '');
    return /quota|exceed|maximum/i.test(message) ? 'QUOTA_EXCEEDED' : 'INTERNAL_ERROR';
}

async function readBundle(document: Parameters<typeof readerAnnotationStorageKey>[0]): Promise<ReaderAnnotationBundleV1> {
    const key = readerAnnotationStorageKey(document);
    const raw = await localStoragePort.get(key);
    return decodeReaderAnnotationBundle(raw[key], document) ?? createReaderAnnotationBundle(document);
}

async function listEntries(document?: Parameters<typeof readerAnnotationStorageKey>[0]): Promise<ReaderAnnotationListEntry[]> {
    const raw = document
        ? await localStoragePort.get(readerAnnotationStorageKey(document))
        : await localStoragePort.get(null);
    const entries: ReaderAnnotationListEntry[] = [];
    for (const [key, value] of Object.entries(raw)) {
        if (!key.startsWith(STORAGE_KEYS.readerAnnotationsDocumentPrefixV1)) continue;
        const bundle = decodeReaderAnnotationBundle(value, document);
        if (!bundle) continue;
        for (const annotation of bundle.annotations) entries.push({ document: bundle.document, annotation });
    }
    return entries;
}

function getPendingArea(): any | null {
    return (browser as any)?.storage?.session ?? null;
}

function intentKey(tabId: number): string {
    return `${pendingNavigationKeyPrefix}${tabId}`;
}

function conversationIdFromUrl(url: string): string | null {
    if (!isChatGPTPageUrl(url)) return null;
    try {
        const path = new URL(url).pathname;
        return path.match(/(?:^|\/)(?:c|conversation)\/([^/?#]+)/i)?.[1] ?? null;
    } catch {
        return null;
    }
}

async function createTab(url: string): Promise<number | null> {
    const tabs = browserCompat.tabs as any;
    if (!tabs?.create) return null;
    return new Promise<number | null>((resolve, reject) => {
        let settled = false;
        const finish = (value: number | null, error?: unknown) => {
            if (settled) return;
            settled = true;
            if (error) reject(error);
            else resolve(value);
        };
        try {
            const result = tabs.create({ url }, (tab: { id?: number }) => finish(typeof tab?.id === 'number' ? tab.id : null));
            if (result && typeof result.then === 'function') {
                result.then((tab: { id?: number }) => finish(typeof tab?.id === 'number' ? tab.id : null)).catch((error: unknown) => finish(null, error));
            } else if (result && typeof result.id === 'number') {
                finish(result.id);
            }
        } catch (error) {
            finish(null, error);
        }
    });
}

async function savePendingIntent(tabId: number, payload: ReaderAnnotationNavigatePayload): Promise<void> {
    pendingNavigationByTab.set(tabId, payload);
    const area = getPendingArea();
    if (area?.set) await area.set({ [intentKey(tabId)]: payload });
}

export async function consumeReaderAnnotationNavigationIntent(tabId: number, url: string): Promise<ReaderAnnotationNavigatePayload | null> {
    let payload = pendingNavigationByTab.get(tabId) ?? null;
    pendingNavigationByTab.delete(tabId);
    const area = getPendingArea();
    if (!payload && area?.get) {
        const raw = await area.get(intentKey(tabId));
        payload = raw?.[intentKey(tabId)] ?? null;
    }
    if (area?.remove) await area.remove(intentKey(tabId));
    if (!payload || typeof payload !== 'object' || !payload.document || payload.document.platform !== 'chatgpt') return null;
    return conversationIdFromUrl(url) === payload.document.conversationId ? payload : null;
}

export async function handleReaderAnnotationRequest(request: ExtRequest): Promise<HandlerResult | null> {
    if (!isAnnotationRequest(request)) return null;

    switch (request.type) {
        case 'annotations:list': {
            const entries = await listEntries(request.payload?.document);
            return { response: ok(request.id, request.type, { entries }) };
        }
        case 'annotations:create': {
            return backgroundStorageQueue.enqueue(async () => {
                const { document, annotation } = request.payload;
                if (!isReaderAnnotationDocument(document)) {
                    return { response: err(request.id, request.type, 'INVALID_REQUEST', 'A verified ChatGPT document is required') };
                }
                const bundle = await readBundle(document);
                if (bundle.annotations.some((entry) => entry.id === annotation.id)) {
                    return { response: err(request.id, request.type, 'CONFLICT', 'Annotation already exists') };
                }
                const canonical = {
                    ...annotation,
                    revision: 1,
                    createdAt: Number.isFinite(annotation.createdAt) ? annotation.createdAt : Date.now(),
                    updatedAt: Date.now(),
                };
                const next = { ...bundle, annotations: [...bundle.annotations, canonical] };
                try {
                    await localStoragePort.set({ [readerAnnotationStorageKey(document)]: next });
                } catch (error) {
                    return { response: err(request.id, request.type, storageErrorCode(error), 'Could not save annotation') };
                }
                return { response: ok(request.id, request.type, { annotation: canonical, document: next.document }) };
            });
        }
        case 'annotations:update': {
            return backgroundStorageQueue.enqueue(async () => {
                const { document, annotation, expectedRevision } = request.payload;
                const bundle = await readBundle(document);
                const index = bundle.annotations.findIndex((entry) => entry.id === annotation.id);
                if (index < 0) return { response: err(request.id, request.type, 'NOT_FOUND', 'Annotation not found') };
                const current = bundle.annotations[index];
                if (current.revision !== expectedRevision) {
                    return { response: err(request.id, request.type, 'CONFLICT', 'Annotation changed; reload it before saving') };
                }
                const canonical = {
                    ...annotation,
                    revision: expectedRevision + 1,
                    createdAt: current.createdAt,
                    updatedAt: Date.now(),
                };
                const annotations = bundle.annotations.map((entry, itemIndex) => itemIndex === index ? canonical : entry);
                try {
                    await localStoragePort.set({ [readerAnnotationStorageKey(document)]: { ...bundle, annotations } });
                } catch (error) {
                    return { response: err(request.id, request.type, storageErrorCode(error), 'Could not save annotation') };
                }
                return { response: ok(request.id, request.type, { annotation: canonical, document: bundle.document }) };
            });
        }
        case 'annotations:remove': {
            return backgroundStorageQueue.enqueue(async () => {
                const { document, annotationId, expectedRevision } = request.payload;
                const bundle = await readBundle(document);
                const current = bundle.annotations.find((entry) => entry.id === annotationId);
                if (!current) return { response: err(request.id, request.type, 'NOT_FOUND', 'Annotation not found') };
                if (expectedRevision !== undefined && current.revision !== expectedRevision) {
                    return { response: err(request.id, request.type, 'CONFLICT', 'Annotation changed; reload it before deleting') };
                }
                const annotations = bundle.annotations.filter((entry) => entry.id !== annotationId);
                try {
                    if (annotations.length > 0) {
                        await localStoragePort.set({ [readerAnnotationStorageKey(document)]: { ...bundle, annotations } });
                    } else {
                        await localStoragePort.remove(readerAnnotationStorageKey(document));
                    }
                } catch (error) {
                    return { response: err(request.id, request.type, storageErrorCode(error), 'Could not delete annotation') };
                }
                return { response: ok(request.id, request.type, { deleted: true, annotationId }) };
            });
        }
        case 'annotations:navigate': {
            const { document, annotationId } = request.payload;
            const lastKnownUrl = typeof document.lastKnownUrl === 'string' && isChatGPTPageUrl(document.lastKnownUrl)
                && conversationIdFromUrl(document.lastKnownUrl) === document.conversationId
                ? document.lastKnownUrl
                : `https://chatgpt.com/c/${encodeURIComponent(document.conversationId)}`;
            try {
                const tabId = await createTab(lastKnownUrl);
                if (tabId === null) return { response: err(request.id, request.type, 'SOURCE_UNAVAILABLE', 'Could not open the conversation tab') };
                await savePendingIntent(tabId, { document, annotationId });
                return { response: ok(request.id, request.type, { tabId }) };
            } catch (error) {
                return { response: err(request.id, request.type, 'SOURCE_UNAVAILABLE', error instanceof Error ? error.message : 'Could not open the conversation tab') };
            }
        }
        case 'annotations:focus':
            return null;
        default:
            return null;
    }
}
