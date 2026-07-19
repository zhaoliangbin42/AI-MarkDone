import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
    collectFreshCurrentReaderItem,
    collectFreshReaderContent,
    collectReaderContent,
    readerItemsToChatTurns,
} from '@/services/reader/readerContentSource';
import type { ReaderItem } from '@/services/reader/types';
import { buildPdfPrintPlan } from '@/services/export/saveMessagesPdf';
import { buildMessageExportDocument } from '@/services/export/messageExportDocument';
import { renderMessageCardProfile } from '@/services/export/messageCardProfile';

const setChatGptIndexSnapshot = vi.fn();
const resolveChatGptRoundForElement = vi.fn();

vi.mock('@/drivers/content/chatgpt/ChatGPTConversationIndex', () => ({
    getChatGPTConversationIndex: vi.fn(() => ({
        setSnapshot: setChatGptIndexSnapshot,
        resolveRoundForElement: resolveChatGptRoundForElement,
    })),
}));

vi.mock('@/services/reader/chatgptReaderItems', () => ({
    buildChatGPTReaderItems: vi.fn((snapshot: any, startTarget: any) => ({
        items: snapshot.rounds.map((round: any) => ({
            id: `chatgpt-${round.messageId}`,
            userPrompt: round.userPrompt,
            content: round.assistantContent,
            meta: { platformId: 'chatgpt', messageId: round.messageId, position: round.position },
        })),
        startIndex: startTarget?.messageId
            ? Math.max(0, snapshot.rounds.findIndex((round: any) => round.messageId === startTarget.messageId))
            : 0,
    })),
}));

vi.mock('@/services/reader/collectReaderItems', () => ({
    collectReaderItems: vi.fn(() => ({
        items: [
            {
                id: 'dom-a1',
                userPrompt: 'DOM prompt',
                content: '- dom bullet',
                meta: { platformId: 'chatgpt', messageId: 'dom-a1', position: 1 },
            },
        ],
        startIndex: 0,
    })),
    stripHash: (url: string) => url.split('#')[0],
}));

import { buildChatGPTReaderItems } from '@/services/reader/chatgptReaderItems';
import { collectReaderItems } from '@/services/reader/collectReaderItems';

describe('readerContentSource', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        resolveChatGptRoundForElement.mockReturnValue(null);
    });

    it('collects fresh ChatGPT Reader items from the forced snapshot', async () => {
        const adapter: any = {
            getPlatformId: () => 'chatgpt',
            getLastMessageElement: () => null,
            getMessageId: () => null,
            extractUserPrompt: () => null,
        };
        const chatGptConversationEngine: any = {
            getSnapshot: vi.fn(async () => ({
                conversationId: 'conv-1',
                rounds: [
                    { id: 'old-1', position: 1, userPrompt: 'Old prompt', assistantContent: 'Old answer', messageId: 'old-a1' },
                ],
            })),
            forceRefreshCurrentConversation: vi.fn(async () => ({
                conversationId: 'conv-1',
                rounds: [
                    { id: 'fresh-1', position: 1, userPrompt: 'Fresh prompt 1', assistantContent: 'Fresh answer 1', messageId: 'fresh-a1' },
                    { id: 'fresh-2', position: 2, userPrompt: 'Fresh prompt 2', assistantContent: 'Fresh answer 2', messageId: 'fresh-a2' },
                ],
            })),
        };

        const result = await collectFreshReaderContent(adapter, null, {
            chatGptConversationEngine,
            pageUrl: 'https://chatgpt.com/c/1',
        });

        expect(result.metadataSource).toBe('chatgpt-snapshot');
        expect(chatGptConversationEngine.forceRefreshCurrentConversation).toHaveBeenCalledTimes(1);
        expect(chatGptConversationEngine.getSnapshot).not.toHaveBeenCalled();
        expect(result.items).toHaveLength(2);
        expect(result.items[1]?.content).toBe('Fresh answer 2');
        expect(collectReaderItems).not.toHaveBeenCalled();
    });

    it('collects the current fresh ChatGPT Reader item from the same ReaderItem snapshot', async () => {
        const messageElement = document.createElement('article');
        const adapter: any = {
            getPlatformId: () => 'chatgpt',
            getMessageId: () => 'fresh-a2',
            extractUserPrompt: () => 'Fresh prompt 2',
        };
        const chatGptConversationEngine: any = {
            getSnapshot: vi.fn(),
            forceRefreshCurrentConversation: vi.fn(async () => ({
                conversationId: 'conv-1',
                rounds: [
                    { id: 'fresh-1', position: 1, userPrompt: 'Fresh prompt 1', assistantContent: 'Fresh answer 1', messageId: 'fresh-a1' },
                    { id: 'fresh-2', position: 2, userPrompt: 'Fresh prompt 2', assistantContent: 'Fresh answer 2', messageId: 'fresh-a2' },
                ],
            })),
        };
        resolveChatGptRoundForElement.mockReturnValueOnce({
            position: 2,
            identity: {
                roundId: 'fresh-2',
                userMessageId: null,
                assistantMessageId: 'fresh-a2',
            },
            round: {
                id: 'fresh-2',
                position: 2,
                userPrompt: 'Fresh prompt 2',
                assistantContent: 'Fresh answer 2',
                messageId: 'fresh-a2',
                userMessageId: null,
                assistantMessageId: 'fresh-a2',
            },
        });

        const item = await collectFreshCurrentReaderItem(adapter, messageElement, {
            chatGptConversationEngine,
            pageUrl: 'https://chatgpt.com/c/1',
        });

        expect(chatGptConversationEngine.forceRefreshCurrentConversation).toHaveBeenCalledTimes(1);
        expect(buildChatGPTReaderItems).toHaveBeenCalledWith(
            expect.objectContaining({ conversationId: 'conv-1' }),
            {
                position: 2,
                positionSource: 'snapshot',
                messageId: 'fresh-a2',
                roundId: 'fresh-2',
                userMessageId: null,
                assistantMessageId: 'fresh-a2',
            },
            'https://chatgpt.com/c/1',
        );
        expect(item?.content).toBe('Fresh answer 2');
    });

    it('fails closed when the mounted ChatGPT message identity is absent from the canonical snapshot', async () => {
        const messageElement = document.createElement('article');
        const adapter: any = {
            getPlatformId: () => 'chatgpt',
            getMessageId: () => 'missing-assistant-id',
            extractUserPrompt: () => 'Duplicate prompt',
        };
        const chatGptConversationEngine: any = {
            forceRefreshCurrentConversation: vi.fn(async () => ({
                conversationId: 'conv-1',
                rounds: [
                    { id: 'round-1', position: 1, userPrompt: 'Duplicate prompt', assistantContent: 'Answer 1', messageId: 'a1' },
                    { id: 'round-2', position: 2, userPrompt: 'Duplicate prompt', assistantContent: 'Answer 2', messageId: 'a2' },
                ],
            })),
        };

        await expect(collectFreshCurrentReaderItem(adapter, messageElement, {
            chatGptConversationEngine,
        })).resolves.toBeNull();
    });

    it('does not fall back to DOM Reader collection for the fresh ChatGPT body source', async () => {
        const messageElement = document.createElement('article');
        const adapter: any = {
            getPlatformId: () => 'chatgpt',
            getMessageId: () => 'dom-a1',
            extractUserPrompt: () => 'DOM prompt',
        };
        const chatGptConversationEngine: any = {
            getSnapshot: vi.fn(async () => ({
                conversationId: 'conv-1',
                rounds: [
                    { id: 'old-1', position: 1, userPrompt: 'Old prompt', assistantContent: 'Old answer', messageId: 'old-a1' },
                ],
            })),
            forceRefreshCurrentConversation: vi.fn(async () => null),
        };

        const result = await collectFreshReaderContent(adapter, messageElement, { chatGptConversationEngine });

        expect(result).toEqual({ items: [], startIndex: 0, metadataSource: 'chatgpt-snapshot' });
        expect(chatGptConversationEngine.forceRefreshCurrentConversation).toHaveBeenCalledTimes(1);
        expect(chatGptConversationEngine.getSnapshot).not.toHaveBeenCalled();
        expect(collectReaderItems).not.toHaveBeenCalled();
    });

    it('prefers ChatGPT structured snapshot content even when a message element is available', async () => {
        const messageElement = document.createElement('article');
        const adapter: any = {
            getPlatformId: () => 'chatgpt',
            getMessageId: () => 'a1',
            extractUserPrompt: () => 'Payload prompt',
        };
        const chatGptConversationEngine: any = {
            getSnapshot: vi.fn(async () => ({
                conversationId: 'conv-1',
                buildFingerprint: 'build-1',
                capturedAt: 1,
                source: 'runtime-bridge',
                rounds: [
                    {
                        id: 'round-1',
                        position: 1,
                        userPrompt: 'Payload prompt',
                        assistantContent: '- payload bullet',
                        preview: 'Payload prompt',
                        messageId: 'a1',
                    },
                ],
            })),
            forceRefreshCurrentConversation: vi.fn(),
        };
        resolveChatGptRoundForElement.mockReturnValueOnce({
            position: 1,
            identity: { roundId: 'round-1', userMessageId: null, assistantMessageId: 'a1' },
            round: {
                id: 'round-1',
                position: 1,
                userPrompt: 'Payload prompt',
                assistantContent: '- payload bullet',
                messageId: 'a1',
                userMessageId: null,
                assistantMessageId: 'a1',
            },
        });

        const result = await collectReaderContent(adapter, messageElement, {
            chatGptConversationEngine,
            pageUrl: 'https://chatgpt.com/c/1#hash',
        });

        expect(result.metadataSource).toBe('chatgpt-snapshot');
        expect(chatGptConversationEngine.getSnapshot).toHaveBeenCalledTimes(1);
        expect(chatGptConversationEngine.forceRefreshCurrentConversation).not.toHaveBeenCalled();
        expect(collectReaderItems).not.toHaveBeenCalled();
        expect(buildChatGPTReaderItems).toHaveBeenCalledTimes(1);
        expect(buildChatGPTReaderItems).toHaveBeenCalledWith(
            expect.objectContaining({ conversationId: 'conv-1' }),
            {
                position: 1,
                positionSource: 'snapshot',
                messageId: 'a1',
                roundId: 'round-1',
                userMessageId: null,
                assistantMessageId: 'a1',
            },
            'https://chatgpt.com/c/1#hash',
        );
        expect(result.items[0]?.content).toBe('- payload bullet');
    });

    it('uses the ChatGPT snapshot path without forcing a refresh when DOM Reader collection is unavailable', async () => {
        const adapter: any = {
            getPlatformId: () => 'chatgpt',
            getLastMessageElement: () => null,
            getMessageId: () => 'a1',
            extractUserPrompt: () => 'Payload prompt',
        };
        const chatGptConversationEngine: any = {
            getSnapshot: vi.fn(async () => ({
                conversationId: 'conv-1',
                buildFingerprint: 'build-1',
                capturedAt: 1,
                source: 'runtime-bridge',
                rounds: [
                    {
                        id: 'round-1',
                        position: 1,
                        userPrompt: 'Payload prompt',
                        assistantContent: '- payload bullet',
                        preview: 'Payload prompt',
                        messageId: 'a1',
                    },
                ],
            })),
            forceRefreshCurrentConversation: vi.fn(),
        };

        const result = await collectReaderContent(adapter, null, {
            chatGptConversationEngine,
            pageUrl: 'https://chatgpt.com/c/1#hash',
        });

        expect(result.metadataSource).toBe('chatgpt-snapshot');
        expect(chatGptConversationEngine.getSnapshot).toHaveBeenCalledTimes(1);
        expect(chatGptConversationEngine.forceRefreshCurrentConversation).not.toHaveBeenCalled();
        expect(buildChatGPTReaderItems).toHaveBeenCalledTimes(1);
        expect(collectReaderItems).not.toHaveBeenCalled();
        expect(result.items[0]?.content).toBe('- payload bullet');
    });

    it('fails closed instead of creating a third ChatGPT DOM body source when no snapshot is available', async () => {
        const messageElement = document.createElement('article');
        const adapter: any = {
            getPlatformId: () => 'chatgpt',
            getMessageId: () => 'dom-a1',
            extractUserPrompt: () => 'DOM prompt',
        };
        const chatGptConversationEngine: any = {
            getSnapshot: vi.fn(async () => null),
            forceRefreshCurrentConversation: vi.fn(),
        };

        const result = await collectReaderContent(adapter, messageElement, { chatGptConversationEngine });

        expect(result).toEqual({ items: [], startIndex: 0, metadataSource: 'chatgpt-snapshot' });
        expect(chatGptConversationEngine.forceRefreshCurrentConversation).not.toHaveBeenCalled();
        expect(collectReaderItems).not.toHaveBeenCalled();
    });

    it('maps a virtualized mounted element to its canonical round instead of using an adapter-local id', async () => {
        const messageElement = document.createElement('article');
        const adapter: any = {
            getPlatformId: () => 'chatgpt',
            getMessageId: vi.fn(() => 'chatgpt-1'),
        };
        const snapshot = {
            conversationId: 'conv-1',
            rounds: [
                { id: 'round-1', position: 1, userPrompt: 'Prompt 1', assistantContent: 'Answer 1', messageId: 'a1' },
                { id: 'round-50', position: 50, userPrompt: 'Prompt 50', assistantContent: 'Answer 50', messageId: 'a50' },
            ],
        };
        const chatGptConversationEngine: any = {
            getSnapshot: vi.fn(async () => snapshot),
        };
        resolveChatGptRoundForElement.mockReturnValueOnce({
            position: 50,
            identity: { roundId: 'round-50', userMessageId: 'u50', assistantMessageId: 'a50' },
            round: {
                ...snapshot.rounds[1],
                userMessageId: 'u50',
                assistantMessageId: 'a50',
            },
        });

        const result = await collectReaderContent(adapter, messageElement, { chatGptConversationEngine });

        expect(adapter.getMessageId).not.toHaveBeenCalled();
        expect(setChatGptIndexSnapshot).toHaveBeenCalledWith(snapshot);
        expect(buildChatGPTReaderItems).toHaveBeenCalledWith(
            snapshot,
            {
                position: 50,
                positionSource: 'snapshot',
                messageId: 'a50',
                roundId: 'round-50',
                userMessageId: 'u50',
                assistantMessageId: 'a50',
            },
            expect.any(String),
        );
        expect(result.startIndex).toBe(1);
    });

    it('fails closed when an explicit ChatGPT Reader element cannot map to one unique canonical round', async () => {
        const messageElement = document.createElement('article');
        const adapter: any = {
            getPlatformId: () => 'chatgpt',
            getMessageId: vi.fn(() => 'a2'),
        };
        const chatGptConversationEngine: any = {
            getSnapshot: vi.fn(async () => ({
                conversationId: 'conv-1',
                rounds: [
                    { id: 'round-1', position: 1, userPrompt: 'Prompt 1', assistantContent: 'Answer 1', messageId: 'a1' },
                    { id: 'round-2', position: 2, userPrompt: 'Prompt 2', assistantContent: 'Answer 2', messageId: 'a2' },
                ],
            })),
        };
        resolveChatGptRoundForElement.mockReturnValueOnce(null);

        const result = await collectReaderContent(adapter, messageElement, { chatGptConversationEngine });

        expect(result).toEqual({ items: [], startIndex: 0, metadataSource: 'chatgpt-snapshot' });
        expect(adapter.getMessageId).not.toHaveBeenCalled();
        expect(buildChatGPTReaderItems).not.toHaveBeenCalled();
    });

    it('converts Reader items to export turns after resolving lazy content', async () => {
        const items: ReaderItem[] = [
            {
                id: 'r1',
                userPrompt: 'Prompt 1',
                content: async () => '- bullet\n  - nested\n\n$$\nE=mc^2 \\tag{1}\n$$',
            },
            {
                id: 'r2',
                userPrompt: 'Prompt 2',
                content: () => 'plain',
            },
        ];

        await expect(readerItemsToChatTurns(items)).resolves.toEqual([
            {
                user: 'Prompt 1',
                assistant: '- bullet\n  - nested\n\n$$\nE=mc^2 \\tag{1}\n$$',
                index: 0,
            },
            {
                user: 'Prompt 2',
                assistant: 'plain',
                index: 1,
            },
        ]);
    });

    it('keeps Reader markdown structures intact for PDF and the shared PNG profile', async () => {
        const turns = await readerItemsToChatTurns([
            {
                id: 'r1',
                userPrompt: 'Prompt 1',
                content: [
                    '# Heading',
                    '',
                    '- bullet',
                    '  - nested',
                    '',
                    '> quoted',
                    '',
                    '$$',
                    'E=mc^2 \\tag{1}',
                    '$$',
                ].join('\n'),
            },
        ]);
        const metadata = {
            url: 'https://chatgpt.com/c/1',
            exportedAt: new Date('2026-03-01T00:00:00.000Z').toISOString(),
            title: 'T',
            count: 1,
            platform: 'ChatGPT',
        };
        const t = (key: string, args?: unknown) => args == null ? key : `${key}:${String(args)}`;

        const pdfPlan = buildPdfPrintPlan(turns, [0], metadata, t);
        const document = buildMessageExportDocument(turns, [0], {
            title: metadata.title,
            labels: { user: t('pdfUserLabel'), assistant: t('pdfAssistantLabel') },
            formatHeading: (ordinal) => t('pdfMessagePrefix', `${ordinal}`),
        });
        const pngProfile = renderMessageCardProfile(document!, { widthCssPx: 800 });

        expect(pdfPlan?.html).toContain('<ul>');
        expect(pdfPlan?.html).toContain('<li>bullet');
        expect(pdfPlan?.html).toContain('<blockquote>');
        expect(pdfPlan?.html).toContain('class="tag"');
        expect(pngProfile.html).toContain('<ul>');
        expect(pngProfile.html).toContain('<li>nested</li>');
        expect(pngProfile.html).toContain('class="tag"');
    });
});
