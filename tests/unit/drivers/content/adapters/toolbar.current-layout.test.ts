import { describe, expect, it } from 'vitest';
import { JSDOM, VirtualConsole } from 'jsdom';
import { ClaudeAdapter } from '@/drivers/content/adapters/sites/claude';

function withDom(html: string, url: string, fn: () => void): void {
    const originalWindow = globalThis.window;
    const originalDocument = globalThis.document;
    const originalNode = globalThis.Node;
    const originalNodeFilter = globalThis.NodeFilter;
    const originalHTMLElement = globalThis.HTMLElement;
    const originalNavigator = globalThis.navigator;

    const virtualConsole = new VirtualConsole();
    virtualConsole.on('jsdomError', () => {});
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

describe('current toolbar adapter fallbacks', () => {
    it('Claude injects into the trailing action slot of the official toolbar row', () => {
        const html = `
            <div class="group" style="height: auto;">
              <div class="font-claude-response">Answer</div>
            </div>
            <div role="group" aria-label="Message actions">
              <div class="flex items-stretch justify-between">
                <div class="flex items-center">
                  <button data-testid="action-bar-copy"></button>
                  <button data-testid="action-bar-rate-up"></button>
                </div>
                <div class="flex items-center">
                  <button data-testid="official-right-slot"></button>
                </div>
              </div>
            </div>
        `;

        withDom(html, 'https://claude.ai/chat/mock', () => {
            const adapter = new ClaudeAdapter();
            const message = document.querySelector('div.group[style*="height: auto"]') as HTMLElement;
            const anchor = adapter.getToolbarAnchorElement(message);

            expect(anchor).toBeInstanceOf(HTMLElement);
            expect(anchor?.className).toContain('flex items-center');

            const host = document.createElement('div');
            host.id = 'aimd-test-claude-toolbar';
            const ok = adapter.injectToolbar(message, host);

            expect(ok).toBe(true);
            expect(anchor?.lastElementChild).toBe(host);
            expect(host.dataset.aimdPlacement).toBe('actionbar');
        });
    });
});
