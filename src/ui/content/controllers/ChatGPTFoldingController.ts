import type { Theme } from '../../../core/types/theme';
import type { SiteAdapter } from '../../../drivers/content/adapters/base';
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

const GROUP_ID_ATTR = 'data-aimd-fold-group-id';
const FOLDED_ATTR = 'data-aimd-folded';
const ROLE_ATTR = 'data-aimd-fold-role';
const GUIDE_ATTR = 'data-aimd-fold-guide';
const HOST_STYLE_ID = 'aimd-chatgpt-folding-host-style';

const USER_SELECTOR = 'article[data-turn="user"], [data-message-author-role="user"]';
const ASSISTANT_SELECTOR = 'article[data-turn="assistant"], [data-message-author-role="assistant"]';
const MAX_SELECTOR_MISS_STREAK = 3;

type FoldGroup = {
    id: string;
    userRootEl: HTMLElement | null;
    assistantRootEl: HTMLElement;
    assistantGuideEl: HTMLElement | null;
    userTitle: string;
    bar: ChatGPTFoldBar;
    barEl: HTMLElement;
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

export class ChatGPTFoldingController {
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
        this.pruneDisconnectedGroups();
        this.rebuildAssistantMapFromGroups();
        this.cleanupOrphanBars();

        const turns = this.queryOrderedTurns();
        if (turns.length === 0) {
            this.groups = [];
            this.rebuildAssistantMapFromGroups();
            this.cleanupOrphanBars();
            return [];
        }

        const groups = this.buildGroupsFromOrderedTurns(turns);
        if (groups.length === 0) {
            this.groups = [];
            this.rebuildAssistantMapFromGroups();
            this.cleanupOrphanBars();
            return [];
        }

        this.groups = groups;
        this.rebuildAssistantMapFromGroups();
        this.cleanupOrphanBars();

        groups.forEach((g, idx) => {
            const prefix = `${idx + 1}.`;
            const title = g.userTitle ? `${prefix} ${g.userTitle}` : prefix;
            g.bar.setTitle(title);
        });

        return groups;
    }

    private queryOrderedTurns(): Array<{ role: 'user' | 'assistant'; rootEl: HTMLElement; sourceEl: HTMLElement }> {
        const selectors = [USER_SELECTOR, ...this.getAssistantSelectors()];
        const selector = selectors.join(', ');
        const root = this.getConversationRoot();

        const nodes = Array.from(root.querySelectorAll(selector)).filter((el): el is HTMLElement => el instanceof HTMLElement);
        const seenRoots = new Set<HTMLElement>();
        const turns: Array<{ role: 'user' | 'assistant'; rootEl: HTMLElement; sourceEl: HTMLElement }> = [];

        for (const el of nodes) {
            const role = el.getAttribute('data-message-author-role') || el.getAttribute('data-turn');
            const isUser = role === 'user';
            const isAssistant = role === 'assistant';
            if (!isUser && !isAssistant) continue;

            const rootEl = this.getTurnRoot(el);
            if (seenRoots.has(rootEl)) continue;
            seenRoots.add(rootEl);
            turns.push({ role: isUser ? 'user' : 'assistant', rootEl, sourceEl: el });
        }

        return turns;
    }

    private getTurnRoot(el: HTMLElement): HTMLElement {
        const article = el.closest?.('article');
        return article instanceof HTMLElement ? article : el;
    }

    private buildGroupsFromOrderedTurns(
        turns: Array<{ role: 'user' | 'assistant'; rootEl: HTMLElement; sourceEl: HTMLElement }>
    ): FoldGroup[] {
        const groups: FoldGroup[] = [];
        let pendingUser: { rootEl: HTMLElement; sourceEl: HTMLElement } | null = null;

        for (const turn of turns) {
            if (turn.role === 'user') {
                pendingUser = { rootEl: turn.rootEl, sourceEl: turn.sourceEl };
                continue;
            }

            const assistantRootEl = turn.rootEl;
            const existing = this.groupsByAssistant.get(assistantRootEl);
            if (existing) {
                groups.push(existing);
                pendingUser = null;
                continue;
            }

            groups.push(this.createGroup(pendingUser, assistantRootEl));
            pendingUser = null;
        }

        return groups;
    }

    private createGroup(pendingUser: { rootEl: HTMLElement; sourceEl: HTMLElement } | null, assistantRootEl: HTMLElement): FoldGroup {
        const id = `g${Date.now().toString(36)}-${(this.groupCounter++).toString(36)}`;

        const userRootEl = pendingUser?.rootEl || null;
        const userTitle = this.extractUserTitle(pendingUser?.sourceEl || userRootEl);
        const assistantGuideEl = this.findAssistantGuideEl(assistantRootEl);

        const bar = new ChatGPTFoldBar(this.theme, {
            onToggle: () => {
                const group = this.groupsByAssistant.get(assistantRootEl);
                if (!group) return;
                const collapsed = group.assistantRootEl.getAttribute(FOLDED_ATTR) === '1';
                this.setGroupCollapsed(group, !collapsed);
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
            assistantGuideEl,
            userTitle,
            bar,
            barEl,
        };

        this.groupsByAssistant.set(assistantRootEl, group);
        this.setGroupCollapsed(group, false);
        return group;
    }

    private extractUserTitle(userEl: HTMLElement | null): string {
        if (!userEl) return '';
        const titleSource =
            userEl.querySelector?.('.whitespace-pre-wrap') ||
            userEl.querySelector?.('[data-testid="user-message"]') ||
            userEl;
        return (titleSource.textContent || '').replace(/\s+/g, ' ').trim();
    }

    private setGroupCollapsed(group: FoldGroup, collapsed: boolean): void {
        const currentCollapsed = group.assistantRootEl.getAttribute(FOLDED_ATTR) === '1';
        if (currentCollapsed === collapsed) {
            group.bar.setCollapsed(collapsed);
            this.setGuide(group.assistantGuideEl, !collapsed);
            this.constrainBarWidth(group.barEl);
            return;
        }

        group.bar.setCollapsed(collapsed);
        this.setElementFolded(group.userRootEl, collapsed, 'user');
        this.setElementFolded(group.assistantRootEl, collapsed, 'assistant');
        this.setGuide(group.assistantGuideEl, !collapsed);
        this.constrainBarWidth(group.barEl);
    }

    private setElementFolded(el: HTMLElement | null, folded: boolean, role: 'user' | 'assistant'): void {
        if (!el) return;
        el.setAttribute(ROLE_ATTR, role);
        if (folded) el.setAttribute(FOLDED_ATTR, '1');
        else el.removeAttribute(FOLDED_ATTR);
    }

    private setGuide(el: HTMLElement | null, enabled: boolean): void {
        if (!el) return;
        if (enabled) el.setAttribute(GUIDE_ATTR, '1');
        else el.removeAttribute(GUIDE_ATTR);
    }

    private unfoldAll(): void {
        const root = this.getConversationRoot();

        root.querySelectorAll?.(`[${FOLDED_ATTR}="1"]`).forEach((el) => {
            if (el instanceof HTMLElement) el.removeAttribute(FOLDED_ATTR);
        });
        root.querySelectorAll?.(`[${ROLE_ATTR}]`).forEach((el) => {
            if (el instanceof HTMLElement) el.removeAttribute(ROLE_ATTR);
        });
        root.querySelectorAll?.(`[${GROUP_ID_ATTR}]`).forEach((el) => {
            if (el instanceof HTMLElement) el.removeAttribute(GROUP_ID_ATTR);
        });
        root.querySelectorAll?.(`[${GUIDE_ATTR}="1"]`).forEach((el) => {
            if (el instanceof HTMLElement) el.removeAttribute(GUIDE_ATTR);
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

            [${GUIDE_ATTR}="1"] {
                box-shadow: inset 4px 0 0 color-mix(in srgb, var(--aimd-border-default, #9ca3af) 65%, transparent);
            }

            @supports not (color-mix(in srgb, currentColor 10%, transparent)) {
                [${GUIDE_ATTR}="1"] {
                    box-shadow: inset 4px 0 0 rgba(156, 163, 175, 0.40);
                }
                @media (prefers-color-scheme: dark) {
                    [${GUIDE_ATTR}="1"] {
                        box-shadow: inset 4px 0 0 rgba(161, 161, 170, 0.45);
                    }
                }
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
            if (!g.assistantRootEl.isConnected) {
                g.bar.dispose();
                continue;
            }
            next.push(g);
        }
        this.groups = next;
    }

    private rebuildAssistantMapFromGroups(): void {
        const next = new WeakMap<HTMLElement, FoldGroup>();
        for (const g of this.groups) next.set(g.assistantRootEl, g);
        this.groupsByAssistant = next;
    }

    private cleanupOrphanBars(): void {
        const root = this.getConversationRoot();
        const bars = Array.from(root.querySelectorAll?.('.aimd-chatgpt-foldbar') || []).filter(
            (el): el is HTMLElement => el instanceof HTMLElement
        );
        for (const barEl of bars) {
            const id = barEl.getAttribute(GROUP_ID_ATTR);
            if (!id) {
                barEl.remove();
                continue;
            }
            const nextTurnEl = this.findNextTurnSibling(barEl);
            const nextId = nextTurnEl?.getAttribute(GROUP_ID_ATTR) || '';
            if (!nextTurnEl || nextId !== id) barEl.remove();
        }
    }

    private findNextTurnSibling(fromEl: HTMLElement): HTMLElement | null {
        let cursor: Element | null = fromEl.nextElementSibling;
        for (let i = 0; i < 8 && cursor; i += 1) {
            if (cursor instanceof HTMLElement) {
                if (cursor.tagName.toLowerCase() === 'article' || cursor.matches('[data-message-author-role]') || cursor.hasAttribute(GROUP_ID_ATTR)) {
                    return cursor;
                }
            }
            cursor = cursor.nextElementSibling;
        }
        return null;
    }

    private findAssistantGuideEl(assistantRootEl: HTMLElement): HTMLElement | null {
        const preferred = assistantRootEl.querySelector('div.flex.max-w-full.flex-col.grow > div');
        if (preferred instanceof HTMLElement) return preferred;
        const container = assistantRootEl.querySelector('div.flex.max-w-full.flex-col.grow');
        if (container instanceof HTMLElement && container.firstElementChild instanceof HTMLElement) {
            return container.firstElementChild;
        }
        const prose = assistantRootEl.querySelector('.markdown.prose') || assistantRootEl.querySelector('.prose') || null;
        return prose instanceof HTMLElement ? prose : null;
    }

    private getAssistantSelectors(): string[] {
        const selectors = [this.adapter?.getMessageSelector(), ASSISTANT_SELECTOR]
            .filter((selector): selector is string => typeof selector === 'string' && selector.trim().length > 0)
            .map((selector) => selector.trim());
        return Array.from(new Set(selectors));
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
        const threadRoot = document.querySelector('#thread');
        if (threadRoot instanceof HTMLElement) return threadRoot;
        const mainRoot = document.querySelector('main');
        if (mainRoot instanceof HTMLElement) return mainRoot;
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
