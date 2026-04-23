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

import type { ReaderCommentExportSettings } from './readerCommentExport';
import type { ExportSettings } from './export';
import { DEFAULT_EXPORT_SETTINGS } from './export';
import { createDefaultReaderCommentExportSettings } from './readerCommentExport';

export type SettingsVersion = 3;

export type AppSettings = {
    version: SettingsVersion;
    platforms: {
        chatgpt: boolean;
        gemini: boolean;
        claude: boolean;
        deepseek: boolean;
    };
    behavior: {
        showSaveMessages: boolean;
        showWordCount: boolean;
        enableClickToCopy: boolean;
        saveContextOnly: boolean;
        _contextOnlyConfirmed: boolean;
    };
    reader: {
        renderCodeInReader: boolean;
        commentExport: ReaderCommentExportSettings;
    };
    export: ExportSettings;
    bookmarks: {
        sortMode: 'time-desc' | 'time-asc' | 'alpha-asc' | 'alpha-desc';
    };
    language: 'auto' | 'en' | 'zh_CN';
};

export type SettingsCategory = Exclude<keyof AppSettings, 'version'>;

export const DEFAULT_SETTINGS: AppSettings = {
    version: 3,
    platforms: { chatgpt: true, gemini: true, claude: true, deepseek: true },
    behavior: {
        showSaveMessages: true,
        showWordCount: true,
        enableClickToCopy: true,
        saveContextOnly: false,
        _contextOnlyConfirmed: false,
    },
    reader: {
        renderCodeInReader: true,
        commentExport: createDefaultReaderCommentExportSettings(),
    },
    export: DEFAULT_EXPORT_SETTINGS,
    bookmarks: { sortMode: 'alpha-asc' },
    language: 'auto',
};

export function isSettingsCategory(value: unknown): value is SettingsCategory {
    return (
        value === 'platforms'
        || value === 'behavior'
        || value === 'reader'
        || value === 'export'
        || value === 'bookmarks'
        || value === 'language'
    );
}
