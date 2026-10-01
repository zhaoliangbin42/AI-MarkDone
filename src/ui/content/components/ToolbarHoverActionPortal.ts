import type { Theme } from '../../../core/types/theme';
import {
    areAppearanceSnapshotsEqual,
    createAppearanceSnapshot,
    type AppearanceSnapshot,
} from '../../../style/appearance';
import { AppearanceScope } from '../../../style/appearanceScope';
import type { UserThemeOverrides } from '../../../style/tokens';
import { ensureStyle } from '../../../style/shadow';
import { TooltipDelegate } from '../../../utils/tooltip';
import { createIcon } from './Icon';

const VIEWPORT_GUTTER_PX = 8;

export type ToolbarHoverPortalAction = {
    id: string;
    label: string;
    displayLabel?: string;
    tooltip?: string;
    icon?: string;
    showLabel?: boolean;
    disabled?: boolean;
    busy?: boolean;
    preserveSelection?: boolean;
    placement?: 'top' | 'bottom';
    onClick: () => void;
};

export type ToolbarHoverActionPortalParams = {
    anchorEl?: HTMLElement;
    anchorRect?: DOMRect;
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

// The action row owns transform for above/below anchor placement. Keep this
// established portal lifecycle motion-free so opening never overrides that transform.
export class ToolbarHoverActionPortal {
    private host: HTMLElement;
    private shadow: ShadowRoot;
    private bridge: HTMLElement;
    private actionsRoot: HTMLElement;
    private bottomActionsRoot: HTMLElement;
    private bottomBridge: HTMLElement;
    private currentAnchor: HTMLElement | null = null;
    private currentAnchorRect: DOMRect | null = null;
    private onPointerEnter: (() => void) | null = null;
    private onPointerLeave: (() => void) | null = null;
    private onRequestClose: (() => void) | null = null;
    private onDocPointerDown: ((event: Event) => void) | null = null;
    private onWindowResize: (() => void) | null = null;
    private onWindowScroll: (() => void) | null = null;
    private onWindowKeyDown: ((event: Event) => void) | null = null;
    private positionFrame: number | null = null;
    private appearance: AppearanceSnapshot;
    private readonly appearanceScope: AppearanceScope;
    private tooltipDelegate: TooltipDelegate;

    constructor(theme: Theme, themeOverrides: UserThemeOverrides = {}) {
        this.appearance = createAppearanceSnapshot(theme, themeOverrides);
        this.host = document.createElement('div');
        this.host.className = 'aimd-toolbar-hover-action-host';
        this.host.setAttribute('data-aimd-role', 'toolbar-hover-actions');
        this.host.dataset.open = '0';
        this.host.setAttribute('data-aimd-theme', theme);
        this.shadow = this.host.attachShadow({ mode: 'open' });
        this.appearanceScope = AppearanceScope.forShadowRoot(this.shadow, {
            styleId: 'aimd-toolbar-hover-action-tokens',
        });
        this.appearanceScope.apply(this.appearance);
        ensureStyle(this.shadow, this.getCss(), {
            id: 'aimd-toolbar-hover-action-base',
            cache: 'shared',
        });
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
        this.actionsRoot.dataset.placement = 'top';
        this.actionsRoot.addEventListener('pointerenter', () => this.onPointerEnter?.());
        this.actionsRoot.addEventListener('pointerleave', () => this.onPointerLeave?.());
        this.bottomActionsRoot = document.createElement('div');
        this.bottomActionsRoot.className = 'toolbar-hover-actions toolbar-hover-actions--bottom';
        this.bottomActionsRoot.dataset.role = 'toolbar-hover-actions';
        this.bottomActionsRoot.dataset.placement = 'bottom';
        this.bottomBridge = this.bridge.cloneNode() as HTMLElement;
        this.bottomBridge.classList.add('toolbar-hover-bridge--bottom');
        for (const element of [this.bottomActionsRoot, this.bottomBridge]) {
            element.addEventListener('pointerenter', () => this.onPointerEnter?.());
            element.addEventListener('pointerleave', () => this.onPointerLeave?.());
        }
        for (const element of [this.actionsRoot, this.bottomActionsRoot]) {
            element.addEventListener('focusin', () => this.onPointerEnter?.());
            element.addEventListener('focusout', () => this.onPointerLeave?.());
        }
        this.shadow.appendChild(this.bridge);
        this.shadow.appendChild(this.actionsRoot);
        this.shadow.append(this.bottomBridge, this.bottomActionsRoot);
    }

    createInlinePreview(actions: ToolbarHoverPortalAction[]): HTMLElement {
        this.renderActions(actions);
        this.host.dataset.open = '1';
        ensureStyle(this.shadow, `:host { position: relative; display: inline-flex; max-width: 100%; inset: auto; } .toolbar-hover-actions { position: relative; max-width: 100%; transform: none; } .toolbar-hover-bridge { display: none; }`, { id: 'aimd-inline-preview', cache: 'shared' });
        return this.host;
    }

    isOpen(): boolean {
        return this.host.dataset.open === '1';
    }

    containsEvent(event: Event): boolean { return event.composedPath().includes(this.host); }
    hasFocus(): boolean { return this.shadow.activeElement !== null; }

    setAppearance(snapshot: AppearanceSnapshot): void {
        if (areAppearanceSnapshotsEqual(this.appearance, snapshot)) return;
        this.appearance = snapshot;
        this.host.dataset.aimdTheme = snapshot.theme;
        this.appearanceScope.apply(snapshot);
    }

    open(params: ToolbarHoverActionPortalParams): void {
        if (!params.anchorEl && !params.anchorRect) return;
        this.currentAnchor = params.anchorEl ?? null;
        this.currentAnchorRect = params.anchorRect ?? null;
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

        this.positionToAnchor(params.anchorRect ?? params.anchorEl!.getBoundingClientRect());
        this.host.dataset.open = '1';
        this.scheduleReposition();
        this.installGlobalHandlers();
    }

    close(): void {
        this.cancelReposition();
        this.tooltipDelegate.hide();
        this.host.dataset.open = '0';
        this.currentAnchor = null;
        this.currentAnchorRect = null;
        this.onPointerEnter = null;
        this.onPointerLeave = null;
        this.onRequestClose = null;
        this.actionsRoot.replaceChildren();
        this.bottomActionsRoot.replaceChildren();
        this.removeGlobalHandlers();
        this.host.remove();
    }

    dispose(): void {
        this.close();
        this.tooltipDelegate.disconnect();
        this.appearanceScope.dispose();
    }

    private positionToAnchor(rect: DOMRect): void {
        const actionRect = this.actionsRoot.getBoundingClientRect();
        const viewportWidth = window.innerWidth || document.documentElement.clientWidth || 1024;
        const margin = VIEWPORT_GUTTER_PX;
        const width = actionRect.width || this.actionsRoot.scrollWidth || this.actionsRoot.offsetWidth || 0;
        const height = actionRect.height || this.actionsRoot.scrollHeight || this.actionsRoot.offsetHeight || 0;
        if (!this.bottomActionsRoot.hidden) {
            const bottomRect = this.bottomActionsRoot.getBoundingClientRect();
            const bottomHeight = bottomRect.height || this.bottomActionsRoot.scrollHeight;
            const splitWidth = Math.max(width, bottomRect.width || this.bottomActionsRoot.scrollWidth);
            const center = rect.left + rect.width / 2;
            const splitLeft = Math.min(Math.max(margin, viewportWidth - margin - splitWidth), Math.max(margin, center - splitWidth / 2));
            let topEdge = -margin;
            let bottomEdge = rect.height + margin;
            const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 768;
            if (!this.actionsRoot.hidden && rect.top - height - margin < margin) {
                topEdge = rect.height + margin + height;
                bottomEdge = topEdge + margin;
            } else if (rect.top + bottomEdge + bottomHeight > viewportHeight - margin) {
                bottomEdge = -bottomHeight - margin;
                topEdge = bottomEdge - margin;
            }
            this.host.dataset.placement = 'split';
            this.host.style.left = `${Math.round(splitLeft)}px`;
            this.host.style.top = `${Math.round(rect.top)}px`;
            this.host.style.width = `${Math.round(splitWidth)}px`;
            this.host.style.setProperty('--_toolbar-hover-anchor-x', `${Math.round(center - splitLeft)}px`);
            this.host.style.setProperty('--_toolbar-hover-top-edge', `${Math.round(topEdge)}px`);
            this.host.style.setProperty('--_toolbar-hover-bottom-edge', `${Math.round(bottomEdge)}px`);
            return;
        }
        const rawCenter = rect.left + (rect.width / 2);
        const rawLeft = rawCenter - (width / 2);
        const maxLeft = Math.max(margin, viewportWidth - margin - width);
        const left = Math.min(maxLeft, Math.max(margin, rawLeft));
        const anchorOffset = Math.min(Math.max(rawCenter - left, margin), Math.max(margin, width - margin));
        const placeBelow = rect.top - height - margin < margin;

        this.host.dataset.placement = placeBelow ? 'bottom' : 'top';
        this.host.style.setProperty('--_toolbar-hover-anchor-x', `${Math.round(anchorOffset)}px`);
        this.host.style.left = `${Math.round(left)}px`;
        this.host.style.top = `${Math.round(placeBelow ? rect.bottom : rect.top)}px`;
    }

    private scheduleReposition(): void {
        this.cancelReposition();
        this.positionFrame = window.requestAnimationFrame(() => {
            this.positionFrame = null;
            if ((!this.currentAnchor && !this.currentAnchorRect) || !this.host.isConnected) return;
            this.positionToAnchor(this.currentAnchorRect ?? this.currentAnchor!.getBoundingClientRect());
        });
    }

    private cancelReposition(): void {
        if (this.positionFrame === null) return;
        window.cancelAnimationFrame(this.positionFrame);
        this.positionFrame = null;
    }

    private renderActions(actions: ToolbarHoverPortalAction[]): void {
        this.tooltipDelegate.hide();
        this.host.style.removeProperty('width');
        this.actionsRoot.replaceChildren();
        this.bottomActionsRoot.replaceChildren();
        this.actionsRoot.dataset.layout = actions.length > 1 ? 'multi' : 'single';
        const split = actions.some(action => action.placement === 'bottom');
        this.host.dataset.layout = split ? 'split' : actions.length > 1 ? 'multi' : 'single';
        this.actionsRoot.hidden = actions.every(action => action.placement === 'bottom');
        this.bridge.hidden = this.actionsRoot.hidden;
        this.bottomActionsRoot.hidden = !split;
        this.bottomBridge.hidden = !split;
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
            button.disabled = Boolean(action.disabled);
            if (action.busy) button.setAttribute('aria-busy', 'true');
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
            if (action.preserveSelection) {
                button.addEventListener('pointerdown', (event) => event.preventDefault());
            }
            button.addEventListener('click', (event) => {
                if (button.disabled) return;
                event.preventDefault();
                event.stopPropagation();
                action.onClick();
            });
            (action.placement === 'bottom' ? this.bottomActionsRoot : this.actionsRoot).appendChild(button);
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
        this.onWindowKeyDown = (event: Event) => {
            if (event instanceof KeyboardEvent && event.key === 'Escape') this.onRequestClose?.();
        };
        document.addEventListener('pointerdown', this.onDocPointerDown, true);
        window.addEventListener('resize', this.onWindowResize, true);
        window.addEventListener('scroll', this.onWindowScroll, true);
        window.addEventListener('keydown', this.onWindowKeyDown, true);
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
        if (this.onWindowKeyDown) {
            window.removeEventListener('keydown', this.onWindowKeyDown, true);
            this.onWindowKeyDown = null;
        }
    }

    private getCss(): string {
        return `
:host {
  --_toolbar-hover-max-width: 560px;
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
  max-width: min(92vw, var(--_toolbar-hover-max-width));
  flex-wrap: wrap;
  transform: translateY(calc(-100% - var(--aimd-space-2)));
  pointer-events: auto;
}

[hidden] { display: none; }

:host([data-placement="split"]) .toolbar-hover-actions {
  position: absolute;
  left: 50%;
  top: var(--_toolbar-hover-top-edge);
  width: max-content;
  transform: translate(-50%, -100%);
}

:host([data-placement="split"]) .toolbar-hover-actions--bottom {
  top: var(--_toolbar-hover-bottom-edge);
  transform: translateX(-50%);
}

:host([data-placement="split"]) .toolbar-hover-bridge--bottom {
  top: calc(var(--_toolbar-hover-bottom-edge) - var(--aimd-space-3));
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
  left: var(--_toolbar-hover-anchor-x, 50%);
  top: calc(-1 * var(--aimd-space-3));
  width: calc(var(--aimd-size-control-icon-toolbar) + var(--aimd-space-4));
  height: var(--aimd-space-4);
  transform: translateX(-50%);
  pointer-events: auto;
  background: transparent;
}

:host([data-layout="multi"]) .toolbar-hover-bridge {
  width: min(92vw, var(--_toolbar-hover-max-width));
}

:host([data-placement="bottom"]) .toolbar-hover-bridge {
  top: 0;
  transform: translate(-50%, calc(-1 * var(--aimd-space-2)));
}

.toolbar-hover-action:hover {
  border-color: color-mix(in srgb, var(--aimd-border-strong) 72%, var(--aimd-interactive-primary) 20%);
}

.toolbar-hover-action:disabled {
  opacity: 0.62;
  cursor: wait;
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
