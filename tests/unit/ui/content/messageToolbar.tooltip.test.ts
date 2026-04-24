import { describe, expect, it, vi } from 'vitest';
import { MessageToolbar } from '@/ui/content/MessageToolbar';

describe('MessageToolbar tooltip integration', () => {
    it('renders toolbar-local hover feedback instead of delegated or native title tooltips', () => {
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
        expect(button?.dataset.tooltip).toBeUndefined();

        button?.dispatchEvent(new Event('mouseenter', { bubbles: true }));
        vi.advanceTimersByTime(99);
        expect(button?.querySelector('[data-role="toolbar-tooltip"]')).toBeNull();

        vi.advanceTimersByTime(1);
        const feedback = button?.querySelector<HTMLElement>('[data-role="toolbar-tooltip"]');
        expect(feedback?.textContent).toBe('Copy markdown');
        expect(feedback?.dataset.placement).toBe('top');
        expect(document.querySelector('.aimd-tooltip')).toBeNull();

        button?.dispatchEvent(new Event('mouseleave', { bubbles: true }));
        expect(button?.querySelector('[data-role="toolbar-tooltip"]')).toBeNull();

        toolbar.getElement().remove();
        vi.useRealTimers();
    });
});
