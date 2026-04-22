import { normalizeChatGPTReaderMarkdown } from './normalizeReaderMarkdown';
import type { ChatGPTConversationRound, ChatGPTConversationSnapshot } from './types';

export type ChatGPTConversationTurn = {
    user: string;
    assistant: string;
    index: number;
};

export type ChatGPTConversationStartTarget = {
    position?: number | null;
    positionSource?: 'snapshot' | 'dom';
    messageId?: string | null;
    userPrompt?: string | null;
};

function normalizeMessageId(value: unknown): string | null {
    return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function normalizePrompt(value: unknown): string | null {
    if (typeof value !== 'string') return null;
    const normalized = value.replace(/\s+/g, ' ').trim();
    return normalized || null;
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

    const userPrompt = normalizePrompt(target.userPrompt);
    if (userPrompt) {
        const byPrompt = snapshot.rounds.findIndex((round) => normalizePrompt(round.userPrompt) === userPrompt);
        if (byPrompt >= 0) return byPrompt;
    }

    const position = Number(target.position ?? 0);
    if (target.positionSource === 'snapshot' && Number.isInteger(position) && position > 0) {
        const byPosition = snapshot.rounds.findIndex((round) => round.position === position);
        if (byPosition >= 0) return byPosition;
    }

    return fallback;
}

export function resolveChatGPTConversationRound(
    snapshot: ChatGPTConversationSnapshot,
    target?: ChatGPTConversationStartTarget | null
): ChatGPTConversationRound | null {
    if (!target) return null;

    const messageId = normalizeMessageId(target.messageId);
    if (messageId) {
        const byMessageId = snapshot.rounds.find((round) => (
            round.messageId === messageId
            || round.assistantMessageId === messageId
            || round.userMessageId === messageId
            || round.id === messageId
        ));
        if (byMessageId) return byMessageId;
    }

    const userPrompt = normalizePrompt(target.userPrompt);
    if (userPrompt) {
        const byPrompt = snapshot.rounds.find((round) => normalizePrompt(round.userPrompt) === userPrompt);
        if (byPrompt) return byPrompt;
    }

    const position = Number(target.position ?? 0);
    if (target.positionSource === 'snapshot' && Number.isInteger(position) && position > 0) {
        return snapshot.rounds.find((round) => round.position === position) ?? null;
    }

    return null;
}
