import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/drivers/shared/browser', () => ({
    browser: {
        runtime: {
            getURL: vi.fn((path: string) => `chrome-extension://test/${path}`),
        },
    },
}));

import { ChatGPTConversationEngine } from '@/drivers/content/chatgpt/ChatGPTConversationEngine';

const conversationId = '695499b7-464c-8323-a998-119f661ac953';
let removeBridgeResponder: (() => void) | null = null;

function createAdapter() {
    return {
        getPlatformId: () => 'chatgpt',
        getMessageSelector: () => '[data-message-author-role="assistant"][data-message-id]',
        getMessageContentSelector: () => '.markdown',
        getObserverContainer: () => document.body,
        getMessageId: (el: HTMLElement) => el.getAttribute('data-message-id'),
        extractUserPrompt: () => 'Prompt from adapter',
        getMarkdownParserAdapter: () => null,
    } as any;
}

function makeSnapshot(roundCount: number, capturedAt = 1, id = conversationId) {
    return {
        conversationId: id,
        buildFingerprint: 'build-1',
        capturedAt,
        source: 'runtime-bridge' as const,
        rounds: Array.from({ length: roundCount }, (_, index) => ({
            id: `round-${index + 1}`,
            position: index + 1,
            userPrompt: `Question ${index + 1}`,
            assistantContent: `Answer ${index + 1}`,
            preview: `Question ${index + 1}`,
            messageId: `a${index + 1}`,
            userMessageId: `u${index + 1}`,
            assistantMessageId: `a${index + 1}`,
        })),
    };
}

describe('ChatGPTConversationEngine', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        document.head.innerHTML = '';
        document.body.innerHTML = '';
        history.replaceState({}, '', `/c/${conversationId}`);
        vi.restoreAllMocks();
        Object.defineProperty(document, 'visibilityState', {
            configurable: true,
            value: 'visible',
        });
    });

    afterEach(() => {
        removeBridgeResponder?.();
        removeBridgeResponder = null;
        vi.runOnlyPendingTimers();
        vi.useRealTimers();
    });

    function installBridgeResponder(
        handler: (detail: Record<string, any>) => Record<string, any>
    ): void {
        const listener = ((event: Event) => {
            const detail = (event as CustomEvent<any>).detail;
            const response = handler(detail);
            window.dispatchEvent(new CustomEvent('aimd:chatgpt-conversation-bridge:response', {
                detail: {
                    requestId: detail.requestId,
                    ok: true,
                    ...response,
                },
            }));
        }) as EventListener;
        window.addEventListener('aimd:chatgpt-conversation-bridge:request', listener);
        removeBridgeResponder = () => window.removeEventListener('aimd:chatgpt-conversation-bridge:request', listener);
    }

    it('loads a bridge snapshot once and serves subsequent requests from cache', async () => {
        const appendSpy = vi.spyOn(document.head, 'appendChild').mockImplementation((node: Node) => {
            const script = node as HTMLScriptElement;
            window.setTimeout(() => script.onload?.(new Event('load')), 0);
            return node;
        });
        let requestCount = 0;
        installBridgeResponder((detail) => {
            requestCount += 1;
            return { snapshot: makeSnapshot(1) };
        });

        const engine = new ChatGPTConversationEngine(createAdapter());
        const firstPromise = engine.getSnapshot();
        await vi.runAllTimersAsync();
        const first = await firstPromise;
        const second = await engine.getSnapshot();

        expect(first?.source).toBe('runtime-bridge');
        expect(second).toBe(first);
        expect(requestCount).toBe(1);
        expect(appendSpy).toHaveBeenCalledTimes(1);
    });

    it('force refresh updates the cached snapshot when new rounds arrive', async () => {
        vi.spyOn(document.head, 'appendChild').mockImplementation((node: Node) => {
            const script = node as HTMLScriptElement;
            window.setTimeout(() => script.onload?.(new Event('load')), 0);
            return node;
        });
        let requestCount = 0;
        installBridgeResponder((detail) => {
            requestCount += 1;
            const snapshot = detail.force ? makeSnapshot(2, 2) : makeSnapshot(1, 1);
            return { snapshot };
        });

        const engine = new ChatGPTConversationEngine(createAdapter());
        const firstPromise = engine.getSnapshot();
        await vi.runAllTimersAsync();
        const first = await firstPromise;

        const refreshedPromise = (engine as any).refreshCurrentConversation({ force: true });
        await vi.runAllTimersAsync();
        const refreshed = await refreshedPromise;

        expect(first?.rounds).toHaveLength(1);
        expect(refreshed?.rounds).toHaveLength(2);
        expect((await engine.getSnapshot())?.rounds).toHaveLength(2);
        expect(requestCount).toBe(2);
    });

    it('treats SPA conversation changes as stale and force-refreshes the next snapshot', async () => {
        vi.spyOn(document.head, 'appendChild').mockImplementation((node: Node) => {
            const script = node as HTMLScriptElement;
            window.setTimeout(() => script.onload?.(new Event('load')), 0);
            return node;
        });
        const nextConversationId = '795499b7-464c-8323-a998-119f661ac954';
        const requests: Array<{ conversationId: string; force: boolean }> = [];
        installBridgeResponder((detail) => {
            requests.push({ conversationId: detail.conversationId, force: Boolean(detail.force) });
            return { snapshot: makeSnapshot(detail.conversationId === nextConversationId ? 2 : 1, requests.length, detail.conversationId) };
        });

        const engine = new ChatGPTConversationEngine(createAdapter());
        const firstPromise = engine.getSnapshot();
        await vi.runAllTimersAsync();
        await firstPromise;

        const prevUrl = window.location.href;
        history.replaceState({}, '', `/c/${nextConversationId}`);
        const routePromise = (engine as any).handleRouteChange(window.location.href, prevUrl);
        await vi.runAllTimersAsync();
        await routePromise;
        const next = await engine.getSnapshot();

        expect(next?.conversationId).toBe(nextConversationId);
        expect(next?.rounds).toHaveLength(2);
        expect(requests).toEqual([
            { conversationId, force: false },
            { conversationId: nextConversationId, force: true },
        ]);
    });

    it('force-refreshes the current conversation when ChatGPT fetches conversation payload again', async () => {
        vi.spyOn(document.head, 'appendChild').mockImplementation((node: Node) => {
            const script = node as HTMLScriptElement;
            window.setTimeout(() => script.onload?.(new Event('load')), 0);
            return node;
        });
        const requests: boolean[] = [];
        installBridgeResponder((detail) => {
            requests.push(Boolean(detail.force));
            return { snapshot: makeSnapshot(detail.force ? 2 : 1, requests.length) };
        });

        const engine = new ChatGPTConversationEngine(createAdapter());
        const firstPromise = engine.getSnapshot();
        await vi.runAllTimersAsync();
        await firstPromise;

        (engine as any).handleConversationFetch(new CustomEvent('aimd:chatgpt-conversation-fetch', {
            detail: { url: `https://chatgpt.com/backend-api/conversation/${conversationId}` },
        }));
        await vi.runAllTimersAsync();

        expect((await engine.getSnapshot())?.rounds).toHaveLength(2);
        expect(requests).toContain(true);
    });

    it('does not notify subscribers when force refresh returns equivalent content', async () => {
        vi.spyOn(document.head, 'appendChild').mockImplementation((node: Node) => {
            const script = node as HTMLScriptElement;
            window.setTimeout(() => script.onload?.(new Event('load')), 0);
            return node;
        });
        let capturedAt = 1;
        installBridgeResponder(() => ({ snapshot: makeSnapshot(1, capturedAt++) }));

        const engine = new ChatGPTConversationEngine(createAdapter());
        const listener = vi.fn();
        (engine as any).subscribers.add(listener);

        const firstPromise = (engine as any).refreshCurrentConversation({ force: true });
        await vi.runAllTimersAsync();
        await firstPromise;

        const secondPromise = (engine as any).refreshCurrentConversation({ force: true });
        await vi.runAllTimersAsync();
        await secondPromise;

        expect(listener).toHaveBeenCalledTimes(1);
    });

    it('starts live refresh while subscribed and stops it after unsubscribe', async () => {
        const engine = new ChatGPTConversationEngine(createAdapter());
        const unsubscribe = engine.subscribe(vi.fn());
        const timerId = (engine as any).liveRefreshTimer;

        expect(timerId).not.toBeNull();
        unsubscribe();

        expect((engine as any).liveRefreshTimer).toBeNull();
    });

    it('falls back to DOM extraction if the bridge script fails to load', async () => {
        vi.spyOn(document.head, 'appendChild').mockImplementation((node: Node) => {
            const script = node as HTMLScriptElement;
            window.setTimeout(() => script.onerror?.(new Event('error')), 0);
            return node;
        });
        document.body.innerHTML = `
          <article data-turn="user">
            <div data-message-author-role="user"><div class="whitespace-pre-wrap">Prompt</div></div>
          </article>
          <article data-turn="assistant">
            <div data-message-author-role="assistant" data-message-id="a1">
              <div class="markdown prose">Answer</div>
            </div>
          </article>
        `;

        const engine = new ChatGPTConversationEngine(createAdapter());
        const snapshotPromise = engine.getSnapshot();
        await vi.runAllTimersAsync();
        const snapshot = await snapshotPromise;

        expect(snapshot?.source).toBe('dom');
        expect(snapshot?.rounds).toHaveLength(1);
        expect(snapshot?.rounds[0]).toEqual(expect.objectContaining({
            position: 1,
            messageId: 'a1',
        }));
    });
});
