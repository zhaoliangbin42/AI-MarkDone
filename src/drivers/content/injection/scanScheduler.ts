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

    constructor(scanFn: ScanFn, options: SchedulerOptions) {
        this.scanFn = scanFn;
        this.options = options;
    }

    schedule(reason: ScanReason): void {
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
        if (this.timer !== null) {
            window.clearTimeout(this.timer);
            this.timer = null;
        }
        this.pendingReasons.clear();
        this.scheduledAt = 0;
        this.firstPendingAt = null;
    }

    private flush(): void {
        this.timer = null;
        this.scheduledAt = 0;
        this.firstPendingAt = null;
        const reasons = new Set(this.pendingReasons);
        this.pendingReasons.clear();
        this.lastRunAt = Date.now();

        const run = () => this.scanFn(reasons);

        const globalScope = (typeof window !== 'undefined' ? window : globalThis) as typeof globalThis & Window;
        const ric = (globalScope as any).requestIdleCallback as
            | ((cb: () => void, opts?: { timeout: number }) => number)
            | undefined;

        if (typeof ric === 'function') {
            ric(run, { timeout: this.options.idleTimeoutMs });
        } else {
            window.setTimeout(run, 0);
        }
    }
}
