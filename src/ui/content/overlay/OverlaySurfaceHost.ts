import { ensureStyle } from '../../../style/shadow';
import { mountShadowDialogHost, type ShadowDialogHostHandle } from '../components/shadowDialogHost';

export type OverlaySurfaceHostHandle = {
    host: HTMLElement;
    shadow: ShadowRoot;
    backdropRoot: HTMLElement;
    surfaceRoot: HTMLElement;
    modalRoot: HTMLElement;
    unmount(): void;
};

type OverlaySurfaceHostOptions = {
    id: string;
    surfaceCss: string;
    overlayCss?: string;
    overlayStyleCache?: 'root' | 'shared';
    zIndex?: string;
    lockScroll?: boolean;
    surfaceStyleId?: string;
    overlayStyleId?: string;
};

function getOverlaySurfaceHtml(): string {
    return `
<div data-role="overlay-root">
  <div data-role="overlay-backdrop-root"></div>
  <div data-role="overlay-surface-root"></div>
  <div data-role="overlay-modal-root"></div>
</div>
`;
}

const OVERLAY_POINTER_SAFETY_CSS = `
[data-role="overlay-root"],
[data-role="overlay-backdrop-root"],
[data-role="overlay-surface-root"],
[data-role="overlay-modal-root"] {
  pointer-events: none;
}

[data-role="overlay-backdrop-root"] > *,
[data-role="overlay-surface-root"] > * {
  pointer-events: auto;
}
`;

export function mountOverlaySurfaceHost(opts: OverlaySurfaceHostOptions): OverlaySurfaceHostHandle {
    const handle: ShadowDialogHostHandle = mountShadowDialogHost({
        id: opts.id,
        html: getOverlaySurfaceHtml(),
        zIndex: opts.zIndex,
        lockScroll: opts.lockScroll,
    });

    const backdropRoot = handle.shadow.querySelector<HTMLElement>('[data-role="overlay-backdrop-root"]');
    const surfaceRoot = handle.shadow.querySelector<HTMLElement>('[data-role="overlay-surface-root"]');
    const modalRoot = handle.shadow.querySelector<HTMLElement>('[data-role="overlay-modal-root"]');

    if (!backdropRoot || !surfaceRoot || !modalRoot) {
        handle.unmount();
        throw new Error('Overlay surface host slots were not mounted.');
    }

    ensureStyle(handle.shadow, OVERLAY_POINTER_SAFETY_CSS, {
        id: 'aimd-overlay-pointer-safety',
        cache: 'shared',
    });

    ensureStyle(handle.shadow, opts.surfaceCss, {
        id: opts.surfaceStyleId ?? 'aimd-overlay-surface-structure',
    });

    if (opts.overlayCss) {
        ensureStyle(handle.shadow, opts.overlayCss, {
            id: opts.overlayStyleId ?? 'aimd-overlay-surface-extra',
            cache: opts.overlayStyleCache,
        });
    }

    return {
        host: handle.host,
        shadow: handle.shadow,
        backdropRoot,
        surfaceRoot,
        modalRoot,
        unmount() {
            handle.unmount();
        },
    };
}
