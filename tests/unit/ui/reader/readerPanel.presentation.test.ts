import { afterEach, describe, expect, it, vi } from 'vitest';
import { ReaderPanel } from '@/ui/content/reader/ReaderPanel';

describe('ReaderPanel presentation', () => {
    afterEach(() => {
        vi.useRealTimers();
        document.querySelector('#aimd-reader-panel-host')?.remove();
    });

    it('truncates the header title to 40 characters and preserves the full prompt as the tooltip', async () => {
        const panel = new ReaderPanel();
        const longPrompt = '1234567890123456789012345678901234567890-extra prompt';

        try {
            await panel.show([{ id: 'a', userPrompt: longPrompt, content: 'md1' }], 0, 'light');

            const host = document.querySelector('#aimd-reader-panel-host') as HTMLElement;
            const shadow = (host as any).shadowRoot as ShadowRoot;
            const title = shadow.querySelector<HTMLElement>('[data-field="title"]');

            expect(title?.textContent).toBe('1234567890123456789012345678901234567890…');
            expect(title?.title).toBe(longPrompt);
        } finally {
            panel.hide();
        }
    });

    it('shows a delayed prompt preview tooltip when hovering a pager dot', async () => {
        vi.useFakeTimers();
        const panel = new ReaderPanel();

        try {
            await panel.show(
                [
                    { id: 'a', userPrompt: 'First prompt preview', content: 'md1' },
                    { id: 'b', userPrompt: 'Second prompt preview', content: 'md2' },
                ],
                0,
                'light'
            );

            const host = document.querySelector('#aimd-reader-panel-host') as HTMLElement;
            const shadow = (host as any).shadowRoot as ShadowRoot;
            const secondDot = shadow.querySelectorAll<HTMLButtonElement>('[data-role="dots"] .dot')[1]!;

            secondDot.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
            vi.advanceTimersByTime(180);

            const tooltip = secondDot.querySelector<HTMLElement>('.dot-tooltip');
            expect(tooltip).toBeTruthy();
            expect(tooltip?.textContent).toContain('2');
            expect(tooltip?.textContent).toContain('Second prompt preview');
            const styles = shadow.querySelector('style')?.textContent ?? '';
            expect(styles).toContain('max-width: 260px');
            expect(styles).toContain('backdrop-filter: blur(8px)');
            expect(styles).toContain('line-height: 1.4');
            expect(styles).toContain('font-family: var(--aimd-font-family-sans);');
            expect(styles).toContain('font-family: var(--aimd-font-family-mono);');

            secondDot.dispatchEvent(new MouseEvent('mouseleave', { bubbles: true }));
            expect(secondDot.querySelector('.dot-tooltip')).toBeNull();
        } finally {
            panel.hide();
        }
    });
});
