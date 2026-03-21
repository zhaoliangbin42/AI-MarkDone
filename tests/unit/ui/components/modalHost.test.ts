import { describe, expect, it, vi } from 'vitest';
import { ModalHost } from '@/ui/content/components/ModalHost';
import { getModalHostCss } from '@/ui/content/components/styles/modalHostCss';

describe('ModalHost', () => {
    it('uses shared modal title and control tokens in the chrome contract', () => {
        const css = getModalHostCss();

        expect(css).toContain('font-size: var(--aimd-modal-title-size);');
        expect(css).toContain('font-weight: var(--aimd-modal-title-weight);');
        expect(css).toContain('width: var(--aimd-size-control-icon-panel);');
        expect(css).toContain('background: var(--aimd-button-icon-hover);');
        expect(css).toContain('background: var(--aimd-button-secondary-hover);');
        expect(css).toContain('min-height: var(--aimd-size-control-action-panel);');
    });

    it('renders the shared mock modal shell for confirm flows and resolves on confirm', async () => {
        const host = document.createElement('div');
        const shadow = host.attachShadow({ mode: 'open' });
        document.body.appendChild(host);

        const modal = new ModalHost(shadow);
        const resultPromise = modal.confirm({
            kind: 'warning',
            title: 'Delete folder',
            message: 'Used before destructive actions.',
            confirmText: 'Delete',
            cancelText: 'Cancel',
            danger: true,
        });

        await Promise.resolve();

        const dialog = shadow.querySelector<HTMLElement>('.mock-modal[data-kind="warning"]');
        expect(dialog).toBeTruthy();
        expect(dialog?.querySelector('.mock-modal__kind-icon')).toBeTruthy();
        expect(dialog?.querySelector('.mock-modal__title-copy strong')?.textContent).toBe('Delete folder');
        expect(dialog?.querySelector('.mock-modal__message')?.textContent).toContain('destructive actions');
        expect(dialog?.querySelector('.mock-modal__button--danger')?.textContent).toBe('Delete');
        expect(shadow.querySelector('style[data-aimd-style-id="aimd-modal-host-structure"]')).toBeTruthy();

        dialog?.querySelector<HTMLButtonElement>('[data-action="modal-confirm"]')?.click();
        await expect(resultPromise).resolves.toBe(true);
    });

    it('renders prompt inputs inside the shared shell and keeps validation errors inline', async () => {
        const host = document.createElement('div');
        const shadow = host.attachShadow({ mode: 'open' });
        document.body.appendChild(host);

        const modal = new ModalHost(shadow);
        const resultPromise = modal.prompt({
            kind: 'info',
            title: 'Create folder',
            message: 'Used for non-destructive input requests.',
            placeholder: 'Folder path',
            defaultValue: 'Research/Archive',
            confirmText: 'Save',
            cancelText: 'Cancel',
            validate: (value) => ({ ok: value.trim().length > 0, message: 'Required' }),
        });

        await Promise.resolve();

        const dialog = shadow.querySelector<HTMLElement>('.mock-modal[data-kind="info"]');
        const input = dialog?.querySelector<HTMLInputElement>('.mock-modal__input');
        expect(dialog).toBeTruthy();
        expect(input?.value).toBe('Research/Archive');
        expect(input?.classList.contains('aimd-field-control')).toBe(true);

        input!.value = '';
        dialog?.querySelector<HTMLButtonElement>('[data-action="modal-confirm"]')?.click();
        expect(dialog?.querySelector<HTMLElement>('.mock-modal__error')?.textContent).toBe('Required');

        input!.value = 'Research/Inbox';
        dialog?.querySelector<HTMLButtonElement>('[data-action="modal-confirm"]')?.click();
        await expect(resultPromise).resolves.toBe('Research/Inbox');
    });

    it('keeps prompt input, focus, and confirm interactions local to the shared modal host', async () => {
        const host = document.createElement('div');
        const shadow = host.attachShadow({ mode: 'open' });
        document.body.appendChild(host);

        const documentClick = vi.fn();
        const documentInput = vi.fn();
        const documentFocusIn = vi.fn();
        const documentKeydown = vi.fn();
        document.addEventListener('click', documentClick);
        document.addEventListener('input', documentInput);
        document.addEventListener('focusin', documentFocusIn);
        document.addEventListener('keydown', documentKeydown);

        const modal = new ModalHost(shadow);
        const resultPromise = modal.prompt({
            kind: 'info',
            title: 'Rename folder',
            message: 'Used for bookmark manager rename prompts.',
            placeholder: 'Folder name',
            defaultValue: 'Inbox',
            confirmText: 'Save',
            cancelText: 'Cancel',
        });

        await Promise.resolve();
        documentClick.mockClear();
        documentInput.mockClear();
        documentFocusIn.mockClear();
        documentKeydown.mockClear();

        try {
            const dialog = shadow.querySelector<HTMLElement>('.mock-modal[data-kind="info"]');
            const input = dialog?.querySelector<HTMLInputElement>('.mock-modal__input');
            expect(input).toBeTruthy();

            input!.value = 'Archive';
            input!.dispatchEvent(new FocusEvent('focusin', { bubbles: true, composed: true }));
            input!.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', bubbles: true, composed: true }));
            input!.dispatchEvent(new Event('input', { bubbles: true, composed: true }));

            expect(documentFocusIn).not.toHaveBeenCalled();
            expect(documentKeydown).not.toHaveBeenCalled();
            expect(documentInput).not.toHaveBeenCalled();

            dialog?.querySelector<HTMLButtonElement>('[data-action="modal-confirm"]')
                ?.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true }));

            expect(documentClick).not.toHaveBeenCalled();
            await expect(resultPromise).resolves.toBe('Archive');
        } finally {
            document.removeEventListener('click', documentClick);
            document.removeEventListener('input', documentInput);
            document.removeEventListener('focusin', documentFocusIn);
            document.removeEventListener('keydown', documentKeydown);
        }
    });
});
