import { DesignTokens } from '../../utils/design-tokens';
import { ThemeManager } from '../../utils/ThemeManager';
import { Icons } from '../../assets/icons';
import { i18n } from '../../utils/i18n';

export interface ChatGPTFoldBarCallbacks {
    onToggle: () => void;
}

export class ChatGPTFoldBar {
    private readonly rootEl: HTMLElement;
    private readonly shadowRoot: ShadowRoot;
    private readonly callbacks: ChatGPTFoldBarCallbacks;

    private tokenStyleEl: HTMLStyleElement;
    private labelEl: HTMLDivElement;
    private buttonEl: HTMLButtonElement;
    private unsubscribeTheme: (() => void) | null = null;

    constructor(callbacks: ChatGPTFoldBarCallbacks) {
        this.callbacks = callbacks;

        this.rootEl = document.createElement('div');
        this.rootEl.className = 'aimd-chatgpt-foldbar';

        this.shadowRoot = this.rootEl.attachShadow({ mode: 'open' });

        this.tokenStyleEl = document.createElement('style');
        this.shadowRoot.appendChild(this.tokenStyleEl);

        const styleEl = document.createElement('style');
        styleEl.textContent = `
            :host {
                display: block;
                width: 100%;
            }

            .bar {
                display: flex;
                align-items: center;
                gap: var(--aimd-space-2);
                width: 100%;
                box-sizing: border-box;
                padding: var(--aimd-space-1) var(--aimd-space-3);
                border: 1px solid var(--aimd-border-subtle);
                border-radius: var(--aimd-radius-lg);
                background: var(--aimd-bg-hint);
                color: var(--aimd-text-primary);
                cursor: pointer;
                user-select: none;
                transition: background 160ms ease, border-color 160ms ease, box-shadow 160ms ease;
            }

            .bar:hover {
                background: var(--aimd-interactive-hover);
                border-color: var(--aimd-border-default);
                box-shadow: 0 0 0 1px var(--aimd-border-subtle);
            }

            .bar:active {
                background: var(--aimd-interactive-active);
            }

            .toggle {
                display: inline-flex;
                align-items: center;
                justify-content: center;
                width: calc(var(--aimd-space-6) + var(--aimd-space-1));
                height: calc(var(--aimd-space-6) + var(--aimd-space-1));
                border-radius: var(--aimd-radius-md);
                border: none;
                background: transparent;
                color: var(--aimd-text-primary);
                cursor: pointer;
                padding: 0;
                flex: 0 0 auto;
                transition: background 0.2s ease, border-color 0.2s ease;
            }

            .toggle:hover {
                background: var(--aimd-interactive-hover);
            }

            .toggle:focus-visible {
                outline: none;
                box-shadow: 0 0 0 2px var(--aimd-bg-primary), 0 0 0 4px var(--aimd-interactive-primary);
            }

            .label {
                flex: 1 1 auto;
                min-width: 0;
                font-family: var(--aimd-font-sans);
                font-size: var(--aimd-text-sm);
                font-weight: var(--aimd-font-medium);
                line-height: var(--leading-normal);
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
                color: var(--aimd-text-secondary);
            }
        `;
        this.shadowRoot.appendChild(styleEl);

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

        this.setTheme(ThemeManager.getInstance().isDarkMode());
        this.unsubscribeTheme = ThemeManager.getInstance().subscribe((theme) => {
            this.setTheme(theme === 'dark');
        });

        this.setCollapsed(true);
    }

    getElement(): HTMLElement {
        return this.rootEl;
    }

    dispose(): void {
        this.unsubscribeTheme?.();
        this.unsubscribeTheme = null;
        this.rootEl.remove();
    }

    setTitle(title: string): void {
        this.labelEl.textContent = title;
    }

    setCollapsed(collapsed: boolean): void {
        this.rootEl.dataset.collapsed = collapsed ? '1' : '0';
        // Why: apply spacing directly on the host element to avoid any shadow-host selector edge cases.
        this.rootEl.style.marginBottom = collapsed ? 'var(--aimd-space-2)' : '0';
        this.buttonEl.innerHTML = collapsed ? Icons.chevronRight : Icons.chevronDown;

        const label = collapsed ? i18n.t('btnExpand') : i18n.t('btnCollapse');
        this.buttonEl.title = label;
        this.buttonEl.setAttribute('aria-label', label);
    }

    private setTheme(isDark: boolean): void {
        this.tokenStyleEl.textContent = `:host { ${DesignTokens.getCompleteTokens(isDark)} }`;
        this.rootEl.dataset.theme = isDark ? 'dark' : 'light';
    }
}
