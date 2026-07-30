import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const browserMockState = vi.hoisted(() => ({
    isFirefox: false,
}));

vi.mock('@/drivers/shared/browser', () => ({
    browserInfo: {
        get isFirefox() {
            return browserMockState.isFirefox;
        },
    },
}));

import { ChatGPTConversationEngine } from '@/drivers/content/chatgpt/ChatGPTConversationEngine';

const REQUEST_EVENT = 'aimd:chatgpt-conversation-bridge:request';
const RESPONSE_EVENT = 'aimd:chatgpt-conversation-bridge:response';
const CAPTURE_EVENT = 'aimd:chatgpt-conversation-bridge:capture';
const conversationId = '695499b7-464c-8323-a998-119f661ac953';
const secondConversationId = '795499b7-464c-8323-a998-119f661ac954';

function createAdapter() {
    return {
        getPlatformId: () => 'chatgpt',
    } as any;
}

function makeCandidate(
    id = conversationId,
    capturedAt = 1,
    assistantContent = 'Answer 1',
) {
    return {
        conversationId: id,
        capturedAt,
        branchKey: `branch-${id}`,
        rounds: [{
            id: `round-${id}`,
            position: 1,
            userPrompt: 'Question 1',
            assistantContent,
            preview: 'Question 1',
            messageId: `assistant-${id}`,
            userMessageId: `user-${id}`,
            assistantMessageId: `assistant-${id}`,
        }],
    };
}

function decodeDetail(rawDetail: unknown): Record<string, any> {
    return typeof rawDetail === 'string'
        ? JSON.parse(rawDetail) as Record<string, any>
        : rawDetail as Record<string, any>;
}

function respond(rawRequest: unknown, response: Record<string, unknown>): void {
    const request = decodeDetail(rawRequest);
    const payload = {
        requestId: request.requestId,
        ok: true,
        ...response,
    };
    window.dispatchEvent(new CustomEvent(RESPONSE_EVENT, {
        detail: typeof rawRequest === 'string' ? JSON.stringify(payload) : payload,
    }));
}

describe('ChatGPTConversationEngine', () => {
    const cleanups: Array<() => void> = [];
    const engines: ChatGPTConversationEngine[] = [];

    beforeEach(() => {
        vi.useFakeTimers();
        browserMockState.isFirefox = false;
        history.replaceState({}, '', `/c/${conversationId}`);
        document.documentElement.innerHTML = '<head></head><body><main></main></body>';
    });

    afterEach(() => {
        for (const engine of engines.splice(0)) engine.dispose();
        for (const cleanup of cleanups.splice(0)) cleanup();
        vi.clearAllTimers();
        vi.useRealTimers();
    });

    function createEngine(): ChatGPTConversationEngine {
        const engine = new ChatGPTConversationEngine(createAdapter());
        engines.push(engine);
        return engine;
    }

    function listen(
        handler: (rawDetail: unknown, request: Record<string, any>) => void,
    ): void {
        const listener = ((event: Event) => {
            const rawDetail = (event as CustomEvent<unknown>).detail;
            handler(rawDetail, decodeDetail(rawDetail));
        }) as EventListener;
        window.addEventListener(REQUEST_EVENT, listener);
        cleanups.push(() => window.removeEventListener(REQUEST_EVENT, listener));
    }

    it('publishes a graph as the observed-graph canonical snapshot on Chrome transport', async () => {
        const rawDetails: unknown[] = [];
        listen((rawDetail) => {
            rawDetails.push(rawDetail);
            respond(rawDetail, { snapshot: makeCandidate() });
        });

        const engine = createEngine();
        const snapshot = await engine.ensureReady();

        expect(snapshot).toMatchObject({
            conversationId,
            proof: 'observed-graph',
            revision: 2,
            rounds: [{ assistantContent: 'Answer 1' }],
        });
        expect(engine.getState()).toMatchObject({
            status: 'ready',
            conversationId,
            snapshot,
        });
        expect(rawDetails).toHaveLength(1);
        expect(typeof rawDetails[0]).toBe('object');
        expect(decodeDetail(rawDetails[0])).toMatchObject({
            type: 'snapshot',
            conversationId,
        });
    });

    it('preserves Firefox JSON-string bridge transport in both directions', async () => {
        browserMockState.isFirefox = true;
        const rawDetails: unknown[] = [];
        listen((rawDetail) => {
            rawDetails.push(rawDetail);
            respond(rawDetail, { snapshot: makeCandidate() });
        });

        const snapshot = await createEngine().ensureReady();

        expect(snapshot?.proof).toBe('observed-graph');
        expect(typeof rawDetails[0]).toBe('string');
        expect(decodeDetail(rawDetails[0])).toMatchObject({
            type: 'snapshot',
            conversationId,
        });
    });

    it('shares one in-memory bridge flush between concurrent callers in one epoch', async () => {
        const pending: unknown[] = [];
        listen((rawDetail) => pending.push(rawDetail));
        const engine = createEngine();

        const first = engine.ensureReady();
        const second = engine.ensureReady();
        await Promise.resolve();

        expect(second).toBe(first);
        expect(pending).toHaveLength(1);
        respond(pending[0], { snapshot: makeCandidate() });
        await expect(first).resolves.toMatchObject({ proof: 'observed-graph' });
    });

    it('isolates late graph results while allowing the new route epoch to flush', async () => {
        const pending: unknown[] = [];
        listen((rawDetail) => pending.push(rawDetail));
        const engine = createEngine();

        const first = engine.ensureReady();
        await Promise.resolve();
        expect(pending).toHaveLength(1);

        history.replaceState({}, '', `/c/${secondConversationId}`);
        const second = engine.ensureReady();
        await Promise.resolve();
        expect(pending).toHaveLength(2);

        respond(pending[1], { snapshot: makeCandidate(secondConversationId, 2) });
        await expect(second).resolves.toMatchObject({ conversationId: secondConversationId });
        respond(pending[0], { snapshot: makeCandidate(conversationId, 1) });
        await expect(first).resolves.toBeNull();
        expect(engine.getState().snapshot?.conversationId).toBe(secondConversationId);
    });

    it('does not schedule retry polling after an unavailable bridge response', async () => {
        let requestCount = 0;
        listen((rawDetail) => {
            requestCount += 1;
            const request = decodeDetail(rawDetail);
            window.dispatchEvent(new CustomEvent(RESPONSE_EVENT, {
                detail: {
                    requestId: request.requestId,
                    ok: false,
                },
            }));
        });
        const engine = createEngine();
        engine.init();
        await Promise.resolve();
        await Promise.resolve();

        expect(requestCount).toBe(1);
        expect(engine.getState()).toMatchObject({
            status: 'blocked',
            reason: 'unproven-history',
            snapshot: null,
        });

        await vi.advanceTimersByTimeAsync(20_000);
        expect(requestCount).toBe(1);
    });

    it('defers DOM fact collection on an unproven late-attached conversation', async () => {
        listen((rawDetail) => {
            const request = decodeDetail(rawDetail);
            window.dispatchEvent(new CustomEvent(RESPONSE_EVENT, {
                detail: {
                    requestId: request.requestId,
                    ok: false,
                },
            }));
        });
        const domFacts = {
            start: vi.fn(),
            stop: vi.fn(),
            read: vi.fn(() => ({ observedAt: 1, rounds: [] })),
        };
        const engine = new ChatGPTConversationEngine(createAdapter(), { domFacts });
        engines.push(engine);

        engine.init();
        await Promise.resolve();
        await Promise.resolve();

        expect(engine.getState()).toMatchObject({
            status: 'blocked',
            reason: 'unproven-history',
        });
        expect(domFacts.start).not.toHaveBeenCalled();
        expect(domFacts.read).not.toHaveBeenCalled();
    });

    it('activates DOM facts once after a graph proves the current conversation', async () => {
        listen((rawDetail) => respond(rawDetail, { snapshot: makeCandidate() }));
        const domFacts = {
            start: vi.fn(),
            stop: vi.fn(),
            read: vi.fn(() => ({ observedAt: 1, rounds: [] })),
        };
        const engine = new ChatGPTConversationEngine(createAdapter(), { domFacts });
        engines.push(engine);

        engine.init();
        await engine.ensureReady();

        expect(engine.getState()).toMatchObject({
            status: 'ready',
            snapshot: { proof: 'observed-graph' },
        });
        expect(domFacts.start).toHaveBeenCalledTimes(1);
        expect(domFacts.read).toHaveBeenCalledTimes(1);
    });

    it('ignores a delayed DOM observation from an earlier route epoch', async () => {
        history.replaceState({}, '', '/');
        listen((rawDetail) => {
            const request = decodeDetail(rawDetail);
            window.dispatchEvent(new CustomEvent(RESPONSE_EVENT, {
                detail: {
                    requestId: request.requestId,
                    ok: false,
                },
            }));
        });
        const listeners: Array<(observation: any) => void> = [];
        const domFacts = {
            start: vi.fn((listener: (observation: any) => void) => listeners.push(listener)),
            stop: vi.fn(),
            read: vi.fn(() => ({ observedAt: 1, rounds: [] })),
        };
        const engine = new ChatGPTConversationEngine(createAdapter(), { domFacts });
        engines.push(engine);
        engine.init();
        const staleListener = listeners[0]!;

        history.replaceState({}, '', `/c/${conversationId}`);
        await engine.ensureReady();
        expect(listeners).toHaveLength(2);

        staleListener({
            observedAt: 2,
            rounds: [{
                position: 1,
                roundId: 'round-1',
                userMessageId: 'user-1',
                assistantMessageId: 'assistant-1',
                assistantTurnId: 'assistant-turn-1',
                userPrompt: 'Question 1',
                assistantContent: 'Answer 1',
                status: 'complete',
            }],
        });

        expect(engine.getState()).toMatchObject({
            status: 'collecting',
            conversationId,
            snapshot: null,
        });
    });

    it('reacts only to passive capture events for the current route', async () => {
        let requestCount = 0;
        listen((rawDetail) => {
            requestCount += 1;
            respond(rawDetail, { snapshot: makeCandidate(conversationId, requestCount) });
        });
        const engine = createEngine();
        engine.init();
        await engine.ensureReady();
        expect(requestCount).toBe(1);

        window.dispatchEvent(new CustomEvent(CAPTURE_EVENT, {
            detail: JSON.stringify({
                conversationId: secondConversationId,
                captureSequence: 1,
            }),
        }));
        await Promise.resolve();
        expect(requestCount).toBe(1);

        window.dispatchEvent(new CustomEvent(CAPTURE_EVENT, {
            detail: JSON.stringify({
                conversationId,
                captureSequence: 2,
            }),
        }));
        await Promise.resolve();
        await Promise.resolve();
        expect(requestCount).toBe(2);
    });

    it('keeps revision and subscriber notifications stable for duplicate graph facts', async () => {
        listen((rawDetail) => respond(rawDetail, { snapshot: makeCandidate() }));
        const engine = createEngine();
        const states: number[] = [];
        engine.subscribe((state) => states.push(state.revision));

        await engine.ensureReady();
        const revision = engine.getState().revision;
        await engine.ensureReady();

        expect(engine.getState().revision).toBe(revision);
        expect(states).toEqual([0, 1, revision]);
    });

    it('rejects a candidate that cannot prove the current complete graph', async () => {
        listen((rawDetail) => respond(rawDetail, {
            snapshot: {
                ...makeCandidate(),
                rounds: [{
                    ...makeCandidate().rounds[0],
                    position: 2,
                }],
            },
        }));
        const engine = createEngine();

        await expect(engine.ensureReady()).resolves.toBeNull();
        expect(engine.getState()).toMatchObject({
            status: 'blocked',
            reason: 'unproven-history',
            snapshot: null,
        });
    });
});
