import { describe, expect, it } from 'vitest';
import { getTokenCss, type UserThemeOverrides } from '@/style/tokens';

describe('global appearance overrides', () => {
    it('ignores Reader-owned and unsupported legacy customization fields', () => {
        const baseline = getTokenCss('light');
        const legacyOverrides = {
            density: 'compact',
            cornerScale: 1.2,
            readerContentWidthPx: 720,
            readerBodyFontSizePx: 18,
        } as unknown as UserThemeOverrides;

        expect(getTokenCss('light', legacyOverrides)).toBe(baseline);
    });
});
