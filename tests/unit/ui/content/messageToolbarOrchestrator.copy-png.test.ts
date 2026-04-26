import { describe, expect, it, vi } from 'vitest';

vi.mock('@/services/copy/copy-turn-png', () => ({
    copyTurnsPng: vi.fn(async () => ({ ok: true, noop: false })),
}));

import { copyTurnsPng } from '@/services/copy/copy-turn-png';
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
        orchestrator.getMergedMarkdownForElement = vi.fn(() => ({ ok: true, markdown: 'Answer' }));
        orchestrator.getUserPromptForElement = vi.fn(() => 'Prompt');

        const assistant = document.querySelector('.assistant-message') as HTMLElement;
        const actions = orchestrator.getActionsForMessage(assistant, () => null);
        const copyAction = actions.find((action: any) => action.id === 'copy_markdown');

        await copyAction.hoverAction.onClick();

        expect(copyTurnsPng).toHaveBeenCalledWith(
            [{ user: 'Prompt', assistant: 'Answer', index: 6 }],
            [0],
            expect.objectContaining({ title: 'PNG Width Test', count: 1 }),
            expect.objectContaining({ png: { width: 640, pixelRatio: 2.5 } }),
        );
    });
});
