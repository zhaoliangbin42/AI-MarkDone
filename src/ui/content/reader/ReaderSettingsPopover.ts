import {
    DEFAULT_READER_BODY_FONT_SIZE_PX,
    DEFAULT_READER_CONTENT_MAX_WIDTH_PX,
    DEFAULT_READER_OPEN_MODE,
    MAX_READER_BODY_FONT_SIZE_PX,
    MAX_READER_CONTENT_MAX_WIDTH_PX,
    MIN_READER_BODY_FONT_SIZE_PX,
    MIN_READER_CONTENT_MAX_WIDTH_PX,
    READER_BODY_FONT_SIZE_STEP_PX,
    READER_CONTENT_MAX_WIDTH_STEP_PX,
    type AppSettings,
} from '../../../core/settings/types';
import {
    createDefaultCommentTemplate,
    createDefaultReaderCommentPrompts,
    type CommentTemplateSegment,
    type ReaderCommentExportSettings,
} from '../../../core/settings/readerCommentExport';
import { normalizeReaderBodyFontSizePx, normalizeReaderContentMaxWidthPx } from '../../../core/settings/migrations';
import { buildCommentsExport, normalizeCommentTemplate, normalizeReaderCommentExportSettings } from '../../../services/reader/commentExport';
import { minusIcon, plusIcon, settingsIcon } from '../../../assets/icons';
import { createIcon } from '../components/Icon';
import { t } from '../components/i18n';
import type { ModalHost } from '../components/ModalHost';
import { createReaderSettingsDialogShell } from './ReaderSettingsDialogShell';
import { ReaderPromptSettingsPopover } from './ReaderPromptSettingsPopover';
import { ReaderCommentTemplateSettingsPopover } from './ReaderCommentTemplateSettingsPopover';

type ReaderSettingsPatch = Partial<AppSettings['reader']>;

type OpenParams = {
    parent: HTMLElement;
    modalHost: ModalHost;
    settings: AppSettings['reader'];
    onChange: (patch: ReaderSettingsPatch) => Promise<void> | void;
    onPreview: (patch: ReaderSettingsPatch) => void;
    onClose?: () => void;
};

export class ReaderSettingsPopover {
    private rootEl: HTMLElement | null = null;
    private params: OpenParams | null = null;
    private settings: AppSettings['reader'] | null = null;
    private onWindowKeyDown: ((event: KeyboardEvent) => void) | null = null;
    private readonly promptSettingsPopover = new ReaderPromptSettingsPopover();
    private readonly templateSettingsPopover = new ReaderCommentTemplateSettingsPopover();

    isOpen(): boolean {
        return Boolean(this.rootEl);
    }

    close(): void {
        this.promptSettingsPopover.close();
        this.templateSettingsPopover.close();
        if (!this.rootEl) return;
        this.detachWindowKeyDown();
        this.rootEl.remove();
        this.rootEl = null;
        this.params = null;
        this.settings = null;
    }

    open(params: OpenParams): void {
        this.close();
        this.params = params;
        this.settings = this.cloneSettings(params.settings);

        const shell = createReaderSettingsDialogShell({
            parent: params.parent,
            title: t('readerSettingsLabel'),
            closeLabel: t('btnClose'),
            panelClassNames: ['reader-settings-popover--display'],
        });
        this.rootEl = shell.layer;
        shell.title.textContent = '';
        const titleIcon = document.createElement('span');
        titleIcon.className = 'reader-settings-dialog__title-icon';
        titleIcon.appendChild(createIcon(settingsIcon));
        const titleText = document.createElement('span');
        titleText.textContent = t('readerSettingsLabel');
        shell.title.append(titleIcon, titleText);

        const close = () => {
            this.close();
            params.onClose?.();
        };
        shell.closeButton.addEventListener('click', close);
        shell.panel.addEventListener('keydown', (event) => event.stopPropagation());
        this.onWindowKeyDown = (event: KeyboardEvent) => {
            if (event.key !== 'Escape') return;
            event.preventDefault();
            event.stopPropagation();
            close();
        };
        window.addEventListener('keydown', this.onWindowKeyDown, { capture: true });

        this.render(shell.body, shell.footer);
    }

    updateSettings(settings: AppSettings['reader']): void {
        this.settings = this.cloneSettings(settings);
        if (!this.rootEl) return;
        const body = this.rootEl.querySelector<HTMLElement>('.dialog-body--reader-settings');
        const footer = this.rootEl.querySelector<HTMLElement>('.panel-footer--reader-settings');
        if (body) this.render(body, footer ?? undefined);
    }

    private render(body: HTMLElement, footer?: HTMLElement): void {
        const settings = this.settings;
        if (!settings) return;
        body.replaceChildren();
        footer?.replaceChildren();
        body.append(
            this.createOpenModeRow(settings),
            this.createFontSizeRow(settings),
            this.createContentWidthRow(settings),
            this.createActionRow(
                t('readerDetachedNoticeResetLabel'),
                t('readerDetachedNoticeResetDesc'),
                () => this.applyPatch({ detachedNoticeConfirmed: false }),
                t('btnReset'),
                'reader-settings-detached-notice-reset',
            ),
            this.createToggleRow(
                t('renderCodeBlocksLabel'),
                t('renderCodeBlocksDesc'),
                settings.renderCodeInReader,
                (checked) => this.applyPatch({ renderCodeInReader: checked }),
            ),
            this.createToggleRow(
                t('readerOutlineToggleLabel'),
                t('readerOutlineToggleDesc'),
                settings.showOutlineInReader,
                (checked) => this.applyPatch({ showOutlineInReader: checked }),
            ),
            this.createToggleRow(
                t('readerCommentPromptPositionBottomLabel'),
                t('readerCommentPromptPositionBottomDesc'),
                settings.commentExport.promptPosition === 'bottom',
                (checked) => this.updateCommentExport({ ...settings.commentExport, promptPosition: checked ? 'bottom' : 'top' }),
            ),
            this.createActionRow(
                t('readerCommentPromptListLabel'),
                this.formatPromptSummary(settings.commentExport),
                () => this.openPromptSettings(),
            ),
            this.createActionRow(
                t('readerCommentTemplateSettingsLabel'),
                this.formatTemplateSummary(settings.commentExport.template),
                () => this.openTemplateSettings(),
            ),
        );

        footer?.remove();
    }

    private createOpenModeRow(settings: AppSettings['reader']): HTMLElement {
        const row = this.createBaseRow(t('readerDefaultOpenModeLabel'), t('readerDefaultOpenModeDesc'));
        const control = document.createElement('div');
        control.className = 'reader-settings-segmented';
        const modes: Array<AppSettings['reader']['defaultOpenMode']> = ['fullscreen', 'panel'];
        for (const mode of modes) {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'reader-settings-segmented__button';
            button.dataset.active = settings.defaultOpenMode === mode ? '1' : '0';
            button.textContent = mode === 'fullscreen' ? t('readerOpenModeFullscreen') : t('readerOpenModePanel');
            button.addEventListener('click', () => this.applyPatch({ defaultOpenMode: mode }));
            control.appendChild(button);
        }
        row.appendChild(control);
        return row;
    }

    private createFontSizeRow(settings: AppSettings['reader']): HTMLElement {
        const row = this.createBaseRow(t('readerBodyFontSizeLabel'), t('readerBodyFontSizeDesc'));
        const control = document.createElement('div');
        control.className = 'reader-settings-stepper';
        const decrease = document.createElement('button');
        decrease.type = 'button';
        decrease.className = 'icon-btn';
        decrease.dataset.action = 'reader-settings-font-decrease';
        decrease.appendChild(createIcon(minusIcon));
        const value = document.createElement('span');
        value.className = 'reader-settings-stepper__value';
        value.dataset.role = 'reader-settings-body-font-size-value';
        value.textContent = `${settings.bodyFontSizePx ?? DEFAULT_READER_BODY_FONT_SIZE_PX}px`;
        const increase = document.createElement('button');
        increase.type = 'button';
        increase.className = 'icon-btn';
        increase.dataset.action = 'reader-settings-font-increase';
        increase.appendChild(createIcon(plusIcon));
        decrease.addEventListener('click', () => this.updateBodyFontSize(-READER_BODY_FONT_SIZE_STEP_PX));
        increase.addEventListener('click', () => this.updateBodyFontSize(READER_BODY_FONT_SIZE_STEP_PX));
        control.append(decrease, value, increase);
        row.appendChild(control);
        return row;
    }

    private createContentWidthRow(settings: AppSettings['reader']): HTMLElement {
        const row = this.createBaseRow(t('readerContentWidthLabel'), t('readerContentWidthDesc'));
        const input = document.createElement('input');
        input.className = 'reader-settings-number-input';
        input.type = 'number';
        input.min = String(MIN_READER_CONTENT_MAX_WIDTH_PX);
        input.max = String(MAX_READER_CONTENT_MAX_WIDTH_PX);
        input.step = String(READER_CONTENT_MAX_WIDTH_STEP_PX);
        input.value = String(settings.contentMaxWidthPx ?? DEFAULT_READER_CONTENT_MAX_WIDTH_PX);
        input.dataset.role = 'reader-settings-content-width';
        input.addEventListener('change', () => {
            const next = normalizeReaderContentMaxWidthPx(input.value);
            input.value = String(next);
            void this.applyPatch({ contentMaxWidthPx: next });
        });
        row.appendChild(input);
        return row;
    }

    private createToggleRow(labelText: string, desc: string, checked: boolean, onChange: (checked: boolean) => void): HTMLElement {
        const row = this.createBaseRow(labelText, desc);
        const label = document.createElement('label');
        label.className = 'reader-settings-toggle';
        const input = document.createElement('input');
        input.type = 'checkbox';
        input.checked = checked;
        input.addEventListener('change', () => onChange(input.checked));
        const knob = document.createElement('span');
        knob.className = 'reader-settings-toggle__track';
        label.append(input, knob);
        row.appendChild(label);
        return row;
    }

    private createActionRow(labelText: string, desc: string, onClick: () => void, actionLabel = t('btnEdit'), action?: string): HTMLElement {
        const row = this.createBaseRow(labelText, desc);
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'secondary-btn secondary-btn--compact';
        if (action) button.dataset.action = action;
        button.textContent = actionLabel;
        button.addEventListener('click', onClick);
        row.appendChild(button);
        return row;
    }

    private createBaseRow(labelText: string, desc: string): HTMLElement {
        const row = document.createElement('div');
        row.className = 'reader-settings-row';
        const info = document.createElement('div');
        info.className = 'reader-settings-row__info';
        const label = document.createElement('strong');
        label.textContent = labelText;
        const description = document.createElement('p');
        description.textContent = desc;
        info.append(label, description);
        row.appendChild(info);
        return row;
    }

    private updateBodyFontSize(delta: number): void {
        const current = this.settings?.bodyFontSizePx ?? DEFAULT_READER_BODY_FONT_SIZE_PX;
        const next = normalizeReaderBodyFontSizePx(current + delta);
        if (next < MIN_READER_BODY_FONT_SIZE_PX || next > MAX_READER_BODY_FONT_SIZE_PX) return;
        void this.applyPatch({ bodyFontSizePx: next });
    }

    private async updateCommentExport(next: ReaderCommentExportSettings): Promise<void> {
        await this.applyPatch({ commentExport: normalizeReaderCommentExportSettings(next) });
    }

    private async applyPatch(patch: ReaderSettingsPatch): Promise<void> {
        if (!this.params || !this.settings) return;
        const next = this.cloneSettings({ ...this.settings, ...patch });
        if (patch.commentExport) next.commentExport = normalizeReaderCommentExportSettings(patch.commentExport);
        if (patch.defaultOpenMode) next.defaultOpenMode = patch.defaultOpenMode === 'panel' ? 'panel' : DEFAULT_READER_OPEN_MODE;
        if (typeof patch.bodyFontSizePx !== 'undefined') next.bodyFontSizePx = normalizeReaderBodyFontSizePx(patch.bodyFontSizePx);
        if (typeof patch.contentMaxWidthPx !== 'undefined') next.contentMaxWidthPx = normalizeReaderContentMaxWidthPx(patch.contentMaxWidthPx);
        this.settings = next;
        this.params.onPreview(patch);
        await this.params.onChange(patch);
        this.updateSettings(next);
    }

    private openPromptSettings(): void {
        if (!this.rootEl || !this.params || !this.settings) return;
        this.promptSettingsPopover.open({
            parent: this.rootEl,
            settings: this.settings.commentExport,
            labels: {
                title: t('readerCommentPromptListLabel'),
                close: t('btnClose'),
                addPrompt: t('readerCommentPromptAdd'),
                restoreDefaults: t('readerCommentPromptRestoreDefaults'),
                editPrompt: t('readerCommentPromptEdit'),
                untitledPrompt: t('readerCommentPromptUntitled'),
                back: t('btnBack'),
                titleLabel: t('readerCommentPromptTitleLabel'),
                contentLabel: t('readerCommentPromptContentLabel'),
                titlePlaceholder: t('readerCommentPromptTitlePlaceholder'),
                contentPlaceholder: t('readerCommentPromptContentPlaceholder'),
                empty: t('readerCommentPromptEmpty'),
                save: t('btnSave'),
                cancel: t('btnCancel'),
                delete: t('btnDelete'),
            },
            createPromptId: () => `prompt_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
            onChange: (next) => void this.updateCommentExport(next),
            onConfirmDelete: () => this.params!.modalHost.confirm({
                kind: 'warning',
                title: t('readerCommentPromptDeleteTitle'),
                message: t('readerCommentPromptDeleteMessage'),
                confirmText: t('btnDelete'),
                cancelText: t('btnCancel'),
            }),
            onConfirmRestoreDefaults: () => this.params!.modalHost.confirm({
                kind: 'warning',
                title: t('readerCommentPromptRestoreDefaultsTitle'),
                message: t('readerCommentPromptRestoreDefaultsMessage'),
                confirmText: t('readerCommentPromptRestoreDefaults'),
                cancelText: t('btnCancel'),
            }),
            onRestoreDefaults: () => createDefaultReaderCommentPrompts(),
        });
    }

    private openTemplateSettings(): void {
        if (!this.rootEl || !this.settings) return;
        const current = this.settings.commentExport;
        this.templateSettingsPopover.open({
            parent: this.rootEl,
            template: current.template,
            preview: this.buildTemplatePreview(current.template),
            labels: {
                title: t('readerCommentTemplateSettingsLabel'),
                close: t('btnClose'),
                template: t('readerCommentTemplate'),
                templateHint: t('readerCommentTemplateHint'),
                templatePlaceholder: t('readerCommentTemplatePlaceholder'),
                insertPlaceholder: t('readerCommentTemplateInsertPlaceholder'),
                insertSelectedSource: t('readerCommentTemplateInsertSelectedSource'),
                insertUserComment: t('readerCommentTemplateInsertUserComment'),
                tokenSelectedSource: t('readerCommentTemplateTokenSelectedSource'),
                tokenUserComment: t('readerCommentTemplateTokenUserComment'),
                preview: t('readerCommentTemplatePreviewLabel'),
                restoreDefault: t('readerCommentTemplateRestoreDefault'),
                save: t('btnSave'),
                cancel: t('btnCancel'),
                copied: t('btnCopied'),
            },
            onBuildPreview: (template) => this.buildTemplatePreview(template),
            onRestoreDefault: () => createDefaultCommentTemplate(),
            onSave: (template) => {
                void this.updateCommentExport({ ...current, template });
            },
        });
    }

    private buildTemplatePreview(template: CommentTemplateSegment[]): string {
        const commentExport = this.settings?.commentExport ?? normalizeReaderCommentExportSettings(undefined);
        return buildCommentsExport(
            [
                {
                    id: 'preview-comment-1',
                    itemId: 'preview-item',
                    quoteText: 'quote',
                    sourceMarkdown: '`sample_source()`',
                    comment: 'Needs clarification.',
                    selectors: { textQuote: { exact: '', prefix: '', suffix: '' }, textPosition: { start: 0, end: 0 }, domRange: null, atomicRefs: [] },
                    createdAt: 1,
                    updatedAt: 1,
                },
                {
                    id: 'preview-comment-2',
                    itemId: 'preview-item',
                    quoteText: 'quote',
                    sourceMarkdown: '**another sample**',
                    comment: 'Consider tightening this wording.',
                    selectors: { textQuote: { exact: '', prefix: '', suffix: '' }, textPosition: { start: 0, end: 0 }, domRange: null, atomicRefs: [] },
                    createdAt: 2,
                    updatedAt: 2,
                },
            ],
            {
                userPrompt: commentExport.prompts[0]?.content ?? '',
                promptPosition: commentExport.promptPosition,
                commentTemplate: template,
            },
        );
    }

    private formatPromptSummary(commentExport: ReaderCommentExportSettings): string {
        const first = commentExport.prompts[0];
        if (!first) return t('readerCommentPromptListDesc');
        return `${first.title} · ${commentExport.prompts.length}`;
    }

    private formatTemplateSummary(template: CommentTemplateSegment[]): string {
        const normalized = normalizeCommentTemplate(template)
            .map((segment) => segment.type === 'text' ? segment.value : segment.key === 'selected_source' ? t('readerCommentTemplateTokenSelectedSource') : t('readerCommentTemplateTokenUserComment'))
            .join(' ')
            .replace(/\s+/g, ' ')
            .trim();
        return normalized || t('readerCommentTemplateSettingsDesc');
    }

    private cloneSettings(settings: AppSettings['reader']): AppSettings['reader'] {
        return {
            renderCodeInReader: Boolean(settings.renderCodeInReader),
            showOutlineInReader: Boolean(settings.showOutlineInReader),
            defaultOpenMode: settings.defaultOpenMode === 'panel' ? 'panel' : DEFAULT_READER_OPEN_MODE,
            panelSizeRatio: {
                widthRatio: Number.isFinite(settings.panelSizeRatio?.widthRatio) ? settings.panelSizeRatio.widthRatio : 0.72,
                heightRatio: Number.isFinite(settings.panelSizeRatio?.heightRatio) ? settings.panelSizeRatio.heightRatio : 0.82,
            },
            bodyFontSizePx: normalizeReaderBodyFontSizePx(settings.bodyFontSizePx),
            detachedNoticeConfirmed: Boolean(settings.detachedNoticeConfirmed),
            contentMaxWidthPx: normalizeReaderContentMaxWidthPx(settings.contentMaxWidthPx),
            commentExport: normalizeReaderCommentExportSettings(settings.commentExport),
        };
    }

    private detachWindowKeyDown(): void {
        if (!this.onWindowKeyDown) return;
        window.removeEventListener('keydown', this.onWindowKeyDown, { capture: true } as any);
        this.onWindowKeyDown = null;
    }
}
