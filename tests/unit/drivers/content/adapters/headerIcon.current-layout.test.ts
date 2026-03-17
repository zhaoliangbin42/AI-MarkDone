import { describe, expect, it } from 'vitest';
import { JSDOM, VirtualConsole } from 'jsdom';
import { DeepseekAdapter } from '@/drivers/content/adapters/sites/deepseek';
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

describe('current header icon adapter fallbacks', () => {
    it('Gemini injects into the current top control row when legacy logo anchors are absent', () => {
        const html = `
            <chat-app id="app-root">
              <main>
                <div class="top-shell">
                  <div class="top-controls">
                    <button aria-label="Main menu"></button>
                    <button aria-label="New chat"></button>
                  </div>
                  <div class="hero"></div>
                </div>
              </main>
            </chat-app>
        `;

        withDom(html, 'https://gemini.google.com/app', () => {
            const adapter = new GeminiAdapter();
            const anchor = adapter.getHeaderIconAnchorElement();

            expect(anchor).toBeInstanceOf(HTMLElement);
            expect(anchor?.className).toContain('top-controls');

            const host = document.createElement('div');
            host.appendChild(document.createElement('img'));
            const ok = adapter.injectHeaderIcon(host);

            expect(ok).toBe(true);
            expect(anchor?.lastElementChild).toBe(host);
        });
    });

    it('DeepSeek injects next to the current conversation title like the legacy layout', () => {
        const html = `
            <div class="ds-theme">
              <div class="_7780f2e">
                <div class="_765a5cd ds-scroll-area">
                  <div class="_2be88ba">
                    <div class="f8d1e4c0">
                      <div style="flex: 1 1 0%; min-width: 0px; display: flex; place-content: center; z-index: 12;">
                        <div class="afa34042 e37a04e4 e0a1edb7">FFT原理及应用详解</div>
                      </div>
                    </div>
                    <div class="_0efe408"></div>
                    <div class="_57370c5 _5dedc1e ds-icon-button ds-icon-button--l ds-icon-button--sizing-container"></div>
                  </div>
                </div>
              </div>
            </div>
        `;

        withDom(html, 'https://chat.deepseek.com/a/chat/s/mock', () => {
            const adapter = new DeepseekAdapter();
            const anchor = adapter.getHeaderIconAnchorElement();

            expect(anchor).toBeInstanceOf(HTMLElement);
            expect(anchor?.getAttribute('style')).toContain('place-content: center');

            const host = document.createElement('div');
            host.appendChild(document.createElement('img'));
            const ok = adapter.injectHeaderIcon(host);

            expect(ok).toBe(true);
            expect(anchor?.lastElementChild).toBe(host);
            expect(host.style.marginLeft).toBe('12px');
        });
    });
});
