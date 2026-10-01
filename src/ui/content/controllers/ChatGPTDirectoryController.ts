import type { Theme } from '../../../core/types/theme';
import type { SiteAdapter } from '../../../drivers/content/adapters/base';
import type { ChatGPTConversationRound } from '../../../drivers/content/chatgpt/types';
import type { ChatGPTDirectoryMode, ChatGPTDirectoryPromptLabelMode } from '../../../core/settings/types';
import { DEFAULT_CHATGPT_DIRECTORY_PREVIEW_MAX_CHARS } from '../../../core/settings/types';
import {
    ChatGPTDirectoryRail,
    type ChatGPTDirectoryPreviewActionsFactory,
} from '../chatgptDirectory/ChatGPTDirectoryRail';
import {
    type ChatGPTRoundPosition,
} from '../chatgptDirectory/navigation';
import {
    areAppearanceSnapshotsEqual,
    createAppearanceSnapshot,
    type AppearanceSnapshot,
} from '../../../style/appearance';
import { AIMD_VIEWPORT_RESIZE_IDLE_EVENT } from './ViewportResizeSuspendController';
import { subscribeLocaleChange } from '../components/i18n';
import type { ConversationNavigationPortV1 } from '../../../contracts/conversationNavigation';
import type {
    ConversationSurfaceFrameV1,
    ConversationSurfacePortV1,
} from '../../../contracts/conversationSurface';
import { ChatGPTActivePositionTracker } from './ChatGPTActivePositionTracker';

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
    surface: ConversationSurfacePortV1;
    navigation?: ConversationNavigationPortV1 | null;
    activePositionTracker?: ChatGPTActivePositionTracker;
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

export class ChatGPTDirectoryController {
    private adapter: SiteAdapter;
    private bookmarksState: DirectoryBookmarksState | null;
    private rail: ChatGPTDirectoryRail | null = null;
    private appearance: AppearanceSnapshot = createAppearanceSnapshot('light');
    private enabled = true;
    private displayMode: ChatGPTDirectoryMode = 'preview';
    private promptLabelMode: ChatGPTDirectoryPromptLabelMode = 'head';
    private previewMaxChars = DEFAULT_CHATGPT_DIRECTORY_PREVIEW_MAX_CHARS;
    private previewActionsFactory: ChatGPTDirectoryPreviewActionsFactory | null = null;
    private navigationControls: { previous: HTMLButtonElement; next: HTMLButtonElement } | null = null;
    private roundPositions: ChatGPTRoundPosition[] = [];
    private renderedContentToken: string | null = null;
    private activePosition = 0;
    private rebuildTimer: number | null = null;
    private rebuildTimerKind: 'idle' | 'timeout' | null = null;
    private pendingRebuildReasons = new Set<string>();
    private unsubscribeBookmarks: (() => void) | null = null;
    private unsubscribeSurface: (() => void) | null = null;
    private unsubscribeLocale: (() => void) | null = null;
    private initialized = false;
    private viewportResizeSuspendBound = false;
    private activeLocateAbortController: AbortController | null = null;
    private readonly activePositionTracker: ChatGPTActivePositionTracker;
    private unsubscribeActivePosition: (() => void) | null = null;

    constructor(
        adapter: SiteAdapter,
        bookmarksState: DirectoryBookmarksState | null = null,
        contentOptions: ChatGPTDirectoryContentOptions,
    ) {
        this.adapter = adapter;
        this.bookmarksState = bookmarksState;
        this.surface = contentOptions.surface;
        this.navigation = contentOptions.navigation ?? null;
        this.activePositionTracker = contentOptions.activePositionTracker
            ?? new ChatGPTActivePositionTracker(this.surface);
    }

    private readonly surface: ConversationSurfacePortV1;
    private readonly navigation: ConversationNavigationPortV1 | null;

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
        this.subscribeActivePositionTracker();
        this.bindGlobalScrollFallbacks();
        writeDebugState({ DirectoryInit: 'start' });
        this.unsubscribeSurface = this.surface.subscribeFrame((frame) => {
            this.activePositionTracker.invalidate();
            this.scheduleFrameReconcile(`surface:${frame.frameToken}`);
        });
        this.unsubscribeBookmarks = this.bookmarksState?.subscribe?.(() => {
            this.reconcile();
        }) ?? null;
        this.unsubscribeLocale = subscribeLocaleChange(() => this.reconcile());
        void this.refresh();
    }

    dispose(): void {
        this.cancelActiveLocate();
        if (this.rebuildTimer !== null) {
            if (this.rebuildTimerKind === 'idle' && typeof window.cancelIdleCallback === 'function') {
                window.cancelIdleCallback(this.rebuildTimer);
            } else {
                window.clearTimeout(this.rebuildTimer);
            }
            this.rebuildTimer = null;
            this.rebuildTimerKind = null;
        }
        this.pendingRebuildReasons.clear();
        this.unsubscribeBookmarks?.();
        this.unsubscribeBookmarks = null;
        this.unsubscribeSurface?.();
        this.unsubscribeSurface = null;
        this.unsubscribeActivePosition?.();
        this.unsubscribeActivePosition = null;
        this.unbindGlobalScrollFallbacks();
        this.unsubscribeLocale?.();
        this.unsubscribeLocale = null;
        this.unbindViewportResizeSuspend();
        this.rail?.dispose();
        this.rail = null;
        this.renderedContentToken = null;
        this.initialized = false;
    }

    setAppearance(snapshot: AppearanceSnapshot): void {
        if (areAppearanceSnapshotsEqual(this.appearance, snapshot)) return;
        this.appearance = snapshot;
        this.rail?.setAppearance(snapshot);
    }

    setEnabled(enabled: boolean): void {
        this.enabled = enabled;
        if (!this.initialized) return;
        if (enabled) {
            this.subscribeActivePositionTracker();
            void this.refresh();
        } else {
            this.unsubscribeActivePosition?.();
            this.unsubscribeActivePosition = null;
            this.reconcile();
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

    setPreviewMaxChars(value: number): void {
        this.previewMaxChars = value;
        this.rail?.setPreviewMaxChars(value);
    }

    setPreviewActionsFactory(factory: ChatGPTDirectoryPreviewActionsFactory | null): void {
        this.previewActionsFactory = factory;
        this.rail?.setPreviewActionsFactory(factory);
    }

    private ensureRail(): void {
        if (this.rail) {
            const element = this.rail.getElement();
            if (!element.isConnected) {
                const connectedRail = document.getElementById('aimd-chatgpt-directory-rail');
                if (connectedRail && connectedRail !== element) {
                    this.rail.dispose();
                    this.rail = null;
                    this.renderedContentToken = null;
                    writeDebugState({ DirectoryHost: 'stale-disconnected' });
                    return;
                }
                this.rail.ensureAttached();
                writeDebugState({ DirectoryHost: 'reattached' });
            } else {
                this.rail.ensureAttached();
            }
            return;
        }
        this.rail = new ChatGPTDirectoryRail(this.appearance.theme, (round) => {
            void this.handleSelect(round);
        }, this.appearance.overrides);
        this.renderedContentToken = null;
        this.rail.setDisplayMode(this.displayMode);
        this.rail.setPromptLabelMode(this.promptLabelMode);
        this.rail.setPreviewMaxChars(this.previewMaxChars);
        this.rail.setPreviewActionsFactory(this.previewActionsFactory);
        if (this.navigationControls) this.rail.setNavigationControls(this.navigationControls.previous, this.navigationControls.next);
        this.rail.ensureAttached();
        writeDebugState({ DirectoryHost: 'created' });
    }

    setNavigationControls(previous: HTMLButtonElement, next: HTMLButtonElement): void {
        this.navigationControls = { previous, next };
        this.rail?.setNavigationControls(previous, next);
    }

    private async refresh(): Promise<void> {
        if (!this.reconcile()) return;
        const contentToken = this.surface.readFrame().contentToken;
        const bookmarkUrl = this.resolveBookmarkUrl();
        if (!bookmarkUrl) return;
        await (
            this.bookmarksState?.refreshPositionsForUrl?.(bookmarkUrl).catch(() => undefined)
            ?? Promise.resolve()
        );
        const currentToken = this.surface.readFrame().contentToken;
        if (currentToken === contentToken) {
            this.reconcile();
        }
    }

    private reconcile(): boolean {
        this.ensureRail();
        if (!this.rail) return false;
        // ChatGPT may replace body contents while hydrating a route. Keep the
        // fixed page-level host aligned with the same body portal used by the
        // lower-right controls before rendering the next list state.
        this.rail.ensureAttached();
        const frame = this.surface.readFrame();
        this.rail.setHistoryStatus(frame.snapshot?.historyStatus ?? 'unknown');
        const hasObtainedContent = frame.obtainedTurns.length > 0;
        if (!this.enabled || !hasObtainedContent) {
            this.roundPositions = [];
            this.renderedContentToken = null;
            this.rail.setRounds([]);
            writeDebugState({ DirectoryVisible: false, DirectoryReason: 'no-content' });
            return false;
        }

        this.refreshRoundPositionsFromFrame(frame);
        const rounds = this.buildDirectoryRoundsFromFrame(frame);
        const listToken = `${frame.projectionId}:${frame.contentToken ?? 'none'}`;
        if (listToken !== this.renderedContentToken) {
            this.rail.setRounds(rounds, listToken);
            this.renderedContentToken = listToken;
        }
        this.syncBookmarkedPositions(rounds);
        this.updateActivePosition();
        writeDebugState({
            DirectoryVisible: true,
            DirectoryReason: this.roundPositions.length > 0 ? 'snapshot' : 'placeholder',
            DirectoryRounds: this.roundPositions.length,
            DirectoryAnchors: this.roundPositions.filter((round) => round.jumpAnchor instanceof HTMLElement).length,
        });
        return true;
    }

    /** @internal Synchronous test/debug entry; production is Surface-driven. */
    render(): void {
        this.reconcile();
    }

    private syncBookmarkedPositions(rounds: ChatGPTConversationRound[]): void {
        if (!this.rail) {
            return;
        }
        const url = this.resolveBookmarkUrl();
        if (!url) {
            this.rail.setBookmarkedPositions([]);
            return;
        }
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

    private handleViewportResizeIdle = () => {
        if (this.isViewportResizeSuspended()) return;
        this.updateActivePosition({ followRail: false });
    };

    private subscribeActivePositionTracker(): void {
        if (!this.enabled || this.unsubscribeActivePosition) return;
        this.unsubscribeActivePosition = this.activePositionTracker.subscribe((state) => {
            if (!this.enabled || !this.rail) return;
            this.activePosition = state.activePosition;
            this.rail.setActivePosition(state.activePosition);
        });
    }

    // Compatibility hooks retained for existing lifecycle tests. The shared
    // tracker owns the actual scroll listeners; binding this path merely
    // ensures a consumer subscription when invoked directly.
    private bindGlobalScrollFallbacks(): void {
        this.subscribeActivePositionTracker();
    }

    private unbindGlobalScrollFallbacks(): void {
        this.unsubscribeActivePosition?.();
        this.unsubscribeActivePosition = null;
    }

    private scheduleFrameReconcile(reason: string): void {
        this.pendingRebuildReasons.add(reason);
        if (this.rebuildTimer !== null) return;
        const run = () => {
            this.rebuildTimer = null;
            this.rebuildTimerKind = null;
            this.pendingRebuildReasons.clear();
            this.reconcile();
        };
        const ric = window.requestIdleCallback as ((cb: () => void, opts?: { timeout: number }) => number) | undefined;
        if (typeof ric === 'function') {
            this.rebuildTimer = ric.call(window, run, { timeout: 500 });
            this.rebuildTimerKind = 'idle';
        } else {
            this.rebuildTimer = window.setTimeout(run, 120);
            this.rebuildTimerKind = 'timeout';
        }
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

    private refreshRoundPositionsFromFrame(frame: ConversationSurfaceFrameV1): void {
        this.roundPositions = frame.obtainedTurns.map((entry) => {
            const turn = entry.turn;
            const mounted = entry.materialization;
            return {
                position: turn.ordinal,
                id: turn.identity.turnId,
                messageId: turn.identity.assistantMessageId,
                roundId: turn.identity.turnId,
                userMessageId: turn.identity.userMessageId,
                assistantMessageId: turn.identity.assistantMessageId,
                userPromptText: turn.userText,
                userPromptQuality: 'real' as const,
                jumpAnchor: mounted?.jumpAnchorElement ?? null,
                userAnchor: mounted?.userElement ?? null,
                assistantRoot: mounted?.assistantElement ?? null,
                groupEls: mounted ? Array.from(mounted.groupElements) : [],
            };
        });
    }

    private buildDirectoryRoundsFromFrame(frame: ConversationSurfaceFrameV1): ChatGPTConversationRound[] {
        return frame.obtainedTurns.map(({ turn }) => ({
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

    private updateActivePosition(options?: { followRail?: boolean }): void {
        if (!this.rail) return;
        if (this.isViewportResizeSuspended()) return;
        if (this.roundPositions.length === 0) {
            this.rail.setActivePosition(0, { follow: options?.followRail });
            return;
        }

        const tracked = this.activePositionTracker.refreshNow();
        const active = tracked.activePosition || this.roundPositions[0]?.position || 0;
        if (active === this.activePosition && options?.followRail === undefined) return;
        this.activePosition = active;
        this.rail.setActivePosition(active, { follow: options?.followRail });
    }

    private async handleSelect(round: ChatGPTConversationRound): Promise<void> {
        this.cancelActiveLocate();
        const locateController = new AbortController();
        this.activeLocateAbortController = locateController;
        const signal = locateController.signal;
        try {
            // History can change ordinals before the scheduled rail redraw.
            const frame = this.surface.readFrame();
            const assistantMessageId = (round.assistantMessageId ?? round.messageId)?.trim();
            const matches = assistantMessageId
                ? frame.obtainedTurns.filter((candidate) => candidate.turn.identity.assistantMessageId === assistantMessageId)
                : [];
            if (matches.length !== 1) {
                this.renderedContentToken = null;
                this.reconcile();
                return;
            }
            const entry = matches[0]!;
            if (this.navigation) {
                await this.navigation.navigate({
                    position: entry.turn.ordinal,
                    messageId: entry.turn.identity.assistantMessageId,
                    roundId: entry.turn.identity.turnId,
                    userMessageId: entry.turn.identity.userMessageId,
                    assistantMessageId: entry.turn.identity.assistantMessageId,
                    documentKey: entry.target.documentKey,
                    source: 'directory',
                }, { align: 'start', signal, timeoutMs: 15_000 });
                return;
            }
            const located = await this.surface.materialization.locate(entry.target, signal);
            if (located === 'cancelled' || signal.aborted) return;
            if (located === 'located' && !signal.aborted) {
                const current = this.surface.readFrame().obtainedTurns.find((candidate) => (
                    candidate.turn.identity.assistantMessageId === entry.turn.identity.assistantMessageId
                ));
                const anchor = current?.materialization?.jumpAnchorElement;
                if (anchor && typeof anchor.scrollIntoView === 'function') {
                    anchor.scrollIntoView({ behavior: 'auto', block: 'start' });
                }
            }
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

    private resolveBookmarkUrl(): string | null {
        const frame = this.surface.readFrame();
        if (!frame.document?.conversationId) return null;
        const url = frame.document.canonicalUrl?.trim();
        return url ? url.split('#')[0] || url : null;
    }
}
