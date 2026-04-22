import type { ChatGPTConversationSnapshot } from '../../drivers/content/chatgpt/types';
import { buildChatGPTConversationTurns, resolveChatGPTConversationStartIndex, type ChatGPTConversationStartTarget } from '../../drivers/content/chatgpt/chatgptConversationSource';
import type { ReaderItem } from './types';

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
    startTarget?: ChatGPTConversationStartTarget | string | null,
    pageUrl: string = window.location.href
): BuildChatGPTReaderItemsResult {
    const normalizedUrl = stripHash(pageUrl);
    const turns = buildChatGPTConversationTurns(snapshot);
    const items: ReaderItem[] = snapshot.rounds.map((round, index) => ({
        id: `chatgpt-${round.messageId ?? round.id}`,
        userPrompt: round.userPrompt,
        content: turns[index]?.assistant ?? '',
        meta: {
            platformId: 'chatgpt',
            messageId: round.messageId,
            position: round.position,
            url: normalizedUrl,
            bookmarkable: true,
            bookmarked: false,
        },
    }));

    const normalizedTarget: ChatGPTConversationStartTarget | null =
        typeof startTarget === 'string'
            ? { messageId: startTarget }
            : startTarget ?? null;
    const startIndex = resolveChatGPTConversationStartIndex(snapshot, normalizedTarget);
    return { items, startIndex };
}
