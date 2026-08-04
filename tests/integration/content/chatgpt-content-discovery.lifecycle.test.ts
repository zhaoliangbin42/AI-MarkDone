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
