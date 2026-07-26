import { afterEach, describe, expect, it, vi } from 'vitest';

import { ChatGPTAdapter } from '@/drivers/content/adapters/sites/chatgpt';
import { buildCanonicalMarkdownRichPayload } from '@/services/copy/atomicSelectionRichHtml';
import { setCanonicalMarkdownCopyFormulaFormat } from '@/services/copy/canonicalMarkdownCopy';
import { ChatGPTAtomicSelectionController } from '@/ui/content/controllers/ChatGPTAtomicSelectionController';

const originalExecCommand = document.execCommand;

function createController(adapter = new ChatGPTAdapter()): ChatGPTAtomicSelectionController {
    return new ChatGPTAtomicSelectionController(
        adapter,
        async (params) => buildCanonicalMarkdownRichPayload(params),
    );
}

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

async function flushMicrotasks(): Promise<void> {
    await Promise.resolve();
    await Promise.resolve();
}

function readBlob(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.addEventListener('load', () => resolve(String(reader.result ?? '')));
        reader.addEventListener('error', () => reject(reader.error));
        reader.readAsText(blob);
    });
}

function dispatchCopy(target: EventTarget = document.body): {
    event: ClipboardEvent;
    clearData: ReturnType<typeof vi.fn>;
    setData: ReturnType<typeof vi.fn>;
    readData: (type: string) => string | undefined;
    readText: () => string;
} {
    const data = new Map<string, string>();
    const clearData = vi.fn((type?: string) => {
        if (type) data.delete(type);
        else data.clear();
    });
    const setData = vi.fn((type: string, value: string) => {
        data.set(type, value);
    });
    const event = new Event('copy', { bubbles: true, cancelable: true }) as ClipboardEvent;
    Object.defineProperty(event, 'clipboardData', {
        configurable: true,
        value: { clearData, setData },
    });
    target.dispatchEvent(event);
    return {
        event,
        clearData,
        setData,
        readData: (type) => data.get(type),
        readText: () => data.get('text/plain') ?? '',
    };
}

function installNativeCopyCommand(): {
    clipboardData: Map<string, string>;
    execCommand: ReturnType<typeof vi.fn>;
} {
    const clipboardData = new Map<string, string>();
    const execCommand = vi.fn(() => {
        const event = new Event('copy', { bubbles: true, cancelable: true }) as ClipboardEvent;
        Object.defineProperty(event, 'clipboardData', {
            configurable: true,
            value: {
                clearData: () => clipboardData.clear(),
                setData: (type: string, value: string) => clipboardData.set(type, value),
            },
        });
        document.body.dispatchEvent(event);
        return true;
    });
    Object.defineProperty(document, 'execCommand', { configurable: true, value: execCommand });
    return { clipboardData, execCommand };
}

afterEach(() => {
    setCanonicalMarkdownCopyFormulaFormat('markdown-dollar');
    Object.defineProperty(document, 'execCommand', { configurable: true, value: originalExecCommand });
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

        const controller = createController();
        controller.init();
        document.dispatchEvent(new Event('selectionchange'));
        await flushSelectionFrame();

        expect(code.getAttribute('data-aimd-page-atomic-state')).toBe('selected');
        const hostHtml = (event: Event) => {
            (event as ClipboardEvent).clipboardData?.setData('text/html', '<p>host visual copy</p>');
        };
        document.addEventListener('copy', hostHtml, { capture: true });
        const copy = dispatchCopy();
        document.removeEventListener('copy', hostHtml, { capture: true });
        expect(copy.event.defaultPrevented).toBe(true);
        expect(copy.clearData).toHaveBeenCalledTimes(1);
        expect(copy.readData('text/html')).toBeUndefined();
        expect(copy.setData).toHaveBeenCalledWith('text/plain', '`answer`');
        const selectionCss = document.getElementById('aimd-chatgpt-atomic-selection-style')?.textContent ?? '';
        expect(selectionCss).not.toContain('!important');
        expect(selectionCss).not.toContain('box-shadow:');
        expect(selectionCss).toContain('outline: 1px solid color-mix(in srgb, var(--aimd-interactive-primary) 32%, transparent);');

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

        const controller = createController();
        controller.init();
        document.dispatchEvent(new Event('selectionchange'));
        await flushSelectionFrame();

        expect(code.hasAttribute('data-aimd-page-atomic-state')).toBe(false);
        const copy = dispatchCopy();
        expect(copy.event.defaultPrevented).toBe(false);
        expect(copy.setData).not.toHaveBeenCalled();
        controller.dispose();
    });

    it('fails open when a complete atom is mixed with a partial formula', async () => {
        const message = mountMessage(`
            <p>
                <code>answer</code>
                then
                <span class="katex">
                    <span class="katex-mathml">
                        <math><semantics><mrow><mi>x</mi><mo>+</mo><mi>y</mi></mrow><annotation encoding="application/x-tex">x+y</annotation></semantics></math>
                    </span>
                    <span class="katex-html" aria-hidden="true"><span>x</span><span>+</span><span>y</span></span>
                </span>
            </p>
        `);
        const code = message.querySelector('code')!;
        const codeText = code.firstChild as Text;
        const partialFormulaEnd = message.querySelectorAll('.katex-html span')[1]!.firstChild as Text;
        const range = document.createRange();
        range.setStart(codeText, 0);
        range.setEnd(partialFormulaEnd, partialFormulaEnd.data.length);
        selectRange(range);

        const controller = createController();
        controller.init();
        document.dispatchEvent(new Event('selectionchange'));
        await flushSelectionFrame();

        const copy = dispatchCopy();
        expect(code.hasAttribute('data-aimd-page-atomic-state')).toBe(false);
        expect(copy.event.defaultPrevented).toBe(false);
        expect(copy.setData).not.toHaveBeenCalled();
        expect(document.querySelector('.aimd-toolbar-hover-action-host')).toBeNull();
        controller.dispose();
    });

    it('keeps atomic highlighting when Markdown serialization fails', async () => {
        const message = mountMessage(`
            <p>
                <code>answer</code>
                then
                <span class="katex"><span class="katex-html" aria-hidden="true">x</span></span>
            </p>
        `);
        const code = message.querySelector('code')!;
        const codeText = code.firstChild as Text;
        const formulaText = message.querySelector('.katex-html')!.firstChild as Text;
        const range = document.createRange();
        range.setStart(codeText, 0);
        range.setEnd(formulaText, formulaText.data.length);
        selectRange(range);

        const controller = createController();
        controller.init();
        document.dispatchEvent(new Event('selectionchange'));
        await flushSelectionFrame();

        // The formula has no authoritative source, so copy must fail open.
        // Atomic recognition is independent and must still mark the complete code atom.
        expect(code.getAttribute('data-aimd-page-atomic-state')).toBe('selected');
        expect(document.querySelector('.aimd-toolbar-hover-action-host')).toBeNull();
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

        const controller = createController();
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

        const controller = createController();
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

        const controller = createController();
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

        const controller = createController();
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

    it('writes canonical Markdown instead of host visual text for a large rendered formula', () => {
        const message = mountMessage(`
            <p>
                <span class="katex" data-latex-source="\\frac{x}{y}">
                    <span class="katex-html" aria-hidden="true">x / y</span>
                </span>
            </p>
        `);
        const formula = message.querySelector<HTMLElement>('.katex')!;
        for (let index = 0; index < 5_100; index += 1) {
            formula.appendChild(document.createElement('span'));
        }
        const range = document.createRange();
        range.selectNodeContents(formula);
        selectRange(range);

        const controller = createController();
        controller.init();
        const hostCopy = (event: Event) => {
            const clipboardEvent = event as ClipboardEvent;
            clipboardEvent.clipboardData?.setData('text/plain', 'x / y');
            event.preventDefault();
        };
        document.addEventListener('copy', hostCopy);

        const handled = dispatchCopy(formula);
        document.removeEventListener('copy', hostCopy);
        controller.dispose();

        expect(handled.readText()).toBe('$\\frac{x}{y}$');
        expect(handled.readData('text/html')).toBeUndefined();
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
        const controller = createController(adapter);
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

    it('opens the rich-copy action from the real native selection path', async () => {
        const message = mountMessage('<p>Before <code>answer</code> after</p>');
        const code = message.querySelector('code')!;
        const text = code.firstChild as Text;
        const range = document.createRange();
        range.setStart(text, 0);
        range.setEnd(text, text.data.length);
        selectRange(range);

        const originalClipboard = navigator.clipboard;
        const originalClipboardItem = (window as Window & { ClipboardItem?: unknown }).ClipboardItem;
        const write = vi.fn(async () => undefined);
        const ClipboardItemStub = vi.fn(function ClipboardItem(this: any, items: Record<string, Blob>) {
            this.items = items;
        });
        (ClipboardItemStub as any).supports = vi.fn(() => true);
        Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { write } });
        Object.defineProperty(window, 'ClipboardItem', { configurable: true, value: ClipboardItemStub });
        const nativeCopy = installNativeCopyCommand();

        const controller = createController();
        controller.init();
        document.dispatchEvent(new Event('selectionchange'));
        await flushSelectionFrame();

        const host = document.querySelector('.aimd-toolbar-hover-action-host') as HTMLElement | null;
        const markdownButton = host?.shadowRoot?.querySelector<HTMLButtonElement>('[data-action="copy-markdown-selection"]');
        const richButton = host?.shadowRoot?.querySelector<HTMLButtonElement>('[data-action="copy-rich-selection"]');
        expect(markdownButton).toBeNull();
        expect(richButton?.textContent).toBe('Copy with formatting');
        expect(richButton?.disabled).toBe(false);
        richButton?.click();
        await Promise.resolve();

        expect(write).toHaveBeenCalledTimes(1);
        expect(nativeCopy.execCommand).not.toHaveBeenCalled();
        const item = (ClipboardItemStub as any).mock.instances[0];
        expect(Object.keys(item.items)).toEqual(['text/html', 'text/plain']);
        expect(await readBlob(item.items['text/html'])).toContain('<code>answer</code>');
        expect(await readBlob(item.items['text/plain'])).toBe('`answer`');

        controller.dispose();
        Object.defineProperty(navigator, 'clipboard', { configurable: true, value: originalClipboard });
        Object.defineProperty(window, 'ClipboardItem', { configurable: true, value: originalClipboardItem });
    });

    it('copies formula source as semantic HTML only after the rich action is clicked', async () => {
        const message = mountMessage(`
            <p>Result
                <span class="katex" data-latex="\\frac{x}{y}">
                    <span class="katex-mathml">
                        <math><semantics><mrow><mfrac><mi>x</mi><mi>y</mi></mfrac></mrow><annotation encoding="application/x-tex">\\frac{x}{y}</annotation></semantics></math>
                    </span>
                    <span class="katex-html" aria-hidden="true">x/y</span>
                </span>
            </p>
        `);
        const formula = message.querySelector<HTMLElement>('.katex')!;
        const range = document.createRange();
        range.selectNodeContents(formula);
        selectRange(range);

        const originalClipboard = navigator.clipboard;
        const originalClipboardItem = (window as Window & { ClipboardItem?: unknown }).ClipboardItem;
        const write = vi.fn(async () => undefined);
        const ClipboardItemStub = vi.fn(function ClipboardItem(this: any, items: Record<string, Blob>) {
            this.items = items;
        });
        (ClipboardItemStub as any).supports = vi.fn(() => true);
        Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { write } });
        Object.defineProperty(window, 'ClipboardItem', { configurable: true, value: ClipboardItemStub });

        const controller = createController();
        try {
            controller.init();
            document.dispatchEvent(new Event('selectionchange'));
            await flushSelectionFrame();

            expect(write).not.toHaveBeenCalled();
            expect(ClipboardItemStub).not.toHaveBeenCalled();
            const host = document.querySelector('.aimd-toolbar-hover-action-host') as HTMLElement | null;
            const richButton = host?.shadowRoot?.querySelector<HTMLButtonElement>('[data-action="copy-rich-selection"]');
            expect(richButton?.disabled).toBe(false);
            richButton?.click();
            await flushMicrotasks();

            expect(write).toHaveBeenCalledTimes(1);
            const item = (ClipboardItemStub as any).mock.instances[0];
            expect(await readBlob(item.items['text/plain'])).toBe('$\\frac{x}{y}$');
            expect(await readBlob(item.items['text/html'])).toContain('<span>$\\frac{x}{y}$</span>');
            expect(await readBlob(item.items['text/html'])).not.toContain('<math');
            expect(await readBlob(item.items['text/html'])).not.toContain('<m:oMath');
            expect(window.getSelection()?.toString()).toContain('x/y');
        } finally {
            controller.dispose();
            Object.defineProperty(navigator, 'clipboard', { configurable: true, value: originalClipboard });
            Object.defineProperty(window, 'ClipboardItem', { configurable: true, value: originalClipboardItem });
        }
    });

    it('reports a rich-copy failure without silently copying Markdown', async () => {
        const message = mountMessage('<p>Before <code>answer</code> after</p>');
        const code = message.querySelector('code')!;
        const range = document.createRange();
        range.selectNodeContents(code);
        selectRange(range);

        const originalClipboard = navigator.clipboard;
        const originalClipboardItem = (window as Window & { ClipboardItem?: unknown }).ClipboardItem;
        const writeText = vi.fn(async () => undefined);
        Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
        Object.defineProperty(window, 'ClipboardItem', { configurable: true, value: undefined });

        const controller = createController();
        try {
            controller.init();
            document.dispatchEvent(new Event('selectionchange'));
            await flushSelectionFrame();

            const host = document.querySelector('.aimd-toolbar-hover-action-host') as HTMLElement | null;
            const richButton = host?.shadowRoot?.querySelector<HTMLButtonElement>('[data-action="copy-rich-selection"]');
            richButton?.dispatchEvent(new Event('pointerdown', { bubbles: true }));
            richButton?.click();
            await flushMicrotasks();

            expect(writeText).not.toHaveBeenCalled();
            expect(document.querySelector('[data-aimd-role="toast-viewport"]')?.textContent)
                .toContain('not copied');
            expect(document.querySelector('.aimd-toolbar-hover-action-host')).not.toBeNull();
        } finally {
            controller.dispose();
            Object.defineProperty(navigator, 'clipboard', { configurable: true, value: originalClipboard });
            Object.defineProperty(window, 'ClipboardItem', { configurable: true, value: originalClipboardItem });
        }
    });

    it('does not write or prepare rich clipboard content while the user only selects or Markdown-copies a formula', async () => {
        const message = mountMessage('<p><span class="katex" data-latex-source="x^2"><span class="katex-html" aria-hidden="true">x²</span></span></p>');
        const formula = message.querySelector<HTMLElement>('.katex')!;
        const range = document.createRange();
        range.selectNodeContents(formula);
        selectRange(range);
        const originalClipboard = navigator.clipboard;
        const originalClipboardItem = (window as Window & { ClipboardItem?: unknown }).ClipboardItem;
        const write = vi.fn(async () => undefined);
        const ClipboardItemStub = vi.fn();
        Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { write } });
        Object.defineProperty(window, 'ClipboardItem', { configurable: true, value: ClipboardItemStub });

        const controller = createController();
        try {
            controller.init();
            document.dispatchEvent(new Event('selectionchange'));
            await flushSelectionFrame();
            const copied = dispatchCopy(formula);

            expect(copied.readText()).toBe('$x^2$');
            expect(write).not.toHaveBeenCalled();
            expect(ClipboardItemStub).not.toHaveBeenCalled();
        } finally {
            controller.dispose();
            Object.defineProperty(navigator, 'clipboard', { configurable: true, value: originalClipboard });
            Object.defineProperty(window, 'ClipboardItem', { configurable: true, value: originalClipboardItem });
        }
    });

    it('copies the configured rich formula source format without a preparation state', async () => {
        const message = mountMessage('<p><span class="katex" data-latex="x^2"><span class="katex-html" aria-hidden="true">x²</span></span></p>');
        const formula = message.querySelector<HTMLElement>('.katex')!;
        const range = document.createRange();
        range.selectNodeContents(formula);
        selectRange(range);

        const originalClipboard = navigator.clipboard;
        const originalClipboardItem = (window as Window & { ClipboardItem?: unknown }).ClipboardItem;
        const write = vi.fn(async () => undefined);
        const ClipboardItemStub = vi.fn(function ClipboardItem(this: any, items: Record<string, Blob>) {
            this.items = items;
        });
        (ClipboardItemStub as any).supports = vi.fn(() => true);
        Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { write } });
        Object.defineProperty(window, 'ClipboardItem', { configurable: true, value: ClipboardItemStub });
        const nativeCopy = installNativeCopyCommand();

        const controller = createController();
        try {
            controller.setRichCopyFormulaFormat('raw');
            controller.init();
            document.dispatchEvent(new Event('selectionchange'));
            await flushSelectionFrame();

            const host = document.querySelector('.aimd-toolbar-hover-action-host') as HTMLElement | null;
            const richButton = host?.shadowRoot?.querySelector<HTMLButtonElement>('[data-action="copy-rich-selection"]');
            expect(richButton?.disabled).toBe(false);
            richButton?.click();
            await flushMicrotasks();

            expect(write).toHaveBeenCalledTimes(1);
            expect(nativeCopy.execCommand).not.toHaveBeenCalled();
            const item = (ClipboardItemStub as any).mock.instances[0];
            expect(await readBlob(item.items['text/html'])).toContain('<span>x^2</span>');
            expect(await readBlob(item.items['text/html'])).not.toContain('<math');
            expect(await readBlob(item.items['text/plain'])).toBe('$x^2$');
        } finally {
            controller.dispose();
            Object.defineProperty(navigator, 'clipboard', { configurable: true, value: originalClipboard });
            Object.defineProperty(window, 'ClipboardItem', { configurable: true, value: originalClipboardItem });
        }
    });

    it('rebuilds the current payload when Markdown formula settings change independently', async () => {
        const message = mountMessage(`
            <p><span class="katex" data-latex="x^2">
                <span class="katex-mathml"><math><msup><mi>x</mi><mn>2</mn></msup></math></span>
                <span class="katex-html" aria-hidden="true">x²</span>
            </span></p>
        `);
        const formula = message.querySelector<HTMLElement>('.katex')!;
        const range = document.createRange();
        range.selectNodeContents(formula);
        selectRange(range);
        const nativeCopy = installNativeCopyCommand();

        const controller = createController();
        try {
            controller.init();
            document.dispatchEvent(new Event('selectionchange'));
            await flushSelectionFrame();

            setCanonicalMarkdownCopyFormulaFormat('latex-brackets');
            controller.setRichCopyFormulaFormat('raw');
            document.querySelector('.aimd-toolbar-hover-action-host')
                ?.shadowRoot
                ?.querySelector<HTMLButtonElement>('[data-action="copy-rich-selection"]')
                ?.click();
            await flushMicrotasks();

            expect(nativeCopy.clipboardData.get('text/plain')).toBe('\\(x^2\\)');
        } finally {
            controller.dispose();
        }
    });

    it('ignores page MathML and uses the configured source format for rich copy', async () => {
        const message = mountMessage(`
            <p>Result</p>
            <span class="katex-display">
                <span class="katex">
                    <span class="katex-mathml"><math><semantics><mrow><mfrac><mi>x</mi><mi>y</mi></mfrac></mrow><annotation encoding="application/x-tex">\\frac{x}{y}</annotation></semantics></math></span>
                    <span class="katex-html" aria-hidden="true"><span>x/y</span></span>
                </span>
            </span>
        `);
        const formula = message.querySelector<HTMLElement>('.katex-display')!;
        const range = document.createRange();
        range.selectNodeContents(formula);
        selectRange(range);

        const originalClipboard = navigator.clipboard;
        const originalClipboardItem = (window as Window & { ClipboardItem?: unknown }).ClipboardItem;
        const write = vi.fn(async () => undefined);
        const ClipboardItemStub = vi.fn(function ClipboardItem(this: any, items: Record<string, Blob>) {
            this.items = items;
        });
        (ClipboardItemStub as any).supports = vi.fn(() => true);
        Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { write } });
        Object.defineProperty(window, 'ClipboardItem', { configurable: true, value: ClipboardItemStub });
        const nativeCopy = installNativeCopyCommand();
        const controller = createController();
        try {
            controller.setRichCopyFormulaFormat('latex-brackets');
            controller.init();
            document.dispatchEvent(new Event('selectionchange'));
            await flushSelectionFrame();

            const host = document.querySelector('.aimd-toolbar-hover-action-host') as HTMLElement | null;
            const markdownButton = host?.shadowRoot?.querySelector<HTMLButtonElement>('[data-action="copy-markdown-selection"]');
            const richButton = host?.shadowRoot?.querySelector<HTMLButtonElement>('[data-action="copy-rich-selection"]');
            expect(markdownButton).toBeNull();
            expect(richButton?.disabled).toBe(false);
            expect(richButton?.textContent).toBe('Copy with formatting');
            richButton?.click();
            await flushMicrotasks();

            expect(nativeCopy.execCommand).not.toHaveBeenCalled();
            expect(write).toHaveBeenCalledTimes(1);
            const item = (ClipboardItemStub as any).mock.instances[0];
            expect(await readBlob(item.items['text/plain'])).toBe('$$\n\\frac{x}{y}\n$$');
            expect(await readBlob(item.items['text/html'])).toContain('<div>\\[<br>\\frac{x}{y}<br>\\]</div>');
            expect(await readBlob(item.items['text/html'])).not.toContain('<math');
            expect(await readBlob(item.items['text/html'])).not.toContain('<m:oMath');
        } finally {
            controller.dispose();
            Object.defineProperty(navigator, 'clipboard', { configurable: true, value: originalClipboard });
            Object.defineProperty(window, 'ClipboardItem', { configurable: true, value: originalClipboardItem });
        }
    });

    it('discards a rich payload that finishes after the native selection changes', async () => {
        const message = mountMessage('<p><code>first</code> and <code>second</code></p>');
        const [first, second] = Array.from(message.querySelectorAll<HTMLElement>('code'));
        const firstRange = document.createRange();
        firstRange.selectNodeContents(first);
        selectRange(firstRange);

        const originalClipboard = navigator.clipboard;
        const originalClipboardItem = (window as Window & { ClipboardItem?: unknown }).ClipboardItem;
        const write = vi.fn(async () => undefined);
        const ClipboardItemStub = vi.fn(function ClipboardItem(this: any, items: Record<string, Blob>) {
            this.items = items;
        });
        (ClipboardItemStub as any).supports = vi.fn(() => true);
        Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { write } });
        Object.defineProperty(window, 'ClipboardItem', { configurable: true, value: ClipboardItemStub });

        let finishBuilding: ((payload: { html: string; plainText: string }) => void) | undefined;
        const buildRichPayload = vi.fn(() => new Promise<{ html: string; plainText: string }>((resolve) => {
            finishBuilding = resolve;
        }));
        const controller = new ChatGPTAtomicSelectionController(
            new ChatGPTAdapter(),
            buildRichPayload,
        );
        try {
            controller.init();
            document.dispatchEvent(new Event('selectionchange'));
            await flushSelectionFrame();

            document.querySelector('.aimd-toolbar-hover-action-host')
                ?.shadowRoot
                ?.querySelector<HTMLButtonElement>('[data-action="copy-rich-selection"]')
                ?.click();

            const secondRange = document.createRange();
            secondRange.selectNodeContents(second);
            selectRange(secondRange);
            document.dispatchEvent(new Event('selectionchange'));
            await flushSelectionFrame();

            finishBuilding?.({
                html: '<p><code>first</code></p>',
                plainText: '`first`',
            });
            await flushMicrotasks();

            expect(buildRichPayload).toHaveBeenCalledTimes(1);
            expect(write).not.toHaveBeenCalled();
        } finally {
            controller.dispose();
            Object.defineProperty(navigator, 'clipboard', { configurable: true, value: originalClipboard });
            Object.defineProperty(window, 'ClipboardItem', { configurable: true, value: originalClipboardItem });
        }
    });

    it('uses the newest selection when the action is clicked', async () => {
        const message = mountMessage(`
            <span class="katex" data-latex="x^2">x²</span>
            <p><code>answer</code></p>
        `);
        const formula = message.querySelector<HTMLElement>('.katex')!;
        const code = message.querySelector<HTMLElement>('code')!;
        const formulaRange = document.createRange();
        formulaRange.selectNodeContents(formula);
        selectRange(formulaRange);

        const originalClipboard = navigator.clipboard;
        const originalClipboardItem = (window as Window & { ClipboardItem?: unknown }).ClipboardItem;
        const write = vi.fn(async () => undefined);
        const ClipboardItemStub = vi.fn(function ClipboardItem(this: any, items: Record<string, Blob>) {
            this.items = items;
        });
        (ClipboardItemStub as any).supports = vi.fn(() => true);
        Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { write } });
        Object.defineProperty(window, 'ClipboardItem', { configurable: true, value: ClipboardItemStub });
        const controller = createController();
        controller.init();
        document.dispatchEvent(new Event('selectionchange'));
        await flushSelectionFrame();

        const codeRange = document.createRange();
        codeRange.selectNodeContents(code);
        selectRange(codeRange);
        document.dispatchEvent(new Event('selectionchange'));
        await flushSelectionFrame();

        const host = document.querySelector('.aimd-toolbar-hover-action-host') as HTMLElement | null;
        expect(host?.shadowRoot?.querySelector<HTMLButtonElement>('[data-action="copy-markdown-selection"]')).toBeNull();
        expect(host?.shadowRoot?.querySelector<HTMLButtonElement>('[data-action="copy-rich-selection"]')?.disabled).toBe(false);
        host?.shadowRoot?.querySelector<HTMLButtonElement>('[data-action="copy-rich-selection"]')?.click();
        await flushMicrotasks();
        const item = (ClipboardItemStub as any).mock.instances[0];
        expect(await readBlob(item.items['text/plain'])).toBe('`answer`');
        expect(await readBlob(item.items['text/html'])).toContain('<code>answer</code>');
        expect(await readBlob(item.items['text/html'])).not.toContain('x^2');
        controller.dispose();
        Object.defineProperty(navigator, 'clipboard', { configurable: true, value: originalClipboard });
        Object.defineProperty(window, 'ClipboardItem', { configurable: true, value: originalClipboardItem });
    });
});
