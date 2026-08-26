import {
    freezeConversationSnapshotV1,
    isConversationSnapshotV1,
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
    /** Acquisition mode used for this DOM observation. */
    origin?: 'full-discovery' | 'dom-fallback';
}>;

export type ConversationContentRepositoryOptionsV1 = Readonly<{
    resolveDocument: () => ConversationDocumentRefV1 | null;
}>;

type ConversationPool = {
    projectionId: string;
    turns: readonly ConversationTurnV1[];
    historyStatus: DiscoveryHistoryStatusV1;
    expectedTurnCount: number | null;
    slotOrder: readonly string[];
    turnsByAssistantId: Map<string, ConversationTurnV1>;
    slotIdByAssistantId: Map<string, string>;
    assistantIdBySlotId: Map<string, string>;
    digests: Map<string, string>;
    acquisitionModeByAssistantId: Map<string, 'full-discovery' | 'dom-fallback'>;
    documentKeys: Set<string>;
};

/**
 * Tab-local semantic content pool.
 *
 * ChatGPT DOM is the only body authority. Pools retain plain data across SPA
 * navigation and are destroyed with this page runtime; they never retain DOM
 * nodes and never acquire conversation data from the network.
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

    /** Bind the active SPA route without performing I/O. */
    bindCurrentDocument(): void {
        if (this.disposed) return;
        const document = this.options.resolveDocument();
        if (!document) {
            this.currentDocument = null;
            this.activePool = null;
            this.publish({ kind: 'idle', document: null, snapshot: null });
            return;
        }
        this.switchDocument(document);
    }

    setFullDiscoveryExpectedTurnCount(count: number | null): void {
        this.bindCurrentDocument();
        const pool = this.activePool;
        if (!pool) return;
        pool.expectedTurnCount = typeof count === 'number' && Number.isInteger(count) && count > 0
            ? count
            : null;
    }

    markFullDiscoveryComplete(): boolean {
        this.bindCurrentDocument();
        const pool = this.activePool;
        if (!pool || pool.expectedTurnCount === null || pool.turns.length !== pool.expectedTurnCount) return false;
        if (pool.historyStatus === 'complete') return true;
        pool.historyStatus = 'complete';
        this.publishProjection();
        return true;
    }

    markFullDiscoveryPartial(): void {
        this.bindCurrentDocument();
        const pool = this.activePool;
        if (!pool || pool.historyStatus === 'partial') return;
        pool.historyStatus = 'partial';
        this.publishProjection();
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
        if (this.disposed || (observations.length === 0 && observedHostSlotOrder.length === 0)) return this.state;
        this.bindCurrentDocument();
        const pool = this.activePool;
        if (!pool || !this.currentDocument) return this.state;

        const previousSlotOrder = pool.slotOrder;
        const previousHistoryStatus = pool.historyStatus;
        const normalizedObservedHostSlotOrder = normalizeSlotOrder(observedHostSlotOrder);
        if (
            previousSlotOrder.length > 0
            && normalizedObservedHostSlotOrder.length > 0
            && !sameStringSequence(previousSlotOrder, normalizedObservedHostSlotOrder)
            && !containsContiguousSequence(normalizedObservedHostSlotOrder, previousSlotOrder)
            && !containsContiguousSequence(previousSlotOrder, normalizedObservedHostSlotOrder)
        ) {
            return this.state;
        }

        const nextSlotOrder = reconcileHostSlotOrder(previousSlotOrder, normalizedObservedHostSlotOrder);
        const topologyExpanded = nextSlotOrder.length > previousSlotOrder.length;
        const knownSlots = new Set(nextSlotOrder);
        const pendingObservations: Array<{
            turn: ConversationTurnV1;
            hostSlotId: string;
            assistantMessageId: string;
            digest: string;
            origin?: ConversationHostTurnObservationV1['origin'];
        }> = [];
        const pendingAssistantSlotIds = new Map<string, string>();
        const pendingSlotAssistantIds = new Map<string, string>();
        for (const observation of observations) {
            const incoming = normalizeTurn(observation.turn, 1);
            const hostSlotId = observation.hostSlotId.trim();
            if (!incoming || !hostSlotId || !knownSlots.has(hostSlotId)) continue;

            const assistantMessageId = incoming.identity.assistantMessageId;
            const existingSlotId = pool.slotIdByAssistantId.get(assistantMessageId);
            const existingAssistantId = pool.assistantIdBySlotId.get(hostSlotId);
            if (
                (existingSlotId && existingSlotId !== hostSlotId)
                || (existingAssistantId && existingAssistantId !== assistantMessageId)
            ) {
                return this.state;
            }
            const digest = digestTurnContent(incoming);
            const pendingSlotId = pendingAssistantSlotIds.get(assistantMessageId);
            const pendingAssistantId = pendingSlotAssistantIds.get(hostSlotId);
            if (
                (pendingSlotId && pendingSlotId !== hostSlotId)
                || (pendingAssistantId && pendingAssistantId !== assistantMessageId)
            ) {
                return this.state;
            }
            const pendingDuplicate = pendingObservations.find((candidate) => (
                candidate.assistantMessageId === assistantMessageId
                && candidate.hostSlotId === hostSlotId
            ));
            if (pendingDuplicate && pendingDuplicate.digest !== digest) return this.state;
            if (pendingDuplicate) continue;
            pendingAssistantSlotIds.set(assistantMessageId, hostSlotId);
            pendingSlotAssistantIds.set(hostSlotId, assistantMessageId);
            pendingObservations.push({
                turn: incoming,
                hostSlotId,
                assistantMessageId,
                digest,
                origin: observation.origin,
            });
        }

        pool.slotOrder = nextSlotOrder;
        for (const observation of pendingObservations) {
            const { turn: incoming, hostSlotId, assistantMessageId, digest } = observation;
            if (pool.digests.get(assistantMessageId) === digest) continue;
            pool.slotIdByAssistantId.set(assistantMessageId, hostSlotId);
            pool.assistantIdBySlotId.set(hostSlotId, assistantMessageId);
            pool.turnsByAssistantId.set(assistantMessageId, incoming);
            pool.digests.set(assistantMessageId, digest);
            pool.acquisitionModeByAssistantId.set(
                assistantMessageId,
                observation.origin === 'full-discovery' ? 'full-discovery' : 'dom-fallback',
            );
        }

        const nextTurns = freezeTurns(pool.slotOrder.flatMap((hostSlotId) => {
            const assistantMessageId = pool.assistantIdBySlotId.get(hostSlotId);
            const turn = assistantMessageId ? pool.turnsByAssistantId.get(assistantMessageId) : null;
            return turn ? [turn] : [];
        }));
        const turnProjectionChanged = !sameTurnProjection(pool.turns, nextTurns);
        const newTurnDiscovered = nextTurns.some((turn) => (
            !pool.turns.some((existing) => (
                existing.identity.assistantMessageId === turn.identity.assistantMessageId
            ))
        ));
        if (pool.historyStatus === 'complete' && (topologyExpanded || newTurnDiscovered)) {
            pool.historyStatus = 'partial';
        }
        const historyStatusChanged = pool.historyStatus !== previousHistoryStatus;
        if (!turnProjectionChanged && !historyStatusChanged) return this.state;

        pool.turns = nextTurns;
        this.publishProjection();
        return this.state;
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
            basis: this.activePool?.turns.length ? 'host' : null,
            epoch: this.epoch,
            turnCount: this.activePool?.turns.length ?? 0,
            historyStatus: this.activePool?.historyStatus ?? (this.currentDocument ? 'partial' : 'unknown'),
        };
    }

    dispose(): void {
        if (this.disposed) return;
        this.disposed = true;
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
        this.currentDocument = freezeDocument(document);
        this.activePool = this.pools.get(document.key) ?? this.createPool(document.key);
        this.pools.set(document.key, this.activePool);
        if (this.activePool.turns.length > 0) this.publishProjection();
        else this.publish({ kind: 'syncing', document: this.currentDocument, snapshot: null });
    }

    private createPool(documentKey: string): ConversationPool {
        return {
            projectionId: `conversation-projection:${++this.projectionSequence}`,
            turns: Object.freeze([]),
            historyStatus: 'partial',
            expectedTurnCount: null,
            slotOrder: Object.freeze([]),
            turnsByAssistantId: new Map(),
            slotIdByAssistantId: new Map(),
            assistantIdBySlotId: new Map(),
            digests: new Map(),
            acquisitionModeByAssistantId: new Map(),
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
            proof: Object.freeze({ basis: 'host' as const }),
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
        ...(turn.assistantProvenance
            ? { assistantProvenance: Object.freeze({ ...turn.assistantProvenance }) }
            : {}),
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
        if (!id || id === 'client-created-root' || seen.has(id)) continue;
        seen.add(id);
        normalized.push(id);
    }
    return Object.freeze(normalized);
}

function reconcileHostSlotOrder(
    existingOrder: readonly string[],
    observedOrder: readonly string[],
): readonly string[] {
    const observed = normalizeSlotOrder(observedOrder);
    if (observed.length === 0 || sameStringSequence(existingOrder, observed)) return existingOrder;
    if (existingOrder.length === 0) return observed;
    if (containsContiguousSequence(observed, existingOrder)) return observed;
    if (containsContiguousSequence(existingOrder, observed)) return existingOrder;
    return existingOrder;
}

function containsContiguousSequence(haystack: readonly string[], needle: readonly string[]): boolean {
    if (needle.length === 0) return true;
    if (needle.length > haystack.length) return false;
    const lastStart = haystack.length - needle.length;
    for (let start = 0; start <= lastStart; start += 1) {
        if (needle.every((value, offset) => haystack[start + offset] === value)) return true;
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
