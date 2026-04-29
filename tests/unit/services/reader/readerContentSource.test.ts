import { beforeEach, describe, expect, it, vi } from 'vitest';
import { collectReaderContent, readerItemsToChatTurns } from '@/services/reader/readerContentSource';
import type { ReaderItem } from '@/services/reader/types';
import { buildPdfPrintPlan } from '@/services/export/saveMessagesPdf';
import { buildPngExportPlans } from '@/services/export/saveMessagesPng';

vi.mock('@/services/reader/chatgptReaderItems', () => ({
    buildChatGPTReaderItems: vi.fn(() => ({
        items: [
            {
                id: 'chatgpt-a1',
                userPrompt: 'Payload prompt',
                content: '- payload bullet',
                meta: { platformId: 'chatgpt', messageId: 'a1', position: 1 },
            },
        ],
        startIndex: 0,
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
    });

    it('uses the DOM-discovered Reader source first when a message element is available', async () => {
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

        const result = await collectReaderContent(adapter, messageElement, {
            chatGptConversationEngine,
            pageUrl: 'https://chatgpt.com/c/1#hash',
        });

        expect(result.metadataSource).toBe('dom');
        expect(chatGptConversationEngine.getSnapshot).not.toHaveBeenCalled();
        expect(chatGptConversationEngine.forceRefreshCurrentConversation).not.toHaveBeenCalled();
        expect(collectReaderItems).toHaveBeenCalledTimes(1);
        expect(buildChatGPTReaderItems).not.toHaveBeenCalled();
        expect(result.items[0]?.content).toBe('- dom bullet');
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

    it('falls back to the existing DOM Reader collection when no snapshot is available', async () => {
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

        expect(result.metadataSource).toBe('dom');
        expect(chatGptConversationEngine.forceRefreshCurrentConversation).not.toHaveBeenCalled();
        expect(collectReaderItems).toHaveBeenCalledTimes(1);
        expect(result.items[0]?.content).toBe('- dom bullet');
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

    it('keeps Reader markdown structures intact for PDF and PNG export plans', async () => {
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
        const pngPlans = buildPngExportPlans(turns, [0], metadata, t);

        expect(pdfPlan?.html).toContain('<ul>');
        expect(pdfPlan?.html).toContain('<li>bullet');
        expect(pdfPlan?.html).toContain('<blockquote>');
        expect(pdfPlan?.html).toContain('class="tag"');
        expect(pngPlans?.plans[0]?.html).toContain('<ul>');
        expect(pngPlans?.plans[0]?.html).toContain('<li>nested</li>');
        expect(pngPlans?.plans[0]?.html).toContain('class="tag"');
    });
});
