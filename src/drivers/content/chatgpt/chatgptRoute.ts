import { isChatGPTPageUrl } from '../../../contracts/chatgptHosts';

function isAllowedRouteUrl(url: string): boolean {
    if (isChatGPTPageUrl(url)) return true;
    // Unit/integration harnesses use a local origin while preserving real ChatGPT paths.
    try {
        const hostname = new URL(url, typeof window !== 'undefined' ? window.location.href : 'https://chatgpt.com').hostname;
        return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]';
    } catch {
        return false;
    }
}

export function getChatGPTConversationId(url: string): string | null {
    if (!isAllowedRouteUrl(url)) return null;
    try {
        const pathname = new URL(url).pathname;
        return pathname.match(/(?:^|\/)(?:c|conversation)\/([0-9a-f-]{8,})/i)?.[1] ?? null;
    } catch {
        return url.match(/(?:^|\/)(?:c|conversation)\/([0-9a-f-]{8,})/i)?.[1] ?? null;
    }
}

export function isChatGPTConversationPage(url: string): boolean {
    return getChatGPTConversationId(url) !== null;
}
