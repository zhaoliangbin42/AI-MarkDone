import { describe, expect, it } from 'vitest';
import {
    chordMatchesEvent, findShortcutConflicts, formatShortcutChord, getConfiguredBinding,
    getDefaultShortcutBindings, getEffectiveBinding, isShortcutSettings, normalizeShortcutSettings,
    resetShortcutBinding, shortcutChordFromEvent, validateShortcutChord, withShortcutBinding,
    findShortcutActivationConflicts, findShortcutResetConflicts,
    type ShortcutChord,
} from '@/core/shortcuts';

const custom: ShortcutChord = { code: 'KeyM', primary: true, shift: true, alt: false };
const key = (patch: Partial<KeyboardEvent> = {}): KeyboardEvent => ({ code: 'Digit1', key: '!', metaKey: false, ctrlKey: true, shiftKey: true, altKey: false, repeat: false, isComposing: false, keyCode: 49, getModifierState: () => false, ...patch } as KeyboardEvent);

describe('shortcut model', () => {
    it('uses mnemonic letter defaults with platform-specific modifiers and preserves existing shortcuts', () => {
        const defaults = getDefaultShortcutBindings();
        const mac = getDefaultShortcutBindings('mac');
        expect(defaults['selection.highlight.blue']).toEqual({ code: 'KeyB', primary: false, shift: true, alt: false });
        expect(mac['selection.highlight.blue']).toEqual({ code: 'KeyB', primary: false, control: true, shift: true, alt: false });
        expect(defaults['selection.highlight.yellow']?.code).toBe('KeyY');
        expect(defaults['selection.highlight.red']?.code).toBe('KeyR');
        expect(defaults['selection.highlight']?.code).toBe('KeyH');
        expect(defaults['selection.annotate']?.code).toBe('KeyN');
        expect(defaults['prompts.openSuggestions']).toEqual({ code: 'KeyP', primary: false, shift: true, alt: true });
        expect(mac['prompts.openSuggestions']).toEqual({ code: 'KeyP', primary: false, control: true, shift: true, alt: false });
        expect(defaults['prompts.openLibrary']).toBeNull();
        expect(defaults['selection.copyMarkdown']?.code).toBe('KeyC');
        expect(defaults['navigation.previous']).toMatchObject({ code: 'ArrowLeft', primary: false, shift: false });
        expect(isShortcutSettings(normalizeShortcutSettings(undefined))).toBe(true);
    });

    it.each(['none', 'mod-c', 'mod-shift-c'] as const)('migrates old copy preference %s without replacing it with a preset', legacy => {
        const migrated = normalizeShortcutSettings(undefined, { atomicMarkdownCopyShortcut: legacy, enableArrowKeyMessageNavigation: false });
        expect(getEffectiveBinding(migrated, 'selection.copyMarkdown')).toEqual(legacy === 'none' ? null : { code: 'KeyC', primary: true, shift: legacy === 'mod-shift-c', alt: false });
        expect(getEffectiveBinding(migrated, 'navigation.previous')).toBeNull();
        expect(getEffectiveBinding(migrated, 'navigation.next')).toBeNull();
    });

    it('lets a current scheme take precedence over dormant legacy fields', () => {
        expect(getEffectiveBinding(normalizeShortcutSettings({ enabled: true, overrides: {}, disabled: [] }, { atomicMarkdownCopyShortcut: 'none' }), 'selection.copyMarkdown')).not.toBeNull();
    });

    it.each(['other', 'mac'] as const)('preserves explicit user bindings on %s when a changed default takes the same chord earlier in the catalog', platform => {
        const userBinding = getDefaultShortcutBindings(platform)['selection.annotate']!;
        const stored = { enabled: true, overrides: { 'selection.highlight.red': userBinding }, disabled: [] };
        const next = normalizeShortcutSettings(stored);
        expect(next.overrides['selection.highlight.red']).toEqual(userBinding);
        expect(getEffectiveBinding(next, 'selection.highlight.red', platform)).toEqual(userBinding);
        expect(getEffectiveBinding(next, 'selection.annotate', platform)).toBeNull();
        expect(next.disabled).toEqual(['selection.annotate']);
        expect(stored.disabled).toEqual([]);
    });

    it('resets an implicit platform default without treating its Mac modifier as a Windows override', () => {
        const custom = { code: 'KeyN', primary: true, shift: true, alt: false, control: true };
        const settings = normalizeShortcutSettings({ enabled: true, overrides: { 'selection.highlight.red': custom }, disabled: ['selection.annotate'] });
        const reset = resetShortcutBinding(settings, 'selection.annotate', {}, 'mac');
        expect(reset.disabled).not.toContain('selection.annotate');
        expect(getConfiguredBinding(reset, 'selection.annotate', 'mac')).toEqual(getDefaultShortcutBindings('mac')['selection.annotate']);
        expect(reset.overrides['selection.highlight.red']).toEqual(custom);
        expect(findShortcutResetConflicts(settings, 'selection.annotate')).toEqual([]);
        expect(findShortcutActivationConflicts(reset, 'selection.annotate')).toEqual([]);
    });

    it('keeps explicit numeric bindings, empty bindings and disabled commands while adopting new implicit defaults', () => {
        const numeric = { code: 'Digit1', primary: true, shift: true, alt: false };
        const next = normalizeShortcutSettings({ enabled: true, overrides: { 'selection.highlight.blue': numeric, 'selection.highlight.yellow': null }, disabled: ['selection.highlight.red'] });
        expect(getEffectiveBinding(next, 'selection.highlight.blue')).toEqual(numeric);
        expect(getConfiguredBinding(next, 'selection.highlight.yellow')).toBeNull();
        expect(getEffectiveBinding(next, 'selection.highlight.red')).toBeNull();
        expect(getEffectiveBinding(next, 'selection.annotate')?.code).toBe('KeyN');
        expect(getConfiguredBinding(next, 'prompts.openLibrary')).toBeNull();
    });

    it('keeps configured chords through per-command and global disable', () => {
        const settings = withShortcutBinding(normalizeShortcutSettings(undefined), 'selection.annotate', custom);
        settings.disabled.push('selection.annotate');
        expect(getConfiguredBinding(settings, 'selection.annotate')).toEqual(custom);
        expect(getEffectiveBinding(settings, 'selection.annotate')).toBeNull();
        settings.disabled = [];
        settings.enabled = false;
        expect(getConfiguredBinding(settings, 'selection.annotate')).toEqual(custom);
        expect(getEffectiveBinding(settings, 'selection.annotate')).toBeNull();
    });

    it('restores the preset or empty default instead of retaining the last binding', () => {
        const base = normalizeShortcutSettings(undefined);
        const changed = withShortcutBinding(base, 'selection.annotate', custom);
        const reset = resetShortcutBinding(changed, 'selection.annotate');
        expect(getConfiguredBinding(reset, 'selection.annotate')).toEqual(getDefaultShortcutBindings()['selection.annotate']);
        expect(reset.overrides).not.toHaveProperty('selection.annotate');
        const library = withShortcutBinding(base, 'prompts.openLibrary', custom);
        expect(getConfiguredBinding(resetShortcutBinding(library, 'prompts.openLibrary'), 'prompts.openLibrary')).toBeNull();
        expect(base.overrides).toEqual({});
    });

    it('checks overlapping page scopes while allowing composer and page bindings to share a key', () => {
        const base = normalizeShortcutSettings(undefined);
        const annotation = getConfiguredBinding(base, 'selection.annotate')!;
        expect(findShortcutConflicts(base, 'navigation.next', annotation)).toEqual(['selection.annotate']);
        expect(findShortcutConflicts(base, 'prompts.openLibrary', annotation)).toEqual([]);
    });

    it('checks the other operating system before accepting an otherwise distinct Mac chord', () => {
        const base = withShortcutBinding(normalizeShortcutSettings(undefined), 'selection.annotate', { code: 'KeyM', primary: false, control: true, shift: true, alt: false }, {}, 'mac');
        expect(findShortcutConflicts(base, 'selection.highlight', custom, 'mac')).toEqual(['selection.annotate']);
    });

    it('atomically replaces a conflicting binding by disabling it and preserving its chord', () => {
        const base = normalizeShortcutSettings(undefined);
        const annotation = getConfiguredBinding(base, 'selection.annotate')!;
        expect(() => withShortcutBinding(base, 'selection.highlight', annotation)).toThrow('SHORTCUT_CONFLICT');
        const next = withShortcutBinding(base, 'selection.highlight', annotation, { replaceConflicts: true });
        expect(next.disabled).toContain('selection.annotate');
        expect(getConfiguredBinding(next, 'selection.annotate')).toEqual(annotation);
        expect(findShortcutConflicts({ ...next, disabled: [] }, 'selection.annotate', annotation)).toEqual(['selection.highlight']);
        expect(base.disabled).toEqual([]);
    });

    it('rechecks conflicts when resetting a preset', () => {
        const base = withShortcutBinding(normalizeShortcutSettings(undefined), 'selection.annotate', custom);
        const occupied = withShortcutBinding(base, 'selection.highlight', getDefaultShortcutBindings()['selection.annotate']!);
        expect(() => resetShortcutBinding(occupied, 'selection.annotate')).toThrow('SHORTCUT_CONFLICT');
        expect(resetShortcutBinding(occupied, 'selection.annotate', { replaceConflicts: true }).disabled).toContain('selection.highlight');
    });

    it('does not mutate default bindings returned to a caller', () => {
        getDefaultShortcutBindings()['selection.highlight.blue']!.code = 'KeyZ';
        expect(getDefaultShortcutBindings()['selection.highlight.blue']!.code).toBe('KeyB');
    });

    it('matches physical codes independently of shifted characters and maps actual Control on Mac', () => {
        expect(chordMatchesEvent({ code: 'Digit1', primary: true, shift: true, alt: false }, key())).toBe(true);
        expect(chordMatchesEvent(getDefaultShortcutBindings()['selection.highlight.blue'], key({ code: 'KeyB', key: 'B', ctrlKey: false }))).toBe(true);
        expect(chordMatchesEvent(getDefaultShortcutBindings('mac')['selection.highlight.blue'], key({ code: 'KeyB', key: 'B' }), 'mac')).toBe(true);
        expect(chordMatchesEvent(getDefaultShortcutBindings('mac')['selection.highlight.blue'], key({ code: 'KeyB', key: 'B', metaKey: true, ctrlKey: false }), 'mac')).toBe(false);
        expect(chordMatchesEvent(custom, key({ code: 'KeyM', key: 'µ' }))).toBe(true);
    });

    it.each([{ repeat: true }, { isComposing: true }, { keyCode: 229 }, { key: 'Dead' }, { key: 'Process' }, { getModifierState: () => true }])('ignores unfinished input and repeated key events: %j', patch => {
        expect(shortcutChordFromEvent(key(patch))).toBeNull();
    });

    it('allows Mac Option even when Firefox exposes it as AltGraph', () => {
        expect(shortcutChordFromEvent(key({ altKey: true, metaKey: true, getModifierState: () => true }), 'mac')).toMatchObject({ alt: true, primary: true });
    });

    it('rejects Control+Alt assignment on non-Mac and deactivates an imported Mac Command+Option chord there', () => {
        const candidate = { code: 'KeyM', primary: true, shift: false, alt: true };
        expect(validateShortcutChord(candidate, 'selection.annotate', 'other')).toEqual({ valid: false, reason: 'reserved' });
        expect(validateShortcutChord(candidate, 'selection.annotate', 'mac').valid).toBe(true);
        const imported = normalizeShortcutSettings({ enabled: true, overrides: { 'selection.annotate': candidate }, disabled: [] });
        expect(getConfiguredBinding(imported, 'selection.annotate', 'other')).toEqual(candidate);
        expect(getEffectiveBinding(imported, 'selection.annotate', 'other')).toBeNull();
        expect(getEffectiveBinding(imported, 'selection.annotate', 'mac')).toEqual(candidate);
        expect(shortcutChordFromEvent(key({ code: 'KeyM', key: 'µ', metaKey: true, ctrlKey: false, shiftKey: false, altKey: true, getModifierState: () => true }), 'mac')).toEqual(candidate);
    });

    it('rejects unknown codes, navigation capture keys, browser actions and bare typing', () => {
        expect(validateShortcutChord({ ...custom, code: 'InjectedScript' }).valid).toBe(false);
        expect(validateShortcutChord({ ...custom, code: 'Escape' }).reason).toBe('reserved');
        expect(validateShortcutChord({ ...custom, code: 'Tab' }).reason).toBe('reserved');
        expect(validateShortcutChord({ ...custom, code: 'KeyW', shift: false }).reason).toBe('reserved');
        expect(validateShortcutChord({ ...custom, primary: false }).reason).toBe('modifier-required');
        expect(validateShortcutChord({ ...custom, code: 'Digit3' }, 'selection.annotate', 'mac').reason).toBe('reserved');
        expect(validateShortcutChord(getDefaultShortcutBindings()['navigation.next'], 'navigation.next').valid).toBe(true);
        expect(validateShortcutChord(getDefaultShortcutBindings()['navigation.next'], 'selection.annotate').valid).toBe(false);
    });

    it('allows Shift-letter only for selection commands, never bare letters, navigation or composer commands', () => {
        const shifted = { code: 'KeyB', primary: false, shift: true, alt: false };
        expect(validateShortcutChord(shifted, 'selection.highlight.blue', 'other').valid).toBe(true);
        expect(validateShortcutChord(shifted, 'navigation.next', 'other').valid).toBe(false);
        expect(validateShortcutChord(shifted, 'prompts.openSuggestions', 'other').valid).toBe(false);
        expect(validateShortcutChord({ ...shifted, shift: false }, 'selection.highlight.blue', 'other').valid).toBe(false);
        expect(getEffectiveBinding(normalizeShortcutSettings(undefined), 'selection.highlight.blue', 'other')).toEqual(shifted);
    });

    it.each(['KeyR', 'KeyY', 'KeyH', 'KeyS'])('reserves browser Primary+Shift+%s while retaining Mac actual Control bindings', code => {
        const primary = { code, primary: true, shift: true, alt: false };
        const control = { code, primary: false, control: true, shift: true, alt: false };
        expect(validateShortcutChord(primary, 'selection.highlight.red', 'other')).toEqual({ valid: false, reason: 'reserved' });
        expect(validateShortcutChord(control, 'selection.highlight.red', 'mac').valid).toBe(true);
        const stored = normalizeShortcutSettings({ enabled: true, overrides: { 'selection.highlight.red': control }, disabled: [] });
        expect(getEffectiveBinding(stored, 'selection.highlight.red', 'other')).toBeNull();
    });

    it('renders mnemonic letters with their actual platform modifiers in settings', () => {
        expect(formatShortcutChord(getDefaultShortcutBindings('mac')['selection.highlight.red'], 'mac')).toBe('⌃⇧R');
        expect(formatShortcutChord(getDefaultShortcutBindings()['selection.highlight.red'])).toBe('Shift+R');
        expect(formatShortcutChord(getDefaultShortcutBindings()['prompts.openSuggestions'])).toBe('Alt+Shift+P');
        expect(formatShortcutChord(getDefaultShortcutBindings('mac')['selection.copyMarkdown'], 'mac')).toBe('⌘⇧C');
        expect(formatShortcutChord(null)).toBe('');
    });
});
