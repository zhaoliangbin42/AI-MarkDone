import type {
    ConversationContentSourceV1,
} from '../../../contracts/conversationContent';
import type {
    ConversationMaterializationPortV1,
    ConversationMaterializationResultV1,
    ConversationTargetV1,
    MaterializationSnapshotV1,
} from '../../../contracts/conversationMaterialization';
import type { ConversationNavigationPortV1 } from '../../../contracts/conversationNavigation';
import type { SiteAdapter } from '../adapters/base';
import {
    materializeChatGPTConversationTarget,
    type ChatGPTMaterializationResult,
} from './ChatGPTConversationNavigation';
import { getChatGPTConversationIndex, type ChatGPTConversationIndex } from './ChatGPTConversationIndex';
import {
    resolveChatGPTDomRoundIdentity,
    resolveChatGPTDomRoundProjectionIdentity,
    type ChatGPTDomRoundRef,
} from './domConversationDiscovery';

export type ChatGPTConversationMaterializationOptions = Readonly<{
    adapter: SiteAdapter;
    content: ConversationContentSourceV1;
    index?: ChatGPTConversationIndex;
}>;

/** DOM-only projection for navigation and toolbar anchoring. */
export class ChatGPTConversationMaterialization implements ConversationMaterializationPortV1 {
    private readonly index: ChatGPTConversationIndex;
    private readonly listeners = new Set<(snapshot: MaterializationSnapshotV1) => void>();
    private readonly unsubscribeContent: () => void;
    private readonly unsubscribeIndex: () => void;
    private navigation: ConversationNavigationPortV1 | null = null;
    private readonly anchorTokens = new WeakMap<HTMLElement, string>();
    private anchorSequence = 0;
    private snapshot: MaterializationSnapshotV1 = {
        materializationToken: 'chatgpt-materialization:empty',
        contentToken: null,
        entries: [],
    };

    constructor(private readonly options: ChatGPTConversationMaterializationOptions) {
        this.index = options.index ?? getChatGPTConversationIndex(options.adapter);
        this.unsubscribeContent = options.content.subscribe(() => this.rebuild());
        this.unsubscribeIndex = this.index.subscribe(() => this.rebuild());
        this.rebuild();
    }

    read(): MaterializationSnapshotV1 {
        return this.snapshot;
    }

    setNavigationPort(navigation: ConversationNavigationPortV1 | null): void {
        this.navigation = navigation;
    }

    subscribe(listener: (snapshot: MaterializationSnapshotV1) => void): () => void {
        this.listeners.add(listener);
        listener(this.snapshot);
        return () => this.listeners.delete(listener);
    }

    resolveElement(element: HTMLElement): ConversationTargetV1 | null {
        const state = this.options.content.read();
        if (!state.document) return null;
        const hostResolver = this.index as Partial<Pick<ChatGPTConversationIndex, 'resolveHostRoundForElement'>>;
        if (typeof hostResolver.resolveHostRoundForElement === 'function') {
            const hostRound = hostResolver.resolveHostRoundForElement(element);
            const identity = hostRound
                ? resolveChatGPTDomRoundIdentity(hostRound)
                    ?? resolveChatGPTDomRoundProjectionIdentity(hostRound)
                : null;
            if (!identity) return null;
            const semantic = state.snapshot?.turns.find((turn) => (
                turn.identity.assistantMessageId === identity.assistantMessageId
            ));
            return semantic
                ? toTarget(
                    state.document.key,
                    semantic.identity.turnId,
                    semantic.identity.assistantMessageId,
                    semantic.identity.userMessageId,
                )
                : toTarget(
                    state.document.key,
                    identity.turnId,
                    identity.assistantMessageId,
                    identity.userMessageId,
                );
        }
        if (!state.snapshot) return null;
        const indexed = this.index.resolveRoundForElement(element);
        if (!indexed || indexed.identity.assistantMessageId === null) return null;
        const semantic = state.snapshot.turns.find((turn) => (
            turn.identity.assistantMessageId === indexed.identity.assistantMessageId
        ));
        if (!semantic) return null;
        return toTarget(state.document.key, semantic.identity.turnId, semantic.identity.assistantMessageId, semantic.identity.userMessageId);
    }

    async locate(
        target: ConversationTargetV1,
        signal?: AbortSignal,
    ): Promise<ConversationMaterializationResultV1> {
        if (signal?.aborted) return 'cancelled';
        const state = this.options.content.read();
        if (!state.document || !state.snapshot || state.document.key !== target.documentKey) return 'unavailable';
        const semantic = state.snapshot.turns.find((turn) => (
            turn.identity.turnId === target.turnId
            && turn.identity.assistantMessageId === target.assistantMessageId
            && (target.userMessageId === undefined || turn.identity.userMessageId === target.userMessageId)
        ));
        if (!semantic) return 'unavailable';
        if (this.navigation) {
            const result = await this.navigation.navigate({
                documentKey: target.documentKey,
                position: semantic.ordinal,
                roundId: semantic.identity.turnId,
                userMessageId: semantic.identity.userMessageId,
                assistantMessageId: semantic.identity.assistantMessageId,
                source: 'reader',
            }, { signal, timeoutMs: 15_000, align: 'start' });
            if (result.ok) {
                this.rebuild();
                return 'located';
            }
            return result.reason === 'cancelled' ? 'cancelled' : 'unavailable';
        }
        const mounted = this.snapshot.entries.find((entry) => (
            entry.target.turnId === target.turnId
            && entry.target.assistantMessageId === target.assistantMessageId
        ));
        if (mounted?.anchorElement.isConnected) return 'located';

        const result: ChatGPTMaterializationResult = await materializeChatGPTConversationTarget(
            this.options.adapter,
            {
                position: semantic.ordinal,
                roundId: semantic.identity.turnId,
                assistantMessageId: semantic.identity.assistantMessageId,
                userMessageId: semantic.identity.userMessageId,
            },
            { signal, timeoutMs: 1500, intervalMs: 120 },
        );
        if (result.ok) {
            this.rebuild();
            return 'located';
        }
        return signal?.aborted || result.message === 'Navigation cancelled' ? 'cancelled' : 'unavailable';
    }

    dispose(): void {
        this.unsubscribeContent();
        this.unsubscribeIndex();
        this.listeners.clear();
    }

    private rebuild(): void {
        const state = this.options.content.read();
        const documentKey = state.document?.key ?? null;
        const contentToken = state.snapshot?.contentToken ?? null;
        const semanticByAssistantId = new Map(
            state.snapshot?.turns.map((turn) => [turn.identity.assistantMessageId, turn] as const) ?? [],
        );
        const entries = documentKey
            ? this.readHostRounds()
                .map((round) => {
                    const identity = resolveChatGPTDomRoundIdentity(round)
                        ?? resolveChatGPTDomRoundProjectionIdentity(round);
                    const messageElement = round.assistantMessageEl;
                    if (!identity || !messageElement.isConnected) return null;
                    const anchorElement = this.options.adapter.getToolbarAnchorElement(messageElement)
                        ?? messageElement;
                    if (!anchorElement.isConnected) return null;
                    const semantic = semanticByAssistantId.get(identity.assistantMessageId);
                    return {
                        target: semantic
                            ? toTarget(
                                documentKey,
                                semantic.identity.turnId,
                                semantic.identity.assistantMessageId,
                                semantic.identity.userMessageId,
                            )
                            : toTarget(
                                documentKey,
                                identity.turnId,
                                identity.assistantMessageId,
                                identity.userMessageId,
                            ),
                        anchorElement,
                        messageElement,
                    };
                })
                .filter((entry): entry is NonNullable<typeof entry> => entry !== null)
            : [];
        const semanticKeys = entries.map((entry) => (
            `${entry.target.turnId}:${entry.target.assistantMessageId}:${this.getAnchorToken(entry.anchorElement)}`
        ));
        const next: MaterializationSnapshotV1 = Object.freeze({
            materializationToken: `chatgpt-materialization:${contentToken ?? 'none'}:${semanticKeys.join('|')}`,
            contentToken,
            entries: Object.freeze(entries.map((entry) => Object.freeze({
                target: Object.freeze({ ...entry.target }),
                anchorElement: entry.anchorElement,
                messageElement: entry.messageElement,
            }))),
        });
        if (next.materializationToken === this.snapshot.materializationToken) return;
        this.snapshot = next;
        for (const listener of Array.from(this.listeners)) listener(this.snapshot);
    }

    private getAnchorToken(element: HTMLElement): string {
        const existing = this.anchorTokens.get(element);
        if (existing) return existing;
        const token = `anchor-${++this.anchorSequence}`;
        this.anchorTokens.set(element, token);
        return token;
    }

    private readHostRounds(): ChatGPTDomRoundRef[] {
        const hostIndex = this.index as Partial<Pick<ChatGPTConversationIndex, 'getHostRounds'>>;
        if (typeof hostIndex.getHostRounds === 'function') return hostIndex.getHostRounds();
        return this.index.getRounds()
            .map((round) => round.materialized)
            .filter((round): round is ChatGPTDomRoundRef => round !== null);
    }
}

function toTarget(
    documentKey: string,
    turnId: string,
    assistantMessageId: string,
    userMessageId: string | null,
): ConversationTargetV1 {
    return {
        documentKey,
        turnId,
        assistantMessageId,
        userMessageId,
    };
}
