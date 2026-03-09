import { describe, expect, it, vi } from 'vitest';

vi.mock('@/drivers/shared/clients/settingsClientRpc', () => ({
    settingsClientRpc: {
        getAll: vi.fn(async () => ({
            ok: true,
            data: {
                settings: {
                    platforms: { chatgpt: true, gemini: true, claude: true, deepseek: true },
                    chatgpt: { foldingMode: 'off', defaultExpandedCount: 8, showFoldDock: true },
                    behavior: {
                        showViewSource: true,
                        showSaveMessages: true,
                        showWordCount: true,
                        enableClickToCopy: true,
                        saveContextOnly: true,
                        _contextOnlyConfirmed: true,
                    },
                    reader: { renderCodeInReader: true },
                    language: 'auto',
                },
            },
        })),
        setCategory: vi.fn(async () => ({ ok: true, data: { category: 'chatgpt' } })),
    },
}));

import { SettingsTabView } from '@/ui/content/bookmarks/ui/tabs/SettingsTabView';

describe('SettingsTabView', () => {
    it('preserves the fold dock toggle state while folding mode is off', async () => {
        const modal = {
            confirm: vi.fn(async () => true),
        } as any;

        const view = new SettingsTabView({ modal });
        await view.refresh();

        const root = view.getElement();
        const foldingMode = root.querySelector<HTMLSelectElement>('#aimd-chatgpt-folding-mode');
        const showFoldDock = root.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')[4];

        expect(foldingMode?.value).toBe('off');
        expect(showFoldDock?.checked).toBe(true);
        expect(showFoldDock?.disabled).toBe(false);
        expect(showFoldDock?.closest('.settings-item')?.textContent).toContain('chatgptFoldDockDesc');
    });
});
