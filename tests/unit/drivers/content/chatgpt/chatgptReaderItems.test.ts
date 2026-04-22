import { describe, expect, it } from 'vitest';
import { buildChatGPTReaderItems } from '@/drivers/content/chatgpt/chatgptReaderItems';
import { buildChatGPTConversationTurns, resolveChatGPTConversationStartIndex } from '@/drivers/content/chatgpt/chatgptConversationSource';

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
        }, { messageId: 'a1' }, 'https://chatgpt.com/c/abc#settings');

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

    it('normalizes ChatGPT reader markdown without mutating round metadata', () => {
        const { items } = buildChatGPTReaderItems({
            conversationId: 'conv-1',
            buildFingerprint: 'build-1',
            capturedAt: 1,
            source: 'runtime-bridge',
            rounds: [
                {
                    id: 'round-1',
                    position: 1,
                    userPrompt: 'Prompt 1',
                    assistantContent: 'Inline: \\(x = y + z\\)\n\nBlock:\n\\[\na^2 + b^2 = c^2\n\\]',
                    preview: 'Prompt 1',
                    messageId: 'a1',
                    userMessageId: 'u1',
                    assistantMessageId: 'a1',
                },
            ],
        }, { messageId: 'a1' }, 'https://chatgpt.com/c/abc#settings');

        expect(items[0]).toEqual(expect.objectContaining({
            userPrompt: 'Prompt 1',
            content: 'Inline: $x = y + z$\n\nBlock:\n\n$$\na^2 + b^2 = c^2\n$$',
            meta: expect.objectContaining({
                position: 1,
                messageId: 'a1',
            }),
        }));
    });

    it('prefers position for the initial Reader item when DOM and payload message ids differ', () => {
        const snapshot = {
            conversationId: 'conv-1',
            buildFingerprint: 'build-1',
            capturedAt: 1,
            source: 'runtime-bridge' as const,
            rounds: [
                {
                    id: 'round-1',
                    position: 1,
                    userPrompt: 'Prompt 1',
                    assistantContent: 'Answer 1',
                    preview: 'Prompt 1',
                    messageId: 'payload-a1',
                    userMessageId: 'u1',
                    assistantMessageId: 'payload-a1',
                },
                {
                    id: 'round-2',
                    position: 2,
                    userPrompt: 'Prompt 2',
                    assistantContent: 'Answer 2',
                    preview: 'Prompt 2',
                    messageId: 'payload-a2',
                    userMessageId: 'u2',
                    assistantMessageId: 'payload-a2',
                },
            ],
        };

        expect(resolveChatGPTConversationStartIndex(snapshot, { position: 1, messageId: 'dom-wrapper-id' })).toBe(0);
        expect(buildChatGPTReaderItems(snapshot, { position: 1, messageId: 'dom-wrapper-id' }).startIndex).toBe(0);
    });

    it('builds shared ChatGPT turns for Reader and export from the same snapshot content', () => {
        const turns = buildChatGPTConversationTurns({
            conversationId: 'conv-1',
            buildFingerprint: 'build-1',
            capturedAt: 1,
            source: 'runtime-bridge',
            rounds: [
                {
                    id: 'round-1',
                    position: 1,
                    userPrompt: 'Prompt 1',
                    assistantContent: 'Inline: \\(x = y\\)',
                    preview: 'Prompt 1',
                    messageId: 'a1',
                    userMessageId: 'u1',
                    assistantMessageId: 'a1',
                },
            ],
        });

        expect(turns).toEqual([
            {
                user: 'Prompt 1',
                assistant: 'Inline: $x = y$',
                index: 0,
            },
        ]);
    });
});
