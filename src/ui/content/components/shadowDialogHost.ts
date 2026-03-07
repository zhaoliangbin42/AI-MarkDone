import { acquireScrollLock, type ScrollLockHandle } from './scrollLock';

export type ShadowDialogHostHandle = {
    host: HTMLElement;
    shadow: ShadowRoot;
    styleEl: HTMLStyleElement;
    setCss(cssText: string): void;
    unmount(): void;
};

export function mountShadowDialogHost(opts: {
    id: string;
    html: string;
    cssText: string;
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

    const shadow = host.attachShadow({ mode: 'open' });
    shadow.innerHTML = opts.html;

    const styleEl = document.createElement('style');
    styleEl.textContent = opts.cssText;
    shadow.appendChild(styleEl);

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
        styleEl,
        setCss(cssText: string) {
            styleEl.textContent = cssText;
        },
        unmount,
    };
}

