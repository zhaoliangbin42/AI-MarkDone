export const SHORTCUT_COMMAND_IDS = [
    'selection.copyMarkdown', 'selection.annotate', 'selection.highlight',
    'selection.highlight.blue', 'selection.highlight.yellow', 'selection.highlight.red',
    'prompts.openSuggestions', 'prompts.openLibrary', 'navigation.previous', 'navigation.next',
] as const;

export type ShortcutCommandId = typeof SHORTCUT_COMMAND_IDS[number];
export type ShortcutScope = 'selection' | 'navigation' | 'composer';
export type ShortcutPlatform = 'mac' | 'other';
export type ShortcutChord = { code: string; primary: boolean; shift: boolean; alt: boolean; control?: boolean };
export type ShortcutSettings = {
    enabled: boolean;
    overrides: Partial<Record<ShortcutCommandId, ShortcutChord | null>>;
    disabled: ShortcutCommandId[];
};
export type ShortcutCommand = { id: ShortcutCommandId; scope: ShortcutScope; group: ShortcutScope };
export const SHORTCUT_COMMANDS: readonly ShortcutCommand[] = SHORTCUT_COMMAND_IDS.map(id => {
    const scope: ShortcutScope = id.startsWith('selection.') ? 'selection' : id.startsWith('navigation.') ? 'navigation' : 'composer';
    return { id, scope, group: scope };
});

function chord(code: string, primary = true, shift = true): ShortcutChord {
    return { code, primary, shift, alt: false };
}

export function getShortcutPlatform(platformName = ''): ShortcutPlatform {
    return /mac|iphone|ipad|ipod/i.test(platformName) ? 'mac' : 'other';
}

export function getDefaultShortcutBindings(platform: ShortcutPlatform = 'other'): Record<ShortcutCommandId, ShortcutChord | null> {
    const selection = (letter: string): ShortcutChord => ({ code: `Key${letter}`, primary: false, shift: true, alt: false, ...(platform === 'mac' ? { control: true } : {}) });
    return {
        'selection.copyMarkdown': chord('KeyC'),
        'selection.annotate': selection('N'),
        'selection.highlight': selection('H'),
        'selection.highlight.blue': selection('B'),
        'selection.highlight.yellow': selection('Y'),
        'selection.highlight.red': selection('R'),
        'prompts.openSuggestions': platform === 'mac'
            ? { code: 'KeyP', primary: false, control: true, shift: true, alt: false }
            : { code: 'KeyP', primary: false, shift: true, alt: true },
        'prompts.openLibrary': null,
        'navigation.previous': chord('ArrowLeft', false, false),
        'navigation.next': chord('ArrowRight', false, false),
    };
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function isShortcutCommandId(value: unknown): value is ShortcutCommandId {
    return typeof value === 'string' && (SHORTCUT_COMMAND_IDS as readonly string[]).includes(value);
}

const specialCodes = new Set(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space', 'Enter', 'Backspace', 'Delete', 'Insert', 'Home', 'End', 'PageUp', 'PageDown', 'Minus', 'Equal', 'BracketLeft', 'BracketRight', 'Backslash', 'Semicolon', 'Quote', 'Comma', 'Period', 'Slash', 'Backquote', 'Escape', 'Tab']);

export function validateShortcutChord(value: unknown, id?: ShortcutCommandId, platform?: ShortcutPlatform): { valid: boolean; reason?: 'invalid' | 'modifier-required' | 'reserved' } {
    if (!isRecord(value) || Object.keys(value).some(key => !['code', 'primary', 'shift', 'alt', 'control'].includes(key))
        || typeof value.code !== 'string' || !(/^(?:Key[A-Z]|Digit[0-9]|F(?:[1-9]|1[0-2]))$/.test(value.code) || specialCodes.has(value.code))
        || typeof value.primary !== 'boolean' || typeof value.shift !== 'boolean' || typeof value.alt !== 'boolean'
        || (value.control !== undefined && typeof value.control !== 'boolean')) return { valid: false, reason: 'invalid' };
    const candidate = value as ShortcutChord;
    if (candidate.code === 'Escape' || candidate.code === 'Tab') return { valid: false, reason: 'reserved' };
    if (platform === 'other' && candidate.alt && (candidate.primary || candidate.control)) return { valid: false, reason: 'reserved' };
    if (platform === 'mac' && candidate.primary && candidate.shift && !candidate.control && !candidate.alt && /^Digit[3456]$/.test(candidate.code)) return { valid: false, reason: 'reserved' };
    if (candidate.alt && candidate.code === 'F4') return { valid: false, reason: 'reserved' };
    if (platform === 'mac' && candidate.control && !candidate.primary && !candidate.alt && !candidate.shift && candidate.code.startsWith('Arrow')) return { valid: false, reason: 'reserved' };
    if (!candidate.primary && !candidate.control && !candidate.alt) {
        if (id?.startsWith('navigation.') && !candidate.shift && ['ArrowLeft', 'ArrowRight'].includes(candidate.code)) return { valid: true };
        if (id?.startsWith('selection.') && candidate.shift && /^Key[A-Z]$/.test(candidate.code)) return { valid: true };
        return { valid: false, reason: 'modifier-required' };
    }
    // Reserve known browser/editing actions on either target platform. External
    // extensions and user-defined OS bindings cannot be enumerated by the page.
    if (candidate.primary && !candidate.alt && !candidate.control) {
        const copy = id === 'selection.copyMarkdown' && candidate.code === 'KeyC';
        const plainReserved = /^(?:Digit[0-9]|Key[A-Z]|F[1-9]|F1[0-2]|Enter)$/.test(candidate.code);
        const shiftedReserved = ['KeyA', 'KeyB', 'KeyC', 'KeyD', 'KeyH', 'KeyI', 'KeyJ', 'KeyN', 'KeyP', 'KeyQ', 'KeyR', 'KeyS', 'KeyT', 'KeyV', 'KeyW', 'KeyX', 'KeyY', 'KeyZ', 'Delete', 'Backspace'].includes(candidate.code);
        if (!copy && (candidate.shift ? shiftedReserved : plainReserved)) return { valid: false, reason: 'reserved' };
    }
    return { valid: true };
}

function normalizedChord(value: ShortcutChord): ShortcutChord {
    return { code: value.code, primary: value.primary, shift: value.shift, alt: value.alt, ...(value.control ? { control: true } : {}) };
}

export function normalizeShortcutSettings(input: unknown, legacyBehavior?: unknown): ShortcutSettings {
    const record = isRecord(input) ? input : null;
    const overrides: ShortcutSettings['overrides'] = {};
    const disabled: ShortcutCommandId[] = [];
    if (record) {
        const rawOverrides = isRecord(record.overrides) ? record.overrides : {};
        for (const id of SHORTCUT_COMMAND_IDS) {
            if (!Object.prototype.hasOwnProperty.call(rawOverrides, id)) continue;
            const value = rawOverrides[id];
            if (value === null) overrides[id] = null;
            else if (validateShortcutChord(value, id).valid) overrides[id] = normalizedChord(value as ShortcutChord);
        }
        if (Array.isArray(record.disabled)) {
            const rawDisabled = record.disabled;
            disabled.push(...SHORTCUT_COMMAND_IDS.filter(id => rawDisabled.includes(id)));
        }
    } else if (isRecord(legacyBehavior)) {
        const copy = legacyBehavior.atomicMarkdownCopyShortcut;
        if (copy === 'none' || (copy === undefined && legacyBehavior.atomicMarkdownCopy === false)) overrides['selection.copyMarkdown'] = null;
        else if (copy === 'mod-c' || (copy === undefined && legacyBehavior.atomicMarkdownCopy === true)) overrides['selection.copyMarkdown'] = chord('KeyC', true, false);
        if (legacyBehavior.enableArrowKeyMessageNavigation === false) disabled.push('navigation.previous', 'navigation.next');
    }
    const next: ShortcutSettings = { enabled: record?.enabled !== false, overrides, disabled };
    // A new default must not take a chord the user explicitly configured.
    // Resolve malformed duplicate overrides deterministically before defaults.
    const explicit = SHORTCUT_COMMAND_IDS.filter(id => Object.prototype.hasOwnProperty.call(overrides, id) && overrides[id] !== null);
    const priority = [...explicit, ...SHORTCUT_COMMAND_IDS.filter(id => !explicit.includes(id))];
    const accepted = new Set<ShortcutCommandId>();
    for (const id of priority) {
        if (disabled.includes(id)) continue;
        const binding = getConfiguredBinding(next, id);
        if (!binding) continue;
        if (findConfiguredShortcutConflicts(next, id).some(other => accepted.has(other))) disabled.push(id);
        else accepted.add(id);
    }
    return next;
}

export function applyLegacyShortcutPreferences(settings: ShortcutSettings, value: Record<string, unknown>, previousBehavior?: Record<string, unknown>): ShortcutSettings {
    const next: ShortcutSettings = { ...settings, overrides: { ...settings.overrides }, disabled: [...settings.disabled] };
    const legacyCopyValue = (record: Record<string, unknown>): unknown => record.atomicMarkdownCopyShortcut
        ?? (record.atomicMarkdownCopy === true ? 'mod-c' : record.atomicMarkdownCopy === false ? 'none' : undefined);
    // Older surfaces send full behavior snapshots, including unchanged mirrors
    // of temporarily disabled shortcuts. Only changed mirrors express edits.
    const copyChanged = !previousBehavior || legacyCopyValue(value) !== legacyCopyValue(previousBehavior);
    if (copyChanged && (Object.prototype.hasOwnProperty.call(value, 'atomicMarkdownCopyShortcut') || Object.prototype.hasOwnProperty.call(value, 'atomicMarkdownCopy'))) {
        const migrated = normalizeShortcutSettings(undefined, value);
        delete next.overrides['selection.copyMarkdown'];
        if (Object.prototype.hasOwnProperty.call(migrated.overrides, 'selection.copyMarkdown')) next.overrides['selection.copyMarkdown'] = migrated.overrides['selection.copyMarkdown'];
        next.disabled = next.disabled.filter(id => id !== 'selection.copyMarkdown');
    }
    if (typeof value.enableArrowKeyMessageNavigation === 'boolean'
        && (!previousBehavior || value.enableArrowKeyMessageNavigation !== previousBehavior.enableArrowKeyMessageNavigation)) {
        next.disabled = next.disabled.filter(id => id !== 'navigation.previous' && id !== 'navigation.next');
        if (!value.enableArrowKeyMessageNavigation) next.disabled.push('navigation.previous', 'navigation.next');
    }
    return normalizeShortcutSettings(next);
}

export function getConfiguredBinding(settings: ShortcutSettings, id: ShortcutCommandId, platform: ShortcutPlatform = 'other'): ShortcutChord | null {
    const value = Object.prototype.hasOwnProperty.call(settings.overrides, id) ? settings.overrides[id] : getDefaultShortcutBindings(platform)[id];
    if (!value) return null;
    // An explicit Mac Control binding remains usable after importing on Windows.
    return platform === 'other' && value.control ? { ...normalizedChord(value), primary: true, control: undefined } : normalizedChord(value);
}

export function getEffectiveBinding(settings: ShortcutSettings, id: ShortcutCommandId, platform: ShortcutPlatform = 'other'): ShortcutChord | null {
    if (!settings.enabled || settings.disabled.includes(id)) return null;
    const configured = getConfiguredBinding(settings, id, platform);
    return configured && validateShortcutChord(configured, id, platform).valid ? configured : null;
}

export function shortcutChordsEqual(left: ShortcutChord, right: ShortcutChord): boolean {
    return left.code === right.code && left.primary === right.primary && left.shift === right.shift && left.alt === right.alt && Boolean(left.control) === Boolean(right.control);
}

function scopesOverlap(left: ShortcutCommandId, right: ShortcutCommandId): boolean {
    return left.startsWith('prompts.') === right.startsWith('prompts.');
}

function findConfiguredShortcutConflicts(settings: ShortcutSettings, id: ShortcutCommandId): ShortcutCommandId[] {
    return SHORTCUT_COMMAND_IDS.filter(other => other !== id && !settings.disabled.includes(other) && scopesOverlap(id, other)
        && (['mac', 'other'] as const).some(platform => {
            const left = getConfiguredBinding(settings, id, platform);
            const right = getConfiguredBinding(settings, other, platform);
            return left !== null && right !== null && shortcutChordsEqual(left, right);
        }));
}

export function findShortcutActivationConflicts(settings: ShortcutSettings, id: ShortcutCommandId): ShortcutCommandId[] {
    return findConfiguredShortcutConflicts(settings, id);
}

export function findShortcutResetConflicts(settings: ShortcutSettings, id: ShortcutCommandId): ShortcutCommandId[] {
    const next = { ...settings, overrides: { ...settings.overrides } };
    delete next.overrides[id];
    return findConfiguredShortcutConflicts(next, id);
}

export function findShortcutConflicts(settings: ShortcutSettings, id: ShortcutCommandId, candidate: ShortcutChord, platform: ShortcutPlatform = 'other'): ShortcutCommandId[] {
    return SHORTCUT_COMMAND_IDS.filter(other => {
        if (other === id || settings.disabled.includes(other) || !scopesOverlap(id, other)) return false;
        return [platform, platform === 'mac' ? 'other' : 'mac'].some(target => {
            const targetPlatform = target as ShortcutPlatform;
            const effectiveCandidate = targetPlatform === 'other' && candidate.control ? { ...candidate, primary: true, control: undefined } : candidate;
            const binding = getConfiguredBinding(settings, other, targetPlatform);
            return binding !== null && shortcutChordsEqual(binding, effectiveCandidate);
        });
    });
}

export function withShortcutBinding(settings: ShortcutSettings, id: ShortcutCommandId, candidate: ShortcutChord | null, options: { replaceConflicts?: boolean } = {}, platform: ShortcutPlatform = 'other'): ShortcutSettings {
    if (candidate !== null && !validateShortcutChord(candidate, id, platform).valid) throw new Error('SHORTCUT_INVALID');
    const conflicts = candidate ? findShortcutConflicts(settings, id, candidate, platform) : [];
    if (conflicts.length && !options.replaceConflicts) throw new Error('SHORTCUT_CONFLICT');
    const next: ShortcutSettings = { enabled: settings.enabled, overrides: { ...settings.overrides, [id]: candidate ? normalizedChord(candidate) : null }, disabled: settings.disabled.filter(value => value !== id) };
    for (const conflict of conflicts) if (!next.disabled.includes(conflict)) next.disabled.push(conflict);
    return next;
}

export function resetShortcutBinding(settings: ShortcutSettings, id: ShortcutCommandId, options: { replaceConflicts?: boolean } = {}, platform: ShortcutPlatform = 'other'): ShortcutSettings {
    const binding = getDefaultShortcutBindings(platform)[id];
    if (binding && !validateShortcutChord(binding, id, platform).valid) throw new Error('SHORTCUT_INVALID');
    const next: ShortcutSettings = { ...settings, overrides: { ...settings.overrides }, disabled: settings.disabled.filter(other => other !== id) };
    delete next.overrides[id];
    // Reset restores each platform's implicit default, not a portable recording
    // of the current platform's modifier combination.
    const conflicts = findConfiguredShortcutConflicts(next, id);
    if (conflicts.length && !options.replaceConflicts) throw new Error('SHORTCUT_CONFLICT');
    for (const conflict of conflicts) if (!next.disabled.includes(conflict)) next.disabled.push(conflict);
    return next;
}

type ShortcutKeyEvent = Pick<KeyboardEvent, 'code' | 'key' | 'metaKey' | 'ctrlKey' | 'shiftKey' | 'altKey' | 'repeat' | 'isComposing' | 'keyCode' | 'getModifierState'>;

export function shortcutChordFromEvent(event: ShortcutKeyEvent, platform: ShortcutPlatform = 'other'): ShortcutChord | null {
    if (event.repeat || event.isComposing || event.keyCode === 229 || ['Dead', 'Process', 'Unidentified'].includes(event.key)
        || (platform !== 'mac' && event.getModifierState?.('AltGraph'))) return null;
    if (!/^(?:Key[A-Z]|Digit[0-9]|F(?:[1-9]|1[0-2]))$/.test(event.code) && !specialCodes.has(event.code)) return null;
    if (platform !== 'mac' && event.metaKey) return null;
    return { code: event.code, primary: platform === 'mac' ? event.metaKey : event.ctrlKey, shift: event.shiftKey, alt: event.altKey, ...(platform === 'mac' && event.ctrlKey ? { control: true } : {}) };
}

export function chordMatchesEvent(binding: ShortcutChord | null, event: ShortcutKeyEvent, platform: ShortcutPlatform = 'other'): boolean {
    if (!binding) return false;
    const candidate = shortcutChordFromEvent(event, platform);
    return candidate !== null && shortcutChordsEqual(binding, candidate);
}

export function formatShortcutChord(value: ShortcutChord | null, platform: ShortcutPlatform = 'other'): string {
    if (!value) return '';
    const names: Record<string, string> = { ArrowLeft: '←', ArrowRight: '→', ArrowUp: '↑', ArrowDown: '↓', Space: 'Space', Backslash: '\\', Slash: '/', Backquote: '`', Minus: '-', Equal: '=', BracketLeft: '[', BracketRight: ']', Semicolon: ';', Quote: "'", Comma: ',', Period: '.' };
    const key = names[value.code] ?? value.code.replace(/^Key|^Digit/, '');
    const parts = [value.control ? (platform === 'mac' ? '⌃' : 'Ctrl') : '', value.primary ? (platform === 'mac' ? '⌘' : 'Ctrl') : '', value.alt ? (platform === 'mac' ? '⌥' : 'Alt') : '', value.shift ? (platform === 'mac' ? '⇧' : 'Shift') : '', key].filter(Boolean);
    return parts.join(platform === 'mac' ? '' : '+');
}

export function isShortcutSettings(value: unknown): value is ShortcutSettings {
    if (!isRecord(value) || Object.keys(value).some(key => !['enabled', 'overrides', 'disabled'].includes(key))
        || typeof value.enabled !== 'boolean' || !isRecord(value.overrides) || !Array.isArray(value.disabled)
        || value.disabled.some(id => !isShortcutCommandId(id)) || new Set(value.disabled).size !== value.disabled.length) return false;
    for (const [id, binding] of Object.entries(value.overrides)) {
        if (!isShortcutCommandId(id) || (binding !== null && !validateShortcutChord(binding, id).valid)) return false;
    }
    const settings = value as ShortcutSettings;
    return SHORTCUT_COMMAND_IDS.every(id => {
        return settings.disabled.includes(id) || findConfiguredShortcutConflicts(settings, id).length === 0;
    });
}
