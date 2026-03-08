import { describe, expect, it } from 'vitest';
import { MessageToolbar } from '@/ui/content/MessageToolbar';

describe('MessageToolbar', () => {
    it('collapses the stats slot while pending so streaming toolbars stay compact', () => {
        const toolbar = new MessageToolbar('light', [], { showStats: true });
        toolbar.setPlacement('content');
        toolbar.setPending(true);
        toolbar.setStats([]);

        const host = toolbar.getElement();
        const shadow = host.shadowRoot;
        const stats = shadow?.querySelector<HTMLElement>('[data-role="stats"]') ?? null;
        const statsSeparator = shadow?.querySelector<HTMLElement>('[data-role="stats-separator"]') ?? null;

        expect(host.getAttribute('data-aimd-pending')).toBe('1');
        expect(stats?.dataset.empty).toBe('1');
        expect(statsSeparator?.hidden).toBe(true);
    });

    it('restores the stats slot after streaming completes', () => {
        const toolbar = new MessageToolbar('light', [], { showStats: true });
        toolbar.setPlacement('content');
        toolbar.setPending(true);
        toolbar.setStats([]);
        toolbar.setPending(false);
        toolbar.setStats(['7 Words', '24 Chars']);

        const host = toolbar.getElement();
        const shadow = host.shadowRoot;
        const stats = shadow?.querySelector<HTMLElement>('[data-role="stats"]') ?? null;
        const statsSeparator = shadow?.querySelector<HTMLElement>('[data-role="stats-separator"]') ?? null;

        expect(host.getAttribute('data-aimd-pending')).toBe('0');
        expect(stats?.dataset.empty).toBe('0');
        expect(stats?.children).toHaveLength(2);
        expect(statsSeparator?.hidden).toBe(false);
    });
});
