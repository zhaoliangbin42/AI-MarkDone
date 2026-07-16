import { describe, expect, it } from 'vitest';
import { areAppearanceSnapshotsEqual, createAppearanceSnapshot } from '@/style/appearance';

describe('AppearanceSnapshot', () => {
    it('gives CSS-equivalent appearance inputs one stable fingerprint', () => {
        const shorthand = createAppearanceSnapshot('dark', {
            accentColor: ' #0A7 ',
            baseFontScale: 1.8,
        });
        const canonical = createAppearanceSnapshot('dark', {
            accentColor: '#00aa77',
            baseFontScale: 1.25,
        });

        expect(shorthand.fingerprint).toBe(canonical.fingerprint);
        expect(areAppearanceSnapshotsEqual(shorthand, canonical)).toBe(true);
        expect(shorthand.overrides).toEqual({
            accentColor: '#00aa77',
            baseFontScale: 1.25,
        });
    });
});
