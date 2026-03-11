import { afterEach, describe, expect, it, vi } from 'vitest';
import { ReaderPanel } from '@/ui/content/reader/ReaderPanel';

describe('ReaderPanel presentation', () => {
    afterEach(() => {
        vi.useRealTimers();
        document.querySelector('#aimd-reader-panel-host')?.remove();
    });

    it('truncates the header title to 40 characters and preserves the full prompt in the shared tooltip payload', async () => {
        const panel = new ReaderPanel();
        const longPrompt = '1234567890123456789012345678901234567890-extra prompt';

        try {
            await panel.show([{ id: 'a', userPrompt: longPrompt, content: 'md1' }], 0, 'light');

            const host = document.querySelector('#aimd-reader-panel-host') as HTMLElement;
            const shadow = (host as any).shadowRoot as ShadowRoot;
            const title = shadow.querySelector<HTMLElement>('[data-field="title"]');

            expect(title?.textContent).toBe('1234567890123456789012345678901234567890…');
            expect(title?.dataset.tooltip).toBe(longPrompt);
        } finally {
            panel.hide();
        }
    });

    it('shows a delayed shared preview tooltip when hovering a pager dot', async () => {
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

            secondDot.dispatchEvent(new Event('pointerover', { bubbles: true }));
            vi.advanceTimersByTime(180);

            const tooltip = shadow.querySelector<HTMLElement>('.aimd-tooltip[data-variant="preview"]');
            expect(tooltip).toBeTruthy();
            expect(tooltip?.textContent).toContain('2');
            expect(tooltip?.textContent).toContain('Second prompt preview');
            expect(shadow.querySelector('style[data-aimd-tooltip-style="1"]')).toBeTruthy();

            secondDot.dispatchEvent(new Event('pointerout', { bubbles: true }));
            expect(shadow.querySelector('.aimd-tooltip')).toBeNull();
        } finally {
            panel.hide();
        }
    });
});
