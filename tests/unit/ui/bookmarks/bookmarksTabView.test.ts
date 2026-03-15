import { describe, expect, it, vi } from 'vitest';

import { BookmarksTabView } from '@/ui/content/bookmarks/ui/tabs/BookmarksTabView';

describe('BookmarksTabView', () => {
    it('keeps distinct platform icons in the filter menu', () => {
        const controller = {
            setQuery: vi.fn(),
            setPlatform: vi.fn(),
            getPlatforms: vi.fn(() => ['All', 'ChatGPT', 'Gemini', 'Claude', 'DeepSeek']),
            getFolderCheckboxState: vi.fn(() => ({ checked: false, indeterminate: false })),
            toggleFolderExpanded: vi.fn(),
            toggleFolderSelection: vi.fn(),
            selectFolder: vi.fn(),
        } as any;

        const view = new BookmarksTabView({
            controller,
            readerPanel: {} as any,
            modal: {} as any,
        });

        view.update({
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
        } as any);

        const root = view.getElement();
        const options = Array.from(root.querySelectorAll<HTMLElement>('.platform-dropdown__option'));
        const optionByLabel = new Map(
            options.map((opt) => [opt.querySelector('.platform-dropdown__label')?.textContent ?? '', opt] as const)
        );

        const chatgptIconHtml = optionByLabel.get('ChatGPT')?.querySelector('.platform-option-icon')?.innerHTML;
        const geminiIconHtml = optionByLabel.get('Gemini')?.querySelector('.platform-option-icon')?.innerHTML;
        const claudeIconHtml = optionByLabel.get('Claude')?.querySelector('.platform-option-icon')?.innerHTML;
        const deepseekIconHtml = optionByLabel.get('DeepSeek')?.querySelector('.platform-option-icon')?.innerHTML;

        expect(chatgptIconHtml).toBeTruthy();
        expect(geminiIconHtml).toBeTruthy();
        expect(claudeIconHtml).toBeTruthy();
        expect(deepseekIconHtml).toBeTruthy();
        expect(geminiIconHtml).not.toBe(chatgptIconHtml);
        expect(claudeIconHtml).not.toBe(chatgptIconHtml);
        expect(deepseekIconHtml).not.toBe(chatgptIconHtml);
    });

    it('uses a folder-specific move label instead of the batch move-selected copy', () => {
        const controller = {
            setQuery: vi.fn(),
            setPlatform: vi.fn(),
            getPlatforms: vi.fn(() => ['All', 'ChatGPT']),
            getFolderCheckboxState: vi.fn(() => ({ checked: false, indeterminate: false })),
            toggleFolderExpanded: vi.fn(),
            toggleFolderSelection: vi.fn(),
            selectFolder: vi.fn(),
            getBookmarkRowSubtitle: vi.fn(() => 'ChatGPT - today'),
        } as any;

        const view = new BookmarksTabView({
            controller,
            readerPanel: {} as any,
            modal: {} as any,
        });

        view.update({
            vm: {
                query: '',
                platform: 'All',
                bookmarks: [],
                folderTree: [
                    {
                        folder: { path: 'Archive', name: 'Archive', depth: 1, createdAt: 0, updatedAt: 0 },
                        children: [],
                        bookmarks: [],
                        isExpanded: true,
                        isSelected: false,
                    },
                ],
                selectedFolderPath: null,
                sortMode: 'time-desc',
            },
            folders: [{ path: 'Archive', name: 'Archive', depth: 1, createdAt: 0, updatedAt: 0 }],
            folderPaths: ['Archive'],
            selectedKeys: new Set(),
            previewId: null,
            status: 'Ready',
        } as any);

        const moveFolderButton = Array.from(view.getElement().querySelectorAll<HTMLButtonElement>('.tree-actions .icon-btn'))
            .find((button) => button.getAttribute('aria-label') === 'moveFolder');

        expect(moveFolderButton).toBeTruthy();
        expect(moveFolderButton?.getAttribute('title')).toBe('moveFolder');
    });

    it('does not attach hover tooltip metadata to the All Platforms trigger or option', () => {
        const controller = {
            setQuery: vi.fn(),
            setPlatform: vi.fn(),
            getPlatforms: vi.fn(() => ['All', 'ChatGPT']),
            getFolderCheckboxState: vi.fn(() => ({ checked: false, indeterminate: false })),
            toggleFolderExpanded: vi.fn(),
            toggleFolderSelection: vi.fn(),
            selectFolder: vi.fn(),
        } as any;

        const view = new BookmarksTabView({
            controller,
            readerPanel: {} as any,
            modal: {} as any,
        });

        view.update({
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
        } as any);

        const root = view.getElement();
        const trigger = root.querySelector<HTMLButtonElement>('.platform-dropdown__trigger');
        const allOption = Array.from(root.querySelectorAll<HTMLButtonElement>('.platform-dropdown__option'))
            .find((option) => option.dataset.value === 'All');

        expect(trigger?.hasAttribute('title')).toBe(false);
        expect(trigger?.dataset.tooltip).toBeUndefined();
        expect(allOption?.hasAttribute('title')).toBe(false);
        expect(allOption?.dataset.tooltip).toBeUndefined();
    });

    it('shows the ascending alphabetical icon when sort mode is alpha-asc', () => {
        const controller = {
            setQuery: vi.fn(),
            setPlatform: vi.fn(),
            getPlatforms: vi.fn(() => ['All', 'ChatGPT']),
            getFolderCheckboxState: vi.fn(() => ({ checked: false, indeterminate: false })),
            toggleFolderExpanded: vi.fn(),
            toggleFolderSelection: vi.fn(),
            selectFolder: vi.fn(),
            getBookmarkRowSubtitle: vi.fn(() => 'ChatGPT - today'),
        } as any;

        const view = new BookmarksTabView({
            controller,
            readerPanel: {} as any,
            modal: {} as any,
        });

        view.update({
            vm: {
                query: '',
                platform: 'All',
                bookmarks: [],
                folderTree: [],
                selectedFolderPath: null,
                sortMode: 'alpha-asc',
            },
            folders: [],
            folderPaths: [],
            selectedKeys: new Set(),
            previewId: null,
            status: 'Ready',
        } as any);

        const root = view.getElement();
        const toolbarGroups = root.querySelectorAll<HTMLElement>('.toolbar-actions');
        const sortButtons = toolbarGroups[0]?.querySelectorAll<HTMLButtonElement>('.icon-btn') ?? [];
        const alphaBtn = sortButtons[1];

        expect(alphaBtn.innerHTML).toContain('m3 8 4-4 4 4');
        expect(alphaBtn.innerHTML).toContain('M7 4v16');
        expect(alphaBtn.innerHTML).not.toContain('m3 16 4 4 4-4');
    });

    it('allows a selected folder to render as collapsed when its node state is collapsed', () => {
        const controller = {
            setQuery: vi.fn(),
            setPlatform: vi.fn(),
            getPlatforms: vi.fn(() => ['All', 'ChatGPT']),
            getFolderCheckboxState: vi.fn(() => ({ checked: false, indeterminate: false })),
            toggleFolderExpanded: vi.fn(),
            toggleFolderSelection: vi.fn(),
            selectFolder: vi.fn(),
            getBookmarkRowSubtitle: vi.fn(() => 'ChatGPT - today'),
        } as any;

        const view = new BookmarksTabView({
            controller,
            readerPanel: {} as any,
            modal: {} as any,
        });

        view.update({
            vm: {
                query: '',
                platform: 'All',
                bookmarks: [],
                folderTree: [
                    {
                        folder: { path: 'Personal/Ideas', name: 'Ideas', depth: 2, createdAt: 0, updatedAt: 0 },
                        children: [],
                        bookmarks: [],
                        isExpanded: false,
                        isSelected: true,
                    },
                ],
                selectedFolderPath: 'Personal/Ideas',
                sortMode: 'time-desc',
            },
            folders: [],
            folderPaths: [],
            selectedKeys: new Set(),
            previewId: null,
            status: 'Ready',
        } as any);

        const row = view.getElement().querySelector<HTMLElement>('.tree-item--folder');
        const children = view.getElement().querySelector<HTMLElement>('.tree-children');

        expect(row?.getAttribute('aria-expanded')).toBe('false');
        expect(children?.dataset.expanded).toBe('0');
    });

    it('keeps folder rows visible instead of showing no-results when folder records exist but bookmarks do not match', () => {
        const controller = {
            setQuery: vi.fn(),
            setPlatform: vi.fn(),
            getPlatforms: vi.fn(() => ['All', 'ChatGPT']),
            getFolderCheckboxState: vi.fn(() => ({ checked: false, indeterminate: false })),
            toggleFolderExpanded: vi.fn(),
            toggleFolderSelection: vi.fn(),
            selectFolder: vi.fn(),
            getBookmarkRowSubtitle: vi.fn(() => 'ChatGPT - today'),
        } as any;

        const view = new BookmarksTabView({
            controller,
            readerPanel: {} as any,
            modal: {} as any,
        });

        view.update({
            vm: {
                query: 'x',
                platform: 'All',
                bookmarks: [],
                folderTree: [
                    {
                        folder: { path: 'abc', name: 'abc', depth: 1, createdAt: 0, updatedAt: 0 },
                        children: [],
                        bookmarks: [],
                        isExpanded: true,
                        isSelected: false,
                    },
                ],
                selectedFolderPath: 'Product',
                sortMode: 'time-desc',
            },
            folders: [],
            folderPaths: ['abc'],
            selectedKeys: new Set(),
            previewId: null,
            status: '',
        } as any);

        const root = view.getElement();
        expect(root.querySelector('.tree-item--folder[data-path="abc"]')).toBeTruthy();
        expect(root.textContent).not.toContain('noFoldersYet');
        expect(root.textContent).not.toContain('noResultsTitle');
    });

    it('shows a no-results empty state when filters are active but no folder records are available to render', () => {
        const controller = {
            setQuery: vi.fn(),
            setPlatform: vi.fn(),
            getPlatforms: vi.fn(() => ['All', 'ChatGPT']),
            getFolderCheckboxState: vi.fn(() => ({ checked: false, indeterminate: false })),
            toggleFolderExpanded: vi.fn(),
            toggleFolderSelection: vi.fn(),
            selectFolder: vi.fn(),
            getBookmarkRowSubtitle: vi.fn(() => 'ChatGPT - today'),
        } as any;

        const view = new BookmarksTabView({
            controller,
            readerPanel: {} as any,
            modal: {} as any,
        });

        view.update({
            vm: {
                query: 'x',
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
            status: '',
        } as any);

        const root = view.getElement();
        expect(root.textContent).toContain('noResultsTitle');
        expect(root.textContent).not.toContain('noFoldersYet');
    });

    it('matches the mock visibility rule by not rendering a no-results empty state while visible folder rows are still shown', () => {
        const controller = {
            setQuery: vi.fn(),
            setPlatform: vi.fn(),
            getPlatforms: vi.fn(() => ['All', 'ChatGPT']),
            getFolderCheckboxState: vi.fn(() => ({ checked: false, indeterminate: false })),
            toggleFolderExpanded: vi.fn(),
            toggleFolderSelection: vi.fn(),
            selectFolder: vi.fn(),
            getBookmarkRowSubtitle: vi.fn(() => 'ChatGPT - today'),
        } as any;

        const view = new BookmarksTabView({
            controller,
            readerPanel: {} as any,
            modal: {} as any,
        });

        view.update({
            vm: {
                query: 'abc',
                platform: 'All',
                bookmarks: [],
                folderTree: [
                    {
                        folder: { path: 'abc', name: 'abc', depth: 1, createdAt: 0, updatedAt: 0 },
                        children: [],
                        bookmarks: [],
                        isExpanded: true,
                        isSelected: false,
                    },
                ],
                selectedFolderPath: 'abc',
                sortMode: 'time-desc',
            },
            folders: [],
            folderPaths: ['abc'],
            selectedKeys: new Set(),
            previewId: null,
            status: '',
        } as any);

        const root = view.getElement();
        expect(root.querySelector('.tree-item--folder[data-path="abc"]')).toBeTruthy();
        expect(root.textContent).not.toContain('noResultsTitle');
    });

    it('renders empty folder rows instead of the initial empty-state copy when folder records exist', () => {
        const controller = {
            setQuery: vi.fn(),
            setPlatform: vi.fn(),
            getPlatforms: vi.fn(() => ['All', 'ChatGPT']),
            getFolderCheckboxState: vi.fn(() => ({ checked: false, indeterminate: false })),
            toggleFolderExpanded: vi.fn(),
            toggleFolderSelection: vi.fn(),
            selectFolder: vi.fn(),
            getBookmarkRowSubtitle: vi.fn(() => 'ChatGPT - today'),
        } as any;

        const view = new BookmarksTabView({
            controller,
            readerPanel: {} as any,
            modal: {} as any,
        });

        view.update({
            vm: {
                query: '',
                platform: 'All',
                bookmarks: [],
                folderTree: [
                    {
                        folder: { path: 'Archive', name: 'Archive', depth: 1, createdAt: 0, updatedAt: 0 },
                        children: [],
                        bookmarks: [],
                        isExpanded: true,
                        isSelected: false,
                    },
                ],
                selectedFolderPath: null,
                sortMode: 'time-desc',
            },
            folders: [{ path: 'Archive', name: 'Archive', depth: 1, createdAt: 0, updatedAt: 0 }],
            folderPaths: ['Archive'],
            selectedKeys: new Set(),
            previewId: null,
            status: '',
        } as any);

        const root = view.getElement();
        expect(root.querySelector('.tree-item--folder[data-path="Archive"]')).toBeTruthy();
        expect(root.textContent).toContain('Archive');
        expect(root.textContent).not.toContain('noResultsTitle');
        expect(root.textContent).not.toContain('noFoldersYet');
    });

    it('keeps ancestor folder rows visible for a selected empty descendant path', () => {
        const controller = {
            setQuery: vi.fn(),
            setPlatform: vi.fn(),
            getPlatforms: vi.fn(() => ['All', 'ChatGPT']),
            getFolderCheckboxState: vi.fn(() => ({ checked: false, indeterminate: false })),
            toggleFolderExpanded: vi.fn(),
            toggleFolderSelection: vi.fn(),
            selectFolder: vi.fn(),
            getBookmarkRowSubtitle: vi.fn(() => 'ChatGPT - today'),
        } as any;

        const view = new BookmarksTabView({
            controller,
            readerPanel: {} as any,
            modal: {} as any,
        });

        view.update({
            vm: {
                query: '',
                platform: 'All',
                bookmarks: [],
                folderTree: [
                    {
                        folder: { path: 'Product', name: 'Product', depth: 1, createdAt: 0, updatedAt: 0 },
                        children: [
                            {
                                folder: { path: 'Product/UX', name: 'UX', depth: 2, createdAt: 0, updatedAt: 0 },
                                children: [],
                                bookmarks: [],
                                isExpanded: false,
                                isSelected: true,
                            },
                        ],
                        bookmarks: [],
                        isExpanded: false,
                        isSelected: false,
                    },
                ],
                selectedFolderPath: 'Product/UX',
                sortMode: 'time-desc',
            },
            folders: [
                { path: 'Product', name: 'Product', depth: 1, createdAt: 0, updatedAt: 0 },
                { path: 'Product/UX', name: 'UX', depth: 2, createdAt: 0, updatedAt: 0 },
            ],
            folderPaths: ['Product', 'Product/UX'],
            selectedKeys: new Set(),
            previewId: null,
            status: '',
        } as any);

        const root = view.getElement();
        expect(root.querySelector('.tree-item--folder[data-path="Product"]')).toBeTruthy();
        expect(root.querySelector('.tree-item--folder[data-path="Product/UX"]')).toBeTruthy();
        expect(root.textContent).not.toContain('noFoldersYet');
    });

    it('shows a caret for folders with child folder records even when no bookmarks are currently visible', () => {
        const controller = {
            setQuery: vi.fn(),
            setPlatform: vi.fn(),
            getPlatforms: vi.fn(() => ['All', 'ChatGPT']),
            getFolderCheckboxState: vi.fn(() => ({ checked: false, indeterminate: false })),
            toggleFolderExpanded: vi.fn(),
            toggleFolderSelection: vi.fn(),
            selectFolder: vi.fn(),
        } as any;

        const view = new BookmarksTabView({
            controller,
            readerPanel: {} as any,
            modal: {} as any,
        });

        view.update({
            vm: {
                query: '',
                platform: 'All',
                bookmarks: [],
                folderTree: [
                    {
                        folder: { path: 'Product', name: 'Product', depth: 1, createdAt: 0, updatedAt: 0 },
                        children: [
                            {
                                folder: { path: 'Product/UX', name: 'UX', depth: 2, createdAt: 0, updatedAt: 0 },
                                children: [],
                                bookmarks: [],
                                isExpanded: false,
                                isSelected: false,
                            },
                        ],
                        bookmarks: [],
                        isExpanded: true,
                        isSelected: false,
                    },
                ],
                selectedFolderPath: null,
                sortMode: 'time-desc',
            },
            folders: [
                { path: 'Product', name: 'Product', depth: 1, createdAt: 0, updatedAt: 0 },
                { path: 'Product/UX', name: 'UX', depth: 2, createdAt: 0, updatedAt: 0 },
            ],
            folderPaths: ['Product', 'Product/UX'],
            selectedKeys: new Set(),
            previewId: null,
            status: '',
        } as any);

        const caret = view.getElement().querySelector<HTMLButtonElement>('.tree-item--folder[data-path="Product"] .tree-caret');
        expect(caret).toBeTruthy();
        expect(caret?.disabled).toBe(false);
        expect(caret?.innerHTML).toContain('svg');
    });

    it('does not render repair or refresh buttons in the toolbar', () => {
        const controller = {
            setQuery: vi.fn(),
            setPlatform: vi.fn(),
            getPlatforms: vi.fn(() => ['All', 'ChatGPT']),
            getFolderCheckboxState: vi.fn(() => ({ checked: false, indeterminate: false })),
            toggleFolderExpanded: vi.fn(),
            toggleFolderSelection: vi.fn(),
            selectFolder: vi.fn(),
        } as any;

        const view = new BookmarksTabView({
            controller,
            readerPanel: {} as any,
            modal: {} as any,
        });

        view.update({
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
            status: '',
        } as any);

        const labels = Array.from(view.getElement().querySelectorAll<HTMLButtonElement>('button')).map((btn) => btn.getAttribute('aria-label'));
        expect(labels).not.toContain('Repair');
        expect(labels).not.toContain('Refresh');
    });

    it('uses the folder main target to select without also toggling expansion', () => {
        const bookmark = {
            id: 'bm-1',
            urlWithoutProtocol: 'chatgpt.com/c/1',
            position: 1,
            folderPath: 'Product/UX',
            title: 'Bookmark title',
            userMessage: 'Prompt',
            aiResponse: 'Response',
            platform: 'ChatGPT',
            createdAt: 0,
            updatedAt: 0,
        };
        const controller = {
            setQuery: vi.fn(),
            setPlatform: vi.fn(),
            getPlatforms: vi.fn(() => ['All', 'ChatGPT']),
            getFolderCheckboxState: vi.fn(() => ({ checked: false, indeterminate: false })),
            toggleFolderExpanded: vi.fn(),
            toggleFolderSelection: vi.fn(),
            selectFolder: vi.fn(),
            getBookmarkRowSubtitle: vi.fn(() => 'ChatGPT - today'),
        } as any;

        const view = new BookmarksTabView({
            controller,
            readerPanel: {} as any,
            modal: {} as any,
        });

        view.update({
            vm: {
                query: '',
                platform: 'All',
                bookmarks: [bookmark],
                folderTree: [
                    {
                        folder: { path: 'Product', name: 'Product', depth: 1, createdAt: 0, updatedAt: 0 },
                        children: [
                            {
                                folder: { path: 'Product/UX', name: 'UX', depth: 2, createdAt: 0, updatedAt: 0 },
                                children: [],
                                bookmarks: [bookmark],
                                isExpanded: false,
                                isSelected: false,
                            },
                        ],
                        bookmarks: [],
                        isExpanded: true,
                        isSelected: false,
                    },
                ],
                selectedFolderPath: 'Product',
                sortMode: 'time-desc',
            },
            folders: [],
            folderPaths: ['Product'],
            selectedKeys: new Set(),
            previewId: null,
            status: '',
        } as any);

        const main = view.getElement().querySelector<HTMLButtonElement>('.tree-item--folder[data-path="Product"] .tree-main--folder');
        expect(main).toBeTruthy();

        main!.click();

        expect(controller.selectFolder).toHaveBeenCalledWith('Product');
        expect(controller.toggleFolderExpanded).not.toHaveBeenCalled();
    });

    it('uses the caret target to toggle expansion without also selecting the folder', () => {
        const controller = {
            setQuery: vi.fn(),
            setPlatform: vi.fn(),
            getPlatforms: vi.fn(() => ['All', 'ChatGPT']),
            getFolderCheckboxState: vi.fn(() => ({ checked: false, indeterminate: false })),
            toggleFolderExpanded: vi.fn(),
            toggleFolderSelection: vi.fn(),
            selectFolder: vi.fn(),
        } as any;

        const view = new BookmarksTabView({
            controller,
            readerPanel: {} as any,
            modal: {} as any,
        });

        view.update({
            vm: {
                query: '',
                platform: 'All',
                bookmarks: [],
                folderTree: [
                    {
                        folder: { path: 'Product', name: 'Product', depth: 1, createdAt: 0, updatedAt: 0 },
                        children: [
                            {
                                folder: { path: 'Product/UX', name: 'UX', depth: 2, createdAt: 0, updatedAt: 0 },
                                children: [],
                                bookmarks: [],
                                isExpanded: false,
                                isSelected: false,
                            },
                        ],
                        bookmarks: [],
                        isExpanded: true,
                        isSelected: false,
                    },
                ],
                selectedFolderPath: null,
                sortMode: 'time-desc',
            },
            folders: [],
            folderPaths: ['Product', 'Product/UX'],
            selectedKeys: new Set(),
            previewId: null,
            status: '',
        } as any);

        const caret = view.getElement().querySelector<HTMLButtonElement>('.tree-item--folder[data-path="Product"] .tree-caret');
        expect(caret).toBeTruthy();

        caret!.click();

        expect(controller.toggleFolderExpanded).toHaveBeenCalledWith('Product');
        expect(controller.selectFolder).not.toHaveBeenCalled();
    });

    it('marks mixed folder selection with a data attribute so the shipped checkbox skin can render indeterminate state', () => {
        const controller = {
            setQuery: vi.fn(),
            setPlatform: vi.fn(),
            getPlatforms: vi.fn(() => ['All', 'ChatGPT']),
            getFolderCheckboxState: vi.fn(() => ({ checked: false, indeterminate: true })),
            toggleFolderExpanded: vi.fn(),
            toggleFolderSelection: vi.fn(),
            selectFolder: vi.fn(),
        } as any;

        const view = new BookmarksTabView({
            controller,
            readerPanel: {} as any,
            modal: {} as any,
        });

        view.update({
            vm: {
                query: '',
                platform: 'All',
                bookmarks: [],
                folderTree: [
                    {
                        folder: { path: 'Product', name: 'Product', depth: 1, createdAt: 0, updatedAt: 0 },
                        children: [],
                        bookmarks: [],
                        isExpanded: true,
                        isSelected: false,
                    },
                ],
                selectedFolderPath: 'Product',
                sortMode: 'time-desc',
            },
            folders: [],
            folderPaths: ['Product'],
            selectedKeys: new Set(),
            previewId: null,
            status: '',
        } as any);

        const checkbox = view.getElement().querySelector<HTMLInputElement>('.tree-item--folder .tree-check');
        expect(checkbox?.dataset.indeterminate).toBe('1');
    });

    it('lets the folder checkbox toggle selection without also expanding the folder row', () => {
        const controller = {
            setQuery: vi.fn(),
            setPlatform: vi.fn(),
            getPlatforms: vi.fn(() => ['All', 'ChatGPT']),
            getFolderCheckboxState: vi.fn(() => ({ checked: false, indeterminate: false })),
            toggleFolderExpanded: vi.fn(),
            toggleFolderSelection: vi.fn(),
            selectFolder: vi.fn(),
        } as any;

        const view = new BookmarksTabView({
            controller,
            readerPanel: {} as any,
            modal: {} as any,
        });

        view.update({
            vm: {
                query: '',
                platform: 'All',
                bookmarks: [],
                folderTree: [
                    {
                        folder: { path: 'Product', name: 'Product', depth: 1, createdAt: 0, updatedAt: 0 },
                        children: [
                            {
                                folder: { path: 'Product/UX', name: 'UX', depth: 2, createdAt: 0, updatedAt: 0 },
                                children: [],
                                bookmarks: [],
                                isExpanded: false,
                                isSelected: false,
                            },
                        ],
                        bookmarks: [],
                        isExpanded: true,
                        isSelected: false,
                    },
                ],
                selectedFolderPath: null,
                sortMode: 'time-desc',
            },
            folders: [],
            folderPaths: ['Product', 'Product/UX'],
            selectedKeys: new Set(),
            previewId: null,
            status: '',
        } as any);

        const checkbox = view.getElement().querySelector<HTMLInputElement>('.tree-item--folder[data-path="Product"] .tree-check');
        expect(checkbox).toBeTruthy();

        checkbox!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        checkbox!.dispatchEvent(new Event('change', { bubbles: true }));

        expect(controller.toggleFolderSelection).toHaveBeenCalledWith('Product');
        expect(controller.toggleFolderExpanded).not.toHaveBeenCalled();
        expect(controller.selectFolder).not.toHaveBeenCalled();
    });

    it('renders bookmark rows with a leading spacer so bookmarks align with folder rows like the mock panel', () => {
        const bookmark = {
            id: 'bm-1',
            folderPath: 'Product',
            title: 'Bookmark title',
            userMessage: 'Prompt',
            aiResponse: 'Response',
            platform: 'ChatGPT',
            createdAt: 0,
            updatedAt: 0,
        };
        const controller = {
            setQuery: vi.fn(),
            setPlatform: vi.fn(),
            getPlatforms: vi.fn(() => ['All', 'ChatGPT']),
            getFolderCheckboxState: vi.fn(() => ({ checked: false, indeterminate: false })),
            toggleFolderExpanded: vi.fn(),
            toggleFolderSelection: vi.fn(),
            toggleBookmarkSelection: vi.fn(),
            selectFolder: vi.fn(),
            getBookmarkRowSubtitle: vi.fn(() => 'ChatGPT - today'),
        } as any;

        const view = new BookmarksTabView({
            controller,
            readerPanel: { show: vi.fn(), hide: vi.fn() } as any,
            modal: {} as any,
        });

        view.update({
            vm: {
                query: '',
                platform: 'All',
                bookmarks: [bookmark],
                folderTree: [
                    {
                        folder: { path: 'Product', name: 'Product', depth: 1, createdAt: 0, updatedAt: 0 },
                        children: [],
                        bookmarks: [bookmark],
                        isExpanded: true,
                        isSelected: false,
                    },
                ],
                selectedFolderPath: null,
                sortMode: 'time-desc',
            },
            folders: [],
            folderPaths: ['Product'],
            selectedKeys: new Set(),
            previewId: null,
            status: '',
        } as any);

        const bookmarkRow = view.getElement().querySelector<HTMLElement>('.tree-item--bookmark');
        expect(bookmarkRow?.querySelector('.tree-caret-slot')).toBeTruthy();
        expect(bookmarkRow?.querySelector('.tree-icon-slot')).toBeTruthy();
        expect(bookmarkRow?.querySelector('.tree-label-row')).toBeTruthy();
        expect(bookmarkRow?.querySelector('button.tree-main--bookmark')).toBeTruthy();
    });

    it('renders folder rows with a button-based main target like the mock panel', () => {
        const controller = {
            setQuery: vi.fn(),
            setPlatform: vi.fn(),
            getPlatforms: vi.fn(() => ['All', 'ChatGPT']),
            getFolderCheckboxState: vi.fn(() => ({ checked: false, indeterminate: false })),
            toggleFolderExpanded: vi.fn(),
            toggleFolderSelection: vi.fn(),
            selectFolder: vi.fn(),
        } as any;

        const view = new BookmarksTabView({
            controller,
            readerPanel: {} as any,
            modal: {} as any,
        });

        view.update({
            vm: {
                query: '',
                platform: 'All',
                bookmarks: [],
                folderTree: [
                    {
                        folder: { path: 'Product', name: 'Product', depth: 1, createdAt: 0, updatedAt: 0 },
                        children: [],
                        bookmarks: [],
                        isExpanded: true,
                        isSelected: false,
                    },
                ],
                selectedFolderPath: 'Product',
                sortMode: 'time-desc',
            },
            folders: [],
            folderPaths: ['Product'],
            selectedKeys: new Set(),
            previewId: null,
            status: '',
        } as any);

        const folderRow = view.getElement().querySelector<HTMLElement>('.tree-item--folder');
        expect(folderRow?.querySelector('button.tree-main--folder')).toBeTruthy();
    });
});
