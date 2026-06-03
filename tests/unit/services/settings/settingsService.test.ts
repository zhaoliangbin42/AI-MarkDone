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

    it('ignores retired platform toggles when writing platform settings', () => {
        const next = planSetCategory(DEFAULT_SETTINGS, 'platforms', {
            chatgpt: false,
            gemini: true,
            claude: true,
            deepseek: true,
        }).next;

        expect(next.platforms).toEqual({ chatgpt: false });
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

    it('keeps the scoped ChatGPT directory retired even when stored settings request it', () => {
        const next = planSetCategory(DEFAULT_SETTINGS, 'chatgptDirectory', {
            enabled: true,
            mode: 'expanded',
            promptLabelMode: 'headTail',
            showFoldDock: true,
        }).next;

        expect(next.chatgptDirectory).toEqual({ enabled: false, mode: 'expanded', promptLabelMode: 'headTail' });
        expect(next).not.toHaveProperty('chatgpt');

        const invalid = planSetCategory(next, 'chatgptDirectory', { mode: 'dense', promptLabelMode: 'tail' }).next;
        expect(invalid.chatgptDirectory).toEqual({ enabled: false, mode: 'preview', promptLabelMode: 'head' });
    });

    it('writes scoped ChatGPT restore-position behavior settings without restoring retired ChatGPT category', () => {
        const next = planSetCategory(DEFAULT_SETTINGS, 'chatgptBehavior', {
            restorePositionAfterSend: true,
            unrelated: true,
        }).next;

        expect(next.chatgptBehavior).toEqual({ restorePositionAfterSend: true });
        expect(next).not.toHaveProperty('chatgpt');

        const normalized = loadAndNormalize({
            ...DEFAULT_SETTINGS,
            chatgptBehavior: undefined,
        } as any);
        expect(normalized.chatgptBehavior).toEqual({ restorePositionAfterSend: false });
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
        expect(next.formula.assetActions).toEqual({
            copyPng: false,
            copySvg: false,
            copyMathml: false,
            savePng: false,
            saveSvg: false,
        });
    });
});
