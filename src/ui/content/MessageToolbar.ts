import type { Theme } from '../../core/types/theme';
import { createAppearanceSnapshot, type AppearanceSnapshot } from '../../style/appearance';
import { AppearanceScope } from '../../style/appearanceScope';
import type { UserThemeOverrides } from '../../style/tokens';
import { ensureStyle } from '../../style/shadow';
import { TooltipDelegate } from '../../utils/tooltip';
import { showToast } from '../../utils/toast';
import { createIcon } from './components/Icon';
import { TaskProgressPanel, type TaskProgressUpdate } from './components/TaskProgressPanel';
import { t } from './components/i18n';
import { ToolbarHoverActionPortal } from './components/ToolbarHoverActionPortal';

export type ToolbarActionResult = { ok: true; message?: string } | { ok: false; message: string };

export type ToolbarTaskProgressEvent = TaskProgressUpdate;

export type ToolbarActionContext = {
    signal: AbortSignal;
    onProgress: (event: ToolbarTaskProgressEvent) => void;
};

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
    onPrepare?: () => void | Promise<void>;
    onClick: () => Promise<void | ToolbarActionResult>;
    menu?: MessageToolbarMenuItem[];
    hoverAction?: {
        id: string;
        label: string;
        tooltip?: string;
        icon: string;
        onClick: (context?: ToolbarActionContext) => Promise<void | ToolbarActionResult>;
    };
};

export class MessageToolbar {
    private host: HTMLElement;
    private shadow: ShadowRoot;
    private appearance: AppearanceSnapshot;
    private readonly appearanceScope: AppearanceScope;
    private actions: MessageToolbarAction[];
    private actionButtons = new Map<string, HTMLButtonElement>();
    private pending: boolean = false;
    private openMenuFor: string | null = null;
    private onDocPointerDown: ((e: Event) => void) | null = null;
    private showStats: boolean = false;
    private hoverActionPortal: ToolbarHoverActionPortal | null = null;
    private hoverActionOpenTimer: number | null = null;
    private hoverActionCloseTimer: number | null = null;
    private hoverActionTriggerInside = false;
    private hoverActionPortalInside = false;
    private taskProgressPanel: TaskProgressPanel | null = null;
    private tooltipDelegate: TooltipDelegate;
    private activeTaskAbort: AbortController | null = null;

    constructor(theme: Theme, actions: MessageToolbarAction[], opts?: { showStats?: boolean; themeOverrides?: UserThemeOverrides }) {
        this.appearance = createAppearanceSnapshot(theme, opts?.themeOverrides ?? {});
        this.actions = actions;
        this.showStats = opts?.showStats ?? false;
        this.host = document.createElement('div');
        this.host.className = 'aimd-message-toolbar-host';
        this.host.setAttribute('data-aimd-theme', this.appearance.theme);
        this.shadow = this.host.attachShadow({ mode: 'open' });
        this.appearanceScope = AppearanceScope.forShadowRoot(this.shadow, { styleId: 'aimd-toolbar-tokens' });
        this.appearanceScope.apply(this.appearance);
        ensureStyle(this.shadow, this.getCss(), { id: 'aimd-toolbar-base', cache: 'shared' });
        this.tooltipDelegate = new TooltipDelegate(this.shadow, { upgradeTitles: false });
        this.mount();
    }

    getElement(): HTMLElement {
        return this.host;
    }

    dispose(): void {
        this.activeTaskAbort?.abort();
        this.activeTaskAbort = null;
        this.taskProgressPanel?.dispose();
        this.taskProgressPanel = null;
        this.tooltipDelegate.disconnect();
        this.closeMenu();
        this.closeHoverAction();
        this.hoverActionPortal?.dispose();
        this.hoverActionPortal = null;
        this.appearanceScope.dispose();
    }

    setPlacement(placement: 'actionbar' | 'content'): void {
        this.host.setAttribute('data-aimd-placement', placement);
        this.syncNoteVisibility();
    }

    setAppearance(snapshot: AppearanceSnapshot): void {
        this.appearance = snapshot;
        this.host.setAttribute('data-aimd-theme', snapshot.theme);
        this.appearanceScope.apply(snapshot);
        this.hoverActionPortal?.setAppearance(snapshot);
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
        this.syncNoteVisibility();
    }

    private syncNoteVisibility(): void {
        const note = this.shadow.querySelector<HTMLElement>('[data-field="note"]');
        if (!note) return;
        const placement = this.host.getAttribute('data-aimd-placement');
        note.hidden = placement === 'actionbar' || this.pending || note.textContent.trim().length === 0;
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
            btn.dataset.tooltip = action.tooltip || action.label;
            if (action.hoverAction) {
                btn.dataset.tooltipPlacement = 'bottom';
            }
            btn.setAttribute('aria-label', action.tooltip || action.label);
            btn.appendChild(createIcon(action.icon));
            const prepare = () => {
                try {
                    void action.onPrepare?.();
                } catch {
                    // Preparation is opportunistic and must not block the action button.
                }
            };
            btn.addEventListener('pointerdown', prepare);
            btn.addEventListener('focusin', prepare);
            btn.addEventListener('mouseenter', prepare);
            if (action.hoverAction) {
                this.attachHoverAction(action, btn);
            }
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
                        this.setStatus('idle', '');
                        showToast({ text: res.message || 'Done', tone: 'success' });
                    } else {
                        this.setStatus('idle', '');
                        showToast({ text: res.message || 'Failed', tone: 'error' });
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

        if (action.hoverAction && !this.supportsPointerHover()) {
            ev.preventDefault();
            ev.stopPropagation();
            this.openHoverAction(action, btn);
            return;
        }

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
            if (res.ok) {
                this.setStatus('idle', '');
                showToast({ text: res.message || 'Done', tone: 'success' });
            } else {
                this.setStatus('idle', '');
                showToast({ text: res.message || 'Failed', tone: 'error' });
            }
            // Momentary highlight on successful actions (legacy-like feedback without changing toggle semantics).
            if (res.ok) {
                btn.setAttribute('data-flash', '1');
                window.setTimeout(() => btn.removeAttribute('data-flash'), 650);
            }
        } catch {
            this.setStatus('idle', '');
            showToast({ text: 'Failed', tone: 'error' });
        } finally {
            window.setTimeout(() => this.setStatus('idle', ''), 1200);
            if (this.pending && action.disabledWhenPending) {
                btn.disabled = true;
            } else {
                btn.disabled = false;
            }
        }
    }

    private attachHoverAction(action: MessageToolbarAction, button: HTMLButtonElement): void {
        button.addEventListener('mouseenter', () => {
            this.hoverActionTriggerInside = true;
            this.scheduleHoverActionOpen(action, button);
        });
        button.addEventListener('mouseleave', () => {
            this.hoverActionTriggerInside = false;
            this.scheduleHoverActionClose();
        });
        button.addEventListener('focusin', () => {
            this.openHoverAction(action, button);
        });
        button.addEventListener('focusout', () => {
            this.scheduleHoverActionClose();
        });
    }

    private supportsPointerHover(): boolean {
        if (typeof window.matchMedia !== 'function') return true;
        try {
            return window.matchMedia('(hover: hover) and (pointer: fine)').matches;
        } catch {
            return true;
        }
    }

    private clearHoverActionCloseTimer(): void {
        if (this.hoverActionCloseTimer !== null) {
            window.clearTimeout(this.hoverActionCloseTimer);
            this.hoverActionCloseTimer = null;
        }
    }

    private clearHoverActionOpenTimer(): void {
        if (this.hoverActionOpenTimer !== null) {
            window.clearTimeout(this.hoverActionOpenTimer);
            this.hoverActionOpenTimer = null;
        }
    }

    private scheduleHoverActionOpen(action: MessageToolbarAction, anchor: HTMLButtonElement): void {
        this.clearHoverActionCloseTimer();
        this.clearHoverActionOpenTimer();
        this.hoverActionOpenTimer = window.setTimeout(() => {
            this.openHoverAction(action, anchor);
        }, 100);
    }

    private scheduleHoverActionClose(): void {
        this.clearHoverActionOpenTimer();
        this.clearHoverActionCloseTimer();
        this.hoverActionCloseTimer = window.setTimeout(() => {
            if (this.hoverActionTriggerInside || this.hoverActionPortalInside) return;
            this.closeHoverAction();
        }, 120);
    }

    private closeHoverAction(): void {
        this.clearHoverActionOpenTimer();
        this.clearHoverActionCloseTimer();
        this.hoverActionTriggerInside = false;
        this.hoverActionPortalInside = false;
        this.hoverActionPortal?.close();
    }

    private getHoverActionPortal(): ToolbarHoverActionPortal {
        if (!this.hoverActionPortal) {
            this.hoverActionPortal = new ToolbarHoverActionPortal(this.appearance.theme, this.appearance.overrides);
        }
        return this.hoverActionPortal;
    }

    private openHoverAction(action: MessageToolbarAction, anchor: HTMLButtonElement): void {
        if (!action.hoverAction) return;
        this.clearHoverActionOpenTimer();
        this.clearHoverActionCloseTimer();
        this.getHoverActionPortal().open({
            anchorEl: anchor,
            id: action.hoverAction.id,
            label: action.hoverAction.label,
            tooltip: action.hoverAction.tooltip || action.hoverAction.label,
            icon: action.hoverAction.icon,
            onClick: () => void this.handleHoverActionClick(action, anchor),
            onPointerEnter: () => {
                this.hoverActionPortalInside = true;
                this.clearHoverActionCloseTimer();
            },
            onPointerLeave: () => {
                this.hoverActionPortalInside = false;
                this.scheduleHoverActionClose();
            },
            onRequestClose: () => this.closeHoverAction(),
        });
    }

    private async handleHoverActionClick(action: MessageToolbarAction, button: HTMLButtonElement): Promise<void> {
        if (!action.hoverAction) return;
        const abort = new AbortController();
        this.activeTaskAbort = abort;
        this.openTaskProgress(button, { label: action.hoverAction.label, value: 0, indeterminate: false });
        try {
            button.disabled = true;
            const res = await action.hoverAction.onClick({
                signal: abort.signal,
                onProgress: (event) => this.updateTaskProgress(event),
            });
            if (abort.signal.aborted) {
                this.finishTaskProgress(this.getTaskCancelledLabel());
            } else if (!res) {
                this.closeTaskProgress();
            } else if (res.ok) {
                this.finishTaskProgress(res.message || 'Done');
                button.setAttribute('data-flash', '1');
                window.setTimeout(() => button.removeAttribute('data-flash'), 650);
            } else {
                this.finishTaskProgress(res.message || 'Failed');
            }
        } catch {
            this.finishTaskProgress(abort.signal.aborted ? this.getTaskCancelledLabel() : 'Failed');
        } finally {
            if (this.activeTaskAbort === abort) this.activeTaskAbort = null;
            if (this.pending && action.disabledWhenPending) {
                button.disabled = true;
            } else {
                button.disabled = false;
            }
            this.closeHoverAction();
        }
    }

    private openTaskProgress(anchor: HTMLElement, initial: ToolbarTaskProgressEvent): void {
        void anchor;
        this.closeHoverAction();
        this.getTaskProgressPanel().open(initial);
    }

    private updateTaskProgress(event: ToolbarTaskProgressEvent): void {
        this.taskProgressPanel?.update(event);
    }

    private finishTaskProgress(label: string): void {
        this.taskProgressPanel?.finish(label);
    }

    private closeTaskProgress(): void {
        this.taskProgressPanel?.close();
    }

    private getTaskProgressPanel(): TaskProgressPanel {
        if (this.taskProgressPanel) return this.taskProgressPanel;

        ensureStyle(this.shadow, TaskProgressPanel.getCss(), { id: 'aimd-task-progress-panel-base', cache: 'shared' });
        this.taskProgressPanel = new TaskProgressPanel({
            cancelLabel: t('btnCancel'),
            onCancel: () => {
                this.activeTaskAbort?.abort();
                this.updateTaskProgress({ label: this.getTaskCancelledLabel(), value: 0, indeterminate: false });
            },
        });
        this.shadow.querySelector<HTMLElement>('.bar')?.appendChild(this.taskProgressPanel.getElement());
        return this.taskProgressPanel;
    }

    private getTaskCancelledLabel(): string {
        const translated = t('copyPngCancelled');
        return translated && translated !== 'copyPngCancelled' ? translated : 'Cancelled';
    }

    private getCss(): string {
        return `
:host {
  display: inline-flex;
  flex: 0 0 auto;
  font-family: var(--aimd-font-family-sans);
  --aimd-toolbar-hover: color-mix(in srgb, var(--aimd-button-icon-hover) 88%, var(--aimd-surface-hover));
  --aimd-toolbar-pressed: color-mix(in srgb, var(--aimd-button-icon-active) 90%, var(--aimd-surface-pressed));
  --aimd-toolbar-surface: color-mix(in srgb, var(--aimd-bg-surface) 97%, var(--aimd-bg-primary));
  --aimd-toolbar-outline: color-mix(in srgb, var(--aimd-border-strong) 72%, transparent);
  --aimd-toolbar-menu-surface: color-mix(in srgb, var(--aimd-bg-surface) 99%, var(--aimd-bg-primary));
}
:host([data-aimd-placement="actionbar"]) .wrap { margin-top: 0; justify-content: flex-start; }
:host([data-aimd-placement="actionbar"]) .bar {
  /* Embedded into ChatGPT's official action area: no extra surface/shadow. */
  padding: calc(var(--aimd-space-1) * 0.75);
  gap: var(--aimd-space-1);
  box-shadow: none;
  background: var(--aimd-toolbar-surface);
  border: 1px solid var(--aimd-toolbar-outline);
}
:host([data-aimd-placement="actionbar"]) .icon-btn { width: var(--aimd-size-control-icon-toolbar); height: var(--aimd-size-control-icon-toolbar); border-radius: calc(var(--aimd-radius-lg) + var(--aimd-space-1) / 2); }
:host([data-aimd-placement="actionbar"]) .sep { height: 18px; }
:host([data-aimd-placement="actionbar"]) .note,
:host([data-aimd-pending="1"]) .note,
.note[hidden],
.note:empty {
  display: none;
}
:host([data-aimd-placement="actionbar"]) .status {
  position: absolute;
  right: calc(var(--aimd-space-1) + var(--aimd-space-1) / 2);
  bottom: calc(100% + var(--aimd-space-2));
  background: var(--aimd-toolbar-menu-surface);
  border: 1px solid var(--aimd-toolbar-outline);
  box-shadow: var(--aimd-shadow-lg);
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
  gap: var(--aimd-space-1);
  padding: var(--aimd-space-1);
  border-radius: calc(var(--aimd-radius-lg) + var(--aimd-space-1));
  background: var(--aimd-toolbar-surface);
  border: 1px solid var(--aimd-toolbar-outline);
  color: var(--aimd-text-primary);
  position: relative;
  transition: background var(--aimd-duration-fast) var(--aimd-ease-in-out), border-color var(--aimd-duration-fast) var(--aimd-ease-in-out);
}
.bar:hover {
  background: color-mix(in srgb, var(--aimd-toolbar-surface) 88%, var(--aimd-toolbar-hover));
  border-color: color-mix(in srgb, var(--aimd-border-strong) 72%, var(--aimd-interactive-primary) 20%);
}

.group { display: inline-flex; align-items: center; gap: calc(var(--aimd-space-1) / 2); }
.sep {
  width: 1px;
  height: 22px;
  background: color-mix(in srgb, var(--aimd-border-default) 75%, transparent);
  margin: 0 calc(var(--aimd-space-1) / 2);
}

.stats {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  justify-content: center;
  font-size: var(--aimd-text-xs);
  line-height: 1.25;
  color: color-mix(in srgb, var(--aimd-text-secondary) 94%, transparent);
  white-space: nowrap;
  padding: 0 calc(var(--aimd-space-1) + var(--aimd-space-1) / 2);
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
  width: var(--aimd-size-control-icon-toolbar);
  height: var(--aimd-size-control-icon-toolbar);
  border-radius: calc(var(--aimd-radius-lg) + var(--aimd-space-1) / 4);
  background: transparent;
  color: var(--aimd-button-icon-text);
  font-size: var(--aimd-font-size-xs);
  display: grid;
  place-items: center;
  transition: background var(--aimd-duration-fast) var(--aimd-ease-in-out), transform calc(var(--aimd-duration-fast) * 0.8) var(--aimd-ease-in-out), box-shadow var(--aimd-duration-fast) var(--aimd-ease-in-out);
}
.icon-btn:hover {
  background: var(--aimd-toolbar-hover);
  box-shadow: none;
  color: var(--aimd-button-icon-text-hover);
}
.icon-btn:active {
  transform: none;
  background: var(--aimd-toolbar-pressed);
  color: var(--aimd-button-icon-text-hover);
}
.icon-btn:focus-visible { outline: 2px solid var(--aimd-focus-ring); outline-offset: 2px; }
.icon-btn[data-flash="1"] {
  /* Momentary feedback without looking like "active" state */
  background: var(--aimd-interactive-flash);
  color: var(--aimd-button-icon-text-hover);
}

.icon-btn svg { width: var(--aimd-size-control-glyph-panel); height: var(--aimd-size-control-glyph-panel); display: block; }

.icon-btn.primary {
  background: var(--aimd-interactive-primary);
  color: var(--aimd-text-on-primary);
  box-shadow: none;
}
.icon-btn.primary:hover { background: var(--aimd-interactive-primary-hover); }
.icon-btn:disabled { opacity: 0.55; cursor: not-allowed; }
.note { font-size: var(--aimd-text-xs); color: var(--aimd-text-secondary); }
.status {
  font-size: var(--aimd-text-xs);
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
  padding: calc(var(--aimd-space-1) + var(--aimd-space-1) / 2);
  border-radius: var(--aimd-radius-xl);
  background: var(--aimd-toolbar-menu-surface);
  border: 1px solid color-mix(in srgb, var(--aimd-border-strong) 72%, transparent);
  box-shadow: var(--aimd-shadow-lg);
  display: none;
  z-index: var(--aimd-z-tooltip);
}
.menu[data-open="1"] { display: grid; gap: calc(var(--aimd-space-1) + var(--aimd-space-1) / 2); }
.menu-item {
  all: unset;
  cursor: pointer;
  user-select: none;
  padding: calc(var(--aimd-space-2) + var(--aimd-space-1) / 2) var(--aimd-space-3);
  border-radius: calc(var(--aimd-radius-lg) + var(--aimd-space-1));
  border: 1px solid transparent;
  color: var(--aimd-text-primary);
  font-size: var(--aimd-text-sm);
  background: transparent;
}
.menu-item:hover {
  background: color-mix(in srgb, var(--aimd-button-secondary-hover) 90%, var(--aimd-surface-hover));
  border-color: color-mix(in srgb, var(--aimd-border-strong) 72%, transparent);
}

@media (prefers-reduced-motion: reduce) {
  .bar,
  .icon-btn,
  .menu-item {
    transition: none;
  }
}
`;
    }
}
