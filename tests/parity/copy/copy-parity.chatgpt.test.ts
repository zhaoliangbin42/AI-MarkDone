import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { JSDOM, VirtualConsole } from 'jsdom';
import { ChatGPTAdapter } from '@/drivers/content/adapters/sites/chatgpt';
import { copyMarkdownFromMessage } from '@/services/copy/copy-markdown';

function withDom(html: string, url: string, fn: (dom: JSDOM) => void): void {
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
        fn(dom);
    } finally {
        globalThis.window = originalWindow;
        globalThis.document = originalDocument;
        globalThis.Node = originalNode;
        globalThis.NodeFilter = originalNodeFilter;
        globalThis.HTMLElement = originalHTMLElement;
        globalThis.navigator = originalNavigator;
    }
}

describe('Copy parity (ChatGPT)', () => {
    it('preserves code-viewer content as fenced markdown for the current ChatGPT DOM', () => {
        const html = readFileSync('mocks/ChatGPT/ChatGPT-deepresearch.html', 'utf-8');
        withDom(html, 'https://chatgpt.com/c/mock', () => {
            const adapter = new ChatGPTAdapter();
            const messages = Array.from(document.querySelectorAll(adapter.getMessageSelector())).filter(
                (n): n is HTMLElement => n instanceof HTMLElement
            );
            expect(messages.length).toBeGreaterThan(0);

            const message = messages[messages.length - 1];
            const res = copyMarkdownFromMessage(adapter, message);
            expect(res.ok).toBe(true);
            if (!res.ok) return;

            expect(res.markdown).toContain('```latex');
            expect(res.markdown).toContain('Against this background');
            expect(res.markdown).not.toContain('LaTeXAgainst this background');
        });
    }, 20_000);
});
