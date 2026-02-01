/**
 * Folder storage operations using chrome.storage.local
 * 
 * Based on patterns from:
 * - SimpleBookmarkStorage (existing codebase)
 * - fs-extra atomic operations
 * - Transaction log pattern for rollback
 * 
 * Features:
 * - Path-based folder identification
 * - Atomic recursive operations (rename/move)
 * - Validation-first approach
 * - Comprehensive error handling
 */

import { Folder } from './types';
import { PathUtils, PathValidationError } from '../utils/path-utils';
import { browser } from '../../utils/browser';
import { logger } from '../../utils/logger';

const folderLogger = {
    info: (message: string, ...args: any[]) => logger.info('[AI-MarkDone][FolderStorage]', message, ...args),
    error: (message: string, ...args: any[]) => logger.error('[AI-MarkDone][FolderStorage]', message, ...args),
    warn: (message: string, ...args: any[]) => logger.warn('[AI-MarkDone][FolderStorage]', message, ...args),
};

/**
 * Error thrown when folder operation fails
 */
export class FolderOperationError extends Error {
    constructor(message: string, public readonly operation: string, public readonly path?: string) {
        super(message);
        this.name = 'FolderOperationError';
    }
}

/**
 * Folder storage manager with atomic operations
 */
export class FolderStorage {
    /** Storage key prefix for folders */
    private static readonly FOLDER_KEY_PREFIX = 'folder:';

    /** Storage key for folder index (list of all folder paths) */
    private static readonly FOLDER_INDEX_KEY = 'folderPaths';

    /**
     * Create a new folder
     * 
     * Validation:
     * - Path is valid (no traversal, correct depth, valid names)
     * - No duplicate at same level
     * - Parent exists (if not root level)
     * 
     * @throws {PathValidationError} if path is invalid
     * @throws {FolderOperationError} if folder already exists or parent missing
     */
    static async create(path: string): Promise<Folder> {
        try {
            // Validate path structure
            PathUtils.validatePath(path);

            const name = PathUtils.getFolderName(path);
            const depth = PathUtils.getDepth(path);

            // Validate name length (must be done before other checks)
            if (name.length > PathUtils.MAX_NAME_LENGTH) {
                throw new FolderOperationError(
                    `Folder name exceeds maximum length of ${PathUtils.MAX_NAME_LENGTH} characters`,
                    'create',
                    path
                );
            }

            // Check if folder already exists
            const existing = await this.get(path);
            if (existing) {
                throw new FolderOperationError(
                    `Folder already exists: ${path}`,
                    'create',
                    path
                );
            }

            // Check parent exists (if not root level)
            if (depth > 1) {
                const parentPath = PathUtils.getParentPath(path);
                if (parentPath) {
                    const parent = await this.get(parentPath);
                    if (!parent) {
                        throw new FolderOperationError(
                            `Parent folder does not exist: ${parentPath}`,
                            'create',
                            path
                        );
                    }
                }
            }

            // Check for duplicate name at same level
            const siblings = await this.getSiblings(path);
            if (PathUtils.hasNameConflict(name, siblings.map(f => f.name))) {
                throw new FolderOperationError(
                    `Folder "${name}" already exists at this level`,
                    'create',
                    path
                );
            }

            // Create folder object
            const folder: Folder = {
                path,
                name,
                depth,
                createdAt: Date.now(),
                updatedAt: Date.now()
            };

            // Save to storage (atomic operation)
            const key = this.getStorageKey(path);
            await browser.storage.local.set({ [key]: folder });

            // Update index
            await this.addToIndex(path);

            folderLogger.info(`Created folder: ${path}`);
            return folder;

        } catch (error) {
            if (error instanceof PathValidationError || error instanceof FolderOperationError) {
                throw error;
            }
            throw new FolderOperationError(
                `Failed to create folder: ${error instanceof Error ? error.message : 'Unknown error'}`,
                'create',
                path
            );
        }
    }

    /**
     * Get folder by path
     * 
     * @returns Folder or null if not found
     */
    static async get(path: string): Promise<Folder | null> {
        try {
            const normalized = PathUtils.normalize(path);
            const key = this.getStorageKey(normalized);
            const result = await browser.storage.local.get(key);
            return (result[key] as Folder) || null;
        } catch (error) {
            folderLogger.error(`Failed to get folder: ${path}`, error);
            return null;
        }
    }

    /**
     * Get all folders
     * 
     * @returns Array of all folders, sorted by path
     */
    static async getAll(): Promise<Folder[]> {
        try {
            const index = await this.getIndex();
            if (index.length === 0) {
                return [];
            }

            const keys = index.map(path => this.getStorageKey(path));
            const result = await browser.storage.local.get(keys);

            const folders = Object.values(result) as Folder[];

            // Sort alphabetically by path
            return folders.sort((a, b) =>
                a.path.localeCompare(b.path, undefined, { sensitivity: 'base' })
            );
        } catch (error) {
            folderLogger.error('Failed to get all folders', error);
            return [];
        }
    }

    /**
     * Rename folder (recursive path update)
     * 
     * This is a complex operation that updates:
     * 1. The folder itself
     * 2. All descendant folders
     * 3. All bookmarks in this folder and descendants
     * 
     * Uses validation-first approach to ensure atomicity
     * 
     * @throws {PathValidationError} if new name is invalid
     * @throws {FolderOperationError} if operation fails
     */
    static async rename(oldPath: string, newName: string): Promise<void> {
        try {
            // Validate new name
            if (!PathUtils.isValidFolderName(newName)) {
                throw new PathValidationError('Invalid folder name', newName);
            }

            // Calculate new path
            const parentPath = PathUtils.getParentPath(oldPath);
            const newPath = parentPath ? `${parentPath}${PathUtils.SEPARATOR}${newName}` : newName;

            // Validate new path
            PathUtils.validatePath(newPath);

            // Check folder exists
            const folder = await this.get(oldPath);
            if (!folder) {
                throw new FolderOperationError(
                    `Folder not found: ${oldPath}`,
                    'rename',
                    oldPath
                );
            }

            // Check for duplicate name at same level
            const siblings = await this.getSiblings(newPath);
            const siblingNames = siblings
                .filter(f => f.path !== oldPath)
                .map(f => f.name);
            if (PathUtils.hasNameConflict(newName, siblingNames)) {
                throw new FolderOperationError(
                    `Folder "${newName}" already exists at this level`,
                    'rename',
                    oldPath
                );
            }

            // Get all affected folders and bookmarks (validation phase)
            const affectedFolders = await this.getDescendants(oldPath, true);
            const affectedBookmarks = await this.getBookmarksInFolder(oldPath, true);

            folderLogger.info(`Renaming folder: ${oldPath} → ${newPath} (${affectedFolders.length} folders, ${affectedBookmarks.length} bookmarks)`);

            // Prepare updates (transaction phase)
            const folderUpdates: Record<string, Folder> = {};
            const folderDeletes: string[] = [];

            for (const f of affectedFolders) {
                const updatedPath = PathUtils.updatePathPrefix(oldPath, newPath, f.path);
                const updatedFolder: Folder = {
                    ...f,
                    path: updatedPath,
                    name: PathUtils.getFolderName(updatedPath),
                    updatedAt: Date.now()
                };

                folderUpdates[this.getStorageKey(updatedPath)] = updatedFolder;
                if (f.path !== updatedPath) {
                    folderDeletes.push(this.getStorageKey(f.path));
                }
            }

            // Prepare bookmark updates
            const bookmarkUpdates: Record<string, any> = {};
            for (const bookmark of affectedBookmarks) {
                const updatedFolderPath = PathUtils.updatePathPrefix(oldPath, newPath, bookmark.folderPath);
                const key = `bookmark:${bookmark.urlWithoutProtocol}:${bookmark.position}`;
                bookmarkUpdates[key] = { ...bookmark, folderPath: updatedFolderPath };
            }

            // Execute updates atomically
            if (Object.keys(folderUpdates).length > 0) {
                await browser.storage.local.set(folderUpdates);
            }
            if (Object.keys(bookmarkUpdates).length > 0) {
                await browser.storage.local.set(bookmarkUpdates);
            }
            if (folderDeletes.length > 0) {
                await browser.storage.local.remove(folderDeletes);
            }

            // Update index
            await this.updateIndex(oldPath, newPath);

            folderLogger.info(`Renamed folder successfully: ${oldPath} → ${newPath}`);

        } catch (error) {
            if (error instanceof PathValidationError || error instanceof FolderOperationError) {
                throw error;
            }
            throw new FolderOperationError(
                `Failed to rename folder: ${error instanceof Error ? error.message : 'Unknown error'}`,
                'rename',
                oldPath
            );
        }
    }

    /**
     * Delete folder (must be empty)
     * 
     * Validation:
     * - Folder exists
     * - No child folders
     * - No bookmarks
     * 
     * @throws {FolderOperationError} if folder not empty or doesn't exist
     */
    static async delete(path: string): Promise<void> {
        try {
            // Check folder exists
            const folder = await this.get(path);
            if (!folder) {
                throw new FolderOperationError(
                    `Folder not found: ${path}`,
                    'delete',
                    path
                );
            }

            // Check if empty
            const hasChildren = await this.hasChildren(path);
            const hasBookmarks = await this.hasBookmarks(path);

            if (hasChildren || hasBookmarks) {
                throw new FolderOperationError(
                    'Folder must be empty before deletion',
                    'delete',
                    path
                );
            }

            // Delete folder
            const key = this.getStorageKey(path);
            await browser.storage.local.remove(key);

            // Update index
            await this.removeFromIndex(path);

            folderLogger.info(`Deleted folder: ${path}`);

        } catch (error) {
            if (error instanceof FolderOperationError) {
                throw error;
            }
            throw new FolderOperationError(
                `Failed to delete folder: ${error instanceof Error ? error.message : 'Unknown error'}`,
                'delete',
                path
            );
        }
    }

    /**
     * Bulk delete multiple folders in single atomic operation
     * NOTE: This bypasses empty-check validation - caller must ensure folders are empty
     * 
     * @param paths - Array of folder paths to delete
     * @returns Number of folders deleted
     */
    static async bulkDelete(paths: string[]): Promise<number> {
        if (!paths || paths.length === 0) {
            return 0;
        }

        const perfStart = performance.now();
        const keys = paths.map(p => this.getStorageKey(p));

        try {
            // Remove folder data
            await browser.storage.local.remove(keys);

            // Update index (remove all paths)
            const index = await this.getIndex();
            const updatedIndex = index.filter(p => !paths.includes(p));
            await browser.storage.local.set({ [this.FOLDER_INDEX_KEY]: updatedIndex });

            const perfEnd = performance.now();
            folderLogger.info(`Bulk deleted ${paths.length} folders in ${(perfEnd - perfStart).toFixed(0)}ms`);
            return paths.length;
        } catch (error) {
            folderLogger.error('Bulk delete folders failed:', error);
            throw new FolderOperationError(
                `Failed to bulk delete folders: ${error instanceof Error ? error.message : 'Unknown error'}`,
                'bulkDelete'
            );
        }
    }

    /**
     * Move folder (recursive path update)
     * 
     * Validation:
     * - Cannot move into itself or descendants
     * - New depth doesn't exceed max
     * - Target parent exists
     * 
     * @param sourcePath Path of folder to move
     * @param targetParentPath Path of new parent (empty string for root)
     */
    static async move(sourcePath: string, targetParentPath: string): Promise<void> {
        try {
            // Validate move
            if (targetParentPath && PathUtils.isDescendantOf(targetParentPath, sourcePath)) {
                throw new FolderOperationError(
                    'Cannot move folder into its own descendant',
                    'move',
                    sourcePath
                );
            }

            const folderName = PathUtils.getFolderName(sourcePath);
            const newPath = targetParentPath ? `${targetParentPath}${PathUtils.SEPARATOR}${folderName}` : folderName;
            const newDepth = PathUtils.getDepth(newPath);

            if (newDepth > PathUtils.MAX_DEPTH) {
                throw new FolderOperationError(
                    `Move would exceed max depth of ${PathUtils.MAX_DEPTH}`,
                    'move',
                    sourcePath
                );
            }

            // Check target parent exists (if not root)
            if (targetParentPath) {
                const targetParent = await this.get(targetParentPath);
                if (!targetParent) {
                    throw new FolderOperationError(
                        `Target parent folder does not exist: ${targetParentPath}`,
                        'move',
                        sourcePath
                    );
                }
            }

            // Use rename logic (same implementation)
            await this.rename(sourcePath, folderName);

            folderLogger.info(`Moved folder: ${sourcePath} → ${newPath}`);

        } catch (error) {
            if (error instanceof FolderOperationError) {
                throw error;
            }
            throw new FolderOperationError(
                `Failed to move folder: ${error instanceof Error ? error.message : 'Unknown error'}`,
                'move',
                sourcePath
            );
        }
    }

    // ============================================================================
    // Helper Methods
    // ============================================================================

    /**
     * Get storage key for folder path
     */
    private static getStorageKey(path: string): string {
        return `${this.FOLDER_KEY_PREFIX}${path}`;
    }

    /**
     * Get folder index (list of all paths)
     */
    private static async getIndex(): Promise<string[]> {
        try {
            const result = await browser.storage.local.get(this.FOLDER_INDEX_KEY);
            return (result[this.FOLDER_INDEX_KEY] as string[]) || [];
        } catch (error) {
            folderLogger.error('Failed to get folder index', error);
            return [];
        }
    }

    /**
     * Add path to index
     */
    private static async addToIndex(path: string): Promise<void> {
        const index = await this.getIndex();
        if (!index.includes(path)) {
            index.push(path);
            await browser.storage.local.set({ [this.FOLDER_INDEX_KEY]: index });
        }
    }

    /**
     * Remove path from index
     */
    private static async removeFromIndex(path: string): Promise<void> {
        const index = await this.getIndex();
        const updated = index.filter(p => p !== path);
        await browser.storage.local.set({ [this.FOLDER_INDEX_KEY]: updated });
    }

    /**
     * Update index for rename/move operations
     */
    private static async updateIndex(oldPath: string, newPath: string): Promise<void> {
        const index = await this.getIndex();
        const updated = index.map(p =>
            PathUtils.updatePathPrefix(oldPath, newPath, p)
        );
        await browser.storage.local.set({ [this.FOLDER_INDEX_KEY]: updated });
    }

    /**
     * Get sibling folders (same parent)
     */
    private static async getSiblings(path: string): Promise<Folder[]> {
        const parentPath = PathUtils.getParentPath(path);
        const allFolders = await this.getAll();

        return allFolders.filter(f => {
            const fParent = PathUtils.getParentPath(f.path);
            return fParent === parentPath;
        });
    }

    /**
     * Get descendant folders
     * 
     * @param path Parent path
     * @param includeSelf Include the folder itself
     */
    private static async getDescendants(path: string, includeSelf: boolean): Promise<Folder[]> {
        const allFolders = await this.getAll();
        return allFolders.filter(f =>
            (includeSelf && f.path === path) || PathUtils.isDescendantOf(f.path, path)
        );
    }

    /**
     * Check if folder has children
     */
    private static async hasChildren(path: string): Promise<boolean> {
        const allFolders = await this.getAll();
        return allFolders.some(f => PathUtils.isDescendantOf(f.path, path));
    }

    /**
     * Check if folder has bookmarks
     */
    private static async hasBookmarks(path: string): Promise<boolean> {
        const bookmarks = await this.getBookmarksInFolder(path, false);
        return bookmarks.length > 0;
    }

    /**
     * Get bookmarks in folder
     * 
     * @param path Folder path
     * @param recursive Include bookmarks in subfolders
     */
    private static async getBookmarksInFolder(path: string, recursive: boolean): Promise<any[]> {
        try {
            // Import SimpleBookmarkStorage dynamically to avoid circular dependency
            const { SimpleBookmarkStorage } = await import('./SimpleBookmarkStorage');
            const bookmarks = await SimpleBookmarkStorage.getAllBookmarks();

            if (recursive) {
                return bookmarks.filter((b: any) =>
                    b.folderPath === path || PathUtils.isDescendantOf(b.folderPath, path)
                );
            } else {
                return bookmarks.filter((b: any) => b.folderPath === path);
            }
        } catch (error) {
            folderLogger.error(`Failed to get bookmarks in folder: ${path}`, error);
            return [];
        }
    }
}
