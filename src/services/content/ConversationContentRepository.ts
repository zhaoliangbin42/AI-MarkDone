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
    /** True only when a page-entry full scan proved that no typed messages existed. */
    emptyProven: boolean;
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
 * A website-owned graph is admitted through a once-only baseline gate. After
 * that gate closes, only stable typed host turns may extend the immutable
 * projection. Public refreshes never reopen the gate or replay graph capture.
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
    private projectionSequence = 0;
    private projectionId = 'conversation-projection:none';
    private flight: Flight | null = null;
    private baselineGate: BaselineGate = 'open';
    private baselineAttempted = false;
    private baselinePrefixLength = 0;
    private basis: ConversationSnapshotProofV1['basis'] | null = null;
    private tail: 'stable' | 'streaming' = 'stable';
    private turns: readonly ConversationTurnV1[] = Object.freeze([]);
    private readonly turnDigests = new Map<string, string>();
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
            this.publishUnavailable(null, 'unsupported-route', false);
            return Promise.resolve(this.state);
        }
        this.switchDocument(document);
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
        this.publish({
            kind: 'syncing',
            document: this.currentDocument!,
            snapshot: this.lastGood,
        });

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
                this.acceptBaseline(candidate, this.currentDocument!);
                this.baselineGate = 'closed';
                // Keep the accepted baseline prefix as last-good before merging
                // facts that may have been born before canonical route binding.
                // A historical conflict must retain this exact baseline.
                this.lastGood = this.buildProjectionSnapshot();
                this.flushPendingHost();
                if (this.state.kind !== 'stale') this.publishProjection();
                return this.state;
            })
            .catch((error: unknown) => {
                if (this.isObsolete(epoch, controller)) return this.state;
                this.baselineGate = 'open';
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

    /**
     * Flush already-observed local work only. It may await an in-flight
     * baseline admission but never starts or retries one.
     */
    refresh(): Promise<ConversationContentStateV1> {
        if (this.flight?.epoch === this.epoch) return this.flight.promise;
        return Promise.resolve(this.state);
    }

    /** Bind a canonical route without forcing a second passive read. */
    bindCurrentDocument(): void {
        if (this.disposed) return;
        const document = this.options.resolveDocument();
        if (!document) return;
        this.switchDocument(document);
    }

    /** Admit one compiler-verified host turn into the active immutable projection. */
    ingestHostTurn(observation: ConversationHostTurnObservationV1): ConversationContentStateV1 {
        if (this.disposed) return this.state;
        if (!observation.turn.identity.userMessageId?.trim()) return this.state;
        const document = this.options.resolveDocument();
        if (!document) {
            this.queueHost(observation);
            return this.state;
        }
        this.switchDocument(document);
        if (this.state.kind === 'stale') return this.state;
        this.queueHost(observation);

        if (!this.basis) {
            if (!observation.emptyProven) return this.state;
            this.baselineGate = 'closed';
            this.flight?.controller.abort();
            this.flight = null;
            this.basis = 'host-born';
            this.tail = 'stable';
            this.startProjection();
        }

        this.flushPendingHost();
        if (this.turns.length > 0 && this.read().kind !== 'stale') this.publishProjection();
        return this.state;
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
    ): void {
        if (candidate.document.key !== expectedDocument.key) {
            throw new ConversationContentAcquisitionError('identity-conflict', { retryable: false });
        }
        if (candidate.origin === 'host' || candidate.turns.length === 0) {
            throw new ConversationContentAcquisitionError('invalid-payload', { retryable: false });
        }
        if (candidate.coverage === 'partial' && candidate.tail !== 'streaming') {
            throw new ConversationContentAcquisitionError('source-unavailable', { retryable: true });
        }
        const turns = candidate.turns.map((turn, index) => validateAndFreezeTurn(turn, index + 1));
        if (new Set(turns.map((turn) => turn.identity.assistantMessageId)).size !== turns.length) {
            throw new ConversationContentAcquisitionError('identity-conflict', { retryable: false });
        }
        this.turns = Object.freeze(turns);
        this.turnDigests.clear();
        for (const turn of turns) this.turnDigests.set(turn.identity.assistantMessageId, digestTurnContent(turn));
        this.baselinePrefixLength = turns.length;
        this.basis = 'source';
        this.tail = candidate.tail === 'streaming' ? 'streaming' : 'stable';
        this.startProjection();
    }

    private flushPendingHost(): void {
        if (!this.basis || !this.currentDocument) return;
        let progressed = true;
        while (progressed) {
            progressed = false;
            for (const [assistantMessageId, stored] of Array.from(this.pendingHost.entries())) {
                const result = this.applyHostObservation(stored.observation, stored.digest);
                if (result === 'deferred') continue;
                this.pendingHost.delete(assistantMessageId);
                progressed = result === 'changed' || progressed;
            }
        }
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
        const incomingId = incoming.identity.assistantMessageId;
        const existingIndex = this.turns.findIndex((turn) => turn.identity.assistantMessageId === incomingId);
        if (existingIndex >= 0) {
            if (this.turnDigests.get(incomingId) === digest) return 'duplicate';
            if (existingIndex < this.baselinePrefixLength) {
                this.publishHistoricalConflict();
                return 'rejected';
            }
            this.replaceHostSuffix(existingIndex, incoming, digest);
            return 'changed';
        }

        if (this.turns.length === 0) {
            if (this.basis !== 'host-born' || observation.predecessorAssistantMessageId !== null) return 'deferred';
            this.appendHostTurn(incoming, digest);
            return 'changed';
        }

        const predecessorId = observation.predecessorAssistantMessageId;
        if (!predecessorId) return 'deferred';
        const predecessorIndex = this.turns.findIndex((turn) => turn.identity.assistantMessageId === predecessorId);
        if (predecessorIndex < 0) return 'deferred';

        if (predecessorIndex === this.turns.length - 1) {
            this.appendHostTurn(incoming, digest);
            return 'changed';
        }

        const replacementIndex = predecessorIndex + 1;
        if (replacementIndex < this.baselinePrefixLength) {
            this.publishHistoricalConflict();
            return 'rejected';
        }
        this.replaceHostSuffix(replacementIndex, incoming, digest);
        return 'changed';
    }

    private appendHostTurn(turn: ConversationTurnV1, digest: string): void {
        const next = [...this.turns, { ...turn, ordinal: this.turns.length + 1 }];
        this.turns = freezeTurns(next);
        this.turnDigests.set(turn.identity.assistantMessageId, digest);
        if (this.basis === 'source') this.basis = 'hybrid';
        this.tail = 'stable';
    }

    private replaceHostSuffix(index: number, turn: ConversationTurnV1, digest: string): void {
        const removed = this.turns.slice(index);
        for (const old of removed) this.turnDigests.delete(old.identity.assistantMessageId);
        const next = [
            ...this.turns.slice(0, index),
            { ...turn, ordinal: index + 1 },
        ];
        this.turns = freezeTurns(next);
        this.turnDigests.set(turn.identity.assistantMessageId, digest);
        if (this.basis === 'source') this.basis = 'hybrid';
        this.tail = 'stable';
        this.startProjection();
    }

    private publishHistoricalConflict(): void {
        if (!this.lastGood || !this.currentDocument) return;
        this.publish({
            kind: 'stale',
            document: this.currentDocument,
            snapshot: this.lastGood,
            reason: 'identity-conflict',
        });
    }

    private publishProjection(): void {
        const snapshot = this.buildProjectionSnapshot();
        if (!snapshot || !this.currentDocument) return;
        this.lastGood = snapshot;
        this.publish({
            kind: 'ready',
            document: this.currentDocument,
            snapshot,
        });
    }

    private buildProjectionSnapshot(): ConversationSnapshotV1 | null {
        if (!this.currentDocument || !this.basis || this.turns.length === 0) return null;
        const proof: ConversationSnapshotProofV1 = Object.freeze({
            basis: this.basis,
            order: 'complete',
            bodies: 'complete',
            tail: this.tail,
            gaps: this.tail === 'streaming'
                ? Object.freeze([{ kind: 'tail' as const, reason: 'the website baseline has one streaming tail' }])
                : Object.freeze([]),
        });
        const coverage = this.tail === 'stable' ? 'complete' as const : 'partial' as const;
        const snapshotWithoutToken = {
            schemaVersion: 1 as const,
            document: this.currentDocument,
            projectionId: this.projectionId,
            coverage,
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
        while (this.pendingHost.size > 8) {
            const oldest = this.pendingHost.keys().next().value as string | undefined;
            if (!oldest) break;
            this.pendingHost.delete(oldest);
        }
    }

    private switchDocument(document: ConversationDocumentRefV1): void {
        const nextKey = document.key;
        const previousKey = this.currentDocument?.key ?? null;
        if (nextKey === previousKey) {
            if (this.currentDocument && !sameDisplayDocument(this.currentDocument, document)) {
                this.currentDocument = freezeDocument(document);
                if (this.lastGood) this.lastGood = freezeSnapshotDocument(this.lastGood, this.currentDocument);
            }
            return;
        }

        const preserveBirthBuffer = previousKey === null && this.turns.length === 0;
        if (this.scheduledTimer !== null) clearTimeout(this.scheduledTimer);
        this.scheduledTimer = null;
        this.epoch += 1;
        this.flight?.controller.abort();
        this.flight = null;
        this.currentDocument = freezeDocument(document);
        this.lastGood = null;
        this.baselineGate = 'open';
        this.baselineAttempted = false;
        this.baselinePrefixLength = 0;
        this.basis = null;
        this.tail = 'stable';
        this.turns = Object.freeze([]);
        this.turnDigests.clear();
        if (!preserveBirthBuffer) this.pendingHost.clear();
        this.startProjection();
        this.publish({
            kind: 'syncing',
            document: this.currentDocument,
            snapshot: null,
        });
    }

    private unbindDocument(): void {
        if (this.currentDocument === null) return;
        if (this.scheduledTimer !== null) clearTimeout(this.scheduledTimer);
        this.scheduledTimer = null;
        this.epoch += 1;
        this.flight?.controller.abort();
        this.flight = null;
        this.currentDocument = null;
        this.lastGood = null;
        this.baselineGate = 'open';
        this.baselineAttempted = false;
        this.baselinePrefixLength = 0;
        this.basis = null;
        this.tail = 'stable';
        this.turns = Object.freeze([]);
        this.turnDigests.clear();
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

function createContentToken(snapshot: Omit<ConversationSnapshotV1, 'contentToken'>): string {
    const semantic = JSON.stringify({
        documentKey: snapshot.document.key,
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
    if (left.snapshot?.coverage !== right.snapshot?.coverage) return false;
    if (JSON.stringify(left.snapshot?.proof) !== JSON.stringify(right.snapshot?.proof)) return false;
    if (left.kind === 'stale' && right.kind === 'stale') return left.reason === right.reason;
    if (left.kind === 'unavailable' && right.kind === 'unavailable') {
        return left.reason === right.reason && left.retryable === right.retryable;
    }
    return true;
}
