import { chevronRightIcon, messageSquareTextIcon, trashIcon, xIcon } from '../../../../../assets/icons';
import type { ReaderCommentExportSettings, ReaderCommentPrompt } from '../../../../../core/settings/readerCommentExport';
import { createIcon } from '../../../components/Icon';
import { installInputEventBoundary } from '../../../components/inputEventBoundary';
import { markTransientRoot } from '../../../components/transientUi';

type OpenParams = {
    parent: HTMLElement;
    settings: ReaderCommentExportSettings;
    labels: {
        title: string;
        close: string;
        addPrompt: string;
        editPrompt: string;
        untitledPrompt: string;
        active: string;
        select: string;
        back: string;
        titleLabel: string;
        contentLabel: string;
        titlePlaceholder: string;
        contentPlaceholder: string;
        empty: string;
        save: string;
        cancel: string;
        delete: string;
    };
    createPromptId: () => string;
    onChange: (next: ReaderCommentExportSettings) => void;
    onConfirmDelete: (prompt: ReaderCommentPrompt) => Promise<boolean>;
    onClose?: () => void;
};

type EditState = {
    isNew: boolean;
    prompt: ReaderCommentPrompt;
};

export class ReaderPromptSettingsPopover {
    private rootEl: HTMLElement | null = null;
    private params: OpenParams | null = null;
    private settings: ReaderCommentExportSettings | null = null;
    private view: 'list' | 'edit' = 'list';
    private editState: EditState | null = null;
    private onWindowKeyDown: ((event: KeyboardEvent) => void) | null = null;

    isOpen(): boolean {
        return Boolean(this.rootEl);
    }

    close(): void {
        if (!this.rootEl) return;
        this.detachWindowKeyDown();
        this.rootEl.remove();
        this.rootEl = null;
        this.params = null;
        this.settings = null;
        this.view = 'list';
        this.editState = null;
    }

    open(params: OpenParams): void {
        this.close();
        this.params = params;
        this.settings = this.cloneSettings(params.settings);

        const layer = markTransientRoot(document.createElement('div'));
        layer.className = 'reader-settings-popover-layer';
        const popover = document.createElement('div');
        popover.className = 'reader-settings-popover reader-settings-popover--wide reader-prompt-settings';
        popover.dataset.view = 'list';
        popover.addEventListener('keydown', (event) => this.handleKeyDownCapture(event), { capture: true });
        popover.addEventListener('keydown', (event) => event.stopPropagation());
        layer.appendChild(popover);
        params.parent.appendChild(layer);
        this.rootEl = layer;
        this.onWindowKeyDown = (event: KeyboardEvent) => this.handleKeyDownCapture(event);
        window.addEventListener('keydown', this.onWindowKeyDown, { capture: true });
        this.render();
    }

    private render(): void {
        const popover = this.rootEl?.querySelector<HTMLElement>('.reader-prompt-settings');
        if (!popover || !this.params || !this.settings) return;
        popover.dataset.view = this.view;
        popover.replaceChildren();
        if (this.view === 'edit' && this.editState) {
            this.renderEdit(popover);
            return;
        }
        this.renderList(popover);
    }

    private renderList(popover: HTMLElement): void {
        if (!this.params || !this.settings) return;
        const header = this.createHeader(this.params.labels.title);
        const list = document.createElement('div');
        list.className = 'reader-prompt-settings__list';
        list.dataset.role = 'prompt-list';

        for (const prompt of this.settings.prompts) {
            const row = document.createElement('div');
            row.className = 'reader-prompt-settings__row';
            row.dataset.active = prompt.id === this.settings.activePromptId ? '1' : '0';

            const main = document.createElement('button');
            main.type = 'button';
            main.className = 'reader-prompt-settings__row-main';
            main.dataset.action = 'open-prompt';
            const title = document.createElement('span');
            title.className = 'reader-prompt-settings__row-title';
            title.textContent = prompt.title;
            const content = document.createElement('span');
            content.className = 'reader-prompt-settings__row-content';
            content.textContent = prompt.content || this.params.labels.empty;
            main.append(title, content);
            main.addEventListener('click', () => this.openEditor(prompt, false));

            const actions = document.createElement('div');
            actions.className = 'reader-prompt-settings__row-actions';
            if (prompt.id === this.settings.activePromptId) {
                const active = document.createElement('span');
                active.className = 'reader-prompt-settings__active';
                active.textContent = this.params.labels.active;
                actions.appendChild(active);
            } else {
                const select = document.createElement('button');
                select.type = 'button';
                select.className = 'secondary-btn secondary-btn--compact';
                select.dataset.action = 'select-prompt';
                select.textContent = this.params.labels.select;
                select.addEventListener('click', (event) => {
                    event.stopPropagation();
                    this.updateSettings({ ...this.settings!, activePromptId: prompt.id });
                });
                actions.appendChild(select);
            }

            if (!prompt.builtIn) {
                const deleteButton = document.createElement('button');
                deleteButton.type = 'button';
                deleteButton.className = 'icon-btn icon-btn--danger';
                deleteButton.dataset.action = 'delete-prompt';
                deleteButton.setAttribute('aria-label', this.params.labels.delete);
                deleteButton.appendChild(createIcon(trashIcon));
                deleteButton.addEventListener('click', async (event) => {
                    event.stopPropagation();
                    if (!this.params || !this.settings) return;
                    const ok = await this.params.onConfirmDelete(prompt);
                    if (!ok) return;
                    const prompts = this.settings.prompts.filter((entry) => entry.id !== prompt.id);
                    this.updateSettings({
                        ...this.settings,
                        activePromptId: this.settings.activePromptId === prompt.id ? prompts[0]?.id ?? '' : this.settings.activePromptId,
                        prompts,
                    });
                });
                actions.appendChild(deleteButton);
            }

            row.append(main, actions);
            list.appendChild(row);
        }

        const footer = document.createElement('div');
        footer.className = 'reader-prompt-settings__footer';
        const addButton = document.createElement('button');
        addButton.type = 'button';
        addButton.className = 'secondary-btn secondary-btn--compact';
        addButton.dataset.action = 'add-prompt';
        addButton.textContent = this.params.labels.addPrompt;
        addButton.addEventListener('click', () => {
            this.openEditor({
                id: this.params!.createPromptId(),
                title: this.params!.labels.untitledPrompt,
                content: '',
            }, true);
        });
        footer.appendChild(addButton);

        popover.append(header, list, footer);
    }

    private renderEdit(popover: HTMLElement): void {
        if (!this.params || !this.editState) return;
        const header = this.createHeader(this.editState.isNew ? this.params.labels.addPrompt : this.params.labels.editPrompt, true);
        const titleField = document.createElement('label');
        titleField.className = 'reader-settings-popover__field';
        const titleLabel = document.createElement('span');
        titleLabel.className = 'reader-settings-popover__field-label';
        titleLabel.textContent = this.params.labels.titleLabel;
        const titleInput = document.createElement('input');
        titleInput.className = 'reader-settings-popover__input';
        titleInput.dataset.role = 'prompt-title';
        titleInput.type = 'text';
        titleInput.placeholder = this.params.labels.titlePlaceholder;
        titleInput.value = this.editState.prompt.title;
        titleField.append(titleLabel, titleInput);

        const contentField = document.createElement('label');
        contentField.className = 'reader-settings-popover__field';
        const contentLabel = document.createElement('span');
        contentLabel.className = 'reader-settings-popover__field-label';
        contentLabel.textContent = this.params.labels.contentLabel;
        const contentInput = document.createElement('textarea');
        contentInput.className = 'reader-settings-popover__textarea';
        contentInput.dataset.role = 'prompt-content';
        contentInput.rows = 8;
        contentInput.placeholder = this.params.labels.contentPlaceholder;
        contentInput.value = this.editState.prompt.content;
        installInputEventBoundary(contentInput);
        contentField.append(contentLabel, contentInput);

        const actions = document.createElement('div');
        actions.className = 'reader-settings-popover__actions';
        const cancel = document.createElement('button');
        cancel.type = 'button';
        cancel.className = 'secondary-btn';
        cancel.dataset.action = 'cancel-prompt';
        cancel.textContent = this.params.labels.cancel;
        cancel.addEventListener('click', () => this.showList());
        const save = document.createElement('button');
        save.type = 'button';
        save.className = 'secondary-btn secondary-btn--primary';
        save.dataset.action = 'save-prompt';
        save.textContent = this.params.labels.save;
        save.addEventListener('click', () => {
            if (!this.params || !this.settings || !this.editState) return;
            const prompt = {
                ...this.editState.prompt,
                title: titleInput.value.trim() || this.editState.prompt.title,
                content: contentInput.value,
            };
            const prompts = this.editState.isNew
                ? [...this.settings.prompts, prompt]
                : this.settings.prompts.map((entry) => entry.id === prompt.id ? prompt : entry);
            this.updateSettings({
                ...this.settings,
                activePromptId: this.editState.isNew ? prompt.id : this.settings.activePromptId,
                prompts,
            });
            this.showList();
        });
        actions.append(cancel, save);

        popover.append(header, titleField, contentField, actions);
        titleInput.focus({ preventScroll: true } as FocusOptions);
    }

    private createHeader(titleText: string, withBack = false): HTMLElement {
        const header = document.createElement('div');
        header.className = 'reader-settings-popover__head';
        const title = document.createElement('h3');
        title.className = 'reader-settings-popover__title';
        if (withBack && this.params) {
            const back = document.createElement('button');
            back.type = 'button';
            back.className = 'icon-btn reader-prompt-settings__back';
            back.dataset.action = 'back-to-prompts';
            back.setAttribute('aria-label', this.params.labels.back);
            back.appendChild(createIcon(chevronRightIcon));
            back.addEventListener('click', () => this.showList());
            title.appendChild(back);
        } else {
            title.appendChild(createIcon(messageSquareTextIcon));
        }
        const text = document.createElement('span');
        text.textContent = titleText;
        title.appendChild(text);
        const close = document.createElement('button');
        close.type = 'button';
        close.className = 'icon-btn reader-settings-popover__close';
        close.dataset.action = 'close';
        close.setAttribute('aria-label', this.params?.labels.close ?? 'Close');
        close.appendChild(createIcon(xIcon));
        close.addEventListener('click', () => {
            const onClose = this.params?.onClose;
            this.close();
            onClose?.();
        });
        header.append(title, close);
        return header;
    }

    private openEditor(prompt: ReaderCommentPrompt, isNew: boolean): void {
        this.view = 'edit';
        this.editState = { isNew, prompt: { ...prompt } };
        this.render();
    }

    private showList(): void {
        this.view = 'list';
        this.editState = null;
        this.render();
    }

    private handleKeyDownCapture(event: KeyboardEvent): void {
        if (event.key !== 'Escape') return;
        event.preventDefault();
        event.stopPropagation();
        const onClose = this.params?.onClose;
        this.close();
        onClose?.();
    }

    private detachWindowKeyDown(): void {
        if (!this.onWindowKeyDown) return;
        window.removeEventListener('keydown', this.onWindowKeyDown, { capture: true } as any);
        this.onWindowKeyDown = null;
    }

    private updateSettings(next: ReaderCommentExportSettings): void {
        this.settings = this.cloneSettings(next);
        this.params?.onChange(this.cloneSettings(next));
        this.render();
    }

    private cloneSettings(settings: ReaderCommentExportSettings): ReaderCommentExportSettings {
        return {
            activePromptId: settings.activePromptId,
            prompts: settings.prompts.map((prompt) => ({ ...prompt })),
            template: settings.template.map((segment) => ({ ...segment })),
        };
    }
}
