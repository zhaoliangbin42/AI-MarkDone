import type { SiteAdapter } from '../../../drivers/content/adapters/base';
import type { ConversationGroupRegistryPort } from './ConversationGroupRegistryPort';

export type ChatGPTPageStabilityState = 'pending' | 'stable' | 'disabled';

type Listener = (state: ChatGPTPageStabilityState) => void;

const QUIET_WINDOW_MS = 2500;
const MAX_WAIT_MS = 20000;
const CHECK_INTERVAL_MS = 250;

export class ChatGPTPageStabilityGate {
    private adapter: SiteAdapter;
    private groups: ConversationGroupRegistryPort;
    private listeners = new Set<Listener>();
    private state: ChatGPTPageStabilityState = 'pending';
    private observer: MutationObserver | null = null;
    private intervalId: number | null = null;
    private longTaskObserver: PerformanceObserver | null = null;
    private lastActivityAt = 0;
    private lastLongTaskAt = 0;
    private startedAt = 0;
    private lastUrl = '';
    private lastNodeCount = 0;

    constructor(adapter: SiteAdapter, groups: ConversationGroupRegistryPort) {
        this.adapter = adapter;
        this.groups = groups;
    }

    init(): void {
        if (this.adapter.getPlatformId() !== 'chatgpt') {
            this.setState('disabled');
            return;
        }

        const observerRoot = this.adapter.getObserverContainer?.() ?? null;
        const scrollRoot = this.adapter.getConversationScrollRoot?.() ?? null;
        if (!observerRoot || !scrollRoot) {
            this.setState('disabled');
            return;
        }

        this.resetClock();
        this.observer = new MutationObserver(() => {
            this.lastActivityAt = performance.now();
        });
        this.observer.observe(observerRoot, { childList: true, subtree: true, characterData: true });

        try {
            this.longTaskObserver = new PerformanceObserver((list) => {
                for (const entry of list.getEntries()) {
                    this.lastLongTaskAt = entry.startTime + entry.duration;
                }
            });
            this.longTaskObserver.observe({ type: 'longtask', buffered: true });
        } catch {
            this.longTaskObserver = null;
        }

        this.intervalId = window.setInterval(() => this.evaluate(), CHECK_INTERVAL_MS);
        this.evaluate();
    }

    dispose(): void {
        this.observer?.disconnect();
        this.observer = null;
        this.longTaskObserver?.disconnect();
        this.longTaskObserver = null;
        if (this.intervalId !== null) {
            window.clearInterval(this.intervalId);
            this.intervalId = null;
        }
        this.listeners.clear();
    }

    subscribe(listener: Listener): () => void {
        this.listeners.add(listener);
        listener(this.state);
        return () => this.listeners.delete(listener);
    }

    getState(): ChatGPTPageStabilityState {
        return this.state;
    }

    private evaluate(): void {
        if (this.state === 'disabled') return;
        if (this.lastUrl !== location.href) {
            this.resetClock();
            this.setState('pending');
        }

        const now = performance.now();
        const groups = this.groups.getGroups();
        const nodeCount = document.querySelectorAll('*').length;
        if (this.lastNodeCount !== nodeCount) {
            this.lastNodeCount = nodeCount;
            this.lastActivityAt = now;
        }

        if (groups.length === 0 || groups.some((group) => group.isStreaming)) {
            if (now - this.startedAt >= MAX_WAIT_MS) this.setState('disabled');
            return;
        }

        if (now - this.startedAt >= MAX_WAIT_MS) {
            this.setState('disabled');
            return;
        }

        const quietDom = now - this.lastActivityAt >= QUIET_WINDOW_MS;
        const quietTasks = this.longTaskObserver ? now - this.lastLongTaskAt >= QUIET_WINDOW_MS : true;
        if (quietDom && quietTasks) {
            this.setState('stable');
        }
    }

    private resetClock(): void {
        const now = performance.now();
        this.startedAt = now;
        this.lastActivityAt = now;
        this.lastLongTaskAt = now;
        this.lastUrl = location.href;
        this.lastNodeCount = document.querySelectorAll('*').length;
    }

    private setState(next: ChatGPTPageStabilityState): void {
        if (this.state === next) return;
        this.state = next;
        for (const listener of this.listeners) listener(next);
    }
}
