import { SurfaceFocusLifecycle } from './surfaceFocusLifecycle';
import { attachDialogKeyboardScope, type DialogKeyboardScopeHandle } from './dialogKeyboardScope';
import {
    installTransientOutsideDismissBoundary,
    type TransientOutsideDismissBoundaryHandle,
} from './transientUi';
import {
    beginSurfaceMotionClose,
    cancelSurfaceMotionClose,
    setSurfaceMotionOpening,
} from './motionLifecycle';

export type SurfaceProfile = 'panel' | 'modal' | 'anchored' | 'inline';

export type ResponsiveProfile = Readonly<{
    viewportGutterPx: number;
    maxWidthCss?: string;
    maxHeightCss?: string;
    collision: 'none' | 'clamp' | 'flip-clamp';
    scrollOwner: 'none' | 'page' | 'surface' | 'content';
    narrowFallback: 'none' | 'compact' | 'fullscreen' | 'hidden';
}>;

export type SurfaceMotionPhase = Readonly<{
    durationMs: number;
    easing: string;
}>;

export type SurfaceMotionTrack = Readonly<{
    open: SurfaceMotionPhase;
    close: SurfaceMotionPhase;
}>;

export type SurfaceMotionProfile = Readonly<{
    surface: SurfaceMotionTrack;
    backdrop?: SurfaceMotionTrack;
    reducedMotion: Readonly<{
        surface: SurfaceMotionTrack;
        backdrop?: SurfaceMotionTrack;
    }>;
    closeFallbackBufferMs: number;
}>;

const reducedMotionTrack: SurfaceMotionTrack = {
    open: { durationMs: 80, easing: 'linear' },
    close: { durationMs: 80, easing: 'linear' },
};

const noMotionTrack: SurfaceMotionTrack = {
    open: { durationMs: 0, easing: 'linear' },
    close: { durationMs: 0, easing: 'linear' },
};

const overlayMotionTrack: SurfaceMotionTrack = {
    open: { durationMs: 180, easing: 'var(--aimd-ease-out)' },
    close: { durationMs: 150, easing: 'ease-in' },
};

const defaultMotionProfiles: Readonly<Record<SurfaceProfile, SurfaceMotionProfile>> = {
    panel: {
        surface: {
            open: { durationMs: 300, easing: 'var(--aimd-ease-out)' },
            close: { durationMs: 240, easing: 'ease-in' },
        },
        backdrop: overlayMotionTrack,
        reducedMotion: { surface: reducedMotionTrack, backdrop: reducedMotionTrack },
        closeFallbackBufferMs: 80,
    },
    modal: {
        surface: {
            open: { durationMs: 280, easing: 'var(--aimd-ease-out)' },
            close: { durationMs: 220, easing: 'ease-in' },
        },
        backdrop: overlayMotionTrack,
        reducedMotion: { surface: reducedMotionTrack, backdrop: reducedMotionTrack },
        closeFallbackBufferMs: 80,
    },
    anchored: {
        surface: {
            open: { durationMs: 180, easing: 'var(--aimd-ease-out)' },
            close: { durationMs: 150, easing: 'ease-in' },
        },
        reducedMotion: { surface: reducedMotionTrack },
        closeFallbackBufferMs: 50,
    },
    inline: {
        surface: noMotionTrack,
        reducedMotion: { surface: noMotionTrack },
        closeFallbackBufferMs: 0,
    },
};

export function getDefaultSurfaceMotionProfile(profile: SurfaceProfile): SurfaceMotionProfile {
    return defaultMotionProfiles[profile];
}

export type SurfaceValueBinding<T> = {
    currentValue: T;
    apply: (value: T) => void;
    equals?: (current: T, next: T) => boolean;
};

export type SurfacePositioner = {
    update: (profile: ResponsiveProfile | null) => void;
    destroy: () => void;
};

export type SurfaceEscapeScopeOptions = {
    root: HTMLElement;
    keydownTarget?: EventTarget;
    onEscape: () => void;
    trapTabWithin?: HTMLElement;
    stopPropagationAll?: boolean;
    ignoreEscapeWhileComposing?: boolean;
    maintainFocus?: boolean;
    capture?: boolean;
    focusFallback?: () => HTMLElement | null;
};

export type SurfaceOutsideDismissOptions = {
    eventTarget: EventTarget;
    roots?: ReadonlyArray<HTMLElement | null | undefined> | (() => ReadonlyArray<HTMLElement | null | undefined>);
    onDismiss: (event: Event) => void;
    shouldDismiss?: (event: Event) => boolean;
};

export type SurfaceSessionOptions<Appearance, Locale> = {
    profile: SurfaceProfile;
    responsiveProfile?: ResponsiveProfile;
    motionProfile: SurfaceMotionProfile;
    appearance?: SurfaceValueBinding<Appearance>;
    locale?: SurfaceValueBinding<Locale>;
};

export type SurfaceMotionElements = {
    surface: HTMLElement;
    backdrop?: HTMLElement | null;
};

export class SurfaceSession<Appearance = never, Locale = never> {
    readonly profile: SurfaceProfile;
    readonly responsiveProfile: ResponsiveProfile | null;
    readonly motionProfile: SurfaceMotionProfile;

    private appearanceBinding: SurfaceValueBinding<Appearance> | null;
    private localeBinding: SurfaceValueBinding<Locale> | null;
    private readonly focusLifecycle = new SurfaceFocusLifecycle();
    private keyboardHandle: DialogKeyboardScopeHandle | null = null;
    private outsideDismissHandle: TransientOutsideDismissBoundaryHandle | null = null;
    private positioner: SurfacePositioner | null = null;
    private closingElements: SurfaceMotionElements | null = null;
    private destroyed = false;

    constructor(options: SurfaceSessionOptions<Appearance, Locale>) {
        this.profile = options.profile;
        this.responsiveProfile = options.responsiveProfile ?? null;
        this.motionProfile = options.motionProfile;
        this.appearanceBinding = options.appearance ?? null;
        this.localeBinding = options.locale ?? null;
    }

    setAppearance(value: Appearance): boolean {
        return this.applyValue(this.appearanceBinding, value);
    }

    setLocale(value: Locale): boolean {
        return this.applyValue(this.localeBinding, value);
    }

    captureFocus(opener?: HTMLElement | null): void {
        if (this.destroyed) return;
        this.focusLifecycle.capture(opener);
    }

    scheduleInitialFocus(params: {
        surface: HTMLElement | null | undefined;
        selectors?: string[];
    }): void {
        if (this.destroyed) return;
        const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches ?? false;
        const track = reducedMotion ? this.motionProfile.reducedMotion.surface : this.motionProfile.surface;
        this.focusLifecycle.scheduleInitialFocus({
            ...params,
            delayMs: track.open.durationMs,
        });
    }

    restoreFocus(fallbackRoot?: ParentNode | null): void {
        if (this.destroyed) return;
        this.focusLifecycle.restore(fallbackRoot);
    }

    syncEscapeScope(options: SurfaceEscapeScopeOptions): void {
        if (this.destroyed) return;
        this.clearEscapeScope();
        this.keyboardHandle = attachDialogKeyboardScope(options);
    }

    clearEscapeScope(): void {
        this.keyboardHandle?.detach();
        this.keyboardHandle = null;
    }

    syncOutsideDismiss(options: SurfaceOutsideDismissOptions): void {
        if (this.destroyed) return;
        this.clearOutsideDismiss();
        this.outsideDismissHandle = installTransientOutsideDismissBoundary({
            eventTarget: options.eventTarget,
            roots: options.roots,
            onDismiss: (event) => {
                if (options.shouldDismiss && !options.shouldDismiss(event)) return;
                options.onDismiss(event);
            },
        });
    }

    clearOutsideDismiss(): void {
        this.outsideDismissHandle?.detach();
        this.outsideDismissHandle = null;
    }

    syncPositioner(positioner: SurfacePositioner | null): void {
        if (this.destroyed || positioner === this.positioner) return;
        this.positioner?.destroy();
        this.positioner = positioner;
        this.position();
    }

    position(): void {
        if (this.destroyed) return;
        this.positioner?.update(this.responsiveProfile);
    }

    clearPositioner(): void {
        this.positioner?.destroy();
        this.positioner = null;
    }

    open(elements: SurfaceMotionElements): void {
        if (this.destroyed) return;
        this.cancelClose();
        const tracks = this.resolveMotionTracks();
        this.applyResolvedMotion(elements, tracks);
        setSurfaceMotionOpening([elements.backdrop, elements.surface], {
            resolveTiming: (element) => {
                const track = element === elements.backdrop ? tracks.backdrop : tracks.surface;
                return track?.open ?? null;
            },
        });
    }

    syncMotion(elements: SurfaceMotionElements): void {
        if (this.destroyed) return;
        const tracks = this.resolveMotionTracks();
        this.applyResolvedMotion(elements, tracks);
    }

    close(params: SurfaceMotionElements & { onClosed: () => void }): boolean {
        if (this.destroyed) return false;
        const tracks = this.resolveMotionTracks();
        this.applyResolvedMotion(params, tracks);

        const started = beginSurfaceMotionClose({
            shell: params.surface,
            backdrop: params.backdrop,
            fallbackMs: tracks.surface.close.durationMs + this.motionProfile.closeFallbackBufferMs,
            onClosed: () => {
                this.closingElements = null;
                params.onClosed();
            },
        });
        if (started) {
            this.closingElements = { surface: params.surface, backdrop: params.backdrop };
        }
        return started;
    }

    cancelClose(): boolean {
        const closing = this.closingElements;
        if (!closing) return false;
        this.closingElements = null;
        return cancelSurfaceMotionClose({
            shell: closing.surface,
            backdrop: closing.backdrop,
        });
    }

    destroy(): void {
        if (this.destroyed) return;
        this.destroyed = true;
        this.clearEscapeScope();
        this.clearOutsideDismiss();
        this.clearPositioner();
        this.cancelClose();
        this.focusLifecycle.clear();
        this.appearanceBinding = null;
        this.localeBinding = null;
    }

    private applyValue<T>(binding: SurfaceValueBinding<T> | null, value: T): boolean {
        if (this.destroyed || !binding) return false;
        const equals = binding.equals ?? Object.is;
        if (equals(binding.currentValue, value)) return false;
        binding.apply(value);
        binding.currentValue = value;
        return true;
    }

    private resolveMotionTracks(): { surface: SurfaceMotionTrack; backdrop?: SurfaceMotionTrack } {
        const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches ?? false;
        return reducedMotion ? this.motionProfile.reducedMotion : this.motionProfile;
    }

    private applyMotionTrack(element: HTMLElement, track: SurfaceMotionTrack): void {
        element.style.setProperty('--_surface-motion-open-duration', `${track.open.durationMs}ms`);
        element.style.setProperty('--_surface-motion-open-easing', track.open.easing);
        element.style.setProperty('--_surface-motion-close-duration', `${track.close.durationMs}ms`);
        element.style.setProperty('--_surface-motion-close-easing', track.close.easing);
    }

    private applyResolvedMotion(
        elements: SurfaceMotionElements,
        tracks: { surface: SurfaceMotionTrack; backdrop?: SurfaceMotionTrack },
    ): void {
        this.applyMotionTrack(elements.surface, tracks.surface);
        if (elements.backdrop && tracks.backdrop) {
            this.applyMotionTrack(elements.backdrop, tracks.backdrop);
        }
    }
}
