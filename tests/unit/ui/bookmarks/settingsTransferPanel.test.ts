import { afterEach, describe, expect, it, vi } from 'vitest';
import { SettingsTransferPanel } from '@/ui/content/bookmarks/ui/tabs/SettingsTransferPanel';
import { DEFAULT_SETTINGS } from '@/core/settings/types';
import { createSettingsFile, MAX_SETTINGS_FILE_BYTES } from '@/core/settings/portableSettings';
import type { SettingsImportPreview } from '@/contracts/settingsTransfer';
const panels: SettingsTransferPanel[] = [];
function fixture() {
    const file = createSettingsFile(DEFAULT_SETTINGS, '6.0.0');
    const preview: SettingsImportPreview = { file, changes: [{ path: 'language', before: 'auto', after: 'en' }, { path: 'behavior.showWordCount', before: true, after: false }], ignoredCount: 1, fingerprint: 'a'.repeat(64) };
    const actions = { exportSettings: vi.fn(async () => file), previewImport: vi.fn(async () => preview), applyImport: vi.fn(async () => true), getRecovery: vi.fn(async () => file), onApplied: vi.fn(async () => undefined) };
    const panel = new SettingsTransferPanel(actions);
    panels.push(panel);
    document.body.append(panel.root);
    const shadow = panel.root.shadowRoot!;
    const click = (action: string) => shadow.querySelector<HTMLButtonElement>(`[data-action="${action}"]`)!.click();
    const select = (text: string, size = text.length) => {
        const input = shadow.querySelector<HTMLInputElement>('input[type="file"]')!;
        Object.defineProperty(input, 'files', { configurable: true, value: [{ size, text: async () => text }] });
        input.dispatchEvent(new Event('change'));
    };
    return { panel, shadow, actions, click, select, preview };
}
afterEach(() => {
    panels.splice(0).forEach(panel => {
        panel.dispose();
        panel.root.remove();
    });
    vi.restoreAllMocks();
});
describe('Settings transfer confirmation flow', () => {
    it('shows the includes/excludes notice before exporting and cancel performs no export', () => {
        const f = fixture();
        f.click('settingsExport');
        expect(f.actions.exportSettings).not.toHaveBeenCalled();
        expect(f.shadow.querySelector('[data-action="settingsExportConfirm"]')).toBeTruthy();
        f.click('btnCancel');
        expect(f.actions.exportSettings).not.toHaveBeenCalled();
        expect(f.shadow.querySelector('[data-action="settingsExportConfirm"]')).toBeNull();
    });
    it('loads and previews a file without writing, then applies only selected categories', async () => {
        const f = fixture();
        f.select('{"test":"file"}');
        await vi.waitFor(() => expect(f.shadow.querySelector('[data-action="settingsImportConfirm"]')).toBeTruthy());
        expect(f.actions.applyImport).not.toHaveBeenCalled();
        expect(f.shadow.textContent).not.toContain('behavior.showWordCount');
        const category = f.shadow.querySelector<HTMLInputElement>('[data-category="behavior"]')!;
        category.click();
        f.click('settingsImportConfirm');
        await vi.waitFor(() => expect(f.actions.onApplied).toHaveBeenCalledOnce());
        expect(f.actions.applyImport).toHaveBeenCalledWith('{"test":"file"}', f.preview.fingerprint, ['language']);
    });
    it('cancel and an oversized file cause no import', async () => {
        const f = fixture();
        f.select('file');
        await vi.waitFor(() => expect(f.shadow.querySelector('[data-action="settingsImportConfirm"]')).toBeTruthy());
        f.click('btnCancel');
        expect(f.actions.applyImport).not.toHaveBeenCalled();
        f.select('large', MAX_SETTINGS_FILE_BYTES + 1);
        await Promise.resolve();
        expect(f.actions.previewImport).toHaveBeenCalledTimes(1);
        expect(f.actions.applyImport).not.toHaveBeenCalled();
    });
    it('restores through preview and confirmation instead of replaying a saved settings object', async () => {
        const f = fixture();
        f.click('settingsRestore');
        await vi.waitFor(() => expect(f.shadow.querySelector('[data-action="settingsImportConfirm"]')).toBeTruthy());
        expect(f.actions.applyImport).not.toHaveBeenCalled();
        expect(f.actions.previewImport).toHaveBeenCalledWith(JSON.stringify(await f.actions.getRecovery()));
    });
    it('reports conflicts, clears the stale preview and never retries automatically', async () => {
        const f = fixture();
        f.actions.applyImport.mockRejectedValueOnce(new Error('CONFLICT'));
        f.select('file');
        await vi.waitFor(() => expect(f.shadow.querySelector('[data-action="settingsImportConfirm"]')).toBeTruthy());
        f.click('settingsImportConfirm');
        await vi.waitFor(() => expect(f.shadow.querySelector('[data-action="settingsImportConfirm"]')).toBeNull());
        expect(f.actions.applyImport).toHaveBeenCalledOnce();
        expect(f.actions.onApplied).not.toHaveBeenCalled();
        expect(f.shadow.querySelector('[role="status"]')!.textContent).toBeTruthy();
    });
});
it('handles file read failures without previewing or writing settings', async () => {
    const f = fixture();
    const input = f.shadow.querySelector<HTMLInputElement>('input[type="file"]')!;
    Object.defineProperty(input, 'files', { configurable: true, value: [{ size: 12, text: async () => {
                    throw new Error('unreadable');
                } }] });
    input.dispatchEvent(new Event('change'));
    await vi.waitFor(() => expect(f.shadow.querySelector('[role="status"]')!.textContent).toBeTruthy());
    expect(f.actions.previewImport).not.toHaveBeenCalled();
    expect(f.actions.applyImport).not.toHaveBeenCalled();
});
