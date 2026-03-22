import { PathUtils } from '../../../core/bookmarks/path';
import type { Bookmark, Folder } from '../../../core/bookmarks/types';
import type { BookmarkIdentityKey } from './BookmarksPanelController';
import { bookmarkKey, folderKey, getBookmarkIdentityKey, parseBookmarkIdentityKey } from './bookmarksPanelControllerHelpers';

export function getSelectedBookmarkItems(params: {
    bookmarks: Bookmark[];
    selectedKeys: Set<string>;
}): Array<{ url: string; position: number }> {
    const ids = new Set<BookmarkIdentityKey>();
    for (const key of params.selectedKeys) {
        const id = parseBookmarkIdentityKey(key);
        if (id) ids.add(id);
    }

    const items: Array<{ url: string; position: number }> = [];
    for (const id of ids) {
        const bookmark = params.bookmarks.find((candidate) => getBookmarkIdentityKey(candidate) === id);
        if (bookmark) items.push({ url: bookmark.url, position: bookmark.position });
    }
    return items;
}

export function getSelectedFolderPaths(selectedKeys: Set<string>): string[] {
    const paths = new Set<string>();
    for (const key of selectedKeys) {
        if (!key.startsWith('folder:')) continue;
        const rawPath = key.slice('folder:'.length).trim();
        if (!rawPath) continue;
        try {
            paths.add(PathUtils.normalize(rawPath));
        } catch {
            // ignore malformed selection keys
        }
    }
    return Array.from(paths).sort((a, b) => {
        const depthDiff = PathUtils.getDepth(a) - PathUtils.getDepth(b);
        return depthDiff !== 0 ? depthDiff : a.localeCompare(b);
    });
}

export function getDescendantKeysForFolder(params: {
    path: string;
    folders: Folder[];
    bookmarks: Bookmark[];
}): string[] {
    const normalized = PathUtils.normalize(params.path);
    const keys: string[] = [];

    for (const folder of params.folders) {
        if (folder.path === normalized) continue;
        if (PathUtils.isDescendantOf(folder.path, normalized)) keys.push(folderKey(folder.path));
    }

    for (const bookmark of params.bookmarks) {
        if (bookmark.folderPath === normalized || PathUtils.isDescendantOf(bookmark.folderPath, normalized)) {
            keys.push(bookmarkKey(getBookmarkIdentityKey(bookmark)));
        }
    }

    return keys;
}
