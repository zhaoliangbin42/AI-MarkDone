import { describe, expect, it } from 'vitest';
import {
    buildChatGPTReaderContent,
    buildChatGPTReaderItems as buildChatGPTReaderItemsV1,
} from '@/services/reader/chatgptReaderItems';
import { createConversationPageDocumentKeyV1 } from '@/contracts/conversationContent';
import {
    toConversationSnapshotV1,
    type ConversationSnapshotFixture,
} from '../../../../helpers/chatgptContentFixtures';

function buildChatGPTReaderItems(
    snapshot: ConversationSnapshotFixture,
    target?: Parameters<typeof buildChatGPTReaderItemsV1>[1],
    pageUrl?: string,
): ReturnType<typeof buildChatGPTReaderItemsV1> {
    return buildChatGPTReaderItemsV1(
        toConversationSnapshotV1(snapshot),
        target,
        pageUrl,
    );
}

describe('buildChatGPTReaderItems', () => {
    it('keeps page-scoped content readable while marking bookmarks unavailable', () => {
        const documentKey = createConversationPageDocumentKeyV1('chatgpt', 'reader-page');
        const result = buildChatGPTReaderContent({
            schemaVersion: 1,
            document: {
                key: documentKey,
                platformId: 'chatgpt',
                identityKind: 'page',
                conversationId: null,
                canonicalUrl: 'https://chatgpt.com/',
            },
            projectionId: 'projection-page',
            contentToken: 'content-page',
            coverage: 'complete',
            turns: [{
                key: 'round-1:assistant-1',
                ordinal: 1,
                identity: {
                    turnId: 'round-1',
                    userMessageId: 'user-1',
                    assistantMessageId: 'assistant-1',
                },
                userText: 'Page question',
                assistantMarkdown: 'Page answer',
            }],
        }, 'https://chatgpt.com/');

        expect(result.items[0]).toMatchObject({
            content: 'Page answer',
            meta: { bookmarkable: false },
        });
        expect(result.annotationDocument.conversationId).toBe(documentKey);
    });

    it('maps ChatGPT rounds to shared reader items and starts at the requested message', () => {
        const { items, startIndex, annotationDocument } = buildChatGPTReaderItems({
            conversationId: 'conv-1',
            revision: 1,
            proof: 'observed-graph' as const,
            capturedAt: 1,
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
        expect(annotationDocument).toEqual({
            platform: 'chatgpt',
            conversationId: 'conv-1',
            title: null,
            lastKnownUrl: 'https://chatgpt.com/c/abc',
        });
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
                    branchKey: 'a2',
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
            revision: 1,
            proof: 'observed-graph' as const,
            capturedAt: 1,
            branchKey: 'branch-1',
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
            revision: 1,
            proof: 'observed-graph' as const,
            capturedAt: 1,
            branchKey: 'branch-1',
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
            revision: 1,
            proof: 'observed-graph' as const,
            capturedAt: 1,
            branchKey: 'branch-1',
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
            revision: 1,
            proof: 'observed-graph' as const,
            capturedAt: 1,
            branchKey: 'branch-1',
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
            revision: 1,
            proof: 'observed-graph' as const,
            capturedAt: 1,
            branchKey: 'branch-1',
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
            revision: 1,
            proof: 'observed-graph' as const,
            capturedAt: 1,
            branchKey: 'branch-1',
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

        expect(buildChatGPTReaderItems(snapshot, {
            position: 2,
            positionSource: 'dom',
            messageId: 'dom-wrapper-id',
        } as any).startIndex).toBe(-1);
    });

    it('prefers message id over prompt when resolving the initial Reader item', () => {
        const snapshot = {
            conversationId: 'conv-1',
            revision: 1,
            proof: 'observed-graph' as const,
            capturedAt: 1,
            branchKey: 'branch-1',
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

        const result = buildChatGPTReaderItems(snapshot, { messageId: 'a2' });
        expect(result.startIndex).toBe(1);
        expect(result.items[result.startIndex]?.meta?.position).toBe(2);
    });

    it('never treats prompt text as canonical round identity', () => {
        const snapshot = {
            conversationId: 'conv-1',
            revision: 1,
            proof: 'observed-graph' as const,
            capturedAt: 1,
            branchKey: 'branch-1',
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
        expect(buildChatGPTReaderItems(snapshot, unresolved).startIndex).toBe(-1);
    });

    it('uses payload positions only when the caller marks the source as snapshot', () => {
        const snapshot = {
            conversationId: 'conv-1',
            revision: 1,
            proof: 'observed-graph' as const,
            capturedAt: 1,
            branchKey: 'branch-1',
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

        expect(buildChatGPTReaderItems(snapshot, { position: 1 }).startIndex).toBe(-1);
        expect(buildChatGPTReaderItems(snapshot, { position: 1, positionSource: 'snapshot' }).startIndex).toBe(0);
    });

    it('keeps typed ChatGPT identities in their own namespaces and requires a unique match', () => {
        const snapshot = {
            conversationId: 'conv-1',
            revision: 1,
            proof: 'observed-graph' as const,
            capturedAt: 1,
            branchKey: 'branch-1',
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

        const roundIdResult = buildChatGPTReaderItems(snapshot, { roundId: 'round-1' });
        const userIdResult = buildChatGPTReaderItems(snapshot, { userMessageId: 'round-1' });
        expect(roundIdResult.items[roundIdResult.startIndex]?.meta?.position).toBe(1);
        expect(userIdResult.items[userIdResult.startIndex]?.meta?.position).toBe(2);
        expect(buildChatGPTReaderItems(snapshot, { messageId: 'shared-assistant' }).startIndex).toBe(-1);
    });

    it('defaults a full Reader with no clicked target to the canonical tail', () => {
        const snapshot = {
            conversationId: 'conv-1',
            revision: 1,
            proof: 'observed-graph' as const,
            capturedAt: 1,
            branchKey: 'branch-1',
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

        expect(buildChatGPTReaderItems(snapshot, null).startIndex).toBe(1);
    });
});
