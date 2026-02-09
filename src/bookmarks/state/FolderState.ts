/**
 * Folder state management
 * 
 * Manages:
 * - Expand/collapse state for folders
 * - Last selected folder persistence
 * - Auto-expand for navigation
 */

import { browser } from '../../utils/browser';
import { logger } from '../../utils/logger';
import { PathUtils } from '../utils/path-utils';

/**
 * Folder state manager
 */
export class FolderState {
    /** Storage key for last selected folder */
    private static readonly LAST_SELECTED_KEY = 'lastSelectedFolderPath';

    /** In-memory expanded paths */
    private expandedPaths: Set<string> = new Set();

    /** Currently selected folder path */
    private selectedPath: string | null = null;

    /**
     * Load state from storage
     * 
     * Loads last selected folder and auto-expands path to it.
     */
    async load(): Promise<void> {
        try {
            const result = await browser.storage.local.get(FolderState.LAST_SELECTED_KEY);
            this.selectedPath = (result[FolderState.LAST_SELECTED_KEY] as string) || null;

            // Auto-expand path to selected folder
            if (this.selectedPath) {
                this.expandPathTo(this.selectedPath);
            }
        } catch (error) {
            logger.error('[FolderState] Failed to load state:', error);
        }
    }

    /**
     * Save last selected folder to storage
     * 
     * @param path Folder path
     */
    async saveLastSelected(path: string): Promise<void> {
        try {
            this.selectedPath = path;
            await browser.storage.local.set({ [FolderState.LAST_SELECTED_KEY]: path });
        } catch (error) {
            logger.error('[FolderState] Failed to save last selected:', error);
        }
    }

    /**
     * Toggle folder expand/collapse
     * 
     * @param path Folder path
     */
    toggleExpand(path: string): void {
        if (this.expandedPaths.has(path)) {
            this.expandedPaths.delete(path);
        } else {
            this.expandedPaths.add(path);
        }
    }

    /**
     * Expand folder
     * 
     * @param path Folder path
     */
    expand(path: string): void {
        this.expandedPaths.add(path);
    }

    /**
     * Collapse folder
     * 
     * @param path Folder path
     */
    collapse(path: string): void {
        this.expandedPaths.delete(path);
    }

    /**
     * Expand path to specific folder (all ancestors)
     * 
     * @param targetPath Path to expand to
     */
    expandPathTo(targetPath: string): void {
        const ancestors = PathUtils.getAncestors(targetPath);

        // Expand all ancestors
        for (const ancestor of ancestors) {
            this.expandedPaths.add(ancestor);
        }

        // Expand target itself
        this.expandedPaths.add(targetPath);
    }

    /**
     * Collapse all folders
     */
    collapseAll(): void {
        this.expandedPaths.clear();
    }

    /**
     * Expand all folders
     * 
     * @param allPaths All folder paths
     */
    expandAll(allPaths: string[]): void {
        this.expandedPaths = new Set(allPaths);
    }

    /**
     * Check if folder is expanded
     * 
     * @param path Folder path
     */
    isExpanded(path: string): boolean {
        return this.expandedPaths.has(path);
    }

    /**
     * Get all expanded paths
     */
    getExpandedPaths(): Set<string> {
        return new Set(this.expandedPaths);
    }

    /**
     * Get selected path
     */
    getSelectedPath(): string | null {
        return this.selectedPath;
    }

    /**
     * Set selected path
     * 
     * @param path Folder path (null to clear)
     */
    setSelectedPath(path: string | null): void {
        this.selectedPath = path;
    }

    /**
     * Check if folder is selected
     * 
     * @param path Folder path
     */
    isSelected(path: string): boolean {
        return this.selectedPath === path;
    }

    /**
     * Clear all state
     */
    clear(): void {
        this.expandedPaths.clear();
        this.selectedPath = null;
    }

    /**
     * Get state summary for debugging
     */
    getStateSummary(): {
        expandedCount: number;
        selectedPath: string | null;
        expandedPaths: string[];
    } {
        return {
            expandedCount: this.expandedPaths.size,
            selectedPath: this.selectedPath,
            expandedPaths: Array.from(this.expandedPaths)
        };
    }
}
