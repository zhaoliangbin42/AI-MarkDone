import type { Theme } from '../../../core/types/theme';
import type { SiteAdapter } from '../../../drivers/content/adapters/base';
import { RouteWatcher } from '../../../drivers/content/injection/routeWatcher';
import type { ChatGPTConversationEngine } from '../../../drivers/content/chatgpt/ChatGPTConversationEngine';
import type { ChatGPTConversationRound, ChatGPTConversationSnapshot } from '../../../drivers/content/chatgpt/types';
import type { ChatGPTDirectoryMode } from '../../../core/settings/types';
import { ChatGPTDirectoryRail } from '../chatgptDirectory/ChatGPTDirectoryRail';
import {
    collectChatGPTRoundPositions,
    navigateChatGPTDirectoryTarget,
    type ChatGPTRoundPosition,
    type ChatGPTSkeletonAnchor,
} from '../chatgptDirectory/navigation';

function isChatGPTConversationPage(url: string): boolean {
    try {
        const parsed = new URL(url);
        return /(?:^|\/)c\/[0-9a-f-]{8,}/i.test(parsed.pathname);
    } catch {
        return false;
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

export class ChatGPTDirectoryController {
    private adapter: SiteAdapter;
    private engine: ChatGPTConversationEngine;
    private rail: ChatGPTDirectoryRail | null = null;
    private theme: Theme = 'light';
    private enabled = true;
    private displayMode: ChatGPTDirectoryMode = 'preview';
    private snapshot: ChatGPTConversationSnapshot | null = null;
    private routeWatcher: RouteWatcher | null = null;
    private scrollRoot: HTMLElement | null = null;
    private mutationObserver: MutationObserver | null = null;
    private skeletonAnchors: ChatGPTSkeletonAnchor[] = [];
    private roundPositions: ChatGPTRoundPosition[] = [];
    private activePosition = 0;
    private rafId: number | null = null;
    private snapshotRetryTimer: number | null = null;
    private snapshotRetryCount = 0;
    private unsubscribeEngine: (() => void) | null = null;
    private initialized = false;
    private globalScrollFallbacksBound = false;

    constructor(adapter: SiteAdapter, engine: ChatGPTConversationEngine) {
        this.adapter = adapter;
        this.engine = engine;
    }

    init(theme: Theme): void {
        if (this.adapter.getPlatformId() !== 'chatgpt') return;
        this.theme = theme;
        this.ensureRail();
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
        });
        void this.refresh();
    }

    dispose(): void {
        if (this.rafId !== null) {
            window.cancelAnimationFrame(this.rafId);
            this.rafId = null;
        }
        if (this.snapshotRetryTimer !== null) {
            window.clearTimeout(this.snapshotRetryTimer);
            this.snapshotRetryTimer = null;
        }
        this.routeWatcher?.stop();
        this.routeWatcher = null;
        this.unsubscribeEngine?.();
        this.unsubscribeEngine = null;
        this.mutationObserver?.disconnect();
        this.mutationObserver = null;
        this.scrollRoot?.removeEventListener('scroll', this.handleScroll, { capture: true } as EventListenerOptions);
        this.scrollRoot = null;
        this.unbindGlobalScrollFallbacks();
        this.rail?.dispose();
        this.rail = null;
        this.initialized = false;
    }

    setTheme(theme: Theme): void {
        this.theme = theme;
        this.rail?.setTheme(theme);
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

    private ensureRail(): void {
        if (this.rail) {
            const element = this.rail.getElement();
            if (!element.isConnected) {
                document.body.appendChild(element);
                this.rail.setVisible(this.enabled);
                writeDebugState({ DirectoryHost: 'reattached' });
            }
            return;
        }
        this.rail = new ChatGPTDirectoryRail(this.theme, (round) => {
            void this.handleSelect(round);
        });
        this.rail.setDisplayMode(this.displayMode);
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
        this.snapshot = await this.engine.getSnapshot();
        this.render();
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
        this.updateActivePosition();
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
        if (this.rafId !== null) return;
        this.rafId = window.requestAnimationFrame(() => {
            this.rafId = null;
            this.updateActivePosition();
        });
    };

    private rebindObservers(): void {
        const nextScrollRoot = this.adapter.getConversationScrollRoot?.() ?? document.scrollingElement ?? null;
        if (this.scrollRoot !== nextScrollRoot) {
            this.scrollRoot?.removeEventListener('scroll', this.handleScroll, { capture: true } as EventListenerOptions);
            this.scrollRoot = nextScrollRoot instanceof HTMLElement ? nextScrollRoot : null;
            this.scrollRoot?.addEventListener('scroll', this.handleScroll, { capture: true, passive: true } as AddEventListenerOptions);
        }
        this.bindGlobalScrollFallbacks();

        this.mutationObserver?.disconnect();
        const observerContainer = this.adapter.getObserverContainer();
        if (observerContainer) {
            this.mutationObserver = new MutationObserver(() => {
                if (typeof document === 'undefined') return;
                this.render();
            });
            this.mutationObserver.observe(observerContainer, { childList: true, subtree: true });
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

    private refreshRoundPositions(): void {
        this.roundPositions = collectChatGPTRoundPositions(this.adapter);
        this.skeletonAnchors = this.roundPositions.map((position) => ({
            position: position.position,
            anchorEl: position.jumpAnchor,
        }));
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
            const userPrompt = !isLowQualityPrompt(domPrompt)
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

    private updateActivePosition(): void {
        if (!this.rail) return;
        if (this.roundPositions.length === 0) {
            this.rail.setActivePosition(0);
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
        this.rail.setActivePosition(active);
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
        const result = await navigateChatGPTDirectoryTarget(
            this.adapter,
            { position: round.position, messageId: round.messageId },
            { timeoutMs: 1500, intervalMs: 120 },
        );
        if (result.ok) return;
    }
}
