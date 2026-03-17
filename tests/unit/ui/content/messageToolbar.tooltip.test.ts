import { describe, expect, it } from 'vitest';
import { MessageToolbar } from '@/ui/content/MessageToolbar';

describe('MessageToolbar tooltip integration', () => {
    it('keeps native title tooltips on icon-only toolbar buttons', () => {
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

        expect(button?.getAttribute('title')).toBe('Copy markdown');
        expect(button?.dataset.tooltip).toBeUndefined();
        toolbar.getElement().remove();
    });
});
