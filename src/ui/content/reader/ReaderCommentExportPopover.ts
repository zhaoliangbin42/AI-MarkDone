import type { Theme } from '../../../core/types/theme';
import { copyIcon, messageSquareTextIcon, xIcon } from '../../../assets/icons';
import { createIcon } from '../components/Icon';
import { markTransientRoot } from '../components/transientUi';
import { ensureStyle } from '../../../style/shadow';

type OpenParams = {
    shadow: ShadowRoot;
    container: HTMLElement;
    theme: Theme;
    preview: string;
    canCopy: boolean;
    labels?: {
        title?: string;
        close?: string;
        copy?: string;
        copied?: string;
        empty?: string;
    };
    onCopy: () => Promise<boolean>;
    onClose?: () => void;
};

function getExportPopoverCss(): string {
    return `
.reader-comment-export-layer {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  pointer-events: none;
}

.reader-comment-export {
  pointer-events: auto;
  width: min(560px, calc(100% - 32px));
  display: grid;
  gap: var(--aimd-space-4);
  padding: var(--aimd-space-4);
  border-radius: var(--aimd-radius-2xl);
  border: 1px solid color-mix(in srgb, var(--aimd-border-default) 82%, transparent);
  background: color-mix(in srgb, var(--aimd-bg-surface) 98%, var(--aimd-bg-primary));
  box-shadow: var(--aimd-shadow-lg);
}

.reader-comment-export__head,
.reader-comment-export__actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--aimd-space-3);
}

.reader-comment-export__title {
  display: inline-flex;
  align-items: center;
  gap: var(--aimd-space-2);
  margin: 0;
  font-size: var(--aimd-text-sm);
  line-height: 1.4;
  font-weight: var(--aimd-font-medium);
  color: var(--aimd-text-primary);
}

.reader-comment-export__title .aimd-icon {
  color: var(--aimd-interactive-primary);
}

.reader-comment-export__close {
  color: var(--aimd-text-secondary);
}

.reader-comment-export__preview {
  margin: 0;
  min-height: 112px;
  max-height: 320px;
  overflow: auto;
  padding: var(--aimd-space-3);
  border-radius: var(--aimd-radius-xl);
  border: 1px solid color-mix(in srgb, var(--aimd-border-default) 82%, transparent);
  background: color-mix(in srgb, var(--aimd-bg-primary) 92%, transparent);
  color: var(--aimd-text-primary);
  font-family: var(--aimd-font-family-mono);
  font-size: var(--aimd-text-sm);
  line-height: 1.6;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

.reader-comment-export__btn {
  gap: var(--aimd-space-2);
  padding-inline: var(--aimd-space-4);
}

.reader-comment-export__btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
`;
}

export class ReaderCommentExportPopover {
    private rootEl: HTMLElement | null = null;
    private onShadowPointerDown: ((event: Event) => void) | null = null;
    private onDocumentPointerDown: ((event: Event) => void) | null = null;

    isOpen(): boolean {
        return Boolean(this.rootEl);
    }

    close(shadow: ShadowRoot): void {
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
    }

    open(params: OpenParams): void {
        this.close(params.shadow);
        ensureStyle(params.shadow, getExportPopoverCss(), { id: 'aimd-reader-comment-export-style', cache: 'shared' });
        const labels = {
            title: params.labels?.title ?? 'Copy annotations',
            close: params.labels?.close ?? 'Close',
            copy: params.labels?.copy ?? 'Copy annotations',
            copied: params.labels?.copied ?? 'Copied!',
            empty: params.labels?.empty ?? 'No annotations yet.',
        };

        const layer = markTransientRoot(document.createElement('div'));
        layer.className = 'reader-comment-export-layer';

        const popover = document.createElement('div');
        popover.className = 'reader-comment-export';
        popover.setAttribute('data-aimd-theme', params.theme);
        popover.innerHTML = `
          <div class="reader-comment-export__head">
            <h3 class="reader-comment-export__title">${createIcon(messageSquareTextIcon).outerHTML}<span>${labels.title}</span></h3>
            <button class="icon-btn reader-comment-export__close" type="button" data-action="close" aria-label="${labels.close}">${createIcon(xIcon).outerHTML}</button>
          </div>
          <pre class="reader-comment-export__preview" data-role="preview"></pre>
          <div class="reader-comment-export__actions">
            <button class="secondary-btn secondary-btn--primary reader-comment-export__btn" type="button" data-action="copy">${createIcon(copyIcon).outerHTML}<span data-role="copy-label">${labels.copy}</span></button>
          </div>
        `;

        layer.appendChild(popover);
        params.container.appendChild(layer);
        this.rootEl = layer;

        const preview = popover.querySelector<HTMLElement>('[data-role="preview"]')!;
        const copyButton = popover.querySelector<HTMLButtonElement>('[data-action="copy"]')!;
        preview.textContent = params.preview || labels.empty;
        copyButton.disabled = !params.canCopy;

        popover.querySelector<HTMLButtonElement>('[data-action="close"]')?.addEventListener('click', () => {
            params.onClose?.();
            this.close(params.shadow);
        });

        copyButton.addEventListener('click', async () => {
            const ok = await params.onCopy();
            const label = copyButton.querySelector<HTMLElement>('[data-role="copy-label"]');
            if (ok) {
                if (label) label.textContent = labels.copied;
                window.setTimeout(() => {
                    if (this.rootEl && label) label.textContent = labels.copy;
                }, 1200);
            }
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

    update(params: { preview: string; canCopy: boolean }): void {
        if (!this.rootEl) return;
        const popover = this.rootEl.querySelector<HTMLElement>('.reader-comment-export');
        if (!popover) return;
        const preview = popover.querySelector<HTMLElement>('[data-role="preview"]');
        const copyButton = popover.querySelector<HTMLButtonElement>('[data-action="copy"]');
        if (preview) preview.textContent = params.preview || 'No annotations yet.';
        if (copyButton) copyButton.disabled = !params.canCopy;
    }

    private shouldIgnorePointerDown(event: Event): boolean {
        const path = (event.composedPath?.() ?? []) as EventTarget[];
        return path.includes(this.rootEl as EventTarget);
    }
}
