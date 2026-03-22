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
});
