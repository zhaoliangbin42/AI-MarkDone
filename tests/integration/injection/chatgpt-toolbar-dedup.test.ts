import { describe, expect, it } from 'vitest';
import { JSDOM, VirtualConsole } from 'jsdom';
import { ChatGPTAdapter } from '@/drivers/content/adapters/sites/chatgpt';
import { ReaderPanel } from '@/ui/content/reader/ReaderPanel';
import { MessageToolbarOrchestrator } from '@/ui/content/controllers/MessageToolbarOrchestrator';

function withDom(html: string, url: string, fn: () => void): void {
    const originalWindow = globalThis.window;
    const originalDocument = globalThis.document;
    const originalNode = globalThis.Node;
    const originalNodeFilter = globalThis.NodeFilter;
    const originalHTMLElement = globalThis.HTMLElement;
    const originalNavigator = globalThis.navigator;

    const virtualConsole = new VirtualConsole();
    virtualConsole.on('jsdomError', () => {
        // Ignore CSS parse warnings from captured production HTML mocks.
    });

    const dom = new JSDOM(html, { url, virtualConsole });
    globalThis.window = dom.window as any;
    globalThis.document = dom.window.document;
    globalThis.Node = dom.window.Node;
    globalThis.NodeFilter = dom.window.NodeFilter;
    globalThis.HTMLElement = dom.window.HTMLElement;
    globalThis.navigator = dom.window.navigator as any;

    try {
        fn();
    } finally {
        globalThis.window = originalWindow;
        globalThis.document = originalDocument;
        globalThis.Node = originalNode;
        globalThis.NodeFilter = originalNodeFilter;
        globalThis.HTMLElement = originalHTMLElement;
        globalThis.navigator = originalNavigator;
    }
}

describe('ChatGPT toolbar injection dedup', () => {
    it('never injects more than one toolbar per official action bar container', () => {
        const html = `
          <main>
            <article data-turn="user">
              <div data-message-author-role="user"><div class="whitespace-pre-wrap">Prompt</div></div>
            </article>
            <article data-turn="assistant">
              <div data-message-author-role="assistant" data-message-id="a1">
                <div class="markdown prose">Answer</div>
              </div>
              <div class="z-0 flex"><div><button data-testid="copy-turn-action-button">Copy</button></div></div>
            </article>
          </main>
        `;
        withDom(html, 'https://chatgpt.com/c/mock', () => {
            const adapter = new ChatGPTAdapter();
            const readerPanel = new ReaderPanel();
            const orchestrator = new MessageToolbarOrchestrator(adapter, { readerPanel });
            orchestrator.setBehaviorFlags({ showWordCount: false, showSaveMessages: false });

            (orchestrator as any).scanAndInject();
            (orchestrator as any).scanAndInject();

            const messages = Array.from(document.querySelectorAll(adapter.getMessageSelector())).filter(
                (n): n is HTMLElement => n instanceof HTMLElement
            );
            expect(messages.length).toBeGreaterThan(0);

            for (const msg of messages) {
                const anchor = adapter.getToolbarAnchorElement?.(msg) ?? null;
                if (!anchor) continue;
                const toolbars = anchor.querySelectorAll('[data-aimd-role="message-toolbar"]');
                expect(toolbars.length).toBe(1);
            }

            // Simulate action bar container replacement for a message (SPA hydration).
            const sampleMsg = messages.find((m) => Boolean(adapter.getToolbarAnchorElement?.(m)));
            expect(sampleMsg).toBeTruthy();
            if (!sampleMsg) return;

            const oldAnchor = adapter.getToolbarAnchorElement?.(sampleMsg) ?? null;
            expect(oldAnchor).toBeTruthy();
            if (!oldAnchor || !oldAnchor.parentElement) return;

            const clone = oldAnchor.cloneNode(true) as HTMLElement;
            oldAnchor.parentElement.replaceChild(clone, oldAnchor);

            // A refresh pass should re-attach to the new anchor without duplicating.
            (orchestrator as any).scanAndInject();

            const newAnchor = adapter.getToolbarAnchorElement?.(sampleMsg) ?? null;
            expect(newAnchor).toBeTruthy();
            if (!newAnchor) return;
            const toolbarsAfter = newAnchor.querySelectorAll('[data-aimd-role="message-toolbar"]');
            expect(toolbarsAfter.length).toBe(1);
        });
    }, 15_000);
});
