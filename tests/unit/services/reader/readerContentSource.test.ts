import { describe, expect, it, vi } from 'vitest';
import {
    collectFreshCurrentReaderItem,
    collectFreshReaderContent,
    isReaderContentSourceRevisionCurrent,
    readCurrentReaderContent,
    readCurrentReaderContentSourceRevision,
    readerItemsToChatTurns,
} from '@/services/reader/readerContentSource';
import type { ReaderItem } from '@/services/reader/types';
import { buildPdfPrintPlan } from '@/services/export/saveMessagesPdf';
import { buildMessageExportDocument } from '@/services/export/messageExportDocument';
import { renderMessageCardProfile } from '@/services/export/messageCardProfile';
import {
    createConversationContentSource,
    toConversationSnapshotV1,
} from '../../../helpers/chatgptContentFixtures';

function chatgptAdapter(overrides: Record<string, unknown> = {}): any {
    return {
        getPlatformId: () => 'chatgpt',
        ...overrides,
    };
}

function buildSource(roundCount = 2) {
    return createConversationContentSource({
        conversationId: 'conv-1',
        revision: 1,
        rounds: Array.from({ length: roundCount }, (_, index) => ({
            id: `round-${index + 1}`,
            position: index + 1,
            userPrompt: `Prompt ${index + 1}`,
            assistantContent: `Answer ${index + 1}`,
            messageId: `assistant-${index + 1}`,
            assistantMessageId: `assistant-${index + 1}`,
            userMessageId: `user-${index + 1}`,
        })),
    });
}

describe('readerContentSource', () => {
    it('projects the verified V1 snapshot for the Reader and preserves typed identity', () => {
        const source = buildSource(2);
        const result = readCurrentReaderContent(chatgptAdapter(), null, {
            conversationContentSource: source,
            pageUrl: 'https://chatgpt.com/c/conv-1#reader',
        });

        expect(result).toMatchObject({
            metadataSource: 'chatgpt-content-v1',
            status: 'ready',
            coverage: 'complete',
            startIndex: 1,
            annotationDocument: {
                platform: 'chatgpt',
                conversationId: 'conv-1',
                lastKnownUrl: 'https://chatgpt.com/c/conv-1',
            },
        });
        expect(result.items.map((item) => item.meta?.assistantMessageId)).toEqual([
            'assistant-1',
            'assistant-2',
        ]);
        expect(result.sourceRevision?.contentToken).toBe('1');
    });

    it('resolves an explicit Reader start through materialization identity', () => {
        const source = buildSource(2);
        const messageElement = document.createElement('article');
        const materialization = {
            resolveElement: vi.fn(() => ({
                documentKey: toConversationSnapshotV1({
                    conversationId: 'conv-1',
                    rounds: [],
                }).document.key,
                turnId: 'round-1',
                assistantMessageId: 'assistant-1',
                userMessageId: 'user-1',
            })),
        };

        const result = readCurrentReaderContent(chatgptAdapter(), messageElement, {
            conversationContentSource: source,
            conversationMaterialization: materialization as any,
            pageUrl: 'https://chatgpt.com/c/conv-1',
        });

        expect(result.startIndex).toBe(0);
        expect(materialization.resolveElement).toHaveBeenCalledWith(messageElement);
    });

    it('reads the published snapshot directly for ordinary Reader actions', async () => {
        const base = buildSource(2);
        const refresh = vi.fn(async () => base.read());
        const source = { ...base, refresh };
        const result = await collectFreshReaderContent(chatgptAdapter(), null, {
            conversationContentSource: source,
            pageUrl: 'https://chatgpt.com/c/conv-1',
        });

        expect(refresh).not.toHaveBeenCalled();
        expect(result.status).toBe('ready');
        expect(result.items).toHaveLength(2);
    });

    it('reuses the same snapshot projection without re-normalizing or rebuilding it', async () => {
        const source = buildSource(2);
        const first = await collectFreshReaderContent(chatgptAdapter(), null, {
            conversationContentSource: source,
            pageUrl: 'https://chatgpt.com/c/conv-1#reader',
        });
        const second = await collectFreshReaderContent(chatgptAdapter(), null, {
            conversationContentSource: source,
            pageUrl: 'https://chatgpt.com/c/conv-1#reader',
        });

        expect(second.items).toEqual(first.items);
        expect(second.items).not.toBe(first.items);
        expect(second.items[0]).not.toBe(first.items[0]);
        expect(second.items[0]?.content).toBe('Answer 1');
    });

    it('returns an explicit unavailable result instead of falling back to DOM content', async () => {
        const source = createConversationContentSource({
            kind: 'unavailable',
            document: null,
            snapshot: null,
            reason: 'source-unavailable',
            retryable: true,
        });
        const adapter = chatgptAdapter({
            getLastMessageElement: () => document.createElement('article'),
        });

        const current = readCurrentReaderContent(adapter, null, {
            conversationContentSource: source,
        });
        const fresh = await collectFreshReaderContent(adapter, null, {
            conversationContentSource: source,
        });

        expect(current).toMatchObject({
            items: [],
            metadataSource: 'chatgpt-content-v1',
            status: 'unavailable',
        });
        expect(fresh).toMatchObject({
            items: [],
            metadataSource: 'chatgpt-content-v1',
            status: 'unavailable',
        });
    });

    it('fails closed when a mounted element cannot resolve to one canonical turn', () => {
        const source = buildSource(2);
        const result = readCurrentReaderContent(chatgptAdapter(), document.createElement('article'), {
            conversationContentSource: source,
            conversationMaterialization: { resolveElement: () => null } as any,
        });

        expect(result).toMatchObject({
            items: [],
            metadataSource: 'chatgpt-content-v1',
            status: 'target-unresolved',
        });
    });

    it('uses the same source revision for actions and rejects stale tokens', () => {
        const source = buildSource(1);
        const revision = readCurrentReaderContentSourceRevision(source);

        expect(revision).toEqual({
            routeEpoch: 0,
            revision: 0,
            conversationId: 'conv-1',
            contentToken: '1',
        });
        expect(isReaderContentSourceRevisionCurrent(source, revision)).toBe(true);
        expect(isReaderContentSourceRevisionCurrent(source, {
            ...revision!,
            contentToken: 'stale',
        })).toBe(false);
    });

    it('returns the selected Reader item without a second semantic source', async () => {
        const source = buildSource(2);
        const result = await collectFreshCurrentReaderItem(chatgptAdapter(), document.createElement('article'), {
            conversationContentSource: source,
            conversationMaterialization: {
                resolveElement: () => ({
                    documentKey: toConversationSnapshotV1({ conversationId: 'conv-1', rounds: [] }).document.key,
                    turnId: 'round-2',
                    assistantMessageId: 'assistant-2',
                    userMessageId: 'user-2',
                }),
            } as any,
        });

        expect(result?.item.content).toBe('Answer 2');
        expect(result?.sourceRevision?.contentToken).toBe('1');
    });

    it('reads a sealed mounted turn directly while the global snapshot is still incomplete', async () => {
        const base = buildSource(1);
        const documentKey = toConversationSnapshotV1({ conversationId: 'conv-1', rounds: [] }).document.key;
        const target = {
            documentKey,
            turnId: 'round-2',
            assistantMessageId: 'assistant-2',
            userMessageId: 'user-2',
        };
        const source = {
            ...base,
            readTurn: vi.fn(() => ({
                kind: 'ready' as const,
                target,
                turn: {
                    key: 'round-2:assistant-2',
                    ordinal: 2,
                    identity: target,
                    userText: 'Prompt 2',
                    assistantMarkdown: 'Answer 2',
                },
                contentToken: 'turn-2-token',
            })),
        };

        const result = await collectFreshCurrentReaderItem(chatgptAdapter(), document.createElement('article'), {
            conversationContentSource: source,
            conversationMaterialization: { resolveElement: () => target } as any,
            pageUrl: 'https://chatgpt.com/c/conv-1',
        });

        expect(result?.item.content).toBe('Answer 2');
        expect(result?.sourceRevision?.contentToken).toBe('turn-2-token');
        expect(source.readTurn).toHaveBeenCalledWith(target);
    });

    it('converts Reader items to export turns after resolving lazy content', async () => {
        const items: ReaderItem[] = [
            {
                id: 'r1',
                userPrompt: 'Prompt 1',
                content: async () => '- bullet\n  - nested\n\n$$\nE=mc^2 \\tag{1}\n$$',
            },
            { id: 'r2', userPrompt: 'Prompt 2', content: () => 'plain' },
        ];

        await expect(readerItemsToChatTurns(items)).resolves.toEqual([
            {
                user: 'Prompt 1',
                assistant: '- bullet\n  - nested\n\n$$\nE=mc^2 \\tag{1}\n$$',
                index: 0,
            },
            { user: 'Prompt 2', assistant: 'plain', index: 1 },
        ]);
    });

    it('keeps Reader markdown structures intact for PDF and PNG export', async () => {
        const turns = await readerItemsToChatTurns([{
            id: 'r1',
            userPrompt: 'Prompt 1',
            content: ['# Heading', '', '- bullet', '  - nested', '', '> quoted', '', '$$', 'E=mc^2 \\tag{1}', '$$'].join('\n'),
        }]);
        const metadata = {
            url: 'https://chatgpt.com/c/1',
            exportedAt: new Date('2026-03-01T00:00:00.000Z').toISOString(),
            title: 'T',
            count: 1,
            platform: 'ChatGPT',
        };
        const t = (key: string, args?: unknown) => args == null ? key : `${key}:${String(args)}`;
        const pdfPlan = buildPdfPrintPlan(turns, [0], metadata, t);
        const exportDocument = buildMessageExportDocument(turns, [0], {
            title: metadata.title,
            labels: { user: t('pdfUserLabel'), assistant: t('pdfAssistantLabel') },
            formatHeading: (ordinal) => t('pdfMessagePrefix', `${ordinal}`),
        });
        const pngProfile = renderMessageCardProfile(exportDocument!, { widthCssPx: 800 });

        expect(pdfPlan?.html).toContain('<ul>');
        expect(pdfPlan?.html).toContain('<blockquote>');
        expect(pngProfile.html).toContain('<li>nested</li>');
    });
});
