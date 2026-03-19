import { describe, expect, it } from 'vitest';
import { getTokenCss } from '@/style/tokens';

describe('tokens', () => {
    it('emits required token variables from the composed token layers', () => {
        const css = getTokenCss('dark');
        expect(css).toContain('--aimd-bg-primary');
        expect(css).toContain('--aimd-text-primary');
        expect(css).toContain('--aimd-border-default');
        expect(css).toContain('--aimd-ref-color-neutral-0');
        expect(css).toContain('--aimd-sys-color-surface');
        expect(css).toContain('--aimd-shadow-xl');
        expect(css).toContain('--aimd-radius-2xl');
        expect(css).toContain('--aimd-radius-full');
        expect(css).toContain('--aimd-text-base');
        expect(css).toContain('--aimd-text-2xl');
        expect(css).toContain('--aimd-interactive-hover');
        expect(css).toContain('--aimd-space-5');
        expect(css).toContain('--aimd-space-6');
        expect(css).toContain('--aimd-panel-wide-max-width');
        expect(css).toContain('--aimd-panel-wide-max-height');
        expect(css).toContain('--aimd-size-control-icon-toolbar');
        expect(css).toContain('--aimd-size-control-icon-panel');
        expect(css).toContain('--aimd-size-control-icon-panel-nav');
        expect(css).toContain('--aimd-size-control-glyph-panel');
        expect(css).toContain('--aimd-size-control-action-panel');
        expect(css).toContain('--aimd-sys-size-control-icon-toolbar: var(--aimd-ref-size-300);');
        expect(css).toContain('--aimd-panel-header-height');
        expect(css).toContain('--aimd-panel-header-height-compact');
        expect(css).toContain('--aimd-sys-size-panel-header-height: var(--aimd-ref-size-720);');
        expect(css).toContain('--aimd-sys-size-panel-header-height-compact: var(--aimd-ref-size-640);');
        expect(css).toContain('--aimd-panel-header-padding-block');
        expect(css).toContain('--aimd-panel-header-padding-inline');
        expect(css).toContain('--aimd-panel-header-padding-block-compact');
        expect(css).toContain('--aimd-panel-header-padding-inline-compact');
        expect(css).toContain('--aimd-panel-header-gap');
        expect(css).toContain('--aimd-panel-action-gap');
        expect(css).toContain('--aimd-panel-footer-min-height');
        expect(css).toContain('--aimd-sys-size-panel-footer-min-height: var(--aimd-ref-size-640);');
        expect(css).toContain('--aimd-panel-footer-padding-block');
        expect(css).toContain('--aimd-panel-footer-padding-inline');
        expect(css).toContain('--aimd-panel-footer-padding-block-compact');
        expect(css).toContain('--aimd-panel-footer-padding-inline-compact');
        expect(css).toContain('--aimd-panel-footer-gap');
        expect(css).toContain('--aimd-panel-title-line-height');
        expect(css).not.toContain('--aimd-bg-primary: #');
    });

    it('keeps page token export aligned with theme-specific root scopes', async () => {
        const { getPageTokenCss } = await import('@/style/tokens');
        const css = getPageTokenCss();

        expect(css).toContain(':root[data-aimd-theme="light"]');
        expect(css).toContain(':root[data-aimd-theme="dark"]');
        expect(css).toContain('--aimd-sys-color-surface');
    });
});
