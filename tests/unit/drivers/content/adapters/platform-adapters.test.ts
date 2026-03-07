import { readFileSync } from 'node:fs';
import { JSDOM, VirtualConsole } from 'jsdom';
import { describe, expect, it } from 'vitest';
import { ClaudeAdapter } from '@/drivers/content/adapters/sites/claude';
import { DeepseekAdapter } from '@/drivers/content/adapters/sites/deepseek';
import { GeminiAdapter } from '@/drivers/content/adapters/sites/gemini';
import { ChatGPTAdapter } from '@/drivers/content/adapters/sites/chatgpt';
import { collectConversationTurnRefs } from '@/drivers/content/conversation/collectConversationTurnRefs';

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

describe('non-ChatGPT adapter contracts', () => {
    it('ChatGPT exposes a stable header icon anchor and injects into header actions', () => {
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

    it('Gemini exposes stable message, prompt, turn, and parser hooks', () => {
        const html = readFileSync('mocks/Gemini/Gemini-DeepResearch.html', 'utf-8');
        withDom(html, 'https://gemini.google.com/app', () => {
            const adapter = new GeminiAdapter();
            const messages = Array.from(document.querySelectorAll(adapter.getMessageSelector())).filter(
                (node): node is HTMLElement => node instanceof HTMLElement
            );

            expect(messages.length).toBeGreaterThan(0);
            expect(adapter.getMarkdownParserAdapter()).toBeTruthy();
            expect(collectConversationTurnRefs(adapter)).toHaveLength(messages.length);

            const message = messages[messages.length - 1]!;
            expect(adapter.extractUserPrompt(message)).toBeTruthy();
            expect(adapter.isStreamingMessage(message)).toBe(false);
            expect(adapter.isDeepResearchMessage?.(message)).toBe(true);
            expect(adapter.getDeepResearchContent()).toBeInstanceOf(HTMLElement);
            expect(adapter.getTurnRootElement?.(message)).toBeInstanceOf(HTMLElement);

            const host = document.createElement('div');
            const ok = adapter.injectToolbar(message, host);
            expect(ok).toBe(true);
            expect(host.isConnected).toBe(true);
        });
    });

    it('Claude exposes stable message, prompt, turn, and parser hooks', () => {
        const html = readFileSync('mocks/Claude/Claude-Artifact.html', 'utf-8');
        withDom(html, 'https://claude.ai/chat/mock', () => {
            const adapter = new ClaudeAdapter();
            const messages = Array.from(document.querySelectorAll(adapter.getMessageSelector())).filter(
                (node): node is HTMLElement => node instanceof HTMLElement
            );

            expect(messages.length).toBeGreaterThan(0);
            expect(adapter.getMarkdownParserAdapter()).toBeTruthy();
            expect(collectConversationTurnRefs(adapter)).toHaveLength(messages.length);

            const message = messages[messages.length - 1]!;
            expect(adapter.extractUserPrompt(message)).toBeTruthy();
            expect(adapter.isStreamingMessage(message)).toBe(false);
            expect(adapter.getTurnRootElement?.(message)).toBeInstanceOf(HTMLElement);

            const host = document.createElement('div');
            const ok = adapter.injectToolbar(message, host);
            expect(ok).toBe(true);
            expect(host.isConnected).toBe(true);
        });
    });

    it('Deepseek exposes stable message, prompt, turn, and parser hooks', () => {
        const html = readFileSync('mocks/DeepSeek/DeepSeek-single.html', 'utf-8');
        withDom(html, 'https://chat.deepseek.com/c/mock', () => {
            const adapter = new DeepseekAdapter();
            const messages = Array.from(document.querySelectorAll(adapter.getMessageSelector())).filter(
                (node): node is HTMLElement => node instanceof HTMLElement
            );

            expect(messages.length).toBeGreaterThan(0);
            expect(adapter.getMarkdownParserAdapter()).toBeTruthy();
            expect(collectConversationTurnRefs(adapter)).toHaveLength(messages.length);

            const message = messages[messages.length - 1]!;
            expect(adapter.extractUserPrompt(message)).toBeTruthy();
            expect(adapter.isStreamingMessage(message)).toBe(false);
            expect(adapter.getTurnRootElement?.(message)).toBeInstanceOf(HTMLElement);
            const anchor = adapter.getToolbarAnchorElement?.(message) ?? null;
            expect(anchor).toBeInstanceOf(HTMLElement);
            expect(anchor?.className).toContain('ds-flex');

            const host = document.createElement('div');
            const ok = adapter.injectToolbar(message, host);
            expect(ok).toBe(true);
            expect(host.isConnected).toBe(true);
            expect(anchor?.lastElementChild).toBe(host);
        });
    });

    it('Deepseek exposes a stable header icon anchor and injects next to the title', () => {
        const html = readFileSync('mocks/DeepSeek/Deepseek-All.html', 'utf-8');
        withDom(html, 'https://chat.deepseek.com/a/chat/s/mock', () => {
            const adapter = new DeepseekAdapter();
            const anchor = adapter.getHeaderIconAnchorElement?.() ?? null;

            expect(anchor).toBeInstanceOf(HTMLElement);

            const host = document.createElement('div');
            const ok = adapter.injectHeaderIcon?.(host) ?? false;
            expect(ok).toBe(true);
            expect(anchor?.lastElementChild).toBe(host);
            expect(host.className).toContain('ds-icon-button--l');
            expect(host.querySelector('.ds-icon-button__hover-bg')).toBeInstanceOf(HTMLElement);
            expect(host.querySelector('.ds-icon')).toBeInstanceOf(HTMLElement);
            expect(host.getAttribute('role')).toBe('button');
        });
    });

    it('Deepseek resolves the conversation scroll container from the new full-page mock', () => {
        const html = readFileSync('mocks/DeepSeek/Deepseek-All.html', 'utf-8');
        withDom(html, 'https://chat.deepseek.com/a/chat/s/mock', () => {
            const adapter = new DeepseekAdapter();
            const messages = Array.from(document.querySelectorAll(adapter.getMessageSelector())).filter(
                (node): node is HTMLElement => node instanceof HTMLElement
            );

            expect(messages.length).toBeGreaterThan(0);

            const container = adapter.getObserverContainer();
            expect(container).toBeInstanceOf(HTMLElement);
            expect(container?.querySelector(adapter.getMessageSelector())).toBe(messages[0]);
        });
    });
});
