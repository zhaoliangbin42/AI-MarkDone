import type { Theme } from '../../../core/types/theme';
import { getTokenCss, type UserThemeOverrides } from '../../../style/tokens';
import { ensureStyle } from '../../../style/shadow';
import { TooltipDelegate } from '../../../utils/tooltip';
import { createIcon } from './Icon';

export type ToolbarHoverPortalAction = {
    id: string;
    label: string;
    displayLabel?: string;
    tooltip?: string;
    icon?: string;
    showLabel?: boolean;
    onClick: () => void;
};

export type ToolbarHoverActionPortalParams = {
    anchorEl: HTMLElement;
    id?: string;
    label?: string;
    tooltip?: string;
    icon?: string;
    onClick?: () => void;
    actions?: ToolbarHoverPortalAction[];
    onPointerEnter?: () => void;
    onPointerLeave?: () => void;
    onRequestClose?: () => void;
};

export class ToolbarHoverActionPortal {
    private host: HTMLElement;
    private shadow: ShadowRoot;
    private bridge: HTMLElement;
    private actionsRoot: HTMLElement;
    private currentAnchor: HTMLElement | null = null;
    private onPointerEnter: (() => void) | null = null;
    private onPointerLeave: (() => void) | null = null;
    private onRequestClose: (() => void) | null = null;
    private onDocPointerDown: ((event: Event) => void) | null = null;
    private onWindowResize: (() => void) | null = null;
    private onWindowScroll: (() => void) | null = null;
    private positionFrame: number | null = null;
    private theme: Theme;
    private themeOverrides: UserThemeOverrides;
    private tooltipDelegate: TooltipDelegate;

    constructor(theme: Theme, themeOverrides: UserThemeOverrides = {}) {
        this.theme = theme;
        this.themeOverrides = themeOverrides;
        this.host = document.createElement('div');
        this.host.className = 'aimd-toolbar-hover-action-host';
        this.host.dataset.open = '0';
        this.host.setAttribute('data-aimd-theme', theme);
        this.shadow = this.host.attachShadow({ mode: 'open' });
        ensureStyle(this.shadow, getTokenCss(theme, this.themeOverrides), { id: 'aimd-toolbar-hover-action-tokens' });
        ensureStyle(this.shadow, this.getCss(), { id: 'aimd-toolbar-hover-action-base', cache: 'shared' });
        this.tooltipDelegate = new TooltipDelegate(this.shadow, { upgradeTitles: false });

        this.bridge = document.createElement('div');
        this.bridge.className = 'toolbar-hover-bridge';
        this.bridge.dataset.role = 'toolbar-hover-bridge';
        this.bridge.setAttribute('aria-hidden', 'true');
        this.bridge.addEventListener('pointerenter', () => this.onPointerEnter?.());
        this.bridge.addEventListener('pointerleave', () => this.onPointerLeave?.());

        this.actionsRoot = document.createElement('div');
        this.actionsRoot.className = 'toolbar-hover-actions';
        this.actionsRoot.dataset.role = 'toolbar-hover-actions';
        this.actionsRoot.addEventListener('pointerenter', () => this.onPointerEnter?.());
        this.actionsRoot.addEventListener('pointerleave', () => this.onPointerLeave?.());
        this.shadow.appendChild(this.bridge);
        this.shadow.appendChild(this.actionsRoot);
    }

    isOpen(): boolean {
        return this.host.dataset.open === '1';
    }

    setTheme(theme: Theme): void {
        this.theme = theme;
        this.host.setAttribute('data-aimd-theme', theme);
        ensureStyle(this.shadow, getTokenCss(theme, this.themeOverrides), { id: 'aimd-toolbar-hover-action-tokens' });
    }

    setThemeOverrides(overrides: UserThemeOverrides): void {
        this.themeOverrides = { ...overrides };
        ensureStyle(this.shadow, getTokenCss(this.theme, this.themeOverrides), { id: 'aimd-toolbar-hover-action-tokens' });
    }

    open(params: ToolbarHoverActionPortalParams): void {
        this.currentAnchor = params.anchorEl;
        this.onPointerEnter = params.onPointerEnter ?? null;
        this.onPointerLeave = params.onPointerLeave ?? null;
        this.onRequestClose = params.onRequestClose ?? null;
        const actions = params.actions && params.actions.length > 0
            ? params.actions
            : [{
                id: params.id || 'default',
                label: params.label || '',
                tooltip: params.tooltip,
                icon: params.icon,
                showLabel: false,
                onClick: params.onClick || (() => undefined),
            }];
        this.renderActions(actions);

        if (!this.host.isConnected) {
            document.body.appendChild(this.host);
        }

        this.positionToAnchor(params.anchorEl);
        this.host.dataset.open = '1';
        this.scheduleReposition();
        this.installGlobalHandlers();
    }

    close(): void {
        this.cancelReposition();
        this.tooltipDelegate.hide();
        this.host.dataset.open = '0';
        this.currentAnchor = null;
        this.onPointerEnter = null;
        this.onPointerLeave = null;
        this.onRequestClose = null;
        this.actionsRoot.replaceChildren();
        this.removeGlobalHandlers();
        this.host.remove();
    }

    dispose(): void {
        this.close();
        this.tooltipDelegate.disconnect();
    }

    private positionToAnchor(anchorEl: HTMLElement): void {
        const rect = anchorEl.getBoundingClientRect();
        const actionRect = this.actionsRoot.getBoundingClientRect();
        const viewportWidth = window.innerWidth || document.documentElement.clientWidth || 1024;
        const margin = 8;
        const width = actionRect.width || this.actionsRoot.scrollWidth || this.actionsRoot.offsetWidth || 0;
        const height = actionRect.height || this.actionsRoot.scrollHeight || this.actionsRoot.offsetHeight || 0;
        const rawCenter = rect.left + (rect.width / 2);
        const rawLeft = rawCenter - (width / 2);
        const maxLeft = Math.max(margin, viewportWidth - margin - width);
        const left = Math.min(maxLeft, Math.max(margin, rawLeft));
        const anchorOffset = Math.min(Math.max(rawCenter - left, margin), Math.max(margin, width - margin));
        const placeBelow = rect.top - height - margin < margin;

        this.host.dataset.placement = placeBelow ? 'bottom' : 'top';
        this.host.style.setProperty('--aimd-toolbar-hover-anchor-x', `${Math.round(anchorOffset)}px`);
        this.host.style.left = `${Math.round(left)}px`;
        this.host.style.top = `${Math.round(placeBelow ? rect.bottom : rect.top)}px`;
    }

    private scheduleReposition(): void {
        this.cancelReposition();
        this.positionFrame = window.requestAnimationFrame(() => {
            this.positionFrame = null;
            if (!this.currentAnchor || !this.host.isConnected) return;
            this.positionToAnchor(this.currentAnchor);
        });
    }

    private cancelReposition(): void {
        if (this.positionFrame === null) return;
        window.cancelAnimationFrame(this.positionFrame);
        this.positionFrame = null;
    }

    private renderActions(actions: ToolbarHoverPortalAction[]): void {
        this.tooltipDelegate.hide();
        this.actionsRoot.replaceChildren();
        this.actionsRoot.dataset.layout = actions.length > 1 ? 'multi' : 'single';
        this.host.dataset.layout = actions.length > 1 ? 'multi' : 'single';
        for (const action of actions) {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = action.icon
                ? action.showLabel
                    ? 'toolbar-hover-action toolbar-hover-action--icon-text'
                    : 'toolbar-hover-action toolbar-hover-action--icon'
                : 'toolbar-hover-action toolbar-hover-action--text';
            button.dataset.role = 'toolbar-hover-action';
            button.dataset.action = action.id;
            button.dataset.tooltip = action.tooltip || action.label;
            button.setAttribute('aria-label', action.label);
            const visibleLabel = action.displayLabel ?? action.label;
            if (action.icon && action.showLabel) {
                const label = document.createElement('span');
                label.className = 'toolbar-hover-action__label';
                label.textContent = visibleLabel;
                button.replaceChildren(createIcon(action.icon), label);
            } else if (action.icon) {
                button.replaceChildren(createIcon(action.icon));
            } else {
                button.textContent = visibleLabel;
            }
            button.addEventListener('click', (event) => {
                event.preventDefault();
                event.stopPropagation();
                action.onClick();
            });
            this.actionsRoot.appendChild(button);
        }
    }

    private installGlobalHandlers(): void {
        this.removeGlobalHandlers();
        this.onDocPointerDown = (event: Event) => {
            const path = typeof event.composedPath === 'function' ? event.composedPath() : [];
            if (path.includes(this.host)) return;
            if (this.currentAnchor && path.includes(this.currentAnchor)) return;

            const target = event.target;
            if (target instanceof Node) {
                const root = target.getRootNode();
                if (root instanceof ShadowRoot && root.host === this.host) return;
                if (this.host.contains(target)) return;
                if (this.currentAnchor?.contains(target)) return;
            }
            this.onRequestClose?.();
        };
        this.onWindowResize = () => this.onRequestClose?.();
        this.onWindowScroll = () => this.onRequestClose?.();
        document.addEventListener('pointerdown', this.onDocPointerDown, true);
        window.addEventListener('resize', this.onWindowResize, true);
        window.addEventListener('scroll', this.onWindowScroll, true);
    }

    private removeGlobalHandlers(): void {
        if (this.onDocPointerDown) {
            document.removeEventListener('pointerdown', this.onDocPointerDown, true);
            this.onDocPointerDown = null;
        }
        if (this.onWindowResize) {
            window.removeEventListener('resize', this.onWindowResize, true);
            this.onWindowResize = null;
        }
        if (this.onWindowScroll) {
            window.removeEventListener('scroll', this.onWindowScroll, true);
            this.onWindowScroll = null;
        }
    }

    private getCss(): string {
        return `
:host {
  position: fixed;
  left: 0;
  top: 0;
  pointer-events: none;
  z-index: var(--aimd-z-tooltip);
}

.toolbar-hover-actions {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--aimd-space-2);
  max-width: min(92vw, 560px);
  flex-wrap: wrap;
  transform: translateY(calc(-100% - var(--aimd-space-2)));
  pointer-events: auto;
}

:host([data-placement="bottom"]) .toolbar-hover-actions {
  transform: translateY(var(--aimd-space-2));
}

.toolbar-hover-action {
  all: unset;
  box-sizing: border-box;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0;
  padding: 0;
  border-radius: var(--aimd-radius-lg);
  border: 1px solid color-mix(in srgb, var(--aimd-border-strong) 72%, transparent);
  background: color-mix(in srgb, var(--aimd-bg-surface) 99%, var(--aimd-bg-primary));
  color: var(--aimd-text-primary);
  box-shadow: var(--aimd-shadow-lg);
  font-family: var(--aimd-font-family-sans);
  font-size: var(--aimd-text-sm);
  font-weight: var(--aimd-font-medium);
  line-height: 1;
  white-space: nowrap;
  cursor: pointer;
  transition: border-color var(--aimd-duration-fast) var(--aimd-ease-in-out),
              color var(--aimd-duration-fast) var(--aimd-ease-in-out);
}

.toolbar-hover-action--icon {
  width: var(--aimd-size-control-icon-toolbar);
  height: var(--aimd-size-control-icon-toolbar);
}

.toolbar-hover-action--text {
  min-height: var(--aimd-size-control-icon-toolbar);
  padding: 0 var(--aimd-space-3);
}

.toolbar-hover-action--icon-text {
  min-height: var(--aimd-size-control-icon-toolbar);
  gap: var(--aimd-space-2);
  padding: 0 var(--aimd-space-3);
}

.toolbar-hover-action__label {
  display: inline-block;
}

.toolbar-hover-bridge {
  position: absolute;
  left: var(--aimd-toolbar-hover-anchor-x, 50%);
  top: calc(-1 * var(--aimd-space-3));
  width: calc(var(--aimd-size-control-icon-toolbar) + var(--aimd-space-4));
  height: var(--aimd-space-4);
  transform: translateX(-50%);
  pointer-events: auto;
  background: transparent;
}

:host([data-layout="multi"]) .toolbar-hover-bridge {
  width: min(92vw, 560px);
}

:host([data-placement="bottom"]) .toolbar-hover-bridge {
  top: 0;
  transform: translate(-50%, calc(-1 * var(--aimd-space-2)));
}

.toolbar-hover-action:hover {
  border-color: color-mix(in srgb, var(--aimd-border-strong) 72%, var(--aimd-interactive-primary) 20%);
}

.toolbar-hover-action:focus-visible {
  outline: 2px solid var(--aimd-focus-ring);
  outline-offset: 2px;
}

.toolbar-hover-action .aimd-icon,
.toolbar-hover-action .aimd-icon svg {
  width: var(--aimd-size-control-glyph-panel);
  height: var(--aimd-size-control-glyph-panel);
  display: block;
}
`;
    }
}
