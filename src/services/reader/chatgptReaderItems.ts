import type { ConversationSnapshotV1 } from '../../contracts/conversationContent';
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
    snapshot: ConversationSnapshotV1,
    target: ChatGPTConversationStartTarget | null,
): number {
    if (!target) return Math.max(0, snapshot.turns.length - 1);

    const roundId = normalizeMessageId(target.roundId);
    const userMessageId = normalizeMessageId(target.userMessageId);
    const assistantMessageId = normalizeMessageId(target.assistantMessageId);
    const messageId = normalizeMessageId(target.messageId);
    const hasCanonicalIdentity = Boolean(roundId || userMessageId || assistantMessageId || messageId);
    if (hasCanonicalIdentity) {
        const matches = snapshot.turns
            .map((turn, index) => ({ turn, index }))
            .filter(({ turn }) => (
                (!roundId || turn.identity.turnId === roundId)
                && (!userMessageId || turn.identity.userMessageId === userMessageId)
                && (!assistantMessageId || turn.identity.assistantMessageId === assistantMessageId)
                && (!messageId || turn.identity.assistantMessageId === messageId)
            ));
        return matches.length === 1 ? matches[0]!.index : -1;
    }

    const position = Number(target.position ?? 0);
    if (target.positionSource !== 'snapshot' || !Number.isInteger(position) || position <= 0) return -1;
    const matches = snapshot.turns
        .map((turn, index) => ({ turn, index }))
        .filter(({ turn }) => turn.ordinal === position);
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
    snapshot: ConversationSnapshotV1,
    pageUrl: string = window.location.href,
): ChatGPTReaderContentBuildResult {
    const normalizedUrl = normalizeChatGPTReaderPageUrl(pageUrl);
    const branchKey = snapshot.turns[snapshot.turns.length - 1]?.identity.assistantMessageId ?? null;
    const items: ReaderItem[] = snapshot.turns.map((turn) => ({
        id: `chatgpt-${turn.identity.assistantMessageId}`,
        userPrompt: turn.userText,
        content: normalizeChatGPTReaderMarkdown(turn.assistantMarkdown),
        meta: {
            platformId: snapshot.document.platformId,
            messageId: turn.identity.assistantMessageId,
            roundId: turn.identity.turnId,
            userMessageId: turn.identity.userMessageId,
            assistantMessageId: turn.identity.assistantMessageId,
            branchKey,
            position: turn.ordinal,
            url: normalizedUrl,
            bookmarkable: true,
            bookmarked: false,
        },
    }));

    return {
        items,
        annotationDocument: {
            platform: 'chatgpt',
            conversationId: snapshot.document.conversationId,
            title: snapshot.document.title ?? resolveConversationTitle(),
            lastKnownUrl: normalizedUrl,
        },
    };
}

export function buildChatGPTReaderItems(
    snapshot: ConversationSnapshotV1,
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
