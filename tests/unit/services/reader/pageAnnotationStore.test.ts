import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PageAnnotationStore } from '@/services/reader/pageAnnotationStore';
import type { ReaderAnnotationDocument, ReaderAnnotationTarget } from '@/contracts/readerAnnotations';
import type { ReaderCommentRecord } from '@/services/reader/commentSession';
import type { PageAnnotationClient } from '@/services/reader/pageAnnotationStore';

const document: ReaderAnnotationDocument = {
    platform: 'chatgpt',
    conversationId: 'conversation-1',
    title: 'Test conversation',
    lastKnownUrl: 'https://chatgpt.com/c/conversation-1',
};

const target: ReaderAnnotationTarget = {
    assistantMessageId: 'assistant-1',
    roundId: 'turn-1',
    userMessageId: 'user-1',
    position: 1,
};

function makeRecord(overrides?: Partial<ReaderCommentRecord>): ReaderCommentRecord {
    return {
        id: 'comment-1',
        itemId: 'chatgpt-assistant-1',
        quoteText: 'quoted text',
        sourceMarkdown: '**canonical** markdown',
        comment: 'note',
        selectors: {
            textQuote: { exact: 'quoted text', prefix: '', suffix: '' },
            textPosition: { start: 0, end: 11 },
            domRange: null,
            atomicRefs: [],
        },
        createdAt: 1,
        updatedAt: 1,
        ...overrides,
    };
}

function makeClient(overrides?: Partial<PageAnnotationClient>): PageAnnotationClient {
    return {
        list: vi.fn(async () => ({ ok: true as const, data: { entries: [] } })),
        create: vi.fn(async (_doc, annotation) => ({ ok: true as const, data: { annotation } })),
        update: vi.fn(async (_doc, annotation) => ({ ok: true as const, data: { annotation } })),
        remove: vi.fn(async () => ({ ok: true as const, data: { deleted: true } })),
        ...overrides,
    };
}

describe('PageAnnotationStore', () => {
    let client: PageAnnotationClient;

    beforeEach(() => {
        client = makeClient();
    });

    it('keeps runtime-only records when persistence is disabled', async () => {
        const store = new PageAnnotationStore(client);
        store.setPersistEnabled(false);
        await store.bindDocument(document);

        const record = makeRecord();
        const saved = await store.create(record, target);

        expect(saved.id).toBe(record.id);
        expect(client.create).not.toHaveBeenCalled();
        expect(store.listForConversation()).toHaveLength(1);
    });

    it('persists new records through the client when persistence is enabled', async () => {
        const store = new PageAnnotationStore(client);
        store.setPersistEnabled(true);
        await store.bindDocument(document);

        const record = makeRecord();
        const saved = await store.create(record, target);

        expect(client.create).toHaveBeenCalledTimes(1);
        expect(saved.revision).toBe(1);
        expect(store.listForConversation()).toHaveLength(1);
    });

    it('loads durable records on bind and merges with runtime records', async () => {
        const durable = makeRecord({ id: 'durable-1', revision: 2 });
        const loadedClient = makeClient({
            list: vi.fn(async () => ({
                ok: true as const,
                data: {
                    entries: [{
                        document,
                        annotation: {
                            id: durable.id,
                            itemId: durable.itemId,
                            target,
                            quoteText: durable.quoteText,
                            sourceMarkdown: durable.sourceMarkdown,
                            comment: durable.comment,
                            selectors: durable.selectors,
                            createdAt: durable.createdAt,
                            updatedAt: durable.updatedAt,
                            revision: 2,
                            lastKnownAnchorState: 'anchored',
                        },
                    }],
                },
            })),
        });

        const store = new PageAnnotationStore(loadedClient);
        store.setPersistEnabled(false);
        await store.bindDocument(document);

        const runtime = makeRecord({ id: 'runtime-1' });
        await store.create(runtime, target);

        const all = store.listForConversation();
        expect(all.map((record) => record.id).sort()).toEqual(['durable-1', 'runtime-1']);
    });

    it('propagates all-record load failures instead of reporting an empty collection', async () => {
        const failingClient = makeClient({
            list: vi.fn(async () => ({
                ok: false as const,
                errorCode: 'TRANSPORT_FAILED',
                message: 'storage unavailable',
                failure: { kind: 'transport' as const, code: 'TRANSPORT_FAILED', message: 'storage unavailable', delivery: 'unknown' as const },
            })),
        });
        const store = new PageAnnotationStore(failingClient);

        await expect(store.listAllRecords()).rejects.toThrow('storage unavailable');
    });

    it('updates durable records with a revision through the client', async () => {
        const store = new PageAnnotationStore(client);
        store.setPersistEnabled(true);
        await store.bindDocument(document);

        const durable = makeRecord({ revision: 3, document, target });
        await store.update({ ...durable, comment: 'updated' }, target);

        expect(client.update).toHaveBeenCalledTimes(1);
    });

    it('removes runtime-only records without calling the client', async () => {
        const store = new PageAnnotationStore(client);
        store.setPersistEnabled(false);
        await store.bindDocument(document);

        const runtime = makeRecord();
        await store.create(runtime, target);
        await store.remove(runtime);

        expect(client.remove).not.toHaveBeenCalled();
        expect(store.listForConversation()).toHaveLength(0);
    });

    it('removeMany reports records that fail to delete', async () => {
        const failingClient = makeClient({
            remove: vi.fn(async () => ({ ok: false as const, errorCode: 'CONFLICT', message: 'stale', failure: { kind: 'protocol', code: 'CONFLICT', message: 'stale' } })),
        });
        const store = new PageAnnotationStore(failingClient);
        store.setPersistEnabled(true);
        await store.bindDocument(document);

        const durable = makeRecord({ revision: 2, document, target });
        const failed = await store.removeMany([durable]);

        expect(failed).toHaveLength(1);
    });

    it('clears runtime-only records when the document identity changes', async () => {
        const store = new PageAnnotationStore(client);
        store.setPersistEnabled(false);
        await store.bindDocument(document);

        await store.create(makeRecord(), target);
        expect(store.listForConversation()).toHaveLength(1);

        await store.bindDocument({ ...document, conversationId: 'conversation-2' });
        expect(store.listForConversation()).toHaveLength(0);
    });
});
