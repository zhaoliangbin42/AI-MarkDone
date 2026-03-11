import type { Theme } from '../../../core/types/theme';
import type { SiteAdapter } from '../../../drivers/content/adapters/base';
import { getTokenCss } from '../../../style/tokens';
import { t } from '../components/i18n';
import type { TranslateFn, SaveFormat } from '../../../services/export/saveMessagesTypes';
import {
    collectConversationTurns,
    exportTurnsMarkdown,
    exportTurnsPdf,
} from '../../../services/export/saveMessagesFacade';
import { getSaveMessagesDialogCss } from './saveMessagesDialogCss';
import { xIcon, fileCodeIcon, fileTextIcon } from '../../../assets/icons';
import { mountShadowDialogHost, type ShadowDialogHostHandle } from '../components/shadowDialogHost';
import { attachDialogKeyboardScope, type DialogKeyboardScopeHandle } from '../components/dialogKeyboardScope';
import { TooltipDelegate } from '../../../utils/tooltip';

type State = {
    theme: Theme;
    format: SaveFormat;
    selected: Set<number>;
    saving: boolean;
    turnsCount: number;
};

export class SaveMessagesDialog {
    private host: HTMLElement | null = null;
    private shadow: ShadowRoot | null = null;
    private hostHandle: ShadowDialogHostHandle | null = null;
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
        return Boolean(this.host);
    }

    open(adapter: SiteAdapter, theme: Theme): void {
        if (this.host) this.close();
        this.adapter = adapter;
        this.state.theme = theme;

        const { turns, metadata } = collectConversationTurns(adapter);
        this.turns = turns;
        this.metadata = metadata;
        this.state.turnsCount = turns.length;
        this.state.selected = new Set(turns.map((_, i) => i));
        this.state.format = 'markdown';
        this.state.saving = false;

        const handle = mountShadowDialogHost({
            id: 'aimd-save-messages-dialog-host',
            html: this.getHtml(),
            cssText: getTokenCss(theme) + getSaveMessagesDialogCss(theme),
            lockScroll: true,
        });

        this.host = handle.host;
        this.shadow = handle.shadow;
        this.hostHandle = handle;
        this.tooltipDelegate = new TooltipDelegate(this.shadow);

        this.shadow.querySelector<HTMLElement>('[data-role="overlay"]')?.addEventListener('click', (e) => {
            if (e.target === e.currentTarget) this.close();
        });
        this.shadow.querySelector<HTMLButtonElement>('[data-action="close"]')?.addEventListener('click', () => this.close());
        this.shadow.querySelector<HTMLButtonElement>('[data-action="select_all"]')?.addEventListener('click', () => this.selectAll());
        this.shadow.querySelector<HTMLButtonElement>('[data-action="deselect_all"]')?.addEventListener('click', () => this.deselectAll());
        this.shadow.querySelector<HTMLButtonElement>('[data-action="save"]')?.addEventListener('click', () => void this.save());
        this.bindFormatHandlers();

        this.keyboardHandle = attachDialogKeyboardScope({
            root: handle.host,
            onEscape: () => this.close(),
            stopPropagationAll: true,
            ignoreEscapeWhileComposing: true,
            trapTabWithin: this.shadow.querySelector<HTMLElement>('.panel') ?? undefined,
        });

        this.render();
    }

    close(): void {
        this.tooltipDelegate?.disconnect();
        this.tooltipDelegate = null;

        this.keyboardHandle?.detach();
        this.keyboardHandle = null;

        this.hostHandle?.unmount();
        this.hostHandle = null;

        this.host = null;
        this.shadow = null;
        this.adapter = null;
        this.turns = [];
        this.metadata = null;
        this.state.selected.clear();
    }

    private getHtml(): string {
        return `
<div class="overlay" data-role="overlay">
  <div class="panel" role="dialog" aria-modal="true" aria-label="${t('saveMessagesTitle')}">
    <div class="header">
      <div class="title">${t('saveMessagesTitle')}</div>
      <button class="icon" type="button" data-action="close" aria-label="${t('btnClose')}" data-tooltip="${t('btnClose')}">${xIcon}</button>
    </div>
    <div class="body">
      <div class="section">
        <div class="label">${t('selectMessagesLabel')}</div>
        <div class="grid" data-role="grid"></div>
      </div>
      <div class="section">
        <div class="label">${t('formatLabel')}</div>
        <div class="seg" data-role="format">
          <button class="seg-btn" type="button" data-format="markdown" data-active="1" aria-label="${t('formatMarkdown')}">${fileCodeIcon}<span>${t('formatMarkdown')}</span></button>
          <button class="seg-btn" type="button" data-format="pdf" data-active="0" aria-label="${t('formatPdf')}">${fileTextIcon}<span>${t('formatPdf')}</span></button>
        </div>
      </div>
    </div>
    <div class="footer">
      <div class="left-actions">
        <button class="btn" type="button" data-action="select_all">${t('selectAll')}</button>
        <button class="btn" type="button" data-action="deselect_all">${t('deselectAll')}</button>
      </div>
      <div class="count" data-role="count"></div>
      <button class="btn btn--primary" type="button" data-action="save">${t('btnSave')}</button>
    </div>
  </div>
</div>
`;
    }

    private render(): void {
        if (!this.shadow) return;

        // Grid
        const grid = this.shadow.querySelector<HTMLElement>('[data-role="grid"]');
        if (grid) {
            grid.replaceChildren();
            this.turns.forEach((turn, idx) => {
                const b = document.createElement('button');
                b.type = 'button';
                b.className = 'msg-btn';
                b.textContent = String(idx + 1);
                b.dataset.index = String(idx);
                b.dataset.selected = this.state.selected.has(idx) ? '1' : '0';
                b.dataset.tooltip = turn.user;
                b.dataset.tooltipTitle = String(idx + 1);
                b.dataset.tooltipVariant = 'preview';
                b.addEventListener('click', () => {
                    if (this.state.selected.has(idx)) this.state.selected.delete(idx);
                    else this.state.selected.add(idx);
                    b.dataset.selected = this.state.selected.has(idx) ? '1' : '0';
                    this.updateFooter();
                });
                grid.appendChild(b);
            });
        }

        // Format (active state only; handlers are bound once in `open()`).
        const formatWrap = this.shadow.querySelector<HTMLElement>('[data-role="format"]');
        formatWrap?.querySelectorAll<HTMLElement>('[data-format]').forEach((el) => {
            el.dataset.active = el.getAttribute('data-format') === this.state.format ? '1' : '0';
        });

        this.updateFooter();
        this.tooltipDelegate?.refresh(this.shadow);
    }

    private bindFormatHandlers(): void {
        if (!this.shadow) return;
        const wrap = this.shadow.querySelector<HTMLElement>('[data-role="format"]');
        if (!wrap) return;
        wrap.addEventListener('click', (e) => {
            const target = e.target as HTMLElement | null;
            const btn = target?.closest?.('[data-format]') as HTMLElement | null;
            if (!btn) return;
            const next = (btn.getAttribute('data-format') as SaveFormat) || 'markdown';
            if (next === this.state.format) return;
            this.state.format = next;
            wrap.querySelectorAll<HTMLElement>('[data-format]').forEach((el) => {
                el.dataset.active = el.getAttribute('data-format') === next ? '1' : '0';
            });
        });
    }

    private updateFooter(): void {
        if (!this.shadow) return;
        const count = this.shadow.querySelector<HTMLElement>('[data-role="count"]');
        if (count) {
            count.textContent = t('selectedCountMessages', [`${this.state.selected.size}`, `${this.state.turnsCount}`]);
        }
        const saveBtn = this.shadow.querySelector<HTMLButtonElement>('[data-action="save"]');
        if (saveBtn) {
            saveBtn.disabled = this.state.selected.size === 0 || this.state.saving;
            saveBtn.textContent = this.state.saving ? t('saving') : t('btnSave');
        }
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
        this.updateFooter();

        try {
            const selectedIndices = Array.from(this.state.selected).sort((a, b) => a - b);
            const res =
                this.state.format === 'pdf'
                    ? await exportTurnsPdf(this.turns, selectedIndices, this.metadata, { t: this.exportT })
                    : await exportTurnsMarkdown(this.turns, selectedIndices, this.metadata, { t: this.exportT });

            if (!res.ok) {
                // Keep dialog open; user can retry.
                return;
            }
            this.close();
        } finally {
            this.state.saving = false;
            this.updateFooter();
        }
    }

}

export const saveMessagesDialog = new SaveMessagesDialog();
