import type { AppSettings, FoldingMode } from '../../../../../core/settings/types';
import { DEFAULT_SETTINGS } from '../../../../../core/settings/types';
import type { SettingsCategory } from '../../../../../contracts/protocol';
import { settingsClientRpc } from '../../../../../drivers/shared/clients/settingsClientRpc';
import type { ModalHost } from '../../../components/ModalHost';
import { t } from '../../../components/i18n';
import { checkIcon, chevronDownIcon, Icons } from '../../../../../assets/icons';

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

function debounce<T extends (...args: any[]) => void>(fn: T, ms: number): T {
    let timer: number | null = null;
    return ((...args: any[]) => {
        if (timer) window.clearTimeout(timer);
        timer = window.setTimeout(() => fn(...args), ms);
    }) as any as T;
}

export class SettingsTabView {
    private root: HTMLElement;
    private modal: ModalHost;
    private onExportAllBookmarks: (() => Promise<void>) | null;
    private settings: AppSettings = { ...DEFAULT_SETTINGS };
    private refs: Refs;
    private selectRefs: SelectRef[] = [];
    private writeCategoryDebounced: (category: SettingsCategory, value: unknown) => void;
    private handleDocumentClick = (event: MouseEvent): void => {
        const target = event.target as Node | null;
        if (!target) return;
        if (this.selectRefs.some((selectRef) => selectRef.root.contains(target))) return;
        this.closeSelectMenus();
    };

    constructor(params: { modal: ModalHost; onExportAllBookmarks?: () => Promise<void> }) {
        this.modal = params.modal;
        this.onExportAllBookmarks = params.onExportAllBookmarks ?? null;

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
              <div class="storage-progress-bar" data-field="storage_bar" style="width: 0%"></div>
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
        exportBtn.addEventListener('click', () => void this.onExportAllBookmarks?.());
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

        this.writeCategoryDebounced = debounce((category, value) => {
            void settingsClientRpc.setCategory(category, value);
        }, 320);

        this.bindHandlers();
        this.applySettingsToDom();
    }

    getElement(): HTMLElement {
        return this.root;
    }

    async refresh(): Promise<void> {
        const res = await settingsClientRpc.getAll();
        if (!res.ok) return;
        const next = res.data.settings as AppSettings | null;
        if (!next) return;
        this.settings = next;
        this.applySettingsToDom();
    }

    private bindHandlers(): void {
        // Platforms
        for (const key of Object.keys(this.refs.platforms) as Array<keyof Refs['platforms']>) {
            this.refs.platforms[key].addEventListener('change', () => {
                this.settings.platforms[key] = this.refs.platforms[key].checked;
                this.writeCategoryDebounced('platforms', { [key]: this.settings.platforms[key] });
            });
        }

        // ChatGPT folding
        this.refs.foldingMode.onChange((value) => {
            const mode = value as FoldingMode;
            this.settings.chatgpt.foldingMode = mode;
            this.applySettingsToDom();
            this.writeCategoryDebounced('chatgpt', { foldingMode: mode });
        });
        this.refs.foldingCount.addEventListener('input', () => {
            const n = Number(this.refs.foldingCount.value);
            const next = Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0;
            this.settings.chatgpt.defaultExpandedCount = next;
            this.writeCategoryDebounced('chatgpt', { defaultExpandedCount: next });
        });
        this.refs.foldingCount.addEventListener('change', () => {
            const n = Number(this.refs.foldingCount.value);
            this.refs.foldingCount.value = String(Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0);
        });
        for (const direction of ['up', 'down'] as const) {
            const stepper = this.refs.foldingCountItem.querySelector<HTMLButtonElement>(`[data-action="settings-step-count"][data-direction="${direction}"]`);
            stepper?.addEventListener('click', () => {
                const current = Number(this.refs.foldingCount.value);
                const normalized = Number.isFinite(current) ? Math.max(0, Math.floor(current)) : 0;
                const next = direction === 'up' ? normalized + 1 : Math.max(0, normalized - 1);
                this.refs.foldingCount.value = String(next);
                this.refs.foldingCount.dispatchEvent(new Event('input', { bubbles: true }));
            });
        }
        this.refs.showFoldDock.addEventListener('change', () => {
            const next = this.refs.showFoldDock.checked;
            this.settings.chatgpt.showFoldDock = next;
            this.writeCategoryDebounced('chatgpt', { showFoldDock: next });
        });

        // Behavior + reader
        this.refs.behavior.showViewSource.addEventListener('change', () => {
            const next = this.refs.behavior.showViewSource.checked;
            this.settings.behavior.showViewSource = next;
            this.writeCategoryDebounced('behavior', { showViewSource: next });
        });
        this.refs.behavior.showSaveMessages.addEventListener('change', () => {
            const next = this.refs.behavior.showSaveMessages.checked;
            this.settings.behavior.showSaveMessages = next;
            this.writeCategoryDebounced('behavior', { showSaveMessages: next });
        });
        this.refs.behavior.showWordCount.addEventListener('change', () => {
            const next = this.refs.behavior.showWordCount.checked;
            this.settings.behavior.showWordCount = next;
            this.writeCategoryDebounced('behavior', { showWordCount: next });
        });
        this.refs.behavior.enableClickToCopy.addEventListener('change', () => {
            const next = this.refs.behavior.enableClickToCopy.checked;
            this.settings.behavior.enableClickToCopy = next;
            this.writeCategoryDebounced('behavior', { enableClickToCopy: next });
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
            this.writeCategoryDebounced('behavior', {
                saveContextOnly: wantOn,
                _contextOnlyConfirmed: this.settings.behavior._contextOnlyConfirmed,
            });
        });
        this.refs.behavior.renderCodeInReader.addEventListener('change', () => {
            const next = this.refs.behavior.renderCodeInReader.checked;
            this.settings.reader.renderCodeInReader = next;
            this.writeCategoryDebounced('reader', { renderCodeInReader: next });
        });

        // Language
        this.refs.language.onChange((value) => {
            this.settings.language = value as any;
            this.writeCategoryDebounced('language', value);
        });
    }

    private applySettingsToDom(): void {
        const s = this.settings;
        this.refs.platforms.chatgpt.checked = Boolean(s.platforms.chatgpt);
        this.refs.platforms.gemini.checked = Boolean(s.platforms.gemini);
        this.refs.platforms.claude.checked = Boolean(s.platforms.claude);
        this.refs.platforms.deepseek.checked = Boolean(s.platforms.deepseek);

        this.refs.foldingMode.setValue(s.chatgpt.foldingMode);
        this.refs.foldingCount.value = String(s.chatgpt.defaultExpandedCount);
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
        this.refs.foldingCountItem.style.display = showCount ? 'flex' : 'none';
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
        label.innerHTML = labelHtml;
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
        const item = document.createElement('div');
        item.className = 'settings-row settings-item';
        const info = document.createElement('div');
        info.className = 'settings-label settings-item-info';
        const label = document.createElement('strong');
        label.textContent = labelText;
        const p = document.createElement('p');
        p.textContent = desc;
        info.append(label, p);

        const shell = document.createElement('div');
        shell.className = 'settings-select-shell';
        shell.dataset.open = '0';

        const trigger = document.createElement('button');
        trigger.type = 'button';
        trigger.className = 'settings-select-trigger';
        trigger.dataset.action = 'toggle-settings-menu';
        trigger.dataset.menu = menuName;
        trigger.setAttribute('aria-haspopup', 'listbox');
        trigger.setAttribute('aria-expanded', 'false');

        const triggerLabel = document.createElement('span');
        triggerLabel.className = 'settings-select-trigger__label';
        const triggerCaret = document.createElement('span');
        triggerCaret.className = 'settings-select-trigger__caret';
        triggerCaret.innerHTML = chevronDownIcon;
        trigger.append(triggerLabel, triggerCaret);

        const menu = document.createElement('div');
        menu.className = 'settings-select-menu';
        menu.dataset.open = '0';
        menu.setAttribute('role', 'listbox');
        menu.tabIndex = -1;

        const listeners = new Set<(value: string) => void>();
        let currentValue = options[0]?.value ?? '';

        const optionButtons = options.map((opt) => {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'settings-select-option';
            button.dataset.value = opt.value;
            button.setAttribute('role', 'option');
            const optionLabel = document.createElement('span');
            optionLabel.textContent = opt.label;
            const optionCheck = document.createElement('span');
            optionCheck.className = 'settings-option-check';
            optionCheck.innerHTML = checkIcon;
            button.append(optionLabel, optionCheck);
            button.addEventListener('click', (event) => {
                event.preventDefault();
                currentValue = opt.value;
                syncValue();
                listeners.forEach((listener) => listener(currentValue));
                close();
            });
            menu.appendChild(button);
            return button;
        });

        const syncValue = (): void => {
            const selectedOption = options.find((opt) => opt.value === currentValue) ?? options[0] ?? { value: '', label: '' };
            currentValue = selectedOption.value;
            triggerLabel.textContent = selectedOption.label;
            trigger.setAttribute('aria-label', selectedOption.label);
            for (const button of optionButtons) {
                const isSelected = button.dataset.value === currentValue;
                button.dataset.selected = isSelected ? '1' : '0';
                button.setAttribute('aria-selected', isSelected ? 'true' : 'false');
            }
        };
        const close = (): void => {
            shell.dataset.open = '0';
            menu.dataset.open = '0';
            trigger.setAttribute('aria-expanded', 'false');
        };
        const open = (): void => {
            this.closeSelectMenus();
            shell.dataset.open = '1';
            menu.dataset.open = '1';
            trigger.setAttribute('aria-expanded', 'true');
        };
        trigger.addEventListener('click', (event) => {
            event.preventDefault();
            if (shell.dataset.open === '1') {
                close();
                return;
            }
            open();
        });

        syncValue();
        shell.append(trigger, menu);
        item.append(info, shell);
        parent.appendChild(item);
        const ref: SelectRef = {
            root: item,
            shell,
            trigger,
            triggerLabel,
            menu,
            getValue: () => currentValue,
            setValue: (value: string) => {
                currentValue = value;
                syncValue();
            },
            close,
            onChange: (listener) => listeners.add(listener),
        };
        this.selectRefs.push(ref);
        return ref;
    }

    private createNumber(parent: HTMLElement, labelText: string, desc: string): { root: HTMLElement; input: HTMLInputElement } {
        const item = document.createElement('div');
        item.className = 'settings-row settings-item';
        item.id = 'chatgpt-folding-count-item';
        const info = document.createElement('div');
        info.className = 'settings-label settings-item-info';
        const label = document.createElement('strong');
        label.textContent = labelText;
        const p = document.createElement('p');
        p.textContent = desc;
        info.append(label, p);

        const input = document.createElement('input');
        input.className = 'settings-number';
        input.type = 'number';
        const field = document.createElement('div');
        field.className = 'settings-number-field';
        const stepper = document.createElement('div');
        stepper.className = 'settings-number-stepper';
        const stepUp = document.createElement('button');
        stepUp.type = 'button';
        stepUp.className = 'settings-number-step';
        stepUp.dataset.action = 'settings-step-count';
        stepUp.dataset.direction = 'up';
        stepUp.setAttribute('aria-label', 'Increase expanded count');
        stepUp.innerHTML = chevronDownIcon;
        const stepDown = document.createElement('button');
        stepDown.type = 'button';
        stepDown.className = 'settings-number-step settings-number-step--down';
        stepDown.dataset.action = 'settings-step-count';
        stepDown.dataset.direction = 'down';
        stepDown.setAttribute('aria-label', 'Decrease expanded count');
        stepDown.innerHTML = chevronDownIcon;
        stepper.append(stepUp, stepDown);
        field.append(input, stepper);

        item.append(info, field);
        parent.appendChild(item);
        return { root: item, input };
    }

    private closeSelectMenus(): void {
        for (const selectRef of this.selectRefs) selectRef.close();
    }
}
