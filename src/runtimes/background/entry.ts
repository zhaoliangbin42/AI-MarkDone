import { PROTOCOL_VERSION, isExtRequest, type ExtResponse } from '../../contracts/protocol';
import { handleBookmarksRequest, recoverJournalIfAny, recordPendingChangelogNotice } from './handlers/bookmarks';
import { handleSettingsRequest } from './handlers/settings';
import { browserCompat } from '../../drivers/shared/browser';

function extractSupportedHostPatterns(): string[] {
    const runtime = browserCompat.runtime;
    const manifest = runtime?.getManifest?.() as any;
    if (!manifest) return [];
    const mv = manifest.manifest_version;
    if (mv === 3) {
        return (manifest.host_permissions || []) as string[];
    }
    // MV2: host permissions are included in `permissions` array as URL patterns.
    return (manifest.permissions || []).filter((p: any) => typeof p === 'string' && p.startsWith('http')) as string[];
}

function isSupportedUrl(url?: string): boolean {
    if (!url) return false;
    try {
        const hostname = new URL(url).hostname;
        const patterns = extractSupportedHostPatterns();
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

async function updateActionState(tabId: number, url?: string) {
    const action = browserCompat.action;
    if (!action) return;

    if (isSupportedUrl(url)) {
        await action.setIcon?.({
            tabId,
            path: { '16': 'icons/icon16.png', '48': 'icons/icon48.png', '128': 'icons/icon128.png' }
        } as any);
        await action.setPopup?.({ tabId, popup: '' } as any);
    } else {
        await action.setIcon?.({
            tabId,
            path: { '16': 'icons/icon16_gray.png', '48': 'icons/icon48_gray.png', '128': 'icons/icon128_gray.png' }
        } as any);
        await action.setPopup?.({ tabId, popup: 'src/popup/popup.html' } as any);
    }
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
        if (changeInfo.status === 'complete' || changeInfo.url) updateActionState(tabId, tab.url);
    });
    tabs.onActivated?.addListener?.(async (activeInfo: { tabId: number }) => {
        const tab = await tabs.get(activeInfo.tabId);
        updateActionState(activeInfo.tabId, tab.url);
    });
    action?.onClicked?.addListener?.((tab: { id?: number }) => {
        if (!tab.id) return;
        tabs.sendMessage(tab.id, { v: PROTOCOL_VERSION, id: `click_${Date.now()}`, type: 'ui:toggle_toolbar' });
    });
}

runtime?.onMessage?.addListener?.((msg: unknown, _sender: any, sendResponse: (r: ExtResponse) => void) => {
    if (!isExtRequest(msg)) return;
    if (msg.v !== PROTOCOL_VERSION) return;
    if (msg.type === 'ping') {
        sendResponse({ v: PROTOCOL_VERSION, id: msg.id, ok: true, type: msg.type, data: { pong: true } });
        return true;
    }

    void (async () => {
        const settings = await handleSettingsRequest(msg);
        if (settings) return settings;
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
