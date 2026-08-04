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

    it('keeps a turn incomplete while ChatGPT still exposes its stop control', () => {
        appendRound(1, false);
        document.body.insertAdjacentHTML('beforeend', '<button aria-label="Stop generating">Stop</button>');

        expect(source.read().rounds[0]).toMatchObject({
            assistantMessageId: 'assistant-1',
            assistantContent: '',
            status: 'streaming',
        });
    });

    it('accepts a typed completed turn before the official action row mounts', () => {
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
            </article>
        `);

        expect(source.read().rounds[0]).toMatchObject({
            assistantMessageId: 'assistant-1',
            assistantContent: 'Answer 1',
            status: 'complete',
        });
    });

    it('keeps a completed-looking turn incomplete until the assistant identity is complete', () => {
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
            status: 'complete',
        });
    });

    it('does not require a user message id when the turn and assistant ids are verified', () => {
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
            status: 'complete',
            assistantContent: 'Answer 1',
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

    it('matches content refs by typed DOM identity rather than array position', () => {
        appendRound(1);
        appendRound(2);
        const original = adapter.getConversationGroupRefs?.bind(adapter);
        if (!original) throw new Error('ChatGPT grouping hook is missing');
        vi.spyOn(adapter, 'getConversationGroupRefs').mockImplementation(() => original().reverse());

        const rounds = source.read().rounds;
        expect(rounds.map((round) => round.assistantMessageId)).toEqual(['assistant-1', 'assistant-2']);
        expect(rounds.map((round) => round.assistantContent)).toEqual(['**Answer 1**', '**Answer 2**']);
    });

    it('reads the assistant node directly when the legacy turn index is temporarily unavailable', () => {
        appendRound(1);
        vi.spyOn(adapter, 'getConversationGroupRefs').mockReturnValue([]);

        expect(source.read().rounds[0]).toMatchObject({
            assistantMessageId: 'assistant-1',
            assistantContent: '**Answer 1**',
            status: 'complete',
        });
    });

    it('publishes a typed assistant fallback when the turn wrapper is temporarily absent', () => {
        document.querySelector('main')?.insertAdjacentHTML('beforeend', `
            <div class="message-shell">
                <div data-message-author-role="assistant" data-message-id="assistant-fallback">
                    <div class="markdown prose">Answer without a turn wrapper</div>
                </div>
            </div>
        `);

        expect(source.read().rounds[0]).toMatchObject({
            assistantMessageId: 'assistant-fallback',
            userPrompt: 'Message 1',
            assistantContent: 'Answer without a turn wrapper',
            status: 'complete',
        });
    });

    it('keeps the preceding typed user message when only host turn wrappers are late', () => {
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
            userPrompt: 'Question from the late wrapper',
            assistantContent: 'Answer from the late wrapper',
            status: 'complete',
        });
    });
});
