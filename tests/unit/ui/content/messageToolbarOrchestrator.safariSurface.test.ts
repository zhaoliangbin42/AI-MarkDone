import { describe, expect, it, vi } from 'vitest';

vi.mock('@/config/targetSurface', () => ({
    TARGET_SURFACE_SPONSOR_TAB_ENABLED: false,
    TARGET_SURFACE_SOCIAL_FOLLOW_CARD_ENABLED: false,
    TARGET_SURFACE_BINARY_CLIPBOARD_COPY_ACTIONS_ENABLED: false,
    targetSurfacePolicy: {
        sponsorTab: false,
        socialFollowCard: false,
        binaryClipboardCopyActions: false,
    },
}));

vi.mock('@/services/copy/copy-turn-png', () => ({
    copyTurnsPng: vi.fn(async () => ({ ok: true, noop: false })),
}));

vi.mock('@/services/reader/readerContentSource', () => ({
    collectFreshCurrentReaderItem: vi.fn(async () => (
        { id: 'm1', userPrompt: 'Prompt', content: 'Answer', meta: { position: 1 } }
    )),
    collectFreshReaderContent: vi.fn(async () => ({
        items: [
            { id: 'm1', userPrompt: 'Prompt', content: 'Answer', meta: { position: 1 } },
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

describe('MessageToolbarOrchestrator Safari surface policy', () => {
    it('hides the binary Copy as PNG hover action while keeping Markdown copy available', () => {
        document.body.innerHTML = `
          <title>Safari PNG Surface Test</title>
          <div class="assistant-message" data-message-id="m1" data-aimd-msg-position="1">
            <div class="content">Answer</div>
            <div class="official-toolbar"><button>copy</button></div>
          </div>
        `;

        const orchestrator = new MessageToolbarOrchestrator(new TestAdapter(), {
            readerPanel: { show: vi.fn(), setTheme: vi.fn() } as any,
        }) as any;
        orchestrator.getUserPromptForElement = vi.fn(() => 'Prompt');

        const assistant = document.querySelector('.assistant-message') as HTMLElement;
        const actions = orchestrator.getActionsForMessage(assistant, () => null);
        const copyAction = actions.find((action: any) => action.id === 'copy_markdown');

        expect(copyAction).toBeTruthy();
        expect(copyAction.hoverAction).toBeUndefined();
    });
});
