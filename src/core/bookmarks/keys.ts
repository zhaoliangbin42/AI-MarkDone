const PROTOCOL_PATTERN = /^https?:\/\//;

export function normalizeUrlWithoutProtocol(url: string): string {
    return (url || '').replace(PROTOCOL_PATTERN, '');
}

export function buildBookmarkStorageKey(url: string, position: number): string {
    const urlWithoutProtocol = normalizeUrlWithoutProtocol(url);
    return `bookmark:${urlWithoutProtocol}:${position}`;
}

export function buildBookmarkIdentityKey(url: string, position: number): string {
    const urlWithoutProtocol = normalizeUrlWithoutProtocol(url);
    return `${urlWithoutProtocol}:${position}`;
}

export function buildBookmarkIdentityKeyFromParts(parts: {
    url?: string;
    urlWithoutProtocol?: string;
    position: number;
}): string {
    const normalized = parts.urlWithoutProtocol || normalizeUrlWithoutProtocol(parts.url || '');
    return `${normalized}:${parts.position}`;
}
