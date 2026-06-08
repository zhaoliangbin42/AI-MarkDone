import { describe, expect, it } from 'vitest';
import { buildReaderSessionSnapshot } from '@/services/reader/readerSessionSnapshot';
import type { ReaderItem } from '@/services/reader/types';

describe('buildReaderSessionSnapshot', () => {
    it('resolves ReaderItem content into a serializable detached reader snapshot', async () => {
        const items: ReaderItem[] = [
            {
                id: 'reader-item-1',
                userPrompt: 'Prompt',
                content: () => 'Resolved markdown',
                meta: { platformId: 'chatgpt', position: 3, messageId: 'message-3' },
            },
        ];

        const snapshot = await buildReaderSessionSnapshot({
            items,
            startIndex: 0,
            sourceUrl: 'https://chatgpt.com/c/mock',
            theme: 'dark',
            now: 1234,
        });

        expect(snapshot).toEqual({
            items: [
                {
                    id: 'reader-item-1',
                    userPrompt: 'Prompt',
                    content: 'Resolved markdown',
                    meta: { platformId: 'chatgpt', position: 3, messageId: 'message-3' },
                },
            ],
            startIndex: 0,
            sourceUrl: 'https://chatgpt.com/c/mock',
            theme: 'dark',
            createdAt: 1234,
            updatedAt: 1234,
        });
    });
});
