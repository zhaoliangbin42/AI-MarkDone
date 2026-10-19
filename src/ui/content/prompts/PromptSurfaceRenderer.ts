import { promptIcon } from '../../../assets/workspaceIcons';
import type { PromptRecord } from '../../../core/prompts/promptLibrary';
import { checkIcon, chevronDownIcon, plusIcon, trashIcon, xIcon } from '../../../assets/icons';
import { installInputEventBoundary } from '../components/inputEventBoundary';
import { t } from '../components/i18n';
import { renderComposerSuggestionList } from '../components/ComposerSuggestionList';
import type { PromptDataState, PromptEditorDraft, PromptWorkflowMode } from './PromptWorkflow';

export type PromptSurfaceView = {
    mode: Exclude<PromptWorkflowMode, null>;
    prompts: readonly PromptRecord[];
    suggestions: readonly PromptRecord[];
    selectedIndex: number;
    managerQuery: string;
    editPrompt: PromptRecord | null;
    statusMessage: string;
    dataState?: PromptDataState;
    manualAutocomplete?: boolean;
};

export type PromptSurfaceAction =
    | { type: 'close' }
    | { type: 'open-library' }
    | { type: 'search'; query: string }
    | { type: 'add' }
    | { type: 'edit'; promptId: string }
    | { type: 'toggle'; promptId: string; enabled: boolean }
    | { type: 'delete'; promptId: string }
    | { type: 'cancel-edit' }
    | { type: 'save'; draft: PromptEditorDraft }
    | { type: 'retry-load' }
    | { type: 'select'; index: number }
    | { type: 'hover'; index: number }
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

    syncAutocompleteSelection(selectedIndex: number, ensureVisible = false): void {
        let selected: HTMLButtonElement | null = null;
        this.root.querySelectorAll<HTMLButtonElement>('[data-role="prompt-suggestion"]').forEach((row) => {
            const active = Number(row.dataset.index) === selectedIndex;
            row.classList.toggle('is-active', active);
            row.setAttribute('aria-selected', active ? 'true' : 'false');
            if (active) selected = row;
        });
        const list = this.root.querySelector<HTMLElement>('.prompt-list');
        if (!ensureVisible || !selected || !list || list.clientHeight <= 0) return;
        const bounds = list.getBoundingClientRect();
        const rowBounds = (selected as HTMLElement).getBoundingClientRect();
        // Scroll this list explicitly: scrollIntoView can also move ChatGPT or
        // the Reader beneath an anchored candidate surface.
        const visibleTop = bounds.top + list.clientTop;
        const visibleBottom = visibleTop + list.clientHeight;
        const oversized = rowBounds.bottom - rowBounds.top > list.clientHeight;
        const adjustment = oversized || rowBounds.top < visibleTop ? rowBounds.top - visibleTop
            : rowBounds.bottom > visibleBottom ? rowBounds.bottom - visibleBottom : 0;
        // A row taller than the viewport cannot fit both edges. Anchor its top
        // once, leaving the rest available to normal internal scrolling.
        if (Math.abs(adjustment) > 0.5) list.scrollTop = Math.max(0, Math.min(list.scrollHeight - list.clientHeight, list.scrollTop + adjustment));
    }

    destroy(): void {
        this.root.removeEventListener('click', this.onClick);
        this.root.removeEventListener('input', this.onInputCapture, { capture: true } as any);
        this.root.removeEventListener('change', this.onChangeCapture, { capture: true } as any);
        this.root.removeEventListener('pointerdown', this.onPointerDown);
    }

    private renderAutocomplete(view: PromptSurfaceView): void {
        this.root.className = 'prompt-popover prompt-popover--autocomplete aimd-material-surface flat-workflow';
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
            rowClassName: 'prompt-row aimd-material-choice',
            mainClassName: 'prompt-row__main',
            titleClassName: 'prompt-row__title',
            contentClassName: 'prompt-row__content',
            trailingClassName: 'prompt-row__trigger',
            onHover: (index) => this.options.onAction({ type: 'hover', index }),
            onSelect: (index) => this.options.onAction({ type: 'select', index }),
        });
        list.classList.add('prompt-list');
        if (view.manualAutocomplete && view.suggestions.length < 1) {
            const empty = document.createElement('div');
            empty.className = 'prompt-candidate-empty';
            empty.setAttribute('role', 'status');
            empty.setAttribute('aria-live', 'polite');
            const message = document.createElement('p');
            message.textContent = t(view.dataState === 'error' ? 'promptAutocompleteLoadFailed'
                : view.prompts.some(prompt => prompt.enabled) ? 'promptAutocompleteNoMatches' : 'promptAutocompleteEmptyLibrary');
            const open = document.createElement('button');
            open.type = 'button';
            open.className = 'secondary-btn aimd-material-button aimd-material-button--quiet';
            open.dataset.action = 'open-prompt-library';
            open.textContent = t('promptAutocompleteOpenLibrary');
            empty.append(message, open);
            list.append(empty);
        }
        const hint = document.createElement('p');
        hint.className = 'prompt-autocomplete-hint aimd-material-chrome';
        hint.dataset.role = 'prompt-autocomplete-hint';
        const hintKey = view.manualAutocomplete ? 'promptManualAutocompleteHint' : 'promptAutocompleteKeyboardHint';
        const localizedHint = t(hintKey);
        hint.textContent = localizedHint === hintKey
            ? view.manualAutocomplete
                ? 'Type a title or trigger to filter; ↑ ↓ select, Enter/Tab insert, Esc close.'
                : String.raw`Type \ + a trigger; ↑ ↓ select, Enter/Tab insert, → insert Prompt + current annotations when available, Esc close.`
            : localizedHint;
        this.root.appendChild(hint);
    }

    private renderManager(view: PromptSurfaceView): void {
        const expandedPromptIds = new Set(Array.from(
            this.root.querySelectorAll<HTMLDetailsElement>('.manager-row__options[open]'),
        ).map((details) => details.dataset.promptId));
        const rows = view.prompts.map((prompt) => {
            const body = `<button class="manager-row__main aimd-material-choice" type="button" data-action="edit-prompt" data-prompt-id="${escapeHtml(prompt.id)}">
                <span class="manager-row__heading">
                  <span class="manager-row__title">${escapeHtml(prompt.title)}</span>
                  ${prompt.enabled ? '' : `<span class="manager-row__state">${escapeHtml(t('promptDisabled'))}</span>`}
                </span>
                <span class="manager-row__content">${escapeHtml(prompt.content.replace('{{cursor}}', '').trim())}</span>
              </button>`;
            return `
            <div class="manager-row" data-prompt-id="${escapeHtml(prompt.id)}">
              ${body}
              <details class="manager-row__options" data-prompt-id="${escapeHtml(prompt.id)}" ${expandedPromptIds.has(prompt.id) ? 'open' : ''}>
                <summary class="prompt-options-summary manager-row__summary" data-role="prompt-actions" data-prompt-id="${escapeHtml(prompt.id)}" aria-label="${escapeHtml(`${t('promptActionsLabel')}: ${prompt.title}`)}"><span>${escapeHtml(t('promptActionsLabel'))}</span>${chevronDownIcon}</summary>
                <div class="manager-row__actions">
                  <label class="prompt-enabled-toggle">
                    <input class="aimd-material-check" type="checkbox" aria-label="${escapeHtml(`${t('promptEnabledLabel')}: ${prompt.title}`)}" data-action="toggle-prompt-enabled" data-prompt-id="${escapeHtml(prompt.id)}" ${prompt.enabled ? 'checked' : ''} />
                    <span>${escapeHtml(t('promptEnabledLabel'))}</span>
                  </label>
                  <button class="secondary-btn aimd-material-button aimd-material-button--quiet aimd-material-button--danger" type="button" data-action="delete-prompt" data-prompt-id="${escapeHtml(prompt.id)}">${trashIcon}<span>${escapeHtml(t('promptDelete'))}</span></button>
                </div>
              </details>
            </div>`;
        }).join('');
        const loadFailed = view.dataState === 'error';
        const status = view.statusMessage
            ? `<div class="prompt-status${loadFailed ? ' prompt-status--error' : ''}" role="status" aria-live="polite">
                <span>${escapeHtml(view.statusMessage)}</span>
                ${loadFailed ? `<button class="secondary-btn" type="button" data-action="retry-prompts">${escapeHtml(t('retryAction'))}</button>` : ''}
              </div>`
            : '';
        this.root.className = 'prompt-popover prompt-popover--manager aimd-material-surface flat-workflow';
        this.root.innerHTML = `
          <div class="prompt-header aimd-material-chrome">
            <div class="prompt-header__title">${promptIcon}<span>${escapeHtml(t('promptManagerTitle'))}</span></div>
            <button class="icon-btn aimd-material-button aimd-material-button--quiet" type="button" data-action="close-prompts" aria-label="${escapeHtml(t('btnClose'))}">${xIcon}</button>
          </div>
          <div class="prompt-toolbar flat-workflow__toolbar">
            <input class="prompt-search aimd-material-field" data-role="prompt-search" type="search" aria-label="${escapeHtml(t('promptSearchPlaceholder'))}" placeholder="${escapeHtml(t('promptSearchPlaceholder'))}" value="${escapeHtml(view.managerQuery)}" />
            <button class="primary-btn aimd-material-button aimd-material-button--primary" type="button" data-action="add-prompt" aria-label="${escapeHtml(t('promptAdd'))}">${plusIcon}<span>${escapeHtml(t('promptAdd'))}</span></button>
          </div>
          <div class="prompt-manager-body flat-workflow__body">${status}
            <div class="manager-list flat-workflow__list">${rows || (loadFailed ? '' : `<div class="prompt-empty">${escapeHtml(t('promptNoPrompts'))}</div>`)}</div>
          </div>`;
        this.installInputBoundaries();
    }

    private renderEditor(view: PromptSurfaceView): void {
        const prompt = view.editPrompt;
        if (!prompt) return;
        const openingEditor = !this.root.classList.contains('prompt-popover--editor');
        const optionalSettingsOpen = this.root.querySelector<HTMLDetailsElement>('[data-role="prompt-optional-settings"]')?.open ?? false;
        this.root.className = 'prompt-popover prompt-popover--editor aimd-material-surface flat-workflow';
        this.root.innerHTML = `
          <div class="prompt-header aimd-material-chrome">
            <div class="prompt-header__title">${promptIcon}<span>${escapeHtml(prompt.content ? t('promptEdit') : t('promptAdd'))}</span></div>
            <button class="icon-btn aimd-material-button aimd-material-button--quiet" type="button" data-action="cancel-edit" aria-label="${escapeHtml(t('btnBack'))}">${xIcon}</button>
          </div>
          <div class="prompt-editor-body flat-workflow__body">
            <label class="field"><span>${escapeHtml(t('promptTitleLabel'))}</span><input class="aimd-material-field" data-role="prompt-title" type="text" value="${escapeHtml(prompt.title)}" /></label>
            <label class="field field--content"><span>${escapeHtml(t('promptContentLabel'))}</span><textarea class="aimd-material-field" data-role="prompt-content" rows="7">${escapeHtml(prompt.content)}</textarea></label>
            <details class="prompt-editor-options" data-role="prompt-optional-settings" ${optionalSettingsOpen ? 'open' : ''}>
              <summary class="prompt-options-summary" data-role="prompt-optional-summary"><span>${escapeHtml(t('promptOptionalSettings'))}</span><span class="prompt-trigger-summary" data-role="prompt-trigger-summary" ${prompt.triggerText.trim() ? '' : 'hidden'}>${escapeHtml(prompt.triggerText)}</span>${chevronDownIcon}</summary>
              <div class="prompt-editor-options__body">
                <label class="field"><span>${escapeHtml(t('promptTriggerLabel'))}</span><input class="aimd-material-field" data-role="prompt-trigger" type="text" value="${escapeHtml(prompt.triggerText)}" placeholder="translate" /></label>
                <p class="flat-workflow__description">${escapeHtml(t('promptTriggerHelp'))}</p>
                <div class="placeholder-row">
                  <button class="secondary-btn aimd-material-button aimd-material-button--quiet" type="button" data-action="insert-cursor-placeholder">${escapeHtml(t('promptInsertCursorPlaceholder'))}</button>
                </div>
              </div>
            </details>
            ${view.statusMessage ? `<div class="prompt-status">${escapeHtml(view.statusMessage)}</div>` : ''}
          </div>
          <div class="prompt-footer aimd-material-chrome flat-workflow__actions">
            <button class="secondary-btn" type="button" data-action="cancel-edit">${escapeHtml(t('btnCancel'))}</button>
            <button class="primary-btn" type="button" data-action="save-prompt" aria-label="${escapeHtml(t('btnSave'))}">${checkIcon}<span>${escapeHtml(t('btnSave'))}</span></button>
          </div>`;
        this.installInputBoundaries();
        this.syncCursorPlaceholderButtonState();
        if (openingEditor) this.root.querySelector<HTMLTextAreaElement>('[data-role="prompt-content"]')?.focus({ preventScroll: true });
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
        else if (action === 'open-prompt-library') this.options.onAction({ type: 'open-library' });
        else if (action === 'add-prompt') this.options.onAction({ type: 'add' });
        else if (action === 'edit-prompt' && promptId) this.options.onAction({ type: 'edit', promptId });
        else if (action === 'delete-prompt' && promptId) this.options.onAction({ type: 'delete', promptId });
        else if (action === 'retry-prompts') this.options.onAction({ type: 'retry-load' });
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
        if (input instanceof HTMLInputElement && input.dataset.role === 'prompt-trigger') {
            const summary = this.root.querySelector<HTMLElement>('[data-role="prompt-trigger-summary"]');
            if (summary) {
                summary.textContent = input.value.trim();
                summary.hidden = !input.value.trim();
            }
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
        if (target?.closest('.prompt-header')) {
            this.options.onAction({ type: 'panel-drag-start', event });
        }
    };
}
