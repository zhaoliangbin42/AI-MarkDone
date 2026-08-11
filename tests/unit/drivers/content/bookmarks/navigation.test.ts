import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const scrollToConversationTarget = vi.fn();
const scrollToConversationTargetWithRetry = vi.fn();
const resolveConversationTarget = vi.fn();
const highlightNavigationTarget = vi.fn();

vi.mock('@/drivers/content/conversation/navigation', () => ({
    resolveConversationTarget,
    scrollToConversationTarget,
    scrollToConversationTargetWithRetry,
}));

vi.mock('@/drivers/content/conversation/highlight', () => ({
    highlightNavigationTarget,
}));

describe('bookmark navigation', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        sessionStorage.clear();
        document.body.innerHTML = '';
    });

    afterEach(() => {
        vi.useRealTimers();
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

    it('treats the ChatGPT host migration as one conversation page identity', async () => {
        const { getBookmarkUrlCandidates, isSamePageUrl } = await import('@/drivers/content/bookmarks/navigation');

        expect(isSamePageUrl(
            'https://chat.openai.com/c/abc?mweb_fallback=1',
            'https://chatgpt.com/c/abc',
        )).toBe(true);
        expect(getBookmarkUrlCandidates('https://chat.openai.com/c/abc?mweb_fallback=1')).toEqual([
            'https://chatgpt.com/c/abc',
            'https://chat.openai.com/c/abc',
            'https://chatgpt.com/c/abc?mweb_fallback=1',
            'https://chat.openai.com/c/abc?mweb_fallback=1',
        ]);
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

    it('never falls back to direct selector discovery for ChatGPT legacy positions', async () => {
        const { scrollToAssistantPosition } = await import('@/drivers/content/bookmarks/navigation');
        const directCandidate = document.createElement('div');
        const scrollIntoView = vi.fn();
        directCandidate.className = 'legacy-assistant';
        directCandidate.scrollIntoView = scrollIntoView;
        document.body.appendChild(directCandidate);
        scrollToConversationTarget.mockReturnValueOnce({ ok: false, message: 'canonical target unavailable' });
        const getMessageSelector = vi.fn(() => '.legacy-assistant');

        const result = scrollToAssistantPosition({
            getPlatformId: () => 'chatgpt',
            getMessageSelector,
        } as any, 1);

        expect(result).toEqual({ ok: false, message: 'Canonical async navigation required' });
        expect(scrollToConversationTarget).not.toHaveBeenCalled();
        expect(getMessageSelector).not.toHaveBeenCalled();
        expect(scrollIntoView).not.toHaveBeenCalled();
    });

    it('keeps ChatGPT bookmark navigation on the injected Surface navigation port', async () => {
        const { scrollToBookmarkTargetWithRetry } = await import('@/drivers/content/bookmarks/navigation');

        const result = await scrollToBookmarkTargetWithRetry({ getPlatformId: () => 'chatgpt' } as any, {
            position: 50,
        }, {
            timeoutMs: 100,
            intervalMs: 10,
        });

        expect(result).toEqual({ ok: false, message: 'Canonical navigation port required' });
        expect(scrollToConversationTargetWithRetry).not.toHaveBeenCalled();
        expect(resolveConversationTarget).not.toHaveBeenCalled();
    });

});
