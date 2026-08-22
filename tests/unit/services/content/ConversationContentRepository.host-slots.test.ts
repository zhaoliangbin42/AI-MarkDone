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
