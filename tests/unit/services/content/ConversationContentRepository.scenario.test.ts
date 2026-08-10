import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
    ConversationContentAcquisitionError,
    ConversationContentRepository,
    type ConversationContentCandidateV1,
} from '@/services/content/ConversationContentRepository';
import {
    createConversationDocumentKeyV1,
    type ConversationDocumentRefV1,
    type ConversationTurnV1,
} from '@/contracts/conversationContent';

function document(conversationId: string): ConversationDocumentRefV1 {
    return {
        key: createConversationDocumentKeyV1('chatgpt', conversationId),
        platformId: 'chatgpt',
        conversationId,
        title: `Conversation ${conversationId}`,
        canonicalUrl: `https://chatgpt.com/c/${conversationId}`,
    };
}

function candidate(ref: ConversationDocumentRefV1, answer = 'Answer'): ConversationContentCandidateV1 {
    return {
        document: ref,
        coverage: 'complete',
        turns: [{
            key: 'turn-1',
            ordinal: 1,
            identity: {
                turnId: 'turn-1',
                userMessageId: 'user-1',
                assistantMessageId: 'assistant-1',
            },
            userText: 'Question',
            assistantMarkdown: answer,
        }],
    };
}

function candidateTurn(
    ref: ConversationDocumentRefV1,
    turnId: string,
    answer: string,
): ConversationContentCandidateV1 {
    return {
        document: ref,
        coverage: 'complete',
        turns: [{
            key: `${turnId}:assistant-${turnId}`,
            ordinal: 1,
            identity: {
                turnId,
                userMessageId: `user-${turnId}`,
                assistantMessageId: `assistant-${turnId}`,
            },
            userText: `Question ${turnId}`,
            assistantMarkdown: answer,
        }],
    };
}

function completeCandidate(
    ref: ConversationDocumentRefV1,
    answers: readonly string[],
): ConversationContentCandidateV1 {
    return {
        document: ref,
        coverage: 'complete',
        turns: answers.map((answer, index) => ({
            key: `turn-${index + 1}:assistant-${index + 1}`,
            ordinal: index + 1,
            identity: {
                turnId: `turn-${index + 1}`,
                userMessageId: `user-${index + 1}`,
                assistantMessageId: `assistant-${index + 1}`,
            },
            userText: index === 0 ? 'Question' : `Question ${index + 1}`,
            assistantMarkdown: answer,
        })),
    };
}

function hostTurn(index: number, answer: string): ConversationTurnV1 {
    return {
        key: `turn-${index}:assistant-${index}`,
        ordinal: index,
        identity: {
            turnId: `turn-${index}`,
            userMessageId: `user-${index}`,
            assistantMessageId: `assistant-${index}`,
        },
        userText: `Question ${index}`,
        assistantMarkdown: answer,
        assistantProvenance: {
            authority: 'host-rendered',
            fidelity: 'normalized',
            producer: 'rendered-content-v2',
        },
    };
}

function deferred<T>(): {
    promise: Promise<T>;
    resolve(value: T): void;
    reject(error: unknown): void;
} {
    let resolve!: (value: T) => void;
    let reject!: (error: unknown) => void;
    const promise = new Promise<T>((res, rej) => {
        resolve = res;
        reject = rej;
    });
    return { promise, resolve, reject };
}

describe('ConversationContentRepository', () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    it('keeps consumer refresh local and cannot start baseline admission', async () => {
        const ref = document('conversation-refresh-boundary');
        const readBaseline = vi.fn(async () => candidate(ref));
        const repository = new ConversationContentRepository({
            resolveDocument: () => ref,
            readBaseline,
        });

        expect(await repository.refresh()).toMatchObject({ kind: 'idle', snapshot: null });
        expect(readBaseline).not.toHaveBeenCalled();

        const ready = await repository.enterCurrentEpoch();
        expect(ready.kind).toBe('ready');
        expect(readBaseline).toHaveBeenCalledTimes(1);
    });

    it('publishes syncing then one immutable baseline and ignores later signals after the gate closes', async () => {
        let current: ConversationDocumentRefV1 | null = document('conversation-1');
        const pending = deferred<ConversationContentCandidateV1 | null>();
        const readBaseline = vi.fn(() => pending.promise);
        const repository = new ConversationContentRepository({
            resolveDocument: () => current,
            readBaseline,
        });
        const states: string[] = [];
        repository.subscribe((state) => states.push(state.kind));

        const firstRefresh = repository.enterCurrentEpoch();
        const secondRefresh = repository.enterCurrentEpoch();
        expect(firstRefresh).toBe(secondRefresh);
        await Promise.resolve();
        expect(readBaseline).toHaveBeenCalledTimes(1);
        expect(repository.read().kind).toBe('syncing');

        pending.resolve(candidate(current!));
        const ready = await firstRefresh;
        expect(ready.kind).toBe('ready');
        if (ready.kind !== 'ready') throw new Error('expected ready state');
        expect(ready.snapshot.turns[0]?.assistantMarkdown).toBe('Answer');
        expect(repository.isCurrent(ready.snapshot.contentToken)).toBe(true);
        expect(Object.isFrozen(ready.snapshot)).toBe(true);

        repository.notifyBaselineCaptured();
        repository.notifyBaselineCaptured();
        await vi.advanceTimersByTimeAsync(150);
        expect(readBaseline).toHaveBeenCalledTimes(1);
        expect(states[0]).toBe('idle');
    });

    it('drops a pending bridge signal when the in-flight baseline closes the gate', async () => {
        const ref = document('conversation-pending');
        const first = deferred<ConversationContentCandidateV1 | null>();
        const readBaseline = vi.fn()
            .mockImplementationOnce(() => first.promise)
            .mockResolvedValueOnce(completeCandidate(ref, ['Answer 1', 'Answer 2']));
        const repository = new ConversationContentRepository({
            resolveDocument: () => ref,
            readBaseline,
        });

        const firstRefresh = repository.enterCurrentEpoch();
        await Promise.resolve();
        expect(readBaseline).toHaveBeenCalledTimes(1);

        repository.notifyBaselineCaptured();
        await vi.advanceTimersByTimeAsync(150);
        expect(readBaseline).toHaveBeenCalledTimes(1);

        first.resolve(candidate(ref, 'Answer 1'));
        await firstRefresh;
        await Promise.resolve();
        await Promise.resolve();

        expect(readBaseline).toHaveBeenCalledTimes(1);
        const state = repository.read();
        expect(state.kind).toBe('ready');
        if (state.kind !== 'ready') throw new Error('expected ready state');
        expect(state.snapshot.turns.map((turn) => turn.assistantMarkdown)).toEqual(['Answer 1']);
    });

    it('does not replay a closed baseline from a same-document refresh', async () => {
        const ref = document('conversation-1');
        let next: ConversationContentCandidateV1 | null = candidate(ref);
        const readBaseline = vi.fn(async () => {
            if (next) {
                const result = next;
                next = null;
                return result;
            }
            throw new ConversationContentAcquisitionError('source-timeout');
        });
        const repository = new ConversationContentRepository({
            resolveDocument: () => ref,
            readBaseline,
        });

        await repository.enterCurrentEpoch();
        const unchanged = await repository.refresh();
        expect(unchanged.kind).toBe('ready');
        if (unchanged.kind !== 'ready') throw new Error('expected ready state');
        expect(unchanged.snapshot.turns).toHaveLength(1);
        expect(readBaseline).toHaveBeenCalledTimes(1);
    });

    it('can resume after a page-scoped runtime disable', async () => {
        const ref = document('conversation-resume');
        const readBaseline = vi.fn(async () => candidate(ref));
        const repository = new ConversationContentRepository({
            resolveDocument: () => ref,
            readBaseline,
        });

        await repository.enterCurrentEpoch();
        repository.dispose();
        expect(await repository.refresh()).toEqual(repository.read());
        expect(readBaseline).toHaveBeenCalledTimes(1);

        repository.resume();
        await repository.refresh();
        expect(readBaseline).toHaveBeenCalledTimes(1);
        expect(repository.read().kind).toBe('ready');
    });

    it('does not let a late old-epoch result overwrite a new document', async () => {
        let current: ConversationDocumentRefV1 | null = document('conversation-a');
        const pendingA = deferred<ConversationContentCandidateV1 | null>();
        const pendingB = deferred<ConversationContentCandidateV1 | null>();
        const readBaseline = vi.fn((ref: ConversationDocumentRefV1) => (
            ref.conversationId === 'conversation-a' ? pendingA.promise : pendingB.promise
        ));
        const repository = new ConversationContentRepository({
            resolveDocument: () => current,
            readBaseline,
        });

        const old = repository.enterCurrentEpoch();
        current = document('conversation-b');
        const next = repository.enterCurrentEpoch();
        pendingA.resolve(candidate(document('conversation-a'), 'old answer'));
        pendingB.resolve(candidate(document('conversation-b'), 'new answer'));

        await old;
        const ready = await next;
        expect(ready.kind).toBe('ready');
        if (ready.kind !== 'ready') throw new Error('expected ready state');
        expect(ready.document.conversationId).toBe('conversation-b');
        expect(ready.snapshot.turns[0]?.assistantMarkdown).toBe('new answer');
    });

    it('publishes explicit unavailable instead of an empty ready conversation', async () => {
        const ref = document('conversation-1');
        const repository = new ConversationContentRepository({
            resolveDocument: () => ref,
            readBaseline: async () => null,
        });

        const state = await repository.enterCurrentEpoch();
        expect(state).toMatchObject({
            kind: 'unavailable',
            reason: 'source-unavailable',
            retryable: true,
        });
        expect(repository.isCurrent('')).toBe(false);
    });

    it('publishes a complete baseline and appends a stable host turn to the same cache', async () => {
        const ref = document('conversation-coverage');
        const repository = new ConversationContentRepository({
            resolveDocument: () => ref,
            readBaseline: async () => completeCandidate(ref, ['Answer']),
        });
        const baseline = await repository.enterCurrentEpoch();
        expect(baseline.kind).toBe('ready');
        if (baseline.kind !== 'ready') throw new Error('expected ready baseline state');
        expect(baseline.snapshot.coverage).toBe('complete');
        expect(baseline.snapshot.proof).toEqual({ basis: 'source' });

        const complete = repository.ingestHostTurn({
            turn: hostTurn(2, 'Answer 2'),
            semanticDigest: 'host-turn-2',
            captureId: 'host-turn-2',
            revision: 2,
            predecessorAssistantMessageId: 'assistant-1',
            emptyProven: false,
        });
        expect(complete.kind).toBe('ready');
        if (complete.kind !== 'ready') throw new Error('expected complete ready state');
        expect(complete.snapshot.coverage).toBe('complete');
        expect(complete.snapshot.proof).toEqual({ basis: 'hybrid' });
        expect(complete.snapshot.turns).toHaveLength(2);
    });

    it('does not reread the source after the baseline gate closes', async () => {
        const ref = document('conversation-baseline-window');
        const readBaseline = vi.fn(async () => completeCandidate(ref, ['Answer 1', 'Answer 2']));
        const repository = new ConversationContentRepository({
            resolveDocument: () => ref,
            readBaseline,
        });

        const first = await repository.enterCurrentEpoch();
        repository.notifyBaselineCaptured();
        await vi.advanceTimersByTimeAsync(150);
        const refreshed = await repository.refresh();

        expect(first.kind).toBe('ready');
        expect(refreshed.kind).toBe('ready');
        if (refreshed.kind !== 'ready') throw new Error('expected ready state');
        expect(refreshed.snapshot.turns.map((turn) => turn.assistantMarkdown)).toEqual([
            'Answer 1',
            'Answer 2',
        ]);
        expect(readBaseline).toHaveBeenCalledTimes(1);
    });

    it('retries an unavailable baseline only after a real lifecycle signal', async () => {
        const ref = document('conversation-baseline-retry');
        let next: ConversationContentCandidateV1 | null = null;
        const readBaseline = vi.fn(async () => next);
        const repository = new ConversationContentRepository({
            resolveDocument: () => ref,
            readBaseline,
        });

        const unavailable = await repository.enterCurrentEpoch();
        next = completeCandidate(ref, ['Answer 1', 'Answer 2']);
        expect(await repository.refresh()).toBe(unavailable);
        repository.notifyBaselineCaptured();
        await vi.advanceTimersByTimeAsync(150);
        const grown = repository.read();

        expect(unavailable.kind).toBe('unavailable');
        expect(grown.kind).toBe('ready');
        if (grown.kind !== 'ready') throw new Error('expected ready state');
        expect(grown.snapshot.turns).toHaveLength(2);
        expect(readBaseline).toHaveBeenCalledTimes(2);
    });

    it('rejects a host-shaped candidate at the passive baseline port', async () => {
        const ref = document('conversation-independent-evidence');
        const hostTurn = {
            ...candidateTurn(ref, 'turn-2', 'Rendered answer'),
            branchKey: undefined,
            captureId: 'host-window',
            sourceRevision: 2,
            origin: 'host' as const,
            coverage: 'complete' as const,
        };
        const repository = new ConversationContentRepository({
            resolveDocument: () => ref,
            readBaseline: async () => hostTurn,
        });

        const state = await repository.enterCurrentEpoch();

        expect(state.kind).toBe('unavailable');
        expect(repository.read().snapshot).toBeNull();
    });

    it('keeps the published baseline complete after later capture signals', async () => {
        const ref = document('conversation-complete-coverage');
        const readBaseline = vi.fn(async () => candidate(ref));
        const repository = new ConversationContentRepository({
            resolveDocument: () => ref,
            readBaseline,
        });

        const complete = await repository.enterCurrentEpoch();
        repository.notifyBaselineCaptured();
        await vi.advanceTimersByTimeAsync(150);
        const unchanged = await repository.refresh();

        expect(complete.kind).toBe('ready');
        expect(unchanged.kind).toBe('ready');
        if (unchanged.kind !== 'ready') throw new Error('expected ready state');
        expect(unchanged.snapshot.coverage).toBe('complete');
        expect(readBaseline).toHaveBeenCalledTimes(1);
    });

    it('keeps the first sealed body when a later host observation conflicts', async () => {
        const ref = document('conversation-sealed-conflict');
        const next: ConversationContentCandidateV1 = candidate(ref, 'Canonical answer');
        const repository = new ConversationContentRepository({
            resolveDocument: () => ref,
            readBaseline: async () => next,
        });

        await repository.enterCurrentEpoch();
        const conflicted = repository.ingestHostTurn({
            turn: {
                ...hostTurn(1, 'Rendered divergent answer'),
                identity: {
                    turnId: 'turn-1',
                    userMessageId: 'user-1',
                    assistantMessageId: 'assistant-1',
                },
            },
            semanticDigest: 'host-conflict',
            captureId: 'host-conflict',
            revision: 2,
            predecessorAssistantMessageId: null,
            emptyProven: false,
        });

        expect(conflicted.kind).toBe('ready');
        if (conflicted.kind !== 'ready') throw new Error('expected ready state');
        expect(conflicted.snapshot.contentToken).toBe(repository.read().snapshot?.contentToken);
        expect(repository.readTurn({
            documentKey: ref.key,
            turnId: 'turn-1',
            assistantMessageId: 'assistant-1',
            userMessageId: 'user-1',
        })).toMatchObject({
            kind: 'ready',
            turn: { assistantMarkdown: 'Canonical answer' },
        });
    });

    it('keeps the baseline authoritative when a pre-route host fact conflicts with it', async () => {
        const ref = document('conversation-pending-prefix-conflict');
        let current: ConversationDocumentRefV1 | null = null;
        const repository = new ConversationContentRepository({
            resolveDocument: () => current,
            readBaseline: async () => candidate(ref, 'Canonical baseline answer'),
        });
        repository.ingestHostTurn({
            turn: hostTurn(1, 'Divergent rendered answer'),
            semanticDigest: 'pending-conflict',
            captureId: 'pending-conflict',
            revision: 1,
            predecessorAssistantMessageId: null,
            emptyProven: false,
        });

        current = ref;
        const state = await repository.enterCurrentEpoch();

        expect(state.kind).toBe('ready');
        if (state.kind !== 'ready') throw new Error('expected ready state');
        expect(state.snapshot.turns[0]?.assistantMarkdown).toBe('Canonical baseline answer');
    });

    it('treats identical pre-route host and baseline bodies as idempotent across provenance', async () => {
        const ref = document('conversation-pending-prefix-match');
        let current: ConversationDocumentRefV1 | null = null;
        const repository = new ConversationContentRepository({
            resolveDocument: () => current,
            readBaseline: async () => candidate(ref, 'Answer 1'),
        });
        repository.ingestHostTurn({
            turn: { ...hostTurn(1, 'Answer 1'), userText: 'Question' },
            semanticDigest: 'pending-match',
            captureId: 'pending-match',
            revision: 1,
            predecessorAssistantMessageId: null,
            emptyProven: false,
        });

        current = ref;
        const state = await repository.enterCurrentEpoch();

        expect(state.kind).toBe('ready');
        if (state.kind !== 'ready') throw new Error('expected ready state');
        expect(state.snapshot.proof?.basis).toBe('source');
        expect(state.snapshot.turns).toHaveLength(1);
        expect(state.snapshot.turns[0]?.assistantMarkdown).toBe('Answer 1');
    });

    it('does not replace an existing cache suffix when a later DOM branch reuses an older predecessor', async () => {
        const ref = document('conversation-regeneration');
        const repository = new ConversationContentRepository({
            resolveDocument: () => ref,
            readBaseline: async () => completeCandidate(ref, ['Answer 1']),
        });
        const baseline = await repository.enterCurrentEpoch();
        if (baseline.kind !== 'ready') throw new Error('expected ready baseline');
        repository.ingestHostTurn({
            turn: hostTurn(2, 'Answer 2'),
            semanticDigest: 'host-2',
            captureId: 'host-2',
            revision: 2,
            predecessorAssistantMessageId: 'assistant-1',
            emptyProven: false,
        });
        const before = repository.ingestHostTurn({
            turn: hostTurn(3, 'Answer 3'),
            semanticDigest: 'host-3',
            captureId: 'host-3',
            revision: 3,
            predecessorAssistantMessageId: 'assistant-2',
            emptyProven: false,
        });
        if (before.kind !== 'ready') throw new Error('expected hybrid projection');

        const regenerated = repository.ingestHostTurn({
            turn: {
                ...hostTurn(3, 'Regenerated answer 3'),
                key: 'turn-3b:assistant-3b',
                identity: {
                    turnId: 'turn-3b',
                    userMessageId: 'user-3',
                    assistantMessageId: 'assistant-3b',
                },
            },
            semanticDigest: 'host-3b',
            captureId: 'host-3b',
            revision: 4,
            predecessorAssistantMessageId: 'assistant-2',
            emptyProven: false,
        });

        expect(regenerated.kind).toBe('ready');
        if (regenerated.kind !== 'ready') throw new Error('expected regenerated projection');
        expect(regenerated.snapshot.projectionId).toBe(before.snapshot.projectionId);
        expect(regenerated.snapshot.turns.map((turn) => turn.identity.assistantMessageId)).toEqual([
            'assistant-1',
            'assistant-2',
            'assistant-3',
        ]);
    });

    it('keeps the cache consumable when a host observation reaches into the baseline prefix', async () => {
        const ref = document('conversation-historical-conflict');
        const repository = new ConversationContentRepository({
            resolveDocument: () => ref,
            readBaseline: async () => completeCandidate(ref, ['Answer 1', 'Answer 2']),
        });
        const baseline = await repository.enterCurrentEpoch();
        if (baseline.kind !== 'ready') throw new Error('expected ready baseline');

        const conflicted = repository.ingestHostTurn({
            turn: {
                ...hostTurn(2, 'Regenerated historical answer'),
                key: 'turn-2b:assistant-2b',
                identity: {
                    turnId: 'turn-2b',
                    userMessageId: 'user-2',
                    assistantMessageId: 'assistant-2b',
                },
            },
            semanticDigest: 'historical-2b',
            captureId: 'historical-2b',
            revision: 2,
            predecessorAssistantMessageId: 'assistant-1',
            emptyProven: false,
        });

        expect(conflicted.kind).toBe('ready');
        if (conflicted.kind !== 'ready') throw new Error('expected ready projection');
        expect(conflicted.snapshot.contentToken).toBe(baseline.snapshot.contentToken);
        expect(conflicted.snapshot.turns.map((turn) => turn.identity.assistantMessageId)).toEqual([
            'assistant-1',
            'assistant-2',
        ]);
    });
});
