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

    it('ignores removed reader markdown theme writes and preserves the default reader shape', () => {
        const next = planSetCategory(DEFAULT_SETTINGS, 'reader', {
            renderCodeInReader: false,
            markdownTheme: 'github-dark-dimmed',
        } as any).next;

        expect(next.reader.renderCodeInReader).toBe(false);
        expect(next.reader).not.toHaveProperty('markdownTheme');
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
                activePromptId: 'prompt-2',
                prompts: [
                    { id: 'default', title: 'Default', content: 'Please review the following comments:', builtIn: true },
                    { id: 'prompt-2', title: 'Research review', content: 'Summarize these findings:' },
                ],
                template,
            },
        }).next;

        expect(next.reader.renderCodeInReader).toBe(DEFAULT_SETTINGS.reader.renderCodeInReader);
        expect(next.reader.commentExport.activePromptId).toBe('prompt-2');
        expect(next.reader.commentExport.prompts).toHaveLength(2);
        expect(next.reader.commentExport.template).toEqual(template);
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

    it('adds default reader comment export settings when normalizing stored settings', () => {
        const next = loadAndNormalize({
            ...DEFAULT_SETTINGS,
            reader: { renderCodeInReader: false },
        } as any);

        expect(next.reader.renderCodeInReader).toBe(false);
        expect(next.reader.commentExport.activePromptId).toBeTruthy();
        expect(next.reader.commentExport.prompts.length).toBeGreaterThan(0);
        expect(next.reader.commentExport.template.length).toBeGreaterThan(0);
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
