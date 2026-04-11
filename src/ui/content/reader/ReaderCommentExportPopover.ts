import type { Theme } from '../../../core/types/theme';
import { copyIcon, messageSquareTextIcon, xIcon } from '../../../assets/icons';
import { createIcon } from '../components/Icon';
import { installInputEventBoundary } from '../components/inputEventBoundary';
import { markTransientRoot } from '../components/transientUi';
import { ensureStyle } from '../../../style/shadow';
import type { ReaderCommentExportPrompts } from '../../../services/reader/commentExport';

type OpenParams = {
    shadow: ShadowRoot;
    container: HTMLElement;
    theme: Theme;
    prompts: ReaderCommentExportPrompts;
    preview: string;
    canCopy: boolean;
    labels?: {
        title?: string;
        close?: string;
        userPrompt?: string;
        prompt1?: string;
        prompt2?: string;
        prompt3?: string;
        copy?: string;
        copied?: string;
        empty?: string;
    };
    onChange: (next: ReaderCommentExportPrompts) => void;
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
  border-radius: var(--aimd-radius-xl);
  border: 1px solid color-mix(in srgb, var(--aimd-border-default) 82%, transparent);
  background: color-mix(in srgb, var(--aimd-bg-primary) 96%, transparent);
  box-shadow: 0 24px 64px color-mix(in srgb, var(--aimd-overlay-bg) 22%, transparent);
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
  font-size: var(--aimd-text-base);
  line-height: 1.4;
  font-weight: var(--aimd-font-semibold);
  color: var(--aimd-text-primary);
}

.reader-comment-export__title .aimd-icon {
  color: var(--aimd-interactive-primary);
}

.reader-comment-export__close {
  width: var(--aimd-size-control-icon-panel);
  height: var(--aimd-size-control-icon-panel);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid color-mix(in srgb, var(--aimd-border-default) 84%, transparent);
  background: color-mix(in srgb, var(--aimd-bg-secondary) 78%, transparent);
  color: var(--aimd-text-secondary);
  cursor: pointer;
}

.reader-comment-export__grid {
  display: grid;
  gap: var(--aimd-space-3);
}

.reader-comment-export__field {
  display: grid;
  gap: var(--aimd-space-2);
  color: var(--aimd-text-secondary);
  font-size: var(--aimd-text-sm);
}

.reader-comment-export__field > span {
  color: var(--aimd-text-primary);
  font-weight: var(--aimd-font-medium);
}

.reader-comment-export__field input,
.reader-comment-export__field textarea {
  width: 100%;
  padding: var(--aimd-space-3);
  border-radius: var(--aimd-radius-lg);
  border: 1px solid color-mix(in srgb, var(--aimd-border-default) 82%, transparent);
  background: color-mix(in srgb, var(--aimd-bg-primary) 94%, transparent);
  color: var(--aimd-text-primary);
  font: inherit;
  line-height: 1.5;
}

.reader-comment-export__field textarea {
  min-height: 88px;
  resize: vertical;
}

.reader-comment-export__field input:focus-visible,
.reader-comment-export__field textarea:focus-visible {
  outline: none;
  border-color: color-mix(in srgb, var(--aimd-interactive-primary) 58%, transparent);
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--aimd-interactive-primary) 32%, transparent);
}

.reader-comment-export__preview {
  margin: 0;
  min-height: 112px;
  max-height: 240px;
  overflow: auto;
  padding: var(--aimd-space-3);
  border-radius: var(--aimd-radius-lg);
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
  min-height: var(--aimd-size-control-action-panel);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--aimd-space-2);
  padding: 0 var(--aimd-space-4);
  border: 1px solid color-mix(in srgb, var(--aimd-interactive-primary) 42%, transparent);
  background: color-mix(in srgb, var(--aimd-interactive-selected) 92%, var(--aimd-bg-primary));
  color: var(--aimd-text-primary);
  font: inherit;
  cursor: pointer;
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
            title: params.labels?.title ?? 'Copy comments',
            close: params.labels?.close ?? 'Close',
            userPrompt: params.labels?.userPrompt ?? 'User prompt',
            prompt1: params.labels?.prompt1 ?? 'Prompt 1',
            prompt2: params.labels?.prompt2 ?? 'Prompt 2',
            prompt3: params.labels?.prompt3 ?? 'Prompt 3',
            copy: params.labels?.copy ?? 'Copy comments',
            copied: params.labels?.copied ?? 'Copied!',
            empty: params.labels?.empty ?? 'No comments yet.',
        };

        const layer = markTransientRoot(document.createElement('div'));
        layer.className = 'reader-comment-export-layer';
        const popover = document.createElement('div');
        popover.className = 'reader-comment-export';
        popover.setAttribute('data-aimd-theme', params.theme);
        popover.innerHTML = `
          <div class="reader-comment-export__head">
            <h3 class="reader-comment-export__title">${createIcon(messageSquareTextIcon).outerHTML}<span>${labels.title}</span></h3>
            <button class="reader-comment-export__close" type="button" data-action="close" aria-label="${labels.close}">${createIcon(xIcon).outerHTML}</button>
          </div>
          <div class="reader-comment-export__grid">
            <label class="reader-comment-export__field">
              <span>${labels.userPrompt}</span>
              <textarea data-role="userPrompt" rows="3"></textarea>
            </label>
            <label class="reader-comment-export__field">
              <span>${labels.prompt1}</span>
              <input data-role="prompt1" type="text" />
            </label>
            <label class="reader-comment-export__field">
              <span>${labels.prompt2}</span>
              <input data-role="prompt2" type="text" />
            </label>
            <label class="reader-comment-export__field">
              <span>${labels.prompt3}</span>
              <input data-role="prompt3" type="text" />
            </label>
          </div>
          <pre class="reader-comment-export__preview" data-role="preview"></pre>
          <div class="reader-comment-export__actions">
            <button class="reader-comment-export__btn" type="button" data-action="copy">${createIcon(copyIcon).outerHTML}<span>${labels.copy}</span></button>
          </div>
        `;

        layer.appendChild(popover);
        params.container.appendChild(layer);
        this.rootEl = layer;

        const userPrompt = popover.querySelector<HTMLTextAreaElement>('[data-role="userPrompt"]')!;
        const prompt1 = popover.querySelector<HTMLInputElement>('[data-role="prompt1"]')!;
        const prompt2 = popover.querySelector<HTMLInputElement>('[data-role="prompt2"]')!;
        const prompt3 = popover.querySelector<HTMLInputElement>('[data-role="prompt3"]')!;
        const preview = popover.querySelector<HTMLElement>('[data-role="preview"]')!;
        const copyButton = popover.querySelector<HTMLButtonElement>('[data-action="copy"]')!;

        userPrompt.value = params.prompts.userPrompt;
        prompt1.value = params.prompts.prompt1;
        prompt2.value = params.prompts.prompt2;
        prompt3.value = params.prompts.prompt3;
        preview.textContent = params.preview || labels.empty;
        copyButton.disabled = !params.canCopy;

        [userPrompt, prompt1, prompt2, prompt3].forEach((element) => {
            installInputEventBoundary(element);
            element.addEventListener('input', () => {
                const next = {
                    userPrompt: userPrompt.value,
                    prompt1: prompt1.value,
                    prompt2: prompt2.value,
                    prompt3: prompt3.value,
                };
                params.onChange(next);
            });
        });

        popover.querySelector<HTMLButtonElement>('[data-action="close"]')?.addEventListener('click', () => {
            params.onClose?.();
            this.close(params.shadow);
        });

        copyButton.addEventListener('click', async () => {
            const ok = await params.onCopy();
            if (ok) {
                copyButton.querySelector('span')!.textContent = labels.copied;
                window.setTimeout(() => {
                    if (this.rootEl) copyButton.querySelector('span')!.textContent = labels.copy;
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

    update(params: { prompts: ReaderCommentExportPrompts; preview: string; canCopy: boolean }): void {
        if (!this.rootEl) return;
        const popover = this.rootEl.querySelector<HTMLElement>('.reader-comment-export');
        if (!popover) return;
        const userPrompt = popover.querySelector<HTMLTextAreaElement>('[data-role="userPrompt"]');
        const prompt1 = popover.querySelector<HTMLInputElement>('[data-role="prompt1"]');
        const prompt2 = popover.querySelector<HTMLInputElement>('[data-role="prompt2"]');
        const prompt3 = popover.querySelector<HTMLInputElement>('[data-role="prompt3"]');
        const preview = popover.querySelector<HTMLElement>('[data-role="preview"]');
        const copyButton = popover.querySelector<HTMLButtonElement>('[data-action="copy"]');
        if (userPrompt) userPrompt.value = params.prompts.userPrompt;
        if (prompt1) prompt1.value = params.prompts.prompt1;
        if (prompt2) prompt2.value = params.prompts.prompt2;
        if (prompt3) prompt3.value = params.prompts.prompt3;
        if (preview) preview.textContent = params.preview || 'No comments yet.';
        if (copyButton) copyButton.disabled = !params.canCopy;
    }

    private shouldIgnorePointerDown(event: Event): boolean {
        const path = (event.composedPath?.() ?? []) as EventTarget[];
        return path.includes(this.rootEl as EventTarget);
    }
}
