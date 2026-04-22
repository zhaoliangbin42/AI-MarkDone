import { describe, expect, it, vi } from 'vitest';
vi.mock('@/ui/content/bookmarks/save/bookmarkSaveDialogSingleton', () => ({
    bookmarkSaveDialog: {
        open: vi.fn(),
        setTheme: vi.fn(),
    },
}));
import { ChatGPTAdapter } from '@/drivers/content/adapters/sites/chatgpt';
import { MessageToolbarOrchestrator } from '@/ui/content/controllers/MessageToolbarOrchestrator';
import { bookmarkSaveDialog } from '@/ui/content/bookmarks/save/bookmarkSaveDialogSingleton';

describe('ReaderPanel bookmark action injection', () => {
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
        const orchestrator = new MessageToolbarOrchestrator(adapter, { readerPanel, bookmarksController });
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
        const orchestrator = new MessageToolbarOrchestrator(adapter, { readerPanel, sendController });
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
        const readerPanel = {
            show: vi.fn(async () => undefined),
            getCommentExportContext: vi.fn(() => ({
                prompts: [{ id: 'p1', title: 'Prompt', content: 'Please revise the content according to my annotations below.' }],
                template: [{ type: 'token', key: 'selected_source' }],
                comments: [],
            })),
        } as any;
        const sendController = { togglePopover: vi.fn() } as any;
        const orchestrator = new MessageToolbarOrchestrator(adapter, { readerPanel, sendController });
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
            prompts: [{ id: 'p1', title: 'Prompt', content: 'Please revise the content according to my annotations below.' }],
            template: [{ type: 'token', key: 'selected_source' }],
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
            getDefaultFolderPath: vi.fn(() => '/Inbox'),
            toggleBookmarkFromToolbar: vi.fn(async () => ({ ok: true, data: { saved: true } })),
        } as any;
        const orchestrator = new MessageToolbarOrchestrator(adapter, { readerPanel, bookmarksController });
        const assistant = document.querySelector('[data-message-author-role="assistant"][data-message-id]') as HTMLElement;

        (orchestrator as any).rebuildTurnIndex();
        const actions = (orchestrator as any).getActionsForMessage(assistant, () => null);
        const readerAction = actions.find((action: any) => action.id === 'reader');

        await readerAction.onClick();

        const options = readerPanel.show.mock.calls[0][3];
        const bookmarkAction = options.actions.find((action: any) => action.id === 'bookmark_toggle');
        const item = {
            userPrompt: 'Hello from user',
            content: 'Hi',
            meta: { position: 1, messageId: 'a1', url: 'https://example.com/chat', bookmarked: false, bookmarkable: true },
        };
        const notify = vi.fn();
        const rerender = vi.fn();

        await bookmarkAction.onClick({ item, notify, rerender });

        expect(bookmarksController.toggleBookmarkFromToolbar).toHaveBeenCalledWith(expect.objectContaining({
            platform: 'ChatGPT',
            position: 1,
            messageId: 'a1',
            folderPath: '/Inbox',
            title: 'Hello from user',
        }));
        expect(item.meta.messageId).toBe('a1');
        expect(item.meta.bookmarked).toBe(true);
        expect(rerender).toHaveBeenCalledTimes(1);
        expect(notify).toHaveBeenCalledWith('savedStatus');
    });
});
