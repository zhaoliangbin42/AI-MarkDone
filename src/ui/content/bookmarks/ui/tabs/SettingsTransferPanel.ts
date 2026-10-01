import type { SettingsFile, SettingsImportPreview } from '../../../../../contracts/settingsTransfer';
import { MAX_SETTINGS_FILE_BYTES } from '../../../../../core/settings/portableSettings';
import { AppearanceScope } from '../../../../../style/appearanceScope';
import { createAppearanceSnapshot, type AppearanceSnapshot } from '../../../../../style/appearance';
import { ensureStyle } from '../../../../../style/shadow';
import { t } from '../../../components/i18n';
export type SettingsTransferActions = {
    exportSettings: () => Promise<SettingsFile>;
    previewImport: (fileText: string) => Promise<SettingsImportPreview>;
    applyImport: (fileText: string, fingerprint: string, categories: string[]) => Promise<boolean>;
    getRecovery: () => Promise<SettingsFile | null>;
    onApplied: (applied: boolean) => Promise<void>;
};
export class SettingsTransferPanel {
    readonly root = document.createElement('div');
    private readonly shadow = this.root.attachShadow({ mode: 'open' });
    private readonly scope = AppearanceScope.forShadowRoot(this.shadow);
    private readonly toolbar = document.createElement('div');
    private readonly details = document.createElement('div');
    private readonly notice = document.createElement('p');
    private readonly input = document.createElement('input');
    private readOnly = false;
    private pending = false;
    private revision = 0;
    private disposed = false;
    constructor(private readonly actions: SettingsTransferActions, options: { showHeading?: boolean } = {}) {
        this.root.dataset.role = 'settings-transfer';
        this.root.dataset.aimdRole = 'settings-transfer';
        this.scope.apply(createAppearanceSnapshot('light'));
        ensureStyle(this.shadow, CSS, { id: 'aimd-settings-transfer' });
        const heading = document.createElement('h3');
        heading.textContent = t('settingsTransferTitle');
        heading.hidden = options.showHeading === false;
        const hint = document.createElement('p');
        hint.textContent = t('settingsTransferHint');
        this.toolbar.className = 'toolbar';
        this.toolbar.append(this.button('settingsExport', () => this.showExportNotice()), this.button('settingsImport', () => this.input.click()), this.button('settingsRestore', () => void this.recover()));
        this.input.type = 'file';
        this.input.accept = '.json,application/json';
        this.input.hidden = true;
        this.input.addEventListener('change', () => {
            const file = this.input.files?.[0];
            this.input.value = '';
            if (file)
                void this.loadFile(file);
        });
        this.notice.setAttribute('role', 'status');
        this.shadow.append(heading, hint, this.toolbar, this.input, this.details, this.notice);
    }
    setAppearance(snapshot: AppearanceSnapshot): void {
        this.scope.apply(snapshot);
    }
    setReadOnly(value: boolean): void {
        this.readOnly = value;
        this.setPending(this.pending);
    }
    setCompatibilityNotice(missing:boolean):void {if(missing){this.notice.dataset.kind='compatibility';this.notice.textContent=t('settingsReloadForUpdate');}else if(this.notice.dataset.kind==='compatibility'){this.notice.textContent='';delete this.notice.dataset.kind;}}
    dispose(): void {
        this.disposed = true;
        this.revision++;
        this.scope.dispose();
    }
    private button(key: string, onClick: () => void): HTMLButtonElement {
        const b = document.createElement('button');
        b.type = 'button';
        b.textContent = t(key);
        b.dataset.action = key;
        b.addEventListener('click', onClick);
        return b;
    }
    private setPending(value: boolean): void {
        this.pending = value;
        this.shadow.querySelectorAll<HTMLButtonElement | HTMLInputElement>('button,input').forEach(control => {
            control.disabled = value || this.readOnly;
        });
        const apply = this.details.querySelector<HTMLButtonElement>('[data-action="settingsImportConfirm"]');
        if (apply && !this.details.querySelector('input:checked'))
            apply.disabled = true;
    }
    private fail(error: unknown): void {
        const code = error instanceof Error ? error.message : '';
        this.notice.textContent = t(code==='SCHEMA_UNSUPPORTED'?'settingsImportUnsupported':code === 'CONFLICT' ? 'settingsImportConflict' : code === 'QUOTA_EXCEEDED' ? 'settingsImportQuota' : code.startsWith('SETTINGS_FILE_') ? 'settingsImportInvalid' : 'settingsTransferFailed');
    }
    private showExportNotice(): void {
        if (this.pending || this.readOnly)
            return;
        this.revision++;
        this.details.replaceChildren();
        this.notice.textContent = '';
        const p = document.createElement('p');
        p.textContent = t('settingsExportNotice');
        this.details.append(p, this.button('settingsExportConfirm', () => void this.exportFile()), this.button('btnCancel', () => this.cancel()));
    }
    private cancel(): void {
        if (this.pending || this.readOnly)
            return;
        this.revision++;
        this.details.replaceChildren();
        this.notice.textContent = '';
    }
    private async exportFile(): Promise<void> {
        if (this.pending || this.readOnly)
            return;
        this.setPending(true);
        try {
            const file = await this.actions.exportSettings();
            if (this.disposed)
                return;
            const url = URL.createObjectURL(new Blob([JSON.stringify(file, null, 2) + '\n'], { type: 'application/json;charset=utf-8' }));
            const link = document.createElement('a');
            link.href = url;
            link.download = `AI-MarkDone-settings-${file.exportedAt.slice(0, 10)}.json`;
            this.shadow.append(link);
            link.click();
            link.remove();
            window.setTimeout(() => URL.revokeObjectURL(url), 1000);
            this.details.replaceChildren();
            this.notice.textContent = t('settingsExportDone');
        }
        catch (e) {
            this.fail(e);
        }
        finally {
            this.setPending(false);
        }
    }
    private async loadFile(file: File): Promise<void> {
        if (this.pending || this.readOnly || this.disposed)
            return;
        if (file.size > MAX_SETTINGS_FILE_BYTES) {
            this.fail(new Error('SETTINGS_FILE_TOO_LARGE'));
            return;
        }
        this.setPending(true);
        try {
            const text = await file.text();
            if (this.disposed)
                return;
            this.setPending(false);
            await this.preview(text);
        }
        catch (error) {
            if (!this.disposed)
                this.fail(error);
        }
        finally {
            this.setPending(false);
        }
    }
    private async recover(): Promise<void> {
        if (this.pending || this.readOnly)
            return;
        this.setPending(true);
        try {
            const file = await this.actions.getRecovery();
            this.setPending(false);
            if (file)
                await this.preview(JSON.stringify(file));
            else
                this.notice.textContent = t('settingsRecoveryEmpty');
        }
        catch (e) {
            this.fail(e);
            this.setPending(false);
        }
    }
    private async preview(fileText: string): Promise<void> {
        if (this.pending || this.readOnly)
            return;
        const revision = ++this.revision;
        this.setPending(true);
        this.details.replaceChildren();
        this.notice.textContent = '';
        try {
            const preview = await this.actions.previewImport(fileText);
            if (this.disposed || revision !== this.revision)
                return;
            this.renderPreview(fileText, preview);
        }
        catch (e) {
            this.fail(e);
        }
        finally {
            this.setPending(false);
        }
    }
    private renderPreview(text: string, preview: SettingsImportPreview): void {
        const intro = document.createElement('p');
        intro.textContent = t('settingsImportNotice', [String(preview.changes.length), String(preview.ignoredCount)]);
        this.details.append(intro);
        if (!preview.changes.length) {
            this.notice.textContent = t('settingsImportNoChanges');
            return;
        }
        const categories = [...new Set(preview.changes.map(change => change.path.split('.')[0]))];
        const selected = new Set(categories);
        const labels: Record<string, string> = { platforms: 'settingsCategoryAdvanced', behavior: 'settingsButtonsGroupMessage', reader: 'settingsCategoryReading', content: 'settingsContentCleanupTitle', formula: 'settingsButtonsGroupFormula', export: 'settingsCategoryExport', chatgptDirectory: 'settingsButtonsGroupDirectory', chatgptBehavior: 'settingsCategoryControls', appearance: 'settingsCategoryAppearance', bookmarks: 'settingsDefaultBookmarkSort', language: 'settingsLanguageLabel' };
        for (const category of categories) {
            const block = document.createElement('section');
            const label = document.createElement('label');
            const check = document.createElement('input');
            check.type = 'checkbox';
            check.checked = true;
            check.dataset.category = category;
            check.addEventListener('change', () => {
                if (check.checked)
                    selected.add(category);
                else
                    selected.delete(category);
                apply.disabled = selected.size === 0;
            });
            label.append(check, document.createTextNode(t(labels[category] ?? category)));
            block.append(label);
            const list = document.createElement('ul');
            for (const change of preview.changes.filter(change => change.path.startsWith(category + '.') || change.path === category)) {
                const li = document.createElement('li');
                li.textContent = `${t(PREFERENCE_LABELS[change.path])}: ${this.format(change.before, change.path)} → ${this.format(change.after, change.path)}`;
                list.append(li);
            }
            block.append(list);
            this.details.append(block);
        }
        const apply = this.button('settingsImportConfirm', () => void this.apply(text, preview.fingerprint, [...selected]));
        this.details.append(apply, this.button('btnCancel', () => this.cancel()));
    }
    private format(value: unknown, path: string): string {
        if (typeof value === 'boolean')
            return t(value ? 'settingsValueOn' : 'settingsValueOff');
        if (Array.isArray(value))
            return value.map(id => t(PIN_LABELS[String(id)])).join(', ') || t('settingsValueNone');
        if (value === undefined || value === null)
            return t('settingsValueDefault');
        if (typeof value === 'number')
            return path.endsWith('Ratio') ? `${Math.round(value * 100)}%` : String(value);
        const labels: Record<string, string> = { en: 'languageEnglish', zh_CN: 'languageZhCN', auto: path === 'language' ? 'languageAuto' : 'settingsThemeAuto', light: 'settingsThemeLight', dark: 'settingsThemeDark', fullscreen: 'readerOpenModeFullscreen', panel: 'readerOpenModePanel', preview: 'chatgptDirectoryModePreview', expanded: 'chatgptDirectoryModeExpanded', 'time-desc': 'sortTimeDesc', 'time-asc': 'sortTimeAsc', 'alpha-asc': 'sortAlphaAsc', 'alpha-desc': 'sortAlphaDesc', none: 'chatgptAtomicMarkdownCopyNone', 'mod-c': 'chatgptAtomicMarkdownCopyModC', 'mod-shift-c': 'chatgptAtomicMarkdownCopyModShiftC', 'markdown-dollar': 'formulaSourceFormatMarkdownDollar', 'latex-brackets': 'formulaSourceFormatLatexBrackets', raw: 'formulaSourceFormatRaw', equation: 'formulaSourceFormatEquation', 'equation-star': 'formulaSourceFormatEquationStar' };
        return typeof value === 'string' && labels[value] ? t(labels[value]) : String(value);
    }
    private async apply(text: string, fingerprint: string, categories: string[]): Promise<void> {
        if (this.pending || this.readOnly || !categories.length)
            return;
        this.setPending(true);
        try {
            const applied = await this.actions.applyImport(text, fingerprint, categories);
            await this.actions.onApplied(applied);
            if (this.disposed)
                return;
            this.details.replaceChildren();
            this.notice.textContent = t(applied ? 'settingsImportDone' : 'settingsImportNoChanges');
        }
        catch (e) {
            this.fail(e);
            this.details.replaceChildren();
        }
        finally {
            this.setPending(false);
        }
    }
}
const CSS = `:host{display:block;box-sizing:border-box;font-family:var(--aimd-font-family-sans);color:var(--aimd-text-primary);} h3{font-size:var(--aimd-text-base);margin:0 0 var(--aimd-space-2);} p{font-size:var(--aimd-text-sm);color:var(--aimd-text-secondary);line-height:var(--aimd-leading-normal);margin:0 0 var(--aimd-space-4);} .toolbar{display:flex;gap:var(--aimd-space-3);flex-wrap:wrap;} button{font:inherit;font-size:var(--aimd-text-sm);color:var(--aimd-text-primary);background:var(--aimd-workspace-card);border:1px solid var(--aimd-workspace-border);border-radius:var(--aimd-radius-lg);padding:var(--aimd-space-2) var(--aimd-space-3);cursor:pointer;} button:hover{background:var(--aimd-surface-hover);} button:disabled{opacity:var(--aimd-opacity-disabled);cursor:default;} section{margin:var(--aimd-space-4) 0 0;padding:var(--aimd-space-4);background:var(--aimd-workspace-surface);border-radius:var(--aimd-radius-lg);} label{display:flex;align-items:center;gap:var(--aimd-space-2);font-size:var(--aimd-text-sm);} ul{font-size:var(--aimd-text-xs);line-height:var(--aimd-leading-normal);padding-inline-start:var(--aimd-space-5);overflow-wrap:anywhere;max-height:calc(var(--aimd-size-control-icon-toolbar)*6);overflow:auto;} p:empty{display:none;}`;
const PREFERENCE_LABELS: Record<string, string> = {
    "platforms.chatgpt": "settingsPreferencePlatformsChatgpt",
    "behavior.showMessageToolbar": "settingsPreferenceBehaviorShowMessageToolbar",
    "behavior.showSaveMessages": "settingsPreferenceBehaviorShowSaveMessages",
    "behavior.showWordCount": "settingsPreferenceBehaviorShowWordCount",
    "behavior.showMessageTimestamp": "settingsPreferenceBehaviorShowMessageTimestamp",
    "behavior.showCopyPng": "settingsPreferenceBehaviorShowCopyPng",
    "behavior.saveContextOnly": "settingsPreferenceBehaviorSaveContextOnly",
    "behavior.pinnedMessageControls": "settingsPreferenceBehaviorPinnedMessageControls",
    "reader.renderCodeInReader": "settingsPreferenceReaderRenderCodeInReader",
    "reader.showOutlineInReader": "settingsPreferenceReaderShowOutlineInReader",
    "reader.persistAnnotations": "settingsPreferenceReaderPersistAnnotations",
    "reader.defaultOpenMode": "settingsPreferenceReaderDefaultOpenMode",
    "reader.panelSizeRatio.widthRatio": "settingsPreferenceReaderPanelSizeRatioWidthRatio",
    "reader.panelSizeRatio.heightRatio": "settingsPreferenceReaderPanelSizeRatioHeightRatio",
    "reader.bodyFontSizePx": "settingsPreferenceReaderBodyFontSizePx",
    "reader.contentMaxWidthPx": "settingsPreferenceReaderContentMaxWidthPx",
    "reader.commentExport.promptPosition": "settingsPreferenceReaderCommentExportPromptPosition",
    "reader.commentExport.sortMode": "settingsPreferenceReaderCommentExportSortMode",
    "content.preserveLinks": "settingsPreferenceContentPreserveLinks",
    "content.includeCodeBlocks": "settingsPreferenceContentIncludeCodeBlocks",
    "formula.clickCopyMarkdown": "settingsPreferenceFormulaClickCopyMarkdown",
    "formula.clickCopyFormulaFormat": "settingsPreferenceFormulaClickCopyFormulaFormat",
    "formula.markdownCopyFormulaFormat": "settingsPreferenceFormulaMarkdownCopyFormulaFormat",
    "formula.assetFontSizePx": "settingsPreferenceFormulaAssetFontSizePx",
    "export.pngWidthPreset": "settingsPreferenceExportPngWidthPreset",
    "export.pngCustomWidth": "settingsPreferenceExportPngCustomWidth",
    "export.pngPixelRatio": "settingsPreferenceExportPngPixelRatio",
    "chatgptDirectory.enabled": "settingsPreferenceChatgptDirectoryEnabled",
    "chatgptDirectory.mode": "settingsPreferenceChatgptDirectoryMode",
    "chatgptDirectory.promptLabelMode": "settingsPreferenceChatgptDirectoryPromptLabelMode",
    "chatgptDirectory.hideOfficialNavigation": "settingsPreferenceChatgptDirectoryHideOfficialNavigation",
    "chatgptDirectory.rightInsetPx": "settingsPreferenceChatgptDirectoryRightInsetPx",
    "chatgptDirectory.previewMaxChars": "settingsPreferenceChatgptDirectoryPreviewMaxChars",
    "chatgptBehavior.restorePositionAfterSend": "settingsPreferenceChatgptBehaviorRestorePositionAfterSend",
    "chatgptBehavior.atomicMarkdownCopyShortcut": "settingsPreferenceChatgptBehaviorAtomicMarkdownCopyShortcut",
    "chatgptBehavior.showMessageStepper": "settingsPreferenceChatgptBehaviorShowMessageStepper",
    "chatgptBehavior.showPageBookmarkControl": "settingsPreferenceChatgptBehaviorShowPageBookmarkControl",
    "chatgptBehavior.showDetachedReaderControl": "settingsPreferenceChatgptBehaviorShowDetachedReaderControl",
    "chatgptBehavior.showPromptControl": "settingsPreferenceChatgptBehaviorShowPromptControl",
    "chatgptBehavior.showInputEnhancementControl": "settingsPreferenceChatgptBehaviorShowInputEnhancementControl",
    "chatgptBehavior.showRefreshNavigationControl": "settingsPreferenceChatgptBehaviorShowRefreshNavigationControl",
    "chatgptBehavior.showComposerInputEnhancementControl": "settingsPreferenceChatgptBehaviorShowComposerInputEnhancementControl",
    "chatgptBehavior.showComposerAnnotationControl": "settingsPreferenceChatgptBehaviorShowComposerAnnotationControl",
    "chatgptBehavior.promptAutocomplete": "settingsPreferenceChatgptBehaviorPromptAutocomplete",
    "chatgptBehavior.enableArrowKeyMessageNavigation": "settingsPreferenceChatgptBehaviorEnableArrowKeyMessageNavigation",
    "chatgptBehavior.pageAnnotationsEnabled": "settingsPreferenceChatgptBehaviorPageAnnotationsEnabled",
    "chatgptBehavior.showPageSelectionToolbar": "settingsPreferenceChatgptBehaviorShowPageSelectionToolbar",
    "chatgptBehavior.pinnedPageControls": "settingsPreferenceChatgptBehaviorPinnedPageControls",
    "chatgptBehavior.pageWidthScale": "settingsPreferenceChatgptBehaviorPageWidthScale",
    "chatgptBehavior.navigationSeekStepPx": "settingsPreferenceChatgptBehaviorNavigationSeekStepPx",
    "appearance.themeMode": "settingsPreferenceAppearanceThemeMode",
    "appearance.fontSizePx": "settingsPreferenceAppearanceFontSizePx",
    "appearance.accentColor": "settingsPreferenceAppearanceAccentColor",
    "bookmarks.sortMode": "settingsPreferenceBookmarksSortMode",
    "language": "settingsPreferenceLanguage",
    "behavior.messageControls.bookmark_toggle": "settingsPreferenceBehaviorMessageControlsBookmarkToggle",
    "behavior.messageControls.copy_markdown": "settingsPreferenceBehaviorMessageControlsCopyMarkdown",
    "behavior.messageControls.copy_prompt_reply": "settingsPreferenceBehaviorMessageControlsCopyPromptReply",
    "behavior.messageControls.reader": "settingsPreferenceBehaviorMessageControlsReader",
    "behavior.messageControls.export": "settingsPreferenceBehaviorMessageControlsExport",
    "reader.selectionToolbar.copy": "settingsPreferenceReaderSelectionToolbarCopy",
    "reader.selectionToolbar.annotation": "settingsPreferenceReaderSelectionToolbarAnnotation",
    "reader.selectionToolbar.highlight": "settingsPreferenceReaderSelectionToolbarHighlight",
    "formula.assetActions.copyPng": "settingsPreferenceFormulaAssetActionsCopyPng",
    "formula.assetActions.copySvg": "settingsPreferenceFormulaAssetActionsCopySvg",
    "formula.assetActions.copyMathml": "settingsPreferenceFormulaAssetActionsCopyMathml",
    "formula.assetActions.savePng": "settingsPreferenceFormulaAssetActionsSavePng",
    "formula.assetActions.saveSvg": "settingsPreferenceFormulaAssetActionsSaveSvg",
    "formula.composerAssetActions.copyPng": "settingsPreferenceFormulaComposerAssetActionsCopyPng",
    "formula.composerAssetActions.copySvg": "settingsPreferenceFormulaComposerAssetActionsCopySvg",
    "formula.composerAssetActions.copyMathml": "settingsPreferenceFormulaComposerAssetActionsCopyMathml",
    "formula.composerAssetActions.savePng": "settingsPreferenceFormulaComposerAssetActionsSavePng",
    "formula.composerAssetActions.saveSvg": "settingsPreferenceFormulaComposerAssetActionsSaveSvg",
    "chatgptBehavior.inputEnhancement.available": "settingsPreferenceChatgptBehaviorInputEnhancementAvailable",
    "chatgptBehavior.inputEnhancement.enabled": "settingsPreferenceChatgptBehaviorInputEnhancementEnabled",
    "chatgptBehavior.inputEnhancement.enterKeyNewline": "settingsPreferenceChatgptBehaviorInputEnhancementEnterKeyNewline",
    "chatgptBehavior.inputEnhancement.boldShortcut": "settingsPreferenceChatgptBehaviorInputEnhancementBoldShortcut",
    "chatgptBehavior.inputEnhancement.formulaSuggestions": "settingsPreferenceChatgptBehaviorInputEnhancementFormulaSuggestions",
    "chatgptBehavior.inputEnhancement.formulaPreview": "settingsPreferenceChatgptBehaviorInputEnhancementFormulaPreview",
    "chatgptBehavior.inputEnhancement.lists.enabled": "settingsPreferenceChatgptBehaviorInputEnhancementListsEnabled",
    "chatgptBehavior.inputEnhancement.lists.ordered": "settingsPreferenceChatgptBehaviorInputEnhancementListsOrdered",
    "chatgptBehavior.inputEnhancement.lists.unordered": "settingsPreferenceChatgptBehaviorInputEnhancementListsUnordered"
};
const PIN_LABELS: Record<string, string> = {
    'toggle-page-bookmark': 'chatgptPageControlBookmark', 'open-detached-reader': 'chatgptPageControlSplitView', 'open-prompts': 'chatgptPageControlPrompts', 'open-input-enhancement': 'settingsInputEnhancementControl', 'chatgpt-refresh-message-navigation': 'chatgptRefreshMessageNavigation', bookmark_toggle: 'btnBookmark', copy_markdown: 'btnCopy', copy_prompt_reply: 'btnCopyPromptReply', reader: 'btnReader', export: 'btnExport',
};
