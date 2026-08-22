import { afterEach, describe, expect, it, vi } from 'vitest';

import { ChatGPTAdapter } from '@/drivers/content/adapters/sites/chatgpt';
import type { ConversationContentSourceV1 } from '@/contracts/conversationContent';
import type { ConversationMaterializationPortV1 } from '@/contracts/conversationMaterialization';
import { setCanonicalMarkdownCopyFormulaFormat } from '@/services/copy/canonicalMarkdownCopy';
import { ChatGPTAtomicSelectionController } from '@/ui/content/controllers/ChatGPTAtomicSelectionController';

const originalExecCommand = document.execCommand;

function createController(adapter = new ChatGPTAdapter()): ChatGPTAtomicSelectionController {
    return new ChatGPTAtomicSelectionController(adapter);
}

function createCanonicalSelectionController(
    message: HTMLElement,
    options: Readonly<{
        markdown?: string;
        authority?: 'primary' | 'host-rendered' | 'reconstructed';
    }> = {},
): ChatGPTAtomicSelectionController {
    const documentKey = 'chatgpt:conversation:conversation-1';
    const contentToken = 'conversation-content-v1:test';
    const target = {
        documentKey,
        turnId: 'turn-1',
        userMessageId: 'user-1',
        assistantMessageId: 'assistant-1',
    } as const;
    const state = {
        kind: 'ready',
        document: {
            key: documentKey,
            platformId: 'chatgpt',
            conversationId: 'conversation-1',
        },
        snapshot: {
            schemaVersion: 1,
            document: {
                key: documentKey,
                platformId: 'chatgpt',
                conversationId: 'conversation-1',
            },
            contentToken,
            coverage: 'complete',
            turns: [{
                key: 'turn-1:assistant-1',
                ordinal: 1,
                identity: {
                    turnId: 'turn-1',
                    userMessageId: 'user-1',
                    assistantMessageId: 'assistant-1',
                },
                userText: 'Question',
                assistantMarkdown: options.markdown ?? 'Before **clean Markdown** after.',
                assistantProvenance: {
                    authority: options.authority ?? 'primary',
                    fidelity: options.authority === 'reconstructed'
                        ? 'lossy'
                        : options.authority === 'host-rendered'
                            ? 'normalized'
                            : 'exact',
                    producer: options.authority === 'reconstructed'
                        ? 'test-dom'
                        : options.authority === 'host-rendered'
                            ? 'rendered-content-v2'
                            : 'test-provider',
                },
            }],
        },
    } as const;
    const source: ConversationContentSourceV1 = {
        read: () => state,
        subscribe: (listener) => {
            listener(state);
            return () => undefined;
        },
        refresh: async () => state,
        isCurrent: (candidate) => candidate === contentToken,
    };
    const materialization: ConversationMaterializationPortV1 = {
        read: () => ({
            materializationToken: 'materialization-1',
            contentToken,
            entries: [{ target, anchorElement: message }],
        }),
        subscribe: (listener) => {
            listener(materialization.read());
            return () => undefined;
        },
        resolveElement: () => target,
        locate: async () => 'located',
    };
    return new ChatGPTAtomicSelectionController(new ChatGPTAdapter(), {
        contentSource: source,
        materialization,
    });
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

function dispatchKeyboardCopy(shiftKey = false): KeyboardEvent {
    const event = new KeyboardEvent('keydown', {
        key: 'c',
        ctrlKey: true,
        shiftKey,
        bubbles: true,
        cancelable: true,
    });
    window.dispatchEvent(event);
    return event;
}

afterEach(() => {
    setCanonicalMarkdownCopyFormulaFormat('markdown-dollar');
    Object.defineProperty(document, 'execCommand', { configurable: true, value: originalExecCommand });
    window.getSelection()?.removeAllRanges();
    document.head.innerHTML = '';
    document.body.innerHTML = '';
});

describe('ChatGPTAtomicSelectionController', () => {
    it('does not create a selection copy action portal', async () => {
        const message = mountMessage('<p><code>answer</code></p>');
        const range = document.createRange();
        range.selectNodeContents(message.querySelector('code')!);
        selectRange(range);

        const controller = createController();
        controller.init();
        document.dispatchEvent(new Event('selectionchange'));
        await flushSelectionFrame();

        expect(document.querySelector('.aimd-toolbar-hover-action-host')).toBeNull();
        controller.dispose();
    });

    it('only intercepts Ctrl/Cmd+C after a matching keyboard intent', async () => {
        const message = mountMessage('<p><code>answer</code></p>');
        const range = document.createRange();
        range.selectNodeContents(message.querySelector('code')!);
        selectRange(range);

        const controller = createController();
        controller.setMarkdownCopyShortcut('mod-c');
        controller.init();
        const nativeCopy = dispatchCopy();
        expect(nativeCopy.event.defaultPrevented).toBe(false);

        dispatchKeyboardCopy();
        const markdownCopy = dispatchCopy();
        expect(markdownCopy.event.defaultPrevented).toBe(true);
        expect(markdownCopy.readText()).toBe('`answer`');
        controller.dispose();
    });

    it('copies the current rendered selection when Repository evidence is stale', async () => {
        const message = mountMessage('<p><code>live answer</code></p>');
        const range = document.createRange();
        range.selectNodeContents(message.querySelector('code')!);
        selectRange(range);
        const controller = createCanonicalSelectionController(message);
        const source = controller['contentSource']!;
        vi.spyOn(source, 'isCurrent').mockReturnValue(false);
        try {
            controller.setMarkdownCopyShortcut('mod-c');
            controller.init();
            document.dispatchEvent(new Event('selectionchange'));
            await flushSelectionFrame();

            dispatchKeyboardCopy();
            const copy = dispatchCopy();

            expect(copy.event.defaultPrevented).toBe(true);
            expect(copy.readText()).toBe('`live answer`');
        } finally {
            controller.dispose();
        }
    });

    it('projects an ordinary host text selection from canonical Markdown instead of cloning DOM', async () => {
        const message = mountMessage('<p>Before <strong><span>clean Markdown</span></strong> after.</p>');
        const selectedText = message.querySelector('strong span')!.firstChild as Text;
        const range = document.createRange();
        range.selectNodeContents(selectedText);
        selectRange(range);

        const controller = createCanonicalSelectionController(message);
        controller.setMarkdownCopyShortcut('mod-c');
        controller.init();
        document.dispatchEvent(new Event('selectionchange'));
        await flushSelectionFrame();

        dispatchKeyboardCopy();
        const copy = dispatchCopy();

        expect(copy.event.defaultPrevented).toBe(true);
        expect(copy.readText()).toBe('**clean Markdown**');
        controller.dispose();
    });

    it('copies an ordinary selection from sealed host-rendered canonical Markdown', async () => {
        const message = mountMessage('<p>Before <strong><span>new canonical content</span></strong> after.</p>');
        const selectedText = message.querySelector('strong span')!.firstChild as Text;
        const range = document.createRange();
        range.selectNodeContents(selectedText);
        selectRange(range);

        const controller = createCanonicalSelectionController(message, {
            markdown: 'Before **new canonical content** after.',
            authority: 'host-rendered',
        });
        try {
            controller.setMarkdownCopyShortcut('mod-c');
            controller.init();
            document.dispatchEvent(new Event('selectionchange'));
            await flushSelectionFrame();

            dispatchKeyboardCopy();
            const copy = dispatchCopy();

            expect(copy.event.defaultPrevented).toBe(true);
            expect(copy.readText()).toBe('**new canonical content**');
        } finally {
            controller.dispose();
        }
    });

    it('copies sealed host-rendered canonical Markdown with the shifted shortcut', async () => {
        const message = mountMessage('<p>Before <em>shifted canonical content</em> after.</p>');
        const selectedText = message.querySelector('em')!.firstChild as Text;
        const range = document.createRange();
        range.selectNodeContents(selectedText);
        selectRange(range);
        const originalClipboard = navigator.clipboard;
        const writeText = vi.fn(async (_text: string) => undefined);
        Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });

        const controller = createCanonicalSelectionController(message, {
            markdown: 'Before *shifted canonical content* after.',
            authority: 'host-rendered',
        });
        try {
            controller.setMarkdownCopyShortcut('mod-shift-c');
            controller.init();
            document.dispatchEvent(new Event('selectionchange'));
            await flushSelectionFrame();

            window.dispatchEvent(new KeyboardEvent('keydown', {
                key: 'c',
                ctrlKey: true,
                shiftKey: true,
                bubbles: true,
                cancelable: true,
            }));
            await Promise.resolve();

            expect(writeText).toHaveBeenCalledWith('*shifted canonical content*');
        } finally {
            controller.dispose();
            Object.defineProperty(navigator, 'clipboard', { configurable: true, value: originalClipboard });
        }
    });

    it('copies the complete canonical Markdown for a local multi-wrapper selection', async () => {
        const canonicalMarkdown = 'Before **clean Markdown** after with [a link](https://example.com) and `code`.';
        const message = mountMessage(
            '<p>Before <strong>clean Markdown</strong> after with <a href="https://example.com">a link</a> and <code>code</code>.</p>',
        );
        const paragraph = message.querySelector('p')!;
        const range = document.createRange();
        range.selectNodeContents(paragraph);
        selectRange(range);

        const controller = createCanonicalSelectionController(message, { markdown: canonicalMarkdown });
        controller.setMarkdownCopyShortcut('mod-c');
        controller.init();
        document.dispatchEvent(new Event('selectionchange'));
        await flushSelectionFrame();

        dispatchKeyboardCopy();
        const copy = dispatchCopy();

        expect(copy.event.defaultPrevented).toBe(true);
        expect(copy.readText()).toBe(canonicalMarkdown);
        controller.dispose();
    });

    it('copies canonical TeX when the rendered selection contains a visual formula', async () => {
        const message = mountMessage(
            '<p>Result <span class="katex" data-math-source="\\frac{x}{y}"><span class="katex-html">x y</span></span>.</p>',
        );
        const formula = message.querySelector('.katex-html')!;
        const range = document.createRange();
        range.selectNodeContents(formula);
        selectRange(range);

        const controller = createCanonicalSelectionController(message, {
            markdown: 'Result $\\frac{x}{y}$.',
            authority: 'host-rendered',
        });
        controller.setMarkdownCopyShortcut('mod-c');
        controller.init();
        document.dispatchEvent(new Event('selectionchange'));
        await flushSelectionFrame();

        dispatchKeyboardCopy();
        const copy = dispatchCopy();

        expect(copy.event.defaultPrevented).toBe(true);
        expect(copy.readText()).toBe('$\\frac{x}{y}$');
        controller.dispose();
    });

    it('falls back to the current DOM when cached canonical source quality is rejected', async () => {
        const message = mountMessage('<p><code>answer</code></p>');
        const range = document.createRange();
        range.selectNodeContents(message.querySelector('code')!);
        selectRange(range);

        const controller = createCanonicalSelectionController(message, {
            markdown: '`answer`',
            authority: 'reconstructed',
        });
        try {
            controller.setMarkdownCopyShortcut('mod-c');
            controller.init();
            document.dispatchEvent(new Event('selectionchange'));
            await flushSelectionFrame();

            dispatchKeyboardCopy();
            const copy = dispatchCopy();

            expect(copy.event.defaultPrevented).toBe(true);
            expect(copy.readText()).toBe('`answer`');
            expect(message.querySelector('code')?.getAttribute('data-aimd-page-atomic-state')).toBe('selected');
        } finally {
            controller.dispose();
        }
    });

    it('leaves the host copy path untouched when the shortcut is disabled', async () => {
        const message = mountMessage('<p><code>answer</code></p>');
        const range = document.createRange();
        range.selectNodeContents(message.querySelector('code')!);
        selectRange(range);

        const controller = createController();
        controller.setMarkdownCopyShortcut('none');
        controller.init();
        const copy = dispatchCopy();
        expect(copy.event.defaultPrevented).toBe(false);
        expect(copy.setData).not.toHaveBeenCalled();
        controller.dispose();
    });

    it('highlights and source-copies only a completely selected atom', async () => {
        const message = mountMessage('<p>Before <code>answer</code> after</p>');
        const code = message.querySelector('code')!;
        const text = code.firstChild as Text;
        const range = document.createRange();
        range.setStart(text, 0);
        range.setEnd(text, text.data.length);
        selectRange(range);

        const controller = createController();
        controller.setMarkdownCopyShortcut('mod-c');
        controller.init();
        document.dispatchEvent(new Event('selectionchange'));
        await flushSelectionFrame();

        expect(code.getAttribute('data-aimd-page-atomic-state')).toBe('selected');
        const hostHtml = (event: Event) => {
            (event as ClipboardEvent).clipboardData?.setData('text/html', '<p>host visual copy</p>');
        };
        document.addEventListener('copy', hostHtml, { capture: true });
        dispatchKeyboardCopy();
        const copy = dispatchCopy();
        document.removeEventListener('copy', hostHtml, { capture: true });
        expect(copy.event.defaultPrevented).toBe(true);
        expect(copy.clearData).toHaveBeenCalledTimes(1);
        expect(copy.readData('text/html')).toBeUndefined();
        expect(copy.setData).toHaveBeenCalledWith('text/plain', '`answer`');
        const selectionCss = document.getElementById('aimd-chatgpt-atomic-selection-style')?.textContent ?? '';
        expect(selectionCss).not.toContain('!important');
        expect(selectionCss).toContain('box-shadow: var(--_reader-atomic-selection-effect);');
        expect(selectionCss).not.toContain('outline:');

        controller.dispose();
        expect(code.hasAttribute('data-aimd-page-atomic-state')).toBe(false);
    });

    it('uses the Reader unit range for formulas and structural blocks on the official page', async () => {
        const message = mountMessage('<h2>Heading</h2><p>Result <span class="katex"><span class="katex-html">x+y</span></span></p>');
        const controller = createController();
        controller.init();

        const heading = message.querySelector('h2')!;
        const headingRange = document.createRange();
        headingRange.selectNodeContents(heading);
        selectRange(headingRange);
        document.dispatchEvent(new Event('selectionchange'));
        await flushSelectionFrame();
        expect(heading.getAttribute('data-aimd-page-atomic-state')).toBe('selected');

        const formulaText = message.querySelector('.katex-html')!.firstChild as Text;
        const formulaRange = document.createRange();
        formulaRange.selectNodeContents(formulaText.parentElement!);
        selectRange(formulaRange);
        document.dispatchEvent(new Event('selectionchange'));
        await flushSelectionFrame();
        expect(message.querySelector('.katex')?.getAttribute('data-aimd-page-atomic-state')).toBe('selected');
        expect(heading.hasAttribute('data-aimd-page-atomic-state')).toBe(false);

        controller.dispose();
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
        controller.setMarkdownCopyShortcut('mod-c');
        controller.init();
        document.dispatchEvent(new Event('selectionchange'));
        await flushSelectionFrame();

        expect(code.hasAttribute('data-aimd-page-atomic-state')).toBe(false);
        const copy = dispatchCopy();
        expect(copy.event.defaultPrevented).toBe(false);
        expect(copy.setData).not.toHaveBeenCalled();
        controller.dispose();
    });

    it('keeps Reader atomic units when a complete atom is mixed with a partial formula', async () => {
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
        expect(code.getAttribute('data-aimd-page-atomic-state')).toBe('selected');
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
        controller.setMarkdownCopyShortcut('mod-c');
        controller.init();
        const hostCopy = (event: Event) => {
            const clipboardEvent = event as ClipboardEvent;
            clipboardEvent.clipboardData?.setData('text/plain', 'answer');
            event.preventDefault();
        };
        document.addEventListener('copy', hostCopy, { capture: true });
        const laterListener = vi.fn();
        document.addEventListener('copy', laterListener);

        dispatchKeyboardCopy();
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

        controller.setMarkdownCopyShortcut('mod-c');
        dispatchKeyboardCopy();
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

        controller.setMarkdownCopyShortcut('mod-c');
        dispatchKeyboardCopy();
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

    it('uses the current Markdown formula format for the shifted shortcut', async () => {
        const message = mountMessage('<p><span class="katex" data-latex-source="x^2"><span class="katex-html" aria-hidden="true">x²</span></span></p>');
        const formula = message.querySelector<HTMLElement>('.katex')!;
        const range = document.createRange();
        range.selectNodeContents(formula);
        selectRange(range);
        const originalClipboard = navigator.clipboard;
        const writeText = vi.fn(async (_text: string) => undefined);
        Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });

        const controller = createController();
        try {
            controller.setMarkdownCopyShortcut('mod-shift-c');
            controller.init();
            document.dispatchEvent(new Event('selectionchange'));
            await flushSelectionFrame();

            setCanonicalMarkdownCopyFormulaFormat('latex-brackets');
            window.dispatchEvent(new KeyboardEvent('keydown', {
                key: 'c',
                ctrlKey: true,
                shiftKey: true,
                bubbles: true,
                cancelable: true,
            }));
            await Promise.resolve();

            expect(writeText).toHaveBeenCalledWith('\\(x^2\\)');
        } finally {
            controller.dispose();
            Object.defineProperty(navigator, 'clipboard', { configurable: true, value: originalClipboard });
        }
    });

    it('does not intercept a shifted shortcut while an editable control is focused', async () => {
        const message = mountMessage('<p><code>answer</code></p>');
        const range = document.createRange();
        range.selectNodeContents(message.querySelector('code')!);
        selectRange(range);
        const originalClipboard = navigator.clipboard;
        const writeText = vi.fn(async (_text: string) => undefined);
        Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
        const input = document.createElement('textarea');
        document.body.appendChild(input);

        const controller = createController();
        try {
            controller.setMarkdownCopyShortcut('mod-shift-c');
            controller.init();
            input.focus();
            window.dispatchEvent(new KeyboardEvent('keydown', {
                key: 'c',
                ctrlKey: true,
                shiftKey: true,
                bubbles: true,
                cancelable: true,
            }));

            expect(writeText).not.toHaveBeenCalled();
        } finally {
            controller.dispose();
            input.remove();
            Object.defineProperty(navigator, 'clipboard', { configurable: true, value: originalClipboard });
        }
    });

    it('updates the shortcut without rebuilding a selection portal', async () => {
        const message = mountMessage(`
            <span class="katex" data-latex="x^2">x²</span>
            <p><code>answer</code></p>
        `);
        const formula = message.querySelector<HTMLElement>('.katex')!;
        const formulaRange = document.createRange();
        formulaRange.selectNodeContents(formula);
        selectRange(formulaRange);

        const controller = createController();
        controller.init();
        document.dispatchEvent(new Event('selectionchange'));
        await flushSelectionFrame();

        expect(document.querySelector('.aimd-toolbar-hover-action-host')).toBeNull();
        controller.setMarkdownCopyShortcut('mod-c');
        controller.setMarkdownCopyShortcut('none');
        expect(document.querySelector('.aimd-toolbar-hover-action-host')).toBeNull();

        controller.dispose();
    });

    it('reports shifted-shortcut failure without silently invoking native copy', async () => {
        const message = mountMessage('<p><code>answer</code></p>');
        const range = document.createRange();
        range.selectNodeContents(message.querySelector('code')!);
        selectRange(range);
        const originalClipboard = navigator.clipboard;
        const writeText = vi.fn(async () => {
            throw new DOMException('Denied', 'NotAllowedError');
        });
        Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
        const execCommand = vi.fn(() => false);
        Object.defineProperty(document, 'execCommand', { configurable: true, value: execCommand });

        const controller = createController();
        try {
            controller.setMarkdownCopyShortcut('mod-shift-c');
            controller.init();
            document.dispatchEvent(new Event('selectionchange'));
            await flushSelectionFrame();

            window.dispatchEvent(new KeyboardEvent('keydown', {
                key: 'c',
                ctrlKey: true,
                shiftKey: true,
                bubbles: true,
                cancelable: true,
            }));

            await vi.waitFor(() => {
                expect(document.querySelector('[data-aimd-role="toast-viewport"]')?.textContent)
                    .toContain('Markdown selection could not be copied');
            });
            expect(writeText).toHaveBeenCalledWith('`answer`');
            expect(execCommand).toHaveBeenCalledTimes(1);
            expect(document.querySelector('.aimd-toolbar-hover-action-host')).toBeNull();
        } finally {
            controller.dispose();
            Object.defineProperty(navigator, 'clipboard', { configurable: true, value: originalClipboard });
        }
    });

    it('does not intercept a shortcut after the selection becomes invalid', async () => {
        const message = mountMessage('<p><code>first</code> and <code>second</code></p>');
        const [first, second] = Array.from(message.querySelectorAll('code'));
        const firstRange = document.createRange();
        firstRange.selectNodeContents(first!);
        selectRange(firstRange);
        const originalClipboard = navigator.clipboard;
        const writeText = vi.fn(async (_text: string) => undefined);
        Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });

        const controller = createController();
        try {
            controller.setMarkdownCopyShortcut('mod-shift-c');
            controller.init();
            document.dispatchEvent(new Event('selectionchange'));
            await flushSelectionFrame();

            window.getSelection()!.removeAllRanges();
            window.dispatchEvent(new KeyboardEvent('keydown', {
                key: 'c',
                ctrlKey: true,
                shiftKey: true,
                bubbles: true,
                cancelable: true,
            }));

            expect(writeText).not.toHaveBeenCalled();
            expect(document.querySelector('.aimd-toolbar-hover-action-host')).toBeNull();
        } finally {
            controller.dispose();
            Object.defineProperty(navigator, 'clipboard', { configurable: true, value: originalClipboard });
        }
    });
});
