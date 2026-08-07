import { describe, expect, it } from 'vitest';

import { StableTurnCapture } from '@/services/content/StableTurnCapture';
import type { ConversationTurnV1 } from '@/contracts/conversationContent';

function turn(answer = 'Answer'): ConversationTurnV1 {
    return {
        key: 'turn-1:assistant-1',
        ordinal: 1,
        identity: {
            turnId: 'turn-1',
            userMessageId: 'user-1',
            assistantMessageId: 'assistant-1',
        },
        userText: 'Question',
        assistantMarkdown: answer,
    };
}

describe('StableTurnCapture', () => {
    it('keeps streaming and incomplete observations pending', () => {
        const capture = new StableTurnCapture();

        expect(capture.capture({
            turn: turn(),
            lifecycle: 'streaming',
            captureId: 'streaming',
            revision: 1,
        })).toMatchObject({ kind: 'pending' });
        expect(capture.capture({
            turn: turn(''),
            lifecycle: 'stable',
            captureId: 'empty',
            revision: 2,
        })).toMatchObject({ kind: 'unavailable', reason: 'invalid-content' });
        expect(capture.has('assistant-1')).toBe(false);
    });

    it('seals the first stable semantic body and rejects divergent evidence', () => {
        const capture = new StableTurnCapture();

        expect(capture.capture({
            turn: turn(),
            lifecycle: 'stable',
            captureId: 'stable-1',
            revision: 1,
        })).toMatchObject({ kind: 'ready', turn: { assistantMarkdown: 'Answer' } });
        expect(capture.capture({
            turn: turn(),
            lifecycle: 'stable',
            captureId: 'stable-2',
            revision: 2,
        })).toMatchObject({ kind: 'ready' });
        expect(capture.capture({
            turn: turn('Changed'),
            lifecycle: 'stable',
            captureId: 'conflict',
            revision: 3,
        })).toMatchObject({ kind: 'unavailable', reason: 'evidence-conflict' });
    });
});
