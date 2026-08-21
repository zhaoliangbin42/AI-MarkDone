import {
    freezeConversationSnapshotV1,
    isConversationSnapshotV1,
    type ConversationContentSourceV1,
    type ConversationContentStateV1,
    type ConversationDocumentRefV1,
    type ConversationSnapshotV1,
    type ConversationTurnV1,
} from '../../contracts/conversationContent';
import type {
    ConversationTurnReadPortV1,
    ConversationTurnReadResultV1,
} from '../../contracts/conversationDiscovery';
import type { DiscoveryRepositoryFactsV1 } from '../../contracts/conversationDiscoveryDiagnostics';
import type { ConversationTargetV1 } from '../../contracts/conversationMaterialization';

export type ConversationHostTurnObservationV1 = Readonly<{
    turn: ConversationTurnV1;
    /** Previous mounted assistant in the current DOM order, when available. */
    predecessorAssistantMessageId: string | null;
}>;

export type ConversationContentRepositoryOptionsV1 = Readonly<{
    resolveDocument: () => ConversationDocumentRefV1 | null;
}>;

type ConversationPool = {
    projectionId: string;
    turns: readonly ConversationTurnV1[];
    digests: Map<string, string>;
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

    ingestHostTurn(observation: ConversationHostTurnObservationV1): ConversationContentStateV1 {
        return this.ingestHostBatch([observation]);
    }

    /**
     * Merge one DOM-ordered batch. Existing IDs update in place; new IDs are
     * inserted after their mounted predecessor when known and otherwise append.
     */
    ingestHostBatch(observations: readonly ConversationHostTurnObservationV1[]): ConversationContentStateV1 {
        if (this.disposed || observations.length === 0) return this.state;
        this.bindCurrentDocument();
        const pool = this.activePool;
        if (!pool || !this.currentDocument) return this.state;

        const nextTurns = [...pool.turns];
        let changed = false;
        for (const observation of observations) {
            const incoming = normalizeTurn(observation.turn, 1);
            if (!incoming) continue;

            const assistantMessageId = incoming.identity.assistantMessageId;
            const digest = digestTurnContent(incoming);
            const existingIndex = nextTurns.findIndex((turn) => (
                turn.identity.assistantMessageId === assistantMessageId
            ));
            if (existingIndex >= 0) {
                if (pool.digests.get(assistantMessageId) === digest) continue;
                nextTurns[existingIndex] = { ...incoming, ordinal: existingIndex + 1 };
                pool.digests.set(assistantMessageId, digest);
                changed = true;
                continue;
            }

            const predecessorId = observation.predecessorAssistantMessageId?.trim() || null;
            const predecessorIndex = predecessorId
                ? nextTurns.findIndex((turn) => turn.identity.assistantMessageId === predecessorId)
                : -1;
            const insertionIndex = predecessorIndex >= 0 ? predecessorIndex + 1 : nextTurns.length;
            nextTurns.splice(insertionIndex, 0, incoming);
            pool.digests.set(assistantMessageId, digest);
            changed = true;
        }

        if (!changed) return this.state;
        pool.turns = freezeTurns(nextTurns);
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
            historyStatus: this.currentDocument ? 'partial' : 'unknown',
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
            digests: new Map(),
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
            historyStatus: 'partial' as const,
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

function digestTurnContent(turn: ConversationTurnV1): string {
    return JSON.stringify({
        identity: turn.identity,
        userText: turn.userText,
        assistantMarkdown: turn.assistantMarkdown,
    });
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
