import { describe, expect, it, vi } from 'vitest';

import {
    ConversationContentAcquisitionError,
    ConversationContentRepository,
    type ConversationContentCandidateV1,
} from '@/services/content/ConversationContentRepository';
import { createConversationDocumentKeyV1, type ConversationDocumentRefV1 } from '@/contracts/conversationContent';
import { ChatGPTAdapter } from '@/drivers/content/adapters/sites/chatgpt';
import { ChatGPTConversationContentRuntime } from '@/runtimes/content/ChatGPTConversationContentRuntime';
import { buildChatGPTReaderContent } from '@/services/reader/chatgptReaderItems';
import { ChatGPTDirectoryController } from '@/ui/content/controllers/ChatGPTDirectoryController';
import { MessageToolbarOrchestrator } from '@/ui/content/controllers/MessageToolbarOrchestrator';

function ref(id: string): ConversationDocumentRefV1 {
    return {
        key: createConversationDocumentKeyV1('chatgpt', id),
        platformId: 'chatgpt',
        conversationId: id,
        canonicalUrl: `https://chatgpt.com/c/${id}`,
    };
}

function candidate(document: ConversationDocumentRefV1, count: number): ConversationContentCandidateV1 {
    return {
        document,
        coverage: 'complete',
        turns: Array.from({ length: count }, (_, index) => ({
            key: `turn-${index + 1}`,
            ordinal: index + 1,
            identity: {
                turnId: `turn-${index + 1}`,
                userMessageId: `user-${index + 1}`,
                assistantMessageId: `assistant-${index + 1}`,
            },
            userText: `Question ${index + 1}`,
            assistantMarkdown: `Answer ${index + 1}`,
        })),
    };
}

describe('ChatGPT content discovery lifecycle', () => {
    it('uses the passive graph prompt when the conversation DOM contains only empty slots', async () => {
        const conversationId = '6a733f28-5954-83ec-980e-2b824a431951';
        history.replaceState({}, '', `/c/${conversationId}`);
        document.documentElement.innerHTML = '<head></head><body><main></main></body>';
        document.querySelector('main')!.innerHTML = `
            <div data-turn-id-container="client-created-root"></div>
            <div data-turn-id-container="user-slot-1"></div>
            <div data-turn-id-container="assistant-slot-1"></div>
            <div data-turn-id-container="user-slot-2"></div>
            <div data-turn-id-container="assistant-slot-2"></div>
        `;

        const graphSnapshot = {
            conversationId,
            capturedAt: 10,
            branchKey: 'assistant-node-2',
            coverage: 'complete' as const,
            rounds: [
                {
                    id: 'turn-1',
                    position: 1,
                    userPrompt: 'Prompt from the passive graph 1',
                    assistantContent: 'Answer 1',
                    preview: 'Prompt from the passive graph 1',
                    messageId: 'assistant-1',
                    userMessageId: 'user-1',
                    assistantMessageId: 'assistant-1',
                },
                {
                    id: 'turn-2',
                    position: 2,
                    userPrompt: 'Prompt from the passive graph 2',
                    assistantContent: 'Answer 2',
                    preview: 'Prompt from the passive graph 2',
                    messageId: 'assistant-2',
                    userMessageId: 'user-2',
                    assistantMessageId: 'assistant-2',
                },
            ],
        };
        const responder = ((event: Event) => {
            const request = (event as CustomEvent<any>).detail;
            if (request?.type !== 'peek') return;
            window.dispatchEvent(new CustomEvent('aimd:chatgpt-conversation-bridge:response', {
                detail: {
                    requestId: request.requestId,
                    ok: true,
                    snapshot: graphSnapshot,
                },
            }));
        }) as EventListener;
        window.addEventListener('aimd:chatgpt-conversation-bridge:request', responder);

        const runtime = new ChatGPTConversationContentRuntime(new ChatGPTAdapter());
        try {
            runtime.init();
            const state = await runtime.source.refresh();

            expect(state.kind).toBe('ready');
            if (state.kind !== 'ready') throw new Error('expected graph-backed ready state');
            expect(state.snapshot.turns.map((turn) => turn.userText)).toEqual([
                'Prompt from the passive graph 1',
                'Prompt from the passive graph 2',
            ]);
        } finally {
            window.removeEventListener('aimd:chatgpt-conversation-bridge:request', responder);
            runtime.dispose();
        }
    });

    it('consumes one passive baseline and appends later stable DOM turns without replaying the bridge', async () => {
        const conversationId = '6a733f28-5954-83ec-980e-2b824a431952';
        history.replaceState({}, '', `/c/${conversationId}`);
        document.documentElement.innerHTML = '<head></head><body><main></main></body>';
        const graphSnapshot = {
            conversationId,
            capturedAt: 10,
            branchKey: 'assistant-1',
            coverage: 'complete' as const,
            rounds: [{
                id: 'turn-1',
                position: 1,
                userPrompt: 'Question 1',
                assistantContent: 'Answer 1',
                preview: 'Question 1',
                messageId: 'assistant-1',
                userMessageId: 'user-1',
                assistantMessageId: 'assistant-1',
            }],
        };
        let bridgeRequests = 0;
        const responder = ((event: Event) => {
            const request = (event as CustomEvent<any>).detail;
            if (request?.type !== 'peek') return;
            bridgeRequests += 1;
            window.dispatchEvent(new CustomEvent('aimd:chatgpt-conversation-bridge:response', {
                detail: { requestId: request.requestId, ok: true, snapshot: graphSnapshot },
            }));
        }) as EventListener;
        window.addEventListener('aimd:chatgpt-conversation-bridge:request', responder);

        const adapter = new ChatGPTAdapter();
        const runtime = new ChatGPTConversationContentRuntime(adapter, { hostSettleDelayMs: 20 });
        const toolbarOrchestrator = new MessageToolbarOrchestrator(adapter, {
            readerPanel: { setTheme() {}, show: async () => undefined } as any,
            conversationContentSource: runtime.source,
            conversationMaterialization: runtime.materialization,
            conversationSurface: runtime.surface,
        });
        try {
            runtime.init();
            toolbarOrchestrator.init();
            const baseline = await runtime.source.refresh();
            expect(baseline.kind).toBe('ready');
            expect(bridgeRequests).toBe(1);

            document.querySelector('main')!.innerHTML = `
                <div data-turn-id-container="client-created-root"></div>
                <div data-turn-id-container="user-slot-1">
                    <section data-turn="user" data-turn-id="turn-1">
                        <div data-message-author-role="user" data-message-id="user-1">Question 1</div>
                    </section>
                </div>
                <div data-turn-id-container="assistant-slot-1">
                    <section data-turn="assistant" data-turn-id="turn-1">
                        <div data-message-author-role="assistant" data-message-id="assistant-1">
                            <div class="markdown prose"><p>Answer 1</p></div>
                        </div>
                        <div class="z-0 flex"><button data-testid="copy-turn-action-button">Copy</button></div>
                    </section>
                </div>
                <div id="user-slot-2" data-turn-id-container="user-slot-2"></div>
                <div id="assistant-slot-2" data-turn-id-container="assistant-slot-2"></div>
            `;
            await Promise.resolve();

            document.getElementById('user-slot-2')!.innerHTML = `
                <div>
                    <section data-turn="user" data-turn-id="turn-2">
                        <div data-message-author-role="user" data-message-id="user-2">Question 2</div>
                    </section>
                </div>
            `;
            await Promise.resolve();

            document.getElementById('assistant-slot-2')!.innerHTML = `
                <div>
                    <section data-turn="assistant" data-turn-id="turn-2">
                        <div data-message-author-role="assistant" data-message-id="assistant-2">
                            <div class="markdown prose"><p>Answer 2 from DOM</p></div>
                        </div>
                    </section>
                </div>
            `;
            await Promise.resolve();

            document.querySelector('#assistant-slot-2 section')!.insertAdjacentHTML(
                'beforeend',
                '<div class="z-0 flex"><button data-testid="copy-turn-action-button">Copy</button></div>',
            );

            await vi.waitFor(() => {
                expect(runtime.source.read().snapshot?.proof?.basis).toBe('hybrid');
            });
            const hybrid = await runtime.source.refresh();
            expect(hybrid.kind).toBe('ready');
            if (hybrid.kind !== 'ready') throw new Error('expected a hybrid ready state');
            expect(hybrid.snapshot.proof?.basis).toBe('hybrid');
            expect(hybrid.snapshot.turns.map((turn) => turn.assistantMarkdown)).toEqual([
                'Answer 1',
                'Answer 2 from DOM',
            ]);
            expect(hybrid.snapshot.turns[1]?.assistantProvenance?.authority).toBe('host-rendered');
            const secondToolbar = document.querySelector('[data-message-id="assistant-2"]')
                ?.closest('section')
                ?.querySelector<HTMLElement>('[data-aimd-role="message-toolbar"]');
            const secondStats = secondToolbar?.shadowRoot
                ?.querySelector<HTMLElement>('[data-role="stats"]')
                ?.textContent?.trim();
            expect(secondToolbar).toBeTruthy();
            expect(secondStats).toBeTruthy();
            expect(secondStats).not.toContain('—');

            window.dispatchEvent(new CustomEvent('aimd:chatgpt-conversation-bridge:capture', {
                detail: { kind: 'graph', conversationId },
            }));
            await new Promise((resolve) => window.setTimeout(resolve, 220));
            expect(bridgeRequests).toBe(1);
            expect(runtime.source.read().snapshot?.contentToken).toBe(hybrid.snapshot.contentToken);

            document.querySelector('main')?.insertAdjacentHTML('beforeend', `
                <div data-turn-id-container="user-slot-3">
                    <section data-turn="user" data-turn-id="turn-3">
                        <div data-message-author-role="user" data-message-id="user-3">Question 3</div>
                    </section>
                </div>
                <div data-turn-id-container="assistant-slot-3">
                    <section data-turn="assistant" data-turn-id="turn-3">
                        <div data-message-author-role="assistant" data-message-id="assistant-3">
                            <div class="markdown prose"><p>Answer 3 from DOM</p></div>
                        </div>
                        <div class="z-0 flex"><button data-testid="copy-turn-action-button">Copy</button></div>
                    </section>
                </div>
            `);
            await new Promise((resolve) => window.setTimeout(resolve, 80));
            expect(runtime.source.read().snapshot?.turns).toHaveLength(3);

            document.querySelector('main')?.insertAdjacentHTML('beforeend', `
                <div data-turn-id-container="user-slot-4">
                    <section data-turn="user" data-turn-id="turn-4">
                        <div data-message-author-role="user" data-message-id="user-4">Question 4</div>
                    </section>
                </div>
                <div data-turn-id-container="assistant-slot-4">
                    <section data-turn="assistant" data-turn-id="turn-4">
                        <div data-message-author-role="assistant" data-message-id="assistant-4">
                            <div class="markdown prose"><p>Answer 4 from DOM</p></div>
                        </div>
                        <div class="z-0 flex"><button data-testid="copy-turn-action-button">Copy</button></div>
                    </section>
                </div>
            `);
            await new Promise((resolve) => window.setTimeout(resolve, 80));
            const finalHybrid = runtime.source.read();
            expect(finalHybrid.kind).toBe('ready');
            if (finalHybrid.kind !== 'ready') throw new Error('expected the complete DOM tail');
            expect(finalHybrid.snapshot.turns.map((turn) => turn.assistantMarkdown)).toEqual([
                'Answer 1',
                'Answer 2 from DOM',
                'Answer 3 from DOM',
                'Answer 4 from DOM',
            ]);
            expect(buildChatGPTReaderContent(finalHybrid.snapshot).items).toHaveLength(4);
            expect(runtime.materialization.read().entries).toHaveLength(4);
            const toolbarHosts = Array.from(document.querySelectorAll<HTMLElement>(
                '[data-aimd-role="message-toolbar"]',
            ));
            expect(toolbarHosts).toHaveLength(4);
            expect(toolbarHosts.every((host) => {
                const stats = host.shadowRoot?.querySelector<HTMLElement>('[data-role="stats"]')?.textContent ?? '';
                return /\d/.test(stats) && !stats.includes('—');
            })).toBe(true);
            const finalToken = finalHybrid.snapshot.contentToken;

            document.querySelector('[data-turn-id-container="user-slot-2"]')?.remove();
            document.querySelector('[data-turn-id-container="assistant-slot-2"]')?.remove();
            await new Promise((resolve) => window.setTimeout(resolve, 30));
            expect(runtime.source.read().snapshot?.contentToken).toBe(finalToken);
            expect(document.querySelector('[data-message-id="assistant-2"]')).toBeNull();

            document.querySelector('main')?.insertAdjacentHTML('beforeend', `
                <div data-turn-id-container="user-slot-2">
                    <section data-turn="user" data-turn-id="turn-2">
                        <div data-message-author-role="user" data-message-id="user-2">Question 2</div>
                    </section>
                </div>
                <div data-turn-id-container="assistant-slot-2">
                    <section data-turn="assistant" data-turn-id="turn-2">
                        <div data-message-author-role="assistant" data-message-id="assistant-2">
                            <div class="markdown prose"><p>Answer 2 from DOM</p></div>
                        </div>
                        <div class="z-0 flex"><button data-testid="copy-turn-action-button">Copy</button></div>
                    </section>
                </div>
            `);
            await new Promise((resolve) => window.setTimeout(resolve, 50));
            expect(runtime.source.read().snapshot?.contentToken).toBe(finalToken);
            expect(document.querySelectorAll(
                '[data-message-id="assistant-2"] ~ .z-0.flex [data-aimd-role="message-toolbar"]',
            )).toHaveLength(1);
        } finally {
            window.removeEventListener('aimd:chatgpt-conversation-bridge:request', responder);
            toolbarOrchestrator.dispose();
            runtime.dispose();
            adapter.dispose();
        }
    });

    it('keeps a closed baseline immutable and opens a fresh gate only for a new page runtime', async () => {
        let current = ref('conversation-1');
        let available: ConversationContentCandidateV1 | null = candidate(current, 1);
        const repository = new ConversationContentRepository({
            resolveDocument: () => current,
            readBaseline: async () => available,
        });

        const first = await repository.enterCurrentEpoch();
        expect(first.kind).toBe('ready');
        if (first.kind !== 'ready') throw new Error('expected ready state');
        const firstToken = first.snapshot.contentToken;

        available = candidate(current, 2);
        const unchanged = await repository.refresh();
        expect(unchanged.kind).toBe('ready');
        if (unchanged.kind !== 'ready') throw new Error('expected ready state');
        expect(unchanged.snapshot.turns).toHaveLength(1);
        expect(unchanged.snapshot.contentToken).toBe(firstToken);

        const hardRefreshedRepository = new ConversationContentRepository({
            resolveDocument: () => current,
            readBaseline: async () => available,
        });
        const refreshed = await hardRefreshedRepository.enterCurrentEpoch();
        expect(refreshed.kind).toBe('ready');
        if (refreshed.kind !== 'ready') throw new Error('expected ready state');
        expect(refreshed.snapshot.turns).toHaveLength(2);
        expect(refreshed.snapshot.contentToken).not.toBe(firstToken);
    });

    it('fails closed when no passive graph has been captured', async () => {
        const conversationId = '6a733f28-5954-83ec-980e-2b824a431951';
        history.replaceState({}, '', `/c/${conversationId}`);
        document.documentElement.innerHTML = '<head></head><body><main></main></body>';
        const main = document.querySelector('main') as HTMLElement;
        main.innerHTML = `
            <div data-turn-id-container="client-created-root"></div>
            <div data-turn-id-container="user-slot-1" data-turn-id="turn-1">
                <div data-message-author-role="user" data-message-id="user-message-1" data-turn-id="turn-1">
                    <div class="whitespace-pre-wrap">Completed follow-up</div>
                </div>
            </div>
            <div data-turn-id-container="assistant-slot-1" data-turn-id="turn-1">
                <div data-message-author-role="assistant" data-message-id="assistant-message-1" data-turn-id="turn-1">
                    <div class="markdown prose"><p>Completed answer</p></div>
                </div>
            </div>
        `;
        const fetchSpy = vi.spyOn(window, 'fetch');

        const adapter = new ChatGPTAdapter();
        const runtime = new ChatGPTConversationContentRuntime(adapter, { hostSettleDelayMs: 20 });
        try {
            runtime.init();
            const state = await runtime.source.refresh();
            expect(state.kind).toBe('unavailable');
            expect(fetchSpy).not.toHaveBeenCalled();
        } finally {
            runtime.dispose();
            adapter.dispose();
            fetchSpy.mockRestore();
        }
    });

    it('does not turn last-good content stale by replaying a closed gate on refresh', async () => {
        const document = ref('conversation-1');
        let fail = false;
        const repository = new ConversationContentRepository({
            resolveDocument: () => document,
            readBaseline: async () => {
                if (fail) throw new ConversationContentAcquisitionError('source-timeout');
                return candidate(document, 1);
            },
        });

        await repository.enterCurrentEpoch();
        fail = true;
        const unchanged = await repository.refresh();
        expect(unchanged.kind).toBe('ready');
        if (unchanged.kind !== 'ready') throw new Error('expected ready state');
        expect(unchanged.snapshot.turns).toHaveLength(1);
        fail = false;
        const recovered = await repository.refresh();
        expect(recovered.kind).toBe('ready');
    });

    it('drops a stale A result after a route switch to B', async () => {
        let current = ref('conversation-a');
        let resolveA!: (candidate: ConversationContentCandidateV1) => void;
        let resolveB!: (candidate: ConversationContentCandidateV1) => void;
        const pendingA = new Promise<ConversationContentCandidateV1>((resolve) => { resolveA = resolve; });
        const pendingB = new Promise<ConversationContentCandidateV1>((resolve) => { resolveB = resolve; });
        const repository = new ConversationContentRepository({
            resolveDocument: () => current,
            readBaseline: async (document) => document.conversationId === 'conversation-a' ? pendingA : pendingB,
        });

        const a = repository.enterCurrentEpoch();
        current = ref('conversation-b');
        const b = repository.enterCurrentEpoch();
        resolveA(candidate(ref('conversation-a'), 1));
        resolveB(candidate(ref('conversation-b'), 2));
        await a;
        const ready = await b;

        expect(ready.kind).toBe('ready');
        if (ready.kind !== 'ready') throw new Error('expected ready state');
        expect(ready.document.conversationId).toBe('conversation-b');
        expect(ready.snapshot.turns).toHaveLength(2);
    });

    it('does not seed a new route from the previous route surface before new host facts arrive', async () => {
        document.documentElement.innerHTML = '<head></head><body><main></main></body>';
        history.replaceState({}, '', '/c/conversation-route-a');
        document.querySelector('main')!.innerHTML = `
            <article data-turn="user" data-turn-id="turn-a">
                <div data-message-author-role="user" data-message-id="user-a">Question A</div>
            </article>
            <article data-turn="assistant" data-turn-id="turn-a">
                <div data-message-author-role="assistant" data-message-id="assistant-a">
                    <div class="markdown prose">Answer A</div>
                </div>
                <div class="z-0 flex"><button data-testid="copy-turn-action-button">Copy</button></div>
            </article>
        `;
        const adapter = new ChatGPTAdapter();
        const runtime = new ChatGPTConversationContentRuntime(adapter, { hostSettleDelayMs: 20 });
        const toolbarOrchestrator = new MessageToolbarOrchestrator(adapter, {
            readerPanel: { setTheme() {}, show: async () => undefined } as any,
            conversationContentSource: runtime.source,
            conversationMaterialization: runtime.materialization,
            conversationSurface: runtime.surface,
        });
        const responder = ((event: Event) => {
            const request = (event as CustomEvent<any>).detail;
            window.dispatchEvent(new CustomEvent('aimd:chatgpt-conversation-bridge:response', {
                detail: {
                    requestId: request.requestId,
                    ok: false,
                    error: { code: 'BRIDGE_UNAVAILABLE', retryable: true },
                },
            }));
        }) as EventListener;
        window.addEventListener('aimd:chatgpt-conversation-bridge:request', responder);

        try {
            runtime.init();
            toolbarOrchestrator.init();
            await new Promise((resolve) => window.setTimeout(resolve, 50));
            expect(runtime.source.read().snapshot?.turns[0]?.assistantMarkdown).toBe('Answer A');

            history.replaceState({}, '', '/c/conversation-route-b');
            await new Promise((resolve) => window.setTimeout(resolve, 50));

            const beforeHostFacts = runtime.source.read();
            expect(beforeHostFacts.document?.conversationId).toBe('conversation-route-b');
            expect(beforeHostFacts.snapshot).toBeNull();

            document.querySelector('main')!.innerHTML = `
                <article data-turn="user" data-turn-id="turn-b">
                    <div data-message-author-role="user" data-message-id="user-b">Question B</div>
                </article>
                <article data-turn="assistant" data-turn-id="turn-b">
                    <div data-message-author-role="assistant" data-message-id="assistant-b">
                        <div class="markdown prose">Answer B</div>
                    </div>
                    <div class="z-0 flex"><button data-testid="copy-turn-action-button">Copy</button></div>
                </article>
            `;
            await new Promise((resolve) => window.setTimeout(resolve, 50));

            const readyB = runtime.source.read();
            expect(readyB.kind).toBe('ready');
            if (readyB.kind !== 'ready') throw new Error('expected route B host facts');
            expect(readyB.snapshot.turns.map((turn) => turn.assistantMarkdown)).toEqual(['Answer B']);
        } finally {
            window.removeEventListener('aimd:chatgpt-conversation-bridge:request', responder);
            toolbarOrchestrator.dispose();
            runtime.dispose();
            adapter.dispose();
        }
    });

    it('keeps stable DOM content consumable when passive source capture is unavailable', async () => {
        document.documentElement.innerHTML = '<head></head><body><main></main></body>';
        history.replaceState({}, '', '/c/695499b7-464c-8323-a998-119f661ac953');
        document.querySelector('main')?.insertAdjacentHTML('beforeend', `
            <article data-turn="user" data-turn-id="user-turn-1">
                <div data-message-author-role="user" data-message-id="user-1">
                    <div class="whitespace-pre-wrap">Question 1</div>
                </div>
            </article>
            <article data-turn="assistant" data-turn-id="assistant-turn-1">
                <div data-message-author-role="assistant" data-message-id="assistant-1">
                    <div class="markdown prose">Answer 1</div>
                </div>
                <div class="z-0 flex"><button data-testid="copy-turn-action-button">Copy</button></div>
            </article>
        `);
        const adapter = new ChatGPTAdapter();
        const runtime = new ChatGPTConversationContentRuntime(adapter, { hostSettleDelayMs: 20 });
        let directory: ChatGPTDirectoryController | null = null;
        try {
            runtime.init();
            await new Promise((resolve) => window.setTimeout(resolve, 25));
            const first = await runtime.source.refresh();
            expect(first.kind).toBe('ready');
            if (first.kind !== 'ready') throw new Error('expected a host-ready snapshot');
            expect(first.snapshot.proof).toEqual({ basis: 'host' });
            expect(first.snapshot.turns.map((turn) => turn.assistantMarkdown)).toEqual(['Answer 1']);

            directory = new ChatGPTDirectoryController(adapter, null, {
                surface: runtime.surface,
                contentSource: runtime.source,
                materialization: runtime.materialization,
            });
            directory.init('light');
            const mountedRail = document.getElementById('aimd-chatgpt-directory-rail');
            expect(mountedRail?.parentElement).toBe(document.body);
            expect(mountedRail?.shadowRoot?.querySelectorAll('.rail__item')).toHaveLength(1);

            document.querySelector('main')?.insertAdjacentHTML('beforeend', `
                <article data-turn="user" data-turn-id="user-turn-2">
                    <div data-message-author-role="user" data-message-id="user-2">
                        <div class="whitespace-pre-wrap">Question 2</div>
                    </div>
                </article>
                <article data-turn="assistant" data-turn-id="assistant-turn-2">
                    <div data-message-author-role="assistant" data-message-id="assistant-2">
                        <div class="markdown prose">Answer 2</div>
                    </div>
                    <div class="z-0 flex"><button data-testid="copy-turn-action-button">Copy</button></div>
                </article>
            `);
            await new Promise((resolve) => window.setTimeout(resolve, 700));
            const second = runtime.source.read();
            expect(second.kind).toBe('ready');
            if (second.kind !== 'ready') throw new Error('expected the DOM tail in the shared pool');
            expect(second.snapshot.turns.map((turn) => turn.assistantMarkdown)).toEqual([
                'Answer 1',
                'Answer 2',
            ]);
            expect(mountedRail?.shadowRoot?.querySelectorAll('.rail__item')).toHaveLength(2);
        } finally {
            directory?.dispose();
            runtime.dispose();
            adapter.dispose();
        }
    });

    it('publishes a stable DOM-only first turn in a canonical conversation', async () => {
        document.documentElement.innerHTML = '<head></head><body><main></main></body>';
        history.replaceState({}, '', '/c/6a72103d-0a30-83ec-b432-b27dab6e72e2');
        document.querySelector('main')?.insertAdjacentHTML('beforeend', `
            <section data-testid="conversation-turn-1" data-turn="user" data-turn-id="4bc0f3fc-3432-4579-8052-f184e4e94775">
                <div data-message-author-role="user" data-message-id="4bc0f3fc-3432-4579-8052-f184e4e94775">
                    <div class="whitespace-pre-wrap">请只回复：测试完成</div>
                </div>
            </section>
            <section data-testid="conversation-turn-2" data-turn="assistant" data-turn-id="request-WEB:68fd340e-b1b6-4435-8dc7-a9d9152e87f4-0">
                <div data-message-author-role="assistant" data-message-id="df373b17-35a9-4e33-8b86-30bebeaab455">
                    <div class="markdown prose">测试完成</div>
                </div>
                <div class="z-0 flex"><button data-testid="copy-turn-action-button">Copy</button></div>
            </section>
        `);
        const adapter = new ChatGPTAdapter();
        const runtime = new ChatGPTConversationContentRuntime(adapter);
        const responder = ((event: Event) => {
            const request = (event as CustomEvent<any>).detail;
            window.dispatchEvent(new CustomEvent('aimd:chatgpt-conversation-bridge:response', {
                detail: {
                    requestId: request.requestId,
                    ok: false,
                    error: { code: 'BRIDGE_UNAVAILABLE', retryable: true },
                },
            }));
        }) as EventListener;
        window.addEventListener('aimd:chatgpt-conversation-bridge:request', responder);
        try {
            runtime.init();
            await runtime.source.refresh();
            await new Promise((resolve) => window.setTimeout(resolve, 520));
            const state = runtime.source.read();
            expect(state.kind).toBe('ready');
            if (state.kind !== 'ready') throw new Error('expected a host-ready first turn');
            expect(state.snapshot.proof).toEqual({ basis: 'host' });
            expect(state.snapshot.turns[0]?.assistantMarkdown).toBe('测试完成');
        } finally {
            window.removeEventListener('aimd:chatgpt-conversation-bridge:request', responder);
            runtime.dispose();
            adapter.dispose();
        }
    });

    it('publishes a stable first turn while the page remains without a canonical conversation id', async () => {
        document.documentElement.innerHTML = '<head></head><body><main></main></body>';
        history.replaceState({}, '', '/');
        document.querySelector('main')?.insertAdjacentHTML('beforeend', `
            <section data-testid="conversation-turn-1" data-turn="user" data-turn-id="page-user-turn-1">
                <div data-message-author-role="user" data-message-id="page-user-1">Page-scoped question</div>
            </section>
            <section data-testid="conversation-turn-2" data-turn="assistant" data-turn-id="page-assistant-turn-1">
                <div data-message-author-role="assistant" data-message-id="page-assistant-1">
                    <div class="markdown prose">Page-scoped answer</div>
                </div>
                <div class="z-0 flex"><button data-testid="copy-turn-action-button">Copy</button></div>
            </section>
        `);
        const adapter = new ChatGPTAdapter();
        const runtime = new ChatGPTConversationContentRuntime(adapter, { hostSettleDelayMs: 20 });
        const refreshPositionsForUrl = vi.fn(async () => undefined);
        const bookmarkSaveDialog = { open: vi.fn() };
        const bookmarksController = {
            refreshPositionsForUrl,
            resolveConversationBookmarkPositions: vi.fn(() => new Set<number>()),
            isPositionBookmarked: vi.fn(() => false),
        };
        const toolbarOrchestrator = new MessageToolbarOrchestrator(adapter, {
            readerPanel: { setTheme() {}, show: async () => undefined } as any,
            bookmarksController: bookmarksController as any,
            bookmarkSaveDialog: bookmarkSaveDialog as any,
            conversationContentSource: runtime.source,
            conversationMaterialization: runtime.materialization,
            conversationSurface: runtime.surface,
        });
        let bridgeRequests = 0;
        const observeBridgeRequest = () => {
            bridgeRequests += 1;
        };
        window.addEventListener('aimd:chatgpt-conversation-bridge:request', observeBridgeRequest);

        try {
            runtime.init();
            toolbarOrchestrator.init();
            await new Promise((resolve) => window.setTimeout(resolve, 50));

            const state = runtime.source.read();
            expect(state.kind).toBe('ready');
            if (state.kind !== 'ready') throw new Error('expected page-scoped host content');
            expect(state.document).toMatchObject({
                identityKind: 'page',
                conversationId: null,
            });
            expect(state.snapshot.proof).toEqual({ basis: 'host' });
            expect(state.snapshot.turns.map((turn) => turn.assistantMarkdown)).toEqual([
                'Page-scoped answer',
            ]);
            expect(runtime.surface.readFrame()).toMatchObject({
                contentToken: state.snapshot.contentToken,
                obtainedTurns: [{
                    status: 'obtained',
                    turn: { identity: { assistantMessageId: 'page-assistant-1' } },
                    materialization: { messageElement: expect.any(HTMLElement) },
                }],
                pendingSurfaces: [],
            });
            const toolbar = document.querySelector('[data-message-id="page-assistant-1"]')
                ?.closest('section')
                ?.querySelector<HTMLElement>('[data-aimd-role="message-toolbar"]');
            const stats = toolbar?.shadowRoot
                ?.querySelector<HTMLElement>('[data-role="stats"]')
                ?.textContent?.trim() ?? '';
            expect(toolbar).toBeTruthy();
            expect(stats).toMatch(/\d/);
            expect(stats).not.toContain('—');
            expect(bridgeRequests).toBe(0);

            const bookmarkButton = toolbar?.shadowRoot
                ?.querySelector<HTMLButtonElement>('[data-action="bookmark_toggle"]');
            expect(bookmarkButton?.disabled).toBe(true);
            bookmarkButton?.click();
            await Promise.resolve();
            expect(bookmarkSaveDialog.open).not.toHaveBeenCalled();
            expect(refreshPositionsForUrl).not.toHaveBeenCalled();

            const projectionId = state.snapshot.projectionId;
            const contentToken = state.snapshot.contentToken;
            history.replaceState({}, '', '/c/page-promoted-conversation');
            await Promise.resolve();

            const promoted = runtime.source.read();
            expect(promoted.document?.conversationId).toBe('page-promoted-conversation');
            expect(promoted.snapshot?.projectionId).toBe(projectionId);
            expect(promoted.snapshot?.contentToken).toBe(contentToken);
            expect(bookmarkButton?.disabled).toBe(false);
            expect(refreshPositionsForUrl).toHaveBeenCalledWith(
                expect.stringContaining('/c/page-promoted-conversation'),
            );
        } finally {
            window.removeEventListener('aimd:chatgpt-conversation-bridge:request', observeBridgeRequest);
            toolbarOrchestrator.dispose();
            runtime.dispose();
            adapter.dispose();
        }
    });

    it('publishes generated content before a delayed action row and mounts numeric toolbar afterward', async () => {
        document.documentElement.innerHTML = '<head></head><body><main></main></body>';
        history.replaceState({}, '', '/');
        const adapter = new ChatGPTAdapter();
        const runtime = new ChatGPTConversationContentRuntime(adapter, { hostSettleDelayMs: 20 });
        const toolbarOrchestrator = new MessageToolbarOrchestrator(adapter, {
            readerPanel: { setTheme() {}, show: async () => undefined } as any,
            conversationContentSource: runtime.source,
            conversationMaterialization: runtime.materialization,
            conversationSurface: runtime.surface,
        });

        try {
            runtime.init();
            toolbarOrchestrator.init();
            document.body.insertAdjacentHTML('beforeend', '<button data-testid="stop-button">Stop</button>');
            document.querySelector('main')!.innerHTML = `
                <section data-turn="user" data-turn-id="turn-late-action">
                    <div data-message-author-role="user" data-message-id="user-late-action">Question</div>
                </section>
                <section data-turn="assistant" data-turn-id="turn-late-action">
                    <div data-message-author-role="assistant" data-message-id="assistant-late-action">
                        <div class="markdown prose">Answer before action row</div>
                    </div>
                </section>
            `;
            await Promise.resolve();
            document.querySelector('button[data-testid="stop-button"]')?.remove();

            await vi.waitFor(() => {
                expect(runtime.source.read().snapshot?.turns).toHaveLength(1);
            });
            const ready = runtime.source.read();
            expect(ready.kind).toBe('ready');
            if (ready.kind !== 'ready') throw new Error('expected host content before the action row');
            expect(buildChatGPTReaderContent(ready.snapshot).items).toHaveLength(1);
            expect(document.querySelector('[data-aimd-role="message-toolbar"]')).toBeNull();

            document.querySelector('section[data-turn="assistant"]')!.insertAdjacentHTML(
                'beforeend',
                '<div><button data-testid="copy-turn-action-button">Copy</button></div>',
            );
            await vi.waitFor(() => {
                const toolbar = document.querySelector<HTMLElement>('[data-aimd-role="message-toolbar"]');
                const stats = toolbar?.shadowRoot
                    ?.querySelector<HTMLElement>('[data-role="stats"]')
                    ?.textContent ?? '';
                expect(toolbar).toBeTruthy();
                expect(stats).toMatch(/\d/);
                expect(stats).not.toContain('—');
            });
        } finally {
            toolbarOrchestrator.dispose();
            runtime.dispose();
            adapter.dispose();
        }
    });

    it('starts a new page projection only after an id-less surface clears and a new generation begins', async () => {
        document.documentElement.innerHTML = '<head></head><body><main></main></body>';
        history.replaceState({}, '', '/');
        const main = document.querySelector('main')!;
        main.innerHTML = `
            <section data-turn="user" data-turn-id="turn-old">
                <div data-message-author-role="user" data-message-id="user-old">Old question</div>
            </section>
            <section data-turn="assistant" data-turn-id="turn-old">
                <div data-message-author-role="assistant" data-message-id="assistant-old">
                    <div class="markdown prose">Old answer</div>
                </div>
                <div><button data-testid="copy-turn-action-button">Copy</button></div>
            </section>
        `;
        const adapter = new ChatGPTAdapter();
        const runtime = new ChatGPTConversationContentRuntime(adapter, { hostSettleDelayMs: 20 });

        try {
            runtime.init();
            await vi.waitFor(() => {
                const first = runtime.source.read();
                expect(first.kind).toBe('ready');
            }, { timeout: 2000 });
            const first = runtime.source.read();
            if (first.kind !== 'ready') throw new Error('expected first page projection');
            const firstProjection = first.snapshot.projectionId;

            main.innerHTML = '';
            await Promise.resolve();
            main.innerHTML = `
                <section data-turn="user" data-turn-id="turn-new">
                    <div data-message-author-role="user" data-message-id="user-new">New question</div>
                </section>
                <section data-turn="assistant" data-turn-id="turn-new">
                    <div data-message-author-role="assistant" data-message-id="assistant-new">
                        <div class="streaming-animation markdown prose">New answer</div>
                    </div>
                    <button data-testid="stop-button">Stop</button>
                </section>
            `;
            await Promise.resolve();
            document.querySelector('.streaming-animation')?.classList.remove('streaming-animation');
            document.querySelector('button[data-testid="stop-button"]')?.replaceWith(
                Object.assign(document.createElement('button'), { textContent: 'Copy' }),
            );
            document.querySelector('section[data-turn="assistant"] button')?.setAttribute(
                'data-testid',
                'copy-turn-action-button',
            );

            await vi.waitFor(() => {
                const second = runtime.source.read();
                expect(second.kind).toBe('ready');
                expect(second.snapshot?.projectionId).not.toBe(firstProjection);
            }, { timeout: 2000 });
            const second = runtime.source.read();
            if (second.kind !== 'ready') throw new Error('expected second page projection');
            expect(second.snapshot.projectionId).not.toBe(firstProjection);
            expect(second.snapshot.turns.map((turn) => turn.identity.assistantMessageId)).toEqual([
                'assistant-new',
            ]);
        } finally {
            runtime.dispose();
            adapter.dispose();
        }
    });

    it('publishes DOM completion without requiring a source Graph', async () => {
        document.documentElement.innerHTML = '<head></head><body><main></main></body>';
        history.replaceState({}, '', '/c/6a721381-e3ec-83ec-ba07-2c2885d2b9c6');
        document.querySelector('main')?.insertAdjacentHTML('beforeend', `
            <section data-testid="conversation-turn-1" data-turn="user" data-turn-id="49d91808-f25e-4fd0-9cb8-314c43d83fed">
                <div data-message-author-role="user" data-message-id="49d91808-f25e-4fd0-9cb8-314c43d83fed">
                    <div class="whitespace-pre-wrap">请只回复：首轮探针</div>
                </div>
            </section>
            <section data-testid="conversation-turn-2" data-turn="assistant" data-turn-id="request-WEB:0f334e86-fcac-460a-9dc0-5b3dd2a6977a-0">
                <div data-message-author-role="assistant" data-message-id="ac579e24-71d7-45a4-8b8b-5fc07f3761f5">
                    <div class="markdown prose"></div>
                </div>
                <div class="z-0 flex">
                    <button data-testid="copy-turn-action-button">Copy</button>
                    <button data-testid="stop-button">Stop</button>
                </div>
            </section>
        `);
        const adapter = new ChatGPTAdapter();
        const runtime = new ChatGPTConversationContentRuntime(adapter);
        const responder = ((event: Event) => {
            const request = (event as CustomEvent<any>).detail;
            window.dispatchEvent(new CustomEvent('aimd:chatgpt-conversation-bridge:response', {
                detail: {
                    requestId: request.requestId,
                    ok: false,
                    error: { code: 'BRIDGE_UNAVAILABLE', retryable: true },
                },
            }));
        }) as EventListener;
        window.addEventListener('aimd:chatgpt-conversation-bridge:request', responder);
        try {
            runtime.init();
            const collecting = await runtime.source.refresh();
            expect(collecting.kind).toBe('unavailable');

            const markdown = document.querySelector('.markdown.prose');
            const stop = document.querySelector('button[data-testid="stop-button"]');
            if (!(markdown instanceof HTMLElement) || !(stop instanceof HTMLElement)) {
                throw new Error('first-turn completion controls are missing');
            }
            markdown.textContent = '首轮探针完成';
            stop.remove();

            await new Promise((resolve) => window.setTimeout(resolve, 520));
            const ready = runtime.source.read();
            expect(ready.kind).toBe('ready');
            if (ready.kind !== 'ready') throw new Error('expected stable DOM completion');
            expect(ready.snapshot.proof).toEqual({ basis: 'host' });
            expect(ready.snapshot.turns[0]?.assistantMarkdown).toBe('首轮探针完成');
        } finally {
            window.removeEventListener('aimd:chatgpt-conversation-bridge:request', responder);
            runtime.dispose();
            adapter.dispose();
        }
    });

    it('recovers a completed host body without a source Graph', async () => {
        document.documentElement.innerHTML = '<head></head><body><main></main></body>';
        history.replaceState({}, '', '/c/6a7214b7-0a30-83ec-ba07-2c2885d2b9c6');
        document.querySelector('main')?.insertAdjacentHTML('beforeend', `
            <section data-testid="conversation-turn-1" data-turn="user" data-turn-id="user-turn-refresh">
                <div data-message-author-role="user" data-message-id="user-refresh">
                    <div class="whitespace-pre-wrap">Refresh me</div>
                </div>
            </section>
            <section data-testid="conversation-turn-2" data-turn="assistant" data-turn-id="assistant-turn-refresh">
                <div data-message-author-role="assistant" data-message-id="assistant-refresh">
                    <div class="markdown prose"></div>
                </div>
                <div class="z-0 flex"><button data-testid="copy-turn-action-button">Copy</button></div>
            </section>
        `);
        const adapter = new ChatGPTAdapter();
        const runtime = new ChatGPTConversationContentRuntime(adapter);
        const responder = ((event: Event) => {
            const request = (event as CustomEvent<any>).detail;
            window.dispatchEvent(new CustomEvent('aimd:chatgpt-conversation-bridge:response', {
                detail: {
                    requestId: request.requestId,
                    ok: false,
                    error: { code: 'BRIDGE_UNAVAILABLE', retryable: true },
                },
            }));
        }) as EventListener;
        window.addEventListener('aimd:chatgpt-conversation-bridge:request', responder);
        try {
            runtime.init();
            const initial = await runtime.source.refresh();
            expect(initial.kind).toBe('unavailable');

            const markdown = document.querySelector('.markdown.prose');
            if (!(markdown instanceof HTMLElement)) throw new Error('assistant body is missing');
            markdown.textContent = 'Loaded after refresh';

            await new Promise((resolve) => window.setTimeout(resolve, 520));
            const recovered = runtime.source.read();
            expect(recovered.kind).toBe('ready');
            if (recovered.kind !== 'ready') throw new Error('expected host recovery');
            expect(recovered.snapshot.proof).toEqual({ basis: 'host' });
            expect(recovered.snapshot.turns[0]?.assistantMarkdown).toBe('Loaded after refresh');
        } finally {
            window.removeEventListener('aimd:chatgpt-conversation-bridge:request', responder);
            runtime.dispose();
            adapter.dispose();
        }
    });

    it('binds a home-page DOM first turn directly to the canonical conversation', async () => {
        document.documentElement.innerHTML = '<head></head><body><main></main></body>';
        history.replaceState({}, '', '/');
        const adapter = new ChatGPTAdapter();
        const runtime = new ChatGPTConversationContentRuntime(adapter);
        const toolbarOrchestrator = new MessageToolbarOrchestrator(adapter, {
            readerPanel: { setTheme() {}, show: async () => undefined } as any,
            conversationContentSource: runtime.source,
            conversationMaterialization: runtime.materialization,
            conversationSurface: runtime.surface,
        });
        let bridgeRequests = 0;
        const responder = ((event: Event) => {
            const request = (event as CustomEvent<any>).detail;
            if (request?.type !== 'peek') return;
            bridgeRequests += 1;
            window.dispatchEvent(new CustomEvent('aimd:chatgpt-conversation-bridge:response', {
                detail: {
                    requestId: request.requestId,
                    ok: false,
                    error: { code: 'BRIDGE_UNAVAILABLE', retryable: true },
                },
            }));
        }) as EventListener;
        window.addEventListener('aimd:chatgpt-conversation-bridge:request', responder);
        try {
            runtime.init();
            toolbarOrchestrator.init();
            expect((toolbarOrchestrator as any).observer).toBeNull();
            expect((toolbarOrchestrator as any).routeWatcher).toBeNull();
            expect((toolbarOrchestrator as any).scanScheduler).toBeNull();
            document.querySelector('main')?.insertAdjacentHTML('beforeend', `
                <div class="conversation-root">
                    <div data-turn-id-container="client-created-root"></div>
                    <div data-turn-id-container="4bc0f3fc-3432-4579-8052-f184e4e94775">
                        <section data-testid="conversation-turn-1" data-turn="user" data-turn-id="4bc0f3fc-3432-4579-8052-f184e4e94775" data-turn-id-container="4bc0f3fc-3432-4579-8052-f184e4e94775">
                            <div data-message-author-role="user" data-message-id="4bc0f3fc-3432-4579-8052-f184e4e94775">首轮问题</div>
                        </section>
                    </div>
                    <div data-turn-id-container="request-WEB:68fd340e-b1b6-4435-8dc7-a9d9152e87f4-0">
                        <section data-testid="conversation-turn-2" data-turn="assistant" data-turn-id="request-WEB:68fd340e-b1b6-4435-8dc7-a9d9152e87f4-0" data-turn-id-container="request-WEB:68fd340e-b1b6-4435-8dc7-a9d9152e87f4-0">
                            <div data-message-author-role="assistant" data-message-id="request-placeholder-request-WEB:68fd340e-b1b6-4435-8dc7-a9d9152e87f4-0">
                                <div class="streaming-animation markdown prose"></div>
                            </div>
                            <div class="z-0 flex"><button data-testid="copy-turn-action-button">Copy</button></div>
                        </section>
                    </div>
                </div>
            `);
            document.body.insertAdjacentHTML('beforeend', '<button data-testid="stop-button">Stop</button>');

            await new Promise((resolve) => window.setTimeout(resolve, 20));
            history.replaceState({}, '', '/c/6a72103d-0a30-83ec-b432-b27dab6e72e2');
            const assistant = document.querySelector('[data-message-author-role="assistant"]');
            const markdown = document.querySelector('.markdown.prose');
            if (!(assistant instanceof HTMLElement) || !(markdown instanceof HTMLElement)) {
                throw new Error('real first-turn fixture is incomplete');
            }
            assistant.dataset.messageId = 'df373b17-35a9-4e33-8b86-30bebeaab455';
            markdown.classList.remove('streaming-animation');
            markdown.textContent = '首轮回答';
            document.querySelector('button[data-testid="stop-button"]')?.remove();

            await new Promise((resolve) => window.setTimeout(resolve, 80));
            const pendingToolbar = document.querySelector('[data-message-id="df373b17-35a9-4e33-8b86-30bebeaab455"]')
                ?.closest('section')
                ?.querySelector<HTMLElement>('[data-aimd-role="message-toolbar"]');
            const officialAction = document.querySelector('[data-message-id="df373b17-35a9-4e33-8b86-30bebeaab455"]')
                ?.closest('section')
                ?.querySelector<HTMLElement>('button[data-testid="copy-turn-action-button"]');
            // The first canonical-route commit is still host-owned here. Mutating
            // its React action row before the content turn is sealed can roll the
            // host back into the streaming state and remove both toolbars.
            expect(pendingToolbar).toBeNull();
            expect(officialAction).toBeTruthy();

            await new Promise((resolve) => window.setTimeout(resolve, 520));
            const state = runtime.source.read();
            expect(state.kind).toBe('ready');
            if (state.kind !== 'ready') throw new Error('expected a host-ready state');
            expect(state.snapshot.proof?.basis).toBe('host');
            expect(state.snapshot.turns).toHaveLength(1);
            expect(state.snapshot.turns[0]).toMatchObject({
                userText: '首轮问题',
                assistantMarkdown: '首轮回答',
                assistantProvenance: {
                    authority: 'host-rendered',
                    fidelity: 'normalized',
                    producer: 'rendered-content-v2',
                },
            });
            const toolbar = document.querySelector('[data-message-id="df373b17-35a9-4e33-8b86-30bebeaab455"]')
                ?.closest('section')
                ?.querySelector<HTMLElement>('[data-aimd-role="message-toolbar"]');
            const stats = toolbar?.shadowRoot
                ?.querySelector<HTMLElement>('[data-role="stats"]')
                ?.textContent?.trim();
            expect(toolbar).toBeTruthy();
            expect(stats).toBeTruthy();
            expect(stats).not.toContain('—');
            expect(document.querySelector('button[data-testid="stop-button"]')).toBeNull();
            expect(document.querySelectorAll('button[data-testid="copy-turn-action-button"]')).toHaveLength(1);
            expect(bridgeRequests).toBe(1);
        } finally {
            window.removeEventListener('aimd:chatgpt-conversation-bridge:request', responder);
            toolbarOrchestrator.dispose();
            runtime.dispose();
            adapter.dispose();
        }
    });

    it('reattaches the Directory rail through the shared PageIndex after host removal', async () => {
        document.documentElement.innerHTML = '<head></head><body><main></main></body>';
        history.replaceState({}, '', '/c/directory-host-replacement');
        document.querySelector('main')?.insertAdjacentHTML('beforeend', `
            <article data-turn="user" data-turn-id="user-turn-1">
                <div data-message-author-role="user" data-message-id="user-1">
                    <div class="whitespace-pre-wrap">Question 1</div>
                </div>
            </article>
            <article data-turn="assistant" data-turn-id="assistant-turn-1">
                <div data-message-author-role="assistant" data-message-id="assistant-1">
                    <div class="markdown prose">Answer 1</div>
                </div>
                <div class="z-0 flex"><button data-testid="copy-turn-action-button">Copy</button></div>
            </article>
        `);
        const adapter = new ChatGPTAdapter();
        const runtime = new ChatGPTConversationContentRuntime(adapter, { hostSettleDelayMs: 20 });
        const directory = new ChatGPTDirectoryController(adapter, null, {
            surface: runtime.surface,
        });
        try {
            runtime.init();
            await new Promise((resolve) => window.setTimeout(resolve, 25));
            const state = await runtime.source.refresh();
            expect(state.kind).toBe('ready');
            directory.init('light');
            await new Promise((resolve) => window.setTimeout(resolve, 180));

            const firstRail = document.getElementById('aimd-chatgpt-directory-rail');
            expect(firstRail?.shadowRoot?.querySelectorAll('.rail__item')).toHaveLength(1);
            expect((firstRail as HTMLElement | null)?.style.display).not.toBe('none');

            firstRail?.remove();
            await new Promise((resolve) => window.setTimeout(resolve, 180));

            const reattachedRail = document.getElementById('aimd-chatgpt-directory-rail');
            expect(reattachedRail).toBe(firstRail);
            expect(reattachedRail?.parentElement).toBe(document.body);
            expect((reattachedRail as HTMLElement | null)?.style.display).not.toBe('none');
            expect(reattachedRail?.shadowRoot?.querySelectorAll('.rail__item')).toHaveLength(1);
        } finally {
            directory.dispose();
            runtime.dispose();
            adapter.dispose();
        }
    });

    it('does not use wrapper-less DOM content as a ChatGPT source', async () => {
        document.documentElement.innerHTML = '<head></head><body><main></main></body>';
        history.replaceState({}, '', '/c/695499b7-464c-8323-a998-119f661ac953');
        document.querySelector('main')?.insertAdjacentHTML('beforeend', `
            <div class="message-shell">
                <div data-message-author-role="assistant" data-message-id="assistant-fallback">
                    <div class="markdown prose">Answer while the wrapper is late</div>
                </div>
            </div>
        `);
        const adapter = new ChatGPTAdapter();
        const runtime = new ChatGPTConversationContentRuntime(adapter);
        const directory = new ChatGPTDirectoryController(adapter, null, {
            surface: runtime.surface,
            contentSource: runtime.source,
            materialization: runtime.materialization,
        });
        try {
            runtime.init();
            const state = await runtime.source.refresh();
            expect(state.kind).toBe('unavailable');
            expect(state.snapshot).toBeNull();

            directory.init('light');
            const rail = document.getElementById('aimd-chatgpt-directory-rail');
            expect(rail?.parentElement).toBe(document.body);
            expect(rail?.shadowRoot?.querySelectorAll('.rail__item')).toHaveLength(0);
        } finally {
            directory.dispose();
            runtime.dispose();
            adapter.dispose();
        }
    });

    it('aggregates discovery diagnostics across repository, host monitor and bridge', async () => {
        document.documentElement.innerHTML = '<head></head><body><main></main></body>';
        history.replaceState({}, '', '/c/695499b7-464c-8323-a998-119f661ac953');
        const adapter = new ChatGPTAdapter();
        const runtime = new ChatGPTConversationContentRuntime(adapter);
        const conversationId = '695499b7-464c-8323-a998-119f661ac953';
        const graphSnapshot = {
            conversationId,
            branchKey: 'assistant-1',
            coverage: 'complete' as const,
            rounds: [{
                id: 'turn-1',
                position: 1,
                userPrompt: 'Question 1',
                assistantContent: 'Answer 1',
                preview: 'Question 1',
                messageId: 'assistant-1',
                userMessageId: 'user-1',
                assistantMessageId: 'assistant-1',
            }],
        };
        const bridgeDiagnostics = {
            version: 6,
            observedEligibleGets: 2,
            graphsAccepted: 1,
            graphsRejected: 0,
            capturesPublished: 1,
            evictions: 0,
            bytesSkipped: 0,
            parseFailures: 0,
            graphCount: 1,
        };
        const responder = ((event: Event) => {
            const request = (event as CustomEvent<any>).detail;
            if (request?.type === 'peek') {
                window.dispatchEvent(new CustomEvent('aimd:chatgpt-conversation-bridge:response', {
                    detail: { requestId: request.requestId, ok: true, snapshot: graphSnapshot },
                }));
                return;
            }
            if (request?.type === 'diagnostics') {
                window.dispatchEvent(new CustomEvent('aimd:chatgpt-conversation-bridge:response', {
                    detail: { requestId: request.requestId, ok: true, diagnostics: bridgeDiagnostics },
                }));
            }
        }) as EventListener;
        window.addEventListener('aimd:chatgpt-conversation-bridge:request', responder);

        try {
            runtime.init();
            const state = await runtime.source.refresh();
            expect(state.kind).toBe('ready');
            // Let the throttled background diagnostics pull settle.
            await new Promise((resolve) => window.setTimeout(resolve, 0));

            const snapshot = runtime.readDiscoveryDiagnostics();
            expect(snapshot.basis).toBe('source');
            expect(snapshot.historyStatus).toBe('complete');
            expect(snapshot.repository).toMatchObject({
                documentKind: 'canonical',
                baselineGate: 'closed',
                turnCount: 1,
            });
            expect(snapshot.bridge).toMatchObject({
                version: 6,
                graphsAccepted: 1,
            });
            expect(snapshot.bridgeUnavailable).toBe(false);
            expect(snapshot.captureSignalCount).toBe(0);
        } finally {
            window.removeEventListener('aimd:chatgpt-conversation-bridge:request', responder);
            runtime.dispose();
            adapter.dispose();
        }
    });
});
