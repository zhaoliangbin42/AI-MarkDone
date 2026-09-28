import { describe, expect, it, vi } from 'vitest';
import { SettingsTabView } from '@/ui/content/bookmarks/ui/tabs/SettingsTabView';
import { DEFAULT_SETTINGS } from '@/core/settings/types';
import { normalizeAppearanceSettings } from '@/core/settings/migrations';
import { resolveAppearanceTheme } from '@/style/appearance';

function fixture(settings = structuredClone(DEFAULT_SETTINGS)) {
    const actions = { setChatGptBehaviorSettings: vi.fn(async () => true), setFormulaSettings: vi.fn(async () => true), setReaderSettings: vi.fn(async () => true), setAppearanceSettings: vi.fn(async () => true), setBookmarksSettings: vi.fn(async () => true) };
    const modal = { confirm: vi.fn(), showCustom: vi.fn(async (_options: any) => undefined) };
    const view = new SettingsTabView({ modal: modal as any, actions });
    view.setState({ settings, storageUsage: null });
    const root = view.getElement();
    const search = root.querySelector<HTMLInputElement>('[data-role="settings-search"]')!;
    return { view, root, actions, modal, search, find: (value: string) => { search.value = value; search.dispatchEvent(new Event('input')); } };
}

describe('Settings catalog', () => {
    it('configures pinned actions through Settings, saves once, and retains the draft after a failed write', async () => {
        const f = fixture();
        const trigger = f.root.querySelector<HTMLButtonElement>('[data-role="settings-pinned-page-controls"]')!;
        trigger.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true })); trigger.click();
        const options = f.modal.showCustom.mock.calls[0]![0];
        document.body.append(options.body);
        const input = options.body.querySelector('[data-pin-action="open-input-enhancement"]') as HTMLInputElement;
        input.click();
        expect(f.actions.setChatGptBehaviorSettings).not.toHaveBeenCalled();
        const footer = document.createElement('div'); const close = vi.fn(); options.footer(footer, close);
        f.actions.setChatGptBehaviorSettings.mockResolvedValueOnce(false).mockResolvedValueOnce(true);
        const save = footer.querySelector<HTMLButtonElement>('.mock-modal__button--primary')!;
        save.click();
        await vi.waitFor(() => expect(options.body.querySelector('[role="status"]').textContent).toBeTruthy());
        expect(close).not.toHaveBeenCalled(); expect(input.checked).toBe(true);
        save.click();
        await vi.waitFor(() => expect(close).toHaveBeenCalledOnce());
        expect(f.actions.setChatGptBehaviorSettings).toHaveBeenLastCalledWith({ pinnedPageControls: ['open-input-enhancement'] });
        options.body.remove();
        f.view.destroy();
    });
    it('separates formula buttons from output parameters and writes the three shared selection controls', () => {
        const f = fixture();
        const actions = f.root.querySelector('[data-role="settings-formula-asset-action-copy-svg"]')!;
        const size = f.root.querySelector('[data-role="settings-formula-asset-font-size"]')!;
        expect(actions.closest('.settings-subgroup')).not.toBe(size.closest('.settings-subgroup'));
        for (const field of ['copy', 'annotation', 'highlight']) {
            const toggle = f.root.querySelector<HTMLInputElement>(`[data-role="settings-selection-${field}"]`)!;
            expect(toggle.checked).toBe(true);
            toggle.checked = false; toggle.dispatchEvent(new Event('change'));
        }
        expect(f.actions.setReaderSettings).toHaveBeenLastCalledWith({ selectionToolbar: { copy: false, annotation: false, highlight: false } });
        f.view.destroy();
    });
    it('exposes eight categories and preserves controls across navigation and search', () => {
        const f = fixture(); const nav = f.view.getNavigationElement();
        expect(nav.querySelectorAll('button')).toHaveLength(8);
        const toggle = f.root.querySelector('[data-role="settings-show-word-count"]')!;
        nav.querySelector<HTMLButtonElement>('[data-category="controls"]')!.click();
        expect(toggle.closest('[hidden]')).toBeNull();
        f.find('wordCountLabel'); expect(toggle.closest('[hidden]')).toBeNull();
        expect(f.root.querySelector('[data-role="settings-show-word-count"]')).toBe(toggle);
        f.find('does not exist'); expect(f.root.querySelector<HTMLElement>('.library-empty')!.hidden).toBe(false);
        f.view.destroy();
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
    it('makes formula asset settings directly searchable and editable', () => {
        const f = fixture(); f.find('settingsFormulaButtonCopySvg');
        const toggle = f.root.querySelector<HTMLInputElement>('[data-role="settings-formula-asset-action-copy-svg"]')!;
        expect(toggle.closest('[hidden]')).toBeNull(); toggle.checked = true; toggle.dispatchEvent(new Event('change'));
        expect(f.actions.setFormulaSettings).toHaveBeenCalledWith({ assetActions: { ...DEFAULT_SETTINGS.formula.assetActions, copySvg: true } });
        f.view.destroy();
    });
    it('finds a formula PNG control when the query combines a group name with its format', () => {
        const f = fixture(); f.find('formula png');
        expect(f.root.querySelector('[data-role="settings-formula-asset-action-copy-png"]')?.closest('[hidden]')).toBeNull();
        expect(f.root.querySelector('[data-role="settings-formula-asset-action-copy-svg"]')?.closest('[hidden]')).not.toBeNull();
        f.view.destroy();
    });
    it('keeps Reader sizing, output ordering and notice reset accessible', () => {
        const f = fixture();
        for (const role of ['settings-reader-bodyFontSizePx', 'settings-reader-contentMaxWidthPx', 'settings-comment-sort', 'settings-reset-reader-notice', 'settings-bookmark-sort']) expect(f.root.querySelector(`[data-role="${role}"]`)).toBeTruthy();
        const input = f.root.querySelector<HTMLInputElement>('[data-role="settings-reader-bodyFontSizePx"]')!;
        input.value = '18'; input.dispatchEvent(new Event('change'));
        expect(f.actions.setReaderSettings).toHaveBeenCalledWith({ bodyFontSizePx: 18 });
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
