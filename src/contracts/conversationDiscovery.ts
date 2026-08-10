import type {
    ConversationContentSourceV1,
    ConversationTurnV1,
} from './conversationContent';
import type {
    ConversationMaterializationPortV1,
    ConversationTargetV1,
} from './conversationMaterialization';

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

export interface ConversationTurnReadPortV1 {
    readTurn(target: ConversationTargetV1): ConversationTurnReadResultV1;
}

/**
 * Public discovery seam. Consumers receive the maintained Content Port plus
 * the narrow identity read; repository lifecycle internals never cross this
 * boundary.
 */
export type ConversationDiscoveryContentPortV1 =
    ConversationContentSourceV1 & ConversationTurnReadPortV1;

export interface ConversationDiscoveryRuntimeV1 {
    readonly content: ConversationDiscoveryContentPortV1;
    readonly materialization: ConversationMaterializationPortV1;
    init(): void;
    dispose(): void;
}
