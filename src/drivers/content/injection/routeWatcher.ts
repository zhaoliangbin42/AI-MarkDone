export type RouteChangeListener = (nextUrl: string, prevUrl: string) => void;

type RouteWatcherOptions = {
    intervalMs: number;
};

/**
 * Content scripts run in an isolated world; patching history.pushState is unreliable.
 * A small poll + popstate/hashchange listener is stable across SPA frameworks.
 */
export class RouteWatcher {
    private onChange: RouteChangeListener;
    private options: RouteWatcherOptions;
    private timer: number | null = null;
    private lastUrl: string = '';
    private popstateHandler: ((e: PopStateEvent) => void) | null = null;
    private hashchangeHandler: ((e: HashChangeEvent) => void) | null = null;

    constructor(onChange: RouteChangeListener, options: RouteWatcherOptions) {
        this.onChange = onChange;
        this.options = options;
        this.lastUrl = window.location.href;
    }

    start(): void {
        if (this.timer !== null) return;

        this.popstateHandler = () => this.checkNow();
        this.hashchangeHandler = () => this.checkNow();
        window.addEventListener('popstate', this.popstateHandler);
        window.addEventListener('hashchange', this.hashchangeHandler);

        this.timer = window.setInterval(() => this.checkNow(), this.options.intervalMs);
    }

    stop(): void {
        if (this.timer !== null) {
            window.clearInterval(this.timer);
            this.timer = null;
        }
        if (this.popstateHandler) {
            window.removeEventListener('popstate', this.popstateHandler);
            this.popstateHandler = null;
        }
        if (this.hashchangeHandler) {
            window.removeEventListener('hashchange', this.hashchangeHandler);
            this.hashchangeHandler = null;
        }
    }

    private checkNow(): void {
        const next = window.location.href;
        if (next === this.lastUrl) return;
        const prev = this.lastUrl;
        this.lastUrl = next;
        this.onChange(next, prev);
    }
}

