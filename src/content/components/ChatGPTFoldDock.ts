import { DesignTokens } from '../../utils/design-tokens';
import { ThemeManager } from '../../utils/ThemeManager';
import { i18n } from '../../utils/i18n';

export interface ChatGPTFoldDockCallbacks {
    onCollapseAll: () => void;
    onExpandAll: () => void;
}

const DOCK_ID = 'aimd-chatgpt-fold-dock';

export class ChatGPTFoldDock {
    private readonly rootEl: HTMLElement;
    private readonly shadowRoot: ShadowRoot;
    private readonly callbacks: ChatGPTFoldDockCallbacks;

    private tokenStyleEl: HTMLStyleElement;
    private unsubscribeTheme: (() => void) | null = null;

    constructor(callbacks: ChatGPTFoldDockCallbacks) {
        this.callbacks = callbacks;

        const existing = document.getElementById(DOCK_ID);
        if (existing instanceof HTMLElement) {
            existing.remove();
        }

        this.rootEl = document.createElement('div');
        this.rootEl.id = DOCK_ID;
        this.rootEl.className = 'aimd-chatgpt-fold-dock';

        this.shadowRoot = this.rootEl.attachShadow({ mode: 'open' });
        this.tokenStyleEl = document.createElement('style');
        this.shadowRoot.appendChild(this.tokenStyleEl);

        const styleEl = document.createElement('style');
        styleEl.textContent = `
            :host {
                position: fixed;
                top: 50%;
                right: var(--aimd-space-2);
                transform: translateY(-50%);
                z-index: var(--aimd-z-panel);
                pointer-events: auto;
            }

            .dock {
                display: flex;
                flex-direction: column;
                justify-content: center;
                align-items: stretch;
                gap: 0;
                padding: 0;
                width: calc(var(--aimd-space-3));
                min-height: calc(var(--aimd-space-16));
                border: 1px solid var(--aimd-border-default);
                border-radius: var(--aimd-radius-xl);
                background: var(--aimd-bg-glass);
                box-shadow: var(--aimd-shadow-md);
                backdrop-filter: var(--aimd-glass-blur);
                -webkit-backdrop-filter: var(--aimd-glass-blur);
                overflow: hidden;
            }

            .btn {
                border: none;
                background: transparent;
                color: var(--aimd-text-primary);
                display: grid;
                place-items: center;
                width: 100%;
                flex: 1;
                min-height: calc(var(--aimd-space-6));
                border-radius: 0;
                cursor: pointer;
                transition: background 160ms ease;
                font-family: var(--aimd-font-mono);
                font-size: var(--aimd-text-lg);
                font-weight: var(--aimd-font-bold);
                line-height: 1;
                padding: 0;
            }

            .btn:first-child {
                border-top-left-radius: var(--aimd-radius-lg);
                border-top-right-radius: var(--aimd-radius-lg);
            }

            .btn:last-child {
                border-bottom-left-radius: var(--aimd-radius-lg);
                border-bottom-right-radius: var(--aimd-radius-lg);
            }

            .btn + .btn {
                border-top: 1px solid var(--aimd-border-subtle);
            }

            .btn:hover {
                background: var(--aimd-interactive-hover);
            }

            .btn:active {
                background: var(--aimd-interactive-active);
            }

            .btn:focus-visible {
                outline: none;
                box-shadow: inset 0 0 0 2px var(--aimd-border-focus);
            }
        `;
        this.shadowRoot.appendChild(styleEl);

        const dockEl = document.createElement('div');
        dockEl.className = 'dock';

        const collapseBtn = document.createElement('button');
        collapseBtn.className = 'btn';
        collapseBtn.type = 'button';
        collapseBtn.textContent = '-';
        collapseBtn.setAttribute('aria-label', i18n.t('chatgptCollapseAll'));
        collapseBtn.title = i18n.t('chatgptCollapseAll');
        collapseBtn.addEventListener('click', () => this.callbacks.onCollapseAll());

        const expandBtn = document.createElement('button');
        expandBtn.className = 'btn';
        expandBtn.type = 'button';
        expandBtn.textContent = '+';
        expandBtn.setAttribute('aria-label', i18n.t('chatgptExpandAll'));
        expandBtn.title = i18n.t('chatgptExpandAll');
        expandBtn.addEventListener('click', () => this.callbacks.onExpandAll());

        dockEl.appendChild(collapseBtn);
        dockEl.appendChild(expandBtn);
        this.shadowRoot.appendChild(dockEl);

        this.setTheme(ThemeManager.getInstance().isDarkMode());
        this.unsubscribeTheme = ThemeManager.getInstance().subscribe((theme) => {
            this.setTheme(theme === 'dark');
        });
    }

    getElement(): HTMLElement {
        return this.rootEl;
    }

    dispose(): void {
        this.unsubscribeTheme?.();
        this.unsubscribeTheme = null;
        this.rootEl.remove();
    }

    private setTheme(isDark: boolean): void {
        this.tokenStyleEl.textContent = `:host { ${DesignTokens.getCompleteTokens(isDark)} }`;
        this.rootEl.dataset.theme = isDark ? 'dark' : 'light';
    }
}
