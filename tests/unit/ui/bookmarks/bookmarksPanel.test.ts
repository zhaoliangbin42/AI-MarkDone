import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

vi.mock('@/drivers/shared/clients/settingsClientRpc', () => ({
    settingsClientRpc: {
        getAll: vi.fn(async () => ({
            ok: true,
            data: {
                settings: {
                    platforms: { chatgpt: true },
                    behavior: {
                        showSaveMessages: true,
                        showWordCount: true,
                        enableClickToCopy: true,
                        saveContextOnly: true,
                        _contextOnlyConfirmed: true,
                    },
                    reader: { renderCodeInReader: true },
                    language: 'auto',
                },
            },
        })),
        setCategory: vi.fn(async () => ({ ok: true, data: { category: 'platforms' } })),
    },
}));

vi.mock('@/drivers/shared/clients/bookmarksClient', () => ({
    bookmarksClient: {
        getChangelogNotice: vi.fn(async () => ({
            ok: true,
            data: {
                pendingVersion: null,
                lastShownVersion: null,
                reason: null,
                previousVersion: null,
            },
        })),
        ackChangelogNotice: vi.fn(async () => ({
                ok: true,
                data: {
                    pendingVersion: null,
                    lastShownVersion: '4.1.2',
                    reason: null,
                    previousVersion: '4.1.0',
                },
        })),
    },
}));

import { BookmarksPanel } from '@/ui/content/bookmarks/BookmarksPanel';
import { ReaderPanel } from '@/ui/content/reader/ReaderPanel';
import { bookmarkSaveDialog } from '@/ui/content/bookmarks/save/bookmarkSaveDialogSingleton';
import { getBookmarksPanelCss } from '@/ui/content/bookmarks/ui/styles/bookmarksPanelCss';
import { setLocale } from '@/ui/content/components/i18n';
import { bookmarksClient } from '@/drivers/shared/clients/bookmarksClient';
import { settingsClientRpc } from '@/drivers/shared/clients/settingsClientRpc';
import { browser } from '@/drivers/shared/browser';
import { markTransientRoot } from '@/ui/content/components/transientUi';
import { createAppearanceSnapshot } from '@/style/appearance';

function readLocaleJson(locale: 'en' | 'zh_CN'): any {
    const filePath = path.resolve(process.cwd(), `public/_locales/${locale}/messages.json`);
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

async function flushUi(): Promise<void> {
    await Promise.resolve();
    await Promise.resolve();
}

async function flushAnimationFrame(): Promise<void> {
    await new Promise<void>((resolve) => {
        window.requestAnimationFrame(() => {
            window.requestAnimationFrame(() => resolve());
        });
    });
}

describe('BookmarksPanel', () => {
    beforeEach(() => {
        document.body.innerHTML = '';
        document.documentElement.innerHTML = '';
        vi.stubGlobal(
            'fetch',
            vi.fn(async (url: any) => {
                const target = String(url);
                if (target.includes('_locales/zh_CN/messages.json')) {
                    return { ok: true, json: async () => readLocaleJson('zh_CN') } as any;
                }
                if (target.includes('_locales/en/messages.json')) {
                    return { ok: true, json: async () => readLocaleJson('en') } as any;
                }
                return { ok: false, json: async () => ({}) } as any;
            }),
        );
    });

    afterEach(async () => {
        document.body.innerHTML = '';
        await setLocale('en');
        vi.unstubAllGlobals();
    });

    it('keeps panel transient-ui dismissal generic instead of hard-coding child primitive selectors', () => {
        const source = fs.readFileSync(path.join(process.cwd(), 'src/ui/content/bookmarks/BookmarksPanel.ts'), 'utf8');

        expect(source).toContain('eventWithinTransientRoot(event)');
        expect(source).not.toContain("target.closest('.platform-dropdown')");
        expect(source).not.toContain("target.closest('.settings-select-shell')");
    });

    it('routes Google Drive restore through preview, explicit confirmation, and safe-merge apply', () => {
        const source = fs.readFileSync(path.join(process.cwd(), 'src/ui/content/bookmarks/workflows/BookmarksCloudBackupWorkflow.ts'), 'utf8');

        expect(source).toContain("this.client.previewRestore({ provider, snapshotId: selected.snapshotId, strategy: 'safeMerge' })");
        expect(source).toContain('buildImportMergeReviewModalBody');
        expect(source).toContain('cloudBackupRestorePreviewKind');
        expect(source).toContain('cloudBackupApplyRestore');
        expect(source).toContain("this.client.applyRestore({ provider, snapshotId: selected.snapshotId, strategy: 'safeMerge', payloadHash: preview.data.snapshot.payloadHash })");
    });

    it('keeps Google Drive settings on runtime status without exposing raw identity errors', () => {
        const source = fs.readFileSync(path.join(process.cwd(), 'src/ui/content/bookmarks/workflows/BookmarksCloudBackupWorkflow.ts'), 'utf8');

        expect(source).toContain("this.client.status('googleDrive')");
        expect(source).not.toContain('cloudBackupDiagnosticsButton');
        expect(source).not.toContain('AIMD_GOOGLE_CLIENT_ID');
    });

    it('uses a custom Google Drive restore chooser so long backup names do not force horizontal scrolling', () => {
        const source = fs.readFileSync(path.join(process.cwd(), 'src/ui/content/bookmarks/workflows/BookmarksCloudBackupWorkflow.ts'), 'utf8');
        const css = getBookmarksPanelCss();

        expect(source).not.toContain("document.createElement('select')");
        expect(source).not.toContain('cloud-backup-snapshot-select');
        expect(source).toContain('cloud-backup-snapshot-list');
        expect(source).toContain('cloud-backup-snapshot-option');
        expect(source).toContain('cloud-backup-snapshot-name');
        expect(source).toContain('name.title = snapshot.name');
        expect(css).toContain('.cloud-backup-snapshot-name');
        expect(css).toContain('text-overflow: ellipsis;');
        expect(css).toContain('overflow: hidden;');
    });

    it('shows immediate Google Drive operation feedback instead of waiting silently for network work', () => {
        const source = fs.readFileSync(path.join(process.cwd(), 'src/ui/content/bookmarks/workflows/BookmarksCloudBackupWorkflow.ts'), 'utf8');

        expect(source).toContain('showCloudBackupProgress');
        expect(source).toContain('cloudBackupProgressConfirmingAccess');
        expect(source).toContain('cloudBackupProgressPreparingBookmarks');
        expect(source).toContain('cloudBackupProgressUploadingDrive');
        expect(source).toContain('cloudBackupProgressReadingList');
        expect(source).toContain('cloudBackupProgressApplyingMerge');
    });

    it('shows the same timeout budget countdown that the Google Drive RPC layer enforces', () => {
        const source = fs.readFileSync(path.join(process.cwd(), 'src/ui/content/bookmarks/workflows/BookmarksCloudBackupWorkflow.ts'), 'utf8');

        expect(source).toContain('CLOUD_BACKUP_RPC_TIMEOUT_MS');
        expect(source).toContain('formatProgressRemaining');
        expect(source).toContain('cloudBackupProgressTimeBudget');
        expect(source).toContain('window.setInterval');
        expect(source).toContain('timeoutBudgetMs: CLOUD_BACKUP_RPC_TIMEOUT_MS.backupNow');
        expect(source).toContain('timeoutBudgetMs: CLOUD_BACKUP_RPC_TIMEOUT_MS.previewRestore');
        expect(source).toContain('timeoutBudgetMs: CLOUD_BACKUP_RPC_TIMEOUT_MS.applyRestore');
    });

    it('keeps the Google Drive gear modal focused on connection, privacy, and backup management', () => {
        const source = fs.readFileSync(path.join(process.cwd(), 'src/ui/content/bookmarks/workflows/BookmarksCloudBackupWorkflow.ts'), 'utf8');
        const method = source.slice(source.indexOf('private async showGoogleDriveBackupSettings'), source.indexOf('\n    }\n}', source.indexOf('private async showGoogleDriveBackupSettings')));

        expect(method).toContain('cloudBackupTestConnection');
        expect(method).toContain('cloudBackupManageBackups');
        expect(method).toContain('cloudBackupConnectedAs');
        expect(method).toContain('cloudBackupPrivacyNote');
        expect(method).toContain("privacy.className = 'cloud-backup-settings-modal__privacy'");
        expect(method).toContain('showCloudBackupManager');
        expect(method).toContain('try {');
        expect(method).toContain('finally {');
        expect(method).not.toContain('cloudBackupDiagnosticsButton');
        expect(method).not.toContain('refreshDiagnostics');
        expect(method).not.toContain('cloudBackupLoginGoogleDrive');
        expect(method).not.toContain('cloudBackupLogoutGoogleDrive');
        expect(method).not.toContain('cloudBackupOpenGoogleDrive');
        expect(method).not.toContain('cloudBackupSwitchAccount');
        expect(method).not.toContain('cloudBackupSilentAuthNote');
        expect(method).not.toContain('https://drive.google.com/drive/my-drive');
    });

    it('confirms Google Drive authorization before starting OAuth', () => {
        const source = fs.readFileSync(path.join(process.cwd(), 'src/ui/content/bookmarks/workflows/BookmarksCloudBackupWorkflow.ts'), 'utf8');

        expect(source).toContain('cloudBackupConnectConfirmTitle');
        expect(source).toContain('cloudBackupConnectConfirmDesc');
        expect(source).toContain('cloudBackupConnectConfirmAction');
        expect(source).toContain('this.modalHost?.confirm');
        expect(source).toContain('if (!confirmed) return { connected: false };');
    });

    it('manages Google Drive backups through a trash-first remote list', () => {
        const source = fs.readFileSync(path.join(process.cwd(), 'src/ui/content/bookmarks/workflows/BookmarksCloudBackupWorkflow.ts'), 'utf8');
        const css = getBookmarksPanelCss();

        expect(source).toContain('showCloudBackupManager');
        expect(source).toContain("this.client.listSnapshots('googleDrive')");
        expect(source).toContain("this.client.deleteSnapshot({ provider: 'googleDrive'");
        expect(source).toContain('cloudBackupMoveToTrash');
        expect(source).toContain('cloudBackupMoveToTrashConfirmTitle');
        expect(source).toContain('cloud-backup-manager-list');
        expect(source).toContain("listRoot.dataset.state = 'loading'");
        expect(source).toContain("listRoot.dataset.state = 'empty'");
        expect(source).toContain("trash.className = 'secondary-btn secondary-btn--danger cloud-backup-manager-trash'");
        expect(source).toContain('fileName.title = snapshot.name');
        expect(css).toContain('.cloud-backup-settings-modal__privacy');
        expect(css).toContain('.cloud-backup-manager-name');
        expect(css).toContain('.cloud-backup-manager-list[data-state="empty"]');
        expect(css).toContain('.cloud-backup-manager-trash');
        expect(css).toContain('text-overflow: ellipsis;');
    });

    it('activates the new changelog, about, and faq panels inside the formal bookmarks panel shell', async () => {
        await setLocale('en');
        const snapshot = {
            vm: {
                query: '',
                platform: 'All',
                bookmarks: [],
                folderTree: [],
                selectedFolderPath: null,
                sortMode: 'time-desc',
            },
            folders: [],
            folderPaths: [],
            selectedKeys: new Set(),
            previewId: null,
            status: 'Ready',
            storageUsage: { usedBytes: 512, quotaBytes: 1024, usedPercentage: 50, warningLevel: 'none' },
        };

        const controller = {
            subscribe: vi.fn((fn: (snap: any) => void) => {
                fn(snapshot);
                return () => {};
            }),
            refreshAll: vi.fn(async () => undefined),
            refreshPositionsForUrl: vi.fn(async () => undefined),
            refreshUiState: vi.fn(async () => undefined),
            getTheme: vi.fn(() => 'light'),
            getAppearance: vi.fn(() => createAppearanceSnapshot('light')),
            getPlatforms: vi.fn(() => ['All', 'ChatGPT']),
            getFolderCheckboxState: vi.fn(() => ({ checked: false, indeterminate: false })),
            setQuery: vi.fn(),
            clearSelection: vi.fn(),
            setPlatform: vi.fn(),
            setSortMode: vi.fn(),
            toggleFolderExpanded: vi.fn(),
            toggleFolderSelection: vi.fn(),
            toggleBookmarkSelection: vi.fn(),
            selectFolder: vi.fn(),
            getBookmarkRowSubtitle: vi.fn(() => 'ChatGPT - today'),
            exportAll: vi.fn(async () => ({ ok: true, data: { payload: {} } })),
            setPanelStatus: vi.fn(),
        } as any;

        const panel = new BookmarksPanel(controller, { show: vi.fn(), hide: vi.fn() } as any);
        await panel.show();

        const host = document.getElementById('aimd-bookmarks-panel-host');
        expect(host).toBeTruthy();
        const shadow = host!.shadowRoot!;

        const panelWindow = shadow.querySelector<HTMLElement>('.panel-window.panel-window--bookmarks');
        const settingsTabButton = shadow.querySelector<HTMLElement>('[data-action="set-bookmarks-tab"][data-tab="settings"]');
        const featuresTabButton = shadow.querySelector<HTMLButtonElement>('[data-action="set-bookmarks-tab"][data-tab="features"]');
        const changelogTabButton = shadow.querySelector<HTMLElement>('[data-action="set-bookmarks-tab"][data-tab="changelog"]');
        const feedbackTabButton = shadow.querySelector<HTMLElement>('[data-action="set-bookmarks-tab"][data-tab="feedback"]');
        const aboutTabButton = shadow.querySelector<HTMLElement>('[data-action="set-bookmarks-tab"][data-tab="about"]');
        const mappamoryTabButton = shadow.querySelector<HTMLElement>('[data-action="set-bookmarks-tab"][data-tab="mappamory"]');
        const faqTabButton = shadow.querySelector<HTMLElement>('[data-action="set-bookmarks-tab"][data-tab="faq"]');
        const sponsorTabButton = shadow.querySelector<HTMLElement>('[data-action="set-bookmarks-tab"][data-tab="sponsor"]');
        const bookmarksPanel = shadow.querySelector<HTMLElement>('.tab-panel--bookmarks');
        const settingsPanel = shadow.querySelector<HTMLElement>('.settings-panel');
        const changelogPanel = shadow.querySelector<HTMLElement>('.changelog-panel');
        const aboutPanel = shadow.querySelector<HTMLElement>('.about-panel');
        const mappamoryPanel = shadow.querySelector<HTMLElement>('.mappamory-panel');
        const faqPanel = shadow.querySelector<HTMLElement>('.faq-panel');
        const sponsorPanel = shadow.querySelector<HTMLElement>('.sponsor-panel');
        const feedbackPanel = shadow.querySelector<HTMLElement>('.feedback-panel');

        expect(panelWindow).toBeTruthy();
        expect(settingsTabButton).toBeTruthy();
        expect(featuresTabButton).toBeTruthy();
        expect(changelogTabButton).toBeTruthy();
        expect(aboutTabButton).toBeTruthy();
        expect(mappamoryTabButton).toBeTruthy();
        expect(faqTabButton).toBeTruthy();
        expect(sponsorTabButton).toBeTruthy();
        expect(feedbackTabButton).toBeTruthy();
        const tabIds = Array.from(shadow.querySelectorAll<HTMLElement>('[data-action="set-bookmarks-tab"]')).map((node) => node.dataset.tab);
        expect(tabIds).toEqual(['bookmarks', 'settings', 'features', 'changelog', 'faq', 'about', 'feedback', 'mappamory', 'sponsor']);
        expect(sponsorTabButton?.textContent).toContain('Buy Me Coffee');
        expect(sponsorTabButton?.innerHTML).toContain('aimd-icon');
        expect(bookmarksPanel?.querySelector('.bookmarks-tab-content')).toBeTruthy();
        expect(bookmarksPanel?.querySelector('.toolbar-row--bookmarks')).toBeTruthy();
        expect(bookmarksPanel?.querySelector('.batch-bar')).toBeTruthy();
        expect(bookmarksPanel?.dataset.active).toBe('1');
        expect(settingsPanel?.dataset.active).toBe('0');
        expect(changelogPanel?.dataset.active).toBe('0');
        expect(aboutPanel?.dataset.active).toBe('0');
        expect(mappamoryPanel?.dataset.active).toBe('0');
        expect(faqPanel?.dataset.active).toBe('0');
        expect(sponsorPanel?.dataset.active).toBe('0');
        expect(feedbackPanel?.dataset.active).toBe('0');
        expect(panelWindow?.querySelector('.panel-footer')).toBeNull();
        expect(panelWindow?.querySelector('.workspace-corner-actions [data-action="close"]')).toBeTruthy();
        expect(shadow.querySelector('.platform-dropdown')).toBeNull();

        settingsTabButton!.click();
        const settingsSearch = shadow.querySelector<HTMLInputElement>('[data-role="settings-search"]')!;
        settingsSearch.value = 'formula';
        settingsSearch.dispatchEvent(new Event('input', { bubbles: true }));
        const settingsScroll = shadow.querySelector<HTMLElement>('.settings-panel-scroll')!;
        const navigationScroll = shadow.querySelector<HTMLElement>('.settings-navigation-scroll')!;
        settingsScroll.scrollTop = 146;
        navigationScroll.scrollTop = 83;
        const fullscreenButton = shadow.querySelector<HTMLButtonElement>('[data-action="workspace-fullscreen"]')!;
        fullscreenButton.click();
        expect(panelWindow?.dataset.fullscreen).toBe('1');
        expect(fullscreenButton.getAttribute('aria-label')).toBe('Exit fullscreen');
        expect(shadow.querySelector<HTMLInputElement>('[data-role="settings-search"]')).toBe(settingsSearch);
        expect(settingsSearch.value).toBe('formula');
        expect(settingsScroll.scrollTop).toBe(146);
        expect(navigationScroll.scrollTop).toBe(83);
        featuresTabButton!.click();
        expect(shadow.querySelector('.features-panel')?.getAttribute('data-active')).toBe('1');
        expect(shadow.querySelector('.features-panel .aimd-feature-overview')).toBeTruthy();
        expect(panelWindow?.dataset.fullscreen).toBe('1');
        settingsTabButton!.click();
        expect(settingsSearch.value).toBe('formula');
        expect(settingsScroll.scrollTop).toBe(146);
        fullscreenButton.click();
        expect(panelWindow?.dataset.fullscreen).toBe('0');
        expect(shadow.querySelector<HTMLInputElement>('[data-role="settings-search"]')).toBe(settingsSearch);
        settingsSearch.value = '';
        settingsSearch.dispatchEvent(new Event('input', { bubbles: true }));

        featuresTabButton!.click();
        shadow.querySelector<HTMLButtonElement>('[data-action="feature-open-settings"][data-category="reading"]')!.click();
        expect(shadow.querySelector<HTMLElement>('.settings-panel')?.dataset.active).toBe('1');
        expect(shadow.querySelector('[data-category="reading"][aria-pressed="true"]')).toBeTruthy();
        settingsTabButton!.click();

        const refreshedSettingsPanel = shadow.querySelector<HTMLElement>('.settings-panel');
        const refreshedBookmarksPanel = shadow.querySelector<HTMLElement>('.tab-panel--bookmarks');
        const refreshedChangelogPanel = shadow.querySelector<HTMLElement>('.changelog-panel');
        const refreshedAboutPanel = shadow.querySelector<HTMLElement>('.about-panel');
        const refreshedMappamoryPanel = shadow.querySelector<HTMLElement>('.mappamory-panel');
        const refreshedFaqPanel = shadow.querySelector<HTMLElement>('.faq-panel');
        const refreshedSponsorPanel = shadow.querySelector<HTMLElement>('.sponsor-panel');
        const refreshedFeedbackPanel = shadow.querySelector<HTMLElement>('.feedback-panel');

        expect(refreshedSettingsPanel?.dataset.active).toBe('1');
        expect(refreshedBookmarksPanel?.dataset.active).toBe('0');
        expect(refreshedChangelogPanel?.dataset.active).toBe('0');
        expect(refreshedAboutPanel?.dataset.active).toBe('0');
        expect(refreshedMappamoryPanel?.dataset.active).toBe('0');
        expect(refreshedFaqPanel?.dataset.active).toBe('0');
        expect(refreshedSponsorPanel?.dataset.active).toBe('0');
        expect(refreshedFeedbackPanel?.dataset.active).toBe('0');
        expect(shadow.querySelector('.aimd-panel-title')?.textContent).toBe('Settings');
        expect(refreshedSettingsPanel?.querySelector('.aimd-settings')).toBeTruthy();
        expect(refreshedSettingsPanel?.querySelector('.settings-card')).toBeTruthy();
        expect(refreshedSettingsPanel?.querySelector('.storage-fill')).toBeTruthy();
        expect(refreshedSettingsPanel?.textContent).toContain('50%');
        expect(refreshedSettingsPanel?.querySelectorAll('.settings-select-trigger').length).toBeGreaterThanOrEqual(1);
        expect(refreshedSettingsPanel?.querySelector('.settings-select')).toBeNull();
        expect(refreshedSettingsPanel?.querySelector('[data-role="settings-folding-count"]')).toBeNull();
        expect(refreshedSettingsPanel?.querySelector('[data-role="settings-chatgpt-conversation-directory"]')).toBeNull();
        const platformLabels = Array.from(refreshedSettingsPanel?.querySelectorAll<HTMLElement>('.settings-catalog-section[data-category="advanced"] .settings-label strong') ?? []);
        const platformIconHtml = platformLabels.map((node) => node.innerHTML).join('\n');
        expect(platformIconHtml).toContain('ChatGPT');
        expect(platformIconHtml).not.toContain('Gemini');
        expect(platformIconHtml).not.toContain('Claude');
        expect(platformIconHtml).not.toContain('DeepSeek');
        expect(refreshedSettingsPanel?.querySelectorAll('.settings-catalog-section[data-category="advanced"] .settings-label__icon').length).toBe(1);
        expect(shadow.querySelector('.platform-dropdown')).toBeNull();

        changelogTabButton!.click();

        const refreshedChangelogTab = shadow.querySelector<HTMLElement>('.changelog-panel');
        const refreshedBookmarksTab = shadow.querySelector<HTMLElement>('.tab-panel--bookmarks');
        const refreshedSettingsTab = shadow.querySelector<HTMLElement>('.settings-panel');
        const refreshedAboutTab = shadow.querySelector<HTMLElement>('.about-panel');
        const refreshedFaqTab = shadow.querySelector<HTMLElement>('.faq-panel');
        const refreshedSponsorTab = shadow.querySelector<HTMLElement>('.sponsor-panel');
        const refreshedFeedbackTab = shadow.querySelector<HTMLElement>('.feedback-panel');

        expect(refreshedChangelogTab?.dataset.active).toBe('1');
        expect(refreshedBookmarksTab?.dataset.active).toBe('0');
        expect(refreshedSettingsTab?.dataset.active).toBe('0');
        expect(refreshedAboutTab?.dataset.active).toBe('0');
        expect(refreshedFaqTab?.dataset.active).toBe('0');
        expect(refreshedSponsorTab?.dataset.active).toBe('0');
        expect(refreshedFeedbackTab?.dataset.active).toBe('0');
        expect(shadow.querySelector('.aimd-panel-title')?.textContent).toBe('Changelog');
        expect(refreshedChangelogTab?.querySelector('.aimd-changelog')).toBeTruthy();
        expect(refreshedChangelogTab?.querySelector('.info-section')).toBeTruthy();
        expect(refreshedChangelogTab?.querySelector('.info-disclosure')).toBeTruthy();
        expect(refreshedChangelogTab?.textContent).toContain('4.1.0');
        expect(refreshedChangelogTab?.textContent).toContain('2026-04-19');

        aboutTabButton!.click();

        const refreshedAboutActiveTab = shadow.querySelector<HTMLElement>('.about-panel');
        expect(refreshedAboutActiveTab?.dataset.active).toBe('1');
        expect(shadow.querySelector('.aimd-panel-title')?.textContent).toBe('About the author');
        expect(refreshedAboutActiveTab?.querySelector('.aimd-about')).toBeTruthy();
        expect(refreshedAboutActiveTab?.querySelectorAll('.info-section').length).toBe(1);
        expect(refreshedAboutActiveTab?.querySelector('.about-website-card')).toBeNull();
        expect(refreshedAboutActiveTab?.querySelector('.support-contact-card')).toBeNull();
        expect(refreshedAboutActiveTab?.querySelector('.mappamory-promo-card')).toBeNull();
        expect(refreshedAboutActiveTab?.querySelector('.sponsor-card')).toBeNull();
        expect(refreshedAboutActiveTab?.querySelectorAll('.sponsor-qr-card').length).toBe(0);
        expect(refreshedAboutActiveTab?.querySelector('.social-follow-card')).toBeTruthy();
        expect(refreshedAboutActiveTab?.querySelector('.sponsor-brand-mark')).toBeNull();
        expect(refreshedAboutActiveTab?.querySelector('.info-hero__body')?.textContent).toContain('personal project');
        expect(refreshedAboutActiveTab?.querySelector('.info-hero__title')?.textContent).toBe('Built from real workflow friction');
        expect(refreshedAboutActiveTab?.querySelector('.info-profile-card')).toBeTruthy();
        expect(refreshedAboutActiveTab?.querySelector('.info-profile')).toBeTruthy();
        expect(refreshedAboutActiveTab?.querySelector('.info-profile__avatar')).toBeTruthy();
        expect(refreshedAboutActiveTab?.querySelector('.info-profile__name')?.textContent).toBe('Benko Zhao');
        expect(refreshedAboutActiveTab?.querySelector('.info-profile__role')?.textContent).toBe('Creator of AI-MarkDone');
        expect(refreshedAboutActiveTab?.querySelector('.info-profile__bio')?.textContent).toContain('graduate student');
        expect(refreshedAboutActiveTab?.querySelectorAll('.info-story-point')).toHaveLength(3);
        expect(refreshedAboutActiveTab?.querySelector('.info-story-point')?.getAttribute('data-story-index')).toBe('01');
        expect(refreshedAboutActiveTab?.querySelector('[data-action="contact-email"]')).toBeNull();
        const sponsorCta = refreshedAboutActiveTab?.querySelector<HTMLAnchorElement>('[data-action="sponsor-github"]');
        expect(sponsorCta).toBeNull();
        expect(refreshedAboutActiveTab?.textContent).not.toContain('Support Development');
        expect(refreshedAboutActiveTab?.textContent).not.toContain('AI-MarkDone is open source. Star us on GitHub.');
        expect(refreshedAboutActiveTab?.textContent).not.toContain('If this project helps you');
        expect(refreshedAboutActiveTab?.textContent).not.toContain('Support the project with a coffee if you want to.');
        expect(refreshedAboutActiveTab?.textContent).not.toContain('Feedback and contact');
        expect(refreshedAboutActiveTab?.textContent).not.toContain('zhaoliangbin42@gmail.com');
        expect(refreshedAboutActiveTab?.textContent).toContain('Why I built AI-MarkDone');
        expect(refreshedAboutActiveTab?.textContent).toContain('copy the whole block first');
        expect(refreshedAboutActiveTab?.textContent).toContain('Xiaohongshu');
        expect(refreshedAboutActiveTab?.textContent).toContain('Feel free to follow me');
        expect(refreshedAboutActiveTab?.textContent).toContain('Find me on Xiaohongshu');
        expect(refreshedAboutActiveTab?.textContent).not.toContain('Mappamory');

        mappamoryTabButton!.click();

        const refreshedMappamoryActiveTab = shadow.querySelector<HTMLElement>('.mappamory-panel');
        const mappamoryLinks = Array.from(
            refreshedMappamoryActiveTab?.querySelectorAll<HTMLAnchorElement>('.mappamory-cta') ?? [],
        );
        const mappamoryPoster = refreshedMappamoryActiveTab?.querySelector<HTMLImageElement>('.mappamory-poster__image');
        const mappamoryProof = refreshedMappamoryActiveTab?.querySelector<HTMLImageElement>('.mappamory-proof__image');
        expect(refreshedMappamoryActiveTab?.dataset.active).toBe('1');
        expect(shadow.querySelector('.aimd-panel-title')?.textContent).toBe('Mappamory');
        expect(refreshedMappamoryActiveTab?.querySelector('.aimd-mappamory')).toBeTruthy();
        expect(refreshedMappamoryActiveTab?.querySelector('.info-hero__title')?.textContent).toBe(
            'People, places, and the records that connect them',
        );
        expect(refreshedMappamoryActiveTab?.querySelectorAll('.mappamory-feature')).toHaveLength(3);
        expect(refreshedMappamoryActiveTab?.textContent).toContain('Save places. Never track people.');
        expect(mappamoryPoster?.src).toContain('icons/mappamory-promo-poster.png');
        expect(mappamoryProof?.src).toContain('icons/mappamory-record-map-context.png');
        expect(mappamoryLinks.map((link) => link.href)).toEqual([
            'https://apps.apple.com/cn/app/mappamory/id6769453796?l=en-GB',
            'https://mappamory.com/',
        ]);
        for (const link of mappamoryLinks) {
            expect(link.target).toBe('_blank');
            expect(link.rel).toContain('noopener');
            expect(link.rel).toContain('noreferrer');
        }

        shadow.querySelector<HTMLElement>('[data-action="set-bookmarks-tab"][data-tab="sponsor"]')!.click();

        const refreshedSponsorActiveTab = shadow.querySelector<HTMLElement>('.sponsor-panel');
        const sponsorCtaActive = refreshedSponsorActiveTab?.querySelector<HTMLAnchorElement>('[data-action="sponsor-github"]');
        expect(refreshedSponsorActiveTab?.dataset.active).toBe('1');
        expect(shadow.querySelector('.aimd-panel-title')?.textContent).toBe('Buy Me Coffee');
        expect(refreshedSponsorActiveTab?.querySelector('.aimd-sponsor')).toBeTruthy();
        expect(refreshedSponsorActiveTab?.querySelectorAll('.sponsor-qr-card').length).toBe(2);
        expect(sponsorCtaActive?.tagName).toBe('A');
        expect(sponsorCtaActive?.href).toBe('https://github.com/zhaoliangbin42/AI-MarkDone');
        expect(sponsorCtaActive?.target).toBe('_blank');
        expect(sponsorCtaActive?.rel).toContain('noopener');
        expect(sponsorCtaActive?.rel).toContain('noreferrer');
        expect(refreshedSponsorActiveTab?.textContent).toContain('Support Development');
        expect(refreshedSponsorActiveTab?.textContent).toContain('AI-MarkDone is open source. Star us on GitHub.');
        expect(refreshedSponsorActiveTab?.textContent).toContain('If this project helps you');
        expect(refreshedSponsorActiveTab?.textContent).toContain('Support the project with a coffee if you want to.');
        expect(refreshedSponsorActiveTab?.textContent).toContain('Thanks to Sponsors');
        expect(refreshedSponsorActiveTab?.textContent).toContain('@匿名（Danke!）');
        expect(refreshedSponsorActiveTab?.textContent).toContain('@。（特别喜欢那个目录条功能，请你喝瓶水）');

        feedbackTabButton!.click();

        const refreshedFeedbackActiveTab = shadow.querySelector<HTMLElement>('.feedback-panel');
        const feedbackWebsiteCta = refreshedFeedbackActiveTab?.querySelector<HTMLAnchorElement>('.about-website-card__button');
        const feedbackEmailCta = refreshedFeedbackActiveTab?.querySelector<HTMLAnchorElement>('.support-contact-card__button--email');
        const feedbackCommunityCards = refreshedFeedbackActiveTab?.querySelectorAll<HTMLElement>('.community-group-card');
        const feedbackCommunityImages = Array.from(
            refreshedFeedbackActiveTab?.querySelectorAll<HTMLImageElement>('.community-group-card__image') ?? [],
        );
        expect(refreshedFeedbackActiveTab?.dataset.active).toBe('1');
        expect(shadow.querySelector('.aimd-panel-title')?.textContent).toBe('Feedback');
        expect(refreshedFeedbackActiveTab?.querySelector('.aimd-feedback')).toBeTruthy();
        expect(refreshedFeedbackActiveTab?.querySelector('.info-hero__title')?.textContent).toBe('Help shape AI-MarkDone');
        expect(refreshedFeedbackActiveTab?.querySelector('.community-card')).toBeTruthy();
        expect(feedbackCommunityCards).toHaveLength(2);
        expect(feedbackCommunityImages[0]?.src).toContain('icons/qq-group-invite.png');
        expect(feedbackCommunityImages[0]?.alt).toContain('962705835');
        expect(feedbackCommunityImages[1]?.src).toContain('icons/xiaohongshu-group-invite.png');
        expect(refreshedFeedbackActiveTab?.textContent).toContain('Group 962705835');
        expect(refreshedFeedbackActiveTab?.textContent).toContain('August 14, 2026');
        expect(refreshedFeedbackActiveTab?.textContent).toContain('follow my Xiaohongshu account');
        expect(refreshedFeedbackActiveTab?.textContent).not.toContain('Email remains available for private feedback');
        expect(refreshedFeedbackActiveTab?.querySelector('.support-contact-card')).toBeTruthy();
        expect(refreshedFeedbackActiveTab?.querySelector('.about-website-card')).toBeTruthy();
        expect(feedbackEmailCta?.href).toBe('mailto:zhaoliangbin42@gmail.com?subject=AI-MarkDone%20Safari%20Feedback');
        expect(feedbackWebsiteCta?.href).toBe('https://zhaoliangbin42.github.io/ai-markdone/en/');
        expect(feedbackWebsiteCta?.target).toBe('_blank');
        expect(feedbackWebsiteCta?.rel).toContain('noopener');
        expect(feedbackWebsiteCta?.rel).toContain('noreferrer');
        expect(refreshedFeedbackActiveTab?.textContent).toContain('AI-MarkDone website');
        expect(refreshedFeedbackActiveTab?.textContent).toContain('Copy Email');

        faqTabButton!.click();

        const refreshedFaqActiveTab = shadow.querySelector<HTMLElement>('.faq-panel');
        expect(refreshedFaqActiveTab?.dataset.active).toBe('1');
        expect(shadow.querySelector('.aimd-panel-title')?.textContent).toBe('FAQ');
        expect(refreshedFaqActiveTab?.querySelector('.aimd-faq')).toBeTruthy();
        expect(refreshedFaqActiveTab?.querySelector('.info-disclosure')).toBeTruthy();
        expect(refreshedFaqActiveTab?.textContent).toContain('Which platforms does this extension support?');
        expect(refreshedFaqActiveTab?.textContent).toContain('How do I copy a formula?');
        expect(refreshedFaqActiveTab?.textContent).toContain('Click it in the original reply');

        fullscreenButton.click();
        expect(panelWindow?.dataset.fullscreen).toBe('1');
        shadow.querySelector<HTMLButtonElement>('.workspace-corner-actions [data-action="close"]')!.click();
        expect(panel.isVisible()).toBe(false);
        panelWindow!.dispatchEvent(new Event('animationend', { bubbles: true }));
        await panel.show();
        expect(document.getElementById('aimd-bookmarks-panel-host')!.shadowRoot!.querySelector<HTMLElement>('.panel-window')!.dataset.fullscreen).toBe('0');
        panel.hide();
    });

    it('shows the latest settings-changelog modal once when a pending version notice exists', async () => {
        await setLocale('en');
        vi.mocked(bookmarksClient.getChangelogNotice).mockResolvedValueOnce({
            ok: true,
            data: {
                pendingVersion: '6.1.0',
                lastShownVersion: null,
                reason: 'update',
                previousVersion: '6.0.0',
            },
        } as any);

        const controller = {
            subscribe: vi.fn((fn: (snap: any) => void) => {
                fn({
                    vm: {
                        query: '',
                        platform: 'All',
                        bookmarks: [],
                        folderTree: [],
                        selectedFolderPath: null,
                        sortMode: 'time-desc',
                    },
                    folders: [],
                    folderPaths: [],
                    selectedKeys: new Set(),
                    previewId: null,
                    status: 'Ready',
                    storageUsage: { usedBytes: 512, quotaBytes: 1024, usedPercentage: 50, warningLevel: 'none' },
                });
                return () => {};
            }),
            refreshAll: vi.fn(async () => undefined),
            refreshPositionsForUrl: vi.fn(async () => undefined),
            refreshUiState: vi.fn(async () => undefined),
            getTheme: vi.fn(() => 'light'),
            getAppearance: vi.fn(() => createAppearanceSnapshot('light')),
            getPlatforms: vi.fn(() => ['All', 'ChatGPT']),
            getFolderCheckboxState: vi.fn(() => ({ checked: false, indeterminate: false })),
            setQuery: vi.fn(),
            clearSelection: vi.fn(),
            setPlatform: vi.fn(),
            setSortMode: vi.fn(),
            toggleFolderExpanded: vi.fn(),
            toggleFolderSelection: vi.fn(),
            toggleBookmarkSelection: vi.fn(),
            selectFolder: vi.fn(),
            getBookmarkRowSubtitle: vi.fn(() => 'ChatGPT - today'),
            exportAll: vi.fn(async () => ({ ok: true, data: { payload: {} } })),
            setPanelStatus: vi.fn(),
        } as any;

        const panel = new BookmarksPanel(controller, { show: vi.fn(), hide: vi.fn() } as any);
        await panel.show();
        await flushUi();

        const host = document.getElementById('aimd-bookmarks-panel-host')!;
        const shadow = host.shadowRoot!;
        const modal = shadow.querySelector<HTMLElement>('.mock-modal');

        expect(modal?.querySelector('.mock-modal__title-copy strong')?.textContent).toBe("What's new in AI-MarkDone 6.1.0");
        expect(modal?.textContent).toContain('Feature overview');

        const okButton = Array.from(modal?.querySelectorAll<HTMLButtonElement>('.mock-modal__button') ?? []).find((button) => button.textContent === 'OK');
        okButton?.click();
        await flushUi();

        expect(bookmarksClient.ackChangelogNotice).toHaveBeenCalledWith('6.1.0');
    });

    it('acks the notice and routes to the changelog tab from the modal secondary action', async () => {
        await setLocale('en');
        vi.mocked(bookmarksClient.getChangelogNotice).mockResolvedValueOnce({
            ok: true,
            data: {
                pendingVersion: '6.1.0',
                lastShownVersion: null,
                reason: 'update',
                previousVersion: '6.0.0',
            },
        } as any);

        const controller = {
            subscribe: vi.fn((fn: (snap: any) => void) => {
                fn({
                    vm: {
                        query: '',
                        platform: 'All',
                        bookmarks: [],
                        folderTree: [],
                        selectedFolderPath: null,
                        sortMode: 'time-desc',
                    },
                    folders: [],
                    folderPaths: [],
                    selectedKeys: new Set(),
                    previewId: null,
                    status: 'Ready',
                    storageUsage: { usedBytes: 512, quotaBytes: 1024, usedPercentage: 50, warningLevel: 'none' },
                });
                return () => {};
            }),
            refreshAll: vi.fn(async () => undefined),
            refreshPositionsForUrl: vi.fn(async () => undefined),
            refreshUiState: vi.fn(async () => undefined),
            getTheme: vi.fn(() => 'light'),
            getAppearance: vi.fn(() => createAppearanceSnapshot('light')),
            getPlatforms: vi.fn(() => ['All', 'ChatGPT']),
            getFolderCheckboxState: vi.fn(() => ({ checked: false, indeterminate: false })),
            setQuery: vi.fn(),
            clearSelection: vi.fn(),
            setPlatform: vi.fn(),
            setSortMode: vi.fn(),
            toggleFolderExpanded: vi.fn(),
            toggleFolderSelection: vi.fn(),
            toggleBookmarkSelection: vi.fn(),
            selectFolder: vi.fn(),
            getBookmarkRowSubtitle: vi.fn(() => 'ChatGPT - today'),
            exportAll: vi.fn(async () => ({ ok: true, data: { payload: {} } })),
            setPanelStatus: vi.fn(),
        } as any;

        const panel = new BookmarksPanel(controller, { show: vi.fn(), hide: vi.fn() } as any);
        await panel.show();
        await flushUi();

        const host = document.getElementById('aimd-bookmarks-panel-host')!;
        const shadow = host.shadowRoot!;
        const modal = shadow.querySelector<HTMLElement>('.mock-modal')!;
        const viewAllButton = Array.from(modal.querySelectorAll<HTMLButtonElement>('.mock-modal__button')).find((button) => button.textContent === 'View full changelog');

        viewAllButton?.click();
        await flushUi();

        expect(bookmarksClient.ackChangelogNotice).toHaveBeenCalledWith('6.1.0');
        expect(shadow.querySelector<HTMLElement>('.changelog-panel')?.dataset.active).toBe('1');
        expect(shadow.querySelector('.aimd-panel-title')?.textContent).toBe('Changelog');
    });

    it('does not show the bookmarks changelog modal after reader acknowledges the same pending notice', async () => {
        await setLocale('en');
        vi.mocked(bookmarksClient.getChangelogNotice)
            .mockResolvedValueOnce({
                ok: true,
                data: {
                pendingVersion: '6.1.0',
                    lastShownVersion: null,
                    reason: 'update',
                    previousVersion: '6.0.0',
                },
            } as any)
            .mockResolvedValueOnce({
                ok: true,
                data: {
                    pendingVersion: null,
                    lastShownVersion: '6.1.0',
                    reason: null,
                    previousVersion: '4.4.6',
                },
            } as any);

        const readerPanel = new ReaderPanel();
        try {
            await readerPanel.show([{ id: 'a', userPrompt: 'Prompt', content: 'md1' }], 0, 'light', {
                profile: 'conversation-reader',
            });
            await flushUi();

            const readerHost = document.getElementById('aimd-reader-panel-host')!;
            const readerModal = readerHost.shadowRoot!.querySelector<HTMLElement>('.mock-modal')!;
            readerModal.querySelector<HTMLButtonElement>('.mock-modal__button')?.click();
            await flushUi();
        } finally {
            readerPanel.hide();
        }

        const controller = {
            subscribe: vi.fn((fn: (snap: any) => void) => {
                fn({
                    vm: {
                        query: '',
                        platform: 'All',
                        bookmarks: [],
                        folderTree: [],
                        selectedFolderPath: null,
                        sortMode: 'time-desc',
                    },
                    folders: [],
                    folderPaths: [],
                    selectedKeys: new Set(),
                    previewId: null,
                    status: 'Ready',
                    storageUsage: { usedBytes: 512, quotaBytes: 1024, usedPercentage: 50, warningLevel: 'none' },
                });
                return () => {};
            }),
            refreshAll: vi.fn(async () => undefined),
            refreshPositionsForUrl: vi.fn(async () => undefined),
            refreshUiState: vi.fn(async () => undefined),
            getTheme: vi.fn(() => 'light'),
            getAppearance: vi.fn(() => createAppearanceSnapshot('light')),
            getPlatforms: vi.fn(() => ['All', 'ChatGPT']),
            getFolderCheckboxState: vi.fn(() => ({ checked: false, indeterminate: false })),
            setQuery: vi.fn(),
            clearSelection: vi.fn(),
            setPlatform: vi.fn(),
            setSortMode: vi.fn(),
            toggleFolderExpanded: vi.fn(),
            toggleFolderSelection: vi.fn(),
            toggleBookmarkSelection: vi.fn(),
            selectFolder: vi.fn(),
            getBookmarkRowSubtitle: vi.fn(() => 'ChatGPT - today'),
            exportAll: vi.fn(async () => ({ ok: true, data: { payload: {} } })),
            setPanelStatus: vi.fn(),
        } as any;

        const panel = new BookmarksPanel(controller, { show: vi.fn(), hide: vi.fn() } as any);
        await panel.show();
        await flushUi();

        const host = document.getElementById('aimd-bookmarks-panel-host')!;
        expect(host.shadowRoot!.querySelector('.mock-modal')).toBeNull();
        expect(bookmarksClient.ackChangelogNotice).toHaveBeenCalledTimes(1);

        panel.hide();
    });

    it('still renders the bookmarks shell when initial async refresh work fails', async () => {
        await setLocale('en');
        const controller = {
            subscribe: vi.fn(() => () => {}),
            refreshAll: vi.fn(async () => {
                throw new Error('refresh failed');
            }),
            refreshPositionsForUrl: vi.fn(async () => undefined),
            refreshUiState: vi.fn(async () => undefined),
            getTheme: vi.fn(() => 'light'),
            getAppearance: vi.fn(() => createAppearanceSnapshot('light')),
            getPlatforms: vi.fn(() => ['All', 'ChatGPT']),
            getFolderCheckboxState: vi.fn(() => ({ checked: false, indeterminate: false })),
            setQuery: vi.fn(),
            clearSelection: vi.fn(),
            setPlatform: vi.fn(),
            setSortMode: vi.fn(),
            toggleFolderExpanded: vi.fn(),
            toggleFolderSelection: vi.fn(),
            toggleBookmarkSelection: vi.fn(),
            selectFolder: vi.fn(),
            getBookmarkRowSubtitle: vi.fn(() => 'ChatGPT - today'),
            exportAll: vi.fn(async () => ({ ok: true, data: { payload: {} } })),
            setPanelStatus: vi.fn(),
        } as any;

        const panel = new BookmarksPanel(controller, { show: vi.fn(), hide: vi.fn() } as any);

        await expect(panel.show()).resolves.toBeUndefined();

        const host = document.getElementById('aimd-bookmarks-panel-host');
        const shadow = host?.shadowRoot;
        const panelWindow = shadow?.querySelector<HTMLElement>('.panel-window.panel-window--bookmarks');

        expect(host).toBeTruthy();
        expect(panelWindow).toBeTruthy();
        expect(panelWindow?.querySelector('.bookmarks-shell')).toBeTruthy();
    });

    it('still renders the bookmarks shell when a tab view constructor dependency throws during setup', async () => {
        await setLocale('en');
        const getUrlSpy = vi.spyOn(browser.runtime, 'getURL').mockImplementation(() => {
            throw new Error('asset lookup failed');
        });
        const snapshot = {
            vm: {
                query: '',
                platform: 'All',
                bookmarks: [],
                folderTree: [],
                selectedFolderPath: null,
                sortMode: 'time-desc',
            },
            folders: [],
            folderPaths: [],
            selectedKeys: new Set(),
            previewId: null,
            status: 'Ready',
            storageUsage: null,
        };
        const controller = {
            subscribe: vi.fn((fn: (snap: any) => void) => {
                fn(snapshot);
                return () => {};
            }),
            refreshAll: vi.fn(async () => undefined),
            refreshPositionsForUrl: vi.fn(async () => undefined),
            refreshUiState: vi.fn(async () => undefined),
            getTheme: vi.fn(() => 'light'),
            getAppearance: vi.fn(() => createAppearanceSnapshot('light')),
            getPlatforms: vi.fn(() => ['All', 'ChatGPT']),
            getFolderCheckboxState: vi.fn(() => ({ checked: false, indeterminate: false })),
            setQuery: vi.fn(),
            clearSelection: vi.fn(),
            setPlatform: vi.fn(),
            setSortMode: vi.fn(),
            toggleFolderExpanded: vi.fn(),
            toggleFolderSelection: vi.fn(),
            toggleBookmarkSelection: vi.fn(),
            selectFolder: vi.fn(),
            getBookmarkRowSubtitle: vi.fn(() => 'ChatGPT - today'),
            exportAll: vi.fn(async () => ({ ok: true, data: { payload: {} } })),
            setPanelStatus: vi.fn(),
        } as any;

        const panel = new BookmarksPanel(controller, { show: vi.fn(), hide: vi.fn() } as any);

        await expect(panel.show()).resolves.toBeUndefined();

        const host = document.getElementById('aimd-bookmarks-panel-host');
        const shadow = host?.shadowRoot;
        const panelWindow = shadow?.querySelector<HTMLElement>('.panel-window.panel-window--bookmarks');

        expect(host).toBeTruthy();
        expect(panelWindow).toBeTruthy();
        expect(panelWindow?.querySelector('.bookmarks-shell')).toBeTruthy();

        getUrlSpy.mockRestore();
    });

    it('updates visible copy immediately when the locale changes', async () => {
        await setLocale('en');
        const snapshot = {
            vm: {
                query: '',
                platform: 'All',
                bookmarks: [],
                folderTree: [],
                selectedFolderPath: null,
                sortMode: 'time-desc',
            },
            folders: [],
            folderPaths: [],
            selectedKeys: new Set(),
            previewId: null,
            status: 'Ready',
            storageUsage: { usedBytes: 512, quotaBytes: 1024, usedPercentage: 50, warningLevel: 'none' },
        };

        const controller = {
            subscribe: vi.fn((fn: (snap: any) => void) => {
                fn(snapshot);
                return () => {};
            }),
            refreshAll: vi.fn(async () => undefined),
            refreshPositionsForUrl: vi.fn(async () => undefined),
            refreshUiState: vi.fn(async () => undefined),
            getTheme: vi.fn(() => 'light'),
            getAppearance: vi.fn(() => createAppearanceSnapshot('light')),
            getPlatforms: vi.fn(() => ['All', 'ChatGPT']),
            getFolderCheckboxState: vi.fn(() => ({ checked: false, indeterminate: false })),
            setQuery: vi.fn(),
            clearSelection: vi.fn(),
            setPlatform: vi.fn(),
            setSortMode: vi.fn(),
            toggleFolderExpanded: vi.fn(),
            toggleFolderSelection: vi.fn(),
            toggleBookmarkSelection: vi.fn(),
            selectFolder: vi.fn(),
            getBookmarkRowSubtitle: vi.fn(() => ''),
            exportAll: vi.fn(async () => ({ ok: true, data: { payload: {} } })),
            setPanelStatus: vi.fn(),
        } as any;

        const panel = new BookmarksPanel(controller, { show: vi.fn(), hide: vi.fn() } as any);
        await panel.show();

        const shadow = document.getElementById('aimd-bookmarks-panel-host')!.shadowRoot!;
        shadow.querySelector<HTMLButtonElement>('[data-action="set-bookmarks-tab"][data-tab="settings"]')!.click();

        expect(shadow.querySelector('.aimd-panel-title')?.textContent).toBe('Settings');
        expect(shadow.querySelector<HTMLInputElement>('[data-role="bookmark-query"]')?.getAttribute('placeholder')).toBe('Search bookmarks');
        expect(shadow.querySelector<HTMLElement>('.settings-panel')?.textContent).toContain('Storage Used');

        await setLocale('zh_CN');
        await flushUi();

        expect(shadow.querySelector('.aimd-panel-title')?.textContent).toBe('设置');
        expect(shadow.querySelector<HTMLInputElement>('[data-role="bookmark-query"]')?.getAttribute('placeholder')).toBe('搜索书签');
        expect(
            Array.from(shadow.querySelectorAll('.tab-btn span'))
                .map((node) => node.textContent?.trim() ?? '')
                .filter(Boolean),
        ).toEqual(['资料库', '设置', '功能全览', '更新日志', '常见问题', '关于作者', '反馈', '好友迹', '请我喝咖啡']);
        expect(shadow.querySelector<HTMLElement>('.settings-panel')?.textContent).toContain('存储占用');

        shadow.querySelector<HTMLButtonElement>('[data-action="set-bookmarks-tab"][data-tab="about"]')!.click();
        const zhAboutPanel = shadow.querySelector<HTMLElement>('.about-panel');
        expect(zhAboutPanel?.querySelector('.mappamory-promo-card')).toBeNull();

        shadow.querySelector<HTMLButtonElement>('[data-action="set-bookmarks-tab"][data-tab="mappamory"]')!.click();
        const zhMappamoryPanel = shadow.querySelector<HTMLElement>('.mappamory-panel');
        expect(shadow.querySelector('.aimd-panel-title')?.textContent).toBe('好友迹');
        expect(zhMappamoryPanel?.querySelector('.info-hero__title')?.textContent).toBe('把重要的人，放回地图里');
        expect(zhMappamoryPanel?.querySelectorAll('.mappamory-feature')).toHaveLength(3);
        expect(zhMappamoryPanel?.textContent).toContain('记录地点，不追踪任何人');

        shadow.querySelector<HTMLButtonElement>('[data-action="set-bookmarks-tab"][data-tab="feedback"]')!.click();
        const zhFeedbackPanel = shadow.querySelector<HTMLElement>('.feedback-panel');
        expect(zhFeedbackPanel?.querySelector('.info-hero__title')?.textContent).toBe('一起把 AI-MarkDone 做得更好');
        expect(zhFeedbackPanel?.querySelectorAll('.community-group-card')).toHaveLength(2);
        expect(zhFeedbackPanel?.textContent).toContain('群号 962705835');
        expect(zhFeedbackPanel?.textContent).toContain('2026 年 8 月 14 日');
        expect(zhFeedbackPanel?.textContent).toContain('关注我的小红书账号');
        expect(zhFeedbackPanel?.textContent).not.toContain('下方邮箱');

        panel.hide();
    });

    it('keeps panel interactions local instead of bubbling search, tab, and settings events to the page', async () => {
        const snapshot = {
            vm: {
                query: '',
                platform: 'All',
                bookmarks: [],
                folderTree: [],
                selectedFolderPath: null,
                sortMode: 'time-desc',
            },
            folders: [],
            folderPaths: [],
            selectedKeys: new Set<string>(),
            previewId: null,
            status: 'Ready',
            storageUsage: { usedBytes: 512, quotaBytes: 1024, usedPercentage: 50, warningLevel: 'none' },
        };

        const controller = {
            subscribe: vi.fn((fn: (snap: any) => void) => {
                fn(snapshot);
                return () => {};
            }),
            refreshAll: vi.fn(async () => undefined),
            refreshPositionsForUrl: vi.fn(async () => undefined),
            refreshUiState: vi.fn(async () => undefined),
            getTheme: vi.fn(() => 'light'),
            getAppearance: vi.fn(() => createAppearanceSnapshot('light')),
            getPlatforms: vi.fn(() => ['All', 'ChatGPT']),
            getFolderCheckboxState: vi.fn(() => ({ checked: false, indeterminate: false })),
            setQuery: vi.fn(),
            clearSelection: vi.fn(),
            setPlatform: vi.fn(),
            setSortMode: vi.fn(),
            toggleFolderExpanded: vi.fn(),
            toggleFolderSelection: vi.fn(),
            toggleBookmarkSelection: vi.fn(),
            selectFolder: vi.fn(),
            getBookmarkRowSubtitle: vi.fn(() => ''),
            exportAll: vi.fn(async () => ({ ok: true, data: { payload: {} } })),
            setPanelStatus: vi.fn(),
        } as any;

        const documentClick = vi.fn();
        const documentInput = vi.fn();
        const documentFocusIn = vi.fn();
        const documentKeydown = vi.fn();
        const documentChange = vi.fn();
        document.addEventListener('click', documentClick);
        document.addEventListener('input', documentInput);
        document.addEventListener('focusin', documentFocusIn);
        document.addEventListener('keydown', documentKeydown);
        document.addEventListener('change', documentChange);

        const panel = new BookmarksPanel(controller, { show: vi.fn(), hide: vi.fn() } as any);

        try {
            await panel.show();
            documentClick.mockClear();
            documentInput.mockClear();
            documentFocusIn.mockClear();
            documentKeydown.mockClear();
            documentChange.mockClear();

            const shadow = document.getElementById('aimd-bookmarks-panel-host')!.shadowRoot!;
            const queryInput = shadow.querySelector<HTMLInputElement>('[data-role="bookmark-query"]')!;
            queryInput.value = 'vector db';
            queryInput.dispatchEvent(new FocusEvent('focusin', { bubbles: true, composed: true }));
            queryInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', bubbles: true, composed: true }));
            queryInput.dispatchEvent(new Event('input', { bubbles: true, composed: true }));

            expect(controller.setQuery).toHaveBeenCalledWith('vector db');
            expect(documentFocusIn).not.toHaveBeenCalled();
            expect(documentKeydown).not.toHaveBeenCalled();
            expect(documentInput).not.toHaveBeenCalled();

            shadow.querySelector<HTMLElement>('[data-action="set-bookmarks-tab"][data-tab="settings"]')!
                .dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true }));

            expect(documentClick).not.toHaveBeenCalled();
            expect(shadow.querySelector<HTMLElement>('.settings-panel')?.dataset.active).toBe('1');

            const toggle = shadow.querySelector<HTMLInputElement>('[data-role="settings-platform-chatgpt"]')!;
            toggle.checked = false;
            toggle.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
            await flushUi();

            expect(documentChange).not.toHaveBeenCalled();
            expect(settingsClientRpc.setCategory).toHaveBeenCalledWith('platforms', { chatgpt: false });

            const directoryToggle = shadow.querySelector<HTMLInputElement>('[data-role="settings-chatgpt-directory-enabled"]')!;
            expect(shadow.querySelector('[data-role="settings-chatgpt-directory-retired-notice"]')).toBeNull();
            expect(directoryToggle).toBeTruthy();
            expect(shadow.querySelector('[data-role="settings-chatgpt-directory-mode"]')).toBeTruthy();
            expect(shadow.querySelector('[data-role="settings-chatgpt-directory-prompt-label-mode"]')).toBeTruthy();
            expect(shadow.querySelector('[data-role="settings-chatgpt-directory-hide-official-navigation"]')).toBeNull();

            directoryToggle.checked = true;
            directoryToggle.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
            await flushUi();

            expect(documentChange).not.toHaveBeenCalled();
            expect(settingsClientRpc.setCategory).toHaveBeenCalledWith('chatgptDirectory', { enabled: true });
        } finally {
            panel.hide();
            document.removeEventListener('click', documentClick);
            document.removeEventListener('input', documentInput);
            document.removeEventListener('focusin', documentFocusIn);
            document.removeEventListener('keydown', documentKeydown);
            document.removeEventListener('change', documentChange);
        }
    });

    it('wires bookmarks panel icon actions into the shared tooltip delegate', async () => {
        await setLocale('en');
        const snapshot = {
            vm: {
                query: '',
                platform: 'All',
                bookmarks: [],
                folderTree: [],
                selectedFolderPath: null,
                sortMode: 'time-desc',
            },
            folders: [],
            folderPaths: [],
            selectedKeys: new Set(),
            previewId: null,
            status: 'Ready',
            storageUsage: { usedBytes: 512, quotaBytes: 1024, usedPercentage: 50, warningLevel: 'none' },
        };

        const controller = {
            subscribe: vi.fn((fn: (snap: any) => void) => {
                fn(snapshot);
                return () => {};
            }),
            refreshAll: vi.fn(async () => undefined),
            refreshPositionsForUrl: vi.fn(async () => undefined),
            refreshUiState: vi.fn(async () => undefined),
            getTheme: vi.fn(() => 'light'),
            getAppearance: vi.fn(() => createAppearanceSnapshot('light')),
            getPlatforms: vi.fn(() => ['All', 'ChatGPT']),
            getFolderCheckboxState: vi.fn(() => ({ checked: false, indeterminate: false })),
            setQuery: vi.fn(),
            clearSelection: vi.fn(),
            setPlatform: vi.fn(),
            setSortMode: vi.fn(),
            toggleFolderExpanded: vi.fn(),
            toggleFolderSelection: vi.fn(),
            toggleBookmarkSelection: vi.fn(),
            selectFolder: vi.fn(),
            getBookmarkRowSubtitle: vi.fn(() => ''),
            exportAll: vi.fn(async () => ({ ok: true, data: { payload: {} } })),
            setPanelStatus: vi.fn(),
        } as any;

        const panel = new BookmarksPanel(controller, { show: vi.fn(), hide: vi.fn() } as any);
        await panel.show();

        const shadow = document.getElementById('aimd-bookmarks-panel-host')!.shadowRoot!;
        const exportButton = shadow.querySelector<HTMLButtonElement>('[data-action="export-all-bookmarks"]');

        expect(shadow.querySelector('style[data-aimd-tooltip-style]')).toBeTruthy();
        expect(exportButton?.dataset.tooltip).toBe('Export Library');
        vi.spyOn(exportButton!, 'getBoundingClientRect').mockReturnValue({
            x: 320,
            y: 240,
            left: 320,
            top: 240,
            width: 30,
            height: 30,
            right: 350,
            bottom: 270,
            toJSON: () => ({}),
        } as DOMRect);

        exportButton?.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
        await Promise.resolve();
        await flushAnimationFrame();

        expect(document.body.querySelector('.aimd-tooltip__body')?.textContent).toBe('Export Library');
        expect(shadow.querySelector('.aimd-tooltip__body')).toBeNull();

        panel.hide();
    });

    it('applies the shared field classes to the bookmarks search and count inputs', async () => {
        await setLocale('en');
        const snapshot = {
            vm: {
                query: '',
                platform: 'All',
                bookmarks: [],
                folderTree: [],
                selectedFolderPath: null,
                sortMode: 'time-desc',
            },
            folders: [],
            folderPaths: [],
            selectedKeys: new Set(),
            previewId: null,
            status: 'Ready',
            storageUsage: { usedBytes: 512, quotaBytes: 1024, usedPercentage: 50, warningLevel: 'none' },
        };

        const controller = {
            subscribe: vi.fn((fn: (snap: any) => void) => {
                fn(snapshot);
                return () => {};
            }),
            refreshAll: vi.fn(async () => undefined),
            refreshPositionsForUrl: vi.fn(async () => undefined),
            refreshUiState: vi.fn(async () => undefined),
            getTheme: vi.fn(() => 'light'),
            getAppearance: vi.fn(() => createAppearanceSnapshot('light')),
            getPlatforms: vi.fn(() => ['All', 'ChatGPT']),
            getFolderCheckboxState: vi.fn(() => ({ checked: false, indeterminate: false })),
            setQuery: vi.fn(),
            clearSelection: vi.fn(),
            setPlatform: vi.fn(),
            setSortMode: vi.fn(),
            toggleFolderExpanded: vi.fn(),
            toggleFolderSelection: vi.fn(),
            toggleBookmarkSelection: vi.fn(),
            selectFolder: vi.fn(),
            getBookmarkRowSubtitle: vi.fn(() => ''),
            exportAll: vi.fn(async () => ({ ok: true, data: { payload: {} } })),
            setPanelStatus: vi.fn(),
        } as any;

        const panel = new BookmarksPanel(controller, { show: vi.fn(), hide: vi.fn() } as any);
        await panel.show();

        const shadow = document.getElementById('aimd-bookmarks-panel-host')!.shadowRoot!;
        expect(shadow.querySelector('.search-field')?.classList.contains('aimd-field-shell')).toBe(true);
        expect(shadow.querySelector<HTMLInputElement>('[data-role="bookmark-query"]')?.classList.contains('aimd-field-control')).toBe(true);

        shadow.querySelector<HTMLButtonElement>('[data-action="set-bookmarks-tab"][data-tab="settings"]')!.click();

        expect(shadow.querySelector<HTMLButtonElement>('.settings-select-trigger')).toBeTruthy();

        panel.hide();
    });

    it('renders the bookmarks toolbar without the obsolete platform filter', async () => {
        const snapshot = {
            vm: {
                query: '',
                kind: 'all',
                bookmarks: [],
                folderTree: [],
                selectedFolderPath: null,
                sortMode: 'time-desc',
            },
            folders: [],
            folderPaths: [],
            selectedKeys: new Set(),
            previewId: null,
            status: 'Ready',
        };

        const controller = {
            subscribe: vi.fn((fn: (snap: any) => void) => {
                fn(snapshot);
                return () => {};
            }),
            refreshAll: vi.fn(async () => undefined),
            refreshPositionsForUrl: vi.fn(async () => undefined),
            refreshUiState: vi.fn(async () => undefined),
            getTheme: vi.fn(() => 'light'),
            getAppearance: vi.fn(() => createAppearanceSnapshot('light')),
            getPlatforms: vi.fn(() => ['All', 'deepseek']),
            getFolderCheckboxState: vi.fn(() => ({ checked: false, indeterminate: false })),
            setQuery: vi.fn(),
            clearSelection: vi.fn(),
            setPlatform: vi.fn(),
            setSortMode: vi.fn(),
            toggleFolderExpanded: vi.fn(),
            toggleFolderSelection: vi.fn(),
            toggleBookmarkSelection: vi.fn(),
            selectFolder: vi.fn(),
            getBookmarkRowSubtitle: vi.fn(() => ''),
            exportAll: vi.fn(async () => ({ ok: true, data: { payload: {} } })),
            setPanelStatus: vi.fn(),
        } as any;

        const panel = new BookmarksPanel(controller, { show: vi.fn(), hide: vi.fn() } as any);
        await panel.show();

        const shadow = document.getElementById('aimd-bookmarks-panel-host')!.shadowRoot!;
        const toolbar = shadow.querySelector<HTMLElement>('.toolbar-row--bookmarks')!;
        const search = shadow.querySelector<HTMLElement>('[data-role="bookmark-query"]')!.closest('.search-field');
        const rightActions = shadow.querySelector<HTMLElement>('.bookmarks-tab-content .library-bookmark-toolbar-actions')!;

        expect(shadow.querySelector('.platform-dropdown')).toBeNull();
        expect(search?.parentElement).toBe(toolbar);
        expect(shadow.querySelector('.library-toolbar-menu')).toBeNull();
        expect(rightActions.parentElement?.className).toBe('library-heading');
        expect(rightActions.querySelector('[data-role="bookmark-kind-filter"]')).toBeTruthy();
        expect(rightActions.querySelector('[data-action="toggle-sort-time"]')).toBeTruthy();
        expect(controller.getPlatforms).not.toHaveBeenCalled();
        expect(controller.setPlatform).not.toHaveBeenCalled();
        panel.hide();
    });

    it('closes the settings select menu when clicking blank space outside the select shell', async () => {
        const snapshot = {
            vm: {
                query: '',
                platform: 'All',
                bookmarks: [],
                folderTree: [],
                selectedFolderPath: null,
                sortMode: 'time-desc',
            },
            folders: [],
            folderPaths: [],
            selectedKeys: new Set(),
            previewId: null,
            status: 'Ready',
        };

        const controller = {
            subscribe: vi.fn((fn: (snap: any) => void) => {
                fn(snapshot);
                return () => {};
            }),
            refreshAll: vi.fn(async () => undefined),
            refreshPositionsForUrl: vi.fn(async () => undefined),
            refreshUiState: vi.fn(async () => undefined),
            getTheme: vi.fn(() => 'light'),
            getAppearance: vi.fn(() => createAppearanceSnapshot('light')),
            getPlatforms: vi.fn(() => ['All', 'ChatGPT']),
            getFolderCheckboxState: vi.fn(() => ({ checked: false, indeterminate: false })),
            setQuery: vi.fn(),
            clearSelection: vi.fn(),
            setPlatform: vi.fn(),
            setSortMode: vi.fn(),
            toggleFolderExpanded: vi.fn(),
            toggleFolderSelection: vi.fn(),
            toggleBookmarkSelection: vi.fn(),
            selectFolder: vi.fn(),
            getBookmarkRowSubtitle: vi.fn(() => ''),
            exportAll: vi.fn(async () => ({ ok: true, data: { payload: {} } })),
            setPanelStatus: vi.fn(),
        } as any;

        const panel = new BookmarksPanel(controller, { show: vi.fn(), hide: vi.fn() } as any);
        await panel.show();

        const shadow = document.getElementById('aimd-bookmarks-panel-host')!.shadowRoot!;
        shadow.querySelector<HTMLElement>('[data-action="set-bookmarks-tab"][data-tab="settings"]')!.click();
        shadow.querySelector<HTMLButtonElement>('[data-action="toggle-settings-menu"][data-menu="language"]')!.click();
        expect(shadow.querySelector('.settings-select-menu[data-open="1"]')).toBeTruthy();

        shadow.querySelector<HTMLElement>('.settings-panel')!
            .dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, composed: true }));

        expect(shadow.querySelector('.settings-select-menu[data-open="1"]')).toBeNull();
        panel.hide();
    });

    it('lets settings choice menus consume Escape before the bookmarks panel closes', async () => {
        const snapshot = {
            vm: {
                query: '',
                platform: 'All',
                bookmarks: [],
                folderTree: [],
                selectedFolderPath: null,
                sortMode: 'time-desc',
            },
            folders: [],
            folderPaths: [],
            selectedKeys: new Set(),
            previewId: null,
            status: 'Ready',
        };

        const controller = {
            subscribe: vi.fn((fn: (snap: any) => void) => {
                fn(snapshot);
                return () => {};
            }),
            refreshAll: vi.fn(async () => undefined),
            refreshPositionsForUrl: vi.fn(async () => undefined),
            refreshUiState: vi.fn(async () => undefined),
            getTheme: vi.fn(() => 'light'),
            getAppearance: vi.fn(() => createAppearanceSnapshot('light')),
            getPlatforms: vi.fn(() => ['All', 'ChatGPT']),
            getFolderCheckboxState: vi.fn(() => ({ checked: false, indeterminate: false })),
            setQuery: vi.fn(),
            clearSelection: vi.fn(),
            setPlatform: vi.fn(),
            setSortMode: vi.fn(),
            toggleFolderExpanded: vi.fn(),
            toggleFolderSelection: vi.fn(),
            toggleBookmarkSelection: vi.fn(),
            selectFolder: vi.fn(),
            getBookmarkRowSubtitle: vi.fn(() => ''),
            exportAll: vi.fn(async () => ({ ok: true, data: { payload: {} } })),
            setPanelStatus: vi.fn(),
        } as any;

        const panel = new BookmarksPanel(controller, { show: vi.fn(), hide: vi.fn() } as any);
        await panel.show();

        const host = document.getElementById('aimd-bookmarks-panel-host')!;
        const shadow = host.shadowRoot!;
        shadow.querySelector<HTMLButtonElement>('[data-action="workspace-fullscreen"]')!.click();
        expect(shadow.querySelector<HTMLElement>('.panel-window')?.dataset.fullscreen).toBe('1');
        shadow.querySelector<HTMLElement>('[data-action="set-bookmarks-tab"][data-tab="settings"]')!.click();
        shadow.querySelector<HTMLButtonElement>('[data-role="settings-theme-mode"]')!.click();
        expect(shadow.querySelector('.settings-select-menu[data-open="1"]')).toBeTruthy();

        shadow.querySelector<HTMLButtonElement>('[data-role="settings-theme-mode"]')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, composed: true }));

        expect(shadow.querySelector('.settings-select-menu[data-open="1"]')).toBeNull();
        expect(panel.isVisible()).toBe(true);
        expect(host.isConnected).toBe(true);

        shadow.querySelector<HTMLButtonElement>('[data-role="settings-theme-mode"]')!.click();
        expect(shadow.querySelector('.settings-select-menu[data-open="1"]')).toBeTruthy();

        shadow.querySelector<HTMLButtonElement>('[data-role="settings-theme-mode"]')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, composed: true }));

        expect(shadow.querySelector('.settings-select-menu[data-open="1"]')).toBeNull();
        expect(panel.isVisible()).toBe(true);
        expect(host.isConnected).toBe(true);

        host.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, composed: true }));
        expect(panel.isVisible()).toBe(false);
    });

    it('toggles the folding-mode select closed when clicking the same trigger again', async () => {
        const snapshot = {
            vm: {
                query: '',
                platform: 'All',
                bookmarks: [],
                folderTree: [],
                selectedFolderPath: null,
                sortMode: 'time-desc',
            },
            folders: [],
            folderPaths: [],
            selectedKeys: new Set(),
            previewId: null,
            status: 'Ready',
        };

        const controller = {
            subscribe: vi.fn((fn: (snap: any) => void) => {
                fn(snapshot);
                return () => {};
            }),
            refreshAll: vi.fn(async () => undefined),
            refreshPositionsForUrl: vi.fn(async () => undefined),
            refreshUiState: vi.fn(async () => undefined),
            getTheme: vi.fn(() => 'light'),
            getAppearance: vi.fn(() => createAppearanceSnapshot('light')),
            getPlatforms: vi.fn(() => ['All', 'ChatGPT']),
            getFolderCheckboxState: vi.fn(() => ({ checked: false, indeterminate: false })),
            setQuery: vi.fn(),
            clearSelection: vi.fn(),
            setPlatform: vi.fn(),
            setSortMode: vi.fn(),
            toggleFolderExpanded: vi.fn(),
            toggleFolderSelection: vi.fn(),
            toggleBookmarkSelection: vi.fn(),
            selectFolder: vi.fn(),
            getBookmarkRowSubtitle: vi.fn(() => ''),
            exportAll: vi.fn(async () => ({ ok: true, data: { payload: {} } })),
            setPanelStatus: vi.fn(),
        } as any;

        const panel = new BookmarksPanel(controller, { show: vi.fn(), hide: vi.fn() } as any);
        await panel.show();

        const shadow = document.getElementById('aimd-bookmarks-panel-host')!.shadowRoot!;
        shadow.querySelector<HTMLElement>('[data-action="set-bookmarks-tab"][data-tab="settings"]')!.click();
        const trigger = shadow.querySelector<HTMLButtonElement>('[data-action="toggle-settings-menu"][data-menu="language"]')!;
        const menu = trigger.closest<HTMLElement>('.settings-select-shell')?.querySelector<HTMLElement>('.settings-select-menu');

        trigger.click();
        expect(menu?.getAttribute('data-open')).toBe('1');

        trigger.click();
        expect(menu?.getAttribute('data-open')).toBe('0');
        panel.hide();
    });

    it('updates visible copy immediately when selecting a new language from the settings menu', async () => {
        await setLocale('en');
        const snapshot = {
            vm: {
                query: '',
                platform: 'All',
                bookmarks: [],
                folderTree: [],
                selectedFolderPath: null,
                sortMode: 'time-desc',
            },
            folders: [],
            folderPaths: [],
            selectedKeys: new Set(),
            previewId: null,
            status: 'Ready',
            storageUsage: { usedBytes: 512, quotaBytes: 1024, usedPercentage: 50, warningLevel: 'none' },
        };

        const controller = {
            subscribe: vi.fn((fn: (snap: any) => void) => {
                fn(snapshot);
                return () => {};
            }),
            refreshAll: vi.fn(async () => undefined),
            refreshPositionsForUrl: vi.fn(async () => undefined),
            refreshUiState: vi.fn(async () => undefined),
            getTheme: vi.fn(() => 'light'),
            getAppearance: vi.fn(() => createAppearanceSnapshot('light')),
            getPlatforms: vi.fn(() => ['All', 'ChatGPT']),
            getFolderCheckboxState: vi.fn(() => ({ checked: false, indeterminate: false })),
            setQuery: vi.fn(),
            clearSelection: vi.fn(),
            setPlatform: vi.fn(),
            setSortMode: vi.fn(),
            toggleFolderExpanded: vi.fn(),
            toggleFolderSelection: vi.fn(),
            toggleBookmarkSelection: vi.fn(),
            selectFolder: vi.fn(),
            getBookmarkRowSubtitle: vi.fn(() => ''),
            exportAll: vi.fn(async () => ({ ok: true, data: { payload: {} } })),
            setPanelStatus: vi.fn(),
        } as any;

        const panel = new BookmarksPanel(controller, { show: vi.fn(), hide: vi.fn() } as any);
        await panel.show();

        const shadow = document.getElementById('aimd-bookmarks-panel-host')!.shadowRoot!;
        shadow.querySelector<HTMLButtonElement>('[data-action="set-bookmarks-tab"][data-tab="settings"]')!.click();

        expect(shadow.querySelector('.aimd-panel-title')?.textContent).toBe('Settings');
        expect(shadow.querySelector<HTMLInputElement>('[data-role="bookmark-query"]')?.getAttribute('placeholder')).toBe('Search bookmarks');

        shadow.querySelector<HTMLButtonElement>('[data-action="toggle-settings-menu"][data-menu="language"]')!.click();
        shadow.querySelector<HTMLElement>('[data-action="settings-select-option"][data-menu="language"][data-value="zh_CN"]')!.click();
        await flushUi();

        expect(settingsClientRpc.setCategory).toHaveBeenCalledWith('language', 'zh_CN');
        await vi.waitFor(() => {
            expect(shadow.querySelector('.aimd-panel-title')?.textContent).toBe('设置');
        });
        expect(shadow.querySelector<HTMLInputElement>('[data-role="bookmark-query"]')?.getAttribute('placeholder')).toBe('搜索书签');

        panel.hide();
    });

    it('reports a failed language persistence result to the settings view', async () => {
        vi.mocked(settingsClientRpc.setCategory).mockResolvedValueOnce({
            ok: false,
            errorCode: 'STORAGE_ERROR',
            message: 'Storage unavailable',
        });
        const panel = new BookmarksPanel({} as any, { show: vi.fn(), hide: vi.fn() } as any);
        const actions = (panel as any).createSettingsActions();

        await expect(actions.setLanguage('zh_CN')).resolves.toBe(false);
        expect(settingsClientRpc.setCategory).toHaveBeenCalledWith('language', 'zh_CN');
    });

    it('does not commit an optimistic settings value when persistence is disconnected', async () => {
        vi.mocked(settingsClientRpc.setCategory).mockResolvedValueOnce({
            ok: false,
            errorCode: 'RECEIVER_UNAVAILABLE',
            message: 'Could not establish connection. Receiving end does not exist.',
            failure: {
                kind: 'transport',
                code: 'RECEIVER_UNAVAILABLE',
                message: 'Could not establish connection. Receiving end does not exist.',
                delivery: 'not-sent',
            },
        } as any);
        const panel = new BookmarksPanel({} as any, { show: vi.fn(), hide: vi.fn() } as any);
        const actions = (panel as any).createSettingsActions();
        const before = await actions.loadState();

        await expect(actions.setPlatforms({ chatgpt: false })).resolves.toBe(false);

        const after = await actions.loadState();
        expect(before.settings.platforms.chatgpt).toBe(true);
        expect(after.settings.platforms.chatgpt).toBe(true);
        expect(after.dataState).toEqual(expect.objectContaining({ kind: 'error' }));
    });

    it('adds a backdrop overlay and closes the panel when clicking outside the panel surface', async () => {
        const snapshot = {
            vm: {
                query: '',
                platform: 'All',
                bookmarks: [],
                folderTree: [],
                selectedFolderPath: null,
                sortMode: 'time-desc',
            },
            folders: [],
            folderPaths: [],
            selectedKeys: new Set(),
            previewId: null,
            status: 'Ready',
        };

        const controller = {
            subscribe: vi.fn((fn: (snap: any) => void) => {
                fn(snapshot);
                return () => {};
            }),
            refreshAll: vi.fn(async () => undefined),
            refreshPositionsForUrl: vi.fn(async () => undefined),
            refreshUiState: vi.fn(async () => undefined),
            getTheme: vi.fn(() => 'light'),
            getAppearance: vi.fn(() => createAppearanceSnapshot('light')),
            getPlatforms: vi.fn(() => ['All', 'ChatGPT']),
            getFolderCheckboxState: vi.fn(() => ({ checked: false, indeterminate: false })),
            setQuery: vi.fn(),
            clearSelection: vi.fn(),
            setPlatform: vi.fn(),
            setSortMode: vi.fn(),
            toggleFolderExpanded: vi.fn(),
            toggleFolderSelection: vi.fn(),
            toggleBookmarkSelection: vi.fn(),
            selectFolder: vi.fn(),
            getBookmarkRowSubtitle: vi.fn(() => ''),
            exportAll: vi.fn(async () => ({ ok: true, data: { payload: {} } })),
            setPanelStatus: vi.fn(),
        } as any;

        const panel = new BookmarksPanel(controller, { show: vi.fn(), hide: vi.fn() } as any);
        await panel.show();

        const host = document.getElementById('aimd-bookmarks-panel-host')!;
        const shadow = host.shadowRoot!;
        const overlay = shadow.querySelector<HTMLElement>('.panel-stage__overlay');
        const panelShell = shadow.querySelector<HTMLElement>('.panel-window--bookmarks');
        expect(overlay).toBeTruthy();

        overlay!.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, composed: true }));

        expect(panelShell?.dataset.motionState).toBe('closing');
        panelShell?.dispatchEvent(new Event('animationend', { bubbles: true }));
        expect(document.getElementById('aimd-bookmarks-panel-host')).toBeNull();
    });

    it('does not close the panel when clicking a shared transient popover above settings', async () => {
        const snapshot = {
            vm: {
                query: '',
                platform: 'All',
                bookmarks: [],
                folderTree: [],
                selectedFolderPath: null,
                sortMode: 'time-desc',
            },
            folders: [],
            folderPaths: [],
            selectedKeys: new Set(),
            previewId: null,
            status: 'Ready',
        };

        const controller = {
            subscribe: vi.fn((fn: (snap: any) => void) => {
                fn(snapshot);
                return () => {};
            }),
            refreshAll: vi.fn(async () => undefined),
            refreshPositionsForUrl: vi.fn(async () => undefined),
            refreshUiState: vi.fn(async () => undefined),
            getTheme: vi.fn(() => 'light'),
            getAppearance: vi.fn(() => createAppearanceSnapshot('light')),
            getPlatforms: vi.fn(() => ['All', 'ChatGPT']),
            getFolderCheckboxState: vi.fn(() => ({ checked: false, indeterminate: false })),
            setQuery: vi.fn(),
            clearSelection: vi.fn(),
            setPlatform: vi.fn(),
            setSortMode: vi.fn(),
            toggleFolderExpanded: vi.fn(),
            toggleFolderSelection: vi.fn(),
            toggleBookmarkSelection: vi.fn(),
            selectFolder: vi.fn(),
            getBookmarkRowSubtitle: vi.fn(() => ''),
            exportAll: vi.fn(async () => ({ ok: true, data: { payload: {} } })),
            setPanelStatus: vi.fn(),
        } as any;

        const panel = new BookmarksPanel(controller, { show: vi.fn(), hide: vi.fn() } as any);
        await panel.show();

        const host = document.getElementById('aimd-bookmarks-panel-host')!;
        const shadow = host.shadowRoot!;
        shadow.querySelector<HTMLButtonElement>('[data-action="set-bookmarks-tab"][data-tab="settings"]')!.click();
        await flushUi();
        const panelShell = shadow.querySelector<HTMLElement>('.panel-window--bookmarks')!;
        const transientPopover = markTransientRoot(document.createElement('div'));
        shadow.append(transientPopover);

        transientPopover.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, composed: true }));

        expect(panelShell.dataset.motionState).not.toBe('closing');
        expect(document.getElementById('aimd-bookmarks-panel-host')).toBe(host);
        panel.hide();
    });

    it('shows a complete Library import summary after choosing a file through the panel', async () => {
        await setLocale('zh_CN');
        const file = {
            name: 'bookmarks.json',
            type: 'application/json',
            text: vi.fn(async () => JSON.stringify({ bookmarks: [] })),
        };
        const snapshot = {
            vm: {
                query: '',
                platform: 'All',
                bookmarks: [],
                folderTree: [],
                selectedFolderPath: null,
                sortMode: 'time-desc',
            },
            folders: [],
            folderPaths: [],
            selectedKeys: new Set<string>(),
            previewId: null,
            status: 'Ready',
        };

        const controller = {
            subscribe: vi.fn((fn: (snap: any) => void) => {
                fn(snapshot);
                return () => {};
            }),
            refreshAll: vi.fn(async () => undefined),
            refreshPositionsForUrl: vi.fn(async () => undefined),
            refreshUiState: vi.fn(async () => undefined),
            getTheme: vi.fn(() => 'light'),
            getAppearance: vi.fn(() => createAppearanceSnapshot('light')),
            getPlatforms: vi.fn(() => ['All', 'ChatGPT']),
            getFolderCheckboxState: vi.fn(() => ({ checked: false, indeterminate: false })),
            setQuery: vi.fn(),
            clearSelection: vi.fn(),
            setPlatform: vi.fn(),
            setSortMode: vi.fn(),
            toggleFolderExpanded: vi.fn(),
            toggleFolderSelection: vi.fn(),
            toggleBookmarkSelection: vi.fn(),
            selectFolder: vi.fn(),
            getBookmarkRowSubtitle: vi.fn(() => ''),
            exportAll: vi.fn(async () => ({ ok: true, data: { payload: {} } })),
            importJsonText: vi.fn(async () => ({
                ok: true,
                data: { imported: 3, skippedDuplicates: 1, conflicts: 1, renamed: 2, warnings: ['Used fallback folder'], folderCreateFailures: 1,
                    library: { bookmarkFolders: { added: 1, duplicate: 0, conflict: 0 }, highlights: { added: 2, duplicate: 0, conflict: 0 }, annotations: { added: 1, duplicate: 0, conflict: 0 }, folders: { added: 1, duplicate: 0, conflict: 0 }, conversations: { added: 1, duplicate: 0, conflict: 0 } } },
            })),
            setPanelStatus: vi.fn(),
        } as any;

        const panel = new BookmarksPanel(controller, { show: vi.fn(), hide: vi.fn() } as any);
        await panel.show();

        const shadow = document.getElementById('aimd-bookmarks-panel-host')!.shadowRoot!;
        const input = shadow.querySelector<HTMLInputElement>('[data-role="import-file"]')!;
        Object.defineProperty(input, 'files', { configurable: true, value: [file] });
        input.dispatchEvent(new Event('change', { bubbles: true }));
        await flushUi();
        await flushUi();

        expect(controller.importJsonText).toHaveBeenCalled();
        expect(shadow.querySelector('.mock-modal__title-copy strong')?.textContent).toBe('导入结果概览');
        expect(shadow.querySelectorAll('.merge-summary-item').length).toBeGreaterThanOrEqual(4);
        expect(shadow.textContent).toContain('导入摘要');
        expect(shadow.textContent).toContain('详细结果');
        expect(shadow.textContent).toContain('高亮');
        expect(shadow.textContent).toContain('注释');
        expect(shadow.textContent).toContain('书签文件夹');
        expect(shadow.textContent).toContain('1 个书签冲突项已保留本地版本');
        expect(shadow.textContent).toContain('Used fallback folder');

        panel.hide();
    });

    it('preserves the settings scroll position across rerenders instead of snapping back to the top', async () => {
        const snapshot = {
            vm: {
                query: '',
                platform: 'All',
                bookmarks: [],
                folderTree: [],
                selectedFolderPath: null,
                sortMode: 'time-desc',
            },
            folders: [],
            folderPaths: [],
            selectedKeys: new Set(),
            previewId: null,
            status: 'Ready',
        };

        const controller = {
            subscribe: vi.fn((fn: (snap: any) => void) => {
                fn(snapshot);
                return () => {};
            }),
            refreshAll: vi.fn(async () => undefined),
            refreshPositionsForUrl: vi.fn(async () => undefined),
            refreshUiState: vi.fn(async () => undefined),
            getTheme: vi.fn(() => 'light'),
            getAppearance: vi.fn(() => createAppearanceSnapshot('light')),
            getPlatforms: vi.fn(() => ['All', 'ChatGPT']),
            getFolderCheckboxState: vi.fn(() => ({ checked: false, indeterminate: false })),
            setQuery: vi.fn(),
            clearSelection: vi.fn(),
            setPlatform: vi.fn(),
            setSortMode: vi.fn(),
            toggleFolderExpanded: vi.fn(),
            toggleFolderSelection: vi.fn(),
            toggleBookmarkSelection: vi.fn(),
            selectFolder: vi.fn(),
            getBookmarkRowSubtitle: vi.fn(() => 'ChatGPT - today'),
            exportAll: vi.fn(async () => ({ ok: true, data: { payload: {} } })),
            setPanelStatus: vi.fn(),
        } as any;

        const panel = new BookmarksPanel(controller, { show: vi.fn(), hide: vi.fn() } as any);
        await panel.show();

        const shadow = document.getElementById('aimd-bookmarks-panel-host')!.shadowRoot!;
        shadow.querySelector<HTMLElement>('[data-action="set-bookmarks-tab"][data-tab="settings"]')!.click();

        const settingsScrollOwner = shadow.querySelector<HTMLElement>('.settings-panel-scroll');
        expect(settingsScrollOwner).toBeTruthy();
        settingsScrollOwner!.scrollTop = 180;

        await setLocale('zh_CN');
        await flushUi();

        const refreshedSettingsScrollOwner = shadow.querySelector<HTMLElement>('.settings-panel-scroll');
        expect(refreshedSettingsScrollOwner).not.toBe(settingsScrollOwner);
        expect(refreshedSettingsScrollOwner?.scrollTop).toBe(180);

        panel.hide();
    });

    it('replays the support burst effect when the coffee panel is clicked', async () => {
        const snapshot = {
            vm: {
                query: '',
                platform: 'All',
                bookmarks: [],
                folderTree: [],
                selectedFolderPath: null,
                sortMode: 'time-desc',
            },
            folders: [],
            folderPaths: [],
            selectedKeys: new Set(),
            previewId: null,
            status: 'Ready',
        };

        const controller = {
            subscribe: vi.fn((fn: (snap: any) => void) => {
                fn(snapshot);
                return () => {};
            }),
            refreshAll: vi.fn(async () => undefined),
            refreshPositionsForUrl: vi.fn(async () => undefined),
            refreshUiState: vi.fn(async () => undefined),
            getTheme: vi.fn(() => 'light'),
            getAppearance: vi.fn(() => createAppearanceSnapshot('light')),
            getPlatforms: vi.fn(() => ['All', 'ChatGPT']),
            getFolderCheckboxState: vi.fn(() => ({ checked: false, indeterminate: false })),
            setQuery: vi.fn(),
            clearSelection: vi.fn(),
            setPlatform: vi.fn(),
            setSortMode: vi.fn(),
            toggleFolderExpanded: vi.fn(),
            toggleFolderSelection: vi.fn(),
            toggleBookmarkSelection: vi.fn(),
            selectFolder: vi.fn(),
            getBookmarkRowSubtitle: vi.fn(() => 'ChatGPT - today'),
            exportAll: vi.fn(async () => ({ ok: true, data: { payload: {} } })),
            setPanelStatus: vi.fn(),
        } as any;

        const panel = new BookmarksPanel(controller, { show: vi.fn(), hide: vi.fn() } as any);
        await panel.show();

        const shadow = document.getElementById('aimd-bookmarks-panel-host')!.shadowRoot!;
        shadow.querySelector<HTMLElement>('[data-action="set-bookmarks-tab"][data-tab="sponsor"]')!.click();

        const sponsorPanel = shadow.querySelector<HTMLElement>('.sponsor-panel');
        expect(sponsorPanel).toBeTruthy();

        sponsorPanel!.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: 280, clientY: 320 }));

        expect(shadow.querySelectorAll('.sponsor-burst-piece').length).toBeGreaterThan(0);

        panel.hide();
    });
});
