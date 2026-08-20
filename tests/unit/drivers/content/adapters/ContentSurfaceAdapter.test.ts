import { afterEach, describe, expect, it, vi } from 'vitest';

import type { ConversationMaterializationPortV1 } from '@/contracts/conversationMaterialization';
import { DOMContentSurfaceAdapter } from '@/drivers/content/adapters/ContentSurfaceAdapter';
import { ChatGPTAdapter } from '@/drivers/content/adapters/sites/chatgpt';

const target = {
    documentKey: 'chatgpt:conversation:conversation-1',
    turnId: 'turn-1',
    userMessageId: 'user-1',
    assistantMessageId: 'assistant-1',
} as const;

function mountMessage(content: string, id = 'assistant-1'): HTMLElement {
    const message = document.createElement('div');
    message.setAttribute('data-message-author-role', 'assistant');
    message.setAttribute('data-message-id', id);
    message.innerHTML = `<div class="markdown prose">${content}</div><button data-testid="copy-turn-action-button">Copy</button>`;
    document.body.appendChild(message);
    return message;
}

function createMaterialization(message: HTMLElement): ConversationMaterializationPortV1 {
    return {
        read: () => ({
            materializationToken: 'materialization-1',
            contentToken: 'content-token-1',
            entries: [{ target, anchorElement: message }],
        }),
        subscribe: (listener) => {
            listener({
                materializationToken: 'materialization-1',
                contentToken: 'content-token-1',
                entries: [{ target, anchorElement: message }],
            });
            return () => undefined;
        },
        resolveElement: (element) => element.closest('[data-message-id="assistant-1"]') ? target : null,
        locate: async () => 'located',
    };
}

function selectText(node: Text): Selection {
    const range = document.createRange();
    range.selectNodeContents(node);
    const selection = window.getSelection()!;
    selection.removeAllRanges();
    selection.addRange(range);
    return selection;
}

afterEach(() => {
    window.getSelection()?.removeAllRanges();
    document.body.innerHTML = '';
});

describe('DOMContentSurfaceAdapter', () => {
    it('keeps selection location cheap and defers quote/formula evidence', () => {
        const message = mountMessage(
            '<p>Result <span class="katex" data-math-source="\\frac{x}{y}"><span class="katex-html">x y</span></span>.</p>',
        );
        const adapter = new DOMContentSurfaceAdapter(new ChatGPTAdapter(), createMaterialization(message));
        const range = document.createRange();
        const text = message.querySelector('.katex-html')!.firstChild as Text;
        range.selectNodeContents(text);
        const selection = window.getSelection()!;
        selection.removeAllRanges();
        selection.addRange(range);
        const toStringSpy = vi.spyOn(Range.prototype, 'toString');
        const querySelectorAllSpy = vi.spyOn(message, 'querySelectorAll');

        const location = adapter.locateSelection(selection);

        expect(location).not.toBeNull();
        expect(toStringSpy).not.toHaveBeenCalled();
        expect(querySelectorAllSpy).not.toHaveBeenCalled();
        expect(adapter.materializeSelection(location!)?.evidence?.atomicFragments).toHaveLength(1);
        expect(toStringSpy).toHaveBeenCalled();
    });

    it('emits the same platform-neutral quote when non-semantic wrappers change', () => {
        const message = mountMessage('<p>Before <strong><span>clean Markdown</span></strong> after.</p>');
        const adapter = new DOMContentSurfaceAdapter(new ChatGPTAdapter(), createMaterialization(message));
        const firstText = message.querySelector('strong span')!.firstChild as Text;
        const first = adapter.captureSelection(selectText(firstText));

        const root = message.querySelector<HTMLElement>('.markdown.prose')!;
        root.innerHTML = '<section><div><b>clean Markdown</b></div></section>';
        const secondText = root.querySelector('b')!.firstChild as Text;
        const second = adapter.captureSelection(selectText(secondText));

        expect(first?.evidence?.selector.exact).toBe('clean Markdown');
        expect(second?.evidence?.selector.exact).toBe('clean Markdown');
        expect(second?.evidence?.target).toEqual(first?.evidence?.target);
        expect(second?.evidence?.surfaceToken).toBe(first?.evidence?.surfaceToken);
    });

    it('changes only the surface token when the host remounts the content root', () => {
        const message = mountMessage('<p><span>clean Markdown</span></p>');
        const adapter = new DOMContentSurfaceAdapter(new ChatGPTAdapter(), createMaterialization(message));
        const first = adapter.captureSelection(selectText(message.querySelector('span')!.firstChild as Text));

        const replacement = document.createElement('div');
        replacement.className = 'markdown prose';
        replacement.innerHTML = '<article><span>clean Markdown</span></article>';
        message.querySelector('.markdown.prose')!.replaceWith(replacement);
        const second = adapter.captureSelection(selectText(replacement.querySelector('span')!.firstChild as Text));

        expect(second?.evidence?.selector).toEqual(first?.evidence?.selector);
        expect(second?.evidence?.contentToken).toBe(first?.evidence?.contentToken);
        expect(second?.evidence?.surfaceToken).not.toBe(first?.evidence?.surfaceToken);
    });

    it('fails closed for a cross-message selection', () => {
        const firstMessage = mountMessage('<p>First</p>', 'assistant-1');
        const secondMessage = mountMessage('<p>Second</p>', 'assistant-2');
        const range = document.createRange();
        range.setStart(firstMessage.querySelector('p')!.firstChild!, 0);
        range.setEnd(secondMessage.querySelector('p')!.firstChild!, 6);
        const selection = window.getSelection()!;
        selection.removeAllRanges();
        selection.addRange(range);

        const adapter = new DOMContentSurfaceAdapter(new ChatGPTAdapter(), createMaterialization(firstMessage));

        expect(adapter.captureSelection(selection)).toBeNull();
    });

    it('captures authoritative formula source without promoting visual glyph text', () => {
        const message = mountMessage(
            '<p>Result <span class="katex" data-math-source="\\frac{x}{y}"><span class="katex-html">x y</span></span>.</p>',
        );
        const adapter = new DOMContentSurfaceAdapter(new ChatGPTAdapter(), createMaterialization(message));
        const evidence = adapter.captureSelection(selectText(message.querySelector('.katex-html')!.firstChild as Text))?.evidence;

        expect(evidence?.selector.exact).toBe('x y');
        expect(evidence?.atomicFragments).toEqual([{
            kind: 'formula',
            renderedText: 'x y',
            latex: '\\frac{x}{y}',
            isBlock: false,
        }]);
    });

    it('uses the visible KaTeX carrier when MathML duplicates the formula text', () => {
        const message = mountMessage(
            '<p>Result <span class="katex" data-latex-source="\\frac{x}{y}"><span class="katex-mathml"><math><semantics><annotation encoding="application/x-tex">\\frac{x}{y}</annotation></semantics></math></span><span class="katex-html">x/y</span></span>.</p>',
        );
        const adapter = new DOMContentSurfaceAdapter(new ChatGPTAdapter(), createMaterialization(message));
        const evidence = adapter.captureSelection(selectText(message.querySelector('.katex-html')!.firstChild as Text))?.evidence;

        expect(evidence?.atomicFragments).toEqual([{
            kind: 'formula',
            renderedText: 'x/y',
            latex: '\\frac{x}{y}',
            isBlock: false,
        }]);
    });
});
