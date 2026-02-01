/**
 * Live page data source adapter.
 *
 * Responsibilities:
 * - Use MessageCollector to collect message DOM nodes.
 * - Wrap DOM nodes as ReaderItems (with lazy content providers).
 * - Keep fully decoupled from ReaderPanel internals.
 */

import { MessageCollector, MessageRef } from '../utils/MessageCollector';
import { ReaderItem } from '../types/ReaderTypes';
import { adapterRegistry } from '../adapters/registry';

export type GetMarkdownFn = (element: HTMLElement) => string;

/**
 * Collect messages from the current page and convert to ReaderItems.
 *
 * @param getMarkdown - Converts DOM nodes to Markdown
 * @returns Normalized ReaderPanel items
 */
export function collectFromLivePage(getMarkdown: GetMarkdownFn): ReaderItem[] {
    const messageRefs = MessageCollector.collectMessages();

    const adapter = adapterRegistry.getAdapter();
    const platformIcon = adapter?.getIcon() || getDefaultIcon();
    const platform = window.location.hostname.includes('gemini') ? 'Gemini' :
        window.location.hostname.includes('chatgpt') ? 'ChatGPT' : 'AI';

    return messageRefs.map((ref: MessageRef, index: number) => ({
        id: index,
        userPrompt: ref.userPrompt || `Message ${index + 1}`,
        // Why: defer DOM-to-Markdown work until the item is opened.
        content: () => getMarkdown(ref.element),
        meta: {
            platform,
            platformIcon
        }
    }));
}

/**
 * Find the index of a target element within collected messages.
 */
export function findItemIndex(
    targetElement: HTMLElement,
    messageRefs: MessageRef[]
): number {
    return MessageCollector.findMessageIndex(targetElement, messageRefs);
}

/**
 * Get raw MessageRefs (used for index lookups).
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
