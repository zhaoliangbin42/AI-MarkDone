import { describe, expect, it, vi } from 'vitest';
import { getBookmarksPanelCss } from '@/ui/content/bookmarks/ui/styles/bookmarksPanelCss';
import { SettingsTabView } from '@/ui/content/bookmarks/ui/tabs/SettingsTabView';


function buttonSetting(view: SettingsTabView, group: string, path: string): HTMLButtonElement {
    view.getNavigationElement().querySelector<HTMLButtonElement>('[data-category="controls"]')!.click();
    const shadow = view.getElement().querySelector('[data-role="settings-buttons"]')!.shadowRoot!;
    shadow.querySelector<HTMLButtonElement>(`[data-group="${group}"]`)!.click();
    return shadow.querySelector<HTMLButtonElement>(`[data-path="${path}"] [role="switch"]`)!;
}

const baseSettings = {
    version: 4,
    platforms: { chatgpt: true, gemini: true, claude: true, deepseek: true },
    behavior: {
        showMessageToolbar: true,
        showSaveMessages: true,
        showWordCount: true,
        enableClickToCopy: true,
        saveContextOnly: true,
        _contextOnlyConfirmed: true,
    },
    formula: {
        clickCopyMarkdown: true,
        clickCopyFormulaFormat: 'markdown-dollar',
        markdownCopyFormulaFormat: 'markdown-dollar',
        assetFontSizePx: 36,
        assetActions: {
            copyPng: true,
            copySvg: true,
            copyMathml: true,
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
        promptLabelMode: 'head',
        hideOfficialNavigation: true,
        rightInsetPx: 0,
        previewMaxChars: 600,
    },
    chatgptBehavior: {
        restorePositionAfterSend: true,
        atomicMarkdownCopyShortcut: 'mod-shift-c',
        inputEnhancement: {
            available: true,
            enabled: true,
            enterKeyNewline: true,
            boldShortcut: true,
            lists: { enabled: true, ordered: true, unordered: true },
            formulaSuggestions: true,
            formulaPreview: true,
        },
        showMessageStepper: true,
        showPageBookmarkControl: true,
        showDetachedReaderControl: true,
        showPromptControl: true,
        promptAutocomplete: true,
        enableArrowKeyMessageNavigation: true,
        pageWidthScale: 100,
    },
    appearance: { fontSizePx: 16, accentColor: null },
    bookmarks: { sortMode: 'time-desc' },
    language: 'auto',
} as any;

describe('SettingsTabView', () => {
    it('locks new controls across real category changes until matching runtime capabilities arrive', () => {
        const setBehavior = vi.fn(async () => undefined);
        const transfer = { exportSettings: vi.fn(), previewImport: vi.fn(), applyImport: vi.fn(), getRecovery: vi.fn(), onApplied: vi.fn() };
        const view = new SettingsTabView({ modal: { confirm: vi.fn(async () => true) } as any, actions: { setBehavior, settingsTransfer: transfer } });
        const state = { settings: structuredClone(baseSettings), storageUsage: null };
        view.setState({ ...state, canConfigureButtons: false, canTransferSettings: false });
        const toggle = buttonSetting(view, 'Message', 'behavior.showMessageToolbar');
        expect(toggle.disabled).toBe(true);
        toggle.click();
        expect(setBehavior).not.toHaveBeenCalled();
        view.getNavigationElement().querySelector<HTMLButtonElement>('[data-category="data"]')!.click();
        const shadow = view.getElement().querySelector('[data-role="settings-transfer"]')!.shadowRoot!;
        const exportButton = shadow.querySelector<HTMLButtonElement>('[data-action="settingsExport"]')!;
        expect(exportButton.disabled).toBe(true);
        exportButton.click();
        expect(transfer.exportSettings).not.toHaveBeenCalled();
        expect(shadow.querySelector('[role="status"]')!.textContent).toBeTruthy();
        view.setState({ ...state, canConfigureButtons: true, canTransferSettings: true });
        expect(buttonSetting(view, 'Message', 'behavior.showMessageToolbar').disabled).toBe(false);
        expect(exportButton.disabled).toBe(false);
        expect(shadow.querySelector('[role="status"]')!.textContent).toBe('');
        view.destroy();
    });
    it('blocks editing and offers retry when the runtime is disconnected', async () => {
        const modal = { confirm: vi.fn(async () => true) } as any;
        const retryLoad = vi.fn(async () => undefined);
        const view = new SettingsTabView({ modal, actions: { retryLoad } as any });

        view.setState({
            settings: structuredClone(baseSettings),
            storageUsage: null,
            dataState: {
                kind: 'error',
                failure: {
                    kind: 'transport',
                    code: 'RECEIVER_UNAVAILABLE',
                    message: 'Could not establish connection. Receiving end does not exist.',
                    delivery: 'not-sent',
                },
            },
        } as any);

        const root = view.getElement();
        const notice = root.querySelector<HTMLElement>('[data-role="settings-runtime-error"]')!;
        const scroll = root.querySelector<HTMLElement>('.settings-panel-scroll')!;
        expect(notice.hidden).toBe(false);
        expect(notice.textContent).toContain('AI-MarkDone is disconnected');
        expect(notice.textContent).toContain('Retry');
        expect(scroll.inert).toBe(true);

        notice.querySelector<HTMLButtonElement>('[data-action="settings-runtime-retry"]')!.click();
        await vi.waitFor(() => expect(retryLoad).toHaveBeenCalledTimes(1));
    });

    it('exposes only ChatGPT while preserving legacy platform preferences', () => {
        const modal = { confirm: vi.fn(async () => true) } as any;
        const onSetPlatforms = vi.fn(async () => undefined);
        const view = new SettingsTabView({ modal, actions: { setPlatforms: onSetPlatforms } });
        view.setState({
            settings: structuredClone(baseSettings),
            storageUsage: null,
        });

        const root = view.getElement();

        expect(root.querySelector('[data-role="settings-platform-chatgpt"]')).toBeTruthy();
        expect(root.querySelector('[data-role="settings-platform-gemini"]')).toBeNull();
        expect(root.querySelector('[data-role="settings-platform-claude"]')).toBeNull();
        expect(root.querySelector('[data-role="settings-platform-deepseek"]')).toBeNull();
        expect(root.querySelector('[data-role="settings-platform-retirement-notice"]')).toBeNull();

        const gemini = root.querySelector<HTMLInputElement>('[data-role="settings-platform-chatgpt"]')!;
        gemini.checked = false;
        gemini.dispatchEvent(new Event('change', { bubbles: true }));

        expect(onSetPlatforms).toHaveBeenCalledWith({ chatgpt: false });
    });

    it('restores the previous language selection when persistence fails', async () => {
        const modal = { confirm: vi.fn(async () => true) } as any;
        const setLanguage = vi.fn(async () => false);
        const view = new SettingsTabView({
            modal,
            actions: { setLanguage } as any,
        });
        view.setState({
            settings: structuredClone(baseSettings),
            storageUsage: null,
        });

        const root = view.getElement();
        const trigger = root.querySelector<HTMLButtonElement>(
            '[data-action="toggle-settings-menu"][data-menu="language"]',
        )!;
        const initialLabel = trigger.textContent;

        trigger.click();
        root.querySelector<HTMLButtonElement>(
            '[data-action="settings-select-option"][data-menu="language"][data-value="zh_CN"]',
        )!.click();

        await vi.waitFor(() => {
            expect(setLanguage).toHaveBeenCalledWith('zh_CN');
            expect(trigger.textContent).toBe(initialLabel);
        });
    });

    it('wires the master message toolbar toggle to behavior settings', async () => {
        const modal = { confirm: vi.fn(async () => true) } as any;
        const onSetBehaviorSettings = vi.fn(async () => undefined);
        const view = new SettingsTabView({ modal, actions: { setBehaviorSettings: onSetBehaviorSettings } });
        view.setState({
            settings: structuredClone(baseSettings),
            storageUsage: null,
        });

        const toggle = buttonSetting(view, 'Message', 'behavior.showMessageToolbar');
        expect(toggle.getAttribute('aria-checked')).toBe('true');

        toggle.click();
        await Promise.resolve(); await Promise.resolve(); await Promise.resolve();

        expect(onSetBehaviorSettings).toHaveBeenCalledWith({ showMessageToolbar: false });
    });

    it('does not expose retired ChatGPT folding controls while showing the restored directory controls', async () => {
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
        expect(root.querySelector('[data-role="settings-chatgpt-conversation-directory"]')).toBeNull();
        expect(root.querySelector('[data-role="settings-chatgpt-directory-enabled"]')).toBeTruthy();
        expect(root.querySelector('[data-role="settings-chatgpt-directory-mode"]')).toBeTruthy();
        expect(root.querySelector('[data-role="settings-chatgpt-directory-prompt-label-mode"]')).toBeTruthy();
        expect(root.querySelector('[data-role="settings-chatgpt-directory-right-inset"]')).toBeTruthy();
        expect(root.querySelector('[data-role="settings-chatgpt-directory-hide-official-navigation"]')).toBeNull();
        expect(root.querySelector('#aimd-chatgpt-folding-mode')).toBeNull();
        expect(root.querySelector('[data-role="settings-fold-dock"]')).toBeNull();
        expect(root.querySelector('[data-role="settings-folding-count"]')).toBeNull();
    });

    it('wires ChatGPT directory settings to the scoped directory category', () => {
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
        const promptLabelMode = root.querySelector<HTMLInputElement>('[data-role="settings-chatgpt-directory-prompt-label-mode"]')!;
        const rightInset = root.querySelector<HTMLInputElement>('[data-role="settings-chatgpt-directory-right-inset"]')!;
        const previewMaxChars = root.querySelector<HTMLInputElement>('[data-role="settings-chatgpt-directory-preview-max-chars"]')!;

        expect(root.querySelector('[data-role="settings-chatgpt-directory-retired-notice"]')).toBeNull();
        expect(root.querySelector('[data-role="settings-chatgpt-directory-hide-official-navigation"]')).toBeNull();
        expect(enabled.checked).toBe(true);
        expect(mode.textContent).toContain('chatgptDirectoryModePreview');
        expect(promptLabelMode.checked).toBe(false);
        expect(rightInset.value).toBe('0');
        expect(rightInset.type).toBe('range');
        expect(rightInset.min).toBe('0');
        expect(rightInset.max).toBe('40');
        expect(rightInset.step).toBe('4');
        expect(previewMaxChars.value).toBe('600');
        expect(previewMaxChars.type).toBe('range');
        expect(previewMaxChars.min).toBe('200');
        expect(previewMaxChars.max).toBe('2000');
        expect(previewMaxChars.step).toBe('200');

        enabled.checked = false;
        enabled.dispatchEvent(new Event('change', { bubbles: true }));
        promptLabelMode.checked = true;
        promptLabelMode.dispatchEvent(new Event('change', { bubbles: true }));
        rightInset.value = '53';
        rightInset.dispatchEvent(new Event('change', { bubbles: true }));
        previewMaxChars.value = '1000';
        previewMaxChars.dispatchEvent(new Event('change', { bubbles: true }));

        expect(onSetChatGptDirectorySettings).toHaveBeenCalledWith({ enabled: false });
        expect(onSetChatGptDirectorySettings).toHaveBeenCalledWith({ promptLabelMode: 'headTail' });
        expect(onSetChatGptDirectorySettings).toHaveBeenCalledWith({ rightInsetPx: 40 });
        expect(onSetChatGptDirectorySettings).toHaveBeenCalledWith({ previewMaxChars: 1000 });
        expect(rightInset.value).toBe('40');
        expect(onSetChatGptDirectorySettings).not.toHaveBeenCalledWith(expect.objectContaining({ hideOfficialNavigation: expect.any(Boolean) }));
    });

    it('wires ChatGPT page width scale to the scoped behavior category', () => {
        const modal = { confirm: vi.fn(async () => true) } as any;
        const onSetChatGptBehaviorSettings = vi.fn(async () => undefined);

        const view = new SettingsTabView({
            modal,
            actions: { setChatGptBehaviorSettings: onSetChatGptBehaviorSettings },
        });
        view.setState({
            settings: structuredClone(baseSettings),
            storageUsage: null,
        });

        const slider = view.getElement().querySelector<HTMLInputElement>('[data-role="settings-chatgpt-page-width-scale"]')!;
        expect(slider.type).toBe('range');
        expect(slider.min).toBe('100');
        expect(slider.max).toBe('200');
        expect(slider.step).toBe('5');
        expect(slider.value).toBe('100');

        slider.value = '147';
        slider.dispatchEvent(new Event('change', { bubbles: true }));

        expect(onSetChatGptBehaviorSettings).toHaveBeenCalledWith({ pageWidthScale: 145 });
        expect(slider.value).toBe('145');
    });

    it('removes the retired fast-top control and keeps navigation seek speed scoped to behavior', () => {
        const modal = { confirm: vi.fn(async () => true) } as any;
        const onSetChatGptBehaviorSettings = vi.fn(async () => undefined);
        const view = new SettingsTabView({
            modal,
            actions: { setChatGptBehaviorSettings: onSetChatGptBehaviorSettings },
        });
        view.setState({
            settings: structuredClone(baseSettings),
            storageUsage: null,
        });

        const root = view.getElement();
        const seekStep = root.querySelector<HTMLInputElement>('[data-role="settings-chatgpt-navigation-seek-step"]')!;
        expect(root.querySelector('[data-role="settings-chatgpt-auto-top-timeout"]')).toBeNull();
        expect(seekStep.min).toBe('1000');
        expect(seekStep.max).toBe('5000');
        expect(seekStep.step).toBe('400');
        expect(seekStep.value).toBe('3000');

        seekStep.value = '4600';
        seekStep.dispatchEvent(new Event('change', { bubbles: true }));

        expect(onSetChatGptBehaviorSettings).toHaveBeenCalledWith({ navigationSeekStepPx: 4_600 });
    });

    it('wires ChatGPT restore-position behavior to the scoped behavior category', () => {
        const modal = { confirm: vi.fn(async () => true) } as any;
        const onSetChatGptBehaviorSettings = vi.fn(async () => undefined);

        const view = new SettingsTabView({
            modal,
            actions: { setChatGptBehaviorSettings: onSetChatGptBehaviorSettings },
        });
        view.setState({
            settings: structuredClone(baseSettings),
            storageUsage: null,
        });

        const root = view.getElement();
        const toggle = root.querySelector<HTMLInputElement>('[data-role="settings-chatgpt-restore-position-after-send"]')!;

        expect(toggle.checked).toBe(true);

        toggle.checked = false;
        toggle.dispatchEvent(new Event('change', { bubbles: true }));

        expect(onSetChatGptBehaviorSettings).toHaveBeenCalledWith({ restorePositionAfterSend: false });
    });

    it('lets users choose the ChatGPT Markdown selection shortcut', () => {
        const modal = { confirm: vi.fn(async () => true) } as any;
        const onSetChatGptBehaviorSettings = vi.fn(async () => undefined);
        const view = new SettingsTabView({
            modal,
            actions: { setChatGptBehaviorSettings: onSetChatGptBehaviorSettings },
        });
        view.setState({
            settings: structuredClone(baseSettings),
            storageUsage: null,
        });

        const select = view.getElement().querySelector<HTMLButtonElement>(
            '[data-role="settings-chatgpt-atomic-markdown-copy-shortcut"]',
        )!;
        expect(select.textContent).toContain('chatgptAtomicMarkdownCopyModShiftC');

        select.click();
        view.getElement().querySelector<HTMLButtonElement>(
            '[data-menu="chatgpt-atomic-markdown-copy-shortcut"][data-value="mod-c"]',
        )!.click();

        expect(onSetChatGptBehaviorSettings).toHaveBeenCalledWith({ atomicMarkdownCopyShortcut: 'mod-c' });
    });

    it('wires only input enhancement availability while preserving its detailed preferences', () => {
        const modal = { confirm: vi.fn(async () => true) } as any;
        const onSetChatGptBehaviorSettings = vi.fn(async () => undefined);

        const view = new SettingsTabView({
            modal,
            actions: { setChatGptBehaviorSettings: onSetChatGptBehaviorSettings },
        });
        view.setState({
            settings: structuredClone(baseSettings),
            storageUsage: null,
        });

        const root = view.getElement();
        const toggle = root.querySelector<HTMLInputElement>('[data-role="settings-chatgpt-input-enhancement"]')!;

        expect(toggle.checked).toBe(true);

        toggle.checked = false;
        toggle.dispatchEvent(new Event('change', { bubbles: true }));

        expect(onSetChatGptBehaviorSettings).toHaveBeenCalledWith({
            inputEnhancement: {
                ...baseSettings.chatgptBehavior.inputEnhancement,
                available: false,
            },
        });
    });

    it('wires Prompt autocomplete behavior to the scoped behavior category', () => {
        const modal = { confirm: vi.fn(async () => true) } as any;
        const onSetChatGptBehaviorSettings = vi.fn(async () => undefined);

        const view = new SettingsTabView({
            modal,
            actions: { setChatGptBehaviorSettings: onSetChatGptBehaviorSettings },
        });
        view.setState({
            settings: structuredClone(baseSettings),
            storageUsage: null,
        });

        const root = view.getElement();
        const toggle = root.querySelector<HTMLInputElement>('[data-role="settings-chatgpt-prompt-autocomplete"]')!;

        expect(toggle.checked).toBe(true);

        toggle.checked = false;
        toggle.dispatchEvent(new Event('change', { bubbles: true }));

        expect(onSetChatGptBehaviorSettings).toHaveBeenCalledWith({ promptAutocomplete: false });
    });

    it('wires the ChatGPT page selection toolbar toggle to the scoped behavior category', async () => {
        const modal = { confirm: vi.fn(async () => true) } as any;
        const onSetChatGptBehaviorSettings = vi.fn(async () => undefined);

        const view = new SettingsTabView({
            modal,
            actions: { setChatGptBehaviorSettings: onSetChatGptBehaviorSettings },
        });
        view.setState({
            settings: structuredClone(baseSettings),
            storageUsage: null,
        });

        const toggle = buttonSetting(view, 'Selection', 'chatgptBehavior.showPageSelectionToolbar');

        expect(toggle.getAttribute('aria-checked')).toBe('true');

        toggle.click();
        await Promise.resolve(); await Promise.resolve(); await Promise.resolve();

        expect(onSetChatGptBehaviorSettings).toHaveBeenCalledWith({ showPageSelectionToolbar: false });
    });

    it('wires ChatGPT arrow-key message navigation to the scoped behavior category', () => {
        const modal = { confirm: vi.fn(async () => true) } as any;
        const onSetChatGptBehaviorSettings = vi.fn(async () => undefined);

        const view = new SettingsTabView({
            modal,
            actions: { setChatGptBehaviorSettings: onSetChatGptBehaviorSettings },
        });
        view.setState({
            settings: structuredClone(baseSettings),
            storageUsage: null,
        });

        const root = view.getElement();
        const toggle = root.querySelector<HTMLInputElement>('[data-role="settings-chatgpt-arrow-key-message-navigation"]')!;

        expect(toggle.checked).toBe(true);

        toggle.checked = false;
        toggle.dispatchEvent(new Event('change', { bubbles: true }));

        expect(onSetChatGptBehaviorSettings).toHaveBeenCalledWith({ enableArrowKeyMessageNavigation: false });
    });

    it('lets users hide the lower-right ChatGPT message stepper buttons', async () => {
        const modal = { confirm: vi.fn(async () => true) } as any;
        const onSetChatGptBehaviorSettings = vi.fn(async () => undefined);

        const view = new SettingsTabView({
            modal,
            actions: { setChatGptBehaviorSettings: onSetChatGptBehaviorSettings },
        });
        view.setState({
            settings: structuredClone(baseSettings),
            storageUsage: null,
        });

        const root = view.getElement();
        const toggle = buttonSetting(view, 'Directory', 'chatgptBehavior.showMessageStepper');

        expect(toggle.getAttribute('aria-checked')).toBe('true');

        toggle.click();
        await Promise.resolve(); await Promise.resolve(); await Promise.resolve();

        expect(onSetChatGptBehaviorSettings).toHaveBeenCalledWith({ showMessageStepper: false });
    });

    it('lets users hide the lower-right ChatGPT page bookmark button', async () => {
        const modal = { confirm: vi.fn(async () => true) } as any;
        const onSetChatGptBehaviorSettings = vi.fn(async () => undefined);

        const view = new SettingsTabView({
            modal,
            actions: { setChatGptBehaviorSettings: onSetChatGptBehaviorSettings },
        });
        view.setState({
            settings: structuredClone(baseSettings),
            storageUsage: null,
        });

        const root = view.getElement();
        const toggle = buttonSetting(view, 'Page', 'chatgptBehavior.showPageBookmarkControl');

        expect(toggle.getAttribute('aria-checked')).toBe('true');

        toggle.click();
        await Promise.resolve(); await Promise.resolve(); await Promise.resolve();

        expect(onSetChatGptBehaviorSettings).toHaveBeenCalledWith({ showPageBookmarkControl: false });
    });

    it('lets users hide the lower-right ChatGPT Split View and Prompts buttons independently', async () => {
        const modal = { confirm: vi.fn(async () => true) } as any;
        const onSetChatGptBehaviorSettings = vi.fn(async () => undefined);

        const view = new SettingsTabView({
            modal,
            actions: { setChatGptBehaviorSettings: onSetChatGptBehaviorSettings },
        });
        view.setState({
            settings: structuredClone(baseSettings),
            storageUsage: null,
        });

        const root = view.getElement();
        const splitView = buttonSetting(view, 'Page', 'chatgptBehavior.showDetachedReaderControl');
        let prompts = buttonSetting(view, 'Page', 'chatgptBehavior.showPromptControl');

        expect(splitView.getAttribute('aria-checked')).toBe('true');
        expect(prompts.getAttribute('aria-checked')).toBe('true');

        splitView.click();
        await Promise.resolve(); await Promise.resolve(); await Promise.resolve();
        await vi.waitFor(() => expect(buttonSetting(view, 'Page', 'chatgptBehavior.showPromptControl').disabled).toBe(false));
        prompts = buttonSetting(view, 'Page', 'chatgptBehavior.showPromptControl');
        prompts.click();
        await Promise.resolve(); await Promise.resolve(); await Promise.resolve();

        expect(onSetChatGptBehaviorSettings).toHaveBeenCalledWith({ showDetachedReaderControl: false });
        expect(onSetChatGptBehaviorSettings).toHaveBeenCalledWith({ showPromptControl: false });
    });

    it('opens the shared Prompt manager from the Reader workflow row without insert mode', () => {
        const modal = { confirm: vi.fn(async () => true) } as any;
        const onOpenPromptManager = vi.fn();
        const settings = structuredClone(baseSettings);
        settings.reader.commentExport.prompts = [
            { id: 'legacy-1', title: 'Legacy 1', content: 'Legacy 1' },
            { id: 'legacy-2', title: 'Legacy 2', content: 'Legacy 2' },
            { id: 'legacy-3', title: 'Legacy 3', content: 'Legacy 3' },
        ];

        const view = new SettingsTabView({ modal, onOpenPromptManager });
        view.setState({
            settings,
            storageUsage: null,
        });

        const button = view.getElement().querySelector<HTMLButtonElement>('[data-role="settings-reader-prompts"]')!;
        const summary = button.closest('.settings-row')?.querySelector<HTMLElement>('.reader-settings-summary');
        expect(summary?.textContent).toBe('readerCommentPromptListDesc');
        expect(summary?.textContent).not.toContain('Legacy');
        expect(summary?.textContent).not.toContain('3');

        button.click();

        expect(onOpenPromptManager).toHaveBeenCalledWith(button);
    });

    it('keeps Reader-only annotation persistence out of global Settings', () => {
        const modal = { confirm: vi.fn(async () => true) } as any;
        const onSetReaderSettings = vi.fn(async () => undefined);
        const view = new SettingsTabView({ modal, actions: { setReaderSettings: onSetReaderSettings } });
        view.setState({ settings: structuredClone(baseSettings), storageUsage: null });

        expect(view.getElement().querySelector('[data-role="settings-reader-annotation-persistence"]')).toBeNull();
        expect(onSetReaderSettings).not.toHaveBeenCalled();
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
        const platformIcons = root.querySelectorAll('.settings-catalog-section[data-category="advanced"] .settings-label__icon');
        const storageFill = root.querySelector('.storage-fill');
        const exportButton = root.querySelector<HTMLButtonElement>('[data-role="settings-export-all-bookmarks"]');

        expect(root.classList.contains('aimd-settings')).toBe(true);
        expect(platformIcons).toHaveLength(1);
        expect(storageFill?.getAttribute('style')).toContain('50%');
        expect(exportButton).toBeTruthy();
        expect(exportButton?.classList.contains('secondary-btn')).toBe(true);

        exportButton?.click();
        expect(onExportAllBookmarks).toHaveBeenCalledTimes(1);
    });

    it('renders Data Management with experimental Google Drive Backup and Local Backup cards without sync wording', async () => {
        const modal = { confirm: vi.fn(async () => true), alert: vi.fn(async () => undefined), showCustom: vi.fn() } as any;
        const cloudBackup = {
            status: vi.fn(async () => ({
                connected: true,
                accountEmail: 'zhaoliangbin42@gmail.com',
                accountDisplayName: 'Liangbin Zhao',
                accountPhotoUrl: 'https://lh3.googleusercontent.com/avatar',
                authStrategy: 'webExtensionAccessToken',
            })),
            openSettings: vi.fn(async () => undefined),
            connect: vi.fn(async () => ({ connected: true })),
            disconnect: vi.fn(async () => ({ connected: false })),
            backupNow: vi.fn(async () => undefined),
            restore: vi.fn(async () => undefined),
        };
        const onExportAllBookmarks = vi.fn(async () => undefined);

        const view = new SettingsTabView({
            modal,
            actions: {
                exportAllBookmarks: onExportAllBookmarks,
                cloudBackup,
            },
        });
        view.setState({
            settings: structuredClone(baseSettings),
            storageUsage: { usedBytes: 512, quotaBytes: 1024, usedPercentage: 50, warningLevel: 'none' },
        });

        const root = view.getElement();
        const group = root.querySelector<HTMLElement>('.settings-catalog-section[data-category="data"]')!;
        const cards = Array.from(group.querySelectorAll<HTMLElement>('.settings-data-card'));
        const googleDriveRow = root.querySelector<HTMLElement>('[data-role="cloud-backup-google-drive-row"]')!;
        await Promise.resolve();

        expect(group.classList.contains('settings-card')).toBe(false);
        expect(group.querySelectorAll('.settings-subgroup')).toHaveLength(3);
        expect(cards[0].closest('.settings-card')).not.toBe(cards[1].closest('.settings-card'));
        expect(cards).toHaveLength(2);
        expect(cards[0].dataset.role).toBe('settings-google-drive-backup-card');
        expect(cards[0].closest('.settings-subgroup')?.querySelector('h4')?.textContent).toBe('settingsGroupCloudBackup');
        expect(cards[0].textContent).toContain('cloudBackupExperimentalLabel');
        expect(cards[0].textContent?.toLowerCase()).not.toContain('sync');
        expect(cards[0].textContent?.toLowerCase()).not.toContain('prompt');
        expect(cards[1].dataset.role).toBe('settings-data-backup-card');
        expect(cards[1].closest('.settings-subgroup')?.querySelector('h4')?.textContent).toBe('settingsGroupLocalBackup');
        expect(cards[1].textContent?.toLowerCase()).not.toContain('prompt');
        expect(googleDriveRow).toBeTruthy();
        expect(cards[0].contains(googleDriveRow)).toBe(true);
        expect(googleDriveRow.textContent).toContain('Google Drive');
        expect(googleDriveRow.textContent).toContain('cloudBackupExperimentalLabel');
        expect(cards[1].querySelector('[data-role="settings-local-backup-row"] strong')?.textContent).toBe('localBackupTitle');
        expect(root.querySelector<HTMLElement>('[data-role="cloud-backup-google-drive-status"]')?.textContent).toContain('Connected as');
        expect(root.querySelector<HTMLElement>('[data-role="cloud-backup-google-drive-status"]')?.textContent).not.toContain('cloudBackupConnectedAs');
        expect(root.querySelector<HTMLElement>('[data-role="cloud-backup-google-drive-status"]')?.textContent).toContain('Liangbin Zhao');
        expect(root.querySelector<HTMLElement>('[data-role="cloud-backup-google-drive-status"]')?.textContent).toContain('zhaoliangbin42@gmail.com');
        expect(root.querySelector<HTMLElement>('[data-role="cloud-backup-google-drive-status"]')?.classList.contains('cloud-backup-row__status--connected')).toBe(true);
        expect(root.querySelector('[data-role="cloud-backup-provider-dropbox"]')).toBeNull();
        expect(root.querySelector('[data-role="cloud-backup-provider-jianguoyun"]')).toBeNull();
        expect(root.querySelector('.cloud-backup-row__text-button')).toBeNull();
        expect(root.querySelector('.export-backup-btn')).toBeNull();

        root.querySelector<HTMLButtonElement>('[data-role="cloud-backup-google-drive-settings"]')!.click();
        root.querySelector<HTMLButtonElement>('[data-role="cloud-backup-google-drive-backup-now"]')!.click();
        root.querySelector<HTMLButtonElement>('[data-role="cloud-backup-google-drive-restore"]')!.click();
        root.querySelector<HTMLButtonElement>('[data-role="cloud-backup-google-drive-disconnect"]')!.click();

        expect(cloudBackup.status).toHaveBeenCalledWith('googleDrive');
        expect(cloudBackup.openSettings).toHaveBeenCalledTimes(1);
        expect(cloudBackup.backupNow).toHaveBeenCalledWith('googleDrive');
        expect(cloudBackup.restore).toHaveBeenCalledWith('googleDrive');
        expect(cloudBackup.disconnect).toHaveBeenCalledWith('googleDrive');
        expect(onExportAllBookmarks).not.toHaveBeenCalled();
    });

    it('shares workspace card material while retaining tokenized backup status and actions', () => {
        const css = getBookmarksPanelCss();
        const cloudBackupCss = css.slice(css.indexOf('.settings-data-card'), css.indexOf('.settings-backup-warning'));

        expect(css).toContain(':host .settings-data-card');
        expect(css).toContain('var(--_workspace-card)');
        expect(cloudBackupCss).toContain('.cloud-backup-row__status--connected');
        expect(cloudBackupCss).toContain('.cloud-backup-row__status::before');
        expect(cloudBackupCss).toContain('.cloud-backup-row__actions');
        expect(cloudBackupCss).toContain('minmax(0, 1fr)');
        expect(cloudBackupCss).toContain('var(--aimd-');
        expect(cloudBackupCss).not.toContain('#');
    });

    it('omits the Google Drive login entry when the runtime has no cloud backup capability', () => {
        const modal = { confirm: vi.fn(async () => true), alert: vi.fn(async () => undefined), showCustom: vi.fn() } as any;

        const view = new SettingsTabView({
            modal,
            actions: {},
        });
        view.setState({
            settings: structuredClone(baseSettings),
            storageUsage: null,
        });

        const root = view.getElement();
        expect(root.querySelector('[data-role="settings-google-drive-backup-card"]')).toBeTruthy();
        expect(root.querySelector('[data-role="cloud-backup-google-drive-connect"]')).toBeNull();
        expect(root.querySelector('[data-role="cloud-backup-google-drive-row"]')).toBeNull();
    });

    it('shows a direct Google Drive login button when cloud backup is disconnected', async () => {
        const modal = { confirm: vi.fn(async () => true), alert: vi.fn(async () => undefined), showCustom: vi.fn() } as any;
        const cloudBackup = {
            status: vi.fn(async () => ({ configured: true, connected: false })),
            connect: vi.fn(async () => ({ connected: true })),
            openSettings: vi.fn(async () => undefined),
        };

        const view = new SettingsTabView({
            modal,
            actions: { cloudBackup },
        });
        view.setState({
            settings: structuredClone(baseSettings),
            storageUsage: null,
        });

        await Promise.resolve();

        const root = view.getElement();
        const loginButton = root.querySelector<HTMLButtonElement>('[data-role="cloud-backup-google-drive-connect"]')!;
        expect(loginButton).toBeTruthy();
        expect(loginButton.textContent).toContain('cloudBackupLoginGoogleDrive');
        expect(root.querySelector('[data-role="cloud-backup-google-drive-disconnect"]')).toBeNull();

        loginButton.click();
        await Promise.resolve();

        expect(cloudBackup.connect).toHaveBeenCalledWith('googleDrive');
    });

    it('shows a compact Google Drive configuration warning instead of raw build diagnostics', async () => {
        const modal = { confirm: vi.fn(async () => true), alert: vi.fn(async () => undefined), showCustom: vi.fn() } as any;
        const cloudBackup = {
            status: vi.fn(async () => ({
                configured: false,
                connected: false,
                lastError: 'Google Drive backup requires manifest.oauth2 client_id/scopes.',
            })),
        };

        const view = new SettingsTabView({
            modal,
            actions: { cloudBackup },
        });
        view.setState({
            settings: structuredClone(baseSettings),
            storageUsage: null,
        });

        await Promise.resolve();

        const status = view.getElement().querySelector<HTMLElement>('[data-role="cloud-backup-google-drive-status"]')!;
        expect(status.textContent).toBe('cloudBackupConfigMissingStatus');
        expect(status.title).toContain('manifest.oauth2');
        expect(status.classList.contains('cloud-backup-row__status--error')).toBe(true);
    });

    it('keeps cloud backup controls on shared settings and button styles', () => {
        const css = getBookmarksPanelCss();

        expect(css).not.toContain('cloud-backup-row__text-button');
        expect(css).not.toContain('export-backup-btn');
        expect(css).toContain('.settings-label strong');
        expect(css).toContain('.secondary-btn--primary');
    });


    it('wires formula Markdown and inline asset actions to scoped formula settings', () => {
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
        const clickFormatSelect = root.querySelector<HTMLButtonElement>('[data-role="settings-formula-click-copy-format"]')!;
        const markdownFormatSelect = root.querySelector<HTMLButtonElement>('[data-role="settings-formula-markdown-copy-format"]')!;
        const assetFontSizeInput = root.querySelector<HTMLInputElement>('[data-role="settings-formula-asset-font-size"]')!;
        const assetButton = root.querySelector<HTMLButtonElement>('[data-role="settings-formula-asset-actions"]')!;

        expect(markdownToggle.checked).toBe(true);
        expect(clickFormatSelect.textContent).toContain('formulaSourceFormatMarkdownDollar');
        expect(markdownFormatSelect.textContent).toContain('formulaSourceFormatMarkdownDollar');
        expect(root.querySelector('[data-role="settings-formula-rich-copy-format"]')).toBeNull();
        expect(assetFontSizeInput.type).toBe('range');
        expect(assetFontSizeInput.min).toBe('16');
        expect(assetFontSizeInput.max).toBe('72');
        expect(assetFontSizeInput.step).toBe('1');
        expect(assetFontSizeInput.value).toBe('36');
        markdownToggle.checked = false;
        markdownToggle.dispatchEvent(new Event('change', { bubbles: true }));
        expect(onSetFormulaSettings).toHaveBeenCalledWith({ clickCopyMarkdown: false });
        clickFormatSelect.click();
        root.querySelector<HTMLButtonElement>('[data-menu="formula-click-copy-format"][data-value="raw"]')!.click();
        expect(onSetFormulaSettings).toHaveBeenCalledWith({ clickCopyFormulaFormat: 'raw' });
        markdownFormatSelect.click();
        root.querySelector<HTMLButtonElement>('[data-menu="formula-markdown-copy-format"][data-value="latex-brackets"]')!.click();
        expect(onSetFormulaSettings).toHaveBeenCalledWith({ markdownCopyFormulaFormat: 'latex-brackets' });
        assetFontSizeInput.value = '44';
        assetFontSizeInput.dispatchEvent(new Event('change', { bubbles: true }));
        expect(onSetFormulaSettings).toHaveBeenCalledWith({ assetFontSizePx: 44 });

        expect(assetButton).toBeNull();
        const toggle = buttonSetting(view, 'Formula', 'formula.assetActions.copyPng');
        expect(toggle.getAttribute('aria-checked')).toBe('true');
        toggle.click();
        expect(onSetFormulaSettings).toHaveBeenLastCalledWith({ assetActions: { copyPng: false } });

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
        const exportCard = Array.from(root.querySelectorAll<HTMLElement>('.settings-card'))
            .find((card) => card.querySelector('[data-role="settings-export-png-width-preset"]'))
        const exportControls = exportCard?.querySelectorAll('[data-role^="settings-export-png-"]');
        const combinedRow = presetTrigger.closest<HTMLElement>('.settings-export-width-row');
        const controls = presetTrigger.closest<HTMLElement>('.settings-export-width-controls');

        expect(presetTrigger.textContent).toContain('Desktop');
        expect(widthInput.disabled).toBe(true);
        expect(widthInput.value).toBe('800');
        expect(combinedRow).toBeTruthy();
        expect(controls?.contains(widthInput)).toBe(true);
        expect(presetTrigger.closest('.settings-export-width-preset')).toBeTruthy();
        expect(widthInput.closest('.settings-export-width-value')).toBeTruthy();
        expect(widthInput.type).toBe('range');
        expect(widthInput.min).toBe('360');
        expect(widthInput.max).toBe('1200');
        expect(widthInput.step).toBe('20');
        expect(pixelRatioInput.value).toBe('1');
        expect(pixelRatioInput.type).toBe('range');
        expect(pixelRatioInput.min).toBe('1');
        expect(pixelRatioInput.max).toBe('3');
        expect(pixelRatioInput.step).toBe('0.5');
        expect(exportControls).toHaveLength(3);

        presetTrigger.click();
        root.querySelector<HTMLButtonElement>('.settings-select-option[data-value="custom"]')!.click();
        expect(widthInput.disabled).toBe(false);
        expect(widthInput.value).toBe('920');
        expect(onSetExportSettings).toHaveBeenCalledWith({ pngWidthPreset: 'custom' });

        widthInput.value = '410';
        widthInput.dispatchEvent(new Event('change', { bubbles: true }));
        expect(widthInput.value).toBe('420');
        expect(onSetExportSettings).toHaveBeenLastCalledWith({ pngCustomWidth: 420 });

        presetTrigger.click();
        root.querySelector<HTMLButtonElement>('.settings-select-option[data-value="mobile"]')!.click();
        expect(widthInput.disabled).toBe(true);
        expect(widthInput.value).toBe('390');
        expect(onSetExportSettings).toHaveBeenLastCalledWith({ pngWidthPreset: 'mobile' });

        pixelRatioInput.value = '2.7';
        pixelRatioInput.dispatchEvent(new Event('change', { bubbles: true }));
        expect(pixelRatioInput.value).toBe('2.5');
        expect(onSetExportSettings).toHaveBeenLastCalledWith({ pngPixelRatio: 2.5 });
    });

    it('renders global font size as a stepper-only advanced appearance setting', () => {
        const modal = { confirm: vi.fn(async () => true) } as any;
        const onSetAppearanceSettings = vi.fn(async () => undefined);

        const view = new SettingsTabView({ modal, actions: { setAppearanceSettings: onSetAppearanceSettings } });
        view.setState({
            settings: structuredClone(baseSettings),
            storageUsage: null,
        });

        const root = view.getElement();

        const value = root.querySelector<HTMLElement>('[data-role="settings-global-font-size-value"]')!;
        const field = value.closest<HTMLElement>('.settings-stepper-field')!;
        const buttons = Array.from(field.querySelectorAll<HTMLButtonElement>('button'));

        expect(value.textContent).toBe('16px');
        expect(field.querySelector('input')).toBeNull();

        buttons[1]!.click();
        expect(value.textContent).toBe('17px');
        expect(onSetAppearanceSettings).toHaveBeenLastCalledWith({ fontSizePx: 17 });

        buttons[0]!.click();
        expect(value.textContent).toBe('16px');
        expect(onSetAppearanceSettings).toHaveBeenLastCalledWith({ fontSizePx: 16 });
    });

    it('renders accent color as preview swatches and persists the selected swatch', () => {
        const modal = { confirm: vi.fn(async () => true) } as any;
        const onSetAppearanceSettings = vi.fn(async () => undefined);

        const view = new SettingsTabView({ modal, actions: { setAppearanceSettings: onSetAppearanceSettings } });
        view.setState({
            settings: { ...structuredClone(baseSettings), appearance: { fontSizePx: 16, accentColor: '#059669' } },
            storageUsage: null,
        });

        const root = view.getElement();

        const swatches = Array.from(root.querySelectorAll<HTMLButtonElement>('[data-role="settings-accent-color-swatch"]'));
        expect(swatches.some(button => button.dataset.color === '#2563eb')).toBe(false);
        expect(swatches.some(button => button.dataset.color === '#9333ea')).toBe(false);
        expect(swatches.some(button => button.dataset.color === '#f472b6')).toBe(true);
        expect(swatches.length).toBeGreaterThan(3);
        expect(swatches.some((button) => button.querySelector('.settings-color-swatch__preview'))).toBe(true);
        expect(swatches.find((button) => button.dataset.color === '#059669')?.dataset.selected).toBe('1');
        expect(root.querySelector('[data-role="settings-accent-color-input"]')).toBeNull();

        swatches.find((button) => button.dataset.color === '#7c3aed')!.click();

        expect(onSetAppearanceSettings).toHaveBeenLastCalledWith({ accentColor: '#7c3aed' });
        expect(swatches.find((button) => button.dataset.color === '#7c3aed')?.dataset.selected).toBe('1');
    });

    it.each(['#2563eb', '#9333ea'])('preserves removed preset %s as the selected custom color without writing settings', (accentColor) => {
        const setAppearanceSettings = vi.fn(async () => undefined);
        const view = new SettingsTabView({ modal: { confirm: vi.fn(async () => true) } as any, actions: { setAppearanceSettings } });
        view.setState({ settings: { ...structuredClone(baseSettings), appearance: { fontSizePx: 16, accentColor } }, storageUsage: null });
        const custom = view.getElement().querySelector<HTMLButtonElement>('[data-role="settings-accent-custom"]')!;
        expect(custom.dataset.selected).toBe('1');
        expect(custom.style.getPropertyValue('--_settings-accent-color')).toBe(accentColor);
        expect(setAppearanceSettings).not.toHaveBeenCalled();
    });

    it('keeps group headings at least as prominent as child item titles in settings typography', () => {
        const css = getBookmarksPanelCss();

        expect(css).toContain('.settings-catalog-header h2');
        expect(css).toContain('font-size: var(--aimd-text-base);');
        expect(css).toContain('.settings-label strong {');
        expect(css).toContain('font-size: var(--aimd-text-sm);');
        expect(css).toContain('.settings-select-trigger {');
        expect(css).toContain('font-size: var(--aimd-text-sm);');
        expect(css).toContain('.settings-label p');
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
        expect(css).toContain('flex: 0 1 260px;');
        expect(css).toContain('width: min(260px, 100%);');
        expect(css).toContain('.settings-slider-field {');
        expect(css).toContain('.settings-slider {');
        expect(css).toContain('.settings-export-width-preset .settings-select-trigger {');
        expect(css).toContain('min-width: 120px;');
        expect(css).toContain('.settings-export-pixel-ratio-value {');
        expect(css).toContain('width: min(240px, 100%);');
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
        expect(css).toContain('padding: var(--aimd-space-5) calc(var(--aimd-space-5) + var(--aimd-space-3)) var(--aimd-space-5) var(--aimd-space-5);');
        expect(css).toContain('max-width: 100%;');
        expect(css).toContain('.toggle-row,');
        expect(css).toContain('grid-template-columns: minmax(0, 1fr) max-content;');
        expect(css).toContain('width: 100%;');
        expect(css).toContain('.settings-label {');
        expect(css).toContain('flex: 1 1 auto;');
    });

    it('uses one settings scroll owner and a 980/720/560 workspace responsive contract', () => {
        const css = getBookmarksPanelCss();

        expect(css).toMatch(/\.settings-panel\s*\{[^}]*overflow:\s*hidden;/s);
        expect(css).toMatch(/\.settings-panel-scroll\s*\{[^}]*overflow-y:\s*auto;/s);
        expect(css).toContain('@media (max-width: 980px)');
        expect(css).toContain('@media (max-width: 720px)');
        expect(css).toContain('@media (max-width: 560px)');
        expect(css).toMatch(/@media \(max-width: 560px\)[\s\S]*?\.toggle-row,[\s\S]*?\.settings-row\s*\{[^}]*grid-template-columns:\s*minmax\(0, 1fr\);/s);
        expect(css).toMatch(/@media \(max-width: 560px\)[\s\S]*?\.settings-select-shell,[\s\S]*?\.settings-slider-field,[\s\S]*?\.settings-stepper-field\s*\{[^}]*width:\s*100%;/s);
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

        expect(css).toContain('.settings-label p');
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

    it('renders the content discovery diagnostics row and copies the snapshot', async () => {
        vi.useFakeTimers();
        try {
            const modal = { confirm: vi.fn(async () => true) } as any;
            const diagnosticsSnapshot = {
                schemaVersion: 1,
                generatedAt: Date.now(),
                basis: 'host',
                historyStatus: 'partial',
                repository: {
                    stateKind: 'ready',
                    documentKind: 'canonical',
                    basis: 'host',
                    epoch: 1,
                    turnCount: 3,
                },
                hostMonitor: {
                    stableCaptureCount: 4,
                    dirtyAssistantCount: 0,
                    compileRejections: { 'empty-content': 1 },
                },
            };
            const readDiscoveryDiagnostics = vi.fn(() => diagnosticsSnapshot as any);
            const writeText = vi.fn(async () => undefined);
            Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });

            const view = new SettingsTabView({ modal, readDiscoveryDiagnostics });
            const root = view.getElement();
            const summary = root.querySelector<HTMLElement>('[data-role="settings-discovery-diagnostics-summary"]');
            expect(summary).toBeTruthy();
            expect(summary!.textContent).toContain('basis=host');
            expect(summary!.textContent).toContain('history=partial');
            expect(summary!.textContent).toContain('turns=3');
            expect(summary!.textContent).toContain('rejected=1');
            expect(summary!.textContent).toContain('source=dom');

            const copy = root.querySelector<HTMLButtonElement>('[data-role="settings-discovery-diagnostics-copy"]');
            expect(copy).toBeTruthy();
            expect(copy!.hidden).toBe(false);
            copy!.click();
            await Promise.resolve();
            await Promise.resolve();
            expect(writeText).toHaveBeenCalledTimes(1);
            const written = JSON.parse(writeText.mock.calls[0]![0]);
            expect(written).toMatchObject({ historyStatus: 'partial', basis: 'host' });
            expect(copy!.textContent).toContain('Copied');
            vi.advanceTimersByTime(1_600);
            expect(copy!.textContent).not.toContain('Copied');
        } finally {
            vi.useRealTimers();
        }
    });

    it('shows unavailable diagnostics without a provider and hides the copy action', () => {
        const modal = { confirm: vi.fn(async () => true) } as any;
        const view = new SettingsTabView({ modal });
        const root = view.getElement();

        const summary = root.querySelector<HTMLElement>('[data-role="settings-discovery-diagnostics-summary"]');
        expect(summary).toBeTruthy();
        expect(summary!.textContent).toContain('settingsDiscoveryDiagnosticsUnavailable');
        const copy = root.querySelector<HTMLButtonElement>('[data-role="settings-discovery-diagnostics-copy"]');
        expect(copy!.hidden).toBe(true);
        const retry = root.querySelector<HTMLButtonElement>('[data-role="settings-discovery-diagnostics-retry"]');
        expect(retry).toBeNull();
    });
});
