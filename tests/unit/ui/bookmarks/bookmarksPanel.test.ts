import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

vi.mock('@/drivers/shared/clients/settingsClientRpc', () => ({
    settingsClientRpc: {
        getAll: vi.fn(async () => ({
            ok: true,
            data: {
                settings: {
                    platforms: { chatgpt: true, gemini: true, claude: true, deepseek: true },
                    chatgpt: { foldingMode: 'off', defaultExpandedCount: 8, showFoldDock: true },
                    behavior: {
                        showViewSource: true,
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
        setCategory: vi.fn(async () => ({ ok: true, data: { category: 'chatgpt' } })),
    },
}));

import { BookmarksPanel } from '@/ui/content/bookmarks/BookmarksPanel';
import { bookmarkSaveDialog } from '@/ui/content/bookmarks/save/bookmarkSaveDialogSingleton';
import { getBookmarksPanelCss } from '@/ui/content/bookmarks/ui/styles/bookmarksPanelCss';
import { setLocale } from '@/ui/content/components/i18n';
import { settingsClientRpc } from '@/drivers/shared/clients/settingsClientRpc';

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

    it('styles the imported secondary empty-state action instead of leaving the mock import button unskinned', () => {
        const css = getBookmarksPanelCss();

        expect(css).toContain('.secondary-btn');
        expect(css).toContain('--_bookmarks-shell-radius: var(--aimd-radius-2xl);');
        expect(css).toContain('--_bookmarks-control-height: 44px;');
        expect(css).toContain('--_bookmarks-pill-radius: var(--aimd-radius-full);');
        expect(css).toContain('--_bookmarks-panel-title-size: var(--aimd-panel-title-size-compact);');
        expect(css).toContain('--_bookmarks-modal-title-size: var(--aimd-modal-title-size);');
        expect(css).toContain('--_bookmarks-body-copy-size: var(--aimd-text-sm);');
        expect(css).toContain('--_bookmarks-section-title-size: var(--aimd-text-base);');
        expect(css).toContain('--_bookmarks-section-title-weight: var(--aimd-font-medium);');
        expect(css).toContain('--_bookmarks-item-title-size: var(--aimd-text-sm);');
        expect(css).toContain('--_bookmarks-item-title-weight: var(--aimd-font-medium);');
        expect(css).toContain('--_bookmarks-meta-size: var(--aimd-text-sm);');
        expect(css).toContain('border-radius: var(--_bookmarks-pill-radius);');
        expect(css).toContain('min-height: var(--aimd-size-control-action-panel);');
        expect(css).toContain('width: var(--aimd-size-control-icon-panel);');
        expect(css).not.toContain('--_bookmarks-icon-button-size:');
        expect(css).not.toContain('--_bookmarks-action-height:');
        expect(css).toContain('width: min(var(--aimd-panel-wide-max-width), 100%);');
        expect(css).toContain('height: min(var(--aimd-panel-wide-max-height), calc(100vh - var(--_bookmarks-panel-edge-offset)));');
        expect(css).toContain('.platform-dropdown__option {');
        expect(css).toContain('justify-content: flex-start;');
        expect(css).toContain('.search-field {');
        expect(css).toContain('font-size: var(--aimd-text-sm);');
        expect(css).toContain('.platform-dropdown__label {');
        expect(css).toContain('.platform-dropdown__option {');
        expect(css).toContain('font-size: var(--aimd-text-sm);');
        expect(css).toContain('.tree-title-meta');
        expect(css).toContain('.tree-item:hover .tree-main--bookmark .tree-subtitle');
        expect(css).toContain('--_bookmarks-tree-actions-width:');
        expect(css).toContain('--_bookmarks-tree-actions-z: calc(var(--aimd-z-base) + 1);');
        expect(css).toContain('padding-right: var(--_bookmarks-tree-actions-width);');
        expect(css).toContain('.tree-actions {');
        expect(css).toContain('z-index: var(--_bookmarks-tree-actions-z);');
        expect(css).toContain('.aimd-field-shell:focus-within');
        expect(css).toContain('.aimd-field-control:focus::placeholder');
        expect(css).not.toContain('rgba(');
        expect(css).not.toContain('#0f172a');
        expect(css).not.toContain('background: white;');
        expect(css).not.toContain('z-index: 20;');
        expect(css).not.toContain('z-index: 4;');
        expect(css).not.toMatch(/font-size:\s*\d+px/);
        expect(css).not.toMatch(/border-radius:\s*\d+px/);
        expect(css).toContain('background: var(--aimd-button-icon-hover);');
        expect(css).toContain('background: var(--aimd-button-secondary-hover);');
        expect(css).toContain('.icon-btn--danger:hover');
        expect(css).toContain('.tab-btn:hover');
        expect(css).toContain('.tree-item:hover');
        expect(css).toContain('.settings-select-trigger:hover');
        expect(css).toContain('.toggle-switch[data-checked="1"]');
        expect(css).toContain('var(--aimd-interactive-primary-hover)');
        expect(css).toContain('var(--aimd-text-on-primary)');
        expect(css).toContain('.settings-label strong {');
        expect(css).toContain('font-size: var(--_bookmarks-item-title-size);');
        expect(css).toContain('font-weight: var(--_bookmarks-item-title-weight);');
        expect(css).toContain('.settings-label p,');
        expect(css).toContain('font-size: var(--aimd-text-xs);');
        expect(css).toContain('.settings-select-trigger {');
        expect(css).toContain('.settings-number {');
        expect(css).toContain('.card-title {');
        expect(css).toContain('font-size: var(--_bookmarks-section-title-size);');
        expect(css).toContain('font-weight: var(--_bookmarks-section-title-weight);');
        expect(css).toContain('gap: var(--aimd-space-1);');
        expect(css).not.toContain('grid-template-columns: auto minmax(0, 1fr);');
        expect(css).toContain('.settings-label__icon {');
        expect(css).toContain('.tree-label--folder {');
        expect(css).toContain('.tree-label--bookmark {');
        expect(css).toContain('font-size: var(--_bookmarks-tree-title-size);');
        expect(css).toContain('.sponsor-section-label {');
        expect(css).toContain('font-size: var(--_bookmarks-section-title-size);');
        expect(css).toContain('font-weight: var(--_bookmarks-section-title-weight);');
        expect(css).toContain('.sponsor-brand-badge');
        expect(css).toContain('text-align: center;');
        expect(css).toContain('justify-items: center;');
        expect(css).toContain('max-width: 34ch;');
        expect(css).toContain('color-mix(in srgb, var(--aimd-border-strong)');
        expect(css).toContain('color-mix(in srgb, var(--aimd-bg-surface)');
    });

    it('keeps panel transient-ui dismissal generic instead of hard-coding child primitive selectors', () => {
        const source = fs.readFileSync(path.join(process.cwd(), 'src/ui/content/bookmarks/BookmarksPanel.ts'), 'utf8');

        expect(source).toContain('eventWithinTransientRoot(event)');
        expect(source).not.toContain("target.closest('.platform-dropdown')");
        expect(source).not.toContain("target.closest('.settings-select-shell')");
    });

    it('activates the real settings and sponsor panels inside the formal bookmarks panel shell', async () => {
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
            getPlatforms: vi.fn(() => ['All', 'ChatGPT']),
            getFolderCheckboxState: vi.fn(() => ({ checked: false, indeterminate: false })),
            setQuery: vi.fn(),
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
        const sponsorTabButton = shadow.querySelector<HTMLElement>('[data-action="set-bookmarks-tab"][data-tab="sponsor"]');
        const platformTrigger = shadow.querySelector<HTMLButtonElement>('.platform-dropdown__trigger');
        const bookmarksPanel = shadow.querySelector<HTMLElement>('.tab-panel--bookmarks');
        const settingsPanel = shadow.querySelector<HTMLElement>('.settings-panel');
        const sponsorPanel = shadow.querySelector<HTMLElement>('.sponsor-panel');

        expect(panelWindow).toBeTruthy();
        expect(settingsTabButton).toBeTruthy();
        expect(sponsorTabButton).toBeTruthy();
        expect(bookmarksPanel?.querySelector('.bookmarks-tab-content')).toBeTruthy();
        expect(bookmarksPanel?.querySelector('.toolbar-row--bookmarks')).toBeTruthy();
        expect(bookmarksPanel?.querySelector('.batch-bar')).toBeTruthy();
        expect(bookmarksPanel?.dataset.active).toBe('1');
        expect(settingsPanel?.dataset.active).toBe('0');
        expect(sponsorPanel?.dataset.active).toBe('0');
        expect(panelWindow?.querySelector('.panel-footer')).toBeNull();

        platformTrigger!.click();
        expect(shadow.querySelector('.platform-dropdown__menu')?.getAttribute('data-open')).toBe('1');

        settingsTabButton!.click();

        const refreshedSettingsPanel = shadow.querySelector<HTMLElement>('.settings-panel');
        const refreshedBookmarksPanel = shadow.querySelector<HTMLElement>('.tab-panel--bookmarks');
        const refreshedSponsorPanel = shadow.querySelector<HTMLElement>('.sponsor-panel');

        expect(refreshedSettingsPanel?.dataset.active).toBe('1');
        expect(refreshedBookmarksPanel?.dataset.active).toBe('0');
        expect(refreshedSponsorPanel?.dataset.active).toBe('0');
        expect(shadow.querySelector('.aimd-panel-title')?.textContent).toBe('Settings');
        expect(refreshedSettingsPanel?.querySelector('.aimd-settings')).toBeTruthy();
        expect(refreshedSettingsPanel?.querySelector('.settings-card')).toBeTruthy();
        expect(refreshedSettingsPanel?.querySelector('.storage-fill')).toBeTruthy();
        expect(refreshedSettingsPanel?.textContent).toContain('50%');
        expect(refreshedSettingsPanel?.querySelectorAll('.settings-select-trigger').length).toBeGreaterThanOrEqual(2);
        expect(refreshedSettingsPanel?.querySelector('.settings-select')).toBeNull();
        expect(refreshedSettingsPanel?.querySelector('[data-role="settings-folding-count"]')).toBeNull();
        const platformLabels = Array.from(refreshedSettingsPanel?.querySelectorAll<HTMLElement>('.settings-card:first-child .settings-label strong') ?? []);
        const deepseekLabel = platformLabels.find((node) => node.textContent?.includes('Deep'));
        expect(deepseekLabel?.textContent).toContain('DeepSeek');
        expect(deepseekLabel?.textContent).not.toContain('Deepseek');
        const platformIconHtml = platformLabels.map((node) => node.innerHTML).join('\n');
        expect(platformIconHtml).toContain('ChatGPT');
        expect(platformIconHtml).toContain('Gemini');
        expect(platformIconHtml).toContain('Claude');
        expect(platformIconHtml).toContain('DeepSeek');
        expect(refreshedSettingsPanel?.querySelectorAll('.settings-card:first-child .settings-label__icon').length).toBe(4);
        expect(shadow.querySelector('.platform-dropdown__menu')?.getAttribute('data-open')).toBe('0');

        shadow.querySelector<HTMLButtonElement>('[data-action="toggle-settings-menu"][data-menu="folding-mode"]')!.click();
        shadow.querySelector<HTMLElement>('[data-action="settings-select-option"][data-menu="folding-mode"][data-value="keep_last_n"]')!.click();
        await flushUi();

        const keepLastNPanel = shadow.querySelector<HTMLElement>('.settings-panel');
        expect(keepLastNPanel?.querySelector('[data-role="settings-folding-count"]')).toBeTruthy();
        expect(settingsClientRpc.setCategory).toHaveBeenCalledWith('chatgpt', { foldingMode: 'keep_last_n' });

        sponsorTabButton!.click();

        const refreshedSponsorTab = shadow.querySelector<HTMLElement>('.sponsor-panel');
        const refreshedBookmarksTab = shadow.querySelector<HTMLElement>('.tab-panel--bookmarks');
        const refreshedSettingsTab = shadow.querySelector<HTMLElement>('.settings-panel');

        expect(refreshedSponsorTab?.dataset.active).toBe('1');
        expect(refreshedBookmarksTab?.dataset.active).toBe('0');
        expect(refreshedSettingsTab?.dataset.active).toBe('0');
        expect(shadow.querySelector('.aimd-panel-title')?.textContent).toBe('Sponsor');
        expect(refreshedSponsorTab?.querySelector('.aimd-sponsor')).toBeTruthy();
        expect(refreshedSponsorTab?.querySelector('.sponsor-card')).toBeTruthy();
        expect(refreshedSponsorTab?.querySelector('.sponsor-qr-card')).toBeTruthy();
        expect(refreshedSponsorTab?.querySelector('.sponsor-celebration')).toBeTruthy();
        expect(refreshedSponsorTab?.querySelector('.sponsor-title-row')).toBeTruthy();
        expect(refreshedSponsorTab?.querySelector('.sponsor-brand-badge')).toBeTruthy();
        expect(refreshedSponsorTab?.querySelector('.sponsor-brand-mark')).toBeTruthy();
        const sponsorCta = refreshedSponsorTab?.querySelector<HTMLAnchorElement>('[data-action="sponsor-github"]');
        expect(sponsorCta?.tagName).toBe('A');
        expect(sponsorCta?.href).toBe('https://github.com/zhaoliangbin42/AI-MarkDone');
        expect(sponsorCta?.target).toBe('_blank');
        expect(sponsorCta?.rel).toContain('noopener');
        expect(sponsorCta?.rel).toContain('noreferrer');
        expect(refreshedSponsorTab?.textContent).toContain('Support Development');
        expect(refreshedSponsorTab?.textContent).toContain('AI-MarkDone is open source. Star us on GitHub.');
        expect(refreshedSponsorTab?.textContent).toContain('If this project helps you');
        expect(refreshedSponsorTab?.textContent).toContain('Support the developer with a coffee');
        expect(refreshedSponsorTab?.textContent).not.toContain('Donate');

        panel.hide();
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
            getPlatforms: vi.fn(() => ['All', 'ChatGPT']),
            getFolderCheckboxState: vi.fn(() => ({ checked: false, indeterminate: false })),
            setQuery: vi.fn(),
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
        ).toEqual(['书签', '设置', '赞助']);
        expect(shadow.querySelector<HTMLElement>('.settings-panel')?.textContent).toContain('存储占用');

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
            getPlatforms: vi.fn(() => ['All', 'ChatGPT']),
            getFolderCheckboxState: vi.fn(() => ({ checked: false, indeterminate: false })),
            setQuery: vi.fn(),
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
            getPlatforms: vi.fn(() => ['All', 'ChatGPT']),
            getFolderCheckboxState: vi.fn(() => ({ checked: false, indeterminate: false })),
            setQuery: vi.fn(),
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
        expect(exportButton?.dataset.tooltip).toBe('Export all bookmarks');

        exportButton?.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
        await Promise.resolve();
        await flushAnimationFrame();

        expect(shadow.querySelector('.aimd-tooltip__body')?.textContent).toBe('Export all bookmarks');

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
            getPlatforms: vi.fn(() => ['All', 'ChatGPT']),
            getFolderCheckboxState: vi.fn(() => ({ checked: false, indeterminate: false })),
            setQuery: vi.fn(),
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
        shadow.querySelector<HTMLButtonElement>('[data-action="toggle-settings-menu"][data-menu="folding-mode"]')!.click();
        shadow.querySelector<HTMLElement>('[data-action="settings-select-option"][data-menu="folding-mode"][data-value="keep_last_n"]')!.click();
        await flushUi();

        expect(shadow.querySelector('.settings-number-field')?.classList.contains('aimd-field-shell')).toBe(true);
        expect(shadow.querySelector<HTMLInputElement>('.settings-number')?.classList.contains('aimd-field-control')).toBe(true);

        panel.hide();
    });

    it('uses the shipped DeepSeek official icon in the platform selector even when the platform value casing differs', async () => {
        const snapshot = {
            vm: {
                query: '',
                platform: 'deepseek',
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
            getPlatforms: vi.fn(() => ['All', 'deepseek']),
            getFolderCheckboxState: vi.fn(() => ({ checked: false, indeterminate: false })),
            setQuery: vi.fn(),
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
        const triggerIconHtml = shadow.querySelector('.platform-dropdown__trigger .platform-option-icon')?.innerHTML ?? '';

        shadow.querySelector<HTMLButtonElement>('.platform-dropdown__trigger')!.click();
        const option = Array.from(shadow.querySelectorAll<HTMLElement>('.platform-dropdown__option'))
            .find((node) => node.querySelector('.platform-dropdown__label')?.textContent === 'deepseek');
        const optionIconHtml = option?.querySelector('.platform-option-icon')?.innerHTML ?? '';

        expect(triggerIconHtml).toContain('DeepSeek');
        expect(triggerIconHtml).toContain('#4D6BFE');
        expect(optionIconHtml).toContain('DeepSeek');
        expect(optionIconHtml).toContain('#4D6BFE');

        panel.hide();
    });

    it('closes the platform menu when clicking blank space outside the dropdown', async () => {
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
            getPlatforms: vi.fn(() => ['All', 'ChatGPT', 'DeepSeek']),
            getFolderCheckboxState: vi.fn(() => ({ checked: false, indeterminate: false })),
            setQuery: vi.fn(),
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
        shadow.querySelector<HTMLButtonElement>('.platform-dropdown__trigger')!.click();
        expect(shadow.querySelector('.platform-dropdown__menu')?.getAttribute('data-open')).toBe('1');

        shadow.querySelector<HTMLElement>('.tab-panel--bookmarks')!
            .dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, composed: true }));

        expect(shadow.querySelector('.platform-dropdown__menu')?.getAttribute('data-open')).toBe('0');
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
            getPlatforms: vi.fn(() => ['All', 'ChatGPT']),
            getFolderCheckboxState: vi.fn(() => ({ checked: false, indeterminate: false })),
            setQuery: vi.fn(),
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
            getPlatforms: vi.fn(() => ['All', 'ChatGPT']),
            getFolderCheckboxState: vi.fn(() => ({ checked: false, indeterminate: false })),
            setQuery: vi.fn(),
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
        const trigger = shadow.querySelector<HTMLButtonElement>('[data-action="toggle-settings-menu"][data-menu="folding-mode"]')!;

        trigger.click();
        expect(shadow.querySelector('.settings-select-menu')?.getAttribute('data-open')).toBe('1');

        trigger.click();
        expect(shadow.querySelector('.settings-select-menu')?.getAttribute('data-open')).toBe('0');
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
            getPlatforms: vi.fn(() => ['All', 'ChatGPT']),
            getFolderCheckboxState: vi.fn(() => ({ checked: false, indeterminate: false })),
            setQuery: vi.fn(),
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
        expect(shadow.querySelector('.aimd-panel-title')?.textContent).toBe('设置');
        expect(shadow.querySelector<HTMLInputElement>('[data-role="bookmark-query"]')?.getAttribute('placeholder')).toBe('搜索书签');

        panel.hide();
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
            getPlatforms: vi.fn(() => ['All', 'ChatGPT']),
            getFolderCheckboxState: vi.fn(() => ({ checked: false, indeterminate: false })),
            setQuery: vi.fn(),
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

    it('keeps the mock tree interactions intact for folder expand and folder checkbox selection', async () => {
        const bookmark = {
            title: 'Saved thread',
            urlWithoutProtocol: 'chat.openai.com/c/123',
            position: 8,
            createdAt: Date.now(),
            platform: 'ChatGPT',
        } as any;

        let currentSnapshot = {
            vm: {
                query: '',
                platform: 'All',
                bookmarks: [bookmark],
                folderTree: [{
                    folder: { name: 'Import', path: 'Import' },
                    bookmarks: [bookmark],
                    children: [],
                    isExpanded: false,
                }],
                selectedFolderPath: null,
                sortMode: 'time-desc',
            },
            folders: [],
            folderPaths: ['Import'],
            selectedKeys: new Set<string>(),
            previewId: null,
            status: 'Ready',
        };

        let emitSnapshot: ((snapshot: any) => void) | null = null;
        const toggleFolderSelection = vi.fn((path: string) => {
            currentSnapshot = {
                ...currentSnapshot,
                selectedKeys: new Set([`folder:${path}`, 'bm:chat.openai.com/c/123:8']),
            };
            emitSnapshot?.(currentSnapshot);
        });
        const toggleFolderExpanded = vi.fn((path: string) => {
            currentSnapshot = {
                ...currentSnapshot,
                vm: {
                    ...currentSnapshot.vm,
                    folderTree: currentSnapshot.vm.folderTree.map((node) => (
                        node.folder.path === path
                            ? { ...node, isExpanded: !node.isExpanded }
                            : node
                    )),
                },
            };
            emitSnapshot?.(currentSnapshot);
        });

        const controller = {
            subscribe: vi.fn((fn: (snap: any) => void) => {
                emitSnapshot = fn;
                fn(currentSnapshot);
                return () => {};
            }),
            refreshAll: vi.fn(async () => undefined),
            refreshPositionsForUrl: vi.fn(async () => undefined),
            refreshUiState: vi.fn(async () => undefined),
            getTheme: vi.fn(() => 'light'),
            getPlatforms: vi.fn(() => ['All', 'ChatGPT']),
            getFolderCheckboxState: vi.fn((path: string) => ({
                checked: currentSnapshot.selectedKeys.has(`folder:${path}`),
                indeterminate: false,
            })),
            setQuery: vi.fn(),
            setPlatform: vi.fn(),
            setSortMode: vi.fn(),
            toggleFolderExpanded,
            toggleFolderSelection,
            toggleBookmarkSelection: vi.fn(),
            selectFolder: vi.fn(),
            getBookmarkRowSubtitle: vi.fn(() => 'ChatGPT - today'),
            exportAll: vi.fn(async () => ({ ok: true, data: { payload: {} } })),
            setPanelStatus: vi.fn(),
        } as any;

        const panel = new BookmarksPanel(controller, { show: vi.fn(), hide: vi.fn() } as any);
        await panel.show();

        const shadow = document.getElementById('aimd-bookmarks-panel-host')!.shadowRoot!;
        const folderMain = shadow.querySelector<HTMLElement>('.tree-main--folder');
        const folderCaret = shadow.querySelector<HTMLElement>('.tree-caret');
        expect(folderMain).toBeTruthy();
        expect(folderCaret?.querySelector('svg')).toBeTruthy();

        folderMain!.click();

        expect(controller.selectFolder).toHaveBeenCalledWith('Import');
        expect(toggleFolderExpanded).not.toHaveBeenCalled();

        folderCaret!.click();

        const expandedChildren = shadow.querySelector<HTMLElement>('.tree-children');
        expect(toggleFolderExpanded).toHaveBeenCalledWith('Import');
        expect(expandedChildren?.dataset.expanded).toBe('1');

        const folderCheckbox = shadow.querySelector<HTMLInputElement>('.tree-item--folder .tree-check');
        expect(folderCheckbox).toBeTruthy();

        folderCheckbox!.checked = true;
        folderCheckbox!.dispatchEvent(new Event('change', { bubbles: true }));

        const refreshedCheckbox = shadow.querySelector<HTMLInputElement>('.tree-item--folder .tree-check');
        expect(toggleFolderSelection).toHaveBeenCalledWith('Import');
        expect(refreshedCheckbox?.checked).toBe(true);

        panel.hide();
    });

    it('clears the persisted folder scope when clicking empty tree space', async () => {
        await setLocale('en');
        const snapshot = {
            vm: {
                query: '',
                platform: 'All',
                bookmarks: [],
                folderTree: [{
                    folder: { name: 'test', path: 'test' },
                    bookmarks: [],
                    children: [{
                        folder: { name: 'child', path: 'test/child' },
                        bookmarks: [],
                        children: [],
                        isExpanded: false,
                    }],
                    isExpanded: false,
                }],
                selectedFolderPath: 'test/child',
                sortMode: 'time-desc',
            },
            folders: [],
            folderPaths: ['test', 'test/child'],
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
            getPlatforms: vi.fn(() => ['All', 'ChatGPT']),
            getFolderCheckboxState: vi.fn(() => ({ checked: false, indeterminate: false })),
            setQuery: vi.fn(),
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
        const treePanel = shadow.querySelector<HTMLElement>('.tree-panel');
        expect(treePanel).toBeTruthy();
        expect(shadow.querySelector<HTMLElement>('.tree-item--folder[data-path="test"]')?.getAttribute('aria-expanded')).toBe('false');

        treePanel!.dispatchEvent(new MouseEvent('click', { bubbles: true }));

        expect(controller.selectFolder).toHaveBeenCalledWith(null);

        panel.hide();
    });

    it('renders a visible folder caret indicator even for empty folders', async () => {
        const currentSnapshot = {
            vm: {
                query: '',
                platform: 'All',
                bookmarks: [],
                folderTree: [{
                    folder: { name: 'Empty', path: 'Empty' },
                    bookmarks: [],
                    children: [],
                    isExpanded: false,
                }],
                selectedFolderPath: null,
                sortMode: 'time-desc',
            },
            folders: [],
            folderPaths: ['Empty'],
            selectedKeys: new Set<string>(),
            previewId: null,
            status: 'Ready',
        };

        const controller = {
            subscribe: vi.fn((fn: (snap: any) => void) => {
                fn(currentSnapshot);
                return () => {};
            }),
            refreshAll: vi.fn(async () => undefined),
            refreshPositionsForUrl: vi.fn(async () => undefined),
            refreshUiState: vi.fn(async () => undefined),
            getTheme: vi.fn(() => 'light'),
            getPlatforms: vi.fn(() => ['All', 'ChatGPT']),
            getFolderCheckboxState: vi.fn(() => ({ checked: false, indeterminate: false })),
            setQuery: vi.fn(),
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
        const folderCaret = shadow.querySelector<HTMLElement>('.tree-item--folder .tree-caret');
        expect(folderCaret).toBeTruthy();
        expect(folderCaret?.querySelector('svg')).toBeTruthy();

        panel.hide();
    });

    it('opens the reader panel when a bookmark row is clicked and keeps the folder count visible', async () => {
        const bookmark = {
            title: 'Saved thread',
            userMessage: 'Prompt',
            aiResponse: 'Answer',
            url: 'https://chat.openai.com/c/123',
            urlWithoutProtocol: 'chat.openai.com/c/123',
            folderPath: 'Import',
            position: 8,
            timestamp: new Date('2026-03-15T08:00:00.000Z').getTime(),
            createdAt: new Date('2026-03-15T08:00:00.000Z').getTime(),
            platform: 'ChatGPT',
        } as any;

        const snapshot = {
            vm: {
                query: '',
                platform: 'All',
                bookmarks: [bookmark],
                folderTree: [{
                    folder: { name: 'Import', path: 'Import' },
                    bookmarks: [bookmark],
                    children: [],
                    isExpanded: true,
                }],
                selectedFolderPath: null,
                sortMode: 'time-desc',
            },
            folders: [],
            folderPaths: ['Import'],
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
            getPlatforms: vi.fn(() => ['All', 'ChatGPT']),
            getFolderCheckboxState: vi.fn(() => ({ checked: false, indeterminate: false })),
            setQuery: vi.fn(),
            setPlatform: vi.fn(),
            setSortMode: vi.fn(),
            toggleFolderExpanded: vi.fn(),
            toggleFolderSelection: vi.fn(),
            toggleBookmarkSelection: vi.fn(),
            selectFolder: vi.fn(),
            getBookmarkRowSubtitle: vi.fn(() => 'ChatGPT · Import · 2026/03/15 16:00:00'),
            exportAll: vi.fn(async () => ({ ok: true, data: { payload: {} } })),
            setPanelStatus: vi.fn(),
            goToBookmark: vi.fn(async () => undefined),
        } as any;

        const readerPanel = {
            show: vi.fn(async () => undefined),
            hide: vi.fn(),
        } as any;

        const panel = new BookmarksPanel(controller, readerPanel);
        await panel.show();

        const shadow = document.getElementById('aimd-bookmarks-panel-host')!.shadowRoot!;
        const count = shadow.querySelector<HTMLElement>('.tree-item--folder .tree-count');
        const subtitle = shadow.querySelector<HTMLElement>('.tree-main--bookmark .tree-subtitle');
        const titleMeta = shadow.querySelector<HTMLElement>('.tree-main--bookmark .tree-title-meta');
        expect(count?.textContent?.trim()).toBe('1');
        expect(titleMeta).toBeTruthy();
        expect(subtitle?.textContent).toContain('2026');
        expect(subtitle?.textContent).not.toContain('ChatGPT');
        expect(subtitle?.textContent).not.toContain('Import');

        shadow.querySelector<HTMLElement>('.tree-main--bookmark')!.click();

        expect(readerPanel.show).toHaveBeenCalledTimes(1);
        expect(controller.goToBookmark).not.toHaveBeenCalled();
        const options = readerPanel.show.mock.calls[0][3];
        expect(options.profile).toBe('bookmark-preview');
        expect(options.actions).toBeUndefined();

        panel.hide();
    });

    it('renders the platform icon for each bookmark row and uses the shipped DeepSeek icon asset', async () => {
        const bookmark = {
            title: 'DeepSeek thread',
            userMessage: 'Prompt',
            aiResponse: 'Answer',
            url: 'https://chat.deepseek.com/a',
            urlWithoutProtocol: 'chat.deepseek.com/a',
            folderPath: 'Research',
            position: 3,
            timestamp: new Date('2026-03-15T10:00:00.000Z').getTime(),
            platform: 'DeepSeek',
        } as any;

        const snapshot = {
            vm: {
                query: '',
                platform: 'All',
                bookmarks: [bookmark],
                folderTree: [{
                    folder: { name: 'Research', path: 'Research' },
                    bookmarks: [bookmark],
                    children: [],
                    isExpanded: true,
                }],
                selectedFolderPath: null,
                sortMode: 'time-desc',
            },
            folders: [],
            folderPaths: ['Research'],
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
            getPlatforms: vi.fn(() => ['All', 'DeepSeek']),
            getFolderCheckboxState: vi.fn(() => ({ checked: false, indeterminate: false })),
            setQuery: vi.fn(),
            setPlatform: vi.fn(),
            setSortMode: vi.fn(),
            toggleFolderExpanded: vi.fn(),
            toggleFolderSelection: vi.fn(),
            toggleBookmarkSelection: vi.fn(),
            selectFolder: vi.fn(),
            getBookmarkRowSubtitle: vi.fn(() => 'DeepSeek · 2026/3/15'),
            exportAll: vi.fn(async () => ({ ok: true, data: { payload: {} } })),
            setPanelStatus: vi.fn(),
        } as any;

        const panel = new BookmarksPanel(controller, { show: vi.fn(), hide: vi.fn() } as any);
        await panel.show();

        const shadow = document.getElementById('aimd-bookmarks-panel-host')!.shadowRoot!;
        const iconSlot = shadow.querySelector<HTMLElement>('.tree-item--bookmark .tree-icon-slot');
        expect(iconSlot?.innerHTML).toContain('DeepSeek');

        panel.hide();
    });

    it('adds bookmark move to the hover actions and sends the correct signal', async () => {
        const bookmark = {
            title: 'Saved thread',
            userMessage: 'Prompt',
            aiResponse: 'Answer',
            url: 'https://chat.openai.com/c/123',
            urlWithoutProtocol: 'chat.openai.com/c/123',
            folderPath: 'Import',
            position: 8,
            timestamp: new Date('2026-03-15T08:00:00.000Z').getTime(),
            platform: 'ChatGPT',
        } as any;

        const snapshot = {
            vm: {
                query: '',
                platform: 'All',
                bookmarks: [bookmark],
                folderTree: [{
                    folder: { name: 'Import', path: 'Import' },
                    bookmarks: [bookmark],
                    children: [],
                    isExpanded: true,
                }],
                selectedFolderPath: null,
                sortMode: 'time-desc',
            },
            folders: [],
            folderPaths: ['Import'],
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
            getPlatforms: vi.fn(() => ['All', 'ChatGPT']),
            getFolderCheckboxState: vi.fn(() => ({ checked: false, indeterminate: false })),
            setQuery: vi.fn(),
            setPlatform: vi.fn(),
            setSortMode: vi.fn(),
            toggleFolderExpanded: vi.fn(),
            toggleFolderSelection: vi.fn(),
            toggleBookmarkSelection: vi.fn(),
            selectFolder: vi.fn(),
            getBookmarkRowSubtitle: vi.fn(() => 'ChatGPT · 2026/3/15'),
            exportAll: vi.fn(async () => ({ ok: true, data: { payload: {} } })),
            setPanelStatus: vi.fn(),
            moveBookmark: vi.fn(async () => ({ ok: true })),
        } as any;

        const pickerSpy = vi.spyOn(bookmarkSaveDialog, 'open').mockResolvedValue({ ok: true, title: '', folderPath: 'Archive' });
        const panel = new BookmarksPanel(controller, { show: vi.fn(), hide: vi.fn() } as any);
        await panel.show();

        const shadow = document.getElementById('aimd-bookmarks-panel-host')!.shadowRoot!;
        const actions = Array.from(shadow.querySelectorAll<HTMLElement>('.tree-item--bookmark .tree-actions .icon-btn'));
        const labels = actions.map((button) => button.getAttribute('aria-label'));
        expect(labels).toEqual(['Open conversation', 'Copy', 'Move bookmark', 'Delete']);

        actions[2]!.click();
        await flushUi();

        expect(controller.moveBookmark).toHaveBeenCalledWith(bookmark, 'Archive');
        expect(pickerSpy).toHaveBeenCalled();
        pickerSpy.mockRestore();
        panel.hide();
    });

    it('dispatches the bookmark row hover actions through the formal panel click seam', async () => {
        const bookmark = {
            title: 'Saved thread',
            userMessage: 'Prompt',
            aiResponse: 'Answer',
            url: 'https://chat.openai.com/c/123',
            urlWithoutProtocol: 'chat.openai.com/c/123',
            folderPath: 'Import',
            position: 8,
            timestamp: new Date('2026-03-15T08:00:00.000Z').getTime(),
            createdAt: new Date('2026-03-15T08:00:00.000Z').getTime(),
            platform: 'ChatGPT',
        } as any;

        const snapshot = {
            vm: {
                query: '',
                platform: 'All',
                bookmarks: [bookmark],
                folderTree: [{
                    folder: { name: 'Import', path: 'Import' },
                    bookmarks: [bookmark],
                    children: [],
                    isExpanded: true,
                }],
                selectedFolderPath: null,
                sortMode: 'time-desc',
            },
            folders: [],
            folderPaths: ['Import'],
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
            getPlatforms: vi.fn(() => ['All', 'ChatGPT']),
            getFolderCheckboxState: vi.fn(() => ({ checked: false, indeterminate: false })),
            setQuery: vi.fn(),
            setPlatform: vi.fn(),
            setSortMode: vi.fn(),
            toggleFolderExpanded: vi.fn(),
            toggleFolderSelection: vi.fn(),
            toggleBookmarkSelection: vi.fn(),
            selectFolder: vi.fn(),
            getBookmarkRowSubtitle: vi.fn(() => 'ChatGPT · 2026/3/15'),
            exportAll: vi.fn(async () => ({ ok: true, data: { payload: {} } })),
            setPanelStatus: vi.fn(),
            goToBookmark: vi.fn(async () => undefined),
            copyBookmarkMarkdown: vi.fn(async () => undefined),
            moveBookmark: vi.fn(async () => ({ ok: true })),
            deleteBookmark: vi.fn(async () => undefined),
        } as any;

        const pickerSpy = vi.spyOn(bookmarkSaveDialog, 'open').mockResolvedValue({ ok: true, title: '', folderPath: 'Archive' });
        const panel = new BookmarksPanel(controller, { show: vi.fn(), hide: vi.fn() } as any);
        await panel.show();

        const shadow = document.getElementById('aimd-bookmarks-panel-host')!.shadowRoot!;
        const buttons = Array.from(shadow.querySelectorAll<HTMLElement>('.tree-item--bookmark .tree-actions .icon-btn'));

        buttons[0]!.click();
        buttons[1]!.click();
        buttons[2]!.click();
        await flushUi();
        buttons[3]!.click();
        await flushUi();
        shadow.querySelector<HTMLButtonElement>('[data-action="modal-confirm"]')!.click();
        await flushUi();

        expect(controller.goToBookmark).toHaveBeenCalledWith(bookmark);
        expect(controller.copyBookmarkMarkdown).toHaveBeenCalledWith(bookmark);
        expect(controller.moveBookmark).toHaveBeenCalledWith(bookmark, 'Archive');
        expect(controller.deleteBookmark).toHaveBeenCalledWith(bookmark);

        pickerSpy.mockRestore();
        panel.hide();
    });

    it('keeps bookmark row actions working when the rendered tree contains items outside the filtered vm.bookmarks list', async () => {
        const visibleTreeBookmark = {
            title: 'Scoped tree item',
            userMessage: 'Prompt',
            aiResponse: 'Answer',
            url: 'https://chat.openai.com/c/scoped',
            urlWithoutProtocol: 'chat.openai.com/c/scoped',
            folderPath: 'Import',
            position: 3,
            timestamp: new Date('2026-03-15T08:00:00.000Z').getTime(),
            createdAt: new Date('2026-03-15T08:00:00.000Z').getTime(),
            platform: 'ChatGPT',
        } as any;
        const filteredVmBookmark = {
            title: 'Different scoped item',
            userMessage: 'Prompt B',
            aiResponse: 'Answer B',
            url: 'https://chat.openai.com/c/other',
            urlWithoutProtocol: 'chat.openai.com/c/other',
            folderPath: 'Elsewhere',
            position: 9,
            timestamp: new Date('2026-03-15T09:00:00.000Z').getTime(),
            createdAt: new Date('2026-03-15T09:00:00.000Z').getTime(),
            platform: 'ChatGPT',
        } as any;

        const snapshot = {
            vm: {
                query: '',
                platform: 'All',
                bookmarks: [filteredVmBookmark],
                folderTree: [{
                    folder: { name: 'Import', path: 'Import' },
                    bookmarks: [visibleTreeBookmark],
                    children: [],
                    isExpanded: true,
                }],
                selectedFolderPath: 'Elsewhere',
                sortMode: 'time-desc',
            },
            folders: [],
            folderPaths: ['Import', 'Elsewhere'],
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
            getPlatforms: vi.fn(() => ['All', 'ChatGPT']),
            getFolderCheckboxState: vi.fn(() => ({ checked: false, indeterminate: false })),
            setQuery: vi.fn(),
            setPlatform: vi.fn(),
            setSortMode: vi.fn(),
            toggleFolderExpanded: vi.fn(),
            toggleFolderSelection: vi.fn(),
            toggleBookmarkSelection: vi.fn(),
            selectFolder: vi.fn(),
            getBookmarkRowSubtitle: vi.fn(() => 'ChatGPT · 2026/3/15'),
            exportAll: vi.fn(async () => ({ ok: true, data: { payload: {} } })),
            setPanelStatus: vi.fn(),
            goToBookmark: vi.fn(async () => undefined),
            copyBookmarkMarkdown: vi.fn(async () => undefined),
            moveBookmark: vi.fn(async () => ({ ok: true })),
            deleteBookmark: vi.fn(async () => undefined),
        } as any;

        const pickerSpy = vi.spyOn(bookmarkSaveDialog, 'open').mockResolvedValue({ ok: true, title: '', folderPath: 'Archive' });
        const panel = new BookmarksPanel(controller, { show: vi.fn(), hide: vi.fn() } as any);
        await panel.show();

        const shadow = document.getElementById('aimd-bookmarks-panel-host')!.shadowRoot!;
        const buttons = Array.from(shadow.querySelectorAll<HTMLElement>('.tree-item--bookmark .tree-actions .icon-btn'));

        expect(buttons).toHaveLength(4);

        buttons[0]!.click();
        buttons[1]!.click();
        buttons[2]!.click();
        await flushUi();
        buttons[3]!.click();
        await flushUi();
        shadow.querySelector<HTMLButtonElement>('[data-action="modal-confirm"]')!.click();
        await flushUi();

        expect(controller.goToBookmark).toHaveBeenCalledWith(visibleTreeBookmark);
        expect(controller.copyBookmarkMarkdown).toHaveBeenCalledWith(visibleTreeBookmark);
        expect(controller.moveBookmark).toHaveBeenCalledWith(visibleTreeBookmark, 'Archive');
        expect(controller.deleteBookmark).toHaveBeenCalledWith(visibleTreeBookmark);

        pickerSpy.mockRestore();
        panel.hide();
    });

    it('routes create-folder and delete-bookmark through the shared modal host instead of native browser dialogs', async () => {
        const promptSpy = vi.spyOn(window, 'prompt');
        const confirmSpy = vi.spyOn(window, 'confirm');
        const bookmark = {
            title: 'Saved thread',
            userMessage: 'Prompt',
            aiResponse: 'Answer',
            url: 'https://chat.openai.com/c/123',
            urlWithoutProtocol: 'chat.openai.com/c/123',
            folderPath: 'Import',
            position: 8,
            timestamp: new Date('2026-03-15T08:00:00.000Z').getTime(),
            platform: 'ChatGPT',
        } as any;

        const snapshot = {
            vm: {
                query: '',
                platform: 'All',
                bookmarks: [bookmark],
                folderTree: [{
                    folder: { name: 'Import', path: 'Import' },
                    bookmarks: [bookmark],
                    children: [],
                    isExpanded: true,
                }],
                selectedFolderPath: null,
                sortMode: 'time-desc',
            },
            folders: [],
            folderPaths: ['Import'],
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
            getPlatforms: vi.fn(() => ['All', 'ChatGPT']),
            getFolderCheckboxState: vi.fn(() => ({ checked: false, indeterminate: false })),
            setQuery: vi.fn(),
            setPlatform: vi.fn(),
            setSortMode: vi.fn(),
            toggleFolderExpanded: vi.fn(),
            toggleFolderSelection: vi.fn(),
            toggleBookmarkSelection: vi.fn(),
            selectFolder: vi.fn(),
            getBookmarkRowSubtitle: vi.fn(() => 'ChatGPT · 2026/3/15'),
            exportAll: vi.fn(async () => ({ ok: true, data: { payload: {} } })),
            setPanelStatus: vi.fn(),
            createFolder: vi.fn(async () => ({ ok: true })),
            deleteBookmark: vi.fn(async () => undefined),
        } as any;

        const panel = new BookmarksPanel(controller, { show: vi.fn(), hide: vi.fn() } as any);
        await panel.show();

        const shadow = document.getElementById('aimd-bookmarks-panel-host')!.shadowRoot!;
        shadow.querySelector<HTMLElement>('[data-action="create-folder"]')!.click();
        await flushUi();

        const createInput = shadow.querySelector<HTMLInputElement>('.mock-modal__input');
        expect(createInput).toBeTruthy();
        createInput!.value = 'Archive';
        shadow.querySelector<HTMLButtonElement>('[data-action="modal-confirm"]')!.click();
        shadow.querySelector<HTMLElement>('.mock-modal')?.dispatchEvent(new Event('animationend', { bubbles: true }));
        await flushUi();

        expect(controller.createFolder).toHaveBeenCalledWith('Archive');
        expect(promptSpy).not.toHaveBeenCalled();

        const deleteButton = shadow.querySelector<HTMLElement>('.tree-item--bookmark .tree-actions .icon-btn--danger');
        deleteButton!.click();
        await flushUi();
        shadow.querySelector<HTMLButtonElement>('[data-action="modal-confirm"]')!.click();
        shadow.querySelector<HTMLElement>('.mock-modal')?.dispatchEvent(new Event('animationend', { bubbles: true }));
        await flushUi();

        expect(controller.deleteBookmark).toHaveBeenCalledWith(bookmark);
        expect(confirmSpy).not.toHaveBeenCalled();

        promptSpy.mockRestore();
        confirmSpy.mockRestore();
        panel.hide();
    });

    it('shows an import merge review modal after importing a bookmark file through the panel', async () => {
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
            getPlatforms: vi.fn(() => ['All', 'ChatGPT']),
            getFolderCheckboxState: vi.fn(() => ({ checked: false, indeterminate: false })),
            setQuery: vi.fn(),
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
                data: { imported: 3, skippedDuplicates: 1, renamed: 2, warnings: ['Used fallback folder'], folderCreateFailures: 1 },
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
        expect(shadow.textContent).toContain('Used fallback folder');

        panel.hide();
    });

    it('uses the bookmark folder picker for moving folders instead of a free-form prompt', async () => {
        const promptSpy = vi.spyOn(window, 'prompt');
        const pickerSpy = vi.spyOn(bookmarkSaveDialog, 'open').mockResolvedValue({ ok: true, title: '', folderPath: 'Archive' });
        const snapshot = {
            vm: {
                query: '',
                platform: 'All',
                bookmarks: [],
                folderTree: [{
                    folder: { name: 'Import', path: 'Import' },
                    bookmarks: [],
                    children: [],
                    isExpanded: true,
                }],
                selectedFolderPath: null,
                sortMode: 'time-desc',
            },
            folders: [],
            folderPaths: ['Import', 'Archive'],
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
            getPlatforms: vi.fn(() => ['All', 'ChatGPT']),
            getFolderCheckboxState: vi.fn(() => ({ checked: false, indeterminate: false })),
            setQuery: vi.fn(),
            setPlatform: vi.fn(),
            setSortMode: vi.fn(),
            toggleFolderExpanded: vi.fn(),
            toggleFolderSelection: vi.fn(),
            toggleBookmarkSelection: vi.fn(),
            selectFolder: vi.fn(),
            getBookmarkRowSubtitle: vi.fn(() => ''),
            exportAll: vi.fn(async () => ({ ok: true, data: { payload: {} } })),
            moveFolder: vi.fn(async () => ({ ok: true })),
            setPanelStatus: vi.fn(),
        } as any;

        const panel = new BookmarksPanel(controller, { show: vi.fn(), hide: vi.fn() } as any);
        await panel.show();

        const shadow = document.getElementById('aimd-bookmarks-panel-host')!.shadowRoot!;
        shadow.querySelector<HTMLElement>('.tree-item--folder [data-action="move-folder"]')!.click();
        await flushUi();

        expect(pickerSpy).toHaveBeenCalled();
        expect(controller.moveFolder).toHaveBeenCalledWith('Import', 'Archive');
        expect(promptSpy).not.toHaveBeenCalled();

        promptSpy.mockRestore();
        pickerSpy.mockRestore();
        panel.hide();
    });

    it('keeps the batch clear button at the far right of the bottom action bar', async () => {
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
            selectedKeys: new Set<string>(['bm:chat.openai.com/c/demo:1']),
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
            getPlatforms: vi.fn(() => ['All', 'ChatGPT']),
            getFolderCheckboxState: vi.fn(() => ({ checked: false, indeterminate: false })),
            setQuery: vi.fn(),
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
        const actions = Array.from(shadow.querySelectorAll<HTMLElement>('.batch-actions .icon-btn'));
        const labels = actions.map((button) => button.getAttribute('aria-label'));

        expect(labels[labels.length - 1]).toBe('Clear selection');

        panel.hide();
    });

    it('virtualizes very large bookmark trees instead of mounting every row at once', async () => {
        const bookmarks = Array.from({ length: 1200 }, (_, index) => ({
            title: `Bookmark ${index + 1}`,
            userMessage: `Prompt ${index + 1}`,
            aiResponse: `Answer ${index + 1}`,
            url: `https://chat.openai.com/c/${index + 1}`,
            urlWithoutProtocol: `chat.openai.com/c/${index + 1}`,
            folderPath: 'Import',
            position: index + 1,
            timestamp: new Date('2026-03-15T08:00:00.000Z').getTime() + index,
            createdAt: new Date('2026-03-15T08:00:00.000Z').getTime() + index,
            platform: 'ChatGPT',
        }));

        const snapshot = {
            vm: {
                query: '',
                platform: 'All',
                bookmarks,
                folderTree: [{
                    folder: { name: 'Import', path: 'Import' },
                    bookmarks,
                    children: [],
                    isExpanded: true,
                }],
                selectedFolderPath: null,
                sortMode: 'time-desc',
            },
            folders: [],
            folderPaths: ['Import'],
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
            getPlatforms: vi.fn(() => ['All', 'ChatGPT']),
            getFolderCheckboxState: vi.fn(() => ({ checked: false, indeterminate: false })),
            setQuery: vi.fn(),
            setPlatform: vi.fn(),
            setSortMode: vi.fn(),
            toggleFolderExpanded: vi.fn(),
            toggleFolderSelection: vi.fn(),
            toggleBookmarkSelection: vi.fn(),
            selectFolder: vi.fn(),
            getBookmarkRowSubtitle: vi.fn(() => '2026/03/15'),
            exportAll: vi.fn(async () => ({ ok: true, data: { payload: {} } })),
            setPanelStatus: vi.fn(),
        } as any;

        const panel = new BookmarksPanel(controller, { show: vi.fn(), hide: vi.fn() } as any);
        await panel.show();

        const shadow = document.getElementById('aimd-bookmarks-panel-host')!.shadowRoot!;
        const treePanel = shadow.querySelector<HTMLElement>('.tree-panel')!;
        Object.defineProperty(treePanel, 'clientHeight', {
            configurable: true,
            value: 640,
        });
        const initialRows = shadow.querySelectorAll('.tree-item');

        expect(treePanel.dataset.virtualized).toBe('1');
        expect(initialRows.length).toBeLessThan(200);
        expect(shadow.textContent).toContain('Bookmark 1');

        treePanel.scrollTop = 36000;
        treePanel.dispatchEvent(new Event('scroll'));
        await flushAnimationFrame();
        await flushUi();

        const visibleBookmarkTitles = Array.from(
            shadow.querySelectorAll<HTMLElement>('.tree-item--bookmark .tree-label'),
        ).map((node) => node.textContent ?? '');
        const visibleIndexes = visibleBookmarkTitles
            .map((title) => Number(title.replace('Bookmark ', '')))
            .filter((value) => Number.isFinite(value));

        expect(visibleIndexes.length).toBeGreaterThan(0);
        expect(Math.min(...visibleIndexes)).toBeGreaterThan(500);
        expect(Math.max(...visibleIndexes)).toBeLessThan(800);

        panel.hide();
    });

    it('coalesces rapid virtual-tree scroll events into a single render pass', async () => {
        const bookmarks = Array.from({ length: 1200 }, (_, index) => ({
            title: `Bookmark ${index + 1}`,
            userMessage: `Prompt ${index + 1}`,
            aiResponse: `Answer ${index + 1}`,
            url: `https://chat.openai.com/c/${index + 1}`,
            urlWithoutProtocol: `chat.openai.com/c/${index + 1}`,
            folderPath: 'Import',
            position: index + 1,
            timestamp: new Date('2026-03-15T08:00:00.000Z').getTime() + index,
            createdAt: new Date('2026-03-15T08:00:00.000Z').getTime() + index,
            platform: 'ChatGPT',
        }));

        const snapshot = {
            vm: {
                query: '',
                platform: 'All',
                bookmarks,
                folderTree: [{
                    folder: { name: 'Import', path: 'Import' },
                    bookmarks,
                    children: [],
                    isExpanded: true,
                }],
                selectedFolderPath: null,
                sortMode: 'time-desc',
            },
            folders: [],
            folderPaths: ['Import'],
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
            getPlatforms: vi.fn(() => ['All', 'ChatGPT']),
            getFolderCheckboxState: vi.fn(() => ({ checked: false, indeterminate: false })),
            setQuery: vi.fn(),
            setPlatform: vi.fn(),
            setSortMode: vi.fn(),
            toggleFolderExpanded: vi.fn(),
            toggleFolderSelection: vi.fn(),
            toggleBookmarkSelection: vi.fn(),
            selectFolder: vi.fn(),
            getBookmarkRowSubtitle: vi.fn(() => '2026/03/15'),
            exportAll: vi.fn(async () => ({ ok: true, data: { payload: {} } })),
            setPanelStatus: vi.fn(),
        } as any;

        const rafQueue: FrameRequestCallback[] = [];
        const originalRaf = window.requestAnimationFrame;
        const originalCancelRaf = window.cancelAnimationFrame;
        window.requestAnimationFrame = vi.fn((callback: FrameRequestCallback) => {
            rafQueue.push(callback);
            return rafQueue.length;
        });
        window.cancelAnimationFrame = vi.fn();

        const panel = new BookmarksPanel(controller, { show: vi.fn(), hide: vi.fn() } as any);
        await panel.show();
        rafQueue.length = 0;
        (window.requestAnimationFrame as unknown as { mockClear?: () => void }).mockClear?.();

        const shadow = document.getElementById('aimd-bookmarks-panel-host')!.shadowRoot!;
        const treePanel = shadow.querySelector<HTMLElement>('.tree-panel')!;
        Object.defineProperty(treePanel, 'clientHeight', {
            configurable: true,
            value: 640,
        });

        const renderSpy = vi.spyOn((panel as any).bookmarksView.treeViewport as any, 'renderVirtualTreeWindow');
        renderSpy.mockClear();

        for (let index = 0; index < 10; index += 1) {
            treePanel.scrollTop = index * 400;
            treePanel.dispatchEvent(new Event('scroll'));
        }

        expect(renderSpy).not.toHaveBeenCalled();
        expect(window.requestAnimationFrame).toHaveBeenCalledTimes(1);

        const callback = rafQueue.shift();
        expect(callback).toBeTruthy();
        callback!(performance.now());

        expect(renderSpy).toHaveBeenCalledTimes(1);

        panel.hide();
        window.requestAnimationFrame = originalRaf;
        window.cancelAnimationFrame = originalCancelRaf;
    });

    it('keeps the panel shell mounted during tree selection updates instead of replacing the whole panel', async () => {
        const bookmarks = Array.from({ length: 600 }, (_, index) => ({
            title: `Bookmark ${index + 1}`,
            userMessage: `Prompt ${index + 1}`,
            aiResponse: `Answer ${index + 1}`,
            url: `https://chat.openai.com/c/${index + 1}`,
            urlWithoutProtocol: `chat.openai.com/c/${index + 1}`,
            folderPath: 'Import',
            position: index + 1,
            timestamp: new Date('2026-03-15T08:00:00.000Z').getTime() + index,
            createdAt: new Date('2026-03-15T08:00:00.000Z').getTime() + index,
            platform: 'ChatGPT',
        }));

        let emitSnapshot: ((snapshot: any) => void) | null = null;
        let currentSnapshot = {
            vm: {
                query: '',
                platform: 'All',
                bookmarks,
                folderTree: [{
                    folder: { name: 'Import', path: 'Import' },
                    bookmarks,
                    children: [],
                    isExpanded: true,
                }],
                selectedFolderPath: null,
                sortMode: 'time-desc',
            },
            folders: [],
            folderPaths: ['Import'],
            selectedKeys: new Set<string>(),
            previewId: null,
            status: 'Ready',
        };

        const controller = {
            subscribe: vi.fn((fn: (snap: any) => void) => {
                emitSnapshot = fn;
                fn(currentSnapshot);
                return () => {};
            }),
            refreshAll: vi.fn(async () => undefined),
            refreshPositionsForUrl: vi.fn(async () => undefined),
            refreshUiState: vi.fn(async () => undefined),
            getTheme: vi.fn(() => 'light'),
            getPlatforms: vi.fn(() => ['All', 'ChatGPT']),
            getFolderCheckboxState: vi.fn((path: string) => ({
                checked: currentSnapshot.selectedKeys.has(`folder:${path}`),
                indeterminate: false,
            })),
            setQuery: vi.fn(),
            setPlatform: vi.fn(),
            setSortMode: vi.fn(),
            toggleFolderExpanded: vi.fn(),
            toggleFolderSelection: vi.fn((path: string) => {
                currentSnapshot = {
                    ...currentSnapshot,
                    selectedKeys: new Set<string>([`folder:${path}`]),
                };
                emitSnapshot?.(currentSnapshot);
            }),
            toggleBookmarkSelection: vi.fn(),
            selectFolder: vi.fn(),
            getBookmarkRowSubtitle: vi.fn(() => '2026/03/15'),
            exportAll: vi.fn(async () => ({ ok: true, data: { payload: {} } })),
            setPanelStatus: vi.fn(),
        } as any;

        const panel = new BookmarksPanel(controller, { show: vi.fn(), hide: vi.fn() } as any);
        await panel.show();

        const shadow = document.getElementById('aimd-bookmarks-panel-host')!.shadowRoot!;
        const panelWindowBefore = shadow.querySelector('.panel-window');
        const queryInputBefore = shadow.querySelector('[data-role="bookmark-query"]');
        const checkbox = shadow.querySelector<HTMLInputElement>('.tree-item--folder .tree-check')!;

        checkbox.click();
        await flushUi();

        const panelWindowAfter = shadow.querySelector('.panel-window');
        const queryInputAfter = shadow.querySelector('[data-role="bookmark-query"]');
        const checkboxAfter = shadow.querySelector<HTMLInputElement>('.tree-item--folder .tree-check');

        expect(panelWindowAfter).toBe(panelWindowBefore);
        expect(queryInputAfter).toBe(queryInputBefore);
        expect(checkboxAfter?.checked).toBe(true);

        panel.hide();
    });

    it('does not mount collapsed folder descendants into the DOM', async () => {
        const deepBookmarks = Array.from({ length: 400 }, (_, index) => ({
            title: `Deep bookmark ${index + 1}`,
            userMessage: `Prompt ${index + 1}`,
            aiResponse: `Answer ${index + 1}`,
            url: `https://chat.openai.com/c/deep-${index + 1}`,
            urlWithoutProtocol: `chat.openai.com/c/deep-${index + 1}`,
            folderPath: 'Personal/Ideas',
            position: index + 1,
            timestamp: new Date('2026-03-15T08:00:00.000Z').getTime() + index,
            createdAt: new Date('2026-03-15T08:00:00.000Z').getTime() + index,
            platform: 'ChatGPT',
        }));

        const snapshot = {
            vm: {
                query: '',
                platform: 'All',
                bookmarks: deepBookmarks,
                folderTree: [{
                    folder: { name: 'Personal', path: 'Personal' },
                    bookmarks: [],
                    children: [{
                        folder: { name: 'Ideas', path: 'Personal/Ideas' },
                        bookmarks: deepBookmarks,
                        children: [],
                        isExpanded: true,
                    }],
                    isExpanded: false,
                }],
                selectedFolderPath: null,
                sortMode: 'time-desc',
            },
            folders: [],
            folderPaths: ['Personal', 'Personal/Ideas'],
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
            getPlatforms: vi.fn(() => ['All', 'ChatGPT']),
            getFolderCheckboxState: vi.fn(() => ({ checked: false, indeterminate: false })),
            setQuery: vi.fn(),
            setPlatform: vi.fn(),
            setSortMode: vi.fn(),
            toggleFolderExpanded: vi.fn(),
            toggleFolderSelection: vi.fn(),
            toggleBookmarkSelection: vi.fn(),
            selectFolder: vi.fn(),
            getBookmarkRowSubtitle: vi.fn(() => '2026/03/15'),
            exportAll: vi.fn(async () => ({ ok: true, data: { payload: {} } })),
            setPanelStatus: vi.fn(),
        } as any;

        const panel = new BookmarksPanel(controller, { show: vi.fn(), hide: vi.fn() } as any);
        await panel.show();

        const shadow = document.getElementById('aimd-bookmarks-panel-host')!.shadowRoot!;
        expect(shadow.textContent).not.toContain('Deep bookmark 1');
        expect(shadow.querySelectorAll('.tree-item--bookmark').length).toBe(0);

        panel.hide();
    });

    it('keeps empty-folder checkbox state in sync after toggle', async () => {
        let currentSnapshot = {
            vm: {
                query: '',
                platform: 'All',
                bookmarks: [],
                folderTree: [{
                    folder: { name: 'Empty', path: 'Empty' },
                    bookmarks: [],
                    children: [],
                    isExpanded: false,
                }],
                selectedFolderPath: null,
                sortMode: 'time-desc',
            },
            folders: [{ path: 'Empty', name: 'Empty', depth: 1, createdAt: 0, updatedAt: 0 }],
            folderPaths: ['Empty'],
            selectedKeys: new Set<string>(),
            previewId: null,
            status: 'Ready',
        };
        let emitSnapshot: ((snapshot: any) => void) | null = null;

        const controller = {
            subscribe: vi.fn((fn: (snap: any) => void) => {
                emitSnapshot = fn;
                fn(currentSnapshot);
                return () => {};
            }),
            refreshAll: vi.fn(async () => undefined),
            refreshPositionsForUrl: vi.fn(async () => undefined),
            refreshUiState: vi.fn(async () => undefined),
            getTheme: vi.fn(() => 'light'),
            getPlatforms: vi.fn(() => ['All']),
            getFolderCheckboxState: vi.fn((path: string) => ({
                checked: currentSnapshot.selectedKeys.has(`folder:${path}`),
                indeterminate: false,
            })),
            toggleFolderSelection: vi.fn((path: string) => {
                currentSnapshot = {
                    ...currentSnapshot,
                    selectedKeys: new Set(currentSnapshot.selectedKeys.has(`folder:${path}`) ? [] : [`folder:${path}`]),
                };
                emitSnapshot?.(currentSnapshot);
            }),
            setQuery: vi.fn(),
            setPlatform: vi.fn(),
            setSortMode: vi.fn(),
            toggleFolderExpanded: vi.fn(),
            toggleBookmarkSelection: vi.fn(),
            selectFolder: vi.fn(),
            getBookmarkRowSubtitle: vi.fn(),
            exportAll: vi.fn(async () => ({ ok: true, data: { payload: {} } })),
            setPanelStatus: vi.fn(),
        } as any;

        const panel = new BookmarksPanel(controller, { show: vi.fn(), hide: vi.fn() } as any);
        await panel.show();

        const shadow = document.getElementById('aimd-bookmarks-panel-host')!.shadowRoot!;
        const checkbox = shadow.querySelector<HTMLInputElement>('.tree-item--folder .tree-check');
        expect(checkbox?.checked).toBe(false);

        checkbox!.checked = true;
        checkbox!.dispatchEvent(new Event('change', { bubbles: true }));

        const refreshedCheckbox = shadow.querySelector<HTMLInputElement>('.tree-item--folder .tree-check');
        expect(refreshedCheckbox?.checked).toBe(true);

        panel.hide();
    });

    it('shows folder counts and expandable children from query/platform filters even when controller restores a selected folder scope', async () => {
        const importBookmark = {
            title: 'Import item',
            userMessage: 'Prompt A',
            aiResponse: 'Answer A',
            url: 'https://chat.openai.com/c/import',
            urlWithoutProtocol: 'chat.openai.com/c/import',
            folderPath: 'Import',
            position: 1,
            timestamp: new Date('2026-03-15T08:00:00.000Z').getTime(),
            platform: 'ChatGPT',
        } as any;
        const workBookmark = {
            title: 'Work item',
            userMessage: 'Prompt B',
            aiResponse: 'Answer B',
            url: 'https://chat.openai.com/c/work',
            urlWithoutProtocol: 'chat.openai.com/c/work',
            folderPath: 'Work',
            position: 2,
            timestamp: new Date('2026-03-15T09:00:00.000Z').getTime(),
            platform: 'ChatGPT',
        } as any;

        let currentSnapshot = {
            vm: {
                query: '',
                platform: 'All',
                bookmarks: [importBookmark],
                folderTree: [
                    {
                        folder: { name: 'Import', path: 'Import' },
                        bookmarks: [importBookmark],
                        children: [],
                        isExpanded: false,
                    },
                    {
                        folder: { name: 'Work', path: 'Work' },
                        bookmarks: [workBookmark],
                        children: [],
                        isExpanded: false,
                    },
                ],
                selectedFolderPath: 'Import',
                sortMode: 'time-desc',
            },
            folders: [],
            folderPaths: ['Import', 'Work'],
            selectedKeys: new Set<string>(),
            previewId: null,
            status: 'Ready',
        };
        let emitSnapshot: ((snapshot: any) => void) | null = null;

        const controller = {
            subscribe: vi.fn((fn: (snap: any) => void) => {
                emitSnapshot = fn;
                fn(currentSnapshot);
                return () => {};
            }),
            refreshAll: vi.fn(async () => undefined),
            refreshPositionsForUrl: vi.fn(async () => undefined),
            refreshUiState: vi.fn(async () => undefined),
            getTheme: vi.fn(() => 'light'),
            getPlatforms: vi.fn(() => ['All', 'ChatGPT']),
            getFolderCheckboxState: vi.fn(() => ({ checked: false, indeterminate: false })),
            toggleFolderExpanded: vi.fn((path: string) => {
                currentSnapshot = {
                    ...currentSnapshot,
                    vm: {
                        ...currentSnapshot.vm,
                        folderTree: currentSnapshot.vm.folderTree.map((node) => (
                            node.folder.path === path ? { ...node, isExpanded: !node.isExpanded } : node
                        )),
                    },
                };
                emitSnapshot?.(currentSnapshot);
            }),
            setQuery: vi.fn(),
            setPlatform: vi.fn(),
            setSortMode: vi.fn(),
            toggleFolderSelection: vi.fn(),
            toggleBookmarkSelection: vi.fn(),
            selectFolder: vi.fn(),
            getBookmarkRowSubtitle: vi.fn((bookmark: any) => `${bookmark.platform} · ${new Date(bookmark.timestamp).toLocaleDateString()}`),
            exportAll: vi.fn(async () => ({ ok: true, data: { payload: {} } })),
            setPanelStatus: vi.fn(),
        } as any;

        const panel = new BookmarksPanel(controller, { show: vi.fn(), hide: vi.fn() } as any);
        await panel.show();

        const shadow = document.getElementById('aimd-bookmarks-panel-host')!.shadowRoot!;
        const counts = Array.from(shadow.querySelectorAll<HTMLElement>('.tree-item--folder .tree-count')).map((node) => node.textContent?.trim());
        expect(counts).toEqual(['1', '1']);
        expect(shadow.querySelector<HTMLElement>('.tree-item--folder[data-path="Work"]')?.dataset.selected).toBe('0');

        shadow.querySelector<HTMLElement>('.tree-item--folder[data-path="Work"] .tree-caret')!.click();

        const workChildren = shadow.querySelectorAll<HTMLElement>('.tree-children')[1];
        expect(workChildren?.dataset.expanded).toBe('1');
        expect(workChildren?.textContent).toContain('Work item');

        panel.hide();
    });

    it('keeps the batch selection label localized when snapshot patches update the selected count', async () => {
        await setLocale('zh_CN');
        const bookmark = {
            title: 'Saved thread',
            urlWithoutProtocol: 'chat.openai.com/c/123',
            position: 8,
            createdAt: Date.now(),
            platform: 'ChatGPT',
        } as any;

        let currentSnapshot = {
            vm: {
                query: '',
                platform: 'All',
                bookmarks: [bookmark],
                folderTree: [{
                    folder: { name: 'Import', path: 'Import' },
                    bookmarks: [bookmark],
                    children: [],
                    isExpanded: true,
                }],
                selectedFolderPath: null,
                sortMode: 'time-desc',
            },
            folders: [],
            folderPaths: ['Import'],
            selectedKeys: new Set<string>(),
            previewId: null,
            status: 'Ready',
            storageUsage: { usedBytes: 512, quotaBytes: 1024, usedPercentage: 50, warningLevel: 'none' },
        };
        let emitSnapshot: ((snapshot: any) => void) | null = null;

        const controller = {
            subscribe: vi.fn((fn: (snap: any) => void) => {
                emitSnapshot = fn;
                fn(currentSnapshot);
                return () => {};
            }),
            refreshAll: vi.fn(async () => undefined),
            refreshPositionsForUrl: vi.fn(async () => undefined),
            refreshUiState: vi.fn(async () => undefined),
            getTheme: vi.fn(() => 'light'),
            getPlatforms: vi.fn(() => ['All', 'ChatGPT']),
            getFolderCheckboxState: vi.fn(() => ({ checked: false, indeterminate: false })),
            setQuery: vi.fn(),
            setPlatform: vi.fn(),
            setSortMode: vi.fn(),
            toggleFolderExpanded: vi.fn(),
            toggleFolderSelection: vi.fn(),
            toggleBookmarkSelection: vi.fn((nextBookmark: any) => {
                currentSnapshot = {
                    ...currentSnapshot,
                    selectedKeys: new Set([`bm:${nextBookmark.urlWithoutProtocol}:${nextBookmark.position}`]),
                };
                emitSnapshot?.(currentSnapshot);
            }),
            selectFolder: vi.fn(),
            getBookmarkRowSubtitle: vi.fn(() => ''),
            exportAll: vi.fn(async () => ({ ok: true, data: { payload: {} } })),
            setPanelStatus: vi.fn(),
        } as any;

        const panel = new BookmarksPanel(controller, { show: vi.fn(), hide: vi.fn() } as any);
        await panel.show();

        const shadow = document.getElementById('aimd-bookmarks-panel-host')!.shadowRoot!;
        const bookmarkCheckbox = shadow.querySelector<HTMLInputElement>('.tree-item--bookmark .tree-check');
        expect(shadow.querySelector('.batch-label')?.textContent?.trim()).toBe('');
        expect(bookmarkCheckbox).toBeTruthy();

        bookmarkCheckbox!.checked = true;
        bookmarkCheckbox!.dispatchEvent(new Event('change', { bubbles: true }));
        await flushUi();

        expect(shadow.querySelector('.batch-label')?.textContent?.trim()).toBe('已选择 1 项');

        panel.hide();
    });

    it('does not force ancestor folders open in either inline or virtualized tree rendering when node state is collapsed', async () => {
        const buildNestedTree = (totalRoots: number) => {
            const nestedBookmark = {
                title: 'Nested item',
                userMessage: 'Prompt nested',
                aiResponse: 'Answer nested',
                url: 'https://chat.openai.com/c/nested',
                urlWithoutProtocol: 'chat.openai.com/c/nested',
                folderPath: 'Root 0/Child',
                position: 1,
                timestamp: new Date('2026-03-15T08:00:00.000Z').getTime(),
                platform: 'ChatGPT',
            } as any;

            const roots: any[] = [{
                folder: { name: 'Root 0', path: 'Root 0' },
                bookmarks: [],
                children: [{
                    folder: { name: 'Child', path: 'Root 0/Child' },
                    bookmarks: [nestedBookmark],
                    children: [],
                    isExpanded: false,
                }],
                isExpanded: false,
            }];

            for (let index = 1; index < totalRoots; index += 1) {
                roots.push({
                    folder: { name: `Root ${index}`, path: `Root ${index}` },
                    bookmarks: [],
                    children: [],
                    isExpanded: false,
                });
            }

            return { roots, nestedBookmark };
        };

        for (const totalRoots of [2, 260]) {
            const { roots, nestedBookmark } = buildNestedTree(totalRoots);
            const snapshot = {
                vm: {
                    query: '',
                    platform: 'All',
                    bookmarks: [nestedBookmark],
                    folderTree: roots,
                    selectedFolderPath: 'Root 0/Child',
                    sortMode: 'time-desc',
                },
                folders: [],
                folderPaths: roots.map((node) => node.folder.path).concat('Root 0/Child'),
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
                getPlatforms: vi.fn(() => ['All', 'ChatGPT']),
                getFolderCheckboxState: vi.fn(() => ({ checked: false, indeterminate: false })),
                setQuery: vi.fn(),
                setPlatform: vi.fn(),
                setSortMode: vi.fn(),
                toggleFolderExpanded: vi.fn(),
                toggleFolderSelection: vi.fn(),
                toggleBookmarkSelection: vi.fn(),
                selectFolder: vi.fn(),
                getBookmarkRowSubtitle: vi.fn(() => 'ChatGPT · 2026/3/15'),
                exportAll: vi.fn(async () => ({ ok: true, data: { payload: {} } })),
                setPanelStatus: vi.fn(),
            } as any;

            const panel = new BookmarksPanel(controller, { show: vi.fn(), hide: vi.fn() } as any);
            await panel.show();

            const shadow = document.getElementById('aimd-bookmarks-panel-host')!.shadowRoot!;
            const treePanel = shadow.querySelector<HTMLElement>('.tree-panel');

            expect(treePanel?.dataset.virtualized).toBe(totalRoots > 240 ? '1' : '0');
            expect(shadow.querySelector<HTMLElement>('.tree-item--folder[data-path="Root 0"]')?.getAttribute('aria-expanded')).toBe('false');
            expect(shadow.querySelector<HTMLElement>('.tree-item--folder[data-path="Root 0/Child"]')).toBeNull();

            panel.hide();
            shadow.querySelector<HTMLElement>('.panel-window--bookmarks')?.dispatchEvent(
                new Event('animationend', { bubbles: true }),
            );
        }
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
            getPlatforms: vi.fn(() => ['All', 'ChatGPT']),
            getFolderCheckboxState: vi.fn(() => ({ checked: false, indeterminate: false })),
            setQuery: vi.fn(),
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

        const settingsPanel = shadow.querySelector<HTMLElement>('.settings-panel');
        expect(settingsPanel).toBeTruthy();
        settingsPanel!.scrollTop = 180;

        shadow.querySelector<HTMLElement>('[data-action="toggle-settings-menu"][data-menu="folding-mode"]')!.click();

        const refreshedSettingsPanel = shadow.querySelector<HTMLElement>('.settings-panel');
        expect(refreshedSettingsPanel?.scrollTop).toBe(180);

        panel.hide();
    });

    it('replays the sponsor ribbon burst effect when the sponsor panel is clicked', async () => {
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
            getPlatforms: vi.fn(() => ['All', 'ChatGPT']),
            getFolderCheckboxState: vi.fn(() => ({ checked: false, indeterminate: false })),
            setQuery: vi.fn(),
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
