import type { Theme } from '../../../core/types/theme';
import { copyIcon, messageSquareTextIcon, xIcon } from '../../../assets/icons';
import { createIcon } from '../components/Icon';
import { markTransientRoot } from '../components/transientUi';
import { ensureStyle } from '../../../style/shadow';
import { getFlatWorkflowCss } from '../components/styles/flatWorkflowCss';
import { t } from '../components/i18n';

type AnnotationOption = { id: string; comment: string; source: string };
type PreviewUpdate = { preview?: string; canCopy?: boolean; annotations?: AnnotationOption[] };

type OpenParams = {
    shadow: ShadowRoot;
    container: HTMLElement;
    theme: Theme;
    preview: string;
    canCopy: boolean;
    annotationSelection?: {
        options: AnnotationOption[];
        label: string;
        selectAllLabel: string;
        countLabel: (selected: number, total: number) => string;
        copyLabel?: (selected: number) => string;
        deleteLabel?: (selected: number) => string;
        onChange: (selectedIds: string[]) => void;
    };
    promptSelection?: {
        options: Array<{ id: string; title: string }>;
        label: string;
        emptyLabel: string;
        onSelect: (promptId: string) => void;
    };
    labels?: {
        title?: string;
        close?: string;
        copy?: string;
        copied?: string;
        empty?: string;
        preview?: string;
    };
    onCopy: () => Promise<boolean>;
    onDelete?: (selectedIds: string[]) => Promise<string[]>;
    onClose?: () => void;
};

function getExportPopoverCss(): string {
    return `
${getFlatWorkflowCss()}
.reader-comment-export-layer {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  pointer-events: none;
}

.reader-comment-export {
  pointer-events: auto;
  width: min(560px, calc(100% - var(--aimd-space-4) * 2));
  max-height: min(100%, calc(100dvh - var(--aimd-space-4) * 2));
  min-height: 0;
  display: grid;
  grid-template-rows: auto minmax(0, 1fr) auto;
  border: 1px solid var(--aimd-workspace-border);
  border-radius: var(--aimd-radius-2xl);
  background: var(--aimd-workspace-card);
  box-shadow: var(--aimd-shadow-workspace);
  overflow: hidden;
}

.reader-comment-export__head,
.reader-comment-export__actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--aimd-space-3);
  padding: var(--aimd-space-4) var(--aimd-space-5);
  min-width: 0;
}

.reader-comment-export__title {
  display: inline-flex;
  align-items: center;
  gap: var(--aimd-space-2);
  margin: 0;
  font-size: var(--aimd-text-base);
  line-height: var(--aimd-leading-normal);
  font-weight: var(--aimd-font-semibold);
  color: var(--aimd-text-primary);
  min-width: 0;
  overflow-wrap: anywhere;
}

.reader-comment-export__title .aimd-icon {
  color: var(--aimd-text-secondary);
}

.reader-comment-export__close {
  flex: none;
  width: calc(var(--aimd-size-control-action-panel) + var(--aimd-space-1));
  height: calc(var(--aimd-size-control-action-panel) + var(--aimd-space-1));
}

.reader-comment-export__head { border-bottom: 1px solid var(--aimd-border-subtle); }
.reader-comment-export__actions { justify-content: flex-end; flex-wrap: wrap; border-top: 1px solid var(--aimd-border-subtle); }
.reader-comment-export__body { min-height: 0; }
.reader-comment-export__prompt { display: grid; gap: var(--aimd-space-2); color: var(--aimd-text-secondary); font-size: var(--aimd-text-sm); }
.reader-comment-export__prompt-select { min-height: var(--aimd-size-control-action-panel); }
.reader-comment-export__selection { display: grid; gap: var(--aimd-space-3); min-width: 0; }
.reader-comment-export__selection-title { margin: 0; font-size: var(--aimd-text-sm); font-weight: var(--aimd-font-medium); }
.reader-comment-export__selection-head { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: var(--aimd-space-2); }
.reader-comment-export__select-all { display: inline-flex; align-items: center; gap: var(--aimd-space-2); font-size: var(--aimd-text-sm); cursor: pointer; }
.reader-comment-export__count { color: var(--aimd-text-secondary); font-size: var(--aimd-text-xs); font-variant-numeric: tabular-nums; }
.reader-comment-export__option { display: flex; align-items: flex-start; gap: var(--aimd-space-3); cursor: pointer; }
.reader-comment-export__option input,
.reader-comment-export__select-all input { flex: none; margin: 0; accent-color: var(--aimd-interactive-primary); }
.reader-comment-export__option input { margin-top: var(--aimd-space-1); }
.reader-comment-export__option:has(input:checked) { background: var(--aimd-workspace-surface); }
.reader-comment-export__option-text { display: grid; gap: var(--aimd-space-1); min-width: 0; }
.reader-comment-export__note { color: var(--aimd-text-primary); font-size: var(--aimd-text-sm); line-height: var(--aimd-leading-normal); }
.reader-comment-export__source { color: var(--aimd-text-secondary); font-size: var(--aimd-text-xs); line-height: var(--aimd-leading-normal); }
.reader-comment-export__note,
.reader-comment-export__source { display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; overflow: hidden; overflow-wrap: anywhere; white-space: pre-wrap; }
.reader-comment-export__selection .flat-workflow__list { overflow: hidden; }
.reader-comment-export__prompt-disclosure > summary { cursor: pointer; color: var(--aimd-text-secondary); font-size: var(--aimd-text-sm); overflow-wrap: anywhere; }
.reader-comment-export__prompt-disclosure[open] > summary { margin-bottom: var(--aimd-space-3); }
.reader-comment-export__preview-disclosure > summary { cursor: pointer; color: var(--aimd-text-secondary); font-size: var(--aimd-text-sm); }
.reader-comment-export__preview-disclosure[open] > summary { margin-bottom: var(--aimd-space-4); }

.reader-comment-export__preview {
  margin: 0;
  min-height: calc(var(--aimd-size-control-action-panel) * 3);
  padding: 0;
  font-family: var(--aimd-font-family-mono);
  font-size: var(--aimd-text-sm);
  line-height: var(--aimd-leading-reading);
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

.reader-comment-export__btn {
  gap: var(--aimd-space-2);
  padding-inline: var(--aimd-space-4);
  min-width: 0;
  max-width: 100%;
  white-space: normal;
  overflow-wrap: anywhere;
}

.reader-comment-export__btn:disabled {
  cursor: not-allowed;
}
@media (max-height: 568px) { .reader-comment-export__preview { min-height: 0; } }
`;
}

export class ReaderCommentExportPopover {
    private rootEl: HTMLElement | null = null;
    private dismissHandler: (() => void) | null = null;
    private onShadowPointerDown: ((event: Event) => void) | null = null;
    private onDocumentPointerDown: ((event: Event) => void) | null = null;
    private previewUpdater: ((params: PreviewUpdate) => void) | null = null;
    private copyFeedbackTimer: number | null = null;

    isOpen(): boolean {
        return Boolean(this.rootEl);
    }

    requestClose(): void {
        this.dismissHandler?.();
    }

    close(shadow: ShadowRoot): void {
        if (!this.rootEl) return;
        if (this.copyFeedbackTimer !== null) window.clearTimeout(this.copyFeedbackTimer);
        this.copyFeedbackTimer = null;
        this.previewUpdater = null;
        if (this.onShadowPointerDown) {
            shadow.removeEventListener('pointerdown', this.onShadowPointerDown, true);
            this.onShadowPointerDown = null;
        }
        if (this.onDocumentPointerDown) {
            document.removeEventListener('pointerdown', this.onDocumentPointerDown, true);
            this.onDocumentPointerDown = null;
        }
        this.rootEl.remove();
        this.rootEl = null;
        this.dismissHandler = null;
    }

    open(params: OpenParams): void {
        this.close(params.shadow);
        ensureStyle(params.shadow, getExportPopoverCss(), { id: 'aimd-reader-comment-export-style', cache: 'shared' });
        const previewLabel = t('readerCommentTemplatePreviewLabel');
        const labels = {
            title: params.labels?.title ?? 'Copy annotations',
            close: params.labels?.close ?? 'Close',
            copy: params.labels?.copy ?? 'Copy annotations',
            copied: params.labels?.copied ?? 'Copied!',
            empty: params.labels?.empty ?? 'No annotations yet.',
            preview: params.labels?.preview ?? (previewLabel === 'readerCommentTemplatePreviewLabel' ? 'Preview' : previewLabel),
        };

        const layer = markTransientRoot(document.createElement('div'));
        layer.className = 'reader-comment-export-layer';

        const popover = document.createElement('div');
        popover.className = 'reader-comment-export flat-workflow';
        popover.setAttribute('data-aimd-theme', params.theme);
        popover.setAttribute('role', 'dialog');
        popover.setAttribute('aria-label', labels.title);
        popover.innerHTML = `
          <div class="reader-comment-export__head">
            <h3 class="reader-comment-export__title">${createIcon(messageSquareTextIcon).outerHTML}<span>${labels.title}</span></h3>
            <button class="icon-btn reader-comment-export__close" type="button" data-action="close" aria-label="${labels.close}">${createIcon(xIcon).outerHTML}</button>
          </div>
          <div class="reader-comment-export__body flat-workflow__body">
            <details class="reader-comment-export__preview-disclosure flat-workflow__section">
              <summary>${labels.preview}</summary>
              <pre class="reader-comment-export__preview" data-role="preview"></pre>
            </details>
          </div>
          <div class="reader-comment-export__actions">
            <button class="secondary-btn secondary-btn--primary reader-comment-export__btn" type="button" data-action="copy">${createIcon(copyIcon).outerHTML}<span data-role="copy-label">${labels.copy}</span></button>
          </div>
        `;

        layer.appendChild(popover);
        params.container.appendChild(layer);
        this.rootEl = layer;

        const preview = popover.querySelector<HTMLElement>('[data-role="preview"]')!;
        const copyButton = popover.querySelector<HTMLButtonElement>('[data-action="copy"]')!;
        const copyText = copyButton.querySelector<HTMLElement>('[data-role="copy-label"]')!;
        const closeButton = popover.querySelector<HTMLButtonElement>('[data-action="close"]')!;
        const body = popover.querySelector<HTMLElement>('.reader-comment-export__body')!;
        const selectedIds = new Set<string>();
        let annotationOptions = [...(params.annotationSelection?.options ?? [])];
        const inputs = new Map<string, HTMLInputElement>();
        let selectionList: HTMLElement | null = null;
        let selectAll: HTMLInputElement | null = null;
        let count: HTMLElement | null = null;
        let promptSelect: HTMLSelectElement | null = null;
        let promptValue = '';
        let pending: 'copy' | 'delete' | null = null;
        let contentVersion = 0;
        let copied = false;
        let currentPreview = params.preview;
        let canCopy = params.canCopy;
        const isCurrent = () => this.rootEl === layer && layer.isConnected;
        const copyLabel = () => params.annotationSelection?.copyLabel?.(selectedIds.size) ?? labels.copy;
        const deleteButton = params.onDelete ? document.createElement('button') : null;
        if (deleteButton) {
            deleteButton.type = 'button';
            deleteButton.className = 'secondary-btn secondary-btn--ghost secondary-btn--danger reader-comment-export__btn';
            deleteButton.dataset.action = 'delete';
            copyButton.before(deleteButton);
        }
        const syncControls = () => {
            copyButton.disabled = pending !== null || !canCopy || Boolean(params.annotationSelection && selectedIds.size === 0);
            if (!copied) copyText.textContent = copyLabel();
            if (deleteButton) {
                const fallback = t('btnDelete');
                deleteButton.textContent = params.annotationSelection?.deleteLabel?.(selectedIds.size)
                    ?? (fallback === 'btnDelete' ? 'Delete selected' : fallback);
                deleteButton.disabled = pending !== null || selectedIds.size === 0;
            }
            const deleting = pending === 'delete';
            closeButton.disabled = deleting;
            inputs.forEach(input => { input.disabled = deleting; });
            if (selectAll) selectAll.disabled = deleting || annotationOptions.length === 0;
            if (promptSelect) promptSelect.disabled = deleting;
            popover.setAttribute('aria-busy', pending === null ? 'false' : 'true');
        };
        const clearCopyFeedback = () => {
            contentVersion += 1;
            copied = false;
            if (this.copyFeedbackTimer !== null) window.clearTimeout(this.copyFeedbackTimer);
            this.copyFeedbackTimer = null;
            copyText.textContent = copyLabel();
        };
        const syncSelection = () => {
            if (!params.annotationSelection) return;
            inputs.forEach((input, id) => { input.checked = selectedIds.has(id); });
            if (selectAll) {
                selectAll.checked = selectedIds.size > 0 && selectedIds.size === annotationOptions.length;
                selectAll.indeterminate = selectedIds.size > 0 && selectedIds.size < annotationOptions.length;
            }
            if (count) count.textContent = params.annotationSelection.countLabel(selectedIds.size, annotationOptions.length);
            clearCopyFeedback();
            syncControls();
            params.annotationSelection.onChange(annotationOptions.filter(option => selectedIds.has(option.id)).map(option => option.id));
        };
        const refreshAnnotations = (options: AnnotationOption[]) => {
            annotationOptions = [...options];
            const availableIds = new Set(annotationOptions.map(option => option.id));
            selectedIds.forEach(id => { if (!availableIds.has(id)) selectedIds.delete(id); });
            inputs.clear();
            if (!selectionList) return;
            selectionList.replaceChildren(...annotationOptions.map(option => {
                const row = document.createElement('label');
                row.className = 'reader-comment-export__option flat-workflow__item';
                const input = document.createElement('input');
                input.type = 'checkbox';
                input.dataset.annotationId = option.id;
                const text = document.createElement('span');
                text.className = 'reader-comment-export__option-text';
                const note = document.createElement('span');
                note.className = 'reader-comment-export__note';
                note.textContent = option.comment;
                const source = document.createElement('span');
                source.className = 'reader-comment-export__source';
                source.textContent = option.source;
                text.append(note, source);
                row.append(input, text);
                inputs.set(option.id, input);
                input.addEventListener('change', () => {
                    if (pending === 'delete') {
                        input.checked = selectedIds.has(option.id);
                        return;
                    }
                    if (input.checked) selectedIds.add(option.id);
                    else selectedIds.delete(option.id);
                    syncSelection();
                });
                return row;
            }));
            syncSelection();
        };
        this.previewUpdater = (next) => {
            if (!isCurrent()) return;
            const changed = (next.preview !== undefined && currentPreview !== next.preview)
                || (next.canCopy !== undefined && canCopy !== next.canCopy);
            if (next.preview !== undefined) currentPreview = next.preview;
            if (next.canCopy !== undefined) canCopy = next.canCopy;
            preview.textContent = currentPreview || labels.empty;
            if (changed) clearCopyFeedback();
            if (next.annotations !== undefined && params.annotationSelection) refreshAnnotations(next.annotations);
            syncControls();
        };
        preview.textContent = currentPreview || labels.empty;
        if (params.annotationSelection) {
            const selection = params.annotationSelection;
            const section = document.createElement('section');
            section.className = 'reader-comment-export__selection';
            section.setAttribute('aria-label', selection.label);
            const title = document.createElement('h4');
            title.className = 'reader-comment-export__selection-title';
            title.textContent = selection.label;
            const head = document.createElement('div');
            head.className = 'reader-comment-export__selection-head';
            const selectAllLabel = document.createElement('label');
            selectAllLabel.className = 'reader-comment-export__select-all';
            selectAll = document.createElement('input');
            selectAll.type = 'checkbox';
            selectAll.dataset.role = 'select-all';
            const selectAllText = document.createElement('span');
            selectAllText.textContent = selection.selectAllLabel;
            selectAllLabel.append(selectAll, selectAllText);
            count = document.createElement('span');
            count.className = 'reader-comment-export__count';
            count.setAttribute('aria-live', 'polite');
            selectionList = document.createElement('div');
            selectionList.className = 'flat-workflow__list';
            selectAll.addEventListener('change', () => {
                if (pending === 'delete') {
                    selectAll!.checked = selectedIds.size > 0 && selectedIds.size === annotationOptions.length;
                    return;
                }
                selectedIds.clear();
                if (selectAll!.checked) annotationOptions.forEach(option => selectedIds.add(option.id));
                syncSelection();
            });
            head.append(selectAllLabel, count);
            section.append(title, head, selectionList);
            body.prepend(section);
            refreshAnnotations(annotationOptions);
        }
        if (params.promptSelection && params.promptSelection.options.length > 0) {
            const selection = params.promptSelection;
            const field = document.createElement('details');
            field.className = 'reader-comment-export__prompt-disclosure';
            const summary = document.createElement('summary');
            summary.textContent = selection.label;
            const select = document.createElement('select');
            promptSelect = select;
            select.className = 'reader-comment-export__prompt-select flat-workflow__input';
            select.dataset.role = 'prompt-select';
            select.setAttribute('aria-label', selection.label);
            const placeholder = document.createElement('option');
            placeholder.value = '';
            placeholder.selected = true;
            placeholder.textContent = selection.emptyLabel;
            select.appendChild(placeholder);
            selection.options.forEach((prompt) => {
                const option = document.createElement('option');
                option.value = prompt.id;
                option.textContent = prompt.title;
                select.appendChild(option);
            });
            select.addEventListener('change', () => {
                if (pending === 'delete') {
                    select.value = promptValue;
                    return;
                }
                promptValue = select.value;
                clearCopyFeedback();
                selection.onSelect(promptValue);
                const title = selection.options.find((option) => option.id === promptValue)?.title;
                summary.textContent = title ? `${selection.label} · ${title}` : selection.label;
            });
            field.append(summary, select);
            body.insertBefore(field, body.querySelector('.reader-comment-export__preview-disclosure'));
        }
        const close = () => {
            if (pending === 'delete') return;
            params.onClose?.();
            this.close(params.shadow);
        };
        this.dismissHandler = close;
        closeButton.addEventListener('click', close);
        popover.addEventListener('keydown', (event) => {
            if (event.key !== 'Escape') return;
            event.stopPropagation();
            if (event.isComposing) return;
            event.preventDefault();
            close();
        });
        copyButton.addEventListener('click', async () => {
            if (!isCurrent() || pending !== null || copyButton.disabled) return;
            clearCopyFeedback();
            const version = contentVersion;
            pending = 'copy';
            syncControls();
            try {
                const ok = await params.onCopy();
                if (!isCurrent() || contentVersion !== version || !ok) return;
                copied = true;
                copyText.textContent = labels.copied;
                this.copyFeedbackTimer = window.setTimeout(() => {
                    if (!isCurrent() || contentVersion !== version) return;
                    this.copyFeedbackTimer = null;
                    copied = false;
                    syncControls();
                }, 1200);
            } catch {
                // The owner reports clipboard errors; retain the user's selection for retry.
            } finally {
                if (isCurrent()) {
                    pending = null;
                    syncControls();
                }
            }
        });
        deleteButton?.addEventListener('click', async () => {
            if (!isCurrent() || pending !== null || deleteButton.disabled || !params.onDelete) return;
            const requestedIds = annotationOptions.filter(option => selectedIds.has(option.id)).map(option => option.id);
            if (requestedIds.length === 0) return;
            clearCopyFeedback();
            pending = 'delete';
            syncControls();
            let removedIds: string[] = [];
            try {
                removedIds = await params.onDelete(requestedIds);
            } catch {
                // Cancellation and failures leave the same records selected for retry.
            }
            if (!isCurrent()) return;
            const requested = new Set(requestedIds);
            const removed = new Set(removedIds.filter(id => requested.has(id)));
            pending = null;
            refreshAnnotations(annotationOptions.filter(option => !removed.has(option.id)));
            syncControls();
        });
        this.onShadowPointerDown = (event: Event) => {
            if (pending === 'delete' || this.shouldIgnorePointerDown(event)) return;
            close();
        };
        this.onDocumentPointerDown = (event: Event) => {
            if (pending === 'delete' || this.shouldIgnorePointerDown(event)) return;
            close();
        };
        params.shadow.addEventListener('pointerdown', this.onShadowPointerDown, true);
        document.addEventListener('pointerdown', this.onDocumentPointerDown, true);
        syncControls();
    }

    update(params: PreviewUpdate): void {
        this.previewUpdater?.(params);
    }

    private shouldIgnorePointerDown(event: Event): boolean {
        const path = (event.composedPath?.() ?? []) as EventTarget[];
        const root = this.rootEl?.getRootNode();
        return path.includes(this.rootEl as EventTarget)
            // The owner's confirmation can remain mounted during its close motion.
            || path.some(node => node instanceof HTMLElement
                && node.matches('.mock-modal, .mock-modal-overlay, .mock-modal-host')
                && node.getRootNode() === root);
    }
}
