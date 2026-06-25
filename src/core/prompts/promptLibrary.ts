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
};

export type PromptLibraryV1 = {
    version: 1;
    prompts: PromptRecord[];
    migratedReaderCommentPrompts: boolean;
    seededComposerDefaults: boolean;
};

export type PromptListContext = PromptContext | 'all';

type NormalizeOptions = {
    now?: number;
    readerCommentPrompts?: ReaderCommentPrompt[];
};

export const PROMPT_TRIGGER_PREFIX = '\\';
const LEGACY_PROMPT_TRIGGER_PREFIX = '/';
const UNIFIED_PROMPT_CONTEXTS: PromptContext[] = ['composer', 'readerComment'];

const DEFAULT_COMPOSER_PROMPTS: Array<Pick<PromptRecord, 'id' | 'title' | 'content' | 'triggerText' | 'contexts'>> = [
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
    const withPrefix = trimmed.startsWith(PROMPT_TRIGGER_PREFIX)
        ? trimmed
        : trimmed.startsWith(LEGACY_PROMPT_TRIGGER_PREFIX)
            ? `${PROMPT_TRIGGER_PREFIX}${trimmed.slice(1)}`
            : `${PROMPT_TRIGGER_PREFIX}${trimmed}`;
    const compact = withPrefix.replace(/\s+/g, '-');
    return compact.toLowerCase();
}

export function normalizePromptContexts(value: unknown): PromptContext[] {
    void value;
    return [...UNIFIED_PROMPT_CONTEXTS];
}

export function normalizePromptForSave(value: unknown, now: number = Date.now()): PromptRecord {
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
        enabled: true,
        createdAt,
        updatedAt: now,
        lastUsedAt,
    };
}

export function createDefaultComposerPrompts(now: number = Date.now()): PromptRecord[] {
    return DEFAULT_COMPOSER_PROMPTS.map((prompt) => normalizePromptForSave({
        ...prompt,
        favorite: false,
        enabled: true,
        createdAt: now,
        updatedAt: now,
        lastUsedAt: null,
    }, now));
}

function createBaseLibrary(value: unknown, now: number): PromptLibraryV1 {
    if (isRecord(value) && value.version === 1 && Array.isArray(value.prompts)) {
        return {
            version: 1,
            prompts: value.prompts.map((prompt) => normalizePromptForSave(prompt, now)),
            migratedReaderCommentPrompts: Boolean(value.migratedReaderCommentPrompts),
            seededComposerDefaults: Boolean(value.seededComposerDefaults),
        };
    }

    return {
        version: 1,
        prompts: [],
        migratedReaderCommentPrompts: false,
        seededComposerDefaults: false,
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

function isSamePromptText(left: Pick<PromptRecord, 'title' | 'content'>, right: Pick<PromptRecord, 'title' | 'content'>): boolean {
    return left.title === right.title && left.content === right.content;
}

function isDefaultReaderCommentPrompt(prompt: ReaderCommentPrompt): boolean {
    return createDefaultReaderCommentPrompts().some((defaultPrompt) => (
        defaultPrompt.id === prompt.id
        && defaultPrompt.title === prompt.title
        && defaultPrompt.content === prompt.content
    ));
}

function appendMigratedReaderPrompt(prompts: PromptRecord[], prompt: PromptRecord): PromptRecord[] {
    if (prompts.some((entry) => isSamePromptText(entry, prompt))) return prompts;
    if (!prompts.some((entry) => entry.id === prompt.id)) return [...prompts, prompt];
    return [...prompts, { ...prompt, id: createUniquePromptId(prompt.id, prompts) }];
}

export function addMissingDefaultComposerPrompts(prompts: PromptRecord[], now: number = Date.now()): PromptRecord[] {
    const existingIds = new Set(prompts.map((prompt) => prompt.id));
    const missingDefaults = createDefaultComposerPrompts(now).filter((prompt) => !existingIds.has(prompt.id));
    return mergeById([...prompts, ...missingDefaults]);
}

export function normalizePromptLibrary(value: unknown, options: NormalizeOptions = {}): PromptLibraryV1 {
    const now = options.now ?? Date.now();
    const library = createBaseLibrary(value, now);
    let prompts = mergeById([...library.prompts]);

    if (!library.seededComposerDefaults) {
        prompts = addMissingDefaultComposerPrompts(prompts, now);
        library.seededComposerDefaults = true;
    }

    if (!library.migratedReaderCommentPrompts) {
        const readerPrompts = (options.readerCommentPrompts ?? []).filter((prompt) => !isDefaultReaderCommentPrompt(prompt));
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

export function filterPromptRecords(
    prompts: PromptRecord[],
    options: { context?: PromptListContext; query?: string; includeDisabled?: boolean } = {},
): PromptRecord[] {
    const context = options.context ?? 'all';
    const query = (options.query ?? '').trim().toLowerCase();
    void options.includeDisabled;
    return prompts
        .filter((prompt) => context === 'all' || prompt.contexts.includes(context))
        .filter((prompt) => {
            if (!query) return true;
            return [
                prompt.triggerText,
                prompt.title,
                prompt.content,
            ].some((value) => value.toLowerCase().includes(query));
        })
        .sort((left, right) => {
            if (left.favorite !== right.favorite) return left.favorite ? -1 : 1;
            return (right.lastUsedAt ?? right.updatedAt) - (left.lastUsedAt ?? left.updatedAt);
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
