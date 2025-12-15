/**
 * Folder operations manager
 * 
 * Centralized manager for all folder operations:
 * - Create, rename, delete, move folders
 * - Validation and error handling
 * - Event notifications
 * - Undo/redo support (future)
 */

import { FolderStorage } from '../storage/FolderStorage';
import { Folder } from '../storage/types';
import { PathUtils } from '../utils/path-utils';

/**
 * Operation result
 */
export interface OperationResult {
    success: boolean;
    error?: string;
    data?: any;
}

/**
 * Folder operation event
 */
export type FolderOperationEvent = {
    type: 'create' | 'rename' | 'delete' | 'move';
    path: string;
    newPath?: string;
    timestamp: number;
};

/**
 * Folder operations manager
 */
export class FolderOperationsManager {
    /** Event listeners */
    private listeners: ((event: FolderOperationEvent) => void)[] = [];

    /**
     * Create a new folder
     * 
     * @param parentPath Parent folder path (empty string for root)
     * @param name Folder name
     * @returns Operation result
     */
    async createFolder(parentPath: string, name: string): Promise<OperationResult> {
        try {
            // Validate name
            if (!PathUtils.isValidFolderName(name)) {
                return {
                    success: false,
                    error: 'Invalid folder name. Name cannot contain special characters or be empty.'
                };
            }

            // Build full path
            const path = parentPath ? PathUtils.join(parentPath, name) : name;

            // Validate depth
            const depth = PathUtils.getDepth(path);
            if (depth > PathUtils.MAX_DEPTH) {
                return {
                    success: false,
                    error: `Maximum folder depth is ${PathUtils.MAX_DEPTH} levels.`
                };
            }

            // Create folder
            const folder = await FolderStorage.create(path);

            // Emit event
            this.emitEvent({
                type: 'create',
                path,
                timestamp: Date.now()
            });

            return {
                success: true,
                data: folder
            };

        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to create folder'
            };
        }
    }

    /**
     * Rename a folder
     * 
     * @param path Current folder path
     * @param newName New folder name
     * @returns Operation result
     */
    async renameFolder(path: string, newName: string): Promise<OperationResult> {
        try {
            // Validate new name
            if (!PathUtils.isValidFolderName(newName)) {
                return {
                    success: false,
                    error: 'Invalid folder name. Name cannot contain special characters or be empty.'
                };
            }

            // Calculate new path
            const parentPath = PathUtils.getParentPath(path);
            const newPath = parentPath ? PathUtils.join(parentPath, newName) : newName;

            // Rename folder (handles recursive updates)
            await FolderStorage.rename(path, newName);

            // Emit event
            this.emitEvent({
                type: 'rename',
                path,
                newPath,
                timestamp: Date.now()
            });

            return {
                success: true,
                data: { oldPath: path, newPath }
            };

        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to rename folder'
            };
        }
    }

    /**
     * Delete a folder
     * 
     * @param path Folder path
     * @returns Operation result
     */
    async deleteFolder(path: string): Promise<OperationResult> {
        try {
            // Delete folder (validates empty)
            await FolderStorage.delete(path);

            // Emit event
            this.emitEvent({
                type: 'delete',
                path,
                timestamp: Date.now()
            });

            return {
                success: true
            };

        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to delete folder'
            };
        }
    }

    /**
     * Move a folder
     * 
     * @param sourcePath Source folder path
     * @param targetParentPath Target parent path (empty for root)
     * @returns Operation result
     */
    async moveFolder(sourcePath: string, targetParentPath: string): Promise<OperationResult> {
        try {
            // Move folder (handles recursive updates)
            await FolderStorage.move(sourcePath, targetParentPath);

            // Calculate new path
            const folderName = PathUtils.getFolderName(sourcePath);
            const newPath = targetParentPath ? PathUtils.join(targetParentPath, folderName) : folderName;

            // Emit event
            this.emitEvent({
                type: 'move',
                path: sourcePath,
                newPath,
                timestamp: Date.now()
            });

            return {
                success: true,
                data: { oldPath: sourcePath, newPath }
            };

        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to move folder'
            };
        }
    }

    /**
     * Get all folders
     * 
     * @returns All folders
     */
    async getAllFolders(): Promise<Folder[]> {
        return await FolderStorage.getAll();
    }

    /**
     * Get folder by path
     * 
     * @param path Folder path
     * @returns Folder or null
     */
    async getFolder(path: string): Promise<Folder | null> {
        return await FolderStorage.get(path);
    }

    /**
     * Validate folder name
     * 
     * @param name Folder name
     * @returns Validation result
     */
    validateFolderName(name: string): { valid: boolean; error?: string } {
        if (!PathUtils.isValidFolderName(name)) {
            return {
                valid: false,
                error: 'Invalid folder name. Name cannot contain special characters, be empty, or exceed 50 characters.'
            };
        }

        return { valid: true };
    }

    /**
     * Check if folder can be deleted
     * 
     * @param path Folder path
     * @returns Check result
     */
    async canDelete(path: string): Promise<{ canDelete: boolean; reason?: string }> {
        try {
            const folder = await FolderStorage.get(path);
            if (!folder) {
                return { canDelete: false, reason: 'Folder not found' };
            }

            // Check if has children or bookmarks
            // This will be caught by FolderStorage.delete() validation
            return { canDelete: true };

        } catch (error) {
            return {
                canDelete: false,
                reason: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    }

    /**
     * Check if folder can be moved
     * 
     * @param sourcePath Source folder path
     * @param targetParentPath Target parent path
     * @returns Check result
     */
    canMove(sourcePath: string, targetParentPath: string): { canMove: boolean; reason?: string } {
        // Cannot move into itself
        if (sourcePath === targetParentPath) {
            return { canMove: false, reason: 'Cannot move folder into itself' };
        }

        // Cannot move into descendant
        if (targetParentPath && PathUtils.isDescendantOf(targetParentPath, sourcePath)) {
            return { canMove: false, reason: 'Cannot move folder into its own descendant' };
        }

        // Check depth
        const folderName = PathUtils.getFolderName(sourcePath);
        const newPath = targetParentPath ? PathUtils.join(targetParentPath, folderName) : folderName;
        const newDepth = PathUtils.getDepth(newPath);

        if (newDepth > PathUtils.MAX_DEPTH) {
            return { canMove: false, reason: `Move would exceed maximum depth of ${PathUtils.MAX_DEPTH}` };
        }

        return { canMove: true };
    }

    /**
     * Add event listener
     * 
     * @param listener Event listener function
     */
    addEventListener(listener: (event: FolderOperationEvent) => void): void {
        this.listeners.push(listener);
    }

    /**
     * Remove event listener
     * 
     * @param listener Event listener function
     */
    removeEventListener(listener: (event: FolderOperationEvent) => void): void {
        this.listeners = this.listeners.filter(l => l !== listener);
    }

    /**
     * Emit event to all listeners
     * 
     * @param event Event to emit
     */
    private emitEvent(event: FolderOperationEvent): void {
        for (const listener of this.listeners) {
            try {
                listener(event);
            } catch (error) {
                console.error('[FolderOperationsManager] Event listener error:', error);
            }
        }
    }

    /**
     * Clear all event listeners
     */
    clearEventListeners(): void {
        this.listeners = [];
    }
}
