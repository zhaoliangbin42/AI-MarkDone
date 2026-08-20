import { messageSquareTextIcon } from '../../../assets/icons';
import type { AppearanceSnapshot } from '../../../style/appearance';
import { areAppearanceSnapshotsEqual } from '../../../style/appearance';
import { AppearanceScope } from '../../../style/appearanceScope';
import { ensureStyle } from '../../../style/shadow';
import { createIcon } from '../components/Icon';
import { AIMD_CONVERSATION_SURFACE_CONSUMER_ATTRIBUTE } from '../../../contracts/conversationSurface';

const CHIP_ROLE = 'page-annotation-composer-chip';
const STYLE_ID = 'aimd-page-annotation-composer-chip-style';
const TOKEN_STYLE_ID = 'aimd-page-annotation-composer-chip-tokens';

function getChipCss(): string {
    return `
:host {
  display: inline-flex;
  align-items: center;
  margin-inline-start: var(--aimd-space-1);
  font-family: var(--aimd-font-family-sans);
}

.chip-button {
  all: unset;
  box-sizing: border-box;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--aimd-space-1);
  min-width: var(--aimd-size-control-icon-panel);
  height: var(--aimd-size-control-icon-panel);
  padding: 0 var(--aimd-space-2);
  border-radius: var(--aimd-radius-full);
  color: var(--aimd-button-icon-text);
  background: var(--aimd-button-icon-bg);
  cursor: pointer;
  transition: background var(--aimd-duration-fast) var(--aimd-ease-in-out),
    color var(--aimd-duration-fast) var(--aimd-ease-in-out),
    opacity var(--aimd-duration-fast) var(--aimd-ease-in-out);
}

.chip-button:hover:not(:disabled) {
  color: var(--aimd-button-icon-text-hover);
  background: var(--aimd-button-icon-hover);
}

.chip-button:focus-visible {
  outline: 2px solid var(--aimd-focus-ring);
  outline-offset: 2px;
}

.chip-button .aimd-icon,
.chip-button .aimd-icon svg {
  display: block;
  width: var(--aimd-size-control-glyph-panel);
  height: var(--aimd-size-control-glyph-panel);
  color: var(--aimd-interactive-primary);
}

.chip-count {
  font-size: var(--aimd-text-xs);
  font-weight: var(--aimd-font-semibold);
  line-height: 1;
  color: var(--aimd-interactive-primary);
  font-variant-numeric: tabular-nums;
}

@media (prefers-reduced-motion: reduce) {
  .chip-button { transition: none; }
}
`;
}

export type ComposerAnnotationChipHandlers = {
    onOpenManager: () => void;
    label: string;
};

/**
 * The annotation entry embedded inside the ChatGPT composer, sitting to the
 * right of the Markdown enhancement button. It shows the current-conversation
 * annotation count; clicking opens the annotation manager.
 */
export class ComposerAnnotationChip {
    private host: HTMLElement | null = null;
    private countEl: HTMLElement | null = null;
    private appearanceScope: AppearanceScope | null = null;
    private appearance: AppearanceSnapshot;
    private handlers: ComposerAnnotationChipHandlers | null = null;
    private button: HTMLButtonElement | null = null;

    constructor(appearance: AppearanceSnapshot) {
        this.appearance = appearance;
    }

    setAppearance(snapshot: AppearanceSnapshot): void {
        if (areAppearanceSnapshotsEqual(this.appearance, snapshot)) return;
        this.appearance = snapshot;
        this.appearanceScope?.apply(snapshot);
    }

    isConnected(): boolean {
        return Boolean(this.host?.isConnected);
    }

    /** Render the chip into the composer mount; pass zero count to hide it. */
    render(mount: { container: HTMLElement; anchor: HTMLElement } | null, count: number, handlers: ComposerAnnotationChipHandlers): void {
        this.handlers = handlers;
        if (this.button) {
            this.button.setAttribute('aria-label', handlers.label);
            this.button.title = handlers.label;
        }
        if (!mount || count < 1) {
            this.host?.remove();
            return;
        }
        if (!this.host) {
            this.createHost(mount.container);
        }
        // Always place the chip right after the Markdown enhancement button
        // (when present) so the two stay side by side in the composer row.
        const enhancementHost = mount.container.querySelector<HTMLElement>('[data-aimd-role="input-enhancement-button"]');
        const refNode = enhancementHost?.nextSibling ?? mount.anchor.nextSibling;
        if (this.host!.parentElement !== mount.container) {
            mount.container.insertBefore(this.host!, refNode);
        } else if (this.host!.nextSibling !== refNode) {
            mount.container.insertBefore(this.host!, refNode);
        }
        if (this.countEl) this.countEl.textContent = String(count);
    }

    dispose(): void {
        this.appearanceScope?.dispose();
        this.appearanceScope = null;
        this.host?.remove();
        this.host = null;
        this.countEl = null;
        this.button = null;
        this.handlers = null;
    }

    private createHost(container: HTMLElement): void {
        const host = document.createElement('span');
        host.dataset.aimdRole = CHIP_ROLE;
        host.setAttribute(AIMD_CONVERSATION_SURFACE_CONSUMER_ATTRIBUTE, '');
        const shadow = host.attachShadow({ mode: 'open' });
        const scope = AppearanceScope.forShadowRoot(shadow, { styleId: TOKEN_STYLE_ID });
        scope.apply(this.appearance);
        ensureStyle(shadow, getChipCss(), { id: STYLE_ID, cache: 'shared' });

        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'chip-button';
        const label = this.handlers?.label?.trim() || 'Page annotations';
        button.setAttribute('aria-label', label);
        button.title = label;
        button.appendChild(createIcon(messageSquareTextIcon));
        const count = document.createElement('span');
        count.className = 'chip-count';
        button.appendChild(count);
        button.addEventListener('click', (event) => {
            event.preventDefault();
            event.stopPropagation();
            this.handlers?.onOpenManager();
        });
        shadow.appendChild(button);

        this.host = host;
        this.countEl = count;
        this.button = button;
        this.appearanceScope = scope;
        container.appendChild(host);
    }
}
