import { acquireScrollLock, type ScrollLockHandle } from './scrollLock';

export type ShadowDialogHostHandle = {
    host: HTMLElement;
    shadow: ShadowRoot;
    readonly styleEl: HTMLStyleElement | null;
    setCss(cssText: string): void;
    unmount(): void;
};

export function mountShadowDialogHost(opts: {
    id: string;
    html: string;
    cssText?: string;
    zIndex?: string;
    lockScroll?: boolean;
}): ShadowDialogHostHandle {
    const lockScroll = opts.lockScroll ?? true;
    const zIndex = opts.zIndex ?? 'var(--aimd-z-panel)';

    const host = document.createElement('div');
    host.id = opts.id;
    host.className = opts.id;
    host.style.position = 'fixed';
    host.style.inset = '0';
    host.style.zIndex = zIndex;
    host.style.pointerEvents = 'none';

    const shadow = host.attachShadow({ mode: 'open' });
    shadow.innerHTML = opts.html;

    let styleEl: HTMLStyleElement | null = null;
    const setCss = (cssText: string): void => {
        if (!cssText.trim()) {
            styleEl?.remove();
            styleEl = null;
            return;
        }
        if (!styleEl) {
            styleEl = document.createElement('style');
            shadow.appendChild(styleEl);
        }
        styleEl.textContent = cssText;
    };
    setCss(opts.cssText ?? '');

    document.documentElement.appendChild(host);

    const scrollLock: ScrollLockHandle | null = lockScroll ? acquireScrollLock() : null;

    let unmounted = false;
    const unmount = () => {
        if (unmounted) return;
        unmounted = true;
        host.remove();
        scrollLock?.release();
    };

    return {
        host,
        shadow,
        get styleEl() {
            return styleEl;
        },
        setCss,
        unmount,
    };
}
