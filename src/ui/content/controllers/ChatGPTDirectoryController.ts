import type { Theme } from '../../../core/types/theme';
import type { SiteAdapter } from '../../../drivers/content/adapters/base';
import { RouteWatcher } from '../../../drivers/content/injection/routeWatcher';
import { getChatGPTConversationIndex, type ChatGPTConversationIndex } from '../../../drivers/content/chatgpt/ChatGPTConversationIndex';
import type { ChatGPTConversationRound } from '../../../drivers/content/chatgpt/types';
import type { ChatGPTDirectoryMode, ChatGPTDirectoryPromptLabelMode } from '../../../core/settings/types';
import { ChatGPTDirectoryRail } from '../chatgptDirectory/ChatGPTDirectoryRail';
import {
    collectChatGPTRoundPositions,
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
import { subscribeLocaleChange, t } from '../components/i18n';
import { isChatGPTConversationPage } from '../../../drivers/content/chatgpt/chatgptRoute';
import type { ConversationContentSourceV1 } from '../../../contracts/conversationContent';
import type { ConversationMaterializationPortV1 } from '../../../contracts/conversationMaterialization';

type DirectoryBookmarksState = {
    refreshPositionsForUrl?: (url: string) => Promise<void>;
    isPositionBookmarked?: (url: string, position: number) => boolean;
    subscribe?: (listener: () => void) => () => void;
};

type ChatGPTDirectoryContentOptions = {
    contentSource?: ConversationContentSourceV1 | null;
    materialization?: ConversationMaterializationPortV1 | null;
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

function isLowQualityPrompt(prompt: string | null | undefined): boolean {
    const normalized = (prompt ?? '').trim();
    return !normalized || /^(?:Message|消息)\s+\d+$/i.test(normalized);
}

function getDirectoryMessageFallback(position: number): string {
    const key = 'chatgptDirectoryMessageFallback';
    const label = t(key, String(position));
    return !label || label === key ? `Message ${position}` : label;
}

function getDirectoryBookmarkUrl(): string {
    try {
        const parsed = new URL(window.location.href);
        parsed.hash = '';
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

    constructor(
        adapter: SiteAdapter,
        bookmarksState: DirectoryBookmarksState | null = null,
        contentOptions: ChatGPTDirectoryContentOptions = {},
    ) {
        this.adapter = adapter;
        this.bookmarksState = bookmarksState;
        this.contentSource = contentOptions.contentSource ?? null;
        this.materialization = contentOptions.materialization ?? null;
    }

    private readonly contentSource: ConversationContentSourceV1 | null;
    private readonly materialization: ConversationMaterializationPortV1 | null;

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
            this.refresh();
        }, { intervalMs: 500 });
        this.routeWatcher.start();
        this.unsubscribeRoundChanges = this.conversationIndex.subscribe(() => {
            this.scheduleIndexRebuild('mutation');
        });
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

    private getConversationIndex(): ChatGPTConversationIndex {
        return this.conversationIndex ?? getChatGPTConversationIndex(this.adapter);
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
        this.syncBookmarkedPositions(rounds);
        this.updateActivePosition();
    }

    private syncBookmarkedPositions(rounds: ChatGPTConversationRound[]): void {
        if (!this.rail || !this.bookmarksState?.isPositionBookmarked) {
            this.rail?.setBookmarkedPositions([]);
            return;
        }
        const url = getDirectoryBookmarkUrl();
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
        }
        this.bindGlobalScrollFallbacks();
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
        const contentState = this.contentSource?.read();
        if (contentState?.document && contentState.snapshot) {
            const mountedByTarget = new Map(
                (this.materialization?.read().entries ?? []).map((entry) => [
                    `${entry.target.turnId}:${entry.target.assistantMessageId}`,
                    entry.anchorElement,
                ]),
            );
            this.roundPositions = contentState.snapshot.turns.map((turn) => {
                const jumpAnchor = mountedByTarget.get(
                    `${turn.identity.turnId}:${turn.identity.assistantMessageId}`,
                ) ?? null;
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
                    userAnchor: jumpAnchor,
                    assistantRoot: jumpAnchor,
                    groupEls: jumpAnchor ? [jumpAnchor] : [],
                };
            });
            return;
        }
        this.roundPositions = collectChatGPTRoundPositions(this.adapter);
    }

    private buildDirectoryRounds(): ChatGPTConversationRound[] {
        const snapshot = this.contentSource?.read().snapshot;
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
        return this.getConversationIndex().getRounds().map(({ round }) => {
            const snapshotPrompt = round.userPrompt?.trim() ?? '';
            const usableSnapshotPrompt = isLowQualityPrompt(snapshotPrompt) ? '' : snapshotPrompt;
            const userPrompt = usableSnapshotPrompt
                || getDirectoryMessageFallback(round.position);

            return {
                ...round,
                userPrompt,
                preview: userPrompt,
            };
        });
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
        const contentState = this.contentSource?.read();
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
                });
                if (located === 'located') {
                    const entry = this.materialization.read().entries.find((candidate) => (
                        candidate.target.turnId === turn.identity.turnId
                        && candidate.target.assistantMessageId === turn.identity.assistantMessageId
                    ));
                    entry?.anchorElement.scrollIntoView({ behavior: 'auto', block: 'start' });
                    return;
                }
            }
        }
        const result = await navigateChatGPTDirectoryTarget(
            this.adapter,
            {
                position: round.position,
                messageId: round.messageId,
                roundId: round.id,
                userMessageId: round.userMessageId,
                assistantMessageId: round.assistantMessageId,
            },
            { timeoutMs: 1500, intervalMs: 120 },
        );
        if (result.ok) return;
    }
}
