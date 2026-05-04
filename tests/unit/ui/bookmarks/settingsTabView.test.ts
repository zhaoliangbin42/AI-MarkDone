import { describe, expect, it, vi } from 'vitest';
import { getBookmarksPanelCss } from '@/ui/content/bookmarks/ui/styles/bookmarksPanelCss';
import { SettingsTabView } from '@/ui/content/bookmarks/ui/tabs/SettingsTabView';

const baseSettings = {
    version: 3,
    platforms: { chatgpt: true, gemini: true, claude: true, deepseek: true },
    behavior: {
        showSaveMessages: true,
        showWordCount: true,
        enableClickToCopy: true,
        saveContextOnly: true,
        _contextOnlyConfirmed: true,
    },
    formula: {
        clickCopyMarkdown: true,
        assetActions: {
            copyPng: true,
            copySvg: true,
            savePng: true,
            saveSvg: true,
        },
    },
    reader: {
        renderCodeInReader: true,
        commentExport: {
            prompts: [
                { id: 'prompt-1', title: 'Prompt 1', content: 'Please review the following comments:' },
            ],
            template: [
                { type: 'text', value: 'Regarding\n' },
                { type: 'token', key: 'selected_source' },
                { type: 'text', value: '\nMy comment is:\n' },
                { type: 'token', key: 'user_comment' },
            ],
            promptPosition: 'top',
        },
    },
    export: {
        pngWidthPreset: 'desktop',
        pngCustomWidth: 920,
        pngPixelRatio: 1,
    },
    chatgptDirectory: {
        enabled: true,
        mode: 'preview',
    },
    bookmarks: { sortMode: 'time-desc' },
    language: 'auto',
} as any;

describe('SettingsTabView', () => {
    it('does not expose retired ChatGPT folding or directory visibility controls', async () => {
        const modal = { confirm: vi.fn(async () => true) } as any;
        const actions = {
            loadState: vi.fn(async () => ({
                settings: structuredClone(baseSettings),
                storageUsage: null,
            })),
        };

        const view = new SettingsTabView({ modal, actions });
        await view.refresh();

        const root = view.getElement();
        const directoryToggle = root.querySelector<HTMLInputElement>('[data-role="settings-chatgpt-conversation-directory"]');

        expect(directoryToggle).toBeNull();
        expect(root.querySelector('#aimd-chatgpt-folding-mode')).toBeNull();
        expect(root.querySelector('[data-role="settings-fold-dock"]')).toBeNull();
        expect(root.querySelector('[data-role="settings-folding-count"]')).toBeNull();
    });

    it('wires ChatGPT directory settings to the scoped settings category', () => {
        const modal = { confirm: vi.fn(async () => true) } as any;
        const onSetChatGptDirectorySettings = vi.fn(async () => undefined);

        const view = new SettingsTabView({
            modal,
            actions: { setChatGptDirectorySettings: onSetChatGptDirectorySettings },
        });
        view.setState({
            settings: structuredClone(baseSettings),
            storageUsage: null,
        });

        const root = view.getElement();
        const enabled = root.querySelector<HTMLInputElement>('[data-role="settings-chatgpt-directory-enabled"]')!;
        const mode = root.querySelector<HTMLElement>('[data-role="settings-chatgpt-directory-mode"]')!;

        expect(enabled.checked).toBe(true);
        expect(mode.textContent?.trim()).toBeTruthy();

        enabled.checked = false;
        enabled.dispatchEvent(new Event('change', { bubbles: true }));
        expect(onSetChatGptDirectorySettings).toHaveBeenCalledWith({ enabled: false });

        mode.click();
        root.querySelector<HTMLButtonElement>('.settings-select-option[data-value="expanded"]')!.click();
        expect(onSetChatGptDirectorySettings).toHaveBeenLastCalledWith({ mode: 'expanded' });
    });

    it('renders shipped platform icon wrappers and storage/export content', async () => {
        const modal = { confirm: vi.fn(async () => true) } as any;
        const onExportAllBookmarks = vi.fn(async () => undefined);

        const view = new SettingsTabView({ modal, actions: { exportAllBookmarks: onExportAllBookmarks } });
        view.setState({
            settings: structuredClone(baseSettings),
            storageUsage: { usedBytes: 512, quotaBytes: 1024, usedPercentage: 50, warningLevel: 'none' },
        });

        const root = view.getElement();
        const platformIcons = root.querySelectorAll('.settings-card:first-child .settings-label__icon');
        const storageFill = root.querySelector('.storage-fill');
        const exportButton = root.querySelector<HTMLButtonElement>('.export-backup-btn');

        expect(root.classList.contains('aimd-settings')).toBe(true);
        expect(platformIcons).toHaveLength(4);
        expect(storageFill?.getAttribute('style')).toContain('50%');
        expect(exportButton).toBeTruthy();

        exportButton?.click();
        expect(onExportAllBookmarks).toHaveBeenCalledTimes(1);
    });

    it('wires formula Markdown toggle and asset action popover to scoped formula settings', () => {
        const modal = { confirm: vi.fn(async () => true) } as any;
        const onSetFormulaSettings = vi.fn(async () => undefined);

        const view = new SettingsTabView({
            modal,
            actions: { setFormulaSettings: onSetFormulaSettings },
        });
        view.setState({
            settings: structuredClone(baseSettings),
            storageUsage: null,
        });

        const root = view.getElement();
        const markdownToggle = root.querySelector<HTMLInputElement>('[data-role="settings-formula-click-copy-markdown"]')!;
        const assetButton = root.querySelector<HTMLButtonElement>('[data-role="settings-formula-asset-actions"]')!;

        expect(markdownToggle.checked).toBe(true);
        markdownToggle.checked = false;
        markdownToggle.dispatchEvent(new Event('change', { bubbles: true }));
        expect(onSetFormulaSettings).toHaveBeenCalledWith({ clickCopyMarkdown: false });

        assetButton.click();
        const popover = root.querySelector<HTMLElement>('.formula-asset-settings');
        expect(popover).toBeTruthy();
        const toggles = Array.from(root.querySelectorAll<HTMLInputElement>('[data-role^="settings-formula-asset-action-"]'));
        expect(toggles.map((input) => input.dataset.role)).toEqual([
            'settings-formula-asset-action-copy-png',
            'settings-formula-asset-action-copy-svg',
            'settings-formula-asset-action-save-png',
            'settings-formula-asset-action-save-svg',
        ]);

        toggles[0]!.checked = false;
        toggles[0]!.dispatchEvent(new Event('change', { bubbles: true }));
        expect(onSetFormulaSettings).toHaveBeenLastCalledWith({
            assetActions: {
                copyPng: false,
                copySvg: true,
                savePng: true,
                saveSvg: true,
            },
        });
    });

    it('keeps PNG export width presets and custom width in sync inside Settings', () => {
        const modal = { confirm: vi.fn(async () => true) } as any;
        const onSetExportSettings = vi.fn(async () => undefined);

        const view = new SettingsTabView({ modal, actions: { setExportSettings: onSetExportSettings } });
        view.setState({
            settings: structuredClone(baseSettings),
            storageUsage: null,
        });

        const root = view.getElement();
        const presetTrigger = root.querySelector<HTMLElement>('[data-role="settings-export-png-width-preset"]')!;
        const widthInput = root.querySelector<HTMLInputElement>('[data-role="settings-export-png-width"]')!;
        const pixelRatioInput = root.querySelector<HTMLInputElement>('[data-role="settings-export-png-pixel-ratio"]')!;
        const exportRows = Array.from(root.querySelectorAll<HTMLElement>('.settings-card'))
            .find((card) => card.querySelector('[data-role="settings-export-png-width-preset"]'))
            ?.querySelectorAll('.settings-row');
        const combinedRow = presetTrigger.closest<HTMLElement>('.settings-export-width-row');
        const controls = presetTrigger.closest<HTMLElement>('.settings-export-width-controls');

        expect(presetTrigger.textContent).toContain('Desktop');
        expect(widthInput.disabled).toBe(true);
        expect(widthInput.value).toBe('800');
        expect(combinedRow).toBeTruthy();
        expect(controls?.contains(widthInput)).toBe(true);
        expect(presetTrigger.closest('.settings-export-width-preset')).toBeTruthy();
        expect(widthInput.closest('.settings-export-width-value')).toBeTruthy();
        expect(pixelRatioInput.value).toBe('1');
        expect(exportRows).toHaveLength(2);

        presetTrigger.click();
        root.querySelector<HTMLButtonElement>('.settings-select-option[data-value="custom"]')!.click();
        expect(widthInput.disabled).toBe(false);
        expect(widthInput.value).toBe('920');
        expect(onSetExportSettings).toHaveBeenCalledWith({ pngWidthPreset: 'custom' });

        widthInput.value = '410';
        widthInput.dispatchEvent(new Event('change', { bubbles: true }));
        expect(widthInput.value).toBe('420');
        expect(onSetExportSettings).toHaveBeenLastCalledWith({ pngCustomWidth: 410 });

        presetTrigger.click();
        root.querySelector<HTMLButtonElement>('.settings-select-option[data-value="mobile"]')!.click();
        expect(widthInput.disabled).toBe(true);
        expect(widthInput.value).toBe('390');
        expect(onSetExportSettings).toHaveBeenLastCalledWith({ pngWidthPreset: 'mobile' });

        pixelRatioInput.value = '2.7';
        pixelRatioInput.dispatchEvent(new Event('change', { bubbles: true }));
        expect(pixelRatioInput.value).toBe('2.5');
        expect(onSetExportSettings).toHaveBeenLastCalledWith({ pngPixelRatio: 2.7 });
    });

    it('keeps advanced reader width settings collapsed until the footer action is opened', () => {
        const modal = { confirm: vi.fn(async () => true) } as any;
        const onSetReaderSettings = vi.fn(async () => undefined);

        const view = new SettingsTabView({ modal, actions: { setReaderSettings: onSetReaderSettings } });
        view.setState({
            settings: structuredClone(baseSettings),
            storageUsage: null,
        });

        const root = view.getElement();
        const advancedButton = root.querySelector<HTMLButtonElement>('[data-role="settings-advanced-toggle"]')!;

        expect(advancedButton).toBeTruthy();
        expect(root.querySelector('[data-role="settings-reader-content-width"]')).toBeNull();

        advancedButton.click();
        const widthInput = root.querySelector<HTMLInputElement>('[data-role="settings-reader-content-width"]')!;
        expect(widthInput).toBeTruthy();
        expect(widthInput.value).toBe('1000');

        widthInput.value = '1611';
        widthInput.dispatchEvent(new Event('change', { bubbles: true }));

        expect(widthInput.value).toBe('1600');
        expect(onSetReaderSettings).toHaveBeenCalledWith({ contentMaxWidthPx: 1611 });
    });

    it('wires the reader comment prompt position toggle without replacing prompts or template', () => {
        const modal = { confirm: vi.fn(async () => true) } as any;
        const onSetReaderSettings = vi.fn(async () => undefined);

        const view = new SettingsTabView({ modal, actions: { setReaderSettings: onSetReaderSettings } });
        view.setState({
            settings: structuredClone(baseSettings),
            storageUsage: null,
        });

        const root = view.getElement();
        const promptPositionToggle = root.querySelector<HTMLInputElement>('[data-role="settings-reader-prompt-position-bottom"]')!;

        expect(promptPositionToggle).toBeTruthy();
        expect(promptPositionToggle.checked).toBe(false);

        promptPositionToggle.checked = true;
        promptPositionToggle.dispatchEvent(new Event('change', { bubbles: true }));

        expect(onSetReaderSettings).toHaveBeenCalledWith({
            commentExport: {
                prompts: baseSettings.reader.commentExport.prompts,
                template: baseSettings.reader.commentExport.template,
                promptPosition: 'bottom',
            },
        });
    });

    it('keeps group headings at least as prominent as child item titles in settings typography', () => {
        const css = getBookmarksPanelCss();

        expect(css).toContain('.card-title {');
        expect(css).toContain('font-size: var(--_bookmarks-section-title-size);');
        expect(css).toContain('.settings-label strong {');
        expect(css).toContain('font-size: var(--_bookmarks-item-title-size);');
        expect(css).toContain('.settings-select-trigger {');
        expect(css).toContain('font-size: var(--aimd-text-sm);');
        expect(css).toContain('.settings-label p,');
        expect(css).toContain('font-size: var(--aimd-text-xs);');
    });

    it('keeps PNG export controls on one compact content-sized row', () => {
        const css = getBookmarksPanelCss();

        expect(css).toContain('.settings-export-width-controls {');
        expect(css).toContain('min-width: 0;');
        expect(css).toContain('display: flex;');
        expect(css).toContain('flex-flow: row nowrap;');
        expect(css).toContain('white-space: nowrap;');
        expect(css).toContain('.settings-export-width-controls .settings-export-width-preset {');
        expect(css).toContain('.settings-export-width-controls .settings-export-width-value {');
        expect(css).toContain('width: 88px;');
        expect(css).toContain('.settings-export-width-preset .settings-select-trigger {');
        expect(css).toContain('min-width: 120px;');
        expect(css).toContain('.settings-export-pixel-ratio-value {');
        expect(css).toContain('width: 88px;');
        expect(css).not.toContain('--_bookmarks-settings-control-min-width');
        expect(css).not.toContain('--_bookmarks-settings-control-max-width');
        expect(css).not.toContain('flex: 1 1 190px;');
        expect(css).not.toContain('max-width: min(100%, 520px);');
    });

    it('locks settings scrolling to the vertical axis while keeping settings rows in a stable two-column layout', () => {
        const css = getBookmarksPanelCss();

        expect(css).toContain('.settings-panel-scroll,');
        expect(css).toContain('overflow-x: hidden;');
        expect(css).toContain('overflow-y: auto;');
        expect(css).toContain('scrollbar-gutter: stable;');
        expect(css).toContain('padding-inline-end: var(--aimd-space-3);');
        expect(css).toContain('max-width: 100%;');
        expect(css).toContain('.toggle-row,');
        expect(css).toContain('grid-template-columns: minmax(0, 1fr) max-content;');
        expect(css).toContain('width: 100%;');
        expect(css).toContain('.settings-label {');
        expect(css).toContain('flex: 1 1 auto;');
    });

    it('lets settings selects size to their labels while shrinking inside narrow rows', () => {
        const css = getBookmarksPanelCss();

        expect(css).toContain('.settings-select-shell {');
        expect(css).toContain('width: max-content;');
        expect(css).toContain('min-width: min(148px, 100%);');
        expect(css).toContain('max-width: min(320px, 100%);');
        expect(css).toContain('.settings-select-menu {');
        expect(css).toContain('width: max-content;');
        expect(css).toContain('max-width: min(320px, calc(100vw - var(--aimd-space-6)));');
        expect(css).toContain('.settings-select-option span:first-child {');
        expect(css).toContain('white-space: nowrap;');
        expect(css).not.toContain('max-width: clamp(148px, 34%, 220px);');
    });

    it('lets long reader setting summaries wrap without pushing fixed controls out of the row', () => {
        const css = getBookmarksPanelCss();

        expect(css).toContain('.settings-label p,');
        expect(css).toContain('overflow-wrap: anywhere;');
        expect(css).toContain('.reader-settings-summary {');
        expect(css).not.toContain('.reader-settings-summary {\n  white-space: nowrap;');
        expect(css).toContain('.reader-settings-trigger {');
        expect(css).toContain('min-width: var(--aimd-size-control-icon-panel);');
    });

    it('keeps inline settings menus above neighboring cards without clipping the floating layer', () => {
        const css = getBookmarksPanelCss();

        expect(css).toContain('.settings-card:has(.settings-select-shell[data-open="1"])');
        expect(css).toContain('z-index: var(--_bookmarks-inline-menu-z);');
        expect(css).toContain('.settings-select-shell[data-open="1"] {');
        expect(css).toContain('z-index: calc(var(--_bookmarks-inline-menu-z) + 1);');
        expect(css).not.toContain('.settings-card {\n  width: 100%;\n  max-width: 100%;\n  min-width: 0;\n  overflow: hidden;');
    });
});
