import { afterEach, describe, expect, it } from 'vitest';
import { ChatGPTPageWidthController } from '@/ui/content/controllers/ChatGPTPageWidthController';

function appendConversationNode(maxWidth = '800px'): HTMLElement {
    const root = document.createElement('div');
    root.className = 'text-token-text-primary';
    const inner = document.createElement('div');
    const target = document.createElement('div');
    target.style.maxWidth = maxWidth;
    inner.appendChild(target);
    root.appendChild(inner);
    document.body.appendChild(root);
    return target;
}

function appendComposerWidthNode(maxWidth = '800px'): HTMLElement {
    const limiter = document.createElement('div');
    limiter.className = 'mx-auto max-w-(--thread-content-max-width)';
    limiter.style.maxWidth = maxWidth;
    const form = document.createElement('form');
    const composer = document.createElement('div');
    composer.id = 'prompt-textarea';
    form.appendChild(composer);
    limiter.appendChild(form);
    document.body.appendChild(limiter);
    return limiter;
}

afterEach(() => {
    document.head.innerHTML = '';
    document.body.innerHTML = '';
    document.documentElement.removeAttribute('data-aimd-chatgpt-page-width');
});

describe('ChatGPTPageWidthController', () => {
    it('leaves the page untouched at the normal 100% scale', () => {
        appendConversationNode();
        const controller = new ChatGPTPageWidthController();

        controller.init();

        expect(document.getElementById('aimd-chatgpt-page-width-style')).toBeNull();
        expect(document.documentElement.dataset.aimdChatgptPageWidth).toBeUndefined();
    });

    it('expands ChatGPT conversation max-width from the measured original width', () => {
        appendConversationNode('720px');
        const controller = new ChatGPTPageWidthController();

        controller.setScale(125);

        const style = document.getElementById('aimd-chatgpt-page-width-style');
        expect(style?.textContent).toContain('max-width: calc(720px * 125 / 100)');
        expect(style?.textContent).not.toContain('!important');
        expect(document.documentElement.dataset.aimdChatgptPageWidth).toBe('1');
    });

    it('expands the composer limiter with the same page-width scale', () => {
        appendConversationNode('768px');
        appendComposerWidthNode('768px');
        const controller = new ChatGPTPageWidthController();

        controller.setScale(150);

        const css = document.getElementById('aimd-chatgpt-page-width-style')?.textContent ?? '';
        expect(css).toContain('[class*="max-w-(--thread-content-max-width)"]');
        expect(css).toContain('max-width: calc(768px * 150 / 100)');
    });

    it('clears the override when scale returns to normal', () => {
        appendConversationNode();
        const controller = new ChatGPTPageWidthController();

        controller.setScale(130);
        controller.setScale(100);

        expect(document.getElementById('aimd-chatgpt-page-width-style')?.textContent).toBe('');
        expect(document.documentElement.dataset.aimdChatgptPageWidth).toBeUndefined();
    });

    it('retries after ChatGPT mounts the conversation nodes later', async () => {
        const controller = new ChatGPTPageWidthController();

        controller.setScale(140);
        expect(document.getElementById('aimd-chatgpt-page-width-style')?.textContent).toBe('');

        appendConversationNode('900px');
        await Promise.resolve();

        expect(document.getElementById('aimd-chatgpt-page-width-style')?.textContent).toContain('calc(900px * 140 / 100)');
    });

    it('removes injected state on dispose', () => {
        appendConversationNode();
        const controller = new ChatGPTPageWidthController();

        controller.setScale(150);
        controller.dispose();

        expect(document.getElementById('aimd-chatgpt-page-width-style')).toBeNull();
        expect(document.documentElement.dataset.aimdChatgptPageWidth).toBeUndefined();
    });
});
