import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ConversationNavigationPortV1, ConversationNavigationResultV1 } from '@/contracts/conversationNavigation';
import {
    clearPendingNavigation,
    peekPendingNavigation,
    setPendingNavigation,
} from '@/drivers/content/bookmarks/navigation';
import { ConversationNavigationCoordinator } from '@/services/content/ConversationNavigationCoordinator';
import { ConversationPendingNavigationRestorer } from '@/services/content/ConversationPendingNavigationRestorer';
import { createConversationContentSource } from '../../../helpers/chatgptContentFixtures';

const restorers = new Set<ConversationPendingNavigationRestorer>();

function createRestorer(options: ConstructorParameters<typeof ConversationPendingNavigationRestorer>[0]) {
    const restorer = new ConversationPendingNavigationRestorer(options);
    restorers.add(restorer);
    return restorer;
}

function createSource() {
    return createConversationContentSource({
        conversationId: 'current',
        rounds: [{ id: 'round-1', userPrompt: 'Prompt', assistantContent: 'Answer', userMessageId: 'user-1', assistantMessageId: 'assistant-1' }],
    });
}

function deferredNavigation() {
    let finish!: (result: ConversationNavigationResultV1) => void;
    const promise = new Promise<ConversationNavigationResultV1>(resolve => { finish = resolve; });
    return { promise, finish };
}

describe('ConversationPendingNavigationRestorer', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        sessionStorage.clear();
        window.history.replaceState({}, '', '/c/current');
    });

    afterEach(() => {
        for (const restorer of restorers) restorer.dispose();
        restorers.clear();
        clearPendingNavigation();
        vi.runOnlyPendingTimers();
        vi.useRealTimers();
        window.history.replaceState({}, '', '/');
    });

    it('waits for an SPA route to match before navigating the canonical bookmark target', async () => {
        const deadlineMs = Date.now() + 15_000;
        const navigate = vi.fn(async () => ({
            ok: true as const,
            phase: 'hydrated' as const,
            resolvedBy: 'identity' as const,
            target: {
                documentKey: 'chatgpt:conversation:target',
                position: 7,
                roundId: 'round-7',
                userMessageId: 'user-7',
                assistantMessageId: 'assistant-7',
            },
        }));
        const restorer = createRestorer({
            navigation: { navigate, cancelActive: vi.fn() } as ConversationNavigationPortV1,
            source: createConversationContentSource({
                conversationId: 'target',
                rounds: [{ id: 'round-7', userPrompt: 'Prompt', assistantContent: 'Answer', userMessageId: 'user-7', assistantMessageId: 'assistant-7' }],
            }),
        });

        setPendingNavigation({
            url: `${window.location.origin}/c/target`,
            position: 7,
            messageId: 'assistant-7',
        });
        restorer.start();
        await Promise.resolve();
        expect(navigate).not.toHaveBeenCalled();

        window.history.replaceState({}, '', '/c/target');
        await vi.advanceTimersByTimeAsync(500);
        await Promise.resolve();

        expect(navigate).toHaveBeenCalledTimes(1);
        expect(navigate).toHaveBeenCalledWith({
            position: 7,
            messageId: 'assistant-7',
            assistantMessageId: 'assistant-7',
            source: 'bookmark',
        }, { timeoutMs: 14_500, deadlineMs, signal: expect.any(AbortSignal), align: 'start' });
        expect(sessionStorage.getItem('aimd:bookmarkNavigate:v1')).toBeNull();
        restorer.dispose();
    });

    it('opens the original conversation but does not jump for an ID-less old bookmark', async () => {
        const id = '12345678-1234-1234-1234-123456789abc';
        window.history.replaceState({}, '', `/g/project/c/${id}`);
        const navigate = vi.fn();
        const onUnavailable = vi.fn();
        setPendingNavigation({ url: `https://chatgpt.com/c/${id}`, position: 9, messageId: null });
        const restorer = createRestorer({
            navigation: { navigate, cancelActive: vi.fn() } as ConversationNavigationPortV1,
            source: createConversationContentSource({ conversationId: id, rounds: [] }),
            onUnavailable,
        });

        restorer.start();
        await Promise.resolve();

        expect(navigate).not.toHaveBeenCalled();
        expect(onUnavailable).toHaveBeenCalledExactlyOnceWith({ ok: false, reason: 'source-unavailable' }, {
            url: `https://chatgpt.com/c/${id}`, position: 9, messageId: null,
        });
        expect(sessionStorage.getItem('aimd:bookmarkNavigate:v1')).toBeNull();
        restorer.dispose();
    });

    it('reacts to a pending target created after the runtime is already alive', async () => {
        const navigate = vi.fn(async () => ({
            ok: true as const,
            phase: 'hydrated' as const,
            resolvedBy: 'identity' as const,
            target: {
                documentKey: 'chatgpt:conversation:current',
                position: 1,
                roundId: 'round-1',
                userMessageId: 'user-1',
                assistantMessageId: 'assistant-1',
            },
        }));
        const restorer = createRestorer({
            navigation: { navigate, cancelActive: vi.fn() } as ConversationNavigationPortV1,
            source: createConversationContentSource({
                conversationId: 'current',
                rounds: [{ id: 'round-1', userPrompt: 'Prompt', assistantContent: 'Answer', userMessageId: 'user-1', assistantMessageId: 'assistant-1' }],
            }),
        });
        restorer.start();

        setPendingNavigation({
            url: `${window.location.origin}/c/current`,
            position: 1,
            messageId: 'assistant-1',
        });
        await Promise.resolve();

        expect(navigate).toHaveBeenCalledTimes(1);
        restorer.dispose();
    });

    it('consumes a timed-out target instead of retrying on a later source revision', async () => {
        const source = createConversationContentSource({
            conversationId: 'current',
            rounds: [{ id: 'round-1', userPrompt: 'Prompt', assistantContent: 'Answer', userMessageId: 'user-1', assistantMessageId: 'assistant-1' }],
        });
        const navigate = vi.fn()
            .mockResolvedValueOnce({ ok: false as const, reason: 'hydration-timeout' as const })
            .mockResolvedValueOnce({
                ok: true as const,
                phase: 'hydrated' as const,
                resolvedBy: 'identity' as const,
                target: {
                    documentKey: 'chatgpt:conversation:current',
                    position: 1,
                    roundId: 'round-1',
                    userMessageId: 'user-1',
                    assistantMessageId: 'assistant-1',
                },
            });
        const restorer = createRestorer({
            navigation: { navigate, cancelActive: vi.fn() } as ConversationNavigationPortV1,
            source,
            onUnavailable: vi.fn(),
        });

        setPendingNavigation({
            url: `${window.location.origin}/c/current`,
            position: 1,
            messageId: 'assistant-1',
        });
        restorer.start();
        await Promise.resolve();
        await Promise.resolve();
        expect(navigate).toHaveBeenCalledTimes(1);
        expect(sessionStorage.getItem('aimd:bookmarkNavigate:v1')).toBeNull();

        source.publish({
            conversationId: 'current',
            rounds: [{ id: 'round-1', userPrompt: 'Prompt', assistantContent: 'Answer', userMessageId: 'user-1', assistantMessageId: 'assistant-1' }],
        });
        await Promise.resolve();
        await Promise.resolve();
        expect(navigate).toHaveBeenCalledTimes(1);
        expect(sessionStorage.getItem('aimd:bookmarkNavigate:v1')).toBeNull();
        restorer.dispose();
    });

    it('shares one deadline across route waiting and a navigation port that never settles', async () => {
        const source = createSource();
        const navigate = vi.fn<ConversationNavigationPortV1['navigate']>(() => new Promise<ConversationNavigationResultV1>(() => undefined));
        const cancelActive = vi.fn();
        const onUnavailable = vi.fn();
        const pending = { url: `${window.location.origin}/c/target`, position: 1, messageId: 'assistant-1' };
        const deadlineMs = Date.now() + 15_000;
        setPendingNavigation(pending);
        const restorer = createRestorer({ navigation: { navigate, cancelActive }, source, onUnavailable });
        restorer.start();
        await vi.advanceTimersByTimeAsync(14_000);
        window.history.replaceState({}, '', '/c/target');
        await vi.advanceTimersByTimeAsync(500);

        expect(navigate).toHaveBeenCalledWith(expect.anything(), {
            align: 'start', deadlineMs, timeoutMs: 500, signal: expect.any(AbortSignal),
        });
        const signal = navigate.mock.calls[0]![1]!.signal!;
        await vi.advanceTimersByTimeAsync(500);
        expect(signal.aborted).toBe(true);
        expect(peekPendingNavigation()).toBeNull();
        expect(onUnavailable).toHaveBeenCalledExactlyOnceWith({ ok: false, reason: 'hydration-timeout' }, pending);
        source.publish(source.read());
        await Promise.resolve();
        expect(navigate).toHaveBeenCalledOnce();
        expect(cancelActive).not.toHaveBeenCalled();
        restorer.dispose();
    });

    it('keeps the coordinator source subscription alive within the same pending deadline', async () => {
        const source = createConversationContentSource({ kind: 'idle', document: null, snapshot: null });
        const execute = vi.fn(async () => ({ ok: true as const }));
        const coordinator = new ConversationNavigationCoordinator({ source, execute });
        const navigate = vi.spyOn(coordinator, 'navigate');
        const restorer = createRestorer({ navigation: coordinator, source });
        setPendingNavigation({ url: `${window.location.origin}/c/current`, position: 1, messageId: 'assistant-1' });
        restorer.start();
        await vi.advanceTimersByTimeAsync(5_000);
        expect(execute).not.toHaveBeenCalled();
        source.publish(createSource().read());
        await vi.advanceTimersByTimeAsync(0);

        expect(navigate).toHaveBeenCalledOnce();
        expect(execute).toHaveBeenCalledOnce();
        expect(peekPendingNavigation()).toBeNull();
        restorer.dispose();
    });

    it('does not reclaim scrolling after the user cancels the real coordinator source wait', async () => {
        const source = createConversationContentSource({ kind: 'idle', document: null, snapshot: null });
        const execute = vi.fn(async () => ({ ok: true as const }));
        const coordinator = new ConversationNavigationCoordinator({ source, execute });
        const navigate = vi.spyOn(coordinator, 'navigate');
        const onUnavailable = vi.fn();
        const restorer = createRestorer({ navigation: coordinator, source, onUnavailable });
        setPendingNavigation({ url: `${window.location.origin}/c/current`, position: 1, messageId: 'assistant-1' });
        restorer.start();
        document.dispatchEvent(new WheelEvent('wheel'));
        await vi.advanceTimersByTimeAsync(0);
        source.publish(createSource().read());
        await vi.advanceTimersByTimeAsync(0);

        expect(peekPendingNavigation()).toBeNull();
        expect(navigate).toHaveBeenCalledOnce();
        expect(execute).not.toHaveBeenCalled();
        expect(onUnavailable).not.toHaveBeenCalled();
        restorer.dispose();
    });

    it('aborts a replaced attempt without letting its late result clear the new pending target', async () => {
        const first = deferredNavigation();
        const second = deferredNavigation();
        const navigate = vi.fn<ConversationNavigationPortV1['navigate']>()
            .mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
        const cancelActive = vi.fn();
        const onUnavailable = vi.fn();
        const restorer = createRestorer({ navigation: { navigate, cancelActive }, source: createSource(), onUnavailable });
        setPendingNavigation({ url: `${window.location.origin}/c/current`, position: 1, messageId: 'assistant-1' });
        restorer.start();
        const firstSignal = navigate.mock.calls[0]![1]!.signal!;
        const nextPending = { url: `${window.location.origin}/c/current`, position: 2, messageId: 'assistant-2' };
        setPendingNavigation(nextPending);

        expect(firstSignal.aborted).toBe(true);
        expect(navigate).toHaveBeenCalledTimes(2);
        first.finish({ ok: false, reason: 'source-unavailable' });
        await Promise.resolve();
        expect(peekPendingNavigation()).toEqual(nextPending);
        expect(onUnavailable).not.toHaveBeenCalled();
        second.finish({ ok: false, reason: 'cancelled' });
        await Promise.resolve();
        expect(peekPendingNavigation()).toBeNull();
        expect(cancelActive).not.toHaveBeenCalled();
        restorer.dispose();
    });

    it('treats an identical new pending signal as a fresh user intent with a new deadline', async () => {
        const navigate = vi.fn<ConversationNavigationPortV1['navigate']>(() => new Promise(() => undefined));
        const restorer = createRestorer({ navigation: { navigate, cancelActive: vi.fn() }, source: createSource() });
        const pending = { url: `${window.location.origin}/c/current`, position: 1, messageId: 'assistant-1' };
        setPendingNavigation(pending);
        restorer.start();
        const firstSignal = navigate.mock.calls[0]![1]!.signal!;
        await vi.advanceTimersByTimeAsync(10_000);
        setPendingNavigation(pending);
        await vi.advanceTimersByTimeAsync(5_000);

        expect(firstSignal.aborted).toBe(true);
        expect(navigate).toHaveBeenCalledTimes(2);
        expect(navigate.mock.calls[1]![1]!.signal!.aborted).toBe(false);
        expect(peekPendingNavigation()).toEqual(pending);
        restorer.dispose();
    });

    it('preserves a replacement stored while an older attempt is settling', async () => {
        const first = deferredNavigation();
        const navigate = vi.fn<ConversationNavigationPortV1['navigate']>(() => first.promise);
        const onUnavailable = vi.fn();
        const restorer = createRestorer({ navigation: { navigate, cancelActive: vi.fn() }, source: createSource(), onUnavailable });
        setPendingNavigation({ url: `${window.location.origin}/c/current`, position: 1, messageId: 'assistant-1' });
        restorer.start();
        const pending = { url: `${window.location.origin}/c/target`, position: 2, messageId: 'assistant-2' };
        sessionStorage.setItem('aimd:bookmarkNavigate:v1', JSON.stringify(pending));
        first.finish({ ok: false, reason: 'source-unavailable' });
        await Promise.resolve();

        expect(peekPendingNavigation()).toEqual(pending);
        expect(navigate).toHaveBeenCalledOnce();
        expect(onUnavailable).not.toHaveBeenCalled();
        restorer.dispose();
    });

    it('disposes only its own attempt and consumes it without reporting a retryable failure', async () => {
        const deferred = deferredNavigation();
        const navigate = vi.fn<ConversationNavigationPortV1['navigate']>(() => deferred.promise);
        const cancelActive = vi.fn();
        const onUnavailable = vi.fn();
        const source = createSource();
        const restorer = createRestorer({ navigation: { navigate, cancelActive }, source, onUnavailable });
        setPendingNavigation({ url: `${window.location.origin}/c/current`, position: 1, messageId: 'assistant-1' });
        restorer.start();
        const signal = navigate.mock.calls[0]![1]!.signal!;
        restorer.dispose();

        expect(signal.aborted).toBe(true);
        expect(peekPendingNavigation()).toBeNull();
        expect(cancelActive).not.toHaveBeenCalled();
        deferred.finish({ ok: false, reason: 'hydration-timeout' });
        source.publish(source.read());
        await Promise.resolve();
        expect(navigate).toHaveBeenCalledOnce();
        expect(onUnavailable).not.toHaveBeenCalled();
    });

    it.each(['cancelled', 'stale-target'] as const)('silently consumes a %s attempt without later automatic retries', async (reason) => {
        const navigate = vi.fn<ConversationNavigationPortV1['navigate']>().mockResolvedValue({ ok: false, reason });
        const source = createSource();
        const onUnavailable = vi.fn();
        const restorer = createRestorer({ navigation: { navigate, cancelActive: vi.fn() }, source, onUnavailable });
        setPendingNavigation({ url: `${window.location.origin}/c/current`, position: 1, messageId: 'assistant-1' });
        restorer.start();
        await Promise.resolve();
        source.publish(source.read());
        await Promise.resolve();

        expect(peekPendingNavigation()).toBeNull();
        expect(navigate).toHaveBeenCalledOnce();
        expect(onUnavailable).not.toHaveBeenCalled();
        restorer.dispose();
    });

    it.each(['source-unavailable', 'identity-conflict', 'slot-missing', 'hydration-timeout'] as const)('reports a retryable %s result with the captured pending identity', async (reason) => {
        const result = { ok: false as const, reason };
        const navigate = vi.fn<ConversationNavigationPortV1['navigate']>().mockResolvedValue(result);
        const onUnavailable = vi.fn();
        const restorer = createRestorer({ navigation: { navigate, cancelActive: vi.fn() }, source: createSource(), onUnavailable });
        const pending = { url: `${window.location.origin}/c/current`, position: 1, messageId: 'assistant-1' };
        setPendingNavigation(pending);
        restorer.start();
        await Promise.resolve();

        expect(peekPendingNavigation()).toBeNull();
        expect(onUnavailable).toHaveBeenCalledExactlyOnceWith(result, pending);
        restorer.dispose();
    });

    it('waits for the target source after the URL changes, then binds the exact document', async () => {
        const targetId = 'target-conversation';
        window.history.replaceState({}, '', `/c/${targetId}`);
        const source = createSource();
        const deferred = deferredNavigation();
        const navigate = vi.fn<ConversationNavigationPortV1['navigate']>(() => deferred.promise);
        const restorer = createRestorer({ navigation: { navigate, cancelActive: vi.fn() }, source });
        setPendingNavigation({ url: `https://chatgpt.com/c/${targetId}`, position: 1, messageId: 'assistant-2' });
        restorer.start();
        expect(navigate).not.toHaveBeenCalled();
        await vi.advanceTimersByTimeAsync(500);
        source.publish({ conversationId: targetId, rounds: [{ assistantMessageId: 'assistant-2' }] });
        expect(navigate).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({
            documentKey: `chatgpt:conversation:${targetId}`, assistantMessageId: 'assistant-2',
        }), expect.objectContaining({ timeoutMs: 14_500 }));
    });

    it('consumes user takeover during route/source wait without a late automatic jump', async () => {
        const source = createSource();
        const navigate = vi.fn<ConversationNavigationPortV1['navigate']>().mockResolvedValue({ ok: false, reason: 'source-unavailable' });
        const onUnavailable = vi.fn();
        const restorer = createRestorer({ navigation: { navigate, cancelActive: vi.fn() }, source, onUnavailable });
        setPendingNavigation({ url: 'https://chatgpt.com/c/target-conversation', position: 1, messageId: 'assistant-2' });
        restorer.start();
        document.dispatchEvent(new Event('wheel'));
        window.history.replaceState({}, '', '/c/target-conversation');
        source.publish({ conversationId: 'target-conversation', rounds: [{ assistantMessageId: 'assistant-2' }] });
        await vi.advanceTimersByTimeAsync(15_000);
        expect(navigate).not.toHaveBeenCalled();
        expect(peekPendingNavigation()).toBeNull();
        expect(onUnavailable).not.toHaveBeenCalled();
    });

    it('consumes a rejected navigation without leaving an unhandled retry loop', async () => {
        const navigate = vi.fn<ConversationNavigationPortV1['navigate']>().mockRejectedValue(new Error('Source disconnected'));
        const onUnavailable = vi.fn();
        const restorer = createRestorer({ navigation: { navigate, cancelActive: vi.fn() }, source: createSource(), onUnavailable });
        const pending = { url: `${window.location.origin}/c/current`, position: 1, messageId: 'assistant-1' };
        setPendingNavigation(pending);
        restorer.start();
        await Promise.resolve();

        expect(peekPendingNavigation()).toBeNull();
        expect(onUnavailable).toHaveBeenCalledExactlyOnceWith({ ok: false, reason: 'source-unavailable' }, pending);
        restorer.dispose();
    });
});
