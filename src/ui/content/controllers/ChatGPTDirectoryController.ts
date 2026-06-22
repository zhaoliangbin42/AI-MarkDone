import type { Theme } from '../../../core/types/theme';
import type { SiteAdapter } from '../../../drivers/content/adapters/base';
import { RouteWatcher } from '../../../drivers/content/injection/routeWatcher';
import type { ChatGPTConversationEngine } from '../../../drivers/content/chatgpt/ChatGPTConversationEngine';
import type { ChatGPTConversationRound, ChatGPTConversationSnapshot } from '../../../drivers/content/chatgpt/types';
import type { ChatGPTDirectoryMode, ChatGPTDirectoryPromptLabelMode } from '../../../core/settings/types';
import { ChatGPTDirectoryRail } from '../chatgptDirectory/ChatGPTDirectoryRail';
import {
    collectChatGPTRoundPositions,
    navigateChatGPTDirectoryTarget,
    type ChatGPTRoundPosition,
    type ChatGPTSkeletonAnchor,
} from '../chatgptDirectory/navigation';
import type { UserThemeOverrides } from '../../../style/tokens';
import { AIMD_VIEWPORT_RESIZE_IDLE_EVENT } from './ViewportResizeSuspendController';

type DirectoryBookmarksState = {
    refreshPositionsForUrl?: (url: string) => Promise<void>;
    isPositionBookmarked?: (url: string, position: number) => boolean;
    subscribe?: (listener: () => void) => () => void;
};

function isChatGPTConversationPage(url: string): boolean {
    try {
        const parsed = new URL(url);
        return /(?:^|\/)c\/[0-9a-f-]{8,}/i.test(parsed.pathname);
    } catch {
        return false;
    }
}

function getChatGPTConversationId(url: string): string | null {
    try {
        const parsed = new URL(url);
        return parsed.pathname.match(/(?:^|\/)c\/([0-9a-f-]{8,})/i)?.[1] ?? null;
    } catch {
        return url.match(/(?:^|\/)c\/([0-9a-f-]{8,})/i)?.[1] ?? null;
    }
}

function hasChatGPTConversationDom(): boolean {
    return Boolean(document.querySelector('[data-turn-id-container] [data-turn]'));
}

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
    return !normalized || /^Message\s+\d+$/i.test(normalized);
}

function isLowQualityRoundPrompt(prompt: string | null | undefined, quality?: 'real' | 'fallback'): boolean {
    if (quality === 'real') return false;
    if (quality === 'fallback') return true;
    return isLowQualityPrompt(prompt);
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
    private engine: ChatGPTConversationEngine;
    private bookmarksState: DirectoryBookmarksState | null;
    private rail: ChatGPTDirectoryRail | null = null;
    private theme: Theme = 'light';
    private themeOverrides: UserThemeOverrides = {};
    private enabled = true;
    private displayMode: ChatGPTDirectoryMode = 'preview';
    private promptLabelMode: ChatGPTDirectoryPromptLabelMode = 'head';
    private snapshot: ChatGPTConversationSnapshot | null = null;
    private routeWatcher: RouteWatcher | null = null;
    private scrollRoot: HTMLElement | null = null;
    private mutationObserver: MutationObserver | null = null;
    private observedContainer: HTMLElement | null = null;
    private skeletonAnchors: ChatGPTSkeletonAnchor[] = [];
    private roundPositions: ChatGPTRoundPosition[] = [];
    private activePosition = 0;
    private rafId: number | null = null;
    private rebuildTimer: number | null = null;
    private pendingRebuildReasons = new Set<string>();
    private missingPromptHydrationPromise: Promise<void> | null = null;
    private pendingMissingPromptHydrationSignature: string | null = null;
    private requestedMissingPromptHydrationSignatures = new Set<string>();
    private snapshotRetryTimer: number | null = null;
    private snapshotRetryCount = 0;
    private unsubscribeEngine: (() => void) | null = null;
    private unsubscribeBookmarks: (() => void) | null = null;
    private initialized = false;
    private globalScrollFallbacksBound = false;
    private viewportResizeSuspendBound = false;

    constructor(adapter: SiteAdapter, engine: ChatGPTConversationEngine, bookmarksState: DirectoryBookmarksState | null = null) {
        this.adapter = adapter;
        this.engine = engine;
        this.bookmarksState = bookmarksState;
    }

    init(theme: Theme): void {
        if (this.adapter.getPlatformId() !== 'chatgpt') return;
        this.theme = theme;
        this.ensureRail();
        this.bindViewportResizeSuspend();
        if (this.initialized) {
            this.rail?.setTheme(theme);
            void this.refresh();
            return;
        }
        this.initialized = true;
        writeDebugState({ DirectoryInit: 'start' });
        this.routeWatcher = new RouteWatcher(() => {
            this.refresh();
        }, { intervalMs: 500 });
        this.routeWatcher.start();
        this.unsubscribeEngine = this.engine.subscribe((snapshot) => {
            this.snapshot = snapshot;
            if (snapshot) this.snapshotRetryCount = 0;
            this.render();
        }, { live: false });
        this.unsubscribeBookmarks = this.bookmarksState?.subscribe?.(() => {
            this.render();
        }) ?? null;
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
        this.pendingMissingPromptHydrationSignature = null;
        this.requestedMissingPromptHydrationSignatures.clear();
        this.missingPromptHydrationPromise = null;
        if (this.snapshotRetryTimer !== null) {
            window.clearTimeout(this.snapshotRetryTimer);
            this.snapshotRetryTimer = null;
        }
        this.routeWatcher?.stop();
        this.routeWatcher = null;
        this.unsubscribeEngine?.();
        this.unsubscribeEngine = null;
        this.unsubscribeBookmarks?.();
        this.unsubscribeBookmarks = null;
        this.mutationObserver?.disconnect();
        this.mutationObserver = null;
        this.observedContainer = null;
        this.scrollRoot?.removeEventListener('scroll', this.handleScroll, { capture: true } as EventListenerOptions);
        this.scrollRoot = null;
        this.unbindGlobalScrollFallbacks();
        this.unbindViewportResizeSuspend();
        this.rail?.dispose();
        this.rail = null;
        this.initialized = false;
    }

    setTheme(theme: Theme): void {
        this.theme = theme;
        this.rail?.setTheme(theme);
    }

    setThemeOverrides(overrides: UserThemeOverrides): void {
        this.themeOverrides = { ...overrides };
        this.rail?.setThemeOverrides(this.themeOverrides);
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
                document.body.appendChild(element);
                this.rail.setVisible(this.enabled);
                writeDebugState({ DirectoryHost: 'reattached' });
            }
            return;
        }
        this.rail = new ChatGPTDirectoryRail(this.theme, (round) => {
            void this.handleSelect(round);
        }, this.themeOverrides);
        this.rail.setDisplayMode(this.displayMode);
        this.rail.setPromptLabelMode(this.promptLabelMode);
        document.body.appendChild(this.rail.getElement());
        this.rail.setVisible(this.enabled);
        writeDebugState({ DirectoryHost: 'created' });
    }

    private async refresh(): Promise<void> {
        if (!this.enabled || (!isChatGPTConversationPage(window.location.href) && !hasChatGPTConversationDom())) {
            this.snapshot = null;
            this.rail?.setRounds([]);
            this.rail?.setVisible(false);
            writeDebugState({ DirectoryVisible: false, DirectoryReason: 'not-conversation' });
            return;
        }
        this.ensureRail();
        this.rail?.setVisible(true);
        this.rebindObservers();
        const conversationId = getChatGPTConversationId(window.location.href);
        const cachedSnapshot = this.engine.peekCurrentSnapshot?.() ?? null;
        if (cachedSnapshot) this.snapshot = cachedSnapshot;
        else if (conversationId && this.snapshot?.conversationId !== conversationId) this.snapshot = null;
        this.render();
        this.requestMissingPromptHydration('refresh');
        const bookmarkUrl = getDirectoryBookmarkUrl();
        const [snapshot] = await Promise.all([
            Promise.resolve(this.engine.peekCurrentSnapshot?.() ?? this.snapshot),
            this.bookmarksState?.refreshPositionsForUrl?.(bookmarkUrl).catch(() => undefined) ?? Promise.resolve(),
        ]);
        if (snapshot) this.snapshot = snapshot;
        else if (conversationId && this.snapshot?.conversationId !== conversationId) this.snapshot = null;
        this.render();
        this.requestMissingPromptHydration('refresh');
        if (!this.snapshot) this.scheduleSnapshotRetry();
        writeDebugState({
            DirectoryVisible: true,
            DirectoryReason: this.snapshot ? 'snapshot' : 'placeholder',
            DirectoryRounds: this.roundPositions.length,
            DirectoryAnchors: this.skeletonAnchors.length,
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
            if (!this.enabled || this.snapshot) return;
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

    private rebindObservers(): void {
        const nextScrollRoot = this.adapter.getConversationScrollRoot?.() ?? document.scrollingElement ?? null;
        if (this.scrollRoot !== nextScrollRoot) {
            this.scrollRoot?.removeEventListener('scroll', this.handleScroll, { capture: true } as EventListenerOptions);
            this.scrollRoot = nextScrollRoot instanceof HTMLElement ? nextScrollRoot : null;
            this.scrollRoot?.addEventListener('scroll', this.handleScroll, { capture: true, passive: true } as AddEventListenerOptions);
        }
        this.bindGlobalScrollFallbacks();

        const observerContainer = this.adapter.getObserverContainer();
        if (this.mutationObserver && this.observedContainer === observerContainer) return;
        this.mutationObserver?.disconnect();
        this.mutationObserver = null;
        this.observedContainer = observerContainer ?? null;
        if (observerContainer) {
            this.mutationObserver = new MutationObserver((mutations) => {
                if (typeof document === 'undefined') return;
                if (!this.shouldRebuildForMutations(mutations)) {
                    return;
                }
                this.scheduleIndexRebuild('mutation');
            });
            this.mutationObserver.observe(observerContainer, { childList: true, subtree: true });
        }
    }

    private scheduleIndexRebuild(reason: string): void {
        this.pendingRebuildReasons.add(reason);
        if (this.rebuildTimer !== null) return;
        const run = () => {
            this.rebuildTimer = null;
            this.pendingRebuildReasons.clear();
            this.render();
            this.requestMissingPromptHydration('mutation');
        };
        const ric = window.requestIdleCallback as ((cb: () => void, opts?: { timeout: number }) => number) | undefined;
        if (typeof ric === 'function') {
            this.rebuildTimer = ric.call(window, run, { timeout: 500 });
        } else {
            this.rebuildTimer = window.setTimeout(run, 120);
        }
    }

    private shouldRebuildForMutations(mutations: MutationRecord[]): boolean {
        for (const mutation of mutations) {
            if (this.isExtensionOwnedNode(mutation.target)) continue;
            const added = Array.from(mutation.addedNodes || []);
            const removed = Array.from(mutation.removedNodes || []);
            for (const node of [...added, ...removed]) {
                if (this.isExtensionOwnedNode(node)) continue;
                if (this.nodeMayContainConversationTurn(node)) return true;
            }
        }
        return false;
    }

    private isExtensionOwnedNode(node: Node | null | undefined): boolean {
        if (!(node instanceof Element)) return false;
        return Boolean(node.closest(
            '[data-aimd-role], .aimd-message-toolbar-host, #aimd-chatgpt-directory-rail, #aimd-chatgpt-directory-preview'
        ));
    }

    private nodeMayContainConversationTurn(node: Node): boolean {
        if (!(node instanceof Element) && !(node instanceof DocumentFragment)) return false;
        const selector = '[data-turn-id-container], [data-turn="user"], [data-turn="assistant"], [data-message-author-role="user"], [data-message-author-role="assistant"], [data-testid^="conversation-turn-"]';
        try {
            if (node instanceof Element && node.matches(selector)) return true;
            return node.querySelector(selector) instanceof HTMLElement;
        } catch {
            return false;
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
        this.skeletonAnchors = this.roundPositions.map((position) => ({
            position: position.position,
            anchorEl: position.jumpAnchor,
        }));
    }

    private requestMissingPromptHydration(_reason: string): void {
        const signature = this.buildMissingPromptHydrationSignature();
        if (!signature) return;
        if (this.requestedMissingPromptHydrationSignatures.has(signature)) return;

        this.pendingMissingPromptHydrationSignature = signature;
        if (this.missingPromptHydrationPromise) return;

        this.missingPromptHydrationPromise = this.flushMissingPromptHydration().finally(() => {
            this.missingPromptHydrationPromise = null;
        });
    }

    private async flushMissingPromptHydration(): Promise<void> {
        while (this.pendingMissingPromptHydrationSignature) {
            const signature = this.pendingMissingPromptHydrationSignature;
            this.pendingMissingPromptHydrationSignature = null;
            if (this.requestedMissingPromptHydrationSignatures.has(signature)) continue;
            this.requestedMissingPromptHydrationSignatures.add(signature);
            await this.hydrateMissingPromptLabels();
        }
    }

    private buildMissingPromptHydrationSignature(): string | null {
        if (!this.enabled || this.roundPositions.length === 0) return null;
        const missingPositions = this.getMissingPromptPositions();
        if (missingPositions.length === 0) return null;
        const conversationId = getChatGPTConversationId(window.location.href) ?? getDirectoryBookmarkUrl();
        return `${conversationId}|${this.roundPositions.length}|${missingPositions.join(',')}`;
    }

    private getMissingPromptPositions(): number[] {
        const snapshotsByPosition = new Map<number, ChatGPTConversationRound>();
        for (const round of this.snapshot?.rounds ?? []) {
            snapshotsByPosition.set(round.position, round);
        }

        return this.roundPositions
            .filter((position) => {
                const snapshot = snapshotsByPosition.get(position.position);
                const domPrompt = position.userPromptText?.trim() ?? '';
                const snapshotPrompt = snapshot?.userPrompt?.trim() ?? '';
                return isLowQualityRoundPrompt(domPrompt, position.userPromptQuality)
                    && isLowQualityPrompt(snapshotPrompt);
            })
            .map((position) => position.position);
    }

    private async hydrateMissingPromptLabels(): Promise<void> {
        try {
            const forceRefresh = (this.engine as {
                forceRefreshCurrentConversation?: () => Promise<ChatGPTConversationSnapshot | null>;
            }).forceRefreshCurrentConversation;
            const snapshot = await (
                typeof forceRefresh === 'function'
                    ? forceRefresh.call(this.engine)
                    : this.engine.getSnapshot()
            );
            if (!snapshot) return;
            this.snapshot = snapshot;
            this.snapshotRetryCount = 0;
            this.render();
        } catch {
            // Missing prompt hydration is an enhancement; DOM-discovered navigation remains usable.
        }
    }

    private buildDirectoryRounds(): ChatGPTConversationRound[] {
        const snapshotsByPosition = new Map<number, ChatGPTConversationRound>();
        for (const round of this.snapshot?.rounds ?? []) {
            snapshotsByPosition.set(round.position, round);
        }

        if (this.roundPositions.length === 0) return [];

        return this.roundPositions.map((position) => {
            const snapshot = snapshotsByPosition.get(position.position);
            const domPrompt = position.userPromptText?.trim() ?? '';
            const snapshotPrompt = snapshot?.userPrompt?.trim() ?? '';
            const userPrompt = !isLowQualityRoundPrompt(domPrompt, position.userPromptQuality)
                ? domPrompt
                : (!isLowQualityPrompt(snapshotPrompt) ? snapshotPrompt : (domPrompt || snapshotPrompt || `Message ${position.position}`));

            return {
                id: snapshot?.id ?? position.id ?? `chatgpt-skeleton-${position.position}`,
                position: position.position,
                userPrompt,
                assistantContent: snapshot?.assistantContent ?? '',
                preview: userPrompt,
                messageId: snapshot?.messageId ?? position.messageId,
                userMessageId: snapshot?.userMessageId ?? null,
                assistantMessageId: snapshot?.assistantMessageId ?? position.messageId,
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
        const ranges = this.roundPositions
            .map((position) => {
                const range = this.getRoundViewportRange(position);
                return range ? { position: position.position, ...range } : null;
            })
            .filter((range): range is { position: number; top: number; bottom: number } => range !== null);

        let active = ranges.find((range) => range.top <= referenceY && range.bottom >= referenceY)?.position ?? 0;

        if (!active && ranges.length > 0) {
            let nearest = ranges[0]!;
            let nearestDistance = this.getRangeDistanceFromReference(nearest, referenceY);
            for (const range of ranges.slice(1)) {
                const distance = this.getRangeDistanceFromReference(range, referenceY);
                if (distance < nearestDistance) {
                    nearest = range;
                    nearestDistance = distance;
                }
            }
            active = nearest.position;
        }

        if (!active) active = this.activePosition || this.roundPositions[0]?.position || 0;
        this.activePosition = active;
        this.rail.setActivePosition(active, { follow: options?.followRail });
    }

    private getRoundViewportRange(position: ChatGPTRoundPosition): { top: number; bottom: number } | null {
        const nodes = position.groupEls.length ? position.groupEls : [position.jumpAnchor];
        let top = Number.POSITIVE_INFINITY;
        let bottom = Number.NEGATIVE_INFINITY;
        for (const node of nodes) {
            if (!node.isConnected) continue;
            const rect = node.getBoundingClientRect();
            if (!Number.isFinite(rect.top) || !Number.isFinite(rect.bottom)) continue;
            top = Math.min(top, rect.top);
            bottom = Math.max(bottom, rect.bottom);
        }
        if (!Number.isFinite(top) || !Number.isFinite(bottom)) return null;
        return { top, bottom };
    }

    private getRangeDistanceFromReference(range: { top: number; bottom: number }, referenceY: number): number {
        if (referenceY < range.top) return range.top - referenceY;
        if (referenceY > range.bottom) return referenceY - range.bottom;
        return 0;
    }

    private async handleSelect(round: ChatGPTConversationRound): Promise<void> {
        const result = await this.navigateToPosition(round.position, round.messageId);
        if (result.ok) return;
    }

    private async navigateToPosition(position: number, messageId?: string | null) {
        return await navigateChatGPTDirectoryTarget(
            this.adapter,
            { position, messageId },
            { timeoutMs: 1500, intervalMs: 120 },
        );
    }
}
