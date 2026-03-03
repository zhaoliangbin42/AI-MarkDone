import type { Theme } from '../../../core/types/theme';
import type { SiteAdapter } from '../../../drivers/content/adapters/base';
import { ensureStyle } from '../../../style/shadow';
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
    private adapter: SiteAdapter | null = null;
    private turns: Array<{ user: string; assistant: string; index: number }> = [];
    private metadata: { url: string; exportedAt: string; title: string; count: number; platform: string } | null = null;
    private tooltipTimer: number | null = null;
    private tooltipEl: HTMLElement | null = null;
    private prevHtmlOverflow: string | null = null;
    private prevBodyOverflow: string | null = null;
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

        // Scroll lock (dialog parity with bookmarks panel).
        if (this.prevHtmlOverflow === null) {
            this.prevHtmlOverflow = document.documentElement.style.overflow || '';
            document.documentElement.style.overflow = 'hidden';
        }
        if (this.prevBodyOverflow === null) {
            this.prevBodyOverflow = document.body.style.overflow || '';
            document.body.style.overflow = 'hidden';
        }

        const host = document.createElement('div');
        host.id = 'aimd-save-messages-dialog-host';
        host.style.position = 'fixed';
        host.style.inset = '0';
        host.style.zIndex = 'var(--aimd-z-panel)';

        const shadow = host.attachShadow({ mode: 'open' });
        shadow.innerHTML = this.getHtml();
        ensureStyle(shadow, getTokenCss(theme) + getSaveMessagesDialogCss(theme));

        this.host = host;
        this.shadow = shadow;

        shadow.querySelector<HTMLElement>('[data-role="overlay"]')?.addEventListener('click', (e) => {
            if (e.target === e.currentTarget) this.close();
        });
        shadow.querySelector<HTMLButtonElement>('[data-action="close"]')?.addEventListener('click', () => this.close());
        shadow.querySelector<HTMLButtonElement>('[data-action="select_all"]')?.addEventListener('click', () => this.selectAll());
        shadow.querySelector<HTMLButtonElement>('[data-action="deselect_all"]')?.addEventListener('click', () => this.deselectAll());
        shadow.querySelector<HTMLButtonElement>('[data-action="save"]')?.addEventListener('click', () => void this.save());
        this.bindFormatHandlers();

        shadow.addEventListener('keydown', (e) => {
            const ev = e as KeyboardEvent;
            if (ev.key === 'Escape') {
                ev.preventDefault();
                ev.stopPropagation();
                this.close();
                return;
            }
            ev.stopPropagation();
        });

        document.documentElement.appendChild(host);

        this.render();
    }

    close(): void {
        if (this.tooltipTimer) {
            window.clearTimeout(this.tooltipTimer);
            this.tooltipTimer = null;
        }
        this.hideTooltip();

        this.host?.remove();
        this.host = null;
        this.shadow = null;
        this.adapter = null;
        this.turns = [];
        this.metadata = null;
        this.state.selected.clear();

        if (this.prevHtmlOverflow !== null) {
            document.documentElement.style.overflow = this.prevHtmlOverflow;
            this.prevHtmlOverflow = null;
        }
        if (this.prevBodyOverflow !== null) {
            document.body.style.overflow = this.prevBodyOverflow;
            this.prevBodyOverflow = null;
        }
    }

    private getHtml(): string {
        return `
<div class="overlay" data-role="overlay">
  <div class="panel" role="dialog" aria-modal="true" aria-label="${t('saveMessagesTitle')}">
    <div class="header">
      <div class="title">${t('saveMessagesTitle')}</div>
      <button class="icon" type="button" data-action="close" aria-label="${t('btnClose')}" title="${t('btnClose')}">${xIcon}</button>
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
                b.addEventListener('click', () => {
                    if (this.state.selected.has(idx)) this.state.selected.delete(idx);
                    else this.state.selected.add(idx);
                    b.dataset.selected = this.state.selected.has(idx) ? '1' : '0';
                    this.updateFooter();
                });
                b.addEventListener('mouseenter', () => this.showTooltip(b, turn.user));
                b.addEventListener('mouseleave', () => this.hideTooltip());
                grid.appendChild(b);
            });
        }

        // Format (active state only; handlers are bound once in `open()`).
        const formatWrap = this.shadow.querySelector<HTMLElement>('[data-role="format"]');
        formatWrap?.querySelectorAll<HTMLElement>('[data-format]').forEach((el) => {
            el.dataset.active = el.getAttribute('data-format') === this.state.format ? '1' : '0';
        });

        this.updateFooter();
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

    private showTooltip(btn: HTMLElement, userPrompt: string): void {
        if (!this.shadow) return;
        if (this.tooltipTimer) window.clearTimeout(this.tooltipTimer);

        this.tooltipTimer = window.setTimeout(() => {
            this.hideTooltip();
            const overlay = this.shadow?.querySelector<HTMLElement>('[data-role="overlay"]');
            if (!overlay) return;

            const tooltip = document.createElement('div');
            tooltip.className = 'tooltip';
            tooltip.dataset.open = '0';
            const maxLen = 100;
            tooltip.textContent = userPrompt.length > maxLen ? `${userPrompt.slice(0, maxLen - 3)}...` : userPrompt;
            overlay.appendChild(tooltip);
            this.tooltipEl = tooltip;

            const btnRect = btn.getBoundingClientRect();
            const overlayRect = overlay.getBoundingClientRect();
            const left = btnRect.left - overlayRect.left + btnRect.width / 2;
            const top = btnRect.top - overlayRect.top;
            tooltip.style.left = `${left}px`;
            tooltip.style.top = `${top}px`;
            tooltip.style.transform = 'translate(-50%, -6px)';

            window.requestAnimationFrame(() => {
                tooltip.dataset.open = '1';
            });
        }, 150);
    }

    private hideTooltip(): void {
        if (this.tooltipTimer) {
            window.clearTimeout(this.tooltipTimer);
            this.tooltipTimer = null;
        }
        if (this.tooltipEl) {
            this.tooltipEl.remove();
            this.tooltipEl = null;
        }
    }
}

export const saveMessagesDialog = new SaveMessagesDialog();
