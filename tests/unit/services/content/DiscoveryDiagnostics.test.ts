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
        epoch: 1,
        turnCount: 0,
        historyStatus: 'unknown',
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
    });

    it('publishes the repository-authoritative history status', () => {
        const diagnostics = new DiscoveryDiagnostics();
        diagnostics.setRepositoryFacts(repositoryFacts({ basis: 'source', historyStatus: 'complete' }));
        expect(diagnostics.snapshot().historyStatus).toBe('complete');

        diagnostics.setRepositoryFacts(repositoryFacts({ basis: 'host', historyStatus: 'partial' }));
        expect(diagnostics.snapshot().historyStatus).toBe('partial');
    });

    it('aggregates repository and host monitor facts into one frozen snapshot', () => {
        const diagnostics = new DiscoveryDiagnostics();
        diagnostics.setRepositoryFacts(repositoryFacts({
            basis: 'host',
            historyStatus: 'partial',
            turnCount: 3,
        }));
        diagnostics.setHostMonitorFacts({
            stableCaptureCount: 7,
            dirtyAssistantCount: 1,
            compileRejections: Object.freeze({ 'empty-content': 3, 'budget-exceeded': 1 }),
        });

        const snapshot = diagnostics.snapshot();
        expect(snapshot).toMatchObject({
            schemaVersion: 1,
            basis: 'host',
            historyStatus: 'partial',
            repository: {
                turnCount: 3,
            },
            hostMonitor: {
                stableCaptureCount: 7,
                dirtyAssistantCount: 1,
                compileRejections: { 'empty-content': 3, 'budget-exceeded': 1 },
            },
        });
        expect(Object.isFrozen(snapshot)).toBe(true);
        expect(Object.isFrozen(snapshot.hostMonitor.compileRejections)).toBe(true);
    });
});
