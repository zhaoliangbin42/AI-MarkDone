import { describe, expect, it } from 'vitest';
import { getPanelChromeCss } from '@/ui/content/components/styles/panelChromeCss';

describe('panelChromeCss', () => {
    it('defines shared panel header, footer, and button chrome with canonical panel tokens', () => {
        const css = getPanelChromeCss();

        expect(css).toContain('.panel-window');
        expect(css).toContain('.panel-header');
        expect(css).toContain('.panel-footer');
        expect(css).toContain('.panel-icon-btn');
        expect(css).toContain('.panel-nav-btn');
        expect(css).toContain('.panel-secondary-btn');

        expect(css).toContain('min-height: var(--aimd-panel-header-height);');
        expect(css).toContain('padding: var(--aimd-panel-header-padding-block) var(--aimd-panel-header-padding-inline);');
        expect(css).toContain('gap: var(--aimd-panel-header-gap);');
        expect(css).toContain('gap: var(--aimd-panel-action-gap);');
        expect(css).toContain('min-height: var(--aimd-panel-footer-min-height);');
        expect(css).toContain('padding: var(--aimd-panel-footer-padding-block) var(--aimd-panel-footer-padding-inline);');
        expect(css).toContain('gap: var(--aimd-panel-footer-gap);');
        expect(css).toContain('width: var(--aimd-size-control-icon-panel);');
        expect(css).toContain('width: var(--aimd-size-control-icon-panel-nav);');
        expect(css).toContain('min-height: var(--aimd-size-control-action-panel);');
        expect(css).toContain('width: var(--aimd-size-control-glyph-panel);');
        expect(css).toContain('line-height: var(--aimd-panel-title-line-height);');

        expect(css).toContain('.icon-btn');
        expect(css).toContain('.nav-btn');
        expect(css).toContain('.secondary-btn');
    });
});
