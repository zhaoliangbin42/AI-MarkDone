import type { Theme } from '../../../core/types/theme';
import type { SiteAdapter } from '../../../drivers/content/adapters/base';
import { RouteWatcher } from '../../../drivers/content/injection/routeWatcher';
import type { ChatGPTConversationEngine } from '../../../drivers/content/chatgpt/ChatGPTConversationEngine';
import type { ChatGPTConversationRound, ChatGPTConversationSnapshot } from '../../../drivers/content/chatgpt/types';
import { ChatGPTCompactDirectoryRail } from '../chatgptDirectory/ChatGPTCompactDirectoryRail';
import {
    collectChatGPTRoundPositions,
    navigateChatGPTDirectoryTarget,
    type ChatGPTRoundPosition,
} from '../chatgptDirectory/navigation';
import type { UserThemeOverrides } from '../../../style/tokens';

function isChatGPTConversationPage(url: string): boolean {
    try {
        const parsed = new URL(url);
        return /(?:^|\/)c\/[0-9a-f-]{8,}/i.test(parsed.pathname);
    } catch {
        return false;
    }
}

function hasChatGPTConversationDom(): boolean {
    return Boolean(document.querySelector(
        '[data-turn-id-container] [data-turn], [data-message-author-role="user"], [data-message-author-role="assistant"], [data-testid^="conversation-turn-"]'
    ));
}

function isLowQualityPrompt(prompt: string | null | undefined): boolean {
    const normalized = (prompt ?? '').trim();
    return !normalized || /^Message\s+\d+$/i.test(normalized);
}

export class ChatGPTCompactDirectoryController {
    private adapter: SiteAdapter;
    private engine: ChatGPTConversationEngine;
    private rail: ChatGPTCompactDirectoryRail | null = null;
    private theme: Theme = 'light';
    private themeOverrides: UserThemeOverrides = {};
    private enabled = true;
    private snapshot: ChatGPTConversationSnapshot | null = null;
    private routeWatcher: RouteWatcher | null = null;
    private scrollRoot: HTMLElement | null = null;
    private mutationObserver: MutationObserver | null = null;
    private observedContainer: HTMLElement | null = null;
    private roundPositions: ChatGPTRoundPosition[] = [];
    private activePosition = 0;
    private rafId: number | null = null;
    private rebuildTimer: number | null = null;
    private refreshRetryTimer: number | null = null;
    private refreshRetryCount = 0;
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
        this.routeWatcher = new RouteWatcher(() => {
            this.refreshRetryCount = 0;
            void this.refresh();
        }, { intervalMs: 500 });
        this.routeWatcher.start();
        this.unsubscribeEngine = this.engine.subscribe((snapshot) => {
            this.snapshot = snapshot;
            this.render();
        }, { live: false });
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
        if (this.refreshRetryTimer !== null) {
            window.clearTimeout(this.refreshRetryTimer);
            this.refreshRetryTimer = null;
        }
        this.refreshRetryCount = 0;
        this.routeWatcher?.stop();
        this.routeWatcher = null;
        this.unsubscribeEngine?.();
        this.unsubscribeEngine = null;
        this.mutationObserver?.disconnect();
        this.mutationObserver = null;
        this.observedContainer = null;
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

    setThemeOverrides(overrides: UserThemeOverrides): void {
        this.themeOverrides = { ...overrides };
        this.rail?.setThemeOverrides(this.themeOverrides);
    }

    setEnabled(enabled: boolean): void {
        this.enabled = enabled;
        this.rail?.setVisible(enabled);
        if (enabled) {
            this.refreshRetryCount = 0;
            void this.refresh();
        } else if (this.refreshRetryTimer !== null) {
            window.clearTimeout(this.refreshRetryTimer);
            this.refreshRetryTimer = null;
        }
    }

    private ensureRail(): void {
        if (this.rail) {
            const element = this.rail.getElement();
            if (!element.isConnected) document.body.appendChild(element);
            return;
        }
        this.rail = new ChatGPTCompactDirectoryRail(this.theme, (round) => {
            void this.handleSelect(round);
        }, this.themeOverrides);
        document.body.appendChild(this.rail.getElement());
        this.rail.setVisible(this.enabled);
    }

    private async refresh(): Promise<void> {
        this.rebindObservers();
        if (!this.enabled || (!isChatGPTConversationPage(window.location.href) && !hasChatGPTConversationDom())) {
            this.snapshot = null;
            this.rail?.setRounds([]);
            this.rail?.setVisible(false);
            if (this.enabled) this.scheduleRefreshRetry();
            return;
        }
        this.ensureRail();
        this.snapshot = this.engine.peekCurrentSnapshot?.() ?? this.snapshot;
        this.render();
    }

    private render(): void {
        if (!this.rail) return;
        this.roundPositions = collectChatGPTRoundPositions(this.adapter);
        const rounds = this.buildDirectoryRounds();
        this.rail.setRounds(rounds);
        this.updateActivePosition();
        this.rail.setVisible(this.enabled && rounds.length >= 1 && rounds.length <= 4);
        if (rounds.length === 0) this.scheduleRefreshRetry();
        else this.refreshRetryCount = 0;
    }

    private buildDirectoryRounds(): ChatGPTConversationRound[] {
        const snapshotsByPosition = new Map<number, ChatGPTConversationRound>();
        for (const round of this.snapshot?.rounds ?? []) snapshotsByPosition.set(round.position, round);

        return this.roundPositions.map((position) => {
            const snapshot = snapshotsByPosition.get(position.position);
            const domPrompt = position.userPromptText?.trim() ?? '';
            const snapshotPrompt = snapshot?.userPrompt?.trim() ?? '';
            const userPrompt = !isLowQualityPrompt(domPrompt)
                ? domPrompt
                : (!isLowQualityPrompt(snapshotPrompt) ? snapshotPrompt : (domPrompt || snapshotPrompt || `Message ${position.position}`));

            return {
                id: snapshot?.id ?? position.id ?? `chatgpt-compact-directory-${position.position}`,
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

        const observerContainer = this.adapter.getObserverContainer();
        if (this.mutationObserver && this.observedContainer === observerContainer) return;
        this.mutationObserver?.disconnect();
        this.observedContainer = observerContainer ?? null;
        if (!observerContainer) return;
        this.mutationObserver = new MutationObserver((mutations) => {
            if (mutations.some((mutation) => this.shouldRebuildForMutation(mutation))) this.scheduleRefresh();
        });
        this.mutationObserver.observe(observerContainer, { childList: true, subtree: true });
    }

    private shouldRebuildForMutation(mutation: MutationRecord): boolean {
        const nodes = [...Array.from(mutation.addedNodes), ...Array.from(mutation.removedNodes)];
        return nodes.some((node) => {
            if (!(node instanceof Element) && !(node instanceof DocumentFragment)) return false;
            if (node instanceof Element && node.closest('[data-aimd-role], .aimd-message-toolbar-host, #aimd-chatgpt-compact-directory-rail, #aimd-chatgpt-compact-directory-popover')) return false;
            const selector = '[data-turn-id-container], [data-turn="user"], [data-turn="assistant"], [data-message-author-role="user"], [data-message-author-role="assistant"], [data-testid^="conversation-turn-"]';
            try {
                return (node instanceof Element && node.matches(selector)) || node.querySelector(selector) instanceof HTMLElement;
            } catch {
                return false;
            }
        });
    }

    private scheduleRefresh(): void {
        if (this.rebuildTimer !== null) return;
        this.rebuildTimer = window.setTimeout(() => {
            this.rebuildTimer = null;
            void this.refresh();
        }, 120);
    }

    private scheduleRefreshRetry(): void {
        if (this.refreshRetryTimer !== null) return;
        if (this.refreshRetryCount >= 6) return;
        const delays = [250, 500, 900, 1400, 2200, 3200];
        const delay = delays[this.refreshRetryCount] ?? 3200;
        this.refreshRetryCount += 1;
        this.refreshRetryTimer = window.setTimeout(() => {
            this.refreshRetryTimer = null;
            if (!this.enabled) return;
            void this.refresh();
        }, delay);
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

    private updateActivePosition(): void {
        if (!this.rail) return;
        if (this.roundPositions.length === 0) {
            this.activePosition = 0;
            this.rail.setActivePosition(0);
            return;
        }

        const referenceY = Math.round(window.innerHeight * 0.35);
        const ranges = this.roundPositions
            .map((position) => {
                const nodes = position.groupEls.length ? position.groupEls : [position.jumpAnchor];
                let top = Number.POSITIVE_INFINITY;
                let bottom = Number.NEGATIVE_INFINITY;
                for (const node of nodes) {
                    if (!node.isConnected) continue;
                    const rect = node.getBoundingClientRect();
                    top = Math.min(top, rect.top);
                    bottom = Math.max(bottom, rect.bottom);
                }
                return Number.isFinite(top) && Number.isFinite(bottom) ? { position: position.position, top, bottom } : null;
            })
            .filter((range): range is { position: number; top: number; bottom: number } => range !== null);

        let active = ranges.find((range) => range.top <= referenceY && range.bottom >= referenceY)?.position ?? 0;
        if (!active && ranges.length > 0) {
            active = ranges.reduce((nearest, range) => {
                const nearestDistance = this.getRangeDistance(nearest, referenceY);
                const nextDistance = this.getRangeDistance(range, referenceY);
                return nextDistance < nearestDistance ? range : nearest;
            }, ranges[0]!).position;
        }
        this.activePosition = active || this.activePosition || this.roundPositions[0]?.position || 0;
        this.rail.setActivePosition(this.activePosition);
    }

    private getRangeDistance(range: { top: number; bottom: number }, referenceY: number): number {
        if (referenceY < range.top) return range.top - referenceY;
        if (referenceY > range.bottom) return referenceY - range.bottom;
        return 0;
    }

    private async handleSelect(round: ChatGPTConversationRound): Promise<void> {
        await navigateChatGPTDirectoryTarget(
            this.adapter,
            { position: round.position, messageId: round.messageId },
            { timeoutMs: 1500, intervalMs: 120 },
        );
    }
}
