import { i18n } from '../../utils/i18n';

type ChatGPTFoldBarOptions = {
    onToggle: () => void;
};

export class ChatGPTFoldBar {
    private readonly root: HTMLDivElement;
    private readonly button: HTMLButtonElement;
    private readonly titleEl: HTMLSpanElement;

    constructor(options: ChatGPTFoldBarOptions) {
        this.root = document.createElement('div');
        this.root.className = 'aimd-chatgpt-fold-bar';

        this.button = document.createElement('button');
        this.button.type = 'button';
        this.button.className = 'aimd-chatgpt-fold-bar__btn';
        this.button.addEventListener('click', options.onToggle);

        this.titleEl = document.createElement('span');
        this.titleEl.className = 'aimd-chatgpt-fold-bar__title';

        this.button.append(this.titleEl);
        this.root.append(this.button);
        this.setCollapsed(false);
        this.injectStyles();
    }

    getElement(): HTMLElement {
        return this.root;
    }

    setTitle(title: string): void {
        this.titleEl.textContent = title || '';
    }

    setCollapsed(collapsed: boolean): void {
        this.button.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
        this.button.textContent = collapsed ? i18n.t('show') : i18n.t('hide');
        if (this.titleEl.textContent) {
            this.button.append(' ');
            this.button.append(this.titleEl);
        }
    }

    dispose(): void {
        this.root.remove();
    }

    private injectStyles(): void {
        if (document.getElementById('aimd-chatgpt-fold-bar-style')) return;
        const style = document.createElement('style');
        style.id = 'aimd-chatgpt-fold-bar-style';
        style.textContent = `
            .aimd-chatgpt-fold-bar {
                margin: 8px 0;
            }
            .aimd-chatgpt-fold-bar__btn {
                border: 1px solid var(--aimd-border-default, #d1d5db);
                background: var(--aimd-bg-secondary, #f3f4f6);
                color: var(--aimd-text-primary, #111827);
                border-radius: 8px;
                padding: 6px 10px;
                cursor: pointer;
                font-size: 12px;
                line-height: 1.2;
            }
            .aimd-chatgpt-fold-bar__btn:hover {
                background: var(--aimd-interactive-hover, #e5e7eb);
            }
            .aimd-chatgpt-fold-bar__title {
                opacity: 0.85;
            }
        `;
        (document.head || document.documentElement).appendChild(style);
    }
}
