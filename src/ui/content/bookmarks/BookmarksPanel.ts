import { DEFAULT_SETTINGS, type AppSettings } from '../../../core/settings/types';
import { loadAndNormalize } from '../../../services/settings/settingsService';
import { settingsClientRpc } from '../../../drivers/shared/clients/settingsClientRpc';
import { CLOUD_BACKUP_RPC_TIMEOUT_MS, cloudBackupClient } from '../../../drivers/shared/clients/cloudBackupClient';
import { browser, browserInfo } from '../../../drivers/shared/browser';
import type { UserThemeOverrides } from '../../../style/tokens';
import {
    bookmarkIcon,
    coffeeIcon,
    fileTextIcon,
    infoIcon,
    messageSquareTextIcon,
    sendIcon,
    settingsIcon,
    xIcon,
} from '../../../assets/icons';
import { getBookmarksPanelCss } from './ui/styles/bookmarksPanelCss';
import type { BookmarksPanelController, BookmarksPanelSnapshot } from './BookmarksPanelController';
import { BookmarksTabView } from './ui/tabs/BookmarksTabView';
import { createBookmarksTabActions } from './ui/tabs/bookmarksTabActions';
import { SettingsTabView, type SettingsTabViewActions } from './ui/tabs/SettingsTabView';
import { ChangelogTabView } from './ui/tabs/ChangelogTabView';
import { FeedbackTabView } from './ui/tabs/FeedbackTabView';
import { AboutTabView } from './ui/tabs/AboutTabView';
import { FaqTabView } from './ui/tabs/FaqTabView';
import { SponsorTabView } from './ui/tabs/SponsorTabView';
import { createBookmarksPanelShell, type BookmarksPanelTabSpec } from './ui/BookmarksPanelShell';
import { buildImportMergeReviewModalBody } from './ui/importMergeReview';
import { OverlaySession } from '../overlay/OverlaySession';
import type { ReaderPanel } from '../reader/ReaderPanel';
import { TooltipDelegate } from '../../../utils/tooltip';
import { subscribeLocaleChange, t } from '../components/i18n';
import { logger } from '../../../core/logger';
import type { CloudBackupProviderId } from '../../../contracts/protocol';
import type { CloudBackupSnapshotSummary } from '../../../core/cloudBackup/types';
import { eventWithinTransientRoot } from '../components/transientUi';
import { beginSurfaceMotionClose, setSurfaceMotionOpening } from '../components/motionLifecycle';
import { SurfaceFocusLifecycle } from '../components/surfaceFocusLifecycle';
import { showChangelogNoticeIfNeeded } from '../changelog/ChangelogNoticePresenter';
import {
    TARGET_SURFACE_SOCIAL_FOLLOW_CARD_ENABLED,
    TARGET_SURFACE_SPONSOR_TAB_ENABLED,
} from '../../../config/targetSurface';
import { GOOGLE_DRIVE_WEB_AUTH_CLIENT_ID } from '../../../../config/extension/cloudBackup';

type PanelTabId = 'bookmarks' | 'settings' | 'changelog' | 'about' | 'faq' | 'sponsor' | 'feedback';

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

type CloudBackupProgressController = {
    update(message: string): void;
    close(): void;
};

type CloudBackupProgressOptions = {
    timeoutBudgetMs?: number;
};

function isPanelTabId(value: string): value is PanelTabId {
    return value === 'bookmarks'
        || value === 'settings'
        || value === 'changelog'
        || value === 'about'
        || value === 'faq'
        || value === 'sponsor'
        || value === 'feedback';
}

function isEnabledPanelTab(tab: PanelTabId): boolean {
    return tab !== 'sponsor' || TARGET_SURFACE_SPONSOR_TAB_ENABLED;
}

function normalizePanelTab(tab: PanelTabId): PanelTabId {
    return isEnabledPanelTab(tab) ? tab : 'bookmarks';
}

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

function formatCloudBackupSnapshotCreatedAt(value: string): string {
    if (Number.isNaN(Date.parse(value))) return value || 'Unknown time';
    return new Date(value).toLocaleString();
}

function formatCloudBackupSnapshotSize(value: number): string {
    if (!Number.isFinite(value) || value <= 0) return tr('cloudBackupSnapshotSizeUnknown', 'Unknown size');
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = value;
    let unitIndex = 0;
    while (size >= 1024 && unitIndex < units.length - 1) {
        size /= 1024;
        unitIndex += 1;
    }
    const digits = unitIndex === 0 || size >= 10 ? 0 : 1;
    return `${size.toFixed(digits)} ${units[unitIndex]}`;
}

function formatCloudBackupProgressRemaining(milliseconds: number): string {
    const totalSeconds = Math.max(0, Math.ceil(milliseconds / 1000));
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
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
        sponsor: 0,
        feedback: 0,
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

        if (!panel.contains(target)) {
            this.hide();
            return;
        }

        if (!eventWithinTransientRoot(event)) {
            this.bookmarksView?.dismissTransientUi?.();
            this.settingsView?.dismissTransientUi?.();
            this.feedbackView?.dismissTransientUi?.();
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

    private resolveThemeOverrides(): UserThemeOverrides {
        const getThemeOverrides = this.controller.getThemeOverrides;
        return typeof getThemeOverrides === 'function' ? getThemeOverrides.call(this.controller) : {};
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
        this.overlaySession = new OverlaySession({
            id: 'aimd-bookmarks-panel-host',
            theme: this.controller.getTheme(),
            themeOverrides: this.resolveThemeOverrides(),
            surfaceCss: getBookmarksPanelCss(),
            lockScroll: true,
            surfaceStyleId: 'aimd-bookmarks-panel-structure',
            overlayStyleId: 'aimd-bookmarks-panel-overlay-extra',
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
            this.sponsorView?.destroy?.();
            this.sponsorView = null;
            this.feedbackView?.destroy?.();
            this.feedbackView = null;
            this.render();
        });

        this.unsubscribeSnapshot = this.controller.subscribe((snapshot) => {
            this.overlaySession?.setTheme(this.controller.getTheme());
            this.overlaySession?.setThemeOverrides(this.resolveThemeOverrides());
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
                this.uiState.settings = {
                    ...this.uiState.settings,
                    language: value,
                };
                await settingsClientRpc.setCategory('language', value);
            },
            exportAllBookmarks: async () => {
                await this.exportAll();
            },
            cloudBackup: hasGoogleDriveBackupCapability() ? {
                status: async (provider) => {
                    const result = await cloudBackupClient.status(provider);
                    if (!result.ok) return { connected: false, lastError: result.message };
                    return result.data ?? { connected: false };
                },
                connect: async (provider) => {
                    const confirmed = await this.modalHost?.confirm({
                        kind: 'info',
                        title: tr('cloudBackupConnectConfirmTitle', 'Connect Google Drive?'),
                        message: tr(
                            'cloudBackupConnectConfirmDesc',
                            'AI-MarkDone will open Google authorization so you can choose your own Drive. This feature is experimental; before backing up to Google Drive, we recommend exporting a local copy first. AI-MarkDone does not collect your Google account, token, password, or bookmarks.',
                        ),
                        confirmText: tr('cloudBackupConnectConfirmAction', 'Continue'),
                        cancelText: tr('btnCancel', 'Cancel'),
                    });
                    if (!confirmed) return { connected: false };
                    const result = await cloudBackupClient.connect(provider);
                    if (!result.ok) {
                        await this.modalHost?.alert({ kind: 'error', title: tr('cloudBackupErrorTitle', 'Google Drive backup failed'), message: result.message, confirmText: tr('btnOk', 'OK') });
                        return { connected: false };
                    }
                    return { connected: true };
                },
                disconnect: async (provider) => {
                    const result = await cloudBackupClient.disconnect(provider);
                    if (!result.ok) {
                        await this.modalHost?.alert({ kind: 'error', title: tr('cloudBackupErrorTitle', 'Google Drive backup failed'), message: result.message, confirmText: tr('btnOk', 'OK') });
                        return { connected: true };
                    }
                    return { connected: false };
                },
                openSettings: async () => {
                    await this.showGoogleDriveBackupSettings();
                },
                backupNow: async (provider) => {
                    await this.backupToCloud(provider);
                },
                restore: async (provider) => {
                    await this.previewCloudRestore(provider);
                },
            } : undefined,
        };
    }

    private render(): void {
        if (!this.overlaySession || !this.hostHandle || this.closing) return;
        const startedAt = performance.now();
        this.captureScrollTops();
        this.recreateTabViews();
        this.uiState.bookmarksTab = normalizePanelTab(this.uiState.bookmarksTab);

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
        const feedbackPanel = this.feedbackView?.getElement() ?? document.createElement('section');
        feedbackPanel.classList.add('feedback-panel');

        const titleText = this.uiState.bookmarksTab === 'bookmarks'
            ? tr('tabBookmarks', 'Bookmarks')
            : this.uiState.bookmarksTab === 'settings'
                ? tr('tabSettings', 'Settings')
                : this.uiState.bookmarksTab === 'changelog'
                    ? tr('tabChangelog', 'Changelog')
                    : this.uiState.bookmarksTab === 'faq'
                        ? tr('tabFaq', 'FAQ')
                        : this.uiState.bookmarksTab === 'about'
                            ? tr('tabAbout', 'About')
                            : this.uiState.bookmarksTab === 'feedback'
                                ? tr('tabFeedback', 'Feedback')
                                : TARGET_SURFACE_SPONSOR_TAB_ENABLED
                                    ? tr('tabSponsor', 'Buy Me Coffee')
                                    : tr('tabBookmarks', 'Bookmarks');
        const tabs: BookmarksPanelTabSpec[] = [
            { id: 'bookmarks', label: tr('tabBookmarks', 'Bookmarks'), icon: bookmarkIcon, content: bookmarksPanel, panelClassName: 'tab-panel--bookmarks' },
            { id: 'settings', label: tr('tabSettings', 'Settings'), icon: settingsIcon, content: settingsPanel, panelClassName: 'settings-panel' },
            { id: 'changelog', label: tr('tabChangelog', 'Changelog'), icon: fileTextIcon, content: changelogPanel, panelClassName: 'changelog-panel' },
            { id: 'faq', label: tr('tabFaq', 'FAQ'), icon: messageSquareTextIcon, content: faqPanel, panelClassName: 'faq-panel' },
            { id: 'about', label: tr('tabAbout', 'About'), icon: infoIcon, content: aboutPanel, panelClassName: 'about-panel' },
        ];
        if (TARGET_SURFACE_SPONSOR_TAB_ENABLED) {
            const sponsorPanel = this.sponsorView?.getElement() ?? document.createElement('section');
            sponsorPanel.classList.add('sponsor-panel');
            tabs.push({ id: 'sponsor', label: tr('tabSponsor', 'Buy Me Coffee'), icon: coffeeIcon, content: sponsorPanel, panelClassName: 'sponsor-panel' });
        }
        tabs.push({ id: 'feedback', label: tr('tabFeedback', 'Feedback'), icon: sendIcon, content: feedbackPanel, panelClassName: 'feedback-panel' });

        const shell = createBookmarksPanelShell({
            titleText,
            closeIcon: xIcon,
            closeLabel: tr('btnClose', 'Close panel'),
            defaultTabId: this.uiState.bookmarksTab,
            tabs,
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
            if (isPanelTabId(nextTab) && isEnabledPanelTab(nextTab)) {
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
        if (
            this.bookmarksView
            && this.settingsView
            && this.changelogView
            && this.aboutView
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
                this.feedbackView = new FeedbackTabView();
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

    private switchToTab(nextTab: PanelTabId): void {
        if (!isEnabledPanelTab(nextTab)) return;
        if (this.uiState.bookmarksTab === nextTab) return;
        this.bookmarksView?.dismissTransientUi?.();
        this.settingsView?.dismissTransientUi?.();
        this.changelogView?.dismissTransientUi?.();
        this.aboutView?.dismissTransientUi?.();
        this.faqView?.dismissTransientUi?.();
        this.sponsorView?.dismissTransientUi?.();
        this.feedbackView?.dismissTransientUi?.();
        this.uiState.bookmarksTab = nextTab;
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
        if (TARGET_SURFACE_SPONSOR_TAB_ENABLED && this.uiState.bookmarksTab === 'sponsor' && (target?.closest('.aimd-sponsor') || target?.closest('.sponsor-panel'))) {
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
        const sponsorPanel = this.hostHandle.surfaceRoot.querySelector<HTMLElement>('.sponsor-panel');
        const feedbackPanel = this.hostHandle.surfaceRoot.querySelector<HTMLElement>('.feedback-panel');

        if (typeof bookmarksPanel === 'number') this.panelScrollTops.bookmarks = bookmarksPanel;
        if (settingsPanel) this.panelScrollTops.settings = settingsPanel.scrollTop;
        if (changelogPanel) this.panelScrollTops.changelog = changelogPanel.scrollTop;
        if (aboutPanel) this.panelScrollTops.about = aboutPanel.scrollTop;
        if (faqPanel) this.panelScrollTops.faq = faqPanel.scrollTop;
        if (sponsorPanel) this.panelScrollTops.sponsor = sponsorPanel.scrollTop;
        if (feedbackPanel) this.panelScrollTops.feedback = feedbackPanel.scrollTop;
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
                    : this.uiState.bookmarksTab === 'faq'
                        ? '.faq-panel'
                        : this.uiState.bookmarksTab === 'sponsor'
                            ? '.sponsor-panel'
                            : '.feedback-panel';
        const panel = this.hostHandle.surfaceRoot.querySelector<HTMLElement>(panelClass);
        if (!panel) return;
        if (this.uiState.bookmarksTab === 'changelog') panel.scrollTop = this.panelScrollTops.changelog;
        if (this.uiState.bookmarksTab === 'about') panel.scrollTop = this.panelScrollTops.about;
        if (this.uiState.bookmarksTab === 'faq') panel.scrollTop = this.panelScrollTops.faq;
        if (this.uiState.bookmarksTab === 'sponsor') panel.scrollTop = this.panelScrollTops.sponsor;
        if (this.uiState.bookmarksTab === 'feedback') panel.scrollTop = this.panelScrollTops.feedback;
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

    private async backupToCloud(provider: CloudBackupProviderId): Promise<void> {
        const progress = this.showCloudBackupProgress(
            tr('cloudBackupBackupNow', 'Back up now'),
            tr('cloudBackupProgressConfirmingAccess', 'Confirming Google Drive access...'),
            [
                tr('cloudBackupProgressConfirmingAccess', 'Confirming Google Drive access...'),
                tr('cloudBackupProgressPreparingBookmarks', 'Preparing local bookmarks...'),
                tr('cloudBackupProgressCreatingSnapshot', 'Creating a verified snapshot...'),
                tr('cloudBackupProgressUploadingDrive', 'Uploading to Google Drive...'),
                tr('cloudBackupProgressVerifyingUpload', 'Reading the file back for verification...'),
                tr('cloudBackupProgressComplete', 'Finishing up...'),
            ],
            { timeoutBudgetMs: CLOUD_BACKUP_RPC_TIMEOUT_MS.backupNow },
        );
        progress?.update(tr('cloudBackupProgressUploadingDrive', 'Uploading to Google Drive...'));
        let result: Awaited<ReturnType<typeof cloudBackupClient.backupNow>>;
        try {
            result = await cloudBackupClient.backupNow(provider);
        } finally {
            progress?.close();
        }
        await this.modalHost?.alert({
            kind: result.ok ? 'info' : 'error',
            title: result.ok ? tr('cloudBackupCompleteTitle', 'Backup complete') : tr('cloudBackupErrorTitle', 'Google Drive backup failed'),
            message: result.ok
                ? tr('cloudBackupCompleteDesc', 'A verified bookmark snapshot was saved to your Google Drive.')
                : result.message,
            confirmText: tr('btnOk', 'OK'),
        });
    }

    private async previewCloudRestore(provider: CloudBackupProviderId): Promise<void> {
        const listProgress = this.showCloudBackupProgress(
            tr('cloudBackupRestore', 'Preview restore'),
            tr('cloudBackupProgressConfirmingAccess', 'Confirming Google Drive access...'),
            [
                tr('cloudBackupProgressConfirmingAccess', 'Confirming Google Drive access...'),
                tr('cloudBackupProgressReadingList', 'Reading Google Drive backups...'),
                tr('cloudBackupProgressDownloadingSnapshot', 'Downloading the selected backup...'),
                tr('cloudBackupProgressBuildingPreview', 'Generating a safe merge preview...'),
                tr('cloudBackupProgressWaitingConfirmation', 'Waiting for confirmation...'),
                tr('cloudBackupProgressApplyingMerge', 'Applying safe merge...'),
            ],
            { timeoutBudgetMs: CLOUD_BACKUP_RPC_TIMEOUT_MS.listSnapshots },
        );
        let list: Awaited<ReturnType<typeof cloudBackupClient.listSnapshots>>;
        try {
            list = await cloudBackupClient.listSnapshots(provider);
        } finally {
            listProgress?.close();
        }
        if (!list.ok) {
            await this.modalHost?.alert({ kind: 'error', title: tr('cloudBackupErrorTitle', 'Google Drive backup failed'), message: list.message, confirmText: tr('btnOk', 'OK') });
            return;
        }
        const snapshots = list.data.snapshots ?? [];
        if (snapshots.length === 0) {
            await this.modalHost?.alert({
                kind: 'info',
                title: tr('cloudBackupNoSnapshotsTitle', 'No Google Drive backups found'),
                message: tr('cloudBackupNoSnapshotsDesc', 'Google Drive does not have any AI-MarkDone bookmark backups yet.'),
                confirmText: tr('btnOk', 'OK'),
            });
            return;
        }
        const selected = await this.chooseCloudSnapshot(snapshots);
        if (!selected) return;
        const previewProgress = this.showCloudBackupProgress(
            tr('cloudBackupRestore', 'Preview restore'),
            tr('cloudBackupProgressConfirmingAccess', 'Confirming Google Drive access...'),
            [
                tr('cloudBackupProgressConfirmingAccess', 'Confirming Google Drive access...'),
                tr('cloudBackupProgressDownloadingSnapshot', 'Downloading the selected backup...'),
                tr('cloudBackupProgressBuildingPreview', 'Generating a safe merge preview...'),
            ],
            { timeoutBudgetMs: CLOUD_BACKUP_RPC_TIMEOUT_MS.previewRestore },
        );
        previewProgress?.update(tr('cloudBackupProgressBuildingPreview', 'Generating a safe merge preview...'));
        let preview: Awaited<ReturnType<typeof cloudBackupClient.previewRestore>>;
        try {
            preview = await cloudBackupClient.previewRestore({ provider, snapshotId: selected.snapshotId, strategy: 'safeMerge' });
        } finally {
            previewProgress?.close();
        }
        if (!preview.ok) {
            await this.modalHost?.alert({ kind: 'error', title: tr('cloudBackupErrorTitle', 'Google Drive backup failed'), message: preview.message, confirmText: tr('btnOk', 'OK') });
            return;
        }
        const shouldApply = await this.confirmCloudBackupRestorePreview(preview.data);
        if (!shouldApply) return;

        const applyProgress = this.showCloudBackupProgress(
            tr('cloudBackupApplyRestore', 'Apply safe merge'),
            tr('cloudBackupProgressConfirmingAccess', 'Confirming Google Drive access...'),
            [
                tr('cloudBackupProgressConfirmingAccess', 'Confirming Google Drive access...'),
                tr('cloudBackupProgressApplyingMerge', 'Applying safe merge...'),
            ],
            { timeoutBudgetMs: CLOUD_BACKUP_RPC_TIMEOUT_MS.applyRestore },
        );
        let applied: Awaited<ReturnType<typeof cloudBackupClient.applyRestore>>;
        try {
            applied = await cloudBackupClient.applyRestore({ provider, snapshotId: selected.snapshotId, strategy: 'safeMerge' });
        } finally {
            applyProgress?.close();
        }
        if (!applied.ok) {
            await this.modalHost?.alert({ kind: 'error', title: tr('cloudBackupErrorTitle', 'Google Drive backup failed'), message: applied.message, confirmText: tr('btnOk', 'OK') });
            return;
        }
        const result = applied.data ?? {};
        await this.modalHost?.alert({
            kind: 'info',
            title: tr('cloudBackupRestoreCompleteTitle', 'Restore complete'),
            message: tr('cloudBackupRestoreCompleteDesc', 'Added $1 bookmark(s). Kept $2 local-only item(s), skipped $3 duplicate(s), and left $4 conflict(s) unchanged.', [
                String(result.restored ?? 0),
                String(result.localOnly ?? 0),
                String(result.skippedDuplicates ?? 0),
                String(result.conflicts ?? 0),
            ]),
            confirmText: tr('btnOk', 'OK'),
        });
    }

    private async confirmCloudBackupRestorePreview(previewData: any): Promise<boolean> {
        const modal = this.modalHost;
        if (!modal) return false;
        const plan = previewData?.plan ?? {};
        const warnings: string[] = [];
        const localOnly = Number(plan.localOnlyCount ?? 0);
        const conflicts = Number(plan.conflictCount ?? 0);
        if (localOnly > 0) {
            warnings.push(tr('cloudBackupRestoreLocalOnlyWarning', '$1 local-only bookmark(s) will stay untouched.', [String(localOnly)]));
        }
        if (conflicts > 0) {
            warnings.push(tr('cloudBackupRestoreConflictWarning', '$1 conflict(s) will keep the local copy.', [String(conflicts)]));
        }
        const review = buildImportMergeReviewModalBody({
            imported: Array.isArray(plan.bookmarksToUpsert) ? plan.bookmarksToUpsert.length : 0,
            skippedDuplicates: Number(plan.duplicateCount ?? 0),
            renamed: 0,
            folderCreateFailures: 0,
            warnings,
        });

        return new Promise((resolve) => {
            void modal.showCustom({
                kind: warnings.length > 0 ? 'warning' : review.kind,
                title: tr('cloudBackupRestorePreviewKind', 'Safe merge preview'),
                body: review.body,
                footer: (footer, close) => {
                    const cancel = document.createElement('button');
                    cancel.type = 'button';
                    cancel.className = 'mock-modal__button mock-modal__button--secondary';
                    cancel.textContent = tr('btnCancel', 'Cancel');
                    cancel.dataset.action = 'modal-cancel';
                    cancel.addEventListener('click', () => {
                        close();
                        resolve(false);
                    });

                    const apply = document.createElement('button');
                    apply.type = 'button';
                    apply.className = 'mock-modal__button mock-modal__button--primary';
                    apply.textContent = tr('cloudBackupApplyRestore', 'Apply safe merge');
                    apply.dataset.action = 'modal-confirm';
                    apply.addEventListener('click', () => {
                        close();
                        resolve(true);
                    });

                    footer.append(cancel, apply);
                    window.setTimeout(() => apply.focus(), 0);
                },
                onDismiss: () => resolve(false),
            });
        });
    }

    private showCloudBackupProgress(
        title: string,
        initialMessage: string,
        steps: string[] = [],
        options: CloudBackupProgressOptions = {},
    ): CloudBackupProgressController | null {
        const modal = this.modalHost;
        if (!modal) return null;

        const body = document.createElement('div');
        body.className = 'cloud-backup-progress';

        const status = document.createElement('p');
        status.className = 'cloud-backup-progress__status';
        status.dataset.role = 'cloud-backup-progress-status';
        status.textContent = initialMessage;

        const budget = document.createElement('p');
        budget.className = 'cloud-backup-progress__budget';
        budget.dataset.role = 'cloud-backup-progress-budget';

        const list = document.createElement('ol');
        list.className = 'cloud-backup-progress__steps';
        const renderedSteps = steps.length > 0 ? steps : [initialMessage];
        renderedSteps.forEach((step, index) => {
            const item = document.createElement('li');
            item.textContent = step;
            item.dataset.active = index === 0 ? '1' : '0';
            list.appendChild(item);
        });

        const timeoutBudgetMs = options.timeoutBudgetMs;
        const startedAt = Date.now();
        const updateBudget = () => {
            if (!timeoutBudgetMs) return;
            const remaining = timeoutBudgetMs - (Date.now() - startedAt);
            budget.textContent = tr('cloudBackupProgressTimeBudget', 'Timeout budget: $1 remaining', [
                formatCloudBackupProgressRemaining(remaining),
            ]);
        };
        updateBudget();

        if (timeoutBudgetMs) body.append(status, budget, list);
        else body.append(status, list);

        let closeModal: (() => void) | null = null;
        const budgetTimer = timeoutBudgetMs
            ? window.setInterval(updateBudget, 1000)
            : null;
        void modal.showCustom({
            kind: 'info',
            title,
            body,
            footer: (footer, close) => {
                closeModal = close;
                const working = document.createElement('button');
                working.type = 'button';
                working.className = 'mock-modal__button mock-modal__button--secondary';
                working.textContent = tr('cloudBackupProgressWorking', 'Working...');
                working.disabled = true;
                footer.appendChild(working);
            },
            onDismiss: () => {
                if (budgetTimer !== null) window.clearInterval(budgetTimer);
                closeModal = null;
            },
        });

        return {
            update: (message: string) => {
                status.textContent = message;
                Array.from(list.children).forEach((child) => {
                    const item = child as HTMLElement;
                    item.dataset.active = item.textContent === message ? '1' : '0';
                });
            },
            close: () => {
                const close = closeModal;
                closeModal = null;
                if (budgetTimer !== null) window.clearInterval(budgetTimer);
                window.setTimeout(() => close?.(), 0);
            },
        };
    }

    private async chooseCloudSnapshot(snapshots: CloudBackupSnapshotSummary[]): Promise<CloudBackupSnapshotSummary | null> {
        const modal = this.modalHost;
        if (!modal) return snapshots[0] ?? null;
        return new Promise((resolve) => {
            const body = document.createElement('div');
            body.className = 'cloud-backup-settings-modal';

            const description = document.createElement('p');
            description.textContent = tr(
                'cloudBackupChooseSnapshotDesc',
                'Choose the Google Drive backup to inspect. This step only previews a safe merge and does not change local bookmarks.',
            );

            let selectedId = snapshots[0]?.snapshotId ?? null;
            const list = document.createElement('div');
            list.className = 'cloud-backup-snapshot-list';
            list.dataset.role = 'cloud-backup-snapshot-list';

            const updateSelected = () => {
                Array.from(list.querySelectorAll<HTMLElement>('.cloud-backup-snapshot-option')).forEach((option) => {
                    const selected = option.dataset.snapshotId === selectedId;
                    option.dataset.selected = selected ? '1' : '0';
                    option.setAttribute('aria-checked', selected ? 'true' : 'false');
                });
            };

            snapshots.forEach((snapshot, index) => {
                const option = document.createElement('button');
                option.type = 'button';
                option.className = 'cloud-backup-snapshot-option';
                option.dataset.snapshotId = snapshot.snapshotId;
                option.dataset.selected = index === 0 ? '1' : '0';
                option.setAttribute('role', 'radio');
                option.setAttribute('aria-checked', index === 0 ? 'true' : 'false');

                const radio = document.createElement('span');
                radio.className = 'cloud-backup-snapshot-radio';
                radio.setAttribute('aria-hidden', 'true');

                const content = document.createElement('span');
                content.className = 'cloud-backup-snapshot-content';

                const createdAt = document.createElement('strong');
                createdAt.className = 'cloud-backup-snapshot-time';
                createdAt.textContent = formatCloudBackupSnapshotCreatedAt(snapshot.createdAt);

                const name = document.createElement('span');
                name.className = 'cloud-backup-snapshot-name';
                name.textContent = snapshot.name;
                name.title = snapshot.name;

                const size = document.createElement('span');
                size.className = 'cloud-backup-snapshot-size';
                size.textContent = formatCloudBackupSnapshotSize(snapshot.size);

                content.append(createdAt, name, size);
                option.append(radio, content);
                option.addEventListener('click', () => {
                    selectedId = snapshot.snapshotId;
                    updateSelected();
                });
                list.appendChild(option);
            });

            body.append(description, list);
            void modal.showCustom({
                kind: 'info',
                title: tr('cloudBackupChooseSnapshotTitle', 'Choose Google Drive backup'),
                body,
                footer: (footer, close) => {
                    const cancel = document.createElement('button');
                    cancel.type = 'button';
                    cancel.className = 'mock-modal__button mock-modal__button--secondary';
                    cancel.textContent = tr('btnCancel', 'Cancel');
                    cancel.dataset.action = 'modal-cancel';
                    cancel.addEventListener('click', () => {
                        close();
                        resolve(null);
                    });

                    const confirm = document.createElement('button');
                    confirm.type = 'button';
                    confirm.className = 'mock-modal__button mock-modal__button--primary';
                    confirm.textContent = tr('cloudBackupRestore', 'Preview restore');
                    confirm.dataset.action = 'modal-confirm';
                    confirm.addEventListener('click', () => {
                        const selected = snapshots.find((snapshot) => snapshot.snapshotId === selectedId) ?? snapshots[0] ?? null;
                        close();
                        resolve(selected);
                    });

                    footer.append(cancel, confirm);
                    window.setTimeout(() => list.querySelector<HTMLElement>('.cloud-backup-snapshot-option')?.focus(), 0);
                },
                onDismiss: () => resolve(null),
            });
        });
    }

    private async showGoogleDriveBackupSettings(): Promise<void> {
        const modal = this.modalHost;
        if (!modal) return;
        const body = document.createElement('div');
        body.className = 'cloud-backup-settings-modal';

        const summary = document.createElement('div');
        summary.className = 'settings-label settings-item-info';
        const title = document.createElement('strong');
        title.textContent = 'Google Drive';
        const privacy = document.createElement('p');
        privacy.className = 'cloud-backup-settings-modal__privacy';
        privacy.textContent = tr('cloudBackupPrivacyNote', 'AI-MarkDone does not collect your Google account, token, password, or bookmarks.');
        summary.append(title, privacy);
        body.appendChild(summary);

        const statusRow = document.createElement('div');
        statusRow.className = 'settings-row settings-item cloud-backup-settings-modal__status-card';
        const statusInfo = document.createElement('div');
        statusInfo.className = 'settings-label settings-item-info';
        const statusTitle = document.createElement('strong');
        statusTitle.textContent = tr('cloudBackupStatusLabel', 'Status');
        const status = document.createElement('p');
        status.textContent = tr('cloudBackupStatusChecking', 'Checking Google Drive status...');
        const account = document.createElement('p');
        account.className = 'cloud-backup-settings-modal__account';
        account.hidden = true;
        statusInfo.append(statusTitle, status);
        statusInfo.appendChild(account);
        statusRow.appendChild(statusInfo);
        body.appendChild(statusRow);

        const actions = document.createElement('div');
        actions.className = 'cloud-backup-settings-modal__actions';
        body.appendChild(actions);

        const formatAccount = (data: any): string => {
            const accountData = data?.connectedAccount && typeof data.connectedAccount === 'object' ? data.connectedAccount : data;
            const displayName = typeof accountData?.accountDisplayName === 'string' ? accountData.accountDisplayName.trim() : '';
            const email = typeof accountData?.accountEmail === 'string' ? accountData.accountEmail.trim() : '';
            return displayName && email ? `${displayName} · ${email}` : displayName || email;
        };

        const setStatus = async () => {
            const result = await cloudBackupClient.status('googleDrive');
            if (!result.ok) {
                status.textContent = result.message;
                account.hidden = true;
                return;
            }
            const accountText = formatAccount(result.data);
            if (result.data?.connected) {
                status.textContent = accountText
                    ? (() => {
                        const translated = tr('cloudBackupConnectedAs', 'Connected as $1', [accountText]);
                        return translated && translated !== 'cloudBackupConnectedAs' ? translated : `Connected as ${accountText}`;
                    })()
                    : tr('cloudBackupConnectedStatus', 'Connected');
            } else {
                status.textContent = tr('cloudBackupDisconnected', 'Not connected');
            }
            account.hidden = !accountText;
            account.textContent = accountText;
            account.title = accountText;
        };

        const list = document.createElement('button');
        list.type = 'button';
        list.className = 'secondary-btn';
        list.textContent = tr('cloudBackupTestConnection', 'Test connection');
        list.addEventListener('click', () => void (async () => {
            list.disabled = true;
            status.textContent = tr('cloudBackupProgressConfirmingAccess', 'Confirming Google Drive access...');
            try {
                const result = await cloudBackupClient.listSnapshots('googleDrive');
                status.textContent = result.ok
                    ? tr('cloudBackupSnapshotCount', '$1 Google Drive backup(s) found.', [String(result.data.snapshots?.length ?? 0)])
                    : result.message;
            } finally {
                list.disabled = false;
            }
        })());

        const manage = document.createElement('button');
        manage.type = 'button';
        manage.className = 'secondary-btn';
        manage.textContent = tr('cloudBackupManageBackups', 'Manage cloud backups');
        manage.addEventListener('click', () => void this.showCloudBackupManager());

        actions.append(list, manage);
        await setStatus();
        await modal.showCustom({
            kind: 'info',
            title: tr('cloudBackupGoogleDriveSettingsTitle', 'Google Drive backup settings'),
            body,
        });
    }

    private async showCloudBackupManager(): Promise<void> {
        const modal = this.modalHost;
        if (!modal) return;
        const body = document.createElement('div');
        body.className = 'cloud-backup-settings-modal';
        const description = document.createElement('p');
        description.textContent = tr(
            'cloudBackupManageBackupsDesc',
            'These are backup files AI-MarkDone created in your Google Drive. Moving one to trash never changes local bookmarks.',
        );
        const listRoot = document.createElement('div');
        listRoot.className = 'cloud-backup-manager-list';
        listRoot.dataset.role = 'cloud-backup-manager-list';
        body.append(description, listRoot);

        const loadSnapshots = async () => {
            listRoot.dataset.state = 'loading';
            listRoot.textContent = tr('cloudBackupProgressConfirmingAccess', 'Confirming Google Drive access...');
            const result = await cloudBackupClient.listSnapshots('googleDrive');
            if (!result.ok) {
                listRoot.dataset.state = 'error';
                listRoot.textContent = result.message;
                return;
            }
            const snapshots = result.data.snapshots ?? [];
            if (snapshots.length === 0) {
                listRoot.dataset.state = 'empty';
                listRoot.textContent = tr('cloudBackupManageEmpty', 'No Google Drive backups yet.');
                return;
            }
            listRoot.dataset.state = 'ready';
            listRoot.replaceChildren(...snapshots.map((snapshot: CloudBackupSnapshotSummary) => {
                const row = document.createElement('article');
                row.className = 'cloud-backup-manager-item';
                const info = document.createElement('div');
                info.className = 'cloud-backup-manager-info';

                const createdAt = document.createElement('strong');
                createdAt.textContent = formatCloudBackupSnapshotCreatedAt(snapshot.createdAt);

                const fileName = document.createElement('span');
                fileName.className = 'cloud-backup-manager-name';
                fileName.textContent = snapshot.name;
                fileName.title = snapshot.name;

                const size = document.createElement('span');
                size.className = 'cloud-backup-manager-size';
                size.textContent = formatCloudBackupSnapshotSize(snapshot.size);
                info.append(createdAt, fileName, size);

                const trash = document.createElement('button');
                trash.type = 'button';
                trash.className = 'secondary-btn secondary-btn--danger cloud-backup-manager-trash';
                trash.textContent = tr('cloudBackupMoveToTrash', 'Move to trash');
                trash.addEventListener('click', () => void (async () => {
                    const confirmed = await modal.confirm({
                        kind: 'warning',
                        title: tr('cloudBackupMoveToTrashConfirmTitle', 'Move backup to trash?'),
                        message: tr('cloudBackupMoveToTrashConfirmDesc', 'This moves "$1" to Google Drive trash. Local bookmarks will not be changed.', [snapshot.name]),
                        confirmText: tr('cloudBackupMoveToTrash', 'Move to trash'),
                        cancelText: tr('btnCancel', 'Cancel'),
                        danger: true,
                    });
                    if (!confirmed) return;
                    trash.disabled = true;
                    trash.textContent = tr('cloudBackupProgressConfirmingAccess', 'Confirming Google Drive access...');
                    const deleted = await cloudBackupClient.deleteSnapshot({ provider: 'googleDrive', snapshotId: snapshot.snapshotId });
                    trash.disabled = false;
                    trash.textContent = tr('cloudBackupMoveToTrash', 'Move to trash');
                    if (!deleted.ok) {
                        await modal.alert({ kind: 'error', title: tr('cloudBackupErrorTitle', 'Google Drive backup failed'), message: deleted.message, confirmText: tr('btnOk', 'OK') });
                        return;
                    }
                    await loadSnapshots();
                })());

                row.append(info, trash);
                return row;
            }));
        };

        await loadSnapshots();
        await modal.showCustom({
            kind: 'info',
            title: tr('cloudBackupManageBackups', 'Manage cloud backups'),
            body,
        });
    }
}
