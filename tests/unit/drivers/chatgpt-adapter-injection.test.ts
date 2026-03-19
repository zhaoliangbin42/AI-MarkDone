import { describe, expect, it } from 'vitest';
import { JSDOM, VirtualConsole } from 'jsdom';
import { ChatGPTAdapter } from '@/drivers/content/adapters/sites/chatgpt';

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

describe('ChatGPTAdapter injection contract', () => {
    it('injectToolbar inserts host into the action bar row when available', () => {
        const html = `
            <div data-testid="conversation-turn-1">
              <article data-turn="assistant">
                <div data-message-author-role="assistant" data-message-id="a1">
                  <div class="markdown prose">Hi</div>
                </div>
              </article>
              <div class="z-0 flex justify-end">
                <div class="official-actions">
                  <button data-testid="copy-turn-action-button">copy</button>
                </div>
              </div>
            </div>
        `;
        withDom(html, 'https://chatgpt.com/c/mock', () => {
            const adapter = new ChatGPTAdapter();
            const message = document.querySelector(adapter.getMessageSelector()) as HTMLElement | null;
            expect(message).toBeTruthy();
            if (!message) return;

            const turn = adapter.getTurnRootElement(message);
            expect(turn).toBeTruthy();
            if (!turn) return;

            const anchor = turn.querySelector(adapter.getActionBarSelector()) as HTMLElement | null;
            expect(anchor).toBeTruthy();
            if (!anchor) return;

            const row = anchor.closest('div.z-0.flex') as HTMLElement | null;
            expect(row).toBeTruthy();
            if (!row) return;

            const officialGroup = anchor.parentElement as HTMLElement | null;
            expect(officialGroup).toBeTruthy();
            if (!officialGroup) return;

            const host = document.createElement('div');
            host.id = 'aimd-test-toolbar';
            const ok = adapter.injectToolbar(message, host);
            expect(ok).toBe(true);
            expect(host.dataset.aimdPlacement).toBe('actionbar');
            // Host should be in the action bar row and adjacent to the official button group.
            expect(row.contains(host)).toBe(true);
            expect(host.previousElementSibling).toBe(officialGroup);
            expect(host.dataset.aimdPlacement).toBe('actionbar');
            expect(document.getElementById('aimd-test-toolbar')).toBe(host);
        });
    });

    it('fails closed when the official action bar is absent', () => {
        const html = `
            <article data-turn="assistant">
              <div data-message-author-role="assistant" data-message-id="a1">
                <div class="markdown prose">Hi</div>
              </div>
            </article>
        `;

        withDom(html, 'https://chatgpt.com/c/mock', () => {
            const adapter = new ChatGPTAdapter();
            const message = document.querySelector(adapter.getMessageSelector()) as HTMLElement | null;
            expect(message).toBeTruthy();
            if (!message) return;

            const host = document.createElement('div');
            const ok = adapter.injectToolbar(message, host);

            expect(adapter.getToolbarAnchorElement?.(message) ?? null).toBeNull();
            expect(ok).toBe(false);
            expect(host.isConnected).toBe(false);
        });
    });

    it('finds and injects into an official action row that is a sibling of the assistant message container', () => {
        const html = `
            <div data-testid="conversation-turn-1">
              <article data-turn="assistant">
                <div data-message-author-role="assistant" data-message-id="a1">
                  <div class="markdown prose">Hi</div>
                </div>
              </article>
              <div class="z-0 flex justify-end">
                <div class="official-actions">
                  <button data-testid="copy-turn-action-button">copy</button>
                </div>
              </div>
            </div>
        `;

        withDom(html, 'https://chatgpt.com/c/mock', () => {
            const adapter = new ChatGPTAdapter();
            const message = document.querySelector(adapter.getMessageSelector()) as HTMLElement | null;
            expect(message).toBeTruthy();
            if (!message) return;

            const anchor = adapter.getToolbarAnchorElement(message);
            expect(anchor).toBeInstanceOf(HTMLElement);
            expect(anchor?.className).toContain('z-0 flex');

            const host = document.createElement('div');
            host.id = 'aimd-test-toolbar-sibling-anchor';
            const ok = adapter.injectToolbar(message, host);

            expect(ok).toBe(true);
            expect(anchor?.contains(host)).toBe(true);
            expect(host.dataset.aimdPlacement).toBe('actionbar');
        });
    });

});
