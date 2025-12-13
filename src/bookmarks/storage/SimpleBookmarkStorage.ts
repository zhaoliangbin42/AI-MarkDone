/**
 * Simple Bookmark Storage - Based on AITimeline Pattern
 * Direct chrome.storage operations, no complex abstractions
 */

import { Bookmark } from './types';
import { logger } from '../../utils/logger';

/**
 * Simple bookmark storage using AITimeline's proven pattern
 */
export class SimpleBookmarkStorage {
    /**
     * Generate storage key - AITimeline format
     */
    private static getKey(url: string, position: number): string {
        const urlWithoutProtocol = url.replace(/^https?:\/\//, '');
        return `bookmark:${urlWithoutProtocol}:${position}`;
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
        platform?: 'ChatGPT' | 'Gemini',
        timestamp?: number
    ): Promise<void> {
        try {
            const key = this.getKey(url, position);
            const urlWithoutProtocol = url.replace(/^https?:\/\//, '');

            const value: Bookmark = {
                url,
                urlWithoutProtocol,
                position,
                userMessage,
                aiResponse,
                timestamp: timestamp || Date.now(),
                title: title || userMessage.substring(0, 50) + (userMessage.length > 50 ? '...' : ''),
                platform
            };

            await chrome.storage.local.set({ [key]: value });
            logger.info(`[SimpleBookmarkStorage] Saved bookmark at position ${position}`);
        } catch (error) {
            logger.error('[SimpleBookmarkStorage] Failed to save bookmark:', error);
            throw error;
        }
    }

    /**
     * Remove a bookmark
     */
    static async remove(url: string, position: number): Promise<void> {
        try {
            const key = this.getKey(url, position);
            await chrome.storage.local.remove(key);
            logger.info(`[SimpleBookmarkStorage] Removed bookmark at position ${position}`);
        } catch (error) {
            logger.error('[SimpleBookmarkStorage] Failed to remove bookmark:', error);
            throw error;
        }
    }

    /**
     * Check if a position is bookmarked
     */
    static async isBookmarked(url: string, position: number): Promise<boolean> {
        try {
            const key = this.getKey(url, position);
            const result = await chrome.storage.local.get(key);
            return !!result[key];
        } catch (error) {
            logger.error('[SimpleBookmarkStorage] Failed to check bookmark:', error);
            return false;
        }
    }

    /**
     * Load all bookmarked positions for current URL
     * Returns a Set of positions - AITimeline pattern
     */
    static async loadAllPositions(url: string): Promise<Set<number>> {
        try {
            const urlWithoutProtocol = url.replace(/^https?:\/\//, '');
            const prefix = `bookmark:${urlWithoutProtocol}:`;

            // Get all storage items
            const all = await chrome.storage.local.get(null);
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
        try {
            const key = this.getKey(url, position);
            const result = await chrome.storage.local.get(key);
            const existing = result[key] as Bookmark;

            if (!existing) {
                throw new Error(`Bookmark not found at position ${position}`);
            }

            // Merge updates with existing bookmark
            const updated: Bookmark = {
                ...existing,
                ...updates
            };

            await chrome.storage.local.set({ [key]: updated });
            logger.info(`[SimpleBookmarkStorage] Updated bookmark at position ${position}`);
        } catch (error) {
            logger.error('[SimpleBookmarkStorage] Failed to update bookmark:', error);
            throw error;
        }
    }

    /**
     * Get all bookmarks across all URLs
     */
    static async getAllBookmarks(): Promise<Bookmark[]> {
        try {
            const all = await chrome.storage.local.get(null);
            const bookmarks: Bookmark[] = [];

            Object.keys(all).forEach(key => {
                if (key.startsWith('bookmark:')) {
                    bookmarks.push(all[key]);
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
            const used = await chrome.storage.local.getBytesInUse();
            const limit = 5 * 1024 * 1024; // 5MB for chrome.storage.local
            const percentage = (used / limit) * 100;

            logger.info(`[SimpleBookmarkStorage] Storage usage: ${used} bytes (${percentage.toFixed(2)}%)`);

            return { used, limit, percentage };
        } catch (error) {
            logger.error('[SimpleBookmarkStorage] Failed to check storage quota:', error);
            return { used: 0, limit: 5 * 1024 * 1024, percentage: 0 };
        }
    }

    /**
     * Validate bookmark data
     */
    static validateBookmark(bookmark: any): bookmark is Bookmark {
        return (
            typeof bookmark === 'object' &&
            bookmark !== null &&
            typeof bookmark.url === 'string' &&
            typeof bookmark.urlWithoutProtocol === 'string' &&
            typeof bookmark.position === 'number' &&
            typeof bookmark.userMessage === 'string' &&
            typeof bookmark.timestamp === 'number' &&
            (bookmark.aiResponse === undefined || typeof bookmark.aiResponse === 'string') &&
            (bookmark.title === undefined || typeof bookmark.title === 'string') &&
            (bookmark.notes === undefined || typeof bookmark.notes === 'string') &&
            (bookmark.platform === undefined || bookmark.platform === 'ChatGPT' || bookmark.platform === 'Gemini')
        );
    }

    /**
     * Repair corrupted bookmarks
     */
    static async repairBookmarks(): Promise<{ repaired: number; removed: number }> {
        try {
            const all = await chrome.storage.local.get(null);
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
                        const repairedBookmark: Bookmark = {
                            url: bookmark.url || '',
                            urlWithoutProtocol: bookmark.urlWithoutProtocol || bookmark.url?.replace(/^https?:\/\//, '') || '',
                            position: bookmark.position || 0,
                            userMessage: bookmark.userMessage || '',
                            aiResponse: bookmark.aiResponse,
                            timestamp: bookmark.timestamp || Date.now(),
                            title: bookmark.title,
                            notes: bookmark.notes,
                            platform: bookmark.platform
                        };

                        if (this.validateBookmark(repairedBookmark)) {
                            await chrome.storage.local.set({ [key]: repairedBookmark });
                            repaired++;
                            logger.info(`[SimpleBookmarkStorage] Repaired bookmark: ${key}`);
                        } else {
                            await chrome.storage.local.remove(key);
                            removed++;
                            logger.warn(`[SimpleBookmarkStorage] Removed irreparable bookmark: ${key}`);
                        }
                    } else {
                        await chrome.storage.local.remove(key);
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
}
