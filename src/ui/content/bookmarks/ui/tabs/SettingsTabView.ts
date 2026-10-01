import { parseAccentRgb, formatAccentRgb } from '../../../../../core/settings/appearance';
import type { FormulaRenderOptions, FormulaSvgAsset } from '../../../../../services/math/formulaAssetRenderer';
import type { AppearanceSnapshot } from '../../../../../style/appearance';
import { ButtonsSettingsView } from './ButtonsSettingsView';
import { SettingsTransferPanel, type SettingsTransferActions } from './SettingsTransferPanel';
import { SettingsCatalog, type SettingsCategoryId } from './SettingsCatalog';
import type { AppSettings } from '../../../../../core/settings/types';
import {
    CHATGPT_DIRECTORY_RIGHT_INSET_STEP_PX,
    CHATGPT_DIRECTORY_PREVIEW_MAX_CHARS_STEP,
    CHATGPT_NAVIGATION_SEEK_STEP_PX_STEP,
    CHATGPT_PAGE_WIDTH_SCALE_STEP,
    DEFAULT_SETTINGS,
    DEFAULT_GLOBAL_FONT_SIZE_PX,
    MAX_CHATGPT_DIRECTORY_RIGHT_INSET_PX,
    MAX_CHATGPT_DIRECTORY_PREVIEW_MAX_CHARS,
    MAX_CHATGPT_NAVIGATION_SEEK_STEP_PX,
    MAX_CHATGPT_PAGE_WIDTH_SCALE,
    GLOBAL_FONT_SIZE_STEP_PX,
    MAX_GLOBAL_FONT_SIZE_PX,
    MIN_CHATGPT_DIRECTORY_RIGHT_INSET_PX,
    MIN_CHATGPT_DIRECTORY_PREVIEW_MAX_CHARS,
    MIN_CHATGPT_NAVIGATION_SEEK_STEP_PX,
    MIN_CHATGPT_PAGE_WIDTH_SCALE,
    MIN_GLOBAL_FONT_SIZE_PX,
    THEME_ACCENT_SWATCHES,
    type ThemeAccentColor,
} from '../../../../../core/settings/types';
import {
    normalizeChatGPTAtomicMarkdownCopyShortcut,
    normalizeChatGPTDirectoryRightInsetPx,
    normalizeChatGPTDirectoryPreviewMaxChars,
    normalizeChatGPTDirectorySettings,
    normalizeChatGPTNavigationSeekStepPx,
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
import { getLocale, setLocale, t } from '../../../components/i18n';
import { createIcon } from '../../../components/Icon';
import { chatgptIcon } from '../../../../../assets/icons';
import { downloadIcon, settingsIcon } from '../../../../../assets/workspaceIcons';
import {
    installTransientOutsideDismissBoundary,
    type TransientOutsideDismissBoundaryHandle,
} from '../../../components/transientUi';
import { createBookmarksInlineSelect, createBookmarksInlineSelectControl } from '../components/BookmarksInlineSelect';
import { CloudBackupSettingsPanel, type CloudBackupSettingsPanelActions } from '../cloudBackup/CloudBackupSettingsPanel';
import { createDefaultCommentTemplate, type CommentTemplateSegment } from '../../../../../core/settings/readerCommentExport';
import { buildCommentsExport, normalizeCommentTemplate, normalizeReaderCommentExportSettings } from '../../../../../services/reader/commentExport';
import { ReaderCommentTemplateSettingsPopover } from '../../../reader/ReaderCommentTemplateSettingsPopover';
import type { RuntimeClientFailure } from '../../../../../drivers/shared/clients/clientResult';
import { getRuntimeFailurePresentation } from '../../../components/runtimeFailurePresentation';
import type { DiscoveryDiagnosticsSnapshotV1 } from '../../../../../contracts/conversationDiscoveryDiagnostics';
import { copyTextToClipboard } from '../../../../../drivers/content/clipboard/clipboard';
import { createInputEnhancementGuideContent, INPUT_ENHANCEMENT_GUIDE_CSS } from '../../../components/InputEnhancementGuide';

export type SettingsDataState =
    | { kind: 'loading' }
    | { kind: 'ready' }
    | { kind: 'error'; failure: RuntimeClientFailure };

export type SettingsTabViewState = {
    settings: AppSettings;
    storageUsage: BookmarksStorageUsageResponse | null;
    dataState?: SettingsDataState;
    canConfigureButtons?:boolean;canTransferSettings?:boolean;
};

export type SettingsTabViewActions = {
    loadState?: () => Promise<SettingsTabViewState | null>;
    retryLoad?: () => Promise<void> | void;
    setBookmarksSettings?: (patch: Partial<AppSettings['bookmarks']>) => Promise<boolean | void> | boolean | void;
    setPlatforms?: (patch: Partial<AppSettings['platforms']>) => Promise<boolean | void> | boolean | void;
    setBehaviorSettings?: (patch: Partial<AppSettings['behavior']>) => Promise<boolean | void> | boolean | void;
    setReaderSettings?: (patch: Partial<AppSettings['reader']>) => Promise<boolean | void> | boolean | void;
    setContentSettings?: (patch: Partial<AppSettings['content']>) => Promise<boolean | void> | boolean | void;
    setFormulaSettings?: (patch: Partial<AppSettings['formula']>) => Promise<boolean | void> | boolean | void;
    setExportSettings?: (patch: Partial<AppSettings['export']>) => Promise<boolean | void> | boolean | void;
    setChatGptDirectorySettings?: (patch: Partial<AppSettings['chatgptDirectory']>) => Promise<boolean | void> | boolean | void;
    setChatGptBehaviorSettings?: (patch: Partial<AppSettings['chatgptBehavior']>) => Promise<boolean | void> | boolean | void;
    setAppearanceSettings?: (patch: Partial<AppSettings['appearance']>) => Promise<boolean | void> | boolean | void;
    setLanguage?: (value: AppSettings['language']) => Promise<boolean | void> | boolean | void;
    exportAllBookmarks?: () => Promise<void> | void;
    cloudBackup?: CloudBackupSettingsPanelActions;
    settingsTransfer?: SettingsTransferActions;
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
    platforms: Pick<Record<keyof AppSettings['platforms'], HTMLInputElement>, 'chatgpt'>;
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
        assetFontSize: SliderFieldRef;
    };
    advanced: {
        root: HTMLElement;
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
        atomicMarkdownCopyShortcut: SelectRef;
        inputEnhancement: HTMLInputElement;
        promptAutocomplete: HTMLInputElement;
        pageAnnotationsEnabled: HTMLInputElement;
        showPageSelectionToolbar: HTMLInputElement;
        showMessageStepper: HTMLInputElement;
        showPageBookmarkControl: HTMLInputElement;
        showDetachedReaderControl: HTMLInputElement;
        showPromptControl: HTMLInputElement;
        arrowKeyMessageNavigation: HTMLInputElement;
        pageWidthScale: SliderFieldRef;
        navigationSeekStep: SliderFieldRef;
        enabled: HTMLInputElement;
        mode: SelectRef;
        promptLabelMode: HTMLInputElement;
        rightInset: SliderFieldRef;
        previewMaxChars: SliderFieldRef;
    };
    reader: {
        defaultOpenMode: SelectRef;
        renderCode: HTMLInputElement;
        showOutline: HTMLInputElement;
        persistAnnotations: HTMLInputElement;
        promptPositionBottom: HTMLInputElement;
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
    private dataState: SettingsDataState = { kind: 'ready' };
    private runtimeNotice: HTMLElement;
    private runtimeNoticeTitle: HTMLElement;
    private runtimeNoticeMessage: HTMLElement;
    private runtimeNoticeAction: HTMLButtonElement;
    private scrollRoot: HTMLElement;
    private refs: Refs;
    private selectRefs: SelectRef[] = [];
    private readonly readerCommentTemplateSettingsPopover = new ReaderCommentTemplateSettingsPopover();
    private readonly outsideDismissBoundary: TransientOutsideDismissBoundaryHandle;
    private catalog: SettingsCatalog | null = null;
    private canConfigureButtons=true;private canTransferSettings=true;
    private readonly renderFormulaPreview:((options:FormulaRenderOptions)=>Promise<FormulaSvgAsset>)|undefined;
    private buttonsView: ButtonsSettingsView | null = null;
    private transferPanel: SettingsTransferPanel | null = null;
    private customAccentButton: HTMLButtonElement | null = null;
    private customAccentInput: HTMLInputElement | null = null;
    private customAccentPending = false;
    private extraSync: Array<() => void> = [];
    private languageChangeRevision = 0;
    private languageSaveQueue: Promise<void> = Promise.resolve();
    private readonly readDiscoveryDiagnostics: (() => DiscoveryDiagnosticsSnapshotV1 | null) | null;
    private diagnosticsSummary: HTMLElement;
    private diagnosticsCopyButton: HTMLButtonElement;

    constructor(params: { renderFormulaPreview?:(options:FormulaRenderOptions)=>Promise<FormulaSvgAsset>; modal: ModalHost; actions?: SettingsTabViewActions; onOpenPromptManager?: (anchor: HTMLElement) => Promise<void> | void; readDiscoveryDiagnostics?: () => DiscoveryDiagnosticsSnapshotV1 | null }) {
        this.renderFormulaPreview=params.renderFormulaPreview;
        this.modal = params.modal;
        this.actions = params.actions ?? {};
        this.onOpenPromptManager = params.onOpenPromptManager;
        this.readDiscoveryDiagnostics = params.readDiscoveryDiagnostics ?? null;

        this.root = document.createElement('div');
        this.root.className = 'aimd-settings';
        this.outsideDismissBoundary = installTransientOutsideDismissBoundary({
            eventTarget: document,
            roots: () => this.selectRefs.map((selectRef) => selectRef.root),
            onDismiss: () => this.dismissTransientUi(),
        });

        const runtimeNotice = document.createElement('aside');
        runtimeNotice.className = 'bookmarks-runtime-notice settings-runtime-notice';
        runtimeNotice.dataset.role = 'settings-runtime-error';
        runtimeNotice.hidden = true;
        const runtimeNoticeCopy = document.createElement('div');
        const runtimeNoticeTitle = document.createElement('strong');
        const runtimeNoticeMessage = document.createElement('p');
        runtimeNoticeCopy.append(runtimeNoticeTitle, runtimeNoticeMessage);
        const runtimeNoticeAction = document.createElement('button');
        runtimeNoticeAction.type = 'button';
        runtimeNoticeAction.className = 'secondary-btn';
        runtimeNoticeAction.dataset.action = 'settings-runtime-retry';
        runtimeNoticeAction.addEventListener('click', () => void this.handleRuntimeRecovery());
        runtimeNotice.append(runtimeNoticeCopy, runtimeNoticeAction);
        this.runtimeNotice = runtimeNotice;
        this.runtimeNoticeTitle = runtimeNoticeTitle;
        this.runtimeNoticeMessage = runtimeNoticeMessage;
        this.runtimeNoticeAction = runtimeNoticeAction;

        const scroll = document.createElement('div');
        scroll.className = 'aimd-scroll settings-panel-scroll';
        this.scrollRoot = scroll;

        const content = document.createElement('div');
        content.className = 'settings-grid settings-content';

        // Platforms group
        const platformsGroup = this.createGroup();
        const platforms = {
            chatgpt: this.createToggle(platformsGroup.body, `${chatgptIcon} ChatGPT`, t('enableOnChatGPT')),
        };

        const buttonsGroup = this.createGroup();
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
        const chatGptDirectoryGroup = this.createGroup();
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
        const chatGptDirectoryPreviewMaxChars = this.createSliderRow(
            chatGptDirectoryGroup.body,
            t('chatgptDirectoryPreviewMaxCharsLabel'),
            t('chatgptDirectoryPreviewMaxCharsDesc'),
            MIN_CHATGPT_DIRECTORY_PREVIEW_MAX_CHARS,
            MAX_CHATGPT_DIRECTORY_PREVIEW_MAX_CHARS,
            CHATGPT_DIRECTORY_PREVIEW_MAX_CHARS_STEP,
            'settings-chatgpt-directory-preview-max-chars-value',
            (value) => `${value}`,
        );
        const chatGptRestorePositionAfterSend = this.createToggle(
            chatGptDirectoryGroup.body,
            t('chatgptRestorePositionAfterSendLabel'),
            t('chatgptRestorePositionAfterSendDesc'),
        );
        const chatGptAtomicMarkdownCopyShortcut = this.createSelect(
            chatGptDirectoryGroup.body,
            t('chatgptAtomicMarkdownCopyLabel'),
            t('chatgptAtomicMarkdownCopyDesc'),
            [
                { value: 'none', label: t('chatgptAtomicMarkdownCopyNone') },
                { value: 'mod-c', label: t('chatgptAtomicMarkdownCopyModC') },
                { value: 'mod-shift-c', label: t('chatgptAtomicMarkdownCopyModShiftC') },
            ],
            'chatgpt-atomic-markdown-copy-shortcut',
        );
        const chatGptInputEnhancement = this.createToggle(
            chatGptDirectoryGroup.body,
            t('chatgptInputEnhancementLabel'),
            t('chatgptInputEnhancementDesc'),
        );
        const chatGptPromptAutocomplete = this.createToggle(
            chatGptDirectoryGroup.body,
            t('chatgptPromptAutocompleteLabel'),
            t('chatgptPromptAutocompleteDesc'),
        );
        const chatGptPageAnnotationsEnabled = this.createToggle(
            chatGptDirectoryGroup.body,
            t('chatgptPageAnnotationsLabel'),
            t('chatgptPageAnnotationsDesc'),
        );
        const chatGptShowPageSelectionToolbar = this.createToggle(
            chatGptDirectoryGroup.body,
            t('chatgptShowPageSelectionToolbarLabel'),
            t('chatgptShowPageSelectionToolbarDesc'),
        );
        const chatGptArrowKeyMessageNavigation = this.createToggle(
            chatGptDirectoryGroup.body,
            t('chatgptArrowKeyMessageNavigationLabel'),
            t('chatgptArrowKeyMessageNavigationDesc'),
        );
        const chatGptPageWidthScale = this.createSliderRow(
            chatGptDirectoryGroup.body,
            t('chatgptPageWidthScaleLabel'),
            '',
            MIN_CHATGPT_PAGE_WIDTH_SCALE,
            MAX_CHATGPT_PAGE_WIDTH_SCALE,
            CHATGPT_PAGE_WIDTH_SCALE_STEP,
            'settings-chatgpt-page-width-scale-value',
            (value) => value <= MIN_CHATGPT_PAGE_WIDTH_SCALE ? t('chatgptPageWidthScaleNormal') : `${value}%`,
        );
        const chatGptNavigationSeekStep = this.createSliderRow(
            chatGptDirectoryGroup.body,
            t('chatgptNavigationSeekStepLabel'),
            t('chatgptNavigationSeekStepDesc'),
            MIN_CHATGPT_NAVIGATION_SEEK_STEP_PX,
            MAX_CHATGPT_NAVIGATION_SEEK_STEP_PX,
            CHATGPT_NAVIGATION_SEEK_STEP_PX_STEP,
            'settings-chatgpt-navigation-seek-step-value',
            (value) => `${value}px`,
        );

        const readerGroup = this.createGroup();
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
        const readerPersistAnnotations = this.createToggle(readerGroup.body, t('readerAnnotationPersistenceLabel'), t('readerAnnotationPersistenceDesc'));
        const readerPromptPositionBottom = this.createToggle(
            readerGroup.body,
            t('readerCommentPromptPositionBottomLabel'),
            t('readerCommentPromptPositionBottomDesc'),
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

        const copyExportGroup = this.createGroup();
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
        const languageGroup = this.createGroup();
        const language = this.createSelect(languageGroup.body, t('settingsLanguageLabel'), '', [
            { value: 'auto', label: t('languageAuto') },
            { value: 'en', label: t('languageEnglish') },
            { value: 'zh_CN', label: t('languageZhCN') },
        ], 'language');

        // Data management group (Google Drive backup + local backup/export)
        const storageGroup = this.createGroup();
        const googleDriveBackupCard = document.createElement('section');
        googleDriveBackupCard.className = 'settings-data-card';
        googleDriveBackupCard.dataset.role = 'settings-google-drive-backup-card';
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
        exportBtn.innerHTML = `${downloadIcon} ${t('exportAllBtn')}`;
        exportBtn.addEventListener('click', () => void this.actions.exportAllBookmarks?.());
        backup.append(backupInfo, exportBtn);
        backupCard.appendChild(backup);
        storageGroup.body.appendChild(backupCard);

        const advancedGroup = this.createAdvancedSettingsGroup();

        const diagnosticsGroup = this.createGroup();
        const diagnosticsItem = document.createElement('div');
        diagnosticsItem.className = 'settings-row settings-item';
        const diagnosticsInfo = document.createElement('div');
        diagnosticsInfo.className = 'settings-label settings-item-info';
        const diagnosticsTitle = document.createElement('strong');
        diagnosticsTitle.textContent = t('settingsDiscoveryDiagnosticsLabel');
        const diagnosticsSummary = document.createElement('p');
        diagnosticsSummary.className = 'reader-settings-summary';
        diagnosticsSummary.dataset.role = 'settings-discovery-diagnostics-summary';
        diagnosticsInfo.append(diagnosticsTitle, diagnosticsSummary);
        const diagnosticsCopyButton = document.createElement('button');
        diagnosticsCopyButton.type = 'button';
        diagnosticsCopyButton.className = 'secondary-btn';
        diagnosticsCopyButton.dataset.role = 'settings-discovery-diagnostics-copy';
        diagnosticsCopyButton.textContent = t('settingsDiscoveryDiagnosticsCopy');
        diagnosticsCopyButton.addEventListener('click', () => void this.copyDiscoveryDiagnostics());
        diagnosticsItem.append(diagnosticsInfo, diagnosticsCopyButton);
        diagnosticsGroup.body.appendChild(diagnosticsItem);
        this.diagnosticsSummary = diagnosticsSummary;
        this.diagnosticsCopyButton = diagnosticsCopyButton;
        this.refreshDiscoveryDiagnostics();

        content.append(
            platformsGroup.root,
            buttonsGroup.root,
            chatGptDirectoryGroup.root,
            readerGroup.root,
            copyExportGroup.root,
            languageGroup.root,
            storageGroup.root,
            advancedGroup.root,
            diagnosticsGroup.root,
        );
        scroll.append(content);
        this.root.append(runtimeNotice, scroll);

        const storageText = storageInfo.querySelector<HTMLElement>('[data-field="storage_usage"]')!;

        this.refs = {
            platforms: {
                chatgpt: platforms.chatgpt.input,
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
                atomicMarkdownCopyShortcut: chatGptAtomicMarkdownCopyShortcut,
                inputEnhancement: chatGptInputEnhancement.input,
                promptAutocomplete: chatGptPromptAutocomplete.input,
                pageAnnotationsEnabled: chatGptPageAnnotationsEnabled.input,
                showPageSelectionToolbar: chatGptShowPageSelectionToolbar.input,
                showMessageStepper: chatGptShowMessageStepper.input,
                showPageBookmarkControl: chatGptShowPageBookmarkControl.input,
                showDetachedReaderControl: chatGptShowDetachedReaderControl.input,
                showPromptControl: chatGptShowPromptControl.input,
                arrowKeyMessageNavigation: chatGptArrowKeyMessageNavigation.input,
                pageWidthScale: chatGptPageWidthScale,
                navigationSeekStep: chatGptNavigationSeekStep,
                enabled: chatGptDirectoryEnabled.input,
                mode: chatGptDirectoryMode,
                promptLabelMode: chatGptDirectoryPromptLabelMode.input,
                rightInset: chatGptDirectoryRightInset,
                previewMaxChars: chatGptDirectoryPreviewMaxChars,
            },
            reader: {
                defaultOpenMode: readerDefaultOpenMode,
                renderCode: readerRenderCode.input,
                showOutline: readerShowOutline.input,
                persistAnnotations: readerPersistAnnotations.input,
                promptPositionBottom: readerPromptPositionBottom.input,
                promptsButton: readerPrompts.button,
                promptsSummary: readerPrompts.summary,
                templateButton: readerTemplate.button,
                templateSummary: readerTemplate.summary,
            },
            language,
            storageText,
        };
        this.refs.platforms.chatgpt.dataset.role = 'settings-platform-chatgpt';
        this.refs.behavior.showMessageToolbar.dataset.role = 'settings-show-message-toolbar';
        this.refs.behavior.showSaveMessages.dataset.role = 'settings-show-save-messages';
        this.refs.behavior.showWordCount.dataset.role = 'settings-show-word-count';
        this.refs.behavior.saveContextOnly.dataset.role = 'settings-save-context-only';
        this.refs.formula.clickCopyMarkdown.dataset.role = 'settings-formula-click-copy-markdown';
        this.refs.formula.clickCopyFormulaFormat.trigger.dataset.role = 'settings-formula-click-copy-format';
        this.refs.formula.markdownCopyFormulaFormat.trigger.dataset.role = 'settings-formula-markdown-copy-format';
        this.refs.formula.assetFontSize.input.dataset.role = 'settings-formula-asset-font-size';
        this.refs.export.pngWidthPreset.trigger.dataset.role = 'settings-export-png-width-preset';
        this.refs.export.pngWidth.input.dataset.role = 'settings-export-png-width';
        this.refs.export.pngPixelRatio.input.dataset.role = 'settings-export-png-pixel-ratio';
        this.refs.chatgptDirectory.restorePositionAfterSend.dataset.role = 'settings-chatgpt-restore-position-after-send';
        this.refs.chatgptDirectory.atomicMarkdownCopyShortcut.trigger.dataset.role = 'settings-chatgpt-atomic-markdown-copy-shortcut';
        this.refs.chatgptDirectory.inputEnhancement.dataset.role = 'settings-chatgpt-input-enhancement';
        this.refs.chatgptDirectory.promptAutocomplete.dataset.role = 'settings-chatgpt-prompt-autocomplete';
        this.refs.chatgptDirectory.pageAnnotationsEnabled.dataset.role = 'settings-chatgpt-page-annotations';
        this.refs.chatgptDirectory.showPageSelectionToolbar.dataset.role = 'settings-chatgpt-show-page-selection-toolbar';
        this.refs.chatgptDirectory.showMessageStepper.dataset.role = 'settings-chatgpt-show-message-stepper';
        this.refs.chatgptDirectory.showPageBookmarkControl.dataset.role = 'settings-chatgpt-show-page-bookmark-control';
        this.refs.chatgptDirectory.showDetachedReaderControl.dataset.role = 'settings-chatgpt-show-detached-reader-control';
        this.refs.chatgptDirectory.showPromptControl.dataset.role = 'settings-chatgpt-show-prompt-control';
        this.refs.chatgptDirectory.arrowKeyMessageNavigation.dataset.role = 'settings-chatgpt-arrow-key-message-navigation';
        this.refs.chatgptDirectory.pageWidthScale.input.dataset.role = 'settings-chatgpt-page-width-scale';
        this.refs.chatgptDirectory.navigationSeekStep.input.dataset.role = 'settings-chatgpt-navigation-seek-step';
        this.refs.chatgptDirectory.enabled.dataset.role = 'settings-chatgpt-directory-enabled';
        this.refs.chatgptDirectory.mode.trigger.dataset.role = 'settings-chatgpt-directory-mode';
        this.refs.chatgptDirectory.promptLabelMode.dataset.role = 'settings-chatgpt-directory-prompt-label-mode';
        this.refs.chatgptDirectory.rightInset.input.dataset.role = 'settings-chatgpt-directory-right-inset';
        this.refs.chatgptDirectory.previewMaxChars.input.dataset.role = 'settings-chatgpt-directory-preview-max-chars';
        this.refs.reader.defaultOpenMode.trigger.dataset.role = 'settings-reader-default-open-mode';
        this.refs.reader.renderCode.dataset.role = 'settings-render-code-reader';
        this.refs.reader.showOutline.dataset.role = 'settings-reader-outline';
        this.refs.reader.persistAnnotations.dataset.role = 'settings-reader-annotation-persistence';
        this.refs.reader.promptPositionBottom.dataset.role = 'settings-reader-comment-prompt-position-bottom';
        this.refs.reader.promptsButton.dataset.role = 'settings-reader-prompts';
        this.refs.reader.templateButton.dataset.role = 'settings-reader-comment-template';

        this.bindHandlers();
        this.applySettingsToDom();
        this.buildCatalog();
        this.extraSync.forEach(sync => sync());
    }

    setAppearance(snapshot: AppearanceSnapshot): void { this.buttonsView?.setAppearance(snapshot); this.transferPanel?.setAppearance(snapshot); }

    getNavigationElement(): HTMLElement { return this.catalog!.navigation; }

    getElement(): HTMLElement {
        return this.root;
    }

    focusPrimaryInput(): void {
        this.catalog?.search.focus({ preventScroll: true });
    }

    dismissTransientUi(): void {
        this.closeSelectMenus();
        this.readerCommentTemplateSettingsPopover.close();
    }

    consumeEscape(): boolean {
        if (this.readerCommentTemplateSettingsPopover.isOpen()) {
            this.readerCommentTemplateSettingsPopover.close();
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

    setState(params: SettingsTabViewState): void {
        this.settings = {
            ...DEFAULT_SETTINGS,
            ...params.settings,
            platforms: { ...DEFAULT_SETTINGS.platforms, ...params.settings.platforms },
            behavior: { ...DEFAULT_SETTINGS.behavior, ...params.settings.behavior, messageControls: { ...DEFAULT_SETTINGS.behavior.messageControls, ...params.settings.behavior?.messageControls } },
            formula: this.normalizeFormulaSettings(params.settings.formula),
            export: { ...DEFAULT_SETTINGS.export, ...params.settings.export },
            chatgptDirectory: normalizeChatGPTDirectorySettings(params.settings.chatgptDirectory),
            chatgptBehavior: {
                ...DEFAULT_SETTINGS.chatgptBehavior,
                ...params.settings.chatgptBehavior,
                pageWidthScale: normalizeChatGPTPageWidthScale(params.settings.chatgptBehavior?.pageWidthScale),
                navigationSeekStepPx: normalizeChatGPTNavigationSeekStepPx(params.settings.chatgptBehavior?.navigationSeekStepPx),
            },
            appearance: {
                themeMode: params.settings.appearance?.themeMode ?? 'auto',
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
        this.canConfigureButtons=params.canConfigureButtons??true;this.canTransferSettings=params.canTransferSettings??true;
        this.dataState = params.dataState ?? { kind: 'ready' };
        this.applySettingsToDom();
        this.applyDataStateToDom();
    }

    destroy(): void {
        this.buttonsView?.dispose();
        this.transferPanel?.dispose();
        this.outsideDismissBoundary.detach();
        this.dismissTransientUi();
    }

    private buildCatalog(): void {
        const groups: Record<SettingsCategoryId, HTMLElement[]> = { appearance: [], reading: [], input: [], marks: [], export: [], controls: [], data: [], advanced: [] };
        const add = (category: SettingsCategoryId, ...controls: HTMLElement[]) => {
            for (const control of controls) {
                const row = control.closest<HTMLElement>('.settings-item') ?? control;
                if (!groups[category].includes(row)) groups[category].push(row);
            }
        };
        const staging = document.createElement('div');
        const r = this.refs;
        add('appearance', r.advanced.fontSize!.root, this.root.querySelector<HTMLElement>('.settings-color-row')!, r.language.root, r.chatgptDirectory.pageWidthScale.root);
        add('reading', r.chatgptDirectory.enabled, r.chatgptDirectory.mode.root, r.chatgptDirectory.promptLabelMode, r.chatgptDirectory.rightInset.root, r.chatgptDirectory.previewMaxChars.root, r.chatgptDirectory.restorePositionAfterSend);
        const contentCleanup = this.createActionRow(staging, t('settingsContentCleanupTitle'), t('settingsContentCleanupDesc'), 'settings-content-cleanup');
        contentCleanup.button.addEventListener('click', () => this.openContentCleanupSettings());
        add('reading', contentCleanup.root);
        add('input', r.chatgptDirectory.inputEnhancement, r.chatgptDirectory.promptAutocomplete, r.reader.promptsButton);
        add('marks', r.chatgptDirectory.pageAnnotationsEnabled);
        add('export', r.formula.clickCopyMarkdown, r.formula.clickCopyFormulaFormat.root, r.formula.markdownCopyFormulaFormat.root, r.formula.assetFontSize.root, r.export.pngWidthPreset.trigger, r.export.pngPixelRatio.root);
        add('advanced', r.chatgptDirectory.arrowKeyMessageNavigation, r.chatgptDirectory.atomicMarkdownCopyShortcut.root);
        this.buttonsView = new ButtonsSettingsView(async (category, patch) => {
            let saved: boolean | void;
            switch(category) {
                case 'behavior': if(!this.actions.setBehaviorSettings)return false; saved=await this.actions.setBehaviorSettings(patch as Partial<AppSettings['behavior']>);break;
                case 'chatgptBehavior': if(!this.actions.setChatGptBehaviorSettings)return false; saved=await this.actions.setChatGptBehaviorSettings(patch as Partial<AppSettings['chatgptBehavior']>);break;
                case 'reader': if(!this.actions.setReaderSettings)return false; saved=await this.actions.setReaderSettings(patch as Partial<AppSettings['reader']>);break;
                case 'formula': if(!this.actions.setFormulaSettings)return false; saved=await this.actions.setFormulaSettings(patch as Partial<AppSettings['formula']>);break;
                default:return false;
            }
            if(saved===false)return false;
            await this.refresh(); return true;
        }, this.renderFormulaPreview);
        groups.controls.push(this.buttonsView.root);
        if (this.actions.settingsTransfer) { this.transferPanel = new SettingsTransferPanel(this.actions.settingsTransfer, { showHeading: false }); groups.data.push(this.transferPanel.root); }
        add('data', r.behavior.saveContextOnly, ...this.root.querySelectorAll<HTMLElement>('.settings-data-card'));
        add('advanced', r.platforms.chatgpt, r.chatgptDirectory.navigationSeekStep.root, this.diagnosticsCopyButton);
        const toggle = (category: SettingsCategoryId, role: string, label: string, description: string, read: () => boolean, write: (value: boolean) => void) => {
            const ref = this.createToggle(staging, label, description); ref.input.dataset.role = role;
            ref.input.addEventListener('change', () => { write(ref.input.checked); this.syncToggle(ref.input); });
            this.extraSync.push(() => { ref.input.checked = read(); this.syncToggle(ref.input); }); add(category, ref.root);
        };
        const select = (category: SettingsCategoryId, role: string, label: string, options: Array<{value: string; label: string}>, read: () => string, write: (value: string) => void) => {
            const ref = this.createSelect(staging, label, '', options, role); ref.trigger.dataset.role = role;
            ref.onChange(write); this.extraSync.push(() => ref.setValue(read())); add(category, ref.root);
        };
        select('appearance', 'settings-theme-mode', t('settingsThemeMode'), [
            { value: 'auto', label: t('settingsThemeAuto') }, { value: 'light', label: t('settingsThemeLight') }, { value: 'dark', label: t('settingsThemeDark') },
        ], () => this.settings.appearance.themeMode ?? 'auto', value => {
            const themeMode = value === 'light' || value === 'dark' ? value : 'auto';
            this.settings.appearance.themeMode = themeMode; void this.actions.setAppearanceSettings?.({ themeMode });
        });
        toggle('reading', 'settings-hide-official-navigation', t('settingsHideOfficialNavigation'), t('settingsHideOfficialNavigationDesc'), () => this.settings.chatgptDirectory.hideOfficialNavigation, value => {
            this.settings.chatgptDirectory.hideOfficialNavigation = value; void this.actions.setChatGptDirectorySettings?.({ hideOfficialNavigation: value });
        });
        for (const [field, label, min, max, step] of [
            ['bodyFontSizePx', t('settingsReaderBodyFont'), 12, 22, 1],
            ['contentMaxWidthPx', t('settingsReaderBodyWidth'), 480, 1600, 20],
        ] as const) {
            const ref = this.createSliderRow(staging, label, field === 'contentMaxWidthPx' ? t('settingsReaderBodyWidthDesc') : '', min, max, step, `settings-reader-${field}`, value => `${value}px`);
            ref.input.dataset.role = `settings-reader-${field}`;
            ref.input.addEventListener('input', () => this.syncSliderValue(ref));
            ref.input.addEventListener('change', () => { const value = Number(ref.input.value); this.settings.reader[field] = value; void this.actions.setReaderSettings?.({ [field]: value }); });
            this.extraSync.push(() => this.syncSliderValue(ref, this.settings.reader[field]));
        }
        for (const [field, label, description] of [
            ['enterKeyNewline', t('chatgptInputEnhancementEnterLabel'), t('chatgptInputEnhancementEnterDesc')],
            ['boldShortcut', t('chatgptInputEnhancementBoldLabel'), t('chatgptInputEnhancementBoldDesc')],
            ['formulaSuggestions', t('chatgptInputEnhancementFormulaSuggestionsLabel'), t('settingsInputFormulaSuggestionsDesc')],
            ['formulaPreview', t('chatgptInputEnhancementFormulaPreviewLabel'), t('settingsInputFormulaPreviewDesc')],
        ] as const) toggle('input', `settings-input-${field}`, label, description, () => this.settings.chatgptBehavior.inputEnhancement[field], value => {
            const inputEnhancement = { ...this.settings.chatgptBehavior.inputEnhancement, [field]: value };
            this.settings.chatgptBehavior.inputEnhancement = inputEnhancement; void this.actions.setChatGptBehaviorSettings?.({ inputEnhancement });
        });
        for (const [field, label] of [['enabled', t('chatgptInputEnhancementListsLabel')], ['ordered', t('chatgptInputEnhancementOrderedListLabel')], ['unordered', t('chatgptInputEnhancementUnorderedListLabel')]] as const) {
            toggle('input', `settings-input-lists-${field}`, label, '', () => this.settings.chatgptBehavior.inputEnhancement.lists[field], value => {
                const previous = this.settings.chatgptBehavior.inputEnhancement;
                const inputEnhancement = { ...previous, lists: { ...previous.lists, [field]: value } };
                this.settings.chatgptBehavior.inputEnhancement = inputEnhancement; void this.actions.setChatGptBehaviorSettings?.({ inputEnhancement });
            });
        }
        const guide = this.createActionRow(staging, t('chatgptInputEnhancementGuideTitle'), '', 'settings-input-guide');
        guide.button.addEventListener('click', () => {
            const body = createInputEnhancementGuideContent();
            const style = document.createElement('style'); style.textContent = INPUT_ENHANCEMENT_GUIDE_CSS; body.prepend(style);
            void this.modal.showCustom({kind: 'info', title: t('chatgptInputEnhancementGuideTitle'), body});
        }); add('input', guide.root);
        select('data', 'settings-bookmark-sort', t('settingsDefaultBookmarkSort'), [
            { value: 'time-desc', label: t('sortTimeDesc') }, { value: 'time-asc', label: t('sortTimeAsc') },
            { value: 'alpha-asc', label: t('sortAlphaAsc') }, { value: 'alpha-desc', label: t('sortAlphaDesc') },
        ], () => this.settings.bookmarks.sortMode, value => {
            const sortMode = value as AppSettings['bookmarks']['sortMode'];
            this.settings.bookmarks.sortMode = sortMode; void this.actions.setBookmarksSettings?.({ sortMode });
        });
        groups.appearance.unshift(groups.appearance.pop()!);
        const promptRows = groups.input.splice(1, 2); groups.input.push(...promptRows);
        for (const [category, rows] of Object.entries(groups)) {
            for (const row of rows) {
                const roles = Array.from(row.querySelectorAll<HTMLElement>('[data-role]')).map(el => el.dataset.role).join(' ');
                let key = ({ appearance: 'Interface', reading: 'Reader', input: 'Editing', marks: 'AnnotationOutput', export: 'Markdown', controls: 'Drawer', data: 'Data', advanced: 'Advanced' } as Record<string, string>)[category];
                if (category === 'appearance' && roles.includes('page-width')) key = 'Page';
                if (category === 'reading') {
                    if (/directory|hide-official|show-message-stepper/.test(roles)) key = 'Directory';
                    if (roles.includes('restore-position')) key = 'Position';
                }
                if (category === 'input') {
                    if (/formula/i.test(roles)) key = 'FormulaAssistant';
                    else if (/prompt/.test(roles)) key = 'Prompts';
                }
                if (category === 'marks' && /persist|page-annotations/.test(roles)) key = 'Marks';
                if (category === 'export') {
                    if (roles.includes('formula-asset-action')) key = 'FormulaButtons';
                    else if (roles.includes('formula-asset-font')) key = 'FormulaImages';
                    else if (roles.includes('export-png')) key = 'MessageImages';
                }
                if (category === 'controls') {
                    if (/atomic-markdown|arrow-key/.test(roles)) key = 'Keyboard';
                    else if (/selection/.test(roles)) key = 'Selection';
                    else if (/show-message-toolbar|show-save-messages|show-word-count/.test(roles)) key = 'MessageButtons';
                }
                if (category === 'data') {
                    key = row.dataset.role === 'settings-transfer' ? 'Configuration'
                        : row.dataset.role === 'settings-google-drive-backup-card' ? 'CloudBackup'
                        : row.dataset.role === 'settings-data-backup-card' ? 'LocalBackup' : 'LibraryData';
                }
                row.dataset.settingsGroup = `settingsGroup${key}`;
            }
        }
        this.buttonsView.root.dataset.settingsGroup = '';
        this.buttonsView.root.dataset.searchText = this.buttonsView.getSearchText();
        this.catalog = new SettingsCatalog(groups, () => { this.dismissTransientUi(); this.scrollRoot.scrollTop = 0; this.buttonsView?.search(this.catalog?.search.value ?? ''); });
        this.scrollRoot.replaceChildren(this.catalog.content);
        this.root.insertBefore(this.catalog.header, this.scrollRoot);
    }


    private openContentCleanupSettings(): void {
        const selected = { ...this.settings.content };
        const body = document.createElement('div');
        body.className = 'settings-pin-options';
        const description = document.createElement('p');
        description.textContent = t('settingsContentCleanupDesc');
        body.append(description);

        const addOption = (key: keyof AppSettings['content'], labelKey: string, descriptionKey: string): void => {
            const wrapper = document.createElement('div');
            wrapper.className = 'settings-content-option';
            const label = document.createElement('label');
            const input = document.createElement('input');
            input.type = 'checkbox';
            input.checked = selected[key];
            input.dataset.role = `settings-content-${key}`;
            input.addEventListener('change', () => { selected[key] = input.checked; });
            label.append(input, document.createTextNode(t(labelKey)));
            const help = document.createElement('p');
            help.textContent = t(descriptionKey);
            wrapper.append(label, help);
            body.append(wrapper);
        };
        addOption('preserveLinks', 'settingsPreserveLinks', 'settingsPreserveLinksDesc');
        addOption('includeCodeBlocks', 'settingsIncludeCodeBlocks', 'settingsIncludeCodeBlocksDesc');

        const status = document.createElement('p');
        status.setAttribute('role', 'status');
        body.append(status);
        let pending = false;
        void this.modal.showCustom({
            kind: 'info',
            title: t('settingsContentCleanupTitle'),
            body,
            canDismiss: () => !pending,
            footer: (footer, close) => {
                const cancel = document.createElement('button');
                cancel.type = 'button';
                cancel.className = 'mock-modal__button mock-modal__button--secondary';
                cancel.textContent = t('btnCancel');
                cancel.addEventListener('click', () => { if (!pending) close(); });

                const save = document.createElement('button');
                save.type = 'button';
                save.className = 'mock-modal__button mock-modal__button--primary';
                save.textContent = t('btnSave');
                save.addEventListener('click', async () => {
                    if (pending) return;
                    pending = true;
                    save.disabled = true;
                    cancel.disabled = true;
                    body.querySelectorAll<HTMLInputElement>('input').forEach(input => { input.disabled = true; });
                    try {
                        if (await this.actions.setContentSettings?.(selected) === false) throw new Error('save');
                        this.settings.content = { ...selected };
                        this.extraSync.forEach(sync => sync());
                        close();
                    } catch {
                        status.textContent = t('settingsSaveFailed');
                        pending = false;
                        save.disabled = false;
                        cancel.disabled = false;
                        body.querySelectorAll<HTMLInputElement>('input').forEach(input => { input.disabled = false; });
                    }
                });
                footer.append(cancel, save);
            },
        });
    }

    private async handleRuntimeRecovery(): Promise<void> {
        if (this.dataState.kind !== 'error') return;
        const presentation = getRuntimeFailurePresentation(this.dataState.failure, this.translate);
        if (presentation.action === 'reload') {
            window.location.reload();
            return;
        }
        await this.actions.retryLoad?.();
    }

    private applyDataStateToDom(): void {
        this.buttonsView?.setReadOnly(this.dataState.kind !== 'ready'||!this.canConfigureButtons);
        this.buttonsView?.setCompatibilityNotice(!this.canConfigureButtons);
        this.transferPanel?.setReadOnly(this.dataState.kind !== 'ready'||!this.canTransferSettings);
        this.transferPanel?.setCompatibilityNotice(!this.canTransferSettings);
        this.scrollRoot.inert = this.dataState.kind !== 'ready';
        this.root.toggleAttribute('aria-busy', this.dataState.kind === 'loading');
        if (this.dataState.kind === 'ready') {
            this.runtimeNotice.hidden = true;
            return;
        }

        this.runtimeNotice.hidden = false;
        if (this.dataState.kind === 'loading') {
            this.runtimeNotice.dataset.state = 'loading';
            this.runtimeNoticeTitle.textContent = this.translate('settingsLoadingTitle', 'Loading settings…');
            this.runtimeNoticeMessage.textContent = this.translate(
                'settingsLoadingMessage',
                'Waiting for the extension runtime.',
            );
            this.runtimeNoticeAction.hidden = true;
            return;
        }

        const presentation = getRuntimeFailurePresentation(this.dataState.failure, this.translate);
        this.runtimeNotice.dataset.state = 'error';
        this.runtimeNoticeTitle.textContent = presentation.title;
        this.runtimeNoticeMessage.textContent = presentation.message;
        this.runtimeNoticeAction.hidden = false;
        this.runtimeNoticeAction.textContent = presentation.actionLabel;
    }

    private readonly translate = (key: string, fallback: string): string => {
        const translated = t(key);
        return !translated || translated === key ? fallback : translated;
    };

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
        this.refs.chatgptDirectory.atomicMarkdownCopyShortcut.onChange((value) => {
            const next = normalizeChatGPTAtomicMarkdownCopyShortcut(value);
            this.settings.chatgptBehavior.atomicMarkdownCopyShortcut = next;
            void this.actions.setChatGptBehaviorSettings?.({ atomicMarkdownCopyShortcut: next });
        });
        this.refs.chatgptDirectory.inputEnhancement.addEventListener('change', () => {
            const inputEnhancement = {
                ...this.settings.chatgptBehavior.inputEnhancement,
                available: this.refs.chatgptDirectory.inputEnhancement.checked,
                ...(this.refs.chatgptDirectory.inputEnhancement.checked ? { enabled: true } : {}),
            };
            this.settings.chatgptBehavior.inputEnhancement = inputEnhancement;
            void this.actions.setChatGptBehaviorSettings?.({ inputEnhancement });
        });
        this.refs.chatgptDirectory.promptAutocomplete.addEventListener('change', () => {
            const next = this.refs.chatgptDirectory.promptAutocomplete.checked;
            this.settings.chatgptBehavior.promptAutocomplete = next;
            void this.actions.setChatGptBehaviorSettings?.({ promptAutocomplete: next });
        });
        this.refs.chatgptDirectory.pageAnnotationsEnabled.addEventListener('change', () => {
            const next = this.refs.chatgptDirectory.pageAnnotationsEnabled.checked;
            this.settings.chatgptBehavior.pageAnnotationsEnabled = next;
            void this.actions.setChatGptBehaviorSettings?.({ pageAnnotationsEnabled: next });
        });
        this.refs.chatgptDirectory.showPageSelectionToolbar.addEventListener('change', () => {
            const next = this.refs.chatgptDirectory.showPageSelectionToolbar.checked;
            this.settings.chatgptBehavior.showPageSelectionToolbar = next;
            void this.actions.setChatGptBehaviorSettings?.({ showPageSelectionToolbar: next });
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
        this.refs.chatgptDirectory.navigationSeekStep.input.addEventListener('input', () => {
            this.syncSliderValue(this.refs.chatgptDirectory.navigationSeekStep);
        });
        this.refs.chatgptDirectory.navigationSeekStep.input.addEventListener('change', () => {
            const next = normalizeChatGPTNavigationSeekStepPx(this.refs.chatgptDirectory.navigationSeekStep.input.value);
            this.settings.chatgptBehavior.navigationSeekStepPx = next;
            this.syncSliderValue(this.refs.chatgptDirectory.navigationSeekStep, next);
            void this.actions.setChatGptBehaviorSettings?.({ navigationSeekStepPx: next });
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
        this.refs.chatgptDirectory.previewMaxChars.input.addEventListener('input', () => {
            this.syncSliderValue(this.refs.chatgptDirectory.previewMaxChars);
        });
        this.refs.chatgptDirectory.previewMaxChars.input.addEventListener('change', () => {
            const next = normalizeChatGPTDirectoryPreviewMaxChars(this.refs.chatgptDirectory.previewMaxChars.input.value);
            this.settings.chatgptDirectory.previewMaxChars = next;
            this.syncSliderValue(this.refs.chatgptDirectory.previewMaxChars, next);
            void this.actions.setChatGptDirectorySettings?.({ previewMaxChars: next });
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
        this.refs.reader.persistAnnotations.addEventListener('change', () => {
            const next = this.refs.reader.persistAnnotations.checked;
            this.settings.reader.persistAnnotations = next;
            void this.actions.setReaderSettings?.({ persistAnnotations: next });
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
        this.refs.reader.promptsButton.addEventListener('click', () => {
            void this.onOpenPromptManager?.(this.refs.reader.promptsButton);
        });
        this.refs.reader.templateButton.addEventListener('click', () => {
            this.openReaderCommentTemplateSettings();
        });
        // Language
        this.refs.language.onChange((value) => {
            const next = value as AppSettings['language'];
            const revision = ++this.languageChangeRevision;
            this.languageSaveQueue = this.languageSaveQueue
                .catch(() => undefined)
                .then(() => this.persistLanguageChange(next, revision));
        });
    }

    private readonly onOpenPromptManager?: (anchor: HTMLElement) => Promise<void> | void;

    private async persistLanguageChange(
        next: AppSettings['language'],
        revision: number,
    ): Promise<void> {
        let persisted = true;
        try {
            persisted = (await this.actions.setLanguage?.(next)) !== false;
        } catch {
            persisted = false;
        }

        if (persisted) {
            this.settings.language = next;
        }
        if (revision !== this.languageChangeRevision) return;

        const appliedLocale = persisted ? next : this.settings.language;
        this.refs.language.setValue(appliedLocale);
        if (getLocale() !== appliedLocale) {
            await setLocale(appliedLocale);
        }
    }

    private applySettingsToDom(): void {
        this.buttonsView?.setState(this.settings);
        const s = this.settings;
        const usagePercent = this.formatPercent(this.storageUsage?.usedPercentage);
        this.refs.platforms.chatgpt.checked = Boolean(s.platforms.chatgpt);

        this.refs.behavior.showMessageToolbar.checked = Boolean(s.behavior.showMessageToolbar);
        this.refs.behavior.showSaveMessages.checked = Boolean(s.behavior.showSaveMessages);
        this.refs.behavior.showWordCount.checked = Boolean(s.behavior.showWordCount);
        this.refs.behavior.saveContextOnly.checked = Boolean(s.behavior.saveContextOnly);
        this.refs.formula.clickCopyMarkdown.checked = Boolean(s.formula.clickCopyMarkdown);
        this.refs.formula.clickCopyFormulaFormat.setValue(s.formula.clickCopyFormulaFormat);
        this.refs.formula.markdownCopyFormulaFormat.setValue(s.formula.markdownCopyFormulaFormat);
        this.syncSliderValue(this.refs.formula.assetFontSize, normalizeFormulaAssetFontSizePx(s.formula.assetFontSizePx));
        this.refs.export.pngWidthPreset.setValue(s.export.pngWidthPreset);
        this.syncSliderValue(this.refs.export.pngWidth, resolvePngExportWidth(s.export));
        this.refs.export.pngWidth.input.disabled = s.export.pngWidthPreset !== 'custom';
        this.refs.export.pngWidth.field.dataset.disabled = this.refs.export.pngWidth.input.disabled ? '1' : '0';
        this.syncSliderValue(this.refs.export.pngPixelRatio, resolvePngExportPixelRatio(s.export));
        this.refs.chatgptDirectory.restorePositionAfterSend.checked = Boolean(s.chatgptBehavior.restorePositionAfterSend);
        this.refs.chatgptDirectory.atomicMarkdownCopyShortcut.setValue(
            normalizeChatGPTAtomicMarkdownCopyShortcut(s.chatgptBehavior.atomicMarkdownCopyShortcut),
        );
        this.refs.chatgptDirectory.inputEnhancement.checked = Boolean(s.chatgptBehavior.inputEnhancement.available && s.chatgptBehavior.inputEnhancement.enabled);
        this.refs.chatgptDirectory.promptAutocomplete.checked = Boolean(s.chatgptBehavior.promptAutocomplete);
        this.refs.chatgptDirectory.pageAnnotationsEnabled.checked = Boolean(s.chatgptBehavior.pageAnnotationsEnabled);
        this.refs.chatgptDirectory.showPageSelectionToolbar.checked = Boolean(s.chatgptBehavior.showPageSelectionToolbar);
        this.refs.chatgptDirectory.showMessageStepper.checked = Boolean(s.chatgptBehavior.showMessageStepper);
        this.refs.chatgptDirectory.showPageBookmarkControl.checked = Boolean(s.chatgptBehavior.showPageBookmarkControl);
        this.refs.chatgptDirectory.showDetachedReaderControl.checked = Boolean(s.chatgptBehavior.showDetachedReaderControl);
        this.refs.chatgptDirectory.showPromptControl.checked = Boolean(s.chatgptBehavior.showPromptControl);
        this.refs.chatgptDirectory.arrowKeyMessageNavigation.checked = Boolean(s.chatgptBehavior.enableArrowKeyMessageNavigation);
        this.syncSliderValue(this.refs.chatgptDirectory.pageWidthScale, normalizeChatGPTPageWidthScale(s.chatgptBehavior.pageWidthScale));
        this.syncSliderValue(this.refs.chatgptDirectory.navigationSeekStep, normalizeChatGPTNavigationSeekStepPx(s.chatgptBehavior.navigationSeekStepPx));
        this.refs.chatgptDirectory.enabled.checked = Boolean(s.chatgptDirectory.enabled);
        this.refs.chatgptDirectory.mode.setValue(s.chatgptDirectory.mode === 'expanded' ? 'expanded' : 'preview');
        this.refs.chatgptDirectory.promptLabelMode.checked = s.chatgptDirectory.promptLabelMode === 'headTail';
        this.syncSliderValue(this.refs.chatgptDirectory.rightInset, normalizeChatGPTDirectoryRightInsetPx(s.chatgptDirectory.rightInsetPx));
        this.syncSliderValue(this.refs.chatgptDirectory.previewMaxChars, normalizeChatGPTDirectoryPreviewMaxChars(s.chatgptDirectory.previewMaxChars));
        this.refs.reader.defaultOpenMode.setValue(normalizeReaderOpenMode(s.reader.defaultOpenMode));
        this.refs.reader.renderCode.checked = Boolean(s.reader.renderCodeInReader);
        this.refs.reader.showOutline.checked = Boolean(s.reader.showOutlineInReader);
        this.refs.reader.persistAnnotations.checked = Boolean(s.reader.persistAnnotations);
        this.refs.reader.promptPositionBottom.checked = s.reader.commentExport?.promptPosition === 'bottom';
        this.refs.reader.promptsSummary.textContent = this.formatReaderPromptSummary();
        this.refs.reader.templateSummary.textContent = this.formatReaderTemplateSummary(s.reader.commentExport?.template ?? []);
        this.refs.language.setValue(s.language);

        this.syncToggle(this.refs.platforms.chatgpt);
        this.syncToggle(this.refs.behavior.showMessageToolbar);
        this.syncToggle(this.refs.behavior.showSaveMessages);
        this.syncToggle(this.refs.behavior.showWordCount);
        this.syncToggle(this.refs.behavior.saveContextOnly);
        this.syncToggle(this.refs.formula.clickCopyMarkdown);
        this.syncToggle(this.refs.chatgptDirectory.restorePositionAfterSend);
        this.syncToggle(this.refs.chatgptDirectory.inputEnhancement);
        this.syncToggle(this.refs.chatgptDirectory.promptAutocomplete);
        this.syncToggle(this.refs.chatgptDirectory.pageAnnotationsEnabled);
        this.syncToggle(this.refs.chatgptDirectory.showPageSelectionToolbar);
        this.syncToggle(this.refs.chatgptDirectory.showMessageStepper);
        this.syncToggle(this.refs.chatgptDirectory.showPageBookmarkControl);
        this.syncToggle(this.refs.chatgptDirectory.showDetachedReaderControl);
        this.syncToggle(this.refs.chatgptDirectory.showPromptControl);
        this.syncToggle(this.refs.chatgptDirectory.arrowKeyMessageNavigation);
        this.syncToggle(this.refs.chatgptDirectory.enabled);
        this.syncToggle(this.refs.chatgptDirectory.promptLabelMode);
        this.syncToggle(this.refs.reader.renderCode);
        this.syncToggle(this.refs.reader.showOutline);
        this.syncToggle(this.refs.reader.persistAnnotations);
        this.syncToggle(this.refs.reader.promptPositionBottom);

        this.extraSync.forEach(sync => sync());
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

    private refreshDiscoveryDiagnostics(): void {
        if (!this.diagnosticsSummary) return;
        const snapshot = this.readDiscoveryDiagnostics?.() ?? null;
        if (!snapshot) {
            this.diagnosticsSummary.textContent = t('settingsDiscoveryDiagnosticsUnavailable');
            this.diagnosticsCopyButton.hidden = true;
            return;
        }
        this.diagnosticsCopyButton.hidden = false;
        const rejectionTotal = Object.values(snapshot.hostMonitor.compileRejections)
            .reduce((sum, count) => sum + count, 0);
        const parts = [
            `basis=${snapshot.basis ?? 'none'}`,
            `history=${snapshot.historyStatus}`,
            `turns=${snapshot.repository.turnCount}`,
            `rejected=${rejectionTotal}`,
            'source=dom',
        ];
        this.diagnosticsSummary.textContent = `${t('settingsDiscoveryDiagnosticsDesc')} — ${parts.join(' · ')}`;
    }

    private async copyDiscoveryDiagnostics(): Promise<void> {
        const snapshot = this.readDiscoveryDiagnostics?.() ?? null;
        if (!snapshot) return;
        const ok = await copyTextToClipboard(JSON.stringify(snapshot, null, 2));
        if (!ok) return;
        this.diagnosticsCopyButton.textContent = t('settingsDiscoveryDiagnosticsCopied');
        window.setTimeout(() => {
            this.diagnosticsCopyButton.textContent = t('settingsDiscoveryDiagnosticsCopy');
        }, 1500);
    }

    private createGroup(): { root: HTMLElement; body: HTMLElement } {
        const root = document.createElement('div');
        return { root, body: root };
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
        knob.setAttribute('data-aimd-switch-track', '');
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
        button.appendChild(createIcon(settingsIcon));

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

        const body = document.createElement('div');
        body.className = 'settings-advanced-body';
        body.dataset.role = 'settings-advanced-body';

        root.append(body);
        return { root, body };
    }

    private renderAdvancedSettings(): void {
        if (this.refs.advanced.fontSize) { this.syncFontSizeStepper(this.refs.advanced.fontSize); this.syncAccentColorSwatches(); return; }
        const { body } = this.refs.advanced;
        body.replaceChildren();

        const appearanceSection = document.createElement('div');
        appearanceSection.className = 'settings-advanced-section';
        const fontSize = this.createStepperRow(
            appearanceSection,
            t('globalFontSizeLabel'),
            '',
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
            '',
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

        const custom = document.createElement('button');
        custom.type = 'button';
        custom.className = 'settings-color-swatch settings-color-swatch--custom';
        custom.dataset.role = 'settings-accent-custom';
        custom.setAttribute('role', 'radio');
        custom.setAttribute('aria-label', t('themeAccentCustom'));
        custom.title = t('themeAccentCustom');
        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'settings-accent-rgb-input';
        input.dataset.role = 'settings-accent-rgb';
        input.placeholder = 'RRGGBB';
        input.maxLength = 7;
        input.autocomplete = 'off';
        input.setAttribute('aria-label', t('themeAccentRgbLabel'));
        input.hidden = true;
        this.customAccentButton = custom;
        this.customAccentInput = input;
        custom.addEventListener('click', () => {
            input.value = formatAccentRgb(this.normalizeAccentColor(this.settings.appearance?.accentColor));
            input.removeAttribute('aria-invalid');
            custom.hidden = true;
            input.hidden = false;
            input.focus();
            input.select();
        });
        input.addEventListener('input', () => { input.value = input.value.replace(/#/g, ''); input.removeAttribute('aria-invalid'); });
        input.addEventListener('keydown', event => {
            if (event.key === 'Enter') { event.preventDefault(); event.stopPropagation(); void this.commitCustomAccent(); }
            if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); input.hidden = true; custom.hidden = false; custom.focus(); }
        });
        input.addEventListener('blur', () => { if (!input.hidden) void this.commitCustomAccent(); });
        field.append(custom, input);
        item.append(info, field);
        parent.appendChild(item);
    }

    private async commitCustomAccent(): Promise<void> {
        const input = this.customAccentInput;
        if (!input || input.hidden || this.customAccentPending || this.dataState.kind !== 'ready' || !this.actions.setAppearanceSettings) return;
        const color = parseAccentRgb(input.value);
        if (!color) { input.setAttribute('aria-invalid', 'true'); input.title = t('themeAccentRgbInvalid'); return; }
        const next = color === THEME_ACCENT_SWATCHES[0].value ? null : color;
        this.customAccentPending = true;
        input.disabled = true;
        try {
            const saved = await this.actions.setAppearanceSettings?.({ accentColor: next });
            if (saved === false) return;
            this.settings.appearance = { ...this.settings.appearance, accentColor: next };
            input.hidden = true;
            if (this.customAccentButton) this.customAccentButton.hidden = false;
            this.syncAccentColorSwatches();
        } catch { input.setAttribute('aria-invalid', 'true'); input.title = t('settingsTransferFailed'); }
        finally { this.customAccentPending = false; input.disabled = this.dataState.kind !== 'ready'; }
    }

    private syncAccentColorSwatches(): void {
        const selected = this.normalizeAccentColor(this.settings.appearance?.accentColor) ?? THEME_ACCENT_SWATCHES[0].value;
        if (this.customAccentButton) {
            const custom = !THEME_ACCENT_SWATCHES.some(swatch => swatch.value === selected);
            this.customAccentButton.dataset.selected = custom ? '1' : '0';
            this.customAccentButton.setAttribute('aria-checked', String(custom));
            this.customAccentButton.style.setProperty('--_settings-accent-color', custom ? selected : 'var(--aimd-bg-surface)');
            this.customAccentButton.style.background = custom ? selected : '';
        }
        this.root.querySelectorAll<HTMLButtonElement>('[data-role="settings-accent-color-swatch"]').forEach((button) => {
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
            composerAssetActions: { ...DEFAULT_FORMULA_SETTINGS.composerAssetActions!, ...record.composerAssetActions },
            assetActions: {
                copyPng: Boolean(assetActions.copyPng ?? DEFAULT_FORMULA_SETTINGS.assetActions.copyPng),
                copySvg: Boolean(assetActions.copySvg ?? DEFAULT_FORMULA_SETTINGS.assetActions.copySvg),
                copyMathml: Boolean(assetActions.copyMathml ?? DEFAULT_FORMULA_SETTINGS.assetActions.copyMathml),
                savePng: Boolean(assetActions.savePng ?? DEFAULT_FORMULA_SETTINGS.assetActions.savePng),
                saveSvg: Boolean(assetActions.saveSvg ?? DEFAULT_FORMULA_SETTINGS.assetActions.saveSvg),
            },
        };
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

    private formatPercent(value: number | null | undefined): string {
        if (typeof value !== 'number' || !Number.isFinite(value)) return '0%';
        const normalized = Math.max(0, Math.min(100, value));
        const rounded = Math.round(normalized * 10) / 10;
        return Number.isInteger(rounded) ? `${rounded}%` : `${rounded.toFixed(1)}%`;
    }
}
