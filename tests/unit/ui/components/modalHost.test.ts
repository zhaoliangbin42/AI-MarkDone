import { describe, expect, it, vi } from 'vitest';
import { ModalHost } from '@/ui/content/components/ModalHost';
import { getModalHostCss } from '@/ui/content/components/styles/modalHostCss';

async function flushMotionFrames(): Promise<void> {
    await new Promise<void>((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
    });
}

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
        const modalRoot = document.createElement('div');
        modalRoot.dataset.role = 'overlay-modal-root';
        shadow.appendChild(modalRoot);
        document.body.appendChild(host);

        const modal = new ModalHost(modalRoot);
        const resultPromise = modal.confirm({
            kind: 'warning',
            title: 'Delete folder',
            message: 'Used before destructive actions.',
            confirmText: 'Delete',
            cancelText: 'Cancel',
            danger: true,
        });

        await Promise.resolve();

        const dialog = modalRoot.querySelector<HTMLElement>('.mock-modal[data-kind="warning"]');
        expect(dialog).toBeTruthy();
        expect(modalRoot.querySelector('.mock-modal-host')).toBeTruthy();
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
        const modalRoot = document.createElement('div');
        modalRoot.dataset.role = 'overlay-modal-root';
        shadow.appendChild(modalRoot);
        document.body.appendChild(host);

        const modal = new ModalHost(modalRoot);
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

        const dialog = modalRoot.querySelector<HTMLElement>('.mock-modal[data-kind="info"]');
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
        const modalRoot = document.createElement('div');
        modalRoot.dataset.role = 'overlay-modal-root';
        shadow.appendChild(modalRoot);
        document.body.appendChild(host);

        const documentClick = vi.fn();
        const documentInput = vi.fn();
        const documentFocusIn = vi.fn();
        const documentKeydown = vi.fn();
        document.addEventListener('click', documentClick);
        document.addEventListener('input', documentInput);
        document.addEventListener('focusin', documentFocusIn);
        document.addEventListener('keydown', documentKeydown);

        const modal = new ModalHost(modalRoot);
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
            const dialog = modalRoot.querySelector<HTMLElement>('.mock-modal[data-kind="info"]');
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

    it('closes only the topmost modal on Escape and restores focus to the previously active element', async () => {
        const host = document.createElement('div');
        const shadow = host.attachShadow({ mode: 'open' });
        const modalRoot = document.createElement('div');
        modalRoot.dataset.role = 'overlay-modal-root';
        shadow.appendChild(modalRoot);
        document.body.appendChild(host);

        const trigger = document.createElement('button');
        document.body.appendChild(trigger);
        trigger.focus();

        const modal = new ModalHost(modalRoot);
        const outerPromise = modal.confirm({
            kind: 'warning',
            title: 'Outer',
            message: 'Outer modal',
            confirmText: 'Confirm',
            cancelText: 'Cancel',
        });
        await Promise.resolve();

        const innerPromise = modal.confirm({
            kind: 'info',
            title: 'Inner',
            message: 'Inner modal',
            confirmText: 'Close',
            cancelText: 'Back',
        });
        await Promise.resolve();

        const overlaysBefore = modalRoot.querySelectorAll('.mock-modal-overlay');
        expect(overlaysBefore).toHaveLength(2);

        const topDialog = modalRoot.querySelectorAll<HTMLElement>('.mock-modal')[1];
        topDialog.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, composed: true }));
        await Promise.resolve();

        const topOverlay = modalRoot.querySelectorAll<HTMLElement>('.mock-modal-overlay')[1];
        expect(topOverlay?.dataset.motionState).toBe('closing');
        topDialog.dispatchEvent(new Event('animationend', { bubbles: true }));
        await Promise.resolve();

        expect(modalRoot.querySelectorAll('.mock-modal-overlay')).toHaveLength(1);
        await expect(innerPromise).resolves.toBe(false);

        const outerDialog = modalRoot.querySelector<HTMLElement>('.mock-modal');
        outerDialog?.dispatchEvent(
            new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, composed: true }),
        );
        await Promise.resolve();
        expect(modalRoot.querySelector<HTMLElement>('.mock-modal-overlay')?.dataset.motionState).toBe('closing');
        outerDialog?.dispatchEvent(new Event('animationend', { bubbles: true }));
        await Promise.resolve();

        await expect(outerPromise).resolves.toBe(false);
        expect(document.activeElement).toBe(trigger);
    });

    it('marks modal overlays as closing before removing them after animation end', async () => {
        const host = document.createElement('div');
        const shadow = host.attachShadow({ mode: 'open' });
        const modalRoot = document.createElement('div');
        shadow.appendChild(modalRoot);
        document.body.appendChild(host);

        const modal = new ModalHost(modalRoot);
        const resultPromise = modal.confirm({
            kind: 'info',
            title: 'Close me',
            message: 'Animate out',
            confirmText: 'OK',
            cancelText: 'Cancel',
        });

        await Promise.resolve();

        const overlay = modalRoot.querySelector<HTMLElement>('.mock-modal-overlay');
        const dialog = modalRoot.querySelector<HTMLElement>('.mock-modal');
        expect(overlay?.dataset.motionState).toBe('opening');
        expect(dialog?.dataset.motionState).toBe('opening');

        await flushMotionFrames();

        expect(overlay?.dataset.motionState).toBe('open');
        expect(dialog?.dataset.motionState).toBe('open');

        overlay?.querySelector<HTMLButtonElement>('[data-action="modal-cancel"]')?.click();
        expect(overlay?.dataset.motionState).toBe('closing');
        expect(dialog?.dataset.motionState).toBe('closing');
        expect(modalRoot.querySelector('.mock-modal-overlay')).toBeTruthy();

        dialog?.dispatchEvent(new Event('animationend', { bubbles: true }));
        await expect(resultPromise).resolves.toBe(false);
        expect(modalRoot.querySelector('.mock-modal-overlay')).toBeNull();
    });

    it('keeps the modal open when text selection starts inside the dialog and releases on the overlay', async () => {
        const host = document.createElement('div');
        const shadow = host.attachShadow({ mode: 'open' });
        const modalRoot = document.createElement('div');
        shadow.appendChild(modalRoot);
        document.body.appendChild(host);

        const modal = new ModalHost(modalRoot);
        void modal.confirm({
            kind: 'info',
            title: 'Selectable content',
            message: 'Drag selection from here.',
            confirmText: 'OK',
            cancelText: 'Cancel',
        });

        await Promise.resolve();

        const overlay = modalRoot.querySelector<HTMLElement>('.mock-modal-overlay')!;
        const dialog = modalRoot.querySelector<HTMLElement>('.mock-modal')!;
        dialog.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, composed: true }));
        overlay.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true }));

        expect(modalRoot.querySelector('.mock-modal-overlay')).toBeTruthy();
        expect(overlay.dataset.motionState).not.toBe('closing');

        overlay.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, composed: true }));
        overlay.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true }));

        expect(overlay.dataset.motionState).toBe('closing');
    });
});
