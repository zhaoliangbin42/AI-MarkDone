import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS } from '../../../../src/core/settings/types';
import { loadAndNormalize } from '../../../../src/services/settings/settingsService';

describe('settings migrations', () => {
    it('returns defaults when stored is missing or invalid', () => {
        expect(loadAndNormalize(null)).toEqual(DEFAULT_SETTINGS);
        expect(loadAndNormalize(undefined)).toEqual(DEFAULT_SETTINGS);
        expect(loadAndNormalize('bad')).toEqual(DEFAULT_SETTINGS);
    });

    it('merges v3 stored settings with defaults', () => {
        const stored: any = {
            version: 3,
            platforms: { chatgpt: false },
            chatgpt: { foldingMode: 'all', enableVirtualization: false },
            behavior: { enableClickToCopy: false },
            reader: { renderCodeInReader: false, markdownTheme: 'github-light-colorblind' },
            bookmarks: { sortMode: 'alphabetical' },
            language: 'zh_CN',
        };

        const next = loadAndNormalize(stored);
        expect(next.version).toBe(3);
        expect(next.platforms.chatgpt).toBe(false);
        expect(next.platforms.gemini).toBe(true);
        expect(next.chatgpt.foldingMode).toBe('all');
        expect(next.chatgpt.foldingPowerMode).toBe('off');
        expect(next.behavior.enableClickToCopy).toBe(false);
        expect(next.reader.renderCodeInReader).toBe(false);
        expect(next.reader).not.toHaveProperty('markdownTheme');
        expect(next.bookmarks.sortMode).toBe('alpha-asc');
        expect(next.language).toBe('zh_CN');
    });

    it('migrates v2 performance folding fields into chatgpt settings', () => {
        const stored: any = {
            version: 2,
            performance: { chatgptFoldingMode: 'keep_last_n', chatgptDefaultExpandedCount: 6 },
            behavior: { showWordCount: false },
            bookmarks: { sortMode: 'time' },
        };

        const next = loadAndNormalize(stored);
        expect(next.version).toBe(3);
        expect(next.chatgpt.foldingMode).toBe('keep_last_n');
        expect(next.chatgpt.defaultExpandedCount).toBe(6);
        expect(next.chatgpt.foldingPowerMode).toBe('off');
        expect(next.behavior.showWordCount).toBe(false);
        expect(next.bookmarks.sortMode).toBe('time-desc');
        expect('performance' in next).toBe(false);
    });

    it('drops legacy performance payloads from v3 normalized settings', () => {
        const stored: any = {
            version: 3,
            chatgpt: { foldingMode: 'all', defaultExpandedCount: 5 },
            performance: { chatgptFoldingMode: 'keep_last_n', chatgptDefaultExpandedCount: 99 },
        };

        const next = loadAndNormalize(stored);
        expect(next.chatgpt.foldingMode).toBe('all');
        expect(next.chatgpt.defaultExpandedCount).toBe(5);
        expect(next.chatgpt.foldingPowerMode).toBe('off');
        expect('performance' in next).toBe(false);
        expect(next.reader).not.toHaveProperty('markdownTheme');
    });

    it('keeps migrated legacy folding users on hidden behavior unless virtualization was explicitly enabled before', () => {
        const storedV1: any = {
            version: 1,
            chatgpt: { foldingMode: 'all' },
        };
        const storedV3: any = {
            version: 3,
            chatgpt: { foldingMode: 'keep_last_n', defaultExpandedCount: 3 },
        };

        expect(loadAndNormalize(storedV1).chatgpt.foldingPowerMode).toBe('off');
        expect(loadAndNormalize(storedV3).chatgpt.foldingPowerMode).toBe('off');
    });

    it('migrates v1 storage.saveContextOnly into behavior.saveContextOnly', () => {
        const stored: any = {
            version: 1,
            behavior: { enableClickToCopy: true, renderCodeInReader: false },
            storage: { saveContextOnly: true, _contextOnlyConfirmed: true },
        };

        const next = loadAndNormalize(stored);
        expect(next.version).toBe(3);
        expect(next.behavior.saveContextOnly).toBe(true);
        expect(next.behavior._contextOnlyConfirmed).toBe(true);
        expect(next.reader.renderCodeInReader).toBe(false);
        expect(next.reader).not.toHaveProperty('markdownTheme');
    });

    it('maps legacy virtualization toggles into folding power mode', () => {
        const offStored: any = {
            version: 3,
            chatgpt: {
                foldingMode: 'all',
                enableVirtualization: false,
                enableEarlyPrune: false,
            },
        };
        const mediumStored: any = {
            version: 3,
            chatgpt: {
                foldingMode: 'keep_last_n',
                enableVirtualization: true,
                enableEarlyPrune: false,
            },
        };

        expect(loadAndNormalize(offStored).chatgpt.foldingPowerMode).toBe('off');
        expect(loadAndNormalize(mediumStored).chatgpt.foldingPowerMode).toBe('on');
    });
});
