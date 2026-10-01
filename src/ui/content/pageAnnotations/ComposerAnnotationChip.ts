import { messageSquareTextIcon } from '../../../assets/workspaceIcons';
import type { AppearanceSnapshot } from '../../../style/appearance';
import { areAppearanceSnapshotsEqual } from '../../../style/appearance';
import { AppearanceScope } from '../../../style/appearanceScope';
import { ensureStyle } from '../../../style/shadow';
import { createIcon } from '../components/Icon';
import { AIMD_CONVERSATION_SURFACE_CONSUMER_ATTRIBUTE } from '../../../contracts/conversationSurface';
import { activateChatGPTComposerInputEnhancementMount } from '../../../drivers/content/chatgpt/composerInputEnhancementMount';
import { getAnnotationActionButtonCss } from './annotationActionButtonCss';

const CHIP_ROLE = 'page-annotation-composer-chip';
const STYLE_ID = 'aimd-page-annotation-composer-chip-style';
const TOKEN_STYLE_ID = 'aimd-page-annotation-composer-chip-tokens';

function getChipCss(): string {
    return getAnnotationActionButtonCss() + `
:host {
  display: inline-flex;
  align-items: center;
  margin-inline-start: var(--aimd-space-1);
  font-family: var(--aimd-font-family-sans);
}
.chip-button[data-active="1"], .chip-button[data-active="1"]:hover:not(:disabled) {
  color: color-mix(in srgb, var(--aimd-interactive-primary) 60%, var(--aimd-text-primary));
  background: var(--aimd-interactive-selected);
}
`;
}

export type ComposerAnnotationChipHandlers = {
    onOpenManager: (anchor: HTMLElement) => void;
    label: string;
    active?: boolean;
    stateDescription?: string;
};

/**
 * The annotation entry embedded in the ChatGPT composer action row. It shows
 * the current-conversation annotation count; clicking opens the manager.
 */
export class ComposerAnnotationChip {
    private host: HTMLElement | null = null;
    private countEl: HTMLElement | null = null;
    private appearanceScope: AppearanceScope | null = null;
    private appearance: AppearanceSnapshot;
    private handlers: ComposerAnnotationChipHandlers | null = null;
    private button: HTMLButtonElement | null = null;
    private mountedContainer: HTMLElement | null = null;
    private releaseMount: (() => void) | null = null;

    constructor(appearance: AppearanceSnapshot, private readonly options: { icon?: string; role?: string; showCount?: boolean } = {}) {
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

    /** Render the chip only while the current conversation has annotations. */
    render(mount: { container: HTMLElement; anchor: HTMLElement; officialContainer?: HTMLElement } | null, count: number, handlers: ComposerAnnotationChipHandlers): void {
        this.handlers = handlers;
        if (this.button) {
            this.button.setAttribute('aria-label', handlers.label);
            this.button.title = handlers.label;
            this.syncActiveState();
        }
        if (!mount || count < 1) {
            this.host?.remove();
            this.releaseMount?.();
            this.releaseMount = null;
            this.mountedContainer = null;
            return;
        }
        if (this.mountedContainer !== mount.container) {
            this.releaseMount?.();
            this.releaseMount = activateChatGPTComposerInputEnhancementMount(
                mount.container,
                mount.officialContainer ?? mount.anchor,
            );
            this.mountedContainer = mount.container;
        }
        if (!this.host) {
            this.createHost(mount.container);
        }
        const preferredAnchor = mount.anchor;
        if (
            this.host!.parentElement !== mount.container
            || !(preferredAnchor.compareDocumentPosition(this.host!) & Node.DOCUMENT_POSITION_FOLLOWING)
        ) {
            mount.container.insertBefore(this.host!, preferredAnchor.nextSibling);
        }
        if (this.countEl && this.countEl.textContent !== String(count)) this.countEl.textContent = String(count);
    }

    dispose(): void {
        this.releaseMount?.();
        this.releaseMount = null;
        this.mountedContainer = null;
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
        host.dataset.aimdRole = this.options.role ?? CHIP_ROLE;
        host.setAttribute(AIMD_CONVERSATION_SURFACE_CONSUMER_ATTRIBUTE, '');
        const shadow = host.attachShadow({ mode: 'open' });
        const scope = AppearanceScope.forShadowRoot(shadow, { styleId: TOKEN_STYLE_ID });
        scope.apply(this.appearance);
        ensureStyle(shadow, getChipCss(), { id: STYLE_ID, cache: 'shared' });

        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'chip-button annotation-action-button annotation-action-button--composer';
        const label = this.handlers?.label?.trim() || 'Page annotations';
        button.setAttribute('aria-label', label);
        button.title = label;
        button.appendChild(createIcon(this.options.icon ?? messageSquareTextIcon));
        const count = document.createElement('span');
        count.className = 'chip-count';
        if (this.options.showCount !== false) button.appendChild(count);
        button.addEventListener('click', (event) => {
            event.preventDefault();
            event.stopPropagation();
            this.handlers?.onOpenManager(button);
        });
        shadow.appendChild(button);

        this.host = host;
        this.countEl = count;
        this.button = button;
        this.syncActiveState();
        this.appearanceScope = scope;
        container.appendChild(host);
    }

    private syncActiveState(): void {
        if (!this.button || !this.handlers) return;
        if (this.handlers.active === undefined) delete this.button.dataset.active;
        else this.button.dataset.active = this.handlers.active ? '1' : '0';
        if (this.handlers.stateDescription) this.button.setAttribute('aria-description', this.handlers.stateDescription);
        else this.button.removeAttribute('aria-description');
    }
}
