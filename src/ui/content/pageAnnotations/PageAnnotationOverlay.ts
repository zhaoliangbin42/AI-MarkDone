import { copyIcon, messageSquareTextIcon, trashIcon } from '../../../assets/workspaceIcons';
import { createHighlightSwatches, getHighlightSwatchesCss, type HighlightColor } from '../components/HighlightSwatches';
import type { AppearanceSnapshot } from '../../../style/appearance';
import { areAppearanceSnapshotsEqual } from '../../../style/appearance';
import { AppearanceScope } from '../../../style/appearanceScope';
import { ensureStyle } from '../../../style/shadow';
import { createIcon } from '../components/Icon';
import { AIMD_CONVERSATION_SURFACE_CONSUMER_ATTRIBUTE } from '../../../contracts/conversationSurface';
import { getAnnotationActionButtonCss } from './annotationActionButtonCss';

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
    copyEnabled?: boolean;
    onComment: () => void;
    commentEnabled?: boolean;
    onHighlight?: (color: HighlightColor) => Promise<void>;
};

export type PageHighlightActionsRender = {
    anchorRect: DOMRect;
    color: HighlightColor;
    deleteLabel: string;
    onColor: (color: HighlightColor) => Promise<void>;
    onDelete: () => Promise<void>;
};

function getOverlayCss(): string {
    return getPageSelectionToolbarCss() + `
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

.secondary-btn:focus-visible {
  outline: 2px solid var(--aimd-focus-ring);
  outline-offset: 2px;
}


.reader-highlight-actions {
  position: absolute;
  pointer-events: auto;
  display: inline-flex;
  align-items: center;
  gap: var(--aimd-space-2);
  padding: var(--aimd-space-2);
  border: 1px solid var(--aimd-workspace-border);
  border-radius: var(--aimd-radius-full);
  background: var(--aimd-workspace-card);
  box-shadow: var(--aimd-workspace-raised);
}

.reader-highlight-actions__delete {
  all: unset;
  box-sizing: border-box;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: var(--aimd-size-control-compact);
  height: var(--aimd-size-control-compact);
  border-radius: var(--aimd-radius-full);
  color: var(--aimd-button-icon-text);
}
.reader-highlight-actions__delete:hover { color: var(--aimd-color-danger); background: var(--aimd-interactive-hover); }
.reader-highlight-actions__delete:focus-visible { outline: 2px solid var(--aimd-focus-ring); outline-offset: 2px; }
.reader-highlight-actions__delete .aimd-icon, .reader-highlight-actions__delete svg { width: var(--aimd-size-control-glyph-panel); height: var(--aimd-size-control-glyph-panel); }

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
    private highlightActionsEl: HTMLElement | null = null;

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
        this.clearToolbar();
        if (!toolbar) return;
        const group = createPageSelectionToolbar(toolbar);
        this.markersLayer.appendChild(group);
        this.toolbarEl = group;
    }

    renderHighlightActions(actions: PageHighlightActionsRender | null): void {
        this.highlightActionsEl?.remove();
        this.highlightActionsEl = null;
        if (!actions) return;
        const group = document.createElement('div');
        group.className = 'reader-highlight-actions';
        group.dataset.role = 'page-highlight-actions';
        const swatches = createHighlightSwatches({ selected: actions.color, onSelect: color => void run(color) });
        const remove = document.createElement('button');
        remove.type = 'button';
        remove.className = 'reader-highlight-actions__delete';
        remove.dataset.action = 'page-highlight-delete';
        remove.setAttribute('aria-label', actions.deleteLabel);
        remove.title = actions.deleteLabel;
        remove.appendChild(createIcon(trashIcon));
        remove.addEventListener('click', () => void run());
        const run = async (color?: HighlightColor): Promise<void> => {
            group.querySelectorAll<HTMLButtonElement>('button').forEach(button => { button.disabled = true; });
            try {
                if (color) await actions.onColor(color);
                else await actions.onDelete();
            } finally {
                group.querySelectorAll<HTMLButtonElement>('button').forEach(button => { button.disabled = false; });
            }
        };
        group.append(swatches, remove);
        this.popoverLayer.appendChild(group);
        const gap = Number.parseFloat(getComputedStyle(group).getPropertyValue('--aimd-space-2')) || 0;
        const { width, height } = group.getBoundingClientRect();
        group.style.left = `${Math.round(Math.max(gap, Math.min(actions.anchorRect.left - width - gap, window.innerWidth - width - gap)))}px`;
        group.style.top = `${Math.round(Math.max(gap, Math.min(actions.anchorRect.top + actions.anchorRect.height / 2 - height / 2, window.innerHeight - height - gap)))}px`;
        this.highlightActionsEl = group;
    }

    unmount(): void {
        this.clearToolbar();
        this.renderHighlightActions(null);
        this.appearanceScope.dispose();
        this.host.remove();
    }

    private clearToolbar(): void {
        this.toolbarEl?.remove();
        this.toolbarEl = null;
    }
}

/** Pure action row shared with Settings; callbacks define its side effects. */
export function createPageSelectionToolbar(toolbar: PageAnnotationToolbarRender): HTMLElement {
        const group = document.createElement('div');
        group.className = 'reader-comment-action';
        group.style.left = `${Math.round(toolbar.left)}px`;
        group.style.top = `${Math.round(toolbar.top)}px`;

        const copyButton = document.createElement('button');
        copyButton.type = 'button';
        copyButton.className = 'icon-btn reader-comment-action__button annotation-action-button';
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
        commentButton.className = 'icon-btn reader-comment-action__button annotation-action-button';
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

        if (toolbar.copyEnabled !== false) group.append(copyButton);
        if (toolbar.commentEnabled !== false) group.append(commentButton);
        if (toolbar.onHighlight) {
            const swatches = createHighlightSwatches({ onSelect: async color => {
                group.querySelectorAll<HTMLButtonElement>('button').forEach(button => { button.disabled = true; });
                try { await toolbar.onHighlight!(color); }
                finally {
                    group.querySelectorAll<HTMLButtonElement>('button').forEach(button => { button.disabled = false; });
                    toolbar.onActionPointerCancel?.();
                }
            } });
            swatches.addEventListener('pointerdown', () => toolbar.onActionPointerDown?.());
            swatches.addEventListener('pointercancel', () => toolbar.onActionPointerCancel?.());
            group.append(swatches);
        }
    return group;
}

export function getPageSelectionToolbarCss(): string {
    return getHighlightSwatchesCss() + getAnnotationActionButtonCss() + `.reader-comment-action {
  position: absolute;
  pointer-events: auto;
  display: inline-flex;
  align-items: center;
  gap: var(--aimd-space-1);
  white-space: nowrap;
  padding: var(--aimd-space-1) var(--aimd-space-2);
  border: 1px solid var(--aimd-workspace-border);
  border-radius: var(--aimd-radius-full);
  background: var(--aimd-workspace-card);
  box-shadow: var(--aimd-workspace-raised);
}
`;
}
