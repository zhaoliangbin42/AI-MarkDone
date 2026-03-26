import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SiteAdapter } from '../../../../src/drivers/content/adapters/base';
import { SendModal } from '../../../../src/ui/content/sending/SendModal';

const mocks = vi.hoisted(() => ({
    sendText: vi.fn(),
}));

vi.mock('../../../../src/services/sending/sendService', () => ({
    sendText: mocks.sendText,
}));

vi.mock('../../../../src/drivers/content/sending/composerPort', () => ({
    readComposer: vi.fn(() => ({ ok: true, kind: 'textarea', text: '' })),
    writeComposer: vi.fn(async () => ({ ok: true, kind: 'textarea' })),
}));

describe('SendModal send completion', () => {
    beforeEach(() => {
        mocks.sendText.mockReset();
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
        document.querySelector('.aimd-send-modal-host')?.remove();
    });

    it('closes promptly after sendText succeeds without waiting for native recovery', async () => {
        mocks.sendText.mockResolvedValue({ ok: true });

        const adapter = {
            getComposerInputElement: () => document.createElement('textarea'),
        } as any as SiteAdapter;

        const modal = new SendModal();
        modal.open({ adapter, theme: 'light', initialText: 'hello' });

        const host = document.querySelector('.aimd-send-modal-host') as HTMLElement;
        const shadow = host.shadowRoot!;
        const sendButton = shadow.querySelector<HTMLButtonElement>('[data-action="send"]')!;

        sendButton.click();
        await Promise.resolve();
        await Promise.resolve();

        vi.advanceTimersByTime(160);
        await Promise.resolve();
        expect(
            document
                .querySelector('.aimd-send-modal-host')
                ?.shadowRoot?.querySelector('.dialog')
                ?.getAttribute('data-motion-state'),
        ).toBe('closing');

        vi.advanceTimersByTime(700);
        await Promise.resolve();
        expect(document.querySelector('.aimd-send-modal-host')).toBeNull();
    });
});
