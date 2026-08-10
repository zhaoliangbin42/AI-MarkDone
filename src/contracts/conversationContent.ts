/**
 * Stable semantic contract between platform conversation discovery and content
 * consumers.  Provider payloads, DOM nodes, selectors, and discovery proofs
 * must not cross this boundary.
 */

import type { SemanticContentProvenanceV1 } from './semanticContent';

export type ConversationContentTokenV1 = string;

export type ConversationTurnSourceQualityV1 = 'source-backed' | 'host-rendered' | 'reconstructed';

export type ConversationSnapshotSourceQualityV1 =
    | 'source-backed'
    | 'host-rendered'
    | 'mixed'
    | 'reconstructed';

export type ConversationContentCandidateV1 = Readonly<{
    document: ConversationDocumentRefV1;
    coverage: 'complete' | 'partial';
    turns: readonly ConversationTurnV1[];
    /** Additive evidence metadata; legacy producers may omit it. */
    branchKey?: string;
    captureId?: string;
    sourceRevision?: number;
    origin?: 'source' | 'host';
    /** Additive lifecycle fact used to derive snapshot proof.tail. */
    tail?: 'stable' | 'streaming';
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
        super(`Conversation baseline admission failed: ${reason}`);
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
    /**
     * Additive source-quality evidence. Older V1 snapshots may omit it; all
     * current discovery implementations must publish it.
     */
    assistantProvenance?: SemanticContentProvenanceV1;
}>;

export type ConversationSnapshotV1 = Readonly<{
    schemaVersion: 1;
    document: ConversationDocumentRefV1;
    /** Changes when regeneration creates a new immutable active suffix. */
    projectionId?: string;
    contentToken: ConversationContentTokenV1;
    coverage: 'complete' | 'partial';
    turns: readonly ConversationTurnV1[];
    /** Additive proof metadata. Older V1 snapshots may omit this field. */
    proof?: ConversationSnapshotProofV1;
}>;

export type ConversationSnapshotProofV1 = Readonly<{
    /** How the active projection was established. */
    basis?: 'source' | 'hybrid' | 'host-born';
    order: 'complete' | 'gapped';
    bodies: 'complete' | 'gapped';
    tail: 'stable' | 'streaming';
    gaps: readonly Readonly<{
        kind: 'order' | 'body' | 'identity' | 'tail';
        beforeTurnId?: string;
        afterTurnId?: string;
        turnId?: string;
        reason: string;
    }>[];
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
    if (value.projectionId !== undefined && !isNonEmptyString(value.projectionId)) return false;
    if (!isNonEmptyString(value.contentToken)) return false;
    if (value.coverage !== 'complete' && value.coverage !== 'partial') return false;
    if (!Array.isArray(value.turns)) return false;
    if (value.proof !== undefined && !isConversationSnapshotProofV1(value.proof)) return false;

    const keys = new Set<string>();
    const turnIds = new Set<string>();
    const assistantIds = new Set<string>();
    const userIds = new Set<string>();
    let previousOrdinal = 0;
    return value.turns.every((turn, index) => {
        if (!isRecord(turn)) return false;
        const identity = turn.identity;
        if (!isRecord(identity)) return false;
        if (!isNonEmptyString(turn.key) || keys.has(turn.key)) return false;
        if (typeof turn.ordinal !== 'number' || !Number.isInteger(turn.ordinal) || turn.ordinal <= 0) return false;
        // A complete V1 snapshot is a dense sequence.  A partial snapshot
        // may be a sparse projection over a known topology, so its ordinal
        // remains the canonical position and only needs to be strictly
        // increasing.  This is the compatibility representation of V2 shell
        // topology + sealed bodies.
        if (value.coverage === 'complete' && turn.ordinal !== index + 1) return false;
        if (value.coverage === 'partial' && turn.ordinal <= previousOrdinal) return false;
        if (!isNonEmptyString(identity.turnId) || turnIds.has(identity.turnId)) return false;
        if (!isNonEmptyString(identity.assistantMessageId) || assistantIds.has(identity.assistantMessageId)) return false;
        if (!isNullableString(identity.userMessageId)) return false;
        if (identity.userMessageId && userIds.has(identity.userMessageId)) return false;
        if (typeof turn.userText !== 'string' || typeof turn.assistantMarkdown !== 'string') return false;
        if (!isOptionalSemanticContentProvenanceV1(turn.assistantProvenance)) return false;

        keys.add(turn.key);
        turnIds.add(identity.turnId);
        assistantIds.add(identity.assistantMessageId);
        if (identity.userMessageId) userIds.add(identity.userMessageId);
        previousOrdinal = turn.ordinal;
        return true;
    });
}

export function freezeConversationSnapshotV1(
    snapshot: ConversationSnapshotV1,
): ConversationSnapshotV1 {
    const turns = snapshot.turns.map((turn) => Object.freeze({
        ...turn,
        identity: Object.freeze({ ...turn.identity }),
        ...(turn.assistantProvenance
            ? { assistantProvenance: Object.freeze({ ...turn.assistantProvenance }) }
            : {}),
    }));
    return Object.freeze({
        ...snapshot,
        document: Object.freeze({ ...snapshot.document }),
        turns: Object.freeze(turns),
        ...(snapshot.proof
            ? Object.freeze({
                proof: Object.freeze({
                    ...snapshot.proof,
                    gaps: Object.freeze(snapshot.proof.gaps.map((gap) => Object.freeze({ ...gap }))),
                }),
            })
            : {}),
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

function isConversationSnapshotProofV1(value: unknown): value is ConversationSnapshotProofV1 {
    if (!isRecord(value)) return false;
    if (value.order !== 'complete' && value.order !== 'gapped') return false;
    if (
        value.basis !== undefined
        && value.basis !== 'source'
        && value.basis !== 'hybrid'
        && value.basis !== 'host-born'
    ) return false;
    if (value.bodies !== 'complete' && value.bodies !== 'gapped') return false;
    if (value.tail !== 'stable' && value.tail !== 'streaming') return false;
    if (!Array.isArray(value.gaps)) return false;
    return value.gaps.every((gap) => {
        if (!isRecord(gap)) return false;
        if (
            gap.kind !== 'order'
            && gap.kind !== 'body'
            && gap.kind !== 'identity'
            && gap.kind !== 'tail'
        ) return false;
        return isNonEmptyString(gap.reason)
            && isOptionalString(gap.beforeTurnId)
            && isOptionalString(gap.afterTurnId)
            && isOptionalString(gap.turnId);
    });
}

function isOptionalSemanticContentProvenanceV1(value: unknown): boolean {
    if (value === undefined) return true;
    if (!isRecord(value)) return false;
    return (
        value.authority === 'primary'
        || value.authority === 'verified-derived'
        || value.authority === 'host-rendered'
        || value.authority === 'reconstructed'
        || value.authority === 'rendered-only'
    ) && (
        value.fidelity === 'exact'
        || value.fidelity === 'normalized'
        || value.fidelity === 'lossy'
        || value.fidelity === 'unknown'
    ) && isNonEmptyString(value.producer);
}

export function isConversationTurnSourceBackedV1(turn: ConversationTurnV1): boolean {
    const provenance = turn.assistantProvenance;
    // Compatibility: snapshots produced before this additive V1 field were
    // source-backed by contract and remain valid.
    if (!provenance) return true;
    return (
        provenance.authority === 'primary'
        || provenance.authority === 'verified-derived'
    ) && (
        provenance.fidelity === 'exact'
        || provenance.fidelity === 'normalized'
    );
}

export function getConversationTurnSourceQualityV1(
    turn: ConversationTurnV1,
): ConversationTurnSourceQualityV1 {
    if (isConversationTurnSourceBackedV1(turn)) return 'source-backed';
    return turn.assistantProvenance?.authority === 'host-rendered'
        ? 'host-rendered'
        : 'reconstructed';
}

export function getConversationSnapshotSourceQualityV1(
    snapshot: ConversationSnapshotV1,
): ConversationSnapshotSourceQualityV1 {
    let sourceBacked = 0;
    let hostRendered = 0;
    let reconstructed = 0;
    for (const turn of snapshot.turns) {
        if (isConversationTurnSourceBackedV1(turn)) sourceBacked += 1;
        else if (turn.assistantProvenance?.authority === 'host-rendered') hostRendered += 1;
        else reconstructed += 1;
    }
    if (sourceBacked === snapshot.turns.length) return 'source-backed';
    if (hostRendered === snapshot.turns.length) return 'host-rendered';
    if (reconstructed === snapshot.turns.length) return 'reconstructed';
    return 'mixed';
}
