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
    type CommentTemplateSegment,
    type ReaderCommentExportSettings,
} from '../../../core/settings/readerCommentExport';
import { normalizeReaderBodyFontSizePx, normalizeReaderContentMaxWidthPx } from '../../../core/settings/migrations';
import { buildCommentsExport, normalizeCommentTemplate, normalizeReaderCommentExportSettings } from '../../../services/reader/commentExport';
import { minusIcon, plusIcon, settingsIcon } from '../../../assets/icons';
import { createIcon } from '../components/Icon';
import { t } from '../components/i18n';
import type { ModalHost } from '../components/ModalHost';
import { getDefaultSurfaceMotionProfile, SurfaceSession } from '../components/SurfaceRuntime';
import { createReaderSettingsDialogShell } from './ReaderSettingsDialogShell';
import { ReaderCommentTemplateSettingsPopover } from './ReaderCommentTemplateSettingsPopover';

type ReaderSettingsPatch = Partial<AppSettings['reader']>;

type OpenParams = {
    parent: HTMLElement;
    opener?: HTMLElement;
    modalHost: ModalHost;
    settings: AppSettings['reader'];
    onChange: (patch: ReaderSettingsPatch) => Promise<void> | void;
    onPreview: (patch: ReaderSettingsPatch) => void;
    onOpenPromptManager?: (anchor: HTMLElement) => Promise<void> | void;
    onClose?: () => void;
};

export class ReaderSettingsPopover {
    private rootEl: HTMLElement | null = null;
    private session: SurfaceSession | null = null;
    private params: OpenParams | null = null;
    private settings: AppSettings['reader'] | null = null;
    private readonly templateSettingsPopover = new ReaderCommentTemplateSettingsPopover();

    isOpen(): boolean {
        return Boolean(this.rootEl);
    }

    close(): void {
        this.templateSettingsPopover.close();
        if (!this.rootEl) return;
        this.rootEl.remove();
        this.rootEl = null;
        this.session?.restoreFocus(document);
        this.session?.destroy();
        this.session = null;
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

        const session = new SurfaceSession({
            profile: 'panel',
            responsiveProfile: {
                viewportGutterPx: 16,
                maxWidthCss: 'min(920px, calc(100% - (var(--aimd-space-4) * 2)))',
                maxHeightCss: 'calc(100% - (var(--aimd-space-4) * 2))',
                collision: 'clamp',
                scrollOwner: 'content',
                narrowFallback: 'fullscreen',
            },
            motionProfile: getDefaultSurfaceMotionProfile('panel'),
        });
        this.session = session;
        session.captureFocus(params.opener);
        session.syncEscapeScope({
            root: shell.panel,
            trapTabWithin: shell.panel,
            stopPropagationAll: true,
            ignoreEscapeWhileComposing: true,
            onEscape: close,
        });

        this.render(shell.body, shell.footer);
        session.scheduleInitialFocus({ surface: shell.panel, selectors: ['[data-action="close"]'] });
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
            this.createCommentSortModeRow(settings),
            this.createActionRow(
                t('readerCommentPromptListLabel'),
                this.formatPromptSummary(settings.commentExport),
                (anchor) => this.openPromptSettings(anchor),
                t('btnEdit'),
                'reader-settings-prompt-manager',
            ),
            this.createActionRow(
                t('readerCommentTemplateSettingsLabel'),
                this.formatTemplateSummary(settings.commentExport.template),
                (anchor) => this.openTemplateSettings(anchor),
                t('btnEdit'),
                'reader-settings-comment-template',
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

    private createCommentSortModeRow(settings: AppSettings['reader']): HTMLElement {
        const row = this.createBaseRow(t('readerCommentSortModeLabel'), t('readerCommentSortModeDesc'));
        const control = document.createElement('div');
        control.className = 'reader-settings-segmented';
        const modes: Array<ReaderCommentExportSettings['sortMode']> = ['created', 'position'];
        for (const mode of modes) {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'reader-settings-segmented__button';
            button.dataset.active = settings.commentExport.sortMode === mode ? '1' : '0';
            button.textContent = mode === 'position' ? t('readerCommentSortPosition') : t('readerCommentSortCreated');
            button.addEventListener('click', () => this.updateCommentExport({ ...settings.commentExport, sortMode: mode }));
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
        const control = document.createElement('div');
        control.className = 'reader-settings-slider-field';
        const input = document.createElement('input');
        input.className = 'reader-settings-slider';
        input.type = 'range';
        input.min = String(MIN_READER_CONTENT_MAX_WIDTH_PX);
        input.max = String(MAX_READER_CONTENT_MAX_WIDTH_PX);
        input.step = String(READER_CONTENT_MAX_WIDTH_STEP_PX);
        input.dataset.role = 'reader-settings-content-width';
        const value = document.createElement('span');
        value.className = 'reader-settings-slider__value';
        value.dataset.role = 'reader-settings-content-width-value';
        const syncValue = (nextValue?: number) => {
            const next = nextValue ?? normalizeReaderContentMaxWidthPx(input.value);
            input.value = String(next);
            value.textContent = `${next}px`;
        };
        syncValue(settings.contentMaxWidthPx ?? DEFAULT_READER_CONTENT_MAX_WIDTH_PX);
        input.addEventListener('input', () => {
            const next = normalizeReaderContentMaxWidthPx(input.value);
            value.textContent = `${next}px`;
        });
        input.addEventListener('change', () => {
            const next = normalizeReaderContentMaxWidthPx(input.value);
            syncValue(next);
            void this.applyPatch({ contentMaxWidthPx: next });
        });
        control.append(input, value);
        row.appendChild(control);
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

    private createActionRow(labelText: string, desc: string, onClick: (anchor: HTMLElement) => void, actionLabel = t('btnEdit'), action?: string): HTMLElement {
        const row = this.createBaseRow(labelText, desc);
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'secondary-btn secondary-btn--compact';
        if (action) button.dataset.action = action;
        button.textContent = actionLabel;
        button.addEventListener('click', () => onClick(button));
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

    private openPromptSettings(anchor?: HTMLElement): void {
        if (!this.rootEl || !this.params || !this.settings) return;
        if (anchor && this.params.onOpenPromptManager) {
            void this.params.onOpenPromptManager(anchor);
        }
    }

    private openTemplateSettings(opener?: HTMLElement): void {
        if (!this.rootEl || !this.settings) return;
        const current = this.settings.commentExport;
        this.templateSettingsPopover.open({
            parent: this.rootEl,
            opener,
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
                sortMode: commentExport.sortMode,
            },
        );
    }

    private formatPromptSummary(commentExport: ReaderCommentExportSettings): string {
        void commentExport;
        return t('readerCommentPromptListDesc');
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

}
