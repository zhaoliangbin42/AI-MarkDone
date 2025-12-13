chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === "install") ; else if (details.reason === "update") ;
});
chrome.runtime.onStartup.addListener(() => {
});
chrome.action.onClicked.addListener((tab) => {
  if (tab.id) {
    chrome.tabs.sendMessage(tab.id, { action: "openBookmarkPanel" });
  }
});
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  switch (message.type) {
    case "ping":
      sendResponse({ status: "ok" });
      break;
    default:
      sendResponse({ status: "unknown message type" });
  }
  return true;
});
