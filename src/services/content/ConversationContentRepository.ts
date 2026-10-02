import {
    freezeConversationSnapshotV1,
    isConversationSnapshotV1,
    type ConversationContentCandidateV1,
    type ConversationContentSourceV1,
    type ConversationContentStateV1,
    type ConversationDocumentRefV1,
    type ConversationSnapshotV1,
    type ConversationTurnV1,
} from '../../contracts/conversationContent';
import type { DiscoveryHistoryStatusV1 } from '../../contracts/conversationDiscoveryDiagnostics';
import type {
    ConversationTurnReadPortV1,
    ConversationTurnReadResultV1,
} from '../../contracts/conversationDiscovery';
import type { DiscoveryRepositoryFactsV1 } from '../../contracts/conversationDiscoveryDiagnostics';
import type { ConversationTargetV1 } from '../../contracts/conversationMaterialization';

export type ConversationHostTurnObservationV1 = Readonly<{
    turn: ConversationTurnV1;
    /** Stable outer host position containing this rendered assistant body. */
    hostSlotId: string;
}>;

export type ConversationHostSlotIdentityV1 = Readonly<{
    hostSlotId: string;
    assistantMessageId: string;
    userMessageId: string | null;
}>;

export type ConversationHostBatchAdmissionV1 = Readonly<{
    state: ConversationContentStateV1;
    admittedAssistantMessageIds: readonly string[];
    rejectionReason: 'unbound' | 'order-unproven' | 'identity-conflict' | null;
}>;

export type ConversationContentRepositoryOptionsV1 = Readonly<{
    resolveDocument: () => ConversationDocumentRefV1 | null;
    readBaseline?: (
        document: ConversationDocumentRefV1,
        signal: AbortSignal,
    ) => Promise<ConversationContentCandidateV1 | null>;
    baselineSignalDelayMs?: number;
}>;

type ConversationPool = {
    projectionId: string;
    turns: readonly ConversationTurnV1[];
    historyStatus: DiscoveryHistoryStatusV1;
    sourceOrder: readonly string[];
    sourceRevision: number | null;
    sourceAttempted: boolean;
    basis: 'source' | 'hybrid' | 'host' | null;
    slotOrder: readonly string[];
    hostSlotAliases: Map<string, string>;
    hostSlotProofByAssistantId: Map<string, ConversationHostSlotIdentityV1>;
    turnsByAssistantId: Map<string, ConversationTurnV1>;
    slotIdByAssistantId: Map<string, string>;
    assistantIdBySlotId: Map<string, string>;
    digests: Map<string, string>;
    acquisitionModeByAssistantId: Map<string, 'get' | 'dom-fallback'>;
    domObservedAssistantIds: Set<string>;
    documentKeys: Set<string>;
};

/**
 * Tab-local semantic content pool.
 *
 * GET source and ChatGPT DOM share one pool. GET supplies a usable initial
 * seed; DOM body and outer-slot observations are the final correction
 * authority. Pools retain plain data across SPA navigation and are destroyed
 * with this page runtime; they never retain DOM nodes or issue conversation
 * requests.
 */
export class ConversationContentRepository implements ConversationContentSourceV1, ConversationTurnReadPortV1 {
    private state: ConversationContentStateV1 = Object.freeze({
        kind: 'idle',
        document: null,
        snapshot: null,
    });
    private readonly listeners = new Set<(state: ConversationContentStateV1) => void>();
    private readonly pools = new Map<string, ConversationPool>();
    private currentDocument: ConversationDocumentRefV1 | null = null;
    private activePool: ConversationPool | null = null;
    private epoch = 0;
    private projectionSequence = 0;
    private baselineFlight: Promise<ConversationContentStateV1> | null = null;
    private baselineController: AbortController | null = null;
    private baselineSignalTimer: ReturnType<typeof setTimeout> | null = null;
    private baselinePendingSignal = false;
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

    async refresh(): Promise<ConversationContentStateV1> {
        this.bindCurrentDocument();
        return this.state;
    }

    /** Enter the current canonical route and perform one bounded bridge-memory peek. */
    enterCurrentEpoch(): Promise<ConversationContentStateV1> {
        if (this.disposed) return Promise.resolve(this.state);
        this.bindCurrentDocument();
        const document = this.currentDocument;
        const pool = this.activePool;
        if (!document || document.identityKind === 'page' || !document.conversationId || !this.options.readBaseline || !pool) {
            return Promise.resolve(this.state);
        }
        if (this.baselineFlight) return this.baselineFlight;
        if (pool.sourceAttempted) return Promise.resolve(this.state);
        return this.readBaselineForCurrentDocument(document, pool);
    }

    /** Re-read bridge memory after the page reports a new host-owned capture. */
    notifyBaselineCaptured(): void {
        if (this.disposed || !this.options.readBaseline || !this.currentDocument?.conversationId) return;
        if (this.baselineFlight) {
            this.baselinePendingSignal = true;
            return;
        }
        if (this.baselineSignalTimer !== null) return;
        const delay = Math.max(0, Math.round(this.options.baselineSignalDelayMs ?? 150));
        this.baselineSignalTimer = setTimeout(() => {
            this.baselineSignalTimer = null;
            if (this.disposed || !this.currentDocument?.conversationId || !this.activePool) return;
            void this.readBaselineForCurrentDocument(this.currentDocument, this.activePool, true);
        }, delay);
    }

    private readBaselineForCurrentDocument(
        document: ConversationDocumentRefV1,
        pool: ConversationPool,
        force = false,
    ): Promise<ConversationContentStateV1> {
        if (!this.options.readBaseline || !document.conversationId) return Promise.resolve(this.state);
        if (!force && pool.sourceAttempted) return Promise.resolve(this.state);
        const controller = new AbortController();
        this.baselineController = controller;
        pool.sourceAttempted = true;
        const promise = Promise.resolve()
            .then(() => this.options.readBaseline!(document, controller.signal))
            .then((candidate) => {
                if (controller.signal.aborted || this.disposed || this.currentDocument?.key !== document.key) {
                    return this.state;
                }
                if (candidate) this.ingestSourceCandidate(candidate);
                return this.state;
            })
            .catch(() => this.state)
            .finally(() => {
                if (this.baselineFlight !== promise) return;
                this.baselineFlight = null;
                this.baselineController = null;
                if (this.baselinePendingSignal && !this.disposed) {
                    this.baselinePendingSignal = false;
                    this.notifyBaselineCaptured();
                }
            });
        this.baselineFlight = promise;
        return promise;
    }

    /** Bind the active SPA route without performing I/O. */
    bindCurrentDocument(): void {
        if (this.disposed) return;
        const document = this.options.resolveDocument();
        if (!document) {
            this.resetBaselineState();
            this.currentDocument = null;
            this.activePool = null;
            this.publish({ kind: 'idle', document: null, snapshot: null });
            return;
        }
        this.switchDocument(document);
    }

    /** Merge one validated 5.3 source candidate into the shared pool. */
    ingestSourceCandidate(candidate: ConversationContentCandidateV1): ConversationContentStateV1 {
        if (this.disposed) return this.state;
        this.bindCurrentDocument();
        const pool = this.activePool;
        const document = this.currentDocument;
        if (!pool || !document || candidate.document.key !== document.key || candidate.origin === 'host') return this.state;

        const incomingTurns = candidate.turns.map((turn, index) => normalizeTurn(turn, index + 1));
        if (incomingTurns.some((turn) => !turn)) return this.state;
        const turns = incomingTurns.filter((turn): turn is ConversationTurnV1 => Boolean(turn));
        if (turns.length === 0) return this.state;
        const incomingOrder = turns.map((turn) => turn.identity.assistantMessageId);
        if (new Set(incomingOrder).size !== incomingOrder.length) return this.state;

        const nextSourceOrder = mergeStableOrder(pool.sourceOrder, incomingOrder);
        if (!nextSourceOrder || !isSharedOrderCompatibleWithDom(pool, nextSourceOrder)) return this.state;
        const nextTurnsByAssistantId = new Map(pool.turnsByAssistantId);
        for (const turn of turns) {
            if (pool.acquisitionModeByAssistantId.get(turn.identity.assistantMessageId) !== 'dom-fallback') {
                nextTurnsByAssistantId.set(turn.identity.assistantMessageId, turn);
            }
        }
        const projectedTurns = buildProjectedTurns({ ...pool, sourceOrder: nextSourceOrder, turnsByAssistantId: nextTurnsByAssistantId });
        if (!isPublishableProjection(document, pool, projectedTurns)) return this.state;

        const previousStatus = pool.historyStatus;
        const previousBasis = pool.basis;
        const previousTurns = pool.turns;
        const previousRevision = pool.sourceRevision;
        pool.sourceOrder = nextSourceOrder;
        pool.sourceRevision = Math.max(
            pool.sourceRevision ?? 0,
            Number.isInteger(candidate.sourceRevision) ? candidate.sourceRevision! : 0,
        );
        for (const turn of turns) {
            const assistantMessageId = turn.identity.assistantMessageId;
            const existingMode = pool.acquisitionModeByAssistantId.get(assistantMessageId);
            if (existingMode === 'dom-fallback') continue;
            pool.turnsByAssistantId.set(assistantMessageId, turn);
            pool.digests.set(assistantMessageId, digestTurnContent(turn));
            pool.acquisitionModeByAssistantId.set(assistantMessageId, 'get');
        }
        pool.basis = pool.basis === 'host' || pool.domObservedAssistantIds.size > 0 ? 'hybrid' : 'source';
        const sourceAddedNewTurn = projectedTurns.some((turn) => (
            !previousTurns.some((existing) => existing.identity.assistantMessageId === turn.identity.assistantMessageId)
        ));
        if (pool.historyStatus !== 'complete' || sourceAddedNewTurn || previousRevision !== pool.sourceRevision) {
            pool.historyStatus = 'get';
        }
        const changed = !sameTurnProjection(previousTurns, projectedTurns)
            || previousStatus !== pool.historyStatus
            || previousBasis !== pool.basis;
        pool.turns = projectedTurns;
        if (!changed) return this.state;
        this.publishProjection();
        return this.state;
    }

    ingestHostTurn(observation: ConversationHostTurnObservationV1): ConversationContentStateV1 {
        return this.ingestHostBatch([observation], [observation.hostSlotId]);
    }

    /**
     * Merge one complete observed host-slot sequence and fill mounted bodies
     * into their owning positions. Empty slots remain private pool state.
     */
    ingestHostBatch(
        observations: readonly ConversationHostTurnObservationV1[],
        observedHostSlotOrder: readonly string[] = observations.map(
            (observation) => observation.hostSlotId,
        ),
    ): ConversationContentStateV1 {
        return this.admitHostBatch(observations, observedHostSlotOrder).state;
    }

    /** A compiled body is obtained only after its identity and order are admitted. */
    admitHostBatch(
        observations: readonly ConversationHostTurnObservationV1[],
        observedHostSlotOrder: readonly string[] = observations.map(observation => observation.hostSlotId),
        slotIdentities: readonly ConversationHostSlotIdentityV1[] = [],
        placement?: 'before' | 'after',
    ): ConversationHostBatchAdmissionV1 {
        const result = (admittedAssistantMessageIds: readonly string[], rejectionReason: ConversationHostBatchAdmissionV1['rejectionReason']): ConversationHostBatchAdmissionV1 => Object.freeze({
            state: this.state,
            admittedAssistantMessageIds: Object.freeze([...admittedAssistantMessageIds]),
            rejectionReason,
        });
        if (this.disposed) return result([], 'unbound');
        if (observations.length === 0 && observedHostSlotOrder.length === 0) return result([], null);
        this.bindCurrentDocument();
        const pool = this.activePool;
        if (!pool || !this.currentDocument) return result([], 'unbound');

        const retainedSlotOrder = pool.slotOrder;
        const previousHistoryStatus = pool.historyStatus;
        const rawObservedOrder = normalizeSlotOrder(observedHostSlotOrder);
        const nextAliases = new Map(pool.hostSlotAliases);
        const resolveSlot = (id: string) => nextAliases.get(id) ?? id;
        const identityFactsUnchanged = slotIdentities.every(fact => {
            const known = pool.hostSlotProofByAssistantId.get(fact.assistantMessageId.trim());
            const userId = fact.userMessageId?.trim();
            return known?.hostSlotId === resolveSlot(fact.hostSlotId.trim()) && (!userId || userId === known.userMessageId);
        });
        if (observations.length === 0 && identityFactsUnchanged && containsSubsequence(retainedSlotOrder, rawObservedOrder.map(resolveSlot))) {
            return result([], null);
        }
        const knownSlots = new Set([...retainedSlotOrder, ...rawObservedOrder]);
        const nextSlotProofs = new Map(pool.hostSlotProofByAssistantId);
        const assistantByProvedSlot = new Map([...nextSlotProofs.values()].map(proof => [proof.hostSlotId, proof.assistantMessageId]));
        const identityFacts = [...slotIdentities, ...observations.map(observation => ({ hostSlotId: observation.hostSlotId, ...observation.turn.identity }))];
        for (const fact of identityFacts) {
            const rawSlotId = fact.hostSlotId.trim();
            const assistantMessageId = fact.assistantMessageId.trim();
            if (!assistantMessageId || !knownSlots.has(rawSlotId)) continue;
            const existingProof = nextSlotProofs.get(assistantMessageId);
            const existingTurn = pool.turnsByAssistantId.get(assistantMessageId);
            const knownUserId = existingProof?.userMessageId || existingTurn?.identity.userMessageId || null;
            const userMessageId = fact.userMessageId?.trim() || null;
            if (knownUserId && userMessageId && knownUserId !== userMessageId) return result([], 'identity-conflict');
            let slotId = resolveSlot(rawSlotId);
            const owner = assistantByProvedSlot.get(slotId) || pool.assistantIdBySlotId.get(slotId);
            if (owner && owner !== assistantMessageId) return result([], 'identity-conflict');
            const existingSlotId = existingProof?.hostSlotId || pool.slotIdByAssistantId.get(assistantMessageId);
            if (existingSlotId && existingSlotId !== slotId) {
                // Exact topology identity proves owner continuity even before
                // completion; body readiness is a separate admission boundary.
                if (rawObservedOrder.some(id => id !== rawSlotId && resolveSlot(id) === existingSlotId)) return result([], 'identity-conflict');
                nextAliases.set(rawSlotId, existingSlotId);
                slotId = existingSlotId;
            }
            assistantByProvedSlot.set(slotId, assistantMessageId);
            nextSlotProofs.set(assistantMessageId, Object.freeze({ hostSlotId: slotId, assistantMessageId, userMessageId: userMessageId || knownUserId }));
        }
        const pendingObservations: Array<{
            turn: ConversationTurnV1;
            hostSlotId: string;
            assistantMessageId: string;
            digest: string;
        }> = [];
        const pendingAssistantSlotIds = new Map<string, string>();
        const pendingSlotAssistantIds = new Map<string, string>();
        for (const observation of observations) {
            let incoming = normalizeTurn(observation.turn, 1);
            const rawSlotId = observation.hostSlotId.trim();
            if (!incoming || !rawSlotId || !knownSlots.has(rawSlotId)) continue;

            const assistantMessageId = incoming.identity.assistantMessageId;
            const existing = pool.turnsByAssistantId.get(assistantMessageId);
            if (existing) {
                const knownUserId = existing.identity.userMessageId;
                const incomingUserId = incoming.identity.userMessageId;
                if (knownUserId && incomingUserId && knownUserId !== incomingUserId) return result([], 'identity-conflict');
                incoming = normalizeTurn({
                    ...incoming,
                    key: existing.key,
                    identity: { ...incoming.identity, turnId: existing.identity.turnId, userMessageId: incomingUserId || knownUserId },
                    userText: incoming.userText || existing.userText,
                }, 1)!;
            }
            const existingSlotId = pool.slotIdByAssistantId.get(assistantMessageId);
            const hostSlotId = resolveSlot(rawSlotId);
            const existingAssistantId = pool.assistantIdBySlotId.get(hostSlotId);
            if (
                existingAssistantId && existingAssistantId !== assistantMessageId
            ) {
                return result([], 'identity-conflict');
            }
            if (existingSlotId && existingSlotId !== hostSlotId) return result([], 'identity-conflict');
            const digest = digestTurnContent(incoming);
            const pendingSlotId = pendingAssistantSlotIds.get(assistantMessageId);
            const pendingAssistantId = pendingSlotAssistantIds.get(hostSlotId);
            if (
                (pendingSlotId && pendingSlotId !== hostSlotId)
                || (pendingAssistantId && pendingAssistantId !== assistantMessageId)
            ) {
                return result([], 'identity-conflict');
            }
            const pendingDuplicate = pendingObservations.find((candidate) => (
                candidate.assistantMessageId === assistantMessageId
                && candidate.hostSlotId === hostSlotId
            ));
            if (pendingDuplicate && pendingDuplicate.digest !== digest) return result([], 'identity-conflict');
            if (pendingDuplicate) continue;
            pendingAssistantSlotIds.set(assistantMessageId, hostSlotId);
            pendingSlotAssistantIds.set(hostSlotId, assistantMessageId);
            pendingObservations.push({
                turn: incoming,
                hostSlotId,
                assistantMessageId,
                digest,
            });
        }

        const resolvedRetainedOrder = retainedSlotOrder.map(resolveSlot).filter((id, index, order) => index === 0 || id !== order[index - 1]);
        if (!placement && new Set(resolvedRetainedOrder).size !== resolvedRetainedOrder.length) return result([], 'order-unproven');
        const previousSlotOrder = normalizeSlotOrder(resolvedRetainedOrder);
        const normalizedObservedHostSlotOrder = normalizeSlotOrder(rawObservedOrder.map(resolveSlot));
        if (normalizedObservedHostSlotOrder.length !== rawObservedOrder.length) return result([], 'identity-conflict');
        const nextAssistantBySlot = new Map(pool.assistantIdBySlotId);
        for (const observation of pendingObservations) {
            nextAssistantBySlot.set(observation.hostSlotId, observation.assistantMessageId);
        }
        let nextSlotOrder = reconcileHostSlotOrder(previousSlotOrder, normalizedObservedHostSlotOrder);
        if (!nextSlotOrder && pool.sourceOrder.length > 0) {
            // Accepted source identities can connect disjoint DOM windows;
            // provisional source order never overrides shared DOM anchors.
            const slotsByAssistant = new Map([...nextSlotProofs].map(([id, proof]) => [id, proof.hostSlotId]));
            const sourceSlots = pool.sourceOrder.flatMap(id => {
                const slot = slotsByAssistant.get(id);
                return slot ? [slot] : [];
            });
            nextSlotOrder = reconcileHostSlotOrder(previousSlotOrder, normalizedObservedHostSlotOrder, sourceSlots);
        }
        if (!nextSlotOrder && placement) {
            const shared = normalizedObservedHostSlotOrder.some(id => previousSlotOrder.includes(id));
            // A virtualized jump may expose no overlap at all. Keep obtained
            // bodies using the page's batch placement, then let a real shared
            // window correct the tentative ordering rather than discard them.
            nextSlotOrder = shared
                ? mergeProjectionOrder(previousSlotOrder, normalizedObservedHostSlotOrder)
                : normalizeSlotOrder(placement === 'before'
                    ? [...normalizedObservedHostSlotOrder, ...previousSlotOrder]
                    : [...previousSlotOrder, ...normalizedObservedHostSlotOrder]);
        }
        if (!nextSlotOrder) return result([], 'order-unproven');
        const topologyExpanded = nextSlotOrder.length > previousSlotOrder.length;
        const nextDomAssistantOrder = readDomAssistantOrder(pool, nextAssistantBySlot, nextSlotOrder);
        let nextSourceOrder = pool.sourceOrder;
        if (!isOrderCompatibleWithDom(pool, pool.sourceOrder, nextAssistantBySlot, nextSlotOrder)) {
            // Source order is provisional. Once DOM proves a conflicting
            // relative order, keep the same pool but let DOM become the order
            // authority and reinsert source-only turns around that evidence.
            nextSourceOrder = mergeProjectionOrder(pool.sourceOrder, nextDomAssistantOrder);
        }
        const nextTurnsByAssistantId = new Map(pool.turnsByAssistantId);
        for (const observation of pendingObservations) {
            if (pool.digests.get(observation.assistantMessageId) !== observation.digest) {
                nextTurnsByAssistantId.set(observation.assistantMessageId, observation.turn);
            }
        }
        const nextTurns = buildProjectedTurns({
            ...pool,
            slotOrder: nextSlotOrder,
            sourceOrder: nextSourceOrder,
            assistantIdBySlotId: nextAssistantBySlot,
            turnsByAssistantId: nextTurnsByAssistantId,
        });
        if (!isPublishableProjection(this.currentDocument, pool, nextTurns)) return result([], 'identity-conflict');

        pool.sourceOrder = nextSourceOrder;
        pool.slotOrder = nextSlotOrder;
        pool.hostSlotAliases = nextAliases;
        pool.hostSlotProofByAssistantId = nextSlotProofs;
        for (const observation of pendingObservations) {
            const { turn: incoming, hostSlotId, assistantMessageId, digest } = observation;
            pool.domObservedAssistantIds.add(assistantMessageId);
            pool.slotIdByAssistantId.set(assistantMessageId, hostSlotId);
            pool.assistantIdBySlotId.set(hostSlotId, assistantMessageId);
            pool.acquisitionModeByAssistantId.set(assistantMessageId, 'dom-fallback');
            if (pool.digests.get(assistantMessageId) === digest) continue;
            pool.turnsByAssistantId.set(assistantMessageId, incoming);
            pool.digests.set(assistantMessageId, digest);
        }

        const turnProjectionChanged = !sameTurnProjection(pool.turns, nextTurns);
        const newTurnDiscovered = nextTurns.some((turn) => (
            !pool.turns.some((existing) => (
                existing.identity.assistantMessageId === turn.identity.assistantMessageId
            ))
        ));
        if (pool.historyStatus === 'complete' && (topologyExpanded || newTurnDiscovered)) {
            pool.historyStatus = pool.sourceOrder.length > 0 ? 'get' : 'partial';
        }
        if (pendingObservations.length > 0) {
            pool.basis = pool.sourceOrder.length > 0 ? 'hybrid' : 'host';
        }
        const historyStatusChanged = pool.historyStatus !== previousHistoryStatus;
        const admittedIds = pendingObservations.map(observation => observation.assistantMessageId);
        if (!turnProjectionChanged && !historyStatusChanged) return result(admittedIds, null);

        pool.turns = nextTurns;
        this.publishProjection();
        return result(admittedIds, null);
    }

    isCurrent(contentToken: string): boolean {
        return this.state.snapshot?.contentToken === contentToken;
    }

    readTurn(target: ConversationTargetV1): ConversationTurnReadResultV1 {
        const snapshot = this.state.snapshot;
        const pool = this.activePool;
        if (!snapshot || !pool || !pool.documentKeys.has(target.documentKey)) {
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

    readDiagnosticsFacts(): DiscoveryRepositoryFactsV1 {
        return {
            stateKind: this.state.kind,
            documentKind: this.currentDocument
                ? (this.currentDocument.identityKind ?? 'canonical')
                : null,
            basis: this.activePool?.basis ?? null,
            epoch: this.epoch,
            turnCount: this.activePool?.turns.length ?? 0,
            historyStatus: this.activePool?.historyStatus ?? (this.currentDocument ? 'partial' : 'unknown'),
        };
    }

    dispose(): void {
        if (this.disposed) return;
        this.disposed = true;
        this.resetBaselineState();
        this.epoch += 1;
        this.currentDocument = null;
        this.activePool = null;
        this.pools.clear();
        this.listeners.clear();
    }

    private switchDocument(document: ConversationDocumentRefV1): void {
        if (this.currentDocument?.key === document.key) {
            if (!sameDisplayDocument(this.currentDocument, document)) {
                this.currentDocument = freezeDocument(document);
                if (this.activePool?.turns.length) this.publishProjection();
            }
            return;
        }

        const promotesPageIdentity = this.currentDocument?.identityKind === 'page'
            && document.identityKind !== 'page'
            && document.conversationId !== null
            && this.activePool !== null;
        if (promotesPageIdentity) {
            this.resetBaselineState();
            const previousKey = this.currentDocument!.key;
            const pool = this.activePool!;
            this.pools.delete(previousKey);
            this.pools.set(document.key, pool);
            pool.documentKeys.add(previousKey);
            pool.documentKeys.add(document.key);
            this.currentDocument = freezeDocument(document);
            if (pool.turns.length > 0) this.publishProjection();
            else this.publish({ kind: 'syncing', document: this.currentDocument, snapshot: null });
            return;
        }

        this.epoch += 1;
        this.resetBaselineState();
        this.currentDocument = freezeDocument(document);
        this.activePool = this.pools.get(document.key) ?? this.createPool(document.key);
        this.pools.set(document.key, this.activePool);
        if (this.activePool.turns.length > 0) this.publishProjection();
        else this.publish({ kind: 'syncing', document: this.currentDocument, snapshot: null });
    }

    private resetBaselineState(): void {
        if (this.baselineSignalTimer !== null) {
            clearTimeout(this.baselineSignalTimer);
            this.baselineSignalTimer = null;
        }
        this.baselineController?.abort();
        this.baselineController = null;
        this.baselineFlight = null;
        this.baselinePendingSignal = false;
    }

    private createPool(documentKey: string): ConversationPool {
        return {
            projectionId: `conversation-projection:${++this.projectionSequence}`,
            turns: Object.freeze([]),
            historyStatus: 'partial',
            sourceOrder: Object.freeze([]),
            sourceRevision: null,
            sourceAttempted: false,
            basis: null,
            slotOrder: Object.freeze([]),
            hostSlotAliases: new Map(),
            hostSlotProofByAssistantId: new Map(),
            turnsByAssistantId: new Map(),
            slotIdByAssistantId: new Map(),
            assistantIdBySlotId: new Map(),
            digests: new Map(),
            acquisitionModeByAssistantId: new Map(),
            domObservedAssistantIds: new Set(),
            documentKeys: new Set([documentKey]),
        };
    }

    private publishProjection(): void {
        const pool = this.activePool;
        const document = this.currentDocument;
        if (!pool || !document || pool.turns.length === 0) return;
        const snapshotWithoutToken = {
            schemaVersion: 1 as const,
            document,
            projectionId: pool.projectionId,
            coverage: 'complete' as const,
            historyStatus: pool.historyStatus,
            turns: pool.turns,
            proof: Object.freeze({ basis: pool.basis ?? 'host' }),
        };
        const snapshot = freezeConversationSnapshotV1({
            ...snapshotWithoutToken,
            contentToken: createContentToken(snapshotWithoutToken),
        });
        if (!isConversationSnapshotV1(snapshot)) return;
        this.publish({ kind: 'ready', document, snapshot });
    }

    private publish(next: ConversationContentStateV1): void {
        if (sameState(this.state, next)) return;
        this.state = freezeState(next);
        for (const listener of Array.from(this.listeners)) {
            try {
                listener(this.state);
            } catch {
                // One consumer cannot block the remaining content subscribers.
            }
        }
    }
}

function normalizeTurn(turn: ConversationTurnV1, ordinal: number): ConversationTurnV1 | null {
    const turnId = turn.identity.turnId.trim();
    const assistantMessageId = turn.identity.assistantMessageId.trim();
    const assistantMarkdown = turn.assistantMarkdown.trim();
    if (!turnId || !assistantMessageId || !assistantMarkdown) return null;
    const userMessageId = turn.identity.userMessageId?.trim() || null;
    return Object.freeze({
        ...turn,
        key: turn.key.trim() || `${turnId}:${assistantMessageId}`,
        ordinal,
        identity: Object.freeze({ turnId, userMessageId, assistantMessageId }),
        userText: turn.userText.trim(),
        assistantMarkdown,
        ...(typeof turn.assistantSourceMarkdown === 'string'
            ? { assistantSourceMarkdown: turn.assistantSourceMarkdown }
            : {}),
        ...(turn.assistantProvenance
            ? { assistantProvenance: Object.freeze({ ...turn.assistantProvenance }) }
            : {}),
    });
}

function buildProjectedTurns(pool: ConversationPool): readonly ConversationTurnV1[] {
    const domOrder = pool.slotOrder.flatMap((slotId) => {
        const assistantId = pool.assistantIdBySlotId.get(slotId);
        return assistantId ? [assistantId] : [];
    });
    const orderedAssistantIds = mergeProjectionOrder(pool.sourceOrder, domOrder);
    return freezeTurns(orderedAssistantIds.flatMap((assistantId) => {
        const turn = pool.turnsByAssistantId.get(assistantId);
        return turn ? [turn] : [];
    }));
}

function isPublishableProjection(document: ConversationDocumentRefV1, pool: ConversationPool, turns: readonly ConversationTurnV1[]): boolean {
    // Validate before committing: a private pool must never acknowledge data
    // that its public V1 snapshot cannot publish (e.g. reused display IDs).
    return isConversationSnapshotV1({
        schemaVersion: 1,
        document,
        projectionId: pool.projectionId,
        contentToken: 'pending-projection',
        coverage: 'complete',
        historyStatus: pool.historyStatus,
        turns,
        proof: { basis: pool.basis ?? 'host' },
    });
}

function mergeProjectionOrder(
    sourceOrder: readonly string[],
    domOrder: readonly string[],
): readonly string[] {
    if (sourceOrder.length === 0) return Object.freeze([...domOrder]);
    if (domOrder.length === 0) return Object.freeze([...sourceOrder]);
    const merged = [...domOrder];
    for (let index = 0; index < sourceOrder.length; index += 1) {
        const assistantId = sourceOrder[index]!;
        if (merged.includes(assistantId)) continue;
        const nextKnown = sourceOrder.slice(index + 1).find((id) => merged.includes(id));
        if (nextKnown) {
            merged.splice(merged.indexOf(nextKnown), 0, assistantId);
            continue;
        }
        const previousKnown = sourceOrder.slice(0, index).reverse().find((id) => merged.includes(id));
        if (previousKnown) {
            merged.splice(merged.indexOf(previousKnown) + 1, 0, assistantId);
            continue;
        }
        merged.push(assistantId);
    }
    return Object.freeze(merged);
}

function mergeStableOrder(
    existingOrder: readonly string[],
    incomingOrder: readonly string[],
): readonly string[] | null {
    const incoming = normalizeSlotOrder(incomingOrder);
    if (incoming.length === 0) return existingOrder;
    if (existingOrder.length === 0 || sameStringSequence(existingOrder, incoming)) return incoming;
    if (containsSubsequence(incoming, existingOrder)) return incoming;
    if (containsSubsequence(existingOrder, incoming)) return existingOrder;
    return null;
}

function isOrderCompatibleWithDom(
    pool: ConversationPool,
    sourceOrder: readonly string[],
    assistantBySlot: ReadonlyMap<string, string> = pool.assistantIdBySlotId,
    slotOrder: readonly string[] = pool.slotOrder,
): boolean {
    if (sourceOrder.length === 0) return true;
    const domAssistantOrder = readDomAssistantOrder(pool, assistantBySlot, slotOrder);
    return containsSubsequence(sourceOrder, domAssistantOrder);
}

function isSharedOrderCompatibleWithDom(pool: ConversationPool, sourceOrder: readonly string[]): boolean {
    const domOrder = readDomAssistantOrder(pool, pool.assistantIdBySlotId);
    if (domOrder.length === 0) return true;
    const sourceIds = new Set(sourceOrder);
    const domIds = new Set(domOrder);
    const sharedDom = domOrder.filter(id => sourceIds.has(id));
    const sharedSource = sourceOrder.filter(id => domIds.has(id));
    // A late seed may omit a newer DOM tail. Only shared identities must
    // agree; source-only history keeps the established projection policy.
    return sharedDom.length > 0 && sameStringSequence(sharedDom, sharedSource);
}

function readDomAssistantOrder(
    pool: ConversationPool,
    assistantBySlot: ReadonlyMap<string, string>,
    slotOrder: readonly string[] = pool.slotOrder,
): readonly string[] {
    return slotOrder.flatMap((slotId) => {
        const assistantId = assistantBySlot.get(slotId);
        return assistantId ? [assistantId] : [];
    });
}

function freezeTurns(turns: readonly ConversationTurnV1[]): readonly ConversationTurnV1[] {
    const frozen: ConversationTurnV1[] = [];
    for (const [index, turn] of turns.entries()) {
        const normalized = normalizeTurn(turn, index + 1);
        if (normalized) frozen.push(normalized);
    }
    return Object.freeze(frozen);
}

function normalizeSlotOrder(order: readonly string[]): readonly string[] {
    const normalized: string[] = [];
    const seen = new Set<string>();
    for (const rawId of order) {
        const id = rawId.trim();
        if (!id || id === 'client-created-root' || id.startsWith('fallback-turn-') || seen.has(id)) continue;
        seen.add(id);
        normalized.push(id);
    }
    return Object.freeze(normalized);
}

function reconcileHostSlotOrder(
    existingOrder: readonly string[],
    observedOrder: readonly string[],
    anchorOrder: readonly string[] = [],
): readonly string[] | null {
    const observed = normalizeSlotOrder(observedOrder);
    if (observed.length === 0 || sameStringSequence(existingOrder, observed)) return existingOrder;
    if (existingOrder.length === 0) return observed;
    if (containsSubsequence(existingOrder, observed)) return existingOrder;
    if (containsSubsequence(observed, existingOrder)) return observed;

    const existingIds = new Set(existingOrder);
    const observedIds = new Set(observed);
    const shared = observed.filter(id => existingIds.has(id));
    if (!sameStringSequence(existingOrder.filter(id => observedIds.has(id)), shared)) return null;
    if (shared.length === 0) {
        const allIds = new Set([...existingOrder, ...observed]);
        const anchored = normalizeSlotOrder(anchorOrder.filter(id => allIds.has(id)));
        return anchored.length === allIds.size
            && containsSubsequence(anchored, existingOrder)
            && containsSubsequence(anchored, observed) ? anchored : null;
    }

    // Keep obtained order. Where unseen ranges have several valid interleavings,
    // use the current window's next shared neighbour instead of blocking hydration.
    const before = new Map<string, string[]>();
    let pending: string[] = [];
    let lastAnchor = shared[0]!;
    for (const id of observed) {
        if (!existingIds.has(id)) pending.push(id);
        else {
            if (pending.length > 0) before.set(id, pending);
            pending = [];
            lastAnchor = id;
        }
    }
    return Object.freeze(existingOrder.flatMap(id => [
        ...(before.get(id) ?? []), id, ...(id === lastAnchor ? pending : []),
    ]));
}

function containsSubsequence(haystack: readonly string[], needle: readonly string[]): boolean {
    if (needle.length === 0) return true;
    let cursor = 0;
    for (const value of haystack) {
        if (value !== needle[cursor]) continue;
        cursor += 1;
        if (cursor === needle.length) return true;
    }
    return false;
}

function sameTurnProjection(left: readonly ConversationTurnV1[], right: readonly ConversationTurnV1[]): boolean {
    return left.length === right.length && left.every((turn, index) => {
        const candidate = right[index];
        return Boolean(
            candidate
            && turn.identity.assistantMessageId === candidate.identity.assistantMessageId
            && digestTurnContent(turn) === digestTurnContent(candidate),
        );
    });
}

function sameStringSequence(left: readonly string[], right: readonly string[]): boolean {
    return left.length === right.length && left.every((value, index) => value === right[index]);
}

function digestTurnContent(turn: ConversationTurnV1): string {
    return JSON.stringify({
        identity: turn.identity,
        userText: turn.userText,
        assistantMarkdown: turn.assistantMarkdown,
        assistantSourceMarkdown: turn.assistantSourceMarkdown,
        assistantProvenance: turn.assistantProvenance,
    });
}

function createContentToken(snapshot: Omit<ConversationSnapshotV1, 'contentToken'>): string {
    const semantic = JSON.stringify({
        projectionId: snapshot.projectionId,
        historyStatus: snapshot.historyStatus,
        turns: snapshot.turns.map((turn) => ({
            key: turn.key,
            ordinal: turn.ordinal,
            identity: turn.identity,
            userText: turn.userText,
            assistantMarkdown: turn.assistantMarkdown,
            assistantSourceMarkdown: turn.assistantSourceMarkdown,
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
    if (left.kind === 'unavailable' && right.kind === 'unavailable') {
        return left.reason === right.reason && left.retryable === right.retryable;
    }
    return true;
}
