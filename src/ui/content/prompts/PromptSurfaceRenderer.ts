import type { PromptRecord } from '../../../core/prompts/promptLibrary';
import { checkIcon, gripHorizontalIcon, messageSquareTextIcon, pencilIcon, plusIcon, trashIcon, xIcon } from '../../../assets/icons';
import { installInputEventBoundary } from '../components/inputEventBoundary';
import { t } from '../components/i18n';
import { renderComposerSuggestionList } from '../components/ComposerSuggestionList';
import type { PromptEditorDraft, PromptWorkflowMode } from './PromptWorkflow';

export type PromptSurfaceView = {
    mode: Exclude<PromptWorkflowMode, null>;
    prompts: readonly PromptRecord[];
    suggestions: readonly PromptRecord[];
    selectedIndex: number;
    managerQuery: string;
    editPrompt: PromptRecord | null;
    statusMessage: string;
};

export type PromptSurfaceAction =
    | { type: 'close' }
    | { type: 'search'; query: string }
    | { type: 'add' }
    | { type: 'edit'; promptId: string }
    | { type: 'toggle'; promptId: string; enabled: boolean }
    | { type: 'delete'; promptId: string }
    | { type: 'cancel-edit' }
    | { type: 'save'; draft: PromptEditorDraft }
    | { type: 'select'; index: number }
    | { type: 'hover'; index: number }
    | { type: 'reorder-start'; promptId: string; event: PointerEvent }
    | { type: 'panel-drag-start'; event: PointerEvent };

function escapeHtml(value: string): string {
    return value.replace(/[&<>"']/g, (char) => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[char] ?? char));
}

/**
 * Rendering implementation for every Prompt Surface mode. It owns DOM shape,
 * localization, focus-preserving rerenders, editor mechanics, and delegated
 * UI events while exposing semantic actions to the controller.
 */
export class PromptSurfaceRenderer {
    constructor(
        readonly root: HTMLElement,
        private readonly options: { onAction: (action: PromptSurfaceAction) => void },
    ) {
        root.addEventListener('click', this.onClick);
        root.addEventListener('input', this.onInputCapture, { capture: true });
        root.addEventListener('change', this.onChangeCapture, { capture: true });
        root.addEventListener('pointerdown', this.onPointerDown);
    }

    render(view: PromptSurfaceView): void {
        if (view.mode === 'autocomplete') {
            this.renderAutocomplete(view);
        } else if (view.mode === 'edit') {
            this.renderEditor(view);
        } else {
            this.renderManager(view);
        }
    }

    renderPreservingFocus(view: PromptSurfaceView): void {
        const active = this.root.getRootNode() instanceof ShadowRoot
            ? (this.root.getRootNode() as ShadowRoot).activeElement
            : document.activeElement;
        const activeControl = active instanceof HTMLElement ? active : null;
        const role = activeControl?.dataset.role ?? '';
        const action = activeControl?.dataset.action ?? '';
        const promptId = activeControl?.dataset.promptId ?? '';
        const matchingBefore = activeControl
            ? this.findMatchingControls(role, action, promptId)
            : [];
        const activeIndex = activeControl ? matchingBefore.indexOf(activeControl) : -1;
        const selection = activeControl instanceof HTMLInputElement || activeControl instanceof HTMLTextAreaElement
            ? { start: activeControl.selectionStart, end: activeControl.selectionEnd }
            : null;

        this.render(view);
        if (!activeControl || (!role && !action)) return;
        const matchingAfter = this.findMatchingControls(role, action, promptId);
        const next = matchingAfter[Math.max(0, activeIndex)] ?? matchingAfter[0];
        next?.focus({ preventScroll: true });
        if (
            selection
            && (next instanceof HTMLInputElement || next instanceof HTMLTextAreaElement)
            && selection.start != null
            && selection.end != null
        ) {
            next.setSelectionRange(selection.start, selection.end);
        }
    }

    focusSearch(): void {
        this.root.querySelector<HTMLInputElement>('[data-role="prompt-search"]')?.focus();
    }

    syncAutocompleteSelection(selectedIndex: number): void {
        this.root.querySelectorAll<HTMLButtonElement>('[data-role="prompt-suggestion"]').forEach((row) => {
            const active = Number(row.dataset.index) === selectedIndex;
            row.classList.toggle('is-active', active);
            row.setAttribute('aria-selected', active ? 'true' : 'false');
        });
    }

    getManagerRowIdAt(clientY: number): string | null {
        const row = Array.from(this.root.querySelectorAll<HTMLElement>('.manager-row')).find((candidate) => {
            const rect = candidate.getBoundingClientRect();
            return clientY >= rect.top && clientY <= rect.bottom;
        });
        return row?.dataset.promptId ?? null;
    }

    setPromptDragging(id: string, dragging: boolean): void {
        const row = Array.from(this.root.querySelectorAll<HTMLElement>('.manager-row'))
            .find((candidate) => candidate.dataset.promptId === id);
        if (!row) return;
        if (dragging) row.dataset.dragging = '1';
        else delete row.dataset.dragging;
    }

    destroy(): void {
        this.root.removeEventListener('click', this.onClick);
        this.root.removeEventListener('input', this.onInputCapture, { capture: true } as any);
        this.root.removeEventListener('change', this.onChangeCapture, { capture: true } as any);
        this.root.removeEventListener('pointerdown', this.onPointerDown);
    }

    private renderAutocomplete(view: PromptSurfaceView): void {
        this.root.className = 'prompt-popover prompt-popover--autocomplete';
        this.root.replaceChildren();
        const list = renderComposerSuggestionList({
            root: this.root,
            items: view.suggestions.map((prompt) => ({
                title: prompt.title,
                content: prompt.content.replace('{{cursor}}', '').trim(),
                trailing: prompt.triggerText,
            })),
            selectedIndex: view.selectedIndex,
            role: 'prompt-suggestion',
            rowClassName: 'prompt-row',
            mainClassName: 'prompt-row__main',
            titleClassName: 'prompt-row__title',
            contentClassName: 'prompt-row__content',
            trailingClassName: 'prompt-row__trigger',
            onHover: (index) => this.options.onAction({ type: 'hover', index }),
            onSelect: (index) => this.options.onAction({ type: 'select', index }),
        });
        list.classList.add('prompt-list');
    }

    private renderManager(view: PromptSurfaceView): void {
        const rows = view.prompts.map((prompt) => {
            const body = `<button class="manager-row__main" type="button" data-action="edit-prompt" data-prompt-id="${escapeHtml(prompt.id)}">
                <span class="manager-row__title">${escapeHtml(prompt.title)}</span>
                <span class="manager-row__meta">${escapeHtml(prompt.triggerText)}</span>
                <span class="manager-row__content">${escapeHtml(prompt.content.replace('{{cursor}}', '').trim())}</span>
              </button>`;
            return `
            <div class="manager-row" data-prompt-id="${escapeHtml(prompt.id)}">
              <button class="icon-btn prompt-drag-handle" type="button" data-action="reorder-prompt" data-prompt-id="${escapeHtml(prompt.id)}" aria-label="${escapeHtml(t('readerStickyDrag'))}" title="${escapeHtml(t('readerStickyDrag'))}">${gripHorizontalIcon}</button>
              ${body}
              <label class="prompt-enabled-toggle">
                <span>${escapeHtml(t('promptEnabledLabel'))}</span>
                <input type="checkbox" data-action="toggle-prompt-enabled" data-prompt-id="${escapeHtml(prompt.id)}" ${prompt.enabled ? 'checked' : ''} />
              </label>
              <button class="icon-btn" type="button" data-action="edit-prompt" data-prompt-id="${escapeHtml(prompt.id)}" aria-label="${escapeHtml(t('promptEdit'))}">${pencilIcon}</button>
              <button class="icon-btn icon-btn--danger" type="button" data-action="delete-prompt" data-prompt-id="${escapeHtml(prompt.id)}" aria-label="${escapeHtml(t('promptDelete'))}">${trashIcon}</button>
            </div>`;
        }).join('');
        this.root.className = 'prompt-popover prompt-popover--manager';
        this.root.innerHTML = `
          <div class="prompt-header">
            <div class="prompt-header__title">${messageSquareTextIcon}<span>${escapeHtml(t('promptManagerTitle'))}</span></div>
            <button class="icon-btn" type="button" data-action="close-prompts" aria-label="${escapeHtml(t('btnClose'))}">${xIcon}</button>
          </div>
          <div class="prompt-toolbar">
            <input class="prompt-search" data-role="prompt-search" type="search" placeholder="${escapeHtml(t('promptSearchPlaceholder'))}" value="${escapeHtml(view.managerQuery)}" />
            <button class="primary-btn" type="button" data-action="add-prompt">${plusIcon}<span>${escapeHtml(t('promptAdd'))}</span></button>
          </div>
          ${view.statusMessage ? `<div class="prompt-status">${escapeHtml(view.statusMessage)}</div>` : ''}
          <div class="manager-list">${rows || `<div class="prompt-empty">${escapeHtml(t('promptNoPrompts'))}</div>`}</div>`;
        this.installInputBoundaries();
    }

    private renderEditor(view: PromptSurfaceView): void {
        const prompt = view.editPrompt;
        if (!prompt) return;
        this.root.className = 'prompt-popover prompt-popover--editor';
        this.root.innerHTML = `
          <div class="prompt-header">
            <div class="prompt-header__title">${messageSquareTextIcon}<span>${escapeHtml(prompt.content ? t('promptEdit') : t('promptAdd'))}</span></div>
            <button class="icon-btn" type="button" data-action="cancel-edit" aria-label="${escapeHtml(t('btnBack'))}">${xIcon}</button>
          </div>
          <div class="prompt-editor-body">
            <label class="field"><span>${escapeHtml(t('promptTitleLabel'))}</span><input data-role="prompt-title" type="text" value="${escapeHtml(prompt.title)}" /></label>
            <label class="field"><span>${escapeHtml(t('promptTriggerLabel'))}</span><input data-role="prompt-trigger" type="text" value="${escapeHtml(prompt.triggerText)}" placeholder="translate" /></label>
            <label class="field"><span>${escapeHtml(t('promptContentLabel'))}</span><textarea data-role="prompt-content" rows="7">${escapeHtml(prompt.content)}</textarea></label>
            <div class="placeholder-row">
              <button class="secondary-btn" type="button" data-action="insert-cursor-placeholder">${escapeHtml(t('promptInsertCursorPlaceholder'))}</button>
            </div>
            ${view.statusMessage ? `<div class="prompt-status">${escapeHtml(view.statusMessage)}</div>` : ''}
          </div>
          <div class="prompt-footer">
            <button class="secondary-btn" type="button" data-action="cancel-edit">${escapeHtml(t('btnCancel'))}</button>
            <button class="primary-btn" type="button" data-action="save-prompt">${checkIcon}<span>${escapeHtml(t('btnSave'))}</span></button>
          </div>`;
        this.installInputBoundaries();
        this.syncCursorPlaceholderButtonState();
    }

    private installInputBoundaries(): void {
        this.root.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>('input, textarea')
            .forEach((input) => installInputEventBoundary(input));
    }

    private readEditorDraft(): PromptEditorDraft {
        return {
            title: this.root.querySelector<HTMLInputElement>('[data-role="prompt-title"]')?.value ?? '',
            triggerText: this.root.querySelector<HTMLInputElement>('[data-role="prompt-trigger"]')?.value ?? '',
            content: this.root.querySelector<HTMLTextAreaElement>('[data-role="prompt-content"]')?.value ?? '',
        };
    }

    private insertCursorPlaceholder(): void {
        const textarea = this.root.querySelector<HTMLTextAreaElement>('[data-role="prompt-content"]');
        if (!textarea) return;
        const marker = '{{cursor}}';
        if (textarea.value.includes(marker)) {
            this.syncCursorPlaceholderButtonState();
            return;
        }
        const start = textarea.selectionStart ?? textarea.value.length;
        const end = textarea.selectionEnd ?? start;
        textarea.value = `${textarea.value.slice(0, start)}${marker}${textarea.value.slice(end)}`;
        const nextCursor = start + marker.length;
        textarea.setSelectionRange(nextCursor, nextCursor);
        textarea.focus();
        this.syncCursorPlaceholderButtonState();
    }

    private syncCursorPlaceholderButtonState(): void {
        const textarea = this.root.querySelector<HTMLTextAreaElement>('[data-role="prompt-content"]');
        const button = this.root.querySelector<HTMLButtonElement>('[data-action="insert-cursor-placeholder"]');
        if (!textarea || !button) return;
        button.disabled = textarea.value.includes('{{cursor}}');
    }

    private findMatchingControls(role: string, action: string, promptId: string): HTMLElement[] {
        return Array.from(this.root.querySelectorAll<HTMLElement>('[data-role], [data-action]')).filter((candidate) => (
            (!role || candidate.dataset.role === role)
            && (!action || candidate.dataset.action === action)
            && (!promptId || candidate.dataset.promptId === promptId)
        ));
    }

    private onClick = (event: Event): void => {
        const target = event.target instanceof Element ? event.target : null;
        const actionElement = target?.closest<HTMLElement>('[data-action]');
        const action = actionElement?.dataset.action;
        if (!action) return;
        const promptId = actionElement.dataset.promptId ?? '';
        if (action === 'close-prompts') this.options.onAction({ type: 'close' });
        else if (action === 'add-prompt') this.options.onAction({ type: 'add' });
        else if (action === 'edit-prompt' && promptId) this.options.onAction({ type: 'edit', promptId });
        else if (action === 'delete-prompt' && promptId) this.options.onAction({ type: 'delete', promptId });
        else if (action === 'cancel-edit') this.options.onAction({ type: 'cancel-edit' });
        else if (action === 'save-prompt') this.options.onAction({ type: 'save', draft: this.readEditorDraft() });
        else if (action === 'insert-cursor-placeholder') this.insertCursorPlaceholder();
    };

    private onInputCapture = (event: Event): void => {
        const input = event.target;
        if (input instanceof HTMLInputElement && input.dataset.role === 'prompt-search') {
            this.options.onAction({ type: 'search', query: input.value });
            return;
        }
        if (input instanceof HTMLTextAreaElement && input.dataset.role === 'prompt-content') {
            this.syncCursorPlaceholderButtonState();
        }
    };

    private onChangeCapture = (event: Event): void => {
        const input = event.target;
        if (!(input instanceof HTMLInputElement) || input.dataset.action !== 'toggle-prompt-enabled') return;
        const promptId = input.dataset.promptId ?? '';
        if (promptId) this.options.onAction({ type: 'toggle', promptId, enabled: input.checked });
    };

    private onPointerDown = (event: PointerEvent): void => {
        const target = event.target instanceof Element ? event.target : null;
        const reorder = target?.closest<HTMLElement>('[data-action="reorder-prompt"]');
        if (reorder?.dataset.promptId) {
            this.options.onAction({ type: 'reorder-start', promptId: reorder.dataset.promptId, event });
            return;
        }
        if (target?.closest('.prompt-header')) {
            this.options.onAction({ type: 'panel-drag-start', event });
        }
    };
}
