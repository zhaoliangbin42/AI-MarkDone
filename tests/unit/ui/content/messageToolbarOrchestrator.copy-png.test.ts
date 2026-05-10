import { describe, expect, it, vi } from 'vitest';

vi.mock('@/services/copy/copy-turn-png', () => ({
    copyTurnsPng: vi.fn(async () => ({ ok: true, noop: false })),
}));

vi.mock('@/services/reader/readerContentSource', () => ({
    collectReaderContent: vi.fn(async () => ({
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

import { copyTurnsPng } from '@/services/copy/copy-turn-png';
import { collectReaderContent } from '@/services/reader/readerContentSource';
import { SiteAdapter, type ThemeDetector } from '@/drivers/content/adapters/base';
import { MessageToolbarOrchestrator } from '@/ui/content/controllers/MessageToolbarOrchestrator';

const detector: ThemeDetector = {
    detect: () => 'light',
    getObserveTargets: () => [],
    hasExplicitTheme: () => true,
};

class TestAdapter extends SiteAdapter {
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
        this.getToolbarAnchorElement(messageElement)?.appendChild(toolbarHost);
        return true;
    }
    isStreamingMessage(): boolean { return false; }
    getMessageId(messageElement: HTMLElement): string | null { return messageElement.getAttribute('data-message-id'); }
    getObserverContainer(): HTMLElement | null { return document.body; }
}

describe('MessageToolbarOrchestrator Copy PNG', () => {
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
        }) as any;
        orchestrator.setExportSettings({ pngWidthPreset: 'tablet', pngCustomWidth: 920, pngPixelRatio: 2.5 });
        orchestrator.getUserPromptForElement = vi.fn(() => 'Prompt');

        const assistant = document.querySelector('.assistant-message') as HTMLElement;
        const actions = orchestrator.getActionsForMessage(assistant, () => null);
        const copyAction = actions.find((action: any) => action.id === 'copy_markdown');

        const abort = new AbortController();
        const onProgress = vi.fn();
        await copyAction.hoverAction.onClick({ signal: abort.signal, onProgress });

        expect(copyTurnsPng).toHaveBeenCalledWith(
            [{ user: 'Prompt', assistant: 'Answer', index: 0 }],
            [0],
            expect.objectContaining({ title: 'PNG Width Test', count: 1 }),
            expect.objectContaining({
                png: { width: 640, pixelRatio: 2.5 },
                signal: abort.signal,
                onProgress: expect.any(Function),
            }),
        );
        expect(collectReaderContent).toHaveBeenCalledWith(expect.any(TestAdapter), assistant, expect.objectContaining({
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

        vi.mocked(copyTurnsPng).mockImplementationOnce(async (_turns, _selected, _metadata, options: any) => {
            options.onProgress({ phase: 'rendering_chunk', completed: 2, total: 4 });
            return { ok: true, noop: false };
        });

        const orchestrator = new MessageToolbarOrchestrator(new TestAdapter(), {
            readerPanel: { show: vi.fn(), setTheme: vi.fn() } as any,
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

        vi.mocked(copyTurnsPng).mockResolvedValueOnce({
            ok: false,
            cancelled: true,
            error: {
                code: 'CANCELLED',
                message: 'PNG export failed for message.png (800x4000, pixelRatio 1): Operation cancelled.',
            },
        });

        const orchestrator = new MessageToolbarOrchestrator(new TestAdapter(), {
            readerPanel: { show: vi.fn(), setTheme: vi.fn() } as any,
        }) as any;
        orchestrator.getUserPromptForElement = vi.fn(() => 'Prompt');

        const assistant = document.querySelector('.assistant-message') as HTMLElement;
        const actions = orchestrator.getActionsForMessage(assistant, () => null);
        const copyAction = actions.find((action: any) => action.id === 'copy_markdown');

        const result = await copyAction.hoverAction.onClick({ signal: new AbortController().signal, onProgress: vi.fn() });

        expect(result).toEqual({ ok: false, message: 'Cancelled' });
    });
});
