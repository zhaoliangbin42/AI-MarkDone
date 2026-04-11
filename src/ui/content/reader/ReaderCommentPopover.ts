import type { Theme } from '../../../core/types/theme';
import { messageSquareTextIcon, xIcon } from '../../../assets/icons';
import { createIcon } from '../components/Icon';
import { installInputEventBoundary } from '../components/inputEventBoundary';
import { markTransientRoot } from '../components/transientUi';
import { ensureStyle } from '../../../style/shadow';

type OpenParams = {
    shadow: ShadowRoot;
    container: HTMLElement;
    theme: Theme;
    initialText?: string;
    mode: 'create' | 'edit';
    labels?: {
        addTitle?: string;
        editTitle?: string;
        close?: string;
        placeholder?: string;
        cancel?: string;
        save?: string;
    };
    onSave: (value: string) => void;
    onCancel?: () => void;
};

function getCommentPopoverCss(): string {
    return `
.reader-comment-popover-layer {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  pointer-events: none;
}

.reader-comment-popover {
  pointer-events: auto;
  width: min(440px, calc(100% - 32px));
  display: grid;
  gap: 16px;
  padding: 18px;
  border-radius: var(--aimd-radius-xl);
  border: 1px solid color-mix(in srgb, var(--aimd-border-default) 82%, transparent);
  background: color-mix(in srgb, var(--aimd-bg-primary) 96%, transparent);
  box-shadow: 0 24px 64px color-mix(in srgb, var(--aimd-overlay-bg) 22%, transparent);
}

.reader-comment-popover__head,
.reader-comment-popover__actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.reader-comment-popover__title {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  margin: 0;
  font-size: var(--aimd-text-base);
  line-height: 1.4;
  font-weight: var(--aimd-font-semibold);
  color: var(--aimd-text-primary);
}

.reader-comment-popover__title .aimd-icon {
  color: var(--aimd-interactive-primary);
}

.reader-comment-popover__close {
  width: 32px;
  height: 32px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid color-mix(in srgb, var(--aimd-border-default) 84%, transparent);
  background: color-mix(in srgb, var(--aimd-bg-secondary) 78%, transparent);
  color: var(--aimd-text-secondary);
  cursor: pointer;
}

.reader-comment-popover__close:hover {
  background: color-mix(in srgb, var(--aimd-bg-secondary) 94%, var(--aimd-interactive-hover));
  color: var(--aimd-text-primary);
}

.reader-comment-popover__input {
  width: 100%;
  min-height: 148px;
  resize: vertical;
  padding: 12px 14px;
  border-radius: var(--aimd-radius-lg);
  border: 1px solid color-mix(in srgb, var(--aimd-border-default) 82%, transparent);
  background: color-mix(in srgb, var(--aimd-bg-primary) 94%, transparent);
  color: var(--aimd-text-primary);
  font: inherit;
  line-height: 1.6;
}

.reader-comment-popover__input:focus-visible {
  outline: none;
  border-color: color-mix(in srgb, var(--aimd-interactive-primary) 58%, transparent);
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--aimd-interactive-primary) 32%, transparent);
}

.reader-comment-popover__actions {
  justify-content: flex-end;
}

.reader-comment-popover__btn {
  min-width: 96px;
  height: 38px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0 14px;
  border: 1px solid color-mix(in srgb, var(--aimd-border-default) 82%, transparent);
  background: color-mix(in srgb, var(--aimd-bg-secondary) 78%, transparent);
  color: var(--aimd-text-primary);
  font: inherit;
  cursor: pointer;
}

.reader-comment-popover__btn:hover:not(:disabled) {
  background: color-mix(in srgb, var(--aimd-bg-secondary) 92%, var(--aimd-interactive-hover));
}

.reader-comment-popover__btn--primary {
  border-color: color-mix(in srgb, var(--aimd-interactive-primary) 42%, transparent);
  background: color-mix(in srgb, var(--aimd-interactive-selected) 92%, var(--aimd-bg-primary));
  color: var(--aimd-text-primary);
}

.reader-comment-popover__btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
`;
}

export class ReaderCommentPopover {
    private rootEl: HTMLElement | null = null;
    private onShadowPointerDown: ((event: Event) => void) | null = null;
    private onDocumentPointerDown: ((event: Event) => void) | null = null;

    setTheme(theme: Theme): void {
        if (this.rootEl) this.rootEl.setAttribute('data-aimd-theme', theme);
    }

    isOpen(): boolean {
        return Boolean(this.rootEl);
    }

    open(params: OpenParams): void {
        this.close(params.shadow, false);
        ensureStyle(params.shadow, getCommentPopoverCss(), { id: 'aimd-reader-comment-popover-style', cache: 'shared' });
        const labels = {
            addTitle: params.labels?.addTitle ?? 'Add comment',
            editTitle: params.labels?.editTitle ?? 'Edit comment',
            close: params.labels?.close ?? 'Close',
            placeholder: params.labels?.placeholder ?? 'Write your comment...',
            cancel: params.labels?.cancel ?? 'Cancel',
            save: params.labels?.save ?? 'Save comment',
        };

        const layer = markTransientRoot(document.createElement('div'));
        layer.className = 'reader-comment-popover-layer';

        const popover = document.createElement('div');
        popover.className = 'reader-comment-popover';
        popover.setAttribute('data-aimd-theme', params.theme);
        popover.innerHTML = `
          <div class="reader-comment-popover__head">
            <h3 class="reader-comment-popover__title">${createIcon(messageSquareTextIcon).outerHTML}<span>${params.mode === 'edit' ? labels.editTitle : labels.addTitle}</span></h3>
            <button class="reader-comment-popover__close" type="button" data-action="close" aria-label="${labels.close}">${createIcon(xIcon).outerHTML}</button>
          </div>
          <textarea class="reader-comment-popover__input" data-role="input" placeholder="${labels.placeholder}"></textarea>
          <div class="reader-comment-popover__actions">
            <button class="reader-comment-popover__btn" type="button" data-action="cancel">${labels.cancel}</button>
            <button class="reader-comment-popover__btn reader-comment-popover__btn--primary" type="button" data-action="save">${labels.save}</button>
          </div>
        `;

        layer.appendChild(popover);
        params.container.appendChild(layer);
        this.rootEl = layer;
        this.setTheme(params.theme);

        const textarea = popover.querySelector<HTMLTextAreaElement>('[data-role="input"]');
        if (textarea) {
            textarea.value = params.initialText ?? '';
            installInputEventBoundary(textarea);
            setTimeout(() => textarea.focus(), 0);
        }

        const syncSaveState = () => {
            const save = popover.querySelector<HTMLButtonElement>('[data-action="save"]');
            if (save) save.disabled = !(textarea?.value.trim());
        };

        textarea?.addEventListener('input', syncSaveState);
        syncSaveState();

        popover.querySelector<HTMLButtonElement>('[data-action="close"]')?.addEventListener('click', () => {
            params.onCancel?.();
            this.close(params.shadow, false);
        });

        popover.querySelector<HTMLButtonElement>('[data-action="cancel"]')?.addEventListener('click', () => {
            params.onCancel?.();
            this.close(params.shadow, false);
        });

        popover.querySelector<HTMLButtonElement>('[data-action="save"]')?.addEventListener('click', () => {
            const value = textarea?.value.trim() ?? '';
            if (!value) return;
            params.onSave(value);
            this.close(params.shadow, false);
        });

        popover.addEventListener('keydown', (event) => {
            if (event.key === 'Escape') {
                event.preventDefault();
                event.stopPropagation();
                params.onCancel?.();
                this.close(params.shadow, false);
            }
        });

        this.onShadowPointerDown = (event: Event) => {
            if (this.shouldIgnorePointerDown(event)) return;
            params.onCancel?.();
            this.close(params.shadow, false);
        };
        this.onDocumentPointerDown = (event: Event) => {
            if (this.shouldIgnorePointerDown(event)) return;
            params.onCancel?.();
            this.close(params.shadow, false);
        };

        params.shadow.addEventListener('pointerdown', this.onShadowPointerDown, true);
        document.addEventListener('pointerdown', this.onDocumentPointerDown, true);
    }

    close(shadow: ShadowRoot, callCancel: boolean): void {
        if (!this.rootEl) return;
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
        void callCancel;
    }

    private shouldIgnorePointerDown(event: Event): boolean {
        const path = (event.composedPath?.() ?? []) as EventTarget[];
        return path.includes(this.rootEl as EventTarget);
    }
}
