import { describe, expect, it, vi } from 'vitest';
import type { ChatGPTConversationState } from '@/drivers/content/chatgpt/types';
import { ChatGPTConversationReaderBinding } from '@/ui/content/controllers/ChatGPTConversationReaderBinding';
import type { ReaderItem } from '@/services/reader/types';

function buildState(roundCount: number): ChatGPTConversationState {
    const revision = roundCount;
    return {
        status: 'ready',
        routeEpoch: 1,
        revision,
        conversationId: 'conv-1',
        snapshot: {
            conversationId: 'conv-1',
            revision,
            proof: 'observed-graph',
            branchKey: `assistant-${roundCount}`,
            capturedAt: revision,
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
        },
    };
}

function buildReaderItem(position: number): ReaderItem {
    return {
        id: `chatgpt-assistant-${position}`,
        userPrompt: `Prompt ${position}`,
        content: `Answer ${position}`,
        meta: {
            platformId: 'chatgpt',
            position,
            roundId: `round-${position}`,
            userMessageId: `user-${position}`,
            assistantMessageId: `assistant-${position}`,
            messageId: `assistant-${position}`,
        },
    };
}

function createSource(initialState: ChatGPTConversationState) {
    let state = initialState;
    const listeners = new Set<(next: ChatGPTConversationState) => void>();
    const ensureReady = vi.fn(async () => state.snapshot);
    return {
        source: {
            getState: () => state,
            ensureReady,
            subscribe: (listener: (next: ChatGPTConversationState) => void) => {
                listeners.add(listener);
                listener(state);
                return () => listeners.delete(listener);
            },
        },
        ensureReady,
        publish(next: ChatGPTConversationState) {
            state = next;
            for (const listener of listeners) listener(state);
        },
    };
}

describe('ChatGPTConversationReaderBinding', () => {
    it('appends a completed canonical successor from subscription state without semantic acquisition', async () => {
        const source = createSource(buildState(1));
        const currentItems = [buildReaderItem(1)];
        const readerPanel = {
            isShowingConversationReader: vi.fn(() => true),
            getItemsSnapshot: vi.fn(() => [...currentItems]),
            appendItem: vi.fn(async (item: ReaderItem) => {
                currentItems.push(item);
            }),
            replaceItems: vi.fn(async () => undefined),
            hide: vi.fn(),
        } as any;
        const binding = new ChatGPTConversationReaderBinding({
            adapter: { getPlatformId: () => 'chatgpt' } as any,
            source: source.source,
            readerPanel,
            pageUrl: () => 'https://chatgpt.com/c/conv-1',
        });

        binding.init();
        source.publish(buildState(2));
        await vi.waitFor(() => expect(readerPanel.appendItem).toHaveBeenCalledTimes(1));

        expect(readerPanel.appendItem).toHaveBeenCalledWith(expect.objectContaining({
            userPrompt: 'Prompt 2',
            content: 'Answer 2',
        }));
        expect(readerPanel.replaceItems).not.toHaveBeenCalled();
        expect(source.ensureReady).not.toHaveBeenCalled();
        binding.dispose();
    });

    it('replaces the open Reader when canonical content changes under the same typed identity', async () => {
        const source = createSource(buildState(1));
        const currentItems = [buildReaderItem(1)];
        const readerPanel = {
            isShowingConversationReader: vi.fn(() => true),
            getItemsSnapshot: vi.fn(() => [...currentItems]),
            appendItem: vi.fn(async () => undefined),
            replaceItems: vi.fn(async () => undefined),
            hide: vi.fn(),
        } as any;
        const binding = new ChatGPTConversationReaderBinding({
            adapter: { getPlatformId: () => 'chatgpt' } as any,
            source: source.source,
            readerPanel,
            pageUrl: () => 'https://chatgpt.com/c/conv-1',
        });
        binding.init();

        const corrected = buildState(1);
        corrected.revision = 2;
        corrected.snapshot = {
            ...corrected.snapshot!,
            revision: 2,
            capturedAt: 2,
            rounds: [{
                ...corrected.snapshot!.rounds[0]!,
                assistantContent: 'Corrected answer',
            }],
        };
        source.publish(corrected);
        await vi.waitFor(() => expect(readerPanel.replaceItems).toHaveBeenCalledOnce());

        expect(readerPanel.replaceItems).toHaveBeenCalledWith(
            [expect.objectContaining({ content: 'Corrected answer' })],
            { preserveCurrentIdentity: true },
        );
        expect(readerPanel.appendItem).not.toHaveBeenCalled();
        binding.dispose();
    });

    it('closes the live Reader immediately when canonical content is withdrawn', () => {
        const source = createSource(buildState(1));
        let open = true;
        const readerPanel = {
            isShowingConversationReader: vi.fn(() => open),
            getItemsSnapshot: vi.fn(() => [buildReaderItem(1)]),
            appendItem: vi.fn(),
            replaceItems: vi.fn(),
            hide: vi.fn(() => {
                open = false;
            }),
        } as any;
        const binding = new ChatGPTConversationReaderBinding({
            adapter: { getPlatformId: () => 'chatgpt' } as any,
            source: source.source,
            readerPanel,
            pageUrl: () => 'https://chatgpt.com/c/conv-1',
        });
        binding.init();

        source.publish({
            status: 'blocked',
            routeEpoch: 1,
            revision: 2,
            conversationId: 'conv-1',
            snapshot: null,
            reason: 'identity-conflict',
        });

        expect(readerPanel.hide).toHaveBeenCalledOnce();
        expect(source.ensureReady).not.toHaveBeenCalled();
        binding.dispose();
    });

    it('appends every canonical successor without consulting materialized DOM turns', async () => {
        const source = createSource(buildState(1));
        const currentItems = [buildReaderItem(1)];
        const readerPanel = {
            isShowingConversationReader: vi.fn(() => true),
            getItemsSnapshot: vi.fn(() => [...currentItems]),
            appendItem: vi.fn(async (item: ReaderItem) => {
                currentItems.push(item);
            }),
            replaceItems: vi.fn(),
            hide: vi.fn(),
        } as any;
        const binding = new ChatGPTConversationReaderBinding({
            adapter: { getPlatformId: () => 'chatgpt' } as any,
            source: source.source,
            readerPanel,
            pageUrl: () => 'https://chatgpt.com/c/conv-1',
        });
        binding.init();

        source.publish(buildState(3));
        await vi.waitFor(() => expect(readerPanel.appendItem).toHaveBeenCalledTimes(2));

        expect(currentItems.map((item) => item.meta?.position)).toEqual([1, 2, 3]);
        expect(readerPanel.replaceItems).not.toHaveBeenCalled();
        expect(source.ensureReady).not.toHaveBeenCalled();
        binding.dispose();
    });

    it('ignores repeated source revisions whose canonical Reader projection is unchanged', async () => {
        const source = createSource(buildState(1));
        const readerPanel = {
            isShowingConversationReader: vi.fn(() => true),
            getItemsSnapshot: vi.fn(() => [buildReaderItem(1)]),
            appendItem: vi.fn(),
            replaceItems: vi.fn(),
            hide: vi.fn(),
        } as any;
        const binding = new ChatGPTConversationReaderBinding({
            adapter: { getPlatformId: () => 'chatgpt' } as any,
            source: source.source,
            readerPanel,
            pageUrl: () => 'https://chatgpt.com/c/conv-1',
        });
        binding.init();
        source.publish(buildState(1));
        await Promise.resolve();

        expect(readerPanel.appendItem).not.toHaveBeenCalled();
        expect(readerPanel.replaceItems).not.toHaveBeenCalled();
        binding.dispose();
    });

    it('stops a pending multi-item append after a route epoch is withdrawn', async () => {
        const source = createSource(buildState(1));
        const currentItems = [buildReaderItem(1)];
        let finishFirstAppend!: () => void;
        const firstAppend = new Promise<void>((resolve) => {
            finishFirstAppend = resolve;
        });
        let open = true;
        const readerPanel = {
            isShowingConversationReader: vi.fn(() => open),
            getItemsSnapshot: vi.fn(() => [...currentItems]),
            appendItem: vi.fn()
                .mockImplementationOnce(async (item: ReaderItem) => {
                    currentItems.push(item);
                    await firstAppend;
                })
                .mockImplementation(async (item: ReaderItem) => {
                    currentItems.push(item);
                }),
            replaceItems: vi.fn(),
            hide: vi.fn(() => {
                open = false;
            }),
        } as any;
        const binding = new ChatGPTConversationReaderBinding({
            adapter: { getPlatformId: () => 'chatgpt' } as any,
            source: source.source,
            readerPanel,
            pageUrl: () => 'https://chatgpt.com/c/conv-1',
        });
        binding.init();

        source.publish(buildState(3));
        await vi.waitFor(() => expect(readerPanel.appendItem).toHaveBeenCalledOnce());
        source.publish({
            status: 'collecting',
            routeEpoch: 2,
            revision: 0,
            conversationId: null,
            snapshot: null,
        });
        finishFirstAppend();
        await Promise.resolve();

        expect(readerPanel.hide).toHaveBeenCalledOnce();
        expect(readerPanel.appendItem).toHaveBeenCalledOnce();
        binding.dispose();
    });
});
