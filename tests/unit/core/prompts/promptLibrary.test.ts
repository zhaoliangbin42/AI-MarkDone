import { describe, expect, it } from 'vitest';

import {
    createDefaultComposerPrompts,
    exportPortablePromptLibrary,
    filterPromptRecords,
    listTriggerConflicts,
    normalizePromptForSave,
    normalizePromptLibrary,
    parsePortablePromptLibrary,
    planPromptImportMerge,
} from '@/core/prompts/promptLibrary';
import { createDefaultReaderCommentPrompts } from '@/core/settings/readerCommentExport';

describe('promptLibrary', () => {
    const skillCreatorUrl = 'https://github.com/openai/codex/tree/main/codex-rs/skills/src/assets/samples/skill-creator';
    const oldSkillCreatorFileUrl = 'https://github.com/openai/codex/blob/main/codex-rs/skills/src/assets/samples/skill-creator/SKILL.md';

    it('seeds four unified skill-forward prompts with plain-text triggers', () => {
        const prompts = createDefaultComposerPrompts(1000);

        expect(prompts.map((prompt) => prompt.triggerText)).toEqual([
            'humanize',
            'prompt',
            'skill',
            'translate',
        ]);
        expect(prompts.map((prompt) => prompt.title)).toEqual([
            'Humanize Text With a Skill',
            'Turn Rough Ideas Into Prompts',
            'Create a Reusable Skill',
            'Translate Naturally',
        ]);
        expect(prompts.every((prompt) => !/[\u4e00-\u9fff]/.test(`${prompt.title}\n${prompt.content}`))).toBe(true);
        expect(prompts.find((prompt) => prompt.id === 'composer-default-skill-creator')?.content)
            .toContain(`[OpenAI Codex Skill Creator](${skillCreatorUrl})`);
        expect(prompts.find((prompt) => prompt.id === 'composer-default-skill-creator')?.content)
            .toContain('Final output must be exactly one fenced code block');
        expect(prompts.find((prompt) => prompt.id === 'composer-default-skill-creator')?.content)
            .toContain('FILE: SKILL.md');
        expect(prompts.find((prompt) => prompt.id === 'composer-default-skill-creator')?.content)
            .not.toContain('## Flat files');
        expect(prompts.every((prompt) => prompt.managedDefaultId)).toBe(true);
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
        expect(library.defaultPromptSetVersion).toBe(4);
        expect(library.prompts.filter((prompt) => prompt.triggerText)).toHaveLength(4);

        const migrated = library.prompts.find((prompt) => prompt.id === 'reader-prompt-a');
        expect(migrated).toMatchObject({
            title: 'Reader review',
            content: 'Please review my annotations.',
            triggerText: '',
            contexts: ['composer', 'readerComment'],
            enabled: true,
        });
    });

    it('preserves the point-by-point Reader default while skipping other untouched Reader defaults', () => {
        const library = normalizePromptLibrary(null, {
            now: 2000,
            readerCommentPrompts: createDefaultReaderCommentPrompts(),
        });

        expect(library.prompts).toHaveLength(5);
        expect(library.prompts.some((prompt) => prompt.id === 'prompt-1')).toBe(false);
        expect(library.prompts.some((prompt) => prompt.id === 'prompt-3')).toBe(false);
        expect(library.prompts.find((prompt) => prompt.id === 'prompt-2')).toMatchObject({
            title: 'Point-by-Point Revision',
            content: 'Please go through my annotations one by one. Briefly explain how you will address each point, then provide the revised version.',
            triggerText: '',
            contexts: ['composer', 'readerComment'],
            managedDefaultId: null,
        });
    });

    it('preserves existing prompt content when migrated Reader ids collide', () => {
        const existing = normalizePromptForSave({
            id: 'reader-prompt-a',
            title: 'Existing',
            content: 'Existing content must stay.',
            triggerText: 'existing',
        }, 1000);

        const library = normalizePromptLibrary({
            version: 1,
            prompts: [existing],
            migratedReaderCommentPrompts: false,
            seededComposerDefaults: true,
            defaultPromptSetVersion: 4,
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
            triggerText: 'draft',
            contexts: ['composer', 'readerComment'],
            favorite: true,
            enabled: true,
            createdAt: 1,
            updatedAt: 3000,
        });

        const conflicts = listTriggerConflicts([
            saved,
            { ...saved, id: 'other', triggerText: 'draft' },
            { ...saved, id: 'legacy-reader-only', triggerText: 'draft', contexts: ['readerComment'] },
        ]);

        expect(conflicts).toEqual(['draft']);
    });

    it('normalizes legacy slash and backslash triggers to plain text', () => {
        expect(normalizePromptForSave({
            id: 'backslash',
            title: 'Backslash',
            content: 'Body',
            triggerText: '\\Draft Prompt',
        }, 1).triggerText).toBe('draft-prompt');
        expect(normalizePromptForSave({
            id: 'slash',
            title: 'Slash',
            content: 'Body',
            triggerText: '/Draft Prompt',
        }, 1).triggerText).toBe('draft-prompt');
    });

    it('preserves disabled prompts for the manager while excluding them from runtime lists', () => {
        const disabled = normalizePromptForSave({
            id: 'disabled',
            title: 'Disabled',
            content: 'Hidden from autocomplete',
            triggerText: 'disabled',
            enabled: false,
        }, 1);

        expect(disabled.enabled).toBe(false);
        expect(filterPromptRecords([disabled], { context: 'composer' })).toEqual([]);
        expect(filterPromptRecords([disabled], { query: 'disabled' })).toEqual([]);
        expect(filterPromptRecords([disabled], { context: 'composer', includeDisabled: true })).toEqual([disabled]);
        expect(filterPromptRecords([disabled], { query: 'disabled', includeDisabled: true })).toEqual([disabled]);
    });

    it('can restrict query matching to trigger text for runtime autocomplete', () => {
        const prompt = normalizePromptForSave({
            id: 'translate',
            title: 'Translate Naturally',
            content: 'Please translate this draft.',
            triggerText: 'tr',
        }, 1);

        expect(filterPromptRecords([prompt], { query: 'trans' })).toEqual([prompt]);
        expect(filterPromptRecords([prompt], { query: 'trans', match: 'trigger' })).toEqual([]);
        expect(filterPromptRecords([prompt], { query: 't', match: 'trigger' })).toEqual([prompt]);
        expect(filterPromptRecords([prompt], { query: 'r', match: 'trigger' })).toEqual([]);
    });

    it('preserves prompt storage order for manager, autocomplete, and Reader lists', () => {
        const first = normalizePromptForSave({
            id: 'first',
            title: 'First',
            content: 'First prompt',
            triggerText: 'first',
            lastUsedAt: 1,
        }, 10);
        const second = normalizePromptForSave({
            id: 'second',
            title: 'Second',
            content: 'Second prompt',
            triggerText: 'second',
            lastUsedAt: 999,
        }, 20);

        expect(filterPromptRecords([first, second], { context: 'composer' }).map((prompt) => prompt.id)).toEqual([
            'first',
            'second',
        ]);
    });

    it('preserves persisted timestamps when normalizing an already-current library', () => {
        const library = normalizePromptLibrary({
            version: 1,
            migratedReaderCommentPrompts: true,
            seededComposerDefaults: true,
            defaultPromptSetVersion: 4,
            prompts: [
                {
                    id: 'current',
                    title: 'Current',
                    content: 'Current prompt',
                    triggerText: 'current',
                    contexts: ['composer', 'readerComment'],
                    favorite: false,
                    enabled: true,
                    createdAt: 10,
                    updatedAt: 20,
                    lastUsedAt: 30,
                    managedDefaultId: null,
                    managedDefaultVersion: null,
                },
            ],
        }, { now: 999 });

        expect(library.prompts[0]).toMatchObject({
            id: 'current',
            createdAt: 10,
            updatedAt: 20,
            lastUsedAt: 30,
        });
    });

    it('migrates untouched legacy defaults to the current default prompt set once while preserving user prompts', () => {
        const legacySummarize = normalizePromptForSave({
            id: 'composer-default-summarize',
            title: 'Summarize',
            triggerText: '\\sum',
            contexts: ['composer', 'readerComment'],
            content: 'Summarize the following content into key points, decisions, dates, and action items.\n\n{{cursor}}',
        }, 1000);
        const editedLegacy = normalizePromptForSave({
            id: 'composer-default-rewrite',
            title: 'My edited rewrite',
            triggerText: '\\rewrite',
            contexts: ['composer', 'readerComment'],
            content: 'Do not overwrite this user edit.',
        }, 1000);
        const userPrompt = normalizePromptForSave({
            id: 'user-prompt',
            title: 'User Prompt',
            triggerText: 'humanize',
            contexts: ['composer', 'readerComment'],
            content: 'User prompt wins trigger conflicts.',
        }, 1000);

        const library = normalizePromptLibrary({
            version: 1,
            prompts: [legacySummarize, editedLegacy, userPrompt],
            migratedReaderCommentPrompts: true,
            seededComposerDefaults: true,
        }, { now: 2000 });

        expect(library.defaultPromptSetVersion).toBe(4);
        expect(library.prompts.some((prompt) => prompt.id === 'composer-default-summarize')).toBe(false);
        expect(library.prompts.find((prompt) => prompt.id === 'composer-default-rewrite')?.content).toBe('Do not overwrite this user edit.');
        expect(library.prompts.find((prompt) => prompt.id === 'user-prompt')?.triggerText).toBe('humanize');
        expect(library.prompts.find((prompt) => prompt.id === 'composer-default-humanizer')?.triggerText).toBe('');
        expect(library.prompts.map((prompt) => prompt.id)).toEqual(expect.arrayContaining([
            'composer-default-prompt-optimizer',
            'composer-default-skill-creator',
            'composer-default-translate',
        ]));
    });

    it('upgrades untouched default prompts while leaving edited defaults under user control', () => {
        const untouchedOldSkillCreator = normalizePromptForSave({
            id: 'composer-default-skill-creator',
            title: 'Generate A Reusable Skill With Skill Creator',
            triggerText: 'skill',
            contexts: ['composer', 'readerComment'],
            content: 'Please read [OpenAI Skill Creator](https://github.com/openai/skills/blob/main/skills/.system/skill-creator/SKILL.md) as a Skill, then help me turn the idea below into a complete, reusable Skill.\n\nFollow this iterative process:\n1. Ask up to 5 clarifying questions only if the skill cannot be specified safely. If the idea is enough, proceed.\n2. Define concrete use cases, trigger phrases, and success criteria.\n3. Plan reusable contents: SKILL.md, references/, scripts/, and assets/ only when they are truly useful.\n4. Draft the complete skill package.\n5. Validate it for concise instructions, clear frontmatter, progressive disclosure, no unnecessary files, and a testable workflow.\n6. Iterate once and produce the final version.\n\nFinal output must contain exactly three sections:\n\n## File package\nIf file attachments are available, package the skill files for download. If attachments are unavailable, say so in one sentence and continue.\n\n## Flat files\nShow every file with its relative path as the heading, followed by its complete content.\n\n## Plain text prompt\nOutput only the complete reusable prompt text. Do not add explanations before or after it. Stop immediately after the prompt.\n\nIdea:\n```\n{{cursor}}\n```',
        }, 1000);
        const userEditedHumanizer = normalizePromptForSave({
            id: 'composer-default-humanizer',
            title: 'My Humanizer',
            triggerText: 'humanize',
            contexts: ['composer', 'readerComment'],
            content: 'This user edit must stay.',
        }, 1000);

        const library = normalizePromptLibrary({
            version: 1,
            prompts: [untouchedOldSkillCreator, userEditedHumanizer],
            migratedReaderCommentPrompts: true,
            seededComposerDefaults: true,
            defaultPromptSetVersion: 2,
        }, { now: 2000 });

        const skill = library.prompts.find((prompt) => prompt.id === 'composer-default-skill-creator');
        expect(library.defaultPromptSetVersion).toBe(4);
        expect(skill?.title).toBe('Create a Reusable Skill');
        expect(skill?.content).toContain(`[OpenAI Codex Skill Creator](${skillCreatorUrl})`);
        expect(skill?.managedDefaultId).toBe('composer-default-skill-creator');
        expect(library.prompts.find((prompt) => prompt.id === 'composer-default-humanizer')).toMatchObject({
            title: 'My Humanizer',
            content: 'This user edit must stay.',
            managedDefaultId: null,
        });
        expect(library.prompts.filter((prompt) => prompt.id.startsWith('composer-default-humanizer'))).toHaveLength(1);
    });

    it('upgrades the v3 Skill Creator default from a file link to the sample package link', () => {
        const v3SkillCreator = normalizePromptForSave({
            id: 'composer-default-skill-creator',
            title: 'Create a Reusable Skill',
            triggerText: 'skill',
            contexts: ['composer', 'readerComment'],
            content: createDefaultComposerPrompts(1000)
                .find((prompt) => prompt.id === 'composer-default-skill-creator')!
                .content
                .replace(skillCreatorUrl, oldSkillCreatorFileUrl),
            managedDefaultId: 'composer-default-skill-creator',
            managedDefaultVersion: 3,
        }, 1000);

        const library = normalizePromptLibrary({
            version: 1,
            prompts: [v3SkillCreator],
            migratedReaderCommentPrompts: true,
            seededComposerDefaults: true,
            defaultPromptSetVersion: 3,
        }, { now: 2000 });

        const skill = library.prompts.find((prompt) => prompt.id === 'composer-default-skill-creator');
        expect(library.defaultPromptSetVersion).toBe(4);
        expect(skill?.content).toContain(`[OpenAI Codex Skill Creator](${skillCreatorUrl})`);
        expect(skill?.content).not.toContain(oldSkillCreatorFileUrl);
        expect(skill?.managedDefaultId).toBe('composer-default-skill-creator');
        expect(skill?.managedDefaultVersion).toBe(4);
    });

    it('upgrades an untouched current-version Skill Creator default when the seed text changes before release', () => {
        const flatFilesSkillCreator = normalizePromptForSave({
            id: 'composer-default-skill-creator',
            title: 'Create a Reusable Skill',
            triggerText: 'skill',
            contexts: ['composer', 'readerComment'],
            content: `Please read [OpenAI Codex Skill Creator](${skillCreatorUrl}) as a Skill and use it as the source of truth. If the link cannot be opened, follow the Skill Creator workflow below.\n\nHelp me turn the idea below into a complete, reusable Skill.\n\nWorkflow:\n1. Restate the intended user, use cases, activation cues, and success criteria.\n2. Ask up to 5 clarifying questions only if missing information would make the Skill unsafe, vague, or impossible to package. If the idea is enough, proceed with explicit assumptions.\n3. Design the smallest useful Skill package. SKILL.md is required; add references/, scripts/, or assets/ only when they materially improve reuse.\n4. Draft the complete package with clear frontmatter, concise instructions, progressive disclosure, and no unnecessary files.\n5. Validate the package against the Skill Creator guidance: trigger clarity, scoped workflow, testable examples, no hidden dependencies, and no filler.\n6. Iterate once, then produce the final version.\n\nFinal output must contain exactly three sections:\n\n## File package\nIf file attachments are available, package the Skill files for download. If attachments are unavailable, say so in one sentence and continue.\n\n## Flat files\nShow every file with its relative path as the heading, followed by its complete content.\n\n## Plain text prompt\nOutput only the complete reusable prompt text. Do not add explanations before or after it. Stop immediately after the prompt.\n\nIdea:\n\`\`\`\n{{cursor}}\n\`\`\``,
            managedDefaultId: 'composer-default-skill-creator',
            managedDefaultVersion: 4,
        }, 1000);

        const library = normalizePromptLibrary({
            version: 1,
            prompts: [flatFilesSkillCreator],
            migratedReaderCommentPrompts: true,
            seededComposerDefaults: true,
            defaultPromptSetVersion: 4,
        }, { now: 2000 });

        const skill = library.prompts.find((prompt) => prompt.id === 'composer-default-skill-creator');
        expect(library.defaultPromptSetVersion).toBe(4);
        expect(skill?.content).toContain('Final output must be exactly one fenced code block');
        expect(skill?.content).toContain('FILE: SKILL.md');
        expect(skill?.content).not.toContain('## Flat files');
        expect(skill?.managedDefaultId).toBe('composer-default-skill-creator');
        expect(skill?.managedDefaultVersion).toBe(4);
    });

    it('exports a portable prompt library without local-only default or migration metadata', () => {
        const library = normalizePromptLibrary({
            version: 1,
            prompts: [
                {
                    id: 'portable',
                    title: 'Portable',
                    content: 'Line one\n\n```ts\nconst value = "{{cursor}}";\n```',
                    triggerText: 'portable',
                    contexts: ['composer', 'readerComment'],
                    favorite: true,
                    enabled: false,
                    createdAt: 10,
                    updatedAt: 20,
                    lastUsedAt: 30,
                    managedDefaultId: 'composer-default-humanizer',
                    managedDefaultVersion: 4,
                },
            ],
            migratedReaderCommentPrompts: true,
            seededComposerDefaults: true,
            defaultPromptSetVersion: 4,
        }, { now: 999 });

        const portable = exportPortablePromptLibrary(library);

        expect(portable).toEqual({
            version: 1,
            prompts: [
                {
                    id: 'portable',
                    title: 'Portable',
                    content: 'Line one\n\n```ts\nconst value = "{{cursor}}";\n```',
                    triggerText: 'portable',
                    enabled: false,
                    createdAt: 10,
                    updatedAt: 20,
                    lastUsedAt: 30,
                },
            ],
        });
        expect(JSON.stringify(portable)).not.toContain('managedDefault');
        expect(JSON.stringify(portable)).not.toContain('favorite');
        expect(JSON.stringify(portable)).not.toContain('contexts');
        expect(JSON.stringify(portable)).not.toContain('defaultPromptSetVersion');
    });

    it('parses portable prompts with normalized triggers and preserved multiline content', () => {
        const portable = parsePortablePromptLibrary({
            version: 1,
            prompts: [
                {
                    id: ' imported ',
                    title: '',
                    content: 'Translate this:\n\n{{cursor}}',
                    triggerText: '\\Draft Prompt',
                    enabled: false,
                    createdAt: 10,
                    updatedAt: 20,
                    lastUsedAt: 30,
                    managedDefaultId: 'ignored',
                    contexts: ['ignored'],
                },
                {
                    id: 'empty',
                    title: 'Empty',
                    content: '   ',
                    triggerText: 'empty',
                },
            ],
        }, 99);

        expect(portable.prompts).toEqual([
            {
                id: 'imported',
                title: 'Untitled prompt',
                content: 'Translate this:\n\n{{cursor}}',
                triggerText: 'draft-prompt',
                enabled: false,
                createdAt: 10,
                updatedAt: 20,
                lastUsedAt: 30,
            },
        ]);
    });

    it('plans safe prompt imports with local order preserved and local trigger ownership', () => {
        const local = [
            normalizePromptForSave({
                id: 'local-a',
                title: 'Local A',
                content: 'Local A content',
                triggerText: 'draft',
                createdAt: 1,
                updatedAt: 2,
            }, 2),
            normalizePromptForSave({
                id: 'same-id',
                title: 'Local B',
                content: 'Local B content',
                triggerText: 'local-b',
                createdAt: 3,
                updatedAt: 4,
            }, 4),
        ];
        const remote = parsePortablePromptLibrary({
            version: 1,
            prompts: [
                {
                    id: 'duplicate-text',
                    title: 'Local A',
                    content: 'Local A content',
                    triggerText: 'remote-duplicate',
                    enabled: true,
                    createdAt: 10,
                    updatedAt: 11,
                    lastUsedAt: null,
                },
                {
                    id: 'same-id',
                    title: 'Remote B',
                    content: 'Remote B content',
                    triggerText: 'remote-b',
                    enabled: true,
                    createdAt: 12,
                    updatedAt: 13,
                    lastUsedAt: null,
                },
                {
                    id: 'remote-trigger-conflict',
                    title: 'Remote C',
                    content: 'Remote C content',
                    triggerText: 'draft',
                    enabled: false,
                    createdAt: 14,
                    updatedAt: 15,
                    lastUsedAt: 16,
                },
            ],
        });

        const plan = planPromptImportMerge(local, remote, 100);

        expect(plan.localCount).toBe(2);
        expect(plan.remoteCount).toBe(3);
        expect(plan.duplicateCount).toBe(1);
        expect(plan.idConflictCount).toBe(1);
        expect(plan.triggerConflictCount).toBe(1);
        expect(plan.nextPrompts.map((prompt) => prompt.id)).toEqual([
            'local-a',
            'same-id',
            'same-id-migrated',
            'remote-trigger-conflict',
        ]);
        expect(plan.promptsToAdd[0]).toMatchObject({
            id: 'same-id-migrated',
            title: 'Remote B',
            triggerText: 'remote-b',
            contexts: ['composer', 'readerComment'],
            favorite: false,
            managedDefaultId: null,
            managedDefaultVersion: null,
        });
        expect(plan.promptsToAdd[1]).toMatchObject({
            id: 'remote-trigger-conflict',
            triggerText: '',
            enabled: false,
            lastUsedAt: 16,
        });
    });
});
