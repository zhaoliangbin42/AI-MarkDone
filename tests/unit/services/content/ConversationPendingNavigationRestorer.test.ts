import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ConversationNavigationPortV1 } from '@/contracts/conversationNavigation';
import {
    clearPendingNavigation,
    setPendingNavigation,
} from '@/drivers/content/bookmarks/navigation';
import { ConversationPendingNavigationRestorer } from '@/services/content/ConversationPendingNavigationRestorer';
import { createConversationContentSource } from '../../../helpers/chatgptContentFixtures';

describe('ConversationPendingNavigationRestorer', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        sessionStorage.clear();
        window.history.replaceState({}, '', '/c/current');
    });

    afterEach(() => {
        clearPendingNavigation();
        vi.runOnlyPendingTimers();
        vi.useRealTimers();
        window.history.replaceState({}, '', '/');
    });

    it('waits for an SPA route to match before navigating the canonical bookmark target', async () => {
        const navigate = vi.fn(async () => ({
            ok: true as const,
            phase: 'hydrated' as const,
            resolvedBy: 'identity' as const,
            target: {
                documentKey: 'chatgpt:conversation:target',
                position: 7,
                roundId: 'round-7',
                userMessageId: 'user-7',
                assistantMessageId: 'assistant-7',
            },
        }));
        const restorer = new ConversationPendingNavigationRestorer({
            navigation: { navigate, cancelActive: vi.fn() } as ConversationNavigationPortV1,
            source: createConversationContentSource({
                conversationId: 'target',
                rounds: [{ id: 'round-7', userPrompt: 'Prompt', assistantContent: 'Answer', userMessageId: 'user-7', assistantMessageId: 'assistant-7' }],
            }),
        });

        setPendingNavigation({
            url: `${window.location.origin}/c/target`,
            position: 7,
            messageId: 'assistant-7',
        });
        restorer.start();
        await Promise.resolve();
        expect(navigate).not.toHaveBeenCalled();

        window.history.replaceState({}, '', '/c/target');
        await vi.advanceTimersByTimeAsync(500);
        await Promise.resolve();

        expect(navigate).toHaveBeenCalledTimes(1);
        expect(navigate).toHaveBeenCalledWith({
            position: 7,
            messageId: 'assistant-7',
            assistantMessageId: 'assistant-7',
            source: 'bookmark',
        }, { timeoutMs: 15_000, align: 'start' });
        expect(sessionStorage.getItem('aimd:bookmarkNavigate:v1')).toBeNull();
        restorer.dispose();
    });

    it('reacts to a pending target created after the runtime is already alive', async () => {
        const navigate = vi.fn(async () => ({
            ok: true as const,
            phase: 'hydrated' as const,
            resolvedBy: 'identity' as const,
            target: {
                documentKey: 'chatgpt:conversation:current',
                position: 1,
                roundId: 'round-1',
                userMessageId: 'user-1',
                assistantMessageId: 'assistant-1',
            },
        }));
        const restorer = new ConversationPendingNavigationRestorer({
            navigation: { navigate, cancelActive: vi.fn() } as ConversationNavigationPortV1,
            source: createConversationContentSource({
                conversationId: 'current',
                rounds: [{ id: 'round-1', userPrompt: 'Prompt', assistantContent: 'Answer', userMessageId: 'user-1', assistantMessageId: 'assistant-1' }],
            }),
        });
        restorer.start();

        setPendingNavigation({
            url: `${window.location.origin}/c/current`,
            position: 1,
            messageId: 'assistant-1',
        });
        await Promise.resolve();

        expect(navigate).toHaveBeenCalledTimes(1);
        restorer.dispose();
    });

    it('retries a slow source target on a later source revision without URL polling', async () => {
        const source = createConversationContentSource({
            conversationId: 'current',
            rounds: [{ id: 'round-1', userPrompt: 'Prompt', assistantContent: 'Answer', userMessageId: 'user-1', assistantMessageId: 'assistant-1' }],
        });
        const navigate = vi.fn()
            .mockResolvedValueOnce({ ok: false as const, reason: 'hydration-timeout' as const })
            .mockResolvedValueOnce({
                ok: true as const,
                phase: 'hydrated' as const,
                resolvedBy: 'identity' as const,
                target: {
                    documentKey: 'chatgpt:conversation:current',
                    position: 1,
                    roundId: 'round-1',
                    userMessageId: 'user-1',
                    assistantMessageId: 'assistant-1',
                },
            });
        const restorer = new ConversationPendingNavigationRestorer({
            navigation: { navigate, cancelActive: vi.fn() } as ConversationNavigationPortV1,
            source,
        });

        setPendingNavigation({
            url: `${window.location.origin}/c/current`,
            position: 1,
            messageId: 'assistant-1',
        });
        restorer.start();
        await Promise.resolve();
        await Promise.resolve();
        expect(navigate).toHaveBeenCalledTimes(1);
        expect(sessionStorage.getItem('aimd:bookmarkNavigate:v1')).not.toBeNull();

        source.publish({
            conversationId: 'current',
            rounds: [{ id: 'round-1', userPrompt: 'Prompt', assistantContent: 'Answer', userMessageId: 'user-1', assistantMessageId: 'assistant-1' }],
        });
        await Promise.resolve();
        await Promise.resolve();
        expect(navigate).toHaveBeenCalledTimes(2);
        expect(sessionStorage.getItem('aimd:bookmarkNavigate:v1')).toBeNull();
        restorer.dispose();
    });
});
