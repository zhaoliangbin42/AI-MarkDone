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

class NonChatGPTAdapter extends SiteAdapter {
    matches(): boolean { return true; }
    getPlatformId(): string { return 'gemini'; }
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

describe('MessageToolbarOrchestrator ChatGPT fold action', () => {
    it('adds a ChatGPT-only fold action when the message belongs to a foldable group', async () => {
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
        const foldingController = {
            canCollapseMessage: vi.fn(() => true),
            collapseGroupForMessage: vi.fn(() => true),
        } as any;
        const orchestrator = new MessageToolbarOrchestrator(adapter, { readerPanel, foldingController });

        const assistant = document.querySelector('[data-message-author-role="assistant"][data-message-id]') as HTMLElement;
        const actions = (orchestrator as any).getActionsForMessage(assistant, () => null);
        const foldAction = actions.find((action: any) => action.id === 'collapse_turn');
        const foldIndex = actions.findIndex((action: any) => action.id === 'collapse_turn');

        expect(foldAction).toBeTruthy();
        expect(foldAction.label).toBe('collapse');
        expect(foldIndex).toBe(actions.length - 1);

        await foldAction.onClick();

        expect(foldingController.canCollapseMessage).toHaveBeenCalledWith(assistant);
        expect(foldingController.collapseGroupForMessage).toHaveBeenCalledWith(assistant);
    });

    it('places the ChatGPT fold action at the far right of the toolbar action row', () => {
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
        const foldingController = {
            canCollapseMessage: vi.fn(() => true),
            collapseGroupForMessage: vi.fn(() => true),
        } as any;
        const orchestrator = new MessageToolbarOrchestrator(adapter, { readerPanel, foldingController });

        const assistant = document.querySelector('[data-message-author-role="assistant"][data-message-id]') as HTMLElement;
        const actions = (orchestrator as any).getActionsForMessage(assistant, () => null);

        expect(actions.map((action: any) => action.id)).toEqual([
            'copy_markdown',
            'reader',
            'export',
            'collapse_turn',
        ]);
    });

    it('does not add the fold action on other platforms', () => {
        document.body.innerHTML = `
          <div class="assistant-message" data-message-id="m1">
            <div class="content">First</div>
            <div class="official-toolbar"><button>copy</button></div>
          </div>
        `;

        const adapter = new NonChatGPTAdapter();
        const readerPanel = { show: vi.fn(async () => undefined) } as any;
        const foldingController = {
            canCollapseMessage: vi.fn(() => true),
            collapseGroupForMessage: vi.fn(() => true),
        } as any;
        const orchestrator = new MessageToolbarOrchestrator(adapter, { readerPanel, foldingController });

        const assistant = document.querySelector('.assistant-message') as HTMLElement;
        const actions = (orchestrator as any).getActionsForMessage(assistant, () => null);

        expect(actions.some((action: any) => action.id === 'collapse_turn')).toBe(false);
        expect(foldingController.canCollapseMessage).not.toHaveBeenCalled();
    });

    it('opens Reader mode directly from live DOM in hidden-only mode', async () => {
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
        const orchestrator = new MessageToolbarOrchestrator(adapter, { readerPanel });

        const assistant = document.querySelector('[data-message-author-role="assistant"][data-message-id]') as HTMLElement;
        const actions = (orchestrator as any).getActionsForMessage(assistant, () => null);
        const readerAction = actions.find((action: any) => action.id === 'reader');

        expect(readerAction).toBeTruthy();

        await readerAction.onClick();

        expect(readerPanel.show).toHaveBeenCalledTimes(1);
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

        expect(exportAction).toBeTruthy();

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

        const adapter = new NonChatGPTAdapter();
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

        expect(bookmarkAction).toBeTruthy();

        await bookmarkAction.onClick();
        await Promise.resolve();

        expect(bookmarkSaveDialog.open).toHaveBeenCalledTimes(1);
        expect(bookmarksController.toggleBookmarkFromToolbar).toHaveBeenCalledWith(expect.objectContaining({
            platform: 'Gemini',
            position: 7,
            messageId: 'm1',
            folderPath: '/Research',
            title: 'Prompt',
        }));
    });
});
