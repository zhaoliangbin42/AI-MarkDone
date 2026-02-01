/**
 * Bookmark data source adapter.
 *
 * Responsibilities:
 * - Convert `Bookmark[]` to `ReaderItem[]`.
 * - Provide static content (bookmarks already store Markdown; no lazy loading needed).
 * - Keep fully decoupled from ReaderPanel internals.
 */

import { Bookmark } from '../storage/types';
import { ReaderItem } from '../../content/types/ReaderTypes';
import { Icons } from '../../assets/icons';

/**
 * Get platform icon.
 *
 * @param platform - Platform name ('ChatGPT' | 'Gemini' | 'Claude' | 'Deepseek')
 * @returns SVG icon string
 */
function getPlatformIcon(platform?: string): string {
    const p = platform?.toLowerCase() || 'chatgpt';
    switch (p) {
        case 'gemini':
            return Icons.gemini;
        case 'claude':
            return Icons.claude;
        case 'deepseek':
            return Icons.deepseek;
        default:
            return Icons.chatgpt;
    }
}

/**
 * Convert bookmarks into ReaderItems.
 *
 * @param bookmarks - Bookmark list
 * @returns Normalized ReaderPanel items
 */
export function fromBookmarks(bookmarks: Bookmark[]): ReaderItem[] {
    return bookmarks.map((bookmark) => ({
        id: `${bookmark.url}:${bookmark.position}`,
        userPrompt: bookmark.userMessage,
        content: bookmark.aiResponse || '(No AI response saved)',
        meta: {
            platform: bookmark.platform, // 'ChatGPT' | 'Gemini'
            platformIcon: getPlatformIcon(bookmark.platform),
            timestamp: bookmark.timestamp
        }
    }));
}

/**
 * Find the index of a specific bookmark in a list.
 *
 * @param bookmark - Target bookmark
 * @param bookmarks - Bookmark list
 * @returns Index (0 if not found)
 */
export function findBookmarkIndex(bookmark: Bookmark, bookmarks: Bookmark[]): number {
    const index = bookmarks.findIndex(
        b => b.url === bookmark.url && b.position === bookmark.position
    );
    return index >= 0 ? index : 0;
}
