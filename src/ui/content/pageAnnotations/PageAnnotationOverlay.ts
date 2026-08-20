import { copyIcon, messageSquareTextIcon } from '../../../assets/icons';
import type { AppearanceSnapshot } from '../../../style/appearance';
import { areAppearanceSnapshotsEqual } from '../../../style/appearance';
import { AppearanceScope } from '../../../style/appearanceScope';
import { ensureStyle } from '../../../style/shadow';
import { createIcon } from '../components/Icon';
import { AIMD_CONVERSATION_SURFACE_CONSUMER_ATTRIBUTE } from '../../../contracts/conversationSurface';

const OVERLAY_ID = 'aimd-chatgpt-page-annotation-overlay';
const STYLE_ID = 'aimd-chatgpt-page-annotation-style';
const TOKEN_STYLE_ID = 'aimd-chatgpt-page-annotation-tokens';

export type PageAnnotationToolbarRender = {
    left: number;
    top: number;
    copyLabel: string;
    commentLabel: string;
    onActionPointerDown?: () => void;
    onActionPointerCancel?: () => void;
    onCopy: () => void;
    onComment: () => void;
};

function getOverlayCss(): string {
    return `
:host {
  position: fixed;
  inset: 0;
  pointer-events: none;
  z-index: var(--aimd-z-panel);
}

.page-annotation-layer,
.page-annotation-layer * {
  box-sizing: border-box;
}

.page-annotation-layer {
  position: absolute;
  inset: 0;
  pointer-events: none;
  --_reader-comment-floating-bg: var(--aimd-button-floating-bg);
  --_reader-comment-floating-border: var(--aimd-button-floating-border);
  --_reader-comment-floating-hover-bg: var(--aimd-button-floating-hover);
  --_reader-comment-floating-active-bg: var(--aimd-button-floating-active);
}

.page-annotation-markers {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.page-annotation-popover-layer {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.icon-btn {
  all: unset;
  box-sizing: border-box;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
  width: var(--aimd-size-control-icon-panel);
  height: var(--aimd-size-control-icon-panel);
  border-radius: var(--aimd-radius-full);
  border: 1px solid transparent;
  background: transparent;
  color: var(--aimd-button-icon-text);
  transition: background var(--aimd-duration-fast) var(--aimd-ease-in-out),
    border-color var(--aimd-duration-fast) var(--aimd-ease-in-out),
    color var(--aimd-duration-fast) var(--aimd-ease-in-out);
}

.icon-btn:focus-visible,
.secondary-btn:focus-visible {
  outline: 2px solid var(--aimd-focus-ring);
  outline-offset: 2px;
}

.icon-btn .aimd-icon,
.icon-btn .aimd-icon svg {
  width: var(--aimd-size-control-glyph-panel);
  height: var(--aimd-size-control-glyph-panel);
}

.secondary-btn {
  all: unset;
  box-sizing: border-box;
  cursor: pointer;
  user-select: none;
  min-height: var(--aimd-size-control-action-panel);
  padding: 0 var(--aimd-space-3);
  border-radius: var(--aimd-radius-full);
  border: 1px solid var(--aimd-border-default);
  background: var(--aimd-button-secondary-bg);
  color: var(--aimd-button-secondary-text);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--aimd-space-2);
  font-size: var(--aimd-button-label-size);
  line-height: 1;
  font-weight: var(--aimd-font-medium);
}

.secondary-btn:hover {
  background: var(--aimd-button-secondary-hover);
}

.secondary-btn:active {
  background: color-mix(in srgb, var(--aimd-button-secondary-hover) 78%, var(--aimd-button-icon-active));
}

.secondary-btn--primary {
  background: var(--aimd-interactive-primary);
  border-color: transparent;
  color: var(--aimd-text-on-primary);
  font-weight: var(--aimd-font-semibold);
}

.secondary-btn--primary:hover,
.secondary-btn--primary:active {
  background: var(--aimd-interactive-primary-hover);
}

.reader-comment-action {
  position: absolute;
  pointer-events: auto;
  display: inline-flex;
  align-items: center;
  gap: var(--aimd-space-2);
  white-space: nowrap;
}

.reader-comment-action .aimd-icon {
  color: var(--aimd-interactive-primary);
}

.reader-comment-action__button {
  color: var(--aimd-text-secondary);
  background: var(--_reader-comment-floating-bg);
  border-color: var(--_reader-comment-floating-border);
}

.reader-comment-action__button:hover,
.reader-comment-action__button:focus-visible {
  color: var(--aimd-interactive-primary);
  background: var(--_reader-comment-floating-hover-bg);
  border-color: var(--_reader-comment-floating-border);
}

.reader-comment-action__button:active,
.reader-comment-action__button:focus {
  color: var(--aimd-interactive-primary);
  background: var(--_reader-comment-floating-active-bg);
  border-color: var(--_reader-comment-floating-border);
}

`;
}

export class PageAnnotationOverlay {
    private readonly host: HTMLElement;
    private readonly shadow: ShadowRoot;
    private readonly layer: HTMLElement;
    private readonly markersLayer: HTMLElement;
    private readonly popoverLayer: HTMLElement;
    private readonly appearanceScope: AppearanceScope;
    private appearance: AppearanceSnapshot;
    private toolbarEl: HTMLElement | null = null;

    constructor(appearance: AppearanceSnapshot) {
        this.appearance = appearance;
        this.host = document.createElement('div');
        this.host.id = OVERLAY_ID;
        this.host.dataset.aimdRole = 'chatgpt-page-annotation-overlay';
        this.host.setAttribute(AIMD_CONVERSATION_SURFACE_CONSUMER_ATTRIBUTE, '');
        this.shadow = this.host.attachShadow({ mode: 'open' });
        this.appearanceScope = AppearanceScope.forShadowRoot(this.shadow, { styleId: TOKEN_STYLE_ID });
        this.appearanceScope.apply(appearance);
        ensureStyle(this.shadow, getOverlayCss(), { id: STYLE_ID, cache: 'shared' });

        this.layer = document.createElement('div');
        this.layer.className = 'page-annotation-layer';
        this.markersLayer = document.createElement('div');
        this.markersLayer.className = 'page-annotation-markers';
        this.popoverLayer = document.createElement('div');
        this.popoverLayer.className = 'page-annotation-popover-layer';
        this.layer.append(this.markersLayer, this.popoverLayer);
        this.shadow.appendChild(this.layer);
        this.ensureMounted();
    }

    getHost(): HTMLElement {
        return this.host;
    }

    getShadow(): ShadowRoot {
        return this.shadow;
    }

    /** Container for the ReaderCommentPopover; stays above the marker layers. */
    getContainer(): HTMLElement {
        return this.popoverLayer;
    }

    setAppearance(snapshot: AppearanceSnapshot): void {
        if (areAppearanceSnapshotsEqual(this.appearance, snapshot)) return;
        this.appearance = snapshot;
        this.appearanceScope.apply(snapshot);
    }

    ensureMounted(): void {
        const portal = document.body ?? document.documentElement;
        if (portal && this.host.parentElement !== portal) portal.appendChild(this.host);
    }

    isMounted(): boolean {
        return this.host.isConnected;
    }

    renderToolbar(toolbar: PageAnnotationToolbarRender | null): void {
        if (this.toolbarEl) {
            this.toolbarEl.remove();
            this.toolbarEl = null;
        }
        if (!toolbar) return;
        const group = document.createElement('div');
        group.className = 'reader-comment-action';
        group.style.left = `${Math.round(toolbar.left)}px`;
        group.style.top = `${Math.round(toolbar.top)}px`;

        const copyButton = document.createElement('button');
        copyButton.type = 'button';
        copyButton.className = 'icon-btn reader-comment-action__button';
        copyButton.dataset.action = 'page-selection-copy';
        copyButton.setAttribute('aria-label', toolbar.copyLabel);
        copyButton.title = toolbar.copyLabel;
        copyButton.appendChild(createIcon(copyIcon));
        copyButton.addEventListener('pointerdown', (event) => {
            event.preventDefault();
            toolbar.onActionPointerDown?.();
        });
        copyButton.addEventListener('pointercancel', () => toolbar.onActionPointerCancel?.());
        copyButton.addEventListener('click', () => {
            try {
                toolbar.onCopy();
            } finally {
                toolbar.onActionPointerCancel?.();
            }
        });

        const commentButton = document.createElement('button');
        commentButton.type = 'button';
        commentButton.className = 'icon-btn reader-comment-action__button';
        commentButton.dataset.action = 'page-comment-add';
        commentButton.setAttribute('aria-label', toolbar.commentLabel);
        commentButton.title = toolbar.commentLabel;
        commentButton.appendChild(createIcon(messageSquareTextIcon));
        commentButton.addEventListener('pointerdown', (event) => {
            event.preventDefault();
            toolbar.onActionPointerDown?.();
        });
        commentButton.addEventListener('pointercancel', () => toolbar.onActionPointerCancel?.());
        commentButton.addEventListener('click', () => {
            try {
                toolbar.onComment();
            } finally {
                toolbar.onActionPointerCancel?.();
            }
        });

        group.append(copyButton, commentButton);
        this.markersLayer.appendChild(group);
        this.toolbarEl = group;
    }

    unmount(): void {
        this.appearanceScope.dispose();
        this.host.remove();
        this.toolbarEl = null;
    }
}
