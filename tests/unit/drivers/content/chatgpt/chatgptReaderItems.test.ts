import { describe, expect, it } from 'vitest';
import { buildChatGPTReaderItems } from '@/drivers/content/chatgpt/chatgptReaderItems';

describe('buildChatGPTReaderItems', () => {
    it('maps ChatGPT rounds to shared reader items and starts at the requested message', () => {
        const { items, startIndex } = buildChatGPTReaderItems({
            conversationId: 'conv-1',
            buildFingerprint: 'build-1',
            capturedAt: 1,
            source: 'runtime-bridge',
            rounds: [
                {
                    id: 'round-1',
                    position: 1,
                    userPrompt: 'Prompt 1',
                    assistantContent: 'Answer 1',
                    preview: 'Prompt 1',
                    messageId: 'a1',
                    userMessageId: 'u1',
                    assistantMessageId: 'a1',
                },
                {
                    id: 'round-2',
                    position: 2,
                    userPrompt: 'Prompt 2',
                    assistantContent: 'Answer 2',
                    preview: 'Prompt 2',
                    messageId: 'a2',
                    userMessageId: 'u2',
                    assistantMessageId: 'a2',
                },
            ],
        }, 'a1', 'https://chatgpt.com/c/abc#settings');

        expect(startIndex).toBe(0);
        expect(items).toEqual([
            expect.objectContaining({
                userPrompt: 'Prompt 1',
                content: 'Answer 1',
                meta: expect.objectContaining({
                    platformId: 'chatgpt',
                    messageId: 'a1',
                    position: 1,
                    url: 'https://chatgpt.com/c/abc',
                }),
            }),
            expect.objectContaining({
                userPrompt: 'Prompt 2',
                content: 'Answer 2',
                meta: expect.objectContaining({
                    messageId: 'a2',
                    position: 2,
                }),
            }),
        ]);
    });
});
