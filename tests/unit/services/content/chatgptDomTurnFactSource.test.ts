import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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
        adapter.dispose();
    });

    it('reports only typed identity and materialization lifecycle facts', () => {
        appendRound(1);

        expect(source.read().rounds).toEqual([{
            roundId: 'user-turn-1',
            userMessageId: 'user-1',
            assistantMessageId: 'assistant-1',
            assistantTurnId: 'assistant-turn-1',
            status: 'mounted',
        }]);
    });

    it('reports streaming lifecycle without reading visible body content', () => {
        appendRound(1, false);
        document.body.insertAdjacentHTML('beforeend', '<button data-testid="stop-button">Stop</button>');

        expect(source.read().rounds[0]).toMatchObject({
            assistantMessageId: 'assistant-1',
            status: 'streaming',
        });
        expect(source.read().rounds[0]).not.toHaveProperty('assistantContent');
    });

    it('keeps identity facts available before the official action row mounts', () => {
        document.querySelector('main')?.insertAdjacentHTML('beforeend', `
            <article data-turn="user" data-turn-id="user-turn-1">
                <div data-message-author-role="user" data-message-id="user-1">Question 1</div>
            </article>
            <article data-turn="assistant" data-turn-id="assistant-turn-1">
                <div data-message-author-role="assistant" data-message-id="assistant-1">
                    <div class="markdown prose">Answer 1</div>
                </div>
            </article>
        `);

        expect(source.read().rounds[0]).toMatchObject({
            assistantMessageId: 'assistant-1',
            status: 'mounted',
        });
    });

    it('does not claim a canonical completion when typed identity is incomplete', () => {
        document.querySelector('main')?.insertAdjacentHTML('beforeend', `
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
            status: 'mounted',
        });
    });

    it('keeps assistant-segment bodies out of the identity-only fact source', () => {
        document.querySelector('main')?.insertAdjacentHTML('beforeend', `
            <article data-turn="user" data-turn-id="user-turn-1">
                <div data-message-author-role="user" data-message-id="user-1">Question 1</div>
            </article>
            <article data-turn="assistant" data-turn-id="assistant-turn-1">
                <div data-message-author-role="assistant" data-message-id="assistant-1"><div class="markdown prose">First segment</div></div>
                <div data-message-author-role="assistant" data-message-id="assistant-1-segment-2"><div class="markdown prose">Second segment</div></div>
            </article>
        `);

        expect(source.read().rounds[0]).toMatchObject({
            assistantMessageId: 'assistant-1',
            status: 'mounted',
        });
        expect(source.read().rounds[0]).not.toHaveProperty('assistantContent');
    });

    it('matches host facts by typed identity rather than array position', () => {
        appendRound(1);
        appendRound(2);
        const original = adapter.getConversationGroupRefs?.bind(adapter);
        if (!original) throw new Error('ChatGPT grouping hook is missing');
        vi.spyOn(adapter, 'getConversationGroupRefs').mockImplementation(() => original().reverse());

        expect(source.read().rounds.map((round) => round.assistantMessageId)).toEqual(['assistant-1', 'assistant-2']);
    });

    it('reads typed assistant identity when the legacy turn index is unavailable', () => {
        appendRound(1);
        vi.spyOn(adapter, 'getConversationGroupRefs').mockReturnValue([]);

        expect(source.read().rounds[0]).toMatchObject({
            assistantMessageId: 'assistant-1',
            status: 'mounted',
        });
    });

    it('publishes a typed assistant anchor when the turn wrapper is temporarily absent', () => {
        document.querySelector('main')?.insertAdjacentHTML('beforeend', `
            <div class="message-shell">
                <div data-message-author-role="assistant" data-message-id="assistant-fallback">
                    <div class="markdown prose">Answer without a turn wrapper</div>
                </div>
            </div>
        `);

        expect(source.read().rounds[0]).toMatchObject({
            assistantMessageId: 'assistant-fallback',
            status: 'mounted',
        });
    });

    it('retains typed user and assistant anchors when host wrappers are late', () => {
        document.querySelector('main')?.insertAdjacentHTML('beforeend', `
            <div data-message-author-role="user" data-message-id="user-fallback">Question from the late wrapper</div>
            <div class="message-shell">
                <div data-message-author-role="assistant" data-message-id="assistant-fallback-2">
                    <div class="markdown prose">Answer from the late wrapper</div>
                </div>
            </div>
        `);

        expect(source.read().rounds[0]).toMatchObject({
            assistantMessageId: 'assistant-fallback-2',
            userMessageId: 'user-fallback',
            status: 'mounted',
        });
    });
});
