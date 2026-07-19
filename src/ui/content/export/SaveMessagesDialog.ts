import type { Theme } from '../../../core/types/theme';
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
import type { ChatGPTConversationEngine } from '../../../drivers/content/chatgpt/ChatGPTConversationEngine';
import { buildConversationMetadata } from '../../../drivers/content/conversation/metadata';
import { subscribeLocaleChange, t } from '../components/i18n';
import type { ExportProgressEvent, TranslateFn, SaveFormat } from '../../../services/export/saveMessagesTypes';
import {
    exportTurnsMarkdown,
    exportTurnsPdf,
    exportTurnsPng,
} from '../../../services/export/saveMessagesFacade';
import { collectFreshReaderContent, readerItemsToChatTurns } from '../../../services/reader/readerContentSource';
import { getSaveMessagesDialogCss } from './saveMessagesDialogCss';
import { xIcon, fileCodeIcon, fileTextIcon, imageIcon } from '../../../assets/icons';
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
};

export class SaveMessagesDialog {
    private overlaySession: OverlaySession | null = null;
    private adapter: SiteAdapter | null = null;
    private turns: Array<{ user: string; assistant: string; index: number }> = [];
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
    };
    private closing = false;
    private motionNeedsOpen = false;
    private readonly focusLifecycle = new SurfaceFocusLifecycle();
    private pngExportAbort: AbortController | null = null;

    isOpen(): boolean {
        return Boolean(this.overlaySession);
    }

    setExportSettings(settings: ExportSettings): void {
        this.resolvedPngWidth = resolvePngExportWidth(settings);
        this.resolvedPngPixelRatio = resolvePngExportPixelRatio(settings);
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
            chatGptConversationEngine?: ChatGPTConversationEngine | null;
            startMessageElement?: HTMLElement | null;
        }
    ): Promise<void> {
        this.focusLifecycle.capture();
        this.adapter = adapter;
        this.setAppearance(createAppearanceSnapshot(theme, this.appearance.overrides));

        const { items, startIndex } = await collectFreshReaderContent(adapter, options?.startMessageElement ?? null, {
            chatGptConversationEngine: options?.chatGptConversationEngine ?? null,
        });
        const turns = await readerItemsToChatTurns(items);
        const metadata = buildConversationMetadata(adapter, turns.length);
        this.turns = turns;
        this.metadata = metadata;
        this.state.turnsCount = turns.length;
        this.state.selected = this.getInitialSelectedTurns(turns.length, startIndex);
        this.state.format = 'markdown';
        this.state.saving = false;
        this.state.progressText = '';
        this.state.progressValue = null;
        this.state.renderProgressText = '';
        this.state.renderProgressValue = null;
        if (this.overlaySession && this.closing) {
            this.overlaySession.cancelSurfaceClose();
        }
        this.closing = false;
        this.motionNeedsOpen = !this.overlaySession;

        this.mount();
        this.render();
    }

    close(): void {
        if (this.closing) return;
        this.pngExportAbort?.abort();
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

        const { element: backdrop, isNew: isNewBackdrop } = ensureBackdropElement(this.overlaySession.backdropRoot, 'panel-stage__overlay');
        const { element: panel, isNew: isNewPanel } = ensureStableElementFromHtml<HTMLElement>(
            this.overlaySession.surfaceRoot,
            '.panel-window--save',
            this.getHtml(),
        );
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

    private async handleClick(event: Event): Promise<void> {
        const target = event.target as HTMLElement | null;
        const actionEl = target?.closest<HTMLElement>('[data-action]');
        if (!actionEl) {
            const chip = target?.closest<HTMLElement>('.message-chip');
            if (chip?.dataset.index) {
                this.toggleTurn(Number(chip.dataset.index));
            }
            return;
        }

        const action = actionEl.dataset.action;
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
            case 'set-format': {
                const next = (actionEl.dataset.format as SaveFormat) || 'markdown';
                if (next !== this.state.format) {
                    this.state.format = next;
                    this.render();
                }
                return;
            }
            case 'save-turns':
                await this.save();
                return;
            case 'cancel-png-export':
                this.cancelPngExport();
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

    private cancelPngExport(): void {
        this.pngExportAbort?.abort();
        if (this.state.format === 'png' && this.state.saving) {
            this.state.progressText = this.getLabel('pngExportCancelled', 'PNG export cancelled');
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

        this.state.saving = true;
        this.state.progressText = '';
        this.state.progressValue = null;
        this.state.renderProgressText = '';
        this.state.renderProgressValue = null;
        this.render();
        const pngAbort = format === 'png' ? new AbortController() : null;
        this.pngExportAbort = pngAbort;

        try {
            const res =
                format === 'pdf'
                    ? await (async () => {
                          this.finishClose();
                          return exportTurnsPdf(turns, selectedIndices, metadata, { t: this.exportT });
                      })()
                    : format === 'png'
                    ? await exportTurnsPng(turns, selectedIndices, metadata, {
                          t: this.exportT,
                          png: { width: this.resolvedPngWidth, pixelRatio: this.resolvedPngPixelRatio },
                          signal: pngAbort?.signal,
                          onProgress: (event) => {
                              this.applyPngProgress(event);
                              if (this.overlaySession && !this.closing) this.render();
                          },
                      })
                    : await exportTurnsMarkdown(turns, selectedIndices, metadata, {
                          t: this.exportT,
                          markdownFormulaFormat: this.markdownFormulaFormat,
                      });

            if (!res.ok) return;
            if (format !== 'pdf') this.close();
        } finally {
            this.state.saving = false;
            if (this.pngExportAbort === pngAbort) this.pngExportAbort = null;
            if (this.overlaySession && !this.closing) this.render();
        }
    }

    private getHtml(): string {
        const title = this.getLabel('saveMessagesTitle', 'Save Messages');
        const closeLabel = this.getLabel('btnClose', 'Close panel');
        const selectMessagesLabel = this.getLabel('selectMessagesLabel', 'Select messages');
        const formatLabel = this.getLabel('formatLabel', 'Format');
        const markdownLabel = this.getLabel('formatMarkdown', 'Markdown');
        const pdfLabel = this.getLabel('formatPdf', 'PDF');
        const pngLabel = this.getLabel('formatPng', 'PNG');
        const selectAllLabel = this.getLabel('selectAll', 'Select all');
        const deselectAllLabel = this.getLabel('deselectAll', 'Deselect all');
        const saveLabel = this.state.saving ? this.getLabel('saving', 'Saving') : this.getLabel('btnSave', 'Save');
        const cancelLabel = this.getLabel('btnCancel', 'Cancel');
        const countLabel = this.getSelectedCountLabel();
        const showProgress = this.state.format === 'png'
            && this.state.saving
            && (Boolean(this.state.progressText) || Boolean(this.state.renderProgressText));
        const showCancel = this.state.format === 'png' && this.state.saving;
        const totalProgressValue = this.state.progressValue ?? 0;
        const renderProgressValue = this.state.renderProgressValue ?? 0;

        return `
<div class="panel-window panel-window--dialog panel-window--save workflow-dialog" role="dialog" aria-modal="true" aria-label="${escapeHtml(title)}" aria-busy="${this.state.saving ? 'true' : 'false'}">
  <div class="panel-header">
    <div class="panel-header__meta">
      <h2>${escapeHtml(title)}</h2>
    </div>
    <div class="panel-header__actions">
      <button class="icon-btn" data-action="close-panel" aria-label="${escapeHtml(closeLabel)}" data-tooltip="${escapeHtml(closeLabel)}">${iconMarkup(xIcon)}</button>
    </div>
  </div>
  <div class="dialog-body workflow-dialog__body">
    <div class="section-label">${escapeHtml(selectMessagesLabel)}</div>
    <div class="message-grid">
      ${this.turns.map((turn, index) => {
          const active = this.state.selected.has(index) ? '1' : '0';
          return `<button class="message-chip" data-action="toggle-turn" data-index="${index}" data-active="${active}" data-tooltip="${escapeHtml(turn.user)}" data-tooltip-title="${index + 1}" data-tooltip-variant="preview">${index + 1}</button>`;
      }).join('')}
    </div>
    <div class="section-label">${escapeHtml(formatLabel)}</div>
    <div class="segmented">
      <button data-action="set-format" data-format="markdown" data-active="${this.state.format === 'markdown' ? '1' : '0'}" aria-label="${escapeHtml(markdownLabel)}">${iconMarkup(fileCodeIcon)}<span>${escapeHtml(markdownLabel)}</span></button>
      <button data-action="set-format" data-format="pdf" data-active="${this.state.format === 'pdf' ? '1' : '0'}" aria-label="${escapeHtml(pdfLabel)}">${iconMarkup(fileTextIcon)}<span>${escapeHtml(pdfLabel)}</span></button>
      <button data-action="set-format" data-format="png" data-active="${this.state.format === 'png' ? '1' : '0'}" aria-label="${escapeHtml(pngLabel)}">${iconMarkup(imageIcon)}<span>${escapeHtml(pngLabel)}</span></button>
    </div>
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
    <div class="button-row">
      <button class="secondary-btn secondary-btn--compact" data-action="select-all-turns">${escapeHtml(selectAllLabel)}</button>
      <button class="secondary-btn secondary-btn--compact secondary-btn--ghost" data-action="deselect-all-turns">${escapeHtml(deselectAllLabel)}</button>
    </div>
    <div class="footer-cluster workflow-dialog__actions">
      <div class="counter">${escapeHtml(countLabel)}</div>
      ${showCancel ? `<button class="secondary-btn secondary-btn--compact secondary-btn--ghost" data-action="cancel-png-export">${escapeHtml(cancelLabel)}</button>` : ''}
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
