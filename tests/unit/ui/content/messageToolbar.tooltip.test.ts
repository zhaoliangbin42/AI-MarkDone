import { describe, expect, it, vi } from 'vitest';
import { MessageToolbar } from '@/ui/content/MessageToolbar';

describe('MessageToolbar tooltip integration', () => {
    it('keeps the Main hover sequence stable from the lower Copy tooltip to the upper PNG tooltip', async () => {
        vi.useFakeTimers();
        const onCopyPng = vi.fn(async () => ({ ok: true as const }));
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
                    onClick: onCopyPng,
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
        vi.advanceTimersByTime(100);

        const portalHost = document.querySelector<HTMLElement>('.aimd-toolbar-hover-action-host');
        const actionsRoot = portalHost?.shadowRoot?.querySelector<HTMLElement>('[data-role="toolbar-hover-actions"]');
        const bridge = portalHost?.shadowRoot?.querySelector<HTMLElement>('[data-role="toolbar-hover-bridge"]');
        const secondaryButton = portalHost?.shadowRoot?.querySelector<HTMLButtonElement>('[data-action="copy_png"]');
        expect(portalHost).toBeTruthy();
        expect(actionsRoot?.style.transform).toBe('');
        expect(actionsRoot?.style.opacity).toBe('');
        expect(bridge).toBeTruthy();
        expect(secondaryButton).toBeTruthy();

        vi.advanceTimersByTime(50);
        const triggerTooltip = document.body.querySelector<HTMLElement>('.aimd-tooltip');
        expect(triggerTooltip?.textContent).toBe('Copy markdown');
        expect(triggerTooltip?.dataset.placement).toBe('bottom');
        expect(document.querySelector('.aimd-toolbar-hover-action-host')).toBe(portalHost);
        expect(portalHost?.shadowRoot?.querySelector('[data-action="copy_png"]')).toBe(secondaryButton);

        vi.advanceTimersByTime(180);
        expect(document.querySelector('.aimd-toolbar-hover-action-host')).toBe(portalHost);
        expect(portalHost?.shadowRoot?.querySelector('[data-action="copy_png"]')).toBe(secondaryButton);
        expect(document.body.querySelector<HTMLElement>('.aimd-tooltip')?.textContent).toBe('Copy markdown');

        button?.dispatchEvent(new Event('pointerout', { bubbles: true, composed: true }));
        button?.dispatchEvent(new MouseEvent('mouseleave'));
        expect(document.querySelector('.aimd-tooltip')).toBeNull();
        bridge?.dispatchEvent(new MouseEvent('pointerenter'));
        vi.advanceTimersByTime(120);
        expect(document.querySelector('.aimd-toolbar-hover-action-host')).toBe(portalHost);
        expect(portalHost?.shadowRoot?.querySelector('[data-action="copy_png"]')).toBe(secondaryButton);

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

        secondaryButton?.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, composed: true }));
        secondaryButton?.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true }));
        await Promise.resolve();
        expect(onCopyPng).toHaveBeenCalledTimes(1);

        toolbar.dispose();
        toolbar.getElement().remove();
        vi.useRealTimers();
    });
});
