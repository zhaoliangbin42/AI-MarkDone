import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
    ConversationContentAcquisitionError,
    ConversationContentRepository,
    type ConversationContentCandidateV1,
} from '@/services/content/ConversationContentRepository';
import {
    createConversationDocumentKeyV1,
    createConversationPageDocumentKeyV1,
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

function pageDocument(pageEpochId: string): ConversationDocumentRefV1 {
    return {
        key: createConversationPageDocumentKeyV1('chatgpt', pageEpochId),
        platformId: 'chatgpt',
        identityKind: 'page',
        conversationId: null,
        canonicalUrl: 'https://chatgpt.com/',
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

    it('stays idle when no page document is bound instead of treating the URL as an unsupported content route', async () => {
        const readBaseline = vi.fn();
        const repository = new ConversationContentRepository({
            resolveDocument: () => null,
            readBaseline,
        });

        expect(await repository.enterCurrentEpoch()).toEqual({
            kind: 'idle',
            document: null,
            snapshot: null,
        });
        expect(readBaseline).not.toHaveBeenCalled();
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

    it('publishes a stable host message immediately when the canonical session has no baseline', () => {
        const ref = document('conversation-host-first');
        const readBaseline = vi.fn(async () => null);
        const repository = new ConversationContentRepository({
            resolveDocument: () => ref,
            readBaseline,
        });

        const state = repository.ingestHostTurn({
            turn: hostTurn(1, 'Rendered answer'),
            semanticDigest: 'host-first',
            captureId: 'host-first',
            revision: 1,
            predecessorAssistantMessageId: null,
        });

        expect(state.kind).toBe('ready');
        if (state.kind !== 'ready') throw new Error('expected ready host snapshot');
        expect(state.snapshot.proof).toEqual({ basis: 'host' });
        expect(state.snapshot.turns.map((turn) => turn.assistantMarkdown)).toEqual(['Rendered answer']);
        expect(readBaseline).not.toHaveBeenCalled();
    });

    it('publishes host content without a canonical id and promotes identity without rebuilding the pool', async () => {
        const page = pageDocument('page-epoch-1');
        const canonical = document('conversation-promoted-after-host');
        let current: ConversationDocumentRefV1 = page;
        const readBaseline = vi.fn(async () => null);
        const repository = new ConversationContentRepository({
            resolveDocument: () => current,
            readBaseline,
        });

        expect(await repository.enterCurrentEpoch()).toMatchObject({
            kind: 'syncing',
            document: page,
            snapshot: null,
        });
        expect(readBaseline).not.toHaveBeenCalled();

        const hostReady = repository.ingestHostTurn({
            turn: hostTurn(1, 'Rendered without route identity'),
            semanticDigest: 'page-host-1',
            captureId: 'page-host-1',
            revision: 1,
            predecessorAssistantMessageId: null,
        });
        expect(hostReady.kind).toBe('ready');
        if (hostReady.kind !== 'ready') throw new Error('expected page-scoped host snapshot');
        const projectionId = hostReady.snapshot.projectionId;
        const contentToken = hostReady.snapshot.contentToken;
        const pageTarget = {
            documentKey: page.key,
            turnId: 'turn-1',
            userMessageId: 'user-1',
            assistantMessageId: 'assistant-1',
        };

        current = canonical;
        const promoted = await repository.enterCurrentEpoch();

        expect(promoted.kind).toBe('ready');
        if (promoted.kind !== 'ready') throw new Error('expected promoted host snapshot');
        expect(promoted.document).toEqual(canonical);
        expect(promoted.snapshot.projectionId).toBe(projectionId);
        expect(promoted.snapshot.contentToken).toBe(contentToken);
        expect(promoted.snapshot.turns.map((turn) => turn.assistantMarkdown)).toEqual([
            'Rendered without route identity',
        ]);
        expect(repository.readTurn(pageTarget)).toMatchObject({
            kind: 'ready',
            contentToken,
            turn: { assistantMarkdown: 'Rendered without route identity' },
        });
        expect(readBaseline).toHaveBeenCalledTimes(1);
    });

    it('publishes stable unbound host facts as soon as a canonical identity appears', () => {
        const ref = document('conversation-bound-after-host');
        let current: ConversationDocumentRefV1 | null = null;
        const readBaseline = vi.fn(async () => null);
        const repository = new ConversationContentRepository({
            resolveDocument: () => current,
            readBaseline,
        });

        repository.ingestHostTurn({
            turn: hostTurn(1, 'Rendered before route binding'),
            semanticDigest: 'unbound-host-1',
            captureId: 'unbound-host-1',
            revision: 1,
            predecessorAssistantMessageId: null,
        });
        expect(repository.read().kind).toBe('idle');

        current = ref;
        repository.bindCurrentDocument();

        const state = repository.read();
        expect(state.kind).toBe('ready');
        if (state.kind !== 'ready') throw new Error('expected bound host snapshot');
        expect(state.document.key).toBe(ref.key);
        expect(state.snapshot.proof).toEqual({ basis: 'host' });
        expect(state.snapshot.turns[0]?.assistantMarkdown).toBe('Rendered before route binding');
        expect(readBaseline).not.toHaveBeenCalled();
    });

    it('keeps a host-ready cache available when passive baseline admission fails', async () => {
        const ref = document('conversation-host-baseline-failure');
        const repository = new ConversationContentRepository({
            resolveDocument: () => ref,
            readBaseline: async () => null,
        });
        const hostReady = repository.ingestHostTurn({
            turn: hostTurn(1, 'Rendered answer'),
            semanticDigest: 'host-first',
            captureId: 'host-first',
            revision: 1,
            predecessorAssistantMessageId: null,
        });
        if (hostReady.kind !== 'ready') throw new Error('expected ready host snapshot');

        const afterFailure = await repository.enterCurrentEpoch();

        expect(afterFailure.kind).toBe('ready');
        if (afterFailure.kind !== 'ready') throw new Error('expected host cache to remain ready');
        expect(afterFailure.snapshot.contentToken).toBe(hostReady.snapshot.contentToken);
        expect(afterFailure.snapshot.turns[0]?.assistantMarkdown).toBe('Rendered answer');
    });

    it('adds only a verified historical prefix when the first baseline arrives after host messages', async () => {
        const ref = document('conversation-late-prefix');
        const readBaseline = vi.fn(async () => completeCandidate(ref, [
            'Source answer 1',
            'Source answer 2',
            'Source answer 3',
        ]));
        const repository = new ConversationContentRepository({
            resolveDocument: () => ref,
            readBaseline,
        });
        repository.ingestHostTurn({
            turn: hostTurn(2, 'Rendered answer 2'),
            semanticDigest: 'host-2',
            captureId: 'host-2',
            revision: 1,
            predecessorAssistantMessageId: null,
        });
        const hostReady = repository.ingestHostTurn({
            turn: hostTurn(3, 'Rendered answer 3'),
            semanticDigest: 'host-3',
            captureId: 'host-3',
            revision: 2,
            predecessorAssistantMessageId: 'assistant-2',
        });
        if (hostReady.kind !== 'ready') throw new Error('expected host-ready projection');
        const publishedTokens: string[] = [];
        repository.subscribe((state) => {
            if (state.kind === 'ready') publishedTokens.push(state.snapshot.contentToken);
        });

        const merged = await repository.enterCurrentEpoch();

        expect(merged.kind).toBe('ready');
        if (merged.kind !== 'ready') throw new Error('expected merged projection');
        expect(merged.snapshot.proof).toEqual({ basis: 'hybrid' });
        expect(merged.snapshot.turns.map((turn) => turn.assistantMarkdown)).toEqual([
            'Source answer 1',
            'Rendered answer 2',
            'Rendered answer 3',
        ]);
        expect(merged.snapshot.turns.map((turn) => turn.ordinal)).toEqual([1, 2, 3]);
        expect(merged.snapshot.contentToken).not.toBe(hostReady.snapshot.contentToken);
        expect(new Set(publishedTokens)).toEqual(new Set([
            hostReady.snapshot.contentToken,
            merged.snapshot.contentToken,
        ]));
        expect(readBaseline).toHaveBeenCalledTimes(1);
    });

    it('ignores an unrelated late Graph and keeps the baseline gate open for a later overlap', async () => {
        const ref = document('conversation-late-overlap');
        const unrelatedBase = completeCandidate(ref, ['Unrelated source answer']);
        const unrelated: ConversationContentCandidateV1 = {
            ...unrelatedBase,
            turns: [{
                ...unrelatedBase.turns[0]!,
                identity: {
                    ...unrelatedBase.turns[0]!.identity,
                    assistantMessageId: 'unrelated-assistant',
                },
            }],
        };
        const verified = completeCandidate(ref, ['Source answer 1', 'Source answer 2']);
        const readBaseline = vi.fn()
            .mockResolvedValueOnce(unrelated)
            .mockResolvedValueOnce(verified);
        const repository = new ConversationContentRepository({
            resolveDocument: () => ref,
            readBaseline,
        });
        const hostReady = repository.ingestHostTurn({
            turn: hostTurn(2, 'Rendered answer 2'),
            semanticDigest: 'host-2',
            captureId: 'host-2',
            revision: 1,
            predecessorAssistantMessageId: null,
        });
        if (hostReady.kind !== 'ready') throw new Error('expected host-ready projection');

        const unchanged = await repository.enterCurrentEpoch();
        expect(unchanged.kind).toBe('ready');
        if (unchanged.kind !== 'ready') throw new Error('expected host cache to remain ready');
        expect(unchanged.snapshot.contentToken).toBe(hostReady.snapshot.contentToken);
        expect(unchanged.snapshot.turns.map((turn) => turn.assistantMarkdown)).toEqual(['Rendered answer 2']);

        repository.notifyBaselineCaptured();
        await vi.advanceTimersByTimeAsync(150);

        const merged = repository.read();
        expect(merged.kind).toBe('ready');
        if (merged.kind !== 'ready') throw new Error('expected verified late prefix');
        expect(merged.snapshot.turns.map((turn) => turn.assistantMarkdown)).toEqual([
            'Source answer 1',
            'Rendered answer 2',
        ]);
        expect(readBaseline).toHaveBeenCalledTimes(2);
    });

    it('rejects a late Graph whose overlapping assistant ID has conflicting typed identity', async () => {
        const ref = document('conversation-late-identity-conflict');
        const source = completeCandidate(ref, ['Source answer 1', 'Source answer 2']);
        const conflicting: ConversationContentCandidateV1 = {
            ...source,
            turns: source.turns.map((turn) => turn.identity.assistantMessageId === 'assistant-2'
                ? {
                    ...turn,
                    identity: { ...turn.identity, userMessageId: 'different-user' },
                }
                : turn),
        };
        const repository = new ConversationContentRepository({
            resolveDocument: () => ref,
            readBaseline: async () => conflicting,
        });
        const hostReady = repository.ingestHostTurn({
            turn: hostTurn(2, 'Rendered answer 2'),
            semanticDigest: 'host-2',
            captureId: 'host-2',
            revision: 1,
            predecessorAssistantMessageId: null,
        });
        if (hostReady.kind !== 'ready') throw new Error('expected host-ready projection');

        const unchanged = await repository.enterCurrentEpoch();

        expect(unchanged.kind).toBe('ready');
        if (unchanged.kind !== 'ready') throw new Error('expected host cache to remain ready');
        expect(unchanged.snapshot.contentToken).toBe(hostReady.snapshot.contentToken);
        expect(unchanged.snapshot.turns).toHaveLength(1);
        expect(unchanged.snapshot.proof).toEqual({ basis: 'host' });
    });

    it('publishes one snapshot for an initial stable host batch', () => {
        const ref = document('conversation-host-batch');
        const repository = new ConversationContentRepository({
            resolveDocument: () => ref,
            readBaseline: async () => null,
        });
        const readySnapshots: string[] = [];
        repository.subscribe((state) => {
            if (state.kind === 'ready') readySnapshots.push(state.snapshot.contentToken);
        });

        const ready = repository.ingestHostBatch([
            {
                turn: hostTurn(1, 'Rendered answer 1'),
                semanticDigest: 'host-1',
                captureId: 'host-1',
                revision: 1,
                predecessorAssistantMessageId: null,
            },
            {
                turn: hostTurn(2, 'Rendered answer 2'),
                semanticDigest: 'host-2',
                captureId: 'host-2',
                revision: 1,
                predecessorAssistantMessageId: 'assistant-1',
            },
            {
                turn: hostTurn(3, 'Rendered answer 3'),
                semanticDigest: 'host-3',
                captureId: 'host-3',
                revision: 1,
                predecessorAssistantMessageId: 'assistant-2',
            },
        ]);

        expect(ready.kind).toBe('ready');
        if (ready.kind !== 'ready') throw new Error('expected batched host projection');
        expect(ready.snapshot.turns).toHaveLength(3);
        expect(ready.snapshot.proof).toEqual({ basis: 'host' });
        expect(readySnapshots).toEqual([ready.snapshot.contentToken]);
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

    it('keeps the first obtained host body when a late overlapping baseline differs', async () => {
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
        });

        current = ref;
        const state = await repository.enterCurrentEpoch();

        expect(state.kind).toBe('ready');
        if (state.kind !== 'ready') throw new Error('expected ready state');
        expect(state.snapshot.proof?.basis).toBe('hybrid');
        expect(state.snapshot.turns[0]?.assistantMarkdown).toBe('Divergent rendered answer');
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
        });

        current = ref;
        const state = await repository.enterCurrentEpoch();

        expect(state.kind).toBe('ready');
        if (state.kind !== 'ready') throw new Error('expected ready state');
        expect(state.snapshot.proof?.basis).toBe('hybrid');
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
        });
        const before = repository.ingestHostTurn({
            turn: hostTurn(3, 'Answer 3'),
            semanticDigest: 'host-3',
            captureId: 'host-3',
            revision: 3,
            predecessorAssistantMessageId: 'assistant-2',
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

    it('rejects an invalid atomic page replacement before changing the maintained pool', () => {
        const ref = pageDocument('atomic-page-replacement');
        const repository = new ConversationContentRepository({
            resolveDocument: () => ref,
            readBaseline: async () => null,
        });
        repository.ingestHostTurn({
            turn: hostTurn(1, 'Answer 1'),
            semanticDigest: 'atomic-page-old-1',
            captureId: 'atomic-page-old-1',
            revision: 1,
            predecessorAssistantMessageId: null,
        });
        const before = repository.read();

        const rejected = repository.replaceCurrentPageConversationHostBatch([{
            turn: hostTurn(9, 'Invalid replacement'),
            semanticDigest: 'atomic-page-invalid-9',
            captureId: 'atomic-page-invalid-9',
            revision: 2,
            predecessorAssistantMessageId: 'assistant-missing',
        }]);

        expect(rejected).toBe(before);
        const appended = repository.ingestHostTurn({
            turn: hostTurn(2, 'Answer 2'),
            semanticDigest: 'atomic-page-old-2',
            captureId: 'atomic-page-old-2',
            revision: 3,
            predecessorAssistantMessageId: 'assistant-1',
        });
        expect(appended.snapshot?.turns.map((turn) => turn.identity.assistantMessageId)).toEqual([
            'assistant-1',
            'assistant-2',
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
        });

        expect(conflicted.kind).toBe('ready');
        if (conflicted.kind !== 'ready') throw new Error('expected ready projection');
        expect(conflicted.snapshot.contentToken).toBe(baseline.snapshot.contentToken);
        expect(conflicted.snapshot.turns.map((turn) => turn.identity.assistantMessageId)).toEqual([
            'assistant-1',
            'assistant-2',
        ]);
    });

    it('publishes discovery diagnostics facts: basis, gate, turn and deferred counts', async () => {
        const ref = document('conversation-diagnostics-facts');
        const repository = new ConversationContentRepository({
            resolveDocument: () => ref,
            readBaseline: async () => null,
        });

        expect(repository.readDiagnosticsFacts()).toMatchObject({
            stateKind: 'idle',
            documentKind: null,
            basis: null,
            baselineGate: 'open',
            baselineAttempted: false,
            turnCount: 0,
            deferredHostCount: 0,
            weakSealedCount: 0,
        });

        await repository.enterCurrentEpoch();
        expect(repository.readDiagnosticsFacts()).toMatchObject({
            documentKind: 'canonical',
            baselineGate: 'open',
            baselineAttempted: true,
        });

        const first = repository.ingestHostTurn({
            turn: hostTurn(1, 'Answer 1'),
            semanticDigest: 'diagnostics-host-1',
            captureId: 'diagnostics-host-1',
            revision: 1,
            predecessorAssistantMessageId: null,
        });
        expect(first.kind).toBe('ready');
        // A candidate pointing into an older window is held, not guessed.
        const deferred = repository.ingestHostTurn({
            turn: hostTurn(3, 'Answer 3'),
            semanticDigest: 'diagnostics-host-3',
            captureId: 'diagnostics-host-3',
            revision: 2,
            predecessorAssistantMessageId: 'assistant-2',
        });
        expect(deferred.kind).toBe('ready');

        expect(repository.readDiagnosticsFacts()).toMatchObject({
            stateKind: 'ready',
            basis: 'host',
            turnCount: 1,
            deferredHostCount: 1,
        });
    });

    it('upgrades a weak-sealed host turn when a strong completion observation arrives', async () => {
        const ref = document('conversation-weak-upgrade');
        const repository = new ConversationContentRepository({
            resolveDocument: () => ref,
            readBaseline: async () => null,
        });
        const weak = repository.ingestHostTurn({
            turn: hostTurn(1, 'Partial'),
            semanticDigest: 'weak-upgrade-partial',
            captureId: 'weak-upgrade-partial',
            revision: 1,
            predecessorAssistantMessageId: null,
            completionEvidence: 'bounded-quiet',
        });
        expect(weak.kind).toBe('ready');
        if (weak.kind !== 'ready') throw new Error('expected weak-sealed ready state');
        expect(repository.readDiagnosticsFacts().weakSealedCount).toBe(1);
        const weakToken = weak.snapshot.contentToken;

        const upgraded = repository.ingestHostTurn({
            turn: hostTurn(1, 'Complete answer'),
            semanticDigest: 'weak-upgrade-complete',
            captureId: 'weak-upgrade-complete',
            revision: 2,
            predecessorAssistantMessageId: null,
            completionEvidence: 'strong',
        });
        expect(upgraded.kind).toBe('ready');
        if (upgraded.kind !== 'ready') throw new Error('expected upgraded ready state');
        expect(upgraded.snapshot.turns[0]?.assistantMarkdown).toBe('Complete answer');
        expect(upgraded.snapshot.contentToken).not.toBe(weakToken);
        expect(repository.readDiagnosticsFacts().weakSealedCount).toBe(0);
    });

    it('never lets an equal-evidence DOM copy rewrite a sealed body', async () => {
        const ref = document('conversation-weak-no-downgrade');
        const repository = new ConversationContentRepository({
            resolveDocument: () => ref,
            readBaseline: async () => null,
        });
        const weak = repository.ingestHostTurn({
            turn: hostTurn(1, 'Partial'),
            semanticDigest: 'weak-no-downgrade-partial',
            captureId: 'weak-no-downgrade-partial',
            revision: 1,
            predecessorAssistantMessageId: null,
            completionEvidence: 'bounded-quiet',
        });
        if (weak.kind !== 'ready') throw new Error('expected weak-sealed ready state');
        const weakToken = weak.snapshot.contentToken;

        const rewrapped = repository.ingestHostTurn({
            turn: hostTurn(1, 'Different partial'),
            semanticDigest: 'weak-no-downgrade-other',
            captureId: 'weak-no-downgrade-other',
            revision: 2,
            predecessorAssistantMessageId: null,
            completionEvidence: 'bounded-quiet',
        });
        expect(rewrapped.kind).toBe('ready');
        if (rewrapped.kind !== 'ready') throw new Error('expected ready state');
        expect(rewrapped.snapshot.turns[0]?.assistantMarkdown).toBe('Partial');
        expect(rewrapped.snapshot.contentToken).toBe(weakToken);
        expect(repository.readDiagnosticsFacts().weakSealedCount).toBe(1);
    });

    it('replaces weak-sealed maintained bodies with overlapping Graph bodies during baseline merge', async () => {
        const ref = document('conversation-graph-upgrade');
        const repository = new ConversationContentRepository({
            resolveDocument: () => ref,
            readBaseline: async () => ({
                document: ref,
                coverage: 'complete',
                turns: [
                    { ...hostTurn(0, 'Full answer 0'), key: 'turn-0:assistant-0' },
                    { ...hostTurn(1, 'Full answer 1'), key: 'turn-1:assistant-1' },
                    { ...hostTurn(2, 'Answer 2'), key: 'turn-2:assistant-2' },
                ],
            }),
        });
        // DOM-first pool: turn 1 weak-sealed, turn 2 strong.
        repository.ingestHostTurn({
            turn: hostTurn(1, 'Partial answer 1'),
            semanticDigest: 'graph-upgrade-partial-1',
            captureId: 'graph-upgrade-partial-1',
            revision: 1,
            predecessorAssistantMessageId: null,
            completionEvidence: 'bounded-quiet',
        });
        repository.ingestHostTurn({
            turn: hostTurn(2, 'Answer 2'),
            semanticDigest: 'graph-upgrade-2',
            captureId: 'graph-upgrade-2',
            revision: 2,
            predecessorAssistantMessageId: 'assistant-1',
            completionEvidence: 'strong',
        });
        expect(repository.readDiagnosticsFacts().weakSealedCount).toBe(1);

        const merged = await repository.enterCurrentEpoch();
        expect(merged.kind).toBe('ready');
        if (merged.kind !== 'ready') throw new Error('expected merged ready state');
        expect(merged.snapshot.turns.map((turn) => turn.assistantMarkdown)).toEqual([
            'Full answer 0',
            'Full answer 1',
            'Answer 2',
        ]);
        expect(repository.readDiagnosticsFacts()).toMatchObject({
            basis: 'hybrid',
            weakSealedCount: 0,
            turnCount: 3,
        });
    });

    it('re-arms a failed baseline peek on demand but never a closed gate', async () => {
        const ref = document('conversation-gate-reopen');
        let attempts = 0;
        const readBaseline = vi.fn(async () => {
            attempts += 1;
            return attempts >= 2 ? candidate(ref, 'Answer after retry') : null;
        });
        const repository = new ConversationContentRepository({
            resolveDocument: () => ref,
            readBaseline,
        });

        const first = await repository.enterCurrentEpoch();
        expect(first.kind).toBe('unavailable');
        expect(readBaseline).toHaveBeenCalledTimes(1);

        repository.reopenBaselineGate();
        const second = await repository.enterCurrentEpoch();
        expect(second.kind).toBe('ready');
        expect(readBaseline).toHaveBeenCalledTimes(2);

        // An accepted Graph closes the gate; re-arming is a no-op and the
        // accepted baseline stays authoritative for the epoch.
        repository.reopenBaselineGate();
        const third = await repository.enterCurrentEpoch();
        expect(readBaseline).toHaveBeenCalledTimes(2);
        expect(third.kind).toBe('ready');
    });

    it('tracks historyStatus from unknown to partial to complete', async () => {
        let current: ConversationDocumentRefV1 | null = pageDocument('history-status-page');
        const canonical = document('conversation-history-status');
        let baselineAttempts = 0;
        const repository = new ConversationContentRepository({
            resolveDocument: () => current,
            readBaseline: async () => {
                baselineAttempts += 1;
                return baselineAttempts >= 2
                    ? completeCandidate(canonical, ['Full answer 0', 'Answer 1'])
                    : null;
            },
        });

        const host = repository.ingestHostTurn({
            turn: hostTurn(1, 'Answer 1'),
            semanticDigest: 'history-status-host-1',
            captureId: 'history-status-host-1',
            revision: 1,
            predecessorAssistantMessageId: null,
            completionEvidence: 'strong',
        });
        expect(host.kind).toBe('ready');
        if (host.kind !== 'ready') throw new Error('expected page host pool');
        expect(host.snapshot.historyStatus).toBe('unknown');
        expect(repository.readDiagnosticsFacts().historyStatus).toBe('unknown');
        const pageToken = host.snapshot.contentToken;

        // Identity promotion preserves the content token while the knowledge
        // status narrows to partial: a canonical DOM-only pool with no Graph
        // baseline yet.
        current = canonical;
        const promoted = await repository.enterCurrentEpoch();
        expect(promoted.kind).toBe('ready');
        if (promoted.kind !== 'ready') throw new Error('expected promoted pool');
        expect(promoted.snapshot.historyStatus).toBe('partial');
        expect(promoted.snapshot.contentToken).toBe(pageToken);

        // The accepted Graph baseline proves the whole branch.
        repository.reopenBaselineGate();
        const complete = await repository.enterCurrentEpoch();
        expect(complete.kind).toBe('ready');
        if (complete.kind !== 'ready') throw new Error('expected graph-complete pool');
        expect(complete.snapshot.historyStatus).toBe('complete');
        expect(repository.readDiagnosticsFacts().historyStatus).toBe('complete');
    });

    it('re-evaluates deferred host observations on demand and reports the remaining count', async () => {
        const ref = document('conversation-deferred-reevaluation');
        const repository = new ConversationContentRepository({
            resolveDocument: () => ref,
            readBaseline: async () => null,
        });
        repository.ingestHostTurn({
            turn: hostTurn(1, 'Answer 1'),
            semanticDigest: 'deferred-reevaluation-1',
            captureId: 'deferred-reevaluation-1',
            revision: 1,
            predecessorAssistantMessageId: null,
            completionEvidence: 'strong',
        });
        repository.ingestHostTurn({
            turn: hostTurn(3, 'Answer 3'),
            semanticDigest: 'deferred-reevaluation-3',
            captureId: 'deferred-reevaluation-3',
            revision: 2,
            predecessorAssistantMessageId: 'assistant-2',
            completionEvidence: 'strong',
        });
        expect(repository.readDiagnosticsFacts().deferredHostCount).toBe(1);
        // Without new evidence the re-evaluation changes nothing.
        expect(repository.reevaluateDeferredHost()).toBe(1);

        repository.ingestHostTurn({
            turn: hostTurn(2, 'Answer 2'),
            semanticDigest: 'deferred-reevaluation-2',
            captureId: 'deferred-reevaluation-2',
            revision: 3,
            predecessorAssistantMessageId: 'assistant-1',
            completionEvidence: 'strong',
        });
        expect(repository.read().snapshot?.turns.map((turn) => turn.identity.assistantMessageId)).toEqual([
            'assistant-1',
            'assistant-2',
            'assistant-3',
        ]);
        expect(repository.reevaluateDeferredHost()).toBe(0);
    });
});
