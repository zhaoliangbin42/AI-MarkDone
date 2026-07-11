import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RouteWatcher } from '@/drivers/content/injection/routeWatcher';
import { logger } from '@/core/logger';

describe('RouteWatcher shared page awareness', () => {
    const initialUrl = window.location.href;

    beforeEach(() => {
        vi.useFakeTimers();
        window.history.replaceState({}, '', '/c/route-watcher-start');
    });

    afterEach(() => {
        window.history.replaceState({}, '', initialUrl);
        vi.useRealTimers();
        vi.restoreAllMocks();
    });

    it('shares one polling timer and one browser-event listener pair across consumers', () => {
        const setInterval = vi.spyOn(window, 'setInterval');
        const addEventListener = vi.spyOn(window, 'addEventListener');
        const watchers = Array.from({ length: 3 }, () => new RouteWatcher(vi.fn(), { intervalMs: 500 }));

        try {
            watchers.forEach((watcher) => watcher.start());

            expect(setInterval).toHaveBeenCalledTimes(1);
            expect(addEventListener.mock.calls.filter(([type]) => type === 'popstate')).toHaveLength(1);
            expect(addEventListener.mock.calls.filter(([type]) => type === 'hashchange')).toHaveLength(1);
        } finally {
            watchers.forEach((watcher) => watcher.stop());
        }
    });

    it('delivers the same route transition to every active consumer', () => {
        const listeners = [vi.fn(), vi.fn(), vi.fn()];
        const watchers = listeners.map((listener) => new RouteWatcher(listener, { intervalMs: 500 }));

        try {
            watchers.forEach((watcher) => watcher.start());
            const previousUrl = window.location.href;
            window.history.pushState({}, '', '/c/route-watcher-next');
            vi.advanceTimersByTime(500);

            for (const listener of listeners) {
                expect(listener).toHaveBeenCalledWith(window.location.href, previousUrl);
            }
        } finally {
            watchers.forEach((watcher) => watcher.stop());
        }
    });

    it('keeps the shared watcher alive until the final consumer stops', () => {
        const clearInterval = vi.spyOn(window, 'clearInterval');
        const firstListener = vi.fn();
        const secondListener = vi.fn();
        const first = new RouteWatcher(firstListener, { intervalMs: 500 });
        const second = new RouteWatcher(secondListener, { intervalMs: 500 });

        first.start();
        second.start();
        first.stop();
        expect(clearInterval).not.toHaveBeenCalled();

        window.history.pushState({}, '', '/c/route-watcher-still-active');
        vi.advanceTimersByTime(500);
        expect(firstListener).not.toHaveBeenCalled();
        expect(secondListener).toHaveBeenCalledTimes(1);

        second.stop();
        expect(clearInterval).toHaveBeenCalledTimes(1);
    });

    it('isolates a failing route consumer from the remaining subscribers', () => {
        const warn = vi.spyOn(logger, 'warn').mockImplementation(() => {});
        const failing = new RouteWatcher(() => {
            throw new Error('consumer failed');
        }, { intervalMs: 500 });
        const healthyListener = vi.fn();
        const healthy = new RouteWatcher(healthyListener, { intervalMs: 500 });

        try {
            failing.start();
            healthy.start();
            const previousUrl = window.location.href;
            window.history.pushState({}, '', '/c/route-watcher-consumer-failure');

            expect(() => vi.advanceTimersByTime(500)).not.toThrow();
            expect(healthyListener).toHaveBeenCalledWith(window.location.href, previousUrl);
            expect(warn).toHaveBeenCalledWith(
                '[AI-MarkDone][RouteWatcher] Route subscriber failed',
                expect.any(Error),
            );
        } finally {
            failing.stop();
            healthy.stop();
        }
    });
});
