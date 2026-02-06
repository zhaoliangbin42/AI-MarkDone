/**
 * Background service worker for Chrome Extension
 * Handles extension lifecycle and background tasks
 */

// Chrome API type declaration
declare const chrome: any;

type ContentToBackgroundMessage = { type: 'ping' };
type BackgroundToContentMessage = { action: 'openBookmarkPanel' };

function isContentToBackgroundMessage(message: unknown): message is ContentToBackgroundMessage {
    return (
        typeof message === 'object' &&
        message !== null &&
        (message as Record<string, unknown>).type === 'ping'
    );
}

const SUPPORTED_HOSTS = [
    'chatgpt.com',
    'chat.openai.com',
    'gemini.google.com',
    'claude.ai',
    'chat.deepseek.com'
];
// IMPORTANT: When adding a new host, also update src/popup/popup.html to include a link to the platform.

/**
 * Check if the URL is supported
 */
function isSupportedUrl(url?: string): boolean {
    if (!url) return false;
    try {
        const hostname = new URL(url).hostname;
        return SUPPORTED_HOSTS.some(host => hostname.endsWith(host));
    } catch (e) {
        return false;
    }
}

/**
 * Update the action state (icon and popup) based on the URL
 */
async function updateActionState(tabId: number, url?: string) {
    if (isSupportedUrl(url)) {
        // Supported: Color icon, No popup (triggers onClicked)
        await chrome.action.setIcon({
            tabId,
            path: {
                "16": "icons/icon16.png",
                "48": "icons/icon48.png",
                "128": "icons/icon128.png"
            }
        });
        await chrome.action.setPopup({ tabId, popup: '' });
    } else {
        // Unsupported: Gray icon, Show popup
        await chrome.action.setIcon({
            tabId,
            path: {
                "16": "icons/icon16_gray.png",
                "48": "icons/icon48_gray.png",
                "128": "icons/icon128_gray.png"
            }
        });
        await chrome.action.setPopup({ tabId, popup: 'src/popup/popup.html' });
    }
}

// Listen for tab updates (navigation)
chrome.tabs.onUpdated.addListener((tabId: any, changeInfo: any, tab: any) => {
    if (changeInfo.status === 'complete' || changeInfo.url) {
        updateActionState(tabId, tab.url);
    }
});

// Listen for tab activation (switching tabs)
chrome.tabs.onActivated.addListener(async (activeInfo: any) => {
    const tab = await chrome.tabs.get(activeInfo.tabId);
    updateActionState(activeInfo.tabId, tab.url);
});

chrome.runtime.onInstalled.addListener((details: any) => {
    if (details.reason === 'install') {
    } else if (details.reason === 'update') {
    }
});

chrome.runtime.onStartup.addListener(() => {
});

// Handle extension icon click
// This is only triggered when popup is set to empty string (supported sites)
chrome.action.onClicked.addListener((tab: any) => {
    // Send message to active tab to open bookmark panel
    if (tab.id) {
        const payload: BackgroundToContentMessage = { action: 'openBookmarkPanel' };
        chrome.tabs.sendMessage(tab.id, payload);
    }
});

// Listen for messages from content scripts
chrome.runtime.onMessage.addListener((message: unknown, _sender: any, sendResponse: any) => {
    if (isContentToBackgroundMessage(message)) {
        sendResponse({ status: 'ok' });
    } else {
        sendResponse({ status: 'invalid message payload' });
    }

    return true; // Keep message channel open for async response
});
