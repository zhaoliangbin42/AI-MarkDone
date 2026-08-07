/**
 * Sparse, page-scoped conversation discovery contract.
 *
 * The contract deliberately separates the complete host topology from the
 * subset of turns whose rendered bodies have been captured.  DOM objects are
 * content-runtime-only and never cross this seam.
 */

export type ConversationDocumentEpochV2 = Readonly<{
    documentEpochId: string;
    projectionId: string;
    documentKey: string;
    platformId: 'chatgpt';
    conversationId: string;
    canonicalUrl: string;
    title?: string;
}>;

export type ConversationEntryRefV2 = Readonly<{
    documentEpochId: string;
    projectionId: string;
    slotKey: string;
}>;

export type ConversationRevisionSetV2 = Readonly<{
    topology: number;
    content: number;
    materialization: number;
}>;

export type ConversationTokenSetV2 = Readonly<{
    topologyToken: string;
    contentToken: string;
    materializationToken: string;
}>;

export type ConversationTurnIdentityV2 = Readonly<{
    turnId: string;
    userMessageId: string;
    assistantMessageId: string;
}>;

export type MaterializedRoleSurfaceV2 = Readonly<{
    role: 'user' | 'assistant';
    surfaceToken: string;
    anchorElement: HTMLElement;
    messageElement: HTMLElement;
    contentRootElement: HTMLElement | null;
}>;

export type ConversationEntryMaterializationV2 = Readonly<{
    kind: 'shell' | 'mounted';
    user: MaterializedRoleSurfaceV2 | null;
    assistant: MaterializedRoleSurfaceV2 | null;
}>;

export type ConversationIndexEntryV2 = Readonly<{
    ref: ConversationEntryRefV2;
    position: number;
    label:
        | Readonly<{ kind: 'placeholder'; text: string }>
        | Readonly<{ kind: 'prompt'; text: string }>;
    identity: ConversationTurnIdentityV2 | null;
    content:
        | Readonly<{ kind: 'ready'; turnToken: string }>
        | Readonly<{ kind: 'unavailable' }>;
    materialization: ConversationEntryMaterializationV2;
}>;

export type ConversationBodyV2 = Readonly<{
    markdown: string;
    text: string;
}>;

export type ConversationContentProvenanceV2 = Readonly<{
    authority: 'host-rendered';
    fidelity: 'verified-normalized';
    adapterId: 'chatgpt';
    compilerVersion: 'rendered-content-v2';
}>;

export type ConversationSealedTurnV2 = Readonly<{
    schemaVersion: 2;
    key: string;
    identity: ConversationTurnIdentityV2;
    user: ConversationBodyV2;
    assistant: ConversationBodyV2;
    turnToken: string;
    provenance: ConversationContentProvenanceV2;
}>;

export type ConversationTurnRevisionV2 = Readonly<{
    documentEpochId: string;
    projectionId: string;
    topologyToken: string;
    contentToken: string;
    turnToken: string;
}>;

export type ConversationTurnTargetV2 =
    | Readonly<{ kind: 'entry'; ref: ConversationEntryRefV2 }>
    | Readonly<{
        kind: 'assistant-message';
        documentKey: string;
        assistantMessageId: string;
    }>;

export type ConversationTurnReadResultV2 =
    | Readonly<{
        kind: 'ready';
        ref: ConversationEntryRefV2;
        position: number;
        turn: ConversationSealedTurnV2;
        revision: ConversationTurnRevisionV2;
    }>
    | Readonly<{
        kind: 'unavailable';
        reason: 'not-recognized' | 'stale-target' | 'identity-conflict';
    }>;

export type ConversationDiscoverySnapshotV2 =
    | Readonly<{
        kind: 'idle';
        document: null;
        entries: readonly [];
    }>
    | Readonly<{
        kind: 'unavailable';
        document: ConversationDocumentEpochV2 | null;
        reason:
            | 'unsupported-route'
            | 'host-root-unavailable'
            | 'ambiguous-topology'
            | 'topology-conflict';
        entries: readonly [];
    }>
    | Readonly<{
        kind: 'ready';
        document: ConversationDocumentEpochV2;
        revisions: ConversationRevisionSetV2;
        tokens: ConversationTokenSetV2;
        totalCount: number;
        readyCount: number;
        entries: readonly ConversationIndexEntryV2[];
    }>;

export type ConversationDiscoveryDomainV2 = 'topology' | 'content' | 'materialization';

export type ConversationDiscoveryChangeV2 = Readonly<{
    changed: readonly ConversationDiscoveryDomainV2[];
    affectedEntries: readonly ConversationEntryRefV2[];
    snapshot: ConversationDiscoverySnapshotV2;
}>;

export type ConversationLocateResultV2 =
    | Readonly<{
        kind: 'located';
        phase: 'already-mounted' | 'hydrated';
        ref: ConversationEntryRefV2;
        surfaceToken: string | null;
    }>
    | Readonly<{ kind: 'cancelled' }>
    | Readonly<{
        kind: 'unavailable';
        reason: 'stale-target' | 'slot-missing' | 'hydration-timeout' | 'identity-conflict';
    }>;

export interface ConversationDiscoveryPortV2 {
    read(): ConversationDiscoverySnapshotV2;
    subscribe(listener: (change: ConversationDiscoveryChangeV2) => void): () => void;
    /** Local DOM rescan/flush only. It never requests, scrolls or waits for history. */
    refresh(): Promise<ConversationDiscoverySnapshotV2>;
    readTurn(target: ConversationTurnTargetV2): ConversationTurnReadResultV2;
    resolveElement(element: HTMLElement): ConversationEntryRefV2 | null;
    locate(
        target: ConversationTurnTargetV2,
        options?: Readonly<{
            align?: 'start' | 'center';
            timeoutMs?: number;
            signal?: AbortSignal;
        }>,
    ): Promise<ConversationLocateResultV2>;
}

export type HostEntryKeyV2 = Readonly<{
    epochId: string;
    slotKey: string;
}>;

export type HostRoundSlotV2 = Readonly<{
    entry: HostEntryKeyV2;
    ordinal: number;
    userSlotKey: string;
    assistantSlotKey: string;
    estimatedHeightPx: Readonly<{ user: number | null; assistant: number | null }>;
}>;

export type HostRoleSurfaceV2 = Readonly<{
    entry: HostEntryKeyV2;
    role: 'user' | 'assistant';
    lifecycle: 'streaming' | 'stable' | 'unknown';
    turnId: string | null;
    messageId: string | null;
    surfaceToken: string;
    anchorElement: HTMLElement;
    messageElement: HTMLElement;
    contentRootElement: HTMLElement | null;
}>;

export type HostEvidenceFactV2 =
    | Readonly<{
        kind: 'topology-replaced';
        topologyToken: string;
        leadingUnpairedSlots: number;
        trailingUnpairedSlots: number;
        rounds: readonly HostRoundSlotV2[];
    }>
    | Readonly<{
        kind: 'topology-unavailable';
        reason: 'host-root-unavailable' | 'ambiguous-topology' | 'topology-conflict';
    }>
    | Readonly<{ kind: 'role-mounted'; surface: HostRoleSurfaceV2 }>
    | Readonly<{
        kind: 'role-unmounted';
        entry: HostEntryKeyV2;
        role: 'user' | 'assistant';
        surfaceToken: string;
    }>
    | Readonly<{
        kind: 'prompt-recognized';
        entry: HostEntryKeyV2;
        messageId: string;
        text: string;
        surfaceToken: string;
    }>
    | Readonly<{
        kind: 'projection-invalidated';
        fromOrdinal: number;
        reason: 'identity-replaced' | 'topology-incompatible';
    }>;

export type HostEvidenceBatchV2 = Readonly<{
    epochId: string;
    hostRevision: number;
    batchId: string;
    facts: readonly HostEvidenceFactV2[];
}>;

export interface ConversationHostSessionV2 {
    readonly initial: HostEvidenceBatchV2;
    snapshot(reason: 'explicit' | 'pageshow' | 'root-replaced'): HostEvidenceBatchV2;
    resolveElement(element: HTMLElement): HostEntryKeyV2 | null;
    scrollSlotIntoView(entry: HostEntryKeyV2, role: 'user' | 'assistant', align: 'start' | 'center'): boolean;
    dispose(): void;
}

export interface VirtualConversationHostAdapterV2 {
    readonly platformId: 'chatgpt';
    resolveDocument(): Readonly<{
        documentKey: string;
        conversationId: string;
        canonicalUrl: string;
        title?: string;
    }> | null;
    start(params: Readonly<{
        documentEpochId: string;
        onEvidence: (batch: HostEvidenceBatchV2) => void;
    }>): ConversationHostSessionV2;
}

export interface RenderedParserCapabilityV2 {
    isFormula(element: Element): boolean;
    readFormula(element: HTMLElement): Readonly<{ latex: string; display: boolean }> | null;
    isCodeBlock(element: Element): boolean;
    readCodeBlock(element: HTMLElement): Readonly<{ source: string; language: string | null }> | null;
    readEmbeddedArtifact?(element: HTMLElement): Readonly<{
        kind: 'image' | 'link' | 'report' | 'placeholder';
        markdown: string;
    }> | null;
}

export type RenderedContentCompilePolicyV2 = Readonly<{
    maxNodes: number;
    maxInputCodeUnits: number;
    maxOutputCodeUnits: number;
    maxFormulaCodeUnits: number;
    maxSliceMs: number;
    maxWallTimeMs: number;
}>;

export type RenderedTurnCompileRequestV2 = Readonly<{
    identity: ConversationTurnIdentityV2;
    userRootClone: HTMLElement;
    assistantRootClone: HTMLElement;
    userSurfaceToken: string;
    assistantSurfaceToken: string;
    parser: RenderedParserCapabilityV2;
    policy: RenderedContentCompilePolicyV2;
}>;

export type RenderedTurnCompileResultV2 =
    | Readonly<{
        kind: 'ready';
        user: ConversationBodyV2;
        assistant: ConversationBodyV2;
        semanticDigest: string;
        surfaceDigest: string;
        manifest: Readonly<{
            nodeCount: number;
            formulaCount: number;
            codeBlockCount: number;
            tableCount: number;
            imageCount: number;
        }>;
    }>
    | Readonly<{
        kind: 'rejected';
        reason:
            | 'empty-content'
            | 'unsupported-formula'
            | 'unsupported-code'
            | 'unsupported-artifact'
            | 'semantic-mismatch'
            | 'budget-exceeded'
            | 'compiler-error';
    }>;

export interface RenderedContentCompilerV2 {
    compile(request: RenderedTurnCompileRequestV2): Promise<RenderedTurnCompileResultV2>;
}

export type ConversationDiscoveryRuntimeV2 = Readonly<{
    discovery: ConversationDiscoveryPortV2;
    init(): void;
    dispose(): void;
}>;
