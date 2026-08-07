import type {
    ConversationContentSourceV1,
    ConversationDocumentRefV1,
    ConversationSnapshotV1,
    ConversationTurnV1,
} from './conversationContent';
import type {
    ConversationMaterializationPortV1,
    ConversationTargetV1,
} from './conversationMaterialization';

/**
 * Provider-neutral evidence contract for the content-discovery Module.
 * Provider payloads, DOM nodes, selectors and browser objects stay outside
 * this seam. Adapters submit only validated semantic facts.
 */
export type ConversationEvidenceEpochV1 = string;

export type ConversationEvidenceOriginV1 = 'source' | 'host';

export type ConversationEvidenceGapV1 = Readonly<{
    kind: 'order' | 'body' | 'identity' | 'tail';
    beforeTurnId?: string;
    afterTurnId?: string;
    turnId?: string;
    reason: string;
}>;

export type ConversationSourceEvidenceBatchV1 = Readonly<{
    kind: 'source-batch';
    document: ConversationDocumentRefV1;
    epoch: ConversationEvidenceEpochV1;
    revision: number;
    captureId: string;
    branchKey: string;
    order: 'complete' | 'partial';
    turns: readonly ConversationTurnV1[];
    gaps: readonly ConversationEvidenceGapV1[];
}>;

export type ConversationTurnEvidenceV1 = Readonly<{
    kind: 'turn';
    document: ConversationDocumentRefV1;
    epoch: ConversationEvidenceEpochV1;
    revision: number;
    captureId: string;
    origin: ConversationEvidenceOriginV1;
    turn: ConversationTurnV1;
}>;

export type ConversationEvidenceEventV1 =
    | ConversationSourceEvidenceBatchV1
    | ConversationTurnEvidenceV1;

export type ConversationTurnReadResultV1 =
    | Readonly<{
        kind: 'ready';
        target: ConversationTargetV1;
        turn: ConversationTurnV1;
        contentToken: string;
    }>
    | Readonly<{
        kind: 'unavailable';
        target: ConversationTargetV1;
        reason:
            | 'document-mismatch'
            | 'not-recognized'
            | 'identity-conflict'
            | 'source-unavailable'
            | 'invalid-content';
    }>;

export type ConversationEvidenceLedgerViewV1 = Readonly<{
    document: ConversationDocumentRefV1 | null;
    epoch: ConversationEvidenceEpochV1 | null;
    snapshot: ConversationSnapshotV1 | null;
    sealedTurnIds: readonly string[];
    conflicts: readonly string[];
}>;

export type ConversationEvidenceIngestResultV1 = Readonly<{
    status: 'accepted' | 'duplicate' | 'ignored-epoch' | 'ignored-revision' | 'conflict';
    view: ConversationEvidenceLedgerViewV1;
}>;

export interface ConversationTurnReadPortV1 {
    readTurn(target: ConversationTargetV1): ConversationTurnReadResultV1;
}

/**
 * Public discovery seam.  Consumers receive the existing Content Port plus
 * the narrow identity read; Ledger internals never cross this boundary.
 */
export type ConversationDiscoveryContentPortV1 =
    ConversationContentSourceV1 & ConversationTurnReadPortV1;

export interface ConversationDiscoveryRuntimeV1 {
    readonly content: ConversationDiscoveryContentPortV1;
    readonly materialization: ConversationMaterializationPortV1;
    init(): void;
    dispose(): void;
}
