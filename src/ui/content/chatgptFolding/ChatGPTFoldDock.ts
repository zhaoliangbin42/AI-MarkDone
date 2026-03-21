import type { Theme } from '../../../core/types/theme';
import { getTokenCss } from '../../../style/tokens';
import { t } from '../components/i18n';
import { TooltipDelegate } from '../../../utils/tooltip';

export type ChatGPTFoldDockCallbacks = {
    onCollapseAll: () => void;
    onExpandAll: () => void;
};

const DOCK_ID = 'aimd-chatgpt-fold-dock';

export class ChatGPTFoldDock {
    private rootEl: HTMLElement;
    private shadowRoot: ShadowRoot;
    private styleEl: HTMLStyleElement;
    private callbacks: ChatGPTFoldDockCallbacks;
    private tooltipDelegate: TooltipDelegate;

    constructor(theme: Theme, callbacks: ChatGPTFoldDockCallbacks) {
        this.callbacks = callbacks;

        const existing = document.getElementById(DOCK_ID);
        if (existing instanceof HTMLElement) existing.remove();

        this.rootEl = document.createElement('div');
        this.rootEl.id = DOCK_ID;
        this.rootEl.className = 'aimd-chatgpt-fold-dock';
        this.rootEl.setAttribute('data-aimd-theme', theme);

        this.shadowRoot = this.rootEl.attachShadow({ mode: 'open' });
        this.styleEl = document.createElement('style');
        this.styleEl.textContent = getTokenCss(theme) + this.getCss();
        this.shadowRoot.appendChild(this.styleEl);
        this.tooltipDelegate = new TooltipDelegate(this.shadowRoot);

        const dockEl = document.createElement('div');
        dockEl.className = 'dock';

        const collapseBtn = document.createElement('button');
        collapseBtn.className = 'btn';
        collapseBtn.type = 'button';
        // Use ASCII '-' to match legacy width expectations (unicode '−' is wider and clips in a thin dock).
        collapseBtn.textContent = '-';
        collapseBtn.setAttribute('aria-label', t('chatgptCollapseAll'));
        collapseBtn.dataset.tooltip = t('chatgptCollapseAll');
        collapseBtn.addEventListener('click', () => this.callbacks.onCollapseAll());

        const expandBtn = document.createElement('button');
        expandBtn.className = 'btn';
        expandBtn.type = 'button';
        expandBtn.textContent = '+';
        expandBtn.setAttribute('aria-label', t('chatgptExpandAll'));
        expandBtn.dataset.tooltip = t('chatgptExpandAll');
        expandBtn.addEventListener('click', () => this.callbacks.onExpandAll());

        dockEl.append(collapseBtn, expandBtn);
        this.shadowRoot.appendChild(dockEl);
        this.tooltipDelegate.refresh(this.shadowRoot);
    }

    getElement(): HTMLElement {
        return this.rootEl;
    }

    setTheme(theme: Theme): void {
        this.rootEl.setAttribute('data-aimd-theme', theme);
        this.styleEl.textContent = getTokenCss(theme) + this.getCss();
    }

    dispose(): void {
        this.tooltipDelegate.disconnect();
        this.rootEl.remove();
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
  /* Hard width cap: ensures the dock never grows horizontally. */
  width: var(--aimd-space-3);
}
.dock {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: stretch;
  overflow: hidden;
  /* Legacy parity: extremely narrow vertical pill. */
  width: 100%;
  min-height: calc(var(--aimd-space-3) * 6);
  border-radius: calc(var(--aimd-radius-lg) * 2);
  border: 1px solid var(--aimd-border-default);
  background: var(--aimd-bg-primary);
}
.btn {
  all: unset;
  cursor: pointer;
  display: grid;
  place-items: center;
  width: 100%;
  min-height: calc(var(--aimd-space-3) * 3);
  color: var(--aimd-text-primary);
  font-size: var(--aimd-font-size-xs);
  font-weight: 700;
  line-height: 1;
  transition: background 160ms ease;
}
.btn + .btn { border-top: 1px solid color-mix(in srgb, var(--aimd-border-default) 70%, transparent); }
.btn:hover { background: var(--aimd-interactive-hover); }
.btn:active { background: var(--aimd-interactive-active); }
.btn:focus-visible { outline: 2px solid color-mix(in srgb, var(--aimd-interactive-primary) 80%, transparent); outline-offset: -2px; }

@supports not (background: color-mix(in srgb, white 10%, transparent)) {
  .dock {
    background: var(--aimd-bg-primary);
  }
}
`;
    }
}
