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
        expect(css).toContain('--aimd-ref-type-size-200: 16px;');
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
        expect(css).toContain('--aimd-color-white');
        expect(css).toContain('--aimd-color-success');
        expect(css).toContain('--aimd-bookmark-marker-gradient');
        expect(css).toContain('--aimd-bookmark-marker-glow');
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
        expect(css).toContain('--aimd-panel-title-size');
        expect(css).toContain('--aimd-panel-title-size-compact');
        expect(css).toContain('--aimd-panel-title-weight');
        expect(css).toContain('--aimd-modal-title-size');
        expect(css).toContain('--aimd-modal-title-weight');
        expect(css).toContain('--aimd-panel-title-line-height');
        expect(css).toContain('--aimd-sys-type-panel-title-size: var(--aimd-sys-type-title-large-size);');
        expect(css).toContain('--aimd-sys-type-panel-title-size-compact: var(--aimd-sys-type-title-medium-size);');
        expect(css).toContain('--aimd-sys-type-modal-title-size: var(--aimd-sys-type-title-large-size);');
        expect(css).not.toContain('--aimd-bg-primary: #');
    });

    it('keeps page token export aligned with theme-specific root scopes', async () => {
        const { getPageTokenCss } = await import('@/style/tokens');
        const css = getPageTokenCss();

        expect(css).toContain(':root[data-aimd-theme="light"]');
        expect(css).toContain(':root[data-aimd-theme="dark"]');
        expect(css).toContain('--aimd-sys-color-surface');
    });

    it('increases dark-mode depth separation for surfaces, borders, and interactive layers', () => {
        const css = getTokenCss('dark');

        expect(css).toContain('--aimd-sys-color-surface-frosted: color-mix(in srgb, var(--aimd-sys-color-surface) 34%, transparent);');
        expect(css).toContain('--aimd-sys-color-surface-hover: var(--aimd-ref-color-neutral-alpha-16);');
        expect(css).toContain('--aimd-sys-color-surface-pressed: var(--aimd-ref-color-neutral-alpha-22);');
        expect(css).toContain('--aimd-sys-color-border-default: var(--aimd-ref-color-neutral-alpha-16);');
        expect(css).toContain('--aimd-sys-color-border-strong: var(--aimd-ref-color-neutral-alpha-22);');
        expect(css).toContain('--aimd-sys-color-interactive-hover-layer: var(--aimd-ref-color-white-alpha-16);');
        expect(css).toContain('--aimd-sys-color-interactive-pressed-layer: var(--aimd-ref-color-neutral-alpha-22);');
        expect(css).toContain('--aimd-sys-shadow-lg: var(--aimd-ref-shadow-lg);');
        expect(css).not.toContain('--aimd-sys-color-gmail');
        expect(css).not.toContain('--aimd-gmail');
    });

    it('maps user theme overrides only through generated tokens', () => {
        const css = getTokenCss('light', {
            accentColor: '#0a7',
            density: 'compact',
            baseFontScale: 1.1,
            cornerScale: 1.2,
            readerContentWidthPx: 720,
        });

        expect(css).toContain('--aimd-sys-color-accent: #00aa77;');
        expect(css).toContain('--aimd-sys-size-control-action-panel: var(--aimd-ref-size-320);');
        expect(css).toContain('--aimd-sys-type-body-medium-size: calc(var(--aimd-ref-type-size-200) * 1.1);');
        expect(css).toContain('--aimd-sys-shape-corner-md: calc(var(--aimd-ref-radius-200) * 1.2);');
        expect(css).toContain('--aimd-user-reader-content-width: 720px;');
    });

    it('maps accent overrides across primary, info, focus, and selected theme tokens', () => {
        const css = getTokenCss('light', { accentColor: '#059669' });

        expect(css).toContain('--aimd-sys-color-accent: #059669;');
        expect(css).toContain('--aimd-sys-color-state-info-border: color-mix(in srgb, #059669 35%, transparent);');
        expect(css).toContain('--aimd-sys-color-list-selected: color-mix(in srgb, #059669 14%, transparent);');
        expect(css).toContain('--aimd-sys-color-list-selected-text: #059669;');
        expect(css).toContain('--aimd-focus-ring: var(--aimd-sys-color-focus-ring);');
    });

    it('allows global font size overrides across the 12px to 20px user range', () => {
        const minCss = getTokenCss('light', { baseFontScale: 0.75 });
        const maxCss = getTokenCss('light', { baseFontScale: 1.25 });

        expect(minCss).toContain('--aimd-sys-type-body-medium-size: calc(var(--aimd-ref-type-size-200) * 0.75);');
        expect(maxCss).toContain('--aimd-sys-type-body-medium-size: calc(var(--aimd-ref-type-size-200) * 1.25);');
    });
});
