import type { Theme } from '../../../core/types/theme';
import { browser } from '../../../drivers/shared/browser';
import { getTokenCss } from '../../../style/tokens';
import { ensureStyle } from '../../../style/shadow';
import type { ReaderItem } from '../../../services/reader/types';
import { resolveContent } from '../../../services/reader/types';
import { renderMarkdownToSanitizedHtml } from '../../../services/renderer/renderMarkdown';
import { copyTextToClipboard } from '../../../drivers/content/clipboard/clipboard';

export type ReaderPanelActionContext = {
    item: ReaderItem;
    index: number;
    items: ReaderItem[];
};

export type ReaderPanelAction = {
    id: string;
    label: string;
    kind?: 'default' | 'primary' | 'danger';
    onClick: (ctx: ReaderPanelActionContext) => void | Promise<void>;
};

export type ReaderPanelShowOptions = {
    showNav?: boolean;
    showCopy?: boolean;
    showSource?: boolean;
    actions?: ReaderPanelAction[];
};

type ReaderPanelState = {
    theme: Theme;
    items: ReaderItem[];
    index: number;
    visible: boolean;
    options: Required<Pick<ReaderPanelShowOptions, 'showNav' | 'showCopy' | 'showSource'>> & { actions: ReaderPanelAction[] };
};

export class ReaderPanel {
    private host: HTMLElement | null = null;
    private shadow: ShadowRoot | null = null;
    private state: ReaderPanelState = {
        theme: 'light',
        items: [],
        index: 0,
        visible: false,
        options: { showNav: true, showCopy: true, showSource: true, actions: [] },
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
            actions: options?.actions ?? [],
        };

        this.mount();
        await this.renderBody();
        this.render();
    }

    hide(): void {
        this.state.visible = false;
        this.unmount();
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
        shadow.querySelector<HTMLButtonElement>('[data-action="source"]')?.addEventListener('click', () => void this.toggleSource());

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

    private async renderBody(): Promise<void> {
        if (!this.shadow) return;
        const item = this.state.items[this.state.index];
        const container = this.shadow.querySelector<HTMLElement>('[data-role="content"]');
        const sourceBox = this.shadow.querySelector<HTMLElement>('[data-role="source"]');
        if (!container || !item) return;

        const markdown = await resolveContent(item.content);
        if (sourceBox) sourceBox.textContent = markdown;

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

    private toggleSource(): void {
        if (!this.shadow) return;
        const el = this.shadow.querySelector<HTMLElement>('[data-role="source_wrap"]');
        if (!el) return;
        const isOpen = el.dataset.open === '1';
        el.dataset.open = isOpen ? '0' : '1';
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
        if (nav) nav.style.display = opts.showNav && total > 1 ? 'flex' : 'none';

        const copyBtn = this.shadow.querySelector<HTMLButtonElement>('[data-action="copy"]');
        if (copyBtn) copyBtn.style.display = opts.showCopy ? 'inline-flex' : 'none';

        const sourceBtn = this.shadow.querySelector<HTMLButtonElement>('[data-action="source"]');
        if (sourceBtn) sourceBtn.style.display = opts.showSource ? 'inline-flex' : 'none';

        const sourceWrap = this.shadow.querySelector<HTMLElement>('[data-role="source_wrap"]');
        if (sourceWrap && !opts.showSource) sourceWrap.dataset.open = '0';

        const custom = this.shadow.querySelector<HTMLElement>('[data-role="custom_actions"]');
        if (!custom) return;
        custom.replaceChildren();
        for (const action of opts.actions) {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = `btn ${action.kind === 'primary' ? 'primary' : action.kind === 'danger' ? 'danger' : ''}`.trim();
            btn.textContent = action.label;
            btn.setAttribute('aria-label', action.label);
            btn.addEventListener('click', async () => {
                const ctx = this.getActionContext();
                if (!ctx) return;
                try {
                    btn.disabled = true;
                    await action.onClick(ctx);
                } finally {
                    btn.disabled = false;
                }
            });
            custom.appendChild(btn);
        }
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
      <button class="icon" data-action="close" aria-label="Close">×</button>
    </div>
  </div>
  <div class="body" data-role="content"></div>
  <div class="footer">
    <div class="nav" data-role="nav">
      <button class="btn" data-action="prev">Prev</button>
      <button class="btn" data-action="next">Next</button>
    </div>
    <div class="actions">
      <div class="custom-actions" data-role="custom_actions"></div>
      <button class="btn primary" data-action="copy">Copy</button>
      <button class="btn" data-action="source">View Source</button>
    </div>
    <div class="status" data-field="status"></div>
  </div>
  <div class="source" data-role="source_wrap" data-open="0">
    <pre class="source-pre" data-role="source"></pre>
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
  background: var(--aimd-bg-primary);
  color: var(--aimd-text-primary);
  border: 1px solid var(--aimd-border-default);
  border-radius: var(--aimd-radius-lg);
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
  padding: var(--aimd-space-3);
  background: var(--aimd-bg-secondary);
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

.header-right { display: flex; align-items: center; gap: var(--aimd-space-2); }
.counter { font-size: var(--aimd-font-size-xs); color: var(--aimd-text-secondary); }

.icon {
  all: unset;
  cursor: pointer;
  width: var(--aimd-size-icon-md);
  height: var(--aimd-size-icon-md);
  display: grid;
  place-items: center;
  border-radius: var(--aimd-radius-md);
  color: var(--aimd-text-secondary);
}
.icon:hover { background: var(--aimd-bg-primary); }

.body {
  flex: 1;
  overflow: auto;
  padding: var(--aimd-space-4);
}

.footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--aimd-space-2);
  padding: var(--aimd-space-3);
  background: var(--aimd-bg-secondary);
  border-top: 1px solid var(--aimd-border-default);
}

.nav, .actions { display: flex; gap: var(--aimd-space-2); align-items: center; }
.custom-actions { display: flex; gap: var(--aimd-space-2); align-items: center; }

.btn {
  all: unset;
  cursor: pointer;
  user-select: none;
  padding: var(--aimd-space-1) var(--aimd-space-2);
  border-radius: var(--aimd-radius-md);
  border: 1px solid var(--aimd-border-default);
  font-size: var(--aimd-font-size-xs);
  color: var(--aimd-text-primary);
}
.btn:hover { background: var(--aimd-bg-primary); }
.btn:disabled { opacity: 0.55; cursor: not-allowed; }
.btn.primary {
  background: var(--aimd-interactive-primary);
  color: var(--aimd-text-on-primary);
  border-color: transparent;
}
.btn.primary:hover { background: var(--aimd-interactive-primary-hover); }
.btn.danger {
  border-color: var(--aimd-state-error-border);
  color: var(--aimd-text-primary);
}
.btn.danger:hover { background: var(--aimd-state-error-bg); }

.status { font-size: var(--aimd-font-size-xs); color: var(--aimd-text-secondary); }

.source {
  display: none;
  border-top: 1px solid var(--aimd-border-default);
}
.source[data-open="1"] { display: block; }
.source-pre {
  margin: 0;
  max-height: var(--aimd-panel-source-max-height);
  overflow: auto;
  padding: var(--aimd-space-3);
  background: var(--aimd-bg-primary);
  color: var(--aimd-text-primary);
  font-size: var(--aimd-font-size-xs);
  white-space: pre-wrap;
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
