import type { Theme } from '../../../core/types/theme';
import {
    areAppearanceSnapshotsEqual,
    createAppearanceSnapshot,
    type AppearanceSnapshot,
} from '../../../style/appearance';
import { AppearanceScope } from '../../../style/appearanceScope';
import type { UserThemeOverrides } from '../../../style/tokens';
import { ModalHost } from '../components/ModalHost';
import { installInputEventBoundary } from '../components/inputEventBoundary';
import {
    getDefaultSurfaceMotionProfile,
    SurfaceSession,
    type ResponsiveProfile,
    type SurfaceMotionElements,
    type SurfaceMotionProfile,
    type SurfaceProfile,
} from '../components/SurfaceRuntime';
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
    profile?: Extract<SurfaceProfile, 'panel' | 'modal'>;
    responsiveProfile?: ResponsiveProfile;
    motionProfile?: SurfaceMotionProfile;
};

export class OverlaySession {
    readonly handle: OverlaySurfaceHostHandle;
    readonly modalHost: ModalHost;

    private readonly surfaceSession: SurfaceSession<AppearanceSnapshot>;
    private readonly appearanceScope: AppearanceScope;
    private readonly removeSurfaceBoundary: () => void;
    private readonly removeModalBoundary: () => void;

    constructor(options: OverlaySessionOptions) {
        const appearance = createAppearanceSnapshot(options.theme, options.themeOverrides ?? {});
        this.handle = mountOverlaySurfaceHost({
            id: options.id,
            surfaceCss: options.surfaceCss,
            overlayCss: options.overlayCss,
            overlayStyleCache: options.overlayStyleCache,
            zIndex: options.zIndex,
            lockScroll: options.lockScroll ?? true,
            surfaceStyleId: options.surfaceStyleId,
            overlayStyleId: options.overlayStyleId,
        });
        this.appearanceScope = AppearanceScope.forShadowRoot(this.handle.shadow);
        this.appearanceScope.apply(appearance);
        const profile = options.profile ?? 'panel';
        this.surfaceSession = new SurfaceSession<AppearanceSnapshot>({
            profile,
            responsiveProfile: options.responsiveProfile,
            motionProfile: options.motionProfile ?? getDefaultSurfaceMotionProfile(profile),
            appearance: {
                currentValue: appearance,
                equals: areAppearanceSnapshotsEqual,
                apply: (snapshot) => this.appearanceScope.apply(snapshot),
            },
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

    setAppearance(snapshot: AppearanceSnapshot): void {
        this.surfaceSession.setAppearance(snapshot);
    }

    openSurface(elements: SurfaceMotionElements): void {
        this.surfaceSession.open(elements);
    }

    syncSurfaceMotion(elements: SurfaceMotionElements): void {
        this.surfaceSession.syncMotion(elements);
    }

    closeSurface(params: SurfaceMotionElements & { onClosed: () => void }): boolean {
        return this.surfaceSession.close(params);
    }

    cancelSurfaceClose(): boolean {
        return this.surfaceSession.cancelClose();
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
        this.surfaceSession.syncEscapeScope({
            root: params.root,
            onEscape: params.onEscape,
            trapTabWithin: params.trapTabWithin,
            stopPropagationAll: params.stopPropagationAll,
            ignoreEscapeWhileComposing: params.ignoreEscapeWhileComposing,
            focusFallback: params.focusFallback,
        });
    }

    clearKeyboardScope(): void {
        this.surfaceSession.clearEscapeScope();
    }

    syncBackdropDismiss(onDismiss: () => void): void {
        this.surfaceSession.syncOutsideDismiss({
            eventTarget: this.shadow,
            roots: [this.surfaceRoot, this.modalRoot],
            shouldDismiss: (event) => {
                const path = (event.composedPath?.() ?? []) as EventTarget[];
                return path.includes(this.backdropRoot);
            },
            onDismiss,
        });
    }

    clearBackdropDismiss(): void {
        this.surfaceSession.clearOutsideDismiss();
    }

    unmount(): void {
        this.surfaceSession.destroy();
        this.appearanceScope.dispose();
        this.removeSurfaceBoundary();
        this.removeModalBoundary();
        this.handle.unmount();
    }
}
