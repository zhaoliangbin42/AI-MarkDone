import {
    PROTOCOL_VERSION,
    createRequestId,
    type ExtRequest,
    type ExtResponse,
    type ProtocolErrorCode,
    type ReaderSessionSnapshot,
} from '../../../contracts/protocol';
import { browser, browserCompat } from '../../../drivers/shared/browser';

const STORAGE_KEY = 'aimd:readerSessions:v1';

type ReaderSessionRecord = {
    sessionId: string;
    sourceTabId: number;
    readerTabId: number | null;
    sourceUrl: string;
    createdAt: number;
    updatedAt: number;
    snapshot: ReaderSessionSnapshot;
};

type ReaderSessionStore = Record<string, ReaderSessionRecord>;

function ok(request: ExtRequest, data?: unknown): ExtResponse {
    return { v: PROTOCOL_VERSION, id: request.id, ok: true, type: request.type, data };
}

function errorResponse(request: ExtRequest, code: ProtocolErrorCode, message: string): ExtResponse {
    return {
        v: PROTOCOL_VERSION,
        id: request.id,
        ok: false,
        type: request.type,
        error: { code, message },
    };
}

function createSessionId(): string {
    const rand = Math.random().toString(16).slice(2);
    return `reader_${Date.now().toString(16)}_${rand}`;
}

function getStorageArea(): any | null {
    const storage = (browser as any).storage;
    return storage?.session ?? null;
}

function hasSessionStorageArea(): boolean {
    const area = getStorageArea();
    return Boolean(area?.get && area?.set);
}

async function readStore(): Promise<ReaderSessionStore> {
    const area = getStorageArea();
    if (!area?.get) return {};
    const result = await area.get(STORAGE_KEY);
    const value = result?.[STORAGE_KEY];
    return value && typeof value === 'object' ? value as ReaderSessionStore : {};
}

async function writeStore(store: ReaderSessionStore): Promise<void> {
    const area = getStorageArea();
    if (!area?.set) return;
    await area.set({ [STORAGE_KEY]: store });
}

async function upsertSession(record: ReaderSessionRecord): Promise<void> {
    const store = await readStore();
    store[record.sessionId] = record;
    await writeStore(store);
}

async function removeSession(sessionId: string): Promise<ReaderSessionRecord | null> {
    const store = await readStore();
    const record = store[sessionId] ?? null;
    delete store[sessionId];
    await writeStore(store);
    return record;
}

async function findSessionsByTab(tabId: number): Promise<ReaderSessionRecord[]> {
    const store = await readStore();
    return Object.values(store).filter((record) => record.sourceTabId === tabId || record.readerTabId === tabId);
}

function getRuntimeUrl(path: string): string {
    const runtime = browserCompat.runtime;
    return runtime?.getURL?.(path) ?? (browser as any).runtime?.getURL?.(path) ?? path;
}

function getNativeChromeApi(): any | null {
    const chromeLike = (globalThis as any).chrome;
    return chromeLike?.runtime ? chromeLike : null;
}

function readChromeRuntimeLastError(chromeLike: any): Error | null {
    const runtimeError = chromeLike?.runtime?.lastError;
    const message = typeof runtimeError?.message === 'string'
        ? runtimeError.message
        : typeof runtimeError === 'string'
            ? runtimeError
            : '';
    return message ? new Error(message) : null;
}

function callChromeCallbackApi<T>(
    chromeLike: any,
    fn: (...args: any[]) => unknown,
    args: unknown[],
    mapResult: (...callbackArgs: any[]) => T,
): Promise<T> {
    return new Promise<T>((resolve, reject) => {
        try {
            const maybePromise = fn(...args, (...callbackArgs: any[]) => {
                const runtimeError = readChromeRuntimeLastError(chromeLike);
                if (runtimeError) {
                    reject(runtimeError);
                    return;
                }
                resolve(mapResult(...callbackArgs));
            });
            if (maybePromise && typeof (maybePromise as Promise<unknown>).then === 'function') {
                (maybePromise as Promise<unknown>).then((value) => resolve(mapResult(value))).catch(reject);
            }
        } catch (error) {
            reject(error);
        }
    });
}

async function createReaderTab(sessionId: string): Promise<number | null> {
    const url = getRuntimeUrl(`reader.html#sessionId=${encodeURIComponent(sessionId)}`);
    const chromeLike = getNativeChromeApi();
    try {
        if (typeof chromeLike?.tabs?.create === 'function') {
            const tab = await callChromeCallbackApi(
                chromeLike,
                chromeLike.tabs.create.bind(chromeLike.tabs),
                [{ url }],
                (tab) => tab ?? null,
            ) as { id?: number } | null;
            return typeof tab?.id === 'number' ? tab.id : null;
        }
        const tab = await Promise.resolve(browserCompat.tabs?.create?.({ url } as any)) as { id?: number } | null;
        return typeof tab?.id === 'number' ? tab.id : null;
    } catch {
        return null;
    }
}

async function removeTab(tabId: number): Promise<void> {
    const chromeLike = getNativeChromeApi();
    try {
        if (typeof chromeLike?.tabs?.remove === 'function') {
            await callChromeCallbackApi(chromeLike, chromeLike.tabs.remove.bind(chromeLike.tabs), [tabId], () => undefined);
            return;
        }
        await Promise.resolve(browserCompat.tabs?.remove?.(tabId));
    } catch {
        // Tab closure is best effort; it may already be gone.
    }
}

async function activateTab(tabId: number): Promise<void> {
    const chromeLike = getNativeChromeApi();
    try {
        if (typeof chromeLike?.tabs?.update === 'function') {
            await callChromeCallbackApi(chromeLike, chromeLike.tabs.update.bind(chromeLike.tabs), [tabId, { active: true }], () => undefined);
            return;
        }
        await Promise.resolve(browserCompat.tabs?.update?.(tabId, { active: true } as any));
    } catch {
        // Activation is a convenience for locate; routing can still succeed if it fails.
    }
}

async function sendSourceTabMessage(sourceTabId: number, request: ExtRequest): Promise<ExtResponse> {
    const chromeLike = getNativeChromeApi();
    try {
        if (typeof chromeLike?.tabs?.sendMessage === 'function') {
            const response = await callChromeCallbackApi(
                chromeLike,
                chromeLike.tabs.sendMessage.bind(chromeLike.tabs),
                [sourceTabId, request],
                (response) => response,
            );
            return response as ExtResponse;
        }
        return await Promise.resolve(browserCompat.tabs?.sendMessage?.(sourceTabId, request)) as ExtResponse;
    } catch (error) {
        return {
            v: PROTOCOL_VERSION,
            id: request.id,
            ok: false,
            type: request.type,
            error: {
                code: 'SOURCE_UNAVAILABLE',
                message: error instanceof Error ? error.message : 'Source tab is unavailable',
            },
        };
    }
}

function getSenderTabId(sender: any): number | null {
    return typeof sender?.tab?.id === 'number' ? sender.tab.id : null;
}

function ensureReaderSender(request: ExtRequest, record: ReaderSessionRecord, senderTabId: number | null): ExtResponse | null {
    if (senderTabId === null || record.readerTabId !== senderTabId) {
        return errorResponse(request, 'PERMISSION_DENIED', 'Reader session sender does not match the detached reader tab');
    }
    return null;
}

export async function handleReaderSessionRequest(request: ExtRequest, sender: any): Promise<{ response: ExtResponse } | null> {
    if (!request.type.startsWith('readerSession:')) return null;

    if (request.type === 'readerSession:create') {
        if (!hasSessionStorageArea()) {
            return { response: errorResponse(request, 'SOURCE_UNAVAILABLE', 'Detached Reader requires extension session storage') };
        }
        const sourceTabId = getSenderTabId(sender);
        if (sourceTabId === null) {
            return { response: errorResponse(request, 'PERMISSION_DENIED', 'Reader session requires a source tab') };
        }
        const sessionId = createSessionId();
        const record: ReaderSessionRecord = {
            sessionId,
            sourceTabId,
            readerTabId: null,
            sourceUrl: request.payload.snapshot.sourceUrl,
            createdAt: Date.now(),
            updatedAt: Date.now(),
            snapshot: request.payload.snapshot,
        };
        await upsertSession(record);
        const readerTabId = await createReaderTab(sessionId);
        if (readerTabId === null) {
            await removeSession(sessionId);
            return { response: errorResponse(request, 'SOURCE_UNAVAILABLE', 'Unable to open detached reader tab') };
        }
        record.readerTabId = readerTabId;
        record.updatedAt = Date.now();
        await upsertSession(record);
        return { response: ok(request, { sessionId, readerTabId }) };
    }

    const sessionId = (request as Extract<ExtRequest, { payload: { sessionId: string } }>).payload.sessionId;
    const store = await readStore();
    const record = store[sessionId] ?? null;
    if (!record) return { response: errorResponse(request, 'NOT_FOUND', 'Reader session not found') };

    if (request.type === 'readerSession:get') {
        const senderTabId = getSenderTabId(sender);
        const senderError = ensureReaderSender(request, record, senderTabId);
        if (senderError) return { response: senderError };
        return { response: ok(request, { session: record }) };
    }

    if (request.type === 'readerSession:close') {
        const senderTabId = getSenderTabId(sender);
        if (senderTabId !== record.readerTabId && senderTabId !== record.sourceTabId) {
            return { response: errorResponse(request, 'PERMISSION_DENIED', 'Reader session sender does not match this session') };
        }
        await removeSession(sessionId);
        return { response: ok(request, { closed: true }) };
    }

    const senderError = ensureReaderSender(request, record, getSenderTabId(sender));
    if (senderError) return { response: senderError };

    if (request.type === 'readerSession:locate' || request.type === 'readerSession:send') {
        await activateTab(record.sourceTabId);
    }

    const forwarded: ExtRequest = { ...request, id: createRequestId() } as ExtRequest;
    const sourceResponse = await sendSourceTabMessage(record.sourceTabId, forwarded);
    if (request.type === 'readerSession:refresh' && sourceResponse.ok && sourceResponse.data && typeof sourceResponse.data === 'object') {
        const snapshot = (sourceResponse.data as { snapshot?: ReaderSessionSnapshot }).snapshot;
        if (snapshot) {
            record.snapshot = snapshot;
            record.sourceUrl = snapshot.sourceUrl;
            record.updatedAt = Date.now();
            await upsertSession(record);
            return { response: ok(request, { session: record }) };
        }
    }
    if (!sourceResponse.ok) {
        return {
            response: errorResponse(request, sourceResponse.error.code, sourceResponse.error.message),
        };
    }
    return { response: ok(request, sourceResponse.data) };
}

export async function handleReaderSessionTabRemoved(tabId: number): Promise<void> {
    const sessions = await findSessionsByTab(tabId);
    for (const record of sessions) {
        await removeSession(record.sessionId);
        if (record.sourceTabId === tabId && typeof record.readerTabId === 'number') {
            await removeTab(record.readerTabId);
        }
    }
}
