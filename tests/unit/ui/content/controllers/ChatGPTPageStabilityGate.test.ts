import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ChatGPTPageStabilityGate } from '@/ui/content/controllers/ChatGPTPageStabilityGate';
import { SiteAdapter, type ThemeDetector } from '@/drivers/content/adapters/base';

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

describe('ChatGPTPageStabilityGate', () => {
    let now = 0;

    beforeEach(() => {
        vi.useFakeTimers();
        document.body.innerHTML = '<main><section></section></main>';
        vi.spyOn(performance, 'now').mockImplementation(() => now);
    });

    afterEach(() => {
        vi.useRealTimers();
        vi.restoreAllMocks();
        document.body.innerHTML = '';
    });

    function advance(ms: number): void {
        now += ms;
        vi.advanceTimersByTime(ms);
    }

    it('enters stable after a quiet window once groups exist', () => {
        const groups = {
            getGroups: () => [{
                id: 'g1',
                title: 'Prompt',
                barEl: document.createElement('div'),
                bodyEls: [],
                assistantRootEl: document.createElement('section'),
                assistantIndex: 0,
                collapsed: true,
                virtualized: false,
                isStreaming: false,
            }],
            markVirtualized: vi.fn(),
            completeRestore: vi.fn(),
            onRestoreRequested: vi.fn(),
        };
        const gate = new ChatGPTPageStabilityGate(new FakeChatGPTAdapter(), groups);
        const states: string[] = [];
        gate.subscribe((state) => states.push(state));
        gate.init();

        advance(3000);

        expect(gate.getState()).toBe('stable');
        expect(states).toContain('stable');
    });

    it('falls back to disabled when a stable group registry never appears', () => {
        const groups = {
            getGroups: () => [],
            markVirtualized: vi.fn(),
            completeRestore: vi.fn(),
            onRestoreRequested: vi.fn(),
        };
        const gate = new ChatGPTPageStabilityGate(new FakeChatGPTAdapter(), groups);
        gate.init();

        advance(21000);

        expect(gate.getState()).toBe('disabled');
    });
});
