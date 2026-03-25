import { DEFAULT_SETTINGS, isSettingsCategory, type AppSettings, type SettingsCategory } from '../../core/settings/types';
import { mergeWithDefaults, migrateFromV1, migrateFromV2, migrateSortMode } from '../../core/settings/migrations';

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
}

export function loadAndNormalize(stored: unknown): AppSettings {
    if (!stored) return { ...DEFAULT_SETTINGS };
    if (!isRecord(stored)) return { ...DEFAULT_SETTINGS };

    const version = (stored as any).version;
    if (version === 3) return mergeWithDefaults(stored as AppSettings);
    if (version === 2) return migrateFromV2(stored);
    if (version === 1) return migrateFromV1(stored);

    return { ...DEFAULT_SETTINGS };
}

type PlanResult = { next: AppSettings };

function normalizeLanguage(value: unknown): AppSettings['language'] {
    return value === 'auto' || value === 'en' || value === 'zh_CN' ? value : DEFAULT_SETTINGS.language;
}

function mergeObject<T extends Record<string, any>>(base: T, patch: unknown): T {
    if (!isRecord(patch)) return base;
    return { ...base, ...patch } as T;
}

export function planSetCategory(current: AppSettings, category: SettingsCategory, value: unknown): PlanResult {
    const cur = loadAndNormalize(current);

    if (!isSettingsCategory(category)) {
        throw new Error(`Invalid category: ${String(category)}`);
    }

    switch (category) {
        case 'platforms': {
            const next: AppSettings = {
                ...cur,
                platforms: mergeObject({ ...DEFAULT_SETTINGS.platforms, ...cur.platforms }, value),
            };
            return { next };
        }
        case 'chatgpt': {
            const next: AppSettings = {
                ...cur,
                chatgpt: mergeObject({ ...DEFAULT_SETTINGS.chatgpt, ...cur.chatgpt }, value),
            };
            return { next };
        }
        case 'behavior': {
            const next: AppSettings = {
                ...cur,
                behavior: mergeObject({ ...DEFAULT_SETTINGS.behavior, ...cur.behavior }, value),
            };
            return { next };
        }
        case 'reader': {
            const next: AppSettings = {
                ...cur,
                reader: {
                    renderCodeInReader: Boolean(
                        (isRecord(value) ? value.renderCodeInReader : undefined)
                        ?? cur.reader.renderCodeInReader
                        ?? DEFAULT_SETTINGS.reader.renderCodeInReader
                    ),
                },
            };
            return { next };
        }
        case 'bookmarks': {
            const merged = mergeObject({ ...DEFAULT_SETTINGS.bookmarks, ...cur.bookmarks }, value);
            const next: AppSettings = {
                ...cur,
                bookmarks: { ...merged, sortMode: migrateSortMode(merged.sortMode) },
            };
            return { next };
        }
        case 'language': {
            const next: AppSettings = { ...cur, language: normalizeLanguage(value) };
            return { next };
        }
        default:
            return { next: cur };
    }
}

export function planReset(): PlanResult {
    return { next: { ...DEFAULT_SETTINGS } };
}

export function planGetCategory(settings: AppSettings, category: unknown): { category: SettingsCategory; value: unknown } {
    const normalized = loadAndNormalize(settings);
    if (!isSettingsCategory(category)) {
        throw new Error(`Invalid category: ${String(category)}`);
    }
    return { category, value: normalized[category] };
}

export function planGetAll(settings: AppSettings): { settings: AppSettings } {
    return { settings: loadAndNormalize(settings) };
}
