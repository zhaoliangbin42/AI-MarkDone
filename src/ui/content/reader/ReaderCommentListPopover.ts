import { fileTextIcon, trashIcon } from '../../../assets/icons';
import type { ReaderCommentSortMode } from '../../../core/settings/readerCommentExport';
import { sortReaderComments, type ReaderCommentRecord } from '../../../services/reader/commentSession';
import { ensureStyle } from '../../../style/shadow';
import { getFlatWorkflowCss } from '../components/styles/flatWorkflowCss';
import { createIcon } from '../components/Icon';
import type { ModalHost } from '../components/ModalHost';
import { t } from '../components/i18n';

type OpenParams = {
    shadow: ShadowRoot;
    modalHost: ModalHost;
    comments: ReaderCommentRecord[];
    sortMode: ReaderCommentSortMode;
    labels: {
        title: string;
        close: string;
        empty: string;
        error: string;
        sortByCreated: string;
        sortByPosition: string;
        selectedSource: string;
        userComment: string;
        createdAt: string;
        textPosition: string;
        delete: string;
    };
    onSortChange: (sortMode: ReaderCommentSortMode) => void | Promise<void>;
    onSelect: (record: ReaderCommentRecord) => void;
    onDelete: (record: ReaderCommentRecord) => void | Promise<void>;
    onClose?: () => void;
};

function compactText(value: string): string {
    return value.replace(/\s+/g, ' ').trim();
}

function formatDate(value: number): string {
    if (!Number.isFinite(value)) return '';
    return new Date(value).toLocaleString();
}

function formatTextPosition(record: ReaderCommentRecord): string {
    const start = record.selectors.textPosition.start;
    const end = record.selectors.textPosition.end;
    if (typeof start !== 'number' || !Number.isFinite(start)) return '-';
    if (typeof end !== 'number' || !Number.isFinite(end)) return String(start);
    return `${start}-${end}`;
}

function getCommentListCss(): string {
    return `
${getFlatWorkflowCss()}
.mock-modal--reader-comment-list {
  --_modal-content-max-width: 760px;
  --_modal-content-max-height: 720px;
}

.mock-modal--reader-comment-list .mock-modal__content {
  overflow: hidden;
}

.reader-comment-list {
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: var(--aimd-space-4);
  overflow: hidden;
}

.reader-comment-list__toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--aimd-space-3);
}

.reader-comment-list__sort {
  gap: var(--aimd-space-4);
  min-width: 0;
}

.reader-comment-list__options { color: var(--aimd-text-secondary); font-size: var(--aimd-text-sm); }
.reader-comment-list__options > summary { cursor: pointer; padding-block: var(--aimd-space-2); }

.reader-comment-list__sort-button {
  box-sizing: border-box;
  white-space: normal;
  overflow-wrap: anywhere;
  min-width: 0;
  text-align: center;
}

.reader-comment-list__sort-button[data-active="1"] {
  font-weight: var(--aimd-font-semibold);
}

.reader-comment-list__sort-error {
  color: var(--aimd-color-danger);
  font-size: var(--aimd-text-sm);
  line-height: var(--aimd-leading-normal);
}

.reader-comment-list__items {
  flex: 1 1 auto;
  min-height: 0;
  overflow: auto;
  overscroll-behavior: contain;
  scrollbar-gutter: stable;
  display: grid;
  align-content: start;
  gap: 0;
  padding-right: var(--aimd-space-1);
}

.reader-comment-list__empty {
  padding: var(--aimd-space-6);
  color: var(--aimd-text-secondary);
  font-size: var(--aimd-text-sm);
  text-align: center;
}

.reader-comment-list__item {
  box-sizing: border-box;
  min-width: 0;
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: start;
  gap: var(--aimd-space-3);
  padding: var(--aimd-space-4);
  border-bottom: 1px solid var(--aimd-border-subtle);
}

.reader-comment-list__item:hover,
.reader-comment-list__item:focus-within {
  background: var(--aimd-workspace-surface);
}

.reader-comment-list__item-meta {
  display: flex;
  flex-wrap: wrap;
  gap: var(--aimd-space-2);
  color: var(--aimd-text-tertiary);
  font-size: var(--aimd-text-xs);
  line-height: var(--aimd-leading-normal);
  font-variant-numeric: tabular-nums;
}

.reader-comment-list__item-meta .aimd-icon {
  display: inline-flex;
  vertical-align: text-bottom;
  margin-right: var(--aimd-space-1);
}

.reader-comment-list__delete {
  color: var(--aimd-text-secondary);
}

.reader-comment-list__delete:hover,
.reader-comment-list__delete:focus-visible {
  color: var(--aimd-color-danger);
}

.reader-comment-list__open {
  all: unset;
  box-sizing: border-box;
  cursor: pointer;
  min-width: 0;
  display: grid;
  gap: var(--aimd-space-3);
  border-radius: var(--aimd-radius-md);
}

.reader-comment-list__open:focus-visible {
  outline: 2px solid var(--aimd-focus-ring);
  outline-offset: var(--aimd-space-1);
}

.reader-comment-list__item-body {
  display: grid;
  gap: var(--aimd-space-1);
  min-width: 0;
}

.reader-comment-list__label {
  color: var(--aimd-text-tertiary);
  font-size: var(--aimd-text-xs);
  font-weight: var(--aimd-font-semibold);
}

.reader-comment-list__text {
  min-width: 0;
  color: var(--aimd-text-primary);
  font-size: var(--aimd-text-sm);
  line-height: var(--aimd-leading-normal);
  overflow-wrap: anywhere;
  overflow: hidden;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

.reader-comment-list__text--source {
  color: var(--aimd-text-secondary);
  padding-left: var(--aimd-space-3);
  border-left: 2px solid var(--aimd-border-default);
}
@media (max-width: 560px) { .reader-comment-list__sort { width: 100%; } .reader-comment-list__sort-button { flex: 1 1 0; } }
`;
}

export class ReaderCommentListPopover {
    private rootEl: HTMLElement | null = null;
    private params: OpenParams | null = null;
    private closeModal: (() => void) | null = null;
    private pendingSelection: ReaderCommentRecord | null = null;
    private sortChangePending = false;

    isOpen(): boolean {
        return Boolean(this.rootEl?.isConnected);
    }

    close(): void {
        this.pendingSelection = null;
        this.closeModal?.();
    }

    open(params: OpenParams): void {
        this.close();
        this.params = params;
        ensureStyle(params.shadow, getCommentListCss(), { id: 'aimd-reader-comment-list-style', cache: 'shared' });

        const body = document.createElement('div');
        body.className = 'reader-comment-list flat-workflow';
        body.innerHTML = `
          <details class="reader-comment-list__options">
            <summary>${t('libraryMore') === 'libraryMore' ? 'More' : t('libraryMore')}</summary>
            <div class="reader-comment-list__sort flat-workflow__tabs" role="group">
              <button class="reader-comment-list__sort-button flat-workflow__tab" type="button" data-sort-mode="created"></button>
              <button class="reader-comment-list__sort-button flat-workflow__tab" type="button" data-sort-mode="position"></button>
            </div>
          </details>
          <div class="reader-comment-list__sort-error" data-role="sort-error" role="alert" aria-live="polite" hidden></div>
          <div class="reader-comment-list__items flat-workflow__list" data-role="items"></div>
        `;
        body.querySelector<HTMLButtonElement>('[data-sort-mode="created"]')!.textContent = params.labels.sortByCreated;
        body.querySelector<HTMLButtonElement>('[data-sort-mode="position"]')!.textContent = params.labels.sortByPosition;
        this.rootEl = body;

        body.querySelectorAll<HTMLButtonElement>('[data-sort-mode]').forEach((button) => {
            button.addEventListener('click', () => {
                const next = button.dataset.sortMode === 'position' ? 'position' : 'created';
                void this.applySortMode(next);
            });
        });
        this.renderList();

        void params.modalHost.showCustom({
            kind: 'info',
            title: params.labels.title,
            body,
            dialogClassName: 'mock-modal--reader-comment-list',
            footer: (footer, close) => {
                this.closeModal = close;
                const closeButton = document.createElement('button');
                closeButton.type = 'button';
                closeButton.className = 'mock-modal__button mock-modal__button--secondary';
                closeButton.dataset.action = 'modal-cancel';
                closeButton.textContent = params.labels.close;
                closeButton.addEventListener('click', () => {
                    params.onClose?.();
                    close();
                });
                footer.appendChild(closeButton);
            },
            onDismiss: () => params.onClose?.(),
            onClosed: () => {
                const selected = this.pendingSelection;
                this.pendingSelection = null;
                this.rootEl = null;
                this.closeModal = null;
                this.params = null;
                if (selected) params.onSelect({ ...selected });
            },
        });
    }

    update(params: { comments?: ReaderCommentRecord[]; sortMode?: ReaderCommentSortMode }): void {
        if (!this.params) return;
        this.params = {
            ...this.params,
            comments: params.comments ?? this.params.comments,
            sortMode: params.sortMode ?? this.params.sortMode,
        };
        this.renderList();
    }

    private async applySortMode(next: ReaderCommentSortMode): Promise<void> {
        const params = this.params;
        if (!params || this.sortChangePending || params.sortMode === next) return;
        const previous = params.sortMode;
        this.sortChangePending = true;
        this.setSortError(null);
        this.params = { ...params, sortMode: next };
        this.renderList();
        try {
            await params.onSortChange(next);
        } catch (error) {
            if (this.params) this.params = { ...this.params, sortMode: previous };
            this.renderList();
            this.setSortError(error instanceof Error && error.message
                ? error.message
                : params.labels.error);
        } finally {
            this.sortChangePending = false;
            this.renderList();
        }
    }

    private setSortError(message: string | null): void {
        const error = this.rootEl?.querySelector<HTMLElement>('[data-role="sort-error"]');
        if (!error) return;
        error.textContent = message ?? '';
        error.hidden = !message;
    }

    private renderList(): void {
        if (!this.rootEl || !this.params) return;
        const list = this.rootEl.querySelector<HTMLElement>('[data-role="items"]');
        if (!list) return;

        this.rootEl.querySelectorAll<HTMLButtonElement>('[data-sort-mode]').forEach((button) => {
            button.dataset.active = button.dataset.sortMode === this.params?.sortMode ? '1' : '0';
            button.disabled = this.sortChangePending;
        });

        const comments = sortReaderComments(this.params.comments, this.params.sortMode);
        if (comments.length < 1) {
            const empty = document.createElement('div');
            empty.className = 'reader-comment-list__empty flat-workflow__description';
            empty.textContent = this.params.labels.empty;
            list.replaceChildren(empty);
            return;
        }

        list.replaceChildren(...comments.map((record) => this.createItem(record)));
    }

    private createItem(record: ReaderCommentRecord): HTMLElement {
        const item = document.createElement('article');
        item.className = 'reader-comment-list__item flat-workflow__item';
        item.dataset.commentId = record.id;

        const meta = document.createElement('div');
        meta.className = 'reader-comment-list__item-meta';
        const created = document.createElement('span');
        created.textContent = `${this.params!.labels.createdAt}: ${formatDate(record.createdAt)}`;
        const position = document.createElement('span');
        position.appendChild(createIcon(fileTextIcon));
        position.append(`${this.params!.labels.textPosition}: ${formatTextPosition(record)}`);
        meta.append(created, position);

        const deleteButton = document.createElement('button');
        deleteButton.type = 'button';
        deleteButton.className = 'icon-btn icon-btn--danger reader-comment-list__delete';
        deleteButton.dataset.action = 'delete';
        deleteButton.setAttribute('aria-label', this.params!.labels.delete);
        deleteButton.title = this.params!.labels.delete;
        deleteButton.appendChild(createIcon(trashIcon));
        deleteButton.addEventListener('click', () => {
            const params = this.params;
            if (!params) return;
            void Promise.resolve(params.onDelete({ ...record }));
        });
        const openButton = document.createElement('button');
        openButton.type = 'button';
        openButton.className = 'reader-comment-list__open';
        openButton.dataset.action = 'open';
        const source = this.createTextSection(this.params!.labels.selectedSource, compactText(record.sourceMarkdown || record.quoteText));
        const comment = this.createTextSection(this.params!.labels.userComment, compactText(record.comment), true);
        openButton.append(comment, source, meta);
        openButton.addEventListener('click', () => {
            this.pendingSelection = { ...record };
            this.closeModal?.();
        });
        item.append(openButton, deleteButton);
        return item;
    }

    private createTextSection(label: string, value: string, comment: boolean = false): HTMLElement {
        const section = document.createElement('span');
        section.className = 'reader-comment-list__item-body';
        const labelEl = document.createElement('span');
        labelEl.className = 'reader-comment-list__label';
        labelEl.textContent = label;
        const text = document.createElement('span');
        text.className = `reader-comment-list__text reader-comment-list__text--${comment ? 'comment' : 'source'}`;
        text.textContent = value || '-';
        section.append(...(comment ? [text] : [labelEl, text]));
        return section;
    }
}
