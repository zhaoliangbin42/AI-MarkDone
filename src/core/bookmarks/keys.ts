import type { Bookmark } from './types';

const PROTOCOL_PATTERN = /^https?:\/\//;

export function normalizeUrlWithoutProtocol(url: string): string {
    return (url || '').replace(PROTOCOL_PATTERN, '');
}

export function buildBookmarkStorageKey(url: string, position: number): string {
    const urlWithoutProtocol = normalizeUrlWithoutProtocol(url);
    return `bookmark:${urlWithoutProtocol}:${position}`;
}

export function buildPageBookmarkStorageKey(url: string): string {
    const urlWithoutProtocol = normalizeUrlWithoutProtocol(url);
    return `bookmark:page:${urlWithoutProtocol}`;
}

export function buildBookmarkIdentityKey(url: string, position: number): string {
    const urlWithoutProtocol = normalizeUrlWithoutProtocol(url);
    return `message:${urlWithoutProtocol}:${position}`;
}

export function buildPageBookmarkIdentityKey(url: string): string {
    const urlWithoutProtocol = normalizeUrlWithoutProtocol(url);
    return `page:${urlWithoutProtocol}`;
}

export function buildBookmarkIdentityKeyFromParts(parts: {
    url?: string;
    urlWithoutProtocol?: string;
    position?: number;
    kind?: 'message' | 'page';
}): string {
    const normalized = parts.urlWithoutProtocol || normalizeUrlWithoutProtocol(parts.url || '');
    if (parts.kind === 'page') return `page:${normalized}`;
    return `message:${normalized}:${parts.position ?? 0}`;
}

export function buildBookmarkStorageKeyForBookmark(bookmark: Bookmark): string {
    if (bookmark.kind === 'page') return buildPageBookmarkStorageKey(bookmark.url);
    return buildBookmarkStorageKey(bookmark.url, bookmark.position ?? 0);
}

export function buildBookmarkIdentityKeyForBookmark(bookmark: Bookmark): string {
    if (bookmark.kind === 'page') return buildPageBookmarkIdentityKey(bookmark.url);
    return buildBookmarkIdentityKey(bookmark.url, bookmark.position ?? 0);
}
