/**
 * Background service worker for Chrome Extension
 * Handles extension lifecycle and background tasks
 */

chrome.runtime.onInstalled.addListener((details) => {
    if (details.reason === 'install') {
        // console.log('[AI-MarkDone] Extension installed');led');
    } else if (details.reason === 'update') {
        // console.log('[AI-MarkDone] Extension updated to version', chrome.runtime.getManifest().version);
    }
});

chrome.runtime.onStartup.addListener(() => {
    // console.log('[AI-MarkDone] Extension started');
});

// Handle extension icon click
chrome.action.onClicked.addListener((tab) => {
    // Send message to active tab to open bookmark panel
    if (tab.id) {
        chrome.tabs.sendMessage(tab.id, { action: 'openBookmarkPanel' });
    }
});

// Listen for messages from content scripts
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    // console.log('[AI-MarkDone] Message received:', message);

    // Handle different message types here if needed
    switch (message.type) {
        case 'ping':
            sendResponse({ status: 'ok' });
            break;
        default:
            sendResponse({ status: 'unknown message type' });
    }

    return true; // Keep message channel open for async response
});
