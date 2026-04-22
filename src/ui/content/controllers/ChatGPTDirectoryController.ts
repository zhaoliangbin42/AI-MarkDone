import type { Theme } from '../../../core/types/theme';
import type { SiteAdapter } from '../../../drivers/content/adapters/base';
import { RouteWatcher } from '../../../drivers/content/injection/routeWatcher';
import type { ChatGPTConversationEngine } from '../../../drivers/content/chatgpt/ChatGPTConversationEngine';
import type { ChatGPTConversationRound, ChatGPTConversationSnapshot } from '../../../drivers/content/chatgpt/types';
import { ChatGPTDirectoryRail } from '../chatgptDirectory/ChatGPTDirectoryRail';
import { collectChatGPTSkeletonAnchors, navigateChatGPTDirectoryTarget, type ChatGPTSkeletonAnchor } from '../chatgptDirectory/navigation';

function isChatGPTConversationPage(url: string): boolean {
    try {
        const parsed = new URL(url);
        const isChatGPT = parsed.hostname === 'chatgpt.com' || parsed.hostname === 'chat.openai.com';
        return isChatGPT && /(?:^|\/)c\/[0-9a-f-]{8,}/i.test(parsed.pathname);
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

export class ChatGPTDirectoryController {
    private adapter: SiteAdapter;
    private engine: ChatGPTConversationEngine;
    private rail: ChatGPTDirectoryRail | null = null;
    private theme: Theme = 'light';
    private enabled = true;
    private snapshot: ChatGPTConversationSnapshot | null = null;
    private routeWatcher: RouteWatcher | null = null;
    private scrollRoot: HTMLElement | null = null;
    private mutationObserver: MutationObserver | null = null;
    private skeletonAnchors: ChatGPTSkeletonAnchor[] = [];
    private activePosition = 0;
    private rafId: number | null = null;
    private snapshotRetryTimer: number | null = null;
    private snapshotRetryCount = 0;
    private unsubscribeEngine: (() => void) | null = null;
    private initialized = false;

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
        this.snapshot = await this.engine.getSnapshot();
        this.render();
        this.rebindObservers();
        if (!this.snapshot) this.scheduleSnapshotRetry();
        writeDebugState({
            DirectoryVisible: true,
            DirectoryReason: this.snapshot ? 'snapshot' : 'placeholder',
            DirectoryRounds: this.snapshot?.rounds?.length ?? this.skeletonAnchors.length,
            DirectoryAnchors: this.skeletonAnchors.length,
        });
    }

    private render(): void {
        if (!this.rail) return;
        this.refreshSkeletonAnchors();
        const rounds = this.snapshot?.rounds?.length
            ? this.snapshot.rounds
            : this.buildPlaceholderRounds();
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

        this.mutationObserver?.disconnect();
        const observerContainer = this.adapter.getObserverContainer();
        if (observerContainer) {
            this.mutationObserver = new MutationObserver(() => {
                this.refreshSkeletonAnchors();
                this.updateActivePosition();
            });
            this.mutationObserver.observe(observerContainer, { childList: true, subtree: true });
        }
    }

    private refreshSkeletonAnchors(): void {
        this.skeletonAnchors = collectChatGPTSkeletonAnchors(this.adapter);
    }

    private buildPlaceholderRounds(): ChatGPTConversationRound[] {
        return this.skeletonAnchors.map((anchor) => ({
            id: `chatgpt-skeleton-${anchor.position}`,
            position: anchor.position,
            userPrompt: `Message ${anchor.position}`,
            assistantContent: '',
            preview: '',
            messageId: null,
            userMessageId: null,
            assistantMessageId: null,
        }));
    }

    private updateActivePosition(): void {
        if (!this.rail) return;
        if (this.skeletonAnchors.length === 0) {
            this.rail.setActivePosition(0);
            return;
        }

        const threshold = Math.max(120, Math.round(window.innerHeight * 0.22));
        let active = this.activePosition;

        for (const anchor of this.skeletonAnchors) {
            const rect = anchor.anchorEl.getBoundingClientRect();
            if (rect.top <= threshold) active = anchor.position;
            else break;
        }

        if (!active) active = this.skeletonAnchors[0]?.position ?? 0;
        this.activePosition = active;
        this.rail.setActivePosition(active);
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
