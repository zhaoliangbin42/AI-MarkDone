/**
 * Settings schema (legacy-compatible).
 *
 * Storage:
 * - `browser.storage.sync` key: `app_settings` (legacy)
 *
 * Principles:
 * - Backward compatible migrations (v1/v2/v3/v4 -> v5)
 * - Merge with defaults to allow adding new fields safely
 */

import type { ReaderCommentExportSettings } from './readerCommentExport';
import { normalizeSelectionToolbarActions, type SelectionToolbarActions } from './selectionToolbar';
import type { ExportSettings } from './export';
import { DEFAULT_EXPORT_SETTINGS } from './export';
import { DEFAULT_CONTENT_CLEANUP_SETTINGS, type ContentCleanupSettings } from './content';
import { createDefaultReaderCommentExportSettings } from './readerCommentExport';
import type { FormulaSettings } from './formula';
import { DEFAULT_FORMULA_SETTINGS } from './formula';

export type SettingsVersion = 5;

export type ChatGPTDirectoryMode = 'preview' | 'expanded';
export type ChatGPTDirectoryPromptLabelMode = 'head' | 'headTail';
export type ChatGPTAtomicMarkdownCopyShortcut = 'none' | 'mod-c' | 'mod-shift-c';
export const PAGE_CONTROL_ACTIONS = ['toggle-page-bookmark', 'open-detached-reader', 'open-prompts', 'open-input-enhancement', 'chatgpt-refresh-message-navigation'] as const;
export type PageControlAction = typeof PAGE_CONTROL_ACTIONS[number];
export const MESSAGE_CONTROL_ACTIONS = ['bookmark_toggle', 'copy_markdown', 'copy_prompt_reply', 'reader', 'export'] as const;
export type MessageControlAction = typeof MESSAGE_CONTROL_ACTIONS[number];
export type MessageControlVisibility = Record<MessageControlAction, boolean>;
export const DEFAULT_MESSAGE_CONTROL_VISIBILITY: MessageControlVisibility = {
    bookmark_toggle: true, copy_markdown: true, copy_prompt_reply: true, reader: true, export: true,
};
export const DEFAULT_CHATGPT_DIRECTORY_RIGHT_INSET_PX = 0;
export const MIN_CHATGPT_DIRECTORY_RIGHT_INSET_PX = 0;
export const MAX_CHATGPT_DIRECTORY_RIGHT_INSET_PX = 40;
export const CHATGPT_DIRECTORY_RIGHT_INSET_STEP_PX = 4;
export const DEFAULT_CHATGPT_DIRECTORY_PREVIEW_MAX_CHARS = 600;
export const MIN_CHATGPT_DIRECTORY_PREVIEW_MAX_CHARS = 200;
export const MAX_CHATGPT_DIRECTORY_PREVIEW_MAX_CHARS = 2_000;
export const CHATGPT_DIRECTORY_PREVIEW_MAX_CHARS_STEP = 200;
export const DEFAULT_CHATGPT_PAGE_WIDTH_SCALE = 100;
export const MIN_CHATGPT_PAGE_WIDTH_SCALE = 100;
export const MAX_CHATGPT_PAGE_WIDTH_SCALE = 200;
export const CHATGPT_PAGE_WIDTH_SCALE_STEP = 5;
export const DEFAULT_CHATGPT_NAVIGATION_SEEK_STEP_PX = 3_000;
export const MIN_CHATGPT_NAVIGATION_SEEK_STEP_PX = 1_000;
export const MAX_CHATGPT_NAVIGATION_SEEK_STEP_PX = 5_000;
export const CHATGPT_NAVIGATION_SEEK_STEP_PX_STEP = 400;

export type ChatGPTDirectorySettings = {
    enabled: boolean;
    mode: ChatGPTDirectoryMode;
    promptLabelMode: ChatGPTDirectoryPromptLabelMode;
    hideOfficialNavigation: boolean;
    rightInsetPx: number;
    previewMaxChars: number;
};

export type ChatGPTInputEnhancementSettings = {
    available: boolean;
    enabled: boolean;
    enterKeyNewline: boolean;
    boldShortcut: boolean;
    lists: {
        enabled: boolean;
        ordered: boolean;
        unordered: boolean;
    };
    formulaSuggestions: boolean;
    formulaPreview: boolean;
};

export type ChatGPTBehaviorSettings = {
    restorePositionAfterSend: boolean;
    atomicMarkdownCopyShortcut: ChatGPTAtomicMarkdownCopyShortcut;
    inputEnhancement: ChatGPTInputEnhancementSettings;
    showMessageStepper: boolean;
    showPageBookmarkControl: boolean;
    showDetachedReaderControl: boolean;
    showPromptControl: boolean;
    showInputEnhancementControl: boolean;
    showRefreshNavigationControl: boolean;
    showComposerInputEnhancementControl: boolean;
    showComposerAnnotationControl: boolean;
    pinnedPageControls: PageControlAction[];
    promptAutocomplete: boolean;
    enableArrowKeyMessageNavigation: boolean;
    pageWidthScale: number;
    pageAnnotationsEnabled: boolean;
    showPageSelectionToolbar: boolean;
    navigationSeekStepPx: number;
};

export const DEFAULT_CHATGPT_INPUT_ENHANCEMENT_SETTINGS: ChatGPTInputEnhancementSettings = {
    available: true,
    enabled: true,
    enterKeyNewline: true,
    boldShortcut: true,
    lists: {
        enabled: true,
        ordered: true,
        unordered: true,
    },
    formulaSuggestions: true,
    formulaPreview: true,
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
    { value: '#3b5bdb', labelKey: 'themeAccentDefaultBlue' },
    { value: '#059669', labelKey: 'themeAccentEmerald' },
    { value: '#7c3aed', labelKey: 'themeAccentViolet' },
    { value: '#e11d48', labelKey: 'themeAccentRose' },
    { value: '#d97706', labelKey: 'themeAccentAmber' },
    { value: '#be185d', labelKey: 'themeAccentCherryPink' },
    { value: '#0e7490', labelKey: 'themeAccentBayBlue' },
    { value: '#f472b6', labelKey: 'themeAccentLightPink' },
] as const;
export type ThemeAccentColor = `#${string}`;

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
        showMessageTimestamp: boolean;
        showCopyPng: boolean;
        messageControls: MessageControlVisibility;
        pinnedMessageControls: MessageControlAction[];
        enableClickToCopy: boolean;
        saveContextOnly: boolean;
        _contextOnlyConfirmed: boolean;
    };
    reader: {
        selectionToolbar: SelectionToolbarActions;
        renderCodeInReader: boolean;
        showOutlineInReader: boolean;
        persistAnnotations: boolean;
        defaultOpenMode: ReaderOpenMode;
        panelSizeRatio: ReaderPanelSizeRatio;
        bodyFontSizePx: number;
        detachedNoticeConfirmed: boolean;
        contentMaxWidthPx: number;
        commentExport: ReaderCommentExportSettings;
    };
    content: ContentCleanupSettings;
    formula: FormulaSettings;
    export: ExportSettings;
    chatgptDirectory: ChatGPTDirectorySettings;
    chatgptBehavior: ChatGPTBehaviorSettings;
    appearance: {
        themeMode?: 'auto' | 'light' | 'dark';
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
    version: 5,
    platforms: { chatgpt: true, gemini: true, claude: true, deepseek: true },
    behavior: {
        showMessageToolbar: true,
        showSaveMessages: true,
        showWordCount: true,
        showMessageTimestamp: true,
        showCopyPng: true,
        messageControls: { ...DEFAULT_MESSAGE_CONTROL_VISIBILITY },
        pinnedMessageControls: [],
        enableClickToCopy: true,
        saveContextOnly: false,
        _contextOnlyConfirmed: false,
    },
    reader: {
        selectionToolbar: normalizeSelectionToolbarActions(undefined),
        renderCodeInReader: true,
        showOutlineInReader: true,
        persistAnnotations: false,
        defaultOpenMode: DEFAULT_READER_OPEN_MODE,
        panelSizeRatio: DEFAULT_READER_PANEL_SIZE_RATIO,
        bodyFontSizePx: DEFAULT_READER_BODY_FONT_SIZE_PX,
        detachedNoticeConfirmed: false,
        contentMaxWidthPx: DEFAULT_READER_CONTENT_MAX_WIDTH_PX,
        commentExport: createDefaultReaderCommentExportSettings(),
    },
    content: DEFAULT_CONTENT_CLEANUP_SETTINGS,
    formula: DEFAULT_FORMULA_SETTINGS,
    export: DEFAULT_EXPORT_SETTINGS,
    chatgptDirectory: {
        enabled: false,
        mode: 'preview',
        promptLabelMode: 'head',
        hideOfficialNavigation: true,
        rightInsetPx: DEFAULT_CHATGPT_DIRECTORY_RIGHT_INSET_PX,
        previewMaxChars: DEFAULT_CHATGPT_DIRECTORY_PREVIEW_MAX_CHARS,
    },
    chatgptBehavior: {
        restorePositionAfterSend: true,
        atomicMarkdownCopyShortcut: 'mod-shift-c',
        inputEnhancement: {
            ...DEFAULT_CHATGPT_INPUT_ENHANCEMENT_SETTINGS,
            lists: { ...DEFAULT_CHATGPT_INPUT_ENHANCEMENT_SETTINGS.lists },
        },
        showMessageStepper: true,
        showPageBookmarkControl: true,
        showDetachedReaderControl: true,
        showPromptControl: true,
        showInputEnhancementControl: true,
        showRefreshNavigationControl: true,
        showComposerInputEnhancementControl: true,
        showComposerAnnotationControl: true,
        pinnedPageControls: [],
        promptAutocomplete: true,
        enableArrowKeyMessageNavigation: true,
        pageWidthScale: DEFAULT_CHATGPT_PAGE_WIDTH_SCALE,
        pageAnnotationsEnabled: true,
        showPageSelectionToolbar: true,
        navigationSeekStepPx: DEFAULT_CHATGPT_NAVIGATION_SEEK_STEP_PX,
    },
    appearance: { themeMode: 'auto', fontSizePx: DEFAULT_GLOBAL_FONT_SIZE_PX, accentColor: null },
    bookmarks: { sortMode: 'alpha-asc' },
    language: 'auto',
};

export function isSettingsCategory(value: unknown): value is SettingsCategory {
    return (
        value === 'platforms'
        || value === 'behavior'
        || value === 'reader'
        || value === 'content'
        || value === 'formula'
        || value === 'export'
        || value === 'chatgptDirectory'
        || value === 'chatgptBehavior'
        || value === 'appearance'
        || value === 'bookmarks'
        || value === 'language'
    );
}
