import { trashIcon } from '../../../assets/icons';
import { ensureStyle } from '../../../style/shadow';
import { createIcon } from '../components/Icon';
import type { ModalHost } from '../components/ModalHost';
import type { ReaderCommentRecord } from '../../../services/reader/commentSession';
import { t } from '../components/i18n';

type AnchorRect = {
    left: number;
    top: number;
    right: number;
    bottom: number;
    width: number;
    height: number;
};

type OpenParams = {
    shadow: ShadowRoot;
    modalHost: ModalHost;
    anchorRect?: AnchorRect | null;
    getCurrentRecords: () => ReaderCommentRecord[];
    loadAll: () => Promise<ReaderCommentRecord[]>;
    onSelect: (record: ReaderCommentRecord) => void;
    onDelete: (record: ReaderCommentRecord) => Promise<boolean>;
    onInsertAll: (records: ReaderCommentRecord[]) => void | Promise<void>;
};

const ANCHOR_GAP_PX = 8;
const ANCHOR_MAX_WIDTH_PX = 720;
const ANCHOR_MIN_WIDTH_PX = 320;
const ANCHOR_FALLBACK_HEIGHT_PX = 520;

function positionDialog(dialog: HTMLElement, anchor: AnchorRect): void {
    const gap = ANCHOR_GAP_PX;
    const width = Math.min(ANCHOR_MAX_WIDTH_PX, Math.max(ANCHOR_MIN_WIDTH_PX, window.innerWidth - gap * 2));
    const height = dialog.offsetHeight || ANCHOR_FALLBACK_HEIGHT_PX;
    let top = anchor.bottom + gap;
    if (top + height > window.innerHeight - gap) top = anchor.top - height - gap;
    if (top < gap) top = gap;
    let left = anchor.right - width;
    left = Math.max(gap, Math.min(left, window.innerWidth - width - gap));
    dialog.style.position = 'fixed';
    dialog.style.left = `${Math.round(left)}px`;
    dialog.style.top = `${Math.round(top)}px`;
    dialog.style.width = `${Math.round(width)}px`;
    dialog.style.maxWidth = `${Math.round(width)}px`;
}

function compact(value: string): string {
    return value.replace(/\s+/g, ' ').trim();
}

function excerpt(value: string): string {
    const source = value.trim();
    const characters = Array.from(source);
    if (characters.length <= 96) return source;
    return `${characters.slice(0, 48).join('')}…${characters.slice(-48).join('')}`;
}

function formatDate(value: number): string {
    return Number.isFinite(value) ? new Date(value).toLocaleString() : '';
}

function getCss(): string {
    return `
.mock-modal--page-annotation-manager {
  --_modal-width: min(720px, calc(100% - (var(--aimd-space-5) * 2)));
  --_modal-max-height: min(640px, calc(100% - (var(--aimd-space-5) * 2)));
}
.mock-modal--page-annotation-manager .mock-modal__content { overflow: hidden; }
.page-annotation-manager, .page-annotation-manager * { box-sizing: border-box; }
.page-annotation-manager { min-width: 0; min-height: 0; width: 100%; display: grid; grid-template-rows: auto minmax(0, 1fr); gap: var(--aimd-space-3); }
.page-annotation-manager__toolbar { min-width: 0; display: grid; gap: var(--aimd-space-3); }
.page-annotation-manager__row { display: flex; flex-wrap: wrap; align-items: center; gap: var(--aimd-space-2); }
.page-annotation-manager__row--primary { justify-content: space-between; }
.page-annotation-manager__tabs { box-sizing: border-box; display: inline-flex; gap: var(--aimd-space-1); padding: var(--aimd-space-1); border: 1px solid var(--aimd-border-subtle); border-radius: var(--aimd-radius-xl); background: var(--aimd-bg-secondary); width: max-content; }
.page-annotation-manager__tab { all: unset; box-sizing: border-box; cursor: pointer; min-height: var(--aimd-size-control-compact); padding: 0 var(--aimd-space-3); border-radius: var(--aimd-radius-lg); color: var(--aimd-text-secondary); font-size: var(--aimd-text-sm); white-space: nowrap; }
.page-annotation-manager__tab:hover { background: var(--aimd-interactive-hover); color: var(--aimd-text-primary); }
.page-annotation-manager__tab[data-active="1"] { color: var(--aimd-interactive-primary); background: var(--aimd-interactive-selected); font-weight: var(--aimd-font-semibold); }
.page-annotation-manager__search { width: 100%; min-height: var(--aimd-size-control-compact); box-sizing: border-box; padding: 0 var(--aimd-space-3); border: 1px solid var(--aimd-border-default); border-radius: var(--aimd-radius-lg); background: var(--aimd-bg-primary); color: var(--aimd-text-primary); font: inherit; }
.page-annotation-manager__search:focus-visible { outline: none; border-color: var(--aimd-interactive-primary); box-shadow: var(--aimd-shadow-focus); }
.page-annotation-manager__items { min-height: 0; overflow: auto; overscroll-behavior: contain; scrollbar-gutter: stable; }
.page-annotation-manager__item { min-width: 0; display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: var(--aimd-space-3); padding: var(--aimd-space-3) var(--aimd-space-2); border-top: 1px solid var(--aimd-border-subtle); }
.page-annotation-manager__item:last-child { border-bottom: 1px solid var(--aimd-border-subtle); }
.page-annotation-manager__open { all: unset; min-width: 0; cursor: pointer; display: grid; gap: var(--aimd-space-2); }
.page-annotation-manager__quote { min-width: 0; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; color: var(--aimd-text-primary); font-size: var(--aimd-text-sm); line-height: var(--aimd-leading-normal); border-left: 2px solid var(--aimd-interactive-primary); padding-left: var(--aimd-space-2); text-wrap: pretty; }
.page-annotation-manager__comment { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--aimd-text-secondary); font-size: var(--aimd-text-sm); }
.page-annotation-manager__meta { display: flex; flex-wrap: wrap; gap: var(--aimd-space-2); color: var(--aimd-text-tertiary); font-size: var(--aimd-text-xs); font-variant-numeric: tabular-nums; }
.page-annotation-manager__hint { color: var(--aimd-text-secondary); font-size: var(--aimd-text-xs); line-height: var(--aimd-leading-normal); }
.page-annotation-manager__delete { all: unset; box-sizing: border-box; cursor: pointer; align-self: start; display: inline-flex; align-items: center; justify-content: center; width: var(--aimd-size-control-icon-panel); height: var(--aimd-size-control-icon-panel); border-radius: var(--aimd-radius-full); color: var(--aimd-text-secondary); }
.page-annotation-manager__delete:hover { color: var(--aimd-color-danger); background: var(--aimd-interactive-hover); }
.page-annotation-manager__empty, .page-annotation-manager__loading { padding: var(--aimd-space-6) var(--aimd-space-3); color: var(--aimd-text-secondary); text-align: center; font-size: var(--aimd-text-sm); }
.page-annotation-manager__error { display: flex; flex-wrap: wrap; align-items: center; justify-content: center; gap: var(--aimd-space-3); padding: var(--aimd-space-6) var(--aimd-space-3); color: var(--aimd-text-secondary); text-align: center; font-size: var(--aimd-text-sm); }
`;
}

export class PageAnnotationManagerPopover {
    private rootEl: HTMLElement | null = null;
    private closeModal: (() => void) | null = null;
    private params: OpenParams | null = null;
    private view: 'current' | 'all' = 'current';
    private query = '';
    private allRecords: ReaderCommentRecord[] = [];
    private loadedAll = false;
    private loadingAll = false;
    private allLoadFailed = false;
    private pendingSelection: ReaderCommentRecord | null = null;
    private pendingInsertRecords: ReaderCommentRecord[] | null = null;
    private lastVisibleRecordsKey: string | null = null;
    private lastVisibleRecords: ReaderCommentRecord[] = [];
    private lastListRenderKey: string | null = null;

    isOpen(): boolean {
        return Boolean(this.rootEl?.isConnected);
    }

    close(): void {
        this.closeModal?.();
    }

    open(params: OpenParams): void {
        this.close();
        this.params = params;
        this.view = 'current';
        this.query = '';
        this.allRecords = [];
        this.loadedAll = false;
        this.loadingAll = false;
        this.allLoadFailed = false;
        this.pendingSelection = null;
        this.pendingInsertRecords = null;
        this.lastVisibleRecordsKey = null;
        this.lastVisibleRecords = [];
        this.lastListRenderKey = null;
        ensureStyle(params.shadow, getCss(), { id: 'aimd-page-annotation-manager-style', cache: 'shared' });

        const body = document.createElement('div');
        body.className = 'page-annotation-manager';
        body.dataset.aimdRole = 'page-annotation-manager';

        const toolbar = document.createElement('div');
        toolbar.className = 'page-annotation-manager__toolbar';
        const primaryRow = document.createElement('div');
        primaryRow.className = 'page-annotation-manager__row page-annotation-manager__row--primary';
        const tabs = document.createElement('div');
        tabs.className = 'page-annotation-manager__tabs';
        for (const [view, label] of [['current', this.getLabel('pageAnnotationManagerCurrent', 'Current conversation')], ['all', this.getLabel('pageAnnotationManagerAll', 'All')]] as const) {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'page-annotation-manager__tab';
            button.dataset.view = view;
            button.textContent = label;
            button.addEventListener('click', () => { void this.setView(view); });
            tabs.appendChild(button);
        }
        primaryRow.appendChild(tabs);
        const search = document.createElement('input');
        search.type = 'search';
        search.className = 'page-annotation-manager__search';
        search.placeholder = this.getLabel('pageAnnotationManagerSearch', 'Search annotations');
        search.addEventListener('input', () => {
            this.query = search.value.trim().toLowerCase();
            this.render();
        });
        const actionsRow = document.createElement('div');
        actionsRow.className = 'page-annotation-manager__row';
        actionsRow.dataset.role = 'bulk-actions';
        toolbar.append(primaryRow, search, actionsRow);
        body.appendChild(toolbar);
        const items = document.createElement('div');
        items.className = 'page-annotation-manager__items';
        items.dataset.role = 'items';
        body.appendChild(items);
        this.rootEl = body;
        this.render();

        void params.modalHost.showCustom({
            kind: 'info',
            title: this.getLabel('pageAnnotationManagerTitle', 'Annotations'),
            body,
            dialogClassName: 'mock-modal--page-annotation-manager',
            footer: (footer, close) => {
                this.closeModal = close;
                const closeButton = document.createElement('button');
                closeButton.type = 'button';
                closeButton.className = 'mock-modal__button mock-modal__button--secondary';
                closeButton.dataset.action = 'modal-cancel';
                closeButton.textContent = this.getLabel('btnClose', 'Close');
                closeButton.addEventListener('click', () => close());
                footer.appendChild(closeButton);
            },
            onClosed: () => {
                const selected = this.pendingSelection;
                const insertRecords = this.pendingInsertRecords;
                this.pendingSelection = null;
                this.pendingInsertRecords = null;
                this.rootEl = null;
                this.closeModal = null;
                this.params = null;
                if (selected) params.onSelect(selected);
                if (insertRecords && insertRecords.length > 0) void params.onInsertAll(insertRecords);
            },
        });
        // The modal shell appends the dialog synchronously; anchor it next to
        // the input box instead of the default centered placement.
        if (params.anchorRect) {
            const dialog = params.shadow.querySelector<HTMLElement>('.mock-modal--page-annotation-manager');
            if (dialog) positionDialog(dialog, params.anchorRect);
        }
    }

    private getLabel(key: string, fallback: string, substitutions?: string | string[]): string {
        const translated = t(key, substitutions as any);
        if (!translated || translated === key) return fallback;
        return translated;
    }

    private async setView(view: 'current' | 'all'): Promise<void> {
        this.view = view;
        this.lastListRenderKey = null;
        if (view === 'all' && !this.loadedAll && !this.loadingAll) {
            this.loadingAll = true;
            const items = this.rootEl?.querySelector<HTMLElement>('[data-role="items"]');
            if (items) items.innerHTML = `<div class="page-annotation-manager__loading">${this.getLabel('pageAnnotationManagerLoading', 'Loading annotations…')}</div>`;
            try {
                this.allRecords = await this.params?.loadAll() ?? [];
                this.loadedAll = true;
                this.allLoadFailed = false;
            } catch {
                this.allRecords = [];
                this.loadedAll = true;
                this.allLoadFailed = true;
            } finally {
                this.loadingAll = false;
            }
        }
        this.render();
    }

    private getViewRecords(): ReaderCommentRecord[] {
        if (!this.params) return [];
        return this.view === 'current' ? this.params.getCurrentRecords() : this.allRecords;
    }

    private getVisibleRecords(source = this.getViewRecords()): ReaderCommentRecord[] {
        const sourceKey = source.map((record) => this.recordSignature(record)).join('|');
        const visibleKey = `${this.view}|${this.query}|${sourceKey}`;
        if (visibleKey === this.lastVisibleRecordsKey) return this.lastVisibleRecords;

        this.lastVisibleRecordsKey = visibleKey;
        if (!this.query) {
            this.lastVisibleRecords = source;
            return source;
        }
        this.lastVisibleRecords = source.filter((record) => {
            const haystack = [
                record.document?.title,
                record.document?.conversationId,
                record.quoteText,
                record.sourceMarkdown,
                record.comment,
            ].filter(Boolean).join(' ').toLowerCase();
            return haystack.includes(this.query);
        });
        return this.lastVisibleRecords;
    }

    private render(): void {
        if (!this.rootEl || !this.params) return;
        const viewRecords = this.getViewRecords();
        const visible = this.getVisibleRecords(viewRecords);
        const listKey = [
            this.view,
            this.query,
            this.loadedAll ? 'loaded' : 'not-loaded',
            this.loadingAll ? 'loading' : 'idle',
            this.allLoadFailed ? 'failed' : 'ok',
            this.lastVisibleRecordsKey ?? '',
        ].join('|');
        if (listKey === this.lastListRenderKey) return;
        this.lastListRenderKey = listKey;

        this.rootEl.querySelectorAll<HTMLButtonElement>('[data-view]').forEach((button) => {
            button.dataset.active = button.dataset.view === this.view ? '1' : '0';
        });
        this.renderBulkActions(viewRecords);
        const list = this.rootEl.querySelector<HTMLElement>('[data-role="items"]');
        if (!list) return;
        if (this.view === 'all' && !this.loadedAll) {
            list.innerHTML = `<div class="page-annotation-manager__loading">${this.getLabel('pageAnnotationManagerLoading', 'Loading annotations…')}</div>`;
            return;
        }
        if (this.view === 'all' && this.allLoadFailed) {
            const error = document.createElement('div');
            error.className = 'page-annotation-manager__error';
            error.dataset.role = 'all-load-error';
            const message = document.createElement('span');
            message.textContent = this.getLabel('pageAnnotationManagerLoadFailed', 'Could not load all annotations');
            const retry = document.createElement('button');
            retry.type = 'button';
            retry.className = 'mock-modal__button mock-modal__button--secondary';
            retry.dataset.action = 'page-annotation-retry-all';
            retry.textContent = this.getLabel('pageAnnotationManagerRetry', 'Retry');
            retry.addEventListener('click', () => {
                this.loadedAll = false;
                this.allLoadFailed = false;
                void this.setView('all');
            });
            error.append(message, retry);
            list.replaceChildren(error);
            return;
        }
        if (visible.length < 1) {
            list.innerHTML = `<div class="page-annotation-manager__empty">${this.getLabel('pageAnnotationManagerEmpty', 'No annotations yet.')}</div>`;
            return;
        }
        list.replaceChildren(...visible.map((record) => this.createRow(record)));
    }

    private recordSignature(record: ReaderCommentRecord): string {
        return [
            record.id,
            record.revision ?? '',
            record.updatedAt,
            record.lastKnownAnchorState ?? '',
            record.quoteText,
            record.sourceMarkdown,
            record.comment,
            record.target?.assistantMessageId ?? '',
            record.target?.roundId ?? '',
            record.target?.userMessageId ?? '',
            record.target?.position ?? '',
            record.document?.conversationId ?? '',
            record.document?.title ?? '',
            record.document?.lastKnownUrl ?? '',
        ].map((value) => `${String(value).length}:${String(value)}`).join('|');
    }

    private renderBulkActions(viewRecords = this.getViewRecords()): void {
        if (!this.rootEl || !this.params) return;
        const actions = this.rootEl.querySelector<HTMLElement>('[data-role="bulk-actions"]');
        if (!actions) return;
        actions.replaceChildren();
        if (this.view !== 'current') {
            const hint = document.createElement('span');
            hint.className = 'page-annotation-manager__hint';
            hint.dataset.role = 'all-view-hint';
            hint.textContent = this.getLabel(
                'pageAnnotationManagerAllHint',
                'The All view is for review and management. Switch to Current conversation to insert.',
            );
            actions.appendChild(hint);
            return;
        }
        const total = viewRecords.length;

        const insertAll = document.createElement('button');
        insertAll.type = 'button';
        insertAll.className = 'mock-modal__button mock-modal__button--primary';
        insertAll.dataset.action = 'page-annotation-insert-all';
        insertAll.textContent = this.getLabel('pageAnnotationInsert', 'Insert to input');
        insertAll.disabled = total < 1;
        insertAll.addEventListener('click', () => {
            this.pendingInsertRecords = this.getViewRecords();
            this.closeModal?.();
        });
        actions.appendChild(insertAll);
    }

    private createRow(record: ReaderCommentRecord): HTMLElement {
        const row = document.createElement('article');
        row.className = 'page-annotation-manager__item';
        const open = document.createElement('button');
        open.type = 'button';
        open.className = 'page-annotation-manager__open';
        const quote = document.createElement('span');
        quote.className = 'page-annotation-manager__quote';
        quote.textContent = excerpt(record.sourceMarkdown || record.quoteText) || '-';
        const comment = document.createElement('span');
        comment.className = 'page-annotation-manager__comment';
        comment.textContent = compact(record.comment) || '-';
        const meta = document.createElement('span');
        meta.className = 'page-annotation-manager__meta';
        const conversation = compact(record.document?.title ?? '') || compact(record.document?.conversationId ?? '');
        const parts = [
            `${this.getLabel('pageAnnotationManagerReply', 'Reply')} ${String(record.target?.position ?? '—')}`,
            `${this.getLabel('pageAnnotationManagerUpdated', 'Updated')} ${formatDate(record.updatedAt)}`,
        ];
        if (conversation) parts.unshift(`${this.getLabel('pageAnnotationManagerConversation', 'Conversation')} ${conversation}`);
        if (record.lastKnownAnchorState === 'unanchored') parts.push(this.getLabel('pageAnnotationManagerUnanchored', 'Not located'));
        meta.textContent = parts.join(' · ');
        open.append(quote, comment, meta);
        open.addEventListener('click', () => {
            this.pendingSelection = record;
            this.closeModal?.();
        });
        const deleteButton = document.createElement('button');
        deleteButton.type = 'button';
        deleteButton.className = 'page-annotation-manager__delete';
        deleteButton.setAttribute('aria-label', this.getLabel('btnDelete', 'Delete'));
        deleteButton.appendChild(createIcon(trashIcon));
        deleteButton.addEventListener('click', async () => {
            deleteButton.disabled = true;
            const ok = await (this.params?.onDelete(record) ?? Promise.resolve(false));
            if (ok) {
                this.allRecords = this.allRecords.filter((candidate) => candidate.id !== record.id);
                this.render();
            } else {
                deleteButton.disabled = false;
            }
        });
        row.append(open, deleteButton);
        return row;
    }
}
