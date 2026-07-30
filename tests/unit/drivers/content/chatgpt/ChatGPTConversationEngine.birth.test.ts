import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ChatGPTAdapter } from '@/drivers/content/adapters/sites/chatgpt';
import { ChatGPTConversationEngine } from '@/drivers/content/chatgpt/ChatGPTConversationEngine';
import { ChatGPTDomTurnFactSource } from '@/services/content/ChatGPTDomTurnFactSource';

const conversationId = '695499b7-464c-8323-a998-119f661ac953';

describe('ChatGPTConversationEngine new-conversation discovery', () => {
    let adapter: ChatGPTAdapter;
    let engine: ChatGPTConversationEngine;
    let domFacts: ChatGPTDomTurnFactSource;
    let removeBridgeResponder: (() => void) | null = null;

    beforeEach(() => {
        vi.useFakeTimers();
        history.replaceState({}, '', '/');
        document.documentElement.innerHTML = '<head></head><body><main></main></body>';
        adapter = new ChatGPTAdapter();

        const bridgeResponder = ((event: Event) => {
            const rawDetail = (event as CustomEvent<unknown>).detail;
            const detail = typeof rawDetail === 'string' ? JSON.parse(rawDetail) : rawDetail;
            window.dispatchEvent(new CustomEvent('aimd:chatgpt-conversation-bridge:response', {
                detail: typeof rawDetail === 'string'
                    ? JSON.stringify({ requestId: detail.requestId, ok: false })
                    : { requestId: detail.requestId, ok: false },
            }));
        }) as EventListener;
        window.addEventListener('aimd:chatgpt-conversation-bridge:request', bridgeResponder);
        removeBridgeResponder = () => {
            window.removeEventListener('aimd:chatgpt-conversation-bridge:request', bridgeResponder);
        };

        domFacts = new ChatGPTDomTurnFactSource(adapter);
        engine = new ChatGPTConversationEngine(adapter, { domFacts });
        engine.init();
    });

    afterEach(() => {
        engine.dispose();
        adapter.dispose();
        removeBridgeResponder?.();
        removeBridgeResponder = null;
        vi.runOnlyPendingTimers();
        vi.useRealTimers();
    });

    it('publishes the first completed round without a conversation graph', async () => {
        expect(engine.getState()).toMatchObject({
            status: 'idle',
            conversationId: null,
            snapshot: null,
        });

        document.querySelector('main')?.insertAdjacentHTML('beforeend', `
            <article data-turn="user" data-turn-id="user-turn-1">
                <div data-message-author-role="user" data-message-id="user-1">
                    <div class="whitespace-pre-wrap">Question 1</div>
                </div>
            </article>
            <article data-turn="assistant" data-turn-id="assistant-turn-1">
                <div data-message-author-role="assistant" data-message-id="assistant-1">
                    <div class="markdown prose"><strong>Answer 1</strong></div>
                </div>
            </article>
            <button aria-label="Stop generating">Stop</button>
        `);
        history.replaceState({}, '', `/c/${conversationId}`);
        await vi.advanceTimersByTimeAsync(500);

        expect(engine.getState()).toMatchObject({
            status: 'collecting',
            conversationId,
            snapshot: null,
        });

        document.querySelector('button[aria-label="Stop generating"]')?.remove();
        document.querySelector('article[data-turn-id="assistant-turn-1"]')?.insertAdjacentHTML(
            'beforeend',
            '<div class="z-0 flex"><button data-testid="copy-turn-action-button">Copy</button></div>',
        );

        const snapshot = await engine.ensureReady();

        expect(snapshot).toMatchObject({
            conversationId,
            proof: 'birth-epoch',
            rounds: [{
                position: 1,
                userPrompt: 'Question 1',
                assistantContent: '**Answer 1**',
                userMessageId: 'user-1',
                assistantMessageId: 'assistant-1',
            }],
        });
        expect(engine.getState()).toMatchObject({
            status: 'ready',
            conversationId,
            snapshot,
        });
    });
});
