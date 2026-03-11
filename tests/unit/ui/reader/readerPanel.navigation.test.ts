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

            const counter = shadow.querySelector<HTMLElement>('[data-field="counter"]');
            expect(counter?.textContent).toBe('1/750');

            const active = shadow.querySelector<HTMLButtonElement>('[data-role="dots"] .dot--active');
            expect(active?.title).toBe('1');
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

            const counter = shadow.querySelector<HTMLElement>('[data-field="counter"]');
            expect(counter?.textContent).toBe('3/3');

            const dots = Array.from(shadow.querySelectorAll<HTMLButtonElement>('[data-role="dots"] .dot'));
            const active = dots.find((dot) => dot.classList.contains('dot--active'));

            expect(dots).toHaveLength(3);
            expect(active?.title).toBe('3');
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
            const dots = Array.from(shadow.querySelectorAll<HTMLButtonElement>('[data-role="dots"] .dot'));

            expect(dots[0]?.classList.contains('dot--bookmarked')).toBe(false);
            expect(dots[1]?.classList.contains('dot--bookmarked')).toBe(true);
            expect(dots[1]?.classList.contains('dot--active')).toBe(true);
            expect(dots[2]?.classList.contains('dot--bookmarked')).toBe(true);
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

            const counter = shadow.querySelector<HTMLElement>('[data-field="counter"]');
            expect(counter?.textContent).toBe('2/3');

            host.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
            await Promise.resolve();
            await Promise.resolve();
            expect(counter?.textContent).toBe('3/3');

            host.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
            await Promise.resolve();
            await Promise.resolve();
            expect(counter?.textContent).toBe('2/3');
        } finally {
            panel.hide();
        }
    });
});
