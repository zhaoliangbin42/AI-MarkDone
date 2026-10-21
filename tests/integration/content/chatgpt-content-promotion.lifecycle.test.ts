import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ChatGPTAdapter } from '@/drivers/content/adapters/sites/chatgpt';
import { ChatGPTConversationContentRuntime } from '@/runtimes/content/ChatGPTConversationContentRuntime';

function completedRoundHtml(answer: string): string {
    return `
        <div data-turn-id-container="user-slot-1">
            <section data-turn="user" data-turn-id="user-slot-1" data-turn-id-container="user-slot-1">
                <div data-message-author-role="user" data-message-id="user-1">
                    <div class="whitespace-pre-wrap">Question 1</div>
                </div>
            </section>
        </div>
        <div data-turn-id-container="assistant-slot-1">
            <section data-turn="assistant" data-turn-id="assistant-slot-1" data-turn-id-container="assistant-slot-1">
                <div data-message-author-role="assistant" data-message-id="assistant-1">
                    <div class="markdown prose">${answer}</div>
                </div>
                <div class="z-0 flex"><button data-testid="copy-turn-action-button">Copy</button></div>
            </section>
        </div>
    `;
}

async function settle(ms = 60): Promise<void> {
    await Promise.resolve();
    await vi.advanceTimersByTimeAsync(ms);
    await Promise.resolve();
}

function createRuntime() {
    const adapter = new ChatGPTAdapter();
    const runtime = new ChatGPTConversationContentRuntime(adapter, { hostSettleDelayMs: 20 });
    return {
        runtime,
        dispose() {
            runtime.dispose();
            adapter.dispose();
        },
    };
}

describe('ChatGPT content page identity promotion lifecycle', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        history.replaceState({}, '', '/');
        document.documentElement.innerHTML = '<head></head><body><main></main></body>';
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it.each(['pushState', 'replaceState'] as const)(
        'preserves the initial queued DOM capture when %s promotes a home page to a conversation', async method => {
            document.querySelector('main')!.innerHTML = completedRoundHtml('Completed home answer');
            const harness = createRuntime();

            try {
                harness.runtime.init();
                expect(harness.runtime.source.read().snapshot).toBeNull();

                // The host already finished rendering. Only history changes
                // before the initial quiet-window capture can run.
                history[method]({}, '', '/c/promoted-conversation');
                await settle();

                const state = harness.runtime.source.read();
                expect(state.document?.conversationId).toBe('promoted-conversation');
                expect(state.snapshot?.turns.map(turn => turn.assistantMarkdown)).toEqual(['Completed home answer']);
                const frame = harness.runtime.surface.readFrame();
                expect(frame.snapshot).toBe(state.snapshot);
                expect(frame.obtainedTurns.map(entry => entry.target.assistantMessageId)).toEqual(['assistant-1']);
                expect(harness.runtime.source.readTurn({
                    documentKey: state.document!.key,
                    turnId: 'user-slot-1',
                    userMessageId: 'user-1',
                    assistantMessageId: 'assistant-1',
                }).kind).toBe('ready');
            } finally {
                harness.dispose();
            }
        },
    );

    it.each([false, true])('does not capture a retained previous conversation body after a canonical route switch (already captured: %s)', async alreadyCaptured => {
        history.replaceState({}, '', '/c/conversation-a');
        document.querySelector('main')!.innerHTML = completedRoundHtml('Conversation A answer');
        const harness = createRuntime();

        try {
            harness.runtime.init();
            if (alreadyCaptured) {
                await settle();
                expect(harness.runtime.source.read().snapshot?.turns).toHaveLength(1);
            }

            history.pushState({}, '', '/c/conversation-b');
            await settle();

            expect(harness.runtime.source.read().document?.conversationId).toBe('conversation-b');
            expect(harness.runtime.source.read().snapshot).toBeNull();
            expect(harness.runtime.surface.readFrame().obtainedTurns).toHaveLength(0);
        } finally {
            harness.dispose();
        }
    });

    it('does not recapture a retained canonical conversation body through an intermediate home route', async () => {
        history.replaceState({}, '', '/c/conversation-a');
        document.querySelector('main')!.innerHTML = completedRoundHtml('Conversation A answer');
        const harness = createRuntime();

        try {
            harness.runtime.init();
            await settle();
            expect(harness.runtime.source.read().snapshot?.turns).toHaveLength(1);

            history.pushState({}, '', '/');
            history.pushState({}, '', '/c/conversation-b');
            await settle();

            expect(harness.runtime.source.read().document?.conversationId).toBe('conversation-b');
            expect(harness.runtime.source.read().snapshot).toBeNull();
            expect(harness.runtime.surface.readFrame().obtainedTurns).toHaveLength(0);
        } finally {
            harness.dispose();
        }
    });

    it('captures a later new chat through fresh host DOM evidence after its canonical promotion', async () => {
        history.replaceState({}, '', '/c/conversation-a');
        document.querySelector('main')!.innerHTML = completedRoundHtml('Conversation A answer');
        const harness = createRuntime();

        try {
            harness.runtime.init();
            await settle();

            history.pushState({}, '', '/');
            history.pushState({}, '', '/c/conversation-b');
            document.querySelector('main')!.innerHTML = completedRoundHtml('New conversation B answer');
            await settle();

            expect(harness.runtime.source.read().document?.conversationId).toBe('conversation-b');
            expect(harness.runtime.source.read().snapshot?.turns.map(turn => turn.assistantMarkdown))
                .toEqual(['New conversation B answer']);
        } finally {
            harness.dispose();
        }
    });

    it('retains only the final assistant identity when a generic pending ID changes during page promotion', async () => {
        document.querySelector('main')!.innerHTML = `
            <div data-turn-key="user-1">
                <div data-content-search-turn-key="fallback-turn-0">
                    <div data-chatgpt-search-unit-key="fallback-turn-0:0:user" data-chatgpt-search-message-ids="user-1">Question 1</div>
                    <div class="group flex flex-col pb-2 pt-2">
                        <div data-chatgpt-search-unit-key="fallback-turn-0:2:assistant" data-chatgpt-search-message-ids="assistant-pending-1">
                            <div data-markdown-text-style="assistant-message">Initial answer</div>
                        </div>
                        <div class="turn-action-controls"><button aria-label="Copy">Copy</button></div>
                    </div>
                </div>
            </div>
        `;
        const harness = createRuntime();

        try {
            harness.runtime.init();
            await settle();
            expect(harness.runtime.source.read().snapshot?.turns).toHaveLength(1);

            history.pushState({}, '', '/c/promoted-native-conversation');
            document.querySelector('[data-chatgpt-search-unit-key$=":assistant"]')!
                .setAttribute('data-chatgpt-search-message-ids', 'assistant-final-1');
            document.querySelector('[data-markdown-text-style]')!.textContent = 'Final answer';
            await settle();

            expect(harness.runtime.source.read().snapshot?.turns.map(turn => turn.identity.assistantMessageId))
                .toEqual(['assistant-final-1']);
        } finally {
            harness.dispose();
        }
    });
});
