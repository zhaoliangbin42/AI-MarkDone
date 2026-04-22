import type { ReaderItem } from '../../../services/reader/types';
import type { ChatGPTConversationSnapshot } from './types';

export type BuildChatGPTReaderItemsResult = {
    items: ReaderItem[];
    startIndex: number;
};

function stripHash(url: string): string {
    try {
        const parsed = new URL(url);
        parsed.hash = '';
        return `${parsed.origin}${parsed.pathname}${parsed.search}`;
    } catch {
        return url.split('#')[0] || url;
    }
}

export function buildChatGPTReaderItems(
    snapshot: ChatGPTConversationSnapshot,
    startMessageId?: string | null,
    pageUrl: string = window.location.href
): BuildChatGPTReaderItemsResult {
    const normalizedUrl = stripHash(pageUrl);
    const items: ReaderItem[] = snapshot.rounds.map((round) => ({
        id: `chatgpt-${round.messageId ?? round.id}`,
        userPrompt: round.userPrompt,
        content: round.assistantContent,
        meta: {
            platformId: 'chatgpt',
            messageId: round.messageId,
            position: round.position,
            url: normalizedUrl,
            bookmarkable: true,
            bookmarked: false,
        },
    }));

    const normalizedMessageId = typeof startMessageId === 'string' && startMessageId.trim() ? startMessageId.trim() : null;
    const startIndexRaw = normalizedMessageId
        ? items.findIndex((item) => item.meta?.messageId === normalizedMessageId)
        : -1;
    const startIndex = startIndexRaw >= 0 ? startIndexRaw : Math.max(0, items.length - 1);
    return { items, startIndex };
}
