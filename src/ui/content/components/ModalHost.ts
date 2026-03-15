import { xIcon } from '../../../assets/icons';
import { t } from './i18n';

type ModalKind = 'info' | 'warning' | 'error';

type ModalBase = {
    kind: ModalKind;
    title: string;
    message: string;
};

type ConfirmOptions = ModalBase & {
    danger?: boolean;
    confirmText: string;
    cancelText: string;
};

type PromptOptions = ModalBase & {
    placeholder?: string;
    defaultValue?: string;
    confirmText: string;
    cancelText: string;
    validate?: (value: string) => { ok: boolean; message?: string };
};

type CustomOptions = {
    kind: ModalKind;
    title: string;
    body: HTMLElement;
    footer?: (footer: HTMLElement, close: () => void) => void;
    onDismiss?: () => void;
};

export class ModalHost {
    private root: ShadowRoot | HTMLElement;
    private container: HTMLElement;
    private openCount: number = 0;
    private lastActive: HTMLElement | null = null;

    constructor(root: ShadowRoot | HTMLElement) {
        this.root = root;
        this.container = document.createElement('div');
        this.container.className = 'aimd-modal-host';
        this.root.appendChild(this.container);
    }

    isOpen(): boolean {
        return this.openCount > 0;
    }

    closeTop(): void {
        const last = this.container.lastElementChild as HTMLElement | null;
        if (!last) return;
        const cancel = last.querySelector<HTMLButtonElement>('[data-action="cancel"]');
        cancel?.click();
    }

    async alert(opts: ModalBase & { confirmText: string }): Promise<void> {
        await this.show({
            kind: opts.kind,
            title: opts.title,
            message: opts.message,
            footer: (footer, close) => {
                const okBtn = document.createElement('button');
                okBtn.type = 'button';
                okBtn.className = 'aimd-modal-btn aimd-modal-btn--primary';
                okBtn.textContent = opts.confirmText;
                okBtn.dataset.action = 'cancel';
                okBtn.addEventListener('click', () => close());
                footer.appendChild(okBtn);
                window.setTimeout(() => okBtn.focus(), 0);
            },
        });
    }

    async confirm(opts: ConfirmOptions): Promise<boolean> {
        return new Promise((resolve) => {
            void this.show({
                kind: opts.kind,
                title: opts.title,
                message: opts.message,
                footer: (footer, close) => {
                    const cancelBtn = document.createElement('button');
                    cancelBtn.type = 'button';
                    cancelBtn.className = 'aimd-modal-btn aimd-modal-btn--secondary';
                    cancelBtn.textContent = opts.cancelText;
                    cancelBtn.dataset.action = 'cancel';
                    cancelBtn.addEventListener('click', () => {
                        close();
                        resolve(false);
                    });

                    const confirmBtn = document.createElement('button');
                    confirmBtn.type = 'button';
                    confirmBtn.className = `aimd-modal-btn ${opts.danger ? 'aimd-modal-btn--danger' : 'aimd-modal-btn--primary'}`;
                    confirmBtn.textContent = opts.confirmText;
                    confirmBtn.dataset.action = 'confirm';
                    confirmBtn.addEventListener('click', () => {
                        close();
                        resolve(true);
                    });

                    footer.append(cancelBtn, confirmBtn);
                    window.setTimeout(() => confirmBtn.focus(), 0);
                },
                onDismiss: () => resolve(false),
            });
        });
    }

    async prompt(opts: PromptOptions): Promise<string | null> {
        return new Promise((resolve) => {
            void this.show({
                kind: opts.kind,
                title: opts.title,
                message: opts.message,
                body: (body) => {
                    const inputWrap = document.createElement('div');
                    inputWrap.className = 'aimd-modal-input-wrap';
                    const input = document.createElement('input');
                    input.type = 'text';
                    input.className = 'aimd-modal-input';
                    input.placeholder = opts.placeholder ?? '';
                    input.value = opts.defaultValue ?? '';
                    inputWrap.appendChild(input);

                    const error = document.createElement('div');
                    error.className = 'aimd-modal-error';

                    body.append(inputWrap, error);

                    return { input, error };
                },
                footer: (footer, close, ctx) => {
                    const cancelBtn = document.createElement('button');
                    cancelBtn.type = 'button';
                    cancelBtn.className = 'aimd-modal-btn aimd-modal-btn--secondary';
                    cancelBtn.textContent = opts.cancelText;
                    cancelBtn.dataset.action = 'cancel';
                    cancelBtn.addEventListener('click', () => {
                        close();
                        resolve(null);
                    });

                    const confirmBtn = document.createElement('button');
                    confirmBtn.type = 'button';
                    confirmBtn.className = 'aimd-modal-btn aimd-modal-btn--primary';
                    confirmBtn.textContent = opts.confirmText;
                    confirmBtn.dataset.action = 'confirm';

                    const runValidate = (): boolean => {
                        if (!opts.validate || !ctx) return true;
                        const res = opts.validate(ctx.input.value);
                        ctx.error.textContent = res.ok ? '' : (res.message ?? '');
                        return res.ok;
                    };

                    confirmBtn.addEventListener('click', () => {
                        if (!ctx) return;
                        if (!runValidate()) return;
                        const value = ctx.input.value;
                        close();
                        resolve(value);
                    });

                    footer.append(cancelBtn, confirmBtn);
                    if (ctx) {
                        ctx.input.addEventListener('keydown', (e) => {
                            if (e.key === 'Enter') confirmBtn.click();
                        });
                        window.setTimeout(() => ctx.input.focus(), 0);
                    }
                },
                onDismiss: () => resolve(null),
            });
        });
    }

    async showCustom(opts: CustomOptions): Promise<void> {
        await this.show({
            kind: opts.kind,
            title: opts.title,
            message: '',
            body: (content) => {
                content.appendChild(opts.body);
            },
            footer: (footer, close) => {
                opts.footer?.(footer, close);
                if (!opts.footer) {
                    const okBtn = document.createElement('button');
                    okBtn.type = 'button';
                    okBtn.className = 'aimd-modal-btn aimd-modal-btn--primary';
                    okBtn.textContent = t('btnOk');
                    okBtn.dataset.action = 'cancel';
                    okBtn.addEventListener('click', () => close());
                    footer.appendChild(okBtn);
                    window.setTimeout(() => okBtn.focus(), 0);
                }
            },
            onDismiss: opts.onDismiss,
        });
    }

    private async show(params: {
        kind: ModalKind;
        title: string;
        message?: string;
        body?: (body: HTMLElement) => { input: HTMLInputElement; error: HTMLElement } | void;
        footer: (footer: HTMLElement, close: () => void, ctx?: { input: HTMLInputElement; error: HTMLElement }) => void;
        onDismiss?: () => void;
    }): Promise<void> {
        this.openCount += 1;
        this.lastActive = (document.activeElement as HTMLElement | null) ?? null;

        const overlay = document.createElement('div');
        overlay.className = 'aimd-modal-overlay';
        overlay.dataset.kind = params.kind;

        const dialog = document.createElement('div');
        dialog.className = 'aimd-modal';
        dialog.setAttribute('role', 'dialog');
        dialog.setAttribute('aria-modal', 'true');

        const header = document.createElement('div');
        header.className = 'aimd-modal-header';
        const title = document.createElement('div');
        title.className = 'aimd-modal-title';
        title.textContent = params.title;

        const closeBtn = document.createElement('button');
        closeBtn.type = 'button';
        closeBtn.className = 'aimd-modal-close';
        closeBtn.innerHTML = xIcon;
        closeBtn.dataset.action = 'cancel';
        closeBtn.setAttribute('aria-label', t('btnClose'));

        header.append(title, closeBtn);

        const content = document.createElement('div');
        content.className = 'aimd-modal-content';
        if (params.message) {
            const msg = document.createElement('div');
            msg.className = 'aimd-modal-message';
            msg.textContent = params.message;
            content.appendChild(msg);
        }

        const ctx = params.body ? (params.body(content) as any) : undefined;

        const footer = document.createElement('div');
        footer.className = 'aimd-modal-footer';

        const close = () => {
            cleanup();
            overlay.remove();
        };

        const cleanup = () => {
            this.openCount = Math.max(0, this.openCount - 1);
            window.removeEventListener('keydown', onKeyDown, { capture: true } as any);
            if (!this.isOpen()) {
                this.lastActive?.focus?.();
                this.lastActive = null;
            }
        };

        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                e.preventDefault();
                e.stopPropagation();
                params.onDismiss?.();
                close();
            }
            if (e.key === 'Tab') {
                // Minimal focus guard: keep focus inside modal.
                const focusables = overlay.querySelectorAll<HTMLElement>('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
                const list = Array.from(focusables).filter((el) => !el.hasAttribute('disabled'));
                if (list.length === 0) return;
                const first = list[0];
                const last = list[list.length - 1];
                const active = document.activeElement as HTMLElement | null;
                if (e.shiftKey && active === first) {
                    e.preventDefault();
                    last.focus();
                } else if (!e.shiftKey && active === last) {
                    e.preventDefault();
                    first.focus();
                }
            }
        };

        window.addEventListener('keydown', onKeyDown, { capture: true });

        overlay.addEventListener('click', (e) => {
            if (e.target !== overlay) return;
            params.onDismiss?.();
            close();
        });

        closeBtn.addEventListener('click', () => {
            params.onDismiss?.();
            close();
        });

        params.footer(footer, close, ctx);

        dialog.append(header, content, footer);
        overlay.appendChild(dialog);
        this.container.appendChild(overlay);
    }
}
