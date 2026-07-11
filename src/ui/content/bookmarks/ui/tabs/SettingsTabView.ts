import type { AppSettings } from '../../../../../core/settings/types';
import {
    CHATGPT_DIRECTORY_RIGHT_INSET_STEP_PX,
    CHATGPT_PAGE_WIDTH_SCALE_STEP,
    DEFAULT_SETTINGS,
    DEFAULT_GLOBAL_FONT_SIZE_PX,
    MAX_CHATGPT_DIRECTORY_RIGHT_INSET_PX,
    MAX_CHATGPT_PAGE_WIDTH_SCALE,
    GLOBAL_FONT_SIZE_STEP_PX,
    MAX_GLOBAL_FONT_SIZE_PX,
    MIN_CHATGPT_DIRECTORY_RIGHT_INSET_PX,
    MIN_CHATGPT_PAGE_WIDTH_SCALE,
    MIN_GLOBAL_FONT_SIZE_PX,
    THEME_ACCENT_SWATCHES,
    type ThemeAccentColor,
} from '../../../../../core/settings/types';
import {
    normalizeChatGPTDirectoryRightInsetPx,
    normalizeChatGPTDirectorySettings,
    normalizeChatGPTPageWidthScale,
    normalizeReaderOpenMode,
    normalizeThemeAccentColor,
} from '../../../../../core/settings/migrations';
import {
    MAX_PNG_EXPORT_PIXEL_RATIO,
    MAX_PNG_EXPORT_WIDTH,
    MIN_PNG_EXPORT_PIXEL_RATIO,
    MIN_PNG_EXPORT_WIDTH,
    PNG_EXPORT_PIXEL_RATIO_STEP,
    PNG_EXPORT_WIDTH_STEP,
    normalizePngCustomWidth,
    normalizePngPixelRatio,
    resolvePngExportPixelRatio,
    resolvePngExportWidth,
    type PngExportWidthPreset,
} from '../../../../../core/settings/export';
import type { BookmarksStorageUsageResponse } from '../../../../../contracts/protocol';
import {
    DEFAULT_FORMULA_SETTINGS,
    FORMULA_ASSET_FONT_SIZE_STEP_PX,
    MAX_FORMULA_ASSET_FONT_SIZE_PX,
    MIN_FORMULA_ASSET_FONT_SIZE_PX,
    normalizeLegacyClickCopyFormulaFormat,
    normalizeFormulaAssetFontSizePx,
    type FormulaSettings,
} from '../../../../../core/settings/formula';
import { normalizeFormulaSourceFormat, type FormulaSourceFormat } from '../../../../../core/math/formulaSourceFormat';
import type { ModalHost } from '../../../components/ModalHost';
import { setLocale, t } from '../../../components/i18n';
import { createIcon } from '../../../components/Icon';
import { Icons } from '../../../../../assets/icons';
import {
    installTransientOutsideDismissBoundary,
    type TransientOutsideDismissBoundaryHandle,
} from '../../../components/transientUi';
import { createBookmarksInlineSelect, createBookmarksInlineSelectControl } from '../components/BookmarksInlineSelect';
import { FormulaAssetSettingsPopover } from '../popovers/FormulaAssetSettingsPopover';
import { CloudBackupSettingsPanel, type CloudBackupSettingsPanelActions } from '../cloudBackup/CloudBackupSettingsPanel';
import { createDefaultCommentTemplate, type CommentTemplateSegment } from '../../../../../core/settings/readerCommentExport';
import { buildCommentsExport, normalizeCommentTemplate, normalizeReaderCommentExportSettings } from '../../../../../services/reader/commentExport';
import { ReaderCommentTemplateSettingsPopover } from '../../../reader/ReaderCommentTemplateSettingsPopover';

export type SettingsTabViewActions = {
    loadState?: () => Promise<{ settings: AppSettings; storageUsage: BookmarksStorageUsageResponse | null } | null>;
    setPlatforms?: (patch: Partial<AppSettings['platforms']>) => Promise<void> | void;
    setBehaviorSettings?: (patch: Partial<AppSettings['behavior']>) => Promise<void> | void;
    setReaderSettings?: (patch: Partial<AppSettings['reader']>) => Promise<void> | void;
    setFormulaSettings?: (patch: Partial<AppSettings['formula']>) => Promise<void> | void;
    setExportSettings?: (patch: Partial<AppSettings['export']>) => Promise<void> | void;
    setChatGptDirectorySettings?: (patch: Partial<AppSettings['chatgptDirectory']>) => Promise<void> | void;
    setChatGptBehaviorSettings?: (patch: Partial<AppSettings['chatgptBehavior']>) => Promise<void> | void;
    setAppearanceSettings?: (patch: Partial<AppSettings['appearance']>) => Promise<void> | void;
    setLanguage?: (value: AppSettings['language']) => Promise<void> | void;
    exportAllBookmarks?: () => Promise<void> | void;
    cloudBackup?: CloudBackupSettingsPanelActions;
};

type SelectRef = {
    root: HTMLElement;
    shell: HTMLElement;
    trigger: HTMLButtonElement;
    triggerLabel: HTMLElement;
    menu: HTMLElement;
    getValue: () => string;
    setValue: (value: string) => void;
    close: () => void;
    onChange: (listener: (value: string) => void) => void;
};

type SliderFieldRef = {
    root: HTMLElement;
    field: HTMLElement;
    input: HTMLInputElement;
    value: HTMLElement;
    format: (value: number) => string;
};

type StepperFieldRef = {
    root: HTMLElement;
    field: HTMLElement;
    decrease: HTMLButtonElement;
    increase: HTMLButtonElement;
    value: HTMLElement;
};

type Refs = {
    platforms: Record<keyof AppSettings['platforms'], HTMLInputElement>;
    behavior: {
        showMessageToolbar: HTMLInputElement;
        showSaveMessages: HTMLInputElement;
        showWordCount: HTMLInputElement;
        saveContextOnly: HTMLInputElement;
    };
    formula: {
        clickCopyMarkdown: HTMLInputElement;
        clickCopyFormulaFormat: SelectRef;
        markdownCopyFormulaFormat: SelectRef;
        assetActionsButton: HTMLButtonElement;
        assetActionsSummary: HTMLElement;
        assetFontSize: SliderFieldRef;
    };
    advanced: {
        root: HTMLElement;
        button: HTMLButtonElement;
        body: HTMLElement;
        fontSize?: StepperFieldRef;
    };
    export: {
        pngWidthPreset: SelectRef;
        pngWidth: SliderFieldRef;
        pngPixelRatio: SliderFieldRef;
    };
    chatgptDirectory: {
        restorePositionAfterSend: HTMLInputElement;
        enterKeyNewline: HTMLInputElement;
        promptAutocomplete: HTMLInputElement;
        showMessageStepper: HTMLInputElement;
        showPageBookmarkControl: HTMLInputElement;
        showDetachedReaderControl: HTMLInputElement;
        showPromptControl: HTMLInputElement;
        arrowKeyMessageNavigation: HTMLInputElement;
        pageWidthScale: SliderFieldRef;
        enabled: HTMLInputElement;
        mode: SelectRef;
        promptLabelMode: HTMLInputElement;
        rightInset: SliderFieldRef;
    };
    reader: {
        defaultOpenMode: SelectRef;
        renderCode: HTMLInputElement;
        showOutline: HTMLInputElement;
        promptPositionBottom: HTMLInputElement;
        commentSortMode: SelectRef;
        promptsButton: HTMLButtonElement;
        promptsSummary: HTMLElement;
        templateButton: HTMLButtonElement;
        templateSummary: HTMLElement;
    };
    language: SelectRef;
    storageText: HTMLElement;
};

export class SettingsTabView {
    private root: HTMLElement;
    private modal: ModalHost;
    private actions: SettingsTabViewActions;
    private settings: AppSettings = { ...DEFAULT_SETTINGS };
    private storageUsage: BookmarksStorageUsageResponse | null = null;
    private refs: Refs;
    private selectRefs: SelectRef[] = [];
    private readonly formulaAssetSettingsPopover = new FormulaAssetSettingsPopover();
    private readonly readerCommentTemplateSettingsPopover = new ReaderCommentTemplateSettingsPopover();
    private readonly outsideDismissBoundary: TransientOutsideDismissBoundaryHandle;
    private advancedExpanded = false;
    private mainPageRoot: HTMLElement | null = null;
    private buttonsPageRoot: HTMLElement | null = null;

    constructor(params: { modal: ModalHost; actions?: SettingsTabViewActions; onOpenPromptManager?: (anchor: HTMLElement) => Promise<void> | void }) {
        this.modal = params.modal;
        this.actions = params.actions ?? {};
        this.onOpenPromptManager = params.onOpenPromptManager;

        this.root = document.createElement('div');
        this.root.className = 'aimd-settings';
        this.outsideDismissBoundary = installTransientOutsideDismissBoundary({
            eventTarget: document,
            roots: () => this.selectRefs.map((selectRef) => selectRef.root),
            onDismiss: () => this.dismissTransientUi(),
        });

        const scroll = document.createElement('div');
        scroll.className = 'aimd-scroll settings-panel-scroll';

        const content = document.createElement('div');
        content.className = 'settings-grid settings-content';

        // Platforms group
        const platformsGroup = this.createGroup(Icons.globe, t('platforms'));
        const platforms = {
            chatgpt: this.createToggle(platformsGroup.body, `${Icons.chatgpt} ChatGPT`, t('enableOnChatGPT')),
            gemini: this.createToggle(platformsGroup.body, `${Icons.gemini} Gemini`, t('enableFormulaOnlyOnGemini')),
            claude: this.createToggle(platformsGroup.body, `${Icons.claude} Claude`, t('enableFormulaOnlyOnClaude')),
            deepseek: this.createToggle(platformsGroup.body, `${Icons.deepseek} DeepSeek`, t('enableFormulaOnlyOnDeepSeek')),
        };

        const buttonsEntryGroup = this.createGroup(Icons.settings, t('buttonsEntrypointsSettingsLabel'));
        const buttonsEntry = this.createActionRow(
            buttonsEntryGroup.body,
            t('buttonsEntrypointsSettingsLabel'),
            t('buttonsEntrypointsSettingsDesc'),
            'settings-buttons-page-entry',
        );

        const buttonsContent = document.createElement('div');
        buttonsContent.className = 'settings-grid settings-content settings-secondary-page';
        buttonsContent.hidden = true;
        buttonsContent.dataset.role = 'settings-buttons-page';
        const buttonsHeader = document.createElement('div');
        buttonsHeader.className = 'settings-secondary-header';
        const buttonsBack = document.createElement('button');
        buttonsBack.type = 'button';
        buttonsBack.className = 'secondary-btn settings-secondary-back';
        buttonsBack.dataset.role = 'settings-buttons-page-back';
        buttonsBack.textContent = t('btnBack');
        const buttonsTitle = document.createElement('h3');
        buttonsTitle.className = 'card-title settings-secondary-title';
        buttonsTitle.innerHTML = `${Icons.settings}<span>${t('buttonsEntrypointsSettingsLabel')}</span>`;
        buttonsHeader.append(buttonsBack, buttonsTitle);

        const buttonsGroup = this.createGroup(Icons.settings, t('buttonsEntrypointsSettingsLabel'));
        const showMessageToolbar = this.createToggle(buttonsGroup.body, t('messageToolbarLabel'), t('messageToolbarDesc'));
        const showSaveMessages = this.createToggle(buttonsGroup.body, t('saveMessagesLabel'), t('saveMessagesDesc'));
        const showWordCount = this.createToggle(buttonsGroup.body, t('wordCountLabel'), t('wordCountDesc'));
        const chatGptShowPageBookmarkControl = this.createToggle(
            buttonsGroup.body,
            t('chatgptShowPageBookmarkControlLabel'),
            t('chatgptShowPageBookmarkControlDesc'),
        );
        const chatGptShowDetachedReaderControl = this.createToggle(
            buttonsGroup.body,
            t('chatgptShowDetachedReaderControlLabel'),
            t('chatgptShowDetachedReaderControlDesc'),
        );
        const chatGptShowPromptControl = this.createToggle(
            buttonsGroup.body,
            t('chatgptShowPromptControlLabel'),
            t('chatgptShowPromptControlDesc'),
        );
        const chatGptShowMessageStepper = this.createToggle(
            buttonsGroup.body,
            t('chatgptShowMessageStepperLabel'),
            t('chatgptShowMessageStepperDesc'),
        );
        const formulaAssetActions = this.createActionRow(
            buttonsGroup.body,
            t('formulaAssetActionsLabel'),
            t('formulaAssetActionsDesc'),
            'settings-formula-asset-actions',
        );
        buttonsContent.append(buttonsHeader, buttonsGroup.root);

        const chatGptDirectoryGroup = this.createGroup(Icons.chatgpt, t('chatgptReadingInputSettingsLabel'));
        const chatGptDirectoryEnabled = this.createToggle(
            chatGptDirectoryGroup.body,
            t('chatgptDirectoryEnabledLabel'),
            t('chatgptDirectoryEnabledDesc'),
        );
        const chatGptDirectoryMode = this.createSelect(
            chatGptDirectoryGroup.body,
            t('chatgptDirectoryModeLabel'),
            t('chatgptDirectoryModeDesc'),
            [
                { value: 'preview', label: t('chatgptDirectoryModePreview') },
                { value: 'expanded', label: t('chatgptDirectoryModeExpanded') },
            ],
            'chatgpt-directory-mode',
        );
        const chatGptDirectoryPromptLabelMode = this.createToggle(
            chatGptDirectoryGroup.body,
            t('chatgptDirectoryPromptLabelModeLabel'),
            t('chatgptDirectoryPromptLabelModeDesc'),
        );
        const chatGptDirectoryRightInset = this.createSliderRow(
            chatGptDirectoryGroup.body,
            t('chatgptDirectoryRightInsetLabel'),
            t('chatgptDirectoryRightInsetDesc'),
            MIN_CHATGPT_DIRECTORY_RIGHT_INSET_PX,
            MAX_CHATGPT_DIRECTORY_RIGHT_INSET_PX,
            CHATGPT_DIRECTORY_RIGHT_INSET_STEP_PX,
            'settings-chatgpt-directory-right-inset-value',
            (value) => `${value}px`,
        );
        const chatGptRestorePositionAfterSend = this.createToggle(
            chatGptDirectoryGroup.body,
            t('chatgptRestorePositionAfterSendLabel'),
            t('chatgptRestorePositionAfterSendDesc'),
        );
        const chatGptEnterKeyNewline = this.createToggle(
            chatGptDirectoryGroup.body,
            t('chatgptEnterKeyNewlineLabel'),
            t('chatgptEnterKeyNewlineDesc'),
        );
        const chatGptPromptAutocomplete = this.createToggle(
            chatGptDirectoryGroup.body,
            t('chatgptPromptAutocompleteLabel'),
            t('chatgptPromptAutocompleteDesc'),
        );
        const chatGptArrowKeyMessageNavigation = this.createToggle(
            chatGptDirectoryGroup.body,
            t('chatgptArrowKeyMessageNavigationLabel'),
            t('chatgptArrowKeyMessageNavigationDesc'),
        );
        const chatGptPageWidthScale = this.createSliderRow(
            chatGptDirectoryGroup.body,
            t('chatgptPageWidthScaleLabel'),
            t('chatgptPageWidthScaleDesc'),
            MIN_CHATGPT_PAGE_WIDTH_SCALE,
            MAX_CHATGPT_PAGE_WIDTH_SCALE,
            CHATGPT_PAGE_WIDTH_SCALE_STEP,
            'settings-chatgpt-page-width-scale-value',
            (value) => value <= MIN_CHATGPT_PAGE_WIDTH_SCALE ? t('chatgptPageWidthScaleNormal') : `${value}%`,
        );

        const readerGroup = this.createGroup(Icons.bookOpen, t('readerWorkflowSettingsLabel'));
        const readerDefaultOpenMode = this.createSelect(
            readerGroup.body,
            t('readerDefaultOpenModeLabel'),
            t('readerDefaultOpenModeDesc'),
            [
                { value: 'fullscreen', label: t('readerOpenModeFullscreen') },
                { value: 'panel', label: t('readerOpenModePanel') },
            ],
            'reader-default-open-mode',
        );
        const readerRenderCode = this.createToggle(readerGroup.body, t('renderCodeBlocksLabel'), t('renderCodeBlocksDesc'));
        const readerShowOutline = this.createToggle(readerGroup.body, t('readerOutlineToggleLabel'), t('readerOutlineToggleDesc'));
        const readerPromptPositionBottom = this.createToggle(
            readerGroup.body,
            t('readerCommentPromptPositionBottomLabel'),
            t('readerCommentPromptPositionBottomDesc'),
        );
        const readerCommentSortMode = this.createSelect(
            readerGroup.body,
            t('readerCommentSortModeLabel'),
            t('readerCommentSortModeDesc'),
            [
                { value: 'created', label: t('readerCommentSortCreated') },
                { value: 'position', label: t('readerCommentSortPosition') },
            ],
            'reader-comment-sort-mode',
        );
        const readerPrompts = this.createActionRow(
            readerGroup.body,
            t('readerCommentPromptListLabel'),
            t('readerCommentPromptListDesc'),
            'settings-reader-prompts',
        );
        const readerTemplate = this.createActionRow(
            readerGroup.body,
            t('readerCommentTemplateSettingsLabel'),
            t('readerCommentTemplateSettingsDesc'),
            'settings-reader-comment-template',
        );

        const copyExportGroup = this.createGroup(Icons.copy, t('copyFormulaExportSettingsLabel'));
        const saveContextOnly = this.createToggle(copyExportGroup.body, t('contextOnlySaveLabel'), t('contextOnlySaveDesc'));
        const formulaClickCopyMarkdown = this.createToggle(
            copyExportGroup.body,
            t('formulaClickCopyMarkdownLabel'),
            t('formulaClickCopyMarkdownDesc'),
        );
        const formulaClickCopyFormulaFormat = this.createSelect(
            copyExportGroup.body,
            t('formulaClickCopyFormulaFormatLabel'),
            t('formulaClickCopyFormulaFormatDesc'),
            this.getFormulaSourceFormatOptions(),
            'formula-click-copy-format',
        );
        const formulaMarkdownCopyFormulaFormat = this.createSelect(
            copyExportGroup.body,
            t('formulaMarkdownCopyFormulaFormatLabel'),
            t('formulaMarkdownCopyFormulaFormatDesc'),
            this.getFormulaSourceFormatOptions(),
            'formula-markdown-copy-format',
        );
        const formulaAssetFontSize = this.createSliderRow(
            copyExportGroup.body,
            t('formulaAssetFontSizeLabel'),
            t('formulaAssetFontSizeDesc'),
            MIN_FORMULA_ASSET_FONT_SIZE_PX,
            MAX_FORMULA_ASSET_FONT_SIZE_PX,
            FORMULA_ASSET_FONT_SIZE_STEP_PX,
            'settings-formula-asset-font-size-value',
            (value) => `${value}px`,
        );

        const pngExportWidth = this.createPngExportWidthRow(
            copyExportGroup.body,
            t('pngExportWidthPresetLabel'),
            t('pngExportWidthPresetDesc'),
            [
                { value: 'mobile', label: t('pngExportWidthPresetMobile') },
                { value: 'tablet', label: t('pngExportWidthPresetTablet') },
                { value: 'desktop', label: t('pngExportWidthPresetDesktop') },
                { value: 'custom', label: t('pngExportWidthPresetCustom') },
            ],
            'png-width-preset',
            MIN_PNG_EXPORT_WIDTH,
            MAX_PNG_EXPORT_WIDTH,
            PNG_EXPORT_WIDTH_STEP,
        );
        const pngPixelRatio = this.createSliderRow(
            copyExportGroup.body,
            t('pngExportPixelRatioLabel'),
            t('pngExportPixelRatioDesc'),
            MIN_PNG_EXPORT_PIXEL_RATIO,
            MAX_PNG_EXPORT_PIXEL_RATIO,
            PNG_EXPORT_PIXEL_RATIO_STEP,
            'settings-export-pixel-ratio-value',
            (value) => `${value}x`,
        );
        // Language group
        const languageGroup = this.createGroup(Icons.languages, t('settingsLanguageLabel'));
        const language = this.createSelect(languageGroup.body, t('settingsLanguageLabel'), t('settingsLanguageDesc'), [
            { value: 'auto', label: t('languageAuto') },
            { value: 'en', label: t('languageEnglish') },
            { value: 'zh_CN', label: t('languageZhCN') },
        ], 'language');

        // Data management group (Google Drive backup + local backup/export)
        const storageGroup = this.createSection(Icons.database, t('dataManagement'));
        const googleDriveBackupCard = document.createElement('section');
        googleDriveBackupCard.className = 'settings-data-card';
        googleDriveBackupCard.dataset.role = 'settings-google-drive-backup-card';
        const googleDriveBackupTitle = document.createElement('h4');
        googleDriveBackupTitle.className = 'settings-data-card__title';
        googleDriveBackupTitle.textContent = `${t('googleDriveBackupCardTitle')} (${t('cloudBackupExperimentalLabel')})`;
        googleDriveBackupCard.appendChild(googleDriveBackupTitle);
        if (this.actions.cloudBackup) {
            const cloudBackup = new CloudBackupSettingsPanel({
                modal: this.modal,
                actions: this.actions.cloudBackup,
            });
            googleDriveBackupCard.appendChild(cloudBackup.getElement());
        }
        storageGroup.body.appendChild(googleDriveBackupCard);

        const backupCard = document.createElement('section');
        backupCard.className = 'settings-data-card';
        backupCard.dataset.role = 'settings-data-backup-card';
        const backupTitle = document.createElement('h4');
        backupTitle.className = 'settings-data-card__title';
        backupTitle.textContent = t('localBackupCardTitle');
        backupCard.appendChild(backupTitle);

        const storageInfo = document.createElement('div');
        storageInfo.className = 'settings-storage-info';
        storageInfo.innerHTML = `
            <div class="storage-header">
              <span class="storage-label">${t('storageUsedLabel')}</span>
              <span class="storage-value" data-field="storage_usage">${t('storageCalculating')}</span>
            </div>
            <div class="storage-progress-track">
              <div class="storage-fill storage-progress-bar" data-field="storage_bar" style="width: 0%"></div>
            </div>
        `;
        backupCard.appendChild(storageInfo);

        const backup = document.createElement('div');
        backup.className = 'settings-row settings-item settings-backup-warning';
        backup.dataset.role = 'settings-local-backup-row';
        const backupInfo = document.createElement('div');
        backupInfo.className = 'settings-label settings-item-info';
        const backupLabel = document.createElement('strong');
        backupLabel.textContent = t('localBackupTitle');
        const backupDesc = document.createElement('p');
        backupDesc.textContent = t('backupWarning');
        backupInfo.append(backupLabel, backupDesc);
        const exportBtn = document.createElement('button');
        exportBtn.type = 'button';
        exportBtn.className = 'secondary-btn';
        exportBtn.dataset.role = 'settings-export-all-bookmarks';
        exportBtn.innerHTML = `${Icons.download} ${t('exportAllBtn')}`;
        exportBtn.addEventListener('click', () => void this.actions.exportAllBookmarks?.());
        backup.append(backupInfo, exportBtn);
        backupCard.appendChild(backup);
        storageGroup.body.appendChild(backupCard);

        const advancedGroup = this.createAdvancedSettingsGroup();

        content.append(
            platformsGroup.root,
            buttonsEntryGroup.root,
            chatGptDirectoryGroup.root,
            readerGroup.root,
            copyExportGroup.root,
            languageGroup.root,
            storageGroup.root,
            advancedGroup.root,
        );
        scroll.append(content, buttonsContent);
        this.root.appendChild(scroll);
        this.mainPageRoot = content;
        this.buttonsPageRoot = buttonsContent;
        buttonsEntry.button.addEventListener('click', () => this.showSettingsPage('buttons'));
        buttonsBack.addEventListener('click', () => this.showSettingsPage('main'));

        const storageText = storageInfo.querySelector<HTMLElement>('[data-field="storage_usage"]')!;

        this.refs = {
            platforms: {
                chatgpt: platforms.chatgpt.input,
                gemini: platforms.gemini.input,
                claude: platforms.claude.input,
                deepseek: platforms.deepseek.input,
            },
            behavior: {
                showMessageToolbar: showMessageToolbar.input,
                showSaveMessages: showSaveMessages.input,
                showWordCount: showWordCount.input,
                saveContextOnly: saveContextOnly.input,
            },
            formula: {
                clickCopyMarkdown: formulaClickCopyMarkdown.input,
                clickCopyFormulaFormat: formulaClickCopyFormulaFormat,
                markdownCopyFormulaFormat: formulaMarkdownCopyFormulaFormat,
                assetActionsButton: formulaAssetActions.button,
                assetActionsSummary: formulaAssetActions.summary,
                assetFontSize: formulaAssetFontSize,
            },
            advanced: advancedGroup,
            export: {
                pngWidthPreset: pngExportWidth.preset,
                pngWidth: pngExportWidth.width,
                pngPixelRatio,
            },
            chatgptDirectory: {
                restorePositionAfterSend: chatGptRestorePositionAfterSend.input,
                enterKeyNewline: chatGptEnterKeyNewline.input,
                promptAutocomplete: chatGptPromptAutocomplete.input,
                showMessageStepper: chatGptShowMessageStepper.input,
                showPageBookmarkControl: chatGptShowPageBookmarkControl.input,
                showDetachedReaderControl: chatGptShowDetachedReaderControl.input,
                showPromptControl: chatGptShowPromptControl.input,
                arrowKeyMessageNavigation: chatGptArrowKeyMessageNavigation.input,
                pageWidthScale: chatGptPageWidthScale,
                enabled: chatGptDirectoryEnabled.input,
                mode: chatGptDirectoryMode,
                promptLabelMode: chatGptDirectoryPromptLabelMode.input,
                rightInset: chatGptDirectoryRightInset,
            },
            reader: {
                defaultOpenMode: readerDefaultOpenMode,
                renderCode: readerRenderCode.input,
                showOutline: readerShowOutline.input,
                promptPositionBottom: readerPromptPositionBottom.input,
                commentSortMode: readerCommentSortMode,
                promptsButton: readerPrompts.button,
                promptsSummary: readerPrompts.summary,
                templateButton: readerTemplate.button,
                templateSummary: readerTemplate.summary,
            },
            language,
            storageText,
        };
        this.refs.platforms.chatgpt.dataset.role = 'settings-platform-chatgpt';
        this.refs.platforms.gemini.dataset.role = 'settings-platform-gemini';
        this.refs.platforms.claude.dataset.role = 'settings-platform-claude';
        this.refs.platforms.deepseek.dataset.role = 'settings-platform-deepseek';
        this.refs.behavior.showMessageToolbar.dataset.role = 'settings-show-message-toolbar';
        this.refs.behavior.showSaveMessages.dataset.role = 'settings-show-save-messages';
        this.refs.behavior.showWordCount.dataset.role = 'settings-show-word-count';
        this.refs.behavior.saveContextOnly.dataset.role = 'settings-save-context-only';
        this.refs.formula.clickCopyMarkdown.dataset.role = 'settings-formula-click-copy-markdown';
        this.refs.formula.clickCopyFormulaFormat.trigger.dataset.role = 'settings-formula-click-copy-format';
        this.refs.formula.markdownCopyFormulaFormat.trigger.dataset.role = 'settings-formula-markdown-copy-format';
        this.refs.formula.assetActionsButton.dataset.role = 'settings-formula-asset-actions';
        this.refs.formula.assetFontSize.input.dataset.role = 'settings-formula-asset-font-size';
        this.refs.export.pngWidthPreset.trigger.dataset.role = 'settings-export-png-width-preset';
        this.refs.export.pngWidth.input.dataset.role = 'settings-export-png-width';
        this.refs.export.pngPixelRatio.input.dataset.role = 'settings-export-png-pixel-ratio';
        this.refs.chatgptDirectory.restorePositionAfterSend.dataset.role = 'settings-chatgpt-restore-position-after-send';
        this.refs.chatgptDirectory.enterKeyNewline.dataset.role = 'settings-chatgpt-enter-key-newline';
        this.refs.chatgptDirectory.promptAutocomplete.dataset.role = 'settings-chatgpt-prompt-autocomplete';
        this.refs.chatgptDirectory.showMessageStepper.dataset.role = 'settings-chatgpt-show-message-stepper';
        this.refs.chatgptDirectory.showPageBookmarkControl.dataset.role = 'settings-chatgpt-show-page-bookmark-control';
        this.refs.chatgptDirectory.showDetachedReaderControl.dataset.role = 'settings-chatgpt-show-detached-reader-control';
        this.refs.chatgptDirectory.showPromptControl.dataset.role = 'settings-chatgpt-show-prompt-control';
        this.refs.chatgptDirectory.arrowKeyMessageNavigation.dataset.role = 'settings-chatgpt-arrow-key-message-navigation';
        this.refs.chatgptDirectory.pageWidthScale.input.dataset.role = 'settings-chatgpt-page-width-scale';
        this.refs.chatgptDirectory.enabled.dataset.role = 'settings-chatgpt-directory-enabled';
        this.refs.chatgptDirectory.mode.trigger.dataset.role = 'settings-chatgpt-directory-mode';
        this.refs.chatgptDirectory.promptLabelMode.dataset.role = 'settings-chatgpt-directory-prompt-label-mode';
        this.refs.chatgptDirectory.rightInset.input.dataset.role = 'settings-chatgpt-directory-right-inset';
        this.refs.reader.defaultOpenMode.trigger.dataset.role = 'settings-reader-default-open-mode';
        this.refs.reader.renderCode.dataset.role = 'settings-render-code-reader';
        this.refs.reader.showOutline.dataset.role = 'settings-reader-outline';
        this.refs.reader.promptPositionBottom.dataset.role = 'settings-reader-comment-prompt-position-bottom';
        this.refs.reader.commentSortMode.trigger.dataset.role = 'settings-reader-comment-sort-mode';
        this.refs.reader.promptsButton.dataset.role = 'settings-reader-prompts';
        this.refs.reader.templateButton.dataset.role = 'settings-reader-comment-template';
        this.refs.advanced.button.dataset.role = 'settings-advanced-toggle';

        this.bindHandlers();
        this.applySettingsToDom();
    }

    getElement(): HTMLElement {
        return this.root;
    }

    focusPrimaryInput(): void {
        this.refs.platforms.chatgpt.focus({ preventScroll: true } as FocusOptions);
    }

    dismissTransientUi(): void {
        this.closeSelectMenus();
        this.formulaAssetSettingsPopover.close();
        this.readerCommentTemplateSettingsPopover.close();
    }

    consumeEscape(): boolean {
        if (this.buttonsPageRoot && !this.buttonsPageRoot.hidden) {
            this.showSettingsPage('main');
            return true;
        }
        if (this.readerCommentTemplateSettingsPopover.isOpen()) {
            this.readerCommentTemplateSettingsPopover.close();
            return true;
        }
        if (this.formulaAssetSettingsPopover.isOpen()) {
            this.formulaAssetSettingsPopover.close();
            return true;
        }
        const hasOpenSelect = this.selectRefs.some((selectRef) => selectRef.shell.dataset.open === '1');
        if (hasOpenSelect) {
            this.closeSelectMenus();
            return true;
        }
        return false;
    }

    async refresh(): Promise<void> {
        const next = await this.actions.loadState?.();
        if (!next) return;
        this.setState(next);
    }

    setState(params: { settings: AppSettings; storageUsage: BookmarksStorageUsageResponse | null }): void {
        this.settings = {
            ...DEFAULT_SETTINGS,
            ...params.settings,
            platforms: { ...DEFAULT_SETTINGS.platforms, ...params.settings.platforms },
            behavior: { ...DEFAULT_SETTINGS.behavior, ...params.settings.behavior },
            formula: this.normalizeFormulaSettings(params.settings.formula),
            export: { ...DEFAULT_SETTINGS.export, ...params.settings.export },
            chatgptDirectory: normalizeChatGPTDirectorySettings(params.settings.chatgptDirectory),
            chatgptBehavior: {
                ...DEFAULT_SETTINGS.chatgptBehavior,
                ...params.settings.chatgptBehavior,
                pageWidthScale: normalizeChatGPTPageWidthScale(params.settings.chatgptBehavior?.pageWidthScale),
            },
            appearance: {
                fontSizePx: this.normalizeGlobalFontSize(params.settings.appearance?.fontSizePx ?? DEFAULT_SETTINGS.appearance.fontSizePx),
                accentColor: this.normalizeAccentColor(params.settings.appearance?.accentColor),
            },
            bookmarks: { ...DEFAULT_SETTINGS.bookmarks, ...params.settings.bookmarks },
            reader: {
                ...DEFAULT_SETTINGS.reader,
                ...params.settings.reader,
                defaultOpenMode: normalizeReaderOpenMode(params.settings.reader?.defaultOpenMode),
                commentExport: normalizeReaderCommentExportSettings(params.settings.reader?.commentExport),
            },
        };
        this.storageUsage = params.storageUsage;
        this.applySettingsToDom();
    }

    destroy(): void {
        this.outsideDismissBoundary.detach();
        this.dismissTransientUi();
    }

    private showSettingsPage(page: 'main' | 'buttons'): void {
        if (!this.mainPageRoot || !this.buttonsPageRoot) return;
        this.dismissTransientUi();
        const showButtons = page === 'buttons';
        this.mainPageRoot.hidden = showButtons;
        this.buttonsPageRoot.hidden = !showButtons;
    }

    private bindHandlers(): void {
        // Platforms
        for (const key of Object.keys(this.refs.platforms) as Array<keyof Refs['platforms']>) {
            this.refs.platforms[key].addEventListener('change', () => {
                this.settings.platforms[key] = this.refs.platforms[key].checked;
                void this.actions.setPlatforms?.({ [key]: this.settings.platforms[key] });
            });
        }

        // Behavior + reader
        this.refs.behavior.showMessageToolbar.addEventListener('change', () => {
            const next = this.refs.behavior.showMessageToolbar.checked;
            this.settings.behavior.showMessageToolbar = next;
            void this.actions.setBehaviorSettings?.({ showMessageToolbar: next });
        });
        this.refs.behavior.showSaveMessages.addEventListener('change', () => {
            const next = this.refs.behavior.showSaveMessages.checked;
            this.settings.behavior.showSaveMessages = next;
            void this.actions.setBehaviorSettings?.({ showSaveMessages: next });
        });
        this.refs.behavior.showWordCount.addEventListener('change', () => {
            const next = this.refs.behavior.showWordCount.checked;
            this.settings.behavior.showWordCount = next;
            void this.actions.setBehaviorSettings?.({ showWordCount: next });
        });
        this.refs.behavior.saveContextOnly.addEventListener('change', async () => {
            const wantOn = this.refs.behavior.saveContextOnly.checked;
            if (wantOn && !this.settings.behavior._contextOnlyConfirmed) {
                const ok = await this.modal.confirm({
                    kind: 'info',
                    title: t('contextOnlySaveLabel'),
                    message: t('saveContextOnlyConfirm'),
                    confirmText: t('btnOk'),
                    cancelText: t('btnCancel'),
                });
                if (!ok) {
                    this.refs.behavior.saveContextOnly.checked = false;
                    return;
                }
                this.settings.behavior._contextOnlyConfirmed = true;
            }
            this.settings.behavior.saveContextOnly = wantOn;
            void this.actions.setBehaviorSettings?.({
                saveContextOnly: wantOn,
                _contextOnlyConfirmed: this.settings.behavior._contextOnlyConfirmed,
            });
        });
        this.refs.formula.clickCopyMarkdown.addEventListener('change', () => {
            const next = this.refs.formula.clickCopyMarkdown.checked;
            this.settings.formula = this.normalizeFormulaSettings({
                ...this.settings.formula,
                clickCopyMarkdown: next,
            });
            this.applySettingsToDom();
            void this.actions.setFormulaSettings?.({ clickCopyMarkdown: next });
        });
        this.refs.formula.clickCopyFormulaFormat.onChange((value) => {
            const next = normalizeFormulaSourceFormat(value);
            this.settings.formula = this.normalizeFormulaSettings({
                ...this.settings.formula,
                clickCopyFormulaFormat: next,
            });
            this.applySettingsToDom();
            void this.actions.setFormulaSettings?.({ clickCopyFormulaFormat: next });
        });
        this.refs.formula.markdownCopyFormulaFormat.onChange((value) => {
            const next = normalizeFormulaSourceFormat(value);
            this.settings.formula = this.normalizeFormulaSettings({
                ...this.settings.formula,
                markdownCopyFormulaFormat: next,
            });
            this.applySettingsToDom();
            void this.actions.setFormulaSettings?.({ markdownCopyFormulaFormat: next });
        });
        this.refs.formula.assetActionsButton.addEventListener('click', (event) => {
            event.preventDefault();
            this.openFormulaAssetSettingsPopover();
        });
        this.refs.formula.assetFontSize.input.addEventListener('input', () => {
            this.syncSliderValue(this.refs.formula.assetFontSize);
        });
        this.refs.formula.assetFontSize.input.addEventListener('change', () => {
            const next = normalizeFormulaAssetFontSizePx(this.refs.formula.assetFontSize.input.value);
            this.settings.formula = this.normalizeFormulaSettings({
                ...this.settings.formula,
                assetFontSizePx: next,
            });
            this.syncSliderValue(this.refs.formula.assetFontSize, next);
            void this.actions.setFormulaSettings?.({ assetFontSizePx: next });
        });
        this.refs.advanced.button.addEventListener('click', () => {
            this.advancedExpanded = !this.advancedExpanded;
            this.renderAdvancedSettings();
        });
        this.refs.export.pngWidthPreset.onChange((value) => {
            const nextPreset = value as PngExportWidthPreset;
            this.settings.export.pngWidthPreset = nextPreset;
            this.applySettingsToDom();
            void this.actions.setExportSettings?.({ pngWidthPreset: nextPreset });
        });
        this.refs.export.pngWidth.input.addEventListener('input', () => {
            this.syncSliderValue(this.refs.export.pngWidth);
        });
        this.refs.export.pngWidth.input.addEventListener('change', () => {
            const next = normalizePngCustomWidth(this.refs.export.pngWidth.input.value);
            this.settings.export.pngCustomWidth = next;
            this.syncSliderValue(this.refs.export.pngWidth, next);
            void this.actions.setExportSettings?.({ pngCustomWidth: next });
        });
        this.refs.export.pngPixelRatio.input.addEventListener('input', () => {
            this.syncSliderValue(this.refs.export.pngPixelRatio);
        });
        this.refs.export.pngPixelRatio.input.addEventListener('change', () => {
            const next = normalizePngPixelRatio(this.refs.export.pngPixelRatio.input.value);
            this.settings.export.pngPixelRatio = next;
            this.syncSliderValue(this.refs.export.pngPixelRatio, next);
            void this.actions.setExportSettings?.({ pngPixelRatio: next });
        });
        this.refs.chatgptDirectory.restorePositionAfterSend.addEventListener('change', () => {
            const next = this.refs.chatgptDirectory.restorePositionAfterSend.checked;
            this.settings.chatgptBehavior.restorePositionAfterSend = next;
            void this.actions.setChatGptBehaviorSettings?.({ restorePositionAfterSend: next });
        });
        this.refs.chatgptDirectory.enterKeyNewline.addEventListener('change', () => {
            const next = this.refs.chatgptDirectory.enterKeyNewline.checked;
            this.settings.chatgptBehavior.enterKeyNewline = next;
            void this.actions.setChatGptBehaviorSettings?.({ enterKeyNewline: next });
        });
        this.refs.chatgptDirectory.promptAutocomplete.addEventListener('change', () => {
            const next = this.refs.chatgptDirectory.promptAutocomplete.checked;
            this.settings.chatgptBehavior.promptAutocomplete = next;
            void this.actions.setChatGptBehaviorSettings?.({ promptAutocomplete: next });
        });
        this.refs.chatgptDirectory.showMessageStepper.addEventListener('change', () => {
            const next = this.refs.chatgptDirectory.showMessageStepper.checked;
            this.settings.chatgptBehavior.showMessageStepper = next;
            void this.actions.setChatGptBehaviorSettings?.({ showMessageStepper: next });
        });
        this.refs.chatgptDirectory.showPageBookmarkControl.addEventListener('change', () => {
            const next = this.refs.chatgptDirectory.showPageBookmarkControl.checked;
            this.settings.chatgptBehavior.showPageBookmarkControl = next;
            void this.actions.setChatGptBehaviorSettings?.({ showPageBookmarkControl: next });
        });
        this.refs.chatgptDirectory.showDetachedReaderControl.addEventListener('change', () => {
            const next = this.refs.chatgptDirectory.showDetachedReaderControl.checked;
            this.settings.chatgptBehavior.showDetachedReaderControl = next;
            void this.actions.setChatGptBehaviorSettings?.({ showDetachedReaderControl: next });
        });
        this.refs.chatgptDirectory.showPromptControl.addEventListener('change', () => {
            const next = this.refs.chatgptDirectory.showPromptControl.checked;
            this.settings.chatgptBehavior.showPromptControl = next;
            void this.actions.setChatGptBehaviorSettings?.({ showPromptControl: next });
        });
        this.refs.chatgptDirectory.arrowKeyMessageNavigation.addEventListener('change', () => {
            const next = this.refs.chatgptDirectory.arrowKeyMessageNavigation.checked;
            this.settings.chatgptBehavior.enableArrowKeyMessageNavigation = next;
            void this.actions.setChatGptBehaviorSettings?.({ enableArrowKeyMessageNavigation: next });
        });
        this.refs.chatgptDirectory.pageWidthScale.input.addEventListener('input', () => {
            this.syncSliderValue(this.refs.chatgptDirectory.pageWidthScale);
        });
        this.refs.chatgptDirectory.pageWidthScale.input.addEventListener('change', () => {
            const next = normalizeChatGPTPageWidthScale(this.refs.chatgptDirectory.pageWidthScale.input.value);
            this.settings.chatgptBehavior.pageWidthScale = next;
            this.syncSliderValue(this.refs.chatgptDirectory.pageWidthScale, next);
            void this.actions.setChatGptBehaviorSettings?.({ pageWidthScale: next });
        });
        this.refs.chatgptDirectory.enabled.addEventListener('change', () => {
            const next = this.refs.chatgptDirectory.enabled.checked;
            this.settings.chatgptDirectory.enabled = next;
            void this.actions.setChatGptDirectorySettings?.({ enabled: next });
        });
        this.refs.chatgptDirectory.mode.onChange((value) => {
            const next = value === 'expanded' ? 'expanded' : 'preview';
            this.settings.chatgptDirectory.mode = next;
            void this.actions.setChatGptDirectorySettings?.({ mode: next });
        });
        this.refs.chatgptDirectory.promptLabelMode.addEventListener('change', () => {
            const next = this.refs.chatgptDirectory.promptLabelMode.checked ? 'headTail' : 'head';
            this.settings.chatgptDirectory.promptLabelMode = next;
            void this.actions.setChatGptDirectorySettings?.({ promptLabelMode: next });
        });
        this.refs.chatgptDirectory.rightInset.input.addEventListener('input', () => {
            this.syncSliderValue(this.refs.chatgptDirectory.rightInset);
        });
        this.refs.chatgptDirectory.rightInset.input.addEventListener('change', () => {
            const next = normalizeChatGPTDirectoryRightInsetPx(this.refs.chatgptDirectory.rightInset.input.value);
            this.settings.chatgptDirectory.rightInsetPx = next;
            this.syncSliderValue(this.refs.chatgptDirectory.rightInset, next);
            void this.actions.setChatGptDirectorySettings?.({ rightInsetPx: next });
        });
        this.refs.reader.defaultOpenMode.onChange((value) => {
            const next = normalizeReaderOpenMode(value);
            this.settings.reader.defaultOpenMode = next;
            void this.actions.setReaderSettings?.({ defaultOpenMode: next });
        });
        this.refs.reader.renderCode.addEventListener('change', () => {
            const next = this.refs.reader.renderCode.checked;
            this.settings.reader.renderCodeInReader = next;
            void this.actions.setReaderSettings?.({ renderCodeInReader: next });
        });
        this.refs.reader.showOutline.addEventListener('change', () => {
            const next = this.refs.reader.showOutline.checked;
            this.settings.reader.showOutlineInReader = next;
            void this.actions.setReaderSettings?.({ showOutlineInReader: next });
        });
        this.refs.reader.promptPositionBottom.addEventListener('change', () => {
            const commentExport = normalizeReaderCommentExportSettings({
                ...this.settings.reader.commentExport,
                promptPosition: this.refs.reader.promptPositionBottom.checked ? 'bottom' : 'top',
            });
            this.settings.reader.commentExport = commentExport;
            this.applySettingsToDom();
            void this.actions.setReaderSettings?.({ commentExport });
        });
        this.refs.reader.commentSortMode.onChange((value) => {
            const commentExport = normalizeReaderCommentExportSettings({
                ...this.settings.reader.commentExport,
                sortMode: value,
            });
            this.settings.reader.commentExport = commentExport;
            this.applySettingsToDom();
            void this.actions.setReaderSettings?.({ commentExport });
        });
        this.refs.reader.promptsButton.addEventListener('click', () => {
            void this.onOpenPromptManager?.(this.refs.reader.promptsButton);
        });
        this.refs.reader.templateButton.addEventListener('click', () => {
            this.openReaderCommentTemplateSettings();
        });
        // Language
        this.refs.language.onChange((value) => {
            this.settings.language = value as any;
            void this.actions.setLanguage?.(value as AppSettings['language']);
            void setLocale(value as AppSettings['language']);
        });
    }

    private readonly onOpenPromptManager?: (anchor: HTMLElement) => Promise<void> | void;

    private applySettingsToDom(): void {
        const s = this.settings;
        const usagePercent = this.formatPercent(this.storageUsage?.usedPercentage);
        this.refs.platforms.chatgpt.checked = Boolean(s.platforms.chatgpt);
        this.refs.platforms.gemini.checked = Boolean(s.platforms.gemini);
        this.refs.platforms.claude.checked = Boolean(s.platforms.claude);
        this.refs.platforms.deepseek.checked = Boolean(s.platforms.deepseek);

        this.refs.behavior.showMessageToolbar.checked = Boolean(s.behavior.showMessageToolbar);
        this.refs.behavior.showSaveMessages.checked = Boolean(s.behavior.showSaveMessages);
        this.refs.behavior.showWordCount.checked = Boolean(s.behavior.showWordCount);
        this.refs.behavior.saveContextOnly.checked = Boolean(s.behavior.saveContextOnly);
        this.refs.formula.clickCopyMarkdown.checked = Boolean(s.formula.clickCopyMarkdown);
        this.refs.formula.clickCopyFormulaFormat.setValue(s.formula.clickCopyFormulaFormat);
        this.refs.formula.markdownCopyFormulaFormat.setValue(s.formula.markdownCopyFormulaFormat);
        this.refs.formula.assetActionsSummary.textContent = this.formatFormulaAssetActionsSummary(s.formula);
        this.syncSliderValue(this.refs.formula.assetFontSize, normalizeFormulaAssetFontSizePx(s.formula.assetFontSizePx));
        this.refs.export.pngWidthPreset.setValue(s.export.pngWidthPreset);
        this.syncSliderValue(this.refs.export.pngWidth, resolvePngExportWidth(s.export));
        this.refs.export.pngWidth.input.disabled = s.export.pngWidthPreset !== 'custom';
        this.refs.export.pngWidth.field.dataset.disabled = this.refs.export.pngWidth.input.disabled ? '1' : '0';
        this.syncSliderValue(this.refs.export.pngPixelRatio, resolvePngExportPixelRatio(s.export));
        this.refs.chatgptDirectory.restorePositionAfterSend.checked = Boolean(s.chatgptBehavior.restorePositionAfterSend);
        this.refs.chatgptDirectory.enterKeyNewline.checked = Boolean(s.chatgptBehavior.enterKeyNewline);
        this.refs.chatgptDirectory.promptAutocomplete.checked = Boolean(s.chatgptBehavior.promptAutocomplete);
        this.refs.chatgptDirectory.showMessageStepper.checked = Boolean(s.chatgptBehavior.showMessageStepper);
        this.refs.chatgptDirectory.showPageBookmarkControl.checked = Boolean(s.chatgptBehavior.showPageBookmarkControl);
        this.refs.chatgptDirectory.showDetachedReaderControl.checked = Boolean(s.chatgptBehavior.showDetachedReaderControl);
        this.refs.chatgptDirectory.showPromptControl.checked = Boolean(s.chatgptBehavior.showPromptControl);
        this.refs.chatgptDirectory.arrowKeyMessageNavigation.checked = Boolean(s.chatgptBehavior.enableArrowKeyMessageNavigation);
        this.syncSliderValue(this.refs.chatgptDirectory.pageWidthScale, normalizeChatGPTPageWidthScale(s.chatgptBehavior.pageWidthScale));
        this.refs.chatgptDirectory.enabled.checked = Boolean(s.chatgptDirectory.enabled);
        this.refs.chatgptDirectory.mode.setValue(s.chatgptDirectory.mode === 'expanded' ? 'expanded' : 'preview');
        this.refs.chatgptDirectory.promptLabelMode.checked = s.chatgptDirectory.promptLabelMode === 'headTail';
        this.syncSliderValue(this.refs.chatgptDirectory.rightInset, normalizeChatGPTDirectoryRightInsetPx(s.chatgptDirectory.rightInsetPx));
        this.refs.reader.defaultOpenMode.setValue(normalizeReaderOpenMode(s.reader.defaultOpenMode));
        this.refs.reader.renderCode.checked = Boolean(s.reader.renderCodeInReader);
        this.refs.reader.showOutline.checked = Boolean(s.reader.showOutlineInReader);
        this.refs.reader.promptPositionBottom.checked = s.reader.commentExport?.promptPosition === 'bottom';
        this.refs.reader.commentSortMode.setValue(s.reader.commentExport?.sortMode === 'position' ? 'position' : 'created');
        this.refs.reader.promptsSummary.textContent = this.formatReaderPromptSummary();
        this.refs.reader.templateSummary.textContent = this.formatReaderTemplateSummary(s.reader.commentExport?.template ?? []);
        this.refs.language.setValue(s.language);

        this.syncToggle(this.refs.platforms.chatgpt);
        this.syncToggle(this.refs.platforms.gemini);
        this.syncToggle(this.refs.platforms.claude);
        this.syncToggle(this.refs.platforms.deepseek);
        this.syncToggle(this.refs.behavior.showMessageToolbar);
        this.syncToggle(this.refs.behavior.showSaveMessages);
        this.syncToggle(this.refs.behavior.showWordCount);
        this.syncToggle(this.refs.behavior.saveContextOnly);
        this.syncToggle(this.refs.formula.clickCopyMarkdown);
        this.syncToggle(this.refs.chatgptDirectory.restorePositionAfterSend);
        this.syncToggle(this.refs.chatgptDirectory.enterKeyNewline);
        this.syncToggle(this.refs.chatgptDirectory.promptAutocomplete);
        this.syncToggle(this.refs.chatgptDirectory.showMessageStepper);
        this.syncToggle(this.refs.chatgptDirectory.showPageBookmarkControl);
        this.syncToggle(this.refs.chatgptDirectory.showDetachedReaderControl);
        this.syncToggle(this.refs.chatgptDirectory.showPromptControl);
        this.syncToggle(this.refs.chatgptDirectory.arrowKeyMessageNavigation);
        this.syncToggle(this.refs.chatgptDirectory.enabled);
        this.syncToggle(this.refs.chatgptDirectory.promptLabelMode);
        this.syncToggle(this.refs.reader.renderCode);
        this.syncToggle(this.refs.reader.showOutline);
        this.syncToggle(this.refs.reader.promptPositionBottom);

        this.refs.storageText.textContent = usagePercent;
        this.renderAdvancedSettings();

        const storageFill = this.root.querySelector<HTMLElement>('[data-field="storage_bar"]');
        if (storageFill) {
            storageFill.style.width = usagePercent;
        }
    }

    private syncToggle(input: HTMLInputElement): void {
        const toggle = input.closest<HTMLElement>('.toggle-switch');
        if (!toggle) return;
        toggle.dataset.checked = input.checked ? '1' : '0';
    }

    private createGroup(icon: string, title: string): { root: HTMLElement; body: HTMLElement } {
        const root = document.createElement('div');
        root.className = 'settings-card settings-group';
        const h = document.createElement('h3');
        h.className = 'card-title settings-group-title';
        h.innerHTML = `${icon}<span>${title}</span>`;
        const body = document.createElement('div');
        root.append(h, body);
        return { root, body };
    }

    private createSection(icon: string, title: string): { root: HTMLElement; body: HTMLElement } {
        const root = document.createElement('section');
        root.className = 'settings-section settings-group';
        const h = document.createElement('h3');
        h.className = 'card-title settings-group-title';
        h.innerHTML = `${icon}<span>${title}</span>`;
        const body = document.createElement('div');
        body.className = 'settings-section-body';
        root.append(h, body);
        return { root, body };
    }

    private createToggle(parent: HTMLElement, labelHtml: string, desc: string): { root: HTMLElement; input: HTMLInputElement } {
        const item = document.createElement('div');
        item.className = 'toggle-row settings-item';
        const info = document.createElement('div');
        info.className = 'settings-label settings-item-info';
        const label = document.createElement('strong');
        const iconMarkup = labelHtml.match(/^<svg[\s\S]*?<\/svg>/)?.[0] ?? '';
        label.innerHTML = labelHtml.replace(/^<svg[\s\S]*?<\/svg>\s*/, '');
        if (iconMarkup) {
            const labelIcon = document.createElement('span');
            labelIcon.className = 'settings-label__icon';
            labelIcon.innerHTML = iconMarkup;
            label.prepend(labelIcon);
        }
        const p = document.createElement('p');
        p.textContent = desc;
        info.append(label, p);

        const toggle = document.createElement('label');
        toggle.className = 'toggle-switch';
        const input = document.createElement('input');
        input.type = 'checkbox';
        const knob = document.createElement('span');
        knob.className = 'toggle-knob';
        input.addEventListener('change', () => {
            toggle.dataset.checked = input.checked ? '1' : '0';
        });
        toggle.append(input, knob);

        item.append(info, toggle);
        parent.appendChild(item);
        return { root: item, input };
    }

    private createActionRow(parent: HTMLElement, labelText: string, desc: string, role: string): {
        root: HTMLElement;
        button: HTMLButtonElement;
        summary: HTMLElement;
    } {
        const item = document.createElement('div');
        item.className = 'settings-row settings-item';
        const info = document.createElement('div');
        info.className = 'settings-label settings-item-info';
        const label = document.createElement('strong');
        label.textContent = labelText;
        const summary = document.createElement('p');
        summary.className = 'reader-settings-summary';
        summary.textContent = desc;
        info.append(label, summary);

        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'icon-btn reader-settings-trigger';
        button.dataset.role = role;
        const configureLabel = t('btnConfigure');
        button.setAttribute('aria-label', configureLabel);
        button.setAttribute('title', configureLabel);
        button.appendChild(createIcon(Icons.settings));

        item.append(info, button);
        parent.appendChild(item);
        return { root: item, button, summary };
    }

    private createPngExportWidthRow(
        parent: HTMLElement,
        labelText: string,
        desc: string,
        options: Array<{ value: string; label: string }>,
        menuName: string,
        min: number,
        max: number,
        step: number,
    ): { preset: SelectRef; width: SliderFieldRef } {
        const item = document.createElement('div');
        item.className = 'settings-row settings-item settings-export-width-row';
        const info = document.createElement('div');
        info.className = 'settings-label settings-item-info';
        const label = document.createElement('strong');
        label.textContent = labelText;
        const summary = document.createElement('p');
        summary.textContent = desc;
        info.append(label, summary);

        const controls = document.createElement('div');
        controls.className = 'settings-export-width-controls';

        const preset = createBookmarksInlineSelectControl({
            options,
            menuName,
            onBeforeOpen: () => this.closeSelectMenus(),
        });
        preset.shell.classList.add('settings-export-width-preset');
        this.selectRefs.push(preset);

        const width = this.createSliderField(min, max, step, 'settings-export-width-value', (value) => `${value}px`);
        width.field.classList.add('settings-export-width-value');
        controls.append(preset.shell, width.field);
        item.append(info, controls);
        parent.appendChild(item);
        return { preset, width };
    }

    private createSliderRow(
        parent: HTMLElement,
        labelText: string,
        desc: string,
        min: number,
        max: number,
        step: number,
        valueClassName: string,
        format: (value: number) => string,
    ): SliderFieldRef {
        const item = document.createElement('div');
        item.className = 'settings-row settings-item';
        const info = document.createElement('div');
        info.className = 'settings-label settings-item-info';
        const label = document.createElement('strong');
        label.textContent = labelText;
        const summary = document.createElement('p');
        summary.textContent = desc;
        info.append(label, summary);

        const slider = this.createSliderField(min, max, step, valueClassName, format);
        item.append(info, slider.field);
        parent.appendChild(item);
        return { ...slider, root: item };
    }

    private createSliderField(
        min: number,
        max: number,
        step: number,
        valueClassName: string,
        format: (value: number) => string,
    ): SliderFieldRef {
        const field = document.createElement('div');
        field.className = 'settings-slider-field';
        field.classList.add(valueClassName);

        const input = document.createElement('input');
        input.type = 'range';
        input.className = 'settings-slider';
        input.min = String(min);
        input.max = String(max);
        input.step = String(step);

        const value = document.createElement('span');
        value.className = 'settings-slider-value';

        field.append(input, value);
        return { root: field, field, input, value, format };
    }

    private syncSliderValue(ref: SliderFieldRef, normalized?: number): void {
        const next = normalized ?? Number.parseFloat(ref.input.value);
        const value = Number.isFinite(next) ? next : Number.parseFloat(ref.input.min);
        ref.input.value = String(value);
        ref.value.textContent = ref.format(value);
    }

    private createStepperRow(
        parent: HTMLElement,
        labelText: string,
        desc: string,
        min: number,
        max: number,
        step: number,
        valueRole: string,
    ): StepperFieldRef {
        const item = document.createElement('div');
        item.className = 'settings-row settings-item';
        const info = document.createElement('div');
        info.className = 'settings-label settings-item-info';
        const label = document.createElement('strong');
        label.textContent = labelText;
        const summary = document.createElement('p');
        summary.textContent = desc;
        info.append(label, summary);

        const field = document.createElement('div');
        field.className = 'settings-stepper-field';
        field.dataset.min = String(min);
        field.dataset.max = String(max);
        field.dataset.step = String(step);

        const decrease = document.createElement('button');
        decrease.type = 'button';
        decrease.className = 'settings-stepper-button';
        decrease.textContent = '-';
        decrease.setAttribute('aria-label', t('decreaseFontSize'));

        const value = document.createElement('span');
        value.className = 'settings-stepper-value';
        value.dataset.role = valueRole;

        const increase = document.createElement('button');
        increase.type = 'button';
        increase.className = 'settings-stepper-button';
        increase.textContent = '+';
        increase.setAttribute('aria-label', t('increaseFontSize'));

        field.append(decrease, value, increase);
        item.append(info, field);
        parent.appendChild(item);
        return { root: item, field, decrease, increase, value };
    }

    private createAdvancedSettingsGroup(): Refs['advanced'] {
        const root = document.createElement('div');
        root.className = 'settings-advanced';
        root.dataset.expanded = '0';

        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'settings-advanced-toggle';
        button.setAttribute('aria-expanded', 'false');
        button.innerHTML = `
          <span class="settings-advanced-toggle__label">${t('advancedSettingsLabel')}</span>
          <span class="settings-advanced-toggle__hint">${t('advancedSettingsDesc')}</span>
        `;

        const body = document.createElement('div');
        body.className = 'settings-advanced-body';
        body.dataset.role = 'settings-advanced-body';

        root.append(button, body);
        return { root, button, body };
    }

    private renderAdvancedSettings(): void {
        const { root, button, body } = this.refs.advanced;
        root.dataset.expanded = this.advancedExpanded ? '1' : '0';
        button.setAttribute('aria-expanded', this.advancedExpanded ? 'true' : 'false');
        body.replaceChildren();
        if (!this.advancedExpanded) return;

        const appearanceSection = document.createElement('div');
        appearanceSection.className = 'settings-advanced-section';
        const appearanceTitle = document.createElement('h4');
        appearanceTitle.className = 'settings-advanced-section__title';
        appearanceTitle.textContent = t('appearanceSettingsLabel');
        appearanceSection.appendChild(appearanceTitle);
        const fontSize = this.createStepperRow(
            appearanceSection,
            t('globalFontSizeLabel'),
            t('globalFontSizeDesc'),
            MIN_GLOBAL_FONT_SIZE_PX,
            MAX_GLOBAL_FONT_SIZE_PX,
            GLOBAL_FONT_SIZE_STEP_PX,
            'settings-global-font-size-value',
        );
        this.refs.advanced.fontSize = fontSize;
        this.syncFontSizeStepper(fontSize);
        fontSize.decrease.addEventListener('click', () => this.updateGlobalFontSize(-GLOBAL_FONT_SIZE_STEP_PX));
        fontSize.increase.addEventListener('click', () => this.updateGlobalFontSize(GLOBAL_FONT_SIZE_STEP_PX));

        this.createAccentColorRow(
            appearanceSection,
            t('themeAccentColorLabel'),
            t('themeAccentColorDesc'),
        );

        body.append(appearanceSection);
        this.syncAccentColorSwatches();
    }

    private normalizeGlobalFontSize(value: unknown): number {
        const numeric = typeof value === 'number' ? value : Number.parseInt(String(value ?? ''), 10);
        if (!Number.isFinite(numeric)) return DEFAULT_GLOBAL_FONT_SIZE_PX;
        const clamped = Math.min(MAX_GLOBAL_FONT_SIZE_PX, Math.max(MIN_GLOBAL_FONT_SIZE_PX, numeric));
        return Math.round(clamped / GLOBAL_FONT_SIZE_STEP_PX) * GLOBAL_FONT_SIZE_STEP_PX;
    }

    private normalizeAccentColor(value: unknown): ThemeAccentColor | null {
        return normalizeThemeAccentColor(value);
    }

    private updateGlobalFontSize(delta: number): void {
        const current = this.normalizeGlobalFontSize(this.settings.appearance?.fontSizePx);
        const next = this.normalizeGlobalFontSize(current + delta);
        if (next === current) {
            this.syncFontSizeStepper(this.refs.advanced.fontSize ?? null);
            return;
        }
        this.settings.appearance = { ...this.settings.appearance, fontSizePx: next };
        this.syncFontSizeStepper(this.refs.advanced.fontSize ?? null);
        void this.actions.setAppearanceSettings?.({ fontSizePx: next });
    }

    private updateAccentColor(color: ThemeAccentColor): void {
        const next = color === DEFAULT_SETTINGS.appearance.accentColor || color === THEME_ACCENT_SWATCHES[0].value
            ? null
            : color;
        const current = this.normalizeAccentColor(this.settings.appearance?.accentColor);
        if (next === current) {
            this.syncAccentColorSwatches();
            return;
        }
        this.settings.appearance = { ...this.settings.appearance, accentColor: next };
        this.syncAccentColorSwatches();
        void this.actions.setAppearanceSettings?.({ accentColor: next });
    }

    private syncFontSizeStepper(ref: StepperFieldRef | null): void {
        if (!ref) return;
        const value = this.normalizeGlobalFontSize(this.settings.appearance?.fontSizePx);
        ref.value.textContent = `${value}px`;
        ref.decrease.disabled = value <= MIN_GLOBAL_FONT_SIZE_PX;
        ref.increase.disabled = value >= MAX_GLOBAL_FONT_SIZE_PX;
    }

    private createAccentColorRow(parent: HTMLElement, labelText: string, desc: string): void {
        const item = document.createElement('div');
        item.className = 'settings-row settings-item settings-color-row';
        const info = document.createElement('div');
        info.className = 'settings-label settings-item-info';
        const label = document.createElement('strong');
        label.textContent = labelText;
        const summary = document.createElement('p');
        summary.textContent = desc;
        info.append(label, summary);

        const field = document.createElement('div');
        field.className = 'settings-color-swatches';
        field.setAttribute('role', 'radiogroup');
        field.setAttribute('aria-label', labelText);

        for (const swatch of THEME_ACCENT_SWATCHES) {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'settings-color-swatch';
            button.dataset.role = 'settings-accent-color-swatch';
            button.dataset.color = swatch.value;
            button.setAttribute('role', 'radio');
            button.setAttribute('aria-label', t(swatch.labelKey));
            button.style.setProperty('--_settings-accent-color', swatch.value);

            const preview = document.createElement('span');
            preview.className = 'settings-color-swatch__preview';
            preview.setAttribute('aria-hidden', 'true');
            button.appendChild(preview);
            button.addEventListener('click', () => this.updateAccentColor(swatch.value));
            field.appendChild(button);
        }

        item.append(info, field);
        parent.appendChild(item);
    }

    private syncAccentColorSwatches(): void {
        const selected = this.normalizeAccentColor(this.settings.appearance?.accentColor) ?? THEME_ACCENT_SWATCHES[0].value;
        this.refs.advanced.body.querySelectorAll<HTMLButtonElement>('[data-role="settings-accent-color-swatch"]').forEach((button) => {
            const isSelected = button.dataset.color === selected;
            button.dataset.selected = isSelected ? '1' : '0';
            button.setAttribute('aria-checked', isSelected ? 'true' : 'false');
        });
    }

    private createSelect(
        parent: HTMLElement,
        labelText: string,
        desc: string,
        options: Array<{ value: string; label: string }>,
        menuName: string
    ): SelectRef {
        const ref = createBookmarksInlineSelect({
            parent,
            labelText,
            desc,
            options,
            menuName,
            onBeforeOpen: () => this.closeSelectMenus(),
        });
        this.selectRefs.push(ref);
        return ref;
    }

    private getFormulaSourceFormatOptions(): Array<{ value: FormulaSourceFormat; label: string }> {
        return [
            { value: 'markdown-dollar', label: t('formulaSourceFormatMarkdownDollar') },
            { value: 'latex-brackets', label: t('formulaSourceFormatLatexBrackets') },
            { value: 'raw', label: t('formulaSourceFormatRaw') },
            { value: 'equation', label: t('formulaSourceFormatEquation') },
            { value: 'equation-star', label: t('formulaSourceFormatEquationStar') },
        ];
    }

    private closeSelectMenus(): void {
        for (const selectRef of this.selectRefs) selectRef.close();
    }

    private normalizeFormulaSettings(settings: unknown): FormulaSettings {
        const record = settings && typeof settings === 'object' ? settings as Partial<FormulaSettings> : {};
        const assetActions: Partial<FormulaSettings['assetActions']> = record.assetActions && typeof record.assetActions === 'object'
            ? record.assetActions
            : {};
        return {
            clickCopyMarkdown: Boolean(record.clickCopyMarkdown ?? DEFAULT_FORMULA_SETTINGS.clickCopyMarkdown),
            clickCopyFormulaFormat: normalizeLegacyClickCopyFormulaFormat(record as Record<string, unknown>),
            markdownCopyFormulaFormat: normalizeFormulaSourceFormat(record.markdownCopyFormulaFormat),
            assetFontSizePx: normalizeFormulaAssetFontSizePx(record.assetFontSizePx),
            assetActions: {
                copyPng: Boolean(assetActions.copyPng ?? DEFAULT_FORMULA_SETTINGS.assetActions.copyPng),
                copySvg: Boolean(assetActions.copySvg ?? DEFAULT_FORMULA_SETTINGS.assetActions.copySvg),
                copyMathml: Boolean(assetActions.copyMathml ?? DEFAULT_FORMULA_SETTINGS.assetActions.copyMathml),
                savePng: Boolean(assetActions.savePng ?? DEFAULT_FORMULA_SETTINGS.assetActions.savePng),
                saveSvg: Boolean(assetActions.saveSvg ?? DEFAULT_FORMULA_SETTINGS.assetActions.saveSvg),
            },
        };
    }

    private formatFormulaAssetActionsSummary(settings: FormulaSettings): string {
        const actions = settings.assetActions;
        const count = [actions.copyPng, actions.copySvg, actions.copyMathml, actions.savePng, actions.saveSvg].filter(Boolean).length;
        if (count === 0) return t('formulaAssetActionsSummaryNone');
        if (count === 5) return t('formulaAssetActionsSummaryAll');
        return t('formulaAssetActionsSummaryCount', [String(count)]);
    }

    private formatReaderPromptSummary(): string {
        return t('readerCommentPromptListDesc');
    }

    private formatReaderTemplateSummary(template: CommentTemplateSegment[]): string {
        const normalized = normalizeCommentTemplate(template)
            .map((segment) => {
                if (segment.type === 'text') return segment.value;
                return segment.key === 'selected_source'
                    ? t('readerCommentTemplateTokenSelectedSource')
                    : t('readerCommentTemplateTokenUserComment');
            })
            .join(' ')
            .replace(/\s+/g, ' ')
            .trim();
        return normalized || t('readerCommentTemplateSettingsDesc');
    }

    private updateReaderCommentExport(commentExport: AppSettings['reader']['commentExport']): void {
        const normalized = normalizeReaderCommentExportSettings(commentExport);
        this.settings.reader.commentExport = normalized;
        this.applySettingsToDom();
        void this.actions.setReaderSettings?.({ commentExport: normalized });
    }

    private buildReaderTemplatePreview(template: CommentTemplateSegment[]): string {
        const commentExport = normalizeReaderCommentExportSettings(this.settings.reader.commentExport);
        return buildCommentsExport(
            [
                {
                    id: 'preview-comment-1',
                    itemId: 'preview-item',
                    quoteText: 'quote',
                    sourceMarkdown: '`sample_source()`',
                    comment: 'Needs clarification.',
                    selectors: { textQuote: { exact: '', prefix: '', suffix: '' }, textPosition: { start: 0, end: 0 }, domRange: null, atomicRefs: [] },
                    createdAt: 1,
                    updatedAt: 1,
                },
                {
                    id: 'preview-comment-2',
                    itemId: 'preview-item',
                    quoteText: 'quote',
                    sourceMarkdown: '**another sample**',
                    comment: 'Consider tightening this wording.',
                    selectors: { textQuote: { exact: '', prefix: '', suffix: '' }, textPosition: { start: 0, end: 0 }, domRange: null, atomicRefs: [] },
                    createdAt: 2,
                    updatedAt: 2,
                },
            ],
            {
                userPrompt: commentExport.prompts[0]?.content ?? '',
                promptPosition: commentExport.promptPosition,
                commentTemplate: template,
                sortMode: commentExport.sortMode,
            },
        );
    }

    private openReaderCommentTemplateSettings(): void {
        this.dismissTransientUi();
        const current = normalizeReaderCommentExportSettings(this.settings.reader.commentExport);
        this.readerCommentTemplateSettingsPopover.open({
            parent: this.root,
            template: current.template,
            preview: this.buildReaderTemplatePreview(current.template),
            labels: {
                title: t('readerCommentTemplateSettingsLabel'),
                close: t('btnClose'),
                template: t('readerCommentTemplate'),
                templateHint: t('readerCommentTemplateHint'),
                templatePlaceholder: t('readerCommentTemplatePlaceholder'),
                insertPlaceholder: t('readerCommentTemplateInsertPlaceholder'),
                insertSelectedSource: t('readerCommentTemplateInsertSelectedSource'),
                insertUserComment: t('readerCommentTemplateInsertUserComment'),
                tokenSelectedSource: t('readerCommentTemplateTokenSelectedSource'),
                tokenUserComment: t('readerCommentTemplateTokenUserComment'),
                preview: t('readerCommentTemplatePreviewLabel'),
                restoreDefault: t('readerCommentTemplateRestoreDefault'),
                save: t('btnSave'),
                cancel: t('btnCancel'),
                copied: t('btnCopied'),
            },
            onBuildPreview: (template) => this.buildReaderTemplatePreview(template),
            onRestoreDefault: () => createDefaultCommentTemplate(),
            onSave: (template) => {
                this.updateReaderCommentExport({ ...current, template });
            },
        });
    }

    private openFormulaAssetSettingsPopover(): void {
        this.dismissTransientUi();
        this.formulaAssetSettingsPopover.open({
            parent: this.root,
            settings: this.settings.formula,
            labels: {
                title: t('formulaAssetActionsPopupTitle'),
                close: t('btnClose'),
                copyPng: t('formulaCopyAsPng'),
                copySvg: t('formulaCopyAsSvg'),
                copyMathml: t('formulaCopyAsMathml'),
                savePng: t('formulaSaveAsPng'),
                saveSvg: t('formulaSaveAsSvg'),
            },
            onChange: (assetActions) => {
                this.settings.formula = this.normalizeFormulaSettings({
                    ...this.settings.formula,
                    assetActions,
                });
                this.applySettingsToDom();
                void this.actions.setFormulaSettings?.({ assetActions: this.settings.formula.assetActions });
            },
        });
    }

    private formatPercent(value: number | null | undefined): string {
        if (typeof value !== 'number' || !Number.isFinite(value)) return '0%';
        const normalized = Math.max(0, Math.min(100, value));
        const rounded = Math.round(normalized * 10) / 10;
        return Number.isInteger(rounded) ? `${rounded}%` : `${rounded.toFixed(1)}%`;
    }
}
