import { describe, expect, it } from 'vitest';
import { DiscoveryDiagnostics } from '@/services/content/DiscoveryDiagnostics';
import type {
    DiscoveryRepositoryFactsV1,
} from '@/contracts/conversationDiscoveryDiagnostics';

function repositoryFacts(overrides: Partial<DiscoveryRepositoryFactsV1> = {}): DiscoveryRepositoryFactsV1 {
    return {
        stateKind: 'ready',
        documentKind: 'canonical',
        basis: null,
        baselineGate: 'open',
        baselineAttempted: false,
        epoch: 1,
        turnCount: 0,
        deferredHostCount: 0,
        weakSealedCount: 0,
        ...overrides,
    };
}

describe('DiscoveryDiagnostics', () => {
    it('derives unknown history status before any basis exists', () => {
        const diagnostics = new DiscoveryDiagnostics();
        const snapshot = diagnostics.snapshot();

        expect(snapshot.historyStatus).toBe('unknown');
        expect(snapshot.basis).toBeNull();
        expect(snapshot.repository.stateKind).toBe('idle');
        expect(snapshot.bridgeUnavailable).toBe(false);
        expect(snapshot.captureSignalCount).toBe(0);
    });

    it('derives complete history from a source basis', () => {
        const diagnostics = new DiscoveryDiagnostics();
        diagnostics.setRepositoryFacts(repositoryFacts({ basis: 'source' }));
        expect(diagnostics.snapshot().historyStatus).toBe('complete');
    });

    it('derives complete history from a hybrid basis', () => {
        const diagnostics = new DiscoveryDiagnostics();
        diagnostics.setRepositoryFacts(repositoryFacts({ basis: 'hybrid' }));
        expect(diagnostics.snapshot().historyStatus).toBe('complete');
    });

    it('derives partial history for a canonical host-only pool', () => {
        const diagnostics = new DiscoveryDiagnostics();
        diagnostics.setRepositoryFacts(repositoryFacts({
            basis: 'host',
            documentKind: 'canonical',
        }));
        expect(diagnostics.snapshot().historyStatus).toBe('partial');
    });

    it('derives unknown history for a page-identity host-only pool', () => {
        const diagnostics = new DiscoveryDiagnostics();
        diagnostics.setRepositoryFacts(repositoryFacts({
            basis: 'host',
            documentKind: 'page',
        }));
        expect(diagnostics.snapshot().historyStatus).toBe('unknown');
    });

    it('aggregates bridge and host monitor facts into one frozen snapshot', () => {
        const diagnostics = new DiscoveryDiagnostics();
        diagnostics.setRepositoryFacts(repositoryFacts({
            basis: 'host',
            turnCount: 3,
            deferredHostCount: 2,
        }));
        diagnostics.setHostMonitorFacts({
            stableCaptureCount: 7,
            dirtyAssistantCount: 1,
            weakCompletionAdmissions: 2,
            compileRejections: Object.freeze({ 'empty-content': 3, 'budget-exceeded': 1 }),
        });
        diagnostics.setBridgeDiagnostics({
            version: 6,
            observedEligibleGets: 9,
            graphsAccepted: 0,
            graphsRejected: 4,
            capturesPublished: 0,
            evictions: 0,
            bytesSkipped: 1,
            parseFailures: 2,
            graphCount: 0,
        });
        diagnostics.setBridgeUnavailable(true);
        diagnostics.setCaptureSignalCount(5);

        const snapshot = diagnostics.snapshot();
        expect(snapshot).toMatchObject({
            schemaVersion: 1,
            basis: 'host',
            historyStatus: 'partial',
            repository: {
                turnCount: 3,
                deferredHostCount: 2,
            },
            hostMonitor: {
                stableCaptureCount: 7,
                dirtyAssistantCount: 1,
                weakCompletionAdmissions: 2,
                compileRejections: { 'empty-content': 3, 'budget-exceeded': 1 },
            },
            bridge: {
                version: 6,
                observedEligibleGets: 9,
                bytesSkipped: 1,
            },
            bridgeUnavailable: true,
            captureSignalCount: 5,
        });
        expect(Object.isFrozen(snapshot)).toBe(true);
        expect(Object.isFrozen(snapshot.hostMonitor.compileRejections)).toBe(true);
    });
});
