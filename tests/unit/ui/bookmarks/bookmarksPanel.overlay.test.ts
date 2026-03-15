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

describe('BookmarksPanel overlay surface', () => {
    beforeEach(() => {
        document.body.innerHTML = '';
        document.documentElement.innerHTML = '';
    });

    afterEach(() => {
        document.body.innerHTML = '';
    });

    it('mounts the bookmarks panel inside the shared overlay surface slots and keeps a dedicated modal layer', async () => {
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

        const backdropRoot = shadow.querySelector<HTMLElement>('[data-role="overlay-backdrop-root"]');
        const surfaceRoot = shadow.querySelector<HTMLElement>('[data-role="overlay-surface-root"]');
        const modalRoot = shadow.querySelector<HTMLElement>('[data-role="overlay-modal-root"]');

        expect(backdropRoot?.querySelector('.panel-stage__overlay')).toBeTruthy();
        expect(surfaceRoot?.querySelector('.aimd-panel')).toBeTruthy();
        expect(modalRoot).toBeTruthy();
        expect(shadow.querySelector('[data-aimd-style-id="aimd-bookmarks-panel-structure"]')).toBeTruthy();

        panel.hide();
    });
});
