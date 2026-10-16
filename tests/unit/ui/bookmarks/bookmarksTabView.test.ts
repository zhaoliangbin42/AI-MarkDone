import { afterEach, describe, expect, it, vi } from 'vitest';
import { BookmarksTabView } from '@/ui/content/bookmarks/ui/tabs/BookmarksTabView';
import { createNoopBookmarksTabActions } from '@/ui/content/bookmarks/ui/tabs/bookmarksTabActions';
import { buildBookmarkDedupeKey } from '@/core/bookmarks/keys';
import type { FolderSelectionOptions } from '@/ui/content/bookmarks/save/BookmarkSaveDialog';
import type { Bookmark, FolderTreeNode } from '@/core/bookmarks/types';
import type { BookmarksPanelSnapshot } from '@/ui/content/bookmarks/BookmarksPanelController';

function bookmark(index: number, folderPath = 'Work'): Bookmark {
    return { kind: 'message', url: 'https://chatgpt.com/c/example', urlWithoutProtocol: 'chatgpt.com/c/example', position: index, messageId: `message-${index}`, title: `Bookmark ${index}`, userMessage: 'Question', aiResponse: `Answer ${index}`, platform: 'ChatGPT', timestamp: index, folderPath };
}
function folder(path: string, children: FolderTreeNode[] = [], isExpanded = true): FolderTreeNode {
    return { folder: { path, name: path.split('/').pop()!, depth: path.split('/').length, createdAt: 0, updatedAt: 0 }, children, bookmarks: [], isExpanded, isSelected: false };
}
function fixture(count = 2) {
    const snapshot: BookmarksPanelSnapshot = { vm: { query: '', kind: 'all', bookmarks: Array.from({ length: count }, (_, index) => bookmark(index + 1)), folderTree: [folder('Work', [folder('Work/Notes')])], selectedFolderPath: null, sortMode: 'time-desc', selectedCount: 0 }, folders: [folder('Work').folder, folder('Work/Notes').folder], folderPaths: ['Work', 'Work/Notes'], selectedKeys: new Set(), previewId: null, status: '', storageUsage: null, dataState: { kind: 'ready' } };
    let view: BookmarksTabView;
    const controller = {
        getSnapshot: () => snapshot,
        getTheme: () => 'light', getDefaultFolderPath: () => 'Work',
        getFolderCheckboxState: vi.fn(() => ({ checked: false, indeterminate: true })),
        clearSelection: vi.fn(() => { snapshot.selectedKeys.clear(); }),
        selectBookmarks: vi.fn(),
        invertBookmarkSelection: vi.fn(),
        setQuery: vi.fn((query: string) => { snapshot.vm.query = query; }),
        setKindFilter: vi.fn(), setSortMode: vi.fn(),
        selectFolder: vi.fn(), toggleFolderExpanded: vi.fn(), toggleFolderSelection: vi.fn(),
        toggleBookmarkSelection: vi.fn((record: Bookmark) => { snapshot.selectedKeys.add(`bm:${buildBookmarkDedupeKey(record)}`); }),
        refreshAll: vi.fn(async () => undefined),
        moveBookmark: vi.fn(async () => ({ ok: true, data: { moved: 1, missing: 0 } })),
        renameBookmark: vi.fn(async () => ({ ok: true, data: {} })),
        deleteBookmark: vi.fn(async () => undefined),
        setPanelStatus: vi.fn(), copyBookmarkMarkdown: vi.fn(async () => undefined),
        goToBookmark: vi.fn(async () => undefined),
    };
    const actions = { ...createNoopBookmarksTabActions(), showPreview: vi.fn(async () => undefined), pickFolder: vi.fn(async (_current: string | null, _theme: any, options?: FolderSelectionOptions) => { const error = await options?.onSubmit?.('Archive'); return error ? null : 'Archive'; }), promptFolderName: vi.fn(async () => null), promptBookmarkTitle: vi.fn(async () => 'Renamed'), confirmDeleteBookmark: vi.fn(async () => true), alertError: vi.fn(async () => undefined) };
    view = new BookmarksTabView({ controller: controller as any, actions });
    view.update(snapshot);
    const root = view.getElement(), nav = view.getNavigationElement();
    document.body.append(nav, root);
    const click = (label: string, parent: HTMLElement = root) => {
        const target = [...parent.querySelectorAll<HTMLElement>('[aria-label]')].find((element) => element.getAttribute('aria-label') === label);
        expect(target, label).toBeTruthy(); target!.click();
    };
    return { view, root, nav, snapshot, controller, actions, click };
}
const settle = async () => { for (let i = 0; i < 16; i++) await Promise.resolve(); };

describe('BookmarksTabView library presentation', () => {
    afterEach(() => document.body.replaceChildren());
    it.each(['notes', '拼音', ''])('retains search input through a synchronous selection-clear redraw in Shadow DOM: %s', (value) => {
        const f = fixture();
        const host = document.createElement('div'); document.body.append(host);
        const shadow = host.attachShadow({ mode: 'open' }); shadow.append(f.nav, f.root);
        f.controller.clearSelection.mockImplementation(() => { f.snapshot.selectedKeys.clear(); f.view.update(f.snapshot); });
        f.controller.setQuery.mockImplementation(query => { f.snapshot.vm.query = query; f.view.update(f.snapshot); });
        const query = f.root.querySelector<HTMLInputElement>('[data-role="bookmark-query"]')!;
        query.focus();
        expect(document.activeElement).toBe(host);
        query.value = value;
        query.dispatchEvent(new InputEvent('input', { bubbles: true, composed: true, data: value, isComposing: value === '拼音' }));
        expect(f.controller.setQuery).toHaveBeenCalledWith(value);
        expect(query.value).toBe(value);
        expect(shadow.activeElement).toBe(query);
    });
    it('shows all bookmark controls inline beside the heading without a More menu', () => {
        const f = fixture();
        const heading = f.root.querySelector('.library-heading')!;
        const controls = heading.querySelector('.library-bookmark-toolbar-actions')!;

        expect(f.root.querySelector('.library-toolbar-menu')).toBeNull();
        expect(controls).toBeTruthy();
        for (const action of ['toggle-sort-time', 'toggle-sort-alpha', 'create-folder', 'import-bookmarks', 'export-all-bookmarks', 'manage-library']) {
            expect(controls.querySelector(`[data-action="${action}"]`), action).toBeTruthy();
        }
        expect(controls.querySelectorAll('.bookmark-toolbar-sort-button svg')).toHaveLength(2);
        expect(controls.querySelector('[data-action="manage-library"] .aimd-glyph[data-glyph="check"]')).toBeTruthy();
        expect(f.root.querySelector('.toolbar-row--bookmarks .search-field')).toBeTruthy();
    });
    it('offers a direct rename action for the selected bookmark folder', async () => {
        const f = fixture();
        f.snapshot.vm.selectedFolderPath = 'Work';
        f.view.update(f.snapshot);
        const selectedFolder = f.nav.querySelector<HTMLElement>('.library-folder-row[data-active="true"]')!;
        const rename = selectedFolder.querySelector<HTMLButtonElement>('[data-action="rename-folder"]');

        expect(rename).toBeTruthy();
        rename!.click();
        await settle();
        expect(f.actions.promptFolderName).toHaveBeenCalledWith('renameFolder', 'Work', expect.any(Function));
    });
    it('uses clear text selection commands and distinct Done in the bookmark batch bar', () => {
        const f = fixture();
        f.click('libraryManage');
        const bar = f.root.querySelector<HTMLElement>('.library-selection-bar')!;

        expect(bar).toBeTruthy();
        for (const action of ['select-page', 'select-all-results', 'invert-selection', 'clear-selection', 'manage-done']) {
            expect(bar.querySelector(`[data-action="${action}"]`), action).toBeTruthy();
        }
        expect(bar.querySelectorAll('.library-selection-controls svg')).toHaveLength(0);
    });
    it('routes Select all and Invert to the full filtered bookmark result set', () => {
        const f = fixture(45);
        f.click('libraryManage');
        f.root.querySelector<HTMLButtonElement>('[data-action="select-all-results"]')!.click();
        expect(f.controller.selectBookmarks).toHaveBeenCalledWith(f.snapshot.vm.bookmarks);
        f.root.querySelector<HTMLButtonElement>('[data-action="invert-selection"]')!.click();
        expect(f.controller.invertBookmarkSelection).toHaveBeenCalledWith(f.snapshot.vm.bookmarks);
    });
    it('keeps keyboard focus on a batch command after selection redraws the bar', () => {
        const f = fixture(45);
        f.click('libraryManage');
        f.controller.selectBookmarks.mockImplementation(() => f.view.update(f.snapshot));
        const selectAll = f.root.querySelector<HTMLButtonElement>('[data-action="select-all-results"]')!;
        selectAll.focus();
        selectAll.click();

        expect(document.activeElement).toBe(f.root.querySelector('[data-action="select-all-results"]'));
    });
    it('keeps the list at twenty rows and advances through the real pager', () => {
        const f = fixture(45);
        expect(f.root.querySelectorAll('.library-record')).toHaveLength(20);
        f.click('libraryNextPage');
        expect(f.root.querySelectorAll('.library-record')).toHaveLength(20);
        expect(f.root.textContent).toContain('Bookmark 21');
        f.click('libraryNextPage');
        expect(f.root.querySelectorAll('.library-record')).toHaveLength(5);
        f.snapshot.vm.bookmarks = f.snapshot.vm.bookmarks.slice(0, 19); f.view.update(f.snapshot);
        expect(f.root.querySelectorAll('.library-record')).toHaveLength(19);
    });
    it('keeps folders in the sidebar and does not duplicate them in the content list', () => {
        const f = fixture();
        expect(f.nav.querySelectorAll('.library-folder-row')).toHaveLength(2);
        expect(f.root.querySelector('.library-folder-row')).toBeNull();
        expect(f.root.querySelector('.platform-dropdown')).toBeNull();
    });
    it('preserves empty folders while showing a no-results list', () => {
        const f = fixture(0); f.snapshot.vm.query = 'unmatched'; f.view.update(f.snapshot);
        expect(f.nav.textContent).toContain('Work');
        expect(f.root.textContent).toContain('libraryNoMatches');
    });
    it('selects a folder without toggling expansion, and the caret only expands', () => {
        const f = fixture();
        f.click('Work', f.nav);
        expect(f.controller.selectFolder).toHaveBeenCalledWith('Work');
        expect(f.controller.toggleFolderExpanded).not.toHaveBeenCalled();
        f.click('libraryExpandFolder', f.nav);
        expect(f.controller.toggleFolderExpanded).toHaveBeenCalledWith('Work');
        expect(f.controller.selectFolder).toHaveBeenCalledTimes(1);
    });
    it('honors collapsed ancestors rather than expanding them while rendering', () => {
        const f = fixture(); f.snapshot.vm.folderTree[0]!.isExpanded = false; f.view.update(f.snapshot);
        expect(f.nav.querySelectorAll('.library-folder-row')).toHaveLength(1);
        expect(f.controller.toggleFolderExpanded).not.toHaveBeenCalled();
    });
    it('keeps runtime recovery distinct from an empty library', () => {
        const f = fixture(0);
        f.snapshot.dataState = { kind: 'error', failure: { kind: 'transport', code: 'RECEIVER_UNAVAILABLE', message: 'Unavailable', delivery: 'not-sent' } };
        f.view.update(f.snapshot);
        expect(f.root.textContent).not.toContain('libraryEmpty');
        f.root.querySelector<HTMLButtonElement>('[data-action="retry-bookmarks-load"]')!.click();
        expect(f.controller.refreshAll).toHaveBeenCalledOnce();
        expect(f.nav.textContent).toContain('Work');
    });
    it('opens the Reader preview directly from a bookmark row', async () => {
        const f = fixture(); f.click('Bookmark 1'); await settle();
        expect(f.actions.showPreview).toHaveBeenCalledWith(expect.objectContaining({ bookmark: f.snapshot.vm.bookmarks[0] }));
        expect(f.root.querySelector('.library-detail')).toBeNull();
    });
    it('moves a bookmark through its row action and existing controller', async () => {
        const f = fixture(); f.click('moveBookmarkLabel', f.root.querySelector('.library-record')!); await settle();
        expect(f.actions.pickFolder).toHaveBeenCalledWith('Work', 'light', expect.objectContaining({ excludeCurrent: true, onSubmit: expect.any(Function) }));
        expect(f.controller.moveBookmark).toHaveBeenCalledWith(f.snapshot.vm.bookmarks[0], 'Archive');
        expect(f.root.querySelector('.library-record')).not.toBeNull();
    });
    it('does not mutate a bookmark when its move is cancelled', async () => {
        const f = fixture(); f.actions.pickFolder.mockResolvedValueOnce(null);
        f.click('moveBookmarkLabel', f.root.querySelector('.library-record')!); await settle();
        expect(f.controller.moveBookmark).not.toHaveBeenCalled(); expect(f.root.querySelector('.library-record')).not.toBeNull();
    });
    it('reports a failed move and keeps the bookmark row available', async () => {
        const f = fixture(); f.controller.moveBookmark.mockResolvedValueOnce({ ok: false, message: 'Failed' } as any);
        f.click('moveBookmarkLabel', f.root.querySelector('.library-record')!); await settle();
        expect(f.actions.pickFolder).toHaveReturned(); expect(f.root.querySelector('.library-record')).not.toBeNull();
    });
    it('retries a failed refresh without repeating the completed move', async () => {
        const f = fixture();
        let submit: FolderSelectionOptions['onSubmit'];
        f.actions.pickFolder.mockImplementationOnce(async (_current, _theme, options) => { submit = options?.onSubmit; return null; });
        f.click('moveBookmarkLabel', f.root.querySelector('.library-record')!); await settle();
        f.snapshot.dataState = { kind: 'loading' };
        expect(await submit!('Archive')).toBe('librarySavedRefreshFailed');
        expect(f.root.querySelector('.library-record')).not.toBeNull();
        f.snapshot.dataState = { kind: 'ready' };
        expect(await submit!('Archive')).toBeNull();
        expect(f.controller.moveBookmark).toHaveBeenCalledTimes(1);
        expect(f.controller.refreshAll).toHaveBeenCalledOnce();
    });
    it('does not acknowledge a changed destination after a move was already saved', async () => {
        const f = fixture();
        let submit: FolderSelectionOptions['onSubmit'];
        f.actions.pickFolder.mockImplementationOnce(async (_current, _theme, options) => { submit = options?.onSubmit; return null; });
        f.click('moveBookmarkLabel', f.root.querySelector('.library-record')!); await settle();
        f.snapshot.dataState = { kind: 'loading' };
        expect(await submit!('Archive')).toBe('librarySavedRefreshFailed');
        f.snapshot.dataState = { kind: 'ready' };
        expect(await submit!('Elsewhere')).not.toBeNull();
        expect(f.controller.moveBookmark).toHaveBeenCalledTimes(1);
        expect(f.controller.setPanelStatus).not.toHaveBeenCalledWith('libraryMovedTo');
    });
    it('only exposes selection controls in management mode, including mixed folder state', async () => {
        const f = fixture(); expect(f.nav.querySelector('input[type=checkbox]')).toBeNull();
        f.click('libraryManage'); await settle();
        const check = f.nav.querySelector<HTMLInputElement>('input[type=checkbox]')!;
        expect(check.indeterminate).toBe(true); check.click();
        expect(f.controller.toggleFolderSelection).toHaveBeenCalledWith('Work');
        expect(f.controller.toggleFolderExpanded).not.toHaveBeenCalled();
        f.click('librarySelectPage'); await settle();
        expect(f.controller.selectBookmarks).toHaveBeenCalledWith(f.snapshot.vm.bookmarks);
    });
    it('clears selection when changing search or bookmark type', () => {
        const f = fixture();
        const query = f.root.querySelector<HTMLInputElement>('[data-role="bookmark-query"]')!;
        query.value = 'notes'; query.dispatchEvent(new Event('input'));
        f.root.querySelector<HTMLButtonElement>('[data-value="page"]')!.click();
        expect(f.controller.clearSelection).toHaveBeenCalledTimes(2);
        expect(f.controller.setQuery).toHaveBeenCalledWith('notes'); expect(f.controller.setKindFilter).toHaveBeenCalledWith('page');
    });
});
