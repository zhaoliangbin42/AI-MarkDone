import { fileTextIcon, messageSquareTextIcon, trashIcon, xIcon } from '../../../assets/icons';
import type { Theme } from '../../../core/types/theme';
import type { ReaderCommentSortMode } from '../../../core/settings/readerCommentExport';
import { sortReaderComments, type ReaderCommentRecord } from '../../../services/reader/commentSession';
import { ensureStyle } from '../../../style/shadow';
import { createIcon } from '../components/Icon';
import { markTransientRoot } from '../components/transientUi';

type OpenParams = {
    shadow: ShadowRoot;
    container: HTMLElement;
    theme: Theme;
    comments: ReaderCommentRecord[];
    sortMode: ReaderCommentSortMode;
    labels: {
        title: string;
        close: string;
        empty: string;
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

function escapeHtml(input: string): string {
    return input
        .split('&').join('&amp;')
        .split('<').join('&lt;')
        .split('>').join('&gt;')
        .split('"').join('&quot;')
        .split("'").join('&#39;');
}

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
.reader-comment-list-layer {
  position: absolute;
  inset: 0;
  box-sizing: border-box;
  padding: var(--aimd-space-4);
  display: grid;
  place-items: center;
  pointer-events: none;
  overflow: hidden;
}

.reader-comment-list {
  box-sizing: border-box;
  pointer-events: auto;
  inline-size: 760px;
  max-inline-size: 100%;
  block-size: min(720px, 100%);
  max-block-size: 100%;
  display: flex;
  flex-direction: column;
  gap: var(--aimd-space-4);
  padding: var(--aimd-space-4);
  border-radius: var(--aimd-radius-2xl);
  border: 1px solid color-mix(in srgb, var(--aimd-border-default) 82%, transparent);
  background: color-mix(in srgb, var(--aimd-bg-surface) 98%, var(--aimd-bg-primary));
  box-shadow: var(--aimd-shadow-lg);
  overflow: hidden;
}

.reader-comment-list__head,
.reader-comment-list__toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--aimd-space-3);
}

.reader-comment-list__title {
  display: inline-flex;
  align-items: center;
  gap: var(--aimd-space-2);
  min-width: 0;
  margin: 0;
  color: var(--aimd-text-primary);
  font-size: var(--aimd-text-sm);
  line-height: 1.4;
  font-weight: var(--aimd-font-medium);
}

.reader-comment-list__title .aimd-icon {
  color: var(--aimd-interactive-primary);
}

.reader-comment-list__close {
  color: var(--aimd-text-secondary);
}

.reader-comment-list__sort {
  display: inline-flex;
  align-items: center;
  gap: var(--aimd-space-1);
  padding: var(--aimd-space-1);
  border-radius: var(--aimd-radius-xl);
  border: 1px solid var(--aimd-border-subtle);
  background: var(--aimd-bg-secondary);
}

.reader-comment-list__sort-button {
  all: unset;
  box-sizing: border-box;
  cursor: pointer;
  min-height: var(--aimd-size-control-compact);
  padding: 0 var(--aimd-space-3);
  border-radius: var(--aimd-radius-lg);
  color: var(--aimd-text-secondary);
  font-size: var(--aimd-text-sm);
  white-space: nowrap;
}

.reader-comment-list__sort-button[data-active="1"] {
  color: var(--aimd-interactive-primary);
  background: var(--aimd-interactive-selected);
  font-weight: var(--aimd-font-semibold);
}

.reader-comment-list__items {
  flex: 1 1 auto;
  block-size: 100%;
  min-height: 0;
  overflow: auto;
  overscroll-behavior: contain;
  scrollbar-gutter: stable;
  display: grid;
  align-content: start;
  gap: var(--aimd-space-2);
  padding-right: var(--aimd-space-1);
}

.reader-comment-list__empty {
  padding: var(--aimd-space-6);
  border-radius: var(--aimd-radius-xl);
  border: 1px dashed color-mix(in srgb, var(--aimd-border-default) 82%, transparent);
  color: var(--aimd-text-secondary);
  font-size: var(--aimd-text-sm);
  text-align: center;
}

.reader-comment-list__item {
  box-sizing: border-box;
  min-width: 0;
  cursor: pointer;
  display: grid;
  gap: var(--aimd-space-2);
  padding: var(--aimd-space-3);
  border-radius: var(--aimd-radius-xl);
  border: 1px solid color-mix(in srgb, var(--aimd-border-default) 72%, transparent);
  background: color-mix(in srgb, var(--aimd-bg-primary) 94%, transparent);
}

.reader-comment-list__item:hover,
.reader-comment-list__item:focus-visible,
.reader-comment-list__item:focus-within {
  border-color: color-mix(in srgb, var(--aimd-interactive-primary) 42%, var(--aimd-border-default));
  background: color-mix(in srgb, var(--aimd-surface-hover) 82%, var(--aimd-bg-primary));
  outline: none;
}

.reader-comment-list__item-head {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: start;
  gap: var(--aimd-space-2);
  min-width: 0;
}

.reader-comment-list__item-meta {
  display: flex;
  flex-wrap: wrap;
  gap: var(--aimd-space-2);
  color: var(--aimd-text-tertiary);
  font-size: var(--aimd-text-xs);
  line-height: 1.4;
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

.reader-comment-list__item-body {
  display: grid;
  gap: var(--aimd-space-1);
  min-width: 0;
}

.reader-comment-list__label {
  color: var(--aimd-text-tertiary);
  font-size: var(--aimd-text-xs);
  font-weight: var(--aimd-font-medium);
}

.reader-comment-list__text {
  min-width: 0;
  color: var(--aimd-text-primary);
  font-size: var(--aimd-text-sm);
  line-height: 1.45;
  overflow-wrap: anywhere;
  overflow: hidden;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

.reader-comment-list__text--comment {
  color: var(--aimd-text-secondary);
}
`;
}

export class ReaderCommentListPopover {
    private rootEl: HTMLElement | null = null;
    private onShadowPointerDown: ((event: Event) => void) | null = null;
    private onDocumentPointerDown: ((event: Event) => void) | null = null;
    private params: OpenParams | null = null;

    isOpen(): boolean {
        return Boolean(this.rootEl);
    }

    close(shadow?: ShadowRoot): void {
        const activeShadow = shadow ?? this.params?.shadow;
        if (!this.rootEl) return;
        if (activeShadow && this.onShadowPointerDown) {
            activeShadow.removeEventListener('pointerdown', this.onShadowPointerDown, true);
        }
        if (this.onDocumentPointerDown) {
            document.removeEventListener('pointerdown', this.onDocumentPointerDown, true);
        }
        this.onShadowPointerDown = null;
        this.onDocumentPointerDown = null;
        this.rootEl.remove();
        this.rootEl = null;
        this.params = null;
    }

    open(params: OpenParams): void {
        this.close(params.shadow);
        this.params = params;
        ensureStyle(params.shadow, getCommentListCss(), { id: 'aimd-reader-comment-list-style', cache: 'shared' });

        const layer = markTransientRoot(document.createElement('div'));
        layer.className = 'reader-comment-list-layer';

        const popover = document.createElement('div');
        popover.className = 'reader-comment-list';
        popover.setAttribute('data-aimd-theme', params.theme);
        popover.innerHTML = `
          <div class="reader-comment-list__head">
            <h3 class="reader-comment-list__title">${createIcon(messageSquareTextIcon).outerHTML}<span>${escapeHtml(params.labels.title)}</span></h3>
            <button class="icon-btn reader-comment-list__close" type="button" data-action="close" aria-label="${escapeHtml(params.labels.close)}">${createIcon(xIcon).outerHTML}</button>
          </div>
          <div class="reader-comment-list__toolbar">
            <div class="reader-comment-list__sort" role="group">
              <button class="reader-comment-list__sort-button" type="button" data-sort-mode="created">${escapeHtml(params.labels.sortByCreated)}</button>
              <button class="reader-comment-list__sort-button" type="button" data-sort-mode="position">${escapeHtml(params.labels.sortByPosition)}</button>
            </div>
          </div>
          <div class="reader-comment-list__items" data-role="items"></div>
        `;

        layer.appendChild(popover);
        params.container.appendChild(layer);
        this.rootEl = layer;
        this.renderList();

        popover.querySelector<HTMLButtonElement>('[data-action="close"]')?.addEventListener('click', () => {
            params.onClose?.();
            this.close(params.shadow);
        });

        popover.querySelectorAll<HTMLButtonElement>('[data-sort-mode]').forEach((button) => {
            button.addEventListener('click', () => {
                const next = button.dataset.sortMode === 'position' ? 'position' : 'created';
                if (!this.params || this.params.sortMode === next) return;
                this.params = { ...this.params, sortMode: next };
                void Promise.resolve(params.onSortChange(next));
                this.renderList();
            });
        });

        this.onShadowPointerDown = (event: Event) => {
            if (this.shouldIgnorePointerDown(event)) return;
            params.onClose?.();
            this.close(params.shadow);
        };
        this.onDocumentPointerDown = (event: Event) => {
            if (this.shouldIgnorePointerDown(event)) return;
            params.onClose?.();
            this.close(params.shadow);
        };
        params.shadow.addEventListener('pointerdown', this.onShadowPointerDown, true);
        document.addEventListener('pointerdown', this.onDocumentPointerDown, true);
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

    private renderList(): void {
        if (!this.rootEl || !this.params) return;
        const list = this.rootEl.querySelector<HTMLElement>('[data-role="items"]');
        if (!list) return;

        this.rootEl.querySelectorAll<HTMLButtonElement>('[data-sort-mode]').forEach((button) => {
            button.dataset.active = button.dataset.sortMode === this.params?.sortMode ? '1' : '0';
        });

        const comments = sortReaderComments(this.params.comments, this.params.sortMode);
        if (comments.length < 1) {
            list.innerHTML = `<div class="reader-comment-list__empty">${escapeHtml(this.params.labels.empty)}</div>`;
            return;
        }

        list.replaceChildren(...comments.map((record) => this.createItem(record)));
    }

    private createItem(record: ReaderCommentRecord): HTMLElement {
        const item = document.createElement('article');
        item.className = 'reader-comment-list__item';
        item.dataset.commentId = record.id;
        item.tabIndex = 0;
        item.setAttribute('role', 'button');

        const source = compactText(record.sourceMarkdown || record.quoteText);
        const comment = compactText(record.comment);
        item.innerHTML = `
          <div class="reader-comment-list__item-head">
            <div class="reader-comment-list__item-meta">
              <span>${escapeHtml(this.params!.labels.createdAt)}: ${escapeHtml(formatDate(record.createdAt))}</span>
              <span>${createIcon(fileTextIcon).outerHTML}${escapeHtml(this.params!.labels.textPosition)}: ${escapeHtml(formatTextPosition(record))}</span>
            </div>
            <button class="icon-btn icon-btn--danger reader-comment-list__delete" type="button" data-action="delete" aria-label="${escapeHtml(this.params!.labels.delete)}" title="${escapeHtml(this.params!.labels.delete)}">${createIcon(trashIcon).outerHTML}</button>
          </div>
          <div class="reader-comment-list__item-body">
            <span class="reader-comment-list__label">${escapeHtml(this.params!.labels.selectedSource)}</span>
            <span class="reader-comment-list__text">${escapeHtml(source || '-')}</span>
          </div>
          <div class="reader-comment-list__item-body">
            <span class="reader-comment-list__label">${escapeHtml(this.params!.labels.userComment)}</span>
            <span class="reader-comment-list__text reader-comment-list__text--comment">${escapeHtml(comment || '-')}</span>
          </div>
        `;
        const open = () => {
            const params = this.params;
            if (!params) return;
            this.close(params.shadow);
            params.onSelect({ ...record });
        };
        item.addEventListener('click', open);
        item.addEventListener('keydown', (event) => {
            if (event.key !== 'Enter' && event.key !== ' ') return;
            event.preventDefault();
            open();
        });
        item.querySelector<HTMLButtonElement>('[data-action="delete"]')?.addEventListener('click', (event) => {
            event.preventDefault();
            event.stopPropagation();
            const params = this.params;
            if (!params) return;
            void Promise.resolve(params.onDelete({ ...record }));
        });
        return item;
    }

    private shouldIgnorePointerDown(event: Event): boolean {
        const path = (event.composedPath?.() ?? []) as EventTarget[];
        return path.includes(this.rootEl as EventTarget);
    }
}
