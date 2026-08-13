import {
    ConversationContentAcquisitionError,
    freezeConversationSnapshotV1,
    isConversationSnapshotV1,
    type ConversationContentAcquisitionReasonV1,
    type ConversationContentCandidateV1,
    type ConversationContentSourceV1,
    type ConversationContentStateV1,
    type ConversationDocumentRefV1,
    type ConversationSnapshotProofV1,
    type ConversationSnapshotV1,
    type ConversationTurnV1,
    type ConversationUnavailableReasonV1,
} from '../../contracts/conversationContent';
import type {
    ConversationTurnReadPortV1,
    ConversationTurnReadResultV1,
} from '../../contracts/conversationDiscovery';
import type { DiscoveryRepositoryFactsV1 } from '../../contracts/conversationDiscoveryDiagnostics';
import type { ConversationTargetV1 } from '../../contracts/conversationMaterialization';

export type { ConversationContentCandidateV1 } from '../../contracts/conversationContent';
export { ConversationContentAcquisitionError } from '../../contracts/conversationContent';

export type ConversationHostTurnObservationV1 = Readonly<{
    turn: ConversationTurnV1;
    semanticDigest: string;
    captureId: string;
    revision: number;
    /** The typed assistant immediately before this turn in the observed host projection. */
    predecessorAssistantMessageId: string | null;
    /**
     * 'bounded-quiet' marks a turn admitted through the bounded quiet
     * confirmation without a strong completion signal; its body may be
     * upgraded later by stronger evidence. Absent in legacy producers and
     * treated as 'strong' at this seam, preserving the historical
     * never-rewrite behavior for them.
     */
    completionEvidence?: 'strong' | 'bounded-quiet';
}>;

export type ConversationContentRepositoryOptionsV1 = Readonly<{
    resolveDocument: () => ConversationDocumentRefV1 | null;
    readBaseline: (
        document: ConversationDocumentRefV1,
        signal: AbortSignal,
    ) => Promise<ConversationContentCandidateV1 | readonly ConversationContentCandidateV1[] | null>;
    baselineSignalDelayMs?: number;
}>;

type Flight = {
    epoch: number;
    controller: AbortController;
    promise: Promise<ConversationContentStateV1>;
    pendingSignal: boolean;
};

type BaselineGate = 'open' | 'inflight' | 'closed';

type StoredHostObservation = Readonly<{
    observation: ConversationHostTurnObservationV1;
    digest: string;
}>;

/**
 * Page-scoped content session and the single semantic SSOT.
 *
 * A website-owned Graph or one stable typed host batch may establish the same
 * monotonic pool. The first later overlapping Graph may prepend only verified
 * history; obtained bodies are never replaced. Public refreshes never reopen
 * the gate or replay Graph capture.
 */
export class ConversationContentRepository implements ConversationContentSourceV1, ConversationTurnReadPortV1 {
    private state: ConversationContentStateV1 = Object.freeze({
        kind: 'idle',
        document: null,
        snapshot: null,
    });
    private readonly listeners = new Set<(state: ConversationContentStateV1) => void>();
    private currentDocument: ConversationDocumentRefV1 | null = null;
    private epoch = 0;
    private projectionSequence = 0;
    private projectionId = 'conversation-projection:none';
    private flight: Flight | null = null;
    private baselineGate: BaselineGate = 'open';
    private baselineAttempted = false;
    private basis: ConversationSnapshotProofV1['basis'] | null = null;
    private turns: readonly ConversationTurnV1[] = Object.freeze([]);
    private readonly turnDigests = new Map<string, string>();
    private readonly weakSealedIds = new Set<string>();
    private readonly projectionDocumentKeys = new Set<string>();
    private readonly pendingHost = new Map<string, StoredHostObservation>();
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

    /** Admit a newly captured passive baseline signal only while this epoch's gate is open. */
    notifyBaselineCaptured(): void {
        if (this.disposed || this.baselineGate === 'closed') return;
        if (this.flight?.epoch === this.epoch) {
            this.flight.pendingSignal = true;
            return;
        }
        if (this.scheduledTimer !== null) return;
        const delay = Math.max(0, this.options.baselineSignalDelayMs ?? 150);
        this.scheduledTimer = setTimeout(() => {
            this.scheduledTimer = null;
            if (this.baselineGate === 'closed') return;
            if (this.flight?.epoch === this.epoch) {
                this.flight.pendingSignal = true;
                return;
            }
            void this.consumeBaseline(true);
        }, delay);
    }

    /** Enter the current route epoch and perform its one initial passive-memory read. */
    enterCurrentEpoch(): Promise<ConversationContentStateV1> {
        if (this.disposed) return Promise.resolve(this.state);
        const document = this.options.resolveDocument();
        if (!document) {
            this.unbindDocument();
            this.publish({ kind: 'idle', document: null, snapshot: null });
            return Promise.resolve(this.state);
        }
        this.switchDocument(document);
        if (document.identityKind === 'page' || document.conversationId === null) {
            return Promise.resolve(this.state);
        }
        if (this.baselineGate === 'closed') return Promise.resolve(this.state);
        if (this.flight?.epoch === this.epoch) return this.flight.promise;
        if (this.baselineAttempted) return Promise.resolve(this.state);
        return this.consumeBaseline(false);
    }

    private consumeBaseline(forceFromCaptureSignal: boolean): Promise<ConversationContentStateV1> {
        if (this.disposed || !this.currentDocument || this.baselineGate === 'closed') {
            return Promise.resolve(this.state);
        }
        if (this.flight?.epoch === this.epoch) {
            if (forceFromCaptureSignal) this.flight.pendingSignal = true;
            return this.flight.promise;
        }
        if (this.baselineAttempted && !forceFromCaptureSignal) return Promise.resolve(this.state);

        const epoch = this.epoch;
        const controller = new AbortController();
        this.baselineGate = 'inflight';
        this.baselineAttempted = true;
        if (!this.basis || this.turns.length === 0) {
            this.publish({
                kind: 'syncing',
                document: this.currentDocument!,
                snapshot: null,
            });
        }

        const promise = Promise.resolve()
            .then(() => this.options.readBaseline(this.currentDocument!, controller.signal))
            .then((baseline) => {
                if (this.isObsolete(epoch, controller)) return this.state;
                if (!baseline) {
                    throw new ConversationContentAcquisitionError('source-unavailable', { retryable: true });
                }
                const candidates = Array.isArray(baseline) ? baseline : [baseline];
                const candidate = candidates.find((item) => item.document.key === this.currentDocument?.key) ?? null;
                if (!candidate) {
                    throw new ConversationContentAcquisitionError('source-unavailable', { retryable: true });
                }
                const accepted = this.acceptBaseline(candidate, this.currentDocument!);
                this.baselineGate = accepted ? 'closed' : 'open';
                this.flushPendingHost();
                this.publishProjection();
                return this.state;
            })
            .catch((error: unknown) => {
                if (this.isObsolete(epoch, controller)) return this.state;
                this.baselineGate = 'open';
                const normalized = normalizeAcquisitionError(error);
                if (this.basis && this.turns.length > 0) {
                    this.publishProjection();
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
                if (this.flight?.promise !== promise) return;
                const pendingSignal = this.flight.pendingSignal;
                this.flight = null;
                if (pendingSignal && !this.disposed && this.baselineGate === 'open') {
                    void this.consumeBaseline(true);
                }
            });

        this.flight = { epoch, controller, promise, pendingSignal: false };
        return promise;
    }

    /** Flush already-observed local work only. It may await an in-flight
     * baseline admission but never starts or retries one.
     */
    refresh(): Promise<ConversationContentStateV1> {
        if (this.flight?.epoch === this.epoch) return this.flight.promise;
        return Promise.resolve(this.state);
    }

    /** Read-only diagnostics facts for the discovery diagnostics snapshot. */
    readDiagnosticsFacts(): DiscoveryRepositoryFactsV1 {
        return {
            stateKind: this.state.kind,
            // The contract defaults an absent identityKind to 'canonical';
            // mirror that normalization here so facts never report null for
            // a bound canonical document.
            documentKind: this.currentDocument
                ? (this.currentDocument.identityKind ?? 'canonical')
                : null,
            basis: this.basis ?? null,
            baselineGate: this.baselineGate,
            baselineAttempted: this.baselineAttempted,
            epoch: this.epoch,
            turnCount: this.turns.length,
            deferredHostCount: this.pendingHost.size,
            weakSealedCount: this.weakSealedIds.size,
        };
    }

    /** Bind a canonical route without forcing a second passive read. */
    bindCurrentDocument(): void {
        if (this.disposed) return;
        const document = this.options.resolveDocument();
        if (!document) return;
        this.switchDocument(document);
    }

    /** Start another id-less conversation inside the same page runtime. */
    beginNewPageConversation(): boolean {
        return this.resetCurrentPageConversation(true);
    }

    /** Atomically replace one id-less page projection with a verified host batch. */
    replaceCurrentPageConversationHostBatch(
        observations: readonly ConversationHostTurnObservationV1[],
    ): ConversationContentStateV1 {
        const admissible = observations.filter((observation) => (
            Boolean(observation.turn.identity.userMessageId?.trim())
        ));
        if (admissible.length === 0) return this.state;
        try {
            const assistantIds = new Set<string>();
            admissible.forEach((observation, index) => {
                const turn = validateAndFreezeTurn(observation.turn, index + 1, true);
                const assistantMessageId = turn.identity.assistantMessageId;
                if (!observation.semanticDigest.trim() || assistantIds.has(assistantMessageId)) {
                    throw new Error('invalid host replacement batch');
                }
                const expectedPredecessor = index === 0
                    ? null
                    : admissible[index - 1]!.turn.identity.assistantMessageId;
                if (observation.predecessorAssistantMessageId !== expectedPredecessor) {
                    throw new Error('non-contiguous host replacement batch');
                }
                assistantIds.add(assistantMessageId);
            });
        } catch {
            return this.state;
        }
        if (!this.resetCurrentPageConversation(false)) return this.state;
        return this.ingestHostBatch(admissible);
    }

    private resetCurrentPageConversation(publishSyncing: boolean): boolean {
        if (this.disposed) return false;
        const document = this.options.resolveDocument();
        if (
            !document
            || document.identityKind !== 'page'
            || document.conversationId !== null
            || this.currentDocument?.key !== document.key
        ) return false;
        if (this.scheduledTimer !== null) clearTimeout(this.scheduledTimer);
        this.scheduledTimer = null;
        this.epoch += 1;
        this.flight?.controller.abort();
        this.flight = null;
        this.currentDocument = freezeDocument(document);
        this.baselineGate = 'open';
        this.baselineAttempted = false;
        this.basis = null;
        this.turns = Object.freeze([]);
        this.turnDigests.clear();
        this.weakSealedIds.clear();
        this.pendingHost.clear();
        this.projectionDocumentKeys.clear();
        this.projectionDocumentKeys.add(this.currentDocument.key);
        if (publishSyncing) {
            this.startProjection();
            this.publish({
                kind: 'syncing',
                document: this.currentDocument,
                snapshot: null,
            });
        }
        return true;
    }

    /** Admit one compiler-verified host turn into the active monotonic pool. */
    ingestHostTurn(observation: ConversationHostTurnObservationV1): ConversationContentStateV1 {
        return this.ingestHostBatch([observation]);
    }

    /**
     * Re-run the pending-host flush on demand. New host evidence normally
     * drives the retry; this bounded re-evaluation covers quiet periods after
     * a capture left deferred work behind. Returns the remaining deferred
     * count so callers can decide whether another attempt is worthwhile.
     */
    reevaluateDeferredHost(): number {
        if (this.disposed) return this.pendingHost.size;
        const progressed = this.flushPendingHost();
        // Only a flush that actually changed the pool is a semantic change;
        // an unchanged pool must not recompute/publish a new projection.
        if (progressed && this.turns.length > 0 && this.currentDocument) this.publishProjection();
        return this.pendingHost.size;
    }

    /** Admit one stable host window and publish at most one immutable projection. */
    ingestHostBatch(observations: readonly ConversationHostTurnObservationV1[]): ConversationContentStateV1 {
        if (this.disposed) return this.state;
        const admissible = observations.filter((observation) => (
            Boolean(observation.turn.identity.userMessageId?.trim())
        ));
        if (admissible.length === 0) return this.state;
        const document = this.options.resolveDocument();
        if (!document) {
            for (const observation of admissible) this.queueHost(observation);
            return this.state;
        }
        this.switchDocument(document);
        for (const observation of admissible) this.queueHost(observation);

        if (!this.basis) {
            this.basis = 'host';
            this.startProjection();
        }

        this.flushPendingHost();
        if (this.turns.length > 0) this.publishProjection();
        return this.state;
    }

    isCurrent(contentToken: string): boolean {
        return this.state.kind !== 'idle'
            && this.state.kind !== 'unavailable'
            && this.state.snapshot?.contentToken === contentToken;
    }

    readTurn(target: ConversationTargetV1): ConversationTurnReadResultV1 {
        const snapshot = this.state.snapshot;
        if (!snapshot || !this.projectionDocumentKeys.has(target.documentKey)) {
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
        return {
            kind: 'ready',
            target: Object.freeze({ ...target }),
            turn,
            contentToken: snapshot.contentToken,
        };
    }

    dispose(): void {
        this.disposed = true;
        if (this.scheduledTimer !== null) clearTimeout(this.scheduledTimer);
        this.scheduledTimer = null;
        this.epoch += 1;
        this.flight?.controller.abort();
        this.flight = null;
        this.listeners.clear();
    }

    private acceptBaseline(
        candidate: ConversationContentCandidateV1,
        expectedDocument: ConversationDocumentRefV1,
    ): boolean {
        if (candidate.document.key !== expectedDocument.key) {
            throw new ConversationContentAcquisitionError('identity-conflict', { retryable: false });
        }
        if (candidate.origin === 'host' || candidate.turns.length === 0) {
            throw new ConversationContentAcquisitionError('invalid-payload', { retryable: false });
        }
        const turns = candidate.turns.map((turn, index) => validateAndFreezeTurn(turn, index + 1));
        if (new Set(turns.map((turn) => turn.identity.assistantMessageId)).size !== turns.length) {
            throw new ConversationContentAcquisitionError('identity-conflict', { retryable: false });
        }
        if (this.basis === 'host' && this.turns.length > 0) {
            const sourceIndexes = new Map(
                turns.map((turn, index) => [turn.identity.assistantMessageId, index] as const),
            );
            const firstHostId = this.turns[0]!.identity.assistantMessageId;
            const firstHostIndex = sourceIndexes.get(firstHostId);
            if (firstHostIndex === undefined) return false;
            if (!sameTurnIdentity(this.turns[0]!, turns[firstHostIndex]!)) return false;

            let previousSourceIndex = firstHostIndex - 1;
            for (const hostTurn of this.turns) {
                const sourceIndex = sourceIndexes.get(hostTurn.identity.assistantMessageId);
                if (sourceIndex === undefined) continue;
                if (!sameTurnIdentity(hostTurn, turns[sourceIndex]!)) return false;
                if (sourceIndex <= previousSourceIndex) return false;
                previousSourceIndex = sourceIndex;
            }

            const maintainedIds = new Set(this.turns.map((turn) => turn.identity.assistantMessageId));
            const prefix = turns
                .slice(0, firstHostIndex)
                .filter((turn) => !maintainedIds.has(turn.identity.assistantMessageId));
            // The Graph is stronger authority than bounded-quiet DOM evidence:
            // upgrade weak-sealed maintained bodies from overlapping source
            // turns in place (identity, order and ordinals stay unchanged).
            const upgradedMaintained = this.turns.map((hostTurn) => {
                const sourceIndex = sourceIndexes.get(hostTurn.identity.assistantMessageId);
                if (sourceIndex === undefined || !this.weakSealedIds.has(hostTurn.identity.assistantMessageId)) {
                    return hostTurn;
                }
                const sourceTurn = turns[sourceIndex]!;
                const next = { ...sourceTurn, ordinal: hostTurn.ordinal };
                this.turnDigests.set(hostTurn.identity.assistantMessageId, digestTurnContent(next));
                this.weakSealedIds.delete(hostTurn.identity.assistantMessageId);
                return next;
            });
            this.turns = freezeTurns([...prefix, ...upgradedMaintained]);
            for (const turn of prefix) {
                this.turnDigests.set(turn.identity.assistantMessageId, digestTurnContent(turn));
            }
            this.basis = 'hybrid';
            return true;
        }
        this.turns = Object.freeze(turns);
        this.turnDigests.clear();
        this.weakSealedIds.clear();
        for (const turn of turns) this.turnDigests.set(turn.identity.assistantMessageId, digestTurnContent(turn));
        this.basis = 'source';
        this.startProjection();
        return true;
    }

    private flushPendingHost(): boolean {
        if (!this.basis || !this.currentDocument) return false;
        let progressed = false;
        while (true) {
            let changedThisPass = false;
            for (const [assistantMessageId, stored] of Array.from(this.pendingHost.entries())) {
                const result = this.applyHostObservation(stored.observation, stored.digest);
                if (result === 'deferred') continue;
                this.pendingHost.delete(assistantMessageId);
                changedThisPass = result === 'changed' || changedThisPass;
            }
            if (!changedThisPass) break;
            progressed = true;
        }
        return progressed;
    }

    private applyHostObservation(
        observation: ConversationHostTurnObservationV1,
        digest: string,
    ): 'changed' | 'duplicate' | 'deferred' | 'rejected' {
        let incoming: ConversationTurnV1;
        try {
            incoming = validateAndFreezeTurn(observation.turn, 1, true);
        } catch {
            return 'rejected';
        }
        const evidence = observation.completionEvidence ?? 'strong';
        const incomingId = incoming.identity.assistantMessageId;
        const existingIndex = this.turns.findIndex((turn) => turn.identity.assistantMessageId === incomingId);
        if (existingIndex >= 0) {
            if (this.weakSealedIds.has(incomingId) && evidence === 'strong') {
                // A weak-sealed body was admitted without a strong completion
                // signal. Stronger evidence for the same typed identity may
                // upgrade it in place; equal evidence never rewrites.
                const existing = this.turns[existingIndex]!;
                if (this.turnDigests.get(incomingId) === digest) {
                    this.weakSealedIds.delete(incomingId);
                    return 'duplicate';
                }
                const next = this.turns.map((turn, index) => (
                    index === existingIndex ? { ...incoming, ordinal: existing.ordinal } : turn
                ));
                this.turns = freezeTurns(next);
                this.turnDigests.set(incomingId, digest);
                this.weakSealedIds.delete(incomingId);
                return 'changed';
            }
            // Once a message has entered the maintained cache, it is the
            // current authority. A later DOM copy with the same typed identity
            // is a remount or a host rewrite, not a reason to invalidate the
            // whole conversation.
            return 'duplicate';
        }

        if (this.turns.length === 0) {
            if (this.basis !== 'host' || observation.predecessorAssistantMessageId !== null) return 'deferred';
            this.appendHostTurn(incoming, digest, evidence);
            return 'changed';
        }

        const predecessorId = observation.predecessorAssistantMessageId;
        if (!predecessorId) return 'deferred';
        const predecessorIndex = this.turns.findIndex((turn) => turn.identity.assistantMessageId === predecessorId);
        if (predecessorIndex < 0) return 'deferred';

        if (predecessorIndex === this.turns.length - 1) {
            this.appendHostTurn(incoming, digest, evidence);
            return 'changed';
        }

        // Only the current tail is appendable. A DOM candidate that points
        // into an older window is held for a later observation instead of
        // replacing or invalidating maintained content.
        return 'deferred';
    }

    private appendHostTurn(turn: ConversationTurnV1, digest: string, evidence: 'strong' | 'bounded-quiet'): void {
        const next = [...this.turns, { ...turn, ordinal: this.turns.length + 1 }];
        this.turns = freezeTurns(next);
        this.turnDigests.set(turn.identity.assistantMessageId, digest);
        if (evidence === 'bounded-quiet') this.weakSealedIds.add(turn.identity.assistantMessageId);
        if (this.basis === 'source') this.basis = 'hybrid';
    }

    private publishProjection(): void {
        const snapshot = this.buildProjectionSnapshot();
        if (!snapshot || !this.currentDocument) return;
        this.publish({
            kind: 'ready',
            document: this.currentDocument,
            snapshot,
        });
    }

    private buildProjectionSnapshot(): ConversationSnapshotV1 | null {
        if (!this.currentDocument || !this.basis || this.turns.length === 0) return null;
        const proof: ConversationSnapshotProofV1 = Object.freeze({ basis: this.basis });
        const snapshotWithoutToken = {
            schemaVersion: 1 as const,
            document: this.currentDocument,
            projectionId: this.projectionId,
            coverage: 'complete' as const,
            turns: this.turns,
            proof,
        };
        const snapshot = freezeConversationSnapshotV1({
            ...snapshotWithoutToken,
            contentToken: createContentToken(snapshotWithoutToken),
        });
        if (!isConversationSnapshotV1(snapshot)) {
            throw new ConversationContentAcquisitionError('invalid-payload', { retryable: false });
        }
        return snapshot;
    }

    private startProjection(): void {
        this.projectionId = `conversation-projection:${this.epoch}:${++this.projectionSequence}`;
    }

    private queueHost(observation: ConversationHostTurnObservationV1): void {
        const assistantMessageId = observation.turn.identity.assistantMessageId.trim();
        if (!assistantMessageId || !observation.semanticDigest.trim()) return;
        const digest = digestTurnContent(observation.turn);
        const existing = this.pendingHost.get(assistantMessageId);
        if (existing && existing.observation.revision > observation.revision) return;
        this.pendingHost.set(assistantMessageId, Object.freeze({ observation, digest }));
    }

    private switchDocument(document: ConversationDocumentRefV1): void {
        const nextKey = document.key;
        const previousKey = this.currentDocument?.key ?? null;
        if (nextKey === previousKey) {
            if (this.currentDocument && !sameDisplayDocument(this.currentDocument, document)) {
                this.currentDocument = freezeDocument(document);
            }
            return;
        }

        const promotesPageIdentity = this.currentDocument?.identityKind === 'page'
            && document.identityKind !== 'page'
            && document.conversationId !== null;
        if (promotesPageIdentity) {
            if (this.currentDocument) this.projectionDocumentKeys.add(this.currentDocument.key);
            this.currentDocument = freezeDocument(document);
            this.projectionDocumentKeys.add(this.currentDocument.key);
            this.baselineGate = 'open';
            this.baselineAttempted = false;
            if (this.turns.length > 0) {
                this.publishProjection();
            } else {
                this.publish({
                    kind: 'syncing',
                    document: this.currentDocument,
                    snapshot: null,
                });
            }
            return;
        }

        const preserveUnboundHostBuffer = previousKey === null && this.turns.length === 0;
        if (this.scheduledTimer !== null) clearTimeout(this.scheduledTimer);
        this.scheduledTimer = null;
        this.epoch += 1;
        this.flight?.controller.abort();
        this.flight = null;
        this.currentDocument = freezeDocument(document);
        this.baselineGate = 'open';
        this.baselineAttempted = false;
        this.basis = null;
        this.turns = Object.freeze([]);
        this.turnDigests.clear();
        this.weakSealedIds.clear();
        this.projectionDocumentKeys.clear();
        this.projectionDocumentKeys.add(this.currentDocument.key);
        if (!preserveUnboundHostBuffer) this.pendingHost.clear();
        this.startProjection();
        this.publish({
            kind: 'syncing',
            document: this.currentDocument,
            snapshot: null,
        });
        if (preserveUnboundHostBuffer && this.pendingHost.size > 0) {
            this.basis = 'host';
            this.flushPendingHost();
            if (this.turns.length > 0) this.publishProjection();
        }
    }

    private unbindDocument(): void {
        if (this.currentDocument === null) return;
        if (this.scheduledTimer !== null) clearTimeout(this.scheduledTimer);
        this.scheduledTimer = null;
        this.epoch += 1;
        this.flight?.controller.abort();
        this.flight = null;
        this.currentDocument = null;
        this.baselineGate = 'open';
        this.baselineAttempted = false;
        this.basis = null;
        this.turns = Object.freeze([]);
        this.turnDigests.clear();
        this.weakSealedIds.clear();
        this.projectionDocumentKeys.clear();
        this.pendingHost.clear();
    }

    private isObsolete(epoch: number, controller: AbortController): boolean {
        return controller.signal.aborted || this.disposed || epoch !== this.epoch;
    }

    private publishUnavailable(
        document: ConversationDocumentRefV1 | null,
        reason: ConversationUnavailableReasonV1,
        retryable: boolean,
    ): void {
        this.publish({ kind: 'unavailable', document, snapshot: null, reason, retryable });
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

function validateAndFreezeTurn(
    turn: ConversationTurnV1,
    ordinal: number,
    requireUserMessageId = false,
): ConversationTurnV1 {
    if (
        !turn.userText.trim()
        || !turn.assistantMarkdown.trim()
        || !turn.identity.turnId.trim()
        || (requireUserMessageId && !turn.identity.userMessageId?.trim())
        || !turn.identity.assistantMessageId.trim()
    ) {
        throw new ConversationContentAcquisitionError('invalid-payload', { retryable: false });
    }
    return Object.freeze({
        ...turn,
        ordinal,
        identity: Object.freeze({ ...turn.identity }),
        ...(turn.assistantProvenance
            ? { assistantProvenance: Object.freeze({ ...turn.assistantProvenance }) }
            : {}),
    });
}

function freezeTurns(turns: readonly ConversationTurnV1[]): readonly ConversationTurnV1[] {
    return Object.freeze(turns.map((turn, index) => validateAndFreezeTurn(turn, index + 1)));
}

function digestTurnContent(turn: ConversationTurnV1): string {
    return JSON.stringify({
        identity: turn.identity,
        userText: turn.userText,
        assistantMarkdown: turn.assistantMarkdown,
    });
}

function sameTurnIdentity(left: ConversationTurnV1, right: ConversationTurnV1): boolean {
    return left.identity.turnId === right.identity.turnId
        && left.identity.userMessageId === right.identity.userMessageId
        && left.identity.assistantMessageId === right.identity.assistantMessageId;
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

function toUnavailableReason(reason: ConversationContentAcquisitionReasonV1): ConversationUnavailableReasonV1 {
    return reason === 'source-timeout' ? 'source-unavailable' : reason;
}

function sameDisplayDocument(left: ConversationDocumentRefV1, right: ConversationDocumentRefV1): boolean {
    return left.key === right.key
        && left.platformId === right.platformId
        && left.identityKind === right.identityKind
        && left.conversationId === right.conversationId
        && left.title === right.title
        && left.canonicalUrl === right.canonicalUrl;
}

function freezeDocument(document: ConversationDocumentRefV1): ConversationDocumentRefV1 {
    return Object.freeze({ ...document });
}

function createContentToken(snapshot: Omit<ConversationSnapshotV1, 'contentToken'>): string {
    const semantic = JSON.stringify({
        projectionId: snapshot.projectionId,
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

function sameState(left: ConversationContentStateV1, right: ConversationContentStateV1): boolean {
    if (left.kind !== right.kind) return false;
    if (left.document?.key !== right.document?.key) return false;
    if (left.snapshot?.contentToken !== right.snapshot?.contentToken) return false;
    if (JSON.stringify(left.snapshot?.proof) !== JSON.stringify(right.snapshot?.proof)) return false;
    if (left.kind === 'unavailable' && right.kind === 'unavailable') {
        return left.reason === right.reason && left.retryable === right.retryable;
    }
    return true;
}
