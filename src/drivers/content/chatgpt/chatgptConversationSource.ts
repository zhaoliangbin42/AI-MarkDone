import { normalizeChatGPTReaderMarkdown } from './normalizeReaderMarkdown';
import type { ChatGPTConversationSnapshot } from './types';

export type ChatGPTConversationTurn = {
    user: string;
    assistant: string;
    index: number;
};

export type ChatGPTConversationStartTarget = {
    position?: number | null;
    messageId?: string | null;
};

function normalizeMessageId(value: unknown): string | null {
    return typeof value === 'string' && value.trim() ? value.trim() : null;
}

export function buildChatGPTConversationTurns(snapshot: ChatGPTConversationSnapshot): ChatGPTConversationTurn[] {
    return snapshot.rounds.map((round, index) => ({
        user: round.userPrompt,
        assistant: normalizeChatGPTReaderMarkdown(round.assistantContent),
        index,
    }));
}

export function resolveChatGPTConversationStartIndex(
    snapshot: ChatGPTConversationSnapshot,
    target?: ChatGPTConversationStartTarget | null
): number {
    const fallback = Math.max(0, snapshot.rounds.length - 1);
    if (!target) return fallback;

    const position = Number(target.position ?? 0);
    if (Number.isInteger(position) && position > 0) {
        const byPosition = snapshot.rounds.findIndex((round) => round.position === position);
        if (byPosition >= 0) return byPosition;
    }

    const messageId = normalizeMessageId(target.messageId);
    if (messageId) {
        const byMessageId = snapshot.rounds.findIndex((round) => (
            round.messageId === messageId
            || round.assistantMessageId === messageId
            || round.userMessageId === messageId
            || round.id === messageId
        ));
        if (byMessageId >= 0) return byMessageId;
    }

    return fallback;
}
