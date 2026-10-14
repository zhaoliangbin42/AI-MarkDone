import { describe, expect, it } from 'vitest';
import { buildReaderSessionSnapshot } from '@/services/reader/readerSessionSnapshot';
import type { ReaderItem } from '@/services/reader/types';
import { richSvgBlock } from '../../../helpers/richContentFixtures';

describe('buildReaderSessionSnapshot', () => {
    it.each(['chatgpt:conversation:reader-a', 'chatgpt:page:reader-a'])('retains the item document key in a detached clone (%s)', async documentKey => {
        const item: ReaderItem = {
            id: 'assistant-1', userPrompt: 'Question', content: 'Answer',
            meta: { documentKey, assistantMessageId: 'assistant-1' },
        };
        const snapshot = await buildReaderSessionSnapshot({
            items: [item], startIndex: 0, sourceUrl: 'https://chatgpt.com/', theme: 'light',
        });
        item.meta!.documentKey = 'chatgpt:conversation:reader-b';

        expect(snapshot.items[0]?.meta?.documentKey).toBe(documentKey);
        expect(snapshot.items[0]?.meta).not.toBe(item.meta);
    });

    it('retains immutable rich descriptors in the detached snapshot', async () => {
        const blocks = [richSvgBlock()];
        const snapshot = await buildReaderSessionSnapshot({ items: [{ id: 'rich', userPrompt: '', content: '![Diagram](aimd-rich:block-1)', richBlocks: blocks }], startIndex: 0, sourceUrl: 'https://chatgpt.com/c/rich', theme: 'light' });
        expect(snapshot.items[0]?.richBlocks).toEqual(blocks);
        expect(snapshot.items[0]?.richBlocks).not.toBe(blocks);
        expect(Object.isFrozen(snapshot.items[0]?.richBlocks?.[0]?.source)).toBe(true);
    });

    it('redacts page-owned image URLs from the serializable descriptor', async () => {
        const snapshot = await buildReaderSessionSnapshot({ items: [{ id: 'image', userPrompt: '', content: '![Image](aimd-rich:block-1)', richBlocks: [richSvgBlock({ kind: 'image', source: { kind: 'loaded-image', url: 'blob:https://chatgpt.com/private-resource' } })] }], startIndex: 0, sourceUrl: 'https://chatgpt.com/c/image', theme: 'light' });
        expect(JSON.stringify(snapshot)).not.toContain('blob:https://chatgpt.com');
        expect(snapshot.items[0]?.richBlocks?.[0]?.source).toMatchObject({ kind: 'loaded-image', url: 'aimd-source:live-image' });
    });

    it('refuses an oversized aggregate rich snapshot before runtime storage', async () => {
        const blocks = Array.from({ length: 4 }, (_, index) => richSvgBlock({ id: `block-${index}`, source: { kind: 'svg', svg: `<svg>${'x'.repeat(200_000)}</svg>` } }));
        await expect(buildReaderSessionSnapshot({ items: Array.from({ length: 3 }, (_, index) => ({ id: `item-${index}`, userPrompt: '', content: 'Diagram', richBlocks: blocks })), startIndex: 0, sourceUrl: 'https://chatgpt.com/c/budget', theme: 'light' })).rejects.toThrow('session budget');
    });

    it('resolves ReaderItem content into a serializable detached reader snapshot', async () => {
        const items: ReaderItem[] = [
            {
                id: 'reader-item-1',
                userPrompt: 'Prompt',
                content: () => 'Resolved markdown',
                sourceContent: () => 'Resolved [markdown](https://example.com)',
                meta: {
                    platformId: 'chatgpt',
                    position: 3,
                    messageId: 'message-3',
                    roundId: 'round-3',
                    userMessageId: 'user-3',
                    assistantMessageId: 'message-3',
                    branchKey: 'leaf-3',
                },
            },
        ];

        const snapshot = await buildReaderSessionSnapshot({
            items,
            startIndex: 0,
            sourceUrl: 'https://chatgpt.com/c/mock',
            theme: 'dark',
            annotationDocument: {
                platform: 'chatgpt',
                conversationId: 'conv-1',
                lastKnownUrl: 'https://chatgpt.com/c/conv-1',
            },
            now: 1234,
        });

        expect(snapshot).toEqual({
            items: [
                {
                    id: 'reader-item-1',
                    userPrompt: 'Prompt',
                    content: 'Resolved markdown',
                    sourceContent: 'Resolved [markdown](https://example.com)',
                    meta: {
                        platformId: 'chatgpt',
                        position: 3,
                        messageId: 'message-3',
                        roundId: 'round-3',
                        userMessageId: 'user-3',
                        assistantMessageId: 'message-3',
                        branchKey: 'leaf-3',
                    },
                },
            ],
            startIndex: 0,
            sourceUrl: 'https://chatgpt.com/c/mock',
            theme: 'dark',
            createdAt: 1234,
            updatedAt: 1234,
            annotationDocument: {
                platform: 'chatgpt',
                conversationId: 'conv-1',
                lastKnownUrl: 'https://chatgpt.com/c/conv-1',
            },
        });
    });
});
