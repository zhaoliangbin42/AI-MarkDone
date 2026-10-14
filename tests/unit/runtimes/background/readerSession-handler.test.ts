import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PROTOCOL_VERSION, createRequestId, type ExtRequest, type ReaderSessionSnapshot } from '@/contracts/protocol';
import { richSvgBlock } from '../../../helpers/richContentFixtures';

const STORAGE_KEY = 'aimd:readerSessions:v1';

function snapshot(label: string): ReaderSessionSnapshot {
    return {
        items: [
            {
                id: `${label}-item`,
                userPrompt: `${label} prompt`,
                content: `${label} content`,
                meta: { platformId: 'chatgpt', position: 1, messageId: `${label}-message` },
            },
        ],
        startIndex: 0,
        sourceUrl: `https://chatgpt.com/c/${label}`,
        theme: 'light',
        createdAt: 1000,
        updatedAt: 1000,
    };
}

function request(type: ExtRequest['type'], payload?: unknown): ExtRequest {
    return {
        v: PROTOCOL_VERSION,
        id: createRequestId(),
        type,
        ...(payload === undefined ? {} : { payload }),
    } as ExtRequest;
}

describe('reader session background handler', () => {
    let storageData: Record<string, unknown>;
    let nextTabId: number;
    let tabs: {
        create: ReturnType<typeof vi.fn>;
        remove: ReturnType<typeof vi.fn>;
        sendMessage: ReturnType<typeof vi.fn>;
        update: ReturnType<typeof vi.fn>;
    };

    async function loadHandler(options: { withSessionStorage?: boolean; withLocalStorage?: boolean } = {}) {
        const { withSessionStorage = true, withLocalStorage = false } = options;
        vi.resetModules();
        storageData = {};
        nextTabId = 500;
        tabs = {
            create: vi.fn((_params: unknown, callback?: (tab: { id: number }) => void) => {
                const tab = { id: nextTabId++ };
                callback?.(tab);
            }),
            remove: vi.fn((_tabId: number, callback?: () => void) => {
                callback?.();
            }),
            sendMessage: vi.fn((_tabId: number, forwarded: ExtRequest, callback?: (response: unknown) => void) => {
                callback?.({
                    v: PROTOCOL_VERSION,
                    id: forwarded.id,
                    ok: true,
                    type: forwarded.type,
                    data: { routed: true },
                });
            }),
            update: vi.fn((_tabId: number, _params: unknown, callback?: (tab: { id: number }) => void) => {
                callback?.({ id: _tabId });
            }),
        };

        const storageArea = {
            get: vi.fn(async (key: string) => ({ [key]: storageData[key] })),
            set: vi.fn(async (patch: Record<string, unknown>) => {
                Object.assign(storageData, patch);
            }),
        };

        vi.stubGlobal('chrome', {
            runtime: {
                getURL: (path: string) => `chrome-extension://mock/${path}`,
                lastError: null,
            },
            tabs,
        });
        vi.stubGlobal('browser', {
            runtime: {
                getURL: (path: string) => `chrome-extension://mock/${path}`,
            },
            storage: {
                ...(withSessionStorage ? { session: storageArea } : {}),
                ...(withLocalStorage ? { local: storageArea } : {}),
            },
            tabs,
        });

        return await import('../../../../src/runtimes/background/handlers/readerSession');
    }

    beforeEach(() => {
        vi.unstubAllGlobals();
    });

    it('binds asset requests to the Reader sender and replaces any supplied source with its session item', async () => {
        const { handleReaderSessionRequest } = await loadHandler();
        const captured = snapshot('assets');
        captured.items[0]!.richBlocks = [richSvgBlock()];
        const create = await handleReaderSessionRequest(request('readerSession:create', { snapshot: captured }), { tab: { id: 101 } });
        const sessionId = (create!.response.data as { sessionId: string }).sessionId;
        const payload = { version: 1, sessionId, itemId: captured.items[0]!.id, leaseId: 'reader-lease', blockVersions: [{ blockId: 'block-1', visualDigest: 'visual-1' }], sourceItem: { id: 'forged', richBlocks: [] } };
        const denied = await handleReaderSessionRequest(request('readerSession:assets', payload), { tab: { id: 999 } });
        expect(denied?.response.ok).toBe(false);
        expect(tabs.sendMessage).not.toHaveBeenCalled();
        tabs.sendMessage.mockImplementation((_tabId, forwarded, callback) => callback({ v: PROTOCOL_VERSION, id: forwarded.id, type: forwarded.type, ok: true, data: { version: 1, leaseId: 'reader-lease', refs: [{ assetId: 'asset-1', blockId: 'block-1', mimeType: 'image/png', byteLength: 10, widthPx: 10, heightPx: 10, objectUrl: 'blob:chrome-extension://mock/asset-1' }] } }));
        const accepted = await handleReaderSessionRequest(request('readerSession:assets', payload), { tab: { id: 500 } });
        expect(accepted?.response.ok).toBe(true);
        expect(tabs.sendMessage.mock.calls[0]?.[1]?.payload.sourceItem).toEqual(captured.items[0]);
        expect(tabs.sendMessage.mock.calls[0]?.[1]?.payload.sourceUrl).toBe(captured.sourceUrl);
    });

    it.each(['missing', 'duplicate', 'over-budget', 'stale-digest'] as const)('does not forward %s asset content', async (fault) => {
        const { handleReaderSessionRequest } = await loadHandler();
        const captured = snapshot('invalid-assets');
        captured.items[0]!.richBlocks = [richSvgBlock()];
        if (fault === 'duplicate') captured.items.push({ ...captured.items[0]! });
        if (fault === 'over-budget') captured.items[0]!.richBlocks = Array.from({ length: 129 }, (_, index) => richSvgBlock({ id: `block-${index}` }));
        const create = await handleReaderSessionRequest(request('readerSession:create', { snapshot: captured }), { tab: { id: 101 } });
        if (fault === 'over-budget') {
            expect(create?.response.ok).toBe(false);
            expect(create?.response.error?.code).toBe('SOURCE_UNAVAILABLE');
            expect(tabs.sendMessage).not.toHaveBeenCalled();
            return;
        }
        const sessionId = (create!.response.data as { sessionId: string }).sessionId;
        const result = await handleReaderSessionRequest(request('readerSession:assets', { version: 1, sessionId, itemId: fault === 'missing' ? 'missing' : captured.items[0]!.id, blockVersions: [{ blockId: 'block-1', visualDigest: fault === 'stale-digest' ? 'obsolete' : 'visual-1' }] }), { tab: { id: 500 } });
        expect(result?.response.ok).toBe(false);
        expect(tabs.sendMessage).not.toHaveBeenCalled();
    });

    it('releases a rejected page-origin asset response instead of forwarding it to Reader', async () => {
        const { handleReaderSessionRequest } = await loadHandler();
        const captured = snapshot('page-origin-assets');
        captured.items[0]!.richBlocks = [richSvgBlock()];
        const create = await handleReaderSessionRequest(request('readerSession:create', { snapshot: captured }), { tab: { id: 101 } });
        const sessionId = (create!.response.data as { sessionId: string }).sessionId;
        tabs.sendMessage.mockImplementation((_tabId, forwarded, callback) => callback({ v: PROTOCOL_VERSION, id: forwarded.id, type: forwarded.type, ok: true, data: { version: 1, leaseId: 'reader-lease', refs: [{ assetId: 'asset-1', blockId: 'block-1', mimeType: 'image/png', byteLength: 10, widthPx: 10, heightPx: 10, objectUrl: 'blob:https://chatgpt.com/asset-1' }] } }));
        const result = await handleReaderSessionRequest(request('readerSession:assets', { version: 1, sessionId, itemId: captured.items[0]!.id, leaseId: 'reader-lease', blockVersions: [{ blockId: 'block-1', visualDigest: 'visual-1' }] }), { tab: { id: 500 } });
        expect(result?.response.ok).toBe(false);
        expect(tabs.sendMessage.mock.calls[1]?.[1]?.type).toBe('readerSession:releaseAssets');
    });

    it('releases a late successful asset response after its Reader session closed', async () => {
        const { handleReaderSessionRequest } = await loadHandler();
        const captured = snapshot('late-assets');
        captured.items[0]!.richBlocks = [richSvgBlock()];
        const create = await handleReaderSessionRequest(request('readerSession:create', { snapshot: captured }), { tab: { id: 101 } });
        const sessionId = (create!.response.data as { sessionId: string }).sessionId;
        let complete!: () => void;
        tabs.sendMessage.mockImplementation((_tabId, forwarded, callback) => {
            if (forwarded.type === 'readerSession:assets') {
                complete = () => callback({ v: PROTOCOL_VERSION, id: forwarded.id, type: forwarded.type, ok: true, data: { version: 1, leaseId: 'late-lease', refs: [{ assetId: 'asset', blockId: 'block-1', mimeType: 'image/png', byteLength: 5, widthPx: 10, heightPx: 10, objectUrl: 'blob:chrome-extension://mock/asset' }] } });
            } else callback({ v: PROTOCOL_VERSION, id: forwarded.id, type: forwarded.type, ok: true, data: {} });
        });
        const response = handleReaderSessionRequest(request('readerSession:assets', { version: 1, sessionId, itemId: captured.items[0]!.id, leaseId: 'late-lease', blockVersions: [{ blockId: 'block-1', visualDigest: 'visual-1' }] }), { tab: { id: 500 } });
        await vi.waitFor(() => expect(complete).toBeTypeOf('function'));
        await handleReaderSessionRequest(request('readerSession:close', { sessionId }), { tab: { id: 500 } });
        complete();
        expect((await response)?.response.ok).toBe(false);
        expect(tabs.sendMessage.mock.calls.filter(([, message]) => message.type === 'readerSession:releaseAssets')).toHaveLength(2);
    });

    it('creates a session, opens a detached reader tab, and restricts get to the bound reader tab', async () => {
        const { handleReaderSessionRequest } = await loadHandler();
        const create = await handleReaderSessionRequest(
            request('readerSession:create', { snapshot: snapshot('a') }),
            { tab: { id: 101 } },
        );

        expect(create?.response.ok).toBe(true);
        expect(create?.response.data).toMatchObject({ readerTabId: 500 });

        const sessionId = (create?.response.data as { sessionId: string }).sessionId;
        const get = await handleReaderSessionRequest(
            request('readerSession:get', { sessionId }),
            { tab: { id: 500 } },
        );
        expect(get?.response.ok).toBe(true);
        expect(get?.response.data).toMatchObject({
            session: {
                sessionId,
                sourceTabId: 101,
                readerTabId: 500,
            },
        });

        const denied = await handleReaderSessionRequest(
            request('readerSession:get', { sessionId }),
            { tab: { id: 999 } },
        );
        expect(denied?.response.ok).toBe(false);
        expect(denied?.response.error?.code).toBe('PERMISSION_DENIED');
    });

    it('does not fall back to persistent local storage when session storage is unavailable', async () => {
        const { handleReaderSessionRequest } = await loadHandler({ withSessionStorage: false, withLocalStorage: true });
        const create = await handleReaderSessionRequest(
            request('readerSession:create', { snapshot: snapshot('no-session-storage') }),
            { tab: { id: 101 } },
        );

        expect(create?.response.ok).toBe(false);
        expect(create?.response.error?.code).toBe('SOURCE_UNAVAILABLE');
        expect(storageData[STORAGE_KEY]).toBeUndefined();
        expect(tabs.create).not.toHaveBeenCalled();
    });

    it('keeps multiple detached reader sessions routed to their own source tabs', async () => {
        const { handleReaderSessionRequest } = await loadHandler();
        const a = await handleReaderSessionRequest(
            request('readerSession:create', { snapshot: snapshot('a') }),
            { tab: { id: 11 } },
        );
        const b = await handleReaderSessionRequest(
            request('readerSession:create', { snapshot: snapshot('b') }),
            { tab: { id: 22 } },
        );

        const aSessionId = (a?.response.data as { sessionId: string }).sessionId;
        const bSessionId = (b?.response.data as { sessionId: string }).sessionId;

        await handleReaderSessionRequest(
            request('readerSession:draft', { sessionId: aSessionId }),
            { tab: { id: 500 } },
        );
        await handleReaderSessionRequest(
            request('readerSession:draft', { sessionId: aSessionId, text: 'Edited draft' }),
            { tab: { id: 500 } },
        );
        await handleReaderSessionRequest(
            request('readerSession:beforeSend', { sessionId: aSessionId }),
            { tab: { id: 500 } },
        );
        await handleReaderSessionRequest(
            request('readerSession:send', { sessionId: aSessionId, text: 'A prompt' }),
            { tab: { id: 500 } },
        );
        await handleReaderSessionRequest(
            request('readerSession:send', { sessionId: bSessionId, text: 'B prompt' }),
            { tab: { id: 501 } },
        );

        expect(tabs.sendMessage).toHaveBeenNthCalledWith(
            1,
            11,
            expect.objectContaining({ type: 'readerSession:draft', payload: expect.objectContaining({ sessionId: aSessionId }) }),
            expect.any(Function),
        );
        expect(tabs.sendMessage).toHaveBeenNthCalledWith(
            2,
            11,
            expect.objectContaining({ type: 'readerSession:draft', payload: expect.objectContaining({ text: 'Edited draft' }) }),
            expect.any(Function),
        );
        expect(tabs.sendMessage).toHaveBeenNthCalledWith(
            3,
            11,
            expect.objectContaining({ type: 'readerSession:beforeSend', payload: expect.objectContaining({ sessionId: aSessionId }) }),
            expect.any(Function),
        );
        expect(tabs.sendMessage).toHaveBeenNthCalledWith(
            4,
            11,
            expect.objectContaining({ type: 'readerSession:send', payload: expect.objectContaining({ text: 'A prompt' }) }),
            expect.any(Function),
        );
        expect(tabs.sendMessage).toHaveBeenNthCalledWith(
            5,
            22,
            expect.objectContaining({ type: 'readerSession:send', payload: expect.objectContaining({ text: 'B prompt' }) }),
            expect.any(Function),
        );
        expect(tabs.update).toHaveBeenCalledTimes(2);
        expect(tabs.update).toHaveBeenNthCalledWith(1, 11, { active: true }, expect.any(Function));
        expect(tabs.update).toHaveBeenNthCalledWith(2, 22, { active: true }, expect.any(Function));
    });

    it('closes the detached reader when the source tab is removed', async () => {
        const { handleReaderSessionRequest, handleReaderSessionTabRemoved } = await loadHandler();
        await handleReaderSessionRequest(
            request('readerSession:create', { snapshot: snapshot('source-close') }),
            { tab: { id: 42 } },
        );

        await handleReaderSessionTabRemoved(42);

        expect(tabs.remove).toHaveBeenCalledWith(500, expect.any(Function));
        expect((storageData[STORAGE_KEY] as Record<string, unknown>)).toEqual({});
    });

    it('removes only the session when the detached reader tab is removed', async () => {
        const { handleReaderSessionRequest, handleReaderSessionTabRemoved } = await loadHandler();
        await handleReaderSessionRequest(
            request('readerSession:create', { snapshot: snapshot('reader-close') }),
            { tab: { id: 77 } },
        );

        await handleReaderSessionTabRemoved(500);

        expect(tabs.remove).not.toHaveBeenCalled();
        expect((storageData[STORAGE_KEY] as Record<string, unknown>)).toEqual({});
    });

    it('returns a stable source unavailable error when the source tab cannot receive messages', async () => {
        const { handleReaderSessionRequest } = await loadHandler();
        const create = await handleReaderSessionRequest(
            request('readerSession:create', { snapshot: snapshot('unavailable') }),
            { tab: { id: 88 } },
        );
        tabs.sendMessage.mockImplementationOnce(() => {
            throw new Error('Receiving end does not exist');
        });

        const sessionId = (create?.response.data as { sessionId: string }).sessionId;
        const response = await handleReaderSessionRequest(
            request('readerSession:locate', { sessionId, position: 1 }),
            { tab: { id: 500 } },
        );

        expect(response?.response.ok).toBe(false);
        expect(response?.response.error?.code).toBe('SOURCE_UNAVAILABLE');
    });

    it('activates the source tab before locate without closing the detached reader tab', async () => {
        const { handleReaderSessionRequest } = await loadHandler();
        const create = await handleReaderSessionRequest(
            request('readerSession:create', { snapshot: snapshot('locate-12345678') }),
            { tab: { id: 88 } },
        );

        const sessionId = (create?.response.data as { sessionId: string }).sessionId;
        const response = await handleReaderSessionRequest(
            request('readerSession:locate', { sessionId, position: 1, messageId: 'locate-message' }),
            { tab: { id: 500 } },
        );

        expect(response?.response.ok).toBe(true);
        expect(tabs.update).toHaveBeenCalledWith(88, { active: true }, expect.any(Function));
        expect(tabs.sendMessage).toHaveBeenCalledWith(
            88,
            expect.objectContaining({ type: 'readerSession:locate', payload: expect.objectContaining({ messageId: 'locate-message', documentKey: 'chatgpt:conversation:locate-12345678' }) }),
            expect.any(Function),
        );
        expect(tabs.remove).not.toHaveBeenCalled();
    });

    it('overrides a caller document key with the conversation bound to the session source URL', async () => {
        const { handleReaderSessionRequest } = await loadHandler();
        const captured = snapshot('bound-12345678');
        captured.sourceUrl = 'https://chat.openai.com/g/project-id/c/bound-12345678?model=auto';
        const create = await handleReaderSessionRequest(request('readerSession:create', { snapshot: captured }), { tab: { id: 88 } });
        const sessionId = (create!.response.data as { sessionId: string }).sessionId;
        const locate = request('readerSession:locate', {
            sessionId, position: 4, messageId: 'bound-message', documentKey: 'chatgpt:conversation:forged-12345678',
        });

        const response = await handleReaderSessionRequest(locate, { tab: { id: 500 } });

        expect(response?.response.ok).toBe(true);
        expect(tabs.sendMessage).toHaveBeenCalledExactlyOnceWith(88, expect.objectContaining({
            type: 'readerSession:locate',
            payload: { sessionId, position: 4, messageId: 'bound-message', documentKey: 'chatgpt:conversation:bound-12345678' },
        }), expect.any(Function));
        expect((locate as Extract<ExtRequest, { type: 'readerSession:locate' }>).payload.documentKey)
            .toBe('chatgpt:conversation:forged-12345678');
        expect((storageData[STORAGE_KEY] as Record<string, { sourceUrl: string }>)[sessionId]!.sourceUrl)
            .toBe(captured.sourceUrl);
    });

    it('preserves a failed locate outcome inside a successful routed protocol response', async () => {
        const { handleReaderSessionRequest } = await loadHandler();
        const create = await handleReaderSessionRequest(request('readerSession:create', { snapshot: snapshot('bound-12345678') }), { tab: { id: 88 } });
        const sessionId = (create!.response.data as { sessionId: string }).sessionId;
        tabs.sendMessage.mockImplementationOnce((_tabId, forwarded, callback) => callback({
            v: PROTOCOL_VERSION, id: forwarded.id, type: forwarded.type, ok: true, data: { located: false },
        }));
        const locate = request('readerSession:locate', { sessionId, position: 1, messageId: 'bound-message' });

        const response = await handleReaderSessionRequest(locate, { tab: { id: 500 } });

        expect(response?.response).toMatchObject({ id: locate.id, type: 'readerSession:locate', ok: true, data: { located: false } });
    });

    it.each(['annotation', 'items', 'both'] as const)('keeps page-scoped detached locate bound to trusted %s snapshot identity', async (binding) => {
        const { handleReaderSessionRequest } = await loadHandler();
        const captured = { ...snapshot('page-scope'), sourceUrl: 'https://chatgpt.com/' };
        const pageKey = 'chatgpt:page:source-epoch';
        if (binding !== 'items') captured.annotationDocument = { platform: 'chatgpt', conversationId: pageKey, lastKnownUrl: captured.sourceUrl };
        if (binding !== 'annotation') captured.items[0]!.meta = { ...captured.items[0]!.meta, documentKey: pageKey };
        const create = await handleReaderSessionRequest(request('readerSession:create', { snapshot: captured }), { tab: { id: 88 } });
        const sessionId = (create!.response.data as { sessionId: string }).sessionId;

        const response = await handleReaderSessionRequest(request('readerSession:locate', {
            sessionId, messageId: 'page-scope-message', documentKey: 'chatgpt:page:forged-reader-epoch',
        }), { tab: { id: 500 } });

        expect(response?.response.ok).toBe(true);
        expect(tabs.sendMessage).toHaveBeenCalledExactlyOnceWith(88, expect.objectContaining({
            type: 'readerSession:locate', payload: { sessionId, messageId: 'page-scope-message', documentKey: pageKey },
        }), expect.any(Function));
    });

    it.each([
        'https://evil.example/',
        'https://evil.chatgpt.com/',
        'https://user:password@chatgpt.com/',
        'http://localhost:3000/',
    ])('does not bind an unofficial source URL using a stored page key: %s', async (sourceUrl) => {
        const { handleReaderSessionRequest } = await loadHandler();
        const captured = { ...snapshot('page-scope'), sourceUrl, annotationDocument: {
            platform: 'chatgpt' as const, conversationId: 'chatgpt:page:source-epoch',
        } };
        const create = await handleReaderSessionRequest(request('readerSession:create', { snapshot: captured }), { tab: { id: 88 } });
        const sessionId = (create!.response.data as { sessionId: string }).sessionId;

        const response = await handleReaderSessionRequest(request('readerSession:locate', { sessionId, messageId: 'page-scope-message' }), { tab: { id: 500 } });

        expect(response?.response).toMatchObject({ ok: false, error: { code: 'SOURCE_UNAVAILABLE' } });
        expect(tabs.sendMessage).not.toHaveBeenCalled();
    });

    it.each(['missing', 'conflicting', 'empty'] as const)('does not trust a caller page key when the saved snapshot binding is %s', async (binding) => {
        const { handleReaderSessionRequest } = await loadHandler();
        const captured = { ...snapshot('page-scope'), sourceUrl: 'https://chatgpt.com/' };
        if (binding !== 'missing') captured.annotationDocument = { platform: 'chatgpt', conversationId: binding === 'empty' ? 'chatgpt:page:' : 'chatgpt:page:source-epoch' };
        if (binding === 'conflicting') captured.items[0]!.meta = { ...captured.items[0]!.meta, documentKey: 'chatgpt:page:different-epoch' };
        const create = await handleReaderSessionRequest(request('readerSession:create', { snapshot: captured }), { tab: { id: 88 } });
        const sessionId = (create!.response.data as { sessionId: string }).sessionId;

        const response = await handleReaderSessionRequest(request('readerSession:locate', {
            sessionId, messageId: 'page-scope-message', documentKey: 'chatgpt:page:caller-epoch',
        }), { tab: { id: 500 } });

        expect(response?.response).toMatchObject({ ok: false, error: { code: 'SOURCE_UNAVAILABLE' } });
        expect(tabs.sendMessage).not.toHaveBeenCalled();
    });

    it.each(['https://evil.example/c/bound-12345678', 'https://chatgpt.com/', 'https://chatgpt.com/c/short'])('rejects an unverifiable bound source URL instead of trusting a caller document key: %s', async (sourceUrl) => {
        const { handleReaderSessionRequest } = await loadHandler();
        const captured = { ...snapshot('bound-12345678'), sourceUrl };
        const create = await handleReaderSessionRequest(request('readerSession:create', { snapshot: captured }), { tab: { id: 88 } });
        const sessionId = (create!.response.data as { sessionId: string }).sessionId;

        const response = await handleReaderSessionRequest(request('readerSession:locate', {
            sessionId, position: 1, messageId: 'bound-message', documentKey: 'chatgpt:conversation:bound-12345678',
        }), { tab: { id: 500 } });

        expect(response?.response).toMatchObject({ ok: false, error: { code: 'SOURCE_UNAVAILABLE' } });
        expect(tabs.sendMessage).not.toHaveBeenCalled();
    });

    it('rejects close requests from tabs outside the session binding', async () => {
        const { handleReaderSessionRequest } = await loadHandler();
        const create = await handleReaderSessionRequest(
            request('readerSession:create', { snapshot: snapshot('close') }),
            { tab: { id: 33 } },
        );

        const sessionId = (create?.response.data as { sessionId: string }).sessionId;
        const denied = await handleReaderSessionRequest(
            request('readerSession:close', { sessionId }),
            { tab: { id: 999 } },
        );

        expect(denied?.response.ok).toBe(false);
        expect(denied?.response.error?.code).toBe('PERMISSION_DENIED');
    });
});
