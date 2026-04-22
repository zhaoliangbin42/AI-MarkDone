import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SiteAdapter, type ThemeDetector } from '@/drivers/content/adapters/base';
import { ChatGPTDirectoryController } from '@/ui/content/controllers/ChatGPTDirectoryController';

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

class ChatGPTTestAdapter extends SiteAdapter {
    matches(): boolean { return true; }
    getPlatformId(): string { return 'chatgpt'; }
    getThemeDetector(): ThemeDetector { return detector; }
    extractUserPrompt(): string | null { return null; }
    getMessageSelector(): string { return '[data-message-author-role=\"assistant\"]'; }
    getMessageContentSelector(): string { return '.markdown'; }
    getActionBarSelector(): string { return '.toolbar'; }
    getToolbarAnchorElement(): HTMLElement | null { return null; }
    injectToolbar(): boolean { return false; }
    isStreamingMessage(): boolean { return false; }
    getMessageId(messageElement: HTMLElement): string | null { return messageElement.getAttribute('data-message-id'); }
    getObserverContainer(): HTMLElement | null { return document.body; }
}

function buildSnapshot() {
    return {
        conversationId: 'conv-1',
        buildFingerprint: 'build-1',
        source: 'runtime-bridge' as const,
        capturedAt: Date.now(),
        rounds: [
            {
                id: 'round-1',
                position: 1,
                userPrompt: 'First question',
                assistantContent: 'First answer',
                preview: 'First question',
                messageId: 'a1',
                userMessageId: 'u1',
                assistantMessageId: 'a1',
            },
            {
                id: 'round-2',
                position: 2,
                userPrompt: 'Second question',
                assistantContent: 'Second answer',
                preview: 'Second question',
                messageId: 'a2',
                userMessageId: 'u2',
                assistantMessageId: 'a2',
            },
        ],
    };
}

function buildSkeletonDom() {
    document.body.innerHTML = `
      <div data-turn-id-container id="user-1"><section data-turn="user"></section></div>
      <div data-turn-id-container id="assistant-1"><section data-turn="assistant"></section></div>
      <div data-turn-id-container id="user-2"><section data-turn="user"></section></div>
      <div data-turn-id-container id="assistant-2"><section data-turn="assistant"></section></div>
    `;
}

describe('ChatGPTDirectoryController', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        navigationMocks.scrollToBookmarkTargetWithRetry.mockReset();
        navigationMocks.highlightElement.mockReset();
        buildSkeletonDom();
    });

    afterEach(() => {
        vi.runOnlyPendingTimers();
        vi.useRealTimers();
        document.body.innerHTML = '';
    });

    it('routes materialized round clicks through the shared same-page navigation helper', async () => {
        navigationMocks.scrollToBookmarkTargetWithRetry.mockResolvedValue({ ok: true });

        const adapter = new ChatGPTTestAdapter();
        const engine = { subscribe: vi.fn(() => () => undefined) } as any;
        const controller = new ChatGPTDirectoryController(adapter, engine);

        (controller as any).ensureRail();
        (controller as any).snapshot = buildSnapshot();
        (controller as any).render();

        const railRoot = document.getElementById('aimd-chatgpt-directory-rail')?.shadowRoot;
        const items = Array.from(railRoot?.querySelectorAll<HTMLButtonElement>('.rail__item') ?? []);
        items[0]?.click();
        await Promise.resolve();

        expect(navigationMocks.scrollToBookmarkTargetWithRetry).toHaveBeenCalledWith(
            adapter,
            { position: 1, messageId: 'a1' },
            { timeoutMs: 1500, intervalMs: 120 },
        );
        expect(navigationMocks.highlightElement).not.toHaveBeenCalled();
    });

    it('falls back to ChatGPT-local skeleton anchors when the shared jump path cannot resolve a cold round', async () => {
        navigationMocks.scrollToBookmarkTargetWithRetry.mockResolvedValue({ ok: false });

        const adapter = new ChatGPTTestAdapter();
        const engine = { subscribe: vi.fn(() => () => undefined) } as any;
        const controller = new ChatGPTDirectoryController(adapter, engine);
        const anchor = document.getElementById('user-2') as HTMLElement;
        anchor.scrollIntoView = vi.fn();

        (controller as any).ensureRail();
        (controller as any).snapshot = buildSnapshot();
        (controller as any).render();

        const railRoot = document.getElementById('aimd-chatgpt-directory-rail')?.shadowRoot;
        const items = Array.from(railRoot?.querySelectorAll<HTMLButtonElement>('.rail__item') ?? []);
        items[1]?.click();
        await Promise.resolve();
        vi.runAllTimers();

        expect(navigationMocks.scrollToBookmarkTargetWithRetry).toHaveBeenCalledWith(
            adapter,
            { position: 2, messageId: 'a2' },
            { timeoutMs: 1500, intervalMs: 120 },
        );
        expect(anchor.scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth', block: 'start' });
        expect(navigationMocks.highlightElement).toHaveBeenCalledWith(anchor);
    });
});
