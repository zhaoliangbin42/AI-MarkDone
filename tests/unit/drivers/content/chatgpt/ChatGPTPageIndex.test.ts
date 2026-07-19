import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ChatGPTAdapter } from '@/drivers/content/adapters/sites/chatgpt';
import {
    collectChatGPTDomRoundRefs,
    subscribeChatGPTDomRoundChanges,
} from '@/drivers/content/chatgpt/domConversationDiscovery';
import { collectConversationTurnRefs } from '@/drivers/content/conversation/collectConversationTurnRefs';
import { collectChatGPTRoundPositions } from '@/ui/content/chatgptDirectory/navigation';
import { getChatGPTConversationIndex } from '@/drivers/content/chatgpt/ChatGPTConversationIndex';

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

    it('shares the same mapped turn snapshot across toolbar, directory, and navigation callers', () => {
        const firstTurns = collectConversationTurnRefs(adapter);
        const secondTurns = collectConversationTurnRefs(adapter);
        getChatGPTConversationIndex(adapter).setSnapshot({
            conversationId: '12345678-1234-1234-1234-123456789abc',
            buildFingerprint: 'test-build',
            source: 'runtime-bridge',
            origin: 'conversation-graph',
            coverage: 'complete',
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
        });
        const positions = collectChatGPTRoundPositions(adapter);

        expect(secondTurns).toBe(firstTurns);
        expect(positions.map((position) => position.assistantRoot)).toEqual(
            firstTurns.map((turn) => turn.assistantRootEl),
        );
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
            collectChatGPTRoundPositions(adapter);
            adapter.getConversationGroupRefs();

            expect(firstTurns).toHaveLength(200);
            expect(discoveryQueryCount).toBeGreaterThan(0);
            expect(querySelectorAll.mock.calls.length).toBe(discoveryQueryCount);
        } finally {
            querySelectorAll.mockRestore();
        }
    });

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
            const firstIndex = getChatGPTConversationIndex(adapter);

            adapter.dispose();
            const rebuiltSnapshot = collectChatGPTDomRoundRefs(adapter);
            const rebuiltTurns = collectConversationTurnRefs(adapter);
            const rebuiltIndex = getChatGPTConversationIndex(adapter);

            expect(disconnect).toHaveBeenCalled();
            expect(rebuiltSnapshot).not.toBe(firstSnapshot);
            expect(rebuiltTurns).not.toBe(firstTurns);
            expect(rebuiltIndex).not.toBe(firstIndex);
        } finally {
            disconnect.mockRestore();
        }
    });
});
