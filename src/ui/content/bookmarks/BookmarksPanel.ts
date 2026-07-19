import { DEFAULT_SETTINGS, type AppSettings } from '../../../core/settings/types';
import { loadAndNormalize } from '../../../services/settings/settingsService';
import { settingsClientRpc } from '../../../drivers/shared/clients/settingsClientRpc';
import { browser, browserInfo } from '../../../drivers/shared/browser';
import { xIcon } from '../../../assets/icons';
import { getBookmarksPanelCss } from './ui/styles/bookmarksPanelCss';
import type { BookmarksPanelController, BookmarksPanelSnapshot } from './BookmarksPanelController';
import { BookmarksTabView } from './ui/tabs/BookmarksTabView';
import { createBookmarksTabActions } from './ui/tabs/bookmarksTabActions';
import { SettingsTabView, type SettingsTabViewActions } from './ui/tabs/SettingsTabView';
import { ChangelogTabView } from './ui/tabs/ChangelogTabView';
import { FeedbackTabView } from './ui/tabs/FeedbackTabView';
import { AboutTabView } from './ui/tabs/AboutTabView';
import { MappamoryTabView } from './ui/tabs/MappamoryTabView';
import { FaqTabView } from './ui/tabs/FaqTabView';
import { SponsorTabView } from './ui/tabs/SponsorTabView';
import { createBookmarksPanelShell } from './ui/BookmarksPanelShell';
import { OverlaySession } from '../overlay/OverlaySession';
import type { ReaderPanelPort } from '../reader/ReaderPanelPort';
import type { BookmarksPanelOptions } from './BookmarksPanelPort';
import { TooltipDelegate } from '../../../utils/tooltip';
import { subscribeLocaleChange, t } from '../components/i18n';
import { logger } from '../../../core/logger';
import { eventWithinTransientRoot } from '../components/transientUi';
import { SurfaceFocusLifecycle } from '../components/surfaceFocusLifecycle';
import { showChangelogNoticeIfNeeded } from '../changelog/ChangelogNoticePresenter';
import {
    TARGET_SURFACE_SOCIAL_FOLLOW_CARD_ENABLED,
    TARGET_SURFACE_SPONSOR_TAB_ENABLED,
} from '../../../config/targetSurface';
import { GOOGLE_DRIVE_WEB_AUTH_CLIENT_ID } from '../../../../config/extension/cloudBackup';
import {
    BookmarksPanelTabWorkflow,
    type BookmarksPanelTabId,
} from './workflows/BookmarksPanelTabWorkflow';
import { BookmarksCloudBackupWorkflow } from './workflows/BookmarksCloudBackupWorkflow';

type UiState = {
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

function hasGoogleDriveBackupCapability(): boolean {
    return browserInfo.isChrome || (browserInfo.isFirefox && Boolean(GOOGLE_DRIVE_WEB_AUTH_CLIENT_ID));
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
    private readonly readerPanel: ReaderPanelPort;
    private readonly uiState: UiState = {
        settings: structuredClone(DEFAULT_SETTINGS),
    };
    private readonly tabWorkflow: BookmarksPanelTabWorkflow;
    private readonly cloudBackupWorkflow: BookmarksCloudBackupWorkflow;

    private visible = false;
    private overlaySession: OverlaySession | null = null;
    private tooltipDelegate: TooltipDelegate | null = null;
    private snapshot: BookmarksPanelSnapshot | null = null;
    private bookmarksView: BookmarksPanelTabView | null = null;
    private settingsView: BookmarksPanelTabView | null = null;
    private changelogView: BookmarksPanelTabView | null = null;
    private aboutView: BookmarksPanelTabView | null = null;
    private mappamoryView: BookmarksPanelTabView | null = null;
    private faqView: BookmarksPanelTabView | null = null;
    private sponsorView: BookmarksPanelTabView | null = null;
    private feedbackView: BookmarksPanelTabView | null = null;
    private unsubscribeSnapshot: (() => void) | null = null;
    private unsubscribeLocale: (() => void) | null = null;
    private closing = false;
    private motionNeedsOpen = false;
    private changelogNoticeCheckedForSession = false;
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

        if (eventWithinTransientRoot(event)) {
            return;
        }

        if (!panel.contains(target)) {
            this.hide();
            return;
        }

        this.bookmarksView?.dismissTransientUi?.();
        this.settingsView?.dismissTransientUi?.();
        this.feedbackView?.dismissTransientUi?.();
    };

    constructor(
        controller: BookmarksPanelController,
        readerPanel: ReaderPanelPort,
        private readonly options: BookmarksPanelOptions = {},
    ) {
        this.controller = controller;
        this.readerPanel = readerPanel;
        this.tabWorkflow = new BookmarksPanelTabWorkflow({
            sponsorEnabled: TARGET_SURFACE_SPONSOR_TAB_ENABLED,
        });
        this.cloudBackupWorkflow = new BookmarksCloudBackupWorkflow({
            getModalHost: () => this.modalHost,
        });
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
        if (this.overlaySession && this.closing) {
            if (this.overlaySession.cancelSurfaceClose()) {
                this.visible = true;
                this.closing = false;
                this.motionNeedsOpen = false;
                this.render();
                return;
            }
            this.finishHide();
        }
        this.visible = true;
        this.closing = false;
        this.motionNeedsOpen = true;
        this.changelogNoticeCheckedForSession = false;
        const appearance = this.controller.getAppearance();
        this.overlaySession = new OverlaySession({
            id: 'aimd-bookmarks-panel-host',
            theme: appearance.theme,
            themeOverrides: appearance.overrides,
            surfaceCss: getBookmarksPanelCss(),
            lockScroll: true,
            surfaceStyleId: 'aimd-bookmarks-panel-structure',
            overlayStyleId: 'aimd-bookmarks-panel-overlay-extra',
        });
        this.recreateTabViews();
        this.tooltipDelegate = new TooltipDelegate(this.overlaySession.shadow);
        logBookmarksPerf('panel:perf-logging-enabled', {
            visible: true,
            tab: this.tabWorkflow.getActiveTab(),
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
            this.mappamoryView?.destroy?.();
            this.mappamoryView = null;
            this.faqView?.destroy?.();
            this.faqView = null;
            this.sponsorView?.destroy?.();
            this.sponsorView = null;
            this.feedbackView?.destroy?.();
            this.feedbackView = null;
            this.render();
        });

        this.unsubscribeSnapshot = this.controller.subscribe((snapshot) => {
            this.overlaySession?.setAppearance(this.controller.getAppearance());
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
            this.controller.refreshPageBookmarkStatus?.(window.location.href.split('#')[0] || window.location.href) ?? Promise.resolve(false),
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
            const closeStarted = this.overlaySession.closeSurface({
                surface: panel,
                backdrop,
                onClosed: () => this.finishHide(),
            });
            if (closeStarted) return;
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
        this.mappamoryView?.destroy?.();
        this.mappamoryView = null;
        this.faqView?.destroy?.();
        this.faqView = null;
        this.sponsorView?.destroy?.();
        this.sponsorView = null;
        this.feedbackView?.destroy?.();
        this.feedbackView = null;
        this.focusLifecycle.restore(document);
        this.overlaySession?.unmount();
        this.overlaySession = null;
        this.closing = false;
        this.motionNeedsOpen = false;
        this.changelogNoticeCheckedForSession = false;
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
            setFormulaSettings: async (patch) => {
                this.uiState.settings = {
                    ...this.uiState.settings,
                    formula: {
                        ...this.uiState.settings.formula,
                        ...patch,
                        assetActions: {
                            ...this.uiState.settings.formula.assetActions,
                            ...patch.assetActions,
                        },
                    },
                };
                await settingsClientRpc.setCategory('formula', patch);
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
            setChatGptDirectorySettings: async (patch) => {
                this.uiState.settings = {
                    ...this.uiState.settings,
                    chatgptDirectory: {
                        ...this.uiState.settings.chatgptDirectory,
                        ...patch,
                    },
                };
                await settingsClientRpc.setCategory('chatgptDirectory', patch);
            },
            setChatGptBehaviorSettings: async (patch) => {
                this.uiState.settings = {
                    ...this.uiState.settings,
                    chatgptBehavior: {
                        ...this.uiState.settings.chatgptBehavior,
                        ...patch,
                    },
                };
                await settingsClientRpc.setCategory('chatgptBehavior', patch);
            },
            setAppearanceSettings: async (patch) => {
                this.uiState.settings = {
                    ...this.uiState.settings,
                    appearance: {
                        ...this.uiState.settings.appearance,
                        ...patch,
                    },
                };
                await settingsClientRpc.setCategory('appearance', patch);
            },
            setLanguage: async (value) => {
                const result = await settingsClientRpc.setCategory('language', value);
                if (!result.ok) return false;
                this.uiState.settings = {
                    ...this.uiState.settings,
                    language: value,
                };
                return true;
            },
            exportAllBookmarks: async () => {
                await this.exportAll();
            },
            cloudBackup: hasGoogleDriveBackupCapability()
                ? this.cloudBackupWorkflow.createSettingsActions()
                : undefined,
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
        const changelogPanel = this.changelogView?.getElement() ?? document.createElement('section');
        changelogPanel.classList.add('changelog-panel');
        const aboutPanel = this.aboutView?.getElement() ?? document.createElement('section');
        aboutPanel.classList.add('about-panel');
        const mappamoryPanel = this.mappamoryView?.getElement() ?? document.createElement('section');
        mappamoryPanel.classList.add('mappamory-panel');
        const faqPanel = this.faqView?.getElement() ?? document.createElement('section');
        faqPanel.classList.add('faq-panel');
        const feedbackPanel = this.feedbackView?.getElement() ?? document.createElement('section');
        feedbackPanel.classList.add('feedback-panel');

        const sponsorPanel = this.sponsorView?.getElement() ?? document.createElement('section');
        sponsorPanel.classList.add('sponsor-panel');
        const shellModel = this.tabWorkflow.createShellModel({
            contents: {
                bookmarks: bookmarksPanel,
                settings: settingsPanel,
                changelog: changelogPanel,
                faq: faqPanel,
                about: aboutPanel,
                mappamory: mappamoryPanel,
                sponsor: sponsorPanel,
                feedback: feedbackPanel,
            },
            translate: tr,
        });

        const shell = createBookmarksPanelShell({
            titleText: shellModel.titleText,
            closeIcon: xIcon,
            closeLabel: tr('btnClose', 'Close panel'),
            defaultTabId: this.tabWorkflow.getActiveTab(),
            tabs: shellModel.tabs,
        });
        const panel = shell.panel;

        this.overlaySession.replaceBackdrop(shell.overlay);
        this.overlaySession.replaceSurface(panel);
        this.overlaySession.syncSurfaceMotion({ surface: panel, backdrop: shell.overlay });
        if (this.motionNeedsOpen) {
            this.overlaySession.openSurface({ surface: panel, backdrop: shell.overlay });
            this.focusLifecycle.scheduleInitialFocus({
                surface: panel,
                selectors: ['input', '.tab-btn', '[data-action="close"]'],
            });
            this.motionNeedsOpen = false;
        }
        shell.closeBtn.addEventListener('click', () => this.hide());
        shell.tabs.getElement().addEventListener('aimd:tabs-change', (event) => {
            const nextTab = (event as CustomEvent<{ id: string }>).detail.id;
            if (this.tabWorkflow.isEnabled(nextTab)) {
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
                if (this.mappamoryView?.consumeEscape?.()) return;
                if (this.faqView?.consumeEscape?.()) return;
                if (this.sponsorView?.consumeEscape?.()) return;
                if (this.feedbackView?.consumeEscape?.()) return;
                this.hide();
            },
            stopPropagationAll: true,
            ignoreEscapeWhileComposing: true,
            trapTabWithin: panel,
        });
        this.tooltipDelegate?.refresh(this.overlaySession.shadow);
        logBookmarksPerf('panel:full-render', {
            durationMs: Number((performance.now() - startedAt).toFixed(2)),
            tab: this.tabWorkflow.getActiveTab(),
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
        });
        return true;
    }

    private recreateTabViews(): void {
        if (!this.modalHost) return;
        if (
            this.bookmarksView
            && this.settingsView
            && this.changelogView
            && this.aboutView
            && this.mappamoryView
            && this.faqView
            && this.feedbackView
            && (!TARGET_SURFACE_SPONSOR_TAB_ENABLED || this.sponsorView)
        ) return;

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
                    onOpenPromptManager: this.options.onOpenPromptManager,
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
                        getAssetUrl: (assetPath) => browser.runtime.getURL(assetPath),
                        showSocialFollowCard: TARGET_SURFACE_SOCIAL_FOLLOW_CARD_ENABLED,
                    },
                });
            } catch (error) {
                logger.warn('[AI-MarkDone][BookmarksPanel] Failed to create about tab view; keeping the shell open.', {
                    error: String(error),
                });
                this.aboutView = createFallbackTabView('aimd-about');
            }
        }

        if (!this.mappamoryView) {
            try {
                this.mappamoryView = new MappamoryTabView({
                    actions: {
                        getAssetUrl: (assetPath) => browser.runtime.getURL(assetPath),
                    },
                });
            } catch (error) {
                logger.warn('[AI-MarkDone][BookmarksPanel] Failed to create Mappamory tab view; keeping the shell open.', {
                    error: String(error),
                });
                this.mappamoryView = createFallbackTabView('aimd-mappamory');
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

        if (TARGET_SURFACE_SPONSOR_TAB_ENABLED && !this.sponsorView) {
            try {
                this.sponsorView = new SponsorTabView({
                    actions: {
                        githubUrl: 'https://github.com/zhaoliangbin42/AI-MarkDone',
                        getAssetUrl: (assetPath) => browser.runtime.getURL(assetPath),
                    },
                });
            } catch (error) {
                logger.warn('[AI-MarkDone][BookmarksPanel] Failed to create sponsor tab view; keeping the shell open.', {
                    error: String(error),
                });
                this.sponsorView = createFallbackTabView('aimd-sponsor');
            }
        }

        if (!this.feedbackView) {
            try {
                this.feedbackView = new FeedbackTabView({
                    actions: {
                        getAssetUrl: (assetPath) => browser.runtime.getURL(assetPath),
                        showCommunityCards: TARGET_SURFACE_SOCIAL_FOLLOW_CARD_ENABLED,
                    },
                });
            } catch (error) {
                logger.warn('[AI-MarkDone][BookmarksPanel] Failed to create feedback tab view; keeping the shell open.', {
                    error: String(error),
                });
                this.feedbackView = createFallbackTabView('aimd-feedback');
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

    private switchToTab(nextTab: BookmarksPanelTabId): void {
        if (!this.tabWorkflow.select(nextTab)) return;
        this.bookmarksView?.dismissTransientUi?.();
        this.settingsView?.dismissTransientUi?.();
        this.changelogView?.dismissTransientUi?.();
        this.aboutView?.dismissTransientUi?.();
        this.mappamoryView?.dismissTransientUi?.();
        this.faqView?.dismissTransientUi?.();
        this.sponsorView?.dismissTransientUi?.();
        this.feedbackView?.dismissTransientUi?.();
        this.render();
    }

    private async maybeShowChangelogNotice(): Promise<void> {
        if (this.changelogNoticeCheckedForSession || !this.visible || this.closing || !this.modalHost) return;
        this.changelogNoticeCheckedForSession = true;

        const modalHost = this.modalHost;
        await showChangelogNoticeIfNeeded({
            modalHost,
            loggerScope: 'BookmarksPanel',
            resolveAssetUrl: (assetPath) => browser.runtime.getURL(assetPath),
            onViewAll: () => {
                if (!this.visible || this.closing) return;
                this.switchToTab('changelog');
            },
        });
    }

    private async handleClick(event: Event): Promise<void> {
        const target = event.target as HTMLElement | null;
        if (target?.closest('.aimd-settings')) return;
        if (target?.closest('.bookmarks-tab-content')) return;
        if (TARGET_SURFACE_SPONSOR_TAB_ENABLED && this.tabWorkflow.getActiveTab() === 'sponsor' && (target?.closest('.aimd-sponsor') || target?.closest('.sponsor-panel'))) {
            this.emitSponsorBurst(event as MouseEvent);
            return;
        }
        const actionEl = target?.closest<HTMLElement>('[data-action]');
        if (!actionEl) return;

        const action = actionEl.dataset.action;
        logBookmarksPerf('panel:action', {
            action,
            tab: this.tabWorkflow.getActiveTab(),
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
        const bookmarksView = this.bookmarksView && 'getTreeScrollTop' in this.bookmarksView
            ? this.bookmarksView as BookmarksTabView
            : null;
        this.tabWorkflow.captureScrollPositions(this.hostHandle.surfaceRoot, bookmarksView);
    }

    private restoreScrollTop(): void {
        if (!this.hostHandle) return;
        const bookmarksView = this.bookmarksView && 'restoreTreeScroll' in this.bookmarksView
            ? this.bookmarksView as BookmarksTabView
            : null;
        this.tabWorkflow.restoreActiveScrollPosition(this.hostHandle.surfaceRoot, bookmarksView);
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
            'color-mix(in srgb, var(--aimd-state-success-border) 72%, var(--aimd-color-success))',
            'color-mix(in srgb, var(--aimd-text-primary) 24%, var(--aimd-color-white))',
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
