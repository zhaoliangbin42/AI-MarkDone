import { Icons, xIcon } from '../../../assets/icons';
import { ensureStyle } from '../../../style/shadow';
import { t } from './i18n';
import { beginSurfaceMotionClose, setSurfaceMotionOpening } from './motionLifecycle';
import { getModalHostCss } from './styles/modalHostCss';
import {
    installTransientOutsideDismissBoundary,
    markTransientRoot,
    type TransientOutsideDismissBoundaryHandle,
} from './transientUi';

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
    private focusStack: Array<HTMLElement | null> = [];

    constructor(root: ShadowRoot | HTMLElement) {
        this.root = root;
        this.container = document.createElement('div');
        this.container.className = 'mock-modal-host';
        this.ensureStyles();
        this.root.appendChild(this.container);
        this.installLocalEventBoundary();
    }

    isOpen(): boolean {
        return this.container.childElementCount > 0;
    }

    closeTop(): void {
        const last = this.container.lastElementChild as HTMLElement | null;
        if (!last) return;
        const cancel = last.querySelector<HTMLButtonElement>('[data-action="modal-cancel"]');
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
                okBtn.className = 'mock-modal__button mock-modal__button--primary';
                okBtn.textContent = opts.confirmText;
                okBtn.dataset.action = 'modal-cancel';
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
                    cancelBtn.className = 'mock-modal__button mock-modal__button--secondary';
                    cancelBtn.textContent = opts.cancelText;
                    cancelBtn.dataset.action = 'modal-cancel';
                    cancelBtn.addEventListener('click', () => {
                        close();
                        resolve(false);
                    });

                    const confirmBtn = document.createElement('button');
                    confirmBtn.type = 'button';
                    confirmBtn.className = `mock-modal__button ${opts.danger ? 'mock-modal__button--danger' : 'mock-modal__button--primary'}`;
                    confirmBtn.textContent = opts.confirmText;
                    confirmBtn.dataset.action = 'modal-confirm';
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
                    const input = document.createElement('input');
                    input.type = 'text';
                    input.className = 'mock-modal__input aimd-field-control aimd-field-control--standalone';
                    input.placeholder = opts.placeholder ?? '';
                    input.value = opts.defaultValue ?? '';

                    const error = document.createElement('div');
                    error.className = 'mock-modal__error';

                    body.append(input, error);

                    return { input, error };
                },
                footer: (footer, close, ctx) => {
                    const cancelBtn = document.createElement('button');
                    cancelBtn.type = 'button';
                    cancelBtn.className = 'mock-modal__button mock-modal__button--secondary';
                    cancelBtn.textContent = opts.cancelText;
                    cancelBtn.dataset.action = 'modal-cancel';
                    cancelBtn.addEventListener('click', () => {
                        close();
                        resolve(null);
                    });

                    const confirmBtn = document.createElement('button');
                    confirmBtn.type = 'button';
                    confirmBtn.className = 'mock-modal__button mock-modal__button--primary';
                    confirmBtn.textContent = opts.confirmText;
                    confirmBtn.dataset.action = 'modal-confirm';

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
                    okBtn.className = 'mock-modal__button mock-modal__button--primary';
                    okBtn.textContent = t('btnOk');
                    okBtn.dataset.action = 'modal-cancel';
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
        this.focusStack.push((document.activeElement as HTMLElement | null) ?? null);

        const overlay = document.createElement('div');
        overlay.className = 'mock-modal-overlay';
        overlay.dataset.kind = params.kind;

        const dialog = markTransientRoot(document.createElement('div'));
        dialog.className = 'mock-modal';
        dialog.dataset.kind = params.kind;
        dialog.setAttribute('role', 'dialog');
        dialog.setAttribute('aria-modal', 'true');

        const header = document.createElement('div');
        header.className = 'mock-modal__head';
        const titleWrap = document.createElement('div');
        titleWrap.className = 'mock-modal__title-wrap';

        const kindIcon = document.createElement('span');
        kindIcon.className = 'mock-modal__kind-icon';
        kindIcon.innerHTML = getKindIcon(params.kind);

        const titleCopy = document.createElement('div');
        titleCopy.className = 'mock-modal__title-copy';
        const title = document.createElement('strong');
        title.textContent = params.title;
        titleCopy.appendChild(title);

        const closeBtn = document.createElement('button');
        closeBtn.type = 'button';
        closeBtn.className = 'mock-modal__close';
        closeBtn.innerHTML = xIcon;
        closeBtn.dataset.action = 'modal-cancel';
        closeBtn.setAttribute('aria-label', t('btnClose'));

        titleWrap.append(kindIcon, titleCopy);
        header.append(titleWrap, closeBtn);

        const content = document.createElement('div');
        content.className = 'mock-modal__content';
        if (params.message) {
            const msg = document.createElement('p');
            msg.className = 'mock-modal__message';
            msg.textContent = params.message;
            content.appendChild(msg);
        }

        const ctx = params.body ? (params.body(content) as any) : undefined;

        const footer = document.createElement('div');
        footer.className = 'mock-modal__footer';
        let outsideDismissBoundary: TransientOutsideDismissBoundaryHandle | null = null;

        const restoreFocus = () => {
            const previous = this.focusStack.pop() ?? null;
            if (previous?.isConnected) {
                previous.focus({ preventScroll: true } as any);
                return;
            }

            const topOverlay = this.container.lastElementChild as HTMLElement | null;
            const fallback = topOverlay?.querySelector<HTMLElement>(
                'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
            );
            fallback?.focus?.({ preventScroll: true } as any);
        };

        const dismiss = () => {
            if (overlay.dataset.motionState === 'closing') return;
            params.onDismiss?.();
            close();
        };

        const close = () => {
            if (!overlay.isConnected || overlay.dataset.motionState === 'closing') return;
            beginSurfaceMotionClose({
                shell: dialog,
                backdrop: overlay,
                onClosed: () => {
                    cleanup();
                    overlay.remove();
                },
                fallbackMs: 600,
            });
        };

        const cleanup = () => {
            outsideDismissBoundary?.detach();
            outsideDismissBoundary = null;
            restoreFocus();
        };

        outsideDismissBoundary = installTransientOutsideDismissBoundary({
            eventTarget: overlay,
            roots: [dialog],
            onDismiss: dismiss,
        });

        closeBtn.addEventListener('click', () => {
            dismiss();
        });

        dialog.addEventListener('keydown', (event) => {
            if (event.key === 'Escape') {
                event.preventDefault();
                event.stopPropagation();
                dismiss();
                return;
            }

            if (event.key !== 'Tab') return;
            const focusables = getFocusableElements(dialog);
            if (focusables.length === 0) {
                event.preventDefault();
                closeBtn.focus({ preventScroll: true } as any);
                return;
            }

            const current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
            const first = focusables[0]!;
            const last = focusables[focusables.length - 1]!;

            if (!event.shiftKey && current === last) {
                event.preventDefault();
                first.focus({ preventScroll: true } as any);
                return;
            }

            if (event.shiftKey && (current === first || current === dialog)) {
                event.preventDefault();
                last.focus({ preventScroll: true } as any);
            }
        });

        params.footer(footer, close, ctx);

        dialog.append(header, content, footer);
        overlay.appendChild(dialog);
        this.container.appendChild(overlay);
        setSurfaceMotionOpening([overlay, dialog]);

        window.setTimeout(() => {
            getFocusableElements(dialog)[0]?.focus?.({ preventScroll: true } as any);
        }, 0);
    }

    private ensureStyles(): void {
        const cssText = getModalHostCss();
        if (this.root instanceof ShadowRoot) {
            ensureStyle(this.root, cssText, { id: 'aimd-modal-host-structure' });
            return;
        }

        const existing = this.root.querySelector<HTMLStyleElement>('style[data-aimd-style-id="aimd-modal-host-structure"]');
        if (existing) {
            existing.textContent = cssText;
            return;
        }

        const style = document.createElement('style');
        style.setAttribute('data-aimd-style-id', 'aimd-modal-host-structure');
        style.textContent = cssText;
        this.root.appendChild(style);
    }

    private installLocalEventBoundary(): void {
        const stop = (event: Event) => event.stopPropagation();
        this.container.addEventListener('click', stop);
        this.container.addEventListener('input', stop);
        this.container.addEventListener('focusin', stop);
        this.container.addEventListener('keydown', stop);
    }
}

function getFocusableElements(root: HTMLElement): HTMLElement[] {
    return Array.from(
        root.querySelectorAll<HTMLElement>(
            'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
    ).filter((element) => !element.hasAttribute('hidden') && element.getAttribute('aria-hidden') !== 'true');
}

function getKindIcon(kind: ModalKind): string {
    if (kind === 'warning') return Icons.alertTriangle;
    if (kind === 'error') return Icons.xCircle;
    return Icons.info;
}
