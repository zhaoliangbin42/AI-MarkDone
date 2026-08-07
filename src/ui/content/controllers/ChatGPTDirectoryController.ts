import type { Theme } from '../../../core/types/theme';
import type { SiteAdapter } from '../../../drivers/content/adapters/base';
import { RouteWatcher } from '../../../drivers/content/injection/routeWatcher';
import { getChatGPTConversationIndex, type ChatGPTConversationIndex } from '../../../drivers/content/chatgpt/ChatGPTConversationIndex';
import type { ChatGPTConversationRound } from '../../../drivers/content/chatgpt/types';
import type { ChatGPTDirectoryMode, ChatGPTDirectoryPromptLabelMode } from '../../../core/settings/types';
import { ChatGPTDirectoryRail } from '../chatgptDirectory/ChatGPTDirectoryRail';
import {
    navigateChatGPTDirectoryTarget,
    resolveChatGPTActivePosition,
    type ChatGPTRoundPosition,
} from '../chatgptDirectory/navigation';
import {
    areAppearanceSnapshotsEqual,
    createAppearanceSnapshot,
    type AppearanceSnapshot,
} from '../../../style/appearance';
import { AIMD_VIEWPORT_RESIZE_IDLE_EVENT } from './ViewportResizeSuspendController';
import { subscribeLocaleChange } from '../components/i18n';
import { isChatGPTConversationPage } from '../../../drivers/content/chatgpt/chatgptRoute';
import type { ConversationContentSourceV1 } from '../../../contracts/conversationContent';
import type { ConversationMaterializationPortV1 } from '../../../contracts/conversationMaterialization';
import type { ConversationNavigationPortV1 } from '../../../contracts/conversationNavigation';

type DirectoryBookmarksState = {
    refreshPositionsForUrl?: (url: string) => Promise<void>;
    isPositionBookmarked?: (url: string, position: number) => boolean;
    subscribe?: (listener: () => void) => () => void;
    resolveConversationBookmarkPositions?: (
        url: string,
        turns: readonly Readonly<{ position: number; assistantMessageId: string }>[]
    ) => ReadonlySet<number>;
};

type ChatGPTDirectoryContentOptions = {
    contentSource?: ConversationContentSourceV1 | null;
    materialization?: ConversationMaterializationPortV1 | null;
    navigation?: ConversationNavigationPortV1 | null;
};

function writeDebugState(patch: Record<string, string | boolean | number | null | undefined>): void {
    try {
        if (window.localStorage.getItem('aimd:debug') !== '1') return;
        for (const [key, value] of Object.entries(patch)) {
            document.documentElement.dataset[`aimdDebug${key}`] = value == null ? '' : String(value);
        }
    } catch {
    }
}

function getDirectoryBookmarkUrl(): string {
    try {
        const parsed = new URL(window.location.href);
        parsed.hash = '';
        // ChatGPT may append transport/view flags such as mweb_fallback;
        // bookmark identity is the conversation URL, not those query flags.
        parsed.search = '';
        return `${parsed.origin}${parsed.pathname}${parsed.search}`;
    } catch {
        return window.location.href.split('#')[0] || window.location.href;
    }
}

export class ChatGPTDirectoryController {
    private adapter: SiteAdapter;
    private conversationIndex: ChatGPTConversationIndex | null = null;
    private bookmarksState: DirectoryBookmarksState | null;
    private rail: ChatGPTDirectoryRail | null = null;
    private appearance: AppearanceSnapshot = createAppearanceSnapshot('light');
    private enabled = true;
    private displayMode: ChatGPTDirectoryMode = 'preview';
    private promptLabelMode: ChatGPTDirectoryPromptLabelMode = 'head';
    private routeWatcher: RouteWatcher | null = null;
    private scrollRoot: HTMLElement | null = null;
    private roundPositions: ChatGPTRoundPosition[] = [];
    private activePosition = 0;
    private rafId: number | null = null;
    private rebuildTimer: number | null = null;
    private pendingRebuildReasons = new Set<string>();
    private unsubscribeBookmarks: (() => void) | null = null;
    private unsubscribeRoundChanges: (() => void) | null = null;
    private unsubscribeContent: (() => void) | null = null;
    private unsubscribeMaterialization: (() => void) | null = null;
    private unsubscribeLocale: (() => void) | null = null;
    private initialized = false;
    private globalScrollFallbacksBound = false;
    private viewportResizeSuspendBound = false;
    private activeLocateAbortController: AbortController | null = null;
    private activeIntersectionObserver: IntersectionObserver | null = null;

    constructor(
        adapter: SiteAdapter,
        bookmarksState: DirectoryBookmarksState | null = null,
        contentOptions: ChatGPTDirectoryContentOptions = {},
    ) {
        this.adapter = adapter;
        this.bookmarksState = bookmarksState;
        this.contentSource = contentOptions.contentSource ?? null;
        this.materialization = contentOptions.materialization ?? null;
        this.navigation = contentOptions.navigation ?? null;
    }

    private readonly contentSource: ConversationContentSourceV1 | null;
    private readonly materialization: ConversationMaterializationPortV1 | null;
    private readonly navigation: ConversationNavigationPortV1 | null;

    private getCanonicalContentSource(): ConversationContentSourceV1 | null {
        return this.contentSource
            ?? (this.conversationIndex ?? getChatGPTConversationIndex(this.adapter)).getConversationSource()
            ?? null;
    }

    init(theme: Theme): void {
        if (this.adapter.getPlatformId() !== 'chatgpt') return;
        this.setAppearance(createAppearanceSnapshot(theme, this.appearance.overrides));
        this.ensureRail();
        this.bindViewportResizeSuspend();
        if (this.initialized) {
            this.rail?.setAppearance(this.appearance);
            void this.refresh();
            return;
        }
        this.initialized = true;
        this.conversationIndex = getChatGPTConversationIndex(this.adapter);
        writeDebugState({ DirectoryInit: 'start' });
        this.routeWatcher = new RouteWatcher(() => {
            this.cancelActiveLocate();
            this.refresh();
        }, { intervalMs: 500 });
        this.routeWatcher.start();
        const legacyIndex = this.conversationIndex ?? getChatGPTConversationIndex(this.adapter);
        this.unsubscribeRoundChanges = legacyIndex.subscribe(() => {
            this.scheduleIndexRebuild('mutation');
        });
        // When the source is supplied through the shared index, the index
        // subscription above is already the invalidation seam. Subscribe
        // directly only for an explicitly injected composition-root source.
        this.unsubscribeContent = this.contentSource?.subscribe(() => {
            this.scheduleIndexRebuild('content');
        }) ?? null;
        this.unsubscribeMaterialization = this.materialization?.subscribe(() => {
            this.scheduleIndexRebuild('materialization');
        }) ?? null;
        this.unsubscribeBookmarks = this.bookmarksState?.subscribe?.(() => {
            this.render();
        }) ?? null;
        this.unsubscribeLocale = subscribeLocaleChange(() => this.render());
        void this.refresh();
    }

    dispose(): void {
        this.cancelActiveLocate();
        if (this.rafId !== null) {
            window.cancelAnimationFrame(this.rafId);
            this.rafId = null;
        }
        if (this.rebuildTimer !== null) {
            window.clearTimeout(this.rebuildTimer);
            this.rebuildTimer = null;
        }
        this.pendingRebuildReasons.clear();
        this.routeWatcher?.stop();
        this.routeWatcher = null;
        this.unsubscribeBookmarks?.();
        this.unsubscribeBookmarks = null;
        this.unsubscribeRoundChanges?.();
        this.unsubscribeRoundChanges = null;
        this.unsubscribeContent?.();
        this.unsubscribeContent = null;
        this.unsubscribeMaterialization?.();
        this.unsubscribeMaterialization = null;
        this.activeIntersectionObserver?.disconnect();
        this.activeIntersectionObserver = null;
        this.conversationIndex = null;
        this.unsubscribeLocale?.();
        this.unsubscribeLocale = null;
        this.scrollRoot?.removeEventListener('scroll', this.handleScroll, { capture: true } as EventListenerOptions);
        this.scrollRoot = null;
        this.unbindGlobalScrollFallbacks();
        this.unbindViewportResizeSuspend();
        this.rail?.dispose();
        this.rail = null;
        this.initialized = false;
    }

    setAppearance(snapshot: AppearanceSnapshot): void {
        if (areAppearanceSnapshotsEqual(this.appearance, snapshot)) return;
        this.appearance = snapshot;
        this.rail?.setAppearance(snapshot);
    }

    setEnabled(enabled: boolean): void {
        this.enabled = enabled;
        this.rail?.setVisible(enabled);
        if (enabled) {
            void this.refresh();
        }
    }

    setDisplayMode(mode: ChatGPTDirectoryMode): void {
        this.displayMode = mode === 'expanded' ? 'expanded' : 'preview';
        this.rail?.setDisplayMode(this.displayMode);
    }

    setPromptLabelMode(mode: ChatGPTDirectoryPromptLabelMode): void {
        this.promptLabelMode = mode === 'headTail' ? 'headTail' : 'head';
        this.rail?.setPromptLabelMode(this.promptLabelMode);
    }

    setRightInsetPx(value: number): void {
        this.rail?.setRightInsetPx(value);
    }

    private ensureRail(): void {
        if (this.rail) {
            const element = this.rail.getElement();
            if (!element.isConnected) {
                const connectedRail = document.getElementById('aimd-chatgpt-directory-rail');
                if (connectedRail && connectedRail !== element) {
                    this.rail.dispose();
                    this.rail = null;
                    writeDebugState({ DirectoryHost: 'stale-disconnected' });
                    return;
                }
                this.rail.ensureAttached();
                this.rail.setVisible(this.enabled);
                writeDebugState({ DirectoryHost: 'reattached' });
            } else {
                this.rail.ensureAttached();
            }
            return;
        }
        this.rail = new ChatGPTDirectoryRail(this.appearance.theme, (round) => {
            void this.handleSelect(round);
        }, this.appearance.overrides);
        this.rail.setDisplayMode(this.displayMode);
        this.rail.setPromptLabelMode(this.promptLabelMode);
        this.rail.ensureAttached();
        this.rail.setVisible(this.enabled);
        writeDebugState({ DirectoryHost: 'created' });
    }

    private async refresh(): Promise<void> {
        if (!this.enabled || !isChatGPTConversationPage(window.location.href)) {
            this.rail?.setRounds([]);
            this.rail?.setVisible(false);
            writeDebugState({ DirectoryVisible: false, DirectoryReason: 'not-conversation' });
            return;
        }
        this.ensureRail();
        this.rail?.setVisible(true);
        this.rebindScrollRoot();
        this.render();
        const bookmarkUrl = getDirectoryBookmarkUrl();
        await (
            this.bookmarksState?.refreshPositionsForUrl?.(bookmarkUrl).catch(() => undefined)
            ?? Promise.resolve()
        );
        this.render();
        writeDebugState({
            DirectoryVisible: true,
            DirectoryReason: this.roundPositions.length > 0 ? 'snapshot' : 'placeholder',
            DirectoryRounds: this.roundPositions.length,
            DirectoryAnchors: this.roundPositions.filter((round) => round.jumpAnchor instanceof HTMLElement).length,
        });
    }

    private render(): void {
        if (!this.rail) return;
        // ChatGPT may replace body contents while hydrating a route. Keep the
        // fixed page-level host aligned with the same body portal used by the
        // lower-right controls before rendering the next list state.
        this.rail.ensureAttached();
        this.refreshRoundPositions();
        const rounds = this.buildDirectoryRounds();
        this.rail.setRounds(rounds);
        this.bindActiveIntersectionObserver();
        this.syncBookmarkedPositions(rounds);
        this.updateActivePosition();
    }

    private syncBookmarkedPositions(rounds: ChatGPTConversationRound[]): void {
        if (!this.rail) {
            return;
        }
        const url = getDirectoryBookmarkUrl();
        if (this.bookmarksState?.resolveConversationBookmarkPositions) {
            const positions = this.bookmarksState.resolveConversationBookmarkPositions(
                url,
                rounds.flatMap((round) => {
                    const assistantMessageId = round.assistantMessageId ?? round.messageId;
                    return assistantMessageId
                        ? [{ position: round.position, assistantMessageId }]
                        : [];
                }),
            );
            this.rail.setBookmarkedPositions(positions);
            return;
        }
        if (!this.bookmarksState?.isPositionBookmarked) {
            this.rail.setBookmarkedPositions([]);
            return;
        }
        const positions = rounds
            .filter((round) => this.bookmarksState!.isPositionBookmarked!(url, round.position))
            .map((round) => round.position);
        this.rail.setBookmarkedPositions(positions);
    }

    private handleScroll = () => {
        if (this.isViewportResizeSuspended()) return;
        if (this.rafId !== null) return;
        this.rafId = window.requestAnimationFrame(() => {
            this.rafId = null;
            this.updateActivePosition();
        });
    };

    private handleViewportResizeIdle = () => {
        if (this.isViewportResizeSuspended()) return;
        if (this.rafId !== null) {
            window.cancelAnimationFrame(this.rafId);
            this.rafId = null;
        }
        this.updateActivePosition({ followRail: false });
    };

    private rebindScrollRoot(): void {
        const nextScrollRoot = this.adapter.getConversationScrollRoot?.() ?? document.scrollingElement ?? null;
        if (this.scrollRoot !== nextScrollRoot) {
            this.scrollRoot?.removeEventListener('scroll', this.handleScroll, { capture: true } as EventListenerOptions);
            this.scrollRoot = nextScrollRoot instanceof HTMLElement ? nextScrollRoot : null;
            this.scrollRoot?.addEventListener('scroll', this.handleScroll, { capture: true, passive: true } as AddEventListenerOptions);
            this.bindActiveIntersectionObserver();
        }
        this.bindGlobalScrollFallbacks();
    }

    /**
     * Scroll events are not guaranteed to be emitted by the virtualized host
     * that owns the conversation. IntersectionObserver supplies the same
     * viewport fact without a second observer or a polling loop, and is
     * rebound only when materialization changes or the scroll root changes.
     */
    private bindActiveIntersectionObserver(): void {
        this.activeIntersectionObserver?.disconnect();
        this.activeIntersectionObserver = null;
        if (typeof IntersectionObserver !== 'function' || this.roundPositions.length === 0) return;
        const anchors = new Set<HTMLElement>();
        for (const round of this.roundPositions) {
            for (const element of round.groupEls) {
                if (element.isConnected) anchors.add(element);
            }
        }
        if (anchors.size === 0) return;
        this.activeIntersectionObserver = new IntersectionObserver(
            () => this.handleScroll(),
            { root: this.scrollRoot?.isConnected ? this.scrollRoot : null, threshold: [0, 0.01, 0.5, 1] },
        );
        anchors.forEach((anchor) => this.activeIntersectionObserver?.observe(anchor));
    }

    private scheduleIndexRebuild(reason: string): void {
        this.pendingRebuildReasons.add(reason);
        if (this.rebuildTimer !== null) return;
        const run = () => {
            this.rebuildTimer = null;
            this.pendingRebuildReasons.clear();
            this.render();
        };
        const ric = window.requestIdleCallback as ((cb: () => void, opts?: { timeout: number }) => number) | undefined;
        if (typeof ric === 'function') {
            this.rebuildTimer = ric.call(window, run, { timeout: 500 });
        } else {
            this.rebuildTimer = window.setTimeout(run, 120);
        }
    }

    private bindGlobalScrollFallbacks(): void {
        if (this.globalScrollFallbacksBound) return;
        window.addEventListener('scroll', this.handleScroll, { capture: true, passive: true });
        document.addEventListener('scroll', this.handleScroll, { capture: true, passive: true });
        this.globalScrollFallbacksBound = true;
    }

    private unbindGlobalScrollFallbacks(): void {
        if (!this.globalScrollFallbacksBound) return;
        window.removeEventListener('scroll', this.handleScroll, { capture: true });
        document.removeEventListener('scroll', this.handleScroll, { capture: true });
        this.globalScrollFallbacksBound = false;
    }

    private bindViewportResizeSuspend(): void {
        if (this.viewportResizeSuspendBound) return;
        window.addEventListener(AIMD_VIEWPORT_RESIZE_IDLE_EVENT, this.handleViewportResizeIdle);
        this.viewportResizeSuspendBound = true;
    }

    private unbindViewportResizeSuspend(): void {
        if (!this.viewportResizeSuspendBound) return;
        window.removeEventListener(AIMD_VIEWPORT_RESIZE_IDLE_EVENT, this.handleViewportResizeIdle);
        this.viewportResizeSuspendBound = false;
    }

    private isViewportResizeSuspended(): boolean {
        return document.documentElement.dataset.aimdViewportResizing === '1';
    }

    private refreshRoundPositions(): void {
        const contentState = this.getCanonicalContentSource()?.read();
        if (contentState?.document && contentState.snapshot) {
            const mountedByTarget = this.materialization
                ? new Map(
                    this.materialization.read().entries.map((entry) => [
                        `${entry.target.turnId}:${entry.target.assistantMessageId}`,
                        {
                            jumpAnchor: entry.anchorElement,
                            userAnchor: entry.anchorElement,
                            assistantRoot: entry.anchorElement,
                            groupEls: [entry.anchorElement],
                        },
                    ]),
                )
                : new Map(
                    (this.conversationIndex ?? getChatGPTConversationIndex(this.adapter)).getRounds()
                        .filter((entry) => entry.materialized !== null)
                        .map((entry) => [
                            `${entry.identity.roundId}:${entry.identity.assistantMessageId}`,
                            {
                                jumpAnchor: entry.materialized!.jumpAnchorEl,
                                userAnchor: entry.materialized!.userRootEl,
                                assistantRoot: entry.materialized!.assistantRootEl,
                                groupEls: entry.materialized!.groupEls,
                            },
                        ]),
                );
            this.roundPositions = contentState.snapshot.turns.map((turn) => {
                const mounted = mountedByTarget.get(
                    `${turn.identity.turnId}:${turn.identity.assistantMessageId}`,
                ) ?? null;
                const jumpAnchor = mounted?.jumpAnchor ?? null;
                return {
                    position: turn.ordinal,
                    id: turn.identity.turnId,
                    messageId: turn.identity.assistantMessageId,
                    roundId: turn.identity.turnId,
                    userMessageId: turn.identity.userMessageId,
                    assistantMessageId: turn.identity.assistantMessageId,
                    userPromptText: turn.userText,
                    userPromptQuality: 'real',
                    jumpAnchor,
                    userAnchor: mounted?.userAnchor ?? null,
                    assistantRoot: mounted?.assistantRoot ?? null,
                    groupEls: mounted?.groupEls ?? [],
                };
            });
            return;
        }
        // A ChatGPT directory without a verified graph-backed snapshot is
        // unavailable. A mounted DOM window is never a complete conversation.
        this.roundPositions = [];
    }

    private buildDirectoryRounds(): ChatGPTConversationRound[] {
        const snapshot = this.getCanonicalContentSource()?.read().snapshot;
        if (snapshot) {
            return snapshot.turns.map((turn) => ({
                id: turn.identity.turnId,
                position: turn.ordinal,
                userPrompt: turn.userText,
                assistantContent: turn.assistantMarkdown,
                preview: turn.userText,
                messageId: turn.identity.assistantMessageId,
                userMessageId: turn.identity.userMessageId,
                assistantMessageId: turn.identity.assistantMessageId,
            }));
        }
        return [];
    }

    private updateActivePosition(options?: { followRail?: boolean }): void {
        if (!this.rail) return;
        if (this.isViewportResizeSuspended()) return;
        if (this.roundPositions.length === 0) {
            this.rail.setActivePosition(0, { follow: options?.followRail });
            return;
        }

        const referenceY = Math.round(window.innerHeight * 0.35);
        const active = resolveChatGPTActivePosition(
            this.roundPositions,
            referenceY,
            this.activePosition || this.roundPositions[0]?.position || 0,
        );
        this.activePosition = active;
        this.rail.setActivePosition(active, { follow: options?.followRail });
    }

    private async handleSelect(round: ChatGPTConversationRound): Promise<void> {
        this.cancelActiveLocate();
        const locateController = new AbortController();
        this.activeLocateAbortController = locateController;
        const signal = locateController.signal;
        try {
            if (this.navigation) {
                await this.navigation.navigate({
                    position: round.position,
                    messageId: round.messageId,
                    roundId: round.id,
                    userMessageId: round.userMessageId,
                    assistantMessageId: round.assistantMessageId,
                    source: 'directory',
                }, { align: 'start', signal, timeoutMs: 15_000 });
                return;
            }
            const contentState = this.getCanonicalContentSource()?.read();
            if (contentState?.document && contentState.snapshot && this.materialization) {
                const turn = contentState.snapshot.turns.find((candidate) => (
                    candidate.identity.turnId === round.id
                    && candidate.identity.assistantMessageId === (round.assistantMessageId ?? round.messageId)
                ));
                if (turn) {
                    const located = await this.materialization.locate({
                        documentKey: contentState.document.key,
                        turnId: turn.identity.turnId,
                        assistantMessageId: turn.identity.assistantMessageId,
                        userMessageId: turn.identity.userMessageId,
                    }, signal);
                    if (located === 'cancelled' || signal.aborted) return;
                    if (located === 'located' && !signal.aborted) {
                        const entry = this.materialization.read().entries.find((candidate) => (
                            candidate.target.turnId === turn.identity.turnId
                            && candidate.target.assistantMessageId === turn.identity.assistantMessageId
                        ));
                        if (!signal.aborted) {
                            entry?.anchorElement.scrollIntoView({ behavior: 'auto', block: 'start' });
                        }
                        return;
                    }
                }
            }
            if (!contentState?.document || !contentState.snapshot || signal.aborted) return;
            const turn = contentState.snapshot.turns.find((candidate) => (
                candidate.identity.turnId === round.id
                && candidate.identity.assistantMessageId === (round.assistantMessageId ?? round.messageId)
            ));
            if (!turn) return;
            await navigateChatGPTDirectoryTarget(this.adapter, {
                position: turn.ordinal,
                messageId: turn.identity.assistantMessageId,
                roundId: turn.identity.turnId,
                userMessageId: turn.identity.userMessageId,
                assistantMessageId: turn.identity.assistantMessageId,
            }, { timeoutMs: 1500, intervalMs: 120, signal });
        } finally {
            if (this.activeLocateAbortController === locateController) {
                this.activeLocateAbortController = null;
            }
        }
    }

    private cancelActiveLocate(): void {
        this.activeLocateAbortController?.abort();
        this.activeLocateAbortController = null;
    }
}
