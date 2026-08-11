import { beforeEach, describe, expect, it, vi } from 'vitest';

import type {
    ConversationContentStateV1,
    ConversationDocumentRefV1,
    ConversationSnapshotV1,
} from '@/contracts/conversationContent';
import { createConversationDocumentKeyV1, createConversationPageDocumentKeyV1 } from '@/contracts/conversationContent';
import { ChatGPTAdapter } from '@/drivers/content/adapters/sites/chatgpt';
import { ChatGPTConversationSurface } from '@/drivers/content/chatgpt/ChatGPTConversationSurface';

const canonicalId = '695499b7-464c-8323-a998-119f661ac953';
const pageKey = createConversationPageDocumentKeyV1('chatgpt', 'surface-test');
const canonicalKey = createConversationDocumentKeyV1('chatgpt', canonicalId);

function pageDocument(): ConversationDocumentRefV1 {
    return {
        key: pageKey,
        platformId: 'chatgpt',
        identityKind: 'page',
        conversationId: null,
        canonicalUrl: 'https://chatgpt.com/',
    };
}

function canonicalDocument(): ConversationDocumentRefV1 {
    return {
        key: canonicalKey,
        platformId: 'chatgpt',
        identityKind: 'canonical',
        conversationId: canonicalId,
        canonicalUrl: `https://chatgpt.com/c/${canonicalId}`,
    };
}

function snapshot(document: ConversationDocumentRefV1): ConversationSnapshotV1 {
    return {
        schemaVersion: 1,
        document,
        projectionId: 'projection-1',
        contentToken: 'content-token-1',
        coverage: 'complete',
        proof: { basis: 'host' },
        turns: [
            {
                key: 'turn-1:assistant-1',
                ordinal: 1,
                identity: {
                    turnId: 'turn-1',
                    userMessageId: 'user-1',
                    assistantMessageId: 'assistant-1',
                },
                userText: 'Question one',
                assistantMarkdown: 'Answer one',
            },
            {
                key: 'turn-2:assistant-2',
                ordinal: 2,
                identity: {
                    turnId: 'turn-2',
                    userMessageId: 'user-2',
                    assistantMessageId: 'assistant-2',
                },
                userText: 'Question two',
                assistantMarkdown: 'Answer two',
            },
        ],
    };
}

function renderHost(): void {
    document.body.innerHTML = `
        <main>
            <section data-testid="conversation-turn-1" data-turn="user" data-turn-id="turn-1">
                <div data-message-author-role="user" data-message-id="user-1">Question one</div>
            </section>
            <section data-testid="conversation-turn-2" data-turn="assistant" data-turn-id="turn-1">
                <div data-message-author-role="assistant" data-message-id="assistant-1">
                    <div class="markdown prose">Answer one</div>
                </div>
                <div class="z-0 flex"><button data-testid="copy-turn-action-button">Copy</button></div>
            </section>
            <section data-testid="conversation-turn-5" data-turn="user" data-turn-id="turn-3">
                <div data-message-author-role="user" data-message-id="user-3">Question three</div>
            </section>
            <section data-testid="conversation-turn-6" data-turn="assistant" data-turn-id="turn-3">
                <div data-message-author-role="assistant" data-message-id="assistant-3">
                    <div class="markdown prose">Streaming answer</div>
                </div>
                <button data-testid="stop-button">Stop</button>
            </section>
        </main>
    `;
}

describe('ChatGPTConversationSurface', () => {
    beforeEach(() => {
        history.replaceState({}, '', '/');
        renderHost();
    });

    it('publishes one frame containing obtained, unmounted, and pending surface facts', async () => {
        const adapter = new ChatGPTAdapter();
        let state: ConversationContentStateV1 = {
            kind: 'ready',
            document: pageDocument(),
            snapshot: snapshot(pageDocument()),
        };
        const contentListeners = new Set<(next: ConversationContentStateV1) => void>();
        const content = {
            read: () => state,
            subscribe: (listener: (next: ConversationContentStateV1) => void) => {
                contentListeners.add(listener);
                listener(state);
                return () => contentListeners.delete(listener);
            },
            refresh: async () => state,
            isCurrent: (token: string) => token === state.snapshot?.contentToken,
        };
        const surface = new ChatGPTConversationSurface({ adapter, content });

        const initial = surface.readFrame();
        expect(initial.obtainedTurns).toHaveLength(2);
        expect(initial.obtainedTurns[0]).toMatchObject({
            status: 'obtained',
            turn: { identity: { assistantMessageId: 'assistant-1' } },
            materialization: { messageElement: expect.any(HTMLElement) },
        });
        expect(initial.obtainedTurns[1]).toMatchObject({
            status: 'obtained',
            turn: { identity: { assistantMessageId: 'assistant-2' } },
            materialization: null,
        });
        expect(initial.pendingSurfaces).toHaveLength(1);
        expect(initial.pendingSurfaces[0]).toMatchObject({
            status: 'pending-surface',
            target: { assistantMessageId: 'assistant-3' },
        });

        const initialSurfaceToken = initial.surfaceToken;
        const listener = vi.fn();
        surface.subscribeFrame(listener);
        expect(listener).toHaveBeenCalledTimes(1);

        const promotedDocument = canonicalDocument();
        state = {
            kind: 'ready',
            document: promotedDocument,
            snapshot: { ...snapshot(promotedDocument), contentToken: 'content-token-1' },
        };
        contentListeners.forEach((notify) => notify(state));

        const promoted = surface.readFrame();
        expect(listener).toHaveBeenCalledTimes(2);
        expect(promoted.document).toEqual(promotedDocument);
        expect(promoted.contentToken).toBe('content-token-1');
        expect(promoted.surfaceToken).toBe(initialSurfaceToken);
        expect(promoted.obtainedTurns[0]?.target.documentKey).toBe(canonicalKey);

        const querySelectorAll = vi.spyOn(Element.prototype, 'querySelectorAll');
        try {
            const textNode = document.querySelector('.markdown.prose')?.firstChild;
            if (!textNode) throw new Error('assistant text fixture is missing');
            textNode.textContent = 'Streaming answer update';
            await Promise.resolve();
            await Promise.resolve();

            expect(querySelectorAll).not.toHaveBeenCalled();
            expect(listener).toHaveBeenCalledTimes(2);
        } finally {
            querySelectorAll.mockRestore();
        }

        surface.dispose();
        adapter.dispose();
    });
});
