import type {
    DiscoveryDiagnosticsSnapshotV1,
    DiscoveryHostMonitorFactsV1,
    DiscoveryRepositoryFactsV1,
} from '../../contracts/conversationDiscoveryDiagnostics';

const EMPTY_REPOSITORY_FACTS: DiscoveryRepositoryFactsV1 = Object.freeze({
    stateKind: 'idle',
    documentKind: null,
    basis: null,
    epoch: 0,
    turnCount: 0,
    historyStatus: 'unknown',
});

const EMPTY_HOST_MONITOR_FACTS: DiscoveryHostMonitorFactsV1 = Object.freeze({
    stableCaptureCount: 0,
    dirtyAssistantCount: 0,
    compileRejections: Object.freeze({}),
});

/**
 * Aggregates the read-only facts published by the Repository and Host
 * Monitor into one diagnostics snapshot. It owns no
 * discovery state itself: producers push facts, consumers read the snapshot.
 */
export class DiscoveryDiagnostics {
    private repositoryFacts: DiscoveryRepositoryFactsV1 = EMPTY_REPOSITORY_FACTS;
    private hostMonitorFacts: DiscoveryHostMonitorFactsV1 = EMPTY_HOST_MONITOR_FACTS;

    setRepositoryFacts(next: DiscoveryRepositoryFactsV1): void {
        this.repositoryFacts = next;
    }

    setHostMonitorFacts(next: DiscoveryHostMonitorFactsV1): void {
        this.hostMonitorFacts = next;
    }

    snapshot(): DiscoveryDiagnosticsSnapshotV1 {
        return Object.freeze({
            schemaVersion: 1,
            generatedAt: Date.now(),
            basis: this.repositoryFacts.basis,
            historyStatus: this.repositoryFacts.historyStatus,
            repository: this.repositoryFacts,
            hostMonitor: this.hostMonitorFacts,
        });
    }
}
