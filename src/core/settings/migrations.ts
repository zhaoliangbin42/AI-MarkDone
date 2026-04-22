import { DEFAULT_SETTINGS, type AppSettings } from './types';
import { normalizeReaderCommentExportSettings } from './readerCommentExport';

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
}

export function normalizeChatGptSettings(chatgpt: unknown): AppSettings['chatgpt'] {
    const record = isRecord(chatgpt) ? chatgpt : {};

    return {
        ...DEFAULT_SETTINGS.chatgpt,
        showConversationDirectory: Boolean(
            (record as any).showConversationDirectory
            ?? (record as any).showFoldDock
            ?? DEFAULT_SETTINGS.chatgpt.showConversationDirectory
        ),
    };
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
        chatgpt: normalizeChatGptSettings(stored.chatgpt),
        behavior: normalizeBehaviorSettings(stored.behavior),
        reader: {
            renderCodeInReader: Boolean((stored.reader as any)?.renderCodeInReader ?? DEFAULT_SETTINGS.reader.renderCodeInReader),
            commentExport: normalizeReaderCommentExportSettings((stored.reader as any)?.commentExport),
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
            showConversationDirectory: Boolean(
                (chatgpt as any).showConversationDirectory
                ?? (chatgpt as any).showFoldDock
                ?? DEFAULT_SETTINGS.chatgpt.showConversationDirectory
            ),
        },
        behavior: normalizeBehaviorSettings({
            enableClickToCopy: Boolean((behavior as any).enableClickToCopy ?? true),
            saveContextOnly: Boolean((storage as any).saveContextOnly ?? false),
            _contextOnlyConfirmed: Boolean((storage as any)._contextOnlyConfirmed ?? false),
        }),
        reader: {
            ...DEFAULT_SETTINGS.reader,
            renderCodeInReader: Boolean((behavior as any).renderCodeInReader ?? true),
            commentExport: normalizeReaderCommentExportSettings(undefined),
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

    return {
        version: 3,
        platforms: {
            ...DEFAULT_SETTINGS.platforms,
            ...platforms,
        } as any,
        chatgpt: {
            ...DEFAULT_SETTINGS.chatgpt,
            showConversationDirectory: Boolean(
                (rec as any)?.chatgpt?.showConversationDirectory
                ?? (rec as any)?.chatgpt?.showFoldDock
                ?? true
            ),
        },
        behavior: normalizeBehaviorSettings(behavior),
        reader: {
            renderCodeInReader: Boolean((reader as any).renderCodeInReader ?? DEFAULT_SETTINGS.reader.renderCodeInReader),
            commentExport: normalizeReaderCommentExportSettings((reader as any).commentExport),
        } as any,
        bookmarks: {
            ...DEFAULT_SETTINGS.bookmarks,
            ...bookmarks,
            sortMode: migrateSortMode((bookmarks as any).sortMode),
        } as any,
        language: (rec as any).language || 'auto',
    };
}
