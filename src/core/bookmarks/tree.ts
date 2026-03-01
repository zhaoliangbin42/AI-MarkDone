import type { Bookmark, BookmarksSortMode, Folder, FolderTreeNode } from './types';
import { PathUtils } from './path';

function compareCaseInsensitive(a: string, b: string): number {
    return a.localeCompare(b, undefined, { sensitivity: 'base' });
}

export function sortBookmarks(bookmarks: Bookmark[], sortMode: BookmarksSortMode): Bookmark[] {
    const items = [...bookmarks];
    switch (sortMode) {
        case 'time-desc':
            return items.sort((a, b) => b.timestamp - a.timestamp);
        case 'time-asc':
            return items.sort((a, b) => a.timestamp - b.timestamp);
        case 'alpha-desc':
            return items.sort((a, b) => compareCaseInsensitive(b.title, a.title));
        case 'alpha-asc':
        default:
            return items.sort((a, b) => compareCaseInsensitive(a.title, b.title));
    }
}

export function buildFolderTree(params: {
    folders: Folder[];
    bookmarks: Bookmark[];
    expandedPaths?: Set<string>;
    selectedPath?: string | null;
    sortMode?: BookmarksSortMode;
}): FolderTreeNode[] {
    const sortMode = params.sortMode ?? 'alpha-asc';
    const expandedPaths = params.expandedPaths ?? new Set<string>();
    const selectedPath = params.selectedPath ?? null;

    const bookmarksByFolder = new Map<string, Bookmark[]>();
    for (const b of params.bookmarks) {
        const list = bookmarksByFolder.get(b.folderPath) ?? [];
        list.push(b);
        bookmarksByFolder.set(b.folderPath, list);
    }
    for (const [folderPath, list] of bookmarksByFolder) {
        bookmarksByFolder.set(folderPath, sortBookmarks(list, sortMode));
    }

    const sortedFolders = [...params.folders].sort((a, b) => compareCaseInsensitive(a.path, b.path));

    const rootNodes: FolderTreeNode[] = [];
    const nodeMap = new Map<string, FolderTreeNode>();

    for (const folder of sortedFolders) {
        const node: FolderTreeNode = {
            folder,
            children: [],
            bookmarks: bookmarksByFolder.get(folder.path) ?? [],
            isExpanded: expandedPaths.has(folder.path),
            isSelected: folder.path === selectedPath,
        };
        nodeMap.set(folder.path, node);

        const parentPath = PathUtils.getParentPath(folder.path);
        if (parentPath && nodeMap.has(parentPath)) {
            nodeMap.get(parentPath)!.children.push(node);
        } else {
            rootNodes.push(node);
        }
    }

    sortTreeNodes(rootNodes, sortMode);
    return rootNodes;
}

function sortTreeNodes(nodes: FolderTreeNode[], sortMode: BookmarksSortMode): void {
    nodes.sort((a, b) => compareCaseInsensitive(a.folder.name, b.folder.name));
    for (const node of nodes) {
        if (node.children.length > 0) sortTreeNodes(node.children, sortMode);
        if (node.bookmarks.length > 0) node.bookmarks = sortBookmarks(node.bookmarks, sortMode);
    }
}

export function flattenTree(nodes: FolderTreeNode[]): FolderTreeNode[] {
    const result: FolderTreeNode[] = [];
    for (const node of nodes) {
        result.push(node);
        if (node.children.length > 0) result.push(...flattenTree(node.children));
    }
    return result;
}

export function countBookmarks(nodes: FolderTreeNode[]): number {
    let count = 0;
    for (const node of nodes) {
        count += node.bookmarks.length;
        if (node.children.length > 0) count += countBookmarks(node.children);
    }
    return count;
}

export function getAllBookmarks(nodes: FolderTreeNode[]): Bookmark[] {
    const bookmarks: Bookmark[] = [];
    for (const node of nodes) {
        bookmarks.push(...node.bookmarks);
        if (node.children.length > 0) bookmarks.push(...getAllBookmarks(node.children));
    }
    return bookmarks;
}

export function filterBookmarks(params: {
    bookmarks: Bookmark[];
    query?: string;
    platform?: string;
}): Bookmark[] {
    const query = params.query?.trim().toLowerCase() ?? '';
    const platform = params.platform?.trim() ?? '';

    return params.bookmarks.filter((b) => {
        if (platform && platform !== 'All' && b.platform !== platform) return false;
        if (!query) return true;
        const ai = b.aiResponse ?? '';
        return (
            b.title.toLowerCase().includes(query)
            || b.userMessage.toLowerCase().includes(query)
            || ai.toLowerCase().includes(query)
        );
    });
}

