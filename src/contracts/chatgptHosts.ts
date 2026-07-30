export const CHATGPT_PAGE_HOSTNAMES = ['chatgpt.com', 'chat.openai.com'] as const;
export const CHATGPT_NAVIGATION_ALIAS_HOSTNAME = 'chat.com' as const;

export function isChatGPTPageHostname(hostname: string): boolean {
    const normalized = hostname.trim().toLowerCase().replace(/\.$/, '');
    return (CHATGPT_PAGE_HOSTNAMES as readonly string[]).includes(normalized);
}

export function isChatGPTNavigationHostname(hostname: string): boolean {
    const normalized = hostname.trim().toLowerCase().replace(/\.$/, '');
    return isChatGPTPageHostname(normalized) || normalized === CHATGPT_NAVIGATION_ALIAS_HOSTNAME;
}

export function isChatGPTPageUrl(value: string): boolean {
    try {
        const url = new URL(value);
        return (url.protocol === 'https:' || url.protocol === 'http:') && isChatGPTPageHostname(url.hostname);
    } catch {
        return false;
    }
}
