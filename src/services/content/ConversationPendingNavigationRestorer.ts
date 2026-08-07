import type { ConversationNavigationPortV1 } from '../../contracts/conversationNavigation';
import type { ConversationContentSourceV1 } from '../../contracts/conversationContent';
import {
    clearPendingNavigation,
    isSamePageUrl,
    peekPendingNavigation,
    PENDING_NAVIGATION_EVENT,
    type PendingNavigation,
} from '../../drivers/content/bookmarks/navigation';
import { RouteWatcher } from '../../drivers/content/injection/routeWatcher';

type ConversationPendingNavigationRestorerOptions = Readonly<{
    navigation: ConversationNavigationPortV1;
    source: ConversationContentSourceV1;
    currentUrl?: () => string;
    intervalMs?: number;
}>;

/**
 * Replays a bookmark target after a ChatGPT SPA route becomes current.
 *
 * The pending payload remains in sessionStorage until the single canonical
 * navigation attempt finishes. This is important because ChatGPT can handle
 * a location assignment without rebuilding the content runtime.
 */
export class ConversationPendingNavigationRestorer {
    private readonly currentUrl: () => string;
    private readonly intervalMs: number;
    private routeWatcher: RouteWatcher | null = null;
    private pendingDeadlineTimer: number | null = null;
    private unsubscribeSource: (() => void) | null = null;
    private started = false;
    private running = false;

    constructor(
        private readonly options: ConversationPendingNavigationRestorerOptions,
    ) {
        this.currentUrl = options.currentUrl ?? (() => window.location.href);
        this.intervalMs = Math.max(50, Math.round(options.intervalMs ?? 500));
    }

    start(): void {
        if (this.started) return;
        this.started = true;
        window.addEventListener(PENDING_NAVIGATION_EVENT, this.handlePendingSignal);
        this.unsubscribeSource = this.options.source.subscribe(() => {
            this.armRouteWatcherIfNeeded();
            void this.tryRestore();
        });
        this.armRouteWatcherIfNeeded();
        void this.tryRestore();
    }

    dispose(): void {
        if (!this.started) return;
        this.started = false;
        window.removeEventListener(PENDING_NAVIGATION_EVENT, this.handlePendingSignal);
        this.unsubscribeSource?.();
        this.unsubscribeSource = null;
        this.stopRouteWatcher();
    }

    private readonly handlePendingSignal = (): void => {
        this.armRouteWatcherIfNeeded();
        void this.tryRestore();
    };

    private armRouteWatcherIfNeeded(): void {
        if (!this.started || this.routeWatcher || !peekPendingNavigation()) return;
        this.routeWatcher = new RouteWatcher(() => {
            void this.tryRestore();
        }, { intervalMs: this.intervalMs });
        this.routeWatcher.start();
        this.pendingDeadlineTimer = window.setTimeout(() => {
            if (!peekPendingNavigation()) return this.stopRouteWatcher();
            clearPendingNavigation();
            this.stopRouteWatcher();
        }, 15_000);
    }

    private stopRouteWatcher(): void {
        this.routeWatcher?.stop();
        this.routeWatcher = null;
        if (this.pendingDeadlineTimer !== null) {
            window.clearTimeout(this.pendingDeadlineTimer);
            this.pendingDeadlineTimer = null;
        }
    }

    private async tryRestore(): Promise<void> {
        if (!this.started || this.running) return;
        const pending = peekPendingNavigation();
        if (!pending || !isSamePageUrl(this.currentUrl(), pending.url)) {
            if (!pending) this.stopRouteWatcher();
            return;
        }

        this.running = true;
        try {
            // The route now matches; the navigation coordinator owns the
            // remaining bounded wait for source readiness/materialization.
            if (this.pendingDeadlineTimer !== null) {
                window.clearTimeout(this.pendingDeadlineTimer);
                this.pendingDeadlineTimer = null;
            }
            // Once the route matches, source/materialization events own the
            // bounded wait. Do not keep polling the URL while a navigation
            // attempt is pending or while a slow source may retry later.
            this.routeWatcher?.stop();
            this.routeWatcher = null;
            const result = await this.options.navigation.navigate({
                position: pending.position,
                messageId: pending.messageId,
                assistantMessageId: pending.messageId,
                source: 'pending-restore',
            }, { timeoutMs: 15_000, align: 'start' });
            if (result.ok || result.reason === 'cancelled' || result.reason === 'stale-target' || result.reason === 'identity-conflict' || result.reason === 'slot-missing') {
                // A successful or terminal attempt consumes the target. A
                // source/hydration timeout remains pending so the next real
                // source revision can retry after a slow page load.
                clearPendingNavigation();
                this.stopRouteWatcher();
            }
        } finally {
            this.running = false;
        }
    }
}

export type { PendingNavigation };
