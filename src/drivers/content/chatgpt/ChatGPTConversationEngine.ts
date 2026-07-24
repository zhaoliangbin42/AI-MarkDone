import type { SiteAdapter } from '../adapters/base';
import { browserInfo } from '../../shared/browser';
import { decodeBridgeDetail, encodeBridgeRequest, type BridgeWireDetail } from './bridgeTransport';
import type {
    ChatGPTConversationRound,
    ChatGPTConversationSnapshot,
    ChatGPTConversationSnapshotCandidate,
} from './types';
import { RouteWatcher } from '../injection/routeWatcher';
import {
    getChatGPTConversationId as getConversationIdFromUrl,
    isChatGPTConversationPage,
} from './chatgptRoute';

const REQUEST_EVENT = 'aimd:chatgpt-conversation-bridge:request';
const RESPONSE_EVENT = 'aimd:chatgpt-conversation-bridge:response';
const CAPTURE_EVENT = 'aimd:chatgpt-conversation-bridge:capture';
const RESPONSE_TIMEOUT_MS = 2500;
const LIVE_REFRESH_INTERVAL_MS = 5000;
const REBUILD_RETRY_DELAYS_MS = [500, 1000, 2000, 4000];

type BridgeRequest =
    | {
        requestId: string;
        type: 'snapshot';
        conversationId: string;
        force?: boolean;
    };

type BridgeResponse = {
    requestId: string;
    ok: boolean;
    snapshot?: ChatGPTConversationSnapshotCandidate;
    error?: { code?: string; message?: string };
};

type SnapshotSubscriptionOptions = {
    live?: boolean;
};

type LiveDomReconciler = () => ChatGPTConversationSnapshot | null;

export class ChatGPTConversationEngine {
    private adapter: SiteAdapter;
    private initialized = false;
    private routeWatcher: RouteWatcher | null = null;
    private currentConversationId: string | null = null;
    private rebuildRetryTimer: number | null = null;
    private rebuildRetryCount = 0;
    private staleConversationIds = new Set<string>();
    private staleRevisionByConversation = new Map<string, number>();
    private snapshotByConversation = new Map<string, ChatGPTConversationSnapshot>();
    private liveDomTailBaseByConversation = new Map<string, ChatGPTConversationSnapshot>();
    private inFlightByConversation = new Map<string, {
        promise: Promise<ChatGPTConversationSnapshot | null>;
        staleRevision: number;
    }>();
    private requestGenerationByConversation = new Map<string, number>();
    private appliedGenerationByConversation = new Map<string, number>();
    private subscribers = new Set<(snapshot: ChatGPTConversationSnapshot | null) => void>();
    private liveDomReconciler: LiveDomReconciler | null = null;
    private liveRefreshTimer: number | null = null;
    private waitingForVisibleRebuild = false;
    private readonly handleVisibilityChange = () => {
        if (document.visibilityState !== 'visible') return;
        void this.refreshCurrentConversation({ force: true });
    };
    private readonly handleStaleVisibilityChange = () => {
        if (document.visibilityState !== 'visible') return;
        this.stopWaitingForVisibleRebuild();
        const conversationId = getConversationIdFromUrl(window.location.href);
        if (!conversationId || !this.staleConversationIds.has(conversationId)) return;
        void this.rebuildCurrentConversation();
    };
    private readonly handleBridgeCapture = (event: Event) => {
        const detail = decodeBridgeDetail<{ conversationId?: unknown }>((event as CustomEvent<unknown>).detail);
        const conversationId = typeof detail?.conversationId === 'string' ? detail.conversationId : null;
        if (!conversationId || conversationId !== getConversationIdFromUrl(window.location.href)) return;
        this.currentConversationId = conversationId;
        this.markConversationStale(conversationId);
        void this.rebuildCurrentConversation();
    };

    constructor(adapter: SiteAdapter) {
        this.adapter = adapter;
    }

    init(): void {
        if (this.adapter.getPlatformId() !== 'chatgpt') return;
        if (this.initialized) {
            this.handleRouteChange(window.location.href, window.location.href);
            return;
        }
        this.initialized = true;
        this.currentConversationId = getConversationIdFromUrl(window.location.href);
        window.addEventListener(CAPTURE_EVENT, this.handleBridgeCapture as EventListener);
        this.routeWatcher = new RouteWatcher((nextUrl, prevUrl) => this.handleRouteChange(nextUrl, prevUrl), { intervalMs: 500 });
        this.routeWatcher.start();

        if (!isChatGPTConversationPage(window.location.href)) return;

        const run = () => {
            this.markCurrentConversationStale();
            void this.rebuildCurrentConversation();
        };
        if (typeof window.requestIdleCallback === 'function') {
            window.requestIdleCallback.call(window, run, { timeout: 1500 });
        } else {
            window.setTimeout(run, 600);
        }
    }

    dispose(): void {
        this.routeWatcher?.stop();
        this.routeWatcher = null;
        if (this.rebuildRetryTimer !== null) {
            window.clearTimeout(this.rebuildRetryTimer);
            this.rebuildRetryTimer = null;
        }
        this.stopWaitingForVisibleRebuild();
        this.stopLiveRefresh();
        window.removeEventListener(CAPTURE_EVENT, this.handleBridgeCapture as EventListener);
        this.liveDomReconciler = null;
        this.initialized = false;
    }

    subscribe(listener: (snapshot: ChatGPTConversationSnapshot | null) => void, options?: SnapshotSubscriptionOptions): () => void {
        this.subscribers.add(listener);
        const conversationId = getConversationIdFromUrl(window.location.href);
        if (conversationId) {
            const cached = this.snapshotByConversation.get(conversationId) ?? null;
            if (cached) listener(cached);
        }
        if (options?.live !== false) this.startLiveRefresh();
        return () => {
            this.subscribers.delete(listener);
            if (this.subscribers.size === 0) this.stopLiveRefresh();
        };
    }

    peekCurrentSnapshot(): ChatGPTConversationSnapshot | null {
        const conversationId = getConversationIdFromUrl(window.location.href);
        return conversationId ? this.snapshotByConversation.get(conversationId) ?? null : null;
    }

    async getSnapshot(): Promise<ChatGPTConversationSnapshot | null> {
        return this.refreshCurrentConversation({ force: false });
    }

    async forceRefreshCurrentConversation(): Promise<ChatGPTConversationSnapshot | null> {
        this.markCurrentConversationStale();
        const refreshed = await this.rebuildCurrentConversation();
        if (!this.liveDomReconciler) return refreshed;
        try {
            return this.liveDomReconciler() ?? refreshed;
        } catch {
            return refreshed;
        }
    }

    registerLiveDomReconciler(reconciler: LiveDomReconciler): () => void {
        this.liveDomReconciler = reconciler;
        return () => {
            if (this.liveDomReconciler === reconciler) {
                this.liveDomReconciler = null;
            }
        };
    }

    applyLiveDomTail(
        expectedBranchKey: string,
        rounds: ChatGPTConversationRound[],
    ): ChatGPTConversationSnapshot | null {
        const conversationId = getConversationIdFromUrl(window.location.href);
        if (!conversationId || rounds.length === 0) return null;
        const previous = this.snapshotByConversation.get(conversationId) ?? null;
        if (!previous || previous.branchKey !== expectedBranchKey) return previous;

        const nextRounds = [...previous.rounds];
        const firstCandidate = rounds[0];
        const previousTail = previous.rounds[previous.rounds.length - 1];
        if (
            firstCandidate
            && previousTail
            && firstCandidate.position === previousTail.position
        ) {
            const completion = completePendingRound(previousTail, firstCandidate);
            if (!completion) return previous;
            const earlierRounds = previous.rounds.slice(0, -1);
            if (
                earlierRounds.some((round) => round.id === completion.id)
                || earlierRounds.some((round) => (
                    completion.userMessageId !== null
                    && round.userMessageId === completion.userMessageId
                ))
                || earlierRounds.some((round) => (
                    round.messageId === completion.assistantMessageId
                    || round.assistantMessageId === completion.assistantMessageId
                ))
            ) {
                return previous;
            }
            nextRounds[nextRounds.length - 1] = completion;
            rounds = rounds.slice(1);
        }

        const existingRoundIds = new Set(nextRounds.map((round) => round.id));
        const existingUserMessageIds = new Set(nextRounds.map((round) => round.userMessageId).filter(Boolean));
        const existingAssistantMessageIds = new Set(nextRounds.flatMap((round) => [
            round.messageId,
            round.assistantMessageId,
        ]).filter(Boolean));
        const accepted: ChatGPTConversationRound[] = [];
        for (const round of rounds) {
            const expectedPosition = nextRounds.length + accepted.length + 1;
            if (
                !isNonEmptyIdentity(round.id)
                || round.position !== expectedPosition
                || typeof round.userPrompt !== 'string'
                || typeof round.assistantContent !== 'string'
                || !round.assistantContent.trim()
                || typeof round.preview !== 'string'
                || !isNullableIdentity(round.messageId)
                || !isNullableIdentity(round.userMessageId)
                || !isNullableIdentity(round.assistantMessageId)
                || !round.assistantMessageId
                || round.messageId !== round.assistantMessageId
                || existingRoundIds.has(round.id)
                || existingUserMessageIds.has(round.userMessageId)
                || existingAssistantMessageIds.has(round.assistantMessageId)
            ) {
                return previous;
            }
            existingRoundIds.add(round.id);
            if (round.userMessageId) existingUserMessageIds.add(round.userMessageId);
            existingAssistantMessageIds.add(round.assistantMessageId);
            accepted.push(round);
        }
        const completedPendingTail = nextRounds[nextRounds.length - 1] !== previousTail;
        if (!completedPendingTail && accepted.length === 0) return previous;

        if (!this.liveDomTailBaseByConversation.has(conversationId)) {
            this.liveDomTailBaseByConversation.set(conversationId, previous);
        }
        const next: ChatGPTConversationSnapshot = {
            ...previous,
            branchKey: accepted[accepted.length - 1]?.assistantMessageId
                ?? nextRounds[nextRounds.length - 1]?.assistantMessageId
                ?? previous.branchKey,
            capturedAt: Date.now(),
            rounds: [...nextRounds, ...accepted],
        };
        this.snapshotByConversation.set(conversationId, next);
        this.subscribers.forEach((listener) => listener(next));
        return next;
    }

    private async refreshCurrentConversation(options?: { force?: boolean }): Promise<ChatGPTConversationSnapshot | null> {
        const conversationId = getConversationIdFromUrl(window.location.href);
        if (!conversationId) return null;
        this.currentConversationId = conversationId;
        return this.refreshSnapshot(conversationId, { force: options?.force === true });
    }

    private async refreshSnapshot(
        conversationId: string,
        options?: { force?: boolean }
    ): Promise<ChatGPTConversationSnapshot | null> {
        const force = options?.force === true || this.staleConversationIds.has(conversationId);
        const staleRevision = this.staleRevisionByConversation.get(conversationId) ?? 0;
        const cached = this.snapshotByConversation.get(conversationId);
        if (cached && !force && !this.staleConversationIds.has(conversationId)) {
            return cached;
        }

        const inFlightKey = `${conversationId}:${force ? 'force' : 'normal'}`;
        const inFlight = this.inFlightByConversation.get(inFlightKey);
        if (inFlight) {
            if (force && staleRevision > inFlight.staleRevision) {
                return inFlight.promise.then(() => this.refreshSnapshot(conversationId, { force: true }));
            }
            return inFlight.promise;
        }

        const generation = (this.requestGenerationByConversation.get(conversationId) ?? 0) + 1;
        this.requestGenerationByConversation.set(conversationId, generation);
        const promise = this.loadSnapshot(conversationId, { force, generation, staleRevision }).finally(() => {
            this.inFlightByConversation.delete(inFlightKey);
        });
        this.inFlightByConversation.set(inFlightKey, { promise, staleRevision });
        return promise;
    }

    private async loadSnapshot(
        conversationId: string,
        options?: { force?: boolean; generation?: number; staleRevision?: number }
    ): Promise<ChatGPTConversationSnapshot | null> {
        let snapshot: ChatGPTConversationSnapshotCandidate | null = null;
        try {
            snapshot = await this.requestBridgeSnapshot(conversationId, options?.force === true);
        } catch {
            snapshot = null;
        }

        const previous = this.snapshotByConversation.get(conversationId) ?? null;
        if (!isVerifiedGraphSnapshot(snapshot, conversationId)) {
            return previous;
        }

        const requestedStaleRevision = options?.staleRevision ?? 0;
        const latestStaleRevision = this.staleRevisionByConversation.get(conversationId) ?? 0;
        if (requestedStaleRevision < latestStaleRevision) {
            return previous;
        }

        if (snapshot) {
            const generation = options?.generation ?? 0;
            const appliedGeneration = this.appliedGenerationByConversation.get(conversationId) ?? 0;
            if (generation < appliedGeneration) {
                return this.snapshotByConversation.get(conversationId) ?? snapshot;
            }
            const liveBase = this.liveDomTailBaseByConversation.get(conversationId) ?? null;
            const liveMerge = previous && liveBase
                ? mergeIncomingGraphWithLiveDom(previous, snapshot, liveBase)
                : { snapshot, preservesLiveDom: false };
            const nextSnapshot = liveMerge.snapshot;
            if (liveMerge.preservesLiveDom) {
                this.liveDomTailBaseByConversation.set(conversationId, snapshot);
            } else {
                this.liveDomTailBaseByConversation.delete(conversationId);
            }
            this.snapshotByConversation.set(conversationId, nextSnapshot);
            this.appliedGenerationByConversation.set(conversationId, generation);
            if (requestedStaleRevision === latestStaleRevision) {
                this.staleConversationIds.delete(conversationId);
            }
            const isCurrentConversation = this.currentConversationId === conversationId
                && getConversationIdFromUrl(window.location.href) === conversationId;
            if (isCurrentConversation && !areSnapshotsEquivalent(previous, nextSnapshot)) {
                this.subscribers.forEach((listener) => listener(nextSnapshot));
            }
            return nextSnapshot;
        }
        return snapshot;
    }

    private handleRouteChange(nextUrl: string, prevUrl: string): void {
        const previousId = getConversationIdFromUrl(prevUrl);
        const nextId = getConversationIdFromUrl(nextUrl);
        if (previousId === nextId && nextId === this.currentConversationId) return;

        this.currentConversationId = nextId;
        this.rebuildRetryCount = 0;
        if (this.rebuildRetryTimer !== null) {
            window.clearTimeout(this.rebuildRetryTimer);
            this.rebuildRetryTimer = null;
        }

        if (!nextId || !isChatGPTConversationPage(nextUrl)) {
            this.subscribers.forEach((listener) => listener(null));
            return;
        }

        const cachedNextSnapshot = this.snapshotByConversation.get(nextId) ?? null;
        this.subscribers.forEach((listener) => listener(cachedNextSnapshot));
        this.markConversationStale(nextId);
        void this.rebuildCurrentConversation();
    }

    private markConversationStale(conversationId: string): void {
        this.staleConversationIds.add(conversationId);
        this.staleRevisionByConversation.set(
            conversationId,
            (this.staleRevisionByConversation.get(conversationId) ?? 0) + 1,
        );
    }

    private markCurrentConversationStale(): void {
        const conversationId = getConversationIdFromUrl(window.location.href);
        if (!conversationId) return;
        this.currentConversationId = conversationId;
        this.markConversationStale(conversationId);
    }

    private async rebuildCurrentConversation(): Promise<ChatGPTConversationSnapshot | null> {
        const conversationId = getConversationIdFromUrl(window.location.href);
        if (!conversationId || !isChatGPTConversationPage(window.location.href)) return null;
        this.currentConversationId = conversationId;
        const snapshot = await this.refreshSnapshot(conversationId, { force: true });
        if (this.staleConversationIds.has(conversationId)) this.scheduleRebuildRetry(conversationId);
        else {
            this.rebuildRetryCount = 0;
            if (this.rebuildRetryTimer !== null) {
                window.clearTimeout(this.rebuildRetryTimer);
                this.rebuildRetryTimer = null;
            }
        }
        return snapshot;
    }

    private scheduleRebuildRetry(conversationId: string): void {
        if (this.rebuildRetryTimer !== null) return;
        if (this.rebuildRetryCount >= REBUILD_RETRY_DELAYS_MS.length) return;
        const delay = REBUILD_RETRY_DELAYS_MS[this.rebuildRetryCount] ?? REBUILD_RETRY_DELAYS_MS[REBUILD_RETRY_DELAYS_MS.length - 1];
        this.rebuildRetryCount += 1;
        this.rebuildRetryTimer = window.setTimeout(() => {
            this.rebuildRetryTimer = null;
            if (this.currentConversationId !== conversationId) return;
            if (!this.staleConversationIds.has(conversationId)) return;
            if (document.visibilityState !== 'visible') {
                this.waitForVisibleRebuild();
                return;
            }
            void this.rebuildCurrentConversation();
        }, delay);
    }

    private waitForVisibleRebuild(): void {
        if (this.waitingForVisibleRebuild) return;
        this.waitingForVisibleRebuild = true;
        document.addEventListener('visibilitychange', this.handleStaleVisibilityChange);
    }

    private stopWaitingForVisibleRebuild(): void {
        if (!this.waitingForVisibleRebuild) return;
        this.waitingForVisibleRebuild = false;
        document.removeEventListener('visibilitychange', this.handleStaleVisibilityChange);
    }

    private startLiveRefresh(): void {
        if (this.subscribers.size === 0) return;
        if (this.liveRefreshTimer !== null) return;
        if (this.adapter.getPlatformId() !== 'chatgpt') return;
        document.addEventListener('visibilitychange', this.handleVisibilityChange);
        this.liveRefreshTimer = window.setInterval(() => {
            if (this.subscribers.size === 0) {
                this.stopLiveRefresh();
                return;
            }
            if (!isChatGPTConversationPage(window.location.href)) return;
            if (document.visibilityState !== 'visible') return;
            void this.refreshCurrentConversation({ force: true });
        }, LIVE_REFRESH_INTERVAL_MS);
    }

    private stopLiveRefresh(): void {
        if (this.liveRefreshTimer !== null) {
            window.clearInterval(this.liveRefreshTimer);
            this.liveRefreshTimer = null;
        }
        document.removeEventListener('visibilitychange', this.handleVisibilityChange);
    }

    private requestBridgeSnapshot(conversationId: string, force = false): Promise<ChatGPTConversationSnapshotCandidate | null> {
        const requestId = `aimd-chatgpt-snapshot-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

        return new Promise((resolve) => {
            let settled = false;
            const cleanup = () => {
                window.removeEventListener(RESPONSE_EVENT, onResponse as EventListener);
                window.clearTimeout(timeoutId);
            };

            const onResponse = (event: Event) => {
                const detail = decodeBridgeDetail<BridgeResponse>((event as CustomEvent<unknown>).detail);
                if (!detail || detail.requestId !== requestId) return;
                settled = true;
                cleanup();
                resolve(detail.ok ? detail.snapshot ?? null : null);
            };

            const timeoutId = window.setTimeout(() => {
                if (settled) return;
                cleanup();
                resolve(null);
            }, RESPONSE_TIMEOUT_MS);

            window.addEventListener(RESPONSE_EVENT, onResponse as EventListener);
            window.dispatchEvent(new CustomEvent<BridgeWireDetail<BridgeRequest>>(REQUEST_EVENT, {
                detail: encodeBridgeRequest({
                    requestId,
                    type: 'snapshot' as const,
                    conversationId,
                    force,
                }, browserInfo.isFirefox),
            }));
        });
    }
}

function completePendingRound(
    pending: ChatGPTConversationRound,
    completed: ChatGPTConversationRound,
): ChatGPTConversationRound | null {
    if (
        pending.assistantContent.trim()
        || completed.id !== pending.id
        || completed.position !== pending.position
        || typeof completed.userPrompt !== 'string'
        || typeof completed.assistantContent !== 'string'
        || !completed.assistantContent.trim()
        || typeof completed.preview !== 'string'
        || !isNullableIdentity(completed.messageId)
        || !isNullableIdentity(completed.userMessageId)
        || !isNullableIdentity(completed.assistantMessageId)
        || !completed.assistantMessageId
        || completed.messageId !== completed.assistantMessageId
        || (
            pending.userMessageId !== null
            && completed.userMessageId !== pending.userMessageId
        )
        || (
            pending.assistantMessageId !== null
            && completed.assistantMessageId !== pending.assistantMessageId
        )
    ) {
        return null;
    }
    return {
        ...pending,
        assistantContent: completed.assistantContent,
        messageId: completed.messageId,
        userMessageId: pending.userMessageId ?? completed.userMessageId,
        assistantMessageId: completed.assistantMessageId,
    };
}

function isVerifiedGraphSnapshot(
    snapshot: ChatGPTConversationSnapshotCandidate | null,
    conversationId: string
): snapshot is ChatGPTConversationSnapshot {
    if (!snapshot || typeof snapshot !== 'object') return false;
    if (snapshot.conversationId !== conversationId) return false;
    if (snapshot.source !== 'runtime-bridge') return false;
    if (snapshot.origin !== 'conversation-graph') return false;
    if (snapshot.coverage !== 'complete') return false;
    if (!isNonEmptyIdentity(snapshot.branchKey)) return false;
    if (snapshot.buildFingerprint !== null && typeof snapshot.buildFingerprint !== 'string') return false;
    if (typeof snapshot.capturedAt !== 'number' || !Number.isFinite(snapshot.capturedAt)) return false;
    if (!Array.isArray(snapshot.rounds) || snapshot.rounds.length === 0) return false;

    const roundIds = new Set<string>();
    const userMessageIds = new Set<string>();
    const assistantMessageIds = new Set<string>();
    for (let index = 0; index < snapshot.rounds.length; index += 1) {
        const round = snapshot.rounds[index];
        if (!round || typeof round !== 'object') return false;
        if (!isNonEmptyIdentity(round.id) || roundIds.has(round.id)) return false;
        if (round.position !== index + 1) return false;
        if (typeof round.userPrompt !== 'string') return false;
        if (typeof round.assistantContent !== 'string') return false;
        if (typeof round.preview !== 'string') return false;
        if (!isNullableIdentity(round.messageId)) return false;
        if (!isNullableIdentity(round.userMessageId)) return false;
        if (!isNullableIdentity(round.assistantMessageId)) return false;
        if (round.userMessageId && userMessageIds.has(round.userMessageId)) return false;
        if (round.assistantMessageId && assistantMessageIds.has(round.assistantMessageId)) return false;
        if (
            round.messageId
            && round.messageId !== round.assistantMessageId
            && !(round.assistantMessageId === null && round.messageId === round.userMessageId)
        ) return false;

        roundIds.add(round.id);
        if (round.userMessageId) userMessageIds.add(round.userMessageId);
        if (round.assistantMessageId) assistantMessageIds.add(round.assistantMessageId);
    }
    return true;
}

function isNonEmptyIdentity(value: unknown): value is string {
    return typeof value === 'string' && value.length > 0 && value.trim() === value;
}

function isNullableIdentity(value: unknown): value is string | null {
    return value === null || isNonEmptyIdentity(value);
}

function areSnapshotsEquivalent(
    previous: ChatGPTConversationSnapshot | null,
    next: ChatGPTConversationSnapshot | null
): boolean {
    if (!previous || !next) return false;
    if (previous.conversationId !== next.conversationId) return false;
    if (previous.origin !== next.origin) return false;
    if (previous.coverage !== next.coverage) return false;
    if (previous.branchKey !== next.branchKey) return false;
    if (previous.rounds.length !== next.rounds.length) return false;
    for (let index = 0; index < previous.rounds.length; index += 1) {
        const a = previous.rounds[index];
        const b = next.rounds[index];
        if (!b) return false;
        if (
            a.id !== b.id
            || a.position !== b.position
            || a.userPrompt !== b.userPrompt
            || a.assistantContent !== b.assistantContent
            || a.preview !== b.preview
            || a.messageId !== b.messageId
            || a.userMessageId !== b.userMessageId
            || a.assistantMessageId !== b.assistantMessageId
        ) {
            return false;
        }
    }
    return true;
}

function mergeIncomingGraphWithLiveDom(
    previous: ChatGPTConversationSnapshot,
    incoming: ChatGPTConversationSnapshot,
    liveBase: ChatGPTConversationSnapshot,
): { snapshot: ChatGPTConversationSnapshot; preservesLiveDom: boolean } {
    if (areSnapshotsEquivalent(liveBase, incoming)) {
        return { snapshot: previous, preservesLiveDom: true };
    }
    if (
        incoming.rounds.length < liveBase.rounds.length
        || !isRoundLineagePrefix(liveBase.rounds, incoming.rounds)
    ) {
        return { snapshot: incoming, preservesLiveDom: false };
    }

    const overlapCount = Math.min(previous.rounds.length, incoming.rounds.length);
    for (let index = 0; index < overlapCount; index += 1) {
        if (!roundsShareLineage(previous.rounds[index]!, incoming.rounds[index]!)) {
            return { snapshot: incoming, preservesLiveDom: false };
        }
    }

    let preservesLiveDom = false;
    const mergedRounds = incoming.rounds.map((round, index) => {
        const liveRound = previous.rounds[index];
        if (
            !liveRound
            || !liveRound.assistantContent.trim()
            || round.assistantContent.trim()
        ) {
            return round;
        }
        preservesLiveDom = true;
        return {
            ...round,
            assistantContent: liveRound.assistantContent,
            messageId: liveRound.messageId,
            assistantMessageId: liveRound.assistantMessageId,
        };
    });

    const hasPreservedTail = incoming.rounds.length < previous.rounds.length
        && isRoundLineagePrefix(incoming.rounds, previous.rounds);
    if (hasPreservedTail) {
        mergedRounds.push(...previous.rounds.slice(incoming.rounds.length));
        preservesLiveDom = true;
    }
    if (!preservesLiveDom) {
        return { snapshot: incoming, preservesLiveDom: false };
    }

    return {
        snapshot: {
            ...incoming,
            branchKey: hasPreservedTail ? previous.branchKey : incoming.branchKey,
            rounds: mergedRounds,
        },
        preservesLiveDom: true,
    };
}

function isRoundLineagePrefix(
    prefix: ChatGPTConversationRound[],
    rounds: ChatGPTConversationRound[],
): boolean {
    if (prefix.length > rounds.length) return false;
    return prefix.every((round, index) => {
        const candidate = rounds[index];
        return Boolean(candidate) && roundsShareLineage(round, candidate);
    });
}

function roundsShareLineage(
    left: ChatGPTConversationRound,
    right: ChatGPTConversationRound,
): boolean {
    if (
        left.userMessageId
        && right.userMessageId
        && left.userMessageId !== right.userMessageId
    ) {
        return false;
    }
    if (
        left.assistantMessageId
        && right.assistantMessageId
        && left.assistantMessageId !== right.assistantMessageId
    ) {
        return false;
    }
    return Boolean(
        (left.userMessageId && left.userMessageId === right.userMessageId)
        || (
            left.assistantMessageId
            && left.assistantMessageId === right.assistantMessageId
        )
        || left.id === right.id
    );
}
