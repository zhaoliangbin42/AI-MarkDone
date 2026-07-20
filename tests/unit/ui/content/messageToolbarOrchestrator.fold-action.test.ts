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
vi.mock('@/drivers/content/chatgpt/chatgptRoute', () => ({
    getChatGPTConversationId: vi.fn(() => 'conv-1'),
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
        document.body.innerHTML = `
          <div id="thread">
            <div data-turn-id-container id="user-50">
              <section data-turn="user">
                <div data-message-author-role="user">
                  <div class="whitespace-pre-wrap">Question 50</div>
                </div>
              </section>
            </div>
            <div data-turn-id-container id="assistant-50">
              <section data-turn="assistant">
                <div data-message-author-role="assistant" data-message-id="payload-a50" data-aimd-msg-position="1">
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

    it('opens a Deep Research report through the shared Reader source and cleans citation tokens', async () => {
        document.body.innerHTML = `
          <div id="thread">
            <article data-turn="user">
              <div data-message-author-role="user">
                <div class="whitespace-pre-wrap">Research this topic</div>
              </div>
            </article>
            <article data-turn="assistant">
              <div data-message-author-role="assistant" data-message-id="assistant-shell">
                <div class="markdown prose"></div>
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
        const snapshot = {
            conversationId: 'conv-1',
            buildFingerprint: 'build-1',
            capturedAt: Date.now(),
            source: 'runtime-bridge',
            rounds: [
                {
                    id: 'round-deep-research',
                    position: 1,
                    userPrompt: 'Research this topic',
                    assistantContent: '# Deep Research Report\n\n## Findings\n\nFull report body. citeturn0search0',
                    preview: 'Research this topic',
                    messageId: 'assistant-shell',
                    userMessageId: 'deep-user-message',
                    assistantMessageId: 'assistant-shell',
                },
            ],
        };
        const chatGptConversationEngine = {
            getSnapshot: vi.fn(),
            forceRefreshCurrentConversation: vi.fn(async () => snapshot),
        } as any;
        const orchestrator = new MessageToolbarOrchestrator(adapter, { readerPanel, chatGptConversationEngine });

        const assistant = document.querySelector('[data-message-author-role="assistant"][data-message-id]') as HTMLElement;
        const actions = (orchestrator as any).getActionsForMessage(assistant, () => null);
        const readerAction = actions.find((action: any) => action.id === 'reader');

        await readerAction.onClick();

        expect(chatGptConversationEngine.forceRefreshCurrentConversation).toHaveBeenCalledTimes(1);
        expect(readerPanel.show).toHaveBeenCalledWith(
            [expect.objectContaining({
                userPrompt: 'Research this topic',
                meta: expect.objectContaining({
                    platformId: 'chatgpt',
                    messageId: 'assistant-shell',
                    position: 1,
                }),
            })],
            0,
            expect.any(String),
            expect.objectContaining({ profile: 'conversation-reader' }),
        );
        await expect(shownItems[0].content()).resolves.toBe(
            '# Deep Research Report\n\n## Findings\n\nFull report body.'
        );
    });

    it('injects a usable message toolbar below a live-shaped Deep Research iframe', async () => {
        document.body.innerHTML = `
          <main>
            <div data-turn-id-container="deep-user-turn">
              <section data-turn-id="deep-user-turn" data-testid="conversation-turn-1" data-turn="user">
                <div data-message-author-role="user">
                  <div class="whitespace-pre-wrap">Research this topic</div>
                </div>
              </section>
            </div>
            <div data-turn-id-container="deep-assistant-turn">
              <section data-turn-id="deep-assistant-turn" data-testid="conversation-turn-2" data-turn="assistant">
                <div class="turn-layout">
                  <div data-conversation-screenshot-content class="agent-turn">
                    <div class="report-stack">
                      <div class="report-badges"></div>
                      <div class="report-widget">
                        <iframe
                          title="internal://deep-research"
                          src="https://connector_openai_deep_research.web-sandbox.oaiusercontent.com?app=chatgpt"
                        ></iframe>
                      </div>
                    </div>
                  </div>
                </div>
              </section>
            </div>
          </main>
        `;

        const adapter = new ChatGPTAdapter();
        let shownItems: any[] = [];
        const readerPanel = {
            show: vi.fn(async (items: any[]) => {
                shownItems = items;
            }),
        } as any;
        const snapshot = {
            conversationId: 'conv-1',
            buildFingerprint: 'build-1',
            capturedAt: Date.now(),
            source: 'runtime-bridge',
            rounds: [
                {
                    id: 'deep-user-turn',
                    position: 1,
                    userPrompt: 'Research this topic',
                    assistantContent: '# Deep Research Report\n\nFull report body. citeturn0search0',
                    preview: 'Research this topic',
                    messageId: 'deep-assistant-turn',
                    userMessageId: 'deep-user-message',
                    assistantMessageId: 'deep-assistant-turn',
                },
            ],
        };
        const chatGptConversationEngine = {
            getSnapshot: vi.fn(),
            forceRefreshCurrentConversation: vi.fn(async () => snapshot),
        } as any;
        const orchestrator = new MessageToolbarOrchestrator(adapter, { readerPanel, chatGptConversationEngine });

        (orchestrator as any).scanAndInject();
        (orchestrator as any).scanAndInject();

        const reportStack = document.querySelector('.report-stack') as HTMLElement;
        expect(reportStack.querySelectorAll(':scope > [data-aimd-role="message-toolbar"]')).toHaveLength(1);
        const toolbarHost = reportStack.querySelector<HTMLElement>(':scope > [data-aimd-role="message-toolbar"]');
        expect(toolbarHost).toBeInstanceOf(HTMLElement);
        expect(toolbarHost?.previousElementSibling?.classList.contains('report-widget')).toBe(true);
        expect(toolbarHost?.style.alignSelf).toBe('flex-end');

        const readerButton = toolbarHost?.shadowRoot?.querySelector<HTMLButtonElement>('[data-action="reader"]');
        expect(readerButton).toBeInstanceOf(HTMLButtonElement);
        readerButton?.click();

        await vi.waitFor(() => expect(readerPanel.show).toHaveBeenCalledTimes(1));
        await expect(shownItems[0].content()).resolves.toBe('# Deep Research Report\n\nFull report body.');

        orchestrator.dispose();
        adapter.dispose();
    });

    it('mounts the Deep Research toolbar when the iframe hydrates after the assistant turn shell', async () => {
        vi.useFakeTimers();
        document.body.innerHTML = `
          <main>
            <div data-turn-id-container="deep-user-turn">
              <section data-turn-id="deep-user-turn" data-testid="conversation-turn-1" data-turn="user">
                <div data-message-author-role="user"><div class="whitespace-pre-wrap">Research this topic</div></div>
              </section>
            </div>
            <div data-turn-id-container="deep-assistant-turn">
              <section data-turn-id="deep-assistant-turn" data-testid="conversation-turn-2" data-turn="assistant">
                <div data-conversation-screenshot-content class="agent-turn">
                  <div class="report-stack"><div class="report-widget"></div></div>
                </div>
              </section>
            </div>
          </main>
        `;

        const adapter = new ChatGPTAdapter();
        const readerPanel = { show: vi.fn(async () => undefined) } as any;
        const orchestrator = new MessageToolbarOrchestrator(adapter, { readerPanel });

        try {
            orchestrator.init();
            await vi.advanceTimersByTimeAsync(1_000);
            expect(document.querySelector('[data-aimd-role="message-toolbar"]')).toBeNull();

            const widget = document.querySelector('.report-widget') as HTMLElement;
            widget.innerHTML = '<iframe title="internal://deep-research"></iframe>';
            await Promise.resolve();
            await vi.advanceTimersByTimeAsync(1_500);

            expect(document.querySelectorAll('.report-stack > [data-aimd-role="message-toolbar"]')).toHaveLength(1);
        } finally {
            orchestrator.dispose();
            adapter.dispose();
            vi.useRealTimers();
        }
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

    it('does not move an in-page Reader refresh to a reused canonical position after its typed identity disappears', async () => {
        document.body.innerHTML = `
          <main>
            <article data-turn="user">
              <div data-message-author-role="user"><div class="whitespace-pre-wrap">Old question</div></div>
            </article>
            <article data-turn="assistant">
              <div data-message-author-role="assistant" data-message-id="old-a2"><div class="markdown prose">Old answer</div></div>
            </article>
          </main>
        `;
        const initialSnapshot = {
            conversationId: 'conv-1', buildFingerprint: 'build-1', capturedAt: 1, source: 'runtime-bridge' as const,
            rounds: [{ id: 'old-round', position: 2, userPrompt: 'Old question', assistantContent: 'Old answer', preview: 'Old question', messageId: 'old-a2', userMessageId: 'old-u', assistantMessageId: 'old-a2' }],
        };
        const refreshedSnapshot = {
            conversationId: 'conv-1', buildFingerprint: 'build-1', capturedAt: 2, source: 'runtime-bridge' as const,
            rounds: [
                { id: 'new-round-1', position: 1, userPrompt: 'New question 1', assistantContent: 'New answer 1', preview: 'New question 1', messageId: 'new-a1', userMessageId: 'new-u1', assistantMessageId: 'new-a1' },
                { id: 'new-round-2', position: 2, userPrompt: 'New question 2', assistantContent: 'New answer 2', preview: 'New question 2', messageId: 'new-a2', userMessageId: 'new-u2', assistantMessageId: 'new-a2' },
            ],
        };
        let shownItems: any[] = [];
        const readerPanel = {
            show: vi.fn(async (items: any[]) => { shownItems = items; }),
            getCommentExportContext: vi.fn(() => null),
        } as any;
        const chatGptConversationEngine = {
            forceRefreshCurrentConversation: vi.fn()
                .mockResolvedValueOnce(initialSnapshot)
                .mockResolvedValueOnce(refreshedSnapshot),
        } as any;
        const adapter = new ChatGPTAdapter();
        const orchestrator = new MessageToolbarOrchestrator(adapter, { readerPanel, chatGptConversationEngine });
        const assistant = document.querySelector('[data-message-id="old-a2"]') as HTMLElement;
        const readerAction = (orchestrator as any).getActionsForMessage(assistant, () => null)
            .find((action: any) => action.id === 'reader');

        await readerAction.onClick();
        const refreshAction = readerPanel.show.mock.calls[0][3].actions
            .find((action: any) => action.id === 'refresh');
        await refreshAction.onClick({
            item: shownItems[0],
            index: 0,
            items: shownItems,
            notify: vi.fn(),
            rerender: vi.fn(),
        });

        expect(readerPanel.show).toHaveBeenCalledTimes(2);
        expect(readerPanel.show.mock.calls[1][1]).toBe(0);
        expect(shownItems[0].meta).toMatchObject({ userMessageId: 'new-u1', position: 1 });
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

    it('fails closed when a clicked ChatGPT Reader element only has a non-canonical local id', async () => {
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
            [],
            0,
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
            peekCurrentSnapshot: vi.fn(() => snapshot),
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

    it('drops a delayed ChatGPT Reader tail snapshot after the SPA route changes', async () => {
        window.history.replaceState({}, '', '/c/conversation-a');
        document.body.innerHTML = `
          <main>
            <article data-turn="user"><div data-message-author-role="user" data-message-id="u2">Question 2</div></article>
            <article data-turn="assistant"><div data-message-author-role="assistant" data-message-id="a2">Answer 2</div></article>
          </main>
        `;
        const readerState: any[] = [{
            id: 'chatgpt-a1',
            userPrompt: 'Question 1',
            content: 'Answer 1',
            meta: { position: 1, roundId: 'round-1', userMessageId: 'u1', assistantMessageId: 'a1', messageId: 'a1' },
        }];
        const snapshot = {
            conversationId: 'conv-1',
            buildFingerprint: 'build-1',
            source: 'runtime-bridge' as const,
            origin: 'conversation-graph' as const,
            coverage: 'complete' as const,
            branchKey: 'a2',
            capturedAt: 2,
            rounds: [
                { id: 'round-1', position: 1, userPrompt: 'Question 1', assistantContent: 'Answer 1', preview: 'Question 1', messageId: 'a1', userMessageId: 'u1', assistantMessageId: 'a1' },
                { id: 'round-2', position: 2, userPrompt: 'Question 2', assistantContent: 'Answer 2', preview: 'Question 2', messageId: 'a2', userMessageId: 'u2', assistantMessageId: 'a2' },
            ],
        };
        let resolveSnapshot!: (value: typeof snapshot) => void;
        const delayedSnapshot = new Promise<typeof snapshot>((resolve) => { resolveSnapshot = resolve; });
        const readerPanel = {
            isShowingConversationReader: vi.fn(() => true),
            getItemsSnapshot: vi.fn(() => [...readerState]),
            appendItem: vi.fn(async (item: any) => readerState.push(item)),
            replaceItems: vi.fn(async () => undefined),
        } as any;
        const chatGptConversationEngine = {
            forceRefreshCurrentConversation: vi.fn(() => delayedSnapshot),
        } as any;
        const orchestrator = new MessageToolbarOrchestrator(new ChatGPTAdapter(), {
            readerPanel,
            chatGptConversationEngine,
        }) as any;

        const sync = orchestrator.syncReaderTailPages();
        await Promise.resolve();
        window.history.replaceState({}, '', '/c/conversation-b');
        resolveSnapshot(snapshot);
        await sync;

        expect(readerPanel.appendItem).not.toHaveBeenCalled();
        expect(readerPanel.replaceItems).not.toHaveBeenCalled();
        expect(readerState.map((item) => item.id)).toEqual(['chatgpt-a1']);
    });

    it('appends every verified canonical Reader tail page even when virtualization has not mounted it', async () => {
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

        expect(readerPanel.appendItem).toHaveBeenCalledTimes(2);
        expect(readerState.map((item) => item.id)).toEqual(['chatgpt-a1', 'chatgpt-a2', 'chatgpt-a3']);
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

        let readerState: any[] = [
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
            replaceItems: vi.fn(async (items: any[]) => {
                readerState = items;
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
        expect(readerPanel.replaceItems).toHaveBeenCalledWith(
            expect.arrayContaining([expect.objectContaining({ id: 'chatgpt-real-a2' })]),
            { preserveCurrentIdentity: true },
        );
        expect(chatGptConversationEngine.forceRefreshCurrentConversation).toHaveBeenCalledTimes(2);
        expect(readerState.map((item) => item.id)).toEqual(['chatgpt-a1', 'chatgpt-real-a2']);
    });

    it('appends a canonical ChatGPT Reader tail when virtualization removed every earlier carrier', async () => {
        renderVirtualizedChatGptBookmarkDom();

        const readerState: any[] = [
            {
                id: 'chatgpt-payload-a1',
                userPrompt: 'Question 1',
                content: 'Answer 1',
                meta: { platformId: 'chatgpt', position: 1, messageId: 'payload-a1' },
            },
            {
                id: 'chatgpt-payload-a2',
                userPrompt: 'Question 2',
                content: 'Answer 2',
                meta: { platformId: 'chatgpt', position: 2, messageId: 'payload-a2' },
            },
        ];
        const adapter = new ChatGPTAdapter();
        const readerPanel = {
            isShowingConversationReader: vi.fn(() => true),
            getItemsSnapshot: vi.fn(() => [...readerState]),
            appendItem: vi.fn(async (item: any) => readerState.push(item)),
        } as any;
        const chatGptConversationEngine = {
            forceRefreshCurrentConversation: vi.fn(async () => buildVirtualizedChatGptSnapshot()),
        } as any;
        const orchestrator = new MessageToolbarOrchestrator(adapter, { readerPanel, chatGptConversationEngine }) as any;

        await orchestrator.syncReaderTailPages();

        expect(chatGptConversationEngine.forceRefreshCurrentConversation).toHaveBeenCalledTimes(1);
        expect(readerPanel.appendItem).toHaveBeenCalledWith(expect.objectContaining({
            id: 'chatgpt-payload-a50',
            userPrompt: 'Question 50',
            meta: expect.objectContaining({ position: 50, messageId: 'payload-a50' }),
        }));
        expect(readerState.map((item) => item.meta.position)).toEqual([1, 2, 50]);
    });

    it('appends a Deep Research tail from the canonical graph when its DOM turn id differs from the report message id', async () => {
        document.body.innerHTML = `
          <main>
            <div data-turn-id-container="user-turn-2">
              <section data-turn-id="user-turn-2" data-testid="conversation-turn-3" data-turn="user">
                <div data-message-author-role="user" data-message-id="u2">
                  <div class="whitespace-pre-wrap">Research question 2</div>
                </div>
              </section>
            </div>
            <div data-turn-id-container="assistant-turn-2">
              <section data-turn-id="assistant-turn-2" data-testid="conversation-turn-4" data-turn="assistant">
                <div data-conversation-screenshot-content class="agent-turn">
                  <div class="report-stack">
                    <div class="report-widget"><iframe title="internal://deep-research"></iframe></div>
                  </div>
                </div>
              </section>
            </div>
          </main>
        `;
        const snapshot = {
            conversationId: 'conv-1',
            buildFingerprint: 'build-1',
            source: 'runtime-bridge' as const,
            origin: 'conversation-graph' as const,
            coverage: 'complete' as const,
            branchKey: 'nested-report-id',
            capturedAt: 2,
            rounds: [
                { id: 'round-1', position: 1, userPrompt: 'Question 1', assistantContent: 'Answer 1', preview: 'Question 1', messageId: 'a1', userMessageId: 'u1', assistantMessageId: 'a1' },
                { id: 'user-turn-2', position: 2, userPrompt: 'Research question 2', assistantContent: '# Canonical report', preview: 'Research question 2', messageId: 'nested-report-id', userMessageId: 'u2', assistantMessageId: 'nested-report-id' },
            ],
        };
        const readerState: any[] = [{
            id: 'chatgpt-a1',
            userPrompt: 'Question 1',
            content: 'Answer 1',
            meta: { position: 1, roundId: 'round-1', userMessageId: 'u1', assistantMessageId: 'a1', messageId: 'a1' },
        }];
        const readerPanel = {
            isShowingConversationReader: vi.fn(() => true),
            getItemsSnapshot: vi.fn(() => [...readerState]),
            appendItem: vi.fn(async (item: any) => readerState.push(item)),
            replaceItems: vi.fn(async () => undefined),
        } as any;
        const chatGptConversationEngine = {
            forceRefreshCurrentConversation: vi.fn(async () => snapshot),
        } as any;
        const adapter = new ChatGPTAdapter();
        const orchestrator = new MessageToolbarOrchestrator(adapter, {
            readerPanel,
            chatGptConversationEngine,
        }) as any;

        await orchestrator.syncReaderTailPages();

        expect(readerPanel.replaceItems).not.toHaveBeenCalled();
        expect(readerPanel.appendItem).toHaveBeenCalledWith(expect.objectContaining({
            id: 'chatgpt-nested-report-id',
            meta: expect.objectContaining({
                position: 2,
                roundId: 'user-turn-2',
                assistantMessageId: 'nested-report-id',
            }),
        }));
        expect(readerState.map((item) => item.id)).toEqual(['chatgpt-a1', 'chatgpt-nested-report-id']);

        await orchestrator.syncReaderTailPages();

        expect(chatGptConversationEngine.forceRefreshCurrentConversation).toHaveBeenCalledTimes(1);
        expect(readerPanel.appendItem).toHaveBeenCalledTimes(1);
    });

    it('atomically replaces an open ChatGPT Reader when the canonical branch changes', async () => {
        document.body.innerHTML = `
          <main>
            <article data-turn="user" data-turn-id="round-2">
              <div data-message-author-role="user" data-message-id="u2">Question 2</div>
            </article>
            <article data-turn="assistant" data-turn-id="round-2">
              <div data-message-author-role="assistant" data-message-id="a2"><div class="markdown prose">Old answer 2</div></div>
            </article>
          </main>
        `;
        const branchA = {
            conversationId: 'conv-1',
            buildFingerprint: 'build-1',
            source: 'runtime-bridge' as const,
            origin: 'conversation-graph' as const,
            coverage: 'complete' as const,
            branchKey: 'leaf-a3',
            capturedAt: 1,
            rounds: [
                { id: 'round-1', position: 1, userPrompt: 'Question 1', assistantContent: 'Old answer 1', preview: 'Question 1', messageId: 'a1', userMessageId: 'u1', assistantMessageId: 'a1' },
                { id: 'round-2', position: 2, userPrompt: 'Question 2', assistantContent: 'Old answer 2', preview: 'Question 2', messageId: 'a2', userMessageId: 'u2', assistantMessageId: 'a2' },
                { id: 'round-3', position: 3, userPrompt: 'Question 3', assistantContent: 'Old answer 3', preview: 'Question 3', messageId: 'a3', userMessageId: 'u3', assistantMessageId: 'a3' },
            ],
        };
        const branchB = {
            ...branchA,
            branchKey: 'leaf-b4',
            capturedAt: 2,
            rounds: [
                { id: 'round-b2', position: 1, userPrompt: 'Question 2 regenerated', assistantContent: 'New answer 2', preview: 'Question 2', messageId: 'b2', userMessageId: 'u2', assistantMessageId: 'b2' },
                { id: 'round-b4', position: 2, userPrompt: 'Question 4', assistantContent: 'New answer 4', preview: 'Question 4', messageId: 'b4', userMessageId: 'u4', assistantMessageId: 'b4' },
            ],
        };
        let activeSnapshot = branchA;
        let readerState: any[] = branchA.rounds.map((round) => ({
            id: `chatgpt-${round.messageId}`,
            userPrompt: round.userPrompt,
            content: round.assistantContent,
            meta: {
                platformId: 'chatgpt',
                position: round.position,
                messageId: round.messageId,
                roundId: round.id,
                userMessageId: round.userMessageId,
                assistantMessageId: round.assistantMessageId,
                branchKey: branchA.branchKey,
            },
        }));
        const readerPanel = {
            isShowingConversationReader: vi.fn(() => true),
            getItemsSnapshot: vi.fn(() => [...readerState]),
            appendItem: vi.fn(async (item: any) => { readerState.push(item); }),
            replaceItems: vi.fn(async (items: any[]) => { readerState = items; }),
        } as any;
        const chatGptConversationEngine = {
            peekCurrentSnapshot: vi.fn(() => activeSnapshot),
            forceRefreshCurrentConversation: vi.fn(async () => activeSnapshot),
        } as any;
        const orchestrator = new MessageToolbarOrchestrator(new ChatGPTAdapter(), {
            readerPanel,
            chatGptConversationEngine,
        }) as any;

        await orchestrator.syncReaderTailPages();
        activeSnapshot = branchB;
        await orchestrator.syncReaderTailPages();

        expect(readerPanel.replaceItems).toHaveBeenCalledTimes(1);
        expect(readerPanel.replaceItems).toHaveBeenCalledWith(
            expect.arrayContaining([
                expect.objectContaining({
                    id: 'chatgpt-b2',
                    meta: expect.objectContaining({ userMessageId: 'u2', branchKey: 'leaf-b4' }),
                }),
            ]),
            { preserveCurrentIdentity: true },
        );
        expect(readerPanel.appendItem).not.toHaveBeenCalled();
        expect(readerState.map((item) => item.id)).toEqual(['chatgpt-b2', 'chatgpt-b4']);

        activeSnapshot = {
            ...branchB,
            branchKey: 'leaf-b5',
            capturedAt: 3,
            rounds: [
                ...branchB.rounds,
                { id: 'round-b5', position: 3, userPrompt: 'Question 5', assistantContent: 'New answer 5', preview: 'Question 5', messageId: 'b5', userMessageId: 'u5', assistantMessageId: 'b5' },
            ],
        };
        await orchestrator.syncReaderTailPages();

        expect(readerPanel.appendItem).toHaveBeenCalledWith(expect.objectContaining({ id: 'chatgpt-b5' }));
        expect(readerState.map((item) => item.id)).toEqual(['chatgpt-b2', 'chatgpt-b4', 'chatgpt-b5']);
    });

    it('keeps canonical branch extension on the Reader tail append path', async () => {
        document.body.innerHTML = `
          <main>
            <article data-turn="user" data-turn-id="round-2">
              <div data-message-author-role="user" data-message-id="u2">Question 2</div>
            </article>
            <article data-turn="assistant" data-turn-id="round-2">
              <div data-message-author-role="assistant" data-message-id="a2"><div class="markdown prose">Answer 2</div></div>
            </article>
          </main>
        `;
        const extendedSnapshot = {
            conversationId: 'conv-1',
            buildFingerprint: 'build-1',
            source: 'runtime-bridge' as const,
            origin: 'conversation-graph' as const,
            coverage: 'complete' as const,
            branchKey: 'leaf-a2',
            capturedAt: 2,
            rounds: [
                { id: 'round-1', position: 1, userPrompt: 'Question 1', assistantContent: 'Answer 1', preview: 'Question 1', messageId: 'a1', userMessageId: 'u1', assistantMessageId: 'a1' },
                { id: 'round-2', position: 2, userPrompt: 'Question 2', assistantContent: 'Answer 2', preview: 'Question 2', messageId: 'a2', userMessageId: 'u2', assistantMessageId: 'a2' },
            ],
        };
        const readerState: any[] = [{
            id: 'chatgpt-a1',
            userPrompt: 'Question 1',
            content: 'Answer 1',
            meta: {
                platformId: 'chatgpt',
                position: 1,
                messageId: 'a1',
                roundId: 'round-1',
                userMessageId: 'u1',
                assistantMessageId: 'a1',
                branchKey: 'leaf-a1',
            },
        }];
        const readerPanel = {
            isShowingConversationReader: vi.fn(() => true),
            getItemsSnapshot: vi.fn(() => [...readerState]),
            appendItem: vi.fn(async (item: any) => readerState.push(item)),
            replaceItems: vi.fn(async () => undefined),
        } as any;
        const chatGptConversationEngine = {
            peekCurrentSnapshot: vi.fn(() => extendedSnapshot),
            forceRefreshCurrentConversation: vi.fn(async () => extendedSnapshot),
        } as any;
        const orchestrator = new MessageToolbarOrchestrator(new ChatGPTAdapter(), {
            readerPanel,
            chatGptConversationEngine,
        }) as any;

        await orchestrator.syncReaderTailPages();

        expect(readerPanel.replaceItems).not.toHaveBeenCalled();
        expect(readerPanel.appendItem).toHaveBeenCalledTimes(1);
        expect(readerState.map((item) => item.id)).toEqual(['chatgpt-a1', 'chatgpt-a2']);
    });

    it('does not rebind live Reader content by a reused position after branch replacement', async () => {
        const branchB = {
            conversationId: 'conv-1',
            buildFingerprint: 'build-1',
            source: 'runtime-bridge' as const,
            origin: 'conversation-graph' as const,
            coverage: 'complete' as const,
            branchKey: 'leaf-b4',
            capturedAt: 2,
            rounds: [
                { id: 'round-b4', position: 2, userPrompt: 'Question 4', assistantContent: 'Wrong branch answer', preview: 'Question 4', messageId: 'b4', userMessageId: 'u4', assistantMessageId: 'b4' },
            ],
        };
        const tail: any = {
            id: 'chatgpt-a2',
            userPrompt: 'Question 2',
            content: 'Original branch answer',
            meta: {
                position: 2,
                messageId: 'a2',
                roundId: 'round-a2',
                userMessageId: 'u2',
                assistantMessageId: 'a2',
                branchKey: 'leaf-a2',
            },
        };
        const orchestrator = new MessageToolbarOrchestrator(new ChatGPTAdapter(), {
            readerPanel: {} as any,
            chatGptConversationEngine: {
                forceRefreshCurrentConversation: vi.fn(async () => branchB),
            } as any,
        }) as any;

        orchestrator.attachChatGptLiveTailReaderItem([tail]);

        await expect(tail.content()).resolves.toBe('Original branch answer');
    });

    it('saves ChatGPT bookmarks from the exact indexed element even when the adapter exposes a local fallback id', async () => {
        renderVirtualizedChatGptBookmarkDom();

        vi.mocked(bookmarkSaveDialog.open).mockReset();
        vi.mocked(bookmarkSaveDialog.open).mockResolvedValueOnce({
            ok: true,
            folderPath: '/Research',
            title: 'Question 50',
        } as any);

        const adapter = new ChatGPTAdapter();
        vi.spyOn(adapter, 'getMessageId').mockReturnValue('chatgpt-1');
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
        const orchestrator = new MessageToolbarOrchestrator(adapter, {
            readerPanel,
            bookmarksController,
            chatGptConversationEngine,
            bookmarkSaveDialog,
        }) as any;

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

    it('does not fill a canonical ChatGPT bookmark prompt from DOM text', async () => {
        renderVirtualizedChatGptBookmarkDom();
        const snapshot = buildVirtualizedChatGptSnapshot();
        snapshot.rounds = snapshot.rounds.map((round: any) => (
            round.position === 50 ? { ...round, userPrompt: '' } : round
        ));
        const adapter = new ChatGPTAdapter();
        const orchestrator = new MessageToolbarOrchestrator(adapter, {
            readerPanel: { show: vi.fn() } as any,
            chatGptConversationEngine: { getSnapshot: vi.fn(async () => snapshot) } as any,
        }) as any;
        orchestrator.getUserPromptForElement = vi.fn(() => 'DOM fallback prompt');
        const assistant = document.querySelector('[data-message-author-role="assistant"][data-message-id]') as HTMLElement;

        const target = await orchestrator.resolveToolbarBookmarkTarget(assistant);

        expect(target?.userPrompt).toBe('');
        expect(orchestrator.getUserPromptForElement).not.toHaveBeenCalled();
    });

    it('fails closed when a ChatGPT toolbar element cannot map to one canonical round', async () => {
        renderVirtualizedChatGptBookmarkDom();
        document.querySelector('[data-message-id="payload-a50"]')?.setAttribute('data-message-id', 'dom-local-id');

        const adapter = new ChatGPTAdapter();
        vi.spyOn(adapter, 'getMessageId').mockReturnValue('payload-a50');
        const bookmarksController = {
            isPositionBookmarked: vi.fn(() => false),
            getDefaultFolderPath: vi.fn(() => '/Inbox'),
            toggleBookmarkFromToolbar: vi.fn(),
            selectFolder: vi.fn(),
        } as any;
        const chatGptConversationEngine = {
            getSnapshot: vi.fn(async () => buildVirtualizedChatGptSnapshot()),
            forceRefreshCurrentConversation: vi.fn(async () => buildVirtualizedChatGptSnapshot()),
        } as any;
        const orchestrator = new MessageToolbarOrchestrator(adapter, {
            readerPanel: { show: vi.fn() } as any,
            bookmarksController,
            chatGptConversationEngine,
            bookmarkSaveDialog,
        }) as any;
        const assistant = document.querySelector('[data-message-author-role="assistant"]') as HTMLElement;
        const actions = orchestrator.getActionsForMessage(assistant, () => ({ setActionActive: vi.fn() }));

        const result = await actions.find((action: any) => action.id === 'bookmark_toggle').onClick();

        expect(result).toEqual(expect.objectContaining({ ok: false }));
        expect(bookmarksController.toggleBookmarkFromToolbar).not.toHaveBeenCalled();
        expect(chatGptConversationEngine.forceRefreshCurrentConversation).not.toHaveBeenCalled();
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

    it('computes ChatGPT word count from the canonical Reader item instead of mounted DOM text', async () => {
        document.body.innerHTML = `
          <article data-turn="assistant">
            <div data-message-author-role="assistant" data-message-id="a1">
              <div class="markdown prose">Partial DOM text</div>
            </div>
          </article>
        `;
        const orchestrator = new MessageToolbarOrchestrator(new ChatGPTAdapter(), {
            readerPanel: { show: vi.fn() } as any,
        }) as any;
        orchestrator.prepareCurrentReaderItemForElement = vi.fn(async () => ({
            id: 'chatgpt-a1',
            userPrompt: 'Question',
            content: 'Canonical complete answer',
            meta: { position: 1, messageId: 'a1' },
        }));
        orchestrator.wordCounter = {
            count: vi.fn((text: string) => ({ text })),
            format: vi.fn(() => '3 Words / 25 Chars'),
        };
        const toolbar = { setStats: vi.fn() };
        const assistant = document.querySelector('[data-message-id="a1"]') as HTMLElement;

        orchestrator.refreshWordCountForToolbar(toolbar, assistant, false);
        await vi.waitFor(() => expect(orchestrator.wordCounter.count).toHaveBeenCalled());

        expect(orchestrator.wordCounter.count).toHaveBeenCalledWith('Canonical complete answer');
        expect(toolbar.setStats).toHaveBeenCalledWith(['3 Words', '25 Chars']);
    });

    it('recomputes ChatGPT word count when the canonical snapshot changes without another DOM mutation', async () => {
        vi.useFakeTimers();
        renderVirtualizedChatGptBookmarkDom();
        const adapter = new ChatGPTAdapter();
        let snapshot = buildVirtualizedChatGptSnapshot();
        let publishSnapshot: ((nextSnapshot: typeof snapshot) => void) | null = null;
        const unsubscribe = vi.fn();
        const chatGptConversationEngine = {
            forceRefreshCurrentConversation: vi.fn(async () => snapshot),
            subscribe: vi.fn((listener: typeof publishSnapshot) => {
                publishSnapshot = listener;
                return unsubscribe;
            }),
        } as any;
        const orchestrator = new MessageToolbarOrchestrator(adapter, {
            readerPanel: { show: vi.fn() } as any,
            chatGptConversationEngine,
        }) as any;
        orchestrator.wordCounter = {
            count: vi.fn((text: string) => ({ text })),
            format: vi.fn(() => '4 Words / 30 Chars'),
        };

        try {
            orchestrator.init();
            await vi.advanceTimersByTimeAsync(1_000);
            await vi.waitFor(() => {
                expect(orchestrator.wordCounter.count).toHaveBeenCalledWith('Answer 50');
            });
            expect(chatGptConversationEngine.subscribe).toHaveBeenCalledTimes(1);
            expect(publishSnapshot).not.toBeNull();
            vi.clearAllTimers();
            const refreshCountBeforePublish = chatGptConversationEngine.forceRefreshCurrentConversation.mock.calls.length;

            snapshot = {
                ...snapshot,
                capturedAt: snapshot.capturedAt + 1,
                rounds: snapshot.rounds.map((round) => (
                    round.assistantMessageId === 'payload-a50'
                        ? { ...round, assistantContent: 'Canonical final answer with more words' }
                        : round
                )),
            };
            publishSnapshot?.(snapshot);
            await vi.waitFor(() => {
                expect(orchestrator.wordCounter.count).toHaveBeenLastCalledWith('Canonical final answer with more words');
            });
            expect(chatGptConversationEngine.forceRefreshCurrentConversation).toHaveBeenCalledTimes(refreshCountBeforePublish);
        } finally {
            orchestrator.dispose();
            adapter.dispose();
            vi.useRealTimers();
        }

        expect(unsubscribe).toHaveBeenCalledTimes(1);
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
        const orchestrator = new MessageToolbarOrchestrator(adapter, { readerPanel, saveMessagesDialog }) as any;

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
        const orchestrator = new MessageToolbarOrchestrator(adapter, {
            readerPanel,
            bookmarksController,
            bookmarkSaveDialog,
        }) as any;
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
