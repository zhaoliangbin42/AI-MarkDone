import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
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
        const html = readFileSync('mocks/ChatGPT/ChatGPT-Code.html', 'utf-8');
        withDom(html, 'https://chatgpt.com/c/mock', () => {
            const adapter = new ChatGPTAdapter();
            const message = document.querySelector(adapter.getMessageSelector()) as HTMLElement | null;
            expect(message).toBeTruthy();
            if (!message) return;

            const turn = message.closest('article') as HTMLElement | null;
            expect(turn).toBeTruthy();
            if (!turn) return;

            const anchor = turn.querySelector(adapter.getActionBarSelector()) as HTMLElement | null;
            expect(anchor).toBeTruthy();
            if (!anchor) return;

            const target = anchor.parentElement as HTMLElement | null;
            expect(target).toBeTruthy();
            if (!target) return;

            const host = document.createElement('div');
            host.id = 'aimd-test-toolbar';
            const ok = adapter.injectToolbar(message, host);
            expect(ok).toBe(true);
            expect(target.lastElementChild).toBe(host);
            expect(host.dataset.aimdPlacement).toBe('actionbar');
            expect(document.getElementById('aimd-test-toolbar')).toBe(host);
        });
    });
});
