import type { SiteAdapter } from '../../../drivers/content/adapters/base';
import { computeMountedConversationGroups } from '../../../drivers/content/virtualization/conversationWindow';
import { ContentVisibilityCoordinator } from '../../../drivers/content/virtualization/contentVisibilityCoordinator';
import { classifyHeavySubtrees } from '../../../drivers/content/virtualization/heavySubtreeClassifier';
import { SubtreeCompactionStore } from '../../../drivers/content/virtualization/subtreeCompactionStore';
import type { ConversationGroupRegistryPort, ConversationRegistryGroupRef } from './ConversationGroupRegistryPort';

const RECENT_ASSISTANT_COUNT = 4;
const CONTENT_VISIBILITY_OVERSCAN_PX = 1400;
const KATEX_NODE_THRESHOLD = 1200;
const CODE_NODE_THRESHOLD = 800;
const LARGE_BLOCK_HEIGHT_PX = 800;

export class ChatGPTStablePerformanceController {
    private adapter: SiteAdapter;
    private registry: ConversationGroupRegistryPort;
    private scrollRoot: HTMLElement | null = null;
    private observedRoot: HTMLElement | null = null;
    private observer: MutationObserver | null = null;
    private scrollHandler: (() => void) | null = null;
    private syncScheduled = false;
    private disabledForPage = false;
    private streamingBudgetMode: 'normal' | 'reduced' = 'normal';
    private contentVisibility = new ContentVisibilityCoordinator();
    private compactionStore = new SubtreeCompactionStore();

    constructor(adapter: SiteAdapter, registry: ConversationGroupRegistryPort) {
        this.adapter = adapter;
        this.registry = registry;
    }

    init(): void {
        if (this.adapter.getPlatformId() !== 'chatgpt') return;
        this.scrollRoot = this.adapter.getConversationScrollRoot?.() ?? null;
        this.observedRoot = this.adapter.getObserverContainer?.() ?? this.scrollRoot;
        if (!this.scrollRoot || !this.observedRoot) return;

        this.scrollHandler = () => this.scheduleSync();
        this.scrollRoot.addEventListener('scroll', this.scrollHandler, { passive: true });
        this.observer = new MutationObserver(() => {
            if (this.streamingBudgetMode === 'reduced') return;
            this.scheduleSync();
        });
        this.observer.observe(this.observedRoot, { childList: true, subtree: true });
        this.scheduleSync();
    }

    dispose(): void {
        this.observer?.disconnect();
        this.observer = null;
        if (this.scrollRoot && this.scrollHandler) {
            this.scrollRoot.removeEventListener('scroll', this.scrollHandler);
        }
        this.scrollRoot = null;
        this.observedRoot = null;
        this.scrollHandler = null;
        this.syncScheduled = false;
        this.restoreAll();
    }

    restoreAll(): void {
        this.contentVisibility.restoreAll();
        this.compactionStore.restoreAll();
    }

    setStreamingBudgetMode(mode: 'normal' | 'reduced'): void {
        this.streamingBudgetMode = mode;
        this.scheduleSync();
    }

    private scheduleSync(): void {
        if (this.syncScheduled) return;
        this.syncScheduled = true;
        window.requestAnimationFrame(() => {
            this.syncScheduled = false;
            this.sync();
        });
    }

    private sync(): void {
        if (this.disabledForPage) return;
        const scrollRoot = this.scrollRoot;
        if (!scrollRoot) return;

        try {
            const groups = this.registry.getGroups();
            if (groups.length === 0) return;

            const viewportTop = scrollRoot.scrollTop;
            const viewportBottom = viewportTop + scrollRoot.clientHeight;
            const mounted = computeMountedConversationGroups({
                groups: groups.map((group) => ({
                    id: group.id,
                    top: group.barEl.offsetTop,
                    bottom: group.barEl.offsetTop + group.barEl.offsetHeight,
                    assistantIndex: group.assistantIndex,
                    heavy: false,
                    streaming: group.isStreaming,
                    hasFocus: this.groupHasFocus(group),
                })),
                viewportTop,
                viewportBottom,
                overscanPx: CONTENT_VISIBILITY_OVERSCAN_PX,
                preserveRecentAssistantCount: RECENT_ASSISTANT_COUNT,
            });
            const protectedIds = this.getProtectedGroupIds(groups);

            for (const group of groups) {
                const intersectsViewport = this.groupIntersectsViewport(group, viewportTop, viewportBottom);
                const shouldWarm = !group.collapsed
                    && !group.virtualized
                    && !group.isStreaming
                    && !protectedIds.has(group.id)
                    && !this.groupHasFocus(group)
                    && (this.streamingBudgetMode === 'reduced' || !mounted.has(group.id))
                    && group.bodyEls.length > 0;

                if (!shouldWarm) {
                    this.restoreWarmOptimizations(group.id);
                    continue;
                }

                this.contentVisibility.apply(group.id, group.bodyEls);
                if (!intersectsViewport) {
                    const heavyRefs = this.adapter.getHeavySubtreeRefs?.(group.bodyEls) ?? [];
                    const heavyTargets = classifyHeavySubtrees(heavyRefs, {
                        katexNodeThreshold: KATEX_NODE_THRESHOLD,
                        codeNodeThreshold: CODE_NODE_THRESHOLD,
                        largeBlockHeightPx: LARGE_BLOCK_HEIGHT_PX,
                    });
                    this.compactionStore.compact(group.id, heavyTargets);
                } else {
                    this.compactionStore.restore(group.id);
                }
            }
        } catch {
            this.disabledForPage = true;
            this.restoreAll();
        }
    }

    private restoreWarmOptimizations(groupId: string): void {
        this.contentVisibility.restore(groupId);
        this.compactionStore.restore(groupId);
    }

    private groupHasFocus(group: ConversationRegistryGroupRef): boolean {
        const active = document.activeElement as Node | null;
        if (active && group.bodyEls.some((el) => el.contains(active))) {
            return true;
        }

        const selection = window.getSelection?.();
        const anchorNode = selection?.anchorNode ?? null;
        const focusNode = selection?.focusNode ?? null;
        if (anchorNode && group.bodyEls.some((el) => el.contains(anchorNode))) {
            return true;
        }
        if (focusNode && group.bodyEls.some((el) => el.contains(focusNode))) {
            return true;
        }

        return false;
    }

    private getProtectedGroupIds(groups: ConversationRegistryGroupRef[]): Set<string> {
        const protectedIds = new Set<string>();
        if (this.streamingBudgetMode !== 'reduced') return protectedIds;

        const streamingIndices = groups.filter((group) => group.isStreaming).map((group) => group.assistantIndex);
        if (streamingIndices.length === 0) return protectedIds;
        const latestStreamingIndex = Math.max(...streamingIndices);
        const minProtectedIndex = latestStreamingIndex - 2;

        for (const group of groups) {
            if (group.assistantIndex >= minProtectedIndex || this.groupHasFocus(group)) {
                protectedIds.add(group.id);
            }
        }

        return protectedIds;
    }

    private groupIntersectsViewport(
        group: ConversationRegistryGroupRef,
        viewportTop: number,
        viewportBottom: number
    ): boolean {
        const top = group.barEl.offsetTop;
        const bottom = top + group.barEl.offsetHeight + group.bodyEls.reduce((sum, el) => sum + el.offsetHeight, 0);
        return bottom >= viewportTop && top <= viewportBottom;
    }
}
