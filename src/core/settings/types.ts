/**
 * Settings schema (legacy-compatible).
 *
 * Storage:
 * - `browser.storage.sync` key: `app_settings` (legacy)
 *
 * Principles:
 * - Backward compatible migrations (v1/v2 -> v3)
 * - Merge with defaults to allow adding new fields safely
 */

export type SettingsVersion = 3;

export type FoldingMode = 'off' | 'all' | 'keep_last_n';

export type AppSettings = {
    version: SettingsVersion;
    platforms: {
        chatgpt: boolean;
        gemini: boolean;
        claude: boolean;
        deepseek: boolean;
    };
    chatgpt: {
        foldingMode: FoldingMode;
        defaultExpandedCount: number;
        showFoldDock: boolean;
    };
    behavior: {
        showViewSource: boolean;
        showSaveMessages: boolean;
        showWordCount: boolean;
        enableClickToCopy: boolean;
        saveContextOnly: boolean;
        _contextOnlyConfirmed: boolean;
    };
    reader: {
        renderCodeInReader: boolean;
    };
    bookmarks: {
        sortMode: 'time-desc' | 'time-asc' | 'alpha-asc' | 'alpha-desc';
    };
    language: 'auto' | 'en' | 'zh_CN';
};

export type SettingsCategory = Exclude<keyof AppSettings, 'version'>;

export const DEFAULT_SETTINGS: AppSettings = {
    version: 3,
    platforms: { chatgpt: true, gemini: true, claude: true, deepseek: true },
    chatgpt: { foldingMode: 'off', defaultExpandedCount: 8, showFoldDock: true },
    behavior: {
        showViewSource: true,
        showSaveMessages: true,
        showWordCount: true,
        enableClickToCopy: true,
        saveContextOnly: false,
        _contextOnlyConfirmed: false,
    },
    reader: { renderCodeInReader: true },
    bookmarks: { sortMode: 'alpha-asc' },
    language: 'auto',
};

export function isSettingsCategory(value: unknown): value is SettingsCategory {
    return (
        value === 'platforms'
        || value === 'chatgpt'
        || value === 'behavior'
        || value === 'reader'
        || value === 'bookmarks'
        || value === 'language'
    );
}
