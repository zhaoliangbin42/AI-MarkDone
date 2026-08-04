import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
    ConversationContentAcquisitionError,
    ConversationContentRepository,
    type ConversationContentCandidateV1,
} from '@/services/content/ConversationContentRepository';
import {
    createConversationDocumentKeyV1,
    type ConversationDocumentRefV1,
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

    it('publishes syncing then one immutable ready snapshot and coalesces signals', async () => {
        let current: ConversationDocumentRefV1 | null = document('conversation-1');
        const pending = deferred<ConversationContentCandidateV1 | null>();
        const acquire = vi.fn(() => pending.promise);
        const repository = new ConversationContentRepository({
            resolveDocument: () => current,
            acquire,
        });
        const states: string[] = [];
        repository.subscribe((state) => states.push(state.kind));

        const firstRefresh = repository.refresh();
        const secondRefresh = repository.refresh();
        expect(firstRefresh).toBe(secondRefresh);
        await Promise.resolve();
        expect(acquire).toHaveBeenCalledTimes(1);
        expect(repository.read().kind).toBe('syncing');

        pending.resolve(candidate(current!));
        const ready = await firstRefresh;
        expect(ready.kind).toBe('ready');
        if (ready.kind !== 'ready') throw new Error('expected ready state');
        expect(ready.snapshot.turns[0]?.assistantMarkdown).toBe('Answer');
        expect(repository.isCurrent(ready.snapshot.contentToken)).toBe(true);
        expect(Object.isFrozen(ready.snapshot)).toBe(true);

        repository.scheduleReconcile();
        repository.scheduleReconcile();
        await vi.advanceTimersByTimeAsync(150);
        expect(acquire).toHaveBeenCalledTimes(2);
        expect(states[0]).toBe('idle');
    });

    it('runs one pending reconcile after a signal arrives during an acquisition', async () => {
        const ref = document('conversation-pending');
        const first = deferred<ConversationContentCandidateV1 | null>();
        const acquire = vi.fn()
            .mockImplementationOnce(() => first.promise)
            .mockResolvedValueOnce(candidate(ref, 'Answer 2'));
        const repository = new ConversationContentRepository({
            resolveDocument: () => ref,
            acquire,
        });

        const firstRefresh = repository.refresh();
        await Promise.resolve();
        expect(acquire).toHaveBeenCalledTimes(1);

        repository.scheduleReconcile();
        await vi.advanceTimersByTimeAsync(150);
        expect(acquire).toHaveBeenCalledTimes(1);

        first.resolve(candidate(ref, 'Answer 1'));
        await firstRefresh;
        await Promise.resolve();
        await Promise.resolve();

        expect(acquire).toHaveBeenCalledTimes(2);
        const state = repository.read();
        expect(state.kind).toBe('ready');
        if (state.kind !== 'ready') throw new Error('expected ready state');
        expect(state.snapshot.turns[0]?.assistantMarkdown).toBe('Answer 2');
    });

    it('keeps the last-good snapshot as stale after a same-document timeout', async () => {
        const ref = document('conversation-1');
        let next: ConversationContentCandidateV1 | null = candidate(ref);
        const acquire = vi.fn(async () => {
            if (next) {
                const result = next;
                next = null;
                return result;
            }
            throw new ConversationContentAcquisitionError('source-timeout');
        });
        const repository = new ConversationContentRepository({
            resolveDocument: () => ref,
            acquire,
        });

        await repository.refresh();
        const stale = await repository.refresh();
        expect(stale.kind).toBe('stale');
        if (stale.kind !== 'stale') throw new Error('expected stale state');
        expect(stale.snapshot.turns).toHaveLength(1);
        expect(stale.reason).toBe('source-timeout');
    });

    it('can resume after a page-scoped runtime disable', async () => {
        const ref = document('conversation-resume');
        const acquire = vi.fn(async () => candidate(ref));
        const repository = new ConversationContentRepository({
            resolveDocument: () => ref,
            acquire,
        });

        await repository.refresh();
        repository.dispose();
        expect(await repository.refresh()).toEqual(repository.read());
        expect(acquire).toHaveBeenCalledTimes(1);

        repository.resume();
        await repository.refresh();
        expect(acquire).toHaveBeenCalledTimes(2);
        expect(repository.read().kind).toBe('ready');
    });

    it('does not let a late old-epoch result overwrite a new document', async () => {
        let current: ConversationDocumentRefV1 | null = document('conversation-a');
        const pendingA = deferred<ConversationContentCandidateV1 | null>();
        const pendingB = deferred<ConversationContentCandidateV1 | null>();
        const acquire = vi.fn((ref: ConversationDocumentRefV1) => (
            ref.conversationId === 'conversation-a' ? pendingA.promise : pendingB.promise
        ));
        const repository = new ConversationContentRepository({
            resolveDocument: () => current,
            acquire,
        });

        const old = repository.refresh();
        current = document('conversation-b');
        const next = repository.refresh();
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
            acquire: async () => null,
        });

        const state = await repository.refresh();
        expect(state).toMatchObject({
            kind: 'unavailable',
            reason: 'source-unavailable',
            retryable: true,
        });
        expect(repository.isCurrent('')).toBe(false);
    });

    it('does not change the content token for a coverage-only state change', async () => {
        const ref = document('conversation-coverage');
        let coverage: ConversationContentCandidateV1['coverage'] = 'partial';
        const repository = new ConversationContentRepository({
            resolveDocument: () => ref,
            acquire: async () => ({ ...candidate(ref), coverage }),
        });
        const states: string[] = [];
        repository.subscribe((state) => states.push(
            state.kind === 'ready' ? `ready:${state.snapshot.coverage}` : state.kind,
        ));
        const partial = await repository.refresh();
        coverage = 'complete';
        const complete = await repository.refresh();
        expect(partial.kind).toBe('ready');
        expect(complete.kind).toBe('ready');
        if (partial.kind !== 'ready' || complete.kind !== 'ready') throw new Error('expected ready state');
        expect(complete.snapshot.contentToken).toBe(partial.snapshot.contentToken);
        expect(states).toContain('ready:partial');
        expect(states).toContain('ready:complete');
    });
});
