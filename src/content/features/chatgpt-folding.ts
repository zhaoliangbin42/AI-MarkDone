import { SettingsManager } from '../../settings/SettingsManager';
import { SiteAdapter } from '../adapters/base';
import { ChatGPTFoldBar } from '../components/ChatGPTFoldBar';

type FoldingMode = 'off' | 'all' | 'keep_last_n';

const GROUP_ID_ATTR = 'data-aimd-fold-group-id';
const FOLDED_ATTR = 'data-aimd-folded';
const ROLE_ATTR = 'data-aimd-fold-role';
const GUIDE_ATTR = 'data-aimd-fold-guide';
const HOST_STYLE_ID = 'aimd-chatgpt-folding-host-style';

const USER_SELECTOR = 'article[data-turn="user"], [data-message-author-role="user"]';
const ASSISTANT_SELECTOR = 'article[data-turn="assistant"], [data-message-author-role="assistant"]';

type FoldGroup = {
    id: string;
    userRootEl: HTMLElement | null;
    assistantRootEl: HTMLElement;
    assistantGuideEl: HTMLElement | null;
    userTitle: string;
    bar: ChatGPTFoldBar;
    barEl: HTMLElement;
};

export class ChatGPTFoldingController {
    private adapter: SiteAdapter | null = null;
    private mode: FoldingMode = 'off';
    private keepLastN: number = 8;
    private unsubscribeSettings: (() => void) | null = null;
    private onWindowResize: (() => void) | null = null;

    private groupsByAssistant = new WeakMap<HTMLElement, FoldGroup>();
    private groups: FoldGroup[] = [];
    private groupCounter: number = 0;

    private applyScheduled: boolean = false;
    private readonly barMaxWidthPx: number = 800;

    async init(adapter: SiteAdapter): Promise<void> {
        this.adapter = adapter;
        this.ensureHostStyles();
        await this.loadSettings();

        this.applyToExisting();

        this.unsubscribeSettings = SettingsManager.getInstance().subscribe((settings) => {
            const nextMode = this.normalizeMode(settings.performance?.chatgptFoldingMode);
            const nextKeepLastN = this.normalizeKeepLastN(settings.performance?.chatgptDefaultExpandedCount);

            if (nextMode === this.mode && nextKeepLastN === this.keepLastN) return;

            this.mode = nextMode;
            this.keepLastN = nextKeepLastN;
            this.applyToExisting();
        });

        this.onWindowResize = () => {
            if (this.mode === 'off') return;
            this.scheduleApplyAll();
        };
        window.addEventListener('resize', this.onWindowResize, { passive: true });
    }

    dispose(): void {
        this.unsubscribeSettings?.();
        this.unsubscribeSettings = null;
        if (this.onWindowResize) {
            window.removeEventListener('resize', this.onWindowResize);
        }
        this.onWindowResize = null;
        this.adapter = null;
        this.unfoldAll();
    }

    registerMessage(_messageEl: HTMLElement): void {
        if (this.mode === 'off') return;
        this.scheduleApplyAll();
    }

    private async loadSettings(): Promise<void> {
        const performance = await SettingsManager.getInstance().get('performance');
        this.mode = this.normalizeMode(performance.chatgptFoldingMode);
        this.keepLastN = this.normalizeKeepLastN(performance.chatgptDefaultExpandedCount);
    }

    private normalizeMode(mode: unknown): FoldingMode {
        return mode === 'all' || mode === 'keep_last_n' || mode === 'off' ? mode : 'off';
    }

    private normalizeKeepLastN(n: unknown): number {
        const num = typeof n === 'number' ? n : Number(n);
        if (!Number.isFinite(num)) return 8;
        return Math.max(0, Math.min(200, Math.floor(num)));
    }

    private applyToExisting(): void {
        if (!this.adapter) return;

        if (this.mode === 'off') {
            this.unfoldAll();
            return;
        }

        this.cleanupLegacyWrappers();
        this.pruneDisconnectedGroups();
        this.rebuildAssistantMapFromGroups();
        this.cleanupOrphanBars();

        const turns = this.queryOrderedTurns();
        if (turns.length === 0) return;

        const groups = this.buildGroupsFromOrderedTurns(turns);
        if (groups.length === 0) return;

        this.groups = groups;
        this.rebuildAssistantMapFromGroups();
        this.cleanupOrphanBars();

        groups.forEach((g, idx) => {
            const prefix = `${idx + 1}.`;
            const title = g.userTitle ? `${prefix} ${g.userTitle}` : prefix;
            g.bar.setTitle(title);
        });

        if (this.mode === 'all') {
            groups.forEach((g) => this.setGroupCollapsed(g, true));
            return;
        }

        const start = Math.max(0, groups.length - this.keepLastN);
        groups.forEach((g, idx) => this.setGroupCollapsed(g, idx < start));
    }

    private queryOrderedTurns(): Array<{ role: 'user' | 'assistant'; rootEl: HTMLElement; sourceEl: HTMLElement }> {
        const assistantSelector = this.adapter?.getMessageSelector() || ASSISTANT_SELECTOR;
        const selector = `${USER_SELECTOR}, ${assistantSelector}`;

        const nodes = Array.from(document.querySelectorAll(selector)).filter((el): el is HTMLElement => el instanceof HTMLElement);
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
        if (article instanceof HTMLElement) return article;
        return el;
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

    private createGroup(
        pendingUser: { rootEl: HTMLElement; sourceEl: HTMLElement } | null,
        assistantRootEl: HTMLElement
    ): FoldGroup {
        const id = `g${Date.now().toString(36)}-${(this.groupCounter++).toString(36)}`;

        const userRootEl = pendingUser?.rootEl || null;
        const userTitle = this.extractUserTitle(pendingUser?.sourceEl || userRootEl);
        const assistantGuideEl = this.findAssistantGuideEl(assistantRootEl);

        const bar = new ChatGPTFoldBar({
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

        // Insert bar as a sibling before the user turn (preferred) or assistant turn.
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

        // Default expanded; caller decides collapse policy.
        this.setGroupCollapsed(group, false);
        return group;
    }

    private extractUserTitle(userEl: HTMLElement | null): string {
        if (!userEl) return '';
        const titleSource =
            userEl.querySelector?.('.whitespace-pre-wrap') ||
            userEl.querySelector?.('[data-testid="user-message"]') ||
            userEl;
        const raw = (titleSource.textContent || '').replace(/\s+/g, ' ').trim();
        return raw;
    }

    private setGroupCollapsed(group: FoldGroup, collapsed: boolean): void {
        group.bar.setCollapsed(collapsed);
        this.setElementFolded(group.userRootEl, collapsed, 'user');
        this.setElementFolded(group.assistantRootEl, collapsed, 'assistant');

        this.setGuide(group.assistantGuideEl, !collapsed);
        this.constrainBarWidth(group.barEl);
    }

    private setElementFolded(el: HTMLElement | null, folded: boolean, role: 'user' | 'assistant'): void {
        if (!el) return;
        el.setAttribute(ROLE_ATTR, role);
        if (folded) {
            el.setAttribute(FOLDED_ATTR, '1');
        } else {
            el.removeAttribute(FOLDED_ATTR);
        }
    }

    private setGuide(el: HTMLElement | null, enabled: boolean): void {
        if (!el) return;
        if (enabled) {
            el.setAttribute(GUIDE_ATTR, '1');
        } else {
            el.removeAttribute(GUIDE_ATTR);
        }
    }

    private unfoldAll(): void {
        const folded = document.querySelectorAll(`[${FOLDED_ATTR}="1"]`);
        folded.forEach((el) => {
            if (el instanceof HTMLElement) el.removeAttribute(FOLDED_ATTR);
        });

        const roles = document.querySelectorAll(`[${ROLE_ATTR}]`);
        roles.forEach((el) => {
            if (el instanceof HTMLElement) el.removeAttribute(ROLE_ATTR);
        });

        const ids = document.querySelectorAll(`[${GROUP_ID_ATTR}]`);
        ids.forEach((el) => {
            if (el instanceof HTMLElement) el.removeAttribute(GROUP_ID_ATTR);
        });

        const guides = document.querySelectorAll(`[${GUIDE_ATTR}="1"]`);
        guides.forEach((el) => {
            if (el instanceof HTMLElement) el.removeAttribute(GUIDE_ATTR);
        });

        this.groups.forEach((g) => g.bar.dispose());
        this.groups = [];
        this.groupsByAssistant = new WeakMap();

        const bars = document.querySelectorAll('.aimd-chatgpt-foldbar');
        bars.forEach((el) => el.remove());
    }

    private ensureHostStyles(): void {
        const existing = document.getElementById(HOST_STYLE_ID);
        if (existing instanceof HTMLStyleElement) return;

        const style = document.createElement('style');
        style.id = HOST_STYLE_ID;
        style.textContent = `
            /* Folded turns: hide entire user + assistant articles. */
            [${ROLE_ATTR}="user"][${FOLDED_ATTR}="1"],
            [${ROLE_ATTR}="assistant"][${FOLDED_ATTR}="1"] {
                display: none;
            }

            /* Expanded assistant: show a subtle left guide line + padding (no tokens on host page). */
            [${GUIDE_ATTR}="1"] {
                padding-left: 12px;
                box-shadow: inset 4px 0 0 color-mix(in srgb, currentColor 10%, transparent);
            }

            @supports not (color-mix(in srgb, currentColor 10%, transparent)) {
                [${GUIDE_ATTR}="1"] {
                    box-shadow: inset 4px 0 0 rgba(0, 0, 0, 0.10);
                }
                @media (prefers-color-scheme: dark) {
                    [${GUIDE_ATTR}="1"] {
                        box-shadow: inset 4px 0 0 rgba(255, 255, 255, 0.14);
                    }
                }
            }
        `;
        (document.head || document.documentElement).appendChild(style);
    }

    private scheduleApplyAll(): void {
        if (this.applyScheduled) return;
        this.applyScheduled = true;
        setTimeout(() => {
            this.applyScheduled = false;
            try {
                this.applyToExisting();
            } catch {
                // ignore
            }
        }, 200);
    }

    private constrainBarWidth(barEl: HTMLElement): void {
        barEl.style.maxWidth = `${this.barMaxWidthPx}px`;
        // Why: do not use shorthand "margin" here; it would override the bar's
        // collapsed-state bottom spacing defined in the fold bar component.
        barEl.style.marginLeft = 'auto';
        barEl.style.marginRight = 'auto';
        barEl.style.width = '100%';
        barEl.style.boxSizing = 'border-box';
    }

    private cleanupLegacyWrappers(): void {
        const wrappers = Array.from(document.querySelectorAll('.aimd-chatgpt-foldgroup'));
        wrappers.forEach((wrapper) => {
            if (!(wrapper instanceof HTMLElement)) return;
            const parent = wrapper.parentElement;
            if (!parent) return;

            const children = Array.from(wrapper.childNodes);
            children.forEach((node) => {
                parent.insertBefore(node, wrapper);
            });
            wrapper.remove();
        });
    }

    private removeBarsInside(root: HTMLElement): void {
        const bars = root.querySelectorAll('.aimd-chatgpt-foldbar');
        bars.forEach((el) => el.remove());
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
        for (const g of this.groups) {
            next.set(g.assistantRootEl, g);
        }
        this.groupsByAssistant = next;
    }

    private cleanupOrphanBars(): void {
        const bars = Array.from(document.querySelectorAll('.aimd-chatgpt-foldbar')).filter(
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
            if (!nextTurnEl || nextId !== id) {
                barEl.remove();
            }
        }
    }

    private findNextTurnSibling(fromEl: HTMLElement): HTMLElement | null {
        let cursor: Element | null = fromEl.nextElementSibling;
        for (let i = 0; i < 8 && cursor; i++) {
            if (cursor instanceof HTMLElement) {
                if (
                    cursor.tagName.toLowerCase() === 'article' ||
                    cursor.matches('[data-message-author-role]') ||
                    cursor.hasAttribute(GROUP_ID_ATTR)
                ) {
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
        if (prose instanceof HTMLElement) return prose;
        return null;
    }
}
