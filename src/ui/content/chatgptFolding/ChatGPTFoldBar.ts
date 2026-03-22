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
    private barEl: HTMLDivElement;
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

        this.barEl = document.createElement('div');
        this.barEl.className = 'bar';
        this.barEl.setAttribute('role', 'button');
        this.barEl.tabIndex = 0;
        this.barEl.addEventListener('click', () => this.callbacks.onToggle());
        this.barEl.addEventListener('keydown', (e) => {
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

        this.barEl.appendChild(this.buttonEl);
        this.barEl.appendChild(this.labelEl);
        this.shadowRoot.appendChild(this.barEl);

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
        this.barEl.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
        this.buttonEl.replaceChildren(createIcon(collapsed ? chevronRightIcon : chevronDownIcon));

        const label = collapsed ? t('btnExpand') : t('btnCollapse');
        this.buttonEl.dataset.tooltip = label;
        this.buttonEl.setAttribute('aria-label', label);
        this.tooltipDelegate.refresh(this.shadowRoot);
    }

    private getCss(): string {
        return `
:host {
  --_foldbar-min-height: calc(var(--aimd-size-control-icon-toolbar) + var(--aimd-space-2));
  --_foldbar-padding-block: var(--aimd-space-2);
  --_foldbar-padding-inline: var(--aimd-space-3);
  --_foldbar-radius: var(--aimd-radius-xl);
  --_foldbar-surface: color-mix(in srgb, var(--aimd-bg-surface) 95%, var(--aimd-bg-primary));
  display: block;
  width: 100%;
  font-family: var(--aimd-font-family-sans);
}
.bar {
  display: flex;
  align-items: center;
  gap: var(--aimd-space-3);
  width: 100%;
  min-height: var(--_foldbar-min-height);
  box-sizing: border-box;
  padding: var(--_foldbar-padding-block) var(--_foldbar-padding-inline);
  border: 1px solid color-mix(in srgb, var(--aimd-border-strong) 72%, var(--aimd-interactive-primary));
  border-radius: var(--_foldbar-radius);
  background: var(--_foldbar-surface);
  color: var(--aimd-text-primary);
  cursor: pointer;
  user-select: none;
  transition: background var(--aimd-duration-fast) var(--aimd-ease-in-out),
              border-color var(--aimd-duration-fast) var(--aimd-ease-in-out);
}
.bar:hover {
  background: color-mix(in srgb, var(--_foldbar-surface) 84%, var(--aimd-interactive-hover));
  border-color: color-mix(in srgb, var(--aimd-border-strong) 70%, var(--aimd-interactive-primary));
}
.bar:active {
  background: color-mix(in srgb, var(--_foldbar-surface) 80%, var(--aimd-interactive-active));
}
.toggle {
  all: unset;
  cursor: pointer;
  width: var(--aimd-size-control-icon-toolbar);
  height: var(--aimd-size-control-icon-toolbar);
  min-width: var(--aimd-size-control-icon-toolbar);
  max-width: var(--aimd-size-control-icon-toolbar);
  border-radius: var(--aimd-radius-lg);
  display: grid;
  place-items: center;
  background: transparent;
  color: var(--aimd-text-secondary);
  transition: background var(--aimd-duration-fast) var(--aimd-ease-in-out),
              color var(--aimd-duration-fast) var(--aimd-ease-in-out);
}
.toggle:hover {
  background: color-mix(in srgb, var(--aimd-button-icon-hover) 90%, var(--aimd-sys-color-surface-hover));
  color: var(--aimd-text-primary);
}
.toggle:focus-visible {
  outline: 2px solid color-mix(in srgb, var(--aimd-interactive-primary) 72%, transparent);
  outline-offset: 2px;
}
.toggle svg {
  width: var(--aimd-size-control-glyph-panel);
  height: var(--aimd-size-control-glyph-panel);
  display: block;
}
.label {
  flex: 1 1 auto;
  min-width: 0;
  font-size: var(--aimd-text-xs);
  font-weight: var(--aimd-font-medium);
  line-height: 1.3;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  color: var(--aimd-text-primary);
}

@supports not (background: color-mix(in srgb, white 10%, transparent)) {
  .bar {
    background: var(--aimd-bg-primary);
    border-color: var(--aimd-border-default);
  }
  .bar:hover {
    background: var(--aimd-bg-secondary);
    border-color: var(--aimd-border-default);
  }
}
`;
    }
}
