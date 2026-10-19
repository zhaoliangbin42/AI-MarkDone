import { afterEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_SETTINGS } from '@/core/settings/types';
import { getDefaultShortcutBindings, getShortcutPlatform, formatShortcutChord, type ShortcutChord, type ShortcutSettings } from '@/core/shortcuts';
import { SettingsTabView } from '@/ui/content/bookmarks/ui/tabs/SettingsTabView';

const views: SettingsTabView[] = [];
afterEach(() => { views.splice(0).forEach(view => view.destroy()); document.body.replaceChildren(); });
function mount(save = vi.fn(async (_settings: ShortcutSettings) => true)) {
    const automatic = vi.fn(async () => true);
    const view = new SettingsTabView({ modal: { confirm: vi.fn(async () => true) } as any, actions: { setShortcutSettings: save, setChatGptBehaviorSettings: automatic } });
    views.push(view); document.body.append(view.getElement());
    view.setState({ settings: structuredClone(DEFAULT_SETTINGS), storageUsage: null });
    view.getNavigationElement().querySelector<HTMLButtonElement>('[data-category="controls"]')!.click();
    view.getElement().querySelector<HTMLButtonElement>('[data-controls-tab="keyboard"]')!.click();
    const shadow = view.getElement().querySelector('[data-role="settings-keyboard"]')!.shadowRoot!;
    const click = (action: string, id?: string) => (id ? shadow.querySelector(`[data-command="${id}"]`) : shadow)!.querySelector<HTMLButtonElement>(`[data-action="${action}"]`)!.click();
    return { view, shadow, click, save, automatic };
}
function record(shadow: ShadowRoot, code: string, key = code.replace('Digit', ''), extra: KeyboardEventInit = {}) {
    shadow.querySelector('[data-role="keyboard-capture"]')!.dispatchEvent(new KeyboardEvent('keydown', { code, key, ctrlKey: true, shiftKey: true, bubbles: true, composed: true, cancelable: true, ...extra }));
    shadow.querySelector('[data-role="keyboard-capture"]')!.dispatchEvent(new KeyboardEvent('keyup', { code, key, bubbles: true, composed: true, ...extra, metaKey: false, ctrlKey: false, shiftKey: false, altKey: false }));
}
const platform = getShortcutPlatform(navigator.platform);
const defaults = () => getDefaultShortcutBindings(platform);
function recordBinding(shadow: ShadowRoot, binding: ShortcutChord): void {
    record(shadow, binding.code, binding.code.replace(/^Key|^Digit/, ''), {
        metaKey: platform === 'mac' && binding.primary,
        ctrlKey: platform === 'mac' ? Boolean(binding.control) : binding.primary || Boolean(binding.control),
        shiftKey: binding.shift, altKey: binding.alt,
    });
}
const bound = (shadow: ShadowRoot, id: string) => shadow.querySelector(`[data-command="${id}"] [data-action="record"]`)!.textContent;

describe('Settings keyboard commands through the real controls entry', () => {
    it('records after release, checks conflicts, and replaces atomically while retaining the old combination', async () => {
        const { shadow, click, save } = mount();
        click('record', 'selection.annotate');
        const yellowDefault = defaults()['selection.highlight.yellow']!;
        recordBinding(shadow, yellowDefault);
        expect(shadow.querySelector('.keyboard-recorder-message')?.getAttribute('data-level')).toBe('conflict');
        expect(save).not.toHaveBeenCalled();
        click('save-record');
        await vi.waitFor(() => expect(save).toHaveBeenCalledTimes(1));
        expect(save.mock.calls[0][0].overrides['selection.annotate']).toEqual(yellowDefault);
        expect(save.mock.calls[0][0].disabled).toContain('selection.highlight.yellow');
        expect(save.mock.calls[0][0].overrides['selection.highlight.yellow']).toBeUndefined();
        await vi.waitFor(() => expect(shadow.querySelector('.keyboard-recorder')).toBeNull());
        click('toggle-command', 'selection.highlight.yellow');
        expect(shadow.querySelector('.keyboard-recorder-message')?.getAttribute('data-level')).toBe('conflict');
        expect(save).toHaveBeenCalledTimes(1);
        click('save-record');
        await vi.waitFor(() => expect(save).toHaveBeenCalledTimes(2));
        expect(save.mock.calls[1][0].overrides['selection.highlight.yellow']).toBeUndefined();
        expect(save.mock.calls[1][0].disabled).not.toContain('selection.highlight.yellow');
        expect(save.mock.calls[1][0].disabled).toContain('selection.annotate');
    });

    it('completes recording from window releases after focus changes even when the main keyup is omitted', async () => {
        const { view, shadow, click, save } = mount();
        click('record', 'selection.annotate');
        const press = (code: string, key: string, modifiers: KeyboardEventInit) => shadow.querySelector('[data-role="keyboard-capture"]')!.dispatchEvent(new KeyboardEvent('keydown', { code, key, bubbles: true, composed: true, ...modifiers }));
        press('ControlLeft', 'Control', { ctrlKey: true });
        press('ShiftLeft', 'Shift', { ctrlKey: true, shiftKey: true });
        press('Digit7', '&', { ctrlKey: true, shiftKey: true });
        view.getElement().tabIndex = -1; view.getElement().focus();
        document.dispatchEvent(new KeyboardEvent('keyup', { code: 'ControlLeft', key: 'Control', shiftKey: true, bubbles: true }));
        expect(shadow.querySelector<HTMLButtonElement>('[data-action="save-record"]')!.disabled).toBe(true);
        window.dispatchEvent(new KeyboardEvent('keyup', { code: 'ShiftLeft', key: 'Shift' }));
        expect(shadow.querySelector<HTMLButtonElement>('[data-action="save-record"]')!.disabled).toBe(false);
        document.dispatchEvent(new KeyboardEvent('keydown', { code: 'Digit8', key: '*', ctrlKey: true, shiftKey: true, bubbles: true }));
        expect(shadow.querySelector('[data-role="keyboard-capture"]')?.textContent).toContain('7');
        click('save-record');
        await vi.waitFor(() => expect(save).toHaveBeenCalledTimes(1));
        expect(save.mock.calls[0][0].overrides['selection.annotate']?.code).toBe('Digit7');
    });

    it('clears a preset and restores it, while an empty-default command resets to unassigned', async () => {
        const { shadow, click, save } = mount();
        click('record', 'selection.highlight.blue'); click('clear-record');
        await vi.waitFor(() => expect(save).toHaveBeenCalledTimes(1));
        expect(save.mock.calls[0][0].overrides['selection.highlight.blue']).toBeNull();
        await vi.waitFor(() => expect(shadow.querySelector('.keyboard-recorder')).toBeNull());
        click('reset-command', 'selection.highlight.blue');
        await vi.waitFor(() => expect(save).toHaveBeenCalledTimes(2));
        expect(save.mock.calls[1][0].overrides['selection.highlight.blue']).toBeUndefined();
        await vi.waitFor(() => expect(shadow.querySelector('[data-command="selection.highlight.blue"] [data-action="record"]')?.getAttribute('aria-label')).toContain(formatShortcutChord(defaults()['selection.highlight.blue'], platform)));
        click('record', 'prompts.openLibrary'); record(shadow, 'Digit9'); click('save-record');
        await vi.waitFor(() => expect(save).toHaveBeenCalledTimes(3));
        await vi.waitFor(() => expect(shadow.querySelector('.keyboard-recorder')).toBeNull());
        click('reset-command', 'prompts.openLibrary');
        await vi.waitFor(() => expect(save).toHaveBeenCalledTimes(4));
        expect(save.mock.calls[3][0].overrides['prompts.openLibrary']).toBeUndefined();
        await vi.waitFor(() => expect(bound(shadow, 'prompts.openLibrary')).toBe('keyboardRecord'));
    });

    it('rechecks a preset conflict before resetting a single command', async () => {
        const { view, shadow, click, save } = mount();
        const settings = structuredClone(DEFAULT_SETTINGS);
        settings.shortcuts.overrides = {
            'selection.annotate': { code: 'Digit7', primary: true, shift: true, alt: false },
            'selection.highlight.yellow': defaults()['selection.annotate'],
        };
        view.setState({ settings, storageUsage: null });
        click('reset-command', 'selection.annotate');
        expect(save).not.toHaveBeenCalled();
        expect(shadow.querySelector('.keyboard-recorder-message')?.getAttribute('data-level')).toBe('conflict');
        click('save-record');
        await vi.waitFor(() => expect(save).toHaveBeenCalledTimes(1));
        expect(save.mock.calls[0][0].overrides['selection.annotate']).toBeUndefined();
        expect(save.mock.calls[0][0].disabled).toContain('selection.highlight.yellow');
        expect(save.mock.calls[0][0].overrides['selection.highlight.yellow']).toEqual(defaults()['selection.annotate']);
    });

    it('resets Mac implicit defaults without comparing them as Windows recordings', async () => {
        const platformSpy = vi.spyOn(navigator, 'platform', 'get').mockReturnValue('MacIntel');
        try {
            const { view, shadow, click, save } = mount();
            const settings = structuredClone(DEFAULT_SETTINGS);
            const custom = { code: 'KeyN', primary: true, control: true, shift: true, alt: false };
            settings.shortcuts.overrides = { 'selection.highlight.red': custom };
            settings.shortcuts.disabled = ['selection.annotate'];
            view.setState({ settings, storageUsage: null });
            click('reset-command', 'selection.annotate');
            await vi.waitFor(() => expect(save).toHaveBeenCalledOnce());
            expect(shadow.querySelector('.keyboard-recorder')).toBeNull();
            expect(save.mock.calls[0][0].disabled).not.toContain('selection.annotate');
            expect(save.mock.calls[0][0].overrides['selection.annotate']).toBeUndefined();
            expect(save.mock.calls[0][0].overrides['selection.highlight.red']).toEqual(custom);
        } finally {
            platformSpy.mockRestore();
        }
    });

    it('keeps bindings when disabled and requires confirmation before resetting all defaults', async () => {
        const { shadow, click, save, automatic } = mount();
        click('toggle-command', 'selection.annotate');
        await vi.waitFor(() => expect(save).toHaveBeenCalledTimes(1));
        expect(save.mock.calls[0][0].disabled).toContain('selection.annotate');
        expect(save.mock.calls[0][0].overrides['selection.annotate']).toBeUndefined();
        await vi.waitFor(() => expect(shadow.querySelector('[aria-busy="true"]')).toBeNull());
        click('toggle-all');
        await vi.waitFor(() => expect(save).toHaveBeenCalledTimes(2));
        expect(save.mock.calls[1][0].enabled).toBe(false);
        await vi.waitFor(() => expect(shadow.querySelector('[aria-busy="true"]')).toBeNull());
        click('reset-all'); expect(save).toHaveBeenCalledTimes(2); click('cancel-reset');
        expect(save).toHaveBeenCalledTimes(2); click('reset-all'); click('confirm-reset');
        await vi.waitFor(() => expect(save).toHaveBeenCalledTimes(3));
        expect(save.mock.calls[2][0]).toEqual({ enabled: true, overrides: {}, disabled: [] });
        expect(automatic).not.toHaveBeenCalled();
    });

    it('preserves the old binding and candidate on failure, and prevents repeated saves while pending', async () => {
        let resolve!: (success: boolean) => void;
        const save = vi.fn((_settings: ShortcutSettings) => new Promise<boolean>(done => { resolve = done; }));
        const { shadow, click } = mount(save);
        const old = bound(shadow, 'selection.annotate');
        click('record', 'selection.annotate'); record(shadow, 'Digit7'); click('save-record'); click('save-record');
        expect(save).toHaveBeenCalledTimes(1); resolve(false);
        await vi.waitFor(() => expect(shadow.querySelector('[data-role="keyboard-status"]')?.textContent).toBe('settingsSaveFailed'));
        expect(bound(shadow, 'selection.annotate')).toBe(old);
        expect(shadow.querySelector('[data-role="keyboard-capture"]')?.textContent).toContain('7');
        expect(shadow.querySelector<HTMLButtonElement>('[data-action="save-record"]')?.disabled).toBe(false);
    });

    it('ignores IME composition, permits Tab, and clears recording on Escape, blur, and category changes', () => {
        const { shadow, click, save, view } = mount();
        click('record', 'selection.annotate');
        let capture = shadow.querySelector('[data-role="keyboard-capture"]')!;
        capture.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true }));
        record(shadow, 'Digit7');
        expect(shadow.querySelector<HTMLButtonElement>('[data-action="save-record"]')!.disabled).toBe(true);
        capture.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true }));
        capture = shadow.querySelector('[data-role="keyboard-capture"]')!;
        const tab = new KeyboardEvent('keydown', { key: 'Tab', code: 'Tab', bubbles: true, cancelable: true });
        capture.dispatchEvent(tab); expect(tab.defaultPrevented).toBe(false);
        expect(shadow.querySelector('.keyboard-recorder')).toBeNull();
        click('record', 'selection.annotate');
        shadow.querySelector('[data-role="keyboard-capture"]')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', bubbles: true }));
        expect(shadow.querySelector('.keyboard-recorder')).toBeNull();
        click('record', 'selection.annotate'); window.dispatchEvent(new Event('blur')); expect(shadow.querySelector('.keyboard-recorder')).toBeNull();
        click('record', 'selection.annotate'); view.getNavigationElement().querySelector<HTMLButtonElement>('[data-category="input"]')!.click();
        expect(shadow.querySelector('.keyboard-recorder')).toBeNull(); expect(save).not.toHaveBeenCalled();
    });

    it('synchronizes the independent automatic suggestion toggle with the input settings row', async () => {
        const { shadow, click, automatic, view } = mount();
        click('toggle-auto'); await vi.waitFor(() => expect(automatic).toHaveBeenCalledWith({ promptAutocomplete: false }));
        await vi.waitFor(() => expect(shadow.querySelector('[data-action="toggle-auto"]')?.getAttribute('aria-checked')).toBe('false'));
        expect(view.getElement().querySelector<HTMLInputElement>('[data-role="settings-chatgpt-prompt-autocomplete"]')!.checked).toBe(false);
    });

    it('shows imported Mac Option bindings as unavailable on Windows while keeping edit and reset available', () => {
        const { view, shadow, click } = mount();
        const settings = structuredClone(DEFAULT_SETTINGS);
        settings.shortcuts.overrides['selection.annotate'] = { code: 'KeyE', primary: true, shift: false, alt: true };
        view.setState({ settings, storageUsage: null });
        const row = shadow.querySelector('[data-command="selection.annotate"]')!;
        expect(row.querySelector('[data-role="keyboard-platform-unavailable"]')?.textContent).toBe('keyboardPlatformUnavailable');
        expect(row.querySelector<HTMLButtonElement>('[data-action="record"]')!.disabled).toBe(false);
        expect(row.querySelector<HTMLButtonElement>('[data-action="reset-command"]')!.disabled).toBe(false);
        click('record', 'selection.annotate');
        expect(shadow.querySelector('[data-role="keyboard-capture"]')).toBeTruthy();
        click('cancel-record');
        settings.shortcuts.enabled = false;
        view.setState({ settings, storageUsage: null });
        expect(shadow.querySelector('[data-role="keyboard-platform-unavailable"]')).toBeNull();
    });

    it('searches commands through the global settings search and pauses capture when disconnected', () => {
        const { view, shadow, click, save } = mount();
        const search = view.getElement().querySelector<HTMLInputElement>('[data-role="settings-search"]')!;
        search.value = 'keyboardCommandHighlightBlue'; search.dispatchEvent(new Event('input'));
        expect(shadow.querySelectorAll('[data-command]')).toHaveLength(1);
        view.setState({ settings: structuredClone(DEFAULT_SETTINGS), storageUsage: null, dataState: { kind: 'loading' } });
        expect(shadow.querySelector<HTMLButtonElement>('[data-action="record"]')!.disabled).toBe(true);
        click('record', 'selection.highlight.blue'); expect(save).not.toHaveBeenCalled();
    });
});
