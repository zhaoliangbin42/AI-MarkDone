import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { JSDOM, VirtualConsole } from 'jsdom';
import { ChatGPTAdapter } from '@/drivers/content/adapters/sites/chatgpt';
import { sendText } from '@/services/sending/sendService';
import { parseContenteditableToPlainText } from '@/core/sending/contenteditable';

function withDom(html: string, url: string, fn: () => Promise<void> | void): Promise<void> {
    const originalWindow = globalThis.window;
    const originalDocument = globalThis.document;
    const originalNode = globalThis.Node;
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
    globalThis.HTMLElement = dom.window.HTMLElement;
    globalThis.navigator = dom.window.navigator as any;

    const maybePromise = (async () => fn())();
    return maybePromise.finally(() => {
        globalThis.window = originalWindow;
        globalThis.document = originalDocument;
        globalThis.Node = originalNode;
        globalThis.HTMLElement = originalHTMLElement;
        globalThis.navigator = originalNavigator;
    });
}

describe('ChatGPT send service (mock composer)', () => {
    it('writes text then clicks send after button becomes enabled', async () => {
        const html = readFileSync('mocks/ChatGPT/ChatGPT-Composer.html', 'utf-8');
        await withDom(html, 'https://chatgpt.com/c/mock', async () => {
            const adapter = new ChatGPTAdapter();
            const input = adapter.getComposerInputElement?.();
            expect(input).toBeTruthy();
            if (!(input instanceof HTMLElement)) return;

            const sendBtn = adapter.getComposerSendButtonElement?.();
            expect(sendBtn).toBeTruthy();
            if (!(sendBtn instanceof HTMLElement)) return;

            let clicked = false;
            sendBtn.addEventListener('click', () => {
                clicked = true;
            });

            // When the driver dispatches input events, we model the host accepting submit.
            input.addEventListener('input', () => {
                // Enable the send button once content exists (legacy-like).
                sendBtn.removeAttribute('disabled');
                sendBtn.setAttribute('aria-disabled', 'false');
            });

            const res = await sendText(adapter, 'hello\nworld', { focusComposer: false, timeoutMs: 500 });
            expect(res.ok).toBe(true);
            expect(clicked).toBe(true);

            const txt = parseContenteditableToPlainText(input);
            expect(txt).toBe('hello\nworld');
        });
    });
});
