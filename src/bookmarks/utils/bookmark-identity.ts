import type { Bookmark } from '../storage/types';

function normalizeUrlWithoutProtocol(url: string): string {
    return (url || '').replace(/^https?:\/\//, '');
}

export function buildBookmarkIdentityKey(url: string, position: number): string {
    return `${normalizeUrlWithoutProtocol(url)}:${position}`;
}

export function getBookmarkIdentityKey(bookmark: Pick<Bookmark, 'url' | 'position' | 'urlWithoutProtocol'>): string {
    const normalized = bookmark.urlWithoutProtocol || normalizeUrlWithoutProtocol(bookmark.url);
    return `${normalized}:${bookmark.position}`;
}
