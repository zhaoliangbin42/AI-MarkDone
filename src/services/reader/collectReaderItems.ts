import type { SiteAdapter } from '../../drivers/content/adapters/base';
import type { ReaderItem } from './types';
import { copyMarkdownFromMessage } from '../copy/copy-markdown';
import { collectConversationTurnRefs, type ConversationTurnRef } from '../../drivers/content/conversation/collectConversationTurnRefs';
import { copyMarkdownFromTurn } from '../copy/copy-turn-markdown';

export type CollectReaderItemsResult = {
    items: ReaderItem[];
    startIndex: number;
};

export type GetMarkdownFn = (messageElement: HTMLElement) => string;

function defaultGetMarkdown(adapter: SiteAdapter, messageElement: HTMLElement): string {
    const res = copyMarkdownFromMessage(adapter, messageElement);
    return res.ok ? res.markdown : '';
}

export function stripHash(url: string): string {
    try {
        const parsed = new URL(url);
        parsed.hash = '';
        return `${parsed.origin}${parsed.pathname}${parsed.search}`;
    } catch {
        return url.split('#')[0] || url;
    }
}

export function collectReaderItems(
    adapter: SiteAdapter,
    startMessageElement: HTMLElement,
    getMarkdown?: GetMarkdownFn
): CollectReaderItemsResult {
    const turns = collectConversationTurnRefs(adapter);
    const getMarkdownForEl: GetMarkdownFn = getMarkdown ?? ((el) => defaultGetMarkdown(adapter, el));
    const pageUrl = stripHash(window.location.href);

    const startIndexRaw = turns.findIndex((t) =>
        t.messageEls.some((el) => el === startMessageElement || el.contains(startMessageElement) || startMessageElement.contains(el))
    );
    const startIndex = startIndexRaw >= 0 ? startIndexRaw : Math.max(0, turns.length - 1);

    const items: ReaderItem[] = turns.map((turn, index) =>
        buildReaderItemFromTurn(adapter, turn, index, pageUrl, getMarkdownForEl)
    );

    return { items, startIndex };
}

export function buildReaderItemFromTurn(
    adapter: SiteAdapter,
    turn: ConversationTurnRef,
    index: number,
    pageUrl: string,
    getMarkdown?: GetMarkdownFn
): ReaderItem {
    const messageId = turn.messageId;
    return {
        id: `${adapter.getPlatformId()}-${messageId ?? index}`,
        userPrompt: turn.userPrompt,
        content: () => {
            if (!getMarkdown) {
                const merged = copyMarkdownFromTurn(adapter, turn.messageEls);
                return merged.ok ? merged.markdown : '';
            }
            const parts = turn.messageEls.map((el) => getMarkdown(el).trim()).filter(Boolean);
            return parts.join('\n\n');
        },
        meta: {
            platformId: adapter.getPlatformId(),
            messageId,
            position: index + 1,
            url: pageUrl,
            bookmarkable: true,
            bookmarked: false,
        },
    };
}
