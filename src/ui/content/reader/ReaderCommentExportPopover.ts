import type { Theme } from '../../../core/types/theme';
import { copyIcon, messageSquareTextIcon, xIcon } from '../../../assets/icons';
import { createIcon } from '../components/Icon';
import { installInputEventBoundary } from '../components/inputEventBoundary';
import { markTransientRoot } from '../components/transientUi';
import { ensureStyle } from '../../../style/shadow';
import type { CommentTemplateTokenKey, ReaderCommentExportPrompts } from '../../../services/reader/commentExport';
import { ReaderCommentTemplateEditor } from './ReaderCommentTemplateEditor';

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
        template?: string;
        templateHint?: string;
        templatePlaceholder?: string;
        insertSelectedSource?: string;
        insertUserComment?: string;
        tokenSelectedSource?: string;
        tokenUserComment?: string;
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

.reader-comment-export__field-label {
  color: var(--aimd-text-primary);
  font-weight: var(--aimd-font-medium);
}

.reader-comment-export__field input,
.reader-comment-export__field textarea {
  width: 100%;
  padding: var(--aimd-space-3);
  border-radius: var(--aimd-radius-xl);
  border: 1px solid color-mix(in srgb, var(--aimd-border-default) 82%, transparent);
  background: color-mix(in srgb, var(--aimd-bg-primary) 94%, transparent);
  color: var(--aimd-text-primary);
  font: inherit;
  line-height: 1.5;
  box-shadow: inset 0 1px 0 color-mix(in srgb, var(--aimd-bg-primary) 72%, transparent);
}

.reader-comment-export__field textarea {
  min-height: 88px;
  resize: vertical;
}

.reader-comment-export__field textarea[data-role="commentTemplate"] {
  min-height: 164px;
}

.reader-comment-export__hint {
  margin: 0;
  color: var(--aimd-text-secondary);
  font-size: var(--aimd-text-xs);
  line-height: 1.5;
  white-space: pre-wrap;
}

.reader-comment-export__toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: var(--aimd-space-2);
}

.reader-comment-export__insert-btn {
  gap: var(--aimd-space-2);
  padding-inline: var(--aimd-space-3);
}

.reader-comment-export__editor {
  min-height: 164px;
  padding: var(--aimd-space-3);
  border-radius: var(--aimd-radius-xl);
  border: 1px solid color-mix(in srgb, var(--aimd-border-default) 82%, transparent);
  background: color-mix(in srgb, var(--aimd-bg-primary) 94%, transparent);
  color: var(--aimd-text-primary);
  line-height: 1.6;
  box-shadow: inset 0 1px 0 color-mix(in srgb, var(--aimd-bg-primary) 72%, transparent);
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  cursor: text;
}

.reader-comment-export__editor:focus-visible {
  outline: none;
  border-color: color-mix(in srgb, var(--aimd-interactive-primary) 58%, transparent);
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--aimd-interactive-primary) 32%, transparent);
}

.reader-comment-export__editor:empty::before {
  content: attr(data-placeholder);
  color: var(--aimd-text-secondary);
}

.reader-comment-template-editor__token {
  display: inline-flex;
  align-items: center;
  margin: 0 0.2em;
  padding: 0 var(--aimd-space-2);
  min-height: 1.75em;
  border-radius: var(--aimd-radius-xl);
  background: color-mix(in srgb, var(--aimd-interactive-primary) 12%, var(--aimd-bg-surface));
  color: var(--aimd-interactive-primary);
  border: 1px solid color-mix(in srgb, var(--aimd-interactive-primary) 24%, transparent);
  font-size: 0.95em;
  font-weight: var(--aimd-font-medium);
  vertical-align: baseline;
  user-select: none;
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
    private templateEditor: ReaderCommentTemplateEditor | null = null;

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
        this.templateEditor = null;
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
            template: params.labels?.template ?? 'Comment template',
            templateHint: params.labels?.templateHint ?? 'Use 【选中文字】 and 【用户评论】.',
            templatePlaceholder: params.labels?.templatePlaceholder ?? 'Write your template here...',
            insertSelectedSource: params.labels?.insertSelectedSource ?? 'Insert selected source',
            insertUserComment: params.labels?.insertUserComment ?? 'Insert user comment',
            tokenSelectedSource: params.labels?.tokenSelectedSource ?? 'Selected source',
            tokenUserComment: params.labels?.tokenUserComment ?? 'User comment',
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
            <button class="icon-btn reader-comment-export__close" type="button" data-action="close" aria-label="${labels.close}">${createIcon(xIcon).outerHTML}</button>
          </div>
          <div class="reader-comment-export__grid">
            <label class="reader-comment-export__field">
              <span class="reader-comment-export__field-label">${labels.userPrompt}</span>
              <textarea data-role="userPrompt" rows="3"></textarea>
            </label>
            <div class="reader-comment-export__field">
              <span class="reader-comment-export__field-label">${labels.template}</span>
              <div class="reader-comment-export__toolbar">
                <button class="secondary-btn secondary-btn--compact reader-comment-export__insert-btn" type="button" data-action="insert-selected-source">${labels.insertSelectedSource}</button>
                <button class="secondary-btn secondary-btn--compact reader-comment-export__insert-btn" type="button" data-action="insert-user-comment">${labels.insertUserComment}</button>
              </div>
              <div class="reader-comment-export__editor" data-role="commentTemplate" tabindex="0"></div>
            </div>
            <p class="reader-comment-export__hint">${labels.templateHint}</p>
          </div>
          <pre class="reader-comment-export__preview" data-role="preview"></pre>
          <div class="reader-comment-export__actions">
            <button class="secondary-btn secondary-btn--primary reader-comment-export__btn" type="button" data-action="copy">${createIcon(copyIcon).outerHTML}<span>${labels.copy}</span></button>
          </div>
        `;

        layer.appendChild(popover);
        params.container.appendChild(layer);
        this.rootEl = layer;

        const userPrompt = popover.querySelector<HTMLTextAreaElement>('[data-role="userPrompt"]')!;
        const commentTemplate = popover.querySelector<HTMLElement>('[data-role="commentTemplate"]')!;
        const preview = popover.querySelector<HTMLElement>('[data-role="preview"]')!;
        const copyButton = popover.querySelector<HTMLButtonElement>('[data-action="copy"]')!;
        const insertSelectedSourceButton = popover.querySelector<HTMLButtonElement>('[data-action="insert-selected-source"]')!;
        const insertUserCommentButton = popover.querySelector<HTMLButtonElement>('[data-action="insert-user-comment"]')!;

        userPrompt.value = params.prompts.userPrompt;
        preview.textContent = params.preview || labels.empty;
        copyButton.disabled = !params.canCopy;

        installInputEventBoundary(userPrompt);
        userPrompt.addEventListener('input', () => {
            const next = {
                userPrompt: userPrompt.value,
                commentTemplate: this.templateEditor?.getValue() ?? params.prompts.commentTemplate,
            };
            params.onChange(next);
        });

        this.templateEditor = new ReaderCommentTemplateEditor({
            root: commentTemplate,
            value: params.prompts.commentTemplate,
            labels: {
                selected_source: labels.tokenSelectedSource,
                user_comment: labels.tokenUserComment,
            },
            placeholder: labels.templatePlaceholder,
            onChange: (nextTemplate) => {
                params.onChange({
                    userPrompt: userPrompt.value,
                    commentTemplate: nextTemplate,
                });
            },
        });

        const insertToken = (key: CommentTemplateTokenKey) => {
            this.templateEditor?.insertToken(key);
        };

        [insertSelectedSourceButton, insertUserCommentButton].forEach((button) => {
            button.addEventListener('pointerdown', (event) => {
                this.templateEditor?.rememberSelection();
                event.preventDefault();
                event.stopPropagation();
            });
        });
        insertSelectedSourceButton.addEventListener('click', () => insertToken('selected_source'));
        insertUserCommentButton.addEventListener('click', () => insertToken('user_comment'));

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
        const preview = popover.querySelector<HTMLElement>('[data-role="preview"]');
        const copyButton = popover.querySelector<HTMLButtonElement>('[data-action="copy"]');
        if (userPrompt && userPrompt.value !== params.prompts.userPrompt) {
            userPrompt.value = params.prompts.userPrompt;
        }
        this.templateEditor?.update(params.prompts.commentTemplate);
        if (preview) preview.textContent = params.preview || 'No comments yet.';
        if (copyButton) copyButton.disabled = !params.canCopy;
    }

    private shouldIgnorePointerDown(event: Event): boolean {
        const path = (event.composedPath?.() ?? []) as EventTarget[];
        return path.includes(this.rootEl as EventTarget);
    }
}
