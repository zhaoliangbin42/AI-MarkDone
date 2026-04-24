import type { Theme } from '../../../core/types/theme';
import { getTokenCss } from '../../../style/tokens';
import { ensureStyle } from '../../../style/shadow';
import { createIcon } from './Icon';

export type ToolbarHoverActionPortalParams = {
    anchorEl: HTMLElement;
    label: string;
    icon: string;
    onClick: () => void;
    onPointerEnter?: () => void;
    onPointerLeave?: () => void;
    onRequestClose?: () => void;
};

export class ToolbarHoverActionPortal {
    private host: HTMLElement;
    private shadow: ShadowRoot;
    private button: HTMLButtonElement;
    private currentAnchor: HTMLElement | null = null;
    private onClick: (() => void) | null = null;
    private onPointerEnter: (() => void) | null = null;
    private onPointerLeave: (() => void) | null = null;
    private onRequestClose: (() => void) | null = null;
    private onDocPointerDown: ((event: Event) => void) | null = null;
    private onWindowResize: (() => void) | null = null;
    private onWindowScroll: (() => void) | null = null;

    constructor(theme: Theme) {
        this.host = document.createElement('div');
        this.host.className = 'aimd-toolbar-hover-action-host';
        this.host.dataset.open = '0';
        this.host.setAttribute('data-aimd-theme', theme);
        this.shadow = this.host.attachShadow({ mode: 'open' });
        ensureStyle(this.shadow, getTokenCss(theme), { id: 'aimd-toolbar-hover-action-tokens' });
        ensureStyle(this.shadow, this.getCss(), { id: 'aimd-toolbar-hover-action-base', cache: 'shared' });

        this.button = document.createElement('button');
        this.button.type = 'button';
        this.button.className = 'toolbar-hover-action';
        this.button.dataset.role = 'toolbar-hover-action';
        this.button.addEventListener('click', (event) => {
            event.preventDefault();
            event.stopPropagation();
            this.onClick?.();
        });
        this.button.addEventListener('pointerenter', () => this.onPointerEnter?.());
        this.button.addEventListener('pointerleave', () => this.onPointerLeave?.());
        this.shadow.appendChild(this.button);
    }

    isOpen(): boolean {
        return this.host.dataset.open === '1';
    }

    setTheme(theme: Theme): void {
        this.host.setAttribute('data-aimd-theme', theme);
        ensureStyle(this.shadow, getTokenCss(theme), { id: 'aimd-toolbar-hover-action-tokens' });
    }

    open(params: ToolbarHoverActionPortalParams): void {
        this.currentAnchor = params.anchorEl;
        this.onClick = params.onClick;
        this.onPointerEnter = params.onPointerEnter ?? null;
        this.onPointerLeave = params.onPointerLeave ?? null;
        this.onRequestClose = params.onRequestClose ?? null;
        this.button.replaceChildren(createIcon(params.icon), document.createTextNode(params.label));
        this.button.setAttribute('aria-label', params.label);
        this.button.setAttribute('title', params.label);

        if (!this.host.isConnected) {
            document.body.appendChild(this.host);
        }

        this.positionToAnchor(params.anchorEl);
        this.host.dataset.open = '1';
        this.installGlobalHandlers();
    }

    close(): void {
        this.host.dataset.open = '0';
        this.currentAnchor = null;
        this.onClick = null;
        this.onPointerEnter = null;
        this.onPointerLeave = null;
        this.onRequestClose = null;
        this.removeGlobalHandlers();
        this.host.remove();
    }

    dispose(): void {
        this.close();
    }

    private positionToAnchor(anchorEl: HTMLElement): void {
        const rect = anchorEl.getBoundingClientRect();
        this.host.style.left = `${rect.left + (rect.width / 2)}px`;
        this.host.style.top = `${rect.top}px`;
    }

    private installGlobalHandlers(): void {
        this.removeGlobalHandlers();
        this.onDocPointerDown = (event: Event) => {
            const path = typeof event.composedPath === 'function' ? event.composedPath() : [];
            if (path.includes(this.host)) return;
            if (this.currentAnchor && path.includes(this.currentAnchor)) return;

            const target = event.target;
            if (target instanceof Node) {
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

.toolbar-hover-action {
  all: unset;
  box-sizing: border-box;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--aimd-space-2);
  min-height: var(--aimd-size-control-action-panel);
  padding: 0 var(--aimd-space-3);
  border-radius: var(--aimd-radius-full);
  border: 1px solid color-mix(in srgb, var(--aimd-border-strong) 72%, transparent);
  background: color-mix(in srgb, var(--aimd-bg-surface) 99%, var(--aimd-bg-primary));
  color: var(--aimd-text-primary);
  box-shadow: var(--aimd-shadow-lg);
  font-family: var(--aimd-font-family-sans);
  font-size: var(--aimd-text-sm);
  font-weight: var(--aimd-font-medium);
  line-height: 1;
  white-space: nowrap;
  pointer-events: auto;
  cursor: pointer;
  transform: translate(-50%, calc(-100% - var(--aimd-space-2)));
  transition: background var(--aimd-duration-fast) var(--aimd-ease-in-out),
              border-color var(--aimd-duration-fast) var(--aimd-ease-in-out),
              color var(--aimd-duration-fast) var(--aimd-ease-in-out);
}

.toolbar-hover-action:hover {
  background: color-mix(in srgb, var(--aimd-button-secondary-hover) 90%, var(--aimd-sys-color-surface-hover));
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
