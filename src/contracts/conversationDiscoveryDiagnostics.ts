/**
 * Read-only diagnostics for the ChatGPT content discovery chain.
 *
 * Every value is a count or a status fact. Message bodies, prompts, user text,
 * tokens, and personal content must never enter this snapshot; the same
 * redaction discipline as the logging rules applies when this snapshot is
 * copied into feedback or logs.
 */

export type DiscoveryContentStateKindV1 = 'idle' | 'syncing' | 'ready' | 'unavailable';

export type DiscoverySnapshotBasisV1 = 'source' | 'hybrid' | 'host';

/**
 * Whether the obtained pool is known to cover the whole conversation.
 * Current DOM-only snapshots report 'partial'. The other values remain in the
 * stable snapshot schema for older persisted/exported consumers.
 */
export type DiscoveryHistoryStatusV1 = 'unknown' | 'partial' | 'complete';

export type DiscoveryRepositoryFactsV1 = Readonly<{
    stateKind: DiscoveryContentStateKindV1;
    documentKind: 'page' | 'canonical' | null;
    basis: DiscoverySnapshotBasisV1 | null;
    epoch: number;
    turnCount: number;
    /** Repository-authoritative whole-conversation knowledge status. */
    historyStatus: DiscoveryHistoryStatusV1;
}>;

export type DiscoveryHostMonitorFactsV1 = Readonly<{
    stableCaptureCount: number;
    dirtyAssistantCount: number;
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
}>;
