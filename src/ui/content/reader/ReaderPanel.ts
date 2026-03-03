import type { Theme } from '../../../core/types/theme';
import { browser } from '../../../drivers/shared/browser';
import { getTokenCss } from '../../../style/tokens';
import { ensureStyle } from '../../../style/shadow';
import type { ReaderItem } from '../../../services/reader/types';
import { resolveContent } from '../../../services/reader/types';
import { renderMarkdownToSanitizedHtml } from '../../../services/renderer/renderMarkdown';
import { copyTextToClipboard } from '../../../drivers/content/clipboard/clipboard';
import { copyIcon, fileCodeIcon, xIcon } from '../../../assets/icons';
import { createIcon } from '../components/Icon';
import { sourcePanel } from '../source/sourcePanelSingleton';
import { t } from '../components/i18n';

export type ReaderPanelActionContext = {
    item: ReaderItem;
    index: number;
    items: ReaderItem[];
    anchorEl?: HTMLElement;
    shadow?: ShadowRoot;
};

export type ReaderPanelAction = {
    id: string;
    label: string;
    icon?: string;
    tooltip?: string;
    kind?: 'default' | 'primary' | 'danger';
    placement?: 'header' | 'footer_left';
    toggle?: boolean;
    onClick: (ctx: ReaderPanelActionContext) => void | Promise<void>;
};

export type ReaderPanelShowOptions = {
    showNav?: boolean;
    showCopy?: boolean;
    showSource?: boolean;
    actions?: ReaderPanelAction[];
    initialView?: 'render' | 'source';
};

type ReaderPanelState = {
    theme: Theme;
    items: ReaderItem[];
    index: number;
    visible: boolean;
    options: Required<Pick<ReaderPanelShowOptions, 'showNav' | 'showCopy' | 'showSource' | 'initialView'>> & { actions: ReaderPanelAction[] };
};

export class ReaderPanel {
    private host: HTMLElement | null = null;
    private shadow: ShadowRoot | null = null;
    private state: ReaderPanelState = {
        theme: 'light',
        items: [],
        index: 0,
        visible: false,
        options: { showNav: true, showCopy: true, showSource: true, initialView: 'render', actions: [] },
    };

    setTheme(theme: Theme): void {
        this.state.theme = theme;
        const style = this.shadow?.querySelector('style');
        if (style) {
            style.textContent = this.getCss();
        }
        this.render();
    }

    async show(items: ReaderItem[], startIndex: number, theme: Theme, options?: ReaderPanelShowOptions): Promise<void> {
        this.state.items = items;
        this.state.index = Math.max(0, Math.min(startIndex, Math.max(0, items.length - 1)));
        this.state.theme = theme;
        this.state.visible = true;
        this.state.options = {
            showNav: options?.showNav ?? true,
            showCopy: options?.showCopy ?? true,
            showSource: options?.showSource ?? true,
            initialView: options?.initialView ?? 'render',
            actions: options?.actions ?? [],
        };

        this.mount();
        if (this.state.options.initialView === 'source') {
            void this.openSourcePanel();
        }
        await this.renderBody();
        this.render();
    }

    hide(): void {
        this.state.visible = false;
        this.unmount();
    }

    notify(text: string, timeoutMs: number = 1400): void {
        this.setStatus(text);
        window.setTimeout(() => this.setStatus(''), timeoutMs);
    }

    private mount(): void {
        if (this.host) return;

        const host = document.createElement('div');
        host.id = 'aimd-reader-panel-host';
        host.style.position = 'fixed';
        host.style.inset = '0';
        host.style.zIndex = 'var(--aimd-z-panel)';

        const shadow = host.attachShadow({ mode: 'open' });
        shadow.innerHTML = this.getHtml();
        // Why: `innerHTML` replaces the whole shadow tree. Inject styles after template mount.
        ensureStyle(shadow, this.getCss());

        const overlay = shadow.querySelector<HTMLElement>('[data-role="overlay"]');
        overlay?.addEventListener('click', () => this.hide());

        shadow.querySelector<HTMLButtonElement>('[data-action="close"]')?.addEventListener('click', () => this.hide());
        shadow.querySelector<HTMLButtonElement>('[data-action="prev"]')?.addEventListener('click', () => void this.go(-1));
        shadow.querySelector<HTMLButtonElement>('[data-action="next"]')?.addEventListener('click', () => void this.go(1));
        shadow.querySelector<HTMLButtonElement>('[data-action="copy"]')?.addEventListener('click', () => void this.copyCurrent());
        shadow.querySelector<HTMLButtonElement>('[data-action="source"]')?.addEventListener('click', () => void this.openSourcePanel());

        document.documentElement.appendChild(host);
        this.host = host;
        this.shadow = shadow;
    }

    private unmount(): void {
        this.host?.remove();
        this.host = null;
        this.shadow = null;
    }

    private async go(delta: number): Promise<void> {
        const next = this.state.index + delta;
        if (next < 0 || next >= this.state.items.length) return;
        this.state.index = next;
        await this.renderBody();
        this.render();
    }

    private jumpTo(index: number): void {
        const next = Math.max(0, Math.min(index, this.state.items.length - 1));
        if (next === this.state.index) return;
        void this.go(next - this.state.index);
    }

    private async renderBody(): Promise<void> {
        if (!this.shadow) return;
        const item = this.state.items[this.state.index];
        const container = this.shadow.querySelector<HTMLElement>('[data-role="content"]');
        if (!container || !item) return;

        const markdown = await resolveContent(item.content);

        const html = renderMarkdownToSanitizedHtml(markdown);
        this.applyHtml(container, html);
        container.scrollTop = 0;
    }

    private async copyCurrent(): Promise<void> {
        if (!this.shadow) return;
        const item = this.state.items[this.state.index];
        if (!item) return;

        const btn = this.shadow.querySelector<HTMLButtonElement>('[data-action="copy"]');
        if (!btn) return;

        try {
            btn.disabled = true;
            const markdown = await resolveContent(item.content);
            const ok = await copyTextToClipboard(markdown);
            this.setStatus(ok ? 'Copied' : 'Copy failed');
        } finally {
            window.setTimeout(() => this.setStatus(''), 1200);
            btn.disabled = false;
        }
    }

    private async openSourcePanel(): Promise<void> {
        const item = this.state.items[this.state.index];
        if (!item) return;
        const markdown = await resolveContent(item.content);
        sourcePanel.show({ theme: this.state.theme, title: t('modalSourceTitle'), content: markdown });
    }

    private setStatus(text: string): void {
        if (!this.shadow) return;
        const el = this.shadow.querySelector<HTMLElement>('[data-field="status"]');
        if (el) el.textContent = text;
    }

    private render(): void {
        if (!this.shadow) return;

        const total = this.state.items.length;
        const idx = this.state.index;
        const item = this.state.items[idx];

        const titleEl = this.shadow.querySelector<HTMLElement>('[data-field="title"]');
        const counterEl = this.shadow.querySelector<HTMLElement>('[data-field="counter"]');
        if (titleEl) titleEl.textContent = item ? item.userPrompt : 'Reader';
        if (counterEl) counterEl.textContent = total > 0 ? `${idx + 1}/${total}` : '';

        this.renderActions();
        this.renderDots();

        const prevBtn = this.shadow.querySelector<HTMLButtonElement>('[data-action="prev"]');
        const nextBtn = this.shadow.querySelector<HTMLButtonElement>('[data-action="next"]');
        if (prevBtn) prevBtn.disabled = idx <= 0;
        if (nextBtn) nextBtn.disabled = idx >= total - 1;
    }

    private renderActions(): void {
        if (!this.shadow) return;

        const total = this.state.items.length;
        const opts = this.state.options;

        const nav = this.shadow.querySelector<HTMLElement>('[data-role="nav"]');
        if (nav) nav.style.display = opts.showNav && total > 1 ? 'grid' : 'none';

        const copyBtn = this.shadow.querySelector<HTMLButtonElement>('[data-action="copy"]');
        if (copyBtn) copyBtn.style.display = opts.showCopy ? 'grid' : 'none';

        const sourceBtn = this.shadow.querySelector<HTMLButtonElement>('[data-action="source"]');
        if (sourceBtn) sourceBtn.style.display = opts.showSource ? 'grid' : 'none';

        const custom = this.shadow.querySelector<HTMLElement>('[data-role="custom_actions"]');
        if (!custom) return;
        const footerLeft = this.shadow.querySelector<HTMLElement>('[data-role="footer_left_actions"]');
        custom.replaceChildren();
        footerLeft?.replaceChildren();
        for (const action of opts.actions) {
            const btn = document.createElement('button');
            btn.type = 'button';
            if (action.icon) {
                btn.className = `icon ${action.kind === 'primary' ? 'icon--primary' : action.kind === 'danger' ? 'icon--danger' : ''}`.trim();
                btn.title = action.tooltip || action.label;
                btn.setAttribute('aria-label', action.label);
                btn.appendChild(createIcon(action.icon));
            } else {
                btn.className = `chip ${action.kind === 'primary' ? 'chip--primary' : action.kind === 'danger' ? 'chip--danger' : ''}`.trim();
                btn.textContent = action.label;
                btn.setAttribute('aria-label', action.label);
            }
            btn.addEventListener('click', async () => {
                const ctx = this.getActionContext();
                if (!ctx) return;
                try {
                    btn.disabled = true;
                    await action.onClick({ ...ctx, anchorEl: btn, shadow: this.shadow || undefined });
                } finally {
                    btn.disabled = false;
                }
            });
            const placement = action.placement || 'header';
            if (placement === 'footer_left' && footerLeft) footerLeft.appendChild(btn);
            else custom.appendChild(btn);
        }
    }

    private renderDots(): void {
        if (!this.shadow) return;
        const dots = this.shadow.querySelector<HTMLElement>('[data-role="dots"]');
        if (!dots) return;
        const total = this.state.items.length;
        const idx = this.state.index;
        dots.replaceChildren();
        if (total <= 1) return;

        const sizing = this.calculateDotSizing(total);
        dots.style.setProperty('--aimd-dot-size', `${sizing.size}px`);
        dots.style.setProperty('--aimd-dot-gap', `${sizing.gap}px`);

        // When the total is reasonable, render all dots (legacy-inspired, very scan-friendly).
        // For very large conversations, fall back to a windowed control to avoid hundreds of nodes.
        const renderAllThreshold = 60;
        if (total <= renderAllThreshold) {
            for (let i = 0; i < total; i += 1) {
                dots.appendChild(this.createDot(i, i === idx));
            }
            return;
        }

        const maxDots = 11;
        const windowSize = Math.min(maxDots, total);
        const half = Math.floor(windowSize / 2);
        let start = Math.max(0, idx - half);
        let end = Math.min(total - 1, start + windowSize - 1);
        start = Math.max(0, end - windowSize + 1);

        const pushEllipsis = () => {
            const el = document.createElement('span');
            el.className = 'ellipsis';
            el.textContent = '…';
            el.setAttribute('aria-hidden', 'true');
            dots.appendChild(el);
        };

        if (start > 0) {
            dots.appendChild(this.createDot(0, idx === 0));
            if (start > 1) pushEllipsis();
        }

        for (let i = start; i <= end; i++) {
            if (i === 0 || i === total - 1) continue;
            dots.appendChild(this.createDot(i, i === idx));
        }

        if (end < total - 1) {
            if (end < total - 2) pushEllipsis();
            dots.appendChild(this.createDot(total - 1, idx === total - 1));
        }
    }

    private createDot(index: number, active: boolean): HTMLButtonElement {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = `dot ${active ? 'dot--active' : ''}`.trim();
        btn.setAttribute('aria-label', `Go to ${index + 1}`);
        btn.title = `${index + 1}`;
        btn.addEventListener('click', () => this.jumpTo(index));
        return btn;
    }

    private calculateDotSizing(total: number): { size: number; gap: number } {
        // Legacy-inspired tiers (also keeps "Apple page control" density reasonable).
        if (total <= 10) return { size: 10, gap: 10 };
        if (total <= 20) return { size: 9, gap: 8 };
        if (total <= 35) return { size: 8, gap: 6 };
        if (total <= 50) return { size: 7, gap: 5 };
        return { size: 6, gap: 4 };
    }

    private getActionContext(): ReaderPanelActionContext | null {
        const item = this.state.items[this.state.index] ?? null;
        if (!item) return null;
        return { item, index: this.state.index, items: this.state.items };
    }

    private getHtml(): string {
        return `
<div class="overlay" data-role="overlay"></div>
<div class="panel" role="dialog" aria-modal="true" aria-label="Reader">
  <div class="header">
    <div class="title" data-field="title"></div>
    <div class="header-right">
      <div class="counter" data-field="counter"></div>
      <div class="custom-actions" data-role="custom_actions"></div>
      <button class="icon" data-action="copy" aria-label="Copy" title="Copy">${copyIcon}</button>
      <button class="icon" data-action="source" aria-label="Source" title="Source">${fileCodeIcon}</button>
      <button class="icon" data-action="close" aria-label="Close" title="Close">${xIcon}</button>
    </div>
  </div>
  <div class="body">
    <div class="markdown-body" data-role="content"></div>
  </div>
  <div class="footer">
    <div class="footer-left" data-role="footer_left_actions"></div>
    <div class="dots" data-role="dots" aria-label="Pagination"></div>
    <div class="nav" data-role="nav">
      <button class="nav-btn" data-action="prev" aria-label="Previous">‹</button>
      <button class="nav-btn" data-action="next" aria-label="Next">›</button>
    </div>
    <div class="status" data-field="status"></div>
  </div>
</div>
`;
    }

    private getCss(): string {
        const katexUrl = (() => {
            try {
                return browser.runtime.getURL('vendor/katex/katex.min.css');
            } catch {
                return '';
            }
        })();

        return `
${getTokenCss(this.state.theme)}
${katexUrl ? `@import url("${katexUrl}");` : ''}

/* Reset (shadow-scoped) */
*, *::before, *::after { box-sizing: border-box; }
button, input, select, textarea { font-family: inherit; font-size: inherit; line-height: inherit; color: inherit; }

.overlay {
  position: fixed;
  inset: 0;
  background: var(--aimd-overlay-bg);
}

.panel {
  position: fixed;
  top: var(--aimd-panel-top);
  left: 50%;
  transform: translateX(-50%);
  width: var(--aimd-panel-width);
  max-width: var(--aimd-panel-max-width);
  height: var(--aimd-panel-height);
  /* Gmail/Material-like solid surface (no blur/sheens). */
  background: var(--aimd-bg-primary);
  color: var(--aimd-text-primary);
  border: 1px solid var(--aimd-border-default);
  border-radius: 16px;
  box-shadow: var(--aimd-shadow-panel);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--aimd-space-2);
  padding: 12px 14px;
  background: var(--aimd-bg-primary);
  border-bottom: 1px solid var(--aimd-border-default);
}

.title {
  font-size: var(--aimd-font-size-sm);
  font-weight: 650;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
  min-width: 0;
}

.header-right { display: flex; align-items: center; gap: 8px; }
.counter { font-size: var(--aimd-font-size-xs); color: var(--aimd-text-secondary); }

.icon {
  all: unset;
  cursor: pointer;
  width: 34px;
  height: 34px;
  display: grid;
  place-items: center;
  border-radius: 999px;
  color: color-mix(in srgb, var(--aimd-text-primary) 82%, transparent);
  border: 1px solid transparent;
  background: transparent;
  transition: background 150ms ease, transform 120ms ease;
}
.icon svg { width: 18px; height: 18px; display: block; }
.icon:hover {
  background: color-mix(in srgb, var(--aimd-text-primary) 8%, transparent);
}
.icon:active { transform: none; background: color-mix(in srgb, var(--aimd-text-primary) 14%, transparent); }
.icon:focus-visible { outline: 2px solid color-mix(in srgb, var(--aimd-interactive-primary) 70%, transparent); outline-offset: 2px; }
.icon--primary {
  background: var(--aimd-interactive-primary);
  border-color: transparent;
  color: var(--aimd-text-on-primary);
  box-shadow: none;
}
.icon--primary:hover { background: var(--aimd-interactive-primary-hover); }
.icon--danger {
  background: color-mix(in srgb, var(--aimd-state-error-border) 16%, transparent);
  border-color: transparent;
  color: var(--aimd-text-primary);
  box-shadow: none;
}
.icon--danger:hover { background: color-mix(in srgb, var(--aimd-state-error-border) 24%, transparent); }

.body {
  flex: 1;
  overflow: auto;
  padding: 14px 16px 10px;
}

.footer {
  display: grid;
  grid-template-columns: auto 1fr auto auto;
  align-items: center;
  gap: 12px;
  padding: 10px 14px;
  background: var(--aimd-bg-primary);
  border-top: 1px solid var(--aimd-border-default);
}

.footer-left {
  position: relative;
  justify-self: start;
  display: flex;
  align-items: center;
  min-width: 0;
}

.custom-actions { display: flex; gap: 8px; align-items: center; }
.dots {
  justify-self: center;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--aimd-dot-gap, 8px);
  min-width: 0;
  max-width: 100%;
  flex-wrap: wrap;
}
.ellipsis { color: var(--aimd-text-secondary); font-size: 12px; padding: 0 2px; }
.dot {
  all: unset;
  cursor: pointer;
  width: var(--aimd-dot-size, 8px);
  height: var(--aimd-dot-size, 8px);
  border-radius: 999px;
  background: color-mix(in srgb, var(--aimd-text-secondary) 38%, transparent);
  transition: transform 160ms ease, background 160ms ease, width 160ms ease;
}
.dot:hover { background: color-mix(in srgb, var(--aimd-text-secondary) 68%, transparent); transform: scale(1.18); }
.dot--active {
  width: calc(var(--aimd-dot-size, 8px) * 1.7);
  background: color-mix(in srgb, var(--aimd-interactive-primary) 78%, transparent);
}
.nav { justify-self: end; display: grid; grid-auto-flow: column; gap: 8px; align-items: center; }
.nav-btn {
  all: unset;
  cursor: pointer;
  width: 30px;
  height: 30px;
  border-radius: 999px;
  display: grid;
  place-items: center;
  background: transparent;
  border: 1px solid transparent;
  color: var(--aimd-text-primary);
  font-size: 18px;
  line-height: 1;
}
.nav-btn:hover { background: color-mix(in srgb, var(--aimd-text-primary) 8%, transparent); }
.nav-btn:disabled { opacity: 0.45; cursor: not-allowed; }
.nav-btn:focus-visible { outline: 2px solid color-mix(in srgb, var(--aimd-interactive-primary) 70%, transparent); outline-offset: 2px; }

.chip {
  all: unset;
  cursor: pointer;
  user-select: none;
  padding: 6px 10px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--aimd-bg-primary) 28%, transparent);
  border: 1px solid color-mix(in srgb, var(--aimd-border-default) 55%, transparent);
  font-size: var(--aimd-font-size-xs);
  color: var(--aimd-text-primary);
}
.chip:hover { background: color-mix(in srgb, var(--aimd-bg-primary) 42%, transparent); }
.chip:disabled { opacity: 0.55; cursor: not-allowed; }
.chip--primary { background: color-mix(in srgb, var(--aimd-interactive-primary) 92%, transparent); color: var(--aimd-text-on-primary); border-color: transparent; }
.chip--primary:hover { background: color-mix(in srgb, var(--aimd-interactive-primary-hover) 92%, transparent); }
.chip--danger { border-color: var(--aimd-state-error-border); }

.status {
  justify-self: end;
  font-size: var(--aimd-font-size-xs);
  color: var(--aimd-text-secondary);
  white-space: nowrap;
  min-width: 0;
}

/* Send popover (Reader footer-left) */
.aimd-send-popover {
  position: absolute;
  left: 0;
  bottom: calc(100% + 10px);
  width: min(520px, calc(100vw - 48px));
  max-width: 520px;
  background: var(--aimd-bg-primary);
  color: var(--aimd-text-primary);
  border: 1px solid var(--aimd-border-default);
  border-radius: 12px;
  box-shadow: var(--aimd-shadow-panel);
  padding: 10px;
  display: grid;
  gap: 10px;
}
.aimd-send-popover::after {
  content: "";
  position: absolute;
  left: 18px;
  bottom: -7px;
  width: 12px;
  height: 12px;
  background: var(--aimd-bg-primary);
  border-right: 1px solid var(--aimd-border-default);
  border-bottom: 1px solid var(--aimd-border-default);
  transform: rotate(45deg);
}
.aimd-send-popover .head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}
.aimd-send-popover .title {
  font-size: 14px;
  font-weight: 650;
}
.aimd-send-popover .icon {
  width: 34px;
  height: 34px;
  border-radius: 999px;
}
.aimd-send-popover .input {
  width: 100%;
  max-width: 100%;
  box-sizing: border-box;
  resize: vertical;
  min-height: 120px;
  padding: 10px 12px;
  border-radius: 10px;
  border: 1px solid var(--aimd-border-default);
  background: var(--aimd-bg-secondary);
  color: var(--aimd-text-primary);
  font-size: 13px;
  line-height: 1.45;
  outline: none;
}
.aimd-send-popover .input:focus-visible {
  outline: 2px solid color-mix(in srgb, var(--aimd-interactive-primary) 70%, transparent);
  outline-offset: 2px;
}
.aimd-send-popover .foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}
.aimd-send-popover .status {
  min-height: 18px;
  color: var(--aimd-text-secondary);
}
.aimd-send-popover .actions { display: flex; gap: 8px; align-items: center; }
.aimd-send-popover .btn {
  all: unset;
  cursor: pointer;
  user-select: none;
  height: 32px;
  padding: 0 12px;
  border-radius: 999px;
  border: 1px solid color-mix(in srgb, var(--aimd-border-default) 80%, transparent);
  background: transparent;
  color: var(--aimd-text-primary);
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
}
.aimd-send-popover .btn:hover { background: color-mix(in srgb, var(--aimd-text-primary) 8%, transparent); }
.aimd-send-popover .btn:active { background: color-mix(in srgb, var(--aimd-text-primary) 14%, transparent); }
.aimd-send-popover .btn:disabled { opacity: 0.55; cursor: not-allowed; }
.aimd-send-popover .btn--primary {
  background: var(--aimd-interactive-primary);
  border-color: transparent;
  color: var(--aimd-text-on-primary);
}
.aimd-send-popover .btn--primary:hover { background: var(--aimd-interactive-primary-hover); }
.aimd-send-popover .btn--primary .aimd-icon svg { width: 16px; height: 16px; }

/* Markdown styling (shadow-isolated, legacy-inspired) */
.markdown-body {
  margin: 0;
  padding: 0;
  color: var(--aimd-text-primary);
  font-family: -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
  font-size: 15px;
  line-height: 1.65;
  word-wrap: break-word;
}
.markdown-body h1, .markdown-body h2 {
  border-bottom: 1px solid color-mix(in srgb, var(--aimd-border-default) 70%, transparent);
  padding-bottom: 0.3em;
}
.markdown-body code {
  background: color-mix(in srgb, var(--aimd-bg-secondary) 84%, var(--aimd-text-primary) 16%);
  border: 1px solid color-mix(in srgb, var(--aimd-border-default) 70%, transparent);
  padding: 0.16em 0.4em;
  border-radius: 6px;
  font-family: ui-monospace, monospace;
  font-size: 0.9em;
}
.markdown-body pre {
  background: color-mix(in srgb, var(--aimd-bg-secondary) 85%, transparent);
  border: 1px solid color-mix(in srgb, var(--aimd-border-default) 75%, transparent);
  padding: 14px;
  border-radius: 12px;
  overflow: auto;
  margin: 1em 0;
}
.markdown-body pre code { background: transparent; border: none; padding: 0; }
.markdown-body table { border-collapse: collapse; width: 100%; }
.markdown-body th, .markdown-body td { border: 1px solid color-mix(in srgb, var(--aimd-border-default) 75%, transparent); padding: 6px 10px; }
.markdown-body blockquote {
  border-left: 4px solid color-mix(in srgb, var(--aimd-border-default) 85%, transparent);
  padding-left: 14px;
  color: var(--aimd-text-secondary);
}
`;
    }

    private applyHtml(container: HTMLElement, html: string): void {
        const parser = new DOMParser();
        const doc = parser.parseFromString(`<div>${html}</div>`, 'text/html');
        const wrapper = doc.body.firstElementChild as HTMLElement | null;
        if (!wrapper) {
            container.replaceChildren();
            return;
        }
        const fragment = document.createDocumentFragment();
        Array.from(wrapper.childNodes).forEach((node) => fragment.appendChild(node));
        container.replaceChildren(fragment);
    }
}
