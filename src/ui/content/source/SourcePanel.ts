import type { Theme } from '../../../core/types/theme';
import { copyTextToClipboard } from '../../../drivers/content/clipboard/clipboard';
import { copyIcon, xIcon } from '../../../assets/icons';
import { getTokenCss } from '../../../style/tokens';
import overlayCssText from '../../../style/tailwind-overlay.css?inline';
import { TooltipDelegate } from '../../../utils/tooltip';
import { attachDialogKeyboardScope, type DialogKeyboardScopeHandle } from '../components/dialogKeyboardScope';
import { createIcon } from '../components/Icon';
import { t } from '../components/i18n';
import { mountOverlaySurfaceHost, type OverlaySurfaceHostHandle } from '../overlay/OverlaySurfaceHost';
import { getSourcePanelCss } from './ui/styles/sourcePanelCss';

type State = {
    theme: Theme;
    title: string;
    content: string;
    visible: boolean;
};

export class SourcePanel {
    private hostHandle: OverlaySurfaceHostHandle | null = null;
    private keyboardHandle: DialogKeyboardScopeHandle | null = null;
    private tooltipDelegate: TooltipDelegate | null = null;
    private state: State = { theme: 'light', title: '', content: '', visible: false };

    isVisible(): boolean {
        return this.state.visible;
    }

    setTheme(theme: Theme): void {
        this.state.theme = theme;
        this.hostHandle?.setThemeCss(getTokenCss(theme));
        this.hostHandle?.setSurfaceCss(this.getCss());
    }

    show(params: { theme: Theme; title?: string; content: string }): void {
        this.state.theme = params.theme;
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
        if (this.hostHandle) return;

        const handle = mountOverlaySurfaceHost({
            id: 'aimd-source-panel-host',
            themeCss: getTokenCss(this.state.theme),
            surfaceCss: this.getCss(),
            overlayCss: overlayCssText,
            lockScroll: true,
            surfaceStyleId: 'aimd-source-panel-structure',
            overlayStyleId: 'aimd-source-panel-tailwind',
        });

        this.hostHandle = handle;
        this.tooltipDelegate = new TooltipDelegate(handle.shadow);

        handle.backdropRoot.addEventListener('click', () => this.hide());
        handle.surfaceRoot.addEventListener('click', (event) => void this.handleSurfaceClick(event));

        this.keyboardHandle = attachDialogKeyboardScope({
            root: handle.host,
            onEscape: () => this.hide(),
            stopPropagationAll: true,
            ignoreEscapeWhileComposing: true,
            trapTabWithin: handle.surfaceRoot.querySelector<HTMLElement>('.panel-window') ?? handle.host,
        });
    }

    private unmount(): void {
        this.tooltipDelegate?.disconnect();
        this.tooltipDelegate = null;
        this.keyboardHandle?.detach();
        this.keyboardHandle = null;
        this.hostHandle?.unmount();
        this.hostHandle = null;
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
        if (!this.hostHandle) return;

        this.hostHandle.setSurfaceCss(this.getCss());
        this.hostHandle.backdropRoot.innerHTML = '<div class="panel-stage__overlay"></div>';
        this.hostHandle.surfaceRoot.innerHTML = this.getHtml();
        this.tooltipDelegate?.refresh(this.hostHandle.shadow);
    }

    private async copyCurrent(): Promise<void> {
        if (!this.hostHandle) return;
        const button = this.hostHandle.surfaceRoot.querySelector<HTMLButtonElement>('[data-action="source-copy"]');
        if (!button) return;

        try {
            button.disabled = true;
            await copyTextToClipboard(this.state.content || '');
        } finally {
            button.disabled = false;
        }
    }

    private getHtml(): string {
        const title = this.getLabel('modalSourceTitle', 'Source');
        const copyLabel = this.getLabel('btnCopyText', 'Copy source');
        const closeLabel = this.getLabel('btnClose', 'Close panel');
        return `
<div class="panel-window panel-window--source" role="dialog" aria-modal="true" aria-label="${escapeHtml(title)}">
  <div class="panel-header">
    <div class="panel-header__meta panel-header__meta--reader">
      <h2>${escapeHtml(title)}</h2>
    </div>
    <div class="panel-header__actions">
      <button class="icon-btn" data-action="source-copy" aria-label="${escapeHtml(copyLabel)}" data-tooltip="${escapeHtml(copyLabel)}">${iconMarkup(copyIcon)}</button>
      <button class="icon-btn" data-action="close-panel" aria-label="${escapeHtml(closeLabel)}" data-tooltip="${escapeHtml(closeLabel)}">${iconMarkup(xIcon)}</button>
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
