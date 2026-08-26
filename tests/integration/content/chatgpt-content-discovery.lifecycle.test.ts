import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ChatGPTAdapter } from '@/drivers/content/adapters/sites/chatgpt';
import { DOMContentSurfaceAdapter } from '@/drivers/content/adapters/ContentSurfaceAdapter';
import { ChatGPTConversationContentRuntime } from '@/runtimes/content/ChatGPTConversationContentRuntime';
import { projectSurfaceSelectionToMarkdown } from '@/services/semantic-content/SurfaceProjection';

function roundHtml(index: number, answer: string, options: { action?: boolean; user?: boolean } = {}): string {
    const action = options.action ?? true;
    const user = options.user ?? true;
    return `
        ${user ? `
            <div data-turn-id-container="user-slot-${index}">
                <section data-turn="user" data-turn-id="user-slot-${index}" data-turn-id-container="user-slot-${index}">
                    <div data-message-author-role="user" data-message-id="user-${index}">
                        <div class="whitespace-pre-wrap">Question ${index}</div>
                    </div>
                </section>
            </div>
        ` : ''}
        <div data-turn-id-container="assistant-slot-${index}">
            <section data-turn="assistant" data-turn-id="assistant-slot-${index}" data-turn-id-container="assistant-slot-${index}">
                <div data-message-author-role="assistant" data-message-id="assistant-${index}">
                    <div class="markdown prose">${answer}</div>
                </div>
                ${action
                    ? '<div class="z-0 flex"><button data-testid="copy-turn-action-button">Copy</button></div>'
                    : ''}
            </section>
        </div>
    `;
}

async function settle(ms = 25): Promise<void> {
    await Promise.resolve();
    await vi.advanceTimersByTimeAsync(ms);
    await Promise.resolve();
}

function officialNavigationHtml(count: number): string {
    return `
        <div class="qMYqUG_convSearchResultHighlightRoot">
            <div class="fixed inset-e-4 top-1/2 z-20 -translate-y-1/2">
                ${Array.from({ length: count }, (_, index) => `<button aria-label="Prompt ${index + 1}"></button>`).join('')}
            </div>
        </div>
    `;
}

function createRuntime(id = 'conversation-a', fullHistory = false) {
    history.replaceState({}, '', `/c/${id}${fullHistory ? '?message=' : ''}`);
    const adapter = new ChatGPTAdapter();
    const runtime = new ChatGPTConversationContentRuntime(adapter, { hostSettleDelayMs: 20 });
    return {
        adapter,
        runtime,
        dispose() {
            runtime.dispose();
            adapter.dispose();
        },
    };
}

describe('ChatGPT DOM content discovery lifecycle', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        history.replaceState({}, '', '/');
        document.documentElement.innerHTML = '<head></head><body><main></main></body>';
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('restores content already carrying an official action row at runtime initialization', async () => {
        document.querySelector('main')!.innerHTML = roundHtml(1, 'Initial answer');
        const harness = createRuntime('initial-conversation');

        try {
            harness.runtime.init();
            await settle();

            expect(harness.runtime.source.read()).toMatchObject({
                kind: 'ready',
                snapshot: {
                    historyStatus: 'partial',
                    turns: [{
                        userText: 'Question 1',
                        assistantMarkdown: 'Initial answer',
                    }],
                },
            });
        } finally {
            harness.dispose();
        }
    });

    it('materializes the full DOM sweep and publishes complete history when the trigger is present', async () => {
        document.querySelector('main')!.innerHTML = officialNavigationHtml(2)
            + roundHtml(1, 'Answer 1')
            + roundHtml(2, 'Answer 2');
        const harness = createRuntime('full-history-conversation', true);

        try {
            harness.runtime.init();
            await vi.advanceTimersByTimeAsync(500);
            await Promise.resolve();
            await Promise.resolve();

            expect(harness.runtime.source.read()).toMatchObject({
                kind: 'ready',
                snapshot: {
                    historyStatus: 'complete',
                    turns: [
                        { assistantMarkdown: 'Answer 1' },
                        { assistantMarkdown: 'Answer 2' },
                    ],
                },
            });
        } finally {
            harness.dispose();
        }
    });

    it('hydrates an empty mounted body while the bounded sweep visits its slot', async () => {
        const main = document.querySelector('main')!;
        main.innerHTML = officialNavigationHtml(2)
            + roundHtml(1, 'Answer 1')
            + roundHtml(2, '');
        const emptyAssistantSlot = main.querySelector<HTMLElement>('[data-turn-id-container="assistant-slot-2"]');
        const emptyBody = emptyAssistantSlot?.querySelector<HTMLElement>('.markdown');
        if (!emptyAssistantSlot || !emptyBody) throw new Error('empty assistant fixture is missing');
        emptyAssistantSlot.scrollIntoView = vi.fn(() => {
            emptyBody.textContent = 'Answer 2';
        });
        const harness = createRuntime('full-history-hydration', true);

        try {
            harness.runtime.init();
            await vi.advanceTimersByTimeAsync(500);
            await Promise.resolve();
            await Promise.resolve();

            expect(emptyAssistantSlot.scrollIntoView).toHaveBeenCalled();
            expect(harness.runtime.source.read().snapshot).toMatchObject({
                historyStatus: 'complete',
                turns: [
                    { assistantMarkdown: 'Answer 1' },
                    { assistantMarkdown: 'Answer 2' },
                ],
            });
        } finally {
            harness.dispose();
        }
    });

    it('waits without a timeout until the official action row appears', async () => {
        document.querySelector('main')!.innerHTML = roundHtml(1, 'Slow answer', { action: false });
        const harness = createRuntime('slow-conversation');

        try {
            harness.runtime.init();
            await vi.advanceTimersByTimeAsync(60_000);
            expect(harness.runtime.source.read().snapshot).toBeNull();

            document.querySelector('[data-turn="assistant"]')!.insertAdjacentHTML(
                'beforeend',
                '<div class="z-0 flex"><button data-testid="copy-turn-action-button">Copy</button></div>',
            );
            await settle();

            expect(harness.runtime.source.read().snapshot?.turns[0]?.assistantMarkdown).toBe('Slow answer');
        } finally {
            harness.dispose();
        }
    });

    it('admits a generated message once the stop state ends', async () => {
        document.querySelector('main')!.innerHTML = roundHtml(1, 'Generated answer');
        document.body.insertAdjacentHTML('beforeend', '<button data-testid="stop-button">Stop</button>');
        const harness = createRuntime('generation-conversation');

        try {
            harness.runtime.init();
            await settle();
            expect(harness.runtime.source.read().snapshot).toBeNull();

            document.querySelector('[data-testid="stop-button"]')?.remove();
            await settle();

            expect(harness.runtime.source.read().snapshot?.turns[0]?.assistantMarkdown).toBe('Generated answer');
        } finally {
            harness.dispose();
        }
    });

    it('keeps loaded turns after DOM virtualization and adds a later message', async () => {
        const main = document.querySelector('main')!;
        main.innerHTML = roundHtml(1, 'Answer 1');
        const harness = createRuntime('retained-conversation');

        try {
            harness.runtime.init();
            await settle();
            main.insertAdjacentHTML('beforeend', roundHtml(2, 'Answer 2'));
            await settle();
            main.querySelector('[data-turn="user"]')?.remove();
            main.querySelector('[data-turn="assistant"]')?.remove();
            await settle();

            expect(harness.runtime.source.read().snapshot?.turns.map((turn) => turn.assistantMarkdown)).toEqual([
                'Answer 1',
                'Answer 2',
            ]);
        } finally {
            harness.dispose();
        }
    });

    it('restores independent A and B pools across SPA A to B to A navigation', async () => {
        const main = document.querySelector('main')!;
        main.innerHTML = roundHtml(1, 'Answer A');
        const harness = createRuntime('conversation-a');

        try {
            harness.runtime.init();
            await settle();

            history.pushState({}, '', '/c/conversation-b');
            main.innerHTML = roundHtml(2, 'Answer B');
            await settle();
            expect(harness.runtime.source.read().snapshot?.turns.map((turn) => turn.assistantMarkdown)).toEqual([
                'Answer B',
            ]);

            history.pushState({}, '', '/c/conversation-a');
            main.innerHTML = roundHtml(1, 'Answer A');
            await settle();
            expect(harness.runtime.source.read().snapshot?.turns.map((turn) => turn.assistantMarkdown)).toEqual([
                'Answer A',
            ]);
        } finally {
            harness.dispose();
        }
    });

    it('coalesces pageshow, resume and visible wake signals into one DOM rescan', async () => {
        document.querySelector('main')!.innerHTML = roundHtml(1, 'Wake answer');
        const harness = createRuntime('wake-conversation');
        const originalVisibility = Object.getOwnPropertyDescriptor(document, 'visibilityState');

        try {
            harness.runtime.init();
            await settle();
            const capturesBefore = harness.runtime.readDiscoveryDiagnostics().hostMonitor.stableCaptureCount;
            Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });

            window.dispatchEvent(new Event('pageshow'));
            document.dispatchEvent(new Event('resume'));
            document.dispatchEvent(new Event('visibilitychange'));
            await settle(75);

            expect(harness.runtime.readDiscoveryDiagnostics().hostMonitor.stableCaptureCount).toBe(
                capturesBefore + 1,
            );
            expect(harness.runtime.source.read().snapshot?.turns[0]?.assistantMarkdown).toBe('Wake answer');
        } finally {
            if (originalVisibility) Object.defineProperty(document, 'visibilityState', originalVisibility);
            harness.dispose();
        }
    });

    it('does not emit bridge requests or perform conversation fetches', async () => {
        document.querySelector('main')!.innerHTML = roundHtml(1, 'Local answer');
        const bridgeRequest = vi.fn();
        window.addEventListener('aimd:chatgpt-conversation-bridge:request', bridgeRequest);
        const fetchSpy = vi.spyOn(globalThis, 'fetch');
        const harness = createRuntime('network-boundary');

        try {
            harness.runtime.init();
            await settle();

            expect(bridgeRequest).not.toHaveBeenCalled();
            expect(fetchSpy).not.toHaveBeenCalled();
            expect(harness.runtime.source.read().snapshot?.turns).toHaveLength(1);
        } finally {
            window.removeEventListener('aimd:chatgpt-conversation-bridge:request', bridgeRequest);
            fetchSpy.mockRestore();
            harness.dispose();
        }
    });

    it('keeps canonical partial formula selection available from a DOM-derived pool', async () => {
        document.querySelector('main')!.innerHTML = roundHtml(1, `
            <h1>Complex answer 1</h1>
            <p><strong>Before <span class="math-inline"><span class="katex" data-latex-source="\\frac{x}{y}">
                <span class="katex-mathml"><math><semantics><annotation encoding="application/x-tex">\\frac{x}{y}</annotation></semantics></math></span>
                <span class="katex-html" aria-hidden="true">x/y</span>
            </span></span> after.</strong></p>
        `);
        const harness = createRuntime('formula-selection');

        try {
            harness.runtime.init();
            await settle();
            const text = document.querySelector('.katex-html')!.firstChild as Text;
            const range = document.createRange();
            range.setStart(text, 0);
            range.setEnd(text, text.data.length);
            const selection = window.getSelection()!;
            selection.removeAllRanges();
            selection.addRange(range);

            const surface = new DOMContentSurfaceAdapter(harness.adapter, harness.runtime.materialization);
            const capture = surface.captureSelection(selection);
            expect(capture?.evidence).toBeTruthy();
            expect(capture?.evidence?.atomicFragments).toHaveLength(1);
            const result = projectSurfaceSelectionToMarkdown({
                source: harness.runtime.source,
                materialization: harness.runtime.materialization,
                evidence: capture!.evidence!,
            });
            expect(result).toMatchObject({ status: 'ready', markdown: '$\\frac{x}{y}$' });
        } finally {
            harness.dispose();
        }
    });
});
