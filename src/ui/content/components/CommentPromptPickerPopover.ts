import { xIcon } from '../../../assets/icons';
import { createIcon } from './Icon';
import { ensureStyle } from '../../../style/shadow';
import { markTransientRoot } from './transientUi';
import type { Theme } from '../../../core/types/theme';
import { getSurfaceMaterialCss } from './styles/surfaceMaterialCss';
import { getFlatWorkflowCss } from './styles/flatWorkflowCss';

type PromptOption = {
    id: string;
    title: string;
    content: string;
};

type OpenParams = {
    shadow: ShadowRoot;
    container: HTMLElement;
    anchorEl: HTMLElement;
    placement?: 'anchor' | 'center';
    theme: Theme;
    prompts: PromptOption[];
    labels: {
        title: string;
        close: string;
        empty: string;
    };
    onSelect: (promptId: string) => void;
    onClose?: () => void;
};

function getCss(): string {
    return `
.comment-prompt-picker-layer {
  pointer-events: none;
  z-index: var(--aimd-z-tooltip);
}

.comment-prompt-picker-layer[data-placement="center"] {
  position: fixed;
  inset: 0;
}

.comment-prompt-picker-layer[data-placement="anchor"] {
  position: absolute;
  inset: 0;
}

.comment-prompt-picker {
  position: absolute;
  width: min(420px, calc(100vw - (var(--aimd-space-4) * 2)));
  max-height: min(430px, calc(100vh - (var(--aimd-space-4) * 2)));
  display: flex;
  flex-direction: column;
  pointer-events: auto;
  overflow: hidden;
  min-width: 0;
}

.comment-prompt-picker__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--aimd-space-3);
  min-height: var(--aimd-panel-header-height-compact);
  padding: var(--aimd-space-4);
  flex: none;
}

.comment-prompt-picker__title {
  margin: 0;
  font-size: var(--aimd-text-sm);
  line-height: 1.4;
  font-weight: var(--aimd-font-medium);
  color: var(--aimd-text-primary);
  min-width: 0;
  overflow-wrap: anywhere;
}

.comment-prompt-picker__list {
  display: grid;
  grid-auto-rows: max-content;
  align-content: start;
  gap: var(--aimd-space-2);
  padding: var(--aimd-space-3);
  overflow: auto;
  overscroll-behavior: contain;
  flex: 1 1 auto;
  min-height: 0;
}

.comment-prompt-picker__item {
  all: unset;
  box-sizing: border-box;
  cursor: pointer;
  display: grid;
  grid-template-rows: max-content max-content;
  gap: var(--aimd-space-1);
  padding: var(--aimd-space-2) var(--aimd-space-3);
  min-width: 0;
  min-height: calc(var(--aimd-size-control-action-panel) + var(--aimd-space-1));
}

.comment-prompt-picker__item-title {
  display: block;
  font-size: var(--aimd-text-sm);
  line-height: 1.3;
  font-weight: var(--aimd-font-medium);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: normal;
  overflow-wrap: anywhere;
}

.comment-prompt-picker__item-content {
  display: block;
  color: var(--aimd-text-secondary);
  font-size: var(--aimd-text-xs);
  line-height: 1.35;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.comment-prompt-picker__empty {
  margin: 0;
  padding: var(--aimd-space-3);
  font-size: var(--aimd-text-xs);
  line-height: 1.45;
  color: var(--aimd-text-secondary);
}

.comment-prompt-picker__close {
  all: unset;
  box-sizing: border-box;
  cursor: pointer;
  width: calc(var(--aimd-size-control-action-panel) + var(--aimd-space-1));
  height: calc(var(--aimd-size-control-action-panel) + var(--aimd-space-1));
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
  transition:
    background var(--aimd-duration-fast) var(--aimd-ease-in-out),
    color var(--aimd-duration-fast) var(--aimd-ease-in-out),
    box-shadow var(--aimd-duration-fast) var(--aimd-ease-in-out);
}

.comment-prompt-picker__close:focus-visible {
  outline: 2px solid var(--aimd-focus-ring);
  outline-offset: 2px;
}

.comment-prompt-picker__close .aimd-icon,
.comment-prompt-picker__close .aimd-icon svg {
  width: var(--aimd-size-control-glyph-panel);
  height: var(--aimd-size-control-glyph-panel);
}
${getSurfaceMaterialCss()}
${getFlatWorkflowCss()}
.flat-workflow .comment-prompt-picker__list { margin: 0 var(--aimd-space-4) var(--aimd-space-4); gap: 0; }
.flat-workflow .comment-prompt-picker__item:hover { background: var(--aimd-interactive-hover); }
`;
}

function getPromptPreview(content: string): string {
    return content.replace('{{cursor}}', '').replace(/\s+/g, ' ').trim();
}

export class CommentPromptPickerPopover {
    private rootEl: HTMLElement | null = null;
    private restoreContainerPosition: (() => void) | null = null;
    private onShadowPointerDown: ((event: Event) => void) | null = null;
    private onDocumentPointerDown: ((event: Event) => void) | null = null;

    isOpen(): boolean {
        return Boolean(this.rootEl);
    }

    close(shadow: ShadowRoot, onClose?: () => void): void {
        if (!this.rootEl) return;
        if (this.onShadowPointerDown) {
            shadow.removeEventListener('pointerdown', this.onShadowPointerDown, true);
            this.onShadowPointerDown = null;
        }
        if (this.onDocumentPointerDown) {
            document.removeEventListener('pointerdown', this.onDocumentPointerDown, true);
            this.onDocumentPointerDown = null;
        }
        this.restoreContainerPosition?.();
        this.restoreContainerPosition = null;
        this.rootEl.remove();
        this.rootEl = null;
        onClose?.();
    }

    open(params: OpenParams): void {
        this.close(params.shadow);
        ensureStyle(params.shadow, getCss(), { id: 'aimd-comment-prompt-picker-style', cache: 'shared' });

        const layer = markTransientRoot(document.createElement('div'));
        layer.className = 'comment-prompt-picker-layer';
        layer.dataset.placement = params.placement === 'center' ? 'center' : 'anchor';
        const popover = document.createElement('div');
        popover.className = 'comment-prompt-picker aimd-material-surface flat-workflow';
        popover.setAttribute('data-aimd-theme', params.theme);
        popover.innerHTML = `
          <div class="comment-prompt-picker__head aimd-material-chrome">
            <h3 class="comment-prompt-picker__title">${params.labels.title}</h3>
            <button class="icon-btn comment-prompt-picker__close aimd-material-button aimd-material-button--quiet" type="button" data-action="close" aria-label="${params.labels.close}">${createIcon(xIcon).outerHTML}</button>
          </div>
        `;

        const list = document.createElement('div');
        list.className = 'comment-prompt-picker__list flat-workflow__list';
        if (params.prompts.length < 1) {
            const empty = document.createElement('p');
            empty.className = 'comment-prompt-picker__empty flat-workflow__description';
            empty.textContent = params.labels.empty;
            list.appendChild(empty);
        } else {
            for (const prompt of params.prompts) {
                const button = document.createElement('button');
                button.type = 'button';
                button.className = 'comment-prompt-picker__item flat-workflow__item';
                button.dataset.promptId = prompt.id;
                button.setAttribute('aria-label', prompt.title);
                const title = document.createElement('span');
                title.className = 'comment-prompt-picker__item-title';
                title.textContent = prompt.title;
                const content = document.createElement('span');
                content.className = 'comment-prompt-picker__item-content';
                content.textContent = getPromptPreview(prompt.content);
                button.append(title, content);
                button.addEventListener('click', () => {
                    params.onSelect(prompt.id);
                    this.close(params.shadow, params.onClose);
                });
                list.appendChild(button);
            }
        }

        popover.appendChild(list);
        layer.appendChild(popover);
        params.container.appendChild(layer);
        this.rootEl = layer;
        this.positionPopover(popover, layer, params);

        popover.querySelector<HTMLButtonElement>('[data-action="close"]')?.addEventListener('click', () => {
            this.close(params.shadow, params.onClose);
        });

        this.onShadowPointerDown = (event: Event) => {
            if (this.shouldIgnorePointerDown(event)) return;
            this.close(params.shadow, params.onClose);
        };
        this.onDocumentPointerDown = (event: Event) => {
            if (this.shouldIgnorePointerDown(event)) return;
            this.close(params.shadow, params.onClose);
        };
        params.shadow.addEventListener('pointerdown', this.onShadowPointerDown, true);
        document.addEventListener('pointerdown', this.onDocumentPointerDown, true);
    }

    private shouldIgnorePointerDown(event: Event): boolean {
        const path = (event.composedPath?.() ?? []) as EventTarget[];
        return path.includes(this.rootEl as EventTarget);
    }

    private positionPopover(popover: HTMLElement, layer: HTMLElement, params: Pick<OpenParams, 'anchorEl' | 'placement'>): void {
        if (params.placement === 'center') {
            this.positionPopoverCentered(popover);
            return;
        }
        this.positionPopoverAnchored(popover, layer, params.anchorEl);
    }

    private positionPopoverCentered(popover: HTMLElement): void {
        const popoverRect = popover.getBoundingClientRect();
        const margin = 12;
        const viewportWidth = window.innerWidth || document.documentElement.clientWidth || 1024;
        const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 768;
        const left = Math.max(margin, (viewportWidth - popoverRect.width) / 2);
        const top = Math.max(margin, (viewportHeight - popoverRect.height) / 2);
        popover.style.left = `${left}px`;
        popover.style.top = `${top}px`;
    }

    private positionPopoverAnchored(popover: HTMLElement, layer: HTMLElement, anchorEl: HTMLElement): void {
        const referenceRect = layer.parentElement?.getBoundingClientRect() ?? layer.getBoundingClientRect();
        const anchorRect = anchorEl.getBoundingClientRect();
        const popoverRect = popover.getBoundingClientRect();
        const offset = 8;
        const margin = 12;
        const layerWidth = referenceRect.width || layer.clientWidth || 1024;
        const layerHeight = referenceRect.height || layer.clientHeight || 768;
        const anchorCenterX = anchorRect.left - referenceRect.left + (anchorRect.width / 2);
        const anchorBottom = anchorRect.bottom - referenceRect.top;
        const anchorTop = anchorRect.top - referenceRect.top;
        const maxLeft = Math.max(margin, layerWidth - popoverRect.width - margin);
        const rawLeft = anchorCenterX - (popoverRect.width / 2);
        const left = Math.min(maxLeft, Math.max(margin, rawLeft));
        let top = anchorBottom + offset;
        if (top + popoverRect.height > layerHeight - margin) {
            top = anchorTop - popoverRect.height - offset;
        }
        popover.style.left = `${left}px`;
        popover.style.top = `${Math.max(margin, top)}px`;
    }
}
