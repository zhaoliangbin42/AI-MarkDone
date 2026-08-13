import type {
    DiscoveryBridgeDiagnosticsV1,
    DiscoveryDiagnosticsSnapshotV1,
    DiscoveryHostMonitorFactsV1,
    DiscoveryRepositoryFactsV1,
} from '../../contracts/conversationDiscoveryDiagnostics';

const EMPTY_REPOSITORY_FACTS: DiscoveryRepositoryFactsV1 = Object.freeze({
    stateKind: 'idle',
    documentKind: null,
    basis: null,
    baselineGate: 'open',
    baselineAttempted: false,
    epoch: 0,
    turnCount: 0,
    deferredHostCount: 0,
    weakSealedCount: 0,
    historyStatus: 'unknown',
});

const EMPTY_HOST_MONITOR_FACTS: DiscoveryHostMonitorFactsV1 = Object.freeze({
    stableCaptureCount: 0,
    dirtyAssistantCount: 0,
    weakCompletionAdmissions: 0,
    compileRejections: Object.freeze({}),
});

/**
 * Aggregates the read-only facts published by the Repository, the Host
 * Monitor, and the page bridge into one diagnostics snapshot. It owns no
 * discovery state itself: producers push facts, consumers read the snapshot.
 */
export class DiscoveryDiagnostics {
    private repositoryFacts: DiscoveryRepositoryFactsV1 = EMPTY_REPOSITORY_FACTS;
    private hostMonitorFacts: DiscoveryHostMonitorFactsV1 = EMPTY_HOST_MONITOR_FACTS;
    private bridge: DiscoveryBridgeDiagnosticsV1 | null = null;
    private bridgeUnavailable = false;
    private captureSignalCount = 0;

    setRepositoryFacts(next: DiscoveryRepositoryFactsV1): void {
        this.repositoryFacts = next;
    }

    setHostMonitorFacts(next: DiscoveryHostMonitorFactsV1): void {
        this.hostMonitorFacts = next;
    }

    setBridgeDiagnostics(next: DiscoveryBridgeDiagnosticsV1 | null): void {
        this.bridge = next;
    }

    setBridgeUnavailable(unavailable: boolean): void {
        this.bridgeUnavailable = unavailable;
    }

    setCaptureSignalCount(count: number): void {
        this.captureSignalCount = count;
    }

    snapshot(): DiscoveryDiagnosticsSnapshotV1 {
        return Object.freeze({
            schemaVersion: 1,
            generatedAt: Date.now(),
            basis: this.repositoryFacts.basis,
            historyStatus: this.repositoryFacts.historyStatus,
            repository: this.repositoryFacts,
            hostMonitor: this.hostMonitorFacts,
            bridge: this.bridge,
            bridgeUnavailable: this.bridgeUnavailable,
            captureSignalCount: this.captureSignalCount,
        });
    }
}
