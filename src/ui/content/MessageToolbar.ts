import type { Theme } from '../../core/types/theme';
import { getTokenCss } from '../../style/tokens';
import { ensureStyle } from '../../style/shadow';

export type MessageToolbarActions = {
    onCopyMarkdown: () => Promise<{ ok: true } | { ok: false; message: string }>;
};

export class MessageToolbar {
    private host: HTMLElement;
    private shadow: ShadowRoot;
    private actions: MessageToolbarActions;

    constructor(theme: Theme, actions: MessageToolbarActions) {
        this.actions = actions;
        this.host = document.createElement('div');
        this.host.className = 'aimd-message-toolbar-host';
        this.shadow = this.host.attachShadow({ mode: 'open' });
        ensureStyle(this.shadow, getTokenCss(theme) + this.getCss());
        this.shadow.innerHTML = this.getHtml();
        this.bind();
    }

    getElement(): HTMLElement {
        return this.host;
    }

    setTheme(theme: Theme): void {
        const style = this.shadow.querySelector('style');
        if (style) style.textContent = getTokenCss(theme) + this.getCss();
    }

    setPending(pending: boolean): void {
        const btn = this.shadow.querySelector<HTMLButtonElement>('[data-action="copy"]');
        const note = this.shadow.querySelector<HTMLElement>('[data-field="note"]');
        if (btn) btn.disabled = pending;
        if (note) note.textContent = pending ? 'Streaming…' : '';
    }

    private bind(): void {
        const btn = this.shadow.querySelector<HTMLButtonElement>('[data-action="copy"]');
        btn?.addEventListener('click', () => void this.handleCopy());
    }

    private setStatus(kind: 'idle' | 'info' | 'success' | 'error', text: string): void {
        const el = this.shadow.querySelector<HTMLElement>('[data-field="status"]');
        const box = this.shadow.querySelector<HTMLElement>('[data-role="status_box"]');
        if (!el || !box) return;
        el.textContent = text;
        box.dataset.kind = kind;
        box.style.display = kind === 'idle' ? 'none' : 'block';
    }

    private async handleCopy(): Promise<void> {
        const btn = this.shadow.querySelector<HTMLButtonElement>('[data-action="copy"]');
        if (!btn) return;
        try {
            btn.disabled = true;
            this.setStatus('info', 'Copying…');
            const res = await this.actions.onCopyMarkdown();
            if (res.ok) this.setStatus('success', 'Copied');
            else this.setStatus('error', res.message || 'Copy failed');
        } catch {
            this.setStatus('error', 'Copy failed');
        } finally {
            window.setTimeout(() => this.setStatus('idle', ''), 1200);
            btn.disabled = false;
        }
    }

    private getHtml(): string {
        return `
<div class="bar">
  <button class="btn" data-action="copy">Copy Markdown</button>
  <span class="note" data-field="note"></span>
  <span class="status" data-role="status_box" data-kind="idle"><span data-field="status"></span></span>
</div>
`;
    }

    private getCss(): string {
        return `
.bar {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 8px 0 0 0;
  padding: 6px 8px;
  border: 1px solid var(--aimd-border-default);
  border-radius: 8px;
  background: var(--aimd-bg-secondary);
  color: var(--aimd-text-primary);
  font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial;
}
.btn {
  all: unset;
  cursor: pointer;
  user-select: none;
  padding: 4px 8px;
  border-radius: 6px;
  background: var(--aimd-interactive-primary);
  color: var(--aimd-text-on-primary);
  font-size: 12px;
  font-weight: 600;
}
.btn:hover { background: var(--aimd-interactive-primary-hover); }
.btn:disabled { opacity: 0.55; cursor: not-allowed; }
.note { font-size: 12px; color: var(--aimd-text-secondary); }
.status {
  font-size: 12px;
  padding: 2px 6px;
  border-radius: 999px;
  border: 1px solid var(--aimd-border-default);
}
.status[data-kind="success"] { border-color: var(--aimd-state-success-border); }
.status[data-kind="error"] { border-color: var(--aimd-state-error-border); }
`;
    }
}
