import { afterEach, describe, expect, it, vi } from 'vitest';
import { beginSurfaceMotionClose, setSurfaceMotionOpening } from '@/ui/content/components/motionLifecycle';

describe('motionLifecycle', () => {
    const originalRequestAnimationFrame = window.requestAnimationFrame;
    const originalCancelAnimationFrame = window.cancelAnimationFrame;

    afterEach(() => {
        window.requestAnimationFrame = originalRequestAnimationFrame;
        window.cancelAnimationFrame = originalCancelAnimationFrame;
        document.body.innerHTML = '';
        vi.restoreAllMocks();
    });

    it('waits two animation frames before promoting opening surfaces to their final visible state', () => {
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

        const panel = document.createElement('div');
        panel.className = 'panel-window';
        document.body.appendChild(panel);

        setSurfaceMotionOpening([panel]);

        expect(panel.dataset.motionState).toBe('opening');
        expect(panel.style.transition).toBe('none');
        expect(panel.style.transform).toBe('translate(-50%, -50%) scale(0.95)');

        callbacks.get(1)?.(0);

        expect(panel.dataset.motionState).toBe('opening');
        expect(panel.style.transition).toBe('none');

        callbacks.get(2)?.(16);

        expect(panel.dataset.motionState).toBe('open');
        expect(panel.style.transition).toContain('opacity 300ms');
        expect(panel.style.transform).toBe('translate(-50%, -50%) scale(1)');
    });

    it('cancels an in-flight opening transition before entering the shared closing pipeline', () => {
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

        const panel = document.createElement('div');
        panel.className = 'panel-window';
        document.body.appendChild(panel);

        setSurfaceMotionOpening([panel]);
        callbacks.get(1)?.(0);

        expect(panel.dataset.motionState).toBe('opening');

        beginSurfaceMotionClose({
            shell: panel,
            onClosed: () => {},
            fallbackMs: 1,
        });

        expect(window.cancelAnimationFrame).toHaveBeenCalled();
        expect(panel.dataset.motionState).toBe('closing');
        expect(panel.style.transition).toBe('');
    });

    it('uses a reduced-motion enter duration without scale overshoot', () => {
        vi.stubGlobal(
            'matchMedia',
            vi.fn((query: string) => ({
                matches: query === '(prefers-reduced-motion: reduce)',
                media: query,
                onchange: null,
                addListener: vi.fn(),
                removeListener: vi.fn(),
                addEventListener: vi.fn(),
                removeEventListener: vi.fn(),
                dispatchEvent: vi.fn(),
            })),
        );

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

        const panel = document.createElement('div');
        panel.className = 'panel-window';
        document.body.appendChild(panel);

        setSurfaceMotionOpening([panel]);
        callbacks.get(1)?.(0);
        callbacks.get(2)?.(16);

        expect(panel.style.transition).toContain('80ms linear');
        expect(panel.style.transform).toBe('translate(-50%, -50%) scale(1)');
    });
});
