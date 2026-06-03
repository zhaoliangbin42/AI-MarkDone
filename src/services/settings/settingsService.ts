import { DEFAULT_SETTINGS, isSettingsCategory, type AppSettings, type SettingsCategory } from '../../core/settings/types';
import { normalizeExportSettings } from '../../core/settings/export';
import {
    migrateSortMode,
    loadAndNormalize,
    normalizeAppearanceSettings,
    normalizeBehaviorSettings,
    normalizeChatGPTBehaviorSettings,
    normalizeChatGPTDirectorySettings,
    normalizeFormulaSettings,
    normalizePlatformSettings,
    normalizeReaderContentMaxWidthPx,
} from '../../core/settings/migrations';
import { normalizeReaderCommentExportSettings } from '../../core/settings/readerCommentExport';

export { loadAndNormalize } from '../../core/settings/migrations';

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
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
                platforms: normalizePlatformSettings(mergeObject({ ...cur.platforms }, value)),
            };
            return { next };
        }
        case 'behavior': {
            const next: AppSettings = {
                ...cur,
                behavior: normalizeBehaviorSettings(mergeObject({ ...cur.behavior }, value)),
            };
            return { next };
        }
        case 'reader': {
            const patch = isRecord(value) ? value : {};
            const next: AppSettings = {
                ...cur,
                reader: {
                    renderCodeInReader: Boolean(
                        patch.renderCodeInReader
                        ?? cur.reader.renderCodeInReader
                        ?? DEFAULT_SETTINGS.reader.renderCodeInReader
                    ),
                    showOutlineInReader: Boolean(
                        patch.showOutlineInReader
                        ?? cur.reader.showOutlineInReader
                        ?? DEFAULT_SETTINGS.reader.showOutlineInReader
                    ),
                    contentMaxWidthPx: normalizeReaderContentMaxWidthPx(
                        patch.contentMaxWidthPx
                        ?? cur.reader.contentMaxWidthPx
                        ?? DEFAULT_SETTINGS.reader.contentMaxWidthPx
                    ),
                    commentExport: normalizeReaderCommentExportSettings({
                        ...cur.reader.commentExport,
                        ...(isRecord(patch.commentExport) ? patch.commentExport : {}),
                    }),
                },
            };
            return { next };
        }
        case 'formula': {
            const next: AppSettings = {
                ...cur,
                formula: normalizeFormulaSettings({
                    ...cur.formula,
                    ...(isRecord(value) ? value : {}),
                    assetActions: {
                        ...cur.formula.assetActions,
                        ...(isRecord((value as any)?.assetActions) ? (value as any).assetActions : {}),
                    },
                }, cur.behavior),
            };
            return { next };
        }
        case 'export': {
            const next: AppSettings = {
                ...cur,
                export: normalizeExportSettings({
                    ...cur.export,
                    ...(isRecord(value) ? value : {}),
                }),
            };
            return { next };
        }
        case 'chatgptDirectory': {
            const next: AppSettings = {
                ...cur,
                chatgptDirectory: normalizeChatGPTDirectorySettings({
                    ...cur.chatgptDirectory,
                    ...(isRecord(value) ? value : {}),
                }),
            };
            return { next };
        }
        case 'chatgptBehavior': {
            const next: AppSettings = {
                ...cur,
                chatgptBehavior: normalizeChatGPTBehaviorSettings({
                    ...cur.chatgptBehavior,
                    ...(isRecord(value) ? value : {}),
                }),
            };
            return { next };
        }
        case 'appearance': {
            const next: AppSettings = {
                ...cur,
                appearance: normalizeAppearanceSettings({
                    ...cur.appearance,
                    ...(isRecord(value) ? value : {}),
                }),
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
