import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ChatGPTAdapter } from '@/drivers/content/adapters/sites/chatgpt';
import {
    collectChatGPTDomRoundRefs,
    getChatGPTPageIndex,
    subscribeChatGPTDomRoundChanges,
} from '@/drivers/content/chatgpt/domConversationDiscovery';
import { collectConversationTurnRefs } from '@/drivers/content/conversation/collectConversationTurnRefs';
import { collectChatGPTRoundPositions } from '@/ui/content/chatgptDirectory/navigation';
import { ChatGPTConversationSurface } from '@/drivers/content/chatgpt/ChatGPTConversationSurface';
import { createConversationContentSource } from '../../../../helpers/chatgptContentFixtures';
import { AIMD_CONVERSATION_SURFACE_CONSUMER_ATTRIBUTE } from '@/contracts/conversationSurface';

function appendRound(index: number): void {
    const main = document.querySelector('main');
    if (!(main instanceof HTMLElement)) throw new Error('fixture main is missing');
    main.insertAdjacentHTML('beforeend', `
        <div data-testid="conversation-turn-${index * 2 - 1}" data-turn="user">
            <div data-message-author-role="user"><div class="whitespace-pre-wrap">Prompt ${index}</div></div>
        </div>
        <div data-testid="conversation-turn-${index * 2}" data-turn="assistant">
            <div data-message-author-role="assistant" data-message-id="assistant-${index}">
                <div class="markdown prose">Answer ${index}</div>
            </div>
            <div class="z-0 flex"><button data-testid="copy-turn-action-button">Copy</button></div>
        </div>
    `);
}

async function deliverMutations(): Promise<void> {
    await Promise.resolve();
    await Promise.resolve();
}

describe('ChatGPTPageIndex', () => {
    let adapter: ChatGPTAdapter;

    beforeEach(() => {
        window.history.replaceState({}, '', '/c/12345678-1234-1234-1234-123456789abc');
        document.documentElement.innerHTML = '<head></head><body><main></main></body>';
        appendRound(1);
        adapter = new ChatGPTAdapter();
    });

    afterEach(() => {
        adapter.dispose();
        document.documentElement.innerHTML = '<head></head><body></body>';
    });

    it('reuses one ordered DOM-round snapshot until the host page changes', async () => {
        const first = collectChatGPTDomRoundRefs(adapter);
        const unchanged = collectChatGPTDomRoundRefs(adapter);

        expect(unchanged).toBe(first);
        expect(first.map((round) => round.id)).toEqual(['assistant-1']);

        appendRound(2);
        await deliverMutations();
        const changed = collectChatGPTDomRoundRefs(adapter);

        expect(changed).not.toBe(first);
        expect(changed.map((round) => round.id)).toEqual(['assistant-1', 'assistant-2']);
    });

    it('does not drop a newly mounted role-shaped round after wrapper-shaped history', async () => {
        const main = document.querySelector('main');
        if (!(main instanceof HTMLElement)) throw new Error('fixture main is missing');
        main.innerHTML = `
            <section data-testid="conversation-turn-1" data-turn="user" data-turn-id="turn-1">
                <div data-message-author-role="user" data-message-id="user-1">Prompt 1</div>
            </section>
            <section data-testid="conversation-turn-2" data-turn="assistant" data-turn-id="turn-1">
                <div data-message-author-role="assistant" data-message-id="assistant-1">
                    <div class="markdown prose">Answer 1</div>
                </div>
                <div class="z-0 flex"><button data-testid="copy-turn-action-button">Copy</button></div>
            </section>
        `;
        expect(collectChatGPTDomRoundRefs(adapter).map((round) => round.identity.assistantMessageId)).toEqual([
            'assistant-1',
        ]);

        main.insertAdjacentHTML('beforeend', `
            <div data-message-author-role="user" data-message-id="user-2">Prompt 2</div>
            <div data-message-author-role="assistant" data-message-id="assistant-2">
                <div class="markdown prose">Answer 2</div>
                <div class="z-0 flex"><button data-testid="copy-turn-action-button">Copy</button></div>
            </div>
        `);
        await deliverMutations();

        expect(collectChatGPTDomRoundRefs(adapter).map((round) => round.identity.assistantMessageId)).toEqual([
            'assistant-1',
            'assistant-2',
        ]);
    });

    it('shares the same mapped turn snapshot across toolbar, directory, and navigation callers', () => {
        const firstTurns = collectConversationTurnRefs(adapter);
        const secondTurns = collectConversationTurnRefs(adapter);
        const snapshot = {
            conversationId: '12345678-1234-1234-1234-123456789abc',
            revision: 1,
            proof: 'observed-graph',
            branchKey: 'branch-test',
            capturedAt: Date.now(),
            rounds: [{
                id: 'round-1',
                position: 1,
                userPrompt: 'Prompt 1',
                assistantContent: 'Answer 1',
                preview: 'Prompt 1',
                messageId: 'assistant-1',
                userMessageId: null,
                assistantMessageId: 'assistant-1',
            }],
        } as const;
        const surface = new ChatGPTConversationSurface({
            adapter,
            content: createConversationContentSource(snapshot),
        });
        const positions = collectChatGPTRoundPositions(surface);

        expect(secondTurns).toBe(firstTurns);
        expect(positions.map((position) => position.assistantRoot)).toEqual(
            firstTurns.map((turn) => turn.assistantRootEl),
        );
        surface.dispose();
    });

    it('keeps user and assistant turn identities typed when their host ids differ', () => {
        const main = document.querySelector('main');
        if (!(main instanceof HTMLElement)) throw new Error('fixture main is missing');
        main.innerHTML = `
            <article data-turn="user" data-turn-id="user-turn-identity">
                <div data-message-author-role="user" data-message-id="user-message-identity">Prompt</div>
            </article>
            <article data-turn="assistant" data-turn-id="assistant-turn-identity">
                <div data-message-author-role="assistant" data-message-id="assistant-message-identity"></div>
            </article>
        `;

        expect(collectChatGPTDomRoundRefs(adapter)[0]?.identity).toEqual({
            roundId: 'user-turn-identity',
            userMessageId: 'user-message-identity',
            assistantMessageId: 'assistant-message-identity',
            assistantTurnId: 'assistant-turn-identity',
        });
    });

    it('keeps an assistant-only projection when virtualization has unloaded its user node', () => {
        const main = document.querySelector('main');
        if (!(main instanceof HTMLElement)) throw new Error('fixture main is missing');
        main.innerHTML = `
            <section
                data-testid="conversation-turn-14"
                data-turn="assistant"
                data-turn-id="assistant-turn-14"
                data-turn-id-container="assistant-turn-14"
            >
                <div data-message-author-role="assistant" data-message-id="assistant-14">
                    <div class="markdown prose">Answer 14</div>
                </div>
                <div class="z-0 flex"><button data-testid="copy-turn-action-button">Copy</button></div>
            </section>
        `;

        const [round] = collectChatGPTDomRoundRefs(adapter);

        expect(round?.source).toBe('assistant-only');
        expect(round?.identity).toEqual({
            roundId: null,
            userMessageId: null,
            assistantMessageId: 'assistant-14',
            assistantTurnId: 'assistant-turn-14',
        });
        expect(round?.assistantRootEl).toBe(main.firstElementChild);
        expect(round?.groupEls).toEqual([main.firstElementChild]);
        expect(adapter.getConversationGroupRefs()).toHaveLength(0);
    });

    it('keeps the assistant-only surface in the canonical Directory range', async () => {
        const main = document.querySelector('main');
        if (!(main instanceof HTMLElement)) throw new Error('fixture main is missing');
        main.innerHTML = `
            <section
                data-testid="conversation-turn-14"
                data-turn="assistant"
                data-turn-id="assistant-turn-14"
                data-turn-id-container="assistant-turn-14"
            >
                <div data-message-author-role="assistant" data-message-id="assistant-14">
                    <div class="markdown prose">Answer 14</div>
                </div>
                <div class="z-0 flex"><button data-testid="copy-turn-action-button">Copy</button></div>
            </section>
        `;
        const surface = new ChatGPTConversationSurface({ adapter, content: createConversationContentSource({
            conversationId: '12345678-1234-1234-1234-123456789abc',
            revision: 1,
            proof: 'observed-graph' as const,
            branchKey: 'assistant-14',
            capturedAt: Date.now(),
            rounds: [{
                id: 'round-14',
                position: 1,
                userPrompt: 'Prompt 14',
                assistantContent: 'Answer 14',
                preview: 'Prompt 14',
                messageId: 'assistant-14',
                userMessageId: 'user-14',
                assistantMessageId: 'assistant-14',
            }],
        }) });

        const positions = collectChatGPTRoundPositions(surface);
        const range = positions[0];
        if (!range?.groupEls[0]) throw new Error('assistant-only Directory range is missing');
        range.groupEls[0].getBoundingClientRect = vi.fn(
            () => ({ top: 100, bottom: 500 } as DOMRect),
        );
        const { resolveChatGPTActivePosition } = await import('@/ui/content/chatgptDirectory/navigation');

        expect(range.position).toBe(1);
        expect(range.userAnchor).toBe(range.assistantRoot);
        expect(range.groupEls).toHaveLength(1);
        expect(resolveChatGPTActivePosition(positions, 240)).toBe(1);
        surface.dispose();
    });

    it('pairs turns through persistent host slots when inner wrappers repeat the slot marker', () => {
        const main = document.querySelector('main');
        if (!(main instanceof HTMLElement)) throw new Error('fixture main is missing');
        main.innerHTML = `
            <div id="conversation-slots">
                <div data-turn-id-container="client-created-root"></div>
                <div data-turn-id-container="user-1">
                    <section
                        data-testid="conversation-turn-1"
                        data-turn="user"
                        data-turn-id="user-1"
                        data-turn-id-container="user-1"
                    >
                        <div data-message-author-role="user" data-message-id="user-1">Prompt 1</div>
                    </section>
                </div>
                <div data-turn-id-container="assistant-1">
                    <section
                        data-testid="conversation-turn-2"
                        data-turn="assistant"
                        data-turn-id="assistant-1"
                        data-turn-id-container="assistant-1"
                    >
                        <div data-message-author-role="assistant" data-message-id="assistant-1"></div>
                    </section>
                </div>
                <div data-turn-id-container="user-2">
                    <section
                        data-testid="conversation-turn-3"
                        data-turn="user"
                        data-turn-id="user-2"
                        data-turn-id-container="user-2"
                    >
                        <div data-message-author-role="user" data-message-id="user-2">Prompt 2</div>
                    </section>
                </div>
                <div data-turn-id-container="assistant-2">
                    <section
                        data-testid="conversation-turn-4"
                        data-turn="assistant"
                        data-turn-id="assistant-2"
                        data-turn-id-container="assistant-2"
                    >
                        <div data-message-author-role="assistant" data-message-id="assistant-2"></div>
                    </section>
                </div>
            </div>
        `;

        const rounds = collectChatGPTDomRoundRefs(adapter);

        expect(rounds.map((round) => round.id)).toEqual(['assistant-1', 'assistant-2']);
        expect(rounds.map((round) => round.source)).toEqual(['turn-wrapper', 'turn-wrapper']);
        expect(rounds.map((round) => round.userRootEl.getAttribute('data-testid'))).toEqual([
            'conversation-turn-1',
            'conversation-turn-3',
        ]);
        expect(rounds.map((round) => round.identity.userMessageId)).toEqual(['user-1', 'user-2']);
    });

    it('keeps an orphan assistant turn across a virtualized gap as an assistant-only projection', () => {
        const main = document.querySelector('main');
        if (!(main instanceof HTMLElement)) throw new Error('fixture main is missing');
        main.innerHTML = `
            <section data-testid="conversation-turn-1" data-turn="user" data-turn-id="user-turn-1">
                <div data-message-author-role="user" data-message-id="user-1">Prompt 1</div>
            </section>
            <section data-testid="conversation-turn-2" data-turn="assistant" data-turn-id="assistant-turn-1">
                <div data-message-author-role="assistant" data-message-id="assistant-1"></div>
            </section>
            <div data-virtualized-placeholder></div>
            <section data-testid="conversation-turn-4" data-turn="assistant" data-turn-id="assistant-turn-2">
                <div data-message-author-role="assistant" data-message-id="assistant-2"></div>
            </section>
            <section data-testid="conversation-turn-5" data-turn="user" data-turn-id="user-turn-3">
                <div data-message-author-role="user" data-message-id="user-3">Prompt 3</div>
            </section>
            <section data-testid="conversation-turn-6" data-turn="assistant" data-turn-id="assistant-turn-3">
                <div data-message-author-role="assistant" data-message-id="assistant-3"></div>
            </section>
        `;

        const rounds = collectChatGPTDomRoundRefs(adapter);

        expect(rounds.map((round) => round.id)).toEqual(['assistant-1', 'assistant-2', 'assistant-3']);
        expect(rounds[0]?.groupEls).toHaveLength(2);
        expect(rounds[1]?.source).toBe('assistant-only');
        expect(rounds[1]?.groupEls).toHaveLength(1);
    });

    it('does not pair a pending user turn across a virtualized gap, but keeps the assistant projection', () => {
        const main = document.querySelector('main');
        if (!(main instanceof HTMLElement)) throw new Error('fixture main is missing');
        main.innerHTML = `
            <section data-testid="conversation-turn-1" data-turn="user" data-turn-id="user-turn-1">
                <div data-message-author-role="user" data-message-id="user-1">Prompt 1</div>
            </section>
            <section data-testid="conversation-turn-2" data-turn="assistant" data-turn-id="assistant-turn-1">
                <div data-message-author-role="assistant" data-message-id="assistant-1"></div>
            </section>
            <section data-testid="conversation-turn-3" data-turn="user" data-turn-id="user-turn-2">
                <div data-message-author-role="user" data-message-id="user-2">Prompt 2</div>
            </section>
            <div data-virtualized-placeholder></div>
            <section data-testid="conversation-turn-4" data-turn="assistant" data-turn-id="assistant-turn-2">
                <div data-message-author-role="assistant" data-message-id="assistant-2"></div>
            </section>
            <section data-testid="conversation-turn-5" data-turn="user" data-turn-id="user-turn-3">
                <div data-message-author-role="user" data-message-id="user-3">Prompt 3</div>
            </section>
            <section data-testid="conversation-turn-6" data-turn="assistant" data-turn-id="assistant-turn-3">
                <div data-message-author-role="assistant" data-message-id="assistant-3"></div>
            </section>
        `;

        const rounds = collectChatGPTDomRoundRefs(adapter);

        expect(rounds.map((round) => round.id)).toEqual(['assistant-1', 'assistant-2', 'assistant-3']);
        expect(rounds[1]?.source).toBe('assistant-only');
    });

    it('notifies every navigation subscriber from one shared round-change source', async () => {
        const firstListener = vi.fn();
        const secondListener = vi.fn();
        const unsubscribeFirst = subscribeChatGPTDomRoundChanges(adapter, firstListener);
        const unsubscribeSecond = subscribeChatGPTDomRoundChanges(adapter, secondListener);

        appendRound(2);
        await deliverMutations();

        expect(firstListener).toHaveBeenCalledTimes(1);
        expect(secondListener).toHaveBeenCalledTimes(1);

        unsubscribeFirst();
        unsubscribeSecond();
    });

    it('does not notify navigation subscribers for streamed content changes inside an existing round', async () => {
        const listener = vi.fn();
        const unsubscribe = subscribeChatGPTDomRoundChanges(adapter, listener);
        const content = document.querySelector('.markdown')?.firstChild;
        if (!content) throw new Error('fixture content is missing');

        content.textContent = 'Answer 1 streaming';
        await deliverMutations();

        expect(listener).not.toHaveBeenCalled();
        unsubscribe();
    });

    it('notifies content-discovery subscribers when an existing assistant body is filled later', async () => {
        const listener = vi.fn();
        const unsubscribe = getChatGPTPageIndex(adapter).subscribeMutations(listener);
        const content = document.querySelector('.markdown');
        if (!(content instanceof HTMLElement)) throw new Error('fixture content is missing');

        content.textContent = 'Answer 1 loaded after refresh';
        await deliverMutations();

        expect(listener).toHaveBeenCalledTimes(1);
        unsubscribe();
    });

    it('notifies content-discovery subscribers when the official completion action row mounts', async () => {
        document.querySelector('.z-0.flex')?.remove();
        const listener = vi.fn();
        const unsubscribe = getChatGPTPageIndex(adapter).subscribeMutations(listener);
        const assistantTurn = document.querySelector('[data-turn="assistant"]');
        if (!(assistantTurn instanceof HTMLElement)) throw new Error('fixture assistant turn is missing');

        assistantTurn.insertAdjacentHTML(
            'beforeend',
            '<div class="z-0 flex"><button data-testid="copy-turn-action-button">Copy</button></div>',
        );
        await deliverMutations();

        expect(listener).toHaveBeenCalledTimes(1);
        unsubscribe();
    });

    it('publishes verified Deep Research iframe hydration as a lifecycle signal', async () => {
        const batches: Array<{ kinds: readonly string[]; ids: readonly string[] }> = [];
        const unsubscribe = getChatGPTPageIndex(adapter).subscribeObservations((batch) => {
            batches.push({ kinds: batch.kinds, ids: batch.assistantMessageIds });
        });
        const assistant = document.querySelector('[data-message-id="assistant-1"]');
        if (!(assistant instanceof HTMLElement)) throw new Error('fixture assistant is missing');

        assistant.insertAdjacentHTML(
            'beforeend',
            '<div data-conversation-screenshot-content><iframe title="internal://deep-research"></iframe></div>',
        );
        await deliverMutations();

        expect(batches).toHaveLength(1);
        expect(batches[0]?.kinds).toContain('lifecycle');
        expect(batches[0]?.ids).toContain('assistant-1');
        unsubscribe();
    });

    it('notifies content-discovery subscribers when streaming controls change in place', async () => {
        const assistantTurn = document.querySelector('[data-turn="assistant"]');
        if (!(assistantTurn instanceof HTMLElement)) throw new Error('fixture assistant turn is missing');
        const stopButton = document.createElement('button');
        stopButton.dataset.testid = 'stop-button';
        assistantTurn.appendChild(stopButton);

        const listener = vi.fn();
        const unsubscribe = getChatGPTPageIndex(adapter).subscribeMutations(listener);

        stopButton.dataset.testid = 'copy-turn-action-button';
        await deliverMutations();

        expect(listener).toHaveBeenCalledTimes(1);
        unsubscribe();
    });

    it('tracks generation start and completion across separate mutation batches', async () => {
        const batches: Array<{
            started: readonly string[];
            completed: readonly string[];
        }> = [];
        const unsubscribe = getChatGPTPageIndex(adapter).subscribeObservations((batch) => {
            batches.push({
                started: batch.generationStartedAssistantMessageIds,
                completed: batch.generationCompletedAssistantMessageIds,
            });
        });

        document.body.insertAdjacentHTML('beforeend', '<button data-testid="stop-button">Stop</button>');
        appendRound(2);
        await deliverMutations();
        document.querySelector('button[data-testid="stop-button"]')?.remove();
        await deliverMutations();

        expect(batches.some((batch) => batch.started.includes('assistant-2'))).toBe(true);
        expect(batches.some((batch) => batch.completed.includes('assistant-2'))).toBe(true);
        unsubscribe();
    });

    it('reports an assistant identity replacement inside the same mounted turn owner', async () => {
        const replacements: Array<readonly {
            previousAssistantMessageId: string;
            nextAssistantMessageId: string;
        }[]> = [];
        const index = getChatGPTPageIndex(adapter);
        index.getSnapshot();
        const unsubscribe = index.subscribeObservations((batch) => {
            replacements.push(batch.assistantIdentityReplacements);
        });
        const assistant = document.querySelector('[data-message-id="assistant-1"]');
        if (!(assistant instanceof HTMLElement)) throw new Error('fixture assistant is missing');

        assistant.setAttribute('data-message-id', 'assistant-1-regenerated');
        await deliverMutations();

        expect(replacements.flat()).toContainEqual({
            previousAssistantMessageId: 'assistant-1',
            nextAssistantMessageId: 'assistant-1-regenerated',
        });
        unsubscribe();
    });

    it('reports a content-root replacement without manufacturing generation facts', async () => {
        const batches: Array<{
            surfaceRebased: boolean;
            started: readonly string[];
            replacements: readonly unknown[];
        }> = [];
        const index = getChatGPTPageIndex(adapter);
        index.getSnapshot();
        const unsubscribe = index.subscribeObservations((batch) => {
            batches.push({
                surfaceRebased: batch.surfaceRebased,
                started: batch.generationStartedAssistantMessageIds,
                replacements: batch.assistantIdentityReplacements,
            });
        });
        const replacement = document.createElement('main');
        replacement.innerHTML = `
            <section data-turn="user" data-turn-id="turn-replacement">
                <div data-message-author-role="user" data-message-id="user-replacement">Prompt</div>
            </section>
            <section data-turn="assistant" data-turn-id="turn-replacement">
                <div data-message-author-role="assistant" data-message-id="assistant-replacement">
                    <div class="markdown prose">Answer</div>
                </div>
                <div><button data-testid="copy-turn-action-button">Copy</button></div>
            </section>
        `;

        document.querySelector('main')!.replaceWith(replacement);
        await deliverMutations();

        expect(batches).toHaveLength(1);
        expect(batches[0]).toMatchObject({
            surfaceRebased: true,
            started: [],
            replacements: [],
        });
        unsubscribe();
    });

    it('publishes typed host observation batches with an independent revision', async () => {
        const batches: Array<{ revision: number; kinds: readonly string[]; ids: readonly string[] }> = [];
        const unsubscribe = getChatGPTPageIndex(adapter).subscribeObservations((batch) => {
            batches.push({
                revision: batch.revision,
                kinds: batch.kinds,
                ids: batch.assistantMessageIds,
            });
        });

        appendRound(2);
        await deliverMutations();

        expect(batches).toHaveLength(1);
        expect(batches[0]?.revision).toBe(1);
        expect(batches[0]?.kinds).toContain('structure');
        expect(batches[0]?.ids).toContain('assistant-2');
        expect(getChatGPTPageIndex(adapter).getObservationRevision()).toBe(1);
        unsubscribe();
    });

    it('attaches the current page URL and advances the surface epoch across route-bound host facts', async () => {
        const batches: Array<{ pageUrl: string; surfaceEpoch: number }> = [];
        const unsubscribe = getChatGPTPageIndex(adapter).subscribeObservations((batch) => {
            batches.push({ pageUrl: batch.pageUrl, surfaceEpoch: batch.surfaceEpoch });
        });

        appendRound(2);
        await deliverMutations();
        window.history.replaceState({}, '', '/workspace/g/project/c/conv_ABC-12345678');
        appendRound(3);
        await deliverMutations();

        expect(batches).toHaveLength(2);
        expect(batches[0]?.pageUrl).toContain('/c/12345678-1234-1234-1234-123456789abc');
        expect(batches[1]?.pageUrl).toContain('/workspace/g/project/c/conv_ABC-12345678');
        expect(batches[1]!.surfaceEpoch).toBeGreaterThan(batches[0]!.surfaceEpoch);
        unsubscribe();
    });

    it('keeps the surface epoch stable for query and hash changes on the same route', async () => {
        const epochs: number[] = [];
        const unsubscribe = getChatGPTPageIndex(adapter).subscribeObservations((batch) => {
            epochs.push(batch.surfaceEpoch);
        });

        appendRound(2);
        await deliverMutations();
        window.history.replaceState({}, '', '/c/12345678-1234-1234-1234-123456789abc?model=test#latest');
        appendRound(3);
        await deliverMutations();

        expect(epochs).toHaveLength(2);
        expect(epochs[1]).toBe(epochs[0]);
        unsubscribe();
    });

    it('does not treat localized aria-label changes as content lifecycle signals', async () => {
        const assistantTurn = document.querySelector('[data-turn="assistant"]');
        if (!(assistantTurn instanceof HTMLElement)) throw new Error('fixture assistant turn is missing');
        const unrelatedButton = document.createElement('button');
        unrelatedButton.setAttribute('aria-label', 'Stop sharing');
        assistantTurn.appendChild(unrelatedButton);

        const listener = vi.fn();
        const unsubscribe = getChatGPTPageIndex(adapter).subscribeMutations(listener);

        unrelatedButton.setAttribute('aria-label', '停止共享');
        await deliverMutations();

        expect(listener).not.toHaveBeenCalled();
        unsubscribe();
    });

    it('ignores unrelated host child-list churn outside conversation lifecycle nodes', async () => {
        const listener = vi.fn();
        const unsubscribe = getChatGPTPageIndex(adapter).subscribeMutations(listener);

        document.body.insertAdjacentHTML('beforeend', '<aside><span>Unrelated live-region update</span></aside>');
        await deliverMutations();

        expect(listener).not.toHaveBeenCalled();
        unsubscribe();
    });

    it('keeps notifying navigation subscribers when another subscriber fails', async () => {
        const survivingListener = vi.fn();
        const unsubscribeFailing = subscribeChatGPTDomRoundChanges(adapter, () => {
            throw new Error('directory render failed');
        });
        const unsubscribeSurviving = subscribeChatGPTDomRoundChanges(adapter, survivingListener);

        appendRound(2);
        await deliverMutations();

        expect(survivingListener).toHaveBeenCalledTimes(1);
        unsubscribeFailing();
        unsubscribeSurviving();
    });

    it('does not issue more DOM queries when multiple callers read an unchanged 200-round page', () => {
        for (let index = 2; index <= 200; index += 1) appendRound(index);
        const querySelectorAll = vi.spyOn(Element.prototype, 'querySelectorAll');

        try {
            const firstTurns = collectConversationTurnRefs(adapter);
            const discoveryQueryCount = querySelectorAll.mock.calls.length;

            collectConversationTurnRefs(adapter);
            adapter.getConversationGroupRefs();

            expect(firstTurns).toHaveLength(200);
            expect(discoveryQueryCount).toBeGreaterThan(0);
            expect(querySelectorAll.mock.calls.length).toBe(discoveryQueryCount);
        } finally {
            querySelectorAll.mockRestore();
        }
    }, 10_000);

    it('does not invalidate for extension-owned toolbar insertion or bookkeeping attributes', async () => {
        const first = collectChatGPTDomRoundRefs(adapter);
        const actionRow = document.querySelector('.z-0.flex');
        const assistant = document.querySelector('[data-message-id="assistant-1"]');
        if (!(actionRow instanceof HTMLElement) || !(assistant instanceof HTMLElement)) {
            throw new Error('fixture action row is missing');
        }

        const toolbar = document.createElement('div');
        toolbar.dataset.aimdRole = 'message-toolbar';
        actionRow.appendChild(toolbar);
        assistant.dataset.aimdMsgPosition = '1';
        await deliverMutations();

        expect(collectChatGPTDomRoundRefs(adapter)).toBe(first);
    });

    it('publishes removed extension consumers as Surface-only lifecycle without invalidating content', async () => {
        const first = collectChatGPTDomRoundRefs(adapter);
        const batches: Array<{ kinds: readonly string[] }> = [];
        const unsubscribe = getChatGPTPageIndex(adapter).subscribeObservations((batch) => {
            batches.push({ kinds: batch.kinds });
        });
        const consumer = document.createElement('div');
        consumer.dataset.aimdRole = 'chatgpt-directory-rail';
        consumer.setAttribute(AIMD_CONVERSATION_SURFACE_CONSUMER_ATTRIBUTE, '');
        document.body.appendChild(consumer);
        await deliverMutations();
        batches.length = 0;

        consumer.remove();
        await deliverMutations();

        expect(batches).toEqual([{ kinds: ['surface'] }]);
        expect(collectChatGPTDomRoundRefs(adapter)).toBe(first);
        unsubscribe();
    });

    it('invalidates for host attributes that can change message identity', async () => {
        const first = collectChatGPTDomRoundRefs(adapter);
        const listener = vi.fn();
        const unsubscribe = subscribeChatGPTDomRoundChanges(adapter, listener);
        const assistant = document.querySelector('[data-message-id="assistant-1"]');
        if (!(assistant instanceof HTMLElement)) throw new Error('fixture assistant is missing');

        assistant.setAttribute('data-message-id', 'assistant-updated');
        await deliverMutations();

        const changed = collectChatGPTDomRoundRefs(adapter);
        expect(changed).not.toBe(first);
        expect(changed.map((round) => round.id)).toEqual(['assistant-updated']);
        expect(listener).toHaveBeenCalledTimes(1);
        unsubscribe();
    });

    it('rebinds when ChatGPT replaces the conversation root', async () => {
        const first = collectChatGPTDomRoundRefs(adapter);
        const oldMain = document.querySelector('main');
        if (!(oldMain instanceof HTMLElement)) throw new Error('fixture main is missing');

        const nextMain = document.createElement('main');
        oldMain.replaceWith(nextMain);
        appendRound(2);
        await deliverMutations();

        const changed = collectChatGPTDomRoundRefs(adapter);
        expect(changed).not.toBe(first);
        expect(changed.map((round) => round.id)).toEqual(['assistant-2']);
    });

    it('disconnects and releases all snapshot layers when the adapter is disposed', () => {
        const disconnect = vi.spyOn(MutationObserver.prototype, 'disconnect');
        try {
            const firstSnapshot = collectChatGPTDomRoundRefs(adapter);
            const firstTurns = collectConversationTurnRefs(adapter);
            const firstIndex = getChatGPTPageIndex(adapter);

            adapter.dispose();
            const rebuiltSnapshot = collectChatGPTDomRoundRefs(adapter);
            const rebuiltTurns = collectConversationTurnRefs(adapter);
            const rebuiltIndex = getChatGPTPageIndex(adapter);

            expect(disconnect).toHaveBeenCalled();
            expect(rebuiltSnapshot).not.toBe(firstSnapshot);
            expect(rebuiltTurns).not.toBe(firstTurns);
            expect(rebuiltIndex).not.toBe(firstIndex);
        } finally {
            disconnect.mockRestore();
        }
    });
});
