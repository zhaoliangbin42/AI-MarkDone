import { readFileSync } from 'node:fs';
import { JSDOM, VirtualConsole } from 'jsdom';
import { describe, expect, it } from 'vitest';
import { ChatGPTAdapter } from '@/drivers/content/adapters/sites/chatgpt';

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

describe('ChatGPT production adapter contract', () => {
    it('exposes a stable header icon anchor and injects into header actions', () => {
        const html = readFileSync('mocks/ChatGPT/ChatGPT-All.html', 'utf-8');
        withDom(html, 'https://chatgpt.com/c/mock', () => {
            const adapter = new ChatGPTAdapter();
            const anchor = adapter.getHeaderIconAnchorElement?.() ?? null;

            expect(anchor).toBeInstanceOf(HTMLElement);
            expect(anchor?.id).toBe('conversation-header-actions');

            const host = document.createElement('div');
            const ok = adapter.injectHeaderIcon?.(host) ?? false;
            expect(ok).toBe(true);
            expect(anchor?.firstElementChild).toBe(host);
            expect(host.style.width).toBe('36px');
            expect(host.className).toContain('hover:bg-token-surface-hover');
        });
    });
});
