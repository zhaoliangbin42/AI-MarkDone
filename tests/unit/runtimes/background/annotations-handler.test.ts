import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createRequestId, PROTOCOL_VERSION, type ExtRequest } from '@/contracts/protocol';
import { readerAnnotationStorageKey, type ReaderAnnotationDocument, type ReaderAnnotationRecord } from '@/contracts/readerAnnotations';
import { highlightStorageKey } from '@/contracts/highlights';

function createArea(store: Record<string, unknown>) {
    return {
        get: vi.fn(async (keys?: null | string | string[]) => {
            if (keys === null || keys === undefined) return { ...store };
            const list = Array.isArray(keys) ? keys : [keys];
            const result: Record<string, unknown> = {};
            for (const key of list) if (Object.prototype.hasOwnProperty.call(store, key)) result[key] = store[key];
            return result;
        }),
        set: vi.fn(async (patch: Record<string, unknown>) => Object.assign(store, patch)),
        remove: vi.fn(async (keys: string | string[]) => {
            for (const key of (Array.isArray(keys) ? keys : [keys])) delete store[key];
        }),
    };
}

const document: ReaderAnnotationDocument = { platform: 'chatgpt', conversationId: 'conv-1' };
const annotation: ReaderAnnotationRecord = {
    id: 'annotation-1',
    itemId: 'item-1',
    target: { assistantMessageId: 'assistant-1', roundId: 'round-1', position: 1 },
    quoteText: 'Quote',
    sourceMarkdown: 'Quote',
    comment: 'Comment',
    selectors: {
        textQuote: { exact: 'Quote', prefix: '', suffix: '' },
        textPosition: { start: 0, end: 5 },
        domRange: null,
        atomicRefs: [],
    },
    createdAt: 100,
    updatedAt: 100,
    revision: 1,
    lastKnownAnchorState: 'anchored',
};

function req<T extends ExtRequest['type']>(type: T, payload?: unknown): ExtRequest {
    return { v: PROTOCOL_VERSION, id: createRequestId(), type, ...(payload === undefined ? {} : { payload }) } as ExtRequest;
}

describe('reader annotation background handler', () => {
    beforeEach(() => {
        vi.resetModules();
        vi.unstubAllGlobals();
    });

    it.each(['annotation', 'highlight'])('opens the exact stored reply and retains its %s identity until content focus', async (kind) => {
        const storedDocument = { ...document, conversationId: 'conv-12345678', lastKnownUrl: 'https://chatgpt.com/g/project-id/c/conv-12345678?branch=one&message=old&messageId=old&historySearchQuery=quote&selectedTextQuery=selection&selectedTextOccurrence=2#settings' };
        const navigationId = kind === 'annotation' ? annotation.id : 'highlight:highlight-1';
        const store = kind === 'annotation'
            ? { [readerAnnotationStorageKey(storedDocument)]: { schemaVersion: 1, document: storedDocument, annotations: [annotation] } }
            : { [highlightStorageKey(storedDocument)]: { schemaVersion: 1, document: storedDocument, highlights: [{ ...annotation, id: 'highlight-1', color: 'blue' }] } };
        const tabs = { create: vi.fn((_options, callback) => callback({ id: 77 })) };
        vi.stubGlobal('browser', { runtime: { getManifest: () => ({ manifest_version: 3 }) }, tabs, storage: { local: createArea(store), session: createArea({}) } });
        const { handleReaderAnnotationRequest: handle, consumeReaderAnnotationNavigationIntent: consume } = await import('@/runtimes/background/handlers/annotations');
        expect((await handle(req('annotations:navigate', { document: storedDocument, annotationId: navigationId })))?.response.ok).toBe(true);
        expect(tabs.create).toHaveBeenCalledWith({ url: 'https://chatgpt.com/g/project-id/c/conv-12345678?branch=one&messageId=assistant-1' }, expect.any(Function));
        expect(await consume(77, 'https://chatgpt.com/g/project-id/c/conv-12345678')).toMatchObject({ annotationId: navigationId, assistantMessageId: 'assistant-1' });
        expect(store[Object.keys(store)[0]]).toEqual(kind === 'annotation'
            ? { schemaVersion: 1, document: storedDocument, annotations: [annotation] }
            : { schemaVersion: 1, document: storedDocument, highlights: [{ ...annotation, id: 'highlight-1', color: 'blue' }] });
    });

    it('canonicalizes a legacy stored source URL when opening a reliable message', async () => {
        const storedDocument = { ...document, conversationId: 'conv-12345678', lastKnownUrl: 'https://chat.openai.com/c/conv-12345678?model=auto#latest' };
        const store = { [readerAnnotationStorageKey(storedDocument)]: { schemaVersion: 1, document: storedDocument, annotations: [annotation] } };
        const tabs = { create: vi.fn((_options, callback) => callback({ id: 77 })) };
        vi.stubGlobal('browser', { runtime: { getManifest: () => ({ manifest_version: 3 }) }, tabs, storage: { local: createArea(store) } });
        const { handleReaderAnnotationRequest: handle } = await import('@/runtimes/background/handlers/annotations');
        expect((await handle(req('annotations:navigate', { document: storedDocument, annotationId: annotation.id })))?.response.ok).toBe(true);
        expect(tabs.create).toHaveBeenCalledWith({ url: 'https://chatgpt.com/c/conv-12345678?model=auto&messageId=assistant-1' }, expect.any(Function));
    });

    it.each([undefined, 'fallback-turn-0'])('opens the source normally without a reliable stored message ID: %s', async (assistantMessageId) => {
        const storedDocument = { ...document, conversationId: 'conv-12345678', lastKnownUrl: 'https://chatgpt.com/c/conv-12345678?branch=one#latest' };
        const store = assistantMessageId
            ? { [readerAnnotationStorageKey(storedDocument)]: { schemaVersion: 1, document: storedDocument, annotations: [{ ...annotation, target: { ...annotation.target, assistantMessageId } }] } }
            : {};
        const tabs = { create: vi.fn((_options, callback) => callback({ id: 77 })) };
        vi.stubGlobal('browser', { runtime: { getManifest: () => ({ manifest_version: 3 }) }, tabs, storage: { local: createArea(store) } });
        const { handleReaderAnnotationRequest: handle } = await import('@/runtimes/background/handlers/annotations');
        expect((await handle(req('annotations:navigate', { document: storedDocument, annotationId: annotation.id })))?.response.ok).toBe(true);
        expect(tabs.create).toHaveBeenCalledWith({ url: 'https://chatgpt.com/c/conv-12345678?branch=one' }, expect.any(Function));
    });

    it('does not open a credential-bearing stored source URL', async () => {
        const storedDocument = { ...document, conversationId: 'conv-12345678', lastKnownUrl: 'https://user:password@chatgpt.com/c/conv-12345678' };
        const store = { [readerAnnotationStorageKey(storedDocument)]: { schemaVersion: 1, document: storedDocument, annotations: [annotation] } };
        const tabs = { create: vi.fn((_options, callback) => callback({ id: 77 })) };
        vi.stubGlobal('browser', { runtime: { getManifest: () => ({ manifest_version: 3 }) }, tabs, storage: { local: createArea(store) } });
        const { handleReaderAnnotationRequest: handle } = await import('@/runtimes/background/handlers/annotations');
        expect((await handle(req('annotations:navigate', { document: storedDocument, annotationId: annotation.id })))?.response.ok).toBe(true);
        expect(tabs.create).toHaveBeenCalledWith({ url: 'https://chatgpt.com/c/conv-12345678?messageId=assistant-1' }, expect.any(Function));
    });

    it('fills a missing stored conversation title on save and preserves it on later untitled saves', async () => {
        const store: Record<string, unknown> = {};
        vi.stubGlobal('browser', { runtime: { getManifest: () => ({ manifest_version: 3 }) }, storage: { local: createArea(store) } });
        const { handleReaderAnnotationRequest: handle } = await import('@/runtimes/background/handlers/annotations');
        await handle(req('annotations:create', { document, annotation }));
        await handle(req('annotations:create', { document: { ...document, title: '研究笔记' }, annotation: { ...annotation, id: 'second' } }));
        expect(store[readerAnnotationStorageKey(document)]).toMatchObject({ document: { title: '研究笔记' } });
        await handle(req('annotations:update', { document: { ...document, title: null }, annotation, expectedRevision: 1 }));
        expect((await handle(req('annotations:list')))?.response).toMatchObject({ ok: true, data: { entries: expect.arrayContaining([expect.objectContaining({ document: expect.objectContaining({ title: '研究笔记' }) })]) } });
    });

    it('isolates bundles, supports CRUD, and detects revision conflicts', async () => {
        const store: Record<string, unknown> = {};
        const local = createArea(store);
        vi.stubGlobal('browser', {
            runtime: { getManifest: () => ({ manifest_version: 3 }) },
            storage: { local },
        });
        const { handleReaderAnnotationRequest } = await import('../../../../src/runtimes/background/handlers/annotations');

        const created = await handleReaderAnnotationRequest(req('annotations:create', { document, annotation }));
        expect(created?.response.ok).toBe(true);
        expect(store[readerAnnotationStorageKey(document)]).toMatchObject({ schemaVersion: 1 });

        const listed = await handleReaderAnnotationRequest(req('annotations:list'));
        expect(listed?.response).toMatchObject({ ok: true, data: { entries: [{ document, annotation: expect.objectContaining({ revision: 1 }) }] } });

        const update = await handleReaderAnnotationRequest(req('annotations:update', {
            document,
            annotation: { ...annotation, comment: 'Updated' },
            expectedRevision: 1,
        }));
        expect(update?.response).toMatchObject({ ok: true, data: { annotation: expect.objectContaining({ comment: 'Updated', revision: 2 }) } });

        const conflict = await handleReaderAnnotationRequest(req('annotations:update', {
            document,
            annotation: { ...annotation, comment: 'Stale' },
            expectedRevision: 1,
        }));
        expect(conflict?.response).toMatchObject({ ok: false, error: { code: 'CONFLICT' } });

        const removed = await handleReaderAnnotationRequest(req('annotations:remove', {
            document,
            annotationId: annotation.id,
            expectedRevision: 2,
        }));
        expect(removed?.response).toMatchObject({ ok: true, data: { deleted: true } });
        expect(store[readerAnnotationStorageKey(document)]).toBeUndefined();
    });

    it('skips a corrupt bundle while returning healthy conversations', async () => {
        const store: Record<string, unknown> = {
            [readerAnnotationStorageKey(document)]: { schemaVersion: 1, document, annotations: [{ broken: true }] },
            'aimd:reader_annotations:document:chatgpt:conversation:healthy': {
                schemaVersion: 1,
                document: { platform: 'chatgpt', conversationId: 'healthy' },
                annotations: [{ ...annotation, target: { ...annotation.target }, id: 'healthy-annotation' }],
            },
        };
        const local = createArea(store);
        vi.stubGlobal('browser', {
            runtime: { getManifest: () => ({ manifest_version: 3 }) },
            storage: { local },
        });
        const { handleReaderAnnotationRequest } = await import('../../../../src/runtimes/background/handlers/annotations');
        const listed = await handleReaderAnnotationRequest(req('annotations:list'));
        expect(listed?.response).toMatchObject({ ok: true, data: { entries: [{ document: { conversationId: 'healthy' } }] } });
    });

    it('opens an exact conversation URL and consumes a one-time focus intent only after identity verification', async () => {
        const store: Record<string, unknown> = {};
        const local = createArea(store);
        const tabs = {
            create: vi.fn((_details: { url: string }, callback?: (tab: { id: number }) => void) => callback?.({ id: 77 })),
        };
        vi.stubGlobal('browser', {
            runtime: { getManifest: () => ({ manifest_version: 3 }) },
            storage: { local },
            tabs,
        });
        const { consumeReaderAnnotationNavigationIntent, handleReaderAnnotationRequest } = await import('../../../../src/runtimes/background/handlers/annotations');
        const navigated = await handleReaderAnnotationRequest(req('annotations:navigate', {
            document: { ...document, lastKnownUrl: 'https://evil.chatgpt.com/c/conv-1' },
            annotationId: annotation.id,
        }));
        expect(navigated?.response).toMatchObject({ ok: true, data: { tabId: 77 } });
        expect(tabs.create).toHaveBeenCalledWith(expect.objectContaining({ url: 'https://chatgpt.com/c/conv-1' }), expect.any(Function));
        await expect(consumeReaderAnnotationNavigationIntent(77, 'https://chatgpt.com/c/other')).resolves.toBeNull();

        const navigatedAgain = await handleReaderAnnotationRequest(req('annotations:navigate', {
            document,
            annotationId: annotation.id,
        }));
        expect(navigatedAgain?.response.ok).toBe(true);
        await expect(consumeReaderAnnotationNavigationIntent(77, 'https://chatgpt.com/c/conv-1?branch=1#reader')).resolves.toMatchObject({ annotationId: annotation.id });
        await expect(consumeReaderAnnotationNavigationIntent(77, 'https://chatgpt.com/c/conv-1')).resolves.toBeNull();
    });

    it('keeps the opened conversation successful when optional focus persistence fails', async () => {
        const session = createArea({});
        session.set.mockRejectedValueOnce(new Error('Session unavailable'));
        const tabs = { create: vi.fn((_details: { url: string }, callback?: (tab: { id: number }) => void) => callback?.({ id: 88 })) };
        vi.stubGlobal('browser', {
            runtime: { getManifest: () => ({ manifest_version: 3 }) },
            storage: { local: createArea({}), session }, tabs,
        });
        const { handleReaderAnnotationRequest } = await import('@/runtimes/background/handlers/annotations');
        const result = await handleReaderAnnotationRequest(req('annotations:navigate', { document, annotationId: annotation.id }));
        expect(result?.response).toMatchObject({ ok: true, data: { tabId: 88 } });
        expect(tabs.create).toHaveBeenCalledTimes(1);
    });
});
