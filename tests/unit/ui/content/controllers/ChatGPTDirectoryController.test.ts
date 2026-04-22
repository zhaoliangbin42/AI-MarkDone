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

    it('routes materialized round clicks through the local skeleton anchor for immediate same-page navigation', async () => {
        navigationMocks.scrollToBookmarkTargetWithRetry.mockResolvedValue({ ok: true });

        const adapter = new ChatGPTTestAdapter();
        const engine = { subscribe: vi.fn(() => () => undefined) } as any;
        const controller = new ChatGPTDirectoryController(adapter, engine);
        const anchor = document.getElementById('user-1') as HTMLElement;
        anchor.scrollIntoView = vi.fn();

        (controller as any).ensureRail();
        (controller as any).snapshot = buildSnapshot();
        (controller as any).render();

        const railRoot = document.getElementById('aimd-chatgpt-directory-rail')?.shadowRoot;
        const items = Array.from(railRoot?.querySelectorAll<HTMLButtonElement>('.rail__item') ?? []);
        items[0]?.click();
        await Promise.resolve();
        vi.runAllTimers();

        expect(anchor.scrollIntoView).toHaveBeenCalledWith({ behavior: 'auto', block: 'start' });
        expect(navigationMocks.highlightElement).toHaveBeenCalledWith(anchor);
        expect(navigationMocks.scrollToBookmarkTargetWithRetry).not.toHaveBeenCalled();
    });

    it('renders skeleton placeholder bars before the payload snapshot is ready', () => {
        const adapter = new ChatGPTTestAdapter();
        const engine = { subscribe: vi.fn(() => () => undefined) } as any;
        const controller = new ChatGPTDirectoryController(adapter, engine);

        (controller as any).ensureRail();
        (controller as any).snapshot = null;
        (controller as any).render();

        const railRoot = document.getElementById('aimd-chatgpt-directory-rail')?.shadowRoot;
        const items = Array.from(railRoot?.querySelectorAll<HTMLButtonElement>('.rail__item') ?? []);
        expect(items).toHaveLength(2);
        expect(items[0]?.dataset.position).toBe('1');
        expect(items[0]?.getAttribute('aria-label')).toContain('Message 1');
        expect(items[1]?.dataset.position).toBe('2');
    });

    it('applies nearby hover proximity states for the directory accordion effect', () => {
        const adapter = new ChatGPTTestAdapter();
        const engine = { subscribe: vi.fn(() => () => undefined) } as any;
        const controller = new ChatGPTDirectoryController(adapter, engine);

        (controller as any).ensureRail();
        (controller as any).snapshot = {
            ...buildSnapshot(),
            rounds: [
                ...buildSnapshot().rounds,
                {
                    id: 'round-3',
                    position: 3,
                    userPrompt: 'Third question',
                    assistantContent: 'Third answer',
                    preview: 'Third question',
                    messageId: 'a3',
                    userMessageId: 'u3',
                    assistantMessageId: 'a3',
                },
                {
                    id: 'round-4',
                    position: 4,
                    userPrompt: 'Fourth question',
                    assistantContent: 'Fourth answer',
                    preview: 'Fourth question',
                    messageId: 'a4',
                    userMessageId: 'u4',
                    assistantMessageId: 'a4',
                },
            ],
        };
        (controller as any).render();

        const railRoot = document.getElementById('aimd-chatgpt-directory-rail')?.shadowRoot;
        const list = railRoot?.querySelector<HTMLElement>('.rail__list');
        const items = Array.from(railRoot?.querySelectorAll<HTMLButtonElement>('.rail__item') ?? []);
        items[2]?.dispatchEvent(new Event('pointerover', { bubbles: true }));

        expect(list?.dataset.hasHover).toBe('1');
        expect(items.map((item) => item.dataset.proximity)).toEqual(['2', '1', '0', '1']);

        list?.dispatchEvent(new Event('pointerleave', { bubbles: true }));

        expect(list?.dataset.hasHover).toBe('0');
        expect(items.every((item) => item.dataset.proximity === undefined)).toBe(true);
    });

    it('renders the directory preview as a body-level portal on hover', () => {
        const adapter = new ChatGPTTestAdapter();
        const engine = { subscribe: vi.fn(() => () => undefined) } as any;
        const controller = new ChatGPTDirectoryController(adapter, engine);

        (controller as any).ensureRail();
        (controller as any).snapshot = buildSnapshot();
        (controller as any).render();

        const railRoot = document.getElementById('aimd-chatgpt-directory-rail')?.shadowRoot;
        const list = railRoot?.querySelector<HTMLElement>('.rail__list');
        const items = Array.from(railRoot?.querySelectorAll<HTMLButtonElement>('.rail__item') ?? []);
        items[0]?.dispatchEvent(new Event('pointerover', { bubbles: true }));

        const preview = document.getElementById('aimd-chatgpt-directory-preview');
        expect(preview?.parentElement).toBe(document.body);
        expect(preview?.dataset.open).toBe('1');
        expect(preview?.textContent).toContain('#1');
        expect(preview?.textContent).toContain('First question');
        expect(preview?.textContent?.match(/First question/g)).toHaveLength(1);

        list?.dispatchEvent(new Event('pointerleave', { bubbles: true }));
        expect(preview?.dataset.open).toBe('0');
    });

    it('ships scoped token styles for the body-level directory preview', () => {
        const adapter = new ChatGPTTestAdapter();
        const engine = { subscribe: vi.fn(() => () => undefined) } as any;
        const controller = new ChatGPTDirectoryController(adapter, engine);

        (controller as any).ensureRail();

        const style = document.getElementById('aimd-chatgpt-directory-preview-style');
        expect(style?.textContent).toContain('.aimd-chatgpt-directory-preview[data-aimd-theme="light"]');
        expect(style?.textContent).toContain('.aimd-chatgpt-directory-preview[data-aimd-theme="dark"]');
        expect(style?.textContent).toContain('background: var(--aimd-bg-surface');
    });

    it('keeps the rail visible on ChatGPT SPA routes when conversation skeletons are already present', async () => {
        window.history.replaceState({}, '', '/');
        const adapter = new ChatGPTTestAdapter();
        const engine = { getSnapshot: vi.fn(async () => null), subscribe: vi.fn(() => () => undefined) } as any;
        const controller = new ChatGPTDirectoryController(adapter, engine);

        controller.init('light');
        await Promise.resolve();

        const host = document.getElementById('aimd-chatgpt-directory-rail') as HTMLElement | null;
        const items = Array.from(host?.shadowRoot?.querySelectorAll<HTMLButtonElement>('.rail__item') ?? []);
        expect(host?.style.display).toBe('block');
        expect(items).toHaveLength(2);
    });

    it('reattaches the rail host if the ChatGPT app removes the body-level node', async () => {
        const adapter = new ChatGPTTestAdapter();
        const engine = { getSnapshot: vi.fn(async () => null), subscribe: vi.fn(() => () => undefined) } as any;
        const controller = new ChatGPTDirectoryController(adapter, engine);

        controller.init('light');
        await Promise.resolve();
        document.getElementById('aimd-chatgpt-directory-rail')?.remove();

        await (controller as any).refresh();

        const host = document.getElementById('aimd-chatgpt-directory-rail') as HTMLElement | null;
        const items = Array.from(host?.shadowRoot?.querySelectorAll<HTMLButtonElement>('.rail__item') ?? []);
        expect(host?.isConnected).toBe(true);
        expect(items).toHaveLength(2);
    });

    it('renders placeholder bars from materialized assistant messages when turn skeletons are unavailable', () => {
        document.body.innerHTML = `
          <main>
            <div data-message-author-role="assistant" data-message-id="a1"></div>
            <div data-message-author-role="assistant" data-message-id="a2"></div>
            <div data-message-author-role="assistant" data-message-id="a3"></div>
          </main>
        `;
        const adapter = new ChatGPTTestAdapter();
        const engine = { subscribe: vi.fn(() => () => undefined) } as any;
        const controller = new ChatGPTDirectoryController(adapter, engine);

        (controller as any).ensureRail();
        (controller as any).snapshot = null;
        (controller as any).render();

        const railRoot = document.getElementById('aimd-chatgpt-directory-rail')?.shadowRoot;
        const items = Array.from(railRoot?.querySelectorAll<HTMLButtonElement>('.rail__item') ?? []);
        expect(items).toHaveLength(3);
        expect(items.map((item) => item.dataset.position)).toEqual(['1', '2', '3']);
    });

    it('falls back to the shared jump path only when a local skeleton anchor is unavailable', async () => {
        navigationMocks.scrollToBookmarkTargetWithRetry.mockResolvedValue({ ok: false });

        const adapter = new ChatGPTTestAdapter();
        const engine = { subscribe: vi.fn(() => () => undefined) } as any;
        const controller = new ChatGPTDirectoryController(adapter, engine);

        (controller as any).ensureRail();
        (controller as any).snapshot = buildSnapshot();
        (controller as any).render();
        (controller as any).skeletonAnchors = [];

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
    });
});
