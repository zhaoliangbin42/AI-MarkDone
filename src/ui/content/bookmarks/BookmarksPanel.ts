import { DEFAULT_SETTINGS, type AppSettings } from '../../../core/settings/types';
import { loadAndNormalize } from '../../../services/settings/settingsService';
import { settingsClientRpc } from '../../../drivers/shared/clients/settingsClientRpc';
import { browser } from '../../../drivers/shared/browser';
import {
    bookmarkIcon,
    coffeeIcon,
    settingsIcon,
    xIcon,
} from '../../../assets/icons';
import { getBookmarksPanelCss } from './ui/styles/bookmarksPanelCss';
import type { BookmarksPanelController, BookmarksPanelSnapshot } from './BookmarksPanelController';
import { BookmarksTabView } from './ui/tabs/BookmarksTabView';
import { createBookmarksTabActions } from './ui/tabs/bookmarksTabActions';
import { SettingsTabView, type SettingsTabViewActions } from './ui/tabs/SettingsTabView';
import { SponsorTabView } from './ui/tabs/SponsorTabView';
import { createBookmarksPanelShell } from './ui/BookmarksPanelShell';
import { OverlaySession } from '../overlay/OverlaySession';
import type { ReaderPanel } from '../reader/ReaderPanel';
import { TooltipDelegate } from '../../../utils/tooltip';
import { subscribeLocaleChange, t } from '../components/i18n';
import { logger } from '../../../core/logger';
import { eventWithinTransientRoot } from '../components/transientUi';
import { beginSurfaceMotionClose, setSurfaceMotionOpening } from '../components/motionLifecycle';
import { SurfaceFocusLifecycle } from '../components/surfaceFocusLifecycle';

type PanelTabId = 'bookmarks' | 'settings' | 'sponsor';

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
        sponsor: 0,
    };

    private visible = false;
    private overlaySession: OverlaySession | null = null;
    private tooltipDelegate: TooltipDelegate | null = null;
    private snapshot: BookmarksPanelSnapshot | null = null;
    private bookmarksView: BookmarksPanelTabView | null = null;
    private settingsView: BookmarksPanelTabView | null = null;
    private sponsorView: BookmarksPanelTabView | null = null;
    private unsubscribeSnapshot: (() => void) | null = null;
    private unsubscribeLocale: (() => void) | null = null;
    private closing = false;
    private motionNeedsOpen = false;
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
            this.sponsorView?.destroy?.();
            this.sponsorView = null;
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
        this.sponsorView?.destroy?.();
        this.sponsorView = null;
        this.focusLifecycle.restore(document);
        this.overlaySession?.unmount();
        this.overlaySession = null;
        this.closing = false;
        this.motionNeedsOpen = false;
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
            setChatGptSettings: async (patch) => {
                this.uiState.settings = {
                    ...this.uiState.settings,
                    chatgpt: {
                        ...this.uiState.settings.chatgpt,
                        ...patch,
                    },
                };
                await settingsClientRpc.setCategory('chatgpt', patch);
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
        const sponsorPanel = this.sponsorView?.getElement() ?? document.createElement('section');
        sponsorPanel.classList.add('sponsor-panel');

        const titleText = this.uiState.bookmarksTab === 'bookmarks'
            ? tr('tabBookmarks', 'Bookmarks')
            : this.uiState.bookmarksTab === 'settings'
                ? tr('tabSettings', 'Settings')
                : tr('tabSponsor', 'Sponsor');

        const shell = createBookmarksPanelShell({
            titleText,
            closeIcon: xIcon,
            closeLabel: tr('btnClose', 'Close panel'),
            defaultTabId: this.uiState.bookmarksTab,
            tabs: [
                { id: 'bookmarks', label: tr('tabBookmarks', 'Bookmarks'), icon: bookmarkIcon, content: bookmarksPanel, panelClassName: 'tab-panel--bookmarks' },
                { id: 'settings', label: tr('tabSettings', 'Settings'), icon: settingsIcon, content: settingsPanel, panelClassName: 'settings-panel' },
                { id: 'sponsor', label: tr('tabSponsor', 'Sponsor'), icon: coffeeIcon, content: sponsorPanel, panelClassName: 'sponsor-panel' },
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
            if (nextTab === 'bookmarks' || nextTab === 'settings' || nextTab === 'sponsor') {
                this.bookmarksView?.dismissTransientUi?.();
                this.settingsView?.dismissTransientUi?.();
                this.sponsorView?.dismissTransientUi?.();
                this.uiState.bookmarksTab = nextTab;
                this.render();
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
                if (this.sponsorView?.consumeEscape?.()) return;
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
        if (this.bookmarksView && this.settingsView && this.sponsorView) return;

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

        if (!this.sponsorView) {
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

    private async handleClick(event: Event): Promise<void> {
        const target = event.target as HTMLElement | null;
        if (target?.closest('.aimd-settings')) return;
        if (target?.closest('.bookmarks-tab-content')) return;
        if (this.uiState.bookmarksTab === 'sponsor' && (target?.closest('.aimd-sponsor') || target?.closest('.sponsor-panel'))) {
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
        const sponsorPanel = this.hostHandle.surfaceRoot.querySelector<HTMLElement>('.sponsor-panel');

        if (typeof bookmarksPanel === 'number') this.panelScrollTops.bookmarks = bookmarksPanel;
        if (settingsPanel) this.panelScrollTops.settings = settingsPanel.scrollTop;
        if (sponsorPanel) this.panelScrollTops.sponsor = sponsorPanel.scrollTop;
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

        const sponsorPanel = this.hostHandle.surfaceRoot.querySelector<HTMLElement>('.sponsor-panel');
        if (sponsorPanel) sponsorPanel.scrollTop = this.panelScrollTops.sponsor;
    }

    private emitSponsorBurst(event: MouseEvent): void {
        if (!this.hostHandle) return;

        const panel = this.hostHandle.surfaceRoot.querySelector<HTMLElement>('.sponsor-panel');
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
