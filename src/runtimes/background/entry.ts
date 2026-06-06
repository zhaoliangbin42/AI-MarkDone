import { PROTOCOL_VERSION, createRequestId, isExtRequest, type ExtResponse, type ExtRequest } from '../../contracts/protocol';
import { handleBookmarksRequest, recoverJournalIfAny, recordPendingChangelogNotice } from './handlers/bookmarks';
import { handleCloudBackupRequest } from './handlers/cloudBackup';
import { handleSettingsRequest } from './handlers/settings';
import { browserCompat } from '../../drivers/shared/browser';
import { logger } from '../../core/logger';
import { SUPPORTED_HOST_PATTERNS } from '../../../config/extension/hosts';

function matchesHostPatterns(url: string | undefined, patterns: readonly string[]): boolean {
    if (!url) return false;
    try {
        const hostname = new URL(url).hostname;
        return patterns.some((p) => {
            try {
                const ph = new URL(p.replace('*://', 'https://').replace('/*', '/')).hostname;
                return hostname === ph || hostname.endsWith(`.${ph}`);
            } catch {
                return false;
            }
        });
    } catch {
        return false;
    }
}

function isSupportedUrl(url?: string): boolean {
    return matchesHostPatterns(url, SUPPORTED_HOST_PATTERNS);
}

function isBenignTabLifecycleError(error: unknown): boolean {
    const message = error instanceof Error ? error.message : String(error ?? '');
    return [
        'No tab with id',
        'Receiving end does not exist',
        'Could not establish connection',
        'The tab was closed',
        'Extension context invalidated',
    ].some((pattern) => message.includes(pattern));
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
        let settled = false;
        const settleResolve = (value: T) => {
            if (settled) return;
            settled = true;
            resolve(value);
        };
        const settleReject = (error: unknown) => {
            if (settled) return;
            settled = true;
            reject(error);
        };
        try {
            const maybePromise = fn(...args, (...callbackArgs: any[]) => {
                const runtimeError = readChromeRuntimeLastError(chromeLike);
                if (runtimeError) {
                    settleReject(runtimeError);
                    return;
                }
                settleResolve(mapResult(...callbackArgs));
            });
            if (maybePromise && typeof (maybePromise as Promise<unknown>).then === 'function') {
                (maybePromise as Promise<unknown>)
                    .then((value) => settleResolve(mapResult(value)))
                    .catch(settleReject);
            }
        } catch (error) {
            settleReject(error);
        }
    });
}

async function safeTabOperation(label: string, operation: () => unknown): Promise<boolean> {
    try {
        await Promise.resolve(operation());
        return true;
    } catch (error) {
        if (!isBenignTabLifecycleError(error)) {
            logger.debug(`[AI-MarkDone][Background] ${label} failed`, error);
        }
        return false;
    }
}

async function safeGetTab(tabId: number): Promise<{ id?: number; url?: string } | null> {
    try {
        const chromeLike = getNativeChromeApi();
        if (typeof chromeLike?.tabs?.get === 'function') {
            return await callChromeCallbackApi(
                chromeLike,
                chromeLike.tabs.get.bind(chromeLike.tabs),
                [tabId],
                (tab) => tab ?? null,
            ) as { id?: number; url?: string } | null;
        }
        return await Promise.resolve(browserCompat.tabs?.get?.(tabId)) as { id?: number; url?: string } | null;
    } catch (error) {
        if (!isBenignTabLifecycleError(error)) {
            logger.debug('[AI-MarkDone][Background] tabs.get failed', error);
        }
        return null;
    }
}

async function safeSendTabMessage(tabId: number, request: ExtRequest): Promise<boolean> {
    return safeTabOperation(`tabs.sendMessage:${request.type}`, () => {
        const chromeLike = getNativeChromeApi();
        if (typeof chromeLike?.tabs?.sendMessage === 'function') {
            return callChromeCallbackApi(
                chromeLike,
                chromeLike.tabs.sendMessage.bind(chromeLike.tabs),
                [tabId, request],
                () => undefined,
            );
        }
        return browserCompat.tabs?.sendMessage?.(tabId, request);
    });
}

async function updateActionState(tabId: number, url?: string) {
    const action = browserCompat.action;
    if (!action) return;

    if (isSupportedUrl(url)) {
        const iconUpdated = await safeActionOperation('action.setIcon:supported', 'setIcon', {
            tabId,
            path: { '16': 'icons/icon16.png', '48': 'icons/icon48.png', '128': 'icons/icon128.png' }
        });
        if (!iconUpdated) return;
        await safeActionOperation('action.setPopup:supported', 'setPopup', { tabId, popup: '' });
    } else {
        const iconUpdated = await safeActionOperation('action.setIcon:unsupported', 'setIcon', {
            tabId,
            path: { '16': 'icons/icon16_gray.png', '48': 'icons/icon48_gray.png', '128': 'icons/icon128_gray.png' }
        });
        if (!iconUpdated) return;
        await safeActionOperation('action.setPopup:unsupported', 'setPopup', { tabId, popup: 'src/popup/popup.html' });
    }
}

async function safeActionOperation(label: string, method: 'setIcon' | 'setPopup', details: Record<string, unknown>): Promise<boolean> {
    return safeTabOperation(label, () => {
        const chromeLike = getNativeChromeApi();
        const nativeAction = chromeLike?.action || chromeLike?.browserAction;
        const nativeMethod = nativeAction?.[method];
        if (typeof nativeMethod === 'function') {
            return callChromeCallbackApi(
                chromeLike,
                nativeMethod.bind(nativeAction),
                [details],
                () => undefined,
            );
        }
        return browserCompat.action?.[method]?.(details as any);
    });
}

// Chrome MV3: prefer chrome.* events (more direct), but browser.* works as well.
const tabs = browserCompat.tabs;
const action = browserCompat.action;
const runtime = browserCompat.runtime;

runtime?.onInstalled?.addListener?.((details: { reason?: string; previousVersion?: string }) => {
    const manifestVersion = String(runtime?.getManifest?.()?.version ?? '').trim();
    if (!manifestVersion) return;
    if (details?.reason !== 'install' && details?.reason !== 'update') return;
    void recordPendingChangelogNotice({
        currentVersion: manifestVersion,
        reason: details.reason,
        previousVersion: details.previousVersion ?? null,
    }).catch(() => {
        // best-effort metadata write; keep runtime boot non-fatal.
    });
});

// Best-effort recovery: if a previous folder relocate was interrupted, replay it.
// Why: MV3 service worker can be terminated between async storage ops.
recoverJournalIfAny(Date.now()).catch(() => {
    // recovery is best-effort; keep silent unless debugging is enabled in console.
});

if (tabs?.onUpdated?.addListener) {
    tabs.onUpdated.addListener((tabId: number, changeInfo: { status?: string; url?: string }, tab: { url?: string }) => {
        if (changeInfo.status === 'complete' || changeInfo.url) void updateActionState(tabId, tab.url);
    });
    tabs.onActivated?.addListener?.(async (activeInfo: { tabId: number }) => {
        const tab = await safeGetTab(activeInfo.tabId);
        if (tab) void updateActionState(activeInfo.tabId, tab.url);
    });
    action?.onClicked?.addListener?.(async (tab: { id?: number; url?: string }) => {
        if (!tab.id) return;
        if (!isSupportedUrl(tab.url)) {
            void updateActionState(tab.id, tab.url);
            return;
        }
        const pingOk = await safeSendTabMessage(tab.id, { v: PROTOCOL_VERSION, id: createRequestId(), type: 'ping' });
        if (!pingOk) return;
        await safeSendTabMessage(tab.id, { v: PROTOCOL_VERSION, id: createRequestId(), type: 'ui:toggle_toolbar' });
    });
}

runtime?.onMessage?.addListener?.((msg: unknown, sender: any, sendResponse: (r: ExtResponse) => void) => {
    if (!isExtRequest(msg)) return;
    if (msg.v !== PROTOCOL_VERSION) return;
    if (msg.type === 'ping') {
        sendResponse({ v: PROTOCOL_VERSION, id: msg.id, ok: true, type: msg.type, data: { pong: true } });
        return true;
    }
    if (msg.type === 'content:ready') {
        const tabId = typeof sender?.tab?.id === 'number' ? sender.tab.id : null;
        if (tabId === null) {
            sendResponse({ v: PROTOCOL_VERSION, id: msg.id, ok: true, type: msg.type, data: { ready: false } });
            return true;
        }
        void updateActionState(tabId, sender?.tab?.url ?? msg.payload.url);
        sendResponse({ v: PROTOCOL_VERSION, id: msg.id, ok: true, type: msg.type, data: { ready: true } });
        return true;
    }

    void (async () => {
        const settings = await handleSettingsRequest(msg);
        if (settings) return settings;
        const cloudBackup = await handleCloudBackupRequest(msg);
        if (cloudBackup) return cloudBackup;
        return handleBookmarksRequest(msg);
    })().then((result) => {
        if (result) {
            sendResponse(result.response);
        } else {
            sendResponse({ v: PROTOCOL_VERSION, id: msg.id, ok: false, type: msg.type, error: { code: 'UNKNOWN_TYPE', message: 'Unknown request type' } });
        }
    }).catch((error) => {
        sendResponse({
            v: PROTOCOL_VERSION,
            id: msg.id,
            ok: false,
            type: msg.type,
            error: { code: 'INTERNAL_ERROR', message: error instanceof Error ? error.message : 'Internal error' },
        });
    });
    return true;
});
