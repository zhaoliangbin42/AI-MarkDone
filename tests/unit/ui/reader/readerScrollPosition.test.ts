import { describe, expect, it } from 'vitest';

import {
    getReaderScrollPositionKey,
    readReaderScrollProgress,
    restoreReaderScrollProgress,
} from '@/ui/content/reader/readerScrollPosition';

function container(scrollTop: number, scrollHeight: number, clientHeight: number) {
    return { scrollTop, scrollHeight, clientHeight };
}

describe('reader scroll position', () => {
    it('uses stable item identity and isolates Reader profiles', () => {
        const item = {
            id: 'fallback-id',
            userPrompt: 'Question',
            content: 'Answer',
            meta: {
                platformId: 'chatgpt',
                assistantMessageId: 'assistant-1',
                position: 4,
            },
        };

        expect(getReaderScrollPositionKey(item, 'conversation-reader')).toBe('conversation-reader:chatgpt:assistant-1');
        expect(getReaderScrollPositionKey(item, 'bookmark-preview')).toBe('bookmark-preview:chatgpt:assistant-1');
        expect(getReaderScrollPositionKey({ ...item, meta: undefined }, 'conversation-reader')).toBe('conversation-reader:unknown-platform:fallback-id');
    });

    it('reads a clamped normalized progress and treats a non-scrollable body as the top', () => {
        expect(readReaderScrollProgress(container(750, 2000, 500))).toBe(0.5);
        expect(readReaderScrollProgress(container(-1, 2000, 500))).toBe(0);
        expect(readReaderScrollProgress(container(2000, 2000, 500))).toBe(1);
        expect(readReaderScrollProgress(container(10, 500, 500))).toBe(0);
    });

    it('restores progress against the current body height and reports unsettled layout', () => {
        const body = container(0, 1000, 500);
        expect(restoreReaderScrollProgress(body, 0.5)).toBe(true);
        expect(body.scrollTop).toBe(250);

        expect(restoreReaderScrollProgress(body, 2)).toBe(true);
        expect(body.scrollTop).toBe(500);

        const unsettledBody = container(40, 0, 500);
        expect(restoreReaderScrollProgress(unsettledBody, 0.5)).toBe(false);
        expect(unsettledBody.scrollTop).toBe(0);
    });
});
