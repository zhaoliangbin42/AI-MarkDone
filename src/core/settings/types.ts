/**
 * Settings schema (legacy-compatible).
 *
 * Storage:
 * - `browser.storage.sync` key: `app_settings` (legacy)
 *
 * Principles:
 * - Backward compatible migrations (v1/v2/v3 -> v4)
 * - Merge with defaults to allow adding new fields safely
 */

import type { ReaderCommentExportSettings } from './readerCommentExport';
import type { ExportSettings } from './export';
import { DEFAULT_EXPORT_SETTINGS } from './export';
import { createDefaultReaderCommentExportSettings } from './readerCommentExport';
import type { FormulaSettings } from './formula';
import { DEFAULT_FORMULA_SETTINGS } from './formula';

export type SettingsVersion = 4;

export type ChatGPTDirectoryMode = 'preview' | 'expanded';
export type ChatGPTDirectoryPromptLabelMode = 'head' | 'headTail';
export const DEFAULT_CHATGPT_DIRECTORY_RIGHT_INSET_PX = 0;
export const MIN_CHATGPT_DIRECTORY_RIGHT_INSET_PX = 0;
export const MAX_CHATGPT_DIRECTORY_RIGHT_INSET_PX = 40;
export const CHATGPT_DIRECTORY_RIGHT_INSET_STEP_PX = 4;
export const DEFAULT_CHATGPT_PAGE_WIDTH_SCALE = 100;
export const MIN_CHATGPT_PAGE_WIDTH_SCALE = 100;
export const MAX_CHATGPT_PAGE_WIDTH_SCALE = 200;
export const CHATGPT_PAGE_WIDTH_SCALE_STEP = 5;

export type ChatGPTDirectorySettings = {
    enabled: boolean;
    mode: ChatGPTDirectoryMode;
    promptLabelMode: ChatGPTDirectoryPromptLabelMode;
    hideOfficialNavigation: boolean;
    rightInsetPx: number;
};

export type ChatGPTBehaviorSettings = {
    restorePositionAfterSend: boolean;
    enterKeyNewline: boolean;
    showMessageStepper: boolean;
    showPageBookmarkControl: boolean;
    showDetachedReaderControl: boolean;
    showPromptControl: boolean;
    enableArrowKeyMessageNavigation: boolean;
    pageWidthScale: number;
};

export const DEFAULT_READER_CONTENT_MAX_WIDTH_PX = 1000;
export const MIN_READER_CONTENT_MAX_WIDTH_PX = 480;
export const MAX_READER_CONTENT_MAX_WIDTH_PX = 1600;
export const READER_CONTENT_MAX_WIDTH_STEP_PX = 20;
export type ReaderOpenMode = 'fullscreen' | 'panel';
export type ReaderPanelSizeRatio = {
    widthRatio: number;
    heightRatio: number;
};
export const DEFAULT_READER_OPEN_MODE: ReaderOpenMode = 'fullscreen';
export const DEFAULT_READER_PANEL_SIZE_RATIO: ReaderPanelSizeRatio = { widthRatio: 0.72, heightRatio: 0.82 };
export const MIN_READER_PANEL_WIDTH_RATIO = 0.42;
export const MAX_READER_PANEL_WIDTH_RATIO = 0.96;
export const MIN_READER_PANEL_HEIGHT_RATIO = 0.46;
export const MAX_READER_PANEL_HEIGHT_RATIO = 0.96;
export const DEFAULT_READER_BODY_FONT_SIZE_PX = 16;
export const MIN_READER_BODY_FONT_SIZE_PX = 12;
export const MAX_READER_BODY_FONT_SIZE_PX = 22;
export const READER_BODY_FONT_SIZE_STEP_PX = 1;
export const DEFAULT_GLOBAL_FONT_SIZE_PX = 16;
export const MIN_GLOBAL_FONT_SIZE_PX = 12;
export const MAX_GLOBAL_FONT_SIZE_PX = 20;
export const GLOBAL_FONT_SIZE_STEP_PX = 1;
export const THEME_ACCENT_SWATCHES = [
    { value: '#2563eb', labelKey: 'themeAccentDefaultBlue' },
    { value: '#059669', labelKey: 'themeAccentEmerald' },
    { value: '#7c3aed', labelKey: 'themeAccentViolet' },
    { value: '#e11d48', labelKey: 'themeAccentRose' },
    { value: '#d97706', labelKey: 'themeAccentAmber' },
] as const;
export type ThemeAccentColor = typeof THEME_ACCENT_SWATCHES[number]['value'];

export type AppSettings = {
    version: SettingsVersion;
    platforms: {
        chatgpt: boolean;
        gemini: boolean;
        claude: boolean;
        deepseek: boolean;
    };
    behavior: {
        showMessageToolbar: boolean;
        showSaveMessages: boolean;
        showWordCount: boolean;
        enableClickToCopy: boolean;
        saveContextOnly: boolean;
        _contextOnlyConfirmed: boolean;
    };
    reader: {
        renderCodeInReader: boolean;
        showOutlineInReader: boolean;
        defaultOpenMode: ReaderOpenMode;
        panelSizeRatio: ReaderPanelSizeRatio;
        bodyFontSizePx: number;
        detachedNoticeConfirmed: boolean;
        contentMaxWidthPx: number;
        commentExport: ReaderCommentExportSettings;
    };
    formula: FormulaSettings;
    export: ExportSettings;
    chatgptDirectory: ChatGPTDirectorySettings;
    chatgptBehavior: ChatGPTBehaviorSettings;
    appearance: {
        fontSizePx: number;
        accentColor: ThemeAccentColor | null;
    };
    bookmarks: {
        sortMode: 'time-desc' | 'time-asc' | 'alpha-asc' | 'alpha-desc';
    };
    language: 'auto' | 'en' | 'zh_CN';
};

export type SettingsCategory = Exclude<keyof AppSettings, 'version'>;

export const DEFAULT_SETTINGS: AppSettings = {
    version: 4,
    platforms: { chatgpt: true, gemini: true, claude: true, deepseek: true },
    behavior: {
        showMessageToolbar: true,
        showSaveMessages: true,
        showWordCount: true,
        enableClickToCopy: true,
        saveContextOnly: false,
        _contextOnlyConfirmed: false,
    },
    reader: {
        renderCodeInReader: true,
        showOutlineInReader: true,
        defaultOpenMode: DEFAULT_READER_OPEN_MODE,
        panelSizeRatio: DEFAULT_READER_PANEL_SIZE_RATIO,
        bodyFontSizePx: DEFAULT_READER_BODY_FONT_SIZE_PX,
        detachedNoticeConfirmed: false,
        contentMaxWidthPx: DEFAULT_READER_CONTENT_MAX_WIDTH_PX,
        commentExport: createDefaultReaderCommentExportSettings(),
    },
    formula: DEFAULT_FORMULA_SETTINGS,
    export: DEFAULT_EXPORT_SETTINGS,
    chatgptDirectory: {
        enabled: true,
        mode: 'preview',
        promptLabelMode: 'head',
        hideOfficialNavigation: true,
        rightInsetPx: DEFAULT_CHATGPT_DIRECTORY_RIGHT_INSET_PX,
    },
    chatgptBehavior: {
        restorePositionAfterSend: true,
        enterKeyNewline: false,
        showMessageStepper: true,
        showPageBookmarkControl: true,
        showDetachedReaderControl: true,
        showPromptControl: true,
        enableArrowKeyMessageNavigation: true,
        pageWidthScale: DEFAULT_CHATGPT_PAGE_WIDTH_SCALE,
    },
    appearance: { fontSizePx: DEFAULT_GLOBAL_FONT_SIZE_PX, accentColor: null },
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
        || value === 'chatgptBehavior'
        || value === 'appearance'
        || value === 'bookmarks'
        || value === 'language'
    );
}
