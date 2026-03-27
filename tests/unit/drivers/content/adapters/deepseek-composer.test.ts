import { afterEach, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { JSDOM, VirtualConsole } from 'jsdom';
import { DeepseekAdapter } from '@/drivers/content/adapters/sites/deepseek';

function installDom(html: string, url = 'https://chat.deepseek.com/') {
    const originalWindow = globalThis.window;
    const originalDocument = globalThis.document;
    const originalNode = globalThis.Node;
    const originalHTMLElement = globalThis.HTMLElement;
    const originalNavigator = globalThis.navigator;
    const originalHTMLTextAreaElement = globalThis.HTMLTextAreaElement;

    const virtualConsole = new VirtualConsole();
    virtualConsole.on('jsdomError', () => {});

    const dom = new JSDOM(html, { url, virtualConsole });
    globalThis.window = dom.window as any;
    globalThis.document = dom.window.document;
    globalThis.Node = dom.window.Node;
    globalThis.HTMLElement = dom.window.HTMLElement;
    globalThis.navigator = dom.window.navigator as any;
    globalThis.HTMLTextAreaElement = dom.window.HTMLTextAreaElement as any;

    return () => {
        globalThis.window = originalWindow;
        globalThis.document = originalDocument;
        globalThis.Node = originalNode;
        globalThis.HTMLElement = originalHTMLElement;
        globalThis.navigator = originalNavigator;
        globalThis.HTMLTextAreaElement = originalHTMLTextAreaElement;
    };
}

describe('DeepseekAdapter composer state', () => {
    let teardown: (() => void) | null = null;

    afterEach(() => {
        teardown?.();
        teardown = null;
    });

    it('selects the composer-local trailing action button from the sending page mock', () => {
        const html = readFileSync('mocks/DeepSeek/DeepSeek-Sending.html', 'utf-8');
        teardown = installDom(html);

        const adapter = new DeepseekAdapter();
        const button = adapter.getComposerSendButtonElement?.();

        expect(button).toBeInstanceOf(HTMLElement);
        expect(button?.className).toContain('_7436101');
        expect(button?.closest('.ec4f5d61')).toBeTruthy();
    });

    it('treats the sending page mock as composer streaming', () => {
        const html = readFileSync('mocks/DeepSeek/DeepSeek-Sending.html', 'utf-8');
        teardown = installDom(html);

        const adapter = new DeepseekAdapter();

        expect(adapter.isComposerStreaming?.()).toBe(true);
    });
});
