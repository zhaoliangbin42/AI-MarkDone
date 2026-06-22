import { describe, expect, it, vi } from 'vitest';
import { getBookmarksPanelCss } from '@/ui/content/bookmarks/ui/styles/bookmarksPanelCss';
import { SettingsTabView } from '@/ui/content/bookmarks/ui/tabs/SettingsTabView';

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
        copyMarkdownDelimiters: true,
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
    },
    chatgptBehavior: {
        restorePositionAfterSend: true,
        enterKeyNewline: false,
        showMessageStepper: true,
        enableArrowKeyMessageNavigation: true,
        pageWidthScale: 100,
    },
    appearance: { fontSizePx: 16, accentColor: null },
    bookmarks: { sortMode: 'time-desc' },
    language: 'auto',
} as any;

describe('SettingsTabView', () => {
    it('groups toolbar, formula, and export settings under page actions while keeping Reader and ChatGPT settings separate', () => {
        const modal = { confirm: vi.fn(async () => true) } as any;
        const view = new SettingsTabView({ modal });
        view.setState({
            settings: structuredClone(baseSettings),
            storageUsage: null,
        });

        const root = view.getElement();
        const groupTitles = Array.from(root.querySelectorAll<HTMLElement>('.settings-group-title'))
            .map((title) => title.textContent?.replace(/\s+/g, ' ').trim());
        expect(groupTitles).toEqual([
            'platforms',
            'toolbarPageActionsSettingsLabel',
            'chatgptSettingsLabel',
            'settingsLanguageLabel',
            'dataManagement',
        ]);

        const pageActionsGroup = Array.from(root.querySelectorAll<HTMLElement>('.settings-group'))
            .find((group) => group.querySelector('.settings-group-title')?.textContent?.includes('toolbarPageActionsSettingsLabel'))!;
        expect(pageActionsGroup.querySelector('[data-role="settings-show-message-toolbar"]')).toBeTruthy();
        expect(pageActionsGroup.querySelector('[data-role="settings-show-save-messages"]')).toBeTruthy();
        expect(pageActionsGroup.querySelector('[data-role="settings-formula-click-copy-markdown"]')).toBeTruthy();
        expect(pageActionsGroup.querySelector('[data-role="settings-formula-copy-markdown-delimiters"]')).toBeTruthy();
        expect(pageActionsGroup.querySelector('[data-role="settings-formula-asset-font-size"]')).toBeTruthy();
        expect(pageActionsGroup.querySelector('[data-role="settings-export-png-width-preset"]')).toBeTruthy();

        expect(root.querySelector('[data-role="settings-reader-prompts"]')).toBeNull();
        expect(root.querySelector('[data-role="settings-render-code-reader"]')).toBeNull();

        const chatGptGroup = Array.from(root.querySelectorAll<HTMLElement>('.settings-group'))
            .find((group) => group.querySelector('.settings-group-title')?.textContent?.includes('chatgptSettingsLabel'))!;
        expect(chatGptGroup.querySelector('[data-role="settings-chatgpt-restore-position-after-send"]')).toBeTruthy();
        expect(chatGptGroup.querySelector('[data-role="settings-chatgpt-enter-key-newline"]')).toBeTruthy();
        expect(chatGptGroup.querySelector('[data-role="settings-chatgpt-show-message-stepper"]')).toBeTruthy();
        expect(chatGptGroup.querySelector('[data-role="settings-chatgpt-arrow-key-message-navigation"]')).toBeTruthy();
        expect(chatGptGroup.querySelector('[data-role="settings-chatgpt-page-width-scale"]')).toBeTruthy();
        expect(chatGptGroup.querySelector('[data-role="settings-chatgpt-directory-retired-notice"]')).toBeNull();
        expect(chatGptGroup.querySelector('[data-role="settings-chatgpt-directory-enabled"]')).toBeTruthy();
        expect(chatGptGroup.querySelector('[data-role="settings-chatgpt-directory-mode"]')).toBeTruthy();
        expect(chatGptGroup.querySelector('[data-role="settings-chatgpt-directory-prompt-label-mode"]')).toBeTruthy();
        expect(chatGptGroup.querySelector('[data-role="settings-chatgpt-directory-right-inset"]')).toBeTruthy();
        expect(chatGptGroup.querySelector('[data-role="settings-chatgpt-directory-hide-official-navigation"]')).toBeNull();
        expect(chatGptGroup.textContent).toContain('chatgptDirectoryEnabledDesc');
    });

    it('exposes ChatGPT full runtime and formula-only platform toggles', () => {
        const modal = { confirm: vi.fn(async () => true) } as any;
        const onSetPlatforms = vi.fn(async () => undefined);
        const view = new SettingsTabView({ modal, actions: { setPlatforms: onSetPlatforms } });
        view.setState({
            settings: structuredClone(baseSettings),
            storageUsage: null,
        });

        const root = view.getElement();

        expect(root.querySelector('[data-role="settings-platform-chatgpt"]')).toBeTruthy();
        expect(root.querySelector('[data-role="settings-platform-gemini"]')).toBeTruthy();
        expect(root.querySelector('[data-role="settings-platform-claude"]')).toBeTruthy();
        expect(root.querySelector('[data-role="settings-platform-deepseek"]')).toBeTruthy();
        expect(root.querySelector('[data-role="settings-platform-retirement-notice"]')).toBeNull();

        const gemini = root.querySelector<HTMLInputElement>('[data-role="settings-platform-gemini"]')!;
        gemini.checked = false;
        gemini.dispatchEvent(new Event('change', { bubbles: true }));

        expect(onSetPlatforms).toHaveBeenCalledWith({ gemini: false });
    });

    it('wires the master message toolbar toggle to behavior settings', () => {
        const modal = { confirm: vi.fn(async () => true) } as any;
        const onSetBehaviorSettings = vi.fn(async () => undefined);
        const view = new SettingsTabView({ modal, actions: { setBehaviorSettings: onSetBehaviorSettings } });
        view.setState({
            settings: structuredClone(baseSettings),
            storageUsage: null,
        });

        const toggle = view.getElement().querySelector<HTMLInputElement>('[data-role="settings-show-message-toolbar"]')!;
        expect(toggle.checked).toBe(true);

        toggle.checked = false;
        toggle.dispatchEvent(new Event('change', { bubbles: true }));

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

        expect(root.querySelector('[data-role="settings-chatgpt-directory-retired-notice"]')).toBeNull();
        expect(root.querySelector('[data-role="settings-chatgpt-directory-hide-official-navigation"]')).toBeNull();
        expect(enabled.checked).toBe(true);
        expect(mode.textContent).toContain('chatgptDirectoryModePreview');
        expect(promptLabelMode.checked).toBe(false);
        expect(rightInset.value).toBe('0');
        expect(rightInset.type).toBe('range');

        enabled.checked = false;
        enabled.dispatchEvent(new Event('change', { bubbles: true }));
        promptLabelMode.checked = true;
        promptLabelMode.dispatchEvent(new Event('change', { bubbles: true }));
        rightInset.value = '53';
        rightInset.dispatchEvent(new Event('change', { bubbles: true }));

        expect(onSetChatGptDirectorySettings).toHaveBeenCalledWith({ enabled: false });
        expect(onSetChatGptDirectorySettings).toHaveBeenCalledWith({ promptLabelMode: 'headTail' });
        expect(onSetChatGptDirectorySettings).toHaveBeenCalledWith({ rightInsetPx: 40 });
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
        expect(slider.value).toBe('100');

        slider.value = '147';
        slider.dispatchEvent(new Event('change', { bubbles: true }));

        expect(onSetChatGptBehaviorSettings).toHaveBeenCalledWith({ pageWidthScale: 145 });
        expect(slider.value).toBe('145');
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

    it('wires ChatGPT Enter-newline behavior to the scoped behavior category', () => {
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
        const toggle = root.querySelector<HTMLInputElement>('[data-role="settings-chatgpt-enter-key-newline"]')!;

        expect(toggle.checked).toBe(false);

        toggle.checked = true;
        toggle.dispatchEvent(new Event('change', { bubbles: true }));

        expect(onSetChatGptBehaviorSettings).toHaveBeenCalledWith({ enterKeyNewline: true });
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

    it('lets users hide the lower-right ChatGPT message stepper buttons', () => {
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
        const toggle = root.querySelector<HTMLInputElement>('[data-role="settings-chatgpt-show-message-stepper"]')!;

        expect(toggle.checked).toBe(true);

        toggle.checked = false;
        toggle.dispatchEvent(new Event('change', { bubbles: true }));

        expect(onSetChatGptBehaviorSettings).toHaveBeenCalledWith({ showMessageStepper: false });
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
        const exportButton = root.querySelector<HTMLButtonElement>('[data-role="settings-export-all-bookmarks"]');

        expect(root.classList.contains('aimd-settings')).toBe(true);
        expect(platformIcons).toHaveLength(4);
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
        const group = Array.from(root.querySelectorAll<HTMLElement>('.settings-group'))
            .find((candidate) => candidate.querySelector('.settings-group-title')?.textContent?.includes('dataManagement'))!;
        const cards = Array.from(group.querySelectorAll<HTMLElement>('.settings-data-card'));
        const googleDriveRow = root.querySelector<HTMLElement>('[data-role="cloud-backup-google-drive-row"]')!;
        await Promise.resolve();

        expect(group.classList.contains('settings-card')).toBe(false);
        expect(cards).toHaveLength(2);
        expect(cards[0].dataset.role).toBe('settings-google-drive-backup-card');
        expect(cards[0].textContent).toContain('googleDriveBackupCardTitle');
        expect(cards[0].textContent).toContain('cloudBackupExperimentalLabel');
        expect(cards[0].textContent?.toLowerCase()).not.toContain('sync');
        expect(cards[1].dataset.role).toBe('settings-data-backup-card');
        expect(cards[1].textContent).toContain('localBackupCardTitle');
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

    it('keeps the Google Drive backup card polished with tokenized status and action styling', () => {
        const css = getBookmarksPanelCss();
        const cloudBackupCss = css.slice(css.indexOf('.settings-data-card[data-role="settings-google-drive-backup-card"]'), css.indexOf('.settings-backup-warning'));

        expect(cloudBackupCss).toContain('.settings-data-card[data-role="settings-google-drive-backup-card"]');
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
        const delimiterToggle = root.querySelector<HTMLInputElement>('[data-role="settings-formula-copy-markdown-delimiters"]')!;
        const assetFontSizeInput = root.querySelector<HTMLInputElement>('[data-role="settings-formula-asset-font-size"]')!;
        const assetButton = root.querySelector<HTMLButtonElement>('[data-role="settings-formula-asset-actions"]')!;

        expect(markdownToggle.checked).toBe(true);
        expect(delimiterToggle.checked).toBe(true);
        expect(assetFontSizeInput.value).toBe('36');
        markdownToggle.checked = false;
        markdownToggle.dispatchEvent(new Event('change', { bubbles: true }));
        expect(onSetFormulaSettings).toHaveBeenCalledWith({ clickCopyMarkdown: false });
        delimiterToggle.checked = false;
        delimiterToggle.dispatchEvent(new Event('change', { bubbles: true }));
        expect(onSetFormulaSettings).toHaveBeenCalledWith({ copyMarkdownDelimiters: false });
        assetFontSizeInput.value = '44';
        assetFontSizeInput.dispatchEvent(new Event('change', { bubbles: true }));
        expect(onSetFormulaSettings).toHaveBeenCalledWith({ assetFontSizePx: 44 });

        assetButton.click();
        const popover = root.querySelector<HTMLElement>('.formula-asset-settings');
        expect(popover).toBeTruthy();
        const toggles = Array.from(root.querySelectorAll<HTMLInputElement>('[data-role^="settings-formula-asset-action-"]'));
        expect(toggles.map((input) => input.dataset.role)).toEqual([
            'settings-formula-asset-action-copy-png',
            'settings-formula-asset-action-copy-svg',
            'settings-formula-asset-action-copy-mathml',
            'settings-formula-asset-action-save-png',
            'settings-formula-asset-action-save-svg',
        ]);

        toggles[0]!.checked = false;
        toggles[0]!.dispatchEvent(new Event('change', { bubbles: true }));
        expect(onSetFormulaSettings).toHaveBeenLastCalledWith({
            assetActions: {
                copyPng: false,
                copySvg: true,
                copyMathml: true,
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
        expect(pixelRatioInput.value).toBe('1');
        expect(exportControls).toHaveLength(3);

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

    it('does not expose Reader-specific settings in the Settings page', () => {
        const modal = { confirm: vi.fn(async () => true) } as any;

        const view = new SettingsTabView({ modal });
        view.setState({
            settings: structuredClone(baseSettings),
            storageUsage: null,
        });

        const root = view.getElement();
        const advancedButton = root.querySelector<HTMLButtonElement>('[data-role="settings-advanced-toggle"]')!;

        expect(advancedButton).toBeTruthy();
        expect(root.querySelector('[data-role="settings-reader-content-width"]')).toBeNull();
        expect(root.querySelector('[data-role="settings-reader-show-outline"]')).toBeNull();
        expect(root.querySelector('[data-role="settings-reader-prompt-position-bottom"]')).toBeNull();
        expect(root.querySelector('[data-role="settings-reader-template"]')).toBeNull();

        advancedButton.click();
        expect(root.querySelector('[data-role="settings-reader-content-width"]')).toBeNull();
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
        root.querySelector<HTMLButtonElement>('[data-role="settings-advanced-toggle"]')!.click();

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
        root.querySelector<HTMLButtonElement>('[data-role="settings-advanced-toggle"]')!.click();

        const swatches = Array.from(root.querySelectorAll<HTMLButtonElement>('[data-role="settings-accent-color-swatch"]'));
        expect(swatches.length).toBeGreaterThan(3);
        expect(swatches.some((button) => button.querySelector('.settings-color-swatch__preview'))).toBe(true);
        expect(swatches.find((button) => button.dataset.color === '#059669')?.dataset.selected).toBe('1');
        expect(root.querySelector('[data-role="settings-accent-color-input"]')).toBeNull();

        swatches.find((button) => button.dataset.color === '#7c3aed')!.click();

        expect(onSetAppearanceSettings).toHaveBeenLastCalledWith({ accentColor: '#7c3aed' });
        expect(swatches.find((button) => button.dataset.color === '#7c3aed')?.dataset.selected).toBe('1');
    });

    it('keeps group headings at least as prominent as child item titles in settings typography', () => {
        const css = getBookmarksPanelCss();

        expect(css).toContain('.card-title {');
        expect(css).toContain('font-size: var(--aimd-text-base);');
        expect(css).toContain('.settings-label strong {');
        expect(css).toContain('font-size: var(--aimd-text-sm);');
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
