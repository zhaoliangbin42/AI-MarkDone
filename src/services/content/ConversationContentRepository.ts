import {
    ConversationContentAcquisitionError,
    freezeConversationSnapshotV1,
    isConversationSnapshotV1,
    type ConversationContentSourceV1,
    type ConversationContentCandidateV1,
    type ConversationContentAcquisitionReasonV1,
    type ConversationContentStateV1,
    type ConversationDocumentRefV1,
    type ConversationSnapshotV1,
    type ConversationUnavailableReasonV1,
} from '../../contracts/conversationContent';
import type {
    ConversationEvidenceEventV1,
    ConversationTurnReadPortV1,
    ConversationTurnReadResultV1,
} from '../../contracts/conversationDiscovery';
import type { ConversationTargetV1 } from '../../contracts/conversationMaterialization';
import { ConversationEvidenceLedger } from './ConversationEvidenceLedger';

export type { ConversationContentCandidateV1 } from '../../contracts/conversationContent';
export { ConversationContentAcquisitionError } from '../../contracts/conversationContent';

export type ConversationContentRepositoryOptionsV1 = Readonly<{
    resolveDocument: () => ConversationDocumentRefV1 | null;
    acquire: (
        document: ConversationDocumentRefV1,
        signal: AbortSignal,
    ) => Promise<ConversationContentCandidateV1 | readonly ConversationContentCandidateV1[] | null>;
    reconcileDelayMs?: number;
}>;

type Flight = {
    epoch: number;
    controller: AbortController;
    promise: Promise<ConversationContentStateV1>;
    pending: boolean;
};

/**
 * The single coordinator/SSOT for semantic conversation content.  Signals
 * only schedule this class; consumers never perform their own discovery.
 */
export class ConversationContentRepository implements ConversationContentSourceV1, ConversationTurnReadPortV1 {
    private state: ConversationContentStateV1 = Object.freeze({
        kind: 'idle',
        document: null,
        snapshot: null,
    });
    private readonly listeners = new Set<(state: ConversationContentStateV1) => void>();
    private currentDocument: ConversationDocumentRefV1 | null = null;
    private lastGood: ConversationSnapshotV1 | null = null;
    private epoch = 0;
    private flight: Flight | null = null;
    private readonly ledger = new ConversationEvidenceLedger();
    private sourceEvidenceRevision = 0;
    private scheduledTimer: ReturnType<typeof setTimeout> | null = null;
    private disposed = false;

    constructor(private readonly options: ConversationContentRepositoryOptionsV1) {}

    read(): ConversationContentStateV1 {
        return this.state;
    }

    subscribe(listener: (state: ConversationContentStateV1) => void): () => void {
        this.listeners.add(listener);
        listener(this.state);
        return () => this.listeners.delete(listener);
    }

    /** Schedule a normal coalesced signal. */
    scheduleReconcile(): void {
        if (this.disposed) return;
        if (this.flight?.epoch === this.epoch) {
            // A DOM/bridge signal can arrive while the single acquisition is
            // still waiting on passive capture. Reconcile it once the current
            // flight settles instead of dropping the latest page state.
            this.flight.pending = true;
            return;
        }
        if (this.scheduledTimer !== null) return;
        const delay = Math.max(0, this.options.reconcileDelayMs ?? 150);
        this.scheduledTimer = setTimeout(() => {
            this.scheduledTimer = null;
            if (this.flight?.epoch === this.epoch) {
                this.flight.pending = true;
                return;
            }
            void this.reconcile();
        }, delay);
    }

    /** Route/PageIndex/bootstrap callers use this for an immediate signal. */
    reconcile(): Promise<ConversationContentStateV1> {
        if (this.disposed) return Promise.resolve(this.state);
        if (this.scheduledTimer !== null) {
            clearTimeout(this.scheduledTimer);
            this.scheduledTimer = null;
        }

        const document = this.options.resolveDocument();
        if (!document) {
            this.switchDocument(null);
            this.publishUnavailable(null, 'unsupported-route', false);
            return Promise.resolve(this.state);
        }
        this.switchDocument(document);

        if (this.flight?.epoch === this.epoch) {
            return this.flight.promise;
        }

        const epoch = this.epoch;
        const controller = new AbortController();
        this.publish({
            kind: 'syncing',
            document: this.currentDocument!,
            snapshot: this.lastGood,
        });

        const promise = Promise.resolve()
            .then(() => this.options.acquire(this.currentDocument!, controller.signal))
            .then((acquisition) => {
                if (this.isObsolete(epoch, controller)) return this.state;
                if (!acquisition) {
                    throw new ConversationContentAcquisitionError(
                        'source-unavailable',
                        { retryable: true },
                    );
                }
                const candidates = Array.isArray(acquisition) ? acquisition : [acquisition];
                if (candidates.length === 0) {
                    throw new ConversationContentAcquisitionError(
                        'source-unavailable',
                        { retryable: true },
                    );
                }
                let snapshot: ConversationSnapshotV1 | null = null;
                for (const candidate of candidates) {
                    snapshot = this.ingestCandidate(candidate, this.currentDocument!);
                }
                if (!snapshot) {
                    throw new ConversationContentAcquisitionError(
                        'source-unavailable',
                        { retryable: true },
                    );
                }
                this.lastGood = snapshot;
                this.publish({
                    kind: 'ready',
                    document: this.currentDocument!,
                    snapshot,
                });
                return this.state;
            })
            .catch((error: unknown) => {
                if (this.isObsolete(epoch, controller)) return this.state;
                const normalized = normalizeAcquisitionError(error);
                if (this.lastGood && this.lastGood.document.key === this.currentDocument?.key) {
                    this.publish({
                        kind: 'stale',
                        document: this.currentDocument!,
                        snapshot: this.lastGood,
                        reason: normalized.reason === 'identity-conflict'
                            ? 'identity-conflict'
                            : normalized.reason === 'source-timeout'
                                ? 'source-timeout'
                                : 'source-unavailable',
                    });
                } else {
                    this.publishUnavailable(
                        this.currentDocument,
                        toUnavailableReason(normalized.reason),
                        normalized.retryable,
                    );
                }
                return this.state;
            })
            .finally(() => {
                if (this.flight?.promise === promise) {
                    const pending = this.flight.pending;
                    this.flight = null;
                    if (pending && !this.disposed) void this.reconcile();
                }
            });

        this.flight = { epoch, controller, promise, pending: false };
        return promise;
    }

    refresh(): Promise<ConversationContentStateV1> {
        return this.reconcile();
    }

    /** Re-enable a page-scoped repository after the content runtime is toggled back on. */
    resume(): void {
        this.disposed = false;
    }

    isCurrent(contentToken: string): boolean {
        return this.state.kind !== 'idle'
            && this.state.kind !== 'unavailable'
            && this.state.snapshot?.contentToken === contentToken;
    }

    /** Read one turn that belongs to the last published source snapshot. */
    readTurn(target: ConversationTargetV1): ConversationTurnReadResultV1 {
        const snapshot = this.state.snapshot;
        if (!snapshot || snapshot.document.key !== target.documentKey) {
            return {
                kind: 'unavailable',
                target: Object.freeze({ ...target }),
                reason: snapshot ? 'document-mismatch' : 'source-unavailable',
            };
        }
        const turn = snapshot.turns.find((candidate) => (
            candidate.identity.turnId === target.turnId
            && candidate.identity.assistantMessageId === target.assistantMessageId
            && (target.userMessageId === undefined || candidate.identity.userMessageId === target.userMessageId)
        ));
        if (!turn) {
            return {
                kind: 'unavailable',
                target: Object.freeze({ ...target }),
                reason: 'not-recognized',
            };
        }
        return this.ledger.readTurn(target);
    }

    /** Dispose cancels pending work; it never changes the public document data. */
    dispose(): void {
        this.disposed = true;
        if (this.scheduledTimer !== null) clearTimeout(this.scheduledTimer);
        this.scheduledTimer = null;
        this.epoch += 1;
        this.flight?.controller.abort();
        this.flight = null;
        this.listeners.clear();
    }

    private switchDocument(document: ConversationDocumentRefV1 | null): void {
        const nextKey = document?.key ?? null;
        const previousKey = this.currentDocument?.key ?? null;
        if (nextKey === previousKey) {
            if (document && this.currentDocument && !sameDisplayDocument(this.currentDocument, document)) {
                this.currentDocument = freezeDocument(document);
                this.ledger.updateDocument(this.currentDocument);
                if (this.lastGood) this.lastGood = freezeSnapshotDocument(this.lastGood, this.currentDocument);
            }
            return;
        }
        this.epoch += 1;
        this.flight?.controller.abort();
        this.flight = null;
        this.currentDocument = document ? freezeDocument(document) : null;
        this.lastGood = null;
        this.sourceEvidenceRevision = 0;
        this.ledger.reset(this.currentDocument, this.currentDocument ? `document-epoch:${this.epoch}` : null);
        if (this.currentDocument) {
            this.publish({
                kind: 'syncing',
                document: this.currentDocument,
                snapshot: null,
            });
        }
    }

    private createSnapshot(
        candidate: ConversationContentCandidateV1,
        expectedDocument: ConversationDocumentRefV1,
    ): ConversationSnapshotV1 {
        if (candidate.document.key !== expectedDocument.key) {
            throw new ConversationContentAcquisitionError('identity-conflict', { retryable: false });
        }
        if (candidate.turns.length === 0) {
            throw new ConversationContentAcquisitionError('invalid-payload', { retryable: false });
        }
        candidate.turns.forEach((turn, index) => {
            if (
                !turn.userText.trim()
                || !turn.assistantMarkdown.trim()
                || turn.ordinal !== index + 1
                || !turn.identity.turnId.trim()
                || !turn.identity.assistantMessageId.trim()
            ) {
                throw new ConversationContentAcquisitionError('invalid-payload', { retryable: false });
            }
        });
        const turns = candidate.turns.map((turn) => ({
            ...turn,
            identity: { ...turn.identity },
        }));
        const snapshotWithoutToken = {
            schemaVersion: 1 as const,
            document: freezeDocument(expectedDocument),
            coverage: candidate.coverage,
            turns,
        };
        const contentToken = createContentToken(snapshotWithoutToken);
        const snapshot = freezeConversationSnapshotV1({
            ...snapshotWithoutToken,
            contentToken,
        });
        if (!isConversationSnapshotV1(snapshot)) {
            throw new ConversationContentAcquisitionError('invalid-payload', { retryable: false });
        }
        return snapshot;
    }

    private ingestCandidate(
        candidate: ConversationContentCandidateV1,
        expectedDocument: ConversationDocumentRefV1,
    ): ConversationSnapshotV1 {
        if (candidate.origin === 'host') {
            throw new ConversationContentAcquisitionError('invalid-payload', { retryable: false });
        }
        if (candidate.coverage !== 'complete' || candidate.tail === 'streaming') {
            throw new ConversationContentAcquisitionError('source-unavailable', { retryable: true });
        }
        const validated = this.createSnapshot(candidate, expectedDocument);
        const event: ConversationEvidenceEventV1 = {
            kind: 'source-batch',
            document: validated.document,
            epoch: `document-epoch:${this.epoch}`,
            revision: candidate.sourceRevision ?? ++this.sourceEvidenceRevision,
            captureId: candidate.captureId
                ?? `candidate:${candidate.coverage}:${validated.contentToken}`,
            branchKey: candidate.branchKey ?? expectedDocument.key,
            order: candidate.coverage === 'complete' ? 'complete' : 'partial',
            turns: validated.turns,
            gaps: candidate.coverage === 'complete'
                ? []
                : [{ kind: 'order', reason: 'source candidate covers a materialized or captured window' }],
        };
        const result = this.ledger.ingest(event);
        if (result.status === 'conflict') {
            throw new ConversationContentAcquisitionError('identity-conflict', { retryable: false });
        }
        const snapshot = result.view.snapshot;
        if (!snapshot || !hasCompleteDiscoveryProof(snapshot)) {
            throw new ConversationContentAcquisitionError('source-unavailable', { retryable: true });
        }
        return snapshot;
    }

    private isObsolete(epoch: number, controller: AbortController): boolean {
        return controller.signal.aborted || this.disposed || epoch !== this.epoch;
    }

    private publishUnavailable(
        document: ConversationDocumentRefV1 | null,
        reason: ConversationUnavailableReasonV1,
        retryable: boolean,
    ): void {
        this.publish({
            kind: 'unavailable',
            document,
            snapshot: null,
            reason,
            retryable,
        });
    }

    private publish(next: ConversationContentStateV1): void {
        if (sameState(this.state, next)) return;
        this.state = freezeState(next);
        for (const listener of Array.from(this.listeners)) {
            try {
                listener(this.state);
            } catch {
                // A failing consumer cannot prevent other consumers from observing state.
            }
        }
    }
}

function normalizeAcquisitionError(error: unknown): {
    reason: ConversationContentAcquisitionReasonV1;
    retryable: boolean;
} {
    if (error instanceof ConversationContentAcquisitionError) {
        return { reason: error.reason, retryable: error.retryable };
    }
    return { reason: 'source-unavailable', retryable: true };
}

function toUnavailableReason(
    reason: ConversationContentAcquisitionReasonV1,
): ConversationUnavailableReasonV1 {
    return reason === 'source-timeout' ? 'source-unavailable' : reason;
}

function sameDisplayDocument(
    left: ConversationDocumentRefV1,
    right: ConversationDocumentRefV1,
): boolean {
    return left.key === right.key
        && left.platformId === right.platformId
        && left.conversationId === right.conversationId
        && left.title === right.title
        && left.canonicalUrl === right.canonicalUrl;
}

function freezeDocument(document: ConversationDocumentRefV1): ConversationDocumentRefV1 {
    return Object.freeze({ ...document });
}

function freezeSnapshotDocument(
    snapshot: ConversationSnapshotV1,
    document: ConversationDocumentRefV1,
): ConversationSnapshotV1 {
    return freezeConversationSnapshotV1({ ...snapshot, document });
}

function createContentToken(
    snapshot: Omit<ConversationSnapshotV1, 'contentToken'>,
): string {
    const semantic = JSON.stringify({
        documentKey: snapshot.document.key,
        turns: snapshot.turns.map((turn) => ({
            key: turn.key,
            ordinal: turn.ordinal,
            identity: turn.identity,
            userText: turn.userText,
            assistantMarkdown: turn.assistantMarkdown,
            assistantProvenance: turn.assistantProvenance,
        })),
    });
    let hash = 2166136261;
    for (let index = 0; index < semantic.length; index += 1) {
        hash ^= semantic.charCodeAt(index);
        hash = Math.imul(hash, 16777619);
    }
    return `conversation-content-v1:${(hash >>> 0).toString(16).padStart(8, '0')}`;
}

function freezeState(state: ConversationContentStateV1): ConversationContentStateV1 {
    if (state.kind === 'idle') return Object.freeze({ ...state });
    if (state.kind === 'unavailable') {
        return Object.freeze({
            ...state,
            document: state.document ? freezeDocument(state.document) : null,
        });
    }
    if (state.kind === 'syncing') {
        return Object.freeze({
            ...state,
            document: freezeDocument(state.document),
            snapshot: state.snapshot ? freezeConversationSnapshotV1(state.snapshot) : null,
        });
    }
    return Object.freeze({
        ...state,
        document: freezeDocument(state.document),
        snapshot: freezeConversationSnapshotV1(state.snapshot),
    });
}

function sameState(
    left: ConversationContentStateV1,
    right: ConversationContentStateV1,
): boolean {
    if (left.kind !== right.kind) return false;
    if (left.document?.key !== right.document?.key) return false;
    if (left.snapshot?.contentToken !== right.snapshot?.contentToken) return false;
    if (left.snapshot?.coverage !== right.snapshot?.coverage) return false;
    if (JSON.stringify(left.snapshot?.proof) !== JSON.stringify(right.snapshot?.proof)) return false;
    if (left.kind === 'stale' && right.kind === 'stale') return left.reason === right.reason;
    if (left.kind === 'unavailable' && right.kind === 'unavailable') {
        return left.reason === right.reason && left.retryable === right.retryable;
    }
    return true;
}

function hasCompleteDiscoveryProof(snapshot: ConversationSnapshotV1): boolean {
    const proof = snapshot.proof;
    if (!proof) return snapshot.coverage === 'complete';
    return proof.order === 'complete'
        && proof.bodies === 'complete'
        && proof.tail === 'stable'
        && proof.gaps.length === 0;
}
