import { describe, expect, it } from 'vitest';

import {
    createConversationDocumentKeyV1,
    type ConversationContentStateV1,
} from '@/contracts/conversationContent';
import {
    readCurrentReaderContent,
    collectFreshReaderContent,
    isReaderContentSourceRevisionCurrent,
} from '@/services/reader/readerContentSource';

const conversationId = 'conversation-v1';
const documentKey = createConversationDocumentKeyV1('chatgpt', conversationId);

function createState(kind: 'ready' | 'stale' = 'ready'): ConversationContentStateV1 {
    const document = {
        key: documentKey,
        platformId: 'chatgpt',
        conversationId,
        title: 'V1 conversation',
    };
    const snapshot = {
        schemaVersion: 1 as const,
        document,
        contentToken: 'conversation-content-v1:abc12345',
        coverage: 'complete' as const,
        turns: [{
            key: 'turn-1:assistant-1',
            ordinal: 1,
            identity: {
                turnId: 'turn-1',
                userMessageId: 'user-1',
                assistantMessageId: 'assistant-1',
            },
            userText: 'Question',
            assistantMarkdown: '**Answer**',
        }],
    };
    return kind === 'ready'
        ? { kind, document, snapshot }
        : { kind, document, snapshot, reason: 'source-timeout' };
}

function createSource(initialState: ConversationContentStateV1) {
    let state = initialState;
    return {
        read: () => state,
        subscribe: (listener: (next: ConversationContentStateV1) => void) => {
            listener(state);
            return () => undefined;
        },
        refresh: async () => state,
        isCurrent: (token: string) => token === state.snapshot?.contentToken,
        setState: (next: ConversationContentStateV1) => { state = next; },
    };
}

describe('Reader Content Port V1 projection', () => {
    it('projects semantic turns without importing ChatGPT graph or DOM facts', () => {
        const source = createSource(createState());
        const anchor = document.createElement('article');
        const materialization = {
            resolveElement: (element: HTMLElement) => element === anchor
                ? {
                    documentKey,
                    turnId: 'turn-1',
                    assistantMessageId: 'assistant-1',
                    userMessageId: 'user-1',
                }
                : null,
        };
        const result = readCurrentReaderContent(
            { getPlatformId: () => 'chatgpt' } as any,
            anchor,
            {
                conversationContentSource: source,
                conversationMaterialization: materialization as any,
                pageUrl: 'https://chatgpt.com/c/conversation-v1#reader',
            },
        );

        expect(result.metadataSource).toBe('chatgpt-content-v1');
        expect(result.coverage).toBe('complete');
        expect(result.startIndex).toBe(0);
        expect(result.items[0]).toMatchObject({
            id: 'chatgpt-assistant-1',
            userPrompt: 'Question',
            content: '**Answer**',
            meta: {
                assistantMessageId: 'assistant-1',
                roundId: 'turn-1',
            },
        });
        expect(result.annotationDocument).toMatchObject({
            conversationId,
            title: 'V1 conversation',
        });
        expect(result.sourceRevision?.contentToken).toBe('conversation-content-v1:abc12345');
    });

    it('keeps a same-document last-good snapshot available and labels it stale', async () => {
        const source = createSource(createState('stale'));
        const result = await collectFreshReaderContent(
            { getPlatformId: () => 'chatgpt' } as any,
            null,
            { conversationContentSource: source, pageUrl: 'https://chatgpt.com/c/conversation-v1' },
        );

        expect(result.status).toBe('stale');
        expect(result.items).toHaveLength(1);
        expect(isReaderContentSourceRevisionCurrent(source, result.sourceRevision)).toBe(true);
    });

    it('resolves the clicked assistant message from its typed message id when the materialization index is late', () => {
        const source = createSource(createState());
        const assistant = document.createElement('article');
        assistant.setAttribute('data-message-id', 'assistant-1');
        const result = readCurrentReaderContent(
            { getPlatformId: () => 'chatgpt' } as any,
            assistant,
            {
                conversationContentSource: source,
                conversationMaterialization: {
                    resolveElement: () => null,
                } as any,
                pageUrl: 'https://chatgpt.com/c/conversation-v1',
            },
        );

        expect(result.status).toBe('ready');
        expect(result.startIndex).toBe(0);
        expect(result.items).toHaveLength(1);
    });
});
