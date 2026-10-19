import type { Theme } from '../../../core/types/theme';
import { DEFAULT_CONTENT_CLEANUP_SETTINGS, type ContentCleanupSettings } from '../../../core/settings/content';
import {
    DEFAULT_EXPORT_SETTINGS,
    resolvePngExportPixelRatio,
    resolvePngExportWidth,
    type ExportSettings,
} from '../../../core/settings/export';
import {
    DEFAULT_FORMULA_SOURCE_FORMAT,
    normalizeFormulaSourceFormat,
    type FormulaSourceFormat,
} from '../../../core/math/formulaSourceFormat';
import type { SiteAdapter } from '../../../drivers/content/adapters/base';
import type { ConversationContentSourceV1 } from '../../../contracts/conversationContent';
import type { ConversationMaterializationPortV1, ConversationTargetV1 } from '../../../contracts/conversationMaterialization';
import { freezeRichBlocks } from '../../../contracts/richContent';
import { buildConversationMetadata } from '../../../drivers/content/conversation/metadata';
import { subscribeLocaleChange, t } from '../components/i18n';
import type { ChatTurn, ExportProgressEvent, TranslateFn, SaveFormat } from '../../../services/export/saveMessagesTypes';
import {
    exportTurnsMarkdown,
    exportTurnsMarkdownZip,
    exportTurnsPdf,
    exportTurnsPng,
    type ExportOptions,
} from '../../../services/export/saveMessagesFacade';
import { showToast } from '../../../utils/toast';
import {
    collectFreshReaderContent,
    readerItemsToChatTurns,
} from '../../../services/reader/readerContentSource';
import type { ReaderItem } from '../../../services/reader/types';
import { getSaveMessagesDialogCss } from './saveMessagesDialogCss';
import { xIcon } from '../../../assets/icons';
import { createBookmarksInlineSelectControl, type BookmarksInlineSelectRef } from '../bookmarks/ui/components/BookmarksInlineSelect';
import { OverlaySession } from '../overlay/OverlaySession';
import { TooltipDelegate } from '../../../utils/tooltip';
import { createIcon } from '../components/Icon';
import { ensureBackdropElement, ensureStableElementFromHtml } from '../components/stableSurface';
import { SurfaceFocusLifecycle } from '../components/surfaceFocusLifecycle';
import {
    areAppearanceSnapshotsEqual,
    createAppearanceSnapshot,
    type AppearanceSnapshot,
} from '../../../style/appearance';
import {
    presentImageExportProgress,
    retainMonotonicImageExportProgress,
} from './imageExportProgressPresentation';

type State = {
    format: SaveFormat;
    selected: Set<number>;
    saving: boolean;
    turnsCount: number;
    progressText: string;
    progressValue: number | null;
    renderProgressText: string;
    renderProgressValue: number | null;
    visuals: 'include' | 'placeholder';
    resultText: string;
};

export class SaveMessagesDialog {
    private overlaySession: OverlaySession | null = null;
    private exportSelects: BookmarksInlineSelectRef[] = [];
    private adapter: SiteAdapter | null = null;
    private turns: ChatTurn[] = [];
    private contentCleanup: ContentCleanupSettings = DEFAULT_CONTENT_CLEANUP_SETTINGS;
    private metadata: { url: string; exportedAt: string; title: string; count: number; platform: string } | null = null;
    private tooltipDelegate: TooltipDelegate | null = null;
    private unsubscribeLocale: (() => void) | null = null;
    private exportT: TranslateFn = (key, args) => {
        if (args === undefined) return t(key);
        if (Array.isArray(args)) return t(key, args.map((x) => String(x)));
        return t(key, String(args));
    };
    private resolvedPngWidth = resolvePngExportWidth(DEFAULT_EXPORT_SETTINGS);
    private resolvedPngPixelRatio = resolvePngExportPixelRatio(DEFAULT_EXPORT_SETTINGS);
    private markdownFormulaFormat: FormulaSourceFormat = DEFAULT_FORMULA_SOURCE_FORMAT;
    private appearance: AppearanceSnapshot = createAppearanceSnapshot('light');

    private state: State = {
        format: 'markdown',
        selected: new Set(),
        saving: false,
        turnsCount: 0,
        progressText: '',
        progressValue: null,
        renderProgressText: '',
        renderProgressValue: null,
        visuals: 'include',
        resultText: '',
    };
    private closing = false;
    private motionNeedsOpen = false;
    private readonly focusLifecycle = new SurfaceFocusLifecycle();
    private exportAbort: AbortController | null = null;
    private operationGeneration = 0;

    isOpen(): boolean {
        return Boolean(this.overlaySession);
    }

    setExportSettings(settings: ExportSettings): void {
        this.resolvedPngWidth = resolvePngExportWidth(settings);
        this.resolvedPngPixelRatio = resolvePngExportPixelRatio(settings);
    }

    setContentCleanupSettings(settings: ContentCleanupSettings): void {
        this.contentCleanup = { ...settings };
    }

    setMarkdownFormulaFormat(format: FormulaSourceFormat): void {
        this.markdownFormulaFormat = normalizeFormulaSourceFormat(format);
    }

    setAppearance(snapshot: AppearanceSnapshot): void {
        if (areAppearanceSnapshotsEqual(this.appearance, snapshot)) return;
        this.appearance = snapshot;
        this.overlaySession?.setAppearance(snapshot);
    }

    async open(
        adapter: SiteAdapter,
        theme: Theme,
        options?: {
            conversationContentSource?: ConversationContentSourceV1 | null;
            conversationMaterialization?: ConversationMaterializationPortV1 | null;
            conversationTarget?: ConversationTargetV1 | null;
            startMessageElement?: HTMLElement | null;
            currentReaderItem?: ReaderItem | null;
        }
    ): Promise<boolean> {
        const generation = ++this.operationGeneration;
        this.exportAbort?.abort();
        this.exportAbort = null;
        this.focusLifecycle.capture();
        this.adapter = adapter;
        this.setAppearance(createAppearanceSnapshot(theme, this.appearance.overrides));

        const readerOptions: Parameters<typeof collectFreshReaderContent>[2] = {};
        if (options?.conversationContentSource) {
            readerOptions.conversationContentSource = options.conversationContentSource;
        }
        if (options?.conversationMaterialization) {
            readerOptions.conversationMaterialization = options.conversationMaterialization;
        }
        if (options?.conversationTarget) {
            readerOptions.conversationTarget = options.conversationTarget;
        }
        const content = await collectFreshReaderContent(
            adapter,
            options?.startMessageElement ?? null,
            readerOptions,
        );
        const items = content.items.length > 0
            ? content.items
            : !options?.conversationContentSource && options?.currentReaderItem
                ? [options.currentReaderItem]
                : [];
        const startIndex = content.items.length > 0 ? content.startIndex : 0;
        if (adapter.getPlatformId() === 'chatgpt' && options?.conversationContentSource && items.length === 0) {
            this.adapter = null;
            this.focusLifecycle.restore(document);
            return false;
        }
        const turns = await readerItemsToChatTurns(items);
        if (generation !== this.operationGeneration) return false;
        const metadata = buildConversationMetadata(adapter, turns.length);
        this.turns = turns.map(turn => Object.freeze({
            ...turn,
            ...(turn.richBlocks ? { richBlocks: freezeRichBlocks(turn.richBlocks) } : {}),
            ...(turn.richImages ? { richImages: Object.freeze(turn.richImages.map(image => Object.freeze({ ...image }))) } : {}),
        }));
        this.metadata = metadata;
        this.state.turnsCount = turns.length;
        this.state.selected = this.getInitialSelectedTurns(turns.length, startIndex);
        this.state.format = 'markdown';
        this.state.saving = false;
        this.state.progressText = '';
        this.state.progressValue = null;
        this.state.renderProgressText = '';
        this.state.renderProgressValue = null;
        this.state.visuals = 'include';
        this.state.resultText = '';
        if (this.overlaySession && this.closing) {
            this.overlaySession.cancelSurfaceClose();
        }
        this.closing = false;
        this.motionNeedsOpen = !this.overlaySession;

        this.mount();
        this.render();
        return true;
    }

    close(): void {
        if (this.closing) return;
        this.exportAbort?.abort();
        this.operationGeneration += 1;
        const panel = this.overlaySession?.surfaceRoot.querySelector<HTMLElement>('.panel-window');
        const backdrop = this.overlaySession?.backdropRoot.querySelector<HTMLElement>('.panel-stage__overlay');
        if (this.overlaySession && panel) {
            this.closing = true;
            const started = this.overlaySession.closeSurface({
                surface: panel,
                backdrop,
                onClosed: () => this.finishClose(),
            });
            if (started) return;
        }
        this.finishClose();
    }

    private finishClose(): void {
        this.exportSelects = [];
        this.tooltipDelegate?.disconnect();
        this.tooltipDelegate = null;
        this.unsubscribeLocale?.();
        this.unsubscribeLocale = null;
        this.focusLifecycle.restore(document);
        this.overlaySession?.unmount();
        this.overlaySession = null;
        this.adapter = null;
        this.turns = [];
        this.metadata = null;
        this.state.selected.clear();
        this.closing = false;
        this.motionNeedsOpen = false;
    }

    private mount(): void {
        if (this.overlaySession) return;

        const session = new OverlaySession({
            id: 'aimd-save-messages-dialog-host',
            theme: this.appearance.theme,
            themeOverrides: this.appearance.overrides,
            surfaceCss: this.getCss(),
            lockScroll: true,
            surfaceStyleId: 'aimd-save-messages-dialog-structure',
            overlayStyleId: 'aimd-save-messages-dialog-overlay-extra',
            profile: 'modal',
        });

        this.overlaySession = session;
        this.tooltipDelegate = new TooltipDelegate(session.shadow);
        this.unsubscribeLocale = subscribeLocaleChange(() => {
            if (this.overlaySession) this.render();
        });

        session.syncBackdropDismiss(() => this.close());
        session.surfaceRoot.addEventListener('click', (event) => void this.handleClick(event));
        session.syncKeyboardScope({
            root: session.host,
            onEscape: () => this.close(),
            stopPropagationAll: true,
            ignoreEscapeWhileComposing: true,
            trapTabWithin: session.surfaceRoot.querySelector<HTMLElement>('.panel-window') ?? session.host,
        });
    }

    private render(): void {
        if (!this.overlaySession || this.closing) return;

        this.exportSelects.forEach(control => control.close());
        this.exportSelects = [];

        const { element: backdrop, isNew: isNewBackdrop } = ensureBackdropElement(this.overlaySession.backdropRoot, 'panel-stage__overlay');
        const { element: panel, isNew: isNewPanel } = ensureStableElementFromHtml<HTMLElement>(
            this.overlaySession.surfaceRoot,
            '.panel-window--save',
            this.getHtml(),
        );
        this.mountExportSelects(panel);
        this.overlaySession.syncSurfaceMotion({ surface: panel, backdrop });
        this.overlaySession.syncKeyboardScope({
            root: this.overlaySession.host,
            onEscape: () => this.close(),
            stopPropagationAll: true,
            ignoreEscapeWhileComposing: true,
            trapTabWithin: panel ?? this.overlaySession.host,
        });
        if (this.motionNeedsOpen && (isNewBackdrop || isNewPanel)) {
            this.overlaySession.openSurface({ surface: panel, backdrop });
            this.focusLifecycle.scheduleInitialFocus({
                surface: panel,
                selectors: ['[data-action="save-turns"]', '[data-action="close-panel"]'],
            });
            this.motionNeedsOpen = false;
        }
        this.tooltipDelegate?.refresh(this.overlaySession.shadow);
    }

    private mountExportSelects(panel: HTMLElement): void {
        const mount = (
            role: string,
            label: string,
            value: string,
            options: Array<{ value: string; label: string }>,
            action: 'set-format' | 'set-visuals',
            valueKey: 'format' | 'visuals',
        ): void => {
            const slot = panel.querySelector<HTMLElement>(`[data-role="${role}"]`);
            if (!slot) return;
            const control = createBookmarksInlineSelectControl({
                options,
                menuName: role,
                onBeforeOpen: () => this.exportSelects.forEach(select => select.close()),
            });
            control.setValue(value);
            control.trigger.disabled = this.state.saving;
            control.trigger.setAttribute('aria-label', `${label}: ${control.triggerLabel.textContent}`);
            control.menu.setAttribute('aria-label', label);
            control.menu.querySelectorAll<HTMLButtonElement>('button').forEach(button => {
                button.dataset.action = action;
                button.dataset[valueKey] = button.dataset.value;
                button.disabled = this.state.saving;
            });
            slot.replaceChildren(control.root);
            this.exportSelects.push(control);
        };
        mount('export-format-control', this.getLabel('formatLabel', 'Format'), this.state.format, [
            { value: 'markdown', label: this.getLabel('formatMarkdown', 'Markdown') },
            { value: 'markdown-zip', label: this.getLabel('formatMarkdownZip', 'Markdown offline bundle (ZIP)') },
            { value: 'pdf', label: this.getLabel('formatPdf', 'PDF') },
            { value: 'png', label: this.getLabel('formatPng', 'PNG') },
        ], 'set-format', 'format');
        mount('export-visuals-control', this.getLabel('messageExportRichLabel', 'Charts and rich content'), this.state.visuals, [
            { value: 'include', label: this.getLabel('messageExportRichInclude', 'Include images') },
            { value: 'placeholder', label: this.getLabel('messageExportRichPlaceholder', 'Use text placeholders') },
        ], 'set-visuals', 'visuals');
    }

    private async handleClick(event: Event): Promise<void> {
        const target = event.target as HTMLElement | null;
        if (!target?.closest('.settings-select-shell')) this.exportSelects.forEach(control => control.close());
        const actionEl = target?.closest<HTMLElement>('[data-action]');
        if (!actionEl) {
            const chip = target?.closest<HTMLElement>('.message-chip');
            if (chip?.dataset.index) {
                this.toggleTurn(Number(chip.dataset.index));
            }
            return;
        }

        const action = actionEl.dataset.action;
        if (this.state.saving && !['close-panel', 'cancel-png-export', 'cancel-export'].includes(action ?? '')) return;
        switch (action) {
            case 'close-panel':
                this.close();
                return;
            case 'toggle-turn':
                this.toggleTurn(Number(actionEl.dataset.index ?? -1));
                return;
            case 'select-all-turns':
                this.selectAll();
                return;
            case 'deselect-all-turns':
                this.deselectAll();
                return;
            case 'invert-turns':
                this.invertSelection();
                return;
            case 'set-format': {
                const next = (actionEl.dataset.format as SaveFormat) || 'markdown';
                if (next !== this.state.format) {
                    this.state.format = next;
                    this.render();
                }
                return;
            }
            case 'set-visuals': {
                this.state.visuals = actionEl.dataset.visuals === 'placeholder' ? 'placeholder' : 'include';
                this.render();
                return;
            }
            case 'save-turns':
                await this.save();
                return;
            case 'cancel-png-export':
            case 'cancel-export':
                this.cancelExport();
                return;
            default:
                return;
        }
    }

    private toggleTurn(index: number): void {
        if (!Number.isInteger(index) || index < 0 || index >= this.turns.length) return;
        if (this.state.selected.has(index)) this.state.selected.delete(index);
        else this.state.selected.add(index);
        this.render();
    }

    private selectAll(): void {
        this.state.selected = new Set(this.turns.map((_, i) => i));
        this.render();
    }

    private getInitialSelectedTurns(turnsCount: number, startIndex: number): Set<number> {
        if (turnsCount <= 0) return new Set();
        if (Number.isInteger(startIndex) && startIndex >= 0 && startIndex < turnsCount) {
            return new Set([startIndex]);
        }
        return new Set([0]);
    }

    private deselectAll(): void {
        this.state.selected.clear();
        this.render();
    }

    private invertSelection(): void {
        this.state.selected = new Set(this.turns.flatMap((_, index) => this.state.selected.has(index) ? [] : [index]));
        this.render();
    }

    private cancelExport(): void {
        this.exportAbort?.abort();
        if (this.state.saving) {
            this.state.progressText = this.getLabel('messageExportCancelled', 'Export cancelled');
            this.state.resultText = this.state.progressText;
            this.state.renderProgressText = '';
            this.state.renderProgressValue = null;
            this.render();
        }
    }

    private async save(): Promise<void> {
        if (!this.adapter || !this.metadata) return;
        if (this.state.selected.size === 0 || this.state.saving) return;

        const selectedIndices = Array.from(this.state.selected).sort((a, b) => a - b);
        const turns = this.turns;
        const metadata = this.metadata;
        const format = this.state.format;
        const generation = this.operationGeneration;
        const abort = new AbortController();
        const current = () => generation === this.operationGeneration;
        this.exportAbort = abort;

        this.state.saving = true;
        this.state.progressText = format === 'markdown' ? '' : this.getLabel('messageExportPreparing', 'Preparing content $1', ['0/1']);
        this.state.progressValue = null;
        this.state.renderProgressText = '';
        this.state.renderProgressValue = null;
        this.state.resultText = '';
        this.render();

        const options: ExportOptions = {
            t: this.exportT,
            contentCleanup: { ...this.contentCleanup },
            markdownFormulaFormat: this.markdownFormulaFormat,
            visuals: this.state.visuals,
            signal: abort.signal,
            onProgress: event => {
                if (!current() || abort.signal.aborted) return;
                if (format === 'png') this.applyPngProgress(event);
                else this.applyExportProgress(event);
                if (this.overlaySession && !this.closing) this.render();
            },
        };

        try {
            const res =
                format === 'pdf'
                    ? await exportTurnsPdf(turns, selectedIndices, metadata, {
                          ...options,
                          onPrepared: () => {
                              // Resource preparation remains cancellable; remove the shell only when native print is about to start.
                              if (current() && !abort.signal.aborted) this.finishClose();
                          },
                      })
                    : format === 'png'
                    ? await exportTurnsPng(turns, selectedIndices, metadata, {
                          ...options,
                          png: { width: this.resolvedPngWidth, pixelRatio: this.resolvedPngPixelRatio },
                      })
                    : format === 'markdown-zip'
                    ? await exportTurnsMarkdownZip(turns, selectedIndices, metadata, options)
                    : await exportTurnsMarkdown(turns, selectedIndices, metadata, options);

            if (!current()) return;
            if (!res.ok) {
                this.state.resultText = res.cancelled || abort.signal.aborted
                    ? this.getLabel('messageExportCancelled', 'Export cancelled')
                    : this.getLabel('messageExportFailed', 'Export failed. Please try again.');
                if (!this.overlaySession && !res.cancelled) showToast({ text: this.state.resultText, tone: 'error' });
                return;
            }
            if (res.richContent?.placeholders && options.visuals !== 'placeholder') {
                const summary = this.getLabel('messageExportRichFallback', 'Included $1 images; $2 rich blocks use text placeholders.', [String(res.richContent.included), String(res.richContent.placeholders)]);
                if (this.overlaySession) this.state.resultText = summary;
                else showToast({ text: summary, tone: 'info' });
            } else if (format === 'pdf') this.finishClose();
            else this.close();
        } catch {
            if (current()) this.state.resultText = abort.signal.aborted
                ? this.getLabel('messageExportCancelled', 'Export cancelled')
                : this.getLabel('messageExportFailed', 'Export failed. Please try again.');
        } finally {
            if (current()) {
                this.state.saving = false;
                if (this.exportAbort === abort) this.exportAbort = null;
                if (this.overlaySession && !this.closing) this.render();
            }
        }
    }

    private getHtml(): string {
        const title = this.getLabel('saveMessagesTitle', 'Save Messages');
        const closeLabel = this.getLabel('btnClose', 'Close panel');
        const selectMessagesLabel = this.getLabel('selectMessagesLabel', 'Select messages');
        const formatLabel = this.getLabel('formatLabel', 'Format');
        const selectAllLabel = this.getLabel('selectAll', 'Select all');
        const deselectAllLabel = this.getLabel('deselectAll', 'Deselect all');
        const invertSelectionLabel = this.getLabel('invertSelection', 'Invert selection');
        const saveLabel = this.state.saving ? this.getLabel('saving', 'Saving') : this.getLabel('btnSave', 'Save');
        const cancelLabel = this.getLabel('btnCancel', 'Cancel');
        const countLabel = this.getSelectedCountLabel();
        const showProgress = this.state.saving
            && (Boolean(this.state.progressText) || Boolean(this.state.renderProgressText));
        const showCancel = this.state.saving;
        const showVisuals = ['pdf', 'png'].includes(this.state.format)
            && [...this.state.selected].some(index => Boolean(this.turns[index]?.richBlocks?.length));
        const disabled = this.state.saving ? 'disabled' : '';
        const totalProgressValue = this.state.progressValue ?? 0;
        const renderProgressValue = this.state.renderProgressValue ?? 0;

        return `
<div class="panel-window panel-window--dialog panel-window--save workflow-dialog flat-workflow" role="dialog" aria-modal="true" aria-label="${escapeHtml(title)}" aria-busy="${this.state.saving ? 'true' : 'false'}">
  <div class="panel-header">
    <div class="panel-header__meta">
      <h2>${escapeHtml(title)}</h2>
    </div>
    <div class="panel-header__actions">
      <button class="icon-btn" data-action="close-panel" aria-label="${escapeHtml(closeLabel)}" data-tooltip="${escapeHtml(closeLabel)}">${iconMarkup(xIcon)}</button>
    </div>
  </div>
  <div class="dialog-body workflow-dialog__body">
    <section class="export-section" aria-label="${escapeHtml(selectMessagesLabel)}">
    <div class="export-section-heading">
      <h3>${escapeHtml(selectMessagesLabel)}</h3>
      <div class="counter">${escapeHtml(countLabel)}</div>
    </div>
    <div class="settings-card message-selection">
    <div class="message-grid">
      ${this.turns.map((turn, index) => {
          const active = this.state.selected.has(index) ? '1' : '0';
          return `<button class="message-chip" data-action="toggle-turn" data-index="${index}" data-active="${active}" aria-pressed="${active === '1'}" ${disabled} data-tooltip="${escapeHtml(turn.user)}" data-tooltip-title="${index + 1}" data-tooltip-variant="preview">${index + 1}</button>`;
      }).join('')}
    </div>
    <div class="button-row">
      <button class="secondary-btn secondary-btn--compact secondary-btn--ghost" data-action="select-all-turns" ${disabled}>${escapeHtml(selectAllLabel)}</button>
      <button class="secondary-btn secondary-btn--compact secondary-btn--ghost" data-action="invert-turns" ${disabled}>${escapeHtml(invertSelectionLabel)}</button>
      <button class="secondary-btn secondary-btn--compact secondary-btn--ghost" data-action="deselect-all-turns" ${disabled}>${escapeHtml(deselectAllLabel)}</button>
    </div>
    </div>
    </section>
    <div class="settings-card export-options">
      <div class="settings-row settings-item">
        <div class="settings-label"><strong>${escapeHtml(formatLabel)}</strong></div>
        <div data-role="export-format-control"></div>
      </div>
      ${showVisuals ? `<div class="settings-row settings-item" data-role="rich-content-options">
        <div class="settings-label"><strong>${escapeHtml(this.getLabel('messageExportRichLabel', 'Charts and rich content'))}</strong></div>
        <div data-role="export-visuals-control"></div>
      </div>` : ''}
    </div>
    ${this.state.resultText ? `<div class="export-result workflow-dialog__status" data-role="export-result" role="status" aria-live="polite">${escapeHtml(this.state.resultText)}</div>` : ''}
    ${showProgress ? `
    <div class="progress-panel">
      ${this.state.renderProgressText ? `
      <div class="progress-row">
        <div class="progress-label">${escapeHtml(this.state.renderProgressText)}</div>
        <div class="progress-track" role="progressbar" aria-label="${escapeHtml(this.getLabel('pngExportRenderProgressLabel', 'Image rendering'))}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${renderProgressValue}">
          <div class="progress-fill" style="width: ${renderProgressValue}%"></div>
        </div>
      </div>` : ''}
      <div class="progress-row">
        <div class="progress-label workflow-dialog__status" data-tone="muted" role="status" aria-live="polite">${escapeHtml(this.state.progressText)}</div>
        <div class="progress-track" role="progressbar" aria-label="${escapeHtml(this.getLabel('pngExportTotalProgressLabel', 'Total export'))}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${totalProgressValue}">
          <div class="progress-fill" style="width: ${totalProgressValue}%"></div>
        </div>
      </div>
    </div>` : ''}
  </div>
  <div class="panel-footer panel-footer--between">
    <div class="footer-cluster workflow-dialog__actions">
      ${showCancel ? `<button class="secondary-btn secondary-btn--compact secondary-btn--ghost" data-action="${this.state.format === 'png' ? 'cancel-png-export' : 'cancel-export'}">${escapeHtml(cancelLabel)}</button>` : ''}
      <button class="secondary-btn secondary-btn--compact secondary-btn--primary" data-action="save-turns" ${this.state.selected.size === 0 || this.state.saving ? 'disabled' : ''}>${escapeHtml(saveLabel)}</button>
    </div>
  </div>
</div>
`;
    }

    private getCss(): string {
        return getSaveMessagesDialogCss();
    }

    private getLabel(key: string, fallback: string, substitutions?: string[]): string {
        const translated = substitutions ? t(key, substitutions) : t(key);
        if (!translated || translated === key) return fallback;
        return translated;
    }

    private getSelectedCountLabel(): string {
        const count = `${this.state.selected.size}`;
        const total = `${this.state.turnsCount}`;
        const translated = t('selectedCountMessages', [count, total]);
        if (!translated || translated === 'selectedCountMessages') return `${count}/${total} selected`;
        return translated;
    }

    private applyExportProgress(event: ExportProgressEvent): void {
        const count = `${event.completed}/${event.total}`;
        if (event.phase === 'preparing' || event.phase === 'rendering') {
            this.state.progressText = this.getLabel('messageExportPreparing', `Preparing content ${count}`, [count]);
            this.state.progressValue = event.total > 0 ? Math.min(90, Math.round(event.completed / event.total * 90)) : 0;
        } else if (event.phase === 'zipping') {
            this.state.progressText = this.getLabel('messageExportPackaging', 'Packaging offline bundle');
            this.state.progressValue = 95;
        } else if (event.phase === 'downloading') {
            this.state.progressText = this.getLabel('pngExportDownloading', 'Downloading export');
            this.state.progressValue = 98;
        } else {
            this.state.progressText = this.getLabel('messageExportReady', 'Export ready');
            this.state.progressValue = 100;
        }
    }

    private applyPngProgress(event: ExportProgressEvent): void {
        this.state.progressText = this.getPngProgressLabel(event.phase, event.completed, event.total, event.filename);
        if (event.render) {
            const render = retainMonotonicImageExportProgress(
                this.state.renderProgressValue === null
                    ? null
                    : {
                        label: this.state.renderProgressText,
                        value: this.state.renderProgressValue,
                    },
                presentImageExportProgress(event.render, (key, substitutions) => (
                    substitutions ? t(key, substitutions) : t(key)
                )),
            );
            this.state.renderProgressText = render.label;
            this.state.renderProgressValue = render.value;
            this.state.progressValue = Math.round(render.value * 0.9);
            return;
        }

        this.state.renderProgressText = '';
        this.state.renderProgressValue = null;
        switch (event.phase) {
            case 'zipping':
                this.state.progressValue = 95;
                return;
            case 'downloading':
                this.state.progressValue = 98;
                return;
            case 'done':
                this.state.progressValue = 100;
                return;
            default:
                this.state.progressValue = event.total > 0
                    ? Math.round((event.completed / event.total) * 100)
                    : null;
        }
    }

    private getPngProgressLabel(phase: string, completed: number, total: number, filename?: string): string {
        const base = `${completed}/${total}`;
        switch (phase) {
            case 'preparing':
                return this.getLabel('pngExportPreparing', `Preparing PNG export ${base}`, [base]);
            case 'rendering':
                return filename
                    ? this.getLabel('pngExportRenderingWithFilename', `Rendering ${base}: ${filename}`, [base, filename])
                    : this.getLabel('pngExportRendering', `Rendering ${base}`, [base]);
            case 'zipping':
                return filename
                    ? this.getLabel('pngExportZippingWithFilename', `Packaging ZIP ${base}: ${filename}`, [base, filename])
                    : this.getLabel('pngExportZipping', `Packaging ZIP ${base}`, [base]);
            case 'downloading':
                return filename
                    ? this.getLabel('pngExportDownloadingWithFilename', `Downloading ${filename}`, [filename])
                    : this.getLabel('pngExportDownloading', 'Downloading export');
            case 'done':
                return this.getLabel('pngExportDone', `PNG export ready ${base}`, [base]);
            default:
                return base;
        }
    }
}

export const saveMessagesDialog = new SaveMessagesDialog();

function iconMarkup(svg: string): string {
    return createIcon(svg).outerHTML;
}

function escapeHtml(input: string): string {
    return input
        .split('&').join('&amp;')
        .split('<').join('&lt;')
        .split('>').join('&gt;')
        .split('"').join('&quot;')
        .split("'").join('&#39;');
}
