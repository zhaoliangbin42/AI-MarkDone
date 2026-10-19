import { trashIcon } from '../../../assets/icons';
import { readerAnnotationDocumentKey, type ReaderAnnotationDocument, type ReaderAnnotationListEntry } from '../../../contracts/readerAnnotations';
import type { AppearanceSnapshot } from '../../../style/appearance';
import { ensureStyle } from '../../../style/shadow';
import { createIcon } from '../components/Icon';
import type { ModalHost } from '../components/ModalHost';
import { getFlatWorkflowCss } from '../components/styles/flatWorkflowCss';
import { t } from '../components/i18n';

type ManagerView = 'current' | 'all';

type OpenParams = {
    shadow: ShadowRoot;
    modalHost: ModalHost;
    appearance: AppearanceSnapshot;
    currentDocument: ReaderAnnotationDocument;
    currentEntries: ReaderAnnotationListEntry[];
    loadAll: () => Promise<ReaderAnnotationListEntry[]>;
    labels: {
        title: string;
        close: string;
        current: string;
        all: string;
        search: string;
        empty: string;
        loading: string;
        error: string;
        quote: string;
        comment: string;
        updated: string;
        reply: string;
        unanchored: string;
        delete: string;
        bulkEdit: string;
        bulkCancel: string;
        selectAll: string;
        invertSelection?: string;
        deleteSelected: string;
    };
    onSelect: (entry: ReaderAnnotationListEntry) => void | Promise<void>;
    onDelete: (entry: ReaderAnnotationListEntry) => Promise<boolean>;
    onDeleteMany: (entries: ReaderAnnotationListEntry[]) => Promise<boolean>;
};

function compact(value: string): string {
    return value.replace(/\s+/g, ' ').trim();
}

export function formatReaderAnnotationExcerpt(value: string, contextLength = 50): string {
    const source = value.trim();
    const characters = Array.from(source);
    if (characters.length <= contextLength * 2) return source;
    return `${characters.slice(0, contextLength).join('')}…${characters.slice(-contextLength).join('')}`;
}

function formatDate(value: number): string {
    if (!Number.isFinite(value)) return '';
    return new Date(value).toLocaleString();
}

function getCss(): string {
    return `
${getFlatWorkflowCss()}
.mock-modal--reader-annotation-manager { --_modal-content-max-width: 880px; --_modal-content-max-height: 760px; border-color: var(--aimd-workspace-border); background: var(--aimd-workspace-card); box-shadow: var(--aimd-shadow-workspace); }
.mock-modal--reader-annotation-manager .mock-modal__head, .mock-modal--reader-annotation-manager .mock-modal__footer { background: var(--aimd-workspace-card); border-color: var(--aimd-workspace-border); }
.mock-modal--reader-annotation-manager .mock-modal__title-copy strong { color: var(--aimd-text-primary); }
.mock-modal--reader-annotation-manager .mock-modal__content { overflow: hidden; }
.reader-annotation-manager { min-width: 0; min-height: 0; width: 100%; display: grid; grid-template-rows: auto minmax(0, 1fr); gap: var(--aimd-space-4); }
.reader-annotation-manager__toolbar { min-width: 0; display: grid; gap: var(--aimd-space-4); }
.reader-annotation-manager__collection { min-width: 0; min-height: 0; display: grid; grid-template-rows: auto minmax(0, 1fr); gap: 0; }
.reader-annotation-manager[data-bulk-mode="1"] .reader-annotation-manager__collection { gap: var(--aimd-space-3); }
.reader-annotation-manager__toolbar-row { display: flex; flex-wrap: wrap; align-items: center; gap: var(--aimd-space-2); }
.reader-annotation-manager__toolbar-row--primary { justify-content: space-between; }
.reader-annotation-manager__options { min-width: 0; color: var(--aimd-text-secondary); font-size: var(--aimd-text-sm); }
.reader-annotation-manager__options > summary { cursor: pointer; padding: var(--aimd-space-2) 0; }
.reader-annotation-manager__options-content { display: grid; gap: var(--aimd-space-3); padding-top: var(--aimd-space-3); }
.reader-annotation-manager [hidden] { display: none; }
.reader-annotation-manager__toolbar-row--actions { justify-content: flex-start; }
.reader-annotation-manager__bulk-actions { display: inline-flex; flex-wrap: wrap; align-items: center; gap: var(--aimd-space-2); }
.reader-annotation-manager__action { min-height: var(--aimd-size-control-compact); }
.reader-annotation-manager__select-all { display: inline-flex; align-items: center; gap: var(--aimd-space-2); min-height: var(--aimd-size-control-action-panel); color: var(--aimd-text-secondary); font-size: var(--aimd-text-sm); cursor: pointer; }
.reader-annotation-manager__select-all input, .reader-annotation-manager__select { appearance: none; -webkit-appearance: none; width: var(--aimd-size-control-glyph-panel); height: var(--aimd-size-control-glyph-panel); margin: 0; border: 1px solid var(--aimd-border-default); border-radius: var(--aimd-radius-sm); background: var(--aimd-bg-primary); box-shadow: none; display: grid; place-items: center; cursor: pointer; transition: border-color var(--aimd-duration-fast) var(--aimd-ease-in-out), background var(--aimd-duration-fast) var(--aimd-ease-in-out); }
.reader-annotation-manager__select-all input::before, .reader-annotation-manager__select::before { content: ""; width: 9px; height: 5px; border-left: 2px solid transparent; border-bottom: 2px solid transparent; transform: translateY(-1px) rotate(-45deg) scale(0); transform-origin: center; transition: transform var(--aimd-duration-fast) var(--aimd-ease-in-out), border-color var(--aimd-duration-fast) var(--aimd-ease-in-out); }
.reader-annotation-manager__select-all input:checked, .reader-annotation-manager__select:checked { border-color: var(--aimd-interactive-primary); background: var(--aimd-interactive-primary); }
.reader-annotation-manager__select-all input:checked::before, .reader-annotation-manager__select:checked::before { border-color: var(--aimd-text-on-primary); transform: translateY(-1px) rotate(-45deg) scale(1); }
.reader-annotation-manager__select-all input:indeterminate::before { width: 9px; height: 2px; border: 0; border-radius: var(--aimd-radius-full); background: var(--aimd-interactive-primary); transform: scale(1); }
.reader-annotation-manager__select-all input:focus-visible, .reader-annotation-manager__select:focus-visible { outline: none; border-color: var(--aimd-interactive-primary); box-shadow: var(--aimd-shadow-focus); }
.reader-annotation-manager__tabs { max-width: 100%; width: max-content; }
.reader-annotation-manager__search { width: 100%; min-height: var(--aimd-size-control-action-panel); box-sizing: border-box; padding: 0 var(--aimd-space-3); border: 1px solid var(--aimd-workspace-border); border-radius: var(--aimd-radius-lg); background: var(--aimd-bg-primary); box-shadow: none; color: var(--aimd-text-primary); font: inherit; }
.reader-annotation-manager__search:focus-visible { outline: none; border-color: var(--aimd-interactive-primary); box-shadow: var(--aimd-shadow-focus); }
.reader-annotation-manager__items { min-height: 0; overflow: auto; overscroll-behavior: contain; scrollbar-gutter: stable; display: block; padding-right: var(--aimd-space-1); }
.reader-annotation-manager__group { display: grid; gap: 0; }
.reader-annotation-manager__group + .reader-annotation-manager__group { margin-top: var(--aimd-space-5); }
.reader-annotation-manager__group-title { padding: var(--aimd-space-3) var(--aimd-space-4); color: var(--aimd-text-secondary); font-size: var(--aimd-text-xs); font-weight: var(--aimd-font-semibold); overflow-wrap: anywhere; }
.reader-annotation-manager__row { min-width: 0; display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: var(--aimd-space-3); padding: var(--aimd-space-4); border-top: 1px solid var(--aimd-border-subtle); background: transparent; transition: background var(--aimd-duration-fast) var(--aimd-ease-in-out); }
.reader-annotation-manager__row:last-child { border-bottom: 1px solid var(--aimd-border-subtle); }
.reader-annotation-manager__row:hover, .reader-annotation-manager__row:focus-within { background: var(--aimd-surface-hover); }
.reader-annotation-manager__row[data-selected="1"] { background: var(--aimd-interactive-selected); }
.reader-annotation-manager__row[data-bulk="1"] { grid-template-columns: auto minmax(0, 1fr) auto; }
.reader-annotation-manager__select { align-self: start; margin: var(--aimd-space-1); }
.reader-annotation-manager__open { all: unset; min-width: 0; cursor: pointer; display: grid; gap: var(--aimd-space-2); border-radius: var(--aimd-radius-md); }
.reader-annotation-manager__open:focus-visible { box-shadow: var(--aimd-shadow-focus); }
.reader-annotation-manager__quote { min-width: 0; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; color: var(--aimd-text-secondary); font-size: var(--aimd-text-sm); line-height: var(--aimd-leading-normal); border-left: 2px solid var(--aimd-border-default); padding-left: var(--aimd-space-3); text-wrap: pretty; }
.reader-annotation-manager__comment { min-width: 0; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow-wrap: anywhere; color: var(--aimd-text-primary); font-size: var(--aimd-text-sm); line-height: var(--aimd-leading-normal); }
.reader-annotation-manager__meta { display: flex; flex-wrap: wrap; gap: var(--aimd-space-2); color: var(--aimd-text-tertiary); font-size: var(--aimd-text-xs); font-variant-numeric: tabular-nums; }
.reader-annotation-manager__delete { align-self: start; color: var(--aimd-text-secondary); }
.reader-annotation-manager__delete:hover, .reader-annotation-manager__delete:focus-visible { color: var(--aimd-color-danger); }
.reader-annotation-manager__empty, .reader-annotation-manager__loading { padding: var(--aimd-space-6) var(--aimd-space-3); color: var(--aimd-text-secondary); text-align: center; font-size: var(--aimd-text-sm); }
@media (max-width: 520px) { .reader-annotation-manager__toolbar-row--primary { align-items: stretch; } .reader-annotation-manager__tabs { width: 100%; } .reader-annotation-manager__tab { min-width: 0; flex: 1; padding-inline: var(--aimd-space-2); text-align: center; white-space: normal; line-height: var(--aimd-leading-normal); } }
`;
}

export class ReaderAnnotationManagerPopover {
    private rootEl: HTMLElement | null = null;
    private closeModal: (() => void) | null = null;
    private params: OpenParams | null = null;
    private view: ManagerView = 'current';
    private query = '';
    private allEntries: ReaderAnnotationListEntry[] = [];
    private pendingSelection: ReaderAnnotationListEntry | null = null;
    private loadError = false;
    private bulkMode = false;
    private readonly selectedKeys = new Set<string>();

    isOpen(): boolean { return Boolean(this.rootEl?.isConnected); }

    close(): void { this.closeModal?.(); }

    open(params: OpenParams): void {
        this.close();
        this.params = params;
        this.view = 'current';
        this.query = '';
        this.allEntries = [];
        this.pendingSelection = null;
        this.loadError = false;
        this.bulkMode = false;
        this.selectedKeys.clear();
        ensureStyle(params.shadow, getCss(), { id: 'aimd-reader-annotation-manager-style', cache: 'shared' });

        const body = document.createElement('div');
        body.className = 'reader-annotation-manager flat-workflow';
        body.dataset.aimdRole = 'reader-annotation-manager';
        const toolbar = document.createElement('div');
        toolbar.className = 'reader-annotation-manager__toolbar flat-workflow__toolbar';
        const tabs = document.createElement('div');
        tabs.className = 'reader-annotation-manager__tabs flat-workflow__tabs';
        for (const [view, label] of [['current', params.labels.current], ['all', params.labels.all]] as const) {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'reader-annotation-manager__tab flat-workflow__tab';
            button.dataset.view = view;
            button.textContent = label;
            button.addEventListener('click', () => { void this.setView(view); });
            tabs.appendChild(button);
        }
        const search = document.createElement('input');
        search.type = 'search';
        search.className = 'reader-annotation-manager__search flat-workflow__input';
        search.placeholder = params.labels.search;
        search.setAttribute('aria-label', params.labels.search);
        search.addEventListener('input', () => { this.query = search.value.trim().toLowerCase(); this.render(); });
        const primaryRow = document.createElement('div');
        primaryRow.className = 'reader-annotation-manager__toolbar-row reader-annotation-manager__toolbar-row--primary';
        primaryRow.append(tabs);
        const actionsRow = document.createElement('div');
        actionsRow.className = 'reader-annotation-manager__toolbar-row reader-annotation-manager__toolbar-row--actions';
        const bulkActions = document.createElement('div');
        bulkActions.className = 'reader-annotation-manager__bulk-actions';
        bulkActions.dataset.role = 'bulk-actions';
        actionsRow.appendChild(bulkActions);
        const options = document.createElement('details');
        options.className = 'reader-annotation-manager__options';
        const summary = document.createElement('summary');
        const moreLabel = t('libraryMore');
        summary.textContent = moreLabel === 'libraryMore' ? 'More' : moreLabel;
        const optionsContent = document.createElement('div');
        optionsContent.className = 'reader-annotation-manager__options-content';
        const bulkEntry = document.createElement('button');
        bulkEntry.type = 'button';
        bulkEntry.className = 'mock-modal__button mock-modal__button--secondary reader-annotation-manager__action';
        bulkEntry.dataset.role = 'bulk-entry';
        bulkEntry.textContent = params.labels.bulkEdit;
        bulkEntry.addEventListener('click', () => {
            this.bulkMode = true;
            options.open = false;
            this.render();
        });
        optionsContent.appendChild(bulkEntry);
        options.append(summary, optionsContent);
        toolbar.append(primaryRow, search, options);
        body.appendChild(toolbar);
        const collection = document.createElement('section');
        collection.className = 'reader-annotation-manager__collection';
        const items = document.createElement('div');
        items.className = 'reader-annotation-manager__items flat-workflow__list';
        items.dataset.role = 'items';
        collection.append(actionsRow, items);
        body.appendChild(collection);
        this.rootEl = body;
        this.render();

        void params.modalHost.showCustom({
            kind: 'info',
            title: params.labels.title,
            body,
            dialogClassName: 'mock-modal--reader-annotation-manager',
            footer: (footer, close) => {
                this.closeModal = close;
                const closeButton = document.createElement('button');
                closeButton.type = 'button';
                closeButton.className = 'mock-modal__button mock-modal__button--secondary';
                closeButton.dataset.action = 'modal-cancel';
                closeButton.textContent = params.labels.close;
                closeButton.addEventListener('click', () => close());
                footer.appendChild(closeButton);
            },
            onClosed: () => {
                const selected = this.pendingSelection;
                this.pendingSelection = null;
                this.rootEl = null;
                this.closeModal = null;
                this.params = null;
                if (selected) void params.onSelect(selected);
            },
        });
    }

    update(entries: ReaderAnnotationListEntry[]): void {
        if (!this.params) return;
        this.params = { ...this.params, currentEntries: entries };
        if (this.view === 'current') this.render();
    }

    private entryKey(entry: ReaderAnnotationListEntry): string {
        return `${readerAnnotationDocumentKey(entry.document)}:${entry.annotation.id}`;
    }

    private getVisibleEntries(): ReaderAnnotationListEntry[] {
        if (!this.params) return [];
        const source = this.view === 'current' ? this.params.currentEntries : this.allEntries;
        return source.filter((entry) => {
            if (!this.query) return true;
            const haystack = [entry.document.title, entry.annotation.quoteText, entry.annotation.sourceMarkdown, entry.annotation.comment].filter(Boolean).join(' ').toLowerCase();
            return haystack.includes(this.query);
        });
    }

    private renderBulkActions(): void {
        if (!this.rootEl || !this.params) return;
        const actions = this.rootEl.querySelector<HTMLElement>('[data-role="bulk-actions"]');
        if (!actions) return;
        actions.replaceChildren();
        actions.hidden = !this.bulkMode;
        const bulkEntry = this.rootEl.querySelector<HTMLElement>('[data-role="bulk-entry"]');
        if (bulkEntry) bulkEntry.hidden = this.bulkMode;
        if (!this.bulkMode) return;
        const bulkButton = document.createElement('button');
        bulkButton.type = 'button';
        bulkButton.className = 'mock-modal__button mock-modal__button--secondary reader-annotation-manager__action';
        bulkButton.textContent = this.bulkMode ? this.params.labels.bulkCancel : this.params.labels.bulkEdit;
        bulkButton.dataset.role = 'bulk-edit';
        bulkButton.addEventListener('click', () => {
            this.bulkMode = !this.bulkMode;
            if (!this.bulkMode) this.selectedKeys.clear();
            this.render();
        });
        actions.appendChild(bulkButton);
        const selectAllLabel = document.createElement('label');
        selectAllLabel.className = 'reader-annotation-manager__select-all';
        const selectAll = document.createElement('input');
        selectAll.type = 'checkbox';
        selectAll.dataset.role = 'select-all';
        const visible = this.getVisibleEntries();
        const selectedVisible = visible.filter((entry) => this.selectedKeys.has(this.entryKey(entry))).length;
        selectAll.checked = visible.length > 0 && selectedVisible === visible.length;
        selectAll.indeterminate = selectedVisible > 0 && selectedVisible < visible.length;
        selectAll.addEventListener('change', () => {
            visible.forEach((entry) => {
                const key = this.entryKey(entry);
                if (selectAll.checked) this.selectedKeys.add(key);
                else this.selectedKeys.delete(key);
            });
            this.render();
        });
        const selectAllText = document.createElement('span');
        selectAllText.textContent = this.params.labels.selectAll;
        selectAllLabel.append(selectAll, selectAllText);
        actions.appendChild(selectAllLabel);
        const invertVisible = document.createElement('button');
        invertVisible.type = 'button';
        invertVisible.className = 'mock-modal__button mock-modal__button--secondary reader-annotation-manager__action';
        invertVisible.dataset.role = 'invert-visible';
        invertVisible.textContent = this.params.labels.invertSelection ?? 'Invert selection';
        invertVisible.disabled = visible.length < 1;
        invertVisible.addEventListener('click', () => {
            visible.forEach((entry) => {
                const key = this.entryKey(entry);
                if (this.selectedKeys.has(key)) this.selectedKeys.delete(key);
                else this.selectedKeys.add(key);
            });
            this.render();
        });
        actions.appendChild(invertVisible);
        const deleteSelected = document.createElement('button');
        deleteSelected.type = 'button';
        deleteSelected.className = 'mock-modal__button mock-modal__button--secondary reader-annotation-manager__action';
        deleteSelected.dataset.role = 'delete-selected';
        deleteSelected.textContent = `${this.params.labels.deleteSelected}${selectedVisible > 0 ? ` (${selectedVisible})` : ''}`;
        deleteSelected.disabled = selectedVisible < 1;
        deleteSelected.addEventListener('click', () => { void this.deleteSelected(); });
        actions.appendChild(deleteSelected);
    }

    private async deleteSelected(): Promise<void> {
        if (!this.params) return;
        const entries = this.getVisibleEntries().filter((entry) => this.selectedKeys.has(this.entryKey(entry)));
        if (entries.length < 1) return;
        const button = this.rootEl?.querySelector<HTMLButtonElement>('[data-role="delete-selected"]');
        if (button) button.disabled = true;
        let deleted = false;
        try {
            deleted = await this.params.onDeleteMany(entries);
        } catch {
            deleted = false;
        }
        if (!deleted) {
            if (button) button.disabled = false;
            return;
        }
        const keys = new Set(entries.map((entry) => this.entryKey(entry)));
        this.allEntries = this.allEntries.filter((entry) => !keys.has(this.entryKey(entry)));
        this.params = { ...this.params, currentEntries: this.params.currentEntries.filter((entry) => !keys.has(this.entryKey(entry))) };
        entries.forEach((entry) => this.selectedKeys.delete(this.entryKey(entry)));
        this.render();
    }

    private async setView(view: ManagerView): Promise<void> {
        this.view = view;
        if (view === 'all' && this.allEntries.length < 1) {
            const items = this.rootEl?.querySelector<HTMLElement>('[data-role="items"]');
            if (items) items.innerHTML = `<div class="reader-annotation-manager__loading">${this.params?.labels.loading ?? ''}</div>`;
            try {
                this.allEntries = await this.params?.loadAll() ?? [];
                this.loadError = false;
            } catch {
                this.allEntries = [];
                this.loadError = true;
            }
        }
        this.render();
    }

    private render(): void {
        if (!this.rootEl || !this.params) return;
        this.rootEl.dataset.bulkMode = this.bulkMode ? '1' : '0';
        this.renderBulkActions();
        this.rootEl.querySelectorAll<HTMLButtonElement>('[data-view]').forEach((button) => {
            button.dataset.active = button.dataset.view === this.view ? '1' : '0';
        });
        const list = this.rootEl.querySelector<HTMLElement>('[data-role="items"]');
        if (!list) return;
        const filtered = this.getVisibleEntries();
        if (this.view === 'all' && this.loadError) {
            list.innerHTML = `<div class="reader-annotation-manager__empty">${this.params.labels.error}</div>`;
            return;
        }
        if (filtered.length < 1) {
            list.innerHTML = `<div class="reader-annotation-manager__empty">${this.params.labels.empty}</div>`;
            return;
        }
        if (this.view === 'all') {
            const groups = new Map<string, ReaderAnnotationListEntry[]>();
            filtered.forEach((entry) => {
                const key = entry.document.conversationId;
                groups.set(key, [...(groups.get(key) ?? []), entry]);
            });
            const sortedGroups = [...groups.entries()].sort((left, right) => Math.max(...right[1].map((entry) => entry.annotation.updatedAt)) - Math.max(...left[1].map((entry) => entry.annotation.updatedAt)));
            list.replaceChildren(...sortedGroups.map(([key, entries]) => this.createGroup(entries[0]?.document.title || key, entries)));
            return;
        }
        const sorted = [...filtered].sort((left, right) => {
            const replyDelta = (left.annotation.target.position ?? Number.POSITIVE_INFINITY) - (right.annotation.target.position ?? Number.POSITIVE_INFINITY);
            if (replyDelta !== 0) return replyDelta;
            const sourceDelta = (left.annotation.selectors.textPosition.start ?? Number.POSITIVE_INFINITY) - (right.annotation.selectors.textPosition.start ?? Number.POSITIVE_INFINITY);
            if (sourceDelta !== 0) return sourceDelta;
            return left.annotation.createdAt - right.annotation.createdAt;
        });
        list.replaceChildren(...sorted.map((entry) => this.createRow(entry)));
    }

    private createGroup(title: string, entries: ReaderAnnotationListEntry[]): HTMLElement {
        const group = document.createElement('section');
        group.className = 'reader-annotation-manager__group';
        const heading = document.createElement('div');
        heading.className = 'reader-annotation-manager__group-title flat-workflow__section-title';
        heading.textContent = title;
        group.appendChild(heading);
        entries.sort((left, right) => {
            const replyDelta = (left.annotation.target.position ?? Number.POSITIVE_INFINITY) - (right.annotation.target.position ?? Number.POSITIVE_INFINITY);
            if (replyDelta !== 0) return replyDelta;
            return (left.annotation.selectors.textPosition.start ?? Number.POSITIVE_INFINITY) - (right.annotation.selectors.textPosition.start ?? Number.POSITIVE_INFINITY);
        });
        group.append(...entries.map((entry) => this.createRow(entry)));
        return group;
    }

    private createRow(entry: ReaderAnnotationListEntry): HTMLElement {
        if (!this.params) return document.createElement('div');
        const row = document.createElement('article');
        row.className = 'reader-annotation-manager__row flat-workflow__item';
        row.dataset.bulk = this.bulkMode ? '1' : '0';
        row.dataset.selected = this.selectedKeys.has(this.entryKey(entry)) ? '1' : '0';
        if (this.bulkMode) {
            const select = document.createElement('input');
            select.type = 'checkbox';
            select.className = 'reader-annotation-manager__select';
            select.checked = this.selectedKeys.has(this.entryKey(entry));
            select.setAttribute('aria-label', this.params.labels.selectAll);
            select.addEventListener('click', (event) => event.stopPropagation());
            select.addEventListener('change', () => {
                const key = this.entryKey(entry);
                if (select.checked) this.selectedKeys.add(key);
                else this.selectedKeys.delete(key);
                this.render();
            });
            row.appendChild(select);
        }
        const open = document.createElement('button');
        open.type = 'button';
        open.className = 'reader-annotation-manager__open';
        const quote = document.createElement('span');
        quote.className = 'reader-annotation-manager__quote';
        quote.textContent = formatReaderAnnotationExcerpt(entry.annotation.sourceMarkdown || entry.annotation.quoteText) || '-';
        const comment = document.createElement('span');
        comment.className = 'reader-annotation-manager__comment';
        comment.textContent = compact(entry.annotation.comment) || '-';
        const meta = document.createElement('span');
        meta.className = 'reader-annotation-manager__meta';
        meta.textContent = `${this.params.labels.reply} ${String(entry.annotation.target.position ?? '—')} · ${this.params.labels.updated} ${formatDate(entry.annotation.updatedAt)}${entry.annotation.lastKnownAnchorState === 'unanchored' ? ` · ${this.params.labels.unanchored}` : ''}`;
        open.append(comment, quote, meta);
        open.addEventListener('click', () => {
            this.pendingSelection = entry;
            this.closeModal?.();
        });
        const deleteButton = document.createElement('button');
        deleteButton.type = 'button';
        deleteButton.className = 'icon-btn icon-btn--danger reader-annotation-manager__delete';
        deleteButton.dataset.action = 'delete';
        deleteButton.title = this.params.labels.delete;
        deleteButton.setAttribute('aria-label', this.params.labels.delete);
        deleteButton.appendChild(createIcon(trashIcon));
        deleteButton.addEventListener('click', async () => {
            deleteButton.disabled = true;
            let deleted = false;
            try {
                deleted = await this.params?.onDelete(entry) ?? false;
            } catch {
                deleted = false;
            }
            if (deleted) {
                const key = this.entryKey(entry);
                this.allEntries = this.allEntries.filter((candidate) => this.entryKey(candidate) !== key);
                if (this.view === 'current' && this.params) this.params = { ...this.params, currentEntries: this.params.currentEntries.filter((candidate) => this.entryKey(candidate) !== key) };
                this.render();
            } else deleteButton.disabled = false;
        });
        row.append(open, deleteButton);
        return row;
    }
}
