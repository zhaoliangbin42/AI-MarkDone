import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const browserMockState = vi.hoisted(() => ({
    isFirefox: false,
}));

vi.mock('@/drivers/shared/browser', () => ({
    browser: {
        runtime: {
            getURL: vi.fn((path: string) => `chrome-extension://test/${path}`),
        },
    },
    browserInfo: {
        get isFirefox() {
            return browserMockState.isFirefox;
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
        origin: 'conversation-graph' as const,
        coverage: 'complete' as const,
        branchKey: `branch-${roundCount}`,
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
        browserMockState.isFirefox = false;
    });

    afterEach(() => {
        removeBridgeResponder?.();
        removeBridgeResponder = null;
        vi.runOnlyPendingTimers();
        vi.useRealTimers();
    });

    function installBridgeResponder(
        handler: (detail: Record<string, any>) => Record<string, any>,
        onRawDetail?: (detail: unknown) => void,
    ): void {
        const listener = ((event: Event) => {
            const rawDetail = (event as CustomEvent<any>).detail;
            onRawDetail?.(rawDetail);
            const detail = typeof rawDetail === 'string' ? JSON.parse(rawDetail) : rawDetail;
            const response = handler(detail);
            const payload = {
                requestId: detail.requestId,
                ok: true,
                ...response,
            };
            window.dispatchEvent(new CustomEvent('aimd:chatgpt-conversation-bridge:response', {
                detail: typeof rawDetail === 'string' ? JSON.stringify(payload) : payload,
            }));
        }) as EventListener;
        window.addEventListener('aimd:chatgpt-conversation-bridge:request', listener);
        removeBridgeResponder = () => window.removeEventListener('aimd:chatgpt-conversation-bridge:request', listener);
    }

    it('dispatches object bridge detail on the default Chrome-compatible path', async () => {
        vi.spyOn(document.head, 'appendChild').mockImplementation((node: Node) => {
            const script = node as HTMLScriptElement;
            window.setTimeout(() => script.onload?.(new Event('load')), 0);
            return node;
        });
        const rawDetails: unknown[] = [];
        installBridgeResponder(() => ({ snapshot: makeSnapshot(1) }), (detail) => rawDetails.push(detail));

        const engine = new ChatGPTConversationEngine(createAdapter());
        const snapshotPromise = engine.getSnapshot();
        await vi.runAllTimersAsync();
        const snapshot = await snapshotPromise;

        expect(snapshot?.source).toBe('runtime-bridge');
        expect(rawDetails).toHaveLength(1);
        expect(typeof rawDetails[0]).toBe('object');
        expect(rawDetails[0]).toMatchObject({ type: 'snapshot', conversationId, force: false });
    });

    it('dispatches string bridge detail and parses string responses on Firefox', async () => {
        browserMockState.isFirefox = true;
        vi.spyOn(document.head, 'appendChild').mockImplementation((node: Node) => {
            const script = node as HTMLScriptElement;
            window.setTimeout(() => script.onload?.(new Event('load')), 0);
            return node;
        });
        const rawDetails: unknown[] = [];
        installBridgeResponder(() => ({ snapshot: makeSnapshot(1) }), (detail) => rawDetails.push(detail));

        const engine = new ChatGPTConversationEngine(createAdapter());
        const snapshotPromise = engine.getSnapshot();
        await vi.runAllTimersAsync();
        const snapshot = await snapshotPromise;

        expect(snapshot?.source).toBe('runtime-bridge');
        expect(rawDetails).toHaveLength(1);
        expect(typeof rawDetails[0]).toBe('string');
        expect(JSON.parse(rawDetails[0] as string)).toMatchObject({ type: 'snapshot', conversationId, force: false });
    });

    it('resolves null for malformed Firefox bridge responses without throwing', async () => {
        browserMockState.isFirefox = true;
        vi.spyOn(document.head, 'appendChild').mockImplementation((node: Node) => {
            const script = node as HTMLScriptElement;
            window.setTimeout(() => script.onload?.(new Event('load')), 0);
            return node;
        });
        const listener = ((event: Event) => {
            const detail = JSON.parse((event as CustomEvent<string>).detail);
            window.dispatchEvent(new CustomEvent('aimd:chatgpt-conversation-bridge:response', {
                detail: `{"requestId":"${detail.requestId}",`,
            }));
        }) as EventListener;
        window.addEventListener('aimd:chatgpt-conversation-bridge:request', listener);
        removeBridgeResponder = () => window.removeEventListener('aimd:chatgpt-conversation-bridge:request', listener);

        const engine = new ChatGPTConversationEngine(createAdapter());
        const snapshotPromise = engine.getSnapshot();
        await vi.runAllTimersAsync();
        const snapshot = await snapshotPromise;

        expect(snapshot).toBeNull();
    });

    it('calls requestIdleCallback with window binding for Firefox', () => {
        const originalRequestIdleCallback = window.requestIdleCallback;
        const requestIdleCallback = vi.fn(function (this: unknown, callback: IdleRequestCallback) {
            expect(this).toBe(window);
            window.setTimeout(() => callback({ didTimeout: false, timeRemaining: () => 0 }), 0);
            return 1;
        });
        (window as any).requestIdleCallback = requestIdleCallback;

        try {
            const engine = new ChatGPTConversationEngine(createAdapter());
            engine.init();

            expect(requestIdleCallback).toHaveBeenCalledTimes(1);
        } finally {
            (window as any).requestIdleCallback = originalRequestIdleCallback;
        }
    });

    it('refreshes only the current route when the passive bridge captures a graph', async () => {
        const originalRequestIdleCallback = window.requestIdleCallback;
        (window as any).requestIdleCallback = vi.fn(() => 1);
        let requestCount = 0;
        installBridgeResponder(() => {
            requestCount += 1;
            return { snapshot: makeSnapshot(requestCount, requestCount) };
        });
        const engine = new ChatGPTConversationEngine(createAdapter());

        try {
            engine.init();
            window.dispatchEvent(new CustomEvent('aimd:chatgpt-conversation-bridge:capture', {
                detail: JSON.stringify({ conversationId: 'another-conversation' }),
            }));
            await Promise.resolve();
            expect(requestCount).toBe(0);

            window.dispatchEvent(new CustomEvent('aimd:chatgpt-conversation-bridge:capture', {
                detail: JSON.stringify({ conversationId }),
            }));
            await Promise.resolve();
            await Promise.resolve();

            expect(requestCount).toBe(1);
            expect(engine.peekCurrentSnapshot()?.rounds).toHaveLength(1);
        } finally {
            engine.dispose();
            (window as any).requestIdleCallback = originalRequestIdleCallback;
        }
    });

    it('re-reads the bridge when a newer capture arrives during an in-flight forced snapshot', async () => {
        const originalRequestIdleCallback = window.requestIdleCallback;
        (window as any).requestIdleCallback = vi.fn(() => 1);
        const requests: Array<Record<string, any>> = [];
        const listener = ((event: Event) => {
            const detail = (event as CustomEvent<Record<string, any>>).detail;
            requests.push(detail);
            if (requests.length !== 2) return;
            window.dispatchEvent(new CustomEvent('aimd:chatgpt-conversation-bridge:response', {
                detail: {
                    requestId: detail.requestId,
                    ok: true,
                    snapshot: makeSnapshot(2, 2),
                },
            }));
        }) as EventListener;
        window.addEventListener('aimd:chatgpt-conversation-bridge:request', listener);
        removeBridgeResponder = () => window.removeEventListener('aimd:chatgpt-conversation-bridge:request', listener);
        const engine = new ChatGPTConversationEngine(createAdapter());

        try {
            engine.init();
            window.dispatchEvent(new CustomEvent('aimd:chatgpt-conversation-bridge:capture', {
                detail: JSON.stringify({ conversationId }),
            }));
            expect(requests).toHaveLength(1);

            window.dispatchEvent(new CustomEvent('aimd:chatgpt-conversation-bridge:capture', {
                detail: JSON.stringify({ conversationId }),
            }));
            expect(requests).toHaveLength(1);

            const first = requests[0]!;
            window.dispatchEvent(new CustomEvent('aimd:chatgpt-conversation-bridge:response', {
                detail: {
                    requestId: first.requestId,
                    ok: true,
                    snapshot: makeSnapshot(1, 1),
                },
            }));
            for (let index = 0; index < 8; index += 1) await Promise.resolve();

            expect(requests).toHaveLength(2);
            expect(engine.peekCurrentSnapshot()?.rounds).toHaveLength(2);
        } finally {
            engine.dispose();
            (window as any).requestIdleCallback = originalRequestIdleCallback;
        }
    });

    it('reads the declarative bridge snapshot once and serves subsequent requests from cache', async () => {
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

    it('publishes a complete live DOM tail through the canonical snapshot', async () => {
        installBridgeResponder(() => ({ snapshot: makeSnapshot(1) }));
        const engine = new ChatGPTConversationEngine(createAdapter());
        const initialPromise = engine.getSnapshot();
        await vi.runAllTimersAsync();
        await initialPromise;
        const listener = vi.fn();
        engine.subscribe(listener, { live: false });
        listener.mockClear();

        const updated = engine.applyLiveDomTail('branch-1', [{
            id: 'round-2',
            position: 2,
            userPrompt: 'Question 2',
            assistantContent: '**Answer 2**',
            preview: 'Question 2',
            messageId: 'a2',
            userMessageId: 'u2',
            assistantMessageId: 'a2',
        }]);

        expect(updated?.rounds).toHaveLength(2);
        expect(updated?.branchKey).toBe('a2');
        expect(engine.peekCurrentSnapshot()).toBe(updated);
        expect(listener).toHaveBeenCalledWith(updated);
    });

    it('keeps a verified live tail when the passive graph cache still returns its exact prefix', async () => {
        installBridgeResponder(() => ({ snapshot: makeSnapshot(1) }));
        const engine = new ChatGPTConversationEngine(createAdapter());
        const initialPromise = engine.getSnapshot();
        await vi.runAllTimersAsync();
        await initialPromise;
        const live = engine.applyLiveDomTail('branch-1', [{
            id: 'round-2',
            position: 2,
            userPrompt: 'Question 2',
            assistantContent: 'Answer 2',
            preview: 'Question 2',
            messageId: 'a2',
            userMessageId: 'u2',
            assistantMessageId: 'a2',
        }]);

        const refreshedPromise = engine.forceRefreshCurrentConversation();
        await vi.runAllTimersAsync();
        const refreshed = await refreshedPromise;

        expect(refreshed).toBe(live);
        expect(refreshed?.rounds).toHaveLength(2);
    });

    it('starts a distinct forced request when a non-forced snapshot request is already in flight', async () => {
        vi.spyOn(document.head, 'appendChild').mockImplementation((node: Node) => {
            const script = node as HTMLScriptElement;
            window.setTimeout(() => script.onload?.(new Event('load')), 0);
            return node;
        });
        const requests: boolean[] = [];
        const listener = ((event: Event) => {
            const detail = (event as CustomEvent<Record<string, any>>).detail;
            requests.push(Boolean(detail.force));
            const snapshot = detail.force ? makeSnapshot(2, 2) : makeSnapshot(1, 1);
            window.setTimeout(() => {
                window.dispatchEvent(new CustomEvent('aimd:chatgpt-conversation-bridge:response', {
                    detail: {
                        requestId: detail.requestId,
                        ok: true,
                        snapshot,
                    },
                }));
            }, detail.force ? 0 : 50);
        }) as EventListener;
        window.addEventListener('aimd:chatgpt-conversation-bridge:request', listener);
        removeBridgeResponder = () => window.removeEventListener('aimd:chatgpt-conversation-bridge:request', listener);

        const engine = new ChatGPTConversationEngine(createAdapter());
        const passivePromise = engine.getSnapshot();
        await vi.advanceTimersByTimeAsync(0);
        const forcedPromise = engine.forceRefreshCurrentConversation();
        await vi.runAllTimersAsync();
        const passive = await passivePromise;
        const forced = await forcedPromise;

        expect(requests).toEqual([false, true]);
        expect(passive).toBe(forced);
        expect(passive?.rounds).toHaveLength(2);
        expect(forced?.rounds).toHaveLength(2);
        expect(engine.peekCurrentSnapshot()?.rounds).toHaveLength(2);
    });

    it('makes a newer forced caller wait for the capture revision that superseded an in-flight request', async () => {
        const requests: Array<Record<string, any>> = [];
        const listener = ((event: Event) => {
            const detail = (event as CustomEvent<Record<string, any>>).detail;
            requests.push(detail);
            if (requests.length !== 2) return;
            window.dispatchEvent(new CustomEvent('aimd:chatgpt-conversation-bridge:response', {
                detail: {
                    requestId: detail.requestId,
                    ok: true,
                    snapshot: makeSnapshot(2, 2),
                },
            }));
        }) as EventListener;
        window.addEventListener('aimd:chatgpt-conversation-bridge:request', listener);
        removeBridgeResponder = () => window.removeEventListener('aimd:chatgpt-conversation-bridge:request', listener);

        const engine = new ChatGPTConversationEngine(createAdapter());
        const firstForced = engine.forceRefreshCurrentConversation();
        const secondForced = engine.forceRefreshCurrentConversation();
        expect(requests).toHaveLength(1);

        window.dispatchEvent(new CustomEvent('aimd:chatgpt-conversation-bridge:response', {
            detail: {
                requestId: requests[0]!.requestId,
                ok: true,
                snapshot: makeSnapshot(1, 1),
            },
        }));
        for (let index = 0; index < 8; index += 1) await Promise.resolve();

        await expect(firstForced).resolves.toBeNull();
        await expect(secondForced).resolves.toMatchObject({ rounds: expect.arrayContaining([expect.objectContaining({ position: 2 })]) });
        expect(requests).toHaveLength(2);
        expect(engine.peekCurrentSnapshot()?.rounds).toHaveLength(2);
    });

    it('keeps the verified graph snapshot when a refresh returns a partial semantic candidate', async () => {
        vi.spyOn(document.head, 'appendChild').mockImplementation((node: Node) => {
            const script = node as HTMLScriptElement;
            window.setTimeout(() => script.onload?.(new Event('load')), 0);
            return node;
        });
        let requestCount = 0;
        installBridgeResponder(() => {
            requestCount += 1;
            if (requestCount === 1) return { snapshot: makeSnapshot(3, 1) };
            return {
                snapshot: {
                    ...makeSnapshot(1, 2),
                    origin: 'legacy-unverified',
                    coverage: 'partial',
                    branchKey: null,
                },
            };
        });

        const engine = new ChatGPTConversationEngine(createAdapter());
        const initialPromise = engine.getSnapshot();
        await vi.runAllTimersAsync();
        const initial = await initialPromise;
        const refreshedPromise = engine.forceRefreshCurrentConversation();
        await vi.runAllTimersAsync();
        const refreshed = await refreshedPromise;

        expect(initial?.rounds).toHaveLength(3);
        expect(refreshed).toBe(initial);
        expect(engine.peekCurrentSnapshot()).toBe(initial);
    });

    it('retries a stale refresh when the failed request falls back to the previous snapshot', async () => {
        vi.spyOn(document.head, 'appendChild').mockImplementation((node: Node) => {
            const script = node as HTMLScriptElement;
            window.setTimeout(() => script.onload?.(new Event('load')), 0);
            return node;
        });
        let requestCount = 0;
        installBridgeResponder(() => {
            requestCount += 1;
            if (requestCount === 1) return { snapshot: makeSnapshot(1, 1) };
            if (requestCount === 2) return {};
            return { snapshot: makeSnapshot(2, 3) };
        });

        const engine = new ChatGPTConversationEngine(createAdapter());
        const initialPromise = engine.getSnapshot();
        await vi.runAllTimersAsync();
        const initial = await initialPromise;

        const fallback = await engine.forceRefreshCurrentConversation();

        expect(fallback).toBe(initial);
        expect(requestCount).toBe(2);
        await vi.advanceTimersByTimeAsync(499);
        expect(requestCount).toBe(2);
        await vi.advanceTimersByTimeAsync(1);
        expect(requestCount).toBe(3);
        expect(engine.peekCurrentSnapshot()?.rounds).toHaveLength(2);
    });

    it('resumes a stale retry when a hidden conversation becomes visible again', async () => {
        vi.spyOn(document.head, 'appendChild').mockImplementation((node: Node) => {
            const script = node as HTMLScriptElement;
            window.setTimeout(() => script.onload?.(new Event('load')), 0);
            return node;
        });
        let requestCount = 0;
        installBridgeResponder(() => {
            requestCount += 1;
            if (requestCount === 1) return { snapshot: makeSnapshot(1, 1) };
            if (requestCount === 2) return {};
            return { snapshot: makeSnapshot(2, 3) };
        });

        const engine = new ChatGPTConversationEngine(createAdapter());
        const initialPromise = engine.getSnapshot();
        await vi.runAllTimersAsync();
        await initialPromise;
        await engine.forceRefreshCurrentConversation();
        Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' });

        await vi.advanceTimersByTimeAsync(500);
        expect(requestCount).toBe(2);

        Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
        document.dispatchEvent(new Event('visibilitychange'));
        await vi.runAllTimersAsync();

        expect(requestCount).toBe(3);
        expect(engine.peekCurrentSnapshot()?.rounds).toHaveLength(2);
        engine.dispose();
    });

    it('accepts a shorter verified snapshot when the active graph branch changes', async () => {
        vi.spyOn(document.head, 'appendChild').mockImplementation((node: Node) => {
            const script = node as HTMLScriptElement;
            window.setTimeout(() => script.onload?.(new Event('load')), 0);
            return node;
        });
        let requestCount = 0;
        installBridgeResponder(() => {
            requestCount += 1;
            return { snapshot: requestCount === 1 ? makeSnapshot(3, 1) : makeSnapshot(1, 2) };
        });

        const engine = new ChatGPTConversationEngine(createAdapter());
        const initialPromise = engine.getSnapshot();
        await vi.runAllTimersAsync();
        const initial = await initialPromise;
        const refreshedPromise = engine.forceRefreshCurrentConversation();
        await vi.runAllTimersAsync();
        const refreshed = await refreshedPromise;

        expect(initial?.branchKey).toBe('branch-3');
        expect(refreshed?.branchKey).toBe('branch-1');
        expect(refreshed?.rounds).toHaveLength(1);
        expect(engine.peekCurrentSnapshot()).toBe(refreshed);
    });

    it('rejects a graph snapshot that identifies a different conversation', async () => {
        vi.spyOn(document.head, 'appendChild').mockImplementation((node: Node) => {
            const script = node as HTMLScriptElement;
            window.setTimeout(() => script.onload?.(new Event('load')), 0);
            return node;
        });
        const otherConversationId = '795499b7-464c-8323-a998-119f661ac954';
        installBridgeResponder(() => ({ snapshot: makeSnapshot(1, 1, otherConversationId) }));

        const engine = new ChatGPTConversationEngine(createAdapter());
        const snapshotPromise = engine.getSnapshot();
        await vi.runAllTimersAsync();
        const snapshot = await snapshotPromise;

        expect(snapshot).toBeNull();
        expect(engine.peekCurrentSnapshot()).toBeNull();
    });

    it('rejects a candidate that labels an empty round list as a complete graph', async () => {
        vi.spyOn(document.head, 'appendChild').mockImplementation((node: Node) => {
            const script = node as HTMLScriptElement;
            window.setTimeout(() => script.onload?.(new Event('load')), 0);
            return node;
        });
        installBridgeResponder(() => ({
            snapshot: {
                ...makeSnapshot(1),
                rounds: [],
            },
        }));

        const engine = new ChatGPTConversationEngine(createAdapter());
        const snapshotPromise = engine.getSnapshot();
        await vi.runAllTimersAsync();
        const snapshot = await snapshotPromise;

        expect(snapshot).toBeNull();
        expect(engine.peekCurrentSnapshot()).toBeNull();
    });

    it('rejects a complete graph candidate whose round positions are not canonical and contiguous', async () => {
        vi.spyOn(document.head, 'appendChild').mockImplementation((node: Node) => {
            const script = node as HTMLScriptElement;
            window.setTimeout(() => script.onload?.(new Event('load')), 0);
            return node;
        });
        const malformed = makeSnapshot(2);
        malformed.rounds[1]!.position = 7;
        installBridgeResponder(() => ({ snapshot: malformed }));

        const engine = new ChatGPTConversationEngine(createAdapter());
        const snapshotPromise = engine.getSnapshot();
        await vi.runAllTimersAsync();
        const snapshot = await snapshotPromise;

        expect(snapshot).toBeNull();
        expect(engine.peekCurrentSnapshot()).toBeNull();
    });

    it('rejects malformed or ambiguous round DTO fields at the content-world boundary', async () => {
        vi.spyOn(document.head, 'appendChild').mockImplementation((node: Node) => {
            const script = node as HTMLScriptElement;
            window.setTimeout(() => script.onload?.(new Event('load')), 0);
            return node;
        });
        const invalidText = makeSnapshot(1) as any;
        invalidText.rounds[0].userPrompt = 42;
        const duplicateIdentity = makeSnapshot(2);
        duplicateIdentity.rounds[1]!.assistantMessageId = duplicateIdentity.rounds[0]!.assistantMessageId;
        duplicateIdentity.rounds[1]!.messageId = duplicateIdentity.rounds[0]!.messageId;
        const mismatchedAlias = makeSnapshot(1);
        mismatchedAlias.rounds[0]!.messageId = 'unrelated-message';
        const invalidTimestamp = makeSnapshot(1);
        invalidTimestamp.capturedAt = Number.NaN;
        const candidates = [invalidText, duplicateIdentity, mismatchedAlias, invalidTimestamp];
        let requestIndex = 0;
        installBridgeResponder(() => ({ snapshot: candidates[requestIndex++] }));

        for (const _candidate of candidates) {
            const engine = new ChatGPTConversationEngine(createAdapter());
            const snapshotPromise = engine.getSnapshot();
            await vi.runAllTimersAsync();
            await expect(snapshotPromise).resolves.toBeNull();
            expect(engine.peekCurrentSnapshot()).toBeNull();
        }
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

    it('clears subscribers immediately when the route changes before the new graph arrives', async () => {
        vi.spyOn(document.head, 'appendChild').mockImplementation((node: Node) => {
            const script = node as HTMLScriptElement;
            window.setTimeout(() => script.onload?.(new Event('load')), 0);
            return node;
        });
        const nextConversationId = '795499b7-464c-8323-a998-119f661ac954';
        installBridgeResponder((detail) => ({
            snapshot: makeSnapshot(1, 1, detail.conversationId),
        }));
        const engine = new ChatGPTConversationEngine(createAdapter());
        const initialPromise = engine.getSnapshot();
        await vi.runAllTimersAsync();
        await initialPromise;
        const listener = vi.fn();
        (engine as any).subscribers.add(listener);
        document.body.innerHTML = '<main data-old-conversation="true">Old conversation still mounted</main>';

        const previousUrl = window.location.href;
        history.replaceState({}, '', `/c/${nextConversationId}`);
        (engine as any).handleRouteChange(window.location.href, previousUrl);

        expect(listener).toHaveBeenCalledTimes(1);
        expect(listener).toHaveBeenLastCalledWith(null);

        await vi.runAllTimersAsync();
    });

    it('does not publish an old conversation request that completes after a route change', async () => {
        vi.spyOn(document.head, 'appendChild').mockImplementation((node: Node) => {
            const script = node as HTMLScriptElement;
            window.setTimeout(() => script.onload?.(new Event('load')), 0);
            return node;
        });
        const nextConversationId = '795499b7-464c-8323-a998-119f661ac954';
        const listener = ((event: Event) => {
            const detail = (event as CustomEvent<Record<string, any>>).detail;
            const isOldConversation = detail.conversationId === conversationId;
            window.setTimeout(() => {
                window.dispatchEvent(new CustomEvent('aimd:chatgpt-conversation-bridge:response', {
                    detail: {
                        requestId: detail.requestId,
                        ok: true,
                        snapshot: makeSnapshot(1, isOldConversation ? 1 : 2, detail.conversationId),
                    },
                }));
            }, isOldConversation ? 50 : 100);
        }) as EventListener;
        window.addEventListener('aimd:chatgpt-conversation-bridge:request', listener);
        removeBridgeResponder = () => window.removeEventListener('aimd:chatgpt-conversation-bridge:request', listener);

        const engine = new ChatGPTConversationEngine(createAdapter());
        const snapshotListener = vi.fn();
        (engine as any).subscribers.add(snapshotListener);
        const oldRequest = engine.getSnapshot();
        await vi.advanceTimersByTimeAsync(0);

        const previousUrl = window.location.href;
        history.replaceState({}, '', `/c/${nextConversationId}`);
        (engine as any).handleRouteChange(window.location.href, previousUrl);
        expect(snapshotListener).toHaveBeenLastCalledWith(null);

        await vi.advanceTimersByTimeAsync(50);
        await oldRequest;
        expect(snapshotListener).toHaveBeenCalledTimes(1);
        expect(snapshotListener).toHaveBeenLastCalledWith(null);

        await vi.advanceTimersByTimeAsync(50);
        expect(snapshotListener).toHaveBeenLastCalledWith(expect.objectContaining({
            conversationId: nextConversationId,
        }));
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

    it('notifies subscribers when the active branch changes with equivalent round content', async () => {
        vi.spyOn(document.head, 'appendChild').mockImplementation((node: Node) => {
            const script = node as HTMLScriptElement;
            window.setTimeout(() => script.onload?.(new Event('load')), 0);
            return node;
        });
        let requestCount = 0;
        installBridgeResponder(() => {
            requestCount += 1;
            return {
                snapshot: {
                    ...makeSnapshot(1, requestCount),
                    branchKey: requestCount === 1 ? 'leaf-original' : 'leaf-regenerated',
                },
            };
        });
        const engine = new ChatGPTConversationEngine(createAdapter());
        const listener = vi.fn();
        (engine as any).subscribers.add(listener);

        const firstPromise = engine.getSnapshot();
        await vi.runAllTimersAsync();
        await firstPromise;
        const secondPromise = engine.forceRefreshCurrentConversation();
        await vi.runAllTimersAsync();
        const second = await secondPromise;

        expect(second?.branchKey).toBe('leaf-regenerated');
        expect(listener).toHaveBeenCalledTimes(2);
    });

    it('starts live refresh while subscribed and stops it after unsubscribe', async () => {
        const setIntervalSpy = vi.spyOn(window, 'setInterval');
        const engine = new ChatGPTConversationEngine(createAdapter());
        const unsubscribe = engine.subscribe(vi.fn());
        const timerId = (engine as any).liveRefreshTimer;

        expect(timerId).not.toBeNull();
        expect(setIntervalSpy).toHaveBeenCalledWith(expect.any(Function), 5000);
        unsubscribe();

        expect((engine as any).liveRefreshTimer).toBeNull();
    });

    it('allows passive subscribers to observe cached snapshots without starting live refresh', async () => {
        const setIntervalSpy = vi.spyOn(window, 'setInterval');
        const engine = new ChatGPTConversationEngine(createAdapter());
        const unsubscribe = (engine as any).subscribe(vi.fn(), { live: false });

        expect((engine as any).liveRefreshTimer).toBeNull();
        expect(setIntervalSpy).not.toHaveBeenCalledWith(expect.any(Function), 5000);

        unsubscribe();
    });

    it('does not synthesize a markdown snapshot from DOM text when no graph was captured', async () => {
        document.body.innerHTML = `
          <article data-turn="user">
            <div data-message-author-role="user"><div class="whitespace-pre-wrap">Prompt</div></div>
          </article>
          <article data-turn="assistant">
            <div data-message-author-role="assistant" data-message-id="a1">
              <div class="markdown prose">
                Answer
                <span class="katex">
                  <span class="katex-html">visible rendered formula</span>
                  <annotation encoding="application/x-tex">x = y</annotation>
                </span>
              </div>
            </div>
          </article>
        `;

        const engine = new ChatGPTConversationEngine(createAdapter());
        const snapshotPromise = engine.getSnapshot();
        await vi.runAllTimersAsync();
        const snapshot = await snapshotPromise;

        expect(snapshot).toBeNull();
    });

    it('does not publish structured React content when the graph bridge is unavailable', async () => {
        document.body.innerHTML = `
          <article data-turn="user">
            <div data-message-author-role="user"><div class="whitespace-pre-wrap">Prompt 1</div></div>
          </article>
          <article data-turn="assistant">
            <div data-message-author-role="assistant" data-message-id="a1">
              <div class="markdown prose">Answer 1</div>
            </div>
          </article>
          <article data-turn="user">
            <div data-message-author-role="user"><div class="whitespace-pre-wrap">Prompt 2</div></div>
          </article>
          <article data-turn="assistant">
            <div data-message-author-role="assistant" data-message-id="a2">
              <div class="markdown prose">Answer 2</div>
            </div>
          </article>
        `;
        const firstAssistant = document.querySelector<HTMLElement>('[data-message-id="a1"]')!;
        (firstAssistant as any).__reactFiber$aimd = {
            pendingProps: {
                turn: {
                    id: 'react-turn-1',
                    author: { role: 'assistant' },
                    messages: [{ id: 'a1', author: { role: 'assistant' }, content: { parts: ['React answer 1'] } }],
                },
                parentPromptMessage: {
                    id: 'u1',
                    author: { role: 'user' },
                    content: { parts: ['React prompt 1'] },
                },
            },
            return: null,
        };

        const engine = new ChatGPTConversationEngine(createAdapter());
        const snapshotPromise = engine.getSnapshot();
        await vi.runAllTimersAsync();
        const snapshot = await snapshotPromise;

        expect(snapshot).toBeNull();
    });

    it('does not publish hidden-message-filtered React data as a complete graph', async () => {
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
              <div class="markdown prose">Visible answer</div>
            </div>
          </article>
        `;
        const assistant = document.querySelector<HTMLElement>('[data-message-id="a1"]')!;
        (assistant as any).__reactFiber$aimd = {
            pendingProps: {
                turn: {
                    id: 'react-turn-1',
                    messages: [
                        {
                            id: 'hidden-file-context',
                            author: { role: 'tool' },
                            metadata: { is_visually_hidden_from_conversation: true },
                            content: {
                                content_type: 'text',
                                parts: ['Uploaded file full text that should not be shown'],
                            },
                        },
                        {
                            id: 'a1',
                            author: { role: 'assistant' },
                            content: {
                                content_type: 'text',
                                parts: ['Visible answer'],
                            },
                        },
                    ],
                },
                parentPromptMessage: {
                    id: 'u1',
                    author: { role: 'user' },
                    content: { content_type: 'text', parts: ['Prompt'] },
                },
            },
            return: null,
        };

        const engine = new ChatGPTConversationEngine(createAdapter());
        const snapshotPromise = engine.getSnapshot();
        await vi.runAllTimersAsync();
        const snapshot = await snapshotPromise;

        expect(snapshot).toBeNull();
    });

    it('does not treat structured turn containers as complete when visible DOM is virtualized', async () => {
        vi.spyOn(document.head, 'appendChild').mockImplementation((node: Node) => {
            const script = node as HTMLScriptElement;
            window.setTimeout(() => script.onerror?.(new Event('error')), 0);
            return node;
        });
        document.body.innerHTML = `
          <main>
            <div data-turn-id-container id="u1"></div>
            <div data-turn-id-container id="a1"></div>
            <div data-turn-id-container id="u2"></div>
            <div data-turn-id-container id="a2"></div>
            <div data-message-author-role="assistant" data-message-id="visible-a2">
              <div class="markdown prose">Only visible answer</div>
            </div>
          </main>
        `;
        const attachTurn = (id: string, turn: Record<string, unknown>) => {
            const element = document.getElementById(id) as any;
            element.__reactFiber$aimd = {
                pendingProps: { value: { currentTurn: turn } },
                return: null,
            };
        };
        attachTurn('u1', {
            id: 'turn-u1',
            author: { role: 'user' },
            messages: [{ id: 'u1-message', author: { role: 'user' }, content: { content_type: 'text', parts: ['Question 1'] } }],
        });
        attachTurn('a1', {
            id: 'turn-a1',
            author: { role: 'assistant' },
            messages: [
                {
                    id: 'hidden-tool',
                    author: { role: 'tool' },
                    metadata: { is_visually_hidden_from_conversation: true },
                    content: { content_type: 'text', parts: ['Hidden upload text'] },
                },
                { id: 'a1-message', author: { role: 'assistant' }, content: { content_type: 'text', parts: ['Answer 1'] } },
            ],
        });
        attachTurn('u2', {
            id: 'turn-u2',
            role: 'user',
            messages: [{ id: 'u2-message', author: { role: 'user' }, content: { content_type: 'text', parts: ['Question 2'] } }],
        });
        attachTurn('a2', {
            id: 'turn-a2',
            role: 'assistant',
            messages: [{ id: 'a2-message', author: { role: 'assistant' }, content: { content_type: 'text', parts: ['Answer 2'] } }],
        });

        const engine = new ChatGPTConversationEngine(createAdapter());
        const snapshotPromise = engine.getSnapshot();
        await vi.runAllTimersAsync();
        const snapshot = await snapshotPromise;

        expect(snapshot).toBeNull();
    });

    it('does not publish descendant React carriers as a complete conversation', async () => {
        vi.spyOn(document.head, 'appendChild').mockImplementation((node: Node) => {
            const script = node as HTMLScriptElement;
            window.setTimeout(() => script.onerror?.(new Event('error')), 0);
            return node;
        });
        document.body.innerHTML = `
          <main>
            <section data-testid="conversation-turn-u1" data-turn="user"><div id="u1-carrier"></div></section>
            <section data-testid="conversation-turn-a1" data-turn="assistant">
              <div data-message-author-role="assistant" data-message-id="visible-a1"><div class="markdown prose"></div></div>
              <div id="a1-carrier"></div>
            </section>
            <section data-testid="conversation-turn-u2" data-turn="user"><div id="u2-carrier"></div></section>
            <section data-testid="conversation-turn-a2" data-turn="assistant">
              <div data-message-author-role="assistant" data-message-id="visible-a2"><div class="markdown prose">Only visible answer</div></div>
              <div id="a2-carrier"></div>
            </section>
          </main>
        `;
        const attachTurn = (id: string, turn: Record<string, unknown>) => {
            const carrier = document.getElementById(id) as any;
            carrier.__reactFiber$aimd = {
                pendingProps: { turn },
                return: null,
            };
        };
        attachTurn('u1-carrier', {
            id: 'turn-u1',
            author: { role: 'user' },
            messages: [{ id: 'u1-message', author: { role: 'user' }, content: { content_type: 'text', parts: ['Question 1'] } }],
        });
        attachTurn('a1-carrier', {
            id: 'turn-a1',
            author: { role: 'assistant' },
            messages: [{ id: 'a1-message', author: { role: 'assistant' }, content: { content_type: 'text', parts: ['Answer 1 from local turn data'] } }],
        });
        attachTurn('u2-carrier', {
            id: 'turn-u2',
            author: { role: 'user' },
            messages: [{ id: 'u2-message', author: { role: 'user' }, content: { content_type: 'text', parts: ['Question 2'] } }],
        });
        attachTurn('a2-carrier', {
            id: 'turn-a2',
            author: { role: 'assistant' },
            messages: [{ id: 'a2-message', author: { role: 'assistant' }, content: { content_type: 'text', parts: ['Answer 2 from local turn data'] } }],
        });

        const engine = new ChatGPTConversationEngine(createAdapter());
        const snapshotPromise = engine.getSnapshot();
        await vi.runAllTimersAsync();
        const snapshot = await snapshotPromise;

        expect(snapshot).toBeNull();
    });
});
