import { describe, expect, it } from 'vitest';
import { JSDOM, VirtualConsole } from 'jsdom';
import { ClaudeAdapter } from '@/drivers/content/adapters/sites/claude';
import { GeminiAdapter } from '@/drivers/content/adapters/sites/gemini';

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

describe('platform theme detectors', () => {
    it('Claude reads color mode from html[data-mode] instead of brand data-theme', () => {
        withDom('<html data-theme="claude" data-mode="dark"><body></body></html>', 'https://claude.ai/chat/mock', () => {
            const detector = new ClaudeAdapter().getThemeDetector();
            expect(detector.detect()).toBe('dark');
            expect(detector.hasExplicitTheme()).toBe(true);
            expect(detector.getObserveTargets()).toEqual([{ element: 'html', attributes: ['class', 'data-theme', 'data-mode', 'style'] }]);
        });
    });

    it('Claude still supports explicit html[data-theme] light/dark as fallback', () => {
        withDom('<html data-theme="light"><body></body></html>', 'https://claude.ai/chat/mock', () => {
            const detector = new ClaudeAdapter().getThemeDetector();
            expect(detector.detect()).toBe('light');
            expect(detector.hasExplicitTheme()).toBe(true);
        });
    });

    it('Gemini supports explicit html class dark/light in addition to data-theme', () => {
        withDom('<html class="dark"><body></body></html>', 'https://gemini.google.com/app', () => {
            const detector = new GeminiAdapter().getThemeDetector();
            expect(detector.detect()).toBe('dark');
            expect(detector.hasExplicitTheme()).toBe(true);
            expect(detector.getObserveTargets()).toEqual([
                { element: 'html', attributes: ['class', 'data-theme', 'style'] },
                { element: 'body', attributes: ['class'] },
            ]);
        });
    });

    it('Gemini still supports html[data-theme] when present', () => {
        withDom('<html data-theme="light"><body></body></html>', 'https://gemini.google.com/app', () => {
            const detector = new GeminiAdapter().getThemeDetector();
            expect(detector.detect()).toBe('light');
            expect(detector.hasExplicitTheme()).toBe(true);
        });
    });

    it('Gemini reads dark mode from body.dark-theme on the current layout', () => {
        withDom('<html class="trancy-zh-CN"><body class="theme-host dark-theme"></body></html>', 'https://gemini.google.com/app', () => {
            const detector = new GeminiAdapter().getThemeDetector();
            expect(detector.detect()).toBe('dark');
            expect(detector.hasExplicitTheme()).toBe(true);
        });
    });
});
