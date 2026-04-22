import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ChatGPTFoldBar } from '@/ui/content/chatgptFolding/ChatGPTFoldBar';

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

    it('routes folded ChatGPT targets to the fold bar while still highlighting the resolved message', async () => {
        vi.useFakeTimers();
        const { scrollToBookmarkTargetWithRetry } = await import('@/drivers/content/bookmarks/navigation');
        const foldBar = new ChatGPTFoldBar('light', { onToggle() {} }).getElement();
        foldBar.setAttribute('data-aimd-fold-group-id', 'group-a1');
        const assistantRoot = document.createElement('section');
        assistantRoot.setAttribute('data-aimd-fold-role', 'assistant');
        assistantRoot.setAttribute('data-aimd-fold-group-id', 'group-a1');
        assistantRoot.setAttribute('data-aimd-folded', '1');
        const message = document.createElement('div');
        assistantRoot.appendChild(message);
        document.body.append(foldBar, assistantRoot);

        const scrollIntoView = vi.fn();
        foldBar.scrollIntoView = scrollIntoView;
        resolveConversationTarget.mockReturnValue({ ok: true, targetEl: message, turnIndex: 0 });

        const result = await scrollToBookmarkTargetWithRetry({ getPlatformId: () => 'chatgpt' } as any, {
            position: 4,
            messageId: 'msg-4',
        });
        await vi.advanceTimersByTimeAsync(100);

        expect(result).toEqual({ ok: true });
        expect(resolveConversationTarget).toHaveBeenCalledWith(
            { getPlatformId: expect.any(Function) },
            { kind: 'messageId', messageId: 'msg-4' }
        );
        expect(scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth', block: 'start' });
        expect(foldBar.dataset.attention).toBe('1');
        vi.useRealTimers();
    });

    it('keeps retrying ChatGPT pending jumps until the folded target gets a visible fold bar', async () => {
        vi.useFakeTimers();
        const { scrollToBookmarkTargetWithRetry } = await import('@/drivers/content/bookmarks/navigation');
        const assistantRoot = document.createElement('section');
        assistantRoot.setAttribute('data-aimd-fold-role', 'assistant');
        assistantRoot.setAttribute('data-aimd-fold-group-id', 'group-a1');
        assistantRoot.setAttribute('data-aimd-folded', '1');
        const message = document.createElement('div');
        assistantRoot.appendChild(message);
        document.body.appendChild(assistantRoot);

        const foldBar = new ChatGPTFoldBar('light', { onToggle() {} }).getElement();
        foldBar.setAttribute('data-aimd-fold-group-id', 'group-a1');
        const scrollIntoView = vi.fn();
        foldBar.scrollIntoView = scrollIntoView;

        resolveConversationTarget.mockReturnValue({ ok: true, targetEl: message, turnIndex: 0 });

        const pendingPromise = scrollToBookmarkTargetWithRetry({ getPlatformId: () => 'chatgpt' } as any, {
            position: 4,
            messageId: 'msg-4',
        }, {
            timeoutMs: 600,
            intervalMs: 200,
        });

        await vi.advanceTimersByTimeAsync(250);
        document.body.insertBefore(foldBar, assistantRoot);
        await vi.advanceTimersByTimeAsync(250);

        await expect(pendingPromise).resolves.toEqual({ ok: true });
        expect(resolveConversationTarget.mock.calls.length).toBeGreaterThanOrEqual(2);
        expect(scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth', block: 'start' });
        vi.useRealTimers();
    });
});
