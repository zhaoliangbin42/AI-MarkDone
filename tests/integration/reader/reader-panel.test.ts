import { afterEach, describe, expect, it, vi } from 'vitest';
import { ReaderPanel } from '@/ui/content/reader/ReaderPanel';

function setClipboardMock() {
    const writeText = vi.fn(async () => undefined);
    Object.defineProperty(navigator, 'clipboard', {
        value: { writeText },
        configurable: true,
    });
    return { writeText };
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
        document.querySelector('#aimd-source-panel-host')?.remove();
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
});
