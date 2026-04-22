import type { Theme } from '../../../core/types/theme';
import { getTokenCss } from '../../../style/tokens';
import { TooltipDelegate } from '../../../utils/tooltip';
import type { ChatGPTConversationRound } from '../../../drivers/content/chatgpt/types';

const RAIL_ID = 'aimd-chatgpt-directory-rail';

export class ChatGPTDirectoryRail {
    private rootEl: HTMLElement;
    private shadowRoot: ShadowRoot;
    private styleEl: HTMLStyleElement;
    private tooltipDelegate: TooltipDelegate;
    private listEl: HTMLDivElement;
    private rounds: ChatGPTConversationRound[] = [];
    private activePosition = 0;
    private onSelect: (round: ChatGPTConversationRound) => void;

    constructor(theme: Theme, onSelect: (round: ChatGPTConversationRound) => void) {
        this.onSelect = onSelect;

        const existing = document.getElementById(RAIL_ID);
        if (existing instanceof HTMLElement) existing.remove();

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
        shell.appendChild(this.listEl);
        this.shadowRoot.appendChild(shell);

        this.tooltipDelegate = new TooltipDelegate(this.shadowRoot);
    }

    getElement(): HTMLElement {
        return this.rootEl;
    }

    dispose(): void {
        this.tooltipDelegate.disconnect();
        this.rootEl.remove();
    }

    setTheme(theme: Theme): void {
        this.rootEl.setAttribute('data-aimd-theme', theme);
        this.styleEl.textContent = getTokenCss(theme) + this.getCss();
    }

    setVisible(visible: boolean): void {
        this.rootEl.style.display = visible ? 'block' : 'none';
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
            button.dataset.tooltipVariant = 'preview';
            button.dataset.tooltipTitle = String(round.position);
            button.dataset.tooltip = round.assistantContent
                ? `${round.userPrompt}\n\n${round.preview || round.assistantContent}`
                : round.userPrompt;
            button.addEventListener('click', () => this.onSelect(round));
            this.listEl.appendChild(button);
        }

        this.tooltipDelegate.refresh(this.shadowRoot);
    }

    private renderActiveState(): void {
        for (const item of Array.from(this.listEl.querySelectorAll<HTMLElement>('.rail__item'))) {
            item.dataset.active = Number(item.dataset.position) === this.activePosition ? '1' : '0';
        }
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
  width: var(--aimd-space-3);
}
.rail {
  display: flex;
  align-items: center;
  justify-content: center;
}
.rail__list {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--aimd-space-1);
  width: 100%;
  padding: var(--aimd-space-1) 0;
  border-radius: calc(var(--aimd-radius-lg) * 2);
  border: 1px solid color-mix(in srgb, var(--aimd-border-strong) 72%, transparent);
  background: color-mix(in srgb, var(--aimd-bg-surface) 96%, var(--aimd-bg-primary));
  max-height: min(78vh, 920px);
  overflow: hidden auto;
}
.rail__item {
  all: unset;
  cursor: pointer;
  display: block;
  width: calc(100% - var(--aimd-space-1));
  height: 2px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--aimd-border-default) 78%, transparent);
  transition: background var(--aimd-duration-fast) var(--aimd-ease-in-out),
              transform var(--aimd-duration-fast) var(--aimd-ease-in-out);
}
.rail__item:hover {
  background: color-mix(in srgb, var(--aimd-interactive-primary) 42%, var(--aimd-border-default));
  transform: scaleX(1.08);
}
.rail__item[data-active="1"] {
  background: var(--aimd-interactive-primary);
  transform: scaleX(1.12);
}
.rail__item:focus-visible {
  outline: 2px solid color-mix(in srgb, var(--aimd-interactive-primary) 78%, transparent);
  outline-offset: 2px;
}

@supports not (background: color-mix(in srgb, white 10%, transparent)) {
  .rail__list {
    background: var(--aimd-bg-primary);
  }
  .rail__item {
    background: var(--aimd-border-default);
  }
  .rail__item[data-active="1"] {
    background: var(--aimd-interactive-primary);
  }
}
`;
    }
}
