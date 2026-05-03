import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { resolveReaderCommentAnchor } from '@/services/reader/commentAnchoring';
import { clearReaderCommentScope, listReaderComments } from '@/services/reader/commentSession';
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
        const copyCommentsButton = shadow.querySelector<HTMLButtonElement>('[data-action="reader-copy-comments"]')!;
        expect(copyCommentsButton.querySelector('path[d="M16 3h5v5"]')).toBeTruthy();
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

    it('copies compiled comments with the selected prompt below annotations when configured', async () => {
        const { writeText } = setClipboardMock();
        const panel = new ReaderPanel();
        panel.setCommentExportSettings({
            prompts: [
                { id: 'default', title: 'Default', content: 'Please review the following comments:' },
                { id: 'research-review', title: 'Research review', content: 'Summarize these comments:' },
            ],
            template: [
                { type: 'text', value: 'Regarding\n' },
                { type: 'token', key: 'selected_source' },
                { type: 'text', value: '\nMy comment is:\n' },
                { type: 'token', key: 'user_comment' },
            ],
            promptPosition: 'bottom',
        });

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
        shadow.querySelector<HTMLButtonElement>('.comment-prompt-picker__item[data-prompt-id="research-review"]')!.click();
        await Promise.resolve();

        const exportRoot = shadow.querySelector<HTMLElement>('.reader-comment-export');
        expect(exportRoot).toBeTruthy();
        expect(exportRoot!.querySelector('[data-role="userPrompt"]')).toBeNull();
        expect(exportRoot!.querySelector('[data-role="commentTemplate"]')).toBeNull();
        expect(exportRoot!.querySelector('[data-action="insert-selected-source"]')).toBeNull();
        expect(exportRoot!.querySelector<HTMLElement>('[data-role="preview"]')?.textContent).toContain('Summarize these comments:');
        exportRoot.querySelector<HTMLButtonElement>('[data-action="copy"]')!.click();
        await Promise.resolve();
        await Promise.resolve();

        expect(writeText).toHaveBeenCalledWith(
            [
                '1. Regarding',
                '   Before `code` and $x+y$ after',
                '   My comment is:',
                '   Needs clarification',
                '',
                'Summarize these comments:',
            ].join('\n'),
        );
        getSelectionSpy.mockRestore();
    });

    it('deletes an existing annotation from the anchor edit flow and clears its UI state', async () => {
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

        expect(listReaderComments(scopeId, 'a')).toHaveLength(1);
        expect(shadow.querySelectorAll('.reader-comment-anchor')).toHaveLength(1);

        shadow.querySelector<HTMLButtonElement>('.reader-comment-anchor')!.click();
        await Promise.resolve();
        shadow.querySelector<HTMLButtonElement>('.reader-comment-popover [data-action="cancel"]')!.click();
        await Promise.resolve();

        expect(listReaderComments(scopeId, 'a')).toHaveLength(0);
        expect(shadow.querySelectorAll('.reader-comment-anchor')).toHaveLength(0);
        expect(shadow.querySelectorAll('.reader-comment-highlight')).toHaveLength(0);
        expect(shadow.querySelector<HTMLButtonElement>('[data-action="reader-copy-comments"]')?.disabled).toBe(true);

        getSelectionSpy.mockRestore();
    });

    it('opens the prompt picker centered when copying annotations from the reader header', async () => {
        const panel = new ReaderPanel();
        panel.setCommentExportSettings({
            prompts: [
                { id: 'default', title: 'Default', content: 'Please review the following comments:' },
            ],
            template: [
                { type: 'token', key: 'selected_source' },
                { type: 'text', value: '\n' },
                { type: 'token', key: 'user_comment' },
            ],
        });

        await panel.show(
            [{ id: 'a', userPrompt: 'Q1', content: 'Before `code` and $x+y$ after' }],
            0,
            'light',
        );

        const host = document.querySelector('#aimd-reader-panel-host') as HTMLElement;
        const shadow = host.shadowRoot as ShadowRoot;
        const markdownRoot = shadow.querySelector<HTMLElement>('.reader-markdown')!;
        const paragraph = markdownRoot.querySelector('p')!;
        const range = document.createRange();
        range.setStart(paragraph.firstChild as Text, 0);
        range.setEnd(paragraph.lastChild as Text, paragraph.lastChild?.textContent?.length ?? 0);
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

        Object.defineProperty(window, 'innerWidth', { value: 1280, configurable: true });
        Object.defineProperty(window, 'innerHeight', { value: 720, configurable: true });
        const rectSpy = vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function getRect(this: HTMLElement) {
            if (this.classList.contains('comment-prompt-picker')) {
                return { left: 0, top: 0, width: 420, height: 280, right: 420, bottom: 280, x: 0, y: 0, toJSON: () => ({}) } as DOMRect;
            }
            return {
                left: 40,
                top: 32,
                width: 32,
                height: 32,
                right: 72,
                bottom: 64,
                x: 40,
                y: 32,
                toJSON: () => ({}),
            } as DOMRect;
        });

        shadow.querySelector<HTMLButtonElement>('[data-action="reader-copy-comments"]')!.click();
        await Promise.resolve();

        const pickerLayer = shadow.querySelector<HTMLElement>('.comment-prompt-picker-layer')!;
        const picker = shadow.querySelector<HTMLElement>('.comment-prompt-picker')!;
        expect(pickerLayer.parentElement).toBe(shadow.querySelector('[data-role="overlay-surface-root"]'));
        expect(Number.parseFloat(picker.style.left)).toBe(430);
        expect(Number.parseFloat(picker.style.top)).toBe(220);

        rectSpy.mockRestore();
        getSelectionSpy.mockRestore();
    });

    it('copies the same compiled text shown in the export popover even if settings change while it is open', async () => {
        const { writeText } = setClipboardMock();
        const panel = new ReaderPanel();
        panel.setCommentExportSettings({
            prompts: [
                { id: 'first', title: 'First', content: 'First prompt:' },
                { id: 'second', title: 'Second', content: 'Second prompt:' },
            ],
            template: [
                { type: 'token', key: 'selected_source' },
                { type: 'text', value: '\n' },
                { type: 'token', key: 'user_comment' },
            ],
        });

        await panel.show(
            [{ id: 'a', userPrompt: 'Q1', content: 'Before `code` and $x+y$ after' }],
            0,
            'light',
        );

        const host = document.querySelector('#aimd-reader-panel-host') as HTMLElement;
        const shadow = host.shadowRoot as ShadowRoot;
        const markdownRoot = shadow.querySelector<HTMLElement>('.reader-markdown')!;
        const paragraph = markdownRoot.querySelector('p')!;
        const range = document.createRange();
        range.setStart(paragraph.firstChild as Text, 0);
        range.setEnd(paragraph.lastChild as Text, paragraph.lastChild?.textContent?.length ?? 0);
        installLayoutMocks(range, markdownRoot, Array.from(markdownRoot.querySelectorAll<HTMLElement>('[data-aimd-unit-id]')));

        const getSelectionSpy = vi.spyOn(window, 'getSelection').mockReturnValue(createSelection(range));
        document.dispatchEvent(new Event('selectionchange'));
        await Promise.resolve();

        shadow.querySelectorAll<HTMLButtonElement>('.reader-comment-action__button')[1]!.click();
        await Promise.resolve();
        const textarea = shadow.querySelector<HTMLTextAreaElement>('.reader-comment-popover__input')!;
        textarea.value = 'Snapshot comment';
        textarea.dispatchEvent(new Event('input', { bubbles: true }));
        shadow.querySelector<HTMLButtonElement>('.reader-comment-popover [data-action="save"]')!.click();
        await Promise.resolve();

        shadow.querySelector<HTMLButtonElement>('[data-action="reader-copy-comments"]')!.click();
        await Promise.resolve();
        shadow.querySelector<HTMLButtonElement>('.comment-prompt-picker__item[data-prompt-id="first"]')!.click();
        await Promise.resolve();

        const exportRoot = shadow.querySelector<HTMLElement>('.reader-comment-export')!;
        const previewText = exportRoot.querySelector<HTMLElement>('[data-role="preview"]')?.textContent ?? '';
        expect(previewText).toContain('First prompt:');

        panel.setCommentExportSettings({
            prompts: [
                { id: 'first', title: 'First', content: 'First prompt:' },
                { id: 'second', title: 'Second', content: 'Second prompt:' },
            ],
            template: [
                { type: 'text', value: 'Changed: ' },
                { type: 'token', key: 'user_comment' },
            ],
        });

        exportRoot.querySelector<HTMLButtonElement>('[data-action="copy"]')!.click();
        await Promise.resolve();
        await Promise.resolve();

        expect(writeText).toHaveBeenCalledWith(previewText);
        expect(writeText).not.toHaveBeenCalledWith(expect.stringContaining('Second prompt:'));
        getSelectionSpy.mockRestore();
    });

    it('still exposes prompt export context when there are no annotations yet', async () => {
        const panel = new ReaderPanel();
        panel.setCommentExportSettings({
            prompts: [
                { id: 'default', title: 'Default', content: 'Please revise the content according to my annotations below.' },
            ],
            template: [
                { type: 'text', value: 'Regarding the following text:\n<selected_text>\n' },
                { type: 'token', key: 'selected_source' },
                { type: 'text', value: '\n</selected_text>\n\nMy annotation:\n<annotation>\n' },
                { type: 'token', key: 'user_comment' },
                { type: 'text', value: '\n</annotation>' },
            ],
        });

        await panel.show(
            [{ id: 'a', userPrompt: 'Q1', content: 'Before `code` and $x+y$ after' }],
            0,
            'light',
        );

        const context = panel.getCommentExportContext();
        expect(context).toBeTruthy();
        expect(context?.comments).toEqual([]);
        expect(context?.prompts).toHaveLength(1);
        expect(context?.prompts[0]?.content).toBe('Please revise the content according to my annotations below.');
        expect(context?.template).toHaveLength(5);
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

    it('anchors edit popovers to the commented content instead of the gutter button', async () => {
        const panel = new ReaderPanel();

        await panel.show(
            [{ id: 'a', userPrompt: 'Q1', content: 'Before `code` and $x+y$ after' }],
            0,
            'light',
        );

        const host = document.querySelector('#aimd-reader-panel-host') as HTMLElement;
        const shadow = host.shadowRoot as ShadowRoot;
        const markdownRoot = shadow.querySelector<HTMLElement>('.reader-markdown')!;
        const overlayRoot = shadow.querySelector<HTMLElement>('[data-role="comment-overlay"]')!;
        const paragraph = markdownRoot.querySelector('p')!;
        const firstText = paragraph.firstChild as Text;
        const lastText = paragraph.lastChild as Text;
        const range = document.createRange();
        range.setStart(firstText, 0);
        range.setEnd(lastText, lastText.textContent!.length);
        installLayoutMocks(range, markdownRoot, Array.from(markdownRoot.querySelectorAll<HTMLElement>('[data-aimd-unit-id]')));
        Object.assign(overlayRoot, {
            getBoundingClientRect: () => ({
                left: 120, top: 80, width: 840, height: 320, right: 960, bottom: 400, x: 120, y: 80, toJSON: () => ({}),
            }),
        });

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

        const record = listReaderComments(scopeId, 'a')[0]!;
        const resolved = resolveReaderCommentAnchor(markdownRoot, record);
        expect(resolved.unionRect).toBeTruthy();

        const anchor = shadow.querySelector<HTMLElement>('.reader-comment-anchor')!;
        Object.assign(anchor, {
            getBoundingClientRect: () => ({
                left: 720, top: 260, width: 32, height: 32, right: 752, bottom: 292, x: 720, y: 260, toJSON: () => ({}),
            }),
        });

        const openSpy = vi.spyOn((panel as any).commentPopover, 'open');
        anchor.click();
        await Promise.resolve();

        expect(openSpy).toHaveBeenCalled();
        const params = openSpy.mock.calls.at(-1)?.[0];
        expect(params.anchorRect.left).toBeCloseTo(120 + resolved.unionRect!.left, 4);
        expect(params.anchorRect.top).toBeCloseTo(80 + resolved.unionRect!.top, 4);
        expect(params.anchorRect.width).toBeCloseTo(resolved.unionRect!.width, 4);
        expect(params.anchorRect.height).toBeCloseTo(resolved.unionRect!.height, 4);
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
