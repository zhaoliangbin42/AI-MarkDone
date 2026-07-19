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

type DirectoryBookmarksState = {
    refreshPositionsForUrl?: (url: string) => Promise<void>;
    isPositionBookmarked?: (url: string, position: number) => boolean;
    subscribe?: (listener: () => void) => () => void;
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
    private snapshotRetryTimer: number | null = null;
    private snapshotRetryCount = 0;
    private unsubscribeBookmarks: (() => void) | null = null;
    private unsubscribeRoundChanges: (() => void) | null = null;
    private unsubscribeLocale: (() => void) | null = null;
    private initialized = false;
    private globalScrollFallbacksBound = false;
    private viewportResizeSuspendBound = false;

    constructor(adapter: SiteAdapter, bookmarksState: DirectoryBookmarksState | null = null) {
        this.adapter = adapter;
        this.bookmarksState = bookmarksState;
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
            this.refresh();
        }, { intervalMs: 500 });
        this.routeWatcher.start();
        this.unsubscribeRoundChanges = this.conversationIndex.subscribe(() => {
            this.scheduleIndexRebuild('mutation');
        });
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
        if (this.snapshotRetryTimer !== null) {
            window.clearTimeout(this.snapshotRetryTimer);
            this.snapshotRetryTimer = null;
        }
        this.routeWatcher?.stop();
        this.routeWatcher = null;
        this.unsubscribeBookmarks?.();
        this.unsubscribeBookmarks = null;
        this.unsubscribeRoundChanges?.();
        this.unsubscribeRoundChanges = null;
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
                document.body.appendChild(element);
                this.rail.setVisible(this.enabled);
                writeDebugState({ DirectoryHost: 'reattached' });
            }
            return;
        }
        this.rail = new ChatGPTDirectoryRail(this.appearance.theme, (round) => {
            void this.handleSelect(round);
        }, this.appearance.overrides);
        this.rail.setDisplayMode(this.displayMode);
        this.rail.setPromptLabelMode(this.promptLabelMode);
        document.body.appendChild(this.rail.getElement());
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
        const conversationIndex = this.getConversationIndex();
        const cachedSnapshot = conversationIndex.getSnapshot();
        this.render();
        const bookmarkUrl = getDirectoryBookmarkUrl();
        const snapshotRequest = conversationIndex.ensureSnapshot().catch(() => null);
        const [snapshot] = await Promise.all([
            snapshotRequest,
            this.bookmarksState?.refreshPositionsForUrl?.(bookmarkUrl).catch(() => undefined) ?? Promise.resolve(),
        ]);
        this.render();
        if (!snapshot && !cachedSnapshot) this.scheduleSnapshotRetry();
        writeDebugState({
            DirectoryVisible: true,
            DirectoryReason: snapshot || cachedSnapshot ? 'snapshot' : 'placeholder',
            DirectoryRounds: this.roundPositions.length,
            DirectoryAnchors: this.roundPositions.filter((round) => round.jumpAnchor instanceof HTMLElement).length,
        });
    }

    private render(): void {
        if (!this.rail) return;
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

    private scheduleSnapshotRetry(): void {
        if (this.snapshotRetryTimer !== null) return;
        if (this.snapshotRetryCount >= 4) return;
        const delays = [700, 1400, 2800, 5000];
        const delay = delays[this.snapshotRetryCount] ?? 5000;
        this.snapshotRetryCount += 1;
        this.snapshotRetryTimer = window.setTimeout(() => {
            this.snapshotRetryTimer = null;
            if (!this.enabled || this.getConversationIndex().getSnapshot()) return;
            void this.refresh();
        }, delay);
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
        this.roundPositions = collectChatGPTRoundPositions(this.adapter);
    }

    private buildDirectoryRounds(): ChatGPTConversationRound[] {
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
