/**
 * Simple bookmark storage.
 */

import { Bookmark } from './types';
import { logger } from '../../utils/logger';
import { StorageQueue } from './StorageQueue';
import { SettingsManager } from '../../settings/SettingsManager';
import { browser, browserCompat } from '../../utils/browser';

export class SimpleBookmarkStorage {
    // Storage quota thresholds
    static readonly STORAGE_LIMIT = 10 * 1024 * 1024; // 10MB (chrome.storage.local default)
    static readonly QUOTA_WARNING_THRESHOLD = 0.95;   // 95% - show auto-dismiss warning
    static readonly QUOTA_CRITICAL_THRESHOLD = 0.98;  // 98% - block save

    private static getKey(url: string, position: number): string {
        const urlWithoutProtocol = url.replace(/^https?:\/\//, '');
        return `bookmark:${urlWithoutProtocol}:${position}`;
    }

    /**
     * Truncate text to context-only format (250 front + 250 back)
     * Used when saveContextOnly setting is enabled
     */
    private static truncateContext(text: string): string {
        if (text.length <= 500) {
            return text;
        }

        const front = text.slice(0, 250);
        const back = text.slice(-250);
        return `${front} ... ${back}`;
    }

    /**
     * Get current storage usage in bytes
     * Uses chrome.storage.local.getBytesInUse API
     */
    static async getBytesInUse(): Promise<number> {
        return browserCompat.getBytesInUse(null);
    }

    /**
     * Format bytes to human-readable string (KB/MB)
     * @param bytes - Number of bytes
     * @param decimals - Number of decimal places (default: 1)
     */
    static formatBytes(bytes: number, decimals = 1): string {
        if (bytes === 0) return '0 B';

        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));

        return parseFloat((bytes / Math.pow(k, i)).toFixed(decimals)) + ' ' + sizes[i];
    }

    /**
     * Save a bookmark
     */
    static async save(
        url: string,
        position: number,
        userMessage: string,
        aiResponse?: string,
        title?: string,
        platform?: string,
        timestamp?: number,
        folderPath?: string
    ): Promise<void> {
        const key = this.getKey(url, position);
        const urlWithoutProtocol = url.replace(/^https?:\/\//, '');

        // Check settings: should we save context only?
        const settings = await SettingsManager.getInstance().get('behavior');

        // Determine AI response content based on settings
        let finalUserMessage = userMessage;
        let finalAiResponse = aiResponse;

        if (settings.saveContextOnly) {
            finalUserMessage = this.truncateContext(userMessage);
            finalAiResponse = aiResponse ? this.truncateContext(aiResponse) : undefined;
            logger.debug('[SimpleBookmarkStorage] Context-only mode: truncated content');
        }

        const value: Bookmark = {
            url,
            urlWithoutProtocol,
            position,
            userMessage: finalUserMessage,
            aiResponse: finalAiResponse,
            timestamp: timestamp || Date.now(),
            title: title || userMessage.substring(0, 50) + (userMessage.length > 50 ? '...' : ''),
            platform: platform || 'ChatGPT',
            folderPath: folderPath || 'Import'
        };

        await StorageQueue.getInstance().enqueue(async () => {
            try {
                await browser.storage.local.set({ [key]: value });
                logger.info(`[SimpleBookmarkStorage] Saved bookmark at position ${position}`);
            } catch (error) {
                logger.error('[SimpleBookmarkStorage] Failed to save bookmark:', error);
                throw error;
            }
        });
    }

    /**
     * Remove a bookmark
     */
    static async remove(url: string, position: number): Promise<void> {
        const key = this.getKey(url, position);

        await StorageQueue.getInstance().enqueue(async () => {
            try {
                await browser.storage.local.remove(key);
                logger.info(`[SimpleBookmarkStorage] Removed bookmark at position ${position}`);
            } catch (error) {
                logger.error('[SimpleBookmarkStorage] Failed to remove bookmark:', error);
                throw error;
            }
        });
    }

    /**
     * Check if a position is bookmarked
     */
    static async isBookmarked(url: string, position: number): Promise<boolean> {
        try {
            const key = this.getKey(url, position);
            const result = await browser.storage.local.get(key);
            return !!result[key];
        } catch (error) {
            logger.error('[SimpleBookmarkStorage] Failed to check bookmark:', error);
            return false;
        }
    }

    /**
     * Load all bookmarked positions for current URL.
     */
    static async loadAllPositions(url: string): Promise<Set<number>> {
        try {
            const urlWithoutProtocol = url.replace(/^https?:\/\//, '');
            const prefix = `bookmark:${urlWithoutProtocol}:`;

            // Get all storage items
            const all = await browser.storage.local.get(null);
            const positions = new Set<number>();

            // Extract positions from matching keys
            Object.keys(all).forEach(key => {
                if (key.startsWith(prefix)) {
                    const posStr = key.substring(prefix.length);
                    const pos = parseInt(posStr, 10);
                    if (!isNaN(pos)) {
                        positions.add(pos);
                    }
                }
            });

            logger.info(`[SimpleBookmarkStorage] Loaded ${positions.size} bookmarks for current page`);
            return positions;
        } catch (error) {
            logger.error('[SimpleBookmarkStorage] Failed to load bookmarks:', error);
            return new Set();
        }
    }

    /**
     * Update an existing bookmark
     */
    static async updateBookmark(
        url: string,
        position: number,
        updates: Partial<Omit<Bookmark, 'url' | 'urlWithoutProtocol' | 'position'>>
    ): Promise<void> {
        const key = this.getKey(url, position);

        await StorageQueue.getInstance().enqueue(async () => {
            try {
                const result = await browser.storage.local.get(key);
                const existing = result[key] as Bookmark;

                if (!existing) {
                    throw new Error(`Bookmark not found at position ${position}`);
                }

                // Merge updates with existing bookmark
                const updated: Bookmark = {
                    ...existing,
                    ...updates
                };

                await browser.storage.local.set({ [key]: updated });
                logger.info(`[SimpleBookmarkStorage] Updated bookmark at position ${position}`);
            } catch (error) {
                logger.error('[SimpleBookmarkStorage] Failed to update bookmark:', error);
                throw error;
            }
        });
    }

    /**
     * Get all bookmarks across all URLs
     */
    static async getAllBookmarks(): Promise<Bookmark[]> {
        try {
            const all = await browser.storage.local.get(null);
            const bookmarks: Bookmark[] = [];

            Object.keys(all).forEach(key => {
                if (key.startsWith('bookmark:')) {
                    bookmarks.push(all[key] as Bookmark);
                }
            });

            // Sort by timestamp (newest first)
            bookmarks.sort((a, b) => b.timestamp - a.timestamp);

            logger.info(`[SimpleBookmarkStorage] Loaded ${bookmarks.length} total bookmarks`);
            return bookmarks;
        } catch (error) {
            logger.error('[SimpleBookmarkStorage] Failed to get all bookmarks:', error);
            return [];
        }
    }

    /**
     * Check storage quota usage
     */
    static async checkStorageQuota(): Promise<{ used: number; limit: number; percentage: number }> {
        try {
            const used = await browserCompat.getBytesInUse();
            const limit = this.STORAGE_LIMIT;
            const percentage = (used / limit) * 100;

            logger.debug(`[SimpleBookmarkStorage] Storage usage: ${used} bytes (${percentage.toFixed(2)}%)`);

            return { used, limit, percentage };
        } catch (error) {
            logger.error('[SimpleBookmarkStorage] Failed to check storage quota:', error);
            return { used: 0, limit: this.STORAGE_LIMIT, percentage: 0 };
        }
    }

    /**
     * Check if a save operation can proceed
     * Returns warning level and message based on current storage usage
     */
    static async canSave(): Promise<{
        canSave: boolean;
        warningLevel: 'none' | 'warning' | 'critical';
        usedPercentage: number;
        message?: string;
    }> {
        try {
            const { percentage } = await this.checkStorageQuota();
            const usedPercentage = percentage;

            if (percentage >= this.QUOTA_CRITICAL_THRESHOLD * 100) {
                return {
                    canSave: false,
                    warningLevel: 'critical',
                    usedPercentage,
                    message: `Storage is ${percentage.toFixed(1)}% full. Please export and delete some bookmarks to continue.`
                };
            }

            if (percentage >= this.QUOTA_WARNING_THRESHOLD * 100) {
                return {
                    canSave: true,
                    warningLevel: 'warning',
                    usedPercentage,
                    message: `Storage is ${percentage.toFixed(1)}% full. Consider exporting bookmarks soon.`
                };
            }

            return {
                canSave: true,
                warningLevel: 'none',
                usedPercentage
            };
        } catch (error) {
            logger.error('[SimpleBookmarkStorage] Failed to check if can save:', error);
            // On error, allow save but don't show warning
            return { canSave: true, warningLevel: 'none', usedPercentage: 0 };
        }
    }

    /**
     * Estimate the storage size of a bookmark in bytes
     * Uses JSON.stringify to get approximate size
     */
    static estimateBookmarkSize(bookmark: Bookmark): number {
        try {
            const key = this.getKey(bookmark.url, bookmark.position);
            const keySize = key.length;
            const valueSize = JSON.stringify(bookmark).length;
            return keySize + valueSize;
        } catch {
            return 0;
        }
    }

    /**
     * Check if importing bookmarks would exceed storage quota
     * @param bookmarks - Bookmarks to import (after deduplication)
     * @returns Whether import can proceed and estimated usage after import
     */
    static async canImport(bookmarks: Bookmark[]): Promise<{
        canImport: boolean;
        estimatedBytes: number;
        currentUsed: number;
        projectedPercentage: number;
        message?: string;
    }> {
        try {
            const { used } = await this.checkStorageQuota();

            // Estimate size of all bookmarks to import
            const estimatedBytes = bookmarks.reduce(
                (sum, bookmark) => sum + this.estimateBookmarkSize(bookmark),
                0
            );

            const projectedUsed = used + estimatedBytes;
            const projectedPercentage = (projectedUsed / this.STORAGE_LIMIT) * 100;

            if (projectedPercentage >= this.QUOTA_CRITICAL_THRESHOLD * 100) {
                const estimatedKB = (estimatedBytes / 1024).toFixed(1);
                const availableKB = ((this.STORAGE_LIMIT * this.QUOTA_CRITICAL_THRESHOLD - used) / 1024).toFixed(1);
                return {
                    canImport: false,
                    estimatedBytes,
                    currentUsed: used,
                    projectedPercentage,
                    message: `Import requires ~${estimatedKB}KB but only ${availableKB}KB available. Please export and delete some bookmarks first.`
                };
            }

            return {
                canImport: true,
                estimatedBytes,
                currentUsed: used,
                projectedPercentage
            };
        } catch (error) {
            logger.error('[SimpleBookmarkStorage] Failed to check if can import:', error);
            return { canImport: true, estimatedBytes: 0, currentUsed: 0, projectedPercentage: 0 };
        }
    }

    /**
     * Bulk save multiple bookmarks in single atomic operation
     * Bypasses StorageQueue for performance - use only for batch import
     * 
     * @param bookmarks - Array of bookmarks to save
     * @returns Number of bookmarks saved
     * @throws Error if storage operation fails
     */
    static async bulkSave(bookmarks: Bookmark[]): Promise<number> {
        if (!bookmarks || bookmarks.length === 0) {
            logger.debug('[SimpleBookmarkStorage] bulkSave called with empty array');
            return 0;
        }

        const perfStart = performance.now();
        const data: Record<string, Bookmark> = {};

        for (const bookmark of bookmarks) {
            const key = this.getKey(bookmark.url, bookmark.position);
            const urlWithoutProtocol = bookmark.url.replace(/^https?:\/\//, '');

            // Normalize and validate bookmark data
            data[key] = {
                url: bookmark.url,
                urlWithoutProtocol,
                position: bookmark.position,
                userMessage: bookmark.userMessage,
                aiResponse: bookmark.aiResponse,
                timestamp: bookmark.timestamp || Date.now(),
                title: bookmark.title || bookmark.userMessage?.substring(0, 50) || 'Untitled',
                platform: bookmark.platform || 'ChatGPT',
                folderPath: bookmark.folderPath || 'Import'
            };
        }

        try {
            await browser.storage.local.set(data);
            const perfEnd = performance.now();
            logger.info(`[SimpleBookmarkStorage] Bulk saved ${bookmarks.length} bookmarks in ${(perfEnd - perfStart).toFixed(0)}ms`);
            return bookmarks.length;
        } catch (error) {
            logger.error('[SimpleBookmarkStorage] Bulk save failed:', error);
            throw error;
        }
    }

    /**
     * Bulk remove multiple bookmarks in single atomic operation
     * Bypasses StorageQueue for performance - use only for batch delete
     * 
     * @param bookmarks - Array of bookmark identifiers (url + position)
     * @returns Number of bookmarks removed
     */
    static async bulkRemove(bookmarks: { url: string, position: number }[]): Promise<number> {
        if (!bookmarks || bookmarks.length === 0) {
            logger.debug('[SimpleBookmarkStorage] bulkRemove called with empty array');
            return 0;
        }

        const perfStart = performance.now();
        const keys = bookmarks.map(b => this.getKey(b.url, b.position));

        try {
            await browser.storage.local.remove(keys);
            const perfEnd = performance.now();
            logger.info(`[SimpleBookmarkStorage] Bulk removed ${bookmarks.length} bookmarks in ${(perfEnd - perfStart).toFixed(0)}ms`);
            return bookmarks.length;
        } catch (error) {
            logger.error('[SimpleBookmarkStorage] Bulk remove failed:', error);
            throw error;
        }
    }

    /**
     * Validate bookmark data
     */
    static validateBookmark(bookmark: any): bookmark is Bookmark {
        const isValid = (
            typeof bookmark === 'object' &&
            bookmark !== null &&
            typeof bookmark.url === 'string' &&
            typeof bookmark.position === 'number' &&
            typeof bookmark.userMessage === 'string' &&
            typeof bookmark.timestamp === 'number' &&
            (bookmark.aiResponse === undefined || typeof bookmark.aiResponse === 'string') &&
            (bookmark.title === undefined || typeof bookmark.title === 'string') &&
            (bookmark.platform === undefined || typeof bookmark.platform === 'string') &&
            (bookmark.folderPath === undefined || typeof bookmark.folderPath === 'string') &&
            (bookmark.urlWithoutProtocol === undefined || typeof bookmark.urlWithoutProtocol === 'string')
        );

        if (!isValid) {
            logger.warn('[validateBookmark] Failed validation:', {
                hasUrl: typeof bookmark?.url,
                hasPosition: typeof bookmark?.position,
                hasUserMessage: typeof bookmark?.userMessage,
                hasTimestamp: typeof bookmark?.timestamp,
                platform: bookmark?.platform
            });
        }

        return isValid;
    }

    /**
     * Repair corrupted bookmarks
     */
    static async repairBookmarks(): Promise<{ repaired: number; removed: number }> {
        try {
            const all = await browser.storage.local.get(null);
            let repaired = 0;
            let removed = 0;

            for (const key of Object.keys(all)) {
                if (!key.startsWith('bookmark:')) continue;

                const bookmark = all[key];

                // Validate bookmark
                if (!this.validateBookmark(bookmark)) {
                    logger.warn(`[SimpleBookmarkStorage] Invalid bookmark found: ${key}`);

                    // Try to repair
                    if (typeof bookmark === 'object' && bookmark !== null) {
                        const bm = bookmark as any;
                        const repairedBookmark: Bookmark = {
                            url: bm.url || '',
                            urlWithoutProtocol: bm.urlWithoutProtocol || bm.url?.replace(/^https?:\/\//, '') || '',
                            position: bm.position || 0,
                            userMessage: bm.userMessage || '',
                            aiResponse: bm.aiResponse,
                            timestamp: bm.timestamp || Date.now(),
                            title: bm.title || bm.userMessage?.substring(0, 50) || 'Untitled',
                            platform: bm.platform || 'ChatGPT',
                            folderPath: bm.folderPath || 'Import'
                        };

                        if (this.validateBookmark(repairedBookmark)) {
                            await browser.storage.local.set({ [key]: repairedBookmark });
                            repaired++;
                            logger.info(`[SimpleBookmarkStorage] Repaired bookmark: ${key}`);
                        } else {
                            await browser.storage.local.remove(key);
                            removed++;
                            logger.warn(`[SimpleBookmarkStorage] Removed irreparable bookmark: ${key}`);
                        }
                    } else {
                        await browser.storage.local.remove(key);
                        removed++;
                    }
                }
            }

            logger.info(`[SimpleBookmarkStorage] Repair complete: ${repaired} repaired, ${removed} removed`);
            return { repaired, removed };
        } catch (error) {
            logger.error('[SimpleBookmarkStorage] Failed to repair bookmarks:', error);
            return { repaired: 0, removed: 0 };
        }
    }

    /**
     * Get bookmarks by folder path
     * 
     * @param folderPath Folder path to filter by
     * @param recursive Include bookmarks in subfolders
     */
    static async getBookmarksByFolder(folderPath: string, recursive: boolean = false): Promise<Bookmark[]> {
        try {
            const allBookmarks = await this.getAllBookmarks();

            if (recursive) {
                // Import PathUtils dynamically to avoid circular dependency
                const { PathUtils } = await import('../utils/path-utils');
                return allBookmarks.filter(b =>
                    b.folderPath === folderPath ||
                    PathUtils.isDescendantOf(b.folderPath, folderPath)
                );
            } else {
                return allBookmarks.filter(b => b.folderPath === folderPath);
            }
        } catch (error) {
            logger.error(`[SimpleBookmarkStorage] Failed to get bookmarks by folder: ${folderPath}`, error);
            return [];
        }
    }

    /**
     * Move bookmark to a different folder
     * 
     * @param url Bookmark URL
     * @param position Bookmark position
     * @param newFolderPath New folder path
     */
    static async moveToFolder(url: string, position: number, newFolderPath: string): Promise<void> {
        const key = this.getKey(url, position);

        await StorageQueue.getInstance().enqueue(async () => {
            try {
                const result = await browser.storage.local.get(key);
                const bookmark = result[key] as Bookmark;

                if (!bookmark) {
                    throw new Error(`Bookmark not found: ${url}:${position}`);
                }

                bookmark.folderPath = newFolderPath;
                await browser.storage.local.set({ [key]: bookmark });

                logger.info(`[SimpleBookmarkStorage] Moved bookmark to folder: ${newFolderPath}`);
            } catch (error) {
                logger.error('[SimpleBookmarkStorage] Failed to move bookmark to folder:', error);
                throw error;
            }
        });
    }
}
