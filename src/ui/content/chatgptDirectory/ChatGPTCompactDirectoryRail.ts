import type { Theme } from '../../../core/types/theme';
import { getTokenCss, type UserThemeOverrides } from '../../../style/tokens';
import type { ChatGPTConversationRound } from '../../../drivers/content/chatgpt/types';

const RAIL_ID = 'aimd-chatgpt-compact-directory-rail';
const POPOVER_ID = 'aimd-chatgpt-compact-directory-popover';
const POPOVER_STYLE_ID = 'aimd-chatgpt-compact-directory-popover-style';
const POPOVER_CLOSE_DELAY_MS = 160;

function getPortalTokenCss(selector: string, overrides: UserThemeOverrides = {}): string {
    const light = getTokenCss('light', overrides).replace(/:host/g, `${selector}[data-aimd-theme="light"]`);
    const dark = getTokenCss('dark', overrides).replace(/:host/g, `${selector}[data-aimd-theme="dark"]`);
    return `${light}\n${dark}`;
}

function normalizeTitle(value: string | null | undefined, position: number): string {
    const text = (value ?? '').replace(/\s+/g, ' ').trim();
    return text || `Message ${position}`;
}

export class ChatGPTCompactDirectoryRail {
    private rootEl: HTMLElement;
    private shadowRoot: ShadowRoot;
    private styleEl: HTMLStyleElement;
    private listEl: HTMLDivElement;
    private popoverEl: HTMLDivElement;
    private rounds: ChatGPTConversationRound[] = [];
    private roundsSignature = '';
    private activePosition = 0;
    private closeTimer: number | null = null;
    private onSelect: (round: ChatGPTConversationRound) => void;
    private theme: Theme;
    private themeOverrides: UserThemeOverrides;

    constructor(theme: Theme, onSelect: (round: ChatGPTConversationRound) => void, themeOverrides: UserThemeOverrides = {}) {
        this.onSelect = onSelect;
        this.theme = theme;
        this.themeOverrides = themeOverrides;

        document.getElementById(RAIL_ID)?.remove();
        document.getElementById(POPOVER_ID)?.remove();

        this.rootEl = document.createElement('div');
        this.rootEl.id = RAIL_ID;
        this.rootEl.className = 'aimd-chatgpt-compact-directory-rail';
        this.rootEl.setAttribute('data-aimd-theme', theme);
        this.rootEl.dataset.open = '0';
        this.shadowRoot = this.rootEl.attachShadow({ mode: 'open' });

        this.styleEl = document.createElement('style');
        this.styleEl.textContent = getTokenCss(theme, this.themeOverrides) + this.getCss();
        this.shadowRoot.appendChild(this.styleEl);

        this.listEl = document.createElement('div');
        this.listEl.className = 'compact-rail';
        this.listEl.setAttribute('role', 'navigation');
        this.listEl.setAttribute('aria-label', 'ChatGPT message navigation');
        this.listEl.addEventListener('pointerenter', () => this.openPopover());
        this.listEl.addEventListener('pointerleave', () => this.scheduleClosePopover());
        this.listEl.addEventListener('pointerdown', () => this.openPopover());
        this.listEl.addEventListener('focusin', () => this.openPopover());
        this.listEl.addEventListener('focusout', () => this.scheduleClosePopover());
        this.shadowRoot.appendChild(this.listEl);

        this.popoverEl = document.createElement('div');
        this.popoverEl.id = POPOVER_ID;
        this.popoverEl.className = 'aimd-chatgpt-compact-directory-popover';
        this.popoverEl.setAttribute('data-aimd-theme', theme);
        this.popoverEl.dataset.open = '0';
        this.popoverEl.addEventListener('pointerenter', () => this.openPopover());
        this.popoverEl.addEventListener('pointerleave', () => this.scheduleClosePopover());
        this.popoverEl.addEventListener('focusin', () => this.openPopover());
        this.popoverEl.addEventListener('focusout', () => this.scheduleClosePopover());
        this.ensurePopoverStyle();
        document.body.appendChild(this.popoverEl);
    }

    getElement(): HTMLElement {
        return this.rootEl;
    }

    dispose(): void {
        if (this.closeTimer !== null) {
            window.clearTimeout(this.closeTimer);
            this.closeTimer = null;
        }
        this.rootEl.remove();
        this.popoverEl.remove();
    }

    setTheme(theme: Theme): void {
        this.theme = theme;
        this.rootEl.setAttribute('data-aimd-theme', theme);
        this.popoverEl.setAttribute('data-aimd-theme', theme);
        this.styleEl.textContent = getTokenCss(theme, this.themeOverrides) + this.getCss();
    }

    setThemeOverrides(overrides: UserThemeOverrides): void {
        this.themeOverrides = { ...overrides };
        this.styleEl.textContent = getTokenCss(this.theme, this.themeOverrides) + this.getCss();
        this.ensurePopoverStyle({ force: true });
    }

    setVisible(visible: boolean): void {
        this.rootEl.style.display = visible ? 'block' : 'none';
        if (!visible) this.closePopover();
    }

    setRounds(rounds: ChatGPTConversationRound[]): void {
        const next = rounds.length >= 1 && rounds.length <= 4 ? rounds.slice() : [];
        const signature = next
            .map((round) => `${round.position}:${round.id ?? ''}:${round.messageId ?? ''}:${round.userPrompt ?? ''}`)
            .join('|');
        if (signature === this.roundsSignature) return;
        this.roundsSignature = signature;
        this.rounds = next;
        this.render();
    }

    setActivePosition(position: number): void {
        if (this.activePosition === position) return;
        this.activePosition = position;
        this.renderActiveState();
    }

    private render(): void {
        this.listEl.replaceChildren();
        for (const round of this.rounds) {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'compact-rail__item';
            button.dataset.position = String(round.position);
            button.dataset.active = round.position === this.activePosition ? '1' : '0';
            button.setAttribute('aria-label', normalizeTitle(round.userPrompt, round.position));
            button.addEventListener('click', () => this.onSelect(round));
            const marker = document.createElement('span');
            marker.className = 'compact-rail__marker';
            button.appendChild(marker);
            this.listEl.appendChild(button);
        }
        this.rootEl.dataset.empty = this.rounds.length === 0 ? '1' : '0';
        this.renderPopover();
    }

    private renderActiveState(): void {
        this.listEl.querySelectorAll<HTMLElement>('.compact-rail__item').forEach((item) => {
            item.dataset.active = Number(item.dataset.position) === this.activePosition ? '1' : '0';
        });
        this.popoverEl.querySelectorAll<HTMLElement>('.compact-popover__item').forEach((item) => {
            item.dataset.active = Number(item.dataset.position) === this.activePosition ? '1' : '0';
        });
    }

    private renderPopover(): void {
        this.popoverEl.replaceChildren();
        const list = document.createElement('div');
        list.className = 'compact-popover__list';
        for (const round of this.rounds) {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'compact-popover__item';
            button.dataset.position = String(round.position);
            button.dataset.active = round.position === this.activePosition ? '1' : '0';
            button.textContent = normalizeTitle(round.userPrompt, round.position);
            button.addEventListener('click', () => {
                this.onSelect(round);
                this.closePopover();
            });
            list.appendChild(button);
        }
        this.popoverEl.appendChild(list);
    }

    private openPopover(): void {
        if (this.rounds.length === 0) return;
        this.cancelScheduledClose();
        this.ensurePopoverStyle();
        if (!this.popoverEl.isConnected) document.body.appendChild(this.popoverEl);
        this.rootEl.dataset.open = '1';
        this.popoverEl.dataset.open = '1';
    }

    private scheduleClosePopover(): void {
        this.cancelScheduledClose();
        this.closeTimer = window.setTimeout(() => {
            this.closeTimer = null;
            this.closePopover();
        }, POPOVER_CLOSE_DELAY_MS);
    }

    private cancelScheduledClose(): void {
        if (this.closeTimer === null) return;
        window.clearTimeout(this.closeTimer);
        this.closeTimer = null;
    }

    private closePopover(): void {
        this.cancelScheduledClose();
        this.rootEl.dataset.open = '0';
        this.popoverEl.dataset.open = '0';
    }

    private ensurePopoverStyle(options: { force?: boolean } = {}): void {
        let style = document.getElementById(POPOVER_STYLE_ID) as HTMLStyleElement | null;
        if (!style) {
            style = document.createElement('style');
            style.id = POPOVER_STYLE_ID;
            document.head.appendChild(style);
        }
        if (!options.force && style.textContent) return;
        style.textContent = this.getPopoverCss();
    }

    private getPopoverCss(): string {
        return `${getPortalTokenCss('.aimd-chatgpt-compact-directory-popover', this.themeOverrides)}
.aimd-chatgpt-compact-directory-popover {
  --_compact-directory-popover-width: 320px;
  position: fixed;
  right: var(--aimd-space-5);
  top: 50%;
  width: min(var(--_compact-directory-popover-width), calc(100vw - (var(--aimd-space-3) * 2)));
  max-height: min(34vh, var(--aimd-panel-source-max-height));
  padding: var(--aimd-space-2);
  border-radius: var(--aimd-radius-lg);
  border: 1px solid color-mix(in srgb, var(--aimd-border-subtle) 72%, transparent);
  background: color-mix(in srgb, var(--aimd-bg-surface) 95%, transparent);
  color: var(--aimd-text-primary);
  box-shadow: var(--aimd-shadow-lg);
  opacity: 0;
  pointer-events: none;
  transform: translateY(-50%);
  z-index: var(--aimd-z-tooltip);
  font-family: var(--aimd-font-family-sans);
  box-sizing: border-box;
}
.aimd-chatgpt-compact-directory-popover[data-open="1"] {
  opacity: 1;
  pointer-events: auto;
}
.compact-popover__list {
  display: flex;
  flex-direction: column;
  gap: var(--aimd-space-1);
  max-height: calc(min(34vh, var(--aimd-panel-source-max-height)) - (var(--aimd-space-2) * 2));
  overflow-y: auto;
  scrollbar-gutter: stable;
}
.compact-popover__item {
  all: unset;
  box-sizing: border-box;
  cursor: pointer;
  display: block;
  min-width: 0;
  padding: var(--aimd-space-1) var(--aimd-space-3);
  border-radius: var(--aimd-radius-md);
  color: var(--aimd-text-primary);
  font-size: var(--aimd-text-sm);
  line-height: var(--aimd-leading-normal);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.compact-popover__item:hover,
.compact-popover__item:focus-visible,
.compact-popover__item[data-active="1"] {
  background: var(--aimd-interactive-selected);
}
.compact-popover__item:focus-visible {
  outline: 2px solid color-mix(in srgb, var(--aimd-interactive-primary) 78%, transparent);
  outline-offset: 2px;
}
@supports not (background: color-mix(in srgb, white 10%, transparent)) {
  .aimd-chatgpt-compact-directory-popover {
    background: var(--aimd-bg-surface);
    border-color: var(--aimd-border-subtle);
  }
}
`;
    }

    private getCss(): string {
        return `
:host {
  position: fixed;
  top: 50%;
  right: var(--aimd-space-5);
  transform: translateY(-50%);
  z-index: var(--aimd-z-panel);
  pointer-events: auto;
  display: block;
  font-family: var(--aimd-font-family-sans);
}
:host([data-empty="1"]) {
  display: none;
}
.compact-rail {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  justify-content: center;
  gap: var(--aimd-space-1);
  min-width: var(--aimd-size-control-icon-panel-nav);
  padding: var(--aimd-space-1) 0;
}
.compact-rail__item {
  all: unset;
  box-sizing: border-box;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  width: var(--aimd-size-control-icon-panel-nav);
  height: var(--aimd-space-2);
  color: var(--aimd-border-default);
}
.compact-rail__marker {
  display: block;
  width: var(--aimd-space-5);
  height: 3px;
  border-radius: var(--aimd-radius-full);
  background: color-mix(in srgb, currentColor 82%, transparent);
}
.compact-rail__item[data-active="1"] {
  color: var(--aimd-interactive-primary);
}
.compact-rail__item:hover,
.compact-rail__item:focus-visible {
  color: var(--aimd-interactive-primary);
}
.compact-rail__item:focus-visible {
  outline: 2px solid color-mix(in srgb, var(--aimd-interactive-primary) 78%, transparent);
  outline-offset: 2px;
  border-radius: var(--aimd-radius-sm);
}
@supports not (background: color-mix(in srgb, white 10%, transparent)) {
  .compact-rail__marker {
    background: currentColor;
  }
}
`;
    }
}
