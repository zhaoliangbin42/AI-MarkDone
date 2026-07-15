import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS } from '../../../../src/core/settings/types';
import { loadAndNormalize } from '../../../../src/services/settings/settingsService';

describe('settings migrations', () => {
    it('enables every ChatGPT input enhancement for a fresh install', () => {
        const next = loadAndNormalize(null);

        expect(next.chatgptBehavior.inputEnhancement).toEqual({
            available: true,
            enabled: true,
            enterKeyNewline: true,
            boldShortcut: true,
            lists: {
                enabled: true,
                ordered: true,
                unordered: true,
            },
            formulaSuggestions: true,
            formulaPreview: true,
        });
    });

    it.each([
        { markdown: false, enter: false, enabled: false, enterEnabled: false, markdownFeatures: false },
        { markdown: true, enter: false, enabled: true, enterEnabled: false, markdownFeatures: true },
        { markdown: false, enter: true, enabled: true, enterEnabled: true, markdownFeatures: false },
        { markdown: true, enter: true, enabled: true, enterEnabled: true, markdownFeatures: true },
    ])('preserves legacy Markdown=$markdown and Enter=$enter behavior in the unified input enhancement settings', ({
        markdown,
        enter,
        enabled,
        enterEnabled,
        markdownFeatures,
    }) => {
        const next = loadAndNormalize({
            version: 4,
            chatgptBehavior: {
                markdownComposerEnabled: markdown,
                enterKeyNewline: enter,
            },
        } as any);

        expect(next.chatgptBehavior.inputEnhancement).toEqual({
            available: true,
            enabled,
            enterKeyNewline: enterEnabled,
            boldShortcut: markdownFeatures,
            lists: {
                enabled: markdownFeatures,
                ordered: markdownFeatures,
                unordered: markdownFeatures,
            },
            formulaSuggestions: markdownFeatures,
            formulaPreview: markdownFeatures,
        });
        expect(next.chatgptBehavior).not.toHaveProperty('enterKeyNewline');
        expect(next.chatgptBehavior).not.toHaveProperty('markdownComposerEnabled');
    });

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
        expect(next.chatgptBehavior.showPageBookmarkControl).toBe(true);
        expect(next.chatgptBehavior.showDetachedReaderControl).toBe(true);
        expect(next.chatgptBehavior.showPromptControl).toBe(true);
        expect(next.chatgptBehavior.promptAutocomplete).toBe(true);
        expect(next.chatgptBehavior.inputEnhancement.enabled).toBe(false);
        expect(next.chatgptBehavior.inputEnhancement.enterKeyNewline).toBe(false);
        expect(next.chatgptBehavior.enableArrowKeyMessageNavigation).toBe(true);
        expect(next.chatgptBehavior.pageWidthScale).toBe(100);
        expect(next).not.toHaveProperty('chatgpt');
        expect(next.behavior.showMessageToolbar).toBe(true);
        expect(next.behavior.enableClickToCopy).toBe(false);
        expect(next.formula.clickCopyMarkdown).toBe(false);
        expect(next.formula.clickCopyFormulaFormat).toBe('markdown-dollar');
        expect(next.formula.markdownCopyFormulaFormat).toBe('markdown-dollar');
        expect(next.formula.assetFontSizePx).toBe(36);
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
            chatgptDirectory: { enabled: false, mode: 'dense', promptLabelMode: 'tail', hideOfficialNavigation: false, rightInsetPx: 147 },
            chatgpt: { showConversationDirectory: false },
        } as any);

        expect(next.chatgptDirectory).toEqual({
            enabled: false,
            mode: 'preview',
            promptLabelMode: 'head',
            hideOfficialNavigation: false,
            rightInsetPx: 40,
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
            rightInsetPx: 0,
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
                enterKeyNewline: true,
                showMessageStepper: false,
                showPageBookmarkControl: false,
                showDetachedReaderControl: false,
                showPromptControl: false,
                promptAutocomplete: false,
                enableArrowKeyMessageNavigation: false,
                pageWidthScale: 147,
            },
        } as any);
        const clamped = loadAndNormalize({
            version: 4,
            chatgptBehavior: {
                pageWidthScale: 237,
            },
        } as any);

        expect(defaulted.chatgptBehavior).toEqual({
            restorePositionAfterSend: true,
            inputEnhancement: {
                available: true,
                enabled: false,
                enterKeyNewline: false,
                boldShortcut: false,
                lists: { enabled: false, ordered: false, unordered: false },
                formulaSuggestions: false,
                formulaPreview: false,
            },
            showMessageStepper: true,
            showPageBookmarkControl: true,
            showDetachedReaderControl: true,
            showPromptControl: true,
            promptAutocomplete: true,
            enableArrowKeyMessageNavigation: true,
            pageWidthScale: 100,
        });
        expect(disabled.chatgptBehavior).toEqual({
            restorePositionAfterSend: false,
            inputEnhancement: {
                available: true,
                enabled: true,
                enterKeyNewline: true,
                boldShortcut: false,
                lists: { enabled: false, ordered: false, unordered: false },
                formulaSuggestions: false,
                formulaPreview: false,
            },
            showMessageStepper: false,
            showPageBookmarkControl: false,
            showDetachedReaderControl: false,
            showPromptControl: false,
            promptAutocomplete: false,
            enableArrowKeyMessageNavigation: false,
            pageWidthScale: 145,
        });
        expect(clamped.chatgptBehavior.pageWidthScale).toBe(200);
    });

    it('normalizes persisted input enhancement fields independently', () => {
        const next = loadAndNormalize({
            version: 4,
            chatgptBehavior: {
                inputEnhancement: {
                    available: false,
                    enabled: true,
                    enterKeyNewline: false,
                    boldShortcut: true,
                    lists: { enabled: true, ordered: false, unordered: true },
                    formulaSuggestions: false,
                    formulaPreview: true,
                },
            },
        } as any);

        expect(next.chatgptBehavior.inputEnhancement).toEqual({
            available: false,
            enabled: true,
            enterKeyNewline: false,
            boldShortcut: true,
            lists: { enabled: true, ordered: false, unordered: true },
            formulaSuggestions: false,
            formulaPreview: true,
        });
    });

    it('migrates v2 settings without carrying retired ChatGPT folding settings forward', () => {
        const stored: any = {
            version: 2,
            chatgpt: { showFoldDock: false, foldingMode: 'keep_last_n', defaultExpandedCount: 6 },
            behavior: { showMessageToolbar: false, showWordCount: false },
            bookmarks: { sortMode: 'time' },
        };

        const next = loadAndNormalize(stored);
        expect(next.version).toBe(4);
        expect(next).not.toHaveProperty('chatgpt');
        expect(next.behavior.showMessageToolbar).toBe(false);
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
                copyMarkdownDelimiters: false,
                assetFontSizePx: 90,
                assetActions: { copyPng: false, copySvg: true, copyMathml: false, savePng: false, saveSvg: true, extra: true },
            },
        } as any);
        expect(explicit.formula).toEqual({
            clickCopyMarkdown: false,
            clickCopyFormulaFormat: 'raw',
            markdownCopyFormulaFormat: 'markdown-dollar',
            assetFontSizePx: 72,
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
                copyMarkdownDelimiters: false,
                assetActions: { copyPng: true, copySvg: false, copyMathml: true, savePng: false, saveSvg: true },
            },
        } as any);

        expect(next.version).toBe(4);
        expect(next.formula.clickCopyMarkdown).toBe(true);
        expect(next.formula.clickCopyFormulaFormat).toBe('raw');
        expect(next.formula.markdownCopyFormulaFormat).toBe('markdown-dollar');
        expect(next.formula.assetFontSizePx).toBe(36);
        expect(next.formula.assetActions).toEqual({
            copyPng: true,
            copySvg: false,
            copyMathml: true,
            savePng: false,
            saveSvg: true,
        });
    });
});
