import { describe, expect, it } from 'vitest';
import { ModalHost } from '@/ui/content/components/ModalHost';

describe('ModalHost', () => {
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

        input!.value = '';
        dialog?.querySelector<HTMLButtonElement>('[data-action="modal-confirm"]')?.click();
        expect(dialog?.querySelector<HTMLElement>('.mock-modal__error')?.textContent).toBe('Required');

        input!.value = 'Research/Inbox';
        dialog?.querySelector<HTMLButtonElement>('[data-action="modal-confirm"]')?.click();
        await expect(resultPromise).resolves.toBe('Research/Inbox');
    });
});
