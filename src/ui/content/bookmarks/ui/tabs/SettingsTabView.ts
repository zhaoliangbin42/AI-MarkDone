import type { AppSettings, FoldingMode } from '../../../../../core/settings/types';
import { DEFAULT_SETTINGS } from '../../../../../core/settings/types';
import type { SettingsCategory } from '../../../../../contracts/protocol';
import { settingsRemoteApi } from '../../../../../services/settings/remoteApi';
import type { ModalHost } from '../../../components/ModalHost';
import { t } from '../../../components/i18n';
import { Icons } from '../../../../../assets/icons';

type Refs = {
    platforms: Record<'chatgpt' | 'gemini' | 'claude' | 'deepseek', HTMLInputElement>;
    foldingMode: HTMLSelectElement;
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
    language: HTMLSelectElement;
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
    private writeCategoryDebounced: (category: SettingsCategory, value: unknown) => void;

    constructor(params: { modal: ModalHost; onExportAllBookmarks?: () => Promise<void> }) {
        this.modal = params.modal;
        this.onExportAllBookmarks = params.onExportAllBookmarks ?? null;

        this.root = document.createElement('div');
        this.root.className = 'aimd-settings';

        const scroll = document.createElement('div');
        scroll.className = 'aimd-scroll';

        const content = document.createElement('div');
        content.className = 'settings-content';

        // Platforms group
        const platformsGroup = this.createGroup(Icons.globe, t('platforms'));
        const platforms = {
            chatgpt: this.createToggle(platformsGroup.body, `${Icons.chatgpt} ChatGPT`, t('enableOnChatGPT')),
            gemini: this.createToggle(platformsGroup.body, `${Icons.gemini} Gemini`, t('enableOnGemini')),
            claude: this.createToggle(platformsGroup.body, `${Icons.claude} Claude`, t('enableOnClaude')),
            deepseek: this.createToggle(platformsGroup.body, `${Icons.deepseek} Deepseek`, t('enableOnDeepseek')),
        };

        // ChatGPT group
        const chatgptGroup = this.createGroup(Icons.chatgpt, t('chatgptSettings'));
        const foldingMode = this.createSelect(chatgptGroup.body, t('chatgptFoldingLabel'), t('chatgptFoldingDesc'), [
            { value: 'off', label: t('chatgptFoldingModeOff') },
            { value: 'all', label: t('chatgptFoldingModeAll') },
            { value: 'keep_last_n', label: t('chatgptFoldingModeKeepLastN') },
        ]);
        foldingMode.select.id = 'aimd-chatgpt-folding-mode';

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
        ]);
        language.select.classList.add('language-select');

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
            foldingMode: foldingMode.select,
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
            language: language.select,
            storageText,
        };

        this.writeCategoryDebounced = debounce((category, value) => {
            void settingsRemoteApi.setCategory(category, value);
        }, 320);

        this.bindHandlers();
        this.applySettingsToDom();
    }

    getElement(): HTMLElement {
        return this.root;
    }

    async refresh(): Promise<void> {
        const res = await settingsRemoteApi.getAll();
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
        this.refs.foldingMode.addEventListener('change', () => {
            const mode = this.refs.foldingMode.value as FoldingMode;
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
        this.refs.language.addEventListener('change', () => {
            const value = this.refs.language.value;
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

        this.refs.foldingMode.value = s.chatgpt.foldingMode;
        this.refs.foldingCount.value = String(s.chatgpt.defaultExpandedCount);
        this.refs.showFoldDock.checked = Boolean(s.chatgpt.showFoldDock);

        this.refs.behavior.showViewSource.checked = Boolean(s.behavior.showViewSource);
        this.refs.behavior.showSaveMessages.checked = Boolean(s.behavior.showSaveMessages);
        this.refs.behavior.showWordCount.checked = Boolean(s.behavior.showWordCount);
        this.refs.behavior.enableClickToCopy.checked = Boolean(s.behavior.enableClickToCopy);
        this.refs.behavior.saveContextOnly.checked = Boolean(s.behavior.saveContextOnly);
        this.refs.behavior.renderCodeInReader.checked = Boolean(s.reader.renderCodeInReader);

        this.refs.language.value = s.language;

        // Only show count input when keep_last_n.
        const showCount = s.chatgpt.foldingMode === 'keep_last_n';
        this.refs.foldingCountItem.style.display = showCount ? 'flex' : 'none';
    }

    private createGroup(icon: string, title: string): { root: HTMLElement; body: HTMLElement } {
        const root = document.createElement('div');
        root.className = 'settings-group';
        const h = document.createElement('h3');
        h.className = 'settings-group-title';
        h.innerHTML = `${icon}<span>${title}</span>`;
        const body = document.createElement('div');
        root.append(h, body);
        return { root, body };
    }

    private createToggle(parent: HTMLElement, labelHtml: string, desc: string): { root: HTMLElement; input: HTMLInputElement } {
        const item = document.createElement('div');
        item.className = 'settings-item';
        const info = document.createElement('div');
        info.className = 'settings-item-info';
        const label = document.createElement('span');
        label.className = 'settings-item-label';
        label.innerHTML = labelHtml;
        const p = document.createElement('span');
        p.className = 'settings-item-desc';
        p.textContent = desc;
        info.append(label, p);

        const toggle = document.createElement('label');
        toggle.className = 'toggle-switch';
        const input = document.createElement('input');
        input.type = 'checkbox';
        const slider = document.createElement('span');
        slider.className = 'toggle-slider';
        toggle.append(input, slider);

        item.append(info, toggle);
        parent.appendChild(item);
        return { root: item, input };
    }

    private createSelect(parent: HTMLElement, labelText: string, desc: string, options: Array<{ value: string; label: string }>): { root: HTMLElement; select: HTMLSelectElement } {
        const item = document.createElement('div');
        item.className = 'settings-item';
        const info = document.createElement('div');
        info.className = 'settings-item-info';
        const label = document.createElement('span');
        label.className = 'settings-item-label';
        label.textContent = labelText;
        const p = document.createElement('span');
        p.className = 'settings-item-desc';
        p.textContent = desc;
        info.append(label, p);

        const select = document.createElement('select');
        select.className = 'settings-select';
        for (const opt of options) {
            const o = document.createElement('option');
            o.value = opt.value;
            o.textContent = opt.label;
            select.appendChild(o);
        }
        item.append(info, select);
        parent.appendChild(item);
        return { root: item, select };
    }

    private createNumber(parent: HTMLElement, labelText: string, desc: string): { root: HTMLElement; input: HTMLInputElement } {
        const item = document.createElement('div');
        item.className = 'settings-item';
        item.id = 'chatgpt-folding-count-item';
        const info = document.createElement('div');
        info.className = 'settings-item-info';
        const label = document.createElement('span');
        label.className = 'settings-item-label';
        label.textContent = labelText;
        const p = document.createElement('span');
        p.className = 'settings-item-desc';
        p.textContent = desc;
        info.append(label, p);

        const input = document.createElement('input');
        input.className = 'settings-number';
        input.type = 'number';

        item.append(info, input);
        parent.appendChild(item);
        return { root: item, input };
    }
}
