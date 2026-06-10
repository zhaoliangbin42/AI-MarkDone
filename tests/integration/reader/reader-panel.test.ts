import { afterEach, describe, expect, it, vi } from 'vitest';
import { ReaderPanel } from '@/ui/content/reader/ReaderPanel';
import { DEFAULT_SETTINGS } from '@/core/settings/types';

function setClipboardMock() {
    const writeText = vi.fn(async () => undefined);
    Object.defineProperty(navigator, 'clipboard', {
        value: { writeText },
        configurable: true,
    });
    return { writeText };
}

function createSelection(range: Range): Selection {
    return {
        rangeCount: 1,
        getRangeAt: () => range,
        toString: () => range.toString(),
    } as unknown as Selection;
}

function attachSelectionRangeLayout(range: Range): Range {
    Object.assign(range, {
        getClientRects: () => ([
            { left: 40, top: 40, width: 64, height: 20, right: 104, bottom: 60, x: 40, y: 40, toJSON: () => ({}) },
        ]),
        cloneRange: () => {
            const clone = document.createRange();
            clone.setStart(range.startContainer, range.startOffset);
            clone.setEnd(range.endContainer, range.endOffset);
            return attachSelectionRangeLayout(clone);
        },
    });
    return range;
}

function installSelectionLayout(range: Range, markdownRoot: HTMLElement): void {
    attachSelectionRangeLayout(range);
    Object.assign(markdownRoot, {
        getBoundingClientRect: () => ({
            left: 0, top: 0, width: 840, height: 320, right: 840, bottom: 320, x: 0, y: 0, toJSON: () => ({}),
        }),
    });
}

async function waitFor<T>(
    read: () => T | null,
    timeoutMs: number = 200,
): Promise<T> {
    const startedAt = Date.now();
    while (Date.now() - startedAt < timeoutMs) {
        const value = read();
        if (value) return value;
        await Promise.resolve();
        await new Promise((resolve) => setTimeout(resolve, 0));
    }
    throw new Error('Timed out waiting for reader code block enhancement');
}

describe('ReaderPanel (MVP)', () => {
    afterEach(() => {
        document.querySelector('#aimd-reader-panel-host')?.remove();
        document.getElementById('aimd-toast-viewport')?.remove();
    });

    it('shows, paginates, and copies current page markdown', async () => {
        const { writeText } = setClipboardMock();

        const panel = new ReaderPanel();
        await panel.show(
            [
                { id: 'a', userPrompt: 'Q1', content: 'md1' },
                { id: 'b', userPrompt: 'Q2', content: 'md2' },
            ],
            0,
            'light'
        );

        const host = document.querySelector('#aimd-reader-panel-host') as HTMLElement;
        expect(host).toBeTruthy();
        const shadow = (host as any).shadowRoot as ShadowRoot;
        expect(shadow).toBeTruthy();

        const copyBtn = shadow.querySelector<HTMLButtonElement>('[data-action="reader-copy"]');
        expect(copyBtn).toBeTruthy();
        copyBtn!.click();
        await Promise.resolve();
        await Promise.resolve();
        expect(writeText).toHaveBeenCalledWith('md1');
        const toast = await waitFor(() => document.body.querySelector<HTMLElement>('.aimd-toast'));
        expect(toast.textContent).toContain('btnCopied');
        expect(shadow.querySelector('.aimd-tooltip[data-variant="ephemeral"]')).toBeNull();

        const nextBtn = shadow.querySelector<HTMLButtonElement>('[data-action="reader-next"]')!;
        nextBtn.click();
        await Promise.resolve();
        await new Promise((resolve) => setTimeout(resolve, 0));

        const nextCopyBtn = shadow.querySelector<HTMLButtonElement>('[data-action="reader-copy"]');
        nextCopyBtn!.click();
        await Promise.resolve();
        await Promise.resolve();
        expect(writeText).toHaveBeenCalledWith('md2');

        panel.hide();
        shadow.querySelector<HTMLElement>('.panel-window--reader')?.dispatchEvent(new Event('animationend', { bubbles: true }));
        expect(document.querySelector('#aimd-reader-panel-host')).toBeNull();
    });

    it('toggles between standard and fullscreen reader layouts', async () => {
        const panel = new ReaderPanel();
        panel.setReaderSettings({
            ...DEFAULT_SETTINGS.reader,
            defaultOpenMode: 'panel',
        });
        await panel.show([{ id: 'a', userPrompt: 'Q1', content: 'md1' }], 0, 'light');

        const host = document.querySelector('#aimd-reader-panel-host') as HTMLElement;
        const shadow = (host as any).shadowRoot as ShadowRoot;
        const panelEl = shadow.querySelector<HTMLElement>('.panel-window--reader')!;
        const fullscreenBtn = shadow.querySelector<HTMLButtonElement>('[data-action="reader-fullscreen"]')!;

        expect(panelEl.dataset.fullscreen).toBe('0');
        expect(fullscreenBtn.getAttribute('aria-label') || fullscreenBtn.getAttribute('title')).toBeTruthy();
        const styles = Array.from(shadow.querySelectorAll('style')).map((node) => node.textContent || '').join('\n');
        expect(styles).toContain('.panel-window--reader');

        fullscreenBtn.click();
        expect(shadow.querySelector<HTMLElement>('.panel-window--reader')?.dataset.fullscreen).toBe('1');

        shadow.querySelector<HTMLButtonElement>('[data-action="reader-fullscreen"]')!.click();
        expect(shadow.querySelector<HTMLElement>('.panel-window--reader')?.dataset.fullscreen).toBe('0');

        panel.hide();
    });

    it('enhances fenced code blocks with language chrome, internal scrolling, and code-only copy', async () => {
        const { writeText } = setClipboardMock();
        const panel = new ReaderPanel();

        await panel.show(
            [{
                id: 'a',
                userPrompt: 'Q1',
                content: '```ts\nconst answer = 42;\nconsole.log(answer);\n```',
            }],
            0,
            'light'
        );
        const host = document.querySelector('#aimd-reader-panel-host') as HTMLElement;
        const shadow = (host as any).shadowRoot as ShadowRoot;
        const markdownRoot = await waitFor(() => shadow.querySelector<HTMLElement>('.reader-markdown'));
        const codeBlock = await waitFor(() => markdownRoot.querySelector<HTMLElement>('.reader-code-block'));
        const language = markdownRoot.querySelector<HTMLElement>('.reader-code-block__language');
        const copyBtn = markdownRoot.querySelector<HTMLButtonElement>('[data-action="reader-copy-code"]');
        const scroll = markdownRoot.querySelector<HTMLElement>('.reader-code-block__scroll');

        expect(codeBlock).toBeTruthy();
        expect(language?.textContent).toBe('TS');
        expect(copyBtn).toBeTruthy();
        expect(scroll).toBeTruthy();

        copyBtn!.click();
        await Promise.resolve();
        await Promise.resolve();

        expect(writeText).toHaveBeenCalledWith('const answer = 42;\nconsole.log(answer);');
    });

    it('keeps code block chrome even when syntax highlighting is disabled', async () => {
        const panel = new ReaderPanel();
        panel.setRenderCodeInReader(false);

        await panel.show(
            [{
                id: 'a',
                userPrompt: 'Q1',
                content: '```\nplain text\n```',
            }],
            0,
            'light'
        );
        const host = document.querySelector('#aimd-reader-panel-host') as HTMLElement;
        const shadow = (host as any).shadowRoot as ShadowRoot;
        const markdownRoot = await waitFor(() => shadow.querySelector<HTMLElement>('.reader-markdown'));
        await waitFor(() => markdownRoot.querySelector<HTMLElement>('.reader-code-block'));

        expect(markdownRoot.querySelector('.reader-code-block')).toBeTruthy();
        expect(markdownRoot.querySelector('.reader-code-block__language')).toBeFalsy();
        expect(markdownRoot.querySelector('.reader-code-block code.hljs')).toBeFalsy();
    });

    it('renders dollar-delimited math and structural markdown blocks through the reader surface', async () => {
        const panel = new ReaderPanel();

        await panel.show(
            [{
                id: 'a',
                userPrompt: 'Q1',
                content: [
                    'Inline $x+y$ math.',
                    '',
                    '$$',
                    'a^2 + b^2 = c^2',
                    '$$',
                    '',
                    '## Heading',
                    '',
                    '- First item',
                    '- Second item',
                    '',
                    '> Quoted note',
                    '',
                    '---',
                ].join('\n'),
            }],
            0,
            'light'
        );

        const host = document.querySelector('#aimd-reader-panel-host') as HTMLElement;
        const shadow = (host as any).shadowRoot as ShadowRoot;
        const markdownRoot = await waitFor(() => shadow.querySelector<HTMLElement>('.reader-markdown'));

        expect(markdownRoot.querySelector('.katex')).toBeTruthy();
        expect(markdownRoot.querySelector('.katex-display')).toBeTruthy();
        expect(markdownRoot.querySelector('h2')?.textContent).toBe('Heading');
        expect(Array.from(markdownRoot.querySelectorAll('li')).map((node) => node.textContent)).toEqual(['First item', 'Second item']);
        expect(markdownRoot.querySelector('blockquote')?.textContent).toContain('Quoted note');
        expect(markdownRoot.querySelector('hr')).toBeTruthy();
    });

    it('shows a heading outline rail that jumps within the current reader page', async () => {
        const { writeText } = setClipboardMock();
        const scrollTo = vi.fn();
        Object.defineProperty(HTMLElement.prototype, 'scrollTo', {
            value: scrollTo,
            configurable: true,
        });
        const panel = new ReaderPanel();

        await panel.show(
            [
                {
                    id: 'a',
                    userPrompt: 'Q1',
                    content: '# Overview\n\nIntro\n\n## Details\n\nMore detail',
                },
                {
                    id: 'b',
                    userPrompt: 'Q2',
                    content: '# Other\n\n## Tail',
                },
            ],
            0,
            'light'
        );

        const host = document.querySelector('#aimd-reader-panel-host') as HTMLElement;
        const shadow = host.shadowRoot as ShadowRoot;
        const outlineItems = Array.from(shadow.querySelectorAll<HTMLButtonElement>('.reader-outline-rail__item'));

        expect(outlineItems).toHaveLength(2);
        outlineItems[1]?.click();
        await Promise.resolve();

        expect(scrollTo).toHaveBeenCalled();
        expect(shadow.querySelector<HTMLElement>('.reader-header-page')?.textContent).toBe('1/2');
        shadow.querySelector<HTMLButtonElement>('[data-action="reader-copy"]')?.click();
        await Promise.resolve();
        await Promise.resolve();
        expect(writeText).toHaveBeenCalledWith('# Overview\n\nIntro\n\n## Details\n\nMore detail');

        panel.hide();
    });

    it('keeps the code copy button right-aligned even when a code block has no language label', async () => {
        const panel = new ReaderPanel();

        await panel.show(
            [{
                id: 'a',
                userPrompt: 'Q1',
                content: '```\nplain text\n```',
            }],
            0,
            'light'
        );

        const host = document.querySelector('#aimd-reader-panel-host') as HTMLElement;
        const shadow = (host as any).shadowRoot as ShadowRoot;
        const styles = Array.from(shadow.querySelectorAll('style')).map((node) => node.textContent || '').join('\n');

        expect(styles).toContain('.reader-code-block__copy');
        expect(styles).toContain('margin-left: auto;');
    });

    it('intercepts copy inside the reader and writes markdown source for selected atomic units', async () => {
        setClipboardMock();
        const panel = new ReaderPanel();

        await panel.show(
            [{
                id: 'a',
                userPrompt: 'Q1',
                content: 'Before `code` and $x+y$ after',
            }],
            0,
            'light'
        );

        const host = document.querySelector('#aimd-reader-panel-host') as HTMLElement;
        const shadow = host.shadowRoot as ShadowRoot;
        const markdownRoot = await waitFor(() => shadow.querySelector<HTMLElement>('.reader-markdown'));
        const paragraph = markdownRoot.querySelector('p')!;
        const firstText = paragraph.firstChild as Text;
        const lastText = paragraph.lastChild as Text;
        const range = document.createRange();
        range.setStart(firstText, 0);
        range.setEnd(lastText, lastText.textContent!.length);

        const selection = {
            rangeCount: 1,
            getRangeAt: () => range,
            getComposedRanges: () => [{
                startContainer: firstText,
                startOffset: 0,
                endContainer: lastText,
                endOffset: lastText.textContent!.length,
            }],
            toString: () => range.toString(),
        } as unknown as Selection;

        const getSelectionSpy = vi.spyOn(window, 'getSelection').mockReturnValue(selection);
        document.dispatchEvent(new Event('selectionchange'));
        await Promise.resolve();

        const clipboardData = {
            values: new Map<string, string>(),
            setData(type: string, value: string) {
                this.values.set(type, value);
            },
        };
        const copyEvent = new Event('copy', { bubbles: true, cancelable: true }) as ClipboardEvent;
        Object.defineProperty(copyEvent, 'clipboardData', { value: clipboardData });
        shadow.dispatchEvent(copyEvent);

        expect(clipboardData.values.get('text/plain')).toContain('`code`');
        expect(clipboardData.values.get('text/plain')).toContain('$x+y$');
        getSelectionSpy.mockRestore();
    });

    it('uses the exact text selected inside a fenced code block for copy, comment, and sticky actions', async () => {
        const { writeText } = setClipboardMock();
        const panel = new ReaderPanel();

        await panel.show(
            [{
                id: 'a',
                userPrompt: 'Q1',
                content: '```ts\nconst answer = 42;\nconsole.log(answer);\n```',
            }],
            0,
            'light'
        );

        const host = document.querySelector('#aimd-reader-panel-host') as HTMLElement;
        const shadow = host.shadowRoot as ShadowRoot;
        const markdownRoot = await waitFor(() => shadow.querySelector<HTMLElement>('.reader-markdown'));
        await waitFor(() => markdownRoot.querySelector<HTMLElement>('.reader-code-block'));

        const walker = document.createTreeWalker(markdownRoot, NodeFilter.SHOW_TEXT);
        let answerNode: Text | null = null;
        while (walker.nextNode()) {
            const node = walker.currentNode as Text;
            if (node.data.includes('answer')) {
                answerNode = node;
                break;
            }
        }
        expect(answerNode).toBeTruthy();

        const start = answerNode!.data.indexOf('answer');
        const range = document.createRange();
        range.setStart(answerNode!, start);
        range.setEnd(answerNode!, start + 'answer'.length);
        installSelectionLayout(range, markdownRoot);

        const getSelectionSpy = vi.spyOn(window, 'getSelection').mockReturnValue(createSelection(range));
        document.dispatchEvent(new Event('selectionchange'));
        await Promise.resolve();

        shadow.querySelector<HTMLButtonElement>('[data-action="reader-selection-copy"]')!.click();
        await Promise.resolve();
        expect(writeText).toHaveBeenLastCalledWith('answer');

        shadow.querySelector<HTMLButtonElement>('[data-action="reader-comment-add"]')!.click();
        await Promise.resolve();
        expect(shadow.querySelector<HTMLElement>('.reader-comment-popover__selection-value')?.textContent).toBe('answer');
        shadow.querySelector<HTMLButtonElement>('.reader-comment-popover [data-action="cancel"]')!.click();
        await Promise.resolve();

        document.dispatchEvent(new Event('selectionchange'));
        await Promise.resolve();
        shadow.querySelector<HTMLButtonElement>('[data-action="reader-selection-stick"]')!.click();
        await Promise.resolve();

        const stickyBlock = shadow.querySelector<HTMLElement>('.reader-sticky-block')!;
        expect(stickyBlock.textContent).toContain('answer');
        expect(stickyBlock.textContent).not.toContain('console.log');
        expect(stickyBlock.querySelector('pre')).toBeNull();

        getSelectionSpy.mockRestore();
    });

    it('does not close when text selection starts inside the reader and releases on the backdrop', async () => {
        const panel = new ReaderPanel();
        await panel.show([{ id: 'a', userPrompt: 'Q1', content: 'Reader body' }], 0, 'light');

        const host = document.querySelector('#aimd-reader-panel-host') as HTMLElement;
        const shadow = host.shadowRoot as ShadowRoot;
        const reader = shadow.querySelector<HTMLElement>('.panel-window--reader')!;
        const backdrop = shadow.querySelector<HTMLElement>('[data-role="overlay-backdrop-root"] .panel-stage__overlay')!;

        reader.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, composed: true }));
        backdrop.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true }));

        expect(document.querySelector('#aimd-reader-panel-host')).toBeTruthy();
        expect(reader.dataset.motionState).not.toBe('closing');

        backdrop.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, composed: true }));
        backdrop.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true }));

        expect(reader.dataset.motionState).toBe('closing');
    });
});
