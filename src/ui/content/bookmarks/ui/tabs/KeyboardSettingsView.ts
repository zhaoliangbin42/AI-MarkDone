import {
    SHORTCUT_COMMANDS, getShortcutPlatform, getConfiguredBinding, getDefaultShortcutBindings, normalizeShortcutSettings,
    findShortcutConflicts, validateShortcutChord, shortcutChordFromEvent, formatShortcutChord,
    findShortcutActivationConflicts, findShortcutResetConflicts,
    withShortcutBinding, resetShortcutBinding,
    type ShortcutCommandId, type ShortcutChord, type ShortcutSettings,
} from '../../../../../core/shortcuts';
import type { AppSettings } from '../../../../../core/settings/types';
import { AppearanceScope } from '../../../../../style/appearanceScope';
import { createAppearanceSnapshot, type AppearanceSnapshot } from '../../../../../style/appearance';
import { ensureStyle } from '../../../../../style/shadow';
import { t } from '../../../components/i18n';
import { getKeyboardSettingsCss } from './keyboardSettingsCss';
import { SHORTCUT_COMMAND_LABELS as COMMAND_LABELS } from './keyboardSettingsLabels';

const GROUP_KEYS = { selection: 'keyboardGroupSelection', navigation: 'keyboardGroupNavigation', composer: 'keyboardGroupComposer' };
const SCOPE_KEYS = { selection: 'keyboardScopeSelection', navigation: 'keyboardScopeNavigation', composer: 'keyboardScopeComposer' };
type Recording = {
    id: ShortcutCommandId;
    candidate: ShortcutChord | null;
    pending: ShortcutChord | null;
    ready: boolean;
    reset: boolean;
    activate: boolean;
    held: Set<string>;
    preview: string[];
};
export type KeyboardSettingsActions = {
    save: (settings: ShortcutSettings) => Promise<boolean>;
    setAutomatic: (enabled: boolean) => Promise<boolean>;
};

export class KeyboardSettingsView {
    readonly root = document.createElement('div');
    private readonly shadow = this.root.attachShadow({ mode: 'open' });
    private readonly appearance = AppearanceScope.forShadowRoot(this.shadow);
    private readonly body = document.createElement('section');
    private readonly lifetime = new AbortController();
    private settings = normalizeShortcutSettings(undefined);
    private automatic = true;
    private readOnly = false;
    private pending = false;
    private compatibilityNotice = false;
    private disposed = false;
    private composing = false;
    private recording: Recording | null = null;
    private query = '';
    private resetConfirmation = false;
    private status = '';
    private readonly platform = getShortcutPlatform(navigator.platform);

    constructor(private readonly actions: KeyboardSettingsActions) {
        this.root.dataset.role = 'settings-keyboard';
        this.root.dataset.aimdRole = 'settings-keyboard';
        this.body.className = 'keyboard-settings';
        this.appearance.apply(createAppearanceSnapshot('light'));
        ensureStyle(this.shadow, getKeyboardSettingsCss(), { id: 'aimd-keyboard-settings' });
        this.shadow.append(this.body);
        this.shadow.addEventListener('keydown', this.onKeyDown, { capture: true, signal: this.lifetime.signal });
        window.addEventListener('keyup', this.onKeyUp, { capture: true, signal: this.lifetime.signal });
        this.shadow.addEventListener('compositionstart', () => {
            this.composing = true;
            if (this.recording) { this.recording.pending = null; this.recording.candidate = null; this.recording.ready = false; this.recording.held.clear(); this.recording.preview = []; }
        }, { signal: this.lifetime.signal });
        this.shadow.addEventListener('compositionend', () => { this.composing = false; if (this.recording) { this.render(); this.focusCapture(); } }, { signal: this.lifetime.signal });
        window.addEventListener('blur', () => this.dismiss(), { signal: this.lifetime.signal });
        this.render();
    }

    setState(settings: AppSettings): void {
        if (this.disposed) return;
        this.settings = normalizeShortcutSettings(settings.shortcuts, settings.chatgptBehavior);
        this.automatic = settings.chatgptBehavior.promptAutocomplete;
        this.render();
    }
    setAppearance(snapshot: AppearanceSnapshot): void { this.appearance.apply(snapshot); }
    setReadOnly(value: boolean): void {
        if (this.readOnly === value) return;
        this.readOnly = value;
        if (value) {
            this.composing = false;
            if (this.recording) { this.recording.pending = null; this.recording.held.clear(); this.recording.preview = []; }
            delete this.root.dataset.aimdShortcutRecording;
        } else if (this.recording) this.root.dataset.aimdShortcutRecording = 'true';
        this.render();
        if (!value && this.recording) this.focusCapture();
    }
    setCompatibilityNotice(value: boolean): void {
        if (this.compatibilityNotice === value) return;
        this.compatibilityNotice = value; this.render();
        if (!this.readOnly && this.recording) this.focusCapture();
    }
    getSearchText(): string {
        return `${t('keyboardTab')} ${t('keyboardEnabled')} ${t('keyboardAutomatic')} ${SHORTCUT_COMMANDS.map(c => `${t(COMMAND_LABELS[c.id])} ${t(SCOPE_KEYS[c.scope])} ${formatShortcutChord(getConfiguredBinding(this.settings, c.id, this.platform), this.platform)}`).join(' ')}`;
    }
    search(query: string): boolean {
        this.query = query.trim().toLocaleLowerCase();
        this.dismiss();
        this.render();
        return this.matches().length > 0 || this.automaticMatches();
    }
    dismiss(restoreFocus = false): void {
        const id = this.recording?.id;
        this.recording = null;
        this.composing = false;
        this.resetConfirmation = false;
        delete this.root.dataset.aimdShortcutRecording;
        if (!this.disposed) {
            this.render();
            if (restoreFocus && id) this.focusBinding(id);
        }
    }
    consumeEscape(): boolean {
        if (!this.recording && !this.resetConfirmation) return false;
        this.dismiss(true);
        return true;
    }
    dispose(): void {
        this.disposed = true;
        this.recording = null;
        delete this.root.dataset.aimdShortcutRecording;
        this.lifetime.abort();
        this.appearance.dispose();
    }

    private button(label: string, action: string, click: () => void, primary = false): HTMLButtonElement {
        const button = document.createElement('button');
        button.type = 'button'; button.textContent = label; button.dataset.action = action;
        button.className = primary ? 'keyboard-primary' : 'keyboard-text-button';
        button.disabled = this.pending || this.readOnly;
        button.addEventListener('click', click);
        return button;
    }
    private toggle(label: string, checked: boolean, action: string, click: () => void): HTMLButtonElement {
        const button = this.button('', action, click);
        button.className = 'keyboard-switch';
        button.setAttribute('role', 'switch'); button.setAttribute('aria-label', label);
        button.setAttribute('aria-checked', String(checked));
        return button;
    }
    private caption(text: string): HTMLParagraphElement {
        const caption = document.createElement('p'); caption.className = 'keyboard-caption'; caption.textContent = text;
        return caption;
    }
    private keycaps(binding: ShortcutChord | null): HTMLElement {
        const keys = document.createElement('span'); keys.className = 'keyboard-keys';
        if (!binding) { keys.textContent = t('keyboardRecord'); return keys; }
        const formatted = formatShortcutChord(binding, this.platform);
        const labels = this.platform === 'mac' ? formatted.match(/[⌃⌘⌥⇧]|[^⌃⌘⌥⇧]+/g) ?? [] : formatted.split('+');
        for (const label of labels) {
            const key = document.createElement('kbd'); key.textContent = label; keys.append(key);
        }
        return keys;
    }
    private matches() {
        const terms = this.query.split(/\s+/u).filter(Boolean);
        return SHORTCUT_COMMANDS.filter(command => {
            const binding = getConfiguredBinding(this.settings, command.id, this.platform);
            const text = `${t('keyboardTab')} ${t(GROUP_KEYS[command.group])} ${t(COMMAND_LABELS[command.id])} ${t(SCOPE_KEYS[command.scope])} ${binding ? formatShortcutChord(binding, this.platform) : t('keyboardUnset')}`.toLocaleLowerCase();
            return terms.every(term => text.includes(term));
        });
    }
    private automaticMatches(): boolean {
        return !this.query || this.query.split(/\s+/u).every(term => `${t('keyboardTab')} ${t('keyboardAutomatic')} ${t('keyboardAutomaticDesc')}`.toLocaleLowerCase().includes(term));
    }
    private render(): void {
        if (this.disposed) return;
        this.body.replaceChildren();
        this.body.dataset.enabled = String(this.settings.enabled);
        this.body.setAttribute('aria-busy', String(this.pending));
        const overview = document.createElement('div'); overview.className = 'keyboard-overview';
        const label = document.createElement('div'); label.className = 'keyboard-overview-label';
        const text = document.createElement('div'); const strong = document.createElement('strong'); strong.textContent = t('keyboardEnabled');
        text.append(strong, this.caption(t(this.settings.enabled ? 'keyboardEnabledDesc' : 'keyboardDisabledDesc')));
        label.append(this.toggle(t('keyboardEnabled'), this.settings.enabled, 'toggle-all', () => {
            this.dismiss(); void this.write({ ...this.settings, enabled: !this.settings.enabled });
        }), text);
        overview.append(label, this.button(t('keyboardResetAll'), 'reset-all', () => { this.dismiss(); this.resetConfirmation = true; this.render(); this.shadow.querySelector<HTMLButtonElement>('[data-action="cancel-reset"]')?.focus(); }));
        this.body.append(overview);
        if (this.resetConfirmation) this.renderResetConfirmation();
        const commands = this.matches();
        for (const group of ['selection', 'navigation', 'composer'] as const) {
            const selected = commands.filter(command => command.group === group);
            if (!selected.length) continue;
            const section = document.createElement('section'); section.className = 'keyboard-section';
            const heading = document.createElement('h4'); heading.textContent = t(GROUP_KEYS[group]);
            const rows = document.createElement('div'); rows.className = 'keyboard-list';
            for (const command of selected) rows.append(this.renderRow(command.id, command.scope));
            section.append(heading, rows); this.body.append(section);
        }
        if (this.automaticMatches()) {
            const section = document.createElement('section'); section.className = 'keyboard-section';
            const heading = document.createElement('h4'); heading.textContent = t('keyboardAutomaticHeading');
            const row = document.createElement('div'); row.className = 'keyboard-auto-row';
            const label = document.createElement('div'); const title = document.createElement('strong'); title.textContent = t('keyboardAutomatic');
            label.append(title, this.caption(t('keyboardAutomaticDesc')));
            row.append(label, this.toggle(t('keyboardAutomatic'), this.automatic, 'toggle-auto', () => void this.writeAutomatic()));
            section.append(heading, row); this.body.append(section);
        }
        if (!commands.length && !this.automaticMatches()) this.body.append(this.caption(t('keyboardNoMatches')));
        const notice = this.caption(this.status || (this.compatibilityNotice ? t('settingsReloadForUpdate') : '')); notice.classList.add('keyboard-notice'); notice.dataset.role = 'keyboard-status'; notice.setAttribute('role', 'status'); notice.setAttribute('aria-live', 'polite');
        this.body.append(this.caption(t('keyboardExternalConflicts')), notice);
    }
    private renderRow(id: ShortcutCommandId, scope: keyof typeof SCOPE_KEYS): HTMLElement {
        const row = document.createElement('div'); row.className = 'keyboard-row'; row.dataset.command = id;
        const summary = document.createElement('div'); summary.className = 'keyboard-row-summary';
        const label = document.createElement('div'); label.className = 'keyboard-row-label';
        const title = document.createElement('strong'); title.textContent = t(COMMAND_LABELS[id]);
        const disabled = this.settings.disabled.includes(id);
        const binding = getConfiguredBinding(this.settings, id, this.platform);
        const unavailable = this.settings.enabled && !disabled && binding !== null && !validateShortcutChord(binding, id, this.platform).valid;
        if (disabled || unavailable) {
            const status = document.createElement('span'); status.className = 'keyboard-status-pill'; status.textContent = t(unavailable ? 'keyboardPlatformUnavailable' : 'keyboardStopped');
            if (unavailable) { status.dataset.role = 'keyboard-platform-unavailable'; status.title = t('keyboardReserved'); }
            title.append(' ', status);
        }
        label.append(title, this.caption(t(SCOPE_KEYS[scope])));
        const actions = document.createElement('div'); actions.className = 'keyboard-row-actions';
        const record = this.button('', 'record', () => this.beginRecord(id)); record.className = 'keyboard-binding';
        record.dataset.id = id; record.dataset.off = String(disabled || unavailable); record.dataset.unset = String(!binding);
        record.setAttribute('aria-label', `${t(COMMAND_LABELS[id])}: ${binding ? formatShortcutChord(binding, this.platform) : t('keyboardUnset')}. ${t('keyboardRecord')}`);
        record.setAttribute('aria-expanded', String(this.recording?.id === id)); record.append(this.keycaps(binding));
        actions.append(record);
        if (binding) {
            const toggle = this.button(t(disabled ? 'keyboardEnable' : 'keyboardDisable'), 'toggle-command', () => void this.toggleCommand(id));
            toggle.setAttribute('aria-label', `${t(disabled ? 'keyboardEnable' : 'keyboardDisable')} ${t(COMMAND_LABELS[id])}`); actions.append(toggle);
        }
        const reset = this.button(t('keyboardReset'), 'reset-command', () => void this.resetCommand(id));
        reset.setAttribute('aria-label', t('keyboardResetCommand', t(COMMAND_LABELS[id])));
        reset.disabled ||= !Object.prototype.hasOwnProperty.call(this.settings.overrides, id) && !disabled;
        actions.append(reset); summary.append(label, actions); row.append(summary);
        if (this.recording?.id === id) row.append(this.renderRecorder());
        return row;
    }
    private renderResetConfirmation(): void {
        const panel = document.createElement('div'); panel.className = 'keyboard-reset'; panel.dataset.role = 'reset-confirm'; panel.setAttribute('role', 'group'); panel.setAttribute('aria-label', t('keyboardResetAllTitle'));
        const title = document.createElement('strong'); title.textContent = t('keyboardResetAllTitle');
        const actions = document.createElement('div'); actions.className = 'keyboard-recorder-actions';
        actions.append(this.button(t('btnCancel'), 'cancel-reset', () => { this.resetConfirmation = false; this.render(); this.shadow.querySelector<HTMLButtonElement>('[data-action="reset-all"]')?.focus(); }), this.button(t('keyboardRestore'), 'confirm-reset', () => void this.write(normalizeShortcutSettings(undefined), undefined, 'keyboardResetDone'), true));
        panel.append(title, this.caption(t('keyboardResetAllDesc')), actions); this.body.append(panel);
    }
    private validation() {
        const record = this.recording;
        if (!record?.candidate) return { valid: false, message: t('keyboardRecordHint'), conflicts: [] as ShortcutCommandId[] };
        const validation = validateShortcutChord(record.candidate, record.id, this.platform);
        if (!validation.valid) return { valid: false, message: t(validation.reason === 'reserved' ? 'keyboardReserved' : validation.reason === 'modifier-required' ? 'keyboardModifierRequired' : 'keyboardInvalid'), conflicts: [] as ShortcutCommandId[] };
        const conflicts = record.reset ? findShortcutResetConflicts(this.settings, record.id)
            : record.activate ? findShortcutActivationConflicts(this.settings, record.id)
                : findShortcutConflicts(this.settings, record.id, record.candidate, this.platform);
        return { valid: true, message: conflicts.length ? t('keyboardConflict', conflicts.map(id => t(COMMAND_LABELS[id])).join(', ')) : t('keyboardNoConflict'), conflicts };
    }
    private renderRecorder(): HTMLElement {
        const panel = document.createElement('div'); panel.className = 'keyboard-recorder';
        const capture = document.createElement('div'); capture.className = 'keyboard-capture'; capture.tabIndex = 0;
        capture.dataset.role = 'keyboard-capture'; capture.setAttribute('role', 'group'); capture.setAttribute('aria-label', t('keyboardCaptureLabel')); capture.setAttribute('aria-describedby', 'aimd-keyboard-record-message');
        const binding = this.recording!.pending ?? this.recording!.candidate;
        if (binding) capture.append(this.keycaps(binding));
        else if (this.recording!.preview.length) {
            const keys = document.createElement('span'); keys.className = 'keyboard-keys';
            for (const label of this.recording!.preview) { const key = document.createElement('kbd'); key.textContent = label; keys.append(key); }
            capture.append(keys);
        } else capture.textContent = t('keyboardPressKeys');
        const message = this.caption(''); message.className = 'keyboard-recorder-message'; message.id = 'aimd-keyboard-record-message'; message.setAttribute('role', 'status'); message.setAttribute('aria-live', 'polite');
        const validation = this.validation(); message.textContent = validation.message; message.dataset.level = !validation.valid && binding ? 'blocked' : validation.conflicts.length ? 'conflict' : 'ready';
        const actions = document.createElement('div'); actions.className = 'keyboard-recorder-actions';
        const save = this.button(t(validation.conflicts.length ? 'keyboardReplaceSave' : 'keyboardSave'), 'save-record', () => void this.saveRecord(), true);
        save.disabled ||= !validation.valid || !this.recording!.ready;
        actions.append(this.button(t('keyboardClear'), 'clear-record', () => void this.clearBinding()), this.button(t('btnCancel'), 'cancel-record', () => this.dismiss(true)), save);
        panel.append(capture, message, actions); return panel;
    }
    private beginRecord(id: ShortcutCommandId, candidate: ShortcutChord | null = null, reset = false, activate = false): void {
        if (this.readOnly || this.pending) return;
        this.resetConfirmation = false; this.status = '';
        this.recording = { id, candidate, pending: null, ready: Boolean(candidate), reset, activate, held: new Set(), preview: [] };
        this.root.dataset.aimdShortcutRecording = 'true'; this.render();
        this.focusCapture();
    }
    private focusCapture(): void { this.shadow.querySelector<HTMLElement>('[data-role="keyboard-capture"]')?.focus({ preventScroll: true }); }
    private focusBinding(id: ShortcutCommandId): void { this.shadow.querySelector<HTMLButtonElement>(`[data-action="record"][data-id="${id}"]`)?.focus({ preventScroll: true }); }
    private modifierLabels(e: KeyboardEvent): string[] {
        return [e.ctrlKey ? (this.platform === 'mac' ? '⌃' : 'Ctrl') : '', e.metaKey ? '⌘' : '', e.altKey ? (this.platform === 'mac' ? '⌥' : 'Alt') : '', e.shiftKey ? (this.platform === 'mac' ? '⇧' : 'Shift') : ''].filter(Boolean);
    }
    private onKeyDown = (event: Event): void => {
        const e = event as KeyboardEvent;
        if (!this.recording || this.readOnly || this.pending || this.composing || e.isComposing || e.keyCode === 229) return;
        if (e.key === 'Escape' && !e.isComposing && !this.composing) { e.preventDefault(); e.stopPropagation(); this.dismiss(true); return; }
        if (!e.composedPath().some(node => node instanceof HTMLElement && node.dataset.role === 'keyboard-capture')) return;
        if (e.key === 'Tab') { this.dismiss(true); return; }
        e.preventDefault(); e.stopPropagation();
        if (this.pending || this.composing || e.isComposing || e.keyCode === 229 || e.repeat) return;
        this.recording.held.add(e.code || e.key);
        const chord = shortcutChordFromEvent(e, this.platform);
        if (!this.recording.pending) {
            this.recording.candidate = null; this.recording.ready = false; this.recording.reset = false; this.recording.activate = false;
            if (chord) this.recording.pending = chord;
            this.recording.preview = this.modifierLabels(e);
        }
        this.render(); this.focusCapture();
    };
    private onKeyUp = (event: Event): void => {
        const e = event as KeyboardEvent;
        if (!this.recording || this.readOnly || this.pending || this.composing || e.isComposing || e.keyCode === 229) return;
        this.recording.held.delete(e.code || e.key);
        const modifiersReleased = !e.metaKey && !e.ctrlKey && !e.altKey && !e.shiftKey;
        // Focus replacement can retarget releases, and browsers may omit the main keyup under a modifier.
        if (modifiersReleased) this.recording.held.clear();
        if (!this.recording.pending) {
            if (this.recording.ready || this.shadow.activeElement?.getAttribute('data-role') !== 'keyboard-capture') return;
            this.recording.preview = this.modifierLabels(e); this.render(); this.focusCapture(); return;
        }
        if (!modifiersReleased || this.recording.held.size) return;
        this.recording.candidate = this.recording.pending; this.recording.pending = null; this.recording.ready = true; this.recording.preview = [];
        this.render(); this.focusCapture();
    };
    private async saveRecord(): Promise<void> {
        const record = this.recording;
        if (!record?.candidate || !record.ready || !this.validation().valid) return;
        try {
            const next = record.activate
                ? { ...this.settings, disabled: [...new Set([...this.settings.disabled.filter(id => id !== record.id), ...findShortcutActivationConflicts(this.settings, record.id)])] }
                : record.reset ? resetShortcutBinding(this.settings, record.id, { replaceConflicts: true }, this.platform)
                    : withShortcutBinding(this.settings, record.id, record.candidate, { replaceConflicts: true }, this.platform);
            await this.write(next, record.id);
        } catch { this.status = t('settingsSaveFailed'); this.render(); }
    }
    private async clearBinding(): Promise<void> {
        if (!this.recording) return;
        const id = this.recording.id;
        await this.write(withShortcutBinding(this.settings, id, null, {}, this.platform), id);
    }
    private async toggleCommand(id: ShortcutCommandId): Promise<void> {
        const disabled = this.settings.disabled.includes(id);
        const binding = getConfiguredBinding(this.settings, id, this.platform);
        if (disabled && binding && findShortcutActivationConflicts(this.settings, id).length) { this.beginRecord(id, binding, false, true); return; }
        await this.write({ ...this.settings, disabled: disabled ? this.settings.disabled.filter(item => item !== id) : [...this.settings.disabled, id] }, id, disabled ? 'keyboardEnabledCommand' : 'keyboardDisabledCommand');
    }
    private async resetCommand(id: ShortcutCommandId): Promise<void> {
        const binding = getDefaultShortcutBindings(this.platform)[id];
        if (binding && findShortcutResetConflicts(this.settings, id).length) { this.beginRecord(id, binding, true); return; }
        await this.write(resetShortcutBinding(this.settings, id, {}, this.platform), id, 'keyboardResetDone');
    }
    private async write(next: ShortcutSettings, focus?: ShortcutCommandId, message = 'keyboardSaved'): Promise<void> {
        if (this.pending || this.readOnly || this.disposed) return;
        this.pending = true; this.status = ''; this.render();
        try {
            if (!await this.actions.save(next)) throw new Error('SAVE_FAILED');
            if (this.disposed) return;
            this.settings = next; this.recording = null; this.resetConfirmation = false; delete this.root.dataset.aimdShortcutRecording;
            this.status = t(message);
        } catch { if (!this.disposed) this.status = t('settingsSaveFailed'); }
        finally { this.pending = false; if (!this.disposed) { this.render(); if (this.recording) this.focusCapture(); else if (focus) this.focusBinding(focus); } }
    }
    private async writeAutomatic(): Promise<void> {
        if (this.pending || this.readOnly || this.disposed) return;
        const next = !this.automatic; this.pending = true; this.status = ''; this.render();
        try { if (!await this.actions.setAutomatic(next)) throw new Error('SAVE_FAILED'); if (!this.disposed) this.automatic = next; }
        catch { if (!this.disposed) this.status = t('settingsSaveFailed'); }
        finally { this.pending = false; if (!this.disposed) this.render(); }
    }
}
