import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS } from '../../../../src/core/settings/types';
import { loadAndNormalize } from '../../../../src/core/settings/migrations';
import { createSettingsFile, listSettingsChanges, MAX_SETTINGS_FILE_BYTES, mergePortableSettings, parseSettingsFile, projectPortableSettings } from '../../../../src/core/settings/portableSettings';
import { getConfiguredBinding, getEffectiveBinding, withShortcutBinding } from '../../../../src/core/shortcuts';
import { planSetCategory } from '../../../../src/services/settings/settingsService';

function file(settings: unknown): string {
    return JSON.stringify({ format: 'ai-markdone-settings', formatVersion: 1, appVersion: '6.0.0', exportedAt: '2026-09-30T00:00:00.000Z', settings });
}
describe('portable settings', () => {
    it.each([50, 75, 300, 500])('roundtrips a %i percent page width', (pageWidthScale) => {
        const current = structuredClone(DEFAULT_SETTINGS);
        current.chatgptBehavior.pageWidthScale = pageWidthScale;
        const parsed = parseSettingsFile(JSON.stringify(createSettingsFile(current, '6.2.0')));
        const restored = mergePortableSettings(DEFAULT_SETTINGS, parsed.file.settings, ['chatgptBehavior']);
        expect(restored.chatgptBehavior.pageWidthScale).toBe(pageWidthScale);
    });
    it('normalizes old 5% page-width imports and rejects invalid widths', () => {
        const parsed = parseSettingsFile(file({ chatgptBehavior: { pageWidthScale: 145 } }));
        expect(mergePortableSettings(DEFAULT_SETTINGS, parsed.file.settings, ['chatgptBehavior']).chatgptBehavior.pageWidthScale).toBe(150);
        for (const value of [25, 505, 147]) {
            expect(() => parseSettingsFile(file({ chatgptBehavior: { pageWidthScale: value } }))).toThrow('SETTINGS_FILE_INVALID');
        }
    });
    it('roundtrips disabled shortcuts and their original chords, with preset and empty defaults remaining implicit', () => {
        const current = structuredClone(DEFAULT_SETTINGS);
        current.shortcuts = withShortcutBinding(current.shortcuts, 'selection.annotate', { code: 'KeyM', primary: true, shift: true, alt: false });
        current.shortcuts.disabled.push('selection.annotate');
        const exported = createSettingsFile(current, '6.2.0');
        const parsed = parseSettingsFile(JSON.stringify(exported));
        const next = mergePortableSettings(DEFAULT_SETTINGS, parsed.file.settings, ['shortcuts']);
        expect(next.shortcuts).toEqual(current.shortcuts);
        expect(getConfiguredBinding(next.shortcuts, 'selection.annotate')?.code).toBe('KeyM');
        expect(getEffectiveBinding(next.shortcuts, 'selection.annotate')).toBeNull();
        expect(getConfiguredBinding(next.shortcuts, 'prompts.openLibrary')).toBeNull();
        (exported.settings.shortcuts as typeof current.shortcuts).overrides['selection.annotate'] = null;
        expect(current.shortcuts.overrides['selection.annotate']).not.toBeNull();
    });
    it.each([
        { enabled: true, overrides: { 'unknown.command': null }, disabled: [] },
        { enabled: true, overrides: { 'selection.annotate': { code: 'KeyM', primary: true, shift: true, alt: false, action: 'run' } }, disabled: [] },
        { enabled: true, overrides: { 'selection.annotate': { code: 'KeyM', primary: 'true', shift: true, alt: false } }, disabled: [] },
        { enabled: true, overrides: { 'selection.annotate': { code: 'KeyW', primary: true, shift: false, alt: false } }, disabled: [] },
        { enabled: true, overrides: { 'selection.highlight': { code: 'KeyN', primary: false, shift: true, alt: false } }, disabled: [] },
        { enabled: true, overrides: {}, disabled: ['selection.annotate', 'selection.annotate'] },
    ])('rejects illegal shortcut imports atomically: %j', shortcuts => {
        expect(() => parseSettingsFile(file({ language: 'en', shortcuts }))).toThrow('SETTINGS_FILE_INVALID');
    });
    it('rechecks partial shortcut imports against the existing effective configuration', () => {
        const current = structuredClone(DEFAULT_SETTINGS);
        current.shortcuts = withShortcutBinding(current.shortcuts, 'selection.annotate', { code: 'KeyM', primary: true, shift: true, alt: false });
        current.shortcuts.disabled.push('selection.annotate');
        current.shortcuts = withShortcutBinding(current.shortcuts, 'selection.highlight', { code: 'KeyM', primary: true, shift: true, alt: false });
        const parsed = parseSettingsFile(file({ shortcuts: { disabled: [] } }));
        expect(() => mergePortableSettings(current, parsed.file.settings, ['shortcuts'])).toThrow('SETTINGS_FILE_INVALID');
        expect(current.shortcuts.disabled).toContain('selection.annotate');
    });
    it('imports old copy and arrow preferences into the canonical shortcut scheme', () => {
        const parsed = parseSettingsFile(file({ chatgptBehavior: { atomicMarkdownCopyShortcut: 'none', enableArrowKeyMessageNavigation: false } }));
        const next = mergePortableSettings(DEFAULT_SETTINGS, parsed.file.settings, ['chatgptBehavior']);
        expect(getEffectiveBinding(next.shortcuts, 'selection.copyMarkdown')).toBeNull();
        expect(getEffectiveBinding(next.shortcuts, 'navigation.next')).toBeNull();
    });
    it('does not convert unchanged legacy mirrors in an imported behavior snapshot into new shortcut edits', () => {
        const initial = loadAndNormalize({ version: 5, chatgptBehavior: { atomicMarkdownCopyShortcut: 'mod-c' } });
        const configured = planSetCategory(initial, 'shortcuts', withShortcutBinding(initial.shortcuts, 'navigation.next', { code: 'KeyM', primary: true, shift: true, alt: false })).next;
        const off = planSetCategory(configured, 'shortcuts', { enabled: false }).next;
        const portable = projectPortableSettings(off).chatgptBehavior as Record<string, unknown>;
        const parsed = parseSettingsFile(file({ chatgptBehavior: { ...portable, promptAutocomplete: false } }));
        const next = mergePortableSettings(off, parsed.file.settings, ['chatgptBehavior']);
        expect(next.shortcuts).toEqual(off.shortcuts);
        const on = planSetCategory(next, 'shortcuts', { enabled: true }).next;
        expect(getEffectiveBinding(on.shortcuts, 'selection.copyMarkdown')?.shift).toBe(false);
        expect(getEffectiveBinding(on.shortcuts, 'navigation.next')?.code).toBe('KeyM');
    });
    it('exports constrained preferences only, excluding credentials, text and legacy migration input', () => {
        const current = structuredClone(DEFAULT_SETTINGS);
        Object.assign(current, { token: 'private', cloudBackup: { auth: 'private' } });
        Object.assign(current.behavior, { apiKey: 'private' });
        current.reader.commentExport.prompts = [{ id: 'secret', title: 'secret', content: 'private' }];
        current.reader.commentExport.template = [{ type: 'text', value: 'private' }];
        const output = JSON.stringify(createSettingsFile(current, '6.0.0'));
        expect(output).not.toContain('private');
        expect(output).not.toContain('prompts');
        expect(output).not.toContain('template');
        expect(output).not.toContain('Confirmed');
        expect(output).not.toContain('gemini');
        expect(output).toContain('markdown-dollar');
    });
    it('roundtrips every supported default without changing excluded preferences', () => {
        const current = structuredClone(DEFAULT_SETTINGS);
        const parsed = parseSettingsFile(JSON.stringify(createSettingsFile(current, '6.0.0')));
        expect(parsed.ignoredCount).toBe(0);
        expect(listSettingsChanges(current, parsed.file.settings)).toEqual([]);
        expect(mergePortableSettings(current, parsed.file.settings, Object.keys(parsed.file.settings))).toEqual(current);
    });
    it('applies a partial file and retains absent fields, confirmation state and dormant pins', () => {
        const current = structuredClone(DEFAULT_SETTINGS);
        current.behavior._contextOnlyConfirmed = true;
        current.chatgptBehavior.pinnedPageControls = ['open-prompts'];
        const original = structuredClone(current);
        const parsed = parseSettingsFile(file({ chatgptBehavior: { showPromptControl: false } }));
        const next = mergePortableSettings(current, parsed.file.settings, ['chatgptBehavior']);
        expect(next.chatgptBehavior.showPromptControl).toBe(false);
        expect(next.chatgptBehavior.pinnedPageControls).toEqual(['open-prompts']);
        expect(next.reader).toEqual(current.reader);
        expect(next.behavior._contextOnlyConfirmed).toBe(true);
        expect(current).toEqual(original);
    });
    it('rejects the whole file when any field is unknown',()=>{
        expect(()=>parseSettingsFile(file({language:'en',token:'private'}))).toThrow('SETTINGS_FILE_UNSUPPORTED');
    });
    it('rejects newer exporters and missing version metadata',()=>{
        const input=JSON.parse(file({language:'en'}));input.appVersion='6.1.0';expect(()=>parseSettingsFile(JSON.stringify(input),'6.0.0')).toThrow('SETTINGS_FILE_NEWER_VERSION');
        delete input.appVersion;expect(()=>parseSettingsFile(JSON.stringify(input),'6.0.0')).toThrow('SETTINGS_FILE_INVALID');
    });
    it('compares version segments numerically and accepts older valid files',()=>{
        const input=JSON.parse(file({language:'en'}));input.appVersion='6.2.0';expect(()=>parseSettingsFile(JSON.stringify(input),'6.10.0')).not.toThrow();
        input.appVersion='6.10.0';expect(()=>parseSettingsFile(JSON.stringify(input),'6.2.0')).toThrow('SETTINGS_FILE_NEWER_VERSION');
    });
    it.each([
        { behavior: { showWordCount: 'false' } },
        { appearance: { fontSizePx: 200 } },
        { export: { pngPixelRatio: 1.7 } },
        { reader: { panelSizeRatio: { widthRatio: null } } },
        { formula: { clickCopyFormulaFormat: 'invalid' } },
        { chatgptBehavior: { pinnedPageControls: ['open-prompts', 'open-prompts'] } },
        { chatgptBehavior: { pinnedPageControls: ['unknown'] } },
    ])('rejects invalid known preferences rather than coercing or resetting them: %j', settings => {
        expect(() => parseSettingsFile(file(settings))).toThrow('SETTINGS_FILE_INVALID');
    });
    it('rejects foreign, empty, future, oversized and prototype-bearing files', () => {
        expect(() => parseSettingsFile('{')).toThrow('SETTINGS_FILE_INVALID');
        expect(() => parseSettingsFile('{"format":"library","version":4}')).toThrow('SETTINGS_FILE_INVALID');
        expect(() => parseSettingsFile(file({}))).toThrow('SETTINGS_FILE_EMPTY');
        expect(() => parseSettingsFile('{"format":"ai-markdone-settings","formatVersion":2,"settings":{"language":"en"}}')).toThrow('SETTINGS_FILE_UNSUPPORTED');
        expect(() => parseSettingsFile(' '.repeat(MAX_SETTINGS_FILE_BYTES + 1))).toThrow('SETTINGS_FILE_TOO_LARGE');
        expect(() => parseSettingsFile('{"format":"ai-markdone-settings","formatVersion":1,"settings":{"language":"en","__proto__":{"polluted":true}}}')).toThrow('SETTINGS_FILE_INVALID');
        expect(({} as Record<string, unknown>).polluted).toBeUndefined();
    });
    it('preserves legacy settings while adding message control defaults', () => {
        const legacy = { version: 5, behavior: { showSaveMessages: false, showWordCount: false }, chatgptBehavior: { pinnedPageControls: ['open-prompts'], showPromptControl: false } };
        const settings = loadAndNormalize(legacy);
        expect(settings.behavior.showSaveMessages).toBe(false);
        expect(settings.behavior.showWordCount).toBe(false);
        expect(settings.behavior.showMessageTimestamp).toBe(true);
        expect(settings.behavior.messageControls.copy_markdown).toBe(true);
        expect(projectPortableSettings(settings).chatgptBehavior).toMatchObject({ pinnedPageControls: ['open-prompts'], showPromptControl: false });
    });
});
