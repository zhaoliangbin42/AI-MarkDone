import type { SiteAdapter } from '../../../drivers/content/adapters/base';
import { Icons } from '../../../assets/icons';
import { subscribeLocaleChange, t } from '../components/i18n';

type ToggleHandler = () => void | Promise<void>;

export class HeaderIconOrchestrator {
    private static readonly STYLE_ID = 'aimd-header-icon-style';
    private adapter: SiteAdapter;
    private onToggle: ToggleHandler;
    private host: HTMLDivElement | null = null;
    private observer: MutationObserver | null = null;
    private unsubscribeLocale: (() => void) | null = null;
    private scheduled = false;

    constructor(adapter: SiteAdapter, opts: { onToggle: ToggleHandler }) {
        this.adapter = adapter;
        this.onToggle = opts.onToggle;
    }

    init(): void {
        this.ensureStyles();
        this.ensureInjected();
        this.observer = new MutationObserver(() => this.scheduleEnsureInjected());
        this.observer.observe(document.body, { childList: true, subtree: true });
        this.unsubscribeLocale = subscribeLocaleChange(() => this.applyLabel());
    }

    dispose(): void {
        this.observer?.disconnect();
        this.observer = null;
        this.unsubscribeLocale?.();
        this.unsubscribeLocale = null;
        this.host?.remove();
        this.host = null;
        this.scheduled = false;
    }

    private scheduleEnsureInjected(): void {
        if (this.scheduled) return;
        this.scheduled = true;
        globalThis.setTimeout(() => {
            this.scheduled = false;
            this.ensureInjected();
        }, 0);
    }

    private ensureStyles(): void {
        if (document.getElementById(HeaderIconOrchestrator.STYLE_ID)) return;

        const style = document.createElement('style');
        style.id = HeaderIconOrchestrator.STYLE_ID;
        style.textContent = `
[data-aimd-role="header-icon"]{
    cursor:pointer;
    flex:0 0 auto;
}
[data-aimd-role="header-icon"]:focus-visible{
    outline:2px solid color-mix(in srgb, var(--aimd-interactive-primary) 38%, transparent);
    outline-offset:2px;
}
[data-aimd-role="header-icon"] img{
    display:block;
    pointer-events:none;
}
`;
        document.head.appendChild(style);
    }

    private ensureInjected(): void {
        const host = this.getOrCreateHost();
        if (host.isConnected) return;
        this.adapter.injectHeaderIcon(host);
    }

    private getOrCreateHost(): HTMLDivElement {
        if (this.host) return this.host;

        const button = document.createElement('div');
        button.id = 'aimd-header-icon-btn';
        button.dataset.aimdRole = 'header-icon';
        button.className = 'aimd-header-icon-btn';
        button.setAttribute('role', 'button');
        button.setAttribute('tabindex', '0');
        button.addEventListener('click', (event) => {
            event.preventDefault();
            event.stopPropagation();
            void this.onToggle();
        });
        button.addEventListener('keydown', (event) => {
            if (event.key !== 'Enter' && event.key !== ' ') return;
            event.preventDefault();
            event.stopPropagation();
            void this.onToggle();
        });

        const icon = Icons.createBrandIcon();
        button.appendChild(icon);

        this.host = button;
        this.applyLabel();
        return button;
    }

    private applyLabel(): void {
        if (!this.host) return;
        const label = t('bookmarks');
        this.host.title = label;
        this.host.setAttribute('aria-label', label);
    }
}
