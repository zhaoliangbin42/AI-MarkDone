import { PathUtils } from '../../../core/bookmarks/path';
import type { Bookmark, Folder } from '../../../core/bookmarks/types';
import type { BookmarkIdentityKey } from './BookmarksPanelController';
import { bookmarkKey, folderKey, getBookmarkIdentityKey, parseBookmarkIdentityKey } from './bookmarksPanelControllerHelpers';
import type { BookmarksBulkItem } from '../../../contracts/protocol';

export function getSelectedBookmarkItems(params: {
    bookmarks: Bookmark[];
    selectedKeys: Set<string>;
}): BookmarksBulkItem[] {
    const ids = new Set<BookmarkIdentityKey>();
    for (const key of params.selectedKeys) {
        const id = parseBookmarkIdentityKey(key);
        if (id) ids.add(id);
    }

    const bookmarkById = new Map<BookmarkIdentityKey, Bookmark>();
    for (const bookmark of params.bookmarks) {
        const id = getBookmarkIdentityKey(bookmark);
        if (!bookmarkById.has(id)) bookmarkById.set(id, bookmark);
    }

    const items: BookmarksBulkItem[] = [];
    for (const id of ids) {
        const bookmark = bookmarkById.get(id);
        if (!bookmark) continue;
        if (bookmark.kind === 'page') items.push({ kind: 'page', url: bookmark.url });
        else if (typeof bookmark.position === 'number') items.push({ kind: 'message', url: bookmark.url, position: bookmark.position });
    }
    return items;
}

export type FolderCheckboxState = { checked: boolean; indeterminate: boolean };

type FolderSelectionCount = {
    total: number;
    selected: number;
};

function getParentPathWithoutNormalization(path: string): string | null {
    const separatorIndex = path.lastIndexOf(PathUtils.SEPARATOR);
    return separatorIndex < 0 ? null : path.slice(0, separatorIndex);
}

export function buildFolderCheckboxStateIndex(params: {
    folders: Folder[];
    bookmarks: Bookmark[];
    selectedKeys: Set<string>;
}): Map<string, FolderCheckboxState> {
    const counts = new Map<string, FolderSelectionCount>();
    for (const folder of params.folders) {
        counts.set(folder.path, { total: 0, selected: 0 });
    }

    const addToFolderChain = (rawPath: string, selected: boolean, includeSelf: boolean): void => {
        let current: string;
        try {
            current = PathUtils.normalize(rawPath);
        } catch {
            return;
        }
        if (!includeSelf) current = getParentPathWithoutNormalization(current) ?? '';

        while (current) {
            const count = counts.get(current);
            if (count) {
                count.total += 1;
                if (selected) count.selected += 1;
            }
            current = getParentPathWithoutNormalization(current) ?? '';
        }
    };

    for (const folder of params.folders) {
        addToFolderChain(folder.path, params.selectedKeys.has(folderKey(folder.path)), false);
    }
    for (const bookmark of params.bookmarks) {
        addToFolderChain(
            bookmark.folderPath,
            params.selectedKeys.has(bookmarkKey(getBookmarkIdentityKey(bookmark))),
            true,
        );
    }

    const states = new Map<string, FolderCheckboxState>();
    for (const folder of params.folders) {
        const count = counts.get(folder.path) ?? { total: 0, selected: 0 };
        if (count.total === 0) {
            states.set(folder.path, {
                checked: params.selectedKeys.has(folderKey(folder.path)),
                indeterminate: false,
            });
        } else if (count.selected === 0) {
            states.set(folder.path, { checked: false, indeterminate: false });
        } else if (count.selected === count.total) {
            states.set(folder.path, { checked: true, indeterminate: false });
        } else {
            states.set(folder.path, { checked: false, indeterminate: true });
        }
    }
    return states;
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
