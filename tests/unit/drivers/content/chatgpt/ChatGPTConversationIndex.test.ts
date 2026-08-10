import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ChatGPTAdapter } from '@/drivers/content/adapters/sites/chatgpt';
import { getChatGPTConversationIndex } from '@/drivers/content/chatgpt/ChatGPTConversationIndex';
import { resolveChatGPTCanonicalTarget } from '@/drivers/content/chatgpt/ChatGPTConversationNavigation';
import {
    createConversationContentSource,
} from '../../../../helpers/chatgptContentFixtures';

function buildSnapshot(roundCount: number): any {
    return {
        conversationId: '12345678-1234-1234-1234-123456789abc',
        revision: roundCount,
        rounds: Array.from({ length: roundCount }, (_, index) => {
            const position = index + 1;
            return {
                id: `round-${position}`,
                position,
                userPrompt: `Prompt ${position}`,
                assistantContent: `Answer ${position}`,
                preview: `Prompt ${position}`,
                messageId: `assistant-${position}`,
                userMessageId: `user-${position}`,
                assistantMessageId: `assistant-${position}`,
            };
        }),
    };
}

function bindSnapshot(
    index: ReturnType<typeof getChatGPTConversationIndex>,
    snapshot: any,
): void {
    index.bindConversationSource(createConversationContentSource(snapshot));
}

function mountWindow(positions: number[]): void {
    const main = document.querySelector('main');
    if (!(main instanceof HTMLElement)) throw new Error('fixture main is missing');
    main.innerHTML = positions.map((position) => `
        <article data-turn="user" data-turn-id="round-${position}">
            <div data-message-author-role="user" data-message-id="user-${position}">Prompt ${position}</div>
        </article>
        <article data-turn="assistant" data-turn-id="round-${position}">
            <div data-message-author-role="assistant" data-message-id="assistant-${position}">
                <div class="markdown prose">Answer ${position}</div>
            </div>
        </article>
    `).join('');
}

async function deliverMutations(): Promise<void> {
    await Promise.resolve();
    await Promise.resolve();
}

describe('ChatGPTConversationIndex', () => {
    let adapter: ChatGPTAdapter;

    beforeEach(() => {
        window.history.replaceState({}, '', '/c/12345678-1234-1234-1234-123456789abc');
        document.documentElement.innerHTML = '<head></head><body><main></main></body>';
        adapter = new ChatGPTAdapter();
    });

    afterEach(() => {
        adapter.dispose();
        window.history.replaceState({}, '', '/');
        document.documentElement.innerHTML = '<head></head><body></body>';
    });

    it('keeps canonical order while the host materializes different DOM windows', async () => {
        const index = getChatGPTConversationIndex(adapter);
        bindSnapshot(index, buildSnapshot(50));

        mountWindow([1, 2, 3, 4, 5, 6]);
        await deliverMutations();
        expect(index.getRounds()).toHaveLength(50);
        expect(index.getRounds().filter((round) => round.materialized).map((round) => round.position)).toEqual([1, 2, 3, 4, 5, 6]);

        mountWindow([20, 21, 22, 23, 24, 25, 26]);
        await deliverMutations();
        expect(index.getRounds()).toHaveLength(50);
        expect(index.getRounds().filter((round) => round.materialized).map((round) => round.position)).toEqual([20, 21, 22, 23, 24, 25, 26]);

        mountWindow([45, 46, 47, 48, 49, 50]);
        await deliverMutations();
        const rounds = index.getRounds();
        expect(rounds.map((round) => round.position)).toEqual(Array.from({ length: 50 }, (_, index) => index + 1));
        expect(rounds.filter((round) => round.materialized).map((round) => round.position)).toEqual([45, 46, 47, 48, 49, 50]);
    });

    it('rebinds DOM change signals after the content runtime is disabled and re-enabled', async () => {
        const index = getChatGPTConversationIndex(adapter);
        bindSnapshot(index, buildSnapshot(1));
        adapter.dispose();

        bindSnapshot(index, buildSnapshot(1));
        const listener = vi.fn();
        index.subscribe(listener);
        mountWindow([1]);
        await deliverMutations();

        expect(listener).toHaveBeenCalled();
        expect(index.getRounds()).toHaveLength(1);
    });

    it('fails closed when user identity matches but the observable assistant identity conflicts', () => {
        const index = getChatGPTConversationIndex(adapter);
        bindSnapshot(index, buildSnapshot(1));
        document.querySelector('main')!.innerHTML = `
            <article data-turn="user" data-turn-id="round-1">
                <div data-message-author-role="user" data-message-id="user-1">Prompt 1</div>
            </article>
            <article data-turn="assistant" data-turn-id="assistant-turn-new">
                <div data-message-author-role="assistant" data-message-id="assistant-new">Answer 1</div>
            </article>
        `;

        expect(index.getRounds()[0]?.materialized).toBeNull();
    });

    it('materializes a cached assistant when its virtualized user node is not mounted', () => {
        const index = getChatGPTConversationIndex(adapter);
        bindSnapshot(index, buildSnapshot(1));
        document.querySelector('main')!.innerHTML = `
            <section
                data-testid="conversation-turn-2"
                data-turn="assistant"
                data-turn-id="assistant-turn-1"
                data-turn-id-container="assistant-turn-1"
            >
                <div data-message-author-role="assistant" data-message-id="assistant-1">
                    <div class="markdown prose">Answer 1</div>
                </div>
                <div class="z-0 flex"><button data-testid="copy-turn-action-button">Copy</button></div>
            </section>
        `;

        const [round] = index.getRounds();

        expect(round?.materialized?.identity).toEqual({
            roundId: null,
            userMessageId: null,
            assistantMessageId: 'assistant-1',
            assistantTurnId: 'assistant-turn-1',
        });
        expect(round?.materialized?.groupEls).toHaveLength(1);
        expect(round?.materialized?.assistantRootEl.getAttribute('data-testid'))
            .toBe('conversation-turn-2');
    });

    it('joins a Deep Research iframe through its observable assistant turn identity', () => {
        const index = getChatGPTConversationIndex(adapter);
        const snapshot = buildSnapshot(1);
        snapshot.rounds[0] = {
            ...snapshot.rounds[0]!,
            id: 'deep-user-turn',
            messageId: 'deep-assistant-turn',
            userMessageId: null,
            assistantMessageId: 'deep-assistant-turn',
        };
        bindSnapshot(index, snapshot);
        document.querySelector('main')!.innerHTML = `
            <article data-turn="user" data-turn-id="deep-user-turn" data-testid="conversation-turn-1">
                <div data-message-author-role="user">Research this topic</div>
            </article>
            <article data-turn="assistant" data-turn-id="deep-assistant-turn" data-testid="conversation-turn-2">
                <div data-conversation-screenshot-content>
                    <div class="report-stack"><iframe title="internal://deep-research"></iframe></div>
                </div>
            </article>
        `;

        const [round] = index.getRounds();

        expect(round?.materialized?.assistantMessageEl).toBeInstanceOf(HTMLIFrameElement);
        expect(round?.materialized?.identity).toEqual({
            roundId: 'deep-user-turn',
            userMessageId: null,
            assistantMessageId: null,
            assistantTurnId: 'deep-assistant-turn',
        });
    });

    it('does not treat a Deep Research turn id as conflicting with its nested report message id', () => {
        const index = getChatGPTConversationIndex(adapter);
        const snapshot = buildSnapshot(1);
        snapshot.rounds[0] = {
            ...snapshot.rounds[0]!,
            id: 'deep-user-turn',
            messageId: 'nested-report-message',
            userMessageId: 'deep-user-message',
            assistantMessageId: 'nested-report-message',
        };
        bindSnapshot(index, snapshot);
        document.querySelector('main')!.innerHTML = `
            <article data-turn="user" data-turn-id="deep-user-turn" data-testid="conversation-turn-1">
                <div data-message-author-role="user" data-message-id="deep-user-message">Research this topic</div>
            </article>
            <article data-turn="assistant" data-turn-id="deep-assistant-turn" data-testid="conversation-turn-2">
                <div data-conversation-screenshot-content>
                    <div class="report-stack"><iframe title="internal://deep-research"></iframe></div>
                </div>
            </article>
        `;

        const [round] = index.getRounds();

        expect(round?.materialized?.assistantMessageEl).toBeInstanceOf(HTMLIFrameElement);
        expect(index.resolveRoundForElement(round!.materialized!.assistantMessageEl)?.round.messageId)
            .toBe('nested-report-message');
    });

    it('fails closed when an explicit canonical navigation identity is ambiguous', () => {
        const index = getChatGPTConversationIndex(adapter);
        const snapshot = buildSnapshot(2);
        snapshot.rounds = snapshot.rounds.map((round) => ({
            ...round,
            messageId: 'shared-assistant',
            assistantMessageId: 'shared-assistant',
        }));
        bindSnapshot(index, snapshot);

        expect(resolveChatGPTCanonicalTarget(adapter, {
            position: 1,
            assistantMessageId: 'shared-assistant',
        })).toBeNull();
    });

    it('projects the current state immediately when a source is bound', () => {
        const index = getChatGPTConversationIndex(adapter);
        const snapshot = buildSnapshot(3);
        bindSnapshot(index, snapshot);

        expect(index.getRounds().map((round) => round.position)).toEqual([1, 2, 3]);
    });

    it('refuses to project a snapshot from a different conversation route', () => {
        window.history.replaceState({}, '', '/c/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee');
        const index = getChatGPTConversationIndex(adapter);
        bindSnapshot(index, buildSnapshot(3));

        expect(index.getRounds()).toEqual([]);
    });

    it('updates only from published state and never acquires semantics itself', () => {
        const index = getChatGPTConversationIndex(adapter);
        const initial = buildSnapshot(1);
        const updated = buildSnapshot(4);
        const source = createConversationContentSource(initial);
        const ensureReady = vi.fn();
        index.bindConversationSource(source);

        expect(index.getRounds()).toHaveLength(1);
        source.publish(updated);
        expect(index.getRounds()).toHaveLength(4);
        expect(ensureReady).not.toHaveBeenCalled();
    });

    it('resolves a unique materialized round for an element and fails closed on ambiguity', async () => {
        mountWindow([1, 2]);
        await deliverMutations();
        const index = getChatGPTConversationIndex(adapter);
        bindSnapshot(index, buildSnapshot(2));
        const assistantChild = document.querySelector('[data-message-id="assistant-1"] .markdown');
        if (!(assistantChild instanceof HTMLElement)) throw new Error('assistant child is missing');

        expect(index.resolveRoundForElement(assistantChild)?.position).toBe(1);
        expect(index.resolveRoundForElement(document.querySelector('main') as HTMLElement)).toBeNull();
        expect(index.resolveRoundForElement(document.createElement('div'))).toBeNull();
    });

    it('resolves a remounted assistant by its unique canonical message id when host turn ids drift', () => {
        const index = getChatGPTConversationIndex(adapter);
        const snapshot = buildSnapshot(1);
        snapshot.rounds[0] = {
            ...snapshot.rounds[0]!,
            id: 'canonical-user-message',
            userMessageId: 'canonical-user-message',
        };
        bindSnapshot(index, snapshot);
        document.querySelector('main')!.innerHTML = `
            <article data-turn="user" data-turn-id="host-user-turn">
                <div data-message-author-role="user" data-message-id="canonical-user-message">Prompt 1</div>
            </article>
            <article data-turn="assistant" data-turn-id="host-assistant-turn">
                <div data-message-author-role="assistant" data-message-id="assistant-1">
                    <div class="markdown prose">Answer 1</div>
                </div>
            </article>
        `;
        const assistant = document.querySelector('[data-message-id="assistant-1"]');
        if (!(assistant instanceof HTMLElement)) throw new Error('assistant message is missing');

        expect(index.getRounds()[0]?.materialized).toBeNull();
        expect(index.resolveRoundForElement(assistant)?.position).toBe(1);
    });

    it('keeps notifying subscribers when another consumer fails', () => {
        const index = getChatGPTConversationIndex(adapter);
        const survivingListener = vi.fn();
        index.subscribe(() => {
            throw new Error('directory render failed');
        });
        index.subscribe(survivingListener);

        bindSnapshot(index, buildSnapshot(1));

        expect(survivingListener).toHaveBeenCalledTimes(1);
    });
});
