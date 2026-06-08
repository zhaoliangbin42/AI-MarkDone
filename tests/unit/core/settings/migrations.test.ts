import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS } from '../../../../src/core/settings/types';
import { loadAndNormalize } from '../../../../src/services/settings/settingsService';

describe('settings migrations', () => {
    it('returns defaults when stored is missing or invalid', () => {
        expect(loadAndNormalize(null)).toEqual(DEFAULT_SETTINGS);
        expect(loadAndNormalize(undefined)).toEqual(DEFAULT_SETTINGS);
        expect(loadAndNormalize('bad')).toEqual(DEFAULT_SETTINGS);
    });

    it('merges v3 stored settings with defaults, migrates missing formula asset actions off, and preserves platform runtime fields', () => {
        const stored: any = {
            version: 3,
            platforms: { chatgpt: false, gemini: true, claude: false, deepseek: true },
            chatgpt: { showConversationDirectory: false, foldingMode: 'all', enableVirtualization: false },
            behavior: { enableClickToCopy: false },
            reader: { renderCodeInReader: false, markdownTheme: 'github-light-colorblind' },
            bookmarks: { sortMode: 'alphabetical' },
            language: 'zh_CN',
        };

        const next = loadAndNormalize(stored);
        expect(next.version).toBe(4);
        expect(next.platforms).toEqual({ chatgpt: false, gemini: true, claude: false, deepseek: true });
        expect(next.chatgptDirectory).toEqual(DEFAULT_SETTINGS.chatgptDirectory);
        expect(next.chatgptBehavior.showMessageStepper).toBe(true);
        expect(next.chatgptBehavior.enableArrowKeyMessageNavigation).toBe(true);
        expect(next).not.toHaveProperty('chatgpt');
        expect(next.behavior.enableClickToCopy).toBe(false);
        expect(next.formula.clickCopyMarkdown).toBe(false);
        expect(next.formula.assetActions).toEqual({
            copyPng: false,
            copySvg: false,
            copyMathml: false,
            savePng: false,
            saveSvg: false,
        });
        expect(next.reader.renderCodeInReader).toBe(false);
        expect(next.reader).not.toHaveProperty('markdownTheme');
        expect(next.reader.defaultOpenMode).toBe('fullscreen');
        expect(next.reader.panelSizeRatio).toEqual(DEFAULT_SETTINGS.reader.panelSizeRatio);
        expect(next.reader.bodyFontSizePx).toBe(DEFAULT_SETTINGS.reader.bodyFontSizePx);
        expect(next.reader.detachedNoticeConfirmed).toBe(false);
        expect(next.appearance.fontSizePx).toBe(DEFAULT_SETTINGS.appearance.fontSizePx);
        expect(next.bookmarks.sortMode).toBe('alpha-asc');
        expect(next.language).toBe('zh_CN');
    });

    it('defaults missing formula-only platform settings on while preserving stored values', () => {
        const next = loadAndNormalize({
            version: 4,
            platforms: { chatgpt: true, gemini: false, deepseek: false },
        } as any);

        expect(next.platforms).toEqual({ chatgpt: true, gemini: false, claude: true, deepseek: false });
    });

    it('normalizes v3 appearance font size settings', () => {
        const next = loadAndNormalize({
            version: 3,
            appearance: { fontSizePx: 19.7 },
        } as any);

        expect(next.appearance.fontSizePx).toBe(20);
    });

    it('normalizes v3 reader display settings', () => {
        const next = loadAndNormalize({
            version: 3,
            reader: {
                defaultOpenMode: 'panel',
                panelSizeRatio: { widthRatio: 0.2, heightRatio: 3 },
                bodyFontSizePx: 11,
                detachedNoticeConfirmed: true,
            },
        } as any);

        expect(next.reader.defaultOpenMode).toBe('panel');
        expect(next.reader.panelSizeRatio).toEqual({ widthRatio: 0.42, heightRatio: 0.96 });
        expect(next.reader.bodyFontSizePx).toBe(12);
        expect(next.reader.detachedNoticeConfirmed).toBe(true);
    });

    it('normalizes v3 appearance accent color settings', () => {
        const accepted = loadAndNormalize({
            version: 3,
            appearance: { accentColor: '#7c3aed' },
        } as any);
        const rejected = loadAndNormalize({
            version: 3,
            appearance: { accentColor: '#123456' },
        } as any);

        expect(accepted.appearance.accentColor).toBe('#7c3aed');
        expect(rejected.appearance.accentColor).toBeNull();
    });

    it('normalizes ChatGPT directory settings while preserving retired ChatGPT settings cleanup', () => {
        const next = loadAndNormalize({
            version: 3,
            chatgptDirectory: { enabled: false, mode: 'dense', promptLabelMode: 'tail', hideOfficialNavigation: false },
            chatgpt: { showConversationDirectory: false },
        } as any);

        expect(next.chatgptDirectory).toEqual({
            enabled: false,
            mode: 'preview',
            promptLabelMode: 'head',
            hideOfficialNavigation: false,
        });
        expect(next).not.toHaveProperty('chatgpt');
    });

    it('retains ChatGPT directory preferences', () => {
        const next = loadAndNormalize({
            version: 3,
            chatgptDirectory: { enabled: true, mode: 'expanded', promptLabelMode: 'headTail' },
        } as any);

        expect(next.chatgptDirectory).toEqual({
            enabled: true,
            mode: 'expanded',
            promptLabelMode: 'headTail',
            hideOfficialNavigation: true,
        });
    });

    it('normalizes ChatGPT message navigation behavior with default-on controls', () => {
        const defaulted = loadAndNormalize({
            version: 4,
            chatgptBehavior: { restorePositionAfterSend: true },
        } as any);
        const disabled = loadAndNormalize({
            version: 4,
            chatgptBehavior: {
                restorePositionAfterSend: false,
                showMessageStepper: false,
                enableArrowKeyMessageNavigation: false,
            },
        } as any);

        expect(defaulted.chatgptBehavior).toEqual({
            restorePositionAfterSend: true,
            showMessageStepper: true,
            enableArrowKeyMessageNavigation: true,
        });
        expect(disabled.chatgptBehavior).toEqual({
            restorePositionAfterSend: false,
            showMessageStepper: false,
            enableArrowKeyMessageNavigation: false,
        });
    });

    it('migrates v2 settings without carrying retired ChatGPT folding settings forward', () => {
        const stored: any = {
            version: 2,
            chatgpt: { showFoldDock: false, foldingMode: 'keep_last_n', defaultExpandedCount: 6 },
            behavior: { showWordCount: false },
            bookmarks: { sortMode: 'time' },
        };

        const next = loadAndNormalize(stored);
        expect(next.version).toBe(4);
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
        expect(next.version).toBe(4);
        expect(next.behavior.saveContextOnly).toBe(true);
        expect(next.behavior._contextOnlyConfirmed).toBe(true);
        expect(next.formula.clickCopyMarkdown).toBe(true);
        expect(next.reader.renderCodeInReader).toBe(false);
        expect(next).not.toHaveProperty('chatgpt');
    });

    it('normalizes v3 formula settings while preserving any stored formula asset action choices', () => {
        const explicit = loadAndNormalize({
            version: 3,
            behavior: { enableClickToCopy: true },
            formula: {
                clickCopyMarkdown: false,
                assetActions: { copyPng: false, copySvg: true, copyMathml: false, savePng: false, saveSvg: true, extra: true },
            },
        } as any);
        expect(explicit.formula).toEqual({
            clickCopyMarkdown: false,
            assetActions: { copyPng: false, copySvg: true, copyMathml: false, savePng: false, saveSvg: true },
        });

        const allOn = loadAndNormalize({
            version: 3,
            formula: {
                assetActions: { copyPng: true, copySvg: true, copyMathml: true, savePng: true, saveSvg: true },
            },
        } as any);
        expect(allOn.formula.assetActions).toEqual({
            copyPng: true,
            copySvg: true,
            copyMathml: true,
            savePng: true,
            saveSvg: true,
        });
    });

    it('does not re-run the formula asset default-off migration for v4 settings', () => {
        const next = loadAndNormalize({
            version: 4,
            behavior: { enableClickToCopy: false },
            formula: {
                clickCopyMarkdown: true,
                assetActions: { copyPng: true, copySvg: false, copyMathml: true, savePng: false, saveSvg: true },
            },
        } as any);

        expect(next.version).toBe(4);
        expect(next.formula.clickCopyMarkdown).toBe(true);
        expect(next.formula.assetActions).toEqual({
            copyPng: true,
            copySvg: false,
            copyMathml: true,
            savePng: false,
            saveSvg: true,
        });
    });
});
