import { messageSquareTextIcon } from '../../../assets/icons';
import type { AppearanceSnapshot } from '../../../style/appearance';
import { areAppearanceSnapshotsEqual } from '../../../style/appearance';
import { AppearanceScope } from '../../../style/appearanceScope';
import { ensureStyle } from '../../../style/shadow';
import { createIcon } from '../components/Icon';
import { AIMD_CONVERSATION_SURFACE_CONSUMER_ATTRIBUTE } from '../../../contracts/conversationSurface';

const HOST_ROLE = 'chatgpt-page-annotation-markers';
const STYLE_ID = 'aimd-chatgpt-page-annotation-markers-style';
const TOKEN_STYLE_ID = 'aimd-chatgpt-page-annotation-markers-tokens';

export type MarkersAnchorRender = {
    id: string;
    left: number;
    top: number;
    active: boolean;
    label?: string;
    onOpen: () => void;
};

export type MarkersItemRender = {
    root: HTMLElement;
    highlights: Array<{ left: number; top: number; width: number; height: number }>;
    anchors: MarkersAnchorRender[];
    /** Stable layout signature supplied by the controller/planner. */
    signature?: string;
};

function getMarkersCss(): string {
    return `
.markers-layer,
.markers-layer * {
  box-sizing: border-box;
}

.markers-layer {
  position: absolute;
  inset: 0;
  pointer-events: none;
  --_reader-comment-floating-bg: var(--aimd-button-floating-bg);
  --_reader-comment-floating-border: var(--aimd-button-floating-border);
  --_reader-comment-floating-hover-bg: var(--aimd-button-floating-hover);
  --_reader-comment-floating-active-bg: var(--aimd-button-floating-active);
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

.icon-btn .aimd-icon,
.icon-btn .aimd-icon svg {
  width: var(--aimd-size-control-glyph-panel);
  height: var(--aimd-size-control-glyph-panel);
}

.reader-comment-highlight {
  position: absolute;
  background: color-mix(in srgb, var(--aimd-interactive-selected) 92%, var(--aimd-bg-primary));
  border-radius: var(--aimd-radius-sm);
}

.reader-comment-highlight--active {
  background: color-mix(in srgb, var(--aimd-interactive-selected) 98%, var(--aimd-interactive-primary) 12%);
}

.reader-comment-anchor {
  position: absolute;
  pointer-events: auto;
  border-color: var(--_reader-comment-floating-border);
  background: var(--_reader-comment-floating-bg);
}

.reader-comment-anchor .aimd-icon {
  color: var(--aimd-interactive-primary);
}

.reader-comment-anchor:hover {
  color: var(--aimd-interactive-primary);
  background: var(--_reader-comment-floating-hover-bg);
  border-color: var(--_reader-comment-floating-border);
}

.reader-comment-anchor:active {
  color: var(--aimd-interactive-primary);
  background: var(--_reader-comment-floating-active-bg);
  border-color: var(--_reader-comment-floating-border);
}
`;
}

type MarkerHost = {
    host: HTMLElement;
    shadow: ShadowRoot;
    layer: HTMLElement;
    scope: AppearanceScope;
    signature: string | null;
};

/**
 * Renders annotation highlights and anchor buttons directly inside each
 * message content root. Because the hosts live in the page DOM, the markers
 * scroll with the conversation naturally — no scroll listeners, no per-frame
 * repositioning, and no stacked duplicate layers.
 */
export class PageAnnotationMarkers {
    private readonly hosts = new Map<HTMLElement, MarkerHost>();
    private appearance: AppearanceSnapshot;

    constructor(appearance: AppearanceSnapshot) {
        this.appearance = appearance;
    }

    setAppearance(snapshot: AppearanceSnapshot): void {
        if (areAppearanceSnapshotsEqual(this.appearance, snapshot)) return;
        this.appearance = snapshot;
        for (const entry of this.hosts.values()) entry.scope.apply(snapshot);
    }

    render(items: MarkersItemRender[]): void {
        const activeRoots = new Set(items.map((item) => item.root));
        for (const [root, entry] of this.hosts) {
            if (activeRoots.has(root) && entry.host.isConnected) continue;
            entry.host.remove();
            entry.scope.dispose();
            this.hosts.delete(root);
        }

        const placements = items.map((item) => {
            const entry = this.ensureHost(item.root);
            const rootRect = item.root.getBoundingClientRect();
            const hostRect = entry.host.getBoundingClientRect();
            return {
                item,
                entry,
                dx: rootRect.left - hostRect.left,
                dy: rootRect.top - hostRect.top,
                signature: item.signature ?? fallbackSignature(item),
            };
        });

        for (const { item, entry, dx, dy, signature } of placements) {
            if (entry.signature === signature && entry.host.isConnected) continue;
            const layer = entry.layer;
            layer.replaceChildren();
            for (const rect of item.highlights) {
                const highlight = document.createElement('div');
                highlight.className = 'reader-comment-highlight';
                highlight.style.left = `${Math.round(rect.left + dx)}px`;
                highlight.style.top = `${Math.round(rect.top + dy)}px`;
                highlight.style.width = `${Math.round(rect.width)}px`;
                highlight.style.height = `${Math.round(rect.height)}px`;
                layer.appendChild(highlight);
            }
            for (const anchor of item.anchors) {
                const button = document.createElement('button');
                button.type = 'button';
                button.className = `icon-btn reader-comment-anchor${anchor.active ? ' reader-comment-highlight--active' : ''}`;
                button.dataset.action = 'page-comment-open';
                const label = anchor.label?.trim() || 'Open annotation';
                button.setAttribute('aria-label', label);
                button.title = label;
                button.style.left = `${Math.round(anchor.left + dx)}px`;
                button.style.top = `${Math.round(anchor.top + dy)}px`;
                button.appendChild(createIcon(messageSquareTextIcon));
                button.addEventListener('click', () => anchor.onOpen());
                layer.appendChild(button);
            }
            entry.signature = signature;
        }
    }

    hasHosts(): boolean {
        return this.hosts.size > 0;
    }

    dispose(): void {
        for (const [, entry] of this.hosts) {
            entry.host.remove();
            entry.scope.dispose();
        }
        this.hosts.clear();
    }

    private ensureHost(root: HTMLElement): MarkerHost {
        const existing = this.hosts.get(root);
        if (existing && existing.host.isConnected) return existing;
        if (existing) {
            existing.scope.dispose();
            this.hosts.delete(root);
        }

        const host = document.createElement('div');
        host.dataset.aimdRole = HOST_ROLE;
        host.setAttribute(AIMD_CONVERSATION_SURFACE_CONSUMER_ATTRIBUTE, '');
        // Zero-height positioned anchor: absolute children resolve against this
        // host's padding box, so markers scroll with the root and never disturb
        // the official message layout.
        host.style.cssText = 'position: relative; height: 0; width: 100%; pointer-events: none; z-index: var(--aimd-z-base);';
        const shadow = host.attachShadow({ mode: 'open' });
        const scope = AppearanceScope.forShadowRoot(shadow, { styleId: TOKEN_STYLE_ID });
        scope.apply(this.appearance);
        ensureStyle(shadow, getMarkersCss(), { id: STYLE_ID, cache: 'shared' });
        const layer = document.createElement('div');
        layer.className = 'markers-layer';
        shadow.appendChild(layer);
        root.insertBefore(host, root.firstChild);

        const entry: MarkerHost = { host, shadow, layer, scope, signature: null };
        this.hosts.set(root, entry);
        return entry;
    }

}

function fallbackSignature(item: MarkersItemRender): string {
    return JSON.stringify({
        highlights: item.highlights,
        anchors: item.anchors.map((anchor) => [anchor.id, anchor.left, anchor.top, anchor.active]),
    });
}
