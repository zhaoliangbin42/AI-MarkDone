import { afterEach, describe, expect, it, vi } from 'vitest';
import { ReaderCommentTemplateSettingsPopover } from '@/ui/content/reader/ReaderCommentTemplateSettingsPopover';
import { CommentPromptPickerPopover } from '@/ui/content/components/CommentPromptPickerPopover';
import { ReaderCommentExportPopover } from '@/ui/content/reader/ReaderCommentExportPopover';
import { getFlatWorkflowCss } from '@/ui/content/components/styles/flatWorkflowCss';

const labels = {
    title: 'Annotation export template with a deliberately long readable heading', close: 'Close', template: 'Template',
    templateHint: 'Use the tokens to keep source and annotation content separate.', templatePlaceholder: 'Write a template',
    insertPlaceholder: 'Insert placeholder', insertSelectedSource: 'Selected source', insertUserComment: 'User annotation',
    tokenSelectedSource: 'Selected source', tokenUserComment: 'User annotation', preview: 'Preview',
    restoreDefault: 'Restore the default annotation export template', save: 'Save template', cancel: 'Cancel', copied: 'Copied',
};

function host() {
    const element = document.createElement('div');
    document.body.append(element);
    const shadow = element.attachShadow({ mode: 'open' });
    const parent = document.createElement('div');
    const opener = document.createElement('button');
    shadow.append(opener, parent);
    return { element, shadow, parent, opener };
}

afterEach(() => { document.body.replaceChildren(); });

describe('Reader transient materials', () => {
    it.each(['reader', 'settings'])('owns the same template layout and cancellation from the %s host', (entry) => {
        const { shadow, parent, opener } = host();
        parent.className = entry === 'reader' ? 'reader-settings-popover-layer' : 'aimd-settings';
        const onSave = vi.fn();
        const popover = new ReaderCommentTemplateSettingsPopover();
        opener.focus();
        popover.open({ parent, opener, labels, template: [{ type: 'text', value: 'Original' }], preview: 'Long preview\n'.repeat(100),
            onBuildPreview: () => 'Updated preview', onSave, onRestoreDefault: () => [{ type: 'text', value: 'Default' }] });
        const panel = shadow.querySelector<HTMLElement>('.reader-settings-popover--template')!;
        expect(panel.classList.contains('flat-workflow')).toBe(true);
        expect(panel.parentElement?.classList.contains('reader-settings-popover-layer--template')).toBe(true);
        expect(panel.querySelector('[data-role="commentTemplate"].flat-workflow__input')).toBeTruthy();
        expect(panel.querySelector<HTMLDetailsElement>('.reader-settings-template__preview-disclosure')?.open).toBe(false);
        const style = shadow.querySelector<HTMLStyleElement>('[data-aimd-style-id="aimd-reader-settings-material"]')!;
        expect(style.textContent).toContain(getFlatWorkflowCss());
        const editor = panel.querySelector<HTMLElement>('[data-role="commentTemplate"]')!;
        editor.textContent = 'Unsaved change';
        editor.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
        const cancel = panel.querySelector<HTMLButtonElement>('[data-action="cancel"]')!;
        cancel.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, composed: true }));
        cancel.click();
        expect(onSave).not.toHaveBeenCalled();
        expect(popover.isOpen()).toBe(false);
        expect(shadow.activeElement).toBe(opener);
    });

    it('keeps picker selection alive through pointerdown and dismisses export on an actual outside pointer', () => {
        const { shadow, parent, opener } = host();
        const picker = new CommentPromptPickerPopover();
        const onSelect = vi.fn();
        picker.open({ shadow, container: parent, anchorEl: opener, theme: 'dark', prompts: [{ id: 'p', title: labels.title, content: 'Preview' }], labels: { title: 'Choose Prompt', close: 'Close', empty: 'Empty' }, onSelect });
        const choice = shadow.querySelector<HTMLButtonElement>('.comment-prompt-picker__item')!;
        choice.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, composed: true }));
        expect(picker.isOpen()).toBe(true);
        choice.click();
        expect(onSelect).toHaveBeenCalledWith('p');
        const exporting = new ReaderCommentExportPopover();
        exporting.open({ shadow, container: parent, theme: 'dark', preview: 'Annotation\n'.repeat(100), canCopy: true, onCopy: vi.fn(async () => true) });
        const preview = shadow.querySelector<HTMLElement>('.reader-comment-export__preview')!;
        preview.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, composed: true }));
        expect(exporting.isOpen()).toBe(true);
        opener.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, composed: true }));
        expect(exporting.isOpen()).toBe(false);
    });
});
