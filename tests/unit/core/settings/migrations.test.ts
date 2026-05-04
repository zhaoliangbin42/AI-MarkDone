import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS } from '../../../../src/core/settings/types';
import { loadAndNormalize } from '../../../../src/services/settings/settingsService';

describe('settings migrations', () => {
    it('returns defaults when stored is missing or invalid', () => {
        expect(loadAndNormalize(null)).toEqual(DEFAULT_SETTINGS);
        expect(loadAndNormalize(undefined)).toEqual(DEFAULT_SETTINGS);
        expect(loadAndNormalize('bad')).toEqual(DEFAULT_SETTINGS);
    });

    it('merges v3 stored settings with defaults and strips retired ChatGPT fields', () => {
        const stored: any = {
            version: 3,
            platforms: { chatgpt: false },
            chatgpt: { showConversationDirectory: false, foldingMode: 'all', enableVirtualization: false },
            behavior: { enableClickToCopy: false },
            reader: { renderCodeInReader: false, markdownTheme: 'github-light-colorblind' },
            bookmarks: { sortMode: 'alphabetical' },
            language: 'zh_CN',
        };

        const next = loadAndNormalize(stored);
        expect(next.version).toBe(3);
        expect(next.platforms.chatgpt).toBe(false);
        expect(next.platforms.gemini).toBe(true);
        expect(next.chatgptDirectory).toEqual(DEFAULT_SETTINGS.chatgptDirectory);
        expect(next).not.toHaveProperty('chatgpt');
        expect(next.behavior.enableClickToCopy).toBe(false);
        expect(next.formula.clickCopyMarkdown).toBe(false);
        expect(next.formula.assetActions).toEqual(DEFAULT_SETTINGS.formula.assetActions);
        expect(next.reader.renderCodeInReader).toBe(false);
        expect(next.reader).not.toHaveProperty('markdownTheme');
        expect(next.bookmarks.sortMode).toBe('alpha-asc');
        expect(next.language).toBe('zh_CN');
    });

    it('normalizes ChatGPT directory settings while preserving retired ChatGPT settings cleanup', () => {
        const next = loadAndNormalize({
            version: 3,
            chatgptDirectory: { enabled: false, mode: 'dense', promptLabelMode: 'tail' },
            chatgpt: { showConversationDirectory: false },
        } as any);

        expect(next.chatgptDirectory).toEqual({ enabled: false, mode: 'preview', promptLabelMode: 'head' });
        expect(next).not.toHaveProperty('chatgpt');
    });

    it('preserves the ChatGPT directory prompt label mode when normalizing stored settings', () => {
        const next = loadAndNormalize({
            version: 3,
            chatgptDirectory: { enabled: true, mode: 'expanded', promptLabelMode: 'headTail' },
        } as any);

        expect(next.chatgptDirectory).toEqual({ enabled: true, mode: 'expanded', promptLabelMode: 'headTail' });
    });

    it('migrates v2 settings without carrying retired ChatGPT folding settings forward', () => {
        const stored: any = {
            version: 2,
            chatgpt: { showFoldDock: false, foldingMode: 'keep_last_n', defaultExpandedCount: 6 },
            behavior: { showWordCount: false },
            bookmarks: { sortMode: 'time' },
        };

        const next = loadAndNormalize(stored);
        expect(next.version).toBe(3);
        expect(next).not.toHaveProperty('chatgpt');
        expect(next.behavior.showWordCount).toBe(false);
        expect(next.bookmarks.sortMode).toBe('time-desc');
        expect('performance' in next).toBe(false);
    });

    it('migrates v1 storage.saveContextOnly into behavior.saveContextOnly', () => {
        const stored: any = {
            version: 1,
            behavior: { enableClickToCopy: true, renderCodeInReader: false },
            storage: { saveContextOnly: true, _contextOnlyConfirmed: true },
            chatgpt: { showFoldDock: false },
        };

        const next = loadAndNormalize(stored);
        expect(next.version).toBe(3);
        expect(next.behavior.saveContextOnly).toBe(true);
        expect(next.behavior._contextOnlyConfirmed).toBe(true);
        expect(next.formula.clickCopyMarkdown).toBe(true);
        expect(next.reader.renderCodeInReader).toBe(false);
        expect(next).not.toHaveProperty('chatgpt');
    });

    it('normalizes v3 formula settings and falls back to legacy click-to-copy when missing', () => {
        const explicit = loadAndNormalize({
            version: 3,
            behavior: { enableClickToCopy: true },
            formula: {
                clickCopyMarkdown: false,
                assetActions: { copyPng: false, copySvg: true, savePng: false, saveSvg: true, extra: true },
            },
        } as any);
        expect(explicit.formula).toEqual({
            clickCopyMarkdown: false,
            assetActions: { copyPng: false, copySvg: true, savePng: false, saveSvg: true },
        });

        const legacy = loadAndNormalize({
            version: 3,
            behavior: { enableClickToCopy: false },
        } as any);
        expect(legacy.formula.clickCopyMarkdown).toBe(false);
        expect(legacy.formula.assetActions).toEqual(DEFAULT_SETTINGS.formula.assetActions);
    });
});
