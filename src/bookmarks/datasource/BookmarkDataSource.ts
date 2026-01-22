/**
 * 书签数据源适配器
 * 
 * 职责：
 * - 将 Bookmark[] 转换为 ReaderItem[]
 * - 提供静态内容（书签已保存 Markdown，无需懒加载）
 * - 与 ReaderPanel 完全解耦
 */

import { Bookmark } from '../storage/types';
import { ReaderItem } from '../../content/types/ReaderTypes';
import { Icons } from '../../assets/icons';

/**
 * 获取平台图标
 * 
 * @param platform - 平台名称 ('ChatGPT' | 'Gemini' | 'Claude' | 'Deepseek')
 * @returns 对应平台的 SVG 图标
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
 * 将书签数组转换为 ReaderItem[]
 * 
 * @param bookmarks - 书签数组
 * @returns ReaderItem[] - 标准化的阅读器数据
 */
export function fromBookmarks(bookmarks: Bookmark[]): ReaderItem[] {
    return bookmarks.map((bookmark) => ({
        id: `${bookmark.url}:${bookmark.position}`,
        userPrompt: bookmark.userMessage,
        // 书签已保存内容，直接提供字符串（无需懒加载）
        content: bookmark.aiResponse || '(No AI response saved)',
        meta: {
            platform: bookmark.platform, // 'ChatGPT' | 'Gemini'
            platformIcon: getPlatformIcon(bookmark.platform),
            timestamp: bookmark.timestamp
        }
    }));
}

/**
 * 在书签数组中查找指定书签的索引
 * 
 * @param bookmark - 目标书签
 * @param bookmarks - 书签数组
 * @returns 索引，未找到返回 0
 */
export function findBookmarkIndex(bookmark: Bookmark, bookmarks: Bookmark[]): number {
    const index = bookmarks.findIndex(
        b => b.url === bookmark.url && b.position === bookmark.position
    );
    return index >= 0 ? index : 0;
}
