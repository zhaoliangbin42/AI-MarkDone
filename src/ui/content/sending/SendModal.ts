import type { Theme } from '../../../core/types/theme';
import type { SiteAdapter } from '../../../drivers/content/adapters/base';
import { readComposer, writeComposer } from '../../../drivers/content/sending/composerPort';
import { sendText } from '../../../services/sending/sendService';
import { getTokenCss } from '../../../style/tokens';
import { xIcon } from '../../../assets/icons';
import { t } from '../components/i18n';
import { mountShadowDialogHost, type ShadowDialogHostHandle } from '../components/shadowDialogHost';
import { attachDialogKeyboardScope, type DialogKeyboardScopeHandle } from '../components/dialogKeyboardScope';
import { getInputFieldCss } from '../components/styles/inputFieldCss';
import { TooltipDelegate } from '../../../utils/tooltip';

export class SendModal {
    private host: HTMLElement | null = null;
    private shadow: ShadowRoot | null = null;
    private hostHandle: ShadowDialogHostHandle | null = null;
    private keyboardHandle: DialogKeyboardScopeHandle | null = null;
    private tooltipDelegate: TooltipDelegate | null = null;
    private adapter: SiteAdapter | null = null;
    private theme: Theme = 'light';
    private pending: boolean = false;

    isOpen(): boolean {
        return !!this.host;
    }

    setTheme(theme: Theme): void {
        this.theme = theme;
        this.hostHandle?.setCss(getTokenCss(theme) + this.getCss());
    }

    open(params: { adapter: SiteAdapter; theme: Theme; initialText?: string }): void {
        this.adapter = params.adapter;
        this.theme = params.theme;
        this.mount();

        const text = params.initialText ?? (() => {
            const snap = readComposer(params.adapter);
            return snap.ok ? snap.text : '';
        })();

        const textarea = this.shadow?.querySelector<HTMLTextAreaElement>('[data-role="text"]');
        if (textarea) textarea.value = text;
        window.setTimeout(() => textarea?.focus(), 0);
    }

    close(opts?: { syncBack?: boolean }): void {
        const adapter = this.adapter;
        const shadow = this.shadow;
        const text = shadow?.querySelector<HTMLTextAreaElement>('[data-role="text"]')?.value ?? '';

        if (opts?.syncBack && adapter) {
            void writeComposer(adapter, text, { focus: false, strategy: 'auto' });
        }

        this.unmount();
        this.adapter = null;
    }

    private mount(): void {
        if (this.host) return;
        const handle = mountShadowDialogHost({
            id: 'aimd-send-modal-host',
            html: this.getHtml(),
            cssText: getTokenCss(this.theme) + this.getCss(),
            lockScroll: true,
        });
        const host = handle.host;
        const shadow = handle.shadow;

        shadow.querySelector<HTMLElement>('[data-role="overlay"]')?.addEventListener('click', () => this.close({ syncBack: true }));
        shadow.querySelector<HTMLButtonElement>('[data-action="close"]')?.addEventListener('click', () => this.close({ syncBack: true }));
        shadow.querySelector<HTMLButtonElement>('[data-action="cancel"]')?.addEventListener('click', () => this.close({ syncBack: true }));
        shadow.querySelector<HTMLButtonElement>('[data-action="send"]')?.addEventListener('click', () => void this.submit());

        this.keyboardHandle = attachDialogKeyboardScope({
            root: host,
            onEscape: () => this.close({ syncBack: true }),
            stopPropagationAll: true,
            ignoreEscapeWhileComposing: true,
            trapTabWithin: shadow.querySelector<HTMLElement>('.dialog') ?? undefined,
        });

        this.host = host;
        this.shadow = shadow;
        this.hostHandle = handle;
        this.tooltipDelegate = new TooltipDelegate(shadow);
        this.tooltipDelegate.refresh(shadow);
    }

    private unmount(): void {
        this.shadow = null;
        this.tooltipDelegate?.disconnect();
        this.tooltipDelegate = null;
        this.keyboardHandle?.detach();
        this.keyboardHandle = null;

        this.hostHandle?.unmount();
        this.hostHandle = null;

        this.host = null;
        this.pending = false;
    }

    private setStatus(text: string): void {
        const el = this.shadow?.querySelector<HTMLElement>('[data-role="status"]');
        if (el) el.textContent = text;
    }

    private setPending(pending: boolean): void {
        this.pending = pending;
        const btn = this.shadow?.querySelector<HTMLButtonElement>('[data-action="send"]');
        if (btn) btn.disabled = pending;
    }

    private async submit(): Promise<void> {
        if (this.pending) return;
        const adapter = this.adapter;
        if (!adapter) return;
        const textarea = this.shadow?.querySelector<HTMLTextAreaElement>('[data-role="text"]');
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
<div class="overlay" data-role="overlay"></div>
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

.overlay {
  position: fixed;
  inset: 0;
  background: color-mix(in srgb, var(--aimd-overlay-bg) 72%, transparent);
}

.dialog {
  position: fixed;
  left: 50%;
  top: 12vh;
  transform: translateX(-50%);
  width: min(720px, calc(100vw - 48px));
  background: color-mix(in srgb, var(--aimd-bg-primary) 98%, transparent);
  color: var(--aimd-text-primary);
  border: 1px solid color-mix(in srgb, var(--aimd-border-default) 80%, transparent);
  border-radius: var(--aimd-radius-2xl);
  box-shadow: var(--aimd-shadow-lg);
  display: grid;
  gap: 0;
  overflow: hidden;
}

.head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--aimd-panel-header-gap);
  min-height: var(--aimd-panel-header-height);
  padding: var(--aimd-panel-header-padding-block) var(--aimd-panel-header-padding-inline);
  border-bottom: 1px solid color-mix(in srgb, var(--aimd-border-default) 74%, transparent);
  background: color-mix(in srgb, var(--aimd-bg-secondary) 90%, transparent);
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
  background: var(--aimd-button-icon-hover);
  color: var(--aimd-button-icon-text-hover);
}
.icon:active {
  background: var(--aimd-button-icon-active);
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
  border: 1px solid var(--aimd-border-default);
  background: color-mix(in srgb, var(--aimd-bg-primary) 92%, transparent);
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
  border-top: 1px solid color-mix(in srgb, var(--aimd-border-default) 74%, transparent);
  background: color-mix(in srgb, var(--aimd-bg-secondary) 86%, transparent);
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
  border: 1px solid var(--aimd-border-default);
  background: var(--aimd-button-secondary-bg);
  color: var(--aimd-button-secondary-text);
  font-size: var(--aimd-font-size-sm);
  font-weight: var(--aimd-font-medium);
  cursor: pointer;
}
.btn:hover {
  background: var(--aimd-button-secondary-hover);
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
