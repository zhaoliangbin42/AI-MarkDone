import { chevronRightIcon, gripHorizontalIcon, messageSquareTextIcon, plusIcon, trashIcon, xIcon } from '../../../../../assets/icons';
import type { ReaderCommentExportSettings, ReaderCommentPrompt } from '../../../../../core/settings/readerCommentExport';
import { createIcon } from '../../../components/Icon';
import { installInputEventBoundary } from '../../../components/inputEventBoundary';
import { createReaderSettingsDialogLayer } from './ReaderSettingsDialogShell';

type OpenParams = {
    parent: HTMLElement;
    settings: ReaderCommentExportSettings;
    labels: {
        title: string;
        close: string;
        addPrompt: string;
        restoreDefaults: string;
        editPrompt: string;
        untitledPrompt: string;
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
    onConfirmRestoreDefaults: () => Promise<boolean>;
    onRestoreDefaults: () => ReaderCommentPrompt[];
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
    private dragState: { promptId: string; pointerId: number } | null = null;
    private onDocumentPointerMove: ((event: PointerEvent) => void) | null = null;
    private onDocumentPointerUp: ((event: PointerEvent) => void) | null = null;

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
        this.stopDrag();
    }

    open(params: OpenParams): void {
        this.close();
        this.params = params;
        this.settings = this.cloneSettings(params.settings);

        const shell = createReaderSettingsDialogLayer({
            parent: params.parent,
            panelClassNames: ['reader-prompt-settings'],
        });
        const popover = shell.panel;
        popover.dataset.view = 'list';
        popover.addEventListener('keydown', (event) => this.handleKeyDownCapture(event), { capture: true });
        popover.addEventListener('keydown', (event) => event.stopPropagation());
        this.rootEl = shell.layer;
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
            row.dataset.promptId = prompt.id;
            const dragHandle = document.createElement('button');
            dragHandle.type = 'button';
            dragHandle.className = 'icon-btn reader-prompt-settings__drag';
            dragHandle.dataset.action = 'drag-prompt';
            dragHandle.setAttribute('aria-label', prompt.title);
            dragHandle.setAttribute('title', prompt.title);
            dragHandle.appendChild(createIcon(gripHorizontalIcon));
            dragHandle.addEventListener('pointerdown', (event) => this.startDrag(event, prompt.id));

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

            if (this.settings.prompts.length > 1) {
                const deleteButton = document.createElement('button');
                deleteButton.type = 'button';
                deleteButton.className = 'icon-btn icon-btn--danger';
                deleteButton.dataset.action = 'delete-prompt';
                deleteButton.setAttribute('aria-label', this.params.labels.delete);
                deleteButton.appendChild(createIcon(trashIcon));
                deleteButton.addEventListener('click', async (event) => {
                    event.stopPropagation();
                    const params = this.params;
                    const settings = this.settings;
                    if (!params || !settings) return;
                    const ok = await params.onConfirmDelete(prompt);
                    if (!ok) return;
                    if (!this.settings) return;
                    const prompts = this.settings.prompts.filter((entry) => entry.id !== prompt.id);
                    this.updateSettings({
                        ...this.settings,
                        prompts,
                    });
                });
                actions.appendChild(deleteButton);
            }

            row.append(dragHandle, main, actions);
            list.appendChild(row);
        }

        const addButton = document.createElement('button');
        addButton.type = 'button';
        addButton.className = 'secondary-btn secondary-btn--compact';
        addButton.dataset.action = 'add-prompt';
        addButton.append(createIcon(plusIcon), document.createTextNode(this.params.labels.addPrompt));
        addButton.addEventListener('click', () => {
            this.openEditor({
                id: this.params!.createPromptId(),
                title: this.params!.labels.untitledPrompt,
                content: '',
            }, true);
        });
        const body = document.createElement('div');
        body.className = 'dialog-body dialog-body--reader-settings';
        body.append(list);
        const footer = document.createElement('div');
        footer.className = 'panel-footer panel-footer--reader-settings';
        const restoreButton = document.createElement('button');
        restoreButton.type = 'button';
        restoreButton.className = 'secondary-btn secondary-btn--compact';
        restoreButton.dataset.action = 'restore-default-prompts';
        restoreButton.textContent = this.params.labels.restoreDefaults;
        restoreButton.addEventListener('click', async () => {
            const params = this.params;
            const settings = this.settings;
            if (!params || !settings) return;
            const ok = await params.onConfirmRestoreDefaults();
            if (!ok) return;
            if (!this.settings) return;
            this.updateSettings({
                ...this.settings,
                prompts: params.onRestoreDefaults(),
            });
        });
        footer.append(restoreButton, addButton);
        popover.append(header, body, footer);
    }

    private renderEdit(popover: HTMLElement): void {
        if (!this.params || !this.editState) return;
        this.stopDrag();
        const header = this.createHeader(this.editState.isNew ? this.params.labels.addPrompt : this.params.labels.editPrompt, true);
        const body = document.createElement('div');
        body.className = 'dialog-body dialog-body--reader-settings';
        const footer = document.createElement('div');
        footer.className = 'panel-footer panel-footer--reader-settings';
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
                prompts,
            });
            this.showList();
        });
        actions.append(cancel, save);

        body.append(titleField, contentField);
        footer.append(actions);
        popover.append(header, body, footer);
        titleInput.focus({ preventScroll: true } as FocusOptions);
    }

    private createHeader(titleText: string, withBack = false): HTMLElement {
        const header = document.createElement('div');
        header.className = 'panel-header';
        const meta = document.createElement('div');
        meta.className = 'panel-header__meta';
        const title = document.createElement('h2');
        title.className = 'reader-settings-dialog__title';
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
            const icon = document.createElement('span');
            icon.className = 'reader-settings-dialog__title-icon';
            icon.appendChild(createIcon(messageSquareTextIcon));
            title.appendChild(icon);
        }
        const text = document.createElement('span');
        text.textContent = titleText;
        title.appendChild(text);
        const actions = document.createElement('div');
        actions.className = 'panel-header__actions';
        const close = document.createElement('button');
        close.type = 'button';
        close.className = 'icon-btn reader-settings-dialog__close';
        close.dataset.action = 'close';
        close.setAttribute('aria-label', this.params?.labels.close ?? 'Close');
        close.appendChild(createIcon(xIcon));
        close.addEventListener('click', () => {
            const onClose = this.params?.onClose;
            this.close();
            onClose?.();
        });
        meta.appendChild(title);
        actions.appendChild(close);
        header.append(meta, actions);
        return header;
    }

    private openEditor(prompt: ReaderCommentPrompt, isNew: boolean): void {
        this.view = 'edit';
        this.editState = { isNew, prompt: { ...prompt } };
        this.render();
    }

    private showList(): void {
        this.stopDrag();
        this.view = 'list';
        this.editState = null;
        this.render();
    }

    private startDrag(event: PointerEvent, promptId: string): void {
        if (!this.settings || this.settings.prompts.length < 2) return;
        event.preventDefault();
        event.stopPropagation();
        this.stopDrag();
        this.dragState = {
            promptId,
            pointerId: event.pointerId,
        };
        this.findPromptRow(promptId)?.setAttribute('data-dragging', '1');
        this.onDocumentPointerMove = (moveEvent) => this.handleDragMove(moveEvent);
        this.onDocumentPointerUp = (upEvent) => {
            if (upEvent.pointerId !== this.dragState?.pointerId) return;
            this.stopDrag();
        };
        document.addEventListener('pointermove', this.onDocumentPointerMove);
        document.addEventListener('pointerup', this.onDocumentPointerUp);
        document.addEventListener('pointercancel', this.onDocumentPointerUp);
    }

    private handleDragMove(event: PointerEvent): void {
        if (!this.settings || !this.dragState || event.pointerId !== this.dragState.pointerId) return;
        event.preventDefault();
        const rows = Array.from(this.rootEl?.querySelectorAll<HTMLElement>('.reader-prompt-settings__row') ?? []);
        if (rows.length < 2) return;
        const current = this.settings.prompts;
        const draggedId = this.dragState.promptId;
        const nextOrder = current.filter((prompt) => prompt.id !== draggedId);
        let insertIndex = nextOrder.length;
        const candidateRows = rows.filter((row) => row.dataset.promptId !== draggedId);
        for (let index = 0; index < candidateRows.length; index += 1) {
            const rect = candidateRows[index]!.getBoundingClientRect();
            if (event.clientY < rect.top + rect.height / 2) {
                insertIndex = index;
                break;
            }
        }
        const reordered = [...nextOrder];
        const moved = current.find((prompt) => prompt.id === draggedId);
        if (!moved) return;
        reordered.splice(insertIndex, 0, moved);
        if (reordered.every((prompt, index) => prompt.id === current[index]?.id)) return;
        const beforeRects = this.captureRowRects();
        this.updateSettings({
            ...this.settings,
            prompts: reordered,
        });
        this.animateRowLayout(beforeRects);
        this.findPromptRow(draggedId)?.setAttribute('data-dragging', '1');
    }

    private captureRowRects(): Map<string, DOMRect> {
        const rects = new Map<string, DOMRect>();
        this.rootEl?.querySelectorAll<HTMLElement>('.reader-prompt-settings__row').forEach((row) => {
            const id = row.dataset.promptId;
            if (!id) return;
            rects.set(id, row.getBoundingClientRect());
        });
        return rects;
    }

    private animateRowLayout(beforeRects: Map<string, DOMRect>): void {
        window.requestAnimationFrame(() => {
            this.rootEl?.querySelectorAll<HTMLElement>('.reader-prompt-settings__row').forEach((row) => {
                const id = row.dataset.promptId;
                if (!id) return;
                const before = beforeRects.get(id);
                if (!before) return;
                const after = row.getBoundingClientRect();
                const dy = before.top - after.top;
                if (!dy) return;
                row.style.transition = 'none';
                row.style.transform = `translateY(${dy}px)`;
                window.requestAnimationFrame(() => {
                    row.style.transition = '';
                    row.style.transform = '';
                });
            });
        });
    }

    private stopDrag(): void {
        this.rootEl?.querySelectorAll<HTMLElement>('.reader-prompt-settings__row[data-dragging="1"]').forEach((row) => {
            delete row.dataset.dragging;
        });
        this.dragState = null;
        if (this.onDocumentPointerMove) {
            document.removeEventListener('pointermove', this.onDocumentPointerMove);
            this.onDocumentPointerMove = null;
        }
        if (this.onDocumentPointerUp) {
            document.removeEventListener('pointerup', this.onDocumentPointerUp);
            document.removeEventListener('pointercancel', this.onDocumentPointerUp);
            this.onDocumentPointerUp = null;
        }
    }

    private findPromptRow(promptId: string): HTMLElement | null {
        return Array.from(this.rootEl?.querySelectorAll<HTMLElement>('.reader-prompt-settings__row') ?? [])
            .find((row) => row.dataset.promptId === promptId) ?? null;
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
            prompts: settings.prompts.map((prompt) => ({ ...prompt })),
            template: settings.template.map((segment) => ({ ...segment })),
        };
    }
}
