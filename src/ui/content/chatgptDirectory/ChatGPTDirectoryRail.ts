import type { Theme } from '../../../core/types/theme';
import { getTokenCss } from '../../../style/tokens';
import type { ChatGPTConversationRound } from '../../../drivers/content/chatgpt/types';

const RAIL_ID = 'aimd-chatgpt-directory-rail';
const PREVIEW_ID = 'aimd-chatgpt-directory-preview';
const PREVIEW_STYLE_ID = 'aimd-chatgpt-directory-preview-style';
const HOVER_RADIUS = 3;

function getPreviewTokenCss(): string {
    const light = getTokenCss('light').replace(/:host/g, '.aimd-chatgpt-directory-preview[data-aimd-theme="light"]');
    const dark = getTokenCss('dark').replace(/:host/g, '.aimd-chatgpt-directory-preview[data-aimd-theme="dark"]');
    return `${light}\n${dark}`;
}

export class ChatGPTDirectoryRail {
    private rootEl: HTMLElement;
    private shadowRoot: ShadowRoot;
    private styleEl: HTMLStyleElement;
    private listEl: HTMLDivElement;
    private previewEl: HTMLDivElement;
    private rounds: ChatGPTConversationRound[] = [];
    private activePosition = 0;
    private hoverPosition: number | null = null;
    private onSelect: (round: ChatGPTConversationRound) => void;

    constructor(theme: Theme, onSelect: (round: ChatGPTConversationRound) => void) {
        this.onSelect = onSelect;

        const existing = document.getElementById(RAIL_ID);
        if (existing instanceof HTMLElement) existing.remove();
        const existingPreview = document.getElementById(PREVIEW_ID);
        if (existingPreview instanceof HTMLElement) existingPreview.remove();

        this.rootEl = document.createElement('div');
        this.rootEl.id = RAIL_ID;
        this.rootEl.className = 'aimd-chatgpt-directory-rail';
        this.rootEl.setAttribute('data-aimd-theme', theme);
        this.shadowRoot = this.rootEl.attachShadow({ mode: 'open' });

        this.styleEl = document.createElement('style');
        this.styleEl.textContent = getTokenCss(theme) + this.getCss();
        this.shadowRoot.appendChild(this.styleEl);

        const shell = document.createElement('div');
        shell.className = 'rail';
        this.listEl = document.createElement('div');
        this.listEl.className = 'rail__list';
        this.listEl.addEventListener('pointerover', (event) => {
            const item = event.target instanceof Element ? event.target.closest<HTMLElement>('.rail__item') : null;
            if (!item) return;
            this.setHoverPosition(Number(item.dataset.position));
        });
        this.listEl.addEventListener('pointerleave', () => this.setHoverPosition(null));
        this.listEl.addEventListener('focusin', (event) => {
            const item = event.target instanceof Element ? event.target.closest<HTMLElement>('.rail__item') : null;
            if (!item) return;
            this.setHoverPosition(Number(item.dataset.position));
        });
        this.listEl.addEventListener('focusout', () => this.setHoverPosition(null));
        shell.appendChild(this.listEl);
        this.shadowRoot.appendChild(shell);

        this.previewEl = document.createElement('div');
        this.previewEl.id = PREVIEW_ID;
        this.previewEl.className = 'aimd-chatgpt-directory-preview';
        this.previewEl.dataset.open = '0';
        this.previewEl.setAttribute('data-aimd-theme', theme);
        this.previewEl.innerHTML = '<div class="aimd-chatgpt-directory-preview__title"></div><div class="aimd-chatgpt-directory-preview__body"></div>';
        this.ensurePreviewStyle();
        document.body.appendChild(this.previewEl);
    }

    getElement(): HTMLElement {
        return this.rootEl;
    }

    dispose(): void {
        this.rootEl.remove();
        this.previewEl.remove();
    }

    setTheme(theme: Theme): void {
        this.rootEl.setAttribute('data-aimd-theme', theme);
        this.previewEl.setAttribute('data-aimd-theme', theme);
        this.styleEl.textContent = getTokenCss(theme) + this.getCss();
    }

    setVisible(visible: boolean): void {
        this.rootEl.style.display = visible ? 'block' : 'none';
        if (!visible) this.previewEl.dataset.open = '0';
    }

    setRounds(rounds: ChatGPTConversationRound[]): void {
        this.rounds = rounds.slice();
        this.render();
    }

    setActivePosition(position: number): void {
        this.activePosition = position;
        this.renderActiveState();
    }

    private render(): void {
        this.listEl.replaceChildren();

        for (const round of this.rounds) {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'rail__item';
            button.dataset.position = String(round.position);
            button.dataset.active = round.position === this.activePosition ? '1' : '0';
            button.setAttribute('aria-label', `#${round.position} ${round.userPrompt}`);
            button.addEventListener('click', () => this.onSelect(round));
            this.listEl.appendChild(button);
        }

        this.renderHoverState();
        this.renderPreview();
    }

    private renderActiveState(): void {
        for (const item of Array.from(this.listEl.querySelectorAll<HTMLElement>('.rail__item'))) {
            item.dataset.active = Number(item.dataset.position) === this.activePosition ? '1' : '0';
        }
    }

    private setHoverPosition(position: number | null): void {
        this.hoverPosition = Number.isFinite(position) ? position : null;
        this.renderHoverState();
        this.renderPreview();
    }

    private renderHoverState(): void {
        this.listEl.dataset.hasHover = this.hoverPosition === null ? '0' : '1';
        for (const item of Array.from(this.listEl.querySelectorAll<HTMLElement>('.rail__item'))) {
            delete item.dataset.proximity;
            if (this.hoverPosition === null) continue;
            const distance = Math.abs(Number(item.dataset.position) - this.hoverPosition);
            if (distance <= HOVER_RADIUS) item.dataset.proximity = String(distance);
        }
    }

    private renderPreview(): void {
        this.ensurePreviewAttached();
        const position = this.hoverPosition;
        const round = position == null ? null : this.rounds.find((item) => item.position === position);
        if (!round) {
            this.previewEl.dataset.open = '0';
            return;
        }
        const title = this.previewEl.querySelector<HTMLElement>('.aimd-chatgpt-directory-preview__title');
        const body = this.previewEl.querySelector<HTMLElement>('.aimd-chatgpt-directory-preview__body');
        if (title) title.textContent = `#${round.position}`;
        if (body) body.textContent = this.buildPreviewText(round);
        const item = this.listEl.querySelector<HTMLElement>(`.rail__item[data-position="${round.position}"]`);
        if (item) this.positionPreview(item);
        this.previewEl.dataset.open = '1';
    }

    private ensurePreviewAttached(): void {
        this.ensurePreviewStyle();
        if (!this.previewEl.isConnected) document.body.appendChild(this.previewEl);
    }

    private ensurePreviewStyle(): void {
        if (document.getElementById(PREVIEW_STYLE_ID)) return;
        const style = document.createElement('style');
        style.id = PREVIEW_STYLE_ID;
        style.textContent = this.getPreviewCss();
        document.head.appendChild(style);
    }

    private buildPreviewText(round: ChatGPTConversationRound): string {
        const seen = new Set<string>();
        const parts = [round.userPrompt, round.preview || round.assistantContent]
            .map((value) => value.replace(/\s+/g, ' ').trim())
            .filter((value) => {
                if (!value) return false;
                const key = value.toLocaleLowerCase();
                if (seen.has(key)) return false;
                seen.add(key);
                return true;
            });
        const text = parts.join('\n\n').trim();
        return text.length > 120 ? `${text.slice(0, 119)}…` : text;
    }

    private positionPreview(anchor: HTMLElement): void {
        const anchorRect = anchor.getBoundingClientRect();
        const previewRect = this.previewEl.getBoundingClientRect();
        const width = previewRect.width || 280;
        const height = previewRect.height || 64;
        const gap = 12;
        const viewportPadding = 12;
        const left = Math.max(viewportPadding, Math.min(window.innerWidth - width - viewportPadding, anchorRect.left - width - gap));
        const centerTop = anchorRect.top + anchorRect.height / 2 - height / 2;
        const top = Math.max(viewportPadding, Math.min(window.innerHeight - height - viewportPadding, centerTop));
        this.previewEl.style.left = `${left}px`;
        this.previewEl.style.top = `${top}px`;
    }

    private getPreviewCss(): string {
        return `${getPreviewTokenCss()}
.aimd-chatgpt-directory-preview {
  position: fixed;
  left: 0;
  top: 0;
  width: 280px;
  max-width: min(280px, calc(100vw - 32px));
  padding: var(--aimd-space-3, 12px) var(--aimd-space-3, 12px);
  border-radius: var(--aimd-radius-lg, 12px);
  background: var(--aimd-bg-surface, rgba(255, 255, 255, 0.96));
  background: color-mix(in srgb, var(--aimd-bg-surface) 92%, transparent);
  color: var(--aimd-text-primary, #111827);
  box-shadow: var(--aimd-shadow-lg, 0 22px 56px rgba(148, 163, 184, 0.24));
  border: 1px solid color-mix(in srgb, var(--aimd-border-subtle) 72%, transparent);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  pointer-events: none;
  opacity: 0;
  translate: var(--aimd-space-1, 4px) 0;
  transition: opacity 120ms var(--aimd-ease-in-out),
              translate 120ms var(--aimd-ease-out);
  z-index: var(--aimd-z-tooltip, 10000);
  font-family: var(--aimd-font-family-sans);
  box-sizing: border-box;
}
.aimd-chatgpt-directory-preview[data-open="1"] {
  opacity: 1;
  translate: 0 0;
}
.aimd-chatgpt-directory-preview__title {
  display: inline-flex;
  align-items: center;
  min-height: 22px;
  padding: 0 var(--aimd-space-2, 8px);
  border-radius: var(--aimd-radius-full, 999px);
  background: var(--aimd-interactive-selected, rgba(37, 99, 235, 0.12));
  color: var(--aimd-interactive-primary);
  font-size: var(--aimd-text-base, 16px);
  font-weight: var(--aimd-font-semibold);
  line-height: 1;
  margin-bottom: var(--aimd-space-2, 8px);
}
.aimd-chatgpt-directory-preview__body {
  color: var(--aimd-text-secondary, #374151);
  font-size: var(--aimd-font-size-sm, 14px);
  line-height: 1.45;
  white-space: normal;
}

@media (prefers-reduced-motion: reduce) {
  .aimd-chatgpt-directory-preview {
    transition: none;
  }
}
`;
    }

    private getCss(): string {
        return `
:host {
  position: fixed;
  top: 50%;
  right: var(--aimd-space-2);
  transform: translateY(-50%);
  z-index: var(--aimd-z-panel);
  pointer-events: auto;
  display: block;
  font-family: var(--aimd-font-family-sans);
  width: calc(var(--aimd-space-4) + var(--aimd-space-6));
}
.rail {
  display: flex;
  align-items: center;
  justify-content: flex-end;
}
.rail__list {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 2px;
  width: 100%;
  padding: var(--aimd-space-1) 0;
  min-height: calc(var(--aimd-space-3) * 6);
  max-height: min(78vh, 920px);
  overflow: hidden auto;
}
.rail__item {
  all: unset;
  box-sizing: border-box;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  width: 100%;
  height: 10px;
  border-radius: 999px;
  padding-inline: 0;
}
.rail__item::before {
  content: "";
  display: block;
  width: 36px;
  height: 3px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--aimd-border-default) 82%, transparent);
  transform: scaleX(0.39);
  transform-origin: right center;
  transition: transform 120ms var(--aimd-ease-out),
              height 120ms var(--aimd-ease-out),
              background var(--aimd-duration-fast) var(--aimd-ease-in-out),
              box-shadow var(--aimd-duration-fast) var(--aimd-ease-in-out);
  will-change: transform;
}
.rail__item[data-active="1"]::before {
  transform: scaleX(0.56);
  background: var(--aimd-interactive-primary);
}
.rail__item[data-proximity="0"]::before {
  transform: scaleX(1);
  height: 4px;
  background: var(--aimd-interactive-primary);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--aimd-interactive-primary) 10%, transparent);
}
.rail__item[data-proximity="1"]::before {
  transform: scaleX(0.83);
  height: 4px;
  background: color-mix(in srgb, var(--aimd-interactive-primary) 72%, var(--aimd-border-default));
}
.rail__item[data-proximity="2"]::before {
  transform: scaleX(0.64);
  background: color-mix(in srgb, var(--aimd-interactive-primary) 48%, var(--aimd-border-default));
}
.rail__item[data-proximity="3"]::before {
  transform: scaleX(0.5);
  background: color-mix(in srgb, var(--aimd-interactive-primary) 28%, var(--aimd-border-default));
}
.rail__item:focus-visible {
  outline: 2px solid color-mix(in srgb, var(--aimd-interactive-primary) 78%, transparent);
  outline-offset: 2px;
}
@media (prefers-reduced-motion: reduce) {
  .rail__item::before {
    transition: none;
  }
}

@supports not (background: color-mix(in srgb, white 10%, transparent)) {
  .rail__item::before {
    background: var(--aimd-border-default);
  }
  .rail__item[data-active="1"]::before,
  .rail__item[data-proximity="0"]::before {
    background: var(--aimd-interactive-primary);
  }
}
`;
    }
}
