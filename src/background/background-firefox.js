/**
 * Background script for Firefox Extension (Manifest V2)
 * Uses browser.* API instead of chrome.*
 */

const SUPPORTED_HOSTS = [
    'chatgpt.com',
    'chat.openai.com',
    'gemini.google.com',
    'claude.ai',
    'chat.deepseek.com'
];

/**
 * Check if the URL is supported
 */
function isSupportedUrl(url) {
    if (!url) return false;
    try {
        const hostname = new URL(url).hostname;
        return SUPPORTED_HOSTS.some(host => hostname.endsWith(host));
    } catch (e) {
        return false;
    }
}

/**
 * Update the browser action state (icon and popup) based on the URL
 */
async function updateActionState(tabId, url) {
    if (isSupportedUrl(url)) {
        // Supported: Color icon, No popup (triggers onClicked)
        await browser.browserAction.setIcon({
            tabId,
            path: {
                "16": "icons/icon16.png",
                "48": "icons/icon48.png",
                "128": "icons/icon128.png"
            }
        });
        await browser.browserAction.setPopup({ tabId, popup: '' });
    } else {
        // Unsupported: Gray icon, Show popup
        await browser.browserAction.setIcon({
            tabId,
            path: {
                "16": "icons/icon16_gray.png",
                "48": "icons/icon48_gray.png",
                "128": "icons/icon128_gray.png"
            }
        });
        await browser.browserAction.setPopup({ tabId, popup: 'src/popup/popup.html' });
    }
}

// Listen for tab updates (navigation)
browser.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete' || changeInfo.url) {
        updateActionState(tabId, tab.url);
    }
});

// Listen for tab activation (switching tabs)
browser.tabs.onActivated.addListener(async (activeInfo) => {
    const tab = await browser.tabs.get(activeInfo.tabId);
    updateActionState(activeInfo.tabId, tab.url);
});

browser.runtime.onInstalled.addListener((details) => {
    console.log('[AI-MarkDone] Extension installed/updated:', details.reason);
});

browser.runtime.onStartup.addListener(() => {
    console.log('[AI-MarkDone] Extension started');
});

// Handle extension icon click
// This is only triggered when popup is set to empty string (supported sites)
browser.browserAction.onClicked.addListener((tab) => {
    if (tab.id) {
        browser.tabs.sendMessage(tab.id, { action: 'openBookmarkPanel' });
    }
});

// Listen for messages from content scripts
browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
    switch (message.type) {
        case 'ping':
            sendResponse({ status: 'ok' });
            break;
        default:
            sendResponse({ status: 'unknown message type' });
    }
    return true;
});
