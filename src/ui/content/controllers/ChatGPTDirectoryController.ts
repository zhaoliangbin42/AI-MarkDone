import type { Theme } from '../../../core/types/theme';
import type { SiteAdapter } from '../../../drivers/content/adapters/base';
import { scrollToBookmarkTargetWithRetry, highlightElement } from '../../../drivers/content/bookmarks/navigation';
import { RouteWatcher } from '../../../drivers/content/injection/routeWatcher';
import type { ChatGPTConversationEngine } from '../../../drivers/content/chatgpt/ChatGPTConversationEngine';
import type { ChatGPTConversationRound, ChatGPTConversationSnapshot } from '../../../drivers/content/chatgpt/types';
import { ChatGPTDirectoryRail } from '../chatgptDirectory/ChatGPTDirectoryRail';

type SkeletonAnchor = {
    position: number;
    anchorEl: HTMLElement;
};

function isChatGPTConversationPage(url: string): boolean {
    try {
        const parsed = new URL(url);
        const isChatGPT = parsed.hostname === 'chatgpt.com' || parsed.hostname === 'chat.openai.com';
        return isChatGPT && /^\/c\//.test(parsed.pathname);
    } catch {
        return false;
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
    private skeletonAnchors: SkeletonAnchor[] = [];
    private activePosition = 0;
    private rafId: number | null = null;

    constructor(adapter: SiteAdapter, engine: ChatGPTConversationEngine) {
        this.adapter = adapter;
        this.engine = engine;
    }

    init(theme: Theme): void {
        if (this.adapter.getPlatformId() !== 'chatgpt') return;
        this.theme = theme;
        this.ensureRail();
        this.routeWatcher = new RouteWatcher(() => {
            this.refresh();
        }, { intervalMs: 500 });
        this.routeWatcher.start();
        this.engine.subscribe((snapshot) => {
            this.snapshot = snapshot;
            this.render();
        });
        void this.refresh();
    }

    dispose(): void {
        if (this.rafId !== null) {
            window.cancelAnimationFrame(this.rafId);
            this.rafId = null;
        }
        this.routeWatcher?.stop();
        this.routeWatcher = null;
        this.mutationObserver?.disconnect();
        this.mutationObserver = null;
        this.scrollRoot?.removeEventListener('scroll', this.handleScroll, { capture: true } as EventListenerOptions);
        this.scrollRoot = null;
        this.rail?.dispose();
        this.rail = null;
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
        if (this.rail) return;
        this.rail = new ChatGPTDirectoryRail(this.theme, (round) => {
            void this.handleSelect(round);
        });
        document.body.appendChild(this.rail.getElement());
        this.rail.setVisible(this.enabled);
    }

    private async refresh(): Promise<void> {
        if (!this.enabled || !isChatGPTConversationPage(window.location.href)) {
            this.snapshot = null;
            this.rail?.setRounds([]);
            this.rail?.setVisible(false);
            return;
        }
        this.ensureRail();
        this.rail?.setVisible(true);
        this.snapshot = await this.engine.getSnapshot();
        this.render();
        this.rebindObservers();
    }

    private render(): void {
        if (!this.rail) return;
        const rounds = this.snapshot?.rounds ?? [];
        this.rail.setRounds(rounds);
        this.refreshSkeletonAnchors();
        this.updateActivePosition();
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
        const turnContainers = Array.from(document.querySelectorAll('[data-turn-id-container]')).filter(
            (node): node is HTMLElement => node instanceof HTMLElement,
        );
        const anchors: SkeletonAnchor[] = [];
        let pendingUserContainer: HTMLElement | null = null;

        for (const container of turnContainers) {
            const userTurn = container.querySelector('section[data-turn="user"], article[data-turn="user"], [data-turn="user"]');
            const assistantTurn = container.querySelector('section[data-turn="assistant"], article[data-turn="assistant"], [data-turn="assistant"]');

            if (userTurn instanceof HTMLElement && !(assistantTurn instanceof HTMLElement)) {
                pendingUserContainer = container;
                continue;
            }

            if (!(assistantTurn instanceof HTMLElement)) continue;
            anchors.push({
                position: anchors.length + 1,
                anchorEl: pendingUserContainer ?? container,
            });
            pendingUserContainer = null;
        }

        this.skeletonAnchors = anchors;
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
        const result = await scrollToBookmarkTargetWithRetry(
            this.adapter,
            { position: round.position, messageId: round.messageId },
            { timeoutMs: 1500, intervalMs: 120 },
        );
        if (result.ok) return;

        const anchor = this.skeletonAnchors[round.position - 1]?.anchorEl;
        if (!anchor) return;
        anchor.scrollIntoView({ behavior: 'smooth', block: 'start' });
        window.setTimeout(() => highlightElement(anchor), 80);
    }
}
