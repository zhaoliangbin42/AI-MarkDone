import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { clearReaderCommentScope } from '@/services/reader/commentSession';
import { ReaderPanel } from '@/ui/content/reader/ReaderPanel';

const scopeId = 'reader-panel-comments-v1';

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
        getComposedRanges: () => [{
            startContainer: range.startContainer,
            startOffset: range.startOffset,
            endContainer: range.endContainer,
            endOffset: range.endOffset,
        }],
        toString: () => range.toString(),
    } as unknown as Selection;
}

function installLayoutMocks(range: Range, markdownRoot: HTMLElement, unitElements: HTMLElement[]): void {
    Object.assign(range, {
        getClientRects: () => ([
            { left: 10, top: 10, width: 52, height: 18, right: 62, bottom: 28, x: 10, y: 10, toJSON: () => ({}) },
            { left: 64, top: 10, width: 34, height: 18, right: 98, bottom: 28, x: 64, y: 10, toJSON: () => ({}) },
            { left: 100, top: 10, width: 58, height: 18, right: 158, bottom: 28, x: 100, y: 10, toJSON: () => ({}) },
        ]),
    });
    Object.assign(markdownRoot, {
        getBoundingClientRect: () => ({
            left: 0, top: 0, width: 840, height: 320, right: 840, bottom: 320, x: 0, y: 0, toJSON: () => ({}),
        }),
    });
    unitElements.forEach((element, index) => {
        Object.assign(element, {
            getBoundingClientRect: () => ({
                left: index === 0 ? 64 : 100,
                top: 10,
                width: index === 0 ? 34 : 28,
                height: 18,
                right: index === 0 ? 98 : 128,
                bottom: 28,
                x: index === 0 ? 64 : 100,
                y: 10,
                toJSON: () => ({}),
            }),
        });
    });
}

describe('ReaderPanel comments', () => {
    beforeEach(() => {
        clearReaderCommentScope(scopeId);
    });

    afterEach(() => {
        clearReaderCommentScope(scopeId);
        document.querySelector('#aimd-reader-panel-host')?.remove();
    });

    it('creates a comment, renders highlight + anchor, and restores it after reopening the reader', async () => {
        const panel = new ReaderPanel();

        await panel.show(
            [{ id: 'a', userPrompt: 'Q1', content: 'Before `code` and $x+y$ after' }],
            0,
            'light',
        );

        const host = document.querySelector('#aimd-reader-panel-host') as HTMLElement;
        const shadow = host.shadowRoot as ShadowRoot;
        const markdownRoot = shadow.querySelector<HTMLElement>('.reader-markdown')!;
        const paragraph = markdownRoot.querySelector('p')!;
        const firstText = paragraph.firstChild as Text;
        const lastText = paragraph.lastChild as Text;
        const range = document.createRange();
        range.setStart(firstText, 0);
        range.setEnd(lastText, lastText.textContent!.length);
        installLayoutMocks(range, markdownRoot, Array.from(markdownRoot.querySelectorAll<HTMLElement>('[data-aimd-unit-id]')));

        const getSelectionSpy = vi.spyOn(window, 'getSelection').mockReturnValue(createSelection(range));
        document.dispatchEvent(new Event('selectionchange'));
        await Promise.resolve();

        const commentAction = shadow.querySelector<HTMLButtonElement>('.reader-comment-action');
        expect(commentAction).toBeTruthy();
        commentAction!.click();
        await Promise.resolve();

        const textarea = shadow.querySelector<HTMLTextAreaElement>('.reader-comment-popover__input');
        expect(textarea).toBeTruthy();
        textarea!.value = 'Needs clarification';
        textarea!.dispatchEvent(new Event('input', { bubbles: true }));

        shadow.querySelector<HTMLButtonElement>('.reader-comment-popover [data-action="save"]')!.click();
        await Promise.resolve();

        expect(shadow.querySelectorAll('.reader-comment-highlight').length).toBeGreaterThan(0);
        expect(shadow.querySelectorAll('.reader-comment-anchor').length).toBe(1);

        panel.hide();
        shadow.querySelector<HTMLElement>('.panel-window--reader')?.dispatchEvent(new Event('animationend', { bubbles: true }));
        await panel.show(
            [{ id: 'a', userPrompt: 'Q1', content: 'Before `code` and $x+y$ after' }],
            0,
            'light',
        );
        const nextHost = document.querySelector('#aimd-reader-panel-host') as HTMLElement;
        const nextShadow = nextHost.shadowRoot as ShadowRoot;
        const nextMarkdownRoot = nextShadow.querySelector<HTMLElement>('.reader-markdown')!;
        installLayoutMocks(document.createRange(), nextMarkdownRoot, Array.from(nextMarkdownRoot.querySelectorAll<HTMLElement>('[data-aimd-unit-id]')));
        (panel as any).syncCommentUi();

        expect(nextShadow.querySelectorAll('.reader-comment-highlight').length).toBeGreaterThan(0);
        expect(nextShadow.querySelectorAll('.reader-comment-anchor').length).toBe(1);
        getSelectionSpy.mockRestore();
    });

    it('copies compiled comments from source markdown with the configurable prompts', async () => {
        const { writeText } = setClipboardMock();
        const panel = new ReaderPanel();

        await panel.show(
            [{ id: 'a', userPrompt: 'Q1', content: 'Before `code` and $x+y$ after' }],
            0,
            'light',
        );

        const host = document.querySelector('#aimd-reader-panel-host') as HTMLElement;
        const shadow = host.shadowRoot as ShadowRoot;
        const markdownRoot = shadow.querySelector<HTMLElement>('.reader-markdown')!;
        const paragraph = markdownRoot.querySelector('p')!;
        const firstText = paragraph.firstChild as Text;
        const lastText = paragraph.lastChild as Text;
        const range = document.createRange();
        range.setStart(firstText, 0);
        range.setEnd(lastText, lastText.textContent!.length);
        installLayoutMocks(range, markdownRoot, Array.from(markdownRoot.querySelectorAll<HTMLElement>('[data-aimd-unit-id]')));

        const getSelectionSpy = vi.spyOn(window, 'getSelection').mockReturnValue(createSelection(range));
        document.dispatchEvent(new Event('selectionchange'));
        await Promise.resolve();

        shadow.querySelector<HTMLButtonElement>('.reader-comment-action')!.click();
        await Promise.resolve();
        const textarea = shadow.querySelector<HTMLTextAreaElement>('.reader-comment-popover__input')!;
        textarea.value = 'Needs clarification';
        textarea.dispatchEvent(new Event('input', { bubbles: true }));
        shadow.querySelector<HTMLButtonElement>('.reader-comment-popover [data-action="save"]')!.click();
        await Promise.resolve();

        shadow.querySelector<HTMLButtonElement>('[data-action="reader-copy-comments"]')!.click();
        await Promise.resolve();

        const exportRoot = shadow.querySelector<HTMLElement>('.reader-comment-export');
        expect(exportRoot).toBeTruthy();
        const prompt1 = exportRoot!.querySelector<HTMLInputElement>('[data-role="prompt1"]')!;
        const prompt2 = exportRoot!.querySelector<HTMLInputElement>('[data-role="prompt2"]')!;
        const prompt3 = exportRoot!.querySelector<HTMLInputElement>('[data-role="prompt3"]')!;
        prompt1.value = 'Regarding ';
        prompt2.value = ', my comment is: ';
        prompt3.value = '.';
        prompt1.dispatchEvent(new Event('input', { bubbles: true }));
        prompt2.dispatchEvent(new Event('input', { bubbles: true }));
        prompt3.dispatchEvent(new Event('input', { bubbles: true }));
        await Promise.resolve();

        exportRoot.querySelector<HTMLButtonElement>('[data-action="copy"]')!.click();
        await Promise.resolve();
        await Promise.resolve();

        expect(writeText).toHaveBeenCalledWith(
            expect.stringContaining('1. Regarding Before `code` and $x+y$ after, my comment is: Needs clarification.'),
        );
        getSelectionSpy.mockRestore();
    });
});
