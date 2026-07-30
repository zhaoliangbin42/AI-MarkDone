import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ChatGPTAdapter } from '@/drivers/content/adapters/sites/chatgpt';
import { ChatGPTDomTurnFactSource } from '@/services/content/ChatGPTDomTurnFactSource';

function appendRound(index: number, withActionBar = true): void {
    document.querySelector('main')?.insertAdjacentHTML('beforeend', `
        <article data-turn="user" data-turn-id="user-turn-${index}">
            <div data-message-author-role="user" data-message-id="user-${index}">
                <div class="whitespace-pre-wrap">Question ${index}</div>
            </div>
        </article>
        <article data-turn="assistant" data-turn-id="assistant-turn-${index}">
            <div data-message-author-role="assistant" data-message-id="assistant-${index}">
                <div class="markdown prose"><strong>Answer ${index}</strong></div>
            </div>
            ${withActionBar ? '<div class="z-0 flex"><button data-testid="copy-turn-action-button">Copy</button></div>' : ''}
        </article>
    `);
}

describe('ChatGPTDomTurnFactSource', () => {
    let adapter: ChatGPTAdapter;
    let source: ChatGPTDomTurnFactSource;

    beforeEach(() => {
        history.replaceState({}, '', '/c/695499b7-464c-8323-a998-119f661ac953');
        document.documentElement.innerHTML = '<head></head><body><main></main></body>';
        adapter = new ChatGPTAdapter();
        source = new ChatGPTDomTurnFactSource(adapter);
    });

    afterEach(() => {
        source.stop();
        adapter.dispose();
    });

    it('reports typed completed turns without mutating a conversation snapshot', () => {
        appendRound(1);

        expect(source.read().rounds).toEqual([{
            position: 1,
            roundId: 'user-turn-1',
            userMessageId: 'user-1',
            assistantMessageId: 'assistant-1',
            assistantTurnId: 'assistant-turn-1',
            userPrompt: 'Question 1',
            assistantContent: '**Answer 1**',
            status: 'complete',
        }]);
    });

    it('keeps a turn incomplete until the official completion action appears', () => {
        appendRound(1, false);

        expect(source.read().rounds[0]).toMatchObject({
            assistantMessageId: 'assistant-1',
            assistantContent: '',
            status: 'incomplete',
        });
    });

    it('keeps a completed-looking turn incomplete until typed identity is complete', () => {
        document.querySelector('main')?.insertAdjacentHTML('beforeend', `
            <article data-turn="user" data-turn-id="user-turn-1">
                <div data-message-author-role="user">Question 1</div>
            </article>
            <article data-turn="assistant" data-turn-id="assistant-turn-1">
                <div data-message-author-role="assistant" data-message-id="assistant-1">
                    <div class="markdown prose">Answer 1</div>
                </div>
                <div class="z-0 flex"><button data-testid="copy-turn-action-button">Copy</button></div>
            </article>
        `);

        expect(source.read().rounds[0]).toMatchObject({
            userMessageId: null,
            assistantMessageId: 'assistant-1',
            status: 'incomplete',
        });
    });

    it('merges every assistant segment owned by one logical turn', () => {
        document.querySelector('main')?.insertAdjacentHTML('beforeend', `
            <article data-turn="user" data-turn-id="user-turn-1">
                <div data-message-author-role="user" data-message-id="user-1">Question 1</div>
            </article>
            <article data-turn="assistant" data-turn-id="assistant-turn-1">
                <div data-message-author-role="assistant" data-message-id="assistant-1">
                    <div class="markdown prose">First segment</div>
                </div>
                <div data-message-author-role="assistant" data-message-id="assistant-1-segment-2">
                    <div class="markdown prose">Second segment</div>
                </div>
                <div class="z-0 flex"><button data-testid="copy-turn-action-button">Copy</button></div>
            </article>
        `);

        expect(source.read().rounds[0]).toMatchObject({
            status: 'complete',
            assistantContent: 'First segment\n\nSecond segment',
        });
    });
});
