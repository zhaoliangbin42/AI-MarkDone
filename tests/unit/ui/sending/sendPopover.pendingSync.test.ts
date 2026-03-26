import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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

import { SendPopover } from '@/ui/content/sending/SendPopover';

describe('SendPopover send completion', () => {
    beforeEach(() => {
        mocks.sendText.mockReset();
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
        document.body.innerHTML = '';
    });

    it('closes promptly after sendText succeeds without waiting for native recovery', async () => {
        mocks.sendText.mockResolvedValue({ ok: true });

        const host = document.createElement('div');
        const shadow = host.attachShadow({ mode: 'open' });
        const panel = document.createElement('div');
        panel.className = 'panel-window panel-window--reader';
        const footerLeft = document.createElement('div');
        footerLeft.className = 'reader-footer__left';
        footerLeft.setAttribute('data-role', 'footer-left-actions');
        panel.appendChild(footerLeft);
        shadow.appendChild(panel);

        const adapter = {
            getComposerInputElement: () => document.createElement('textarea'),
        } as any;

        const popover = new SendPopover();
        popover.open({ shadow, anchor: footerLeft, adapter, theme: 'light', initialText: 'hello' });

        const sendButton = footerLeft.querySelector<HTMLButtonElement>('[data-action="send"]')!;
        sendButton.click();
        await Promise.resolve();
        await Promise.resolve();

        vi.advanceTimersByTime(130);
        await Promise.resolve();

        expect(footerLeft.querySelector('[data-action="send"]')).toBeNull();
    });
});
