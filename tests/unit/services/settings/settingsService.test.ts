import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS } from '@/core/settings/types';
import { loadAndNormalize, planGetCategory, planSetCategory } from '@/services/settings/settingsService';

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

    it('drops removed chatgpt virtualization fields when normalizing v3 settings', () => {
        const next = loadAndNormalize({
            ...DEFAULT_SETTINGS,
            chatgpt: {
                ...DEFAULT_SETTINGS.chatgpt,
                foldingMode: 'all',
                foldingPowerMode: 'on',
                enableVirtualization: false,
            },
        } as any);

        expect(next.chatgpt.foldingMode).toBe('all');
        expect(next.chatgpt).not.toHaveProperty('foldingPowerMode');
        expect(next.chatgpt).not.toHaveProperty('enableVirtualization');
        expect(next.chatgpt).not.toHaveProperty('enableEarlyPrune');
    });

    it('does not re-persist removed chatgpt virtualization fields on category updates', () => {
        const current = {
            ...DEFAULT_SETTINGS,
            chatgpt: {
                ...DEFAULT_SETTINGS.chatgpt,
                foldingMode: 'all',
                foldingPowerMode: 'on',
                enableVirtualization: false,
            },
        } as any;

        const next = planSetCategory(current, 'chatgpt', { showFoldDock: false }).next;

        expect(next.chatgpt.showFoldDock).toBe(false);
        expect(next.chatgpt).not.toHaveProperty('foldingPowerMode');
        expect(next.chatgpt).not.toHaveProperty('enableVirtualization');
        expect(next.chatgpt).not.toHaveProperty('enableEarlyPrune');
    });
});
