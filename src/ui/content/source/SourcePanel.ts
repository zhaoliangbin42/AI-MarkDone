import type { Theme } from '../../../core/types/theme';
import { getTokenCss } from '../../../style/tokens';
import { copyTextToClipboard } from '../../../drivers/content/clipboard/clipboard';
import { t } from '../components/i18n';
import { copyIcon, xIcon } from '../../../assets/icons';
import { mountShadowDialogHost, type ShadowDialogHostHandle } from '../components/shadowDialogHost';
import { attachDialogKeyboardScope, type DialogKeyboardScopeHandle } from '../components/dialogKeyboardScope';
import { TooltipDelegate } from '../../../utils/tooltip';

type State = {
    theme: Theme;
    title: string;
    content: string;
    visible: boolean;
};

export class SourcePanel {
    private host: HTMLElement | null = null;
    private shadow: ShadowRoot | null = null;
    private hostHandle: ShadowDialogHostHandle | null = null;
    private keyboardHandle: DialogKeyboardScopeHandle | null = null;
    private tooltipDelegate: TooltipDelegate | null = null;
    private state: State = { theme: 'light', title: '', content: '', visible: false };

    isVisible(): boolean {
        return this.state.visible;
    }

    setTheme(theme: Theme): void {
        this.state.theme = theme;
        this.hostHandle?.setCss(this.getCss());
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
        if (this.host) return;
        const handle = mountShadowDialogHost({
            id: 'aimd-source-panel-host',
            html: this.getHtml(),
            cssText: this.getCss(),
            lockScroll: true,
        });
        const host = handle.host;
        const shadow = handle.shadow;

        shadow.querySelector<HTMLElement>('[data-role="overlay"]')?.addEventListener('click', () => this.hide());
        shadow.querySelector<HTMLButtonElement>('[data-action="close"]')?.addEventListener('click', () => this.hide());
        shadow.querySelector<HTMLButtonElement>('[data-action="copy"]')?.addEventListener('click', () => void this.copy());

        this.keyboardHandle = attachDialogKeyboardScope({
            root: host,
            onEscape: () => this.hide(),
            stopPropagationAll: true,
            ignoreEscapeWhileComposing: true,
        });

        this.host = host;
        this.shadow = shadow;
        this.hostHandle = handle;
        this.tooltipDelegate = new TooltipDelegate(shadow);
        this.tooltipDelegate.refresh(shadow);
    }

    private unmount(): void {
        this.tooltipDelegate?.disconnect();
        this.tooltipDelegate = null;
        this.keyboardHandle?.detach();
        this.keyboardHandle = null;

        this.hostHandle?.unmount();
        this.hostHandle = null;

        this.host = null;
        this.shadow = null;
    }

    private render(): void {
        if (!this.shadow) return;
        const titleEl = this.shadow.querySelector<HTMLElement>('[data-field="title"]');
        const pre = this.shadow.querySelector<HTMLElement>('[data-role="content"]');
        if (titleEl) titleEl.textContent = this.state.title;
        if (pre) pre.textContent = this.state.content;
    }

    private async copy(): Promise<void> {
        if (!this.shadow) return;
        const btn = this.shadow.querySelector<HTMLButtonElement>('[data-action="copy"]');
        if (!btn) return;
        try {
            btn.disabled = true;
            const ok = await copyTextToClipboard(this.state.content || '');
            this.setStatus(ok ? t('btnCopied') : t('copyFailed'));
        } finally {
            window.setTimeout(() => this.setStatus(''), 1200);
            btn.disabled = false;
        }
    }

    private setStatus(text: string): void {
        if (!this.shadow) return;
        const el = this.shadow.querySelector<HTMLElement>('[data-field="status"]');
        if (el) el.textContent = text;
    }

    private getHtml(): string {
        return `
<div class="overlay" data-role="overlay"></div>
<div class="panel" role="dialog" aria-modal="true" aria-label="${t('modalSourceTitle')}">
  <div class="header">
    <div class="title" data-field="title"></div>
    <div class="header-right">
      <button class="icon" data-action="copy" aria-label="${t('btnCopyText')}" data-tooltip="${t('btnCopyText')}">${copyIcon}</button>
      <button class="icon" data-action="close" aria-label="${t('btnClose')}" data-tooltip="${t('btnClose')}">${xIcon}</button>
    </div>
  </div>
  <div class="body">
    <pre class="pre" data-role="content"></pre>
  </div>
  <div class="footer">
    <div class="status" data-field="status"></div>
  </div>
</div>
`;
    }

    private getCss(): string {
        return `
${getTokenCss(this.state.theme)}

:host { font-family: var(--aimd-font-family-sans); }
*, *::before, *::after { box-sizing: border-box; }
button, input, select, textarea { font-family: inherit; font-size: inherit; line-height: inherit; color: inherit; }

.overlay {
  position: fixed;
  inset: 0;
  background: var(--aimd-overlay-bg);
}

.panel {
  position: fixed;
  top: var(--aimd-panel-top);
  left: 50%;
  transform: translateX(-50%);
  width: var(--aimd-panel-width);
  max-width: min(900px, var(--aimd-panel-max-width));
  height: var(--aimd-panel-height);
  background: var(--aimd-bg-primary);
  color: var(--aimd-text-primary);
  border: 1px solid var(--aimd-border-default);
  border-radius: 16px;
  box-shadow: var(--aimd-shadow-panel);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--aimd-space-2);
  padding: 12px 14px;
  border-bottom: 1px solid var(--aimd-border-default);
}
.title {
  font-size: var(--aimd-font-size-sm);
  font-weight: 650;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
  min-width: 0;
}
.header-right { display: flex; align-items: center; gap: 8px; }
.icon {
  all: unset;
  cursor: pointer;
  width: 34px;
  height: 34px;
  display: grid;
  place-items: center;
  border-radius: 999px;
  color: color-mix(in srgb, var(--aimd-text-primary) 82%, transparent);
  border: 1px solid transparent;
  background: transparent;
}
.icon svg { width: 18px; height: 18px; display: block; }
.icon:hover { background: color-mix(in srgb, var(--aimd-text-primary) 8%, transparent); }
.icon:active { background: color-mix(in srgb, var(--aimd-text-primary) 14%, transparent); }
.icon:focus-visible { outline: 2px solid color-mix(in srgb, var(--aimd-interactive-primary) 70%, transparent); outline-offset: 2px; }
.icon:disabled { opacity: 0.55; cursor: not-allowed; }

.body {
  flex: 1;
  overflow: auto;
  padding: 14px 16px;
}
.pre {
  margin: 0;
  white-space: pre-wrap;
  font-family: var(--aimd-font-family-mono);
  font-size: 13px;
  line-height: 1.55;
  color: var(--aimd-text-primary);
}

.footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  padding: 10px 14px;
  border-top: 1px solid var(--aimd-border-default);
}
.status {
  font-size: var(--aimd-font-size-xs);
  color: var(--aimd-text-secondary);
  min-height: 18px;
}
`;
    }
}
