import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ChatGPTAdapter } from '@/drivers/content/adapters/sites/chatgpt';
import { getChatGPTConversationIndex } from '@/drivers/content/chatgpt/ChatGPTConversationIndex';
import { resolveChatGPTCanonicalTarget } from '@/drivers/content/chatgpt/ChatGPTConversationNavigation';
import type { ChatGPTConversationSnapshot } from '@/drivers/content/chatgpt/types';

function buildSnapshot(roundCount: number): ChatGPTConversationSnapshot {
    return {
        conversationId: '12345678-1234-1234-1234-123456789abc',
        buildFingerprint: 'test-build',
        source: 'runtime-bridge',
        origin: 'conversation-graph',
        coverage: 'complete',
        branchKey: 'branch-test',
        capturedAt: Date.now(),
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
        index.setSnapshot(buildSnapshot(50));

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

    it('fails closed when user identity matches but the observable assistant identity conflicts', () => {
        const index = getChatGPTConversationIndex(adapter);
        index.setSnapshot(buildSnapshot(1));
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
        index.setSnapshot(snapshot);
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
        index.setSnapshot(snapshot);
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
        index.setSnapshot(snapshot);

        expect(resolveChatGPTCanonicalTarget(adapter, {
            position: 1,
            assistantMessageId: 'shared-assistant',
        })).toBeNull();
    });

    it('ensures the semantic snapshot through the bound source during startup', async () => {
        const index = getChatGPTConversationIndex(adapter);
        const snapshot = buildSnapshot(3);
        index.bindSnapshotSource({
            subscribe: () => () => undefined,
            peekCurrentSnapshot: () => null,
            getSnapshot: async () => snapshot,
        });

        await expect(index.ensureSnapshot()).resolves.toBe(snapshot);
        expect(index.getRounds().map((round) => round.position)).toEqual([1, 2, 3]);
    });

    it('refuses to project a snapshot from a different conversation route', () => {
        window.history.replaceState({}, '', '/c/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee');
        const index = getChatGPTConversationIndex(adapter);
        index.setSnapshot(buildSnapshot(3));

        expect(index.getSnapshot()).toBeNull();
        expect(index.getRounds()).toEqual([]);
    });

    it('does not let a pending normal ensure swallow a forced refresh', async () => {
        const index = getChatGPTConversationIndex(adapter);
        let resolveNormal!: (snapshot: ChatGPTConversationSnapshot | null) => void;
        const normalRequest = new Promise<ChatGPTConversationSnapshot | null>((resolve) => {
            resolveNormal = resolve;
        });
        const forceRefresh = vi.fn(async () => buildSnapshot(4));
        index.bindSnapshotSource({
            subscribe: () => () => undefined,
            getSnapshot: () => normalRequest,
            forceRefreshCurrentConversation: forceRefresh,
        });

        const pending = index.ensureSnapshot();
        const forced = index.ensureSnapshot({ force: true });

        expect(forceRefresh).toHaveBeenCalledTimes(1);
        await expect(forced).resolves.toMatchObject({ rounds: expect.any(Array) });
        resolveNormal(null);
        await expect(pending).resolves.toMatchObject({ rounds: expect.any(Array) });
    });

    it('isolates pending snapshot requests by conversation and drops a late result from the previous route', async () => {
        const index = getChatGPTConversationIndex(adapter);
        const conversationB = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
        const snapshotA = buildSnapshot(2);
        const snapshotB = { ...buildSnapshot(3), conversationId: conversationB };
        let resolveA!: (snapshot: ChatGPTConversationSnapshot) => void;
        const requestA = new Promise<ChatGPTConversationSnapshot>((resolve) => { resolveA = resolve; });
        const getSnapshot = vi.fn()
            .mockImplementationOnce(() => requestA)
            .mockImplementationOnce(async () => snapshotB);
        index.bindSnapshotSource({
            subscribe: () => () => undefined,
            getSnapshot,
        });

        const pendingA = index.ensureSnapshot();
        window.history.replaceState({}, '', `/c/${conversationB}`);
        const pendingB = index.ensureSnapshot();
        await Promise.resolve();
        resolveA(snapshotA);
        const [, resultB] = await Promise.all([pendingA, pendingB]);

        expect(getSnapshot).toHaveBeenCalledTimes(2);
        expect(resultB).toBe(snapshotB);
        expect(index.getSnapshot()).toBe(snapshotB);
        expect(index.getRounds()).toHaveLength(3);
    });

    it('refreshes semantics once when the DOM materializes an unknown typed identity', async () => {
        mountWindow([1]);
        const index = getChatGPTConversationIndex(adapter);
        index.setSnapshot(buildSnapshot(1));
        const forceRefresh = vi.fn(async () => buildSnapshot(2));
        index.bindSnapshotSource({
            subscribe: () => () => undefined,
            forceRefreshCurrentConversation: forceRefresh,
        });

        mountWindow([1, 2]);
        await deliverMutations();
        await vi.waitFor(() => expect(forceRefresh).toHaveBeenCalledTimes(1));
        await vi.waitFor(() => expect(index.getRounds()).toHaveLength(2));
    });

    it('resolves a unique materialized round for an element and fails closed on ambiguity', async () => {
        mountWindow([1, 2]);
        await deliverMutations();
        const index = getChatGPTConversationIndex(adapter);
        index.setSnapshot(buildSnapshot(2));
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
        index.setSnapshot(snapshot);
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

        index.setSnapshot(buildSnapshot(1));

        expect(survivingListener).toHaveBeenCalledTimes(1);
    });
});
