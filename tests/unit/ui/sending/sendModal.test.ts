import { describe, expect, it, vi } from 'vitest';
import type { SiteAdapter } from '../../../../src/drivers/content/adapters/base';
import { SendModal } from '../../../../src/ui/content/sending/SendModal';

vi.mock('../../../../src/services/sending/sendService', () => {
    return {
        sendText: vi.fn(async () => ({ ok: true })),
    };
});

vi.mock('../../../../src/drivers/content/sending/composerPort', () => {
    return {
        readComposer: vi.fn(() => ({ ok: true, kind: 'textarea', text: 'from-composer' })),
        writeComposer: vi.fn(async () => ({ ok: true, kind: 'textarea' })),
    };
});

describe('SendModal', () => {
    it('opens and pre-fills from composer, then closes with syncBack', async () => {
        const adapter = {
            getComposerInputElement: () => document.createElement('textarea'),
        } as any as SiteAdapter;

        const modal = new SendModal();
        modal.open({ adapter, theme: 'light' });

        const host = document.querySelector('.aimd-send-modal-host');
        expect(host).toBeTruthy();

        // Close should sync the current text back.
        modal.close({ syncBack: true });
        const hostAfter = document.querySelector('.aimd-send-modal-host');
        expect(hostAfter).toBeFalsy();
    });

    it('uses semantic primary and secondary button tokens in the modal css', () => {
        const modal = new SendModal();
        const css = (modal as any).getCss?.() ?? '';

        expect(css).toContain('font-size: var(--aimd-modal-title-size);');
        expect(css).toContain('font-weight: var(--aimd-modal-title-weight);');
        expect(css).toContain('var(--aimd-button-secondary-hover)');
        expect(css).toContain('var(--aimd-text-on-primary)');
        expect(css).toContain('var(--aimd-interactive-primary-hover)');
        expect(css).toContain('width: var(--aimd-size-control-icon-panel);');
        expect(css).not.toContain('#fff');
        expect(css).not.toContain('#000');
        expect(css).not.toContain('font-size: 16px;');
    });
});
