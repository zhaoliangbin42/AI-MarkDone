import type { Theme } from '../../core/types/theme';
import { getTokenCss } from '../../style/tokens';
import { ensureStyle } from '../../style/shadow';

export type ToolbarActionResult = { ok: true; message?: string } | { ok: false; message: string };

export type MessageToolbarAction = {
    id: string;
    label: string;
    kind?: 'primary' | 'secondary';
    disabledWhenPending?: boolean;
    onClick: () => Promise<void | ToolbarActionResult>;
};

export class MessageToolbar {
    private host: HTMLElement;
    private shadow: ShadowRoot;
    private actions: MessageToolbarAction[];
    private actionButtons = new Map<string, HTMLButtonElement>();
    private pending: boolean = false;

    constructor(theme: Theme, actions: MessageToolbarAction[]) {
        this.actions = actions;
        this.host = document.createElement('div');
        this.host.className = 'aimd-message-toolbar-host';
        this.shadow = this.host.attachShadow({ mode: 'open' });
        ensureStyle(this.shadow, getTokenCss(theme) + this.getCss());
        this.mount();
    }

    getElement(): HTMLElement {
        return this.host;
    }

    setTheme(theme: Theme): void {
        const style = this.shadow.querySelector('style');
        if (style) style.textContent = getTokenCss(theme) + this.getCss();
    }

    setPending(pending: boolean): void {
        this.pending = pending;
        const note = this.shadow.querySelector<HTMLElement>('[data-field="note"]');
        for (const action of this.actions) {
            if (!action.disabledWhenPending) continue;
            const btn = this.actionButtons.get(action.id);
            if (btn) btn.disabled = pending;
        }
        if (note) note.textContent = pending ? 'Streaming…' : '';
    }

    setActionLabel(actionId: string, label: string): void {
        const btn = this.actionButtons.get(actionId);
        if (!btn) return;
        btn.textContent = label;
    }

    setActionActive(actionId: string, active: boolean): void {
        const btn = this.actionButtons.get(actionId);
        if (!btn) return;
        btn.dataset.active = active ? '1' : '0';
    }

    private mount(): void {
        const wrap = document.createElement('div');
        wrap.className = 'wrap';

        const bar = document.createElement('div');
        bar.className = 'bar';

        for (const action of this.actions) {
            const btn = document.createElement('button');
            btn.className = `btn ${action.kind === 'primary' ? 'primary' : ''}`.trim();
            btn.type = 'button';
            btn.dataset.action = action.id;
            btn.textContent = action.label;
            btn.addEventListener('click', () => void this.handleActionClick(action));
            bar.appendChild(btn);
            this.actionButtons.set(action.id, btn);
        }

        const note = document.createElement('span');
        note.className = 'note';
        note.dataset.field = 'note';
        bar.appendChild(note);

        const statusBox = document.createElement('span');
        statusBox.className = 'status';
        statusBox.dataset.role = 'status_box';
        statusBox.dataset.kind = 'idle';
        statusBox.style.display = 'none';
        const statusText = document.createElement('span');
        statusText.dataset.field = 'status';
        statusBox.appendChild(statusText);
        bar.appendChild(statusBox);

        wrap.appendChild(bar);
        this.shadow.appendChild(wrap);
    }

    private setStatus(kind: 'idle' | 'info' | 'success' | 'error', text: string): void {
        const el = this.shadow.querySelector<HTMLElement>('[data-field="status"]');
        const box = this.shadow.querySelector<HTMLElement>('[data-role="status_box"]');
        if (!el || !box) return;
        el.textContent = text;
        box.dataset.kind = kind;
        box.style.display = kind === 'idle' ? 'none' : 'block';
    }

    private async handleActionClick(action: MessageToolbarAction): Promise<void> {
        const btn = this.actionButtons.get(action.id);
        if (!btn) return;
        try {
            btn.disabled = true;
            this.setStatus('info', 'Working…');
            const res = await action.onClick();
            if (!res) {
                this.setStatus('idle', '');
                return;
            }
            if (res.ok) this.setStatus('success', res.message || 'Done');
            else this.setStatus('error', res.message || 'Failed');
        } catch {
            this.setStatus('error', 'Failed');
        } finally {
            window.setTimeout(() => this.setStatus('idle', ''), 1200);
            if (this.pending && action.disabledWhenPending) {
                btn.disabled = true;
            } else {
                btn.disabled = false;
            }
        }
    }

    private getCss(): string {
        return `
:host {
  display: inline-flex;
  flex: 0 0 auto;
}
:host([data-aimd-placement="actionbar"]) .wrap {
  margin-top: 0;
  justify-content: flex-start;
}
:host([data-aimd-placement="actionbar"]) .bar {
  padding: 0;
  background: transparent;
  border: none;
}
:host([data-aimd-placement="actionbar"]) .btn {
  padding: 0 var(--aimd-space-1);
  background: transparent;
  border-color: transparent;
  color: var(--aimd-text-secondary);
  font-weight: 650;
}
:host([data-aimd-placement="actionbar"]) .btn.primary {
  background: transparent;
  color: var(--aimd-interactive-primary);
  border-color: transparent;
}
:host([data-aimd-placement="actionbar"]) .btn:hover {
  background: var(--aimd-bg-secondary);
}
:host([data-aimd-placement="actionbar"]) .note {
  display: none;
}
:host([data-aimd-placement="content"]) .wrap {
  margin-top: var(--aimd-space-2);
}
.wrap {
  display: flex;
  justify-content: flex-end;
}
.bar {
  display: flex;
  align-items: center;
  gap: var(--aimd-space-2);
  padding: var(--aimd-space-2);
  border: 1px solid var(--aimd-border-default);
  border-radius: var(--aimd-radius-lg);
  background: var(--aimd-bg-secondary);
  color: var(--aimd-text-primary);
  font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial;
}
.btn {
  all: unset;
  cursor: pointer;
  user-select: none;
  padding: var(--aimd-space-1) var(--aimd-space-2);
  border-radius: var(--aimd-radius-md);
  background: var(--aimd-bg-primary);
  color: var(--aimd-text-primary);
  border: 1px solid var(--aimd-border-default);
  font-size: var(--aimd-font-size-xs);
  font-weight: 600;
}
.btn[data-active="1"] {
  border-color: var(--aimd-interactive-primary);
}
.btn.primary {
  background: var(--aimd-interactive-primary);
  color: var(--aimd-text-on-primary);
  border-color: rgba(255,255,255,0.12);
}
.btn:hover { filter: brightness(0.98); }
.btn.primary:hover { background: var(--aimd-interactive-primary-hover); }
.btn:disabled { opacity: 0.55; cursor: not-allowed; }
.note { font-size: var(--aimd-font-size-xs); color: var(--aimd-text-secondary); }
.status {
  font-size: var(--aimd-font-size-xs);
  padding: calc(var(--aimd-space-1) / 2) var(--aimd-space-1);
  border-radius: var(--aimd-radius-lg);
  border: 1px solid var(--aimd-border-default);
}
.status[data-kind="success"] { border-color: var(--aimd-state-success-border); }
.status[data-kind="error"] { border-color: var(--aimd-state-error-border); }
`;
    }
}
