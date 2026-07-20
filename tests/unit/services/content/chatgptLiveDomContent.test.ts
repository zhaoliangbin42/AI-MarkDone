import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ChatGPTAdapter } from '@/drivers/content/adapters/sites/chatgpt';
import type { ChatGPTConversationSnapshot } from '@/drivers/content/chatgpt/types';
import { ChatGPTLiveDomContent } from '@/services/content/ChatGPTLiveDomContent';

const conversationId = '695499b7-464c-8323-a998-119f661ac953';

function baselineSnapshot(): ChatGPTConversationSnapshot {
    return {
        conversationId,
        buildFingerprint: 'test-build',
        source: 'runtime-bridge',
        origin: 'conversation-graph',
        coverage: 'complete',
        branchKey: 'assistant-1',
        capturedAt: 1,
        rounds: [{
            id: 'user-turn-1',
            position: 1,
            userPrompt: 'Question 1',
            assistantContent: 'Answer 1',
            preview: 'Question 1',
            messageId: 'assistant-1',
            userMessageId: 'user-1',
            assistantMessageId: 'assistant-1',
        }],
    };
}

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

describe('ChatGPTLiveDomContent', () => {
    let adapter: ChatGPTAdapter;
    let snapshot: ChatGPTConversationSnapshot;
    let applyLiveDomTail: ReturnType<typeof vi.fn>;
    let source: ChatGPTLiveDomContent;

    beforeEach(() => {
        vi.useFakeTimers();
        history.replaceState({}, '', `/c/${conversationId}`);
        document.documentElement.innerHTML = '<head></head><body><main></main></body>';
        appendRound(1);
        adapter = new ChatGPTAdapter();
        snapshot = baselineSnapshot();
        applyLiveDomTail = vi.fn((_: string, rounds: any[]) => {
            snapshot = {
                ...snapshot,
                branchKey: rounds.at(-1)?.assistantMessageId ?? snapshot.branchKey,
                rounds: [...snapshot.rounds, ...rounds],
            };
            return snapshot;
        });
        source = new ChatGPTLiveDomContent(adapter, {
            peekCurrentSnapshot: () => snapshot,
            applyLiveDomTail,
            subscribe: () => () => undefined,
        });
        source.init();
    });

    afterEach(() => {
        source.dispose();
        adapter.dispose();
        vi.runOnlyPendingTimers();
        vi.useRealTimers();
    });

    it('appends a newly completed DOM round to the shared canonical chain', async () => {
        appendRound(2);
        await vi.runAllTimersAsync();

        expect(applyLiveDomTail).toHaveBeenCalledTimes(1);
        expect(applyLiveDomTail).toHaveBeenCalledWith('assistant-1', [
            expect.objectContaining({
                position: 2,
                userPrompt: 'Question 2',
                assistantContent: '**Answer 2**',
                userMessageId: 'user-2',
                assistantMessageId: 'assistant-2',
            }),
        ]);
    });

    it('waits for the host completion node before publishing the live round', async () => {
        appendRound(2, false);
        await vi.runAllTimersAsync();
        expect(applyLiveDomTail).not.toHaveBeenCalled();

        document.querySelector('article[data-turn-id="assistant-turn-2"]')?.insertAdjacentHTML(
            'beforeend',
            '<div class="z-0 flex"><button data-testid="copy-turn-action-button">Copy</button></div>',
        );
        await vi.runAllTimersAsync();

        expect(applyLiveDomTail).toHaveBeenCalledTimes(1);
    });
});
