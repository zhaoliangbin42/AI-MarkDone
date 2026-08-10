import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createConversationDocumentKeyV1, type ConversationDocumentRefV1 } from '@/contracts/conversationContent';
import type { RenderedContentCompilerV2 } from '@/contracts/conversationDiscoveryV2';
import { ChatGPTAdapter } from '@/drivers/content/adapters/sites/chatgpt';
import { ChatGPTConversationHostMonitor } from '@/drivers/content/chatgpt/ChatGPTConversationHostMonitor';
import { getChatGPTPageIndex } from '@/drivers/content/chatgpt/domConversationDiscovery';
import {
    ConversationContentRepository,
    type ConversationContentCandidateV1,
} from '@/services/content/ConversationContentRepository';

function deferred<T>(): {
    promise: Promise<T>;
    resolve(value: T): void;
    reject(error: unknown): void;
} {
    let resolve!: (value: T) => void;
    let reject!: (error: unknown) => void;
    const promise = new Promise<T>((res, rej) => {
        resolve = res;
        reject = rej;
    });
    return { promise, resolve, reject };
}

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

            const canonicalDocument = {
                key: createConversationDocumentKeyV1('chatgpt', 'conversation-1'),
                platformId: 'chatgpt',
                conversationId: 'conversation-1',
                canonicalUrl: 'https://chatgpt.com/c/conversation-1',
            };
            currentDocument = null;
            history.replaceState({}, '', '/c/WEB:birth-1');
            monitor.notifyRouteChanged();
            currentDocument = canonicalDocument;
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
                    proof: { basis: 'host-born' },
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
            history.replaceState({}, '', '/c/WEB:birth-b');
            monitor.notifyRouteChanged();
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

    it('does not let an empty home proof turn a direct existing conversation into host-born content', async () => {
        let currentDocument: ConversationDocumentRefV1 | null = null;
        const baseline = deferred<ConversationContentCandidateV1>();
        const repository = new ConversationContentRepository({
            resolveDocument: () => currentDocument,
            readBaseline: async () => baseline.promise,
        });
        const compiler: RenderedContentCompilerV2 = {
            compile: vi.fn(async () => ({
                kind: 'ready' as const,
                user: { markdown: 'Visible prompt', text: 'Visible prompt' },
                assistant: { markdown: 'Visible answer', text: 'Visible answer' },
                semanticDigest: 'direct-existing-home',
                surfaceDigest: 'direct-existing-home-surface',
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
            currentDocument = {
                key: createConversationDocumentKeyV1('chatgpt', 'existing-from-home'),
                platformId: 'chatgpt',
                conversationId: 'existing-from-home',
            };
            history.replaceState({}, '', '/c/existing-from-home');
            document.querySelector('main')!.innerHTML = `
                <section data-testid="conversation-turn-1" data-turn="user" data-turn-id="turn-1">
                    <div data-message-author-role="user" data-message-id="user-1">Visible prompt</div>
                </section>
                <section data-testid="conversation-turn-2" data-turn="assistant" data-turn-id="turn-1">
                    <div data-message-author-role="assistant" data-message-id="assistant-1">
                        <div class="markdown prose">Visible answer</div>
                    </div>
                    <div><button data-testid="copy-turn-action-button">Copy</button></div>
                </section>
            `;
            monitor.notifyRouteChanged();
            const baselineFlight = repository.enterCurrentEpoch();
            await vi.advanceTimersByTimeAsync(400);
            await Promise.resolve();

            expect(repository.read().kind).toBe('syncing');
            expect(repository.read().snapshot).toBeNull();

            baseline.resolve({
                document: currentDocument,
                coverage: 'complete',
                turns: [{
                    key: 'turn-1:assistant-1',
                    ordinal: 1,
                    identity: {
                        turnId: 'turn-1',
                        userMessageId: 'user-1',
                        assistantMessageId: 'assistant-1',
                    },
                    userText: 'Baseline prompt',
                    assistantMarkdown: 'Baseline answer',
                }],
            });
            const ready = await baselineFlight;
            expect(ready.kind).toBe('ready');
            if (ready.kind !== 'ready') throw new Error('expected baseline ready state');
            expect(ready.snapshot.turns[0]?.assistantMarkdown).toBe('Baseline answer');
        } finally {
            monitor.dispose();
            repository.dispose();
            adapter.dispose();
        }
    });

    it('does not lose a new tail turn when its predecessor is temporarily virtualized out', async () => {
        let currentDocument: ConversationDocumentRefV1 | null = {
            key: createConversationDocumentKeyV1('chatgpt', 'virtualized-tail'),
            platformId: 'chatgpt',
            conversationId: 'virtualized-tail',
        };
        const repository = new ConversationContentRepository({
            resolveDocument: () => currentDocument,
            readBaseline: async () => ({
                document: currentDocument!,
                coverage: 'complete' as const,
                turns: [{
                    key: 'turn-1:assistant-1',
                    ordinal: 1,
                    identity: {
                        turnId: 'turn-1',
                        userMessageId: 'user-1',
                        assistantMessageId: 'assistant-1',
                    },
                    userText: 'Question 1',
                    assistantMarkdown: 'Answer 1',
                }],
            }),
        });
        const compiler: RenderedContentCompilerV2 = {
            compile: vi.fn(async () => ({
                kind: 'ready' as const,
                user: { markdown: 'Question 2', text: 'Question 2' },
                assistant: { markdown: 'Answer 2', text: 'Answer 2' },
                semanticDigest: 'virtualized-tail-2',
                surfaceDigest: 'virtualized-tail-2-surface',
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

        const appendRound = (index: number): void => {
            document.querySelector('main')!.insertAdjacentHTML('beforeend', `
                <section data-testid="conversation-turn-${index * 2 - 1}" data-turn="user" data-turn-id="turn-${index}">
                    <div data-message-author-role="user" data-message-id="user-${index}">Question ${index}</div>
                </section>
                <section data-testid="conversation-turn-${index * 2}" data-turn="assistant" data-turn-id="turn-${index}">
                    <div data-message-author-role="assistant" data-message-id="assistant-${index}">
                        <div class="markdown prose">Answer ${index}</div>
                    </div>
                    <div><button data-testid="copy-turn-action-button">Copy</button></div>
                </section>
            `);
        };

        try {
            monitor.init();
            await repository.enterCurrentEpoch();
            document.querySelector('main')!.innerHTML = '';
            appendRound(2);
            await vi.advanceTimersByTimeAsync(400);
            await Promise.resolve();
            expect(repository.read().snapshot?.turns).toHaveLength(2);

            document.querySelector('main')!.innerHTML = '';
            appendRound(1);
            appendRound(2);
            await vi.advanceTimersByTimeAsync(400);
            await Promise.resolve();

            const ready = repository.read();
            expect(ready.kind).toBe('ready');
            if (ready.kind !== 'ready') throw new Error('expected ready state');
            expect(ready.snapshot.turns.map((turn) => turn.identity.assistantMessageId)).toEqual([
                'assistant-1',
                'assistant-2',
            ]);
        } finally {
            monitor.dispose();
            repository.dispose();
            adapter.dispose();
        }
    });

    it('keeps a compiler-rejected turn dirty for the next host signal', async () => {
        const currentDocument: ConversationDocumentRefV1 = {
            key: createConversationDocumentKeyV1('chatgpt', 'compiler-retry'),
            platformId: 'chatgpt',
            conversationId: 'compiler-retry',
            canonicalUrl: 'https://chatgpt.com/c/compiler-retry',
        };
        const repository = new ConversationContentRepository({
            resolveDocument: () => currentDocument,
            readBaseline: async () => ({
                document: currentDocument,
                coverage: 'complete' as const,
                turns: [{
                    key: 'turn-1:assistant-1',
                    ordinal: 1,
                    identity: {
                        turnId: 'turn-1',
                        userMessageId: 'user-1',
                        assistantMessageId: 'assistant-1',
                    },
                    userText: 'Question 1',
                    assistantMarkdown: 'Answer 1',
                }],
            }),
        });
        const readyResult = {
            kind: 'ready' as const,
            user: { markdown: 'Question 2', text: 'Question 2' },
            assistant: { markdown: 'Answer 2', text: 'Answer 2' },
            semanticDigest: 'compiler-retry-turn',
            surfaceDigest: 'compiler-retry-surface',
            manifest: {
                nodeCount: 2,
                formulaCount: 0,
                codeBlockCount: 0,
                tableCount: 0,
                imageCount: 0,
            },
        };
        const compiler: RenderedContentCompilerV2 = {
            compile: vi.fn()
                .mockResolvedValueOnce({ kind: 'rejected', reason: 'compiler-error' })
                .mockResolvedValue(readyResult),
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
            history.replaceState({}, '', '/c/compiler-retry');
            monitor.init();
            await repository.enterCurrentEpoch();
            document.querySelector('main')!.innerHTML = `
                <section data-testid="conversation-turn-3" data-turn="user" data-turn-id="turn-2">
                    <div data-message-author-role="user" data-message-id="user-2">Question 2</div>
                </section>
                <section data-testid="conversation-turn-4" data-turn="assistant" data-turn-id="turn-2">
                    <div data-message-author-role="assistant" data-message-id="assistant-2">
                        <div class="markdown prose">Answer 2</div>
                    </div>
                    <div><button data-testid="copy-turn-action-button">Copy</button></div>
                </section>
            `;
            await Promise.resolve();
            await vi.advanceTimersByTimeAsync(400);
            await Promise.resolve();
            expect(compiler.compile).toHaveBeenCalledTimes(1);
            expect(repository.read().snapshot?.turns).toHaveLength(1);

            document.querySelector('.markdown.prose')!.textContent = 'Answer 2 revised';
            await Promise.resolve();
            await vi.advanceTimersByTimeAsync(400);
            await Promise.resolve();

            expect(compiler.compile).toHaveBeenCalledTimes(2);
            expect(repository.read().snapshot?.turns).toHaveLength(2);
        } finally {
            monitor.dispose();
            repository.dispose();
            adapter.dispose();
        }
    });
});
