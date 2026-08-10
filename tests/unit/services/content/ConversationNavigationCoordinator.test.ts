import { describe, expect, it, vi } from 'vitest';
import type { ConversationContentStateV1 } from '@/contracts/conversationContent';
import { ConversationNavigationCoordinator } from '@/services/content/ConversationNavigationCoordinator';
import { createConversationContentSource, toConversationSnapshotV1 } from '../../../helpers/chatgptContentFixtures';

function acquiredWhileSyncingState(): ConversationContentStateV1 {
    const snapshot = toConversationSnapshotV1({
        conversationId: '12345678-1234-1234-1234-123456789abc',
        rounds: [{
            id: 'round-1',
            userPrompt: 'Prompt 1',
            assistantContent: 'Answer 1',
            userMessageId: 'user-1',
            assistantMessageId: 'assistant-1',
        }],
    });
    return {
        kind: 'syncing',
        document: snapshot.document,
        snapshot: {
            ...snapshot,
            coverage: 'complete',
            proof: { basis: 'source' },
        },
    };
}

describe('ConversationNavigationCoordinator', () => {
    it('resolves identity to the current canonical position and executes once', async () => {
        const source = createConversationContentSource({
            conversationId: '12345678-1234-1234-1234-123456789abc',
            rounds: [
                { id: 'round-1', userPrompt: 'First', assistantContent: 'A1', userMessageId: 'user-1', assistantMessageId: 'assistant-1' },
                { id: 'round-2', userPrompt: 'Second', assistantContent: 'A2', userMessageId: 'user-2', assistantMessageId: 'assistant-2' },
            ],
        });
        const execute = vi.fn(async () => ({ ok: true as const }));
        const coordinator = new ConversationNavigationCoordinator({ source, execute });

        const result = await coordinator.navigate({
            position: 2,
            messageId: 'assistant-2',
            source: 'directory',
        });

        expect(result).toEqual({
            ok: true,
            phase: 'hydrated',
            resolvedBy: 'identity',
            target: {
                documentKey: 'chatgpt:conversation:12345678-1234-1234-1234-123456789abc',
                position: 2,
                roundId: 'round-2',
                userMessageId: 'user-2',
                assistantMessageId: 'assistant-2',
            },
        });
        expect(execute).toHaveBeenCalledTimes(1);
    });

    it('fails closed when message identity and stored position disagree', async () => {
        const source = createConversationContentSource({
            conversationId: '12345678-1234-1234-1234-123456789abc',
            rounds: [
                { id: 'round-1', userPrompt: 'First', assistantContent: 'A1', userMessageId: 'user-1', assistantMessageId: 'assistant-1' },
                { id: 'round-2', userPrompt: 'Second', assistantContent: 'A2', userMessageId: 'user-2', assistantMessageId: 'assistant-2' },
            ],
        });
        const execute = vi.fn(async () => ({ ok: true as const }));
        const coordinator = new ConversationNavigationCoordinator({ source, execute });

        const result = await coordinator.navigate({
            position: 1,
            messageId: 'assistant-2',
            source: 'bookmark',
        });

        expect(result).toEqual({ ok: false, reason: 'identity-conflict' });
        expect(execute).not.toHaveBeenCalled();
    });

    it('uses position only for legacy bookmarks after a complete source is available', async () => {
        const source = createConversationContentSource({
            conversationId: '12345678-1234-1234-1234-123456789abc',
            rounds: [{ id: 'round-1', userPrompt: 'First', assistantContent: 'A1', userMessageId: 'user-1', assistantMessageId: 'assistant-1' }],
        });
        const execute = vi.fn(async () => ({ ok: true as const }));
        const coordinator = new ConversationNavigationCoordinator({ source, execute });

        const result = await coordinator.navigate({ position: 1, source: 'bookmark' });

        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.resolvedBy).toBe('position');
            expect(result.target.assistantMessageId).toBe('assistant-1');
        }
    });

    it('uses an acquired message immediately even while the route state is syncing', async () => {
        vi.useFakeTimers();
        try {
            const source = createConversationContentSource(acquiredWhileSyncingState());
            const execute = vi.fn(async () => ({ ok: true as const }));
            const coordinator = new ConversationNavigationCoordinator({ source, execute });
            const resultPromise = coordinator.navigate({
                position: 1,
                messageId: 'assistant-1',
                source: 'directory',
            }, { timeoutMs: 1_000 });
            await vi.advanceTimersByTimeAsync(0);

            const result = await resultPromise;
            expect(result.ok).toBe(true);
            expect(execute).toHaveBeenCalledTimes(1);
        } finally {
            vi.useRealTimers();
        }
    });

    it('does not use a position fallback for a directory target with a missing identity', async () => {
        const source = createConversationContentSource({
            conversationId: '12345678-1234-1234-1234-123456789abc',
            rounds: [{ id: 'round-1', userPrompt: 'First', assistantContent: 'A1', userMessageId: 'user-1', assistantMessageId: 'assistant-1' }],
        });
        const execute = vi.fn(async () => ({ ok: true as const }));
        const coordinator = new ConversationNavigationCoordinator({ source, execute });

        const result = await coordinator.navigate({ position: 1, source: 'directory' });

        expect(result).toEqual({ ok: false, reason: 'source-unavailable' });
        expect(execute).not.toHaveBeenCalled();
    });
});
