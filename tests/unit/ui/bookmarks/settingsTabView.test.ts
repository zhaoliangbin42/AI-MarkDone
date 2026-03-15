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
        const foldingModeTrigger = root.querySelector<HTMLElement>('#aimd-chatgpt-folding-mode');
        const foldingMode = root.querySelector<HTMLElement>('#aimd-chatgpt-folding-mode .settings-select-trigger__label');
        const showFoldDock = root.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')[4];

        expect(foldingModeTrigger).toBeTruthy();
        expect(foldingMode?.textContent).toBe('chatgptFoldingModeOff');
        expect(showFoldDock?.checked).toBe(true);
        expect(showFoldDock?.disabled).toBe(false);
        expect(showFoldDock?.closest('.settings-item')?.textContent).toContain('chatgptFoldDockDesc');
    });

    it('matches the shipped mock structure with custom select triggers, stepped count control, and DeepSeek casing', async () => {
        const modal = {
            confirm: vi.fn(async () => true),
        } as any;

        const view = new SettingsTabView({ modal });
        await view.refresh();

        const root = view.getElement();

        expect(root.querySelectorAll('.settings-select-trigger').length).toBeGreaterThanOrEqual(2);
        expect(root.querySelector('.settings-select')).toBeNull();
        expect(root.querySelector('.settings-number-field')).toBeTruthy();
        expect(root.querySelector('[data-action="settings-step-count"][data-direction="up"]')).toBeTruthy();
        expect(root.querySelector('[data-action="settings-step-count"][data-direction="down"]')).toBeTruthy();
        const platformLabels = Array.from(root.querySelectorAll<HTMLElement>('.settings-card:first-child .settings-label strong'));
        const deepseekLabel = platformLabels.find((node) => node.textContent?.includes('Deep'));

        expect(deepseekLabel?.textContent).toContain('DeepSeek');
        expect(deepseekLabel?.textContent).not.toContain('Deepseek');
    });
});
