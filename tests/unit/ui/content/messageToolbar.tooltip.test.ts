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
                hoverAction: {
                    id: 'copy_png',
                    label: 'Copy as PNG',
                    icon: '<svg viewBox="0 0 16 16"></svg>',
                    onClick: async () => ({ ok: true }),
                },
            },
        ]);

        document.body.appendChild(toolbar.getElement());

        const shadow = toolbar.getElement().shadowRoot!;
        const button = shadow.querySelector<HTMLButtonElement>('[data-action="copy_markdown"]');
        expect(button).toBeTruthy();
        vi.spyOn(button!, 'getBoundingClientRect').mockReturnValue({
            x: 320,
            y: 240,
            left: 320,
            top: 240,
            width: 30,
            height: 30,
            right: 350,
            bottom: 270,
            toJSON: () => ({}),
        } as DOMRect);
        expect(button?.getAttribute('title')).toBeNull();
        expect(button?.dataset.tooltip).toBe('Copy markdown');
        expect(button?.dataset.tooltipPlacement).toBe('bottom');

        button?.dispatchEvent(new Event('pointerover', { bubbles: true, composed: true }));
        button?.dispatchEvent(new MouseEvent('mouseenter'));
        vi.advanceTimersByTime(149);
        expect(document.querySelector('.aimd-tooltip')).toBeNull();

        vi.advanceTimersByTime(1);
        const tooltip = document.body.querySelector<HTMLElement>('.aimd-tooltip');
        expect(tooltip?.textContent).toBe('Copy markdown');
        expect(tooltip?.dataset.placement).toBe('bottom');
        expect(document.querySelector('.aimd-toolbar-hover-action-host')).not.toBeNull();
        expect(document.querySelector('.aimd-toolbar-tooltip-host')).toBeNull();
        expect(shadow.querySelector('.aimd-tooltip')).toBeNull();

        button?.dispatchEvent(new Event('pointerout', { bubbles: true, composed: true }));
        expect(document.querySelector('.aimd-tooltip')).toBeNull();

        const secondaryButton = document
            .querySelector<HTMLElement>('.aimd-toolbar-hover-action-host')
            ?.shadowRoot
            ?.querySelector<HTMLButtonElement>('[data-action="copy_png"]');
        expect(secondaryButton).toBeTruthy();
        vi.spyOn(secondaryButton!, 'getBoundingClientRect').mockReturnValue({
            x: 320,
            y: 180,
            left: 320,
            top: 180,
            width: 30,
            height: 30,
            right: 350,
            bottom: 210,
            toJSON: () => ({}),
        } as DOMRect);
        secondaryButton?.dispatchEvent(new Event('pointerover', { bubbles: true, composed: true }));
        vi.advanceTimersByTime(150);

        const secondaryTooltip = document.body.querySelector<HTMLElement>('.aimd-tooltip');
        expect(secondaryTooltip?.textContent).toBe('Copy as PNG');
        expect(secondaryTooltip?.dataset.placement).toBe('top');

        toolbar.getElement().remove();
        vi.useRealTimers();
    });
});
