/**
 * Stable semantic contract between platform conversation discovery and content
 * consumers.  Provider payloads, DOM nodes, selectors, and discovery proofs
 * must not cross this boundary.
 */

export type ConversationContentTokenV1 = string;

export type ConversationContentCandidateV1 = Readonly<{
    document: ConversationDocumentRefV1;
    coverage: 'complete' | 'partial';
    turns: readonly ConversationTurnV1[];
}>;

export type ConversationContentAcquisitionReasonV1 =
    | 'source-timeout'
    | 'source-unavailable'
    | 'invalid-payload'
    | 'identity-conflict';

export class ConversationContentAcquisitionError extends Error {
    readonly reason: ConversationContentAcquisitionReasonV1;
    readonly retryable: boolean;

    constructor(
        reason: ConversationContentAcquisitionReasonV1,
        options?: { retryable?: boolean },
    ) {
        super(`Conversation content acquisition failed: ${reason}`);
        this.name = 'ConversationContentAcquisitionError';
        this.reason = reason;
        this.retryable = options?.retryable ?? (
            reason === 'source-timeout' || reason === 'source-unavailable'
        );
    }
}

export type ConversationDocumentRefV1 = Readonly<{
    key: string;
    platformId: string;
    conversationId: string;
    title?: string;
    canonicalUrl?: string;
}>;

export type ConversationTurnIdentityV1 = Readonly<{
    turnId: string;
    userMessageId: string | null;
    assistantMessageId: string;
}>;

export type ConversationTurnV1 = Readonly<{
    key: string;
    ordinal: number;
    identity: ConversationTurnIdentityV1;
    userText: string;
    assistantMarkdown: string;
}>;

export type ConversationSnapshotV1 = Readonly<{
    schemaVersion: 1;
    document: ConversationDocumentRefV1;
    contentToken: ConversationContentTokenV1;
    coverage: 'complete' | 'partial';
    turns: readonly ConversationTurnV1[];
}>;

export type ConversationStaleReasonV1 =
    | 'source-timeout'
    | 'source-unavailable'
    | 'identity-conflict';

export type ConversationUnavailableReasonV1 =
    | 'unsupported-route'
    | 'source-unavailable'
    | 'invalid-payload'
    | 'identity-conflict';

export type ConversationContentStateV1 =
    | Readonly<{
        kind: 'idle';
        document: null;
        snapshot: null;
    }>
    | Readonly<{
        kind: 'syncing';
        document: ConversationDocumentRefV1;
        snapshot: ConversationSnapshotV1 | null;
    }>
    | Readonly<{
        kind: 'ready';
        document: ConversationDocumentRefV1;
        snapshot: ConversationSnapshotV1;
    }>
    | Readonly<{
        kind: 'stale';
        document: ConversationDocumentRefV1;
        snapshot: ConversationSnapshotV1;
        reason: ConversationStaleReasonV1;
    }>
    | Readonly<{
        kind: 'unavailable';
        document: ConversationDocumentRefV1 | null;
        snapshot: null;
        reason: ConversationUnavailableReasonV1;
        retryable: boolean;
    }>;

export interface ConversationContentSourceV1 {
    read(): ConversationContentStateV1;
    subscribe(listener: (state: ConversationContentStateV1) => void): () => void;
    refresh(): Promise<ConversationContentStateV1>;
    isCurrent(contentToken: ConversationContentTokenV1): boolean;
}

export interface ConversationContentCoordinatorV1 extends ConversationContentSourceV1 {
    scheduleReconcile(): void;
    reconcile(): Promise<ConversationContentStateV1>;
}

export type ConversationContentStateListenerV1 = (
    state: ConversationContentStateV1,
) => void;

export function createConversationDocumentKeyV1(
    platformId: string,
    conversationId: string,
): string {
    const normalizedPlatform = platformId.trim().toLowerCase();
    const normalizedConversation = conversationId.trim().toLowerCase();
    return `${normalizedPlatform}:conversation:${encodeURIComponent(normalizedConversation)}`;
}

export function isConversationDocumentRefV1(value: unknown): value is ConversationDocumentRefV1 {
    if (!isRecord(value)) return false;
    return isNonEmptyString(value.key)
        && isNonEmptyString(value.platformId)
        && isNonEmptyString(value.conversationId)
        && value.key === createConversationDocumentKeyV1(value.platformId, value.conversationId)
        && isOptionalString(value.title)
        && isOptionalString(value.canonicalUrl);
}

export function isConversationSnapshotV1(value: unknown): value is ConversationSnapshotV1 {
    if (!isRecord(value)) return false;
    if (value.schemaVersion !== 1 || !isConversationDocumentRefV1(value.document)) return false;
    if (!isNonEmptyString(value.contentToken)) return false;
    if (value.coverage !== 'complete' && value.coverage !== 'partial') return false;
    if (!Array.isArray(value.turns)) return false;

    const keys = new Set<string>();
    const turnIds = new Set<string>();
    const assistantIds = new Set<string>();
    const userIds = new Set<string>();
    return value.turns.every((turn, index) => {
        if (!isRecord(turn)) return false;
        const identity = turn.identity;
        if (!isRecord(identity)) return false;
        if (!isNonEmptyString(turn.key) || keys.has(turn.key)) return false;
        if (!Number.isInteger(turn.ordinal) || turn.ordinal !== index + 1) return false;
        if (!isNonEmptyString(identity.turnId) || turnIds.has(identity.turnId)) return false;
        if (!isNonEmptyString(identity.assistantMessageId) || assistantIds.has(identity.assistantMessageId)) return false;
        if (!isNullableString(identity.userMessageId)) return false;
        if (identity.userMessageId && userIds.has(identity.userMessageId)) return false;
        if (typeof turn.userText !== 'string' || typeof turn.assistantMarkdown !== 'string') return false;

        keys.add(turn.key);
        turnIds.add(identity.turnId);
        assistantIds.add(identity.assistantMessageId);
        if (identity.userMessageId) userIds.add(identity.userMessageId);
        return true;
    });
}

export function freezeConversationSnapshotV1(
    snapshot: ConversationSnapshotV1,
): ConversationSnapshotV1 {
    const turns = snapshot.turns.map((turn) => Object.freeze({
        ...turn,
        identity: Object.freeze({ ...turn.identity }),
    }));
    return Object.freeze({
        ...snapshot,
        document: Object.freeze({ ...snapshot.document }),
        turns: Object.freeze(turns),
    });
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
}

function isNonEmptyString(value: unknown): value is string {
    return typeof value === 'string' && value.trim().length > 0;
}

function isOptionalString(value: unknown): value is string | undefined {
    return value === undefined || typeof value === 'string';
}

function isNullableString(value: unknown): value is string | null {
    return value === null || isNonEmptyString(value);
}
