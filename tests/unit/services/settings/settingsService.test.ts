import { describe, expect, it } from 'vitest';
import { MAX_PNG_EXPORT_WIDTH, MIN_PNG_EXPORT_WIDTH, resolvePngExportWidth } from '@/core/settings/export';
import { DEFAULT_SETTINGS } from '@/core/settings/types';
import { loadAndNormalize, planGetCategory, planSetCategory } from '@/services/settings/settingsService';
import type { CommentTemplateSegment } from '@/services/reader/commentExport';

describe('settingsService', () => {
    it('rejects legacy performance category writes', () => {
        expect(() => planSetCategory(DEFAULT_SETTINGS, 'performance' as any, { chatgptFoldingMode: 'all' })).toThrow(
            'Invalid category: performance',
        );
    });

    it('rejects legacy performance category reads', () => {
        expect(() => planGetCategory(DEFAULT_SETTINGS as any, 'performance')).toThrow('Invalid category: performance');
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

    it('adds default reader comment export settings when normalizing stored settings', () => {
        const next = loadAndNormalize({
            ...DEFAULT_SETTINGS,
            reader: { renderCodeInReader: false },
        } as any);

        expect(next.reader.renderCodeInReader).toBe(false);
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
        expect(resolvePngExportWidth(next.export)).toBe(390);
    });

    it('preserves a normalized custom PNG width when writing export settings', () => {
        const next = planSetCategory(DEFAULT_SETTINGS, 'export', {
            pngWidthPreset: 'custom',
            pngCustomWidth: MAX_PNG_EXPORT_WIDTH + 37,
        }).next;

        expect(next.export.pngWidthPreset).toBe('custom');
        expect(next.export.pngCustomWidth).toBe(MAX_PNG_EXPORT_WIDTH);
        expect(resolvePngExportWidth(next.export)).toBe(MAX_PNG_EXPORT_WIDTH);
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
});
