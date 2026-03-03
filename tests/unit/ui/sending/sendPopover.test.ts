import { describe, expect, it } from 'vitest';
import { SendPopover } from '@/ui/content/sending/SendPopover';

describe('SendPopover', () => {
    it('opens and closes on outside click / ESC', () => {
        const host = document.createElement('div');
        const shadow = host.attachShadow({ mode: 'open' });

        const panel = document.createElement('div');
        panel.className = 'panel';
        const footerLeft = document.createElement('div');
        footerLeft.className = 'footer-left';
        footerLeft.setAttribute('data-role', 'footer_left_actions');
        panel.appendChild(footerLeft);
        shadow.appendChild(panel);

        const anchor = document.createElement('div');
        footerLeft.appendChild(anchor);

        const adapter = {
            getComposerInputElement: () => null,
            getComposerSendButtonElement: () => null,
        } as any;

        const pop = new SendPopover();
        pop.open({ shadow, anchor: footerLeft, adapter, theme: 'light', initialText: 'hi' });
        expect(footerLeft.querySelector('.aimd-send-popover')).toBeTruthy();

        // ESC closes (bubble is mounted as child of footerLeft)
        const el = footerLeft.querySelector('.aimd-send-popover') as HTMLElement;
        el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
        expect(footerLeft.querySelector('.aimd-send-popover')).toBeNull();

        // Reopen and close via outside click.
        pop.open({ shadow, anchor: footerLeft, adapter, theme: 'light', initialText: 'hi' });
        expect(footerLeft.querySelector('.aimd-send-popover')).toBeTruthy();
        const outside = document.createElement('div');
        shadow.appendChild(outside);
        outside.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }));
        expect(footerLeft.querySelector('.aimd-send-popover')).toBeNull();
    });
});

