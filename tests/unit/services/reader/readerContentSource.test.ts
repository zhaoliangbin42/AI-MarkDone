import { beforeEach, describe, expect, it, vi } from 'vitest';
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

const {
    resolveChatGptRoundForElement,
    resolveChatGptReaderStartIndex,
} = vi.hoisted(() => ({
    resolveChatGptRoundForElement: vi.fn(),
    resolveChatGptReaderStartIndex: vi.fn((snapshot: any, target: any) => {
        if (!target) return Math.max(0, snapshot.rounds.length - 1);
        const messageId = target.messageId ?? target.assistantMessageId;
        return snapshot.rounds.findIndex((round: any) => round.messageId === messageId);
    }),
}));

vi.mock('@/drivers/content/chatgpt/ChatGPTConversationIndex', () => ({
    getChatGPTConversationIndex: vi.fn(() => ({
        resolveRoundForElement: resolveChatGptRoundForElement,
    })),
}));

vi.mock('@/services/reader/chatgptReaderItems', () => ({
    buildChatGPTReaderContent: vi.fn((snapshot: any, pageUrl = '') => ({
        items: snapshot.rounds.map((round: any) => ({
            id: `chatgpt-${round.messageId}`,
            userPrompt: round.userPrompt,
            content: round.assistantContent,
            meta: {
                platformId: 'chatgpt',
                messageId: round.messageId,
                position: round.position,
                url: pageUrl.split('#')[0],
            },
        })),
        annotationDocument: {
            platform: 'chatgpt',
            conversationId: snapshot.conversationId,
            title: null,
            lastKnownUrl: pageUrl.split('#')[0],
        },
    })),
    normalizeChatGPTReaderPageUrl: (url: string) => url.split('#')[0],
    resolveChatGPTReaderStartIndex: resolveChatGptReaderStartIndex,
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

import { buildChatGPTReaderContent } from '@/services/reader/chatgptReaderItems';
import { collectReaderItems } from '@/services/reader/collectReaderItems';

function createChatGptConversationSource(snapshot: any) {
    return {
        ensureReady: vi.fn(async () => snapshot),
        getState: vi.fn(() => ({
            status: snapshot ? 'ready' : 'blocked',
            routeEpoch: 1,
            revision: snapshot?.revision ?? 1,
            conversationId: snapshot?.conversationId ?? 'conv-1',
            snapshot,
            ...(snapshot ? {} : { reason: 'unproven-history' }),
        })),
        subscribe: vi.fn(),
    };
}

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
        const snapshot: any = {
            conversationId: 'conv-1',
            revision: 8,
            rounds: [
                { id: 'fresh-1', position: 1, userPrompt: 'Fresh prompt 1', assistantContent: 'Fresh answer 1', messageId: 'fresh-a1' },
                { id: 'fresh-2', position: 2, userPrompt: 'Fresh prompt 2', assistantContent: 'Fresh answer 2', messageId: 'fresh-a2' },
            ],
        };
        const chatGptConversationSource: any = {
            ensureReady: vi.fn(async () => snapshot),
            getState: vi.fn(() => ({
                status: 'ready',
                routeEpoch: 4,
                revision: 8,
                conversationId: 'conv-1',
                snapshot,
            })),
        };

        const result = await collectFreshReaderContent(adapter, null, {
            chatGptConversationSource,
            pageUrl: 'https://chatgpt.com/c/1',
        });

        expect(result.metadataSource).toBe('chatgpt-snapshot');
        expect(chatGptConversationSource.ensureReady).toHaveBeenCalledOnce();
        expect(chatGptConversationSource.ensureReady).toHaveBeenCalledWith();
        expect(result.sourceRevision).toEqual({
            routeEpoch: 4,
            revision: 8,
            conversationId: 'conv-1',
        });
        expect(result.items).toHaveLength(2);
        expect(result.items[1]?.content).toBe('Fresh answer 2');
        expect(collectReaderItems).not.toHaveBeenCalled();
    });

    it('captures the typed start identity before fresh confirmation when the DOM node is remounted', async () => {
        const messageElement = document.createElement('article');
        const adapter: any = {
            getPlatformId: () => 'chatgpt',
        };
        const snapshot: any = {
            conversationId: 'conv-remount',
            rounds: [
                { id: 'round-1', position: 1, userPrompt: 'Prompt 1', assistantContent: 'Answer 1', messageId: 'a1' },
                { id: 'round-2', position: 2, userPrompt: 'Prompt 2', assistantContent: 'Answer 2', messageId: 'a2' },
            ],
        };
        const target = {
            position: 2,
            positionSource: 'snapshot' as const,
            messageId: 'a2',
            roundId: 'round-2',
            userMessageId: 'u2',
            assistantMessageId: 'a2',
        };
        resolveChatGptRoundForElement.mockReturnValueOnce({
            position: 2,
            identity: {
                roundId: 'round-2',
                userMessageId: 'u2',
                assistantMessageId: 'a2',
            },
            round: snapshot.rounds[1],
        });

        const source: any = {
            ensureReady: vi.fn(async () => {
                resolveChatGptRoundForElement.mockReturnValue(null);
                return snapshot;
            }),
            getState: vi.fn(() => ({
                status: 'ready',
                routeEpoch: 1,
                revision: 2,
                conversationId: 'conv-remount',
                snapshot,
            })),
        };

        const result = await collectFreshReaderContent(adapter, messageElement, {
            chatGptConversationSource: source,
            pageUrl: 'https://chatgpt.com/c/conv-remount',
        });

        expect(result.status).toBe('ready');
        expect(result.startIndex).toBe(1);
        expect(buildChatGPTReaderContent).toHaveBeenCalledWith(snapshot, 'https://chatgpt.com/c/conv-remount');
        expect(resolveChatGptRoundForElement).toHaveBeenCalledTimes(1);
    });

    it('performs one post-confirmation identity lookup for a newly materialized message', async () => {
        const messageElement = document.createElement('article');
        const adapter: any = { getPlatformId: () => 'chatgpt' };
        const snapshot: any = {
            conversationId: 'conv-new',
            rounds: [
                { id: 'round-1', position: 1, userPrompt: 'Prompt 1', assistantContent: 'Answer 1', messageId: 'a1' },
                { id: 'round-2', position: 2, userPrompt: 'Prompt 2', assistantContent: 'Answer 2', messageId: 'a2' },
            ],
        };
        const indexedRound = {
            position: 2,
            identity: {
                roundId: 'round-2',
                userMessageId: 'u2',
                assistantMessageId: 'a2',
            },
            round: snapshot.rounds[1],
        };
        resolveChatGptRoundForElement
            .mockReturnValueOnce(null)
            .mockReturnValueOnce(indexedRound);
        const source = createChatGptConversationSource(snapshot);

        const result = await collectFreshReaderContent(adapter, messageElement, {
            chatGptConversationSource: source,
        });

        expect(result.status).toBe('ready');
        expect(result.startIndex).toBe(1);
        expect(resolveChatGptRoundForElement).toHaveBeenCalledTimes(2);
    });

    it('reuses normalized content within one source revision without sharing mutable ReaderItem objects', () => {
        const messageElement = document.createElement('article');
        const adapter: any = { getPlatformId: () => 'chatgpt' };
        const firstSnapshot: any = {
            conversationId: 'conv-cache',
            rounds: [
                { id: 'round-1', position: 1, userPrompt: 'Prompt 1', assistantContent: 'Answer 1', messageId: 'a1' },
                { id: 'round-2', position: 2, userPrompt: 'Prompt 2', assistantContent: 'Answer 2', messageId: 'a2' },
            ],
        };
        let snapshot = firstSnapshot;
        let state: any = {
            status: 'ready',
            routeEpoch: 1,
            revision: 1,
            conversationId: 'conv-cache',
            snapshot,
        };
        const source: any = {
            getState: vi.fn(() => state),
        };
        resolveChatGptRoundForElement.mockReturnValue({
            position: 2,
            identity: {
                roundId: 'round-2',
                userMessageId: 'u2',
                assistantMessageId: 'a2',
            },
            round: firstSnapshot.rounds[1],
        });

        const first = readCurrentReaderContent(adapter, messageElement, {
            chatGptConversationSource: source,
        });
        const second = readCurrentReaderContent(adapter, messageElement, {
            chatGptConversationSource: source,
        });

        expect(buildChatGPTReaderContent).toHaveBeenCalledTimes(1);
        expect(first.items).not.toBe(second.items);
        first.items[0]!.meta = { ...(first.items[0]!.meta || {}), bookmarked: true };
        expect(second.items[0]?.meta?.bookmarked).not.toBe(true);

        snapshot = {
            ...firstSnapshot,
            rounds: firstSnapshot.rounds.map((round: any) => (
                round.messageId === 'a2'
                    ? { ...round, assistantContent: 'Updated answer 2' }
                    : round
            )),
        };
        state = {
            ...state,
            revision: 2,
            snapshot,
        };

        const updated = readCurrentReaderContent(adapter, messageElement, {
            chatGptConversationSource: source,
        });

        expect(buildChatGPTReaderContent).toHaveBeenCalledTimes(2);
        expect(updated.items[1]?.content).toBe('Updated answer 2');
    });

    it('reuses normalized content across a same-snapshot revision while refreshing caller metadata', () => {
        const snapshot: any = {
            conversationId: 'conv-snapshot-cache',
            revision: 1,
            rounds: [
                { id: 'round-1', position: 1, userPrompt: 'Prompt 1', assistantContent: 'Answer 1', messageId: 'a1' },
            ],
        };
        let state: any = {
            status: 'ready',
            routeEpoch: 1,
            revision: 1,
            conversationId: 'conv-snapshot-cache',
            snapshot,
        };
        const source: any = { getState: vi.fn(() => state) };
        const adapter: any = { getPlatformId: () => 'chatgpt' };

        const first = readCurrentReaderContent(adapter, null, {
            chatGptConversationSource: source,
            pageUrl: 'https://chatgpt.com/c/conv-snapshot-cache?view=one',
        });
        state = { ...state, revision: 2 };
        const second = readCurrentReaderContent(adapter, null, {
            chatGptConversationSource: source,
            pageUrl: 'https://chatgpt.com/c/conv-snapshot-cache?view=two',
        });

        expect(buildChatGPTReaderContent).toHaveBeenCalledTimes(1);
        expect(first.items[0]?.meta?.url).toBe('https://chatgpt.com/c/conv-snapshot-cache?view=one');
        expect(second.items[0]?.meta?.url).toBe('https://chatgpt.com/c/conv-snapshot-cache?view=two');
        expect(second.annotationDocument?.lastKnownUrl).toBe('https://chatgpt.com/c/conv-snapshot-cache?view=two');
    });

    it('reads the published ChatGPT snapshot without triggering semantic acquisition', () => {
        const adapter: any = {
            getPlatformId: () => 'chatgpt',
            getLastMessageElement: () => null,
        };
        const snapshot = {
            conversationId: 'conv-1',
            revision: 7,
            proof: 'observed-graph' as const,
            capturedAt: 1,
            branchKey: 'branch-1',
            rounds: [
                {
                    id: 'round-1',
                    position: 1,
                    userPrompt: 'Published prompt',
                    assistantContent: 'Published answer',
                    preview: 'Published prompt',
                    messageId: 'a1',
                    userMessageId: 'u1',
                    assistantMessageId: 'a1',
                },
            ],
        };
        const chatGptConversationSource: any = {
            getState: vi.fn(() => ({
                status: 'ready',
                routeEpoch: 3,
                revision: 7,
                conversationId: 'conv-1',
                snapshot,
            })),
            ensureReady: vi.fn(),
        };

        const result = readCurrentReaderContent(adapter, null, {
            chatGptConversationSource,
            pageUrl: 'https://chatgpt.com/c/conv-1',
        });

        expect(chatGptConversationSource.ensureReady).not.toHaveBeenCalled();
        expect(result).toMatchObject({
            metadataSource: 'chatgpt-snapshot',
            sourceRevision: {
                routeEpoch: 3,
                revision: 7,
                conversationId: 'conv-1',
            },
            items: [{ content: 'Published answer' }],
        });
    });

    it('treats route epoch, revision, and conversation id as one ephemeral transaction identity', () => {
        const snapshot: any = {
            conversationId: 'conv-1',
            revision: 7,
            rounds: [],
        };
        let state: any = {
            status: 'ready',
            routeEpoch: 4,
            revision: 7,
            conversationId: 'conv-1',
            snapshot,
        };
        const source: any = {
            getState: vi.fn(() => state),
        };
        const revision = readCurrentReaderContentSourceRevision(source);

        expect(revision).toEqual({
            routeEpoch: 4,
            revision: 7,
            conversationId: 'conv-1',
        });
        expect(isReaderContentSourceRevisionCurrent(source, revision)).toBe(true);

        state = { ...state, routeEpoch: 5, revision: 0, snapshot: null };
        expect(isReaderContentSourceRevisionCurrent(source, revision)).toBe(false);
    });

    it('collects the current fresh ChatGPT Reader item from the same ReaderItem snapshot', async () => {
        const messageElement = document.createElement('article');
        const adapter: any = {
            getPlatformId: () => 'chatgpt',
            getMessageId: () => 'fresh-a2',
            extractUserPrompt: () => 'Fresh prompt 2',
        };
        const snapshot = {
                conversationId: 'conv-1',
                rounds: [
                    { id: 'fresh-1', position: 1, userPrompt: 'Fresh prompt 1', assistantContent: 'Fresh answer 1', messageId: 'fresh-a1' },
                    { id: 'fresh-2', position: 2, userPrompt: 'Fresh prompt 2', assistantContent: 'Fresh answer 2', messageId: 'fresh-a2' },
                ],
        };
        const chatGptConversationSource = createChatGptConversationSource(snapshot);
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

        const selection = await collectFreshCurrentReaderItem(adapter, messageElement, {
            chatGptConversationSource,
            pageUrl: 'https://chatgpt.com/c/1',
        });

        expect(chatGptConversationSource.ensureReady).toHaveBeenCalledWith();
        expect(buildChatGPTReaderContent).toHaveBeenCalledWith(
            expect.objectContaining({ conversationId: 'conv-1' }),
            'https://chatgpt.com/c/1',
        );
        expect(selection?.item.content).toBe('Fresh answer 2');
        expect(selection?.sourceRevision).toEqual({
            routeEpoch: 1,
            revision: 1,
            conversationId: 'conv-1',
        });
    });

    it('fails closed when the mounted ChatGPT message identity is absent from the canonical snapshot', async () => {
        const messageElement = document.createElement('article');
        const adapter: any = {
            getPlatformId: () => 'chatgpt',
            getMessageId: () => 'missing-assistant-id',
            extractUserPrompt: () => 'Duplicate prompt',
        };
        const chatGptConversationSource = createChatGptConversationSource({
                conversationId: 'conv-1',
                rounds: [
                    { id: 'round-1', position: 1, userPrompt: 'Duplicate prompt', assistantContent: 'Answer 1', messageId: 'a1' },
                    { id: 'round-2', position: 2, userPrompt: 'Duplicate prompt', assistantContent: 'Answer 2', messageId: 'a2' },
                ],
        });

        await expect(collectFreshCurrentReaderItem(adapter, messageElement, {
            chatGptConversationSource,
        })).resolves.toBeNull();
    });

    it('does not fall back to DOM Reader collection for the fresh ChatGPT body source', async () => {
        const messageElement = document.createElement('article');
        const adapter: any = {
            getPlatformId: () => 'chatgpt',
            getMessageId: () => 'dom-a1',
            extractUserPrompt: () => 'DOM prompt',
        };
        const chatGptConversationSource = createChatGptConversationSource(null);

        const result = await collectFreshReaderContent(adapter, messageElement, { chatGptConversationSource });

        expect(result).toMatchObject({ items: [], startIndex: 0, metadataSource: 'chatgpt-snapshot' });
        expect(chatGptConversationSource.ensureReady).toHaveBeenCalledTimes(1);
        expect(collectReaderItems).not.toHaveBeenCalled();
    });

    it('prefers ChatGPT structured snapshot content even when a message element is available', async () => {
        const messageElement = document.createElement('article');
        const adapter: any = {
            getPlatformId: () => 'chatgpt',
            getMessageId: () => 'a1',
            extractUserPrompt: () => 'Payload prompt',
        };
        const chatGptConversationSource = createChatGptConversationSource({
                conversationId: 'conv-1',
                revision: 1,
                proof: 'observed-graph' as const,
                capturedAt: 1,
                branchKey: 'branch-1',
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
        });
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

        const result = await collectFreshReaderContent(adapter, messageElement, {
            chatGptConversationSource,
            pageUrl: 'https://chatgpt.com/c/1#hash',
        });

        expect(result.metadataSource).toBe('chatgpt-snapshot');
        expect(chatGptConversationSource.ensureReady).toHaveBeenCalledTimes(1);
        expect(collectReaderItems).not.toHaveBeenCalled();
        expect(buildChatGPTReaderContent).toHaveBeenCalledTimes(1);
        expect(buildChatGPTReaderContent).toHaveBeenCalledWith(
            expect.objectContaining({ conversationId: 'conv-1' }),
            'https://chatgpt.com/c/1#hash',
        );
        expect(result.items[0]?.content).toBe('- payload bullet');
    });

    it('uses the published ChatGPT snapshot without forcing a refresh when DOM Reader collection is unavailable', () => {
        const adapter: any = {
            getPlatformId: () => 'chatgpt',
            getLastMessageElement: () => null,
            getMessageId: () => 'a1',
            extractUserPrompt: () => 'Payload prompt',
        };
        const chatGptConversationSource = createChatGptConversationSource({
                conversationId: 'conv-1',
                revision: 1,
                proof: 'observed-graph' as const,
                capturedAt: 1,
                branchKey: 'branch-1',
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
        });

        const result = readCurrentReaderContent(adapter, null, {
            chatGptConversationSource,
            pageUrl: 'https://chatgpt.com/c/1#hash',
        });

        expect(result.metadataSource).toBe('chatgpt-snapshot');
        expect(chatGptConversationSource.ensureReady).not.toHaveBeenCalled();
        expect(buildChatGPTReaderContent).toHaveBeenCalledTimes(1);
        expect(collectReaderItems).not.toHaveBeenCalled();
        expect(result.items[0]?.content).toBe('- payload bullet');
    });

    it('fails closed instead of creating a third ChatGPT DOM body source when no snapshot is available', () => {
        const messageElement = document.createElement('article');
        const adapter: any = {
            getPlatformId: () => 'chatgpt',
            getMessageId: () => 'dom-a1',
            extractUserPrompt: () => 'DOM prompt',
        };
        const chatGptConversationSource = createChatGptConversationSource(null);

        const result = readCurrentReaderContent(adapter, messageElement, { chatGptConversationSource });

        expect(result).toEqual({
            items: [],
            startIndex: 0,
            metadataSource: 'chatgpt-snapshot',
            status: 'unavailable',
        });
        expect(chatGptConversationSource.ensureReady).not.toHaveBeenCalled();
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
        const chatGptConversationSource = createChatGptConversationSource(snapshot);
        resolveChatGptRoundForElement.mockReturnValueOnce({
            position: 50,
            identity: { roundId: 'round-50', userMessageId: 'u50', assistantMessageId: 'a50' },
            round: {
                ...snapshot.rounds[1],
                userMessageId: 'u50',
                assistantMessageId: 'a50',
            },
        });

        const result = await collectFreshReaderContent(adapter, messageElement, { chatGptConversationSource });

        expect(adapter.getMessageId).not.toHaveBeenCalled();
        expect(buildChatGPTReaderContent).toHaveBeenCalledWith(
            snapshot,
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
        const chatGptConversationSource = createChatGptConversationSource({
                conversationId: 'conv-1',
                rounds: [
                    { id: 'round-1', position: 1, userPrompt: 'Prompt 1', assistantContent: 'Answer 1', messageId: 'a1' },
                    { id: 'round-2', position: 2, userPrompt: 'Prompt 2', assistantContent: 'Answer 2', messageId: 'a2' },
                ],
        });
        resolveChatGptRoundForElement.mockReturnValueOnce(null);

        const result = await collectFreshReaderContent(adapter, messageElement, { chatGptConversationSource });

        expect(result).toMatchObject({ items: [], startIndex: 0, metadataSource: 'chatgpt-snapshot' });
        expect(adapter.getMessageId).not.toHaveBeenCalled();
        expect(buildChatGPTReaderContent).not.toHaveBeenCalled();
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
