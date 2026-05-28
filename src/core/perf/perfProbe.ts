export type PerfProbeFlags = {
    enabled: boolean;
    disableToolbar: boolean;
    disableWordCount: boolean;
    disableDirectory: boolean;
    disableSnapshotLiveRefresh: boolean;
    disableMutationObserver: boolean;
    disableReaderPreload: boolean;
};

type PerfEvent = {
    name: string;
    at: number;
    durationMs?: number;
    data?: Record<string, unknown>;
};

type PerfMetric = {
    count: number;
    totalMs: number;
    maxMs: number;
    samples: number[];
};

type PerfSummary = {
    enabled: boolean;
    flags: PerfProbeFlags;
    durationMs: number;
    events: number;
    metrics: Record<string, {
        count: number;
        totalMs: number;
        avgMs: number;
        maxMs: number;
        p95Ms: number;
    }>;
    counters: Record<string, number>;
    recent: PerfEvent[];
};

const REDACTED_DATA_KEYS = new Set(['conversationId', 'messageKey']);
const DEFAULT_FLAGS: PerfProbeFlags = {
    enabled: false,
    disableToolbar: false,
    disableWordCount: false,
    disableDirectory: false,
    disableSnapshotLiveRefresh: false,
    disableMutationObserver: false,
    disableReaderPreload: false,
};

const MAX_EVENTS = 500;
const MAX_SAMPLES = 200;

let startAt = now();
let events: PerfEvent[] = [];
let metrics = new Map<string, PerfMetric>();
let counters = new Map<string, number>();
let overrides: Partial<PerfProbeFlags> = {};
let longTaskObserver: PerformanceObserver | null = null;
let messageBridgeInstalled = false;

function now(): number {
    try {
        return performance.now();
    } catch {
        return Date.now();
    }
}

function readBooleanStorage(key: string): boolean | null {
    try {
        if (typeof localStorage === 'undefined') return null;
        const value = localStorage.getItem(key);
        if (value === '1' || value === 'true') return true;
        if (value === '0' || value === 'false') return false;
    } catch {
        // Debug controls must never affect runtime behavior.
    }
    return null;
}

function readStorageFlags(): Partial<PerfProbeFlags> {
    try {
        if (typeof localStorage === 'undefined') return {};
        const raw = localStorage.getItem('aimd:perf:flags');
        if (!raw) return {};
        const parsed = JSON.parse(raw) as Record<string, unknown>;
        const next: Partial<PerfProbeFlags> = {};
        for (const key of Object.keys(DEFAULT_FLAGS) as Array<keyof PerfProbeFlags>) {
            if (typeof parsed[key] === 'boolean') next[key] = parsed[key];
        }
        return next;
    } catch {
        return {};
    }
}

function readGlobalFlags(): Partial<PerfProbeFlags> {
    try {
        const globalFlags = (globalThis as any).__AIMD_PERF_FLAGS__;
        if (!globalFlags || typeof globalFlags !== 'object') return {};
        const next: Partial<PerfProbeFlags> = {};
        for (const key of Object.keys(DEFAULT_FLAGS) as Array<keyof PerfProbeFlags>) {
            if (typeof globalFlags[key] === 'boolean') next[key] = globalFlags[key];
        }
        return next;
    } catch {
        return {};
    }
}

export function getPerfFlags(): PerfProbeFlags {
    const globalEnabled = (() => {
        try {
            return typeof (globalThis as any).__AIMD_PERF_ENABLED__ === 'boolean'
                ? Boolean((globalThis as any).__AIMD_PERF_ENABLED__)
                : null;
        } catch {
            return null;
        }
    })();
    const storageEnabled = readBooleanStorage('aimd:perf');
    const legacyDebug = readBooleanStorage('aimd:debug') ?? readBooleanStorage('aimd_debug');
    return {
        ...DEFAULT_FLAGS,
        enabled: globalEnabled ?? storageEnabled ?? legacyDebug ?? DEFAULT_FLAGS.enabled,
        ...readStorageFlags(),
        ...readGlobalFlags(),
        ...overrides,
    };
}

export function isPerfEnabled(): boolean {
    return getPerfFlags().enabled;
}

function pushEvent(event: PerfEvent): void {
    if (!isPerfEnabled()) return;
    events.push(redactEvent(event));
    if (events.length > MAX_EVENTS) events = events.slice(events.length - MAX_EVENTS);
}

function redactEvent(event: PerfEvent): PerfEvent {
    if (!event.data) return event;
    const data: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(event.data)) {
        data[key] = REDACTED_DATA_KEYS.has(key) ? '[redacted]' : value;
    }
    return { ...event, data };
}

export function perfCount(name: string, amount = 1, data?: Record<string, unknown>): void {
    if (!isPerfEnabled()) return;
    counters.set(name, (counters.get(name) ?? 0) + amount);
    pushEvent({ name, at: now(), data: { count: amount, ...data } });
}

export function perfMark(name: string, data?: Record<string, unknown>): void {
    pushEvent({ name, at: now(), data });
}

export function perfMeasure(name: string, durationMs: number, data?: Record<string, unknown>): void {
    if (!isPerfEnabled()) return;
    const metric = metrics.get(name) ?? { count: 0, totalMs: 0, maxMs: 0, samples: [] };
    metric.count += 1;
    metric.totalMs += durationMs;
    metric.maxMs = Math.max(metric.maxMs, durationMs);
    metric.samples.push(durationMs);
    if (metric.samples.length > MAX_SAMPLES) metric.samples = metric.samples.slice(metric.samples.length - MAX_SAMPLES);
    metrics.set(name, metric);
    pushEvent({ name, at: now(), durationMs, data });
}

export function perfSpan<T>(name: string, data: Record<string, unknown> | undefined, fn: () => T): T {
    if (!isPerfEnabled()) return fn();
    const startedAt = now();
    try {
        return fn();
    } finally {
        perfMeasure(name, now() - startedAt, data);
    }
}

export async function perfSpanAsync<T>(name: string, data: Record<string, unknown> | undefined, fn: () => Promise<T>): Promise<T> {
    if (!isPerfEnabled()) return fn();
    const startedAt = now();
    try {
        return await fn();
    } finally {
        perfMeasure(name, now() - startedAt, data);
    }
}

function percentile95(samples: number[]): number {
    if (samples.length === 0) return 0;
    const sorted = [...samples].sort((a, b) => a - b);
    const index = Math.min(sorted.length - 1, Math.ceil(sorted.length * 0.95) - 1);
    return sorted[index] ?? 0;
}

export function perfSummary(): PerfSummary {
    const metricSummary: PerfSummary['metrics'] = {};
    for (const [name, metric] of metrics.entries()) {
        metricSummary[name] = {
            count: metric.count,
            totalMs: Number(metric.totalMs.toFixed(2)),
            avgMs: Number((metric.totalMs / Math.max(1, metric.count)).toFixed(2)),
            maxMs: Number(metric.maxMs.toFixed(2)),
            p95Ms: Number(percentile95(metric.samples).toFixed(2)),
        };
    }
    return {
        enabled: isPerfEnabled(),
        flags: getPerfFlags(),
        durationMs: Number((now() - startAt).toFixed(2)),
        events: events.length,
        metrics: metricSummary,
        counters: Object.fromEntries(counters.entries()),
        recent: events.slice(-40),
    };
}

export function perfReset(): void {
    startAt = now();
    events = [];
    metrics = new Map();
    counters = new Map();
}

export function configurePerfProbe(next: Partial<PerfProbeFlags>): PerfProbeFlags {
    overrides = { ...overrides, ...next };
    if (typeof next.enabled === 'boolean') {
        try {
            (globalThis as any).__AIMD_PERF_ENABLED__ = next.enabled;
        } catch {
            // ignore
        }
    }
    return getPerfFlags();
}

export function installLongTaskProbe(): void {
    if (longTaskObserver || typeof PerformanceObserver === 'undefined') return;
    try {
        longTaskObserver = new PerformanceObserver((list) => {
            for (const entry of list.getEntries()) {
                perfMeasure('longtask', entry.duration, { startTime: Number(entry.startTime.toFixed(2)) });
            }
        });
        longTaskObserver.observe({ type: 'longtask', buffered: true } as PerformanceObserverInit);
    } catch {
        longTaskObserver = null;
    }
}

export function installPerfProbeGlobal(): void {
    try {
        const api = {
            configure: configurePerfProbe,
            enable: () => configurePerfProbe({ enabled: true }),
            disable: () => configurePerfProbe({ enabled: false }),
            flags: getPerfFlags,
            reset: perfReset,
            summary: perfSummary,
            export: () => JSON.stringify(perfSummary(), null, 2),
        };
        (globalThis as any).__AIMD_PERF__ = api;
        installPerfProbeMessageBridge();
    } catch {
        // ignore
    }
}

function installPerfProbeMessageBridge(): void {
    if (messageBridgeInstalled || typeof window === 'undefined') return;
    messageBridgeInstalled = true;
    window.addEventListener('message', (event) => {
        const data = event.data;
        if (!data || typeof data !== 'object') return;
        if ((data as any).source !== 'aimd:perf') return;
        const command = (data as any).command;
        const canUseBridge = isPerfEnabled();
        if (!canUseBridge) return;
        if (command === 'enable') configurePerfProbe({ enabled: true });
        if (command === 'disable') configurePerfProbe({ enabled: false });
        if (command === 'reset') perfReset();
        if (command === 'configure' && (data as any).flags && typeof (data as any).flags === 'object') {
            configurePerfProbe((data as any).flags as Partial<PerfProbeFlags>);
        }
        if (command === 'summary' || command === 'export' || command === 'enable' || command === 'disable' || command === 'reset' || command === 'configure') {
            window.postMessage({
                source: 'aimd:perf',
                command: `${command}:response`,
                summary: perfSummary(),
            }, '*');
        }
    });
}
