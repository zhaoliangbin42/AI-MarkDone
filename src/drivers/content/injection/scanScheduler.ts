export type ScanReason =
    | 'init'
    | 'mutation'
    | 'route_change'
    | 'manual';

export type ScanFn = (reasons: Set<ScanReason>) => void;

type SchedulerOptions = {
    debounceMs: number;
    minIntervalMs: number;
    idleTimeoutMs: number;
    maxWaitMs: number;
};

/**
 * Stable scan scheduler for SPA DOMs.
 *
 * Why:
 * - MutationObserver streams "half-built" DOM; injecting immediately is flaky.
 * - Debounce + min-interval makes injection eventual-consistent and repeatable.
 */
export class ScanScheduler {
    private options: SchedulerOptions;
    private scanFn: ScanFn;
    private timer: number | null = null;
    private lastRunAt = 0;
    private pendingReasons = new Set<ScanReason>();
    private scheduledAt = 0;
    private firstPendingAt: number | null = null;
    private deferredHandles = new Map<number, 'idle' | 'timeout'>();
    private disposed = false;

    constructor(scanFn: ScanFn, options: SchedulerOptions) {
        this.scanFn = scanFn;
        this.options = options;
    }

    schedule(reason: ScanReason): void {
        if (this.disposed) return;
        this.pendingReasons.add(reason);
        const now = Date.now();
        if (this.firstPendingAt === null) {
            this.firstPendingAt = now;
        }
        const desiredAt = now + this.options.debounceMs;
        const earliestAt = this.lastRunAt + this.options.minIntervalMs;
        const latestAt = this.firstPendingAt + this.options.maxWaitMs;
        const runAt = Math.min(Math.max(desiredAt, earliestAt), latestAt);

        if (this.timer !== null) {
            if (runAt === this.scheduledAt) return;
            window.clearTimeout(this.timer);
            this.timer = null;
        }

        this.scheduledAt = runAt;
        this.timer = window.setTimeout(() => this.flush(), Math.max(0, runAt - now));
    }

    dispose(): void {
        this.disposed = true;
        if (this.timer !== null) {
            window.clearTimeout(this.timer);
            this.timer = null;
        }
        this.pendingReasons.clear();
        this.scheduledAt = 0;
        this.firstPendingAt = null;
        this.cancelDeferredRuns();
    }

    private flush(): void {
        if (this.disposed) return;
        this.timer = null;
        this.scheduledAt = 0;
        this.firstPendingAt = null;
        const reasons = new Set(this.pendingReasons);
        this.pendingReasons.clear();
        this.lastRunAt = Date.now();

        let deferredHandle: number | null = null;
        const run = () => {
            if (deferredHandle !== null) this.deferredHandles.delete(deferredHandle);
            if (this.disposed) return;
            this.scanFn(reasons);
        };

        const globalScope = (typeof window !== 'undefined' ? window : globalThis) as typeof globalThis & Window;
        const ric = (globalScope as any).requestIdleCallback as
            | ((cb: () => void, opts?: { timeout: number }) => number)
            | undefined;

        if (typeof ric === 'function') {
            let ranSynchronously = false;
            const runFromIdle = () => {
                ranSynchronously = true;
                run();
            };
            const handle = ric.call(globalScope, runFromIdle, { timeout: this.options.idleTimeoutMs });
            if (!ranSynchronously) {
                deferredHandle = handle;
                this.deferredHandles.set(handle, 'idle');
            }
        } else {
            deferredHandle = window.setTimeout(run, 0);
            this.deferredHandles.set(deferredHandle, 'timeout');
        }
    }

    private cancelDeferredRuns(): void {
        const cancelIdleCallback = (window as any).cancelIdleCallback as ((handle: number) => void) | undefined;
        for (const [handle, kind] of this.deferredHandles) {
            if (kind === 'idle') cancelIdleCallback?.call(window, handle);
            else window.clearTimeout(handle);
        }
        this.deferredHandles.clear();
    }
}
