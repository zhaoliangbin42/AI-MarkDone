import { DEFAULT_SETTINGS, type AppSettings } from '../../../core/settings/types';
import { loadAndNormalize } from '../../../services/settings/settingsService';
import { settingsClientRpc } from '../../../drivers/shared/clients/settingsClientRpc';
import { bookmarksClient } from '../../../drivers/shared/clients/bookmarksClient';
import { browser } from '../../../drivers/shared/browser';
import {
    bookmarkIcon,
    fileTextIcon,
    infoIcon,
    messageSquareTextIcon,
    settingsIcon,
    xIcon,
} from '../../../assets/icons';
import { getBookmarksPanelCss } from './ui/styles/bookmarksPanelCss';
import type { BookmarksPanelController, BookmarksPanelSnapshot } from './BookmarksPanelController';
import { BookmarksTabView } from './ui/tabs/BookmarksTabView';
import { createBookmarksTabActions } from './ui/tabs/bookmarksTabActions';
import { SettingsTabView, type SettingsTabViewActions } from './ui/tabs/SettingsTabView';
import { ChangelogTabView } from './ui/tabs/ChangelogTabView';
import { AboutTabView } from './ui/tabs/AboutTabView';
import { FaqTabView } from './ui/tabs/FaqTabView';
import { loadLatestChangelogEntry } from './content/changelog';
import { createBookmarksPanelShell } from './ui/BookmarksPanelShell';
import { OverlaySession } from '../overlay/OverlaySession';
import type { ReaderPanel } from '../reader/ReaderPanel';
import { TooltipDelegate } from '../../../utils/tooltip';
import { subscribeLocaleChange, t } from '../components/i18n';
import { logger } from '../../../core/logger';
import { eventWithinTransientRoot } from '../components/transientUi';
import { beginSurfaceMotionClose, setSurfaceMotionOpening } from '../components/motionLifecycle';
import { SurfaceFocusLifecycle } from '../components/surfaceFocusLifecycle';
import { renderInfoBlocks } from './ui/tabs/renderInfoBlocks';
import { renderChangelogSections } from './ui/tabs/renderChangelogSections';

type PanelTabId = 'bookmarks' | 'settings' | 'changelog' | 'about' | 'faq';

type UiState = {
    bookmarksTab: PanelTabId;
    settings: AppSettings;
};

type BookmarksPanelTabView = {
    getElement(): HTMLElement;
    update?(snapshot: BookmarksPanelSnapshot | null): void;
    focusPrimaryInput?(): void;
    dismissTransientUi?(): void;
    consumeEscape?(): boolean;
    destroy?(): void;
};

function shouldLogBookmarksPerf(): boolean {
    try {
        if (typeof window !== 'undefined' && window.__AIMD_BOOKMARKS_PERF__) return true;
        if (typeof localStorage !== 'undefined') {
            return localStorage.getItem('aimd:bookmarks-perf') === '1';
        }
    } catch {
        // ignore
    }
    return false;
}

function logBookmarksPerf(stage: string, payload: Record<string, unknown>): void {
    if (!shouldLogBookmarksPerf()) return;
    logger.debug(`[AI-MarkDone][BookmarksPanel][Perf] ${stage}`, payload);
}

function tr(key: string, fallback: string, substitutions?: string[]): string {
    const translated = substitutions ? t(key, substitutions) : t(key);
    if (!translated || translated === key) return fallback;
    return translated;
}

function downloadJson(filename: string, data: unknown): void {
    try {
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = filename;
        anchor.click();
        window.setTimeout(() => URL.revokeObjectURL(url), 500);
    } catch {
        // ignore
    }
}

function mergeSettings(input: unknown): AppSettings {
    return loadAndNormalize(input);
}

function createFallbackTabView(className: string): BookmarksPanelTabView {
    const root = document.createElement('div');
    root.className = className;
    return {
        getElement: () => root,
    };
}

export class BookmarksPanel {
    private readonly controller: BookmarksPanelController;
    private readonly readerPanel: ReaderPanel;
    private readonly uiState: UiState = {
        bookmarksTab: 'bookmarks',
        settings: structuredClone(DEFAULT_SETTINGS),
    };
    private readonly panelScrollTops: Record<PanelTabId, number> = {
        bookmarks: 0,
        settings: 0,
        changelog: 0,
        about: 0,
        faq: 0,
    };

    private visible = false;
    private overlaySession: OverlaySession | null = null;
    private tooltipDelegate: TooltipDelegate | null = null;
    private snapshot: BookmarksPanelSnapshot | null = null;
    private bookmarksView: BookmarksPanelTabView | null = null;
    private settingsView: BookmarksPanelTabView | null = null;
    private changelogView: BookmarksPanelTabView | null = null;
    private aboutView: BookmarksPanelTabView | null = null;
    private faqView: BookmarksPanelTabView | null = null;
    private unsubscribeSnapshot: (() => void) | null = null;
    private unsubscribeLocale: (() => void) | null = null;
    private closing = false;
    private motionNeedsOpen = false;
    private changelogNoticeCheckedForSession = false;
    private pendingChangelogModalVersion: string | null = null;
    private readonly focusLifecycle = new SurfaceFocusLifecycle();
    private readonly onShadowPointerDown = (event: Event) => {
        if (!this.hostHandle) return;

        const target = event.target as HTMLElement | null;
        if (!target) return;

        if (target.closest('.mock-modal-host, .mock-modal-overlay, .mock-modal')) {
            return;
        }

        const panel = this.hostHandle.surfaceRoot.querySelector<HTMLElement>('.panel-window');
        if (!panel) return;

        if (!panel.contains(target)) {
            this.hide();
            return;
        }

        if (!eventWithinTransientRoot(event)) {
            this.bookmarksView?.dismissTransientUi?.();
            this.settingsView?.dismissTransientUi?.();
        }
    };

    constructor(controller: BookmarksPanelController, readerPanel: ReaderPanel) {
        this.controller = controller;
        this.readerPanel = readerPanel;
    }

    private get hostHandle() {
        return this.overlaySession?.handle ?? null;
    }

    private get modalHost() {
        return this.overlaySession?.modalHost ?? null;
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

        this.focusLifecycle.capture();
        this.visible = true;
        this.closing = false;
        this.motionNeedsOpen = true;
        this.changelogNoticeCheckedForSession = false;
        this.pendingChangelogModalVersion = null;
        this.overlaySession = new OverlaySession({
            id: 'aimd-bookmarks-panel-host',
            theme: this.controller.getTheme(),
            surfaceCss: getBookmarksPanelCss(),
            lockScroll: true,
            surfaceStyleId: 'aimd-bookmarks-panel-structure',
            overlayStyleId: 'aimd-bookmarks-panel-tailwind',
        });
        this.recreateTabViews();
        this.tooltipDelegate = new TooltipDelegate(this.overlaySession.shadow);
        logBookmarksPerf('panel:perf-logging-enabled', {
            visible: true,
            tab: this.uiState.bookmarksTab,
        });
        this.unsubscribeLocale = subscribeLocaleChange(() => {
            if (!this.visible) return;
            this.captureScrollTops();
            this.bookmarksView?.destroy?.();
            this.bookmarksView = null;
            this.settingsView?.destroy?.();
            this.settingsView = null;
            this.changelogView?.destroy?.();
            this.changelogView = null;
            this.aboutView?.destroy?.();
            this.aboutView = null;
            this.faqView?.destroy?.();
            this.faqView = null;
            this.render();
        });

        this.unsubscribeSnapshot = this.controller.subscribe((snapshot) => {
            const previousSnapshot = this.snapshot;
            this.snapshot = snapshot;
            if (!this.applySnapshotUpdate(previousSnapshot, snapshot)) {
                this.render();
            }
        });

        this.render();
        const initResults = await Promise.allSettled([
            this.controller.refreshAll(),
            this.controller.refreshPositionsForUrl(window.location.href.split('#')[0] || window.location.href),
            this.controller.refreshUiState(),
            this.loadSettings(),
        ]);
        const initErrors = initResults.filter(
            (result): result is PromiseRejectedResult => result.status === 'rejected',
        );
        if (initErrors.length > 0) {
            logger.warn('[AI-MarkDone][BookmarksPanel] Initial panel refresh failed; keeping the shell open.', {
                failures: initErrors.map((result) => String(result.reason)),
            });
        }
        if (!this.visible || this.closing) return;
        this.render();
        void this.maybeShowChangelogNotice();
    }

    hide(): void {
        if (!this.visible || this.closing) return;

        const panel = this.overlaySession?.surfaceRoot.querySelector<HTMLElement>('.panel-window');
        const backdrop = this.overlaySession?.backdropRoot.querySelector<HTMLElement>('.panel-stage__overlay');
        if (this.overlaySession && panel) {
            this.visible = false;
            this.closing = true;
            beginSurfaceMotionClose({
                shell: panel,
                backdrop,
                onClosed: () => this.finishHide(),
                fallbackMs: 560,
            });
            return;
        }

        this.visible = false;
        this.finishHide();
    }

    private finishHide(): void {
        this.visible = false;
        this.unsubscribeSnapshot?.();
        this.unsubscribeSnapshot = null;
        this.unsubscribeLocale?.();
        this.unsubscribeLocale = null;
        this.overlaySession?.shadow.removeEventListener('pointerdown', this.onShadowPointerDown, true);
        this.tooltipDelegate?.disconnect();
        this.tooltipDelegate = null;
        this.bookmarksView?.destroy?.();
        this.bookmarksView = null;
        this.settingsView?.destroy?.();
        this.settingsView = null;
        this.changelogView?.destroy?.();
        this.changelogView = null;
        this.aboutView?.destroy?.();
        this.aboutView = null;
        this.faqView?.destroy?.();
        this.faqView = null;
        this.focusLifecycle.restore(document);
        this.overlaySession?.unmount();
        this.overlaySession = null;
        this.closing = false;
        this.motionNeedsOpen = false;
        this.changelogNoticeCheckedForSession = false;
        this.pendingChangelogModalVersion = null;
    }

    private async loadSettings(): Promise<void> {
        const result = await settingsClientRpc.getAll();
        if (!result.ok) return;
        this.uiState.settings = mergeSettings(result.data.settings);
    }

    private createSettingsActions(): SettingsTabViewActions {
        return {
            loadState: async () => ({
                settings: this.uiState.settings,
                storageUsage: this.snapshot?.storageUsage ?? null,
            }),
            setPlatforms: async (patch) => {
                this.uiState.settings = {
                    ...this.uiState.settings,
                    platforms: {
                        ...this.uiState.settings.platforms,
                        ...patch,
                    },
                };
                await settingsClientRpc.setCategory('platforms', patch);
            },
            setBehaviorSettings: async (patch) => {
                this.uiState.settings = {
                    ...this.uiState.settings,
                    behavior: {
                        ...this.uiState.settings.behavior,
                        ...patch,
                    },
                };
                await settingsClientRpc.setCategory('behavior', patch);
            },
            setReaderSettings: async (patch) => {
                this.uiState.settings = {
                    ...this.uiState.settings,
                    reader: {
                        ...this.uiState.settings.reader,
                        ...patch,
                    },
                };
                await settingsClientRpc.setCategory('reader', patch);
            },
            setExportSettings: async (patch) => {
                this.uiState.settings = {
                    ...this.uiState.settings,
                    export: {
                        ...this.uiState.settings.export,
                        ...patch,
                    },
                };
                await settingsClientRpc.setCategory('export', patch);
            },
            setLanguage: async (value) => {
                this.uiState.settings = {
                    ...this.uiState.settings,
                    language: value,
                };
                await settingsClientRpc.setCategory('language', value);
            },
            exportAllBookmarks: async () => {
                await this.exportAll();
            },
        };
    }

    private render(): void {
        if (!this.overlaySession || !this.hostHandle || this.closing) return;
        const startedAt = performance.now();
        this.captureScrollTops();
        this.recreateTabViews();

        const bookmarksPanel = this.bookmarksView?.getElement() ?? document.createElement('section');
        bookmarksPanel.classList.add('tab-panel--bookmarks');
        const settingsPanel = this.settingsView?.getElement() ?? document.createElement('section');
        settingsPanel.classList.add('settings-panel');
        const changelogPanel = this.changelogView?.getElement() ?? document.createElement('section');
        changelogPanel.classList.add('changelog-panel');
        const aboutPanel = this.aboutView?.getElement() ?? document.createElement('section');
        aboutPanel.classList.add('about-panel');
        const faqPanel = this.faqView?.getElement() ?? document.createElement('section');
        faqPanel.classList.add('faq-panel');

        const titleText = this.uiState.bookmarksTab === 'bookmarks'
            ? tr('tabBookmarks', 'Bookmarks')
            : this.uiState.bookmarksTab === 'settings'
                ? tr('tabSettings', 'Settings')
                : this.uiState.bookmarksTab === 'changelog'
                    ? tr('tabChangelog', 'Changelog')
                    : this.uiState.bookmarksTab === 'faq'
                        ? tr('tabFaq', 'FAQ')
                        : tr('tabAbout', 'About');

        const shell = createBookmarksPanelShell({
            titleText,
            closeIcon: xIcon,
            closeLabel: tr('btnClose', 'Close panel'),
            defaultTabId: this.uiState.bookmarksTab,
            tabs: [
                { id: 'bookmarks', label: tr('tabBookmarks', 'Bookmarks'), icon: bookmarkIcon, content: bookmarksPanel, panelClassName: 'tab-panel--bookmarks' },
                { id: 'settings', label: tr('tabSettings', 'Settings'), icon: settingsIcon, content: settingsPanel, panelClassName: 'settings-panel' },
                { id: 'changelog', label: tr('tabChangelog', 'Changelog'), icon: fileTextIcon, content: changelogPanel, panelClassName: 'changelog-panel' },
                { id: 'faq', label: tr('tabFaq', 'FAQ'), icon: messageSquareTextIcon, content: faqPanel, panelClassName: 'faq-panel' },
                { id: 'about', label: tr('tabAbout', 'About'), icon: infoIcon, content: aboutPanel, panelClassName: 'about-panel' },
            ],
        });
        const panel = shell.panel;

        this.overlaySession.replaceBackdrop(shell.overlay);
        this.overlaySession.replaceSurface(panel);
        if (this.motionNeedsOpen) {
            setSurfaceMotionOpening([shell.overlay, panel]);
            this.focusLifecycle.scheduleInitialFocus({
                surface: panel,
                selectors: ['input', '.tab-btn', '[data-action="close"]'],
            });
            this.motionNeedsOpen = false;
        }
        shell.closeBtn.addEventListener('click', () => this.hide());
        shell.tabs.getElement().addEventListener('aimd:tabs-change', (event) => {
            const nextTab = (event as CustomEvent<{ id: string }>).detail.id;
            if (nextTab === 'bookmarks' || nextTab === 'settings' || nextTab === 'changelog' || nextTab === 'about' || nextTab === 'faq') {
                this.switchToTab(nextTab);
            }
        });
        this.syncTabViews();
        this.restoreScrollTop();

        for (const checkbox of panel.querySelectorAll<HTMLInputElement>('.tree-check[data-indeterminate="1"]')) {
            checkbox.indeterminate = true;
        }

        panel.addEventListener('click', (event) => void this.handleClick(event));
        panel.addEventListener('input', (event) => void this.handleInput(event));
        panel.addEventListener('change', (event) => void this.handleChange(event));
        this.overlaySession.shadow.removeEventListener('pointerdown', this.onShadowPointerDown, true);
        this.overlaySession.shadow.addEventListener('pointerdown', this.onShadowPointerDown, true);
        this.overlaySession.syncKeyboardScope({
            root: this.overlaySession.host,
            onEscape: () => {
                if (this.bookmarksView?.consumeEscape?.()) return;
                if (this.settingsView?.consumeEscape?.()) return;
                if (this.changelogView?.consumeEscape?.()) return;
                if (this.aboutView?.consumeEscape?.()) return;
                if (this.faqView?.consumeEscape?.()) return;
                this.hide();
            },
            stopPropagationAll: true,
            ignoreEscapeWhileComposing: true,
            trapTabWithin: panel,
        });
        this.tooltipDelegate?.refresh(this.overlaySession.shadow);
        logBookmarksPerf('panel:full-render', {
            durationMs: Number((performance.now() - startedAt).toFixed(2)),
            tab: this.uiState.bookmarksTab,
            virtualized: panel.querySelector('.tree-panel')?.getAttribute('data-virtualized') === '1',
            visibleBookmarks: this.snapshot?.vm.bookmarks.length ?? 0,
        });
    }

    private applySnapshotUpdate(previousSnapshot: BookmarksPanelSnapshot | null, nextSnapshot: BookmarksPanelSnapshot): boolean {
        if (!this.hostHandle || !previousSnapshot) return false;
        const startedAt = performance.now();

        this.bookmarksView?.update?.(nextSnapshot);
        this.settingsView?.update?.(nextSnapshot);
        this.tooltipDelegate?.refresh(this.hostHandle.shadow);
        logBookmarksPerf('panel:patch-snapshot', {
            durationMs: Number((performance.now() - startedAt).toFixed(2)),
            virtualized: this.bookmarksView?.getElement().querySelector('.tree-panel')?.getAttribute('data-virtualized') === '1',
            visibleBookmarks: nextSnapshot.vm.bookmarks.length,
            selectedKeys: nextSnapshot.selectedKeys.size,
            query: nextSnapshot.vm.query,
            platform: nextSnapshot.vm.platform,
        });
        return true;
    }

    private recreateTabViews(): void {
        if (!this.modalHost) return;
        if (this.bookmarksView && this.settingsView && this.changelogView && this.aboutView && this.faqView) return;

        if (!this.bookmarksView) {
            try {
                this.bookmarksView = new BookmarksTabView({
                    controller: this.controller,
                    actions: createBookmarksTabActions({
                        readerPanel: this.readerPanel,
                        modal: this.modalHost,
                        onRequestHidePanel: () => this.hide(),
                        getSaveContextOnly: () => Boolean(this.uiState.settings.behavior.saveContextOnly),
                    }),
                });
            } catch (error) {
                logger.warn('[AI-MarkDone][BookmarksPanel] Failed to create bookmarks tab view; keeping the shell open.', {
                    error: String(error),
                });
                this.bookmarksView = createFallbackTabView('bookmarks-tab-content');
            }
        }

        if (!this.settingsView) {
            try {
                this.settingsView = new SettingsTabView({
                    modal: this.modalHost,
                    actions: this.createSettingsActions(),
                });
            } catch (error) {
                logger.warn('[AI-MarkDone][BookmarksPanel] Failed to create settings tab view; keeping the shell open.', {
                    error: String(error),
                });
                this.settingsView = createFallbackTabView('aimd-settings');
            }
        }

        if (!this.changelogView) {
            try {
                this.changelogView = new ChangelogTabView({
                    resolveAssetUrl: (assetPath) => browser.runtime.getURL(assetPath),
                });
            } catch (error) {
                logger.warn('[AI-MarkDone][BookmarksPanel] Failed to create changelog tab view; keeping the shell open.', {
                    error: String(error),
                });
                this.changelogView = createFallbackTabView('aimd-changelog');
            }
        }

        if (!this.aboutView) {
            try {
                this.aboutView = new AboutTabView({
                    actions: {
                        githubUrl: 'https://github.com/zhaoliangbin42/AI-MarkDone',
                        getAssetUrl: (assetPath) => browser.runtime.getURL(assetPath),
                    },
                });
            } catch (error) {
                logger.warn('[AI-MarkDone][BookmarksPanel] Failed to create about tab view; keeping the shell open.', {
                    error: String(error),
                });
                this.aboutView = createFallbackTabView('aimd-about');
            }
        }

        if (!this.faqView) {
            try {
                this.faqView = new FaqTabView({
                    resolveAssetUrl: (assetPath) => browser.runtime.getURL(assetPath),
                });
            } catch (error) {
                logger.warn('[AI-MarkDone][BookmarksPanel] Failed to create FAQ tab view; keeping the shell open.', {
                    error: String(error),
                });
                this.faqView = createFallbackTabView('aimd-faq');
            }
        }
    }

    private syncTabViews(): void {
        if (this.snapshot) {
            this.bookmarksView?.update?.(this.snapshot);
        }
        (this.settingsView as SettingsTabView | null)?.setState({
            settings: this.uiState.settings,
            storageUsage: this.snapshot?.storageUsage ?? null,
        });
    }

    private switchToTab(nextTab: PanelTabId): void {
        if (this.uiState.bookmarksTab === nextTab) return;
        this.bookmarksView?.dismissTransientUi?.();
        this.settingsView?.dismissTransientUi?.();
        this.changelogView?.dismissTransientUi?.();
        this.aboutView?.dismissTransientUi?.();
        this.faqView?.dismissTransientUi?.();
        this.uiState.bookmarksTab = nextTab;
        this.render();
    }

    private async maybeShowChangelogNotice(): Promise<void> {
        if (this.changelogNoticeCheckedForSession || !this.visible || this.closing || !this.modalHost) return;
        this.changelogNoticeCheckedForSession = true;

        const noticeResult = await bookmarksClient.getChangelogNotice();
        if (!noticeResult.ok || !this.visible || this.closing || !this.modalHost) return;

        const notice = noticeResult.data;
        if (!notice.pendingVersion || notice.pendingVersion === notice.lastShownVersion) return;
        if (this.pendingChangelogModalVersion === notice.pendingVersion) return;

        const latestEntry = loadLatestChangelogEntry();
        if (!latestEntry) return;
        if (latestEntry.version !== notice.pendingVersion) {
            logger.warn('[AI-MarkDone][BookmarksPanel] Pending changelog notice version does not match latest changelog entry.', {
                pendingVersion: notice.pendingVersion,
                latestVersion: latestEntry.version,
            });
            return;
        }

        this.pendingChangelogModalVersion = latestEntry.version;

        const body = document.createElement('div');
        body.className = 'changelog-notice-modal';

        if (latestEntry.date) {
            const date = document.createElement('p');
            date.className = 'changelog-notice-modal__date';
            date.textContent = latestEntry.date;
            body.appendChild(date);
        }

        const content = document.createElement('div');
        content.className = 'changelog-notice-modal__content';
        content.appendChild(renderInfoBlocks(latestEntry.leadBlocks));
        body.appendChild(content);

        if (latestEntry.sections.length > 0) {
            const sections = document.createElement('div');
            sections.className = 'changelog-notice-modal__sections';
            sections.appendChild(renderChangelogSections(latestEntry.sections));
            body.appendChild(sections);
        }

        let ackStarted = false;
        const acknowledge = async () => {
            if (ackStarted) return true;
            ackStarted = true;
            const result = await bookmarksClient.ackChangelogNotice(latestEntry.version);
            if (!result.ok) {
                logger.warn('[AI-MarkDone][BookmarksPanel] Failed to acknowledge changelog notice.', {
                    version: latestEntry.version,
                    error: result.message,
                });
                ackStarted = false;
                return false;
            }
            this.pendingChangelogModalVersion = null;
            return true;
        };

        await this.modalHost.showCustom({
            kind: 'info',
            title: tr('changelogNoticeTitle', `What's new in AI-MarkDone ${latestEntry.version}`, [latestEntry.version]),
            body,
            footer: (footer, close) => {
                const viewAll = document.createElement('button');
                viewAll.type = 'button';
                viewAll.className = 'mock-modal__button mock-modal__button--secondary';
                viewAll.textContent = tr('changelogNoticeViewAll', 'View full changelog');
                viewAll.addEventListener('click', () => {
                    void (async () => {
                        const acked = await acknowledge();
                        if (!acked) return;
                        close();
                        this.switchToTab('changelog');
                    })();
                });

                const ok = document.createElement('button');
                ok.type = 'button';
                ok.className = 'mock-modal__button mock-modal__button--primary';
                ok.textContent = tr('btnOk', 'OK');
                ok.addEventListener('click', () => {
                    void (async () => {
                        const acked = await acknowledge();
                        if (!acked) return;
                        close();
                    })();
                });

                footer.append(viewAll, ok);
                window.setTimeout(() => ok.focus(), 0);
            },
            onDismiss: () => {
                void acknowledge();
            },
        });
    }

    private async handleClick(event: Event): Promise<void> {
        const target = event.target as HTMLElement | null;
        if (target?.closest('.aimd-settings')) return;
        if (target?.closest('.bookmarks-tab-content')) return;
        if (this.uiState.bookmarksTab === 'about' && (target?.closest('.aimd-about') || target?.closest('.about-panel'))) {
            this.emitSponsorBurst(event as MouseEvent);
            return;
        }
        const actionEl = target?.closest<HTMLElement>('[data-action]');
        if (!actionEl) return;

        const action = actionEl.dataset.action;
        logBookmarksPerf('panel:action', {
            action,
            tab: this.uiState.bookmarksTab,
            bookmarkId: actionEl.dataset.bookmarkId ?? null,
            path: actionEl.dataset.path ?? null,
        });
        switch (action) {
            case 'close-panel':
                this.hide();
                return;
            default:
                return;
        }
    }

    private async handleInput(event: Event): Promise<void> {
        const target = event.target as HTMLInputElement | null;
        if (!target) return;
        if (target.closest('.aimd-settings')) return;
        if (target.closest('.bookmarks-tab-content')) return;
    }

    private async handleChange(event: Event): Promise<void> {
        const target = event.target as HTMLInputElement | null;
        if (!target) return;
        if (target.closest('.aimd-settings')) return;
        if (target.closest('.bookmarks-tab-content')) return;
    }

    private captureScrollTops(): void {
        if (!this.hostHandle) return;
        const bookmarksPanel = this.bookmarksView && 'getTreeScrollTop' in this.bookmarksView
            ? (this.bookmarksView as BookmarksTabView).getTreeScrollTop()
            : null;
        const settingsPanel = this.hostHandle.surfaceRoot.querySelector<HTMLElement>('.settings-panel');
        const changelogPanel = this.hostHandle.surfaceRoot.querySelector<HTMLElement>('.changelog-panel');
        const aboutPanel = this.hostHandle.surfaceRoot.querySelector<HTMLElement>('.about-panel');
        const faqPanel = this.hostHandle.surfaceRoot.querySelector<HTMLElement>('.faq-panel');

        if (typeof bookmarksPanel === 'number') this.panelScrollTops.bookmarks = bookmarksPanel;
        if (settingsPanel) this.panelScrollTops.settings = settingsPanel.scrollTop;
        if (changelogPanel) this.panelScrollTops.changelog = changelogPanel.scrollTop;
        if (aboutPanel) this.panelScrollTops.about = aboutPanel.scrollTop;
        if (faqPanel) this.panelScrollTops.faq = faqPanel.scrollTop;
    }

    private restoreScrollTop(): void {
        if (!this.hostHandle) return;

        if (this.uiState.bookmarksTab === 'bookmarks') {
            if (this.bookmarksView && 'restoreTreeScroll' in this.bookmarksView) {
                (this.bookmarksView as BookmarksTabView).restoreTreeScroll(this.panelScrollTops.bookmarks);
            }
            return;
        }

        if (this.uiState.bookmarksTab === 'settings') {
            const settingsPanel = this.hostHandle.surfaceRoot.querySelector<HTMLElement>('.settings-panel');
            if (settingsPanel) settingsPanel.scrollTop = this.panelScrollTops.settings;
            return;
        }

        const panelClass =
            this.uiState.bookmarksTab === 'changelog'
                ? '.changelog-panel'
                : this.uiState.bookmarksTab === 'about'
                    ? '.about-panel'
                    : '.faq-panel';
        const panel = this.hostHandle.surfaceRoot.querySelector<HTMLElement>(panelClass);
        if (!panel) return;
        if (this.uiState.bookmarksTab === 'changelog') panel.scrollTop = this.panelScrollTops.changelog;
        if (this.uiState.bookmarksTab === 'about') panel.scrollTop = this.panelScrollTops.about;
        if (this.uiState.bookmarksTab === 'faq') panel.scrollTop = this.panelScrollTops.faq;
    }

    private emitSponsorBurst(event: MouseEvent): void {
        if (!this.hostHandle) return;

        const panel = this.hostHandle.surfaceRoot.querySelector<HTMLElement>('.about-panel');
        const layer = this.hostHandle.surfaceRoot.querySelector<HTMLElement>('.sponsor-celebration');
        if (!panel || !layer) return;

        const rect = layer.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;
        const colors = [
            'var(--aimd-interactive-primary)',
            'var(--aimd-color-warning)',
            'color-mix(in srgb, var(--aimd-state-success-border) 72%, #10b981)',
            'color-mix(in srgb, var(--aimd-text-primary) 24%, white)',
        ];

        for (let index = 0; index < 18; index += 1) {
            const piece = document.createElement('span');
            piece.className = 'sponsor-burst-piece';
            const angle = (Math.PI * 2 * index) / 18;
            const distance = 44 + (index % 4) * 18;
            piece.style.left = `${x}px`;
            piece.style.top = `${y}px`;
            piece.style.setProperty('--piece-color', colors[index % colors.length]);
            piece.style.setProperty('--piece-x', `${Math.cos(angle) * distance}px`);
            piece.style.setProperty('--piece-y', `${Math.sin(angle) * distance}px`);
            piece.style.setProperty('--piece-rotate', `${index * 22}deg`);
            layer.appendChild(piece);
            window.setTimeout(() => piece.remove(), 920);
        }
    }

    private async exportAll(): Promise<void> {
        const result = await this.controller.exportAll(true);
        if (result.ok) {
            downloadJson('ai-markdone-bookmarks.json', result.data.payload);
        }
    }
}
