import type { SiteAdapter } from '../adapters/base';
import {
    collectChatGPTDomRoundRefs,
    subscribeChatGPTDomRoundChanges,
    type ChatGPTDomRoundRef,
} from './domConversationDiscovery';
import type {
    ChatGPTConversationSource,
    ChatGPTConversationRound,
    ChatGPTConversationSnapshot,
} from './types';
import { getChatGPTConversationId } from './chatgptRoute';
import { logger } from '../../../core/logger';

type ChatGPTRoundIdentity = {
    roundId: string | null;
    userMessageId: string | null;
    assistantMessageId: string | null;
};

export type ChatGPTIndexedRound = {
    position: number;
    round: ChatGPTConversationRound;
    identity: ChatGPTRoundIdentity;
    materialized: ChatGPTDomRoundRef | null;
};

function normalizeId(value: string | null | undefined): string | null {
    const normalized = value?.trim();
    return normalized || null;
}

function getRoundIdentity(round: ChatGPTConversationRound): ChatGPTRoundIdentity {
    return {
        roundId: normalizeId(round.id),
        userMessageId: normalizeId(round.userMessageId),
        assistantMessageId: normalizeId(round.assistantMessageId) ?? normalizeId(round.messageId),
    };
}

function addUniqueIdentity(
    index: Map<string, ChatGPTDomRoundRef | null>,
    id: string | null,
    round: ChatGPTDomRoundRef,
): void {
    if (!id) return;
    if (!index.has(id)) {
        index.set(id, round);
        return;
    }
    if (index.get(id) !== round) index.set(id, null);
}

function matchesObservableIdentity(
    expected: string | null,
    observed: Array<string | null>,
): boolean {
    if (!expected) return true;
    const available = observed.filter((value): value is string => value !== null);
    return available.length === 0 || available.includes(expected);
}

function hasCompatibleIdentity(
    canonical: ChatGPTRoundIdentity,
    materialized: ChatGPTDomRoundRef,
): boolean {
    return matchesObservableIdentity(canonical.roundId, [
        materialized.identity.roundId,
    ]) && matchesObservableIdentity(canonical.userMessageId, [
        materialized.identity.userMessageId,
    ]) && matchesObservableIdentity(canonical.assistantMessageId, [
        materialized.identity.assistantMessageId,
    ]);
}

function resolveMaterializedRound(
    identity: ChatGPTRoundIdentity,
    indexes: {
        byRoundId: Map<string, ChatGPTDomRoundRef | null>;
        byUserMessageId: Map<string, ChatGPTDomRoundRef | null>;
        byAssistantMessageId: Map<string, ChatGPTDomRoundRef | null>;
        byAssistantTurnId: Map<string, ChatGPTDomRoundRef | null>;
    },
): ChatGPTDomRoundRef | null {
    const candidates = new Set<ChatGPTDomRoundRef>();
    const push = (candidate: ChatGPTDomRoundRef | null | undefined) => {
        if (candidate?.anchorEl.isConnected) candidates.add(candidate);
    };
    if (identity.roundId) {
        push(indexes.byRoundId.get(identity.roundId));
        push(indexes.byAssistantTurnId.get(identity.roundId));
    }
    if (identity.userMessageId) push(indexes.byUserMessageId.get(identity.userMessageId));
    if (identity.assistantMessageId) {
        push(indexes.byAssistantMessageId.get(identity.assistantMessageId));
        push(indexes.byAssistantTurnId.get(identity.assistantMessageId));
    }
    const compatibleCandidates = Array.from(candidates).filter((candidate) => (
        hasCompatibleIdentity(identity, candidate)
    ));
    return compatibleCandidates.length === 1 ? compatibleCandidates[0]! : null;
}

export class ChatGPTConversationIndex {
    private readonly subscribers = new Set<() => void>();
    private stateSource: Pick<ChatGPTConversationSource, 'getState' | 'subscribe'> | null = null;
    private unsubscribeStateSource: (() => void) | null = null;
    private readonly unsubscribeDomRoundChanges: () => void;

    constructor(private readonly adapter: SiteAdapter) {
        this.unsubscribeDomRoundChanges = subscribeChatGPTDomRoundChanges(adapter, () => {
            this.notify();
        });
    }

    bindConversationSource(source: Pick<ChatGPTConversationSource, 'getState' | 'subscribe'>): void {
        if (source === this.stateSource) return;
        this.unsubscribeStateSource?.();
        this.stateSource = source;
        this.notify();
        let subscribing = true;
        this.unsubscribeStateSource = source.subscribe(() => {
            if (!subscribing) this.notify();
        });
        subscribing = false;
    }

    private readCurrentSnapshot(): ChatGPTConversationSnapshot | null {
        const snapshot = this.stateSource?.getState().snapshot ?? null;
        if (!snapshot) return null;
        const routeConversationId = getChatGPTConversationId(window.location.href)?.toLowerCase() ?? null;
        if (!routeConversationId || snapshot.conversationId.toLowerCase() !== routeConversationId) return null;
        return snapshot;
    }

    getRounds(): ChatGPTIndexedRound[] {
        const snapshot = this.readCurrentSnapshot();
        if (!snapshot) return [];

        const mounted = collectChatGPTDomRoundRefs(this.adapter);
        const indexes = {
            byRoundId: new Map<string, ChatGPTDomRoundRef | null>(),
            byUserMessageId: new Map<string, ChatGPTDomRoundRef | null>(),
            byAssistantMessageId: new Map<string, ChatGPTDomRoundRef | null>(),
            byAssistantTurnId: new Map<string, ChatGPTDomRoundRef | null>(),
        };
        for (const round of mounted) {
            addUniqueIdentity(indexes.byRoundId, round.identity.roundId, round);
            addUniqueIdentity(indexes.byUserMessageId, round.identity.userMessageId, round);
            addUniqueIdentity(indexes.byAssistantMessageId, round.identity.assistantMessageId, round);
            addUniqueIdentity(indexes.byAssistantTurnId, round.identity.assistantTurnId, round);
        }

        return snapshot.rounds.map((round) => {
            const identity = getRoundIdentity(round);
            return {
                position: round.position,
                round,
                identity,
                materialized: resolveMaterializedRound(identity, indexes),
            };
        });
    }

    resolveRoundForElement(element: HTMLElement): ChatGPTIndexedRound | null {
        const rounds = this.getRounds();
        const messageId = normalizeId(element.getAttribute('data-message-id'));
        if (messageId) {
            const identityMatches = rounds.filter(
                (round) => round.identity.assistantMessageId === messageId,
            );
            if (identityMatches.length > 0) {
                return identityMatches.length === 1 ? identityMatches[0]! : null;
            }
        }

        const matches = rounds.filter((round) => {
            const materialized = round.materialized;
            if (!materialized) return false;
            const candidates = [
                materialized.anchorEl,
                materialized.jumpAnchorEl,
                materialized.userRootEl,
                materialized.userMessageEl,
                materialized.assistantRootEl,
                materialized.assistantMessageEl,
                ...materialized.groupEls,
            ];
            return candidates.some((candidate) => (
                candidate === element
                || candidate.contains(element)
                || element.contains(candidate)
            ));
        });
        return matches.length === 1 ? matches[0]! : null;
    }

    subscribe(listener: () => void): () => void {
        this.subscribers.add(listener);
        return () => this.subscribers.delete(listener);
    }

    dispose(): void {
        this.unsubscribeDomRoundChanges();
        this.unsubscribeStateSource?.();
        this.unsubscribeStateSource = null;
        this.stateSource = null;
        this.subscribers.clear();
    }

    private notify(): void {
        for (const listener of Array.from(this.subscribers)) {
            try {
                listener();
            } catch (error) {
                logger.warn('[AI-MarkDone][ChatGPTConversationIndex] Subscriber failed', error);
            }
        }
    }
}

const indexByAdapter = new WeakMap<SiteAdapter, ChatGPTConversationIndex>();

export function getChatGPTConversationIndex(adapter: SiteAdapter): ChatGPTConversationIndex {
    const existing = indexByAdapter.get(adapter);
    if (existing) return existing;
    const index = new ChatGPTConversationIndex(adapter);
    indexByAdapter.set(adapter, index);
    return index;
}

export function disposeChatGPTConversationIndex(adapter: SiteAdapter): void {
    indexByAdapter.get(adapter)?.dispose();
    indexByAdapter.delete(adapter);
}
