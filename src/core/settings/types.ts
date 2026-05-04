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
import type { FormulaSettings } from './formula';
import { DEFAULT_FORMULA_SETTINGS } from './formula';

export type SettingsVersion = 3;

export type ChatGPTDirectoryMode = 'preview' | 'expanded';
export type ChatGPTDirectoryPromptLabelMode = 'head' | 'headTail';

export type ChatGPTDirectorySettings = {
    enabled: boolean;
    mode: ChatGPTDirectoryMode;
    promptLabelMode: ChatGPTDirectoryPromptLabelMode;
};

export const DEFAULT_READER_CONTENT_MAX_WIDTH_PX = 1000;
export const MIN_READER_CONTENT_MAX_WIDTH_PX = 480;
export const MAX_READER_CONTENT_MAX_WIDTH_PX = 1600;
export const READER_CONTENT_MAX_WIDTH_STEP_PX = 20;

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
        contentMaxWidthPx: number;
        commentExport: ReaderCommentExportSettings;
    };
    formula: FormulaSettings;
    export: ExportSettings;
    chatgptDirectory: ChatGPTDirectorySettings;
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
        contentMaxWidthPx: DEFAULT_READER_CONTENT_MAX_WIDTH_PX,
        commentExport: createDefaultReaderCommentExportSettings(),
    },
    formula: DEFAULT_FORMULA_SETTINGS,
    export: DEFAULT_EXPORT_SETTINGS,
    chatgptDirectory: { enabled: true, mode: 'preview', promptLabelMode: 'head' },
    bookmarks: { sortMode: 'alpha-asc' },
    language: 'auto',
};

export function isSettingsCategory(value: unknown): value is SettingsCategory {
    return (
        value === 'platforms'
        || value === 'behavior'
        || value === 'reader'
        || value === 'formula'
        || value === 'export'
        || value === 'chatgptDirectory'
        || value === 'bookmarks'
        || value === 'language'
    );
}
