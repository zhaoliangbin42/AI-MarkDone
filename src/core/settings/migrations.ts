import {
    DEFAULT_GLOBAL_FONT_SIZE_PX,
    DEFAULT_READER_CONTENT_MAX_WIDTH_PX,
    GLOBAL_FONT_SIZE_STEP_PX,
    MAX_GLOBAL_FONT_SIZE_PX,
    MAX_READER_CONTENT_MAX_WIDTH_PX,
    MIN_GLOBAL_FONT_SIZE_PX,
    MIN_READER_CONTENT_MAX_WIDTH_PX,
    READER_CONTENT_MAX_WIDTH_STEP_PX,
    THEME_ACCENT_SWATCHES,
    DEFAULT_SETTINGS,
    type AppSettings,
    type ThemeAccentColor,
} from './types';
import { normalizeExportSettings } from './export';
import { DEFAULT_FORMULA_SETTINGS, type FormulaSettings } from './formula';
import { normalizeReaderCommentExportSettings } from './readerCommentExport';

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
}

export function normalizeBehaviorSettings(behavior: unknown): AppSettings['behavior'] {
    const record = isRecord(behavior) ? behavior : {};

    return {
        showSaveMessages: Boolean((record as any).showSaveMessages ?? DEFAULT_SETTINGS.behavior.showSaveMessages),
        showWordCount: Boolean((record as any).showWordCount ?? DEFAULT_SETTINGS.behavior.showWordCount),
        enableClickToCopy: Boolean((record as any).enableClickToCopy ?? DEFAULT_SETTINGS.behavior.enableClickToCopy),
        saveContextOnly: Boolean((record as any).saveContextOnly ?? DEFAULT_SETTINGS.behavior.saveContextOnly),
        _contextOnlyConfirmed: Boolean((record as any)._contextOnlyConfirmed ?? DEFAULT_SETTINGS.behavior._contextOnlyConfirmed),
    };
}

export function normalizePlatformSettings(platforms: unknown): AppSettings['platforms'] {
    const record = isRecord(platforms) ? platforms : {};
    return {
        chatgpt: Boolean((record as any).chatgpt ?? DEFAULT_SETTINGS.platforms.chatgpt),
    };
}

export function normalizeFormulaSettings(formula: unknown, legacyBehavior?: unknown): FormulaSettings {
    const record = isRecord(formula) ? formula : {};
    const legacyRecord = isRecord(legacyBehavior) ? legacyBehavior : {};
    const assetActions = isRecord((record as any).assetActions) ? (record as any).assetActions : {};
    const fallbackClickCopyMarkdown = (legacyRecord as any).enableClickToCopy ?? DEFAULT_FORMULA_SETTINGS.clickCopyMarkdown;

    return {
        clickCopyMarkdown: Boolean((record as any).clickCopyMarkdown ?? fallbackClickCopyMarkdown),
        assetActions: {
            copyPng: Boolean((assetActions as any).copyPng ?? DEFAULT_FORMULA_SETTINGS.assetActions.copyPng),
            copySvg: Boolean((assetActions as any).copySvg ?? DEFAULT_FORMULA_SETTINGS.assetActions.copySvg),
            copyMathml: Boolean((assetActions as any).copyMathml ?? DEFAULT_FORMULA_SETTINGS.assetActions.copyMathml),
            savePng: Boolean((assetActions as any).savePng ?? DEFAULT_FORMULA_SETTINGS.assetActions.savePng),
            saveSvg: Boolean((assetActions as any).saveSvg ?? DEFAULT_FORMULA_SETTINGS.assetActions.saveSvg),
        },
    };
}

export function migrateSortMode(oldMode: unknown): AppSettings['bookmarks']['sortMode'] {
    if (oldMode === 'alphabetical') return 'alpha-asc';
    if (oldMode === 'time') return 'time-desc';

    if (oldMode === 'time-desc' || oldMode === 'time-asc' || oldMode === 'alpha-asc' || oldMode === 'alpha-desc') {
        return oldMode;
    }

    return DEFAULT_SETTINGS.bookmarks.sortMode;
}

export function normalizeChatGPTDirectorySettings(value: unknown): AppSettings['chatgptDirectory'] {
    const record = isRecord(value) ? value : {};
    const mode = (record as any).mode === 'expanded' ? 'expanded' : DEFAULT_SETTINGS.chatgptDirectory.mode;
    const promptLabelMode = (record as any).promptLabelMode === 'headTail'
        ? 'headTail'
        : DEFAULT_SETTINGS.chatgptDirectory.promptLabelMode;

    return {
        enabled: false,
        mode,
        promptLabelMode,
    };
}

export function normalizeChatGPTBehaviorSettings(value: unknown): AppSettings['chatgptBehavior'] {
    const record = isRecord(value) ? value : {};
    return {
        restorePositionAfterSend: Boolean((record as any).restorePositionAfterSend ?? DEFAULT_SETTINGS.chatgptBehavior.restorePositionAfterSend),
        showMessageStepper: Boolean((record as any).showMessageStepper ?? DEFAULT_SETTINGS.chatgptBehavior.showMessageStepper),
        enableArrowKeyMessageNavigation: Boolean((record as any).enableArrowKeyMessageNavigation ?? DEFAULT_SETTINGS.chatgptBehavior.enableArrowKeyMessageNavigation),
    };
}

export function normalizeReaderContentMaxWidthPx(value: unknown): number {
    const numeric = typeof value === 'number' ? value : Number.parseInt(String(value ?? ''), 10);
    if (!Number.isFinite(numeric)) return DEFAULT_READER_CONTENT_MAX_WIDTH_PX;
    const clamped = Math.min(MAX_READER_CONTENT_MAX_WIDTH_PX, Math.max(MIN_READER_CONTENT_MAX_WIDTH_PX, numeric));
    return Math.round(clamped / READER_CONTENT_MAX_WIDTH_STEP_PX) * READER_CONTENT_MAX_WIDTH_STEP_PX;
}

export function normalizeGlobalFontSizePx(value: unknown): number {
    const numeric = typeof value === 'number' ? value : Number.parseInt(String(value ?? ''), 10);
    if (!Number.isFinite(numeric)) return DEFAULT_GLOBAL_FONT_SIZE_PX;
    const clamped = Math.min(MAX_GLOBAL_FONT_SIZE_PX, Math.max(MIN_GLOBAL_FONT_SIZE_PX, numeric));
    return Math.round(clamped / GLOBAL_FONT_SIZE_STEP_PX) * GLOBAL_FONT_SIZE_STEP_PX;
}

export function normalizeThemeAccentColor(value: unknown): ThemeAccentColor | null {
    if (typeof value !== 'string') return null;
    const normalized = value.trim().toLowerCase();
    const match = THEME_ACCENT_SWATCHES.find((swatch) => swatch.value === normalized);
    return match?.value ?? null;
}

export function normalizeAppearanceSettings(value: unknown): AppSettings['appearance'] {
    const record = isRecord(value) ? value : {};
    return {
        fontSizePx: normalizeGlobalFontSizePx((record as any).fontSizePx),
        accentColor: normalizeThemeAccentColor((record as any).accentColor),
    };
}

export function loadAndNormalize(stored: unknown): AppSettings {
    if (!stored) return { ...DEFAULT_SETTINGS };
    if (!isRecord(stored)) return { ...DEFAULT_SETTINGS };

    const version = (stored as any).version;
    if (version === 4 || version === 3) return mergeWithDefaults(stored as AppSettings);
    if (version === 2) return migrateFromV2(stored);
    if (version === 1) return migrateFromV1(stored);

    return { ...DEFAULT_SETTINGS };
}

/**
 * Merge stored settings with defaults (keeps v4 but tolerates missing new fields).
 */
export function mergeWithDefaults(stored: AppSettings): AppSettings {
    return {
        version: DEFAULT_SETTINGS.version,
        platforms: normalizePlatformSettings((stored as any).platforms),
        behavior: normalizeBehaviorSettings(stored.behavior),
        reader: {
            renderCodeInReader: Boolean((stored.reader as any)?.renderCodeInReader ?? DEFAULT_SETTINGS.reader.renderCodeInReader),
            showOutlineInReader: Boolean((stored.reader as any)?.showOutlineInReader ?? DEFAULT_SETTINGS.reader.showOutlineInReader),
            contentMaxWidthPx: normalizeReaderContentMaxWidthPx((stored.reader as any)?.contentMaxWidthPx),
            commentExport: normalizeReaderCommentExportSettings((stored.reader as any)?.commentExport),
        },
        formula: normalizeFormulaSettings((stored as any).formula, stored.behavior),
        export: normalizeExportSettings((stored as any).export),
        chatgptDirectory: normalizeChatGPTDirectorySettings((stored as any).chatgptDirectory),
        chatgptBehavior: normalizeChatGPTBehaviorSettings((stored as any).chatgptBehavior),
        appearance: normalizeAppearanceSettings((stored as any).appearance),
        bookmarks: {
            ...DEFAULT_SETTINGS.bookmarks,
            ...stored.bookmarks,
            sortMode: migrateSortMode((stored.bookmarks as any)?.sortMode),
        },
        language: stored.language || 'auto',
    };
}

/**
 * Migrate v1 -> v4
 *
 * Legacy v1 layout:
 * - behavior.enableClickToCopy
 * - storage.saveContextOnly / storage._contextOnlyConfirmed
 * - behavior.renderCodeInReader
 */
export function migrateFromV1(v1: unknown): AppSettings {
    const rec = isRecord(v1) ? v1 : {};
    const platforms = isRecord(rec.platforms) ? rec.platforms : {};
    const behavior = isRecord(rec.behavior) ? rec.behavior : {};
    const storage = isRecord((rec as any).storage) ? (rec as any).storage : {};

    return {
        version: DEFAULT_SETTINGS.version,
        platforms: normalizePlatformSettings(platforms),
        behavior: normalizeBehaviorSettings({
            enableClickToCopy: Boolean((behavior as any).enableClickToCopy ?? true),
            saveContextOnly: Boolean((storage as any).saveContextOnly ?? false),
            _contextOnlyConfirmed: Boolean((storage as any)._contextOnlyConfirmed ?? false),
        }),
        reader: {
            ...DEFAULT_SETTINGS.reader,
            renderCodeInReader: Boolean((behavior as any).renderCodeInReader ?? true),
            showOutlineInReader: Boolean((behavior as any).showOutlineInReader ?? DEFAULT_SETTINGS.reader.showOutlineInReader),
            contentMaxWidthPx: normalizeReaderContentMaxWidthPx((behavior as any).contentMaxWidthPx),
            commentExport: normalizeReaderCommentExportSettings(undefined),
        },
        formula: normalizeFormulaSettings(undefined, behavior),
        export: normalizeExportSettings(undefined),
        chatgptDirectory: normalizeChatGPTDirectorySettings(undefined),
        chatgptBehavior: normalizeChatGPTBehaviorSettings(undefined),
        appearance: normalizeAppearanceSettings(undefined),
        bookmarks: {
            ...DEFAULT_SETTINGS.bookmarks,
        },
        language: 'auto',
    };
}

/**
 * Migrate v2 -> v4
 *
 * Legacy v2 layout:
 * - chatgpt folding settings under performance.chatgptFoldingMode / chatgptDefaultExpandedCount
 */
export function migrateFromV2(v2: unknown): AppSettings {
    const rec = isRecord(v2) ? v2 : {};
    const platforms = isRecord(rec.platforms) ? rec.platforms : {};
    const behavior = isRecord(rec.behavior) ? rec.behavior : {};
    const reader = isRecord(rec.reader) ? rec.reader : {};
    const bookmarks = isRecord(rec.bookmarks) ? rec.bookmarks : {};

    return {
        version: DEFAULT_SETTINGS.version,
        platforms: normalizePlatformSettings(platforms),
        behavior: normalizeBehaviorSettings(behavior),
        reader: {
            renderCodeInReader: Boolean((reader as any).renderCodeInReader ?? DEFAULT_SETTINGS.reader.renderCodeInReader),
            showOutlineInReader: Boolean((reader as any).showOutlineInReader ?? DEFAULT_SETTINGS.reader.showOutlineInReader),
            contentMaxWidthPx: normalizeReaderContentMaxWidthPx((reader as any).contentMaxWidthPx),
            commentExport: normalizeReaderCommentExportSettings((reader as any).commentExport),
        } as any,
        formula: normalizeFormulaSettings((rec as any).formula, behavior),
        export: normalizeExportSettings((rec as any).export),
        chatgptDirectory: normalizeChatGPTDirectorySettings((rec as any).chatgptDirectory),
        chatgptBehavior: normalizeChatGPTBehaviorSettings((rec as any).chatgptBehavior),
        appearance: normalizeAppearanceSettings((rec as any).appearance),
        bookmarks: {
            ...DEFAULT_SETTINGS.bookmarks,
            ...bookmarks,
            sortMode: migrateSortMode((bookmarks as any).sortMode),
        } as any,
        language: (rec as any).language || 'auto',
    };
}
