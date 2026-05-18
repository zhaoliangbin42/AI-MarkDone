import { describe, expect, it, vi } from 'vitest';
import { MessageToolbar } from '@/ui/content/MessageToolbar';

describe('MessageToolbar tooltip integration', () => {
    it('renders delegated tooltip feedback instead of toolbar-local feedback hosts or native title tooltips', () => {
        vi.useFakeTimers();
        const toolbar = new MessageToolbar('light', [
            {
                id: 'copy_markdown',
                label: 'Copy',
                tooltip: 'Copy markdown',
                icon: '<svg viewBox="0 0 16 16"></svg>',
                onClick: async () => ({ ok: true }),
            },
        ]);

        document.body.appendChild(toolbar.getElement());

        const shadow = toolbar.getElement().shadowRoot!;
        const button = shadow.querySelector<HTMLButtonElement>('[data-action="copy_markdown"]');
        expect(button).toBeTruthy();
        expect(button?.getAttribute('title')).toBeNull();
        expect(button?.dataset.tooltip).toBe('Copy markdown');

        button?.dispatchEvent(new Event('pointerover', { bubbles: true, composed: true }));
        vi.advanceTimersByTime(149);
        expect(document.querySelector('.aimd-tooltip')).toBeNull();

        vi.advanceTimersByTime(1);
        const tooltip = document.body.querySelector<HTMLElement>('.aimd-tooltip');
        expect(tooltip?.textContent).toBe('Copy markdown');
        expect(document.querySelector('.aimd-toolbar-tooltip-host')).toBeNull();
        expect(shadow.querySelector('.aimd-tooltip')).toBeNull();

        button?.dispatchEvent(new Event('pointerout', { bubbles: true, composed: true }));
        expect(document.querySelector('.aimd-tooltip')).toBeNull();

        toolbar.getElement().remove();
        vi.useRealTimers();
    });
});
