import type {
    ConversationContentSourceV1,
    ConversationContentStateV1,
    ConversationDocumentRefV1,
    ConversationSnapshotProofV1,
    ConversationSnapshotV1,
    ConversationTurnV1,
} from '../../contracts/conversationContent';
import type {
    ConversationTurnReadPortV1,
    ConversationTurnReadResultV1,
} from '../../contracts/conversationDiscovery';
import type {
    ConversationMaterializationPortV1,
    ConversationMaterializationResultV1,
    ConversationTargetV1,
    MaterializationSnapshotV1,
} from '../../contracts/conversationMaterialization';
import type {
    ConversationDiscoveryPortV2,
    ConversationDocumentEpochV2,
    ConversationTurnIdentityV2,
} from '../../contracts/conversationDiscoveryV2';

/**
 * Transitional projections for untouched shared consumers.  They are views
 * over V2, not alternate discovery implementations; no DOM or provider data
 * enters them. ChatGPT runtime consumers can migrate to the V2 port without
 * changing the underlying source of truth.
 */
export class ConversationDiscoveryV2ContentProjection implements ConversationContentSourceV1, ConversationTurnReadPortV1 {
    private readonly listeners = new Set<(state: ConversationContentStateV1) => void>();
    private readonly unsubscribe: () => void;
    private state: ConversationContentStateV1 = { kind: 'idle', document: null, snapshot: null };

    constructor(private readonly discovery: ConversationDiscoveryPortV2) {
        this.unsubscribe = discovery.subscribe(() => this.rebuild());
        this.rebuild();
    }

    read(): ConversationContentStateV1 {
        return this.state;
    }

    subscribe(listener: (state: ConversationContentStateV1) => void): () => void {
        this.listeners.add(listener);
        listener(this.state);
        return () => this.listeners.delete(listener);
    }

    refresh(): Promise<ConversationContentStateV1> {
        return this.discovery.refresh().then(() => this.state);
    }

    isCurrent(contentToken: string): boolean {
        const snapshot = this.discovery.read();
        return snapshot.kind === 'ready' && snapshot.tokens.contentToken === contentToken;
    }

    readTurn(target: ConversationTargetV1): ConversationTurnReadResultV1 {
        const result = this.discovery.readTurn({
            kind: 'assistant-message',
            documentKey: target.documentKey,
            assistantMessageId: target.assistantMessageId,
        });
        if (result.kind !== 'ready') {
            return {
                kind: 'unavailable',
                target: Object.freeze({ ...target }),
                reason: result.reason === 'identity-conflict'
                    ? 'identity-conflict'
                    : result.reason === 'stale-target'
                        ? 'document-mismatch'
                        : 'not-recognized',
            };
        }
        return {
            kind: 'ready',
            target: Object.freeze({ ...target }),
            turn: toV1Turn(result),
            contentToken: result.revision.contentToken,
        };
    }

    dispose(): void {
        this.unsubscribe();
        this.listeners.clear();
    }

    private rebuild(): void {
        const next = projectState(this.discovery);
        const changed = next.kind !== this.state.kind
            || next.snapshot?.contentToken !== this.state.snapshot?.contentToken
            || next.document?.key !== this.state.document?.key;
        this.state = next;
        if (!changed) return;
        for (const listener of Array.from(this.listeners)) {
            try {
                listener(this.state);
            } catch {
            }
        }
    }
}

export class ConversationDiscoveryV2MaterializationProjection implements ConversationMaterializationPortV1 {
    private readonly listeners = new Set<(snapshot: MaterializationSnapshotV1) => void>();
    private readonly unsubscribe: () => void;
    private snapshot: MaterializationSnapshotV1 = {
        materializationToken: 'chatgpt-materialization-v2:empty',
        contentToken: null,
        entries: [],
    };

    constructor(private readonly discovery: ConversationDiscoveryPortV2) {
        this.unsubscribe = discovery.subscribe(() => this.rebuild());
        this.rebuild();
    }

    read(): MaterializationSnapshotV1 {
        return this.snapshot;
    }

    subscribe(listener: (snapshot: MaterializationSnapshotV1) => void): () => void {
        this.listeners.add(listener);
        listener(this.snapshot);
        return () => this.listeners.delete(listener);
    }

    resolveElement(element: HTMLElement): ConversationTargetV1 | null {
        const ref = this.discovery.resolveElement(element);
        if (!ref) return null;
        const snapshot = this.discovery.read();
        if (snapshot.kind !== 'ready') return null;
        const entry = snapshot.entries.find((candidate) => candidate.ref.slotKey === ref.slotKey);
        return entry?.identity ? toV1Target(snapshot.document.documentKey, entry.identity) : null;
    }

    async locate(target: ConversationTargetV1, signal?: AbortSignal): Promise<ConversationMaterializationResultV1> {
        const result = await this.discovery.locate({
            kind: 'assistant-message',
            documentKey: target.documentKey,
            assistantMessageId: target.assistantMessageId,
        }, { signal });
        if (result.kind === 'located') return 'located';
        if (result.kind === 'cancelled') return 'cancelled';
        return 'unavailable';
    }

    dispose(): void {
        this.unsubscribe();
        this.listeners.clear();
    }

    private rebuild(): void {
        const snapshot = this.discovery.read();
        const entries = snapshot.kind === 'ready'
            ? snapshot.entries
                .filter((entry) => entry.identity && (entry.materialization.user || entry.materialization.assistant))
                .map((entry) => ({
                    target: toV1Target(snapshot.document.documentKey, entry.identity!),
                    anchorElement: entry.materialization.assistant?.anchorElement
                        ?? entry.materialization.user?.anchorElement!,
                }))
            : [];
        const next: MaterializationSnapshotV1 = Object.freeze({
            materializationToken: snapshot.kind === 'ready'
                ? snapshot.tokens.materializationToken
                : 'chatgpt-materialization-v2:empty',
            contentToken: snapshot.kind === 'ready' ? snapshot.tokens.contentToken : null,
            entries: Object.freeze(entries.map((entry) => Object.freeze({
                target: Object.freeze({ ...entry.target }),
                anchorElement: entry.anchorElement,
            }))),
        });
        // The materialization token is deliberately independent from content,
        // but this compatibility snapshot carries both.  A sealed turn can
        // arrive while the same surface remains mounted; retain the anchor
        // token and refresh the content token so V1 surface evidence cannot
        // become falsely stale forever.
        if (
            next.materializationToken === this.snapshot.materializationToken
            && next.contentToken === this.snapshot.contentToken
        ) return;
        this.snapshot = next;
        for (const listener of Array.from(this.listeners)) {
            try {
                listener(this.snapshot);
            } catch {
            }
        }
    }
}

function projectState(discovery: ConversationDiscoveryPortV2): ConversationContentStateV1 {
    const snapshot = discovery.read();
    if (snapshot.kind === 'idle') return { kind: 'idle', document: null, snapshot: null };
    if (snapshot.kind === 'unavailable') {
        return {
            kind: 'unavailable',
            document: snapshot.document ? toV1Document(snapshot.document) : null,
            snapshot: null,
            reason: snapshot.reason === 'host-root-unavailable' || snapshot.reason === 'ambiguous-topology'
                ? 'source-unavailable'
                : snapshot.reason === 'topology-conflict'
                    ? 'identity-conflict'
                    : 'unsupported-route',
            retryable: snapshot.reason !== 'unsupported-route',
        };
    }
    const document = toV1Document(snapshot.document);
    const filtered = snapshot.entries
        .filter((entry) => entry.content.kind === 'ready')
        .map((entry) => discovery.readTurn({ kind: 'entry', ref: entry.ref }))
        .filter((result): result is Extract<ReturnType<ConversationDiscoveryPortV2['readTurn']>, { kind: 'ready' }> => result.kind === 'ready')
        .map((result) => toV1Turn(result));
    const proof: ConversationSnapshotProofV1 = {
        basis: 'host-born',
        order: 'complete',
        bodies: snapshot.readyCount === snapshot.totalCount ? 'complete' : 'gapped',
        tail: snapshot.entries[snapshot.entries.length - 1]?.content.kind === 'ready' ? 'stable' : 'streaming',
        gaps: snapshot.entries
            .filter((entry) => entry.content.kind !== 'ready')
            .map((entry) => ({
                kind: 'body' as const,
                turnId: entry.ref.slotKey,
                reason: 'body not hydrated',
            })),
    };
    const projected: ConversationSnapshotV1 = {
        schemaVersion: 1,
        document,
        contentToken: snapshot.tokens.contentToken,
        coverage: snapshot.readyCount === snapshot.totalCount ? 'complete' : 'partial',
        turns: filtered,
        proof,
    };
    return {
        kind: 'ready',
        document,
        snapshot: projected,
    };
}

function toV1Document(document: ConversationDocumentEpochV2): ConversationDocumentRefV1 {
    return {
        key: document.documentKey,
        platformId: document.platformId,
        conversationId: document.conversationId,
        canonicalUrl: document.canonicalUrl,
        title: document.title,
    };
}

function toV1Target(documentKey: string, identity: ConversationTurnIdentityV2): ConversationTargetV1 {
    return {
        documentKey,
        turnId: identity.turnId,
        assistantMessageId: identity.assistantMessageId,
        userMessageId: identity.userMessageId,
    };
}

function toV1Turn(result: Extract<ReturnType<ConversationDiscoveryPortV2['readTurn']>, { kind: 'ready' }>): ConversationTurnV1 {
    return {
        key: result.turn.key,
        ordinal: result.position,
        identity: {
            turnId: result.turn.identity.turnId,
            userMessageId: result.turn.identity.userMessageId,
            assistantMessageId: result.turn.identity.assistantMessageId,
        },
        userText: result.turn.user.text,
        assistantMarkdown: result.turn.assistant.markdown,
        assistantProvenance: {
            authority: 'host-rendered',
            fidelity: 'normalized',
            producer: 'rendered-content-v2',
        },
    };
}
