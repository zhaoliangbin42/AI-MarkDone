import { afterEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { DEFAULT_SETTINGS } from '@/core/settings/types';
import { SettingsTabView } from '@/ui/content/bookmarks/ui/tabs/SettingsTabView';
import { InputEnhancementPopover } from '@/ui/content/components/InputEnhancementPopover';
import { setLocale } from '@/ui/content/components/i18n';

let settingsView: SettingsTabView | null = null;
let popup: InputEnhancementPopover | null = null;
afterEach(async () => {
    settingsView?.destroy(); settingsView = null;
    popup?.dispose(); popup = null;
    document.body.replaceChildren();
    await setLocale('en');
    vi.unstubAllGlobals();
});
function catalog(locale: 'en' | 'zh_CN') {
    return JSON.parse(fs.readFileSync(path.resolve(process.cwd(), `public/_locales/${locale}/messages.json`), 'utf8'));
}
function pointerClick(target: HTMLElement): void {
    target.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, composed: true, button: 0 }));
    expect(target.isConnected).toBe(true);
    target.dispatchEvent(new MouseEvent('pointerup', { bubbles: true, composed: true, button: 0 }));
    target.click();
}
function expectDescribedHint(root: ParentNode, inputSelector: string, expected: string) {
    const input = root.querySelector<HTMLInputElement>(inputSelector)!;
    const hint = root.querySelector<HTMLElement>('[data-role="enter-native-hint"]')!;
    expect(input.getAttribute('aria-describedby')?.split(/\s+/)).toContain(hint.id);
    expect(root.querySelector(`#${hint.id}`)).toBe(hint);
    expect(hint.textContent).toBe(expected);
    expect(hint.hidden).toBe(false);
    expect(hint.closest('[hidden]')).toBeNull();
    return { input, hint };
}

describe('Native Enter-to-newline guidance at real entry points', () => {
    it.each(['en', 'zh_CN'] as const)('keeps matching %s guidance associated and visible after disabling Enter and enhancement', async locale => {
        vi.stubGlobal('fetch', vi.fn(async (url: unknown) => ({ ok: true, json: async () => catalog(String(url).includes('/zh_CN/') ? 'zh_CN' : 'en') })));
        await setLocale(locale);
        const expected = catalog(locale).chatgptInputEnhancementEnterNativeHint.message;
        const saveSettings = vi.fn(async () => true);
        settingsView = new SettingsTabView({ modal: { confirm: vi.fn(async () => true) } as any, actions: { setChatGptBehaviorSettings: saveSettings } });
        const settings = structuredClone(DEFAULT_SETTINGS);
        settings.chatgptBehavior.inputEnhancement = { ...settings.chatgptBehavior.inputEnhancement, available: true, enabled: true, enterKeyNewline: true };
        settingsView.setState({ settings, storageUsage: null });
        document.body.append(settingsView.getElement(), settingsView.getNavigationElement());
        pointerClick(settingsView.getNavigationElement().querySelector<HTMLElement>('[data-category="input"]')!);
        const settingsRoot = settingsView.getElement();
        const settingsEntry = expectDescribedHint(settingsRoot, '[data-role="settings-input-enterKeyNewline"]', expected);
        pointerClick(settingsEntry.input);
        await vi.waitFor(() => expect(saveSettings).toHaveBeenLastCalledWith({ inputEnhancement: expect.objectContaining({ enterKeyNewline: false }) }));
        expectDescribedHint(settingsRoot, '[data-role="settings-input-enterKeyNewline"]', expected);
        pointerClick(settingsRoot.querySelector<HTMLElement>('[data-role="settings-chatgpt-input-enhancement"]')!);
        await vi.waitFor(() => expect(saveSettings).toHaveBeenLastCalledWith({ inputEnhancement: expect.objectContaining({ available: false }) }));
        expectDescribedHint(settingsRoot, '[data-role="settings-input-enterKeyNewline"]', expected);

        const savePopover = vi.fn(async () => true);
        popup = new InputEnhancementPopover(savePopover);
        popup.updateSettings({ ...settings.chatgptBehavior.inputEnhancement, available: true, enabled: true, enterKeyNewline: true });
        const trigger = document.createElement('button'); document.body.append(trigger);
        trigger.addEventListener('click', () => popup!.toggle(trigger));
        pointerClick(trigger);
        expect(popup.host.hidden).toBe(false);
        const popoverRoot = popup.host.shadowRoot!;
        const popoverEntry = expectDescribedHint(popoverRoot, '[data-role="chatgptInputEnhancementEnterLabel"]', expected);
        pointerClick(popoverEntry.input);
        await vi.waitFor(() => expect(savePopover).toHaveBeenLastCalledWith(expect.objectContaining({ enterKeyNewline: false })));
        await vi.waitFor(() => expect(popoverRoot.querySelector<HTMLInputElement>('[data-role="chatgptInputEnhancementEnterLabel"]')!.disabled).toBe(false));
        expectDescribedHint(popoverRoot, '[data-role="chatgptInputEnhancementEnterLabel"]', expected);
        pointerClick(popoverRoot.querySelector<HTMLElement>('[data-role="chatgptInputEnhancementMasterLabel"]')!);
        await vi.waitFor(() => expect(savePopover).toHaveBeenLastCalledWith(expect.objectContaining({ enabled: false })));
        const disabledEntry = expectDescribedHint(popoverRoot, '[data-role="chatgptInputEnhancementEnterLabel"]', expected);
        expect(disabledEntry.input.disabled).toBe(true);
        expect(disabledEntry.hint.textContent).toBe(settingsEntry.hint.textContent);
    });
});
