import { describe, expect, it } from 'vitest';

import {
    ConversationEvidenceLedger,
    type ConversationEvidenceEventV1,
} from '@/services/content/ConversationEvidenceLedger';
import {
    createConversationDocumentKeyV1,
    type ConversationDocumentRefV1,
    type ConversationTurnV1,
} from '@/contracts/conversationContent';
import type { ConversationTargetV1 } from '@/contracts/conversationMaterialization';

function document(conversationId = 'ledger-conversation'): ConversationDocumentRefV1 {
    return {
        key: createConversationDocumentKeyV1('chatgpt', conversationId),
        platformId: 'chatgpt',
        conversationId,
        canonicalUrl: `https://chatgpt.com/c/${conversationId}`,
    };
}

function turn(index: number, answer = `Answer ${index}`): ConversationTurnV1 {
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
    };
}

function source(
    ref: ConversationDocumentRefV1,
    epoch: string,
    revision: number,
    turns: readonly ConversationTurnV1[],
    order: 'complete' | 'partial' = 'partial',
): ConversationEvidenceEventV1 {
    return {
        kind: 'source-batch',
        document: ref,
        epoch,
        revision,
        captureId: `capture-${revision}-${turns.map((item) => item.identity.turnId).join('-')}`,
        branchKey: 'branch-1',
        order,
        turns,
        gaps: order === 'complete'
            ? []
            : [{ kind: 'order', reason: 'source window is not the complete branch' }],
    };
}

function target(ref: ConversationDocumentRefV1, index: number): ConversationTargetV1 {
    return {
        documentKey: ref.key,
        turnId: `turn-${index}`,
        assistantMessageId: `assistant-${index}`,
        userMessageId: `user-${index}`,
    };
}

describe('ConversationEvidenceLedger', () => {
    it('merges partial windows by typed identity and keeps the first sealed content', () => {
        const ref = document();
        const ledger = new ConversationEvidenceLedger();

        ledger.ingest(source(ref, 'epoch-a', 1, [turn(2)]));
        ledger.ingest(source(ref, 'epoch-a', 2, [turn(1), turn(2)]));

        const view = ledger.read();
        expect(view.snapshot?.turns.map((item) => item.identity.assistantMessageId)).toEqual([
            'assistant-1',
            'assistant-2',
        ]);
        expect(ledger.readTurn(target(ref, 1))).toMatchObject({
            kind: 'ready',
            turn: { assistantMarkdown: 'Answer 1' },
        });

        const conflict = ledger.ingest({
            kind: 'turn',
            document: ref,
            epoch: 'epoch-a',
            revision: 3,
            captureId: 'host-conflict',
            origin: 'host',
            turn: turn(1, 'A different answer'),
        });
        expect(conflict.status).toBe('conflict');
        expect(ledger.readTurn(target(ref, 1))).toMatchObject({
            kind: 'ready',
            turn: { assistantMarkdown: 'Answer 1' },
        });
    });

    it('accepts evidence in any arrival order and treats duplicate evidence as a no-op', () => {
        const ref = document('permutation');
        const ledger = new ConversationEvidenceLedger();
        const complete = source(ref, 'epoch-a', 10, [turn(1), turn(2), turn(3)], 'complete');

        const first = ledger.ingest(complete);
        const duplicate = ledger.ingest(complete);

        expect(first.status).toBe('accepted');
        expect(duplicate.status).toBe('duplicate');
        expect(ledger.read().snapshot?.proof).toMatchObject({
            order: 'complete',
            bodies: 'complete',
            tail: 'stable',
            gaps: [],
        });
        expect(ledger.read().snapshot?.turns.map((item) => item.ordinal)).toEqual([1, 2, 3]);
    });

    it('rejects an old document epoch without erasing the current page ledger', () => {
        const oldRef = document('old');
        const currentRef = document('current');
        const ledger = new ConversationEvidenceLedger();

        ledger.ingest(source(currentRef, 'epoch-current', 2, [turn(2)], 'complete'));
        const ignored = ledger.ingest(source(oldRef, 'epoch-old', 99, [turn(1)], 'complete'));

        expect(ignored.status).toBe('ignored-epoch');
        expect(ledger.read().document?.key).toBe(currentRef.key);
        expect(ledger.read().snapshot?.turns[0]?.identity.assistantMessageId).toBe('assistant-2');
    });

    it('returns a stable single-turn result even when global order is still gapped', () => {
        const ref = document('single-turn');
        const ledger = new ConversationEvidenceLedger();

        ledger.ingest(source(ref, 'epoch-a', 1, [turn(7)]));

        expect(ledger.readTurn(target(ref, 7))).toMatchObject({
            kind: 'ready',
            turn: {
                identity: { assistantMessageId: 'assistant-7' },
            },
        });
        expect(ledger.read().snapshot?.proof.order).toBe('gapped');
    });

    it('rejects an older source revision without regressing the active projection', () => {
        const ref = document('revision-fence');
        const ledger = new ConversationEvidenceLedger();

        ledger.ingest(source(ref, 'epoch-a', 10, [turn(1)], 'complete'));
        const ignored = ledger.ingest(source(ref, 'epoch-a', 9, [turn(2)], 'complete'));

        expect(ignored.status).toBe('ignored-revision');
        expect(ledger.read().snapshot?.turns.map((item) => item.identity.turnId)).toEqual(['turn-1']);
    });

    it('switches active branches without mixing regenerated suffixes', () => {
        const ref = document('branch-switch');
        const ledger = new ConversationEvidenceLedger();

        ledger.ingest(source(ref, 'epoch-a', 1, [turn(1), turn(2)], 'complete'));
        const next = ledger.ingest({
            ...source(ref, 'epoch-a', 2, [turn(1), turn(3)], 'complete'),
            branchKey: 'branch-2',
            captureId: 'branch-2-capture',
        });

        expect(next.status).toBe('accepted');
        expect(next.view.snapshot?.turns.map((item) => item.identity.turnId)).toEqual(['turn-1', 'turn-3']);
        expect(ledger.readTurn(target(ref, 2))).toMatchObject({
            kind: 'unavailable',
            reason: 'not-recognized',
        });
    });
});
