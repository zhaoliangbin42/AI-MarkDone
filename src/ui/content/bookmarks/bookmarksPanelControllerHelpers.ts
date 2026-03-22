import { PathUtils } from '../../../core/bookmarks/path';
import type { Bookmark } from '../../../core/bookmarks/types';
import type { BookmarkIdentityKey } from './BookmarksPanelController';

export function getBookmarkIdentityKey(bookmark: Bookmark): BookmarkIdentityKey {
    return `${bookmark.urlWithoutProtocol}:${bookmark.position}`;
}

export function folderKey(path: string): string {
    return `folder:${path}`;
}

export function bookmarkKey(id: BookmarkIdentityKey): string {
    return `bm:${id}`;
}

export function expandPathChain(path: string | null | undefined, expandedPaths: Set<string>): Set<string> {
    const next = new Set(expandedPaths);
    if (!path) return next;

    try {
        for (const candidate of PathUtils.getPathChain(path)) {
            next.add(candidate);
        }
    } catch {
        return next;
    }
    return next;
}

export function parseBookmarkIdentityKey(key: string): BookmarkIdentityKey | null {
    if (!key.startsWith('bm:')) return null;
    return key.slice(3);
}

export function formatBookmarkTimestamp(ts: number): string {
    try {
        return new Date(ts).toLocaleString();
    } catch {
        return String(ts);
    }
}
