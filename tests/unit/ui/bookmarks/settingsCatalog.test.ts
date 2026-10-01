import { describe, expect, it, vi } from 'vitest';
import { SettingsTabView } from '@/ui/content/bookmarks/ui/tabs/SettingsTabView';
import { DEFAULT_SETTINGS } from '@/core/settings/types';
import { normalizeAppearanceSettings } from '@/core/settings/migrations';
import { resolveAppearanceTheme } from '@/style/appearance';

function fixture(settings = structuredClone(DEFAULT_SETTINGS)) {
    const actions = { setChatGptBehaviorSettings: vi.fn(async () => true), setFormulaSettings: vi.fn(async () => true), setReaderSettings: vi.fn(async () => true), setContentSettings: vi.fn(async () => true), setAppearanceSettings: vi.fn(async () => true), setBookmarksSettings: vi.fn(async () => true) };
    const modal = { confirm: vi.fn(), showCustom: vi.fn(async (_options: any) => undefined) };
    const view = new SettingsTabView({ modal: modal as any, actions });
    view.setState({ settings, storageUsage: null });
    const root = view.getElement();
    const search = root.querySelector<HTMLInputElement>('[data-role="settings-search"]')!;
    return { view, root, actions, modal, search, find: (value: string) => { search.value = value; search.dispatchEvent(new Event('input')); } };
}

describe('Settings catalog', () => {
    it('configures page pins in the Buttons tab, waits for acknowledgement and preserves preferences after a failed write', async () => {
        const f = fixture(); const shadow = f.root.querySelector('[data-role="settings-buttons"]')!.shadowRoot!;
        f.view.getNavigationElement().querySelector<HTMLButtonElement>('[data-category="controls"]')!.click();
        f.actions.setChatGptBehaviorSettings.mockResolvedValueOnce(false).mockResolvedValueOnce(true);
        shadow.querySelector<HTMLButtonElement>('[data-pin="open-input-enhancement"]')!.click();
        await vi.waitFor(() => expect(shadow.querySelector('[role="status"]')?.textContent).toBeTruthy());
        expect(shadow.querySelector('[data-pin="open-input-enhancement"]')!.getAttribute('aria-pressed')).toBe('false');
        shadow.querySelector<HTMLButtonElement>('[data-pin="open-input-enhancement"]')!.click();
        await vi.waitFor(() => expect(shadow.querySelector('[data-pin="open-input-enhancement"]')!.getAttribute('aria-pressed')).toBe('true'));
        expect(f.actions.setChatGptBehaviorSettings).toHaveBeenLastCalledWith({pinnedPageControls:['open-input-enhancement']}); f.view.destroy();
    });
    it('keeps output parameters outside Buttons and writes shared selection controls independently', async () => {
        const f = fixture(); const shadow = f.root.querySelector('[data-role="settings-buttons"]')!.shadowRoot!;
        shadow.querySelector<HTMLButtonElement>('[data-group="Selection"]')!.click();
        expect(f.root.querySelector('[data-role="settings-formula-asset-font-size"]')!.closest('[data-category="export"]')).toBeTruthy();
        for (const field of ['copy','annotation','highlight']) { shadow.querySelector<HTMLButtonElement>(`[data-path="reader.selectionToolbar.${field}"] [role="switch"]`)!.click(); await vi.waitFor(()=>expect(shadow.querySelector(`[data-path="reader.selectionToolbar.${field}"] [role="switch"]`)!.getAttribute('aria-checked')).toBe('false')); }
        expect(f.actions.setReaderSettings).toHaveBeenLastCalledWith({selectionToolbar:{highlight:false}}); f.view.destroy();
    });
    it('exposes eight categories and preserves the Buttons host across navigation and search', () => {
        const f = fixture();const nav=f.view.getNavigationElement();expect(nav.querySelectorAll('button')).toHaveLength(8);
        const host=f.root.querySelector('[data-role="settings-buttons"]')!;nav.querySelector<HTMLButtonElement>('[data-category="controls"]')!.click();expect(host.closest('[hidden]')).toBeNull();
        f.find('wordCountLabel');expect(host.closest('[hidden]')).toBeNull();expect(f.root.querySelector('[data-role="settings-buttons"]')).toBe(host);
        f.find('does not exist');expect(f.root.querySelector<HTMLElement>('.library-empty')!.hidden).toBe(false);f.view.destroy();
    });
    it('reads the effective enhancement switch without rewriting disabled legacy preferences', () => {
        const settings = structuredClone(DEFAULT_SETTINGS);
        settings.chatgptBehavior.inputEnhancement.enabled = false;
        settings.chatgptBehavior.inputEnhancement.boldShortcut = false;
        const f = fixture(settings); f.find('inputEnhancement');
        const toggle = f.root.querySelector<HTMLInputElement>('[data-role="settings-chatgpt-input-enhancement"]')!;
        expect(toggle.checked).toBe(false); expect(f.actions.setChatGptBehaviorSettings).not.toHaveBeenCalled();
        toggle.checked = true; toggle.dispatchEvent(new Event('change'));
        expect(f.actions.setChatGptBehaviorSettings).toHaveBeenCalledWith({ inputEnhancement: expect.objectContaining({ available: true, enabled: true, boldShortcut: false }) });
        f.view.destroy();
    });
    it('preserves list siblings and the master state when editing a child', () => {
        const f = fixture(); f.find('OrderedList');
        const toggle = f.root.querySelector<HTMLInputElement>('[data-role="settings-input-lists-ordered"]')!;
        toggle.checked = false; toggle.dispatchEvent(new Event('change'));
        expect(f.actions.setChatGptBehaviorSettings).toHaveBeenCalledWith({ inputEnhancement: expect.objectContaining({ enabled: true, lists: { enabled: true, ordered: false, unordered: true } }) });
        f.view.destroy();
    });
    it('makes formula buttons searchable and writes the selected field', async () => {
        const f=fixture();f.find('settingsFormulaButtonCopySvg');const host=f.root.querySelector('[data-role="settings-buttons"]')!;expect(host.closest('[hidden]')).toBeNull();
        const shadow=host.shadowRoot!;shadow.querySelector<HTMLButtonElement>('[data-path="formula.assetActions.copySvg"] [role="switch"]')!.click();expect(f.actions.setFormulaSettings).toHaveBeenCalledWith({assetActions:{copySvg:true}});f.view.destroy();
    });
    it('finds formula PNG controls when searching by group and format', () => {
        const f=fixture();f.find('formula png');const shadow=f.root.querySelector('[data-role="settings-buttons"]')!.shadowRoot!;
        expect((shadow.querySelector('[data-path="formula.assetActions.copyPng"]') as HTMLElement).hidden).toBe(false);
        expect((shadow.querySelector('[data-path="formula.assetActions.copySvg"]') as HTMLElement).hidden).toBe(true);f.view.destroy();
    });
    it('keeps shared content rules in Settings and moves Reader-only controls into Reader', () => {
        const f = fixture();
        for (const role of ['settings-reader-bodyFontSizePx', 'settings-reader-contentMaxWidthPx', 'settings-comment-sort', 'settings-reset-reader-notice']) expect(f.root.querySelector(`[data-role="${role}"]`)).toBeNull();
        expect(f.root.querySelector('[data-role="settings-bookmark-sort"]')).toBeTruthy();
        const button = f.root.querySelector<HTMLButtonElement>('[data-role="settings-content-cleanup"]')!;
        expect(button.closest('[data-category="reading"]')).toBeTruthy();
        button.click();
        expect(f.modal.showCustom).toHaveBeenCalledWith(expect.objectContaining({ title: 'settingsContentCleanupTitle' }));
        f.view.destroy();
    });
    it('normalizes an absent theme preference to following the page', () => {
        expect(normalizeAppearanceSettings({ fontSizePx: 18 }).themeMode).toBe('auto');
        expect(resolveAppearanceTheme('dark', undefined)).toBe('dark');
        expect(resolveAppearanceTheme('dark', 'light')).toBe('light');
        expect(resolveAppearanceTheme('light', 'dark')).toBe('dark');
        expect(resolveAppearanceTheme('dark', 'auto')).toBe('dark');
        expect(normalizeAppearanceSettings({ themeMode: 'unsupported' }).themeMode).toBe('auto');
    });
});

it('finds Pin preferences through the Settings search and exposes their row controls',()=>{
    const f=fixture();f.find('settingsPin');const host=f.root.querySelector('[data-role="settings-buttons"]')!;expect(host.closest('[hidden]')).toBeNull();expect((host.shadowRoot!.querySelector('[data-path="chatgptBehavior.showPromptControl"]') as HTMLElement).hidden).toBe(false);f.view.destroy();
});
