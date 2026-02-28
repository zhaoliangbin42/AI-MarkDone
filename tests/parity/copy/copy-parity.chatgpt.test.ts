import { afterEach, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { JSDOM, VirtualConsole } from 'jsdom';
import { adapterRegistry as legacyAdapterRegistry } from '../../../archive/src/content/adapters/registry';
import { MarkdownParser as LegacyMarkdownParser } from '../../../archive/src/content/parsers/markdown-parser';
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

function legacyCopyMarkdownForMessage(messageElement: HTMLElement): string {
    const adapter = legacyAdapterRegistry.getAdapter();
    expect(adapter).toBeTruthy();
    if (!adapter) return '';

    const parser = new LegacyMarkdownParser();

    if (messageElement.tagName.toLowerCase() === 'article') {
        return parser.parse(messageElement);
    }

    const contentSelector = adapter.getMessageContentSelector();
    const contentElement = messageElement.querySelector(contentSelector) as HTMLElement | null;
    expect(contentElement).toBeTruthy();
    if (!contentElement) return '';

    return parser.parse(contentElement);
}

describe('Copy parity (ChatGPT)', () => {
    afterEach(() => {
        // Reset registry cache between tests.
        legacyAdapterRegistry.getAdapter('https://invalid.example');
    });

    it('matches legacy markdown output for ChatGPT-Code.html (last assistant message)', () => {
        const html = readFileSync('mocks/ChatGPT/ChatGPT-Code.html', 'utf-8');
        withDom(html, 'https://chatgpt.com/c/mock', () => {
            const legacyAdapter = legacyAdapterRegistry.getAdapter();
            expect(legacyAdapter).toBeTruthy();
            if (!legacyAdapter) return;

            const messages = Array.from(document.querySelectorAll(legacyAdapter.getMessageSelector())).filter(
                (n): n is HTMLElement => n instanceof HTMLElement
            );
            expect(messages.length).toBeGreaterThan(0);

            const message = messages[messages.length - 1];
            const legacyMarkdown = legacyCopyMarkdownForMessage(message);

            const adapter = new ChatGPTAdapter();
            const res = copyMarkdownFromMessage(adapter, message);
            expect(res.ok).toBe(true);
            if (!res.ok) return;

            expect(res.markdown).toBe(legacyMarkdown);
        });
    });
});

