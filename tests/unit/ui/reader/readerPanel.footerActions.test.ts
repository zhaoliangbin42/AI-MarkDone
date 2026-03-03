import { describe, expect, it, vi } from 'vitest';
import { ReaderPanel } from '@/ui/content/reader/ReaderPanel';
import { sendIcon } from '@/assets/icons';

describe('ReaderPanel actions placement', () => {
    it('renders footer_left actions into footer container and passes anchor/shadow to handler', async () => {
        const onClick = vi.fn();

        const panel = new ReaderPanel();
        await panel.show([{ id: 'a', userPrompt: 'Q1', content: 'md1' }], 0, 'light', {
            actions: [
                {
                    id: 'send',
                    label: 'Send',
                    icon: sendIcon,
                    placement: 'footer_left',
                    onClick,
                },
            ],
        });

        const host = document.querySelector('#aimd-reader-panel-host') as HTMLElement;
        expect(host).toBeTruthy();
        const shadow = (host as any).shadowRoot as ShadowRoot;
        expect(shadow).toBeTruthy();

        const footerLeft = shadow.querySelector<HTMLElement>('[data-role="footer_left_actions"]');
        expect(footerLeft).toBeTruthy();
        const btn = footerLeft!.querySelector('button') as HTMLButtonElement;
        expect(btn).toBeTruthy();

        btn.click();
        expect(onClick).toHaveBeenCalledTimes(1);
        const ctx = onClick.mock.calls[0][0];
        expect(ctx.anchorEl).toBe(btn);
        expect(ctx.shadow).toBe(shadow);

        panel.hide();
    });
});

