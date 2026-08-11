import type {
    ConversationContentStateV1,
    ConversationContentTokenV1,
    ConversationDocumentRefV1,
    ConversationSnapshotV1,
    ConversationTurnV1,
} from './conversationContent';
import type {
    ConversationMaterializationPortV1,
    ConversationTargetV1,
} from './conversationMaterialization';

/**
 * Marks extension UI whose host removal must be repaired through the shared
 * PageIndex lifecycle. It is a surface signal only and never content evidence.
 */
export const AIMD_CONVERSATION_SURFACE_CONSUMER_ATTRIBUTE = 'data-aimd-conversation-surface-consumer';

/** Current host geometry for one typed assistant turn. Never persisted. */
export type ConversationSurfaceMaterializationV1 = Readonly<{
    anchorElement: HTMLElement;
    messageElement: HTMLElement;
    jumpAnchorElement: HTMLElement;
    userElement: HTMLElement | null;
    assistantElement: HTMLElement;
    groupElements: readonly HTMLElement[];
}>;

export type ConversationObtainedSurfaceTurnV1 = Readonly<{
    status: 'obtained';
    turn: ConversationTurnV1;
    target: ConversationTargetV1;
    materialization: ConversationSurfaceMaterializationV1 | null;
}>;

export type ConversationPendingSurfaceV1 = Readonly<{
    status: 'pending-surface';
    target: ConversationTargetV1;
    materialization: ConversationSurfaceMaterializationV1;
}>;

/**
 * One atomic projection of the maintained content pool onto the currently
 * mounted ChatGPT page. `pendingSurfaces` are UI anchors, never content.
 */
export type ConversationSurfaceFrameV1 = Readonly<{
    frameToken: string;
    /** Changes only when content or mounted host surfaces change. */
    surfaceToken: string;
    contentKind: ConversationContentStateV1['kind'];
    document: ConversationDocumentRefV1 | null;
    snapshot: ConversationSnapshotV1 | null;
    projectionId: string | null;
    contentToken: ConversationContentTokenV1 | null;
    obtainedTurns: readonly ConversationObtainedSurfaceTurnV1[];
    pendingSurfaces: readonly ConversationPendingSurfaceV1[];
}>;

export interface ConversationSurfacePortV1 {
    readFrame(): ConversationSurfaceFrameV1;
    subscribeFrame(listener: (frame: ConversationSurfaceFrameV1) => void): () => void;
    /** Local PageIndex rescan for BFCache or host-root replacement. */
    refreshSurface(): void;
    /** Existing consumers keep using the same DOM-target compatibility port. */
    readonly materialization: ConversationMaterializationPortV1;
}
