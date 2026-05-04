import type { AppSettings } from '../../../../../core/settings/types';
import {
    DEFAULT_SETTINGS,
    MAX_READER_CONTENT_MAX_WIDTH_PX,
    MIN_READER_CONTENT_MAX_WIDTH_PX,
    READER_CONTENT_MAX_WIDTH_STEP_PX,
} from '../../../../../core/settings/types';
import {
    MAX_PNG_EXPORT_PIXEL_RATIO,
    MAX_PNG_EXPORT_WIDTH,
    MIN_PNG_EXPORT_PIXEL_RATIO,
    MIN_PNG_EXPORT_WIDTH,
    PNG_EXPORT_PIXEL_RATIO_STEP,
    PNG_EXPORT_WIDTH_STEP,
    resolvePngExportPixelRatio,
    resolvePngExportWidth,
    type PngExportWidthPreset,
} from '../../../../../core/settings/export';
import {
    createDefaultCommentTemplate as createDefaultAnnotationTemplate,
    createDefaultReaderCommentPrompts as createDefaultAnnotationPrompts,
    normalizeReaderCommentExportSettings,
    type CommentTemplateSegment,
    type ReaderCommentExportSettings,
} from '../../../../../core/settings/readerCommentExport';
import type { BookmarksStorageUsageResponse } from '../../../../../contracts/protocol';
import { DEFAULT_FORMULA_SETTINGS, type FormulaSettings } from '../../../../../core/settings/formula';
import type { ModalHost } from '../../../components/ModalHost';
import { setLocale, t } from '../../../components/i18n';
import { createIcon } from '../../../components/Icon';
import { Icons } from '../../../../../assets/icons';
import { buildCommentsExport, normalizeCommentTemplate } from '../../../../../services/reader/commentExport';
import {
    installTransientOutsideDismissBoundary,
    type TransientOutsideDismissBoundaryHandle,
} from '../../../components/transientUi';
import { createBookmarksInlineSelect, createBookmarksInlineSelectControl } from '../components/BookmarksInlineSelect';
import { ReaderPromptSettingsPopover } from '../popovers/ReaderPromptSettingsPopover';
import { ReaderCommentTemplateSettingsPopover } from '../popovers/ReaderCommentTemplateSettingsPopover';
import { FormulaAssetSettingsPopover } from '../popovers/FormulaAssetSettingsPopover';

export type SettingsTabViewActions = {
    loadState?: () => Promise<{ settings: AppSettings; storageUsage: BookmarksStorageUsageResponse | null } | null>;
    setPlatforms?: (patch: Partial<AppSettings['platforms']>) => Promise<void> | void;
    setBehaviorSettings?: (patch: Partial<AppSettings['behavior']>) => Promise<void> | void;
    setReaderSettings?: (patch: Partial<AppSettings['reader']>) => Promise<void> | void;
    setFormulaSettings?: (patch: Partial<AppSettings['formula']>) => Promise<void> | void;
    setExportSettings?: (patch: Partial<AppSettings['export']>) => Promise<void> | void;
    setChatGptDirectorySettings?: (patch: Partial<AppSettings['chatgptDirectory']>) => Promise<void> | void;
    setLanguage?: (value: AppSettings['language']) => Promise<void> | void;
    exportAllBookmarks?: () => Promise<void> | void;
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

type NumberFieldRef = {
    root: HTMLElement;
    field: HTMLElement;
    input: HTMLInputElement;
};

type Refs = {
    platforms: Record<'chatgpt' | 'gemini' | 'claude' | 'deepseek', HTMLInputElement>;
    behavior: {
        showSaveMessages: HTMLInputElement;
        showWordCount: HTMLInputElement;
        saveContextOnly: HTMLInputElement;
    };
    formula: {
        clickCopyMarkdown: HTMLInputElement;
        assetActionsButton: HTMLButtonElement;
        assetActionsSummary: HTMLElement;
    };
    reader: {
        renderCodeInReader: HTMLInputElement;
        promptPositionBottom: HTMLInputElement;
        promptsButton: HTMLButtonElement;
        promptsSummary: HTMLElement;
        templateButton: HTMLButtonElement;
        templateSummary: HTMLElement;
    };
    advanced: {
        root: HTMLElement;
        button: HTMLButtonElement;
        body: HTMLElement;
    };
    export: {
        pngWidthPreset: SelectRef;
        pngWidth: NumberFieldRef;
        pngPixelRatio: NumberFieldRef;
    };
    chatgptDirectory: {
        enabled: HTMLInputElement;
        mode: SelectRef;
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
    private readonly promptSettingsPopover = new ReaderPromptSettingsPopover();
    private readonly templateSettingsPopover = new ReaderCommentTemplateSettingsPopover();
    private readonly formulaAssetSettingsPopover = new FormulaAssetSettingsPopover();
    private readonly outsideDismissBoundary: TransientOutsideDismissBoundaryHandle;
    private advancedExpanded = false;

    constructor(params: { modal: ModalHost; actions?: SettingsTabViewActions }) {
        this.modal = params.modal;
        this.actions = params.actions ?? {};

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
            gemini: this.createToggle(platformsGroup.body, `${Icons.gemini} Gemini`, t('enableOnGemini')),
            claude: this.createToggle(platformsGroup.body, `${Icons.claude} Claude`, t('enableOnClaude')),
            deepseek: this.createToggle(platformsGroup.body, `${Icons.deepseek} DeepSeek`, t('enableOnDeepseek')),
        };

        // Behavior group
        const behaviorGroup = this.createGroup(Icons.settings, t('behavior'));
        const showSaveMessages = this.createToggle(behaviorGroup.body, t('saveMessagesLabel'), t('saveMessagesDesc'));
        const showWordCount = this.createToggle(behaviorGroup.body, t('wordCountLabel'), t('wordCountDesc'));
        const saveContextOnly = this.createToggle(behaviorGroup.body, t('contextOnlySaveLabel'), t('contextOnlySaveDesc'));

        const formulaGroup = this.createGroup(Icons.sigma, t('formulaSettingsLabel'));
        const formulaClickCopyMarkdown = this.createToggle(
            formulaGroup.body,
            t('formulaClickCopyMarkdownLabel'),
            t('formulaClickCopyMarkdownDesc'),
        );
        const formulaAssetActions = this.createActionRow(
            formulaGroup.body,
            t('formulaAssetActionsLabel'),
            t('formulaAssetActionsDesc'),
            'settings-formula-asset-actions',
        );

        const readerGroup = this.createGroup(Icons.bookOpen, t('readerSettingsLabel'));
        const renderCodeInReader = this.createToggle(readerGroup.body, t('renderCodeBlocksLabel'), t('renderCodeBlocksDesc'));
        const promptPositionBottom = this.createToggle(
            readerGroup.body,
            t('readerCommentPromptPositionBottomLabel'),
            t('readerCommentPromptPositionBottomDesc'),
        );
        const promptsRow = this.createActionRow(
            readerGroup.body,
            t('readerCommentPromptListLabel'),
            t('readerCommentPromptListDesc'),
            'settings-reader-prompts',
        );
        const templateRow = this.createActionRow(
            readerGroup.body,
            t('readerCommentTemplateSettingsLabel'),
            t('readerCommentTemplateSettingsDesc'),
            'settings-reader-template',
        );

        const exportGroup = this.createGroup(Icons.download, t('export'));
        const pngExportWidth = this.createPngExportWidthRow(
            exportGroup.body,
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
        const pngPixelRatio = this.createNumberRow(
            exportGroup.body,
            t('pngExportPixelRatioLabel'),
            t('pngExportPixelRatioDesc'),
            MIN_PNG_EXPORT_PIXEL_RATIO,
            MAX_PNG_EXPORT_PIXEL_RATIO,
            PNG_EXPORT_PIXEL_RATIO_STEP,
            'settings-export-pixel-ratio-value',
        );

        const chatGptDirectoryGroup = this.createGroup(Icons.chatgpt, t('chatgptDirectorySettingsLabel'));
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

        // Language group
        const languageGroup = this.createGroup(Icons.languages, t('settingsLanguageLabel'));
        const language = this.createSelect(languageGroup.body, t('settingsLanguageLabel'), t('settingsLanguageDesc'), [
            { value: 'auto', label: t('languageAuto') },
            { value: 'en', label: t('languageEnglish') },
            { value: 'zh_CN', label: t('languageZhCN') },
        ], 'language');

        // Data & storage group (legacy shows storage usage + export)
        const storageGroup = this.createGroup(Icons.database, t('dataAndStorage'));
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
        storageGroup.body.appendChild(storageInfo);

        const backup = document.createElement('div');
        backup.className = 'settings-backup-warning';
        backup.innerHTML = `
          <div class="settings-item-info">
            <span class="settings-item-label">${t('backupTitle')}</span>
            <span class="settings-item-warning-text">${t('backupWarning')}</span>
          </div>
        `;
        const exportBtn = document.createElement('button');
        exportBtn.type = 'button';
        exportBtn.className = 'export-backup-btn';
        exportBtn.innerHTML = `${Icons.download} ${t('exportAllBtn')}`;
        exportBtn.addEventListener('click', () => void this.actions.exportAllBookmarks?.());
        backup.appendChild(exportBtn);
        storageGroup.body.appendChild(backup);

        const advancedGroup = this.createAdvancedSettingsGroup();

        content.append(
            platformsGroup.root,
            behaviorGroup.root,
            formulaGroup.root,
            readerGroup.root,
            exportGroup.root,
            chatGptDirectoryGroup.root,
            languageGroup.root,
            storageGroup.root,
            advancedGroup.root,
        );
        scroll.appendChild(content);
        this.root.appendChild(scroll);

        const storageText = storageInfo.querySelector<HTMLElement>('[data-field="storage_usage"]')!;

        this.refs = {
            platforms: {
                chatgpt: platforms.chatgpt.input,
                gemini: platforms.gemini.input,
                claude: platforms.claude.input,
                deepseek: platforms.deepseek.input,
            },
            behavior: {
                showSaveMessages: showSaveMessages.input,
                showWordCount: showWordCount.input,
                saveContextOnly: saveContextOnly.input,
            },
            formula: {
                clickCopyMarkdown: formulaClickCopyMarkdown.input,
                assetActionsButton: formulaAssetActions.button,
                assetActionsSummary: formulaAssetActions.summary,
            },
            reader: {
                renderCodeInReader: renderCodeInReader.input,
                promptPositionBottom: promptPositionBottom.input,
                promptsButton: promptsRow.button,
                promptsSummary: promptsRow.summary,
                templateButton: templateRow.button,
                templateSummary: templateRow.summary,
            },
            advanced: advancedGroup,
            export: {
                pngWidthPreset: pngExportWidth.preset,
                pngWidth: pngExportWidth.width,
                pngPixelRatio,
            },
            chatgptDirectory: {
                enabled: chatGptDirectoryEnabled.input,
                mode: chatGptDirectoryMode,
            },
            language,
            storageText,
        };
        this.refs.platforms.chatgpt.dataset.role = 'settings-platform-chatgpt';
        this.refs.platforms.gemini.dataset.role = 'settings-platform-gemini';
        this.refs.platforms.claude.dataset.role = 'settings-platform-claude';
        this.refs.platforms.deepseek.dataset.role = 'settings-platform-deepseek';
        this.refs.behavior.showSaveMessages.dataset.role = 'settings-show-save-messages';
        this.refs.behavior.showWordCount.dataset.role = 'settings-show-word-count';
        this.refs.behavior.saveContextOnly.dataset.role = 'settings-save-context-only';
        this.refs.formula.clickCopyMarkdown.dataset.role = 'settings-formula-click-copy-markdown';
        this.refs.formula.assetActionsButton.dataset.role = 'settings-formula-asset-actions';
        this.refs.reader.renderCodeInReader.dataset.role = 'settings-render-code-reader';
        this.refs.reader.promptPositionBottom.dataset.role = 'settings-reader-prompt-position-bottom';
        this.refs.reader.promptsButton.dataset.role = 'settings-reader-prompts';
        this.refs.reader.templateButton.dataset.role = 'settings-reader-template';
        this.refs.export.pngWidthPreset.trigger.dataset.role = 'settings-export-png-width-preset';
        this.refs.export.pngWidth.input.dataset.role = 'settings-export-png-width';
        this.refs.export.pngPixelRatio.input.dataset.role = 'settings-export-png-pixel-ratio';
        this.refs.chatgptDirectory.enabled.dataset.role = 'settings-chatgpt-directory-enabled';
        this.refs.chatgptDirectory.mode.trigger.dataset.role = 'settings-chatgpt-directory-mode';
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
        this.promptSettingsPopover.close();
        this.templateSettingsPopover.close();
        this.formulaAssetSettingsPopover.close();
    }

    consumeEscape(): boolean {
        if (this.templateSettingsPopover.isOpen()) {
            this.templateSettingsPopover.close();
            return true;
        }
        if (this.promptSettingsPopover.isOpen()) {
            this.promptSettingsPopover.close();
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
            chatgptDirectory: { ...DEFAULT_SETTINGS.chatgptDirectory, ...params.settings.chatgptDirectory },
            bookmarks: { ...DEFAULT_SETTINGS.bookmarks, ...params.settings.bookmarks },
            reader: {
                renderCodeInReader: Boolean(
                    params.settings.reader?.renderCodeInReader ?? DEFAULT_SETTINGS.reader.renderCodeInReader,
                ),
                contentMaxWidthPx: params.settings.reader?.contentMaxWidthPx ?? DEFAULT_SETTINGS.reader.contentMaxWidthPx,
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

    private bindHandlers(): void {
        // Platforms
        for (const key of Object.keys(this.refs.platforms) as Array<keyof Refs['platforms']>) {
            this.refs.platforms[key].addEventListener('change', () => {
                this.settings.platforms[key] = this.refs.platforms[key].checked;
                void this.actions.setPlatforms?.({ [key]: this.settings.platforms[key] });
            });
        }

        // Behavior + reader
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
        this.refs.formula.assetActionsButton.addEventListener('click', (event) => {
            event.preventDefault();
            this.openFormulaAssetSettingsPopover();
        });
        this.refs.reader.renderCodeInReader.addEventListener('change', () => {
            const next = this.refs.reader.renderCodeInReader.checked;
            this.settings.reader.renderCodeInReader = next;
            void this.actions.setReaderSettings?.({ renderCodeInReader: next });
        });
        this.refs.reader.promptPositionBottom.addEventListener('change', () => {
            const next = this.getReaderCommentExport();
            next.promptPosition = this.refs.reader.promptPositionBottom.checked ? 'bottom' : 'top';
            this.updateReaderCommentExport(next);
        });
        this.refs.reader.promptsButton.addEventListener('click', (event) => {
            event.preventDefault();
            this.openPromptSettingsPopover();
        });
        this.refs.reader.templateButton.addEventListener('click', (event) => {
            event.preventDefault();
            this.openTemplateSettingsPopover();
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
        this.refs.export.pngWidth.input.addEventListener('change', () => {
            const raw = Number.parseInt(this.refs.export.pngWidth.input.value, 10);
            if (!Number.isFinite(raw)) {
                this.applySettingsToDom();
                return;
            }
            this.settings.export.pngCustomWidth = raw;
            this.applySettingsToDom();
            void this.actions.setExportSettings?.({ pngCustomWidth: raw });
        });
        this.refs.export.pngPixelRatio.input.addEventListener('change', () => {
            const raw = Number.parseFloat(this.refs.export.pngPixelRatio.input.value);
            if (!Number.isFinite(raw)) {
                this.applySettingsToDom();
                return;
            }
            this.settings.export.pngPixelRatio = raw;
            this.applySettingsToDom();
            void this.actions.setExportSettings?.({ pngPixelRatio: raw });
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
        // Language
        this.refs.language.onChange((value) => {
            this.settings.language = value as any;
            void this.actions.setLanguage?.(value as AppSettings['language']);
            void setLocale(value as AppSettings['language']);
        });
    }

    private applySettingsToDom(): void {
        const s = this.settings;
        const commentExport = this.getReaderCommentExport();
        const usagePercent = this.formatPercent(this.storageUsage?.usedPercentage);
        this.refs.platforms.chatgpt.checked = Boolean(s.platforms.chatgpt);
        this.refs.platforms.gemini.checked = Boolean(s.platforms.gemini);
        this.refs.platforms.claude.checked = Boolean(s.platforms.claude);
        this.refs.platforms.deepseek.checked = Boolean(s.platforms.deepseek);

        this.refs.behavior.showSaveMessages.checked = Boolean(s.behavior.showSaveMessages);
        this.refs.behavior.showWordCount.checked = Boolean(s.behavior.showWordCount);
        this.refs.behavior.saveContextOnly.checked = Boolean(s.behavior.saveContextOnly);
        this.refs.formula.clickCopyMarkdown.checked = Boolean(s.formula.clickCopyMarkdown);
        this.refs.formula.assetActionsSummary.textContent = this.formatFormulaAssetActionsSummary(s.formula);
        this.refs.reader.renderCodeInReader.checked = Boolean(s.reader.renderCodeInReader);
        this.refs.reader.promptPositionBottom.checked = commentExport.promptPosition === 'bottom';
        this.refs.reader.promptsSummary.textContent = this.formatPromptSummary(commentExport);
        this.refs.reader.templateSummary.textContent = this.formatTemplateSummary(commentExport.template);
        this.refs.export.pngWidthPreset.setValue(s.export.pngWidthPreset);
        this.refs.export.pngWidth.input.value = String(resolvePngExportWidth(s.export));
        this.refs.export.pngWidth.input.disabled = s.export.pngWidthPreset !== 'custom';
        this.refs.export.pngWidth.field.dataset.disabled = this.refs.export.pngWidth.input.disabled ? '1' : '0';
        this.refs.export.pngPixelRatio.input.value = String(resolvePngExportPixelRatio(s.export));
        this.refs.chatgptDirectory.enabled.checked = Boolean(s.chatgptDirectory.enabled);
        this.refs.chatgptDirectory.mode.setValue(s.chatgptDirectory.mode);
        this.refs.language.setValue(s.language);

        this.syncToggle(this.refs.platforms.chatgpt);
        this.syncToggle(this.refs.platforms.gemini);
        this.syncToggle(this.refs.platforms.claude);
        this.syncToggle(this.refs.platforms.deepseek);
        this.syncToggle(this.refs.behavior.showSaveMessages);
        this.syncToggle(this.refs.behavior.showWordCount);
        this.syncToggle(this.refs.behavior.saveContextOnly);
        this.syncToggle(this.refs.formula.clickCopyMarkdown);
        this.syncToggle(this.refs.reader.renderCodeInReader);
        this.syncToggle(this.refs.reader.promptPositionBottom);
        this.syncToggle(this.refs.chatgptDirectory.enabled);

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
    ): { preset: SelectRef; width: NumberFieldRef } {
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

        const width = this.createNumberField(min, max, step);
        width.field.classList.add('settings-export-width-value');
        controls.append(preset.shell, width.field);
        item.append(info, controls);
        parent.appendChild(item);
        return { preset, width };
    }

    private createNumberRow(
        parent: HTMLElement,
        labelText: string,
        desc: string,
        min: number,
        max: number,
        step: number,
        valueClassName: string,
    ): NumberFieldRef {
        const item = document.createElement('div');
        item.className = 'settings-row settings-item';
        const info = document.createElement('div');
        info.className = 'settings-label settings-item-info';
        const label = document.createElement('strong');
        label.textContent = labelText;
        const summary = document.createElement('p');
        summary.textContent = desc;
        info.append(label, summary);

        const field = this.createNumberField(min, max, step);
        field.field.classList.add(valueClassName);
        item.append(info, field.field);
        parent.appendChild(item);
        return field;
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

        const readerSection = document.createElement('div');
        readerSection.className = 'settings-advanced-section';
        const title = document.createElement('h4');
        title.className = 'settings-advanced-section__title';
        title.textContent = t('readerSettingsLabel');
        readerSection.appendChild(title);
        const width = this.createNumberRow(
            readerSection,
            t('readerContentWidthLabel'),
            t('readerContentWidthDesc'),
            MIN_READER_CONTENT_MAX_WIDTH_PX,
            MAX_READER_CONTENT_MAX_WIDTH_PX,
            READER_CONTENT_MAX_WIDTH_STEP_PX,
            'settings-reader-content-width-value',
        );
        width.input.dataset.role = 'settings-reader-content-width';
        width.input.value = String(this.settings.reader.contentMaxWidthPx ?? DEFAULT_SETTINGS.reader.contentMaxWidthPx);
        width.input.addEventListener('change', () => {
            const raw = Number.parseInt(width.input.value, 10);
            if (!Number.isFinite(raw)) {
                this.applySettingsToDom();
                return;
            }
            this.settings.reader.contentMaxWidthPx = this.normalizeReaderContentWidth(raw);
            width.input.value = String(this.settings.reader.contentMaxWidthPx);
            this.applySettingsToDom();
            void this.actions.setReaderSettings?.({ contentMaxWidthPx: raw });
        });

        body.appendChild(readerSection);
    }

    private normalizeReaderContentWidth(value: number): number {
        const clamped = Math.min(MAX_READER_CONTENT_MAX_WIDTH_PX, Math.max(MIN_READER_CONTENT_MAX_WIDTH_PX, value));
        return Math.round(clamped / READER_CONTENT_MAX_WIDTH_STEP_PX) * READER_CONTENT_MAX_WIDTH_STEP_PX;
    }

    private createNumberField(min: number, max: number, step: number): NumberFieldRef {
        const field = document.createElement('div');
        field.className = 'settings-number-field';
        field.dataset.disabled = '0';

        const input = document.createElement('input');
        input.type = 'number';
        input.className = 'settings-number';
        input.min = String(min);
        input.max = String(max);
        input.step = String(step);
        input.inputMode = Number.isInteger(step) ? 'numeric' : 'decimal';
        field.appendChild(input);
        return { root: field, field, input };
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

    private closeSelectMenus(): void {
        for (const selectRef of this.selectRefs) selectRef.close();
    }

    private getReaderCommentExport(): ReaderCommentExportSettings {
        return normalizeReaderCommentExportSettings(this.settings.reader.commentExport);
    }

    private updateReaderCommentExport(next: ReaderCommentExportSettings): void {
        this.settings.reader = {
            ...this.settings.reader,
            commentExport: {
                prompts: next.prompts.map((prompt) => ({ ...prompt })),
                template: next.template.map((segment) => ({ ...segment })),
                promptPosition: next.promptPosition,
            },
        };
        this.applySettingsToDom();
        void this.actions.setReaderSettings?.({ commentExport: this.settings.reader.commentExport });
    }

    private normalizeFormulaSettings(settings: unknown): FormulaSettings {
        const record = settings && typeof settings === 'object' ? settings as Partial<FormulaSettings> : {};
        const assetActions: Partial<FormulaSettings['assetActions']> = record.assetActions && typeof record.assetActions === 'object'
            ? record.assetActions
            : {};
        return {
            clickCopyMarkdown: Boolean(record.clickCopyMarkdown ?? DEFAULT_FORMULA_SETTINGS.clickCopyMarkdown),
            assetActions: {
                copyPng: Boolean(assetActions.copyPng ?? DEFAULT_FORMULA_SETTINGS.assetActions.copyPng),
                copySvg: Boolean(assetActions.copySvg ?? DEFAULT_FORMULA_SETTINGS.assetActions.copySvg),
                savePng: Boolean(assetActions.savePng ?? DEFAULT_FORMULA_SETTINGS.assetActions.savePng),
                saveSvg: Boolean(assetActions.saveSvg ?? DEFAULT_FORMULA_SETTINGS.assetActions.saveSvg),
            },
        };
    }

    private createPromptId(): string {
        return `prompt_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
    }

    private createDefaultReaderCommentPrompts(): ReaderCommentExportSettings['prompts'] {
        return createDefaultAnnotationPrompts();
    }

    private createDefaultReaderCommentTemplate(): ReaderCommentExportSettings['template'] {
        return createDefaultAnnotationTemplate();
    }

    private formatPromptSummary(commentExport: ReaderCommentExportSettings): string {
        const first = commentExport.prompts[0];
        if (!first) return t('readerCommentPromptListDesc');
        return `${first.title} · ${commentExport.prompts.length}`;
    }

    private formatTemplateSummary(template: CommentTemplateSegment[]): string {
        const normalized = normalizeCommentTemplate(template)
            .map((segment) => segment.type === 'text' ? segment.value : segment.key === 'selected_source' ? t('readerCommentTemplateTokenSelectedSource') : t('readerCommentTemplateTokenUserComment'))
            .join(' ')
            .replace(/\s+/g, ' ')
            .trim();
        return normalized || t('readerCommentTemplateSettingsDesc');
    }

    private formatFormulaAssetActionsSummary(settings: FormulaSettings): string {
        const actions = settings.assetActions;
        const count = [actions.copyPng, actions.copySvg, actions.savePng, actions.saveSvg].filter(Boolean).length;
        if (count === 0) return t('formulaAssetActionsSummaryNone');
        if (count === 4) return t('formulaAssetActionsSummaryAll');
        return t('formulaAssetActionsSummaryCount', [String(count)]);
    }

    private buildTemplatePreview(template: CommentTemplateSegment[]): string {
        const commentExport = this.getReaderCommentExport();
        return buildCommentsExport(
            [
                {
                    id: 'preview-comment-1',
                    itemId: 'preview-item',
                    quoteText: 'quote',
                    sourceMarkdown: '`sample_source()`',
                    comment: 'Needs clarification.',
                    selectors: {
                        textQuote: { exact: '', prefix: '', suffix: '' },
                        textPosition: { start: 0, end: 0 },
                        domRange: null,
                        atomicRefs: [],
                    },
                    createdAt: 1,
                    updatedAt: 1,
                },
                {
                    id: 'preview-comment-2',
                    itemId: 'preview-item',
                    quoteText: 'quote',
                    sourceMarkdown: '**another sample**',
                    comment: 'Consider tightening this wording.',
                    selectors: {
                        textQuote: { exact: '', prefix: '', suffix: '' },
                        textPosition: { start: 0, end: 0 },
                        domRange: null,
                        atomicRefs: [],
                    },
                    createdAt: 2,
                    updatedAt: 2,
                },
            ],
            {
                userPrompt: commentExport.prompts[0]?.content ?? '',
                promptPosition: commentExport.promptPosition,
                commentTemplate: template,
            },
        );
    }

    private openPromptSettingsPopover(): void {
        this.dismissTransientUi();
        this.promptSettingsPopover.open({
            parent: this.root,
            settings: this.getReaderCommentExport(),
            labels: {
                title: t('readerCommentPromptListLabel'),
                close: t('btnClose'),
                addPrompt: t('readerCommentPromptAdd'),
                restoreDefaults: t('readerCommentPromptRestoreDefaults'),
                editPrompt: t('readerCommentPromptEdit'),
                untitledPrompt: t('readerCommentPromptUntitled'),
                back: t('btnBack'),
                titleLabel: t('readerCommentPromptTitleLabel'),
                contentLabel: t('readerCommentPromptContentLabel'),
                titlePlaceholder: t('readerCommentPromptTitlePlaceholder'),
                contentPlaceholder: t('readerCommentPromptContentPlaceholder'),
                empty: t('readerCommentPromptEmpty'),
                save: t('btnSave'),
                cancel: t('btnCancel'),
                delete: t('btnDelete'),
            },
            createPromptId: () => this.createPromptId(),
            onChange: (next) => this.updateReaderCommentExport(next),
            onConfirmDelete: () => this.modal.confirm({
                kind: 'warning',
                title: t('readerCommentPromptDeleteTitle'),
                message: t('readerCommentPromptDeleteMessage'),
                confirmText: t('btnDelete'),
                cancelText: t('btnCancel'),
            }),
            onConfirmRestoreDefaults: () => this.modal.confirm({
                kind: 'warning',
                title: t('readerCommentPromptRestoreDefaultsTitle'),
                message: t('readerCommentPromptRestoreDefaultsMessage'),
                confirmText: t('readerCommentPromptRestoreDefaults'),
                cancelText: t('btnCancel'),
            }),
            onRestoreDefaults: () => this.createDefaultReaderCommentPrompts(),
        });
    }

    private openTemplateSettingsPopover(): void {
        this.dismissTransientUi();
        const current = this.getReaderCommentExport();
        this.templateSettingsPopover.open({
            parent: this.root,
            template: current.template,
            preview: this.buildTemplatePreview(current.template),
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
            onBuildPreview: (template) => this.buildTemplatePreview(template),
            onRestoreDefault: () => this.createDefaultReaderCommentTemplate(),
            onSave: (template) => {
                this.updateReaderCommentExport({
                    ...current,
                    template,
                });
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
