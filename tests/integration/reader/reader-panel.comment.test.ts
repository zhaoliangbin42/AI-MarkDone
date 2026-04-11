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

        const commentActions = shadow.querySelectorAll<HTMLButtonElement>('.reader-comment-action__button');
        expect(commentActions).toHaveLength(2);
        commentActions[1]!.click();
        await Promise.resolve();

        expect(shadow.querySelector<HTMLElement>('.reader-comment-popover__selection-value')?.textContent).toContain('Before `code` and $x+y$ after');
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

        shadow.querySelectorAll<HTMLButtonElement>('.reader-comment-action__button')[1]!.click();
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
        const prompt1 = exportRoot!.querySelector<HTMLTextAreaElement>('[data-role="prompt1"]')!;
        const prompt2 = exportRoot!.querySelector<HTMLTextAreaElement>('[data-role="prompt2"]')!;
        const prompt3 = exportRoot!.querySelector<HTMLTextAreaElement>('[data-role="prompt3"]')!;
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

    it('stacks gutter anchors without numeric badges when comments share the same line region', async () => {
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
        for (const text of ['First note', 'Second note']) {
            document.dispatchEvent(new Event('selectionchange'));
            await Promise.resolve();
            const actionButtons = shadow.querySelectorAll<HTMLButtonElement>('.reader-comment-action__button');
            expect(actionButtons).toHaveLength(2);
            actionButtons[1]!.click();
            await Promise.resolve();
            const textarea = shadow.querySelector<HTMLTextAreaElement>('.reader-comment-popover__input')!;
            textarea.value = text;
            textarea.dispatchEvent(new Event('input', { bubbles: true }));
            shadow.querySelector<HTMLButtonElement>('.reader-comment-popover [data-action="save"]')!.click();
            await Promise.resolve();
        }

        const anchors = Array.from(shadow.querySelectorAll<HTMLElement>('.reader-comment-anchor'));
        expect(anchors).toHaveLength(2);
        expect(anchors[0]?.dataset.count).toBeUndefined();
        expect(anchors[1]?.dataset.count).toBeUndefined();
        expect(anchors[0]?.style.top).not.toBe(anchors[1]?.style.top);

        anchors[0]?.click();
        await Promise.resolve();
        expect(shadow.querySelectorAll('.reader-comment-highlight--active').length).toBeGreaterThan(0);
        getSelectionSpy.mockRestore();
    });

    it('only exposes selection actions for assistant markdown content, not reader chrome or user content', async () => {
        const panel = new ReaderPanel();

        await panel.show(
            [{ id: 'a', userPrompt: 'Prompt content', content: 'Assistant body text' }],
            0,
            'light',
        );

        const host = document.querySelector('#aimd-reader-panel-host') as HTMLElement;
        const shadow = host.shadowRoot as ShadowRoot;
        const promptBody = shadow.querySelector<HTMLElement>('.reader-message__body--prompt')!;
        const label = shadow.querySelectorAll<HTMLElement>('.reader-message__label')[1]!;

        const promptText = promptBody.firstChild as Text;
        const promptRange = document.createRange();
        promptRange.setStart(promptText, 0);
        promptRange.setEnd(promptText, promptText.textContent!.length);

        const labelText = label.firstChild as Text;
        const labelRange = document.createRange();
        labelRange.setStart(labelText, 0);
        labelRange.setEnd(labelText, labelText.textContent!.length);

        const getSelectionSpy = vi.spyOn(window, 'getSelection')
            .mockReturnValueOnce(createSelection(promptRange))
            .mockReturnValueOnce(createSelection(labelRange));

        document.dispatchEvent(new Event('selectionchange'));
        await Promise.resolve();
        expect(shadow.querySelectorAll('.reader-comment-action__button')).toHaveLength(0);

        document.dispatchEvent(new Event('selectionchange'));
        await Promise.resolve();
        expect(shadow.querySelectorAll('.reader-comment-action__button')).toHaveLength(0);

        getSelectionSpy.mockRestore();
    });
});
