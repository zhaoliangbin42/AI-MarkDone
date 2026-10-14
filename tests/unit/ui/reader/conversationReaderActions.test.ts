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

    it('keeps the Reader open until locate succeeds and preserves it on failure', async () => {
        const afterLocate = vi.fn();
        let finish: (value: { ok: boolean }) => void = () => undefined;
        const locate = vi.fn(() => new Promise<{ ok: boolean }>(resolve => { finish = resolve; }));
        const options = { locate: { afterLocate, locate } };
        const action = createConversationReaderActions(options).find(action => action.id === 'locate')!;
        const ctx = { item: { id: 'item', userPrompt: 'Q', content: 'A', meta: { position: 1, assistantMessageId: 'assistant-1' } }, index: 0, items: [], notify: vi.fn(), rerender: vi.fn() };
        const first = action.onClick(ctx);
        expect(afterLocate).not.toHaveBeenCalled();
        expect(locate).toHaveBeenLastCalledWith({ position: 1, messageId: 'assistant-1' });
        finish({ ok: false }); await first;
        expect(afterLocate).not.toHaveBeenCalled();
        const second = action.onClick(ctx); finish({ ok: true }); await second;
        expect(afterLocate).toHaveBeenCalledOnce();
    });

    it('carries the clicked Reader item document and source URL into locate', async () => {
        const locate = vi.fn(async () => ({ ok: false, handled: true }));
        const action = createConversationReaderActions({ locate: { locate } }).find(candidate => candidate.id === 'locate')!;
        await action.onClick({
            item: { id: 'assistant-1', userPrompt: 'Q', content: 'A', meta: {
                position: 2, assistantMessageId: 'assistant-1', documentKey: 'chatgpt:conversation:current-item',
                url: 'https://chatgpt.com/c/current-item',
            } },
            index: 0, items: [], notify: vi.fn(), rerender: vi.fn(),
        });
        expect(locate).toHaveBeenCalledExactlyOnceWith({
            position: 2, messageId: 'assistant-1', documentKey: 'chatgpt:conversation:current-item',
            sourceUrl: 'https://chatgpt.com/c/current-item',
        });
    });

    it('disables and guards the bookmark action when the current Reader item is not bookmarkable', async () => {
        const notify = vi.fn();
        const toggle = vi.fn(async () => ({ ok: true as const, bookmarked: true, message: 'saved' }));
        const bookmark = {
            resolveUrl: () => 'https://chatgpt.com/c/conv-1',
            isBookmarked: () => false,
            isAvailable: vi.fn(() => false),
            toggle,
        };
        const actions = createConversationReaderActions({ locate, bookmark });
        const action = actions.find((candidate) => candidate.id === 'bookmark_toggle')!;
        const ctx = {
            item: {
                id: 'chatgpt-a1',
                userPrompt: 'Question',
                content: 'Answer',
                meta: { position: 0, messageId: 'a1', bookmarkable: false },
            },
            index: 0,
            items: [],
            notify,
            rerender: vi.fn(),
        };

        expect(action.isEnabled?.(ctx)).toBe(false);
        await action.onClick(ctx);

        expect(toggle).not.toHaveBeenCalled();
        expect(notify).toHaveBeenCalledWith('bookmarkUnavailable');
    });

    it('falls back to assistantMessageId when Reader metadata omits messageId', async () => {
        const toggle = vi.fn(async () => ({ ok: true as const, bookmarked: true, message: 'saved' }));
        const bookmark = {
            resolveUrl: () => 'https://chatgpt.com/c/conv-1',
            isBookmarked: () => false,
            toggle,
        };
        const actions = createConversationReaderActions({ locate, bookmark });
        const action = actions.find((candidate) => candidate.id === 'bookmark_toggle')!;

        await action.onClick({
            item: {
                id: 'chatgpt-a1',
                userPrompt: 'Question',
                content: 'Answer',
                meta: { position: 1, assistantMessageId: 'a1' },
            },
            index: 0,
            items: [],
            notify: vi.fn(),
            rerender: vi.fn(),
        });

        expect(toggle).toHaveBeenCalledWith(expect.objectContaining({ messageId: 'a1' }));
    });
});
