import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SiteAdapter, type ConversationGroupRef, type ThemeDetector } from '@/drivers/content/adapters/base';
import { ChatGPTDirectoryController } from '@/ui/content/controllers/ChatGPTDirectoryController';
import { ChatGPTDirectoryRail } from '@/ui/content/chatgptDirectory/ChatGPTDirectoryRail';

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
    getConversationGroupRefs(): ConversationGroupRef[] {
        const refs: ConversationGroupRef[] = [];
        const turnContainers = Array.from(document.querySelectorAll('[data-turn-id-container]')).filter(
            (node): node is HTMLElement => node instanceof HTMLElement,
        );
        let pendingUser: HTMLElement | null = null;
        for (const container of turnContainers) {
            const userRootEl = container.querySelector('[data-turn="user"]');
            const assistantRootEl = container.querySelector('[data-turn="assistant"]');
            if (userRootEl instanceof HTMLElement && !(assistantRootEl instanceof HTMLElement)) {
                pendingUser = container;
                continue;
            }
            if (!(assistantRootEl instanceof HTMLElement)) continue;
            refs.push({
                id: `group-${refs.length + 1}`,
                assistantRootEl,
                assistantMessageEl: assistantRootEl,
                userRootEl: pendingUser,
                userPromptText: pendingUser?.textContent?.trim() ?? null,
                barAnchorEl: pendingUser ?? container,
                groupEls: [pendingUser, container].filter((node): node is HTMLElement => node instanceof HTMLElement),
                assistantIndex: refs.length,
                isStreaming: false,
            });
            pendingUser = null;
        }
        if (refs.length > 0) return refs;

        let pendingRoleUser: HTMLElement | null = null;
        for (const roleNode of Array.from(document.querySelectorAll('[data-message-author-role]'))) {
            if (!(roleNode instanceof HTMLElement)) continue;
            const role = roleNode.getAttribute('data-message-author-role');
            const turnRoot = roleNode.closest('[data-testid^="conversation-turn-"], [data-turn]') ?? roleNode;
            const rootEl = turnRoot instanceof HTMLElement ? turnRoot : roleNode;
            if (role === 'user') {
                pendingRoleUser = rootEl;
                continue;
            }
            if (role !== 'assistant') continue;
            if (!pendingRoleUser) {
                const previousRef = refs[refs.length - 1];
                if (previousRef && !previousRef.groupEls.includes(rootEl)) previousRef.groupEls.push(rootEl);
                continue;
            }
            refs.push({
                id: roleNode.getAttribute('data-message-id') ?? `group-${refs.length + 1}`,
                assistantRootEl: rootEl,
                assistantMessageEl: roleNode,
                userRootEl: pendingRoleUser,
                userPromptText: pendingRoleUser.textContent?.trim() ?? null,
                barAnchorEl: pendingRoleUser,
                groupEls: [pendingRoleUser, rootEl],
                assistantIndex: refs.length,
                isStreaming: false,
            });
            pendingRoleUser = null;
        }
        return refs;
    }
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

function buildSkeletonDomWithCount(count: number) {
    document.body.innerHTML = Array.from({ length: count }, (_, index) => {
        const position = index + 1;
        return `
          <div data-turn-id-container id="user-${position}"><section data-turn="user"></section></div>
          <div data-turn-id-container id="assistant-${position}"><section data-turn="assistant"></section></div>
        `;
    }).join('');
}

function setRect(element: HTMLElement, top: number, bottom: number): void {
    element.getBoundingClientRect = vi.fn(() => ({
        x: 0,
        y: top,
        top,
        bottom,
        left: 0,
        right: 100,
        width: 100,
        height: bottom - top,
        toJSON: () => ({}),
    }));
}

function setRoundRects(rects: Record<string, [number, number]>): void {
    for (const [id, [top, bottom]] of Object.entries(rects)) {
        const element = document.getElementById(id) as HTMLElement | null;
        if (element) setRect(element, top, bottom);
    }
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
        await vi.advanceTimersByTimeAsync(1000);

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

    it('uses DOM-discovered prompts instead of low-quality snapshot Message labels', () => {
        document.body.innerHTML = `
          <div data-turn-id-container id="user-1"><section data-turn="user">真实用户问题一</section></div>
          <div data-turn-id-container id="assistant-1"><section data-turn="assistant" data-message-author-role="assistant" data-message-id="a1"></section></div>
          <div data-turn-id-container id="user-2"><section data-turn="user">真实用户问题二</section></div>
          <div data-turn-id-container id="assistant-2"><section data-turn="assistant" data-message-author-role="assistant" data-message-id="a2"></section></div>
        `;
        const adapter = new ChatGPTTestAdapter();
        const engine = { subscribe: vi.fn(() => () => undefined) } as any;
        const controller = new ChatGPTDirectoryController(adapter, engine);

        (controller as any).ensureRail();
        (controller as any).snapshot = {
            ...buildSnapshot(),
            rounds: buildSnapshot().rounds.map((round) => ({
                ...round,
                userPrompt: `Message ${round.position}`,
                preview: `Message ${round.position}`,
            })),
        };
        (controller as any).render();

        const railRoot = document.getElementById('aimd-chatgpt-directory-rail')?.shadowRoot;
        const items = Array.from(railRoot?.querySelectorAll<HTMLButtonElement>('.rail__item') ?? []);
        expect(items).toHaveLength(2);
        expect(items[0]?.getAttribute('aria-label')).toContain('真实用户问题一');
        expect(items[0]?.getAttribute('aria-label')).not.toContain('Message 1');
        expect(items[1]?.getAttribute('aria-label')).toContain('真实用户问题二');
    });

    it('rebuilds directory rounds when ChatGPT mounts conversation DOM after SPA route change', async () => {
        window.history.replaceState({}, '', '/c/69e8d157-5fec-839c-9124-2179ba8b7d7c');
        document.body.innerHTML = '<main id="conversation-root"></main>';
        const adapter = new ChatGPTTestAdapter();
        const engine = { getSnapshot: vi.fn(async () => null), subscribe: vi.fn(() => () => undefined) } as any;
        const controller = new ChatGPTDirectoryController(adapter, engine);

        controller.init('light');
        await Promise.resolve();
        let railRoot = document.getElementById('aimd-chatgpt-directory-rail')?.shadowRoot;
        expect(railRoot?.querySelectorAll('.rail__item')).toHaveLength(0);

        document.getElementById('conversation-root')!.innerHTML = `
          <div data-turn-id-container id="user-1"><section data-turn="user">延迟挂载的问题一</section></div>
          <div data-turn-id-container id="assistant-1"><section data-turn="assistant" data-message-author-role="assistant" data-message-id="a1"></section></div>
          <div data-turn-id-container id="user-2"><section data-turn="user">延迟挂载的问题二</section></div>
          <div data-turn-id-container id="assistant-2"><section data-turn="assistant" data-message-author-role="assistant" data-message-id="a2"></section></div>
        `;
        await Promise.resolve();
        await Promise.resolve();
        await vi.advanceTimersByTimeAsync(0);

        await vi.waitFor(() => {
            railRoot = document.getElementById('aimd-chatgpt-directory-rail')?.shadowRoot;
            const items = Array.from(railRoot?.querySelectorAll<HTMLButtonElement>('.rail__item') ?? []);
            expect(items).toHaveLength(2);
            expect(items[0]?.getAttribute('aria-label')).toContain('延迟挂载的问题一');
        });
        controller.dispose();
    });

    it('applies nearby hover proximity states for the directory accordion effect', () => {
        buildSkeletonDomWithCount(4);
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

    it('renders an expanded hover directory with truncated user prompts without opening the preview portal', () => {
        const adapter = new ChatGPTTestAdapter();
        const engine = { subscribe: vi.fn(() => () => undefined) } as any;
        const controller = new ChatGPTDirectoryController(adapter, engine);

        (controller as any).ensureRail();
        controller.setDisplayMode('expanded');
        (controller as any).snapshot = {
            ...buildSnapshot(),
            rounds: [
                {
                    ...buildSnapshot().rounds[0],
                    userPrompt: 'This is a very long user prompt with more than thirty visible characters',
                },
                buildSnapshot().rounds[1],
            ],
        };
        (controller as any).render();

        const railRoot = document.getElementById('aimd-chatgpt-directory-rail')?.shadowRoot;
        const list = railRoot?.querySelector<HTMLElement>('.rail__list');
        const items = Array.from(railRoot?.querySelectorAll<HTMLButtonElement>('.rail__item') ?? []);

        expect(list?.dataset.mode).toBe('expanded');
        expect(list?.dataset.expanded).toBe('0');
        expect(items[0]?.querySelector<HTMLElement>('.rail__index')?.textContent).toBe('#1');
        expect(items[0]?.textContent).toContain('This is a very …');
        expect(items[0]?.querySelector<HTMLElement>('.rail__label')?.textContent).toHaveLength(16);

        list?.dispatchEvent(new Event('pointerenter', { bubbles: true }));
        items[1]?.dispatchEvent(new Event('pointerover', { bubbles: true }));

        expect(list?.dataset.expanded).toBe('1');
        expect(items[1]?.dataset.hovered).toBe('1');
        expect(document.getElementById('aimd-chatgpt-directory-preview')?.dataset.open).toBe('0');

        list?.dispatchEvent(new Event('pointerleave', { bubbles: true }));
        expect(list?.dataset.expanded).toBe('0');
        expect(items.every((item) => item.dataset.hovered === undefined)).toBe(true);
    });

    it('renders expanded labels with prompt endings when the head-tail setting is enabled', () => {
        const adapter = new ChatGPTTestAdapter();
        const engine = { subscribe: vi.fn(() => () => undefined) } as any;
        const controller = new ChatGPTDirectoryController(adapter, engine);

        (controller as any).ensureRail();
        controller.setDisplayMode('expanded');
        controller.setPromptLabelMode('headTail');
        (controller as any).snapshot = {
            ...buildSnapshot(),
            rounds: [
                {
                    ...buildSnapshot().rounds[0],
                    userPrompt: 'Repeated prefix segment with unique ending marker',
                },
                {
                    ...buildSnapshot().rounds[1],
                    userPrompt: 'Short prompt',
                },
            ],
        };
        (controller as any).render();

        const railRoot = document.getElementById('aimd-chatgpt-directory-rail')?.shadowRoot;
        const labels = Array.from(railRoot?.querySelectorAll<HTMLElement>('.rail__label') ?? []);
        const style = railRoot?.querySelector('style')?.textContent ?? '';

        expect(labels[0]?.textContent).toBe('Repeated prefix…e ending marker');
        expect(labels[1]?.textContent).toBe('Short prompt');
        expect(style).toContain('width: fit-content');
        expect(style).toContain('inline-size: 15em');
        expect(style).toContain('inline-size: 30em');
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

    it('makes init idempotent and unsubscribes from the engine on dispose', async () => {
        const unsubscribe = vi.fn();
        const adapter = new ChatGPTTestAdapter();
        const engine = {
            getSnapshot: vi.fn(async () => null),
            subscribe: vi.fn(() => unsubscribe),
        } as any;
        const controller = new ChatGPTDirectoryController(adapter, engine);

        controller.init('light');
        await Promise.resolve();
        controller.init('dark');
        await Promise.resolve();
        controller.dispose();

        expect(engine.subscribe).toHaveBeenCalledTimes(1);
        expect(unsubscribe).toHaveBeenCalledTimes(1);
    });

    it('keeps DOM-discovered round count when the engine publishes extra snapshot-only rounds', async () => {
        let onSnapshot: ((snapshot: ReturnType<typeof buildSnapshot> | null) => void) | null = null;
        const adapter = new ChatGPTTestAdapter();
        const engine = {
            getSnapshot: vi.fn(async () => null),
            subscribe: vi.fn((listener: typeof onSnapshot) => {
                onSnapshot = listener;
                return () => undefined;
            }),
        } as any;
        const controller = new ChatGPTDirectoryController(adapter, engine);

        controller.init('light');
        await Promise.resolve();

        onSnapshot?.({
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
            ],
        });

        const railRoot = document.getElementById('aimd-chatgpt-directory-rail')?.shadowRoot;
        const items = Array.from(railRoot?.querySelectorAll<HTMLButtonElement>('.rail__item') ?? []);
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

    it('does not synthesize user-round placeholders from assistant-only messages', () => {
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
        expect(items).toHaveLength(0);
    });

    it('marks the round whose full group range contains the reading reference line as active', () => {
        Object.defineProperty(window, 'innerHeight', { configurable: true, value: 1000 });
        setRoundRects({
            'user-1': [-500, -460],
            'assistant-1': [-450, 240],
            'user-2': [260, 300],
            'assistant-2': [300, 900],
        });
        const adapter = new ChatGPTTestAdapter();
        const engine = { subscribe: vi.fn(() => () => undefined) } as any;
        const controller = new ChatGPTDirectoryController(adapter, engine);

        (controller as any).ensureRail();
        (controller as any).snapshot = buildSnapshot();
        (controller as any).render();

        const railRoot = document.getElementById('aimd-chatgpt-directory-rail')?.shadowRoot;
        const active = railRoot?.querySelector<HTMLElement>('.rail__item[data-active="1"]');
        expect(active?.dataset.position).toBe('2');
    });

    it('uses the nearest round when the reading reference line falls between group ranges', () => {
        Object.defineProperty(window, 'innerHeight', { configurable: true, value: 1000 });
        setRoundRects({
            'user-1': [-500, -460],
            'assistant-1': [-450, 100],
            'user-2': [550, 590],
            'assistant-2': [590, 900],
        });
        const adapter = new ChatGPTTestAdapter();
        const engine = { subscribe: vi.fn(() => () => undefined) } as any;
        const controller = new ChatGPTDirectoryController(adapter, engine);

        (controller as any).ensureRail();
        (controller as any).snapshot = buildSnapshot();
        (controller as any).render();

        const railRoot = document.getElementById('aimd-chatgpt-directory-rail')?.shadowRoot;
        const active = railRoot?.querySelector<HTMLElement>('.rail__item[data-active="1"]');
        expect(active?.dataset.position).toBe('2');
    });

    it('updates active state from the window scroll fallback when the host scroll root is not the event source', async () => {
        Object.defineProperty(window, 'innerHeight', { configurable: true, value: 1000 });
        setRoundRects({
            'user-1': [-500, -460],
            'assistant-1': [-450, 900],
            'user-2': [950, 990],
            'assistant-2': [990, 1300],
        });
        const adapter = new ChatGPTTestAdapter();
        const engine = { getSnapshot: vi.fn(async () => buildSnapshot()), subscribe: vi.fn(() => () => undefined) } as any;
        const controller = new ChatGPTDirectoryController(adapter, engine);

        controller.init('light');
        await Promise.resolve();

        setRoundRects({
            'user-1': [-1000, -960],
            'assistant-1': [-950, 120],
            'user-2': [260, 300],
            'assistant-2': [300, 900],
        });
        window.dispatchEvent(new Event('scroll'));
        await vi.advanceTimersByTimeAsync(20);

        const railRoot = document.getElementById('aimd-chatgpt-directory-rail')?.shadowRoot;
        const active = railRoot?.querySelector<HTMLElement>('.rail__item[data-active="1"]');
        expect(active?.dataset.position).toBe('2');
        controller.dispose();
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

    it('adds separated page-bottom step controls that jump to adjacent active rounds and disable at the ends', async () => {
        buildSkeletonDomWithCount(3);
        const adapter = new ChatGPTTestAdapter();
        const engine = { subscribe: vi.fn(() => () => undefined) } as any;
        const controller = new ChatGPTDirectoryController(adapter, engine);
        const middleAnchor = document.getElementById('user-2') as HTMLElement;
        const tailAnchor = document.getElementById('user-3') as HTMLElement;
        middleAnchor.scrollIntoView = vi.fn();
        tailAnchor.scrollIntoView = vi.fn();

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
            ],
        };
        (controller as any).render();
        (controller as any).activePosition = 2;
        (controller as any).syncStepControls();

        const railRoot = document.getElementById('aimd-chatgpt-directory-rail')?.shadowRoot;
        const stepControls = document.getElementById('aimd-chatgpt-directory-step-controls') as HTMLElement;
        const previous = stepControls?.querySelector<HTMLButtonElement>('[data-action="directory-step-previous"]')!;
        const next = stepControls?.querySelector<HTMLButtonElement>('[data-action="directory-step-next"]')!;

        expect(stepControls?.parentElement).toBe(document.body);
        expect(railRoot?.querySelector('[data-action="directory-step-previous"]')).toBeNull();
        expect(previous.disabled).toBe(false);
        expect(next.disabled).toBe(false);

        next.click();
        await Promise.resolve();
        await vi.advanceTimersByTimeAsync(1000);
        expect(tailAnchor.scrollIntoView).toHaveBeenCalledWith({ behavior: 'auto', block: 'start' });

        (controller as any).activePosition = 3;
        (controller as any).syncStepControls();
        expect(next.disabled).toBe(true);
        expect(previous.disabled).toBe(false);

        previous.click();
        await Promise.resolve();
        await vi.advanceTimersByTimeAsync(1000);
        expect(middleAnchor.scrollIntoView).toHaveBeenCalledWith({ behavior: 'auto', block: 'start' });

        (controller as any).activePosition = 1;
        (controller as any).syncStepControls();
        expect(previous.disabled).toBe(true);
        expect(next.disabled).toBe(false);
    });
});

describe('ChatGPTDirectoryRail active following', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        document.body.innerHTML = '';
    });

    afterEach(() => {
        vi.runOnlyPendingTimers();
        vi.useRealTimers();
        document.body.innerHTML = '';
    });

    it('scrolls the active rail item into view when active position changes', () => {
        const rail = new ChatGPTDirectoryRail('light', vi.fn());
        document.body.appendChild(rail.getElement());
        rail.setRounds(buildSnapshot().rounds);
        const item = rail.getElement().shadowRoot?.querySelector<HTMLElement>('.rail__item[data-position="2"]');
        const scrollIntoView = vi.fn();
        if (item) item.scrollIntoView = scrollIntoView;

        rail.setActivePosition(2);

        expect(scrollIntoView).toHaveBeenCalledWith({ block: 'nearest' });
        rail.dispose();
    });

    it('does not auto-scroll the rail while the user is interacting with it', () => {
        const rail = new ChatGPTDirectoryRail('light', vi.fn());
        document.body.appendChild(rail.getElement());
        rail.setRounds(buildSnapshot().rounds);
        const list = rail.getElement().shadowRoot?.querySelector<HTMLElement>('.rail__list');
        const item = rail.getElement().shadowRoot?.querySelector<HTMLElement>('.rail__item[data-position="2"]');
        const scrollIntoView = vi.fn();
        if (item) item.scrollIntoView = scrollIntoView;

        list?.dispatchEvent(new Event('pointerenter', { bubbles: true }));
        rail.setActivePosition(2);

        expect(scrollIntoView).not.toHaveBeenCalled();
        rail.dispose();
    });
});
