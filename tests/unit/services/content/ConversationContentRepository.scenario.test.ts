import { describe, expect, it, vi } from 'vitest';

import {
    createConversationDocumentKeyV1,
    createConversationPageDocumentKeyV1,
    type ConversationDocumentRefV1,
    type ConversationTurnV1,
} from '@/contracts/conversationContent';
import {
    ConversationContentRepository,
    type ConversationHostTurnObservationV1,
} from '@/services/content/ConversationContentRepository';

function documentRef(conversationId: string): ConversationDocumentRefV1 {
    return {
        key: createConversationDocumentKeyV1('chatgpt', conversationId),
        platformId: 'chatgpt',
        conversationId,
        canonicalUrl: `https://chatgpt.com/c/${conversationId}`,
    };
}

function pageRef(epoch: string): ConversationDocumentRefV1 {
    return {
        key: createConversationPageDocumentKeyV1('chatgpt', epoch),
        platformId: 'chatgpt',
        identityKind: 'page',
        conversationId: null,
        canonicalUrl: 'https://chatgpt.com/',
    };
}

function turn(index: number, assistantMarkdown: string, userText = `Question ${index}`): ConversationTurnV1 {
    return {
        key: `turn-${index}:assistant-${index}`,
        ordinal: index,
        identity: {
            turnId: `turn-${index}`,
            userMessageId: `user-${index}`,
            assistantMessageId: `assistant-${index}`,
        },
        userText,
        assistantMarkdown,
        assistantProvenance: {
            authority: 'host-rendered',
            fidelity: 'normalized',
            producer: 'rendered-content-v2',
        },
    };
}

function observation(
    item: ConversationTurnV1,
    _predecessorAssistantMessageId: string | null,
    revision = item.ordinal,
    origin: 'full-discovery' | 'dom-fallback' = 'dom-fallback',
): ConversationHostTurnObservationV1 {
    return {
        turn: item,
        hostSlotId: item.identity.assistantMessageId,
        origin,
    };
}

describe('ConversationContentRepository DOM pool', () => {
    it('stays idle when no page document is bound', async () => {
        const repository = new ConversationContentRepository({ resolveDocument: () => null });

        expect(await repository.refresh()).toEqual({
            kind: 'idle',
            document: null,
            snapshot: null,
        });
    });

    it('accepts the first completed DOM message with a missing user prompt', () => {
        const ref = documentRef('first-message');
        const repository = new ConversationContentRepository({ resolveDocument: () => ref });
        const assistantOnly = {
            ...turn(1, 'First answer', ''),
            identity: {
                turnId: 'turn-1',
                userMessageId: null,
                assistantMessageId: 'assistant-1',
            },
        };

        const state = repository.ingestHostTurn(observation(assistantOnly, null));

        expect(state.kind).toBe('ready');
        if (state.kind !== 'ready') throw new Error('expected ready DOM pool');
        expect(state.snapshot.historyStatus).toBe('partial');
        expect(state.snapshot.turns[0]).toMatchObject({
            userText: '',
            assistantMarkdown: 'First answer',
            identity: { userMessageId: null },
        });
    });

    it('publishes a status-only transition when full discovery proves the expected turn count', () => {
        const ref = documentRef('full-history-status');
        const repository = new ConversationContentRepository({ resolveDocument: () => ref });
        const listener = vi.fn();
        repository.subscribe(listener);

        repository.ingestHostBatch(
            [
                observation(turn(1, 'Answer 1'), null, 1, 'full-discovery'),
                observation(turn(2, 'Answer 2'), 'assistant-1', 2, 'full-discovery'),
            ],
            ['assistant-1', 'assistant-2'],
        );
        const partialToken = repository.read().snapshot?.contentToken;
        const publicationCount = listener.mock.calls.length;

        repository.setFullDiscoveryExpectedTurnCount(2);
        expect(repository.markFullDiscoveryComplete()).toBe(true);

        expect(repository.read().snapshot?.historyStatus).toBe('complete');
        expect(repository.read().snapshot?.contentToken).not.toBe(partialToken);
        expect(listener.mock.calls.length).toBeGreaterThan(publicationCount);
    });

    it('lets DOM correction replace full-discovery content without reordering the pool', () => {
        const ref = documentRef('full-history-dom-correction');
        const repository = new ConversationContentRepository({ resolveDocument: () => ref });
        const fullTurn = turn(1, 'Source body');
        const domTurn = {
            ...turn(1, 'DOM body'),
            assistantProvenance: {
                authority: 'host-rendered' as const,
                fidelity: 'normalized' as const,
                producer: 'chatgpt-dom-fallback',
            },
        };

        repository.ingestHostBatch([observation(fullTurn, null, 1, 'full-discovery')], ['assistant-1']);
        repository.setFullDiscoveryExpectedTurnCount(1);
        expect(repository.markFullDiscoveryComplete()).toBe(true);

        repository.ingestHostBatch([observation(domTurn, null, 1, 'dom-fallback')], ['assistant-1']);

        expect(repository.read().snapshot?.historyStatus).toBe('complete');
        expect(repository.read().snapshot?.turns.map((item) => item.assistantMarkdown)).toEqual(['DOM body']);
        expect(repository.read().snapshot?.turns[0]?.assistantProvenance?.producer).toBe('chatgpt-dom-fallback');
    });

    it('downgrades a complete pool when a new message slot appears', () => {
        const ref = documentRef('full-history-new-message');
        const repository = new ConversationContentRepository({ resolveDocument: () => ref });

        repository.ingestHostBatch([observation(turn(1, 'Answer 1'), null, 1, 'full-discovery')], ['assistant-1']);
        repository.setFullDiscoveryExpectedTurnCount(1);
        expect(repository.markFullDiscoveryComplete()).toBe(true);

        repository.ingestHostBatch(
            [observation(turn(2, 'Answer 2'), 'assistant-1', 2, 'dom-fallback')],
            ['assistant-1', 'assistant-2'],
        );

        expect(repository.read().snapshot?.historyStatus).toBe('partial');
        expect(repository.read().snapshot?.turns.map((item) => item.identity.assistantMessageId)).toEqual([
            'assistant-1',
            'assistant-2',
        ]);
    });

    it('appends new DOM messages without dropping earlier loaded content', () => {
        const ref = documentRef('append');
        const repository = new ConversationContentRepository({ resolveDocument: () => ref });

        repository.ingestHostTurn(observation(turn(1, 'Answer 1'), null, 1));
        repository.ingestHostBatch(
            [observation(turn(2, 'Answer 2'), 'assistant-1', 2)],
            ['assistant-1', 'assistant-2'],
        );

        expect(repository.read().snapshot?.turns.map((item) => item.assistantMarkdown)).toEqual([
            'Answer 1',
            'Answer 2',
        ]);
    });

    it('merges a newly mounted historical prefix around stable assistant IDs', () => {
        const ref = documentRef('historical-prefix');
        const repository = new ConversationContentRepository({ resolveDocument: () => ref });

        repository.ingestHostBatch([
            observation(turn(3, 'Answer 3'), null),
            observation(turn(4, 'Answer 4'), 'assistant-3'),
        ]);
        repository.ingestHostBatch([
            observation(turn(1, 'Answer 1'), null),
            observation(turn(2, 'Answer 2'), 'assistant-1'),
            observation(turn(3, 'Answer 3'), 'assistant-2'),
            observation(turn(4, 'Answer 4'), 'assistant-3'),
        ]);

        expect(repository.read().snapshot?.turns.map((item) => item.identity.assistantMessageId)).toEqual([
            'assistant-1',
            'assistant-2',
            'assistant-3',
            'assistant-4',
        ]);
        expect(repository.read().snapshot?.turns.map((item) => item.ordinal)).toEqual([1, 2, 3, 4]);
    });

    it('merges authoritative prefix and tail extensions without reordering accepted IDs', () => {
        const ref = documentRef('prefix-tail');
        const repository = new ConversationContentRepository({ resolveDocument: () => ref });

        repository.ingestHostBatch([
            observation(turn(3, 'Answer 3'), null),
            observation(turn(4, 'Answer 4'), 'assistant-3'),
        ]);
        repository.ingestHostBatch([
            observation(turn(1, 'Answer 1'), null),
            observation(turn(2, 'Answer 2'), 'assistant-1'),
        ], ['assistant-1', 'assistant-2', 'assistant-3', 'assistant-4']);
        repository.ingestHostBatch([
            observation(turn(5, 'Answer 5'), 'assistant-4'),
            observation(turn(6, 'Answer 6'), 'assistant-5'),
        ], ['assistant-1', 'assistant-2', 'assistant-3', 'assistant-4', 'assistant-5', 'assistant-6']);

        expect(repository.read().snapshot?.turns.map((item) => item.identity.assistantMessageId)).toEqual([
            'assistant-1',
            'assistant-2',
            'assistant-3',
            'assistant-4',
            'assistant-5',
            'assistant-6',
        ]);
    });

    it('does not let an unrelated host-slot sequence rewrite established order', () => {
        const ref = documentRef('disconnected-window');
        const repository = new ConversationContentRepository({ resolveDocument: () => ref });
        repository.ingestHostBatch([
            observation(turn(1, 'Answer 1'), null),
            observation(turn(2, 'Answer 2'), 'assistant-1'),
        ]);
        const stableToken = repository.read().snapshot?.contentToken;

        repository.ingestHostBatch([
            observation(turn(7, 'Answer 7'), null),
            observation(turn(8, 'Answer 8'), 'assistant-7'),
        ], ['assistant-7', 'assistant-8']);

        expect(repository.read().snapshot?.turns.map((item) => item.identity.assistantMessageId)).toEqual([
            'assistant-1',
            'assistant-2',
        ]);
        expect(repository.read().snapshot?.contentToken).toBe(stableToken);

        expect(repository.read().snapshot?.turns.map((item) => item.identity.assistantMessageId)).toEqual([
            'assistant-1',
            'assistant-2',
        ]);
        expect(repository.read().snapshot?.contentToken).toBe(stableToken);
    });

    it('ignores a mounted sequence that reverses accepted stable IDs', () => {
        const ref = documentRef('order-conflict');
        const repository = new ConversationContentRepository({ resolveDocument: () => ref });
        repository.ingestHostBatch([
            observation(turn(1, 'Answer 1'), null),
            observation(turn(2, 'Answer 2'), 'assistant-1'),
            observation(turn(3, 'Answer 3'), 'assistant-2'),
        ]);
        const stableToken = repository.read().snapshot?.contentToken;

        repository.ingestHostBatch([], ['assistant-2', 'assistant-1', 'assistant-3']);

        expect(repository.read().snapshot?.turns.map((item) => item.identity.assistantMessageId)).toEqual([
            'assistant-1',
            'assistant-2',
            'assistant-3',
        ]);
        expect(repository.read().snapshot?.contentToken).toBe(stableToken);
    });

    it('rejects the whole batch when an identity binding conflicts', () => {
        const ref = documentRef('identity-conflict');
        const repository = new ConversationContentRepository({ resolveDocument: () => ref });
        repository.ingestHostBatch([
            observation(turn(1, 'Answer 1'), null),
            observation(turn(2, 'Answer 2'), 'assistant-1'),
        ]);
        const stableToken = repository.read().snapshot?.contentToken;

        repository.ingestHostBatch([
            observation(turn(1, 'Changed but conflicted'), null),
            { turn: turn(2, 'Wrong slot'), hostSlotId: 'assistant-1', origin: 'dom-fallback' },
        ]);

        expect(repository.read().snapshot?.turns.map((item) => item.assistantMarkdown)).toEqual([
            'Answer 1',
            'Answer 2',
        ]);
        expect(repository.read().snapshot?.contentToken).toBe(stableToken);
    });

    it('rejects body updates from an incompatible slot sequence as one batch', () => {
        const ref = documentRef('order-conflict-body');
        const repository = new ConversationContentRepository({ resolveDocument: () => ref });
        repository.ingestHostBatch([
            observation(turn(1, 'Answer 1'), null),
            observation(turn(2, 'Answer 2'), 'assistant-1'),
            observation(turn(3, 'Answer 3'), 'assistant-2'),
        ]);
        const stableToken = repository.read().snapshot?.contentToken;

        repository.ingestHostBatch([
            observation(turn(1, 'Changed but reordered'), null),
            observation(turn(3, 'Changed but reordered'), 'assistant-1'),
        ], ['assistant-1', 'assistant-3', 'assistant-2']);

        expect(repository.read().snapshot?.turns.map((item) => item.assistantMarkdown)).toEqual([
            'Answer 1',
            'Answer 2',
            'Answer 3',
        ]);
        expect(repository.read().snapshot?.contentToken).toBe(stableToken);
    });

    it('does not remove cached content when its DOM is virtualized away', async () => {
        const ref = documentRef('virtualized');
        const repository = new ConversationContentRepository({ resolveDocument: () => ref });
        repository.ingestHostBatch([
            observation(turn(1, 'Answer 1'), null, 1),
            observation(turn(2, 'Answer 2'), 'assistant-1', 2),
        ]);
        const token = repository.read().snapshot?.contentToken;

        await repository.refresh();

        expect(repository.read().snapshot?.turns).toHaveLength(2);
        expect(repository.read().snapshot?.contentToken).toBe(token);
    });

    it('replaces the cached body when the same assistant DOM changes', () => {
        const ref = documentRef('dom-update');
        const repository = new ConversationContentRepository({ resolveDocument: () => ref });
        const first = repository.ingestHostTurn(observation(turn(1, 'First answer'), null, 1));
        if (first.kind !== 'ready') throw new Error('expected first DOM projection');

        const updated = repository.ingestHostTurn(observation(turn(1, 'Updated answer'), null, 2));

        expect(updated.kind).toBe('ready');
        if (updated.kind !== 'ready') throw new Error('expected updated DOM projection');
        expect(updated.snapshot.turns[0]?.assistantMarkdown).toBe('Updated answer');
        expect(updated.snapshot.contentToken).not.toBe(first.snapshot.contentToken);
    });

    it('does not publish or churn the token for identical DOM content', () => {
        const ref = documentRef('duplicate');
        const repository = new ConversationContentRepository({ resolveDocument: () => ref });
        const listener = vi.fn();
        repository.subscribe(listener);
        const first = repository.ingestHostTurn(observation(turn(1, 'Answer'), null, 1));
        if (first.kind !== 'ready') throw new Error('expected first DOM projection');
        const publicationCount = listener.mock.calls.length;

        const duplicate = repository.ingestHostTurn(observation(turn(1, 'Answer'), null, 2));

        expect(duplicate.snapshot?.contentToken).toBe(first.snapshot.contentToken);
        expect(listener).toHaveBeenCalledTimes(publicationCount);
    });

    it('restores each tab-local conversation pool across SPA navigation', () => {
        const conversationA = documentRef('pool-a');
        const conversationB = documentRef('pool-b');
        let current = conversationA;
        const repository = new ConversationContentRepository({ resolveDocument: () => current });

        repository.ingestHostTurn(observation(turn(1, 'Answer from A'), null, 1));
        current = conversationB;
        repository.bindCurrentDocument();
        repository.ingestHostTurn(observation(turn(2, 'Answer from B'), null, 2));
        current = conversationA;
        repository.bindCurrentDocument();

        expect(repository.read().document?.key).toBe(conversationA.key);
        expect(repository.read().snapshot?.turns.map((item) => item.assistantMarkdown)).toEqual([
            'Answer from A',
        ]);
    });

    it('promotes a page pool to its canonical route without token churn', () => {
        const page = pageRef('promotion');
        const canonical = documentRef('promotion-canonical');
        let current: ConversationDocumentRefV1 = page;
        const repository = new ConversationContentRepository({ resolveDocument: () => current });
        const pageState = repository.ingestHostTurn(observation(turn(1, 'Answer'), null, 1));
        if (pageState.kind !== 'ready') throw new Error('expected page pool');

        current = canonical;
        repository.bindCurrentDocument();

        expect(repository.read().document?.key).toBe(canonical.key);
        expect(repository.read().snapshot?.contentToken).toBe(pageState.snapshot.contentToken);
        expect(repository.readTurn({
            documentKey: page.key,
            turnId: 'turn-1',
            userMessageId: 'user-1',
            assistantMessageId: 'assistant-1',
        }).kind).toBe('ready');
    });

    it('clears every in-memory pool on dispose', () => {
        const ref = documentRef('dispose');
        const repository = new ConversationContentRepository({ resolveDocument: () => ref });
        repository.ingestHostTurn(observation(turn(1, 'Answer'), null, 1));

        repository.dispose();
        repository.ingestHostTurn(observation(turn(2, 'Late answer'), 'assistant-1', 2));

        expect(repository.read().snapshot?.turns).toHaveLength(1);
    });
});
