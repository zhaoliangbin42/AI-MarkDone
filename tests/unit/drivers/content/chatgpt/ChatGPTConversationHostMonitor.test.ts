import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createConversationDocumentKeyV1, type ConversationDocumentRefV1 } from '@/contracts/conversationContent';
import type { RenderedContentCompilerV2 } from '@/contracts/conversationDiscoveryV2';
import { ChatGPTAdapter } from '@/drivers/content/adapters/sites/chatgpt';
import { ChatGPTConversationHostMonitor } from '@/drivers/content/chatgpt/ChatGPTConversationHostMonitor';
import { getChatGPTPageIndex } from '@/drivers/content/chatgpt/domConversationDiscovery';
import { ConversationContentRepository } from '@/services/content/ConversationContentRepository';

describe('ChatGPTConversationHostMonitor', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        history.replaceState({}, '', '/');
        document.documentElement.innerHTML = '<head></head><body><main></main></body>';
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('coalesces 1000 streaming mutations into one stable compile and no baseline replay', async () => {
        let currentDocument: ConversationDocumentRefV1 | null = null;
        const readBaseline = vi.fn(async () => null);
        const repository = new ConversationContentRepository({
            resolveDocument: () => currentDocument,
            readBaseline,
        });
        const compiler: RenderedContentCompilerV2 = {
            compile: vi.fn(async () => ({
                kind: 'ready' as const,
                user: { markdown: 'Question', text: 'Question' },
                assistant: { markdown: 'Final answer', text: 'Final answer' },
                semanticDigest: 'stable-turn-digest',
                surfaceDigest: 'stable-surface-digest',
                manifest: {
                    nodeCount: 2,
                    formulaCount: 0,
                    codeBlockCount: 0,
                    tableCount: 0,
                    imageCount: 0,
                },
            })),
        };
        const adapter = new ChatGPTAdapter();
        const monitor = new ChatGPTConversationHostMonitor({
            adapter,
            index: getChatGPTPageIndex(adapter),
            repository,
            resolveDocument: () => currentDocument,
            compiler,
        });

        try {
            monitor.init();
            document.querySelector('main')!.innerHTML = `
                <div data-turn-id-container="client-created-root"></div>
                <div data-turn-id-container="user-slot-1">
                    <section data-turn="user" data-turn-id="turn-1">
                        <div data-message-author-role="user" data-message-id="user-1">Question</div>
                    </section>
                </div>
                <div data-turn-id-container="assistant-slot-1">
                    <section data-turn="assistant" data-turn-id="turn-1">
                        <div data-message-author-role="assistant" data-message-id="assistant-1">
                            <div class="markdown prose">token-0</div>
                        </div>
                        <div class="z-0 flex"><button data-testid="copy-turn-action-button">Copy</button></div>
                    </section>
                </div>
            `;
            document.body.insertAdjacentHTML('beforeend', '<button data-testid="stop-button">Stop</button>');
            const content = document.querySelector('.markdown.prose');
            if (!(content instanceof HTMLElement)) throw new Error('assistant fixture is missing');

            for (let index = 1; index <= 1_000; index += 1) {
                content.textContent = `token-${index}`;
                await Promise.resolve();
            }
            await vi.advanceTimersByTimeAsync(400);
            expect(compiler.compile).not.toHaveBeenCalled();
            expect(readBaseline).not.toHaveBeenCalled();

            currentDocument = {
                key: createConversationDocumentKeyV1('chatgpt', 'conversation-1'),
                platformId: 'chatgpt',
                conversationId: 'conversation-1',
                canonicalUrl: 'https://chatgpt.com/c/conversation-1',
            };
            history.replaceState({}, '', '/c/conversation-1');
            monitor.notifyRouteChanged();
            content.textContent = 'Final answer';
            document.querySelector('button[data-testid="stop-button"]')?.remove();
            await Promise.resolve();
            await vi.advanceTimersByTimeAsync(400);
            await Promise.resolve();

            expect(compiler.compile).toHaveBeenCalledTimes(1);
            expect(readBaseline).not.toHaveBeenCalled();
            expect(repository.read()).toMatchObject({
                kind: 'ready',
                snapshot: {
                    proof: { basis: 'host-born', tail: 'stable' },
                    turns: [{ identity: { assistantMessageId: 'assistant-1' } }],
                },
            });
        } finally {
            monitor.dispose();
            repository.dispose();
            adapter.dispose();
        }
    });

    it('re-establishes empty proof after leaving an existing conversation for a blank home page', async () => {
        let currentDocument: ConversationDocumentRefV1 | null = {
            key: createConversationDocumentKeyV1('chatgpt', 'conversation-a'),
            platformId: 'chatgpt',
            conversationId: 'conversation-a',
        };
        history.replaceState({}, '', '/c/conversation-a');
        const repository = new ConversationContentRepository({
            resolveDocument: () => currentDocument,
            readBaseline: async () => null,
        });
        const compiler: RenderedContentCompilerV2 = {
            compile: vi.fn(async () => ({
                kind: 'ready' as const,
                user: { markdown: 'Question', text: 'Question' },
                assistant: { markdown: 'Answer', text: 'Answer' },
                semanticDigest: 'new-home-turn',
                surfaceDigest: 'new-home-surface',
                manifest: {
                    nodeCount: 2,
                    formulaCount: 0,
                    codeBlockCount: 0,
                    tableCount: 0,
                    imageCount: 0,
                },
            })),
        };
        const adapter = new ChatGPTAdapter();
        const monitor = new ChatGPTConversationHostMonitor({
            adapter,
            index: getChatGPTPageIndex(adapter),
            repository,
            resolveDocument: () => currentDocument,
            compiler,
        });

        try {
            monitor.init();
            currentDocument = null;
            history.replaceState({}, '', '/');
            monitor.notifyRouteChanged();

            document.querySelector('main')!.innerHTML = `
                <section data-turn="user" data-turn-id="turn-b">
                    <div data-message-author-role="user" data-message-id="user-b">Question</div>
                </section>
                <section data-turn="assistant" data-turn-id="turn-b">
                    <div data-message-author-role="assistant" data-message-id="assistant-b">
                        <div class="markdown prose">Answer</div>
                    </div>
                    <div class="z-0 flex"><button data-testid="copy-turn-action-button">Copy</button></div>
                </section>
            `;
            currentDocument = {
                key: createConversationDocumentKeyV1('chatgpt', 'conversation-b'),
                platformId: 'chatgpt',
                conversationId: 'conversation-b',
            };
            history.replaceState({}, '', '/c/conversation-b');
            monitor.notifyRouteChanged();
            await Promise.resolve();
            await vi.advanceTimersByTimeAsync(400);
            await Promise.resolve();

            expect(repository.read()).toMatchObject({
                kind: 'ready',
                document: { conversationId: 'conversation-b' },
                snapshot: { proof: { basis: 'host-born' } },
            });
        } finally {
            monitor.dispose();
            repository.dispose();
            adapter.dispose();
        }
    });
});
