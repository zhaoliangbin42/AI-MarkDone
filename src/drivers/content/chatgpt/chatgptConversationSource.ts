import { normalizeChatGPTReaderMarkdown } from './normalizeReaderMarkdown';
import type { ChatGPTConversationRound, ChatGPTConversationSnapshot } from './types';

export type ChatGPTConversationTurn = {
    user: string;
    assistant: string;
    index: number;
};

export type ChatGPTConversationStartTarget = {
    position?: number | null;
    positionSource?: 'snapshot';
    messageId?: string | null;
    roundId?: string | null;
    userMessageId?: string | null;
    assistantMessageId?: string | null;
};

function normalizeMessageId(value: unknown): string | null {
    return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function resolveUniqueRoundIndex(
    snapshot: ChatGPTConversationSnapshot,
    target: ChatGPTConversationStartTarget,
): number {
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
    if (!target) return Math.max(0, snapshot.rounds.length - 1);
    return resolveUniqueRoundIndex(snapshot, target);
}

export function resolveChatGPTConversationRound(
    snapshot: ChatGPTConversationSnapshot,
    target?: ChatGPTConversationStartTarget | null
): ChatGPTConversationRound | null {
    if (!target) return null;
    const index = resolveUniqueRoundIndex(snapshot, target);
    return index >= 0 ? snapshot.rounds[index] ?? null : null;
}
