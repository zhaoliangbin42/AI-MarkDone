import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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

import { BookmarksPanel } from '@/ui/content/bookmarks/BookmarksPanel';
import { ChatGPTMessageStepperController } from '@/ui/content/controllers/ChatGPTMessageStepperController';
import { ChatGPTAdapter } from '@/drivers/content/adapters/sites/chatgpt';
import { createAppearanceSnapshot } from '@/style/appearance';

describe('BookmarksPanel overlay surface', () => {
    beforeEach(() => {
        document.body.innerHTML = '';
        document.documentElement.innerHTML = '';
    });

    afterEach(() => {
        document.body.innerHTML = '';
    });

    it('mounts the bookmarks panel in one overlay session and safely reuses it when reopened during close', async () => {
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
        const adapter = new ChatGPTAdapter();
        const stepper = new ChatGPTMessageStepperController(adapter, {
            onOpenBookmarksPanel: () => panel.toggle(),
        });
        stepper.init();

        document.querySelector<HTMLButtonElement>('[data-action="open-bookmarks-panel"]')?.click();
        await vi.waitFor(() => {
            expect(document.getElementById('aimd-bookmarks-panel-host')).toBeTruthy();
        });

        const host = document.getElementById('aimd-bookmarks-panel-host');
        expect(host).toBeTruthy();
        const shadow = host!.shadowRoot!;

        const backdropRoot = shadow.querySelector<HTMLElement>('[data-role="overlay-backdrop-root"]');
        const surfaceRoot = shadow.querySelector<HTMLElement>('[data-role="overlay-surface-root"]');
        const modalRoot = shadow.querySelector<HTMLElement>('[data-role="overlay-modal-root"]');

        const backdrop = backdropRoot?.querySelector<HTMLElement>('.panel-stage__overlay');
        const surface = surfaceRoot?.querySelector<HTMLElement>('.aimd-panel');
        expect(backdrop).toBeTruthy();
        expect(surface).toBeTruthy();
        expect(backdrop?.style.getPropertyValue('--_surface-motion-open-duration')).toBe('180ms');
        expect(surface?.style.getPropertyValue('--_surface-motion-open-duration')).toBe('300ms');
        expect(modalRoot).toBeTruthy();
        expect(shadow.querySelector('[data-aimd-style-id="aimd-bookmarks-panel-structure"]')).toBeTruthy();

        shadow.querySelector<HTMLButtonElement>('.tab-btn[data-tab-id="settings"]')?.click();
        await vi.waitFor(() => {
            const activeSettings = shadow.querySelector<HTMLElement>('.tab-panel[data-tab-id="settings"]');
            expect(activeSettings?.dataset.active).toBe('1');
            expect(activeSettings?.querySelector('[data-role="settings-google-drive-backup-card"]')).toBeTruthy();
            expect(activeSettings?.querySelector('[data-role="settings-local-backup-row"]')).toBeTruthy();
        });

        panel.hide();
        const activeSurface = shadow.querySelector<HTMLElement>('.aimd-panel');
        expect(activeSurface?.dataset.motionState).toBe('closing');
        expect(activeSurface?.style.getPropertyValue('--_surface-motion-close-duration')).toBe('240ms');

        await panel.show();

        expect(document.querySelectorAll('#aimd-bookmarks-panel-host')).toHaveLength(1);
        expect(document.getElementById('aimd-bookmarks-panel-host')).toBe(host);
        const reopenedSurface = shadow.querySelector<HTMLElement>('.aimd-panel');
        expect(reopenedSurface).not.toBe(activeSurface);
        expect(reopenedSurface?.dataset.motionState).not.toBe('closing');
        activeSurface?.dispatchEvent(new Event('animationend', { bubbles: true }));
        expect(document.getElementById('aimd-bookmarks-panel-host')).toBe(host);

        if (reopenedSurface) reopenedSurface.dataset.motionState = 'closing';
        panel.hide();
        expect(document.getElementById('aimd-bookmarks-panel-host')).toBeNull();
        stepper.dispose();
        adapter.dispose();
    });
});
