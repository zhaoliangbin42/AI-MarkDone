import type { Theme } from '../../../core/types/theme';
import { getTokenCss } from '../../../style/tokens';
import { createIcon } from '../components/Icon';
import { chevronDownIcon, chevronRightIcon } from '../../../assets/icons';
import { t } from '../components/i18n';
import { TooltipDelegate } from '../../../utils/tooltip';

export type ChatGPTFoldBarCallbacks = {
    onToggle: () => void;
};

export class ChatGPTFoldBar {
    private rootEl: HTMLElement;
    private shadowRoot: ShadowRoot;
    private styleEl: HTMLStyleElement;
    private callbacks: ChatGPTFoldBarCallbacks;
    private labelEl: HTMLDivElement;
    private buttonEl: HTMLButtonElement;
    private tooltipDelegate: TooltipDelegate;

    constructor(theme: Theme, callbacks: ChatGPTFoldBarCallbacks) {
        this.callbacks = callbacks;

        this.rootEl = document.createElement('div');
        this.rootEl.className = 'aimd-chatgpt-foldbar';
        this.rootEl.setAttribute('data-aimd-theme', theme);
        this.shadowRoot = this.rootEl.attachShadow({ mode: 'open' });

        this.styleEl = document.createElement('style');
        this.styleEl.textContent = getTokenCss(theme) + this.getCss();
        this.shadowRoot.appendChild(this.styleEl);
        this.tooltipDelegate = new TooltipDelegate(this.shadowRoot);

        const bar = document.createElement('div');
        bar.className = 'bar';
        bar.setAttribute('role', 'button');
        bar.tabIndex = 0;
        bar.addEventListener('click', () => this.callbacks.onToggle());
        bar.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                this.callbacks.onToggle();
            }
        });

        this.buttonEl = document.createElement('button');
        this.buttonEl.className = 'toggle';
        this.buttonEl.type = 'button';
        this.buttonEl.addEventListener('click', (e) => {
            e.stopPropagation();
            this.callbacks.onToggle();
        });

        this.labelEl = document.createElement('div');
        this.labelEl.className = 'label';

        bar.appendChild(this.buttonEl);
        bar.appendChild(this.labelEl);
        this.shadowRoot.appendChild(bar);

        this.setCollapsed(true);
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

    setTitle(title: string): void {
        this.labelEl.textContent = title;
    }

    setCollapsed(collapsed: boolean): void {
        this.rootEl.dataset.collapsed = collapsed ? '1' : '0';
        this.rootEl.style.marginBottom = collapsed ? 'var(--aimd-space-2)' : '0';
        this.buttonEl.replaceChildren(createIcon(collapsed ? chevronRightIcon : chevronDownIcon));

        const label = collapsed ? t('btnExpand') : t('btnCollapse');
        this.buttonEl.dataset.tooltip = label;
        this.buttonEl.setAttribute('aria-label', label);
        this.tooltipDelegate.refresh(this.shadowRoot);
    }

    private getCss(): string {
        return `
:host {
  display: block;
  width: 100%;
  font-family: var(--aimd-font-family-sans);
}
.bar {
  display: flex;
  align-items: center;
  gap: var(--aimd-space-2);
  width: 100%;
  box-sizing: border-box;
  padding: var(--aimd-space-1) var(--aimd-space-2);
  border: 1px solid var(--aimd-border-default);
  border-radius: calc(var(--aimd-radius-lg) * 2);
  /* Simple, stable surfaces: base color comes from theme tokens. */
  background: var(--aimd-bg-secondary);
  color: var(--aimd-text-primary);
  cursor: pointer;
  user-select: none;
  transition: background 160ms ease, border-color 160ms ease;
}
.bar:hover {
  /* Light mode: gets darker; dark mode: gets lighter (mixing with text color flips direction). */
  background: color-mix(in srgb, var(--aimd-bg-secondary) 88%, var(--aimd-text-primary) 12%);
  border-color: var(--aimd-border-default);
}
.bar:active { background: color-mix(in srgb, var(--aimd-bg-secondary) 78%, var(--aimd-text-primary) 22%); }
.toggle {
  all: unset;
  cursor: pointer;
  width: calc(var(--aimd-size-icon-md) - 8px);
  height: calc(var(--aimd-size-icon-md) - 8px);
  min-width: calc(var(--aimd-size-icon-md) - 8px);
  max-width: calc(var(--aimd-size-icon-md) - 8px);
  border-radius: var(--aimd-radius-md);
  display: grid;
  place-items: center;
  color: var(--aimd-text-secondary);
  transition: background 160ms ease, color 160ms ease;
}
.toggle:hover { background: color-mix(in srgb, var(--aimd-bg-secondary) 88%, var(--aimd-text-primary) 12%); color: var(--aimd-text-secondary); }
.toggle:focus-visible { outline: 2px solid color-mix(in srgb, var(--aimd-interactive-primary) 80%, transparent); outline-offset: 2px; }
.toggle svg { width: 14px; height: 14px; display: block; }
.label {
  flex: 1 1 auto;
  min-width: 0;
  font-size: var(--aimd-font-size-sm);
  font-weight: 600;
  line-height: 1.2;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  color: var(--aimd-text-primary);
}

@supports not (background: color-mix(in srgb, white 10%, transparent)) {
  .bar {
    background: var(--aimd-bg-secondary);
  }
  .bar:hover {
    background: var(--aimd-bg-secondary);
  }
}
`;
    }
}
