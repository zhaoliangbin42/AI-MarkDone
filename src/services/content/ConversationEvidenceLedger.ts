import {
    freezeConversationSnapshotV1,
    type ConversationDocumentRefV1,
    type ConversationSnapshotProofV1,
    type ConversationSnapshotV1,
    type ConversationTurnV1,
} from '../../contracts/conversationContent';
import type {
    ConversationEvidenceEventV1,
    ConversationEvidenceGapV1,
    ConversationEvidenceIngestResultV1,
    ConversationEvidenceLedgerViewV1,
    ConversationSourceEvidenceBatchV1,
    ConversationTurnEvidenceV1,
    ConversationTurnReadPortV1,
    ConversationTurnReadResultV1,
    ConversationEvidenceEpochV1,
} from '../../contracts/conversationDiscovery';
import type { ConversationTargetV1 } from '../../contracts/conversationMaterialization';

type TurnKey = string;

type SealedTurn = Readonly<{
    key: TurnKey;
    turn: ConversationTurnV1;
    digest: string;
    firstSeen: number;
}>;

/**
 * Deep, provider-neutral reducer for source and stable-host evidence.
 *
 * The ledger deliberately has no DOM, browser, provider or transport
 * dependency. Adapters submit already validated semantic facts; this Module
 * owns epoch fencing, identity joins, first-write sealing, order projection
 * and completeness proof.
 */
export class ConversationEvidenceLedger implements ConversationTurnReadPortV1 {
    private document: ConversationDocumentRefV1 | null = null;
    private epoch: ConversationEvidenceEpochV1 | null = null;
    private branchKey: string | null = null;
    private sourceCompleteOrder: TurnKey[] | null = null;
    private readonly expectedSourceKeys = new Set<TurnKey>();
    private readonly records = new Map<TurnKey, SealedTurn>();
    private readonly aliases = new Map<string, TurnKey | null>();
    private readonly firstSeen = new Map<TurnKey, number>();
    private readonly edges = new Map<TurnKey, Set<TurnKey>>();
    private readonly seenCaptures = new Map<string, string>();
    private readonly gaps = new Map<string, ConversationEvidenceGapV1>();
    private readonly conflicts = new Set<string>();
    private sequence = 0;
    private lastRevision = 0;

    reset(document: ConversationDocumentRefV1 | null, epoch: ConversationEvidenceEpochV1 | null): void {
        this.document = document ? Object.freeze({ ...document }) : null;
        this.epoch = epoch;
        this.branchKey = null;
        this.sourceCompleteOrder = null;
        this.expectedSourceKeys.clear();
        this.records.clear();
        this.aliases.clear();
        this.firstSeen.clear();
        this.edges.clear();
        this.seenCaptures.clear();
        this.gaps.clear();
        this.conflicts.clear();
        this.sequence = 0;
        this.lastRevision = 0;
    }

    /** Update display-only document metadata without losing page evidence. */
    updateDocument(document: ConversationDocumentRefV1): void {
        if (this.document?.key !== document.key) return;
        this.document = Object.freeze({ ...document });
    }

    ingest(event: ConversationEvidenceEventV1): ConversationEvidenceIngestResultV1 {
        if (!this.document || !this.epoch) {
            this.reset(event.document, event.epoch);
        }

        if (
            this.document?.key !== event.document.key
            || this.epoch !== event.epoch
        ) {
            return { status: 'ignored-epoch', view: this.read() };
        }

        const eventDigest = digestEvent(event);
        const previousDigest = this.seenCaptures.get(event.captureId);
        if (previousDigest !== undefined) {
            return {
                status: previousDigest === eventDigest ? 'duplicate' : 'conflict',
                view: this.read(),
            };
        }
        if (
            event.kind === 'source-batch'
            && this.branchKey === event.branchKey
            && event.revision < this.lastRevision
        ) {
            return { status: 'ignored-revision', view: this.read() };
        }
        this.seenCaptures.set(event.captureId, eventDigest);
        if (event.kind === 'source-batch') {
            this.lastRevision = Math.max(this.lastRevision, event.revision);
        }

        let status: ConversationEvidenceIngestResultV1['status'] = 'accepted';
        if (event.kind === 'source-batch') {
            status = this.ingestSourceBatch(event);
        } else {
            status = this.ingestTurn(event);
        }
        return { status, view: this.read() };
    }

    read(): ConversationEvidenceLedgerViewV1 {
        const projected = this.projectTurns();
        const snapshot = projected.length > 0
            ? this.createSnapshot(projected)
            : null;
        return Object.freeze({
            document: this.document,
            epoch: this.epoch,
            snapshot,
            sealedTurnIds: Object.freeze(Array.from(this.records.values(), (entry) => (
                entry.turn.identity.assistantMessageId
            ))),
            conflicts: Object.freeze(Array.from(this.conflicts)),
        });
    }

    readTurn(target: ConversationTargetV1): ConversationTurnReadResultV1 {
        if (!this.document || this.document.key !== target.documentKey) {
            return {
                kind: 'unavailable',
                target: Object.freeze({ ...target }),
                reason: 'document-mismatch',
            };
        }

        const key = this.resolveTarget(target);
        if (!key) {
            return {
                kind: 'unavailable',
                target: Object.freeze({ ...target }),
                reason: 'not-recognized',
            };
        }
        const record = this.records.get(key);
        if (!record) {
            return {
                kind: 'unavailable',
                target: Object.freeze({ ...target }),
                reason: 'not-recognized',
            };
        }
        const snapshot = this.read().snapshot;
        return {
            kind: 'ready',
            target: Object.freeze({ ...target }),
            turn: record.turn,
            contentToken: snapshot?.contentToken ?? `conversation-content-v1:turn:${key}`,
        };
    }

    private ingestSourceBatch(event: ConversationSourceEvidenceBatchV1): ConversationEvidenceIngestResultV1['status'] {
        const incomingKeys = event.turns.map((turn) => turnKey(turn));
        let status: ConversationEvidenceIngestResultV1['status'] = 'accepted';
        const branchChanged = this.branchKey !== null && this.branchKey !== event.branchKey;
        if (branchChanged) {
            // A branch is a new active semantic projection.  Retaining old
            // branch records in the same projection would silently append a
            // regenerated suffix to the current conversation.
            this.clearBranchEvidence();
        }
        this.branchKey = event.branchKey;

        for (const turn of event.turns) {
            const result = this.sealTurn(turn);
            if (result === 'conflict') status = 'conflict';
        }
        this.addOrderEdges(incomingKeys);

        if (event.order === 'complete') {
            this.sourceCompleteOrder = unique(incomingKeys);
            this.expectedSourceKeys.clear();
            this.sourceCompleteOrder.forEach((key) => this.expectedSourceKeys.add(key));
            this.deleteGapsByKind('order');
            this.deleteBodyGapsForSealedTurns();
        } else {
            if (!this.sourceCompleteOrder) {
                this.addGap({
                    kind: 'order',
                    reason: 'source evidence covers a window, not the complete branch',
                });
            }
        }
        for (const gap of event.gaps) {
            if (gap.kind === 'order' && this.sourceCompleteOrder) continue;
            this.addGap(gap);
        }
        return status;
    }

    private ingestTurn(event: ConversationTurnEvidenceV1): ConversationEvidenceIngestResultV1['status'] {
        const result = this.sealTurn(event.turn);
        if (result === 'accepted') this.addOrderEdges([turnKey(event.turn)]);
        return result;
    }

    private sealTurn(turn: ConversationTurnV1): 'accepted' | 'duplicate' | 'conflict' {
        if (
            !turn.identity.turnId.trim()
            || !turn.identity.assistantMessageId.trim()
            || typeof turn.userText !== 'string'
            || !turn.assistantMarkdown.trim()
        ) {
            this.addGap({
                kind: 'body',
                turnId: turn.identity.assistantMessageId || turn.identity.turnId,
                reason: 'turn has no stable identity or complete assistant Markdown',
            });
            return 'conflict';
        }

        const key = turnKey(turn);
        const digest = digestTurn(turn);
        const existing = this.records.get(key);
        if (existing) {
            if (existing.digest === digest) return 'duplicate';
            this.conflicts.add(key);
            return 'conflict';
        }

        if (!this.bindAlias(`turn:${turn.identity.turnId}`, key)) return 'conflict';
        if (!this.bindAlias(`assistant:${turn.identity.assistantMessageId}`, key)) return 'conflict';
        if (
            turn.identity.userMessageId
            && !this.bindAlias(`user:${turn.identity.userMessageId}`, key)
        ) return 'conflict';

        const sealed = Object.freeze({
            key,
            turn: freezeTurn(turn),
            digest,
            firstSeen: this.sequence++,
        });
        this.records.set(key, sealed);
        this.firstSeen.set(key, sealed.firstSeen);
        return 'accepted';
    }

    private bindAlias(alias: string, key: TurnKey): boolean {
        const existing = this.aliases.get(alias);
        if (existing === undefined) {
            this.aliases.set(alias, key);
            return true;
        }
        if (existing === key) return true;
        this.aliases.set(alias, null);
        this.conflicts.add(alias);
        return false;
    }

    private addOrderEdges(keys: readonly TurnKey[]): void {
        const ordered = unique(keys);
        for (let index = 1; index < ordered.length; index += 1) {
            const previous = ordered[index - 1]!;
            const next = ordered[index]!;
            const successors = this.edges.get(previous) ?? new Set<TurnKey>();
            successors.add(next);
            this.edges.set(previous, successors);
        }
    }

    private resolveTarget(target: ConversationTargetV1): TurnKey | null {
        const candidates = [
            target.assistantMessageId ? this.aliases.get(`assistant:${target.assistantMessageId}`) : undefined,
            target.turnId ? this.aliases.get(`turn:${target.turnId}`) : undefined,
            target.userMessageId ? this.aliases.get(`user:${target.userMessageId}`) : undefined,
        ].filter((value): value is TurnKey => typeof value === 'string');
        const uniqueCandidates = unique(candidates);
        if (uniqueCandidates.length !== 1) return null;
        const record = this.records.get(uniqueCandidates[0]!);
        if (!record) return null;
        if (record.turn.identity.assistantMessageId !== target.assistantMessageId) return null;
        if (record.turn.identity.turnId !== target.turnId) return null;
        if (
            target.userMessageId !== undefined
            && record.turn.identity.userMessageId !== target.userMessageId
        ) return null;
        return uniqueCandidates[0]!;
    }

    private projectTurns(): ConversationTurnV1[] {
        const keys = this.sourceCompleteOrder
            ? this.sourceCompleteOrder.filter((key) => this.records.has(key))
            : topologicalOrder(this.records, this.edges, this.firstSeen);
        return keys
            .map((key) => this.records.get(key)?.turn ?? null)
            .filter((turn): turn is ConversationTurnV1 => turn !== null);
    }

    private createSnapshot(turns: readonly ConversationTurnV1[]): ConversationSnapshotV1 {
        const orderComplete = Boolean(
            this.sourceCompleteOrder
            && this.sourceCompleteOrder.length === this.expectedSourceKeys.size
            && this.sourceCompleteOrder.every((key) => this.records.has(key))
            && !Array.from(this.records.keys()).some((key) => !this.expectedSourceKeys.has(key))
            && !this.hasGapKind('order')
            && !this.hasGapKind('identity'),
        );
        const bodiesComplete = orderComplete
            && this.expectedSourceKeys.size === turns.length
            && !this.hasGapKind('body');
        const proof: ConversationSnapshotProofV1 = Object.freeze({
            order: orderComplete ? 'complete' : 'gapped',
            bodies: bodiesComplete ? 'complete' : 'gapped',
            tail: this.hasGapKind('tail') ? 'streaming' : 'stable',
            gaps: Object.freeze([
                ...Array.from(this.gaps.values()),
                ...(!orderComplete && !this.hasGapKind('order')
                    ? [{ kind: 'order' as const, reason: 'global source order is not proven' }]
                    : []),
                ...(!bodiesComplete && !this.hasGapKind('body')
                    ? [{ kind: 'body' as const, reason: 'not every source body is sealed' }]
                    : []),
            ].map((gap) => Object.freeze({ ...gap }))),
        });
        const snapshotWithoutToken = {
            schemaVersion: 1 as const,
            document: this.document!,
            coverage: orderComplete && bodiesComplete ? 'complete' as const : 'partial' as const,
            turns: turns.map((turn, index) => ({ ...turn, ordinal: index + 1 })),
            proof,
        };
        const contentToken = createContentToken(snapshotWithoutToken);
        const snapshot = freezeConversationSnapshotV1({
            ...snapshotWithoutToken,
            contentToken,
        });
        return snapshot;
    }

    private addGap(gap: ConversationEvidenceGapV1): void {
        const key = `${gap.kind}:${gap.turnId ?? ''}:${gap.beforeTurnId ?? ''}:${gap.afterTurnId ?? ''}:${gap.reason}`;
        this.gaps.set(key, Object.freeze({ ...gap }));
    }

    private clearBranchEvidence(): void {
        this.sourceCompleteOrder = null;
        this.expectedSourceKeys.clear();
        this.records.clear();
        this.aliases.clear();
        this.firstSeen.clear();
        this.edges.clear();
        this.gaps.clear();
        this.conflicts.clear();
        this.lastRevision = 0;
    }

    private deleteGapsByKind(kind: ConversationEvidenceGapV1['kind']): void {
        for (const [key, gap] of this.gaps.entries()) {
            if (gap.kind === kind) this.gaps.delete(key);
        }
    }

    private deleteBodyGapsForSealedTurns(): void {
        for (const [key, gap] of this.gaps.entries()) {
            if (gap.kind !== 'body' || !gap.turnId) continue;
            const sealed = Array.from(this.records.values()).some((entry) => (
                entry.turn.identity.turnId === gap.turnId
                || entry.turn.identity.assistantMessageId === gap.turnId
            ));
            if (sealed) this.gaps.delete(key);
        }
    }

    private hasGapKind(kind: ConversationEvidenceGapV1['kind']): boolean {
        return Array.from(this.gaps.values()).some((gap) => gap.kind === kind);
    }
}

function turnKey(turn: ConversationTurnV1): TurnKey {
    return `assistant:${turn.identity.assistantMessageId}`;
}

function freezeTurn(turn: ConversationTurnV1): ConversationTurnV1 {
    return Object.freeze({
        ...turn,
        identity: Object.freeze({ ...turn.identity }),
        ...(turn.assistantProvenance
            ? { assistantProvenance: Object.freeze({ ...turn.assistantProvenance }) }
            : {}),
    });
}

function digestTurn(turn: ConversationTurnV1): string {
    return JSON.stringify({
        identity: turn.identity,
        userText: turn.userText,
        assistantMarkdown: turn.assistantMarkdown,
        assistantProvenance: turn.assistantProvenance,
    });
}

function digestEvent(event: ConversationEvidenceEventV1): string {
    // Revision is an observation clock, not semantic evidence.  Re-capturing
    // the same sealed batch at a later revision must remain idempotent.
    const { revision: _revision, ...semanticEvent } = event;
    return JSON.stringify(semanticEvent);
}

function unique<T>(values: readonly T[]): T[] {
    return Array.from(new Set(values));
}

function topologicalOrder(
    records: ReadonlyMap<TurnKey, SealedTurn>,
    edges: ReadonlyMap<TurnKey, ReadonlySet<TurnKey>>,
    firstSeen: ReadonlyMap<TurnKey, number>,
): TurnKey[] {
    const indegree = new Map<TurnKey, number>();
    for (const key of records.keys()) indegree.set(key, 0);
    for (const [from, successors] of edges.entries()) {
        if (!records.has(from)) continue;
        for (const to of successors) {
            if (!records.has(to)) continue;
            indegree.set(to, (indegree.get(to) ?? 0) + 1);
        }
    }

    const compare = (left: TurnKey, right: TurnKey) => (
        (firstSeen.get(left) ?? 0) - (firstSeen.get(right) ?? 0)
    );
    const ready = Array.from(indegree.entries())
        .filter(([, degree]) => degree === 0)
        .map(([key]) => key)
        .sort(compare);
    const ordered: TurnKey[] = [];
    while (ready.length > 0) {
        const next = ready.shift()!;
        ordered.push(next);
        for (const successor of edges.get(next) ?? []) {
            if (!indegree.has(successor)) continue;
            const degree = (indegree.get(successor) ?? 0) - 1;
            indegree.set(successor, degree);
            if (degree === 0) {
                ready.push(successor);
                ready.sort(compare);
            }
        }
    }

    if (ordered.length < indegree.size) {
        const remaining = Array.from(indegree.keys())
            .filter((key) => !ordered.includes(key))
            .sort(compare);
        ordered.push(...remaining);
    }
    return ordered;
}

function createContentToken(snapshot: {
    document: ConversationDocumentRefV1;
    turns: readonly ConversationTurnV1[];
}): string {
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
