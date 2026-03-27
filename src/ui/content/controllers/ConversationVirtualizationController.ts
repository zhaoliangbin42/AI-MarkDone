import type { Theme } from '../../../core/types/theme';
import type { SiteAdapter } from '../../../drivers/content/adapters/base';
import { buildConversationVirtualizationPolicy } from '../../../core/conversationVirtualization/policy';
import { computeMountedConversationGroups } from '../../../drivers/content/virtualization/conversationWindow';
import { OffscreenPlaceholderStore } from '../../../drivers/content/virtualization/offscreenPlaceholderStore';
import type { ConversationGroupRegistryPort } from './ConversationGroupRegistryPort';

const STYLE_ID = 'aimd-conversation-virtualization-style';
const GROUP_ID_ATTR = 'data-aimd-fold-group-id';

export class ConversationVirtualizationController {
    private adapter: SiteAdapter;
    private foldBridge: ConversationGroupRegistryPort;
    private policy = buildConversationVirtualizationPolicy(undefined);
    private store = new OffscreenPlaceholderStore();
    private scrollRoot: HTMLElement | null = null;
    private observedRoot: HTMLElement | null = null;
    private observer: MutationObserver | null = null;
    private scrollHandler: (() => void) | null = null;
    private syncScheduled = false;
    private disabledForPage = false;

    constructor(adapter: SiteAdapter, foldBridge: ConversationGroupRegistryPort) {
        this.adapter = adapter;
        this.foldBridge = foldBridge;
        this.foldBridge.onRestoreRequested({
            onRestoreVirtualizedGroup: (groupId) => this.restoreGroup(groupId),
        });
    }

    init(initialTheme: Theme): void {
        if (this.adapter.getPlatformId() !== 'chatgpt') return;
        this.ensureStyles();
        this.setTheme(initialTheme);
        this.scrollRoot = this.adapter.getConversationScrollRoot?.() ?? null;
        this.observedRoot = this.adapter.getObserverContainer?.() ?? this.scrollRoot;
        if (!this.scrollRoot || !this.observedRoot) return;

        this.scrollHandler = () => this.scheduleSync();
        this.scrollRoot.addEventListener('scroll', this.scrollHandler, { passive: true });
        this.observer = new MutationObserver(() => this.scheduleSync());
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
        this.store.restoreAll();
    }

    setTheme(theme: Theme): void {
        document.documentElement.dataset.aimdConversationVirtualizationTheme = theme;
    }

    setPolicy(next: { foldingPowerMode?: 'off' | 'on' }): void {
        this.policy = buildConversationVirtualizationPolicy(next);
        if (!this.policy.enabled) {
            this.store.restoreAll();
            for (const group of this.foldBridge.getGroups()) {
                this.foldBridge.markVirtualized(group.id, false);
            }
            return;
        }
        this.scheduleSync();
    }

    restoreAll(): void {
        this.store.restoreAll();
        for (const group of this.foldBridge.getGroups()) {
            this.foldBridge.markVirtualized(group.id, false);
        }
    }

    private ensureStyles(): void {
        if (document.getElementById(STYLE_ID)) return;
        const style = document.createElement('style');
        style.id = STYLE_ID;
        style.textContent = `
            .aimd-conversation-placeholder {
                display: block;
                width: 100%;
                box-sizing: border-box;
                visibility: hidden;
                pointer-events: none;
            }
        `;
        (document.head || document.documentElement).appendChild(style);
    }

    private scheduleSync(): void {
        if (this.syncScheduled) return;
        this.syncScheduled = true;
        window.requestAnimationFrame(() => {
            this.syncScheduled = false;
            this.sync();
        });
    }

    private restoreGroup(groupId: string): void {
        if (!this.store.isTrimmed(groupId)) return;
        this.store.restore(groupId);
        this.foldBridge.completeRestore(groupId);
        this.scheduleSync();
    }

    private sync(): void {
        if (!this.policy.enabled || this.disabledForPage) return;
        const scrollRoot = this.scrollRoot;
        if (!scrollRoot) return;

        try {
            const groups = this.foldBridge.getGroups();
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
                overscanPx: this.policy.viewportOverscanPx,
                preserveRecentAssistantCount: this.policy.preserveRecentAssistantCount,
            });

            for (const group of groups) {
                if ((group.virtualized || this.store.isTrimmed(group.id)) && mounted.has(group.id)) {
                    this.restoreGroup(group.id);
                    continue;
                }
                if (!group.collapsed || group.isStreaming) continue;
                if (mounted.has(group.id)) continue;
                if (this.groupHasFocus(group)) continue;
                if (group.virtualized || this.store.isTrimmed(group.id)) continue;
                if (group.bodyEls.length === 0) continue;

                const placeholder = this.store.trim({
                    groupId: group.id,
                    nodes: group.bodyEls,
                    height: Math.max(1, group.bodyEls.reduce((sum, el) => sum + el.offsetHeight, 0)),
                });
                placeholder.setAttribute(GROUP_ID_ATTR, group.id);
                this.foldBridge.markVirtualized(group.id, true, placeholder);
            }
        } catch {
            this.disabledForPage = true;
            this.restoreAll();
        }
    }

    private groupHasFocus(group: ReturnType<ConversationGroupRegistryPort['getGroups']>[number]): boolean {
        const active = document.activeElement as Node | null;
        if (active) {
            if (group.barEl.contains(active)) return true;
            if (group.bodyEls.some((el) => el.contains(active))) return true;
        }

        const selection = window.getSelection?.();
        const anchorNode = selection?.anchorNode ?? null;
        const focusNode = selection?.focusNode ?? null;
        if (anchorNode && (group.barEl.contains(anchorNode) || group.bodyEls.some((el) => el.contains(anchorNode)))) {
            return true;
        }
        if (focusNode && (group.barEl.contains(focusNode) || group.bodyEls.some((el) => el.contains(focusNode)))) {
            return true;
        }

        return false;
    }
}
