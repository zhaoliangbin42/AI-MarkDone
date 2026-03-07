import type { Theme } from '../../../core/types/theme';
import type { BookmarksPanelController, BookmarksPanelSnapshot } from './BookmarksPanelController';
import { getBookmarksPanelCss } from './ui/styles/bookmarksPanelCss';
import { ModalHost } from '../components/ModalHost';
import { subscribeLocaleChange, t } from '../components/i18n';
import { createBookmarksPanelShell, type BookmarksPanelShellRefs } from './ui/BookmarksPanelShell';
import { BookmarksTabView } from './ui/tabs/BookmarksTabView';
import { SettingsTabView } from './ui/tabs/SettingsTabView';
import { SponsorTabView } from './ui/tabs/SponsorTabView';
import { ReaderPanel } from '../reader/ReaderPanel';
import {
    bookmarkIcon,
    coffeeIcon,
    settingsIcon,
    xIcon,
} from '../../../assets/icons';
import { mountShadowDialogHost, type ShadowDialogHostHandle } from '../components/shadowDialogHost';
import { attachDialogKeyboardScope, type DialogKeyboardScopeHandle } from '../components/dialogKeyboardScope';

function downloadJson(filename: string, data: unknown): void {
    try {
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        window.setTimeout(() => URL.revokeObjectURL(url), 500);
    } catch {
        // ignore
    }
}

type PanelRefs = BookmarksPanelShellRefs & {
    footerStatus: HTMLElement;
    footerMeta: HTMLElement;
};

export class BookmarksPanel {
    private controller: BookmarksPanelController;
    private readerPanel: ReaderPanel;
    private host: HTMLElement | null = null;
    private shadow: ShadowRoot | null = null;
    private hostHandle: ShadowDialogHostHandle | null = null;
    private keyboardHandle: DialogKeyboardScopeHandle | null = null;
    private visible: boolean = false;
    private unsubscribe: (() => void) | null = null;
    private snapshot: BookmarksPanelSnapshot | null = null;
    private refs: PanelRefs | null = null;
    private bookmarksTab: BookmarksTabView | null = null;
    private settingsTab: SettingsTabView | null = null;
    private activeTabId: 'bookmarks' | 'settings' | 'sponsor' = 'bookmarks';
    private unsubscribeLocale: (() => void) | null = null;
    private localeRemountPending = false;

    constructor(controller: BookmarksPanelController, readerPanel: ReaderPanel) {
        this.controller = controller;
        this.readerPanel = readerPanel;
    }

    isVisible(): boolean {
        return this.visible;
    }

    async toggle(): Promise<void> {
        if (this.visible) {
            this.hide();
            return;
        }
        await this.show();
    }

    async show(): Promise<void> {
        if (this.visible) return;
        this.visible = true;
        this.mount();

        this.unsubscribe = this.controller.subscribe((snap) => {
            this.snapshot = snap;
            this.render();
        });

        // Keep bookmarks scoped to the conversation URL, not hash routes like `#settings`.
        const url = window.location.href.split('#')[0] || window.location.href;
        await Promise.all([
            this.controller.refreshAll(),
            this.controller.refreshPositionsForUrl(url),
        ]);
        await this.settingsTab?.refresh();

        // Do not force-reset the tab after async refresh; keep user's selection stable.
        this.refs?.tabs.setActive(this.activeTabId);
        if (this.activeTabId === 'bookmarks') {
            this.bookmarksTab?.focusPrimaryInput();
        }
    }

    hide(): void {
        if (!this.visible) return;
        this.visible = false;
        this.unsubscribe?.();
        this.unsubscribe = null;
        this.unmount();
    }

    private mount(): void {
        if (this.host) return;

        if (!this.unsubscribeLocale) {
            this.unsubscribeLocale = subscribeLocaleChange(() => {
                if (!this.visible) return;
                if (this.localeRemountPending) return;
                this.localeRemountPending = true;
                // Remount to refresh all strings created via `t()` without threading locale through controllers/services.
                window.setTimeout(() => {
                    this.localeRemountPending = false;
                    this.remountForLocale();
                }, 0);
            });
        }

        const theme = this.controller.getTheme();
        const handle = mountShadowDialogHost({
            id: 'aimd-bookmarks-panel-host',
            html: '<div data-role="mount"></div>',
            cssText: getBookmarksPanelCss(theme),
            lockScroll: true,
        });
        const host = handle.host;
        const shadow = handle.shadow;
        const mount = shadow.querySelector<HTMLElement>('[data-role="mount"]');

        const modal = new ModalHost(shadow);

        const bookmarksTab = new BookmarksTabView({
            controller: this.controller,
            readerPanel: this.readerPanel,
            modal,
            onRequestHidePanel: () => this.hide(),
        });

        const settingsTab = new SettingsTabView({
            modal,
            onExportAllBookmarks: async () => void this.exportAll(modal),
        });

        const sponsorTab = new SponsorTabView({ githubUrl: 'https://github.com/zhaoliangbin42/AI-MarkDone' });

        const shell = createBookmarksPanelShell({
            titleText: t('tabBookmarks'),
            closeIcon: xIcon,
            closeLabel: t('btnClose'),
            tabs: [
                { id: 'bookmarks', label: t('tabBookmarks'), icon: bookmarkIcon, content: bookmarksTab.getElement() },
                { id: 'settings', label: t('tabSettings'), icon: settingsIcon, content: settingsTab.getElement() },
                { id: 'sponsor', label: t('tabSponsor'), icon: coffeeIcon, content: sponsorTab.getElement() },
            ],
            defaultTabId: this.activeTabId,
        });
        const titleByTabId = new Map<string, string>([
            ['bookmarks', t('tabBookmarks')],
            ['settings', t('tabSettings')],
            ['sponsor', t('tabSponsor')],
        ]);
        shell.tabs.getElement().addEventListener('aimd:tabs-change', (e) => {
            const ev = e as CustomEvent<{ id: string }>;
            const nextId = (ev.detail?.id as any) || 'bookmarks';
            if (nextId === 'bookmarks' || nextId === 'settings' || nextId === 'sponsor') {
                this.activeTabId = nextId;
            }
            const next = titleByTabId.get(this.activeTabId) ?? t('tabBookmarks');
            shell.title.textContent = next;
            shell.panel.setAttribute('aria-label', next);
        });

        const footer = document.createElement('div');
        footer.className = 'aimd-panel-footer';
        const status = document.createElement('div');
        status.className = 'aimd-status';
        const meta = document.createElement('div');
        meta.className = 'aimd-meta';
        footer.append(status, meta);

        shell.overlay.addEventListener('click', () => this.hide());
        shell.closeBtn.addEventListener('click', () => this.hide());

        this.keyboardHandle = attachDialogKeyboardScope({
            root: host,
            onEscape: () => {
                if (modal.isOpen()) modal.closeTop();
                else this.hide();
            },
            stopPropagationAll: true,
            ignoreEscapeWhileComposing: true,
            trapTabWithin: shell.panel,
        });

        shell.panel.appendChild(footer);
        mount?.append(shell.overlay, shell.panel);

        this.host = host;
        this.shadow = shadow;
        this.hostHandle = handle;
        this.bookmarksTab = bookmarksTab;
        this.settingsTab = settingsTab;
        this.refs = { ...shell, footerStatus: status, footerMeta: meta };
    }

    private remountForLocale(): void {
        if (!this.visible) return;
        const snap = this.snapshot;
        const activeTab = this.activeTabId;
        // Keep subscription; just rebuild DOM.
        this.unmount();
        this.snapshot = snap;
        this.mount();
        this.refs?.tabs.setActive(activeTab);
        if (activeTab === 'bookmarks') {
            this.bookmarksTab?.focusPrimaryInput();
        }
        void this.settingsTab?.refresh();
        this.render();
    }

    private unmount(): void {
        this.refs = null;
        this.snapshot = null;
        this.bookmarksTab = null;
        this.settingsTab = null;
        this.shadow = null;

        this.keyboardHandle?.detach();
        this.keyboardHandle = null;

        this.hostHandle?.unmount();
        this.hostHandle = null;

        this.host = null;
    }

    private render(): void {
        const refs = this.refs;
        const shadow = this.shadow;
        const snap = this.snapshot;
        if (!refs || !shadow || !snap) return;

        const theme: Theme = this.controller.getTheme();
        this.hostHandle?.setCss(getBookmarksPanelCss(theme));

        refs.footerStatus.textContent = snap.status || '';
        refs.footerMeta.textContent = snap.vm.bookmarks.length ? `${snap.vm.bookmarks.length}` : '';

        this.bookmarksTab?.update(snap);
    }

    private async exportAll(modal: ModalHost): Promise<void> {
        const res = await this.controller.exportAll(true);
        if (!res.ok) {
            await modal.alert({ kind: 'error', title: t('exportBookmarks'), message: res.message, confirmText: t('btnOk') });
            return;
        }
        downloadJson('ai-markdone-bookmarks.json', res.data.payload);
        this.controller.setPanelStatus(t('exportedStatus'));
    }
}
