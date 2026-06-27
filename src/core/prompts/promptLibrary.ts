import { createDefaultReaderCommentPrompts, type ReaderCommentPrompt } from '../settings/readerCommentExport';

export type PromptContext = 'composer' | 'readerComment';

export type PromptRecord = {
    id: string;
    title: string;
    content: string;
    triggerText: string;
    contexts: PromptContext[];
    favorite: boolean;
    enabled: boolean;
    createdAt: number;
    updatedAt: number;
    lastUsedAt: number | null;
    managedDefaultId?: string | null;
    managedDefaultVersion?: number | null;
};

export type PromptLibraryV1 = {
    version: 1;
    prompts: PromptRecord[];
    migratedReaderCommentPrompts: boolean;
    seededComposerDefaults: boolean;
    defaultPromptSetVersion: number;
};

export type PortablePromptRecord = Pick<PromptRecord,
    | 'id'
    | 'title'
    | 'content'
    | 'triggerText'
    | 'enabled'
    | 'createdAt'
    | 'updatedAt'
    | 'lastUsedAt'
>;

export type PortablePromptLibraryV1 = {
    version: 1;
    prompts: PortablePromptRecord[];
};

export type PromptImportMergePlan = {
    localCount: number;
    remoteCount: number;
    promptsToAdd: PromptRecord[];
    duplicateCount: number;
    idConflictCount: number;
    triggerConflictCount: number;
    nextPrompts: PromptRecord[];
};

export type PromptListContext = PromptContext | 'all';

type NormalizeOptions = {
    now?: number;
    readerCommentPrompts?: ReaderCommentPrompt[];
};

export const PROMPT_TRIGGER_PREFIX = '\\';
const LEGACY_PROMPT_TRIGGER_PREFIX = '/';
const UNIFIED_PROMPT_CONTEXTS: PromptContext[] = ['composer', 'readerComment'];
export const DEFAULT_PROMPT_SET_VERSION = 4;
const OPENAI_CODEX_SKILL_CREATOR_URL = 'https://github.com/openai/codex/tree/main/codex-rs/skills/src/assets/samples/skill-creator';
const OPENAI_CODEX_SKILL_CREATOR_V3_URL = 'https://github.com/openai/codex/blob/main/codex-rs/skills/src/assets/samples/skill-creator/SKILL.md';
const PRESERVED_READER_DEFAULT_PROMPT_IDS = new Set(['prompt-2']);

type PromptSeed = Pick<PromptRecord, 'id' | 'title' | 'content' | 'triggerText' | 'contexts'>;

const HUMANIZER_PROMPT_CONTENT = 'Please read [blader/humanizer](https://github.com/blader/humanizer) as a Skill, then use humanizer to polish the following text.\n\nKeep the original meaning, facts, structure, and language unless a small change makes the writing more natural.\n\nText:\n```\n{{cursor}}\n```';
const PROMPT_OPTIMIZER_CONTENT = 'Act as a prompt optimization skill.\n\nTransform the rough idea below into a high-quality prompt that can be reused in ChatGPT.\n\nFollow this process:\n1. Identify the real task, target user, expected output, constraints, and missing context.\n2. If critical information is missing, make reasonable assumptions and list them briefly.\n3. Rewrite the idea as a structured prompt using Role, Goal, Context, Workflow, Output Format, Constraints, and Quality Bar.\n4. Keep the final prompt concise, specific, and directly usable.\n\nReturn:\n- Improved Prompt\n- Assumptions\n- Why it is better\n\nRough idea:\n```\n{{cursor}}\n```';
const SKILL_CREATOR_FLAT_FILES_PROMPT_CONTENT = `Please read [OpenAI Codex Skill Creator](${OPENAI_CODEX_SKILL_CREATOR_URL}) as a Skill and use it as the source of truth. If the link cannot be opened, follow the Skill Creator workflow below.\n\nHelp me turn the idea below into a complete, reusable Skill.\n\nWorkflow:\n1. Restate the intended user, use cases, activation cues, and success criteria.\n2. Ask up to 5 clarifying questions only if missing information would make the Skill unsafe, vague, or impossible to package. If the idea is enough, proceed with explicit assumptions.\n3. Design the smallest useful Skill package. SKILL.md is required; add references/, scripts/, or assets/ only when they materially improve reuse.\n4. Draft the complete package with clear frontmatter, concise instructions, progressive disclosure, and no unnecessary files.\n5. Validate the package against the Skill Creator guidance: trigger clarity, scoped workflow, testable examples, no hidden dependencies, and no filler.\n6. Iterate once, then produce the final version.\n\nFinal output must contain exactly three sections:\n\n## File package\nIf file attachments are available, package the Skill files for download. If attachments are unavailable, say so in one sentence and continue.\n\n## Flat files\nShow every file with its relative path as the heading, followed by its complete content.\n\n## Plain text prompt\nOutput only the complete reusable prompt text. Do not add explanations before or after it. Stop immediately after the prompt.\n\nIdea:\n\`\`\`\n{{cursor}}\n\`\`\``;
const SKILL_CREATOR_PROMPT_CONTENT = `Please read [OpenAI Codex Skill Creator](${OPENAI_CODEX_SKILL_CREATOR_URL}) as a Skill and use it as the source of truth. If the link cannot be opened, follow the Skill Creator workflow below.\n\nHelp me turn the idea below into a complete, reusable Skill package, then wrap that package inside one self-contained reusable prompt.\n\nWorkflow:\n1. Restate the intended user, use cases, activation cues, and success criteria.\n2. Ask up to 5 clarifying questions only if missing information would make the Skill unsafe, vague, or impossible to package. If the idea is enough, proceed with explicit assumptions.\n3. Design the smallest useful Skill package. SKILL.md is required; add references/, scripts/, or assets/ only when they materially improve reuse.\n4. Draft every needed file internally, including complete file paths and full contents. Do not expose these as separate flat-file sections in the final answer.\n5. Validate the package against the Skill Creator guidance: trigger clarity, scoped workflow, progressive disclosure, testable examples, no hidden dependencies, and no filler.\n6. Iterate once internally, then produce a single portable prompt that embeds the whole package.\n\nFinal output must be exactly one fenced code block labeled text. Do not add explanations before or after it.\n\nThe code block must contain one complete reusable prompt. That reusable prompt must:\n- Tell the future assistant to create/use the Skill from the embedded package.\n- Include the Skill goal, activation cues, and success criteria.\n- Embed every file with a clear path boundary using this exact format:\n  FILE: SKILL.md\n  CONTENT:\n  <complete file content>\n  END FILE\n- Include all supporting files the package needs, such as references/*, scripts/*, or assets/*, using the same FILE/CONTENT/END FILE format.\n- Include any setup, execution, or validation notes inside the reusable prompt itself.\n- Be self-contained so copying the code block gives the user everything needed to recreate or reuse the Skill.\n\nDo not output a File package section. Do not output a Flat files section. Do not output separate files outside the code block.\n\nIdea:\n\`\`\`\n{{cursor}}\n\`\`\``;
const TRANSLATE_PROMPT_CONTENT = 'Translate the following text naturally.\n\nRules:\n- If the text is mostly Chinese, translate it into English.\n- If the text is mostly English, translate it into Chinese.\n- Preserve names, terminology, links, Markdown, code blocks, formulas, and list structure.\n- Keep the tone natural instead of literal.\n\nText:\n```\n{{cursor}}\n```';

const DEFAULT_COMPOSER_PROMPTS: PromptSeed[] = [
    {
        id: 'composer-default-humanizer',
        title: 'Humanize Text With a Skill',
        triggerText: 'humanize',
        contexts: UNIFIED_PROMPT_CONTEXTS,
        content: HUMANIZER_PROMPT_CONTENT,
    },
    {
        id: 'composer-default-prompt-optimizer',
        title: 'Turn Rough Ideas Into Prompts',
        triggerText: 'prompt',
        contexts: UNIFIED_PROMPT_CONTEXTS,
        content: PROMPT_OPTIMIZER_CONTENT,
    },
    {
        id: 'composer-default-skill-creator',
        title: 'Create a Reusable Skill',
        triggerText: 'skill',
        contexts: UNIFIED_PROMPT_CONTEXTS,
        content: SKILL_CREATOR_PROMPT_CONTENT,
    },
    {
        id: 'composer-default-translate',
        title: 'Translate Naturally',
        triggerText: 'translate',
        contexts: UNIFIED_PROMPT_CONTEXTS,
        content: TRANSLATE_PROMPT_CONTENT,
    },
];

const PREVIOUS_DEFAULT_COMPOSER_PROMPTS: PromptSeed[] = [
    {
        id: 'composer-default-humanizer',
        title: 'Humanize Text With a Skill',
        triggerText: 'humanize',
        contexts: UNIFIED_PROMPT_CONTEXTS,
        content: HUMANIZER_PROMPT_CONTENT,
    },
    {
        id: 'composer-default-prompt-optimizer',
        title: 'Turn Rough Ideas Into Prompts',
        triggerText: 'prompt',
        contexts: UNIFIED_PROMPT_CONTEXTS,
        content: PROMPT_OPTIMIZER_CONTENT,
    },
    {
        id: 'composer-default-skill-creator',
        title: 'Create a Reusable Skill',
        triggerText: 'skill',
        contexts: UNIFIED_PROMPT_CONTEXTS,
        content: SKILL_CREATOR_FLAT_FILES_PROMPT_CONTENT,
    },
    {
        id: 'composer-default-skill-creator',
        title: 'Create a Reusable Skill',
        triggerText: 'skill',
        contexts: UNIFIED_PROMPT_CONTEXTS,
        content: SKILL_CREATOR_FLAT_FILES_PROMPT_CONTENT.replace(OPENAI_CODEX_SKILL_CREATOR_URL, OPENAI_CODEX_SKILL_CREATOR_V3_URL),
    },
    {
        id: 'composer-default-skill-creator',
        title: 'Create a Reusable Skill',
        triggerText: 'skill',
        contexts: UNIFIED_PROMPT_CONTEXTS,
        content: SKILL_CREATOR_PROMPT_CONTENT.replace(OPENAI_CODEX_SKILL_CREATOR_URL, OPENAI_CODEX_SKILL_CREATOR_V3_URL),
    },
    {
        id: 'composer-default-translate',
        title: 'Translate Naturally',
        triggerText: 'translate',
        contexts: UNIFIED_PROMPT_CONTEXTS,
        content: TRANSLATE_PROMPT_CONTENT,
    },
    {
        id: 'composer-default-humanizer',
        title: 'Polish With Humanizer Skills',
        triggerText: 'humanize',
        contexts: UNIFIED_PROMPT_CONTEXTS,
        content: HUMANIZER_PROMPT_CONTENT,
    },
    {
        id: 'composer-default-prompt-optimizer',
        title: 'Turn A Rough Idea Into A High-Quality Prompt',
        triggerText: 'prompt',
        contexts: UNIFIED_PROMPT_CONTEXTS,
        content: PROMPT_OPTIMIZER_CONTENT,
    },
    {
        id: 'composer-default-skill-creator',
        title: 'Generate A Reusable Skill With Skill Creator',
        triggerText: 'skill',
        contexts: UNIFIED_PROMPT_CONTEXTS,
        content: 'Please read [OpenAI Skill Creator](https://github.com/openai/skills/blob/main/skills/.system/skill-creator/SKILL.md) as a Skill, then help me turn the idea below into a complete, reusable Skill.\n\nFollow this iterative process:\n1. Ask up to 5 clarifying questions only if the skill cannot be specified safely. If the idea is enough, proceed.\n2. Define concrete use cases, trigger phrases, and success criteria.\n3. Plan reusable contents: SKILL.md, references/, scripts/, and assets/ only when they are truly useful.\n4. Draft the complete skill package.\n5. Validate it for concise instructions, clear frontmatter, progressive disclosure, no unnecessary files, and a testable workflow.\n6. Iterate once and produce the final version.\n\nFinal output must contain exactly three sections:\n\n## File package\nIf file attachments are available, package the skill files for download. If attachments are unavailable, say so in one sentence and continue.\n\n## Flat files\nShow every file with its relative path as the heading, followed by its complete content.\n\n## Plain text prompt\nOutput only the complete reusable prompt text. Do not add explanations before or after it. Stop immediately after the prompt.\n\nIdea:\n```\n{{cursor}}\n```',
    },
    {
        id: 'composer-default-translate',
        title: 'Translate Naturally And Preserve Formatting',
        triggerText: 'translate',
        contexts: UNIFIED_PROMPT_CONTEXTS,
        content: TRANSLATE_PROMPT_CONTENT,
    },
];

const LEGACY_DEFAULT_COMPOSER_PROMPTS: PromptSeed[] = [
    {
        id: 'composer-default-summarize',
        title: 'Summarize',
        triggerText: '\\sum',
        contexts: UNIFIED_PROMPT_CONTEXTS,
        content: 'Summarize the following content into key points, decisions, dates, and action items.\n\n{{cursor}}',
    },
    {
        id: 'composer-default-rewrite',
        title: 'Rewrite Clearly',
        triggerText: '\\rewrite',
        contexts: UNIFIED_PROMPT_CONTEXTS,
        content: 'Rewrite the following text to be clearer, more concise, and more natural while preserving the original meaning.\n\n{{cursor}}',
    },
    {
        id: 'composer-default-translate',
        title: 'Translate Naturally',
        triggerText: '\\translate',
        contexts: UNIFIED_PROMPT_CONTEXTS,
        content: 'Translate the following text naturally. Preserve terminology, tone, names, and formatting.\n\n{{cursor}}',
    },
    {
        id: 'composer-default-brainstorm',
        title: 'Brainstorm Options',
        triggerText: '\\brainstorm',
        contexts: UNIFIED_PROMPT_CONTEXTS,
        content: 'Brainstorm several practical options for the following goal. Include tradeoffs and recommend the best path.\n\n{{cursor}}',
    },
    {
        id: 'composer-default-review',
        title: 'Review And Improve',
        triggerText: '\\review',
        contexts: UNIFIED_PROMPT_CONTEXTS,
        content: 'Review the following work. Start with the most important issues or risks, then suggest concrete improvements.\n\n{{cursor}}',
    },
];

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
}

function normalizeTimestamp(value: unknown, fallback: number): number {
    return Number.isFinite(value) ? Number(value) : fallback;
}

function normalizeEnabled(value: unknown): boolean {
    return typeof value === 'boolean' ? value : true;
}

function isKnownDefaultPromptId(value: string): boolean {
    return DEFAULT_COMPOSER_PROMPTS.some((prompt) => prompt.id === value);
}

function normalizeManagedDefaultId(value: unknown): string | null {
    if (typeof value !== 'string') return null;
    const id = value.trim();
    return id && isKnownDefaultPromptId(id) ? id : null;
}

function normalizeManagedDefaultVersion(value: unknown): number | null {
    return Number.isFinite(value) ? Number(value) : null;
}

function normalizeId(value: unknown, now: number): string {
    if (typeof value === 'string' && value.trim()) return value.trim();
    return `prompt_${Math.max(0, Math.round(now)).toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeTitle(value: unknown): string {
    return typeof value === 'string' && value.trim() ? value.trim() : 'Untitled prompt';
}

export function normalizeTriggerText(value: unknown): string {
    if (typeof value !== 'string') return '';
    const trimmed = value.trim();
    if (!trimmed || trimmed === PROMPT_TRIGGER_PREFIX || trimmed === LEGACY_PROMPT_TRIGGER_PREFIX) return '';
    const withoutPrefix = trimmed.startsWith(PROMPT_TRIGGER_PREFIX) || trimmed.startsWith(LEGACY_PROMPT_TRIGGER_PREFIX)
        ? trimmed.slice(1)
        : trimmed;
    const compact = withoutPrefix.replace(/\s+/g, '-');
    return compact.toLowerCase();
}

export function normalizePromptContexts(value: unknown): PromptContext[] {
    void value;
    return [...UNIFIED_PROMPT_CONTEXTS];
}

function normalizePromptRecord(value: unknown, now: number, mode: 'read' | 'save'): PromptRecord {
    const record = isRecord(value) ? value : {};
    const createdAt = normalizeTimestamp(record.createdAt, now);
    const lastUsedAt = Number.isFinite(record.lastUsedAt) ? Number(record.lastUsedAt) : null;
    return {
        id: normalizeId(record.id, now),
        title: normalizeTitle(record.title),
        content: typeof record.content === 'string' ? record.content : '',
        triggerText: normalizeTriggerText(record.triggerText),
        contexts: normalizePromptContexts(record.contexts),
        favorite: Boolean(record.favorite),
        enabled: normalizeEnabled(record.enabled),
        createdAt,
        updatedAt: mode === 'save' ? now : normalizeTimestamp(record.updatedAt, createdAt),
        lastUsedAt,
        managedDefaultId: normalizeManagedDefaultId(record.managedDefaultId),
        managedDefaultVersion: normalizeManagedDefaultVersion(record.managedDefaultVersion),
    };
}

function normalizePromptForRead(value: unknown, now: number = Date.now()): PromptRecord {
    return normalizePromptRecord(value, now, 'read');
}

export function normalizePromptForSave(value: unknown, now: number = Date.now()): PromptRecord {
    return normalizePromptRecord(value, now, 'save');
}

export function createDefaultComposerPrompts(now: number = Date.now()): PromptRecord[] {
    return DEFAULT_COMPOSER_PROMPTS.map((prompt) => createManagedDefaultPrompt(prompt, now));
}

function createBaseLibrary(value: unknown, now: number): PromptLibraryV1 {
    if (isRecord(value) && value.version === 1 && Array.isArray(value.prompts)) {
        return {
            version: 1,
            prompts: value.prompts.map((prompt) => normalizePromptForRead(prompt, now)),
            migratedReaderCommentPrompts: Boolean(value.migratedReaderCommentPrompts),
            seededComposerDefaults: Boolean(value.seededComposerDefaults),
            defaultPromptSetVersion: Number.isFinite(value.defaultPromptSetVersion)
                ? Number(value.defaultPromptSetVersion)
                : (value.seededComposerDefaults ? 1 : 0),
        };
    }

    return {
        version: 1,
        prompts: [],
        migratedReaderCommentPrompts: false,
        seededComposerDefaults: false,
        defaultPromptSetVersion: 0,
    };
}

function mergeById(prompts: PromptRecord[]): PromptRecord[] {
    const seen = new Map<string, PromptRecord>();
    const result: PromptRecord[] = [];
    for (const prompt of prompts) {
        if (!seen.has(prompt.id)) {
            seen.set(prompt.id, prompt);
            result.push(prompt);
            continue;
        }
        const existing = seen.get(prompt.id)!;
        if (existing.title === prompt.title && existing.content === prompt.content) continue;
        const renamed = { ...prompt, id: createUniquePromptId(prompt.id, result) };
        seen.set(renamed.id, renamed);
        result.push(renamed);
    }
    return result;
}

function createUniquePromptId(baseId: string, prompts: PromptRecord[]): string {
    const existingIds = new Set(prompts.map((prompt) => prompt.id));
    const base = baseId.trim() || 'prompt';
    let index = 1;
    let candidate = `${base}-migrated`;
    while (existingIds.has(candidate)) {
        index += 1;
        candidate = `${base}-migrated-${index}`;
    }
    return candidate;
}

function createManagedDefaultPrompt(seed: PromptSeed, now: number, existing?: PromptRecord): PromptRecord {
    const prompt = normalizePromptForSave({
        ...seed,
        favorite: false,
        enabled: true,
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
        lastUsedAt: existing?.lastUsedAt ?? null,
        managedDefaultId: seed.id,
        managedDefaultVersion: DEFAULT_PROMPT_SET_VERSION,
    }, now);
    return {
        ...prompt,
        id: existing?.id ?? prompt.id,
        createdAt: existing?.createdAt ?? prompt.createdAt,
        lastUsedAt: existing?.lastUsedAt ?? prompt.lastUsedAt,
    };
}

function isSamePromptText(left: Pick<PromptRecord, 'title' | 'content'>, right: Pick<PromptRecord, 'title' | 'content'>): boolean {
    return left.title === right.title && left.content === right.content;
}

function hasSameContexts(left: PromptContext[], right: PromptContext[]): boolean {
    return left.length === right.length && left.every((context) => right.includes(context));
}

function isDefaultPromptRecordId(recordId: string, defaultId: string): boolean {
    return recordId === defaultId || recordId.startsWith(`${defaultId}-migrated`);
}

function promptMatchesSeed(prompt: PromptRecord, seed: PromptSeed): boolean {
    return prompt.title === seed.title
        && prompt.content === seed.content
        && (prompt.triggerText === seed.triggerText || prompt.triggerText === '')
        && prompt.enabled === true
        && prompt.favorite === false
        && hasSameContexts(prompt.contexts, seed.contexts);
}

function inferManagedDefaultId(prompt: PromptRecord): string | null {
    const declaredDefaultId = normalizeManagedDefaultId(prompt.managedDefaultId);
    if (declaredDefaultId) {
        const snapshots = [DEFAULT_COMPOSER_PROMPTS, PREVIOUS_DEFAULT_COMPOSER_PROMPTS].flat()
            .filter((seed) => seed.id === declaredDefaultId);
        if (snapshots.some((seed) => promptMatchesSeed(prompt, seed))) return declaredDefaultId;
        return null;
    }

    const snapshots = [DEFAULT_COMPOSER_PROMPTS, PREVIOUS_DEFAULT_COMPOSER_PROMPTS].flat();
    const match = snapshots.find((seed) => isDefaultPromptRecordId(prompt.id, seed.id) && promptMatchesSeed(prompt, seed));
    return match?.id ?? null;
}

function occupiesDefaultPromptSlot(prompt: PromptRecord, defaultId: string): boolean {
    return prompt.id === defaultId
        || prompt.managedDefaultId === defaultId
        || prompt.id.startsWith(`${defaultId}-migrated`);
}

function findCurrentDefaultSeed(defaultId: string): PromptSeed | null {
    return DEFAULT_COMPOSER_PROMPTS.find((prompt) => prompt.id === defaultId) ?? null;
}

function isCurrentManagedDefaultPrompt(prompt: PromptRecord, defaultId: string): boolean {
    const seed = findCurrentDefaultSeed(defaultId);
    return Boolean(
        seed
        && promptMatchesSeed(prompt, seed)
        && prompt.managedDefaultId === defaultId
        && prompt.managedDefaultVersion === DEFAULT_PROMPT_SET_VERSION,
    );
}

function hasManagedDefaultDrift(prompts: PromptRecord[]): boolean {
    return prompts.some((prompt) => {
        const defaultId = inferManagedDefaultId(prompt);
        return Boolean(defaultId && !isCurrentManagedDefaultPrompt(prompt, defaultId));
    });
}

function upgradeManagedDefaultPrompts(prompts: PromptRecord[], now: number): PromptRecord[] {
    return prompts.map((prompt) => {
        const defaultId = inferManagedDefaultId(prompt);
        if (!defaultId) {
            return prompt.managedDefaultId
                ? { ...prompt, managedDefaultId: null, managedDefaultVersion: null }
                : prompt;
        }
        const seed = findCurrentDefaultSeed(defaultId);
        if (!seed) return { ...prompt, managedDefaultId: null, managedDefaultVersion: null };
        if (isCurrentManagedDefaultPrompt(prompt, defaultId)) return prompt;
        const upgraded = createManagedDefaultPrompt(seed, now, prompt);
        const triggerText = hasTriggerConflict(prompts.filter((entry) => entry.id !== prompt.id), upgraded)
            ? ''
            : upgraded.triggerText;
        return { ...upgraded, triggerText };
    });
}

export function preparePromptForUserSave(existing: PromptRecord | undefined, prompt: PromptRecord): PromptRecord {
    const defaultId = existing ? inferManagedDefaultId(existing) : inferManagedDefaultId(prompt);
    if (!defaultId) return { ...prompt, managedDefaultId: null, managedDefaultVersion: null };
    const seed = findCurrentDefaultSeed(defaultId);
    if (!seed || !promptMatchesSeed(prompt, seed)) {
        return { ...prompt, managedDefaultId: null, managedDefaultVersion: null };
    }
    return {
        ...prompt,
        managedDefaultId: defaultId,
        managedDefaultVersion: DEFAULT_PROMPT_SET_VERSION,
    };
}

function isDefaultReaderCommentPrompt(prompt: ReaderCommentPrompt): boolean {
    return createDefaultReaderCommentPrompts().some((defaultPrompt) => (
        defaultPrompt.id === prompt.id
        && defaultPrompt.title === prompt.title
        && defaultPrompt.content === prompt.content
    ));
}

function shouldMigrateReaderCommentPrompt(prompt: ReaderCommentPrompt): boolean {
    if (!isDefaultReaderCommentPrompt(prompt)) return true;
    return PRESERVED_READER_DEFAULT_PROMPT_IDS.has(prompt.id);
}

function appendMigratedReaderPrompt(prompts: PromptRecord[], prompt: PromptRecord): PromptRecord[] {
    if (prompts.some((entry) => isSamePromptText(entry, prompt))) return prompts;
    if (!prompts.some((entry) => entry.id === prompt.id)) return [...prompts, prompt];
    return [...prompts, { ...prompt, id: createUniquePromptId(prompt.id, prompts) }];
}

function createLegacyDefaultComposerPrompts(now: number): PromptRecord[] {
    return LEGACY_DEFAULT_COMPOSER_PROMPTS.map((prompt) => normalizePromptForSave({
        ...prompt,
        favorite: false,
        enabled: true,
        createdAt: now,
        updatedAt: now,
        lastUsedAt: null,
    }, now));
}

function isUnchangedLegacyDefaultPrompt(prompt: PromptRecord): boolean {
    return createLegacyDefaultComposerPrompts(prompt.createdAt).some((legacyPrompt) => (
        legacyPrompt.id === prompt.id
        && legacyPrompt.title === prompt.title
        && legacyPrompt.content === prompt.content
        && legacyPrompt.triggerText === prompt.triggerText
    ));
}

function hasTriggerConflict(prompts: PromptRecord[], prompt: Pick<PromptRecord, 'id' | 'triggerText'>): boolean {
    if (!prompt.triggerText) return false;
    return prompts.some((entry) => entry.id !== prompt.id && entry.triggerText === prompt.triggerText);
}

export function addMissingDefaultComposerPrompts(prompts: PromptRecord[], now: number = Date.now()): PromptRecord[] {
    const next = [...prompts];
    for (const defaultPrompt of createDefaultComposerPrompts(now)) {
        if (next.some((prompt) => occupiesDefaultPromptSlot(prompt, defaultPrompt.managedDefaultId ?? defaultPrompt.id))) continue;
        if (next.some((prompt) => isSamePromptText(prompt, defaultPrompt))) continue;
        const prompt = next.some((entry) => entry.id === defaultPrompt.id)
            ? { ...defaultPrompt, id: createUniquePromptId(defaultPrompt.id, next) }
            : defaultPrompt;
        next.push(hasTriggerConflict(next, prompt) ? { ...prompt, triggerText: '' } : prompt);
    }
    return mergeById(next);
}

export function normalizePromptLibrary(value: unknown, options: NormalizeOptions = {}): PromptLibraryV1 {
    const now = options.now ?? Date.now();
    const library = createBaseLibrary(value, now);
    let prompts = mergeById([...library.prompts]);

    if (library.defaultPromptSetVersion < DEFAULT_PROMPT_SET_VERSION || hasManagedDefaultDrift(prompts)) {
        prompts = upgradeManagedDefaultPrompts(prompts, now);
        prompts = prompts.filter((prompt) => !isUnchangedLegacyDefaultPrompt(prompt));
        prompts = addMissingDefaultComposerPrompts(prompts, now);
        library.seededComposerDefaults = true;
        library.defaultPromptSetVersion = DEFAULT_PROMPT_SET_VERSION;
    } else if (!library.seededComposerDefaults) {
        prompts = addMissingDefaultComposerPrompts(prompts, now);
        library.seededComposerDefaults = true;
        library.defaultPromptSetVersion = DEFAULT_PROMPT_SET_VERSION;
    }

    if (!library.migratedReaderCommentPrompts) {
        const readerPrompts = (options.readerCommentPrompts ?? []).filter(shouldMigrateReaderCommentPrompt);
        prompts = readerPrompts.reduce((nextPrompts, prompt) => appendMigratedReaderPrompt(nextPrompts, normalizePromptForSave({
            id: prompt.id,
            title: prompt.title,
            content: prompt.content,
            triggerText: '',
            contexts: UNIFIED_PROMPT_CONTEXTS,
            favorite: false,
            enabled: true,
            createdAt: now,
            updatedAt: now,
            lastUsedAt: null,
        }, now)), prompts);
        library.migratedReaderCommentPrompts = true;
    }

    return {
        ...library,
        prompts: mergeById(prompts),
    };
}

function toPortablePrompt(prompt: PromptRecord): PortablePromptRecord {
    return {
        id: prompt.id,
        title: prompt.title,
        content: prompt.content,
        triggerText: prompt.triggerText,
        enabled: prompt.enabled,
        createdAt: prompt.createdAt,
        updatedAt: prompt.updatedAt,
        lastUsedAt: prompt.lastUsedAt,
    };
}

export function exportPortablePromptLibrary(library: PromptLibraryV1): PortablePromptLibraryV1 {
    return {
        version: 1,
        prompts: library.prompts.map(toPortablePrompt),
    };
}

function normalizePortablePrompt(value: unknown, now: number): PortablePromptRecord | null {
    if (!isRecord(value)) return null;
    const prompt = normalizePromptForRead({
        id: value.id,
        title: value.title,
        content: value.content,
        triggerText: value.triggerText,
        enabled: value.enabled,
        createdAt: value.createdAt,
        updatedAt: value.updatedAt,
        lastUsedAt: value.lastUsedAt,
    }, now);
    if (!prompt.content.trim()) return null;
    return toPortablePrompt(prompt);
}

export function parsePortablePromptLibrary(value: unknown, now: number = Date.now()): PortablePromptLibraryV1 {
    const promptsInput = isRecord(value) && value.version === 1 && Array.isArray(value.prompts)
        ? value.prompts
        : Array.isArray(value)
            ? value
            : [];
    const prompts = promptsInput
        .map((prompt) => normalizePortablePrompt(prompt, now))
        .filter((prompt): prompt is PortablePromptRecord => Boolean(prompt));
    return {
        version: 1,
        prompts,
    };
}

function promptFromPortable(prompt: PortablePromptRecord, now: number): PromptRecord {
    return {
        ...normalizePromptForRead(prompt, now),
        contexts: [...UNIFIED_PROMPT_CONTEXTS],
        favorite: false,
        managedDefaultId: null,
        managedDefaultVersion: null,
    };
}

export function planPromptImportMerge(
    localPrompts: PromptRecord[],
    remoteLibrary: PortablePromptLibraryV1,
    now: number = Date.now(),
): PromptImportMergePlan {
    const nextPrompts = [...localPrompts];
    const promptsToAdd: PromptRecord[] = [];
    let duplicateCount = 0;
    let idConflictCount = 0;
    let triggerConflictCount = 0;

    for (const portablePrompt of remoteLibrary.prompts) {
        if (nextPrompts.some((prompt) => isSamePromptText(prompt, portablePrompt))) {
            duplicateCount += 1;
            continue;
        }

        let prompt = promptFromPortable(portablePrompt, now);
        if (nextPrompts.some((entry) => entry.id === prompt.id)) {
            idConflictCount += 1;
            prompt = { ...prompt, id: createUniquePromptId(prompt.id, nextPrompts) };
        }
        if (hasTriggerConflict(nextPrompts, prompt)) {
            triggerConflictCount += 1;
            prompt = { ...prompt, triggerText: '' };
        }

        nextPrompts.push(prompt);
        promptsToAdd.push(prompt);
    }

    return {
        localCount: localPrompts.length,
        remoteCount: remoteLibrary.prompts.length,
        promptsToAdd,
        duplicateCount,
        idConflictCount,
        triggerConflictCount,
        nextPrompts,
    };
}

function promptRecordsEqual(left: unknown, right: PromptRecord): boolean {
    if (!isRecord(left)) return false;
    const contexts = Array.isArray(left.contexts) ? left.contexts : [];
    return left.id === right.id
        && left.title === right.title
        && left.content === right.content
        && left.triggerText === right.triggerText
        && contexts.length === right.contexts.length
        && contexts.every((context, index) => context === right.contexts[index])
        && left.favorite === right.favorite
        && left.enabled === right.enabled
        && left.createdAt === right.createdAt
        && left.updatedAt === right.updatedAt
        && left.lastUsedAt === right.lastUsedAt
        && (left.managedDefaultId ?? null) === (right.managedDefaultId ?? null)
        && (left.managedDefaultVersion ?? null) === (right.managedDefaultVersion ?? null);
}

export function promptLibrariesEqual(left: unknown, right: PromptLibraryV1): boolean {
    if (!isRecord(left) || left.version !== right.version) return false;
    if (left.migratedReaderCommentPrompts !== right.migratedReaderCommentPrompts) return false;
    if (left.seededComposerDefaults !== right.seededComposerDefaults) return false;
    if (left.defaultPromptSetVersion !== right.defaultPromptSetVersion) return false;
    const leftPrompts = left.prompts;
    if (!Array.isArray(leftPrompts) || leftPrompts.length !== right.prompts.length) return false;
    return right.prompts.every((prompt, index) => promptRecordsEqual(leftPrompts[index], prompt));
}

export function filterPromptRecords(
    prompts: PromptRecord[],
    options: { context?: PromptListContext; query?: string; includeDisabled?: boolean; match?: 'full' | 'trigger' } = {},
): PromptRecord[] {
    const context = options.context ?? 'all';
    const query = (options.query ?? '').trim().toLowerCase();
    const match = options.match ?? 'full';
    return prompts
        .filter((prompt) => options.includeDisabled === true || prompt.enabled)
        .filter((prompt) => context === 'all' || prompt.contexts.includes(context))
        .filter((prompt) => {
            if (!query) return true;
            if (match === 'trigger') return prompt.triggerText.toLowerCase().startsWith(query);
            return [
                prompt.triggerText,
                prompt.title,
                prompt.content,
            ].some((value) => value.toLowerCase().includes(query));
        });
}

export function listTriggerConflicts(prompts: PromptRecord[]): string[] {
    const idsByTrigger = new Map<string, Set<string>>();
    for (const prompt of prompts) {
        if (!prompt.triggerText) continue;
        const set = idsByTrigger.get(prompt.triggerText) ?? new Set<string>();
        set.add(prompt.id);
        idsByTrigger.set(prompt.triggerText, set);
    }
    return Array.from(idsByTrigger.entries())
        .filter(([, ids]) => ids.size > 1)
        .map(([trigger]) => trigger)
        .sort();
}
