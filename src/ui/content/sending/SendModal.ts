import type { Theme } from '../../../core/types/theme';
import type { SiteAdapter } from '../../../drivers/content/adapters/base';
import { readComposer, writeComposer } from '../../../drivers/content/sending/composerPort';
import { sendText } from '../../../services/sending/sendService';
import { xIcon } from '../../../assets/icons';
import { t } from '../components/i18n';
import { getInputFieldCss } from '../components/styles/inputFieldCss';
import { TooltipDelegate } from '../../../utils/tooltip';
import { OverlaySession } from '../overlay/OverlaySession';

export class SendModal {
    private overlaySession: OverlaySession | null = null;
    private tooltipDelegate: TooltipDelegate | null = null;
    private adapter: SiteAdapter | null = null;
    private theme: Theme = 'light';
    private pending: boolean = false;

    isOpen(): boolean {
        return !!this.overlaySession;
    }

    setTheme(theme: Theme): void {
        this.theme = theme;
        this.overlaySession?.setTheme(theme);
        this.overlaySession?.setSurfaceCss(this.getCss());
    }

    open(params: { adapter: SiteAdapter; theme: Theme; initialText?: string }): void {
        this.adapter = params.adapter;
        this.theme = params.theme;
        this.mount();

        const text = params.initialText ?? (() => {
            const snap = readComposer(params.adapter);
            return snap.ok ? snap.text : '';
        })();

        const textarea = this.overlaySession?.surfaceRoot.querySelector<HTMLTextAreaElement>('[data-role="text"]');
        if (textarea) textarea.value = text;
        window.setTimeout(() => textarea?.focus(), 0);
    }

    close(opts?: { syncBack?: boolean }): void {
        const adapter = this.adapter;
        const text = this.overlaySession?.surfaceRoot.querySelector<HTMLTextAreaElement>('[data-role="text"]')?.value ?? '';

        if (opts?.syncBack && adapter) {
            void writeComposer(adapter, text, { focus: false, strategy: 'auto' });
        }

        this.unmount();
        this.adapter = null;
    }

    private mount(): void {
        if (this.overlaySession) return;
        this.overlaySession = new OverlaySession({
            id: 'aimd-send-modal-host',
            theme: this.theme,
            surfaceCss: this.getCss(),
            lockScroll: true,
            surfaceStyleId: 'aimd-send-modal-structure',
            overlayStyleId: 'aimd-send-modal-tailwind',
        });

        const backdrop = document.createElement('div');
        backdrop.className = 'panel-stage__overlay';
        this.overlaySession.replaceBackdrop(backdrop);
        this.overlaySession.surfaceRoot.innerHTML = this.getHtml();

        this.overlaySession.backdropRoot.addEventListener('click', () => this.close({ syncBack: true }));
        this.overlaySession.surfaceRoot.addEventListener('click', (event) => {
            const target = event.target as HTMLElement | null;
            const action = target?.closest<HTMLElement>('[data-action]')?.dataset.action;
            if (action === 'close' || action === 'cancel') {
                this.close({ syncBack: true });
                return;
            }
            if (action === 'send') {
                void this.submit();
            }
        });

        const dialog = this.overlaySession.surfaceRoot.querySelector<HTMLElement>('.dialog');
        this.overlaySession.syncKeyboardScope({
            root: this.overlaySession.host,
            onEscape: () => this.close({ syncBack: true }),
            stopPropagationAll: true,
            ignoreEscapeWhileComposing: true,
            trapTabWithin: dialog ?? this.overlaySession.host,
            focusFallback: () =>
                this.overlaySession?.surfaceRoot.querySelector<HTMLElement>('[data-role="text"], [data-action="send"], [data-action="close"]') ??
                null,
        });

        this.tooltipDelegate = new TooltipDelegate(this.overlaySession.shadow);
        this.tooltipDelegate.refresh(this.overlaySession.shadow);
    }

    private unmount(): void {
        this.tooltipDelegate?.disconnect();
        this.tooltipDelegate = null;
        this.overlaySession?.unmount();
        this.overlaySession = null;
        this.pending = false;
    }

    private setStatus(text: string): void {
        const el = this.overlaySession?.surfaceRoot.querySelector<HTMLElement>('[data-role="status"]');
        if (el) el.textContent = text;
    }

    private setPending(pending: boolean): void {
        this.pending = pending;
        const btn = this.overlaySession?.surfaceRoot.querySelector<HTMLButtonElement>('[data-action="send"]');
        if (btn) btn.disabled = pending;
    }

    private async submit(): Promise<void> {
        if (this.pending) return;
        const adapter = this.adapter;
        if (!adapter) return;
        const textarea = this.overlaySession?.surfaceRoot.querySelector<HTMLTextAreaElement>('[data-role="text"]');
        if (!textarea) return;

        const text = textarea.value;
        if (text.length === 0) {
            this.setStatus(t('sendEmpty'));
            window.setTimeout(() => this.setStatus(''), 1200);
            return;
        }

        this.setPending(true);
        this.setStatus(t('sendingStatus'));
        try {
            const res = await sendText(adapter, text, { focusComposer: true, timeoutMs: 3000 });
            if (!res.ok) {
                this.setStatus(res.message || t('sendFailed'));
                return;
            }
            this.setStatus(t('sentStatus'));
            window.setTimeout(() => this.close({ syncBack: false }), 150);
        } finally {
            window.setTimeout(() => this.setStatus(''), 1400);
            this.setPending(false);
        }
    }

    private getHtml(): string {
        return `
<div class="send-modal-stage">
  <div class="dialog" role="dialog" aria-modal="true" aria-label="${t('sendMessage')}">
    <div class="head">
      <div class="title">${t('send')}</div>
      <button class="icon" type="button" data-action="close" aria-label="${t('btnClose')}" data-tooltip="${t('btnClose')}">${xIcon}</button>
    </div>
    <textarea class="input aimd-field-control aimd-field-control--standalone" data-role="text" rows="7" placeholder="${t('typeYourMessage')}"></textarea>
    <div class="foot">
      <div class="status" data-role="status"></div>
      <div class="actions">
        <button class="btn" type="button" data-action="cancel" aria-label="${t('btnCancel')}">${t('btnCancel')}</button>
        <button class="btn btn--primary" type="button" data-action="send" aria-label="${t('send')}">${t('send')}</button>
      </div>
    </div>
  </div>
</div>
`;
    }

    private getCss(): string {
        return `
:host {
  font-family: var(--aimd-font-family-sans);
}

button, input, select, textarea {
  font: inherit;
  color: inherit;
}

${getInputFieldCss()}

.send-modal-stage {
  min-height: 100vh;
  display: grid;
  justify-items: center;
  align-items: start;
  padding: 12vh 24px 24px;
  pointer-events: none;
}

.dialog {
  width: min(720px, calc(100vw - 48px));
  background: color-mix(in srgb, var(--aimd-bg-surface) 98%, var(--aimd-bg-primary));
  color: var(--aimd-text-primary);
  border: 1px solid color-mix(in srgb, var(--aimd-border-strong) 72%, transparent);
  border-radius: var(--aimd-radius-2xl);
  box-shadow: var(--aimd-shadow-lg);
  display: grid;
  gap: 0;
  overflow: hidden;
  pointer-events: auto;
}

.head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--aimd-panel-header-gap);
  min-height: var(--aimd-panel-header-height);
  padding: var(--aimd-panel-header-padding-block) var(--aimd-panel-header-padding-inline);
  border-bottom: 1px solid color-mix(in srgb, var(--aimd-border-strong) 68%, transparent);
  background: color-mix(in srgb, var(--aimd-bg-surface) 94%, var(--aimd-bg-secondary));
}
.title {
  font-size: var(--aimd-modal-title-size);
  font-weight: var(--aimd-modal-title-weight);
  line-height: var(--aimd-panel-title-line-height);
}
.icon {
  width: var(--aimd-size-control-icon-panel);
  height: var(--aimd-size-control-icon-panel);
  border-radius: var(--aimd-radius-full);
  display: grid;
  place-items: center;
  border: 1px solid transparent;
  background: transparent;
  color: var(--aimd-button-icon-text);
  cursor: pointer;
}
.icon:hover {
  background: color-mix(in srgb, var(--aimd-button-icon-hover) 90%, var(--aimd-sys-color-surface-hover));
  color: var(--aimd-button-icon-text-hover);
}
.icon:active {
  background: color-mix(in srgb, var(--aimd-button-icon-active) 90%, var(--aimd-sys-color-surface-pressed));
  color: var(--aimd-button-icon-text-hover);
}
.icon:focus-visible {
  outline: 2px solid var(--aimd-focus-ring);
  outline-offset: 2px;
}

.input {
  width: 100%;
  resize: vertical;
  min-height: 140px;
  margin: var(--aimd-space-4);
  padding: 10px 12px;
  border-radius: var(--aimd-radius-xl);
  border: 1px solid color-mix(in srgb, var(--aimd-border-strong) 72%, transparent);
  background: color-mix(in srgb, var(--aimd-bg-surface) 94%, var(--aimd-bg-primary));
  color: var(--aimd-text-primary);
  font-size: var(--aimd-font-size-sm);
  line-height: 1.45;
  outline: none;
}
.foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--aimd-panel-footer-gap);
  padding: var(--aimd-panel-footer-padding-block) var(--aimd-panel-footer-padding-inline);
  border-top: 1px solid color-mix(in srgb, var(--aimd-border-strong) 68%, transparent);
  background: color-mix(in srgb, var(--aimd-bg-surface) 90%, var(--aimd-bg-secondary));
}
.status {
  min-height: 18px;
  font-size: var(--aimd-font-size-xs);
  color: var(--aimd-text-secondary);
}
.actions {
  display: flex;
  gap: var(--aimd-panel-action-gap);
}
.btn {
  min-height: var(--aimd-size-control-action-panel);
  padding: 0 14px;
  border-radius: var(--aimd-radius-full);
  border: 1px solid color-mix(in srgb, var(--aimd-border-strong) 70%, transparent);
  background: var(--aimd-button-secondary-bg);
  color: var(--aimd-button-secondary-text);
  font-size: var(--aimd-font-size-sm);
  font-weight: var(--aimd-font-medium);
  cursor: pointer;
}
.btn:hover {
  background: color-mix(in srgb, var(--aimd-button-secondary-hover) 90%, var(--aimd-sys-color-surface-hover));
}
.btn:active {
  background: color-mix(in srgb, var(--aimd-button-secondary-hover) 78%, var(--aimd-button-icon-active));
}
.btn:focus-visible {
  outline: 2px solid var(--aimd-focus-ring);
  outline-offset: 2px;
}
.btn:disabled { opacity: 0.55; cursor: not-allowed; }
.btn--primary {
  background: var(--aimd-interactive-primary);
  border-color: var(--aimd-interactive-primary);
  color: var(--aimd-text-on-primary);
}
.btn--primary:hover {
  background: var(--aimd-interactive-primary-hover);
}
.btn--primary:active {
  background: var(--aimd-interactive-primary-hover);
}
`;
    }
}
