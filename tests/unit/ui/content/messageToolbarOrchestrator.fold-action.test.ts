import { describe, expect, it, vi } from 'vitest';
vi.mock('@/ui/content/export/SaveMessagesDialog', () => ({
    saveMessagesDialog: {
        open: vi.fn(),
    },
}));
vi.mock('@/ui/content/bookmarks/save/bookmarkSaveDialogSingleton', () => ({
    bookmarkSaveDialog: {
        open: vi.fn(),
        setTheme: vi.fn(),
    },
}));
import { ChatGPTAdapter } from '@/drivers/content/adapters/sites/chatgpt';
import { MessageToolbarOrchestrator } from '@/ui/content/controllers/MessageToolbarOrchestrator';
import { SiteAdapter, type ThemeDetector } from '@/drivers/content/adapters/base';
import { saveMessagesDialog } from '@/ui/content/export/SaveMessagesDialog';
import { bookmarkSaveDialog } from '@/ui/content/bookmarks/save/bookmarkSaveDialogSingleton';

const detector: ThemeDetector = {
    detect: () => 'light',
    getObserveTargets: () => [],
    hasExplicitTheme: () => true,
};

class UnknownAdapter extends SiteAdapter {
    matches(): boolean { return true; }
    getPlatformId(): string { return 'unknown'; }
    getThemeDetector(): ThemeDetector { return detector; }
    extractUserPrompt(): string | null { return 'Prompt'; }
    getMessageSelector(): string { return '.assistant-message'; }
    getMessageContentSelector(): string { return '.content'; }
    getActionBarSelector(): string { return '.official-toolbar button'; }
    getToolbarAnchorElement(messageElement: HTMLElement): HTMLElement | null {
        const anchor = messageElement.querySelector('.official-toolbar');
        return anchor instanceof HTMLElement ? anchor : null;
    }
    injectToolbar(messageElement: HTMLElement, toolbarHost: HTMLElement): boolean {
        const anchor = this.getToolbarAnchorElement(messageElement);
        if (!anchor) return false;
        anchor.appendChild(toolbarHost);
        return true;
    }
    isStreamingMessage(): boolean { return false; }
    getMessageId(messageElement: HTMLElement): string | null { return messageElement.getAttribute('data-message-id'); }
    getObserverContainer(): HTMLElement | null { return document.body; }
}

describe('MessageToolbarOrchestrator ChatGPT reader path', () => {
    function buildVirtualizedChatGptSnapshot() {
        return {
            conversationId: 'conv-1',
            buildFingerprint: 'build-1',
            capturedAt: Date.now(),
            source: 'runtime-bridge',
            rounds: [
                {
                    id: 'round-1',
                    position: 1,
                    userPrompt: 'Question 1',
                    assistantContent: 'Answer 1',
                    preview: 'Question 1',
                    messageId: 'payload-a1',
                    userMessageId: 'u1',
                    assistantMessageId: 'payload-a1',
                },
                {
                    id: 'round-2',
                    position: 2,
                    userPrompt: 'Question 2',
                    assistantContent: 'Answer 2',
                    preview: 'Question 2',
                    messageId: 'payload-a2',
                    userMessageId: 'u2',
                    assistantMessageId: 'payload-a2',
                },
                {
                    id: 'round-50',
                    position: 50,
                    userPrompt: 'Question 50',
                    assistantContent: 'Answer 50',
                    preview: 'Question 50',
                    messageId: 'payload-a50',
                    userMessageId: 'u50',
                    assistantMessageId: 'payload-a50',
                },
            ],
        };
    }

    function renderVirtualizedChatGptBookmarkDom(): void {
        const previousTurns = Array.from({ length: 49 }, (_value, index) => {
            const position = index + 1;
            return `
              <div data-turn-id-container id="user-${position}">
                <section data-turn="user"></section>
              </div>
              <div data-turn-id-container id="assistant-${position}">
                <section data-turn="assistant"></section>
              </div>
            `;
        }).join('');

        document.body.innerHTML = `
          <div id="thread">
            ${previousTurns}
            <div data-turn-id-container id="user-50">
              <section data-turn="user">
                <div data-message-author-role="user">
                  <div class="whitespace-pre-wrap">Question 50</div>
                </div>
              </section>
            </div>
            <div data-turn-id-container id="assistant-50">
              <section data-turn="assistant">
                <div data-message-author-role="assistant" data-message-id="dom-wrapper-id" data-aimd-msg-position="2">
                  <div class="markdown prose">Visible answer</div>
                </div>
                <div class="z-0 flex">
                  <div><button data-testid="copy-turn-action-button">copy</button></div>
                </div>
              </section>
            </div>
          </div>
        `;
    }

    it('uses the shared fresh ChatGPT Reader source when opening Reader from a visible message', async () => {
        document.body.innerHTML = `
          <div id="thread">
            <article data-turn="user">
              <div data-message-author-role="user">
                <div class="whitespace-pre-wrap">Hello from user</div>
              </div>
            </article>
            <article data-turn="assistant">
              <div data-message-author-role="assistant" data-message-id="a1">
                <div class="markdown prose">Hi</div>
              </div>
              <div class="z-0 flex">
                <div><button data-testid="copy-turn-action-button">copy</button></div>
              </div>
            </article>
          </div>
        `;

        const adapter = new ChatGPTAdapter();
        let shownItems: any[] = [];
        const readerPanel = {
            show: vi.fn(async (items: any[]) => {
                shownItems = items;
            }),
        } as any;
        const chatGptConversationEngine = {
            getSnapshot: vi.fn(async () => ({
                conversationId: 'conv-1',
                buildFingerprint: 'build-1',
                capturedAt: Date.now(),
                source: 'runtime-bridge',
                rounds: [
                    {
                        id: 'round-1',
                        position: 1,
                        userPrompt: 'Hello from user',
                        assistantContent: 'Formula: \\(x = y + z\\)',
                        preview: 'Hello from user',
                        messageId: 'a1',
                        userMessageId: 'u1',
                        assistantMessageId: 'a1',
                    },
                ],
            })),
            forceRefreshCurrentConversation: vi.fn(async () => ({
                conversationId: 'conv-1',
                buildFingerprint: 'build-1',
                capturedAt: Date.now(),
                source: 'runtime-bridge',
                rounds: [
                    {
                        id: 'round-1',
                        position: 1,
                        userPrompt: 'Hello from user',
                        assistantContent: 'Formula: \\(x = y + z\\)',
                        preview: 'Hello from user',
                        messageId: 'a1',
                        userMessageId: 'u1',
                        assistantMessageId: 'a1',
                    },
                ],
            })),
        } as any;
        const orchestrator = new MessageToolbarOrchestrator(adapter, { readerPanel, chatGptConversationEngine });

        const assistant = document.querySelector('[data-message-author-role="assistant"][data-message-id]') as HTMLElement;
        const actions = (orchestrator as any).getActionsForMessage(assistant, () => null);
        const readerAction = actions.find((action: any) => action.id === 'reader');

        await readerAction.onClick();

        expect(chatGptConversationEngine.getSnapshot).not.toHaveBeenCalled();
        expect(chatGptConversationEngine.forceRefreshCurrentConversation).toHaveBeenCalledTimes(1);
        expect(readerPanel.show).toHaveBeenCalledWith(
            [
                expect.objectContaining({
                    userPrompt: 'Hello from user',
                    meta: expect.objectContaining({
                        platformId: 'chatgpt',
                        messageId: 'a1',
                        position: 1,
                    }),
                }),
            ],
            0,
            expect.any(String),
            expect.objectContaining({ profile: 'conversation-reader' }),
        );
        await expect(shownItems[0].content()).resolves.toBe('Formula: $x = y + z$');
    });

    it('adds the shared Reader refresh action to the in-page Reader and refreshes through the Reader source', async () => {
        document.body.innerHTML = `
          <div id="thread">
            <article data-turn="user">
              <div data-message-author-role="user">
                <div class="whitespace-pre-wrap">Hello from user</div>
              </div>
            </article>
            <article data-turn="assistant">
              <div data-message-author-role="assistant" data-message-id="a1">
                <div class="markdown prose">Initial visible answer</div>
              </div>
              <div class="z-0 flex">
                <div><button data-testid="copy-turn-action-button">copy</button></div>
              </div>
            </article>
          </div>
        `;

        const initialSnapshot = {
            conversationId: 'conv-1',
            buildFingerprint: 'build-1',
            capturedAt: Date.now(),
            source: 'runtime-bridge',
            rounds: [
                {
                    id: 'round-1',
                    position: 1,
                    userPrompt: 'Hello from user',
                    assistantContent: 'Initial answer',
                    preview: 'Hello from user',
                    messageId: 'a1',
                    userMessageId: 'u1',
                    assistantMessageId: 'a1',
                },
            ],
        };
        const refreshedSnapshot = {
            ...initialSnapshot,
            capturedAt: Date.now() + 1,
            rounds: [
                {
                    ...initialSnapshot.rounds[0],
                    assistantContent: 'Refreshed answer with \\(x+y\\)',
                },
            ],
        };

        const adapter = new ChatGPTAdapter();
        let shownItems: any[] = [];
        const readerPanel = {
            show: vi.fn(async (items: any[]) => {
                shownItems = items;
            }),
            getCommentExportContext: vi.fn(() => null),
        } as any;
        const chatGptConversationEngine = {
            forceRefreshCurrentConversation: vi.fn()
                .mockResolvedValueOnce(initialSnapshot)
                .mockResolvedValueOnce(refreshedSnapshot),
        } as any;
        const orchestrator = new MessageToolbarOrchestrator(adapter, { readerPanel, chatGptConversationEngine });

        const assistant = document.querySelector('[data-message-author-role="assistant"][data-message-id]') as HTMLElement;
        const actions = (orchestrator as any).getActionsForMessage(assistant, () => null);
        const readerAction = actions.find((action: any) => action.id === 'reader');
        await readerAction.onClick();

        const options = readerPanel.show.mock.calls[0][3];
        const refreshAction = options.actions.find((action: any) => action.id === 'refresh');
        expect(refreshAction).toBeTruthy();

        await refreshAction.onClick({
            item: shownItems[0],
            index: 0,
            items: shownItems,
            notify: vi.fn(),
            rerender: vi.fn(),
        });

        expect(chatGptConversationEngine.forceRefreshCurrentConversation).toHaveBeenCalledTimes(2);
        expect(readerPanel.show).toHaveBeenCalledTimes(2);
        expect(readerPanel.show.mock.calls[1][1]).toBe(0);
        await expect(shownItems[0].content()).resolves.toBe('Refreshed answer with $x+y$');
    });

    it('refreshes only the ChatGPT Reader tail item content when it is resolved again', async () => {
        document.body.innerHTML = `
          <div id="thread">
            <article data-turn="user">
              <div data-message-author-role="user">
                <div class="whitespace-pre-wrap">Question 2</div>
              </div>
            </article>
            <article data-turn="assistant">
              <div data-message-author-role="assistant" data-message-id="payload-a2">
                <div class="markdown prose">Visible answer</div>
              </div>
              <div class="z-0 flex">
                <div><button data-testid="copy-turn-action-button">copy</button></div>
              </div>
            </article>
          </div>
        `;

        const firstSnapshot = {
            conversationId: 'conv-1',
            buildFingerprint: 'build-1',
            capturedAt: Date.now(),
            source: 'runtime-bridge',
            rounds: [
                {
                    id: 'round-1',
                    position: 1,
                    userPrompt: 'Question 1',
                    assistantContent: 'Frozen answer 1',
                    preview: 'Question 1',
                    messageId: 'payload-a1',
                    userMessageId: 'u1',
                    assistantMessageId: 'payload-a1',
                },
                {
                    id: 'round-2',
                    position: 2,
                    userPrompt: 'Question 2',
                    assistantContent: 'Tail before',
                    preview: 'Question 2',
                    messageId: 'payload-a2',
                    userMessageId: 'u2',
                    assistantMessageId: 'payload-a2',
                },
            ],
        };
        const refreshedSnapshot = {
            ...firstSnapshot,
            capturedAt: Date.now() + 1,
            rounds: [
                firstSnapshot.rounds[0],
                {
                    ...firstSnapshot.rounds[1],
                    assistantContent: 'Tail after with \\(x+y\\)',
                },
            ],
        };
        const adapter = new ChatGPTAdapter();
        let shownItems: any[] = [];
        const readerPanel = {
            show: vi.fn(async (items: any[]) => {
                shownItems = items;
            }),
        } as any;
        const chatGptConversationEngine = {
            getSnapshot: vi.fn(async () => firstSnapshot),
            forceRefreshCurrentConversation: vi.fn()
                .mockResolvedValueOnce(firstSnapshot)
                .mockResolvedValueOnce(refreshedSnapshot),
        } as any;
        const orchestrator = new MessageToolbarOrchestrator(adapter, { readerPanel, chatGptConversationEngine });

        const assistant = document.querySelector('[data-message-author-role="assistant"][data-message-id]') as HTMLElement;
        const actions = (orchestrator as any).getActionsForMessage(assistant, () => null);
        const readerAction = actions.find((action: any) => action.id === 'reader');

        await readerAction.onClick();

        expect(typeof shownItems[0]?.content).toBe('string');
        expect(typeof shownItems[1]?.content).toBe('function');
        await expect(shownItems[1].content()).resolves.toBe('Tail after with $x+y$');
        expect(chatGptConversationEngine.forceRefreshCurrentConversation).toHaveBeenCalledTimes(2);
    });

    it('falls back to the original ChatGPT Reader tail content when live refresh misses', async () => {
        document.body.innerHTML = `
          <div id="thread">
            <article data-turn="user">
              <div data-message-author-role="user">
                <div class="whitespace-pre-wrap">Question 1</div>
              </div>
            </article>
            <article data-turn="assistant">
              <div data-message-author-role="assistant" data-message-id="payload-a1">
                <div class="markdown prose">Visible answer</div>
              </div>
              <div class="z-0 flex">
                <div><button data-testid="copy-turn-action-button">copy</button></div>
              </div>
            </article>
          </div>
        `;

        const snapshot = {
            conversationId: 'conv-1',
            buildFingerprint: 'build-1',
            capturedAt: Date.now(),
            source: 'runtime-bridge',
            rounds: [
                {
                    id: 'round-1',
                    position: 1,
                    userPrompt: 'Question 1',
                    assistantContent: 'Original tail',
                    preview: 'Question 1',
                    messageId: 'payload-a1',
                    userMessageId: 'u1',
                    assistantMessageId: 'payload-a1',
                },
            ],
        };
        const adapter = new ChatGPTAdapter();
        let shownItems: any[] = [];
        const readerPanel = {
            show: vi.fn(async (items: any[]) => {
                shownItems = items;
            }),
        } as any;
        const chatGptConversationEngine = {
            getSnapshot: vi.fn(async () => snapshot),
            forceRefreshCurrentConversation: vi.fn()
                .mockResolvedValueOnce(snapshot)
                .mockResolvedValueOnce(null),
        } as any;
        const orchestrator = new MessageToolbarOrchestrator(adapter, { readerPanel, chatGptConversationEngine });

        const assistant = document.querySelector('[data-message-author-role="assistant"][data-message-id]') as HTMLElement;
        const actions = (orchestrator as any).getActionsForMessage(assistant, () => null);
        const readerAction = actions.find((action: any) => action.id === 'reader');

        await readerAction.onClick();

        await expect(shownItems[0].content()).resolves.toBe('Original tail');
    });

    it('opens ChatGPT Reader at the matching snapshot round from the shared Reader source', async () => {
        document.body.innerHTML = `
          <div id="thread">
            <article data-turn="user">
              <div data-message-author-role="user">
                <div class="whitespace-pre-wrap">Question 50</div>
              </div>
            </article>
            <article data-turn="assistant">
              <div data-message-author-role="assistant" data-message-id="dom-wrapper-id" data-aimd-msg-position="2">
                <div class="markdown prose">Visible answer</div>
              </div>
              <div class="z-0 flex">
                <div><button data-testid="copy-turn-action-button">copy</button></div>
              </div>
            </article>
          </div>
        `;

        const adapter = new ChatGPTAdapter();
        const readerPanel = { show: vi.fn(async () => undefined) } as any;
        const chatGptConversationEngine = {
            getSnapshot: vi.fn(),
            forceRefreshCurrentConversation: vi.fn(async () => buildVirtualizedChatGptSnapshot()),
        } as any;
        const orchestrator = new MessageToolbarOrchestrator(adapter, { readerPanel, chatGptConversationEngine });

        const assistant = document.querySelector('[data-message-author-role="assistant"][data-message-id]') as HTMLElement;
        const actions = (orchestrator as any).getActionsForMessage(assistant, () => null);
        const readerAction = actions.find((action: any) => action.id === 'reader');

        await readerAction.onClick();

        expect(readerPanel.show).toHaveBeenCalledWith(
            expect.any(Array),
            2,
            expect.any(String),
            expect.objectContaining({ profile: 'conversation-reader' }),
        );
        expect(chatGptConversationEngine.getSnapshot).not.toHaveBeenCalled();
        expect(chatGptConversationEngine.forceRefreshCurrentConversation).toHaveBeenCalledTimes(1);
    });

    it('does not append DOM-derived tail pages into a ChatGPT snapshot-backed Reader', async () => {
        document.body.innerHTML = `
          <div id="thread">
            <article data-turn="user">
              <div data-message-author-role="user"><div class="whitespace-pre-wrap">Question 1</div></div>
            </article>
            <article data-turn="assistant">
              <div data-message-author-role="assistant" data-message-id="a1">
                <div class="markdown prose">Answer 1</div>
              </div>
            </article>
            <article data-turn="user">
              <div data-message-author-role="user"><div class="whitespace-pre-wrap">Question 2</div></div>
            </article>
            <article data-turn="assistant">
              <div data-message-author-role="assistant" data-message-id="a2">
                <div class="markdown prose">Answer 2</div>
              </div>
            </article>
          </div>
        `;

        const adapter = new ChatGPTAdapter();
        const readerPanel = {
            isShowingConversationReader: vi.fn(() => true),
            getItemsSnapshot: vi.fn(() => [
                { id: 'chatgpt-a1', userPrompt: 'Question 1', content: 'Snapshot answer 1' },
            ]),
            appendItem: vi.fn(async () => undefined),
        } as any;
        const orchestrator = new MessageToolbarOrchestrator(adapter, { readerPanel }) as any;

        await orchestrator.syncReaderTailPages();

        expect(readerPanel.appendItem).not.toHaveBeenCalled();
    });

    it('appends new ChatGPT Reader tail pages from a refreshed snapshot without changing the current page', async () => {
        document.body.innerHTML = `
          <div id="thread">
            <article data-turn="user">
              <div data-message-author-role="user"><div class="whitespace-pre-wrap">Question 1</div></div>
            </article>
            <article data-turn="assistant">
              <div data-message-author-role="assistant" data-message-id="a1">
                <div class="markdown prose">Answer 1</div>
              </div>
            </article>
            <article data-turn="user">
              <div data-message-author-role="user"><div class="whitespace-pre-wrap">Question 2</div></div>
            </article>
            <article data-turn="assistant">
              <div data-message-author-role="assistant" data-message-id="a2">
                <div class="markdown prose">Answer 2 streaming</div>
              </div>
            </article>
          </div>
        `;

        const currentItems: any[] = [
            {
                id: 'chatgpt-a1',
                userPrompt: 'Question 1',
                content: 'Snapshot answer 1',
                meta: { platformId: 'chatgpt', position: 1, messageId: 'a1' },
            },
        ];
        const snapshot = {
            conversationId: 'conv-1',
            buildFingerprint: 'build-1',
            capturedAt: Date.now(),
            source: 'runtime-bridge',
            rounds: [
                {
                    id: 'round-1',
                    position: 1,
                    userPrompt: 'Question 1',
                    assistantContent: 'Snapshot answer 1',
                    preview: 'Question 1',
                    messageId: 'a1',
                    userMessageId: 'u1',
                    assistantMessageId: 'a1',
                },
                {
                    id: 'round-2',
                    position: 2,
                    userPrompt: 'Question 2',
                    assistantContent: 'Snapshot answer 2 updated',
                    preview: 'Question 2',
                    messageId: 'a2',
                    userMessageId: 'u2',
                    assistantMessageId: 'a2',
                },
            ],
        };
        const refreshedSnapshot = {
            ...snapshot,
            capturedAt: Date.now() + 1,
            rounds: [
                snapshot.rounds[0],
                {
                    ...snapshot.rounds[1],
                    assistantContent: 'Snapshot answer 2 refreshed with \\(x+y\\)',
                },
            ],
        };

        const adapter = new ChatGPTAdapter();
        const readerPanel = {
            isShowingConversationReader: vi.fn(() => true),
            getItemsSnapshot: vi.fn(() => currentItems),
            appendItem: vi.fn(async (item: any) => {
                currentItems.push(item);
            }),
        } as any;
        const chatGptConversationEngine = {
            forceRefreshCurrentConversation: vi.fn()
                .mockResolvedValueOnce(snapshot)
                .mockResolvedValueOnce(refreshedSnapshot),
        } as any;
        const orchestrator = new MessageToolbarOrchestrator(adapter, { readerPanel, chatGptConversationEngine }) as any;

        await orchestrator.syncReaderTailPages();

        expect(chatGptConversationEngine.forceRefreshCurrentConversation).toHaveBeenCalledTimes(1);
        expect(readerPanel.appendItem).toHaveBeenCalledTimes(1);
        expect(readerPanel.appendItem).toHaveBeenCalledWith(expect.objectContaining({
            id: 'chatgpt-a2',
            userPrompt: 'Question 2',
            meta: expect.objectContaining({
                platformId: 'chatgpt',
                position: 2,
                messageId: 'a2',
            }),
        }));
        expect(currentItems).toHaveLength(2);
        expect(typeof currentItems[1].content).toBe('function');
        await expect(currentItems[1].content()).resolves.toBe('Snapshot answer 2 refreshed with $x+y$');
        expect(chatGptConversationEngine.forceRefreshCurrentConversation).toHaveBeenCalledTimes(2);
    });

    it('does not duplicate ChatGPT Reader tail pages when sync is triggered concurrently', async () => {
        document.body.innerHTML = `
          <div id="thread">
            <article data-turn="user">
              <div data-message-author-role="user"><div class="whitespace-pre-wrap">Question 1</div></div>
            </article>
            <article data-turn="assistant">
              <div data-message-author-role="assistant" data-message-id="a1">
                <div class="markdown prose">Answer 1</div>
              </div>
            </article>
            <article data-turn="user">
              <div data-message-author-role="user"><div class="whitespace-pre-wrap">Question 2</div></div>
            </article>
            <article data-turn="assistant">
              <div data-message-author-role="assistant" data-message-id="a2">
                <div class="markdown prose">Answer 2</div>
              </div>
            </article>
          </div>
        `;

        const readerState: any[] = [
            {
                id: 'chatgpt-a1',
                userPrompt: 'Question 1',
                content: 'Snapshot answer 1',
                meta: { platformId: 'chatgpt', position: 1, messageId: 'a1' },
            },
        ];
        const snapshot = {
            conversationId: 'conv-1',
            buildFingerprint: 'build-1',
            capturedAt: Date.now(),
            source: 'runtime-bridge',
            rounds: [
                {
                    id: 'round-1',
                    position: 1,
                    userPrompt: 'Question 1',
                    assistantContent: 'Snapshot answer 1',
                    preview: 'Question 1',
                    messageId: 'a1',
                    userMessageId: 'u1',
                    assistantMessageId: 'a1',
                },
                {
                    id: 'round-2',
                    position: 2,
                    userPrompt: 'Question 2',
                    assistantContent: 'Snapshot answer 2',
                    preview: 'Question 2',
                    messageId: 'a2',
                    userMessageId: 'u2',
                    assistantMessageId: 'a2',
                },
            ],
        };

        const adapter = new ChatGPTAdapter();
        const readerPanel = {
            isShowingConversationReader: vi.fn(() => true),
            getItemsSnapshot: vi.fn(() => [...readerState]),
            appendItem: vi.fn(async (item: any) => {
                readerState.push(item);
            }),
        } as any;
        const chatGptConversationEngine = {
            forceRefreshCurrentConversation: vi.fn(async () => snapshot),
        } as any;
        const orchestrator = new MessageToolbarOrchestrator(adapter, { readerPanel, chatGptConversationEngine }) as any;

        await Promise.all([
            orchestrator.syncReaderTailPages(),
            orchestrator.syncReaderTailPages(),
        ]);

        expect(readerPanel.appendItem).toHaveBeenCalledTimes(1);
        expect(readerState.map((item) => item.id)).toEqual(['chatgpt-a1', 'chatgpt-a2']);
    });

    it('only appends ChatGPT Reader tail pages whose identities are observed in the DOM', async () => {
        document.body.innerHTML = `
          <div id="thread">
            <article data-turn="user">
              <div data-message-author-role="user"><div class="whitespace-pre-wrap">Question 1</div></div>
            </article>
            <article data-turn="assistant">
              <div data-message-author-role="assistant" data-message-id="a1">
                <div class="markdown prose">Answer 1</div>
              </div>
            </article>
            <article data-turn="user">
              <div data-message-author-role="user"><div class="whitespace-pre-wrap">Question 2</div></div>
            </article>
            <article data-turn="assistant">
              <div data-message-author-role="assistant" data-message-id="a2">
                <div class="markdown prose">Answer 2</div>
              </div>
            </article>
          </div>
        `;

        const readerState: any[] = [
            {
                id: 'chatgpt-a1',
                userPrompt: 'Question 1',
                content: 'Snapshot answer 1',
                meta: { platformId: 'chatgpt', position: 1, messageId: 'a1' },
            },
        ];
        const snapshot = {
            conversationId: 'conv-1',
            buildFingerprint: 'build-1',
            capturedAt: Date.now(),
            source: 'runtime-bridge',
            rounds: [
                {
                    id: 'round-1',
                    position: 1,
                    userPrompt: 'Question 1',
                    assistantContent: 'Snapshot answer 1',
                    preview: 'Question 1',
                    messageId: 'a1',
                    userMessageId: 'u1',
                    assistantMessageId: 'a1',
                },
                {
                    id: 'round-2',
                    position: 2,
                    userPrompt: 'Question 2',
                    assistantContent: 'Snapshot answer 2',
                    preview: 'Question 2',
                    messageId: 'a2',
                    userMessageId: 'u2',
                    assistantMessageId: 'a2',
                },
                {
                    id: 'round-3',
                    position: 3,
                    userPrompt: 'Question 3 from fuller snapshot',
                    assistantContent: 'Snapshot answer 3',
                    preview: 'Question 3',
                    messageId: 'a3',
                    userMessageId: 'u3',
                    assistantMessageId: 'a3',
                },
            ],
        };

        const adapter = new ChatGPTAdapter();
        const readerPanel = {
            isShowingConversationReader: vi.fn(() => true),
            getItemsSnapshot: vi.fn(() => [...readerState]),
            appendItem: vi.fn(async (item: any) => {
                readerState.push(item);
            }),
        } as any;
        const chatGptConversationEngine = {
            forceRefreshCurrentConversation: vi.fn(async () => snapshot),
        } as any;
        const orchestrator = new MessageToolbarOrchestrator(adapter, { readerPanel, chatGptConversationEngine }) as any;

        await orchestrator.syncReaderTailPages();

        expect(readerPanel.appendItem).toHaveBeenCalledTimes(1);
        expect(readerState.map((item) => item.id)).toEqual(['chatgpt-a1', 'chatgpt-a2']);
    });

    it('waits for a later sync when a new ChatGPT DOM turn is not present in the refreshed snapshot yet', async () => {
        document.body.innerHTML = `
          <div id="thread">
            <article data-turn="user">
              <div data-message-author-role="user"><div class="whitespace-pre-wrap">Question 1</div></div>
            </article>
            <article data-turn="assistant">
              <div data-message-author-role="assistant" data-message-id="a1">
                <div class="markdown prose">Answer 1</div>
              </div>
            </article>
            <article data-turn="user">
              <div data-message-author-role="user"><div class="whitespace-pre-wrap">Question 2</div></div>
            </article>
            <article data-turn="assistant">
              <div data-message-author-role="assistant" data-message-id="a2">
                <div class="markdown prose">Answer 2 visible before payload refresh</div>
              </div>
            </article>
          </div>
        `;

        const readerState: any[] = [
            {
                id: 'chatgpt-a1',
                userPrompt: 'Question 1',
                content: 'Snapshot answer 1',
                meta: { platformId: 'chatgpt', position: 1, messageId: 'a1' },
            },
        ];
        const snapshot = {
            conversationId: 'conv-1',
            buildFingerprint: 'build-1',
            capturedAt: Date.now(),
            source: 'runtime-bridge',
            rounds: [
                {
                    id: 'round-1',
                    position: 1,
                    userPrompt: 'Question 1',
                    assistantContent: 'Snapshot answer 1',
                    preview: 'Question 1',
                    messageId: 'a1',
                    userMessageId: 'u1',
                    assistantMessageId: 'a1',
                },
            ],
        };

        const adapter = new ChatGPTAdapter();
        const readerPanel = {
            isShowingConversationReader: vi.fn(() => true),
            getItemsSnapshot: vi.fn(() => [...readerState]),
            appendItem: vi.fn(async (item: any) => {
                readerState.push(item);
            }),
        } as any;
        const chatGptConversationEngine = {
            forceRefreshCurrentConversation: vi.fn(async () => snapshot),
        } as any;
        const orchestrator = new MessageToolbarOrchestrator(adapter, { readerPanel, chatGptConversationEngine }) as any;

        await orchestrator.syncReaderTailPages();

        expect(chatGptConversationEngine.forceRefreshCurrentConversation).toHaveBeenCalledTimes(1);
        expect(readerPanel.appendItem).not.toHaveBeenCalled();
        expect(readerState.map((item) => item.id)).toEqual(['chatgpt-a1']);
    });

    it('keeps a new ChatGPT Reader tail position pending until the snapshot has assistant content', async () => {
        document.body.innerHTML = `
          <div id="thread">
            <article data-turn="user">
              <div data-message-author-role="user"><div class="whitespace-pre-wrap">Question 1</div></div>
            </article>
            <article data-turn="assistant">
              <div data-message-author-role="assistant" data-message-id="a1">
                <div class="markdown prose">Answer 1</div>
              </div>
            </article>
            <article data-turn="user">
              <div data-message-author-role="user"><div class="whitespace-pre-wrap">Question 2</div></div>
            </article>
            <article data-turn="assistant">
              <div data-message-author-role="assistant" data-message-id="a2">
                <div class="markdown prose"></div>
              </div>
            </article>
          </div>
        `;

        const readerState: any[] = [
            {
                id: 'chatgpt-a1',
                userPrompt: 'Question 1',
                content: 'Snapshot answer 1',
                meta: { platformId: 'chatgpt', position: 1, messageId: 'a1' },
            },
        ];
        const pendingSnapshot = {
            conversationId: 'conv-1',
            buildFingerprint: 'build-1',
            capturedAt: Date.now(),
            source: 'runtime-bridge',
            rounds: [
                {
                    id: 'round-1',
                    position: 1,
                    userPrompt: 'Question 1',
                    assistantContent: 'Snapshot answer 1',
                    preview: 'Question 1',
                    messageId: 'a1',
                    userMessageId: 'u1',
                    assistantMessageId: 'a1',
                },
                {
                    id: 'round-2',
                    position: 2,
                    userPrompt: 'Question 2',
                    assistantContent: '',
                    preview: 'Question 2',
                    messageId: 'a2',
                    userMessageId: 'u2',
                    assistantMessageId: 'a2',
                },
            ],
        };
        const readySnapshot = {
            ...pendingSnapshot,
            capturedAt: Date.now() + 1,
            rounds: [
                pendingSnapshot.rounds[0],
                {
                    ...pendingSnapshot.rounds[1],
                    assistantContent: 'Snapshot answer 2 now ready',
                },
            ],
        };

        const adapter = new ChatGPTAdapter();
        const readerPanel = {
            isShowingConversationReader: vi.fn(() => true),
            getItemsSnapshot: vi.fn(() => [...readerState]),
            appendItem: vi.fn(async (item: any) => {
                readerState.push(item);
            }),
        } as any;
        const chatGptConversationEngine = {
            forceRefreshCurrentConversation: vi.fn()
                .mockResolvedValueOnce(pendingSnapshot)
                .mockResolvedValueOnce(readySnapshot),
        } as any;
        const orchestrator = new MessageToolbarOrchestrator(adapter, { readerPanel, chatGptConversationEngine }) as any;

        await orchestrator.syncReaderTailPages();

        expect(readerPanel.appendItem).not.toHaveBeenCalled();
        expect(readerState.map((item) => item.id)).toEqual(['chatgpt-a1']);

        await orchestrator.syncReaderTailPages();

        expect(readerPanel.appendItem).toHaveBeenCalledTimes(1);
        expect(readerState.map((item) => item.id)).toEqual(['chatgpt-a1', 'chatgpt-a2']);
    });

    it('does not append a second ChatGPT Reader page when the same tail position receives a stable assistant message id', async () => {
        document.body.innerHTML = `
          <div id="thread">
            <article data-turn="user">
              <div data-message-author-role="user"><div class="whitespace-pre-wrap">Question 1</div></div>
            </article>
            <article data-turn="assistant">
              <div data-message-author-role="assistant" data-message-id="a1">
                <div class="markdown prose">Answer 1</div>
              </div>
            </article>
            <article data-turn="user">
              <div data-message-author-role="user"><div class="whitespace-pre-wrap">Question 2</div></div>
            </article>
            <article data-turn="assistant">
              <div data-message-author-role="assistant" data-message-id="temp-a2">
                <div class="markdown prose">Answer 2 starting</div>
              </div>
            </article>
          </div>
        `;

        const readerState: any[] = [
            {
                id: 'chatgpt-a1',
                userPrompt: 'Question 1',
                content: 'Snapshot answer 1',
                meta: { platformId: 'chatgpt', position: 1, messageId: 'a1' },
            },
        ];
        const initialSnapshot = {
            conversationId: 'conv-1',
            buildFingerprint: 'build-1',
            capturedAt: Date.now(),
            source: 'runtime-bridge',
            rounds: [
                {
                    id: 'round-1',
                    position: 1,
                    userPrompt: 'Question 1',
                    assistantContent: 'Snapshot answer 1',
                    preview: 'Question 1',
                    messageId: 'a1',
                    userMessageId: 'u1',
                    assistantMessageId: 'a1',
                },
                {
                    id: 'round-2',
                    position: 2,
                    userPrompt: 'Question 2',
                    assistantContent: 'Snapshot answer 2 starting',
                    preview: 'Question 2',
                    messageId: 'temp-a2',
                    userMessageId: 'u2',
                    assistantMessageId: 'temp-a2',
                },
            ],
        };
        const stableSnapshot = {
            ...initialSnapshot,
            capturedAt: Date.now() + 1,
            rounds: [
                initialSnapshot.rounds[0],
                {
                    ...initialSnapshot.rounds[1],
                    assistantContent: 'Snapshot answer 2 continuing',
                    messageId: 'real-a2',
                    assistantMessageId: 'real-a2',
                },
            ],
        };

        const adapter = new ChatGPTAdapter();
        const readerPanel = {
            isShowingConversationReader: vi.fn(() => true),
            getItemsSnapshot: vi.fn(() => [...readerState]),
            appendItem: vi.fn(async (item: any) => {
                readerState.push(item);
            }),
        } as any;
        const chatGptConversationEngine = {
            forceRefreshCurrentConversation: vi.fn()
                .mockResolvedValueOnce(initialSnapshot)
                .mockResolvedValueOnce(stableSnapshot),
        } as any;
        const orchestrator = new MessageToolbarOrchestrator(adapter, { readerPanel, chatGptConversationEngine }) as any;

        await orchestrator.syncReaderTailPages();

        expect(readerPanel.appendItem).toHaveBeenCalledTimes(1);
        expect(readerState.map((item) => item.id)).toEqual(['chatgpt-a1', 'chatgpt-temp-a2']);

        document.querySelector('[data-message-id="temp-a2"]')?.setAttribute('data-message-id', 'real-a2');

        await orchestrator.syncReaderTailPages();

        expect(readerPanel.appendItem).toHaveBeenCalledTimes(1);
        expect(chatGptConversationEngine.forceRefreshCurrentConversation).toHaveBeenCalledTimes(1);
        expect(readerState.map((item) => item.id)).toEqual(['chatgpt-a1', 'chatgpt-temp-a2']);
    });

    it('saves ChatGPT bookmarks with payload positions instead of DOM-local positions', async () => {
        renderVirtualizedChatGptBookmarkDom();

        vi.mocked(bookmarkSaveDialog.open).mockReset();
        vi.mocked(bookmarkSaveDialog.open).mockResolvedValueOnce({
            ok: true,
            folderPath: '/Research',
            title: 'Question 50',
        } as any);

        const adapter = new ChatGPTAdapter();
        const readerPanel = { show: vi.fn(async () => undefined) } as any;
        const bookmarksController = {
            isPositionBookmarked: vi.fn(() => false),
            getDefaultFolderPath: vi.fn(() => '/Inbox'),
            toggleBookmarkFromToolbar: vi.fn(async () => ({ ok: true, data: { saved: true } })),
            selectFolder: vi.fn(),
        } as any;
        const chatGptConversationEngine = {
            getSnapshot: vi.fn(async () => buildVirtualizedChatGptSnapshot()),
            forceRefreshCurrentConversation: vi.fn(async () => buildVirtualizedChatGptSnapshot()),
        } as any;
        const orchestrator = new MessageToolbarOrchestrator(adapter, { readerPanel, bookmarksController, chatGptConversationEngine }) as any;

        const assistant = document.querySelector('[data-message-author-role="assistant"][data-message-id]') as HTMLElement;
        const toolbar = { setActionActive: vi.fn() };
        const actions = orchestrator.getActionsForMessage(assistant, () => toolbar);
        const bookmarkAction = actions.find((action: any) => action.id === 'bookmark_toggle');

        await bookmarkAction.onClick();

        expect(bookmarksController.toggleBookmarkFromToolbar).toHaveBeenCalledWith(expect.objectContaining({
            position: 50,
            messageId: 'payload-a50',
            userMessage: 'Question 50',
            aiResponse: 'Answer 50',
        }));
        expect(chatGptConversationEngine.getSnapshot).toHaveBeenCalledTimes(1);
        expect(chatGptConversationEngine.forceRefreshCurrentConversation).toHaveBeenCalledTimes(1);
        expect(toolbar.setActionActive).toHaveBeenCalledWith('bookmark_toggle', true);
    });

    it('highlights ChatGPT bookmark buttons by payload position instead of DOM-local position', async () => {
        renderVirtualizedChatGptBookmarkDom();

        const adapter = new ChatGPTAdapter();
        const readerPanel = { show: vi.fn(async () => undefined) } as any;
        const bookmarksController = {
            isPositionBookmarked: vi.fn((_url: string, position: number) => position === 50),
        } as any;
        const chatGptConversationEngine = {
            getSnapshot: vi.fn(async () => buildVirtualizedChatGptSnapshot()),
        } as any;
        const orchestrator = new MessageToolbarOrchestrator(adapter, { readerPanel, bookmarksController, chatGptConversationEngine }) as any;

        const assistant = document.querySelector('[data-message-author-role="assistant"][data-message-id]') as HTMLElement;
        const toolbar = { setActionActive: vi.fn() };
        (orchestrator as any).refreshBookmarkStateForToolbar(toolbar, assistant, 2);
        await new Promise<void>((resolve) => setTimeout(resolve, 0));

        expect(bookmarksController.isPositionBookmarked).toHaveBeenCalledWith(expect.any(String), 50);
        expect(toolbar.setActionActive).toHaveBeenCalledWith('bookmark_toggle', true);
    });

    it('does not add a retired ChatGPT fold action', () => {
        document.body.innerHTML = `
          <div id="thread">
            <article data-turn="assistant">
              <div data-message-author-role="assistant" data-message-id="a1">
                <div class="markdown prose">Hi</div>
              </div>
              <div class="z-0 flex">
                <div><button data-testid="copy-turn-action-button">copy</button></div>
              </div>
            </article>
          </div>
        `;

        const adapter = new ChatGPTAdapter();
        const readerPanel = { show: vi.fn(async () => undefined) } as any;
        const orchestrator = new MessageToolbarOrchestrator(adapter, { readerPanel });
        const assistant = document.querySelector('[data-message-author-role="assistant"][data-message-id]') as HTMLElement;
        const actions = (orchestrator as any).getActionsForMessage(assistant, () => null);

        expect(actions.some((action: any) => action.id === 'collapse_turn')).toBe(false);
    });

    it('opens save messages directly from live DOM in hidden-only mode', async () => {
        document.body.innerHTML = `
          <div id="thread">
            <article data-turn="user">
              <div data-message-author-role="user">
                <div class="whitespace-pre-wrap">Hello from user</div>
              </div>
            </article>
            <article data-turn="assistant">
              <div data-message-author-role="assistant" data-message-id="a1">
                <div class="markdown prose">Hi</div>
              </div>
              <div class="z-0 flex">
                <div><button data-testid="copy-turn-action-button">copy</button></div>
              </div>
            </article>
          </div>
        `;

        const adapter = new ChatGPTAdapter();
        const readerPanel = { show: vi.fn(async () => undefined) } as any;
        const orchestrator = new MessageToolbarOrchestrator(adapter, { readerPanel }) as any;

        const assistant = document.querySelector('[data-message-author-role="assistant"][data-message-id]') as HTMLElement;
        const actions = orchestrator.getActionsForMessage(assistant, () => null);
        const exportAction = actions.find((action: any) => action.id === 'export');

        await exportAction.onClick();

        expect(saveMessagesDialog.open).toHaveBeenCalledTimes(1);
    });

    it('uses the shared bookmark flow for toolbar create and derives platform from the adapter', async () => {
        document.body.innerHTML = `
          <div class="assistant-message" data-message-id="m1" data-aimd-msg-position="7">
            <div class="content">First</div>
            <div class="official-toolbar"><button>copy</button></div>
          </div>
        `;

        vi.mocked(bookmarkSaveDialog.open).mockResolvedValueOnce({
            ok: true,
            folderPath: '/Research',
            title: 'Prompt',
        } as any);

        const adapter = new UnknownAdapter();
        const readerPanel = { show: vi.fn(async () => undefined) } as any;
        const bookmarksController = {
            isPositionBookmarked: vi.fn(() => false),
            getDefaultFolderPath: vi.fn(() => '/Inbox'),
            toggleBookmarkFromToolbar: vi.fn(async () => ({ ok: true, data: { saved: true } })),
            selectFolder: vi.fn(),
        } as any;
        const orchestrator = new MessageToolbarOrchestrator(adapter, { readerPanel, bookmarksController }) as any;
        orchestrator.getMergedMarkdownForElement = vi.fn(() => ({ ok: true, markdown: 'First' }));
        orchestrator.getUserPromptForElement = vi.fn(() => 'Prompt');

        const assistant = document.querySelector('.assistant-message') as HTMLElement;
        const actions = orchestrator.getActionsForMessage(assistant, () => ({
            setActionActive: vi.fn(),
        }));
        const bookmarkAction = actions.find((action: any) => action.id === 'bookmark_toggle');

        await bookmarkAction.onClick();
        await Promise.resolve();

        expect(bookmarkSaveDialog.open).toHaveBeenCalledTimes(1);
        expect(bookmarksController.toggleBookmarkFromToolbar).toHaveBeenCalledWith(expect.objectContaining({
            platform: 'unknown',
            position: 7,
            messageId: 'm1',
            folderPath: '/Research',
            title: 'Prompt',
        }));
    });
});
