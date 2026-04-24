import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SiteAdapter, type ThemeDetector } from '@/drivers/content/adapters/base';

const navigationMocks = vi.hoisted(() => ({
    scrollToBookmarkTargetWithRetry: vi.fn(),
    highlightElement: vi.fn(),
}));

vi.mock('@/drivers/content/bookmarks/navigation', () => ({
    scrollToBookmarkTargetWithRetry: navigationMocks.scrollToBookmarkTargetWithRetry,
    highlightElement: navigationMocks.highlightElement,
}));

const detector: ThemeDetector = {
    detect: () => 'light',
    getObserveTargets: () => [],
    hasExplicitTheme: () => true,
};

class ChatGPTNavigationTestAdapter extends SiteAdapter {
    matches(): boolean { return true; }
    getPlatformId(): string { return 'chatgpt'; }
    getThemeDetector(): ThemeDetector { return detector; }
    extractUserPrompt(): string | null { return null; }
    getMessageSelector(): string { return '[data-message-author-role="assistant"]'; }
    getMessageContentSelector(): string { return '.markdown'; }
    getActionBarSelector(): string { return '.toolbar'; }
    getToolbarAnchorElement(): HTMLElement | null { return null; }
    injectToolbar(): boolean { return false; }
    isStreamingMessage(): boolean { return false; }
    getMessageId(): string | null { return null; }
    getObserverContainer(): HTMLElement | null { return document.body; }
}

function buildSkeletonDom(): HTMLElement {
    document.body.innerHTML = `
      <div data-turn-id-container id="user-1"><section data-turn="user"></section></div>
      <div data-turn-id-container id="assistant-1"><section data-turn="assistant"></section></div>
    `;
    return document.getElementById('user-1') as HTMLElement;
}

describe('ChatGPT directory navigation', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        navigationMocks.scrollToBookmarkTargetWithRetry.mockReset();
        navigationMocks.highlightElement.mockReset();
        window.localStorage.clear();
        document.body.innerHTML = '';
    });

    afterEach(() => {
        vi.runOnlyPendingTimers();
        vi.useRealTimers();
        document.body.innerHTML = '';
        window.localStorage.clear();
    });

    it('realigns the skeleton anchor when host hydration shifts it after the first scroll', async () => {
        const { navigateChatGPTDirectoryTarget } = await import('@/ui/content/chatgptDirectory/navigation');
        const adapter = new ChatGPTNavigationTestAdapter();
        const anchor = buildSkeletonDom();
        let top = 0;
        anchor.getBoundingClientRect = vi.fn(() => ({
            x: 0,
            y: top,
            top,
            left: 0,
            right: 100,
            bottom: top + 40,
            width: 100,
            height: 40,
            toJSON: () => ({}),
        }));
        anchor.scrollIntoView = vi.fn(() => {
            top = 0;
            if ((anchor.scrollIntoView as ReturnType<typeof vi.fn>).mock.calls.length === 1) {
                window.setTimeout(() => {
                    top = 36;
                }, 20);
            }
        });

        const resultPromise = navigateChatGPTDirectoryTarget(adapter, { position: 1 }, {
            alignmentTimeoutMs: 240,
            alignmentQuietMs: 40,
            alignmentTolerancePx: 8,
            maxAlignmentAttempts: 3,
        });

        await vi.advanceTimersByTimeAsync(260);
        const result = await resultPromise;

        expect(result).toEqual({ ok: true });
        expect(anchor.scrollIntoView).toHaveBeenCalledTimes(2);
        expect(navigationMocks.highlightElement).toHaveBeenCalledWith(anchor);
    });

    it('does not keep realigning after the user starts navigating manually', async () => {
        const { navigateChatGPTDirectoryTarget } = await import('@/ui/content/chatgptDirectory/navigation');
        const adapter = new ChatGPTNavigationTestAdapter();
        const anchor = buildSkeletonDom();
        let top = 0;
        anchor.getBoundingClientRect = vi.fn(() => ({
            x: 0,
            y: top,
            top,
            left: 0,
            right: 100,
            bottom: top + 40,
            width: 100,
            height: 40,
            toJSON: () => ({}),
        }));
        anchor.scrollIntoView = vi.fn(() => {
            top = 0;
            window.setTimeout(() => {
                top = 36;
            }, 20);
        });

        const resultPromise = navigateChatGPTDirectoryTarget(adapter, { position: 1 }, {
            alignmentTimeoutMs: 240,
            alignmentQuietMs: 40,
            alignmentTolerancePx: 8,
            maxAlignmentAttempts: 3,
        });

        await vi.advanceTimersByTimeAsync(30);
        document.dispatchEvent(new WheelEvent('wheel', { bubbles: true }));
        await vi.advanceTimersByTimeAsync(260);
        const result = await resultPromise;

        expect(result).toEqual({ ok: true });
        expect(anchor.scrollIntoView).toHaveBeenCalledTimes(1);
    });
});
