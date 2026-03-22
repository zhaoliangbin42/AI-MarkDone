import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('ModalHost shared interaction contract', () => {
    beforeEach(() => {
        vi.resetModules();
    });

    afterEach(() => {
        vi.resetModules();
        vi.clearAllMocks();
        document.body.innerHTML = '';
    });

    it('does not install a second host-level input boundary or keyboard scope', async () => {
        const installInputEventBoundary = vi.fn(() => () => {});
        const attachDialogKeyboardScope = vi.fn(() => ({ detach: vi.fn() }));

        vi.doMock('@/ui/content/components/inputEventBoundary', () => ({
            installInputEventBoundary,
        }));
        vi.doMock('@/ui/content/components/dialogKeyboardScope', () => ({
            attachDialogKeyboardScope,
        }));

        const { ModalHost } = await import('@/ui/content/components/ModalHost');

        const modalRoot = document.createElement('div');
        document.body.appendChild(modalRoot);

        const host = new ModalHost(modalRoot);
        void host.confirm({
            kind: 'info',
            title: 'Shared modal',
            message: 'Uses shared overlay interaction contract',
            confirmText: 'OK',
            cancelText: 'Cancel',
        });

        await Promise.resolve();

        expect(installInputEventBoundary).not.toHaveBeenCalled();
        expect(attachDialogKeyboardScope).not.toHaveBeenCalled();
    });
});
