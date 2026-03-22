import { describe, expect, it, vi } from 'vitest';
import { ChatGPTAdapter } from '@/drivers/content/adapters/sites/chatgpt';
import { MessageToolbarOrchestrator } from '@/ui/content/controllers/MessageToolbarOrchestrator';

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
        const readerPanel = { show: vi.fn(async () => undefined) } as any;
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
        const readerPanel = { show: vi.fn(async () => undefined) } as any;
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
});
