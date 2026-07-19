import { describe, expect, it } from 'vitest';
import { buildChatGPTReaderItems } from '@/services/reader/chatgptReaderItems';
import { buildChatGPTConversationTurns, resolveChatGPTConversationRound, resolveChatGPTConversationStartIndex } from '@/drivers/content/chatgpt/chatgptConversationSource';

describe('buildChatGPTReaderItems', () => {
    it('maps ChatGPT rounds to shared reader items and starts at the requested message', () => {
        const { items, startIndex } = buildChatGPTReaderItems({
            conversationId: 'conv-1',
            buildFingerprint: 'build-1',
            capturedAt: 1,
            source: 'runtime-bridge',
            origin: 'conversation-graph',
            coverage: 'complete',
            branchKey: 'branch-leaf-2',
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
                    roundId: 'round-1',
                    userMessageId: 'u1',
                    assistantMessageId: 'a1',
                    branchKey: 'branch-leaf-2',
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

    it('removes ChatGPT citation and link noise from payload-backed Reader content', () => {
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
                    assistantContent: 'Answer [Huang 2020](https://example.com) citeturn0search0\n\nFormula: \\(x = y\\)',
                    preview: 'Prompt 1',
                    messageId: 'a1',
                    userMessageId: 'u1',
                    assistantMessageId: 'a1',
                },
            ],
        }, { messageId: 'a1' });

        expect(items[0]?.content).toBe('Answer Huang 2020\n\nFormula: $x = y$');
    });

    it('keeps payload-backed inline double-dollar math while removing citation and link noise', () => {
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
                    assistantContent: 'Answer [paper](https://example.com) citeturn0search0 这里的 $$a_j$$ 就是矩阵 $$A$$。',
                    preview: 'Prompt 1',
                    messageId: 'a1',
                    userMessageId: 'u1',
                    assistantMessageId: 'a1',
                },
            ],
        }, { messageId: 'a1' });

        expect(items[0]?.content).toBe('Answer paper  这里的 $a_j$ 就是矩阵 $A$。');
    });

    it('unwraps payload-backed ChatGPT component directives before exposing Reader content', () => {
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
                    assistantContent: [
                        '建议填写：',
                        '',
                        ':::writing{variant="standard" id="28473"}',
                        'Yes. This manuscript was previously submitted to IEEE Internet of Things Journal.',
                        ':::',
                    ].join('\n'),
                    preview: 'Prompt 1',
                    messageId: 'a1',
                    userMessageId: 'u1',
                    assistantMessageId: 'a1',
                },
            ],
        }, { messageId: 'a1' });

        expect(items[0]?.content).toBe([
            '建议填写：',
            '',
            'Yes. This manuscript was previously submitted to IEEE Internet of Things Journal.',
        ].join('\n'));
    });

    it('preserves code block urls while removing citation noise from payload-backed Reader content', () => {
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
                    assistantContent: [
                        'Answer [paper](https://example.com/paper.pdf)',
                        '',
                        '```ts',
                        'const url = "https://example.com/api";',
                        'const link = "[docs](https://example.com/docs)";',
                        '```',
                    ].join('\n'),
                    preview: 'Prompt 1',
                    messageId: 'a1',
                    userMessageId: 'u1',
                    assistantMessageId: 'a1',
                },
            ],
        }, { messageId: 'a1' });

        expect(items[0]?.content).toBe([
            'Answer paper',
            '',
            '```ts',
            'const url = "https://example.com/api";',
            'const link = "[docs](https://example.com/docs)";',
            '```',
        ].join('\n'));
    });

    it('fails closed instead of treating DOM-local positions as payload positions when opening Reader', () => {
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
                {
                    id: 'round-3',
                    position: 50,
                    userPrompt: 'Prompt 50',
                    assistantContent: 'Answer 50',
                    preview: 'Prompt 50',
                    messageId: 'payload-a50',
                    userMessageId: 'u50',
                    assistantMessageId: 'payload-a50',
                },
            ],
        };

        expect(resolveChatGPTConversationStartIndex(snapshot, {
            position: 2,
            positionSource: 'dom',
            messageId: 'dom-wrapper-id',
        } as any)).toBe(-1);
        expect(buildChatGPTReaderItems(snapshot, {
            position: 2,
            positionSource: 'dom',
            messageId: 'dom-wrapper-id',
        } as any).startIndex).toBe(-1);
    });

    it('prefers message id over prompt when resolving the initial Reader item', () => {
        const snapshot = {
            conversationId: 'conv-1',
            buildFingerprint: 'build-1',
            capturedAt: 1,
            source: 'runtime-bridge' as const,
            rounds: [
                {
                    id: 'round-1',
                    position: 1,
                    userPrompt: 'Duplicate prompt',
                    assistantContent: 'Answer 1',
                    preview: 'Duplicate prompt',
                    messageId: 'a1',
                    userMessageId: 'u1',
                    assistantMessageId: 'a1',
                },
                {
                    id: 'round-2',
                    position: 2,
                    userPrompt: 'Duplicate prompt',
                    assistantContent: 'Answer 2',
                    preview: 'Duplicate prompt',
                    messageId: 'a2',
                    userMessageId: 'u2',
                    assistantMessageId: 'a2',
                },
            ],
        };

        expect(resolveChatGPTConversationStartIndex(snapshot, { messageId: 'a2' })).toBe(1);
        expect(resolveChatGPTConversationRound(snapshot, { messageId: 'a2' })?.position).toBe(2);
    });

    it('never treats prompt text as canonical round identity', () => {
        const snapshot = {
            conversationId: 'conv-1',
            buildFingerprint: 'build-1',
            capturedAt: 1,
            source: 'runtime-bridge' as const,
            rounds: [
                {
                    id: 'round-1',
                    position: 1,
                    userPrompt: 'Duplicate prompt',
                    assistantContent: 'Answer 1',
                    preview: 'Duplicate prompt',
                    messageId: 'a1',
                    userMessageId: 'u1',
                    assistantMessageId: 'a1',
                },
                {
                    id: 'round-2',
                    position: 2,
                    userPrompt: 'Duplicate prompt',
                    assistantContent: 'Answer 2',
                    preview: 'Duplicate prompt',
                    messageId: 'a2',
                    userMessageId: 'u2',
                    assistantMessageId: 'a2',
                },
            ],
        };

        const unresolved = { messageId: 'missing-id' };
        expect(resolveChatGPTConversationStartIndex(snapshot, unresolved)).toBe(-1);
        expect(resolveChatGPTConversationRound(snapshot, unresolved)).toBeNull();
    });

    it('uses payload positions only when the caller marks the source as snapshot', () => {
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
        };

        expect(resolveChatGPTConversationStartIndex(snapshot, { position: 1 })).toBe(-1);
        expect(resolveChatGPTConversationStartIndex(snapshot, { position: 1, positionSource: 'snapshot' })).toBe(0);
    });

    it('keeps typed ChatGPT identities in their own namespaces and requires a unique match', () => {
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
                    messageId: 'shared-assistant',
                    userMessageId: 'u1',
                    assistantMessageId: 'shared-assistant',
                },
                {
                    id: 'round-2',
                    position: 2,
                    userPrompt: 'Prompt 2',
                    assistantContent: 'Answer 2',
                    preview: 'Prompt 2',
                    messageId: 'shared-assistant',
                    userMessageId: 'round-1',
                    assistantMessageId: 'shared-assistant',
                },
            ],
        };

        expect(resolveChatGPTConversationRound(snapshot, { roundId: 'round-1' })?.position).toBe(1);
        expect(resolveChatGPTConversationRound(snapshot, { userMessageId: 'round-1' })?.position).toBe(2);
        expect(resolveChatGPTConversationRound(snapshot, { messageId: 'shared-assistant' })).toBeNull();
        expect(resolveChatGPTConversationStartIndex(snapshot, { messageId: 'shared-assistant' })).toBe(-1);
    });

    it('defaults a full Reader with no clicked target to the canonical tail', () => {
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
        };

        expect(resolveChatGPTConversationStartIndex(snapshot, null)).toBe(1);
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
