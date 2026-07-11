import { logger } from '../../../core/logger';

export type RouteChangeListener = (nextUrl: string, prevUrl: string) => void;

type RouteWatcherOptions = {
    intervalMs: number;
};

type RouteSubscription = {
    listener: RouteChangeListener;
    intervalMs: number;
};

const subscriptions = new Set<RouteSubscription>();
let sharedTimer: number | null = null;
let sharedIntervalMs: number | null = null;
let sharedLastUrl = '';

function checkSharedRoute(): void {
    const next = window.location.href;
    if (next === sharedLastUrl) return;
    const prev = sharedLastUrl;
    sharedLastUrl = next;
    for (const subscription of Array.from(subscriptions)) {
        try {
            subscription.listener(next, prev);
        } catch (error) {
            logger.warn('[AI-MarkDone][RouteWatcher] Route subscriber failed', error);
        }
    }
}

const handlePopstate = (): void => checkSharedRoute();
const handleHashchange = (): void => checkSharedRoute();

function syncSharedTimer(): void {
    const nextInterval = subscriptions.size > 0
        ? Math.min(...Array.from(subscriptions, (subscription) => subscription.intervalMs))
        : null;
    if (nextInterval === sharedIntervalMs && sharedTimer !== null) return;

    if (sharedTimer !== null) {
        window.clearInterval(sharedTimer);
        sharedTimer = null;
    }
    sharedIntervalMs = nextInterval;
    if (nextInterval !== null) {
        sharedTimer = window.setInterval(checkSharedRoute, nextInterval);
    }
}

function addSharedSubscription(subscription: RouteSubscription): void {
    if (subscriptions.has(subscription)) return;
    const wasEmpty = subscriptions.size === 0;
    subscriptions.add(subscription);
    if (wasEmpty) {
        sharedLastUrl = window.location.href;
        window.addEventListener('popstate', handlePopstate);
        window.addEventListener('hashchange', handleHashchange);
    }
    syncSharedTimer();
}

function removeSharedSubscription(subscription: RouteSubscription): void {
    if (!subscriptions.delete(subscription)) return;
    syncSharedTimer();
    if (subscriptions.size > 0) return;

    window.removeEventListener('popstate', handlePopstate);
    window.removeEventListener('hashchange', handleHashchange);
    sharedLastUrl = '';
}

/**
 * Content scripts run in an isolated world; patching history.pushState is unreliable.
 * A small poll + popstate/hashchange listener is stable across SPA frameworks.
 */
export class RouteWatcher {
    private readonly subscription: RouteSubscription;
    private started = false;

    constructor(onChange: RouteChangeListener, options: RouteWatcherOptions) {
        const requestedInterval = Number.isFinite(options.intervalMs)
            ? Math.round(options.intervalMs)
            : 500;
        this.subscription = {
            listener: onChange,
            intervalMs: Math.max(50, requestedInterval),
        };
    }

    start(): void {
        if (this.started) return;
        this.started = true;
        addSharedSubscription(this.subscription);
    }

    stop(): void {
        if (!this.started) return;
        this.started = false;
        removeSharedSubscription(this.subscription);
    }
}
