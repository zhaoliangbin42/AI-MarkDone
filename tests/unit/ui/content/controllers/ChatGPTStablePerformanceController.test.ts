import { describe, expect, it, vi } from 'vitest';
import { SiteAdapter, type ThemeDetector } from '@/drivers/content/adapters/base';
import { ChatGPTStablePerformanceController } from '@/ui/content/controllers/ChatGPTStablePerformanceController';

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
    getHeavySubtreeRefs(bodyEls: HTMLElement[]): HTMLElement[] {
        return bodyEls.flatMap((bodyEl) =>
            Array.from(bodyEl.querySelectorAll('.katex, math, pre')).filter((node): node is HTMLElement => node instanceof HTMLElement)
        );
    }
}

function defineLayout(el: HTMLElement, top: number, height: number, width = 500): void {
    Object.defineProperty(el, 'offsetTop', { configurable: true, get: () => top });
    Object.defineProperty(el, 'offsetHeight', { configurable: true, get: () => height });
    Object.defineProperty(el, 'offsetWidth', { configurable: true, get: () => width });
}

describe('ChatGPTStablePerformanceController', () => {
    it('applies content-visibility only to expanded old groups outside the viewport window', () => {
        document.body.innerHTML = '<main></main>';
        const main = document.querySelector('main') as HTMLElement;
        Object.defineProperty(main, 'clientHeight', { configurable: true, get: () => 500 });
        Object.defineProperty(main, 'scrollTop', { configurable: true, writable: true, value: 0 });

        const recentBar = document.createElement('div');
        const recentBody = document.createElement('section');
        const oldBar = document.createElement('div');
        const oldBody = document.createElement('section');
        main.append(recentBar, recentBody, oldBar, oldBody);
        defineLayout(recentBar, 0, 40);
        defineLayout(recentBody, 40, 220);
        defineLayout(oldBar, 4000, 40);
        defineLayout(oldBody, 4040, 260);

        const bridge = {
            getGroups: () => [
                {
                    id: 'recent',
                    title: 'Recent',
                    barEl: recentBar,
                    bodyEls: [recentBody],
                    assistantRootEl: recentBody,
                    assistantIndex: 10,
                    collapsed: false,
                    virtualized: false,
                    isStreaming: false,
                },
                {
                    id: 'old',
                    title: 'Old',
                    barEl: oldBar,
                    bodyEls: [oldBody],
                    assistantRootEl: oldBody,
                    assistantIndex: 0,
                    collapsed: false,
                    virtualized: false,
                    isStreaming: false,
                },
            ],
        };

        const controller = new ChatGPTStablePerformanceController(new FakeChatGPTAdapter(), bridge as any) as any;
        controller.init();
        controller.sync();

        expect(recentBody.style.contentVisibility).toBe('');
        expect(oldBody.style.contentVisibility).toBe('auto');
        expect(oldBody.style.containIntrinsicSize).not.toBe('');
    });

    it('compacts heavy katex subtrees for warm groups and restores them near the viewport', () => {
        document.body.innerHTML = '<main></main>';
        const main = document.querySelector('main') as HTMLElement;
        Object.defineProperty(main, 'clientHeight', { configurable: true, get: () => 500 });
        Object.defineProperty(main, 'scrollTop', { configurable: true, writable: true, value: 0 });

        const bar = document.createElement('div');
        const body = document.createElement('section');
        const katex = document.createElement('div');
        katex.className = 'katex';
        for (let i = 0; i < 1300; i += 1) {
            const span = document.createElement('span');
            span.textContent = String(i);
            katex.appendChild(span);
        }
        body.appendChild(katex);
        main.append(bar, body);
        defineLayout(bar, 3500, 40);
        defineLayout(body, 3540, 260);
        defineLayout(katex, 0, 180, 320);

        const bridge = {
            getGroups: () => [
                {
                    id: 'recent-1',
                    title: 'Recent-1',
                    barEl: document.createElement('div'),
                    bodyEls: [document.createElement('section')],
                    assistantRootEl: document.createElement('section'),
                    assistantIndex: 4,
                    collapsed: false,
                    virtualized: false,
                    isStreaming: false,
                },
                {
                    id: 'old',
                    title: 'Old',
                    barEl: bar,
                    bodyEls: [body],
                    assistantRootEl: body,
                    assistantIndex: 0,
                    collapsed: false,
                    virtualized: false,
                    isStreaming: false,
                },
            ],
        };

        const controller = new ChatGPTStablePerformanceController(new FakeChatGPTAdapter(), bridge as any) as any;
        controller.init();
        controller.sync();

        expect(body.querySelector('.katex')).toBeNull();
        expect(body.querySelector('.aimd-heavy-subtree-placeholder')).toBeTruthy();

        Object.defineProperty(main, 'scrollTop', { configurable: true, writable: true, value: 3400 });
        controller.sync();

        expect(body.querySelector('.katex')).toBeTruthy();
        expect(body.querySelector('.aimd-heavy-subtree-placeholder')).toBeNull();
    });

    it('reduced budget mode keeps the streaming window out of subtree compaction', () => {
        document.body.innerHTML = '<main></main>';
        const main = document.querySelector('main') as HTMLElement;
        Object.defineProperty(main, 'clientHeight', { configurable: true, get: () => 500 });
        Object.defineProperty(main, 'scrollTop', { configurable: true, writable: true, value: 0 });

        const bar = document.createElement('div');
        const body = document.createElement('section');
        const katex = document.createElement('div');
        katex.className = 'katex';
        for (let i = 0; i < 1300; i += 1) {
            katex.appendChild(document.createElement('span'));
        }
        body.appendChild(katex);
        main.append(bar, body);
        defineLayout(bar, 3500, 40);
        defineLayout(body, 3540, 260);
        defineLayout(katex, 0, 180, 320);

        const bridge = {
            getGroups: () => [
                {
                    id: 'streaming',
                    title: 'Streaming',
                    barEl: bar,
                    bodyEls: [body],
                    assistantRootEl: body,
                    assistantIndex: 10,
                    collapsed: false,
                    virtualized: false,
                    isStreaming: true,
                },
            ],
        };

        const controller = new ChatGPTStablePerformanceController(new FakeChatGPTAdapter(), bridge as any) as any;
        controller.init();
        controller.setStreamingBudgetMode('reduced');
        controller.sync();

        expect(body.querySelector('.katex')).toBeTruthy();
        expect(body.querySelector('.aimd-heavy-subtree-placeholder')).toBeNull();
    });

    it('reduced budget mode quarantines expanded old groups outside the active window even when mounted', () => {
        document.body.innerHTML = '<main></main>';
        const main = document.querySelector('main') as HTMLElement;
        Object.defineProperty(main, 'clientHeight', { configurable: true, get: () => 900 });
        Object.defineProperty(main, 'scrollTop', { configurable: true, writable: true, value: 0 });

        const oldBar = document.createElement('div');
        const oldBody = document.createElement('section');
        const activeBar = document.createElement('div');
        const activeBody = document.createElement('section');
        main.append(oldBar, oldBody, activeBar, activeBody);
        defineLayout(oldBar, 0, 40);
        defineLayout(oldBody, 40, 220);
        defineLayout(activeBar, 520, 40);
        defineLayout(activeBody, 560, 220);

        const bridge = {
            getGroups: () => [
                {
                    id: 'old',
                    title: 'Old',
                    barEl: oldBar,
                    bodyEls: [oldBody],
                    assistantRootEl: oldBody,
                    assistantIndex: 0,
                    collapsed: false,
                    virtualized: false,
                    isStreaming: false,
                },
                {
                    id: 'active',
                    title: 'Active',
                    barEl: activeBar,
                    bodyEls: [activeBody],
                    assistantRootEl: activeBody,
                    assistantIndex: 5,
                    collapsed: false,
                    virtualized: false,
                    isStreaming: true,
                },
            ],
        };

        const controller = new ChatGPTStablePerformanceController(new FakeChatGPTAdapter(), bridge as any) as any;
        controller.init();
        controller.setStreamingBudgetMode('reduced');
        controller.sync();

        expect(oldBody.style.contentVisibility).toBe('auto');
        expect(activeBody.style.contentVisibility).toBe('');
    });
});
