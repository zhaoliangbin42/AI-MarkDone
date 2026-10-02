import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { ConversationSurfaceFrameV1 } from '@/contracts/conversationSurface';
import { ChatGPTAdapter } from '@/drivers/content/adapters/sites/chatgpt';
import { DOMContentSurfaceAdapter } from '@/drivers/content/adapters/ContentSurfaceAdapter';
import { ChatGPTConversationContentRuntime } from '@/runtimes/content/ChatGPTConversationContentRuntime';
import { projectSurfaceSelectionToMarkdown } from '@/services/semantic-content/SurfaceProjection';

function roundHtml(index: number, answer: string, options: { action?: boolean; user?: boolean } = {}): string {
    const action = options.action ?? true;
    const user = options.user ?? true;
    return `
        ${user ? `
            <div data-turn-id-container="user-slot-${index}">
                <section data-turn="user" data-turn-id="user-slot-${index}" data-turn-id-container="user-slot-${index}">
                    <div data-message-author-role="user" data-message-id="user-${index}">
                        <div class="whitespace-pre-wrap">Question ${index}</div>
                    </div>
                </section>
            </div>
        ` : ''}
        <div data-turn-id-container="assistant-slot-${index}">
            <section data-turn="assistant" data-turn-id="assistant-slot-${index}" data-turn-id-container="assistant-slot-${index}">
                <div data-message-author-role="assistant" data-message-id="assistant-${index}">
                    <div class="markdown prose">${answer}</div>
                </div>
                ${action
                    ? '<div class="z-0 flex"><button data-testid="copy-turn-action-button">Copy</button></div>'
                    : ''}
            </section>
        </div>
    `;
}

function searchUnitRoundHtml(index: number, windowIndex: number): string {
    const turnKey = `fallback-turn-${windowIndex}`;
    return `
        <div data-turn-key="user-${index}">
            <div data-content-search-turn-key="${turnKey}">
                <div data-chatgpt-search-unit-key="${turnKey}:0:user" data-chatgpt-search-message-ids="user-${index}">Question ${index}</div>
                <div class="group flex flex-col pb-2 pt-2">
                    <div data-chatgpt-search-unit-key="${turnKey}:2:assistant" data-chatgpt-search-message-ids="assistant-${index} assistant-${index}">
                        <div data-markdown-text-style="assistant-message">Answer ${index}</div>
                    </div>
                    <div class="turn-action-controls"><button aria-label="复制">Copy</button></div>
                </div>
            </div>
        </div>
    `;
}

async function settle(ms = 25): Promise<void> {
    await Promise.resolve();
    await vi.advanceTimersByTimeAsync(ms);
    await Promise.resolve();
}

function officialNavigationHtml(count: number): string {
    return `
        <div class="qMYqUG_convSearchResultHighlightRoot">
            <div class="fixed inset-e-4 top-1/2 z-20 -translate-y-1/2">
                ${Array.from({ length: count }, (_, index) => `<button aria-label="Prompt ${index + 1}"></button>`).join('')}
            </div>
        </div>
    `;
}

function createRuntime(id = 'conversation-a', messageNavigation = false) {
    history.replaceState({}, '', `/c/${id}${messageNavigation ? '?message=' : ''}`);
    const adapter = new ChatGPTAdapter();
    const runtime = new ChatGPTConversationContentRuntime(adapter, { hostSettleDelayMs: 20 });
    return {
        adapter,
        runtime,
        dispose() {
            runtime.dispose();
            adapter.dispose();
        },
    };
}

describe('ChatGPT DOM content discovery lifecycle', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        history.replaceState({}, '', '/');
        document.documentElement.innerHTML = '<head></head><body><main></main></body>';
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('restores content already carrying an official action row at runtime initialization', async () => {
        document.querySelector('main')!.innerHTML = roundHtml(1, 'Initial answer');
        const harness = createRuntime('initial-conversation');

        try {
            harness.runtime.init();
            await settle();

            expect(harness.runtime.source.read()).toMatchObject({
                kind: 'ready',
                snapshot: {
                    historyStatus: 'partial',
                    turns: [{
                        userText: 'Question 1',
                        assistantMarkdown: 'Initial answer',
                    }],
                },
            });
        } finally {
            harness.dispose();
        }
    });

    it('publishes usable get content from the 5.3 bridge seed before DOM materialization', async () => {
        const bridgeRequest = vi.fn((event: Event) => {
            const detail = (event as CustomEvent<any>).detail;
            const request = typeof detail === 'string' ? JSON.parse(detail) : detail;
            const response = {
                requestId: request.requestId,
                ok: true,
                snapshot: {
                    conversationId: 'get-seed-conversation',
                    branchKey: 'assistant-node',
                    capturedAt: 100,
                    captureSequence: 1,
                    rounds: [{
                        key: 'user-node:assistant-message',
                        ordinal: 1,
                        identity: {
                            turnId: 'user-node',
                            userMessageId: 'user-message',
                            assistantMessageId: 'assistant-message',
                        },
                        userText: 'GET question',
                        assistantMarkdown: 'GET answer',
                        assistantProvenance: {
                            authority: 'verified-derived',
                            fidelity: 'normalized',
                            producer: 'chatgpt-markdown-source-adapter',
                        },
                    }],
                },
            };
            window.dispatchEvent(new CustomEvent('aimd:chatgpt-conversation-bridge:response', {
                detail: typeof detail === 'string' ? JSON.stringify(response) : response,
            }));
        });
        window.addEventListener('aimd:chatgpt-conversation-bridge:request', bridgeRequest);
        const harness = createRuntime('get-seed-conversation');

        try {
            harness.runtime.init();
            await settle();

            expect(bridgeRequest).toHaveBeenCalledTimes(1);
            expect(harness.runtime.source.read()).toMatchObject({
                kind: 'ready',
                snapshot: {
                    historyStatus: 'get',
                    turns: [{ assistantMarkdown: 'GET answer' }],
                },
            });
        } finally {
            window.removeEventListener('aimd:chatgpt-conversation-bridge:request', bridgeRequest);
            harness.dispose();
        }
    });

    it('merges a late full source with incremental DOM content without a startup deadline or polling', async () => {
        const conversationId = 'late-source-conversation';
        let sourceReady = false;
        const bridgeRequest = vi.fn((event: Event) => {
            const detail = (event as CustomEvent<any>).detail;
            const request = typeof detail === 'string' ? JSON.parse(detail) : detail;
            window.dispatchEvent(new CustomEvent('aimd:chatgpt-conversation-bridge:response', {
                detail: {
                    requestId: request.requestId,
                    ok: sourceReady,
                    ...(sourceReady ? { snapshot: {
                        conversationId, branchKey: 'assistant-20', capturedAt: 70_000, captureSequence: 1,
                        rounds: Array.from({ length: 20 }, (_, index) => ({
                            key: `user-slot-${index + 1}:assistant-${index + 1}`, ordinal: index + 1,
                            identity: { turnId: `user-slot-${index + 1}`, userMessageId: `user-${index + 1}`, assistantMessageId: `assistant-${index + 1}` },
                            userText: `Question ${index + 1}`, assistantMarkdown: `Source answer ${index + 1}`,
                        })),
                    } } : {}),
                },
            }));
        });
        window.addEventListener('aimd:chatgpt-conversation-bridge:request', bridgeRequest);
        document.querySelector('main')!.innerHTML = Array.from({ length: 12 }, (_, index) => roundHtml(index + 1, `DOM answer ${index + 1}`)).join('');
        const harness = createRuntime(conversationId);
        try {
            harness.runtime.init();
            await settle();
            expect(harness.runtime.source.read().snapshot?.turns).toHaveLength(12);
            await settle(70_000);
            expect(bridgeRequest).toHaveBeenCalledTimes(1);
            sourceReady = true;
            window.dispatchEvent(new CustomEvent('aimd:chatgpt-conversation-bridge:capture', {
                detail: { kind: 'graph', conversationId },
            }));
            await settle(200);
            expect(harness.runtime.source.read().snapshot?.turns).toHaveLength(20);
            expect(harness.runtime.source.read().snapshot?.turns[0]?.assistantMarkdown).toBe('DOM answer 1');
            document.querySelector('main')!.insertAdjacentHTML('beforeend', roundHtml(21, 'New DOM answer'));
            await settle();
            expect(harness.runtime.source.read().snapshot?.turns).toHaveLength(21);
            expect(bridgeRequest).toHaveBeenCalledTimes(2);
        } finally {
            window.removeEventListener('aimd:chatgpt-conversation-bridge:request', bridgeRequest);
            harness.dispose();
        }
    });

    it('does not start a full DOM scroll sweep when the navigation trigger is present', async () => {
        document.querySelector('main')!.innerHTML = officialNavigationHtml(2)
            + roundHtml(1, 'Answer 1')
            + roundHtml(2, 'Answer 2');
        const slots = Array.from(document.querySelectorAll<HTMLElement>('[data-turn-id-container]'));
        slots.forEach((slot) => {
            slot.scrollIntoView = vi.fn();
        });
        const harness = createRuntime('message-navigation-conversation', true);

        try {
            harness.runtime.init();
            await settle(500);

            expect(harness.runtime.source.read()).toMatchObject({
                kind: 'ready',
                snapshot: {
                    historyStatus: 'partial',
                    turns: [
                        { assistantMarkdown: 'Answer 1' },
                        { assistantMarkdown: 'Answer 2' },
                    ],
                },
            });
            expect(slots.every((slot) => !(slot.scrollIntoView as ReturnType<typeof vi.fn>).mock.calls.length)).toBe(true);
        } finally {
            harness.dispose();
        }
    });

    it('leaves an empty mounted body pending without scrolling to hydrate it', async () => {
        const main = document.querySelector('main')!;
        main.innerHTML = officialNavigationHtml(2)
            + roundHtml(1, 'Answer 1')
            + roundHtml(2, '');
        const emptyAssistantSlot = main.querySelector<HTMLElement>('[data-turn-id-container="assistant-slot-2"]');
        const emptyBody = emptyAssistantSlot?.querySelector<HTMLElement>('.markdown');
        if (!emptyAssistantSlot || !emptyBody) throw new Error('empty assistant fixture is missing');
        emptyAssistantSlot.scrollIntoView = vi.fn();
        const harness = createRuntime('message-navigation-hydration', true);

        try {
            harness.runtime.init();
            await settle(500);

            expect(emptyAssistantSlot.scrollIntoView).not.toHaveBeenCalled();
            expect(emptyBody.textContent).toBe('');
            expect(harness.runtime.source.read().snapshot).toMatchObject({
                historyStatus: 'partial',
                turns: [{ assistantMarkdown: 'Answer 1' }],
            });
        } finally {
            harness.dispose();
        }
    });

    it('waits without a timeout until the official action row appears', async () => {
        document.querySelector('main')!.innerHTML = roundHtml(1, 'Slow answer', { action: false });
        const harness = createRuntime('slow-conversation');

        try {
            harness.runtime.init();
            await vi.advanceTimersByTimeAsync(60_000);
            expect(harness.runtime.source.read().snapshot).toBeNull();

            document.querySelector('[data-turn="assistant"]')!.insertAdjacentHTML(
                'beforeend',
                '<div class="z-0 flex"><button data-testid="copy-turn-action-button">Copy</button></div>',
            );
            await settle();

            expect(harness.runtime.source.read().snapshot?.turns[0]?.assistantMarkdown).toBe('Slow answer');
        } finally {
            harness.dispose();
        }
    });

    it('admits a generated message once the stop state ends', async () => {
        document.querySelector('main')!.innerHTML = roundHtml(1, 'Generated answer');
        document.body.insertAdjacentHTML('beforeend', '<button data-testid="stop-button">Stop</button>');
        const harness = createRuntime('generation-conversation');

        try {
            harness.runtime.init();
            await settle();
            expect(harness.runtime.source.read().snapshot).toBeNull();

            document.querySelector('[data-testid="stop-button"]')?.remove();
            await settle();

            expect(harness.runtime.source.read().snapshot?.turns[0]?.assistantMarkdown).toBe('Generated answer');
        } finally {
            harness.dispose();
        }
    });

    it('keeps loaded turns after DOM virtualization and adds a later message', async () => {
        const main = document.querySelector('main')!;
        main.innerHTML = roundHtml(1, 'Answer 1');
        const harness = createRuntime('retained-conversation');

        try {
            harness.runtime.init();
            await settle();
            main.insertAdjacentHTML('beforeend', roundHtml(2, 'Answer 2'));
            await settle();
            main.querySelector('[data-turn="user"]')?.remove();
            main.querySelector('[data-turn="assistant"]')?.remove();
            await settle();

            expect(harness.runtime.source.read().snapshot?.turns.map((turn) => turn.assistantMarkdown)).toEqual([
                'Answer 1',
                'Answer 2',
            ]);
        } finally {
            harness.dispose();
        }
    });

    it('reconciles an exact topology identity before its completed body becomes eligible', async () => {
        const main = document.querySelector('main')!;
        main.innerHTML = `
            <div data-turn-key="fallback-turn-0">
                <div data-chatgpt-search-unit-key="fallback-turn-0:2:assistant" data-chatgpt-search-message-ids="assistant-3 assistant-3"></div>
            </div>
        ` + [4, 5, 6].map(searchUnitRoundHtml).join('');
        const harness = createRuntime('topology-before-body');

        try {
            harness.runtime.init();
            await settle();
            expect(harness.runtime.source.read().snapshot?.turns.map((turn) => turn.identity.assistantMessageId)).toEqual([
                'assistant-4', 'assistant-5', 'assistant-6',
            ]);
            expect(harness.runtime.surface.readFrame().obtainedTurns.map((entry) => entry.turn.identity.assistantMessageId)).toEqual([
                'assistant-4', 'assistant-5', 'assistant-6',
            ]);
            expect(harness.runtime.readDiscoveryDiagnostics().repository.turnCount).toBe(3);

            main.innerHTML = [2, 3, 4].map(searchUnitRoundHtml).join('');
            await settle();
            const snapshot = harness.runtime.source.read().snapshot;
            expect(snapshot?.turns.map((turn) => turn.identity.assistantMessageId)).toEqual([
                'assistant-2', 'assistant-3', 'assistant-4', 'assistant-5', 'assistant-6',
            ]);
            expect(snapshot?.turns.find((turn) => turn.identity.assistantMessageId === 'assistant-3')?.assistantMarkdown).toBe('Answer 3');
            expect(harness.runtime.readDiscoveryDiagnostics().repository.turnCount).toBe(5);
            expect(harness.runtime.surface.readFrame().snapshot?.contentToken).toBe(snapshot?.contentToken);
            expect(harness.runtime.surface.readFrame().obtainedTurns.map((entry) => entry.turn.identity.assistantMessageId)).toEqual([
                'assistant-2', 'assistant-3', 'assistant-4', 'assistant-5', 'assistant-6',
            ]);
        } finally {
            harness.dispose();
        }
    });

    it('obtains a completed native assistant-only search unit before its real prompt remounts', async () => {
        const main = document.querySelector('main')!;
        main.innerHTML = [4, 5, 6].map(searchUnitRoundHtml).join('');
        const harness = createRuntime('native-assistant-only-history');

        try {
            harness.runtime.init();
            await settle();
            main.innerHTML = searchUnitRoundHtml(3, 0) + searchUnitRoundHtml(4, 1);
            main.querySelector('[data-chatgpt-search-message-ids="user-3"]')!.remove();
            await settle();

            const assistantOnlySnapshot = harness.runtime.source.read().snapshot;
            expect(assistantOnlySnapshot?.turns.map((turn) => turn.identity.assistantMessageId)).toEqual([
                'assistant-3', 'assistant-4', 'assistant-5', 'assistant-6',
            ]);
            const assistantOnly = assistantOnlySnapshot!.turns[0]!;
            expect(assistantOnly).toMatchObject({
                identity: { userMessageId: null, assistantMessageId: 'assistant-3' },
                userText: '', assistantMarkdown: 'Answer 3',
            });

            main.innerHTML = [2, 3, 4].map(searchUnitRoundHtml).join('');
            await settle();
            const completeSnapshot = harness.runtime.source.read().snapshot;
            expect(completeSnapshot?.turns.map((turn) => turn.identity.assistantMessageId)).toEqual([
                'assistant-2', 'assistant-3', 'assistant-4', 'assistant-5', 'assistant-6',
            ]);
            expect(completeSnapshot?.turns.find((turn) => turn.identity.assistantMessageId === 'assistant-3')).toMatchObject({
                identity: { turnId: assistantOnly.identity.turnId, userMessageId: 'user-3' },
                userText: 'Question 3', assistantMarkdown: 'Answer 3',
            });
            expect(harness.runtime.readDiscoveryDiagnostics().repository.turnCount).toBe(5);
            expect(harness.runtime.surface.readFrame().snapshot?.contentToken).toBe(completeSnapshot?.contentToken);
        } finally {
            harness.dispose();
        }
    });

    it('retains disjoint hydrated history and corrects its order when reverse-scroll windows reconnect', async () => {
        const main = document.querySelector<HTMLElement>('main')!;
        main.style.overflowY = 'auto';
        main.style.display = 'flex';
        main.style.flexDirection = 'column-reverse';
        Object.defineProperties(main, {
            scrollHeight: { configurable: true, value: 4_000 },
            clientHeight: { configurable: true, value: 600 },
        });
        main.innerHTML = [4, 5, 6].map(searchUnitRoundHtml).join('');
        const harness = createRuntime('disjoint-reverse-history');

        try {
            harness.runtime.init();
            await settle();
            expect(harness.adapter.getConversationScrollRoot()).toBe(main);

            main.scrollTop = -1_800;
            main.innerHTML = [1, 2].map(searchUnitRoundHtml).join('');
            await settle();
            expect(harness.runtime.source.read().snapshot?.turns.map((turn) => turn.identity.assistantMessageId)).toEqual([
                'assistant-1', 'assistant-2', 'assistant-4', 'assistant-5', 'assistant-6',
            ]);

            main.innerHTML = [2, 3].map(searchUnitRoundHtml).join('');
            await settle();
            expect(harness.runtime.source.read().snapshot?.turns).toHaveLength(6);
            main.innerHTML = [3, 4].map(searchUnitRoundHtml).join('');
            await settle();

            const snapshot = harness.runtime.source.read().snapshot;
            expect(snapshot?.turns.map((turn) => turn.identity.assistantMessageId)).toEqual([
                'assistant-1', 'assistant-2', 'assistant-3', 'assistant-4', 'assistant-5', 'assistant-6',
            ]);
            expect(snapshot?.turns.map((turn) => turn.assistantMarkdown)).toEqual([
                'Answer 1', 'Answer 2', 'Answer 3', 'Answer 4', 'Answer 5', 'Answer 6',
            ]);
            expect(harness.runtime.readDiscoveryDiagnostics().repository.turnCount).toBe(6);
            expect(harness.runtime.surface.readFrame().snapshot?.contentToken).toBe(snapshot?.contentToken);
            expect(main.scrollTop).toBe(-1_800);
        } finally {
            harness.dispose();
        }
    });

    it('retains a disjoint new tail near the latest end of a normal scroll root', async () => {
        const main = document.querySelector<HTMLElement>('main')!;
        main.style.overflowY = 'auto';
        main.style.display = 'flex';
        main.style.flexDirection = 'column';
        Object.defineProperties(main, {
            scrollHeight: { configurable: true, value: 4_000 },
            clientHeight: { configurable: true, value: 600 },
        });
        main.scrollTop = 3_400;
        main.innerHTML = [4, 5, 6].map(searchUnitRoundHtml).join('');
        const harness = createRuntime('disjoint-normal-tail');

        try {
            harness.runtime.init();
            await settle();
            expect(harness.adapter.getConversationScrollRoot()).toBe(main);
            main.innerHTML = searchUnitRoundHtml(7, 0);
            await settle();

            expect(harness.runtime.source.read().snapshot?.turns.map((turn) => turn.identity.assistantMessageId)).toEqual([
                'assistant-4', 'assistant-5', 'assistant-6', 'assistant-7',
            ]);
            expect(harness.runtime.source.read().snapshot?.turns[3]?.assistantMarkdown).toBe('Answer 7');
            expect(harness.runtime.readDiscoveryDiagnostics().repository.turnCount).toBe(4);
            expect(harness.runtime.surface.readFrame().obtainedTurns).toHaveLength(4);
            expect(main.scrollTop).toBe(3_400);
        } finally {
            harness.dispose();
        }
    });

    it('fills the shared Surface pool from rolling historical hydration windows without requesting or scrolling', async () => {
        const main = document.querySelector('main')!;
        const scrollIntoView = vi.fn();
        const originalScrollIntoView = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'scrollIntoView');
        Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
            configurable: true, writable: true, value: scrollIntoView,
        });
        const mountWindow = (indices: readonly number[]) => {
            main.innerHTML = indices.map(searchUnitRoundHtml).join('');
        };
        mountWindow([4, 5, 6]);
        main.insertAdjacentHTML('afterbegin', '<div data-turn-key="fallback-turn-0"></div>');
        const harness = createRuntime('rolling-hydration');
        const fetchSpy = vi.spyOn(globalThis, 'fetch');
        const xhrSendSpy = vi.spyOn(XMLHttpRequest.prototype, 'send');
        const scrollToSpy = vi.spyOn(window, 'scrollTo');
        const scrollBySpy = vi.spyOn(window, 'scrollBy');
        const bridgeRequest = vi.fn();
        window.addEventListener('aimd:chatgpt-conversation-bridge:request', bridgeRequest);
        const publishedFrames: ConversationSurfaceFrameV1[] = [];
        const unsubscribe = harness.runtime.surface.subscribeFrame((frame) => {
            if (frame.snapshot) publishedFrames.push(frame);
        });
        const assertPoolFrameConsistency = () => {
            const snapshot = harness.runtime.source.read().snapshot;
            expect(harness.runtime.readDiscoveryDiagnostics().repository.turnCount).toBe(snapshot?.turns.length ?? 0);
            expect(harness.runtime.surface.readFrame().snapshot?.contentToken).toBe(snapshot?.contentToken);
        };

        try {
            harness.runtime.init();
            await settle();
            expect(harness.runtime.source.read().snapshot?.turns.map((turn) => turn.identity.assistantMessageId)).toEqual([
                'assistant-4', 'assistant-5', 'assistant-6',
            ]);
            assertPoolFrameConsistency();
            const initialTurnIds = new Map(harness.runtime.source.read().snapshot?.turns.map((turn) => (
                [turn.identity.assistantMessageId, turn.identity.turnId]
            )));

            mountWindow([2, 3, 4]);
            await settle();
            assertPoolFrameConsistency();
            expect(harness.runtime.source.read().snapshot?.turns.map((turn) => turn.identity.assistantMessageId)).toEqual([
                'assistant-2', 'assistant-3', 'assistant-4', 'assistant-5', 'assistant-6',
            ]);
            const assistantFour = main.querySelector<HTMLElement>(
                '[data-chatgpt-search-message-ids="assistant-4 assistant-4"] [data-markdown-text-style]',
            )!;
            assistantFour.textContent = 'Answer 4 hydrated';
            await settle();
            const recapturedFour = harness.runtime.source.read().snapshot?.turns.find((turn) => (
                turn.identity.assistantMessageId === 'assistant-4'
            ));
            expect(recapturedFour?.assistantMarkdown).toBe('Answer 4 hydrated');
            expect(recapturedFour?.identity.turnId).toBe(initialTurnIds.get('assistant-4'));
            assertPoolFrameConsistency();

            mountWindow([1, 2]);
            await settle();
            assertPoolFrameConsistency();
            mountWindow([6, 7]);
            await settle();
            assertPoolFrameConsistency();

            const snapshot = harness.runtime.source.read().snapshot;
            const finalIds = Array.from({ length: 7 }, (_, index) => `assistant-${index + 1}`);
            expect(snapshot?.turns.map((turn) => turn.identity.assistantMessageId)).toEqual(finalIds);
            expect(snapshot?.turns.map((turn) => turn.ordinal)).toEqual([1, 2, 3, 4, 5, 6, 7]);
            expect(snapshot?.turns.map((turn) => turn.assistantMarkdown)).toEqual(
                Array.from({ length: 7 }, (_, index) => index === 3 ? 'Answer 4 hydrated' : `Answer ${index + 1}`),
            );
            expect(new Set(snapshot?.turns.map((turn) => turn.identity.turnId)).size).toBe(7);
            for (const [assistantMessageId, turnId] of initialTurnIds) {
                expect(snapshot?.turns.find((turn) => turn.identity.assistantMessageId === assistantMessageId)?.identity.turnId).toBe(turnId);
            }
            expect(snapshot?.historyStatus).toBe('partial');
            const frame = harness.runtime.surface.readFrame();
            expect(frame.snapshot?.contentToken).toBe(snapshot?.contentToken);
            expect(frame.obtainedTurns.filter((entry) => entry.materialization).map((entry) => (
                entry.turn.identity.assistantMessageId
            ))).toEqual(['assistant-6', 'assistant-7']);
            for (const published of publishedFrames) {
                expect(published.contentToken).toBe(published.snapshot!.contentToken);
                expect(published.obtainedTurns.map((entry) => entry.turn.identity.assistantMessageId)).toEqual(
                    published.snapshot!.turns.map((turn) => turn.identity.assistantMessageId),
                );
            }
            expect(publishedFrames.map((published) => (
                published.snapshot!.turns.map((turn) => turn.identity.assistantMessageId)
            ))).toContainEqual(finalIds);
            expect(bridgeRequest).toHaveBeenCalledTimes(1);
            expect(fetchSpy).not.toHaveBeenCalled();
            expect(xhrSendSpy).not.toHaveBeenCalled();
            expect(scrollIntoView).not.toHaveBeenCalled();
            expect(scrollToSpy).not.toHaveBeenCalled();
            expect(scrollBySpy).not.toHaveBeenCalled();
        } finally {
            unsubscribe();
            window.removeEventListener('aimd:chatgpt-conversation-bridge:request', bridgeRequest);
            fetchSpy.mockRestore();
            xhrSendSpy.mockRestore();
            scrollToSpy.mockRestore();
            scrollBySpy.mockRestore();
            if (originalScrollIntoView) {
                Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', originalScrollIntoView);
            } else {
                Reflect.deleteProperty(HTMLElement.prototype, 'scrollIntoView');
            }
            harness.dispose();
        }
    });

    it('keeps one exact message entity while a provisional modern outer marker becomes a real slot', async () => {
        const main = document.querySelector('main')!;
        const modernRound = (outerKey: string, windowIndex: number) => searchUnitRoundHtml(1, windowIndex)
            .replace('data-turn-key="user-1"', `data-turn-key="${outerKey}"`);
        main.innerHTML = modernRound('fallback-turn-0', 0);
        const harness = createRuntime('provisional-modern-owner');

        try {
            harness.runtime.init();
            await settle();
            const initial = harness.runtime.source.read().snapshot;
            expect(initial?.turns).toMatchObject([{
                identity: { userMessageId: 'user-1', assistantMessageId: 'assistant-1' },
                userText: 'Question 1', assistantMarkdown: 'Answer 1',
            }]);
            expect(initial?.turns).toHaveLength(1);
            const turnId = initial!.turns[0]!.identity.turnId;

            const owner = main.querySelector<HTMLElement>('[data-turn-key]')!;
            owner.setAttribute('data-turn-key', 'opaque-stable-slot');
            owner.querySelector('[data-content-search-turn-key]')!.setAttribute('data-content-search-turn-key', 'fallback-turn-17');
            for (const unit of owner.querySelectorAll('[data-chatgpt-search-unit-key]')) {
                unit.setAttribute('data-chatgpt-search-unit-key', unit.getAttribute('data-chatgpt-search-unit-key')!
                    .replace('fallback-turn-0:', 'fallback-turn-17:'));
            }
            await settle();
            expect(harness.runtime.source.read().snapshot?.contentToken).toBe(initial?.contentToken);

            main.innerHTML = modernRound('opaque-stable-slot', 41);
            await settle();
            expect(harness.runtime.source.read().snapshot?.contentToken).toBe(initial?.contentToken);
            expect(harness.runtime.surface.readFrame().obtainedTurns[0]?.materialization?.anchorElement.isConnected).toBe(true);

            main.querySelector<HTMLElement>('[data-markdown-text-style="assistant-message"]')!.textContent = 'Updated answer';
            await settle();
            const current = harness.runtime.source.read().snapshot;
            expect(current?.turns).toHaveLength(1);
            expect(current?.turns[0]?.identity.turnId).toBe(turnId);
            expect(current?.turns[0]?.assistantMarkdown).toBe('Updated answer');
            expect(harness.runtime.readDiscoveryDiagnostics().repository.turnCount).toBe(1);
            expect(harness.runtime.readDiscoveryDiagnostics().hostMonitor.admissionRejections?.['identity-conflict'] ?? 0).toBe(0);
            expect(harness.runtime.surface.readFrame().snapshot?.contentToken).toBe(current?.contentToken);
        } finally {
            harness.dispose();
        }
    });

    it('restores independent A and B pools across SPA A to B to A navigation', async () => {
        const main = document.querySelector('main')!;
        main.innerHTML = roundHtml(1, 'Answer A');
        const harness = createRuntime('conversation-a');

        try {
            harness.runtime.init();
            await settle();

            history.pushState({}, '', '/c/conversation-b');
            main.innerHTML = roundHtml(2, 'Answer B');
            await settle();
            expect(harness.runtime.source.read().snapshot?.turns.map((turn) => turn.assistantMarkdown)).toEqual([
                'Answer B',
            ]);

            history.pushState({}, '', '/c/conversation-a');
            main.innerHTML = roundHtml(1, 'Answer A');
            await settle();
            expect(harness.runtime.source.read().snapshot?.turns.map((turn) => turn.assistantMarkdown)).toEqual([
                'Answer A',
            ]);
        } finally {
            harness.dispose();
        }
    });

    it('coalesces pageshow, resume and visible wake signals into one DOM rescan', async () => {
        document.querySelector('main')!.innerHTML = roundHtml(1, 'Wake answer');
        const harness = createRuntime('wake-conversation');
        const originalVisibility = Object.getOwnPropertyDescriptor(document, 'visibilityState');

        try {
            harness.runtime.init();
            await settle();
            const capturesBefore = harness.runtime.readDiscoveryDiagnostics().hostMonitor.stableCaptureCount;
            Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });

            window.dispatchEvent(new Event('pageshow'));
            document.dispatchEvent(new Event('resume'));
            document.dispatchEvent(new Event('visibilitychange'));
            await settle(75);

            expect(harness.runtime.readDiscoveryDiagnostics().hostMonitor.stableCaptureCount).toBe(
                capturesBefore + 1,
            );
            expect(harness.runtime.source.read().snapshot?.turns[0]?.assistantMarkdown).toBe('Wake answer');
        } finally {
            if (originalVisibility) Object.defineProperty(document, 'visibilityState', originalVisibility);
            harness.dispose();
        }
    });

    it('does not issue conversation fetches while allowing the bounded bridge peek', async () => {
        document.querySelector('main')!.innerHTML = roundHtml(1, 'Local answer');
        const bridgeRequest = vi.fn();
        window.addEventListener('aimd:chatgpt-conversation-bridge:request', bridgeRequest);
        const fetchSpy = vi.spyOn(globalThis, 'fetch');
        const harness = createRuntime('network-boundary');

        try {
            harness.runtime.init();
            await settle();

            expect(bridgeRequest).toHaveBeenCalledTimes(1);
            expect(fetchSpy).not.toHaveBeenCalled();
            expect(harness.runtime.source.read().snapshot?.turns).toHaveLength(1);
        } finally {
            window.removeEventListener('aimd:chatgpt-conversation-bridge:request', bridgeRequest);
            fetchSpy.mockRestore();
            harness.dispose();
        }
    });

    it('keeps canonical partial formula selection available from a DOM-derived pool', async () => {
        document.querySelector('main')!.innerHTML = roundHtml(1, `
            <h1>Complex answer 1</h1>
            <p><strong>Before <span class="math-inline"><span class="katex" data-latex-source="\\frac{x}{y}">
                <span class="katex-mathml"><math><semantics><annotation encoding="application/x-tex">\\frac{x}{y}</annotation></semantics></math></span>
                <span class="katex-html" aria-hidden="true">x/y</span>
            </span></span> after.</strong></p>
        `);
        const harness = createRuntime('formula-selection');

        try {
            harness.runtime.init();
            await settle();
            const text = document.querySelector('.katex-html')!.firstChild as Text;
            const range = document.createRange();
            range.setStart(text, 0);
            range.setEnd(text, text.data.length);
            const selection = window.getSelection()!;
            selection.removeAllRanges();
            selection.addRange(range);

            const surface = new DOMContentSurfaceAdapter(harness.adapter, harness.runtime.materialization);
            const capture = surface.captureSelection(selection);
            expect(capture?.evidence).toBeTruthy();
            expect(capture?.evidence?.atomicFragments).toHaveLength(1);
            const result = projectSurfaceSelectionToMarkdown({
                source: harness.runtime.source,
                materialization: harness.runtime.materialization,
                evidence: capture!.evidence!,
            });
            expect(result).toMatchObject({ status: 'ready', markdown: '$\\frac{x}{y}$' });
        } finally {
            harness.dispose();
        }
    });
});
