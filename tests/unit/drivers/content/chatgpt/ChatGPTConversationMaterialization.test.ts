import { beforeEach, describe, expect, it } from 'vitest';

import { ChatGPTConversationMaterialization } from '@/drivers/content/chatgpt/ChatGPTConversationMaterialization';
import { ChatGPTAdapter } from '@/drivers/content/adapters/sites/chatgpt';
import { createConversationDocumentKeyV1, type ConversationContentStateV1 } from '@/contracts/conversationContent';

const conversationId = '695499b7-464c-8323-a998-119f661ac953';
const documentKey = createConversationDocumentKeyV1('chatgpt', conversationId);

function readyState(anchor: HTMLElement): ConversationContentStateV1 {
    return {
        kind: 'ready',
        document: {
            key: documentKey,
            platformId: 'chatgpt',
            conversationId,
        },
        snapshot: {
            schemaVersion: 1,
            document: {
                key: documentKey,
                platformId: 'chatgpt',
                conversationId,
            },
            contentToken: 'content-token-1',
            coverage: 'complete',
            turns: [{
                key: 'turn-1:assistant-1',
                ordinal: 1,
                identity: {
                    turnId: 'turn-1',
                    userMessageId: 'user-1',
                    assistantMessageId: 'assistant-1',
                },
                userText: 'Question',
                assistantMarkdown: 'Answer',
            }],
        },
    };
}

describe('ChatGPTConversationMaterialization', () => {
    beforeEach(() => {
        history.replaceState({}, '', `/c/${conversationId}`);
        document.body.innerHTML = '';
    });

    it('keeps materialized anchors separate from semantic content and resolves typed targets', () => {
        const adapter = new ChatGPTAdapter();
        const anchor = document.createElement('article');
        document.body.appendChild(anchor);
        let state = readyState(anchor);
        const content = {
            read: () => state,
            subscribe: (listener: (next: ConversationContentStateV1) => void) => {
                listener(state);
                return () => undefined;
            },
            refresh: async () => state,
            isCurrent: (token: string) => token === state.snapshot?.contentToken,
        };
        const indexedRound = {
            position: 1,
            round: {
                id: 'turn-1',
                position: 1,
                userPrompt: 'Question',
                assistantContent: 'Answer',
                preview: 'Question',
                messageId: 'assistant-1',
                userMessageId: 'user-1',
                assistantMessageId: 'assistant-1',
            },
            identity: {
                roundId: 'turn-1',
                userMessageId: 'user-1',
                assistantMessageId: 'assistant-1',
            },
            materialized: {
                id: 'assistant-1',
                identity: {
                    roundId: 'turn-1',
                    userMessageId: 'user-1',
                    assistantMessageId: 'assistant-1',
                    assistantTurnId: 'turn-1',
                },
                anchorEl: anchor,
                jumpAnchorEl: anchor,
                userRootEl: anchor,
                userMessageEl: anchor,
                assistantRootEl: anchor,
                assistantMessageEl: anchor,
                assistantContentRootEl: anchor,
                groupEls: [anchor],
                assistantIndex: 0,
                isStreaming: false,
                source: 'turn-wrapper',
            },
        };
        const index = {
            subscribe: (listener: () => void) => {
                void listener;
                return () => undefined;
            },
            getRounds: () => [indexedRound],
            resolveRoundForElement: () => indexedRound,
        };
        const materialization = new ChatGPTConversationMaterialization({
            adapter,
            content,
            index: index as any,
        });

        expect(materialization.read()).toMatchObject({
            contentToken: 'content-token-1',
            entries: [{
                target: {
                    documentKey,
                    turnId: 'turn-1',
                    assistantMessageId: 'assistant-1',
                },
                anchorElement: anchor,
            }],
        });
        expect(materialization.resolveElement(anchor)).toMatchObject({
            documentKey,
            turnId: 'turn-1',
            assistantMessageId: 'assistant-1',
        });

        const oldToken = materialization.read().materializationToken;
        state = {
            ...state,
            snapshot: { ...state.snapshot!, contentToken: 'content-token-2' },
        };
        // A semantic update is observed through the source subscription in production.
        expect(materialization.read().materializationToken).toBe(oldToken);
        materialization.dispose();
        adapter.dispose();
    });

    it('publishes a typed pending host anchor before content is sealed', () => {
        document.body.innerHTML = `
            <main>
                <section data-testid="conversation-turn-1" data-turn="user" data-turn-id="turn-1">
                    <div data-message-author-role="user" data-message-id="user-1">Question</div>
                </section>
                <section data-testid="conversation-turn-2" data-turn="assistant" data-turn-id="turn-1">
                    <div data-message-author-role="assistant" data-message-id="assistant-1">
                        <div class="markdown prose">Answer</div>
                    </div>
                    <div class="z-0 flex"><button data-testid="copy-turn-action-button">Copy</button></div>
                </section>
            </main>
        `;
        const adapter = new ChatGPTAdapter();
        const state: ConversationContentStateV1 = {
            kind: 'syncing',
            document: { key: documentKey, platformId: 'chatgpt', conversationId },
            snapshot: null,
        };
        const content = {
            read: () => state,
            subscribe: (listener: (next: ConversationContentStateV1) => void) => {
                listener(state);
                return () => undefined;
            },
            refresh: async () => state,
            isCurrent: () => false,
        };
        const materialization = new ChatGPTConversationMaterialization({ adapter, content });
        const assistant = document.querySelector('[data-message-id="assistant-1"]');
        if (!(assistant instanceof HTMLElement)) throw new Error('fixture assistant is missing');

        expect(materialization.read()).toMatchObject({
            contentToken: null,
            entries: [{
                target: {
                    documentKey,
                    turnId: 'turn-1',
                    userMessageId: 'user-1',
                    assistantMessageId: 'assistant-1',
                },
                messageElement: assistant,
            }],
        });
        expect(materialization.resolveElement(assistant)).toMatchObject({
            documentKey,
            turnId: 'turn-1',
            assistantMessageId: 'assistant-1',
        });

        materialization.dispose();
        adapter.dispose();
    });

    it('maps an assistant-only DOM projection to the cached semantic turn', () => {
        document.body.innerHTML = `
            <main>
                <section
                    data-testid="conversation-turn-2"
                    data-turn="assistant"
                    data-turn-id="assistant-turn-1"
                    data-turn-id-container="assistant-turn-1"
                >
                    <div data-message-author-role="assistant" data-message-id="assistant-1">
                        <div class="markdown prose">Answer</div>
                    </div>
                    <div class="z-0 flex"><button data-testid="copy-turn-action-button">Copy</button></div>
                </section>
            </main>
        `;
        const adapter = new ChatGPTAdapter();
        let state = readyState(document.querySelector('[data-message-id="assistant-1"]') as HTMLElement);
        const content = {
            read: () => state,
            subscribe: (listener: (next: ConversationContentStateV1) => void) => {
                listener(state);
                return () => undefined;
            },
            refresh: async () => state,
            isCurrent: (token: string) => token === state.snapshot?.contentToken,
        };
        const materialization = new ChatGPTConversationMaterialization({ adapter, content });
        const assistant = document.querySelector('[data-message-id="assistant-1"]');
        if (!(assistant instanceof HTMLElement)) throw new Error('fixture assistant is missing');

        expect(materialization.read()).toMatchObject({
            contentToken: 'content-token-1',
            entries: [{
                target: {
                    documentKey,
                    turnId: 'turn-1',
                    userMessageId: 'user-1',
                    assistantMessageId: 'assistant-1',
                },
                messageElement: assistant,
            }],
        });
        expect(materialization.resolveElement(assistant)).toMatchObject({
            documentKey,
            turnId: 'turn-1',
            userMessageId: 'user-1',
            assistantMessageId: 'assistant-1',
        });

        materialization.dispose();
        adapter.dispose();
    });
});
