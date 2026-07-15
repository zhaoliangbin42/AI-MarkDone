import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/services/copy/copy-turn-png', () => ({
    copyMessagePng: vi.fn(async () => ({ ok: true, noop: false })),
}));

vi.mock('@/drivers/content/clipboard/clipboard', () => ({
    copyTextToClipboard: vi.fn(async () => true),
}));

vi.mock('@/services/reader/readerContentSource', () => ({
    collectFreshCurrentReaderItem: vi.fn(async () => (
        { id: 'm1', userPrompt: 'Prompt', content: 'Fresh answer', meta: { position: 7 } }
    )),
    collectFreshReaderContent: vi.fn(async () => ({
        items: [
            { id: 'm1', userPrompt: 'Prompt', content: 'Answer', meta: { position: 7 } },
        ],
        startIndex: 0,
        metadataSource: 'dom',
    })),
    readerItemsToChatTurns: vi.fn(async (items: any[]) => items.map((item, index) => ({
        user: item.userPrompt,
        assistant: item.content,
        index,
    }))),
}));

import { copyTextToClipboard } from '@/drivers/content/clipboard/clipboard';
import { copyMessagePng } from '@/services/copy/copy-turn-png';
import { collectFreshCurrentReaderItem } from '@/services/reader/readerContentSource';
import { SiteAdapter, type ThemeDetector } from '@/drivers/content/adapters/base';
import { MessageToolbarOrchestrator } from '@/ui/content/controllers/MessageToolbarOrchestrator';

const detector: ThemeDetector = {
    detect: () => 'light',
    getObserveTargets: () => [],
    hasExplicitTheme: () => true,
};

class TestAdapter extends SiteAdapter {
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
        this.getToolbarAnchorElement(messageElement)?.appendChild(toolbarHost);
        return true;
    }
    isStreamingMessage(): boolean { return false; }
    getMessageId(messageElement: HTMLElement): string | null { return messageElement.getAttribute('data-message-id'); }
    getObserverContainer(): HTMLElement | null { return document.body; }
}

describe('MessageToolbarOrchestrator Copy PNG', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('copies markdown from the fresh current Reader item even when Reader is already open', async () => {
        document.body.innerHTML = `
          <title>Reader Reuse Test</title>
          <div class="assistant-message" data-message-id="m1" data-aimd-msg-position="7">
            <div class="content">DOM Answer</div>
            <div class="official-toolbar"><button>copy</button></div>
          </div>
        `;

        const readerPanel = {
            show: vi.fn(),
            setTheme: vi.fn(),
            isShowingConversationReader: vi.fn(() => true),
            getItemsSnapshot: vi.fn(() => [
                { id: 'm1', userPrompt: 'Prompt', content: 'Reader cached answer', meta: { position: 7, messageId: 'm1' } },
            ]),
        };
        const orchestrator = new MessageToolbarOrchestrator(new TestAdapter(), { readerPanel: readerPanel as any }) as any;
        const assistant = document.querySelector('.assistant-message') as HTMLElement;
        const actions = orchestrator.getActionsForMessage(assistant, () => null);
        const copyAction = actions.find((action: any) => action.id === 'copy_markdown');

        const result = await copyAction.onClick();

        expect(result).toEqual({ ok: true, message: expect.any(String) });
        expect(collectFreshCurrentReaderItem).toHaveBeenCalledWith(expect.any(TestAdapter), assistant, expect.objectContaining({
            pageUrl: window.location.href,
        }));
        expect(copyTextToClipboard).toHaveBeenCalledWith('Fresh answer');
    });

    it('collects only on user action and shares the Reader item between toolbar Copy and Copy PNG', async () => {
        document.body.innerHTML = `
          <title>Shared Reader Item Test</title>
          <div class="assistant-message" data-message-id="m1" data-aimd-msg-position="7">
            <div class="content">Answer</div>
            <div class="official-toolbar"><button>copy</button></div>
          </div>
        `;

        const orchestrator = new MessageToolbarOrchestrator(new TestAdapter(), {
            readerPanel: { show: vi.fn(), setTheme: vi.fn(), isShowingConversationReader: vi.fn(() => false) } as any,
            copyMessagePng: vi.mocked(copyMessagePng),
        }) as any;
        const assistant = document.querySelector('.assistant-message') as HTMLElement;
        const actions = orchestrator.getActionsForMessage(assistant, () => null);
        const copyAction = actions.find((action: any) => action.id === 'copy_markdown');

        copyAction.onPrepare?.();
        expect(collectFreshCurrentReaderItem).not.toHaveBeenCalled();
        await copyAction.onClick();
        await copyAction.hoverAction.onClick({ signal: new AbortController().signal, onProgress: vi.fn() });

        expect(collectFreshCurrentReaderItem).toHaveBeenCalledTimes(1);
        expect(copyTextToClipboard).toHaveBeenCalledWith('Fresh answer');
        expect(copyMessagePng).toHaveBeenCalledWith(
            { user: 'Prompt', assistant: 'Fresh answer', index: 0 },
            expect.any(Object),
            expect.any(Object),
        );
    });

    it('invalidates the shared Reader item when that message content changes', async () => {
        document.body.innerHTML = `
          <title>Reader Cache Invalidation Test</title>
          <div class="assistant-message" data-message-id="m1" data-aimd-msg-position="7">
            <div class="content">Before update</div>
            <div class="official-toolbar"><button>copy</button></div>
          </div>
        `;

        vi.mocked(collectFreshCurrentReaderItem)
            .mockResolvedValueOnce({ id: 'm1', userPrompt: 'Prompt', content: 'Before update', meta: { position: 7 } } as any)
            .mockResolvedValueOnce({ id: 'm1', userPrompt: 'Prompt', content: 'After update', meta: { position: 7 } } as any);

        const orchestrator = new MessageToolbarOrchestrator(new TestAdapter(), {
            readerPanel: { show: vi.fn(), setTheme: vi.fn(), isShowingConversationReader: vi.fn(() => false) } as any,
            copyMessagePng: vi.mocked(copyMessagePng),
        }) as any;
        const assistant = document.querySelector('.assistant-message') as HTMLElement;
        const content = assistant.querySelector('.content') as HTMLElement;
        const copyAction = orchestrator.getActionsForMessage(assistant, () => null)
            .find((action: any) => action.id === 'copy_markdown');
        orchestrator.rebindObserverIfNeeded(true);

        try {
            await copyAction.onClick();
            await copyAction.hoverAction.onClick({ signal: new AbortController().signal, onProgress: vi.fn() });
            expect(collectFreshCurrentReaderItem).toHaveBeenCalledTimes(1);

            const text = content.firstChild;
            if (!(text instanceof Text)) throw new Error('fixture text node is missing');
            text.data = 'After update';
            await Promise.resolve();

            await copyAction.onClick();

            expect(collectFreshCurrentReaderItem).toHaveBeenCalledTimes(2);
            expect(copyTextToClipboard).toHaveBeenLastCalledWith('After update');
        } finally {
            orchestrator.dispose();
        }
    });

    it('uses the same configured PNG export width as the batch export path', async () => {
        document.body.innerHTML = `
          <title>PNG Width Test</title>
          <div class="assistant-message" data-message-id="m1" data-aimd-msg-position="7">
            <div class="content">Answer</div>
            <div class="official-toolbar"><button>copy</button></div>
          </div>
        `;

        const orchestrator = new MessageToolbarOrchestrator(new TestAdapter(), {
            readerPanel: { show: vi.fn(), setTheme: vi.fn() } as any,
            copyMessagePng: vi.mocked(copyMessagePng),
        }) as any;
        orchestrator.setExportSettings({ pngWidthPreset: 'tablet', pngCustomWidth: 920, pngPixelRatio: 2.5 });
        orchestrator.getUserPromptForElement = vi.fn(() => 'Prompt');

        const assistant = document.querySelector('.assistant-message') as HTMLElement;
        const actions = orchestrator.getActionsForMessage(assistant, () => null);
        const copyAction = actions.find((action: any) => action.id === 'copy_markdown');

        const abort = new AbortController();
        const onProgress = vi.fn();
        await copyAction.hoverAction.onClick({ signal: abort.signal, onProgress });

        expect(copyMessagePng).toHaveBeenCalledWith(
            { user: 'Prompt', assistant: 'Fresh answer', index: 0 },
            expect.objectContaining({ title: 'PNG Width Test', count: 1 }),
            expect.objectContaining({
                png: { width: 640, pixelRatio: 2.5 },
                signal: abort.signal,
                onProgress: expect.any(Function),
            }),
        );
        expect(collectFreshCurrentReaderItem).toHaveBeenCalledWith(expect.any(TestAdapter), assistant, expect.objectContaining({
            pageUrl: window.location.href,
        }));
    });

    it('maps renderer progress into toolbar progress labels', async () => {
        document.body.innerHTML = `
          <title>PNG Progress Test</title>
          <div class="assistant-message" data-message-id="m1" data-aimd-msg-position="7">
            <div class="content">Answer</div>
            <div class="official-toolbar"><button>copy</button></div>
          </div>
        `;

        vi.mocked(copyMessagePng).mockImplementationOnce(async (_turn, _metadata, options: any) => {
            options.onProgress({ phase: 'rasterizing', completed: 2, total: 4 });
            return { ok: true, noop: false };
        });

        const orchestrator = new MessageToolbarOrchestrator(new TestAdapter(), {
            readerPanel: { show: vi.fn(), setTheme: vi.fn() } as any,
            copyMessagePng: vi.mocked(copyMessagePng),
        }) as any;
        orchestrator.getUserPromptForElement = vi.fn(() => 'Prompt');

        const assistant = document.querySelector('.assistant-message') as HTMLElement;
        const actions = orchestrator.getActionsForMessage(assistant, () => null);
        const copyAction = actions.find((action: any) => action.id === 'copy_markdown');
        const onProgress = vi.fn();

        await copyAction.hoverAction.onClick({ signal: new AbortController().signal, onProgress });

        expect(onProgress).toHaveBeenCalledWith(expect.objectContaining({
            label: expect.any(String),
            completed: 2,
            total: 4,
            indeterminate: false,
        }));
    });

    it('reports cancelled Copy PNG as a short cancellation message', async () => {
        document.body.innerHTML = `
          <title>PNG Cancel Test</title>
          <div class="assistant-message" data-message-id="m1" data-aimd-msg-position="7">
            <div class="content">Answer</div>
            <div class="official-toolbar"><button>copy</button></div>
          </div>
        `;

        vi.mocked(copyMessagePng).mockResolvedValueOnce({
            ok: false,
            cancelled: true,
            error: {
                code: 'CANCELLED',
                message: 'PNG export failed for message.png (800x4000, pixelRatio 1): Operation cancelled.',
            },
        });

        const orchestrator = new MessageToolbarOrchestrator(new TestAdapter(), {
            readerPanel: { show: vi.fn(), setTheme: vi.fn() } as any,
            copyMessagePng: vi.mocked(copyMessagePng),
        }) as any;
        orchestrator.getUserPromptForElement = vi.fn(() => 'Prompt');

        const assistant = document.querySelector('.assistant-message') as HTMLElement;
        const actions = orchestrator.getActionsForMessage(assistant, () => null);
        const copyAction = actions.find((action: any) => action.id === 'copy_markdown');

        const result = await copyAction.hoverAction.onClick({ signal: new AbortController().signal, onProgress: vi.fn() });

        expect(result).toEqual({ ok: false, message: 'Cancelled' });
    });
});
