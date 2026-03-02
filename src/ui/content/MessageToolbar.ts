import type { Theme } from '../../core/types/theme';
import { getTokenCss } from '../../style/tokens';
import { ensureStyle } from '../../style/shadow';
import { createIcon } from './components/Icon';

export type ToolbarActionResult = { ok: true; message?: string } | { ok: false; message: string };

export type MessageToolbarMenuItem = {
    id: string;
    label: string;
    onClick: () => Promise<void | ToolbarActionResult>;
};

export type MessageToolbarAction = {
    id: string;
    label: string;
    icon: string;
    tooltip?: string;
    kind?: 'primary' | 'secondary';
    disabledWhenPending?: boolean;
    onClick: () => Promise<void | ToolbarActionResult>;
    menu?: MessageToolbarMenuItem[];
};

export class MessageToolbar {
    private host: HTMLElement;
    private shadow: ShadowRoot;
    private actions: MessageToolbarAction[];
    private actionButtons = new Map<string, HTMLButtonElement>();
    private pending: boolean = false;
    private openMenuFor: string | null = null;
    private onDocPointerDown: ((e: Event) => void) | null = null;
    private showStats: boolean = false;

    constructor(theme: Theme, actions: MessageToolbarAction[], opts?: { showStats?: boolean }) {
        this.actions = actions;
        this.showStats = opts?.showStats ?? false;
        this.host = document.createElement('div');
        this.host.className = 'aimd-message-toolbar-host';
        this.host.setAttribute('data-aimd-theme', theme);
        this.shadow = this.host.attachShadow({ mode: 'open' });
        ensureStyle(this.shadow, getTokenCss(theme) + this.getCss());
        this.mount();
    }

    getElement(): HTMLElement {
        return this.host;
    }

    setPlacement(placement: 'actionbar' | 'content'): void {
        this.host.setAttribute('data-aimd-placement', placement);
    }

    setTheme(theme: Theme): void {
        this.host.setAttribute('data-aimd-theme', theme);
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

    setStats(lines: string[]): void {
        const box = this.shadow.querySelector<HTMLElement>('[data-role="stats"]');
        if (!box) return;
        box.replaceChildren();
        for (const line of lines.filter((x) => x.trim().length > 0)) {
            const div = document.createElement('div');
            div.textContent = line;
            box.appendChild(div);
        }
    }

    setActionActive(actionId: string, active: boolean): void {
        const btn = this.actionButtons.get(actionId);
        if (!btn) return;
        btn.dataset.active = active ? '1' : '0';
        // Only bookmark uses "primary when active" (legacy behavior).
        if (actionId === 'bookmark_toggle') {
            btn.classList.toggle('primary', active);
        }
    }

    private mount(): void {
        const wrap = document.createElement('div');
        wrap.className = 'wrap';

        const bar = document.createElement('div');
        bar.className = 'bar';

        const left = document.createElement('div');
        left.className = 'group group-left';
        const right = document.createElement('div');
        right.className = 'group group-right';

        const addSeparator = () => {
            const sep = document.createElement('span');
            sep.className = 'sep';
            sep.setAttribute('aria-hidden', 'true');
            bar.appendChild(sep);
        };

        const addActionButton = (action: MessageToolbarAction, group: HTMLElement) => {
            const btn = document.createElement('button');
            btn.className = `icon-btn ${action.kind === 'primary' ? 'primary' : ''}`.trim();
            btn.type = 'button';
            btn.dataset.action = action.id;
            btn.title = action.tooltip || action.label;
            btn.setAttribute('aria-label', action.label);
            btn.appendChild(createIcon(action.icon));
            btn.addEventListener('click', (e) => void this.handleActionClick(action, e));
            group.appendChild(btn);
            this.actionButtons.set(action.id, btn);
        };

        for (const action of this.actions) {
            addActionButton(action, left);
        }

        bar.append(left);
        if (this.showStats) {
            addSeparator();
            const stats = document.createElement('span');
            stats.className = 'stats';
            stats.dataset.role = 'stats';
            stats.setAttribute('aria-label', 'Word count');
            stats.textContent = 'Loading…';
            bar.appendChild(stats);
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

        const menu = document.createElement('div');
        menu.className = 'menu';
        menu.dataset.role = 'menu';
        menu.dataset.open = '0';
        bar.appendChild(menu);

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

    private closeMenu(): void {
        const menu = this.shadow.querySelector<HTMLElement>('[data-role="menu"]');
        if (menu) {
            menu.dataset.open = '0';
            menu.replaceChildren();
        }
        this.openMenuFor = null;
        if (this.onDocPointerDown) {
            document.removeEventListener('pointerdown', this.onDocPointerDown, true);
            this.onDocPointerDown = null;
        }
    }

    private openMenu(action: MessageToolbarAction, anchor: HTMLElement): void {
        const menu = this.shadow.querySelector<HTMLElement>('[data-role="menu"]');
        if (!menu || !action.menu || action.menu.length === 0) return;

        if (this.openMenuFor === action.id) {
            this.closeMenu();
            return;
        }

        menu.replaceChildren();
        for (const item of action.menu) {
            const b = document.createElement('button');
            b.type = 'button';
            b.className = 'menu-item';
            b.textContent = item.label;
            b.setAttribute('aria-label', item.label);
            b.addEventListener('click', async (e) => {
                e.preventDefault();
                e.stopPropagation();
                try {
                    this.setStatus('info', 'Working…');
                    const res = await item.onClick();
                    if (!res) {
                        this.setStatus('idle', '');
                    } else if (res.ok) {
                        this.setStatus('success', res.message || 'Done');
                    } else {
                        this.setStatus('error', res.message || 'Failed');
                    }
                } finally {
                    window.setTimeout(() => this.setStatus('idle', ''), 1200);
                    this.closeMenu();
                }
            });
            menu.appendChild(b);
        }

        // Position relative to the anchor within the bar.
        const bar = this.shadow.querySelector<HTMLElement>('.bar');
        if (bar) {
            const a = anchor.getBoundingClientRect();
            const b = bar.getBoundingClientRect();
            const left = Math.max(8, Math.min(b.width - 200, a.left - b.left));
            menu.style.left = `${left}px`;
        }

        menu.dataset.open = '1';
        this.openMenuFor = action.id;

        this.onDocPointerDown = (ev: Event) => {
            const target = ev.target as Node | null;
            if (!target) return;
            if (this.host.contains(target)) return;
            this.closeMenu();
        };
        document.addEventListener('pointerdown', this.onDocPointerDown, true);
    }

    private async handleActionClick(action: MessageToolbarAction, ev: Event): Promise<void> {
        const btn = this.actionButtons.get(action.id);
        if (!btn) return;

        if (action.menu && action.menu.length > 0) {
            ev.preventDefault();
            ev.stopPropagation();
            this.openMenu(action, btn);
            return;
        }

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
            // Momentary highlight on successful actions (legacy-like feedback without changing toggle semantics).
            if (res.ok) {
                btn.setAttribute('data-flash', '1');
                window.setTimeout(() => btn.removeAttribute('data-flash'), 650);
            }
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
:host([data-aimd-placement="actionbar"]) .wrap { margin-top: 0; justify-content: flex-start; }
:host([data-aimd-placement="actionbar"]) .bar {
  padding: 3px;
  gap: 2px;
  /* The host action bar row can clip shadows; keep it flat to avoid "cut shadow" artifacts. */
  box-shadow: none;
  background:
    linear-gradient(180deg, color-mix(in srgb, #fff 10%, transparent), transparent 60%),
    color-mix(in srgb, var(--aimd-bg-primary) 14%, transparent);
  border-color: color-mix(in srgb, var(--aimd-border-default) 55%, transparent);
}
:host([data-aimd-theme="dark"][data-aimd-placement="actionbar"]) .bar {
  /* Dark mode: avoid "sheen" lighting; keep a simple, embedded solid surface. */
  background: color-mix(in srgb, var(--aimd-bg-primary) 18%, transparent);
}
:host([data-aimd-placement="actionbar"]) .icon-btn { width: 28px; height: 28px; border-radius: 8px; }
:host([data-aimd-placement="actionbar"]) .sep { height: 18px; }
:host([data-aimd-placement="actionbar"]) .note { display: none !important; }
:host([data-aimd-placement="actionbar"]) .status {
  position: absolute;
  right: 6px;
  bottom: calc(100% + 8px);
  background: color-mix(in srgb, var(--aimd-bg-primary) 28%, transparent);
  border: 1px solid color-mix(in srgb, #fff 18%, var(--aimd-border-default) 82%);
  box-shadow: 0 10px 30px color-mix(in srgb, #000 18%, transparent);
  white-space: nowrap;
}
:host([data-aimd-placement="actionbar"]) .bar::before { opacity: 0.38; }
:host([data-aimd-placement="content"]) .wrap {
  margin-top: var(--aimd-space-2);
}
.wrap {
  display: flex;
  align-items: center;
  justify-content: flex-end;
}
.bar {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  padding: 4px;
  border-radius: 12px;
  /* Embedded look: no outer drop shadow (avoids host clipping, matches ChatGPT native action row feel). */
  background: color-mix(in srgb, var(--aimd-bg-primary) 6%, transparent);
  border: 1px solid color-mix(in srgb, var(--aimd-border-default) 45%, transparent);
  color: var(--aimd-text-primary);
  font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial;
  position: relative;
  transition: transform 180ms ease, box-shadow 180ms ease, background 180ms ease;
}
.bar:hover {
  transform: none;
  background: color-mix(in srgb, var(--aimd-interactive-highlight) 16%, transparent);
}
:host([data-aimd-placement="actionbar"]) .bar:hover { transform: none; }
.bar::before {
  content: "";
  position: absolute;
  inset: 0;
  border-radius: 12px;
  pointer-events: none;
  background:
    radial-gradient(140% 90% at 20% 10%, color-mix(in srgb, #fff 22%, transparent) 0%, transparent 60%),
    radial-gradient(90% 80% at 80% 120%, color-mix(in srgb, #fff 10%, transparent) 0%, transparent 55%);
  mix-blend-mode: overlay;
  opacity: 0.18;
  transition: opacity 180ms ease;
}
.bar:hover::before { opacity: 0.24; }
:host([data-aimd-placement="actionbar"]) .bar:hover::before { opacity: 0.38; }
:host([data-aimd-theme="dark"]) .bar::before { opacity: 0; }
:host([data-aimd-theme="dark"]) .bar:hover::before { opacity: 0; }

.group { display: inline-flex; align-items: center; gap: 2px; }
.sep {
  width: 1px;
  height: 22px;
  background: color-mix(in srgb, var(--aimd-border-default) 75%, transparent);
  margin: 0 2px;
}

.stats {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  justify-content: center;
  font-size: 11px;
  line-height: 1.25;
  color: color-mix(in srgb, var(--aimd-text-secondary) 90%, transparent);
  white-space: nowrap;
  padding: 0 6px;
  min-width: 76px;
  user-select: none;
}

.icon-btn {
  all: unset;
  cursor: pointer;
  user-select: none;
  width: 30px;
  height: 30px;
  border-radius: 9px;
  background: transparent;
  color: color-mix(in srgb, var(--aimd-text-primary) 76%, transparent);
  font-size: var(--aimd-font-size-xs);
  display: grid;
  place-items: center;
  transition: background 150ms ease, transform 120ms ease, box-shadow 150ms ease;
}
.icon-btn:hover {
  /* Higher-contrast hover state (more visible on ChatGPT surfaces) */
  background: color-mix(in srgb, var(--aimd-interactive-highlight) 34%, transparent);
  box-shadow: none;
}
.icon-btn:active { transform: scale(0.96); }
.icon-btn:focus-visible { outline: 2px solid color-mix(in srgb, var(--aimd-interactive-primary) 70%, transparent); outline-offset: 2px; }
.icon-btn[data-flash="1"] {
  /* Momentary feedback without looking like "active" state */
  background: color-mix(in srgb, var(--aimd-interactive-highlight) 40%, transparent);
}

.icon-btn svg { width: 16px; height: 16px; display: block; }

.icon-btn[data-active="1"] {
  background: color-mix(in srgb, var(--aimd-interactive-highlight) 92%, transparent);
  box-shadow: none;
}
.icon-btn.primary {
  background: linear-gradient(135deg, color-mix(in srgb, var(--aimd-interactive-primary) 96%, transparent), color-mix(in srgb, var(--aimd-interactive-primary-hover) 92%, transparent));
  color: var(--aimd-text-on-primary);
  box-shadow: none;
}
.icon-btn.primary:hover { background: color-mix(in srgb, var(--aimd-interactive-primary-hover) 95%, transparent); }
:host([data-aimd-theme="dark"]) .icon-btn.primary {
  /* Dark mode: keep primary button flat (no gradient sheen). */
  background: var(--aimd-interactive-primary);
}
:host([data-aimd-theme="dark"]) .icon-btn.primary:hover { background: var(--aimd-interactive-primary-hover); }
.icon-btn:disabled { opacity: 0.55; cursor: not-allowed; }
.note { font-size: var(--aimd-font-size-xs); color: var(--aimd-text-secondary); }
.status {
  font-size: var(--aimd-font-size-xs);
  padding: calc(var(--aimd-space-1) / 2) var(--aimd-space-1);
  border-radius: var(--aimd-radius-lg);
  border: 1px solid var(--aimd-border-default);
}
.status[data-kind="success"] { border-color: var(--aimd-state-success-border); }
.status[data-kind="error"] { border-color: var(--aimd-state-error-border); }

.menu {
  position: absolute;
  top: calc(100% + 8px);
  min-width: 180px;
  padding: 6px;
  border-radius: 14px;
  background: color-mix(in srgb, var(--aimd-bg-primary) 24%, transparent);
  border: 1px solid color-mix(in srgb, #fff 18%, var(--aimd-border-default) 82%);
  box-shadow: 0 18px 50px color-mix(in srgb, #000 22%, transparent);
  display: none;
  z-index: var(--aimd-z-tooltip);
}
.menu[data-open="1"] { display: grid; gap: 6px; }
.menu-item {
  all: unset;
  cursor: pointer;
  user-select: none;
  padding: 10px 12px;
  border-radius: 12px;
  border: 1px solid transparent;
  color: var(--aimd-text-primary);
  font-size: var(--aimd-font-size-sm);
  background: transparent;
}
.menu-item:hover {
  background: color-mix(in srgb, var(--aimd-bg-primary) 46%, transparent);
  border-color: color-mix(in srgb, var(--aimd-border-default) 65%, transparent);
}

@supports ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) {
  .bar,
  .menu {
    backdrop-filter: blur(14px) saturate(170%);
    -webkit-backdrop-filter: blur(14px) saturate(170%);
  }
}

@media (prefers-reduced-motion: reduce) {
  .bar,
  .icon-btn,
  .menu-item {
    transition: none !important;
  }
}
`;
    }
}
