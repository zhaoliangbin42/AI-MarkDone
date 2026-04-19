import { messageSquareTextIcon, xIcon } from '../../../../../assets/icons';
import { createIcon } from '../../../components/Icon';
import { installInputEventBoundary } from '../../../components/inputEventBoundary';
import { markTransientRoot } from '../../../components/transientUi';
import type { ReaderCommentPrompt } from '../../../../../core/settings/readerCommentExport';

type OpenParams = {
    parent: HTMLElement;
    prompt: ReaderCommentPrompt;
    labels: {
        title: string;
        titleLabel: string;
        contentLabel: string;
        titlePlaceholder: string;
        contentPlaceholder: string;
        save: string;
        cancel: string;
        close: string;
    };
    onSave: (next: ReaderCommentPrompt) => void;
    onClose?: () => void;
};

export class ReaderPromptEditorPopover {
    private rootEl: HTMLElement | null = null;

    isOpen(): boolean {
        return Boolean(this.rootEl);
    }

    close(): void {
        if (!this.rootEl) return;
        this.rootEl.remove();
        this.rootEl = null;
    }

    open(params: OpenParams): void {
        this.close();
        const layer = markTransientRoot(document.createElement('div'));
        layer.className = 'reader-settings-popover-layer';
        const popover = document.createElement('div');
        popover.className = 'reader-settings-popover';
        popover.innerHTML = `
          <div class="reader-settings-popover__head">
            <h3 class="reader-settings-popover__title">${createIcon(messageSquareTextIcon).outerHTML}<span>${params.labels.title}</span></h3>
            <button class="icon-btn reader-settings-popover__close" type="button" data-action="close" aria-label="${params.labels.close}">${createIcon(xIcon).outerHTML}</button>
          </div>
          <label class="reader-settings-popover__field">
            <span class="reader-settings-popover__field-label">${params.labels.titleLabel}</span>
            <input class="reader-settings-popover__input" data-role="title" type="text" placeholder="${params.labels.titlePlaceholder}" />
          </label>
          <label class="reader-settings-popover__field">
            <span class="reader-settings-popover__field-label">${params.labels.contentLabel}</span>
            <textarea class="reader-settings-popover__textarea" data-role="content" rows="6" placeholder="${params.labels.contentPlaceholder}"></textarea>
          </label>
          <div class="reader-settings-popover__actions">
            <button class="secondary-btn" type="button" data-action="cancel">${params.labels.cancel}</button>
            <button class="secondary-btn secondary-btn--primary" type="button" data-action="save">${params.labels.save}</button>
          </div>
        `;
        layer.appendChild(popover);
        params.parent.appendChild(layer);
        this.rootEl = layer;

        const titleInput = popover.querySelector<HTMLInputElement>('[data-role="title"]')!;
        const contentInput = popover.querySelector<HTMLTextAreaElement>('[data-role="content"]')!;
        titleInput.value = params.prompt.title;
        contentInput.value = params.prompt.content;
        installInputEventBoundary(contentInput);

        const commit = () => {
            params.onSave({
                ...params.prompt,
                title: titleInput.value.trim() || params.prompt.title,
                content: contentInput.value,
            });
            this.close();
            params.onClose?.();
        };

        popover.querySelector<HTMLButtonElement>('[data-action="close"]')?.addEventListener('click', () => {
            this.close();
            params.onClose?.();
        });
        popover.querySelector<HTMLButtonElement>('[data-action="cancel"]')?.addEventListener('click', () => {
            this.close();
            params.onClose?.();
        });
        popover.querySelector<HTMLButtonElement>('[data-action="save"]')?.addEventListener('click', commit);
        titleInput.focus({ preventScroll: true });
    }
}
