import type { Theme } from '../../../core/types/theme';
import type { BookmarksPanelController, BookmarksPanelSnapshot } from './BookmarksPanelController';
import { ensureStyle } from '../../../style/shadow';
import { getBookmarksPanelCss } from './ui/styles/bookmarksPanelCss';
import { ModalHost } from '../components/ModalHost';
import { t } from '../components/i18n';
import { createBookmarksPanelShell, type BookmarksPanelShellRefs } from './ui/BookmarksPanelShell';
import { BookmarksTabView } from './ui/tabs/BookmarksTabView';
import { SettingsTabView } from './ui/tabs/SettingsTabView';
import { SponsorTabView } from './ui/tabs/SponsorTabView';
import { ReaderPanel } from '../reader/ReaderPanel';
import {
    bookmarkIcon,
    coffeeIcon,
    downloadIcon,
    settingsIcon,
    uploadIcon,
    wrenchIcon,
    xIcon,
    externalLinkIcon,
} from '../../../assets/icons';

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
    private visible: boolean = false;
    private unsubscribe: (() => void) | null = null;
    private snapshot: BookmarksPanelSnapshot | null = null;
    private refs: PanelRefs | null = null;
    private bookmarksTab: BookmarksTabView | null = null;

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

        const url = window.location.href;
        await Promise.all([
            this.controller.refreshAll(),
            this.controller.refreshPositionsForUrl(url),
        ]);

        this.refs?.tabs.setActive('bookmarks');
        this.bookmarksTab?.focusPrimaryInput();
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

        const host = document.createElement('div');
        host.id = 'aimd-bookmarks-panel-host';
        host.style.position = 'fixed';
        host.style.inset = '0';
        host.style.zIndex = 'var(--aimd-z-panel)';

        const shadow = host.attachShadow({ mode: 'open' });
        ensureStyle(shadow, getBookmarksPanelCss(this.controller.getTheme()));

        const modal = new ModalHost(shadow);

        const bookmarksTab = new BookmarksTabView({
            controller: this.controller,
            readerPanel: this.readerPanel,
            modal,
            onRequestHidePanel: () => this.hide(),
        });

        const settingsTab = new SettingsTabView({
            title: t('tabSettings'),
            description: t('settingsTabPlaceholder'),
            actions: [
                { id: 'export_all', icon: downloadIcon, label: t('exportAllBtn'), onClick: () => void this.exportAll(modal) },
                { id: 'import', icon: uploadIcon, label: t('importBookmarks') },
                { id: 'repair', icon: wrenchIcon, label: t('repairBtn'), onClick: () => void this.repair(modal) },
            ],
            onImportJsonText: async (jsonText) => void this.importJsonText(modal, jsonText),
        });

        const sponsorTab = new SponsorTabView({
            title: t('tabSponsor'),
            description: t('sponsorTabPlaceholder'),
            links: [
                { label: t('openGithubRepo'), href: 'https://github.com/zhaoliangbin42/AI-MarkDone', icon: externalLinkIcon },
            ],
        });

        const shell = createBookmarksPanelShell({
            titleText: t('tabBookmarks'),
            closeIcon: xIcon,
            closeLabel: t('btnClose'),
            tabs: [
                { id: 'bookmarks', label: t('tabBookmarks'), icon: bookmarkIcon, content: bookmarksTab.getElement() },
                { id: 'settings', label: t('tabSettings'), icon: settingsIcon, content: settingsTab.getElement() },
                { id: 'sponsor', label: t('tabSponsor'), icon: coffeeIcon, content: sponsorTab.getElement() },
            ],
            defaultTabId: 'bookmarks',
        });
        const titleByTabId = new Map<string, string>([
            ['bookmarks', t('tabBookmarks')],
            ['settings', t('tabSettings')],
            ['sponsor', t('tabSponsor')],
        ]);
        shell.tabs.getElement().addEventListener('aimd:tabs-change', (e) => {
            const ev = e as CustomEvent<{ id: string }>;
            const next = titleByTabId.get(ev.detail?.id) ?? t('tabBookmarks');
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

        // Keyboard isolation: stop events from escaping to the host page.
        host.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                e.preventDefault();
                e.stopPropagation();
                if (modal.isOpen()) modal.closeTop();
                else this.hide();
                return;
            }
            e.stopPropagation();
        });

        shell.panel.appendChild(footer);
        shadow.append(shell.overlay, shell.panel);
        document.documentElement.appendChild(host);

        this.host = host;
        this.shadow = shadow;
        this.bookmarksTab = bookmarksTab;
        this.refs = { ...shell, footerStatus: status, footerMeta: meta };
    }

    private unmount(): void {
        this.refs = null;
        this.snapshot = null;
        this.bookmarksTab = null;
        this.shadow = null;
        this.host?.remove();
        this.host = null;
    }

    private render(): void {
        const refs = this.refs;
        const shadow = this.shadow;
        const snap = this.snapshot;
        if (!refs || !shadow || !snap) return;

        const theme: Theme = this.controller.getTheme();
        const style = shadow.querySelector('style');
        if (style) style.textContent = getBookmarksPanelCss(theme);

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

    private async importJsonText(modal: ModalHost, jsonText: string): Promise<void> {
        const saveContextOnly = await modal.confirm({
            kind: 'info',
            title: t('importBookmarks'),
            message: t('saveContextOnlyConfirm'),
            confirmText: t('btnOk'),
            cancelText: t('btnCancel'),
        });
        const res = await this.controller.importJsonText(jsonText, saveContextOnly);
        if (!res.ok) {
            await modal.alert({ kind: 'error', title: t('importBookmarks'), message: res.message, confirmText: t('btnOk') });
            return;
        }
        this.controller.setPanelStatus(t('importedStatus'));
    }

    private async repair(modal: ModalHost): Promise<void> {
        const ok = await modal.confirm({
            kind: 'warning',
            title: t('repairBtn'),
            message: t('repairConfirm'),
            confirmText: t('btnOk'),
            cancelText: t('btnCancel'),
            danger: true,
        });
        if (!ok) return;
        const res = await this.controller.repair();
        if (!res.ok) {
            await modal.alert({ kind: 'error', title: t('repairBtn'), message: res.message, confirmText: t('btnOk') });
            return;
        }
        this.controller.setPanelStatus(t('repairedStatus'));
    }
}
