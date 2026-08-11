import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
    createConversationDocumentKeyV1,
    createConversationPageDocumentKeyV1,
    type ConversationDocumentRefV1,
} from '@/contracts/conversationContent';
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
            currentDocument = canonicalDocument;
            history.replaceState({}, '', '/c/conversation-1');
            monitor.notifyRouteChanged();
            content.textContent = 'Final answer';
            document.querySelector('button[data-testid="stop-button"]')?.remove();
            await Promise.resolve();
            await monitor.flushObserved();
            expect(compiler.compile).not.toHaveBeenCalled();
            await vi.advanceTimersByTimeAsync(400);
            await Promise.resolve();

            expect(compiler.compile).toHaveBeenCalledTimes(1);
            expect(readBaseline).not.toHaveBeenCalled();
            expect(repository.read()).toMatchObject({
                kind: 'ready',
                snapshot: {
                    proof: { basis: 'host' },
                    turns: [{ identity: { assistantMessageId: 'assistant-1' } }],
                },
            });
        } finally {
            monitor.dispose();
            repository.dispose();
            adapter.dispose();
        }
    });

    it('commits one snapshot for a stable initial DOM window', async () => {
        const currentDocument: ConversationDocumentRefV1 = {
            key: createConversationDocumentKeyV1('chatgpt', 'host-window'),
            platformId: 'chatgpt',
            conversationId: 'host-window',
        };
        history.replaceState({}, '', '/c/host-window');
        const repository = new ConversationContentRepository({
            resolveDocument: () => currentDocument,
            readBaseline: async () => null,
        });
        const compiler: RenderedContentCompilerV2 = {
            compile: vi.fn(async () => ({
                kind: 'ready' as const,
                user: { markdown: 'Question', text: 'Question' },
                assistant: { markdown: 'Answer', text: 'Answer' },
                semanticDigest: 'host-window-turn',
                surfaceDigest: 'host-window-surface',
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
        const publishedLengths: number[] = [];
        repository.subscribe((state) => {
            if (state.kind === 'ready') publishedLengths.push(state.snapshot.turns.length);
        });

        try {
            monitor.init();
            document.querySelector('main')!.innerHTML = [1, 2].map((index) => `
                <section data-turn="user" data-turn-id="turn-${index}">
                    <div data-message-author-role="user" data-message-id="user-${index}">Question ${index}</div>
                </section>
                <section data-turn="assistant" data-turn-id="turn-${index}">
                    <div data-message-author-role="assistant" data-message-id="assistant-${index}">
                        <div class="markdown prose">Answer ${index}</div>
                    </div>
                    <div><button data-testid="copy-turn-action-button">Copy</button></div>
                </section>
            `).join('');
            await Promise.resolve();
            await vi.advanceTimersByTimeAsync(400);
            await Promise.resolve();

            expect(compiler.compile).toHaveBeenCalledTimes(2);
            expect(repository.read().snapshot?.turns).toHaveLength(2);
            expect(publishedLengths).toEqual([2]);
        } finally {
            monitor.dispose();
            repository.dispose();
            adapter.dispose();
        }
    });

    it('binds stable home-page facts when a new canonical conversation appears', async () => {
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
                snapshot: { proof: { basis: 'host' } },
            });
        } finally {
            monitor.dispose();
            repository.dispose();
            adapter.dispose();
        }
    });

    it('preserves already-dirtied no-ID facts when the same page gains a canonical identity', async () => {
        let currentDocument: ConversationDocumentRefV1 | null = null;
        const repository = new ConversationContentRepository({
            resolveDocument: () => currentDocument,
            readBaseline: async () => null,
        });
        const compiler: RenderedContentCompilerV2 = {
            compile: vi.fn(async () => ({
                kind: 'ready' as const,
                user: { markdown: 'Question', text: 'Question' },
                assistant: { markdown: 'Answer', text: 'Answer' },
                semanticDigest: 'same-page-first-turn',
                surfaceDigest: 'same-page-first-surface',
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
                <section data-turn="user" data-turn-id="turn-first">
                    <div data-message-author-role="user" data-message-id="user-first">Question</div>
                </section>
                <section data-turn="assistant" data-turn-id="turn-first">
                    <div data-message-author-role="assistant" data-message-id="assistant-first">
                        <div class="markdown prose">Answer</div>
                    </div>
                    <div><button data-testid="copy-turn-action-button">Copy</button></div>
                </section>
            `;
            await Promise.resolve();

            currentDocument = {
                key: createConversationDocumentKeyV1('chatgpt', 'conversation-first'),
                platformId: 'chatgpt',
                conversationId: 'conversation-first',
            };
            history.replaceState({}, '', '/c/conversation-first');
            monitor.notifyRouteChanged();
            await vi.advanceTimersByTimeAsync(400);
            await Promise.resolve();

            expect(repository.read()).toMatchObject({
                kind: 'ready',
                document: { conversationId: 'conversation-first' },
                snapshot: {
                    proof: { basis: 'host' },
                    turns: [{ identity: { assistantMessageId: 'assistant-first' } }],
                },
            });
        } finally {
            monitor.dispose();
            repository.dispose();
            adapter.dispose();
        }
    });

    it('keeps the old no-ID pool until a new first turn is ready, then replaces it atomically', async () => {
        const currentDocument: ConversationDocumentRefV1 = {
            key: createConversationPageDocumentKeyV1('chatgpt', 'same-url-new-page-conversation'),
            platformId: 'chatgpt',
            identityKind: 'page',
            conversationId: null,
            canonicalUrl: 'https://chatgpt.com/',
        };
        document.querySelector('main')!.innerHTML = `
            <section data-turn="user" data-turn-id="turn-old">
                <div data-message-author-role="user" data-message-id="user-old">Old question</div>
            </section>
            <section data-turn="assistant" data-turn-id="turn-old">
                <div data-message-author-role="assistant" data-message-id="assistant-old">
                    <div class="markdown prose">Old answer</div>
                </div>
                <div><button data-testid="copy-turn-action-button">Copy</button></div>
            </section>
        `;
        const repository = new ConversationContentRepository({
            resolveDocument: () => currentDocument,
            readBaseline: async () => null,
        });
        repository.ingestHostTurn({
            turn: {
                key: 'turn-old:assistant-old',
                ordinal: 1,
                identity: {
                    turnId: 'turn-old',
                    userMessageId: 'user-old',
                    assistantMessageId: 'assistant-old',
                },
                userText: 'Old question',
                assistantMarkdown: 'Old answer',
            },
            semanticDigest: 'old-page-turn',
            captureId: 'old-page-turn',
            revision: 1,
            predecessorAssistantMessageId: null,
        });
        const compiler: RenderedContentCompilerV2 = {
            compile: vi.fn(async () => ({
                kind: 'ready' as const,
                user: { markdown: 'New question', text: 'New question' },
                assistant: { markdown: 'New answer', text: 'New answer' },
                semanticDigest: 'new-page-turn',
                surfaceDigest: 'new-page-surface',
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
        const publishedKinds: string[] = [];
        const unsubscribe = repository.subscribe((state) => publishedKinds.push(state.kind));

        try {
            monitor.init();
            document.querySelector('main')!.innerHTML = '';
            await Promise.resolve();
            document.body.insertAdjacentHTML('beforeend', '<button data-testid="stop-button">Stop</button>');
            document.querySelector('main')!.innerHTML = `
                <section data-turn="user" data-turn-id="turn-new">
                    <div data-message-author-role="user" data-message-id="user-new">New question</div>
                </section>
                <section data-turn="assistant" data-turn-id="turn-new">
                    <div data-message-author-role="assistant" data-message-id="assistant-new">
                        <div class="markdown prose">New answer</div>
                    </div>
                    <div><button data-testid="copy-turn-action-button">Copy</button></div>
                </section>
            `;
            await Promise.resolve();

            expect(repository.read().snapshot?.turns.map((turn) => turn.identity.assistantMessageId)).toEqual([
                'assistant-old',
            ]);

            document.querySelector('button[data-testid="stop-button"]')?.remove();
            await Promise.resolve();
            await vi.advanceTimersByTimeAsync(400);
            await Promise.resolve();

            const state = repository.read();
            expect(state.snapshot?.turns.map((turn) => turn.identity.assistantMessageId)).toEqual([
                'assistant-new',
            ]);
            expect(publishedKinds).not.toContain('syncing');
        } finally {
            unsubscribe();
            monitor.dispose();
            repository.dispose();
            adapter.dispose();
        }
    });

    it('discards an in-flight host compile when a canonical conversation switches', async () => {
        let currentDocument: ConversationDocumentRefV1 | null = {
            key: createConversationDocumentKeyV1('chatgpt', 'conversation-a'),
            platformId: 'chatgpt',
            conversationId: 'conversation-a',
        };
        history.replaceState({}, '', '/c/conversation-a');
        const compilation = deferred<Awaited<ReturnType<RenderedContentCompilerV2['compile']>>>();
        const repository = new ConversationContentRepository({
            resolveDocument: () => currentDocument,
            readBaseline: async () => null,
        });
        const compiler: RenderedContentCompilerV2 = {
            compile: vi.fn(() => compilation.promise),
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
                <section data-turn="user" data-turn-id="turn-a">
                    <div data-message-author-role="user" data-message-id="user-a">Question A</div>
                </section>
                <section data-turn="assistant" data-turn-id="turn-a">
                    <div data-message-author-role="assistant" data-message-id="assistant-a">
                        <div class="markdown prose">Answer A</div>
                    </div>
                    <div><button data-testid="copy-turn-action-button">Copy</button></div>
                </section>
            `;
            await Promise.resolve();
            await vi.advanceTimersByTimeAsync(400);
            expect(compiler.compile).toHaveBeenCalledTimes(1);

            currentDocument = {
                key: createConversationDocumentKeyV1('chatgpt', 'conversation-b'),
                platformId: 'chatgpt',
                conversationId: 'conversation-b',
            };
            history.replaceState({}, '', '/c/conversation-b');
            monitor.notifyRouteChanged();
            compilation.resolve({
                kind: 'ready',
                user: { markdown: 'Question A', text: 'Question A' },
                assistant: { markdown: 'Answer A', text: 'Answer A' },
                semanticDigest: 'stale-a',
                surfaceDigest: 'stale-a-surface',
                manifest: {
                    nodeCount: 2,
                    formulaCount: 0,
                    codeBlockCount: 0,
                    tableCount: 0,
                    imageCount: 0,
                },
            });
            await Promise.resolve();
            await Promise.resolve();

            expect(repository.read()).toMatchObject({
                document: { conversationId: 'conversation-b' },
                snapshot: null,
            });
        } finally {
            monitor.dispose();
            repository.dispose();
            adapter.dispose();
        }
    });

    it('discards and replans an in-flight host compile when the conversation root is replaced', async () => {
        const currentDocument: ConversationDocumentRefV1 = {
            key: createConversationDocumentKeyV1('chatgpt', 'root-replacement-fence'),
            platformId: 'chatgpt',
            conversationId: 'root-replacement-fence',
        };
        history.replaceState({}, '', '/c/root-replacement-fence');
        document.querySelector('main')!.innerHTML = `
            <section data-turn="user" data-turn-id="turn-1">
                <div data-message-author-role="user" data-message-id="user-1">Question 1</div>
            </section>
            <section data-turn="assistant" data-turn-id="turn-1">
                <div data-message-author-role="assistant" data-message-id="assistant-1">
                    <div class="markdown prose">Answer 1</div>
                </div>
                <div><button data-testid="copy-turn-action-button">Copy</button></div>
            </section>
        `;
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
        const compilation = deferred<Awaited<ReturnType<RenderedContentCompilerV2['compile']>>>();
        const readyResult = {
            kind: 'ready' as const,
            user: { markdown: 'Question 2', text: 'Question 2' },
            assistant: { markdown: 'Answer 2', text: 'Answer 2' },
            semanticDigest: 'root-replacement-fence-2',
            surfaceDigest: 'root-replacement-fence-2-surface',
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
                .mockImplementationOnce(() => compilation.promise)
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

        const mountedWindow = () => `
            <section data-turn="user" data-turn-id="turn-1">
                <div data-message-author-role="user" data-message-id="user-1">Question 1</div>
            </section>
            <section data-turn="assistant" data-turn-id="turn-1">
                <div data-message-author-role="assistant" data-message-id="assistant-1">
                    <div class="markdown prose">Answer 1</div>
                </div>
                <div><button data-testid="copy-turn-action-button">Copy</button></div>
            </section>
            <section data-turn="user" data-turn-id="turn-2">
                <div data-message-author-role="user" data-message-id="user-2">Question 2</div>
            </section>
            <section data-turn="assistant" data-turn-id="turn-2">
                <div data-message-author-role="assistant" data-message-id="assistant-2">
                    <div class="markdown prose">Answer 2</div>
                </div>
                <div><button data-testid="copy-turn-action-button">Copy</button></div>
            </section>
        `;

        try {
            monitor.init();
            await repository.enterCurrentEpoch();
            document.querySelector('main')!.innerHTML = mountedWindow();
            await Promise.resolve();
            await vi.advanceTimersByTimeAsync(400);
            expect(compiler.compile).toHaveBeenCalledTimes(1);

            const replacementMain = document.createElement('main');
            replacementMain.innerHTML = mountedWindow();
            document.querySelector('main')!.replaceWith(replacementMain);
            await Promise.resolve();

            compilation.resolve(readyResult);
            await Promise.resolve();
            await Promise.resolve();
            expect(repository.read().snapshot?.turns).toHaveLength(1);

            await vi.advanceTimersByTimeAsync(400);
            await Promise.resolve();
            expect(compiler.compile).toHaveBeenCalledTimes(2);
            expect(repository.read().snapshot?.turns.map((turn) => turn.identity.assistantMessageId)).toEqual([
                'assistant-1',
                'assistant-2',
            ]);
        } finally {
            monitor.dispose();
            repository.dispose();
            adapter.dispose();
        }
    });

    it('replans an in-flight host compile when the maintained content token changes', async () => {
        const currentDocument: ConversationDocumentRefV1 = {
            key: createConversationDocumentKeyV1('chatgpt', 'content-token-fence'),
            platformId: 'chatgpt',
            conversationId: 'content-token-fence',
        };
        history.replaceState({}, '', '/c/content-token-fence');
        document.querySelector('main')!.innerHTML = `
            <section data-turn="user" data-turn-id="turn-1">
                <div data-message-author-role="user" data-message-id="user-1">Question 1</div>
            </section>
            <section data-turn="assistant" data-turn-id="turn-1">
                <div data-message-author-role="assistant" data-message-id="assistant-1">
                    <div class="markdown prose">Answer 1</div>
                </div>
                <div><button data-testid="copy-turn-action-button">Copy</button></div>
            </section>
        `;
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
        const compilation = deferred<Awaited<ReturnType<RenderedContentCompilerV2['compile']>>>();
        const readyResult = {
            kind: 'ready' as const,
            user: { markdown: 'Question 3', text: 'Question 3' },
            assistant: { markdown: 'Answer 3', text: 'Answer 3' },
            semanticDigest: 'content-token-fence-3',
            surfaceDigest: 'content-token-fence-3-surface',
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
                .mockImplementationOnce(() => compilation.promise)
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
            monitor.init();
            await repository.enterCurrentEpoch();
            document.body.insertAdjacentHTML('beforeend', '<button data-testid="stop-button">Stop</button>');
            document.querySelector('main')!.insertAdjacentHTML('beforeend', `
                <section data-turn="user" data-turn-id="turn-3">
                    <div data-message-author-role="user" data-message-id="user-3">Question 3</div>
                </section>
                <section data-turn="assistant" data-turn-id="turn-3">
                    <div data-message-author-role="assistant" data-message-id="assistant-3">
                        <div class="markdown prose">Answer 3</div>
                    </div>
                    <div><button data-testid="copy-turn-action-button">Copy</button></div>
                </section>
            `);
            await Promise.resolve();
            document.querySelector('button[data-testid="stop-button"]')?.remove();
            await Promise.resolve();
            await vi.advanceTimersByTimeAsync(400);
            expect(compiler.compile).toHaveBeenCalledTimes(1);

            repository.ingestHostTurn({
                turn: {
                    key: 'turn-2:assistant-2',
                    ordinal: 2,
                    identity: {
                        turnId: 'turn-2',
                        userMessageId: 'user-2',
                        assistantMessageId: 'assistant-2',
                    },
                    userText: 'Question 2',
                    assistantMarkdown: 'Answer 2',
                },
                semanticDigest: 'content-token-fence-2',
                captureId: 'content-token-fence-2',
                revision: 2,
                predecessorAssistantMessageId: 'assistant-1',
            });
            compilation.resolve(readyResult);
            await Promise.resolve();
            await Promise.resolve();
            await vi.advanceTimersByTimeAsync(400);
            await Promise.resolve();

            expect(compiler.compile).toHaveBeenCalledTimes(2);
            expect(repository.read().snapshot?.turns.map((turn) => turn.identity.assistantMessageId)).toEqual([
                'assistant-1',
                'assistant-2',
                'assistant-3',
            ]);
        } finally {
            monitor.dispose();
            repository.dispose();
            adapter.dispose();
        }
    });

    it('publishes existing-page DOM immediately and preserves it when the baseline arrives', async () => {
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

            expect(repository.read()).toMatchObject({
                kind: 'ready',
                snapshot: {
                    proof: { basis: 'host' },
                    turns: [{ assistantMarkdown: 'Visible answer' }],
                },
            });

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
            expect(ready.snapshot.proof).toEqual({ basis: 'hybrid' });
            expect(ready.snapshot.turns[0]?.assistantMarkdown).toBe('Visible answer');
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
            document.body.insertAdjacentHTML('beforeend', '<button data-testid="stop-button">Stop</button>');
            appendRound(2);
            await Promise.resolve();
            document.querySelector('button[data-testid="stop-button"]')?.remove();
            await Promise.resolve();
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

    it('appends a new tail whose persistent slots hydrate across separate mutation batches', async () => {
        const currentDocument: ConversationDocumentRefV1 = {
            key: createConversationDocumentKeyV1('chatgpt', 'split-hydration-tail'),
            platformId: 'chatgpt',
            conversationId: 'split-hydration-tail',
        };
        document.querySelector('main')!.innerHTML = `
            <div data-turn-id-container="user-slot-1">
                <section data-turn="user" data-turn-id="turn-1">
                    <div data-message-author-role="user" data-message-id="user-1">Question 1</div>
                </section>
            </div>
            <div data-turn-id-container="assistant-slot-1">
                <section data-turn="assistant" data-turn-id="turn-1">
                    <div data-message-author-role="assistant" data-message-id="assistant-1">
                        <div class="markdown prose">Answer 1</div>
                    </div>
                    <div><button data-testid="copy-turn-action-button">Copy</button></div>
                </section>
            </div>
        `;
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
        const compiler: RenderedContentCompilerV2 = {
            compile: vi.fn(async () => ({
                kind: 'ready' as const,
                user: { markdown: 'Question 2', text: 'Question 2' },
                assistant: { markdown: 'Answer 2', text: 'Answer 2' },
                semanticDigest: 'split-hydration-tail-2',
                surfaceDigest: 'split-hydration-tail-2-surface',
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
            await repository.enterCurrentEpoch();

            const main = document.querySelector('main')!;
            main.insertAdjacentHTML('beforeend', `
                <div id="user-slot-2" data-turn-id-container="user-slot-2"></div>
                <div id="assistant-slot-2" data-turn-id-container="assistant-slot-2"></div>
            `);
            await Promise.resolve();

            document.getElementById('user-slot-2')!.innerHTML = `
                <section data-turn="user" data-turn-id="turn-2">
                    <div data-message-author-role="user" data-message-id="user-2">Question 2</div>
                </section>
            `;
            await Promise.resolve();

            document.getElementById('assistant-slot-2')!.innerHTML = `
                <section data-turn="assistant" data-turn-id="turn-2">
                    <div data-message-author-role="assistant" data-message-id="assistant-2">
                        <div class="markdown prose">Answer 2</div>
                    </div>
                </section>
            `;
            await Promise.resolve();

            document.querySelector('#assistant-slot-2 section')!.insertAdjacentHTML(
                'beforeend',
                '<div><button data-testid="copy-turn-action-button">Copy</button></div>',
            );
            await Promise.resolve();
            await vi.advanceTimersByTimeAsync(400);
            await Promise.resolve();

            expect(compiler.compile).toHaveBeenCalledTimes(1);
            expect(repository.read().snapshot?.turns.map((turn) => turn.identity.assistantMessageId)).toEqual([
                'assistant-1',
                'assistant-2',
            ]);
        } finally {
            monitor.dispose();
            repository.dispose();
            adapter.dispose();
        }
    });

    it('does not append a complete replacement subtree without tail overlap or generation evidence', async () => {
        const currentDocument: ConversationDocumentRefV1 = {
            key: createConversationDocumentKeyV1('chatgpt', 'replacement-subtree'),
            platformId: 'chatgpt',
            conversationId: 'replacement-subtree',
        };
        document.querySelector('main')!.innerHTML = `
            <section data-turn="user" data-turn-id="turn-1">
                <div data-message-author-role="user" data-message-id="user-1">Question 1</div>
            </section>
            <section data-turn="assistant" data-turn-id="turn-1">
                <div data-message-author-role="assistant" data-message-id="assistant-1">
                    <div class="markdown prose">Answer 1</div>
                </div>
                <div><button data-testid="copy-turn-action-button">Copy</button></div>
            </section>
        `;
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
        const compiler: RenderedContentCompilerV2 = {
            compile: vi.fn(async () => ({
                kind: 'ready' as const,
                user: { markdown: 'Replacement question', text: 'Replacement question' },
                assistant: { markdown: 'Replacement answer', text: 'Replacement answer' },
                semanticDigest: 'replacement-subtree',
                surfaceDigest: 'replacement-subtree-surface',
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
            await repository.enterCurrentEpoch();
            document.querySelector('main')!.innerHTML = `
                <section data-turn="user" data-turn-id="turn-replacement">
                    <div data-message-author-role="user" data-message-id="user-replacement">Replacement question</div>
                </section>
                <section data-turn="assistant" data-turn-id="turn-replacement">
                    <div data-message-author-role="assistant" data-message-id="assistant-replacement">
                        <div class="markdown prose">Replacement answer</div>
                    </div>
                    <div><button data-testid="copy-turn-action-button">Copy</button></div>
                </section>
            `;
            await Promise.resolve();
            await vi.advanceTimersByTimeAsync(400);
            await Promise.resolve();

            expect(compiler.compile).not.toHaveBeenCalled();
            expect(repository.read().snapshot?.turns.map((turn) => turn.identity.assistantMessageId)).toEqual([
                'assistant-1',
            ]);
        } finally {
            monitor.dispose();
            repository.dispose();
            adapter.dispose();
        }
    });

    it('commits a generated tail before the official action row mounts', async () => {
        const currentDocument: ConversationDocumentRefV1 = {
            key: createConversationDocumentKeyV1('chatgpt', 'late-action-row'),
            platformId: 'chatgpt',
            conversationId: 'late-action-row',
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
        const compiler: RenderedContentCompilerV2 = {
            compile: vi.fn(async () => ({
                kind: 'ready' as const,
                user: { markdown: 'Question 2', text: 'Question 2' },
                assistant: { markdown: 'Answer 2', text: 'Answer 2' },
                semanticDigest: 'late-action-row-2',
                surfaceDigest: 'late-action-row-2-surface',
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
            await repository.enterCurrentEpoch();
            document.body.insertAdjacentHTML('beforeend', '<button data-testid="stop-button">Stop</button>');
            document.querySelector('main')!.innerHTML = `
                <section data-turn="user" data-turn-id="turn-2">
                    <div data-message-author-role="user" data-message-id="user-2">Question 2</div>
                </section>
                <section data-turn="assistant" data-turn-id="turn-2">
                    <div data-message-author-role="assistant" data-message-id="assistant-2">
                        <div class="markdown prose">Answer 2</div>
                    </div>
                </section>
            `;
            await Promise.resolve();
            document.querySelector('button[data-testid="stop-button"]')?.remove();
            await Promise.resolve();
            await vi.advanceTimersByTimeAsync(400);
            await Promise.resolve();

            expect(compiler.compile).toHaveBeenCalledTimes(1);
            expect(repository.read().snapshot?.turns.map((turn) => turn.identity.assistantMessageId)).toEqual([
                'assistant-1',
                'assistant-2',
            ]);
        } finally {
            monitor.dispose();
            repository.dispose();
            adapter.dispose();
        }
    });

    it('uses a longer stable confirmation when no completion signal is available', async () => {
        const currentDocument: ConversationDocumentRefV1 = {
            key: createConversationDocumentKeyV1('chatgpt', 'weak-completion'),
            platformId: 'chatgpt',
            conversationId: 'weak-completion',
        };
        document.querySelector('main')!.innerHTML = `
            <section data-turn="user" data-turn-id="turn-1">
                <div data-message-author-role="user" data-message-id="user-1">Question 1</div>
            </section>
            <section data-turn="assistant" data-turn-id="turn-1">
                <div data-message-author-role="assistant" data-message-id="assistant-1">
                    <div class="markdown prose">Answer 1</div>
                </div>
                <div><button data-testid="copy-turn-action-button">Copy</button></div>
            </section>
        `;
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
        const compiler: RenderedContentCompilerV2 = {
            compile: vi.fn(async () => ({
                kind: 'ready' as const,
                user: { markdown: 'Question 2', text: 'Question 2' },
                assistant: { markdown: 'Answer 2', text: 'Answer 2' },
                semanticDigest: 'weak-completion-2',
                surfaceDigest: 'weak-completion-2-surface',
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
            await repository.enterCurrentEpoch();
            document.querySelector('main')!.insertAdjacentHTML('beforeend', `
                <section data-turn="user" data-turn-id="turn-2">
                    <div data-message-author-role="user" data-message-id="user-2">Question 2</div>
                </section>
                <section data-turn="assistant" data-turn-id="turn-2">
                    <div data-message-author-role="assistant" data-message-id="assistant-2">
                        <div class="markdown prose">Answer 2</div>
                    </div>
                </section>
            `);
            await Promise.resolve();
            await vi.advanceTimersByTimeAsync(400);
            await Promise.resolve();
            expect(compiler.compile).not.toHaveBeenCalled();

            await vi.advanceTimersByTimeAsync(1_599);
            expect(compiler.compile).not.toHaveBeenCalled();
            await vi.advanceTimersByTimeAsync(1);
            await Promise.resolve();

            expect(compiler.compile).toHaveBeenCalledTimes(1);
            expect(repository.read().snapshot?.turns).toHaveLength(2);
        } finally {
            monitor.dispose();
            repository.dispose();
            adapter.dispose();
        }
    });

    it('does not compile past an unresolved round after the maintained tail', async () => {
        const currentDocument: ConversationDocumentRefV1 = {
            key: createConversationDocumentKeyV1('chatgpt', 'unresolved-tail-gap'),
            platformId: 'chatgpt',
            conversationId: 'unresolved-tail-gap',
        };
        document.querySelector('main')!.innerHTML = `
            <section data-turn="user" data-turn-id="turn-1">
                <div data-message-author-role="user" data-message-id="user-1">Question 1</div>
            </section>
            <section data-turn="assistant" data-turn-id="turn-1">
                <div data-message-author-role="assistant" data-message-id="assistant-1">
                    <div class="markdown prose">Answer 1</div>
                </div>
                <div><button data-testid="copy-turn-action-button">Copy</button></div>
            </section>
        `;
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
        const compiler: RenderedContentCompilerV2 = {
            compile: vi.fn(async () => ({
                kind: 'ready' as const,
                user: { markdown: 'Question 3', text: 'Question 3' },
                assistant: { markdown: 'Answer 3', text: 'Answer 3' },
                semanticDigest: 'unresolved-tail-gap-3',
                surfaceDigest: 'unresolved-tail-gap-3-surface',
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
            await repository.enterCurrentEpoch();
            document.querySelector('main')!.insertAdjacentHTML('beforeend', `
                <div data-virtualized-placeholder></div>
                <section data-turn="assistant" data-turn-id="turn-2">
                    <div data-message-author-role="assistant" data-message-id="assistant-2">
                        <div class="markdown prose">Unresolved answer 2</div>
                    </div>
                </section>
                <section data-turn="user" data-turn-id="turn-3">
                    <div data-message-author-role="user" data-message-id="user-3">Question 3</div>
                </section>
                <section data-turn="assistant" data-turn-id="turn-3">
                    <div data-message-author-role="assistant" data-message-id="assistant-3">
                        <div class="markdown prose">Answer 3</div>
                    </div>
                    <div><button data-testid="copy-turn-action-button">Copy</button></div>
                </section>
            `);
            await Promise.resolve();
            await vi.advanceTimersByTimeAsync(400);
            await Promise.resolve();

            expect(compiler.compile).not.toHaveBeenCalled();
            expect(repository.read().snapshot?.turns).toHaveLength(1);
        } finally {
            monitor.dispose();
            repository.dispose();
            adapter.dispose();
        }
    });

    it('anchors a generated tail to the maintained pool when only older history is mounted', async () => {
        const currentDocument: ConversationDocumentRefV1 = {
            key: createConversationDocumentKeyV1('chatgpt', 'generated-after-mounted-history'),
            platformId: 'chatgpt',
            conversationId: 'generated-after-mounted-history',
        };
        document.querySelector('main')!.innerHTML = `
            <section data-turn="user" data-turn-id="turn-1">
                <div data-message-author-role="user" data-message-id="user-1">Question 1</div>
            </section>
            <section data-turn="assistant" data-turn-id="turn-1">
                <div data-message-author-role="assistant" data-message-id="assistant-1">
                    <div class="markdown prose">Answer 1</div>
                </div>
                <div><button data-testid="copy-turn-action-button">Copy</button></div>
            </section>
        `;
        const repository = new ConversationContentRepository({
            resolveDocument: () => currentDocument,
            readBaseline: async () => ({
                document: currentDocument,
                coverage: 'complete' as const,
                turns: [1, 2].map((index) => ({
                    key: `turn-${index}:assistant-${index}`,
                    ordinal: index,
                    identity: {
                        turnId: `turn-${index}`,
                        userMessageId: `user-${index}`,
                        assistantMessageId: `assistant-${index}`,
                    },
                    userText: `Question ${index}`,
                    assistantMarkdown: `Answer ${index}`,
                })),
            }),
        });
        const compiler: RenderedContentCompilerV2 = {
            compile: vi.fn(async () => ({
                kind: 'ready' as const,
                user: { markdown: 'Question 3', text: 'Question 3' },
                assistant: { markdown: 'Answer 3', text: 'Answer 3' },
                semanticDigest: 'generated-after-mounted-history-3',
                surfaceDigest: 'generated-after-mounted-history-3-surface',
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
            await repository.enterCurrentEpoch();
            document.body.insertAdjacentHTML('beforeend', '<button data-testid="stop-button">Stop</button>');
            document.querySelector('main')!.insertAdjacentHTML('beforeend', `
                <section data-turn="user" data-turn-id="turn-3">
                    <div data-message-author-role="user" data-message-id="user-3">Question 3</div>
                </section>
                <section data-turn="assistant" data-turn-id="turn-3">
                    <div data-message-author-role="assistant" data-message-id="assistant-3">
                        <div class="markdown prose">Answer 3</div>
                    </div>
                    <div><button data-testid="copy-turn-action-button">Copy</button></div>
                </section>
            `);
            await Promise.resolve();
            document.querySelector('button[data-testid="stop-button"]')?.remove();
            await Promise.resolve();
            await vi.advanceTimersByTimeAsync(400);
            await Promise.resolve();

            expect(repository.read().snapshot?.turns.map((turn) => turn.identity.assistantMessageId)).toEqual([
                'assistant-1',
                'assistant-2',
                'assistant-3',
            ]);
        } finally {
            monitor.dispose();
            repository.dispose();
            adapter.dispose();
        }
    });

    it('defers a generated candidate that appears before the uniquely mounted pool tail', async () => {
        const currentDocument: ConversationDocumentRefV1 = {
            key: createConversationDocumentKeyV1('chatgpt', 'generated-before-mounted-tail'),
            platformId: 'chatgpt',
            conversationId: 'generated-before-mounted-tail',
        };
        document.querySelector('main')!.innerHTML = `
            <section data-turn="user" data-turn-id="turn-1">
                <div data-message-author-role="user" data-message-id="user-1">Question 1</div>
            </section>
            <section data-turn="assistant" data-turn-id="turn-1">
                <div data-message-author-role="assistant" data-message-id="assistant-1">
                    <div class="markdown prose">Answer 1</div>
                </div>
                <div><button data-testid="copy-turn-action-button">Copy</button></div>
            </section>
        `;
        const repository = new ConversationContentRepository({
            resolveDocument: () => currentDocument,
            readBaseline: async () => ({
                document: currentDocument,
                coverage: 'complete' as const,
                turns: [1, 2].map((index) => ({
                    key: `turn-${index}:assistant-${index}`,
                    ordinal: index,
                    identity: {
                        turnId: `turn-${index}`,
                        userMessageId: `user-${index}`,
                        assistantMessageId: `assistant-${index}`,
                    },
                    userText: `Question ${index}`,
                    assistantMarkdown: `Answer ${index}`,
                })),
            }),
        });
        const compiler: RenderedContentCompilerV2 = {
            compile: vi.fn(async () => ({
                kind: 'ready' as const,
                user: { markdown: 'Question 3', text: 'Question 3' },
                assistant: { markdown: 'Answer 3', text: 'Answer 3' },
                semanticDigest: 'generated-before-mounted-tail-3',
                surfaceDigest: 'generated-before-mounted-tail-3-surface',
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
            await repository.enterCurrentEpoch();
            document.body.insertAdjacentHTML('beforeend', '<button data-testid="stop-button">Stop</button>');
            document.querySelector('main')!.insertAdjacentHTML('beforeend', `
                <section data-turn="user" data-turn-id="turn-3">
                    <div data-message-author-role="user" data-message-id="user-3">Question 3</div>
                </section>
                <section data-turn="assistant" data-turn-id="turn-3">
                    <div data-message-author-role="assistant" data-message-id="assistant-3">
                        <div class="markdown prose">Answer 3</div>
                    </div>
                    <div><button data-testid="copy-turn-action-button">Copy</button></div>
                </section>
            `);
            await Promise.resolve();
            document.querySelector('main')!.insertAdjacentHTML('beforeend', `
                <section data-turn="user" data-turn-id="turn-2">
                    <div data-message-author-role="user" data-message-id="user-2">Question 2</div>
                </section>
                <section data-turn="assistant" data-turn-id="turn-2">
                    <div data-message-author-role="assistant" data-message-id="assistant-2">
                        <div class="markdown prose">Answer 2</div>
                    </div>
                    <div><button data-testid="copy-turn-action-button">Copy</button></div>
                </section>
            `);
            document.querySelector('button[data-testid="stop-button"]')?.remove();
            await Promise.resolve();
            await vi.advanceTimersByTimeAsync(400);
            await Promise.resolve();

            expect(compiler.compile).not.toHaveBeenCalled();
            expect(repository.read().snapshot?.turns.map((turn) => turn.identity.assistantMessageId)).toEqual([
                'assistant-1',
                'assistant-2',
            ]);
        } finally {
            monitor.dispose();
            repository.dispose();
            adapter.dispose();
        }
    });

    it('appends a new assistant identity that replaces the maintained tail slot', async () => {
        const currentDocument: ConversationDocumentRefV1 = {
            key: createConversationDocumentKeyV1('chatgpt', 'tail-identity-replacement'),
            platformId: 'chatgpt',
            conversationId: 'tail-identity-replacement',
        };
        document.querySelector('main')!.innerHTML = `
            <div data-turn-id-container="user-slot">
                <section data-turn="user" data-turn-id="turn-1">
                    <div data-message-author-role="user" data-message-id="user-1">Question 1</div>
                </section>
            </div>
            <div data-turn-id-container="assistant-slot">
                <section data-turn="assistant" data-turn-id="turn-1">
                    <div data-message-author-role="assistant" data-message-id="assistant-1">
                        <div class="markdown prose">Answer 1</div>
                    </div>
                    <div><button data-testid="copy-turn-action-button">Copy</button></div>
                </section>
            </div>
        `;
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
        const compiler: RenderedContentCompilerV2 = {
            compile: vi.fn(async () => ({
                kind: 'ready' as const,
                user: { markdown: 'Question 2', text: 'Question 2' },
                assistant: { markdown: 'Answer 2', text: 'Answer 2' },
                semanticDigest: 'tail-identity-replacement-2',
                surfaceDigest: 'tail-identity-replacement-2-surface',
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
            await repository.enterCurrentEpoch();
            const userTurn = document.querySelector<HTMLElement>('[data-turn="user"]')!;
            const userMessage = document.querySelector<HTMLElement>('[data-message-author-role="user"]')!;
            const assistantTurn = document.querySelector<HTMLElement>('[data-turn="assistant"]')!;
            const assistantMessage = document.querySelector<HTMLElement>('[data-message-author-role="assistant"]')!;
            userTurn.dataset.turnId = 'turn-2';
            userMessage.dataset.messageId = 'user-2';
            userMessage.textContent = 'Question 2';
            assistantTurn.dataset.turnId = 'turn-2';
            assistantMessage.dataset.messageId = 'assistant-2';
            assistantMessage.querySelector('.markdown')!.textContent = 'Answer 2';
            await Promise.resolve();
            await vi.advanceTimersByTimeAsync(400);
            await Promise.resolve();

            expect(repository.read().snapshot?.turns.map((turn) => turn.identity.assistantMessageId)).toEqual([
                'assistant-1',
                'assistant-2',
            ]);
        } finally {
            monitor.dispose();
            repository.dispose();
            adapter.dispose();
        }
    });

    it('does not append an older round that is merely hydrated into existing virtual slots', async () => {
        const currentDocument: ConversationDocumentRefV1 = {
            key: createConversationDocumentKeyV1('chatgpt', 'virtualized-old-history'),
            platformId: 'chatgpt',
            conversationId: 'virtualized-old-history',
        };
        document.body.innerHTML = `
            <main>
                <div id="old-user-slot" data-turn-id-container="old-user"></div>
                <div id="old-assistant-slot" data-turn-id-container="old-assistant"></div>
            </main>
        `;
        const repository = new ConversationContentRepository({
            resolveDocument: () => currentDocument,
            readBaseline: async () => ({
                document: currentDocument,
                coverage: 'complete' as const,
                turns: [{
                    key: 'turn-2:assistant-2',
                    ordinal: 1,
                    identity: {
                        turnId: 'turn-2',
                        userMessageId: 'user-2',
                        assistantMessageId: 'assistant-2',
                    },
                    userText: 'Current question',
                    assistantMarkdown: 'Current answer',
                }],
            }),
        });
        const compiler: RenderedContentCompilerV2 = {
            compile: vi.fn(async () => ({
                kind: 'ready' as const,
                user: { markdown: 'Old question', text: 'Old question' },
                assistant: { markdown: 'Old answer', text: 'Old answer' },
                semanticDigest: 'old-history',
                surfaceDigest: 'old-history-surface',
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
            await repository.enterCurrentEpoch();
            document.getElementById('old-user-slot')!.innerHTML = `
                <section data-turn="user" data-turn-id="turn-old">
                    <div data-message-author-role="user" data-message-id="user-old">Old question</div>
                </section>
            `;
            document.getElementById('old-assistant-slot')!.innerHTML = `
                <section data-turn="assistant" data-turn-id="turn-old">
                    <div data-message-author-role="assistant" data-message-id="assistant-old">
                        <div class="markdown prose">Old answer</div>
                    </div>
                    <div><button data-testid="copy-turn-action-button">Copy</button></div>
                </section>
            `;
            await vi.advanceTimersByTimeAsync(400);
            await Promise.resolve();

            expect(compiler.compile).not.toHaveBeenCalled();
            expect(repository.read().snapshot?.turns.map((turn) => turn.identity.assistantMessageId)).toEqual([
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
                <section data-testid="conversation-turn-1" data-turn="user" data-turn-id="turn-1">
                    <div data-message-author-role="user" data-message-id="user-1">Question 1</div>
                </section>
                <section data-testid="conversation-turn-2" data-turn="assistant" data-turn-id="turn-1">
                    <div data-message-author-role="assistant" data-message-id="assistant-1">
                        <div class="markdown prose">Answer 1</div>
                    </div>
                    <div><button data-testid="copy-turn-action-button">Copy</button></div>
                </section>
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

            document.querySelectorAll('.markdown.prose')[1]!.textContent = 'Answer 2 revised';
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
