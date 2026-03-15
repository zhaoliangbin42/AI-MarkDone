import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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
import { getBookmarksPanelCss } from '@/ui/content/bookmarks/ui/styles/bookmarksPanelCss';

describe('BookmarksPanel', () => {
    beforeEach(() => {
        document.body.innerHTML = '';
        document.documentElement.innerHTML = '';
    });

    afterEach(() => {
        document.body.innerHTML = '';
    });

    it('styles the imported secondary empty-state action instead of leaving the mock import button unskinned', () => {
        const css = getBookmarksPanelCss();

        expect(css).toContain('.secondary-btn');
        expect(css).toContain('--_bookmarks-shell-radius: var(--aimd-radius-2xl);');
        expect(css).toContain('--_bookmarks-control-height: 44px;');
        expect(css).toContain('--_bookmarks-pill-radius: var(--aimd-radius-full);');
        expect(css).toContain('border-radius: var(--_bookmarks-pill-radius);');
        expect(css).toContain('min-height: var(--_bookmarks-action-height);');
        expect(css).toContain('width: min(var(--aimd-panel-wide-max-width), 100%);');
        expect(css).toContain('height: min(var(--aimd-panel-wide-max-height), calc(100vh - var(--_bookmarks-panel-edge-offset)));');
        expect(css).toContain('.platform-dropdown__option {');
        expect(css).toContain('justify-content: flex-start;');
        expect(css).toContain('font-size: var(--aimd-text-lg);');
        expect(css).toContain('.tree-title-meta');
        expect(css).toContain('.tree-item:hover .tree-main--bookmark .tree-subtitle');
        expect(css).not.toContain('rgba(');
        expect(css).not.toContain('#0f172a');
        expect(css).not.toContain('background: white;');
        expect(css).not.toContain('z-index: 20;');
        expect(css).not.toContain('z-index: 4;');
        expect(css).not.toMatch(/font-size:\s*\d+px/);
        expect(css).not.toMatch(/border-radius:\s*\d+px/);
    });

    it('activates the real settings and sponsor panels inside the formal bookmarks panel shell', async () => {
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
        expect(refreshedSettingsPanel?.querySelector('.settings-card')).toBeTruthy();
        expect(refreshedSettingsPanel?.querySelector('.storage-fill')).toBeTruthy();
        expect(refreshedSettingsPanel?.querySelectorAll('.settings-select-trigger').length).toBeGreaterThanOrEqual(2);
        expect(refreshedSettingsPanel?.querySelector('.settings-select')).toBeNull();
        expect(refreshedSettingsPanel?.querySelector('.settings-number-field')).toBeTruthy();
        const platformLabels = Array.from(refreshedSettingsPanel?.querySelectorAll<HTMLElement>('.settings-card:first-child .settings-label strong') ?? []);
        const deepseekLabel = platformLabels.find((node) => node.textContent?.includes('Deep'));
        expect(deepseekLabel?.textContent).toContain('DeepSeek');
        expect(deepseekLabel?.textContent).not.toContain('Deepseek');
        expect(shadow.querySelector('.platform-dropdown__menu')?.getAttribute('data-open')).toBe('0');

        sponsorTabButton!.click();

        const refreshedSponsorTab = shadow.querySelector<HTMLElement>('.sponsor-panel');
        const refreshedBookmarksTab = shadow.querySelector<HTMLElement>('.tab-panel--bookmarks');
        const refreshedSettingsTab = shadow.querySelector<HTMLElement>('.settings-panel');

        expect(refreshedSponsorTab?.dataset.active).toBe('1');
        expect(refreshedBookmarksTab?.dataset.active).toBe('0');
        expect(refreshedSettingsTab?.dataset.active).toBe('0');
        expect(shadow.querySelector('.aimd-panel-title')?.textContent).toBe('Sponsor');
        expect(refreshedSponsorTab?.querySelector('.sponsor-card')).toBeTruthy();
        expect(refreshedSponsorTab?.querySelector('.sponsor-qr-card')).toBeTruthy();
        expect(refreshedSponsorTab?.querySelector('.sponsor-celebration')).toBeTruthy();
        expect(refreshedSponsorTab?.querySelector('.sponsor-title-row')).toBeTruthy();
        expect(refreshedSponsorTab?.querySelector('.sponsor-brand-mark')).toBeTruthy();

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
        expect(overlay).toBeTruthy();

        overlay!.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, composed: true }));

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

        const promptSpy = vi.spyOn(window, 'prompt').mockReturnValue('Archive');

        const panel = new BookmarksPanel(controller, { show: vi.fn(), hide: vi.fn() } as any);
        await panel.show();

        const shadow = document.getElementById('aimd-bookmarks-panel-host')!.shadowRoot!;
        const actions = Array.from(shadow.querySelectorAll<HTMLElement>('.tree-item--bookmark .tree-actions .icon-btn'));
        const labels = actions.map((button) => button.getAttribute('aria-label'));
        expect(labels).toEqual(['Open conversation', 'Copy', 'Move bookmark', 'Delete']);

        actions[2]!.click();

        expect(controller.moveBookmark).toHaveBeenCalledWith(bookmark, 'Archive');
        promptSpy.mockRestore();
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
