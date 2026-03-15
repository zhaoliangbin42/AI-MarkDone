import { afterEach, describe, expect, it, vi } from 'vitest';
import { ReaderPanel } from '@/ui/content/reader/ReaderPanel';
import { locateIcon, sendIcon } from '@/assets/icons';
import { SendPopover } from '@/ui/content/sending/SendPopover';

describe('ReaderPanel actions placement', () => {
    afterEach(() => {
        document.querySelector('#aimd-reader-panel-host')?.remove();
    });

    it('renders footer as left actions, centered pager, and right meta info', async () => {
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

            const footer = shadow.querySelector<HTMLElement>('.reader-footer');
            const footerLeft = shadow.querySelector<HTMLElement>('.reader-footer__left');
            const pagerCore = shadow.querySelector<HTMLElement>('.reader-footer__center');
            const dots = shadow.querySelector<HTMLElement>('.reader-dots');
            const pagerCounter = shadow.querySelector<HTMLElement>('.reader-header-page');
            const hint = shadow.querySelector<HTMLElement>('.reader-footer__meta .hint');
            const footerMeta = shadow.querySelector<HTMLElement>('.reader-footer__meta');

            expect(footer).toBeTruthy();
            expect(footerLeft).toBeTruthy();
            expect(pagerCore).toBeTruthy();
            expect(pagerCounter?.textContent).toBe('2/2');
            expect(hint?.textContent).toBe('');
            expect(pagerCore?.contains(dots as Node)).toBe(true);
            expect(footerMeta).toBeTruthy();
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

            const footerLeft = shadow.querySelector<HTMLElement>('.reader-footer__left');
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

    it('renders send and locate actions together in the footer-left action cluster', async () => {
        const panel = new ReaderPanel();
        try {
            await panel.show([{ id: 'a', userPrompt: 'Q1', content: 'md1' }], 0, 'light', {
                actions: [
                    { id: 'send', label: 'Send', icon: sendIcon, placement: 'footer_left', onClick: vi.fn() },
                    { id: 'locate', label: 'Locate', icon: locateIcon, placement: 'footer_left', onClick: vi.fn() },
                ],
            });

            const host = document.querySelector('#aimd-reader-panel-host') as HTMLElement;
            const shadow = (host as any).shadowRoot as ShadowRoot;
            const footerLeft = shadow.querySelector<HTMLElement>('.reader-footer__left');
            const buttons = Array.from(footerLeft?.querySelectorAll('button') ?? []);

            expect(buttons).toHaveLength(2);
        } finally {
            panel.hide();
        }
    });

    it('does not destroy an anchored footer overlay when an action opts out of rerender', async () => {
        const panel = new ReaderPanel();
        try {
            await panel.show([{ id: 'a', userPrompt: 'Q1', content: 'md1' }], 0, 'light', {
                actions: [
                    {
                        id: 'send_like',
                        label: 'Send',
                        icon: sendIcon,
                        placement: 'footer_left',
                        rerenderOnClick: false,
                        onClick: ({ anchorEl }) => {
                            const anchor = anchorEl?.closest('.reader-footer__left') as HTMLElement | null;
                            const overlay = document.createElement('div');
                            overlay.className = 'send-popover';
                            anchor?.appendChild(overlay);
                        },
                    },
                ],
            });

            const host = document.querySelector('#aimd-reader-panel-host') as HTMLElement;
            const shadow = (host as any).shadowRoot as ShadowRoot;
            const footerLeft = shadow.querySelector<HTMLElement>('.reader-footer__left')!;
            const btn = footerLeft.querySelector('button') as HTMLButtonElement;

            btn.click();

            expect(footerLeft.querySelector('.send-popover')).toBeTruthy();
        } finally {
            panel.hide();
        }
    });

    it('keeps the real send popover mounted through the reader footer action seam', async () => {
        const panel = new ReaderPanel();
        const popover = new SendPopover();
        const adapter = {
            getComposerInputElement: () => null,
            getComposerSendButtonElement: () => null,
        } as any;

        try {
            await panel.show([{ id: 'a', userPrompt: 'Q1', content: 'md1' }], 0, 'light', {
                actions: [
                    {
                        id: 'send',
                        label: 'Send',
                        icon: sendIcon,
                        placement: 'footer_left',
                        rerenderOnClick: false,
                        onClick: ({ anchorEl, shadow }) => {
                            if (!anchorEl || !shadow) return;
                            popover.open({ shadow, anchor: anchorEl.parentElement as HTMLElement, adapter, theme: 'light', initialText: 'hello' });
                        },
                    },
                ],
            });

            const host = document.querySelector('#aimd-reader-panel-host') as HTMLElement;
            const shadow = (host as any).shadowRoot as ShadowRoot;
            const footerLeft = shadow.querySelector<HTMLElement>('.reader-footer__left')!;
            const btn = footerLeft.querySelector('button') as HTMLButtonElement;

            btn.click();

            expect(footerLeft.querySelector('.send-popover')).toBeTruthy();
            expect(footerLeft.querySelector<HTMLTextAreaElement>('.send-popover .send-popover__input')?.value).toBe('hello');
        } finally {
            panel.hide();
        }
    });

    it('keeps prev and next buttons hugging the centered pager core', async () => {
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

            const styles = Array.from(shadow.querySelectorAll('style')).map((node) => node.textContent || '').join('\n');
            expect(styles).toContain('.reader-footer__center {');
            expect(styles).toContain('.reader-footer__meta {');
            expect(shadow.querySelector('[data-action="reader-prev"] svg')).toBeTruthy();
            expect(shadow.querySelector('[data-action="reader-next"] svg')).toBeTruthy();
        } finally {
            panel.hide();
        }
    });

    it('keeps the pager core visible for a single-page reader with one active dot', async () => {
        const panel = new ReaderPanel();
        try {
            await panel.show([{ id: 'a', userPrompt: 'Q1', content: 'md1' }], 0, 'light');

            const host = document.querySelector('#aimd-reader-panel-host') as HTMLElement;
            const shadow = (host as any).shadowRoot as ShadowRoot;

            const pagerCore = shadow.querySelector<HTMLElement>('.reader-footer__center');
            const dots = Array.from(shadow.querySelectorAll<HTMLButtonElement>('.reader-dots .reader-dot'));
            const counter = shadow.querySelector<HTMLElement>('.reader-header-page');
            const prev = shadow.querySelector<HTMLButtonElement>('[data-action="reader-prev"]');
            const next = shadow.querySelector<HTMLButtonElement>('[data-action="reader-next"]');

            expect(pagerCore).toBeTruthy();
            expect(pagerCore?.style.display).not.toBe('none');
            expect(dots).toHaveLength(1);
            expect(dots[0]?.classList.contains('reader-dot--active')).toBe(true);
            expect(counter?.textContent).toBe('1/1');
            expect(prev?.disabled).toBe(true);
            expect(next?.disabled).toBe(true);
        } finally {
            panel.hide();
        }
    });
});
