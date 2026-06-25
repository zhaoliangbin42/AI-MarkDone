import { describe, expect, it } from 'vitest';

import {
    createDefaultComposerPrompts,
    filterPromptRecords,
    listTriggerConflicts,
    normalizePromptForSave,
    normalizePromptLibrary,
} from '@/core/prompts/promptLibrary';
import { createDefaultReaderCommentPrompts } from '@/core/settings/readerCommentExport';

describe('promptLibrary', () => {
    it('seeds five unified prompts with backslash triggers', () => {
        const prompts = createDefaultComposerPrompts(1000);

        expect(prompts.map((prompt) => prompt.triggerText)).toEqual([
            '\\sum',
            '\\rewrite',
            '\\translate',
            '\\brainstorm',
            '\\review',
        ]);
        expect(prompts.every((prompt) => prompt.contexts.includes('composer'))).toBe(true);
        expect(prompts.every((prompt) => prompt.contexts.includes('readerComment'))).toBe(true);
        expect(prompts.every((prompt) => prompt.enabled)).toBe(true);
    });

    it('migrates existing Reader comment prompts into the unified library without changing content', () => {
        const library = normalizePromptLibrary(null, {
            now: 2000,
            readerCommentPrompts: [
                { id: 'reader-prompt-a', title: 'Reader review', content: 'Please review my annotations.' },
            ],
        });

        expect(library.version).toBe(1);
        expect(library.migratedReaderCommentPrompts).toBe(true);
        expect(library.seededComposerDefaults).toBe(true);
        expect(library.prompts.filter((prompt) => prompt.triggerText)).toHaveLength(5);

        const migrated = library.prompts.find((prompt) => prompt.id === 'reader-prompt-a');
        expect(migrated).toMatchObject({
            title: 'Reader review',
            content: 'Please review my annotations.',
            triggerText: '',
            contexts: ['composer', 'readerComment'],
            enabled: true,
        });
    });

    it('does not migrate untouched Reader default prompts as user prompts', () => {
        const library = normalizePromptLibrary(null, {
            now: 2000,
            readerCommentPrompts: createDefaultReaderCommentPrompts(),
        });

        expect(library.prompts).toHaveLength(5);
        expect(library.prompts.some((prompt) => prompt.id === 'prompt-1')).toBe(false);
    });

    it('preserves existing prompt content when migrated Reader ids collide', () => {
        const existing = normalizePromptForSave({
            id: 'reader-prompt-a',
            title: 'Existing',
            content: 'Existing content must stay.',
            triggerText: '\\existing',
        }, 1000);

        const library = normalizePromptLibrary({
            version: 1,
            prompts: [existing],
            migratedReaderCommentPrompts: false,
            seededComposerDefaults: true,
        }, {
            now: 2000,
            readerCommentPrompts: [
                { id: 'reader-prompt-a', title: 'Migrated', content: 'Migrated content must also stay.' },
            ],
        });

        expect(library.prompts.map((prompt) => prompt.content)).toEqual(expect.arrayContaining([
            'Existing content must stay.',
            'Migrated content must also stay.',
        ]));
        expect(new Set(library.prompts.map((prompt) => prompt.id)).size).toBe(library.prompts.length);
    });

    it('normalizes saved prompts and reports duplicate composer triggers', () => {
        const saved = normalizePromptForSave({
            id: ' custom ',
            title: '',
            content: 'Use this prompt.',
            triggerText: 'draft',
            contexts: ['composer', 'readerComment'],
            enabled: true,
            favorite: true,
            createdAt: 1,
        }, 3000);

        expect(saved).toMatchObject({
            id: 'custom',
            title: 'Untitled prompt',
            triggerText: '\\draft',
            contexts: ['composer', 'readerComment'],
            favorite: true,
            enabled: true,
            createdAt: 1,
            updatedAt: 3000,
        });

        const conflicts = listTriggerConflicts([
            saved,
            { ...saved, id: 'other', triggerText: '\\draft' },
            { ...saved, id: 'legacy-reader-only', triggerText: '\\draft', contexts: ['readerComment'] },
        ]);

        expect(conflicts).toEqual(['\\draft']);
    });

    it('keeps legacy disabled prompts visible in the unified library', () => {
        const disabled = normalizePromptForSave({
            id: 'disabled',
            title: 'Disabled',
            content: 'Hidden from autocomplete',
            triggerText: '\\disabled',
            enabled: false,
        }, 1);

        expect(disabled.enabled).toBe(true);
        expect(filterPromptRecords([disabled], { context: 'composer' })).toEqual([disabled]);
        expect(filterPromptRecords([disabled], { query: 'disabled' })).toEqual([disabled]);
    });
});
