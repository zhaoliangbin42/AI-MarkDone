import type { Theme } from '../../core/types/theme';
import { getTokenCss } from '../../style/tokens';
import { ensureStyle } from '../../style/shadow';
import { createIcon } from './components/Icon';
import { t } from './components/i18n';

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
        ensureStyle(this.shadow, getTokenCss(theme), { id: 'aimd-toolbar-tokens' });
        ensureStyle(this.shadow, this.getCss(), { id: 'aimd-toolbar-base', cache: 'shared' });
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
        ensureStyle(this.shadow, getTokenCss(theme), { id: 'aimd-toolbar-tokens' });
    }

    setPending(pending: boolean): void {
        this.pending = pending;
        this.host.setAttribute('data-aimd-pending', pending ? '1' : '0');
        const note = this.shadow.querySelector<HTMLElement>('[data-field="note"]');
        for (const action of this.actions) {
            if (!action.disabledWhenPending) continue;
            const btn = this.actionButtons.get(action.id);
            if (btn) btn.disabled = pending;
        }
        if (note) note.textContent = pending ? t('streamingStatus') : '';
    }

    setStats(lines: string[]): void {
        const box = this.shadow.querySelector<HTMLElement>('[data-role="stats"]');
        if (!box) return;
        const statsSeparator = this.shadow.querySelector<HTMLElement>('[data-role="stats-separator"]');
        const visibleLines = lines.filter((x) => x.trim().length > 0);
        box.replaceChildren();
        box.dataset.empty = visibleLines.length === 0 ? '1' : '0';
        if (statsSeparator) statsSeparator.hidden = visibleLines.length === 0;
        for (const line of visibleLines) {
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
            sep.dataset.role = 'stats-separator';
            bar.appendChild(sep);
        };

        const addActionButton = (action: MessageToolbarAction, group: HTMLElement) => {
            const btn = document.createElement('button');
            btn.className = `icon-btn ${action.kind === 'primary' ? 'primary' : ''}`.trim();
            btn.type = 'button';
            btn.dataset.action = action.id;
            btn.setAttribute('aria-label', action.tooltip || action.label);
            btn.appendChild(createIcon(action.icon));
            this.attachHoverFeedback(btn, action.tooltip || action.label);
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
            stats.dataset.empty = '0';
            stats.setAttribute('aria-label', t('wordCountLabel'));
            stats.textContent = t('loading');
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

    private attachHoverFeedback(button: HTMLButtonElement, label: string): void {
        let hoverTimeout: number | null = null;
        let feedbackElement: HTMLElement | null = null;

        const removeFeedback = () => {
            if (hoverTimeout !== null) {
                window.clearTimeout(hoverTimeout);
                hoverTimeout = null;
            }
            if (feedbackElement) {
                feedbackElement.remove();
                feedbackElement = null;
            }
        };

        button.addEventListener('mouseenter', () => {
            removeFeedback();
            hoverTimeout = window.setTimeout(() => {
                feedbackElement = document.createElement('div');
                feedbackElement.className = 'toolbar-hover-feedback';
                feedbackElement.dataset.role = 'toolbar-tooltip';
                feedbackElement.textContent = button.getAttribute('aria-label') || label;
                button.appendChild(feedbackElement);
            }, 100);
        });

        button.addEventListener('mouseleave', removeFeedback);
    }

    private getCss(): string {
        return `
:host {
  display: inline-flex;
  flex: 0 0 auto;
  font-family: var(--aimd-font-family-sans);
  /* Material/Gmail-like state layers (scoped to this shadow root) */
  --aimd-tb-hover: color-mix(in srgb, #000 6%, transparent);
  --aimd-tb-pressed: color-mix(in srgb, #000 10%, transparent);
  --aimd-tb-surface: color-mix(in srgb, var(--aimd-bg-primary) 82%, transparent);
  --aimd-tb-outline: color-mix(in srgb, var(--aimd-text-primary) 14%, transparent);
}
:host([data-aimd-theme="dark"]) {
  --aimd-tb-hover: color-mix(in srgb, #fff 10%, transparent);
  --aimd-tb-pressed: color-mix(in srgb, #fff 16%, transparent);
  --aimd-tb-surface: color-mix(in srgb, var(--aimd-bg-primary) 26%, transparent);
  --aimd-tb-outline: color-mix(in srgb, var(--aimd-text-primary) 22%, transparent);
}
:host([data-aimd-placement="actionbar"]) .wrap { margin-top: 0; justify-content: flex-start; }
:host([data-aimd-placement="actionbar"]) .bar {
  /* Embedded into ChatGPT's official action area: no extra surface/shadow. */
  padding: 3px;
  gap: 4px;
  box-shadow: none;
  background: var(--aimd-tb-surface);
  border: 1px solid var(--aimd-tb-outline);
}
:host([data-aimd-placement="actionbar"]) .icon-btn { width: 32px; height: 32px; border-radius: 10px; }
:host([data-aimd-placement="actionbar"]) .sep { height: 18px; }
:host([data-aimd-placement="actionbar"]) .note { display: none !important; }
:host([data-aimd-pending="1"]) .note { display: none !important; }
:host([data-aimd-placement="actionbar"]) .status {
  position: absolute;
  right: 6px;
  bottom: calc(100% + 8px);
  background: var(--aimd-tb-surface);
  border: 1px solid var(--aimd-tb-outline);
  box-shadow: 0 10px 24px color-mix(in srgb, #000 20%, transparent);
  white-space: nowrap;
}
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
  gap: 4px;
  padding: 4px;
  border-radius: 12px;
  background: var(--aimd-tb-surface);
  border: 1px solid var(--aimd-tb-outline);
  color: var(--aimd-text-primary);
  position: relative;
  transition: background 150ms ease, border-color 150ms ease;
}
.bar:hover {
  background: color-mix(in srgb, var(--aimd-tb-surface) 92%, var(--aimd-tb-hover) 8%);
}

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
.stats[data-empty="1"] {
  display: none;
  min-width: 0;
  padding: 0;
}

.icon-btn {
  all: unset;
  position: relative;
  overflow: visible;
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
  background: var(--aimd-tb-hover);
  box-shadow: none;
}
.icon-btn:active {
  transform: none;
  background: var(--aimd-tb-pressed);
}
.icon-btn:focus-visible { outline: 2px solid color-mix(in srgb, var(--aimd-interactive-primary) 70%, transparent); outline-offset: 2px; }
.icon-btn[data-flash="1"] {
  /* Momentary feedback without looking like "active" state */
  background: color-mix(in srgb, var(--aimd-tb-hover) 70%, transparent);
}

.toolbar-hover-feedback {
  position: absolute;
  bottom: calc(100% + var(--aimd-space-3));
  left: 50%;
  transform: translateX(-50%);
  padding: calc(var(--aimd-space-1) + 1px) var(--aimd-space-3);
  background: var(--aimd-interactive-primary);
  color: var(--aimd-text-on-primary);
  font-size: var(--aimd-font-size-xs);
  line-height: 1;
  white-space: nowrap;
  border-radius: var(--aimd-radius-md);
  opacity: 0;
  pointer-events: none;
  z-index: var(--aimd-z-tooltip);
  animation: toolbarFeedbackFade 1.5s ease;
}

@keyframes toolbarFeedbackFade {
  0% { opacity: 0; transform: translateX(-50%) translateY(0); }
  20% { opacity: 1; transform: translateX(-50%) translateY(-4px); }
  80% { opacity: 1; transform: translateX(-50%) translateY(-4px); }
  100% { opacity: 0; transform: translateX(-50%) translateY(-8px); }
}

.icon-btn svg { width: 16px; height: 16px; display: block; }

.icon-btn.primary {
  background: var(--aimd-interactive-primary);
  color: var(--aimd-text-on-primary);
  box-shadow: none;
}
.icon-btn.primary:hover { background: var(--aimd-interactive-primary-hover); }
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
