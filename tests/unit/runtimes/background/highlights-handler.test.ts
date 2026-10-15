import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createRequestId, isExtRequest, PROTOCOL_VERSION, type ExtRequest } from '@/contracts/protocol';
import { highlightStorageKey, type HighlightRecord } from '@/contracts/highlights';
import type { ReaderAnnotationDocument } from '@/contracts/readerAnnotations';

const document: ReaderAnnotationDocument = {platform: 'chatgpt', conversationId: 'conv-1', lastKnownUrl: 'https://chatgpt.com/c/conv-1', title: 'Conversation'};
const highlight: HighlightRecord = {id: 'h1', itemId: 'item-1', target: {assistantMessageId: 'a1'}, quoteText: 'Quote', sourceMarkdown: 'Quote', selectors: {textQuote: {exact: 'Quote', prefix: '', suffix: ''}, textPosition: {start: 0, end: 5}, domRange: null, atomicRefs: []}, color: 'blue', createdAt: 1, updatedAt: 1, revision: 1};
const req = (type: ExtRequest['type'], payload?: unknown) => ({v: PROTOCOL_VERSION, id: createRequestId(), type, payload}) as ExtRequest;
let store: Record<string, unknown>;
let set: ReturnType<typeof vi.fn>;
beforeEach(() => {
    vi.resetModules();
    store = {'legacy-bookmarks': {title: 'Do not migrate'}, 'aimd:reader_annotations:document:old': {unchanged: true}};
    set = vi.fn(async (patch: Record<string, unknown>) => { Object.assign(store, structuredClone(patch)); });
    vi.stubGlobal('browser', {runtime: {getManifest: () => ({manifest_version: 3})}, storage: {local: {
        get: async (key: string | null) => structuredClone(key ? (key in store ? {[key]: store[key]} : {}) : store), set,
        remove: async (key: string) => { delete store[key]; },
    }}});
});
describe('independent highlights storage', () => {
    it('recolors the same selection after Chrome storage reorders object keys', async () => {
        const reorder = (value: any): any => Array.isArray(value) ? value.map(reorder)
            : value && typeof value === 'object'
                ? Object.fromEntries(Object.keys(value).sort().map(key => [key, reorder(value[key])])) : value;
        set.mockImplementation(async (patch: Record<string, unknown>) => { Object.assign(store, reorder(patch)); });
        const { handleHighlightRequest: handle } = await import('@/runtimes/background/handlers/highlights');
        await handle(req('highlights:create', { document, highlight }));
        expect((await handle(req('highlights:update', {
            document, highlight: { ...highlight, color: 'red' }, expectedRevision: 1,
        })))?.response).toMatchObject({ ok: true, data: { highlight: { id: 'h1', color: 'red', revision: 2 } } });
    });
    it('fills titles on identical-color saves without revising the mark and preserves them on untitled recolors', async () => {
        const { handleHighlightRequest: handle } = await import('@/runtimes/background/handlers/highlights');
        await handle(req('highlights:create', { document: { ...document, title: null }, highlight }));
        await handle(req('highlights:create', { document, highlight }));
        expect(store[highlightStorageKey(document)]).toMatchObject({ document: { title: 'Conversation' }, highlights: [{ revision: 1 }] });
        await handle(req('highlights:update', { document: { ...document, title: null }, highlight: { ...highlight, color: 'red' }, expectedRevision: 1 }));
        expect(store[highlightStorageKey(document)]).toMatchObject({ document: { title: 'Conversation' } });
    });
    it('creates, retries, recolors, detects conflicts and deletes without touching old data', async () => {
        const {handleHighlightRequest: handle} = await import('@/runtimes/background/handlers/highlights');
        const original = structuredClone(store);
        expect(isExtRequest(req('highlights:create', {document, highlight}))).toBe(true);
        expect((await handle(req('highlights:create', {document, highlight})))?.response).toMatchObject({ok: true, data: {highlight: {id:'h1', revision:1}}});
        await handle(req('highlights:create', {document, highlight: {...highlight, id:'retry'}}));
        expect(set).toHaveBeenCalledTimes(1);
        const recolored = await handle(req('highlights:create', {document, highlight:{...highlight, id:'new-id', color:'yellow'}}));
        expect(recolored?.response).toMatchObject({ok:true,data:{highlight:{id:'h1',color:'yellow',revision:2}}});
        expect((await handle(req('highlights:update',{document,highlight:{...highlight,color:'red'},expectedRevision:1})))?.response).toMatchObject({ok:false,error:{code:'CONFLICT'}});
        expect((await handle(req('highlights:remove',{document,highlightId:'h1',expectedRevision:1})))?.response).toMatchObject({ok:false,error:{code:'CONFLICT'}});
        expect((await handle(req('highlights:remove',{document,highlightId:'h1',expectedRevision:2})))?.response).toMatchObject({ok:true,data:{deleted:true,highlightId:'h1'}});
        expect(store).toEqual(original);
    });
    it('preserves overlapping records and missing rows are not reported as deleted', async () => {
        const {handleHighlightRequest: handle} = await import('@/runtimes/background/handlers/highlights');
        await handle(req('highlights:create',{document,highlight}));
        await handle(req('highlights:create',{document,highlight:{...highlight,id:'overlap',selectors:{...highlight.selectors,textPosition:{start:2,end:7}}}}));
        expect((await handle(req('highlights:list',{document})))?.response).toMatchObject({ok:true,data:{entries:expect.any(Array)}});
        expect((store[highlightStorageKey(document)] as {highlights:unknown[]}).highlights).toHaveLength(2);
        expect((await handle(req('highlights:remove',{document,highlightId:'missing',expectedRevision:1})))?.response).toMatchObject({ok:false,error:{code:'NOT_FOUND'}});
    });
    it('does not replace corrupt records or report a failed write as successful', async () => {
        const {handleHighlightRequest: handle} = await import('@/runtimes/background/handlers/highlights');
        set.mockRejectedValueOnce(new Error('Quota exceeded'));
        expect((await handle(req('highlights:create',{document,highlight})))?.response).toMatchObject({ok:false,error:{code:'QUOTA_EXCEEDED'}});
        expect(store[highlightStorageKey(document)]).toBeUndefined();
        store[highlightStorageKey(document)] = {schemaVersion:99};
        expect((await handle(req('highlights:list',{document})))?.response).toMatchObject({ok:false,error:{code:'SNAPSHOT_CORRUPTED'}});
        expect((await handle(req('highlights:create',{document,highlight})))?.response).toMatchObject({ok:false,error:{code:'SNAPSHOT_CORRUPTED'}});
        expect(set).toHaveBeenCalledTimes(1);
    });
    it('rejects invalid colors, identities, and update revisions at the protocol boundary', () => {
        expect(isExtRequest(req('highlights:create',{document,highlight:{...highlight,color:'green'}}))).toBe(false);
        expect(isExtRequest(req('highlights:create',{document:{...document,platform:'other'},highlight}))).toBe(false);
        expect(isExtRequest(req('highlights:update',{document,highlight,expectedRevision:0}))).toBe(false);
        expect(isExtRequest(req('highlights:create',{document,highlight:{...highlight,fragments:[]}}))).toBe(false);
        expect(isExtRequest(req('highlights:create',{document,highlight:{...highlight,fragments:[{quoteText:'Quote',selectors:highlight.selectors}]}}))).toBe(true);
        expect(isExtRequest(req('highlights:create',{document,highlight:{...highlight,fragments:[{quoteText:'Quote',selectors:null}]}}))).toBe(false);
    });
    it('preserves fragment anchors through save, list and recolor, and rejects changing them', async () => {
        const { handleHighlightRequest: handle } = await import('@/runtimes/background/handlers/highlights');
        const segmented = { ...highlight, fragments: [{ quoteText: 'Quote', selectors: highlight.selectors }] };
        await handle(req('highlights:create', { document, highlight: segmented }));
        const response = (await handle(req('highlights:list', { document })))?.response;
        expect(response).toMatchObject({ ok: true, data: { entries: [{ highlight: { fragments: segmented.fragments } }] } });
        expect((await handle(req('highlights:update', { document, highlight: { ...segmented, color: 'red' }, expectedRevision: 1 })))?.response)
            .toMatchObject({ ok: true, data: { highlight: { revision: 2, fragments: segmented.fragments } } });
        expect((await handle(req('highlights:update', { document, highlight: { ...segmented, fragments: undefined }, expectedRevision: 2 })))?.response)
            .toMatchObject({ ok: false, error: { code: 'INVALID_REQUEST' } });
    });
});
