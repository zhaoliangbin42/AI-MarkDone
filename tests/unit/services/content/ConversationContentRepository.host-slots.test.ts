import { describe, expect, it, vi } from 'vitest';

import {
    createConversationDocumentKeyV1,
    type ConversationDocumentRefV1,
    type ConversationTurnV1,
} from '@/contracts/conversationContent';
import {
    ConversationContentRepository,
    type ConversationHostTurnObservationV1,
} from '@/services/content/ConversationContentRepository';

function documentRef(id: string): ConversationDocumentRefV1 {
    return {
        key: createConversationDocumentKeyV1('chatgpt', id),
        platformId: 'chatgpt',
        conversationId: id,
        canonicalUrl: `https://chatgpt.com/c/${id}`,
    };
}

function turn(index: number, body = `Answer ${index}`): ConversationTurnV1 {
    return {
        key: `turn-${index}:assistant-${index}`,
        ordinal: index,
        identity: {
            turnId: `turn-${index}`,
            userMessageId: `user-${index}`,
            assistantMessageId: `assistant-${index}`,
        },
        userText: `Question ${index}`,
        assistantMarkdown: body,
        assistantProvenance: {
            authority: 'host-rendered',
            fidelity: 'normalized',
            producer: 'rendered-content-v2',
        },
    };
}

function observation(index: number, hostSlotId = `assistant-slot-${index}`): ConversationHostTurnObservationV1 {
    return { turn: turn(index), hostSlotId };
}

function ids(repository: ConversationContentRepository): string[] {
    return repository.read().snapshot?.turns.map((item) => item.identity.assistantMessageId) ?? [];
}

describe('ConversationContentRepository persistent host slots', () => {
    it('keeps completed bodies from disjoint history windows using a batch placement hint', () => {
        const repository = new ConversationContentRepository({ resolveDocument: () => documentRef('disjoint-placement') });
        repository.ingestHostBatch([4, 5, 6].map(index => observation(index)));
        const first = repository.admitHostBatch([1, 2].map(index => observation(index)), ['assistant-slot-1', 'assistant-slot-2'], [], 'before');
        expect(first.admittedAssistantMessageIds).toEqual(['assistant-1', 'assistant-2']);
        expect(ids(repository)).toEqual(['assistant-1', 'assistant-2', 'assistant-4', 'assistant-5', 'assistant-6']);
        repository.admitHostBatch([2, 3].map(index => observation(index)), ['assistant-slot-2', 'assistant-slot-3'], [], 'before');
        repository.admitHostBatch([3, 4].map(index => observation(index)), ['assistant-slot-3', 'assistant-slot-4'], [], 'before');
        expect(ids(repository)).toEqual(Array.from({ length: 6 }, (_, index) => `assistant-${index + 1}`));
    });

    it('corrects a tentative disjoint placement when the real host window supplies shared message order', () => {
        const repository = new ConversationContentRepository({ resolveDocument: () => documentRef('placement-correction') });
        repository.ingestHostBatch([4, 5, 6].map(index => observation(index)));
        repository.admitHostBatch([observation(7)], ['assistant-slot-7'], [], 'before');
        expect(ids(repository)).toEqual(['assistant-7', 'assistant-4', 'assistant-5', 'assistant-6']);
        const corrected = repository.admitHostBatch([observation(6), observation(7)], ['assistant-slot-6', 'assistant-slot-7'], [], 'after');
        expect(corrected.rejectionReason).toBeNull();
        expect(ids(repository)).toEqual(['assistant-4', 'assistant-5', 'assistant-6', 'assistant-7']);
        const before = repository.read().snapshot;
        const wrongPair = { ...observation(7), turn: { ...turn(7), identity: { ...turn(7).identity, userMessageId: 'wrong-user' } } };
        expect(repository.admitHostBatch([wrongPair], ['assistant-slot-7'], [], 'after').rejectionReason).toBe('identity-conflict');
        expect(repository.read().snapshot).toBe(before);
    });

    it('merges successive rolling windows without removing obtained history', () => {
        const repository = new ConversationContentRepository({ resolveDocument: () => documentRef('rolling') });
        for (const window of [[4, 5, 6], [2, 3, 4], [1, 2], [6, 7]]) {
            repository.ingestHostBatch(window.map(index => observation(index)), window.map(index => `assistant-slot-${index}`));
        }
        expect(ids(repository)).toEqual(Array.from({ length: 7 }, (_, i) => `assistant-${i + 1}`));
        expect(repository.read().snapshot?.turns.map(turn => turn.ordinal)).toEqual([1, 2, 3, 4, 5, 6, 7]);
        expect(repository.read().snapshot?.historyStatus).toBe('partial');
    });

    it('inserts a newly proved interior slot without using a DOM-local ordinal', () => {
        const repository = new ConversationContentRepository({ resolveDocument: () => documentRef('interior') });
        repository.ingestHostBatch([observation(1), observation(3)]);
        repository.ingestHostBatch([observation(2)], ['assistant-slot-1', 'assistant-slot-2', 'assistant-slot-3']);
        expect(ids(repository)).toEqual(['assistant-1', 'assistant-2', 'assistant-3']);
    });

    it('keeps obtained order and inserts an overlapping new range before its next shared anchor', () => {
        const repository = new ConversationContentRepository({ resolveDocument: () => documentRef('ambiguous') });
        repository.ingestHostBatch([observation(1), observation(2), observation(4)]);
        repository.ingestHostBatch([{ ...observation(1), turn: turn(1, 'Updated answer') }, observation(3)], ['assistant-slot-1', 'assistant-slot-3', 'assistant-slot-4']);
        expect(ids(repository)).toEqual(['assistant-1', 'assistant-2', 'assistant-3', 'assistant-4']);
        expect(repository.read().snapshot?.turns[0]?.assistantMarkdown).toBe('Updated answer');
    });

    it('acknowledges idempotent admission separately from snapshot publication', () => {
        const repository = new ConversationContentRepository({ resolveDocument: () => documentRef('receipt') });
        const item = observation(1);
        const first = repository.admitHostBatch([item]);
        const snapshot = first.state.snapshot;
        const second = repository.admitHostBatch([item]);
        const aliasOnly = repository.admitHostBatch([{ ...item, turn: { ...item.turn, key: 'different-uncommitted-key' } }]);
        expect(first.admittedAssistantMessageIds).toEqual(['assistant-1']);
        expect(second.admittedAssistantMessageIds).toEqual(['assistant-1']);
        expect(second.rejectionReason).toBeNull();
        expect(second.state.snapshot).toBe(snapshot);
        expect(aliasOnly.admittedAssistantMessageIds).toEqual(['assistant-1']);
        expect(aliasOnly.state.snapshot).toBe(snapshot);
        const conflict = repository.admitHostBatch([{ ...item, hostSlotId: 'other-slot' }], ['assistant-slot-1', 'other-slot']);
        expect(conflict.rejectionReason).toBe('identity-conflict');
        expect(conflict.admittedAssistantMessageIds).toEqual([]);
        expect(repository.read().snapshot).toBe(snapshot);
    });

    it.each(['turnId', 'userMessageId'] as const)('refuses duplicate %s before poisoning private or published content', (field) => {
        const repository = new ConversationContentRepository({ resolveDocument: () => documentRef(`invalid-${field}`) });
        repository.ingestHostBatch([observation(1)]);
        const before = repository.read().snapshot;
        const incoming = observation(2);
        const invalid = { ...incoming, turn: { ...incoming.turn, identity: { ...incoming.turn.identity, [field]: turn(1).identity[field] } } };
        const refused = repository.admitHostBatch([invalid], ['assistant-slot-1', 'assistant-slot-2']);
        expect(refused.admittedAssistantMessageIds).toEqual([]);
        expect(refused.rejectionReason).toBe('identity-conflict');
        expect(repository.read().snapshot).toBe(before);
        expect(repository.readDiagnosticsFacts().turnCount).toBe(1);
        repository.ingestHostBatch([observation(2)], ['assistant-slot-1', 'assistant-slot-2']);
        expect(ids(repository)).toEqual(['assistant-1', 'assistant-2']);
    });

    it('learns a changed owner alias only from the same exact assistant and compatible pair', () => {
        const repository = new ConversationContentRepository({ resolveDocument: () => documentRef('owner-alias') });
        repository.ingestHostBatch([observation(1, 'user-1'), observation(2)]);
        const initial = repository.read().snapshot;
        const promoted = repository.admitHostBatch([{ ...observation(1, 'opaque-owner'), turn: { ...turn(1), identity: { ...turn(1).identity, turnId: 'renamed-turn' } } }], ['opaque-owner', 'assistant-slot-2']);
        expect(promoted.rejectionReason).toBeNull();
        expect(promoted.state.snapshot).toBe(initial);
        repository.ingestHostBatch([observation(3)], ['opaque-owner', 'assistant-slot-2', 'assistant-slot-3']);
        expect(ids(repository)).toEqual(['assistant-1', 'assistant-2', 'assistant-3']);
        const beforeConflict = repository.read().snapshot;
        const incompatible = { ...observation(1, 'untrusted-owner'), turn: { ...turn(1), identity: { ...turn(1).identity, userMessageId: 'other-user' } } };
        expect(repository.admitHostBatch([incompatible], ['untrusted-owner', 'assistant-slot-2', 'assistant-slot-3']).rejectionReason).toBe('identity-conflict');
        expect(repository.read().snapshot).toBe(beforeConflict);
        expect(repository.admitHostBatch([observation(4, 'opaque-owner')], ['opaque-owner', 'assistant-slot-2', 'assistant-slot-3']).rejectionReason).toBe('identity-conflict');
    });

    it('fills a missing prompt while preserving the obtained assistant entity through owner changes', () => {
        const repository = new ConversationContentRepository({ resolveDocument: () => documentRef('prompt-alias') });
        const assistantOnly = { ...turn(1), identity: { ...turn(1).identity, userMessageId: null }, userText: '' };
        repository.ingestHostBatch([{ turn: assistantOnly, hostSlotId: 'assistant-1' }]);
        const incoming = { ...turn(1), identity: { ...turn(1).identity, turnId: 'new-paired-turn' } };
        expect(repository.admitHostBatch([{ turn: incoming, hostSlotId: 'new-owner' }]).rejectionReason).toBeNull();
        expect(repository.read().snapshot?.turns[0]).toMatchObject({ identity: turn(1).identity, userText: 'Question 1' });
        const token = repository.read().snapshot?.contentToken;
        repository.ingestHostBatch([{ turn: assistantOnly, hostSlotId: 'assistant-1' }]);
        expect(repository.read().snapshot?.contentToken).toBe(token);
    });

    it('does not erase a contradictory retained position when learning an owner alias', () => {
        const repository = new ConversationContentRepository({ resolveDocument: () => documentRef('alias-cycle') });
        repository.ingestHostBatch([observation(1, 'first'), observation(2, 'middle')], ['first', 'middle', 'renamed']);
        const before = repository.read().snapshot;
        expect(repository.admitHostBatch([observation(1, 'renamed')], ['renamed']).rejectionReason).toBe('order-unproven');
        expect(repository.read().snapshot).toBe(before);
        expect(repository.admitHostBatch([observation(3, 'renamed')], ['first', 'middle', 'renamed']).rejectionReason).toBeNull();
        expect(ids(repository)).toEqual(['assistant-1', 'assistant-2', 'assistant-3']);
    });

    it('proves owner continuity from exact topology identity before the body is eligible', () => {
        const repository = new ConversationContentRepository({ resolveDocument: () => documentRef('identity-before-body') });
        repository.admitHostBatch([observation(4), observation(5)], ['provisional-3', 'assistant-slot-4', 'assistant-slot-5'], [
            { hostSlotId: 'provisional-3', assistantMessageId: 'assistant-3', userMessageId: null },
        ]);
        expect(ids(repository)).toEqual(['assistant-4', 'assistant-5']);
        const promoted = repository.admitHostBatch([observation(2), observation(3), observation(4)], ['assistant-slot-2', 'assistant-slot-3', 'assistant-slot-4'], [
            { hostSlotId: 'assistant-slot-3', assistantMessageId: 'assistant-3', userMessageId: 'user-3' },
        ]);
        expect(promoted.rejectionReason).toBeNull();
        expect(ids(repository)).toEqual(['assistant-2', 'assistant-3', 'assistant-4', 'assistant-5']);
    });

    it('rejects topology-only identity conflicts atomically without acknowledging a body', () => {
        const repository = new ConversationContentRepository({ resolveDocument: () => documentRef('topology-conflict') });
        const proof = { hostSlotId: 'first', assistantMessageId: 'assistant-1', userMessageId: 'user-1' };
        const initial = repository.admitHostBatch([], ['first', 'middle', 'renamed'], [proof]);
        expect(initial.rejectionReason).toBeNull();
        expect(initial.admittedAssistantMessageIds).toEqual([]);
        expect(initial.state.snapshot).toBeNull();
        expect(repository.admitHostBatch([], ['first', 'renamed'], [{ ...proof, hostSlotId: 'renamed' }]).rejectionReason).toBe('identity-conflict');
        expect(repository.admitHostBatch([], ['renamed'], [{ ...proof, hostSlotId: 'renamed', userMessageId: 'different-user' }]).rejectionReason).toBe('identity-conflict');
        expect(repository.admitHostBatch([], ['renamed'], [{ ...proof, hostSlotId: 'renamed' }]).rejectionReason).toBe('order-unproven');
        const recovered = repository.admitHostBatch([observation(2, 'renamed')], ['first', 'middle', 'renamed']);
        expect(recovered.rejectionReason).toBeNull();
        expect(ids(repository)).toEqual(['assistant-2']);
    });
    it('keeps an initial ten-slot window as the exact suffix of a direct 62-slot expansion', () => {
        const repository = new ConversationContentRepository({ resolveDocument: () => documentRef('direct-jump') });
        const finalSlots = Array.from({ length: 62 }, (_, index) => `slot-${index + 1}`);
        const initialSlots = finalSlots.slice(-10);

        repository.ingestHostBatch([
            observation(53, 'slot-53'),
            observation(62, 'slot-62'),
        ], initialSlots);
        repository.ingestHostBatch([
            observation(1, 'slot-1'),
            observation(20, 'slot-20'),
        ], finalSlots);

        expect(ids(repository)).toEqual([
            'assistant-1',
            'assistant-20',
            'assistant-53',
            'assistant-62',
        ]);
        expect(repository.read().snapshot?.turns.map((item) => item.ordinal)).toEqual([1, 2, 3, 4]);
    });

    it('accepts whole-sequence prefix, tail, and simultaneous extension', () => {
        const repository = new ConversationContentRepository({ resolveDocument: () => documentRef('extensions') });

        repository.ingestHostBatch([observation(3), observation(4)], ['assistant-slot-3', 'assistant-slot-4']);
        repository.ingestHostBatch([observation(2)], ['assistant-slot-2', 'assistant-slot-3', 'assistant-slot-4']);
        repository.ingestHostBatch([observation(5)], ['assistant-slot-2', 'assistant-slot-3', 'assistant-slot-4', 'assistant-slot-5']);
        repository.ingestHostBatch(
            [observation(1), observation(6)],
            ['assistant-slot-1', 'assistant-slot-2', 'assistant-slot-3', 'assistant-slot-4', 'assistant-slot-5', 'assistant-slot-6'],
        );

        expect(ids(repository)).toEqual([
            'assistant-1',
            'assistant-2',
            'assistant-3',
            'assistant-4',
            'assistant-5',
            'assistant-6',
        ]);
    });

    it('does not publish or churn the token when only empty slots are discovered', () => {
        const repository = new ConversationContentRepository({ resolveDocument: () => documentRef('empty-slots') });
        const listener = vi.fn();
        repository.subscribe(listener);
        repository.ingestHostBatch([observation(3)], ['assistant-slot-3']);
        const token = repository.read().snapshot?.contentToken;
        const publicationCount = listener.mock.calls.length;

        repository.ingestHostBatch([], ['assistant-slot-1', 'assistant-slot-2', 'assistant-slot-3']);

        expect(repository.read().snapshot?.contentToken).toBe(token);
        expect(listener).toHaveBeenCalledTimes(publicationCount);
    });

    it('fills a historical empty slot in place instead of appending it', () => {
        const repository = new ConversationContentRepository({ resolveDocument: () => documentRef('late-hydration') });
        const slots = ['assistant-slot-1', 'assistant-slot-2', 'assistant-slot-3'];
        repository.ingestHostBatch([observation(2), observation(3)], slots);

        repository.ingestHostBatch([observation(1)], slots);

        expect(ids(repository)).toEqual(['assistant-1', 'assistant-2', 'assistant-3']);
    });

    it('keeps sparse topology order while bodies arrive out of order', () => {
        const repository = new ConversationContentRepository({ resolveDocument: () => documentRef('sparse-hydration') });
        const slots = [
            'assistant-slot-1',
            'assistant-slot-2',
            'assistant-slot-3',
            'assistant-slot-4',
            'assistant-slot-5',
            'assistant-slot-6',
        ];

        repository.ingestHostBatch([observation(1), observation(6)], slots);
        repository.ingestHostBatch([observation(4), observation(2)], slots);
        repository.ingestHostBatch([observation(5), observation(3)], slots);

        expect(ids(repository)).toEqual([
            'assistant-1',
            'assistant-2',
            'assistant-3',
            'assistant-4',
            'assistant-5',
            'assistant-6',
        ]);
    });

    it('retains the larger topology for a mounted subwindow and rejects conflicting order', () => {
        const repository = new ConversationContentRepository({ resolveDocument: () => documentRef('subwindow') });
        const full = ['assistant-slot-1', 'assistant-slot-2', 'assistant-slot-3', 'assistant-slot-4'];
        repository.ingestHostBatch([observation(1), observation(2), observation(3), observation(4)], full);
        const stableToken = repository.read().snapshot?.contentToken;

        repository.ingestHostBatch([], ['assistant-slot-2', 'assistant-slot-3']);
        repository.ingestHostBatch([], ['assistant-slot-1', 'assistant-slot-3', 'assistant-slot-2', 'assistant-slot-4']);

        expect(ids(repository)).toEqual(['assistant-1', 'assistant-2', 'assistant-3', 'assistant-4']);
        expect(repository.read().snapshot?.contentToken).toBe(stableToken);
    });

    it('rejects conflicting assistant-to-slot bindings without changing the snapshot', () => {
        const repository = new ConversationContentRepository({ resolveDocument: () => documentRef('binding-conflict') });
        repository.ingestHostBatch([observation(1)], ['assistant-slot-1', 'assistant-slot-2']);
        const stableToken = repository.read().snapshot?.contentToken;

        repository.ingestHostBatch([observation(2, 'assistant-slot-1')], ['assistant-slot-1', 'assistant-slot-2']);
        repository.ingestHostBatch([observation(1, 'assistant-slot-2')], ['assistant-slot-1', 'assistant-slot-2']);

        expect(ids(repository)).toEqual(['assistant-1']);
        expect(repository.read().snapshot?.contentToken).toBe(stableToken);
    });
});
