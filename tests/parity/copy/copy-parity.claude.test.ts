import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { JSDOM, VirtualConsole } from 'jsdom';
import { ClaudeAdapter } from '@/drivers/content/adapters/sites/claude';
import { copyMarkdownFromMessage } from '@/services/copy/copy-markdown';
import { WordCounter } from '@/core/text/wordCounter';

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

describe('Copy parity (Claude)', () => {
    it('preserves prose around Claude code blocks without leaking code-block headers into markdown', () => {
        const html = readFileSync('mocks/Claude/Claude-all.html', 'utf-8');
        withDom(html, 'https://claude.ai/chat/mock', () => {
            const adapter = new ClaudeAdapter();
            const messages = Array.from(document.querySelectorAll(adapter.getMessageSelector())).filter(
                (n): n is HTMLElement => n instanceof HTMLElement
            );
            expect(messages.length).toBeGreaterThan(0);

            const message = messages[messages.length - 1];
            const res = copyMarkdownFromMessage(adapter, message);
            expect(res.ok).toBe(true);
            if (!res.ok) return;

            expect(res.markdown).toContain('这是"最长连续序列"问题。关键是要在 O(n) 时间内完成，不能排序');
            expect(res.markdown).toContain('**JavaScript:**');
            expect(res.markdown).toContain('```python');
            expect(res.markdown).not.toContain('python```python');
            expect(res.markdown).toContain('def longestConsecutive');

            const counter = new WordCounter();
            expect(counter.format(counter.count(res.markdown))).not.toBe('0 Words / 0 Chars');
        });
    });
});
