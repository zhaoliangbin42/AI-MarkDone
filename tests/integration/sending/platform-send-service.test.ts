import { describe, expect, it } from 'vitest';
import { JSDOM, VirtualConsole } from 'jsdom';
import { sendText } from '@/services/sending/sendService';
import { DeepseekAdapter } from '@/drivers/content/adapters/sites/deepseek';
import { GeminiAdapter } from '@/drivers/content/adapters/sites/gemini';
import { ClaudeAdapter } from '@/drivers/content/adapters/sites/claude';
import { parseContenteditableToPlainText } from '@/core/sending/contenteditable';

function withDom(html: string, url: string, fn: () => Promise<void> | void): Promise<void> {
    const originalWindow = globalThis.window;
    const originalDocument = globalThis.document;
    const originalNode = globalThis.Node;
    const originalHTMLElement = globalThis.HTMLElement;
    const originalNavigator = globalThis.navigator;
    const originalHTMLFormElement = globalThis.HTMLFormElement;
    const originalHTMLTextAreaElement = globalThis.HTMLTextAreaElement;
    const originalHTMLInputElement = globalThis.HTMLInputElement;

    const virtualConsole = new VirtualConsole();
    virtualConsole.on('jsdomError', () => {});

    const dom = new JSDOM(html, { url, virtualConsole });
    globalThis.window = dom.window as any;
    globalThis.document = dom.window.document;
    globalThis.Node = dom.window.Node;
    globalThis.HTMLElement = dom.window.HTMLElement;
    globalThis.navigator = dom.window.navigator as any;
    globalThis.HTMLFormElement = dom.window.HTMLFormElement as any;
    globalThis.HTMLTextAreaElement = dom.window.HTMLTextAreaElement as any;
    globalThis.HTMLInputElement = dom.window.HTMLInputElement as any;

    const maybePromise = (async () => fn())();
    return maybePromise.finally(() => {
        globalThis.window = originalWindow;
        globalThis.document = originalDocument;
        globalThis.Node = originalNode;
        globalThis.HTMLElement = originalHTMLElement;
        globalThis.navigator = originalNavigator;
        globalThis.HTMLFormElement = originalHTMLFormElement;
        globalThis.HTMLTextAreaElement = originalHTMLTextAreaElement;
        globalThis.HTMLInputElement = originalHTMLInputElement;
    });
}

describe('non-ChatGPT send service adapter wiring', () => {
    it('DeepSeek wires textarea composer and clicks the floating send control', async () => {
        const html = `
          <main>
            <div class="_020ab5b">
              <div class="_24fad49">
                <textarea class="_27c9245 ds-scroll-area ds-scroll-area--show-on-focus-within d96f2d2a" placeholder="Message DeepSeek" rows="2"></textarea>
              </div>
              <div class="ec4f5d61">
                <div role="button" aria-disabled="false" class="ds-floating-button ds-send-button"></div>
              </div>
            </div>
          </main>
        `;

        await withDom(html, 'https://chat.deepseek.com/', async () => {
            const adapter = new DeepseekAdapter();
            const input = adapter.getComposerInputElement?.();
            expect(input).toBeInstanceOf(HTMLTextAreaElement);

            const sendButton = adapter.getComposerSendButtonElement?.();
            expect(sendButton).toBeInstanceOf(HTMLElement);

            let clicked = false;
            sendButton?.addEventListener('click', () => {
                clicked = true;
            });

            const result = await sendText(adapter, 'hello deepseek', { focusComposer: false, timeoutMs: 500 });
            expect(result.ok).toBe(true);
            expect(clicked).toBe(true);
            expect((input as HTMLTextAreaElement).value).toBe('hello deepseek');
        });
    });

    it('Gemini wires the Quill composer and clicks the native submit button', async () => {
        const html = `
          <main>
            <form>
              <rich-textarea>
                <div class="ql-editor" contenteditable="true" role="textbox" aria-label="Enter a prompt for Gemini">
                  <p></p>
                </div>
              </rich-textarea>
              <button type="button" class="send-button submit" aria-label="Send message" disabled></button>
            </form>
          </main>
        `;

        await withDom(html, 'https://gemini.google.com/app', async () => {
            const adapter = new GeminiAdapter();
            const input = adapter.getComposerInputElement?.();
            expect(input).toBeInstanceOf(HTMLElement);

            const sendButton = adapter.getComposerSendButtonElement?.();
            expect(sendButton).toBeInstanceOf(HTMLElement);

            let clicked = false;
            sendButton?.addEventListener('click', () => {
                clicked = true;
            });

            input?.addEventListener('input', () => {
                sendButton?.removeAttribute('disabled');
                sendButton?.setAttribute('aria-disabled', 'false');
            });

            const result = await sendText(adapter, 'hello gemini', { focusComposer: false, timeoutMs: 500 });
            expect(result.ok).toBe(true);
            expect(clicked).toBe(true);
            expect(parseContenteditableToPlainText(input as HTMLElement)).toBe('hello gemini');
        });
    });

    it('Claude wires the contenteditable composer and submits through the native send button', async () => {
        const html = `
          <main>
            <form>
              <div contenteditable="true" data-testid="chat-input" aria-label="Message Claude"></div>
              <button type="submit" aria-label="Send message"></button>
            </form>
          </main>
        `;

        await withDom(html, 'https://claude.ai/chat/mock', async () => {
            const adapter = new ClaudeAdapter();
            const input = adapter.getComposerInputElement?.();
            expect(input).toBeInstanceOf(HTMLElement);

            const sendButton = adapter.getComposerSendButtonElement?.();
            expect(sendButton).toBeInstanceOf(HTMLElement);

            let submitted = false;
            const form = document.querySelector('form');
            form?.addEventListener('submit', (event) => {
                event.preventDefault();
                submitted = true;
            });

            const result = await sendText(adapter, 'hello claude', { focusComposer: false, timeoutMs: 500 });
            expect(result.ok).toBe(true);
            expect(submitted).toBe(true);
            expect(parseContenteditableToPlainText(input as HTMLElement)).toBe('hello claude');
        });
    });
});
