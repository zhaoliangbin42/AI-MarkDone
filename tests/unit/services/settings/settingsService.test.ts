import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS } from '@/core/settings/types';
import { planGetCategory, planSetCategory } from '@/services/settings/settingsService';

describe('settingsService', () => {
    it('rejects legacy performance category writes', () => {
        expect(() => planSetCategory(DEFAULT_SETTINGS, 'performance' as any, { chatgptFoldingMode: 'all' })).toThrow(
            'Invalid category: performance',
        );
    });

    it('rejects legacy performance category reads', () => {
        expect(() => planGetCategory(DEFAULT_SETTINGS as any, 'performance')).toThrow('Invalid category: performance');
    });

    it('ignores removed reader markdown theme writes and preserves the default reader shape', () => {
        const next = planSetCategory(DEFAULT_SETTINGS, 'reader', {
            renderCodeInReader: false,
            markdownTheme: 'github-dark-dimmed',
        } as any).next;

        expect(next.reader.renderCodeInReader).toBe(false);
        expect(next.reader).not.toHaveProperty('markdownTheme');
    });
});
