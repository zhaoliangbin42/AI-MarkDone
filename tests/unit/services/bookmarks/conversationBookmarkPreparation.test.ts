import { describe, expect, it, vi } from 'vitest';

import { prepareChatGPTBookmark } from '@/services/bookmarks/conversationBookmarkPreparation';
import { createConversationPageDocumentKeyV1 } from '@/contracts/conversationContent';
import { createConversationContentSource, toConversationSnapshotV1 } from '../../../helpers/chatgptContentFixtures';

describe('ChatGPT bookmark preparation', () => {
    it('reads the published turn without refreshing the conversation source', async () => {
        const base = createConversationContentSource({
            conversationId: 'bookmark-conversation',
            revision: 4,
            rounds: [{
                id: 'round-1',
                userPrompt: 'Saved prompt',
                assistantContent: 'Saved answer',
                assistantMessageId: 'assistant-1',
                userMessageId: 'user-1',
            }],
        });
        const refresh = vi.fn(async () => base.read());
        const source = { ...base, refresh };
        const target = {
            documentKey: toConversationSnapshotV1({ conversationId: 'bookmark-conversation', rounds: [] }).document.key,
            turnId: 'round-1',
            assistantMessageId: 'assistant-1',
            userMessageId: 'user-1',
        };
        const materialization = {
            resolveElement: vi.fn(() => target),
        };

        const prepared = await prepareChatGPTBookmark(
            source,
            materialization,
            document.createElement('article'),
        );

        expect(refresh).not.toHaveBeenCalled();
        expect(prepared).toMatchObject({
            messageId: 'assistant-1',
            position: 1,
            userMessage: 'Saved prompt',
            assistantMarkdown: 'Saved answer',
            contentRevision: '4',
        });
    });

    it('fails closed before reading or saving when the page has no canonical conversation id', async () => {
        const pageDocument = {
            key: createConversationPageDocumentKeyV1('chatgpt', 'bookmark-page'),
            platformId: 'chatgpt',
            identityKind: 'page' as const,
            conversationId: null,
            canonicalUrl: 'https://chatgpt.com/',
        };
        const target = {
            documentKey: pageDocument.key,
            turnId: 'round-1',
            assistantMessageId: 'assistant-1',
            userMessageId: 'user-1',
        };
        const readTurn = vi.fn();
        const source = {
            read: () => ({
                kind: 'ready' as const,
                document: pageDocument,
                snapshot: {
                    schemaVersion: 1 as const,
                    document: pageDocument,
                    projectionId: 'projection-page',
                    contentToken: 'content-page',
                    coverage: 'complete' as const,
                    turns: [],
                },
            }),
            subscribe: () => () => undefined,
            refresh: vi.fn(),
            isCurrent: () => true,
            readTurn,
        };
        const materialization = { resolveElement: vi.fn(() => target) };

        const prepared = await prepareChatGPTBookmark(
            source,
            materialization,
            document.createElement('article'),
        );

        expect(prepared).toBeNull();
        expect(readTurn).not.toHaveBeenCalled();
    });
});
