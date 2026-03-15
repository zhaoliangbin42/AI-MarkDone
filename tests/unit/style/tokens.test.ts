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
