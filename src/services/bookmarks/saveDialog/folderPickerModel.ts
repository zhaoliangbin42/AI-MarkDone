import type { Bookmark, Folder, FolderTreeNode } from '../../../core/bookmarks/types';
import { PathUtils } from '../../../core/bookmarks/path';
import { buildFolderTree } from '../../../core/bookmarks/tree';
import type { FolderPickerNodeViewModel, FolderPickerViewModel } from './types';

function mapNode(node: FolderTreeNode): FolderPickerNodeViewModel {
    return {
        path: node.folder.path,
        name: node.folder.name,
        depth: node.folder.depth,
        isExpanded: node.isExpanded,
        isSelected: node.isSelected,
        canCreateSubfolder: node.folder.depth < PathUtils.MAX_DEPTH,
        children: node.children.map(mapNode),
    };
}

export function canCreateSubfolder(path: string): boolean {
    try {
        const depth = PathUtils.getDepth(path);
        return depth < PathUtils.MAX_DEPTH;
    } catch {
        return false;
    }
}

export function buildFolderPickerVm(params: {
    folders: Folder[];
    bookmarks?: Bookmark[];
    expandedPaths: Set<string>;
    selectedPath: string | null;
}): FolderPickerViewModel {
    const tree = buildFolderTree({
        folders: params.folders,
        bookmarks: params.bookmarks ?? [],
        expandedPaths: params.expandedPaths,
        selectedPath: params.selectedPath,
        sortMode: 'alpha-asc',
    });

    return {
        nodes: tree.map(mapNode),
        selectedPath: params.selectedPath,
        expandedPaths: params.expandedPaths,
    };
}

