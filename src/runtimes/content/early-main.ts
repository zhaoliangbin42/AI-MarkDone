const FETCH_EVENT = 'aimd:chatgpt-conversation-fetch';

declare global {
    interface Window {
        __AIMD_CHATGPT_FETCH_PATCHED__?: boolean;
    }
}

if (!window.__AIMD_CHATGPT_FETCH_PATCHED__) {
    window.__AIMD_CHATGPT_FETCH_PATCHED__ = true;
    const originalFetch = window.fetch.bind(window);
    window.fetch = async (...args: Parameters<typeof fetch>) => {
        const response = await originalFetch(...args);
        try {
            const url = String(args[0] instanceof Request ? args[0].url : args[0] ?? '');
            if (/\/backend-api\/conversation\//.test(url)) {
                window.dispatchEvent(new CustomEvent(FETCH_EVENT, { detail: { url } }));
            }
        } catch {
            // ignore page-level hook failures
        }
        return response;
    };
}

export {};
