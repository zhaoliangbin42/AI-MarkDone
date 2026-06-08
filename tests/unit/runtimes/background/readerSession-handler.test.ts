import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PROTOCOL_VERSION, createRequestId, type ExtRequest, type ReaderSessionSnapshot } from '@/contracts/protocol';

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
            expect.objectContaining({ type: 'readerSession:send', payload: expect.objectContaining({ text: 'A prompt' }) }),
            expect.any(Function),
        );
        expect(tabs.sendMessage).toHaveBeenNthCalledWith(
            2,
            22,
            expect.objectContaining({ type: 'readerSession:send', payload: expect.objectContaining({ text: 'B prompt' }) }),
            expect.any(Function),
        );
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
