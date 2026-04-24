import { beforeEach, describe, expect, it, vi } from 'vitest';

const scrollToConversationTarget = vi.fn();
const scrollToConversationTargetWithRetry = vi.fn();
const resolveConversationTarget = vi.fn();
const highlightElement = vi.fn();

vi.mock('@/drivers/content/conversation/navigation', () => ({
    highlightElement,
    resolveConversationTarget,
    scrollToConversationTarget,
    scrollToConversationTargetWithRetry,
}));

describe('bookmark navigation', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        sessionStorage.clear();
        document.body.innerHTML = '';
    });

    it('persists and consumes pending navigation with optional messageId', async () => {
        const { consumePendingNavigation, setPendingNavigation } = await import('@/drivers/content/bookmarks/navigation');

        setPendingNavigation({
            url: 'https://chat.openai.com/c/abc',
            position: 4,
            messageId: 'msg-4',
        });

        expect(consumePendingNavigation()).toEqual({
            url: 'https://chat.openai.com/c/abc',
            position: 4,
            messageId: 'msg-4',
        });
        expect(consumePendingNavigation()).toBeNull();
    });

    it('keeps legacy pending navigation payloads compatible', async () => {
        const { consumePendingNavigation } = await import('@/drivers/content/bookmarks/navigation');

        sessionStorage.setItem('aimd:bookmarkNavigate:v1', JSON.stringify({
            url: 'https://chat.openai.com/c/abc',
            position: 4,
        }));

        expect(consumePendingNavigation()).toEqual({
            url: 'https://chat.openai.com/c/abc',
            position: 4,
            messageId: null,
        });
    });

    it('tries messageId first and falls back to legacy position when needed', async () => {
        const { scrollToBookmarkTargetWithRetry } = await import('@/drivers/content/bookmarks/navigation');
        scrollToConversationTargetWithRetry
            .mockResolvedValueOnce({ ok: false, message: 'missing message id' })
            .mockResolvedValueOnce({ ok: true });

        const result = await scrollToBookmarkTargetWithRetry({} as any, {
            position: 4,
            messageId: 'msg-4',
        });

        expect(result).toEqual({ ok: true });
        expect(scrollToConversationTargetWithRetry).toHaveBeenNthCalledWith(
            1,
            {},
            { kind: 'messageId', messageId: 'msg-4' },
            { block: 'start' }
        );
        expect(scrollToConversationTargetWithRetry).toHaveBeenNthCalledWith(
            2,
            {},
            { kind: 'legacyAssistantPosition', position: 4 },
            { block: 'start' }
        );
    });

    it('preserves an explicit scroll block option for callers that need another alignment', async () => {
        const { scrollToBookmarkTargetWithRetry } = await import('@/drivers/content/bookmarks/navigation');
        scrollToConversationTargetWithRetry.mockResolvedValueOnce({ ok: true });

        await scrollToBookmarkTargetWithRetry({} as any, {
            position: 4,
            messageId: 'msg-4',
        }, {
            timeoutMs: 100,
            intervalMs: 10,
            block: 'center',
        });

        expect(scrollToConversationTargetWithRetry).toHaveBeenCalledWith(
            {},
            { kind: 'messageId', messageId: 'msg-4' },
            { timeoutMs: 100, intervalMs: 10, block: 'center' }
        );
    });

    it('scrolls ChatGPT bookmark targets to the resolved message element', async () => {
        const { scrollToBookmarkTargetWithRetry } = await import('@/drivers/content/bookmarks/navigation');
        const message = document.createElement('div');
        const scrollIntoView = vi.fn();
        message.scrollIntoView = scrollIntoView;
        resolveConversationTarget.mockReturnValue({ ok: true, targetEl: message, turnIndex: 0 });

        const result = await scrollToBookmarkTargetWithRetry({ getPlatformId: () => 'chatgpt' } as any, {
            position: 4,
            messageId: 'msg-4',
        }, {
            timeoutMs: 100,
            intervalMs: 10,
        });

        expect(result).toEqual({ ok: true });
        expect(resolveConversationTarget).toHaveBeenCalledWith(
            { getPlatformId: expect.any(Function) },
            { kind: 'messageId', messageId: 'msg-4' }
        );
        expect(scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth', block: 'start' });
    });

});
