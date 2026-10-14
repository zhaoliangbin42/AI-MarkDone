// @vitest-environment-options {"url":"https://chatgpt.com"}
import { afterEach, describe, expect, it, vi } from 'vitest';
import userEvent from '@testing-library/user-event';
const navigationMocks = vi.hoisted(() => ({
    navigateChatGPTDirectoryTarget: vi.fn(async () => ({ ok: true })),
    conversationNavigation: {
        navigate: vi.fn(async () => ({ ok: true as const })),
        cancelActive: vi.fn(),
    },
}));

vi.mock('@/ui/content/bookmarks/save/bookmarkSaveDialogSingleton', () => ({
    bookmarkSaveDialog: {
        open: vi.fn(),
        setTheme: vi.fn(),
    },
}));
vi.mock('@/ui/content/chatgptDirectory/navigation', () => ({
    navigateChatGPTDirectoryTarget: navigationMocks.navigateChatGPTDirectoryTarget,
}));
import { ChatGPTAdapter } from '@/drivers/content/adapters/sites/chatgpt';
import { ChatGPTConversationSurface } from '@/drivers/content/chatgpt/ChatGPTConversationSurface';
import { MessageToolbarOrchestrator } from '@/ui/content/controllers/MessageToolbarOrchestrator';
import { ChatGPTConversationReaderBinding } from '@/ui/content/controllers/ChatGPTConversationReaderBinding';
import { bookmarkSaveDialog } from '@/ui/content/bookmarks/save/bookmarkSaveDialogSingleton';
import { ReaderPanel } from '@/ui/content/reader/ReaderPanel';
import { clearReaderCommentScope, saveReaderComment } from '@/services/reader/commentSession';
import type { ConversationNavigationResultV1 } from '@/contracts/conversationNavigation';
import { createConversationContentSource } from '../../../helpers/chatgptContentFixtures';

describe('ReaderPanel bookmark action injection', () => {
    const ownedOrchestrators = new Set<MessageToolbarOrchestrator>();
    const ownedSurfaces = new Set<ChatGPTConversationSurface>();
    const ownedAdapters = new Set<ChatGPTAdapter>();
    const ownedPanels = new Set<ReaderPanel>();
    const ownedBindings = new Set<ChatGPTConversationReaderBinding>();

    afterEach(async () => {
        for (const binding of ownedBindings) binding.dispose();
        for (const orchestrator of ownedOrchestrators) orchestrator.dispose();
        for (const surface of ownedSurfaces) surface.dispose();
        for (const adapter of ownedAdapters) adapter.dispose();
        for (const panel of ownedPanels) panel.hide();
        if (ownedPanels.size > 0) {
            await vi.waitFor(() => expect(document.querySelector('#aimd-reader-panel-host')).toBeNull());
        }
        ownedOrchestrators.clear();
        ownedSurfaces.clear();
        ownedAdapters.clear();
        ownedPanels.clear();
        ownedBindings.clear();
        clearReaderCommentScope('reader-panel-comments-v1');
        document.body.innerHTML = '';
    });

    function createOrchestrator(adapter: ChatGPTAdapter, options: any, conversationId = 'conv-1') {
        window.history.replaceState({}, '', `/c/${conversationId}`);
        const snapshot = {
            conversationId,
            revision: 1,
            proof: 'observed-graph' as const,
            branchKey: 'a1',
            capturedAt: 1,
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
        const source = createConversationContentSource(snapshot);
        const surface = new ChatGPTConversationSurface({ adapter, content: source });
        const orchestrator = new MessageToolbarOrchestrator(adapter, {
            ...options,
            conversationContentSource: source,
            conversationMaterialization: surface.materialization,
            conversationSurface: surface,
        });
        ownedAdapters.add(adapter);
        ownedSurfaces.add(surface);
        ownedOrchestrators.add(orchestrator);
        return orchestrator;
    }

    it('injects a header bookmark action for conversation reader entries', async () => {
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
              <button data-testid="copy-turn-action-button">copy</button>
            </article>
          </div>
        `;

        const adapter = new ChatGPTAdapter();
        const readerPanel = {
            show: vi.fn(async () => undefined),
            getCommentExportContext: vi.fn(() => null),
        } as any;
        const bookmarksController = {
            isPositionBookmarked: vi.fn(() => false),
        } as any;
        const orchestrator = createOrchestrator(adapter, { readerPanel, bookmarksController });
        const assistant = document.querySelector('[data-message-author-role="assistant"][data-message-id]') as HTMLElement;

        (orchestrator as any).rebuildTurnIndex();
        const actions = (orchestrator as any).getActionsForMessage(assistant, () => null);
        const readerAction = actions.find((action: any) => action.id === 'reader');

        await readerAction.onClick();

        expect(readerPanel.show).toHaveBeenCalledTimes(1);
        const options = readerPanel.show.mock.calls[0][3];
        const bookmarkAction = options.actions.find((action: any) => action.id === 'bookmark_toggle');
        const locateAction = options.actions.find((action: any) => action.id === 'locate');
        expect(options.profile).toBe('conversation-reader');
        expect(bookmarkAction).toBeTruthy();
        expect(bookmarkAction.placement).toBe('header');
        expect(locateAction).toBeTruthy();
        expect(locateAction.placement).toBe('footer_left');
        expect(locateAction.tooltip).toBe('jumpToMessage');
    });

    it('uses the shared navigation port for reader locate actions', async () => {
        document.body.innerHTML = `
          <div data-turn-id-container id="user-1"><section data-turn="user"></section></div>
          <div data-turn-id-container id="assistant-1">
            <section data-turn="assistant">
              <div data-message-author-role="assistant" data-message-id="a1">
                <div class="markdown prose">Hi</div>
              </div>
            </section>
          </div>
        `;

        navigationMocks.navigateChatGPTDirectoryTarget.mockClear();
        navigationMocks.conversationNavigation.navigate.mockClear();

        const adapter = new ChatGPTAdapter();
        const readerPanel = {
            show: vi.fn(async () => undefined),
            hide: vi.fn(),
            getCommentExportContext: vi.fn(() => null),
        } as any;
        const bookmarksController = {
            isPositionBookmarked: vi.fn(() => false),
        } as any;
        const orchestrator = createOrchestrator(adapter, {
            readerPanel,
            bookmarksController,
            conversationNavigation: navigationMocks.conversationNavigation,
        });
        const assistant = document.querySelector('[data-message-author-role="assistant"][data-message-id]') as HTMLElement;

        (orchestrator as any).rebuildTurnIndex();
        const actions = (orchestrator as any).getActionsForMessage(assistant, () => null);
        const readerAction = actions.find((action: any) => action.id === 'reader');

        await readerAction.onClick();

        const options = readerPanel.show.mock.calls[0][3];
        const locateAction = options.actions.find((action: any) => action.id === 'locate');
        expect(locateAction).toBeTruthy();

        await locateAction.onClick({
            item: {
                meta: { position: 1, messageId: 'a1' },
            },
            notify: vi.fn(),
        });

        expect(readerPanel.hide).toHaveBeenCalledTimes(1);
        expect(navigationMocks.conversationNavigation.navigate).toHaveBeenCalledWith(
            {
                position: 1,
                messageId: 'a1',
                assistantMessageId: 'a1',
                documentKey: 'chatgpt:conversation:conv-1',
                source: 'reader',
            },
            { timeoutMs: 15000, align: 'start' },
        );
    });

    async function openRealReader(navigate: () => Promise<ConversationNavigationResultV1>, pageScoped = false) {
        document.body.innerHTML = `
          <div id="thread">
            <article data-turn="user">
              <div data-message-author-role="user"><div class="whitespace-pre-wrap">Hello from user</div></div>
            </article>
            <article data-turn="assistant">
              <div data-message-author-role="assistant" data-message-id="a1"><div class="markdown prose">Hi</div></div>
              <button data-testid="copy-turn-action-button">copy</button>
            </article>
          </div>
        `;
        const panel = new ReaderPanel();
        ownedPanels.add(panel);
        const adapter = new ChatGPTAdapter();
        const orchestrator = createOrchestrator(adapter, {
            readerPanel: panel,
            conversationNavigation: { navigate, cancelActive: vi.fn() },
        }, 'conversation-1');
        const source = (orchestrator as any).conversationContentSource as ReturnType<typeof createConversationContentSource>;
        const surface = (orchestrator as any).conversationSurface as ChatGPTConversationSurface;
        if (pageScoped) {
            const documentRef = {
                key: 'chatgpt:page:reader-fixture', platformId: 'chatgpt',
                identityKind: 'page' as const, conversationId: null, canonicalUrl: 'https://chatgpt.com/',
            };
            window.history.replaceState({}, '', '/');
            source.publish({ kind: 'ready', document: documentRef, snapshot: { ...source.read().snapshot!, document: documentRef } });
        }
        const assistant = document.querySelector<HTMLElement>('[data-message-id="a1"]')!;
        (orchestrator as any).rebuildTurnIndex();
        const actions = (orchestrator as any).getActionsForMessage(assistant, () => null);
        await actions.find((action: any) => action.id === 'reader').onClick();
        const host = document.querySelector<HTMLElement>('#aimd-reader-panel-host')!;
        const shadow = host.shadowRoot!;
        const locate = shadow.querySelector<HTMLButtonElement>('[data-role="footer-left-actions"] button[aria-label="jumpToMessage"]')!;
        expect(locate).toBeTruthy();
        return { panel, host, shadow, locate, source, adapter, surface };
    }

    function bindRealReader(reader: Awaited<ReturnType<typeof openRealReader>>): void {
        const binding = new ChatGPTConversationReaderBinding({
            adapter: reader.adapter, source: reader.source, materialization: reader.surface.materialization,
            readerPanel: reader.panel, pageUrl: () => window.location.href,
        });
        ownedBindings.add(binding);
        binding.init();
    }

    it.each(['slot-missing', 'hydration-timeout', 'source-unavailable'] as const)(
        'keeps the Reader and unsaved annotation edits after a footer locate click fails with %s',
        async (reason) => {
            let finishLocate!: (result: ConversationNavigationResultV1) => void;
            const navigate = vi.fn(() => new Promise<ConversationNavigationResultV1>((resolve) => { finishLocate = resolve; }));
            const { panel, host, shadow, locate } = await openRealReader(navigate);
            const hide = vi.spyOn(panel, 'hide');
            const item = panel.getItemsSnapshot()[0]!;
            saveReaderComment('reader-panel-comments-v1', {
                id: 'annotation-being-edited',
                itemId: item.id,
                quoteText: 'Hi',
                sourceMarkdown: 'Hi',
                comment: 'Saved annotation',
                selectors: {
                    textQuote: { exact: 'Hi', prefix: '', suffix: '' },
                    textPosition: { start: 0, end: 2 },
                    domRange: null,
                    atomicRefs: [],
                },
                createdAt: 1,
                updatedAt: 1,
            });
            expect(await panel.focusAnnotation('annotation-being-edited', 'a1')).toBe(true);
            const input = shadow.querySelector<HTMLTextAreaElement>('.reader-comment-popover [data-role="input"]')!;
            expect(input).toBeTruthy();
            input.value = 'Keep these unsaved edits';
            input.dispatchEvent(new Event('input', { bubbles: true }));
            input.focus();
            input.setSelectionRange(2, 8);

            locate.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, composed: true }));
            locate.click();

            expect(navigate).toHaveBeenCalledWith(
                {
                    position: 1, messageId: 'a1', assistantMessageId: 'a1',
                    documentKey: 'chatgpt:conversation:conversation-1', source: 'reader',
                },
                { timeoutMs: 15000, align: 'start' },
            );
            expect(hide).not.toHaveBeenCalled();
            expect(panel.isVisible()).toBe(true);
            expect(input.value).toBe('Keep these unsaved edits');

            finishLocate({ ok: false, reason });
            await vi.waitFor(() => expect(locate.disabled).toBe(false));

            expect(hide).not.toHaveBeenCalled();
            expect(host.isConnected).toBe(true);
            expect(panel.isShowingConversationReader()).toBe(true);
            expect(shadow.querySelector('.reader-comment-popover [data-role="input"]')).toBe(input);
            expect(input.value).toBe('Keep these unsaved edits');
            expect(input.selectionStart).toBe(2);
            expect(input.selectionEnd).toBe(8);
            const fallbackLink = document.querySelector<HTMLAnchorElement>('.aimd-toast a')!;
            expect(fallbackLink.href).toBe('https://chatgpt.com/c/conversation-1?messageId=a1');
            expect(document.querySelector('.aimd-toast')?.textContent).toContain('Could not locate this message on the page.');
            fallbackLink.focus();
            expect(document.activeElement).toBe(fallbackLink);
            const user = userEvent.setup();
            await user.tab();
            expect(document.activeElement).toBe(document.querySelector('.aimd-toast button'));
            await user.tab({ shift: true });
            expect(document.activeElement).toBe(fallbackLink);
            expect(panel.isVisible()).toBe(true);
            expect(input.value).toBe('Keep these unsaved edits');
        },
    );

    it('closes the Reader only after a real footer locate click succeeds', async () => {
        let finishLocate!: (result: ConversationNavigationResultV1) => void;
        const navigate = vi.fn(() => new Promise<ConversationNavigationResultV1>((resolve) => { finishLocate = resolve; }));
        const { panel, locate } = await openRealReader(navigate);
        const hide = vi.spyOn(panel, 'hide');

        locate.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, composed: true }));
        locate.click();

        expect(navigate).toHaveBeenCalledOnce();
        expect(hide).not.toHaveBeenCalled();
        expect(panel.isShowingConversationReader()).toBe(true);
        finishLocate({
            ok: true,
            phase: 'hydrated',
            resolvedBy: 'identity',
            target: {
                documentKey: 'chatgpt:conversation-1', position: 1, roundId: 'round-1',
                userMessageId: 'u1', assistantMessageId: 'a1',
            },
        });
        await vi.waitFor(() => expect(hide).toHaveBeenCalledOnce());

        expect(panel.isVisible()).toBe(false);
        expect(panel.isShowingConversationReader()).toBe(false);
        expect(document.querySelector('.aimd-toast a')).toBeNull();
    });

    it('keeps fallback actions keyboard reachable while the Reader remains open', async () => {
        const navigate = vi.fn(async (): Promise<ConversationNavigationResultV1> => ({ ok: false, reason: 'slot-missing' }));
        const { panel, locate } = await openRealReader(navigate);
        locate.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, composed: true }));
        locate.click();
        await vi.waitFor(() => expect(document.querySelector('.aimd-toast a')).not.toBeNull());

        const link = document.querySelector<HTMLAnchorElement>('.aimd-toast a')!;
        link.focus();
        expect(document.activeElement === link).toBe(true);
        const user = userEvent.setup();
        await user.tab();
        expect(document.activeElement).toBe(document.querySelector('.aimd-toast button'));
        await user.tab({ shift: true });
        expect(document.activeElement).toBe(link);
        expect(panel.isShowingConversationReader()).toBe(true);
    });

    it('keeps a stale Reader locate bound to the document that opened it and stays quiet', async () => {
        const navigate = vi.fn(async (): Promise<ConversationNavigationResultV1> => ({ ok: false, reason: 'stale-target' }));
        const { panel, locate, source } = await openRealReader(navigate);
        source.publish({
            conversationId: 'conversation-2',
            rounds: [{ id: 'round-other', position: 1, assistantMessageId: 'other-assistant', assistantContent: 'Other conversation' }],
        });
        window.history.replaceState({}, '', '/c/conversation-2');

        locate.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, composed: true }));
        locate.click();
        await vi.waitFor(() => expect(navigate).toHaveBeenCalledOnce());

        expect(navigate).toHaveBeenCalledWith(expect.objectContaining({
            documentKey: 'chatgpt:conversation:conversation-1',
            messageId: 'a1', source: 'reader',
        }), expect.anything());
        expect(document.querySelector('.aimd-toast')).toBeNull();
        expect(panel.isShowingConversationReader()).toBe(true);
    });

    it('keeps a failed Reader fallback link on its captured conversation after the source changes', async () => {
        let finishLocate!: (result: ConversationNavigationResultV1) => void;
        const navigate = vi.fn(() => new Promise<ConversationNavigationResultV1>((resolve) => { finishLocate = resolve; }));
        const { panel, locate, source } = await openRealReader(navigate);
        locate.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, composed: true }));
        locate.click();
        source.publish({
            conversationId: 'conversation-2',
            rounds: [{ id: 'round-other', position: 1, assistantMessageId: 'other-assistant', assistantContent: 'Other conversation' }],
        });
        window.history.replaceState({}, '', '/c/conversation-2');
        finishLocate({ ok: false, reason: 'slot-missing' });
        await vi.waitFor(() => expect(locate.disabled).toBe(false));

        expect(document.querySelector<HTMLAnchorElement>('.aimd-toast a')?.href).toBe('https://chatgpt.com/c/conversation-1?messageId=a1');
        expect(panel.isShowingConversationReader()).toBe(true);
    });

    it('locates the current item document after the real Reader binding replaces a cached conversation', async () => {
        const navigate = vi.fn(async (): Promise<ConversationNavigationResultV1> => ({ ok: false, reason: 'stale-target' }));
        const reader = await openRealReader(navigate);
        bindRealReader(reader);
        window.history.replaceState({}, '', '/c/conversation-2');
        reader.source.publish({
            conversationId: 'conversation-2', revision: 2,
            rounds: [{ id: 'round-other', position: 1, assistantMessageId: 'other-assistant', assistantContent: 'Other conversation' }],
        });
        await vi.waitFor(() => expect(reader.panel.getItemsSnapshot()[0]?.meta?.documentKey).toBe('chatgpt:conversation:conversation-2'));
        const locate = reader.shadow.querySelector<HTMLButtonElement>('[data-role="footer-left-actions"] button[aria-label="jumpToMessage"]')!;
        locate.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, composed: true }));
        locate.click();
        await vi.waitFor(() => expect(navigate).toHaveBeenCalledOnce());

        expect(navigate).toHaveBeenCalledWith(expect.objectContaining({
            documentKey: 'chatgpt:conversation:conversation-2', messageId: 'other-assistant', source: 'reader',
        }), expect.anything());
    });

    it('follows a page identity promotion through the real Reader binding even when message content is unchanged', async () => {
        const navigate = vi.fn(async (): Promise<ConversationNavigationResultV1> => ({ ok: false, reason: 'stale-target' }));
        const reader = await openRealReader(navigate, true);
        expect(reader.panel.getItemsSnapshot()[0]?.meta?.documentKey).toBe('chatgpt:page:reader-fixture');
        bindRealReader(reader);
        window.history.replaceState({}, '', '/c/conversation-1');
        reader.source.publish({
            conversationId: 'conversation-1', revision: 2,
            rounds: [{ id: 'round-1', position: 1, userPrompt: 'Hello from user', assistantContent: 'Hi', userMessageId: 'u1', assistantMessageId: 'a1' }],
        });
        await vi.waitFor(() => expect(reader.panel.getItemsSnapshot()[0]?.meta?.documentKey).toBe('chatgpt:conversation:conversation-1'));
        const locate = reader.shadow.querySelector<HTMLButtonElement>('[data-role="footer-left-actions"] button[aria-label="jumpToMessage"]')!;
        locate.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, composed: true }));
        locate.click();
        await vi.waitFor(() => expect(navigate).toHaveBeenCalledOnce());

        expect(navigate).toHaveBeenCalledWith(expect.objectContaining({
            documentKey: 'chatgpt:conversation:conversation-1', messageId: 'a1', source: 'reader',
        }), expect.anything());
    });

    it('derives a legacy item document from its own URL instead of the current source or action closure', async () => {
        const navigate = vi.fn(async (): Promise<ConversationNavigationResultV1> => ({ ok: false, reason: 'stale-target' }));
        const { panel, locate, source } = await openRealReader(navigate);
        const item = panel.getItemsSnapshot()[0]!;
        delete item.meta!.documentKey;
        item.meta!.url = 'https://chatgpt.com/c/conversation-legacy';
        source.publish({
            conversationId: 'conversation-2',
            rounds: [{ id: 'round-other', position: 1, assistantMessageId: 'other-assistant', assistantContent: 'Other conversation' }],
        });
        window.history.replaceState({}, '', '/c/conversation-2');
        locate.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, composed: true }));
        locate.click();
        await vi.waitFor(() => expect(navigate).toHaveBeenCalledOnce());

        expect(navigate).toHaveBeenCalledWith(expect.objectContaining({
            documentKey: 'chatgpt:conversation:conversation-legacy', messageId: 'a1', source: 'reader',
        }), expect.anything());
        expect(panel.isShowingConversationReader()).toBe(true);
    });

    it('does not create a fallback link for a different conversation when an item URL leads its document identity', async () => {
        const navigate = vi.fn(async (): Promise<ConversationNavigationResultV1> => ({ ok: false, reason: 'slot-missing' }));
        const { panel, locate } = await openRealReader(navigate);
        panel.getItemsSnapshot()[0]!.meta!.url = 'https://chatgpt.com/c/conversation-2';
        window.history.replaceState({}, '', '/c/conversation-2');
        locate.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, composed: true }));
        locate.click();
        await vi.waitFor(() => expect(locate.disabled).toBe(false));

        expect(navigate).toHaveBeenCalledWith(expect.objectContaining({
            documentKey: 'chatgpt:conversation:conversation-1', messageId: 'a1', source: 'reader',
        }), expect.anything());
        expect(document.querySelector<HTMLAnchorElement>('.aimd-toast a')?.href).toBe('https://chatgpt.com/c/conversation-1?messageId=a1');
        expect(panel.isShowingConversationReader()).toBe(true);
    });

    it('anchors the reader send popover to the footer action wrapper instead of the clicked button', async () => {
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
              <button data-testid="copy-turn-action-button">copy</button>
            </article>
          </div>
        `;

        const adapter = new ChatGPTAdapter();
        const readerPanel = {
            show: vi.fn(async () => undefined),
            getCommentExportContext: vi.fn(() => null),
        } as any;
        const sendController = { togglePopover: vi.fn() } as any;
        const orchestrator = createOrchestrator(adapter, { readerPanel, sendController });
        const assistant = document.querySelector('[data-message-author-role="assistant"][data-message-id]') as HTMLElement;

        (orchestrator as any).rebuildTurnIndex();
        const actions = (orchestrator as any).getActionsForMessage(assistant, () => null);
        const readerAction = actions.find((action: any) => action.id === 'reader');

        await readerAction.onClick();

        const options = readerPanel.show.mock.calls[0][3];
        const sendAction = options.actions.find((action: any) => action.id === 'send');
        expect(sendAction).toBeTruthy();

        const host = document.createElement('div');
        const shadow = host.attachShadow({ mode: 'open' });
        const footerWrapper = document.createElement('div');
        footerWrapper.setAttribute('data-role', 'footer-left-actions');
        const button = document.createElement('button');
        footerWrapper.appendChild(button);
        shadow.appendChild(footerWrapper);

        sendAction.onClick({ shadow, anchorEl: button });

        expect(sendController.togglePopover).toHaveBeenCalledTimes(1);
        expect(sendController.togglePopover.mock.calls[0][0].anchor).toBe(footerWrapper);
    });

    it('forwards prompt export context to the reader send popover even when annotations are still empty', async () => {
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
              <button data-testid="copy-turn-action-button">copy</button>
            </article>
          </div>
        `;

        const adapter = new ChatGPTAdapter();
        const listReaderPrompts = vi.fn(async () => [
            { id: 'p1', title: 'Prompt', content: 'Please revise the content according to my annotations below.' },
        ]);
        const readerPanel = {
            show: vi.fn(async () => undefined),
            getCommentExportContext: vi.fn(() => ({
                listReaderPrompts,
                template: [{ type: 'token', key: 'selected_source' }],
                promptPosition: 'top',
                comments: [],
            })),
        } as any;
        const sendController = { togglePopover: vi.fn() } as any;
        const orchestrator = createOrchestrator(adapter, { readerPanel, sendController });
        const assistant = document.querySelector('[data-message-author-role="assistant"][data-message-id]') as HTMLElement;

        (orchestrator as any).rebuildTurnIndex();
        const actions = (orchestrator as any).getActionsForMessage(assistant, () => null);
        const readerAction = actions.find((action: any) => action.id === 'reader');

        await readerAction.onClick();

        const options = readerPanel.show.mock.calls[0][3];
        const sendAction = options.actions.find((action: any) => action.id === 'send');
        expect(sendAction).toBeTruthy();

        const host = document.createElement('div');
        const shadow = host.attachShadow({ mode: 'open' });
        const footerWrapper = document.createElement('div');
        footerWrapper.setAttribute('data-role', 'footer-left-actions');
        const button = document.createElement('button');
        footerWrapper.appendChild(button);
        shadow.appendChild(footerWrapper);

        sendAction.onClick({ shadow, anchorEl: button });

        expect(sendController.togglePopover).toHaveBeenCalledTimes(1);
        expect(sendController.togglePopover.mock.calls[0][0].commentInsert).toEqual({
            listReaderPrompts,
            template: [{ type: 'token', key: 'selected_source' }],
            promptPosition: 'top',
            comments: [],
        });
    });

    it('uses the shared bookmark flow for reader create and updates reader meta state', async () => {
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
              <button data-testid="copy-turn-action-button">copy</button>
            </article>
          </div>
        `;

        vi.mocked(bookmarkSaveDialog.open).mockResolvedValueOnce({
            ok: true,
            folderPath: '/Inbox',
            title: 'Hello from user',
        } as any);

        const adapter = new ChatGPTAdapter();
        const readerPanel = { show: vi.fn(async () => undefined) } as any;
        const bookmarksController = {
            isPositionBookmarked: vi.fn(() => false),
            readPositionBookmarkStatus: vi.fn(async () => ({ ok: true, data: { saved: false } })),
            getDefaultFolderPath: vi.fn(() => '/Inbox'),
            setPositionBookmarkSaved: vi.fn(async () => ({ ok: true, data: { saved: true } })),
        } as any;
        const orchestrator = createOrchestrator(adapter, {
            readerPanel,
            bookmarksController,
            bookmarkSaveDialog: bookmarkSaveDialog as any,
        });
        const assistant = document.querySelector('[data-message-author-role="assistant"][data-message-id]') as HTMLElement;

        (orchestrator as any).rebuildTurnIndex();
        const actions = (orchestrator as any).getActionsForMessage(assistant, () => null);
        const readerAction = actions.find((action: any) => action.id === 'reader');

        await readerAction.onClick();

        const options = readerPanel.show.mock.calls[0][3];
        const bookmarkAction = options.actions.find((action: any) => action.id === 'bookmark_toggle');
        const currentUrl = window.location.href.split('#')[0] || window.location.href;
        const item = {
            userPrompt: 'Hello from user',
            content: 'Hi',
            meta: { position: 1, messageId: 'a1', url: currentUrl, bookmarked: false, bookmarkable: true },
        };
        const notify = vi.fn();
        const rerender = vi.fn();

        await bookmarkAction.onClick({ item, notify, rerender });

        expect(bookmarksController.setPositionBookmarkSaved).toHaveBeenCalledWith(expect.objectContaining({
            platform: 'ChatGPT',
            position: 1,
            messageId: 'a1',
            folderPath: '/Inbox',
            title: 'Hello from user',
        }), true);
        expect(item.meta.messageId).toBe('a1');
        expect(item.meta.bookmarked).toBe(true);
        expect(rerender).toHaveBeenCalledTimes(1);
        expect(notify).toHaveBeenCalledWith('savedStatus');
    });
});
