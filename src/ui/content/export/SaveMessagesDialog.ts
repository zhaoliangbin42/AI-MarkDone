import type { Theme } from '../../../core/types/theme';
import type { SiteAdapter } from '../../../drivers/content/adapters/base';
import type { ChatGPTConversationEngine } from '../../../drivers/content/chatgpt/ChatGPTConversationEngine';
import { getTokenCss } from '../../../style/tokens';
import { subscribeLocaleChange, t } from '../components/i18n';
import type { TranslateFn, SaveFormat } from '../../../services/export/saveMessagesTypes';
import {
    collectConversationTurnsAsync,
    exportTurnsMarkdown,
    exportTurnsPdf,
    exportTurnsPng,
} from '../../../services/export/saveMessagesFacade';
import { getSaveMessagesDialogCss } from './saveMessagesDialogCss';
import { xIcon, fileCodeIcon, fileTextIcon, imageIcon } from '../../../assets/icons';
import { OverlaySession } from '../overlay/OverlaySession';
import { TooltipDelegate } from '../../../utils/tooltip';
import { createIcon } from '../components/Icon';
import { beginSurfaceMotionClose, setSurfaceMotionOpening } from '../components/motionLifecycle';
import { cancelSurfaceMotionClose } from '../components/motionLifecycle';
import { ensureBackdropElement, ensureStableElementFromHtml } from '../components/stableSurface';
import { SurfaceFocusLifecycle } from '../components/surfaceFocusLifecycle';

type State = {
    theme: Theme;
    format: SaveFormat;
    selected: Set<number>;
    saving: boolean;
    turnsCount: number;
    progressText: string;
    progressValue: number | null;
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

    private state: State = {
        theme: 'light',
        format: 'markdown',
        selected: new Set(),
        saving: false,
        turnsCount: 0,
        progressText: '',
        progressValue: null,
    };
    private closing = false;
    private motionNeedsOpen = false;
    private readonly focusLifecycle = new SurfaceFocusLifecycle();

    isOpen(): boolean {
        return Boolean(this.overlaySession);
    }

    async open(
        adapter: SiteAdapter,
        theme: Theme,
        options?: { chatGptConversationEngine?: ChatGPTConversationEngine | null }
    ): Promise<void> {
        this.focusLifecycle.capture();
        this.adapter = adapter;
        this.state.theme = theme;

        const { turns, metadata } = await collectConversationTurnsAsync(adapter, {
            chatGptConversationEngine: options?.chatGptConversationEngine ?? null,
        });
        this.turns = turns;
        this.metadata = metadata;
        this.state.turnsCount = turns.length;
        this.state.selected = new Set(turns.map((_, i) => i));
        this.state.format = 'markdown';
        this.state.saving = false;
        this.state.progressText = '';
        this.state.progressValue = null;
        if (this.overlaySession && this.closing) {
            cancelSurfaceMotionClose({
                shell: this.overlaySession.surfaceRoot.querySelector<HTMLElement>('.panel-window'),
                backdrop: this.overlaySession.backdropRoot.querySelector<HTMLElement>('.panel-stage__overlay'),
            });
        }
        this.closing = false;
        this.motionNeedsOpen = !this.overlaySession;

        this.mount();
        this.render();
    }

    close(): void {
        if (this.closing) return;
        const panel = this.overlaySession?.surfaceRoot.querySelector<HTMLElement>('.panel-window');
        const backdrop = this.overlaySession?.backdropRoot.querySelector<HTMLElement>('.panel-stage__overlay');
        if (this.overlaySession && panel) {
            this.closing = true;
            beginSurfaceMotionClose({
                shell: panel,
                backdrop,
                onClosed: () => this.finishClose(),
                fallbackMs: 560,
            });
            return;
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
            theme: this.state.theme,
            surfaceCss: this.getCss(),
            lockScroll: true,
            surfaceStyleId: 'aimd-save-messages-dialog-structure',
            overlayStyleId: 'aimd-save-messages-dialog-tailwind',
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

        this.overlaySession.setSurfaceCss(this.getCss());
        const { element: backdrop, isNew: isNewBackdrop } = ensureBackdropElement(this.overlaySession.backdropRoot, 'panel-stage__overlay');
        const { element: panel, isNew: isNewPanel } = ensureStableElementFromHtml<HTMLElement>(
            this.overlaySession.surfaceRoot,
            '.panel-window--save',
            this.getHtml(),
        );
        this.overlaySession.syncKeyboardScope({
            root: this.overlaySession.host,
            onEscape: () => this.close(),
            stopPropagationAll: true,
            ignoreEscapeWhileComposing: true,
            trapTabWithin: panel ?? this.overlaySession.host,
        });
        if (this.motionNeedsOpen && (isNewBackdrop || isNewPanel)) {
            setSurfaceMotionOpening([backdrop, panel]);
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

    private deselectAll(): void {
        this.state.selected.clear();
        this.render();
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
        this.render();

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
                          onProgress: (event) => {
                              this.state.progressValue = event.total > 0 ? Math.round((event.completed / event.total) * 100) : null;
                              this.state.progressText = this.getPngProgressLabel(event.phase, event.completed, event.total, event.filename);
                              if (this.overlaySession && !this.closing) this.render();
                          },
                      })
                    : await exportTurnsMarkdown(turns, selectedIndices, metadata, { t: this.exportT });

            if (!res.ok) return;
            if (format !== 'pdf') this.close();
        } finally {
            this.state.saving = false;
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
        const countLabel = this.getSelectedCountLabel();
        const showProgress = this.state.format === 'png' && this.state.saving && Boolean(this.state.progressText);
        const progressValue = this.state.progressValue ?? 0;

        return `
<div class="panel-window panel-window--dialog panel-window--save" role="dialog" aria-modal="true" aria-label="${escapeHtml(title)}">
  <div class="panel-header">
    <div class="panel-header__meta">
      <h2>${escapeHtml(title)}</h2>
    </div>
    <div class="panel-header__actions">
      <button class="icon-btn" data-action="close-panel" aria-label="${escapeHtml(closeLabel)}" data-tooltip="${escapeHtml(closeLabel)}">${iconMarkup(xIcon)}</button>
    </div>
  </div>
  <div class="dialog-body">
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
      <div class="progress-label">${escapeHtml(this.state.progressText)}</div>
      <div class="progress-track" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${progressValue}">
        <div class="progress-fill" style="width: ${progressValue}%"></div>
      </div>
    </div>` : ''}
  </div>
  <div class="panel-footer panel-footer--between">
    <div class="button-row">
      <button class="secondary-btn secondary-btn--compact" data-action="select-all-turns">${escapeHtml(selectAllLabel)}</button>
      <button class="secondary-btn secondary-btn--compact secondary-btn--ghost" data-action="deselect-all-turns">${escapeHtml(deselectAllLabel)}</button>
    </div>
    <div class="footer-cluster">
      <div class="counter">${escapeHtml(countLabel)}</div>
      <button class="secondary-btn secondary-btn--compact secondary-btn--primary" data-action="save-turns" ${this.state.selected.size === 0 || this.state.saving ? 'disabled' : ''}>${escapeHtml(saveLabel)}</button>
    </div>
  </div>
</div>
`;
    }

    private getCss(): string {
        return `
${getTokenCss(this.state.theme)}
${getSaveMessagesDialogCss(this.state.theme)}
`;
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

    private getPngProgressLabel(phase: string, completed: number, total: number, filename?: string): string {
        const base = `${completed}/${total}`;
        switch (phase) {
            case 'preparing':
                return `Preparing PNG export ${base}`;
            case 'rendering':
                return filename ? `Rendering ${base}: ${filename}` : `Rendering ${base}`;
            case 'zipping':
                return filename ? `Packaging ZIP ${base}: ${filename}` : `Packaging ZIP ${base}`;
            case 'downloading':
                return filename ? `Downloading ${filename}` : `Downloading export`;
            case 'done':
                return `PNG export ready ${base}`;
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
