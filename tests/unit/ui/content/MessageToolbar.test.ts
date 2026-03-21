import { describe, expect, it } from 'vitest';
import { MessageToolbar } from '@/ui/content/MessageToolbar';

describe('MessageToolbar', () => {
    it('uses 30px icon buttons in both content and actionbar placements', () => {
        const toolbar = new MessageToolbar('light', [], { showStats: false });
        const shadow = toolbar.getElement().shadowRoot;
        const style = shadow?.querySelector<HTMLStyleElement>('style[data-aimd-style-id="aimd-toolbar-base"]');

        expect(style?.textContent).toContain('.icon-btn {');
        expect(style?.textContent).toContain('width: var(--aimd-size-control-icon-toolbar);');
        expect(style?.textContent).toContain('height: var(--aimd-size-control-icon-toolbar);');
        expect(style?.textContent).toContain(':host([data-aimd-placement="actionbar"]) .icon-btn { width: var(--aimd-size-control-icon-toolbar); height: var(--aimd-size-control-icon-toolbar);');
    });

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

    it('uses canonical hover and menu surface tokens instead of hardcoded black and white mixes', () => {
        const toolbar = new MessageToolbar('light', [], { showStats: false });
        const shadow = toolbar.getElement().shadowRoot;
        const style = shadow?.querySelector<HTMLStyleElement>('style[data-aimd-style-id="aimd-toolbar-base"]');
        const css = style?.textContent ?? '';

        expect(css).toContain('--aimd-button-icon-hover');
        expect(css).toContain('--aimd-button-icon-active');
        expect(css).toContain('--aimd-bg-surface');
        expect(css).not.toContain('#000');
        expect(css).not.toContain('#fff');
    });
});
