import type { Bookmark, Folder, FolderTreeNode, BookmarksSortMode } from '../../core/bookmarks/types';
import { PathUtils } from '../../core/bookmarks/path';
import { buildFolderTree, filterBookmarks, sortBookmarks } from '../../core/bookmarks/tree';

export type BookmarksPanelState = {
    query: string;
    platform: string;
    sortMode: BookmarksSortMode;
    selectedFolderPath: string | null;
    recursive: boolean;
    expandedPaths: Set<string>;
    selectedKeys: Set<string>;
};

export type BookmarksPanelViewModel = {
    folderTree: FolderTreeNode[];
    bookmarks: Bookmark[];
    selectedCount: number;
    query: string;
    platform: string;
    sortMode: BookmarksSortMode;
    selectedFolderPath: string | null;
};

export function computeBookmarksPanelViewModel(params: {
    folders: Folder[];
    bookmarks: Bookmark[];
    state: BookmarksPanelState;
}): BookmarksPanelViewModel {
    const state = params.state;
    const folderTree = buildFolderTree({
        folders: params.folders,
        bookmarks: params.bookmarks,
        expandedPaths: state.expandedPaths,
        selectedPath: state.selectedFolderPath,
        sortMode: state.sortMode,
    });

    let items = params.bookmarks;
    items = filterBookmarks({ bookmarks: items, query: state.query, platform: state.platform });

    if (state.selectedFolderPath) {
        const fp = PathUtils.normalize(state.selectedFolderPath);
        items = items.filter((b) => {
            if (state.recursive) {
                return b.folderPath === fp || PathUtils.isDescendantOf(b.folderPath, fp);
            }
            return b.folderPath === fp;
        });
    }

    items = sortBookmarks(items, state.sortMode);

    return {
        folderTree,
        bookmarks: items,
        selectedCount: state.selectedKeys.size,
        query: state.query,
        platform: state.platform,
        sortMode: state.sortMode,
        selectedFolderPath: state.selectedFolderPath,
    };
}

