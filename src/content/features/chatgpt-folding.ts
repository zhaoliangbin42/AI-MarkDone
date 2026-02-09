import { SettingsManager } from '../../settings/SettingsManager';
import { SiteAdapter } from '../adapters/base';
import { ChatGPTFoldBar } from '../components/ChatGPTFoldBar';

type FoldingMode = 'off' | 'all' | 'keep_last_n';

const GROUP_ID_ATTR = 'data-aimd-fold-group-id';
const FOLDED_ATTR = 'data-aimd-folded';
const HOST_STYLE_ID = 'aimd-chatgpt-folding-host-style';

const USER_SELECTOR = 'article[data-turn="user"], [data-message-author-role="user"]';
const ASSISTANT_SELECTOR = 'article[data-turn="assistant"], [data-message-author-role="assistant"]';

type FoldGroup = {
    id: string;
    userEl: HTMLElement | null;
    assistantEl: HTMLElement;
    bar: ChatGPTFoldBar;
    barEl: HTMLElement;
};

export class ChatGPTFoldingController {
    private adapter: SiteAdapter | null = null;
    private mode: FoldingMode = 'off';
    private keepLastN: number = 8;
    private unsubscribeSettings: (() => void) | null = null;

    private groupsByAssistant = new WeakMap<HTMLElement, FoldGroup>();
    private groups: FoldGroup[] = [];
    private groupCounter: number = 0;

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
    }

    dispose(): void {
        this.unsubscribeSettings?.();
        this.unsubscribeSettings = null;
        this.adapter = null;
        this.unfoldAll();
    }

    registerAssistantMessage(assistantEl: HTMLElement): void {
        if (this.mode === 'off') return;
        if (this.groupsByAssistant.has(assistantEl)) return;

        // In live conversations, ChatGPT tends to append user then assistant at the end.
        // Pairing via a bounded tail scan keeps the algorithm low cost.
        this.applyToRecent();
    }

    private async loadSettings(): Promise<void> {
        const settings = await SettingsManager.getInstance().getAll();
        this.mode = this.normalizeMode(settings.performance?.chatgptFoldingMode);
        this.keepLastN = this.normalizeKeepLastN(settings.performance?.chatgptDefaultExpandedCount);
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
        if (this.mode === 'off') {
            this.unfoldAll();
            return;
        }

        const messages = this.queryOrderedMessages();
        if (messages.length === 0) return;

        const groups = this.buildGroupsFromOrderedMessages(messages);
        if (groups.length === 0) return;

        if (this.mode === 'all') {
            groups.forEach((g) => this.setGroupCollapsed(g, true));
            return;
        }

        // keep_last_n
        const start = Math.max(0, groups.length - this.keepLastN);
        groups.forEach((g, idx) => this.setGroupCollapsed(g, idx < start));
    }

    private applyToRecent(): void {
        if (this.mode === 'off') return;

        const messages = this.queryOrderedMessages().slice(-80);
        const groups = this.buildGroupsFromOrderedMessages(messages);
        if (groups.length === 0) return;

        if (this.mode === 'all') {
            groups.forEach((g) => this.setGroupCollapsed(g, true));
            return;
        }

        const start = Math.max(0, groups.length - this.keepLastN);
        groups.forEach((g, idx) => this.setGroupCollapsed(g, idx < start));
    }

    private queryOrderedMessages(): HTMLElement[] {
        // Collect both roles in DOM order and pair them deterministically.
        const assistantSelector = this.adapter?.getMessageSelector() || ASSISTANT_SELECTOR;
        const selector = `${USER_SELECTOR}, ${assistantSelector}`;
        return Array.from(document.querySelectorAll(selector)).filter((el): el is HTMLElement => el instanceof HTMLElement);
    }

    private buildGroupsFromOrderedMessages(messages: HTMLElement[]): FoldGroup[] {
        const groups: FoldGroup[] = [];
        let pendingUser: HTMLElement | null = null;

        for (const el of messages) {
            const role = el.getAttribute('data-message-author-role') || el.getAttribute('data-turn');
            const isUser = role === 'user';
            const isAssistant = role === 'assistant';

            if (isUser) {
                pendingUser = el;
                continue;
            }

            if (!isAssistant) {
                continue;
            }

            const assistantEl = el;
            const existing = this.groupsByAssistant.get(assistantEl);
            if (existing) {
                groups.push(existing);
                pendingUser = null;
                continue;
            }

            const group = this.createGroup(pendingUser, assistantEl);
            groups.push(group);
            pendingUser = null;
        }

        return groups;
    }

    private createGroup(userEl: HTMLElement | null, assistantEl: HTMLElement): FoldGroup {
        const id = `g${Date.now().toString(36)}-${(this.groupCounter++).toString(36)}`;

        const bar = new ChatGPTFoldBar({
            onToggle: () => {
                const group = this.groupsByAssistant.get(assistantEl);
                if (!group) return;
                const collapsed = assistantEl.getAttribute(FOLDED_ATTR) === '1';
                this.setGroupCollapsed(group, !collapsed);
            },
        });

        const barEl = bar.getElement();
        barEl.setAttribute(GROUP_ID_ATTR, id);

        const title = this.extractUserTitle(userEl);
        bar.setTitle(title);

        const insertBefore = userEl || assistantEl;
        insertBefore.parentElement?.insertBefore(barEl, insertBefore);
        barEl.style.display = 'block';
        barEl.style.width = '100%';

        if (userEl) userEl.setAttribute(GROUP_ID_ATTR, id);
        assistantEl.setAttribute(GROUP_ID_ATTR, id);

        const group: FoldGroup = { id, userEl, assistantEl, bar, barEl };
        this.groupsByAssistant.set(assistantEl, group);
        this.groups.push(group);

        // Ensure expanded by default; caller decides collapse policy.
        this.setGroupCollapsed(group, false);

        return group;
    }

    private setGroupCollapsed(group: FoldGroup, collapsed: boolean): void {
        group.bar.setCollapsed(collapsed);

        this.setElementFolded(group.userEl, collapsed);
        this.setElementFolded(group.assistantEl, collapsed);
    }

    private setElementFolded(el: HTMLElement | null, folded: boolean): void {
        if (!el) return;
        if (folded) {
            el.setAttribute(FOLDED_ATTR, '1');
        } else {
            el.removeAttribute(FOLDED_ATTR);
        }
    }

    private unfoldAll(): void {
        const folded = document.querySelectorAll(`[${FOLDED_ATTR}="1"]`);
        folded.forEach((el) => {
            if (el instanceof HTMLElement) el.removeAttribute(FOLDED_ATTR);
        });

        this.groups.forEach((g) => g.bar.dispose());
        this.groups = [];

        this.groupsByAssistant = new WeakMap();
    }

    private extractUserTitle(userEl: HTMLElement | null): string {
        if (!userEl) return '';
        const raw = (userEl.textContent || '').replace(/\s+/g, ' ').trim();
        if (!raw) return '';
        return raw;
    }

    private ensureHostStyles(): void {
        const existing = document.getElementById(HOST_STYLE_ID);
        if (existing) return;

        const style = document.createElement('style');
        style.id = HOST_STYLE_ID;
        style.textContent = `
            [${FOLDED_ATTR}="1"] {
                display: none;
            }
        `;
        (document.head || document.documentElement).appendChild(style);
    }
}
