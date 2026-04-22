import { describe, expect, it } from 'vitest';
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

    it('normalizes retired ChatGPT folding fields into the single directory toggle', () => {
        const next = loadAndNormalize({
            ...DEFAULT_SETTINGS,
            chatgpt: {
                showFoldDock: false,
                foldingMode: 'all',
                defaultExpandedCount: 8,
                enableVirtualization: false,
            },
        } as any);

        expect(next.chatgpt.showConversationDirectory).toBe(false);
        expect(next.chatgpt).not.toHaveProperty('foldingMode');
        expect(next.chatgpt).not.toHaveProperty('defaultExpandedCount');
        expect(next.chatgpt).not.toHaveProperty('enableVirtualization');
    });

    it('does not re-persist removed chatgpt folding fields on category updates', () => {
        const current = {
            ...DEFAULT_SETTINGS,
            chatgpt: {
                showFoldDock: true,
                foldingMode: 'all',
                defaultExpandedCount: 8,
            },
        } as any;

        const next = planSetCategory(current, 'chatgpt', { showConversationDirectory: false }).next;

        expect(next.chatgpt.showConversationDirectory).toBe(false);
        expect(next.chatgpt).not.toHaveProperty('showFoldDock');
        expect(next.chatgpt).not.toHaveProperty('foldingMode');
        expect(next.chatgpt).not.toHaveProperty('defaultExpandedCount');
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
