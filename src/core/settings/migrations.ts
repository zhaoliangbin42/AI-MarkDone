import { DEFAULT_SETTINGS, type AppSettings, type FoldingMode, type FoldingPowerMode } from './types';

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
}

function pickFoldingMode(value: unknown, fallback: FoldingMode): FoldingMode {
    return value === 'off' || value === 'all' || value === 'keep_last_n' ? value : fallback;
}

function pickFoldingPowerMode(value: unknown, fallback: FoldingPowerMode): FoldingPowerMode {
    if (value === 'off') return 'off';
    if (value === 'on' || value === 'medium' || value === 'ultra') return 'on';
    return fallback;
}

function migrateLegacyFoldingPowerMode(chatgpt: Record<string, unknown>, fallback: FoldingPowerMode): FoldingPowerMode {
    if ('foldingPowerMode' in chatgpt) {
        return pickFoldingPowerMode((chatgpt as any).foldingPowerMode, fallback);
    }
    if ('enableVirtualization' in chatgpt) {
        return (chatgpt as any).enableVirtualization === false ? 'off' : 'on';
    }
    return fallback;
}

export function migrateSortMode(oldMode: unknown): AppSettings['bookmarks']['sortMode'] {
    if (oldMode === 'alphabetical') return 'alpha-asc';
    if (oldMode === 'time') return 'time-desc';

    if (oldMode === 'time-desc' || oldMode === 'time-asc' || oldMode === 'alpha-asc' || oldMode === 'alpha-desc') {
        return oldMode;
    }

    return DEFAULT_SETTINGS.bookmarks.sortMode;
}

/**
 * Merge stored settings with defaults (keeps v3 but tolerates missing new fields).
 */
export function mergeWithDefaults(stored: AppSettings): AppSettings {
    return {
        version: DEFAULT_SETTINGS.version,
        platforms: {
            ...DEFAULT_SETTINGS.platforms,
            ...stored.platforms,
        },
        chatgpt: {
            ...DEFAULT_SETTINGS.chatgpt,
            ...stored.chatgpt,
            foldingPowerMode: migrateLegacyFoldingPowerMode(
                (stored.chatgpt as unknown as Record<string, unknown>) ?? {},
                'off'
            ),
        },
        behavior: {
            ...DEFAULT_SETTINGS.behavior,
            ...stored.behavior,
        },
        reader: {
            renderCodeInReader: Boolean((stored.reader as any)?.renderCodeInReader ?? DEFAULT_SETTINGS.reader.renderCodeInReader),
        },
        bookmarks: {
            ...DEFAULT_SETTINGS.bookmarks,
            ...stored.bookmarks,
            sortMode: migrateSortMode((stored.bookmarks as any)?.sortMode),
        },
        language: stored.language || 'auto',
    };
}

/**
 * Migrate v1 -> v3
 *
 * Legacy v1 layout:
 * - behavior.enableClickToCopy
 * - storage.saveContextOnly / storage._contextOnlyConfirmed
 * - behavior.renderCodeInReader
 */
export function migrateFromV1(v1: unknown): AppSettings {
    const rec = isRecord(v1) ? v1 : {};
    const platforms = isRecord(rec.platforms) ? rec.platforms : {};
    const chatgpt = isRecord(rec.chatgpt) ? rec.chatgpt : {};
    const behavior = isRecord(rec.behavior) ? rec.behavior : {};
    const storage = isRecord((rec as any).storage) ? (rec as any).storage : {};

    return {
        version: 3,
        platforms: {
            ...DEFAULT_SETTINGS.platforms,
            chatgpt: Boolean((platforms as any).chatgpt ?? true),
            gemini: Boolean((platforms as any).gemini ?? true),
            claude: Boolean((platforms as any).claude ?? true),
            deepseek: Boolean((platforms as any).deepseek ?? true),
        },
        chatgpt: {
            ...DEFAULT_SETTINGS.chatgpt,
            foldingMode: pickFoldingMode((chatgpt as any).foldingMode, DEFAULT_SETTINGS.chatgpt.foldingMode),
            defaultExpandedCount: Number((chatgpt as any).defaultExpandedCount ?? DEFAULT_SETTINGS.chatgpt.defaultExpandedCount),
            showFoldDock: Boolean((chatgpt as any).showFoldDock ?? DEFAULT_SETTINGS.chatgpt.showFoldDock),
            foldingPowerMode: migrateLegacyFoldingPowerMode(chatgpt, 'off'),
        },
        behavior: {
            ...DEFAULT_SETTINGS.behavior,
            enableClickToCopy: Boolean((behavior as any).enableClickToCopy ?? true),
            saveContextOnly: Boolean((storage as any).saveContextOnly ?? false),
            _contextOnlyConfirmed: Boolean((storage as any)._contextOnlyConfirmed ?? false),
        },
        reader: {
            ...DEFAULT_SETTINGS.reader,
            renderCodeInReader: Boolean((behavior as any).renderCodeInReader ?? true),
        },
        bookmarks: {
            ...DEFAULT_SETTINGS.bookmarks,
        },
        language: 'auto',
    };
}

/**
 * Migrate v2 -> v3
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
    const perf = isRecord((rec as any).performance) ? (rec as any).performance : {};

    const foldingMode = pickFoldingMode((perf as any).chatgptFoldingMode, DEFAULT_SETTINGS.chatgpt.foldingMode);
    const defaultExpandedCount = Number((perf as any).chatgptDefaultExpandedCount ?? DEFAULT_SETTINGS.chatgpt.defaultExpandedCount);

    return {
        version: 3,
        platforms: {
            ...DEFAULT_SETTINGS.platforms,
            ...platforms,
        } as any,
        chatgpt: {
            ...DEFAULT_SETTINGS.chatgpt,
            foldingMode,
            defaultExpandedCount: Number.isFinite(defaultExpandedCount) ? defaultExpandedCount : DEFAULT_SETTINGS.chatgpt.defaultExpandedCount,
            foldingPowerMode: 'off',
        },
        behavior: {
            ...DEFAULT_SETTINGS.behavior,
            ...behavior,
        } as any,
        reader: {
            renderCodeInReader: Boolean((reader as any).renderCodeInReader ?? DEFAULT_SETTINGS.reader.renderCodeInReader),
        } as any,
        bookmarks: {
            ...DEFAULT_SETTINGS.bookmarks,
            ...bookmarks,
            sortMode: migrateSortMode((bookmarks as any).sortMode),
        } as any,
        language: (rec as any).language || 'auto',
    };
}
