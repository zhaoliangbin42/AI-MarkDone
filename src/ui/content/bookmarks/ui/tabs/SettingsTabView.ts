import type { AppSettings, FoldingMode } from '../../../../../core/settings/types';
import { DEFAULT_SETTINGS } from '../../../../../core/settings/types';
import type { BookmarksStorageUsageResponse } from '../../../../../contracts/protocol';
import type { ModalHost } from '../../../components/ModalHost';
import { setLocale, t } from '../../../components/i18n';
import { Icons } from '../../../../../assets/icons';
import { createBookmarksInlineSelect } from '../components/BookmarksInlineSelect';
import { createBookmarksNumberStepperField } from '../components/BookmarksNumberStepperField';

export type SettingsTabViewActions = {
    loadState?: () => Promise<{ settings: AppSettings; storageUsage: BookmarksStorageUsageResponse | null } | null>;
    setPlatforms?: (patch: Partial<AppSettings['platforms']>) => Promise<void> | void;
    setChatGptSettings?: (patch: Partial<AppSettings['chatgpt']>) => Promise<void> | void;
    setBehaviorSettings?: (patch: Partial<AppSettings['behavior']>) => Promise<void> | void;
    setReaderSettings?: (patch: Partial<AppSettings['reader']>) => Promise<void> | void;
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

type Refs = {
    platforms: Record<'chatgpt' | 'gemini' | 'claude' | 'deepseek', HTMLInputElement>;
    foldingMode: SelectRef;
    foldingCountItem: HTMLElement;
    foldingCountParent: HTMLElement;
    foldingCount: HTMLInputElement;
    showFoldDock: HTMLInputElement;
    behavior: {
        showViewSource: HTMLInputElement;
        showSaveMessages: HTMLInputElement;
        showWordCount: HTMLInputElement;
        enableClickToCopy: HTMLInputElement;
        saveContextOnly: HTMLInputElement;
        renderCodeInReader: HTMLInputElement;
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
    private handleDocumentClick = (event: MouseEvent): void => {
        const path = (event.composedPath?.() ?? []) as EventTarget[];
        const target = event.target as Node | null;
        if (this.selectRefs.some((selectRef) => path.includes(selectRef.root))) return;
        if (target && this.selectRefs.some((selectRef) => selectRef.root.contains(target))) return;
        this.closeSelectMenus();
    };

    constructor(params: { modal: ModalHost; actions?: SettingsTabViewActions }) {
        this.modal = params.modal;
        this.actions = params.actions ?? {};

        this.root = document.createElement('div');
        this.root.className = 'aimd-settings';
        document.addEventListener('click', this.handleDocumentClick, true);

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

        // ChatGPT group
        const chatgptGroup = this.createGroup(Icons.chatgpt, t('chatgptSettings'));
        const foldingMode = this.createSelect(chatgptGroup.body, t('chatgptFoldingLabel'), t('chatgptFoldingDesc'), [
            { value: 'off', label: t('chatgptFoldingModeOff') },
            { value: 'all', label: t('chatgptFoldingModeAll') },
            { value: 'keep_last_n', label: t('chatgptFoldingModeKeepLastN') },
        ], 'folding-mode');
        foldingMode.trigger.id = 'aimd-chatgpt-folding-mode';

        const foldingCountItem = this.createNumber(chatgptGroup.body, t('chatgptFoldingCountLabel'), t('chatgptFoldingCountDesc'));
        foldingCountItem.input.id = 'aimd-chatgpt-folding-count';
        foldingCountItem.input.min = '0';
        foldingCountItem.input.step = '1';

        const showFoldDock = this.createToggle(chatgptGroup.body, t('chatgptFoldDockLabel'), t('chatgptFoldDockDesc'));

        // Behavior group (merged with reader per legacy)
        const behaviorGroup = this.createGroup(Icons.settings, t('behavior'));
        const showViewSource = this.createToggle(behaviorGroup.body, t('viewSourceLabel'), t('viewSourceDesc'));
        const showSaveMessages = this.createToggle(behaviorGroup.body, t('saveMessagesLabel'), t('saveMessagesDesc'));
        const showWordCount = this.createToggle(behaviorGroup.body, t('wordCountLabel'), t('wordCountDesc'));
        const enableClickToCopy = this.createToggle(behaviorGroup.body, t('clickToCopyLabel'), t('clickToCopyDesc'));
        const saveContextOnly = this.createToggle(behaviorGroup.body, t('contextOnlySaveLabel'), t('contextOnlySaveDesc'));
        const renderCodeInReader = this.createToggle(behaviorGroup.body, t('renderCodeBlocksLabel'), t('renderCodeBlocksDesc'));

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

        content.append(
            platformsGroup.root,
            chatgptGroup.root,
            behaviorGroup.root,
            languageGroup.root,
            storageGroup.root
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
            foldingMode,
            foldingCountParent: chatgptGroup.body,
            foldingCountItem: foldingCountItem.root,
            foldingCount: foldingCountItem.input,
            showFoldDock: showFoldDock.input,
            behavior: {
                showViewSource: showViewSource.input,
                showSaveMessages: showSaveMessages.input,
                showWordCount: showWordCount.input,
                enableClickToCopy: enableClickToCopy.input,
                saveContextOnly: saveContextOnly.input,
                renderCodeInReader: renderCodeInReader.input,
            },
            language,
            storageText,
        };
        this.refs.platforms.chatgpt.dataset.role = 'settings-platform-chatgpt';
        this.refs.platforms.gemini.dataset.role = 'settings-platform-gemini';
        this.refs.platforms.claude.dataset.role = 'settings-platform-claude';
        this.refs.platforms.deepseek.dataset.role = 'settings-platform-deepseek';
        this.refs.showFoldDock.dataset.role = 'settings-fold-dock';
        this.refs.behavior.showViewSource.dataset.role = 'settings-show-view-source';
        this.refs.behavior.showSaveMessages.dataset.role = 'settings-show-save-messages';
        this.refs.behavior.showWordCount.dataset.role = 'settings-show-word-count';
        this.refs.behavior.enableClickToCopy.dataset.role = 'settings-click-to-copy';
        this.refs.behavior.saveContextOnly.dataset.role = 'settings-save-context-only';
        this.refs.behavior.renderCodeInReader.dataset.role = 'settings-render-code-reader';

        this.bindHandlers();
        this.applySettingsToDom();
    }

    getElement(): HTMLElement {
        return this.root;
    }

    focusPrimaryInput(): void {
        this.refs.foldingMode.trigger.focus({ preventScroll: true } as FocusOptions);
    }

    dismissTransientUi(): void {
        this.closeSelectMenus();
    }

    async refresh(): Promise<void> {
        const next = await this.actions.loadState?.();
        if (!next) return;
        this.setState(next);
    }

    setState(params: { settings: AppSettings; storageUsage: BookmarksStorageUsageResponse | null }): void {
        this.settings = params.settings;
        this.storageUsage = params.storageUsage;
        this.applySettingsToDom();
    }

    destroy(): void {
        document.removeEventListener('click', this.handleDocumentClick, true);
        this.closeSelectMenus();
    }

    private bindHandlers(): void {
        // Platforms
        for (const key of Object.keys(this.refs.platforms) as Array<keyof Refs['platforms']>) {
            this.refs.platforms[key].addEventListener('change', () => {
                this.settings.platforms[key] = this.refs.platforms[key].checked;
                void this.actions.setPlatforms?.({ [key]: this.settings.platforms[key] });
            });
        }

        // ChatGPT folding
        this.refs.foldingMode.onChange((value) => {
            const mode = value as FoldingMode;
            this.settings.chatgpt.foldingMode = mode;
            this.applySettingsToDom();
            void this.actions.setChatGptSettings?.({ foldingMode: mode });
        });
        this.refs.foldingCount.addEventListener('input', () => {
            const n = Number(this.refs.foldingCount.value);
            const next = Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0;
            this.settings.chatgpt.defaultExpandedCount = next;
            void this.actions.setChatGptSettings?.({ defaultExpandedCount: next });
        });
        this.refs.foldingCount.addEventListener('change', () => {
            const n = Number(this.refs.foldingCount.value);
            this.refs.foldingCount.value = String(Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0);
        });
        this.refs.showFoldDock.addEventListener('change', () => {
            const next = this.refs.showFoldDock.checked;
            this.settings.chatgpt.showFoldDock = next;
            void this.actions.setChatGptSettings?.({ showFoldDock: next });
        });

        // Behavior + reader
        this.refs.behavior.showViewSource.addEventListener('change', () => {
            const next = this.refs.behavior.showViewSource.checked;
            this.settings.behavior.showViewSource = next;
            void this.actions.setBehaviorSettings?.({ showViewSource: next });
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
        this.refs.behavior.enableClickToCopy.addEventListener('change', () => {
            const next = this.refs.behavior.enableClickToCopy.checked;
            this.settings.behavior.enableClickToCopy = next;
            void this.actions.setBehaviorSettings?.({ enableClickToCopy: next });
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
        this.refs.behavior.renderCodeInReader.addEventListener('change', () => {
            const next = this.refs.behavior.renderCodeInReader.checked;
            this.settings.reader.renderCodeInReader = next;
            void this.actions.setReaderSettings?.({ renderCodeInReader: next });
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
        const usagePercent = this.formatPercent(this.storageUsage?.usedPercentage);
        this.refs.platforms.chatgpt.checked = Boolean(s.platforms.chatgpt);
        this.refs.platforms.gemini.checked = Boolean(s.platforms.gemini);
        this.refs.platforms.claude.checked = Boolean(s.platforms.claude);
        this.refs.platforms.deepseek.checked = Boolean(s.platforms.deepseek);

        this.refs.foldingMode.setValue(s.chatgpt.foldingMode);
        this.refs.foldingCount.value = String(s.chatgpt.defaultExpandedCount);
        this.refs.foldingCount.dataset.role = 'settings-folding-count';
        this.refs.showFoldDock.checked = Boolean(s.chatgpt.showFoldDock);

        this.refs.behavior.showViewSource.checked = Boolean(s.behavior.showViewSource);
        this.refs.behavior.showSaveMessages.checked = Boolean(s.behavior.showSaveMessages);
        this.refs.behavior.showWordCount.checked = Boolean(s.behavior.showWordCount);
        this.refs.behavior.enableClickToCopy.checked = Boolean(s.behavior.enableClickToCopy);
        this.refs.behavior.saveContextOnly.checked = Boolean(s.behavior.saveContextOnly);
        this.refs.behavior.renderCodeInReader.checked = Boolean(s.reader.renderCodeInReader);

        this.refs.language.setValue(s.language);

        this.syncToggle(this.refs.platforms.chatgpt);
        this.syncToggle(this.refs.platforms.gemini);
        this.syncToggle(this.refs.platforms.claude);
        this.syncToggle(this.refs.platforms.deepseek);
        this.syncToggle(this.refs.showFoldDock);
        this.syncToggle(this.refs.behavior.showViewSource);
        this.syncToggle(this.refs.behavior.showSaveMessages);
        this.syncToggle(this.refs.behavior.showWordCount);
        this.syncToggle(this.refs.behavior.enableClickToCopy);
        this.syncToggle(this.refs.behavior.saveContextOnly);
        this.syncToggle(this.refs.behavior.renderCodeInReader);

        // Only show count input when keep_last_n.
        const showCount = s.chatgpt.foldingMode === 'keep_last_n';
        if (showCount) {
            if (!this.refs.foldingCountItem.isConnected) {
                this.refs.foldingCountParent.insertBefore(this.refs.foldingCountItem, this.refs.showFoldDock.closest('.settings-item'));
            }
            this.refs.foldingCountItem.dataset.role = 'settings-folding-count-container';
        } else {
            this.refs.foldingCountItem.remove();
            delete this.refs.foldingCountItem.dataset.role;
        }
        this.refs.storageText.textContent = usagePercent;

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

    private createNumber(parent: HTMLElement, labelText: string, desc: string): { root: HTMLElement; input: HTMLInputElement } {
        return createBookmarksNumberStepperField({
            parent,
            labelText,
            desc,
            valueRole: 'settings-folding-count',
            onStep: (direction) => {
                const current = Number(this.refs.foldingCount.value);
                const normalized = Number.isFinite(current) ? Math.max(0, Math.floor(current)) : 0;
                const next = direction === 'up' ? normalized + 1 : Math.max(0, normalized - 1);
                this.refs.foldingCount.value = String(next);
                this.refs.foldingCount.dispatchEvent(new Event('input', { bubbles: true }));
            },
        });
    }

    private closeSelectMenus(): void {
        for (const selectRef of this.selectRefs) selectRef.close();
    }

    private formatPercent(value: number | null | undefined): string {
        if (typeof value !== 'number' || !Number.isFinite(value)) return '0%';
        const normalized = Math.max(0, Math.min(100, value));
        const rounded = Math.round(normalized * 10) / 10;
        return Number.isInteger(rounded) ? `${rounded}%` : `${rounded.toFixed(1)}%`;
    }
}
