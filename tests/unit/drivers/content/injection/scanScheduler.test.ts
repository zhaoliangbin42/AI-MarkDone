import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ScanScheduler, type ScanReason } from '@/drivers/content/injection/scanScheduler';

describe('ScanScheduler', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        vi.setSystemTime(0);
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('flushes within maxWait during continuous rescheduling', () => {
        const received: Array<{ at: number; reasons: ScanReason[] }> = [];
        const scheduler = new ScanScheduler(
            (reasons) => {
                received.push({ at: Date.now(), reasons: Array.from(reasons).sort() });
            },
            { debounceMs: 120, minIntervalMs: 250, idleTimeoutMs: 200, maxWaitMs: 1000 }
        );

        for (let elapsed = 0; elapsed < 1000; elapsed += 50) {
            scheduler.schedule('mutation');
            vi.advanceTimersByTime(50);
        }

        vi.advanceTimersByTime(1);
        vi.runAllTimers();

        expect(received).toHaveLength(1);
        expect(received[0]?.at).toBeLessThanOrEqual(1001);
        expect(received[0]?.reasons).toEqual(['mutation']);
    });

    it('starts a new pending window after each flush', () => {
        const receivedAt: number[] = [];
        const scheduler = new ScanScheduler(
            () => {
                receivedAt.push(Date.now());
            },
            { debounceMs: 120, minIntervalMs: 250, idleTimeoutMs: 200, maxWaitMs: 1000 }
        );

        scheduler.schedule('mutation');
        vi.advanceTimersByTime(1000);
        vi.runOnlyPendingTimers();

        scheduler.schedule('mutation');
        vi.advanceTimersByTime(250);
        vi.runOnlyPendingTimers();

        expect(receivedAt).toHaveLength(2);
        expect(receivedAt[0]).toBeLessThanOrEqual(1000);
        expect(receivedAt[1]).toBeGreaterThan(receivedAt[0]);
    });

    it('still respects minInterval between flushes', () => {
        const receivedAt: number[] = [];
        const scheduler = new ScanScheduler(
            () => {
                receivedAt.push(Date.now());
            },
            { debounceMs: 120, minIntervalMs: 250, idleTimeoutMs: 200, maxWaitMs: 1000 }
        );

        scheduler.schedule('mutation');
        vi.advanceTimersByTime(120);
        vi.runOnlyPendingTimers();

        scheduler.schedule('manual');
        vi.advanceTimersByTime(250);
        vi.runOnlyPendingTimers();

        expect(receivedAt).toHaveLength(2);
        expect(receivedAt[1] - receivedAt[0]).toBeGreaterThanOrEqual(250);
    });

    it('merges reasons into a single flush', () => {
        const received: ScanReason[][] = [];
        const scheduler = new ScanScheduler(
            (reasons) => {
                received.push(Array.from(reasons).sort());
            },
            { debounceMs: 120, minIntervalMs: 250, idleTimeoutMs: 200, maxWaitMs: 1000 }
        );

        scheduler.schedule('mutation');
        vi.advanceTimersByTime(50);
        scheduler.schedule('route_change');
        vi.advanceTimersByTime(70);
        scheduler.schedule('manual');
        vi.advanceTimersByTime(880);
        vi.runOnlyPendingTimers();

        expect(received).toEqual([['manual', 'mutation', 'route_change']]);
    });

    it('does not flush after dispose', () => {
        const scanFn = vi.fn();
        const scheduler = new ScanScheduler(scanFn, {
            debounceMs: 120,
            minIntervalMs: 250,
            idleTimeoutMs: 200,
            maxWaitMs: 1000,
        });

        scheduler.schedule('mutation');
        scheduler.dispose();
        vi.runAllTimers();

        expect(scanFn).not.toHaveBeenCalled();
    });
});
