import { afterEach, describe, expect, it, vi } from 'vitest';

import { ReaderCommentExportPopover } from '@/ui/content/reader/ReaderCommentExportPopover';
import { getFlatWorkflowCss } from '@/ui/content/components/styles/flatWorkflowCss';

function createHost(): { host: HTMLElement; shadow: ShadowRoot; container: HTMLElement } {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const shadow = host.attachShadow({ mode: 'open' });
    const container = document.createElement('div');
    container.className = 'panel-window--reader';
    shadow.appendChild(container);
    return { host, shadow, container };
}

function deferred<T>() {
    let resolve!: (value: T) => void;
    let reject!: (reason: unknown) => void;
    const promise = new Promise<T>((done, fail) => { resolve = done; reject = fail; });
    return { promise, resolve, reject };
}

function openSelection(operations: {
    onCopy?: () => Promise<boolean>;
    onDelete?: (ids: string[]) => Promise<string[]>;
} = {}) {
    const { shadow, container } = createHost();
    const popover = new ReaderCommentExportPopover();
    const onChange = vi.fn((ids: string[]) => popover.update({ preview: ids.join('\n'), canCopy: ids.length > 0 }));
    const onPrompt = vi.fn();
    popover.open({
        shadow, container, theme: 'light', preview: '', canCopy: false,
        annotationSelection: {
            options: ['a', 'b', 'c'].map(id => ({ id, comment: `Note ${id}`, source: `Source ${id}` })),
            label: 'Choose annotations', selectAllLabel: 'Select all',
            countLabel: (selected, total) => `${selected}/${total} selected`,
            copyLabel: count => `Copy ${count}`, deleteLabel: count => `Delete ${count}`, onChange,
        },
        promptSelection: {
            options: [{ id: 'review', title: 'Review' }], label: 'Optional Prompt', emptyLabel: 'No Prompt', onSelect: onPrompt,
        },
        onCopy: operations.onCopy ?? vi.fn(async () => true), onDelete: operations.onDelete,
    });
    return {
        shadow, container, popover, onChange, onPrompt,
        note: (id: string) => shadow.querySelector<HTMLInputElement>(`[data-annotation-id="${id}"]`)!,
        copy: shadow.querySelector<HTMLButtonElement>('[data-action="copy"]')!,
        remove: shadow.querySelector<HTMLButtonElement>('[data-action="delete"]'),
        prompt: shadow.querySelector<HTMLSelectElement>('[data-role="prompt-select"]')!,
    };
}

describe('ReaderCommentExportPopover', () => {
    afterEach(() => {
        vi.useRealTimers();
        document.body.innerHTML = '';
    });

    it('renders a compiled preview and copy action without configuration fields', () => {
        const { shadow, container } = createHost();
        const popover = new ReaderCommentExportPopover();
        const onCopy = vi.fn(async () => true);

        popover.open({
            shadow,
            container,
            theme: 'light',
            preview: 'Header\n\n1. Compiled comment',
            canCopy: true,
            onCopy,
            labels: {
                title: 'Copy comments',
                copy: 'Copy comments',
                empty: 'No comments yet.',
            },
        });

        const preview = shadow.querySelector<HTMLElement>('[data-role="preview"]');
        const copyButton = shadow.querySelector<HTMLButtonElement>('[data-action="copy"]');
        const closeButton = shadow.querySelector<HTMLButtonElement>('[data-action="close"]');

        expect(preview?.textContent).toContain('1. Compiled comment');
        expect(copyButton?.className).toContain('secondary-btn');
        expect(copyButton?.className).toContain('secondary-btn--primary');
        expect(closeButton?.className).toContain('icon-btn');
        expect(shadow.querySelector('[data-role="userPrompt"]')).toBeNull();
        expect(shadow.querySelector('[data-role="commentTemplate"]')).toBeNull();
        expect(shadow.querySelector('[data-action="insert-selected-source"]')).toBeNull();

        copyButton?.click();
        expect(onCopy).toHaveBeenCalledTimes(1);
    });

    it('keeps the copy icon intact when the success label is shown and restored', async () => {
        vi.useFakeTimers();
        const { shadow, container } = createHost();
        const popover = new ReaderCommentExportPopover();
        const onCopy = vi.fn(async () => true);

        popover.open({
            shadow,
            container,
            theme: 'light',
            preview: 'Header\n\n1. Compiled comment',
            canCopy: true,
            onCopy,
            labels: {
                title: 'Copy comments',
                copy: 'Copy comments',
                copied: 'Copied!',
                empty: 'No comments yet.',
            },
        });

        const copyButton = shadow.querySelector<HTMLButtonElement>('[data-action="copy"]')!;
        copyButton.click();
        await Promise.resolve();

        expect(copyButton.querySelector('.aimd-icon svg')).toBeTruthy();
        expect(copyButton.querySelector('[data-role="copy-label"]')?.textContent).toBe('Copied!');

        await vi.advanceTimersByTimeAsync(1200);

        expect(copyButton.querySelector('.aimd-icon svg')).toBeTruthy();
        expect(copyButton.querySelector('[data-role="copy-label"]')?.textContent).toBe('Copy comments');
        vi.useRealTimers();
    });

    it('starts unselected, supports a partial selection, and synchronizes select all without retaining a previous selection', () => {
        const { shadow, container } = createHost();
        const popover = new ReaderCommentExportPopover();
        const onChange = vi.fn((ids: string[]) => {
            popover.update({ preview: ids.join('\n'), canCopy: ids.length > 0 });
        });
        const params = {
            shadow,
            container,
            theme: 'light' as const,
            preview: '',
            canCopy: false,
            annotationSelection: {
                options: [
                    { id: 'first', comment: 'First note', source: 'First source' },
                    { id: 'second', comment: 'Second note', source: 'Second source' },
                    { id: 'third', comment: 'Third note', source: 'Third source' },
                ],
                label: 'Choose annotations',
                selectAllLabel: 'Select all',
                countLabel: (selected: number, total: number) => `${selected}/${total} selected`,
                onChange,
            },
            onCopy: vi.fn(async () => true),
        };
        popover.open(params);
        const inputs = Array.from(shadow.querySelectorAll<HTMLInputElement>('[data-annotation-id]'));
        const selectAll = shadow.querySelector<HTMLInputElement>('[data-role="select-all"]')!;
        const copy = shadow.querySelector<HTMLButtonElement>('[data-action="copy"]')!;

        expect(inputs).toHaveLength(3);
        expect(inputs.every(input => !input.checked)).toBe(true);
        expect(onChange).toHaveBeenLastCalledWith([]);
        expect(copy.disabled).toBe(true);

        inputs[0]!.click();
        inputs[2]!.click();
        expect(onChange).toHaveBeenLastCalledWith(['first', 'third']);
        expect(selectAll.checked).toBe(false);
        expect(selectAll.indeterminate).toBe(true);
        expect(shadow.querySelector('.reader-comment-export__count')?.textContent).toBe('2/3 selected');
        expect(copy.disabled).toBe(false);

        selectAll.click();
        expect(onChange).toHaveBeenLastCalledWith(['first', 'second', 'third']);
        expect(inputs.every(input => input.checked)).toBe(true);
        expect(selectAll.checked).toBe(true);
        expect(selectAll.indeterminate).toBe(false);
        selectAll.click();
        expect(onChange).toHaveBeenLastCalledWith([]);
        expect(copy.disabled).toBe(true);

        inputs[1]!.click();
        popover.open(params);
        expect(Array.from(shadow.querySelectorAll<HTMLInputElement>('[data-annotation-id]')).every(input => !input.checked)).toBe(true);
        expect(shadow.querySelector<HTMLButtonElement>('[data-action="copy"]')!.disabled).toBe(true);
        popover.close(shadow);
    });

    it('allows selected annotations to be copied when the Prompt library is empty', () => {
        const { shadow, container } = createHost();
        const popover = new ReaderCommentExportPopover();
        const onCopy = vi.fn(async () => true);
        popover.open({
            shadow, container, theme: 'light', preview: '', canCopy: false,
            annotationSelection: {
                options: [{ id: 'note', comment: 'Note', source: 'Source' }],
                label: 'Choose annotations', selectAllLabel: 'Select all',
                countLabel: (selected, total) => `${selected}/${total}`,
                onChange: ids => popover.update({ preview: ids.length ? 'Source\nNote' : '', canCopy: ids.length > 0 }),
            },
            promptSelection: { options: [], label: 'Optional Prompt', emptyLabel: 'No Prompt', onSelect: vi.fn() },
            onCopy,
        });

        expect(shadow.querySelector('[data-role="prompt-select"]')).toBeNull();
        shadow.querySelector<HTMLInputElement>('[data-annotation-id="note"]')!.click();
        const copy = shadow.querySelector<HTMLButtonElement>('[data-action="copy"]')!;
        expect(copy.disabled).toBe(false);
        copy.click();
        expect(onCopy).toHaveBeenCalledOnce();
        popover.close(shadow);
    });

    it('keeps Prompt optional and permits clearing a selected Prompt', () => {
        const { shadow, container } = createHost();
        const popover = new ReaderCommentExportPopover();
        const onSelect = vi.fn();
        popover.open({
            shadow, container, theme: 'light', preview: 'Selected note', canCopy: true,
            promptSelection: {
                options: [{ id: 'review', title: 'Review' }], label: 'Optional Prompt', emptyLabel: 'No Prompt', onSelect,
            },
            onCopy: vi.fn(async () => true),
        });
        const select = shadow.querySelector<HTMLSelectElement>('[data-role="prompt-select"]')!;
        const disclosure = select.closest('details')!;
        expect(disclosure.open).toBe(false);
        expect(select.value).toBe('');
        expect(select.options[0]!.disabled).toBe(false);
        expect(onSelect).not.toHaveBeenCalled();
        select.value = 'review';
        select.dispatchEvent(new Event('change', { bubbles: true }));
        expect(onSelect).toHaveBeenLastCalledWith('review');
        select.value = '';
        select.dispatchEvent(new Event('change', { bubbles: true }));
        expect(onSelect).toHaveBeenLastCalledWith('');
        expect(disclosure.querySelector('summary')?.textContent).toBe('Optional Prompt');
        popover.close(shadow);
    });

    it('uses shared flat workflow styling and keeps preview secondary to the copy action', () => {
        const { shadow, container } = createHost();
        const popover = new ReaderCommentExportPopover();
        popover.open({ shadow, container, theme: 'light', preview: 'Note', canCopy: true, onCopy: vi.fn(async () => true) });
        expect(shadow.querySelector('.reader-comment-export.flat-workflow')).toBeTruthy();
        expect(shadow.querySelector<HTMLStyleElement>('[data-aimd-style-id="aimd-reader-comment-export-style"]')?.textContent)
            .toContain(getFlatWorkflowCss());
        expect(shadow.querySelector<HTMLDetailsElement>('.reader-comment-export__preview-disclosure')?.open).toBe(false);
        expect(shadow.querySelector('[data-role="commentTemplate"]')).toBeNull();
        popover.close(shadow);
    });

    it('retains copied selections and exposes deletion of the current selection with updated action counts', async () => {
        const onCopy = vi.fn(async () => true);
        const view = openSelection({ onCopy, onDelete: vi.fn(async () => []) });
        expect(view.copy.disabled).toBe(true);
        expect(view.remove!.disabled).toBe(true);
        view.note('a').click();
        view.note('b').click();
        expect(view.copy.textContent).toContain('Copy 2');
        expect(view.remove!.textContent).toBe('Delete 2');
        view.copy.click();
        await Promise.resolve();
        expect(onCopy).toHaveBeenCalledOnce();
        expect(view.note('a').checked).toBe(true);
        expect(view.note('b').checked).toBe(true);
        expect(view.copy.textContent).toContain('Copied!');
        expect(view.remove!.disabled).toBe(false);

        view.note('c').click();
        expect(view.copy.textContent).toContain('Copy 3');
        expect(view.remove!.textContent).toBe('Delete 3');
        view.copy.click();
        await Promise.resolve();
        expect(view.copy.textContent).toContain('Copied!');
        view.prompt.value = 'review';
        view.prompt.dispatchEvent(new Event('change', { bubbles: true }));
        expect(view.copy.textContent).toContain('Copy 3');
        view.popover.close(view.shadow);
    });

    it('prevents duplicate copies and concurrent deletion without applying old copy success to changed selection or Prompt', async () => {
        const copying = deferred<boolean>();
        const onCopy = vi.fn(() => copying.promise);
        const onDelete = vi.fn(async () => []);
        const view = openSelection({ onCopy, onDelete });
        view.note('a').click();
        view.copy.click();
        view.copy.click();
        view.remove!.click();
        expect(onCopy).toHaveBeenCalledOnce();
        expect(onDelete).not.toHaveBeenCalled();
        expect(view.copy.disabled).toBe(true);
        expect(view.remove!.disabled).toBe(true);
        expect(view.note('b').disabled).toBe(false);
        view.note('b').click();
        view.prompt.value = 'review';
        view.prompt.dispatchEvent(new Event('change', { bubbles: true }));
        copying.resolve(true);
        await Promise.resolve();
        await Promise.resolve();
        expect(view.copy.textContent).toContain('Copy 2');
        expect(view.copy.textContent).not.toContain('Copied!');
        expect(view.copy.disabled).toBe(false);
        expect(view.note('a').checked).toBe(true);
        expect(view.note('b').checked).toBe(true);
        view.popover.close(view.shadow);
    });

    it('locks deletion and its confirmation focus gap, then retains selection when deletion is cancelled', async () => {
        const deleting = deferred<string[]>();
        const onDelete = vi.fn(() => deleting.promise);
        const view = openSelection({ onDelete });
        view.note('a').click();
        view.note('b').click();
        view.copy.click();
        await Promise.resolve();
        expect(view.copy.textContent).toContain('Copied!');
        view.remove!.click();
        view.remove!.click();
        expect(onDelete).toHaveBeenCalledOnce();
        expect(onDelete).toHaveBeenCalledWith(['a', 'b']);
        expect(Array.from(view.shadow.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')).every(input => input.disabled)).toBe(true);
        expect(view.prompt.disabled).toBe(true);
        expect(view.copy.disabled).toBe(true);
        const close = view.shadow.querySelector<HTMLButtonElement>('[data-action="close"]')!;
        expect(close.disabled).toBe(true);
        close.click();
        const escape = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, composed: true, cancelable: true });
        view.copy.dispatchEvent(escape);
        expect(escape.defaultPrevented).toBe(true);
        document.body.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, composed: true }));
        expect(view.popover.isOpen()).toBe(true);

        deleting.resolve([]);
        await Promise.resolve();
        await Promise.resolve();
        expect(view.note('a').checked).toBe(true);
        expect(view.note('b').checked).toBe(true);
        expect(view.remove!.textContent).toBe('Delete 2');
        expect(view.remove!.disabled).toBe(false);
        expect(close.disabled).toBe(false);
        const closingConfirmation = document.createElement('div');
        closingConfirmation.className = 'mock-modal-host';
        const closingOverlay = document.createElement('div');
        closingOverlay.className = 'mock-modal-overlay';
        closingOverlay.dataset.motionState = 'closing';
        const closingDialog = document.createElement('div');
        closingDialog.className = 'mock-modal';
        closingConfirmation.append(closingOverlay, closingDialog);
        view.shadow.append(closingConfirmation);
        closingOverlay.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, composed: true }));
        closingDialog.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, composed: true }));
        expect(view.popover.isOpen()).toBe(true);
        closingConfirmation.remove();
        view.copy.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, composed: true }));
        expect(view.popover.isOpen()).toBe(false);
    });

    it('removes only successfully deleted requested rows and keeps failed rows selected for retry', async () => {
        const onDelete = vi.fn<(ids: string[]) => Promise<string[]>>()
            .mockResolvedValueOnce(['a', 'c'])
            .mockRejectedValueOnce(new Error('Deletion failed'));
        const view = openSelection({ onDelete });
        view.note('a').click();
        view.note('b').click();
        view.remove!.click();
        await Promise.resolve();
        await Promise.resolve();
        expect(view.shadow.querySelector('[data-annotation-id="a"]')).toBeNull();
        expect(view.note('b').checked).toBe(true);
        expect(view.note('c').checked).toBe(false);
        expect(view.shadow.querySelector('.reader-comment-export__count')?.textContent).toBe('1/2 selected');
        const selectAll = view.shadow.querySelector<HTMLInputElement>('[data-role="select-all"]')!;
        expect(selectAll.indeterminate).toBe(true);
        expect(view.copy.textContent).toContain('Copy 1');
        expect(view.remove!.textContent).toBe('Delete 1');
        expect(view.onChange).toHaveBeenLastCalledWith(['b']);
        expect(view.shadow.querySelector('[data-role="preview"]')?.textContent).toBe('b');

        view.remove!.click();
        await Promise.resolve();
        await Promise.resolve();
        expect(onDelete).toHaveBeenLastCalledWith(['b']);
        expect(view.note('b').checked).toBe(true);
        expect(view.remove!.disabled).toBe(false);
        view.popover.close(view.shadow);
    });

    it('refreshes changed annotation content after a conflict while retaining surviving selections and disclosures', async () => {
        const deleting = deferred<string[]>();
        const view = openSelection({ onDelete: () => deleting.promise });
        view.note('a').click();
        view.note('b').click();
        view.prompt.value = 'review';
        view.prompt.dispatchEvent(new Event('change', { bubbles: true }));
        const promptDetails = view.prompt.closest('details')!;
        const previewDetails = view.shadow.querySelector<HTMLDetailsElement>('.reader-comment-export__preview-disclosure')!;
        promptDetails.open = true;
        previewDetails.open = true;
        view.remove!.click();
        view.popover.update({ annotations: [
            { id: 'b', comment: 'Latest conflicting note', source: 'Latest source' },
            { id: 'c', comment: 'Untouched note', source: 'Untouched source' },
        ] });
        expect(view.shadow.querySelector('[data-annotation-id="a"]')).toBeNull();
        expect(view.note('b').checked).toBe(true);
        expect(view.note('b').closest('label')?.textContent).toContain('Latest conflicting note');
        expect(view.note('c').checked).toBe(false);
        expect(view.note('b').disabled).toBe(true);
        expect(view.copy.disabled).toBe(true);
        expect(view.prompt.value).toBe('review');
        expect(promptDetails.open).toBe(true);
        expect(previewDetails.open).toBe(true);
        deleting.resolve([]);
        await Promise.resolve();
        await Promise.resolve();
        expect(view.note('b').disabled).toBe(false);
        expect(view.note('b').checked).toBe(true);
        expect(view.onChange).toHaveBeenLastCalledWith(['b']);
        view.popover.close(view.shadow);
    });

    it('does not apply an old asynchronous deletion or copy result to a reopened window', async () => {
        const deleting = deferred<string[]>();
        const copying = deferred<boolean>();
        const view = openSelection({ onDelete: () => deleting.promise });
        view.note('a').click();
        view.remove!.click();
        view.popover.close(view.shadow);
        view.popover.open({ shadow: view.shadow, container: view.container, theme: 'light', preview: 'New output', canCopy: true, onCopy: () => copying.promise,
            labels: { copy: 'New copy' } });
        const newCopy = view.shadow.querySelector<HTMLButtonElement>('[data-action="copy"]')!;
        newCopy.click();
        deleting.resolve(['a']);
        await Promise.resolve();
        await Promise.resolve();
        expect(newCopy.disabled).toBe(true);
        expect(view.shadow.querySelector('[data-role="preview"]')?.textContent).toBe('New output');
        view.popover.close(view.shadow);
        view.popover.open({ shadow: view.shadow, container: view.container, theme: 'light', preview: 'Third output', canCopy: true,
            onCopy: vi.fn(async () => true), labels: { copy: 'Third copy' } });
        copying.resolve(true);
        await Promise.resolve();
        await Promise.resolve();
        expect(view.shadow.querySelector('[data-role="copy-label"]')?.textContent).toBe('Third copy');
        expect(view.shadow.querySelector<HTMLButtonElement>('[data-action="copy"]')!.disabled).toBe(false);
        view.popover.close(view.shadow);
    });

    it('cancels old feedback timers when the window is reopened', async () => {
        vi.useFakeTimers();
        const view = openSelection();
        view.note('a').click();
        view.copy.click();
        await Promise.resolve();
        await vi.advanceTimersByTimeAsync(500);
        view.popover.open({ shadow: view.shadow, container: view.container, theme: 'light', preview: 'New output', canCopy: true,
            onCopy: vi.fn(async () => true), labels: { copy: 'New copy' } });
        const newCopy = view.shadow.querySelector<HTMLButtonElement>('[data-action="copy"]')!;
        newCopy.click();
        await Promise.resolve();
        await vi.advanceTimersByTimeAsync(700);
        expect(newCopy.querySelector('[data-role="copy-label"]')?.textContent).toBe('Copied!');
        await vi.advanceTimersByTimeAsync(500);
        expect(newCopy.querySelector('[data-role="copy-label"]')?.textContent).toBe('New copy');
        view.popover.close(view.shadow);
    });
});
