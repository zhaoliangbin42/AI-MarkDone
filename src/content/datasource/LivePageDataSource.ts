/**
 * 实时页面数据源适配器
 * 
 * 职责：
 * - 调用 MessageCollector 收集页面上的消息 DOM
 * - 将 DOM 元素包装为 ReaderItem（带懒加载闭包）
 * - 与 ReaderPanel 完全解耦
 */

import { MessageCollector, MessageRef } from '../utils/MessageCollector';
import { ReaderItem } from '../types/ReaderTypes';
import { adapterRegistry } from '../adapters/registry';

export type GetMarkdownFn = (element: HTMLElement) => string;

/**
 * 从当前页面收集消息并转换为 ReaderItem[]
 * 
 * @param getMarkdown - 用于将 DOM 转换为 Markdown 的函数
 * @returns ReaderItem[] - 标准化的阅读器数据
 */
export function collectFromLivePage(getMarkdown: GetMarkdownFn): ReaderItem[] {
    const messageRefs = MessageCollector.collectMessages();

    // 获取平台图标
    const adapter = adapterRegistry.getAdapter();
    const platformIcon = adapter?.getIcon() || getDefaultIcon();
    // 从 URL 推断平台名称
    const platform = window.location.hostname.includes('gemini') ? 'Gemini' :
        window.location.hostname.includes('chatgpt') ? 'ChatGPT' : 'AI';

    return messageRefs.map((ref: MessageRef, index: number) => ({
        id: index,
        userPrompt: ref.userPrompt || `Message ${index + 1}`,
        // 懒加载：只有访问时才解析 DOM
        // 注意：不再在此处缓存结果，由 ReaderPanel 的 LRUCache 统一管理
        // 这样可以确保 "Volatile Tail" 策略正确生效
        content: () => getMarkdown(ref.element),
        meta: {
            platform,
            platformIcon
        }
    }));
}

/**
 * 在 ReaderItem[] 中查找目标元素的索引
 */
export function findItemIndex(
    targetElement: HTMLElement,
    messageRefs: MessageRef[]
): number {
    return MessageCollector.findMessageIndex(targetElement, messageRefs);
}

/**
 * 获取原始 MessageRef（用于索引查找）
 */
export function getMessageRefs(): MessageRef[] {
    return MessageCollector.collectMessages();
}

function getDefaultIcon(): string {
    return `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="10"></circle>
        <path d="M12 16v-4M12 8h.01"></path>
    </svg>`;
}
