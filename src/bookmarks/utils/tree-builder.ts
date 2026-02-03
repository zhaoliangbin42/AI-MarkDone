/**
 * Tree builder for folder hierarchy
 * 
 * Converts flat folder list into hierarchical tree structure for UI rendering.
 * Handles:
 * - Building tree from flat folder list
 * - Attaching bookmarks to folders
 * - Sorting (alphabetical)
 * - Expand/collapse state
 * - Path finding for navigation
 */

import { Folder, Bookmark, FolderTreeNode } from '../storage/types';
import { PathUtils } from './path-utils';

/**
 * Tree builder utility
 */
export class TreeBuilder {
    /**
     * Build folder tree from flat folder list
     * 
     * Algorithm:
     * 1. Sort folders alphabetically by path
     * 2. Create tree nodes for each folder
     * 3. Attach nodes to parents or root
     * 4. Attach bookmarks to folders
     * 5. Sort recursively
     * 
     * @param folders Flat list of folders
     * @param bookmarks All bookmarks
     * @param expandedPaths Set of expanded folder paths
     * @param selectedPath Currently selected folder path
     * @param sortMode Sorting mode for bookmarks ('alphabetical' | 'time')
     * @returns Root-level tree nodes
     */
    static buildTree(
        folders: Folder[],
        bookmarks: Bookmark[],
        expandedPaths: Set<string> = new Set(),
        selectedPath: string | null = null,
        sortMode: 'time-desc' | 'time-asc' | 'alpha-asc' | 'alpha-desc' = 'alpha-asc'
    ): FolderTreeNode[] {
        // Sort folders alphabetically by path (case-insensitive)
        const sortedFolders = [...folders].sort((a, b) =>
            a.path.localeCompare(b.path, undefined, { sensitivity: 'base' })
        );

        // Build tree structure
        const rootNodes: FolderTreeNode[] = [];
        const nodeMap = new Map<string, FolderTreeNode>();

        // Create nodes for all folders
        for (const folder of sortedFolders) {
            const node: FolderTreeNode = {
                folder,
                children: [],
                bookmarks: this.getBookmarksForFolder(folder.path, bookmarks, sortMode),
                isExpanded: expandedPaths.has(folder.path),
                isSelected: folder.path === selectedPath
            };

            nodeMap.set(folder.path, node);

            // Attach to parent or root
            const parentPath = PathUtils.getParentPath(folder.path);
            if (parentPath && nodeMap.has(parentPath)) {
                // Add to parent's children
                nodeMap.get(parentPath)!.children.push(node);
            } else {
                // Root level folder
                rootNodes.push(node);
            }
        }

        // Sort children and bookmarks recursively
        this.sortTreeNodes(rootNodes, sortMode);

        return rootNodes;
    }

    /**
     * Get bookmarks for a specific folder (non-recursive)
     * 
     * @param folderPath Folder path
     * @param bookmarks All bookmarks
     * @param sortMode Sorting mode
     * @returns Bookmarks in this folder only (not subfolders)
     */
    private static getBookmarksForFolder(
        folderPath: string,
        bookmarks: Bookmark[],
        sortMode: 'time-desc' | 'time-asc' | 'alpha-asc' | 'alpha-desc' = 'alpha-asc'
    ): Bookmark[] {
        const filtered = bookmarks.filter(b => b.folderPath === folderPath);

        switch (sortMode) {
            case 'time-desc':
                return filtered.sort((a, b) => b.timestamp - a.timestamp);
            case 'time-asc':
                return filtered.sort((a, b) => a.timestamp - b.timestamp);
            case 'alpha-desc':
                return filtered.sort((a, b) => b.title.localeCompare(a.title, undefined, { sensitivity: 'base' }));
            case 'alpha-asc':
            default:
                return filtered.sort((a, b) => a.title.localeCompare(b.title, undefined, { sensitivity: 'base' }));
        }
    }

    /**
     * Sort tree nodes recursively (alphabetical by folder name)
     * 
     * @param nodes Tree nodes to sort
     * @param sortMode Sorting mode for bookmarks
     */
    private static sortTreeNodes(
        nodes: FolderTreeNode[],
        sortMode: 'time-desc' | 'time-asc' | 'alpha-asc' | 'alpha-desc' = 'alpha-asc'
    ): void {
        // Sort by folder name (case-insensitive)
        nodes.sort((a, b) =>
            a.folder.name.localeCompare(b.folder.name, undefined, { sensitivity: 'base' })
        );

        // Recursively sort children
        for (const node of nodes) {
            if (node.children.length > 0) {
                this.sortTreeNodes(node.children, sortMode);
            }

            // Sort bookmarks within each folder
            if (node.bookmarks.length > 0) {
                switch (sortMode) {
                    case 'time-desc':
                        node.bookmarks.sort((a, b) => b.timestamp - a.timestamp);
                        break;
                    case 'time-asc':
                        node.bookmarks.sort((a, b) => a.timestamp - b.timestamp);
                        break;
                    case 'alpha-desc':
                        node.bookmarks.sort((a, b) =>
                            b.title.localeCompare(a.title, undefined, { sensitivity: 'base' })
                        );
                        break;
                    case 'alpha-asc':
                    default:
                        node.bookmarks.sort((a, b) =>
                            a.title.localeCompare(b.title, undefined, { sensitivity: 'base' })
                        );
                        break;
                }
            }
        }
    }

    /**
     * Flatten tree to list of all nodes (depth-first)
     * 
     * Useful for search and filtering operations.
     * 
     * @param nodes Root nodes
     * @returns Flat list of all nodes
     */
    static flattenTree(nodes: FolderTreeNode[]): FolderTreeNode[] {
        const result: FolderTreeNode[] = [];

        for (const node of nodes) {
            result.push(node);
            if (node.children.length > 0) {
                result.push(...this.flattenTree(node.children));
            }
        }

        return result;
    }

    /**
     * Find path to a specific node (for auto-expand)
     * 
     * Returns array of folder paths from root to target.
     * 
     * @param nodes Root nodes
     * @param targetPath Target folder path
     * @returns Array of paths to expand, or empty if not found
     */
    static findPathToNode(
        nodes: FolderTreeNode[],
        targetPath: string
    ): string[] {
        for (const node of nodes) {
            // Found target
            if (node.folder.path === targetPath) {
                return [targetPath];
            }

            // Search in children
            if (node.children.length > 0) {
                const childPath = this.findPathToNode(node.children, targetPath);
                if (childPath.length > 0) {
                    return [node.folder.path, ...childPath];
                }
            }
        }

        return [];
    }

    /**
     * Find node by path
     * 
     * @param nodes Root nodes
     * @param targetPath Target folder path
     * @returns Node or null if not found
     */
    static findNode(
        nodes: FolderTreeNode[],
        targetPath: string
    ): FolderTreeNode | null {
        for (const node of nodes) {
            if (node.folder.path === targetPath) {
                return node;
            }

            if (node.children.length > 0) {
                const found = this.findNode(node.children, targetPath);
                if (found) return found;
            }
        }

        return null;
    }

    /**
     * Count total bookmarks in tree (recursive)
     * 
     * @param nodes Root nodes
     * @returns Total bookmark count
     */
    static countBookmarks(nodes: FolderTreeNode[]): number {
        let count = 0;

        for (const node of nodes) {
            count += node.bookmarks.length;
            if (node.children.length > 0) {
                count += this.countBookmarks(node.children);
            }
        }

        return count;
    }

    /**
     * Get total bookmark count for a single node (including all descendants)
     * 
     * @param node Tree node
     * @returns Total bookmark count
     */
    static getTotalBookmarkCount(node: FolderTreeNode): number {
        let count = node.bookmarks.length;

        if (node.children.length > 0) {
            count += this.countBookmarks(node.children);
        }

        return count;
    }

    /**
     * Get all bookmarks from tree (flattened)
     * 
     * @param nodes Root nodes
     * @returns All bookmarks in tree
     */
    static getAllBookmarks(nodes: FolderTreeNode[]): Bookmark[] {
        const bookmarks: Bookmark[] = [];

        for (const node of nodes) {
            bookmarks.push(...node.bookmarks);
            if (node.children.length > 0) {
                bookmarks.push(...this.getAllBookmarks(node.children));
            }
        }

        return bookmarks;
    }

    /**
     * Filter tree by search query
     * 
     * Returns new tree with only matching nodes.
     * Automatically expands paths to matching bookmarks.
     * 
     * @param nodes Root nodes
     * @param query Search query (case-insensitive)
     * @returns Filtered tree
     */
    static filterTree(
        nodes: FolderTreeNode[],
        query: string
    ): FolderTreeNode[] {
        if (!query || query.trim().length === 0) {
            return nodes;
        }

        const lowerQuery = query.toLowerCase();
        const filteredNodes: FolderTreeNode[] = [];

        for (const node of nodes) {
            // Filter bookmarks in this folder
            const matchingBookmarks = node.bookmarks.filter(b =>
                b.title.toLowerCase().includes(lowerQuery) ||
                b.userMessage.toLowerCase().includes(lowerQuery) ||
                (b.aiResponse && b.aiResponse.toLowerCase().includes(lowerQuery))
            );

            // Recursively filter children
            const filteredChildren = this.filterTree(node.children, query);

            // Include node if it has matching bookmarks or children
            if (matchingBookmarks.length > 0 || filteredChildren.length > 0) {
                filteredNodes.push({
                    ...node,
                    bookmarks: matchingBookmarks,
                    children: filteredChildren,
                    isExpanded: true // Auto-expand when filtering
                });
            }
        }

        return filteredNodes;
    }

    /**
     * Update node state (expand/collapse, select)
     * 
     * Returns new tree with updated state.
     * 
     * @param nodes Root nodes
     * @param targetPath Path of node to update
     * @param updates State updates
     * @returns New tree with updated state
     */
    static updateNodeState(
        nodes: FolderTreeNode[],
        targetPath: string,
        updates: Partial<Pick<FolderTreeNode, 'isExpanded' | 'isSelected'>>
    ): FolderTreeNode[] {
        return nodes.map(node => {
            if (node.folder.path === targetPath) {
                return { ...node, ...updates };
            }

            if (node.children.length > 0) {
                return {
                    ...node,
                    children: this.updateNodeState(node.children, targetPath, updates)
                };
            }

            return node;
        });
    }

    /**
     * Expand path to specific folder
     * 
     * Returns new tree with all ancestors expanded.
     * 
     * @param nodes Root nodes
     * @param targetPath Path to expand to
     * @returns New tree with path expanded
     */
    static expandPathTo(
        nodes: FolderTreeNode[],
        targetPath: string
    ): FolderTreeNode[] {
        const pathToExpand = this.findPathToNode(nodes, targetPath);

        let updatedNodes = nodes;
        for (const path of pathToExpand) {
            updatedNodes = this.updateNodeState(updatedNodes, path, { isExpanded: true });
        }

        return updatedNodes;
    }

    /**
     * Collapse all nodes
     * 
     * @param nodes Root nodes
     * @returns New tree with all nodes collapsed
     */
    static collapseAll(nodes: FolderTreeNode[]): FolderTreeNode[] {
        return nodes.map(node => ({
            ...node,
            isExpanded: false,
            children: node.children.length > 0 ? this.collapseAll(node.children) : []
        }));
    }
}
