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
    selectedSource: string;
    anchorRect: {
        left: number;
        top: number;
        width: number;
        height: number;
        right: number;
        bottom: number;
    };
    initialText?: string;
    mode: 'create' | 'edit';
    labels?: {
        addTitle?: string;
        editTitle?: string;
        close?: string;
        selectedSource?: string;
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
  pointer-events: none;
}

.reader-comment-popover {
  --_reader-comment-arrow-size: var(--aimd-space-3);
  pointer-events: auto;
  position: absolute;
  width: min(380px, calc(100% - (var(--aimd-space-5) * 2)));
  display: grid;
  gap: var(--aimd-space-3);
  padding: var(--aimd-space-3);
  border-radius: var(--aimd-radius-2xl);
  border: 1px solid color-mix(in srgb, var(--aimd-border-default) 80%, transparent);
  background: color-mix(in srgb, var(--aimd-bg-surface) 98%, var(--aimd-bg-primary));
  box-shadow: var(--aimd-shadow-lg);
  color: var(--aimd-text-primary);
  z-index: var(--aimd-z-tooltip);
}

.reader-comment-popover::after {
  content: '';
  position: absolute;
  left: var(--_reader-comment-arrow-left, 50%);
  width: var(--_reader-comment-arrow-size);
  height: var(--_reader-comment-arrow-size);
  background: inherit;
  transform: translateX(-50%) rotate(45deg);
}

.reader-comment-popover[data-side="top"]::after {
  bottom: calc(var(--_reader-comment-arrow-size) * -0.5);
  border-right: 1px solid color-mix(in srgb, var(--aimd-border-default) 80%, transparent);
  border-bottom: 1px solid color-mix(in srgb, var(--aimd-border-default) 80%, transparent);
}

.reader-comment-popover[data-side="bottom"]::after {
  top: calc(var(--_reader-comment-arrow-size) * -0.5);
  border-left: 1px solid color-mix(in srgb, var(--aimd-border-default) 80%, transparent);
  border-top: 1px solid color-mix(in srgb, var(--aimd-border-default) 80%, transparent);
}

.reader-comment-popover__head,
.reader-comment-popover__actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--aimd-space-3);
}

.reader-comment-popover__title {
  display: inline-flex;
  align-items: center;
  gap: var(--aimd-space-2);
  margin: 0;
  font-size: var(--aimd-text-sm);
  line-height: 1.4;
  font-weight: var(--aimd-font-medium);
  color: var(--aimd-text-primary);
}

.reader-comment-popover__title .aimd-icon {
  color: var(--aimd-interactive-primary);
}

.reader-comment-popover__close {
  color: var(--aimd-text-secondary);
}

.reader-comment-popover__selection {
  display: grid;
  gap: var(--aimd-space-2);
}

.reader-comment-popover__selection-label {
  font-size: var(--aimd-text-xs);
  line-height: 1.2;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--aimd-text-secondary);
}

.reader-comment-popover__selection-value {
  margin: 0;
  padding: var(--aimd-space-3);
  border-radius: var(--aimd-radius-xl);
  border: 1px solid color-mix(in srgb, var(--aimd-border-default) 82%, transparent);
  background: color-mix(in srgb, var(--aimd-bg-primary) 94%, transparent);
  color: var(--aimd-text-primary);
  font-size: var(--aimd-text-sm);
  line-height: 1.55;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  min-height: 88px;
  max-height: 88px;
  overflow: auto;
}

.reader-comment-popover__input {
  width: 100%;
  min-height: 116px;
  resize: vertical;
  padding: var(--aimd-space-3);
  border-radius: var(--aimd-radius-xl);
  border: 1px solid color-mix(in srgb, var(--aimd-border-default) 82%, transparent);
  background: color-mix(in srgb, var(--aimd-bg-primary) 94%, transparent);
  color: var(--aimd-text-primary);
  font: inherit;
  font-size: var(--aimd-text-sm);
  line-height: 1.55;
  box-shadow: inset 0 1px 0 color-mix(in srgb, var(--aimd-bg-primary) 72%, transparent);
}

.reader-comment-popover__input:focus-visible {
  outline: none;
  border-color: color-mix(in srgb, var(--aimd-interactive-primary) 58%, transparent);
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--aimd-interactive-primary) 32%, transparent);
}

.reader-comment-popover__actions {
  justify-content: flex-end;
  gap: var(--aimd-space-2);
}

.reader-comment-popover__btn {
  min-width: 88px;
  padding-inline: var(--aimd-space-4);
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
    private composing = false;

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
            selectedSource: params.labels?.selectedSource ?? 'Selected content',
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
            <button class="icon-btn reader-comment-popover__close" type="button" data-action="close" aria-label="${labels.close}">${createIcon(xIcon).outerHTML}</button>
          </div>
          <div class="reader-comment-popover__selection">
            <div class="reader-comment-popover__selection-label">${labels.selectedSource}</div>
            <pre class="reader-comment-popover__selection-value" data-role="selected-source"></pre>
          </div>
          <textarea class="reader-comment-popover__input" data-role="input" placeholder="${labels.placeholder}"></textarea>
          <div class="reader-comment-popover__actions">
            <button class="secondary-btn reader-comment-popover__btn" type="button" data-action="cancel">${labels.cancel}</button>
            <button class="secondary-btn secondary-btn--primary reader-comment-popover__btn" type="button" data-action="save">${labels.save}</button>
          </div>
        `;

        layer.appendChild(popover);
        params.container.appendChild(layer);
        this.rootEl = layer;
        this.setTheme(params.theme);
        this.positionPopover(popover, params.container, params.anchorRect);

        const textarea = popover.querySelector<HTMLTextAreaElement>('[data-role="input"]');
        const selectedSource = popover.querySelector<HTMLElement>('[data-role="selected-source"]');
        if (selectedSource) selectedSource.textContent = params.selectedSource;
        if (textarea) {
            textarea.value = params.initialText ?? '';
            installInputEventBoundary(textarea);
            textarea.addEventListener('compositionstart', () => {
                this.composing = true;
            });
            textarea.addEventListener('compositionend', () => {
                this.composing = false;
            });
            setTimeout(() => textarea.focus(), 0);
        }

        const saveCurrentValue = () => {
            const value = textarea?.value.trim() ?? '';
            if (!value) return;
            params.onSave(value);
            this.close(params.shadow, false);
        };

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
            saveCurrentValue();
        });

        textarea?.addEventListener('keydown', (event) => {
            if (event.key === 'Escape') {
                event.preventDefault();
                event.stopPropagation();
                params.onCancel?.();
                this.close(params.shadow, false);
                return;
            }
            if (
                event.key === 'Enter' &&
                !event.shiftKey &&
                !event.metaKey &&
                !event.ctrlKey &&
                !event.altKey &&
                !event.isComposing &&
                !this.composing
            ) {
                event.preventDefault();
                event.stopPropagation();
                saveCurrentValue();
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

    private positionPopover(
        popover: HTMLElement,
        container: HTMLElement,
        anchorRect: OpenParams['anchorRect'],
    ): void {
        const containerRect = container.getBoundingClientRect();
        const popoverRect = popover.getBoundingClientRect();
        const width = popoverRect.width > 0 ? popoverRect.width : 380;
        const height = popoverRect.height > 0 ? popoverRect.height : 220;
        const edgeInset = this.readPxVar(popover, '--aimd-space-4', 16);
        const gap = this.readPxVar(popover, '--aimd-space-3', 12);
        const containerWidth = containerRect.width || container.clientWidth || width;
        const containerHeight = containerRect.height || container.clientHeight || height;

        const anchorCenter = anchorRect.left - containerRect.left + (anchorRect.width / 2);
        const unclampedLeft = anchorCenter - (width / 2);
        const left = Math.max(edgeInset, Math.min(unclampedLeft, Math.max(edgeInset, containerWidth - width - edgeInset)));

        let side: 'top' | 'bottom' = 'top';
        let top = anchorRect.top - containerRect.top - height - gap;
        if (top < edgeInset) {
            side = 'bottom';
            top = anchorRect.bottom - containerRect.top + gap;
        }
        top = Math.max(edgeInset, Math.min(top, Math.max(edgeInset, containerHeight - height - edgeInset)));

        const arrowInset = this.readPxVar(popover, '--aimd-space-4', 16) + this.readPxVar(popover, '--aimd-space-2', 8);
        const arrowLeft = Math.max(arrowInset, Math.min(anchorCenter - left, Math.max(arrowInset, width - arrowInset)));

        popover.style.left = `${left}px`;
        popover.style.top = `${top}px`;
        popover.style.maxWidth = `min(380px, calc(100% - (${edgeInset * 2}px)))`;
        popover.dataset.side = side;
        popover.style.setProperty('--_reader-comment-arrow-left', `${arrowLeft}px`);
    }

    private readPxVar(element: HTMLElement, name: string, fallback: number): number {
        const value = window.getComputedStyle(element).getPropertyValue(name).trim();
        const parsed = Number.parseFloat(value);
        return Number.isFinite(parsed) ? parsed : fallback;
    }
}
