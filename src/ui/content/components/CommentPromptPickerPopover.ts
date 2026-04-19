import { xIcon } from '../../../assets/icons';
import { createIcon } from './Icon';
import { ensureStyle } from '../../../style/shadow';
import { markTransientRoot } from './transientUi';
import type { Theme } from '../../../core/types/theme';

type PromptOption = {
    id: string;
    title: string;
    content: string;
};

type OpenParams = {
    shadow: ShadowRoot;
    container: HTMLElement;
    anchorEl: HTMLElement;
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
  position: fixed;
  inset: 0;
  pointer-events: none;
  z-index: var(--aimd-z-tooltip);
}

.comment-prompt-picker {
  position: absolute;
  width: min(420px, calc(100vw - (var(--aimd-space-4) * 2)));
  max-height: min(430px, calc(100vh - (var(--aimd-space-4) * 2)));
  display: flex;
  flex-direction: column;
  border-radius: var(--aimd-radius-2xl);
  border: 1px solid color-mix(in srgb, var(--aimd-border-default) 82%, transparent);
  background: color-mix(in srgb, var(--aimd-bg-surface) 98%, var(--aimd-bg-primary));
  box-shadow: var(--aimd-shadow-lg);
  pointer-events: auto;
  overflow: hidden;
}

.comment-prompt-picker__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--aimd-space-3);
  min-height: var(--aimd-panel-header-height-compact);
  padding: var(--aimd-space-3) var(--aimd-space-3) var(--aimd-space-2);
  border-bottom: 1px solid color-mix(in srgb, var(--aimd-border-default) 82%, transparent);
}

.comment-prompt-picker__title {
  margin: 0;
  font-size: var(--aimd-text-sm);
  line-height: 1.4;
  font-weight: var(--aimd-font-medium);
  color: var(--aimd-text-primary);
}

.comment-prompt-picker__list {
  display: grid;
  gap: var(--aimd-space-2);
  padding: var(--aimd-space-3);
  overflow: auto;
  overscroll-behavior: contain;
}

.comment-prompt-picker__item {
  all: unset;
  box-sizing: border-box;
  cursor: pointer;
  display: grid;
  gap: var(--aimd-space-1);
  padding: var(--aimd-space-3);
  border-radius: var(--aimd-radius-xl);
  border: 1px solid color-mix(in srgb, var(--aimd-border-default) 80%, transparent);
  background: color-mix(in srgb, var(--aimd-bg-primary) 94%, transparent);
  color: var(--aimd-text-primary);
}

.comment-prompt-picker__item:hover {
  border-color: color-mix(in srgb, var(--aimd-interactive-primary) 32%, var(--aimd-border-default));
  background: color-mix(in srgb, var(--aimd-button-secondary-hover) 90%, var(--aimd-sys-color-surface-hover));
}

.comment-prompt-picker__item-title {
  font-size: var(--aimd-text-sm);
  line-height: 1.3;
  font-weight: var(--aimd-font-medium);
}

.comment-prompt-picker__item-content {
  font-size: var(--aimd-text-xs);
  line-height: 1.45;
  color: var(--aimd-text-secondary);
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

.comment-prompt-picker__empty {
  margin: 0;
  padding: var(--aimd-space-3);
  border-radius: var(--aimd-radius-xl);
  background: color-mix(in srgb, var(--aimd-bg-primary) 94%, transparent);
  font-size: var(--aimd-text-xs);
  line-height: 1.45;
  color: var(--aimd-text-secondary);
}

.comment-prompt-picker .icon-btn {
  all: unset;
  box-sizing: border-box;
  cursor: pointer;
  width: var(--aimd-size-control-icon-panel);
  height: var(--aimd-size-control-icon-panel);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--aimd-radius-full);
  border: 1px solid transparent;
  color: var(--aimd-button-icon-text);
  background: transparent;
  flex: 0 0 auto;
  transition:
    background var(--aimd-duration-fast) var(--aimd-ease-in-out),
    color var(--aimd-duration-fast) var(--aimd-ease-in-out),
    box-shadow var(--aimd-duration-fast) var(--aimd-ease-in-out);
}

.comment-prompt-picker .icon-btn:hover {
  background: var(--aimd-button-icon-hover);
  color: var(--aimd-button-icon-text-hover);
}

.comment-prompt-picker .icon-btn:focus-visible {
  outline: 2px solid var(--aimd-focus-ring);
  outline-offset: 2px;
}

.comment-prompt-picker .icon-btn .aimd-icon,
.comment-prompt-picker .icon-btn .aimd-icon svg {
  width: var(--aimd-size-control-glyph-panel);
  height: var(--aimd-size-control-glyph-panel);
}
`;
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
        const popover = document.createElement('div');
        popover.className = 'comment-prompt-picker';
        popover.setAttribute('data-aimd-theme', params.theme);
        popover.innerHTML = `
          <div class="comment-prompt-picker__head">
            <h3 class="comment-prompt-picker__title">${params.labels.title}</h3>
            <button class="icon-btn" type="button" data-action="close" aria-label="${params.labels.close}">${createIcon(xIcon).outerHTML}</button>
          </div>
        `;

        const list = document.createElement('div');
        list.className = 'comment-prompt-picker__list';
        if (params.prompts.length < 1) {
            const empty = document.createElement('p');
            empty.className = 'comment-prompt-picker__empty';
            empty.textContent = params.labels.empty;
            list.appendChild(empty);
        } else {
            for (const prompt of params.prompts) {
                const button = document.createElement('button');
                button.type = 'button';
                button.className = 'comment-prompt-picker__item';
                button.dataset.promptId = prompt.id;
                const title = document.createElement('span');
                title.className = 'comment-prompt-picker__item-title';
                title.textContent = prompt.title;
                const content = document.createElement('span');
                content.className = 'comment-prompt-picker__item-content';
                content.textContent = prompt.content;
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
        this.positionPopover(popover, params.anchorEl, params.container);

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

    private positionPopover(popover: HTMLElement, anchorEl: HTMLElement, _container: HTMLElement): void {
        const anchorRect = anchorEl.getBoundingClientRect();
        const popoverRect = popover.getBoundingClientRect();
        const offset = 8;
        const margin = 12;
        const viewportWidth = window.innerWidth || document.documentElement.clientWidth || 1024;
        const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 768;
        const maxLeft = Math.max(margin, viewportWidth - popoverRect.width - margin);
        const rawLeft = anchorRect.left + (anchorRect.width / 2) - (popoverRect.width / 2);
        const left = Math.min(maxLeft, Math.max(margin, rawLeft));
        let top = anchorRect.bottom + offset;
        if (top + popoverRect.height > viewportHeight - margin) {
            top = anchorRect.top - popoverRect.height - offset;
        }
        popover.style.left = `${left}px`;
        popover.style.top = `${Math.max(margin, top)}px`;
    }
}
