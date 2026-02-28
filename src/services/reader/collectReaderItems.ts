import type { SiteAdapter } from '../../drivers/content/adapters/base';
import type { ReaderItem } from './types';
import { copyMarkdownFromMessage } from '../copy/copy-markdown';

export type CollectReaderItemsResult = {
    items: ReaderItem[];
    startIndex: number;
};

export type GetMarkdownFn = (messageElement: HTMLElement) => string;

function defaultGetMarkdown(adapter: SiteAdapter, messageElement: HTMLElement): string {
    const res = copyMarkdownFromMessage(adapter, messageElement);
    return res.ok ? res.markdown : '';
}

export function collectReaderItems(
    adapter: SiteAdapter,
    startMessageElement: HTMLElement,
    getMarkdown: GetMarkdownFn = (el) => defaultGetMarkdown(adapter, el)
): CollectReaderItemsResult {
    const selector = adapter.getMessageSelector();
    const container = adapter.getObserverContainer() || document.body;
    const raw = Array.from(container.querySelectorAll(selector)).filter(
        (n): n is HTMLElement => n instanceof HTMLElement
    );
    const messages = Array.from(new Set(raw)).filter((el) => {
        const parent = el.parentElement;
        if (!parent) return true;
        try {
            return parent.closest(selector) === null;
        } catch {
            return true;
        }
    });

    const startIndexRaw = messages.findIndex((m) => m === startMessageElement || m.contains(startMessageElement));
    const startIndex = startIndexRaw >= 0 ? startIndexRaw : Math.max(0, messages.length - 1);

    const items: ReaderItem[] = messages.map((messageElement, index) => {
        const prompt = adapter.extractUserPrompt(messageElement) || `Message ${index + 1}`;
        const messageId = adapter.getMessageId(messageElement);
        return {
            id: `${adapter.getPlatformId()}-${messageId ?? index}`,
            userPrompt: prompt,
            content: () => getMarkdown(messageElement),
            meta: { platformId: adapter.getPlatformId(), messageId },
        };
    });

    return { items, startIndex };
}
