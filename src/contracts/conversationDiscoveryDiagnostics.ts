/**
 * Read-only diagnostics for the ChatGPT content discovery chain.
 *
 * Every value is a count or a status fact. Message bodies, prompts, user text,
 * tokens, and personal content must never enter this snapshot; the same
 * redaction discipline as the logging rules applies when this snapshot is
 * copied into feedback or logs.
 */

export type DiscoveryContentStateKindV1 = 'idle' | 'syncing' | 'ready' | 'unavailable';

export type DiscoveryBaselineGateV1 = 'open' | 'inflight' | 'closed';

export type DiscoverySnapshotBasisV1 = 'source' | 'hybrid' | 'host';

/**
 * Whether the obtained pool is known to cover the whole conversation.
 * 'unknown' before a document identity is bound or while the canonical
 * identity is absent; 'partial' when a canonical conversation runs without
 * an accepted Graph baseline; 'complete' once a validated Graph baseline
 * has been accepted.
 */
export type DiscoveryHistoryStatusV1 = 'unknown' | 'partial' | 'complete';

export type DiscoveryBridgeDiagnosticsV1 = Readonly<{
    version: number;
    /** Same-origin GETs the bridge recognized as candidates for the current conversation. */
    observedEligibleGets: number;
    /** Payloads that passed structure/identity validation and were remembered. */
    graphsAccepted: number;
    /** Candidate payloads rejected by Graph structure/identity validation. */
    graphsRejected: number;
    /** Capture events dispatched to the content runtime. */
    capturesPublished: number;
    /** Graphs evicted from the in-memory LRU store. */
    evictions: number;
    /** Eligible responses skipped because they exceeded the byte cap. */
    bytesSkipped: number;
    /** clone/json/traversal failures while observing eligible responses. */
    parseFailures: number;
    /** Graphs currently held in bridge memory. */
    graphCount: number;
}>;

export type DiscoveryRepositoryFactsV1 = Readonly<{
    stateKind: DiscoveryContentStateKindV1;
    documentKind: 'page' | 'canonical' | null;
    basis: DiscoverySnapshotBasisV1 | null;
    baselineGate: DiscoveryBaselineGateV1;
    baselineAttempted: boolean;
    epoch: number;
    turnCount: number;
    /** Host observations held back by missing predecessor/order evidence. */
    deferredHostCount: number;
    /** Turns admitted under bounded-quiet completion evidence only. */
    weakSealedCount: number;
    /** Repository-authoritative whole-conversation knowledge status. */
    historyStatus: DiscoveryHistoryStatusV1;
}>;

export type DiscoveryHostMonitorFactsV1 = Readonly<{
    stableCaptureCount: number;
    dirtyAssistantCount: number;
    /** Turns admitted through the bounded-quiet completion path. */
    weakCompletionAdmissions: number;
    /** Compiler rejection reason -> occurrence count. */
    compileRejections: Readonly<Record<string, number>>;
}>;

export type DiscoveryDiagnosticsSnapshotV1 = Readonly<{
    schemaVersion: 1;
    generatedAt: number;
    basis: DiscoverySnapshotBasisV1 | null;
    historyStatus: DiscoveryHistoryStatusV1;
    repository: DiscoveryRepositoryFactsV1;
    hostMonitor: DiscoveryHostMonitorFactsV1;
    bridge: DiscoveryBridgeDiagnosticsV1 | null;
    /** True when the page bridge could not be reached or reported a load failure. */
    bridgeUnavailable: boolean;
    /** Matched capture signals observed by the content-side adapter. */
    captureSignalCount: number;
}>;
