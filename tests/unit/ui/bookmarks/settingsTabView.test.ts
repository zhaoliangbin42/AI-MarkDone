import { describe, expect, it, vi } from 'vitest';
import { getBookmarksPanelCss } from '@/ui/content/bookmarks/ui/styles/bookmarksPanelCss';

import { SettingsTabView } from '@/ui/content/bookmarks/ui/tabs/SettingsTabView';

const baseSettings = {
    version: 3,
    platforms: { chatgpt: true, gemini: true, claude: true, deepseek: true },
    chatgpt: { foldingMode: 'off', defaultExpandedCount: 8, showFoldDock: true, foldingPowerMode: 'on' },
    behavior: {
        showViewSource: true,
        showSaveMessages: true,
        showWordCount: true,
        enableClickToCopy: true,
        saveContextOnly: true,
        _contextOnlyConfirmed: true,
    },
    reader: { renderCodeInReader: true },
    bookmarks: { sortMode: 'time-desc' },
    language: 'auto',
} as any;

describe('SettingsTabView', () => {
    it('hides dependent ChatGPT folding controls while folding mode is off', async () => {
        const modal = {
            confirm: vi.fn(async () => true),
        } as any;
        const actions = {
            loadState: vi.fn(async () => ({
                settings: structuredClone(baseSettings),
                storageUsage: null,
            })),
        };

        const view = new SettingsTabView({ modal, actions });
        await view.refresh();

        const root = view.getElement();
        const foldingModeTrigger = root.querySelector<HTMLElement>('#aimd-chatgpt-folding-mode');
        const foldingMode = root.querySelector<HTMLElement>('#aimd-chatgpt-folding-mode .settings-select-trigger__label');
        const showFoldDock = root.querySelector<HTMLInputElement>('[data-role="settings-fold-dock"]');
        const powerModeTrigger = root.querySelector<HTMLElement>('#aimd-chatgpt-folding-power-mode');
        const countContainer = root.querySelector<HTMLElement>('[data-role="settings-folding-count-container"]');

        expect(foldingModeTrigger).toBeTruthy();
        expect(foldingMode?.textContent).toBe('chatgptFoldingModeOff');
        expect(showFoldDock).toBeNull();
        expect(powerModeTrigger).toBeNull();
        expect(countContainer).toBeNull();
    });

    it('matches the shipped mock structure with custom select triggers, stepped count control, and DeepSeek casing', async () => {
        const modal = {
            confirm: vi.fn(async () => true),
        } as any;
        const actions = {
            loadState: vi.fn(async () => ({
                settings: structuredClone(baseSettings),
                storageUsage: null,
            })),
        };

        const view = new SettingsTabView({ modal, actions });
        await view.refresh();

        const root = view.getElement();

        expect(root.querySelectorAll('.settings-select-trigger').length).toBeGreaterThanOrEqual(2);
        expect(root.querySelector('.settings-select')).toBeNull();
        expect(root.querySelector('.settings-number-field')).toBeNull();
        root.querySelector<HTMLButtonElement>('[data-action="toggle-settings-menu"][data-menu="folding-mode"]')?.click();
        root.querySelector<HTMLElement>('[data-action="settings-select-option"][data-menu="folding-mode"][data-value="keep_last_n"]')?.click();
        expect(root.querySelector('.settings-number-field')).toBeTruthy();
        expect(root.querySelector('[data-action="settings-step-count"][data-direction="up"]')).toBeTruthy();
        expect(root.querySelector('[data-action="settings-step-count"][data-direction="down"]')).toBeTruthy();
        const platformLabels = Array.from(root.querySelectorAll<HTMLElement>('.settings-card:first-child .settings-label strong'));
        const deepseekLabel = platformLabels.find((node) => node.textContent?.includes('Deep'));
        const firstPlatformLabel = platformLabels[0];

        expect(deepseekLabel?.textContent).toContain('DeepSeek');
        expect(deepseekLabel?.textContent).not.toContain('Deepseek');
        expect(firstPlatformLabel?.querySelector('.settings-label__icon')).toBeTruthy();
    });

    it('closes an open settings select when its trigger is clicked again', async () => {
        const modal = {
            confirm: vi.fn(async () => true),
        } as any;
        const actions = {
            loadState: vi.fn(async () => ({
                settings: structuredClone(baseSettings),
                storageUsage: null,
            })),
        };

        const view = new SettingsTabView({ modal, actions });
        await view.refresh();

        const root = view.getElement();
        const trigger = root.querySelector<HTMLButtonElement>('[data-action="toggle-settings-menu"][data-menu="folding-mode"]');
        const menu = root.querySelector<HTMLElement>('.settings-select-menu');

        trigger?.click();
        expect(menu?.dataset.open).toBe('1');

        trigger?.click();
        expect(menu?.dataset.open).toBe('0');
    });

    it('uses an upward chevron for increment and a downward chevron for decrement', async () => {
        const modal = {
            confirm: vi.fn(async () => true),
        } as any;
        const actions = {
            loadState: vi.fn(async () => ({
                settings: {
                    ...structuredClone(baseSettings),
                    chatgpt: { foldingMode: 'keep_last_n', defaultExpandedCount: 4, showFoldDock: true, foldingPowerMode: 'on' },
                },
                storageUsage: null,
            })),
        };

        const view = new SettingsTabView({ modal, actions });
        await view.refresh();

        const root = view.getElement();
        const stepUp = root.querySelector<HTMLElement>('[data-action="settings-step-count"][data-direction="up"]');
        const stepDown = root.querySelector<HTMLElement>('[data-action="settings-step-count"][data-direction="down"]');

        expect(stepUp?.querySelector('polyline')?.getAttribute('points')).toBe('18 15 12 9 6 15');
        expect(stepDown?.querySelector('polyline')?.getAttribute('points')).toBe('6 9 12 15 18 9');
    });

    it('renders shipped platform icon wrappers and storage/export content instead of the old bare text-only settings markup', async () => {
        const modal = {
            confirm: vi.fn(async () => true),
        } as any;
        const actions = {
            exportAllBookmarks: vi.fn(async () => undefined),
        };
        const onExportAllBookmarks = vi.fn(async () => undefined);

        const view = new SettingsTabView({ modal, actions: { ...actions, exportAllBookmarks: onExportAllBookmarks } });
        view.setState({
            settings: {
                version: 3,
                platforms: { chatgpt: true, gemini: true, claude: true, deepseek: true },
                chatgpt: { foldingMode: 'keep_last_n', defaultExpandedCount: 5, showFoldDock: true, foldingPowerMode: 'on' },
                behavior: {
                    showViewSource: true,
                    showSaveMessages: true,
                    showWordCount: true,
                    enableClickToCopy: true,
                    saveContextOnly: false,
                    _contextOnlyConfirmed: true,
                },
                reader: { renderCodeInReader: true },
                bookmarks: { sortMode: 'alpha-asc' },
                performance: undefined,
                language: 'auto',
            },
            storageUsage: { usedBytes: 512, quotaBytes: 1024, usedPercentage: 50, warningLevel: 'none' },
        });

        const root = view.getElement();
        const platformIcons = root.querySelectorAll('.settings-card:first-child .settings-label__icon');
        const storageFill = root.querySelector('.storage-fill');
        const exportButton = root.querySelector<HTMLButtonElement>('.export-backup-btn');

        expect(root.classList.contains('aimd-settings')).toBe(true);
        expect(platformIcons).toHaveLength(4);
        expect(storageFill).toBeTruthy();
        expect(storageFill?.getAttribute('style')).toContain('50%');
        expect(root.textContent).toContain('backupWarning');
        expect(exportButton).toBeTruthy();

        exportButton?.click();
        expect(onExportAllBookmarks).toHaveBeenCalledTimes(1);
    });

    it('keeps group headings at least as prominent as child item titles in settings typography', () => {
        const css = getBookmarksPanelCss();

        expect(css).toContain('.card-title {');
        expect(css).toContain('font-size: var(--_bookmarks-section-title-size);');
        expect(css).toContain('font-weight: var(--_bookmarks-section-title-weight);');
        expect(css).toContain('.settings-label strong {');
        expect(css).toContain('--_bookmarks-item-title-size: var(--aimd-text-sm);');
        expect(css).toContain('font-size: var(--_bookmarks-item-title-size);');
        expect(css).toContain('font-weight: var(--_bookmarks-item-title-weight);');
        expect(css).toContain('.settings-select-trigger {');
        expect(css).toContain('font-size: var(--aimd-text-sm);');
        expect(css).toContain('.settings-number {');
        expect(css).toContain('font-size: var(--aimd-text-sm);');
        expect(css).toContain('.settings-label p,');
        expect(css).toContain('font-size: var(--aimd-text-xs);');
    });

    it('routes settings updates through injected actions instead of directly depending on the rpc client', async () => {
        const modal = {
            confirm: vi.fn(async () => true),
        } as any;
        const actions = {
            loadState: vi.fn(async () => ({
                settings: structuredClone(baseSettings),
                storageUsage: null,
            })),
            setPlatforms: vi.fn(async () => undefined),
            setChatGptSettings: vi.fn(async () => undefined),
            setBehaviorSettings: vi.fn(async () => undefined),
            setReaderSettings: vi.fn(async () => undefined),
            setLanguage: vi.fn(async () => undefined),
        };

        const view = new SettingsTabView({ modal, actions });
        await view.refresh();

        const root = view.getElement();
        const platformToggle = root.querySelector<HTMLInputElement>('[data-role="settings-platform-chatgpt"]')!;
        platformToggle.checked = false;
        platformToggle.dispatchEvent(new Event('change', { bubbles: true }));

        root.querySelector<HTMLButtonElement>('[data-action="toggle-settings-menu"][data-menu="folding-mode"]')?.click();
        root.querySelector<HTMLElement>('[data-action="settings-select-option"][data-menu="folding-mode"][data-value="keep_last_n"]')?.click();
        root.querySelector<HTMLInputElement>('[data-role="settings-folding-count"]')!.value = '12';
        root.querySelector<HTMLInputElement>('[data-role="settings-folding-count"]')!.dispatchEvent(new Event('input', { bubbles: true }));
        root.querySelector<HTMLButtonElement>('[data-action="toggle-settings-menu"][data-menu="folding-power-mode"]')?.click();
        root.querySelector<HTMLElement>('[data-action="settings-select-option"][data-menu="folding-power-mode"][data-value="off"]')?.click();

        root.querySelector<HTMLButtonElement>('[data-action="toggle-settings-menu"][data-menu="language"]')?.click();
        root.querySelector<HTMLElement>('[data-action="settings-select-option"][data-menu="language"][data-value="zh_CN"]')?.click();

        expect(actions.setPlatforms).toHaveBeenCalledWith({ chatgpt: false });
        expect(actions.setChatGptSettings).toHaveBeenCalledWith({ foldingMode: 'keep_last_n' });
        expect(actions.setChatGptSettings).toHaveBeenCalledWith({ defaultExpandedCount: 12 });
        expect(actions.setChatGptSettings).toHaveBeenCalledWith({ foldingPowerMode: 'off' });
        expect(actions.setLanguage).toHaveBeenCalledWith('zh_CN');
        expect(actions.setReaderSettings).not.toHaveBeenCalled();
    });

    it('shows fold dock and power mode controls once folding is enabled', async () => {
        const modal = {
            confirm: vi.fn(async () => true),
        } as any;
        const actions = {
            loadState: vi.fn(async () => ({
                settings: structuredClone(baseSettings),
                storageUsage: null,
            })),
        };

        const view = new SettingsTabView({ modal, actions });
        await view.refresh();

        const root = view.getElement();
        root.querySelector<HTMLButtonElement>('[data-action="toggle-settings-menu"][data-menu="folding-mode"]')?.click();
        root.querySelector<HTMLElement>('[data-action="settings-select-option"][data-menu="folding-mode"][data-value="all"]')?.click();

        const showFoldDock = root.querySelector<HTMLInputElement>('[data-role="settings-fold-dock"]');
        const powerModeTrigger = root.querySelector<HTMLElement>('#aimd-chatgpt-folding-power-mode');
        const powerModeLabel = root.querySelector<HTMLElement>('#aimd-chatgpt-folding-power-mode .settings-select-trigger__label');
        const helperText = root.textContent ?? '';

        expect(showFoldDock?.checked).toBe(true);
        expect(powerModeTrigger).toBeTruthy();
        expect(powerModeLabel?.textContent).toBe('chatgptFoldingPowerModeOn');
        expect(helperText).toContain('chatgptFoldingPowerModeHint');
    });

    it('does not render a reader markdown theme select once the feature is removed', async () => {
        const modal = {
            confirm: vi.fn(async () => true),
        } as any;
        const actions = {
            loadState: vi.fn(async () => ({
                settings: {
                    ...structuredClone(baseSettings),
                    reader: { renderCodeInReader: true },
                },
                storageUsage: null,
            })),
        };

        const view = new SettingsTabView({ modal, actions });
        await view.refresh();

        const root = view.getElement();
        const trigger = root.querySelector<HTMLButtonElement>('[data-action="toggle-settings-menu"][data-menu="reader-markdown-theme"]');

        expect(trigger).toBeNull();
    });
});
