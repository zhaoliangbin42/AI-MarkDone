/**
 * Stable semantic contract between platform conversation discovery and content
 * consumers.  Provider payloads, DOM nodes, selectors, and discovery proofs
 * must not cross this boundary.
 */

import type { SemanticContentProvenanceV1 } from './semanticContent';
import type { DiscoveryHistoryStatusV1 } from './conversationDiscoveryDiagnostics';

export type ConversationContentTokenV1 = string;

export type ConversationTurnSourceQualityV1 = 'source-backed' | 'host-rendered' | 'reconstructed';

export type ConversationSnapshotSourceQualityV1 =
    | 'source-backed'
    | 'host-rendered'
    | 'mixed'
    | 'reconstructed';

export type ConversationContentCandidateV1 = Readonly<{
    document: ConversationDocumentRefV1;
    /** Every candidate admitted to the maintained message cache is complete. */
    coverage: 'complete';
    turns: readonly ConversationTurnV1[];
    /** Compatibility metadata retained for older producers and snapshots. */
    branchKey?: string;
    captureId?: string;
    sourceRevision?: number;
    origin?: 'source' | 'host';
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
        super(`Conversation content admission failed: ${reason}`);
        this.name = 'ConversationContentAcquisitionError';
        this.reason = reason;
        this.retryable = options?.retryable ?? (
            reason === 'source-timeout' || reason === 'source-unavailable'
        );
    }
}

type ConversationDocumentRefBaseV1 = Readonly<{
    key: string;
    platformId: string;
    title?: string;
    canonicalUrl?: string;
}>;

export type ConversationDocumentRefV1 = ConversationDocumentRefBaseV1 & Readonly<
    | {
        /** Legacy producers may omit the discriminator; they are canonical. */
        identityKind?: 'canonical';
        conversationId: string;
    }
    | {
        /** Page identity makes obtained DOM content consumable before a route id exists. */
        identityKind: 'page';
        conversationId: null;
    }
>;

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
    /** Stable page/document projection identity used by async consumers. */
    projectionId?: string;
    contentToken: ConversationContentTokenV1;
    /** Bodies of every admitted turn are dense and complete. */
    coverage: 'complete';
    /**
     * Whether the pool is known to cover the whole conversation. Ordinary
     * DOM-authoritative ChatGPT capture publishes 'partial'; a validated 5.3
     * source seed publishes 'get'. 'complete' remains accepted for older or
     * independently proven snapshots, but current page entry does not create
     * it by forcing an empty `?message=` sweep. 'unknown' remains accepted for
     * older producers and snapshots.
     * Additive honesty field; snapshots that omit it are treated as
     * 'unknown' by {@link getConversationHistoryStatusV1}.
     */
    historyStatus?: DiscoveryHistoryStatusV1;
    turns: readonly ConversationTurnV1[];
    /** Additive proof metadata. Older V1 snapshots may omit this field. */
    proof?: ConversationSnapshotProofV1;
}>;

export type ConversationSnapshotProofV1 = Readonly<{
    /** Compatibility description of how the active projection was established. */
    basis?: 'source' | 'hybrid' | 'host';
}>;

export type ConversationUnavailableReasonV1 =
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

export function createConversationPageDocumentKeyV1(
    platformId: string,
    pageEpochId: string,
): string {
    const normalizedPlatform = platformId.trim().toLowerCase();
    const normalizedPageEpoch = pageEpochId.trim().toLowerCase();
    return `${normalizedPlatform}:page:${encodeURIComponent(normalizedPageEpoch)}`;
}

/** Stable semantic identity for consumers that do not require a canonical route id. */
export function getConversationDocumentIdentityKeyV1(
    document: ConversationDocumentRefV1,
): string {
    return document.conversationId ?? document.key;
}

/**
 * Whole-conversation knowledge status of a snapshot. Snapshots produced
 * before the additive historyStatus field default to 'unknown': they do not
 * claim knowledge they cannot prove.
 */
export function getConversationHistoryStatusV1(
    snapshot: ConversationSnapshotV1,
): DiscoveryHistoryStatusV1 {
    return snapshot.historyStatus ?? 'unknown';
}

export function isConversationDocumentRefV1(value: unknown): value is ConversationDocumentRefV1 {
    if (!isRecord(value)) return false;
    if (
        !isNonEmptyString(value.key)
        || !isNonEmptyString(value.platformId)
        || !isOptionalString(value.title)
        || !isOptionalString(value.canonicalUrl)
    ) return false;
    const identityKind = value.identityKind ?? 'canonical';
    if (identityKind === 'page') {
        return value.conversationId === null
            && value.key.startsWith(`${value.platformId.trim().toLowerCase()}:page:`)
            && value.key.length > `${value.platformId.trim().toLowerCase()}:page:`.length;
    }
    return identityKind === 'canonical'
        && isNonEmptyString(value.conversationId)
        && value.key === createConversationDocumentKeyV1(value.platformId, value.conversationId);
}

export function isConversationSnapshotV1(value: unknown): value is ConversationSnapshotV1 {
    if (!isRecord(value)) return false;
    if (value.schemaVersion !== 1 || !isConversationDocumentRefV1(value.document)) return false;
    if (value.projectionId !== undefined && !isNonEmptyString(value.projectionId)) return false;
    if (!isNonEmptyString(value.contentToken)) return false;
    if (value.coverage !== 'complete') return false;
    if (
        value.historyStatus !== undefined
        && value.historyStatus !== 'unknown'
        && value.historyStatus !== 'partial'
        && value.historyStatus !== 'get'
        && value.historyStatus !== 'complete'
    ) return false;
    if (!Array.isArray(value.turns)) return false;
    if (value.proof !== undefined && !isConversationSnapshotProofV1(value.proof)) return false;

    const keys = new Set<string>();
    const turnIds = new Set<string>();
    const assistantIds = new Set<string>();
    const userIds = new Set<string>();
    return value.turns.every((turn, index) => {
        if (!isRecord(turn)) return false;
        const identity = turn.identity;
        if (!isRecord(identity)) return false;
        if (!isNonEmptyString(turn.key) || keys.has(turn.key)) return false;
        if (typeof turn.ordinal !== 'number' || !Number.isInteger(turn.ordinal) || turn.ordinal <= 0) return false;
        if (turn.ordinal !== index + 1) return false;
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
    if (
        value.basis !== undefined
        && value.basis !== 'source'
        && value.basis !== 'hybrid'
        && value.basis !== 'host'
    ) return false;
    return Object.keys(value).every((key) => key === 'basis');
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
