import type { ConversationContentTokenV1 } from './conversationContent';

/**
 * Content-runtime-only projection of semantic turns into the currently
 * materialized host DOM.  It is intentionally separate from the semantic
 * conversation snapshot and must never be persisted or sent to background.
 */
export type ConversationTargetV1 = Readonly<{
    documentKey: string;
    turnId: string;
    assistantMessageId: string;
    userMessageId?: string | null;
}>;

export type MaterializedConversationTurnV1 = Readonly<{
    target: ConversationTargetV1;
    anchorElement: HTMLElement;
}>;

export type MaterializationSnapshotV1 = Readonly<{
    materializationToken: string;
    contentToken: ConversationContentTokenV1 | null;
    entries: readonly MaterializedConversationTurnV1[];
}>;

export type ConversationMaterializationResultV1 =
    | 'located'
    | 'unavailable'
    | 'cancelled';

export interface ConversationMaterializationPortV1 {
    read(): MaterializationSnapshotV1;
    subscribe(listener: (snapshot: MaterializationSnapshotV1) => void): () => void;
    resolveElement(element: HTMLElement): ConversationTargetV1 | null;
    locate(
        target: ConversationTargetV1,
        signal?: AbortSignal,
    ): Promise<ConversationMaterializationResultV1>;
}
