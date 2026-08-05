import { describe, expect, it } from 'vitest';

import {
    ConversationContentAcquisitionError,
    ConversationContentRepository,
    type ConversationContentCandidateV1,
} from '@/services/content/ConversationContentRepository';
import { createConversationDocumentKeyV1, type ConversationDocumentRefV1 } from '@/contracts/conversationContent';
import { ChatGPTAdapter } from '@/drivers/content/adapters/sites/chatgpt';
import { ChatGPTDomTurnFactSource } from '@/services/content/ChatGPTDomTurnFactSource';
import { ChatGPTConversationContentRuntime } from '@/runtimes/content/ChatGPTConversationContentRuntime';
import { ChatGPTDirectoryController } from '@/ui/content/controllers/ChatGPTDirectoryController';

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
    it('keeps one semantic sequence for late attach, append, and hard refresh', async () => {
        let current = ref('conversation-1');
        let available: ConversationContentCandidateV1 | null = null;
        const repository = new ConversationContentRepository({
            resolveDocument: () => current,
            acquire: async () => available,
        });

        expect((await repository.refresh()).kind).toBe('unavailable');
        available = candidate(current, 1);
        const first = await repository.refresh();
        expect(first.kind).toBe('ready');
        if (first.kind !== 'ready') throw new Error('expected ready state');
        const firstToken = first.snapshot.contentToken;

        available = candidate(current, 2);
        const appended = await repository.refresh();
        expect(appended.kind).toBe('ready');
        if (appended.kind !== 'ready') throw new Error('expected ready state');
        expect(appended.snapshot.turns).toHaveLength(2);
        expect(appended.snapshot.contentToken).not.toBe(firstToken);

        const refreshed = await repository.refresh();
        expect(refreshed.kind).toBe('ready');
        if (refreshed.kind !== 'ready') throw new Error('expected ready state');
        expect(refreshed.snapshot.contentToken).toBe(appended.snapshot.contentToken);
    });

    it('retains same-document last-good content during timeout recovery', async () => {
        const document = ref('conversation-1');
        let fail = false;
        const repository = new ConversationContentRepository({
            resolveDocument: () => document,
            acquire: async () => {
                if (fail) throw new ConversationContentAcquisitionError('source-timeout');
                return candidate(document, 1);
            },
        });

        await repository.refresh();
        fail = true;
        const stale = await repository.refresh();
        expect(stale.kind).toBe('stale');
        if (stale.kind !== 'stale') throw new Error('expected stale state');
        expect(stale.snapshot.turns).toHaveLength(1);
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
            acquire: async (document) => document.conversationId === 'conversation-a' ? pendingA : pendingB,
        });

        const a = repository.refresh();
        current = ref('conversation-b');
        const b = repository.refresh();
        resolveA(candidate(ref('conversation-a'), 1));
        resolveB(candidate(ref('conversation-b'), 2));
        await a;
        const ready = await b;

        expect(ready.kind).toBe('ready');
        if (ready.kind !== 'ready') throw new Error('expected ready state');
        expect(ready.document.conversationId).toBe('conversation-b');
        expect(ready.snapshot.turns).toHaveLength(2);
    });

    it('publishes DOM-only content when passive capture missed the latest page', async () => {
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
        const runtime = new ChatGPTConversationContentRuntime(adapter, {
            domFacts: new ChatGPTDomTurnFactSource(adapter),
        });
        let directory: ChatGPTDirectoryController | null = null;
        try {
            expect(runtime.domFacts.read().rounds).toHaveLength(1);
            runtime.init();
            const first = await runtime.source.refresh();
            expect(first.kind).toBe('ready');
            if (first.kind !== 'ready') throw new Error('expected DOM content to be ready');
            expect(first.snapshot.coverage).toBe('partial');
            expect(first.snapshot.turns.map((turn) => turn.identity.assistantMessageId)).toEqual(['assistant-1']);

            directory = new ChatGPTDirectoryController(adapter, null, {
                contentSource: runtime.source,
                materialization: runtime.materialization,
            });
            directory.init('light');
            const mountedRail = document.getElementById('aimd-chatgpt-directory-rail');
            expect(mountedRail?.parentElement).toBe(document.body);
            expect(mountedRail?.style.display).toBe('block');
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
            const second = await runtime.source.refresh();
            expect(second.kind).toBe('ready');
            if (second.kind !== 'ready') throw new Error('expected appended DOM content to be ready');
            expect(second.snapshot.turns.map((turn) => turn.identity.assistantMessageId)).toEqual([
                'assistant-1',
                'assistant-2',
            ]);
        } finally {
            directory?.dispose();
            runtime.dispose();
            adapter.dispose();
        }
    });

    it('publishes the first completed turn in a newly created conversation', async () => {
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
        const runtime = new ChatGPTConversationContentRuntime(adapter, {
            domFacts: new ChatGPTDomTurnFactSource(adapter),
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
            expect(runtime.domFacts.read().rounds).toHaveLength(1);
            const state = await runtime.source.refresh();
            expect(state.kind).toBe('ready');
            if (state.kind !== 'ready') throw new Error('expected first turn to be ready');
            expect(state.snapshot.turns).toHaveLength(1);
            expect(state.snapshot.turns[0]?.assistantMarkdown).toBe('测试完成');
        } finally {
            window.removeEventListener('aimd:chatgpt-conversation-bridge:request', responder);
            runtime.dispose();
            adapter.dispose();
        }
    });

    it('publishes a completed first turn when the transport finishes before the stop control clears', async () => {
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
        const runtime = new ChatGPTConversationContentRuntime(adapter, {
            domFacts: new ChatGPTDomTurnFactSource(adapter),
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
            const collecting = await runtime.source.refresh();
            expect(collecting.kind).toBe('unavailable');

            const markdown = document.querySelector('.markdown.prose');
            const stop = document.querySelector('button[data-testid="stop-button"]');
            if (!(markdown instanceof HTMLElement) || !(stop instanceof HTMLElement)) {
                throw new Error('first-turn completion controls are missing');
            }
            markdown.textContent = '首轮探针完成';
            window.dispatchEvent(new CustomEvent('aimd:chatgpt-conversation-bridge:capture', {
                detail: {
                    kind: 'generation-complete',
                    conversationId: '6a721381-e3ec-83ec-ba07-2c2885d2b9c6',
                    assistantMessageId: 'ac579e24-71d7-45a4-8b8b-5fc07f3761f5',
                },
            }));

            await new Promise((resolve) => window.setTimeout(resolve, 220));
            const ready = runtime.source.read();
            expect(ready.kind).toBe('ready');
            if (ready.kind !== 'ready') throw new Error('expected in-place completion to publish');
            expect(ready.snapshot.turns.map((turn) => turn.identity.assistantMessageId)).toEqual([
                'ac579e24-71d7-45a4-8b8b-5fc07f3761f5',
            ]);
        } finally {
            window.removeEventListener('aimd:chatgpt-conversation-bridge:request', responder);
            runtime.dispose();
            adapter.dispose();
        }
    });

    it('recovers the first turn when a fresh route starts at the home page', async () => {
        document.documentElement.innerHTML = '<head></head><body><main></main></body>';
        history.replaceState({}, '', '/');
        const adapter = new ChatGPTAdapter();
        const runtime = new ChatGPTConversationContentRuntime(adapter, {
            domFacts: new ChatGPTDomTurnFactSource(adapter),
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
            history.pushState({}, '', '/c/WEB:68fd340e-b1b6-4435-8dc7-a9d9152e87f4');
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

            await new Promise((resolve) => window.setTimeout(resolve, 250));
            const state = runtime.source.read();
            expect(state.kind).toBe('ready');
            if (state.kind !== 'ready') throw new Error('expected home-to-conversation first turn to be ready');
            expect(state.snapshot.turns.map((turn) => turn.identity.assistantMessageId)).toEqual([
                'df373b17-35a9-4e33-8b86-30bebeaab455',
            ]);
        } finally {
            window.removeEventListener('aimd:chatgpt-conversation-bridge:request', responder);
            runtime.dispose();
            adapter.dispose();
        }
    });

    it('keeps the directory mounted when ChatGPT briefly omits turn wrappers', async () => {
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
        const runtime = new ChatGPTConversationContentRuntime(adapter, {
            domFacts: new ChatGPTDomTurnFactSource(adapter),
        });
        const directory = new ChatGPTDirectoryController(adapter, null, {
            contentSource: runtime.source,
            materialization: runtime.materialization,
        });
        try {
            runtime.init();
            const state = await runtime.source.refresh();
            expect(state.kind).toBe('ready');
            if (state.kind !== 'ready') throw new Error('expected fallback content to be ready');
            expect(state.snapshot.coverage).toBe('partial');
            expect(state.snapshot.turns[0]?.identity.assistantMessageId).toBe('assistant-fallback');

            directory.init('light');
            const rail = document.getElementById('aimd-chatgpt-directory-rail');
            expect(rail?.parentElement).toBe(document.body);
            expect(rail?.style.display).toBe('block');
            expect(rail?.shadowRoot?.querySelectorAll('.rail__item')).toHaveLength(1);
        } finally {
            directory.dispose();
            runtime.dispose();
            adapter.dispose();
        }
    });
});
