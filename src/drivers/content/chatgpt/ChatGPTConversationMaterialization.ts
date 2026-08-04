import type {
    ConversationContentSourceV1,
} from '../../../contracts/conversationContent';
import type {
    ConversationMaterializationPortV1,
    ConversationMaterializationResultV1,
    ConversationTargetV1,
    MaterializationSnapshotV1,
} from '../../../contracts/conversationMaterialization';
import type { SiteAdapter } from '../adapters/base';
import {
    materializeChatGPTConversationTarget,
    type ChatGPTMaterializationResult,
} from './ChatGPTConversationNavigation';
import { getChatGPTConversationIndex, type ChatGPTConversationIndex } from './ChatGPTConversationIndex';

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

    subscribe(listener: (snapshot: MaterializationSnapshotV1) => void): () => void {
        this.listeners.add(listener);
        listener(this.snapshot);
        return () => this.listeners.delete(listener);
    }

    resolveElement(element: HTMLElement): ConversationTargetV1 | null {
        const state = this.options.content.read();
        if (!state.document || !state.snapshot) return null;
        const indexed = this.index.resolveRoundForElement(element);
        if (!indexed || indexed.identity.assistantMessageId === null) return null;
        const semantic = state.snapshot.turns.find((turn) => (
            turn.identity.assistantMessageId === indexed.identity.assistantMessageId
            && (!indexed.identity.roundId || turn.identity.turnId === indexed.identity.roundId)
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
        const entries = documentKey && state.snapshot
            ? this.index.getRounds()
                .map((indexed) => {
                    const assistantMessageId = indexed.identity.assistantMessageId;
                    const anchorElement = indexed.materialized?.jumpAnchorEl ?? null;
                    if (!assistantMessageId || !anchorElement?.isConnected) return null;
                    const semantic = state.snapshot!.turns.find((turn) => (
                        turn.identity.assistantMessageId === assistantMessageId
                        && (!indexed.identity.roundId || turn.identity.turnId === indexed.identity.roundId)
                    ));
                    if (!semantic) return null;
                    return {
                        target: toTarget(documentKey, semantic.identity.turnId, assistantMessageId, semantic.identity.userMessageId),
                        anchorElement,
                    };
                })
                .filter((entry): entry is NonNullable<typeof entry> => entry !== null)
            : [];
        const semanticKeys = entries.map((entry) => `${entry.target.turnId}:${entry.target.assistantMessageId}`);
        const next: MaterializationSnapshotV1 = Object.freeze({
            materializationToken: `chatgpt-materialization:${contentToken ?? 'none'}:${semanticKeys.join('|')}`,
            contentToken,
            entries: Object.freeze(entries.map((entry) => Object.freeze({
                target: Object.freeze({ ...entry.target }),
                anchorElement: entry.anchorElement,
            }))),
        });
        if (next.materializationToken === this.snapshot.materializationToken) return;
        this.snapshot = next;
        for (const listener of Array.from(this.listeners)) listener(this.snapshot);
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
