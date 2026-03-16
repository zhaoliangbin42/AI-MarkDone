import type { Theme } from '../../../core/types/theme';
import type { SiteAdapter } from '../../../drivers/content/adapters/base';
import { getTokenCss } from '../../../style/tokens';
import overlayCssText from '../../../style/tailwind-overlay.css?inline';
import { t } from '../components/i18n';
import type { TranslateFn, SaveFormat } from '../../../services/export/saveMessagesTypes';
import {
    collectConversationTurns,
    exportTurnsMarkdown,
    exportTurnsPdf,
} from '../../../services/export/saveMessagesFacade';
import { getSaveMessagesDialogCss } from './saveMessagesDialogCss';
import { xIcon, fileCodeIcon, fileTextIcon } from '../../../assets/icons';
import { mountOverlaySurfaceHost, type OverlaySurfaceHostHandle } from '../overlay/OverlaySurfaceHost';
import { attachDialogKeyboardScope, type DialogKeyboardScopeHandle } from '../components/dialogKeyboardScope';
import { TooltipDelegate } from '../../../utils/tooltip';
import { createIcon } from '../components/Icon';

type State = {
    theme: Theme;
    format: SaveFormat;
    selected: Set<number>;
    saving: boolean;
    turnsCount: number;
};

export class SaveMessagesDialog {
    private hostHandle: OverlaySurfaceHostHandle | null = null;
    private keyboardHandle: DialogKeyboardScopeHandle | null = null;
    private adapter: SiteAdapter | null = null;
    private turns: Array<{ user: string; assistant: string; index: number }> = [];
    private metadata: { url: string; exportedAt: string; title: string; count: number; platform: string } | null = null;
    private tooltipDelegate: TooltipDelegate | null = null;
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
    };

    isOpen(): boolean {
        return Boolean(this.hostHandle);
    }

    open(adapter: SiteAdapter, theme: Theme): void {
        if (this.hostHandle) this.close();
        this.adapter = adapter;
        this.state.theme = theme;

        const { turns, metadata } = collectConversationTurns(adapter);
        this.turns = turns;
        this.metadata = metadata;
        this.state.turnsCount = turns.length;
        this.state.selected = new Set(turns.map((_, i) => i));
        this.state.format = 'markdown';
        this.state.saving = false;

        this.mount();
        this.render();
    }

    close(): void {
        this.tooltipDelegate?.disconnect();
        this.tooltipDelegate = null;
        this.keyboardHandle?.detach();
        this.keyboardHandle = null;
        this.hostHandle?.unmount();
        this.hostHandle = null;
        this.adapter = null;
        this.turns = [];
        this.metadata = null;
        this.state.selected.clear();
    }

    private mount(): void {
        if (this.hostHandle) return;

        const handle = mountOverlaySurfaceHost({
            id: 'aimd-save-messages-dialog-host',
            themeCss: getTokenCss(this.state.theme),
            surfaceCss: this.getCss(),
            overlayCss: overlayCssText,
            lockScroll: true,
            surfaceStyleId: 'aimd-save-messages-dialog-structure',
            overlayStyleId: 'aimd-save-messages-dialog-tailwind',
        });

        this.hostHandle = handle;
        this.tooltipDelegate = new TooltipDelegate(handle.shadow);

        handle.backdropRoot.addEventListener('click', () => this.close());
        handle.surfaceRoot.addEventListener('click', (event) => void this.handleClick(event));

        this.keyboardHandle = attachDialogKeyboardScope({
            root: handle.host,
            onEscape: () => this.close(),
            stopPropagationAll: true,
            ignoreEscapeWhileComposing: true,
            trapTabWithin: handle.surfaceRoot.querySelector<HTMLElement>('.panel-window') ?? handle.host,
        });
    }

    private render(): void {
        if (!this.hostHandle) return;

        this.hostHandle.setSurfaceCss(this.getCss());
        this.hostHandle.backdropRoot.innerHTML = '<div class="panel-stage__overlay"></div>';
        this.hostHandle.surfaceRoot.innerHTML = this.getHtml();
        this.tooltipDelegate?.refresh(this.hostHandle.shadow);
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

        this.state.saving = true;
        this.render();

        try {
            const selectedIndices = Array.from(this.state.selected).sort((a, b) => a - b);
            const res =
                this.state.format === 'pdf'
                    ? await exportTurnsPdf(this.turns, selectedIndices, this.metadata, { t: this.exportT })
                    : await exportTurnsMarkdown(this.turns, selectedIndices, this.metadata, { t: this.exportT });

            if (!res.ok) return;
            this.close();
        } finally {
            this.state.saving = false;
            if (this.hostHandle) this.render();
        }
    }

    private getHtml(): string {
        const title = this.getLabel('saveMessagesTitle', 'Save Messages');
        const closeLabel = this.getLabel('btnClose', 'Close panel');
        const selectMessagesLabel = this.getLabel('selectMessagesLabel', 'Select messages');
        const formatLabel = this.getLabel('formatLabel', 'Format');
        const markdownLabel = this.getLabel('formatMarkdown', 'Markdown');
        const pdfLabel = this.getLabel('formatPdf', 'PDF');
        const selectAllLabel = this.getLabel('selectAll', 'Select all');
        const deselectAllLabel = this.getLabel('deselectAll', 'Deselect all');
        const saveLabel = this.state.saving ? this.getLabel('saving', 'Saving') : this.getLabel('btnSave', 'Save');
        const countLabel = this.getSelectedCountLabel();

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
    </div>
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
