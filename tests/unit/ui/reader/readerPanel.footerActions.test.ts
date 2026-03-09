import { afterEach, describe, expect, it, vi } from 'vitest';
import { ReaderPanel } from '@/ui/content/reader/ReaderPanel';
import { sendIcon } from '@/assets/icons';

describe('ReaderPanel actions placement', () => {
    afterEach(() => {
        document.querySelector('#aimd-reader-panel-host')?.remove();
    });

    it('renders the page counter inside the centered footer pager stack', async () => {
        const panel = new ReaderPanel();
        try {
            await panel.show(
                [
                    { id: 'a', userPrompt: 'Q1', content: 'md1' },
                    { id: 'b', userPrompt: 'Q2', content: 'md2' },
                ],
                1,
                'light'
            );

            const host = document.querySelector('#aimd-reader-panel-host') as HTMLElement;
            expect(host).toBeTruthy();
            const shadow = (host as any).shadowRoot as ShadowRoot;
            expect(shadow).toBeTruthy();

            const headerCounter = shadow.querySelector('.header [data-field="counter"]');
            const pagerCounter = shadow.querySelector('.footer [data-field="counter"]');
            const pagerStack = shadow.querySelector<HTMLElement>('[data-role="pager_stack"]');
            const dots = shadow.querySelector<HTMLElement>('[data-role="dots"]');

            expect(headerCounter).toBeNull();
            expect(pagerCounter?.textContent).toBe('2/2');
            expect(pagerStack).toBeTruthy();
            expect(pagerStack?.contains(pagerCounter as Node)).toBe(true);
            expect(pagerStack?.contains(dots as Node)).toBe(true);
        } finally {
            panel.hide();
        }
    });

    it('renders footer_left actions into footer container and passes anchor/shadow to handler', async () => {
        const onClick = vi.fn();

        const panel = new ReaderPanel();
        try {
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
        } finally {
            panel.hide();
        }
    });

    it('keeps the prev/next navigation anchored to the footer far right', async () => {
        const panel = new ReaderPanel();
        try {
            await panel.show(
                [
                    { id: 'a', userPrompt: 'Q1', content: 'md1' },
                    { id: 'b', userPrompt: 'Q2', content: 'md2' },
                ],
                0,
                'light'
            );

            const host = document.querySelector('#aimd-reader-panel-host') as HTMLElement;
            expect(host).toBeTruthy();
            const shadow = (host as any).shadowRoot as ShadowRoot;
            expect(shadow).toBeTruthy();

            const styles = shadow.querySelector('style')?.textContent ?? '';
            expect(styles).toContain('.nav { grid-column: 4;');
        } finally {
            panel.hide();
        }
    });
});
