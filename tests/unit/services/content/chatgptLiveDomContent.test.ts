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

function pendingTailSnapshot(): ChatGPTConversationSnapshot {
    const snapshot = baselineSnapshot();
    return {
        ...snapshot,
        branchKey: 'user-turn-1',
        rounds: [{
            ...snapshot.rounds[0]!,
            assistantContent: '',
            messageId: 'user-1',
            assistantMessageId: null,
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
    let registeredReconciler: (() => ChatGPTConversationSnapshot | null) | null;
    let unregisterReconciler: ReturnType<typeof vi.fn>;
    let source: ChatGPTLiveDomContent;

    beforeEach(() => {
        vi.useFakeTimers();
        history.replaceState({}, '', `/c/${conversationId}`);
        document.documentElement.innerHTML = '<head></head><body><main></main></body>';
        appendRound(1);
        adapter = new ChatGPTAdapter();
        snapshot = baselineSnapshot();
        registeredReconciler = null;
        unregisterReconciler = vi.fn();
        applyLiveDomTail = vi.fn((_: string, rounds: any[]) => {
            const nextRounds = [...snapshot.rounds];
            for (const round of rounds) {
                if (round.position <= nextRounds.length) {
                    nextRounds[round.position - 1] = round;
                } else {
                    nextRounds.push(round);
                }
            }
            snapshot = {
                ...snapshot,
                branchKey: rounds.at(-1)?.assistantMessageId ?? snapshot.branchKey,
                rounds: nextRounds,
            };
            return snapshot;
        });
        source = new ChatGPTLiveDomContent(adapter, {
            peekCurrentSnapshot: () => snapshot,
            applyLiveDomTail,
            subscribe: () => () => undefined,
            registerLiveDomReconciler: vi.fn((reconciler) => {
                registeredReconciler = reconciler;
                return unregisterReconciler;
            }),
        } as any);
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

    it('completes the canonical pending tail when its mounted assistant finishes', async () => {
        snapshot = pendingTailSnapshot();

        await vi.runAllTimersAsync();

        expect(applyLiveDomTail).toHaveBeenCalledTimes(1);
        expect(applyLiveDomTail).toHaveBeenCalledWith('user-turn-1', [
            expect.objectContaining({
                id: 'user-turn-1',
                position: 1,
                userPrompt: 'Question 1',
                assistantContent: '**Answer 1**',
                messageId: 'assistant-1',
                userMessageId: 'user-1',
                assistantMessageId: 'assistant-1',
            }),
        ]);
    });

    it('registers a synchronous reconciliation path for forced Reader and word-count refreshes', () => {
        snapshot = pendingTailSnapshot();

        expect(registeredReconciler).toBeTypeOf('function');
        const reconciled = registeredReconciler?.();

        expect(reconciled?.rounds[0]?.assistantContent).toBe('**Answer 1**');
        expect(applyLiveDomTail).toHaveBeenCalledTimes(1);

        registeredReconciler?.();
        expect(applyLiveDomTail).toHaveBeenCalledTimes(1);
    });

    it('does not replace an already non-empty canonical tail from the rendered DOM', async () => {
        await vi.runAllTimersAsync();

        expect(applyLiveDomTail).not.toHaveBeenCalled();
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

    it('publishes the completed prefix when a later live DOM round is still incomplete', async () => {
        appendRound(2);
        appendRound(3, false);

        await vi.runAllTimersAsync();

        expect(applyLiveDomTail).toHaveBeenCalledTimes(1);
        expect(applyLiveDomTail).toHaveBeenCalledWith('assistant-1', [
            expect.objectContaining({
                position: 2,
                assistantMessageId: 'assistant-2',
                assistantContent: '**Answer 2**',
            }),
        ]);
    });
});
