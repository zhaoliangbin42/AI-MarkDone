import type { Theme } from '../../../core/types/theme';
import type { SiteAdapter } from '../../../drivers/content/adapters/base';
import { readComposer, writeComposer } from '../../../drivers/content/sending/composerPort';
import { sendText } from '../../../services/sending/sendService';
import { ensureStyle } from '../../../style/shadow';
import { getTokenCss } from '../../../style/tokens';
import { xIcon } from '../../../assets/icons';
import { t } from '../components/i18n';

export class SendModal {
    private host: HTMLElement | null = null;
    private shadow: ShadowRoot | null = null;
    private adapter: SiteAdapter | null = null;
    private theme: Theme = 'light';
    private prevHtmlOverflow: string | null = null;
    private prevBodyOverflow: string | null = null;
    private pending: boolean = false;

    isOpen(): boolean {
        return !!this.host;
    }

    setTheme(theme: Theme): void {
        this.theme = theme;
        if (this.shadow) {
            const style = this.shadow.querySelector('style');
            if (style) style.textContent = getTokenCss(theme) + this.getCss();
        }
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

        // Lock host page scroll (Gmail-like overlay behavior).
        this.prevHtmlOverflow = document.documentElement.style.overflow || '';
        this.prevBodyOverflow = document.body.style.overflow || '';
        document.documentElement.style.overflow = 'hidden';
        document.body.style.overflow = 'hidden';

        const host = document.createElement('div');
        host.className = 'aimd-send-modal-host';
        host.style.position = 'fixed';
        host.style.inset = '0';
        host.style.zIndex = 'var(--aimd-z-panel)';

        const shadow = host.attachShadow({ mode: 'open' });
        shadow.innerHTML = this.getHtml();
        // Important: inject styles AFTER template mount. `innerHTML` replaces the whole shadow tree.
        ensureStyle(shadow, getTokenCss(this.theme) + this.getCss());

        shadow.querySelector<HTMLElement>('[data-role="overlay"]')?.addEventListener('click', () => this.close({ syncBack: true }));
        shadow.querySelector<HTMLButtonElement>('[data-action="close"]')?.addEventListener('click', () => this.close({ syncBack: true }));
        shadow.querySelector<HTMLButtonElement>('[data-action="cancel"]')?.addEventListener('click', () => this.close({ syncBack: true }));
        shadow.querySelector<HTMLButtonElement>('[data-action="send"]')?.addEventListener('click', () => void this.submit());

        host.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                e.preventDefault();
                e.stopPropagation();
                this.close({ syncBack: true });
                return;
            }
            // Keep keyboard events inside the modal to avoid affecting the host page.
            e.stopPropagation();
        });

        document.documentElement.appendChild(host);
        this.host = host;
        this.shadow = shadow;
    }

    private unmount(): void {
        this.shadow = null;
        this.host?.remove();
        this.host = null;
        this.pending = false;

        if (this.prevHtmlOverflow !== null) {
            document.documentElement.style.overflow = this.prevHtmlOverflow;
            this.prevHtmlOverflow = null;
        }
        if (this.prevBodyOverflow !== null) {
            document.body.style.overflow = this.prevBodyOverflow;
            this.prevBodyOverflow = null;
        }
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
    <button class="icon" type="button" data-action="close" aria-label="${t('btnClose')}" title="${t('btnClose')}">${xIcon}</button>
  </div>
  <textarea class="input" data-role="text" rows="7" placeholder="${t('typeYourMessage')}"></textarea>
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
  background: var(--aimd-bg-primary);
  color: var(--aimd-text-primary);
  border: 1px solid var(--aimd-border-default);
  border-radius: 16px;
  box-shadow: 0 16px 48px color-mix(in srgb, #000 26%, transparent);
  display: grid;
  gap: 12px;
  padding: 12px;
}

.head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.title {
  font-size: 16px;
  font-weight: 650;
}
.icon {
  width: 40px;
  height: 40px;
  border-radius: 999px;
  display: grid;
  place-items: center;
  border: none;
  background: transparent;
  color: var(--aimd-text-secondary);
  cursor: pointer;
}
.icon:hover {
  background: color-mix(in srgb, var(--aimd-text-primary) 10%, transparent);
}
.icon:focus-visible {
  outline: 2px solid color-mix(in srgb, var(--aimd-interactive-primary) 70%, transparent);
  outline-offset: 2px;
}

.input {
  width: 100%;
  resize: vertical;
  min-height: 140px;
  padding: 10px 12px;
  border-radius: 12px;
  border: 1px solid var(--aimd-border-default);
  background: var(--aimd-bg-secondary);
  color: var(--aimd-text-primary);
  font-size: var(--aimd-font-size-sm);
  line-height: 1.45;
  outline: none;
}
.input:focus-visible {
  outline: 2px solid color-mix(in srgb, var(--aimd-interactive-primary) 70%, transparent);
  outline-offset: 2px;
}

.foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.status {
  min-height: 18px;
  font-size: var(--aimd-font-size-xs);
  color: var(--aimd-text-secondary);
}
.actions {
  display: flex;
  gap: 10px;
}
.btn {
  height: 36px;
  padding: 0 14px;
  border-radius: 999px;
  border: 1px solid var(--aimd-border-default);
  background: transparent;
  color: var(--aimd-text-primary);
  font-size: var(--aimd-font-size-sm);
  cursor: pointer;
}
.btn:hover {
  background: color-mix(in srgb, var(--aimd-text-primary) 8%, transparent);
}
.btn:focus-visible {
  outline: 2px solid color-mix(in srgb, var(--aimd-interactive-primary) 70%, transparent);
  outline-offset: 2px;
}
.btn--primary {
  background: var(--aimd-interactive-primary);
  border-color: var(--aimd-interactive-primary);
  color: #fff;
}
.btn--primary:hover {
  background: color-mix(in srgb, var(--aimd-interactive-primary) 92%, #000);
}
`;
    }
}
