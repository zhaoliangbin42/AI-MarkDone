import { describe, expect, it } from 'vitest';
import {
    MAX_PNG_EXPORT_PIXEL_RATIO,
    MAX_PNG_EXPORT_WIDTH,
    MIN_PNG_EXPORT_PIXEL_RATIO,
    MIN_PNG_EXPORT_WIDTH,
    resolvePngExportPixelRatio,
    resolvePngExportWidth,
} from '@/core/settings/export';
import { DEFAULT_SETTINGS } from '@/core/settings/types';
import { loadAndNormalize, planGetCategory, planReset, planSetCategory } from '@/services/settings/settingsService';
import type { CommentTemplateSegment } from '@/services/reader/commentExport';

describe('settingsService', () => {
    it('uses v4 defaults with formula asset hover actions disabled', () => {
        const next = loadAndNormalize(null);

        expect(next.version).toBe(4);
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
    });

    it('rejects legacy performance category writes', () => {
        expect(() => planSetCategory(DEFAULT_SETTINGS, 'performance' as any, { chatgptFoldingMode: 'all' })).toThrow(
            'Invalid category: performance',
        );
    });

    it('rejects legacy performance category reads', () => {
        expect(() => planGetCategory(DEFAULT_SETTINGS as any, 'performance')).toThrow('Invalid category: performance');
    });

    it('persists ChatGPT full runtime and formula-only platform toggles separately', () => {
        const next = planSetCategory(DEFAULT_SETTINGS, 'platforms', {
            chatgpt: false,
            gemini: false,
            claude: true,
            deepseek: false,
        }).next;

        expect(next.platforms).toEqual({
            chatgpt: false,
            gemini: false,
            claude: true,
            deepseek: false,
        });
    });

    it('merges reader comment export settings while preserving renderCodeInReader', () => {
        const template: CommentTemplateSegment[] = [
            { type: 'text', value: 'Prefix\n' },
            { type: 'token', key: 'selected_source' },
            { type: 'text', value: '\nComment\n' },
            { type: 'token', key: 'user_comment' },
        ];
        const next = planSetCategory(DEFAULT_SETTINGS, 'reader', {
            commentExport: {
                prompts: [
                    { id: 'prompt-1', title: 'Prompt A', content: 'Please review the following comments:' },
                    { id: 'prompt-2', title: 'Research review', content: 'Summarize these findings:' },
                ],
                template,
            },
        }).next;

        expect(next.reader.renderCodeInReader).toBe(DEFAULT_SETTINGS.reader.renderCodeInReader);
        expect(next.reader.commentExport.prompts).toHaveLength(2);
        expect(next.reader.commentExport.prompts[0]?.id).toBe('prompt-1');
        expect(next.reader.commentExport.template).toEqual(template);
        expect(next.reader.commentExport.promptPosition).toBe('top');
    });

    it('merges reader content width settings while preserving other reader settings', () => {
        const next = planSetCategory(DEFAULT_SETTINGS, 'reader', {
            contentMaxWidthPx: 1647,
        }).next;

        expect(next.reader.renderCodeInReader).toBe(DEFAULT_SETTINGS.reader.renderCodeInReader);
        expect(next.reader.showOutlineInReader).toBe(DEFAULT_SETTINGS.reader.showOutlineInReader);
        expect(next.reader.commentExport).toEqual(DEFAULT_SETTINGS.reader.commentExport);
        expect(next.reader.contentMaxWidthPx).toBe(1600);
    });

    it('normalizes reader display settings while preserving other reader settings', () => {
        const next = planSetCategory(DEFAULT_SETTINGS, 'reader', {
            defaultOpenMode: 'panel',
            panelSizeRatio: { widthRatio: 2, heightRatio: 0.1 },
            bodyFontSizePx: 99,
            detachedNoticeConfirmed: true,
        }).next;

        expect(next.reader.defaultOpenMode).toBe('panel');
        expect(next.reader.panelSizeRatio).toEqual({ widthRatio: 0.96, heightRatio: 0.46 });
        expect(next.reader.bodyFontSizePx).toBe(22);
        expect(next.reader.detachedNoticeConfirmed).toBe(true);
        expect(next.reader.renderCodeInReader).toBe(DEFAULT_SETTINGS.reader.renderCodeInReader);
        expect(next.reader.commentExport).toEqual(DEFAULT_SETTINGS.reader.commentExport);
    });

    it('normalizes reader outline visibility settings', () => {
        const off = planSetCategory(DEFAULT_SETTINGS, 'reader', { showOutlineInReader: false }).next;
        const inherited = planSetCategory(off, 'reader', { contentMaxWidthPx: 980 }).next;
        const restored = loadAndNormalize({
            ...DEFAULT_SETTINGS,
            reader: { renderCodeInReader: false },
        } as any);

        expect(off.reader.showOutlineInReader).toBe(false);
        expect(inherited.reader.showOutlineInReader).toBe(false);
        expect(restored.reader.showOutlineInReader).toBe(true);
    });

    it('normalizes global appearance font size settings', () => {
        const high = planSetCategory(DEFAULT_SETTINGS, 'appearance', { fontSizePx: 99 }).next;
        const low = planSetCategory(DEFAULT_SETTINGS, 'appearance', { fontSizePx: 4 }).next;
        const invalid = planSetCategory(DEFAULT_SETTINGS, 'appearance', { fontSizePx: 'bad' }).next;

        expect(high.appearance.fontSizePx).toBe(20);
        expect(low.appearance.fontSizePx).toBe(12);
        expect(invalid.appearance.fontSizePx).toBe(DEFAULT_SETTINGS.appearance.fontSizePx);
    });

    it('normalizes appearance accent color to approved theme swatches', () => {
        const emerald = planSetCategory(DEFAULT_SETTINGS, 'appearance', { accentColor: '#059669' }).next;
        const shorthand = planSetCategory(DEFAULT_SETTINGS, 'appearance', { accentColor: '#0a7' }).next;
        const invalid = planSetCategory(DEFAULT_SETTINGS, 'appearance', { accentColor: '#123456' }).next;
        const reset = planSetCategory(emerald, 'appearance', { accentColor: null }).next;

        expect(emerald.appearance.accentColor).toBe('#059669');
        expect(shorthand.appearance.accentColor).toBeNull();
        expect(invalid.appearance.accentColor).toBeNull();
        expect(reset.appearance.accentColor).toBeNull();
    });

    it('drops retired ChatGPT-specific settings when normalizing stored settings', () => {
        const next = loadAndNormalize({
            ...DEFAULT_SETTINGS,
            chatgpt: {
                showConversationDirectory: false,
                showFoldDock: false,
                foldingMode: 'all',
                defaultExpandedCount: 8,
                enableVirtualization: false,
            },
        } as any);

        expect(next).not.toHaveProperty('chatgpt');
    });

    it('rejects retired ChatGPT settings category writes', () => {
        expect(() => planSetCategory(DEFAULT_SETTINGS, 'chatgpt' as any, { showConversationDirectory: false })).toThrow(
            'Invalid category: chatgpt',
        );
    });

    it('preserves scoped ChatGPT directory settings without restoring the retired ChatGPT category', () => {
        const next = planSetCategory(DEFAULT_SETTINGS, 'chatgptDirectory', {
            enabled: true,
            mode: 'expanded',
            promptLabelMode: 'headTail',
            hideOfficialNavigation: false,
            showFoldDock: true,
        }).next;

        expect(next.chatgptDirectory).toEqual({
            enabled: true,
            mode: 'expanded',
            promptLabelMode: 'headTail',
            hideOfficialNavigation: false,
            rightInsetPx: 0,
        });
        expect(next).not.toHaveProperty('chatgpt');

        const invalid = planSetCategory(next, 'chatgptDirectory', { mode: 'dense', promptLabelMode: 'tail', rightInsetPx: 147 }).next;
        expect(invalid.chatgptDirectory).toEqual({
            enabled: true,
            mode: 'preview',
            promptLabelMode: 'head',
            hideOfficialNavigation: false,
            rightInsetPx: 40,
        });
    });

    it('writes scoped ChatGPT behavior settings without restoring retired ChatGPT category', () => {
        const next = planSetCategory(DEFAULT_SETTINGS, 'chatgptBehavior', {
            restorePositionAfterSend: true,
            enterKeyNewline: true,
            showMessageStepper: false,
            showPageBookmarkControl: false,
            showDetachedReaderControl: false,
            showPromptControl: false,
            promptAutocomplete: false,
            enableArrowKeyMessageNavigation: false,
            pageWidthScale: 147,
            unrelated: true,
        }).next;

        expect(next.chatgptBehavior).toEqual({
            restorePositionAfterSend: true,
            enterKeyNewline: true,
            showMessageStepper: false,
            showPageBookmarkControl: false,
            showDetachedReaderControl: false,
            showPromptControl: false,
            promptAutocomplete: false,
            enableArrowKeyMessageNavigation: false,
            pageWidthScale: 145,
        });
        expect(next).not.toHaveProperty('chatgpt');

        const normalized = loadAndNormalize({
            ...DEFAULT_SETTINGS,
            chatgptBehavior: undefined,
        } as any);
        const clamped = planSetCategory(DEFAULT_SETTINGS, 'chatgptBehavior', {
            pageWidthScale: 237,
        }).next;
        expect(normalized.chatgptBehavior).toEqual({
            restorePositionAfterSend: true,
            enterKeyNewline: false,
            showMessageStepper: true,
            showPageBookmarkControl: true,
            showDetachedReaderControl: true,
            showPromptControl: true,
            promptAutocomplete: true,
            enableArrowKeyMessageNavigation: true,
            pageWidthScale: 100,
        });
        expect(clamped.chatgptBehavior.pageWidthScale).toBe(200);
    });

    it('adds default reader comment export settings when normalizing stored settings', () => {
        const next = loadAndNormalize({
            ...DEFAULT_SETTINGS,
            reader: { renderCodeInReader: false },
        } as any);

        expect(next.reader.renderCodeInReader).toBe(false);
        expect(next.reader.contentMaxWidthPx).toBe(1000);
        expect(next.reader.commentExport.prompts).toEqual([
            expect.objectContaining({ id: 'prompt-1', title: 'Precise Revision' }),
            expect.objectContaining({ id: 'prompt-2', title: 'Point-by-Point Revision' }),
            expect.objectContaining({ id: 'prompt-3', title: 'Polished Final Draft' }),
        ]);
        expect(next.reader.commentExport.template).toEqual([
            { type: 'text', value: 'Regarding the following text:\n<selected_text>\n' },
            { type: 'token', key: 'selected_source' },
            { type: 'text', value: '\n</selected_text>\n\nMy annotation:\n<annotation>\n' },
            { type: 'token', key: 'user_comment' },
            { type: 'text', value: '\n</annotation>' },
        ]);
        expect(next.reader.commentExport.promptPosition).toBe('top');
    });

    it('normalizes and preserves reader comment prompt position settings', () => {
        const bottom = planSetCategory(DEFAULT_SETTINGS, 'reader', {
            commentExport: {
                promptPosition: 'bottom',
            },
        }).next;

        expect(bottom.reader.commentExport.promptPosition).toBe('bottom');

        const invalid = planSetCategory(bottom, 'reader', {
            commentExport: {
                promptPosition: 'side',
            },
        }).next;

        expect(invalid.reader.commentExport.promptPosition).toBe('top');
    });

    it('adds default export settings when normalizing stored settings', () => {
        const next = loadAndNormalize({
            ...DEFAULT_SETTINGS,
            export: undefined,
        } as any);

        expect(next.export).toEqual(DEFAULT_SETTINGS.export);
        expect(resolvePngExportWidth(next.export)).toBe(800);
    });

    it('normalizes export settings and resolves preset widths', () => {
        const next = planSetCategory(DEFAULT_SETTINGS, 'export', {
            pngWidthPreset: 'mobile',
            pngCustomWidth: MIN_PNG_EXPORT_WIDTH - 100,
        }).next;

        expect(next.export.pngWidthPreset).toBe('mobile');
        expect(next.export.pngCustomWidth).toBe(MIN_PNG_EXPORT_WIDTH);
        expect(next.export.pngPixelRatio).toBe(1);
        expect(resolvePngExportWidth(next.export)).toBe(390);
        expect(resolvePngExportPixelRatio(next.export)).toBe(1);
    });

    it('preserves a normalized custom PNG width when writing export settings', () => {
        const next = planSetCategory(DEFAULT_SETTINGS, 'export', {
            pngWidthPreset: 'custom',
            pngCustomWidth: MAX_PNG_EXPORT_WIDTH + 37,
            pngPixelRatio: MAX_PNG_EXPORT_PIXEL_RATIO + 1,
        }).next;

        expect(next.export.pngWidthPreset).toBe('custom');
        expect(next.export.pngCustomWidth).toBe(MAX_PNG_EXPORT_WIDTH);
        expect(next.export.pngPixelRatio).toBe(MAX_PNG_EXPORT_PIXEL_RATIO);
        expect(resolvePngExportWidth(next.export)).toBe(MAX_PNG_EXPORT_WIDTH);
        expect(resolvePngExportPixelRatio(next.export)).toBe(MAX_PNG_EXPORT_PIXEL_RATIO);
    });

    it('rounds PNG pixel ratio to the configured step and lower bound', () => {
        const next = planSetCategory(DEFAULT_SETTINGS, 'export', {
            pngPixelRatio: MIN_PNG_EXPORT_PIXEL_RATIO - 0.3,
        }).next;

        expect(next.export.pngPixelRatio).toBe(MIN_PNG_EXPORT_PIXEL_RATIO);
    });

    it('drops the retired source panel behavior flag when normalizing stored settings', () => {
        const next = loadAndNormalize({
            ...DEFAULT_SETTINGS,
            behavior: {
                ...DEFAULT_SETTINGS.behavior,
                showViewSource: true,
            },
        } as any);

        expect(next.behavior).not.toHaveProperty('showViewSource');
    });

    it('writes scoped formula settings without changing behavior flags', () => {
        const next = planSetCategory(DEFAULT_SETTINGS, 'formula', {
            clickCopyMarkdown: false,
            assetActions: {
                copyPng: false,
                copySvg: true,
                copyMathml: false,
                savePng: false,
                saveSvg: true,
                retiredAction: true,
            },
        }).next;

        expect(next.formula).toEqual({
            clickCopyMarkdown: false,
            clickCopyFormulaFormat: 'markdown-dollar',
            markdownCopyFormulaFormat: 'markdown-dollar',
            assetFontSizePx: 36,
            assetActions: {
                copyPng: false,
                copySvg: true,
                copyMathml: false,
                savePng: false,
                saveSvg: true,
            },
        });
        expect(next.behavior).toEqual(DEFAULT_SETTINGS.behavior);
    });

    it('preserves stored formula asset actions when writing unrelated settings', () => {
        const current = loadAndNormalize({
            ...DEFAULT_SETTINGS,
            version: 4,
            formula: {
                clickCopyMarkdown: true,
                clickCopyFormulaFormat: 'raw',
                markdownCopyFormulaFormat: 'latex-brackets',
                assetFontSizePx: 44,
                assetActions: {
                    copyPng: true,
                    copySvg: false,
                    copyMathml: true,
                    savePng: false,
                    saveSvg: false,
                },
            },
        } as any);

        const next = planSetCategory(current, 'appearance', { fontSizePx: 18 }).next;

        expect(next.appearance.fontSizePx).toBe(18);
        expect(next.formula.clickCopyFormulaFormat).toBe('raw');
        expect(next.formula.markdownCopyFormulaFormat).toBe('latex-brackets');
        expect(next.formula.assetFontSizePx).toBe(44);
        expect(next.formula.assetActions).toEqual({
            copyPng: true,
            copySvg: false,
            copyMathml: true,
            savePng: false,
            saveSvg: false,
        });
    });

    it('resets to v4 defaults with formula asset hover actions disabled', () => {
        const next = planReset().next;

        expect(next.version).toBe(4);
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
    });
});
