import { describe, expect, it, vi } from 'vitest';
import { SiteAdapter, type ThemeDetector } from '@/drivers/content/adapters/base';
import { ConversationVirtualizationController } from '@/ui/content/controllers/ConversationVirtualizationController';

const detector: ThemeDetector = {
    detect: () => 'light',
    getObserveTargets: () => [],
    hasExplicitTheme: () => true,
};

class FakeChatGPTAdapter extends SiteAdapter {
    matches(): boolean { return true; }
    getPlatformId(): string { return 'chatgpt'; }
    getThemeDetector(): ThemeDetector { return detector; }
    extractUserPrompt(): string | null { return null; }
    getMessageSelector(): string { return '[data-message-author-role="assistant"]'; }
    getMessageContentSelector(): string { return '[data-message-author-role="assistant"]'; }
    getActionBarSelector(): string { return '[aria-label="Response actions"]'; }
    getToolbarAnchorElement(): HTMLElement | null { return null; }
    isStreamingMessage(): boolean { return false; }
    getMessageId(messageElement: HTMLElement): string | null { return messageElement.getAttribute('data-message-id'); }
    getObserverContainer(): HTMLElement | null { return document.querySelector('main'); }
    getConversationScrollRoot(): HTMLElement | null { return document.querySelector('main'); }
}

function defineLayout(el: HTMLElement, top: number, height: number): void {
    Object.defineProperty(el, 'offsetTop', { configurable: true, get: () => top });
    Object.defineProperty(el, 'offsetHeight', { configurable: true, get: () => height });
}

describe('ConversationVirtualizationController', () => {
    it('trims only group body nodes and restores them through the fold bridge', () => {
        document.body.innerHTML = `
          <main></main>
        `;
        const main = document.querySelector('main') as HTMLElement;
        Object.defineProperty(main, 'clientHeight', { configurable: true, get: () => 500 });
        Object.defineProperty(main, 'scrollTop', { configurable: true, writable: true, value: 2500 });

        const bar = document.createElement('div');
        bar.className = 'aimd-chatgpt-foldbar';
        const user = document.createElement('section');
        user.id = 'user-1';
        const assistant = document.createElement('section');
        assistant.id = 'assistant-1';
        main.append(bar, user, assistant);
        defineLayout(bar, 0, 40);
        defineLayout(user, 0, 200);
        defineLayout(assistant, 200, 220);

        const bridge = {
            getGroups: () => [
                {
                    id: 'g1',
                    title: '1. Prompt',
                    barEl: bar,
                    bodyEls: [user, assistant],
                    assistantRootEl: assistant,
                    assistantIndex: 0,
                    collapsed: true,
                    virtualized: false,
                    isStreaming: false,
                },
            ],
            markVirtualized: vi.fn(),
            completeRestore: vi.fn(),
            onRestoreRequested: vi.fn(),
        };

        const controller = new ConversationVirtualizationController(new FakeChatGPTAdapter(), bridge as any) as any;
        controller.init('light');
        controller.policy = { ...controller.policy, preserveRecentAssistantCount: 0, viewportOverscanPx: 0 };
        controller.sync();

        expect(main.contains(bar)).toBe(true);
        expect(main.contains(user)).toBe(false);
        expect(main.contains(assistant)).toBe(false);
        const placeholder = main.querySelector('.aimd-conversation-placeholder') as HTMLElement | null;
        expect(placeholder).toBeTruthy();
        expect(placeholder?.style.display).toBe('');
        expect(bridge.markVirtualized).toHaveBeenCalledWith('g1', true, expect.any(HTMLElement));

        const callbacks = (bridge.onRestoreRequested as any).mock.calls[0]?.[0];
        callbacks.onRestoreVirtualizedGroup('g1');

        expect(main.contains(user)).toBe(true);
        expect(main.contains(assistant)).toBe(true);
        expect(bridge.completeRestore).toHaveBeenCalledWith('g1');
    });

    it('on mode trims collapsed groups once they leave the viewport window', () => {
        document.body.innerHTML = '<main></main>';
        const main = document.querySelector('main') as HTMLElement;
        Object.defineProperty(main, 'clientHeight', { configurable: true, get: () => 500 });
        Object.defineProperty(main, 'scrollTop', { configurable: true, writable: true, value: 2500 });

        const bar = document.createElement('div');
        const assistant = document.createElement('section');
        main.append(bar, assistant);
        defineLayout(bar, 0, 40);
        defineLayout(assistant, 40, 180);

        const bridge = {
            getGroups: () => [
                {
                    id: 'g1',
                    title: '1. Prompt',
                    barEl: bar,
                    bodyEls: [assistant],
                    assistantRootEl: assistant,
                    assistantIndex: 0,
                    collapsed: true,
                    virtualized: false,
                    isStreaming: false,
                },
            ],
            markVirtualized: vi.fn(),
            completeRestore: vi.fn(),
            onRestoreRequested: vi.fn(),
        };

        const controller = new ConversationVirtualizationController(new FakeChatGPTAdapter(), bridge as any) as any;
        controller.init('light');
        controller.setPolicy({ foldingPowerMode: 'on' });
        controller.sync();

        expect(main.contains(assistant)).toBe(false);
        expect(bridge.markVirtualized).toHaveBeenCalledWith('g1', true, expect.any(HTMLElement));
    });

    it('on mode restores a trimmed group when it comes back near the viewport', () => {
        document.body.innerHTML = '<main></main>';
        const main = document.querySelector('main') as HTMLElement;
        Object.defineProperty(main, 'clientHeight', { configurable: true, get: () => 500 });
        Object.defineProperty(main, 'scrollTop', { configurable: true, writable: true, value: 2500 });

        const bar = document.createElement('div');
        const assistant = document.createElement('section');
        main.append(bar, assistant);
        defineLayout(bar, 0, 40);
        defineLayout(assistant, 40, 180);

        const bridgeState = { virtualized: false };
        const bridge = {
            getGroups: () => [
                {
                    id: 'g1',
                    title: '1. Prompt',
                    barEl: bar,
                    bodyEls: [assistant],
                    assistantRootEl: assistant,
                    assistantIndex: 0,
                    collapsed: true,
                    virtualized: bridgeState.virtualized,
                    isStreaming: false,
                },
            ],
            markVirtualized: vi.fn((_groupId: string, virtualized: boolean) => {
                bridgeState.virtualized = virtualized;
            }),
            completeRestore: vi.fn(() => {
                bridgeState.virtualized = false;
            }),
            onRestoreRequested: vi.fn(),
        };

        const controller = new ConversationVirtualizationController(new FakeChatGPTAdapter(), bridge as any) as any;
        controller.init('light');
        controller.setPolicy({ foldingPowerMode: 'on' });
        controller.policy = { ...controller.policy, preserveRecentAssistantCount: 0, viewportOverscanPx: 0 };
        controller.sync();

        expect(main.contains(assistant)).toBe(false);

        Object.defineProperty(main, 'scrollTop', { configurable: true, writable: true, value: 0 });
        controller.sync();

        expect(main.contains(assistant)).toBe(true);
        expect(bridge.completeRestore).toHaveBeenCalledWith('g1');
    });
});
