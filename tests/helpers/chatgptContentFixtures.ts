import {
    createConversationDocumentKeyV1,
    type ConversationContentSourceV1,
    type ConversationContentStateV1,
    type ConversationSnapshotV1,
} from '@/contracts/conversationContent';
import { normalizeChatGPTReaderMarkdown } from '@/drivers/content/chatgpt/normalizeReaderMarkdown';

type LegacyRoundFixture = {
    id?: string;
    position?: number;
    userPrompt?: string;
    assistantContent?: string;
    preview?: string;
    messageId?: string | null;
    userMessageId?: string | null;
    assistantMessageId?: string | null;
};

export type ConversationSnapshotFixture = ConversationSnapshotV1 | {
    conversationId: string;
    revision?: number;
    contentToken?: string;
    rounds: readonly LegacyRoundFixture[];
};

export function toConversationSnapshotV1(
    fixture: ConversationSnapshotFixture,
): ConversationSnapshotV1 {
    if ('schemaVersion' in fixture && fixture.schemaVersion === 1 && 'turns' in fixture) {
        return fixture;
    }

    const conversationId = fixture.conversationId.trim();
    const turns = fixture.rounds.map((round, index) => {
        const turnId = round.id?.trim() || `round-${index + 1}`;
        const assistantMessageId = round.assistantMessageId?.trim()
            || round.messageId?.trim()
            || `assistant-${index + 1}`;
        return {
            key: `${turnId}:${assistantMessageId}`,
            ordinal: index + 1,
            identity: {
                turnId,
                userMessageId: round.userMessageId?.trim() || null,
                assistantMessageId,
            },
            userText: round.userPrompt ?? '',
            // Legacy fixture rounds represent the adapter boundary: they
            // are normalized before becoming a published V1 snapshot.
            assistantMarkdown: normalizeChatGPTReaderMarkdown(round.assistantContent ?? ''),
        };
    });
    return {
        schemaVersion: 1,
        document: {
            key: createConversationDocumentKeyV1('chatgpt', conversationId),
            platformId: 'chatgpt',
            conversationId,
            title: undefined,
            canonicalUrl: `https://chatgpt.com/c/${conversationId}`,
        },
        contentToken: fixture.contentToken ?? String(fixture.revision ?? 1),
        coverage: 'complete',
        turns,
    };
}

export function readyConversationState(
    fixture: ConversationSnapshotFixture,
): ConversationContentStateV1 {
    const snapshot = toConversationSnapshotV1(fixture);
    return {
        kind: 'ready',
        document: snapshot.document,
        snapshot,
    };
}

export function createConversationContentSource(
    initial: ConversationSnapshotFixture | ConversationContentStateV1,
): ConversationContentSourceV1 & { publish(next: ConversationSnapshotFixture | ConversationContentStateV1): void } {
    let state = 'kind' in initial ? initial : readyConversationState(initial);
    const listeners = new Set<(next: ConversationContentStateV1) => void>();
    const source: ConversationContentSourceV1 & { publish(next: ConversationSnapshotFixture | ConversationContentStateV1): void } = {
        read: () => state,
        subscribe: (listener) => {
            listeners.add(listener);
            listener(state);
            return () => listeners.delete(listener);
        },
        refresh: async () => state,
        isCurrent: (contentToken) => state.snapshot?.contentToken === contentToken,
        readTurn: (target) => {
            const turn = state.snapshot?.turns.find((candidate) => (
                candidate.identity.turnId === target.turnId
                && candidate.identity.assistantMessageId === target.assistantMessageId
                && (target.userMessageId === undefined || candidate.identity.userMessageId === target.userMessageId)
            ));
            return turn
                ? {
                    kind: 'ready' as const,
                    target,
                    turn,
                    contentToken: state.snapshot!.contentToken,
                }
                : {
                    kind: 'unavailable' as const,
                    target,
                    reason: 'not-recognized' as const,
                };
        },
        publish: (next) => {
            state = 'kind' in next ? next : readyConversationState(next);
            for (const listener of Array.from(listeners)) listener(state);
        },
    };
    return source;
}
