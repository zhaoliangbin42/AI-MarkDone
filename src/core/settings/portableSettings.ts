import { MESSAGE_CONTROL_ACTIONS, PAGE_CONTROL_ACTIONS, type AppSettings } from './types';
import { normalizeAccentHex } from './appearance';
import { FORMULA_SOURCE_FORMATS } from '../math/formulaSourceFormat';
import type { SettingsFile, SettingsPreferenceChange } from '../../contracts/settingsTransfer';
export type { SettingsFile, SettingsPreferenceChange } from '../../contracts/settingsTransfer';
export const SETTINGS_FILE_FORMAT = 'ai-markdone-settings' as const;
export const SETTINGS_FILE_VERSION = 1 as const;
export const MAX_SETTINGS_FILE_BYTES = 128 * 1024;
export type PortableSettings = Record<string, unknown>;
const retiredComposerFields = new Set(['chatgptBehavior.showComposerInputEnhancementControl', 'chatgptBehavior.showComposerAnnotationControl']);
type FieldRule = {
    kind: 'boolean';
} | {
    kind: 'color';
} | {
    kind: 'enum';
    values: readonly unknown[];
} | {
    kind: 'number';
    min: number;
    max: number;
    step?: number;
} | {
    kind: 'actions';
    values: readonly string[];
};
const bool: FieldRule = { kind: 'boolean' };
const choice = (...values: readonly unknown[]): FieldRule => ({ kind: 'enum', values });
const number = (min: number, max: number, step?: number): FieldRule => ({ kind: 'number', min, max, step });
// A portable file contains only constrained preference values. Free text,
// credentials, confirmation records and legacy Prompt migration inputs never
// cross this boundary, even if future settings contain additional fields.
export const PORTABLE_SETTINGS_FIELDS: Readonly<Record<string, FieldRule>> = Object.freeze({
    'platforms.chatgpt': bool,
    'behavior.showMessageToolbar': bool, 'behavior.showSaveMessages': bool,
    'behavior.showWordCount': bool, 'behavior.showMessageTimestamp': bool,
    'behavior.showCopyPng': bool, 'behavior.saveContextOnly': bool,
    ...Object.fromEntries(MESSAGE_CONTROL_ACTIONS.map(action => [`behavior.messageControls.${action}`, bool])),
    'behavior.pinnedMessageControls': { kind: 'actions', values: MESSAGE_CONTROL_ACTIONS },
    'reader.selectionToolbar.copy': bool, 'reader.selectionToolbar.annotation': bool,
    'reader.selectionToolbar.highlight': bool, 'reader.renderCodeInReader': bool,
    'reader.showOutlineInReader': bool, 'reader.persistAnnotations': bool,
    'reader.defaultOpenMode': choice('fullscreen', 'panel'),
    'reader.panelSizeRatio.widthRatio': number(0.42, 0.96),
    'reader.panelSizeRatio.heightRatio': number(0.46, 0.96),
    'reader.bodyFontSizePx': number(12, 22, 1),
    'reader.contentMaxWidthPx': number(480, 1600, 20),
    'reader.commentExport.promptPosition': choice('top', 'bottom'),
    'reader.commentExport.sortMode': choice('created', 'position'),
    'content.preserveLinks': bool, 'content.includeCodeBlocks': bool,
    'formula.clickCopyMarkdown': bool,
    'formula.clickCopyFormulaFormat': choice(...FORMULA_SOURCE_FORMATS),
    'formula.markdownCopyFormulaFormat': choice(...FORMULA_SOURCE_FORMATS),
    ...Object.fromEntries(['copyPng', 'copySvg', 'copyMathml', 'savePng', 'saveSvg'].map(action => [`formula.assetActions.${action}`, bool])),
    ...Object.fromEntries(['copyPng', 'copySvg', 'copyMathml', 'savePng', 'saveSvg'].map(action => [`formula.composerAssetActions.${action}`, bool])),
    'formula.assetFontSizePx': number(16, 72, 1),
    'export.pngWidthPreset': choice('mobile', 'tablet', 'desktop', 'custom'),
    'export.pngCustomWidth': number(360, 1200, 20), 'export.pngPixelRatio': number(1, 3, 0.5),
    'chatgptDirectory.enabled': bool, 'chatgptDirectory.mode': choice('preview', 'expanded'),
    'chatgptDirectory.promptLabelMode': choice('head', 'headTail'),
    'chatgptDirectory.hideOfficialNavigation': bool, 'chatgptDirectory.rightInsetPx': number(0, 40, 4),
    'chatgptDirectory.previewMaxChars': number(200, 2000, 200),
    'chatgptBehavior.restorePositionAfterSend': bool,
    'chatgptBehavior.atomicMarkdownCopyShortcut': choice('none', 'mod-c', 'mod-shift-c'),
    ...Object.fromEntries(['available', 'enabled', 'enterKeyNewline', 'boldShortcut', 'formulaSuggestions', 'formulaPreview'].map(field => [`chatgptBehavior.inputEnhancement.${field}`, bool])),
    ...Object.fromEntries(['enabled', 'ordered', 'unordered'].map(field => [`chatgptBehavior.inputEnhancement.lists.${field}`, bool])),
    ...Object.fromEntries(['showMessageStepper', 'showPageBookmarkControl', 'showDetachedReaderControl', 'showPromptControl', 'showInputEnhancementControl', 'showRefreshNavigationControl', 'showComposerInputEnhancementControl', 'showComposerAnnotationControl', 'promptAutocomplete', 'enableArrowKeyMessageNavigation', 'pageAnnotationsEnabled', 'showPageSelectionToolbar'].map(field => [`chatgptBehavior.${field}`, bool])),
    'chatgptBehavior.pinnedPageControls': { kind: 'actions', values: PAGE_CONTROL_ACTIONS },
    'chatgptBehavior.pageWidthScale': number(100, 200, 5),
    'chatgptBehavior.navigationSeekStepPx': number(1000, 5000, 400),
    'appearance.themeMode': choice('auto', 'light', 'dark'),
    'appearance.fontSizePx': number(12, 20, 1),
    'appearance.accentColor': { kind: 'color' },
    'bookmarks.sortMode': choice('time-desc', 'time-asc', 'alpha-asc', 'alpha-desc'),
    language: choice('auto', 'en', 'zh_CN'),
});
function isObject(value: unknown): value is Record<string, unknown> {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}
export function readPreferencePath(value: unknown, path: string): unknown {
    return path.split('.').reduce<unknown>((current, key) => isObject(current) && Object.prototype.hasOwnProperty.call(current, key) ? current[key] : undefined, value);
}
function writePath(target: PortableSettings, path: string, value: unknown): void {
    const keys = path.split('.');
    let current = target;
    for (const key of keys.slice(0, -1)) {
        if (!isObject(current[key]))
            current[key] = {};
        current = current[key] as PortableSettings;
    }
    current[keys[keys.length - 1]] = Array.isArray(value) ? [...value] : value;
}
function valid(value: unknown, rule: FieldRule): boolean {
    switch (rule.kind) {
        case 'boolean': return typeof value === 'boolean';
        case 'color': return value === null || normalizeAccentHex(value) !== null;
        case 'enum': return rule.values.includes(value);
        case 'actions': return Array.isArray(value) && value.length <= rule.values.length
            && value.every(action => typeof action === 'string' && rule.values.includes(action))
            && new Set(value).size === value.length;
        case 'number': return typeof value === 'number' && Number.isFinite(value)
            && value >= rule.min && value <= rule.max
            && (!rule.step || Math.abs((value - rule.min) / rule.step - Math.round((value - rule.min) / rule.step)) < 1e-8);
    }
}
export function isPortablePreferenceValue(path: string, value: unknown): boolean {
    return Object.prototype.hasOwnProperty.call(PORTABLE_SETTINGS_FIELDS, path) && valid(value, PORTABLE_SETTINGS_FIELDS[path]);
}
export function projectPortableSettings(settings: AppSettings): PortableSettings {
    const result: PortableSettings = {};
    for (const [path, rule] of Object.entries(PORTABLE_SETTINGS_FIELDS)) {
        if (retiredComposerFields.has(path)) continue;
        const value = readPreferencePath(settings, path);
        if (value !== undefined && valid(value, rule))
            writePath(result, path, value);
    }
    return result;
}
export function compareAppVersions(left: string, right: string): number {
    const parse=(value:string)=>{if(!/^\d+(?:\.\d+){0,3}$/.test(value))throw new Error('SETTINGS_FILE_INVALID');const parts=value.split('.').map(Number);if(parts.some(part=>!Number.isSafeInteger(part)))throw new Error('SETTINGS_FILE_INVALID');return parts;};
    const a=parse(left),b=parse(right);for(let i=0;i<4;i++){const difference=(a[i]??0)-(b[i]??0);if(difference)return Math.sign(difference);}return 0;
}
export function createSettingsFile(settings: AppSettings, appVersion: string, exportedAt = new Date().toISOString()): SettingsFile {
    compareAppVersions(appVersion,appVersion);
    return { format: SETTINGS_FILE_FORMAT, formatVersion: SETTINGS_FILE_VERSION,
        appVersion,
        exportedAt, settings: projectPortableSettings(settings) };
}
export function parseSettingsFile(text: string, currentAppVersion?: string): {
    file: SettingsFile;
    ignoredCount: number;
} {
    if (typeof text !== 'string' || new TextEncoder().encode(text).length > MAX_SETTINGS_FILE_BYTES)
        throw new Error('SETTINGS_FILE_TOO_LARGE');
    let input: unknown;
    try {
        input = JSON.parse(text.replace(/^\uFEFF/, ''));
    }
    catch {
        throw new Error('SETTINGS_FILE_INVALID');
    }
    if (!isObject(input) || input.format !== SETTINGS_FILE_FORMAT)
        throw new Error('SETTINGS_FILE_INVALID');
    if (input.formatVersion !== SETTINGS_FILE_VERSION)
        throw new Error('SETTINGS_FILE_UNSUPPORTED');
    if(Object.keys(input).some(key=>!['format','formatVersion','appVersion','exportedAt','settings'].includes(key)))throw new Error('SETTINGS_FILE_UNSUPPORTED');
    if(typeof input.appVersion!=='string')throw new Error('SETTINGS_FILE_INVALID');
    compareAppVersions(input.appVersion,input.appVersion);
    if(currentAppVersion && compareAppVersions(input.appVersion,currentAppVersion)>0)throw new Error('SETTINGS_FILE_NEWER_VERSION');
    if(typeof input.exportedAt!=='string' || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,3})?Z$/.test(input.exportedAt) || !Number.isFinite(Date.parse(input.exportedAt)))throw new Error('SETTINGS_FILE_INVALID');
    if (!isObject(input.settings))
        throw new Error('SETTINGS_FILE_INVALID');
    const settings: PortableSettings = {};
    let count = 0;
    const ignoredCount = 0;
    const walk = (record: Record<string, unknown>, prefix = '') => {
        for (const [key, value] of Object.entries(record)) {
            if (key === '__proto__' || key === 'prototype' || key === 'constructor')
                throw new Error('SETTINGS_FILE_INVALID');
            const path = prefix ? `${prefix}.${key}` : key;
            const rule = Object.prototype.hasOwnProperty.call(PORTABLE_SETTINGS_FIELDS, path) ? PORTABLE_SETTINGS_FIELDS[path] : undefined;
            if (rule) {
                if (!valid(value, rule))
                    throw new Error('SETTINGS_FILE_INVALID');
                count += 1;
                if (!retiredComposerFields.has(path)) writePath(settings, path, rule.kind === 'color' && value !== null ? normalizeAccentHex(value) : value);
            }
            else if (Object.keys(PORTABLE_SETTINGS_FIELDS).some(field => field.startsWith(`${path}.`))) {
                if (!isObject(value))
                    throw new Error('SETTINGS_FILE_INVALID');
                walk(value, path);
            }
            else
                throw new Error('SETTINGS_FILE_UNSUPPORTED');
        }
    };
    walk(input.settings);
    if (count === 0)
        throw new Error('SETTINGS_FILE_EMPTY');
    return { file: { format: SETTINGS_FILE_FORMAT, formatVersion: SETTINGS_FILE_VERSION,
            appVersion: input.appVersion, exportedAt: input.exportedAt,
            settings }, ignoredCount };
}
export function listSettingsChanges(current: AppSettings, imported: PortableSettings): SettingsPreferenceChange[] {
    return Object.keys(PORTABLE_SETTINGS_FIELDS).flatMap(path => {
        const after = readPreferencePath(imported, path);
        if (after === undefined)
            return [];
        const before = readPreferencePath(current, path);
        return JSON.stringify(before) === JSON.stringify(after) ? [] : [{ path, before, after }];
    });
}
export function mergePortableSettings(current: AppSettings, imported: PortableSettings, categories: readonly string[]): AppSettings {
    const next = structuredClone(current);
    for (const change of listSettingsChanges(current, imported)) {
        if (!valid(change.after, PORTABLE_SETTINGS_FIELDS[change.path]))
            throw new Error('SETTINGS_FILE_INVALID');
        if (categories.includes(change.path.split('.')[0]))
            writePath(next as unknown as PortableSettings, change.path, change.after);
    }
    return next;
}
