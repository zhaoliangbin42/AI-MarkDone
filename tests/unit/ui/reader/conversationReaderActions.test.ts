import { describe, expect, it, vi } from 'vitest';
import { createConversationReaderActions } from '@/ui/content/reader/conversationReaderActions';

describe('conversation reader actions', () => {
    const locate = {
        locate: vi.fn(async () => ({ ok: true })),
    };

    it('keeps refresh optional while always exposing locate', () => {
        const withoutRefresh = createConversationReaderActions({ locate });
        expect(withoutRefresh.map((action) => action.id)).toEqual(['locate']);

        const withRefresh = createConversationReaderActions({
            locate,
            refresh: { refresh: vi.fn(async () => undefined) },
        });
        expect(withRefresh.map((action) => action.id)).toEqual(['refresh', 'locate']);
    });

    it('adds shared send action only when a send port is provided', () => {
        const withoutSend = createConversationReaderActions({ locate });
        expect(withoutSend.some((action) => action.id === 'send')).toBe(false);

        const withSend = createConversationReaderActions({
            locate,
            send: { open: vi.fn() },
        });
        expect(withSend.map((action) => action.id)).toEqual(['send', 'locate']);
    });
});
