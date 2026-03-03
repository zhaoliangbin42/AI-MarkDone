import type { Theme } from '../../../core/types/theme';
import type { SiteAdapter } from '../../../drivers/content/adapters/base';
import { readComposer, writeComposer } from '../../../drivers/content/sending/composerPort';
import { sendText } from '../../../services/sending/sendService';
import { createIcon } from '../components/Icon';
import { sendIcon, xIcon } from '../../../assets/icons';

type State = {
    theme: Theme;
    adapter: SiteAdapter | null;
    open: boolean;
    anchor: HTMLElement | null;
};

export class SendPopover {
    private state: State = { theme: 'light', adapter: null, open: false, anchor: null };
    private popoverEl: HTMLElement | null = null;
    private onShadowPointerDown: ((e: Event) => void) | null = null;
    private pending = false;

    setTheme(theme: Theme): void {
        this.state.theme = theme;
        this.applyTheme();
    }

    isOpen(): boolean {
        return this.state.open;
    }

    toggle(params: { shadow: ShadowRoot; anchor: HTMLElement; adapter: SiteAdapter; theme: Theme }): void {
        if (this.state.open) {
            this.close(params.shadow, { syncBack: true });
            return;
        }
        this.open(params);
    }

    open(params: { shadow: ShadowRoot; anchor: HTMLElement; adapter: SiteAdapter; theme: Theme; initialText?: string }): void {
        this.state.adapter = params.adapter;
        this.state.theme = params.theme;
        this.state.open = true;
        this.state.anchor = params.anchor;

        const pop = document.createElement('div');
        pop.className = 'aimd-send-popover';
        pop.setAttribute('role', 'dialog');
        pop.setAttribute('aria-modal', 'false');
        pop.setAttribute('aria-label', 'Send');
        pop.innerHTML = `
  <div class="head">
    <div class="title">Send</div>
    <button class="icon" type="button" data-action="close" aria-label="Close" title="Close">${xIcon}</button>
  </div>
  <textarea class="input" data-role="text" rows="6" placeholder="Type a message..."></textarea>
  <div class="foot">
    <div class="status" data-role="status"></div>
    <div class="actions">
      <button class="btn" type="button" data-action="cancel" aria-label="Cancel">Cancel</button>
      <button class="btn btn--primary" type="button" data-action="send" aria-label="Send">${createIcon(sendIcon).outerHTML}<span>Send</span></button>
    </div>
  </div>
`;

        // Anchor positioning: above the anchor, left-aligned to anchor.
        const panel = params.shadow.querySelector<HTMLElement>('.panel');
        const footer = params.shadow.querySelector<HTMLElement>('.footer');
        if (panel && footer) {
            panel.style.position = 'fixed';
        }
        pop.style.position = 'absolute';
        pop.style.left = '0';
        pop.style.bottom = 'calc(100% + 10px)';
        pop.style.zIndex = '1';

        // Mount under the anchor (in DOM) so absolute positioning is relative to a stable container.
        // Note: anchor wrapper is `.footer-left` in ReaderPanel.
        params.anchor.appendChild(pop);
        this.popoverEl = pop;

        const text = params.initialText ?? (() => {
            const snap = readComposer(params.adapter);
            return snap.ok ? snap.text : '';
        })();
        const textarea = pop.querySelector<HTMLTextAreaElement>('[data-role="text"]');
        if (textarea) textarea.value = text;
        window.setTimeout(() => textarea?.focus(), 0);

        pop.querySelector<HTMLButtonElement>('[data-action="close"]')?.addEventListener('click', () => this.close(params.shadow, { syncBack: true }));
        pop.querySelector<HTMLButtonElement>('[data-action="cancel"]')?.addEventListener('click', () => this.close(params.shadow, { syncBack: true }));
        pop.querySelector<HTMLButtonElement>('[data-action="send"]')?.addEventListener('click', () => void this.submit(params.shadow));

        // Keyboard isolation within the popover.
        pop.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                e.preventDefault();
                e.stopPropagation();
                this.close(params.shadow, { syncBack: true });
                return;
            }
            e.stopPropagation();
        });

        // Click outside closes (but does not close Reader).
        if (!this.onShadowPointerDown) {
            this.onShadowPointerDown = (ev: Event) => {
                if (!this.state.open) return;
                const path = (ev as any).composedPath?.() as Array<unknown> | undefined;
                const inPath = (node: unknown) => Array.isArray(path) && path.includes(node);
                if (this.popoverEl && inPath(this.popoverEl)) return;
                if (this.state.anchor && inPath(this.state.anchor)) return;
                this.close(params.shadow, { syncBack: true });
            };
            params.shadow.addEventListener('pointerdown', this.onShadowPointerDown, true);
        }

        this.applyTheme();
    }

    close(shadow: ShadowRoot, opts?: { syncBack?: boolean }): void {
        const adapter = this.state.adapter;
        const text = this.popoverEl?.querySelector<HTMLTextAreaElement>('[data-role="text"]')?.value ?? '';

        if (opts?.syncBack && adapter) {
            void writeComposer(adapter, text, { focus: false, strategy: 'auto' });
        }

        this.popoverEl?.remove();
        this.popoverEl = null;
        this.pending = false;
        this.state.open = false;
        this.state.anchor = null;

        if (this.onShadowPointerDown) {
            shadow.removeEventListener('pointerdown', this.onShadowPointerDown, true);
            this.onShadowPointerDown = null;
        }
    }

    private applyTheme(): void {
        if (!this.popoverEl) return;
        this.popoverEl.setAttribute('data-aimd-theme', this.state.theme);
    }

    private setStatus(text: string): void {
        const el = this.popoverEl?.querySelector<HTMLElement>('[data-role="status"]');
        if (el) el.textContent = text;
    }

    private setPending(pending: boolean): void {
        this.pending = pending;
        const btn = this.popoverEl?.querySelector<HTMLButtonElement>('[data-action="send"]');
        if (btn) btn.disabled = pending;
    }

    private async submit(shadow: ShadowRoot): Promise<void> {
        if (this.pending) return;
        const adapter = this.state.adapter;
        if (!adapter) return;
        const textarea = this.popoverEl?.querySelector<HTMLTextAreaElement>('[data-role="text"]');
        if (!textarea) return;

        const text = textarea.value;
        if (text.length === 0) {
            this.setStatus('Empty');
            window.setTimeout(() => this.setStatus(''), 1200);
            return;
        }

        this.setPending(true);
        this.setStatus('Sending…');
        try {
            const res = await sendText(adapter, text, { focusComposer: true, timeoutMs: 3000 });
            if (!res.ok) {
                this.setStatus(res.message || 'Send failed');
                return;
            }
            this.setStatus('Sent');
            window.setTimeout(() => this.close(shadow, { syncBack: false }), 120);
        } finally {
            window.setTimeout(() => this.setStatus(''), 1200);
            this.setPending(false);
        }
    }
}

