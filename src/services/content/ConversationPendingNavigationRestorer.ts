import type { ConversationNavigationPortV1, ConversationNavigationResultV1 } from '../../contracts/conversationNavigation';
import { createConversationDocumentKeyV1, type ConversationContentSourceV1 } from '../../contracts/conversationContent';
import { getChatGPTConversationId } from '../../contracts/chatgptConversationId';
import {
    clearPendingNavigation,
    isSameChatGPTConversationUrl,
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
    onUnavailable?: (result: ConversationNavigationResultV1, pending: PendingNavigation) => void;
}>;

const PENDING_TIMEOUT_MS = 15_000;

type PendingNavigationAttempt = {
    pending: PendingNavigation;
    controller: AbortController;
    deadlineMs: number;
    deadlineTimer: number | null;
    navigating: boolean;
    releaseUserInput: () => void;
};

function matchesPending(left: PendingNavigation | null, right: PendingNavigation): boolean {
    return Boolean(left && left.url === right.url && left.position === right.position
        && (left.messageId ?? null) === (right.messageId ?? null));
}

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
    private unsubscribeSource: (() => void) | null = null;
    private started = false;
    private attempt: PendingNavigationAttempt | null = null;

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
        this.unsubscribeSource = this.options.source.subscribe(() => this.tryRestore());
        this.tryRestore();
    }

    dispose(): void {
        if (!this.started) return;
        this.started = false;
        window.removeEventListener(PENDING_NAVIGATION_EVENT, this.handlePendingSignal);
        this.unsubscribeSource?.();
        this.unsubscribeSource = null;
        if (this.attempt) this.finishAttempt(this.attempt, { ok: false, reason: 'cancelled' });
        this.stopRouteWatcher();
    }

    private readonly handlePendingSignal = (): void => {
        this.tryRestore(true);
    };

    private armRouteWatcherIfNeeded(): void {
        if (!this.started || this.routeWatcher || !this.attempt) return;
        this.routeWatcher = new RouteWatcher(() => this.tryRestore(), { intervalMs: this.intervalMs });
        this.routeWatcher.start();
    }

    private stopRouteWatcher(): void {
        this.routeWatcher?.stop();
        this.routeWatcher = null;
    }

    private tryRestore(replace = false): void {
        if (!this.started) return;
        const pending = peekPendingNavigation();
        if (this.attempt && (replace || !matchesPending(pending, this.attempt.pending))) {
            this.releaseAttempt(this.attempt, 'cancelled');
        }
        if (!pending) {
            this.stopRouteWatcher();
            return;
        }

        let attempt = this.attempt;
        if (!attempt) {
            attempt = {
                pending,
                controller: new AbortController(),
                deadlineMs: Date.now() + PENDING_TIMEOUT_MS,
                deadlineTimer: null,
                navigating: false,
                releaseUserInput: () => undefined,
            };
            this.attempt = attempt;
            const captured = attempt;
            const cancelForUser = () => this.finishAttempt(captured, { ok: false, reason: 'cancelled' });
            const events: Array<keyof DocumentEventMap> = ['pointerdown', 'keydown', 'wheel', 'touchstart'];
            for (const event of events) document.addEventListener(event, cancelForUser, { capture: true, passive: true });
            attempt.releaseUserInput = () => {
                for (const event of events) document.removeEventListener(event, cancelForUser, { capture: true });
            };
            attempt.deadlineTimer = window.setTimeout(() => {
                this.finishAttempt(captured, { ok: false, reason: 'hydration-timeout' });
            }, PENDING_TIMEOUT_MS);
        }
        if (attempt.navigating) return;
        if (Date.now() >= attempt.deadlineMs) {
            this.finishAttempt(attempt, { ok: false, reason: 'hydration-timeout' });
            return;
        }
        if (!(isSameChatGPTConversationUrl(this.currentUrl(), pending.url) || isSamePageUrl(this.currentUrl(), pending.url))) {
            this.armRouteWatcherIfNeeded();
            return;
        }
        const conversationId = getChatGPTConversationId(pending.url);
        const documentKey = conversationId ? createConversationDocumentKeyV1('chatgpt', conversationId) : null;
        // The router may publish its URL before the active content pool switches.
        if (documentKey && this.options.source.read().document?.key !== documentKey) {
            this.armRouteWatcherIfNeeded();
            return;
        }
        this.stopRouteWatcher();
        if (!pending.messageId) {
            this.finishAttempt(attempt, { ok: false, reason: 'source-unavailable' });
            return;
        }
        attempt.navigating = true;
        void this.navigate(attempt);
    }

    private async navigate(attempt: PendingNavigationAttempt): Promise<void> {
        const { pending } = attempt;
        const conversationId = getChatGPTConversationId(pending.url);
        let result: ConversationNavigationResultV1;
        try {
            // The coordinator keeps its source subscription within this intent's
            // remaining deadline; later source revisions cannot start a new intent.
            result = await this.options.navigation.navigate({
                ...(conversationId ? {
                    documentKey: createConversationDocumentKeyV1('chatgpt', conversationId),
                } : {}),
                position: pending.position,
                messageId: pending.messageId,
                assistantMessageId: pending.messageId,
                source: 'bookmark',
            }, {
                signal: attempt.controller.signal,
                deadlineMs: attempt.deadlineMs,
                timeoutMs: Math.max(1, attempt.deadlineMs - Date.now()),
                align: 'start',
            });
        } catch {
            result = { ok: false, reason: 'source-unavailable' };
        }
        this.finishAttempt(attempt, result);
    }

    private finishAttempt(attempt: PendingNavigationAttempt, result: ConversationNavigationResultV1): void {
        if (this.attempt !== attempt) return;
        const ownsPending = matchesPending(peekPendingNavigation(), attempt.pending);
        if (ownsPending) clearPendingNavigation();
        this.releaseAttempt(attempt, result.ok ? 'completed' : result.reason);
        if (ownsPending && this.started && !result.ok && result.reason !== 'cancelled' && result.reason !== 'stale-target') {
            this.options.onUnavailable?.(result, attempt.pending);
        }
        if (!ownsPending) this.tryRestore();
    }

    private releaseAttempt(attempt: PendingNavigationAttempt, reason: string): void {
        if (this.attempt !== attempt) return;
        this.attempt = null;
        attempt.releaseUserInput();
        if (attempt.deadlineTimer !== null) window.clearTimeout(attempt.deadlineTimer);
        this.stopRouteWatcher();
        attempt.controller.abort(reason);
    }
}

export type { PendingNavigation };
