import { messageSquareTextIcon, xIcon } from '../../../../../assets/icons';
import type { CommentTemplateSegment, CommentTemplateTokenKey } from '../../../../../core/settings/readerCommentExport';
import { createIcon } from '../../../components/Icon';
import { markTransientRoot } from '../../../components/transientUi';
import { ReaderCommentTemplateEditor } from '../../../reader/ReaderCommentTemplateEditor';

type OpenParams = {
    parent: HTMLElement;
    template: CommentTemplateSegment[];
    preview: string;
    labels: {
        title: string;
        close: string;
        template: string;
        templateHint: string;
        templatePlaceholder: string;
        insertSelectedSource: string;
        insertUserComment: string;
        tokenSelectedSource: string;
        tokenUserComment: string;
        preview: string;
        save: string;
        cancel: string;
        copied: string;
    };
    onBuildPreview: (template: CommentTemplateSegment[]) => string;
    onSave: (template: CommentTemplateSegment[]) => void;
    onClose?: () => void;
};

export class ReaderCommentTemplateSettingsPopover {
    private rootEl: HTMLElement | null = null;
    private editor: ReaderCommentTemplateEditor | null = null;
    private onWindowKeyDown: ((event: KeyboardEvent) => void) | null = null;

    isOpen(): boolean {
        return Boolean(this.rootEl);
    }

    close(): void {
        if (!this.rootEl) return;
        this.detachWindowKeyDown();
        this.rootEl.remove();
        this.rootEl = null;
        this.editor = null;
    }

    open(params: OpenParams): void {
        this.close();
        const layer = markTransientRoot(document.createElement('div'));
        layer.className = 'reader-settings-popover-layer';
        const popover = document.createElement('div');
        popover.className = 'reader-settings-popover reader-settings-popover--wide reader-settings-popover--template';
        popover.addEventListener('keydown', (event) => {
            if (event.key !== 'Escape') return;
            event.preventDefault();
            event.stopPropagation();
            this.close();
            params.onClose?.();
        }, { capture: true });
        popover.addEventListener('keydown', (event) => event.stopPropagation());
        popover.innerHTML = `
          <div class="reader-settings-popover__head">
            <h3 class="reader-settings-popover__title">${createIcon(messageSquareTextIcon).outerHTML}<span>${params.labels.title}</span></h3>
            <button class="icon-btn reader-settings-popover__close" type="button" data-action="close" aria-label="${params.labels.close}">${createIcon(xIcon).outerHTML}</button>
          </div>
          <div class="reader-settings-popover__field">
            <span class="reader-settings-popover__field-label">${params.labels.template}</span>
            <div class="reader-settings-template__toolbar">
              <button class="secondary-btn secondary-btn--compact" type="button" data-action="insert-selected-source">${params.labels.insertSelectedSource}</button>
              <button class="secondary-btn secondary-btn--compact" type="button" data-action="insert-user-comment">${params.labels.insertUserComment}</button>
            </div>
            <div class="reader-settings-template__editor" data-role="commentTemplate" tabindex="0"></div>
            <p class="reader-settings-template__hint">${params.labels.templateHint}</p>
          </div>
          <div class="reader-settings-popover__field">
            <span class="reader-settings-popover__field-label">${params.labels.preview}</span>
            <pre class="reader-settings-template__preview" data-role="preview"></pre>
          </div>
          <div class="reader-settings-popover__actions">
            <button class="secondary-btn" type="button" data-action="cancel">${params.labels.cancel}</button>
            <button class="secondary-btn secondary-btn--primary" type="button" data-action="save">${params.labels.save}</button>
          </div>
        `;
        layer.appendChild(popover);
        params.parent.appendChild(layer);
        this.rootEl = layer;
        this.onWindowKeyDown = (event: KeyboardEvent) => {
            if (event.key !== 'Escape') return;
            event.preventDefault();
            event.stopPropagation();
            this.close();
            params.onClose?.();
        };
        window.addEventListener('keydown', this.onWindowKeyDown, { capture: true });

        const editorRoot = popover.querySelector<HTMLElement>('[data-role="commentTemplate"]')!;
        const preview = popover.querySelector<HTMLElement>('[data-role="preview"]')!;
        preview.textContent = params.preview;
        const close = () => {
            this.close();
            params.onClose?.();
        };
        const closeOnEscape = (event: KeyboardEvent) => {
            if (event.key !== 'Escape') return;
            event.preventDefault();
            event.stopPropagation();
            close();
        };
        editorRoot.addEventListener('keydown', closeOnEscape);
        this.editor = new ReaderCommentTemplateEditor({
            root: editorRoot,
            value: params.template,
            labels: {
                selected_source: params.labels.tokenSelectedSource,
                user_comment: params.labels.tokenUserComment,
            },
            placeholder: params.labels.templatePlaceholder,
            onChange: (nextTemplate) => {
                preview.textContent = params.onBuildPreview(nextTemplate);
            },
        });

        const insertToken = (key: CommentTemplateTokenKey) => this.editor?.insertToken(key);
        const bindInsertButton = (selector: string, key: CommentTemplateTokenKey) => {
            const button = popover.querySelector<HTMLButtonElement>(selector);
            button?.addEventListener('pointerdown', (event) => {
                this.editor?.rememberSelection();
                event.preventDefault();
                event.stopPropagation();
            });
            button?.addEventListener('click', () => insertToken(key));
        };
        bindInsertButton('[data-action="insert-selected-source"]', 'selected_source');
        bindInsertButton('[data-action="insert-user-comment"]', 'user_comment');

        popover.querySelector<HTMLButtonElement>('[data-action="close"]')?.addEventListener('click', close);
        popover.querySelector<HTMLButtonElement>('[data-action="cancel"]')?.addEventListener('click', close);
        popover.querySelector<HTMLButtonElement>('[data-action="save"]')?.addEventListener('click', () => {
            params.onSave(this.editor?.getValue() ?? params.template);
            close();
        });
    }

    private detachWindowKeyDown(): void {
        if (!this.onWindowKeyDown) return;
        window.removeEventListener('keydown', this.onWindowKeyDown, { capture: true } as any);
        this.onWindowKeyDown = null;
    }
}
