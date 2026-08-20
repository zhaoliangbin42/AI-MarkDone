import { afterEach, describe, expect, it, vi } from 'vitest';
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
import { ChatGPTConversationSurface } from '@/drivers/content/chatgpt/ChatGPTConversationSurface';
import { MessageToolbarOrchestrator } from '@/ui/content/controllers/MessageToolbarOrchestrator';
import { ReaderPanel } from '@/ui/content/reader/ReaderPanel';
import { SiteAdapter, type ThemeDetector } from '@/drivers/content/adapters/base';
import { saveMessagesDialog } from '@/ui/content/export/SaveMessagesDialog';
import { bookmarkSaveDialog } from '@/ui/content/bookmarks/save/bookmarkSaveDialogSingleton';
import {
    createConversationContentSource,
    readyConversationState,
} from '../../../helpers/chatgptContentFixtures';

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
    const ownedSurfaces = new Set<ChatGPTConversationSurface>();

    afterEach(() => {
        for (const surface of ownedSurfaces) surface.dispose();
        ownedSurfaces.clear();
    });

    function buildVirtualizedChatGptSnapshot() {
        return {
            conversationId: 'conv-1',
            revision: 1,
            proof: 'observed-graph' as const,
            capturedAt: Date.now(),
            branchKey: 'payload-a50',
            rounds: Array.from({ length: 50 }, (_, index) => {
                const position = index + 1;
                return {
                    id: `round-${position}`,
                    position,
                    userPrompt: `Question ${position}`,
                    assistantContent: `Answer ${position}`,
                    preview: `Question ${position}`,
                    messageId: `payload-a${position}`,
                    userMessageId: `u${position}`,
                    assistantMessageId: `payload-a${position}`,
                };
            }),
        };
    }

    function createConversationSource(snapshotOrSnapshots: any | any[]) {
        const snapshots = Array.isArray(snapshotOrSnapshots) ? snapshotOrSnapshots : [snapshotOrSnapshots];
        let current = snapshots[0] ?? null;
        // The runtime now reads the initial published snapshot directly.  An
        // explicit refresh should advance to the next fixture snapshot.
        let nextIndex = snapshots.length > 1 ? 1 : 0;
        const unavailable = {
            kind: 'unavailable' as const,
            document: null,
            snapshot: null,
            reason: 'source-unavailable' as const,
            retryable: true,
        };
        const source = createConversationContentSource(
            current ? readyConversationState(current) : unavailable,
        );
        const refresh = vi.fn(async () => {
            current = snapshots[Math.min(nextIndex, snapshots.length - 1)] ?? null;
            nextIndex += 1;
            source.publish(current ? readyConversationState(current) : unavailable);
            return source.read();
        });
        const subscribe = vi.fn((listener: (state: any) => void) => source.subscribe(listener));
        return {
            ...source,
            refresh,
            subscribe,
        };
    }

    function createOrchestrator(adapter: SiteAdapter, options: any) {
        const source = options.conversationContentSource;
        if (adapter.getPlatformId() !== 'chatgpt' || !source) {
            return new MessageToolbarOrchestrator(adapter, options);
        }
        const surface = new ChatGPTConversationSurface({ adapter, content: source });
        ownedSurfaces.add(surface);
        return new MessageToolbarOrchestrator(adapter, {
            ...options,
            conversationSurface: surface,
            conversationMaterialization: options.conversationMaterialization ?? surface.materialization,
        });
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
        const snapshot = {
            conversationId: 'conv-1',
            revision: 1,
            proof: 'observed-graph' as const,
            capturedAt: Date.now(),
            branchKey: 'a1',
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
        };
        const conversationContentSource = createConversationSource(snapshot);
        const orchestrator = createOrchestrator(adapter, { readerPanel, conversationContentSource });

        const assistant = document.querySelector('[data-message-author-role="assistant"][data-message-id]') as HTMLElement;
        const actions = (orchestrator as any).getActionsForMessage(assistant, () => null);
        const readerAction = actions.find((action: any) => action.id === 'reader');

        await readerAction.onClick();

        expect(conversationContentSource.refresh).not.toHaveBeenCalled();
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
        expect(shownItems[0].content).toBe('Formula: $x = y + z$');
    });

    it('preserves Reader position when reopening through the real toolbar trigger', async () => {
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

        const originalScrollHeight = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'scrollHeight');
        const originalClientHeight = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'clientHeight');
        const originalScrollTop = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'scrollTop');
        const scrollTopByElement = new WeakMap<Element, number>();
        Object.defineProperty(HTMLElement.prototype, 'scrollHeight', {
            configurable: true,
            get: () => 2000,
        });
        Object.defineProperty(HTMLElement.prototype, 'clientHeight', {
            configurable: true,
            get: () => 500,
        });
        Object.defineProperty(HTMLElement.prototype, 'scrollTop', {
            configurable: true,
            get() {
                return scrollTopByElement.get(this) ?? 0;
            },
            set(value: number) {
                scrollTopByElement.set(this, Number(value));
            },
        });

        const adapter = new ChatGPTAdapter();
        const readerPanel = new ReaderPanel();
        const snapshot = {
            conversationId: 'conv-1',
            revision: 1,
            proof: 'observed-graph' as const,
            capturedAt: Date.now(),
            branchKey: 'a1',
            rounds: [{
                id: 'round-1',
                position: 1,
                userPrompt: 'Hello from user',
                assistantContent: 'Answer from the canonical Reader source',
                preview: 'Hello from user',
                messageId: 'a1',
                userMessageId: 'u1',
                assistantMessageId: 'a1',
            }],
        };
        const conversationContentSource = createConversationSource(snapshot);
        const orchestrator = createOrchestrator(adapter, { readerPanel, conversationContentSource });

        const getReaderBody = (): HTMLElement | null => document
            .querySelector<HTMLElement>('#aimd-reader-panel-host')
            ?.shadowRoot
            ?.querySelector<HTMLElement>('.reader-body') ?? null;

        try {
            orchestrator.init();
            await vi.waitFor(() => {
                expect(document.querySelector<HTMLElement>('[data-aimd-role="message-toolbar"]')).toBeTruthy();
            });
            const readerButton = document
                .querySelector<HTMLElement>('[data-aimd-role="message-toolbar"]')
                ?.shadowRoot
                ?.querySelector<HTMLButtonElement>('[data-action="reader"]');
            expect(readerButton).toBeTruthy();

            readerButton!.click();
            await vi.waitFor(() => expect(getReaderBody()).toBeTruthy());
            const firstBody = getReaderBody();
            expect(firstBody).toBeTruthy();
            firstBody!.scrollTop = 750;
            firstBody!.dispatchEvent(new Event('scroll'));

            readerButton!.click();
            await vi.waitFor(() => expect(getReaderBody()?.scrollTop).toBe(750));
        } finally {
            orchestrator.dispose();
            adapter.dispose();
            const readerHost = document.querySelector<HTMLElement>('#aimd-reader-panel-host');
            const readerWindow = readerHost?.shadowRoot?.querySelector<HTMLElement>('.panel-window');
            readerPanel.hide();
            readerWindow?.dispatchEvent(new Event('animationend', { bubbles: true }));
            readerHost?.remove();
            if (originalScrollHeight) Object.defineProperty(HTMLElement.prototype, 'scrollHeight', originalScrollHeight);
            else Reflect.deleteProperty(HTMLElement.prototype, 'scrollHeight');
            if (originalClientHeight) Object.defineProperty(HTMLElement.prototype, 'clientHeight', originalClientHeight);
            else Reflect.deleteProperty(HTMLElement.prototype, 'clientHeight');
            if (originalScrollTop) Object.defineProperty(HTMLElement.prototype, 'scrollTop', originalScrollTop);
            else Reflect.deleteProperty(HTMLElement.prototype, 'scrollTop');
        }
    });

    it('validates a fresh Reader result against the V1 content token when both source shapes are present', async () => {
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
        const snapshot = {
            schemaVersion: 1 as const,
            document: {
                key: 'chatgpt:conversation:conv-1',
                platformId: 'chatgpt',
                conversationId: 'conv-1',
            },
            contentToken: 'content-token-1',
            coverage: 'complete' as const,
            turns: [{
                key: 'turn-1:a1',
                ordinal: 1,
                identity: {
                    turnId: 'turn-1',
                    userMessageId: null,
                    assistantMessageId: 'a1',
                },
                userText: 'Hello from user',
                assistantMarkdown: 'Hi',
            }],
        };
        const v1State = {
            kind: 'ready' as const,
            document: snapshot.document,
            snapshot,
        };
        const conversationContentSource = {
            read: vi.fn(() => v1State),
            refresh: vi.fn(async () => v1State),
            subscribe: vi.fn((listener: (state: typeof v1State) => void) => {
                listener(v1State);
                return vi.fn();
            }),
            isCurrent: vi.fn(() => true),
        } as any;
        const readerPanel = { show: vi.fn(async () => undefined) } as any;
        const orchestrator = createOrchestrator(adapter, {
            readerPanel,
            conversationContentSource,
        }) as any;

        try {
            const assistant = document.querySelector('[data-message-author-role="assistant"][data-message-id]') as HTMLElement;
            const readerAction = orchestrator
                .getActionsForMessage(assistant, () => null)
                .find((action: any) => action.id === 'reader');

            const result = await readerAction.onClick();

            expect(result).toBeUndefined();
            expect(readerPanel.show).toHaveBeenCalledTimes(1);
        } finally {
            orchestrator.dispose();
            adapter.dispose();
        }
    });

    it('keeps the Reader surface mountable when the fresh ChatGPT source is unavailable', async () => {
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
        const conversationContentSource = createConversationSource(null);
        const orchestrator = createOrchestrator(adapter, { readerPanel, conversationContentSource });

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
            revision: 1,
            proof: 'observed-graph' as const,
            capturedAt: Date.now(),
            branchKey: 'branch-1',
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
        const conversationContentSource = createConversationSource(snapshot);
        const orchestrator = createOrchestrator(adapter, { readerPanel, conversationContentSource });

        const assistant = document.querySelector('[data-message-author-role="assistant"][data-message-id]') as HTMLElement;
        const actions = (orchestrator as any).getActionsForMessage(assistant, () => null);
        const readerAction = actions.find((action: any) => action.id === 'reader');

        await readerAction.onClick();

        expect(conversationContentSource.refresh).not.toHaveBeenCalled();
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
        expect(shownItems[0].content).toBe(
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
            revision: 1,
            proof: 'observed-graph' as const,
            capturedAt: Date.now(),
            branchKey: 'branch-1',
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
        const conversationContentSource = createConversationSource(snapshot);
        const orchestrator = createOrchestrator(adapter, { readerPanel, conversationContentSource });

        orchestrator.init();

        const reportStack = document.querySelector('.report-stack') as HTMLElement;
        await vi.waitFor(() => {
            expect(reportStack.querySelectorAll(':scope > [data-aimd-role="message-toolbar"]')).toHaveLength(1);
        });
        const toolbarHost = reportStack.querySelector<HTMLElement>(':scope > [data-aimd-role="message-toolbar"]');
        expect(toolbarHost).toBeInstanceOf(HTMLElement);
        expect(toolbarHost?.previousElementSibling?.classList.contains('report-widget')).toBe(true);
        expect(toolbarHost?.style.alignSelf).toBe('flex-end');

        const readerButton = toolbarHost?.shadowRoot?.querySelector<HTMLButtonElement>('[data-action="reader"]');
        expect(readerButton).toBeInstanceOf(HTMLButtonElement);
        readerButton?.click();

        await vi.waitFor(() => expect(readerPanel.show).toHaveBeenCalledTimes(1));
        expect(shownItems[0].content).toBe('# Deep Research Report\n\nFull report body.');

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
        const snapshot = {
            conversationId: 'conv-1',
            revision: 1,
            rounds: [{
                id: 'deep-user-turn',
                position: 1,
                userPrompt: 'Research this topic',
                assistantContent: '# Deep Research Report',
                messageId: 'deep-assistant-turn',
                userMessageId: 'deep-user-message',
                assistantMessageId: 'deep-assistant-turn',
            }],
        };
        const conversationContentSource = createConversationSource(snapshot);
        const orchestrator = createOrchestrator(adapter, { readerPanel, conversationContentSource });

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

    it('injects a working toolbar for a mounted assistant whose preceding user host slot is virtualized', async () => {
        window.history.replaceState({}, '', '/c/conv-1');
        document.body.innerHTML = `
          <main>
            <div id="turn-slots">
              <div data-turn-id-container="virtualized-user-slot"></div>
              <div data-turn-id-container="assistant-slot">
                <section data-turn="assistant" data-turn-id="assistant-turn-7">
                  <div data-message-author-role="assistant" data-message-id="assistant-7">
                    <div class="markdown prose">Visible DOM answer</div>
                  </div>
                  <div class="z-0 flex">
                    <div><button data-testid="copy-turn-action-button">copy</button></div>
                  </div>
                </section>
              </div>
            </div>
          </main>
        `;
        const snapshot = {
            conversationId: 'conv-1',
            revision: 1,
            proof: 'observed-graph' as const,
            branchKey: 'assistant-turn-7',
            capturedAt: Date.now(),
            rounds: [{
                id: 'user-turn-7',
                position: 7,
                userPrompt: 'Canonical question 7',
                assistantContent: 'Canonical complete answer seven',
                preview: 'Canonical question 7',
                messageId: 'assistant-7',
                userMessageId: 'user-7',
                assistantMessageId: 'assistant-7',
            }],
        };
        let shownItems: any[] = [];
        const readerPanel = {
            show: vi.fn(async (items: any[]) => {
                shownItems = items;
            }),
        } as any;
        const conversationContentSource = createConversationSource(snapshot);
        const adapter = new ChatGPTAdapter();
        const orchestrator = createOrchestrator(adapter, {
            readerPanel,
            conversationContentSource,
        }) as any;

        try {
            orchestrator.init();

            await vi.waitFor(() => {
                const toolbarHost = document.querySelector<HTMLElement>('[data-aimd-role="message-toolbar"]');
                expect(toolbarHost).toBeInstanceOf(HTMLElement);
                const statsText = toolbarHost?.shadowRoot
                    ?.querySelector<HTMLElement>('[data-role="stats"]')
                    ?.textContent
                    ?.trim();
                expect(statsText).toBeTruthy();
                expect(statsText).not.toBe('—');
            });

            const toolbarHost = document.querySelector<HTMLElement>('[data-aimd-role="message-toolbar"]');
            toolbarHost?.shadowRoot
                ?.querySelector<HTMLButtonElement>('[data-action="reader"]')
                ?.click();
            await vi.waitFor(() => expect(readerPanel.show).toHaveBeenCalledTimes(1));

            expect(shownItems).toHaveLength(1);
            expect(shownItems[0]).toMatchObject({
                userPrompt: 'Canonical question 7',
                meta: {
                    position: 1,
                    assistantMessageId: 'assistant-7',
                },
            });
            expect(shownItems[0].content).toBe('Canonical complete answer seven');
        } finally {
            orchestrator.dispose();
            adapter.dispose();
        }
    });

    it('injects through shared materialization when only the cached assistant surface is mounted', async () => {
        window.history.replaceState({}, '', '/c/conv-1');
        document.body.innerHTML = `
          <main>
            <section
              data-testid="conversation-turn-14"
              data-turn="assistant"
              data-turn-id="assistant-turn-14"
              data-turn-id-container="assistant-turn-14"
            >
              <div data-message-author-role="assistant" data-message-id="assistant-14">
                <div class="markdown prose">Visible DOM answer</div>
              </div>
              <div class="z-0 flex">
                <div><button data-testid="copy-turn-action-button">copy</button></div>
              </div>
            </section>
          </main>
        `;
        const snapshot = {
            conversationId: 'conv-1',
            revision: 1,
            proof: 'observed-graph' as const,
            branchKey: 'assistant-14',
            capturedAt: Date.now(),
            rounds: [{
                id: 'user-turn-14',
                position: 14,
                userPrompt: 'Canonical question 14',
                assistantContent: 'Canonical complete answer fourteen',
                preview: 'Canonical question 14',
                messageId: 'assistant-14',
                userMessageId: 'user-14',
                assistantMessageId: 'assistant-14',
            }],
        };
        const conversationContentSource = createConversationSource(snapshot);
        const adapter = new ChatGPTAdapter();
        const surface = new ChatGPTConversationSurface({
            adapter,
            content: conversationContentSource,
        });
        ownedSurfaces.add(surface);
        const orchestrator = new MessageToolbarOrchestrator(adapter, {
            readerPanel: { show: vi.fn() } as any,
            conversationContentSource,
            conversationMaterialization: surface.materialization,
            conversationSurface: surface,
        });

        try {
            orchestrator.init();
            await vi.waitFor(() => {
                const toolbar = document.querySelector<HTMLElement>('[data-aimd-role="message-toolbar"]');
                expect(toolbar).toBeInstanceOf(HTMLElement);
                const statsText = toolbar?.shadowRoot
                    ?.querySelector<HTMLElement>('[data-role="stats"]')
                    ?.textContent
                    ?.trim();
                expect(statsText).toBeTruthy();
                expect(statsText).not.toBe('—');
            });
        } finally {
            orchestrator.dispose();
            adapter.dispose();
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
            revision: 1,
            proof: 'observed-graph' as const,
            capturedAt: Date.now(),
            branchKey: 'branch-1',
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
        const conversationContentSource = createConversationSource([initialSnapshot, refreshedSnapshot]);
        const orchestrator = createOrchestrator(adapter, { readerPanel, conversationContentSource });

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

        expect(conversationContentSource.refresh).toHaveBeenCalledOnce();
        expect(readerPanel.show).toHaveBeenCalledTimes(2);
        expect(readerPanel.show.mock.calls[1][1]).toBe(0);
        expect(shownItems[0].content).toBe('Refreshed answer with $x+y$');
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
            conversationId: 'conv-1', revision: 1, proof: 'observed-graph' as const, branchKey: 'old-a2', capturedAt: 1,
            rounds: [{ id: 'old-round', position: 2, userPrompt: 'Old question', assistantContent: 'Old answer', preview: 'Old question', messageId: 'old-a2', userMessageId: 'old-u', assistantMessageId: 'old-a2' }],
        };
        const refreshedSnapshot = {
            conversationId: 'conv-1', revision: 2, proof: 'observed-graph' as const, branchKey: 'new-a2', capturedAt: 2,
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
        const conversationContentSource = createConversationSource([initialSnapshot, refreshedSnapshot]);
        const adapter = new ChatGPTAdapter();
        const orchestrator = createOrchestrator(adapter, { readerPanel, conversationContentSource });
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

    it('keeps every opened Reader item immutable until a new snapshot revision arrives', async () => {
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
            revision: 1,
            proof: 'observed-graph' as const,
            capturedAt: Date.now(),
            branchKey: 'branch-1',
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
        const conversationContentSource = createConversationSource([firstSnapshot, refreshedSnapshot]);
        const orchestrator = createOrchestrator(adapter, { readerPanel, conversationContentSource });

        const assistant = document.querySelector('[data-message-author-role="assistant"][data-message-id]') as HTMLElement;
        const actions = (orchestrator as any).getActionsForMessage(assistant, () => null);
        const readerAction = actions.find((action: any) => action.id === 'reader');

        await readerAction.onClick();

        expect(typeof shownItems[0]?.content).toBe('string');
        expect(shownItems[1]?.content).toBe('Tail before');
        expect(conversationContentSource.refresh).not.toHaveBeenCalled();
    });

    it('keeps the original Reader content when no later snapshot is published', async () => {
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
            revision: 1,
            proof: 'observed-graph' as const,
            capturedAt: Date.now(),
            branchKey: 'branch-1',
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
        const conversationContentSource = createConversationSource([snapshot, null]);
        const orchestrator = createOrchestrator(adapter, { readerPanel, conversationContentSource });

        const assistant = document.querySelector('[data-message-author-role="assistant"][data-message-id]') as HTMLElement;
        const actions = (orchestrator as any).getActionsForMessage(assistant, () => null);
        const readerAction = actions.find((action: any) => action.id === 'reader');

        await readerAction.onClick();

        expect(shownItems[0].content).toBe('Original tail');
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
        const conversationContentSource = createConversationSource(buildVirtualizedChatGptSnapshot());
        const orchestrator = createOrchestrator(adapter, { readerPanel, conversationContentSource });

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
        expect(conversationContentSource.refresh).not.toHaveBeenCalled();
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
        const orchestrator = createOrchestrator(adapter, { readerPanel }) as any;

        await orchestrator.syncReaderTailPages();

        expect(readerPanel.appendItem).not.toHaveBeenCalled();
    });


    it('saves ChatGPT bookmarks from the exact Surface-mapped element even when the adapter exposes a local fallback id', async () => {
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
            readPositionBookmarkStatus: vi.fn(async () => ({ ok: true, data: { saved: false } })),
            getDefaultFolderPath: vi.fn(() => '/Inbox'),
            setPositionBookmarkSaved: vi.fn(async () => ({ ok: true, data: { saved: true } })),
            selectFolder: vi.fn(),
        } as any;
        const conversationContentSource = createConversationSource(buildVirtualizedChatGptSnapshot());
        const orchestrator = createOrchestrator(adapter, {
            readerPanel,
            bookmarksController,
            conversationContentSource,
            bookmarkSaveDialog,
        }) as any;

        const assistant = document.querySelector('[data-message-author-role="assistant"][data-message-id]') as HTMLElement;
        const toolbar = {
            setActionActive: vi.fn(),
            setActionDisabled: vi.fn(),
        };
        const actions = orchestrator.getActionsForMessage(assistant, () => toolbar);
        const bookmarkAction = actions.find((action: any) => action.id === 'bookmark_toggle');

        await bookmarkAction.onClick();

        expect(bookmarksController.setPositionBookmarkSaved).toHaveBeenCalledWith(expect.objectContaining({
            position: 50,
            messageId: 'payload-a50',
            userMessage: 'Question 50',
            aiResponse: 'Answer 50',
        }), true);
        expect(conversationContentSource.refresh).not.toHaveBeenCalled();
        expect(toolbar.setActionActive).toHaveBeenCalledWith('bookmark_toggle', true);
    });

    it('does not fill a canonical ChatGPT bookmark prompt from DOM text', async () => {
        renderVirtualizedChatGptBookmarkDom();
        const snapshot = buildVirtualizedChatGptSnapshot();
        snapshot.rounds = snapshot.rounds.map((round: any) => (
            round.position === 50 ? { ...round, userPrompt: '' } : round
        ));
        const adapter = new ChatGPTAdapter();
        const conversationContentSource = createConversationSource(snapshot);
        const bookmarksController = {
            isPositionBookmarked: vi.fn(() => false),
            readPositionBookmarkStatus: vi.fn(async () => ({ ok: true, data: { saved: false } })),
            getDefaultFolderPath: vi.fn(() => '/Inbox'),
            setPositionBookmarkSaved: vi.fn(),
        } as any;
        const orchestrator = createOrchestrator(adapter, {
            readerPanel: { show: vi.fn() } as any,
            bookmarksController,
            bookmarkSaveDialog,
            conversationContentSource,
        }) as any;
        const assistant = document.querySelector('[data-message-author-role="assistant"][data-message-id]') as HTMLElement;

        const action = orchestrator.getActionsForMessage(assistant, () => ({ setActionActive: vi.fn() }))
            .find((candidate: any) => candidate.id === 'bookmark_toggle');
        const result = await action.onClick();

        expect(result).toEqual(expect.objectContaining({ ok: false }));
        expect(bookmarksController.setPositionBookmarkSaved).not.toHaveBeenCalled();
    });

    it('does not save a ChatGPT bookmark when the canonical assistant body is empty', async () => {
        renderVirtualizedChatGptBookmarkDom();
        const snapshot = buildVirtualizedChatGptSnapshot();
        snapshot.rounds = snapshot.rounds.map((round: any) => (
            round.position === 50 ? { ...round, assistantContent: '' } : round
        ));
        const adapter = new ChatGPTAdapter();
        const conversationContentSource = createConversationSource(snapshot);
        const bookmarksController = {
            isPositionBookmarked: vi.fn(() => false),
            readPositionBookmarkStatus: vi.fn(async () => ({ ok: true, data: { saved: false } })),
            getDefaultFolderPath: vi.fn(() => '/Inbox'),
            setPositionBookmarkSaved: vi.fn(),
        } as any;
        const orchestrator = createOrchestrator(adapter, {
            readerPanel: { show: vi.fn() } as any,
            bookmarksController,
            conversationContentSource,
            bookmarkSaveDialog,
        }) as any;
        const assistant = document.querySelector('[data-message-author-role="assistant"]') as HTMLElement;
        const action = orchestrator.getActionsForMessage(assistant, () => ({ setActionActive: vi.fn() }))
            .find((candidate: any) => candidate.id === 'bookmark_toggle');

        const result = await action.onClick();

        expect(result).toEqual(expect.objectContaining({ ok: false }));
        expect(bookmarkSaveDialog.open).not.toHaveBeenCalled();
        expect(bookmarksController.setPositionBookmarkSaved).not.toHaveBeenCalled();
    });

    it('fails closed when a ChatGPT toolbar element cannot map to one canonical round', async () => {
        renderVirtualizedChatGptBookmarkDom();
        document.querySelector('[data-message-id="payload-a50"]')?.setAttribute('data-message-id', 'dom-local-id');

        const adapter = new ChatGPTAdapter();
        vi.spyOn(adapter, 'getMessageId').mockReturnValue('payload-a50');
        const bookmarksController = {
            isPositionBookmarked: vi.fn(() => false),
            readPositionBookmarkStatus: vi.fn(async () => ({ ok: true, data: { saved: false } })),
            getDefaultFolderPath: vi.fn(() => '/Inbox'),
            setPositionBookmarkSaved: vi.fn(),
            selectFolder: vi.fn(),
        } as any;
        const conversationContentSource = createConversationSource(buildVirtualizedChatGptSnapshot());
        const orchestrator = createOrchestrator(adapter, {
            readerPanel: { show: vi.fn() } as any,
            bookmarksController,
            conversationContentSource,
            bookmarkSaveDialog,
        }) as any;
        const assistant = document.querySelector('[data-message-author-role="assistant"]') as HTMLElement;
        const actions = orchestrator.getActionsForMessage(assistant, () => ({ setActionActive: vi.fn() }));

        const result = await actions.find((action: any) => action.id === 'bookmark_toggle').onClick();

        expect(result).toEqual(expect.objectContaining({ ok: false }));
        expect(bookmarksController.setPositionBookmarkSaved).not.toHaveBeenCalled();
        expect(conversationContentSource.refresh).not.toHaveBeenCalled();
    });

    it('highlights ChatGPT bookmark buttons by payload position instead of DOM-local position', async () => {
        renderVirtualizedChatGptBookmarkDom();

        const adapter = new ChatGPTAdapter();
        const readerPanel = { show: vi.fn(async () => undefined) } as any;
        const bookmarksController = {
            isPositionBookmarked: vi.fn((_url: string, position: number) => position === 50),
            resolveConversationBookmarkPositions: vi.fn(() => new Set([50])),
        } as any;
        const conversationContentSource = createConversationSource(buildVirtualizedChatGptSnapshot());
        const orchestrator = createOrchestrator(adapter, { readerPanel, bookmarksController, conversationContentSource }) as any;

        const assistant = document.querySelector('[data-message-author-role="assistant"][data-message-id]') as HTMLElement;
        const toolbar = {
            setActionActive: vi.fn(),
            setActionDisabled: vi.fn(),
        };
        (orchestrator as any).refreshBookmarkStateForToolbar(toolbar, assistant, 2);
        await new Promise<void>((resolve) => setTimeout(resolve, 0));

        expect(bookmarksController.resolveConversationBookmarkPositions).toHaveBeenCalledWith(
            expect.any(String),
            expect.arrayContaining([
                expect.objectContaining({ position: 50, assistantMessageId: 'payload-a50' }),
            ]),
        );
        expect(bookmarksController.isPositionBookmarked).not.toHaveBeenCalled();
        expect(toolbar.setActionDisabled).toHaveBeenCalledWith('bookmark_toggle', false);
        expect(toolbar.setActionActive).toHaveBeenCalledWith('bookmark_toggle', true);
        expect(conversationContentSource.refresh).not.toHaveBeenCalled();
    });

    it('uses the canonical bookmark projection for the Reader footer toggle', async () => {
        const adapter = new ChatGPTAdapter();
        const conversationContentSource = createConversationSource(buildVirtualizedChatGptSnapshot());
        const bookmarksController = {
            isPositionBookmarked: vi.fn(() => false),
            resolveConversationBookmarkPositions: vi.fn(() => new Set([50])),
        } as any;
        const orchestrator = createOrchestrator(adapter, {
            readerPanel: { show: vi.fn() } as any,
            bookmarksController,
            conversationContentSource,
        }) as any;
        const toggle = vi.spyOn(orchestrator, 'runBookmarkToggle').mockResolvedValue({
            ok: true,
            bookmarked: true,
            message: 'saved',
        });
        const bookmarkAction = orchestrator.getReaderActions(document.body)
            .find((action: any) => action.id === 'bookmark_toggle');

        await bookmarkAction.onClick({
            item: {
                id: 'chatgpt-payload-a50',
                userPrompt: 'Question 50',
                content: 'Answer 50',
                meta: { url: 'https://chatgpt.com/c/123', position: 50, messageId: 'payload-a50' },
            },
            notify: vi.fn(),
            rerender: vi.fn(),
        });

        expect(toggle).toHaveBeenCalledWith(expect.objectContaining({
            position: 50,
            alreadyBookmarked: true,
        }));
        expect(bookmarksController.isPositionBookmarked).not.toHaveBeenCalled();
    });

    it('invalidates passive toolbar state and closes Save Messages when the source withdraws its snapshot', () => {
        const adapter = new ChatGPTAdapter();
        const conversationContentSource = createConversationSource(buildVirtualizedChatGptSnapshot());
        const saveMessagesDialog = {
            isOpen: vi.fn(() => true),
            close: vi.fn(),
        } as any;
        const orchestrator = createOrchestrator(adapter, {
            readerPanel: { show: vi.fn() } as any,
            conversationContentSource,
            saveMessagesDialog,
        }) as any;
        orchestrator.init();

        conversationContentSource.publish({
            kind: 'unavailable',
            document: conversationContentSource.read().document,
            snapshot: null,
            reason: 'identity-conflict',
            retryable: false,
        });

        expect(saveMessagesDialog.close).toHaveBeenCalledOnce();
    });

    it('keeps an opened export dialog while the same conversation snapshot is syncing', async () => {
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
        const snapshot = {
            conversationId: 'conv-1',
            revision: 1,
            proof: 'observed-graph' as const,
            capturedAt: Date.now(),
            branchKey: 'a1',
            rounds: [{
                id: 'round-1',
                position: 1,
                userPrompt: 'Hello from user',
                assistantContent: 'Hi',
                preview: 'Hello from user',
                messageId: 'a1',
                userMessageId: 'u1',
                assistantMessageId: 'a1',
            }],
        };
        let dialogOpen = false;
        const saveMessagesDialog = {
            isOpen: vi.fn(() => dialogOpen),
            close: vi.fn(() => { dialogOpen = false; }),
            open: vi.fn(async () => {
                dialogOpen = true;
                return true;
            }),
        } as any;
        const conversationContentSource = createConversationSource(snapshot);
        const orchestrator = createOrchestrator(adapter, {
            readerPanel: { show: vi.fn() } as any,
            conversationContentSource,
            saveMessagesDialog,
        }) as any;

        try {
            orchestrator.init();
            const assistant = document.querySelector('[data-message-author-role="assistant"][data-message-id]') as HTMLElement;
            const exportAction = orchestrator
                .getActionsForMessage(assistant, () => null)
                .find((action: any) => action.id === 'export');
            await exportAction.onClick();

            conversationContentSource.publish({
                kind: 'syncing',
                document: conversationContentSource.read().document,
                snapshot: conversationContentSource.read().snapshot,
            });

            expect(saveMessagesDialog.close).not.toHaveBeenCalled();
            expect(dialogOpen).toBe(true);
        } finally {
            orchestrator.dispose();
            adapter.dispose();
        }
    });

    it('rejects a bookmark write when the source revision changes while the save dialog is open', async () => {
        renderVirtualizedChatGptBookmarkDom();
        const adapter = new ChatGPTAdapter();
        const initialSnapshot = buildVirtualizedChatGptSnapshot();
        const conversationContentSource = createConversationSource(initialSnapshot);
        let resolveDialog!: (value: any) => void;
        const pendingDialog = new Promise<any>((resolve) => {
            resolveDialog = resolve;
        });
        const bookmarkSaveDialog = {
            open: vi.fn(() => pendingDialog),
        } as any;
        const bookmarksController = {
            isPositionBookmarked: vi.fn(() => false),
            readPositionBookmarkStatus: vi.fn(async () => ({ ok: true, data: { saved: false } })),
            getDefaultFolderPath: vi.fn(() => '/Inbox'),
            setPositionBookmarkSaved: vi.fn(),
        } as any;
        const orchestrator = createOrchestrator(adapter, {
            readerPanel: { show: vi.fn() } as any,
            conversationContentSource,
            bookmarkSaveDialog,
            bookmarksController,
        }) as any;
        const assistant = document.querySelector('[data-message-id="payload-a50"]') as HTMLElement;
        const action = orchestrator.getActionsForMessage(assistant, () => ({ setActionActive: vi.fn() }))
            .find((candidate: any) => candidate.id === 'bookmark_toggle');

        const resultPromise = action.onClick();
        await vi.waitFor(() => expect(bookmarkSaveDialog.open).toHaveBeenCalledOnce());
        conversationContentSource.publish({
            ...initialSnapshot,
            revision: initialSnapshot.revision + 1,
            capturedAt: initialSnapshot.capturedAt + 1,
        });
        resolveDialog({ ok: true, folderPath: '/Research', title: 'Question 50' });
        const result = await resultPromise;

        expect(result).toEqual(expect.objectContaining({ ok: false }));
        expect(bookmarksController.setPositionBookmarkSaved).not.toHaveBeenCalled();
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
        const orchestrator = createOrchestrator(adapter, { readerPanel });
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
        const adapter = new ChatGPTAdapter();
        const snapshot = {
            conversationId: 'conv-1',
            revision: 1,
            proof: 'observed-graph',
            branchKey: 'a1',
            capturedAt: 1,
            rounds: [{
                id: 'round-1',
                position: 1,
                userPrompt: 'Question',
                assistantContent: 'Canonical complete answer',
                preview: 'Question',
                messageId: 'a1',
                userMessageId: 'u1',
                assistantMessageId: 'a1',
            }],
        };
        const conversationContentSource = createConversationSource(snapshot);
        const orchestrator = createOrchestrator(adapter, {
            readerPanel: { show: vi.fn() } as any,
            conversationContentSource,
        }) as any;
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
        const conversationContentSource = createConversationSource(snapshot) as any;
        const orchestrator = createOrchestrator(adapter, {
            readerPanel: { show: vi.fn() } as any,
            conversationContentSource,
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
            expect(conversationContentSource.subscribe).toHaveBeenCalledTimes(1);
            vi.clearAllTimers();
            const refreshCountBeforePublish = conversationContentSource.refresh.mock.calls.length;

            snapshot = {
                ...snapshot,
                revision: snapshot.revision + 1,
                capturedAt: snapshot.capturedAt + 1,
                rounds: snapshot.rounds.map((round) => (
                    round.assistantMessageId === 'payload-a50'
                        ? { ...round, assistantContent: 'Canonical final answer with more words' }
                        : round
                )),
            };
            conversationContentSource.publish(snapshot);
            await vi.waitFor(() => {
                expect(orchestrator.wordCounter.count).toHaveBeenLastCalledWith('Canonical final answer with more words');
            });
            expect(conversationContentSource.refresh).toHaveBeenCalledTimes(refreshCountBeforePublish);
        } finally {
            orchestrator.dispose();
            adapter.dispose();
            vi.useRealTimers();
        }
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
        const orchestrator = createOrchestrator(adapter, { readerPanel, saveMessagesDialog }) as any;

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
            readPositionBookmarkStatus: vi.fn(async () => ({ ok: true, data: { saved: false } })),
            getDefaultFolderPath: vi.fn(() => '/Inbox'),
            setPositionBookmarkSaved: vi.fn(async () => ({ ok: true, data: { saved: true } })),
            selectFolder: vi.fn(),
        } as any;
        const orchestrator = createOrchestrator(adapter, {
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
        expect(bookmarksController.setPositionBookmarkSaved).toHaveBeenCalledWith(expect.objectContaining({
            platform: 'unknown',
            position: 7,
            messageId: 'm1',
            folderPath: '/Research',
            title: 'Prompt',
        }), true);
    });

    it('does not open the save dialog or mutate when canonical message bookmark status is unavailable', async () => {
        document.body.innerHTML = `
          <div class="assistant-message" data-message-id="m1" data-aimd-msg-position="7">
            <div class="content">First</div>
            <div class="official-toolbar"><button>copy</button></div>
          </div>
        `;

        const adapter = new UnknownAdapter();
        const bookmarksController = {
            isPositionBookmarked: vi.fn(() => false),
            readPositionBookmarkStatus: vi.fn(async () => ({
                ok: false,
                errorCode: 'RECEIVER_UNAVAILABLE',
                message: 'Extension background is unavailable.',
                failure: {
                    kind: 'transport',
                    code: 'RECEIVER_UNAVAILABLE',
                    message: 'Extension background is unavailable.',
                    delivery: 'not-sent',
                },
            })),
            getDefaultFolderPath: vi.fn(() => '/Inbox'),
            setPositionBookmarkSaved: vi.fn(),
        } as any;
        const orchestrator = createOrchestrator(adapter, {
            readerPanel: { show: vi.fn(async () => undefined) } as any,
            bookmarksController,
            bookmarkSaveDialog,
        }) as any;
        orchestrator.getUserPromptForElement = vi.fn(() => 'Prompt');
        const assistant = document.querySelector('.assistant-message') as HTMLElement;
        const action = orchestrator.getActionsForMessage(assistant, () => ({ setActionActive: vi.fn() }))
            .find((candidate: any) => candidate.id === 'bookmark_toggle');

        const result = await action.onClick();

        expect(result).toEqual({ ok: false, message: 'Extension background is unavailable.' });
        expect(bookmarkSaveDialog.open).not.toHaveBeenCalled();
        expect(bookmarksController.setPositionBookmarkSaved).not.toHaveBeenCalled();
    });
});
