import type { Theme } from '../../../core/types/theme';
import { copyTextToClipboard } from '../../../drivers/content/clipboard/clipboard';
import { copyIcon, xIcon } from '../../../assets/icons';
import { getTokenCss } from '../../../style/tokens';
import { showEphemeralTooltip } from '../../../utils/tooltip';
import { createIcon } from '../components/Icon';
import { subscribeLocaleChange, t } from '../components/i18n';
import { OverlaySession } from '../overlay/OverlaySession';
import { getSourcePanelCss } from './ui/styles/sourcePanelCss';

type State = {
    theme: Theme;
    title: string;
    content: string;
    visible: boolean;
};

export class SourcePanel {
    private overlaySession: OverlaySession | null = null;
    private unsubscribeLocale: (() => void) | null = null;
    private state: State = { theme: 'light', title: '', content: '', visible: false };
    private usesDefaultTitle = true;

    isVisible(): boolean {
        return this.state.visible;
    }

    setTheme(theme: Theme): void {
        this.state.theme = theme;
        this.overlaySession?.setTheme(theme);
        this.overlaySession?.setSurfaceCss(this.getCss());
    }

    show(params: { theme: Theme; title?: string; content: string }): void {
        this.state.theme = params.theme;
        this.usesDefaultTitle = !params.title;
        this.state.title = params.title || t('modalSourceTitle');
        this.state.content = params.content;
        this.state.visible = true;

        this.mount();
        this.render();
    }

    hide(): void {
        this.state.visible = false;
        this.unmount();
    }

    private mount(): void {
        if (this.overlaySession) return;

        const session = new OverlaySession({
            id: 'aimd-source-panel-host',
            theme: this.state.theme,
            surfaceCss: this.getCss(),
            lockScroll: true,
            surfaceStyleId: 'aimd-source-panel-structure',
            overlayStyleId: 'aimd-source-panel-tailwind',
        });

        this.overlaySession = session;
        this.unsubscribeLocale = subscribeLocaleChange(() => {
            if (!this.overlaySession || !this.state.visible) return;
            if (this.usesDefaultTitle) {
                this.state.title = t('modalSourceTitle');
            }
            this.render();
        });

        session.backdropRoot.addEventListener('click', () => this.hide());
        session.surfaceRoot.addEventListener('click', (event) => void this.handleSurfaceClick(event));
        session.syncKeyboardScope({
            root: session.host,
            onEscape: () => this.hide(),
            stopPropagationAll: true,
            ignoreEscapeWhileComposing: true,
            trapTabWithin: session.surfaceRoot.querySelector<HTMLElement>('.panel-window') ?? session.host,
        });
    }

    private unmount(): void {
        this.unsubscribeLocale?.();
        this.unsubscribeLocale = null;
        this.overlaySession?.unmount();
        this.overlaySession = null;
        this.usesDefaultTitle = true;
    }

    private async handleSurfaceClick(event: Event): Promise<void> {
        const target = event.target as HTMLElement | null;
        const actionEl = target?.closest<HTMLElement>('[data-action]');
        if (!actionEl) return;

        const action = actionEl.dataset.action;
        if (action === 'close-panel') {
            this.hide();
            return;
        }

        if (action === 'source-copy') {
            await this.copyCurrent();
        }
    }

    private render(): void {
        if (!this.overlaySession) return;

        this.overlaySession.setSurfaceCss(this.getCss());
        this.overlaySession.backdropRoot.innerHTML = '<div class="panel-stage__overlay"></div>';
        this.overlaySession.surfaceRoot.innerHTML = this.getHtml();
        this.overlaySession.syncKeyboardScope({
            root: this.overlaySession.host,
            onEscape: () => this.hide(),
            stopPropagationAll: true,
            ignoreEscapeWhileComposing: true,
            trapTabWithin: this.overlaySession.surfaceRoot.querySelector<HTMLElement>('.panel-window') ?? this.overlaySession.host,
        });
    }

    private async copyCurrent(): Promise<void> {
        if (!this.overlaySession) return;
        const button = this.overlaySession.surfaceRoot.querySelector<HTMLButtonElement>('[data-action="source-copy"]');
        if (!button) return;

        try {
            button.disabled = true;
            const ok = await copyTextToClipboard(this.state.content || '');
            showEphemeralTooltip({
                root: this.overlaySession.shadow,
                anchor: button,
                text: ok ? this.getLabel('btnCopied', 'Copied') : this.getLabel('copyFailed', 'Copy failed'),
            });
        } finally {
            button.disabled = false;
        }
    }

    private getHtml(): string {
        const title = this.state.title || this.getLabel('modalSourceTitle', 'Source');
        const copyLabel = this.getLabel('btnCopyText', 'Copy source');
        const closeLabel = this.getLabel('btnClose', 'Close panel');
        return `
<div class="panel-window panel-window--source" role="dialog" aria-modal="true" aria-label="${escapeHtml(title)}">
  <div class="panel-header">
    <div class="panel-header__meta panel-header__meta--reader">
      <h2>${escapeHtml(title)}</h2>
    </div>
    <div class="panel-header__actions">
      <button class="icon-btn" data-action="source-copy" aria-label="${escapeHtml(copyLabel)}" title="${escapeHtml(copyLabel)}">${iconMarkup(copyIcon)}</button>
      <button class="icon-btn" data-action="close-panel" aria-label="${escapeHtml(closeLabel)}" title="${escapeHtml(closeLabel)}">${iconMarkup(xIcon)}</button>
    </div>
  </div>
  <div class="source-body">
    <pre class="source-pre">${escapeHtml(this.state.content)}</pre>
  </div>
</div>
`;
    }

    private getCss(): string {
        return `
${getTokenCss(this.state.theme)}

${getSourcePanelCss()}
`;
    }

    private getLabel(key: string, fallback: string): string {
        const translated = t(key);
        if (!translated || translated === key) return fallback;
        return translated;
    }
}

function iconMarkup(svg: string): string {
    return createIcon(svg).outerHTML;
}

function escapeHtml(input: string): string {
    return input
        .split('&').join('&amp;')
        .split('<').join('&lt;')
        .split('>').join('&gt;')
        .split('"').join('&quot;')
        .split("'").join('&#39;');
}
