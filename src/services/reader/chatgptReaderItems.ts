import type { ChatGPTConversationSnapshot } from '../../drivers/content/chatgpt/types';
import { normalizeChatGPTReaderMarkdown } from '../../drivers/content/chatgpt/normalizeReaderMarkdown';
import type { ReaderItem } from './types';
import type { ReaderAnnotationDocument } from '../../contracts/readerAnnotations';

export type ChatGPTConversationStartTarget = {
    position?: number | null;
    positionSource?: 'snapshot';
    messageId?: string | null;
    roundId?: string | null;
    userMessageId?: string | null;
    assistantMessageId?: string | null;
};

export type ChatGPTReaderContentBuildResult = {
    items: ReaderItem[];
    annotationDocument: ReaderAnnotationDocument;
};

type BuildChatGPTReaderItemsResult = ChatGPTReaderContentBuildResult & {
    startIndex: number;
};

function normalizeMessageId(value: unknown): string | null {
    return typeof value === 'string' && value.trim() ? value.trim() : null;
}

export function resolveChatGPTReaderStartIndex(
    snapshot: ChatGPTConversationSnapshot,
    target: ChatGPTConversationStartTarget | null,
): number {
    if (!target) return Math.max(0, snapshot.rounds.length - 1);

    const roundId = normalizeMessageId(target.roundId);
    const userMessageId = normalizeMessageId(target.userMessageId);
    const assistantMessageId = normalizeMessageId(target.assistantMessageId);
    const messageId = normalizeMessageId(target.messageId);
    const hasCanonicalIdentity = Boolean(roundId || userMessageId || assistantMessageId || messageId);
    if (hasCanonicalIdentity) {
        const matches = snapshot.rounds
            .map((round, index) => ({ round, index }))
            .filter(({ round }) => (
                (!roundId || round.id === roundId)
                && (!userMessageId || round.userMessageId === userMessageId)
                && (!assistantMessageId || (round.assistantMessageId ?? round.messageId) === assistantMessageId)
                && (!messageId || round.messageId === messageId || round.assistantMessageId === messageId)
            ));
        return matches.length === 1 ? matches[0]!.index : -1;
    }

    const position = Number(target.position ?? 0);
    if (target.positionSource !== 'snapshot' || !Number.isInteger(position) || position <= 0) return -1;
    const matches = snapshot.rounds
        .map((round, index) => ({ round, index }))
        .filter(({ round }) => round.position === position);
    return matches.length === 1 ? matches[0]!.index : -1;
}

export function normalizeChatGPTReaderPageUrl(url: string): string {
    try {
        const parsed = new URL(url);
        parsed.hash = '';
        return `${parsed.origin}${parsed.pathname}${parsed.search}`;
    } catch {
        return url.split('#')[0] || url;
    }
}

function resolveConversationTitle(): string | null {
    if (typeof document === 'undefined') return null;
    const title = document.title
        .replace(/\s*[|·-]\s*ChatGPT\s*$/i, '')
        .replace(/^ChatGPT\s*[|·-]\s*/i, '')
        .trim();
    return title && !/^chatgpt$/i.test(title) ? title : null;
}

export function buildChatGPTReaderContent(
    snapshot: ChatGPTConversationSnapshot,
    pageUrl: string = window.location.href,
): ChatGPTReaderContentBuildResult {
    const normalizedUrl = normalizeChatGPTReaderPageUrl(pageUrl);
    const items: ReaderItem[] = snapshot.rounds.map((round) => ({
        id: `chatgpt-${round.messageId ?? round.id}`,
        userPrompt: round.userPrompt,
        content: normalizeChatGPTReaderMarkdown(round.assistantContent),
        meta: {
            platformId: 'chatgpt',
            messageId: round.messageId,
            roundId: round.id,
            userMessageId: round.userMessageId,
            assistantMessageId: round.assistantMessageId,
            branchKey: snapshot.branchKey,
            position: round.position,
            url: normalizedUrl,
            bookmarkable: true,
            bookmarked: false,
        },
    }));

    return {
        items,
        annotationDocument: {
            platform: 'chatgpt',
            conversationId: snapshot.conversationId,
            title: resolveConversationTitle(),
            lastKnownUrl: normalizedUrl,
        },
    };
}

export function buildChatGPTReaderItems(
    snapshot: ChatGPTConversationSnapshot,
    startTarget?: ChatGPTConversationStartTarget | string | null,
    pageUrl: string = window.location.href
): BuildChatGPTReaderItemsResult {
    const normalizedTarget: ChatGPTConversationStartTarget | null =
        typeof startTarget === 'string'
            ? { messageId: startTarget }
            : startTarget ?? null;
    const content = buildChatGPTReaderContent(snapshot, pageUrl);
    return {
        ...content,
        startIndex: resolveChatGPTReaderStartIndex(snapshot, normalizedTarget),
    };
}
