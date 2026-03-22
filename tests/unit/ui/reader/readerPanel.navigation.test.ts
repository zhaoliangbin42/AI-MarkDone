import { afterEach, describe, expect, it, vi } from 'vitest';

import { ReaderPanel } from '@/ui/content/reader/ReaderPanel';

function setClipboardMock() {
    const writeText = vi.fn(async () => undefined);
    Object.defineProperty(navigator, 'clipboard', {
        value: { writeText },
        configurable: true,
    });
    return { writeText };
}

describe('ReaderPanel navigation', () => {
    afterEach(() => {
        document.querySelector('#aimd-reader-panel-host')?.remove();
    });

    it('keeps the first pager dot active for large conversations', async () => {
        setClipboardMock();

        const panel = new ReaderPanel();
        const items = Array.from({ length: 750 }, (_, index) => ({
            id: `item-${index}`,
            userPrompt: `Q${index + 1}`,
            content: `md${index + 1}`,
        }));

        try {
            await panel.show(items, 0, 'light');

            const host = document.querySelector('#aimd-reader-panel-host') as HTMLElement;
            const shadow = (host as any).shadowRoot as ShadowRoot;

            const counter = shadow.querySelector<HTMLElement>('.reader-header-page');
            expect(counter?.textContent).toBe('1/750');

            const active = shadow.querySelector<HTMLButtonElement>('.reader-dots .reader-dot--active');
            expect(active?.dataset.tooltipTitle).toBe('1');
        } finally {
            panel.hide();
        }
    });

    it('marks the active bottom pager dot for the current page', async () => {
        setClipboardMock();

        const panel = new ReaderPanel();
        try {
            await panel.show(
                [
                    { id: 'a', userPrompt: 'Q1', content: 'md1' },
                    { id: 'b', userPrompt: 'Q2', content: 'md2' },
                    { id: 'c', userPrompt: 'Q3', content: 'md3' },
                ],
                2,
                'light'
            );

            const host = document.querySelector('#aimd-reader-panel-host') as HTMLElement;
            const shadow = (host as any).shadowRoot as ShadowRoot;

            const counter = shadow.querySelector<HTMLElement>('.reader-header-page');
            expect(counter?.textContent).toBe('3/3');

            const dots = Array.from(shadow.querySelectorAll<HTMLButtonElement>('.reader-dots .reader-dot'));
            const active = dots.find((dot) => dot.classList.contains('reader-dot--active'));

            expect(dots).toHaveLength(3);
            expect(active?.dataset.tooltipTitle).toBe('3');
        } finally {
            panel.hide();
        }
    });

    it('renders bookmarked pages as square dots and keeps the active bookmarked page highlighted', async () => {
        setClipboardMock();

        const panel = new ReaderPanel();
        try {
            await panel.show(
                [
                    { id: 'a', userPrompt: 'Q1', content: 'md1', meta: { position: 1, bookmarked: false } },
                    { id: 'b', userPrompt: 'Q2', content: 'md2', meta: { position: 2, bookmarked: true } },
                    { id: 'c', userPrompt: 'Q3', content: 'md3', meta: { position: 3, bookmarked: true } },
                ],
                1,
                'light'
            );

            const host = document.querySelector('#aimd-reader-panel-host') as HTMLElement;
            const shadow = (host as any).shadowRoot as ShadowRoot;
            const dots = Array.from(shadow.querySelectorAll<HTMLButtonElement>('.reader-dots .reader-dot'));

            expect(dots[0]?.classList.contains('reader-dot--bookmarked')).toBe(false);
            expect(dots[1]?.classList.contains('reader-dot--bookmarked')).toBe(true);
            expect(dots[1]?.classList.contains('reader-dot--active')).toBe(true);
            expect(dots[2]?.classList.contains('reader-dot--bookmarked')).toBe(true);
        } finally {
            panel.hide();
        }
    });

    it('can force plain round pager dots even when items carry bookmark metadata', async () => {
        const panel = new ReaderPanel();
        try {
            await panel.show(
                [
                    { id: 'a', userPrompt: 'Q1', content: 'md1', meta: { position: 1, bookmarked: true } },
                    { id: 'b', userPrompt: 'Q2', content: 'md2', meta: { position: 2, bookmarked: true } },
                ],
                0,
                'light',
                { dotStyle: 'plain' } as any
            );

            const host = document.querySelector('#aimd-reader-panel-host') as HTMLElement;
            const shadow = (host as any).shadowRoot as ShadowRoot;
            const dots = Array.from(shadow.querySelectorAll<HTMLButtonElement>('.reader-dots .reader-dot'));

            expect(dots[0]?.classList.contains('reader-dot--bookmarked')).toBe(false);
            expect(dots[1]?.classList.contains('reader-dot--bookmarked')).toBe(false);
        } finally {
            panel.hide();
        }
    });

    it('supports ArrowLeft and ArrowRight to change pages', async () => {
        setClipboardMock();

        const panel = new ReaderPanel();
        try {
            await panel.show(
                [
                    { id: 'a', userPrompt: 'Q1', content: 'md1' },
                    { id: 'b', userPrompt: 'Q2', content: 'md2' },
                    { id: 'c', userPrompt: 'Q3', content: 'md3' },
                ],
                1,
                'light'
            );

            const host = document.querySelector('#aimd-reader-panel-host') as HTMLElement;
            const shadow = (host as any).shadowRoot as ShadowRoot;

            expect(shadow.querySelector<HTMLElement>('.reader-header-page')?.textContent).toBe('2/3');

            host.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
            await Promise.resolve();
            await new Promise((resolve) => setTimeout(resolve, 0));
            expect(shadow.querySelector<HTMLElement>('.reader-header-page')?.textContent).toBe('3/3');

            host.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
            await Promise.resolve();
            await new Promise((resolve) => setTimeout(resolve, 0));
            expect(shadow.querySelector<HTMLElement>('.reader-header-page')?.textContent).toBe('2/3');
        } finally {
            panel.hide();
        }
    });

    it('shows the current page in the footer and scrolls the active pager dot into view for long conversations', async () => {
        setClipboardMock();
        const scrollIntoView = vi.fn();
        Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
            value: scrollIntoView,
            configurable: true,
        });

        const panel = new ReaderPanel();
        const items = Array.from({ length: 50 }, (_, index) => ({
            id: `item-${index}`,
            userPrompt: `Q${index + 1}`,
            content: `md${index + 1}`,
        }));

        try {
            await panel.show(items, 30, 'light');

            const host = document.querySelector('#aimd-reader-panel-host') as HTMLElement;
            const shadow = (host as any).shadowRoot as ShadowRoot;
            const footerPage = shadow.querySelector<HTMLElement>('.reader-footer__meta .reader-footer-page');
            const dots = shadow.querySelector<HTMLElement>('.reader-dots');
            const styleText = Array.from(shadow.querySelectorAll('style')).map((node) => node.textContent || '').join('\n');
            const dotsRule = styleText.match(/\.reader-dots\s*\{[\s\S]*?\}/)?.[0] ?? '';

            expect(footerPage?.textContent).toBe('31/50');
            expect(dots).toBeTruthy();
            expect(dotsRule).toContain('.reader-dots {');
            expect(dotsRule).toContain('flex-wrap: nowrap;');
            expect(dotsRule).toContain('overflow-y: hidden;');
            expect(dotsRule).toContain('overflow-x: auto;');
            expect(dotsRule).toContain('white-space: nowrap;');
            expect(scrollIntoView).toHaveBeenCalled();
        } finally {
            panel.hide();
        }
    });

    it('renders long-range pager gaps as a dedicated three-dot ellipsis unit instead of plain text', async () => {
        const panel = new ReaderPanel();
        const items = Array.from({ length: 80 }, (_, index) => ({
            id: `item-${index}`,
            userPrompt: `Q${index + 1}`,
            content: `md${index + 1}`,
        }));

        try {
            await panel.show(items, 40, 'light');

            const host = document.querySelector('#aimd-reader-panel-host') as HTMLElement;
            const shadow = (host as any).shadowRoot as ShadowRoot;
            const ellipsis = shadow.querySelector<HTMLElement>('.reader-dots .reader-ellipsis');
            const dots = Array.from(shadow.querySelectorAll<HTMLElement>('.reader-dots .reader-ellipsis__dot'));

            expect(ellipsis).toBeTruthy();
            expect(ellipsis?.textContent).not.toContain('…');
            expect(dots).toHaveLength(6);
        } finally {
            panel.hide();
        }
    });
});
