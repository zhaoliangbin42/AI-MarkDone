import { describe, expect, it } from 'vitest';
import { formatAccentRgb, normalizeAccentHex, parseAccentRgb } from '@/core/settings/appearance';
import { DEFAULT_SETTINGS, THEME_ACCENT_SWATCHES } from '@/core/settings/types';
import { createSettingsFile, mergePortableSettings, parseSettingsFile } from '@/core/settings/portableSettings';

describe('Custom accent color', () => {
    it('accepts one RGB hex field without case or hash sensitivity', () => {
        expect(parseAccentRgb('#Ff6699')).toBe('#ff6699');
        expect(parseAccentRgb('ff6699')).toBe('#ff6699');
        expect(formatAccentRgb('#ff6699')).toBe('FF6699');
        expect(parseAccentRgb('rgb(255,0,0)')).toBeNull();
        expect(normalizeAccentHex('url(secret)')).toBeNull();
        expect(THEME_ACCENT_SWATCHES).toHaveLength(8);
    });
    it('round trips custom color and accepts retired entry fields without applying them', () => {
        const file=createSettingsFile({...DEFAULT_SETTINGS,appearance:{...DEFAULT_SETTINGS.appearance,accentColor:'#ff6699'}},'6.0.0');
        expect((file.settings.chatgptBehavior as Record<string,unknown>).showComposerAnnotationControl).toBeUndefined();
        const parsed=parseSettingsFile(JSON.stringify({...file,settings:{...file.settings,chatgptBehavior:{showComposerAnnotationControl:false}}})).file;
        const merged=mergePortableSettings(DEFAULT_SETTINGS,parsed.settings,['appearance','chatgptBehavior']);
        expect(merged.appearance.accentColor).toBe('#ff6699');
        expect(merged.chatgptBehavior.showComposerAnnotationControl).toBe(true);
    });
});
