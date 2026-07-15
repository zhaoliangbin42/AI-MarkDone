import { afterEach, describe, expect, it, vi } from 'vitest';

import { ChatGPTAdapter } from '@/drivers/content/adapters/sites/chatgpt';
import { ChatGPTAtomicSelectionController } from '@/ui/content/controllers/ChatGPTAtomicSelectionController';

function mountMessage(content: string, id = 'assistant-1'): HTMLElement {
    const message = document.createElement('div');
    message.setAttribute('data-message-author-role', 'assistant');
    message.setAttribute('data-message-id', id);
    message.innerHTML = `<div class="markdown prose">${content}</div><div><button data-testid="copy-turn-action-button">Copy</button></div>`;
    document.body.appendChild(message);
    return message;
}

function selectRange(range: Range): void {
    const selection = window.getSelection()!;
    selection.removeAllRanges();
    selection.addRange(range);
}

async function flushSelectionFrame(): Promise<void> {
    await new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()));
}

function dispatchCopy(target: EventTarget = document.body): {
    event: ClipboardEvent;
    setData: ReturnType<typeof vi.fn>;
    readText: () => string;
} {
    let text = '';
    const setData = vi.fn((type: string, value: string) => {
        if (type === 'text/plain') text = value;
    });
    const event = new Event('copy', { bubbles: true, cancelable: true }) as ClipboardEvent;
    Object.defineProperty(event, 'clipboardData', {
        configurable: true,
        value: { setData },
    });
    target.dispatchEvent(event);
    return { event, setData, readText: () => text };
}

afterEach(() => {
    window.getSelection()?.removeAllRanges();
    document.head.innerHTML = '';
    document.body.innerHTML = '';
});

describe('ChatGPTAtomicSelectionController', () => {
    it('highlights and source-copies only a completely selected atom', async () => {
        const message = mountMessage('<p>Before <code>answer</code> after</p>');
        const code = message.querySelector('code')!;
        const text = code.firstChild as Text;
        const range = document.createRange();
        range.setStart(text, 0);
        range.setEnd(text, text.data.length);
        selectRange(range);

        const controller = new ChatGPTAtomicSelectionController(new ChatGPTAdapter());
        controller.init();
        document.dispatchEvent(new Event('selectionchange'));
        await flushSelectionFrame();

        expect(code.getAttribute('data-aimd-page-atomic-state')).toBe('selected');
        const copy = dispatchCopy();
        expect(copy.event.defaultPrevented).toBe(true);
        expect(copy.setData).toHaveBeenCalledWith('text/plain', '`answer`');
        expect(document.getElementById('aimd-chatgpt-atomic-selection-style')?.textContent).not.toContain('!important');

        controller.dispose();
        expect(code.hasAttribute('data-aimd-page-atomic-state')).toBe(false);
    });

    it('leaves partial atomic selections entirely to ChatGPT and the browser', async () => {
        const message = mountMessage('<p>Before <code>answer</code> after</p>');
        const code = message.querySelector('code')!;
        const text = code.firstChild as Text;
        const range = document.createRange();
        range.setStart(text, 1);
        range.setEnd(text, text.data.length);
        selectRange(range);

        const controller = new ChatGPTAtomicSelectionController(new ChatGPTAdapter());
        controller.init();
        document.dispatchEvent(new Event('selectionchange'));
        await flushSelectionFrame();

        expect(code.hasAttribute('data-aimd-page-atomic-state')).toBe(false);
        const copy = dispatchCopy();
        expect(copy.event.defaultPrevented).toBe(false);
        expect(copy.setData).not.toHaveBeenCalled();
        controller.dispose();
    });

    it('does not repeat DOM writes for an unchanged selected-unit set', async () => {
        const message = mountMessage('<p><code>answer</code></p>');
        const code = message.querySelector('code')!;
        const setAttribute = vi.spyOn(code, 'setAttribute');
        const text = code.firstChild as Text;
        const range = document.createRange();
        range.selectNodeContents(code);
        selectRange(range);

        const controller = new ChatGPTAtomicSelectionController(new ChatGPTAdapter());
        controller.init();
        document.dispatchEvent(new Event('selectionchange'));
        await flushSelectionFrame();
        document.dispatchEvent(new Event('selectionchange'));
        await flushSelectionFrame();

        expect(setAttribute.mock.calls.filter(([name]) => name === 'data-aimd-page-atomic-state')).toHaveLength(1);
        controller.dispose();
    });

    it('clears the block state when the native selection collapses', async () => {
        const message = mountMessage('<p><code>answer</code></p>');
        const code = message.querySelector('code')!;
        const range = document.createRange();
        range.selectNodeContents(code);
        selectRange(range);

        const controller = new ChatGPTAtomicSelectionController(new ChatGPTAdapter());
        controller.init();
        document.dispatchEvent(new Event('selectionchange'));
        await flushSelectionFrame();
        expect(code.getAttribute('data-aimd-page-atomic-state')).toBe('selected');

        window.getSelection()!.removeAllRanges();
        document.dispatchEvent(new Event('selectionchange'));
        await flushSelectionFrame();
        expect(code.hasAttribute('data-aimd-page-atomic-state')).toBe(false);
        controller.dispose();
    });

    it('wins the final clipboard write for a strict atom without stopping event propagation', async () => {
        const message = mountMessage('<p><code>answer</code></p>');
        const code = message.querySelector('code')!;
        const range = document.createRange();
        range.selectNodeContents(code);
        selectRange(range);

        const controller = new ChatGPTAtomicSelectionController(new ChatGPTAdapter());
        controller.init();
        const hostCopy = (event: Event) => {
            const clipboardEvent = event as ClipboardEvent;
            clipboardEvent.clipboardData?.setData('text/plain', 'answer');
            event.preventDefault();
        };
        document.addEventListener('copy', hostCopy, { capture: true });
        const laterListener = vi.fn();
        document.addEventListener('copy', laterListener);

        const handled = dispatchCopy();
        const copiedText = handled.readText();
        document.removeEventListener('copy', hostCopy, { capture: true });
        document.removeEventListener('copy', laterListener);
        controller.dispose();

        expect(handled.event.defaultPrevented).toBe(true);
        expect(copiedText).toBe('`answer`');
        expect(laterListener).toHaveBeenCalledTimes(1);
    });

    it('wins when ChatGPT rewrites a selected formula after the document copy listener', async () => {
        const message = mountMessage(`
            <p>
                <span class="katex-display">
                    <span class="katex">
                        <span class="katex-mathml">
                            <math><annotation encoding="application/x-tex">\\frac{x}{y}</annotation></math>
                        </span>
                        <span class="katex-html" aria-hidden="true"><span>x/y</span></span>
                    </span>
                </span>
            </p>
        `);
        const formula = message.querySelector<HTMLElement>('.katex-display')!;
        const visualText = message.querySelector<HTMLElement>('.katex-html span')!.firstChild as Text;
        const range = document.createRange();
        range.setStart(visualText, 0);
        range.setEnd(visualText, visualText.data.length);
        selectRange(range);

        const controller = new ChatGPTAtomicSelectionController(new ChatGPTAdapter());
        controller.init();
        const hostLateWrite = (event: Event) => {
            const clipboardEvent = event as ClipboardEvent;
            clipboardEvent.clipboardData?.setData('text/plain', 'x/y');
            event.preventDefault();
        };
        document.addEventListener('copy', hostLateWrite);

        const handled = dispatchCopy(formula);
        const copiedText = handled.readText();
        document.removeEventListener('copy', hostLateWrite);
        controller.dispose();

        expect(handled.event.defaultPrevented).toBe(true);
        expect(copiedText).toBe('$$\n\\frac{x}{y}\n$$');
    });

    it('fails open for cross-message and streaming selections', async () => {
        const first = mountMessage('<p>Alpha <code>one</code></p>', 'assistant-1');
        const second = mountMessage('<p><code>two</code> Omega</p>', 'assistant-2');
        const firstText = first.querySelector('code')!.firstChild as Text;
        const secondText = second.querySelector('code')!.firstChild as Text;
        const range = document.createRange();
        range.setStart(firstText, 0);
        range.setEnd(secondText, secondText.data.length);
        selectRange(range);

        const adapter = new ChatGPTAdapter();
        const controller = new ChatGPTAtomicSelectionController(adapter);
        controller.init();
        document.dispatchEvent(new Event('selectionchange'));
        await flushSelectionFrame();

        expect(document.querySelector('[data-aimd-page-atomic-state]')).toBeNull();
        expect(dispatchCopy().event.defaultPrevented).toBe(false);

        window.getSelection()!.removeAllRanges();
        const localRange = document.createRange();
        localRange.selectNodeContents(first.querySelector('code')!);
        selectRange(localRange);
        vi.spyOn(adapter, 'isStreamingMessage').mockReturnValue(true);
        document.dispatchEvent(new Event('selectionchange'));
        await flushSelectionFrame();

        expect(document.querySelector('[data-aimd-page-atomic-state]')).toBeNull();
        expect(dispatchCopy().event.defaultPrevented).toBe(false);
        controller.dispose();
    });
});
