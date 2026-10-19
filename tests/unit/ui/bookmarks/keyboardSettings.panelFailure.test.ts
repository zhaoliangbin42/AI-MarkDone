import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/drivers/shared/clients/settingsClientRpc', () => ({ settingsClientRpc: { getAll: vi.fn(), setCategory: vi.fn() } }));
vi.mock('@/drivers/shared/clients/bookmarksClient', () => ({ bookmarksClient: { getChangelogNotice: vi.fn(async () => ({ ok: true, data: { pendingVersion: null, lastShownVersion: null, reason: null, previousVersion: null } })) } }));

import { version } from '../../../../package.json';
import { DEFAULT_SETTINGS } from '@/core/settings/types';
import { settingsClientRpc } from '@/drivers/shared/clients/settingsClientRpc';
import { createAppearanceSnapshot } from '@/style/appearance';
import { BookmarksPanel } from '@/ui/content/bookmarks/BookmarksPanel';

let panel: BookmarksPanel | null = null;
afterEach(async () => {
    panel?.hide();
    await vi.waitFor(() => expect(document.getElementById('aimd-bookmarks-panel-host')).toBeNull());
    panel = null; document.body.replaceChildren(); vi.clearAllMocks();
});

function controller() {
    const snapshot = { vm: { query: '', platform: 'All', bookmarks: [], folderTree: [], selectedFolderPath: null, sortMode: 'time-desc' }, folders: [], folderPaths: [], selectedKeys: new Set(), previewId: null, status: 'Ready' };
    return {
        subscribe: vi.fn(listener => { listener(snapshot); return () => {}; }),
        refreshAll: vi.fn(async () => undefined), refreshPositionsForUrl: vi.fn(async () => undefined), refreshUiState: vi.fn(async () => undefined),
        getTheme: () => 'light', getAppearance: () => createAppearanceSnapshot('light'), getPlatforms: () => ['All', 'ChatGPT'],
        getFolderCheckboxState: () => ({ checked: false, indeterminate: false }),
        setQuery: vi.fn(), clearSelection: vi.fn(), setPlatform: vi.fn(), setSortMode: vi.fn(), toggleFolderExpanded: vi.fn(), toggleFolderSelection: vi.fn(), toggleBookmarkSelection: vi.fn(), selectFolder: vi.fn(), getBookmarkRowSubtitle: () => '', exportAll: vi.fn(async () => ({ ok: true, data: { payload: {} } })), setPanelStatus: vi.fn(),
    } as any;
}

function pointerClick(button: HTMLElement): void {
    button.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, composed: true, button: 0 }));
    expect(button.isConnected).toBe(true);
    button.dispatchEvent(new MouseEvent('pointerup', { bubbles: true, composed: true, button: 0 }));
    button.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true, button: 0 }));
}

describe('Keyboard settings background failure recovery', () => {
    it('keeps owned keyboard controls mounted through pointerdown, pointerup and click', async () => {
        vi.mocked(settingsClientRpc.getAll).mockResolvedValue({ ok: true, data: { settings: structuredClone(DEFAULT_SETTINGS), capabilities: { appVersion: version, settingsVersion: DEFAULT_SETTINGS.version, settingsFileFormatVersion: 1, buttonsPreferences: true } } } as any);
        vi.mocked(settingsClientRpc.setCategory).mockResolvedValue({ ok: true, data: { category: 'shortcuts' } } as any);
        panel = new BookmarksPanel(controller(), { show: vi.fn(), hide: vi.fn() } as any);
        await panel.show({ tab: 'settings' });
        const shadow = document.getElementById('aimd-bookmarks-panel-host')!.shadowRoot!;
        pointerClick(shadow.querySelector<HTMLElement>('[data-category="controls"]')!);
        pointerClick(shadow.querySelector<HTMLElement>('[data-controls-tab="keyboard"]')!);
        const keyboardHost = shadow.querySelector<HTMLElement>('[data-role="settings-keyboard"]')!;
        const keyboard = keyboardHost.shadowRoot!;
        expect(keyboardHost.hasAttribute('data-aimd-transient-root')).toBe(false);
        pointerClick(keyboard.querySelector<HTMLElement>('[data-command="selection.annotate"] [data-action="record"]')!);
        expect(keyboard.querySelector('[data-role="keyboard-capture"]')).toBeTruthy();
        pointerClick(keyboard.querySelector<HTMLElement>('[data-action="cancel-record"]')!);
        expect(keyboard.querySelector('[data-role="keyboard-capture"]')).toBeNull();
        pointerClick(keyboard.querySelector<HTMLElement>('[data-action="toggle-auto"]')!);
        await vi.waitFor(() => expect(settingsClientRpc.setCategory).toHaveBeenCalledWith('chatgptBehavior', { promptAutocomplete: false }));
        await vi.waitFor(() => expect(keyboard.querySelector('[data-action="toggle-auto"]')?.getAttribute('aria-checked')).toBe('false'));
    });

    it('preserves a recorded candidate through a real Panel RPC failure, retry, and acknowledged save', async () => {
        vi.mocked(settingsClientRpc.getAll).mockResolvedValue({ ok: true, data: { settings: structuredClone(DEFAULT_SETTINGS), capabilities: { appVersion: version, settingsVersion: DEFAULT_SETTINGS.version, settingsFileFormatVersion: 1, buttonsPreferences: true } } } as any);
        vi.mocked(settingsClientRpc.setCategory).mockResolvedValueOnce({ ok: false, errorCode: 'RECEIVER_UNAVAILABLE', message: 'Disconnected', failure: { kind: 'transport', code: 'RECEIVER_UNAVAILABLE', message: 'Disconnected', delivery: 'not-sent' } } as any).mockResolvedValue({ ok: true, data: { category: 'shortcuts' } } as any);
        panel = new BookmarksPanel(controller(), { show: vi.fn(), hide: vi.fn() } as any);
        await panel.show({ tab: 'settings' });
        const shadow = document.getElementById('aimd-bookmarks-panel-host')!.shadowRoot!;
        pointerClick(shadow.querySelector<HTMLElement>('[data-category="controls"]')!);
        pointerClick(shadow.querySelector<HTMLElement>('[data-controls-tab="keyboard"]')!);
        const keyboardHost = shadow.querySelector<HTMLElement>('[data-role="settings-keyboard"]')!;
        const keyboard = keyboardHost.shadowRoot!;
        const bindingSelector = '[data-command="selection.annotate"] [data-action="record"]';
        const original = keyboard.querySelector(bindingSelector)!.textContent;
        pointerClick(keyboard.querySelector<HTMLElement>(bindingSelector)!);
        keyboard.querySelector('[data-role="keyboard-capture"]')!.dispatchEvent(new KeyboardEvent('keydown', { code: 'Digit7', key: '&', ctrlKey: true, shiftKey: true, bubbles: true, composed: true }));
        keyboard.querySelector('[data-role="keyboard-capture"]')!.dispatchEvent(new KeyboardEvent('keyup', { code: 'Digit7', key: '&', bubbles: true, composed: true }));
        pointerClick(keyboard.querySelector<HTMLElement>('[data-action="save-record"]')!);
        await vi.waitFor(() => expect(shadow.querySelector('[data-role="settings-runtime-error"]')?.getAttribute('data-state')).toBe('error'));
        expect(keyboard.querySelector('[data-role="keyboard-capture"]')?.textContent).toContain('7');
        expect(keyboard.querySelector(bindingSelector)?.textContent).toBe(original);
        expect(keyboard.querySelector<HTMLButtonElement>('[data-action="save-record"]')!.disabled).toBe(true);
        expect(keyboardHost.dataset.aimdShortcutRecording).toBeUndefined();
        keyboard.querySelector('[data-role="keyboard-capture"]')!.dispatchEvent(new KeyboardEvent('keydown', { code: 'Digit8', key: '*', ctrlKey: true, shiftKey: true, bubbles: true, composed: true }));
        expect(keyboard.querySelector('[data-role="keyboard-capture"]')?.textContent).toContain('7');
        pointerClick(shadow.querySelector<HTMLElement>('[data-action="settings-runtime-retry"]')!);
        await vi.waitFor(() => expect(shadow.querySelector<HTMLElement>('[data-role="settings-runtime-error"]')!.hidden).toBe(true));
        expect(keyboard.querySelector('[data-role="keyboard-capture"]')?.textContent).toContain('7');
        const save = keyboard.querySelector<HTMLButtonElement>('[data-action="save-record"]')!;
        expect(save.disabled).toBe(false);
        expect(keyboard.activeElement?.getAttribute('data-role')).toBe('keyboard-capture');
        pointerClick(save); save.click();
        await vi.waitFor(() => expect(keyboard.querySelector('.keyboard-recorder')).toBeNull());
        expect(settingsClientRpc.setCategory).toHaveBeenCalledTimes(2);
        expect(settingsClientRpc.setCategory).toHaveBeenLastCalledWith('shortcuts', expect.objectContaining({ overrides: { 'selection.annotate': expect.objectContaining({ code: 'Digit7' }) } }));
        expect(keyboard.querySelector(bindingSelector)?.textContent).toContain('7');
    });
});
