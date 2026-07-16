import { describe, expect, it, vi } from 'vitest';

import {
    SurfaceSession,
    getDefaultSurfaceMotionProfile,
    type ResponsiveProfile,
    type SurfaceMotionProfile,
} from '@/ui/content/components/SurfaceRuntime';
import { getPanelMotionCss } from '@/ui/content/components/styles/panelMotionCss';
import { getModalMotionCss } from '@/ui/content/components/styles/modalMotionCss';
import { getSharedBackdropMotionCss } from '@/ui/content/components/styles/sharedBackdropMotionCss';

const responsiveProfile: ResponsiveProfile = {
    viewportGutterPx: 12,
    collision: 'flip-clamp',
    scrollOwner: 'surface',
    narrowFallback: 'compact',
};

const motionProfile: SurfaceMotionProfile = {
    surface: {
        open: { durationMs: 180, easing: 'ease-out' },
        close: { durationMs: 140, easing: 'ease-in' },
    },
    backdrop: {
        open: { durationMs: 120, easing: 'ease-out' },
        close: { durationMs: 100, easing: 'ease-in' },
    },
    reducedMotion: {
        surface: {
            open: { durationMs: 80, easing: 'linear' },
            close: { durationMs: 80, easing: 'linear' },
        },
        backdrop: {
            open: { durationMs: 80, easing: 'linear' },
            close: { durationMs: 80, easing: 'linear' },
        },
    },
    closeFallbackBufferMs: 40,
};

describe('SurfaceSession', () => {
    it('keeps inline surfaces motionless in both default and reduced-motion modes', () => {
        const inlineMotion = getDefaultSurfaceMotionProfile('inline');

        expect(inlineMotion.surface.open.durationMs).toBe(0);
        expect(inlineMotion.surface.close.durationMs).toBe(0);
        expect(inlineMotion.reducedMotion.surface.open.durationMs).toBe(0);
        expect(inlineMotion.reducedMotion.surface.close.durationMs).toBe(0);
    });

    it('opens an inline surface synchronously without scheduling animation frames', () => {
        const requestAnimationFrame = vi.spyOn(window, 'requestAnimationFrame');
        const surface = document.createElement('div');
        document.body.appendChild(surface);
        const session = new SurfaceSession({
            profile: 'inline',
            motionProfile: getDefaultSurfaceMotionProfile('inline'),
        });

        try {
            session.open({ surface });

            expect(surface.dataset.motionState).toBe('open');
            expect(requestAnimationFrame).not.toHaveBeenCalled();
        } finally {
            session.destroy();
            surface.remove();
            requestAnimationFrame.mockRestore();
        }
    });

    it('owns profile metadata and applies appearance and locale only when their values change', () => {
        const applyAppearance = vi.fn();
        const applyLocale = vi.fn();
        const session = new SurfaceSession({
            profile: 'anchored',
            responsiveProfile,
            motionProfile,
            appearance: {
                currentValue: 'light',
                apply: applyAppearance,
            },
            locale: {
                currentValue: 'en',
                apply: applyLocale,
            },
        });

        expect(session.profile).toBe('anchored');
        expect(session.responsiveProfile).toBe(responsiveProfile);
        expect(session.setAppearance('light')).toBe(false);
        expect(session.setAppearance('dark')).toBe(true);
        expect(session.setLocale('en')).toBe(false);
        expect(session.setLocale('zh-CN')).toBe(true);
        expect(applyAppearance).toHaveBeenCalledTimes(1);
        expect(applyAppearance).toHaveBeenCalledWith('dark');
        expect(applyLocale).toHaveBeenCalledTimes(1);
        expect(applyLocale).toHaveBeenCalledWith('zh-CN');

        session.destroy();
        expect(session.setAppearance('light')).toBe(false);
        expect(session.setLocale('en')).toBe(false);
    });

    it('retains the last applied value when an appearance update fails so the update can be retried', () => {
        const applyAppearance = vi.fn()
            .mockImplementationOnce(() => {
                throw new Error('style scope unavailable');
            })
            .mockImplementationOnce(() => undefined);
        const session = new SurfaceSession({
            profile: 'inline',
            motionProfile: getDefaultSurfaceMotionProfile('inline'),
            appearance: {
                currentValue: 'light',
                apply: applyAppearance,
            },
        });

        expect(() => session.setAppearance('dark')).toThrow('style scope unavailable');
        expect(session.setAppearance('dark')).toBe(true);
        expect(applyAppearance).toHaveBeenCalledTimes(2);

        session.destroy();
    });

    it('captures, schedules, and restores focus using the session motion profile', async () => {
        vi.useFakeTimers();
        const trigger = document.createElement('button');
        const surface = document.createElement('div');
        const action = document.createElement('button');
        surface.appendChild(action);
        document.body.append(trigger, surface);
        trigger.focus();

        const session = new SurfaceSession({
            profile: 'anchored',
            responsiveProfile,
            motionProfile,
        });

        try {
            session.captureFocus();
            session.scheduleInitialFocus({ surface });

            await vi.advanceTimersByTimeAsync(179);
            expect(document.activeElement).toBe(trigger);
            await vi.advanceTimersByTimeAsync(1);
            expect(document.activeElement).toBe(action);

            session.restoreFocus();
            expect(document.activeElement).toBe(trigger);
        } finally {
            session.destroy();
            trigger.remove();
            surface.remove();
            vi.useRealTimers();
        }
    });

    it('composes Escape, outside-dismiss, positioning, and releases every handle on destroy', () => {
        const root = document.createElement('div');
        const outside = document.createElement('button');
        document.body.append(root, outside);
        const onEscape = vi.fn();
        const onOutsideDismiss = vi.fn();
        const positioner = {
            update: vi.fn(),
            destroy: vi.fn(),
        };
        const session = new SurfaceSession({
            profile: 'anchored',
            responsiveProfile,
            motionProfile,
        });

        session.syncEscapeScope({ root, onEscape });
        session.syncOutsideDismiss({
            eventTarget: document,
            roots: [root],
            onDismiss: onOutsideDismiss,
        });
        session.syncPositioner(positioner);

        root.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
        root.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }));
        outside.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        expect(onOutsideDismiss).not.toHaveBeenCalled();

        outside.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }));
        outside.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        session.position();

        expect(onEscape).toHaveBeenCalledTimes(1);
        expect(onOutsideDismiss).toHaveBeenCalledTimes(1);
        expect(positioner.update).toHaveBeenNthCalledWith(1, responsiveProfile);
        expect(positioner.update).toHaveBeenCalledTimes(2);

        session.destroy();
        root.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
        outside.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }));
        outside.dispatchEvent(new MouseEvent('click', { bubbles: true }));

        expect(onEscape).toHaveBeenCalledTimes(1);
        expect(onOutsideDismiss).toHaveBeenCalledTimes(1);
        expect(positioner.destroy).toHaveBeenCalledTimes(1);

        root.remove();
        outside.remove();
    });

    it('handles Escape for an anchored surface without stealing focus from its composer', async () => {
        const composer = document.createElement('textarea');
        const host = document.createElement('div');
        const surfaceButton = document.createElement('button');
        host.appendChild(surfaceButton);
        document.body.append(composer, host);
        composer.focus();
        const onEscape = vi.fn();
        const session = new SurfaceSession({
            profile: 'anchored',
            responsiveProfile,
            motionProfile,
        });

        try {
            session.syncEscapeScope({
                root: host,
                onEscape,
                maintainFocus: false,
            });
            await Promise.resolve();

            expect(document.activeElement).toBe(composer);
            host.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
            expect(onEscape).toHaveBeenCalledTimes(1);
        } finally {
            session.destroy();
            composer.remove();
            host.remove();
        }
    });

    it('drives CSS motion variables and the JavaScript close fallback from one motion profile', async () => {
        vi.useFakeTimers();
        const backdrop = document.createElement('div');
        backdrop.className = 'panel-stage__overlay';
        const surface = document.createElement('div');
        surface.className = 'panel-window';
        document.body.append(backdrop, surface);
        const onClosed = vi.fn();
        const session = new SurfaceSession({
            profile: 'panel',
            responsiveProfile,
            motionProfile,
        });

        try {
            session.open({ surface, backdrop });

            expect(surface.style.getPropertyValue('--_surface-motion-open-duration')).toBe('180ms');
            expect(backdrop.style.getPropertyValue('--_surface-motion-open-duration')).toBe('120ms');
            expect(getPanelMotionCss()).toContain('var(--_surface-motion-close-duration, var(--aimd-duration-fast))');
            expect(getPanelMotionCss()).toContain('animation-duration: var(--_surface-motion-close-duration, 0s);');
            expect(getModalMotionCss()).toContain('animation-duration: var(--_surface-motion-close-duration, 0s);');
            expect(getSharedBackdropMotionCss()).toContain('var(--_surface-motion-close-duration, var(--aimd-duration-fast))');

            expect(session.close({ surface, backdrop, onClosed })).toBe(true);
            expect(surface.style.getPropertyValue('--_surface-motion-close-duration')).toBe('140ms');

            await vi.advanceTimersByTimeAsync(179);
            expect(onClosed).not.toHaveBeenCalled();
            await vi.advanceTimersByTimeAsync(1);
            expect(onClosed).toHaveBeenCalledTimes(1);
        } finally {
            session.destroy();
            backdrop.remove();
            surface.remove();
            vi.useRealTimers();
        }
    });

    it('opens an anchored surface without relying on a product-specific CSS class', () => {
        const originalRequestAnimationFrame = window.requestAnimationFrame;
        const originalCancelAnimationFrame = window.cancelAnimationFrame;
        const callbacks = new Map<number, FrameRequestCallback>();
        let nextId = 1;
        window.requestAnimationFrame = vi.fn((callback: FrameRequestCallback) => {
            const id = nextId++;
            callbacks.set(id, callback);
            return id;
        }) as typeof window.requestAnimationFrame;
        window.cancelAnimationFrame = vi.fn((id: number) => {
            callbacks.delete(id);
        }) as typeof window.cancelAnimationFrame;

        const surface = document.createElement('div');
        document.body.appendChild(surface);
        const session = new SurfaceSession({
            profile: 'anchored',
            responsiveProfile,
            motionProfile,
        });

        try {
            session.open({ surface });
            expect(surface.dataset.motionState).toBe('opening');

            callbacks.get(1)?.(0);
            callbacks.get(2)?.(16);

            expect(surface.dataset.motionState).toBe('open');
            expect(surface.style.transition).toContain('180ms ease-out');
            expect(surface.style.transform).toBe('none');
        } finally {
            session.destroy();
            surface.remove();
            window.requestAnimationFrame = originalRequestAnimationFrame;
            window.cancelAnimationFrame = originalCancelAnimationFrame;
        }
    });
});
