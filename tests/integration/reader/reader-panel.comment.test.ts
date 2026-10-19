import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { DEFAULT_SETTINGS, type AppSettings } from '@/core/settings/types';
import { getDefaultShortcutBindings, getShortcutPlatform, type ShortcutCommandId } from '@/core/shortcuts';
import type { ReaderAnnotationDocument } from '@/contracts/readerAnnotations';
import { readerAnnotationsClient } from '@/drivers/shared/clients/readerAnnotationsClient';
import { createProtocolClientFailure } from '@/drivers/shared/clients/clientResult';
import { resolveReaderCommentAnchor } from '@/services/reader/commentAnchoring';
import { clearReaderCommentScope, listReaderComments, removeReaderComment, saveReaderComment, toReaderAnnotationRecord, type ReaderCommentRecord } from '@/services/reader/commentSession';
import { ReaderPanel } from '@/ui/content/reader/ReaderPanel';
import type { ReaderCommentExportPopover } from '@/ui/content/reader/ReaderCommentExportPopover';
import { createAppearanceSnapshot } from '@/style/appearance';

const scopeId = 'reader-panel-comments-v1';

function setClipboardMock() {
    const writeText = vi.fn(async (_text: string) => undefined);
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

function setReaderPromptProvider(panel: ReaderPanel, prompts: Array<{ id: string; title: string; content: string }>): void {
    panel.setPromptManagerController({
        onOpenManager: vi.fn(async () => undefined),
        listReaderPrompts: async () => prompts,
    });
}

function commentRecord(overrides: Partial<ReaderCommentRecord>): ReaderCommentRecord {
    return {
        id: 'seed-comment',
        itemId: 'a',
        quoteText: 'seed quote',
        sourceMarkdown: 'seed source',
        comment: 'seed note',
        selectors: {
            textQuote: { exact: '', prefix: '', suffix: '' },
            textPosition: { start: 0, end: 0 },
            domRange: null,
            atomicRefs: [],
        },
        createdAt: 1,
        updatedAt: 1,
        ...overrides,
    };
}

function seedComment(overrides: Partial<ReaderCommentRecord>): ReaderCommentRecord {
    return saveReaderComment(scopeId, commentRecord(overrides));
}

function clickWithPointer(element: HTMLElement): void {
    element.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, composed: true }));
    element.click();
}

async function openCommentExportFromHeader(): Promise<{ shadow: ShadowRoot; exporting: HTMLElement }> {
    const shadow = document.querySelector<HTMLElement>('#aimd-reader-panel-host')!.shadowRoot!;
    clickWithPointer(shadow.querySelector<HTMLButtonElement>('[data-action="reader-copy-comments"]')!);
    await vi.waitFor(() => expect(shadow.querySelector('.reader-comment-export')).toBeTruthy());
    return { shadow, exporting: shadow.querySelector<HTMLElement>('.reader-comment-export')! };
}

function observeExportDeletes(panel: ReaderPanel) {
    const popover = (panel as unknown as { commentExportPopover: ReaderCommentExportPopover }).commentExportPopover;
    const open = popover.open.bind(popover);
    const pending: Array<Promise<string[]>> = [];
    const spy = vi.spyOn(popover, 'open').mockImplementation((params) => {
        const onDelete = params.onDelete;
        open({
            ...params,
            onDelete: onDelete ? (ids) => {
                const result = onDelete(ids);
                pending.push(result);
                return result;
            } : undefined,
        });
    });
    return { pending, restore: () => spy.mockRestore() };
}

async function answerAnnotationDeleteConfirmation(shadow: ShadowRoot, accept: boolean): Promise<void> {
    await vi.waitFor(() => expect(shadow.querySelector('.mock-modal[data-kind="warning"]')).toBeTruthy());
    const dialog = shadow.querySelector<HTMLElement>('.mock-modal[data-kind="warning"]')!;
    const action = accept ? 'modal-confirm' : 'modal-cancel';
    clickWithPointer(dialog.querySelector<HTMLButtonElement>(`.mock-modal__footer [data-action="${action}"]`)!);
    finishAnnotationConfirmationClose(dialog);
}

function finishAnnotationConfirmationClose(dialog: HTMLElement): void {
    dialog.dispatchEvent(new Event('animationend', { bubbles: true }));
}

describe('ReaderPanel comments', () => {
    beforeEach(() => {
        clearReaderCommentScope(scopeId);
    });

    it('uses real keydown to copy and annotate a fresh selection even when toolbar actions are hidden', async () => {
        const { writeText } = setClipboardMock();
        const panel = new ReaderPanel();
        panel.setReaderSettings({ ...DEFAULT_SETTINGS.reader, selectionToolbar: { copy: false, annotation: false, highlight: false } });
        panel.setShortcutSettings({ enabled: true, overrides: {}, disabled: [] });
        await panel.show([{ id: 'a', userPrompt: 'Question', content: 'Selected **text**' }], 0, 'light');
        const host = document.querySelector<HTMLElement>('#aimd-reader-panel-host')!;
        const shadow = host.shadowRoot!;
        const root = shadow.querySelector<HTMLElement>('.reader-markdown')!;
        const range = document.createRange(); range.selectNodeContents(root);
        installLayoutMocks(range, root, []);
        const spy = vi.spyOn(window, 'getSelection').mockReturnValue(createSelection(range));
        const sendDefault = (id: ShortcutCommandId) => {
            const platform = getShortcutPlatform(navigator.platform);
            const binding = getDefaultShortcutBindings(platform)[id]!;
            const event = new KeyboardEvent('keydown', {
                key: binding.code.replace(/^Key/, ''), code: binding.code,
                ctrlKey: platform === 'mac' ? Boolean(binding.control) : Boolean(binding.primary || binding.control),
                metaKey: platform === 'mac' && binding.primary, altKey: binding.alt, shiftKey: binding.shift,
                bubbles: true, composed: true, cancelable: true,
            });
            root.dispatchEvent(event);
            return event;
        };
        try {
            expect(sendDefault('selection.copyMarkdown').defaultPrevented).toBe(true);
            await vi.waitFor(() => expect(writeText).toHaveBeenCalledWith('Selected text'));
            expect(shadow.querySelectorAll('.reader-comment-action__button')).toHaveLength(0);
            expect(sendDefault('selection.annotate').defaultPrevented).toBe(true);
            expect(shadow.querySelector('.reader-comment-popover__input')).toBeTruthy();
            // The annotation editor owns its keyboard scope and remains editable.
            const input = shadow.querySelector<HTMLTextAreaElement>('.reader-comment-popover__input')!;
            input.value = 'note';
            const copy = new KeyboardEvent('keydown', { key: 'C', code: 'KeyC', ctrlKey: true, shiftKey: true, bubbles: true, composed: true, cancelable: true });
            input.dispatchEvent(copy);
            expect(copy.defaultPrevented).toBe(false);
            expect(writeText).toHaveBeenCalledTimes(1);
        } finally { spy.mockRestore(); panel.hide(); }
    });

    it('runs one persistent comment pass after content rendering', async () => {
        const panel = new ReaderPanel();
        await panel.show(
            [{ id: 'a', userPrompt: 'Q1', content: 'content' }],
            0,
            'light',
        );

        const syncCommentUi = vi.spyOn(panel as any, 'syncCommentUi');
        await (panel as any).renderCurrentContent();

        expect(syncCommentUi).toHaveBeenCalledTimes(1);
        panel.hide();
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
        document.dispatchEvent(new Event('pointerup'));
        await Promise.resolve();

        const commentActions = shadow.querySelectorAll<HTMLButtonElement>('.reader-comment-action__button');
        expect(commentActions).toHaveLength(3);
        commentActions[1]!.click();
        await Promise.resolve();

        expect(shadow.querySelector<HTMLElement>('.reader-comment-popover__selection-value')?.textContent).toContain('Before `code` and $x+y$ after');
        const textarea = shadow.querySelector<HTMLTextAreaElement>('.reader-comment-popover__input');
        expect(textarea).toBeTruthy();
        textarea!.value = 'Needs clarification';
        textarea!.dispatchEvent(new Event('input', { bubbles: true }));

        document.body.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, composed: true }));
        document.body.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true }));
        expect(listReaderComments(scopeId, 'a')).toHaveLength(0);
        expect(textarea!.value).toBe('Needs clarification');
        expect((panel as any).commentPopover.isOpen()).toBe(true);
        shadow.querySelector<HTMLButtonElement>('.reader-comment-popover [data-action="close"]')!.click();
        await vi.waitFor(() => expect((panel as any).commentPopover.isOpen()).toBe(false));
        document.dispatchEvent(new Event('selectionchange'));
        document.dispatchEvent(new Event('pointerup'));
        await Promise.resolve();
        shadow.querySelectorAll<HTMLButtonElement>('.reader-comment-action__button')[1]!.click();
        const reopenedInput = shadow.querySelector<HTMLTextAreaElement>('.reader-comment-popover__input')!;
        expect(reopenedInput.value).toBe('');
        expect(listReaderComments(scopeId, 'a')).toHaveLength(0);
        reopenedInput.value = 'Needs clarification';
        reopenedInput.dispatchEvent(new Event('input', { bubbles: true }));
        (panel as any).toggleFullscreen();
        expect(shadow.querySelector('.reader-comment-popover__input')).toBe(reopenedInput);
        expect(reopenedInput.isConnected).toBe(true);
        expect(reopenedInput.value).toBe('Needs clarification');
        const resizedMarkdownRoot = shadow.querySelector<HTMLElement>('.reader-markdown')!;
        installLayoutMocks(range, resizedMarkdownRoot, Array.from(resizedMarkdownRoot.querySelectorAll<HTMLElement>('[data-aimd-unit-id]')));

        shadow.querySelector<HTMLButtonElement>('.reader-comment-popover [data-action="save"]')!.click();
        await Promise.resolve();

        expect((panel as any).state.statusText).toBe('Only kept in this session.');
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

    it('captures a zero text position for annotations selected from the first rendered element boundary', async () => {
        const panel = new ReaderPanel();
        panel.setCommentExportSettings({
            ...DEFAULT_SETTINGS.reader.commentExport,
            sortMode: 'position',
        });

        await panel.show(
            [{ id: 'a', userPrompt: 'Q1', content: '## Response and latest decision\n\nLater paragraph text.' }],
            0,
            'light',
        );

        const host = document.querySelector('#aimd-reader-panel-host') as HTMLElement;
        const shadow = host.shadowRoot as ShadowRoot;
        const markdownRoot = shadow.querySelector<HTMLElement>('.reader-markdown')!;
        const heading = markdownRoot.querySelector('h2')!;
        const range = document.createRange();
        range.setStart(heading, 0);
        range.setEnd(heading, heading.childNodes.length);
        installLayoutMocks(range, markdownRoot, Array.from(markdownRoot.querySelectorAll<HTMLElement>('[data-aimd-unit-id]')));

        const getSelectionSpy = vi.spyOn(window, 'getSelection').mockReturnValue(createSelection(range));
        document.dispatchEvent(new Event('selectionchange'));
        document.dispatchEvent(new Event('pointerup'));
        await Promise.resolve();

        shadow.querySelectorAll<HTMLButtonElement>('.reader-comment-action__button')[1]!.click();
        await Promise.resolve();
        const textarea = shadow.querySelector<HTMLTextAreaElement>('.reader-comment-popover__input')!;
        textarea.value = 'Top boundary annotation';
        textarea.dispatchEvent(new Event('input', { bubbles: true }));
        shadow.querySelector<HTMLButtonElement>('.reader-comment-popover [data-action="save"]')!.click();
        await Promise.resolve();

        const saved = listReaderComments(scopeId, 'a')[0]!;
        expect(saved.selectors.textPosition).toEqual({
            start: 0,
            end: 'Response and latest decision'.length,
        });

        seedComment({
            id: 'later-position',
            sourceMarkdown: 'Later paragraph text.',
            comment: 'Later annotation',
            createdAt: 1,
            updatedAt: 1,
            selectors: {
                textQuote: { exact: '', prefix: '', suffix: '' },
                textPosition: { start: 80, end: 90 },
                domRange: null,
                atomicRefs: [],
            },
        });

        shadow.querySelector<HTMLButtonElement>('[data-action="reader-comment-list"]')!.click();
        await Promise.resolve();

        const items = Array.from(shadow.querySelectorAll<HTMLElement>('.reader-comment-list__item'));
        expect(items).toHaveLength(2);
        expect(items[0]?.textContent).toContain('Top boundary annotation');
        expect(items[0]?.textContent).toContain(`Position: 0-${'Response and latest decision'.length}`);
        expect(items[1]?.textContent).toContain('Later annotation');

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
        setReaderPromptProvider(panel, [
            { id: 'default', title: 'Default', content: 'Please review the following comments:' },
            { id: 'research-review', title: 'Research review', content: 'Summarize these comments:' },
        ]);

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
        document.dispatchEvent(new Event('pointerup'));
        await Promise.resolve();

        shadow.querySelectorAll<HTMLButtonElement>('.reader-comment-action__button')[1]!.click();
        await Promise.resolve();
        const textarea = shadow.querySelector<HTMLTextAreaElement>('.reader-comment-popover__input')!;
        expect(shadow.querySelector<HTMLElement>('.reader-comment-popover__shortcut')?.textContent)
            .toBe('Ctrl/Cmd + Enter to save');
        textarea.value = 'Needs clarification';
        textarea.dispatchEvent(new Event('input', { bubbles: true }));
        shadow.querySelector<HTMLButtonElement>('.reader-comment-popover [data-action="save"]')!.click();
        await Promise.resolve();

        const copyCommentsTrigger = shadow.querySelector<HTMLButtonElement>('[data-action="reader-copy-comments"]')!;
        copyCommentsTrigger.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, composed: true }));
        copyCommentsTrigger.click();
        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();
        const exportRoot = shadow.querySelector<HTMLElement>('.reader-comment-export')!;
        expect(exportRoot).toBeTruthy();
        expect(shadow.querySelector('.comment-prompt-picker')).toBeNull();
        expect(exportRoot.classList.contains('flat-workflow')).toBe(true);
        expect(exportRoot.querySelector('[data-role="userPrompt"]')).toBeNull();
        expect(exportRoot.querySelector('[data-role="commentTemplate"]')).toBeNull();
        expect(exportRoot.querySelector('[data-action="insert-selected-source"]')).toBeNull();
        const copyExport = exportRoot.querySelector<HTMLButtonElement>('[data-action="copy"]')!;
        expect(copyExport.disabled).toBe(true);
        const prompt = exportRoot.querySelector<HTMLSelectElement>('[data-role="prompt-select"]')!;
        prompt.value = 'research-review';
        prompt.dispatchEvent(new Event('change', { bubbles: true }));
        expect(copyExport.disabled).toBe(true);
        prompt.value = '';
        prompt.dispatchEvent(new Event('change', { bubbles: true }));
        const annotation = exportRoot.querySelector<HTMLInputElement>('[data-annotation-id]')!;
        expect(annotation.checked).toBe(false);
        annotation.click();
        expect(copyExport.disabled).toBe(false);
        expect(exportRoot.querySelector<HTMLElement>('[data-role="preview"]')?.textContent)
            .not.toContain('Summarize these comments:');
        prompt.closest('details')!.open = true;
        prompt.value = 'research-review';
        prompt.dispatchEvent(new Event('change', { bubbles: true }));
        expect(exportRoot.querySelector<HTMLElement>('[data-role="preview"]')?.textContent).toContain('Summarize these comments:');
        copyExport.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, composed: true }));
        expect(exportRoot.isConnected).toBe(true);
        copyExport.click();
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
        prompt.value = '';
        prompt.dispatchEvent(new Event('change', { bubbles: true }));
        copyExport.click();
        await Promise.resolve();
        await Promise.resolve();
        expect(writeText).toHaveBeenLastCalledWith([
            '1. Regarding',
            '   Before `code` and $x+y$ after',
            '   My comment is:',
            '   Needs clarification',
        ].join('\n'));
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
        document.dispatchEvent(new Event('pointerup'));
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
        shadow.querySelector<HTMLButtonElement>('.reader-comment-popover [data-action="delete"]')!.click();
        shadow.querySelector<HTMLButtonElement>('.reader-comment-popover [data-action="confirm-delete"]')!.click();
        await Promise.resolve();

        expect(listReaderComments(scopeId, 'a')).toHaveLength(0);
        await vi.waitFor(() => expect(shadow.querySelectorAll('.reader-comment-anchor')).toHaveLength(0));
        expect(shadow.querySelectorAll('.reader-comment-highlight')).toHaveLength(0);
        expect(shadow.querySelector<HTMLButtonElement>('[data-action="reader-copy-comments"]')?.disabled).toBe(true);

        getSelectionSpy.mockRestore();
    });

    it('copies only selected annotations from the current message without a Prompt and preserves complete source Markdown', async () => {
        const { writeText } = setClipboardMock();
        const fullSource = `[Full source](https://example.com/source) ${'unabridged evidence '.repeat(120)}\`source_end()\` $x+y$`;
        seedComment({ id: 'first', quoteText: 'Short excerpt only', sourceMarkdown: fullSource, comment: 'First selected annotation' });
        seedComment({ id: 'second', sourceMarkdown: 'Second source', comment: 'Second selected annotation', createdAt: 2 });
        seedComment({ id: 'excluded', sourceMarkdown: 'Unselected source', comment: 'Unselected annotation', createdAt: 3 });
        seedComment({ id: 'other-message', itemId: 'b', comment: 'Another message annotation' });
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
        setReaderPromptProvider(panel, []);

        await panel.show(
            [{ id: 'a', userPrompt: 'Q1', content: 'First response' }, { id: 'b', userPrompt: 'Q2', content: 'Second response' }],
            0,
            'light',
        );

        const host = document.querySelector('#aimd-reader-panel-host') as HTMLElement;
        const shadow = host.shadowRoot as ShadowRoot;
        const trigger = shadow.querySelector<HTMLButtonElement>('[data-action="reader-copy-comments"]')!;
        trigger.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, composed: true }));
        trigger.click();
        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();

        const exporting = shadow.querySelector<HTMLElement>('.reader-comment-export')!;
        expect(exporting).toBeTruthy();
        expect(exporting.querySelectorAll('[data-annotation-id]')).toHaveLength(3);
        expect(exporting.querySelector('[data-annotation-id="other-message"]')).toBeNull();
        expect(exporting.querySelector('[data-role="prompt-select"]')).toBeNull();
        const copy = exporting.querySelector<HTMLButtonElement>('[data-action="copy"]')!;
        const selectAll = exporting.querySelector<HTMLInputElement>('[data-role="select-all"]')!;
        expect(copy.disabled).toBe(true);
        expect(Array.from(exporting.querySelectorAll<HTMLInputElement>('[data-annotation-id]')).every(input => !input.checked)).toBe(true);
        exporting.querySelector<HTMLInputElement>('[data-annotation-id="first"]')!.click();
        exporting.querySelector<HTMLInputElement>('[data-annotation-id="second"]')!.click();
        expect(selectAll.checked).toBe(false);
        expect(selectAll.indeterminate).toBe(true);
        expect(copy.disabled).toBe(false);
        copy.click();
        await Promise.resolve();
        await Promise.resolve();

        expect(writeText).toHaveBeenCalledOnce();
        const copied = writeText.mock.calls[0]![0];
        expect(copied).toContain(fullSource);
        expect(copied).toContain('First selected annotation');
        expect(copied).toContain('Second selected annotation');
        expect(copied).not.toContain('Unselected annotation');
        expect(copied).not.toContain('Another message annotation');
        expect(copied).not.toContain('Please review the following comments:');
        expect(listReaderComments(scopeId, 'a')).toHaveLength(3);
        expect(exporting.querySelector<HTMLInputElement>('[data-annotation-id="first"]')?.checked).toBe(true);
        expect(exporting.querySelector<HTMLInputElement>('[data-annotation-id="second"]')?.checked).toBe(true);
        panel.hide();
    });

    it('keeps the copied selection in one window and deletes only confirmed selected annotations', async () => {
        const { writeText } = setClipboardMock();
        seedComment({ id: 'first', comment: 'First note' });
        seedComment({ id: 'second', comment: 'Second note', createdAt: 2 });
        seedComment({ id: 'unselected', comment: 'Keep unselected', createdAt: 3 });
        seedComment({ id: 'other-message', itemId: 'b', comment: 'Keep another message' });
        const panel = new ReaderPanel();
        setReaderPromptProvider(panel, []);
        const observed = observeExportDeletes(panel);
        try {
            await panel.show([
                { id: 'a', userPrompt: 'Q1', content: 'First response' },
                { id: 'b', userPrompt: 'Q2', content: 'Second response' },
            ], 0, 'light');
            const { shadow, exporting } = await openCommentExportFromHeader();
            const first = exporting.querySelector<HTMLInputElement>('[data-annotation-id="first"]')!;
            const second = exporting.querySelector<HTMLInputElement>('[data-annotation-id="second"]')!;
            first.click();
            second.click();
            const copy = exporting.querySelector<HTMLButtonElement>('[data-action="copy"]')!;
            const remove = exporting.querySelector<HTMLButtonElement>('[data-action="delete"]')!;
            clickWithPointer(copy);
            await vi.waitFor(() => expect(writeText).toHaveBeenCalledOnce());
            await vi.waitFor(() => expect(remove.disabled).toBe(false));
            expect(exporting.querySelector<HTMLInputElement>('[data-annotation-id="first"]')?.checked).toBe(true);
            expect(exporting.querySelector<HTMLInputElement>('[data-annotation-id="second"]')?.checked).toBe(true);
            expect(listReaderComments(scopeId, 'a')).toHaveLength(3);

            clickWithPointer(remove);
            await vi.waitFor(() => expect(observed.pending).toHaveLength(1));
            await answerAnnotationDeleteConfirmation(shadow, false);
            expect(await observed.pending[0]).toEqual([]);
            await vi.waitFor(() => expect(remove.disabled).toBe(false));
            expect(exporting.isConnected).toBe(true);
            expect(exporting.querySelector<HTMLInputElement>('[data-annotation-id="first"]')?.checked).toBe(true);
            expect(exporting.querySelector<HTMLInputElement>('[data-annotation-id="second"]')?.checked).toBe(true);
            expect(listReaderComments(scopeId, 'a')).toHaveLength(3);

            clickWithPointer(remove);
            await answerAnnotationDeleteConfirmation(shadow, true);
            expect(new Set(await observed.pending[1])).toEqual(new Set(['first', 'second']));
            await vi.waitFor(() => expect(exporting.querySelector('[data-annotation-id="first"]')).toBeNull());
            expect(exporting.querySelector('[data-annotation-id="second"]')).toBeNull();
            expect(exporting.querySelector<HTMLInputElement>('[data-annotation-id="unselected"]')?.checked).toBe(false);
            expect(exporting.isConnected).toBe(true);
            expect(copy.disabled).toBe(true);
            expect(remove.disabled).toBe(true);
            expect(listReaderComments(scopeId, 'a').map((record) => record.id)).toEqual(['unselected']);
            expect(listReaderComments(scopeId, 'b').map((record) => record.id)).toEqual(['other-message']);
        } finally {
            observed.restore();
            panel.hide();
        }
    });

    it.each(['header', 'host'] as const)('routes Escape from the Reader %s to its export window and then only to deletion confirmation', async (focus) => {
        seedComment({ id: 'escape-export', comment: 'Keep this annotation' });
        const panel = new ReaderPanel();
        setReaderPromptProvider(panel, []);
        const observed = observeExportDeletes(panel);
        try {
            await panel.show([{ id: 'a', userPrompt: 'Q1', content: 'Response' }], 0, 'light');
            const host = document.querySelector<HTMLElement>('#aimd-reader-panel-host')!;
            const { shadow } = await openCommentExportFromHeader();
            const trigger = shadow.querySelector<HTMLButtonElement>('[data-action="reader-copy-comments"]')!;
            const keyboardTarget = focus === 'header' ? trigger : host;
            if (focus === 'host') host.tabIndex = -1;
            keyboardTarget.focus();
            expect(document.activeElement).toBe(host);
            expect(shadow.activeElement).toBe(focus === 'header' ? trigger : null);
            keyboardTarget.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, composed: true, cancelable: true }));
            await vi.waitFor(() => expect(shadow.querySelector('.reader-comment-export')).toBeNull());
            expect(panel.isVisible()).toBe(true);
            expect(document.querySelector('#aimd-reader-panel-host')).toBe(host);

            const { exporting } = await openCommentExportFromHeader();
            exporting.querySelector<HTMLInputElement>('[data-annotation-id="escape-export"]')!.click();
            clickWithPointer(exporting.querySelector<HTMLButtonElement>('[data-action="delete"]')!);
            await vi.waitFor(() => expect(shadow.querySelector('.mock-modal[data-kind="warning"]')).toBeTruthy());
            const dialog = shadow.querySelector<HTMLElement>('.mock-modal[data-kind="warning"]')!;
            keyboardTarget.focus();
            expect(document.activeElement).toBe(host);
            expect(shadow.activeElement).toBe(focus === 'header' ? trigger : null);
            keyboardTarget.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, composed: true, cancelable: true }));
            finishAnnotationConfirmationClose(dialog);
            expect(await observed.pending[0]).toEqual([]);
            await vi.waitFor(() => expect(shadow.querySelector('.mock-modal[data-kind="warning"]')).toBeNull());
            expect(exporting.isConnected).toBe(true);
            expect(exporting.querySelector<HTMLInputElement>('[data-annotation-id="escape-export"]')?.checked).toBe(true);
            expect(panel.isVisible()).toBe(true);
            expect(document.querySelector('#aimd-reader-panel-host')).toBe(host);
            expect(listReaderComments(scopeId, 'a').map((record) => record.id)).toEqual(['escape-export']);
        } finally {
            observed.restore();
            panel.hide();
        }
    });

    it('keeps revision conflicts selected while removing successful and already missing durable annotations', async () => {
        const { writeText } = setClipboardMock();
        const annotationDocument: ReaderAnnotationDocument = { platform: 'chatgpt', conversationId: 'delete-partial', title: 'Delete partial' };
        const records = ['success', 'conflict', 'already-missing'].map((id, index) => commentRecord({
            id, comment: `${id} annotation`, createdAt: index + 1, revision: 3,
            target: { assistantMessageId: 'assistant-a', position: 0 },
        }));
        const remaining = new Map(records.map((record) => [record.id, {
            document: annotationDocument,
            annotation: toReaderAnnotationRecord(record, record.target!),
        }]));
        const list = vi.spyOn(readerAnnotationsClient, 'list').mockImplementation(async () => ({
            ok: true, data: { entries: [...remaining.values()] },
        }));
        const remove = vi.spyOn(readerAnnotationsClient, 'remove').mockImplementation(async (_document, id) => {
            if (id === 'conflict') return createProtocolClientFailure('CONFLICT', 'Annotation changed; reload it before deleting');
            remaining.delete(id);
            return id === 'already-missing'
                ? createProtocolClientFailure('NOT_FOUND', 'Annotation not found')
                : { ok: true, data: { deleted: true, annotationId: id } };
        });
        const panel = new ReaderPanel();
        setReaderPromptProvider(panel, []);
        const observed = observeExportDeletes(panel);
        try {
            await panel.show([
                { id: 'a', userPrompt: 'Q1', content: 'Source response', meta: { assistantMessageId: 'assistant-a' } },
            ], 0, 'light', { annotationDocument });
            const { shadow, exporting } = await openCommentExportFromHeader();
            exporting.querySelector<HTMLInputElement>('[data-role="select-all"]')!.click();
            clickWithPointer(exporting.querySelector<HTMLButtonElement>('[data-action="delete"]')!);
            await answerAnnotationDeleteConfirmation(shadow, true);
            expect(new Set(await observed.pending[0])).toEqual(new Set(['success', 'already-missing']));
            await vi.waitFor(() => expect(exporting.querySelectorAll('[data-annotation-id]')).toHaveLength(1));
            expect(exporting.querySelector<HTMLInputElement>('[data-annotation-id="conflict"]')?.checked).toBe(true);
            expect(panel.getCommentExportContext()?.comments.map((record) => record.id)).toEqual(['conflict']);
            for (const record of records) {
                expect(remove).toHaveBeenCalledWith(expect.objectContaining({ conversationId: 'delete-partial' }), record.id, 3);
            }
            await vi.waitFor(() => expect(exporting.querySelector<HTMLButtonElement>('[data-action="copy"]')?.disabled).toBe(false));
            clickWithPointer(exporting.querySelector<HTMLButtonElement>('[data-action="copy"]')!);
            await vi.waitFor(() => expect(writeText).toHaveBeenCalledOnce());
            expect(writeText.mock.calls[0]![0]).toContain('conflict annotation');
            expect(writeText.mock.calls[0]![0]).not.toContain('success annotation');
        } finally {
            observed.restore();
            panel.hide();
            list.mockRestore();
            remove.mockRestore();
        }
    });

    it.each(['unavailable', 'newer-revision'] as const)('retains durable selections when the confirmation read returns %s', async (scenario) => {
        const annotationDocument: ReaderAnnotationDocument = { platform: 'chatgpt', conversationId: 'delete-fresh-read', title: 'Fresh read' };
        const record = commentRecord({ id: 'fresh-read', revision: 3, target: { assistantMessageId: 'assistant-a', position: 0 } });
        const original = { document: annotationDocument, annotation: toReaderAnnotationRecord(record, record.target!) };
        const newer = { ...original, annotation: { ...original.annotation, comment: 'Edited in another window', revision: 4, updatedAt: 20 } };
        const list = vi.spyOn(readerAnnotationsClient, 'list')
            .mockResolvedValueOnce({ ok: true, data: { entries: [original] } })
            .mockResolvedValue(scenario === 'unavailable'
                ? createProtocolClientFailure('INTERNAL_ERROR', 'Storage unavailable')
                : { ok: true, data: { entries: [newer] } });
        const remove = vi.spyOn(readerAnnotationsClient, 'remove').mockResolvedValue({ ok: true, data: { deleted: true } });
        const panel = new ReaderPanel();
        setReaderPromptProvider(panel, []);
        const observed = observeExportDeletes(panel);
        try {
            await panel.show([
                { id: 'a', userPrompt: 'Q1', content: 'Response', meta: { assistantMessageId: 'assistant-a' } },
            ], 0, 'light', { annotationDocument });
            const { shadow, exporting } = await openCommentExportFromHeader();
            exporting.querySelector<HTMLInputElement>('[data-annotation-id="fresh-read"]')!.click();
            clickWithPointer(exporting.querySelector<HTMLButtonElement>('[data-action="delete"]')!);
            await answerAnnotationDeleteConfirmation(shadow, true);
            expect(await observed.pending[0]).toEqual([]);
            expect(remove).not.toHaveBeenCalled();
            expect(list.mock.calls.length).toBeGreaterThan(1);
            expect(panel.getCommentExportContext()?.comments).toHaveLength(1);
            await vi.waitFor(() => expect(exporting.querySelector<HTMLInputElement>('[data-annotation-id="fresh-read"]')?.checked).toBe(true));
            if (scenario === 'newer-revision') {
                expect(panel.getCommentExportContext()?.comments[0]?.revision).toBe(4);
                expect(exporting.textContent).toContain('Edited in another window');
            }
        } finally {
            observed.restore();
            panel.hide();
            list.mockRestore();
            remove.mockRestore();
        }
    });

    it.each([
        ['comment', 'before'], ['comment', 'during'], ['sourceMarkdown', 'during'],
    ] as const)('rejects deleting an annotation whose %s changed %s confirmation', async (field, phase) => {
        const original = seedComment({ id: 'changed', comment: 'Original annotation', sourceMarkdown: 'Original source' });
        const panel = new ReaderPanel();
        setReaderPromptProvider(panel, []);
        const observed = observeExportDeletes(panel);
        try {
            await panel.show([{ id: 'a', userPrompt: 'Q1', content: 'Response' }], 0, 'light');
            const { shadow, exporting } = await openCommentExportFromHeader();
            exporting.querySelector<HTMLInputElement>('[data-annotation-id="changed"]')!.click();
            const changed = { ...original, [field]: 'Changed while confirming', updatedAt: original.updatedAt + 1 };
            if (phase === 'before') seedComment(changed);
            clickWithPointer(exporting.querySelector<HTMLButtonElement>('[data-action="delete"]')!);
            if (phase === 'during') {
                await vi.waitFor(() => expect(shadow.querySelector('.mock-modal[data-kind="warning"]')).toBeTruthy());
                seedComment(changed);
                await answerAnnotationDeleteConfirmation(shadow, true);
            } else {
                expect(shadow.querySelector('.mock-modal[data-kind="warning"]')).toBeNull();
            }
            expect(await observed.pending[0]).toEqual([]);
            expect(listReaderComments(scopeId, 'a')[0]?.[field]).toBe('Changed while confirming');
            await vi.waitFor(() => expect(exporting.querySelector<HTMLInputElement>('[data-annotation-id="changed"]')?.checked).toBe(true));
        } finally {
            observed.restore();
            panel.hide();
        }
    });

    it.each(['message', 'document'] as const)('rejects a pending deletion after the Reader %s changes', async (scope) => {
        seedComment({ id: 'scope-note', comment: 'Keep original annotation' });
        seedComment({ id: 'other-message', itemId: 'b', comment: 'Keep other message' });
        const panel = new ReaderPanel();
        setReaderPromptProvider(panel, []);
        const observed = observeExportDeletes(panel);
        const list = vi.spyOn(readerAnnotationsClient, 'list').mockResolvedValue({ ok: true, data: { entries: [] } });
        try {
            await panel.show([
                { id: 'a', userPrompt: 'Q1', content: 'First response' },
                { id: 'b', userPrompt: 'Q2', content: 'Second response' },
            ], 0, 'light');
            const { shadow, exporting } = await openCommentExportFromHeader();
            exporting.querySelector<HTMLInputElement>('[data-annotation-id="scope-note"]')!.click();
            clickWithPointer(exporting.querySelector<HTMLButtonElement>('[data-action="delete"]')!);
            await vi.waitFor(() => expect(shadow.querySelector('.mock-modal[data-kind="warning"]')).toBeTruthy());
            if (scope === 'message') {
                clickWithPointer(shadow.querySelector<HTMLButtonElement>('[data-action="reader-next"]')!);
            } else {
                await panel.show([{ id: 'a', userPrompt: 'Changed conversation', content: 'New response' }], 0, 'light', {
                    annotationDocument: { platform: 'chatgpt', conversationId: 'different-conversation', title: 'Different conversation' },
                });
            }
            await answerAnnotationDeleteConfirmation(shadow, true);
            expect(await observed.pending[0]).toEqual([]);
            expect(listReaderComments(scopeId, 'a').map((record) => record.id)).toEqual(['scope-note']);
            expect(listReaderComments(scopeId, 'b').map((record) => record.id)).toEqual(['other-message']);
        } finally {
            observed.restore();
            panel.hide();
            list.mockRestore();
        }
    });

    it('lists annotations, switches to text-position order, and opens the selected annotation for editing', async () => {
        const panel = new ReaderPanel();
        const themeOverrides = {
            baseFontScale: 1,
        };
        panel.setAppearance(createAppearanceSnapshot('light', themeOverrides));
        const onChange = vi.fn(async (patch: Partial<AppSettings['reader']>) => {
            panel.setReaderSettings({
                ...DEFAULT_SETTINGS.reader,
                commentExport: patch.commentExport ?? DEFAULT_SETTINGS.reader.commentExport,
            });
            panel.setAppearance(createAppearanceSnapshot('light', themeOverrides));
        });
        panel.setReaderSettingsController({ onChange });
        panel.setCommentExportSettings({
            prompts: [
                { id: 'default', title: 'Default', content: 'Please review the following comments:' },
            ],
            template: [
                { type: 'token', key: 'selected_source' },
            ],
            promptPosition: 'top',
            sortMode: 'created',
        });
        seedComment({
            id: 'later-position',
            sourceMarkdown: 'Later text source',
            comment: 'Created first',
            createdAt: 1,
            updatedAt: 1,
            selectors: {
                textQuote: { exact: '', prefix: '', suffix: '' },
                textPosition: { start: 80, end: 90 },
                domRange: null,
                atomicRefs: [],
            },
        });
        seedComment({
            id: 'earlier-position',
            sourceMarkdown: 'Earlier text source',
            comment: 'Created second',
            createdAt: 2,
            updatedAt: 2,
            selectors: {
                textQuote: { exact: '', prefix: '', suffix: '' },
                textPosition: { start: 5, end: 15 },
                domRange: null,
                atomicRefs: [],
            },
        });

        await panel.show(
            [{ id: 'a', userPrompt: 'Q1', content: 'Before `code` and $x+y$ after' }],
            0,
            'light',
        );

        const host = document.querySelector('#aimd-reader-panel-host') as HTMLElement;
        const shadow = host.shadowRoot as ShadowRoot;
        const listButton = shadow.querySelector<HTMLButtonElement>('[data-action="reader-comment-list"]')!;
        expect(listButton.disabled).toBe(false);

        listButton.click();
        await Promise.resolve();

        let items = Array.from(shadow.querySelectorAll<HTMLElement>('.reader-comment-list__item'));
        expect(items).toHaveLength(2);
        expect(items[0]?.textContent).toContain('Later text source');
        expect(items[1]?.textContent).toContain('Earlier text source');
        const styles = Array.from(shadow.querySelectorAll('style')).map((node) => node.textContent ?? '').join('\n');
        expect(styles).toContain('--_modal-content-max-width: 760px');
        expect(styles).toContain('--_modal-content-max-height: 720px');
        expect(styles).toContain('.reader-comment-list__items');
        expect(styles).toContain('overflow: auto;');
        expect(styles).toContain('overscroll-behavior: contain;');
        const commentListStyles = Array.from(shadow.querySelectorAll('style'))
            .map((node) => node.textContent ?? '')
            .find((css) => css.includes('.reader-comment-list__items')) ?? '';
        expect(commentListStyles).toContain('line-height: var(--aimd-leading-normal);');
        expect(commentListStyles).not.toContain('line-height: 1.4;');
        expect(commentListStyles).not.toContain('line-height: 1.45;');

        shadow.querySelector<HTMLElement>('.reader-body')!.scrollTop = 137;
        shadow.querySelector<HTMLButtonElement>('.reader-comment-list__sort-button[data-sort-mode="position"]')!.click();
        await Promise.resolve();
        await Promise.resolve();

        expect(shadow.querySelector('.reader-comment-list')).toBeTruthy();
        expect(shadow.querySelector<HTMLElement>('.reader-body')?.scrollTop).toBe(137);
        items = Array.from(shadow.querySelectorAll<HTMLElement>('.reader-comment-list__item'));
        expect(items[0]?.textContent).toContain('Earlier text source');
        expect(items[1]?.textContent).toContain('Later text source');
        expect(onChange).toHaveBeenCalledWith({
            commentExport: expect.objectContaining({ sortMode: 'position' }),
        });

        items[0]?.querySelector<HTMLButtonElement>('[data-action="open"]')?.click();
        shadow.querySelector<HTMLElement>('.mock-modal[role="dialog"]')
            ?.dispatchEvent(new Event('animationend', { bubbles: true }));
        await Promise.resolve();

        expect(shadow.querySelector<HTMLElement>('.reader-comment-popover__selection-value')?.textContent).toContain('Earlier text source');
        expect(shadow.querySelector<HTMLTextAreaElement>('.reader-comment-popover__input')?.value).toBe('Created second');
    });

    it('deletes annotations from the list without closing the list', async () => {
        const panel = new ReaderPanel();
        seedComment({
            id: 'delete-me',
            sourceMarkdown: 'Delete this source',
            comment: 'Remove this annotation',
        });
        seedComment({
            id: 'keep-me',
            sourceMarkdown: 'Keep this source',
            comment: 'Keep this annotation',
            createdAt: 2,
            updatedAt: 2,
        });

        await panel.show(
            [{ id: 'a', userPrompt: 'Q1', content: 'Before `code` and $x+y$ after' }],
            0,
            'light',
        );

        const host = document.querySelector('#aimd-reader-panel-host') as HTMLElement;
        const shadow = host.shadowRoot as ShadowRoot;
        shadow.querySelector<HTMLButtonElement>('[data-action="reader-comment-list"]')!.click();
        await Promise.resolve();

        let items = Array.from(shadow.querySelectorAll<HTMLElement>('.reader-comment-list__item'));
        expect(items).toHaveLength(2);
        items[0]?.querySelector<HTMLButtonElement>('[data-action="delete"]')?.click();
        await Promise.resolve();

        expect(shadow.querySelector('.reader-comment-list')).toBeTruthy();
        items = Array.from(shadow.querySelectorAll<HTMLElement>('.reader-comment-list__item'));
        expect(items).toHaveLength(1);
        expect(items[0]?.textContent).toContain('Keep this source');
        expect(listReaderComments(scopeId, 'a').map((record) => record.id)).toEqual(['keep-me']);
    });

    it('opens the annotations list through the shared modal host and moves focus inside it', async () => {
        const panel = new ReaderPanel();
        seedComment({ id: 'focus-note' });
        await panel.show([{ id: 'a', userPrompt: 'Q1', content: 'Answer' }], 0, 'light');

        const host = document.querySelector('#aimd-reader-panel-host') as HTMLElement;
        const shadow = host.shadowRoot as ShadowRoot;
        const trigger = shadow.querySelector<HTMLButtonElement>('[data-action="reader-comment-list"]')!;
        trigger.focus();
        trigger.click();
        await new Promise<void>((resolve) => window.setTimeout(resolve, 0));

        const dialog = shadow.querySelector<HTMLElement>('.mock-modal[role="dialog"]');
        expect(dialog).toBeTruthy();
        expect(dialog?.contains(shadow.activeElement)).toBe(true);
    });

    it('closes only the annotations list when Escape is pressed', async () => {
        const panel = new ReaderPanel();
        seedComment({ id: 'escape-note' });
        await panel.show([{ id: 'a', userPrompt: 'Q1', content: 'Answer' }], 0, 'light');

        const host = document.querySelector('#aimd-reader-panel-host') as HTMLElement;
        const shadow = host.shadowRoot as ShadowRoot;
        shadow.querySelector<HTMLButtonElement>('[data-action="reader-comment-list"]')!.click();
        await Promise.resolve();

        const dialog = shadow.querySelector<HTMLElement>('.mock-modal[role="dialog"]')!;
        dialog.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, composed: true }));
        await Promise.resolve();
        dialog.dispatchEvent(new Event('animationend', { bubbles: true }));
        await Promise.resolve();

        expect(shadow.querySelector('.reader-comment-list')).toBeNull();
        expect(document.querySelector('#aimd-reader-panel-host')).toBe(host);
    });

    it('keeps the delete action outside the annotation open control', async () => {
        const panel = new ReaderPanel();
        seedComment({ id: 'keyboard-delete-note' });
        await panel.show([{ id: 'a', userPrompt: 'Q1', content: 'Answer' }], 0, 'light');

        const host = document.querySelector('#aimd-reader-panel-host') as HTMLElement;
        const shadow = host.shadowRoot as ShadowRoot;
        shadow.querySelector<HTMLButtonElement>('[data-action="reader-comment-list"]')!.click();
        await Promise.resolve();

        const item = shadow.querySelector<HTMLElement>('.reader-comment-list__item')!;
        const openButton = item.querySelector<HTMLButtonElement>('[data-action="open"]');
        const deleteButton = item.querySelector<HTMLButtonElement>('[data-action="delete"]')!;
        expect(openButton).toBeTruthy();
        expect(openButton?.contains(deleteButton)).toBe(false);
        expect(deleteButton.closest('[role="button"]')).toBeNull();
    });

    it('recompiles selected annotations from the latest records and output settings before copying', async () => {
        const { writeText } = setClipboardMock();
        const original = seedComment({ id: 'live', sourceMarkdown: 'Original source', comment: 'Original note' });
        const panel = new ReaderPanel();
        panel.setCommentExportSettings({
            prompts: [{ id: 'first', title: 'First', content: 'First prompt:' }],
            template: [
                { type: 'token', key: 'selected_source' },
                { type: 'text', value: '\n' },
                { type: 'token', key: 'user_comment' },
            ],
        });
        setReaderPromptProvider(panel, [
            { id: 'first', title: 'First', content: 'First prompt:' },
            { id: 'second', title: 'Second', content: 'Second prompt:' },
        ]);
        await panel.show([{ id: 'a', userPrompt: 'Q1', content: 'Response' }], 0, 'light');
        const shadow = document.querySelector<HTMLElement>('#aimd-reader-panel-host')!.shadowRoot!;
        shadow.querySelector<HTMLButtonElement>('[data-action="reader-copy-comments"]')!.click();
        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();
        const exporting = shadow.querySelector<HTMLElement>('.reader-comment-export')!;
        exporting.querySelector<HTMLInputElement>('[data-annotation-id="live"]')!.click();
        const prompt = exporting.querySelector<HTMLSelectElement>('[data-role="prompt-select"]')!;
        prompt.value = 'first';
        prompt.dispatchEvent(new Event('change', { bubbles: true }));
        const initialPreview = exporting.querySelector<HTMLElement>('[data-role="preview"]')!.textContent!;
        expect(initialPreview).toContain('Original note');
        expect(initialPreview).toContain('First prompt:');

        saveReaderComment(scopeId, { ...original, comment: 'Latest note', updatedAt: 2 });
        panel.setCommentExportSettings({
            prompts: [{ id: 'first', title: 'First', content: 'First prompt:' }],
            template: [{ type: 'text', value: 'Changed: ' }, { type: 'token', key: 'user_comment' }],
        });
        exporting.querySelector<HTMLButtonElement>('[data-action="copy"]')!.click();
        await Promise.resolve();
        await Promise.resolve();

        expect(writeText).toHaveBeenCalledWith('First prompt:\n\n1. Changed: Latest note');
        expect(writeText).not.toHaveBeenCalledWith(initialPreview);
        expect(writeText).not.toHaveBeenCalledWith(expect.stringContaining('Second prompt:'));
        expect(listReaderComments(scopeId, 'a')).toHaveLength(1);
        panel.hide();
    });

    it('does not copy an annotation that was removed after it was selected', async () => {
        const { writeText } = setClipboardMock();
        seedComment({ id: 'removed', comment: 'Removed note' });
        seedComment({ id: 'kept', comment: 'Unselected surviving note' });
        const panel = new ReaderPanel();
        setReaderPromptProvider(panel, []);
        await panel.show([{ id: 'a', userPrompt: 'Q1', content: 'Response' }], 0, 'light');
        const shadow = document.querySelector<HTMLElement>('#aimd-reader-panel-host')!.shadowRoot!;
        shadow.querySelector<HTMLButtonElement>('[data-action="reader-copy-comments"]')!.click();
        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();
        const exporting = shadow.querySelector<HTMLElement>('.reader-comment-export')!;
        exporting.querySelector<HTMLInputElement>('[data-annotation-id="removed"]')!.click();
        const copy = exporting.querySelector<HTMLButtonElement>('[data-action="copy"]')!;
        expect(copy.disabled).toBe(false);
        removeReaderComment(scopeId, 'a', 'removed');
        copy.click();
        await Promise.resolve();
        await Promise.resolve();
        expect(writeText).not.toHaveBeenCalled();
        expect(copy.disabled).toBe(true);
        expect(listReaderComments(scopeId, 'a').map(record => record.id)).toEqual(['kept']);
        panel.hide();
    });

    it('ignores an asynchronous copy request when the Reader moves to another message before Prompts load', async () => {
        seedComment({ id: 'first-message', comment: 'First message note' });
        const panel = new ReaderPanel();
        let resolvePrompts!: (prompts: Array<{ id: string; title: string; content: string }>) => void;
        panel.setPromptManagerController({
            onOpenManager: vi.fn(async () => undefined),
            listReaderPrompts: () => new Promise<Array<{ id: string; title: string; content: string }>>(resolve => { resolvePrompts = resolve; }),
        });
        await panel.show([
            { id: 'a', userPrompt: 'Q1', content: 'First response' },
            { id: 'b', userPrompt: 'Q2', content: 'Second response' },
        ], 0, 'light');
        const shadow = document.querySelector<HTMLElement>('#aimd-reader-panel-host')!.shadowRoot!;
        shadow.querySelector<HTMLButtonElement>('[data-action="reader-copy-comments"]')!.click();
        shadow.querySelector<HTMLButtonElement>('[data-action="reader-next"]')!.click();
        resolvePrompts([{ id: 'late', title: 'Late Prompt', content: 'Late instruction' }]);
        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();
        expect(shadow.querySelector('.reader-comment-export')).toBeNull();
        panel.hide();
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
        setReaderPromptProvider(panel, [
            { id: 'default', title: 'Default', content: 'Please revise the content according to my annotations below.' },
        ]);

        await panel.show(
            [{ id: 'a', userPrompt: 'Q1', content: 'Before `code` and $x+y$ after' }],
            0,
            'light',
        );

        const context = panel.getCommentExportContext();
        expect(context).toBeTruthy();
        expect(context?.comments).toEqual([]);
        await expect(context?.listReaderPrompts()).resolves.toEqual([
            { id: 'default', title: 'Default', content: 'Please revise the content according to my annotations below.' },
        ]);
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
            document.dispatchEvent(new Event('pointerup'));
            await Promise.resolve();
            const actionButtons = shadow.querySelectorAll<HTMLButtonElement>('.reader-comment-action__button');
            expect(actionButtons).toHaveLength(3);
            actionButtons[1]!.click();
            await Promise.resolve();
            const textarea = shadow.querySelector<HTMLTextAreaElement>('.reader-comment-popover__input')!;
            textarea.value = text;
            textarea.dispatchEvent(new Event('input', { bubbles: true }));
            shadow.querySelector<HTMLButtonElement>('.reader-comment-popover [data-action="save"]')!.click();
            await vi.waitFor(() => expect((panel as any).commentPopover.isOpen()).toBe(false));
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
        document.dispatchEvent(new Event('pointerup'));
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
        document.dispatchEvent(new Event('pointerup'));
        await Promise.resolve();
        expect(shadow.querySelectorAll('.reader-comment-action__button')).toHaveLength(0);

        document.dispatchEvent(new Event('selectionchange'));
        document.dispatchEvent(new Event('pointerup'));
        await Promise.resolve();
        expect(shadow.querySelectorAll('.reader-comment-action__button')).toHaveLength(0);

        getSelectionSpy.mockRestore();
    });
});
