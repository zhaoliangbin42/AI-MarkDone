import type { Theme } from '../../../core/types/theme';
import { getTokenCss, type UserThemeOverrides } from '../../../style/tokens';
import { ModalHost } from '../components/ModalHost';
import { attachDialogKeyboardScope, type DialogKeyboardScopeHandle } from '../components/dialogKeyboardScope';
import { installInputEventBoundary } from '../components/inputEventBoundary';
import {
    installTransientOutsideDismissBoundary,
    type TransientOutsideDismissBoundaryHandle,
} from '../components/transientUi';
import { mountOverlaySurfaceHost, type OverlaySurfaceHostHandle } from './OverlaySurfaceHost';

export type OverlaySessionOptions = {
    id: string;
    theme: Theme;
    themeOverrides?: UserThemeOverrides;
    surfaceCss: string;
    lockScroll?: boolean;
    surfaceStyleId: string;
    overlayStyleId: string;
    overlayCss?: string;
    overlayStyleCache?: 'root' | 'shared';
    zIndex?: string;
};

export class OverlaySession {
    readonly handle: OverlaySurfaceHostHandle;
    readonly modalHost: ModalHost;

    private theme: Theme;
    private themeOverrides: UserThemeOverrides;
    private keyboardHandle: DialogKeyboardScopeHandle | null = null;
    private backdropDismissHandle: TransientOutsideDismissBoundaryHandle | null = null;
    private readonly removeSurfaceBoundary: () => void;
    private readonly removeModalBoundary: () => void;

    constructor(options: OverlaySessionOptions) {
        this.theme = options.theme;
        this.themeOverrides = options.themeOverrides ?? {};
        this.handle = mountOverlaySurfaceHost({
            id: options.id,
            themeCss: getTokenCss(this.theme, this.themeOverrides),
            surfaceCss: options.surfaceCss,
            overlayCss: options.overlayCss,
            overlayStyleCache: options.overlayStyleCache,
            zIndex: options.zIndex,
            lockScroll: options.lockScroll ?? true,
            surfaceStyleId: options.surfaceStyleId,
            overlayStyleId: options.overlayStyleId,
        });
        this.modalHost = new ModalHost(this.handle.modalRoot);
        this.removeSurfaceBoundary = installInputEventBoundary(this.handle.surfaceRoot);
        this.removeModalBoundary = installInputEventBoundary(this.handle.modalRoot);
    }

    get host(): HTMLElement {
        return this.handle.host;
    }

    get shadow(): ShadowRoot {
        return this.handle.shadow;
    }

    get backdropRoot(): HTMLElement {
        return this.handle.backdropRoot;
    }

    get surfaceRoot(): HTMLElement {
        return this.handle.surfaceRoot;
    }

    get modalRoot(): HTMLElement {
        return this.handle.modalRoot;
    }

    setTheme(theme: Theme): void {
        this.theme = theme;
        this.handle.setThemeCss(getTokenCss(this.theme, this.themeOverrides));
    }

    setThemeOverrides(overrides: UserThemeOverrides): void {
        this.themeOverrides = { ...overrides };
        this.handle.setThemeCss(getTokenCss(this.theme, this.themeOverrides));
    }

    setSurfaceCss(cssText: string): void {
        this.handle.setSurfaceCss(cssText);
    }

    replaceBackdrop(node: HTMLElement | null): void {
        if (node) {
            this.backdropRoot.replaceChildren(node);
            return;
        }
        this.backdropRoot.replaceChildren();
    }

    replaceSurface(node: HTMLElement | null): void {
        if (node) {
            this.surfaceRoot.replaceChildren(node);
            return;
        }
        this.surfaceRoot.replaceChildren();
    }

    syncKeyboardScope(params: {
        root: HTMLElement;
        onEscape: () => void;
        trapTabWithin?: HTMLElement;
        stopPropagationAll?: boolean;
        ignoreEscapeWhileComposing?: boolean;
        focusFallback?: () => HTMLElement | null;
    }): void {
        this.keyboardHandle?.detach();
        this.keyboardHandle = attachDialogKeyboardScope({
            root: params.root,
            onEscape: params.onEscape,
            trapTabWithin: params.trapTabWithin,
            stopPropagationAll: params.stopPropagationAll,
            ignoreEscapeWhileComposing: params.ignoreEscapeWhileComposing,
            focusFallback: params.focusFallback,
        });
    }

    clearKeyboardScope(): void {
        this.keyboardHandle?.detach();
        this.keyboardHandle = null;
    }

    syncBackdropDismiss(onDismiss: () => void): void {
        this.backdropDismissHandle?.detach();
        this.backdropDismissHandle = installTransientOutsideDismissBoundary({
            eventTarget: this.shadow,
            roots: [this.surfaceRoot, this.modalRoot],
            onDismiss: (event) => {
                const path = (event.composedPath?.() ?? []) as EventTarget[];
                if (!path.includes(this.backdropRoot)) return;
                onDismiss();
            },
        });
    }

    clearBackdropDismiss(): void {
        this.backdropDismissHandle?.detach();
        this.backdropDismissHandle = null;
    }

    unmount(): void {
        this.clearKeyboardScope();
        this.clearBackdropDismiss();
        this.removeSurfaceBoundary();
        this.removeModalBoundary();
        this.handle.unmount();
    }
}
