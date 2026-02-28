import type { Theme } from '../../core/types/theme';
import { browser } from '../../drivers/shared/browser';
import { getTokenCss } from '../../style/tokens';
import { ensureStyle } from '../../style/shadow';

type ToolbarState = {
    platform: string;
    theme: Theme;
    latexClickMode: boolean;
    status: { kind: 'idle' | 'info' | 'success' | 'error'; text: string };
};

export type ToolbarActions = {
    onCopyMarkdown?: () => Promise<{ ok: true } | { ok: false; message: string }>;
    onToggleLatexClickMode?: (nextEnabled: boolean) => Promise<{ ok: true; enabled: boolean } | { ok: false; message: string }>;
};

export class RewriteToolbar {
    private host: HTMLElement | null = null;
    private shadow: ShadowRoot | null = null;
    private state: ToolbarState;
    private actions: ToolbarActions;

    constructor(initial: Omit<ToolbarState, 'latexClickMode' | 'status'>, actions: ToolbarActions = {}) {
        this.state = {
            ...initial,
            latexClickMode: false,
            status: { kind: 'idle', text: '' },
        };
        this.actions = actions;
    }

    mount(): void {
        if (this.host) return;

        const host = document.createElement('div');
        host.id = 'aimd-rewrite-toolbar-host';
        host.style.position = 'fixed';
        host.style.top = '12px';
        host.style.right = '12px';
        host.style.zIndex = 'var(--aimd-z-panel)';

        const shadow = host.attachShadow({ mode: 'open' });
        ensureStyle(shadow, getTokenCss(this.state.theme) + this.getCss());
        shadow.innerHTML = this.getHtml();

        const closeBtn = shadow.querySelector<HTMLButtonElement>('[data-action="close"]');
        closeBtn?.addEventListener('click', () => this.unmount());

        const copyBtn = shadow.querySelector<HTMLButtonElement>('[data-action="copy_markdown"]');
        copyBtn?.addEventListener('click', () => void this.handleCopyMarkdown());

        const latexBtn = shadow.querySelector<HTMLButtonElement>('[data-action="toggle_latex_click"]');
        latexBtn?.addEventListener('click', () => void this.handleToggleLatexClickMode());

        document.documentElement.appendChild(host);
        this.host = host;
        this.shadow = shadow;

        this.render();
    }

    unmount(): void {
        this.host?.remove();
        this.host = null;
        this.shadow = null;
    }

    toggle(): void {
        if (this.host) this.unmount();
        else this.mount();
    }

    setTheme(theme: Theme): void {
        this.state.theme = theme;
        if (!this.shadow) return;
        // Re-apply tokens by replacing the first style tag (cheap for foundation).
        const style = this.shadow.querySelector('style');
        if (style) style.textContent = getTokenCss(theme) + this.getCss();
        this.render();
    }

    setLatexClickMode(enabled: boolean): void {
        this.state.latexClickMode = enabled;
        this.render();
    }

    private setStatus(kind: ToolbarState['status']['kind'], text: string, ttlMs: number = 1800): void {
        this.state.status = { kind, text };
        this.render();
        if (kind === 'idle') return;
        window.setTimeout(() => {
            if (this.state.status.kind !== kind || this.state.status.text !== text) return;
            this.state.status = { kind: 'idle', text: '' };
            this.render();
        }, ttlMs);
    }

    private async handleCopyMarkdown(): Promise<void> {
        if (!this.shadow) return;
        const btn = this.shadow.querySelector<HTMLButtonElement>('[data-action="copy_markdown"]');
        if (!btn) return;
        if (!this.actions.onCopyMarkdown) {
            this.setStatus('error', 'Copy not available on this page.');
            return;
        }

        try {
            btn.disabled = true;
            this.setStatus('info', 'Copying…', 1200);
            const res = await this.actions.onCopyMarkdown();
            if (res.ok) this.setStatus('success', 'Copied!');
            else this.setStatus('error', res.message || 'Copy failed.');
        } catch {
            this.setStatus('error', 'Copy failed.');
        } finally {
            btn.disabled = false;
        }
    }

    private async handleToggleLatexClickMode(): Promise<void> {
        if (!this.shadow) return;
        const btn = this.shadow.querySelector<HTMLButtonElement>('[data-action="toggle_latex_click"]');
        if (!btn) return;
        if (!this.actions.onToggleLatexClickMode) {
            this.setStatus('error', 'LaTeX mode not available.');
            return;
        }

        try {
            btn.disabled = true;
            const next = !this.state.latexClickMode;
            const res = await this.actions.onToggleLatexClickMode(next);
            if (res.ok) {
                this.state.latexClickMode = res.enabled;
                this.setStatus('success', res.enabled ? 'LaTeX click: ON' : 'LaTeX click: OFF', 1200);
            } else {
                this.setStatus('error', res.message || 'Failed.');
            }
        } catch {
            this.setStatus('error', 'Failed.');
        } finally {
            btn.disabled = false;
            this.render();
        }
    }

    private render(): void {
        if (!this.shadow) return;
        const version = browser.runtime.getManifest().version;
        const platformEl = this.shadow.querySelector('[data-field="platform"]');
        const versionEl = this.shadow.querySelector('[data-field="version"]');
        const themeEl = this.shadow.querySelector('[data-field="theme"]');
        const latexEl = this.shadow.querySelector('[data-field="latex_mode"]');
        const statusEl = this.shadow.querySelector('[data-field="status"]');
        const statusBox = this.shadow.querySelector<HTMLElement>('[data-role="status_box"]');
        if (platformEl) platformEl.textContent = this.state.platform;
        if (versionEl) versionEl.textContent = version;
        if (themeEl) themeEl.textContent = this.state.theme;
        if (latexEl) latexEl.textContent = this.state.latexClickMode ? 'on' : 'off';

        if (statusEl && statusBox) {
            statusEl.textContent = this.state.status.text;
            statusBox.dataset.kind = this.state.status.kind;
            statusBox.style.display = this.state.status.kind === 'idle' ? 'none' : 'block';
        }
    }

    private getHtml(): string {
        return `
<div class="box">
  <div class="row">
    <div class="title">AI-MarkDone Rewrite</div>
    <button class="close" data-action="close" aria-label="Close">×</button>
  </div>
  <div class="meta">
    <div><span class="k">Platform</span><span class="v" data-field="platform"></span></div>
    <div><span class="k">Version</span><span class="v" data-field="version"></span></div>
    <div><span class="k">Theme</span><span class="v" data-field="theme"></span></div>
    <div><span class="k">LaTeX</span><span class="v" data-field="latex_mode"></span></div>
  </div>
  <div class="actions">
    <button class="btn primary" data-action="copy_markdown">Copy Markdown</button>
    <button class="btn" data-action="toggle_latex_click">LaTeX Click Mode</button>
  </div>
  <div class="status" data-role="status_box" data-kind="idle"><span data-field="status"></span></div>
  <div class="hint">Copy module: click “Copy Markdown”, or enable LaTeX mode then click a formula.</div>
</div>
`;
    }

    private getCss(): string {
        return `
.box {
  font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, \"Apple Color Emoji\", \"Segoe UI Emoji\";
  background: var(--aimd-bg-primary);
  color: var(--aimd-text-primary);
  border: 1px solid var(--aimd-border-default);
  border-radius: var(--aimd-radius-lg);
  padding: var(--aimd-space-3);
  width: 260px;
  box-shadow: 0 10px 30px rgba(0,0,0,0.25);
}
.row { display: flex; align-items: center; justify-content: space-between; gap: var(--aimd-space-2); }
.title { font-size: 13px; font-weight: 650; letter-spacing: 0.2px; }
.close {
  all: unset;
  cursor: pointer;
  width: 20px;
  height: 20px;
  display: grid;
  place-items: center;
  border-radius: 6px;
  color: var(--aimd-text-secondary);
}
.close:hover { background: var(--aimd-bg-secondary); }
.meta { margin-top: var(--aimd-space-3); display: grid; gap: 6px; font-size: 12px; }
.k { color: var(--aimd-text-secondary); display: inline-block; width: 72px; }
.v { color: var(--aimd-text-primary); }
.actions { margin-top: var(--aimd-space-3); display: flex; gap: 8px; }
.btn {
  all: unset;
  cursor: pointer;
  user-select: none;
  padding: 6px 10px;
  border-radius: 6px;
  background: var(--aimd-bg-secondary);
  color: var(--aimd-text-primary);
  border: 1px solid var(--aimd-border-default);
  font-size: 12px;
}
.btn:hover { filter: brightness(0.98); }
.btn:disabled { opacity: 0.55; cursor: not-allowed; }
.btn.primary {
  background: var(--aimd-interactive-primary);
  color: var(--aimd-text-on-primary);
  border-color: rgba(255,255,255,0.12);
}
.btn.primary:hover { background: var(--aimd-interactive-primary-hover); }
.status {
  margin-top: 10px;
  padding: 8px 10px;
  border-radius: 6px;
  font-size: 12px;
  border: 1px solid var(--aimd-border-default);
  background: var(--aimd-bg-secondary);
  color: var(--aimd-text-primary);
}
.status[data-kind="success"] { border-color: var(--aimd-state-success-border); }
.status[data-kind="error"] { border-color: var(--aimd-state-error-border); }
.hint { margin-top: var(--aimd-space-3); font-size: 11px; color: var(--aimd-text-secondary); line-height: 1.35; }
`;
    }
}
