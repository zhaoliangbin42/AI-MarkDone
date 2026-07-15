import { fileCodeIcon } from '../../../assets/icons';
import { ensureStyle } from '../../../style/shadow';
import { TooltipDelegate } from '../../../utils/tooltip';
import { createIcon } from './Icon';
import { subscribeLocaleChange, t } from './i18n';

const STYLE_ID = 'aimd-input-enhancement-button';
const CSS = `
:host {
  display: inline-flex;
  align-items: center;
  margin-inline-start: var(--aimd-space-1);
  font-family: var(--aimd-font-family-sans);
}
.enhancement-button {
  all: unset;
  box-sizing: border-box;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: var(--aimd-size-control-icon-panel);
  height: var(--aimd-size-control-icon-panel);
  border-radius: var(--aimd-radius-full);
  color: var(--aimd-button-icon-text);
  background: var(--aimd-button-icon-bg);
  cursor: pointer;
  transition: background var(--aimd-duration-fast) var(--aimd-ease-in-out), color var(--aimd-duration-fast) var(--aimd-ease-in-out), opacity var(--aimd-duration-fast) var(--aimd-ease-in-out);
}
.enhancement-button:hover:not(:disabled) {
  color: var(--aimd-button-icon-text-hover);
  background: var(--aimd-button-icon-hover);
}
.enhancement-button:focus-visible {
  outline: 2px solid var(--aimd-focus-ring);
  outline-offset: 2px;
}
.enhancement-button[data-active="1"] {
  color: var(--aimd-interactive-primary);
  background: var(--aimd-button-icon-active);
}
.enhancement-button:disabled {
  cursor: wait;
  opacity: 0.48;
}
.aimd-icon,
.aimd-icon svg {
  display: block;
  width: var(--aimd-size-control-glyph-panel);
  height: var(--aimd-size-control-glyph-panel);
}
@media (prefers-reduced-motion: reduce) {
  .enhancement-button { transition: none; }
}
`;

export class InputEnhancementButton {
    readonly host: HTMLElement;
    private readonly button: HTMLButtonElement;
    private readonly tooltipDelegate: TooltipDelegate;
    private readonly unsubscribeLocale: () => void;
    private enabled = false;
    private expanded = false;
    private pending = false;

    constructor(params: { onOpen: () => void | Promise<void> }) {
        this.host = document.createElement('span');
        this.host.dataset.aimdRole = 'input-enhancement-button';
        const shadow = this.host.attachShadow({ mode: 'open' });
        ensureStyle(shadow, CSS, { id: STYLE_ID, cache: 'shared' });

        this.button = document.createElement('button');
        this.button.type = 'button';
        this.button.className = 'enhancement-button';
        this.button.setAttribute('aria-haspopup', 'dialog');
        this.button.setAttribute('aria-controls', 'aimd-input-enhancement-popover');
        this.button.appendChild(createIcon(fileCodeIcon));
        this.button.addEventListener('click', (event) => {
            event.preventDefault();
            event.stopPropagation();
            if (this.pending) return;
            void params.onOpen();
        });
        shadow.appendChild(this.button);
        this.tooltipDelegate = new TooltipDelegate(shadow, { upgradeTitles: false });
        this.unsubscribeLocale = subscribeLocaleChange(() => this.refreshLabel());
        this.refreshLabel();
        this.syncState();
    }

    setEnabled(enabled: boolean): void {
        this.enabled = enabled;
        this.refreshLabel();
        this.syncState();
    }

    setExpanded(expanded: boolean): void {
        this.expanded = expanded;
        this.syncState();
    }

    setPending(pending: boolean): void {
        this.pending = pending;
        this.syncState();
    }

    focus(): void {
        this.button.focus();
    }

    getAnchorElement(): HTMLElement {
        return this.button;
    }

    dispose(): void {
        this.unsubscribeLocale();
        this.tooltipDelegate.disconnect();
        this.host.remove();
    }

    private refreshLabel(): void {
        const label = t('chatgptInputEnhancementButton');
        const state = t(this.enabled
            ? 'chatgptInputEnhancementEnabledState'
            : 'chatgptInputEnhancementDisabledState');
        this.button.setAttribute('aria-label', `${label}, ${state}`);
        this.button.dataset.tooltip = label;
        this.button.dataset.tooltipPlacement = 'top';
        this.button.removeAttribute('title');
    }

    private syncState(): void {
        this.button.dataset.active = this.enabled ? '1' : '0';
        this.button.setAttribute('aria-expanded', this.expanded ? 'true' : 'false');
        this.button.disabled = this.pending;
        if (this.pending) this.button.setAttribute('aria-busy', 'true');
        else this.button.removeAttribute('aria-busy');
    }
}
