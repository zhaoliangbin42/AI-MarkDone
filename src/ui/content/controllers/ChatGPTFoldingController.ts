import type { Theme } from '../../../core/types/theme';
import type { ConversationGroupRef, SiteAdapter } from '../../../drivers/content/adapters/base';
import { logger } from '../../../core/logger';
import { RouteWatcher } from '../../../drivers/content/injection/routeWatcher';
import { subscribeLocaleChange } from '../components/i18n';
import {
    computeCollapsedGroupIndices,
    normalizeFoldingMode,
    normalizeKeepLastN,
    normalizeShowDock,
    type FoldingMode,
} from '../../../core/chatgptFolding/policy';
import { ChatGPTFoldBar } from '../chatgptFolding/ChatGPTFoldBar';
import { ChatGPTFoldDock } from '../chatgptFolding/ChatGPTFoldDock';
import type { ConversationGroupRegistryPort, ConversationRegistryGroupRef } from './ConversationGroupRegistryPort';

const GROUP_ID_ATTR = 'data-aimd-fold-group-id';
const FOLDED_ATTR = 'data-aimd-folded';
const VIRTUALIZED_ATTR = 'data-aimd-virtualized';
const ROLE_ATTR = 'data-aimd-fold-role';
const HOST_STYLE_ID = 'aimd-chatgpt-folding-host-style';

const MAX_SELECTOR_MISS_STREAK = 3;

type FoldGroup = {
    id: string;
    userRootEl: HTMLElement | null;
    assistantRootEl: HTMLElement;
    assistantMessageEl: HTMLElement;
    userTitle: string;
    bar: ChatGPTFoldBar;
    barEl: HTMLElement;
    collapsed: boolean;
    virtualized: boolean;
    mountedBodyEls: HTMLElement[];
    placeholderEl: HTMLElement | null;
    streaming: boolean;
};

type VirtualizationCallbacks = {
    onRestoreVirtualizedGroup?: (groupId: string) => void;
};

export type ChatGPTVirtualizationGroupRef = {
    id: string;
    title: string;
    barEl: HTMLElement;
    bodyEls: HTMLElement[];
    assistantRootEl: HTMLElement;
    assistantIndex: number;
    collapsed: boolean;
    virtualized: boolean;
    isStreaming: boolean;
};

function stripHash(url: string): string {
    try {
        const u = new URL(url);
        u.hash = '';
        return `${u.origin}${u.pathname}${u.search}`;
    } catch {
        return url.split('#')[0] || url;
    }
}

export class ChatGPTFoldingController implements ConversationGroupRegistryPort {
    private adapter: SiteAdapter | null = null;
    private theme: Theme = 'light';
    private mode: FoldingMode = 'off';
    private keepLastN: number = 8;
    private showDock: boolean = true;

    private dock: ChatGPTFoldDock | null = null;
    private dockObserver: MutationObserver | null = null;
    private routeWatcher: RouteWatcher | null = null;
    private unsubscribeLocale: (() => void) | null = null;

    private groupsByAssistant = new WeakMap<HTMLElement, FoldGroup>();
    private groups: FoldGroup[] = [];
    private groupCounter = 0;

    private registerScheduled = false;
    private initialPolicyApplied = false;
    private readonly barMaxWidthPx = 800;
    private selectorMissStreak = 0;
    private degradedMode = false;
    private hasLoggedDegrade = false;
    private virtualizationCallbacks: VirtualizationCallbacks = {};

    init(adapter: SiteAdapter, initialTheme: Theme): void {
        this.adapter = adapter;
        this.theme = initialTheme;
        this.ensureHostStyles();
        this.ensureDockVisibility();
        this.observeDockHost();
        this.subscribeToLocaleChanges();

        // Try to apply initial fold policy; if turns aren't ready, this will no-op and be retried via registerMessage().
        this.applyToExisting();

        this.routeWatcher = new RouteWatcher((nextUrl, prevUrl) => {
            const hardChange = stripHash(nextUrl) !== stripHash(prevUrl);
            if (!hardChange) return;
            // Conversation switched: reset DOM state and re-apply policy.
            this.resetSelectorHealth();
            this.unfoldAll();
            this.initialPolicyApplied = false;
            this.applyToExisting();
        }, { intervalMs: 500 });
        this.routeWatcher.start();
    }

    dispose(): void {
        this.routeWatcher?.stop();
        this.routeWatcher = null;
        this.unsubscribeLocale?.();
        this.unsubscribeLocale = null;
        this.dockObserver?.disconnect();
        this.dockObserver = null;
        this.dock?.dispose();
        this.dock = null;
        this.unfoldAll();
        this.adapter = null;
    }

    setTheme(theme: Theme): void {
        this.theme = theme;
        this.groups.forEach((g) => g.bar.setTheme(theme));
        this.dock?.setTheme(theme);
    }

    setPolicy(next: { foldingMode: unknown; defaultExpandedCount: unknown; showFoldDock: unknown }): void {
        const nextMode = normalizeFoldingMode(next.foldingMode);
        const nextKeepLastN = normalizeKeepLastN(next.defaultExpandedCount);
        const nextShowDock = normalizeShowDock(next.showFoldDock);

        if (nextMode === this.mode && nextKeepLastN === this.keepLastN && nextShowDock === this.showDock) return;

        this.mode = nextMode;
        this.keepLastN = nextKeepLastN;
        this.showDock = nextShowDock;
        this.ensureDockVisibility();

        // UI-first behavior: settings changes should be immediately observable.
        // (Legacy deferred application makes it look like settings are "not wired".)
        if (this.mode === 'off') {
            this.resetSelectorHealth();
            this.unfoldAll();
        } else {
            this.resetSelectorHealth();
            this.initialPolicyApplied = false;
            this.applyToExisting();
        }
    }

    registerMessage(_assistantMessageEl: HTMLElement): void {
        if (this.mode === 'off') return;
        if (!this.initialPolicyApplied) this.scheduleInitialApply();
        else this.scheduleRegisterOnly();
    }

    collapseAll(): void {
        const groups = this.syncGroupsFromDom();
        groups.forEach((g) => this.setGroupCollapsed(g, true));
    }

    expandAll(): void {
        const groups = this.syncGroupsFromDom();
        groups.forEach((g) => this.setGroupCollapsed(g, false));
    }

    canCollapseMessage(messageElement: HTMLElement): boolean {
        return this.getGroupForMessage(messageElement) !== null;
    }

    collapseGroupForMessage(messageElement: HTMLElement): boolean {
        const group = this.getGroupForMessage(messageElement);
        if (!group) return false;
        this.setGroupCollapsed(group, true);
        return true;
    }

    onRestoreRequested(callbacks: VirtualizationCallbacks): void {
        this.virtualizationCallbacks = callbacks;
    }

    setVirtualizationCallbacks(callbacks: VirtualizationCallbacks): void {
        this.onRestoreRequested(callbacks);
    }

    getGroups(): ConversationRegistryGroupRef[] {
        return this.getVirtualizationGroups();
    }

    markVirtualized(groupId: string, virtualized: boolean, placeholderEl?: HTMLElement | null): boolean {
        return this.setGroupVirtualized(groupId, virtualized, placeholderEl);
    }

    completeRestore(groupId: string): boolean {
        return this.completeGroupRestore(groupId);
    }

    getVirtualizationGroups(): ChatGPTVirtualizationGroupRef[] {
        return this.syncGroupsFromDom().map((group, assistantIndex) => ({
            id: group.id,
            title: this.getGroupDisplayTitle(group, assistantIndex),
            barEl: group.barEl,
            bodyEls: [...group.mountedBodyEls],
            assistantRootEl: group.assistantRootEl,
            assistantIndex,
            collapsed: group.collapsed,
            virtualized: group.virtualized,
            isStreaming: group.streaming,
        }));
    }

    setGroupVirtualized(groupId: string, virtualized: boolean, placeholderEl?: HTMLElement | null): boolean {
        const group = this.groups.find((item) => item.id === groupId) ?? this.syncGroupsFromDom().find((item) => item.id === groupId);
        if (!group) return false;
        group.virtualized = virtualized;
        group.placeholderEl = virtualized ? (placeholderEl ?? group.placeholderEl) : null;
        group.bar.setVirtualized(virtualized);
        group.barEl.dataset.virtualized = virtualized ? '1' : '0';
        if (virtualized) {
            group.collapsed = true;
            group.mountedBodyEls = [];
            group.bar.setCollapsed(true);
            this.ensureVirtualizedBarAnchor(group);
        } else {
            group.placeholderEl = null;
            group.mountedBodyEls = this.collectMountedBodyEls(group.userRootEl, group.assistantRootEl);
            this.setGroupCollapsed(group, group.collapsed);
        }
        return true;
    }

    completeGroupRestore(groupId: string): boolean {
        const group = this.groups.find((item) => item.id === groupId) ?? this.syncGroupsFromDom().find((item) => item.id === groupId);
        if (!group) return false;
        group.virtualized = false;
        group.placeholderEl = null;
        group.bar.setVirtualized(false);
        group.barEl.dataset.virtualized = '0';
        group.mountedBodyEls = this.collectMountedBodyEls(group.userRootEl, group.assistantRootEl);
        this.setGroupCollapsed(group, false);
        return true;
    }

    private applyToExisting(): void {
        if (!this.adapter) return;
        this.ensureDockVisibility();

        if (this.mode === 'off') {
            this.resetSelectorHealth();
            this.unfoldAll();
            return;
        }

        const groups = this.syncGroupsFromDom();
        this.updateSelectorHealth(groups.length);
        if (this.degradedMode) return;
        if (groups.length === 0) return;

        this.initialPolicyApplied = true;

        const collapsedIdx = computeCollapsedGroupIndices(this.mode, this.keepLastN, groups.length);
        groups.forEach((g, idx) => this.setGroupCollapsed(g, collapsedIdx.has(idx)));
    }

    private syncGroupsFromDom(): FoldGroup[] {
        const preservedVirtualized = this.groups.filter((group) => group.virtualized && group.barEl.isConnected);
        this.pruneDisconnectedGroups();
        this.rebuildAssistantMapFromGroups();
        this.cleanupOrphanBars();

        const refs = this.adapter?.getConversationGroupRefs?.() ?? [];
        if (refs.length === 0) {
            this.groups = preservedVirtualized;
            this.rebuildAssistantMapFromGroups();
            this.cleanupOrphanBars();
            return preservedVirtualized;
        }

        const groups = this.mergeWithPreservedVirtualized(this.buildGroupsFromRefs(refs), preservedVirtualized);
        if (groups.length === 0) {
            this.groups = preservedVirtualized;
            this.rebuildAssistantMapFromGroups();
            this.cleanupOrphanBars();
            return preservedVirtualized;
        }

        this.groups = groups;
        this.rebuildAssistantMapFromGroups();
        this.cleanupOrphanBars();

        groups.forEach((g, idx) => {
            if (g.virtualized) this.ensureVirtualizedBarAnchor(g);
            g.bar.setTitle(this.getGroupDisplayTitle(g, idx));
        });

        return groups;
    }

    private buildGroupsFromRefs(refs: ConversationGroupRef[]): FoldGroup[] {
        const groups: FoldGroup[] = [];
        for (const ref of refs) {
            const existing = this.findExistingGroup(ref.assistantRootEl, ref.userRootEl);
            if (existing) {
                this.bindMountedGroupFromRef(existing, ref);
                groups.push(existing);
                continue;
            }
            groups.push(this.createGroupFromRef(ref));
        }
        return groups;
    }

    private getGroupForMessage(messageElement: HTMLElement): FoldGroup | null {
        if (!(messageElement instanceof HTMLElement)) return null;
        const groups = this.syncGroupsFromDom();
        const group = groups.find((item) => item.assistantMessageEl === messageElement || item.assistantRootEl.contains(messageElement)) || null;
        if (!group) return null;
        return group.collapsed ? null : group;
    }

    private createGroupFromRef(ref: ConversationGroupRef): FoldGroup {
        const id = ref.id || `g${Date.now().toString(36)}-${(this.groupCounter++).toString(36)}`;
        const userRootEl = ref.userRootEl;
        const assistantRootEl = ref.assistantRootEl;
        const assistantMessageEl = ref.assistantMessageEl;
        const userTitle = this.adapter?.extractUserPrompt(assistantMessageEl) || '';

        const bar = new ChatGPTFoldBar(this.theme, {
            onToggle: () => {
                const group = this.groups.find((item) => item.id === id) ?? this.groupsByAssistant.get(assistantRootEl);
                if (!group) return;
                if (group.virtualized) {
                    this.virtualizationCallbacks.onRestoreVirtualizedGroup?.(group.id);
                    return;
                }
                this.setGroupCollapsed(group, !group.collapsed);
            },
        });

        const barEl = bar.getElement();
        barEl.setAttribute(GROUP_ID_ATTR, id);

        if (userRootEl) this.removeBarsInside(userRootEl);
        this.removeBarsInside(assistantRootEl);

        const insertionTarget = userRootEl || assistantRootEl;
        insertionTarget.parentElement?.insertBefore(barEl, insertionTarget);
        this.constrainBarWidth(barEl);

        if (userRootEl) {
            userRootEl.setAttribute(GROUP_ID_ATTR, id);
            userRootEl.setAttribute(ROLE_ATTR, 'user');
        }
        assistantRootEl.setAttribute(GROUP_ID_ATTR, id);
        assistantRootEl.setAttribute(ROLE_ATTR, 'assistant');

        const group: FoldGroup = {
            id,
            userRootEl,
            assistantRootEl,
            assistantMessageEl,
            userTitle,
            bar,
            barEl,
            collapsed: false,
            virtualized: false,
            mountedBodyEls: this.collectMountedBodyEls(userRootEl, assistantRootEl),
            placeholderEl: null,
            streaming: ref.isStreaming,
        };

        this.groupsByAssistant.set(assistantRootEl, group);
        this.setGroupCollapsed(group, false);
        return group;
    }

    private setGroupCollapsed(group: FoldGroup, collapsed: boolean): void {
        const currentCollapsed = group.collapsed;
        group.collapsed = collapsed;
        if (currentCollapsed === collapsed) {
            group.bar.setCollapsed(collapsed);
            this.constrainBarWidth(group.barEl);
            return;
        }

        group.bar.setCollapsed(collapsed);
        group.bar.setVirtualized(group.virtualized);
        this.setElementFolded(group.userRootEl, collapsed, 'user');
        this.setElementFolded(group.assistantRootEl, collapsed, 'assistant');
        this.constrainBarWidth(group.barEl);
    }

    private setElementFolded(el: HTMLElement | null, folded: boolean, role: 'user' | 'assistant'): void {
        if (!el) return;
        el.setAttribute(ROLE_ATTR, role);
        if (folded) el.setAttribute(FOLDED_ATTR, '1');
        else el.removeAttribute(FOLDED_ATTR);
    }

    private unfoldAll(): void {
        const root = this.getConversationRoot();

        root.querySelectorAll?.(`[${FOLDED_ATTR}="1"]`).forEach((el) => {
            if (el instanceof HTMLElement) el.removeAttribute(FOLDED_ATTR);
        });
        root.querySelectorAll?.(`[${VIRTUALIZED_ATTR}="1"]`).forEach((el) => {
            if (el instanceof HTMLElement) el.removeAttribute(VIRTUALIZED_ATTR);
        });
        root.querySelectorAll?.(`[${ROLE_ATTR}]`).forEach((el) => {
            if (el instanceof HTMLElement) el.removeAttribute(ROLE_ATTR);
        });
        root.querySelectorAll?.(`[${GROUP_ID_ATTR}]`).forEach((el) => {
            if (el instanceof HTMLElement) el.removeAttribute(GROUP_ID_ATTR);
        });

        this.groups.forEach((g) => g.bar.dispose());
        this.groups = [];
        this.groupsByAssistant = new WeakMap();

        root.querySelectorAll?.('.aimd-chatgpt-foldbar').forEach((el) => el.remove());
    }

    private ensureHostStyles(): void {
        const existing = document.getElementById(HOST_STYLE_ID);
        if (existing instanceof HTMLStyleElement) return;

        const style = document.createElement('style');
        style.id = HOST_STYLE_ID;
        style.textContent = `
            [${ROLE_ATTR}="user"][${FOLDED_ATTR}="1"],
            [${ROLE_ATTR}="assistant"][${FOLDED_ATTR}="1"] {
                display: none;
            }
        `;
        (document.head || document.documentElement).appendChild(style);
    }

    private ensureDockVisibility(): void {
        if (!this.showDock || this.mode === 'off') {
            this.dock?.dispose();
            this.dock = null;
            return;
        }
        if (!this.dock) {
            this.dock = new ChatGPTFoldDock(this.theme, {
                onCollapseAll: () => this.collapseAll(),
                onExpandAll: () => this.expandAll(),
            });
        }
        const dockEl = this.dock.getElement();
        if (!dockEl.isConnected && document.body) {
            document.body.appendChild(dockEl);
        }
    }

    private observeDockHost(): void {
        if (this.dockObserver) return;
        if (!document.body) return;
        this.dockObserver = new MutationObserver(() => this.ensureDockVisibility());
        this.dockObserver.observe(document.body, { childList: true });
    }

    private scheduleInitialApply(): void {
        if (this.registerScheduled) return;
        this.registerScheduled = true;
        window.setTimeout(() => {
            this.registerScheduled = false;
            try {
                this.applyToExisting();
            } catch {
                // ignore
            }
        }, 200);
    }

    private scheduleRegisterOnly(): void {
        if (this.registerScheduled) return;
        this.registerScheduled = true;
        window.setTimeout(() => {
            this.registerScheduled = false;
            try {
                const groups = this.syncGroupsFromDom();
                groups.forEach((g) => this.constrainBarWidth(g.barEl));
                this.updateSelectorHealth(groups.length);
            } catch {
                // ignore
            }
        }, 200);
    }
    private constrainBarWidth(barEl: HTMLElement): void {
        // Pure CSS centering: no measurement needed; remains centered as the page width changes.
        barEl.style.maxWidth = `${this.barMaxWidthPx}px`;
        barEl.style.marginLeft = 'auto';
        barEl.style.marginRight = 'auto';
        barEl.style.width = '100%';
        barEl.style.boxSizing = 'border-box';
    }

    private removeBarsInside(root: HTMLElement): void {
        root.querySelectorAll?.('.aimd-chatgpt-foldbar').forEach((el) => el.remove());
    }

    private pruneDisconnectedGroups(): void {
        if (this.groups.length === 0) return;
        const next: FoldGroup[] = [];
        for (const g of this.groups) {
            const hasVirtualizedAnchor = g.virtualized && (g.barEl.isConnected || g.placeholderEl?.isConnected);
            if (!g.assistantRootEl.isConnected && !hasVirtualizedAnchor) {
                g.bar.dispose();
                continue;
            }
            next.push(g);
        }
        this.groups = next;
    }

    private mergeWithPreservedVirtualized(nextGroups: FoldGroup[], preservedVirtualized: FoldGroup[]): FoldGroup[] {
        if (preservedVirtualized.length === 0) return nextGroups;
        const merged = [...nextGroups];
        const seen = new Set(nextGroups.map((group) => group.id));
        for (const group of preservedVirtualized) {
            if (seen.has(group.id)) continue;
            merged.push(group);
            seen.add(group.id);
        }
        merged.sort((a, b) => {
            if (a.barEl === b.barEl) return 0;
            const relation = a.barEl.compareDocumentPosition(b.barEl);
            if (relation & Node.DOCUMENT_POSITION_FOLLOWING) return -1;
            if (relation & Node.DOCUMENT_POSITION_PRECEDING) return 1;
            return 0;
        });
        return merged;
    }

    private rebuildAssistantMapFromGroups(): void {
        const next = new WeakMap<HTMLElement, FoldGroup>();
        for (const g of this.groups) {
            if (g.assistantRootEl instanceof HTMLElement) next.set(g.assistantRootEl, g);
        }
        this.groupsByAssistant = next;
    }

    private getGroupDisplayTitle(group: FoldGroup, idx: number): string {
        const prefix = `${idx + 1}.`;
        return group.userTitle ? `${prefix} ${group.userTitle}` : prefix;
    }

    private cleanupOrphanBars(): void {
        const root = this.getConversationRoot();
        const ownedGroupIds = new Set(this.groups.map((group) => group.id));
        const bars = Array.from(root.querySelectorAll?.('.aimd-chatgpt-foldbar') || []).filter(
            (el): el is HTMLElement => el instanceof HTMLElement
        );
        for (const barEl of bars) {
            const id = barEl.getAttribute(GROUP_ID_ATTR);
            if (!id) {
                barEl.remove();
                continue;
            }
            if (ownedGroupIds.has(id)) continue;
            const nextTurnEl = this.findNextTurnSibling(barEl);
            const nextId = nextTurnEl?.getAttribute(GROUP_ID_ATTR) || '';
            if (!nextTurnEl || nextId !== id) barEl.remove();
        }
    }

    private findExistingGroup(assistantRootEl: HTMLElement, userRootEl: HTMLElement | null): FoldGroup | null {
        const assistantGroupId = assistantRootEl.getAttribute(GROUP_ID_ATTR);
        if (assistantGroupId) {
            const byId = this.groups.find((group) => group.id === assistantGroupId);
            if (byId) return byId;
        }
        if (userRootEl) {
            const userGroupId = userRootEl.getAttribute(GROUP_ID_ATTR);
            if (userGroupId) {
                const byId = this.groups.find((group) => group.id === userGroupId);
                if (byId) return byId;
            }
        }
        return this.groupsByAssistant.get(assistantRootEl) ?? null;
    }

    private bindMountedGroupFromRef(
        group: FoldGroup,
        ref: ConversationGroupRef
    ): void {
        const userRootEl = ref.userRootEl;
        const assistantRootEl = ref.assistantRootEl;
        const assistantMessageEl = ref.assistantMessageEl;
        const insertionTarget = userRootEl || assistantRootEl;
        const parent = insertionTarget.parentElement;
        if (parent && group.barEl.previousElementSibling !== insertionTarget && group.barEl.nextElementSibling !== insertionTarget) {
            parent.insertBefore(group.barEl, insertionTarget);
        }
        if (userRootEl) {
            userRootEl.setAttribute(GROUP_ID_ATTR, group.id);
            userRootEl.setAttribute(ROLE_ATTR, 'user');
        }
        assistantRootEl.setAttribute(GROUP_ID_ATTR, group.id);
        assistantRootEl.setAttribute(ROLE_ATTR, 'assistant');

        group.userRootEl = userRootEl;
        group.assistantRootEl = assistantRootEl;
        group.assistantMessageEl = assistantMessageEl;
        group.userTitle = this.adapter?.extractUserPrompt(assistantMessageEl) || group.userTitle;
        group.streaming = ref.isStreaming;
        group.mountedBodyEls = this.collectMountedBodyEls(userRootEl, assistantRootEl);
        this.setElementFolded(userRootEl, group.collapsed, 'user');
        this.setElementFolded(assistantRootEl, group.collapsed, 'assistant');
        group.bar.setCollapsed(group.collapsed);
        group.bar.setVirtualized(group.virtualized);
        group.barEl.dataset.virtualized = group.virtualized ? '1' : '0';
        if (group.virtualized) this.ensureVirtualizedBarAnchor(group);
    }

    private collectMountedBodyEls(userRootEl: HTMLElement | null, assistantRootEl: HTMLElement): HTMLElement[] {
        return [userRootEl, assistantRootEl].filter((el): el is HTMLElement => el instanceof HTMLElement && el.isConnected);
    }

    private ensureVirtualizedBarAnchor(group: FoldGroup): void {
        if (!group.virtualized) return;
        const anchor = group.placeholderEl?.isConnected
            ? group.placeholderEl
            : (document.querySelector(`.aimd-conversation-placeholder[${GROUP_ID_ATTR}="${group.id}"]`) as HTMLElement | null);
        if (!anchor?.parentElement) return;
        group.placeholderEl = anchor;
        if (group.barEl.parentElement !== anchor.parentElement || group.barEl.nextElementSibling !== anchor) {
            anchor.parentElement.insertBefore(group.barEl, anchor);
        }
        this.constrainBarWidth(group.barEl);
    }

    private findNextTurnSibling(fromEl: HTMLElement): HTMLElement | null {
        let cursor: Element | null = fromEl.nextElementSibling;
        for (let i = 0; i < 8 && cursor; i += 1) {
            if (cursor instanceof HTMLElement) {
                if (cursor.matches('section[data-turn][data-turn-id], article, [data-message-author-role], [data-turn][data-turn-id]') || cursor.hasAttribute(GROUP_ID_ATTR)) {
                    return cursor;
                }
            }
            cursor = cursor.nextElementSibling;
        }
        return null;
    }

    private updateSelectorHealth(groupCount: number): void {
        if (groupCount > 0) {
            this.resetSelectorHealth();
            return;
        }
        const root = this.getConversationRoot();
        const hasThreadArticles = root instanceof Element && root.querySelectorAll('article').length > 0;
        if (!hasThreadArticles) return;
        this.selectorMissStreak += 1;
        if (this.selectorMissStreak < MAX_SELECTOR_MISS_STREAK) return;
        this.degradedMode = true;
        this.unfoldAll();
        if (!this.hasLoggedDegrade) {
            this.hasLoggedDegrade = true;
            logger.warn('[ChatGPTFolding] Selector health degraded; auto-disabling folding for current page lifecycle to avoid intrusive DOM mutations.');
        }
    }

    private resetSelectorHealth(): void {
        this.selectorMissStreak = 0;
        this.degradedMode = false;
        this.hasLoggedDegrade = false;
    }

    private getConversationRoot(): ParentNode {
        const root = this.adapter?.getObserverContainer?.();
        if (root instanceof HTMLElement) return root;
        return document;
    }

    private subscribeToLocaleChanges(): void {
        if (this.unsubscribeLocale) return;
        this.unsubscribeLocale = subscribeLocaleChange(() => {
            // Refresh fold bar tooltips (labels come from i18n.t inside `setCollapsed`).
            this.groups.forEach((g) => {
                const collapsed = g.assistantRootEl.getAttribute(FOLDED_ATTR) === '1';
                g.bar.setCollapsed(collapsed);
            });

            // Rebuild dock so aria-label/title are updated.
            this.dock?.dispose();
            this.dock = null;
            this.ensureDockVisibility();
        });
    }
}
