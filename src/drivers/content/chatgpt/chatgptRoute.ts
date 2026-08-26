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
        const pathname = new URL(
            url,
            typeof window !== 'undefined' ? window.location.href : 'https://chatgpt.com',
        ).pathname;
        return readConversationPathToken(pathname);
    } catch {
        return readConversationPathToken(url.split(/[?#]/, 1)[0] ?? '');
    }
}

export function isChatGPTConversationPage(url: string): boolean {
    return getChatGPTConversationId(url) !== null;
}

/**
 * Ask ChatGPT to build its full conversation-navigation skeleton on reload.
 * An empty value is intentional: non-empty values are treated as a concrete
 * message target by the host page rather than as the full-history trigger.
 */
export function withChatGPTFullHistoryTrigger(url: string): string {
    if (!isChatGPTConversationPage(url)) return url;
    try {
        const parsed = new URL(
            url,
            typeof window !== 'undefined' ? window.location.href : 'https://chatgpt.com',
        );
        parsed.searchParams.set('message', '');
        return parsed.toString();
    } catch {
        return url;
    }
}

export function hasChatGPTFullHistoryTrigger(url: string): boolean {
    if (!isChatGPTConversationPage(url)) return false;
    try {
        const parsed = new URL(
            url,
            typeof window !== 'undefined' ? window.location.href : 'https://chatgpt.com',
        );
        return parsed.searchParams.has('message') && parsed.searchParams.get('message') === '';
    } catch {
        return false;
    }
}

function readConversationPathToken(pathname: string): string | null {
    const segments = pathname.split('/').filter(Boolean);
    for (let index = 0; index < segments.length - 1; index += 1) {
        const marker = segments[index]?.toLowerCase();
        if (marker !== 'c' && marker !== 'conversation') continue;
        const encoded = segments[index + 1] ?? '';
        let candidate = encoded;
        try {
            candidate = decodeURIComponent(encoded);
        } catch {
            continue;
        }
        if (isCanonicalConversationToken(candidate)) return candidate;
    }
    return null;
}

function isCanonicalConversationToken(value: string): boolean {
    const token = value.trim();
    return token.length >= 8
        && token.length <= 160
        && /^[A-Za-z0-9][A-Za-z0-9._~-]*$/.test(token);
}
