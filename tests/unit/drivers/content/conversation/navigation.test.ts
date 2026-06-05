import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const highlightNavigationTarget = vi.fn();

vi.mock('@/drivers/content/conversation/highlight', () => ({
    highlightNavigationTarget,
}));

function createAdapter(targetEl: HTMLElement) {
    return {
        getMessageSelector: () => '[data-message-author-role="assistant"]',
        extractUserPrompt: () => 'Prompt',
        getMessageId: () => 'message-1',
        getConversationGroupRefs: () => [{
            id: 'message-1',
            assistantRootEl: targetEl,
            assistantMessageEl: targetEl,
            userRootEl: null,
            userPromptText: 'Prompt',
            barAnchorEl: targetEl,
            groupEls: [targetEl],
            assistantIndex: 0,
            isStreaming: false,
        }],
    } as any;
}

describe('conversation navigation', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        highlightNavigationTarget.mockReset();
        document.body.innerHTML = '';
    });

    afterEach(() => {
        vi.runOnlyPendingTimers();
        vi.useRealTimers();
        document.body.innerHTML = '';
    });

    it('uses the shared navigation highlight helper after scrolling to a conversation target', async () => {
        const { scrollToConversationTarget } = await import('@/drivers/content/conversation/navigation');
        const target = document.createElement('section');
        target.setAttribute('data-message-author-role', 'assistant');
        target.scrollIntoView = vi.fn();
        document.body.appendChild(target);

        const result = scrollToConversationTarget(createAdapter(target), { kind: 'messageId', messageId: 'message-1' });

        expect(result).toEqual({ ok: true });
        expect(target.scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth', block: 'center' });
        expect(highlightNavigationTarget).not.toHaveBeenCalled();

        await vi.advanceTimersByTimeAsync(100);
        expect(highlightNavigationTarget).toHaveBeenCalledWith(target);
    });
});
